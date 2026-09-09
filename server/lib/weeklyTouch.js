import db from '../db.js';
import { CRM_LIST_STAGE_SQL } from './crmContactScope.js';

export const PICK_COUNT = 5;
export const COOLDOWN_MONTHS = 6;
export const TZ = 'America/Chicago';

const CONTACT_SELECT = `
  c.id, c.name, c.email, c.phone, c.phone_2, c.date_added, c.stage
`;

/** New list draws Sunday 6:00 PM America/Chicago. */
const SUNDAY_EVENING_HOUR = 18;

export function chicagoDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function chicagoHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const raw = Number(parts.find((p) => p.type === 'hour')?.value);
  if (!Number.isFinite(raw)) return 0;
  return raw === 24 ? 0 : raw;
}

function parseIsoDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  if (!m) throw new Error(`Invalid date ${isoDate}`);
  return { y: Number(m[1]), month: Number(m[2]), d: Number(m[3]) };
}

/** Sunday 6pm Chicago that opened the current touch-base week. */
export function sundayEveningWeekStart(date = new Date()) {
  const iso = chicagoDateISO(date);
  const hour = chicagoHour(date);
  const { y, month, d } = parseIsoDate(iso);
  const utc = Date.UTC(y, month - 1, d);
  const dow = new Date(utc).getUTCDay(); // 0 Sun
  let daysSinceSunday;
  if (dow === 0) {
    daysSinceSunday = hour >= SUNDAY_EVENING_HOUR ? 0 : 7;
  } else {
    daysSinceSunday = dow;
  }
  const sun = new Date(utc - daysSinceSunday * 86400000);
  return sun.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const label = dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `Week of ${label}`;
}

