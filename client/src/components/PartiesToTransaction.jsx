import { useState, useEffect, useMemo } from 'react';
import Icon from './shared/Icon';
import {
  composePartyRows,
  customRoleKey,
} from '../data/transactionParties';

export default function PartiesToTransaction({
  parties = [],
  transaction = null,
  agentName = '',
  onSave,
  error = '',
}) {
  const composed = useMemo(
    () => composePartyRows(transaction, parties, agentName),
    [transaction, parties, agentName],
  );

  const [rows, setRows] = useState(composed);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftRole, setDraftRole] = useState('');
  const [draftName, setDraftName] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setRows(composed);
  }, [composed]);

  function updateName(index, name) {
    setRows((prev) => prev.map((p, i) => (i === index ? { ...p, name } : p)));
  }

  async function commit(nextRows) {
    if (!onSave) return;
    setSaving(true);
    setLocalError('');
    try {
      const payload = nextRows.map(({ role, name, user_id }) => ({ role, name, user_id }));
      const result = await onSave(payload);
      if (result?.ok === false || result?.error) {
        setLocalError(result.error || result.message || 'Could not save parties.');
        setRows(composed);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    const changed = rows.some((r, i) => {
      const prev = composed[i];
      if (!prev) return true;
      return r.role !== prev.role || (r.name || '') !== (prev.name || '');
    }) || rows.length !== composed.length;
    if (changed) commit(rows);
  }

  function startAdd() {
    setAdding(true);
    setDraftRole('');
    setDraftName('');
    setLocalError('');
  }

  function cancelAdd() {
    setAdding(false);
    setDraftRole('');
    setDraftName('');
  }

  async function confirmAdd() {
    const label = draftRole.trim();
    const name = draftName.trim();
    if (!label) {
      setLocalError('Enter a role for the new party.');
      return;
    }
    let role = customRoleKey(label);
    // Ensure unique role key
    const existing = new Set(rows.map((r) => r.role));
    if (existing.has(role)) {
      let n = 2;
      while (existing.has(`${role} (${n})`)) n += 1;
      role = `${role} (${n})`;
    }
    const next = [
      ...rows,
      {
        role,
        label,
        name,
        user_id: null,
        is_team: false,
        is_fixed: false,
      },
    ];
    setRows(next);
    setAdding(false);
    setDraftRole('');
    setDraftName('');
    await commit(next);
  }

  async function removeRow(index) {
    const party = rows[index];
    if (!party || party.is_fixed) return;
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    await commit(next);
  }

  const displayError = error || localError;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
          Parties to Transaction
        </h3>
        <button
          type="button"
          onClick={startAdd}
          className="ml-auto w-7 h-7 rounded-full border border-outline-variant/40 text-on-surface-variant hover:border-secondary hover:text-secondary flex items-center justify-center text-lg leading-none"
          title="Add a party"
          aria-label="Add a party"
        >
          +
        </button>
        {saving && <span className="text-[10px] text-on-surface-variant">Saving…</span>}
      </div>

      {displayError && (
        <p className="text-xs text-error mb-2" role="alert">{displayError}</p>
      )}

      <ul className="divide-y divide-outline-variant/15">
        {rows.map((party, i) => {
          const isAgent = party.role === 'agent' || party.role === 'listing_agent';
          return (
            <li key={`${party.role}-${i}`} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <input
                  value={party.name || ''}
                  onChange={(e) => updateName(i, e.target.value)}
                  onBlur={handleBlur}
                  readOnly={isAgent}
                  placeholder={party.label}
                  title={isAgent ? 'Change agent in Transaction Details' : undefined}
                  className={`flex-1 min-w-0 text-sm font-medium text-primary bg-transparent border-0 outline-none placeholder:text-on-surface-variant/50 focus:ring-0 p-0 ${
                    isAgent ? 'cursor-default opacity-90' : ''
                  }`}
                />
                {(party.is_team || isAgent) && (
                  <Icon name="person" className="!text-[16px] text-on-surface-variant shrink-0" />
                )}
              </div>
              <span className="text-xs text-on-surface-variant shrink-0 pl-2">
                {party.label}
              </span>
              {!party.is_fixed && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-xs text-on-surface-variant hover:text-error shrink-0 px-1"
                  aria-label={`Remove ${party.label}`}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="mt-3 p-3 rounded-lg border border-secondary/40 bg-secondary/5 space-y-2">
          <input
            type="text"
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value)}
            placeholder="Role (e.g. Title officer)"
            className="w-full px-2 py-1.5 text-sm rounded border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelAdd();
              if (e.key === 'Enter') confirmAdd();
            }}
          />
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Name"
            className="w-full px-2 py-1.5 text-sm rounded border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary/30"
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelAdd();
              if (e.key === 'Enter') confirmAdd();
            }}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelAdd} className="text-xs font-semibold text-on-surface-variant px-2 py-1">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAdd}
              className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
