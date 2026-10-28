import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { aiMode, PROVIDER_LABEL } from "@/lib/ai-providers";
import { isAppMode } from "@/lib/app-mode";
import { todoCount } from "@/lib/todo";
import { AppTabBar, AppTopBar } from "@/components/app-shell";
import { HeaderNav } from "@/components/header-nav";
import { NativeBridge } from "@/components/native-bridge";
import { Avatar, Badge, LinkButton } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: "FairGrade · Clear, accountable grading",
  description:
    "The grading platform for university courses: rubric-based marking, an AI grading assistant, scanned answer sheets, accountable TAs and evidence-based cribs.",
};

export const viewport: Viewport = {
  // Draw under the Android status and gesture bars; the app shell pads itself with safe-area insets.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, app] = await Promise.all([getCurrentUser(), isAppMode()]);
  const fonts = `${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`;

  if (app) {
    const todos = user ? await todoCount(user.id) : 0;
    return (
      <html lang="en" className={fonts} data-app="">
        <body className="flex min-h-full flex-col overflow-x-clip select-none">
          <NativeBridge />
          {user && <AppTopBar />}
          <main
            className={
              user ? "w-full flex-1 px-3 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] select-text" : "flex w-full flex-1 flex-col select-text"
            }
          >
            {children}
          </main>
          {user && <AppTabBar todoCount={todos} />}
        </body>
      </html>
    );
  }

  const mode = aiMode();
  return (
    <html lang="en" className={fonts}>
      <body className="flex min-h-full flex-col overflow-x-clip">
        <NativeBridge />
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
            <HeaderNav loggedIn={!!user} />
            {user ? (
              <div className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="hidden sm:inline-flex">
                  <Badge tone={mode === "demo" ? "amber" : "indigo"}>{mode === "demo" ? "AI demo mode" : `AI: ${PROVIDER_LABEL[mode]}`}</Badge>
                </span>
                <Link href="/account" className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 transition hover:bg-slate-100 md:pr-3" title="Account">
                  <Avatar name={user.name} />
                  <span className="hidden font-medium text-slate-700 md:inline">{user.name}</span>
                </Link>
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
            <span>FairGrade · Clear, accountable grading for every course.</span>
            <span>© {new Date().getFullYear()} FairGrade</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
