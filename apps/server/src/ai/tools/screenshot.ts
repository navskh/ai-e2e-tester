import type { Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../../config.js';
import type { ToolDefinition } from './index.js';

export const screenshotTools: ToolDefinition[] = [
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of the current page for visual verification',
    input_schema: {
      type: 'object' as const,
      properties: {
        fullPage: { type: 'boolean', description: 'Whether to capture the full page (default: false)' },
      },
    },
    execute: async (input: Record<string, unknown>, page: Page, context?: { testRunId: string; stepIndex: number; onScreenshot?: (stepIndex: number, url: string) => void }) => {
      const { fullPage = false } = input as { fullPage?: boolean };

      mkdirSync(config.screenshotsDir, { recursive: true });

      const filename = `${context?.testRunId ?? 'unknown'}_step${context?.stepIndex ?? 0}_${Date.now()}.png`;
      const filepath = join(config.screenshotsDir, filename);

      await page.screenshot({ path: filepath, fullPage });

      const url = `/api/screenshots/${filename}`;

      if (context?.onScreenshot) {
        context.onScreenshot(context.stepIndex, url);
      }

      return { success: true, screenshotUrl: url, filename };
    },
  },
];
