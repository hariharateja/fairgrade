import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import type { DoubtAdvice } from "@/lib/ai";
import { PROVIDER_LABEL } from "@/lib/ai-providers";
import { addDoubtComment, escalateDoubt, rerunAdvisor, resolveDoubt } from "@/app/actions/doubts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CONFIDENCE_TONE, DoubtStatusBadge } from "@/components/doubt-status";
import {
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleDashed,
  CircleX,
  Gavel,
  ImageIcon,
  ListChecks,
  MessageCircleQuestion,
  MessagesSquare,
  RefreshCw,
  ScanText,
  Send,
  Sparkles,
} from "lucide-react";
import { Avatar, Badge, Card, CardBody, CardHeader, Field, Notice, ScoreRing, cx } from "@/components/ui";
import { fmt, parseJson, studentLabel, timeAgo } from "@/lib/utils";

// Server actions on this page call the AI model, which can take up to a minute or two.
export const maxDuration = 120;

type Analysis = Partial<Pick<DoubtAdvice, "criteria" | "rationale" | "proposedRuling" | "needsHumanReview">> & { error?: string };

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

  const providerLabel = doubt.aiMode === "demo" ? "Simulated" : PROVIDER_LABEL[doubt.aiMode];
  const metCount = (analysis.criteria ?? []).filter((c) => c.status === "met").length;

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 font-display text-lg font-semibold text-white shadow-sm shadow-indigo-600/30">
            {q.label}
          </span>
          <div className="min-w-0">
            <Link href={`/exams/${examId}/doubts`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-700">
              <ChevronLeft className="size-3.5" /> All doubts
            </Link>
            <h2 className="truncate font-display text-2xl font-semibold tracking-tight text-slate-900">
              {doubt.student ? studentLabel(exam, doubt.student, moderator) : "General question"}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <DoubtStatusBadge status={doubt.status} />
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={doubt.raisedBy.name} size="sm" /> Raised by {doubt.raisedBy.name} · {timeAgo(doubt.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-indigo-500" /> Student&rsquo;s answer
                </span>
              }
            />
            <CardBody className="space-y-4">
              {doubt.note && (
                <div className="flex gap-3 rounded-xl bg-amber-50/70 px-3.5 py-3 text-sm ring-1 ring-amber-100">
                  <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div>
                    <div className="text-xs font-semibold tracking-wide text-amber-800 uppercase">The TA asks</div>
                    <p className="text-amber-950">{doubt.note}</p>
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {images.map((name) => (
                  <a
                    key={name}
                    href={`/api/files/${name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${name}`} alt="Answer photo" className="w-full transition group-hover:scale-[1.02]" />
                    <span className="absolute right-2 bottom-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                      Open full size
                    </span>
                  </a>
                ))}
              </div>
              {doubt.aiTranscription && (
                <details open={doubt.aiMode !== "demo"} className="group/t">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-700">
                    <ScanText className="size-4 text-slate-400" /> AI transcription
                    <ChevronDown className="size-4 text-slate-400 transition group-open/t:rotate-180" />
                  </summary>
                  <pre className="mt-2 rounded-xl border border-slate-200 bg-[repeating-linear-gradient(transparent,transparent_27px,rgb(226_232_240)_28px)] bg-white p-4 font-mono text-[13px] leading-7 whitespace-pre-wrap text-slate-800">
                    {doubt.aiTranscription}
                  </pre>
                </details>
              )}
            </CardBody>
          </Card>

          {analysis.criteria && analysis.criteria.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <ListChecks className="size-4 text-indigo-500" /> Rubric check
                  </span>
                }
                description={`${metCount} of ${q.rubricItems.length} criteria met, with evidence from the answer.`}
              />
              <ul className="divide-y divide-slate-100">
                {q.rubricItems.map((item) => {
                  const c = analysis.criteria!.find((x) => x.rubricItemId === item.id);
                  const status = c?.status;
                  const Icon = status === "met" ? CircleCheck : status === "partial" ? CircleDashed : CircleX;
                  return (
                    <li key={item.id} className="flex gap-3 px-5 py-3.5 sm:px-6">
                      <Icon
                        className={cx(
                          "mt-0.5 size-5 shrink-0",
                          status === "met" ? "text-emerald-500" : status === "partial" ? "text-amber-500" : "text-slate-300",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium text-slate-800">{item.description}</span>
                          <span
                            className={cx(
                              "shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
                              status === "met" ? "bg-emerald-50 text-emerald-700" : status === "partial" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {c ? fmt(c.marksAwarded) : "–"} / {fmt(item.marks)}
                          </span>
                        </div>
                        {c?.evidence && <p className="mt-1 text-sm leading-relaxed text-slate-600">{c.evidence}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <MessagesSquare className="size-4 text-indigo-500" /> Team discussion
                </span>
              }
              description="Visible to every TA and the instructor."
            />
            <CardBody className="space-y-4">
              {doubt.comments.length === 0 && <p className="text-sm text-slate-500">No comments yet. Start the conversation.</p>}
              {doubt.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar name={c.author.name} />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">{c.author.name}</span> · {timeAgo(c.createdAt)}
                    </div>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap text-slate-800">{c.body}</p>
                  </div>
                </div>
              ))}
              <ActionForm action={addDoubtComment.bind(null, examId, doubtId)} className="flex gap-2 pt-1">
                <input name="body" placeholder="Add a comment…" autoComplete="off" />
                <SubmitButton variant="secondary">
                  <Send className="size-4" /> Post
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400" aria-hidden />
            <div className="flex items-center justify-between gap-2 px-5 pt-5 sm:px-6">
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <Sparkles className="size-4 text-indigo-500" /> AI suggestion
              </span>
              {providerLabel && <Badge tone={doubt.aiMode === "demo" ? "amber" : "indigo"}>{doubt.aiMode === "demo" ? providerLabel : `by ${providerLabel}`}</Badge>}
            </div>
            <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
              {analysis.error ? (
                <Notice tone="red">{analysis.error}</Notice>
              ) : doubt.aiMarks !== null ? (
                <>
                  <div className="flex items-center gap-4">
                    <ScoreRing value={doubt.aiMarks} max={q.maxMarks} size={84} />
                    <div className="space-y-1.5">
                      {doubt.aiConfidence && <Badge tone={CONFIDENCE_TONE[doubt.aiConfidence]}>{doubt.aiConfidence} confidence</Badge>}
                      {currentGrade && (
                        <div className="text-xs text-slate-500">
                          Currently graded <span className="font-mono font-semibold text-slate-700">{fmt(currentGrade.marks)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {analysis.rationale && <p className="text-sm leading-relaxed text-slate-700">{analysis.rationale}</p>}
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
                    <RefreshCw className="size-3.5" /> Ask the AI again{q.rulings.length ? " (with latest rulings)" : ""}
                  </SubmitButton>
                </form>
              )}
            </div>
          </Card>

          {doubt.status === "RESOLVED" ? (
            <Card className="border-emerald-200">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CircleCheck className="size-4 text-emerald-500" /> Decision
                  </span>
                }
              />
              <CardBody className="space-y-3 text-sm">
                <div className="flex items-center gap-4">
                  <ScoreRing value={doubt.finalMarks} max={q.maxMarks} size={64} tone="green" />
                  <p className="text-slate-600">
                    Decided by <span className="font-medium text-slate-800">{doubt.resolvedBy?.name}</span>
                    {doubt.resolvedAt && ` ${timeAgo(doubt.resolvedAt)}`}
                    {doubt.studentId && " and applied to the student's answer sheet"}.
                  </p>
                </div>
                {doubt.resolutionNote && <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-slate-800">{doubt.resolutionNote}</p>}
                {doubt.rulings.map((r) => (
                  <div key={r.id} className="flex gap-2.5 rounded-xl bg-indigo-50/70 px-3.5 py-3 text-indigo-950 ring-1 ring-indigo-100">
                    <Gavel className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                    <span>
                      <strong>Published ruling:</strong> {r.text}
                    </span>
                  </div>
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
                <ActionForm action={resolveDoubt.bind(null, examId, doubtId)} className="space-y-4">
                  <Field label={`Final marks (out of ${fmt(q.maxMarks)})`}>
                    <input
                      name="marks"
                      type="number"
                      step="0.25"
                      min={0}
                      max={q.maxMarks}
                      defaultValue={doubt.aiMarks ?? ""}
                      required
                      className="!font-mono !text-lg"
                    />
                  </Field>
                  <Field label="Note" hint="Why this mark? Shown to the team.">
                    <textarea name="note" rows={2} />
                  </Field>
                  {moderator && (
                    <div className="space-y-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="publishRuling" defaultChecked={!!analysis.proposedRuling} />
                        <Gavel className="size-4 text-indigo-500" /> Publish as a ruling for all TAs
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
                  <SubmitButton className="w-full !py-2.5" variant="success" pendingText="Saving…">
                    <CircleCheck className="size-4" /> {doubt.studentId ? "Apply marks & resolve" : "Resolve"}
                  </SubmitButton>
                </ActionForm>
                {doubt.status === "AI_SUGGESTED" && (
                  <form action={escalateDoubt.bind(null, examId, doubtId)} className="mt-2">
                    <SubmitButton className="w-full" variant="secondary">
                      <Send className="size-4" /> Not sure? Send to instructor
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
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Gavel className="size-4 text-indigo-500" /> Existing rulings for {q.label}
                  </span>
                }
              />
              <CardBody>
                <ul className="space-y-2">
                  {q.rulings.map((r) => (
                    <li key={r.id} className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-100">
                      {r.text}
                    </li>
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
