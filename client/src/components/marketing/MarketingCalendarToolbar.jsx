import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import { colorForPlatform } from './platformColors';

const CATEGORY_PILLS = [
  { key: 'social', label: 'Social' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'celebrations', label: 'Milestones' },
];

function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, rootRef };
}

function PlatformFilterPopover({
  platforms,
  selectedPlatforms,
  onTogglePlatform,
  onSelectAllPlatforms,
  onClearAllPlatforms,
  goals,
}) {
  const { open, setOpen, rootRef } = usePopover();

  function isSelected(platform) {
    return selectedPlatforms.some((p) => p.toLowerCase() === platform.toLowerCase());
  }

  const selectedCount = platforms.filter((p) => isSelected(p)).length;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-feather border border-outline-variant/20 bg-off-white hover:bg-surface-container-low whitespace-nowrap"
      >
        Platforms · {selectedCount}/{platforms.length}
        <Icon name={open ? 'expand_less' : 'expand_more'} className="!text-[16px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white border border-outline-variant/15 rounded-xl shadow-lg p-3">
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {platforms.map((platform) => {
              const selected = isSelected(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onTogglePlatform(platform)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-feather/30 ${
                    selected
                      ? 'bg-feather/10 border border-feather/20 text-feather'
                      : 'bg-off-white border border-outline-variant/10 text-on-surface-variant opacity-60'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: colorForPlatform(platform, goals) }}
                  />
                  {platform}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={onSelectAllPlatforms}
              className="text-xs font-semibold text-secondary hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClearAllPlatforms}
              className="text-xs font-semibold text-on-surface-variant hover:underline"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestonesPopover({ events }) {
  const { open, setOpen, rootRef } = usePopover();

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-purple border border-purple/20 bg-purple/5 hover:bg-purple/10 whitespace-nowrap"
      >
        <Icon name="cake" className="!text-[14px]" />
        {events.length} today
        <Icon name={open ? 'expand_less' : 'expand_more'} className="!text-[16px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-outline-variant/15 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto custom-scrollbar">
          {events.map((e) => (
            <Link
              key={`${e.type}-${e.contact_id}`}
              to={`/crm/${e.contact_id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-feather hover:bg-off-white"
            >
              <Icon
                name={e.type === 'birthday' ? 'cake' : 'home'}
                className="!text-[14px] text-purple/70 shrink-0"
              />
              <span className="truncate">{e.name}</span>
              <span className="text-[10px] text-on-surface-variant ml-auto shrink-0">
                {e.type === 'birthday' ? 'Birthday' : 'Anniversary'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketingCalendarToolbar({
  categories,
  onToggleCategory,
  periodLabel,
  onPrev,
  onNext,
  onToday,
  platforms,
  selectedPlatforms,
  onTogglePlatform,
  onSelectAllPlatforms,
  onClearAllPlatforms,
  goals,
  todayCelebrations,
}) {
  return (
    <div className="bg-white border border-outline-variant/15 rounded-xl px-3 py-1.5 mb-2 shrink-0 flex items-center justify-between gap-3 h-11 overflow-visible">
      <div className="flex items-center gap-1 shrink-0">
        {CATEGORY_PILLS.map(({ key, label }) => {
          const active = Boolean(categories[key]);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleCategory(key)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-feather text-white'
                  : 'text-on-surface-variant hover:bg-off-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onToday}
          className="mr-1 text-xs font-semibold text-secondary hover:underline whitespace-nowrap"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onPrev}
          className="p-1 rounded hover:bg-off-white text-feather"
          aria-label="Previous"
        >
          <Icon name="chevron_left" className="!text-[18px]" />
        </button>
        <span className="min-w-[110px] text-center text-xs font-semibold text-feather px-1 whitespace-nowrap">
          {periodLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="p-1 rounded hover:bg-off-white text-feather"
          aria-label="Next"
        >
          <Icon name="chevron_right" className="!text-[18px]" />
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {categories.social && platforms?.length > 0 && (
          <PlatformFilterPopover
            platforms={platforms}
            selectedPlatforms={selectedPlatforms}
            onTogglePlatform={onTogglePlatform}
            onSelectAllPlatforms={onSelectAllPlatforms}
            onClearAllPlatforms={onClearAllPlatforms}
            goals={goals}
          />
        )}
        {todayCelebrations?.length > 0 && (
          <MilestonesPopover events={todayCelebrations} />
        )}
      </div>
    </div>
  );
}
