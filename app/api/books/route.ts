import { handler, json, readJson } from "@/lib/api";
import { validateBookInput, type CreateBookBody } from "@/lib/validate";
import { deriveStatus } from "@/lib/books";
import { imageUrl } from "@/lib/storage";
import { check, db } from "@/lib/supabase";
import type { Book, Page } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const rows = check(
    await db().from("books").select("*, pages(status)").order("updated_at", { ascending: false }),
    "Load books",
  ) as (Book & { pages: Pick<Page, "status">[] })[];
  return json({
    books: rows.map(({ pages, ...book }) => ({
      id: book.id,
      title: book.title,
      description: book.description,
      page_size: book.page_size,
      page_count: pages.length || book.page_count,
      pages_complete: pages.filter((p) => p.status === "complete").length,
      palette: book.palette,
      cover_url: imageUrl(book.cover_image_path),
      cover_settings: book.cover_settings,
      status_label: deriveStatus(book, pages),
      updated_at: book.updated_at,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const input = validateBookInput(await readJson<CreateBookBody>(req));
  const book = check(
    await db()
      .from("books")
      .insert({ ...input, cover_settings: { title: input.title, font: "serif", position: "top", showLogo: true, panel: false, textColor: "#1F2A44" } })
      .select("*")
      .single(),
    "Create book",
  ) as Book;
  return json({ book }, 201);
});
