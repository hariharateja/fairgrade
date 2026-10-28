import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { decideCrib, reassignCrib } from "@/app/actions/cribs";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CribStatusBadge, VerdictBadge } from "@/components/crib-status";
import { Badge, Button, Card, CardBody, CardHeader, Field, Notice, cx } from "@/components/ui";
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

  return (
    <div className="space-y-4">
      <Link href={`/exams/${examId}/cribs`} className="text-sm text-slate-500 hover:underline">
        ← All cribs
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">
          {q.label} crib · <span className="font-normal text-slate-600">{studentLabel(exam, crib.student, moderator)}</span>
        </h2>
        <CribStatusBadge status={crib.status} />
        <span className="text-sm text-slate-500">
          Raised {timeAgo(crib.createdAt)} · originally graded by {crib.grade.grader.name}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader title="Student's request" />
            <CardBody className="space-y-3">
              {cited && (
                <div className="text-sm">
                  <span className="text-slate-500">Cites criterion: </span>
                  <span className="font-medium">{cited.description}</span>{" "}
                  <span className="font-mono">({cited.marks > 0 ? "+" : ""}{fmt(cited.marks)})</span>
                </div>
              )}
              <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">{crib.reason}</p>
              {images.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {images.map((name) => (
                    <a key={name} href={`/api/files/${name}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${name}`} alt="Student's answer" className="w-full rounded-md border border-slate-200" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No photo attached. Check the physical script if needed.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="AI pre-screen" action={<VerdictBadge verdict={crib.aiVerdict} />} />
            <CardBody className="space-y-2 text-sm">
              {crib.aiMode === "demo" && <Badge tone="amber">Simulated</Badge>}
              <p className="text-slate-700">{crib.aiAnalysis ?? "Not available."}</p>
              {crib.aiSuggestedMarks !== null && (
                <p className="text-slate-600">
                  Suggested marks: <span className="font-mono font-semibold">{fmt(crib.aiSuggestedMarks)}</span> / {fmt(q.maxMarks)}
                </p>
              )}
            </CardBody>
          </Card>

          {crib.grade.history.length > 0 && (
            <Card>
              <CardHeader title="Mark history" />
              <ul className="divide-y divide-slate-100 text-sm">
                {crib.grade.history.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 px-5 py-2">
                    <span>
                      {fmt(h.oldMarks)} → {fmt(h.newMarks)} <span className="text-slate-500">· {h.reason}</span>
                    </span>
                    <span className="text-slate-500">{h.changedBy.name}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {crib.status !== "OPEN" ? (
            <Card>
              <CardHeader title="Decision" />
              <CardBody className="space-y-2 text-sm">
                <p>
                  <span className="font-mono text-lg font-semibold">
                    {fmt(crib.marksBefore)} → {fmt(crib.marksAfter)}
                  </span>{" "}
                  / {fmt(q.maxMarks)}
                </p>
                <p className="text-slate-600">By {crib.reviewer?.name}</p>
                <p className="whitespace-pre-wrap text-slate-800">{crib.response}</p>
              </CardBody>
            </Card>
          ) : canDecide ? (
            <Card>
              <CardHeader
                title="Decide"
                description={`Current marks: ${fmt(crib.grade.marks)} / ${fmt(q.maxMarks)}. Adjust the criteria if accepting.`}
              />
              <CardBody>
                <ActionForm action={decideCrib.bind(null, examId, cribId)} className="space-y-3">
                  <div className="space-y-1">
                    {q.rubricItems.map((item) => (
                      <label
                        key={item.id}
                        className={cx(
                          "flex items-start gap-2 rounded-md px-2 py-1 font-normal",
                          item.id === crib.rubricItemId && "bg-amber-50",
                        )}
                      >
                        <input type="checkbox" name="applied" value={item.id} defaultChecked={proposed.includes(item.id)} className="mt-0.5" />
                        <span className="flex-1 text-sm">{item.description}</span>
                        <span className={cx("font-mono text-sm", item.marks < 0 && "text-red-600")}>
                          {item.marks > 0 ? "+" : ""}
                          {fmt(item.marks)}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Field label="Override total (optional)">
                    <input name="override" type="number" step="0.25" min={0} max={q.maxMarks} placeholder="Use rubric total" />
                  </Field>
                  <Field label="Response to the student">
                    <textarea name="response" rows={3} required minLength={10} placeholder="Explain the decision with reference to the rubric." />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <SubmitButton name="decision" value="reject" variant="secondary">
                      Reject
                    </SubmitButton>
                    <SubmitButton name="decision" value="accept" variant="success">
                      Accept & update
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
              <CardHeader title="Reassign" />
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
              <CardHeader title={`Rulings for ${q.label}`} />
              <CardBody>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
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
