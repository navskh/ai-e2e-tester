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

/**
 * Parsed assertion result from structured test output.
 */
export interface ParsedAssertionResult {
  id: string;
  status: 'passed' | 'failed';
  detail: string;
}

/**
 * Parse per-assertion results from structured test AI output.
 *
 * Expected format (repeating):
 *   ASSERTION_RESULT: A1 PASS
 *   DETAIL: 설명
 *
 *   ASSERTION_RESULT: A2 FAIL
 *   DETAIL: 실패 근거
 *
 *   TEST_COMPLETE
 */
export function parseAssertionResults(text: string): ParsedAssertionResult[] {
  const results: ParsedAssertionResult[] = [];

  // Primary pattern: ASSERTION_RESULT + DETAIL on next line (flexible whitespace/newlines)
  const pattern = /ASSERTION_RESULT:\s*(\S+)\s+(PASS|FAIL)\s*[\n\r]+\s*DETAIL:\s*(.+)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    results.push({
      id: match[1]!,
      status: match[2]!.toUpperCase() === 'PASS' ? 'passed' : 'failed',
      detail: match[3]!.trim(),
    });
  }

  // Fallback: DETAIL missing or single-line format
  if (results.length === 0) {
    const fallbackPattern = /ASSERTION_RESULT:\s*(\S+)\s+(PASS|FAIL)(?:\s*[-:]\s*(.+))?/gi;
    while ((match = fallbackPattern.exec(text)) !== null) {
      results.push({
        id: match[1]!,
        status: match[2]!.toUpperCase() === 'PASS' ? 'passed' : 'failed',
        detail: match[3]?.trim() ?? '',
      });
    }
  }

  return results;
}

/**
 * Check if the structured test output contains the TEST_COMPLETE marker.
 */
export function hasTestComplete(text: string): boolean {
  return /TEST_COMPLETE/i.test(text);
}
