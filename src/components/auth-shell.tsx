import type { ReactNode } from "react";
import { CircleCheck, Quote } from "lucide-react";
import { isAppMode } from "@/lib/app-mode";
import { Logo, LogoMark } from "./logo";

type Props = { title: string; subtitle: string; children: ReactNode; footer: ReactNode };

/** Frame for the login and register pages: two columns on the website, a full-screen sheet in the app. */
export async function AuthShell(props: Props) {
  return (await isAppMode()) ? <AppAuthShell {...props} /> : <WebAuthShell {...props} />;
}

function WebAuthShell({ title, subtitle, children, footer }: Props) {
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
            Every mark explained, every grader accountable, every crib settled with evidence.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-indigo-100">
            {["An AI assistant for tricky answers", "Scanned answer sheets with every result", "Cribs backed by the rubric, not arguments"].map((t) => (
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

/** App sign-in: brand area on top, the form on a sheet that rises from the bottom. */
function AppAuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-gradient-to-b from-indigo-700 via-indigo-800 to-indigo-900">
      <div className="relative flex flex-col items-center px-6 pt-[calc(env(safe-area-inset-top)+3rem)] pb-10 text-center text-white">
        <div className="bg-dots-light absolute inset-0" aria-hidden />
        <div className="absolute -top-10 -right-10 size-56 rounded-full bg-amber-400/25 blur-3xl" aria-hidden />
        <LogoMark className="relative !size-16 !rounded-2xl shadow-lg ring-4 ring-white/15" />
        <div className="relative mt-4 font-display text-3xl font-semibold tracking-tight">
          Fair<span className="text-amber-300">Grade</span>
        </div>
        <p className="relative mt-1 text-sm text-indigo-100">Clear, accountable grading</p>
      </div>
      <div className="flex-1 rounded-t-[2rem] bg-white px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] shadow-[0_-12px_40px_rgb(15_23_42/0.25)]">
        <div className="mx-auto max-w-sm">
          <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-slate-200" aria-hidden />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-600">{subtitle}</p>
          <div className="[&_input]:!py-3 [&_input]:!text-base [&_button[type=submit]]:!py-3 [&_button[type=submit]]:!text-base">{children}</div>
          <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
        </div>
      </div>
    </div>
  );
}
