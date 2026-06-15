import { useEffect, useMemo, useState } from 'react';
import Icon from '../shared/Icon';

const QUOTA_PLATFORM_KEYS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn'];

export default function MarketingPostModal({
  open,
  post,
  platforms,
  defaultScheduledDate,
  onClose,
  onSave,
  onDelete,
  onComplete,
  onMarkActive,
}) {
  const platformOptions = useMemo(() => {
    const filtered = platforms.filter((p) =>
      QUOTA_PLATFORM_KEYS.some((k) => k.toLowerCase() === (p.platform || '').toLowerCase()),
    );
    return filtered.length ? filtered : platforms;
  }, [platforms]);

  const [form, setForm] = useState({
    title: '',
    platform: '',
    scheduled_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isDone = post?.status === 'done';

  useEffect(() => {
    if (!open) return;
    setError('');
    if (post) {
      setForm({
        title: post.title || '',
        platform: post.platform || '',
        scheduled_date: post.scheduled_date || '',
        notes: post.notes || '',
      });
    } else {
      setForm({
        title: '',
        platform: platformOptions[0]?.platform || '',
        scheduled_date: defaultScheduledDate || new Date().toISOString().slice(0, 10),
        notes: '',
      });
    }
  }, [open, post, platformOptions, defaultScheduledDate]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const status = post?.id ? (post.status === 'done' ? 'done' : 'posting') : 'posting';
      await onSave({ ...form, status }, post?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!post?.id || !window.confirm('Delete this post?')) return;
    setSaving(true);
    try {
      await onDelete(post.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!post?.id) return;
    setSaving(true);
    setError('');
    try {
      await onComplete(post.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not mark complete');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkActive() {
    if (!post?.id) return;
    setSaving(true);
    setError('');
    try {
      await onMarkActive(post.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not reactivate post');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-primary">{post ? 'Edit Content' : 'New Content'}</h2>
          <button type="button" onClick={onClose} className="p-1 text-on-surface-variant hover:text-primary">
            <Icon name="close" />
          </button>
        </div>

        {isDone && (
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide">Completed</p>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <div>
          <label className="text-xs font-semibold text-on-surface-variant">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full mt-1 px-3 py-2 text-sm border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-on-surface-variant">Platform</label>
            <select
              required
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-outline-variant/30 rounded-lg outline-none"
            >
              {platformOptions.map((p) => (
                <option key={p.platform} value={p.platform}>{p.platform}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface-variant">Date</label>
            <input
              required
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-outline-variant/30 rounded-lg outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-on-surface-variant">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full mt-1 px-3 py-2 text-sm border border-outline-variant/30 rounded-lg resize-none outline-none"
          />
        </div>

        {post?.id && (
          <div className="flex flex-col gap-2">
            {isDone ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleMarkActive}
                className="w-full py-2.5 text-xs font-bold border border-outline-variant/30 text-feather rounded-lg hover:bg-off-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Mark as active'}
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
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 text-xs font-bold bg-primary-container text-white rounded-lg hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {post?.id && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2.5 text-xs font-bold text-error border border-error/30 rounded-lg hover:bg-error/5"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
