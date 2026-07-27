import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Icon from '../shared/Icon';

const APPLY_OPTIONS = [
  { value: 'always', label: 'Always' },
  { value: 'before_cap', label: 'Before cap' },
  { value: 'after_cap', label: 'After cap' },
];

function emptyFee() {
  return {
    id: `fee_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    label: '',
    amount: 0,
    unit: 'amount',
    apply: 'always',
    annualCap: null,
    stepDownAt: null,
    reducedAmount: null,
  };
}

function emptySplit() {
  return {
    id: `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    label: '',
    userId: null,
    rate: 0,
  };
}

function defaultDraft() {
  return {
    capAmount: 16000,
    splitRate: 0.2,
    feeLines: [],
    teamSplits: [],
  };
}

function pctDisplay(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10000) / 100);
}

function pctToRate(text) {
  if (text === '' || text == null) return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1, n / 100);
}

function moneyDisplay(n) {
  if (n == null || n === '') return '';
  return String(n);
}

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</span>
      {children}
      {hint && <p className="text-[10px] text-on-surface-variant mt-1">{hint}</p>}
    </label>
  );
}

function MoneyInput({ value, onChange, allowEmpty }) {
  return (
    <div className="relative mt-1.5">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value == null || value === '' ? '' : moneyDisplay(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          if (raw === '' || raw === '.') {
            onChange(allowEmpty ? null : 0);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full pl-7 pr-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/30"
      />
    </div>
  );
}

function PctInput({ value, onChange }) {
  return (
    <div className="relative mt-1.5">
      <input
        type="text"
        inputMode="decimal"
        value={pctDisplay(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          onChange(pctToRate(raw === '' || raw === '.' ? '0' : raw));
        }}
        className="w-full pl-3 pr-8 py-2 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/30"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">%</span>
    </div>
  );
}

const INPUT = 'w-full mt-1.5 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/30';

export default function SplitTemplatesPanel({ onSaved }) {
  const [templates, setTemplates] = useState([]);
  const [agentKey, setAgentKey] = useState('meredith');
  const [draft, setDraft] = useState(defaultDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const [team, setTeam] = useState([]);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addLabel, setAddLabel] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/revenue/templates', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/team', { credentials: 'include' }).then((r) => r.json()).catch(() => ({ members: [] })),
    ])
      .then(([tmpl, teamJson]) => {
        setTemplates(tmpl.templates || []);
        setTeam(teamJson.members || []);
      })
      .catch(() => setError('Could not load templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const current = templates.find((t) => t.agent_key === agentKey);
    if (current?.settings) {
      setDraft({
        capAmount: current.settings.capAmount,
        splitRate: current.settings.splitRate,
        feeLines: (current.settings.feeLines || []).map((f) => ({ ...f })),
        teamSplits: (current.settings.teamSplits || []).map((s) => ({ ...s })),
      });
    }
  }, [agentKey, templates]);

  const active = templates.find((t) => t.agent_key === agentKey);
  const teamSum = useMemo(
    () => (draft.teamSplits || []).reduce((s, t) => s + (Number(t.rate) || 0), 0),
    [draft.teamSplits],
  );

  const usedUserIds = useMemo(() => {
    const set = new Set();
    for (const t of templates) {
      if (t.user_id != null) set.add(Number(t.user_id));
    }
    // Also mark seeded emails' users if present
    for (const m of team) {
      const email = String(m.email || '').toLowerCase();
      if (
        email === 'meredith@theheydaygroup.com'
        || email === 'tessa@theheydaygroup.com'
        || email === 'margaret@theheydaygroup.com'
        || email === 'adam@theheydaygroup.com'
      ) {
        set.add(Number(m.id));
      }
    }
    return set;
  }, [templates, team]);

  const availableMembers = team.filter((m) => !usedUserIds.has(Number(m.id)));

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setSavedFlash(false);
  }

  function patchFee(index, field, value) {
    setDraft((prev) => {
      const feeLines = prev.feeLines.map((f, i) => (i === index ? { ...f, [field]: value } : f));
      return { ...prev, feeLines };
    });
    setSavedFlash(false);
  }

  function patchSplit(index, field, value) {
    setDraft((prev) => {
      const teamSplits = prev.teamSplits.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      return { ...prev, teamSplits };
    });
    setSavedFlash(false);
  }

  async function save() {
    if (teamSum > 1.0001) {
      setError('Team split rates cannot total more than 100%');
      return;
    }
    for (const f of draft.feeLines) {
      if (!String(f.label || '').trim()) {
        setError('Every fee line needs a label');
        return;
      }
    }
    for (const s of draft.teamSplits) {
      if (!String(s.label || '').trim()) {
        setError('Every team split needs a label');
        return;
      }
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/revenue/templates/${agentKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ settings: draft }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || 'Could not save');
      return;
    }
    setTemplates((prev) => prev.map((t) => (
      t.agent_key === agentKey ? { ...t, settings: json.settings } : t
    )));
    setDraft({
      capAmount: json.settings.capAmount,
      splitRate: json.settings.splitRate,
      feeLines: (json.settings.feeLines || []).map((f) => ({ ...f })),
      teamSplits: (json.settings.teamSplits || []).map((s) => ({ ...s })),
    });
    setSavedFlash(true);
    onSaved?.();
  }

  async function createTemplate() {
    setError(null);
    const body = addUserId
      ? { user_id: Number(addUserId) }
      : { label: addLabel.trim() };
    if (!addUserId && !addLabel.trim()) {
      setError('Pick a team member or enter a label');
      return;
    }
    const res = await fetch('/api/revenue/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not create template');
      return;
    }
    setTemplates((prev) => [...prev, json]);
    setAgentKey(json.agent_key);
    setShowAddAgent(false);
    setAddUserId('');
    setAddLabel('');
  }

  async function removeTemplate() {
    if (!active || active.seeded) return;
    if (!window.confirm(`Delete template for ${active.label}?`)) return;
    const res = await fetch(`/api/revenue/templates/${agentKey}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not delete');
      return;
    }
    const next = templates.filter((t) => t.agent_key !== agentKey);
    setTemplates(next);
    setAgentKey(next[0]?.agent_key || 'meredith');
  }

  return (
    <section className="bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
      <div className="bg-gradient-to-r from-feather to-feather/90 px-4 py-3 flex items-center gap-2">
        <Icon name="tune" className="text-lemon !text-[18px]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">Revenue split templates</h3>
          <p className="text-[11px] text-white/70">
            Custom fees &amp; team splits per agent — used on Revenue and each deal&apos;s Commission tab
          </p>
        </div>
        {savedFlash && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-lemon">Saved</span>
        )}
      </div>

      <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5 border-b border-primary/5 pb-3">
        {templates.map((a) => (
          <button
            key={a.agent_key}
            type="button"
            onClick={() => setAgentKey(a.agent_key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              agentKey === a.agent_key
                ? 'bg-secondary text-white shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
            }`}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAddAgent((v) => !v)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-lemon/20 text-feather hover:bg-lemon/30"
        >
          <Plus size={14} /> Add agent
        </button>
        {active && !active.seeded && (
          <button
            type="button"
            onClick={removeTemplate}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-error hover:bg-error/10"
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      {showAddAgent && (
        <div className="px-4 py-3 border-b border-primary/5 bg-surface-container-low/40 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">New agent template</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Team member">
              <select
                className={INPUT}
                value={addUserId}
                onChange={(e) => {
                  setAddUserId(e.target.value);
                  if (e.target.value) setAddLabel('');
                }}
              >
                <option value="">— Optional —</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Or custom label" hint="Used if no team member selected">
              <input
                className={INPUT}
                value={addLabel}
                disabled={Boolean(addUserId)}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="e.g. New agent"
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createTemplate}
              className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wide"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowAddAgent(false)}
              className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 animate-pulse space-y-3">
          <div className="h-10 bg-surface-container-low rounded-lg" />
          <div className="h-10 bg-surface-container-low rounded-lg" />
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {error && (
            <p className="text-sm text-error font-semibold" role="alert">{error}</p>
          )}

          <div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">eXp sliding scale</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Split rate" hint="Of GCI until cap">
                <PctInput value={draft.splitRate} onChange={(v) => patch('splitRate', v)} />
              </Field>
              <Field label="Anniversary cap" hint="Dec 1 → Nov 30">
                <MoneyInput value={draft.capAmount} onChange={(v) => patch('capAmount', v)} />
              </Field>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Fee lines</p>
              <button
                type="button"
                onClick={() => patch('feeLines', [...(draft.feeLines || []), emptyFee()])}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary hover:underline"
              >
                <Plus size={12} /> Add fee
              </button>
            </div>
            {(draft.feeLines || []).length === 0 ? (
              <p className="text-sm text-on-surface-variant py-3">No fee lines. Add a fee to include eXp or other charges.</p>
            ) : (
              <ul className="space-y-3">
                {draft.feeLines.map((fee, index) => (
                  <li key={fee.id} className="p-3 rounded-lg border border-outline-variant/15 bg-surface-container-low/30 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <Field label="Label" className="md:col-span-4">
                        <input
                          className={INPUT}
                          value={fee.label || ''}
                          onChange={(e) => patchFee(index, 'label', e.target.value)}
                        />
                      </Field>
                      <Field label="Amount" className="md:col-span-2">
                        {fee.unit === 'percent' ? (
                          <div className="relative mt-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full pl-3 pr-8 py-2 rounded-lg bg-white border border-outline-variant/15 text-sm font-semibold"
                              value={fee.amount ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, '');
                                patchFee(index, 'amount', raw === '' ? 0 : Number(raw));
                              }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">%</span>
                          </div>
                        ) : (
                          <MoneyInput value={fee.amount} onChange={(v) => patchFee(index, 'amount', v)} />
                        )}
                      </Field>
                      <Field label="Unit" className="md:col-span-2">
                        <select
                          className={INPUT}
                          value={fee.unit || 'amount'}
                          onChange={(e) => patchFee(index, 'unit', e.target.value)}
                        >
                          <option value="amount">$</option>
                          <option value="percent">% of GCI</option>
                        </select>
                      </Field>
                      <Field label="When" className="md:col-span-3">
                        <select
                          className={INPUT}
                          value={fee.apply || 'always'}
                          onChange={(e) => patchFee(index, 'apply', e.target.value)}
                        >
                          {APPLY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </Field>
                      <div className="md:col-span-1 flex justify-end pb-1">
                        <button
                          type="button"
                          onClick={() => patch('feeLines', draft.feeLines.filter((_, i) => i !== index))}
                          className="p-2 rounded text-on-surface-variant hover:text-error hover:bg-error/10"
                          aria-label="Remove fee"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Field label="Annual cap" hint="Optional anniversary-year ceiling">
                        <MoneyInput
                          value={fee.annualCap}
                          allowEmpty
                          onChange={(v) => patchFee(index, 'annualCap', v)}
                        />
                      </Field>
                      <Field label="Step-down after" hint="YTD $ of this fee paid">
                        <MoneyInput
                          value={fee.stepDownAt}
                          allowEmpty
                          onChange={(v) => patchFee(index, 'stepDownAt', v)}
                        />
                      </Field>
                      <Field label="Reduced amount" hint="Used after step-down">
                        <MoneyInput
                          value={fee.reducedAmount}
                          allowEmpty
                          onChange={(v) => patchFee(index, 'reducedAmount', v)}
                        />
                      </Field>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                Team splits (of post-split)
              </p>
              <button
                type="button"
                onClick={() => patch('teamSplits', [...(draft.teamSplits || []), emptySplit()])}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary hover:underline"
              >
                <Plus size={12} /> Add split
              </button>
            </div>
            {(draft.teamSplits || []).length === 0 ? (
              <p className="text-sm text-on-surface-variant py-3">No team splits.</p>
            ) : (
              <ul className="space-y-2">
                {draft.teamSplits.map((split, index) => (
                  <li key={split.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 rounded-lg border border-outline-variant/15">
                    <Field label="Name" className="md:col-span-4">
                      <input
                        className={INPUT}
                        value={split.label || ''}
                        onChange={(e) => patchSplit(index, 'label', e.target.value)}
                      />
                    </Field>
                    <Field label="Team member" className="md:col-span-4" hint="Optional link">
                      <select
                        className={INPUT}
                        value={split.userId ?? ''}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : null;
                          const member = team.find((m) => Number(m.id) === id);
                          setDraft((prev) => {
                            const teamSplits = prev.teamSplits.map((s, i) => (
                              i === index
                                ? {
                                  ...s,
                                  userId: id,
                                  label: member?.name || s.label,
                                }
                                : s
                            ));
                            return { ...prev, teamSplits };
                          });
                          setSavedFlash(false);
                        }}
                      >
                        <option value="">—</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Rate" className="md:col-span-3">
                      <PctInput value={split.rate} onChange={(v) => patchSplit(index, 'rate', v)} />
                    </Field>
                    <div className="md:col-span-1 flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => patch('teamSplits', draft.teamSplits.filter((_, i) => i !== index))}
                        className="p-2 rounded text-on-surface-variant hover:text-error hover:bg-error/10"
                        aria-label="Remove split"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {teamSum > 1.0001 && (
              <p className="text-xs text-error font-semibold mt-2" role="alert">
                Team splits total {pctDisplay(teamSum)}% — must be ≤ 100%
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-primary/5">
            <p className="text-[11px] text-on-surface-variant">
              Editing <span className="font-bold text-primary">{active?.label || agentKey}</span>
              {' · '}changes apply to analytics &amp; deal commission
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving || teamSum > 1.0001}
              className="px-4 py-2 rounded-lg bg-lemon text-feather text-xs font-black uppercase tracking-wide disabled:opacity-50 hover:brightness-95 transition"
            >
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
