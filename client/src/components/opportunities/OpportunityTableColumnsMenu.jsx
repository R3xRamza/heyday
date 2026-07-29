import { useEffect, useRef, useState } from 'react';
import { Columns3, GripVertical, RotateCcw, Lock } from 'lucide-react';
import {
  columnsForKind,
  toggleColumnHidden,
  reorderColumn,
} from '../../utils/opportunityTablePrefs';

export default function OpportunityTableColumnsMenu({
  kind,
  prefs,
  onChange,
  onReset,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const dragId = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cols = columnsForKind(kind);
  const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
  const ordered = prefs.columnOrder.map((id) => byId[id]).filter(Boolean);
  const hidden = new Set(prefs.hidden || []);

  function onDragStart(id, e) {
    const col = byId[id];
    if (!col || col.pinned) {
      e.preventDefault();
      return;
    }
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(targetId, e) {
    e.preventDefault();
    const from = dragId.current || e.dataTransfer.getData('text/plain');
    dragId.current = null;
    if (!from || from === targetId) return;
    onChange(reorderColumn(prefs, from, targetId, kind));
  }

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border rounded-lg transition-colors whitespace-nowrap ${
          open
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low hover:text-primary'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Columns3 size={14} />
        Columns
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border border-outline-variant/30 rounded-lg bg-white text-on-surface-variant hover:bg-surface-container-low hover:text-primary whitespace-nowrap"
        title="Reset columns to defaults"
      >
        <RotateCcw size={14} />
        Reset
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Table columns"
          className="absolute right-0 top-full mt-1 z-40 w-72 bg-white border border-outline-variant/20 rounded-xl shadow-executive p-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Show &amp; reorder
          </p>
          <ul className="space-y-0.5 max-h-80 overflow-y-auto custom-scrollbar">
            {ordered.map((col) => {
              const pinned = Boolean(col.pinned);
              const checked = !hidden.has(col.id);
              return (
                <li
                  key={col.id}
                  draggable={!pinned}
                  onDragStart={(e) => onDragStart(col.id, e)}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(col.id, e)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                    pinned ? 'bg-surface-container-low/60' : 'hover:bg-surface-container-low cursor-grab active:cursor-grabbing'
                  }`}
                >
                  <span className={`shrink-0 ${pinned ? 'text-on-surface-variant/40' : 'text-on-surface-variant'}`}>
                    {pinned ? <Lock size={14} /> : <GripVertical size={14} />}
                  </span>
                  <label className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pinned}
                      onChange={() => onChange(toggleColumnHidden(prefs, col.id, kind))}
                      className="rounded border-outline-variant text-secondary"
                    />
                    <span className="text-sm text-primary truncate">
                      {col.id === 'actions' ? 'Edit / Delete' : col.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
