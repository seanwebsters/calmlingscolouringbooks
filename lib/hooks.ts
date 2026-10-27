"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./client";

/** Load JSON from an API route with loading / error state and a refresh(). */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url);

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const result = await api<T>(url);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(String(err), 0));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, setData, error, loading, refresh };
}

/** While `active`, keep `lanes` loops calling the queue's tick endpoint so
 *  generation proceeds from the browser (the DB enforces global concurrency). */
export function useQueuePump(active: boolean, lanes: number, onProgress: () => void) {
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const lane = async (offset: number) => {
      await sleep(offset);
      while (!stopped) {
        try {
          const r = await api<{ processed: boolean }>("/api/jobs/tick", { method: "POST" });
          if (stopped) return;
          progressRef.current();
          if (!r.processed) await sleep(4000);
        } catch {
          await sleep(8000);
        }
      }
    };
    for (let i = 0; i < Math.max(1, lanes); i++) void lane(i * 700);
    // Poll for state changes made by other lanes/workers.
    const poll = setInterval(() => progressRef.current(), 3000);
    return () => {
      stopped = true;
      clearInterval(poll);
    };
  }, [active, lanes]);
}
