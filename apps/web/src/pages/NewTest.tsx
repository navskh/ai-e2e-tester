import { PromptInput } from '../components/test-input/PromptInput';
import { QuickActions } from '../components/test-input/QuickActions';
import { LiveView } from '../components/test-execution/LiveView';
import { useTestExecution } from '../hooks/useTestExecution';

export function NewTest() {
  const { phase, connected, startTest } = useTestExecution();

  const handleSubmit = (prompt: string) => {
    startTest(prompt);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">새 테스트</h2>
            <p className="text-sm text-gray-400 mt-1">
              테스트할 내용을 자연어로 설명해주세요
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-xs text-gray-400">
              {connected ? '연결됨' : '연결 끊김'}
            </span>
          </div>
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-6">
        {phase === 'idle' ? (
          <div className="max-w-2xl mx-auto space-y-8">
            <PromptInput onSubmit={handleSubmit} disabled={!connected} />
            <QuickActions onSelect={handleSubmit} />
          </div>
        ) : (
          <LiveView />
        )}
      </div>
    </div>
  );
}
