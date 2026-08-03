import { Link, useLocation } from 'react-router-dom';

const tabClass = (active) =>
  `flex-1 md:flex-none min-w-0 px-2.5 md:px-3 text-center py-2 md:py-1.5 rounded-full text-[11px] md:text-xs font-semibold uppercase tracking-wide transition-colors ${
    active ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
  }`;

export default function TaskHubTabs({ userId }) {
  const location = useLocation();
  const isProjects = location.pathname.includes('/projects');
  const isAdmin = location.pathname.includes('/admin');

  return (
    <div className="flex w-full md:w-auto md:inline-flex rounded-full bg-surface-container-low p-1 border border-outline-variant/20 shrink-0">
      <Link to={`/tasks/${userId}`} className={tabClass(!isProjects && !isAdmin)}>
        <span className="md:hidden">Tasks</span>
        <span className="hidden md:inline">Transaction Tasks</span>
      </Link>
      <Link to={`/tasks/${userId}/admin`} className={tabClass(isAdmin)}>
        <span className="md:hidden">Admin</span>
        <span className="hidden md:inline">Admin Tasks</span>
      </Link>
      <Link to={`/tasks/${userId}/projects`} className={tabClass(isProjects)}>
        Projects
      </Link>
    </div>
  );
}
