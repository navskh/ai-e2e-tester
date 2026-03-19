import type { TestStep, TestStatus, AssertionResult, Action, Assertion, TestOptions } from './test-run.js';

// Server → Client messages
export type ServerMessage =
  | { type: 'test:started'; testRunId: string }
  | { type: 'step:started'; testRunId: string; step: Pick<TestStep, 'stepIndex' | 'tool' | 'input'> }
  | { type: 'step:completed'; testRunId: string; step: Pick<TestStep, 'stepIndex' | 'tool' | 'result' | 'status'> }
  | { type: 'step:failed'; testRunId: string; step: Pick<TestStep, 'stepIndex' | 'tool' | 'result' | 'status'> }
  | { type: 'screenshot:captured'; testRunId: string; stepIndex: number; url: string }
  | { type: 'ai:thinking'; testRunId: string; content: string }
  | { type: 'ai:tool_call'; testRunId: string; command: string }
  | { type: 'ai:status'; testRunId: string; status: string }
  | { type: 'ai:clarification'; testRunId: string; questionId: string; question: string }
  | { type: 'assertion:result'; testRunId: string; result: AssertionResult }
  | { type: 'test:completed'; testRunId: string; status: TestStatus; summary: string | null }
  | { type: 'error'; message: string };

// Client → Server messages
export type ClientMessage =
  | { type: 'test:start'; prompt: string; setup?: string; options?: { targetUrl?: string; browserType?: string; headless?: boolean; timeout?: number; reuseAuth?: boolean } }
  | { type: 'test:start:structured'; targetUrl: string; scenario: string; setup?: string; actions?: Action[]; assertions: Assertion[]; options?: TestOptions }
  | { type: 'test:cancel'; testRunId: string }
  | { type: 'clarification:response'; testRunId: string; questionId: string; answer: string };
