import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { decideCrib, reassignCrib } from "@/app/actions/cribs";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CribStatusBadge, VerdictBadge } from "@/components/crib-status";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  MessageSquareText,
  Minus,
  Sparkles,
  UserRoundCog,
} from "lucide-react";
import { Avatar, Badge, Button, Card, CardBody, CardHeader, Field, IconTile, Notice, ScoreRing, cx } from "@/components/ui";
import { fmt, parseJson, studentLabel, timeAgo } from "@/lib/utils";

export default async function CribPage({ params }: PageProps<"/exams/[examId]/cribs/[cribId]">) {
  const { examId, cribId } = await params;
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const moderator = isModerator(role);

  const crib = await db.crib.findFirst({
    where: { id: cribId, examId },
    include: {
      question: { include: { rubricItems: { orderBy: { order: "asc" } }, rulings: true } },
      student: { select: { id: true, name: true, rollNo: true } },
      reviewer: { select: { name: true } },
      grade: { include: { grader: { select: { name: true } }, history: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!crib) notFound();

  const q = crib.question;
  const sheet = await db.answerSheet.findUnique({
    where: { examId_studentId: { examId, studentId: crib.studentId } },
    select: { id: true },
  });
  const applied = parseJson<string[]>(crib.grade.appliedItemIds, []);
  const images = parseJson<string[]>(crib.imagePaths, []);
  const cited = q.rubricItems.find((i) => i.id === crib.rubricItemId);
  const canDecide = crib.status === "OPEN" && exam.status === "PUBLISHED" && (crib.reviewerId === user.id || moderator);
  // Pre-tick what the student is asking for, so accepting is one click when the AI agrees.
  const proposed = cited
    ? cited.marks > 0
      ? [...new Set([...applied, cited.id])]
      : applied.filter((id) => id !== cited.id)
    : applied;
  const staff = moderator
    ? await db.membership.findMany({
        where: { courseId: exam.courseId, role: { not: "STUDENT" } },
        include: { user: { select: { id: true, name: true } } },
      })
    : [];

  const verdictStyle =
    crib.aiVerdict === "likely_valid"
      ? "from-emerald-50 to-white ring-emerald-200"
      : crib.aiVerdict === "likely_invalid"
        ? "from-rose-50 to-white ring-rose-200"
        : "from-amber-50 to-white ring-amber-200";

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 font-display text-lg font-semibold text-amber-950 shadow-sm shadow-amber-500/30">
            {q.label}
          </span>
          <div className="min-w-0">
            <Link href={`/exams/${examId}/cribs`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-700">
              <ChevronLeft className="size-3.5" /> All cribs
            </Link>
            <h2 className="truncate font-display text-2xl font-semibold tracking-tight text-slate-900">
              {studentLabel(exam, crib.student, moderator)}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <CribStatusBadge status={crib.status} />
              <span>
                Raised {timeAgo(crib.createdAt)} · graded by {crib.grade.grader.name}
                {crib.reviewer && ` · reviewer ${crib.reviewer.name}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xl font-semibold tabular-nums">
          <span className={crib.marksAfter !== null && crib.marksAfter !== crib.marksBefore ? "text-slate-400 line-through decoration-2" : ""}>
            {fmt(crib.marksBefore)}
          </span>
          {crib.marksAfter !== null && crib.marksAfter !== crib.marksBefore && (
            <>
              <ArrowRight className="size-5 text-emerald-500" />
              <span className="text-emerald-700">{fmt(crib.marksAfter)}</span>
            </>
          )}
          <span className="text-base font-normal text-slate-400">/ {fmt(q.maxMarks)}</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <MessageSquareText className="size-4 text-indigo-500" /> Student&rsquo;s request
                </span>
              }
            />
            <CardBody className="space-y-4">
              {cited && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500">Cites</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-900 ring-1 ring-amber-200">
                    {cited.description}{" "}
                    <span className="font-mono">
                      ({cited.marks > 0 ? "+" : ""}
                      {fmt(cited.marks)})
                    </span>
                  </span>
                </div>
              )}
              <div className="flex gap-3">
                <Avatar name={exam.blindGrading && !moderator ? "?" : crib.student.name} />
                <p className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 ring-1 ring-slate-100">
                  {crib.reason}
                </p>
              </div>
              {sheet ? (
                <a
                  href={`/api/sheets/${sheet.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm transition hover:bg-indigo-50"
                >
                  <IconTile>
                    <FileText />
                  </IconTile>
                  <span className="flex-1">
                    <span className="block font-medium text-indigo-900">Scanned answer sheet</span>
                    <span className="text-xs text-indigo-700">Uploaded by the grader · the AI pre-screen read this</span>
                  </span>
                  <ExternalLink className="size-4 text-indigo-500" />
                </a>
              ) : (
                <Notice tone="amber">No scan was uploaded for this answer sheet. Check the paper copy if needed.</Notice>
              )}
              {images.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {images.map((name) => (
                    <a key={name} href={`/api/files/${name}`} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${name}`} alt="Student's answer" className="w-full" />
                    </a>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <div className={cx("rounded-2xl bg-gradient-to-br p-5 ring-1 sm:p-6", verdictStyle)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                <Sparkles className="size-4 text-indigo-500" /> AI pre-screen
              </span>
              <div className="flex items-center gap-2">
                {crib.aiMode === "demo" && <Badge tone="amber">Simulated</Badge>}
                <VerdictBadge verdict={crib.aiVerdict} />
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{crib.aiAnalysis ?? "Not available."}</p>
            {crib.aiSuggestedMarks !== null && (
              <p className="mt-3 text-sm text-slate-600">
                Suggested marks <span className="font-mono text-base font-semibold text-slate-900">{fmt(crib.aiSuggestedMarks)}</span> /{" "}
                {fmt(q.maxMarks)}
              </p>
            )}
          </div>

          {crib.grade.history.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Clock className="size-4 text-indigo-500" /> Mark history
                  </span>
                }
              />
              <ol className="relative space-y-4 px-5 py-4 sm:px-6">
                <div className="absolute top-6 bottom-6 left-[29px] w-px bg-slate-200 sm:left-[33px]" aria-hidden />
                {crib.grade.history.map((h) => (
                  <li key={h.id} className="relative flex items-start gap-3 text-sm">
                    <span className="relative mt-1 size-2.5 shrink-0 rounded-full bg-indigo-500 ring-4 ring-white" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold">
                          {fmt(h.oldMarks)} → {fmt(h.newMarks)}
                        </span>
                        <span className="text-slate-500">{h.reason}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {h.changedBy.name} · {timeAgo(h.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-2">
          {crib.status !== "OPEN" ? (
            <Card className={crib.status === "ACCEPTED" ? "border-emerald-200" : ""}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {crib.status === "ACCEPTED" ? <CircleCheck className="size-4 text-emerald-500" /> : <CircleX className="size-4 text-slate-400" />}
                    Decision
                  </span>
                }
              />
              <CardBody className="space-y-3 text-sm">
                <div className="flex items-center gap-4">
                  <ScoreRing value={crib.marksAfter} max={q.maxMarks} size={64} tone={crib.status === "ACCEPTED" ? "green" : "indigo"} />
                  <p className="text-slate-600">
                    {crib.status === "ACCEPTED" ? "Accepted" : "Not accepted"} by{" "}
                    <span className="font-medium text-slate-800">{crib.reviewer?.name}</span>
                  </p>
                </div>
                <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 whitespace-pre-wrap text-slate-800">{crib.response}</p>
              </CardBody>
            </Card>
          ) : canDecide ? (
            <Card>
              <CardHeader
                title="Decide"
                description={`Currently ${fmt(crib.grade.marks)} / ${fmt(q.maxMarks)}. The student's cited criterion is pre-ticked.`}
              />
              <CardBody>
                <ActionForm action={decideCrib.bind(null, examId, cribId)} className="space-y-4">
                  <div className="space-y-2">
                    {q.rubricItems.map((item) => {
                      const deduction = item.marks < 0;
                      return (
                        <label
                          key={item.id}
                          className={cx(
                            "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 font-normal transition select-none has-[:checked]:shadow-xs",
                            deduction
                              ? "border-slate-200 has-[:checked]:border-rose-200 has-[:checked]:bg-rose-50/70"
                              : "border-slate-200 has-[:checked]:border-emerald-200 has-[:checked]:bg-emerald-50/70",
                            item.id === crib.rubricItemId && "ring-2 ring-amber-300",
                          )}
                        >
                          <input type="checkbox" name="applied" value={item.id} defaultChecked={proposed.includes(item.id)} className="peer sr-only" />
                          <span
                            className={cx(
                              "grid size-5 shrink-0 place-items-center rounded-md border-2 border-slate-300 bg-white text-transparent transition peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400",
                              deduction
                                ? "peer-checked:border-rose-500 peer-checked:bg-rose-500 peer-checked:text-white"
                                : "peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white",
                            )}
                          >
                            {deduction ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                          <span className="flex-1 text-sm text-slate-800">{item.description}</span>
                          <span className={cx("rounded-full px-2 py-0.5 font-mono text-xs font-semibold", deduction ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600")}>
                            {item.marks > 0 ? "+" : ""}
                            {fmt(item.marks)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <Field label="Override total (optional)">
                    <input name="override" type="number" step="0.25" min={0} max={q.maxMarks} placeholder="Use rubric total" />
                  </Field>
                  <Field label="Response to the student">
                    <textarea name="response" rows={3} required minLength={10} placeholder="Explain the decision with reference to the rubric." />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <SubmitButton name="decision" value="reject" variant="secondary">
                      <CircleX className="size-4" /> Reject
                    </SubmitButton>
                    <SubmitButton name="decision" value="accept" variant="success">
                      <CircleCheck className="size-4" /> Accept
                    </SubmitButton>
                  </div>
                </ActionForm>
              </CardBody>
            </Card>
          ) : (
            <Notice tone="amber">
              {exam.status !== "PUBLISHED"
                ? "Cribs can only be decided while results are published."
                : `Assigned to ${crib.reviewer?.name ?? "nobody"}.`}
            </Notice>
          )}

          {moderator && crib.status === "OPEN" && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <UserRoundCog className="size-4 text-indigo-500" /> Reassign reviewer
                  </span>
                }
              />
              <CardBody>
                <form action={reassignCrib.bind(null, examId, cribId)} className="flex gap-2">
                  <select name="reviewerId" defaultValue={crib.reviewerId ?? ""}>
                    {staff
                      .filter((s) => s.userId !== crib.grade.graderId)
                      .map((s) => (
                        <option key={s.userId} value={s.userId}>
                          {s.user.name}
                        </option>
                      ))}
                  </select>
                  <Button variant="secondary">Assign</Button>
                </form>
              </CardBody>
            </Card>
          )}

          {q.rulings.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Gavel className="size-4 text-indigo-500" /> Rulings for {q.label}
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
