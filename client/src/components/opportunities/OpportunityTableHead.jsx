import { useCallback, useRef } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { MIN_COLUMN_WIDTH } from '../../utils/opportunityTablePrefs';

const TH =
  'relative px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-on-surface-variant whitespace-nowrap bg-surface-container-low sticky top-0 z-10 border-b border-outline-variant/20 select-none';

/**
 * Shared sticky header with sort click, column drag-reorder, and edge resize.
 */
export default function OpportunityTableHead({
  columns,
  widths,
  sortKey,
  sortDir,
  onSort,
  onReorder,
  onResize,
}) {
  const dragCol = useRef(null);

  const startResize = useCallback((colId, startX, startW) => {
    const floor = colId === 'rep' ? 56 : MIN_COLUMN_WIDTH;
    function onMove(e) {
      const next = Math.max(floor, startW + (e.clientX - startX));
      onResize(colId, next);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onResize]);

  return (
    <thead>
      <tr>
        {columns.map((col) => {
          const w = widths[col.id] ?? col.defaultWidth;
          const sorted = sortKey === col.id;
          const pinned = Boolean(col.pinned);
          return (
            <th
              key={col.id}
              className={TH}
              style={{ width: w, minWidth: w, maxWidth: w }}
              aria-label={col.label || col.id}
              draggable={!pinned}
              onDragStart={(e) => {
                if (pinned) {
                  e.preventDefault();
                  return;
                }
                dragCol.current = col.id;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', col.id);
              }}
              onDragOver={(e) => {
                if (pinned) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragCol.current || e.dataTransfer.getData('text/plain');
                dragCol.current = null;
                if (from && from !== col.id && !pinned) onReorder(from, col.id);
              }}
            >
              <button
                type="button"
                disabled={!col.sortable}
                onClick={() => col.sortable && onSort(col.id)}
                className={`inline-flex items-center gap-1 max-w-full ${
                  col.sortable
                    ? 'cursor-pointer hover:text-primary'
                    : 'cursor-default'
                }`}
              >
                <span className="truncate">
                  {col.id === 'actions' || col.id === 'rep' ? '\u00a0' : col.label}
                </span>
                {sorted && sortDir === 'asc' && <ArrowUp size={12} className="shrink-0 text-secondary" />}
                {sorted && sortDir === 'desc' && <ArrowDown size={12} className="shrink-0 text-secondary" />}
              </button>
              <span
                role="separator"
                aria-orientation="vertical"
                aria-label={`Resize ${col.label || col.id}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startResize(col.id, e.clientX, w);
                }}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-secondary/40"
              />
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export const TD = 'px-3 py-2.5 text-sm text-on-surface align-top border-b border-outline-variant/10';
