import type { Page } from 'playwright';
import type { ToolDefinition } from './index.js';

export const interactionTools: ToolDefinition[] = [
  {
    name: 'click',
    description: 'Click an element on the page identified by a selector',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'CSS selector, text=, role=, or [data-testid=] selector' },
      },
      required: ['selector'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector } = input as { selector: string };
      await page.locator(selector).click({ timeout: 10000 });
      return { success: true, clicked: selector };
    },
  },
  {
    name: 'type_text',
    description: 'Type text into an input field identified by a selector',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the input field' },
        text: { type: 'string', description: 'Text to type' },
        clear: { type: 'boolean', description: 'Whether to clear the field first (default: true)' },
      },
      required: ['selector', 'text'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, text, clear = true } = input as { selector: string; text: string; clear?: boolean };
      const locator = page.locator(selector);
      if (clear) await locator.fill(text, { timeout: 10000 });
      else await locator.pressSequentially(text, { delay: 50 });
      return { success: true, typed: text, into: selector };
    },
  },
  {
    name: 'select_option',
    description: 'Select an option from a <select> dropdown',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the select element' },
        value: { type: 'string', description: 'Option value or label to select' },
      },
      required: ['selector', 'value'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector, value } = input as { selector: string; value: string };
      await page.locator(selector).selectOption(value, { timeout: 10000 });
      return { success: true, selected: value, in: selector };
    },
  },
  {
    name: 'hover',
    description: 'Hover over an element',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Selector for the element to hover' },
      },
      required: ['selector'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { selector } = input as { selector: string };
      await page.locator(selector).hover({ timeout: 10000 });
      return { success: true, hovered: selector };
    },
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key (e.g., Enter, Tab, Escape)',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Key to press (e.g., Enter, Tab, Escape, ArrowDown)' },
      },
      required: ['key'],
    },
    execute: async (input: Record<string, unknown>, page: Page) => {
      const { key } = input as { key: string };
      await page.keyboard.press(key);
      return { success: true, pressed: key };
    },
  },
];
