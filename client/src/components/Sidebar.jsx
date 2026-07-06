import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Users,
  CheckSquare,
  ListTodo,
  ClipboardList,
  FolderKanban,
  BookUser,
  BarChart2,
  Building2,
  Megaphone,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import TeamAvatar from './TeamAvatar';
import heydayLogo from '../assets/heyday-logo.png';

const NAV_ITEMS = [
  { to: '/team-ops', label: 'Team Hub', icon: Users },
  { to: '/tasks', label: 'Task Hub', icon: CheckSquare, taskHub: true },
  { to: '/crm', label: 'CRM Hub', icon: BookUser },
  { to: '/revenue', label: 'Revenue', icon: BarChart2 },
  { to: '/transactions', label: 'Transactions', icon: Building2 },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
];

function navLinkClasses(isActive, { compact = false, collapsed = false } = {}) {
  const state = isActive
    ? 'text-lemon border-lemon bg-feather-alt/40'
    : 'text-sky border-transparent hover:bg-feather-alt/20 hover:text-sky-alt';

  if (collapsed) {
    return `relative flex items-center justify-center py-3 text-base font-medium transition-colors border-l-4 ${state}`;
  }

  if (compact) {
    return `flex items-center gap-2.5 pl-10 pr-6 py-2.5 text-[15px] font-medium transition-colors border-l-4 ${state}`;
  }

  return `flex items-center gap-3 px-6 py-3 text-base font-medium transition-colors border-l-4 ${state}`;
}

function OverdueBadge({ count, collapsed }) {
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : count;
  const classes = collapsed
    ? 'absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center'
    : 'min-w-[22px] h-5 px-1.5 rounded-full bg-error text-white text-[11px] font-bold flex items-center justify-center';

  return <span className={classes}>{label}</span>;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { collapsed, toggleCollapsed, sidebarWidth } = useSidebar();
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
    <aside
      className="fixed left-0 top-0 h-screen bg-feather flex flex-col z-40 overflow-hidden transition-[width] duration-200 ease-in-out"
      style={{ width: sidebarWidth }}
    >
      <div
        className={`flex items-center border-b border-feather-alt/30 shrink-0 ${
          collapsed ? 'justify-center px-2 py-4' : 'justify-between gap-2 px-4 py-4'
        }`}
      >
        <img
          src={heydayLogo}
          alt="HEYDAY"
          className={`h-auto object-contain shrink-0 ${
            collapsed ? 'w-10' : 'w-full max-w-[160px]'
          }`}
        />
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md text-sky hover:text-lemon hover:bg-feather-alt/30 transition-colors shrink-0"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2 border-b border-feather-alt/20">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            className="p-1.5 rounded-md text-sky hover:text-lemon hover:bg-feather-alt/30 transition-colors"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}

      <nav className="flex-1 py-2 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map(({ to, label, icon: Icon, taskHub }) => (
          <div key={to}>
            <NavLink
              to={to}
              end={taskHub}
              title={collapsed ? label : undefined}
              className={({ isActive }) => navLinkClasses(isActive, { collapsed })}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {taskHub && <OverdueBadge count={overdueCount} collapsed={collapsed} />}
            </NavLink>
            {taskHub && user?.id && (
              <>
                <NavLink
                  to={`/tasks/${user.id}`}
                  end
                  title={collapsed ? 'My Transaction Tasks' : undefined}
                  className={({ isActive }) => navLinkClasses(isActive, { compact: !collapsed, collapsed })}
                >
                  <ListTodo size={collapsed ? 20 : 18} className="shrink-0" />
                  {!collapsed && <span>My Transaction Tasks</span>}
                </NavLink>
                <NavLink
                  to={`/tasks/${user.id}/projects`}
                  end
                  title={collapsed ? 'My projects' : undefined}
                  className={({ isActive }) => navLinkClasses(isActive, { compact: !collapsed, collapsed })}
                >
                  <FolderKanban size={collapsed ? 20 : 18} className="shrink-0" />
                  {!collapsed && <span>My projects</span>}
                </NavLink>
                <NavLink
                  to={`/tasks/${user.id}/admin`}
                  end
                  title={collapsed ? 'My Admin Tasks' : undefined}
                  className={({ isActive }) => navLinkClasses(isActive, { compact: !collapsed, collapsed })}
                >
                  <ClipboardList size={collapsed ? 20 : 18} className="shrink-0" />
                  {!collapsed && <span>My Admin Tasks</span>}
                </NavLink>
              </>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-feather-alt/30 shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-3 px-2">
            <TeamAvatar email={user?.email} name={user?.name} size="sm" title={user?.name} />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="p-1.5 rounded-md text-sky hover:text-lemon hover:bg-feather-alt/30 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <TeamAvatar email={user?.email} name={user?.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{user?.name}</p>
                <p className="text-xs text-sky/70 truncate lowercase leading-tight mt-0.5">
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex items-center gap-1 text-xs text-sky hover:text-lemon py-0.5 transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
