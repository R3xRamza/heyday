import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../shared/Icon';
import { formatDate } from '../../utils/format';

export default function MarketingTaskModal({ open, task, onClose, onComplete, onMarkPending }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open || !task) return null;

  const isComplete = task.status === 'complete';
  const subtitle = task.transaction_address
    ? task.transaction_address
    : task.subtitle;

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

        <div className="text-sm text-on-surface-variant">
          Due {formatDate(task.due_date)}
          {isComplete && (
            <span className="ml-2 text-xs font-semibold text-secondary uppercase tracking-wide">
              Completed
            </span>
          )}
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

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
