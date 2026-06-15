import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import EditTaskModal from '../components/EditTaskModal';
import CreateTaskModal from '../components/CreateTaskModal';
import { getTeamProfile } from '../data/teamProfiles';
import TaskCalendarView from '../components/TaskCalendarView';
import DateText from '../components/shared/DateText';
import { shortAddress } from '../utils/format';

const FILTERS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'overdue', label: 'Overdue' },
];

function sortMyTasks(tasks) {
  const today = new Date().toISOString().slice(0, 10);
  const bucket = (t) => {
    if (!t.due_date) return 3;
    if (t.status !== 'complete' && t.due_date < today) return 1;
    return 2;
  };
  return [...tasks].sort((a, b) => {
    if (a.status === 'complete' && b.status !== 'complete') return 1;
    if (b.status === 'complete' && a.status !== 'complete') return -1;
    const diff = bucket(a) - bucket(b);
    if (diff !== 0) return diff;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.id - b.id;
  });
}

function dueCellClass(task) {
  if (task.status === 'complete') return 'text-on-surface-variant/60';
  if (task.is_overdue) return 'text-error font-semibold bg-error/5 px-2 py-1 rounded';
  const today = new Date().toISOString().slice(0, 10);
  if (task.due_date === today) return 'text-secondary font-semibold bg-secondary/5 px-2 py-1 rounded';
  return 'text-on-surface-variant';
}

function isCompletedToday(task) {
  const today = new Date().toISOString().slice(0, 10);
  return task.status === 'complete' && task.completed_at?.slice(0, 10) === today;
}

function renderDueLabel(task) {
  if (task.status === 'complete') return 'Completed';
  if (!task.due_date) return '—';
  return <DateText value={task.due_date} />;
}

