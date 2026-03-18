import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.js';
import { browserManager } from '../../services/browser-manager.js';
import { sessionStore } from '../../services/session-store.js';
import { buildPageContext } from '../../ai/context-builder.js';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

// Per-test step counters
const stepCounters = new Map<string, number>();

export function getNextStep(testRunId: string): number {
  const next = (stepCounters.get(testRunId) ?? 0) + 1;
  stepCounters.set(testRunId, next);
  return next;
}

export function getStepCount(testRunId: string): number {
  return stepCounters.get(testRunId) ?? 0;
}

export function resetStepCounter(testRunId: string): void {
  stepCounters.delete(testRunId);
}

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

function describeAction(action: string, params: Record<string, unknown>): string {
  const label = actionLabels[action] ?? action;
  switch (action) {
    case 'navigate': return `${label}: ${params.url}`;
    case 'click': return `${label}: ${params.selector}`;
    case 'type_text': return `${label}: "${params.text}" → ${params.selector}`;
    case 'assert_text': return `${label}: "${params.expected}" in ${params.selector}`;
    case 'assert_visible': return `${label}: ${params.selector}`;
    case 'assert_url': return `${label}: ${params.expected}`;
    case 'wait_for_element': return `${label}: ${params.selector}`;
    case 'snapshot': return `${label} 중...`;
    case 'screenshot': return `${label} 중...`;
    case 'ask_user': return `${label}: ${params.question}`;
    default: return label;
  }
}

/** Take an auto-screenshot and send it via WS (does not create a step) */
async function autoScreenshot(testRunId: string, stepIndex: number, label: string) {
  try {
    const page = browserManager.getPage(testRunId);
    if (!page) return;
    mkdirSync(config.screenshotsDir, { recursive: true });
    const filename = `${testRunId}_step${stepIndex}_auto_${Date.now()}.png`;
    const filepath = join(config.screenshotsDir, filename);
    await page.screenshot({ path: filepath });
    const url = `/api/screenshots/${filename}`;

    sessionStore.sendToTestRun(testRunId, {
      type: 'screenshot:captured',
      testRunId,
      stepIndex,
      url,
    });
  } catch {
    // Auto-screenshot failure is non-critical
  }
}

