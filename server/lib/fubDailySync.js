/**
 * Daily FUB → CRM contacts sync (production).
 * Runs at 2:00 AM America/Chicago. Never touches vendors (delegates to sync script).
 *
 * Enable: NODE_ENV=production (default on) or FUB_DAILY_SYNC=1
 * Disable: FUB_DAILY_SYNC=0
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SYNC_SCRIPT = path.join(ROOT, 'server', 'scripts', 'sync-fub-contacts-api.js');
const TZ = 'America/Chicago';
const TARGET_HOUR = 2;
const TARGET_MINUTE = 0;
const CHECK_MS = 60 * 1000;

let running = false;
let lastStartedDay = null;

function chicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = Number(get('hour'));
  // Some engines emit "24" for midnight
  if (hour === 24) hour = 0;
  return {
    dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: Number(get('minute')),
  };
}

function stampPath() {
  const dataDir = process.env.DATABASE_PATH
    ? path.dirname(process.env.DATABASE_PATH)
    : ROOT;
  return path.join(dataDir, 'fub-sync-last-day.txt');
}

function readLastDay() {
  try {
    const raw = fs.readFileSync(stampPath(), 'utf8').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeLastDay(dayKey) {
  try {
    fs.writeFileSync(stampPath(), `${dayKey}\n`, 'utf8');
  } catch (err) {
    console.warn('[fub-sync] Could not write last-run stamp:', err.message);
  }
}

function shouldRunNow() {
  const { dayKey, hour, minute } = chicagoParts();
  const last = lastStartedDay || readLastDay();
  if (last === dayKey) return false;
  // Fire in the 2:00–2:09 window (covers check interval jitter)
  if (hour === TARGET_HOUR && minute >= TARGET_MINUTE && minute < TARGET_MINUTE + 10) {
    return true;
  }
  return false;
}

export function runFubSyncOnce(reason = 'manual') {
  if (running) {
    console.log(`[fub-sync] Already running — skip (${reason})`);
    return false;
  }
  if (!process.env.FUB_API_KEY?.trim()) {
    console.warn(`[fub-sync] FUB_API_KEY missing — skip (${reason})`);
    return false;
  }
  if (!fs.existsSync(SYNC_SCRIPT)) {
    console.error(`[fub-sync] Script missing: ${SYNC_SCRIPT}`);
    return false;
  }

  const { dayKey } = chicagoParts();
  running = true;
  lastStartedDay = dayKey;
  writeLastDay(dayKey);
  console.log(`[fub-sync] Starting (${reason}) day=${dayKey} TZ=${TZ}`);

  const child = spawn(process.execPath, [SYNC_SCRIPT], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  child.on('error', (err) => {
    running = false;
    console.error('[fub-sync] Failed to start:', err.message);
  });

  child.on('exit', (code, signal) => {
    running = false;
    if (code === 0) {
      console.log(`[fub-sync] Finished OK (${reason})`);
    } else {
      console.error(`[fub-sync] Exited code=${code} signal=${signal || 'none'} (${reason})`);
    }
  });

  return true;
}

export function startFubDailySyncScheduler() {
  const forcedOff = process.env.FUB_DAILY_SYNC === '0' || process.env.FUB_DAILY_SYNC === 'false';
  const forcedOn = process.env.FUB_DAILY_SYNC === '1' || process.env.FUB_DAILY_SYNC === 'true';
  const enabled = forcedOn || (process.env.NODE_ENV === 'production' && !forcedOff);

  if (!enabled) {
    console.log('[fub-sync] Daily scheduler off (set FUB_DAILY_SYNC=1 to enable in non-production)');
    return;
  }
  if (!process.env.FUB_API_KEY?.trim()) {
    console.warn('[fub-sync] Daily scheduler enabled but FUB_API_KEY is missing');
    return;
  }

  lastStartedDay = readLastDay();
  console.log(
    `[fub-sync] Daily scheduler on — ${TARGET_HOUR}:${String(TARGET_MINUTE).padStart(2, '0')} ${TZ}`
    + (lastStartedDay ? ` (last day=${lastStartedDay})` : ''),
  );

  const tick = () => {
    try {
      if (shouldRunNow()) runFubSyncOnce('scheduled');
    } catch (err) {
      console.error('[fub-sync] Scheduler tick error:', err.message || err);
    }
  };

  tick();
  setInterval(tick, CHECK_MS);
}
