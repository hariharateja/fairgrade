"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export type Tab = { href: string; label: string; count?: number; exact?: boolean };

export function ExamTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition",
              active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {tab.label}
            {!!tab.count && (
              <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
