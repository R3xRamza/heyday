import { useEffect, useMemo, useState } from 'react';
import Icon from '../shared/Icon';
import {
  DEFAULT_QUOTA_SLOTS,
  LS_QUOTA_SLOTS,
  labelForPlatform,
  normalizeQuotaSlots,
  parseWeeklyTarget,
  countWeekPosts,
  countLastWeekPosts,
  nextWeekPostTitle,
  findGoalForPlatform,
  sortGoalPlatforms,
  computeMarketingStatus,
} from './quotaUtils';

const LS_GOALS_COLLAPSED = 'marketing-goals-collapsed-v1';

const SHORT_LABELS = {
  Instagram: 'IG',
  TikTok: 'TT',
  YouTube: 'YT',
  Facebook: 'FB',
  LinkedIn: 'LI',
  Podcast: 'Pod',
  'IG Grid': 'Grid',
  'IG Story': 'Story',
  Blog: 'Blog',
  'Pop By': 'Pop By',
  Newsletters: 'News',
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function shortLabel(platform) {
  return SHORT_LABELS[platform] || platform;
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="h-1 w-full bg-surface-container-high rounded-full overflow-hidden mt-1.5">
      <div
        className="h-full bg-feather rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PlatformQuotaCard({
  platformKey,
  platformOptions,
  takenPlatforms,
  count,
  target,
  lastWeekCount,
  nextTitle,
  goal,
  goals,
  onSave,
  compact,
}) {
  const [editing, setEditing] = useState(false);
  const [platformInput, setPlatformInput] = useState(platformKey);
  const [targetInput, setTargetInput] = useState(String(target));
  const [goalInput, setGoalInput] = useState(goal?.goal || '');

  const label = labelForPlatform(platformKey);

  function startEditing() {
    setPlatformInput(platformKey);
    setTargetInput(String(target));
    setGoalInput(goal?.goal || '');
    setEditing(true);
  }

  function cancelEditing() {
    setPlatformInput(platformKey);
    setTargetInput(String(target));
    setGoalInput(goal?.goal || '');
    setEditing(false);
  }

  async function saveEdits() {
    const n = Math.max(1, Number(targetInput) || 2);
    await onSave({
      platform: platformInput,
      target: n,
      goalText: goalInput,
    });
    setEditing(false);
  }

  function handlePlatformChange(newPlatform) {
    setPlatformInput(newPlatform);
    const selectedGoal = findGoalForPlatform(goals, newPlatform);
    setTargetInput(String(parseWeeklyTarget(selectedGoal?.frequency)));
    setGoalInput(selectedGoal?.goal || '');
  }

  return (
    <div className={`bg-white border border-outline-variant/15 rounded-xl relative flex flex-col ${
      compact ? 'p-3 min-h-[88px]' : 'p-4 min-h-[118px]'
    }`}>
      <span className="absolute top-2.5 right-2.5 text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant">
        LAST WK: {lastWeekCount}
      </span>
      <div className="flex items-center gap-0.5 pr-14 min-w-0">
        <p className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">
          {label}
        </p>
        {goal && (
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 p-0.5 -translate-y-0.5 text-on-surface-variant/50 hover:text-feather"
            aria-label="Edit weekly goal"
          >
            <Icon name="edit" className="!text-[14px]" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <select
            value={platformInput}
            onChange={(e) => handlePlatformChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-outline-variant/30 rounded bg-white"
          >
            {platformOptions.map((platform) => (
              <option
                key={platform}
                value={platform}
                disabled={takenPlatforms.has(platform) && platform !== platformKey}
              >
                {labelForPlatform(platform)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-14 px-2 py-1 text-xs border border-outline-variant/30 rounded"
            />
            <span className="text-xs text-on-surface-variant">/ week</span>
          </div>
          <input
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="Goal description"
            className="w-full px-2 py-1 text-xs border border-outline-variant/30 rounded"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={saveEdits} className="text-xs font-bold text-secondary">Save</button>
            <button type="button" onClick={cancelEditing} className="text-xs text-on-surface-variant hover:underline">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className={`font-bold text-feather mt-0.5 ${compact ? 'text-xl' : 'text-2xl'}`}>
            {count}<span className="text-sm font-semibold text-on-surface-variant">/{target}</span>
          </p>
          <ProgressBar value={target ? count / target : 0} />
          <p className="text-[10px] text-on-surface-variant mt-1.5 truncate uppercase tracking-wide">
            NEXT: {nextTitle}
          </p>
        </>
      )}
    </div>
  );
}

export default function PlatformQuotasRow({ quotaPosts, goals, onSaveGoal }) {
  const [quotaSlots, setQuotaSlots] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_GOALS_COLLAPSED) !== 'false';
    } catch {
      return true;
    }
  });

  const platformOptions = useMemo(
    () => sortGoalPlatforms(goals).map((g) => g.platform),
    [goals],
  );

  const resolvedSlots = useMemo(() => {
    if (!platformOptions.length) return DEFAULT_QUOTA_SLOTS;
    if (quotaSlots) return normalizeQuotaSlots(quotaSlots, goals);
    const saved = loadJson(LS_QUOTA_SLOTS, null);
    if (Array.isArray(saved) && saved.length === 5) {
      return normalizeQuotaSlots(saved, goals);
    }
    return normalizeQuotaSlots(DEFAULT_QUOTA_SLOTS, goals);
  }, [quotaSlots, goals, platformOptions.length]);

  const summaryItems = useMemo(() => {
    return resolvedSlots.map((platformKey) => {
      const goal = findGoalForPlatform(goals, platformKey);
      const target = parseWeeklyTarget(goal?.frequency);
      const count = countWeekPosts(quotaPosts, platformKey);
      return { platformKey, count, target };
    });
  }, [resolvedSlots, goals, quotaPosts]);

  const marketingStatus = useMemo(
    () => computeMarketingStatus(summaryItems),
    [summaryItems],
  );

  useEffect(() => {
    if (!platformOptions.length || quotaSlots !== null) return;
    const saved = loadJson(LS_QUOTA_SLOTS, null);
    const initial = Array.isArray(saved) && saved.length === 5
      ? normalizeQuotaSlots(saved, goals)
      : normalizeQuotaSlots(DEFAULT_QUOTA_SLOTS, goals);
    setQuotaSlots(initial);
  }, [goals, platformOptions.length, quotaSlots]);

  useEffect(() => {
    if (quotaSlots) {
      localStorage.setItem(LS_QUOTA_SLOTS, JSON.stringify(quotaSlots));
    }
  }, [quotaSlots]);

  useEffect(() => {
    localStorage.setItem(LS_GOALS_COLLAPSED, collapsed ? 'true' : 'false');
  }, [collapsed]);

  async function handleSave(slotIndex, payload) {
    setQuotaSlots((prev) => {
      const base = prev || resolvedSlots;
      const next = [...base];
      next[slotIndex] = payload.platform;
      return normalizeQuotaSlots(next, goals);
    });
    await onSaveGoal(payload);
  }

  return (
    <div className="mb-2 shrink-0">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-outline-variant/15 rounded-xl hover:bg-off-white/50 transition-colors"
        aria-expanded={!collapsed}
      >
        <Icon
          name={collapsed ? 'chevron_right' : 'expand_more'}
          className="!text-[18px] text-on-surface-variant shrink-0"
        />
        <span className="text-xs font-semibold text-feather shrink-0">Weekly Goals</span>
        {collapsed && (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              marketingStatus.attention
                ? 'bg-error/10 text-error'
                : marketingStatus.goalMet
                  ? 'bg-secondary/10 text-secondary'
                  : 'bg-feather/10 text-feather'
            }`}
            >
              Marketing {marketingStatus.percent}%
            </span>
            {summaryItems.map(({ platformKey, count, target }) => (
              <span
                key={platformKey}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-low text-[11px] font-medium text-on-surface-variant"
              >
                {shortLabel(platformKey)} {count}/{target}
              </span>
            ))}
          </div>
        )}
      </button>

      {!collapsed && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2 max-h-[140px] overflow-y-auto custom-scrollbar">
          <div className="bg-white border border-outline-variant/15 rounded-xl p-3 flex flex-col justify-between min-h-[88px]">
            <p className="text-xs font-semibold text-on-surface-variant">Marketing Status</p>
            <div className="flex items-end justify-between gap-2 mt-1">
              <p className={`text-xl font-bold ${
                marketingStatus.attention
                  ? 'text-error'
                  : marketingStatus.goalMet
                    ? 'text-secondary'
                    : 'text-feather'
              }`}
              >
                {marketingStatus.percent}%
              </p>
              <Icon
                name={marketingStatus.attention ? 'warning' : marketingStatus.goalMet ? 'check_circle' : 'schedule'}
                className={`!text-[28px] shrink-0 ${
                  marketingStatus.attention
                    ? 'text-error/70'
                    : marketingStatus.goalMet
                      ? 'text-secondary/70'
                      : 'text-feather/30'
                }`}
                filled={marketingStatus.goalMet}
              />
            </div>
            <p className={`text-[10px] mt-0.5 ${
              marketingStatus.attention ? 'text-error font-semibold' : 'text-on-surface-variant'
            }`}
            >
              {marketingStatus.label}
            </p>
          </div>

          {resolvedSlots.map((platformKey, slotIndex) => {
            const goal = findGoalForPlatform(goals, platformKey);
            const target = parseWeeklyTarget(goal?.frequency);
            const count = countWeekPosts(quotaPosts, platformKey);
            const lastWeekCount = countLastWeekPosts(quotaPosts, platformKey);
            const nextTitle = nextWeekPostTitle(quotaPosts, platformKey);
            const takenPlatforms = new Set(
              resolvedSlots.filter((_, i) => i !== slotIndex),
            );

            return (
              <PlatformQuotaCard
                key={slotIndex}
                platformKey={platformKey}
                platformOptions={platformOptions}
                takenPlatforms={takenPlatforms}
                count={count}
                target={target}
                lastWeekCount={lastWeekCount}
                nextTitle={nextTitle}
                goal={goal}
                goals={goals}
                compact
                onSave={(payload) => handleSave(slotIndex, payload)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
