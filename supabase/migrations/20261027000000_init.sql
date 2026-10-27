-- Calmlings Book Studio — initial schema.
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ─── Characters ─────────────────────────────────────────────────────────────
create table if not exists characters (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text not null default '',
  image_path   text not null,
  mime_type    text not null default 'image/png',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Brand assets (single row: the Calmlings logo) ──────────────────────────
create table if not exists brand_settings (
  id              int primary key default 1 check (id = 1),
  logo_path       text,
  logo_mime_type  text,
  updated_at      timestamptz not null default now()
);
insert into brand_settings (id) values (1) on conflict do nothing;

-- ─── Books ──────────────────────────────────────────────────────────────────
create table if not exists books (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null default '',
  page_size       text not null default 'letter' check (page_size in ('letter', 'square')),
  page_count      int  not null default 20 check (page_count in (10, 20, 30, 40)),
  character_ids   uuid[] not null default '{}',
  palette         jsonb,            -- { name, colors: [hex...] }
  cover_concept   text not null default '',
  cover_prompt    text not null default '',
  cover_settings  jsonb not null default '{}'::jsonb,
  cover_status    text not null default 'none'
                  check (cover_status in ('none', 'queued', 'generating', 'complete', 'failed')),
  cover_image_path text,
  cover_width     int,
  cover_height    int,
  cover_error     text,
  cover_job_id    uuid,
  plan_status     text not null default 'none'
                  check (plan_status in ('none', 'planning', 'ready', 'failed')),
  plan_error      text,
  approved_at     timestamptz,
  parent_book_id  uuid references books(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Pages ──────────────────────────────────────────────────────────────────
create table if not exists pages (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references books(id) on delete cascade,
  position        int  not null,
  title           text not null default '',
  prompt          text not null,
  character_ids   uuid[] not null default '{}',
  status          text not null default 'pending'
                  check (status in ('pending', 'queued', 'generating', 'complete', 'failed')),
  image_path      text,
  image_width     int,
  image_height    int,
  error           text,
  current_job_id  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pages_book_position_idx on pages (book_id, position);

-- ─── Persistent job queue ───────────────────────────────────────────────────
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('page', 'cover')),
  book_id       uuid not null references books(id) on delete cascade,
  page_id       uuid references pages(id) on delete cascade,
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts      int  not null default 0,
  max_attempts  int  not null default 3,
  sort_key      int  not null default 0,
  error         text,
  run_after     timestamptz not null default now(),
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists jobs_status_idx on jobs (status, run_after, created_at);
create index if not exists jobs_book_idx on jobs (book_id);

-- Atomically claim the next runnable job while respecting a global
-- concurrency limit. Jobs whose worker died (stale lock) are re-queued.
create or replace function claim_next_job(p_max_concurrency int, p_stale_seconds int)
returns setof jobs
language plpgsql
as $$
declare
  v_job jobs;
begin
  -- Serialise claimers so the concurrency check is accurate.
  perform pg_advisory_xact_lock(727274);

  update jobs
     set status = 'queued', locked_at = null, updated_at = now(),
         error = 'Worker stopped responding; re-queued.'
   where status = 'running'
     and locked_at < now() - make_interval(secs => p_stale_seconds);

  if (select count(*) from jobs where status = 'running') >= p_max_concurrency then
    return;
  end if;

  select * into v_job
    from jobs
   where status = 'queued' and run_after <= now()
   order by created_at, sort_key
   for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  update jobs
     set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
   where id = v_job.id
  returning * into v_job;

  return next v_job;
end;
$$;

-- Reorder pages in one statement (ids in their new order).
create or replace function reorder_pages(p_book_id uuid, p_page_ids uuid[])
returns void
language sql
as $$
  update pages p
     set position = o.ord - 1, updated_at = now()
    from unnest(p_page_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.book_id = p_book_id;
$$;

-- ─── Storage bucket (private; served through the app) ───────────────────────
insert into storage.buckets (id, name, public)
values ('calmlings', 'calmlings', false)
on conflict (id) do nothing;

-- This app talks to Supabase only from the server with the service role key,
-- so RLS is enabled with no public policies (anon key gets no access).
alter table characters     enable row level security;
alter table brand_settings enable row level security;
alter table books          enable row level security;
alter table pages          enable row level security;
alter table jobs           enable row level security;
