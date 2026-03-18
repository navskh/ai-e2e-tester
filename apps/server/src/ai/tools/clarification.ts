import { nanoid } from 'nanoid';
import type { Page } from 'playwright';
import type { ToolDefinition } from './index.js';

export const clarificationTools: ToolDefinition[] = [
  {
    name: 'ask_user_question',
    description: 'Ask the user a clarification question when you need more information to proceed (e.g., login credentials, which option to choose, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: { type: 'string', description: 'The question to ask the user' },
      },
      required: ['question'],
    },
    execute: async (
      input: Record<string, unknown>,
      _page: Page,
      context?: { testRunId: string; stepIndex: number; onClarification?: (questionId: string, question: string) => Promise<string> }
    ) => {
      const { question } = input as { question: string };

      if (!context?.onClarification) {
        return { error: 'Clarification not available (no WebSocket session)' };
      }

      const questionId = nanoid();
      const answer = await context.onClarification(questionId, question);

      return { question, answer };
    },
  },
];
