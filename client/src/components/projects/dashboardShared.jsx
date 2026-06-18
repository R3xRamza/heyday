export const ADD_BUTTON_CLASS =
  'w-full border border-dashed border-outline-variant/40 rounded-xl py-2.5 text-center text-sm text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors shrink-0 min-h-[42px] flex items-center justify-center';

export const ADD_ROW_CLASS = 'mb-2 shrink-0 min-h-[42px]';

export function ColumnHeader({ label, count, badgeClass, trailing }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 shrink-0 min-h-[26px]">
      <div className="flex items-center gap-2 min-w-0">
        <h4 className="text-xs font-bold uppercase tracking-widest text-primary">{label}</h4>
        <span className={`min-w-[24px] h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${badgeClass}`}>
          {count}
        </span>
      </div>
      {trailing && (
        <span className="text-[10px] text-on-surface-variant whitespace-nowrap truncate">
          {trailing}
        </span>
      )}
    </div>
  );
}
