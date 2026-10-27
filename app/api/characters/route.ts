import { handler, HttpError, json } from "@/lib/api";
import { listCharacters } from "@/lib/books";
import { extensionFor, uploadFile } from "@/lib/storage";
import { check, db } from "@/lib/supabase";
import { readImageUpload } from "@/lib/upload";
import { characterView } from "@/lib/view";
import type { Character } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const chars = await listCharacters();
  return json({ characters: chars.map(characterView) });
});

export const POST = handler(async (req: Request) => {
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  if (!name) throw new HttpError(400, "Please give the character a name.");
  const img = await readImageUpload(form.get("file"));

  const path = `characters/${crypto.randomUUID()}.${extensionFor(img.mime)}`;
  await uploadFile(path, img.bytes, img.mime);
  const row = check(
    await db().from("characters").insert({ name, description, image_path: path, mime_type: img.mime }).select("*").single(),
    "Save character",
  ) as Character;
  return json({ character: characterView(row) }, 201);
});
