import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { TestRun as TestRunType } from '@ai-e2e/shared';
import { StepLog } from '../components/test-execution/StepLog';
import { ScreenshotViewer } from '../components/test-execution/ScreenshotViewer';
import { Markdown } from '../components/common/Markdown';

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  paused: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  passed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  cancelled: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

export function TestRun() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestRunType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tests/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setTest(res.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="p-6">
        <p className="text-gray-400">테스트를 찾을 수 없습니다</p>
        <Link to="/history" className="text-primary-400 hover:underline text-sm mt-2 inline-block">
          이력으로 돌아가기
        </Link>
      </div>
    );
  }

  const cfg = statusConfig[test.status] ?? statusConfig.pending;
  const StatusIcon = cfg.icon;

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <Link to="/history" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-3">
          <ArrowLeft size={14} /> 이력으로 돌아가기
        </Link>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${cfg.bg}`}>
            <StatusIcon size={20} className={`${cfg.color} ${test.status === 'running' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{test.prompt}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span>시작: {new Date(test.startedAt).toLocaleString('ko-KR')}</span>
              {test.durationMs && <span>소요: {(test.durationMs / 1000).toFixed(1)}초</span>}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {test.summary && (
            <div className="p-4 rounded-lg bg-gray-900 border border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-2">요약</h3>
              <Markdown>{test.summary}</Markdown>
            </div>
          )}
          <StepLog steps={test.steps.map(s => ({
            stepIndex: s.stepIndex,
            tool: s.tool,
            input: s.input,
            result: s.result,
            status: s.status,
            screenshotUrl: s.screenshotPath ? `/api/screenshots/${s.screenshotPath}` : undefined,
          }))} />
        </div>
        <div>
          <ScreenshotViewer screenshots={test.steps
            .filter(s => s.screenshotPath)
            .map(s => ({
              stepIndex: s.stepIndex,
              url: `/api/screenshots/${s.screenshotPath}`,
            }))} />
        </div>
      </div>
    </div>
  );
}
