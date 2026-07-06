import Icon from '../shared/Icon';

export default function PrivateListingFlag({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase bg-lemon text-feather rounded-full shrink-0 ${className}`}>
      <Icon name="flag" className="!text-[12px]" />
      Private
    </span>
  );
}
