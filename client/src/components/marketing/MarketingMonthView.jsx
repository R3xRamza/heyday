import { useEffect, useState } from 'react';
import MarketingDayEvents from './MarketingDayEvents';
import DayNumber from './DayNumber';
import { buildMonthCells, MARKETING_POST_DRAG_TYPE, MARKETING_TASK_DRAG_TYPE } from './calendarUtils';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isInteractiveEventTarget(target) {
  return Boolean(target.closest('button, a'));
}

function DayCell({
  cell,
  events,
  selectedDate,
  dragOverDate,
  onSelectDate,
  onEditPost,
  onTaskClick,
  onDropPost,
  onDropTask,
  onNewPostForDate,
}) {
  const dayEvents = events[cell.dateStr] || [];
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
    onDragOverDate?.(cell.dateStr);
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
    onDragOverDate?.(null);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Select ${cell.dateStr}`}
      onClick={handleSelect}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`marketing-calendar-cell min-w-0 cursor-pointer ${
        cell.muted ? 'marketing-calendar-cell--muted' : ''
      } ${cell.today ? 'marketing-calendar-cell--today' : ''} ${
        isSelected ? 'marketing-calendar-cell--selected' : ''
      } ${isDropTarget ? 'marketing-calendar-cell--drop-target' : ''}`}
    >
      <div className="shrink-0 mb-2" data-day-cell-header>
        <DayNumber day={cell.day} today={cell.today} muted={cell.muted} />
      </div>
      {dayEvents.length > 0 && (
        <div
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
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
}

export default function MarketingMonthView({
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
  const cells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth());
  const [dragOverDate, setDragOverDate] = useState(null);

  useEffect(() => {
    function clearDragOver() {
      setDragOverDate(null);
    }
    document.addEventListener('dragend', clearDragOver);
    return () => document.removeEventListener('dragend', clearDragOver);
  }, []);

  return (
    <div className="marketing-calendar w-full bg-white border border-outline-variant/15 rounded-xl">
      <div className="grid grid-cols-7 w-full text-center py-2.5 border-b border-outline-variant/10 bg-off-white shrink-0">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] font-bold text-on-surface-variant/50 tracking-widest">
            {d}
          </div>
        ))}
      </div>
      <div className="calendar-grid marketing-calendar-grid marketing-calendar-grid--month w-full min-w-0">
        {cells.map((cell) => (
          <DayCell
            key={cell.dateStr}
            cell={cell}
            events={eventsByDate}
            selectedDate={selectedDate}
            dragOverDate={dragOverDate}
            onSelectDate={onSelectDate}
            onEditPost={onEditPost}
            onTaskClick={onTaskClick}
            onDropPost={onDropPost}
            onDropTask={onDropTask}
            onDragOverDate={setDragOverDate}
            onNewPostForDate={onNewPostForDate}
          />
        ))}
      </div>
    </div>
  );
}
