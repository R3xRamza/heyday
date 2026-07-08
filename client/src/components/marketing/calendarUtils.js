export function pad2(n) {
  return String(n).padStart(2, '0');
}

export const MARKETING_POST_DRAG_TYPE = 'application/x-marketing-post-id';
export const MARKETING_TASK_DRAG_TYPE = 'application/x-marketing-task-id';

export function dateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function toDateStr(d) {
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfWeekSunday(d) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function buildMonthCells(year, monthIndex) {
  const startPad = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const cells = [];

  const prevLast = new Date(year, monthIndex, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevLast - i;
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    cells.push({ day, muted: true, dateStr: dateKey(prevYear, prevMonth, day) });
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

export function buildWeekCells(focusDate) {
  const start = startOfWeekSunday(focusDate);
  const today = new Date().toISOString().slice(0, 10);
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = toDateStr(d);
    cells.push({
      day: d.getDate(),
      muted: false,
      dateStr,
      today: dateStr === today,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }
  return cells;
}

export function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthKeyFromStr(dateStr) {
  return dateStr?.slice(0, 7) ?? '';
}

export function monthsInDateRange(startStr, endStr) {
  const months = new Set();
  const start = parseISODateForRange(startStr);
  const end = parseISODateForRange(endStr);
  if (!start || !end) return [];
  const cur = new Date(start);
  cur.setDate(1);
  while (cur <= end) {
    months.add(monthKeyFromDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return [...months];
}

function parseISODateForRange(str) {
  const d = new Date(`${str}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function monthRange(viewDate) {
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const start = dateKey(y, m, 1);
  const end = dateKey(y, m, new Date(y, m + 1, 0).getDate());
  return { start, end };
}

export function weekRange(viewDate) {
  const cells = buildWeekCells(viewDate);
  return { start: cells[0].dateStr, end: cells[6].dateStr };
}

export function currentWeekRange() {
  return weekRange(new Date());
}

export function previousWeekRange() {
  const start = startOfWeekSunday(new Date());
  start.setDate(start.getDate() - 7);
  return weekRange(start);
}

export function groupEventsByDate(events) {
  const map = {};
  for (const e of events) {
    if (!e.date) continue;
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return map;
}

const KIND_ORDER = { post: 0, birthday: 1, anniversary: 1, task: 2 };

function kindRank(kind) {
  return KIND_ORDER[kind] ?? 3;
}

export function sortDayEvents(events) {
  return [...events].sort((a, b) => {
    const rankDiff = kindRank(a.kind) - kindRank(b.kind);
    if (rankDiff !== 0) return rankDiff;

    if (a.kind === 'task' && b.kind === 'task') {
      const aOverdue = a.raw?.is_overdue && a.raw?.status !== 'complete';
      const bOverdue = b.raw?.is_overdue && b.raw?.status !== 'complete';
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    }

    return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
  });
}

/** End date for toolbar celebration fetch when today is Friday (through Sunday). */
export function fridayCelebrationFetchEnd(todayStr) {
  const d = new Date(`${todayStr}T12:00:00`);
  if (d.getDay() !== 5) return todayStr;
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  return toDateStr(d);
}

export function partitionFridayCelebrations(events, todayStr) {
  const friday = [];
  const weekend = [];
  for (const e of events) {
    if (e.date === todayStr) friday.push(e);
    else weekend.push(e);
  }
  return { friday, weekend };
}

export function celebrationEventKey(event) {
  const subtype = event.subtype || 'contact';
  return `${event.type}-${subtype}-${event.contact_id}-${event.date}`;
}

export function celebrationTypeLabel(event) {
  if (event.type === 'anniversary' && event.subtype === 'home') return 'Home Anniversary';
  if (event.type === 'anniversary') return 'Anniversary';
  if (event.subtype === 'child') return 'Birthday · Kid';
  if (event.subtype === 'partner') return 'Birthday · Partner';
  return 'Birthday';
}

export function celebrationDisplayName(event) {
  if (event.type === 'anniversary') return event.name;
  if (event.subtype === 'partner') return `${event.name} (partner)`;
  return event.name;
}

export function celebrationChipPrefix(event) {
  if (event.type === 'anniversary' && event.subtype === 'home') return 'Home Anniversary';
  if (event.type === 'anniversary') return 'Anniversary';
  return 'Birthday';
}
