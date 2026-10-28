"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, ChartColumn, ClipboardCheck, Gavel, LayoutGrid, MessageSquareText, Sparkles, Flag } from "lucide-react";
import { cx } from "./ui";

const ICONS = {
  overview: LayoutGrid,
  rubric: BookOpenCheck,
  grade: ClipboardCheck,
  doubts: Sparkles,
  rulings: Gavel,
  cribs: MessageSquareText,
  consistency: ChartColumn,
  results: Flag,
};

export type Tab = { href: string; label: string; icon: keyof typeof ICONS; count?: number; exact?: boolean };

export function ExamTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto px-3 sm:px-4 [scrollbar-width:none]">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = ICONS[tab.icon];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(
              "flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition",
              active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900",
            )}
          >
            <Icon className={cx("size-4", active ? "text-indigo-600" : "text-slate-400")} />
            {tab.label}
            {!!tab.count && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[11px] leading-[18px] font-bold text-amber-950">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
