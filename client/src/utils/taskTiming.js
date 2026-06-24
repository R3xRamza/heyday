/** Client mirror of server/lib/timing.js for deadline previews */

export const TIMING_ANCHORS = ['CLOSING', 'LISTING', 'ACCEPTANCE', 'OPTION END', 'EXPIRATION', 'CREATED'];

export const TIMELINE_KEY_TO_ANCHOR = {
  listing_date: 'LISTING',
  acceptance_date: 'ACCEPTANCE',
  option_end_date: 'OPTION END',
  close_date: 'CLOSING',
  important_date: 'EXPIRATION',
};

export function resolveAnchorDate(transaction, anchor) {
  if (!transaction) return null;
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

export function computeTaskDueDate(transaction, timingValue, timingDirection, timingAnchor) {
  if (!timingAnchor) return null;
  const anchorDate = resolveAnchorDate(transaction, timingAnchor);
  return computeDueDate(anchorDate, timingValue ?? 0, timingDirection || 'A');
}

export function formatTimingSummary({ timing_value, timing_direction, timing_anchor }) {
  if (!timing_anchor) return null;
  const when = timing_direction === 'B' ? 'before' : 'after';
  const days = Number(timing_value) || 0;
  const anchorLabel = timing_anchor.toLowerCase();
  if (days === 0) return `On ${anchorLabel}`;
  return `${days} day${days === 1 ? '' : 's'} ${when} ${anchorLabel}`;
}
