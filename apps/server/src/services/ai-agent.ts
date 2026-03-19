import { query } from '@anthropic-ai/claude-code';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { buildSystemPrompt, buildSetupPrompt, buildStructuredTestPrompt } from '../ai/system-prompt.js';
import { config } from '../config.js';
import { parseVerdict, parseAssertionResults } from '../ai/verdict-parser.js';
import { browserManager } from './browser-manager.js';
import { sessionStore } from './session-store.js';
import { createBrowserMcpServer, type StepCounter, type McpBrowserContext } from './mcp-browser-server.js';
import type { TestResultDetail, StepStats, FailedAtInfo, WarningInfo, StructuredTestRequest, AssertionResult } from '@ai-e2e/shared';

interface AgentCallbacks {
  onThinking: (content: string) => void;
  onToolCall: (command: string) => void;
  onStatus: (status: string) => void;
}

export interface AgentResult {
  status: 'passed' | 'warning' | 'failed';
  summary: string; // JSON string of TestResultDetail
}

const MCP_TOOL_PREFIX = 'mcp__browser__';

const ALLOWED_TOOLS = [
  'navigate', 'click', 'type_text', 'select_option', 'hover', 'press_key',
  'snapshot', 'screenshot',
  'assert_visible', 'assert_text', 'assert_url',
  'get_text', 'get_attribute',
  'wait_for_element', 'wait',
  'ask_user', 'go_back', 'reload',
  'inspect', 'get_computed_style', 'get_bounding_box',
  'console_messages', 'network_requests',
].map(t => `${MCP_TOOL_PREFIX}${t}`);

const DISALLOWED_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit',
  'Task', 'ExitPlanMode', 'BashOutput', 'KillShell', 'SlashCommand',
];

interface AgentOptions {
  isSetup?: boolean;
  structuredRequest?: StructuredTestRequest;
}

export class AIAgent {
  private abortController: AbortController;
  private _stepCounter: StepCounter;
  private _mcpCtx: McpBrowserContext | null = null;
  private isSetup: boolean;
  private structuredRequest: StructuredTestRequest | undefined;

  constructor(
    private testRunId: string,
    private callbacks: AgentCallbacks,
    options?: AgentOptions,
  ) {
    this.isSetup = options?.isSetup ?? false;
    this.structuredRequest = options?.structuredRequest;
    this.abortController = new AbortController();
    this._stepCounter = {
      _current: 0,
      next() { return ++this._current; },
      count() { return this._current; },
    } as StepCounter & { _current: number };
  }

  get stepCount(): number {
    return this._stepCounter.count();
  }

  cancel(): void {
    this.abortController.abort();
  }

  async run(prompt: string): Promise<AgentResult> {
    const systemPrompt = this.isSetup
      ? buildSetupPrompt()
      : this.structuredRequest
        ? buildStructuredTestPrompt(this.structuredRequest)
        : buildSystemPrompt(this.testRunId);

    // Save initial user message
    await db.insert(schema.conversations).values({
      id: nanoid(),
      testRunId: this.testRunId,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    });

    let lastAssistantText = '';
    const allAssistantTexts: string[] = [];

    try {
      this.callbacks.onStatus('AI 에이전트 시작 중...');

      const page = browserManager.getPage(this.testRunId);
      if (!page) throw new Error('No browser session for this test run');

      const mcpCtx: McpBrowserContext = {
        testRunId: this.testRunId,
        getPage: () => page,
        stepCounter: this._stepCounter,
        assertionExecuted: false,
        hasAssertionFailure: false,
        assertionFailures: [],
        lastRefMap: [],
      };
      this._mcpCtx = mcpCtx;

      const mcpServer = createBrowserMcpServer(mcpCtx);

      const conversation = query({
        prompt,
        options: {
          customSystemPrompt: systemPrompt,
          maxTurns: this.isSetup ? config.setupMaxTurns : 200,
          allowedTools: ALLOWED_TOOLS,
          disallowedTools: DISALLOWED_TOOLS,
          mcpServers: { browser: mcpServer },
          permissionMode: 'bypassPermissions',
          abortController: this.abortController,
          cwd: process.cwd(),
          stderr: (data: string) => {
            logger.info({ testRunId: this.testRunId, stderr: data.trim() }, 'SDK stderr');
          },
        },
      });

      for await (const message of conversation) {
        if (message.type === 'system' && (message as any).subtype === 'init') {
          const init = message as any;
          logger.info({
            testRunId: this.testRunId,
            tools: init.tools,
            mcpServers: init.mcp_servers,
            model: init.model,
          }, 'SDK init message');
        }

        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if ((block as any).type === 'text') {
              const text = (block as any).text;
              if (text) {
                lastAssistantText = text;
                allAssistantTexts.push(text);
                this.callbacks.onThinking(text);

                await db.insert(schema.conversations).values({
                  id: nanoid(),
                  testRunId: this.testRunId,
                  role: 'assistant',
                  content: text,
                  createdAt: new Date().toISOString(),
                });
              }
            }

            if ((block as any).type === 'tool_use') {
              const toolName = (block as any).name ?? '';
              const toolInput = (block as any).input;
              logger.info({ testRunId: this.testRunId, tool: toolName, input: toolInput }, 'Tool call');
              const shortName = toolName.startsWith(MCP_TOOL_PREFIX)
                ? toolName.slice(MCP_TOOL_PREFIX.length)
                : toolName;
              const inputStr = typeof toolInput === 'string'
                ? toolInput
                : JSON.stringify(toolInput);
              this.callbacks.onToolCall(`${shortName}(${inputStr})`);
            }
          }
        }

        if (message.type === 'result') {
          return await this.determineResult(message as any, lastAssistantText, allAssistantTexts);
        }
      }

