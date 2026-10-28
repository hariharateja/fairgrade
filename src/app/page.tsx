import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL, type Role } from "@/lib/access";
import { createCourse, joinCourse } from "@/app/actions/courses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";

function firstName(name: string) {
  return name.replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "").split(" ")[0];
}

export default async function Dashboard() {
  const user = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: {
      course: { include: { _count: { select: { memberships: true, exams: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title={`Hi, ${firstName(user.name)}`} description="Your courses across every role." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {memberships.length === 0 ? (
            <EmptyState title="You're not in any course yet">
              Join one with a code from your instructor, or create a course if you teach.
            </EmptyState>
          ) : (
            memberships.map(({ course, role }) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="block">
                <Card className="flex items-center justify-between gap-4 px-5 py-4 transition hover:border-indigo-300 hover:shadow-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-indigo-700">{course.code}</span>
                      <Badge tone={role === "STUDENT" ? "slate" : "indigo"}>{ROLE_LABEL[role as Role]}</Badge>
                    </div>
                    <div className="truncate font-medium text-slate-900">{course.name}</div>
                    <div className="text-xs text-slate-500">
                      {course.term && `${course.term} · `}
                      {course._count.memberships} people · {course._count.exams} exams
                    </div>
                  </div>
                  <span className="text-slate-400">→</span>
                </Card>
              </Link>
            ))
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Join a course" description="Use the student or TA code your instructor shared." />
            <CardBody>
              <ActionForm action={joinCourse} className="space-y-3">
                <input name="code" placeholder="e.g. 7F3A9C21" required className="font-mono uppercase" />
                <SubmitButton className="w-full" pendingText="Joining…">
                  Join
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Create a course" description="You'll be its instructor." />
            <CardBody>
              <ActionForm action={createCourse} className="space-y-3">
                <Field label="Course code" htmlFor="code">
                  <input id="code" name="code" placeholder="CS 101" required />
                </Field>
                <Field label="Course name" htmlFor="name">
                  <input id="name" name="name" placeholder="Computer Programming" required />
                </Field>
                <Field label="Term" htmlFor="term">
                  <input id="term" name="term" placeholder="Autumn 2026" />
                </Field>
                <SubmitButton className="w-full" variant="secondary" pendingText="Creating…">
                  Create course
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
