import Link from "next/link";
import { Check, ChevronRight, ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireExam, isModerator, canEditGrades } from "@/lib/access";
import { Badge, Card, EmptyState, LinkButton, Notice, Table, buttonClass } from "@/components/ui";
import { fmt, sheetCode, studentLabel } from "@/lib/utils";

export default async function GradeQueue({ params, searchParams }: PageProps<"/exams/[examId]/grade">) {
  const { examId } = await params;
  const sp = await searchParams;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  // Moderators have no allocation of their own, so they default to everyone.
  const showAll = sp.view ? sp.view === "all" : isModerator(role);
  const suffix = showAll ? "?view=all" : "?view=mine";
  const search = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [questionCount, allocations, students, grades, sheets] = await Promise.all([
    db.question.count({ where: { examId } }),
    db.allocation.findMany({ where: { examId }, include: { ta: { select: { name: true } } } }),
    db.membership.findMany({
      where: { courseId: exam.courseId, role: "STUDENT" },
      include: { user: { select: { id: true, name: true, rollNo: true } } },
    }),
    db.grade.groupBy({ by: ["studentId"], where: { examId }, _count: true, _sum: { marks: true } }),
    db.answerSheet.findMany({ where: { examId }, select: { studentId: true } }),
  ]);

  const allocationOf = new Map(allocations.map((a) => [a.studentId, a]));
  const gradeOf = new Map(grades.map((g) => [g.studentId, g]));
  const scanned = new Set(sheets.map((s) => s.studentId));
  const mine = allocations.filter((a) => a.taId === user.id).length;

  let rows = students
    .map((s) => ({
      student: s.user,
      label: studentLabel(exam, s.user),
      allocation: allocationOf.get(s.userId),
      graded: gradeOf.get(s.userId)?._count ?? 0,
      total: gradeOf.get(s.userId)?._sum.marks ?? null,
      scanned: scanned.has(s.userId),
    }))
    .filter((r) => showAll || r.allocation?.taId === user.id);
  if (search) {
    rows = rows.filter((r) => r.label.toLowerCase().includes(search) || sheetCode(exam.id, r.student.id).toLowerCase().includes(search));
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  // An answer sheet is done only when every question is marked and the scan is uploaded.
  const isDone = (r: (typeof rows)[number]) => questionCount > 0 && r.graded >= questionCount && r.scanned;
  const done = rows.filter(isDone).length;
  const missingScans = rows.filter((r) => r.graded > 0 && !r.scanned).length;
  const firstPending = rows.find((r) => !isDone(r));
  const editable = canEditGrades(role, exam.status);

  return (
    <div className="space-y-4">
      {!editable && (
        <Notice tone="amber">
          {exam.status === "DRAFT"
            ? "Grading hasn't started. The instructor starts it from the Overview tab once the rubric is ready."
            : "Grading is closed for TAs. Changes now go through cribs."}
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <Link
            href={`/exams/${examId}/grade?view=mine`}
            className={`rounded-md px-3 py-1.5 ${!showAll ? "bg-white font-medium shadow-xs" : "text-slate-600"}`}
          >
            Allocated to me ({mine})
          </Link>
          <Link
            href={`/exams/${examId}/grade?view=all`}
            className={`rounded-md px-3 py-1.5 ${showAll ? "bg-white font-medium shadow-xs" : "text-slate-600"}`}
          >
            All answer sheets ({students.length})
          </Link>
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="view" value={showAll ? "all" : "mine"} />
          <input
            name="q"
            defaultValue={search}
            placeholder={exam.blindGrading ? "Search sheet code…" : "Search roll no. or name…"}
            className="!w-56"
          />
          <button className={buttonClass("secondary")}>Search</button>
        </form>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {done} of {rows.length} answer sheets done (graded and scanned)
          {missingScans > 0 && <span className="text-amber-700"> · {missingScans} graded but not scanned yet</span>}
        </span>
        {firstPending && editable && (
          <LinkButton href={`/exams/${examId}/grade/${firstPending.student.id}${suffix}`}>Continue grading →</LinkButton>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={showAll ? "No students found" : "No answer sheets allocated to you"}>
          {showAll
            ? "Students join the course with the student code."
            : isModerator(role)
              ? "Allocate answer sheets from the Overview tab, or switch to All answer sheets."
              : "Ask the instructor to allocate answer sheets, or switch to All answer sheets to find one."}
        </EmptyState>
      ) : (
        <>
          {/* Phones: a tappable list instead of a cramped table. */}
          <Card className="divide-y divide-slate-100 overflow-hidden sm:hidden">
            {rows.map((r) => {
              const marked = questionCount > 0 && r.graded >= questionCount;
              return (
                <Link
                  key={r.student.id}
                  href={`/exams/${examId}/grade/${r.student.id}${suffix}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-slate-100"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${marked && r.scanned ? "bg-emerald-100 text-emerald-700" : marked || r.graded > 0 ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}
                  >
                    {marked && r.scanned ? <Check className="size-4" strokeWidth={3} /> : <ClipboardCheck className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{r.label}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {marked ? (
                        <Badge tone="green">All marked</Badge>
                      ) : r.graded > 0 ? (
                        <Badge tone="blue">
                          {r.graded}/{questionCount} marked
                        </Badge>
                      ) : (
                        <Badge>Not started</Badge>
                      )}
                      {r.scanned ? <Badge tone="green">PDF ✓</Badge> : r.graded > 0 && <Badge tone="amber">No scan</Badge>}
                      {showAll && r.allocation && <span className="text-slate-400">{r.allocation.ta.name}</span>}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {r.total === null ? "–" : fmt(r.total)}
                    <span className="block text-[10px] font-normal text-slate-400">/ {fmt(exam.totalMarks)}</span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-300" />
                </Link>
              );
            })}
          </Card>
          <Card className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <th>Student</th>
                  {showAll && <th>Grader</th>}
                  <th>Marks</th>
                  <th>Scan</th>
                  <th className="text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student.id}>
                    <td className="font-medium">{r.label}</td>
                    {showAll && <td className="text-slate-600">{r.allocation?.ta.name ?? "–"}</td>}
                    <td>
                      {questionCount > 0 && r.graded >= questionCount ? (
                        <Badge tone="green">All marked</Badge>
                      ) : r.graded > 0 ? (
                        <Badge tone="blue">
                          {r.graded}/{questionCount}
                        </Badge>
                      ) : (
                        <Badge>Not started</Badge>
                      )}
                    </td>
                    <td>
                      {r.scanned ? <Badge tone="green">PDF ✓</Badge> : <Badge tone={r.graded > 0 ? "amber" : "slate"}>Missing</Badge>}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {r.total === null ? "–" : `${fmt(r.total)} / ${fmt(exam.totalMarks)}`}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/exams/${examId}/grade/${r.student.id}${suffix}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {editable ? "Grade" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
