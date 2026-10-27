import "server-only";
import { config } from "./config";
import { db } from "./supabase";

export async function uploadFile(path: string, data: Uint8Array | ArrayBuffer, contentType: string) {
  const { error } = await db().storage.from(config.bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed (${path}): ${error.message}`);
  return path;
}

export async function downloadFile(path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(config.bucket).download(path);
  if (error || !data) throw new Error(`Storage download failed (${path}): ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  await db().storage.from(config.bucket).remove(list);
}

export async function signedUrl(path: string, expiresInSeconds = 60 * 60, downloadName?: string) {
  const { data, error } = await db()
    .storage.from(config.bucket)
    .createSignedUrl(path, expiresInSeconds, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw new Error(`Could not sign URL: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

/** Public-facing URL served by our own image proxy route. */
export function imageUrl(path: string | null | undefined): string | null {
  return path ? `/api/image?path=${encodeURIComponent(path)}` : null;
}

export function extensionFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}
