import type { Page } from 'playwright';
import type { ToolDefinition } from './index.js';
import { buildPageContext } from '../context-builder.js';

export const extractionTools: ToolDefinition[] = [
  {
    name: 'get_page_snapshot',
    description: 'Get the accessibility tree snapshot of the current page. Use this to understand the page structure before interacting.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
    execute: async (_input: Record<string, unknown>, page: Page) => {
      const snapshot = await buildPageContext(page);
      return { url: page.url(), title: await page.title(), snapshot };
    },
  },
  {
    name: 'get_text',
    description: 'Get the text content of an element',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the element' },
      },
      required: ['selector'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector } = input as { selector: string };
      const text = await page.locator(selector).textContent({ timeout: 5000 });
      return { selector, text: text?.trim() ?? '' };
    },
  },
  {
    name: 'get_attribute',
    description: 'Get an attribute value of an element',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the element' },
        attribute: { type: 'string', description: 'Attribute name (e.g., href, src, class)' },
      },
      required: ['selector', 'attribute'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, attribute } = input as { selector: string; attribute: string };
      const value = await page.locator(selector).getAttribute(attribute, { timeout: 5000 });
      return { selector, attribute, value };
    },
  },
  {
    name: 'get_input_value',
    description: 'Get the current value of an input field',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the input' },
      },
      required: ['selector'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector } = input as { selector: string };
      const value = await page.locator(selector).inputValue({ timeout: 5000 });
      return { selector, value };
    },
  },
];
