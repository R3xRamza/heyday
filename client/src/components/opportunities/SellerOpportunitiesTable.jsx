import { Pencil, Trash2 } from 'lucide-react';
import OpportunityStatusBadge from './OpportunityStatusBadge';
import OpportunityTableHead, { TD } from './OpportunityTableHead';
import { visibleColumnDefs } from '../../utils/opportunityTablePrefs';
import { formatSellerPrice } from '../../utils/sellerOpportunity';

const TD_MUTED = `${TD} text-on-surface-variant`;

function Cell({ children, className = '', title, style }) {
  return (
    <td className={`${TD_MUTED} ${className}`} title={title} style={style}>
      <span className="line-clamp-2">{children || '—'}</span>
    </td>
  );
}

function cellStyle(widths, id, fallback) {
  const w = widths[id] ?? fallback;
  return { width: w, minWidth: w, maxWidth: w };
}

export default function SellerOpportunitiesTable({
  rows,
  onEdit,
  onDelete,
  prefs,
  onSort,
  onReorder,
  onResize,
}) {
  const columns = visibleColumnDefs('sellers', prefs);
  const widths = prefs.widths || {};
  const totalMin = columns.reduce((sum, c) => sum + (widths[c.id] ?? c.defaultWidth), 0);

  function renderCell(col, row) {
    const style = cellStyle(widths, col.id, col.defaultWidth);
    switch (col.id) {
      case 'status':
        return (
          <td key={col.id} className={TD} style={style}>
            <OpportunityStatusBadge status={row.status} kind="seller" />
          </td>
        );
      case 'property_address':
        return (
          <td key={col.id} className={`${TD} font-semibold text-primary`} style={style}>
            <span className="line-clamp-2">{row.property_address}</span>
          </td>
        );
      case 'seller_name':
        return <Cell key={col.id} title={row.seller_name} style={style}>{row.seller_name}</Cell>;
      case 'timing':
        return <Cell key={col.id} title={row.timing} style={style}>{row.timing}</Cell>;
      case 'price_range': {
        const label = formatSellerPrice(row);
        return <Cell key={col.id} title={label} style={style}>{label}</Cell>;
      }
      case 'neighborhood':
        return <Cell key={col.id} title={row.neighborhood} style={style}>{row.neighborhood}</Cell>;
      case 'notes':
        return <Cell key={col.id} title={row.notes} style={style}>{row.notes}</Cell>;
      case 'actions':
        return (
          <td key={col.id} className={TD} style={style} onClick={(e) => e.stopPropagation()}>
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
        );
      default:
        return <td key={col.id} className={TD} style={style}>—</td>;
    }
  }

  return (
    <div className="hidden md:block w-full overflow-auto border border-outline-variant/20 rounded-lg bg-white max-h-[calc(100vh-16rem)]">
      <table
        className="border-collapse table-fixed w-full"
        style={{ minWidth: totalMin }}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.id} style={{ width: widths[c.id] ?? c.defaultWidth }} />
          ))}
          {/* Flexible spacer — leftover viewport width lands here, not on data columns */}
          <col />
        </colgroup>
        <OpportunityTableHead
          columns={columns}
          widths={widths}
          sortKey={prefs.sortKey}
          sortDir={prefs.sortDir}
          onSort={onSort}
          onReorder={onReorder}
          onResize={onResize}
          trailingSpacer
        />
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-surface-container-low/60 cursor-pointer group"
              onClick={() => onEdit(row)}
            >
              {columns.map((col) => renderCell(col, row))}
              <td className={`${TD} p-0 border-b border-outline-variant/10`} aria-hidden />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
