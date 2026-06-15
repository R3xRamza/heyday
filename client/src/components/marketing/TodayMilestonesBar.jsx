import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';

export default function TodayMilestonesBar({ events }) {
  if (!events?.length) return null;

  return (
    <div className="bg-purple/5 border border-purple/15 rounded-xl px-4 py-2.5 mb-3 flex flex-wrap items-center gap-3 shrink-0">
      <span className="text-[11px] font-bold text-purple uppercase tracking-widest shrink-0">
        Today&apos;s Birthdays &amp; Anniversaries
      </span>
      <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
        {events.map((e) => {
          const isBirthday = e.type === 'birthday';
          return (
            <Link
              key={`${e.type}-${e.contact_id}`}
              to={`/crm/${e.contact_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-outline-variant/20 rounded-full text-xs font-medium text-feather hover:bg-off-white transition-colors"
            >
              <Icon
                name={isBirthday ? 'cake' : 'home'}
                className="!text-[16px] text-purple/70"
              />
              {e.name} — {isBirthday ? 'Birthday' : 'Home Anniversary'}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
