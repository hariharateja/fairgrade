import Link from "next/link";
import { ArrowRight, ChartColumn, ChevronRight, ClipboardCheck, KeyRound, MessageSquareText, Plus, Sparkles, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse, ROLE_LABEL, isModerator, isStaff, type Role } from "@/lib/access";
import { changeMemberRole, createExam, regenerateJoinCodes, removeMember } from "@/app/actions/courses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ExamStatusBadge, STUDENT_EXAM_STATUS } from "@/components/exam-status";
import { Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Table, buttonClass, cx } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default async function CoursePage({ params }: PageProps<"/courses/[courseId]">) {
  const { courseId } = await params;
  const { user, course, role } = await requireCourse(courseId);
  const instructor = role === "INSTRUCTOR";
  const student = role === "STUDENT";
  const moderator = isModerator(role);

  const [exams, members, counts] = await Promise.all([
    db.exam.findMany({
      where: { courseId },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    instructor
      ? db.membership.findMany({
          where: { courseId },
          include: { user: true },
          orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
        })
      : Promise.resolve([]),
    db.membership.groupBy({ by: ["role"], where: { courseId }, _count: true }),
  ]);
  const examIds = exams.map((e) => e.id);

  // Per-exam numbers for the cards: a student's own total, or grading progress for staff.
  const [myGrades, gradedSheets, myAllocations, escalated, openCribs] = await Promise.all([
    student
      ? db.grade.groupBy({ by: ["examId"], where: { studentId: user.id, examId: { in: examIds } }, _sum: { marks: true } })
      : Promise.resolve([]),
    !student ? db.grade.groupBy({ by: ["examId", "studentId"], where: { examId: { in: examIds } }, _count: true }) : Promise.resolve([]),
    role === "TA" ? db.allocation.groupBy({ by: ["examId"], where: { taId: user.id, examId: { in: examIds } }, _count: true }) : Promise.resolve([]),
    moderator ? db.doubt.groupBy({ by: ["examId"], where: { status: "ESCALATED", examId: { in: examIds } }, _count: true }) : Promise.resolve([]),
    !student
      ? db.crib.groupBy({ by: ["examId"], where: { status: "OPEN", examId: { in: examIds }, ...(moderator ? {} : { reviewerId: user.id }) }, _count: true })
      : Promise.resolve([]),
  ]);
  const studentCount = counts.find((c) => c.role === "STUDENT")?._count ?? 0;
  const staffCount = counts.filter((c) => c.role !== "STUDENT").reduce((n, c) => n + c._count, 0);

  const staff = members.filter((m) => isStaff(m.role as Role));
  const students = members.filter((m) => m.role === "STUDENT");

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-400 to-amber-400" aria-hidden />
          <nav className="flex items-center gap-1 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900">
              Courses
            </Link>
            <ChevronRight className="size-3.5 text-slate-300" />
            <span className="text-slate-700">{course.code}</span>
          </nav>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <span className="text-indigo-600">{course.code}</span> · {course.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {course.term && (
              <>
                <span>{course.term}</span>
                <span className="text-slate-300">•</span>
              </>
            )}
            <Badge tone={student ? "amber" : "indigo"}>{ROLE_LABEL[role]}</Badge>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {studentCount} students · {staffCount} staff
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={cx("min-w-0 space-y-4", instructor ? "lg:col-span-2" : "lg:col-span-3")}>
          <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">Exams</h2>
          {exams.length === 0 ? (
            <EmptyState title="No exams yet">
              {instructor ? "Create your first exam on the right to upload its rubric." : "Your instructor hasn't created any exams yet."}
            </EmptyState>
          ) : (
            exams.map((exam) => {
              const published = exam.status === "PUBLISHED" || exam.status === "CLOSED";
              const myTotal = myGrades.find((g) => g.examId === exam.id)?._sum.marks ?? null;
              const graded = gradedSheets.filter((g) => g.examId === exam.id && g._count >= exam._count.questions && exam._count.questions > 0).length;
              const allocated = myAllocations.find((a) => a.examId === exam.id)?._count ?? 0;
              const esc = escalated.find((d) => d.examId === exam.id)?._count ?? 0;
              const cribs = openCribs.find((c) => c.examId === exam.id)?._count ?? 0;
              const base = `/exams/${exam.id}`;
              return (
                <Card key={exam.id} className="overflow-hidden">
                  <Link href={base} className="group flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50/60 sm:px-6">
                    <span
                      className={cx(
                        "grid size-11 shrink-0 place-items-center rounded-xl",
                        published ? "bg-emerald-50 text-emerald-600" : exam.status === "GRADING" ? "bg-sky-50 text-sky-600" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <ClipboardCheck className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold text-slate-900">{exam.title}</span>
                        <ExamStatusBadge status={exam.status} student={student} />
                      </div>
                      <div className="text-sm text-slate-500">
                        {exam._count.questions} question{exam._count.questions === 1 ? "" : "s"} · {fmt(exam.totalMarks)} marks
                      </div>
                      {student ? (
                        <p className="mt-1.5 text-sm text-slate-600">
                          {published && myTotal !== null ? (
                            <>
                              You scored{" "}
                              <span className="font-mono font-semibold text-slate-900">
                                {fmt(myTotal)} / {fmt(exam.totalMarks)}
                              </span>
                            </>
                          ) : (
                            STUDENT_EXAM_STATUS[exam.status]?.help
                          )}
                        </p>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${studentCount ? (graded / studentCount) * 100 : 0}%` }} />
                          </div>
                          {graded} of {studentCount} answer sheets marked
                          {role === "TA" && allocated > 0 && <span className="text-slate-400">· {allocated} allocated to you</span>}
                        </div>
                      )}
                    </div>
                    <span className="hidden items-center gap-1 self-center text-sm font-medium text-indigo-700 sm:flex">
                      {student ? (published ? "View results" : "View") : "Open"}
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                  {!student && (
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 sm:px-6">
                      <QuickLink href={`${base}/grade`} icon={<ClipboardCheck />}>
                        Grade
                      </QuickLink>
                      <QuickLink href={`${base}/doubts`} icon={<Sparkles />} count={esc}>
                        Doubts
                      </QuickLink>
                      <QuickLink href={`${base}/cribs`} icon={<MessageSquareText />} count={cribs}>
                        Cribs
                      </QuickLink>
                      {moderator && (
                        <QuickLink href={`${base}/analytics`} icon={<ChartColumn />}>
                          Consistency
                        </QuickLink>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}

          {instructor && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Users className="size-4 text-indigo-500" /> People
                  </span>
                }
                description={`${staff.length} staff · ${students.length} students`}
              />
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Roll no.</th>
                    <th>Role</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...staff, ...students].map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.user.name} size="sm" />
                          <div>
                            <div className="font-medium">{m.user.name}</div>
                            <div className="text-xs text-slate-500">{m.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">{m.user.rollNo ?? "–"}</td>
                      <td>
                        {m.userId === user.id ? (
                          <Badge tone="indigo">Instructor</Badge>
                        ) : (
                          <form action={changeMemberRole.bind(null, courseId)} className="flex items-center gap-2">
                            <input type="hidden" name="membershipId" value={m.id} />
                            <select name="role" defaultValue={m.role} className="!w-28 !py-1 text-xs">
                              <option value="HEAD_TA">Head TA</option>
                              <option value="TA">TA</option>
                              <option value="STUDENT">Student</option>
                            </select>
                            <Button size="sm" variant="secondary">
                              Save
                            </Button>
                          </form>
                        )}
                      </td>
                      <td className="text-right">
                        {m.userId !== user.id && (
                          <form action={removeMember.bind(null, courseId)}>
                            <input type="hidden" name="membershipId" value={m.id} />
                            <SubmitButton size="sm" variant="ghost" confirm={`Remove ${m.user.name} from the course?`}>
                              Remove
                            </SubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>

        {instructor && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Plus className="size-4 text-indigo-500" /> New exam
                  </span>
                }
                description="Students see it right away; marks stay hidden until you publish."
              />
              <CardBody>
                <ActionForm action={createExam.bind(null, courseId)} className="space-y-3">
                  <Field label="Title" htmlFor="title">
                    <input id="title" name="title" placeholder="Midsem" required />
                  </Field>
                  <Field label="Total marks" htmlFor="totalMarks">
                    <input id="totalMarks" name="totalMarks" type="number" min="1" step="0.5" placeholder="50" required />
                  </Field>
                  <SubmitButton className="w-full" pendingText="Creating…">
                    Create & add rubric
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <KeyRound className="size-4 text-amber-500" /> Join codes
                  </span>
                }
                description="Share these so people join with the right role."
              />
              <CardBody className="space-y-3">
                <JoinCode label="Students" code={course.studentJoinCode} />
                <JoinCode label="TAs" code={course.taJoinCode} />
                <form action={regenerateJoinCodes.bind(null, courseId)}>
                  <SubmitButton size="sm" variant="ghost" confirm="Old codes will stop working. Continue?">
                    Regenerate codes
                  </SubmitButton>
                </form>
                <p className="text-xs text-slate-500">Promote experienced TAs to Head TA so they can resolve escalated doubts and review cribs.</p>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickLink({ href, icon, count, children }: { href: string; icon: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx(buttonClass("ghost", "sm"), "!px-2.5 [&_svg]:size-3.5")}>
      {icon}
      {children}
      {!!count && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] leading-4 font-bold text-amber-950">{count}</span>}
    </Link>
  );
}

function JoinCode({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="font-mono text-base font-semibold tracking-wider text-slate-900 select-all">{code}</span>
    </div>
  );
}
