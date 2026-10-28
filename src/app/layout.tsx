import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { aiMode, PROVIDER_LABEL } from "@/lib/ai-providers";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Badge, LinkButton } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: "FairGrade · Consistent grading for large courses",
  description:
    "Rubric-driven grading for 300-student courses: AI help on doubtful answers, shared rulings, grader-bias detection and peaceful cribs.",
};

function initials(name: string) {
  return name
    .replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const mode = aiMode();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-clip">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" aria-label="FairGrade home">
              <Logo />
            </Link>
            {user ? (
              <div className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="hidden sm:inline-flex">
                  <Badge tone={mode === "demo" ? "amber" : "indigo"}>{mode === "demo" ? "AI demo mode" : `AI: ${PROVIDER_LABEL[mode]}`}</Badge>
                </span>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-xs font-semibold text-amber-950 ring-2 ring-white">
                    {initials(user.name)}
                  </span>
                  <span className="hidden font-medium text-slate-700 md:inline">{user.name}</span>
                </div>
                <form action={logout}>
                  <button
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    title="Log out"
                  >
                    <LogOut className="size-4" />
                    <span className="hidden sm:inline">Log out</span>
                  </button>
                </form>
              </div>
            ) : (
              <nav className="flex items-center gap-1 text-sm sm:gap-2">
                <Link href="/#how-it-works" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 sm:inline">
                  How it works
                </Link>
                <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
                  Log in
                </Link>
                <LinkButton href="/register" size="sm" className="!px-3.5 !py-2 !text-sm">
                  Get started
                </LinkButton>
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
        <footer className="border-t border-slate-200/70 bg-white/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500">
            <span>FairGrade: same answer, same marks, whoever grades it.</span>
            <span>Built for large university courses · ET 610 project</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
