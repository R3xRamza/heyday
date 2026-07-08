/** Build /transactions URL preserving list tab, pagination, search, and sort. */
export function transactionsListPath({
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
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : '/transactions';
}
