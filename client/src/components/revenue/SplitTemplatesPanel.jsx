import { useState, useEffect, useCallback } from 'react';
import Icon from '../shared/Icon';

const AGENTS = [
  { key: 'meredith', label: 'Meredith' },
  { key: 'tessa', label: 'Tessa' },
  { key: 'margaret', label: 'Margaret' },
  { key: 'adam', label: 'Adam' },
];

const EMPTY = {
  capAmount: 16000,
  splitRate: 0.2,
  brokerReviewFee: 25,
  riskManagementFee: 60,
  riskManagementAnnualCap: 750,
  cappedTransactionFee: 250,
  cappedTransactionFeeReduced: 75,
  cappedFeesStepDownAt: 5000,
  tessaRate: 0.04,
  margaretRate: 0.03,
};

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

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</span>
      {children}
      {hint && <p className="text-[10px] text-on-surface-variant mt-1">{hint}</p>}
    </label>
  );
}

function MoneyInput({ value, onChange }) {
  return (
    <div className="relative mt-1.5">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={moneyDisplay(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          if (raw === '' || raw === '.') {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/30"
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
        className="w-full pl-3 pr-8 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/30"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">%</span>
    </div>
  );
}

export default function SplitTemplatesPanel({ onSaved }) {
  const [templates, setTemplates] = useState([]);
  const [agentKey, setAgentKey] = useState('meredith');
  const [draft, setDraft] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/revenue/templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
      })
      .catch(() => setError('Could not load templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const current = templates.find((t) => t.agent_key === agentKey);
    if (current?.settings) setDraft({ ...EMPTY, ...current.settings });
  }, [agentKey, templates]);

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setSavedFlash(false);
  }

  async function save() {
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
    setDraft({ ...EMPTY, ...json.settings });
    setSavedFlash(true);
    onSaved?.();
  }

  return (
    <section className="bg-white rounded-xl border border-outline-variant/15 shadow-executive overflow-hidden">
      <div className="bg-gradient-to-r from-feather to-feather/90 px-4 py-3 flex items-center gap-2">
        <Icon name="tune" className="text-lemon !text-[18px]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">Revenue split templates</h3>
          <p className="text-[11px] text-white/70">Per-agent eXp fees &amp; team splits — used on Revenue and each deal&apos;s Commission tab</p>
        </div>
        {savedFlash && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-lemon">Saved</span>
        )}
      </div>

      <div className="px-4 pt-3 flex flex-wrap gap-1.5 border-b border-primary/5 pb-3">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAgentKey(a.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              agentKey === a.key
                ? 'bg-secondary text-white shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-6 animate-pulse space-y-3">
          <div className="h-10 bg-surface-container-low rounded-lg" />
          <div className="h-10 bg-surface-container-low rounded-lg" />
          <div className="h-10 bg-surface-container-low rounded-lg" />
        </div>
      ) : (
        <div className="p-4 space-y-5">
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
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Fixed eXp fees</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Broker review">
                <MoneyInput value={draft.brokerReviewFee} onChange={(v) => patch('brokerReviewFee', v)} />
              </Field>
              <Field label="Risk mgmt / deal">
                <MoneyInput value={draft.riskManagementFee} onChange={(v) => patch('riskManagementFee', v)} />
              </Field>
              <Field label="Risk annual cap">
                <MoneyInput value={draft.riskManagementAnnualCap} onChange={(v) => patch('riskManagementAnnualCap', v)} />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">After cap</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Capped trans fee">
                <MoneyInput value={draft.cappedTransactionFee} onChange={(v) => patch('cappedTransactionFee', v)} />
              </Field>
              <Field label="Reduced fee">
                <MoneyInput value={draft.cappedTransactionFeeReduced} onChange={(v) => patch('cappedTransactionFeeReduced', v)} />
              </Field>
              <Field label="Step-down after" hint="Capped fees paid YTD">
                <MoneyInput value={draft.cappedFeesStepDownAt} onChange={(v) => patch('cappedFeesStepDownAt', v)} />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Team splits (of post-split)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Tessa">
                <PctInput value={draft.tessaRate} onChange={(v) => patch('tessaRate', v)} />
              </Field>
              <Field label="Margaret">
                <PctInput value={draft.margaretRate} onChange={(v) => patch('margaretRate', v)} />
              </Field>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-primary/5">
            <p className="text-[11px] text-on-surface-variant">
              Editing <span className="font-bold text-primary">{AGENTS.find((a) => a.key === agentKey)?.label}</span>
              {' · '}changes apply immediately to analytics &amp; deal commission
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving}
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
