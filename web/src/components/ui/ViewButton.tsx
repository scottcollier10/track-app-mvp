type ViewButtonProps = {
  variant?: "primary" | "subtle";
  onClick?: () => void;
};

export function ViewButton({ variant = "primary", onClick }: ViewButtonProps) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border text-[11px] " +
    "transition-colors transition-transform duration-150 ease-out " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  const styles =
    variant === "primary"
      ? [
          "border-sky-400/90 text-sky-50",
          "bg-slate-900/70 shadow-[0_0_0_1px_rgba(15,23,42,0.8),0_10px_25px_rgba(8,47,73,0.65)]",
          "hover:bg-sky-500/15 hover:border-sky-300 hover:text-sky-50",
          "active:scale-95",
        ].join(" ")
      : [
          "border-slate-600/70 text-slate-200",
          "bg-slate-950/60 shadow-[0_0_0_1px_rgba(15,23,42,0.8)]",
          "hover:bg-slate-800/80 hover:border-slate-400 hover:text-slate-50",
          "active:scale-95",
        ].join(" ");

  return (
    <button type="button" className={`${base} ${styles}`} onClick={onClick}>
      <span className="translate-x-px">→</span>
    </button>
  );
}
