import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import MarketingCalendarHeader from '../components/marketing/MarketingCalendarHeader';
import MarketingCalendarToolbar from '../components/marketing/MarketingCalendarToolbar';
import PlatformQuotasRow from '../components/marketing/PlatformQuotasRow';
import { sortBarPlatforms } from '../components/marketing/MarketingPlatformBar';
import MarketingMonthView from '../components/marketing/MarketingMonthView';
import MarketingWeekView from '../components/marketing/MarketingWeekView';
import MarketingPostModal from '../components/marketing/MarketingPostModal';
import MarketingTaskModal from '../components/marketing/MarketingTaskModal';
import MonthBirthdaysModal from '../components/marketing/MonthBirthdaysModal';
import CreateContentFab from '../components/marketing/CreateContentFab';
import { displayTaskTitle } from '../utils/taskDisplay.js';
import {
  groupEventsByDate,
  monthRange,
  weekRange,
  currentWeekRange,
  previousWeekRange,
  fridayCelebrationFetchEnd,
  monthKeyFromDate,
  monthKeyFromStr,
  monthsInDateRange,
} from '../components/marketing/calendarUtils';
import { mergeQuotaPosts } from '../components/marketing/quotaUtils';
import { shortAddress } from '../utils/format';
import { findAdamMember } from '../constants/marketingTasks';

const LS_CATEGORIES = 'marketing-categories-v4';
const LS_CATEGORIES_LEGACY = 'marketing-categories-v2';
const LS_CATEGORIES_V3 = 'marketing-categories-v3';
const LS_PLATFORM_FILTER = 'marketing-platform-filter-v1';
const DEFAULT_CATEGORIES = { social: true, tasks: true, celebrations: false };

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadCategories() {
  const saved = loadJson(LS_CATEGORIES, null);
  if (saved) return { ...DEFAULT_CATEGORIES, ...saved, tasks: true };

  const v3 = loadJson(LS_CATEGORIES_V3, null);
  if (v3) {
    const migrated = { ...DEFAULT_CATEGORIES, ...v3, tasks: true };
    localStorage.setItem(LS_CATEGORIES, JSON.stringify(migrated));
    return migrated;
  }

  const legacy = loadJson(LS_CATEGORIES_LEGACY, null);
  if (legacy) {
    const migrated = { ...DEFAULT_CATEGORIES, ...legacy, tasks: true };
    localStorage.setItem(LS_CATEGORIES, JSON.stringify(migrated));
    return migrated;
  }

  return DEFAULT_CATEGORIES;
}

