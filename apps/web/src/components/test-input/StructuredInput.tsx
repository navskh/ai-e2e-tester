import { useState } from 'react';
import { Send, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { Action, Assertion } from '@ai-e2e/shared';

interface Props {
  onSubmit: (data: {
    targetUrl: string;
    scenario: string;
    setup?: string;
    actions: Action[];
    assertions: Assertion[];
  }) => void;
  disabled?: boolean;
}

const actionTypes: { value: Action['type']; label: string }[] = [
  { value: 'click', label: '클릭' },
  { value: 'input', label: '입력' },
  { value: 'navigate', label: '이동' },
  { value: 'select_option', label: '선택' },
  { value: 'hover', label: '호버' },
  { value: 'press_key', label: '키 입력' },
  { value: 'scroll', label: '스크롤' },
  { value: 'wait', label: '대기' },
];

const severityOptions: { value: Assertion['severity']; label: string; color: string }[] = [
  { value: 'critical', label: '필수', color: 'text-red-400' },
  { value: 'major', label: '중요', color: 'text-yellow-400' },
  { value: 'minor', label: '경미', color: 'text-gray-400' },
];

let idCounter = 0;

export function StructuredInput({ onSubmit, disabled }: Props) {
  const [targetUrl, setTargetUrl] = useState('');
  const [scenario, setScenario] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [setup, setSetup] = useState('');
  const [actions, setActions] = useState<(Action & { _key: number })[]>([]);
  const [assertions, setAssertions] = useState<(Assertion & { _key: number })[]>([]);

  const addAction = () => {
    setActions(prev => [...prev, { _key: ++idCounter, type: 'click', target: '', value: '' }]);
  };

  const updateAction = (key: number, update: Partial<Action>) => {
    setActions(prev => prev.map(a => a._key === key ? { ...a, ...update } : a));
  };

  const removeAction = (key: number) => {
    setActions(prev => prev.filter(a => a._key !== key));
  };

  const addAssertion = () => {
    const nextId = `A${assertions.length + 1}`;
    setAssertions(prev => [...prev, { _key: ++idCounter, id: nextId, check: '', severity: 'critical' }]);
  };

  const updateAssertion = (key: number, update: Partial<Assertion>) => {
    setAssertions(prev => prev.map(a => a._key === key ? { ...a, ...update } : a));
  };

  const removeAssertion = (key: number) => {
    setAssertions(prev => prev.filter(a => a._key !== key));
  };

  const canSubmit = targetUrl.trim() && scenario.trim() && assertions.length > 0
    && assertions.every(a => a.check.trim());

  const handleSubmit = () => {
    if (!canSubmit || disabled) return;
    const cleanActions = actions
      .filter(a => a.target?.trim() || a.value?.trim())
      .map(({ _key, ...rest }) => rest);
    const cleanAssertions = assertions.map(({ _key, ...rest }) => rest);
    onSubmit({
      targetUrl: targetUrl.trim(),
      scenario: scenario.trim(),
      setup: setup.trim() || undefined,
      actions: cleanActions.length > 0 ? cleanActions : [],
      assertions: cleanAssertions,
    });
  };

  return (
    <div className="space-y-5">
      {/* 기본 정보 */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-300 block mb-1.5">대상 URL *</label>
          <input
            type="url"
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-300 block mb-1.5">테스트 시나리오 *</label>
          <input
            type="text"
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            placeholder='예: "로그인 후 대시보드 확인"'
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
            disabled={disabled}
          />
        </div>

        {/* Setup (선택) */}
        <div>
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showSetup ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            사전 작업 (선택)
          </button>
          {showSetup && (
            <textarea
              value={setup}
              onChange={e => setSetup(e.target.value)}
              placeholder='예: "아이디: test@example.com, 비밀번호: test1234로 로그인"'
              rows={2}
              className="mt-2 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 text-sm"
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">
            액션 <span className="text-gray-500 font-normal">(선택)</span>
          </label>
          <button
            onClick={addAction}
            disabled={disabled}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-gray-700 text-gray-400 hover:border-primary-600/50 hover:text-primary-400 disabled:opacity-50 transition-colors"
          >
            <Plus size={12} /> 추가
          </button>
        </div>
        {actions.length > 0 && (
          <div className="space-y-1.5 p-3 rounded-lg border border-gray-800 bg-gray-900/50">
            {actions.map((action, idx) => (
              <div key={action._key} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-5 text-right flex-shrink-0">{idx + 1}</span>
                <select
                  value={action.type}
                  onChange={e => updateAction(action._key, { type: e.target.value as Action['type'] })}
                  className="w-24 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-primary-500 flex-shrink-0"
                  disabled={disabled}
                >
                  {actionTypes.map(at => (
                    <option key={at.value} value={at.value}>{at.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={action.target || ''}
                  onChange={e => updateAction(action._key, { target: e.target.value })}
                  placeholder="대상 (요소/URL)"
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500"
                  disabled={disabled}
                />
                <input
                  type="text"
                  value={action.value || ''}
                  onChange={e => updateAction(action._key, { value: e.target.value })}
                  placeholder="값"
                  className="w-32 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500"
                  disabled={disabled}
                />
                <button
                  onClick={() => removeAction(action._key)}
                  className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 검증 항목 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">
            검증 항목 * <span className="text-gray-500 font-normal">({assertions.length}개)</span>
          </label>
          <button
            onClick={addAssertion}
            disabled={disabled}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-gray-700 text-gray-400 hover:border-primary-600/50 hover:text-primary-400 disabled:opacity-50 transition-colors"
          >
            <Plus size={12} /> 추가
          </button>
        </div>
        {assertions.length > 0 ? (
          <div className="space-y-1.5 p-3 rounded-lg border border-gray-800 bg-gray-900/50">
            {assertions.map(assertion => (
              <div key={assertion._key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={assertion.id}
                  onChange={e => updateAssertion(assertion._key, { id: e.target.value })}
                  className="w-14 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 text-center focus:outline-none focus:border-primary-500 flex-shrink-0"
                  disabled={disabled}
                />
                <input
                  type="text"
                  value={assertion.check}
                  onChange={e => updateAssertion(assertion._key, { check: e.target.value })}
                  placeholder='예: "대시보드 헤딩이 표시되는지 확인"'
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500"
                  disabled={disabled}
                />
                <select
                  value={assertion.severity}
                  onChange={e => updateAssertion(assertion._key, { severity: e.target.value as Assertion['severity'] })}
                  className={`w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-primary-500 flex-shrink-0 ${
                    severityOptions.find(s => s.value === assertion.severity)?.color ?? ''
                  }`}
                  disabled={disabled}
                >
                  {severityOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeAssertion(assertion._key)}
                  className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-dashed border-gray-800 text-center">
            <p className="text-xs text-gray-600">검증 항목을 추가하세요 (최소 1개 필요)</p>
          </div>
        )}
      </div>

      {/* 제출 */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !canSubmit}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:hover:bg-primary-600 transition-colors text-sm font-medium"
      >
        <Send size={16} />
        구조화 테스트 실행
      </button>
    </div>
  );
}
