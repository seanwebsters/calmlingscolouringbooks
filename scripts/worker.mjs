// Background worker: keeps draining the generation queue even when no browser
// tab is open. Usage: `npm run worker` (with the app running).
//   BASE_URL=http://localhost:3000 JOB_CONCURRENCY=2 APP_PASSWORD=... npm run worker
const base = process.env.BASE_URL ?? "http://localhost:3000";
const lanes = Number(process.env.JOB_CONCURRENCY ?? 2);
const headers = process.env.APP_PASSWORD
  ? { Authorization: "Basic " + Buffer.from(`studio:${process.env.APP_PASSWORD}`).toString("base64") }
  : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lane(n) {
  for (;;) {
    try {
      const res = await fetch(`${base}/api/jobs/tick`, { method: "POST", headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`[lane ${n}] ${res.status} ${body.error ?? ""}`);
        await sleep(10_000);
      } else if (!body.processed) {
        await sleep(5_000);
      } else {
        console.log(`[lane ${n}] job ${body.jobId} ${body.ok ? "done" : `failed: ${body.error}`}`);
      }
    } catch (err) {
      console.error(`[lane ${n}] ${err.message}`);
      await sleep(10_000);
    }
  }
}

console.log(`Calmlings worker → ${base} (${lanes} lanes)`);
await Promise.all(Array.from({ length: lanes }, (_, i) => lane(i + 1)));
