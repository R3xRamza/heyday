/**
 * Opportunities desktop table prefs — column defs, normalize, sort, mutations.
 */

import {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  BUYER_TIMINGS,
  buyerStatusLabel,
  buyerTimingLabel,
  formatBuyerPrice,
  normalizeBuyerStatus,
  normalizeBuyerTiming,
  normalizePreapproval,
} from './buyerOpportunity';

export const MIN_COLUMN_WIDTH = 80;

export const BUYER_COLUMNS = [
  { id: 'rep', label: 'Rep', pinned: 'start', sortable: false, defaultWidth: 48 },
  { id: 'buyer_name', label: 'Buyers', pinned: null, sortable: true, defaultWidth: 160 },
  { id: 'status', label: 'Status', pinned: null, sortable: true, defaultWidth: 120 },
  { id: 'budget', label: 'Budget', pinned: null, sortable: true, defaultWidth: 100 },
  { id: 'location', label: 'Location', pinned: null, sortable: true, defaultWidth: 140 },
  { id: 'timing', label: 'Timing', pinned: null, sortable: true, defaultWidth: 120 },
  { id: 'notes', label: 'Notes', pinned: null, sortable: true, defaultWidth: 220 },
  { id: 'preapproval', label: 'Pre approved', pinned: null, sortable: true, defaultWidth: 100 },
];

export const SELLER_COLUMNS = [
  { id: 'status', label: 'Status', pinned: null, sortable: true, defaultWidth: 110 },
  { id: 'property_address', label: 'Address', pinned: null, sortable: true, defaultWidth: 180 },
  { id: 'seller_name', label: 'Seller', pinned: null, sortable: true, defaultWidth: 160 },
  { id: 'timing', label: 'Timing', pinned: null, sortable: true, defaultWidth: 120 },
  { id: 'price_range', label: 'Price Range', pinned: null, sortable: true, defaultWidth: 120 },
  { id: 'neighborhood', label: 'Neighborhood', pinned: null, sortable: true, defaultWidth: 130 },
  { id: 'notes', label: 'Notes', pinned: null, sortable: true, defaultWidth: 220 },
  { id: 'actions', label: 'Actions', pinned: 'end', sortable: false, defaultWidth: 80 },
];

export function columnsForKind(kind) {
  return kind === 'sellers' ? SELLER_COLUMNS : BUYER_COLUMNS;
}

function pinnedIds(kind) {
  return new Set(
    columnsForKind(kind).filter((c) => c.pinned).map((c) => c.id),
  );
}

export function defaultOpportunityTablePrefs(kind) {
  const cols = columnsForKind(kind);
  return {
    columnOrder: cols.map((c) => c.id),
    hidden: [],
    widths: Object.fromEntries(cols.map((c) => [c.id, c.defaultWidth])),
    sortKey: null,
    sortDir: null,
  };
}

function enforcePinnedOrder(kind, order) {
  const cols = columnsForKind(kind);
  const known = new Set(cols.map((c) => c.id));
  const pinned = pinnedIds(kind);
  const middle = order.filter((id) => known.has(id) && !pinned.has(id));
  const missing = cols
    .filter((c) => !c.pinned && !middle.includes(c.id))
    .map((c) => c.id);
  const fullMiddle = [...middle, ...missing];
  if (kind === 'buyers') return ['rep', ...fullMiddle];
  return [...fullMiddle, 'actions'];
}

export function normalizeOpportunityTablePrefs(kind, raw) {
  const defaults = defaultOpportunityTablePrefs(kind);
  const cols = columnsForKind(kind);
  const known = new Set(cols.map((c) => c.id));
  const pinned = pinnedIds(kind);
  const src = raw && typeof raw === 'object' ? raw : {};

  let columnOrder = Array.isArray(src.columnOrder)
    ? src.columnOrder.map(String).filter((id) => known.has(id))
    : [...defaults.columnOrder];
  columnOrder = enforcePinnedOrder(kind, columnOrder);

  const hideable = cols.filter((c) => !c.pinned).map((c) => c.id);
  let hidden = (Array.isArray(src.hidden) ? src.hidden.map(String) : [])
    .filter((id) => known.has(id) && !pinned.has(id));
  const visibleHideable = hideable.filter((id) => !hidden.includes(id));
  if (visibleHideable.length === 0 && hideable.length > 0) {
    hidden = hidden.filter((id) => id !== hideable[0]);
  }

  const widths = { ...defaults.widths };
  if (src.widths && typeof src.widths === 'object') {
    for (const c of cols) {
      const n = Number(src.widths[c.id]);
      if (Number.isFinite(n)) {
        const floor = c.id === 'rep' ? 40 : MIN_COLUMN_WIDTH;
        widths[c.id] = Math.max(floor, Math.round(n));
      }
    }
  }

  let sortKey = src.sortKey != null && src.sortKey !== '' ? String(src.sortKey) : null;
  let sortDir = src.sortDir === 'asc' || src.sortDir === 'desc' ? src.sortDir : null;
  const sortCol = cols.find((c) => c.id === sortKey);
  if (!sortCol?.sortable || hidden.includes(sortKey)) {
    sortKey = null;
    sortDir = null;
  }
  if (sortKey && !sortDir) sortDir = 'asc';

  return { columnOrder, hidden, widths, sortKey, sortDir };
}

