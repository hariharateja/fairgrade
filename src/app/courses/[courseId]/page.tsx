import Link from "next/link";
import { db } from "@/lib/db";
import { requireCourse, ROLE_LABEL, isStaff, type Role } from "@/lib/access";
import { changeMemberRole, createExam, regenerateJoinCodes, removeMember } from "@/app/actions/courses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ExamStatusBadge } from "@/components/exam-status";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, PageHeader, Table } from "@/components/ui";
import { fmt } from "@/lib/utils";

export default async function CoursePage({ params }: PageProps<"/courses/[courseId]">) {
  const { courseId } = await params;
  const { user, course, role } = await requireCourse(courseId);
  const instructor = role === "INSTRUCTOR";

  const [exams, members] = await Promise.all([
    db.exam.findMany({
      where: { courseId, ...(role === "STUDENT" ? { status: { in: ["PUBLISHED", "CLOSED"] } } : {}) },
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
  ]);

  const staff = members.filter((m) => isStaff(m.role as Role));
  const students = members.filter((m) => m.role === "STUDENT");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/" className="hover:underline">
            Courses
          </Link>
        }
        title={
          <span>
            <span className="font-mono text-indigo-700">{course.code}</span> {course.name}
          </span>
        }
        description={`${course.term ? course.term + " · " : ""}Your role: ${ROLE_LABEL[role]}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Exams" description={role === "STUDENT" ? "Exams with published results." : undefined} />
            {exams.length === 0 ? (
              <CardBody>
                <EmptyState title="No exams yet">
                  {instructor ? "Create one to upload its rubric." : "Nothing here yet."}
                </EmptyState>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {exams.map((exam) => (
                  <li key={exam.id}>
                    <Link href={`/exams/${exam.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-900">{exam.title}</div>
                        <div className="text-xs text-slate-500">
                          {exam._count.questions} questions · {fmt(exam.totalMarks)} marks
                        </div>
                      </div>
                      <ExamStatusBadge status={exam.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {instructor && (
            <Card>
              <CardHeader title="People" description={`${staff.length} staff · ${students.length} students`} />
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
                        <div className="font-medium">{m.user.name}</div>
                        <div className="text-xs text-slate-500">{m.user.email}</div>
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
              <CardHeader title="New exam" />
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
              <CardHeader title="Join codes" description="Share these so people can join with the right role." />
              <CardBody className="space-y-3">
                <JoinCode label="Students" code={course.studentJoinCode} />
                <JoinCode label="TAs" code={course.taJoinCode} />
                <form action={regenerateJoinCodes.bind(null, courseId)}>
                  <SubmitButton size="sm" variant="ghost" confirm="Old codes will stop working. Continue?">
                    Regenerate codes
                  </SubmitButton>
                </form>
                <p className="text-xs text-slate-500">
                  Promote experienced TAs to Head TA so they can resolve escalated doubts and review cribs.
                </p>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

function JoinCode({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="font-mono text-base font-semibold tracking-wider text-slate-900 select-all">{code}</span>
    </div>
  );
}
