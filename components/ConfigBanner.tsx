import { getConfigStatus } from "@/lib/config";

/** Server component: explains exactly which environment variables are missing. */
export function ConfigBanner() {
  const status = getConfigStatus();
  if (status.ok) return null;
  return (
    <div className="border-b border-peach bg-peach/40">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 text-sm text-peach-deep">
        <strong className="font-semibold">Setup needed.</strong> Add{" "}
        {status.missing.map((m, i) => (
          <span key={m}>
            <code className="rounded bg-paper/70 px-1.5 py-0.5 font-mono text-[12px]">{m}</code>
            {i < status.missing.length - 1 ? ", " : ""}
          </span>
        ))}{" "}
        to <code className="font-mono text-[12px]">.env.local</code> (see <code className="font-mono text-[12px]">.env.example</code> and the README), run the
        database migration, then restart the server.
        {!status.supabase && " Without Supabase, books and characters cannot be loaded or saved."}
        {status.supabase && !status.openai && " You can manage characters and books, but planning and artwork generation are disabled."}
      </div>
    </div>
  );
}
