import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface StepInfo {
  stepIndex: number;
  tool: string;
  input: Record<string, unknown>;
  result?: string | null;
  status: string;
  screenshotUrl?: string;
}

interface Props {
  steps: StepInfo[];
}

const toolLabels: Record<string, string> = {
  navigate: '페이지 이동',
  go_back: '뒤로 가기',
  reload: '새로고침',
  click: '클릭',
  type_text: '입력',
  select_option: '선택',
  hover: '호버',
  press_key: '키 입력',
  assert_visible: '표시 확인',
  assert_text: '텍스트 확인',
  assert_url: 'URL 확인',
  snapshot: '페이지 분석',
  get_text: '텍스트 추출',
  get_attribute: '속성 추출',
  screenshot: '스크린샷',
  wait_for_element: '요소 대기',
  wait: '대기',
  ask_user: '질문',
  inspect: '요소 검사',
  get_computed_style: 'CSS 조회',
  get_bounding_box: '위치 조회',
  console_messages: '콘솔 조회',
  network_requests: '네트워크 조회',
};

const statusIcons: Record<string, { icon: React.ElementType; color: string }> = {
  running: { icon: Loader2, color: 'text-blue-400' },
  passed: { icon: CheckCircle2, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  skipped: { icon: ChevronRight, color: 'text-gray-500' },
};

function StepItem({ step }: { step: StepInfo }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusIcons[step.status] ?? statusIcons.running;
  const Icon = cfg.icon;
  const label = toolLabels[step.tool] ?? step.tool;

  // Extract description from input
  const { _description, ...cleanInput } = step.input as any;

  return (
    <div className={`border rounded-lg overflow-hidden animate-fade-in ${
      step.status === 'failed' ? 'border-red-800/50' : 'border-gray-800'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors"
      >
        <Icon
          size={16}
          className={`${cfg.color} flex-shrink-0 ${step.status === 'running' ? 'animate-spin' : ''}`}
        />
        <span className="text-xs font-mono text-gray-500">#{step.stepIndex}</span>
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <span className="text-xs text-gray-500 truncate flex-1">
          {formatInputShort(step.tool, cleanInput)}
        </span>
        {expanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-gray-800 bg-gray-950/50 space-y-2">
          <div>
            <span className="text-xs text-gray-500 block mb-1">입력</span>
            <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-auto max-h-32">
              {JSON.stringify(cleanInput, null, 2)}
            </pre>
          </div>
          {step.result && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">결과</span>
              <pre className={`text-xs rounded p-2 overflow-auto max-h-32 ${
                step.status === 'failed' ? 'text-red-300 bg-red-950/30' : 'text-gray-400 bg-gray-900'
              }`}>
                {formatResult(step.result)}
              </pre>
            </div>
          )}
          {step.screenshotUrl && (
            <div>
              <span className="text-xs text-gray-500 block mb-1">스크린샷</span>
              <img
                src={step.screenshotUrl}
                alt={`${step.stepIndex}단계`}
                className="rounded border border-gray-800 max-h-48 w-auto"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatInputShort(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'navigate': return String(input.url ?? '');
    case 'click': return String(input.ref !== undefined ? `ref=${input.ref}` : input.selector ?? '');
    case 'type_text': return `"${input.text}" → ${input.ref !== undefined ? `ref=${input.ref}` : input.selector}`;
    case 'assert_text': return `"${input.expected}"`;
    case 'assert_visible': return String(input.ref !== undefined ? `ref=${input.ref}` : input.selector ?? '');
    case 'assert_url': return String(input.expected ?? '');
    case 'wait_for_element': return String(input.ref !== undefined ? `ref=${input.ref}` : input.selector ?? '');
    case 'inspect': return String(input.ref !== undefined ? `ref=${input.ref}` : input.selector ?? '');
    case 'get_computed_style': return String(input.ref !== undefined ? `ref=${input.ref}` : input.selector ?? '');
    case 'get_bounding_box': return String(input.ref !== undefined ? `ref=${input.ref}` : input.selector ?? '');
    case 'console_messages': return String(input.level ?? 'all');
    case 'network_requests': return String(input.urlPattern || input.statusFilter || 'all');
    case 'press_key': return String(input.key ?? '');
    case 'ask_user': return String(input.question ?? '');
    default: {
      const parts = Object.entries(input)
        .slice(0, 2)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
      return parts.join(', ');
    }
  }
}

function formatResult(result: string): string {
  try {
    return JSON.stringify(JSON.parse(result), null, 2);
  } catch {
    return result;
  }
}

export function StepLog({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 h-[500px] flex items-center justify-center">
        <div className="text-center text-gray-600 text-sm">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-gray-700" />
          <p>AI가 테스트 단계를</p>
          <p>실행할 때까지 대기 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-300">
        실행 단계 ({steps.length})
      </h3>
      <div className="space-y-1 max-h-[460px] overflow-y-auto pr-1">
        {steps.map((step) => (
          <StepItem key={step.stepIndex} step={step} />
        ))}
      </div>
    </div>
  );
}
