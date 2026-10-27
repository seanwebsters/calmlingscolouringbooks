import { handler, json, type IdParams } from "@/lib/api";
import { getPages } from "@/lib/books";
import { db } from "@/lib/supabase";

/** Cancel waiting jobs. Pages fall back to their previous artwork if they had
 *  one; otherwise back to "pending". Running generations finish but are kept. */
export const POST = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  await db().from("jobs").update({ status: "cancelled" }).eq("book_id", id).eq("status", "queued");
  const pages = await getPages(id);
  for (const p of pages.filter((p) => p.status === "queued")) {
    await db()
      .from("pages")
      .update({ status: p.image_path ? "complete" : "pending", current_job_id: null, error: null })
      .eq("id", p.id);
  }
  const { data: book } = await db().from("books").select("cover_status, cover_image_path").eq("id", id).single();
  if (book?.cover_status === "queued") {
    await db()
      .from("books")
      .update({ cover_status: book.cover_image_path ? "complete" : "none", cover_job_id: null, cover_error: null })
      .eq("id", id);
  }
  return json({ ok: true });
});
