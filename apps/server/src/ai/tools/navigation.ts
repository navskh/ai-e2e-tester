import type { Page } from 'playwright';
import type { ToolDefinition } from './index.js';

export const navigationTools: ToolDefinition[] = [
  {
    name: 'navigate',
    description: 'Navigate to a URL in the browser',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
      },
      required: ['url'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { url } = input as { url: string };
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { success: true, url: page.url(), title: await page.title() };
    },
  },
  {
    name: 'go_back',
    description: 'Go back to the previous page',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
    execute: async (_input: Record<string, unknown>, page: Page) => {
      await page.goBack({ waitUntil: 'domcontentloaded' });
      return { success: true, url: page.url() };
    },
  },
  {
    name: 'reload',
    description: 'Reload the current page',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
    execute: async (_input: Record<string, unknown>, page: Page) => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      return { success: true, url: page.url() };
    },
  },
];
