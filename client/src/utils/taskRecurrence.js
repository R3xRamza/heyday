/** Admin task recurrence (client). */

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'every_day', label: 'Every day' },
  { value: 'every_week', label: 'Every week' },
  { value: 'every_month', label: 'Every month' },
];

export function recurrenceLabel(value) {
  if (!value) return null;
  return RECURRENCE_OPTIONS.find((o) => o.value === value)?.label || null;
}
