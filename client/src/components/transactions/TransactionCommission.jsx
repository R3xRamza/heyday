import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../shared/Icon';
import { formatCurrency } from '../../utils/format';

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.abs(n % 1) > 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDateLabel(ymd) {
  if (!ymd) return '—';
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ProgressBar({ value, max, tone = 'secondary' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar = tone === 'lemon' ? 'bg-lemon' : tone === 'feather' ? 'bg-primary-container' : 'bg-secondary';
  return (
    <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function UnitToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant/20 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange('amount')}
        className={`px-2.5 py-1.5 text-xs font-bold ${
          value === 'amount' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
        }`}
      >
        $
      </button>
      <button
        type="button"
        onClick={() => onChange('percent')}
        className={`px-2.5 py-1.5 text-xs font-bold ${
          value === 'percent' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
        }`}
      >
        %
      </button>
    </div>
  );
}

function UnitValueField({
  label,
  value,
  unit = 'amount',
  onChange,
  onBlur,
  onUnitChange,
  placeholder = '0',
  helper,
}) {
  const [text, setText] = useState(value == null || value === '' ? '' : String(value));

  useEffect(() => {
    setText(value == null || value === '' ? '' : String(value));
  }, [value]);

  return (
    <label className="block">
      {label && (
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</span>
      )}
      <div className={`flex items-stretch gap-2 ${label ? 'mt-1.5' : ''}`}>
        <div className="relative flex-1 min-w-0">
          {unit === 'amount' ? (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
          ) : null}
          <input
            type="text"
            inputMode="decimal"
            value={text}
            placeholder={placeholder}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, '');
              setText(raw);
              if (raw === '' || raw === '.') {
                onChange(null);
                return;
              }
              const n = Number(raw);
              if (!Number.isNaN(n)) onChange(n);
            }}
            onBlur={() => onBlur?.(text === '' || text === '.' ? null : Number(text))}
            className={`w-full py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/30 ${
              unit === 'amount' ? 'pl-7 pr-3' : 'pl-3 pr-8'
            }`}
          />
          {unit === 'percent' ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">%</span>
          ) : null}
        </div>
        {onUnitChange && <UnitToggle value={unit} onChange={onUnitChange} />}
      </div>
      {helper && <p className="text-[11px] text-on-surface-variant mt-1">{helper}</p>}
    </label>
  );
}

let feeSeq = 0;
function newFeeId() {
  feeSeq += 1;
  return `fee_${Date.now()}_${feeSeq}`;
}

