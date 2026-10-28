"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireExam } from "@/lib/access";
import { AiError, structureRubric } from "@/lib/ai";
import { PROVIDER_LABEL } from "@/lib/ai-providers";
import { recomputeQuestionGrades, shuffle } from "@/lib/grading";
import type { ActionResult } from "@/components/forms";

const NEXT_STATUS: Record<string, string> = { DRAFT: "GRADING", GRADING: "PUBLISHED", PUBLISHED: "CLOSED" };

export async function setExamStatus(examId: string, formData: FormData) {
  const { exam } = await requireExam(examId, ["INSTRUCTOR"]);
  const target = String(formData.get("status"));
  const allowed = [NEXT_STATUS[exam.status], exam.status === "PUBLISHED" ? "GRADING" : null, exam.status === "CLOSED" ? "PUBLISHED" : null];
  if (!allowed.includes(target)) return;
  await db.exam.update({ where: { id: examId }, data: { status: target } });
  revalidatePath(`/exams/${examId}`, "layout");
}

export async function updateExamSettings(examId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireExam(examId, ["INSTRUCTOR"]);
  const title = String(formData.get("title") ?? "").trim();
  const totalMarks = Number(formData.get("totalMarks"));
  const deadline = String(formData.get("cribDeadline") ?? "");
  if (!title || !(totalMarks > 0)) return { error: "Title and a positive total are required." };
  await db.exam.update({
    where: { id: examId },
    data: {
      title,
      totalMarks,
      blindGrading: formData.get("blindGrading") === "on",
      cribDeadline: deadline ? new Date(deadline) : null,
    },
  });
  revalidatePath(`/exams/${examId}`, "layout");
  return { ok: "Settings saved." };
}

/**
 * Randomly and evenly spreads students across TAs. With `reshuffle`, existing allocations
 * for students who have no grades yet are redistributed too.
 */
export async function allocateScripts(examId: string, formData: FormData) {
  const { exam } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA"]);
  const reshuffle = formData.get("reshuffle") === "1";
  const [graders, students, allocations, graded] = await Promise.all([
    db.membership.findMany({ where: { courseId: exam.courseId, role: { in: ["TA", "HEAD_TA"] } } }),
    db.membership.findMany({ where: { courseId: exam.courseId, role: "STUDENT" } }),
    db.allocation.findMany({ where: { examId } }),
    db.grade.findMany({ where: { examId }, select: { studentId: true }, distinct: ["studentId"] }),
  ]);
  if (!graders.length) return;
  const gradedIds = new Set(graded.map((g) => g.studentId));

  if (reshuffle) {
    await db.allocation.deleteMany({ where: { examId, studentId: { notIn: [...gradedIds] } } });
  }
  const kept = reshuffle ? allocations.filter((a) => gradedIds.has(a.studentId)) : allocations;
  const allocated = new Set(kept.map((a) => a.studentId));
  const load = new Map(graders.map((g) => [g.userId, kept.filter((a) => a.taId === g.userId).length]));

  const pending = shuffle(students.filter((s) => !allocated.has(s.userId)));
  const rows = pending.map((s) => {
    // Give each script to the currently least-loaded grader.
    const [taId] = [...load.entries()].sort((a, b) => a[1] - b[1])[0];
    load.set(taId, (load.get(taId) ?? 0) + 1);
    return { examId, studentId: s.userId, taId };
  });
  if (rows.length) await db.allocation.createMany({ data: rows });
  revalidatePath(`/exams/${examId}`, "layout");
}

// ---------------------------------------------------------------------------
// Questions & rubric

export async function addQuestion(examId: string) {
  await requireExam(examId, ["INSTRUCTOR"]);
  const count = await db.question.count({ where: { examId } });
  await db.question.create({
    data: { examId, label: `Q${count + 1}`, order: count, maxMarks: 5 },
  });
  revalidatePath(`/exams/${examId}/rubric`);
}

export async function deleteQuestion(examId: string, questionId: string) {
  await requireExam(examId, ["INSTRUCTOR"]);
  const graded = await db.grade.count({ where: { questionId } });
  if (graded > 0) return;
  await db.question.delete({ where: { id: questionId, examId } });
  revalidatePath(`/exams/${examId}/rubric`);
}

