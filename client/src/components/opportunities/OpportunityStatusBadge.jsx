import {
  buyerStatusLabel,
  normalizeBuyerStatus,
} from '../../utils/buyerOpportunity';
import { SELLER_STATUS } from '../../utils/sellerOpportunity';

/** Colored status chip for buyer/seller opportunities. */

function buyerStatusStyle(status) {
  const v = normalizeBuyerStatus(status);
  if (v === 'active') {
    return { wrap: 'bg-sky-50 text-sky-800 border-sky-200', flag: 'bg-sky-500' };
  }
  if (v === 'pending') {
    return { wrap: 'bg-emerald-50 text-emerald-800 border-emerald-200', flag: 'bg-emerald-500' };
  }
  if (v === 'under_contract') {
    return { wrap: 'bg-emerald-50 text-emerald-800 border-emerald-200', flag: 'bg-emerald-500' };
  }
  if (v === 'option_period') {
    return { wrap: 'bg-amber-50 text-amber-900 border-amber-200', flag: 'bg-amber-500' };
  }
  if (v === 'closed') {
    return { wrap: 'bg-slate-100 text-slate-600 border-slate-200', flag: 'bg-slate-400' };
  }
  // on_hold
  return { wrap: 'bg-rose-50 text-rose-800 border-rose-200', flag: 'bg-rose-400' };
}

function sellerStatusStyle() {
  return { wrap: 'bg-sky-50 text-sky-800 border-sky-200', flag: 'bg-sky-500' };
}

export default function OpportunityStatusBadge({ status, kind = 'buyer', className = '' }) {
  const label = kind === 'buyer'
    ? buyerStatusLabel(status)
    : SELLER_STATUS;
  const styles = kind === 'seller' ? sellerStatusStyle() : buyerStatusStyle(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${styles.wrap} ${className}`}
      title={label}
    >
      <span className={`w-1.5 h-3 rounded-sm shrink-0 ${styles.flag}`} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
