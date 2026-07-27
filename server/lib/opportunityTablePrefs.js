/** Opportunities table column prefs — defaults + normalize (server). */

export const BUYER_COLUMN_IDS = [
  'rep',
  'buyer_name',
  'status',
  'budget',
  'location',
  'timing',
  'notes',
  'preapproval',
];

export const SELLER_COLUMN_IDS = [
  'status',
  'property_address',
  'seller_name',
  'timing',
  'price_range',
  'neighborhood',
  'notes',
  'actions',
];

const BUYER_PINNED = new Set(['rep']);
const SELLER_PINNED = new Set(['actions']);

const BUYER_DEFAULT_WIDTHS = {
  rep: 48,
  buyer_name: 160,
  status: 120,
  budget: 100,
  location: 140,
  timing: 120,
  notes: 220,
  preapproval: 100,
};

const SELLER_DEFAULT_WIDTHS = {
  status: 110,
  property_address: 180,
  seller_name: 160,
  timing: 120,
  price_range: 120,
  neighborhood: 130,
  notes: 220,
  actions: 80,
};

const MIN_WIDTH = 80;

function idsFor(kind) {
  return kind === 'sellers' ? SELLER_COLUMN_IDS : BUYER_COLUMN_IDS;
}

function pinnedFor(kind) {
  return kind === 'sellers' ? SELLER_PINNED : BUYER_PINNED;
}

function defaultWidthsFor(kind) {
  return kind === 'sellers' ? SELLER_DEFAULT_WIDTHS : BUYER_DEFAULT_WIDTHS;
}

export function defaultOpportunityTablePrefs(kind) {
  const ids = idsFor(kind);
  return {
    columnOrder: [...ids],
    hidden: [],
    widths: { ...defaultWidthsFor(kind) },
    sortKey: null,
    sortDir: null,
  };
}

function enforcePinnedOrder(kind, order) {
  const pinned = pinnedFor(kind);
  const ids = idsFor(kind);
  const known = new Set(ids);
  const middle = order.filter((id) => known.has(id) && !pinned.has(id));
  const missing = ids.filter((id) => !pinned.has(id) && !middle.includes(id));
  const fullMiddle = [...middle, ...missing];
  if (kind === 'buyers') return ['rep', ...fullMiddle];
  return [...fullMiddle, 'actions'];
}

export function normalizeOpportunityTablePrefs(kind, raw) {
  const defaults = defaultOpportunityTablePrefs(kind);
  const pinned = pinnedFor(kind);
  const ids = idsFor(kind);
  const known = new Set(ids);
  const src = raw && typeof raw === 'object' ? raw : {};

  let columnOrder = Array.isArray(src.columnOrder)
    ? src.columnOrder.map(String).filter((id) => known.has(id))
    : [...defaults.columnOrder];
  columnOrder = enforcePinnedOrder(kind, columnOrder);

  const hiddenRaw = Array.isArray(src.hidden) ? src.hidden.map(String) : [];
  let hidden = hiddenRaw.filter((id) => known.has(id) && !pinned.has(id));

  const hideable = ids.filter((id) => !pinned.has(id));
  const visibleHideable = hideable.filter((id) => !hidden.includes(id));
  if (visibleHideable.length === 0 && hideable.length > 0) {
    // Keep at least one hideable column visible
    hidden = hidden.filter((id) => id !== hideable[0]);
  }

  const widths = { ...defaults.widths };
  if (src.widths && typeof src.widths === 'object') {
    for (const id of ids) {
      const n = Number(src.widths[id]);
      if (Number.isFinite(n)) {
        const floor = id === 'rep' ? 40 : MIN_WIDTH;
        widths[id] = Math.max(floor, Math.round(n));
      }
    }
  }

  let sortKey = src.sortKey != null && src.sortKey !== '' ? String(src.sortKey) : null;
  let sortDir = src.sortDir === 'asc' || src.sortDir === 'desc' ? src.sortDir : null;
  if (!sortKey || pinned.has(sortKey) || !known.has(sortKey) || hidden.includes(sortKey)) {
    sortKey = null;
    sortDir = null;
  }
  if (sortKey && !sortDir) sortDir = 'asc';

  return { columnOrder, hidden, widths, sortKey, sortDir };
}
