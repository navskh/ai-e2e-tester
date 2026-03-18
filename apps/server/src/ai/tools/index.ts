import type { Page } from 'playwright';
import type { TestStep } from '@ai-e2e/shared';
import { navigationTools } from './navigation.js';
import { interactionTools } from './interaction.js';
import { assertionTools } from './assertion.js';
import { extractionTools } from './extraction.js';
import { screenshotTools } from './screenshot.js';
import { waitingTools } from './waiting.js';
import { clarificationTools } from './clarification.js';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    input: Record<string, unknown>,
    page: Page,
    context?: {
      testRunId: string;
      stepIndex: number;
      onScreenshot?: (stepIndex: number, url: string) => void;
      onClarification?: (questionId: string, question: string) => Promise<string>;
    }
  ) => Promise<Record<string, unknown>>;
}

const allTools: ToolDefinition[] = [
  ...navigationTools,
  ...interactionTools,
  ...assertionTools,
  ...extractionTools,
  ...screenshotTools,
  ...waitingTools,
  ...clarificationTools,
];

const toolMap = new Map<string, ToolDefinition>(
  allTools.map(t => [t.name, t])
);

export function getToolDefinitions() {
  return allTools.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));
}

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  page: Page,
  testRunId: string,
  stepIndex: number,
  callbacks: {
    onScreenshot?: (stepIndex: number, url: string) => void;
    onClarification?: (questionId: string, question: string) => Promise<string>;
  }
): Promise<Record<string, unknown>> {
  const tool = toolMap.get(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return tool.execute(input, page, {
    testRunId,
    stepIndex,
    onScreenshot: callbacks.onScreenshot,
    onClarification: callbacks.onClarification,
  });
}
