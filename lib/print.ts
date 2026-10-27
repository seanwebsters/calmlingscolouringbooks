import type { PageSize } from "./types";

/** Print geometry, in inches. Shared by the UI (warnings) and the PDF export. */
export const PRINT = {
  targetDpi: 300,
  margin: 0.5,
  coverBleed: 0.125,
};

export const PAGE_SIZES: Record<PageSize, { label: string; width: number; height: number }> = {
  letter: { label: "8.5 × 11 in (portrait)", width: 8.5, height: 11 },
  square: { label: "8.5 × 8.5 in (square)", width: 8.5, height: 8.5 },
};

/** Area available for interior artwork once margins are applied. */
export function contentBox(size: PageSize) {
  const { width, height } = PAGE_SIZES[size];
  return { width: width - PRINT.margin * 2, height: height - PRINT.margin * 2 };
}

/** Cover page including bleed on every edge. */
export function coverBox(size: PageSize) {
  const { width, height } = PAGE_SIZES[size];
  return { width: width + PRINT.coverBleed * 2, height: height + PRINT.coverBleed * 2 };
}

/** DPI an interior image will print at when fitted (contain) into the content box. */
export function interiorDpi(size: PageSize, px: { width: number; height: number }) {
  const box = contentBox(size);
  // contain: the limiting dimension fills the box.
  const scale = Math.min(box.width / px.width, box.height / px.height); // inches per px
  return Math.round(1 / scale);
}

/** DPI a cover image will print at when filled (cover) over the cover + bleed. */
export function coverDpi(size: PageSize, px: { width: number; height: number }) {
  const box = coverBox(size);
  const scale = Math.max(box.width / px.width, box.height / px.height);
  return Math.round(1 / scale);
}

/** Pixel dimensions needed for true 300 DPI. */
export function requiredPixels(size: PageSize, kind: "interior" | "cover") {
  const box = kind === "interior" ? contentBox(size) : coverBox(size);
  return {
    width: Math.ceil(box.width * PRINT.targetDpi),
    height: Math.ceil(box.height * PRINT.targetDpi),
  };
}
