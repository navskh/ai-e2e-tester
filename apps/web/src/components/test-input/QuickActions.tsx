import { Zap } from 'lucide-react';

interface Props {
  onSelect: (prompt: string) => void;
}

const templates = [
  {
    label: '페이지 제목 확인',
    prompt: 'https://example.com에 접속해서 페이지 제목이 "Example Domain"인지 확인해줘',
  },
  {
    label: '링크 검증',
    prompt: 'https://example.com에 접속해서 페이지에 있는 모든 링크가 표시되는지 확인해줘',
  },
  {
    label: '폼 입력 테스트',
    prompt: 'https://the-internet.herokuapp.com/login에 접속해서 사용자명 "tomsmith", 비밀번호 "SuperSecretPassword!"를 입력하고 로그인 버튼을 클릭한 뒤 성공 메시지가 나타나는지 확인해줘',
  },
  {
    label: '검색 테스트',
    prompt: 'https://www.google.com에 접속해서 검색창에 "playwright testing"을 입력하고 Enter를 누른 뒤 검색 결과가 나타나는지 확인해줘',
  },
];

export function QuickActions({ onSelect }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <Zap size={16} className="text-yellow-400" />
        빠른 실행
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((t) => (
          <button
            key={t.label}
            onClick={() => onSelect(t.prompt)}
            className="text-left p-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-primary-600/50 hover:bg-gray-900 transition-colors"
          >
            <span className="text-sm font-medium text-gray-200">{t.label}</span>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
