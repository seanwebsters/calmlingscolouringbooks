"use client";

import { money } from "@/lib/client";
import { useApi } from "@/lib/hooks";
import type { PageSize } from "@/lib/types";

type Estimate = { total: number; breakdown: { label: string; amount: number }[]; note: string };

export function CostEstimate({
  pages,
  pageSize,
  refs,
  cover = true,
  plan = false,
  className = "",
}: {
  pages: number;
  pageSize: PageSize;
  refs: number;
  cover?: boolean;
  plan?: boolean;
  className?: string;
}) {
  const est = useApi<Estimate>(`/api/estimate?pages=${pages}&size=${pageSize}&refs=${refs}&cover=${cover ? 1 : 0}&plan=${plan ? 1 : 0}`);
  if (!est.data) return null;
  return (
    <div className={`rounded-2xl border border-line bg-cream/60 p-4 text-sm ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-navy">Estimated cost</span>
        <span className="font-serif text-xl text-navy">≈ {money(est.data.total)}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-navy-soft">
        {est.data.breakdown.map((b) => (
          <li key={b.label} className="flex justify-between">
            <span>{b.label}</span>
            <span>{money(b.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-mist">{est.data.note}</p>
    </div>
  );
}
