import Icon from '../shared/Icon';

const CHECKBOXES = [
  { key: 'tasks', label: 'Transaction Tasks' },
  { key: 'celebrations', label: 'Client Milestones' },
  { key: 'social', label: 'Social Media' },
];

export default function MarketingFilterBar({
  categories,
  onToggleCategory,
  periodLabel,
  onPrev,
  onNext,
  onToday,
}) {
  return (
    <div className="bg-white border border-outline-variant/15 rounded-xl px-4 py-2.5 mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex flex-wrap items-center gap-4">
        {CHECKBOXES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(categories[key])}
              onChange={() => onToggleCategory(key)}
              className="w-4 h-4 rounded border-outline-variant/40 text-feather focus:ring-feather/30"
            />
            <span className="text-sm text-feather font-medium">{label}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToday}
          className="mr-2 text-xs font-semibold text-secondary hover:underline"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onPrev}
          className="p-1.5 rounded hover:bg-off-white text-feather"
          aria-label="Previous"
        >
          <Icon name="chevron_left" className="!text-[20px]" />
        </button>
        <span className="min-w-[130px] text-center text-sm font-semibold text-feather px-2">
          {periodLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="p-1.5 rounded hover:bg-off-white text-feather"
          aria-label="Next"
        >
          <Icon name="chevron_right" className="!text-[20px]" />
        </button>
      </div>
    </div>
  );
}
