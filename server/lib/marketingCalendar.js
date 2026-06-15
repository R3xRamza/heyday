function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISODate(str) {
  if (!str) return null;
  const d = new Date(`${str}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Extract month (1-12) and day from flexible CRM date strings. */
export function parseMonthDay(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { month: Number(m[2]), day: Number(m[3]) };

  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) return { month: Number(m[1]), day: Number(m[2]) };

  m = s.match(/^(\d{1,2})-(\d{1,2})/);
  if (m) return { month: Number(m[1]), day: Number(m[2]) };

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return { month: parsed.getMonth() + 1, day: parsed.getDate() };
  }
  return null;
}

export function eachDateInRange(startStr, endStr, fn) {
  const start = parseISODate(startStr);
  const end = parseISODate(endStr);
  if (!start || !end || start > end) return;
  const cur = new Date(start);
  while (cur <= end) {
    fn(toDateStr(cur), cur);
    cur.setDate(cur.getDate() + 1);
  }
}

/** Recurring month-day events (birthdays, anniversaries) in [start, end]. */
export function celebrationsInRange(contacts, startStr, endStr) {
  const events = [];
  const byKey = new Map();

  for (const c of contacts) {
    const pairs = [
      { type: 'birthday', raw: c.birthday },
      { type: 'anniversary', raw: c.anniversary },
    ];
    for (const { type, raw } of pairs) {
      const md = parseMonthDay(raw);
      if (!md) continue;
      eachDateInRange(startStr, endStr, (dateStr, d) => {
        if (d.getMonth() + 1 === md.month && d.getDate() === md.day) {
          const key = `${type}:${c.id}:${dateStr}`;
          if (byKey.has(key)) return;
          byKey.set(key, true);
          events.push({
            type,
            contact_id: c.id,
            name: c.name,
            date: dateStr,
          });
        }
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return events;
}

export function startOfWeekMonday(d) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function endOfWeekSunday(d) {
  const start = startOfWeekMonday(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

export function monthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function weekRange(d) {
  return {
    start: toDateStr(startOfWeekMonday(d)),
    end: toDateStr(endOfWeekSunday(d)),
  };
}
