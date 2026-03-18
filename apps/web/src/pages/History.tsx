import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { TestRun } from '@ai-e2e/shared';
import { HistoryTable } from '../components/test-history/HistoryTable';

export function HistoryPage() {
  const [tests, setTests] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchTests = () => {
    setLoading(true);
    fetch(`/api/tests?page=${page}&pageSize=${pageSize}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setTests(res.data.items);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchTests, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 테스트를 삭제하시겠습니까?')) return;
    await fetch(`/api/tests/${id}`, { method: 'DELETE' });
    fetchTests();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <h2 className="text-xl font-semibold">테스트 이력</h2>
        <p className="text-sm text-gray-400 mt-1">
          총 {total}건의 테스트 기록
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary-500" size={32} />
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">아직 테스트 기록이 없습니다.</p>
            <Link to="/" className="text-primary-400 hover:underline text-sm mt-2 inline-block">
              첫 테스트 실행하기
            </Link>
          </div>
        ) : (
          <>
            <HistoryTable tests={tests} onDelete={handleDelete} />
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-1 text-sm text-gray-400">
                  {page} / {totalPages} 페이지
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
