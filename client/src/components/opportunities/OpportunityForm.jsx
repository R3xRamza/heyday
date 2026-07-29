import { useEffect, useState } from 'react';
import AddressAutocomplete from '../shared/AddressAutocomplete';
import {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  BUYER_TIMINGS,
  encodeBuyerRepStorage,
  normalizeBuyerStatus,
  normalizeBuyerTiming,
  normalizePreapproval,
  parseBuyerPriceText,
  parseBuyerRep,
  parsePriceAmount,
} from '../../utils/buyerOpportunity';
import { composeFullAddressLine, SELLER_STATUS } from '../../utils/sellerOpportunity';

const INPUT =
  'w-full mt-1 px-3 py-3 md:py-2 border border-outline-variant/30 rounded text-base md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary/25';
const LABEL = 'text-xs font-semibold text-on-surface-variant uppercase';

const emptyBuyer = {
  status: 'active',
  buyer_name: '',
  location: '',
  timing: '',
  buyer_rep_signed_checked: false,
  buyer_rep_expires_on: '',
  notes: '',
  lender: '',
  preapproval: '',
  showings: '',
};

const emptySeller = {
  status: SELLER_STATUS,
  property_address: '',
  seller_name: '',
  timing: '',
  neighborhood: '',
  notes: '',
  priceMode: 'single',
  priceSingle: '',
  priceMinInput: '',
  priceMaxInput: '',
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
  const base = { ...(initial || {}) };
  const rep = parseBuyerRep(base);
  const min = base.price_min;
  const max = base.price_max;
  const isRange = min != null && max != null && Number(min) !== Number(max);
  let status = normalizeBuyerStatus(base.status);
  if (status === 'closed') status = 'active';
  return {
    ...emptyBuyer,
    ...base,
    status,
    timing: normalizeBuyerTiming(base.timing) || '',
    preapproval: normalizePreapproval(base.preapproval),
    buyer_rep_signed_checked: rep.signed,
    buyer_rep_expires_on: rep.expires_on || '',
    priceMode: isRange ? 'range' : 'single',
    priceSingle: isRange
      ? ''
      : dollarsToInput(min ?? max),
    priceMinInput: isRange ? dollarsToInput(min) : '',
    priceMaxInput: isRange ? dollarsToInput(max) : '',
  };
}

function initSellerForm(initial) {
  const base = { ...(initial || {}) };
  let min = base.price_min;
  let max = base.price_max;
  const hasMin = min != null && min !== '' && !Number.isNaN(Number(min));
  const hasMax = max != null && max !== '' && !Number.isNaN(Number(max));
  if (!hasMin && !hasMax && base.price_range) {
    const parsed = parseBuyerPriceText(base.price_range);
    min = parsed.min;
    max = parsed.max;
  }
  const isRange = min != null && max != null && Number(min) !== Number(max);
  return {
    ...emptySeller,
    ...base,
    status: SELLER_STATUS,
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
    return initSellerForm(initial);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
        const repStorage = encodeBuyerRepStorage({
          signed: Boolean(form.buyer_rep_signed_checked),
          expires_on: form.buyer_rep_signed_checked
            ? (form.buyer_rep_expires_on || null)
            : null,
        });
        payload = {
          status: form.status === 'closed' ? 'active' : form.status,
          buyer_name: form.buyer_name,
          price_min,
          price_max,
          location: form.location,
          timing: form.timing,
          buyer_rep_signed: repStorage.buyer_rep_signed,
          buyer_rep_expires_on: repStorage.buyer_rep_expires_on,
          buyer_rep_dropbox: null,
          notes: form.notes,
          lender: form.lender,
          preapproval: form.preapproval || null,
          showings: form.showings,
        };
      } else {
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
          status: SELLER_STATUS,
          property_address: form.property_address,
          seller_name: form.seller_name,
          timing: form.timing,
          price_min,
          price_max,
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

  const priceFields = (
    <div>
      <span className={LABEL}>{isBuyer ? 'Budget' : 'Price range'}</span>
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
  );

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
              <div className="grid grid-cols-2 gap-3">
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

              {priceFields}

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
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-outline-variant/30 p-3 bg-surface-container-low/40">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-outline-variant/40"
                      checked={Boolean(form.buyer_rep_signed_checked)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          buyer_rep_signed_checked: checked,
                          buyer_rep_expires_on: checked ? prev.buyer_rep_expires_on : '',
                        }));
                      }}
                    />
                    <span className="text-sm font-semibold text-primary">Buyer Rep signed</span>
                  </label>
                  {form.buyer_rep_signed_checked && (
                    <div className="mt-3">
                      <label className={LABEL}>Rep expiry date</label>
                      <input
                        type="date"
                        className={INPUT}
                        value={form.buyer_rep_expires_on || ''}
                        onChange={(e) => set('buyer_rep_expires_on', e.target.value)}
                      />
                    </div>
                  )}
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
              </div>
            </>
          ) : (
            <>
              <Field label="Address">
                <AddressAutocomplete
                  required
                  className={INPUT}
                  value={form.property_address || ''}
                  onChange={(v) => set('property_address', v)}
                  onAddressSelect={(fields) => set('property_address', composeFullAddressLine(fields))}
                  placeholder="Start typing an address…"
                  id="seller-opp-address"
                />
              </Field>
              <Field label="Seller">
                <input
                  className={INPUT}
                  value={form.seller_name || ''}
                  onChange={(e) => set('seller_name', e.target.value)}
                />
              </Field>
              <Field label="Timing">
                <input
                  className={INPUT}
                  value={form.timing || ''}
                  onChange={(e) => set('timing', e.target.value)}
                />
              </Field>
              {priceFields}
              <Field label="Neighborhood">
                <input
                  className={INPUT}
                  value={form.neighborhood || ''}
                  onChange={(e) => set('neighborhood', e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={5}
                  className={`${INPUT} resize-y`}
                  value={form.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        <div className="px-4 md:px-6 py-4 border-t border-outline-variant/20 flex items-center gap-3 shrink-0">
          {onDelete && initial?.id ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm font-semibold text-error hover:underline mr-auto"
            >
              Delete
            </button>
          ) : (
            <span className="mr-auto" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-primary-container text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
