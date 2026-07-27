import { useMemo } from 'react';
import MarketingEventChip from './MarketingEventChip';
import { sortDayEvents } from './calendarUtils';

function formatSelectedDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** Mobile agenda for the selected calendar day (chips are too small inside cells). */
export default function MarketingSelectedDayPanel({
  dateStr,
  events = [],
  onEditPost,
  onTaskClick,
  onNewPostForDate,
}) {
  const sorted = useMemo(() => sortDayEvents(events), [events]);

  return (
    <section className="mt-3 bg-white border border-outline-variant/15 rounded-xl p-3 md:hidden">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-feather truncate">
          {formatSelectedDay(dateStr) || 'Select a day'}
        </h3>
        {onNewPostForDate && dateStr && (
          <button
            type="button"
            onClick={() => onNewPostForDate(dateStr)}
            className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-secondary"
          >
            + Post
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-2">No events this day.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {sorted.map((ev) => (
            <MarketingEventChip
              key={ev.key}
              event={ev}
              onEditPost={onEditPost}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}
