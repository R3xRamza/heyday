import { colorForPlatform } from './platformColors';

export const BAR_PLATFORM_NAMES = [
  'TikTok',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'YouTube',
  'Podcast',
  'IG Grid',
  'IG Story',
  'Pop By',
];

export function sortBarPlatforms(goals) {
  const allowed = new Set(BAR_PLATFORM_NAMES);
  return [...goals]
    .filter((g) => allowed.has(g.platform))
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
        || a.platform.localeCompare(b.platform),
    )
    .map((g) => g.platform);
}

export default function MarketingPlatformBar({
  platforms,
  selectedPlatforms,
  onTogglePlatform,
  goals,
}) {
  if (!platforms.length) return null;

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant shrink-0">
        Platform
      </span>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onTogglePlatform(platform)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-feather transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-feather/30 ${
                isSelected
                  ? 'bg-white border border-outline-variant/15 shadow-sm'
                  : 'bg-white/50 border border-outline-variant/10 opacity-60'
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
    </div>
  );
}
