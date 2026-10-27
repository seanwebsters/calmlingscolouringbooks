"use client";

import { useRef, useState } from "react";
import { Button, Card, EmptyState, ErrorNote, Modal, Notice, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { CharacterView } from "@/lib/view";

export default function CharactersPage() {
  const chars = useApi<{ characters: CharacterView[] }>("/api/characters");
  const [editing, setEditing] = useState<CharacterView | null>(null);

  return (
    <>
      <PageHeader eyebrow="Library" title="Calmlings characters">
        Upload the official artwork for each character. These images are sent to the image model as visual references for every
        page they appear on — the model is instructed never to add tails, noses, limbs, clothing or accessories that aren’t in the
        reference.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <CharacterForm onSaved={chars.refresh} />
          <LogoCard />
        </div>

        <div>
          {chars.loading ? (
            <div className="flex items-center gap-3 py-10 text-navy-soft">
              <Spinner /> Loading characters…
            </div>
          ) : chars.error ? (
            <ErrorNote>{chars.error.message}</ErrorNote>
          ) : !chars.data?.characters.length ? (
            <EmptyState title="No characters yet">
              Upload a clear, full-body reference of each Calmling on a plain background. Clean artwork gives the most faithful results.
            </EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {chars.data.characters.map((c) => (
                <Card key={c.id} className="overflow-hidden">
                  <div className="aspect-square bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image_url} alt={c.name} className="size-full object-contain" />
                  </div>
                  <div className="border-t border-line/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg text-navy">{c.name}</h3>
                      <Button variant="ghost" className="px-3 py-1" onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                    </div>
                    {c.description && <p className="mt-1 line-clamp-3 text-sm text-navy-soft">{c.description}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <CharacterForm
            character={editing}
            onSaved={async () => {
              setEditing(null);
              await chars.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function CharacterForm({ character, onSaved }: { character?: CharacterView; onSaved: () => void | Promise<void> }) {
  const [name, setName] = useState(character?.name ?? "");
  const [description, setDescription] = useState(character?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(character?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!character && !file) return setError("Please choose a reference image.");
    setSaving(true);
    const form = new FormData();
    form.set("name", name);
    form.set("description", description);
    if (file) form.set("file", file);
    try {
      await api(character ? `/api/characters/${character.id}` : "/api/characters", {
        method: character ? "PATCH" : "POST",
        body: form,
      });
      if (!character) {
        setName("");
        setDescription("");
        setFile(null);
        setPreview(null);
        if (input.current) input.current.value = "";
      }
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!character || !confirm(`Delete ${character.name}? Existing pages keep their artwork.`)) return;
    setSaving(true);
    try {
      await api(`/api/characters/${character.id}`, { method: "DELETE" });
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const Wrapper = character ? "div" : Card;
  return (
    <Wrapper className={character ? "" : "p-6"}>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl text-navy">{character ? `Edit ${character.name}` : "Add a character"}</h2>
        <label
          className="flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-white transition hover:border-lavender-deep/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) {
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-contain p-3" />
          ) : (
            <span className="px-6 text-center text-sm text-navy-soft">
              Drop a reference image here or <span className="text-lavender-deep underline">browse</span>
              <br />
              <span className="text-xs text-mist">PNG, JPG or WebP · up to 20 MB</span>
            </span>
          )}
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </label>
        <div>
          <label className="label" htmlFor="char-name">
            Name
          </label>
          <input id="char-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pip" required />
        </div>
        <div>
          <label className="label" htmlFor="char-desc">
            Description <span className="font-normal text-mist">(optional)</span>
          </label>
          <textarea
            id="char-desc"
            className="field min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Distinctive details to preserve, e.g. round body, two leaf-shaped ears, no tail."
          />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            {character ? "Save changes" : "Add character"}
          </Button>
          {character && (
            <Button type="button" variant="danger" onClick={remove} disabled={saving}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </Wrapper>
  );
}

function LogoCard() {
  const brand = useApi<{ logo_url: string | null }>("/api/brand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    try {
      await api("/api/brand", { method: "POST", body: form });
      await brand.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("/api/brand", { method: "DELETE" });
      await brand.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl text-navy">Calmlings logo</h2>
      <p className="mt-1 text-sm text-navy-soft">Placed on every cover as an overlay (never redrawn by AI). A transparent PNG works best.</p>
      <div className="mt-4 grid h-28 place-items-center rounded-2xl border border-line bg-[repeating-conic-gradient(#f4ede1_0_25%,#fffdf9_0_50%)] bg-[length:16px_16px]">
        {brand.data?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.data.logo_url} alt="Calmlings logo" className="max-h-24 max-w-[80%] object-contain" />
        ) : (
          <span className="text-sm text-mist">No logo uploaded</span>
        )}
      </div>
      <ErrorNote className="mt-3">{error ?? brand.error?.message}</ErrorNote>
      <div className="mt-4 flex gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium shadow-soft hover:border-navy/25">
          {busy && <Spinner className="size-3.5" />}
          {brand.data?.logo_url ? "Replace logo" : "Upload logo"}
          <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {brand.data?.logo_url && (
          <Button variant="ghost" onClick={remove} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
      {!brand.data?.logo_url && <Notice tone="sky" className="mt-4">Covers export without a logo until one is uploaded.</Notice>}
    </Card>
  );
}
