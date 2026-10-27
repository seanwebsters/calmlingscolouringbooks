import "server-only";
import { ALLOWED_IMAGE_TYPES, HttpError, MAX_UPLOAD_BYTES } from "./api";
import { imageSize } from "./imagesize";

/** Validate an uploaded image File and return its bytes + detected type. */
export async function readImageUpload(file: FormDataEntryValue | null, allowed = ALLOWED_IMAGE_TYPES) {
  if (!file || typeof file === "string") throw new HttpError(400, "Please choose an image file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Images must be under 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = imageSize(bytes);
  if (!info || !allowed.includes(info.type)) {
    throw new HttpError(415, `Unsupported image. Please upload ${allowed.map((t) => t.split("/")[1].toUpperCase()).join(", ")}.`);
  }
  return { bytes, mime: info.type, width: info.width, height: info.height };
}
