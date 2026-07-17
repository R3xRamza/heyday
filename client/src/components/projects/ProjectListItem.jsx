import DateText from '../shared/DateText';
import { ProjectPriorityBadge } from './dashboardShared';

export default function ProjectListItem({
  project,
  expanded,
  onExpand,
  onEdit,
  canEdit,
}) {
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
          <p className="text-primary font-semibold text-sm leading-snug">{project.title}</p>
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant hover:text-secondary px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
