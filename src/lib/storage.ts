import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Where answer photos live.
 *  - Supabase Storage (private bucket) when SUPABASE_URL and a secret key are set: required on Vercel.
 *  - The local `uploads/` folder otherwise, for offline development.
 * Photos are never public; the app streams them through /api/files after checking permissions.
 *
 * Deliberately free of `server-only` so the seed script can use it too.
 */

const BUCKET = process.env.SUPABASE_BUCKET || "answer-photos";
const LOCAL_DIR = path.join(process.cwd(), "uploads");

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

/** Creates the private bucket on first use, so a fresh Supabase project needs no manual setup. */
function ensureBucket() {
  bucketReady ??= (async () => {
    const { data } = await supabase().storage.getBucket(BUCKET);
    if (data) return;
    const { error } = await supabase().storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/jpeg"],
    });
    if (error && !/already exists/i.test(error.message)) {
      bucketReady = null;
      throw new Error(`Could not create storage bucket "${BUCKET}": ${error.message}`);
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
  const { error } = await supabase().storage.from(BUCKET).upload(name, body, { contentType, upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
}

export async function getObject(name: string): Promise<Buffer> {
  if (storageDriver() === "local") return readFile(path.join(LOCAL_DIR, name));
  const { data, error } = await supabase().storage.from(BUCKET).download(name);
  if (error || !data) throw new Error(`Photo not found: ${name}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Deletes every stored photo. Only the seed script calls this. */
export async function clearAllObjects() {
  if (storageDriver() === "local") {
    await rm(LOCAL_DIR, { recursive: true, force: true });
    return;
  }
  await ensureBucket();
  const bucket = supabase().storage.from(BUCKET);
  for (;;) {
    const { data, error } = await bucket.list("", { limit: 1000 });
    if (error) throw new Error(`Could not list photos: ${error.message}`);
    const names = (data ?? []).map((f) => f.name).filter((n) => n && n !== ".emptyFolderPlaceholder");
    if (!names.length) return;
    const { error: removeError } = await bucket.remove(names);
    if (removeError) throw new Error(`Could not delete photos: ${removeError.message}`);
  }
}
