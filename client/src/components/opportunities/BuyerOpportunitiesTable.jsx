import {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  BUYER_TIMINGS,
  formatBuyerPrice,
  normalizeBuyerStatus,
  normalizeBuyerTiming,
  normalizePreapproval,
  visibleColumnDefs,
} from '../../utils/opportunityTablePrefs';
import BuyerRepDropboxIcons from './BuyerRepDropboxIcons';
import OpportunityTableHead, { TD } from './OpportunityTableHead';

const SELECT =
  'buyer-flat-select w-full min-w-0 max-w-[11rem] -ml-1 pl-0 py-1 text-xs font-semibold bg-transparent border-0 shadow-none text-on-surface cursor-pointer focus:outline-none focus:ring-0';

function TextCell({ children, className = '', title, style }) {
  return (
    <td className={`${TD} text-on-surface-variant ${className}`} title={title || undefined} style={style}>
      <span className="line-clamp-2">{children || '—'}</span>
    </td>
  );
}

function cellStyle(widths, id, fallback) {
  const w = widths[id] ?? fallback;
  return { width: w, minWidth: w, maxWidth: w };
}

export default function BuyerOpportunitiesTable({
  rows,
  onEdit,
  onPatch,
  prefs,
  onSort,
  onReorder,
  onResize,
}) {
  const columns = visibleColumnDefs('buyers', prefs);
  const widths = prefs.widths || {};
  const totalMin = columns.reduce((sum, c) => sum + (widths[c.id] ?? c.defaultWidth), 0);

  function renderCell(col, row) {
    const style = cellStyle(widths, col.id, col.defaultWidth);
    const status = normalizeBuyerStatus(row.status);
    const timing = normalizeBuyerTiming(row.timing) || '';
    const pre = normalizePreapproval(row.preapproval);
    const priceLabel = formatBuyerPrice(row);

    switch (col.id) {
      case 'rep':
        return (
          <td key={col.id} className={TD} style={style}>
            <BuyerRepDropboxIcons
              buyerRepSigned={row.buyer_rep_signed}
              buyerRepDropbox={row.buyer_rep_dropbox}
            />
          </td>
        );
      case 'buyer_name':
        return (
          <td key={col.id} className={`${TD} font-semibold text-primary`} style={style}>
            <span className="line-clamp-2">{row.buyer_name}</span>
          </td>
        );
      case 'status':
        return (
          <td key={col.id} className={TD} style={style} onClick={(e) => e.stopPropagation()}>
            <select
              className={SELECT}
              value={status}
              aria-label="Status"
              onChange={(e) => onPatch(row.id, { status: e.target.value })}
            >
              {BUYER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </td>
        );
      case 'budget':
        return <TextCell key={col.id} title={priceLabel} style={style}>{priceLabel}</TextCell>;
      case 'location':
        return <TextCell key={col.id} title={row.location} style={style}>{row.location}</TextCell>;
      case 'timing':
        return (
          <td key={col.id} className={TD} style={style} onClick={(e) => e.stopPropagation()}>
            <select
              className={SELECT}
              value={timing}
              aria-label="Timing"
              onChange={(e) => onPatch(row.id, { timing: e.target.value || null })}
            >
              <option value="">—</option>
              {BUYER_TIMINGS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </td>
        );
      case 'notes':
        return (
          <td key={col.id} className={`${TD} text-on-surface`} style={style} title={row.notes || undefined}>
            {row.notes ? (
              <span className="line-clamp-2 text-[13px] leading-snug text-on-surface">{row.notes}</span>
            ) : (
              <span className="text-on-surface-variant/50 text-xs">Add notes…</span>
            )}
          </td>
        );
      case 'preapproval':
        return (
          <td key={col.id} className={TD} style={style} onClick={(e) => e.stopPropagation()}>
            <select
              className={SELECT}
              value={pre}
              aria-label="Pre approved"
              onChange={(e) => onPatch(row.id, { preapproval: e.target.value })}
            >
              <option value="" disabled={Boolean(pre)}>—</option>
              {BUYER_PREAPPROVALS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </td>
        );
      default:
        return <td key={col.id} className={TD} style={style}>—</td>;
    }
  }

  return (
    <div className="hidden md:block w-full overflow-auto border border-outline-variant/20 rounded-lg bg-white max-h-[calc(100vh-16rem)]">
      <table className="border-collapse table-fixed" style={{ width: totalMin, minWidth: '100%' }}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.id} style={{ width: widths[c.id] ?? c.defaultWidth }} />
          ))}
        </colgroup>
        <OpportunityTableHead
          columns={columns}
          widths={widths}
          sortKey={prefs.sortKey}
          sortDir={prefs.sortDir}
          onSort={onSort}
          onReorder={onReorder}
          onResize={onResize}
        />
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-surface-container-low/60 cursor-pointer group"
              onClick={() => onEdit(row)}
            >
              {columns.map((col) => renderCell(col, row))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
