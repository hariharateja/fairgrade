import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam } from "@/lib/access";
import { aiMode } from "@/lib/ai";
import { createDoubt } from "@/app/actions/doubts";
import { ActionForm, PhotoInput, SubmitButton } from "@/components/forms";
import { Card, CardBody, CardHeader, Field, Notice } from "@/components/ui";
import { fmt, studentLabel } from "@/lib/utils";

// Server actions on this page call the AI model, which can take up to a minute or two.
export const maxDuration = 120;

export default async function NewDoubt({ params, searchParams }: PageProps<"/exams/[examId]/doubts/new">) {
  const { examId } = await params;
  const sp = await searchParams;
  const { user, exam } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);

  const [questions, allocations] = await Promise.all([
    db.question.findMany({ where: { examId }, orderBy: { order: "asc" } }),
    db.allocation.findMany({
      where: { examId, taId: user.id },
      include: { student: { select: { id: true, name: true, rollNo: true } } },
    }),
  ]);
  const presetStudent = typeof sp.student === "string" ? sp.student : "";
  const presetQuestion = typeof sp.question === "string" ? sp.question : "";

  // Include the preset student even if the script isn't allocated to this TA.
  let students = allocations.map((a) => a.student);
  if (presetStudent && !students.some((s) => s.id === presetStudent)) {
    const s = await db.user.findUnique({ where: { id: presetStudent }, select: { id: true, name: true, rollNo: true } });
    if (s) students = [s, ...students];
  }
  students = students.sort((a, b) => studentLabel(exam, a).localeCompare(studentLabel(exam, b)));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/exams/${examId}/doubts`} className="text-sm text-slate-500 hover:underline">
        ← All doubts
      </Link>
      <Card>
        <CardHeader
          title="Raise a grading doubt"
          description="Photograph the answer you're unsure about. The AI reads it, checks every rubric criterion and the staff rulings, and suggests marks with reasons. You or the instructor make the final call."
        />
        <CardBody>
          {aiMode() === "demo" && (
            <div className="mb-4">
              <Notice tone="amber">
                AI demo mode: no API key is configured, so the suggestion will be simulated rather than read from your photo.
              </Notice>
            </div>
          )}
          <ActionForm action={createDoubt.bind(null, examId)} className="space-y-4">
            <Field label="Question">
              <select name="questionId" defaultValue={presetQuestion} required>
                <option value="" disabled>
                  Choose a question…
                </option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label} ({fmt(q.maxMarks)} marks){q.prompt ? `: ${q.prompt.slice(0, 60)}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Student's script" hint="Link the script so the decision can be applied to the student's marks directly.">
              <select name="studentId" defaultValue={presetStudent}>
                <option value="">Not linked to a script (general question)</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {studentLabel(exam, s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Photos of the answer">
              <PhotoInput required />
            </Field>
            <Field label="What are you unsure about?" hint="e.g. 'Used an iterative method instead of recursion. Does criterion 2 apply?'">
              <textarea name="note" rows={3} />
            </Field>
            <SubmitButton className="w-full" pendingText="AI is reading the answer… (up to a minute)">
              Get AI suggestion
            </SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
