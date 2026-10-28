import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getObject, signedDownloadUrl } from "@/lib/storage";

/**
 * Opens a scanned answer sheet. Grading staff of the course can open any sheet; a student
 * can open their own once results are published. On Supabase we redirect to a 5-minute
 * signed URL (PDFs can exceed Vercel's response size limit); locally we stream the file.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/sheets/[sheetId]">) {
  const { sheetId } = await ctx.params;
  const user = await getCurrentUser();
  const notFound = new Response("Not found", { status: 404 });
  if (!user) return notFound;

  const sheet = await db.answerSheet.findUnique({
    where: { id: sheetId },
    include: { exam: { select: { courseId: true, status: true, title: true } }, student: { select: { rollNo: true } } },
  });
  if (!sheet) return notFound;
  const membership = await db.membership.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: sheet.exam.courseId } },
  });
  const isOwner = sheet.studentId === user.id && ["PUBLISHED", "CLOSED"].includes(sheet.exam.status);
  if (!membership || (membership.role === "STUDENT" && !isOwner)) return notFound;

  const url = await signedDownloadUrl(sheet.fileName, 300);
  if (url) return Response.redirect(url, 302);

  const data = await getObject(sheet.fileName);
  const filename = `${sheet.student.rollNo ?? "answer-sheet"}-${sheet.exam.title}.pdf`.replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
