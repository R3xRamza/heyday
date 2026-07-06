import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import TeamAvatar from '../TeamAvatar';
import DateText from '../shared/DateText';
import { displayTaskTitle } from '../../utils/taskDisplay';

function ListSkeleton() {
  return (
    <div className="px-4 py-3 space-y-2 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-surface-container-low rounded-lg" />
      ))}
    </div>
  );
}

export default function TeamAdminTasksPanel({
  tasks,
  teamMembers,
  loading,
  className = '',
}) {
  const navigate = useNavigate();

  const countsByUserId = useMemo(() => {
    const counts = Object.fromEntries(teamMembers.map((m) => [m.id, 0]));
    for (const task of tasks) {
      if (task.assigned_to && counts[task.assigned_to] != null) {
        counts[task.assigned_to] += 1;
      }
    }
    return counts;
  }, [tasks, teamMembers]);

  return (
    <section
      className={`bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden flex flex-col h-[28rem] ${className}`}
    >
      <div className="bg-primary-container px-4 py-3 flex items-center gap-2 shrink-0">
        <Icon name="assignment" className="text-white !text-[18px]" />
        <h3 className="text-sm font-bold text-white">Admin Tasks</h3>
        {!loading && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-white/80">
            {tasks.length} open
          </span>
        )}
      </div>

      {!loading && teamMembers.length > 0 && (
        <div className="px-3 py-2 border-b border-outline-variant/10 flex flex-wrap gap-1.5 bg-surface-container-low/40">
          {teamMembers.map((member) => {
            const count = countsByUserId[member.id] ?? 0;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => navigate(`/tasks/${member.id}/admin`)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  count > 0
                    ? 'bg-secondary/15 text-secondary hover:bg-secondary/25'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {member.name.split(' ')[0]}
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/10">
        {loading ? (
          <ListSkeleton />
        ) : tasks.length === 0 ? (
          <p className="px-4 py-8 text-sm text-on-surface-variant text-center">No open admin tasks.</p>
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                if (task.assigned_to) navigate(`/tasks/${task.assigned_to}/admin`);
              }}
              className="w-full text-left px-4 py-3 hover:bg-surface-container-low/60 transition-colors"
            >
              <div className="flex items-start gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-primary line-clamp-2">{displayTaskTitle(task)}</p>
                    {task.priority === 'high' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-error/10 text-error shrink-0">
                        High
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    {task.due_date ? <DateText value={task.due_date} /> : 'No date'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TeamAvatar
                    email={teamMembers.find((m) => m.id === task.assigned_to)?.email}
                    name={task.user_name}
                    size="xs"
                  />
                  <span className="text-[11px] text-on-surface-variant max-w-[4.5rem] truncate">
                    {task.user_name?.split(' ')[0] || '—'}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
