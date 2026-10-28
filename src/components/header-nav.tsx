"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LayoutGrid, ListTodo } from "lucide-react";
import { Logo } from "./logo";
import { cx } from "./ui";

/** Where "back" goes when there's no browser history to return to (e.g. a page opened from a link). */
function parentOf(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "exams" && parts.length > 2) return `/${parts.slice(0, parts.length - 1).join("/")}`;
  return "/";
}

/**
 * Left side of the header. On phones (and in the Android app, which has no browser chrome)
 * a back button appears on every page except the home page.
 */
export function HeaderNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const home = pathname === "/";
  const inCourses = pathname === "/" || pathname.startsWith("/courses") || pathname.startsWith("/exams");

  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-6">
      {loggedIn && !home && (
        <button
          type="button"
          aria-label="Back"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(parentOf(pathname)))}
          className="-ml-2 grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 md:hidden"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      <Link href="/" aria-label="FairGrade home" className="shrink-0">
        <Logo />
      </Link>
      {loggedIn && (
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "/", label: "My courses", icon: LayoutGrid, active: inCourses },
            { href: "/todo", label: "To do", icon: ListTodo, active: pathname.startsWith("/todo") },
          ].map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
