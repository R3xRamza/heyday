import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TeamAvatar from './TeamAvatar';
import {
  APP_HEADER_BORDER_CLASS,
  APP_HEADER_HEIGHT_CLASS,
  APP_HEADER_TITLE_CLASS,
} from '../constants/appHeader';

export default function TopNav({ title, subtitle, headerRight, titleAddon }) {
  const { user } = useAuth();

  return (
    <header
      className={`sticky top-0 z-30 shrink-0 bg-white ${APP_HEADER_HEIGHT_CLASS} ${APP_HEADER_BORDER_CLASS} px-8 flex items-center gap-4`}
    >
      {title ? (
        <div className="min-w-0 max-w-[min(100%,36rem)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className={APP_HEADER_TITLE_CLASS}>{title}</h1>
            {titleAddon}
          </div>
          {subtitle && (
            <p className="text-xs text-on-surface-variant truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      ) : null}

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-3 shrink-0">
        {headerRight}
        <button
          type="button"
          className="p-1.5 text-on-surface-variant hover:text-feather transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
        <TeamAvatar email={user?.email} name={user?.name} size="md" />
      </div>
    </header>
  );
}
