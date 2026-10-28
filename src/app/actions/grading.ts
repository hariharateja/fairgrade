"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireExam, canEditGrades } from "@/lib/access";
import { rubricTotal, saveGrade } from "@/lib/grading";
import { clamp } from "@/lib/utils";
import type { ActionResult } from "@/components/forms";

export type ScriptPayload = {
  questionId: string;
  applied: string[];
  override: string; // empty = use rubric total
  comment: string;
  touched: boolean;
}[];

export async function saveScript(
  examId: string,
  studentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  if (!canEditGrades(role, exam.status)) {
    return { error: exam.status === "DRAFT" ? "Grading hasn't started yet." : "Grades are locked for this exam." };
  }
  const student = await db.membership.findUnique({
    where: { userId_courseId: { userId: studentId, courseId: exam.courseId } },
  });
  if (!student || student.role !== "STUDENT") return { error: "Student not found in this course." };

  const reason = String(formData.get("reason") ?? "").trim();
  if (exam.status === "PUBLISHED" && !reason) {
    return { error: "Results are published, so give a reason for changing marks." };
  }

  let payload: ScriptPayload;
  try {
    payload = JSON.parse(String(formData.get("payload")));
  } catch {
    return { error: "Could not read the grading sheet. Reload and try again." };
  }

  const questions = await db.question.findMany({ where: { examId }, include: { rubricItems: true } });
  let saved = 0;
  for (const entry of payload) {
    if (!entry.touched) continue;
    const q = questions.find((x) => x.id === entry.questionId);
    if (!q) continue;
    const applied = entry.applied.filter((id) => q.rubricItems.some((i) => i.id === id));
    const override = entry.override.trim();
    let marks = rubricTotal(q.rubricItems, applied, q.maxMarks);
    if (override !== "") {
      const value = Number(override);
      if (!Number.isFinite(value)) return { error: `${q.label}: marks must be a number.` };
      marks = clamp(value, 0, q.maxMarks);
    }
    const existing = await db.grade.findUnique({
      where: { questionId_studentId: { questionId: q.id, studentId } },
    });
    await saveGrade({
      examId,
      questionId: q.id,
      studentId,
      // A moderator's correction keeps the original grader on record for consistency stats.
      graderId: existing?.graderId ?? user.id,
      changedById: user.id,
      marks,
      appliedItemIds: applied,
      manualOverride: override !== "",
      comment: entry.comment.slice(0, 2000),
      reason: reason || "Edited during grading",
    });
    saved++;
  }

  revalidatePath(`/exams/${examId}`, "layout");
  const next = String(formData.get("next") ?? "");
  if (next.startsWith(`/exams/${examId}/`)) redirect(next);
  return { ok: saved ? `Saved ${saved} question${saved === 1 ? "" : "s"}.` : "Nothing changed." };
}
