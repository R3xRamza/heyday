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

function pushCelebration(events, byKey, { type, subtype, contactId, name, dateStr }) {
  const key = `${type}:${subtype || 'default'}:${contactId}:${dateStr}`;
  if (byKey.has(key)) return;
  byKey.set(key, true);
  events.push({
    type,
    subtype: subtype || null,
    contact_id: contactId,
    name,
    date: dateStr,
  });
}

function pushMonthDayEvents(startStr, endStr, events, byKey, {
  type,
  subtype,
  contactId,
  name,
  rawDate,
}) {
  const md = parseMonthDay(rawDate);
  if (!md) return;
  eachDateInRange(startStr, endStr, (dateStr, d) => {
    if (d.getMonth() + 1 === md.month && d.getDate() === md.day) {
      pushCelebration(events, byKey, { type, subtype, contactId, name, dateStr });
    }
  });
}

/** Recurring month-day events (birthdays, anniversaries) in [start, end]. */
export function celebrationsInRange(contacts, startStr, endStr) {
  const events = [];
  const byKey = new Map();

  for (const c of contacts) {
    const isChild = c.person_type === 'child';

    if (c.birthday?.trim()) {
      pushMonthDayEvents(startStr, endStr, events, byKey, {
        type: 'birthday',
        subtype: isChild ? 'child' : 'contact',
        contactId: c.id,
        name: c.name,
        rawDate: c.birthday,
      });
    }

    if (!isChild && c.partner_birthday?.trim()) {
      pushMonthDayEvents(startStr, endStr, events, byKey, {
        type: 'birthday',
        subtype: 'partner',
        contactId: c.id,
        name: c.partner_name?.trim() || 'Partner',
        rawDate: c.partner_birthday,
      });
    }

    if (!isChild && c.anniversary?.trim()) {
      pushMonthDayEvents(startStr, endStr, events, byKey, {
        type: 'anniversary',
        subtype: 'contact',
        contactId: c.id,
        name: c.name,
        rawDate: c.anniversary,
      });
    }

    if (!isChild && c.home_anniversary?.trim()) {
      pushMonthDayEvents(startStr, endStr, events, byKey, {
        type: 'anniversary',
        subtype: 'home',
        contactId: c.id,
        name: c.name,
        rawDate: c.home_anniversary,
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
