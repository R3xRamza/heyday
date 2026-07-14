import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';

export default function MarketingTaskModal({
  open,
  task,
  platforms = [],
  onClose,
  onSave,
  onComplete,
  onMarkPending,
}) {
  const [dueDate, setDueDate] = useState('');
  const [postType, setPostType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !task) return;
    setDueDate(task.due_date || '');
    setPostType(task.marketing_post_type || '');
    setError('');
  }, [open, task]);

  if (!open || !task) return null;

  const isComplete = task.status === 'complete';
  const subtitle = task.transaction_address
    ? task.transaction_address
    : task.subtitle;

  const platformOptions = (() => {
    const names = [...platforms];
    const existing = task.marketing_post_type?.trim();
    if (existing && !names.some((p) => p.toLowerCase() === existing.toLowerCase())) {
      names.unshift(existing);
    }
    return names;
  })();

  async function handleSave(e) {
    e?.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(task.id, {
        due_date: dueDate || null,
        due_date_override: true,
        marketing_post_type: postType.trim() || null,
      });
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    setError('');
    try {
      await onComplete(task.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update task');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPending() {
    setSaving(true);
    setError('');
    try {
      await onMarkPending(task.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-primary leading-snug">{task.title}</h2>
            {subtitle && (
              <p className="text-sm text-on-surface-variant mt-1 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-on-surface-variant hover:text-primary shrink-0"
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Type of post
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-outline-variant/30 rounded-lg text-sm bg-white"
            >
              <option value="">None</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 text-xs font-bold border border-outline-variant/30 text-feather rounded-lg hover:bg-off-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>

        {isComplete && (
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Completed</p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {isComplete ? (
            <button
              type="button"
              disabled={saving}
              onClick={handleMarkPending}
              className="w-full py-2.5 text-xs font-bold border border-outline-variant/30 text-feather rounded-lg hover:bg-off-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Mark pending'}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleComplete}
              className="w-full py-2.5 text-xs font-bold bg-primary-container text-white rounded-lg hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Mark complete'}
            </button>
          )}
          {task.transaction_id && (
            <Link
              to={`/transactions/${task.transaction_id}`}
              className="w-full py-2.5 text-xs font-bold text-center text-feather border border-outline-variant/30 rounded-lg hover:bg-off-white"
            >
              Open transaction →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
