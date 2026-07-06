const PAGE_SIZE = 50;

export function totalPages(total, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil((total || 0) / pageSize));
}

export default function ListPagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
  className = '',
}) {
  const pages = totalPages(total, pageSize);
  if (pages <= 1) return null;

  return (
    <div className={`flex items-center justify-between px-6 py-4 border-t border-outline-variant/10 bg-surface-container-low ${className}`}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-4 py-2 text-sm font-semibold text-primary disabled:opacity-40 hover:bg-white rounded-lg"
      >
        Previous
      </button>
      <span className="text-sm text-on-surface-variant">
        Page {page} of {pages}
        {total != null && (
          <span className="text-on-surface-variant/70"> · {total.toLocaleString()} total</span>
        )}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        className="px-4 py-2 text-sm font-semibold text-primary disabled:opacity-40 hover:bg-white rounded-lg"
      >
        Next
      </button>
    </div>
  );
}
