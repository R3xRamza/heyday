import { useState, useEffect } from 'react';
import { formatCurrency, formatPriceInput, parsePriceInput } from '../utils/format';

export default function TransactionPriceHeader({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!editing) setDraft(formatPriceInput(value));
  }, [value, editing]);

  function commit() {
    const num = parsePriceInput(draft);
    if (num !== value) onSave?.(num);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-bold text-feather">$</span>
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(formatPriceInput(value));
              setEditing(false);
            }
          }}
          className="text-lg font-bold text-feather bg-off-white border border-outline-variant/30 rounded-lg px-2 py-1 outline-none w-32 text-right focus:ring-2 focus:ring-feather/20"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-right group"
      title="Click to edit sales price"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant group-hover:text-feather">
        Sales Price
      </p>
      <p className="text-lg font-bold text-feather tabular-nums">{formatCurrency(value)}</p>
    </button>
  );
}
