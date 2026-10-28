"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireExam, isModerator } from "@/lib/access";
import { AiError, adviseOnDoubt, type DoubtAdvice } from "@/lib/ai";
import { saveImages } from "@/lib/files";
import { questionContext, rubricTotal, saveGrade } from "@/lib/grading";
import { clamp, parseJson } from "@/lib/utils";
import type { ActionResult } from "@/components/forms";

const STAFF = ["INSTRUCTOR", "HEAD_TA", "TA"] as const;

async function runAdvisor(doubtId: string) {
  const doubt = await db.doubt.findUniqueOrThrow({ where: { id: doubtId } });
  try {
    const { mode, advice } = await adviseOnDoubt({
      question: await questionContext(doubt.questionId),
      imageNames: parseJson<string[]>(doubt.imagePaths, []),
      note: doubt.note,
    });
    const escalate = advice.needsHumanReview || advice.confidence === "low";
    await db.doubt.update({
      where: { id: doubtId },
      data: {
        aiMode: mode,
        aiMarks: advice.suggestedMarks,
        aiConfidence: advice.confidence,
        aiTranscription: advice.transcription,
        aiAnalysis: JSON.stringify({
          criteria: advice.criteria,
          rationale: advice.rationale,
          proposedRuling: advice.proposedRuling,
          needsHumanReview: advice.needsHumanReview,
        }),
        status: escalate ? "ESCALATED" : "AI_SUGGESTED",
      },
    });
  } catch (error) {
    const message = error instanceof AiError ? error.message : "The AI assistant failed unexpectedly.";
    if (!(error instanceof AiError)) console.error(error);
    await db.doubt.update({
      where: { id: doubtId },
      data: { status: "ESCALATED", aiAnalysis: JSON.stringify({ error: message }) },
    });
  }
}

