/** Admin task recurrence helpers. */

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'every_day', label: 'Every day' },
  { value: 'every_week', label: 'Every week' },
  { value: 'every_month', label: 'Every month' },
];

const VALID = new Set(['every_day', 'every_week', 'every_month']);

export function parseRecurrence(value) {
  if (value == null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  return VALID.has(v) ? v : null;
}

export function recurrenceLabel(value) {
  const v = parseRecurrence(value);
  if (!v) return null;
  return RECURRENCE_OPTIONS.find((o) => o.value === v)?.label || null;
}

/** Advance YYYY-MM-DD (or today if null) by recurrence. Returns YYYY-MM-DD. */
export function advanceDueDate(dueDate, recurrence, fromDate = new Date()) {
  const rec = parseRecurrence(recurrence);
  if (!rec) return null;

  let base;
  if (dueDate && /^\d{4}-\d{2}-\d{2}/.test(String(dueDate))) {
    const [y, m, d] = String(dueDate).slice(0, 10).split('-').map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  }

  if (rec === 'every_day') {
    base.setDate(base.getDate() + 1);
  } else if (rec === 'every_week') {
    base.setDate(base.getDate() + 7);
  } else if (rec === 'every_month') {
    const day = base.getDate();
    base.setMonth(base.getMonth() + 1);
    // Clamp if month shorter (e.g. Jan 31 → Feb 28)
    if (base.getDate() < day) {
      base.setDate(0);
    }
  }

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
