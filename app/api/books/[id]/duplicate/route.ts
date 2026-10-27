import { handler, HttpError, json, type IdParams } from "@/lib/api";
import { getBook } from "@/lib/books";
import { check, db } from "@/lib/supabase";
import type { Book } from "@/lib/types";

function sequelTitle(title: string) {
  const m = /^(.*?)(?:\s*[—-]\s*)?Volume\s+(\d+)$/i.exec(title);
  if (m) return `${m[1].trim()} — Volume ${Number(m[2]) + 1}`;
  return `${title} — Volume 2`;
}

/** Start a sequel: same characters, size and length; a fresh plan, cover and
 *  palette are created when the sequel is planned. */
export const POST = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const title = sequelTitle(book.title);
  const copy = check(
    await db()
      .from("books")
      .insert({
        title,
        description: book.description,
        page_size: book.page_size,
        page_count: book.page_count,
        character_ids: book.character_ids,
        cover_settings: { ...book.cover_settings, title },
        parent_book_id: book.id,
      })
      .select("*")
      .single(),
    "Duplicate book",
  ) as Book;
  return json({ book: copy }, 201);
});
