import { MAX_SHEET_BYTES, putObject, storageDriver, verifyLocalUploadToken } from "@/lib/storage";

/**
 * Local-development stand-in for Supabase's signed upload URLs: the browser PUTs the file
 * here with a short-lived signed token. Disabled when Supabase Storage is configured.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/upload/[token]">) {
  if (storageDriver() !== "local") return new Response("Not found", { status: 404 });
  const { token } = await ctx.params;
  let target;
  try {
    target = await verifyLocalUploadToken(token);
  } catch {
    return new Response("Upload link expired", { status: 403 });
  }
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0 || body.length > MAX_SHEET_BYTES) return new Response("Bad size", { status: 413 });
  await putObject(target.name, body, target.contentType);
  return new Response(null, { status: 204 });
}
