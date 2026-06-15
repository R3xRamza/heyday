import { useMemo } from 'react';
import MarketingEventChip from './MarketingEventChip';
import { sortDayEvents } from './calendarUtils';

export default function MarketingDayEvents({ events, onEditPost, onTaskClick }) {
  const sorted = useMemo(() => sortDayEvents(events), [events]);
  const tasks = useMemo(() => sorted.filter((e) => e.kind === 'task'), [sorted]);
  const social = useMemo(() => sorted.filter((e) => e.kind === 'post'), [sorted]);
  const milestones = useMemo(
    () => sorted.filter((e) => e.kind !== 'task' && e.kind !== 'post'),
    [sorted],
  );

  if (!sorted.length) return null;

  const sectionLabelClass =
    'text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60 select-none';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5">
        {social.length > 0 && (
          <>
            <p className={sectionLabelClass}>Social ({social.length})</p>
            {social.map((ev) => (
              <MarketingEventChip
                key={ev.key}
                event={ev}
                onEditPost={onEditPost}
                onTaskClick={onTaskClick}
              />
            ))}
          </>
        )}
        {tasks.length > 0 && (
          <>
            <p className={`${sectionLabelClass}${social.length > 0 ? ' pt-0.5' : ''}`}>
              Tasks ({tasks.length})
            </p>
            {tasks.map((ev) => (
              <MarketingEventChip
                key={ev.key}
                event={ev}
                onEditPost={onEditPost}
                onTaskClick={onTaskClick}
              />
            ))}
          </>
        )}
        {milestones.map((ev) => (
          <MarketingEventChip
            key={ev.key}
            event={ev}
            onEditPost={onEditPost}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
