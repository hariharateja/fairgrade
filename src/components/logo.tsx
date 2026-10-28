import { cx } from "./ui";

/** A balance scale in a rounded tile: fairness, at a glance. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-600/30",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-[60%]">
        <path d="M12 3v18" />
        <path d="M7 21h10" />
        <path d="M5 7h14" />
        <path d="M12 5.5 5 7m7-1.5L19 7" />
        <path d="M5 7 2.5 13a3 3 0 0 0 5 0Z" fill="currentColor" fillOpacity="0.15" />
        <path d="m19 7-2.5 6a3 3 0 0 0 5 0Z" fill="#fbbf24" stroke="#fbbf24" />
      </svg>
    </span>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className={cx("font-display text-xl font-semibold tracking-tight", light ? "text-white" : "text-slate-900")}>
        Fair<span className={light ? "text-amber-300" : "text-indigo-600"}>Grade</span>
      </span>
    </span>
  );
}
