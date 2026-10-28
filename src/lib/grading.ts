import "server-only";
import { db } from "./db";
import { clamp, parseJson } from "./utils";
import type { QuestionContext } from "./ai";

/** Total for a question from the rubric criteria a grader ticked, kept within 0..max. */
export function rubricTotal(items: { id: string; marks: number }[], appliedIds: string[], maxMarks: number) {
  const sum = items.filter((i) => appliedIds.includes(i.id)).reduce((s, i) => s + i.marks, 0);
  return clamp(Math.round(sum * 100) / 100, 0, maxMarks);
}

/**
 * Writes a grade, recording an audit entry whenever an existing mark changes.
 * Returns the saved grade.
 */
export async function saveGrade(input: {
  examId: string;
  questionId: string;
  studentId: string;
  graderId: string; // who is responsible for this grade
  changedById: string; // who made this change
  marks: number;
  appliedItemIds: string[];
  manualOverride: boolean;
  comment?: string;
  reason: string;
}) {
  const existing = await db.grade.findUnique({
    where: { questionId_studentId: { questionId: input.questionId, studentId: input.studentId } },
  });
  const data = {
    marks: input.marks,
    appliedItemIds: JSON.stringify(input.appliedItemIds),
    manualOverride: input.manualOverride,
    ...(input.comment !== undefined ? { comment: input.comment } : {}),
  };
  if (!existing) {
    return db.grade.create({
      data: {
        ...data,
        examId: input.examId,
        questionId: input.questionId,
        studentId: input.studentId,
        graderId: input.graderId,
      },
    });
  }
  const [grade] = await db.$transaction([
    db.grade.update({ where: { id: existing.id }, data }),
    ...(existing.marks !== input.marks
      ? [
          db.gradeHistory.create({
            data: {
              gradeId: existing.id,
              oldMarks: existing.marks,
              newMarks: input.marks,
              changedById: input.changedById,
              reason: input.reason,
            },
          }),
        ]
      : []),
  ]);
  return grade;
}

/**
 * After a rubric edit, recomputes every grade on the question that was computed from the
 * rubric (not manually overridden), so earlier-graded answer sheets stay consistent with later ones.
 */
export async function recomputeQuestionGrades(questionId: string, changedById: string) {
  const question = await db.question.findUniqueOrThrow({
    where: { id: questionId },
    include: { rubricItems: true },
  });
  const grades = await db.grade.findMany({ where: { questionId, manualOverride: false } });
  let changed = 0;
  for (const grade of grades) {
    const applied = parseJson<string[]>(grade.appliedItemIds, []).filter((id) =>
      question.rubricItems.some((i) => i.id === id),
    );
    const marks = rubricTotal(question.rubricItems, applied, question.maxMarks);
    if (marks !== grade.marks || applied.length !== parseJson<string[]>(grade.appliedItemIds, []).length) {
      await saveGrade({
        examId: grade.examId,
        questionId,
        studentId: grade.studentId,
        graderId: grade.graderId,
        changedById,
        marks,
        appliedItemIds: applied,
        manualOverride: false,
        reason: "Rubric updated by instructor",
      });
      changed++;
    }
  }
  return changed;
}

/** Everything the AI needs to know about a question, including staff rulings. */
export async function questionContext(questionId: string): Promise<QuestionContext> {
  const q = await db.question.findUniqueOrThrow({
    where: { id: questionId },
    include: {
      rubricItems: { orderBy: { order: "asc" } },
      rulings: { orderBy: { createdAt: "asc" } },
    },
  });
  return {
    label: q.label,
    maxMarks: q.maxMarks,
    prompt: q.prompt,
    modelAnswer: q.modelAnswer,
    rubric: q.rubricItems.map((r) => ({ id: r.id, description: r.description, marks: r.marks })),
    rulings: q.rulings.map((r) => r.text),
  };
}

/** Fisher-Yates shuffle; random allocation is what makes per-TA averages comparable. */
export function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
