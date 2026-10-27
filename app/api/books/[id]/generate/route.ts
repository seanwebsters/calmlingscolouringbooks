import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { getBook, getPages } from "@/lib/books";
import { getConfigStatus } from "@/lib/config";
import { enqueueCoverJob, enqueuePageJobs } from "@/lib/jobs";
import { ConfigError } from "@/lib/supabase";

/** Queue generation. scope "missing" = pages without artwork or that failed;
 *  "all" = every page. The cover is queued too unless it already exists. */
export const POST = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!getConfigStatus().openai) throw new ConfigError("OpenAI is not configured (OPENAI_API_KEY).");
  const body = await readJson<{ scope?: "missing" | "all"; cover?: boolean }>(req).catch(() => ({}) as { scope?: "missing" | "all"; cover?: boolean });
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const pages = await getPages(id);
  if (pages.length === 0) throw new HttpError(400, "Create the page plan first.");

  const targets =
    body.scope === "all"
      ? pages.filter((p) => p.status !== "queued" && p.status !== "generating")
      : pages.filter((p) => p.status === "pending" || p.status === "failed");
  const queued = await enqueuePageJobs(id, targets.map((p) => p.id));

  let coverQueued = false;
  const wantCover = body.cover ?? true;
  if (wantCover && (book.cover_status === "none" || book.cover_status === "failed")) {
    await enqueueCoverJob(id);
    coverQueued = true;
  }
  return json({ queued, coverQueued });
});
