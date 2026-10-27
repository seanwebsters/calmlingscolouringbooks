"use client";

import { useEffect, useRef, useState } from "react";
import { CoverPreview } from "@/components/CoverPreview";
import { CostEstimate } from "@/components/CostEstimate";
import { Badge, Button, Card, ErrorNote, Notice, statusTone } from "@/components/ui";
import { api } from "@/lib/client";
import { PRINT } from "@/lib/print";
import type { CoverSettings } from "@/lib/types";
import type { BookView } from "@/lib/view";
import type { WorkspaceProps } from "./BookWorkspace";

export function CoverTab({ book, setBook, refresh, logoUrl }: WorkspaceProps) {
  const [settings, setSettings] = useState<CoverSettings>({ title: book.title, ...book.cover_settings });
  const [concept, setConcept] = useState(book.cover_concept);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(settings));

  // Autosave typography changes (debounced).
  useEffect(() => {
    const serialised = JSON.stringify(settings);
    if (serialised === lastSaved.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}`, { method: "PATCH", json: { cover_settings: settings } });
        lastSaved.current = serialised;
        setBook(b);
        setSaveState("saved");
      } catch (err) {
        setError((err as Error).message);
        setSaveState("idle");
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const set = (patch: Partial<CoverSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const busyCover = book.cover_status === "queued" || book.cover_status === "generating";

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/books/${book.id}/cover`, {
        method: "POST",
        json: { cover_concept: concept, ...(customPrompt !== null ? { cover_prompt: customPrompt } : {}) },
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadPrompt() {
    const r = await api<{ prompt: string }>(`/api/books/${book.id}/cover`);
    setCustomPrompt(r.prompt);
  }

  async function resetPrompt() {
    await api(`/api/books/${book.id}`, { method: "PATCH", json: { cover_prompt: "" } });
    setCustomPrompt(null);
  }

  const swatches = [...(book.palette?.colors ?? []), "#1F2A44", "#FFFFFF"];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div>
        <div className="mx-auto max-w-[480px]">
          <CoverPreview
            imageUrl={book.cover_url}
            settings={settings}
            fallbackTitle={book.title}
            logoUrl={logoUrl}
            pageSize={book.page_size}
            palette={book.palette}
            status={book.cover_status}
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-navy-soft">
            <Badge tone={statusTone(book.cover_status)}>{book.cover_status === "none" ? "not generated" : book.cover_status}</Badge>
            {book.cover_width && (
              <span>
                {book.cover_width}×{book.cover_height} px · {book.readiness.coverDpi} DPI incl. bleed
              </span>
            )}
          </div>
          {book.readiness.coverDpi !== null && book.readiness.coverDpi < PRINT.targetDpi && (
            <Notice className="mt-3 text-xs">Cover artwork prints below {PRINT.targetDpi} DPI. The PDF will be labelled as a draft proof.</Notice>
          )}
          {!logoUrl && <p className="mt-3 text-center text-xs text-mist">Upload a Calmlings logo on the Characters page to place it on the cover.</p>}
        </div>
      </div>

      <div className="space-y-5">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-navy">Title typography</h2>
            <span className="text-xs text-mist">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
          </div>
          <div>
            <label className="label">Title</label>
            <input className="field" value={settings.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <label className="label">Subtitle</label>
            <input className="field" value={settings.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} placeholder="A Calmlings colouring book for mindful moments" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Typeface</label>
              <select className="field" value={settings.font ?? "serif"} onChange={(e) => set({ font: e.target.value as "serif" | "sans" })}>
                <option value="serif">Classic serif</option>
                <option value="sans">Clean sans</option>
              </select>
            </div>
            <div>
              <label className="label">Position</label>
              <select className="field" value={settings.position ?? "top"} onChange={(e) => set({ position: e.target.value as CoverSettings["position"] })}>
                <option value="top">Top</option>
                <option value="center">Centre</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Text colour</label>
            <div className="flex flex-wrap items-center gap-2">
              {swatches.map((c) => (
                <button
                  key={c}
                  onClick={() => set({ textColor: c })}
                  className={`size-7 rounded-full border-2 shadow-soft ${settings.textColor?.toLowerCase() === c.toLowerCase() ? "border-navy" : "border-white"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <input type="color" value={settings.textColor ?? "#1F2A44"} onChange={(e) => set({ textColor: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-line" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-soft">
            <input type="checkbox" checked={!!settings.panel} onChange={(e) => set({ panel: e.target.checked })} /> Soft panel behind title
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-soft">
            <input type="checkbox" checked={settings.showLogo !== false} onChange={(e) => set({ showLogo: e.target.checked })} /> Show Calmlings logo
          </label>
          <p className="text-xs text-mist">Typography is real text set over the artwork in the PDF — never generated by the AI.</p>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-lg text-navy">Cover artwork</h2>
          {book.palette && (
            <div className="flex items-center gap-2 text-sm text-navy-soft">
              <div className="flex gap-1">
                {book.palette.colors.map((c) => (
                  <span key={c} className="size-4 rounded-full border border-white" style={{ background: c }} />
                ))}
              </div>
              {book.palette.name}
            </div>
          )}
          <div>
            <label className="label">Cover concept</label>
            <textarea className="field min-h-28 text-sm" value={concept} onChange={(e) => setConcept(e.target.value)} />
          </div>
          {customPrompt === null ? (
            <button className="text-xs text-lavender-deep underline" onClick={loadPrompt}>
              {book.cover_prompt ? "Edit custom full prompt" : "Edit the full prompt (advanced)"}
            </button>
          ) : (
            <div>
              <label className="label">Full prompt</label>
              <textarea className="field min-h-48 font-mono text-xs" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} />
              <button className="mt-1 text-xs text-navy-soft underline" onClick={resetPrompt}>
                Reset to automatic prompt
              </button>
            </div>
          )}
          {book.cover_status === "failed" && <ErrorNote>{book.cover_error}</ErrorNote>}
          {book.cover_status === "queued" && book.cover_error && <Notice tone="sky">{book.cover_error}</Notice>}
          <ErrorNote>{error}</ErrorNote>
          <CostEstimate pages={0} pageSize={book.page_size} refs={Math.min(book.character_ids.length, 3)} />
          <Button className="w-full" onClick={regenerate} loading={busy || busyCover}>
            {busyCover ? "Painting cover…" : book.cover_url ? "Regenerate cover" : "Generate cover"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
