import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Ellipsis, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../constants/nav';
import { resolveTransactionsSidebarLink } from '../utils/transactionsListPath';
import useOverdueTaskCount from '../hooks/useOverdueTaskCount';
import { useAuth } from '../context/AuthContext';
import TeamAvatar from './TeamAvatar';

function OverdueDot({ count }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-error text-white text-[9px] font-bold flex items-center justify-center leading-none">
      {label}
    </span>
  );
}

export default function MobileBottomNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const overdueCount = useOverdueTaskCount();
  const [moreOpen, setMoreOpen] = useState(false);

  async function handleLogout() {
    setMoreOpen(false);
    await logout();
    navigate('/login');
  }

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-feather border-t border-feather-alt/40 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex items-stretch overflow-x-auto hide-scrollbar overscroll-x-contain">
          {NAV_ITEMS.map(({ to, label, shortLabel, icon: Icon, taskHub }) => {
            const linkTo = to === '/transactions' ? resolveTransactionsSidebarLink() : to;
            return (
              <NavLink
                key={to}
                to={linkTo}
                end={taskHub}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center gap-0.5 shrink-0 min-w-[4.5rem] min-h-[44px] px-2 py-1.5 text-[10px] font-semibold tracking-wide transition-colors ${
                    isActive ? 'text-lemon bg-feather-alt/30' : 'text-sky'
                  }`
                }
                title={label}
              >
                <Icon size={20} className="shrink-0" aria-hidden />
                <span className="leading-tight whitespace-nowrap">{shortLabel || label}</span>
                {taskHub && <OverdueDot count={overdueCount} />}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 shrink-0 min-w-[4.5rem] min-h-[44px] px-2 py-1.5 text-[10px] font-semibold tracking-wide text-sky"
            aria-label="More"
          >
            <Ellipsis size={20} className="shrink-0" aria-hidden />
            <span className="leading-tight">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl shadow-executive px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeamAvatar email={user?.email} name={user?.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-primary truncate">{user?.name}</p>
                <p className="text-xs text-on-surface-variant truncate lowercase">
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-11 flex items-center justify-center gap-2 rounded-lg bg-feather text-lemon text-sm font-semibold"
            >
              <LogOut size={16} />
              Logout
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="w-full min-h-11 text-sm font-semibold text-on-surface-variant"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
