import { useState } from 'react';
import { PromptInput } from '../components/test-input/PromptInput';
import { StructuredInput } from '../components/test-input/StructuredInput';
import { QuickActions } from '../components/test-input/QuickActions';
import { LiveView } from '../components/test-execution/LiveView';
import { useTestExecution } from '../hooks/useTestExecution';

type InputMode = 'free' | 'structured';

export function NewTest() {
  const { phase, connected, startTest, startStructuredTest } = useTestExecution();
  const [mode, setMode] = useState<InputMode>('free');

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
              {mode === 'free' ? '테스트할 내용을 자연어로 설명해주세요' : 'URL, 액션, 검증 항목을 구조화하여 입력하세요'}
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
          <div className="max-w-2xl mx-auto space-y-6">
            {/* 모드 탭 */}
            <div className="flex rounded-lg border border-gray-800 p-0.5 bg-gray-900/50">
              <button
                onClick={() => setMode('free')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'free'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                자유 입력
              </button>
              <button
                onClick={() => setMode('structured')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'structured'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                구조화 입력
              </button>
            </div>

            {/* 입력 폼 */}
            {mode === 'free' ? (
              <>
                <PromptInput onSubmit={handleSubmit} disabled={!connected} />
                <QuickActions onSelect={handleSubmit} />
              </>
            ) : (
              <StructuredInput onSubmit={startStructuredTest} disabled={!connected} />
            )}
          </div>
        ) : (
          <LiveView />
        )}
      </div>
    </div>
  );
}
