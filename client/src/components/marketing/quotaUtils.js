import { currentWeekRange, previousWeekRange } from './calendarUtils';

const PLATFORM_ALIASES = {
  Instagram: ['IG Grid', 'IG Story'],
  'IG Grid': ['Instagram', 'IG Story'],
  'IG Story': ['Instagram', 'IG Grid'],
};

export const QUOTA_PLATFORMS = [
  { key: 'Instagram', label: 'Instagram Posts' },
  { key: 'TikTok', label: 'TikTok Videos' },
  { key: 'YouTube', label: 'YouTube Videos' },
  { key: 'Facebook', label: 'Facebook Posts' },
  { key: 'LinkedIn', label: 'LinkedIn Updates' },
];

export const DEFAULT_QUOTA_SLOTS = QUOTA_PLATFORMS.map((p) => p.key);

export const LS_QUOTA_SLOTS = 'marketing-quota-slots-v1';

export function labelForPlatform(platform) {
  const match = QUOTA_PLATFORMS.find((p) => p.key === platform);
  return match?.label || platform;
}

export function normalizeQuotaSlots(slots, goals) {
  const valid = new Set(goals.map((g) => g.platform));
  const result = [];
  const used = new Set();

  for (let i = 0; i < 5; i++) {
    let platform = slots[i] || DEFAULT_QUOTA_SLOTS[i];
    if (!valid.has(platform) || used.has(platform)) {
      platform = DEFAULT_QUOTA_SLOTS.find((d) => valid.has(d) && !used.has(d))
        || [...valid].find((p) => !used.has(p))
        || platform;
    }
    used.add(platform);
    result.push(platform);
  }

  return result;
}

export function sortGoalPlatforms(goals) {
  return [...goals].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0)
      || a.platform.localeCompare(b.platform),
  );
}

export function parseWeeklyTarget(frequency) {
  if (!frequency) return 2;
  const m = String(frequency).match(/(\d+)/);
  return m ? Number(m[1]) : 2;
}

export function platformAliasesFor(platformKey) {
  return PLATFORM_ALIASES[platformKey] || [];
}

export function platformMatches(postPlatform, key, aliases) {
  const p = (postPlatform || '').toLowerCase();
  const keys = [key, ...(aliases || [])].map((k) => k.toLowerCase());
  return keys.includes(p);
}

export function mergeQuotaPosts(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const post of list || []) {
      if (post?.id != null) byId.set(post.id, post);
    }
  }
  return [...byId.values()];
}

export function countPostsInRange(posts, platformKey, aliases, { start, end }) {
  return posts.filter(
    (p) =>
      (p.status === 'posting' || p.status === 'done')
      && platformMatches(p.platform, platformKey, aliases)
      && p.scheduled_date >= start
      && p.scheduled_date <= end,
  ).length;
}

export function countWeekPosts(posts, platformKey, aliases) {
  const resolved = aliases ?? platformAliasesFor(platformKey);
  return countPostsInRange(posts, platformKey, resolved, currentWeekRange());
}

export function countLastWeekPosts(posts, platformKey, aliases) {
  const resolved = aliases ?? platformAliasesFor(platformKey);
  return countPostsInRange(posts, platformKey, resolved, previousWeekRange());
}

export function nextWeekPostTitle(posts, platformKey, aliases) {
  const resolved = aliases ?? platformAliasesFor(platformKey);
  const { start, end } = currentWeekRange();
  const upcoming = posts
    .filter(
      (p) =>
        platformMatches(p.platform, platformKey, resolved)
        && p.scheduled_date >= start
        && p.scheduled_date <= end,
    )
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.id - b.id);
  return upcoming[0]?.title || '—';
}

export function findGoalForPlatform(goals, platformKey, aliases) {
  return goals.find((g) => platformMatches(g.platform, platformKey, aliases));
}

/** Aggregate weekly quota progress for the Marketing Status card. */
export function computeMarketingStatus(summaryItems, refDate = new Date()) {
  const items = (summaryItems || []).filter((item) => item.target > 0);
  if (!items.length) {
    return { percent: 0, label: 'On-Schedule', attention: false, goalMet: false };
  }

  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const totalTarget = items.reduce((sum, item) => sum + item.target, 0);
  const percent = totalTarget ? Math.min(100, Math.round((totalCount / totalTarget) * 100)) : 0;

  const weekday = refDate.getDay();
  const attention = items.some((item) => item.count === 0 && weekday >= 3);
  const goalMet = items.every((item) => item.count >= item.target);

  let label = 'On-Schedule';
  if (goalMet) label = 'Goal Met';
  else if (attention) label = 'Attention Required';

  return { percent, label, attention, goalMet };
}
