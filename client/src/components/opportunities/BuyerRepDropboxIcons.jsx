import { Calendar, Folder } from 'lucide-react';
import {
  isDropboxYes,
  parseRepExpiryDate,
  repExpiryTone,
} from '../../utils/buyerOpportunity';

const TONE = {
  ok: 'text-emerald-600',
  soon: 'text-amber-500',
  expired: 'text-rose-600',
  missing: 'text-slate-300',
};

export default function BuyerRepDropboxIcons({
  buyerRepSigned,
  buyerRepDropbox,
  size = 16,
  layout = 'stack',
}) {
  const tone = repExpiryTone(buyerRepSigned);
  const expiry = parseRepExpiryDate(buyerRepSigned);
  const repTip = [
    buyerRepSigned?.trim() || 'No buyer rep on file',
    expiry ? `Expiry: ${expiry.toLocaleDateString()}` : null,
    tone === 'soon' ? 'Expires within 30 days' : null,
    tone === 'expired' ? 'Expired' : null,
  ].filter(Boolean).join(' · ');

  const dropYes = isDropboxYes(buyerRepDropbox);
  const dropTip = buyerRepDropbox?.trim() || 'Not in Dropbox';

  const wrap = layout === 'row' ? 'inline-flex items-center gap-2' : 'flex flex-col items-center gap-1.5';

  return (
    <div className={wrap} onClick={(e) => e.stopPropagation()}>
      <span className={`inline-flex ${TONE[tone]}`} title={repTip} aria-label={repTip}>
        <Calendar size={size} strokeWidth={2.25} />
      </span>
      <span
        className={`inline-flex ${dropYes ? 'text-emerald-600' : 'text-slate-300'}`}
        title={dropTip}
        aria-label={dropTip}
      >
        <Folder size={size} strokeWidth={2.25} />
      </span>
    </div>
  );
}
