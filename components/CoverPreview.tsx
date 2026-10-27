"use client";

import type { CoverSettings, Palette, PageSize } from "@/lib/types";
import { Spinner } from "./ui";

/** Browser preview of the cover: AI artwork underneath, real (editable)
 *  typography and logo on top. Layout mirrors buildCoverPdf in lib/pdf.ts. */
export function CoverPreview({
  imageUrl,
  settings,
  fallbackTitle,
  logoUrl,
  pageSize,
  palette,
  status,
  className = "",
}: {
  imageUrl: string | null;
  settings: CoverSettings;
  fallbackTitle: string;
  logoUrl?: string | null;
  pageSize: PageSize;
  palette?: Palette | null;
  status?: string;
  className?: string;
}) {
  const title = (settings.title ?? fallbackTitle).trim();
  const position = settings.position ?? "top";
  const fontFamily =
    settings.font === "sans"
      ? "Helvetica, Arial, sans-serif"
      : '"Times New Roman", Times, serif';
  const busy = status === "queued" || status === "generating";

  const textStyle: React.CSSProperties = {
    color: settings.textColor ?? "#1F2A44",
    fontFamily,
    left: "6cqw",
    right: "6cqw",
    ...(position === "top" ? { top: "9.6cqw" } : position === "bottom" ? { bottom: "9.6cqw" } : { top: "50%", transform: "translateY(-50%)" }),
  };
  const tint = palette?.colors?.length ? `linear-gradient(160deg, ${palette.colors[3] ?? palette.colors[0]}55, ${palette.colors[1] ?? palette.colors[0]}44)` : undefined;

  return (
    <div
      className={`cover-frame relative overflow-hidden rounded-xl bg-cream-deep shadow-lift ${className}`}
      style={{ aspectRatio: pageSize === "square" ? "1 / 1" : "8.5 / 11" }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center" style={{ background: tint }}>
          <div className="flex flex-col items-center gap-2 px-4 text-center text-[11px] uppercase tracking-[0.16em] text-navy-soft/70">
            {busy ? <Spinner /> : null}
            {busy ? "Painting cover…" : status === "failed" ? "Cover failed" : "No cover yet"}
          </div>
        </div>
      )}

      {imageUrl && (
        <div className="absolute text-center" style={textStyle}>
          <div className={settings.panel ? "rounded-[1.2cqw] bg-white/70 px-[3.6cqw] py-[3.6cqw]" : ""}>
            <div className="cover-title break-words">{title}</div>
            {settings.subtitle?.trim() && <div className="cover-subtitle mt-[2.9cqw] italic">{settings.subtitle}</div>}
          </div>
        </div>
      )}

      {imageUrl && logoUrl && settings.showLogo !== false && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Calmlings logo"
          className="absolute left-1/2 w-[20cqw] -translate-x-1/2"
          style={position === "bottom" ? { top: "6cqw" } : { bottom: "6cqw" }}
        />
      )}
    </div>
  );
}
