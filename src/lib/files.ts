import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getObject, putObject } from "./storage";

const MAX_EDGE = 1568; // Vision models' sweet spot; larger images are downscaled anyway.

/**
 * Stores uploaded photos as normalized JPEGs (auto-rotated, downscaled) and returns
 * their stored file names. Non-image files are ignored.
 */
export async function saveImages(files: File[]): Promise<string[]> {
  const names: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0 || !file.type.startsWith("image/")) continue;
    const input = Buffer.from(await file.arrayBuffer());
    const output = await sharp(input)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const name = `${randomUUID()}.jpg`;
    await putObject(name, output);
    names.push(name);
  }
  return names;
}

export function isSafeFileName(name: string) {
  return /^[0-9a-f-]{36}\.jpg$/.test(name);
}

export async function readImage(name: string) {
  if (!isSafeFileName(name)) throw new Error("Invalid file name");
  return getObject(name);
}

export async function readImageBase64(name: string) {
  return (await readImage(name)).toString("base64");
}
