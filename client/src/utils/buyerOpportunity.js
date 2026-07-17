/** Canonical buyer opportunity status + preapproval helpers (client). */

export const BUYER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'under_contract', label: 'Under contract' },
  { value: 'option_period', label: 'Option period' },
  { value: 'closed', label: 'Closed' },
  { value: 'on_hold', label: 'On hold' },
];

export const BUYER_PREAPPROVALS = [
  { value: 'y', label: 'Y' },
  { value: 'n', label: 'N' },
  { value: 'cash', label: 'Cash' },
];

const CANONICAL_STATUS = new Set(BUYER_STATUSES.map((s) => s.value));
const CANONICAL_PRE = new Set(BUYER_PREAPPROVALS.map((s) => s.value));

export function buyerStatusLabel(value) {
  const v = normalizeBuyerStatus(value);
  return BUYER_STATUSES.find((s) => s.value === v)?.label || 'Active';
}

export function normalizeBuyerStatus(raw) {
  if (raw == null || raw === '') return 'active';
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_STATUS.has(lower)) return lower;
  if (lower.includes('under contract')) return 'under_contract';
  if (lower.includes('leaseback')) return 'under_contract';
  if (lower.includes('option')) return 'option_period';
  if (/\bclosed\b/.test(lower) || lower === 'close') return 'closed';
  if (lower.includes('on hold') || lower.includes('paused') || lower.includes('unresponsive')) {
    return 'on_hold';
  }
  if (/(^|\s)hold(\s|$)/.test(lower)) return 'on_hold';
  if (lower.includes('tour')) return 'option_period';
  if (lower.includes('active')) return 'active';
  return 'active';
}

export function normalizePreapproval(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_PRE.has(lower)) return lower;
  if (lower.includes('cash')) return 'cash';
  if (/^(y|yes)\b/.test(lower) || lower === 'y' || lower.startsWith('yes')) return 'y';
  if (/^(n|no)\b/.test(lower) || lower === 'n' || lower === 'x' || lower.includes('not yet') || lower.startsWith('no')) {
    return 'n';
  }
  // Unknown freeform — empty select until user picks (caller may show placeholder)
  return '';
}

export function preapprovalLabel(value) {
  const v = normalizePreapproval(value);
  if (v === 'y') return 'Y';
  if (v === 'n') return 'N';
  if (v === 'cash') return 'Cash';
  return '—';
}

/** Parse a date from buyer_rep_signed strings like "Y- 9/30/2026", "Y - 11/30/26". */
export function parseRepExpiryDate(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  const d = new Date(year, month, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function isDropboxYes(raw) {
  if (!raw) return false;
  const lower = String(raw).trim().toLowerCase();
  if (!lower || lower === 'n' || lower === 'no' || lower === '?' || lower === 'x') return false;
  if (lower === 'y' || lower === 'yes' || lower.startsWith('y')) return true;
  return false;
}

/**
 * @returns {'ok'|'soon'|'expired'|'missing'}
 */
export function repExpiryTone(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'missing';
  const lower = s.toLowerCase();
  const looksNo = lower === 'n' || lower === 'no' || lower.startsWith('n-') || lower.startsWith('n ');
  if (looksNo && !parseRepExpiryDate(s)) return 'missing';

  const d = parseRepExpiryDate(s);
  if (!d) {
    // Signed yes-ish without date
    if (/^y\b/i.test(s) || lower.includes('yes') || lower.includes('signed')) return 'ok';
    return 'missing';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end - today) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return 'ok';
}