      // Conversation ended without explicit result → FAIL
      const stepStats = await this.buildStepStats();
      const detail: TestResultDetail = {
        status: 'failed',
        summary: lastAssistantText || 'Test ended without result',
        failedAt: null,
        warnings: [],
        steps: stepStats,
      };
      return { status: 'failed', summary: JSON.stringify(detail) };

    } catch (err: any) {
      if (this.abortController.signal.aborted) {
        throw new Error('Test cancelled');
      }
      logger.error({ err, testRunId: this.testRunId }, 'AI agent error');
      throw err;
    }
  }

  private async determineResult(resultMsg: any, lastAssistantText: string, allAssistantTexts: string[] = []): Promise<AgentResult> {
    const stepStats = await this.buildStepStats();
    const firstFailure = this._mcpCtx?.assertionFailures[0] ?? null;
    const failedAt: FailedAtInfo | null = firstFailure ? {
      step: firstFailure.stepIndex,
      action: firstFailure.action,
      target: firstFailure.target,
      expected: firstFailure.expected,
      actual: firstFailure.actual,
      screenshotUrl: firstFailure.screenshotUrl,
    } : null;

    // error_max_turns or error_during_execution
    if (resultMsg.subtype !== 'success') {
      logger.info({ testRunId: this.testRunId, subtype: resultMsg.subtype }, 'Test ended with non-success subtype');

      // For structured mode, still try to parse results from all conversation
      if (this.structuredRequest && allAssistantTexts.length > 0) {
        const allText = allAssistantTexts.join('\n');
        const partialParsed = parseAssertionResults(allText);
        if (partialParsed.length > 0) {
          logger.info({ testRunId: this.testRunId, parsed: partialParsed.length }, 'Recovered partial assertion results from truncated conversation');
          return this.determineStructuredResult(allText, stepStats, failedAt);
        }
      }

      const detail: TestResultDetail = {
        status: 'failed',
        summary: lastAssistantText || `Test incomplete: ${resultMsg.subtype}`,
        failedAt,
        warnings: [],
        steps: stepStats,
      };
      return { status: 'failed', summary: JSON.stringify(detail) };
    }

    const resultText: string = resultMsg.result || lastAssistantText || '';

    // === Structured mode: parse per-assertion results ===
    if (this.structuredRequest) {
      // Collect all assistant text for parsing (not just last message)
      const allText = allAssistantTexts.length > 0
        ? allAssistantTexts.join('\n')
        : resultText;
      return this.determineStructuredResult(allText, stepStats, failedAt);
    }

    // === Legacy mode: parse TEST_VERDICT ===
    const verdict = parseVerdict(resultText);

    if (verdict) {
      let status: 'passed' | 'warning' | 'failed' = verdict.verdict === 'pass' ? 'passed'
        : verdict.verdict === 'warning' ? 'warning' : 'failed';

      // Override PASS → FAIL if server detected assertion failures
      if (status === 'passed' && this._mcpCtx?.hasAssertionFailure) {
        logger.info({ testRunId: this.testRunId }, 'AI said PASS but assertion failures detected — overriding to FAIL');
        status = 'failed';
      }

      // Map AI warnings
      const warnings: WarningInfo[] = verdict.warnings.map(w => ({
        step: w.step ?? 0,
        message: w.message,
      }));

      const detail: TestResultDetail = {
        status,
        summary: verdict.reason,
        failedAt: status === 'failed' ? failedAt : null,
        warnings,
        steps: stepStats,
      };
      return { status, summary: JSON.stringify(detail) };
    }

    // No structured verdict → FAIL
    logger.info({ testRunId: this.testRunId }, 'No TEST_VERDICT found — defaulting to FAIL');
    const detail: TestResultDetail = {
      status: 'failed',
      summary: resultText || 'Test completed without explicit verdict',
      failedAt,
      warnings: [],
      steps: stepStats,
    };
    return { status: 'failed', summary: JSON.stringify(detail) };
  }

  /**
   * Determine result for structured test mode.
   * Parses per-assertion results from AI output, then computes overall status
   * using severity rules (server-side, not AI).
   */
  private determineStructuredResult(
    resultText: string,
    stepStats: StepStats,
    failedAt: FailedAtInfo | null,
  ): AgentResult {
    const request = this.structuredRequest!;
    const rawParsed = parseAssertionResults(resultText);

    // Deduplicate by assertion id (last occurrence wins)
    const deduped = new Map<string, typeof rawParsed[0]>();
    for (const result of rawParsed) {
      deduped.set(result.id, result);
    }
    const parsed = Array.from(deduped.values());

    // Build assertion ID → severity map from request
    const severityMap = new Map(request.assertions.map(a => [a.id, a.severity]));

    // Map parsed results to AssertionResult, matching severity from request
    const results: AssertionResult[] = request.assertions.map(reqAssertion => {
      const found = parsed.find(p => p.id === reqAssertion.id);
      const result: AssertionResult = {
        id: reqAssertion.id,
        status: found ? found.status : 'failed',
        severity: reqAssertion.severity,
        detail: found ? found.detail : '검증 결과를 파싱할 수 없음',
      };

      // Broadcast per-assertion result via WS
      sessionStore.sendToTestRun(this.testRunId, {
        type: 'assertion:result',
        testRunId: this.testRunId,
        result,
      });

      return result;
    });

    // Compute overall status using severity rules
    const hasCriticalFailure = results.some(r => r.status === 'failed' && r.severity === 'critical');
    const hasMajorFailure = results.some(r => r.status === 'failed' && r.severity === 'major');
    const hasMinorFailure = results.some(r => r.status === 'failed' && r.severity === 'minor');

    let status: 'passed' | 'warning' | 'failed';
    if (hasCriticalFailure) {
      status = 'failed';
    } else if (hasMajorFailure) {
      status = 'warning';
    } else {
      status = 'passed';
    }

    // Build summary
    const passedCount = results.filter(r => r.status === 'passed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const summary = `${request.scenario}: ${passedCount}/${results.length} assertions passed` +
      (failedCount > 0 ? ` (${failedCount} failed)` : '');

    // Build warnings from minor failures
    const warnings: WarningInfo[] = results
      .filter(r => r.status === 'failed' && r.severity === 'minor')
      .map(r => ({ step: 0, message: `[${r.id}] ${r.detail}` }));

    const detail: TestResultDetail = {
      status,
      summary,
      results,
      failedAt: status === 'failed' ? failedAt : null,
      warnings,
      steps: stepStats,
    };

    logger.info({
      testRunId: this.testRunId,
      status,
      assertionResults: results.map(r => `${r.id}:${r.status}`),
    }, 'Structured test result determined');

    return { status, summary: JSON.stringify(detail) };
  }

  private async buildStepStats(): Promise<StepStats> {
    const steps = await db.select().from(schema.testSteps)
      .where(eq(schema.testSteps.testRunId, this.testRunId));
    return {
      total: steps.length,
      passed: steps.filter(s => s.status === 'passed').length,
      failed: steps.filter(s => s.status === 'failed').length,
      skipped: steps.filter(s => s.status === 'skipped' || s.status === 'running').length,
    };
  }
}
