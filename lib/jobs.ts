import "server-only";
import { getBook, getCharacters, touchBook } from "./books";
import { config } from "./config";
import { imageSize } from "./imagesize";
import { generateImage, OpenAIError, type ReferenceImage } from "./openai";
import { coverPrompt, pagePrompt } from "./prompts";
import { downloadFile, extensionFor, removeFiles, uploadFile } from "./storage";
import { check, ConfigError, db } from "./supabase";
import type { Book, Character, Job, Page } from "./types";

/** Seconds after which a "running" job is assumed dead and re-queued. */
const STALE_SECONDS = 600;

// ─── Enqueueing ──────────────────────────────────────────────────────────────

export async function enqueuePageJobs(bookId: string, pageIds: string[]) {
  if (pageIds.length === 0) return 0;
  const pages = check(
    await db().from("pages").select("id, position").eq("book_id", bookId).in("id", pageIds),
    "Load pages",
  ) as Pick<Page, "id" | "position">[];

  // Drop anything still waiting for these pages; newer request wins.
  await db()
    .from("jobs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .in("page_id", pages.map((p) => p.id))
    .eq("status", "queued");

  const inserted = check(
    await db()
      .from("jobs")
      .insert(pages.map((p) => ({ kind: "page", book_id: bookId, page_id: p.id, sort_key: p.position })))
      .select("id, page_id"),
    "Queue jobs",
  ) as { id: string; page_id: string }[];

  await Promise.all(
    inserted.map((j) =>
      db()
        .from("pages")
        .update({ status: "queued", error: null, current_job_id: j.id, updated_at: new Date().toISOString() })
        .eq("id", j.page_id),
    ),
  );
  await touchBook(bookId);
  return inserted.length;
}

export async function enqueueCoverJob(bookId: string) {
  await db()
    .from("jobs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("book_id", bookId)
    .eq("kind", "cover")
    .eq("status", "queued");
  const job = check(
    await db().from("jobs").insert({ kind: "cover", book_id: bookId, sort_key: -1 }).select("id").single(),
    "Queue cover",
  ) as { id: string };
  await db()
    .from("books")
    .update({ cover_status: "queued", cover_error: null, cover_job_id: job.id, approved_at: null, updated_at: new Date().toISOString() })
    .eq("id", bookId);
  return job.id;
}

// ─── Processing ──────────────────────────────────────────────────────────────

/** Claim one runnable job (respecting JOB_CONCURRENCY) and process it. */
export async function tick(): Promise<{ processed: boolean; jobId?: string; ok?: boolean; error?: string }> {
  const { data, error } = await db().rpc("claim_next_job", {
    p_max_concurrency: config.jobConcurrency,
    p_stale_seconds: STALE_SECONDS,
  });
  if (error) throw new Error(`Claim job: ${error.message}`);
  const job = (data as Job[] | null)?.[0];
  if (!job) return { processed: false };
  try {
    await processJob(job);
    return { processed: true, jobId: job.id, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await handleFailure(job, err);
    return { processed: true, jobId: job.id, ok: false, error: message };
  }
}

async function processJob(job: Job) {
  if (job.attempts > job.max_attempts) {
    throw new Error(job.error ?? "Too many attempts.");
  }
  if (job.kind === "page") return processPage(job);
  return processCover(job);
}

async function loadReferences(chars: Character[]): Promise<ReferenceImage[]> {
  return Promise.all(
    chars.map(async (c, i) => ({
      bytes: await downloadFile(c.image_path),
      mime: c.mime_type,
      filename: `reference-${i + 1}-${c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${extensionFor(c.mime_type)}`,
    })),
  );
}

function sizeFor(book: Book) {
  return book.page_size === "square" ? config.imageSizeSquare : config.imageSizePortrait;
}

async function finishJob(id: string, status: "succeeded" | "cancelled") {
  await db().from("jobs").update({ status, error: null, locked_at: null, updated_at: new Date().toISOString() }).eq("id", id);
}

async function processPage(job: Job) {
  const page = (await db().from("pages").select("*").eq("id", job.page_id!).maybeSingle()).data as Page | null;
  if (!page || page.current_job_id !== job.id) return finishJob(job.id, "cancelled");

  await db().from("pages").update({ status: "generating", updated_at: new Date().toISOString() }).eq("id", page.id);

  const book = await getBook(job.book_id);
  if (!book) return finishJob(job.id, "cancelled");
  const chars = await getCharacters(page.character_ids);
  const references = await loadReferences(chars);

  const bytes = await generateImage({ prompt: pagePrompt(page.prompt, chars), size: sizeFor(book), references });
  const dims = imageSize(bytes);
  if (!dims) throw new Error("Generated file is not a readable image.");

  const path = `books/${book.id}/pages/${page.id}-${Date.now()}.png`;
  await uploadFile(path, bytes, dims.type);

  // The page may have been regenerated or deleted while we were working.
  const latest = (await db().from("pages").select("current_job_id, image_path").eq("id", page.id).maybeSingle())
    .data as Pick<Page, "current_job_id" | "image_path"> | null;
  if (!latest || latest.current_job_id !== job.id) {
    await removeFiles([path]);
    return finishJob(job.id, "cancelled");
  }

  await db()
    .from("pages")
    .update({
      status: "complete",
      image_path: path,
      image_width: dims.width,
      image_height: dims.height,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", page.id);
  await removeFiles([latest.image_path]);
  await finishJob(job.id, "succeeded");
}

async function processCover(job: Job) {
  const book = await getBook(job.book_id);
  if (!book || book.cover_job_id !== job.id) return finishJob(job.id, "cancelled");

  await db().from("books").update({ cover_status: "generating" }).eq("id", book.id);

  const chars = await getCharacters(book.character_ids);
  const references = await loadReferences(chars);
  const prompt = book.cover_prompt?.trim()
    ? book.cover_prompt
    : coverPrompt(book, chars, book.cover_settings?.position ?? "top");

  const bytes = await generateImage({ prompt, size: sizeFor(book), references });
  const dims = imageSize(bytes);
  if (!dims) throw new Error("Generated cover is not a readable image.");

  const path = `books/${book.id}/cover-${Date.now()}.png`;
  await uploadFile(path, bytes, dims.type);

  const latest = await getBook(book.id);
  if (!latest || latest.cover_job_id !== job.id) {
    await removeFiles([path]);
    return finishJob(job.id, "cancelled");
  }
  await db()
    .from("books")
    .update({
      cover_status: "complete",
      cover_image_path: path,
      cover_width: dims.width,
      cover_height: dims.height,
      cover_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", book.id);
  await removeFiles([latest.cover_image_path]);
  await finishJob(job.id, "succeeded");
}

/** Retry transient failures with backoff; otherwise fail visibly. A failed
 *  page is never marked complete. */
async function handleFailure(job: Job, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const retryable = err instanceof OpenAIError ? err.retryable : !(err instanceof ConfigError);
  const now = new Date();

  if (retryable && job.attempts < job.max_attempts) {
    const base = err instanceof OpenAIError && err.status === 429 ? 60 : 15;
    const delay = base * 2 ** (job.attempts - 1);
    await db()
      .from("jobs")
      .update({
        status: "queued",
        error: message,
        locked_at: null,
        run_after: new Date(now.getTime() + delay * 1000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", job.id);
    const note = `Attempt ${job.attempts} failed (${message}). Retrying in ${delay}s.`;
    if (job.kind === "page") {
      await db().from("pages").update({ status: "queued", error: note }).eq("id", job.page_id!).eq("current_job_id", job.id);
    } else {
      await db().from("books").update({ cover_status: "queued", cover_error: note }).eq("id", job.book_id).eq("cover_job_id", job.id);
    }
    return;
  }

  await db()
    .from("jobs")
    .update({ status: "failed", error: message, locked_at: null, updated_at: now.toISOString() })
    .eq("id", job.id);
  if (job.kind === "page") {
    await db().from("pages").update({ status: "failed", error: message }).eq("id", job.page_id!).eq("current_job_id", job.id);
  } else {
    await db().from("books").update({ cover_status: "failed", cover_error: message }).eq("id", job.book_id).eq("cover_job_id", job.id);
  }
}
