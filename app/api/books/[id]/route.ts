import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { getBook, getPages } from "@/lib/books";
import { db, check } from "@/lib/supabase";
import { removeFiles } from "@/lib/storage";
import { bookView } from "@/lib/view";
import type { Book, CoverSettings, Palette } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  return json({ book: bookView(book, await getPages(id)) });
});

type PatchBody = {
  title?: string;
  description?: string;
  character_ids?: string[];
  page_count?: number;
  page_size?: "letter" | "square";
  cover_settings?: CoverSettings;
  cover_concept?: string;
  cover_prompt?: string;
  palette?: Palette;
  approved?: boolean;
};

export const PATCH = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const body = await readJson<PatchBody>(req);
  const update: Partial<Book> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    if (!body.title.trim()) throw new HttpError(400, "Title cannot be empty.");
    update.title = body.title.trim();
  }
  if (body.description !== undefined) update.description = body.description;
  if (body.character_ids !== undefined) update.character_ids = body.character_ids;
  if (body.page_count !== undefined) {
    if (![10, 20, 30, 40].includes(body.page_count)) throw new HttpError(400, "Page count must be 10, 20, 30 or 40.");
    update.page_count = body.page_count;
  }
  if (body.page_size !== undefined) update.page_size = body.page_size === "square" ? "square" : "letter";
  if (body.cover_settings !== undefined) update.cover_settings = { ...book.cover_settings, ...body.cover_settings };
  if (body.cover_concept !== undefined) update.cover_concept = body.cover_concept;
  if (body.cover_prompt !== undefined) update.cover_prompt = body.cover_prompt;
  if (body.palette !== undefined) update.palette = body.palette;
  if (body.approved !== undefined) update.approved_at = body.approved ? new Date().toISOString() : null;
  else if (body.cover_settings !== undefined || body.title !== undefined) update.approved_at = null; // reviewed output changed

  const row = check(await db().from("books").update(update).eq("id", id).select("*").single(), "Update book") as Book;
  return json({ book: bookView(row, await getPages(id)) });
});

export const DELETE = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const pages = await getPages(id);
  check(await db().from("books").delete().eq("id", id), "Delete book");
  await removeFiles([book.cover_image_path, ...pages.map((p) => p.image_path)]);
  return json({ ok: true });
});
