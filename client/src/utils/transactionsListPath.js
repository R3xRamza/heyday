export const TRANSACTIONS_LIST_VIEW_KEY = 'transactions-list-view-v1';

const DEFAULT_VIEW = {
  filter: 'active_transactions',
  page: 1,
  search: '',
  sortKey: 'date',
  sortDir: 'desc',
};

/** Build /transactions URL preserving list tab, pagination, search, and sort. */
export function transactionsListPath({
  filter = 'active_transactions',
  page,
  search,
  sortKey,
  sortDir,
} = {}) {
  const params = buildTransactionsListSearchParams({ filter, page, search, sortKey, sortDir });
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : '/transactions';
}

export function buildTransactionsListSearchParams({
  filter = 'active_transactions',
  page,
  search,
  sortKey,
  sortDir,
} = {}) {
  const params = new URLSearchParams();
  if (filter && filter !== 'active_transactions') {
    params.set('filter', filter);
  }
  if (page != null && Number(page) > 1) {
    params.set('page', String(page));
  }
  if (search?.trim()) {
    params.set('search', search.trim());
  }
  if (sortKey && sortKey !== 'date') {
    params.set('sort', sortKey);
  }
  if (sortDir && sortDir !== 'desc') {
    params.set('order', sortDir);
  }
  return params;
}

export function parseTransactionsListSearchParams(searchParams) {
  const filterParam = searchParams.get('filter');
  const resolvedFilter = filterParam === 'all_listings' ? 'coming_soon' : filterParam;
  const pageParam = parseInt(searchParams.get('page'), 10);
  return {
    filter: resolvedFilter || 'active_transactions',
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    search: searchParams.get('search') || '',
    sortKey: searchParams.get('sort') || 'date',
    sortDir: searchParams.get('order') === 'asc' ? 'asc' : 'desc',
  };
}

export function hasTransactionsListQuery(searchParams) {
  return ['filter', 'page', 'search', 'sort', 'order'].some((key) => searchParams.has(key));
}

export function readTransactionsListView() {
  try {
    const raw = sessionStorage.getItem(TRANSACTIONS_LIST_VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_VIEW, ...parsed };
  } catch {
    return null;
  }
}

export function writeTransactionsListView(view) {
  try {
    sessionStorage.setItem(
      TRANSACTIONS_LIST_VIEW_KEY,
      JSON.stringify({ ...DEFAULT_VIEW, ...view }),
    );
  } catch {
    // ignore
  }
}

export function resolveTransactionsListView(searchParams) {
  if (hasTransactionsListQuery(searchParams)) {
    return parseTransactionsListSearchParams(searchParams);
  }
  return readTransactionsListView() || DEFAULT_VIEW;
}
