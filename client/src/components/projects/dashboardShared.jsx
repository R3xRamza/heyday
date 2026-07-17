export const ADD_BUTTON_CLASS =
  'w-full border border-dashed border-outline-variant/40 rounded-xl py-2.5 text-center text-sm text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors shrink-0 min-h-[42px] flex items-center justify-center';

export const ADD_ROW_CLASS = 'mb-0 shrink-0 min-h-[42px]';

export const PROJECT_PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function normalizeProjectPriority(value) {
  const p = String(value || 'medium').toLowerCase();
  if (p === 'high' || p === 'low') return p;
  return 'medium';
}

/** Colored flag + label for project priority. */
export function ProjectPriorityBadge({ priority, className = '' }) {
  const p = normalizeProjectPriority(priority);
  const styles = {
    high: {
      wrap: 'bg-error/10 text-error border-error/20',
      flag: 'bg-error',
      label: 'High',
    },
    medium: {
      wrap: 'bg-lemon/40 text-feather border-lemon/50',
      flag: 'bg-secondary',
      label: 'Medium',
    },
    low: {
      wrap: 'bg-surface-container-high text-on-surface-variant border-outline-variant/25',
      flag: 'bg-on-surface-variant/50',
      label: 'Low',
    },
  }[p];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${styles.wrap} ${className}`}
    >
      <span className={`w-1.5 h-3 rounded-sm shrink-0 ${styles.flag}`} aria-hidden />
      {styles.label}
    </span>
  );
}
