import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/client.js';
import { browserManager } from './browser-manager.js';
import { sessionStore } from './session-store.js';
import { AIAgent } from './ai-agent.js';
import { authStateManager, extractDomain } from './auth-state-manager.js';
import { sendTestResultEmail } from './mail.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { ServerMessage, StructuredTestRequest } from '@ai-e2e/shared';

class TestOrchestrator {
  private runningTests = new Map<string, { agent: AIAgent; cancelled: boolean }>();

  async runTest(
    testRunId: string,
    prompt: string,
    options?: Record<string, unknown>,
    structuredRequest?: StructuredTestRequest,
  ): Promise<void> {
    const startTime = Date.now();
    const setup = structuredRequest?.setup ?? (options?.setup as string) ?? null;
    const reuseAuth = structuredRequest?.options?.reuseAuth ?? (options?.reuseAuth as boolean) ?? false;

    // Update status to running
    await db.update(schema.testRuns)
      .set({ status: 'running' })
      .where(eq(schema.testRuns.id, testRunId));

    this.broadcast(testRunId, { type: 'test:started', testRunId });

    let agent: AIAgent | undefined;

    try {
      // Launch browser — notify client
      this.broadcast(testRunId, {
        type: 'ai:status',
        testRunId,
        status: '브라우저를 시작하는 중...',
      });

      // Check for cached auth state
      const targetUrl = structuredRequest?.targetUrl ?? options?.targetUrl as string;
      const domain = this.extractDomainFromPrompt(prompt, setup, targetUrl);
      let cachedState: any = null;

      if (reuseAuth && domain) {
        cachedState = authStateManager.getState(domain);
        if (cachedState) {
          this.broadcast(testRunId, {
            type: 'ai:status',
            testRunId,
            status: '캐시된 인증 상태를 복원하는 중...',
          });
        }
      }

      await browserManager.createSession(testRunId, {
        browserType: (structuredRequest?.options?.browserType ?? options?.browserType as any) ?? 'chromium',
        headless: (structuredRequest?.options?.headless ?? options?.headless) !== false,
        ...(cachedState ? { storageState: cachedState } : {}),
      });

      // Run setup if needed (and no cached state)
      if (setup && !cachedState) {
        this.broadcast(testRunId, {
          type: 'ai:status',
          testRunId,
          status: '셋업(로그인) 진행 중...',
        });

        const setupAgent = new AIAgent(testRunId, {
          onThinking: (content) => {
            this.broadcast(testRunId, { type: 'ai:thinking', testRunId, content });
          },
          onToolCall: (command) => {
            this.broadcast(testRunId, { type: 'ai:tool_call', testRunId, command });
          },
          onStatus: (status) => {
            this.broadcast(testRunId, { type: 'ai:status', testRunId, status });
          },
        }, { isSetup: true });

        this.runningTests.set(testRunId, { agent: setupAgent, cancelled: false });

        const setupResult = await setupAgent.run(setup);

        if (setupResult.status === 'failed') {
          throw new Error(`Setup failed: ${setupResult.summary}`);
        }

        // Save auth state for future reuse
        if (domain) {
          const context = browserManager.getContext(testRunId);
          if (context) {
            await authStateManager.saveState(domain, context);
          }
        }

        this.broadcast(testRunId, {
          type: 'ai:status',
          testRunId,
          status: '셋업 완료. 본 테스트 시작...',
        });
      }

      this.broadcast(testRunId, {
        type: 'ai:status',
        testRunId,
        status: '브라우저 준비 완료. AI 에이전트 연결 중...',
      });

      // Create main AI agent
      agent = new AIAgent(testRunId, {
        onThinking: (content) => {
          this.broadcast(testRunId, { type: 'ai:thinking', testRunId, content });
        },
        onToolCall: (command) => {
          this.broadcast(testRunId, { type: 'ai:tool_call', testRunId, command });
        },
        onStatus: (status) => {
          this.broadcast(testRunId, { type: 'ai:status', testRunId, status });
        },
      }, structuredRequest ? { structuredRequest } : undefined);

      this.runningTests.set(testRunId, { agent, cancelled: false });

      // Run AI agent — for structured mode, use scenario as prompt
      const agentPrompt = structuredRequest
        ? `테스트 실행: ${structuredRequest.scenario}\n대상: ${structuredRequest.targetUrl}`
        : prompt;
      const result = await agent.run(agentPrompt);

      const durationMs = Date.now() - startTime;
      const status = result.status; // 'passed' | 'warning' | 'failed'

      await db.update(schema.testRuns)
        .set({
          status,
          summary: result.summary,
          completedAt: new Date().toISOString(),
          durationMs,
        })
        .where(eq(schema.testRuns.id, testRunId));

      this.broadcast(testRunId, {
        type: 'test:completed',
        testRunId,
        status,
        summary: result.summary,
      });

      // If test failed with cached auth, invalidate the cache (might be expired)
      if (result.status === 'failed' && cachedState && domain) {
        authStateManager.invalidateState(domain);
        logger.info({ domain, testRunId }, 'Invalidated auth state after test failure');
      }

      // Send email notification
      sendTestResultEmail({
        testRunId,
        prompt,
        status,
        summary: result.summary,
        durationMs,
        stepsCount: agent.stepCount,
      }).catch(() => {});

    } catch (err: any) {
      logger.error({ err, testRunId }, 'Test execution failed');

      const running = this.runningTests.get(testRunId);
      const status = running?.cancelled ? 'cancelled' : 'failed';

      await db.update(schema.testRuns)
        .set({
          status,
          summary: err.message,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        })
        .where(eq(schema.testRuns.id, testRunId));

      this.broadcast(testRunId, {
        type: 'test:completed',
        testRunId,
        status,
        summary: err.message,
      });

      // Send email notification
      sendTestResultEmail({
        testRunId,
        prompt,
        status,
        summary: err.message,
        durationMs: Date.now() - startTime,
        stepsCount: agent?.stepCount ?? 0,
      }).catch(() => {});
    } finally {
      await browserManager.closeSession(testRunId);
      this.runningTests.delete(testRunId);
    }
  }

  async startFromWs(
    sessionId: string,
    prompt: string,
    options?: Record<string, unknown>,
    structuredRequest?: StructuredTestRequest,
  ): Promise<string> {
    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(schema.testRuns).values({
      id,
      prompt: structuredRequest ? structuredRequest.scenario : prompt,
      setup: structuredRequest?.setup ?? (options?.setup as string) ?? null,
      scenario: structuredRequest?.scenario ?? null,
      requestPayload: structuredRequest ? JSON.stringify(structuredRequest) : null,
      status: 'pending',
      startedAt: now,
    });

    sessionStore.setTestRunId(sessionId, id);

    // Start in background
    this.runTest(id, prompt, options, structuredRequest).catch(() => {});

    return id;
  }

  async cancelTest(testRunId: string): Promise<void> {
    const running = this.runningTests.get(testRunId);
    if (running) {
      running.cancelled = true;
      running.agent.cancel();
    }
  }

  private broadcast(testRunId: string, message: ServerMessage): void {
    sessionStore.sendToTestRun(testRunId, message);
  }

  /** Extract domain from prompt, setup, or targetUrl */
  private extractDomainFromPrompt(prompt: string, setup: string | null, targetUrl?: string): string | null {
    if (targetUrl) {
      const d = extractDomain(targetUrl);
      if (d) return d;
    }
    if (setup) {
      const d = extractDomain(setup);
      if (d) return d;
    }
    return extractDomain(prompt);
  }
}

export const testOrchestrator = new TestOrchestrator();
