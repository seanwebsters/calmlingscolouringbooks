/** Browser-side fetch helper: throws the API's error message on failure. */
export class ApiError extends Error {
  status: number;
  configuration: boolean;
  constructor(message: string, status: number, configuration = false) {
    super(message);
    this.status = status;
    this.configuration = configuration;
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, !!body.configuration);
  return body as T;
}

export function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
