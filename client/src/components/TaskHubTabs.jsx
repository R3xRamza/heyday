import { Link, useLocation } from 'react-router-dom';

const tabClass = (active, wide = false) =>
  `${wide ? 'min-w-[8rem]' : 'min-w-[5.5rem]'} px-3 text-center py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors ${
    active ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'
  }`;

export default function TaskHubTabs({ userId }) {
  const location = useLocation();
  const isProjects = location.pathname.includes('/projects');
  const isAdmin = location.pathname.includes('/admin');

  return (
    <div className="inline-flex rounded-full bg-surface-container-low p-1 border border-outline-variant/20 shrink-0">
      <Link to={`/tasks/${userId}`} className={tabClass(!isProjects && !isAdmin, true)}>
        Transaction Tasks
      </Link>
      <Link to={`/tasks/${userId}/admin`} className={tabClass(isAdmin)}>
        Admin Tasks
      </Link>
      <Link to={`/tasks/${userId}/projects`} className={tabClass(isProjects)}>
        Projects
      </Link>
    </div>
  );
}
