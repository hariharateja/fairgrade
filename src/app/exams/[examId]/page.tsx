import Link from "next/link";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { allocateScripts, setExamStatus, updateExamSettings } from "@/app/actions/exams";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EXAM_STATUS } from "@/components/exam-status";
import { Card, CardBody, CardHeader, Field, LinkButton, Notice, Stat, Table, cx } from "@/components/ui";
import { StudentResults } from "./student-results";

// Server actions on this page call the AI model, which can take up to a minute or two.
export const maxDuration = 120;

const STEPS = ["DRAFT", "GRADING", "PUBLISHED", "CLOSED"] as const;

const NEXT_ACTION: Record<string, { status: string; label: string; confirm: string }> = {
  DRAFT: { status: "GRADING", label: "Start grading", confirm: "TAs will be able to enter marks. Continue?" },
  GRADING: { status: "PUBLISHED", label: "Publish results", confirm: "Students will see their marks and can raise cribs. Continue?" },
  PUBLISHED: { status: "CLOSED", label: "Close cribs & finalise", confirm: "No more cribs or changes will be possible. Continue?" },
};

function toLocalInput(date: Date | null) {
  if (!date) return "";
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default async function ExamOverview({ params }: PageProps<"/exams/[examId]">) {
  const { examId } = await params;
  const { user, exam, role } = await requireExam(examId);
  if (role === "STUDENT") return <StudentResults exam={exam} userId={user.id} />;

  const instructor = role === "INSTRUCTOR";
  const [questions, graders, students, allocations, gradeCounts, doubts, cribs, sheets] = await Promise.all([
    db.question.count({ where: { examId } }),
    db.membership.findMany({
      where: { courseId: exam.courseId, role: { in: ["TA", "HEAD_TA"] } },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.membership.count({ where: { courseId: exam.courseId, role: "STUDENT" } }),
    db.allocation.findMany({ where: { examId } }),
    db.grade.groupBy({ by: ["studentId"], where: { examId }, _count: true }),
    db.doubt.groupBy({ by: ["status"], where: { examId }, _count: true }),
    db.crib.groupBy({ by: ["status"], where: { examId }, _count: true }),
    db.answerSheet.findMany({ where: { examId }, select: { studentId: true } }),
  ]);

  const complete = new Set(gradeCounts.filter((g) => questions > 0 && g._count >= questions).map((g) => g.studentId));
  const scanned = new Set(sheets.map((s) => s.studentId));
  const doubtCount = (s: string) => doubts.find((d) => d.status === s)?._count ?? 0;
  const cribCount = (s: string) => cribs.find((c) => c.status === s)?._count ?? 0;
  const unallocated = students - allocations.length;

  const perGrader = graders
    .map((g) => {
      const mine = allocations.filter((a) => a.taId === g.userId);
      return {
        id: g.userId,
        name: g.user.name,
        head: g.role === "HEAD_TA",
        allocated: mine.length,
        done: mine.filter((a) => complete.has(a.studentId)).length,
        scanned: mine.filter((a) => scanned.has(a.studentId)).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const myRow = perGrader.find((g) => g.id === user.id);
  const next = NEXT_ACTION[exam.status];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Answer sheets marked" value={`${complete.size} / ${students}`} hint={`${scanned.size} of ${students} scanned`} />
        <Stat label="Questions" value={questions} hint={`${exam.totalMarks} marks total`} />
        <Stat label="Doubts" value={doubtCount("AI_SUGGESTED") + doubtCount("ESCALATED")} hint={`${doubtCount("ESCALATED")} escalated · ${doubtCount("RESOLVED")} resolved`} />
        <Stat label="Open cribs" value={cribCount("OPEN")} hint={`${cribCount("ACCEPTED")} accepted · ${cribCount("REJECTED")} rejected`} />
      </div>

      {!isModerator(role) && myRow && (
        <Card>
          <CardHeader
            title="Your grading"
            description={`${myRow.done} of ${myRow.allocated} allocated answer sheets complete`}
            action={exam.status === "GRADING" ? <LinkButton href={`/exams/${examId}/grade`}>Go to my answer sheets</LinkButton> : undefined}
          />
          <CardBody>
            <Progress value={myRow.done} max={myRow.allocated} />
          </CardBody>
        </Card>
      )}

      {instructor && (
        <Card>
          <CardHeader title="Workflow" description={EXAM_STATUS[exam.status]?.help} />
          <CardBody className="space-y-4">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => {
                const current = STEPS.indexOf(exam.status as (typeof STEPS)[number]);
                return (
                  <li key={s} className="space-y-1.5">
                    <div className={cx("h-1.5 rounded-full", i <= current ? "bg-indigo-600" : "bg-slate-200")} />
                    <div className={cx("text-xs", i === current ? "font-semibold text-indigo-700" : "text-slate-500")}>
                      {EXAM_STATUS[s].label}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              {next && (
                <form action={setExamStatus.bind(null, examId)}>
                  <input type="hidden" name="status" value={next.status} />
                  <SubmitButton confirm={next.confirm} pendingText="Updating…">
                    {next.label}
                  </SubmitButton>
                </form>
              )}
              {(exam.status === "PUBLISHED" || exam.status === "CLOSED") && (
                <form action={setExamStatus.bind(null, examId)}>
                  <input type="hidden" name="status" value={exam.status === "PUBLISHED" ? "GRADING" : "PUBLISHED"} />
                  <SubmitButton variant="ghost" confirm="Move the exam back one step?">
                    {exam.status === "PUBLISHED" ? "Unpublish" : "Reopen cribs"}
                  </SubmitButton>
                </form>
              )}
              <a href={`/exams/${examId}/export`} className="ml-auto text-sm font-medium text-indigo-700 hover:underline">
                Download marks (CSV)
              </a>
            </div>
            {exam.status === "DRAFT" && questions === 0 && (
              <Notice tone="amber">
                Add questions on the <Link href={`/exams/${examId}/rubric`} className="underline">Rubric</Link> tab before starting.
              </Notice>
            )}
          </CardBody>
        </Card>
      )}

      {isModerator(role) && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Grader progress"
              description="Answer sheets are spread randomly and evenly, so each TA's averages should be comparable."
            />
            {perGrader.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">No TAs yet. Share the TA join code from the course page.</p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Grader</th>
                    <th>Allocated</th>
                    <th className="w-1/3">Marked</th>
                    <th>Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {perGrader.map((g) => (
                    <tr key={g.id}>
                      <td className="font-medium">
                        {g.name}
                        {g.head && <span className="ml-1 text-xs text-slate-500">(Head TA)</span>}
                      </td>
                      <td className="tabular-nums">{g.allocated}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Progress value={g.done} max={g.allocated} />
                          <span className="w-14 text-right text-xs tabular-nums text-slate-500">
                            {g.done}/{g.allocated}
                          </span>
                        </div>
                      </td>
                      <td className={`tabular-nums ${g.scanned < g.done ? "text-amber-700" : "text-slate-600"}`}>
                        {g.scanned}/{g.allocated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Allocate answer sheets" description={`${unallocated} of ${students} students unallocated`} />
            <CardBody className="space-y-3">
              <form action={allocateScripts.bind(null, examId)}>
                <SubmitButton className="w-full" variant="secondary" pendingText="Allocating…">
                  Allocate unallocated students
                </SubmitButton>
              </form>
              <form action={allocateScripts.bind(null, examId)}>
                <input type="hidden" name="reshuffle" value="1" />
                <SubmitButton
                  className="w-full"
                  variant="ghost"
                  confirm="Redistribute every answer sheet that has no marks yet?"
                  pendingText="Reshuffling…"
                >
                  Reshuffle ungraded answer sheets
                </SubmitButton>
              </form>
              <p className="text-xs text-slate-500">
                New TAs joined? Reshuffle to rebalance. Answer sheets that already have marks stay with their grader.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {instructor && (
        <Card>
          <CardHeader title="Settings" />
          <CardBody>
            <ActionForm action={updateExamSettings.bind(null, examId)} className="grid gap-4 md:grid-cols-2">
              <Field label="Title">
                <input name="title" defaultValue={exam.title} required />
              </Field>
              <Field label="Total marks">
                <input name="totalMarks" type="number" step="0.5" min="0.5" defaultValue={exam.totalMarks} required />
              </Field>
              <Field label="Crib deadline" hint="Students can raise cribs until this time after results are published.">
                <input name="cribDeadline" type="datetime-local" defaultValue={toLocalInput(exam.cribDeadline)} />
              </Field>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700">Blind grading</span>
                <label className="flex items-start gap-2 font-normal">
                  <input type="checkbox" name="blindGrading" defaultChecked={exam.blindGrading} className="mt-0.5" />
                  <span className="text-sm text-slate-600">
                    Hide names and roll numbers from TAs. They see an anonymous sheet code instead, which you print on each answer sheet.
                  </span>
                </label>
              </div>
              <div className="md:col-span-2">
                <SubmitButton variant="secondary" pendingText="Saving…">
                  Save settings
                </SubmitButton>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Progress({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
