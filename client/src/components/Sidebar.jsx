import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Users,
  CheckSquare,
  ListTodo,
  BookUser,
  BarChart2,
  Building2,
  Megaphone,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from './shared/Badge';
import heydayLogo from '../assets/heyday-logo.png';

const NAV_ITEMS = [
  { to: '/team-ops', label: 'Team Hub', icon: Users },
  { to: '/tasks', label: 'Task Hub', icon: CheckSquare, taskHub: true },
  { to: '/crm', label: 'CRM Hub', icon: BookUser },
  { to: '/revenue', label: 'Revenue', icon: BarChart2 },
  { to: '/transactions', label: 'Transactions', icon: Building2 },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
];

function getInitials(name) {
  return name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

function navLinkClasses(isActive, { compact = false } = {}) {
  const state = isActive
    ? 'text-lemon border-lemon bg-feather-alt/40'
    : 'text-sky border-transparent hover:bg-feather-alt/20 hover:text-sky-alt';

  if (compact) {
    return `flex items-center gap-2.5 pl-10 pr-6 py-2.5 text-[15px] font-medium transition-colors border-l-4 ${state}`;
  }

  return `flex items-center gap-3 px-6 py-3 text-base font-medium transition-colors border-l-4 ${state}`;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    fetch('/api/tasks?assigned_to=me&filter=overdue&include_completed=false', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setOverdueCount(json?.stats?.overdueCount ?? 0))
      .catch(() => setOverdueCount(0));
  }, [user?.id]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-feather flex flex-col z-40">
      <div className="p-6 border-b border-feather-alt/30">
        <img
          src={heydayLogo}
          alt="HEYDAY"
          className="w-full max-w-[200px] h-auto object-contain"
        />
      </div>

      <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map(({ to, label, icon: Icon, taskHub }) => (
          <div key={to}>
            <NavLink
              to={to}
              className={({ isActive }) => navLinkClasses(isActive)}
            >
              <Icon size={20} />
              <span className="flex-1">{label}</span>
              {taskHub && overdueCount > 0 && (
                <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-error text-white text-[11px] font-bold flex items-center justify-center">
                  {overdueCount > 99 ? '99+' : overdueCount}
                </span>
              )}
            </NavLink>
            {taskHub && user?.id && (
              <NavLink
                to={`/tasks/${user.id}`}
                className={({ isActive }) => navLinkClasses(isActive, { compact: true })}
              >
                <ListTodo size={18} className="shrink-0" />
                <span>My tasks</span>
              </NavLink>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-feather-alt/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-feather-alt flex items-center justify-center text-white text-xs font-bold">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-base font-semibold truncate">{user?.name}</p>
            <Badge status={user?.role === 'admin' ? 'high' : 'prospect'} className="mt-1 text-[11px]">
              {user?.role}
            </Badge>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-base text-sky hover:text-lemon hover:bg-feather-alt/30 rounded transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
