"use client";

import { useState } from "react";
import { CharacterPicker } from "@/components/CharacterPicker";
import { CostEstimate } from "@/components/CostEstimate";
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, Notice, Spinner, statusTone } from "@/components/ui";
import { api } from "@/lib/client";
import { PRINT } from "@/lib/print";
import type { BookView, PageView } from "@/lib/view";
import type { WorkspaceProps } from "./BookWorkspace";

export function PagesTab(props: WorkspaceProps) {
  const { book, setBook, refresh, goTo } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const pages = book.pages;
  const count = (s: PageView["status"]) => pages.filter((p) => p.status === s).length;
  const complete = count("complete");
  const failed = count("failed");
  const pending = count("pending");
  const inFlight = count("queued") + count("generating");
  const dpiById = new Map(book.readiness.pages.map((p) => [p.id, p.dpi]));
  const lowDpi = book.readiness.pages.filter((p) => p.dpi !== null && p.dpi < PRINT.targetDpi).length;

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reorder(ids: string[]) {
    // Optimistic update so the grid responds immediately.
    const byId = new Map(pages.map((p) => [p.id, p]));
    setBook({ ...book, pages: ids.map((id, i) => ({ ...byId.get(id)!, position: i })) });
    try {
      const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}/pages`, { method: "PUT", json: { order: ids } });
      setBook(b);
    } catch (err) {
      setError((err as Error).message);
      await refresh();
    }
  }

  function move(id: string, delta: number) {
    const ids = pages.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorder(ids);
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = pages.map((p) => p.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    void reorder(ids);
  }

  if (pages.length === 0) {
    return <EmptyState title="No pages yet" action={<Button onClick={() => goTo("plan")}>Go to plan</Button>}>Create the page plan first.</EmptyState>;
  }

  const openIndex = pages.findIndex((p) => p.id === openId);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-serif text-2xl text-navy">
              {complete} <span className="text-navy-soft">of {pages.length} pages illustrated</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {inFlight > 0 && <Badge tone="sky">{inFlight} in progress</Badge>}
              {pending > 0 && <Badge>{pending} not started</Badge>}
              {failed > 0 && <Badge tone="rose">{failed} failed</Badge>}
              {lowDpi > 0 && <Badge tone="peach">{lowDpi} below 300 DPI</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending + failed > 0 && (
              <Button loading={busy === "gen"} onClick={() => run("gen", () => api(`/api/books/${book.id}/generate`, { method: "POST", json: { scope: "missing" } }))}>
                {failed && !pending ? `Retry ${failed} failed` : `Generate ${pending + failed} remaining`}
              </Button>
            )}
            {inFlight > 0 && (
              <Button variant="secondary" loading={busy === "cancel"} onClick={() => run("cancel", () => api(`/api/books/${book.id}/cancel`, { method: "POST" }))}>
                Cancel queued
              </Button>
            )}
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Add page
            </Button>
            <Button variant="ghost" onClick={() => goTo("cover")}>
              Cover →
            </Button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream-deep">
          <div className="h-full rounded-full bg-gradient-to-r from-sage-deep/70 to-sky-deep/70 transition-all" style={{ width: `${(complete / pages.length) * 100}%` }} />
        </div>
        {pending + failed > 0 && inFlight === 0 && (
          <CostEstimate className="mt-4" pages={pending + failed} pageSize={book.page_size} refs={Math.min(book.character_ids.length, 2)} cover={false} />
        )}
        {lowDpi > 0 && (
          <Notice className="mt-4">
            The image model returns about {pages.find((p) => p.image_width)?.image_width}×{pages.find((p) => p.image_height)?.image_height} px, which prints at roughly{" "}
            {book.readiness.minInteriorDpi} DPI on this trim size — below the {PRINT.targetDpi} DPI print standard. Exports keep the original pixels (no
            upscaling) and are labelled as drafts.
          </Notice>
        )}
        <ErrorNote className="mt-4">{error}</ErrorNote>
      </Card>

      <p className="text-xs text-mist">Drag pages to reorder, or use the arrows. Click a page to view it large, edit its prompt or regenerate it.</p>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pages.map((p, i) => {
          const dpi = dpiById.get(p.id);
          return (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(p.id)}
              className={`group ${dragId === p.id ? "opacity-40" : ""}`}
            >
              <button
                onClick={() => setOpenId(p.id)}
                className="relative block w-full overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                style={{ aspectRatio: book.page_size === "square" ? "1 / 1" : "8.5 / 11" }}
              >
                <PageThumb page={p} />
              </button>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="font-serif text-sm text-navy">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-navy-soft" title={p.title}>
                  {p.title}
                </span>
                <button onClick={() => move(p.id, -1)} disabled={i === 0} className="rounded p-0.5 text-mist hover:text-navy disabled:opacity-30" aria-label="Move earlier">
                  ←
                </button>
                <button onClick={() => move(p.id, 1)} disabled={i === pages.length - 1} className="rounded p-0.5 text-mist hover:text-navy disabled:opacity-30" aria-label="Move later">
                  →
                </button>
              </div>
              <div className="mt-1 flex gap-1.5">
                {p.status !== "complete" && <Badge tone={statusTone(p.status)}>{p.status}</Badge>}
                {dpi !== null && dpi !== undefined && dpi < PRINT.targetDpi && <Badge tone="peach">{dpi} DPI</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={openIndex >= 0} onClose={() => setOpenId(null)} wide>
        {openIndex >= 0 && (
          <PageEditor
            key={pages[openIndex].id + pages[openIndex].updated_at}
            {...props}
            page={pages[openIndex]}
            index={openIndex}
            dpi={dpiById.get(pages[openIndex].id) ?? null}
            onNavigate={(d) => {
              const next = pages[openIndex + d];
              if (next) setOpenId(next.id);
            }}
            onClose={() => setOpenId(null)}
          />
        )}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)}>
        <AddPageForm {...props} onDone={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

function PageThumb({ page, large }: { page: PageView; large?: boolean }) {
  const busy = page.status === "queued" || page.status === "generating";
  return (
    <>
      {page.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.image_url} alt={page.title} className={`absolute inset-0 size-full object-contain ${busy ? "opacity-40" : ""}`} />
      )}
      {(!page.image_url || busy || page.status === "failed") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          {busy && <Spinner className={large ? "size-6 text-sky-deep" : "size-5 text-sky-deep"} />}
          <span className={`text-xs ${page.status === "failed" ? "text-rose-deep" : "text-navy-soft"}`}>
            {page.status === "generating"
              ? "Generating…"
              : page.status === "queued"
                ? page.error
                  ? "Waiting to retry"
                  : "Queued"
                : page.status === "failed"
                  ? "Generation failed"
                  : page.image_url
                    ? ""
                    : "Not generated"}
          </span>
          {large && page.error && <span className="max-w-sm text-xs text-rose-deep/80">{page.error}</span>}
        </div>
      )}
    </>
  );
}

function PageEditor({
  book,
  setBook,
  refresh,
  characters,
  page,
  index,
  dpi,
  onNavigate,
  onClose,
}: WorkspaceProps & { page: PageView; index: number; dpi: number | null; onNavigate: (d: number) => void; onClose: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [prompt, setPrompt] = useState(page.prompt);
  const [chars, setChars] = useState(page.character_ids);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = title !== page.title || prompt !== page.prompt || chars.join() !== page.character_ids.join();
  const locked = page.status === "queued" || page.status === "generating";

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const save = () => api(`/api/pages/${page.id}`, { method: "PATCH", json: { title, prompt, character_ids: chars } });
  const regenerate = () => api(`/api/pages/${page.id}/generate`, { method: "POST" });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <div
          className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-white"
          style={{ aspectRatio: book.page_size === "square" ? "1 / 1" : "8.5 / 11" }}
        >
          <PageThumb page={page} large />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-navy-soft">
          <button onClick={() => onNavigate(-1)} disabled={index === 0} className="rounded-full px-3 py-1 hover:bg-cream-deep disabled:opacity-30">
            ← Previous
          </button>
          <span>
            {page.image_width ? `${page.image_width}×${page.image_height} px · ${dpi} DPI at print size` : "No artwork yet"}
          </span>
          <button onClick={() => onNavigate(1)} disabled={index === book.pages.length - 1} className="rounded-full px-3 py-1 hover:bg-cream-deep disabled:opacity-30">
            Next →
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 pr-10">
          <span className="font-serif text-2xl text-navy">Page {index + 1}</span>
          <Badge tone={statusTone(page.status)}>{page.status}</Badge>
        </div>
        <div>
          <label className="label">Title</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Scene prompt</label>
          <textarea className="field min-h-48 text-sm leading-relaxed" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        {characters.length > 0 && (
          <div>
            <span className="label">Characters on this page (their reference images are sent)</span>
            <CharacterPicker size="sm" characters={characters} selected={chars} onChange={setChars} />
          </div>
        )}
        {page.status === "failed" && page.error && <ErrorNote>{page.error}</ErrorNote>}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={busy === "regen"}
            disabled={locked}
            onClick={() =>
              run("regen", async () => {
                if (dirty) await save();
                await regenerate();
              })
            }
          >
            {dirty ? "Save & regenerate" : page.image_url ? "Regenerate" : "Generate"}
          </Button>
          <Button variant="secondary" loading={busy === "save"} disabled={!dirty} onClick={() => run("save", save)}>
            Save prompt
          </Button>
          <Button
            variant="danger"
            disabled={!!busy}
            onClick={() => {
              if (!confirm(`Delete page ${index + 1}?`)) return;
              void run("del", async () => {
                await api(`/api/pages/${page.id}`, { method: "DELETE" });
                onClose();
              });
            }}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() =>
              run("add", async () => {
                const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}/pages`, {
                  method: "POST",
                  json: { prompt: "A new calm scene — describe it here.", title: "New page", after: page.position },
                });
                setBook(b);
              })
            }
          >
            Insert page after
          </Button>
        </div>
        <p className="text-xs text-mist">Regenerating replaces this page’s artwork when the new image is ready; the old artwork stays until then.</p>
      </div>
    </div>
  );
}

function AddPageForm({ book, setBook, characters, onDone }: WorkspaceProps & { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [chars, setChars] = useState<string[]>([]);
  const [generate, setGenerate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}/pages`, {
        method: "POST",
        json: { title, prompt, character_ids: chars },
      });
      if (generate) {
        const added = b.pages[b.pages.length - 1];
        await api(`/api/pages/${added.id}/generate`, { method: "POST" });
        const fresh = await api<{ book: BookView }>(`/api/books/${book.id}`);
        setBook(fresh.book);
      } else setBook(b);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl text-navy">Add a page</h2>
      <input className="field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="field min-h-32" placeholder="Describe the scene…" value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
      {characters.length > 0 && <CharacterPicker size="sm" characters={characters} selected={chars} onChange={setChars} />}
      <label className="flex items-center gap-2 text-sm text-navy-soft">
        <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} /> Generate artwork straight away
      </label>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" loading={busy}>
        Add page
      </Button>
    </form>
  );
}
