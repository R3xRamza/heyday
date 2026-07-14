export const AGENT_SCOPE_STORAGE_KEY = 'heyday-agent-scope-v1';

/** Default scope is Meredith; all three options are shown in the Team Hub toggle. */
export const VISIBLE_SCOPE_OPTIONS = [
  { value: 'meredith', code: 'M', label: 'Meredith' },
  { value: 'all', code: 'A', label: 'All' },
  { value: 'tessa', code: 'T', label: 'Tessa' },
];

const SCOPE_CODES = {
  meredith: 'M',
  all: 'A',
  tessa: 'T',
};

export function normalizeScope(value) {
  if (!value || value === 'meredith' || value === 'M') return 'meredith';
  if (value === 'tessa' || value === 'T') return 'tessa';
  if (value === 'all' || value === 'A') return 'all';
  return 'meredith';
}

export function scopeQueryParam(scope) {
  return SCOPE_CODES[normalizeScope(scope)] ?? 'M';
}

export function scopeBadgeLabel(scope) {
  const normalized = normalizeScope(scope);
  // Meredith is the default — no TopNav badge when selected.
  if (normalized === 'meredith') return null;
  return VISIBLE_SCOPE_OPTIONS.find((o) => o.value === normalized)?.label ?? null;
}

export function appendAgentScope(input, scope) {
  const code = scopeQueryParam(scope);
  if (input instanceof URLSearchParams) {
    input.set('agent_scope', code);
    return input;
  }
  const str = String(input);
  const sep = str.includes('?') ? '&' : '?';
  return `${str}${sep}agent_scope=${encodeURIComponent(code)}`;
}
