import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { getBook, getPages } from "@/lib/books";
import { buildCoverPdf, buildInteriorPdf } from "@/lib/pdf";
import { assessReadiness } from "@/lib/readiness";
import { downloadFile, signedUrl, uploadFile } from "@/lib/storage";
import { db } from "@/lib/supabase";

export const maxDuration = 300;

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "book";
}

/** Build a PDF, store it, and return a signed download link. PDFs are stored
 *  rather than streamed because full books exceed serverless response limits. */
export const POST = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  const body = await readJson<{ part: "interior" | "cover"; singleSided?: boolean }>(req);
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const pages = await getPages(id);
  const readiness = assessReadiness(book, pages);
  const label = readiness.printReady ? "Print-ready" : "Draft proof — not print-ready";
  const suffix = readiness.printReady ? "print-ready" : "draft";

  let bytes: Uint8Array;
  if (body.part === "cover") {
    if (book.cover_status !== "complete") throw new HttpError(400, "Generate the cover before exporting it.");
    const brand = (await db().from("brand_settings").select("logo_path").eq("id", 1).maybeSingle()).data as { logo_path: string | null } | null;
    const logo = brand?.logo_path ? await downloadFile(brand.logo_path) : null;
    bytes = await buildCoverPdf(book, logo, { label });
  } else {
    const missing = pages.filter((p) => p.status !== "complete" || !p.image_path);
    if (missing.length) {
      throw new HttpError(400, `${missing.length} page(s) are not complete (e.g. page ${missing[0].position + 1}). Generate or delete them before exporting.`);
    }
    bytes = await buildInteriorPdf(book, pages, { singleSided: body.singleSided ?? true, label });
  }

  const filename = `${slug(book.title)}-${body.part === "cover" ? "front-cover" : "interior"}-${suffix}.pdf`;
  const path = `books/${id}/exports/${Date.now()}-${filename}`;
  await uploadFile(path, bytes, "application/pdf");
  const url = await signedUrl(path, 60 * 60, filename);
  return json({ url, filename, label, readiness, bytes: bytes.byteLength });
});
