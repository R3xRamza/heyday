import DateText from '../shared/DateText';
import { ProjectPriorityBadge } from './dashboardShared';

const editButtonClass =
  'inline-flex items-center justify-center min-h-10 px-3 rounded-lg border border-outline-variant/40 bg-white text-[11px] font-bold uppercase tracking-wide text-primary hover:bg-surface-container-low';

function statusButtonClass(completed) {
  return completed
    ? 'inline-flex items-center justify-center min-h-10 px-3 rounded-lg border border-primary-container bg-white text-[11px] font-bold uppercase tracking-wide text-primary hover:bg-surface-container-low'
    : 'inline-flex items-center justify-center min-h-10 px-3 rounded-lg bg-primary-container text-white text-[11px] font-bold uppercase tracking-wide hover:brightness-110';
}

function statusButtonLabel(completed) {
  return completed ? 'Make active' : 'Mark complete';
}

export default function ProjectListItem({
  project,
  expanded,
  onExpand,
  onEdit,
  onComplete,
  canEdit,
  mobile = false,
}) {
  if (mobile) {
    return (
      <li>
        <div
          className={`bg-white border border-outline-variant/20 rounded-xl p-4 shadow-sm ${
            expanded ? 'ring-1 ring-secondary/30 bg-secondary/5' : ''
          }`}
        >
          <button
            type="button"
            onClick={onExpand}
            onDoubleClick={(e) => {
              e.preventDefault();
              if (canEdit) onEdit();
            }}
            className="w-full text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`text-primary font-semibold text-sm leading-snug min-w-0 flex-1 ${project.status === 'completed' ? 'line-through text-on-surface-variant' : ''}`}>
                {project.title}
              </p>
              <ProjectPriorityBadge priority={project.priority} className="shrink-0" />
            </div>
            {project.description ? (
              <p
                className={`text-xs text-on-surface-variant mt-2 leading-relaxed ${
                  expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                }`}
              >
                {project.description}
              </p>
            ) : (
              expanded && (
                <p className="text-xs text-on-surface-variant/50 mt-2 italic">
                  No details yet{canEdit ? ' — tap Edit to update' : ''}
                </p>
              )
            )}
            <p className="mt-3 text-xs font-semibold text-feather">
              {project.deadline ? (
                <DateText value={project.deadline} />
              ) : (
                <span className="text-on-surface-variant/50 font-medium">No date</span>
              )}
            </p>
          </button>
          {canEdit && (
            <div className="mt-3 flex justify-end gap-2 border-t border-outline-variant/10 pt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className={editButtonClass}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete?.(project);
                }}
                className={statusButtonClass(project.status === 'completed')}
              >
                {statusButtonLabel(project.status === 'completed')}
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <tr
      className={`group border-b border-outline-variant/10 last:border-0 transition-colors ${
        expanded ? 'bg-secondary/5' : 'hover:bg-surface-container-low/80'
      }`}
    >
      <td className="px-4 py-3 align-top">
        <button
          type="button"
          onClick={onExpand}
          onDoubleClick={(e) => {
            e.preventDefault();
            if (canEdit) onEdit();
          }}
          className="w-full text-left"
        >
          <p className={`text-primary font-semibold text-sm leading-snug ${project.status === 'completed' ? 'line-through text-on-surface-variant' : ''}`}>{project.title}</p>
          {project.description ? (
            <p
              className={`text-xs text-on-surface-variant mt-1 leading-relaxed ${
                expanded ? 'whitespace-pre-wrap' : 'line-clamp-1'
              }`}
            >
              {project.description}
            </p>
          ) : (
            expanded && (
              <p className="text-xs text-on-surface-variant/50 mt-1 italic">
                No details yet{canEdit ? ' — double-click or Edit to update' : ''}
              </p>
            )
          )}
        </button>
      </td>
      <td className="px-4 py-3 align-top whitespace-nowrap">
        {project.deadline ? (
          <DateText value={project.deadline} className="text-sm font-semibold text-feather" />
        ) : (
          <span className="text-sm text-on-surface-variant/50">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top whitespace-nowrap">
        <ProjectPriorityBadge priority={project.priority} />
      </td>
      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className={editButtonClass}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete?.(project);
              }}
              className={statusButtonClass(project.status === 'completed')}
            >
              {statusButtonLabel(project.status === 'completed')}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
