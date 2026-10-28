import Link from "next/link";
import { ArrowRight, ChevronRight, ImageIcon, Shuffle } from "lucide-react";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { CribStatusBadge, VerdictBadge } from "@/components/crib-status";
import { Avatar, Card, EmptyState, FilterTabs, cx } from "@/components/ui";
import { fmt, parseJson, studentLabel, timeAgo } from "@/lib/utils";

export default async function CribsPage({ params, searchParams }: PageProps<"/exams/[examId]/cribs">) {
  const { examId } = await params;
  const sp = await searchParams;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const moderator = isModerator(role);
  const filters = [
    { key: "mine", label: "Assigned to me" },
    ...(moderator ? [{ key: "open", label: "All open" }] : []),
    { key: "decided", label: "Decided" },
  ];
  const filter = filters.find((f) => f.key === sp.filter)?.key ?? "mine";

  const [cribs, mineOpen, allOpen, decided] = await Promise.all([
    db.crib.findMany({
      where: {
        examId,
        ...(filter === "mine" ? { reviewerId: user.id, status: "OPEN" } : {}),
        ...(filter === "open" ? { status: "OPEN" } : {}),
        ...(filter === "decided" ? { status: { not: "OPEN" }, ...(moderator ? {} : { reviewerId: user.id }) } : {}),
      },
      include: {
        question: { select: { label: true, maxMarks: true } },
        student: { select: { id: true, name: true, rollNo: true } },
        reviewer: { select: { name: true } },
        grade: { include: { grader: { select: { name: true } } } },
      },
      orderBy: { createdAt: filter === "decided" ? "desc" : "asc" },
    }),
    db.crib.count({ where: { examId, reviewerId: user.id, status: "OPEN" } }),
    db.crib.count({ where: { examId, status: "OPEN" } }),
    db.crib.count({ where: { examId, status: { not: "OPEN" }, ...(moderator ? {} : { reviewerId: user.id }) } }),
  ]);
  const counts: Record<string, number> = { mine: mineOpen, open: allOpen, decided };

  return (
    <div className="space-y-5">
      <FilterTabs
        active={filter}
        items={filters.map((f) => ({ key: f.key, label: f.label, href: `/exams/${examId}/cribs?filter=${f.key}`, count: counts[f.key] }))}
      />
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Shuffle className="size-4 shrink-0 text-indigo-500" />
        Cribs go to a reviewer other than the original grader, and the AI pre-screens each one against the rubric and the scanned sheet.
      </p>

      {cribs.length === 0 ? (
        <EmptyState title={filter === "mine" ? "No cribs waiting for you" : "Nothing here"}>
          {exam.status === "PUBLISHED" ? "New cribs appear here as students raise them." : "Students can raise cribs once results are published."}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {cribs.map((c) => {
            const changed = c.marksAfter !== null && c.marksAfter !== c.marksBefore;
            const photos = parseJson<string[]>(c.imagePaths, []).length;
            return (
              <Link key={c.id} href={`/exams/${examId}/cribs/${c.id}`} className="group block">
                <Card
                  className={cx(
                    "flex items-center gap-4 px-4 py-4 transition group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-lg group-hover:shadow-indigo-900/5 sm:px-5",
                    c.status === "OPEN" && "border-l-4 border-l-indigo-400",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 font-display text-base font-semibold text-amber-800">
                    {c.question.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{studentLabel(exam, c.student, moderator)}</span>
                      <CribStatusBadge status={c.status} />
                      <VerdictBadge verdict={c.aiVerdict} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">&ldquo;{c.reason}&rdquo;</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>Graded by {c.grade.grader.name}</span>
                      {filter !== "mine" && c.reviewer && (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={c.reviewer.name} size="sm" /> {c.reviewer.name}
                        </span>
                      )}
                      <span>{timeAgo(c.createdAt)}</span>
                      {photos > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="size-3.5" /> {photos}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 font-mono text-lg font-semibold tabular-nums sm:flex">
                    <span className={changed ? "text-slate-400 line-through decoration-2" : "text-slate-900"}>{fmt(c.marksBefore)}</span>
                    {changed && (
                      <>
                        <ArrowRight className="size-4 text-emerald-500" />
                        <span className="text-emerald-700">{fmt(c.marksAfter)}</span>
                      </>
                    )}
                    <span className="text-sm font-normal text-slate-400">/ {fmt(c.question.maxMarks)}</span>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
