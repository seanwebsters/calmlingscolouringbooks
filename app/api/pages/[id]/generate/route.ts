import { handler, HttpError, json, type IdParams } from "@/lib/api";
import { getConfigStatus } from "@/lib/config";
import { enqueuePageJobs } from "@/lib/jobs";
import { db } from "@/lib/supabase";
import { ConfigError } from "@/lib/supabase";

/** Queue (re)generation of a single page. */
export const POST = handler(async (_req: Request, { params }: IdParams) => {
  const { id } = await params;
  if (!getConfigStatus().openai) throw new ConfigError("OpenAI is not configured (OPENAI_API_KEY).");
  const page = (await db().from("pages").select("id, book_id").eq("id", id).maybeSingle()).data as { id: string; book_id: string } | null;
  if (!page) throw new HttpError(404, "Page not found.");
  await enqueuePageJobs(page.book_id, [page.id]);
  return json({ queued: 1 });
});