export async function createDoubt(examId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, exam } = await requireExam(examId, [...STAFF]);
  const questionId = String(formData.get("questionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);

  const question = await db.question.findFirst({ where: { id: questionId, examId } });
  if (!question) return { error: "Pick the question this answer belongs to." };
  if (studentId) {
    const m = await db.membership.findUnique({ where: { userId_courseId: { userId: studentId, courseId: exam.courseId } } });
    if (m?.role !== "STUDENT") return { error: "That student isn't in this course." };
  }
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Attach at least one photo of the answer." };
  if (files.length > 6) return { error: "Attach at most 6 photos." };

  let imageNames: string[];
  try {
    imageNames = await saveImages(files);
  } catch {
    return { error: "Couldn't read one of the photos. Use JPEG, PNG or HEIC images." };
  }
  if (!imageNames.length) return { error: "Attach at least one photo of the answer." };

  const doubt = await db.doubt.create({
    data: { examId, questionId, studentId, raisedById: user.id, note, imagePaths: JSON.stringify(imageNames) },
  });
  await runAdvisor(doubt.id);
  revalidatePath(`/exams/${examId}`, "layout");
  redirect(`/exams/${examId}/doubts/${doubt.id}`);
}

export async function rerunAdvisor(examId: string, doubtId: string) {
  await requireExam(examId, [...STAFF]);
  const doubt = await db.doubt.findFirst({ where: { id: doubtId, examId } });
  if (!doubt || doubt.status === "RESOLVED") return;
  await runAdvisor(doubtId);
  revalidatePath(`/exams/${examId}/doubts/${doubtId}`);
}

export async function escalateDoubt(examId: string, doubtId: string) {
  await requireExam(examId, [...STAFF]);
  await db.doubt.updateMany({ where: { id: doubtId, examId, status: "AI_SUGGESTED" }, data: { status: "ESCALATED" } });
  revalidatePath(`/exams/${examId}`, "layout");
}

/**
 * Settles a doubt with final marks. If the doubt is linked to a student's answer sheet, the marks
 * are written to that grade. Moderators can also publish the decision as a shared ruling.
 */
export async function resolveDoubt(
  examId: string,
  doubtId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { user, role } = await requireExam(examId, [...STAFF]);
  const doubt = await db.doubt.findFirst({
    where: { id: doubtId, examId },
    include: { question: { include: { rubricItems: true } } },
  });
  if (!doubt) return { error: "Doubt not found." };
  if (doubt.status === "RESOLVED") return { error: "This doubt is already resolved." };
  const moderator = isModerator(role);
  if (doubt.status === "ESCALATED" && !moderator) {
    return { error: "This doubt is escalated. The instructor or a Head TA will decide." };
  }
  if (!moderator && doubt.raisedById !== user.id) {
    return { error: "Only the TA who raised this doubt, or a moderator, can resolve it." };
  }

  const q = doubt.question;
  const marks = Number(formData.get("marks"));
  if (!Number.isFinite(marks) || marks < 0 || marks > q.maxMarks) {
    return { error: `Marks must be between 0 and ${q.maxMarks}.` };
  }
  const note = String(formData.get("note") ?? "").trim();
  const rulingText = String(formData.get("ruling") ?? "").trim();
  const publishRuling = moderator && formData.get("publishRuling") === "on" && rulingText.length > 0;

  if (doubt.studentId) {
    const analysis = parseJson<Partial<DoubtAdvice>>(doubt.aiAnalysis, {});
    // Tick the criteria the AI found: positive ones that were met, deductions it applied.
    // Partial credit can't be expressed as ticks, so it shows up as an override below.
    const applied = (analysis.criteria ?? [])
      .filter((c) => {
        const item = q.rubricItems.find((i) => i.id === c.rubricItemId);
        if (!item) return false;
        return item.marks > 0 ? c.status === "met" : c.marksAwarded < 0;
      })
      .map((c) => c.rubricItemId);
    const computed = rubricTotal(q.rubricItems, applied, q.maxMarks);
    const existing = await db.grade.findUnique({
      where: { questionId_studentId: { questionId: q.id, studentId: doubt.studentId } },
    });
    const allocation = await db.allocation.findUnique({
      where: { examId_studentId: { examId, studentId: doubt.studentId } },
    });
    await saveGrade({
      examId,
      questionId: q.id,
      studentId: doubt.studentId,
      graderId: existing?.graderId ?? allocation?.taId ?? doubt.raisedById,
      changedById: user.id,
      marks: clamp(marks, 0, q.maxMarks),
      appliedItemIds: applied,
      manualOverride: Math.abs(computed - marks) > 1e-9,
      reason: `Doubt resolved${note ? `: ${note}` : ""}`,
    });
  }

  await db.$transaction([
    db.doubt.update({
      where: { id: doubtId },
      data: { status: "RESOLVED", finalMarks: marks, resolutionNote: note || null, resolvedById: user.id, resolvedAt: new Date() },
    }),
    ...(publishRuling
      ? [db.ruling.create({ data: { questionId: q.id, doubtId, text: rulingText, createdById: user.id } })]
      : []),
  ]);

  revalidatePath(`/exams/${examId}`, "layout");
  return { ok: publishRuling ? "Resolved and published as a ruling for every TA." : "Resolved." };
}

export async function addDoubtComment(examId: string, doubtId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user } = await requireExam(examId, [...STAFF]);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  const doubt = await db.doubt.findFirst({ where: { id: doubtId, examId } });
  if (!doubt) return { error: "Doubt not found." };
  await db.doubtComment.create({ data: { doubtId, authorId: user.id, body: body.slice(0, 4000) } });
  revalidatePath(`/exams/${examId}/doubts/${doubtId}`);
  return { ok: undefined };
}

// ---------------------------------------------------------------------------
// Rulings

export async function createRuling(examId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA"]);
  const questionId = String(formData.get("questionId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Write the ruling." };
  const q = await db.question.findFirst({ where: { id: questionId, examId } });
  if (!q) return { error: "Pick a question." };
  await db.ruling.create({ data: { questionId, text: text.slice(0, 2000), createdById: user.id } });
  revalidatePath(`/exams/${examId}`, "layout");
  return { ok: `Ruling added to ${q.label}. Every TA now sees it while grading.` };
}

export async function deleteRuling(examId: string, rulingId: string) {
  await requireExam(examId, ["INSTRUCTOR", "HEAD_TA"]);
  await db.ruling.deleteMany({ where: { id: rulingId, question: { examId } } });
  revalidatePath(`/exams/${examId}`, "layout");
}
