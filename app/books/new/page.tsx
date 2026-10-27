"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CharacterPicker } from "@/components/CharacterPicker";
import { CostEstimate } from "@/components/CostEstimate";
import { Button, Card, ErrorNote, Notice, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import { PAGE_SIZES } from "@/lib/print";
import type { PageSize } from "@/lib/types";
import type { CharacterView } from "@/lib/view";

const COUNTS = [10, 20, 30, 40];

export default function NewBookPage() {
  const router = useRouter();
  const chars = useApi<{ characters: CharacterView[] }>("/api/characters");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(20);
  const [pageSize, setPageSize] = useState<PageSize>("letter");
  const [stage, setStage] = useState<"idle" | "creating" | "planning">("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let id = createdId;
    try {
      if (!id) {
        setStage("creating");
        const { book } = await api<{ book: { id: string } }>("/api/books", {
          method: "POST",
          json: { title, description, character_ids: selected, page_count: pageCount, page_size: pageSize },
        });
        id = book.id;
        setCreatedId(id);
      }
      setStage("planning");
      await api(`/api/books/${id}/plan`, { method: "POST", json: {} });
      router.push(`/books/${id}?tab=plan`);
    } catch (err) {
      setError((err as Error).message);
      setStage("idle");
    }
  }

  return (
    <>
      <PageHeader eyebrow="New book" title="Describe your book">
        First we’ll write a page-by-page plan you can edit. No artwork is generated until you approve the plan.
      </PageHeader>

      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-6 p-7">
          <div>
            <label className="label" htmlFor="title">
              Book title
            </label>
            <input id="title" className="field text-lg" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Quiet Greenhouse" required />
          </div>
          <div>
            <label className="label" htmlFor="desc">
              Description / theme
            </label>
            <textarea
              id="desc"
              className="field min-h-32"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A slow wander through Victorian glasshouses, moonlit herb gardens and misty orchards as the Calmlings tend rare plants through the seasons."
            />
          </div>

          <div>
            <span className="label">Characters</span>
            {chars.loading ? (
              <div className="flex items-center gap-2 text-sm text-navy-soft">
                <Spinner /> Loading…
              </div>
            ) : chars.error ? (
              <ErrorNote>{chars.error.message}</ErrorNote>
            ) : chars.data?.characters.length ? (
              <CharacterPicker characters={chars.data.characters} selected={selected} onChange={setSelected} />
            ) : (
              <Notice tone="sky">
                Your character library is empty. <Link href="/characters" className="underline">Upload Calmlings references</Link> first, or continue for
                environment-only pages.
              </Notice>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <span className="label">Pages</span>
              <div className="flex gap-2">
                {COUNTS.map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setPageCount(n)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm transition ${pageCount === n ? "border-navy bg-navy text-cream" : "border-line bg-paper hover:border-navy/25"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Page size</span>
              <div className="flex gap-2">
                {(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setPageSize(s)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition ${pageSize === s ? "border-navy bg-navy text-cream" : "border-line bg-paper hover:border-navy/25"}`}
                  >
                    <span className={`inline-block border border-current ${s === "square" ? "h-3.5 w-3.5" : "h-4 w-3"}`} />
                    {s === "square" ? "Square 8.5″" : "8.5 × 11″"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg text-navy">Summary</h2>
            <dl className="mt-3 space-y-1.5 text-sm text-navy-soft">
              <div className="flex justify-between">
                <dt>Pages</dt>
                <dd className="text-navy">{pageCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Trim size</dt>
                <dd className="text-navy">{PAGE_SIZES[pageSize].label}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Characters</dt>
                <dd className="text-navy">{selected.length || "None"}</dd>
              </div>
            </dl>
            <CostEstimate className="mt-4" pages={pageCount} pageSize={pageSize} refs={Math.min(selected.length, 2)} plan />
            <ErrorNote className="mt-4">{error}</ErrorNote>
            <Button type="submit" className="mt-5 w-full py-3" loading={stage !== "idle"}>
              {stage === "creating" ? "Creating book…" : stage === "planning" ? `Planning ${pageCount} pages…` : createdId ? "Retry planning" : "Generate book"}
            </Button>
            {stage === "planning" && <p className="mt-3 text-center text-xs text-mist">Writing unique scenes for every page. This can take up to a minute.</p>}
          </Card>
        </div>
      </form>
    </>
  );
}
