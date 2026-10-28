import { db } from "@/lib/db";
import { createCrib } from "@/app/actions/cribs";
import { ActionForm, PhotoInput, SubmitButton } from "@/components/forms";
import { CalendarClock, CircleCheck, ClipboardCheck, Lock } from "lucide-react";
import { STUDENT_EXAM_STATUS } from "@/components/exam-status";
import { Badge, Card, Field, Notice, buttonClass, cx } from "@/components/ui";
import { fmt, isPast, parseJson } from "@/lib/utils";

const CRIB_STATUS = {
  OPEN: { label: "Crib under review", tone: "amber" },
  ACCEPTED: { label: "Crib accepted", tone: "green" },
  REJECTED: { label: "Crib not accepted", tone: "slate" },
} as const;

export async function StudentResults({
  exam,
  userId,
}: {
  exam: { id: string; status: string; totalMarks: number; cribDeadline: Date | null };
  userId: string;
}) {
  if (exam.status !== "PUBLISHED" && exam.status !== "CLOSED") {
    return <ResultsPending exam={exam} />;
  }

  const [questions, grades, cribs, sheet] = await Promise.all([
    db.question.findMany({
      where: { examId: exam.id },
      orderBy: { order: "asc" },
      include: { rubricItems: { orderBy: { order: "asc" } } },
    }),
    db.grade.findMany({
      where: { examId: exam.id, studentId: userId },
      include: { history: { orderBy: { createdAt: "asc" } } },
    }),
    db.crib.findMany({ where: { examId: exam.id, studentId: userId } }),
    db.answerSheet.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: userId } } }),
  ]);

  const total = grades.reduce((s, g) => s + g.marks, 0);
  const deadlinePassed = exam.cribDeadline !== null && isPast(exam.cribDeadline);
  const cribsOpen = exam.status === "PUBLISHED" && !deadlinePassed;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="text-sm text-slate-500">Your total</div>
          <div className="font-mono text-3xl font-semibold tabular-nums">
            {fmt(total)} <span className="text-lg font-normal text-slate-400">/ {fmt(exam.totalMarks)}</span>
          </div>
        </div>
        <div className="text-right text-sm text-slate-600">
          {cribsOpen ? (
            exam.cribDeadline ? (
              <>Cribs open until {exam.cribDeadline.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</>
            ) : (
              <>Cribs are open</>
            )
          ) : (
            <>Cribs are closed</>
          )}
        </div>
      </Card>

      {sheet ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div>
            <div className="font-medium text-slate-900">Your scanned answer sheet</div>
            <p className="text-sm text-slate-600">Check your marks against your own answers. It&rsquo;s also attached to any crib you raise.</p>
          </div>
          <a href={`/api/sheets/${sheet.id}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            Open PDF
          </a>
        </Card>
      ) : null}

      <Notice>
        Every mark comes from the instructor&rsquo;s rubric. If you think a criterion applies to your answer but wasn&rsquo;t
        given, raise a crib on that question and say which criterion. A different TA reviews it.
      </Notice>

      {questions.map((q) => {
        const grade = grades.find((g) => g.questionId === q.id);
        const applied = parseJson<string[]>(grade?.appliedItemIds, []);
        const crib = cribs.find((c) => c.questionId === q.id);
        return (
          <Card key={q.id}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="font-semibold">{q.label}</h3>
                {q.prompt && <p className="text-sm text-slate-500">{q.prompt}</p>}
              </div>
              <div className="flex items-center gap-2">
                {crib && <Badge tone={CRIB_STATUS[crib.status as keyof typeof CRIB_STATUS].tone}>{CRIB_STATUS[crib.status as keyof typeof CRIB_STATUS].label}</Badge>}
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {grade ? fmt(grade.marks) : "–"}
                  <span className="text-sm font-normal text-slate-400"> / {fmt(q.maxMarks)}</span>
                </span>
              </div>
            </div>
            <div className="space-y-3 px-5 py-4">
              {!grade ? (
                <p className="text-sm text-slate-500">Not graded yet.</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {q.rubricItems.map((item) => {
                      const hit = applied.includes(item.id);
                      return (
                        <li key={item.id} className={cx("flex items-start gap-2 text-sm", !hit && "text-slate-400")}>
                          <span className={cx("w-4 text-center", hit ? (item.marks < 0 ? "text-red-600" : "text-emerald-600") : "")}>
                            {hit ? "✓" : "·"}
                          </span>
                          <span className="flex-1">{item.description}</span>
                          <span className="font-mono tabular-nums">
                            {item.marks > 0 ? "+" : ""}
                            {fmt(item.marks)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {grade.manualOverride && (
                    <p className="text-xs text-slate-500">The grader set this total directly rather than from the rubric.</p>
                  )}
                  {grade.comment && (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="font-medium">Grader&rsquo;s comment:</span> {grade.comment}
                    </p>
                  )}
                  {grade.history.some((h) => h.reason !== "Edited during grading") && (
                    <ul className="space-y-0.5 text-xs text-slate-500">
                      {grade.history
                        .filter((h) => h.reason !== "Edited during grading")
                        .map((h) => (
                          <li key={h.id}>
                            Changed {fmt(h.oldMarks)} → {fmt(h.newMarks)}: {h.reason}
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}

              {crib && crib.status !== "OPEN" && crib.response && (
                <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div className="font-medium">Reviewer&rsquo;s response</div>
                  <p className="text-slate-700">{crib.response}</p>
                </div>
              )}

              {grade && !crib && cribsOpen && grade.marks < q.maxMarks && (
                <details className="rounded-md border border-slate-200">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-indigo-700">Raise a crib on {q.label}</summary>
                  <ActionForm action={createCrib.bind(null, exam.id, q.id)} className="space-y-3 border-t border-slate-100 p-3">
                    <Field label="Which rubric criterion do you think applies?">
                      <select name="rubricItemId" defaultValue="">
                        <option value="">Not about a specific criterion</option>
                        {q.rubricItems
                          .filter((i) => i.marks > 0 && !applied.includes(i.id))
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.description} (+{fmt(i.marks)})
                            </option>
                          ))}
                        {q.rubricItems
                          .filter((i) => i.marks < 0 && applied.includes(i.id))
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              Wrongly deducted: {i.description} ({fmt(i.marks)})
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Explain where your answer meets it" hint="At least 30 characters. Point to the line or step in your answer.">
                      <textarea name="reason" rows={3} minLength={30} required />
                    </Field>
                    <Field
                      label={sheet ? "Extra photos (optional)" : "Photo of your answer"}
                      hint={
                        sheet
                          ? "Your scanned answer sheet is attached automatically. Add photos only to highlight something specific."
                          : "Strongly recommended; reviewers decide faster with it."
                      }
                    >
                      <PhotoInput />
                    </Field>
                    <SubmitButton pendingText="Submitting…">Submit crib</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** What a student sees before results are published: where the exam is, but no marks. */
async function ResultsPending({ exam }: { exam: { id: string; status: string; totalMarks: number } }) {
  const questionCount = await db.question.count({ where: { examId: exam.id } });
  const steps = [
    { key: "DRAFT", label: "Upcoming", icon: CalendarClock },
    { key: "GRADING", label: "Being graded", icon: ClipboardCheck },
    { key: "PUBLISHED", label: "Results out", icon: CircleCheck },
  ];
  const current = steps.findIndex((s) => s.key === exam.status);
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Lock className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Results aren&rsquo;t published yet</h2>
            <p className="mt-1 max-w-xl text-slate-600">{STUDENT_EXAM_STATUS[exam.status]?.help}</p>
          </div>
        </div>

        <ol className="mt-8 grid grid-cols-3 gap-2">
          {steps.map((step, i) => {
            const done = i < current;
            const active = i === current;
            const Icon = step.icon;
            return (
              <li key={step.key} className="space-y-2">
                <div className={cx("h-1.5 rounded-full", i <= current ? "bg-indigo-600" : "bg-slate-200")} />
                <div className={cx("flex items-center gap-1.5 text-sm", active ? "font-semibold text-indigo-700" : done ? "text-slate-600" : "text-slate-400")}>
                  <Icon className="size-4 shrink-0" /> {step.label}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Questions", questionCount || "–"],
            ["Total marks", fmt(exam.totalMarks)],
            ["Your marks", "Hidden until published"],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="mt-0.5 font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Once results are out you&rsquo;ll see your marks question by question, the rubric behind them, your scanned answer sheet, and
          you can raise a crib if something looks wrong.
        </p>
      </div>
    </Card>
  );
}
