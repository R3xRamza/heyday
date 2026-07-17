import { useState, useEffect } from 'react';
import TaskDeadlineFields from './TaskDeadlineFields';
import { computeTaskDueDate } from '../utils/taskTiming';
import { RECURRENCE_OPTIONS } from '../utils/taskRecurrence';

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

function resolveDeadlineMode(task) {
  if (task.due_date_override) return 'fixed';
  const isTemplateTask = Boolean(task.template_task_id);
  if (task.task_timing_anchor || (isTemplateTask && task.timing_anchor)) return 'relative';
  return 'fixed';
}

export default function EditTaskModal({ task, users, transaction = null, adminOnly = false, onClose, onSave }) {
  const isTemplateTask = Boolean(task.template_task_id);
  const showLinkedDeadline = Boolean(transaction);
  const templateLinkedTiming = isTemplateTask && Boolean(task.timing_anchor);

  const [deadlineMode, setDeadlineMode] = useState(() => resolveDeadlineMode(task));
  const [timingValue, setTimingValue] = useState(task.timing_value ?? 0);
  const [timingDirection, setTimingDirection] = useState(task.timing_direction || 'A');
  const [timingAnchor, setTimingAnchor] = useState(task.timing_anchor || '');
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    due_date: task.due_date || '',
    assigned_to: task.assigned_to || '',
    priority: task.priority || 'normal',
    recurrence: task.recurrence || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDeadlineMode(resolveDeadlineMode(task));
    setTimingValue(task.timing_value ?? 0);
    setTimingDirection(task.timing_direction || 'A');
    setTimingAnchor(task.timing_anchor || '');
    setForm({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority || 'normal',
      recurrence: task.recurrence || '',
    });
  }, [task]);

  function handleDeadlineModeChange(mode) {
    if (mode === 'fixed' && !form.due_date && transaction && timingAnchor) {
      const preview = computeTaskDueDate(transaction, timingValue, timingDirection, timingAnchor);
      if (preview) {
        setForm((prev) => ({ ...prev, due_date: preview }));
      }
    }
    setDeadlineMode(mode);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      assigned_to: form.assigned_to || null,
    };

    if (isTemplateTask) {
      if (!showLinkedDeadline || deadlineMode === 'fixed') {
        payload.due_date = form.due_date || null;
        payload.due_date_override = true;
      } else {
        payload.timing_value = timingValue;
        payload.timing_direction = timingDirection;
        payload.timing_anchor = timingAnchor || null;
        payload.due_date_override = false;
      }
    } else if (showLinkedDeadline) {
      if (deadlineMode === 'relative') {
        payload.timing_value = timingValue;
        payload.timing_direction = timingDirection;
        payload.timing_anchor = timingAnchor || null;
        payload.due_date = null;
      } else {
        payload.due_date = form.due_date || null;
        payload.timing_anchor = null;
        payload.timing_value = null;
        payload.timing_direction = null;
      }
    } else {
      payload.due_date = form.due_date || null;
    }

    if (adminOnly) {
      payload.priority = form.priority;
      payload.recurrence = form.recurrence || null;
    }

    await onSave(payload);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-outline-variant/20">
          <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Edit Task</h2>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase">Task name</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm resize-none"
            />
          </div>
          {showLinkedDeadline ? (
            <>
              {templateLinkedTiming && (
                <p className="text-xs text-on-surface-variant bg-surface-container-low/60 border border-outline-variant/20 rounded px-3 py-2">
                  Linked to transaction dates. Edit days, before/after, and milestone below, or switch to <strong>Fixed date</strong> for a one-off due date.
                </p>
              )}
              <TaskDeadlineFields
                transaction={transaction}
                deadlineMode={deadlineMode}
                onDeadlineModeChange={handleDeadlineModeChange}
                dueDate={form.due_date}
                onDueDateChange={(value) => setForm({ ...form, due_date: value })}
                timingValue={timingValue}
                onTimingValueChange={setTimingValue}
                timingDirection={timingDirection}
                onTimingDirectionChange={setTimingDirection}
                timingAnchor={timingAnchor}
                onTimingAnchorChange={setTimingAnchor}
              />
            </>
          ) : (
            <div>
              <label className="text-xs font-semibold text-on-surface-variant uppercase">Deadline</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase">Assigned to</label>
            <select
              value={String(form.assigned_to || '')}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.name}</option>
              ))}
            </select>
          </div>
          {adminOnly && (
            <>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase">Recurring</label>
                <select
                  value={form.recurrence || ''}
                  onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {form.recurrence && (
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    When marked complete, a new copy is created for the next due date.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-semibold text-on-surface-variant border rounded">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-primary-container rounded">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
