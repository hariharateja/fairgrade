import "server-only";
import { cache } from "react";
import { db } from "./db";
import { isModerator, type Role } from "./access";

export type TodoKind = "mark" | "scan" | "apply" | "escalated" | "crib" | "results";

export type TodoItem = {
  key: string;
  kind: TodoKind;
  title: string;
  detail: string;
  href: string;
  count: number;
  exam: string;
  course: string;
};

/**
 * Everything waiting on this user across all their courses: answer sheets to mark or scan,
 * AI suggestions to apply, escalated doubts, cribs to review, and (for students) results to check.
 */
export const getTodos = cache(async (userId: string): Promise<TodoItem[]> => {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { course: { include: { exams: { include: { _count: { select: { questions: true } } } } } } },
  });
  const items: TodoItem[] = [];

  for (const m of memberships) {
    const role = m.role as Role;
    const course = m.course.code;
    for (const exam of m.course.exams) {
      const base = `/exams/${exam.id}`;
      const push = (kind: TodoKind, count: number, title: string, detail: string, href: string) => {
        if (count > 0) items.push({ key: `${kind}-${exam.id}`, kind, title, detail, href, count, exam: exam.title, course });
      };

      if (role === "STUDENT") {
        if (exam.status === "PUBLISHED") {
          const open = !exam.cribDeadline || exam.cribDeadline.getTime() > Date.now();
          push("results", 1, "Results are out", open ? "Check your marks and raise a crib if needed" : "Check your marks", base);
        }
        continue;
      }

      if (exam.status === "GRADING" && exam._count.questions > 0) {
        const allocated = await db.allocation.findMany({ where: { examId: exam.id, taId: userId }, select: { studentId: true } });
        if (allocated.length) {
          const ids = allocated.map((a) => a.studentId);
          const [graded, scanned] = await Promise.all([
            db.grade.groupBy({ by: ["studentId"], where: { examId: exam.id, studentId: { in: ids } }, _count: true }),
            db.answerSheet.count({ where: { examId: exam.id, studentId: { in: ids } } }),
          ]);
          const marked = graded.filter((g) => g._count >= exam._count.questions).length;
          push("mark", ids.length - marked, "Answer sheets to mark", `${marked} of ${ids.length} done`, `${base}/grade?view=mine`);
          push("scan", Math.max(0, marked - scanned), "Marked but not scanned", "Upload the scanned answer sheets", `${base}/grade?view=mine`);
        }
      }

      const [toApply, escalated, cribs] = await Promise.all([
        db.doubt.count({ where: { examId: exam.id, raisedById: userId, status: "AI_SUGGESTED" } }),
        isModerator(role) ? db.doubt.count({ where: { examId: exam.id, status: "ESCALATED" } }) : Promise.resolve(0),
        db.crib.count({ where: { examId: exam.id, reviewerId: userId, status: "OPEN" } }),
      ]);
      push("apply", toApply, "AI suggestions to apply", "Review and apply the marks", `${base}/doubts?filter=mine`);
      push("escalated", escalated, "Doubts waiting for your decision", "Decide once, for every TA", `${base}/doubts?filter=escalated`);
      push("crib", cribs, "Cribs to review", "Students are waiting for a reply", `${base}/cribs?filter=mine`);
    }
  }
  return items;
});

/** Number shown on the To do badge: actionable items only (not "results are out"). */
export async function todoCount(userId: string) {
  return (await getTodos(userId)).filter((t) => t.kind !== "results").reduce((n, t) => n + t.count, 0);
}
