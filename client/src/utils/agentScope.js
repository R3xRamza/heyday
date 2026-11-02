export const AGENT_SCOPE_STORAGE_KEY = 'heyday-agent-scope-v1';

/** Default scope is Meredith. Toggle order: All, Meredith, Tessa, Margaret, Adam. */
export const VISIBLE_SCOPE_OPTIONS = [
  { value: 'all', code: 'A', label: 'All', initials: 'All' },
  { value: 'meredith', code: 'M', label: 'Meredith', initials: 'MA' },
  { value: 'tessa', code: 'T', label: 'Tessa', initials: 'TO' },
  { value: 'margaret', code: 'G', label: 'Margaret', initials: 'MM' },
  { value: 'adam', code: 'D', label: 'Adam', initials: 'AW' },
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
  const opt = VISIBLE_SCOPE_OPTIONS.find((o) => o.value === normalized);
  return opt?.label ?? null;
}

export function scopeInitials(scope) {
  const normalized = normalizeScope(scope);
  return VISIBLE_SCOPE_OPTIONS.find((o) => o.value === normalized)?.initials ?? 'MA';
}

const INITIALS_BY_EMAIL = {
  'meredith@theheydaygroup.com': 'MA',
  'tessa@theheydaygroup.com': 'TO',
  'margaret@theheydaygroup.com': 'MM',
  'adam@theheydaygroup.com': 'AW',
};

/** Two-letter initials. Known teammates match the header scope chips. */
export function memberInitials(member) {
  const known = INITIALS_BY_EMAIL[String(member?.email || '').toLowerCase()];
  if (known) return known;
  const parts = String(member?.name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
