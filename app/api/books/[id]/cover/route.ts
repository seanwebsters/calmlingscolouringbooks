import { handler, HttpError, json, readJson, type IdParams } from "@/lib/api";
import { getBook, getCharacters } from "@/lib/books";
import { getConfigStatus } from "@/lib/config";
import { enqueueCoverJob } from "@/lib/jobs";
import { coverPrompt } from "@/lib/prompts";
import { ConfigError } from "@/lib/supabase";
import { db } from "@/lib/supabase";

/** GET: the prompt that will be used for the cover (for editing).
 *  POST: queue cover (re)generation, optionally saving a custom prompt. */
export const GET = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const chars = await getCharacters(book.character_ids);
  const generated = coverPrompt(book, chars, book.cover_settings?.position ?? "top");
  return json({ prompt: book.cover_prompt || generated, custom: !!book.cover_prompt, generated });
});

export const POST = handler(async (req: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!getConfigStatus().openai) throw new ConfigError("OpenAI is not configured (OPENAI_API_KEY).");
  const book = await getBook(id);
  if (!book) throw new HttpError(404, "Book not found.");
  const body = await readJson<{ cover_prompt?: string; cover_concept?: string }>(req).catch(() => ({}) as { cover_prompt?: string; cover_concept?: string });
  const update: Record<string, string> = {};
  if (body.cover_prompt !== undefined) update.cover_prompt = body.cover_prompt.trim();
  if (body.cover_concept !== undefined) update.cover_concept = body.cover_concept.trim();
  if (Object.keys(update).length) await db().from("books").update(update).eq("id", id);
  const jobId = await enqueueCoverJob(id);
  return json({ jobId });
});
