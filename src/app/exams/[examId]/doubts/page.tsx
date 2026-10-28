import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { DoubtStatusBadge } from "@/components/doubt-status";
import { Card, EmptyState, LinkButton, Table } from "@/components/ui";
import { fmt, studentLabel, timeAgo } from "@/lib/utils";

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
  const doubts = await db.doubt.findMany({
    where,
    include: {
      question: { select: { label: true, maxMarks: true } },
      raisedBy: { select: { name: true } },
      student: { select: { id: true, name: true, rollNo: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/exams/${examId}/doubts?filter=${f.key}`}
              className={`rounded-md px-3 py-1.5 ${filter === f.key ? "bg-white font-medium shadow-xs" : "text-slate-600"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <LinkButton href={`/exams/${examId}/doubts/new`}>+ Raise a doubt</LinkButton>
      </div>

      <p className="text-sm text-slate-600">
        Every doubt is visible to the whole grading team, so others can learn from it and weigh in.
        {moderator && " Escalated doubts need your decision; publishing one as a ruling applies it to every TA."}
      </p>

      {doubts.length === 0 ? (
        <EmptyState title="No doubts here">When a TA is unsure about an answer, they photograph it and raise a doubt.</EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Answer sheet</th>
                <th>Raised by</th>
                <th>AI suggests</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {doubts.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.question.label}</td>
                  <td className="text-slate-600">{d.student ? studentLabel(exam, d.student, moderator) : "–"}</td>
                  <td className="text-slate-600">
                    {d.raisedBy.name}
                    <div className="text-xs text-slate-400">{timeAgo(d.createdAt)}</div>
                  </td>
                  <td className="font-mono tabular-nums">
                    {d.status === "RESOLVED" && d.finalMarks !== null
                      ? `${fmt(d.finalMarks)} (final)`
                      : d.aiMarks !== null
                        ? `${fmt(d.aiMarks)} / ${fmt(d.question.maxMarks)}`
                        : "–"}
                  </td>
                  <td>
                    <DoubtStatusBadge status={d.status} />
                    {d._count.comments > 0 && <span className="ml-2 text-xs text-slate-500">{d._count.comments} 💬</span>}
                  </td>
                  <td className="text-right">
                    <Link href={`/exams/${examId}/doubts/${d.id}`} className="font-medium text-indigo-700 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
