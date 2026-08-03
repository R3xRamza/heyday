import { useMemo, useState } from 'react';
import Icon from './shared/Icon';
import { displayTaskTitle } from '../utils/taskDisplay.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const today = new Date().toISOString().slice(0, 10);
  const cells = [];

  const prevLast = new Date(year, monthIndex, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevLast - i;
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    cells.push({
      day,
      muted: true,
      dateStr: dateKey(prevYear, prevMonth, day),
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = dateKey(year, monthIndex, d);
    cells.push({ day: d, muted: false, dateStr, today: dateStr === today });
  }

  let nextDay = 1;
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay,
      muted: true,
      dateStr: dateKey(nextYear, nextMonth, nextDay),
    });
    nextDay += 1;
  }

  return cells;
}

function TaskChip({ task, onClick }) {
  const isComplete = task.status === 'complete';
  const overdue = !isComplete && task.is_overdue;
  const label = displayTaskTitle(task);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
      className={`w-full text-left px-2 py-1 border-l-4 text-[10px] rounded-r truncate transition-colors ${
        isComplete
          ? 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant/70 line-through'
          : overdue
            ? 'bg-error/10 border-error text-error'
            : 'bg-secondary/10 border-secondary text-on-surface'
      }`}
      title={task.title}
    >
      <span className="font-semibold block truncate">{label}</span>
    </button>
  );
}

export default function TaskCalendarView({ tasks, onTaskClick }) {
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const monthIndex = viewDate.getMonth();

  const tasksByDate = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (!map[t.due_date]) map[t.due_date] = [];
      map[t.due_date].push(t);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    setViewDate(new Date(year, monthIndex - 1, 1));
  }

  function nextMonth() {
    setViewDate(new Date(year, monthIndex + 1, 1));
  }

  function goToday() {
    setViewDate(new Date());
  }

  return (
    <div className="p-3 sm:p-6 md:p-10">
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 min-h-11 min-w-11 rounded-lg border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Previous month"
          >
            <Icon name="chevron_left" className="!text-[20px]" />
          </button>
          <h3 className="text-base sm:text-lg font-semibold text-primary min-w-0 sm:min-w-[180px] text-center truncate">
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={nextMonth}
            className="p-2 min-h-11 min-w-11 rounded-lg border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Next month"
          >
            <Icon name="chevron_right" className="!text-[20px]" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="text-xs font-semibold uppercase tracking-wide text-secondary hover:underline min-h-11 px-2"
        >
          Today
        </button>
      </div>

      <div className="bg-surface border border-outline-variant/20 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 text-center py-2 md:py-3 bg-surface-container-high border-b border-outline-variant/20">
          {[
            { short: 'M', full: 'Mon' },
            { short: 'T', full: 'Tue' },
            { short: 'W', full: 'Wed' },
            { short: 'T', full: 'Thu' },
            { short: 'F', full: 'Fri' },
            { short: 'S', full: 'Sat' },
            { short: 'S', full: 'Sun' },
          ].map((d) => (
            <div
              key={d.full}
              className="text-[10px] md:text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest"
            >
              <span className="md:hidden">{d.short}</span>
              <span className="hidden md:inline">{d.full}</span>
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((cell) => {
            const dayTasks = cell.dateStr ? tasksByDate[cell.dateStr] || [] : [];
            const mobileLimit = 2;
            const desktopLimit = 4;
            return (
              <div
                key={`${cell.dateStr}-${cell.day}`}
                className={`calendar-cell min-h-[4.5rem] sm:min-h-[6rem] md:min-h-[120px] p-1 sm:p-1.5 ${
                  cell.muted ? 'bg-surface-container-lowest/50 text-outline-variant' : ''
                } ${cell.today ? 'bg-secondary/5 ring-1 ring-inset ring-secondary/20' : ''}`}
              >
                <span
                  className={`font-bold text-[10px] sm:text-xs block mb-0.5 sm:mb-1 ${
                    cell.today ? 'text-secondary' : cell.muted ? 'text-outline-variant' : 'text-on-surface'
                  }`}
                >
                  {cell.day}
                  {cell.today ? (
                    <span className="hidden sm:inline text-[10px] font-semibold text-secondary ml-1">Today</span>
                  ) : null}
                </span>
                {dayTasks.length > 0 && (
                  <>
                    <div className="mt-0.5 space-y-0.5 max-h-[3rem] overflow-hidden md:hidden">
                      {dayTasks.slice(0, mobileLimit).map((t) => (
                        <TaskChip key={t.id} task={t} onClick={onTaskClick} />
                      ))}
                      {dayTasks.length > mobileLimit && (
                        <p className="text-[9px] text-on-surface-variant/60 pl-0.5">
                          +{dayTasks.length - mobileLimit}
                        </p>
                      )}
                    </div>
                    <div className="hidden md:block mt-1 space-y-1 max-h-[88px] overflow-y-auto custom-scrollbar">
                      {dayTasks.slice(0, desktopLimit).map((t) => (
                        <TaskChip key={t.id} task={t} onClick={onTaskClick} />
                      ))}
                      {dayTasks.length > desktopLimit && (
                        <p className="text-[10px] text-on-surface-variant/60 pl-1">
                          +{dayTasks.length - desktopLimit} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
