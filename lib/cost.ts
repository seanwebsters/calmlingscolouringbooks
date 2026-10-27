import "server-only";
import { config } from "./config";
import type { PageSize } from "./types";

export type CostEstimate = {
  images: number;
  perImage: number;
  referenceImages: number;
  total: number;
  breakdown: { label: string; amount: number }[];
  note: string;
};

/** Rough USD estimate for generating `pages` interior pages plus a cover. */
export function estimateCost(opts: {
  pages: number;
  pageSize: PageSize;
  referencesPerImage: number;
  includeCover?: boolean;
  includePlan?: boolean;
}): CostEstimate {
  const perImage = opts.pageSize === "square" ? config.costPerImageSquare : config.costPerImagePortrait;
  const images = opts.pages + (opts.includeCover === false ? 0 : 1);
  const refs = images * opts.referencesPerImage;
  const breakdown: { label: string; amount: number }[] = [];
  if (opts.pages > 0) {
    breakdown.push({ label: `${opts.pages} interior page${opts.pages === 1 ? "" : "s"}`, amount: opts.pages * perImage });
  }
  if (opts.includeCover !== false) breakdown.push({ label: "Cover artwork", amount: perImage });
  if (refs > 0) breakdown.push({ label: `${refs} character reference inputs`, amount: refs * config.costPerReferenceImage });
  if (opts.includePlan) breakdown.push({ label: "Page plan (text model)", amount: config.costPerPlan });
  const total = breakdown.reduce((s, b) => s + b.amount, 0);
  return {
    images,
    perImage,
    referenceImages: refs,
    total: Math.round(total * 100) / 100,
    breakdown: breakdown.map((b) => ({ ...b, amount: Math.round(b.amount * 100) / 100 })),
    note: "Estimate only, based on the per-image prices in your environment settings. Regenerations cost extra.",
  };
}
