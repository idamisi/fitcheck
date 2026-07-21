-- ═══════════════════════════════════════════════════════════════════════════
-- FitCheck — Supabase schema + RLS
-- Run each section in order in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. profiles ─────────────────────────────────────────────────────────────
-- One row per auth user. Created on first sign-in from the app.

create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles: own row select"
  on profiles for select
  using (id = auth.uid());

create policy "profiles: own row insert"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles: own row update"
  on profiles for update
  using (id = auth.uid());

create policy "profiles: own row delete"
  on profiles for delete
  using (id = auth.uid());


-- ─── 2. measurements ─────────────────────────────────────────────────────────
-- One row per user (enforced via unique constraint + upsert in the app).

create table if not exists measurements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  height         numeric,
  shoulder_width numeric,
  chest          numeric,
  waist          numeric,
  hip            numeric,
  inseam         numeric,
  updated_at     timestamptz default now(),
  unique (user_id)   -- ensures upsert on user_id replaces rather than duplicates
);

alter table measurements enable row level security;

create policy "measurements: own rows select"
  on measurements for select
  using (user_id = auth.uid());

create policy "measurements: own rows insert"
  on measurements for insert
  with check (user_id = auth.uid());

create policy "measurements: own rows update"
  on measurements for update
  using (user_id = auth.uid());

create policy "measurements: own rows delete"
  on measurements for delete
  using (user_id = auth.uid());


-- ─── 3. saved_items ──────────────────────────────────────────────────────────

create table if not exists saved_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  catalog_item_id text not null,
  created_at     timestamptz default now()
);

alter table saved_items enable row level security;

create policy "saved_items: own rows select"
  on saved_items for select
  using (user_id = auth.uid());

create policy "saved_items: own rows insert"
  on saved_items for insert
  with check (user_id = auth.uid());

create policy "saved_items: own rows update"
  on saved_items for update
  using (user_id = auth.uid());

create policy "saved_items: own rows delete"
  on saved_items for delete
  using (user_id = auth.uid());


-- ─── 4. saved_outfits ────────────────────────────────────────────────────────

create table if not exists saved_outfits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles (id) on delete cascade,
  name             text,                 -- nullable: user can optionally name an outfit
  catalog_item_ids text[] not null,      -- ordered array of CatalogItem.id values
  created_at       timestamptz default now()
);

alter table saved_outfits enable row level security;

create policy "saved_outfits: own rows select"
  on saved_outfits for select
  using (user_id = auth.uid());

create policy "saved_outfits: own rows insert"
  on saved_outfits for insert
  with check (user_id = auth.uid());

create policy "saved_outfits: own rows update"
  on saved_outfits for update
  using (user_id = auth.uid());

create policy "saved_outfits: own rows delete"
  on saved_outfits for delete
  using (user_id = auth.uid());
