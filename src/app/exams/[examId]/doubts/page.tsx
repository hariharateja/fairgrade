import Link from "next/link";
import { ChevronRight, ImageIcon, MessageSquareText, Plus, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { CONFIDENCE_TONE, DoubtStatusBadge } from "@/components/doubt-status";
import { Avatar, Badge, Card, EmptyState, FilterTabs, LinkButton, cx } from "@/components/ui";
import { fmt, parseJson, studentLabel, timeAgo } from "@/lib/utils";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "escalated", label: "With instructor" },
  { key: "mine", label: "Raised by me" },
  { key: "all", label: "All" },
] as const;

export default async function DoubtsPage({ params, searchParams }: PageProps<"/exams/[examId]/doubts">) {
  const { examId } = await params;
  const sp = await searchParams;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const moderator = isModerator(role);
  const filter = FILTERS.find((f) => f.key === sp.filter)?.key ?? (moderator ? "escalated" : "open");

  const where = {
    examId,
    ...(filter === "open" ? { status: { not: "RESOLVED" } } : {}),
    ...(filter === "escalated" ? { status: "ESCALATED" } : {}),
    ...(filter === "mine" ? { raisedById: user.id } : {}),
  };
  const [doubts, byStatus, mine] = await Promise.all([
    db.doubt.findMany({
      where,
      include: {
        question: { select: { label: true, maxMarks: true } },
        raisedBy: { select: { name: true } },
        student: { select: { id: true, name: true, rollNo: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.doubt.groupBy({ by: ["status"], where: { examId }, _count: true }),
    db.doubt.count({ where: { examId, raisedById: user.id } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const counts = {
    open: count("AI_SUGGESTED") + count("ESCALATED"),
    escalated: count("ESCALATED"),
    mine,
    all: byStatus.reduce((n, b) => n + b._count, 0),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          active={filter}
          items={FILTERS.map((f) => ({ key: f.key, label: f.label, href: `/exams/${examId}/doubts?filter=${f.key}`, count: counts[f.key] }))}
        />
        <LinkButton href={`/exams/${examId}/doubts/new`}>
          <Plus className="size-4" /> Raise a doubt
        </LinkButton>
      </div>

      <p className="text-sm text-slate-600">
        Every doubt is visible to the whole grading team, so others can learn from it and weigh in.
        {moderator && " Escalated doubts need your decision; publishing one as a ruling applies it to every TA."}
      </p>

      {doubts.length === 0 ? (
        <EmptyState title="No doubts here">When a TA is unsure about an answer, they photograph it and raise a doubt.</EmptyState>
      ) : (
        <div className="space-y-3">
          {doubts.map((d) => {
            const photos = parseJson<string[]>(d.imagePaths, []).length;
            const resolved = d.status === "RESOLVED";
            const shownMarks = resolved && d.finalMarks !== null ? d.finalMarks : d.aiMarks;
            return (
              <Link key={d.id} href={`/exams/${examId}/doubts/${d.id}`} className="group block">
                <Card
                  className={cx(
                    "flex items-center gap-4 px-4 py-4 transition group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-lg group-hover:shadow-indigo-900/5 sm:px-5",
                    d.status === "ESCALATED" && "border-l-4 border-l-amber-400",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 font-display text-base font-semibold text-indigo-700">
                    {d.question.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {d.student ? studentLabel(exam, d.student, moderator) : "General question"}
                      </span>
                      <DoubtStatusBadge status={d.status} />
                      {!resolved && d.aiConfidence && <Badge tone={CONFIDENCE_TONE[d.aiConfidence]}>{d.aiConfidence} confidence</Badge>}
                    </div>
                    {d.note && <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">&ldquo;{d.note}&rdquo;</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={d.raisedBy.name} size="sm" /> {d.raisedBy.name} · {timeAgo(d.createdAt)}
                      </span>
                      {photos > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="size-3.5" /> {photos}
                        </span>
                      )}
                      {d._count.comments > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquareText className="size-3.5" /> {d._count.comments}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="flex items-center justify-end gap-1 text-xs font-medium text-slate-500">
                      {resolved ? "Final" : <><Sparkles className="size-3 text-indigo-500" /> AI suggests</>}
                    </div>
                    <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      {shownMarks === null ? "–" : fmt(shownMarks)}
                      <span className="text-sm font-normal text-slate-400"> / {fmt(d.question.maxMarks)}</span>
                    </div>
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
