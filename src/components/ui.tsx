import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export { cx };

const buttonStyles = {
  primary:
    "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-700 active:translate-y-px disabled:bg-indigo-300 disabled:shadow-none",
  secondary:
    "bg-white text-slate-800 border border-slate-300 shadow-xs hover:border-slate-400 hover:bg-slate-50 active:translate-y-px disabled:text-slate-400",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
  success:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:translate-y-px disabled:bg-emerald-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed whitespace-nowrap",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
    buttonStyles[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_-8px_rgb(15_23_42/0.08)]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("px-5 py-4 sm:px-6", className)} {...props} />;
}

const badgeTones = {
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-50 text-indigo-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
};

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-slate-500">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="relative overflow-hidden px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        {icon && <div className="text-indigo-400 [&_svg]:size-4">{icon}</div>}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </Card>
  );
}

export function Notice({ tone = "indigo", children }: { tone?: "indigo" | "amber" | "red" | "green"; children: ReactNode }) {
  const tones = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 [&_thead]:bg-slate-50/80 [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-indigo-50/30">
        {children}
      </table>
    </div>
  );
}

const AVATAR_TONES = [
  "from-indigo-400 to-indigo-600 text-white",
  "from-amber-300 to-amber-500 text-amber-950",
  "from-sky-400 to-sky-600 text-white",
  "from-emerald-400 to-emerald-600 text-white",
  "from-rose-400 to-rose-600 text-white",
  "from-violet-400 to-violet-600 text-white",
];

/** Initials in a coloured circle; the colour is stable per name. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const clean = name.replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "");
  const initials = clean
    .split(/[\s·]+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const tone = AVATAR_TONES[[...clean].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-11 text-sm" };
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold ring-2 ring-white", tone, sizes[size], className)}>
      {initials || "?"}
    </span>
  );
}

/** Circular gauge showing marks out of a maximum. */
export function ScoreRing({
  value,
  max,
  size = 64,
  tone = "indigo",
  label,
}: {
  value: number | null;
  max: number;
  size?: number;
  tone?: "indigo" | "amber" | "green";
  label?: ReactNode;
}) {
  const stroke = Math.max(5, size / 11);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null || max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const colors = { indigo: "text-indigo-600", amber: "text-amber-500", green: "text-emerald-500" };
  const shown = value === null ? "–" : Number.isInteger(value) ? String(value) : value.toFixed(1);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cx("fill-none stroke-current transition-[stroke-dashoffset] duration-500", colors[tone])}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="font-mono font-semibold text-slate-900 tabular-nums" style={{ fontSize: size * 0.3 }}>
            {shown}
          </div>
          <div className="mt-0.5 text-slate-400" style={{ fontSize: Math.max(9, size * 0.15) }}>
            {label ?? `of ${Number.isInteger(max) ? max : max.toFixed(1)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pill-style filter tabs made of links (works in server components). */
export function FilterTabs({ items, active }: { items: { key: string; label: ReactNode; href: string; count?: number }[]; active: string }) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 text-sm shadow-xs [scrollbar-width:none]">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={cx(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap transition",
            active === i.key ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {i.label}
          {i.count !== undefined && (
            <span className={cx("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", active === i.key ? "bg-white/20" : "bg-slate-100 text-slate-500")}>
              {i.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Small rounded square holding an icon. */
export function IconTile({ children, tone = "indigo", className }: { children: ReactNode; tone?: "indigo" | "amber" | "green" | "rose" | "slate"; className?: string }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]", tones[tone], className)}>{children}</span>;
}
