import Icon from '../shared/Icon';

export default function MarketingCalendarHeader({ viewMode, onViewModeChange, onNewContent }) {
  return (
    <div className="flex items-center justify-end gap-2 mb-2 shrink-0">
      <div className="flex rounded-lg border border-outline-variant/25 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => onViewModeChange('month')}
          className={`px-2.5 md:px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === 'month' ? 'bg-feather text-white' : 'text-on-surface-variant hover:bg-off-white'
          }`}
        >
          <span className="md:hidden">Month</span>
          <span className="hidden md:inline">Monthly</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('week')}
          className={`px-2.5 md:px-3 py-1.5 text-xs font-semibold transition-colors ${
            viewMode === 'week' ? 'bg-feather text-white' : 'text-on-surface-variant hover:bg-off-white'
          }`}
        >
          <span className="md:hidden">Week</span>
          <span className="hidden md:inline">Weekly</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onNewContent}
        className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-feather text-white rounded-lg text-xs font-semibold hover:opacity-90"
      >
        <Icon name="add" className="!text-[16px]" /> Create Content
      </button>
    </div>
  );
}
