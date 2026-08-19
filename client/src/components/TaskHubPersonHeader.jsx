import { Link } from 'react-router-dom';
import TaskHubTabs from './TaskHubTabs';
import TeamAvatar from './TeamAvatar';
import { APP_HEADER_BORDER_CLASS } from '../constants/appHeader';

export default function TaskHubPersonHeader({
  userId,
  title,
  member,
  profile,
  children,
  showBorder = true,
  transactionOverdue = 0,
  adminOverdue = 0,
}) {
  return (
    <section
      className={`relative bg-surface px-4 md:px-10 py-4 md:py-6 shrink-0${
        showBorder ? ` ${APP_HEADER_BORDER_CLASS}` : ''
      }`}
    >
      <div className="flex flex-col gap-4 md:block">
        <div className="order-2 md:order-none md:absolute md:right-10 md:top-6 z-10 w-full md:w-auto">
          <TaskHubTabs
            userId={userId}
            transactionOverdue={transactionOverdue}
            adminOverdue={adminOverdue}
          />
        </div>

        <div className="order-1 md:pr-72 md:min-h-[6.5rem]">
          <Link to="/tasks" className="text-sm text-secondary hover:underline mb-1 inline-block">
            ← Back to Team Overview
          </Link>
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            {member && (
              <TeamAvatar
                email={member.email}
                name={member.name}
                size="lg"
                borderClassName="border-2 border-surface-container"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-xl md:text-3xl font-semibold text-primary leading-tight">{title}</h2>
              <p className="text-on-surface-variant text-sm mt-1 min-h-[1.25rem] truncate">
                {member ? `${member.name} · ${profile?.role}` : '\u00a0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}
