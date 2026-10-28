import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { createRuling, deleteRuling } from "@/app/actions/doubts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardBody, CardHeader, EmptyState, Field } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export default async function RulingsPage({ params }: PageProps<"/exams/[examId]/rulings">) {
  const { examId } = await params;
  const { role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const moderator = isModerator(role);

  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { order: "asc" },
    include: {
      rulings: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  const total = questions.reduce((s, q) => s + q.rulings.length, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <p className="text-sm text-slate-600">
          Rulings are the team&rsquo;s shared decisions on edge cases. Each one shows up next to its question on every TA&rsquo;s
          grading screen, and the AI follows them, so the same answer gets the same marks whoever grades it.
        </p>
        {total === 0 ? (
          <EmptyState title="No rulings yet">They&rsquo;re created when a moderator resolves a doubt, or added here directly.</EmptyState>
        ) : (
          questions
            .filter((q) => q.rulings.length > 0)
            .map((q) => (
              <Card key={q.id}>
                <CardHeader title={q.label} description={q.prompt || undefined} />
                <ul className="divide-y divide-slate-100">
                  {q.rulings.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-3">
                      <div>
                        <p className="text-sm text-slate-800">{r.text}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.createdBy.name} · {timeAgo(r.createdAt)}
                          {r.doubtId && (
                            <>
                              {" · "}
                              <Link href={`/exams/${examId}/doubts/${r.doubtId}`} className="text-indigo-700 hover:underline">
                                from a doubt
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                      {moderator && (
                        <form action={deleteRuling.bind(null, examId, r.id)}>
                          <SubmitButton size="sm" variant="ghost" confirm="Delete this ruling?">
                            Delete
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))
        )}
      </div>

      {moderator && questions.length > 0 && (
        <Card className="h-fit">
          <CardHeader title="Add a ruling" description="For edge cases you can anticipate before TAs hit them." />
          <CardBody>
            <ActionForm action={createRuling.bind(null, examId)} className="space-y-3">
              <Field label="Question">
                <select name="questionId" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ruling">
                <textarea name="text" rows={4} placeholder="e.g. Accept answers in Celsius or Kelvin; deduct 1 only if no unit is given." required />
              </Field>
              <SubmitButton className="w-full">Publish ruling</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
