import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { CribStatusBadge, VerdictBadge } from "@/components/crib-status";
import { Card, EmptyState, Table } from "@/components/ui";
import { fmt, studentLabel, timeAgo } from "@/lib/utils";

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

  const cribs = await db.crib.findMany({
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
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm w-fit">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/exams/${examId}/cribs?filter=${f.key}`}
            className={`rounded-md px-3 py-1.5 ${filter === f.key ? "bg-white font-medium shadow-xs" : "text-slate-600"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        Cribs are routed to a reviewer other than the original grader. The AI pre-screens each one against the rubric to save you time.
      </p>

      {cribs.length === 0 ? (
        <EmptyState title="Nothing here">
          {exam.status === "PUBLISHED" ? "No cribs in this view." : "Students can raise cribs once results are published."}
        </EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Student</th>
                <th>Graded by</th>
                <th>Marks</th>
                <th>Pre-screen</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cribs.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.question.label}</td>
                  <td className="text-slate-600">
                    {studentLabel(exam, c.student, moderator)}
                    <div className="text-xs text-slate-400">{timeAgo(c.createdAt)}</div>
                  </td>
                  <td className="text-slate-600">{c.grade.grader.name}</td>
                  <td className="font-mono tabular-nums">
                    {fmt(c.marksBefore)}
                    {c.marksAfter !== null && c.marksAfter !== c.marksBefore && ` → ${fmt(c.marksAfter)}`} / {fmt(c.question.maxMarks)}
                  </td>
                  <td>
                    <VerdictBadge verdict={c.aiVerdict} />
                  </td>
                  <td>
                    <CribStatusBadge status={c.status} />
                    {filter !== "mine" && c.reviewer && <div className="text-xs text-slate-500">{c.reviewer.name}</div>}
                  </td>
                  <td className="text-right">
                    <Link href={`/exams/${examId}/cribs/${c.id}`} className="font-medium text-indigo-700 hover:underline">
                      {c.status === "OPEN" ? "Review" : "View"}
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
