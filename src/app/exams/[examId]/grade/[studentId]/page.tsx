import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireExam, canEditGrades, isModerator } from "@/lib/access";
import { saveScript } from "@/app/actions/grading";
import { GradingSheet, type SheetQuestion } from "@/components/grading-sheet";
import { SheetUploader } from "@/components/sheet-uploader";
import { Badge, EmptyState, Notice } from "@/components/ui";
import { parseJson, studentLabel } from "@/lib/utils";

export default async function GradeScript({ params, searchParams }: PageProps<"/exams/[examId]/grade/[studentId]">) {
  const { examId, studentId } = await params;
  const sp = await searchParams;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  // Moderators have no allocation of their own, so they default to everyone.
  const showAll = sp.view ? sp.view === "all" : isModerator(role);

  const membership = await db.membership.findUnique({
    where: { userId_courseId: { userId: studentId, courseId: exam.courseId } },
    include: { user: { select: { id: true, name: true, rollNo: true } } },
  });
  if (!membership || membership.role !== "STUDENT") notFound();
  const student = membership.user;

  const [questions, grades, doubts, allocation, answerSheet, queue] = await Promise.all([
    db.question.findMany({
      where: { examId },
      orderBy: { order: "asc" },
      include: { rubricItems: { orderBy: { order: "asc" } }, rulings: { orderBy: { createdAt: "asc" } } },
    }),
    db.grade.findMany({ where: { examId, studentId }, include: { grader: { select: { name: true } } } }),
    db.doubt.findMany({ where: { examId, studentId, status: { not: "RESOLVED" } }, select: { questionId: true } }),
    db.allocation.findUnique({ where: { examId_studentId: { examId, studentId } }, include: { ta: true } }),
    db.answerSheet.findUnique({
      where: { examId_studentId: { examId, studentId } },
      include: { uploadedBy: { select: { name: true } } },
    }),
    // Grading order: the same list the queue page shows.
    showAll
      ? db.membership.findMany({
          where: { courseId: exam.courseId, role: "STUDENT" },
          include: { user: { select: { id: true, name: true, rollNo: true } } },
        }).then((ms) => ms.map((m) => m.user))
      : db.allocation
          .findMany({
            where: { examId, taId: user.id },
            include: { student: { select: { id: true, name: true, rollNo: true } } },
          })
          .then((as) => as.map((a) => a.student)),
  ]);

  if (questions.length === 0) {
    return <EmptyState title="No questions yet">The instructor needs to add the rubric first.</EmptyState>;
  }

  const ordered = queue
    .map((s) => ({ id: s.id, label: studentLabel(exam, s) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const index = ordered.findIndex((s) => s.id === studentId);
  const suffix = showAll ? "?view=all" : "?view=mine";
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  const sheet: SheetQuestion[] = questions.map((q) => {
    const g = grades.find((x) => x.questionId === q.id);
    return {
      id: q.id,
      label: q.label,
      maxMarks: q.maxMarks,
      prompt: q.prompt,
      rubric: q.rubricItems.map((r) => ({ id: r.id, description: r.description, marks: r.marks })),
      rulings: q.rulings.map((r) => ({ id: r.id, text: r.text })),
      grade: g
        ? {
            marks: g.marks,
            applied: parseJson<string[]>(g.appliedItemIds, []),
            manualOverride: g.manualOverride,
            comment: g.comment,
            graderName: g.grader.name,
          }
        : null,
      doubtHref: `/exams/${examId}/doubts/new?question=${q.id}&student=${studentId}`,
      openDoubts: doubts.filter((d) => d.questionId === q.id).length,
    };
  });

  const editable = canEditGrades(role, exam.status);
  const notMine = allocation && allocation.taId !== user.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/exams/${examId}/grade${suffix}`} className="text-sm text-slate-500 hover:underline">
            ← Back to answer sheets
          </Link>
          <h2 className="text-xl font-semibold">{studentLabel(exam, student)}</h2>
          {index >= 0 && (
            <p className="text-sm text-slate-500">
              Answer sheet {index + 1} of {ordered.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {prev && (
            <Link href={`/exams/${examId}/grade/${prev.id}${suffix}`} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
              ← {prev.label}
            </Link>
          )}
          {next && (
            <Link href={`/exams/${examId}/grade/${next.id}${suffix}`} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100">
              {next.label} →
            </Link>
          )}
        </div>
      </div>

      {notMine && <Notice tone="amber">This answer sheet is allocated to {allocation.ta.name}. Your changes will still be recorded under the original grader for consistency stats.</Notice>}
      {!editable && (
        <Notice tone="amber">
          {exam.status === "DRAFT" ? "Grading hasn't started yet." : "Grades are locked. You're viewing them read-only."}
        </Notice>
      )}
      {exam.status === "PUBLISHED" && editable && (
        <Notice>
          Results are published. Any change you make here is logged with your reason and shown to the student.{" "}
          <Badge tone="amber">Moderator</Badge>
        </Notice>
      )}

      <SheetUploader
        examId={examId}
        studentId={studentId}
        editable={editable}
        sheet={
          answerSheet
            ? {
                id: answerSheet.id,
                sizeBytes: answerSheet.sizeBytes,
                uploadedBy: answerSheet.uploadedBy.name,
                updatedAt: answerSheet.updatedAt.toISOString(),
              }
            : null
        }
      />

      <GradingSheet
        key={studentId}
        action={saveScript.bind(null, examId, studentId)}
        questions={sheet}
        editable={editable}
        needsReason={exam.status === "PUBLISHED"}
        nextHref={next ? `/exams/${examId}/grade/${next.id}${suffix}` : null}
      />
    </div>
  );
}
