import "server-only";

/** Server-side configuration. Values are read lazily so missing keys produce
 *  a friendly configuration message rather than a crash at import time. */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

export const config = {
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY ?? "";
  },
  get supabaseUrl() {
    return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  },
  get supabaseServiceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get openaiBaseUrl() {
    return str("OPENAI_BASE_URL", "https://api.openai.com/v1").replace(/\/$/, "");
  },
  get bucket() {
    return str("SUPABASE_BUCKET", "calmlings");
  },
  get textModel() {
    return str("OPENAI_TEXT_MODEL", "gpt-4.1");
  },
  get imageModel() {
    return str("OPENAI_IMAGE_MODEL", "gpt-image-1");
  },
  get imageQuality() {
    return str("OPENAI_IMAGE_QUALITY", "high");
  },
  get inputFidelity() {
    // Empty string disables the parameter for models that don't support it.
    return process.env.OPENAI_INPUT_FIDELITY ?? "high";
  },
  get imageSizePortrait() {
    return str("OPENAI_IMAGE_SIZE_PORTRAIT", "1024x1536");
  },
  get imageSizeSquare() {
    return str("OPENAI_IMAGE_SIZE_SQUARE", "1024x1024");
  },
  get costPerImagePortrait() {
    return num("COST_PER_IMAGE_PORTRAIT", 0.25);
  },
  get costPerImageSquare() {
    return num("COST_PER_IMAGE_SQUARE", 0.17);
  },
  get costPerReferenceImage() {
    return num("COST_PER_REFERENCE_IMAGE", 0.01);
  },
  get costPerPlan() {
    return num("COST_PER_PLAN", 0.05);
  },
  get jobConcurrency() {
    return Math.max(1, Math.min(8, num("JOB_CONCURRENCY", 2)));
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
};

export type ConfigStatus = {
  ok: boolean;
  missing: string[];
  openai: boolean;
  supabase: boolean;
};

export function getConfigStatus(): ConfigStatus {
  const missing: string[] = [];
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return {
    ok: missing.length === 0,
    missing,
    openai: !!config.openaiApiKey,
    supabase: !!config.supabaseUrl && !!config.supabaseServiceRoleKey,
  };
}
