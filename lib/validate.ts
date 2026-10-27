import { HttpError } from "./api";
import type { PageSize } from "./types";

export type CreateBookBody = {
  title?: string;
  description?: string;
  character_ids?: string[];
  page_count?: number;
  page_size?: PageSize;
};

export function validateBookInput(body: CreateBookBody) {
  const title = (body.title ?? "").trim();
  if (!title) throw new HttpError(400, "Please give the book a title.");
  const page_count = Number(body.page_count ?? 20);
  if (![10, 20, 30, 40].includes(page_count)) throw new HttpError(400, "Page count must be 10, 20, 30 or 40.");
  const page_size = body.page_size === "square" ? "square" : "letter";
  const character_ids = Array.isArray(body.character_ids) ? body.character_ids.filter((x) => typeof x === "string") : [];
  return { title, description: (body.description ?? "").trim(), page_count, page_size, character_ids };
}
