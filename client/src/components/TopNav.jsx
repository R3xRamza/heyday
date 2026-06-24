import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TeamAvatar from './TeamAvatar';

export default function TopNav({ title, subtitle, headerRight }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 shrink-0 min-h-14 py-2.5 bg-white border-b border-sky px-8 flex items-center gap-4">
      {title ? (
        <div className="min-w-0 max-w-[360px] shrink-0">
          <h2 className="text-xl font-bold text-feather truncate leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-on-surface-variant truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      ) : null}

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-3 shrink-0">
        {headerRight}
        <button className="p-1.5 text-on-surface-variant hover:text-feather transition-colors" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <TeamAvatar email={user?.email} name={user?.name} size="md" />
      </div>
    </header>
  );
}
