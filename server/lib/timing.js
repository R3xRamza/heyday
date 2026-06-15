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
