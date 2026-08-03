import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import DateText from '../shared/DateText';
import { shortAddress } from '../../utils/format';
import { recurrenceLabel } from '../../utils/taskRecurrence';

function dueClass(task) {
  if (task.status === 'complete') return 'text-on-surface-variant/60';
  if (task.is_overdue) return 'text-error font-semibold';
  const today = new Date().toISOString().slice(0, 10);
  if (task.due_date === today) return 'text-secondary font-semibold';
  return 'text-on-surface-variant';
}

function DueLabel({ task }) {
  if (task.status === 'complete') return 'Completed';
  if (!task.due_date) return '—';
  return <DateText value={task.due_date} />;
}

export default function UserTaskMobileCards({
  tasks,
  isAdmin,
  onOpen,
  onToggle,
  onDelete,
}) {
  return (
    <ul className="flex flex-col gap-3 px-4 pb-4">
      {tasks.map((task) => {
        const isComplete = task.status === 'complete';
        const recur = isAdmin ? recurrenceLabel(task.recurrence) : null;

        return (
          <li key={task.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(task)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(task);
                }
              }}
              className={`w-full text-left bg-white border border-outline-variant/20 rounded-xl p-4 shadow-sm active:bg-surface-container-low cursor-pointer ${
                isComplete ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isComplete}
                  onChange={(e) => onToggle(task, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 rounded-sm border-outline-variant/50 text-secondary focus:ring-0 w-5 h-5 shrink-0"
                  aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p
                      className={`text-sm font-semibold leading-snug ${
                        isComplete ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {task.title}
                    </p>
                    {recur && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-sky/15 text-sky border border-sky/25">
                        {recur}
                      </span>
                    )}
                    {isAdmin && task.priority === 'high' && !isComplete && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-error/10 text-error">
                        High
                      </span>
                    )}
                  </div>

                  {!isAdmin && (
                    <p className="text-xs text-on-surface-variant mt-1 truncate">
                      {task.transaction_id ? (
                        <Link
                          to={`/transactions/${task.transaction_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-secondary hover:underline"
                        >
                          {shortAddress(task.transaction_address)}
                        </Link>
                      ) : (
                        shortAddress(task.transaction_address) || 'No property'
                      )}
                    </p>
                  )}

                  <div className={`mt-2 flex items-center gap-2 text-xs ${dueClass(task)}`}>
                    <DueLabel task={task} />
                    {task.is_overdue && task.status !== 'complete' && task.due_date && (
                      <span className="text-[10px] uppercase tracking-wide text-error/90">Overdue</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 border-t border-outline-variant/10 pt-2 -mb-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(task);
                  }}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                  aria-label="Edit task"
                >
                  <Icon name="edit" className="!text-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => onDelete(task, e)}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error"
                  aria-label="Delete task"
                >
                  <Icon name="delete" className="!text-[18px]" />
                </button>
                {task.transaction_id && (
                  <Link
                    to={`/transactions/${task.transaction_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                    aria-label="View transaction"
                  >
                    <Icon name="open_in_new" className="!text-[18px]" />
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
