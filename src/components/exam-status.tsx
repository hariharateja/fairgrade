import { Badge, type BadgeTone } from "./ui";

export const EXAM_STATUS: Record<string, { label: string; tone: BadgeTone; help: string }> = {
  DRAFT: { label: "Setting up", tone: "slate", help: "Add questions and the rubric before grading starts." },
  GRADING: { label: "Grading", tone: "blue", help: "TAs are grading. Students can't see marks yet." },
  PUBLISHED: { label: "Results out", tone: "green", help: "Students can see marks and raise cribs." },
  CLOSED: { label: "Closed", tone: "slate", help: "Marks are final. No more cribs." },
};

export function ExamStatusBadge({ status }: { status: string }) {
  const s = EXAM_STATUS[status] ?? EXAM_STATUS.DRAFT;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
