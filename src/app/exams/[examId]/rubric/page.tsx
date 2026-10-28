import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireExam, isStaff } from "@/lib/access";
import { aiMode } from "@/lib/ai";
import { addQuestion, deleteQuestion, importRubric, saveQuestion } from "@/app/actions/exams";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Notice } from "@/components/ui";
import { fmt } from "@/lib/utils";

// Server actions on this page call the AI model, which can take up to a minute or two.
export const maxDuration = 120;

const SAMPLE = `Q1 Define a binary search tree and state its key property. (4 marks)
- Correct definition of a binary tree with ordered nodes (2)
- States left subtree < node < right subtree for every node (2)

Q2 Find the time complexity of the given recursive function. (6 marks)
- Writes the correct recurrence T(n) = 2T(n/2) + n (2)
- Solves it correctly via master theorem or recursion tree (3)
- Final answer O(n log n) (1)
- Missing base case in the recurrence (-1)`;

export default async function RubricPage({ params }: PageProps<"/exams/[examId]/rubric">) {
  const { examId } = await params;
  const { exam, role } = await requireExam(examId);
  if (!isStaff(role)) notFound();
  const editable = role === "INSTRUCTOR";

  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { order: "asc" },
    include: { rubricItems: { orderBy: { order: "asc" } }, _count: { select: { grades: true } } },
  });
  const sum = questions.reduce((s, q) => s + q.maxMarks, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {questions.length > 0 && Math.abs(sum - exam.totalMarks) > 1e-6 && (
          <Notice tone="amber">
            Questions add up to {fmt(sum)} marks but the exam is out of {fmt(exam.totalMarks)}.
          </Notice>
        )}

        {questions.length === 0 && (
          <EmptyState title="No questions yet">
            {editable ? "Import your rubric with AI, or add questions by hand." : "The instructor hasn't added the rubric yet."}
          </EmptyState>
        )}

        {questions.map((q) =>
          editable ? (
            <Card key={q.id}>
              <ActionForm action={saveQuestion.bind(null, examId, q.id)}>
                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-[1fr_8rem] gap-3">
                    <Field label="Label">
                      <input name="label" defaultValue={q.label} required />
                    </Field>
                    <Field label="Max marks">
                      <input name="maxMarks" type="number" step="0.5" min="0.5" defaultValue={q.maxMarks} required />
                    </Field>
                  </div>
                  <Field label="Question text" hint="Optional, but it helps the AI judge answers.">
                    <textarea name="prompt" rows={2} defaultValue={q.prompt} />
                  </Field>
                  <Field label="Model answer" hint="Optional reference answer for graders and the AI.">
                    <textarea name="modelAnswer" rows={2} defaultValue={q.modelAnswer} />
                  </Field>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Rubric criteria</span>
                      <span className="text-xs text-slate-500">Negative marks = deduction</span>
                    </div>
                    <div className="space-y-2">
                      {q.rubricItems.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input name="itemDesc" defaultValue={item.description} />
                          <input name="itemMarks" type="number" step="0.25" defaultValue={item.marks} />
                          <label className="flex items-center gap-1 text-xs font-normal text-slate-500">
                            <input type="checkbox" name="deleteItem" value={item.id} /> Remove
                          </label>
                        </div>
                      ))}
                      {[0, 1].map((i) => (
                        <div key={`new-${i}`} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
                          <input type="hidden" name="itemId" value="" />
                          <input name="itemDesc" placeholder="New criterion…" />
                          <input name="itemMarks" type="number" step="0.25" placeholder="marks" />
                          <span className="w-[4.25rem]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                  <span className="text-xs text-slate-500">
                    {q._count.grades > 0
                      ? `${q._count.grades} answer sheets graded. Saving recalculates them with the new rubric.`
                      : "Not graded yet."}
                  </span>
                  <SubmitButton size="sm" pendingText="Saving…">
                    Save {q.label}
                  </SubmitButton>
                </div>
              </ActionForm>
              {q._count.grades === 0 && (
                <form action={deleteQuestion.bind(null, examId, q.id)} className="px-5 pb-3 text-right">
                  <SubmitButton size="sm" variant="ghost" confirm={`Delete ${q.label}?`}>
                    Delete question
                  </SubmitButton>
                </form>
              )}
            </Card>
          ) : (
            <Card key={q.id}>
              <CardHeader
                title={q.label}
                description={q.prompt || undefined}
                action={<Badge tone="indigo">{fmt(q.maxMarks)} marks</Badge>}
              />
              <CardBody className="space-y-3">
                <ul className="space-y-1.5">
                  {q.rubricItems.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 text-sm">
                      <span>{item.description}</span>
                      <span className={`font-mono tabular-nums ${item.marks < 0 ? "text-red-600" : "text-slate-700"}`}>
                        {item.marks > 0 ? "+" : ""}
                        {fmt(item.marks)}
                      </span>
                    </li>
                  ))}
                </ul>
                {q.modelAnswer && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-slate-600">Model answer</summary>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{q.modelAnswer}</p>
                  </details>
                )}
              </CardBody>
            </Card>
          ),
        )}

        {editable && (
          <form action={addQuestion.bind(null, examId)}>
            <SubmitButton variant="secondary" pendingText="Adding…">
              + Add question
            </SubmitButton>
          </form>
        )}
      </div>

      {editable && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Import rubric"
              description={
                aiMode() !== "demo"
                  ? "Upload a PDF or photo, or paste text. The AI splits it into questions and criteria, and flags anything TAs could read differently."
                  : "Paste the rubric as text. (Add an API key to let the AI read PDFs and photos and flag ambiguous criteria.)"
              }
            />
            <CardBody>
              <ActionForm action={importRubric.bind(null, examId)} className="space-y-3">
                <Field label="Rubric text">
                  <textarea name="text" rows={9} placeholder={SAMPLE} className="font-mono !text-xs" />
                </Field>
                {aiMode() !== "demo" && (
                  <Field label="…or a file" hint="PDF, JPEG, PNG or WebP, up to 4 MB.">
                    <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
                  </Field>
                )}
                {questions.every((q) => q._count.grades === 0) && questions.length > 0 && (
                  <label className="flex items-center gap-2 font-normal">
                    <input type="checkbox" name="replace" /> Replace existing questions
                  </label>
                )}
                <SubmitButton className="w-full" pendingText="Reading rubric…">
                  Import
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Notice>
            <strong>Tip:</strong> split vague criteria like &ldquo;explains well&rdquo; into checkable points. Every
            criterion a TA can tick the same way removes a source of grader bias.
          </Notice>
        </div>
      )}
    </div>
  );
}
