-- Run this in the Supabase SQL Editor before deploying (re-run after schema changes).
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

create table if not exists public.parkview_projects (
  site_id text not null,
  project_id text not null,
  name text not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, project_id)
);

alter table public.parkview_projects
  add column if not exists deleted boolean not null default false;

alter table public.parkview_projects enable row level security;

grant select, insert, update
  on table public.parkview_projects
  to anon, authenticated;

drop policy if exists "Public can read Parkview projects"
  on public.parkview_projects;
create policy "Public can read Parkview projects"
  on public.parkview_projects for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create Parkview projects"
  on public.parkview_projects;
create policy "Public can create Parkview projects"
  on public.parkview_projects for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update Parkview projects"
  on public.parkview_projects;
create policy "Public can update Parkview projects"
  on public.parkview_projects for update
  to anon, authenticated
  using (true)
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

create table if not exists public.parkview_presence (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  display_name text not null,
  role text not null default 'guest',
  project_id text not null,
  project_name text not null,
  layout_id text not null,
  layout_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.parkview_presence enable row level security;

grant select, insert, update, delete
  on table public.parkview_presence
  to anon, authenticated;

drop policy if exists "Public can read Parkview presence"
  on public.parkview_presence;
create policy "Public can read Parkview presence"
  on public.parkview_presence for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can upsert Parkview presence"
  on public.parkview_presence;
create policy "Public can upsert Parkview presence"
  on public.parkview_presence for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update Parkview presence"
  on public.parkview_presence;
create policy "Public can update Parkview presence"
  on public.parkview_presence for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public can delete Parkview presence"
  on public.parkview_presence;
create policy "Public can delete Parkview presence"
  on public.parkview_presence for delete
  to anon, authenticated
  using (true);

create table if not exists public.parkview_users (
  user_id text primary key,
  email text,
  display_name text not null,
  role text not null default 'viewer',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.parkview_users enable row level security;

grant select, insert, update
  on table public.parkview_users
  to anon, authenticated;

drop policy if exists "Public can read Parkview users"
  on public.parkview_users;
create policy "Public can read Parkview users"
  on public.parkview_users for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can upsert Parkview users"
  on public.parkview_users;
create policy "Public can upsert Parkview users"
  on public.parkview_users for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update Parkview users"
  on public.parkview_users;
create policy "Public can update Parkview users"
  on public.parkview_users for update
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';