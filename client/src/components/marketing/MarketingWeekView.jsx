import { useEffect, useState } from 'react';
import MarketingDayEvents from './MarketingDayEvents';
import DayNumber from './DayNumber';
import { useIsMdUp } from '../../hooks/useMediaQuery';
import { buildWeekCells, MARKETING_POST_DRAG_TYPE, MARKETING_TASK_DRAG_TYPE } from './calendarUtils';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isInteractiveEventTarget(target) {
  return Boolean(target.closest('button, a'));
}

function DayEventCount({ events }) {
  if (!events.length) return null;
  const posts = events.filter((e) => e.kind === 'post').length;
  const tasks = events.filter((e) => e.kind === 'task').length;
  const other = events.length - posts - tasks;
  return (
    <div className="mt-auto flex items-center gap-0.5 flex-wrap" aria-label={`${events.length} events`}>
      {posts > 0 && <span className="w-1.5 h-1.5 rounded-full bg-feather shrink-0" />}
      {tasks > 0 && <span className="w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />}
      {other > 0 && <span className="w-1.5 h-1.5 rounded-full bg-purple shrink-0" />}
      <span className="text-[9px] font-bold text-on-surface-variant tabular-nums leading-none">
        {events.length}
      </span>
    </div>
  );
}

export default function MarketingWeekView({
  viewDate,
  eventsByDate,
  selectedDate,
  onSelectDate,
  onEditPost,
  onTaskClick,
  onDropPost,
  onDropTask,
  onNewPostForDate,
}) {
  const isMdUp = useIsMdUp();
  const cells = buildWeekCells(viewDate);
  const [dragOverDate, setDragOverDate] = useState(null);
  const weekdayLabels = isMdUp ? WEEKDAYS : WEEKDAYS_SHORT;

  useEffect(() => {
    function clearDragOver() {
      setDragOverDate(null);
    }
    document.addEventListener('dragend', clearDragOver);
    return () => document.removeEventListener('dragend', clearDragOver);
  }, []);

  return (
    <div className="marketing-calendar w-full bg-white border border-outline-variant/15 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 w-full text-center py-1.5 md:py-2.5 border-b border-outline-variant/10 bg-off-white shrink-0">
        {weekdayLabels.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-[10px] font-bold text-on-surface-variant/50 tracking-widest"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="calendar-grid marketing-calendar-grid marketing-calendar-grid--week w-full min-w-0">
        {cells.map((cell) => {
          const dayEvents = eventsByDate[cell.dateStr] || [];
          const isSelected = selectedDate === cell.dateStr;
          const isDropTarget = dragOverDate === cell.dateStr;

          function handleSelect() {
            onSelectDate?.(cell.dateStr);
          }

          function handleDoubleClick(e) {
            if (isInteractiveEventTarget(e.target)) return;
            onNewPostForDate?.(cell.dateStr);
          }

          function handleKeyDown(e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelect();
            }
          }

          function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverDate(cell.dateStr);
          }

          function handleDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            const postId = e.dataTransfer.getData(MARKETING_POST_DRAG_TYPE);
            if (postId) {
              onDropPost?.(Number(postId), cell.dateStr);
            } else {
              const taskId = e.dataTransfer.getData(MARKETING_TASK_DRAG_TYPE);
              if (taskId) onDropTask?.(Number(taskId), cell.dateStr);
            }
            setDragOverDate(null);
          }

          return (
            <div
              key={cell.dateStr}
              role="button"
              tabIndex={0}
              aria-selected={isSelected}
              aria-label={`Select ${cell.dateStr}`}
              onClick={handleSelect}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleKeyDown}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`marketing-calendar-cell marketing-calendar-cell--week min-w-0 cursor-pointer ${
                cell.today ? 'marketing-calendar-cell--today' : ''
              } ${isSelected ? 'marketing-calendar-cell--selected' : ''} ${
                isDropTarget ? 'marketing-calendar-cell--drop-target' : ''
              }`}
            >
              <div className="shrink-0 mb-0.5 md:mb-2" data-day-cell-header>
                <DayNumber day={cell.day} today={cell.today} muted={false} />
              </div>
              {!isMdUp ? (
                <DayEventCount events={dayEvents} />
              ) : (
                <div
                  className="marketing-day-events-desktop flex-1 min-h-0 overflow-hidden flex flex-col"
                  onClick={(e) => {
                    if (isInteractiveEventTarget(e.target)) e.stopPropagation();
                  }}
                  onDoubleClick={(e) => {
                    if (isInteractiveEventTarget(e.target)) e.stopPropagation();
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <MarketingDayEvents
                    events={dayEvents}
                    onEditPost={onEditPost}
                    onTaskClick={onTaskClick}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
