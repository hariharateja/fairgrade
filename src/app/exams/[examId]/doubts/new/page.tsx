import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam } from "@/lib/access";
import { aiMode } from "@/lib/ai";
import { createDoubt } from "@/app/actions/doubts";
import { ActionForm, PhotoInput, SubmitButton } from "@/components/forms";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Card, CardBody, Field, Notice } from "@/components/ui";
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

  // Include the preset student even if the answer sheet isn't allocated to this TA.
  let students = allocations.map((a) => a.student);
  if (presetStudent && !students.some((s) => s.id === presetStudent)) {
    const s = await db.user.findUnique({ where: { id: presetStudent }, select: { id: true, name: true, rollNo: true } });
    if (s) students = [s, ...students];
  }
  students = students.sort((a, b) => studentLabel(exam, a).localeCompare(studentLabel(exam, b)));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/exams/${examId}/doubts`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-700">
        <ChevronLeft className="size-4" /> All doubts
      </Link>
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-6 text-white">
          <div className="bg-dots-light absolute inset-0" aria-hidden />
          <div className="relative flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Sparkles className="size-5 text-amber-300" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Raise a grading doubt</h2>
              <p className="mt-1 text-sm text-indigo-100">
                Not sure how many marks an answer deserves? Let the AI check it against the rubric and the team&rsquo;s rulings.
              </p>
            </div>
          </div>
          <ol className="relative mt-5 grid gap-2 text-xs sm:grid-cols-3">
            {["Photograph the answer", "AI checks every criterion", "You or the instructor decide"].map((step, i) => (
              <li key={step} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <span className="grid size-5 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-950">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <CardBody className="!py-6">
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
            <Field label="Student's answer sheet" hint="Link the answer sheet so the decision can be applied to the student's marks directly.">
              <select name="studentId" defaultValue={presetStudent}>
                <option value="">Not linked to an answer sheet (general question)</option>
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
            <SubmitButton className="w-full !py-2.5" pendingText="AI is reading the answer… (up to a minute)">
              <Sparkles className="size-4" /> Get AI suggestion
            </SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
