import { handler, HttpError } from "@/lib/api";
import { downloadFile } from "@/lib/storage";
import { imageSize } from "@/lib/imagesize";

/** Streams a stored image. Storage paths are content-addressed (new path per
 *  generation), so responses can be cached aggressively. */
export const GET = handler(async (req: Request) => {
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!/^(characters|brand|books)\/[\w\-./]+$/.test(path) || path.includes("..")) {
    throw new HttpError(400, "Invalid image path.");
  }
  const bytes = await downloadFile(path);
  const type = imageSize(bytes)?.type ?? "application/octet-stream";
  return new Response(bytes as BodyInit, {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
});
