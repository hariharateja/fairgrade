import { createHash, randomBytes } from "node:crypto";

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function fmt(marks: number | null | undefined) {
  if (marks === null || marks === undefined || Number.isNaN(marks)) return "–";
  return Number.isInteger(marks) ? String(marks) : marks.toFixed(1);
}

export function joinCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

/** Stable anonymous label for a student within one exam, used in blind grading. */
export function sheetCode(examId: string, studentId: string) {
  const hash = createHash("sha256").update(`${examId}:${studentId}`).digest("hex");
  return `S-${hash.slice(0, 6).toUpperCase()}`;
}

export function studentLabel(
  exam: { id: string; blindGrading: boolean },
  student: { id: string; name: string; rollNo: string | null },
  revealToModerator = false,
) {
  if (exam.blindGrading && !revealToModerator) return sheetCode(exam.id, student.id);
  return student.rollNo ? `${student.rollNo} · ${student.name}` : student.name;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function isPast(date: Date) {
  return date.getTime() < Date.now();
}

export function timeAgo(date: Date) {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
