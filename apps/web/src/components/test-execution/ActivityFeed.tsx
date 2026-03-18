import { useEffect, useRef } from 'react';
import {
  Terminal,
  Brain,
  Play,
  Camera,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
import { Markdown } from '../common/Markdown';
import type { ActivityLogEntry } from '../../stores/test-session';
import type { ExecutionPhase } from '../../stores/test-session';

const typeConfig: Record<ActivityLogEntry['type'], {
  icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
}> = {
  status: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', label: '상태' },
  thinking: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'AI 사고' },
  tool_call: { icon: Terminal, color: 'text-amber-400', bg: 'bg-amber-500/10', label: '명령 실행' },
  step: { icon: Play, color: 'text-green-400', bg: 'bg-green-500/10', label: '단계' },
  screenshot: { icon: Camera, color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: '캡처' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: '오류' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncateCommand(cmd: string): string {
  // Show curl commands more readably
  if (cmd.includes('curl')) {
    const match = cmd.match(/"action"\s*:\s*"([^"]+)"/);
    if (match) {
      return `curl → ${match[1]}`;
    }
  }
  if (cmd.length > 120) return cmd.slice(0, 117) + '...';
  return cmd;
}

interface Props {
  entries: ActivityLogEntry[];
  phase: ExecutionPhase;
}

export function ActivityFeed({ entries, phase }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 flex flex-col h-[500px]">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">실시간 로그</span>
        {phase === 'running' && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Loader2 size={10} className="animate-spin" />
            실행 중
          </span>
        )}
        {phase === 'completed' && (
          <span className="text-xs text-gray-500">{entries.length}건</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            <div className="text-center">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-gray-700" />
              <p>대기 중...</p>
            </div>
          </div>
        )}

        {entries.map((entry) => {
          const cfg = typeConfig[entry.type];
          const Icon = cfg.icon;

          return (
            <div
              key={entry.id}
              className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs ${cfg.bg} animate-fade-in`}
            >
              <Icon size={12} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-mono text-[10px]">{formatTime(entry.timestamp)}</span>
                </div>
                {entry.type === 'thinking' ? (
                  <div className="text-gray-300 text-xs leading-relaxed [&_p]:mb-1 [&_p]:text-xs [&_h1]:text-xs [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs [&_code]:text-[10px]">
                    <Markdown>{entry.content}</Markdown>
                  </div>
                ) : (
                  <p className={`${entry.type === 'error' ? 'text-red-300' : 'text-gray-300'} break-words whitespace-pre-wrap leading-relaxed`}>
                    {entry.type === 'tool_call' ? truncateCommand(entry.content) : entry.content}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
