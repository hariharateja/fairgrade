import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import type { DoubtAdvice } from "@/lib/ai";
import { PROVIDER_LABEL } from "@/lib/ai-providers";
import { addDoubtComment, escalateDoubt, rerunAdvisor, resolveDoubt } from "@/app/actions/doubts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CONFIDENCE_TONE, DoubtStatusBadge } from "@/components/doubt-status";
import { Badge, Card, CardBody, CardHeader, Field, Notice, cx } from "@/components/ui";
import { fmt, parseJson, studentLabel, timeAgo } from "@/lib/utils";

// Server actions on this page call the AI model, which can take up to a minute or two.
export const maxDuration = 120;

type Analysis = Partial<Pick<DoubtAdvice, "criteria" | "rationale" | "proposedRuling" | "needsHumanReview">> & { error?: string };

const CRITERION_STYLE = {
  met: { label: "Met", tone: "green" },
  partial: { label: "Partial", tone: "amber" },
  not_met: { label: "Not met", tone: "slate" },
} as const;

export default async function DoubtPage({ params }: PageProps<"/exams/[examId]/doubts/[doubtId]">) {
  const { examId, doubtId } = await params;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const moderator = isModerator(role);

  const doubt = await db.doubt.findFirst({
    where: { id: doubtId, examId },
    include: {
      question: { include: { rubricItems: { orderBy: { order: "asc" } }, rulings: { orderBy: { createdAt: "asc" } } } },
      raisedBy: { select: { name: true } },
      resolvedBy: { select: { name: true } },
      student: { select: { id: true, name: true, rollNo: true } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      rulings: true,
    },
  });
  if (!doubt) notFound();

  const q = doubt.question;
  const images = parseJson<string[]>(doubt.imagePaths, []);
  const analysis = parseJson<Analysis>(doubt.aiAnalysis, {});
  const canResolve =
    doubt.status !== "RESOLVED" && (moderator || (doubt.status === "AI_SUGGESTED" && doubt.raisedById === user.id));
  const currentGrade = doubt.studentId
    ? await db.grade.findUnique({ where: { questionId_studentId: { questionId: q.id, studentId: doubt.studentId } } })
    : null;

  return (
    <div className="space-y-4">
      <Link href={`/exams/${examId}/doubts`} className="text-sm text-slate-500 hover:underline">
        ← All doubts
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">
          {q.label} doubt
          {doubt.student && <span className="font-normal text-slate-500"> · {studentLabel(exam, doubt.student, moderator)}</span>}
        </h2>
        <DoubtStatusBadge status={doubt.status} />
        <span className="text-sm text-slate-500">
          Raised by {doubt.raisedBy.name} {timeAgo(doubt.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader title="Student's answer" description={doubt.note ? `TA's question: ${doubt.note}` : undefined} />
            <CardBody className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {images.map((name) => (
                  <a key={name} href={`/api/files/${name}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${name}`} alt="Answer photo" className="w-full rounded-md border border-slate-200" />
                  </a>
                ))}
              </div>
              {doubt.aiTranscription && (
                <details open={doubt.aiMode !== "demo"}>
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">AI transcription</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-sans text-sm text-slate-800">
                    {doubt.aiTranscription}
                  </pre>
                </details>
              )}
            </CardBody>
          </Card>

          {analysis.criteria && analysis.criteria.length > 0 && (
            <Card>
              <CardHeader title="Rubric check" description="How the AI judged each criterion, with evidence from the answer." />
              <ul className="divide-y divide-slate-100">
                {q.rubricItems.map((item) => {
                  const c = analysis.criteria!.find((x) => x.rubricItemId === item.id);
                  const style = c ? CRITERION_STYLE[c.status] : null;
                  return (
                    <li key={item.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium text-slate-800">{item.description}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {style && <Badge tone={style.tone}>{style.label}</Badge>}
                          <span className="font-mono text-sm tabular-nums">
                            {c ? fmt(c.marksAwarded) : "–"} / {fmt(item.marks)}
                          </span>
                        </div>
                      </div>
                      {c?.evidence && <p className="mt-1 text-sm text-slate-600">{c.evidence}</p>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Team discussion" description="Visible to every TA and the instructor." />
            <CardBody className="space-y-3">
              {doubt.comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
              {doubt.comments.map((c) => (
                <div key={c.id} className="rounded-md bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{c.author.name}</span> · {timeAgo(c.createdAt)}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{c.body}</p>
                </div>
              ))}
              <ActionForm action={addDoubtComment.bind(null, examId, doubtId)} className="flex gap-2">
                <input name="body" placeholder="Add a comment…" autoComplete="off" />
                <SubmitButton variant="secondary">Post</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="AI suggestion"
              action={
                doubt.aiMode === "demo" ? (
                  <Badge tone="amber">Simulated</Badge>
                ) : PROVIDER_LABEL[doubt.aiMode] ? (
                  <Badge>by {PROVIDER_LABEL[doubt.aiMode]}</Badge>
                ) : undefined
              }
            />
            <CardBody className="space-y-3">
              {analysis.error ? (
                <Notice tone="red">{analysis.error}</Notice>
              ) : doubt.aiMarks !== null ? (
                <>
                  <div className="flex items-end justify-between">
                    <div className="font-mono text-3xl font-semibold tabular-nums">
                      {fmt(doubt.aiMarks)}
                      <span className="text-base font-normal text-slate-400"> / {fmt(q.maxMarks)}</span>
                    </div>
                    {doubt.aiConfidence && (
                      <Badge tone={CONFIDENCE_TONE[doubt.aiConfidence]}>{doubt.aiConfidence} confidence</Badge>
                    )}
                  </div>
                  {analysis.rationale && <p className="text-sm text-slate-700">{analysis.rationale}</p>}
                  {analysis.needsHumanReview && (
                    <Notice tone="amber">The rubric doesn&rsquo;t clearly cover this answer, so it was sent to the instructor.</Notice>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">No suggestion yet.</p>
              )}
              {doubt.status !== "RESOLVED" && (
                <form action={rerunAdvisor.bind(null, examId, doubtId)}>
                  <SubmitButton size="sm" variant="ghost" pendingText="Re-checking…">
                    ↻ Ask the AI again{q.rulings.length ? " (with latest rulings)" : ""}
                  </SubmitButton>
                </form>
              )}
            </CardBody>
          </Card>

          {doubt.status === "RESOLVED" ? (
            <Card>
              <CardHeader title="Decision" />
              <CardBody className="space-y-2 text-sm">
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {fmt(doubt.finalMarks)} <span className="text-base font-normal text-slate-400">/ {fmt(q.maxMarks)}</span>
                </div>
                <p className="text-slate-600">
                  Decided by {doubt.resolvedBy?.name}
                  {doubt.resolvedAt && ` ${timeAgo(doubt.resolvedAt)}`}
                  {doubt.studentId && " and applied to the student's answer sheet"}.
                </p>
                {doubt.resolutionNote && <p className="text-slate-800">{doubt.resolutionNote}</p>}
                {doubt.rulings.map((r) => (
                  <Notice key={r.id}>
                    <strong>Published ruling:</strong> {r.text}
                  </Notice>
                ))}
              </CardBody>
            </Card>
          ) : canResolve ? (
            <Card>
              <CardHeader
                title={moderator ? "Decide" : "Apply the decision"}
                description={
                  doubt.studentId
                    ? `Writes the marks to this student's ${q.label}${currentGrade ? ` (currently ${fmt(currentGrade.marks)})` : ""}.`
                    : "Not linked to an answer sheet, so this only records the decision."
                }
              />
              <CardBody>
                <ActionForm action={resolveDoubt.bind(null, examId, doubtId)} className="space-y-3">
                  <Field label={`Final marks (out of ${fmt(q.maxMarks)})`}>
                    <input name="marks" type="number" step="0.25" min={0} max={q.maxMarks} defaultValue={doubt.aiMarks ?? ""} required />
                  </Field>
                  <Field label="Note" hint="Why this mark? Shown to the team.">
                    <textarea name="note" rows={2} />
                  </Field>
                  {moderator && (
                    <div className="space-y-2 rounded-md border border-indigo-100 bg-indigo-50/50 p-3">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="publishRuling" defaultChecked={!!analysis.proposedRuling} />
                        Publish as a ruling for all TAs
                      </label>
                      <textarea
                        name="ruling"
                        rows={3}
                        defaultValue={analysis.proposedRuling ?? ""}
                        placeholder="e.g. Iterative solutions get full marks for criterion 2 if the loop invariant is stated."
                      />
                      <p className="text-xs text-slate-500">
                        Rulings appear next to {q.label} on every TA&rsquo;s grading screen and the AI follows them in future doubts.
                      </p>
                    </div>
                  )}
                  <SubmitButton className="w-full" variant="success" pendingText="Saving…">
                    {doubt.studentId ? "Apply marks & resolve" : "Resolve"}
                  </SubmitButton>
                </ActionForm>
                {doubt.status === "AI_SUGGESTED" && (
                  <form action={escalateDoubt.bind(null, examId, doubtId)} className="mt-2">
                    <SubmitButton className="w-full" variant="secondary">
                      Not sure? Send to instructor
                    </SubmitButton>
                  </form>
                )}
              </CardBody>
            </Card>
          ) : (
            <Notice tone="amber">
              {doubt.status === "ESCALATED"
                ? "Waiting for the instructor or a Head TA to decide."
                : `Waiting for ${doubt.raisedBy.name} to apply the decision.`}
            </Notice>
          )}

          {q.rulings.length > 0 && (
            <Card>
              <CardHeader title={`Existing rulings for ${q.label}`} />
              <CardBody>
                <ul className={cx("list-disc space-y-1 pl-5 text-sm text-slate-700")}>
                  {q.rulings.map((r) => (
                    <li key={r.id}>{r.text}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
