import Link from "next/link";
import { ArrowRight, BookOpen, KeyRound, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL, type Role } from "@/lib/access";
import { createCourse, joinCourse } from "@/app/actions/courses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, cx } from "@/components/ui";
import { Landing } from "./landing";

function firstName(name: string) {
  return name.replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "").split(" ")[0];
}

const ROLE_ACCENT: Record<Role, string> = {
  INSTRUCTOR: "from-indigo-500 to-indigo-700",
  HEAD_TA: "from-violet-500 to-indigo-600",
  TA: "from-sky-500 to-indigo-500",
  STUDENT: "from-amber-400 to-amber-500",
};

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          _count: { select: { memberships: true, exams: true } },
          exams: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-6 py-7 sm:px-8">
        <div className="bg-dots absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-600">Welcome back</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Hi, {firstName(user.name)}</h1>
          <p className="mt-2 text-slate-600">
            {memberships.length
              ? `You're in ${memberships.length} course${memberships.length === 1 ? "" : "s"}. Pick one to continue.`
              : "Join a course with a code, or create one if you teach."}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-3 lg:col-span-2">
          <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">Your courses</h2>
          {memberships.length === 0 ? (
            <EmptyState title="You're not in any course yet">
              Join one with a code from your instructor, or create a course if you teach.
            </EmptyState>
          ) : (
            memberships.map(({ course, role }) => {
              const r = role as Role;
              const grading = course.exams.filter((e) => e.status === "GRADING").length;
              const published = course.exams.filter((e) => e.status === "PUBLISHED").length;
              return (
                <Link key={course.id} href={`/courses/${course.id}`} className="group block">
                  <Card className="flex items-stretch overflow-hidden transition group-hover:-translate-y-0.5 group-hover:border-indigo-300 group-hover:shadow-lg group-hover:shadow-indigo-900/5">
                    <div className={cx("w-1.5 shrink-0 bg-gradient-to-b", ROLE_ACCENT[r])} />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                            {course.code}
                          </span>
                          <Badge tone={r === "STUDENT" ? "amber" : "indigo"}>{ROLE_LABEL[r]}</Badge>
                          {grading > 0 && r !== "STUDENT" && <Badge tone="blue">{grading} grading</Badge>}
                          {published > 0 && <Badge tone="green">Results out</Badge>}
                        </div>
                        <div className="mt-1.5 truncate text-lg font-semibold text-slate-900">{course.name}</div>
                        <div className="text-sm text-slate-500">
                          {course.term && `${course.term} · `}
                          {course._count.memberships} people · {course._count.exams} exam{course._count.exams === 1 ? "" : "s"}
                        </div>
                      </div>
                      <ArrowRight className="size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-amber-500" /> Join a course
                </span>
              }
              description="Use the student or TA code your instructor shared."
            />
            <CardBody>
              <ActionForm action={joinCourse} className="space-y-3">
                <input name="code" placeholder="e.g. 7F3A9C21" required className="font-mono tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case" />
                <SubmitButton className="w-full" pendingText="Joining…">
                  Join
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4 text-indigo-500" /> Create a course
                </span>
              }
              description="You'll be its instructor."
            />
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
                  <Plus className="size-4" /> Create course
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