async function fetchAdamUserId() {
  try {
    const res = await fetch('/api/team', { credentials: 'include' });
    if (!res.ok) return null;
    const json = await res.json();
    return findAdamMember(json.members)?.id ?? null;
  } catch {
    return null;
  }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function platformMatches(platform, allowed) {
  if (!platform || !allowed?.length) return false;
  const norm = platform.trim().toLowerCase();
  return allowed.some((a) => a.trim().toLowerCase() === norm);
}

function mergeFilterPlatforms(barPlatforms, posts) {
  const merged = [...barPlatforms];
  for (const post of posts) {
    const platform = post.platform?.trim();
    if (platform && !merged.some((p) => p.toLowerCase() === platform.toLowerCase())) {
      merged.push(platform);
    }
  }
  return merged;
}

function normalizeEvents({
  posts,
  tasks,
  celebrations,
  categories,
  selectedPlatforms,
  allPlatforms,
  birthdayPinSets,
}) {
  const today = todayStr();
  const events = [];
  const activePlatforms = selectedPlatforms ?? allPlatforms ?? [];

  if (categories.social) {
    for (const p of posts) {
      if (!platformMatches(p.platform, activePlatforms)) continue;
      events.push({
        key: `post-${p.id}`,
        kind: 'post',
        date: p.scheduled_date,
        title: p.title,
        platform: p.platform,
        status: p.status,
        raw: p,
      });
    }
  }

  if (categories.tasks) {
    for (const t of tasks) {
      if (!t.due_date || !t.transaction_id) continue;
      events.push({
        key: `task-${t.id}`,
        kind: 'task',
        date: t.due_date,
        title: displayTaskTitle(t),
        subtitle: shortAddress(t.transaction_address),
        taskId: t.id,
        transactionId: t.transaction_id,
        raw: t,
      });
    }
  }

  if (categories.celebrations) {
    for (const e of celebrations) {
      if (e.date === today) continue;
      if (e.type === 'birthday') {
        const month = monthKeyFromStr(e.date);
        const pins = birthdayPinSets[month];
        if (!pins?.has(e.contact_id)) continue;
      }
      events.push({
        key: `${e.type}-${e.contact_id}-${e.date}`,
        kind: e.type,
        date: e.date,
        title: e.name,
        contactId: e.contact_id,
      });
    }
  }

  return events;
}

export default function MarketingCalendar() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month');
  const [goals, setGoals] = useState([]);
  const [posts, setPosts] = useState([]);
  const [weekPosts, setWeekPosts] = useState([]);
  const [lastWeekPosts, setLastWeekPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [celebrations, setCelebrations] = useState([]);
  const [monthBirthdayEvents, setMonthBirthdayEvents] = useState([]);
  const [todayCelebrations, setTodayCelebrations] = useState([]);
  const [birthdayPinsByMonth, setBirthdayPinsByMonth] = useState({});
  const [monthBirthdaysOpen, setMonthBirthdaysOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [taskModalTask, setTaskModalTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [categories, setCategories] = useState(loadCategories);
  const [selectedPlatforms, setSelectedPlatforms] = useState(null);

  const barPlatforms = useMemo(() => sortBarPlatforms(goals), [goals]);

  const filterPlatforms = useMemo(
    () => mergeFilterPlatforms(barPlatforms, posts),
    [barPlatforms, posts],
  );

  const quotaPosts = useMemo(
    () => mergeQuotaPosts(lastWeekPosts, weekPosts, posts),
    [lastWeekPosts, weekPosts, posts],
  );

  const range = useMemo(
    () => (viewMode === 'week' ? weekRange(viewDate) : monthRange(viewDate)),
    [viewDate, viewMode],
  );

  const viewedMonthKey = useMemo(() => monthKeyFromDate(viewDate), [viewDate]);

  const birthdayPinSets = useMemo(() => {
    const out = {};
    for (const [month, ids] of Object.entries(birthdayPinsByMonth)) {
      out[month] = new Set(ids);
    }
    return out;
  }, [birthdayPinsByMonth]);

  const pinnedCount = birthdayPinsByMonth[viewedMonthKey]?.length ?? 0;

  const periodLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = new Date(`${range.start}T12:00:00`);
      const end = new Date(`${range.end}T12:00:00`);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewDate, viewMode, range]);

  const fetchGoals = useCallback(async () => {
    const res = await fetch('/api/marketing/platform-goals', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setGoals(json.goals || []);
    }
  }, []);

  const fetchCalendarData = useCallback(async () => {
    const { start, end } = range;
    const plannerMonth = monthRange(viewDate);
    const week = currentWeekRange();
    const lastWeek = previousWeekRange();
    const today = todayStr();
    const todayCelebrationEnd = fridayCelebrationFetchEnd(today);

    const adamUserId = await fetchAdamUserId();

    const taskUrl = adamUserId
      ? `/api/tasks?include_completed=false&transaction_only=true&assigned_to=${adamUserId}&due_after=${start}&due_before=${end}`
      : null;

    const [calRes, weekRes, lastWeekRes, bdayRes, monthBdayRes, todayBdayRes, taskRes] = await Promise.all([
      fetch(`/api/marketing/calendar?start=${start}&end=${end}`, { credentials: 'include' }),
      fetch(`/api/marketing/calendar?start=${week.start}&end=${week.end}`, { credentials: 'include' }),
      fetch(`/api/marketing/calendar?start=${lastWeek.start}&end=${lastWeek.end}`, { credentials: 'include' }),
      fetch(`/api/marketing/birthdays?start=${start}&end=${end}`, { credentials: 'include' }),
      fetch(`/api/marketing/birthdays?start=${plannerMonth.start}&end=${plannerMonth.end}`, { credentials: 'include' }),
      fetch(`/api/marketing/birthdays?start=${today}&end=${todayCelebrationEnd}`, { credentials: 'include' }),
      taskUrl
        ? fetch(taskUrl, { credentials: 'include' })
        : Promise.resolve({ ok: true, json: async () => ({ tasks: [] }) }),
    ]);

    if (calRes.ok) {
      const json = await calRes.json();
      setPosts(json.posts || []);
    }
    if (weekRes.ok) {
      const json = await weekRes.json();
      setWeekPosts(json.posts || []);
    }
    if (lastWeekRes.ok) {
      const json = await lastWeekRes.json();
      setLastWeekPosts(json.posts || []);
    }
    if (bdayRes.ok) {
      const json = await bdayRes.json();
      setCelebrations(json.events || []);
    }
    if (monthBdayRes.ok) {
      const json = await monthBdayRes.json();
      setMonthBirthdayEvents((json.events || []).filter((e) => e.type === 'birthday'));
    }
    if (todayBdayRes.ok) {
      const json = await todayBdayRes.json();
      setTodayCelebrations(json.events || []);
    }
    if (taskRes.ok) {
      const json = await taskRes.json();
      setTasks(json.tasks || []);
    } else {
      setTasks([]);
    }

    setInitialLoading(false);
  }, [range, viewDate]);

  const fetchBirthdayPins = useCallback(async () => {
    const months = [...new Set([viewedMonthKey, ...monthsInDateRange(range.start, range.end)])];
    const results = await Promise.all(
      months.map(async (month) => {
        const res = await fetch(`/api/marketing/birthday-pins?month=${month}`, { credentials: 'include' });
        if (!res.ok) return { month, contact_ids: [] };
        return res.json();
      }),
    );
    setBirthdayPinsByMonth((prev) => {
      const next = { ...prev };
      for (const row of results) {
        if (row.month) next[row.month] = row.contact_ids || [];
      }
      return next;
    });
  }, [viewedMonthKey, range.start, range.end]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  useEffect(() => {
    fetchBirthdayPins();
  }, [fetchBirthdayPins]);

  useEffect(() => {
    localStorage.setItem(LS_CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    if (!filterPlatforms.length) return;
    setSelectedPlatforms((prev) => {
      if (prev === null) {
        const saved = loadJson(LS_PLATFORM_FILTER, null);
        if (Array.isArray(saved)) {
          const valid = saved.filter((p) =>
            filterPlatforms.some((fp) => fp.toLowerCase() === p.toLowerCase()),
          );
          return valid.length ? valid : [...filterPlatforms];
        }
        return [...filterPlatforms];
      }
      return prev.filter((p) =>
        filterPlatforms.some((fp) => fp.toLowerCase() === p.toLowerCase()),
      );
    });
  }, [filterPlatforms]);

  useEffect(() => {
    if (selectedPlatforms) {
      localStorage.setItem(LS_PLATFORM_FILTER, JSON.stringify(selectedPlatforms));
    }
  }, [selectedPlatforms]);

  const eventsByDate = useMemo(() => {
    const events = normalizeEvents({
      posts,
      tasks,
      celebrations,
      categories,
      selectedPlatforms,
      allPlatforms: filterPlatforms,
      birthdayPinSets,
    });
    return groupEventsByDate(events);
  }, [posts, tasks, celebrations, categories, selectedPlatforms, filterPlatforms, birthdayPinSets]);

  async function saveBirthdayPins(contactIds, { firstPin = false } = {}) {
    const month = viewedMonthKey;
    const snapshot = birthdayPinsByMonth[month] ?? [];

    setBirthdayPinsByMonth((prev) => ({ ...prev, [month]: contactIds }));
    if (firstPin && !categories.celebrations) {
      setCategories((c) => ({ ...c, celebrations: true }));
    }

    const res = await fetch('/api/marketing/birthday-pins', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ month, contact_ids: contactIds }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBirthdayPinsByMonth((prev) => ({ ...prev, [month]: snapshot }));
      throw new Error(json.error || 'Save failed');
    }
    setBirthdayPinsByMonth((prev) => ({ ...prev, [month]: json.contact_ids || [] }));
  }

  async function addContactBirthday({ contactId, day }) {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const birthday = `${y}-${m}-${d}`;

    const res = await fetch(`/api/crm/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ birthday }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not save birthday');

    await fetchCalendarData();

    const month = viewedMonthKey;
    const currentPins = birthdayPinsByMonth[month] ?? [];
    if (!currentPins.includes(contactId)) {
      await saveBirthdayPins([...currentPins, contactId], {
        firstPin: currentPins.length === 0,
      });
    }
  }

  function togglePlatform(platform) {
    setSelectedPlatforms((prev) => {
      const current = prev ?? filterPlatforms;
      const matches = (p) => p.toLowerCase() === platform.toLowerCase();
      if (current.some(matches)) {
        return current.filter((p) => !matches(p));
      }
      return [...current, platform];
    });
  }

  function selectAllPlatforms() {
    setSelectedPlatforms([...filterPlatforms]);
  }

  function clearAllPlatforms() {
    setSelectedPlatforms([]);
  }

  function navigatePrev() {
    setViewDate((d) => {
      const next = new Date(d);
      if (viewMode === 'week') next.setDate(next.getDate() - 7);
      else next.setMonth(next.getMonth() - 1);
      return next;
    });
  }

  function navigateNext() {
    setViewDate((d) => {
      const next = new Date(d);
      if (viewMode === 'week') next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      return next;
    });
  }

  function openNewPost() {
    setEditingPost(null);
    setModalOpen(true);
  }

  function openNewPostForDate(dateStr) {
    setSelectedDate(dateStr);
    setEditingPost(null);
    setModalOpen(true);
  }

  function openEditPost(post) {
    setEditingPost(post);
    setModalOpen(true);
  }

  function openTaskModal(event) {
    const task = event.raw || {
      id: event.taskId,
      title: event.title,
      due_date: event.date,
      transaction_id: event.transactionId,
      transaction_address: event.subtitle,
      status: 'pending',
    };
    setTaskModalTask(task);
  }

  async function patchTaskStatus(id, status) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Update failed');
    await fetchCalendarData();
  }

  async function completeTask(id) {
    await patchTaskStatus(id, 'complete');
  }

  async function markTaskPending(id) {
    await patchTaskStatus(id, 'pending');
  }

  async function savePost(form, id) {
    const url = id ? `/api/marketing/posts/${id}` : '/api/marketing/posts';
    const res = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Save failed');
    await fetchCalendarData();
  }

  async function deletePost(id) {
    const res = await fetch(`/api/marketing/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Delete failed');
    }
    await fetchCalendarData();
  }

  async function patchPostStatus(id, status) {
    const res = await fetch(`/api/marketing/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Update failed');
    await fetchCalendarData();
  }

  async function completePost(id) {
    await patchPostStatus(id, 'done');
  }

  async function markPostActive(id) {
    await patchPostStatus(id, 'posting');
  }

  function updatePostDateInList(list, postId, newDate) {
    return list.map((p) =>
      p.id === postId ? { ...p, scheduled_date: newDate } : p,
    );
  }

  function syncPostInRangeList(list, post, range) {
    const inRange = post.scheduled_date >= range.start && post.scheduled_date <= range.end;
    const without = list.filter((p) => p.id !== post.id);
    if (!inRange) return without;
    return [...without, post].sort(
      (a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.id - b.id,
    );
  }

  async function reschedulePost(postId, newDate) {
    const post = posts.find((p) => p.id === postId);
    if (!post || post.scheduled_date === newDate) return;

    const updatedPost = { ...post, scheduled_date: newDate };
    const week = currentWeekRange();
    const lastWeek = previousWeekRange();

    const snapshot = {
      posts: [...posts],
      weekPosts: [...weekPosts],
      lastWeekPosts: [...lastWeekPosts],
    };

    setPosts((prev) => updatePostDateInList(prev, postId, newDate));
    setWeekPosts((prev) => syncPostInRangeList(prev, updatedPost, week));
    setLastWeekPosts((prev) => syncPostInRangeList(prev, updatedPost, lastWeek));

    const res = await fetch(`/api/marketing/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scheduled_date: newDate }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPosts(snapshot.posts);
      setWeekPosts(snapshot.weekPosts);
      setLastWeekPosts(snapshot.lastWeekPosts);
      window.alert(json.error || 'Could not move post');
      return;
    }

    const saved = json.post || updatedPost;
    setPosts((prev) => updatePostDateInList(prev, postId, saved.scheduled_date));
    setWeekPosts((prev) => syncPostInRangeList(prev, saved, week));
    setLastWeekPosts((prev) => syncPostInRangeList(prev, saved, lastWeek));
  }

  async function saveGoals(nextGoals) {
    const res = await fetch('/api/marketing/platform-goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ goals: nextGoals }),
    });
    if (res.ok) {
      const json = await res.json();
      setGoals(json.goals || []);
    }
  }

  async function saveQuotaGoal({ platform, target, goalText }) {
    const next = goals.map((g) =>
      g.platform === platform
        ? {
            ...g,
            frequency: `${target} posts/week`,
            goal: goalText?.trim() || null,
          }
        : g,
    );
    await saveGoals(next);
  }

  return (
    <DashboardLayout title="Marketing Calendar" className="px-6 md:px-8 py-3 bg-off-white w-full max-w-none">
      <div className="flex flex-col w-full select-none [&_input]:select-text [&_textarea]:select-text">
        <MarketingCalendarHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNewContent={openNewPost}
        />

        <PlatformQuotasRow
          quotaPosts={quotaPosts}
          goals={goals}
          onSaveGoal={saveQuotaGoal}
        />

        <MarketingCalendarToolbar
          categories={categories}
          onToggleCategory={(key) => setCategories((c) => ({ ...c, [key]: !c[key] }))}
          periodLabel={periodLabel}
          onPrev={navigatePrev}
          onNext={navigateNext}
          onToday={() => {
            setViewDate(new Date());
            setSelectedDate(todayStr());
          }}
          platforms={filterPlatforms}
          selectedPlatforms={selectedPlatforms ?? filterPlatforms}
          onTogglePlatform={togglePlatform}
          onSelectAllPlatforms={selectAllPlatforms}
          onClearAllPlatforms={clearAllPlatforms}
          goals={goals}
          todayCelebrations={todayCelebrations}
          viewDate={viewDate}
          pinnedCount={pinnedCount}
          totalBirthdaysInMonth={monthBirthdayEvents.length}
          onOpenMonthBirthdays={() => setMonthBirthdaysOpen(true)}
        />

        <div className="w-full">
          {initialLoading ? (
            <p className="text-on-surface-variant text-sm py-16 text-center flex-1">Loading calendar…</p>
          ) : viewMode === 'week' ? (
            <MarketingWeekView
              viewDate={viewDate}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditPost={openEditPost}
              onTaskClick={openTaskModal}
              onDropPost={reschedulePost}
              onNewPostForDate={openNewPostForDate}
            />
          ) : (
            <MarketingMonthView
              viewDate={viewDate}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditPost={openEditPost}
              onTaskClick={openTaskModal}
              onDropPost={reschedulePost}
              onNewPostForDate={openNewPostForDate}
            />
          )}
        </div>
      </div>

      <MarketingPostModal
        open={modalOpen}
        post={editingPost}
        platforms={goals}
        defaultScheduledDate={selectedDate}
        onClose={() => setModalOpen(false)}
        onSave={savePost}
        onDelete={deletePost}
        onComplete={completePost}
        onMarkActive={markPostActive}
      />

      <MarketingTaskModal
        open={!!taskModalTask}
        task={taskModalTask}
        onClose={() => setTaskModalTask(null)}
        onComplete={completeTask}
        onMarkPending={markTaskPending}
      />

      <MonthBirthdaysModal
        open={monthBirthdaysOpen}
        viewDate={viewDate}
        events={monthBirthdayEvents}
        pinnedIds={birthdayPinsByMonth[viewedMonthKey] ?? []}
        onClose={() => setMonthBirthdaysOpen(false)}
        onSavePins={saveBirthdayPins}
        onAddBirthday={addContactBirthday}
      />

      <CreateContentFab onClick={openNewPost} />
    </DashboardLayout>
  );
}
