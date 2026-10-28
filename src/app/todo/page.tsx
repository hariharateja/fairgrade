import Link from "next/link";
import { ChevronRight, CircleCheckBig, ClipboardCheck, Gavel, MessageSquareText, ScanLine, Sparkles, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isAppMode } from "@/lib/app-mode";
import { getTodos, type TodoKind } from "@/lib/todo";
import { Card, IconTile, PageHeader } from "@/components/ui";

const KIND: Record<TodoKind, { icon: React.ReactNode; tone: "indigo" | "amber" | "green" | "rose" | "slate" }> = {
  mark: { icon: <ClipboardCheck />, tone: "indigo" },
  scan: { icon: <ScanLine />, tone: "amber" },
  apply: { icon: <Sparkles />, tone: "indigo" },
  escalated: { icon: <Gavel />, tone: "rose" },
  crib: { icon: <MessageSquareText />, tone: "amber" },
  results: { icon: <Trophy />, tone: "green" },
};

export default async function TodoPage() {
  const user = await requireUser();
  const [todos, app] = await Promise.all([getTodos(user.id), isAppMode()]);
  const actionable = todos.filter((t) => t.kind !== "results");
  const results = todos.filter((t) => t.kind === "results");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {!app && <PageHeader title="To do" description="Everything waiting on you, across all your courses." />}

      {todos.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CircleCheckBig className="size-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-slate-900">You&rsquo;re all caught up</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-600">Nothing is waiting on you right now. New grading work, doubts and cribs will show up here.</p>
        </Card>
      ) : (
        <>
          {actionable.length > 0 && <TodoList title="Needs your attention" items={actionable} />}
          {results.length > 0 && <TodoList title="Results" items={results} />}
        </>
      )}
    </div>
  );
}

function TodoList({ title, items }: { title: string; items: Awaited<ReturnType<typeof getTodos>> }) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {items.map((t) => (
          <Link key={t.key} href={t.href} className="flex items-center gap-3.5 px-4 py-3.5 transition active:bg-slate-100 sm:px-5 sm:hover:bg-slate-50">
            <IconTile tone={KIND[t.kind].tone}>{KIND[t.kind].icon}</IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-900">{t.title}</span>
                {t.kind !== "results" && (
                  <span className="rounded-full bg-amber-100 px-2 text-xs leading-5 font-semibold text-amber-900 tabular-nums">{t.count}</span>
                )}
              </div>
              <div className="truncate text-sm text-slate-500">
                <span className="font-medium text-slate-700">
                  {t.course} · {t.exam}
                </span>{" "}
                · {t.detail}
              </div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-slate-300" />
          </Link>
        ))}
      </Card>
    </section>
  );
}
