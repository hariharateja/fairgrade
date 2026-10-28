import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT, jwtVerify } from "jose";

/**
 * Where answer photos and scanned answer sheets live.
 *  - Supabase Storage (private bucket) when SUPABASE_URL and a secret key are set: required on Vercel.
 *  - The local `uploads/` folder otherwise, for offline development.
 * Files are never public. The app streams small photos itself, and hands out short-lived
 * signed URLs for large PDFs (which also upload directly from the browser, bypassing
 * Vercel's ~4.5 MB request limit).
 *
 * Deliberately free of `server-only` so the seed script can use it too.
 */

const BUCKET = process.env.SUPABASE_BUCKET || "answer-photos";
const LOCAL_DIR = path.join(process.cwd(), "uploads");

export const MAX_SHEET_BYTES = 30 * 1024 * 1024;

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function storageDriver(): "supabase" | "local" {
  return process.env.SUPABASE_URL && supabaseKey() ? "supabase" : "local";
}

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function supabase() {
  client ??= createClient(process.env.SUPABASE_URL!, supabaseKey()!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: MAX_SHEET_BYTES,
  allowedMimeTypes: ["image/jpeg", "application/pdf"],
};

/** Creates (or updates the limits of) the private bucket on first use, so no manual setup is needed. */
function ensureBucket() {
  bucketReady ??= (async () => {
    const { data } = await supabase().storage.getBucket(BUCKET);
    const { error } = data
      ? await supabase().storage.updateBucket(BUCKET, BUCKET_CONFIG)
      : await supabase().storage.createBucket(BUCKET, BUCKET_CONFIG);
    if (error && !/already exists/i.test(error.message)) {
      bucketReady = null;
      throw new Error(`Could not set up storage bucket "${BUCKET}": ${error.message}`);
    }
  })();
  return bucketReady;
}

export async function putObject(name: string, body: Buffer, contentType = "image/jpeg") {
  if (storageDriver() === "local") {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, name), body);
    return;
  }
  await ensureBucket();
  // Supabase's edge occasionally returns transient 5xx errors; retry those a couple of times.
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase().storage.from(BUCKET).upload(name, body, { contentType, upsert: true });
    if (!error) return;
    const transient = /\b5\d\d\b|fetch failed|network/i.test(error.message);
    if (!transient || attempt >= 3) throw new Error(`Upload failed: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

export async function getObject(name: string): Promise<Buffer> {
  if (storageDriver() === "local") return readFile(path.join(LOCAL_DIR, name));
  const { data, error } = await supabase().storage.from(BUCKET).download(name);
  if (error || !data) throw new Error(`File not found: ${name}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Size in bytes, or null if the object doesn't exist. */
export async function objectSize(name: string): Promise<number | null> {
  if (storageDriver() === "local") {
    try {
      return (await stat(path.join(LOCAL_DIR, name))).size;
    } catch {
      return null;
    }
  }
  const { data, error } = await supabase().storage.from(BUCKET).list("", { search: name, limit: 5 });
  if (error) throw new Error(`Could not check upload: ${error.message}`);
  const file = data?.find((f) => f.name === name);
  return file ? Number(file.metadata?.size ?? 0) : null;
}

export async function deleteObject(name: string) {
  if (storageDriver() === "local") {
    await unlink(path.join(LOCAL_DIR, name)).catch(() => {});
    return;
  }
  await supabase().storage.from(BUCKET).remove([name]);
}

// ---------------------------------------------------------------------------
// Direct browser uploads and signed downloads

function uploadSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

export type UploadTarget = { url: string; headers: Record<string, string> };

/** A one-off URL the browser can PUT a file to directly. Valid for a short time. */
export async function createUploadTarget(name: string, contentType: string): Promise<UploadTarget> {
  if (storageDriver() === "local") {
    const token = await new SignJWT({ name, contentType })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(uploadSecret());
    return { url: `/api/upload/${token}`, headers: { "content-type": contentType } };
  }
  await ensureBucket();
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUploadUrl(name, { upsert: true });
  if (error || !data) throw new Error(`Could not prepare upload: ${error?.message}`);
  return { url: data.signedUrl, headers: { "content-type": contentType, "x-upsert": "true" } };
}

/** Verifies a local-driver upload token and returns the object name it allows. */
export async function verifyLocalUploadToken(token: string) {
  const { payload } = await jwtVerify(token, uploadSecret());
  return { name: String(payload.name), contentType: String(payload.contentType) };
}

/** A short-lived URL to download a private file, or null for the local driver (stream it instead). */
export async function signedDownloadUrl(name: string, seconds = 300, downloadAs?: string) {
  if (storageDriver() === "local") return null;
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrl(name, seconds, downloadAs ? { download: downloadAs } : undefined);
  if (error || !data) throw new Error(`Could not open file: ${error?.message}`);
  return data.signedUrl;
}

/** Deletes every stored file. Only the seed script calls this. */
export async function clearAllObjects() {
  if (storageDriver() === "local") {
    await rm(LOCAL_DIR, { recursive: true, force: true });
    return;
  }
  await ensureBucket();
  const bucket = supabase().storage.from(BUCKET);
  for (;;) {
    const { data, error } = await bucket.list("", { limit: 1000 });
    if (error) throw new Error(`Could not list files: ${error.message}`);
    const names = (data ?? []).map((f) => f.name).filter((n) => n && n !== ".emptyFolderPlaceholder");
    if (!names.length) return;
    const { error: removeError } = await bucket.remove(names);
    if (removeError) throw new Error(`Could not delete files: ${removeError.message}`);
  }
}
