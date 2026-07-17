import { useEffect, useState } from 'react';
import {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  BUYER_TIMINGS,
  normalizeBuyerStatus,
  normalizeBuyerTiming,
  normalizePreapproval,
  parsePriceAmount,
} from '../../utils/buyerOpportunity';

const INPUT =
  'w-full mt-1 px-3 py-3 md:py-2 border border-outline-variant/30 rounded text-base md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary/25';
const LABEL = 'text-xs font-semibold text-on-surface-variant uppercase';

const SELLER_STATUS_SUGGESTIONS = ['Upcoming', 'Pre-listing', 'LIVE', 'PRIVATE'];

const emptyBuyer = {
  status: 'active',
  buyer_name: '',
  location: '',
  timing: '',
  buyer_rep_signed: '',
  buyer_rep_dropbox: '',
  notes: '',
  lender: '',
  preapproval: '',
  showings: '',
  search_setup: '',
};

const emptySeller = {
  status: 'Upcoming',
  property_address: '',
  seller_name: '',
  timing: '',
  price_range: '',
  neighborhood: '',
  notes: '',
};

function Field({ label, children }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function dollarsToInput(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '';
  return String(Math.round(Number(n)));
}

function initBuyerForm(initial) {
  const base = { ...emptyBuyer, ...(initial || {}) };
  const min = base.price_min;
  const max = base.price_max;
  const isRange = min != null && max != null && Number(min) !== Number(max);
  return {
    ...base,
    status: normalizeBuyerStatus(base.status),
    timing: normalizeBuyerTiming(base.timing) || '',
    preapproval: normalizePreapproval(base.preapproval),
    priceMode: isRange ? 'range' : 'single',
    priceSingle: isRange
      ? ''
      : dollarsToInput(min ?? max),
    priceMinInput: isRange ? dollarsToInput(min) : '',
    priceMaxInput: isRange ? dollarsToInput(max) : '',
  };
}

export default function OpportunityForm({
  kind,
  initial = null,
  onClose,
  onSave,
  onDelete,
}) {
  const isBuyer = kind === 'buyer';
  const [form, setForm] = useState(() => {
    if (isBuyer) return initBuyerForm(initial);
    if (initial) return { ...emptySeller, ...initial };
    return { ...emptySeller };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let payload;
      if (isBuyer) {
        let price_min = null;
        let price_max = null;
        if (form.priceMode === 'range') {
          price_min = parsePriceAmount(form.priceMinInput);
          price_max = parsePriceAmount(form.priceMaxInput);
        } else {
          const v = parsePriceAmount(form.priceSingle);
          price_min = v;
          price_max = v;
        }
        payload = {
          status: form.status,
          buyer_name: form.buyer_name,
          price_min,
          price_max,
          location: form.location,
          timing: form.timing,
          buyer_rep_signed: form.buyer_rep_signed,
          buyer_rep_dropbox: form.buyer_rep_dropbox,
          notes: form.notes,
          lender: form.lender,
          preapproval: form.preapproval || null,
          showings: form.showings,
          search_setup: form.search_setup,
        };
      } else {
        payload = {
          status: form.status,
          property_address: form.property_address,
          seller_name: form.seller_name,
          timing: form.timing,
          price_range: form.price_range,
          neighborhood: form.neighborhood,
          notes: form.notes,
        };
      }
      await onSave(payload);
    } catch (err) {
      setError(err?.message || 'Save failed');
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!onDelete || !initial?.id) return;
    await onDelete(initial);
  }

  const modeBtn = (active) =>
    `flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
      active ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full md:max-w-lg bg-white shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="px-4 md:px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between shrink-0 gap-3">
          <h2 className="text-base md:text-lg font-bold text-primary uppercase tracking-wide leading-tight">
            {initial ? 'Edit' : 'New'} {isBuyer ? 'Buyer' : 'Seller'} Opportunity
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 min-h-11 px-3 text-on-surface-variant hover:text-primary text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
          {error && (
            <p className="text-sm text-error bg-error/10 border border-error/20 rounded px-3 py-2">{error}</p>
          )}

          {isBuyer ? (
            <>
              <Field label="Buyer">
                <input
                  required
                  className={INPUT}
                  value={form.buyer_name || ''}
                  onChange={(e) => set('buyer_name', e.target.value)}
                  autoFocus={!initial}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    className={INPUT}
                    value={form.status || 'active'}
                    onChange={(e) => set('status', e.target.value)}
                  >
                    {BUYER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Pre approved">
                  <select
                    className={INPUT}
                    value={form.preapproval || ''}
                    onChange={(e) => set('preapproval', e.target.value)}
                  >
                    <option value="">—</option>
                    {BUYER_PREAPPROVALS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <span className={LABEL}>Price</span>
                <div className="mt-1 flex rounded-lg border border-outline-variant/30 overflow-hidden bg-white">
                  <button
                    type="button"
                    className={modeBtn(form.priceMode === 'single')}
                    onClick={() => set('priceMode', 'single')}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    className={modeBtn(form.priceMode === 'range')}
                    onClick={() => set('priceMode', 'range')}
                  >
                    Range
                  </button>
                </div>
                {form.priceMode === 'range' ? (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="text-[10px] font-semibold text-on-surface-variant uppercase">Min</label>
                      <input
                        className={INPUT}
                        inputMode="decimal"
                        placeholder="900k or 900000"
                        value={form.priceMinInput || ''}
                        onChange={(e) => set('priceMinInput', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-on-surface-variant uppercase">Max</label>
                      <input
                        className={INPUT}
                        inputMode="decimal"
                        placeholder="1.4M or 1400000"
                        value={form.priceMaxInput || ''}
                        onChange={(e) => set('priceMaxInput', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    className={`${INPUT} mt-2`}
                    inputMode="decimal"
                    placeholder="1.2M, 900k, or 1200000"
                    value={form.priceSingle || ''}
                    onChange={(e) => set('priceSingle', e.target.value)}
                  />
                )}
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Use full dollars or suffixes (k / m). Example: 1.2m → $1.2M
                </p>
              </div>

              <Field label="Timing">
                <select
                  className={INPUT}
                  value={form.timing || ''}
                  onChange={(e) => set('timing', e.target.value)}
                >
                  <option value="">—</option>
                  {BUYER_TIMINGS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <input className={INPUT} value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={6}
                  className={`${INPUT} resize-y min-h-[8rem]`}
                  value={form.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                  autoFocus={Boolean(initial)}
                />
              </Field>

              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="text-xs font-semibold uppercase tracking-wider text-secondary hover:underline"
              >
                {showMore ? 'Hide details' : 'More details (rep, lender, showings…)'}
              </button>

              {showMore && (
                <div className="space-y-4 pt-1 border-t border-outline-variant/15">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Buyer Rep signed?">
                      <input
                        className={INPUT}
                        value={form.buyer_rep_signed || ''}
                        onChange={(e) => set('buyer_rep_signed', e.target.value)}
                        placeholder="Y- 9/30/2026"
                      />
                    </Field>
                    <Field label="Buyer Rep in Dropbox?">
                      <input
                        className={INPUT}
                        value={form.buyer_rep_dropbox || ''}
                        onChange={(e) => set('buyer_rep_dropbox', e.target.value)}
                        placeholder="Y / N"
                      />
                    </Field>
                  </div>
                  <Field label="Lender / Lender Intro">
                    <input className={INPUT} value={form.lender || ''} onChange={(e) => set('lender', e.target.value)} />
                  </Field>
                  <Field label="Showings">
                    <input
                      className={INPUT}
                      value={form.showings || ''}
                      onChange={(e) => set('showings', e.target.value)}
                    />
                  </Field>
                  <Field label="Search setup">
                    <input
                      className={INPUT}
                      value={form.search_setup || ''}
                      onChange={(e) => set('search_setup', e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </>
          ) : (
            <>
              <Field label="Status">
                <input
                  list="seller-status-suggestions"
                  className={INPUT}
                  value={form.status || ''}
                  onChange={(e) => set('status', e.target.value)}
                />
                <datalist id="seller-status-suggestions">
                  {SELLER_STATUS_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="Property address">
                <input
                  required
                  className={INPUT}
                  value={form.property_address || ''}
                  onChange={(e) => set('property_address', e.target.value)}
                />
              </Field>
              <Field label="Seller">
                <input
                  className={INPUT}
                  value={form.seller_name || ''}
                  onChange={(e) => set('seller_name', e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Timing">
                  <input className={INPUT} value={form.timing || ''} onChange={(e) => set('timing', e.target.value)} />
                </Field>
                <Field label="Price range">
                  <input
                    className={INPUT}
                    value={form.price_range || ''}
                    onChange={(e) => set('price_range', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Neighborhood">
                <input
                  className={INPUT}
                  value={form.neighborhood || ''}
                  onChange={(e) => set('neighborhood', e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={6}
                  className={`${INPUT} resize-y min-h-[8rem]`}
                  value={form.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-outline-variant/20 flex flex-wrap gap-3 shrink-0 items-center">
          {initial?.id && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="min-h-11 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/10 rounded mr-auto"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 md:flex-none min-h-11 px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 md:flex-none min-h-11 px-5 py-2.5 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
