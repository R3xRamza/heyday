import { Pencil, Trash2 } from 'lucide-react';
import OpportunityStatusBadge from './OpportunityStatusBadge';

function metaJoin(...parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' · ');
}

export default function OpportunitySellerCards({ rows, onEdit, onDelete }) {
  return (
    <ul className="md:hidden flex flex-col gap-3">
      {rows.map((row) => {
        const meta = metaJoin(row.seller_name, row.timing);
        const place = metaJoin(row.neighborhood, row.price_range);

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
                <div className="min-w-0 flex-1">
                  <OpportunityStatusBadge status={row.status} kind="seller" />
                </div>
                <div className="flex items-center shrink-0 -mr-1">
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(row);
                    }}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(row);
                    }}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="font-semibold text-primary text-base leading-snug mb-1">{row.property_address}</p>
              {meta && (
                <p className="text-sm text-on-surface-variant truncate mb-0.5">{meta}</p>
              )}
              {place && (
                <p className="text-sm text-on-surface-variant truncate mb-1">{place}</p>
              )}
              {row.notes && (
                <p className="text-sm text-on-surface line-clamp-2 mt-1">{row.notes}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