export default function UserTaskDashboard() {
  const { userId } = useParams();
  const [member, setMember] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUndated, setShowUndated] = useState(false);
  const [compact, setCompact] = useState(false);
  const [data, setData] = useState({ tasks: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [summaryFilter, setSummaryFilter] = useState(null);

  const fetchMember = useCallback(async () => {
    const res = await fetch(`/api/team/${userId}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setMember(json.member);
    }
  }, [userId]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      assigned_to: userId,
      filter,
      include_completed: showCompleted ? 'true' : 'false',
    });
    const res = await fetch(`/api/tasks?${params}`, { credentials: 'include' });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [userId, filter, showCompleted]);

  useEffect(() => {
    fetch('/api/team', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setUsers(json.members || []));
    fetch('/api/transactions?filter=escrow', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setTransactions((json.transactions || []).slice(0, 50)));
  }, []);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function patchTask(taskId, body) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await fetchTasks();
      await fetchMember();
      return (await res.json()).task;
    }
    return null;
  }

  async function toggleTask(task, e) {
    e?.stopPropagation();
    const status = task.status === 'complete' ? 'pending' : 'complete';
    await patchTask(task.id, { status });
  }

  async function saveTaskEdit(formData) {
    if (!editTask) return;
    await patchTask(editTask.id, formData);
    setEditTask(null);
  }

  async function createTask(formData) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setShowCreate(false);
      await fetchTasks();
      await fetchMember();
    }
  }

  async function deleteTask(task, e) {
    e?.stopPropagation();
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE', credentials: 'include' });
    if (editTask?.id === task.id) setEditTask(null);
    await fetchTasks();
    await fetchMember();
  }

  if (!userId) return <Navigate to="/tasks" replace />;

  const profile = member ? getTeamProfile(member.email) : null;
  const { stats } = data;

  const displayedTasks = useMemo(() => {
    let list = data.tasks;
    if (!showUndated) list = list.filter((t) => t.due_date);
    if (summaryFilter === 'completedToday') {
      list = list.filter(isCompletedToday);
    }
    return sortMyTasks(list);
  }, [data.tasks, showUndated, summaryFilter]);

  function applySummaryCard(key) {
    if (key === 'overdue') {
      setSummaryFilter('overdue');
      setFilter('overdue');
      setShowCompleted(false);
      return;
    }
    if (key === 'completedToday') {
      setSummaryFilter('completedToday');
      setFilter('all');
      setShowCompleted(true);
      return;
    }
    if (key === 'active') {
      setSummaryFilter('active');
      setFilter('all');
      setShowCompleted(false);
    }
  }

  const statCards = [
    {
      key: 'completedToday',
      icon: 'task_alt',
      label: 'Completed Today',
      value: stats.completedToday ?? 0,
      iconBg: 'bg-secondary/10 text-secondary',
      hover: 'hover:border-secondary/30',
      activeRing: 'ring-2 ring-secondary/40 border-secondary/30',
    },
    {
      key: 'overdue',
      icon: 'warning',
      label: 'Overdue',
      value: String(stats.overdueCount ?? stats.highPriority ?? 0).padStart(2, '0'),
      iconBg: 'bg-error/5 text-error',
      hover: 'hover:border-error/30',
      valueClass: 'text-error',
      activeRing: 'ring-2 ring-error/40 border-error/30',
    },
    {
      key: 'active',
      icon: 'list_alt',
      label: 'Total Active',
      value: stats.totalActive ?? 0,
      iconBg: 'bg-primary/5 text-primary',
      hover: 'hover:border-primary/30',
      activeRing: 'ring-2 ring-primary/30 border-primary/30',
    },
  ];

  const filterLabel = (key, base) => {
    if (key === 'today' && stats.todayCount) return `${base} (${stats.todayCount})`;
    if (key === 'overdue' && stats.overdueCount) return `${base} (${stats.overdueCount})`;
    if (key === 'week' && stats.weekCount) return `${base} (${stats.weekCount})`;
    return base;
  };

  const rowPad = compact ? 'py-2' : 'py-4';

  return (
    <DashboardLayout
      title={member ? `${member.name}'s Tasks` : 'Daily Task Dashboard'}
      fillViewport
      className="p-0 overflow-hidden flex flex-col"
    >
      <section className="bg-surface px-10 py-6 border-b border-outline-variant/20 shrink-0">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <Link to="/tasks" className="text-sm text-secondary hover:underline mb-1 inline-block">← Back to Team Overview</Link>
            <h2 className="text-3xl font-semibold text-primary">Daily Task Dashboard</h2>
            {member && (
              <p className="text-on-surface-variant text-sm mt-1">
                {member.name} · {profile?.role}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key);
                  setSummaryFilter(f.key === 'overdue' ? 'overdue' : null);
                  if (f.key === 'overdue') setShowCompleted(false);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors ${
                  filter === f.key
                    ? f.key === 'overdue' ? 'bg-error/10 text-error' : 'bg-primary text-white'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {filterLabel(f.key, f.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {statCards.map((card) => {
            const active = summaryFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => applySummaryCard(card.key)}
                className={`bg-surface-container-low border border-outline-variant/20 rounded-xl p-5 flex items-center gap-4 text-left transition-all ${card.hover} ${
                  active ? card.activeRing : ''
                }`}
              >
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                  <Icon name={card.icon} className="!text-[28px]" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-on-surface-variant/60 font-semibold">{card.label}</p>
                  <p className={`text-2xl font-bold text-primary ${card.valueClass || ''}`}>{card.value}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <section className="flex-1 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
          {viewMode === 'calendar' ? (
            loading ? (
              <p className="p-10 text-on-surface-variant">Loading tasks…</p>
            ) : (
              <TaskCalendarView tasks={displayedTasks} onTaskClick={setEditTask} />
            )
          ) : loading ? (
            <p className="p-10 text-on-surface-variant">Loading tasks…</p>
          ) : displayedTasks.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-on-surface-variant mb-4">
                {data.tasks.length === 0
                  ? 'No tasks match this filter.'
                  : 'No dated tasks to show.'}
              </p>
              {!showUndated && data.tasks.some((t) => !t.due_date) && (
                <p className="text-sm text-on-surface-variant mb-4">
                  Turn on &quot;Show tasks without due date&quot; in Preferences to see undated tasks.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="text-sm font-semibold text-secondary hover:underline"
              >
                Create a task
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
                <tr>
                  {['', 'Task Description', 'Context / Property', 'Due Date', ''].map((h, i) => (
                    <th
                      key={h || 'actions'}
                      className={`${i === 0 ? 'pl-10 pr-4' : i === 4 ? 'pl-4 pr-10 text-right' : i === 3 ? 'px-4 min-w-[9.5rem] w-[9.5rem]' : 'px-4'} py-4 text-[11px] text-on-surface-variant/60 uppercase tracking-widest font-semibold border-b border-outline-variant/20`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {displayedTasks.map((task) => {
                  const isComplete = task.status === 'complete';
                  const dueLabel = renderDueLabel(task);
                  const expanded = expandedId === task.id;
                  return (
                    <Fragment key={task.id}>
                      <tr
                        onClick={() => setEditTask(task)}
                        className={`hover:bg-surface-container-low/30 transition-colors group cursor-pointer ${
                          isComplete ? 'opacity-40 hover:opacity-100 bg-surface-container-low/10' : ''
                        }`}
                      >
                        <td className={`pl-10 pr-4 ${rowPad}`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isComplete}
                            onChange={(e) => toggleTask(task, e)}
                            className="rounded-sm border-outline-variant/50 text-secondary focus:ring-0 w-4 h-4"
                          />
                        </td>
                        <td className={`px-4 ${rowPad}`}>
                          <p className={`text-sm font-semibold ${isComplete ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(expanded ? null : task.id);
                              }}
                              className="text-[11px] text-secondary hover:underline mt-0.5"
                            >
                              {expanded ? 'Hide details' : 'Show details'}
                            </button>
                          )}
                        </td>
                        <td className={`px-4 ${rowPad} text-sm text-on-surface-variant/80`}>
                          {shortAddress(task.transaction_address)}
                        </td>
                        <td className={`px-4 ${rowPad} whitespace-nowrap min-w-[9.5rem]`}>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${dueCellClass(task)}`}>
                            {dueLabel}
                            {task.is_overdue && task.status !== 'complete' && task.due_date && (
                              <span className="text-[10px] uppercase tracking-wide text-error/90">Overdue</span>
                            )}
                          </span>
                        </td>
                        <td className={`pl-4 pr-10 ${rowPad} text-right`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setEditTask(task)}
                              className="p-1 text-on-surface-variant/40 hover:text-primary"
                              title="Edit task"
                            >
                              <Icon name="edit" className="!text-[18px]" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => deleteTask(task, e)}
                              className="p-1 text-on-surface-variant/40 hover:text-error"
                              title="Delete task"
                            >
                              <Icon name="delete" className="!text-[18px]" />
                            </button>
                            {task.transaction_id && (
                              <Link
                                to={`/transactions/${task.transaction_id}`}
                                className="p-1 text-on-surface-variant/40 hover:text-primary inline-flex"
                                title="View transaction"
                              >
                                <Icon name="open_in_new" className="!text-[18px]" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && task.description && (
                        <tr className="bg-surface-container-low/20">
                          <td colSpan={5} className="px-10 pb-4 pt-0 text-sm text-on-surface-variant whitespace-pre-wrap">
                            {task.description}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <aside className="w-80 bg-surface border-l border-outline-variant/20 p-8 flex flex-col gap-10 shrink-0 overflow-y-auto custom-scrollbar">
          <section>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              <Icon name="add" className="!text-[24px]" />
              <span className="text-sm">New Task</span>
            </button>
            <div className="mt-6 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === 'calendar' ? 'list' : 'calendar'))}
                className={`flex items-center gap-3 px-2 py-2 font-medium text-sm text-left rounded-lg transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-secondary/10 text-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <Icon name="calendar_month" className="!text-[20px]" />
                {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
              </button>
              <button
                type="button"
                disabled
                title="Coming soon"
                className="flex items-center gap-3 px-2 py-2 text-on-surface-variant/50 font-medium text-sm text-left cursor-not-allowed"
              >
                <Icon name="file_download" className="!text-[20px]" /> Export List
                <span className="text-[10px] uppercase ml-auto">Soon</span>
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] text-on-surface-variant/60 uppercase tracking-widest mb-4 font-semibold">Preferences</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-on-surface-variant font-medium">Compact Mode</span>
                <input
                  type="checkbox"
                  checked={compact}
                  onChange={(e) => setCompact(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-9 h-5 rounded-full relative transition-colors ${compact ? 'bg-secondary' : 'bg-outline-variant/30'}`}>
                  <div className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all ${compact ? 'left-[18px]' : 'left-[2px]'}`} />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-on-surface-variant font-medium">Show tasks without due date</span>
                <input
                  type="checkbox"
                  checked={showUndated}
                  onChange={(e) => setShowUndated(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-9 h-5 rounded-full relative transition-colors ${showUndated ? 'bg-secondary' : 'bg-outline-variant/30'}`}>
                  <div className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all ${showUndated ? 'left-[18px]' : 'left-[2px]'}`} />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-on-surface-variant font-medium">Show Completed</span>
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-9 h-5 rounded-full relative transition-colors ${showCompleted ? 'bg-secondary' : 'bg-outline-variant/30'}`}>
                  <div className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all ${showCompleted ? 'left-[18px]' : 'left-[2px]'}`} />
                </div>
              </label>
            </div>
          </section>
        </aside>
      </div>

      {editTask && (
        <EditTaskModal
          task={editTask}
          users={users}
          onClose={() => setEditTask(null)}
          onSave={saveTaskEdit}
        />
      )}
      {showCreate && (
        <CreateTaskModal
          users={users}
          transactions={transactions}
          defaultAssignedTo={Number(userId)}
          onClose={() => setShowCreate(false)}
          onSave={createTask}
        />
      )}
    </DashboardLayout>
  );
}
