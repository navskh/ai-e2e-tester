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
import { buildPageContext } from '../ai/context-builder.js';
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
        'Click an element. Returns a screenshot after clicking.',
        { selector: z.string().describe('Playwright selector for the element to click') },
        tracked(ctx, 'click', (a) => `${actionLabels.click}: ${a.selector}`,
          async (page, args, stepIndex, stepId) => {
            await page.locator(args.selector).click({ timeout: 10000 });
            const result = { success: true, clicked: args.selector };
            const screenshot = await page.screenshot() as Buffer;
            await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
            return textResult(result, screenshot);
          }),
      ),

      tool(
        'type_text',
        'Type text into an input element.',
        {
          selector: z.string().describe('Playwright selector for the input element'),
          text: z.string().describe('Text to type'),
          clear: z.boolean().optional().default(true).describe('Clear the field before typing (default: true)'),
        },
        tracked(ctx, 'type_text', (a) => `${actionLabels.type_text}: "${a.text}" → ${a.selector}`,
          async (page, args) => {
            if (args.clear) {
              await page.locator(args.selector).fill(args.text, { timeout: 10000 });
            } else {
              await page.locator(args.selector).pressSequentially(args.text, { delay: 50 });
            }
            return textResult({ success: true, typed: args.text, into: args.selector });
          }),
      ),

      tool(
        'select_option',
        'Select an option from a dropdown.',
        {
          selector: z.string().describe('Playwright selector for the select element'),
          value: z.string().describe('Value to select'),
        },
        tracked(ctx, 'select_option', (a) => `${actionLabels.select_option}: ${a.value}`,
          async (page, args) => {
            await page.locator(args.selector).selectOption(args.value, { timeout: 10000 });
            return textResult({ success: true, selected: args.value, in: args.selector });
          }),
      ),

      tool(
        'hover',
        'Hover over an element.',
        { selector: z.string().describe('Playwright selector for the element') },
        tracked(ctx, 'hover', (a) => `${actionLabels.hover}: ${a.selector}`,
          async (page, args) => {
            await page.locator(args.selector).hover({ timeout: 10000 });
            return textResult({ success: true, hovered: args.selector });
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
        'Get the accessibility tree of the current page. Use this to understand page structure and find selectors.',
        {},
        tracked(ctx, 'snapshot', () => `${actionLabels.snapshot} 중...`,
          async (page) => {
            const snapshot = await buildPageContext(page);
            return textResult({ url: page.url(), title: await page.title(), snapshot });
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
        'Assert that an element is visible on the page.',
        {
          selector: z.string().describe('Playwright selector'),
          timeout: z.number().optional().default(5000).describe('Timeout in ms (default: 5000)'),
        },
        tracked(ctx, 'assert_visible', (a) => `${actionLabels.assert_visible}: ${a.selector}`,
          async (page, args, stepIndex, stepId) => {
            ctx.assertionExecuted = true;
            const isVisible = await page.locator(args.selector).isVisible({ timeout: args.timeout });
            if (!isVisible) {
              ctx.hasAssertionFailure = true;
              const screenshot = await page.screenshot() as Buffer;
              const ssUrl = await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
              ctx.assertionFailures.push({
                stepIndex, action: 'assert_visible', target: args.selector,
                expected: `Element "${args.selector}" is visible`,
                actual: 'Element not visible',
                screenshotUrl: ssUrl,
              });
              return errorResult(
                `ASSERTION FAILED: Element "${args.selector}" is not visible. The test should FAIL.`,
                screenshot,
              );
            }
            return textResult({ success: true, assertion: 'visible', selector: args.selector, result: 'PASS' });
          }),
      ),

      tool(
        'assert_text',
        'Assert that an element contains specific text.',
        {
          selector: z.string().describe('Playwright selector'),
          expected: z.string().describe('Expected text'),
          exact: z.boolean().optional().default(false).describe('Exact match (default: false, uses includes)'),
        },
        tracked(ctx, 'assert_text', (a) => `${actionLabels.assert_text}: "${a.expected}" in ${a.selector}`,
          async (page, args, stepIndex, stepId) => {
            ctx.assertionExecuted = true;
            const actual = (await page.locator(args.selector).textContent({ timeout: 5000 })) ?? '';
            const matches = args.exact ? actual.trim() === args.expected : actual.includes(args.expected);
            if (!matches) {
              ctx.hasAssertionFailure = true;
              const screenshot = await page.screenshot() as Buffer;
              const ssUrl = await saveScreenshot(ctx.testRunId, stepIndex, screenshot, stepId);
              ctx.assertionFailures.push({
                stepIndex, action: 'assert_text', target: args.selector,
                expected: args.expected,
                actual: actual.trim(),
                screenshotUrl: ssUrl,
              });
              return errorResult(
                `ASSERTION FAILED: Expected text "${args.expected}" in "${args.selector}", but got "${actual.trim()}". The test should FAIL.`,
                screenshot,
              );
            }
            return textResult({ success: true, assertion: 'text', selector: args.selector, expected: args.expected, actual: actual.trim(), result: 'PASS' });
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
        'Get the text content of an element.',
        { selector: z.string().describe('Playwright selector') },
        tracked(ctx, 'get_text', (a) => `${actionLabels.get_text}: ${a.selector}`,
          async (page, args) => {
            const text = await page.locator(args.selector).textContent({ timeout: 5000 });
            return textResult({ selector: args.selector, text: text?.trim() ?? '' });
          }),
      ),

      tool(
        'get_attribute',
        'Get an attribute value from an element.',
        {
          selector: z.string().describe('Playwright selector'),
          attribute: z.string().describe('Attribute name'),
        },
        tracked(ctx, 'get_attribute', (a) => `${actionLabels.get_attribute}: ${a.attribute} of ${a.selector}`,
          async (page, args) => {
            const value = await page.locator(args.selector).getAttribute(args.attribute, { timeout: 5000 });
            return textResult({ selector: args.selector, attribute: args.attribute, value });
          }),
      ),

      // === Waiting ===
      tool(
        'wait_for_element',
        'Wait for an element to reach a certain state.',
        {
          selector: z.string().describe('Playwright selector'),
          state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional().default('visible').describe('State to wait for'),
          timeout: z.number().optional().default(10000).describe('Timeout in ms (default: 10000)'),
        },
        tracked(ctx, 'wait_for_element', (a) => `${actionLabels.wait_for_element}: ${a.selector}`,
          async (page, args) => {
            await page.locator(args.selector).waitFor({ state: args.state as any, timeout: args.timeout });
            return textResult({ success: true, selector: args.selector, state: args.state });
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
