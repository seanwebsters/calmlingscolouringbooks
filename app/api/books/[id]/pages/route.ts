import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { getBook, getPages, normalisePositions, touchBook } from "@/lib/books";
import { check, db } from "@/lib/supabase";
import { bookView } from "@/lib/view";

/** Add a page (optionally after a given position). */
export const POST = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const body = await readJson<{ title?: string; prompt?: string; character_ids?: string[]; after?: number }>(req);
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) throw new HttpError(400, "Describe the scene for the new page.");

  const pages = await getPages(id);
  const after = typeof body.after === "number" ? body.after : pages.length - 1;
  // Make room, then insert.
  const shift = pages.filter((p) => p.position > after);
  for (const p of shift.reverse()) {
    await db().from("pages").update({ position: p.position + 1 }).eq("id", p.id);
  }
  check(
    await db()
      .from("pages")
      .insert({
        book_id: id,
        position: after + 1,
        title: (body.title ?? "").trim() || "New page",
        prompt,
        character_ids: body.character_ids ?? [],
      }),
    "Add page",
  );
  await normalisePositions(id);
  await touchBook(id);
  return json({ book: bookView((await getBook(id))!, await getPages(id)) }, 201);
});

/** Reorder pages: body.order is the full list of page ids in their new order. */
export const PUT = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const { order } = await readJson<{ order: string[] }>(req);
  const pages = await getPages(id);
  if (!Array.isArray(order) || order.length !== pages.length || !pages.every((p) => order.includes(p.id))) {
    throw new HttpError(400, "Order must list every page exactly once.");
  }
  const { error } = await db().rpc("reorder_pages", { p_book_id: id, p_page_ids: order });
  if (error) throw new Error(`Reorder pages: ${error.message}`);
  await touchBook(id);
  return json({ book: bookView((await getBook(id))!, await getPages(id)) });
});