function addCalendarMonths(iso, months) {
  const { y, month, d } = parseIsoDate(iso);
  const dt = new Date(Date.UTC(y, month - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

function meredithUserId() {
  return db.prepare(`
    SELECT id FROM users
    WHERE LOWER(email) = 'meredith@theheydaygroup.com'
    LIMIT 1
  `).get()?.id ?? null;
}

function closedRosterWhere() {
  const meredithId = meredithUserId();
  const conditions = [
    CRM_LIST_STAGE_SQL,
    `LOWER(TRIM(c.stage)) = 'closed'`,
    `(c.person_type IS NULL OR LOWER(TRIM(c.person_type)) != 'child')`,
    `(
      LOWER(IFNULL(c.assigned_to_name, '')) LIKE '%meredith%'
      ${meredithId != null ? 'OR c.assigned_to = ?' : ''}
    )`,
  ];
  const params = meredithId != null ? [meredithId] : [];
  return { sql: conditions.join(' AND '), params };
}

function rosterCount() {
  const { sql, params } = closedRosterWhere();
  return db.prepare(`SELECT COUNT(*) AS c FROM contacts c WHERE ${sql}`).get(...params).c;
}

function cooldownContactIds(todayIso) {
  const cutoff = addCalendarMonths(todayIso, -COOLDOWN_MONTHS);
  return db.prepare(`
    SELECT DISTINCT contact_id
    FROM weekly_touch_picks
    WHERE reached_at IS NOT NULL
      AND date(reached_at) >= date(?)
  `).all(cutoff).map((r) => r.contact_id);
}

function drawRandomIds(excludeIds, limit) {
  if (limit <= 0) return [];
  const { sql, params } = closedRosterWhere();
  const exclude = excludeIds.filter((id) => Number.isFinite(Number(id)));
  let where = sql;
  const allParams = [...params];
  if (exclude.length) {
    where += ` AND c.id NOT IN (${exclude.map(() => '?').join(', ')})`;
    allParams.push(...exclude);
  }
  return db.prepare(`
    SELECT c.id FROM contacts c
    WHERE ${where}
    ORDER BY RANDOM()
    LIMIT ?
  `).all(...allParams, limit).map((r) => r.id);
}

function ensureMeta(todayIso) {
  db.prepare(`
    INSERT OR IGNORE INTO weekly_touch_meta (id, cycle_number, cycle_started_on)
    VALUES (1, 1, ?)
  `).run(todayIso);

  const meta = db.prepare(
    'SELECT cycle_number, cycle_started_on FROM weekly_touch_meta WHERE id = 1',
  ).get();

  let cycleNumber = meta.cycle_number;
  let cycleStartedOn = meta.cycle_started_on;
  const cycleEnd = addCalendarMonths(cycleStartedOn, COOLDOWN_MONTHS);
  if (todayIso >= cycleEnd) {
    cycleNumber += 1;
    cycleStartedOn = todayIso;
    db.prepare(`
      UPDATE weekly_touch_meta
      SET cycle_number = ?, cycle_started_on = ?
      WHERE id = 1
    `).run(cycleNumber, cycleStartedOn);
  }
  return { cycleNumber, cycleStartedOn };
}

function loadPicks(weekStart) {
  return db.prepare(`
    SELECT p.id, p.week_start, p.slot, p.contact_id, p.reached_at, p.reached_by,
      ${CONTACT_SELECT}, u.name AS reached_by_name
    FROM weekly_touch_picks p
    JOIN contacts c ON c.id = p.contact_id
    LEFT JOIN users u ON u.id = p.reached_by
    WHERE p.week_start = ?
    ORDER BY p.slot ASC
  `).all(weekStart);
}

function insertPick(weekStart, slot, contactId) {
  db.prepare(`
    INSERT INTO weekly_touch_picks (week_start, slot, contact_id)
    VALUES (?, ?, ?)
  `).run(weekStart, slot, contactId);
}

function fillMissingSlots(weekStart, todayIso) {
  const existing = db.prepare(`
    SELECT slot, contact_id FROM weekly_touch_picks WHERE week_start = ?
  `).all(weekStart);
  const takenSlots = new Set(existing.map((r) => r.slot));
  const takenIds = existing.map((r) => r.contact_id);
  const cooldown = cooldownContactIds(todayIso);
  const exclude = [...new Set([...takenIds, ...cooldown])];

  const missingSlots = [];
  for (let slot = 1; slot <= PICK_COUNT; slot += 1) {
    if (!takenSlots.has(slot)) missingSlots.push(slot);
  }
  if (!missingSlots.length) return;

  const ids = drawRandomIds(exclude, missingSlots.length);
  missingSlots.forEach((slot, i) => {
    if (ids[i] == null) return;
    insertPick(weekStart, slot, ids[i]);
  });
}

function reachedThisCycleCount(cycleStartedOn) {
  const row = db.prepare(`
    SELECT COUNT(DISTINCT contact_id) AS c
    FROM weekly_touch_picks
    WHERE reached_at IS NOT NULL
      AND date(reached_at) >= date(?)
  `).get(cycleStartedOn);
  return row?.c ?? 0;
}

export function getWeeklyTouchList() {
  const todayIso = chicagoDateISO();
  const weekStart = sundayEveningWeekStart();
  const { cycleNumber, cycleStartedOn } = ensureMeta(todayIso);

  const run = db.transaction(() => {
    fillMissingSlots(weekStart, todayIso);
  });
  run();

  const picks = loadPicks(weekStart);
  const rosterSize = rosterCount();
  const reachedThisCycle = reachedThisCycleCount(cycleStartedOn);
  const reachedThisWeek = picks.filter((p) => p.reached_at).length;

  return {
    weekStart,
    weekLabel: formatWeekLabel(weekStart),
    cycleNumber,
    rosterSize,
    reachedThisCycle,
    reachedThisWeek,
    pickCount: PICK_COUNT,
    cooldownMonths: COOLDOWN_MONTHS,
    picks: picks.map((p) => ({
      id: p.id,
      slot: p.slot,
      contactId: p.contact_id,
      name: p.name,
      email: p.email,
      phone: p.phone || p.phone_2,
      dateAdded: p.date_added,
      stage: p.stage,
      reachedAt: p.reached_at,
      reachedByName: p.reached_by_name,
    })),
  };
}

export function skipWeeklyTouchPick(contactId, _userId) {
  const id = Number(contactId);
  if (!Number.isFinite(id)) {
    return { error: 'contactId is required', status: 400 };
  }

  const todayIso = chicagoDateISO();
  const weekStart = sundayEveningWeekStart();

  const run = db.transaction(() => {
    fillMissingSlots(weekStart, todayIso);
    const pick = db.prepare(`
      SELECT id, slot, contact_id, reached_at
      FROM weekly_touch_picks
      WHERE week_start = ? AND contact_id = ?
    `).get(weekStart, id);
    if (!pick) return { error: 'That contact is not on this week’s list', status: 404 };
    if (pick.reached_at) {
      return { error: 'Reached contacts stay on the list until Sunday evening', status: 400 };
    }

    const currentIds = db.prepare(
      'SELECT contact_id FROM weekly_touch_picks WHERE week_start = ?',
    ).all(weekStart).map((r) => r.contact_id);
    const cooldown = cooldownContactIds(todayIso);
    const replacement = drawRandomIds([...new Set([...currentIds, ...cooldown])], 1)[0];
    if (replacement == null) {
      return { error: 'No other Closed clients are available to draw', status: 409 };
    }

    db.prepare(`
      UPDATE weekly_touch_picks
      SET contact_id = ?, reached_at = NULL, reached_by = NULL
      WHERE id = ?
    `).run(replacement, pick.id);
    return null;
  });

  const err = run();
  if (err) return err;
  return { list: getWeeklyTouchList() };
}

export function setWeeklyTouchReached(contactId, reached, userId) {
  const id = Number(contactId);
  if (!Number.isFinite(id)) {
    return { error: 'contactId is required', status: 400 };
  }
  const markReached = reached !== false && reached !== 0 && reached !== '0';

  const todayIso = chicagoDateISO();
  const weekStart = sundayEveningWeekStart();

  const run = db.transaction(() => {
    fillMissingSlots(weekStart, todayIso);
    const pick = db.prepare(`
      SELECT id, reached_at FROM weekly_touch_picks
      WHERE week_start = ? AND contact_id = ?
    `).get(weekStart, id);
    if (!pick) return { error: 'That contact is not on this week’s list', status: 404 };

    if (markReached) {
      db.prepare(`
        UPDATE weekly_touch_picks
        SET reached_at = CURRENT_TIMESTAMP, reached_by = ?
        WHERE id = ?
      `).run(userId, pick.id);
    } else {
      db.prepare(`
        UPDATE weekly_touch_picks
        SET reached_at = NULL, reached_by = NULL
        WHERE id = ?
      `).run(pick.id);
    }
    return null;
  });

  const err = run();
  if (err) return err;
  return { list: getWeeklyTouchList() };
}
