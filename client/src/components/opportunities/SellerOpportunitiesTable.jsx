import { Pencil, Trash2 } from 'lucide-react';
import OpportunityStatusBadge from './OpportunityStatusBadge';

const TH =
  'px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-on-surface-variant whitespace-nowrap bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant/20';
const TD = 'px-3 py-2.5 text-sm text-on-surface align-top border-b border-outline-variant/10';
const TD_MUTED = `${TD} text-on-surface-variant`;

function Cell({ children, className = '', title }) {
  return (
    <td className={`${TD_MUTED} ${className}`} title={title}>
      <span className="line-clamp-2">{children || '—'}</span>
    </td>
  );
}

export default function SellerOpportunitiesTable({ rows, onEdit, onDelete }) {
  return (
    <div className="hidden md:block w-full overflow-auto border border-outline-variant/20 rounded-lg bg-white max-h-[calc(100vh-16rem)]">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr>
            <th className={TH}>Status</th>
            <th className={TH}>Address</th>
            <th className={TH}>Seller</th>
            <th className={TH}>Timing</th>
            <th className={TH}>Price Range</th>
            <th className={TH}>Neighborhood</th>
            <th className={`${TH} min-w-[14rem]`}>Notes</th>
            <th className={`${TH} w-20`}> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-surface-container-low/60 cursor-pointer group"
              onClick={() => onEdit(row)}
            >
              <td className={TD}>
                <OpportunityStatusBadge status={row.status} kind="seller" />
              </td>
              <td className={`${TD} font-semibold text-primary`}>
                <span className="line-clamp-2">{row.property_address}</span>
              </td>
              <Cell title={row.seller_name}>{row.seller_name}</Cell>
              <Cell title={row.timing}>{row.timing}</Cell>
              <Cell title={row.price_range}>{row.price_range}</Cell>
              <Cell title={row.neighborhood}>{row.neighborhood}</Cell>
              <Cell className="max-w-[16rem]" title={row.notes}>{row.notes}</Cell>
              <td className={TD} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => onEdit(row)}
                    className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-primary"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => onDelete(row)}
                    className="p-1.5 rounded hover:bg-error/10 text-on-surface-variant hover:text-error"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
