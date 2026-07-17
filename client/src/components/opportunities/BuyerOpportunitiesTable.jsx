import {
  BUYER_PREAPPROVALS,
  BUYER_STATUSES,
  normalizeBuyerStatus,
  normalizePreapproval,
} from '../../utils/buyerOpportunity';
import BuyerRepDropboxIcons from './BuyerRepDropboxIcons';

const TH =
  'px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-on-surface-variant whitespace-nowrap bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant/20';
const TD = 'px-3 py-2.5 text-sm text-on-surface align-top border-b border-outline-variant/10';

const SELECT =
  'w-full max-w-[10.5rem] px-2 py-1.5 text-xs font-semibold border border-outline-variant/30 rounded-md bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/25 cursor-pointer';

function TextCell({ children, className = '', title }) {
  return (
    <td className={`${TD} text-on-surface-variant ${className}`} title={title || undefined}>
      <span className="line-clamp-2">{children || '—'}</span>
    </td>
  );
}

export default function BuyerOpportunitiesTable({ rows, onEdit, onPatch }) {
  return (
    <div className="hidden md:block w-full overflow-auto border border-outline-variant/20 rounded-lg bg-white max-h-[calc(100vh-16rem)]">
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col className="w-12" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col />
          <col className="w-[7.5rem]" />
        </colgroup>
        <thead>
          <tr>
            <th className={`${TH} w-12`} aria-label="Rep & Dropbox" />
            <th className={TH}>Buyers</th>
            <th className={TH}>Status</th>
            <th className={TH}>Price</th>
            <th className={TH}>Location</th>
            <th className={TH}>Timing</th>
            <th className={TH}>Notes</th>
            <th className={TH}>Pre approved</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = normalizeBuyerStatus(row.status);
            const pre = normalizePreapproval(row.preapproval);

            return (
              <tr
                key={row.id}
                className="hover:bg-surface-container-low/60 cursor-pointer group"
                onClick={() => onEdit(row)}
              >
                <td className={`${TD} w-12`}>
                  <BuyerRepDropboxIcons
                    buyerRepSigned={row.buyer_rep_signed}
                    buyerRepDropbox={row.buyer_rep_dropbox}
                  />
                </td>
                <td className={`${TD} font-semibold text-primary`}>
                  <span className="line-clamp-2">{row.buyer_name}</span>
                </td>
                <td className={TD} onClick={(e) => e.stopPropagation()}>
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
                <TextCell title={row.price}>{row.price}</TextCell>
                <TextCell title={row.location}>{row.location}</TextCell>
                <TextCell title={row.timing}>{row.timing}</TextCell>
                <td className={`${TD} text-on-surface`} title={row.notes || undefined}>
                  {row.notes ? (
                    <span className="line-clamp-2 text-[13px] leading-snug text-on-surface">
                      {row.notes}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant/50 text-xs">Add notes…</span>
                  )}
                </td>
                <td className={TD} onClick={(e) => e.stopPropagation()}>
                  <select
                    className={SELECT}
                    value={pre}
                    aria-label="Pre approved"
                    onChange={(e) => onPatch(row.id, { preapproval: e.target.value })}
                  >
                    <option value="" disabled={Boolean(pre)}>
                      —
                    </option>
                    {BUYER_PREAPPROVALS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
