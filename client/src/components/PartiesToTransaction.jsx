import { useState, useEffect } from 'react';
import Icon from './shared/Icon';
import { buildFallbackParties } from '../data/transactionParties';

export default function PartiesToTransaction({
  parties = [],
  transaction = null,
  onSave,
}) {
  const [rows, setRows] = useState(() =>
    parties.length ? parties : buildFallbackParties(transaction)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (parties.length) {
      setRows(parties);
    } else if (transaction) {
      setRows(buildFallbackParties(transaction));
    }
  }, [parties, transaction]);

  function updateName(index, name) {
    setRows((prev) => prev.map((p, i) => (i === index ? { ...p, name } : p)));
  }

  async function commit() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(rows.map(({ role, name, user_id }) => ({ role, name, user_id })));
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    const changed = rows.some((r, i) => r.name !== (parties[i]?.name ?? ''));
    if (changed) commit();
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
          Parties to Transaction
        </h3>
        {saving && <span className="ml-auto text-[10px] text-on-surface-variant">Saving…</span>}
      </div>

      <ul className="divide-y divide-outline-variant/15">
        {rows.map((party, i) => (
          <li key={party.role} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <input
                value={party.name || ''}
                onChange={(e) => updateName(i, e.target.value)}
                onBlur={handleBlur}
                placeholder={party.label}
                className="flex-1 min-w-0 text-sm font-medium text-primary bg-transparent border-0 outline-none placeholder:text-on-surface-variant/50 focus:ring-0 p-0"
              />
              {party.is_team && (
                <Icon name="person" className="!text-[16px] text-on-surface-variant shrink-0" />
              )}
            </div>
            <span className="text-xs text-on-surface-variant shrink-0 pl-2">
              {party.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
