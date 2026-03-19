import { createSdkMcpServer, tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import type { Page } from 'playwright';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { nanoid } from 'nanoid';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { sessionStore } from './session-store.js';
import { buildPageContextWithRefs, type RefEntry } from '../ai/context-builder.js';
import { browserManager } from './browser-manager.js';
import { config } from '../config.js';

// Action descriptions in Korean for status messages
const actionLabels: Record<string, string> = {
  navigate: '페이지 이동',
  go_back: '뒤로 가기',
  reload: '페이지 새로고침',
  click: '클릭',
  type_text: '텍스트 입력',
  select_option: '옵션 선택',
  hover: '호버',
  press_key: '키 입력',
  assert_visible: '요소 표시 확인',
  assert_text: '텍스트 확인',
  assert_url: 'URL 확인',
  snapshot: '페이지 분석',
  get_text: '텍스트 추출',
  get_attribute: '속성 추출',
  screenshot: '스크린샷 촬영',
  wait_for_element: '요소 대기',
  wait: '대기',
  ask_user: '사용자에게 질문',
  inspect: '요소 상세 검사',
  get_computed_style: 'CSS 스타일 조회',
  get_bounding_box: '요소 위치/크기 조회',
  console_messages: '콘솔 메시지 조회',
  network_requests: '네트워크 요청 조회',
};

export interface StepCounter {
  next(): number;
  count(): number;
}

export interface AssertionFailureDetail {
  stepIndex: number;
  action: string;
  target: string;
  expected: string;
  actual: string;
  screenshotUrl?: string;
}

export interface McpBrowserContext {
  testRunId: string;
  getPage: () => Page;
  stepCounter: StepCounter;
  /** Set to true when any assert_* tool is called */
  assertionExecuted: boolean;
  /** Set to true when an assertion tool fails (not general tool errors) */
  hasAssertionFailure: boolean;
  /** Detailed info for each assertion failure */
  assertionFailures: AssertionFailureDetail[];
  /** Cached ref map from the last snapshot call */
  lastRefMap: RefEntry[];
}

/** Resolve ref or selector to a Playwright selector string */
function resolveSelector(args: { ref?: number; selector?: string }): string {
  if (args.ref !== undefined) return `[data-ete-ref="${args.ref}"]`;
  if (args.selector) return args.selector;
  throw new Error('Either ref or selector must be provided');
}

/** Human-readable description of the target */
function targetDesc(args: { ref?: number; selector?: string }): string {
  if (args.ref !== undefined) return `ref=${args.ref}`;
  return args.selector || '?';
}

/** Save screenshot to disk and notify clients via WS */
async function saveScreenshot(
  testRunId: string,
  stepIndex: number,
  buffer: Buffer,
  stepId?: string,
): Promise<string> {
  mkdirSync(config.screenshotsDir, { recursive: true });
  const filename = `${testRunId}_step${stepIndex}_${Date.now()}.png`;
  const filepath = join(config.screenshotsDir, filename);
  writeFileSync(filepath, buffer);
  const url = `/api/screenshots/${filename}`;

  if (stepId) {
    await db.update(schema.testSteps)
      .set({ screenshotPath: filename })
      .where(eq(schema.testSteps.id, stepId));
  }

  sessionStore.sendToTestRun(testRunId, {
    type: 'screenshot:captured',
    testRunId,
    stepIndex,
    url,
  });

  return url;
}

/** Build a CallToolResult with text + optional image */
function textResult(data: Record<string, unknown>, screenshotBuffer?: Buffer): CallToolResult {
  const content: CallToolResult['content'] = [
    { type: 'text', text: JSON.stringify(data) },
  ];
  if (screenshotBuffer) {
    content.push({
      type: 'image',
      data: screenshotBuffer.toString('base64'),
      mimeType: 'image/png',
    });
  }
  return { content };
}

function errorResult(msg: string, screenshotBuffer?: Buffer): CallToolResult {
  const content: CallToolResult['content'] = [
    { type: 'text', text: JSON.stringify({ error: msg }) },
  ];
  if (screenshotBuffer) {
    content.push({
      type: 'image',
      data: screenshotBuffer.toString('base64'),
      mimeType: 'image/png',
    });
  }
  return { content, isError: true };
}

/**
 * Creates a wrapped handler that tracks each tool invocation as a test step
 * (DB record + WS broadcast for step:started/completed/failed).
 */
function tracked(
  ctx: McpBrowserContext,
  actionName: string,
  descFn: (args: any) => string,
  fn: (page: Page, args: any, stepIndex: number, stepId: string) => Promise<CallToolResult>,
) {
  return async (args: any, _extra: unknown): Promise<CallToolResult> => {
    const page = ctx.getPage();
    const stepIndex = ctx.stepCounter.next();
    const description = descFn(args);

    // Broadcast step:started
    sessionStore.sendToTestRun(ctx.testRunId, {
      type: 'step:started',
      testRunId: ctx.testRunId,
      step: { stepIndex, tool: actionName, input: { ...args, _description: description } },
    });
    sessionStore.sendToTestRun(ctx.testRunId, {
      type: 'ai:status',
      testRunId: ctx.testRunId,
      status: `#${stepIndex} ${description}`,
    });

    // Record step in DB
    const stepId = nanoid();
    await db.insert(schema.testSteps).values({
      id: stepId,
      testRunId: ctx.testRunId,
      stepIndex,
      tool: actionName,
      input: args as any,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    try {
      const result = await fn(page, args, stepIndex, stepId);

      // Extract text content for DB
      const resultText = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');

      await db.update(schema.testSteps)
        .set({ result: resultText, status: 'passed' })
        .where(eq(schema.testSteps.id, stepId));

      sessionStore.sendToTestRun(ctx.testRunId, {
        type: 'step:completed',
        testRunId: ctx.testRunId,
        step: { stepIndex, tool: actionName, result: resultText, status: 'passed' },
      });

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Action failed';

      await db.update(schema.testSteps)
        .set({ result: errorMsg, status: 'failed' })
        .where(eq(schema.testSteps.id, stepId));

      // Auto-screenshot on failure
      let failScreenshot: Buffer | undefined;
      try {
        failScreenshot = await page.screenshot() as Buffer;
        await saveScreenshot(ctx.testRunId, stepIndex, failScreenshot, stepId);
      } catch { /* non-critical */ }

      sessionStore.sendToTestRun(ctx.testRunId, {
        type: 'step:failed',
        testRunId: ctx.testRunId,
        step: { stepIndex, tool: actionName, result: errorMsg, status: 'failed' },
      });

      return errorResult(errorMsg, failScreenshot);
    }
  };
}

// Shared schema fragments for ref/selector targeting
const refOrSelectorSchema = {
  ref: z.number().optional().describe('Element ref number from snapshot (preferred)'),
  selector: z.string().optional().describe('Playwright selector (fallback)'),
};

export function createBrowserMcpServer(ctx: McpBrowserContext) {
  return createSdkMcpServer({
    name: 'browser',
    version: '1.0.0',
    tools: [
      // === Navigation ===
      tool(
        'navigate',
        'Navigate to a URL. Returns a screenshot of the loaded page.',
        { url: z.string().describe('The URL to navigate to') },
        tracked(ctx, 'navigate', (a) => `${actionLabels.navigate}: ${a.url}`,
          async (page, args, stepIndex, stepId) => {
            await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const result = { success: true, url: page.url(), title: await page.title() };
            const screenshot = await page.screenshot() as Buffer;
            await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
            return textResult(result, screenshot);
          }),
      ),

      tool(
        'go_back',
        'Navigate back in browser history.',
        {},
        tracked(ctx, 'go_back', () => actionLabels.go_back,
          async (page) => {
            await page.goBack({ waitUntil: 'domcontentloaded' });
            return textResult({ success: true, url: page.url() });
          }),
      ),

      tool(
        'reload',
        'Reload the current page. Returns a screenshot.',
        {},
        tracked(ctx, 'reload', () => actionLabels.reload,
          async (page, _args, stepIndex, stepId) => {
            await page.reload({ waitUntil: 'domcontentloaded' });
            const result = { success: true, url: page.url() };
            const screenshot = await page.screenshot() as Buffer;
            await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
            return textResult(result, screenshot);
          }),
      ),

      // === Interaction ===
      tool(
        'click',
        'Click an element by ref number or selector. Returns a screenshot after clicking.',
        { ...refOrSelectorSchema },
        tracked(ctx, 'click', (a) => `${actionLabels.click}: ${targetDesc(a)}`,
          async (page, args, stepIndex, stepId) => {
            const sel = resolveSelector(args);
            await page.locator(sel).click({ timeout: 10000 });
            const result = { success: true, clicked: targetDesc(args) };
            const screenshot = await page.screenshot() as Buffer;
            await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
            return textResult(result, screenshot);
          }),
      ),

      tool(
        'type_text',
        'Type text into an input element by ref number or selector.',
        {
          ...refOrSelectorSchema,
          text: z.string().describe('Text to type'),
          clear: z.boolean().optional().default(true).describe('Clear the field before typing (default: true)'),
        },
        tracked(ctx, 'type_text', (a) => `${actionLabels.type_text}: "${a.text}" → ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            if (args.clear) {
              await page.locator(sel).fill(args.text, { timeout: 10000 });
            } else {
              await page.locator(sel).pressSequentially(args.text, { delay: 50 });
            }
            return textResult({ success: true, typed: args.text, into: targetDesc(args) });
          }),
      ),

      tool(
        'select_option',
        'Select an option from a dropdown by ref number or selector.',
        {
          ...refOrSelectorSchema,
          value: z.string().describe('Value to select'),
        },
        tracked(ctx, 'select_option', (a) => `${actionLabels.select_option}: ${a.value}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            await page.locator(sel).selectOption(args.value, { timeout: 10000 });
            return textResult({ success: true, selected: args.value, in: targetDesc(args) });
          }),
      ),

      tool(
        'hover',
        'Hover over an element by ref number or selector.',
        { ...refOrSelectorSchema },
        tracked(ctx, 'hover', (a) => `${actionLabels.hover}: ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            await page.locator(sel).hover({ timeout: 10000 });
            return textResult({ success: true, hovered: targetDesc(args) });
          }),
      ),

      tool(
        'press_key',
        'Press a keyboard key (Enter, Tab, Escape, etc.).',
        { key: z.string().describe('Key to press (e.g. Enter, Tab, Escape, ArrowDown)') },
        tracked(ctx, 'press_key', (a) => `${actionLabels.press_key}: ${a.key}`,
          async (page, args) => {
            await page.keyboard.press(args.key);
            return textResult({ success: true, pressed: args.key });
          }),
      ),

      // === Page Info ===
      tool(
        'snapshot',
        'Analyze the current page. Returns a ref-numbered element map + screenshot. Use ref numbers with other tools (click, type_text, etc.).',
        {},
        tracked(ctx, 'snapshot', () => `${actionLabels.snapshot} 중...`,
          async (page, _args, stepIndex, stepId) => {
            const context = await buildPageContextWithRefs(page);
            ctx.lastRefMap = context.refMap;
            const screenshot = await page.screenshot() as Buffer;
            await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
            return textResult({
              url: context.url,
              title: context.title,
              elementCount: context.refMap.length,
              elements: context.formatted,
            }, screenshot);
          }),
      ),

      tool(
        'screenshot',
        'Take a screenshot of the current page.',
        {
          fullPage: z.boolean().optional().default(false).describe('Capture the full page (default: false)'),
        },
        tracked(ctx, 'screenshot', () => `${actionLabels.screenshot} 중...`,
          async (page, args, stepIndex, stepId) => {
            const buffer = await page.screenshot({ fullPage: args.fullPage }) as Buffer;
            const url = await saveScreenshot(ctx.testRunId, stepIndex, buffer, stepId);
            return textResult({ success: true, screenshotUrl: url }, buffer);
          }),
      ),

      // === Assertions ===
      tool(
        'assert_visible',
        'Assert that an element is visible on the page. Use ref or selector.',
        {
          ...refOrSelectorSchema,
          timeout: z.number().optional().default(5000).describe('Timeout in ms (default: 5000)'),
        },
        tracked(ctx, 'assert_visible', (a) => `${actionLabels.assert_visible}: ${targetDesc(a)}`,
          async (page, args, stepIndex, stepId) => {
            ctx.assertionExecuted = true;
            const sel = resolveSelector(args);
            const desc = targetDesc(args);
            const isVisible = await page.locator(sel).isVisible({ timeout: args.timeout });
            if (!isVisible) {
              ctx.hasAssertionFailure = true;
              const screenshot = await page.screenshot() as Buffer;
              const ssUrl = await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
              ctx.assertionFailures.push({
                stepIndex, action: 'assert_visible', target: desc,
                expected: `Element "${desc}" is visible`,
                actual: 'Element not visible',
                screenshotUrl: ssUrl,
              });
              return errorResult(
                `ASSERTION FAILED: Element "${desc}" is not visible. The test should FAIL.`,
                screenshot,
              );
            }
            return textResult({ success: true, assertion: 'visible', target: desc, result: 'PASS' });
          }),
      ),

      tool(
        'assert_text',
        'Assert that an element contains specific text. Use ref or selector.',
        {
          ...refOrSelectorSchema,
          expected: z.string().describe('Expected text'),
          exact: z.boolean().optional().default(false).describe('Exact match (default: false, uses includes)'),
        },
        tracked(ctx, 'assert_text', (a) => `${actionLabels.assert_text}: "${a.expected}" in ${targetDesc(a)}`,
          async (page, args, stepIndex, stepId) => {
            ctx.assertionExecuted = true;
            const sel = resolveSelector(args);
            const desc = targetDesc(args);
            const actual = (await page.locator(sel).textContent({ timeout: 5000 })) ?? '';
            const matches = args.exact ? actual.trim() === args.expected : actual.includes(args.expected);
            if (!matches) {
              ctx.hasAssertionFailure = true;
              const screenshot = await page.screenshot() as Buffer;
              const ssUrl = await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
              ctx.assertionFailures.push({
                stepIndex, action: 'assert_text', target: desc,
                expected: args.expected,
                actual: actual.trim(),
                screenshotUrl: ssUrl,
              });
              return errorResult(
                `ASSERTION FAILED: Expected text "${args.expected}" in "${desc}", but got "${actual.trim()}". The test should FAIL.`,
                screenshot,
              );
            }
            return textResult({ success: true, assertion: 'text', target: desc, expected: args.expected, actual: actual.trim(), result: 'PASS' });
          }),
      ),

      tool(
        'assert_url',
        'Assert the current page URL.',
        {
          expected: z.string().describe('Expected URL or substring'),
          exact: z.boolean().optional().default(false).describe('Exact match (default: false, uses includes)'),
        },
        tracked(ctx, 'assert_url', (a) => `${actionLabels.assert_url}: ${a.expected}`,
          async (page, args, stepIndex) => {
            ctx.assertionExecuted = true;
            const actual = page.url();
            const matches = args.exact ? actual === args.expected : actual.includes(args.expected);
            if (!matches) {
              ctx.hasAssertionFailure = true;
              ctx.assertionFailures.push({
                stepIndex, action: 'assert_url', target: args.expected,
                expected: args.expected, actual,
              });
              return errorResult(
                `ASSERTION FAILED: Expected URL "${args.expected}", but got "${actual}". The test should FAIL.`,
              );
            }
            return textResult({ success: true, assertion: 'url', expected: args.expected, actual, result: 'PASS' });
          }),
      ),

      // === Extraction ===
      tool(
        'get_text',
        'Get the text content of an element by ref or selector.',
        { ...refOrSelectorSchema },
        tracked(ctx, 'get_text', (a) => `${actionLabels.get_text}: ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            const text = await page.locator(sel).textContent({ timeout: 5000 });
            return textResult({ target: targetDesc(args), text: text?.trim() ?? '' });
          }),
      ),

      tool(
        'get_attribute',
        'Get an attribute value from an element by ref or selector.',
        {
          ...refOrSelectorSchema,
          attribute: z.string().describe('Attribute name'),
        },
        tracked(ctx, 'get_attribute', (a) => `${actionLabels.get_attribute}: ${a.attribute} of ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            const value = await page.locator(sel).getAttribute(args.attribute, { timeout: 5000 });
            return textResult({ target: targetDesc(args), attribute: args.attribute, value });
          }),
      ),

      // === Inspection (Phase 2) ===
      tool(
        'inspect',
        'Inspect an element in detail. Returns HTML, computed styles, bounding box, attributes, and an element screenshot.',
        {
          ...refOrSelectorSchema,
          properties: z.array(z.string()).optional().describe('CSS properties to include (default: all common ones)'),
        },
        tracked(ctx, 'inspect', (a) => `${actionLabels.inspect}: ${targetDesc(a)}`,
          async (page, args, stepIndex, stepId) => {
            const sel = resolveSelector(args);
            const desc = targetDesc(args);
            const locator = page.locator(sel);

            // Element screenshot
            let elemScreenshot: Buffer | undefined;
            try {
              elemScreenshot = await locator.screenshot() as Buffer;
              await saveScreenshot(ctx.testRunId, stepIndex, elemScreenshot, stepId);
            } catch { /* element might not be screenshottable */ }

            // Extract element details via page.evaluate
            const details = await page.evaluate(({ selector, props }: { selector: string; props?: string[] }) => {
              const el = document.querySelector(selector);
              if (!el) return null;

              const htmlEl = el as HTMLElement;
              const rect = el.getBoundingClientRect();
              const computed = window.getComputedStyle(el);

              const defaultProps = [
                'color', 'backgroundColor', 'fontSize', 'fontWeight', 'display',
                'visibility', 'opacity', 'position', 'width', 'height',
                'margin', 'padding', 'border', 'textAlign',
              ];
              const cssProps = props || defaultProps;
              const styles: Record<string, string> = {};
              for (const p of cssProps) {
                styles[p] = computed.getPropertyValue(p.replace(/([A-Z])/g, '-$1').toLowerCase());
              }

              const attrs: Record<string, string> = {};
              for (const attr of el.attributes) {
                attrs[attr.name] = attr.value;
              }

              return {
                tagName: el.tagName.toLowerCase(),
                outerHTML: htmlEl.outerHTML.slice(0, 2000),
                text: (htmlEl.innerText || htmlEl.textContent || '').trim().slice(0, 500),
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                computedStyle: styles,
                attributes: attrs,
              };
            }, { selector: sel, props: args.properties });

            if (!details) {
              return errorResult(`Element "${desc}" not found`);
            }

            return textResult({ target: desc, ...details }, elemScreenshot);
          }),
      ),

      tool(
        'get_computed_style',
        'Get computed CSS style properties of an element.',
        {
          ...refOrSelectorSchema,
          properties: z.array(z.string()).describe('CSS property names to retrieve (e.g. ["color", "display", "fontSize"])'),
        },
        tracked(ctx, 'get_computed_style', (a) => `${actionLabels.get_computed_style}: ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            const styles = await page.evaluate(({ selector, props }: { selector: string; props: string[] }) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const computed = window.getComputedStyle(el);
              const result: Record<string, string> = {};
              for (const p of props) {
                result[p] = computed.getPropertyValue(p.replace(/([A-Z])/g, '-$1').toLowerCase());
              }
              return result;
            }, { selector: sel, props: args.properties });

            if (!styles) {
              return errorResult(`Element "${targetDesc(args)}" not found`);
            }
            return textResult({ target: targetDesc(args), styles });
          }),
      ),

      tool(
        'get_bounding_box',
        'Get the position and size of an element.',
        { ...refOrSelectorSchema },
        tracked(ctx, 'get_bounding_box', (a) => `${actionLabels.get_bounding_box}: ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            const box = await page.locator(sel).boundingBox({ timeout: 5000 });
            if (!box) {
              return errorResult(`Element "${targetDesc(args)}" not found or not visible`);
            }
            return textResult({ target: targetDesc(args), ...box });
          }),
      ),

      // === Waiting ===
      tool(
        'wait_for_element',
        'Wait for an element to reach a certain state. Use ref or selector.',
        {
          ...refOrSelectorSchema,
          state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional().default('visible').describe('State to wait for'),
          timeout: z.number().optional().default(10000).describe('Timeout in ms (default: 10000)'),
        },
        tracked(ctx, 'wait_for_element', (a) => `${actionLabels.wait_for_element}: ${targetDesc(a)}`,
          async (page, args) => {
            const sel = resolveSelector(args);
            await page.locator(sel).waitFor({ state: args.state as any, timeout: args.timeout });
            return textResult({ success: true, target: targetDesc(args), state: args.state });
          }),
      ),

      tool(
        'wait',
        'Wait for a fixed amount of time (max 10 seconds).',
        { ms: z.number().describe('Milliseconds to wait (max 10000)') },
        tracked(ctx, 'wait', (a) => `${actionLabels.wait}: ${a.ms}ms`,
          async (_page, args) => {
            const duration = Math.min(args.ms, 10000);
            await new Promise(resolve => setTimeout(resolve, duration));
            return textResult({ success: true, waited: duration });
          }),
      ),

      // === Monitoring (Phase 3) ===
      tool(
        'console_messages',
        'Get browser console messages (errors, warnings, logs).',
        {
          level: z.enum(['all', 'error', 'warning', 'log']).optional().default('all').describe('Filter by message level'),
          limit: z.number().optional().default(50).describe('Max messages to return (default: 50)'),
        },
        tracked(ctx, 'console_messages', (a) => `${actionLabels.console_messages}: ${a.level}`,
          async (_page, args) => {
            const allMessages = browserManager.getConsoleMessages(ctx.testRunId);
            let filtered = allMessages;
            if (args.level && args.level !== 'all') {
              filtered = allMessages.filter(m => m.type === args.level);
            }
            const limited = filtered.slice(-args.limit);
            return textResult({ total: filtered.length, returned: limited.length, messages: limited });
          }),
      ),

      tool(
        'network_requests',
        'Get captured network requests and responses.',
        {
          urlPattern: z.string().optional().describe('Filter by URL substring'),
          statusFilter: z.enum(['all', 'errors', 'success']).optional().default('all').describe('Filter by status'),
          limit: z.number().optional().default(50).describe('Max entries to return (default: 50)'),
        },
        tracked(ctx, 'network_requests', (a) => `${actionLabels.network_requests}: ${a.statusFilter || 'all'}`,
          async (_page, args) => {
            const allEntries = browserManager.getNetworkEntries(ctx.testRunId);
            let filtered = allEntries;
            if (args.urlPattern) {
              filtered = filtered.filter(e => e.url.includes(args.urlPattern!));
            }
            if (args.statusFilter === 'errors') {
              filtered = filtered.filter(e => e.failure || (e.status && e.status >= 400));
            } else if (args.statusFilter === 'success') {
              filtered = filtered.filter(e => e.status && e.status >= 200 && e.status < 400);
            }
            const limited = filtered.slice(-args.limit);
            return textResult({ total: filtered.length, returned: limited.length, entries: limited });
          }),
      ),

      // === User Interaction ===
      tool(
        'ask_user',
        'Ask the user a question and wait for their answer. Use this when you need information like credentials or choices.',
        { question: z.string().describe('The question to ask the user') },
        tracked(ctx, 'ask_user', (a) => `${actionLabels.ask_user}: ${a.question}`,
          async (_page, args) => {
            const questionId = nanoid();

            sessionStore.sendToTestRun(ctx.testRunId, {
              type: 'ai:clarification',
              testRunId: ctx.testRunId,
              questionId,
              question: args.question,
            });

            // Save question as conversation
            await db.insert(schema.conversations).values({
              id: nanoid(),
              testRunId: ctx.testRunId,
              role: 'assistant',
              content: args.question,
              createdAt: new Date().toISOString(),
            });

            // Block until user responds via WebSocket
            const answer = await sessionStore.addClarification(ctx.testRunId, questionId);

            // Save answer as conversation
            await db.insert(schema.conversations).values({
              id: nanoid(),
              testRunId: ctx.testRunId,
              role: 'user',
              content: answer,
              createdAt: new Date().toISOString(),
            });

            return textResult({ question: args.question, answer });
          }),
      ),
    ],
  });
}
