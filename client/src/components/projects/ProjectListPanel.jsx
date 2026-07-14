import { useState, useEffect, useRef } from 'react';
import ProjectListItem from './ProjectListItem';

function ProjectEditForm({ project, onSave, onCancel, onDelete, readOnly }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || '');
  const [deadline, setDeadline] = useState(project.deadline || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || saving || readOnly) return;
    setSaving(true);
    try {
      await onSave(project.id, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline || null,
      });
      onCancel();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full bg-white rounded-xl ring-2 ring-secondary/50 border border-secondary bg-secondary/5 shadow-executive p-5 space-y-3"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={readOnly}
        className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-70"
        autoFocus
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={readOnly}
        placeholder="Notes / details"
        rows={4}
        className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none disabled:opacity-70"
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-on-surface-variant shrink-0" htmlFor={`deadline-${project.id}`}>
          Target date
        </label>
        <input
          id={`deadline-${project.id}`}
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={readOnly}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-70"
        />
        {!readOnly && deadline && (
          <button
            type="button"
            onClick={() => setDeadline('')}
            className="text-xs font-semibold text-on-surface-variant shrink-0 px-1"
          >
            Clear
          </button>
        )}
      </div>
      {!readOnly && (
        <div className="flex gap-2 justify-between pt-1">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete project "${project.title}"?`)) onDelete(project.id);
            }}
            className="text-xs font-semibold text-error px-2 py-1"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="text-xs font-semibold text-on-surface-variant px-2 py-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
      {readOnly && (
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-on-surface-variant">
          Close
        </button>
      )}
    </form>
  );
}

export default function ProjectListPanel({
  projects,
  onUpdate,
  onDelete,
  readOnly,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const clickTimerRef = useRef(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setEditingId(null);
        setExpandedId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  }, []);

  function handleExpand(projectId) {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setExpandedId((prev) => (prev === projectId ? null : projectId));
      setEditingId(null);
      clickTimerRef.current = null;
    }, 200);
  }

  function handleEdit(projectId) {
    if (readOnly) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setExpandedId(projectId);
    setEditingId(projectId);
  }

  function closeEdit() {
    setEditingId(null);
  }

  function handleDelete(projectId) {
    onDelete(projectId);
    if (expandedId === projectId) setExpandedId(null);
    if (editingId === projectId) setEditingId(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.map((project) => {
        if (editingId === project.id) {
          return (
            <ProjectEditForm
              key={project.id}
              project={project}
              onSave={onUpdate}
              onCancel={closeEdit}
              onDelete={handleDelete}
              readOnly={readOnly}
            />
          );
        }

        return (
          <ProjectListItem
            key={project.id}
            project={project}
            expanded={expandedId === project.id}
            onExpand={() => handleExpand(project.id)}
            onEdit={() => handleEdit(project.id)}
            canEdit={!readOnly}
          />
        );
      })}
    </div>
  );
}
