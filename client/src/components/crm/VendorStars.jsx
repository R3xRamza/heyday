import Icon from '../shared/Icon';

/** Display or interactive 1–5 star rating. Click same star again to clear when interactive. */
export default function VendorStars({
  rating = null,
  onChange,
  size = 'md',
  className = '',
}) {
  const interactive = typeof onChange === 'function';
  const value = rating == null ? 0 : Number(rating);
  const iconSize = size === 'sm' ? '!text-[16px]' : '!text-[22px]';

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} role={interactive ? 'group' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const star = (
          <Icon
            name="star"
            filled={filled}
            className={`${iconSize} ${filled ? 'text-secondary' : 'text-outline-variant/50'}`}
          />
        );

        if (!interactive) {
          return <span key={n} className="leading-none">{star}</span>;
        }

        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className="leading-none p-0.5 rounded hover:bg-secondary/10 transition-colors"
            aria-label={value === n ? `Clear rating (${n} stars)` : `Rate ${n} stars`}
            title={value === n ? 'Clear rating' : `${n} stars`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
