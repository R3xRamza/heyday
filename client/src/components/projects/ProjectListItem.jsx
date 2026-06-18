export default function ProjectListItem({
  project,
  expanded,
  onExpand,
  onEdit,
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      onDoubleClick={(e) => {
        e.preventDefault();
        onEdit();
      }}
      className={`w-full text-left bg-white rounded-xl shadow-executive px-5 py-4 mb-2 transition-all ${
        expanded
          ? 'ring-2 ring-secondary/50 border border-secondary bg-secondary/5'
          : 'border border-transparent hover:border-secondary/30'
      }`}
    >
      <p className="text-primary font-semibold text-base leading-snug">{project.title}</p>
      {project.description && (
        <p
          className={`text-sm text-on-surface-variant mt-1.5 leading-relaxed ${
            expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
          }`}
        >
          {project.description}
        </p>
      )}
      {expanded && !project.description && (
        <p className="text-xs text-on-surface-variant/50 mt-1.5 italic">No details yet — double-click to edit</p>
      )}
    </button>
  );
}
