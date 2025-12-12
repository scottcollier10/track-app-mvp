export function MetricCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.75)] backdrop-blur">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {props.label}
      </p>
      <p className="text-2xl font-semibold text-slate-50">{props.value}</p>
      <p className="mt-1 text-xs text-slate-400">{props.helper}</p>
    </div>
  );
}
