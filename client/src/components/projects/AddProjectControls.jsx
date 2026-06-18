import { useState, useEffect, useRef } from 'react';
import { ADD_BUTTON_CLASS, ADD_ROW_CLASS } from './dashboardShared';

export function AddProjectForm({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      await onSave({ title: title.trim(), description: description.trim() || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`bg-white rounded-xl border border-secondary/40 shadow-executive p-4 space-y-2 ${ADD_ROW_CLASS}`}>
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
  if (readOnly) return <div className={ADD_ROW_CLASS} aria-hidden />;
  return (
    <button type="button" onClick={onClick} className={`${ADD_BUTTON_CLASS} ${ADD_ROW_CLASS}`}>
      + Add a project
    </button>
  );
}
