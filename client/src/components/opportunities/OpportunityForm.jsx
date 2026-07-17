import { useEffect, useState } from 'react';
import {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  normalizeBuyerStatus,
  normalizePreapproval,
} from '../../utils/buyerOpportunity';

const INPUT =
  'w-full mt-1 px-3 py-3 md:py-2 border border-outline-variant/30 rounded text-base md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary/25';
const LABEL = 'text-xs font-semibold text-on-surface-variant uppercase';

const SELLER_STATUS_SUGGESTIONS = ['Upcoming', 'Pre-listing', 'LIVE', 'PRIVATE'];

const emptyBuyer = {
  status: 'on_hold',
  buyer_name: '',
  price: '',
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

function initBuyerForm(initial) {
  const base = { ...emptyBuyer, ...(initial || {}) };
  return {
    ...base,
    status: normalizeBuyerStatus(base.status),
    preapproval: normalizePreapproval(base.preapproval),
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
      const payload = isBuyer
        ? {
            status: form.status,
            buyer_name: form.buyer_name,
            price: form.price,
            location: form.location,
            timing: form.timing,
            buyer_rep_signed: form.buyer_rep_signed,
            buyer_rep_dropbox: form.buyer_rep_dropbox,
            notes: form.notes,
            lender: form.lender,
            preapproval: form.preapproval || null,
            showings: form.showings,
            search_setup: form.search_setup,
          }
        : {
            status: form.status,
            property_address: form.property_address,
            seller_name: form.seller_name,
            timing: form.timing,
            price_range: form.price_range,
            neighborhood: form.neighborhood,
            notes: form.notes,
          };
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
                    value={form.status || 'on_hold'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Price">
                  <input className={INPUT} value={form.price || ''} onChange={(e) => set('price', e.target.value)} />
                </Field>
                <Field label="Timing">
                  <input className={INPUT} value={form.timing || ''} onChange={(e) => set('timing', e.target.value)} />
                </Field>
              </div>
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
