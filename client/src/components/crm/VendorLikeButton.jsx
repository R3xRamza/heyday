import Icon from '../shared/Icon';

/** Like or dislike count / add button. */
export default function VendorLikeButton({
  count = 0,
  active = false,
  kind = 'like',
  onToggle,
  size = 'sm',
  className = '',
}) {
  const interactive = typeof onToggle === 'function';
  const iconSize = size === 'md' ? '!text-[22px]' : '!text-[18px]';
  const isDislike = kind === 'dislike';
  const icon = isDislike ? 'thumb_down' : 'thumb_up';
  const noun = isDislike ? 'dislike' : 'like';
  const label = count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
  const activeColor = isDislike ? 'text-error' : 'text-secondary';
  const activeBg = isDislike ? 'bg-error/10 hover:bg-error/15' : 'bg-secondary/10 hover:bg-secondary/15';

  const inner = (
    <>
      <Icon
        name={icon}
        filled={active}
        className={`${iconSize} ${active ? activeColor : 'text-outline-variant'}`}
      />
      <span className={`tabular-nums ${active ? `${activeColor} font-semibold` : 'text-on-surface-variant'}`}>
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
        active ? activeBg : 'hover:bg-surface-container-low'
      } ${className}`}
      aria-label={`Add ${noun} (${label})`}
      title={`Add ${noun}`}
    >
      {inner}
    </button>
  );
}
