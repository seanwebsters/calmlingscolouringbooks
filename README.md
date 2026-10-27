# Calmlings Book Studio

An AI-powered studio for producing sophisticated adult colouring books featuring the Calmlings characters.

**Upload characters → Describe book → Review plan → Generate → Review pages → Export.**

- **Character library.** Upload the official reference artwork for each character. The images are stored in Supabase and sent to the image model as **visual references** (OpenAI `images/edits` with multiple `image[]` inputs). They are not reduced to text descriptions. Each page sends only the characters that appear on it.
- **Book planning.** A text model writes a structured page-by-page plan with a unique scene for every page, plus a cover concept and a cover palette that differs from your other books. You can edit any scene, its title and which characters appear before anything is generated.
- **Background generation.** Every page and the cover becomes a job in a persistent Postgres queue, so nothing depends on one long request. A database function enforces a global concurrency limit. Transient failures (429, 5xx, network) retry with backoff. Permanent failures stay **failed** with the error shown and a retry button; a failed page is never marked complete. Progress is saved after every page, so generation resumes after a restart.
- **Cover generator.** Full-colour artwork in the book's own palette. The title, subtitle and Calmlings logo are real overlays, editable at any time. They are not AI-generated text.
- **Review editor.** You can view every page large, edit its prompt, regenerate it, reorder (drag or arrows), delete, insert or add pages, and regenerate the cover. Every change is saved immediately. Any change to the pages or cover withdraws approval.
- **Export.** Separate front-cover and interior PDFs (pdf-lib), with correct trim sizes, equal 0.5″ margins and page order. The interior is single-sided by default (a blank back after each illustration). The cover includes 0.125″ bleed with a trim box. Images are embedded at their native resolution and **never upscaled**. Files are labelled **Print-ready** only when every page and the cover reach 300 DPI, the cover is generated and the book is approved. Otherwise the filename and PDF metadata say **Draft proof — not print-ready**.
- **Library.** Your books appear as cover cards showing page count, status, and Edit, Export and Sequel buttons. Sequel duplicates a book's characters and settings into a new volume with a fresh plan and palette.

> **Character consistency is not guaranteed.** Reference images and strict instructions (never invent tails, noses, limbs, clothing or accessories) strongly guide the model, but it can still drift. Review every page and regenerate when needed.

## Tech stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase (Postgres + Storage), the OpenAI API (text planning + `gpt-image-1` artwork) and pdf-lib.

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migration in `supabase/migrations/`, using **either**:
   - **SQL editor:** paste in the contents of `supabase/migrations/20261027000000_init.sql` and run it, **or**
   - **CLI:** `supabase link --project-ref <ref> && supabase db push`.

   This creates the tables (`characters`, `brand_settings`, `books`, `pages`, `jobs`), the queue functions (`claim_next_job`, `reorder_pages`) and the private `calmlings` storage bucket.
3. Copy the **Project URL** and the **service_role** key (Project Settings → API) into `.env.local` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The service-role key is used **only on the server**. The browser never talks to Supabase directly; images are streamed through `/api/image`, and RLS is enabled with no public policies.

### 3. OpenAI

Set `OPENAI_API_KEY`. Your organisation needs access to the image model (`gpt-image-1` by default, which may require organisation verification). You can change the models, quality and output sizes in `.env.local`; see `.env.example`.

### 4. Run

```bash
npm run dev        # http://localhost:3000
```

If any credentials are missing, the app shows a banner naming the exact variables to add.

#### Keeping generation running

Jobs are processed by calling `POST /api/jobs/tick`, which claims and processes one job. Two things drive it:

- **The open book page.** While generation is in progress, the page runs `JOB_CONCURRENCY` loops against the tick endpoint.
- **The worker script.** It keeps generating when no tab is open:

  ```bash
  npm run worker                      # BASE_URL defaults to http://localhost:3000
  ```

Whichever driver is running, the database enforces the concurrency limit, so running both is safe.

## Deploying to Vercel

1. Import the repository into Vercel and add the same environment variables.
2. Set `APP_PASSWORD` to protect the studio with HTTP basic auth. Any username works; only the password is checked. Without it, anyone with the URL could spend your OpenAI credit.
3. Vercel limits request bodies to 4.5 MB, so keep character reference and logo uploads below that size when deployed. Locally, files up to 20 MB are accepted.
4. Generation routes use `maxDuration = 300`, so image calls of up to 5 minutes complete. This needs Fluid Compute, which is on by default for new projects.
5. *(Optional)* To process the queue with no browser open, set `CRON_SECRET` and schedule `GET /api/jobs/cron` with the header `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends this header automatically. Add the following to `vercel.json`. On the Hobby plan, cron jobs can run at most once a day, so use the Pro plan or an external scheduler for minute-level draining.

   ```json
   { "crons": [{ "path": "/api/jobs/cron", "schedule": "* * * * *" }] }
   ```

## Print resolution: what to expect

| Trim | Art area | 300 DPI needs | Default `gpt-image-1` output | Effective DPI |
| --- | --- | --- | --- | --- |
| 8.5 × 11″ interior | 7.5 × 10″ | 2250 × 3000 px | 1024 × 1536 | ~154 |
| 8.5 × 8.5″ interior | 7.5 × 7.5″ | 2250 × 2250 px | 1024 × 1024 | ~137 |
| Cover + bleed (8.5 × 11″) | 8.75 × 11.25″ | 2625 × 3375 px | 1024 × 1536 | ~117 |

The current OpenAI image sizes fall short of true 300 DPI at these trim sizes. The app says so on every page card, in the export checklist and in the exported files. It does **not** upscale and claim 300 DPI. When a model with larger outputs becomes available, set `OPENAI_IMAGE_MODEL` and `OPENAI_IMAGE_SIZE_*` and the labels update automatically. You can also upscale externally, with a tool you trust, before printing.

## Costs

Before planning and before each generation run, the studio shows an estimate built from the `COST_PER_*` values in your environment. The defaults approximate `gpt-image-1` high-quality pricing. Check current OpenAI pricing and adjust them. Regenerations cost extra.

## Project structure

```
app/
  page.tsx                  Library (cover cards)
  characters/               Character library + logo
  books/new/                Create-a-book form
  books/[id]/               Workspace: Plan → Pages → Cover → Export
  api/                      Route handlers (all secrets stay server-side)
    books/[id]/plan         AI page plan
    books/[id]/generate     Queue pages + cover
    jobs/tick, jobs/cron    Queue processing
    books/[id]/export       PDF export → signed download URL
components/                 UI (cards, cover preview, workspace tabs)
lib/
  prompts.ts                Art direction + character-fidelity prompts
  planner.ts                Structured planning with the text model
  openai.ts                 Minimal fetch-based OpenAI client
  jobs.ts                   Persistent queue: enqueue, claim, process, retry
  pdf.ts                    Interior + cover PDF builders
  print.ts, readiness.ts    Print geometry, DPI and print-ready checks
supabase/migrations/        Database schema
scripts/worker.mjs          Optional local queue worker
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run worker` | Drain the generation queue without a browser tab |
