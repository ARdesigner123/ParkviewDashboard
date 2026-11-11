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

create table if not exists public.parkview_markers (
  site_id text not null,
  layout_id text not null,
  marker_id text not null,
  marker jsonb not null,
  primary key (site_id, layout_id, marker_id)
);

alter table public.parkview_markers enable row level security;

grant select, insert, update, delete
  on table public.parkview_markers
  to anon, authenticated;

drop policy if exists "Public can read Parkview markers"
  on public.parkview_markers;
create policy "Public can read Parkview markers"
  on public.parkview_markers for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create Parkview markers"
  on public.parkview_markers;
create policy "Public can create Parkview markers"
  on public.parkview_markers for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update Parkview markers"
  on public.parkview_markers;
create policy "Public can update Parkview markers"
  on public.parkview_markers for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public can delete Parkview markers"
  on public.parkview_markers;
create policy "Public can delete Parkview markers"
  on public.parkview_markers for delete
  to anon, authenticated
  using (true);

create table if not exists public.parkview_marker_sites (
  site_id text primary key,
  initialized_at timestamptz not null default now()
);

alter table public.parkview_marker_sites enable row level security;

grant select, insert
  on table public.parkview_marker_sites
  to anon, authenticated;

drop policy if exists "Public can read Parkview marker sites"
  on public.parkview_marker_sites;
create policy "Public can read Parkview marker sites"
  on public.parkview_marker_sites for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can initialize Parkview marker sites"
  on public.parkview_marker_sites;
create policy "Public can initialize Parkview marker sites"
  on public.parkview_marker_sites for insert
  to anon, authenticated
  with check (true);

create table if not exists public.parkview_layouts (
  site_id text not null,
  layout_id text not null,
  name text not null,
  is_uploaded boolean not null default false,
  deleted boolean not null default false,
  image_path text,
  updated_at timestamptz not null default now(),
  primary key (site_id, layout_id)
);

alter table public.parkview_layouts enable row level security;

grant select, insert, update
  on table public.parkview_layouts
  to anon, authenticated;

drop policy if exists "Public can read Parkview layouts"
  on public.parkview_layouts;
create policy "Public can read Parkview layouts"
  on public.parkview_layouts for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create Parkview layouts"
  on public.parkview_layouts;
create policy "Public can create Parkview layouts"
  on public.parkview_layouts for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update Parkview layouts"
  on public.parkview_layouts;
create policy "Public can update Parkview layouts"
  on public.parkview_layouts for update
  to anon, authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('parkview-layouts', 'parkview-layouts', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read Parkview layout images"
  on storage.objects;
create policy "Public can read Parkview layout images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'parkview-layouts');

drop policy if exists "Public can upload Parkview layout images"
  on storage.objects;
create policy "Public can upload Parkview layout images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'parkview-layouts');

drop policy if exists "Public can update Parkview layout images"
  on storage.objects;
create policy "Public can update Parkview layout images"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'parkview-layouts')
  with check (bucket_id = 'parkview-layouts');

drop policy if exists "Public can delete Parkview layout images"
  on storage.objects;
create policy "Public can delete Parkview layout images"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'parkview-layouts');

notify pgrst, 'reload schema';

insert into storage.buckets (id, name, public)
values ('parkview-marker-photos', 'parkview-marker-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read Parkview marker photos"
  on storage.objects;
create policy "Public can read Parkview marker photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'parkview-marker-photos');

drop policy if exists "Public can upload Parkview marker photos"
  on storage.objects;
create policy "Public can upload Parkview marker photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'parkview-marker-photos');

drop policy if exists "Public can update Parkview marker photos"
  on storage.objects;
create policy "Public can update Parkview marker photos"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'parkview-marker-photos')
  with check (bucket_id = 'parkview-marker-photos');

drop policy if exists "Public can delete Parkview marker photos"
  on storage.objects;
create policy "Public can delete Parkview marker photos"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'parkview-marker-photos');