import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sheetCode } from "@/lib/utils";

function csvCell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Marks sheet for the instructor: one row per student, one column per question. */
export async function GET(_req: Request, ctx: RouteContext<"/exams/[examId]/export">) {
  const { examId } = await ctx.params;
  const user = await getCurrentUser();
  const exam = await db.exam.findUnique({ where: { id: examId }, include: { course: true } });
  if (!user || !exam) return new Response("Not found", { status: 404 });
  const membership = await db.membership.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: exam.courseId } },
  });
  if (membership?.role !== "INSTRUCTOR" && membership?.role !== "HEAD_TA") return new Response("Not found", { status: 404 });

  const [questions, students, grades, allocations] = await Promise.all([
    db.question.findMany({ where: { examId }, orderBy: { order: "asc" } }),
    db.membership.findMany({ where: { courseId: exam.courseId, role: "STUDENT" }, include: { user: true } }),
    db.grade.findMany({ where: { examId } }),
    db.allocation.findMany({ where: { examId }, include: { ta: { select: { name: true } } } }),
  ]);

  const header = ["Roll no.", "Name", "Email", "Sheet code", "Grader", ...questions.map((q) => `${q.label} (/${q.maxMarks})`), `Total (/${exam.totalMarks})`];
  const rows = students
    .map((m) => m.user)
    .sort((a, b) => (a.rollNo ?? a.name).localeCompare(b.rollNo ?? b.name))
    .map((s) => {
      const marks = questions.map((q) => grades.find((g) => g.questionId === q.id && g.studentId === s.id)?.marks ?? null);
      const total = marks.some((m) => m !== null) ? marks.reduce<number>((a, m) => a + (m ?? 0), 0) : null;
      return [
        s.rollNo,
        s.name,
        s.email,
        sheetCode(examId, s.id),
        allocations.find((a) => a.studentId === s.id)?.ta.name ?? "",
        ...marks,
        total,
      ];
    });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const filename = `${exam.course.code}-${exam.title}`.replace(/[^\w-]+/g, "_");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
