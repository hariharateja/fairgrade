import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam, isModerator, canEditGrades } from "@/lib/access";
import { Badge, Card, EmptyState, LinkButton, Notice, Table, buttonClass } from "@/components/ui";
import { fmt, sheetCode, studentLabel } from "@/lib/utils";

export default async function GradeQueue({ params, searchParams }: PageProps<"/exams/[examId]/grade">) {
  const { examId } = await params;
  const sp = await searchParams;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const showAll = sp.view === "all";
  const search = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [questionCount, allocations, students, grades] = await Promise.all([
    db.question.count({ where: { examId } }),
    db.allocation.findMany({ where: { examId }, include: { ta: { select: { name: true } } } }),
    db.membership.findMany({
      where: { courseId: exam.courseId, role: "STUDENT" },
      include: { user: { select: { id: true, name: true, rollNo: true } } },
    }),
    db.grade.groupBy({ by: ["studentId"], where: { examId }, _count: true, _sum: { marks: true } }),
  ]);

  const allocationOf = new Map(allocations.map((a) => [a.studentId, a]));
  const gradeOf = new Map(grades.map((g) => [g.studentId, g]));
  const mine = allocations.filter((a) => a.taId === user.id).length;

  let rows = students
    .map((s) => ({
      student: s.user,
      label: studentLabel(exam, s.user),
      allocation: allocationOf.get(s.userId),
      graded: gradeOf.get(s.userId)?._count ?? 0,
      total: gradeOf.get(s.userId)?._sum.marks ?? null,
    }))
    .filter((r) => showAll || r.allocation?.taId === user.id);
  if (search) {
    rows = rows.filter(
      (r) =>
        r.label.toLowerCase().includes(search) ||
        sheetCode(exam.id, r.student.id).toLowerCase().includes(search),
    );
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  const done = rows.filter((r) => questionCount > 0 && r.graded >= questionCount).length;
  const firstPending = rows.find((r) => r.graded < questionCount);
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
            href={`/exams/${examId}/grade`}
            className={`rounded-md px-3 py-1.5 ${!showAll ? "bg-white font-medium shadow-xs" : "text-slate-600"}`}
          >
            My scripts ({mine})
          </Link>
          <Link
            href={`/exams/${examId}/grade?view=all`}
            className={`rounded-md px-3 py-1.5 ${showAll ? "bg-white font-medium shadow-xs" : "text-slate-600"}`}
          >
            All students ({students.length})
          </Link>
        </div>
        <form className="flex gap-2">
          {showAll && <input type="hidden" name="view" value="all" />}
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
          {done} of {rows.length} scripts fully graded
        </span>
        {firstPending && editable && (
          <LinkButton href={`/exams/${examId}/grade/${firstPending.student.id}${showAll ? "?view=all" : ""}`}>
            Continue grading →
          </LinkButton>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={showAll ? "No students found" : "No scripts allocated to you"}>
          {showAll
            ? "Students join the course with the student code."
            : isModerator(role)
              ? "Allocate scripts from the Overview tab."
              : "Ask the instructor to allocate scripts, or switch to All students to find a script."}
        </EmptyState>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                {showAll && <th>Grader</th>}
                <th>Progress</th>
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
                      <Badge tone="green">Done</Badge>
                    ) : r.graded > 0 ? (
                      <Badge tone="blue">
                        {r.graded}/{questionCount}
                      </Badge>
                    ) : (
                      <Badge>Not started</Badge>
                    )}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {r.total === null ? "–" : `${fmt(r.total)} / ${fmt(exam.totalMarks)}`}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/exams/${examId}/grade/${r.student.id}${showAll ? "?view=all" : ""}`}
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
      )}
    </div>
  );
}
