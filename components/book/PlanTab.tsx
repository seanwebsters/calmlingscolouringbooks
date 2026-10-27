"use client";

import { useState } from "react";
import { CharacterPicker } from "@/components/CharacterPicker";
import { CostEstimate } from "@/components/CostEstimate";
import { Badge, Button, Card, EmptyState, ErrorNote, Notice, Spinner, statusTone } from "@/components/ui";
import { api } from "@/lib/client";
import type { BookView, CharacterView, PageView } from "@/lib/view";
import type { WorkspaceProps } from "./BookWorkspace";

export function PlanTab({ book, setBook, refresh, characters, goTo }: WorkspaceProps) {
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState("");
  const [adding, setAdding] = useState(false);

  const bookChars = characters.filter((c) => book.character_ids.includes(c.id));
  const toGenerate = book.pages.filter((p) => p.status === "pending" || p.status === "failed").length;
  const hasArtwork = book.pages.some((p) => p.image_path);

  async function plan(replace: boolean) {
    if (replace && !confirm(hasArtwork ? "Replace the whole plan? All generated page artwork will be deleted." : "Write a fresh plan? Your edits will be replaced.")) return;
    setPlanning(true);
    setError(null);
    try {
      const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}/plan`, { method: "POST", json: { replace } });
      setBook(b);
    } catch (err) {
      setError((err as Error).message);
      await refresh();
    } finally {
      setPlanning(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      await api(`/api/books/${book.id}/generate`, { method: "POST", json: { scope: "missing" } });
      await refresh();
      goTo("pages");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function addPage() {
    if (!newPrompt.trim()) return;
    setAdding(true);
    try {
      const { book: b } = await api<{ book: BookView }>(`/api/books/${book.id}/pages`, { method: "POST", json: { prompt: newPrompt } });
      setBook(b);
      setNewPrompt("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  if (book.pages.length === 0) {
    return (
      <div className="space-y-4">
        <ErrorNote>{error ?? (book.plan_status === "failed" ? book.plan_error : null)}</ErrorNote>
        {planning || book.plan_status === "planning" ? (
          <Card className="flex items-center gap-3 p-10 text-navy-soft">
            <Spinner /> Writing a unique scene for each of the {book.page_count} pages…
          </Card>
        ) : (
          <EmptyState title="No plan yet" action={<Button onClick={() => plan(false)}>Generate the page plan</Button>}>
            The text model will write {book.page_count} unique scene descriptions, a cover concept and a distinct palette for this book.
          </EmptyState>
        )}
        <CostEstimate pages={book.page_count} pageSize={book.page_size} refs={Math.min(book.character_ids.length, 2)} plan />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        {book.pages.map((p) => (
          <PlanRow key={p.id + p.updated_at} page={p} characters={characters} onSaved={refresh} />
        ))}
        <Card className="p-5">
          <h3 className="text-lg text-navy">Add a page</h3>
          <textarea
            className="field mt-3 min-h-24"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Describe a new scene…"
          />
          <Button className="mt-3" variant="secondary" loading={adding} onClick={addPage} disabled={!newPrompt.trim()}>
            Add page to end
          </Button>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-6">
          <h2 className="text-lg text-navy">Art direction</h2>
          <ul className="mt-2 space-y-1 text-sm text-navy-soft">
            <li>Crisp black outlines on pure white</li>
            <li>Intricate botanical &amp; environmental detail</li>
            <li>No shading, grey, gradients or text</li>
            <li>Characters small, drawn from references</li>
          </ul>
          {book.palette && (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.16em] text-mist">Cover palette</div>
              <div className="mt-1 text-sm text-navy">{book.palette.name}</div>
              <div className="mt-2 flex gap-1.5">
                {book.palette.colors.map((c) => (
                  <span key={c} title={c} className="size-7 rounded-full border-2 border-white shadow-soft" style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
          {bookChars.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-[0.16em] text-mist">Characters</div>
              <div className="flex flex-wrap gap-1.5">
                {bookChars.map((c) => (
                  <Badge key={c.id} tone="lavender">
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg text-navy">Generate artwork</h2>
          <p className="mt-1 text-sm text-navy-soft">
            {toGenerate > 0 ? `${toGenerate} page${toGenerate === 1 ? "" : "s"} ready to generate` : "All pages are queued or generated."}
            {book.cover_status === "none" ? ", plus the cover." : "."}
          </p>
          {toGenerate > 0 && (
            <CostEstimate
              className="mt-3"
              pages={toGenerate}
              pageSize={book.page_size}
              refs={Math.min(book.character_ids.length, 2)}
              cover={book.cover_status === "none" || book.cover_status === "failed"}
            />
          )}
          <Notice tone="sky" className="mt-3 text-xs">
            Character likeness is guided by your reference images but not guaranteed — you can review and regenerate any page.
          </Notice>
          <Button className="mt-4 w-full py-3" onClick={generate} loading={generating} disabled={toGenerate === 0}>
            Generate {toGenerate} page{toGenerate === 1 ? "" : "s"}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => plan(true)} loading={planning}>
            Re-plan from scratch
          </Button>
        </Card>
      </div>
    </div>
  );
}

function PlanRow({ page, characters, onSaved }: { page: PageView; characters: CharacterView[]; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(page.title);
  const [prompt, setPrompt] = useState(page.prompt);
  const [chars, setChars] = useState(page.character_ids);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const locked = page.status === "queued" || page.status === "generating";

  async function save(patch: Partial<{ title: string; prompt: string; character_ids: string[] }>) {
    setState("saving");
    try {
      await api(`/api/pages/${page.id}`, { method: "PATCH", json: patch });
      setState("saved");
      setError(null);
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!confirm(`Delete page ${page.position + 1}?`)) return;
    await api(`/api/pages/${page.id}`, { method: "DELETE" });
    await onSaved();
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cream-deep font-serif text-sm text-navy">{page.position + 1}</span>
        <input
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 font-serif text-lg text-navy outline-none focus:bg-cream"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== page.title && save({ title })}
          aria-label="Page title"
        />
        {page.status !== "pending" && <Badge tone={statusTone(page.status)}>{page.status}</Badge>}
        <span className="w-14 text-right text-xs text-mist">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</span>
        <button onClick={remove} className="rounded-full p-1.5 text-mist hover:bg-rose/40 hover:text-rose-deep" aria-label="Delete page" disabled={locked}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <textarea
        className="field mt-3 min-h-28 text-sm leading-relaxed"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => prompt !== page.prompt && save({ prompt })}
        aria-label="Scene description"
      />
      {characters.length > 0 && (
        <div className="mt-3">
          <CharacterPicker
            size="sm"
            characters={characters}
            selected={chars}
            onChange={(ids) => {
              setChars(ids);
              void save({ character_ids: ids });
            }}
          />
        </div>
      )}
      <ErrorNote className="mt-3">{error}</ErrorNote>
    </Card>
  );
}
