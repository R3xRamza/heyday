import OpportunityStatusBadge from './OpportunityStatusBadge';
import BuyerRepDropboxIcons from './BuyerRepDropboxIcons';
import {
  formatBuyerPrice,
  normalizePreapproval,
  preapprovalLabel,
} from '../../utils/buyerOpportunity';

function metaJoin(...parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' · ');
}

export default function OpportunityBuyerCards({ rows, onEdit }) {
  return (
    <ul className="md:hidden flex flex-col gap-3">
      {rows.map((row) => {
        const priceLabel = formatBuyerPrice(row);
        const meta = metaJoin(priceLabel !== '—' ? priceLabel : '', row.timing);
        const pre = normalizePreapproval(row.preapproval);

        return (
          <li key={row.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onEdit(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEdit(row);
                }
              }}
              className="w-full text-left bg-white border border-outline-variant/20 rounded-xl p-4 shadow-sm active:bg-surface-container-low cursor-pointer"
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                  <OpportunityStatusBadge status={row.status} kind="buyer" />
                  {pre && (
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border border-outline-variant/25 bg-surface-container-low text-on-surface-variant">
                      Pre {preapprovalLabel(pre)}
                    </span>
                  )}
                </div>
                <BuyerRepDropboxIcons
                  buyerRepSigned={row.buyer_rep_signed}
                  buyerRepDropbox={row.buyer_rep_dropbox}
                  layout="row"
                  size={15}
                />
              </div>

              <p className="font-semibold text-primary text-base leading-snug mb-1">{row.buyer_name}</p>
              {meta && (
                <p className="text-sm text-on-surface-variant truncate mb-0.5">{meta}</p>
              )}
              {row.location && (
                <p className="text-sm text-on-surface-variant truncate mb-1">{row.location}</p>
              )}
              {row.notes && (
                <p className="text-sm text-on-surface line-clamp-2 mt-1 leading-snug">{row.notes}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
