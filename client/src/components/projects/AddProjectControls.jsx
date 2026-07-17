import { useState, useEffect, useRef } from 'react';
import { ADD_BUTTON_CLASS, ADD_ROW_CLASS, PROJECT_PRIORITIES } from './dashboardShared';

export function AddProjectForm({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline || null,
        priority,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-xl border border-secondary/40 shadow-executive p-4 space-y-2 ${ADD_ROW_CLASS}`}
    >
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Project title"
        className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30"
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes / details (optional)"
        rows={3}
        className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-on-surface-variant shrink-0" htmlFor="add-project-deadline">
            Date
          </label>
          <input
            id="add-project-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
          {deadline && (
            <button
              type="button"
              onClick={() => setDeadline('')}
              className="text-xs font-semibold text-on-surface-variant shrink-0 px-1"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-on-surface-variant shrink-0" htmlFor="add-project-priority">
            Priority
          </label>
          <select
            id="add-project-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30"
          >
            {PROJECT_PRIORITIES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-on-surface-variant px-2 py-1">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export function AddProjectButton({ onClick, readOnly }) {
  if (readOnly) return null;
  return (
    <button type="button" onClick={onClick} className={`${ADD_BUTTON_CLASS} ${ADD_ROW_CLASS}`}>
      + Add a project
    </button>
  );
}
