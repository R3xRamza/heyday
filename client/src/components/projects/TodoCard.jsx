import { useState } from 'react';
import Icon from '../shared/Icon';
import DateText from '../shared/DateText';

function isOverdue(dueDate, isComplete) {
  if (!dueDate || isComplete) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export default function TodoCard({ item, onToggle, onUpdate, onDelete, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes || '');
  const [dueDate, setDueDate] = useState(item.due_date || '');

  async function saveEdit() {
    const t = title.trim();
    if (!t) return;
    await onUpdate(item.id, {
      title: t,
      notes: notes.trim() || null,
      due_date: dueDate || null,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-executive px-4 py-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-2 py-1.5 text-sm font-semibold border border-outline-variant/30 rounded-lg"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2 py-1.5 text-xs border border-outline-variant/30 rounded-lg"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date (optional)"
          className="w-full px-2 py-1.5 text-xs border border-outline-variant/30 rounded-lg"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-on-surface-variant">Cancel</button>
          <button type="button" onClick={saveEdit} className="text-xs font-bold text-secondary">Save</button>
        </div>
      </div>
    );
  }

  const isComplete = item.is_complete;
  const overdue = isOverdue(item.due_date, isComplete);

  return (
    <div className="bg-white rounded-xl shadow-executive px-4 py-3 flex gap-3 items-start group">
      <button
        type="button"
        disabled={readOnly}
        onClick={() => onToggle(item)}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5 ${
          isComplete
            ? 'bg-primary border-primary text-white'
            : 'border-outline-variant/60 hover:border-secondary bg-white'
        }`}
        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
      >
        {isComplete && <Icon name="check" className="!text-[16px]" />}
      </button>

      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          setTitle(item.title);
          setNotes(item.notes || '');
          setDueDate(item.due_date || '');
          setEditing(true);
        }}
        className="flex-1 min-w-0 text-left"
      >
        <p className={`text-sm font-semibold text-primary leading-snug ${isComplete ? 'line-through opacity-60' : ''}`}>
          {item.title}
        </p>
        {item.notes && (
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{item.notes}</p>
        )}
        {item.due_date && (
          <p className={`text-xs mt-1 ${overdue ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
            Due <DateText value={item.due_date} />
            {overdue ? ' · Overdue' : ''}
          </p>
        )}
      </button>

      {!readOnly && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${item.title}"?`)) onDelete(item.id);
          }}
          className="p-1 opacity-0 group-hover:opacity-100 text-on-surface-variant/40 hover:text-error transition-opacity shrink-0"
          title="Delete"
        >
          <Icon name="delete" className="!text-[18px]" />
        </button>
      )}
    </div>
  );
}