export async function saveQuestion(
  examId: string,
  questionId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireExam(examId, ["INSTRUCTOR"]);
  const question = await db.question.findUnique({
    where: { id: questionId, examId },
    include: { rubricItems: true },
  });
  if (!question) return { error: "Question not found." };

  const label = String(formData.get("label") ?? "").trim();
  const maxMarks = Number(formData.get("maxMarks"));
  if (!label || !(maxMarks > 0)) return { error: "Label and positive max marks are required." };

  const ids = formData.getAll("itemId").map(String);
  const descs = formData.getAll("itemDesc").map(String);
  const marks = formData.getAll("itemMarks").map(String);
  const deleted = new Set(formData.getAll("deleteItem").map(String));

  type Row = { id: string; description: string; marks: number };
  const rows: Row[] = [];
  for (let i = 0; i < descs.length; i++) {
    const description = descs[i].trim();
    if (!description) continue;
    const value = Number(marks[i]);
    if (!Number.isFinite(value) || value === 0) {
      return { error: `Give "${description}" a non-zero mark (negative for a deduction).` };
    }
    rows.push({ id: ids[i] ?? "", description, marks: value });
  }

  await db.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: questionId },
      data: {
        label,
        maxMarks,
        prompt: String(formData.get("prompt") ?? ""),
        modelAnswer: String(formData.get("modelAnswer") ?? ""),
      },
    });
    for (const item of question.rubricItems) {
      if (deleted.has(item.id)) await tx.rubricItem.delete({ where: { id: item.id } });
    }
    let order = 0;
    for (const row of rows) {
      if (row.id && deleted.has(row.id)) continue;
      if (row.id && question.rubricItems.some((i) => i.id === row.id)) {
        await tx.rubricItem.update({
          where: { id: row.id },
          data: { description: row.description, marks: row.marks, order: order++ },
        });
      } else if (!row.id) {
        await tx.rubricItem.create({
          data: { questionId, description: row.description, marks: row.marks, order: order++ },
        });
      }
    }
  });

  const updated = await recomputeQuestionGrades(questionId, user.id);
  const positive = rows.filter((r) => !deleted.has(r.id) && r.marks > 0).reduce((s, r) => s + r.marks, 0);
  const notes: string[] = [];
  if (rows.length && Math.abs(positive - maxMarks) > 1e-6) {
    notes.push(`Positive criteria add up to ${positive}, but ${label} is worth ${maxMarks}. Marks are capped at ${maxMarks}.`);
  }
  revalidatePath(`/exams/${examId}`, "layout");
  return {
    ok: updated ? `Saved. ${updated} already-graded script${updated === 1 ? "" : "s"} recalculated with the new rubric.` : "Saved.",
    notes,
  };
}

export async function importRubric(examId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { exam } = await requireExam(examId, ["INSTRUCTOR"]);
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");
  const replace = formData.get("replace") === "on";

  let upload: { base64: string; mediaType: string } | undefined;
  if (file instanceof File && file.size > 0) {
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { error: "Upload a PDF, JPEG, PNG or WebP file." };
    }
    // Hosting platforms cap request bodies at ~4.5 MB (Vercel).
    if (file.size > 4 * 1024 * 1024) return { error: "File is larger than 4 MB. Compress the PDF or paste the text instead." };
    upload = { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: file.type };
  }
  if (!text && !upload) return { error: "Paste the rubric text or upload a file." };

  let result;
  try {
    result = await structureRubric({ text, file: upload, totalMarks: exam.totalMarks });
  } catch (error) {
    if (error instanceof AiError) return { error: error.message };
    throw error;
  }
  const { rubric, mode } = result;
  if (!rubric.questions.length) return { error: "No questions were found in the rubric.", notes: rubric.warnings };

  if (replace) {
    const graded = await db.grade.count({ where: { examId } });
    if (graded > 0) return { error: "Grading has started, so existing questions can't be replaced." };
    await db.question.deleteMany({ where: { examId } });
  }
  const start = await db.question.count({ where: { examId } });
  for (const [i, q] of rubric.questions.entries()) {
    await db.question.create({
      data: {
        examId,
        label: q.label,
        order: start + i,
        maxMarks: q.maxMarks > 0 ? q.maxMarks : 1,
        prompt: q.prompt,
        modelAnswer: q.modelAnswer,
        rubricItems: {
          create: q.rubric
            .filter((r) => r.description.trim() && r.marks !== 0)
            .map((r, order) => ({ description: r.description, marks: r.marks, order })),
        },
      },
    });
  }
  revalidatePath(`/exams/${examId}`, "layout");
  return {
    ok: `Imported ${rubric.questions.length} question${rubric.questions.length === 1 ? "" : "s"}${mode !== "demo" ? ` with ${PROVIDER_LABEL[mode]}` : ""}. Review them below before grading starts.`,
    notes: rubric.warnings,
  };
}
