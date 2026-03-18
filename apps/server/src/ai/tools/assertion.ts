import type { Page } from 'playwright';
import type { ToolDefinition } from './index.js';

export const assertionTools: ToolDefinition[] = [
  {
    name: 'assert_visible',
    description: 'Assert that an element is visible on the page',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the element' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 5000)' },
      },
      required: ['selector'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, timeout = 5000 } = input as { selector: string; timeout?: number };
      const isVisible = await page.locator(selector).isVisible({ timeout });
      return { success: isVisible, assertion: 'visible', selector, result: isVisible ? 'PASS' : 'FAIL' };
    },
  },
  {
    name: 'assert_text',
    description: 'Assert that an element contains specific text',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the element' },
        expected: { type: 'string', description: 'Expected text content (substring match)' },
        exact: { type: 'boolean', description: 'Whether to match exactly (default: false)' },
      },
      required: ['selector', 'expected'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, expected, exact = false } = input as { selector: string; expected: string; exact?: boolean };
      const actual = await page.locator(selector).textContent({ timeout: 5000 }) ?? '';
      const matches = exact ? actual.trim() === expected : actual.includes(expected);
      return { success: matches, assertion: 'text', selector, expected, actual: actual.trim(), result: matches ? 'PASS' : 'FAIL' };
    },
  },
  {
    name: 'assert_url',
    description: 'Assert that the current URL matches a pattern',
    input_schema: {
      type: 'object' as const,
      properties: {
        expected: { type: 'string', description: 'Expected URL or substring' },
        exact: { type: 'boolean', description: 'Whether to match exactly (default: false)' },
      },
      required: ['expected'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { expected, exact = false } = input as { expected: string; exact?: boolean };
      const actual = page.url();
      const matches = exact ? actual === expected : actual.includes(expected);
      return { success: matches, assertion: 'url', expected, actual, result: matches ? 'PASS' : 'FAIL' };
    },
  },
  {
    name: 'assert_element_count',
    description: 'Assert the number of elements matching a selector',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the elements' },
        expected: { type: 'number', description: 'Expected count' },
      },
      required: ['selector', 'expected'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, expected } = input as { selector: string; expected: number };
      const actual = await page.locator(selector).count();
      const matches = actual === expected;
      return { success: matches, assertion: 'element_count', selector, expected, actual, result: matches ? 'PASS' : 'FAIL' };
    },
  },
];
