import { Badge, type BadgeTone } from "./ui";

export const EXAM_STATUS: Record<string, { label: string; tone: BadgeTone; help: string }> = {
  DRAFT: { label: "Setting up", tone: "slate", help: "Add questions and the rubric before grading starts." },
  GRADING: { label: "Grading", tone: "blue", help: "TAs are grading. Students can't see marks yet." },
  PUBLISHED: { label: "Results out", tone: "green", help: "Students can see marks and raise cribs." },
  CLOSED: { label: "Closed", tone: "slate", help: "Marks are final. No more cribs." },
};

/** How each stage reads to a student, who only cares whether marks are out. */
export const STUDENT_EXAM_STATUS: Record<string, { label: string; tone: BadgeTone; help: string }> = {
  DRAFT: { label: "Upcoming", tone: "slate", help: "Your instructor is setting this exam up." },
  GRADING: { label: "Being graded", tone: "blue", help: "Your answer sheet is being graded. Marks appear here once results are published." },
  PUBLISHED: { label: "Results out", tone: "green", help: "Your marks are out. Check them and raise a crib if something looks wrong." },
  CLOSED: { label: "Final", tone: "slate", help: "Marks are final and the crib window is closed." },
};

export function ExamStatusBadge({ status, student = false }: { status: string; student?: boolean }) {
  const table = student ? STUDENT_EXAM_STATUS : EXAM_STATUS;
  const s = table[status] ?? table.DRAFT;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
