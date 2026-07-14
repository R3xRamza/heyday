import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import DateText from './shared/DateText';

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function isCompleted(item) {
  return item?.completed === 1 || item?.completed === true;
}

export default function HubDocList({ section, emptyHint }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const saveTimers = useRef({});
  const bodyRevisions = useRef({});
  const focusedId = useRef(null);

  const fetchItems = useCallback(async () => {
    setError('');
    const res = await fetch(`/api/hub-docs?section=${section}`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Failed to load');
      return;
    }
    setItems(json.items || []);
  }, [section]);

  useEffect(() => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(clearTimeout);
  }, []);

  const openItems = useMemo(
    () => items.filter((item) => !isCompleted(item)),
    [items],
  );

  const completedItems = useMemo(
    () => items
      .filter((item) => isCompleted(item))
      .slice()
      .sort((a, b) => {
        const aAt = a.completed_at || a.created_at || '';
        const bAt = b.completed_at || b.created_at || '';
        if (aAt === bAt) return (b.id || 0) - (a.id || 0);
        return aAt < bAt ? 1 : -1;
      }),
    [items],
  );

  function mergeServerItem(prev, id, serverItem, savedRevision) {
    return prev.map((item) => {
      if (item.id !== id) return item;
      const currentRevision = bodyRevisions.current[id] || 0;
      const keepLocalBody = focusedId.current === id
        || (savedRevision != null && currentRevision > savedRevision);
      return {
        ...serverItem,
        body: keepLocalBody ? item.body : serverItem.body,
      };
    });
  }

  async function patchItem(id, payload, { revision } = {}) {
    const res = await fetch(`/api/hub-docs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = await res.json();
    setItems((prev) => mergeServerItem(prev, id, json.item, revision));
    return json.item;
  }

  function scheduleSave(id, body) {
    if (!body.trim()) return;
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    const revision = bodyRevisions.current[id] || 0;
    saveTimers.current[id] = setTimeout(() => {
      saveBody(id, body, { revision });
      delete saveTimers.current[id];
    }, 700);
  }

  async function saveBody(id, body, { allowDelete = false, revision } = {}) {
    const trimmed = body.trim();
    if (!trimmed) {
      if (allowDelete) await removeItem(id);
      return;
    }

    const savedRevision = revision ?? (bodyRevisions.current[id] || 0);
    await patchItem(id, { body: trimmed }, { revision: savedRevision });
  }

  async function addItem(body = '') {
    const res = await fetch('/api/hub-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ section, body }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    setItems((prev) => [...prev, json.item]);
    return json.item;
  }

  async function removeItem(id) {
    if (saveTimers.current[id]) {
      clearTimeout(saveTimers.current[id]);
      delete saveTimers.current[id];
    }
    const res = await fetch(`/api/hub-docs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateLocal(id, body) {
    bodyRevisions.current[id] = (bodyRevisions.current[id] || 0) + 1;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, body } : item)));
    scheduleSave(id, body);
  }

  async function toggleCompleted(item) {
    if (saveTimers.current[item.id]) {
      clearTimeout(saveTimers.current[item.id]);
      delete saveTimers.current[item.id];
    }
    const nextCompleted = !isCompleted(item);
    const trimmed = (item.body || '').trim();
    if (nextCompleted && !trimmed) {
      await removeItem(item.id);
      return;
    }
    // Flush current body with the toggle so nothing is lost
    await patchItem(item.id, {
      body: trimmed || item.body,
      completed: nextCompleted,
    }, { revision: bodyRevisions.current[item.id] || 0 });
  }

  async function handleKeyDown(e, item, openIndex) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (saveTimers.current[item.id]) {
        clearTimeout(saveTimers.current[item.id]);
        delete saveTimers.current[item.id];
      }
      await saveBody(item.id, item.body, { allowDelete: false });
      const next = await addItem('');
      if (next) {
        requestAnimationFrame(() => {
          const el = document.getElementById(`hub-doc-${next.id}`);
          el?.focus();
          if (el) autoResize(el);
        });
      }
      return;
    }

    if (e.key === 'Backspace' && !item.body.trim() && openItems.length > 1) {
      e.preventDefault();
      const focusId = openItems[openIndex - 1]?.id;
      await removeItem(item.id);
      if (focusId) {
        requestAnimationFrame(() => document.getElementById(`hub-doc-${focusId}`)?.focus());
      }
    }
  }

  function renderMeta(item) {
    return (
      <p className="text-[11px] text-on-surface-variant/70 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {item.created_at && (
          <span>
            Posted <DateText value={String(item.created_at).slice(0, 10)} />
          </span>
        )}
        {item.updated_by_name && <span>{item.updated_by_name}</span>}
      </p>
    );
  }

  function renderOpenRow(item, index) {
    return (
      <li key={item.id} className="group flex items-start gap-3 py-1.5">
        <button
          type="button"
          onClick={() => toggleCompleted(item)}
          aria-label="Mark complete"
          className="mt-1 shrink-0 h-[18px] w-[18px] rounded border border-outline-variant/70 bg-white hover:border-secondary transition-colors"
        />
        <div className="flex-1 min-w-0">
          <textarea
            id={`hub-doc-${item.id}`}
            value={item.body}
            rows={1}
            onChange={(e) => {
              updateLocal(item.id, e.target.value);
              autoResize(e.target);
            }}
            onBlur={(e) => {
              focusedId.current = null;
              if (saveTimers.current[item.id]) {
                clearTimeout(saveTimers.current[item.id]);
                delete saveTimers.current[item.id];
              }
              saveBody(item.id, e.target.value, { allowDelete: true });
            }}
            onFocus={(e) => {
              focusedId.current = item.id;
              autoResize(e.target);
            }}
            onKeyDown={(e) => handleKeyDown(e, item, index)}
            ref={(el) => el && autoResize(el)}
            className="w-full resize-none overflow-hidden bg-transparent text-base leading-6 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
            placeholder="Type a bullet…"
          />
          {renderMeta(item)}
        </div>
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          aria-label="Remove bullet"
          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded text-on-surface-variant hover:text-error transition-all shrink-0 mt-0.5"
        >
          <Trash2 size={14} />
        </button>
      </li>
    );
  }

  function renderCompletedRow(item) {
    return (
      <li key={item.id} className="group flex items-start gap-3 py-1.5">
        <button
          type="button"
          onClick={() => toggleCompleted(item)}
          aria-label="Mark incomplete"
          className="mt-1 shrink-0 h-[18px] w-[18px] rounded border border-secondary bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20 transition-colors"
        >
          <Check size={12} strokeWidth={3} />
        </button>
        <div className="flex-1 min-w-0">
          <textarea
            id={`hub-doc-${item.id}`}
            value={item.body}
            rows={1}
            onChange={(e) => {
              updateLocal(item.id, e.target.value);
              autoResize(e.target);
            }}
            onBlur={(e) => {
              focusedId.current = null;
              if (saveTimers.current[item.id]) {
                clearTimeout(saveTimers.current[item.id]);
                delete saveTimers.current[item.id];
              }
              saveBody(item.id, e.target.value, { allowDelete: true });
            }}
            onFocus={(e) => {
              focusedId.current = item.id;
              autoResize(e.target);
            }}
            ref={(el) => el && autoResize(el)}
            className="w-full resize-none overflow-hidden bg-transparent text-base leading-6 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
            placeholder="Type a bullet…"
          />
          {renderMeta(item)}
        </div>
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          aria-label="Remove bullet"
          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded text-on-surface-variant hover:text-error transition-all shrink-0 mt-0.5"
        >
          <Trash2 size={14} />
        </button>
      </li>
    );
  }

  if (loading) {
    return <p className="text-on-surface-variant text-sm">Loading…</p>;
  }

  const hasAny = items.length > 0;

  return (
    <div className="max-w-3xl">
      {error && <p className="text-error text-sm mb-4">{error}</p>}

      {!hasAny ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-white px-6 py-10 text-center">
          <p className="text-on-surface-variant text-sm mb-4">{emptyHint}</p>
          <button
            type="button"
            onClick={() => addItem('')}
            className="text-sm font-semibold text-secondary hover:underline"
          >
            + Add first bullet
          </button>
        </div>
      ) : (
        <>
          {openItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-white px-6 py-8 text-center mb-6">
              <p className="text-on-surface-variant text-sm mb-3">No open items.</p>
              <button
                type="button"
                onClick={() => addItem('')}
                className="text-sm font-semibold text-secondary hover:underline"
              >
                + Add bullet
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-1">
                {openItems.map((item, index) => renderOpenRow(item, index))}
              </ul>
              <button
                type="button"
                onClick={() => addItem('')}
                className="mt-4 text-sm font-semibold text-secondary hover:underline"
              >
                + Add bullet
              </button>
            </>
          )}

          {completedItems.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">
                Checked off
              </h2>
              <ul className="space-y-1">
                {completedItems.map((item) => renderCompletedRow(item))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
