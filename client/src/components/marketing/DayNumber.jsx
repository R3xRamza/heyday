/** Today: feather green circle + TODAY label (mockup). Compact on phone. */
export default function DayNumber({ day, today, muted }) {
  if (today) {
    return (
      <span className="inline-flex items-center gap-1 md:gap-1.5 select-none">
        <span className="inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-feather text-white font-bold text-xs md:text-sm">
          {day}
        </span>
        <span className="hidden md:inline text-[10px] font-bold text-feather uppercase tracking-widest">
          Today
        </span>
      </span>
    );
  }
  return (
    <span
      className={`inline-block text-xs md:text-sm font-semibold select-none ${
        muted ? 'text-on-surface-variant/50' : 'text-feather'
      }`}
    >
      {day}
    </span>
  );
}
