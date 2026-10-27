import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { contentBox, coverBox, PAGE_SIZES, PRINT } from "./print";
import { downloadFile } from "./storage";
import type { Book, CoverSettings, Page } from "./types";

const PT = 72; // points per inch

async function embed(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  // PNG signature check; everything else is treated as JPEG.
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return doc.embedPng(bytes);
  return doc.embedJpg(bytes);
}

function hexToRgb(hex: string | undefined, fallback = { r: 0.12, g: 0.16, b: 0.27 }) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return rgb(fallback.r, fallback.g, fallback.b);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Interior: one illustration per page, fitted inside equal margins, in page
 *  order. Single-sided inserts a blank back after every illustration. */
export async function buildInteriorPdf(book: Book, pages: Page[], opts: { singleSided: boolean; label: string }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${book.title} — Interior`);
  doc.setSubject(opts.label);
  doc.setCreator("Calmlings Book Studio");

  const size = PAGE_SIZES[book.page_size];
  const box = contentBox(book.page_size);
  const W = size.width * PT;
  const H = size.height * PT;

  for (const page of pages) {
    if (!page.image_path) continue;
    const img = await embed(doc, await downloadFile(page.image_path));
    const scale = Math.min((box.width * PT) / img.width, (box.height * PT) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const pdfPage = doc.addPage([W, H]);
    pdfPage.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
    if (opts.singleSided) doc.addPage([W, H]);
  }
  return doc.save();
}

/** Split text into lines that fit `maxWidth` at `size`. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shared cover typography layout — mirrored by the browser preview. Sizes are
 *  fractions of trim width so the preview and PDF match. */
export const COVER_TYPE = {
  titleSize: 0.085,
  subtitleSize: 0.036,
  lineHeight: 1.12,
  safeInset: 0.06, // of trim width
  logoWidth: 0.2,
};

function drawCentredLines(page: PDFPage, lines: string[], font: PDFFont, size: number, top: number, centreX: number, color: ReturnType<typeof rgb>) {
  let y = top;
  for (const line of lines) {
    y -= size;
    page.drawText(line, { x: centreX - font.widthOfTextAtSize(line, size) / 2, y, size, font, color });
    y -= size * (COVER_TYPE.lineHeight - 1);
  }
  return y;
}

/** Front cover: full-bleed artwork + title overlay + optional logo. */
export async function buildCoverPdf(book: Book, logo: Uint8Array | null, opts: { label: string }) {
  if (!book.cover_image_path) throw new Error("The cover has not been generated yet.");
  const settings: CoverSettings = book.cover_settings ?? {};
  const doc = await PDFDocument.create();
  doc.setTitle(`${book.title} — Front cover`);
  doc.setSubject(opts.label);
  doc.setCreator("Calmlings Book Studio");

  const trim = PAGE_SIZES[book.page_size];
  const full = coverBox(book.page_size);
  const W = full.width * PT;
  const H = full.height * PT;
  const bleed = PRINT.coverBleed * PT;
  const page = doc.addPage([W, H]);
  page.setBleedBox(0, 0, W, H);
  page.setTrimBox(bleed, bleed, trim.width * PT, trim.height * PT);

  // Artwork fills the whole sheet including bleed (cropping overflow).
  const art = await embed(doc, await downloadFile(book.cover_image_path));
  const scale = Math.max(W / art.width, H / art.height);
  const aw = art.width * scale;
  const ah = art.height * scale;
  page.drawImage(art, { x: (W - aw) / 2, y: (H - ah) / 2, width: aw, height: ah });

  // Typography within the trim's safe area.
  const trimW = trim.width * PT;
  const trimH = trim.height * PT;
  const inset = trimW * COVER_TYPE.safeInset;
  const maxWidth = trimW - inset * 2;
  const font = await doc.embedFont(settings.font === "sans" ? StandardFonts.Helvetica : StandardFonts.TimesRoman);
  const subFont = await doc.embedFont(settings.font === "sans" ? StandardFonts.HelveticaOblique : StandardFonts.TimesRomanItalic);
  const color = hexToRgb(settings.textColor);
  const title = (settings.title ?? book.title).trim();
  const subtitle = (settings.subtitle ?? "").trim();

  const titleSize = trimW * COVER_TYPE.titleSize;
  const subSize = trimW * COVER_TYPE.subtitleSize;
  const titleLines = wrap(title, font, titleSize, maxWidth);
  const subLines = subtitle ? wrap(subtitle, subFont, subSize, maxWidth) : [];
  const blockH =
    titleLines.length * titleSize * COVER_TYPE.lineHeight + (subLines.length ? subSize * 0.8 + subLines.length * subSize * COVER_TYPE.lineHeight : 0);

  const position = settings.position ?? "top";
  const trimTop = bleed + trimH;
  const top =
    position === "top" ? trimTop - inset * 1.6 : position === "bottom" ? bleed + inset * 1.6 + blockH : bleed + trimH / 2 + blockH / 2;

  if (settings.panel) {
    const pad = inset * 0.6;
    page.drawRectangle({
      x: bleed + inset - pad,
      y: top - blockH - pad,
      width: maxWidth + pad * 2,
      height: blockH + pad * 2,
      color: rgb(1, 1, 1),
      opacity: 0.72,
    });
  }

  const cx = W / 2;
  let y = drawCentredLines(page, titleLines, font, titleSize, top, cx, color);
  if (subLines.length) drawCentredLines(page, subLines, subFont, subSize, y - subSize * 0.8, cx, color);

  if (logo && settings.showLogo !== false) {
    const img = await embed(doc, logo);
    const lw = trimW * COVER_TYPE.logoWidth;
    const lh = (img.height / img.width) * lw;
    const ly = position === "bottom" ? trimTop - inset - lh : bleed + inset;
    page.drawImage(img, { x: cx - lw / 2, y: ly, width: lw, height: lh });
  }

  return doc.save();
}
