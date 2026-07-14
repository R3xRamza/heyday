import DateText from '../shared/DateText';

export default function ProjectListItem({
  project,
  expanded,
  onExpand,
  onEdit,
  canEdit,
}) {
  return (
    <div
      className={`group relative h-full bg-white rounded-xl shadow-executive transition-all ${
        expanded
          ? 'ring-2 ring-secondary/50 border border-secondary bg-secondary/5'
          : 'border border-outline-variant/10 hover:border-secondary/30'
      }`}
    >
      <button
        type="button"
        onClick={onExpand}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (canEdit) onEdit();
        }}
        className="w-full text-left px-5 pt-5 pb-4"
      >
        <p className="text-primary font-semibold text-base leading-snug pr-12">{project.title}</p>
        {project.description ? (
          <p
            className={`text-sm text-on-surface-variant mt-2 leading-relaxed ${
              expanded ? 'whitespace-pre-wrap' : 'line-clamp-3'
            }`}
          >
            {project.description}
          </p>
        ) : (
          expanded && (
            <p className="text-xs text-on-surface-variant/50 mt-2 italic">
              No details yet{canEdit ? ' — double-click or Edit to update' : ''}
            </p>
          )
        )}
        {project.deadline && (
          <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Deadline
            </span>
            <DateText value={project.deadline} className="text-sm font-semibold text-feather" />
          </div>
        )}
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-3 right-3 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant hover:text-secondary px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          Edit
        </button>
      )}
    </div>
  );
}
