import "server-only";
import { deriveStatus } from "./books";
import { assessReadiness } from "./readiness";
import { imageUrl } from "./storage";
import type { Book, Character, Page } from "./types";

export function characterView(c: Character) {
  return { ...c, image_url: imageUrl(c.image_path)! };
}

export function pageView(p: Page) {
  return { ...p, image_url: imageUrl(p.image_path) };
}

export function bookView(book: Book, pages: Page[]) {
  return {
    ...book,
    cover_url: imageUrl(book.cover_image_path),
    status_label: deriveStatus(book, pages),
    pages: pages.map(pageView),
    readiness: assessReadiness(book, pages),
  };
}

export type CharacterView = ReturnType<typeof characterView>;
export type PageView = ReturnType<typeof pageView>;
export type BookView = ReturnType<typeof bookView>;
