import { NavLink } from 'react-router-dom';

const tabClass = ({ isActive }) =>
  `min-w-[6.5rem] px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide text-center transition-colors ${
    isActive
      ? 'bg-primary text-white'
      : 'text-on-surface-variant hover:bg-surface-container-high'
  }`;

export default function CrmHubTabs() {
  return (
    <div className="inline-flex rounded-full bg-surface-container-low p-1 border border-outline-variant/20 shrink-0">
      <NavLink to="/crm" end className={tabClass}>
        Contacts
      </NavLink>
      <NavLink to="/crm/vendors" className={tabClass}>
        Vendors
      </NavLink>
    </div>
  );
}
