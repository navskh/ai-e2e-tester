import { Routes, Route, NavLink } from 'react-router-dom';
import { FlaskConical, Plus, History, Activity } from 'lucide-react';
import { NewTest } from './pages/NewTest';
import { TestRun } from './pages/TestRun';
import { HistoryPage } from './pages/History';
import { clsx } from 'clsx';

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        )
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export function App() {
  return (
    <div className="flex h-screen">
      {/* 사이드바 */}
      <aside className="w-60 border-r border-gray-800 bg-gray-950 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FlaskConical size={24} className="text-primary-500" />
            <h1 className="text-lg font-bold">AI E2E 테스터</h1>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem to="/" icon={Plus} label="새 테스트" />
          <NavItem to="/history" icon={History} label="테스트 이력" />
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Activity size={14} />
            <span>v0.1.0</span>
          </div>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<NewTest />} />
          <Route path="/test/:id" element={<TestRun />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
