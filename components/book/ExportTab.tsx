"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorNote, Notice } from "@/components/ui";
import { api } from "@/lib/client";
import { contentBox, coverBox, PAGE_SIZES, PRINT, requiredPixels } from "@/lib/print";
import type { BookView } from "@/lib/view";
import type { WorkspaceProps } from "./BookWorkspace";

type ExportResult = { url: string; filename: string; label: string; bytes: number };

export function ExportTab({ book, setBook, goTo }: WorkspaceProps) {
  const [singleSided, setSingleSided] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ExportResult>>({});
  const r = book.readiness;
  const allComplete = book.pages.length > 0 && book.pages.every((p) => p.status === "complete");
  const size = PAGE_SIZES[book.page_size];
  const box = contentBox(book.page_size);
  const cover = coverBox(book.page_size);

  async function exportPart(part: "interior" | "cover") {
    setBusy(part);
    setError(null);
    try {
      const res = await api<ExportResult>(`/api/books/${book.id}/export`, { method: "POST", json: { part, singleSided } });
      setResults((s) => ({ ...s, [part]: res }));
      window.location.href = res.url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleApproval() {
    setBusy("approve");
    try {
      const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}`, { method: "PATCH", json: { approved: !book.approved_at } });
      setBook(b);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl text-navy">Print readiness</h2>
            {r.printReady ? <Badge tone="sage">Print-ready</Badge> : <Badge tone="peach">Draft proof — not print-ready</Badge>}
          </div>
          {r.issues.length ? (
            <ul className="mt-4 space-y-2 text-sm text-navy-soft">
              {r.issues.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-peach-deep" />
                  {i}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-sage-deep">All pages are generated at ≥ {PRINT.targetDpi} DPI, the cover is complete and the book is approved.</p>
          )}
          <p className="mt-4 text-xs text-mist">
            Exports never upscale artwork to fake resolution. Files are labelled “print-ready” only when every requirement above is met; otherwise they are
            labelled as draft proofs in the filename and PDF metadata.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg text-navy">Specifications</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-navy-soft">Trim size</dt>
            <dd className="text-navy">{size.label}</dd>
            <dt className="text-navy-soft">Interior margins</dt>
            <dd className="text-navy">
              {PRINT.margin} in on all sides (art area {box.width} × {box.height} in)
            </dd>
            <dt className="text-navy-soft">Cover</dt>
            <dd className="text-navy">
              {cover.width} × {cover.height} in incl. {PRINT.coverBleed} in bleed
            </dd>
            <dt className="text-navy-soft">300 DPI needs</dt>
            <dd className="text-navy">
              interior {requiredPixels(book.page_size, "interior").width}×{requiredPixels(book.page_size, "interior").height} px · cover{" "}
              {requiredPixels(book.page_size, "cover").width}×{requiredPixels(book.page_size, "cover").height} px
            </dd>
            <dt className="text-navy-soft">Current artwork</dt>
            <dd className="text-navy">
              interior min {r.minInteriorDpi ?? "–"} DPI · cover {r.coverDpi ?? "–"} DPI
            </dd>
          </dl>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-6">
          <h2 className="text-lg text-navy">Approve</h2>
          <p className="mt-1 text-sm text-navy-soft">Mark the book as reviewed once you are happy with every page and the cover.</p>
          <Button className="mt-4" variant={book.approved_at ? "secondary" : "primary"} loading={busy === "approve"} onClick={toggleApproval} disabled={!allComplete && !book.approved_at}>
            {book.approved_at ? "Approved ✓ — undo" : "Approve book"}
          </Button>
          {!allComplete && (
            <p className="mt-2 text-xs text-mist">
              Finish every page first.{" "}
              <button className="underline" onClick={() => goTo("pages")}>
                Review pages
              </button>
            </p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-lg text-navy">Download PDFs</h2>
          <label className="flex items-start gap-2 text-sm text-navy-soft">
            <input type="checkbox" className="mt-1" checked={singleSided} onChange={(e) => setSingleSided(e.target.checked)} />
            <span>
              Single-sided interior <span className="text-mist">(blank back after each illustration, so colours don’t bleed through)</span>
            </span>
          </label>
          <Button className="w-full" onClick={() => exportPart("interior")} loading={busy === "interior"} disabled={!allComplete}>
            Export interior PDF
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => exportPart("cover")} loading={busy === "cover"} disabled={book.cover_status !== "complete"}>
            Export front-cover PDF
          </Button>
          {!allComplete && <Notice className="text-xs">The interior can be exported once every page has artwork.</Notice>}
          <ErrorNote>{error}</ErrorNote>
          {Object.entries(results).map(([part, res]) => (
            <div key={part} className="rounded-2xl border border-line bg-cream/60 p-3 text-xs">
              <a href={res.url} className="font-medium text-lavender-deep underline">
                {res.filename}
              </a>
              <div className="mt-1 text-navy-soft">
                {res.label} · {(res.bytes / 1024 / 1024).toFixed(1)} MB · link valid for 1 hour
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
