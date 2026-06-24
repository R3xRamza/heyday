import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/shared/Icon';
import TeamAvatar from '../components/TeamAvatar';
import { getTeamProfile } from '../data/teamProfiles';
import { useAuth } from '../context/AuthContext';
import DateText from '../components/shared/DateText';
import { formatTaskDue, shortAddress } from '../utils/format';

function taskQueueStatus(task) {
  if (task.is_overdue) {
    return { label: 'Overdue', className: 'bg-error/10 text-error' };
  }
  return { label: 'Due Soon', className: 'bg-secondary/10 text-secondary' };
}

function dueDisplayClass(task) {
  if (task.is_overdue) return 'text-error font-bold';
  const label = formatTaskDue(task.due_date, task.status, task.is_overdue);
  if (label === 'Today') return 'text-secondary font-semibold';
  return 'text-on-surface-variant';
}

/** ~6 task rows visible; both top panels share this height */
const TASK_PANEL_HEIGHT = 'h-[28rem]';

export default function TeamTaskOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [priorityTasks, setPriorityTasks] = useState([]);
  const [closings, setClosings] = useState([]);
  const [weekFilter, setWeekFilter] = useState(false);
  const [loadingPriority, setLoadingPriority] = useState(true);
  const [loadingClosings, setLoadingClosings] = useState(true);

  const fetchTeam = useCallback(() => {
    setLoadingTeam(true);
    fetch('/api/team', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setTeamMembers(json.members || []))
      .finally(() => setLoadingTeam(false));
  }, []);

  const fetchPriority = useCallback(() => {
    setLoadingPriority(true);
    const params = new URLSearchParams({ filter: weekFilter ? 'week' : 'all' });
    fetch(`/api/tasks/team-priority?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setPriorityTasks(json.tasks || []))
      .finally(() => setLoadingPriority(false));
  }, [weekFilter]);

  const fetchClosings = useCallback(() => {
    setLoadingClosings(true);
    fetch('/api/tasks/milestones', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => setClosings(json.milestones || []))
      .finally(() => setLoadingClosings(false));
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    fetchPriority();
  }, [fetchPriority]);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  const emailByUserId = useMemo(
    () => Object.fromEntries(teamMembers.map((m) => [m.id, m.email])),
    [teamMembers],
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <DashboardLayout title="Team Task Overview" className="p-8">
      <div className="max-w-[1440px] mx-auto">
        <div className="mb-4 flex justify-between items-end flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-primary">Team Task Overview</h2>
            <p className="text-sm text-on-surface-variant">Real-time operational sync for the Heyday executive team.</p>
            {user?.id && (
              <Link
                to={`/tasks/${user.id}`}
                className="text-sm text-secondary font-semibold hover:underline mt-1 inline-block"
              >
                My tasks →
              </Link>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setWeekFilter((w) => !w)}
              className={`px-4 py-2 border rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                weekFilter
                  ? 'bg-primary text-white border-primary'
                  : 'border-outline-variant bg-white hover:bg-surface-container'
              }`}
            >
              <Icon name="calendar_today" className="text-sm" /> This Week
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter items-start">
          <section className="col-span-12 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-primary">Team Workload Summary</h3>
              <div className="h-px flex-1 mx-6 bg-primary/10" />
              <div className="text-on-surface-variant text-xs font-semibold uppercase">
                {teamMembers.length} Active Agents
              </div>
            </div>
            {loadingTeam ? (
              <p className="text-on-surface-variant">Loading team…</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
                {teamMembers.map((member) => {
                  const profile = getTeamProfile(member.email);
                  const { stats } = member;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => navigate(`/tasks/${member.id}`)}
                      className="bg-white p-6 rounded-xl border border-primary/10 shadow-executive hover:border-secondary transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <TeamAvatar
                          email={member.email}
                          name={member.name}
                          size="lg"
                          borderClassName="border-2 border-surface-container"
                        />
                        <div>
                          <div className="font-bold text-primary text-xl">{member.name}</div>
                          <div className="text-on-surface-variant text-[11px] font-bold uppercase">{profile.role}</div>
                        </div>
                      </div>
                      <div className="mb-6">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-on-surface-variant font-bold uppercase">Progress</span>
                          <span className="text-secondary font-black">{stats.complete}/{stats.total} Complete</span>
                        </div>
                        <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                          <div className="bg-secondary h-full rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-2 rounded border border-primary/5">
                          <div className="text-xl font-black text-primary">{stats.pending}</div>
                          <div className="text-[9px] uppercase font-bold text-on-surface-variant">Pending</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-primary/5">
                          <div className="text-xl font-black text-secondary">{stats.active}</div>
                          <div className="text-[9px] uppercase font-bold text-on-surface-variant">Active</div>
                        </div>
                        <div className={`p-2 rounded border ${stats.overdue > 0 ? 'bg-error/5 border-error/10' : 'bg-white border-primary/5'}`}>
                          <div className={`text-xl font-black ${stats.overdue > 0 ? 'text-error' : 'text-primary'}`}>{stats.overdue}</div>
                          <div className={`text-[9px] uppercase font-bold ${stats.overdue > 0 ? 'text-error' : 'text-on-surface-variant'}`}>Overdue</div>
                        </div>
                      </div>
                      <Link
                        to={`/tasks/${member.id}/projects`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-4 text-sm font-semibold text-secondary hover:underline inline-block"
                      >
                        Projects →
                      </Link>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`col-span-12 lg:col-span-8 bg-white rounded-xl border border-primary/10 shadow-executive overflow-hidden flex flex-col ${TASK_PANEL_HEIGHT}`}>
            <div className="bg-feather px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-white text-xl font-semibold flex items-center gap-2">
                <Icon name="warning" className="text-lemon" /> Urgent Task Queue
              </h3>
              <span className="text-[10px] text-white/70 font-bold uppercase tracking-widest">
                {weekFilter ? 'Overdue & due this week' : 'Overdue tasks'}
              </span>
            </div>
            {loadingPriority ? (
              <p className="flex-1 min-h-0 px-6 py-10 text-on-surface-variant">Loading urgent tasks…</p>
            ) : priorityTasks.length === 0 ? (
              <p className="flex-1 min-h-0 px-6 py-10 text-on-surface-variant">
                {weekFilter ? 'No overdue or due-this-week tasks.' : 'No overdue tasks right now.'}
              </p>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <table className="w-full table-fixed text-left border-collapse shrink-0">
                  <colgroup>
                    <col className="w-[42%]" />
                    <col className="w-[16%]" />
                    <col className="w-[22%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-surface-container-low border-b border-primary/5">
                      {['Task Title', 'Due Date', 'Assignee', 'Status'].map((h) => (
                        <th key={h} className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                </table>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar border-t border-primary/5">
                  <table className="w-full table-fixed text-left border-collapse">
                    <colgroup>
                      <col className="w-[42%]" />
                      <col className="w-[16%]" />
                      <col className="w-[22%]" />
                      <col className="w-[20%]" />
                    </colgroup>
                    <tbody className="divide-y divide-primary/5">
                      {priorityTasks.map((task) => {
                        const status = taskQueueStatus(task);
                        const dueLabel = formatTaskDue(task.due_date, task.status, task.is_overdue);
                        return (
                          <tr
                            key={task.id}
                            className="hover:bg-secondary-fixed/10 transition-colors cursor-pointer"
                            onClick={() => {
                              if (task.assigned_to) navigate(`/tasks/${task.assigned_to}`);
                            }}
                          >
                            <td className="px-6 py-3.5 align-top">
                              <div className="font-bold text-primary">{task.title}</div>
                              <div className="text-[11px] text-on-surface-variant">
                                {task.transaction_id ? (
                                  <Link
                                    to={`/transactions/${task.transaction_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:text-secondary hover:underline"
                                  >
                                    {shortAddress(task.transaction_address)}
                                  </Link>
                                ) : (
                                  'Standalone task'
                                )}
                              </div>
                            </td>
                            <td className={`px-6 py-3.5 align-top whitespace-nowrap min-w-[9.5rem] ${dueDisplayClass(task)}`}>{dueLabel}</td>
                            <td className="px-6 py-3.5 align-top">
                              <div className="flex items-center gap-2">
                                <TeamAvatar
                                  email={emailByUserId[task.assigned_to]}
                                  name={task.user_name}
                                  size="xs"
                                />
                                <span className="text-sm">{task.user_name || 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 align-top">
                              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <aside className={`col-span-12 lg:col-span-4 flex flex-col ${TASK_PANEL_HEIGHT}`}>
            <section className="bg-white rounded-xl border border-primary/10 shadow-executive flex flex-col h-full min-h-0 overflow-hidden">
              <div className="bg-surface-container-high px-6 py-4 flex items-center gap-2 border-b border-primary/5 shrink-0">
                <Icon name="key" className="text-secondary" />
                <h3 className="text-xl font-semibold text-primary">Closing Soon</h3>
              </div>
              <div className="p-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {loadingClosings ? (
                  <p className="text-on-surface-variant text-sm">Loading closings…</p>
                ) : closings.length === 0 ? (
                  <p className="text-on-surface-variant text-sm">No closings in the next 30 days.</p>
                ) : (
                  <div className="relative pl-6 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-outline-variant">
                    {closings.map((m) => {
                      const isToday = m.date === todayStr;
                      return (
                        <div key={`${m.transaction_id}-${m.date}`} className="mb-6 relative">
                          <span
                            className={`absolute -left-[28px] top-1.5 w-2 h-2 rounded-full border-2 border-white ${
                              isToday ? 'bg-secondary' : 'bg-outline-variant'
                            }`}
                          />
                          <div className={`text-[10px] font-black uppercase tracking-widest mb-1 whitespace-nowrap ${isToday ? 'text-secondary' : 'text-on-surface-variant'}`}>
                            {isToday ? 'Today' : <DateText value={m.date} />}
                          </div>
                          <Link
                            to={`/transactions/${m.transaction_id}`}
                            className="font-bold text-primary hover:text-secondary block"
                          >
                            {m.title}
                          </Link>
                          <div className="text-on-surface-variant text-sm">{m.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Link
                to="/transactions"
                className="m-6 mt-0 p-3 border border-outline rounded-lg text-sm font-bold hover:bg-surface-container-low text-center block shrink-0"
              >
                View transactions
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
