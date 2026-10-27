import { json } from "@/lib/api";
import { config, getConfigStatus } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    ...getConfigStatus(),
    textModel: config.textModel,
    imageModel: config.imageModel,
    concurrency: config.jobConcurrency,
  });
}
