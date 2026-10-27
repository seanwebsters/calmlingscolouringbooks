import { json } from "@/lib/api";
import { estimateCost } from "@/lib/cost";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const pages = Math.max(0, Math.min(200, Number(q.get("pages") ?? 20) || 0));
  const size = q.get("size") === "square" ? "square" : "letter";
  const refs = Math.max(0, Math.min(10, Number(q.get("refs") ?? 0) || 0));
  return json(
    estimateCost({
      pages,
      pageSize: size,
      referencesPerImage: refs,
      includeCover: q.get("cover") !== "0",
      includePlan: q.get("plan") === "1",
    }),
  );
}