export function visibleColumnDefs(kind, prefs) {
  const byId = Object.fromEntries(columnsForKind(kind).map((c) => [c.id, c]));
  const p = normalizeOpportunityTablePrefs(kind, prefs);
  return p.columnOrder
    .filter((id) => !p.hidden.includes(id))
    .map((id) => byId[id])
    .filter(Boolean);
}

export function cycleSort(prefs, columnId, kind) {
  const col = columnsForKind(kind).find((c) => c.id === columnId);
  if (!col?.sortable) return prefs;
  const next = { ...prefs };
  if (prefs.sortKey !== columnId) {
    next.sortKey = columnId;
    next.sortDir = 'asc';
  } else if (prefs.sortDir === 'asc') {
    next.sortDir = 'desc';
  } else {
    next.sortKey = null;
    next.sortDir = null;
  }
  return normalizeOpportunityTablePrefs(kind, next);
}

export function toggleColumnHidden(prefs, columnId, kind) {
  const col = columnsForKind(kind).find((c) => c.id === columnId);
  if (!col || col.pinned) return prefs;
  const hidden = new Set(prefs.hidden || []);
  if (hidden.has(columnId)) {
    hidden.delete(columnId);
  } else {
    const hideable = columnsForKind(kind).filter((c) => !c.pinned).map((c) => c.id);
    const wouldRemain = hideable.filter((id) => id !== columnId && !hidden.has(id));
    if (wouldRemain.length === 0) return prefs;
    hidden.add(columnId);
  }
  return normalizeOpportunityTablePrefs(kind, {
    ...prefs,
    hidden: [...hidden],
    sortKey: hidden.has(prefs.sortKey) ? null : prefs.sortKey,
    sortDir: hidden.has(prefs.sortKey) ? null : prefs.sortDir,
  });
}

/** Move draggedId to sit before targetId within hideable middle (pinned fixed). */
export function reorderColumn(prefs, draggedId, targetId, kind) {
  if (draggedId === targetId) return prefs;
  const pinned = pinnedIds(kind);
  if (pinned.has(draggedId) || pinned.has(targetId)) return prefs;
  const order = [...prefs.columnOrder];
  const from = order.indexOf(draggedId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) return prefs;
  order.splice(from, 1);
  const insertAt = order.indexOf(targetId);
  order.splice(insertAt, 0, draggedId);
  return normalizeOpportunityTablePrefs(kind, { ...prefs, columnOrder: order });
}

export function setColumnWidth(prefs, columnId, widthPx, kind) {
  const col = columnsForKind(kind).find((c) => c.id === columnId);
  if (!col) return prefs;
  const floor = columnId === 'rep' ? 40 : MIN_COLUMN_WIDTH;
  return normalizeOpportunityTablePrefs(kind, {
    ...prefs,
    widths: {
      ...prefs.widths,
      [columnId]: Math.max(floor, Math.round(widthPx)),
    },
  });
}

function cmpEmptyLast(a, b, dir) {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const mul = dir === 'desc' ? -1 : 1;
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mul;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }) * mul;
}

function buyerSortValue(row, key) {
  switch (key) {
    case 'buyer_name':
      return row.buyer_name || '';
    case 'status':
      return buyerStatusLabel(row.status);
    case 'budget': {
      const min = row.price_min != null ? Number(row.price_min) : null;
      const max = row.price_max != null ? Number(row.price_max) : null;
      if (Number.isFinite(min)) return min;
      if (Number.isFinite(max)) return max;
      const label = formatBuyerPrice(row);
      return label === '—' ? '' : label;
    }
    case 'location':
      return row.location || '';
    case 'timing':
      return buyerTimingLabel(row.timing);
    case 'notes':
      return row.notes || '';
    case 'preapproval': {
      const v = normalizePreapproval(row.preapproval);
      return BUYER_PREAPPROVALS.find((s) => s.value === v)?.label || v || '';
    }
    default:
      return '';
  }
}

function sellerSortValue(row, key) {
  switch (key) {
    case 'status':
      return row.status || '';
    case 'property_address':
      return row.property_address || '';
    case 'seller_name':
      return row.seller_name || '';
    case 'timing':
      return row.timing || '';
    case 'price_range':
      return row.price_range || '';
    case 'neighborhood':
      return row.neighborhood || '';
    case 'notes':
      return row.notes || '';
    default:
      return '';
  }
}

export function sortOpportunityRows(kind, rows, sortKey, sortDir) {
  if (!sortKey || !sortDir || !Array.isArray(rows)) return rows;
  const getter = kind === 'sellers' ? sellerSortValue : buyerSortValue;
  return [...rows].sort((a, b) => cmpEmptyLast(getter(a, sortKey), getter(b, sortKey), sortDir));
}

// Re-export labels helpers used by tables (keep imports local to this module tidy)
export {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  BUYER_TIMINGS,
  formatBuyerPrice,
  normalizeBuyerStatus,
  normalizeBuyerTiming,
  normalizePreapproval,
};
