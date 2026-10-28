import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "./db";
import { requireUser } from "./auth";

export type Role = "INSTRUCTOR" | "HEAD_TA" | "TA" | "STUDENT";

export const ROLE_LABEL: Record<Role, string> = {
  INSTRUCTOR: "Instructor",
  HEAD_TA: "Head TA",
  TA: "TA",
  STUDENT: "Student",
};

/** Can create rulings, resolve escalated doubts and review cribs. */
export function isModerator(role: Role) {
  return role === "INSTRUCTOR" || role === "HEAD_TA";
}

/** Anyone on the grading team. */
export function isStaff(role: Role) {
  return role !== "STUDENT";
}

/** TAs grade while the exam is in GRADING; moderators can also correct marks after publishing. */
export function canEditGrades(role: Role, status: string) {
  if (status === "CLOSED") return false;
  if (isModerator(role)) return status !== "DRAFT";
  return status === "GRADING";
}

export const getMembership = cache(async (userId: string, courseId: string) => {
  return db.membership.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
});

/** Loads a course the current user belongs to, or 404s. */
export async function requireCourse(courseId: string, allowed?: Role[]) {
  const user = await requireUser();
  const membership = await getMembership(user.id, courseId);
  if (!membership) notFound();
  const role = membership.role as Role;
  if (allowed && !allowed.includes(role)) notFound();
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  return { user, course, role };
}

/** Loads an exam the current user can see, with their role in its course, or 404s. */
export async function requireExam(examId: string, allowed?: Role[]) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: { course: true },
  });
  if (!exam) notFound();
  const { user, role } = await requireCourse(exam.courseId, allowed);
  return { user, exam, role };
}
