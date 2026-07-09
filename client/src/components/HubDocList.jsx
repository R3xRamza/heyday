import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export default function HubDocList({ section, emptyHint }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const saveTimers = useRef({});

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

  async function saveItem(id, body) {
    const trimmed = body.trim();
    if (!trimmed) {
      await removeItem(id);
      return;
    }

    const res = await fetch(`/api/hub-docs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body: trimmed }),
    });
    if (!res.ok) return;
    const json = await res.json();
    setItems((prev) => prev.map((item) => (item.id === id ? json.item : item)));
  }

  function scheduleSave(id, body) {
    if (!body.trim()) return;
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      saveItem(id, body);
      delete saveTimers.current[id];
    }, 400);
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
    const res = await fetch(`/api/hub-docs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateLocal(id, body) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, body } : item)));
    scheduleSave(id, body);
  }

  async function handleKeyDown(e, item, index) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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

    if (e.key === 'Backspace' && !item.body.trim() && items.length > 1) {
      e.preventDefault();
      const focusId = items[index - 1]?.id;
      await removeItem(item.id);
      if (focusId) {
        requestAnimationFrame(() => document.getElementById(`hub-doc-${focusId}`)?.focus());
      }
    }
  }

  if (loading) {
    return <p className="text-on-surface-variant text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-3xl">
      {error && <p className="text-error text-sm mb-4">{error}</p>}

      {items.length === 0 ? (
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
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={item.id} className="group flex items-start gap-3 py-1.5">
              <span className="text-lg leading-6 text-on-surface-variant select-none mt-0.5">•</span>
              <div className="flex-1 min-w-0">
                <textarea
                  id={`hub-doc-${item.id}`}
                  value={item.body}
                  rows={1}
                  onChange={(e) => {
                    updateLocal(item.id, e.target.value);
                    autoResize(e.target);
                  }}
                  onBlur={(e) => saveItem(item.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, item, index)}
                  onFocus={(e) => autoResize(e.target)}
                  ref={(el) => el && autoResize(el)}
                  className="w-full resize-none overflow-hidden bg-transparent text-base leading-6 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
                  placeholder="Type a bullet…"
                />
                {item.updated_by_name && (
                  <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                    {item.updated_by_name}
                  </p>
                )}
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
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <button
          type="button"
          onClick={() => addItem('')}
          className="mt-4 text-sm font-semibold text-secondary hover:underline"
        >
          + Add bullet
        </button>
      )}
    </div>
  );
}
