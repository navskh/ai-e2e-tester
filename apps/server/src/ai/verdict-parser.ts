export interface VerdictWarning {
  step?: number;
  message: string;
}

export interface Verdict {
  verdict: 'pass' | 'warning' | 'fail';
  reason: string;
  warnings: VerdictWarning[];
}

/**
 * Parse a structured TEST_VERDICT from AI output text.
 * Supports PASS, WARNING, FAIL.
 *
 * Expected format:
 *   TEST_VERDICT: PASS
 *   REASON: some explanation
 *
 *   TEST_VERDICT: WARNING
 *   REASON: core works but minor issues
 *   WARNINGS:
 *   - Step 8: icon not displayed
 *   - Step 12: text slightly different
 */
export function parseVerdict(text: string): Verdict | null {
  const match = text.match(/TEST_VERDICT:\s*(PASS|WARNING|FAIL)/i);
  if (!match) return null;

  const verdict = match[1]!.toLowerCase() as 'pass' | 'warning' | 'fail';

  const reasonMatch = text.match(/REASON:\s*(.+)/i);
  const reason = reasonMatch?.[1]?.trim() ?? '';

  // Parse WARNINGS section
  const warnings: VerdictWarning[] = [];
  const warningsSection = text.match(/WARNINGS:\s*\n([\s\S]*?)(?:\n\n|$)/i);
  if (warningsSection) {
    const lines = warningsSection[1]!.split('\n');
    for (const line of lines) {
      const warnMatch = line.match(/^-\s*(?:Step\s+(\d+):\s*)?(.+)/i);
      if (warnMatch) {
        warnings.push({
          step: warnMatch[1] ? parseInt(warnMatch[1], 10) : undefined,
          message: warnMatch[2]!.trim(),
        });
      }
    }
  }

  return { verdict, reason, warnings };
}
