import { useState, useRef, useEffect } from 'react';
import { ADD_BUTTON_CLASS, ADD_ROW_CLASS } from './dashboardShared';

export function AddTaskRow({ onAdd, autoFocus, readOnly }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && autoFocus) inputRef.current?.focus();
  }, [open, autoFocus]);

  async function submit() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await onAdd({ title: t, notes: notes.trim() || null });
      setTitle('');
      setNotes('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) return <div className={ADD_ROW_CLASS} aria-hidden />;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ADD_BUTTON_CLASS} ${ADD_ROW_CLASS}`}
      >
        + Add a task
      </button>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-secondary/30 shadow-executive p-3 space-y-2 ${ADD_ROW_CLASS}`}>
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full px-2 py-1.5 text-sm font-semibold border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/30"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-2 py-1.5 text-xs border border-outline-variant/30 rounded-lg"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-on-surface-variant">Cancel</button>
        <button
          type="button"
          disabled={!title.trim() || saving}
          onClick={submit}
          className="text-xs font-bold bg-primary text-white px-3 py-1 rounded-lg disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function AddTaskSpacer() {
  return <div className={ADD_ROW_CLASS} aria-hidden />;
}
