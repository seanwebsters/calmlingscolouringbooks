import "server-only";
import { check, db } from "./supabase";
import type { Book, BookStatusLabel, Character, Job, Page } from "./types";

export async function listCharacters(): Promise<Character[]> {
  return check(await db().from("characters").select("*").order("created_at"), "Load characters") as Character[];
}

export async function getCharacters(ids: string[]): Promise<Character[]> {
  if (ids.length === 0) return [];
  const rows = check(await db().from("characters").select("*").in("id", ids), "Load characters") as Character[];
  // Preserve requested order.
  return ids.map((id) => rows.find((r) => r.id === id)).filter((c): c is Character => !!c);
}

export async function getBook(id: string): Promise<Book | null> {
  const { data, error } = await db().from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Load book: ${error.message}`);
  return data as Book | null;
}

export async function getPages(bookId: string): Promise<Page[]> {
  return check(
    await db().from("pages").select("*").eq("book_id", bookId).order("position"),
    "Load pages",
  ) as Page[];
}

export async function getActiveJobs(bookId: string): Promise<Job[]> {
  return check(
    await db().from("jobs").select("*").eq("book_id", bookId).in("status", ["queued", "running"]),
    "Load jobs",
  ) as Job[];
}

/** Record a change to a book's pages or cover. Any such change withdraws
 *  approval so a book is only ever exported as approved in its reviewed state. */
export async function touchBook(id: string) {
  await db().from("books").update({ updated_at: new Date().toISOString(), approved_at: null }).eq("id", id);
}

/** Renumber pages 0..n-1 after deletions/insertions. */
export async function normalisePositions(bookId: string) {
  const pages = await getPages(bookId);
  const ids = pages.map((p) => p.id);
  const { error } = await db().rpc("reorder_pages", { p_book_id: bookId, p_page_ids: ids });
  if (error) throw new Error(`Reorder pages: ${error.message}`);
}

export function deriveStatus(book: Book, pages: Pick<Page, "status">[]): BookStatusLabel {
  if (book.plan_status === "planning") return "Planning";
  if (pages.length === 0) return "Draft";
  const busy =
    pages.some((p) => p.status === "queued" || p.status === "generating") ||
    book.cover_status === "queued" ||
    book.cover_status === "generating";
  if (busy) return "Generating";
  if (pages.some((p) => p.status === "failed") || book.cover_status === "failed") return "Needs attention";
  if (pages.every((p) => p.status === "pending")) return "Plan ready";
  if (pages.every((p) => p.status === "complete")) return book.approved_at ? "Approved" : "In review";
  return "In review";
}
