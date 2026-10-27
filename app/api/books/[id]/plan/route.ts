import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { getBook, getCharacters, getPages } from "@/lib/books";
import { createPlan, resolveCharacterIds } from "@/lib/planner";
import { removeFiles } from "@/lib/storage";
import { check, db } from "@/lib/supabase";
import { bookView } from "@/lib/view";
import type { Book, Palette } from "@/lib/types";

export const maxDuration = 300;

/** Create (or recreate) the page-by-page plan with the text model. */
export const POST = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const body = await readJson<{ replace?: boolean }>(req).catch(() => ({ replace: false }));
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");

  const existing = await getPages(id);
  const hasArtwork = existing.some((p) => p.image_path);
  if (hasArtwork && !body.replace) {
    throw new HttpError(409, "This book already has generated pages. Confirm to replace the whole plan.");
  }
  const busy = existing.some((p) => p.status === "queued" || p.status === "generating");
  if (busy) throw new HttpError(409, "Pages are still generating. Cancel generation before re-planning.");

  await db().from("books").update({ plan_status: "planning", plan_error: null }).eq("id", id);

  try {
    const characters = await getCharacters(book.character_ids);
    const others = check(
      await db().from("books").select("palette").neq("id", id).not("palette", "is", null).limit(30),
      "Load palettes",
    ) as Pick<Book, "palette">[];

    const plan = await createPlan({
      title: book.title,
      description: book.description,
      pageCount: book.page_count,
      characters,
      avoidPalettes: others.map((b) => b.palette).filter((p): p is Palette => !!p),
    });

    // Replace pages atomically-enough: delete then insert.
    check(await db().from("pages").delete().eq("book_id", id), "Clear old plan");
    await removeFiles(existing.map((p) => p.image_path));
    check(
      await db()
        .from("pages")
        .insert(
          plan.pages.map((p, i) => ({
            book_id: id,
            position: i,
            title: p.title,
            prompt: p.scene,
            character_ids: resolveCharacterIds(p.characters, characters),
          })),
        ),
      "Save plan",
    );
    const updated = check(
      await db()
        .from("books")
        .update({
          plan_status: "ready",
          palette: plan.palette,
          cover_concept: plan.cover_concept,
          approved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single(),
      "Save plan",
    ) as Book;
    return json({ book: bookView(updated, await getPages(id)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db().from("books").update({ plan_status: existing.length ? "ready" : "failed", plan_error: message }).eq("id", id);
    throw err;
  }
});
