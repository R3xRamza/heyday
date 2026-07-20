import Icon from '../shared/Icon';

/** Like count display / toggle button. */
export default function VendorLikeButton({
  count = 0,
  liked = false,
  onToggle,
  size = 'sm',
  className = '',
}) {
  const interactive = typeof onToggle === 'function';
  const iconSize = size === 'md' ? '!text-[22px]' : '!text-[18px]';
  const label = count === 1 ? '1 like' : `${count} likes`;

  const inner = (
    <>
      <Icon
        name="thumb_up"
        filled={liked}
        className={`${iconSize} ${liked ? 'text-secondary' : 'text-outline-variant'}`}
      />
      <span className={`tabular-nums ${liked ? 'text-secondary font-semibold' : 'text-on-surface-variant'}`}>
        {count}
      </span>
    </>
  );

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`} title={label}>
        {inner}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
        liked
          ? 'bg-secondary/10 hover:bg-secondary/15'
          : 'hover:bg-surface-container-low'
      } ${className}`}
      aria-pressed={liked}
      aria-label={liked ? `Unlike (${label})` : `Like (${label})`}
      title={liked ? 'Unlike' : 'Like'}
    >
      {inner}
    </button>
  );
}
