export function BehaviorBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const width = `${clamped}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 overflow-hidden rounded-full bg-slate-700/80">
        {/* main fill */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300 transition-all duration-700 ease-out"
          style={{ width }}
        />
        {/* subtle ring to sharpen edges */}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-slate-900/80" />
      </div>
      <span className="text-xs tabular-nums text-slate-300">{value}%</span>
    </div>
  );
}
