import { coverDpi, interiorDpi, PRINT, requiredPixels } from "./print";
import type { Book, Page } from "./types";

export type Readiness = {
  printReady: boolean;
  issues: string[];
  pages: { id: string; position: number; dpi: number | null }[];
  coverDpi: number | null;
  minInteriorDpi: number | null;
};

/** Decide whether exports can honestly be labelled print-ready. */
export function assessReadiness(book: Book, pages: Page[]): Readiness {
  const issues: string[] = [];
  const pageDpis = pages.map((p) => ({
    id: p.id,
    position: p.position,
    dpi: p.image_width && p.image_height ? interiorDpi(book.page_size, { width: p.image_width, height: p.image_height }) : null,
  }));

  const incomplete = pages.filter((p) => p.status !== "complete" || !p.image_path);
  if (pages.length === 0) issues.push("The book has no pages.");
  if (incomplete.length) issues.push(`${incomplete.length} page(s) are not generated yet.`);

  const low = pageDpis.filter((p) => p.dpi !== null && p.dpi < PRINT.targetDpi);
  const minInteriorDpi = pageDpis.reduce<number | null>((m, p) => (p.dpi === null ? m : m === null ? p.dpi : Math.min(m, p.dpi)), null);
  if (low.length) {
    const need = requiredPixels(book.page_size, "interior");
    issues.push(
      `${low.length} interior page(s) print below ${PRINT.targetDpi} DPI (lowest ${minInteriorDpi} DPI). True 300 DPI needs about ${need.width}×${need.height} px; images are not upscaled.`,
    );
  }

  const cDpi = book.cover_width && book.cover_height ? coverDpi(book.page_size, { width: book.cover_width, height: book.cover_height }) : null;
  if (!book.cover_image_path || book.cover_status !== "complete") issues.push("The cover has not been generated.");
  else if (cDpi !== null && cDpi < PRINT.targetDpi) {
    const need = requiredPixels(book.page_size, "cover");
    issues.push(`The cover prints at ${cDpi} DPI (needs ${PRINT.targetDpi}; about ${need.width}×${need.height} px).`);
  }
  if (!book.approved_at) issues.push("The book has not been marked as approved.");

  return { printReady: issues.length === 0, issues, pages: pageDpis, coverDpi: cDpi, minInteriorDpi };
}
