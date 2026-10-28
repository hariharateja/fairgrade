import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isSafeFileName, readImage } from "@/lib/files";

/**
 * Serves an uploaded answer photo. Grading staff of the exam's course can see any photo;
 * a student can only see photos they attached to their own cribs.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[name]">) {
  const { name } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !isSafeFileName(name)) return new Response("Not found", { status: 404 });

  const [doubt, crib] = await Promise.all([
    db.doubt.findFirst({ where: { imagePaths: { contains: name } }, select: { exam: { select: { courseId: true } } } }),
    db.crib.findFirst({ where: { imagePaths: { contains: name } }, select: { studentId: true, exam: { select: { courseId: true } } } }),
  ]);
  const courseId = doubt?.exam.courseId ?? crib?.exam.courseId;
  if (!courseId) return new Response("Not found", { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  const allowed = membership && (membership.role !== "STUDENT" || (crib && crib.studentId === user.id));
  if (!allowed) return new Response("Not found", { status: 404 });

  try {
    const data = await readImage(name);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
