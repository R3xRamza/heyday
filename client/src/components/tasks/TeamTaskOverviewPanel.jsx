import { Link, useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import TeamAvatar from '../TeamAvatar';
import { formatTaskDue, shortAddress } from '../../utils/format';
import { displayTaskTitle } from '../../utils/taskDisplay';

function dueDisplayClass(task) {
  if (task.is_overdue) return 'text-error font-bold';
  const label = formatTaskDue(task.due_date, task.status, task.is_overdue);
  if (label === 'Today') return 'text-secondary font-semibold';
  return 'text-on-surface-variant';
}

function taskOverviewStatus(task) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  if (task.is_overdue) return { label: 'Overdue', className: 'bg-error/10 text-error' };
  if (task.due_date === today) return { label: 'Today', className: 'bg-secondary/10 text-secondary' };
  if (task.due_date <= weekEndStr) return { label: 'Due Soon', className: 'bg-lemon/50 text-feather' };
  return { label: 'Upcoming', className: 'bg-surface-container-high text-on-surface-variant' };
}

function TableSkeleton() {
  return (
    <div className="px-6 py-4 space-y-3 animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 bg-surface-container-low rounded" />
      ))}
    </div>
  );
}

export default function TeamTaskOverviewPanel({
  tasks,
  loading,
  emailByUserId,
  className = '',
}) {
  const navigate = useNavigate();

  return (
    <section
      className={`bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden flex flex-col h-[28rem] ${className}`}
    >
      <div className="bg-feather px-6 h-14 flex justify-between items-center shrink-0 gap-3">
        <h3 className="text-white text-lg font-semibold flex items-center gap-2">
          <Icon name="task_alt" className="text-lemon !text-[20px]" />
          Team Task Overview
        </h3>
        <span className="text-[10px] text-white/70 font-bold uppercase tracking-widest text-right shrink-0">
          Open transaction tasks · team-wide
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : tasks.length === 0 ? (
        <p className="flex-1 px-6 py-10 text-on-surface-variant">
          No open transaction tasks with due dates.
        </p>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <table className="w-full table-fixed text-left border-collapse shrink-0">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[16%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/15">
                {['Task', 'Due', 'Assignee', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar">
            <table className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[16%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
              </colgroup>
              <tbody className="divide-y divide-outline-variant/10">
                {tasks.map((task) => {
                  const status = taskOverviewStatus(task);
                  const dueLabel = formatTaskDue(task.due_date, task.status, task.is_overdue);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-secondary/5 transition-colors cursor-pointer"
                      onClick={() => {
                        if (task.assigned_to) navigate(`/tasks/${task.assigned_to}`);
                      }}
                    >
                      <td className="px-6 py-3 align-top">
                        <div className="font-semibold text-primary text-sm">{displayTaskTitle(task)}</div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">
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
                      <td className={`px-6 py-3 align-top whitespace-nowrap text-sm ${dueDisplayClass(task)}`}>
                        {dueLabel}
                      </td>
                      <td className="px-6 py-3 align-top">
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamAvatar
                            email={emailByUserId[task.assigned_to]}
                            name={task.user_name}
                            size="xs"
                          />
                          <span className="text-sm truncate">{task.user_name || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 align-top">
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
  );
}
