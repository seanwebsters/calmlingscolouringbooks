"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoverPreview } from "@/components/CoverPreview";
import { Badge, Button, Card, EmptyState, ErrorNote, LinkButton, PageHeader, Spinner, statusTone } from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { CoverSettings, Palette, PageSize } from "@/lib/types";

type LibraryBook = {
  id: string;
  title: string;
  description: string;
  page_size: PageSize;
  page_count: number;
  pages_complete: number;
  palette: Palette | null;
  cover_url: string | null;
  cover_settings: CoverSettings;
  status_label: string;
  updated_at: string;
};

export default function LibraryPage() {
  const router = useRouter();
  const books = useApi<{ books: LibraryBook[] }>("/api/books");
  const brand = useApi<{ logo_url: string | null }>("/api/brand");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function duplicate(id: string) {
    setBusy(id);
    setError(null);
    try {
      const { book } = await api<{ book: { id: string } }>(`/api/books/${id}/duplicate`, { method: "POST" });
      router.push(`/books/${book.id}?tab=plan`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete “${title}” and all of its artwork? This cannot be undone.`)) return;
    setBusy(id);
    try {
      await api(`/api/books/${id}`, { method: "DELETE" });
      await books.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Your colouring books"
        actions={<LinkButton href="/books/new">Create a book</LinkButton>}
      >
        Upload characters, describe a book, review its plan, generate, refine and export print files.
      </PageHeader>

      <ErrorNote className="mb-6">{error}</ErrorNote>

      {books.loading ? (
        <div className="flex items-center gap-3 py-20 text-navy-soft">
          <Spinner /> Loading your library…
        </div>
      ) : books.error ? (
        <ErrorNote>{books.error.message}</ErrorNote>
      ) : !books.data?.books.length ? (
        <EmptyState
          title="No books yet"
          action={
            <div className="flex gap-2">
              <LinkButton href="/characters" variant="secondary">
                Add characters
              </LinkButton>
              <LinkButton href="/books/new">Create your first book</LinkButton>
            </div>
          }
        >
          Start by uploading your Calmlings character references, then describe your first book.
        </EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.data.books.map((b) => (
            <Card key={b.id} className="group flex flex-col overflow-hidden p-4 transition hover:shadow-lift">
              <button onClick={() => router.push(`/books/${b.id}`)} className="mx-auto block w-full max-w-[260px]">
                <CoverPreview
                  imageUrl={b.cover_url}
                  settings={b.cover_settings ?? {}}
                  fallbackTitle={b.title}
                  logoUrl={brand.data?.logo_url}
                  pageSize={b.page_size}
                  palette={b.palette}
                />
              </button>
              <div className="mt-4 flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg leading-snug text-navy">{b.title}</h3>
                  <Badge tone={statusTone(b.status_label)} className="shrink-0">
                    {b.status_label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-navy-soft">
                  {b.page_count} pages · {b.pages_complete} illustrated · {b.page_size === "square" ? "Square" : "8.5 × 11"}
                </p>
                {b.palette && (
                  <div className="mt-3 flex gap-1" title={b.palette.name}>
                    {b.palette.colors.map((c) => (
                      <span key={c} className="size-4 rounded-full border border-white shadow-sm" style={{ background: c }} />
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <LinkButton href={`/books/${b.id}`} variant="primary" className="px-3.5 py-1.5">
                    Edit
                  </LinkButton>
                  <LinkButton href={`/books/${b.id}?tab=export`} variant="secondary" className="px-3.5 py-1.5">
                    Export
                  </LinkButton>
                  <Button variant="ghost" className="px-3 py-1.5" title="Duplicate as a sequel" loading={busy === b.id} onClick={() => duplicate(b.id)}>
                    Sequel
                  </Button>
                  <Button variant="ghost" className="ml-auto px-3 py-1.5 text-rose-deep" onClick={() => remove(b.id, b.title)} disabled={busy === b.id}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
