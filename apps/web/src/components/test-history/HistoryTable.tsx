import { Link } from 'react-router-dom';
import { Trash2, ExternalLink } from 'lucide-react';
import type { TestRun } from '@ai-e2e/shared';

interface Props {
  tests: TestRun[];
  onDelete: (id: string) => void;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: '대기 중', className: 'bg-yellow-400/10 text-yellow-400' },
  running: { label: '실행 중', className: 'bg-blue-400/10 text-blue-400' },
  paused: { label: '일시정지', className: 'bg-orange-400/10 text-orange-400' },
  passed: { label: '통과', className: 'bg-green-400/10 text-green-400' },
  failed: { label: '실패', className: 'bg-red-400/10 text-red-400' },
  cancelled: { label: '취소됨', className: 'bg-gray-400/10 text-gray-400' },
};

export function HistoryTable({ tests, onDelete }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">테스트 내용</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">시작 시간</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-gray-500 uppercase">소요 시간</th>
            <th className="text-right py-3 px-3 text-xs font-medium text-gray-500 uppercase">관리</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => {
            const badge = statusBadge[test.status] ?? statusBadge.pending;
            return (
              <tr key={test.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <Link
                    to={`/test/${test.id}`}
                    className="text-gray-200 hover:text-primary-400 line-clamp-1"
                  >
                    {test.prompt}
                  </Link>
                </td>
                <td className="py-3 px-3 text-gray-400 whitespace-nowrap">
                  {new Date(test.startedAt).toLocaleString('ko-KR')}
                </td>
                <td className="py-3 px-3 text-gray-400 whitespace-nowrap">
                  {test.durationMs ? `${(test.durationMs / 1000).toFixed(1)}초` : '—'}
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/test/${test.id}`}
                      className="p-1 text-gray-500 hover:text-gray-200"
                    >
                      <ExternalLink size={14} />
                    </Link>
                    <button
                      onClick={() => onDelete(test.id)}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
