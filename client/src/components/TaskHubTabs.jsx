import { Link, useLocation } from 'react-router-dom';

export default function TaskHubTabs({ userId, transactionOverdue = 0, adminOverdue = 0 }) {
  const location = useLocation();
  const isProjects = location.pathname.includes('/projects');
  const isAdmin = location.pathname.includes('/admin');

  function tabClass(active, overdueCount) {
    const overdueTone = !active && overdueCount > 0 ? ' text-error' : '';
    return `relative flex-1 md:flex-none min-w-0 px-2.5 md:px-3 text-center py-2 md:py-1.5 rounded-full text-[11px] md:text-xs font-semibold uppercase tracking-wide transition-colors${
      active ? ' bg-primary text-white' : ` text-on-surface-variant hover:bg-surface-container-high${overdueTone}`
    }`;
  }

  function OverdueDot({ count }) {
    if (!(count > 0)) return null;
    return (
      <span
        className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-error text-white text-[9px] font-black leading-4 tabular-nums"
        aria-label={`${count} overdue`}
      >
        {count}
      </span>
    );
  }

  return (
    <div className="flex w-full md:w-auto md:inline-flex rounded-full bg-surface-container-low p-1 border border-outline-variant/20 shrink-0">
      <Link to={`/tasks/${userId}`} className={tabClass(!isProjects && !isAdmin, transactionOverdue)}>
        <span className="md:hidden">Tasks</span>
        <span className="hidden md:inline">Transaction Tasks</span>
        <OverdueDot count={transactionOverdue} />
      </Link>
      <Link to={`/tasks/${userId}/admin`} className={tabClass(isAdmin, adminOverdue)}>
        <span className="md:hidden">Admin</span>
        <span className="hidden md:inline">Admin Tasks</span>
        <OverdueDot count={adminOverdue} />
      </Link>
      <Link to={`/tasks/${userId}/projects`} className={tabClass(isProjects, 0)}>
        Projects
      </Link>
    </div>
  );
}
