import type { TestRun } from '@ai-e2e/shared';
import { StepLog } from '../test-execution/StepLog';
import { ScreenshotViewer } from '../test-execution/ScreenshotViewer';
import { Markdown } from '../common/Markdown';

interface Props {
  test: TestRun;
}

export function ResultDetail({ test }: Props) {
  const steps = test.steps.map((s) => ({
    stepIndex: s.stepIndex,
    tool: s.tool,
    input: s.input,
    result: s.result,
    status: s.status,
    screenshotUrl: s.screenshotPath ? `/api/screenshots/${s.screenshotPath}` : undefined,
  }));

  const screenshots = test.steps
    .filter((s) => s.screenshotPath)
    .map((s) => ({
      stepIndex: s.stepIndex,
      url: `/api/screenshots/${s.screenshotPath}`,
    }));

  return (
    <div className="space-y-6">
      {test.summary && (
        <div className="p-4 rounded-lg bg-gray-900 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-2">요약</h3>
          <Markdown>{test.summary}</Markdown>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StepLog steps={steps} />
        <ScreenshotViewer screenshots={screenshots} />
      </div>

      {test.conversations && test.conversations.length > 0 && (
        <div className="p-4 rounded-lg bg-gray-900 border border-gray-800 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">대화 기록</h3>
          {test.conversations.map((c, i) => (
            <div key={i} className="text-sm">
              <span className={`text-xs font-medium ${c.role === 'user' ? 'text-green-400' : 'text-primary-400'}`}>
                {c.role === 'user' ? '사용자' : 'AI'}:
              </span>
              <p className="text-gray-400 mt-0.5">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
