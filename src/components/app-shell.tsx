"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, CircleUser, LayoutGrid, ListTodo } from "lucide-react";
import { LogoMark } from "./logo";
import { cx } from "./ui";

/** Screens reachable from the bottom tab bar; they show the logo instead of a back arrow. */
const TABS = [
  { href: "/", label: "Courses", icon: LayoutGrid, match: (p: string) => p === "/" || p.startsWith("/courses") || p.startsWith("/exams") },
  { href: "/todo", label: "To do", icon: ListTodo, match: (p: string) => p.startsWith("/todo") },
  { href: "/account", label: "Account", icon: CircleUser, match: (p: string) => p.startsWith("/account") },
];

function titleFor(pathname: string) {
  if (pathname === "/") return "My courses";
  if (pathname.startsWith("/todo")) return "To do";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/courses")) return "Course";
  const section = pathname.split("/")[3];
  const titles: Record<string, string> = {
    rubric: "Rubric",
    grade: "Grading",
    doubts: "Doubts",
    rulings: "Rulings",
    cribs: "Cribs",
    analytics: "Consistency",
  };
  if (pathname.startsWith("/exams")) return titles[section] ?? "Exam";
  return "FairGrade";
}

function parentOf(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "exams" && parts.length > 2) return `/${parts.slice(0, parts.length - 1).join("/")}`;
  return "/";
}

/** Top app bar: back arrow (or logo on tab roots) and the screen title. */
export function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const root = TABS.some((t) => t.href === pathname);
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-2">
        {root ? (
          <span className="pl-2">
            <LogoMark className="size-8" />
          </span>
        ) : (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(parentOf(pathname)))}
            className="grid size-10 place-items-center rounded-full text-slate-700 active:bg-slate-200"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <h1 className="truncate font-display text-xl font-semibold tracking-tight text-slate-900">{titleFor(pathname)}</h1>
      </div>
    </header>
  );
}

/** Bottom tab bar, always one tap away from the main screens. */
export function AppTabBar({ todoCount }: { todoCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-md grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx("relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-indigo-700" : "text-slate-500")}
            >
              <span className={cx("grid h-7 w-14 place-items-center rounded-full transition", active && "bg-indigo-100")}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
              </span>
              {tab.label}
              {tab.href === "/todo" && todoCount > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[10px] leading-5 font-bold text-amber-950">
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
