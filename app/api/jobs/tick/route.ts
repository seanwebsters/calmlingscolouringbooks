import { handler, json } from "@/lib/api";
import { tick } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Process at most one queued job. Called by open browser tabs, the local
 *  worker script, or the cron route. Concurrency is enforced in the database. */
export const POST = handler(async () => json(await tick()));
