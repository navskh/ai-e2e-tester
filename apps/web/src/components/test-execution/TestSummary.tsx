import { CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react';
import { Markdown } from '../common/Markdown';

interface AssertionResult {
  id: string;
  status: 'passed' | 'failed';
  severity: 'critical' | 'major' | 'minor';
  detail: string;
}

interface StepStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface WarningInfo {
  step: number;
  message: string;
}

interface FailedAtInfo {
  step: number;
  action: string;
  target: string;
  expected: string;
  actual: string;
  screenshotUrl?: string;
}

interface TestResultDetail {
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  results?: AssertionResult[];
  failedAt: FailedAtInfo | null;
  warnings: WarningInfo[];
  steps: StepStats;
}

interface Props {
  summary: string;
  status: string | null;
}

const severityLabels: Record<string, { text: string; color: string }> = {
  critical: { text: '필수', color: 'text-red-400' },
  major: { text: '중요', color: 'text-yellow-400' },
  minor: { text: '경미', color: 'text-gray-400' },
};

export function TestSummary({ summary, status }: Props) {
  // Try to parse as JSON (structured result)
  let parsed: TestResultDetail | null = null;
  try {
    parsed = JSON.parse(summary);
  } catch {
    // Not JSON — fall back to plain text
  }

  // Fallback: plain text summary
  if (!parsed) {
    return (
      <div className={`p-4 rounded-lg border ${
        status === 'passed'
          ? 'bg-green-900/10 border-green-800/30'
          : status === 'warning'
            ? 'bg-yellow-900/10 border-yellow-800/30'
            : 'bg-red-900/10 border-red-800/30'
      }`}>
        <h3 className="text-sm font-medium mb-1">
          {status === 'passed' ? '테스트 통과' : status === 'warning' ? '경고' : '테스트 실패'}
        </h3>
        <Markdown>{summary}</Markdown>
      </div>
    );
  }

  const isPassed = parsed.status === 'passed';
  const isWarning = parsed.status === 'warning';
  const borderColor = isPassed ? 'border-green-800/30' : isWarning ? 'border-yellow-800/30' : 'border-red-800/30';
  const bgColor = isPassed ? 'bg-green-900/10' : isWarning ? 'bg-yellow-900/10' : 'bg-red-900/10';
  const statusLabel = isPassed ? '테스트 통과' : isWarning ? '경고' : '테스트 실패';
  const StatusIcon = isPassed ? CheckCircle2 : isWarning ? AlertTriangle : XCircle;
  const statusIconColor = isPassed ? 'text-green-400' : isWarning ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      {/* 헤더 */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon size={18} className={statusIconColor} />
          <h3 className="text-sm font-medium">{statusLabel}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Activity size={12} />
            {parsed.steps.total}단계 실행
          </span>
          {parsed.steps.failed > 0 && (
            <span className="text-red-400">{parsed.steps.failed} 실패</span>
          )}
        </div>
      </div>

      {/* 요약 */}
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-300">{parsed.summary}</p>
      </div>

      {/* Assertion 결과 테이블 */}
      {parsed.results && parsed.results.length > 0 && (
        <div className="border-t border-gray-800">
          <div className="px-4 py-2 text-xs font-medium text-gray-500">
            검증 결과 ({parsed.results.filter(r => r.status === 'passed').length}/{parsed.results.length} 통과)
          </div>
          <div className="px-4 pb-3 space-y-1.5">
            {parsed.results.map(result => (
              <div
                key={result.id}
                className={`flex items-start gap-2 p-2 rounded text-sm ${
                  result.status === 'passed' ? 'bg-green-900/20' : 'bg-red-900/20'
                }`}
              >
                {result.status === 'passed' ? (
                  <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{result.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityLabels[result.severity]?.color ?? ''} bg-gray-800`}>
                      {severityLabels[result.severity]?.text ?? result.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{result.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실패 지점 */}
      {parsed.failedAt && (
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="text-xs font-medium text-red-400 mb-1">실패 지점</div>
          <div className="text-xs text-gray-400 space-y-0.5">
            <p>단계 #{parsed.failedAt.step} — {parsed.failedAt.action}</p>
            <p>대상: {parsed.failedAt.target}</p>
            <p>기대: {parsed.failedAt.expected}</p>
            <p>실제: {parsed.failedAt.actual}</p>
          </div>
        </div>
      )}

      {/* 경고 */}
      {parsed.warnings.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="text-xs font-medium text-yellow-400 mb-1">경고</div>
          <ul className="text-xs text-gray-400 space-y-0.5">
            {parsed.warnings.map((w, i) => (
              <li key={i}>• {w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
