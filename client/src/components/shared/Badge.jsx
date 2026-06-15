const STATUS_STYLES = {
  active: 'bg-feather text-white',
  pending: 'bg-lemon text-feather',
  inactive: 'bg-light-pink text-purple',
  prospect: 'bg-sky text-feather',
  high: 'bg-purple text-white',
};

export default function Badge({ status, children, className = '' }) {
  const styles = STATUS_STYLES[status?.toLowerCase()] || 'bg-surface-container-high text-on-surface-variant';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles} ${className}`}>
      {children || status}
    </span>
  );
}
