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

/** COUNT(*) query preserving FROM/WHERE of a SELECT (do not replace full multi-line SELECT). */
export function buildCountSql(selectSql) {
  const fromIdx = selectSql.search(/\bFROM\b/i);
  if (fromIdx === -1) throw new Error('Invalid select SQL for count');
  return `SELECT COUNT(*) as c ${selectSql.slice(fromIdx)}`;
}
