"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge, ErrorNote, Spinner, statusTone } from "@/components/ui";
import { useApi, useQueuePump } from "@/lib/hooks";
import type { BookView, CharacterView } from "@/lib/view";
import { CoverTab } from "./CoverTab";
import { ExportTab } from "./ExportTab";
import { PagesTab } from "./PagesTab";
import { PlanTab } from "./PlanTab";

export type Tab = "plan" | "pages" | "cover" | "export";

export type WorkspaceProps = {
  book: BookView;
  setBook: (b: BookView) => void;
  refresh: () => Promise<void>;
  characters: CharacterView[];
  logoUrl: string | null;
  goTo: (tab: Tab) => void;
};

const STEPS: { id: Tab; label: string; hint: string }[] = [
  { id: "plan", label: "Plan", hint: "Review scenes" },
  { id: "pages", label: "Pages", hint: "Generate & review" },
  { id: "cover", label: "Cover", hint: "Artwork & title" },
  { id: "export", label: "Export", hint: "Print PDFs" },
];

function defaultTab(book: BookView): Tab {
  if (book.pages.length === 0 || book.pages.every((p) => p.status === "pending")) return "plan";
  return "pages";
}

export function BookWorkspace({ id, initialTab }: { id: string; initialTab?: Tab }) {
  const bookApi = useApi<{ book: BookView }>(`/api/books/${id}`);
  const chars = useApi<{ characters: CharacterView[] }>("/api/characters");
  const brand = useApi<{ logo_url: string | null }>("/api/brand");
  const cfg = useApi<{ concurrency: number; openai: boolean }>("/api/config");
  const [tab, setTab] = useState<Tab | undefined>(initialTab);

  const book = bookApi.data?.book ?? null;
  const active =
    !!book &&
    (book.pages.some((p) => p.status === "queued" || p.status === "generating") ||
      book.cover_status === "queued" ||
      book.cover_status === "generating");

  const refresh = bookApi.refresh;
  useQueuePump(active, cfg.data?.concurrency ?? 2, refresh);

  const goTo = useCallback((t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `?tab=${t}`);
  }, []);

  if (bookApi.loading) {
    return (
      <div className="flex items-center gap-3 py-20 text-navy-soft">
        <Spinner /> Loading book…
      </div>
    );
  }
  if (bookApi.error || !book) {
    return (
      <div className="space-y-4">
        <ErrorNote>{bookApi.error?.message ?? "Book not found."}</ErrorNote>
        <Link href="/" className="text-sm underline">
          Back to library
        </Link>
      </div>
    );
  }

  const current = tab ?? defaultTab(book);
  const props: WorkspaceProps = {
    book,
    setBook: (b) => bookApi.setData({ book: b }),
    refresh,
    characters: chars.data?.characters ?? [],
    logoUrl: brand.data?.logo_url ?? null,
    goTo,
  };

  return (
    <>
      <div className="mb-8">
        <Link href="/" className="text-sm text-navy-soft hover:text-navy">
          ← Library
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl text-navy sm:text-4xl">{book.title}</h1>
          <Badge tone={statusTone(book.status_label)}>{book.status_label}</Badge>
          {active && (
            <span className="flex items-center gap-1.5 text-xs text-sky-deep">
              <Spinner className="size-3" /> Generating — keep this tab open or run the worker
            </span>
          )}
        </div>
        {book.description && <p className="mt-2 max-w-3xl text-[15px] text-navy-soft">{book.description}</p>}
      </div>

      <nav className="mb-8 grid grid-cols-2 gap-2 rounded-3xl border border-line/80 bg-paper/70 p-1.5 shadow-soft sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            className={`flex items-center gap-3 rounded-[1.1rem] px-4 py-2.5 text-left transition ${current === s.id ? "bg-navy text-cream shadow-soft" : "text-navy-soft hover:bg-cream-deep"}`}
          >
            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${current === s.id ? "bg-cream/15" : "bg-cream-deep"}`}>{i + 1}</span>
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              <span className={`block text-xs ${current === s.id ? "text-cream/70" : "text-mist"}`}>{s.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      {current === "plan" && <PlanTab {...props} />}
      {current === "pages" && <PagesTab {...props} />}
      {current === "cover" && <CoverTab {...props} />}
      {current === "export" && <ExportTab {...props} />}
    </>
  );
}
