import { useState } from 'react';
import TaskDeadlineFields, { getAnchorOptionsForTransaction } from './TaskDeadlineFields';

export default function CreateTaskModal({
  users,
  transactions = [],
  defaultAssignedTo,
  defaultTransactionId,
  lockTransaction = false,
  transaction = null,
  adminOnly = false,
  onClose,
  onSave,
}) {
  const showLinkedDeadline = Boolean(transaction || (lockTransaction && defaultTransactionId));
  const [deadlineMode, setDeadlineMode] = useState('fixed');
  const [timingValue, setTimingValue] = useState(0);
  const [timingDirection, setTimingDirection] = useState('A');
  const [timingAnchor, setTimingAnchor] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: defaultAssignedTo ? String(defaultAssignedTo) : '',
    transaction_id: defaultTransactionId ? String(defaultTransactionId) : '',
  });
  const [saving, setSaving] = useState(false);

  function handleDeadlineModeChange(mode) {
    setDeadlineMode(mode);
    if (mode === 'relative' && !timingAnchor && transaction) {
      const options = getAnchorOptionsForTransaction(transaction);
      if (options.length > 0) setTimingAnchor(options[0].anchor);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      transaction_id: adminOnly
        ? null
        : lockTransaction && defaultTransactionId
          ? Number(defaultTransactionId)
          : (form.transaction_id ? Number(form.transaction_id) : null),
      category: adminOnly ? 'admin' : (form.transaction_id ? 'transaction' : 'admin'),
    };

    if (showLinkedDeadline && deadlineMode === 'relative') {
      payload.timing_value = timingValue;
      payload.timing_direction = timingDirection;
      payload.timing_anchor = timingAnchor || null;
      payload.due_date = null;
    } else {
      payload.due_date = form.due_date || null;
      payload.timing_anchor = null;
    }

    await onSave(payload);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-outline-variant/20">
          <h2 className="text-lg font-bold text-primary uppercase tracking-wide">New Task</h2>
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
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm resize-none"
            />
          </div>
          {showLinkedDeadline && transaction ? (
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
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.name}</option>
              ))}
            </select>
          </div>
          {!lockTransaction && !adminOnly && (
            <div>
              <label className="text-xs font-semibold text-on-surface-variant uppercase">Transaction (optional)</label>
              <select
                value={form.transaction_id}
                onChange={(e) => setForm({ ...form, transaction_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded text-sm"
              >
                <option value="">No transaction</option>
                {transactions.map((tx) => (
                  <option key={tx.id} value={String(tx.id)}>
                    {[tx.address, tx.city, tx.state, tx.zip].filter(Boolean).join(', ')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-outline-variant/20 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-semibold text-on-surface-variant border rounded">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-primary-container rounded">
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}
