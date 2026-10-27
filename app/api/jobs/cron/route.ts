import { handler, HttpError, json } from "@/lib/api";
import { config } from "@/lib/config";
import { tick } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Drain the queue for up to ~4 minutes. Point a scheduler (e.g. Vercel Cron)
 *  at this route with `Authorization: Bearer $CRON_SECRET`. */
export const GET = handler(async (req: Request) => {
  if (!config.cronSecret || req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    throw new HttpError(401, "Unauthorised.");
  }
  const deadline = Date.now() + 240_000;
  let processed = 0;
  const lane = async () => {
    while (Date.now() < deadline) {
      const r = await tick();
      if (!r.processed) return;
      processed++;
    }
  };
  await Promise.all(Array.from({ length: config.jobConcurrency }, lane));
  return json({ processed });
});
