"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireExam, canEditGrades } from "@/lib/access";
import { MAX_SHEET_BYTES, createUploadTarget, deleteObject, objectSize, type UploadTarget } from "@/lib/storage";

type StartResult = { error: string } | { target: UploadTarget; name: string };

async function checkAccess(examId: string, studentId: string) {
  const { user, exam, role } = await requireExam(examId, ["INSTRUCTOR", "HEAD_TA", "TA"]);
  if (!canEditGrades(role, exam.status)) {
    return { error: exam.status === "DRAFT" ? "Grading hasn't started yet." : "Answer sheets are locked for this exam." } as const;
  }
  const m = await db.membership.findUnique({ where: { userId_courseId: { userId: studentId, courseId: exam.courseId } } });
  if (m?.role !== "STUDENT") return { error: "Student not found in this course." } as const;
  return { user } as const;
}

/** Step 1: hands the browser a signed URL to upload the PDF to directly. */
export async function startSheetUpload(examId: string, studentId: string, sizeBytes: number, contentType: string): Promise<StartResult> {
  const access = await checkAccess(examId, studentId);
  if ("error" in access) return { error: access.error! };
  if (contentType !== "application/pdf") return { error: "Upload the answer sheet as a PDF." };
  if (!(sizeBytes > 0)) return { error: "The file is empty." };
  if (sizeBytes > MAX_SHEET_BYTES) {
    return { error: `The PDF is ${(sizeBytes / 1048576).toFixed(1)} MB. The limit is ${MAX_SHEET_BYTES / 1048576} MB; scan in black-and-white or lower resolution.` };
  }
  const name = `sheet-${randomUUID()}.pdf`;
  try {
    return { target: await createUploadTarget(name, contentType), name };
  } catch (error) {
    console.error(error);
    return { error: "Couldn't prepare the upload. Try again." };
  }
}

/** Step 2: after the browser's upload succeeds, records it and replaces any earlier scan. */
export async function finishSheetUpload(examId: string, studentId: string, name: string): Promise<{ error?: string; ok?: string }> {
  const access = await checkAccess(examId, studentId);
  if ("error" in access) return { error: access.error! };
  if (!/^sheet-[0-9a-f-]{36}\.pdf$/.test(name)) return { error: "Invalid upload." };

  const size = await objectSize(name);
  if (size === null) return { error: "The upload didn't arrive. Try again." };

  const previous = await db.answerSheet.findUnique({ where: { examId_studentId: { examId, studentId } } });
  await db.answerSheet.upsert({
    where: { examId_studentId: { examId, studentId } },
    create: { examId, studentId, fileName: name, sizeBytes: size, uploadedById: access.user.id },
    update: { fileName: name, sizeBytes: size, uploadedById: access.user.id },
  });
  if (previous && previous.fileName !== name) await deleteObject(previous.fileName);

  revalidatePath(`/exams/${examId}`, "layout");
  return { ok: previous ? "Scan replaced." : "Scan uploaded." };
}
