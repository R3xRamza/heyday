/** Canonical buyer opportunity helpers (client). */

export const BUYER_STATUSES = [
  { value: 'under_contract', label: 'Under contract' },
  { value: 'option_period', label: 'Option period' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'closed', label: 'Closed' },
];

export const BUYER_TIMINGS = [
  { value: 'asap', label: 'ASAP' },
  { value: 'near_term', label: '1–3 months' },
  { value: 'mid_term', label: '3–6 months' },
  { value: 'long_term', label: '6–12 months' },
  { value: 'flexible', label: 'Flexible' },
  { value: 'casual', label: 'Casual' },
  { value: 'lease_driven', label: 'Lease / deadline' },
  { value: 'on_hold', label: 'On hold' },
];

export const BUYER_PREAPPROVALS = [
  { value: 'y', label: 'Y' },
  { value: 'n', label: 'N' },
  { value: 'cash', label: 'Cash' },
];

const CANONICAL_STATUS = new Set(BUYER_STATUSES.map((s) => s.value));
const CANONICAL_TIMING = new Set(BUYER_TIMINGS.map((s) => s.value));
const CANONICAL_PRE = new Set(BUYER_PREAPPROVALS.map((s) => s.value));

export function buyerStatusLabel(value) {
  const v = normalizeBuyerStatus(value);
  return BUYER_STATUSES.find((s) => s.value === v)?.label || 'Active';
}

export function buyerTimingLabel(value) {
  if (value == null || String(value).trim() === '') return '—';
  const v = normalizeBuyerTiming(value);
  return BUYER_TIMINGS.find((s) => s.value === v)?.label || String(value).trim();
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

export function normalizeBuyerTiming(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_TIMING.has(lower)) return lower;
  if (lower === '?' || lower === 'x') return 'flexible';
  if (lower.includes('asap')) return 'asap';
  if (lower.includes('on hold') || lower === 'hold') return 'on_hold';
  if (lower.includes('lease') || lower.includes('deadline') || lower.includes('must have') || lower.includes('before')) {
    return 'lease_driven';
  }
  if (lower.includes('casual')) return 'casual';
  if (
    lower.includes('flexible')
    || lower.includes('not in a hurry')
    || lower.includes('not in a rush')
    || lower.includes('whenever')
    || lower.includes('right thing')
    || lower.includes('send as we see')
    || lower.includes('hot & cold')
    || lower.includes('hot and cold')
  ) {
    return 'flexible';
  }
  if (lower.includes('summer') || lower.includes('this month') || /\b\d{1,2}\/\d{1,2}/.test(lower)) {
    return 'near_term';
  }
  if (lower.includes('2026') || lower.includes('2027') || lower.includes('closes')) {
    return 'mid_term';
  }
  if (lower.includes('year') || lower.includes('12 month')) return 'long_term';
  return 'flexible';
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
  return '';
}

export function preapprovalLabel(value) {
  const v = normalizePreapproval(value);
  if (v === 'y') return 'Y';
  if (v === 'n') return 'N';
  if (v === 'cash') return 'Cash';
  return '—';
}

/** Parse one amount token: "1.2M", "900k", "2.7", "800", "1200000". */
export function parsePriceAmount(token) {
  if (token == null) return null;
  let s = String(token).trim().toLowerCase().replace(/[$,]/g, '');
  if (!s || s === '?' || s === 'x') return null;
  s = s.replace(/or less|max|upto|up to|under|about|approx|~|each/g, '').trim();
  s = s.replace(/million/g, 'm').replace(/thousand/g, 'k');

  const m = s.match(/^([<>]=?)?\s*(\d+(?:\.\d+)?)\s*([km])?$/i);
  if (!m) {
    const loose = s.match(/(\d+(?:\.\d+)?)\s*([km])?/i);
    if (!loose) return null;
    return scalePriceNumber(Number(loose[1]), loose[2]);
  }
  return scalePriceNumber(Number(m[2]), m[3]);
}

function scalePriceNumber(n, suffix) {
  if (n == null || Number.isNaN(n)) return null;
  const suf = (suffix || '').toLowerCase();
  if (suf === 'm') return Math.round(n * 1_000_000);
  if (suf === 'k') return Math.round(n * 1_000);
  // Bare numbers: < 20 → millions; 20–9999 → thousands; else dollars
  if (n > 0 && n < 20) return Math.round(n * 1_000_000);
  if (n >= 20 && n < 10000) return Math.round(n * 1_000);
  return Math.round(n);
}

/**
 * Parse freeform price text into { min, max }.
 * Examples: "2.7", ">1.3M", "900-", "2.5M - 3.5M", "Up to $5M", "$450-500K"
 */
