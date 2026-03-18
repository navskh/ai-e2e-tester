import { useTestExecution } from '../../hooks/useTestExecution';
import { StepLog } from './StepLog';
import { ScreenshotViewer } from './ScreenshotViewer';
import { ActivityFeed } from './ActivityFeed';
import { ConversationPanel } from '../test-input/ConversationPanel';
import { Markdown } from '../common/Markdown';
import { CheckCircle2, XCircle, Loader2, StopCircle } from 'lucide-react';

export function LiveView() {
  const {
    testRunId,
    prompt,
    phase,
    status,
    summary,
    steps,
    screenshots,
    conversations,
    pendingClarification,
    activityLog,
    currentStatus,
    cancelTest,
    answerClarification,
    reset,
  } = useTestExecution();

  return (
    <div className="space-y-4">
      {/* 상태 바 */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-gray-900 border border-gray-800">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {phase === 'running' && <Loader2 size={20} className="animate-spin text-blue-400 flex-shrink-0" />}
          {phase === 'clarification' && <Loader2 size={20} className="text-yellow-400 flex-shrink-0" />}
          {phase === 'completed' && status === 'passed' && <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />}
          {phase === 'completed' && status !== 'passed' && <XCircle size={20} className="text-red-400 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{prompt}</p>
            <p className="text-xs text-gray-400 truncate">
              {currentStatus || (phase === 'clarification' ? '답변을 기다리는 중...' :
               phase === 'running' ? '실행 중...' :
               phase === 'completed' ? '완료' : phase)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 ml-3">
          {(phase === 'running' || phase === 'clarification') && testRunId && (
            <button
              onClick={() => cancelTest(testRunId)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30"
            >
              <StopCircle size={14} /> 취소
            </button>
          )}
          {phase === 'completed' && (
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-lg text-sm bg-primary-600 hover:bg-primary-500"
            >
              새 테스트
            </button>
          )}
        </div>
      </div>

      {/* 추가 질문 패널 - 눈에 띄게 */}
      {pendingClarification && (
        <div className="p-4 rounded-lg border-2 border-yellow-500/50 bg-yellow-900/10 animate-pulse-slow">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-yellow-400 text-lg">?</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-300 mb-1">AI가 질문합니다</p>
              <p className="text-sm text-gray-300">{pendingClarification.question}</p>
              <ConversationPanel
                conversations={[]}
                pendingQuestion={pendingClarification}
                onAnswer={(answer) => {
                  if (testRunId && pendingClarification) {
                    answerClarification(testRunId, pendingClarification.questionId, answer);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 요약 */}
      {summary && (
        <div className={`p-4 rounded-lg border ${
          status === 'passed'
            ? 'bg-green-900/10 border-green-800/30'
            : 'bg-red-900/10 border-red-800/30'
        }`}>
          <h3 className="text-sm font-medium mb-1">
            {status === 'passed' ? '테스트 통과' : '테스트 실패'}
          </h3>
          <Markdown>{summary}</Markdown>
        </div>
      )}

      {/* 메인 콘텐츠 - 3컬럼 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 실시간 활동 로그 (왼쪽) */}
        <div className="lg:col-span-4">
          <ActivityFeed entries={activityLog} phase={phase} />
        </div>

        {/* 실행 단계 (가운데) */}
        <div className="lg:col-span-4">
          <StepLog steps={steps} />
        </div>

        {/* 스크린샷 (오른쪽) */}
        <div className="lg:col-span-4 space-y-4">
          {screenshots.length > 0 && (
            <ScreenshotViewer screenshots={screenshots} />
          )}

          {conversations.length > 0 && !pendingClarification && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 max-h-60 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-400">
                AI 대화
              </div>
              <ConversationPanel
                conversations={conversations}
                pendingQuestion={null}
                onAnswer={() => {}}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
