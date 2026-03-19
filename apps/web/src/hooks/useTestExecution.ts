import { useCallback } from 'react';
import type { ServerMessage, Action, Assertion } from '@ai-e2e/shared';
import { useTestSession } from '../stores/test-session';
import { useWebSocket } from './useWebSocket';

export function useTestExecution() {
  const store = useTestSession();

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'test:started':
        // Already set by startTest action
        break;
      case 'step:started':
        store.addStep(message.step);
        break;
      case 'step:completed':
        store.updateStep(message.step);
        break;
      case 'step:failed':
        store.updateStep(message.step);
        break;
      case 'screenshot:captured':
        store.addScreenshot(message.stepIndex, message.url);
        break;
      case 'ai:thinking':
        store.addThinking(message.content);
        break;
      case 'ai:tool_call':
        store.addToolCall((message as any).command);
        break;
      case 'ai:status':
        store.setStatus((message as any).status);
        break;
      case 'ai:clarification':
        store.setClarification({
          questionId: message.questionId,
          question: message.question,
        });
        break;
      case 'test:completed':
        store.completeTest(message.status, message.summary);
        break;
      case 'error':
        store.completeTest('failed', message.message);
        break;
    }
  }, [store]);

  const { connected, send } = useWebSocket({ onMessage: handleMessage });

  const startTest = useCallback((prompt: string, options?: Record<string, unknown>) => {
    send({ type: 'test:start', prompt, options });
    store.startTest('pending', prompt);
  }, [send, store]);

  const startStructuredTest = useCallback((data: {
    targetUrl: string;
    scenario: string;
    setup?: string;
    actions?: Action[];
    assertions: Assertion[];
  }) => {
    send({
      type: 'test:start:structured',
      targetUrl: data.targetUrl,
      scenario: data.scenario,
      setup: data.setup,
      actions: data.actions,
      assertions: data.assertions,
    });
    store.startTest('pending', `[구조화] ${data.scenario}`);
  }, [send, store]);

  const cancelTest = useCallback((testRunId: string) => {
    send({ type: 'test:cancel', testRunId });
  }, [send]);

  const answerClarification = useCallback((testRunId: string, questionId: string, answer: string) => {
    send({ type: 'clarification:response', testRunId, questionId, answer });
    store.setClarification(null);
    store.addConversation('user', answer);
  }, [send, store]);

  return {
    // Connection
    connected,
    // Actions (override store's raw actions with WebSocket-aware versions)
    startTest,
    startStructuredTest,
    cancelTest,
    answerClarification,
    reset: store.reset,
    // State
    testRunId: store.testRunId,
    prompt: store.prompt,
    phase: store.phase,
    status: store.status,
    summary: store.summary,
    steps: store.steps,
    activityLog: store.activityLog,
    currentStatus: store.currentStatus,
    pendingClarification: store.pendingClarification,
    screenshots: store.screenshots,
    conversations: store.conversations,
  };
}
