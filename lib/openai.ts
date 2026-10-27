import "server-only";
import { config } from "./config";
import { ConfigError } from "./supabase";

/** Thin fetch-based OpenAI client: keeps the key server-side and avoids SDK
 *  version drift. Only the two endpoints this app needs are wrapped. */

export class OpenAIError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
    this.retryable = status === 0 || status === 408 || status === 409 || status === 429 || status >= 500;
  }
}

function key() {
  if (!config.openaiApiKey) throw new ConfigError("OpenAI is not configured (OPENAI_API_KEY).");
  return config.openaiApiKey;
}

async function request(path: string, init: RequestInit, timeoutMs: number): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${config.openaiBaseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new OpenAIError(`Network error contacting OpenAI: ${msg}`, 0);
  }
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const detail = body?.error?.message ?? text.slice(0, 300) ?? res.statusText;
    throw new OpenAIError(`OpenAI ${res.status}: ${detail}`, res.status);
  }
  return body;
}

/** Ask the text model for JSON matching `schema` (structured outputs). */
export async function chatJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<T> {
  const body = await request(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.textModel,
        temperature: opts.temperature ?? 0.9,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
      }),
    },
    180_000,
  );
  const message = body?.choices?.[0]?.message;
  if (message?.refusal) throw new OpenAIError(`Model refused: ${message.refusal}`, 400);
  if (!message?.content) throw new OpenAIError("Empty response from text model.", 502);
  try {
    return JSON.parse(message.content) as T;
  } catch {
    throw new OpenAIError("Text model returned invalid JSON.", 502);
  }
}

export type ReferenceImage = { bytes: Uint8Array; mime: string; filename: string };

/** Generate one image. When reference images are supplied they are sent to
 *  the edits endpoint so the model sees the actual character artwork. */
export async function generateImage(opts: {
  prompt: string;
  size: string;
  references: ReferenceImage[];
}): Promise<Uint8Array> {
  const timeout = 300_000;
  let body: any;
  if (opts.references.length > 0) {
    const form = new FormData();
    form.append("model", config.imageModel);
    form.append("prompt", opts.prompt);
    form.append("size", opts.size);
    form.append("quality", config.imageQuality);
    form.append("n", "1");
    if (config.inputFidelity) form.append("input_fidelity", config.inputFidelity);
    for (const ref of opts.references) {
      const blob = new Blob([ref.bytes as BlobPart], { type: ref.mime });
      form.append("image[]", blob, ref.filename);
    }
    body = await request("/images/edits", { method: "POST", body: form }, timeout);
  } else {
    body = await request(
      "/images/generations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.imageModel,
          prompt: opts.prompt,
          size: opts.size,
          quality: config.imageQuality,
          n: 1,
        }),
      },
      timeout,
    );
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) {
    const url = body?.data?.[0]?.url;
    if (url) {
      const res = await fetch(url);
      if (!res.ok) throw new OpenAIError(`Could not download generated image (${res.status}).`, res.status);
      return new Uint8Array(await res.arrayBuffer());
    }
    throw new OpenAIError("Image API returned no image data.", 502);
  }
  return Uint8Array.from(Buffer.from(b64, "base64"));
}