export default function TransactionCommission({ transactionId, salesPrice, onTransactionPatch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [gciMode, setGciMode] = useState('amount');
  const [gciAmount, setGciAmount] = useState(null);
  const [gciPercent, setGciPercent] = useState(null);
  const [customFees, setCustomFees] = useState([]);
  const saveTimer = useRef(null);

  const applyServer = useCallback((json) => {
    setData(json);
    setGciMode(json.gci_mode === 'percent' ? 'percent' : 'amount');
    setGciAmount(json.gross_commission);
    setGciPercent(json.gci_percent);
    setCustomFees(json.custom_fees?.length ? json.custom_fees : []);
  }, []);

  const load = useCallback(async () => {
    setError('');
    const res = await fetch(`/api/transactions/${transactionId}/commission`, { credentials: 'include' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Could not load commission');
      setLoading(false);
      return;
    }
    const json = await res.json();
    applyServer(json);
    setLoading(false);
  }, [transactionId, applyServer]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Refresh when sales price changes (percent GCI depends on it).
  useEffect(() => {
    if (!loading && gciMode === 'percent') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesPrice]);

  const persist = useCallback(async (patch) => {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/transactions/${transactionId}/commission`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || 'Could not save');
      return;
    }
    applyServer(json);
    if (onTransactionPatch && json.gross_commission !== undefined) {
      onTransactionPatch({ gross_commission: json.gross_commission });
    }
  }, [transactionId, onTransactionPatch, applyServer]);

  function schedulePersist(patch) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(patch), 400);
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading commission…</p>;
  }

  const progress = data?.progress;
  const breakdown = data?.breakdown;
  const anniversary = data?.anniversary;
  const price = salesPrice ?? data?.sales_price;

  function switchGciMode(nextMode) {
    if (nextMode === gciMode) return;
    if (nextMode === 'percent') {
      let pct = gciPercent;
      if ((pct == null || pct === '') && price > 0 && gciAmount != null) {
        pct = Math.round((Number(gciAmount) / Number(price)) * 10000) / 100;
      }
      setGciMode('percent');
      setGciPercent(pct);
      persist({ gci_mode: 'percent', gci_percent: pct });
    } else {
      setGciMode('amount');
      persist({
        gci_mode: 'amount',
        gross_commission: gciAmount ?? data?.gross_commission ?? null,
      });
    }
  }

  function gciHelper() {
    if (price == null) {
      return gciMode === 'percent'
        ? 'Set a sales price to use % of price'
        : 'Enter gross commission to calculate';
    }
    if (gciMode === 'percent') {
      const resolved = gciPercent != null ? (Number(price) * Number(gciPercent)) / 100 : null;
      return `Sales price ${formatCurrency(price)}${resolved != null ? ` → GCI ${formatMoney(resolved)}` : ''}`;
    }
    return `Sales price ${formatCurrency(price)}`;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-error font-semibold" role="alert">{error}</p>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
                Gross Commission
              </h3>
              {saving && <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">Saving…</span>}
            </div>
            <UnitValueField
              label="GCI"
              unit={gciMode}
              value={gciMode === 'percent' ? gciPercent : gciAmount}
              placeholder={gciMode === 'percent' ? 'e.g. 3' : 'Enter GCI'}
              helper={gciHelper()}
              onUnitChange={switchGciMode}
              onChange={(n) => {
                if (gciMode === 'percent') setGciPercent(n);
                else setGciAmount(n);
              }}
              onBlur={(n) => {
                if (gciMode === 'percent') {
                  setGciPercent(n);
                  persist({ gci_mode: 'percent', gci_percent: n });
                } else {
                  setGciAmount(n);
                  persist({ gci_mode: 'amount', gross_commission: n });
                }
              }}
            />
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive border-l-4 border-l-secondary">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
                Anniversary Year
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                progress?.plan === 'after_cap'
                  ? 'bg-secondary/15 text-secondary'
                  : 'bg-primary-container/15 text-primary-container'
              }`}
              >
                {progress?.plan === 'after_cap' ? 'After cap' : 'Before cap'}
              </span>
            </div>
            <p className="text-sm text-primary font-semibold mb-4">
              {formatDateLabel(anniversary?.start)} – {formatDateLabel(anniversary?.end)}
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-on-surface-variant font-semibold">eXp split paid</span>
                  <span className="tabular-nums font-bold text-primary">
                    {formatMoney(progress?.capPaid)} / {formatMoney(progress?.capAmount)}
                  </span>
                </div>
                <ProgressBar value={progress?.capPaid || 0} max={progress?.capAmount || 16000} tone="feather" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-on-surface-variant font-semibold">Risk management</span>
                  <span className="tabular-nums font-bold text-primary">
                    {formatMoney(progress?.riskPaid)} / {formatMoney(progress?.riskCap)}
                  </span>
                </div>
                <ProgressBar value={progress?.riskPaid || 0} max={progress?.riskCap || 750} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-on-surface-variant font-semibold">Capped-trans fees</span>
                  <span className="tabular-nums font-bold text-primary">
                    {formatMoney(progress?.cappedFeesPaid)} / {formatMoney(progress?.cappedFeesStepDownAt)}
                  </span>
                </div>
                <ProgressBar value={progress?.cappedFeesPaid || 0} max={progress?.cappedFeesStepDownAt || 5000} tone="lemon" />
                <p className="text-[11px] text-on-surface-variant mt-2">
                  Current capped fee rate:{' '}
                  <span className="font-semibold text-primary">
                    {progress?.plan === 'after_cap' ? formatMoney(progress?.cappedFeeRate || 250) : '— (before cap)'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-6 shadow-executive">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-4">
              Fee Breakdown
            </h3>
            {!data?.hasGci || !breakdown ? (
              <div className="rounded-lg bg-surface-container-low/80 border border-dashed border-outline-variant/30 px-4 py-8 text-center mb-5">
                <Icon name="payments" className="!text-[28px] text-on-surface-variant/50 mb-2" />
                <p className="text-sm text-on-surface-variant font-semibold">Enter GCI to calculate this deal</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {gciMode === 'percent' && price == null
                    ? 'Percent GCI needs a sales price.'
                    : 'No numbers are invented until gross commission is set.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm font-bold text-primary mb-3">
                  <span>Gross commission</span>
                  <span className="tabular-nums">{formatMoney(breakdown.gci)}</span>
                </div>
                <ul className="space-y-2 border-t border-outline-variant/10 pt-3">
                  {breakdown.lines
                    .filter((line) => !String(line.key).startsWith('custom_'))
                    .map((line) => (
                      <li key={line.key} className="flex justify-between text-sm gap-4">
                        <span className="text-on-surface-variant">{line.label}</span>
                        <span className={`tabular-nums font-semibold shrink-0 ${line.amount < 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {line.amount === 0 ? '$0' : formatMoney(line.amount)}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}

            <div className="mt-5 pt-4 border-t border-outline-variant/15 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Custom fees
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...customFees, { id: newFeeId(), label: '', amount: 0, unit: 'amount' }];
                      setCustomFees(next);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-secondary hover:bg-secondary/10"
                  >
                    <Icon name="add" className="!text-[16px]" />
                    Add fee
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">
                  % fees are calculated from GCI.
                </p>
                {customFees.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No custom fees yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {customFees.map((fee, index) => (
                      <li key={fee.id || index} className="flex flex-wrap gap-2 items-end">
                        <label className="flex-1 min-w-[8rem]">
                          <span className="sr-only">Label</span>
                          <input
                            type="text"
                            value={fee.label}
                            onChange={(e) => {
                              const next = customFees.map((f, i) => (i === index ? { ...f, label: e.target.value } : f));
                              setCustomFees(next);
                            }}
                            onBlur={(e) => {
                              const next = customFees.map((f, i) => (i === index ? { ...f, label: e.target.value } : f));
                              setCustomFees(next);
                              schedulePersist({ custom_fees: next });
                            }}
                            placeholder="Fee name"
                            className="w-full px-3 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                          />
                        </label>
                        <div className="w-[11.5rem]">
                          <UnitValueField
                            unit={fee.unit === 'percent' ? 'percent' : 'amount'}
                            value={fee.amount}
                            onUnitChange={(unit) => {
                              const next = customFees.map((f, i) => (i === index ? { ...f, unit } : f));
                              setCustomFees(next);
                              persist({ custom_fees: next });
                            }}
                            onChange={(amount) => {
                              const next = customFees.map((f, i) => (
                                i === index ? { ...f, amount: amount == null ? 0 : amount } : f
                              ));
                              setCustomFees(next);
                            }}
                            onBlur={(amount) => {
                              const next = customFees.map((f, i) => (
                                i === index ? { ...f, amount: amount == null ? 0 : amount } : f
                              ));
                              setCustomFees(next);
                              schedulePersist({ custom_fees: next });
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = customFees.filter((_, i) => i !== index);
                            setCustomFees(next);
                            persist({ custom_fees: next });
                          }}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/5"
                          title="Remove fee"
                          aria-label="Remove fee"
                        >
                          <Icon name="delete" className="!text-[18px]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {breakdown && (
              <div className="mt-5 pt-4 border-t border-outline-variant/15 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant uppercase tracking-wide font-semibold">Post-split</span>
                  <span className="tabular-nums font-bold text-primary">{formatMoney(breakdown.postSplit)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant uppercase tracking-wide font-semibold">Total fees</span>
                  <span className="tabular-nums font-bold text-primary">
                    {formatMoney(breakdown.fixedFees + breakdown.customSum)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant uppercase tracking-wide font-semibold">Team splits</span>
                  <span className="tabular-nums font-bold text-primary">{formatMoney(breakdown.teamSplits)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-secondary pt-2 border-t border-primary/10">
                  <span>Net to Meredith</span>
                  <span className="tabular-nums">{formatMoney(breakdown.net)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
