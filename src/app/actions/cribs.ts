"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { AiError, screenCrib } from "@/lib/ai";
import { saveImages } from "@/lib/files";
import { getObject } from "@/lib/storage";
import { questionContext, rubricTotal, saveGrade } from "@/lib/grading";
import { parseJson } from "@/lib/utils";
import type { ActionResult } from "@/components/forms";

/**
 * Picks a reviewer who is not the original grader: the TA or Head TA with the fewest open
 * cribs, falling back to the instructor. Fresh eyes avoid the original grader defending their mark.
 */
async function pickReviewer(courseId: string, examId: string, excludeId: string) {
  const staff = await db.membership.findMany({
    where: { courseId, role: { in: ["TA", "HEAD_TA"] }, userId: { not: excludeId } },
  });
  if (!staff.length) {
    const instructor = await db.membership.findFirst({ where: { courseId, role: "INSTRUCTOR" } });
    return instructor?.userId ?? null;
  }
  const open = await db.crib.groupBy({ by: ["reviewerId"], where: { examId, status: "OPEN" }, _count: true });
  const load = (id: string) => open.find((o) => o.reviewerId === id)?._count ?? 0;
  return staff.sort((a, b) => load(a.userId) - load(b.userId) || Math.random() - 0.5)[0].userId;
}

export async function createCrib(examId: string, questionId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, exam } = await requireExam(examId, ["STUDENT"]);
  if (exam.status !== "PUBLISHED") return { error: "Cribs are closed for this exam." };
  if (exam.cribDeadline && exam.cribDeadline.getTime() < Date.now()) return { error: "The crib deadline has passed." };

  const grade = await db.grade.findUnique({ where: { questionId_studentId: { questionId, studentId: user.id } } });
  if (!grade || grade.examId !== examId) return { error: "This question hasn't been graded." };
  if (await db.crib.findFirst({ where: { gradeId: grade.id } })) {
    return { error: "You've already raised a crib on this question." };
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 30) return { error: "Explain your crib in at least 30 characters." };
  const rubricItemId = String(formData.get("rubricItemId") ?? "") || null;
  if (rubricItemId && !(await db.rubricItem.findFirst({ where: { id: rubricItemId, questionId } }))) {
    return { error: "That rubric criterion doesn't belong to this question." };
  }
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
  let imageNames: string[] = [];
  try {
    imageNames = await saveImages(files);
  } catch {
    return { error: "Couldn't read one of the photos. Use JPEG or PNG images." };
  }

  const reviewerId = await pickReviewer(exam.courseId, examId, grade.graderId);
  const crib = await db.crib.create({
    data: {
      examId,
      questionId,
      gradeId: grade.id,
      studentId: user.id,
      rubricItemId,
      reason: reason.slice(0, 3000),
      imagePaths: JSON.stringify(imageNames),
      reviewerId,
      marksBefore: grade.marks,
    },
  });

  // Give the AI the grader's scan of the whole answer sheet when there is one (and it's not huge).
  const sheet = await db.answerSheet.findUnique({ where: { examId_studentId: { examId, studentId: user.id } } });
  const sheetPdfBase64 =
    sheet && sheet.sizeBytes <= 15 * 1024 * 1024 ? (await getObject(sheet.fileName)).toString("base64") : undefined;

  try {
    const { mode, advice } = await screenCrib({
      question: await questionContext(questionId),
      currentMarks: grade.marks,
      appliedItemIds: parseJson<string[]>(grade.appliedItemIds, []),
      citedItemId: rubricItemId,
      reason,
      imageNames,
      sheetPdfBase64,
    });
    await db.crib.update({
      where: { id: crib.id },
      data: { aiMode: mode, aiVerdict: advice.verdict, aiAnalysis: advice.analysis, aiSuggestedMarks: advice.suggestedMarks },
    });
  } catch (error) {
    // The crib still goes to a human reviewer; the AI pre-screen is a convenience.
    if (!(error instanceof AiError)) console.error(error);
    await db.crib.update({
      where: { id: crib.id },
      data: { aiAnalysis: error instanceof AiError ? `AI pre-screen unavailable: ${error.message}` : "AI pre-screen failed." },
    });
  }

  revalidatePath(`/exams/${examId}`, "layout");
  return { ok: "Crib submitted. A reviewer other than your original grader will look at it." };
}

export async function decideCrib(examId: string, cribId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  const crib = await db.crib.findFirst({
    where: { id: cribId, examId },
    include: { grade: true, question: { include: { rubricItems: true } } },
  });
  if (!crib) return { error: "Crib not found." };
  if (crib.status !== "OPEN") return { error: "This crib has already been decided." };
  if (crib.reviewerId !== user.id && !isModerator(role)) return { error: "This crib is assigned to someone else." };
  if (exam.status !== "PUBLISHED") return { error: "Cribs can only be decided while results are published." };

  const decision = String(formData.get("decision"));
  const response = String(formData.get("response") ?? "").trim();
  if (response.length < 10) return { error: "Write a short response to the student (at least 10 characters)." };

  if (decision === "reject") {
    await db.crib.update({
      where: { id: cribId },
      data: { status: "REJECTED", response, marksAfter: crib.grade.marks, resolvedAt: new Date(), reviewerId: crib.reviewerId ?? user.id },
    });
  } else if (decision === "accept") {
    const q = crib.question;
    const applied = formData.getAll("applied").map(String).filter((id) => q.rubricItems.some((i) => i.id === id));
    const override = String(formData.get("override") ?? "").trim();
    let marks = rubricTotal(q.rubricItems, applied, q.maxMarks);
    if (override) {
      const value = Number(override);
      if (!Number.isFinite(value) || value < 0 || value > q.maxMarks) return { error: `Marks must be between 0 and ${q.maxMarks}.` };
      marks = value;
    }
    if (marks === crib.grade.marks && JSON.stringify(applied.sort()) === JSON.stringify(parseJson<string[]>(crib.grade.appliedItemIds, []).sort())) {
      return { error: "Accepting should change the marks or criteria. Otherwise, reject the crib." };
    }
    await saveGrade({
      examId,
      questionId: q.id,
      studentId: crib.studentId,
      graderId: crib.grade.graderId,
      changedById: user.id,
      marks,
      appliedItemIds: applied,
      manualOverride: !!override,
      reason: "Crib accepted",
    });
    await db.crib.update({
      where: { id: cribId },
      data: { status: "ACCEPTED", response, marksAfter: marks, resolvedAt: new Date(), reviewerId: crib.reviewerId ?? user.id },
    });
  } else {
    return { error: "Choose accept or reject." };
  }

  revalidatePath(`/exams/${examId}`, "layout");
  return { ok: decision === "accept" ? "Crib accepted and marks updated." : "Crib rejected. The student will see your response." };
}

export async function reassignCrib(examId: string, cribId: string, formData: FormData) {
  await requireExam(examId, ["INSTRUCTOR", "HEAD_TA"]);
  const reviewerId = String(formData.get("reviewerId") ?? "");
  const crib = await db.crib.findFirst({ where: { id: cribId, examId, status: "OPEN" }, include: { exam: true } });
  if (!crib) return;
  const m = await db.membership.findUnique({ where: { userId_courseId: { userId: reviewerId, courseId: crib.exam.courseId } } });
  if (!m || m.role === "STUDENT") return;
  await db.crib.update({ where: { id: cribId }, data: { reviewerId } });
  revalidatePath(`/exams/${examId}`, "layout");
}
