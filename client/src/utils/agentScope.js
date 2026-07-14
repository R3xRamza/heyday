export const AGENT_SCOPE_STORAGE_KEY = 'heyday-agent-scope-v1';

/** Default scope is Meredith. */
export const VISIBLE_SCOPE_OPTIONS = [
  { value: 'meredith', code: 'M', label: 'Meredith' },
  { value: 'margaret', code: 'G', label: 'Margaret' },
  { value: 'adam', code: 'D', label: 'Adam' },
  { value: 'tessa', code: 'T', label: 'Tessa' },
  { value: 'all', code: 'A', label: 'All' },
];

const SCOPE_CODES = {
  meredith: 'M',
  margaret: 'G',
  adam: 'D',
  tessa: 'T',
  all: 'A',
};

export function normalizeScope(value) {
  if (!value || value === 'meredith' || value === 'M') return 'meredith';
  if (value === 'margaret' || value === 'G') return 'margaret';
  if (value === 'adam' || value === 'D') return 'adam';
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
