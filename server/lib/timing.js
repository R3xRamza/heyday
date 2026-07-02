export function resolveAnchorDate(transaction, anchor) {
  switch (anchor) {
    case 'CLOSING':
      return transaction.close_date || transaction.important_date;
    case 'LISTING':
      return transaction.listing_date || transaction.important_date;
    case 'ACCEPTANCE':
      return transaction.acceptance_date || transaction.important_date;
    case 'OPTION END':
      return transaction.option_end_date || transaction.acceptance_date || transaction.important_date;
    case 'EXPIRATION':
      return transaction.important_date;
    case 'CREATED':
      return transaction.created_at?.slice(0, 10) || transaction.listing_date;
    default:
      return transaction.close_date || transaction.important_date;
  }
}

export function computeDueDate(anchorDate, value, direction) {
  if (!anchorDate) return null;
  const base = new Date(`${anchorDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const offset = direction === 'B' ? -Number(value) : Number(value);
  base.setDate(base.getDate() + offset);
  return base.toISOString().slice(0, 10);
}

export function isOverdue(dueDate, status) {
  if (!dueDate || status === 'complete') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${dueDate}T12:00:00`) < today;
}

/** Sun–Sat week containing refDate (default today). */
export function weekRangeSunday(refDate = new Date()) {
  const start = new Date(refDate);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Open task due within the current Sun–Sat week (excludes overdue). */
export function isDueThisWeek(dueDate, status, refDate = new Date()) {
  if (!dueDate || status === 'complete' || isOverdue(dueDate, status)) return false;
  const { start, end } = weekRangeSunday(refDate);
  return dueDate >= start && dueDate <= end;
}