export function parseBuyerPriceText(raw) {
  if (raw == null || String(raw).trim() === '') return { min: null, max: null };
  const original = String(raw).trim();
  const lower = original.toLowerCase();
  if (lower === '?' || lower === 'x') return { min: null, max: null };

  const upTo = /^(up to|under|max|or less)/i.test(lower)
    || /\b(or less|max)\b/i.test(lower)
    || lower.startsWith('<');
  const atLeast = lower.startsWith('>') || lower.startsWith('≥') || /\bmin\b/i.test(lower);

  // Split ranges on – — - or "to"
  const rangeParts = original.split(/\s*(?:–|—|to)\s*|\s+-\s*|(?<=\d)\s*-\s*(?=\d)/i);
  if (rangeParts.length >= 2) {
    const a = parsePriceAmount(rangeParts[0].replace(/^[<>]=?\s*/, ''));
    const b = parsePriceAmount(rangeParts[1]);
    if (a != null && b != null) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    if (a != null && b == null) return { min: a, max: null };
    if (a == null && b != null) return { min: null, max: b };
  }

  // Trailing dash like "900-" → min only
  if (/[-\u2013\u2014]\s*$/.test(original)) {
    const min = parsePriceAmount(original.replace(/[-\u2013\u2014]\s*$/, '').replace(/^[<>]=?\s*/, ''));
    return { min, max: null };
  }

  const amount = parsePriceAmount(original.replace(/^[<>]=?\s*/, ''));
  if (amount == null) return { min: null, max: null };
  if (upTo) return { min: null, max: amount };
  if (atLeast) return { min: amount, max: null };
  return { min: amount, max: amount };
}

export function formatCompactDollars(n) {
  if (n == null || Number.isNaN(Number(n))) return '';
  const v = Number(n);
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const s = m % 1 === 0 ? String(m) : m.toFixed(1).replace(/\.0$/, '');
    return `$${s}M`;
  }
  if (v >= 1_000) {
    const k = v / 1_000;
    const s = k % 1 === 0 ? String(k) : k.toFixed(1).replace(/\.0$/, '');
    return `$${s}K`;
  }
  return `$${Math.round(v).toLocaleString()}`;
}

/** Display price from min/max (falls back to legacy price text). */
export function formatBuyerPrice(rowOrMin, maybeMax) {
  let min;
  let max;
  let legacy;
  if (rowOrMin != null && typeof rowOrMin === 'object') {
    min = rowOrMin.price_min;
    max = rowOrMin.price_max;
    legacy = rowOrMin.price;
  } else {
    min = rowOrMin;
    max = maybeMax;
  }
  const hasMin = min != null && min !== '' && !Number.isNaN(Number(min));
  const hasMax = max != null && max !== '' && !Number.isNaN(Number(max));
  if (hasMin && hasMax) {
    const a = Number(min);
    const b = Number(max);
    if (a === b) return formatCompactDollars(a);
    return `${formatCompactDollars(Math.min(a, b))}–${formatCompactDollars(Math.max(a, b))}`;
  }
  if (hasMin && !hasMax) return `${formatCompactDollars(Number(min))}+`;
  if (!hasMin && hasMax) return `Up to ${formatCompactDollars(Number(max))}`;
  if (legacy) return String(legacy);
  return '—';
}

/** Sync display `price` text from numeric bounds. */
export function priceDisplayFromBounds(min, max) {
  const label = formatBuyerPrice(min, max);
  return label === '—' ? null : label;
}

export function resolveBuyerPriceFields({ price_min, price_max, price }) {
  const hasMin = price_min !== undefined && price_min !== null && price_min !== '';
  const hasMax = price_max !== undefined && price_max !== null && price_max !== '';
  if (hasMin || hasMax) {
    let min = hasMin ? Number(price_min) : null;
    let max = hasMax ? Number(price_max) : null;
    if (min != null && Number.isNaN(min)) min = null;
    if (max != null && Number.isNaN(max)) max = null;
    if (min != null && max != null && min > max) {
      const t = min;
      min = max;
      max = t;
    }
    return {
      price_min: min,
      price_max: max,
      price: priceDisplayFromBounds(min, max),
    };
  }
  if (price != null && String(price).trim() !== '') {
    const parsed = parseBuyerPriceText(price);
    return {
      price_min: parsed.min,
      price_max: parsed.max,
      price: priceDisplayFromBounds(parsed.min, parsed.max) || String(price).trim(),
    };
  }
  return { price_min: null, price_max: null, price: null };
}

/** Parse a date from buyer_rep_signed strings like "Y- 9/30/2026". */
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
