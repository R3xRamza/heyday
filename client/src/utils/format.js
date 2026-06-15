export function formatCurrency(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

/** Display/edit sales price with thousand separators (e.g. 1,000). */
export function formatPriceInput(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) {
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(digits));
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

export function parsePriceInput(str) {
  if (str == null || str === '') return null;
  const cleaned = String(str).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : Math.round(n);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Human-readable due label; always includes the calendar date when one exists. */
export function formatTaskDue(dueDate, status, isOverdue) {
  if (status === 'complete') return 'Completed';
  if (!dueDate) return '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T12:00:00`);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return formatDate(dueDate);
}

/** Format city, state, zip for display (supports legacy combined `city`). */
export function formatLocationLine({ city, state, zip } = {}) {
  const c = city?.trim();
  const s = state?.trim()?.toUpperCase();
  const z = zip?.trim();
  if (!c && !s && !z) return '';
  if (c && s && z) return `${c}, ${s} ${z}`;
  if (c && s) return `${c}, ${s}`;
  return [c, s, z].filter(Boolean).join(', ');
}

/** Street + location line from transaction address fields. */
export function parseTransactionAddress({ address, city, state, zip } = {}) {
  const street = address?.trim() || '';
  let cityLine = formatLocationLine({ city, state, zip });

  if (!cityLine && city?.trim()) {
    cityLine = city.trim();
  }

  if (!cityLine && street.includes(',')) {
    const comma = street.indexOf(',');
    return {
      street: street.slice(0, comma).trim(),
      cityLine: street.slice(comma + 1).trim(),
    };
  }

  return { street, cityLine };
}

export function shortAddress(address) {
  if (!address) return '—';
  return parseTransactionAddress({ address }).street || '—';
}
