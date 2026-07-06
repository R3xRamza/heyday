export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 50;

export function parsePagination(query, defaultLimit = DEFAULT_PAGE_SIZE) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function wantsPagination(query) {
  return query.page != null || query.limit != null;
}
