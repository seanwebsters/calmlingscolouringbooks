import { handler, json } from "@/lib/api";
import { extensionFor, imageUrl, removeFiles, uploadFile } from "@/lib/storage";
import { check, db } from "@/lib/supabase";
import { readImageUpload } from "@/lib/upload";

export const dynamic = "force-dynamic";

type Brand = { logo_path: string | null; logo_mime_type: string | null };

async function current(): Promise<Brand> {
  const row = (await db().from("brand_settings").select("logo_path, logo_mime_type").eq("id", 1).maybeSingle()).data as Brand | null;
  return row ?? { logo_path: null, logo_mime_type: null };
}

export const GET = handler(async () => {
  const brand = await current();
  return json({ logo_url: imageUrl(brand.logo_path) });
});

export const POST = handler(async (req: Request) => {
  const form = await req.formData();
  // PDF embedding supports PNG and JPEG only.
  const img = await readImageUpload(form.get("file"), ["image/png", "image/jpeg"]);
  const path = `brand/logo-${Date.now()}.${extensionFor(img.mime)}`;
  await uploadFile(path, img.bytes, img.mime);
  const before = await current();
  check(
    await db().from("brand_settings").upsert({ id: 1, logo_path: path, logo_mime_type: img.mime, updated_at: new Date().toISOString() }),
    "Save logo",
  );
  await removeFiles([before.logo_path]);
  return json({ logo_url: imageUrl(path) });
});

export const DELETE = handler(async () => {
  const before = await current();
  check(await db().from("brand_settings").upsert({ id: 1, logo_path: null, logo_mime_type: null }), "Remove logo");
  await removeFiles([before.logo_path]);
  return json({ logo_url: null });
});
