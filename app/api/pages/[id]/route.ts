import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { normalisePositions, touchBook } from "@/lib/books";
import { removeFiles } from "@/lib/storage";
import { check, db } from "@/lib/supabase";
import { pageView } from "@/lib/view";
import type { Page } from "@/lib/types";

async function load(id: string) {
  const page = (await db().from("pages").select("*").eq("id", id).maybeSingle()).data as Page | null;
  if (!page) throw new HttpError(404, "Page not found.");
  return page;
}

export const PATCH = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const page = await load(id);
  const body = await readJson<{ title?: string; prompt?: string; character_ids?: string[] }>(req);
  const update: Partial<Page> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.prompt !== undefined) {
    if (!body.prompt.trim()) throw new HttpError(400, "The page prompt cannot be empty.");
    update.prompt = body.prompt.trim();
  }
  if (body.character_ids !== undefined) update.character_ids = body.character_ids;
  const row = check(await db().from("pages").update(update).eq("id", id).select("*").single(), "Update page") as Page;
  await touchBook(page.book_id);
  return json({ page: pageView(row) });
});

export const DELETE = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const page = await load(id);
  // Cancel any waiting job; a running one will notice the page is gone.
  await db().from("jobs").update({ status: "cancelled" }).eq("page_id", id).eq("status", "queued");
  check(await db().from("pages").delete().eq("id", id), "Delete page");
  await removeFiles([page.image_path]);
  await normalisePositions(page.book_id);
  await touchBook(page.book_id);
  return json({ ok: true });
});
