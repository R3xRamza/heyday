import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import ListPagination from '../components/shared/ListPagination';
import EditTaskModal from '../components/EditTaskModal';
import CreateTaskModal from '../components/CreateTaskModal';
import { getTeamProfile } from '../data/teamProfiles';
import TaskCalendarView from '../components/TaskCalendarView';
import DateText from '../components/shared/DateText';
import TaskHubPersonHeader from '../components/TaskHubPersonHeader';
import { shortAddress } from '../utils/format';

const FILTERS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'overdue', label: 'Overdue' },
];

const PAGE_SIZE = 50;

function sortMyTasks(tasks, { admin = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const bucket = (t) => {
    if (!t.due_date) return 3;
    if (t.status !== 'complete' && t.due_date < today) return 1;
    return 2;
  };
  return [...tasks].sort((a, b) => {
    if (a.status === 'complete' && b.status !== 'complete') return 1;
    if (b.status === 'complete' && a.status !== 'complete') return -1;
    if (admin && a.status !== 'complete' && b.status !== 'complete') {
      const aHigh = a.priority === 'high' ? 0 : 1;
      const bHigh = b.priority === 'high' ? 0 : 1;
      if (aHigh !== bHigh) return aHigh - bHigh;
    }
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

function renderDueLabel(task) {
  if (task.status === 'complete') return 'Completed';
  if (!task.due_date) return '—';
  return <DateText value={task.due_date} />;
}

export default function UserTaskDashboard({ category = 'transaction' }) {
  const { userId } = useParams();
  const [member, setMember] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [transactionShowUndated, setTransactionShowUndated] = useState(false);
  const showUndated = category === 'admin' || transactionShowUndated;
  const [compact, setCompact] = useState(false);
  const [data, setData] = useState({ tasks: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);

  const includeCompleted = showCompleted;

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
      category,
      include_completed: includeCompleted ? 'true' : 'false',
    });
    if (!showUndated) params.set('require_due_date', 'true');
    if (viewMode === 'list') {
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
    }
    const res = await fetch(`/api/tasks?${params}`, { credentials: 'include' });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [userId, filter, category, includeCompleted, showUndated, viewMode, page]);

  useEffect(() => {
    fetch('/api/team', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setUsers(json.members || []));
    fetch('/api/transactions?filter=active_transactions&limit=50', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setTransactions(json.transactions || []));
  }, []);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    setPage(1);
  }, [userId, filter, showUndated, includeCompleted, viewMode]);

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
    if (viewMode === 'list') return list;
    if (!showUndated) list = list.filter((t) => t.due_date);
    return sortMyTasks(list, { admin: category === 'admin' });
  }, [data.tasks, showUndated, category, viewMode]);

  function selectFilter(key) {
    setPage(1);
    setFilter(key);
  }

  const filterLabel = (key, base) => {
    if (key === 'today' && stats.todayCount) return `${base} (${stats.todayCount})`;
    if (key === 'overdue' && stats.overdueCount) return `${base} (${stats.overdueCount})`;
    if (key === 'week' && stats.weekCount) return `${base} (${stats.weekCount})`;
    return base;
  };

  function filterPillClass(key) {
    if (filter !== key) return 'text-on-surface-variant hover:bg-surface-container-high';
    if (key === 'overdue') return 'bg-error/10 text-error';
    return 'bg-primary text-white';
  }

  const rowPad = compact ? 'py-2' : 'py-4';

  return (
    <DashboardLayout
      title={member ? `${member.name}'s Task Hub` : 'Task Hub'}
      fillViewport
      className="p-0 overflow-hidden flex flex-col"
    >
      <div className={`bg-surface ${APP_HEADER_BORDER_CLASS} shrink-0`}>
        <TaskHubPersonHeader
          userId={userId}
          title={category === 'admin' ? 'Admin Task Dashboard' : 'Daily Task Dashboard'}
          member={member}
          profile={profile}
          showBorder={false}
        >
          <div className="flex items-center gap-2 flex-wrap pb-4">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => selectFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors ${filterPillClass(f.key)}`}
              >
                {filterLabel(f.key, f.label)}
              </button>
            ))}
          </div>
        </TaskHubPersonHeader>
      </div>

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
                {category === 'admin' ? 'Create an admin task' : 'Create a transaction task'}
              </button>
            </div>
          ) : (
            <div className="m-6 bg-white border border-outline-variant/20 rounded-xl shadow-executive overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-surface-container-low z-10">
                <tr>
                  {['', 'Task Description', 'Context / Property', 'Due Date', ''].map((h, i) => (
                    <th
                      key={h || 'actions'}
                      className={`${i === 0 ? 'pl-10 pr-4' : i === 4 ? 'pl-4 pr-10 text-right' : i === 3 ? 'px-4 min-w-[9.5rem] w-[9.5rem]' : 'px-4'} py-4 text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold border-b border-outline-variant/30`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {displayedTasks.map((task) => {
                  const isComplete = task.status === 'complete';
                  const dueLabel = renderDueLabel(task);
                  const expanded = expandedId === task.id;
                  return (
                    <Fragment key={task.id}>
                      <tr
                        onClick={() => setEditTask(task)}
                        className={`hover:bg-surface-container-low/60 transition-colors group cursor-pointer ${
                          isComplete ? 'opacity-65 hover:opacity-100 bg-surface-container-low/20' : 'bg-white'
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold ${isComplete ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                              {task.title}
                            </p>
                            {category === 'admin' && task.priority === 'high' && !isComplete && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-error/10 text-error">
                                High
                              </span>
                            )}
                          </div>
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
                        <td className={`px-4 ${rowPad} text-sm align-top`}>
                          {category === 'admin' ? (
                            '—'
                          ) : task.transaction_id ? (
                            <Link
                              to={`/transactions/${task.transaction_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-on-surface-variant/80 hover:text-secondary hover:underline line-clamp-2 leading-snug block max-w-[10.5rem]"
                            >
                              {shortAddress(task.transaction_address)}
                            </Link>
                          ) : (
                            <span className="text-on-surface-variant/80 line-clamp-2 leading-snug block max-w-[10.5rem]">
                              {shortAddress(task.transaction_address) || '—'}
                            </span>
                          )}
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
            </div>
            <ListPagination
              page={page}
              total={data.total ?? displayedTasks.length}
              onPageChange={setPage}
            />
            </div>
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
              <span className="text-sm">{category === 'admin' ? 'Add Admin Task' : 'Add Transaction Task'}</span>
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
              <label className={`flex items-center justify-between ${category === 'admin' ? 'cursor-default' : 'cursor-pointer'}`}>
                <span className="text-sm text-on-surface-variant font-medium">Show tasks without due date</span>
                <input
                  type="checkbox"
                  checked={showUndated}
                  disabled={category === 'admin'}
                  onChange={(e) => setTransactionShowUndated(e.target.checked)}
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
          adminOnly={category === 'admin'}
          onClose={() => setEditTask(null)}
          onSave={saveTaskEdit}
        />
      )}
      {showCreate && (
        <CreateTaskModal
          users={users}
          transactions={transactions}
          defaultAssignedTo={Number(userId)}
          adminOnly={category === 'admin'}
          onClose={() => setShowCreate(false)}
          onSave={createTask}
        />
      )}
    </DashboardLayout>
  );
}
