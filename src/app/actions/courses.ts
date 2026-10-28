"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireCourse, type Role } from "@/lib/access";
import { joinCode } from "@/lib/utils";
import type { ActionResult } from "@/components/forms";

export async function createCourse(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim() || null;
  if (!code || !name) return { error: "Course code and name are required." };
  const course = await db.course.create({
    data: {
      code,
      name,
      term,
      ownerId: user.id,
      studentJoinCode: joinCode(),
      taJoinCode: joinCode(),
      memberships: { create: { userId: user.id, role: "INSTRUCTOR" } },
    },
  });
  redirect(`/courses/${course.id}`);
}

export async function joinCourse(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const course = await db.course.findFirst({
    where: { OR: [{ studentJoinCode: code }, { taJoinCode: code }] },
  });
  if (!course) return { error: "No course matches that code." };
  const role: Role = course.taJoinCode === code ? "TA" : "STUDENT";
  if (role === "STUDENT" && !user.rollNo) {
    return { error: "Add your roll number to your account before joining as a student." };
  }
  const existing = await db.membership.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });
  if (!existing) {
    await db.membership.create({ data: { userId: user.id, courseId: course.id, role } });
  }
  redirect(`/courses/${course.id}`);
}

export async function changeMemberRole(courseId: string, formData: FormData) {
  const { user } = await requireCourse(courseId, ["INSTRUCTOR"]);
  const membershipId = String(formData.get("membershipId"));
  const role = String(formData.get("role")) as Role;
  if (!["HEAD_TA", "TA", "STUDENT"].includes(role)) return;
  const membership = await db.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.courseId !== courseId || membership.userId === user.id) return;
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath(`/courses/${courseId}`);
}

export async function removeMember(courseId: string, formData: FormData) {
  const { user } = await requireCourse(courseId, ["INSTRUCTOR"]);
  const membershipId = String(formData.get("membershipId"));
  const membership = await db.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.courseId !== courseId || membership.userId === user.id) return;
  await db.membership.delete({ where: { id: membershipId } });
  revalidatePath(`/courses/${courseId}`);
}

export async function regenerateJoinCodes(courseId: string) {
  await requireCourse(courseId, ["INSTRUCTOR"]);
  await db.course.update({
    where: { id: courseId },
    data: { studentJoinCode: joinCode(), taJoinCode: joinCode() },
  });
  revalidatePath(`/courses/${courseId}`);
}

export async function createExam(courseId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireCourse(courseId, ["INSTRUCTOR"]);
  const title = String(formData.get("title") ?? "").trim();
  const totalMarks = Number(formData.get("totalMarks"));
  if (!title) return { error: "Give the exam a title." };
  if (!(totalMarks > 0)) return { error: "Total marks must be a positive number." };
  const exam = await db.exam.create({ data: { courseId, title, totalMarks } });
  redirect(`/exams/${exam.id}/rubric`);
}