export async function internalPwRoutes(app: FastifyInstance) {
  app.post('/internal/pw/:testRunId', async (request, reply) => {
    const { testRunId } = request.params as { testRunId: string };
    const body = request.body as { action: string; [key: string]: unknown };
    const { action, ...params } = body;

    const page = browserManager.getPage(testRunId);
    if (!page) {
      return reply.status(404).send({ error: 'No browser session for this test run' });
    }

    const stepIndex = getNextStep(testRunId);
    const description = describeAction(action, params);

    // Emit step:started with description
    sessionStore.sendToTestRun(testRunId, {
      type: 'step:started',
      testRunId,
      step: { stepIndex, tool: action, input: { ...params, _description: description } },
    });

    // Also emit a status message
    sessionStore.sendToTestRun(testRunId, {
      type: 'ai:status',
      testRunId,
      status: `#${stepIndex} ${description}`,
    });

    // Record step in DB
    const stepId = nanoid();
    await db.insert(schema.testSteps).values({
      id: stepId,
      testRunId,
      stepIndex,
      tool: action,
      input: params as any,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    try {
      let result: Record<string, unknown>;

      switch (action) {
        // === Navigation ===
        case 'navigate': {
          const { url } = params as { url: string };
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          result = { success: true, url: page.url(), title: await page.title() };
          // Auto-screenshot after navigation
          await autoScreenshot(testRunId, stepIndex, 'navigate');
          break;
        }
        case 'go_back': {
          await page.goBack({ waitUntil: 'domcontentloaded' });
          result = { success: true, url: page.url() };
          break;
        }
        case 'reload': {
          await page.reload({ waitUntil: 'domcontentloaded' });
          result = { success: true, url: page.url() };
          await autoScreenshot(testRunId, stepIndex, 'reload');
          break;
        }

        // === Interaction ===
        case 'click': {
          const { selector } = params as { selector: string };
          await page.locator(selector).click({ timeout: 10000 });
          result = { success: true, clicked: selector };
          // Auto-screenshot after click (page may have changed)
          await autoScreenshot(testRunId, stepIndex, 'click');
          break;
        }
        case 'type_text': {
          const { selector, text, clear = true } = params as { selector: string; text: string; clear?: boolean };
          if (clear) await page.locator(selector).fill(text, { timeout: 10000 });
          else await page.locator(selector).pressSequentially(text, { delay: 50 });
          result = { success: true, typed: text, into: selector };
          break;
        }
        case 'select_option': {
          const { selector, value } = params as { selector: string; value: string };
          await page.locator(selector).selectOption(value, { timeout: 10000 });
          result = { success: true, selected: value, in: selector };
          break;
        }
        case 'hover': {
          const { selector } = params as { selector: string };
          await page.locator(selector).hover({ timeout: 10000 });
          result = { success: true, hovered: selector };
          break;
        }
        case 'press_key': {
          const { key } = params as { key: string };
          await page.keyboard.press(key);
          result = { success: true, pressed: key };
          break;
        }

        // === Assertions ===
        case 'assert_visible': {
          const { selector, timeout = 5000 } = params as { selector: string; timeout?: number };
          const isVisible = await page.locator(selector).isVisible({ timeout });
          result = { success: isVisible, assertion: 'visible', selector, result: isVisible ? 'PASS' : 'FAIL' };
          if (!isVisible) await autoScreenshot(testRunId, stepIndex, 'assert_fail');
          break;
        }
        case 'assert_text': {
          const { selector, expected, exact = false } = params as { selector: string; expected: string; exact?: boolean };
          const actual = (await page.locator(selector).textContent({ timeout: 5000 })) ?? '';
          const matches = exact ? actual.trim() === expected : actual.includes(expected);
          result = { success: matches, assertion: 'text', selector, expected, actual: actual.trim(), result: matches ? 'PASS' : 'FAIL' };
          if (!matches) await autoScreenshot(testRunId, stepIndex, 'assert_fail');
          break;
        }
        case 'assert_url': {
          const { expected, exact = false } = params as { expected: string; exact?: boolean };
          const actual = page.url();
          const matches = exact ? actual === expected : actual.includes(expected);
          result = { success: matches, assertion: 'url', expected, actual, result: matches ? 'PASS' : 'FAIL' };
          break;
        }

        // === Extraction ===
        case 'snapshot': {
          const snapshot = await buildPageContext(page);
          result = { url: page.url(), title: await page.title(), snapshot };
          break;
        }
        case 'get_text': {
          const { selector } = params as { selector: string };
          const text = await page.locator(selector).textContent({ timeout: 5000 });
          result = { selector, text: text?.trim() ?? '' };
          break;
        }
        case 'get_attribute': {
          const { selector, attribute } = params as { selector: string; attribute: string };
          const value = await page.locator(selector).getAttribute(attribute, { timeout: 5000 });
          result = { selector, attribute, value };
          break;
        }

        // === Screenshot ===
        case 'screenshot': {
          mkdirSync(config.screenshotsDir, { recursive: true });
          const filename = `${testRunId}_step${stepIndex}_${Date.now()}.png`;
          const filepath = join(config.screenshotsDir, filename);
          const fullPage = (params as any).fullPage ?? false;
          await page.screenshot({ path: filepath, fullPage });
          const url = `/api/screenshots/${filename}`;

          // Update step with screenshot path
          await db.update(schema.testSteps)
            .set({ screenshotPath: filename })
            .where(eq(schema.testSteps.id, stepId));

          sessionStore.sendToTestRun(testRunId, {
            type: 'screenshot:captured',
            testRunId,
            stepIndex,
            url,
          });

          result = { success: true, screenshotUrl: url, filename, filepath };
          break;
        }

        // === Waiting ===
        case 'wait_for_element': {
          const { selector, state = 'visible', timeout = 10000 } = params as { selector: string; state?: string; timeout?: number };
          await page.locator(selector).waitFor({ state: state as any, timeout });
          result = { success: true, selector, state };
          break;
        }
        case 'wait': {
          const { ms } = params as { ms: number };
          const duration = Math.min(ms, 10000);
          await new Promise(resolve => setTimeout(resolve, duration));
          result = { success: true, waited: duration };
          break;
        }

        // === Clarification (ask user) ===
        case 'ask_user': {
          const { question } = params as { question: string };
          const questionId = nanoid();

          sessionStore.sendToTestRun(testRunId, {
            type: 'ai:clarification',
            testRunId,
            questionId,
            question,
          });

          // Save question as conversation
          await db.insert(schema.conversations).values({
            id: nanoid(),
            testRunId,
            role: 'assistant',
            content: question,
            createdAt: new Date().toISOString(),
          });

          // Block until user responds (via WebSocket)
          const answer = await sessionStore.addClarification(testRunId, questionId);

          // Save answer as conversation
          await db.insert(schema.conversations).values({
            id: nanoid(),
            testRunId,
            role: 'user',
            content: answer,
            createdAt: new Date().toISOString(),
          });

          result = { question, answer };
          break;
        }

        default:
          return reply.status(400).send({ error: `Unknown action: ${action}` });
      }

      // Update step as passed
      await db.update(schema.testSteps)
        .set({ result: JSON.stringify(result), status: 'passed' })
        .where(eq(schema.testSteps.id, stepId));

      sessionStore.sendToTestRun(testRunId, {
        type: 'step:completed',
        testRunId,
        step: { stepIndex, tool: action, result: JSON.stringify(result), status: 'passed' },
      });

      return result;

    } catch (err: any) {
      const errorMsg = err.message || 'Action failed';

      await db.update(schema.testSteps)
        .set({ result: errorMsg, status: 'failed' })
        .where(eq(schema.testSteps.id, stepId));

      // Auto-screenshot on failure for debugging
      await autoScreenshot(testRunId, stepIndex, 'error');

      sessionStore.sendToTestRun(testRunId, {
        type: 'step:failed',
        testRunId,
        step: { stepIndex, tool: action, result: errorMsg, status: 'failed' },
      });

      return reply.status(500).send({ error: errorMsg });
    }
  });
}
