-- Codal Recall — Supabase (Postgres) schema
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.

-- ============ Shared codal library (read by everyone, edited by admins) ============
create table if not exists public.codes (
  id          text primary key,              -- 'civ', 'rpc', 'const', 'roc', 'fc', 'labor', ...
  name        text not null,                 -- 'Civil Code of the Philippines'
  short       text not null,                 -- 'Civil Code'
  law         text,                          -- 'Republic Act No. 386'
  created_at  timestamptz not null default now()
);

create table if not exists public.provisions (
  id          text primary key,              -- '<code_id>:<slug(label)>', e.g. 'civ:art-1156'
  code_id     text not null references public.codes(id) on delete cascade,
  label       text not null,                 -- 'Art. 1156', 'Art. III, Sec. 2', 'Rule 110, Sec. 1'
  heading     text,                          -- 'Book IV — Obligations · Chapter 1 — General Provisions'
  text        text not null,
  note        text,                          -- amendment notes, e.g. 'As amended by E.O. No. 227'
  sort        integer not null default 0,    -- display order within the code
  updated_at  timestamptz not null default now(),
  unique (code_id, label)
);
create index if not exists provisions_code_sort on public.provisions (code_id, sort);

-- ============ Per-user study data ============
create table if not exists public.cards (
  id             text primary key,           -- generated on the device (UUID)
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provision_id   text not null,              -- matches provisions.id (or a user's local import)
  type           text not null check (type in ('cloze', 'identify')),
  blanks         integer[] not null default '{}',  -- token indexes hidden in a fill-in-the-blank card
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted        boolean not null default false,   -- soft delete so deletions sync across devices
  -- SM-2 spaced-repetition state
  ease           real not null default 2.5,
  interval_days  integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  due            timestamptz not null default now(),
  last_reviewed  timestamptz
);
create index if not exists cards_user_due on public.cards (user_id, due);

create table if not exists public.reviews (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id      text not null,
  grade        smallint not null check (grade between 1 and 5),  -- 1 again, 3 hard, 4 good, 5 easy
  reviewed_at  timestamptz not null default now()
);
create index if not exists reviews_user_time on public.reviews (user_id, reviewed_at);

-- ============ Row Level Security ============
alter table public.codes      enable row level security;
alter table public.provisions enable row level security;
alter table public.cards      enable row level security;
alter table public.reviews    enable row level security;

-- Anyone (even signed out) can read the library. Writes only via the dashboard / service role.
drop policy if exists "library read" on public.codes;
create policy "library read" on public.codes for select using (true);
drop policy if exists "library read" on public.provisions;
create policy "library read" on public.provisions for select using (true);

-- Each user can only see and change their own cards and reviews.
drop policy if exists "own cards" on public.cards;
create policy "own cards" on public.cards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own reviews" on public.reviews;
create policy "own reviews" on public.reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
