import { formatDate } from '../../utils/format';

/** Formatted calendar date that never wraps to a second line. */
export default function DateText({ value, className = '' }) {
  return (
    <span className={`whitespace-nowrap ${className}`.trim()}>
      {formatDate(value)}
    </span>
  );
}
