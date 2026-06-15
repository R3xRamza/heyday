/** Today: feather green circle + TODAY label (mockup). */
export default function DayNumber({ day, today, muted }) {
  if (today) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-feather text-white font-bold text-sm">
          {day}
        </span>
        <span className="text-[10px] font-bold text-feather uppercase tracking-widest">Today</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-block text-sm font-semibold ${
        muted ? 'text-on-surface-variant/50' : 'text-feather'
      }`}
    >
      {day}
    </span>
  );
}
