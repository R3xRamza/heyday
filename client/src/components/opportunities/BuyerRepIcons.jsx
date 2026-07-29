import { Calendar } from 'lucide-react';
import {
  formatRepExpiryLabel,
  parseBuyerRep,
  repExpiryTone,
} from '../../utils/buyerOpportunity';

const TONE = {
  ok: 'text-emerald-600',
  soon: 'text-amber-500',
  expired: 'text-rose-600',
  missing: 'text-slate-300',
};

const DATE_TONE = {
  ok: 'text-on-surface-variant',
  soon: 'text-amber-600',
  expired: 'text-rose-600',
  missing: 'text-slate-300',
};

/**
 * Buyer Rep indicator: calendar icon + expiry date underneath.
 * Tones: ok | soon (≤14d) | expired | missing. Never auto-unchecks signed.
 */
export default function BuyerRepIcons({
  buyerRepSigned,
  buyerRepExpiresOn,
  size = 16,
  layout = 'stack',
}) {
  const rep = parseBuyerRep({
    buyer_rep_signed: buyerRepSigned,
    buyer_rep_expires_on: buyerRepExpiresOn,
  });
  const tone = repExpiryTone(rep);
  const dateLabel = formatRepExpiryLabel(rep.expires_on);
  const tip = [
    rep.signed ? 'Buyer Rep signed' : 'No buyer rep on file',
    dateLabel ? `Expires ${dateLabel}` : null,
    tone === 'soon' ? 'Expires within 2 weeks' : null,
    tone === 'expired' ? 'Expired' : null,
  ].filter(Boolean).join(' · ');

  const wrap = layout === 'row'
    ? 'inline-flex items-center gap-1.5'
    : 'flex flex-col items-center gap-0.5';

  return (
    <div className={wrap} onClick={(e) => e.stopPropagation()} title={tip} aria-label={tip}>
      <span className={`inline-flex ${TONE[tone]}`}>
        <Calendar size={size} strokeWidth={2.25} />
      </span>
      {dateLabel && (
        <span className={`text-[9px] font-semibold leading-tight tabular-nums whitespace-nowrap ${DATE_TONE[tone]}`}>
          {dateLabel}
        </span>
      )}
    </div>
  );
}
