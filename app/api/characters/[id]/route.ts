import { handler, HttpError, json, type IdParams } from "@/lib/api";
import { extensionFor, removeFiles, uploadFile } from "@/lib/storage";
import { check, db } from "@/lib/supabase";
import { readImageUpload } from "@/lib/upload";
import { characterView } from "@/lib/view";
import type { Character } from "@/lib/types";

export const PATCH = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const existing = (await db().from("characters").select("*").eq("id", id).maybeSingle()).data as Character | null;
  if (!existing) throw new HttpError(404, "Character not found.");

  const form = await req.formData();
  const update: Partial<Character> = { updated_at: new Date().toISOString() };
  if (form.has("name")) {
    const name = String(form.get("name")).trim();
    if (!name) throw new HttpError(400, "Name cannot be empty.");
    update.name = name;
  }
  if (form.has("description")) update.description = String(form.get("description")).trim();
  let oldPath: string | null = null;
  const file = form.get("file");
  if (file && typeof file !== "string" && file.size > 0) {
    const img = await readImageUpload(file);
    update.image_path = `characters/${crypto.randomUUID()}.${extensionFor(img.mime)}`;
    update.mime_type = img.mime;
    await uploadFile(update.image_path, img.bytes, img.mime);
    oldPath = existing.image_path;
  }
  const row = check(await db().from("characters").update(update).eq("id", id).select("*").single(), "Update character") as Character;
  await removeFiles([oldPath]);
  return json({ character: characterView(row) });
});

export const DELETE = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const existing = (await db().from("characters").select("*").eq("id", id).maybeSingle()).data as Character | null;
  if (!existing) throw new HttpError(404, "Character not found.");
  check(await db().from("characters").delete().eq("id", id), "Delete character");
  await removeFiles([existing.image_path]);
  return json({ ok: true });
});
