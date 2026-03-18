import type { Page } from 'playwright';
import type { ToolDefinition } from './index.js';

export const waitingTools: ToolDefinition[] = [
  {
    name: 'wait_for_element',
    description: 'Wait for an element to appear or reach a certain state',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the element' },
        state: { type: 'string', description: 'State to wait for: "visible", "hidden", "attached", "detached" (default: "visible")' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 10000)' },
      },
      required: ['selector'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, state = 'visible', timeout = 10000 } = input as { selector: string; state?: string; timeout?: number };
      await page.locator(selector).waitFor({ state: state as any, timeout });
      return { success: true, selector, state };
    },
  },
  {
    name: 'wait_for_navigation',
    description: 'Wait for a navigation to complete (useful after clicking a link)',
    input_schema: {
      type: 'object' as const,
      properties: {
        timeout: { type: 'number', description: 'Max wait time in ms (default: 10000)' },
      },
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { timeout = 10000 } = input as { timeout?: number };
      await page.waitForLoadState('domcontentloaded', { timeout });
      return { success: true, url: page.url() };
    },
  },
  {
    name: 'wait',
    description: 'Wait for a specific duration (use sparingly)',
    input_schema: {
      type: 'object' as const,
      properties: {
        ms: { type: 'number', description: 'Duration in milliseconds (max 10000)' },
      },
      required: ['ms'],
    },
    execute: async (input: Record<string, unknown>) => {
      const { ms } = input as { ms: number };
      const duration = Math.min(ms, 10000);
      await new Promise(resolve => setTimeout(resolve, duration));
      return { success: true, waited: duration };
    },
  },
];
