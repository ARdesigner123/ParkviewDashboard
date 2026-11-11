-- Run this once in the Supabase SQL Editor before deploying the app.
-- These open policies allow anyone with the public site URL to edit markers.
create table if not exists public.parkview_marker_state (
  project_id text primary key,
  markers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.parkview_marker_state enable row level security;

grant select, insert, update, delete
  on table public.parkview_marker_state
  to anon, authenticated;

drop policy if exists "Public can read Parkview marker state"
  on public.parkview_marker_state;
create policy "Public can read Parkview marker state"
  on public.parkview_marker_state for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create Parkview marker state"
  on public.parkview_marker_state;
create policy "Public can create Parkview marker state"
  on public.parkview_marker_state for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update Parkview marker state"
  on public.parkview_marker_state;
create policy "Public can update Parkview marker state"
  on public.parkview_marker_state for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public can delete Parkview marker state"
  on public.parkview_marker_state;
create policy "Public can delete Parkview marker state"
  on public.parkview_marker_state for delete
  to anon, authenticated
  using (true);
