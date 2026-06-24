import { Link } from 'react-router-dom';
import TaskHubTabs from './TaskHubTabs';
import TeamAvatar from './TeamAvatar';

export default function TaskHubPersonHeader({ userId, title, member, profile, children, showBorder = true }) {
  return (
    <section
      className={`relative bg-surface px-10 py-6 shrink-0${
        showBorder ? ' border-b border-outline-variant/20' : ''
      }`}
    >
      <div className="absolute right-10 top-6 z-10">
        <TaskHubTabs userId={userId} />
      </div>

      <div className="pr-36 min-h-[6.5rem]">
        <Link to="/tasks" className="text-sm text-secondary hover:underline mb-1 inline-block">
          ← Back to Team Overview
        </Link>
        <div className="flex items-center gap-4">
          {member && (
            <TeamAvatar
              email={member.email}
              name={member.name}
              size="lg"
              borderClassName="border-2 border-surface-container"
            />
          )}
          <div>
            <h2 className="text-3xl font-semibold text-primary">{title}</h2>
            <p className="text-on-surface-variant text-sm mt-1 min-h-[1.25rem]">
              {member ? `${member.name} · ${profile?.role}` : '\u00a0'}
            </p>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}
