import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import DateText from '../shared/DateText';

function CompactMilestoneCard({ milestone, todayStr }) {
  const isToday = milestone.date === todayStr;
  return (
    <Link
      to={`/transactions/${milestone.transaction_id}`}
      className="block rounded-md border border-outline-variant/10 bg-surface-container-low/40 px-2.5 py-2 hover:border-secondary/30 hover:bg-secondary/5 transition-colors"
    >
      <span
        className={`text-[9px] font-black uppercase tracking-widest ${
          isToday ? 'text-secondary' : 'text-on-surface-variant'
        }`}
      >
        {isToday ? 'Today' : <DateText value={milestone.date} />}
      </span>
      <p className="font-semibold text-primary text-xs leading-snug truncate mt-0.5">{milestone.title}</p>
    </Link>
  );
}

function ClosingListRow({ milestone, todayStr }) {
  const isToday = milestone.date === todayStr;
  return (
    <Link
      to={`/transactions/${milestone.transaction_id}`}
      className="flex items-center gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low/40 px-3 py-2 hover:border-secondary/30 hover:bg-secondary/5 transition-colors min-w-0"
    >
      <span
        className={`shrink-0 w-[5.75rem] text-[10px] font-black uppercase tracking-widest ${
          isToday ? 'text-secondary' : 'text-on-surface-variant'
        }`}
      >
        {isToday ? 'Today' : <DateText value={milestone.date} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-primary text-sm leading-snug truncate">{milestone.title}</p>
        <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{milestone.sub}</p>
      </div>
      <Icon name="chevron_right" className="!text-[18px] text-on-surface-variant/40 shrink-0" />
    </Link>
  );
}

export default function ClosingSoonPanel({
  title = 'Closing in Next 30 Days',
  icon = 'key',
  milestones = [],
  loading = false,
  layout = 'vertical',
  compact = false,
  size = 'default',
  className = '',
  emptyMessage = 'No closings in the next 30 days.',
  loadingMessage = 'Loading closings…',
  viewAllTo = '/transactions',
  viewAllLabel = 'View transactions →',
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const isCompactHorizontal = layout === 'horizontal' && size === 'compact';

  if (layout === 'horizontal') {
    const headerClass = 'flex items-center gap-2 px-4 h-11 border-b border-primary/5 bg-surface-container-high shrink-0';

    return (
      <section
        className={`bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden flex flex-col h-full ${className}`}
      >
        <div className={headerClass}>
          <Icon name={icon} className="text-secondary !text-[17px] shrink-0" />
          <h3 className={`font-bold text-primary leading-snug min-w-0 ${
            isCompactHorizontal ? 'text-[11px] flex-1 truncate' : 'text-sm shrink-0'
          }`}
          >
            {title}
          </h3>
          {!loading && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded shrink-0">
              {milestones.length}
            </span>
          )}
          <Link
            to={viewAllTo}
            className="ml-auto text-[10px] font-bold uppercase tracking-wider text-secondary hover:underline shrink-0 whitespace-nowrap"
          >
            {viewAllLabel}
          </Link>
        </div>

        <div className="flex-1 min-h-0 px-2.5 py-2.5 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="space-y-1.5">
              {(isCompactHorizontal ? [0, 1, 2] : [0, 1, 2, 3]).map((i) => (
                <div
                  key={i}
                  className={`rounded-lg bg-surface-container-low animate-pulse ${
                    isCompactHorizontal ? 'h-11' : 'h-[3.25rem]'
                  }`}
                />
              ))}
            </div>
          ) : milestones.length === 0 ? (
            <p className={`text-on-surface-variant px-1 ${isCompactHorizontal ? 'text-[11px]' : 'text-sm'}`}>
              {emptyMessage}
            </p>
          ) : isCompactHorizontal ? (
            <div className="space-y-1.5">
              {milestones.map((m) => (
                <CompactMilestoneCard
                  key={`${m.transaction_id}-${m.date}`}
                  milestone={m}
                  todayStr={todayStr}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {milestones.map((m) => (
                <ClosingListRow
                  key={`${m.transaction_id}-${m.date}`}
                  milestone={m}
                  todayStr={todayStr}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const heightClass = compact ? 'h-[21rem]' : 'h-full min-h-0';

  return (
    <section
      className={`bg-white rounded-xl border border-outline-variant/15 shadow-executive flex flex-col overflow-hidden ${heightClass} ${className}`}
    >
      <div className={`shrink-0 flex items-center gap-2 border-b border-primary/5 ${
        compact ? 'bg-surface-container-high px-3 py-2' : 'bg-surface-container-high px-6 py-4'
      }`}
      >
        <Icon name={icon} className="text-secondary !text-[17px]" />
        <h3 className={`font-semibold text-primary ${compact ? 'text-sm font-bold' : 'text-xl'}`}>
          {title}
        </h3>
        {!loading && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
            {milestones.length}
          </span>
        )}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${compact ? 'px-3 py-2' : 'p-6'}`}>
        {loading ? (
          <p className="text-on-surface-variant text-sm">{loadingMessage}</p>
        ) : milestones.length === 0 ? (
          <p className="text-on-surface-variant text-sm">{emptyMessage}</p>
        ) : (
          <div className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-outline-variant">
            {milestones.map((m) => {
              const isToday = m.date === todayStr;
              return (
                <div key={`${m.transaction_id}-${m.date}`} className={`relative ${compact ? 'mb-4' : 'mb-6'}`}>
                  <span
                    className={`absolute -left-[28px] top-1.5 w-2 h-2 rounded-full border-2 border-white ${
                      isToday ? 'bg-secondary' : 'bg-outline-variant'
                    }`}
                  />
                  <div
                    className={`text-[10px] font-black uppercase tracking-widest mb-1 whitespace-nowrap ${
                      isToday ? 'text-secondary' : 'text-on-surface-variant'
                    }`}
                  >
                    {isToday ? 'Today' : <DateText value={m.date} />}
                  </div>
                  <Link
                    to={`/transactions/${m.transaction_id}`}
                    className={`font-bold text-primary hover:text-secondary block ${compact ? 'text-xs' : ''}`}
                  >
                    {m.title}
                  </Link>
                  <div className={`text-on-surface-variant ${compact ? 'text-[11px]' : 'text-sm'}`}>{m.sub}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Link
        to={viewAllTo}
        className={`shrink-0 border-t border-primary/5 text-center font-bold text-secondary hover:bg-secondary/5 transition-colors ${
          compact
            ? 'px-3 py-1.5 text-[10px] uppercase tracking-wider'
            : 'm-6 mt-0 p-3 border border-outline rounded-lg text-sm hover:bg-surface-container-low block'
        }`}
      >
        {compact ? 'View all →' : viewAllLabel.replace(' →', '')}
      </Link>
    </section>
  );
}
