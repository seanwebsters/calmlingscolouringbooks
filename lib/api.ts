import "server-only";
import { NextResponse } from "next/server";
import { OpenAIError } from "./openai";
import { ConfigError } from "./supabase";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof ConfigError) {
    return json({ error: err.message, configuration: true }, 503);
  }
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  if (err instanceof OpenAIError) return json({ error: err.message }, err.status >= 400 && err.status < 600 ? err.status : 502);
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  return json({ error: message }, 500);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wrap a route handler so every error becomes a readable JSON response. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export type IdParams = { params: Promise<{ id: string }> };

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
