import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import DateText from '../shared/DateText';

function HorizontalMilestoneCard({ milestone, todayStr }) {
  const isToday = milestone.date === todayStr;
  return (
    <Link
      to={`/transactions/${milestone.transaction_id}`}
      className="shrink-0 min-w-[200px] max-w-[240px] rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-3 py-2.5 hover:border-secondary/30 hover:bg-secondary/5 transition-colors"
    >
      <span
        className={`inline-block text-[10px] font-black uppercase tracking-widest mb-1.5 px-1.5 py-0.5 rounded ${
          isToday ? 'bg-secondary/15 text-secondary' : 'text-on-surface-variant'
        }`}
      >
        {isToday ? 'Today' : <DateText value={milestone.date} />}
      </span>
      <p className="font-bold text-primary text-sm leading-snug line-clamp-2">{milestone.title}</p>
      <p className="text-[11px] text-on-surface-variant mt-1 truncate">{milestone.sub}</p>
    </Link>
  );
}

export default function ClosingSoonPanel({
  milestones = [],
  loading = false,
  layout = 'vertical',
  compact = false,
  className = '',
}) {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (layout === 'horizontal') {
    return (
      <section
        className={`bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden ${className}`}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/5 bg-surface-container-high shrink-0">
          <Icon name="key" className="text-secondary !text-[17px]" />
          <h3 className="text-sm font-bold text-primary">Closing Soon</h3>
          {!loading && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
              {milestones.length}
            </span>
          )}
          <Link
            to="/transactions"
            className="ml-auto text-[10px] font-bold uppercase tracking-wider text-secondary hover:underline shrink-0"
          >
            View transactions →
          </Link>
        </div>

        <div className="px-4 py-3 overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="shrink-0 min-w-[200px] h-[72px] rounded-lg bg-surface-container-low animate-pulse" />
              ))}
            </div>
          ) : milestones.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No closings in the next 30 days.</p>
          ) : (
            <div className="flex gap-3">
              {milestones.map((m) => (
                <HorizontalMilestoneCard
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
        <Icon name="key" className="text-secondary !text-[17px]" />
        <h3 className={`font-semibold text-primary ${compact ? 'text-sm font-bold' : 'text-xl'}`}>
          Closing Soon
        </h3>
        {!loading && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
            {milestones.length}
          </span>
        )}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${compact ? 'px-3 py-2' : 'p-6'}`}>
        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading closings…</p>
        ) : milestones.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No closings in the next 30 days.</p>
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
        to="/transactions"
        className={`shrink-0 border-t border-primary/5 text-center font-bold text-secondary hover:bg-secondary/5 transition-colors ${
          compact
            ? 'px-3 py-1.5 text-[10px] uppercase tracking-wider'
            : 'm-6 mt-0 p-3 border border-outline rounded-lg text-sm hover:bg-surface-container-low block'
        }`}
      >
        {compact ? 'View all →' : 'View transactions'}
      </Link>
    </section>
  );
}
