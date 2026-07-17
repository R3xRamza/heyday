import { buyerStatusLabel, normalizeBuyerStatus } from '../../utils/buyerOpportunity';

export default function OpportunityKpis({ items, kind }) {
  const counts = new Map();
  for (const row of items) {
    const raw = String(row.status || '').trim() || '(none)';
    const key = kind === 'buyer' ? normalizeBuyerStatus(raw) : raw;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let entries = [...counts.entries()];
  if (kind === 'seller') {
    const order = ['Upcoming', 'Pre-listing', 'LIVE', 'PRIVATE'];
    entries.sort((a, b) => {
      const ia = order.findIndex((o) => o.toLowerCase() === a[0].toLowerCase());
      const ib = order.findIndex((o) => o.toLowerCase() === b[0].toLowerCase());
      const ra = ia === -1 ? 99 : ia;
      const rb = ib === -1 ? 99 : ib;
      if (ra !== rb) return ra - rb;
      return a[0].localeCompare(b[0]);
    });
  } else {
    const order = ['under_contract', 'option_period', 'active', 'closed', 'on_hold'];
    entries.sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      const ra = ia === -1 ? 99 : ia;
      const rb = ib === -1 ? 99 : ib;
      if (ra !== rb) return ra - rb;
      return a[0].localeCompare(b[0]);
    });
  }

  return (
    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant shrink-0">
        {items.length} total
      </span>
      {entries.map(([status, count]) => {
        const label = kind === 'buyer' ? buyerStatusLabel(status) : status;
        return (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-outline-variant/25 text-xs text-on-surface shrink-0"
            title={label}
          >
            <span className="font-semibold truncate max-w-[10rem]">{label}</span>
            <span className="font-black text-primary-container">{count}</span>
          </span>
        );
      })}
    </div>
  );
}
