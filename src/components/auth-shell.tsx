import type { ReactNode } from "react";
import { CircleCheck, Quote } from "lucide-react";
import { Logo } from "./logo";

/** Two-column frame for the login and register pages: brand panel on the left, form on the right. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-900/5 lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-10 text-white lg:flex lg:flex-col">
        <div className="bg-dots-light absolute inset-0" aria-hidden />
        <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-amber-400/25 blur-3xl" aria-hidden />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative mt-auto">
          <Quote className="size-8 text-amber-300" />
          <p className="mt-3 font-display text-2xl leading-snug">
            Twelve TAs, one standard. The rubric decides the marks, not who happened to pick up your paper.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-indigo-100">
            {["AI help on doubtful answers, with reasons", "Shared rulings for every edge case", "Bias checks before results go out"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CircleCheck className="size-4 text-amber-300" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="p-6 sm:p-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1.5 mb-7 text-slate-600">{subtitle}</p>
        {children}
        <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
      </div>
    </div>
  );
}
