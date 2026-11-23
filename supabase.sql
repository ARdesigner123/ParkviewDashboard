-- =====================================================================
-- Park View dashboard — Supabase schema and security rules
--
-- Run the whole file in the Supabase SQL Editor (safe to re-run).
--
-- Who can do what:
--   * Anyone with the site link (guests)  → VIEW projects, layouts, markers, photos
--   * Signed-in "viewer" accounts         → VIEW, plus appear in the live-users list
--   * Signed-in "editor" / "owner"        → VIEW + CREATE / EDIT / DELETE
--   * "owner" only                        → see the list of all users
--
-- Roles come from the user's app_metadata.parkview_role inside their login
-- token. Users cannot change app_metadata themselves; only you can, with:
--
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                           || '{"parkview_role":"editor"}'::jsonb   -- or "owner"
--   where email = 'person@company.com';
--
-- A role change applies the next time that person signs in.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Role helpers (read from the signed login token, cannot be faked)
-- ---------------------------------------------------------------------
create or replace function public.parkview_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'parkview_role', '');
$$;

create or replace function public.parkview_can_edit()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.parkview_role() in ('owner', 'editor');
$$;

create or replace function public.parkview_is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.parkview_role() = 'owner';
$$;

-- The role a signed-in user is allowed to report about themselves.
create or replace function public.parkview_effective_role()
returns text
language sql
stable
set search_path = ''
as $$
  select case when public.parkview_can_edit() then public.parkview_role() else 'viewer' end;
$$;


-- ---------------------------------------------------------------------
-- Remove the old "anyone can do anything" policies
-- ---------------------------------------------------------------------
drop policy if exists "Public can read Parkview marker state" on public.parkview_marker_state;
drop policy if exists "Public can create Parkview marker state" on public.parkview_marker_state;
drop policy if exists "Public can update Parkview marker state" on public.parkview_marker_state;
drop policy if exists "Public can delete Parkview marker state" on public.parkview_marker_state;
drop policy if exists "Public can read Parkview markers" on public.parkview_markers;
drop policy if exists "Public can create Parkview markers" on public.parkview_markers;
drop policy if exists "Public can update Parkview markers" on public.parkview_markers;
drop policy if exists "Public can delete Parkview markers" on public.parkview_markers;
drop policy if exists "Public can read Parkview marker sites" on public.parkview_marker_sites;
drop policy if exists "Public can initialize Parkview marker sites" on public.parkview_marker_sites;
drop policy if exists "Public can read Parkview projects" on public.parkview_projects;
drop policy if exists "Public can create Parkview projects" on public.parkview_projects;
drop policy if exists "Public can update Parkview projects" on public.parkview_projects;
drop policy if exists "Public can read Parkview layouts" on public.parkview_layouts;
drop policy if exists "Public can create Parkview layouts" on public.parkview_layouts;
drop policy if exists "Public can update Parkview layouts" on public.parkview_layouts;
drop policy if exists "Public can read Parkview layout images" on storage.objects;
drop policy if exists "Public can upload Parkview layout images" on storage.objects;
drop policy if exists "Public can update Parkview layout images" on storage.objects;
drop policy if exists "Public can delete Parkview layout images" on storage.objects;
drop policy if exists "Public can read Parkview marker photos" on storage.objects;
drop policy if exists "Public can upload Parkview marker photos" on storage.objects;
drop policy if exists "Public can update Parkview marker photos" on storage.objects;
drop policy if exists "Public can delete Parkview marker photos" on storage.objects;
drop policy if exists "Public can read Parkview presence" on public.parkview_presence;
drop policy if exists "Public can upsert Parkview presence" on public.parkview_presence;
drop policy if exists "Public can update Parkview presence" on public.parkview_presence;
drop policy if exists "Public can delete Parkview presence" on public.parkview_presence;
drop policy if exists "Public can read Parkview users" on public.parkview_users;
drop policy if exists "Public can upsert Parkview users" on public.parkview_users;
drop policy if exists "Public can update Parkview users" on public.parkview_users;


-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.parkview_marker_state (
  project_id text primary key,
  markers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.parkview_markers (
  site_id text not null,
  layout_id text not null,
  marker_id text not null,
  marker jsonb not null,
  primary key (site_id, layout_id, marker_id)
);

create table if not exists public.parkview_marker_sites (
  site_id text primary key,
  initialized_at timestamptz not null default now()
);

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

create table if not exists public.parkview_users (
  user_id text primary key,
  email text,
  display_name text not null,
  role text not null default 'viewer',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Old browsers registered every guest in parkview_users; those rows are no longer used.
delete from public.parkview_users where role = 'guest';


-- ---------------------------------------------------------------------
-- Table permissions (row-level security decides the details)
-- ---------------------------------------------------------------------
alter table public.parkview_marker_state enable row level security;
alter table public.parkview_markers      enable row level security;
alter table public.parkview_marker_sites enable row level security;
alter table public.parkview_projects     enable row level security;
alter table public.parkview_layouts      enable row level security;
alter table public.parkview_presence     enable row level security;
alter table public.parkview_users        enable row level security;

revoke all on table
  public.parkview_marker_state, public.parkview_markers, public.parkview_marker_sites,
  public.parkview_projects, public.parkview_layouts, public.parkview_presence, public.parkview_users
  from anon, authenticated;

-- Guests: read the drawings, and keep their own anonymous "online" row.
grant select on table
  public.parkview_marker_state, public.parkview_markers, public.parkview_marker_sites,
  public.parkview_projects, public.parkview_layouts
  to anon;
grant select, insert, update, delete on table public.parkview_presence to anon;

-- Signed-in users: rules below limit writes to editors / owners.
grant select, insert, update, delete on table
  public.parkview_marker_state, public.parkview_markers, public.parkview_marker_sites,
  public.parkview_projects, public.parkview_layouts, public.parkview_presence
  to authenticated;
grant select, insert, update on table public.parkview_users to authenticated;


-- ---------------------------------------------------------------------
-- Project data: everyone reads, editors/owners write
-- ---------------------------------------------------------------------

-- parkview_marker_state (legacy, read-only for the app)
drop policy if exists "Parkview marker state: anyone can read" on public.parkview_marker_state;
create policy "Parkview marker state: anyone can read"
  on public.parkview_marker_state for select to anon, authenticated using (true);
drop policy if exists "Parkview marker state: editors can write" on public.parkview_marker_state;
create policy "Parkview marker state: editors can write"
  on public.parkview_marker_state for all to authenticated
  using (public.parkview_can_edit()) with check (public.parkview_can_edit());

-- parkview_markers
drop policy if exists "Parkview markers: anyone can read" on public.parkview_markers;
create policy "Parkview markers: anyone can read"
  on public.parkview_markers for select to anon, authenticated using (true);
drop policy if exists "Parkview markers: editors can create" on public.parkview_markers;
create policy "Parkview markers: editors can create"
  on public.parkview_markers for insert to authenticated with check (public.parkview_can_edit());
drop policy if exists "Parkview markers: editors can update" on public.parkview_markers;
create policy "Parkview markers: editors can update"
  on public.parkview_markers for update to authenticated
  using (public.parkview_can_edit()) with check (public.parkview_can_edit());
drop policy if exists "Parkview markers: editors can delete" on public.parkview_markers;
create policy "Parkview markers: editors can delete"
  on public.parkview_markers for delete to authenticated using (public.parkview_can_edit());

-- parkview_marker_sites
drop policy if exists "Parkview marker sites: anyone can read" on public.parkview_marker_sites;
create policy "Parkview marker sites: anyone can read"
  on public.parkview_marker_sites for select to anon, authenticated using (true);
drop policy if exists "Parkview marker sites: editors can initialize" on public.parkview_marker_sites;
create policy "Parkview marker sites: editors can initialize"
  on public.parkview_marker_sites for insert to authenticated with check (public.parkview_can_edit());

-- parkview_projects (projects are "deleted" by setting deleted = true)
drop policy if exists "Parkview projects: anyone can read" on public.parkview_projects;
create policy "Parkview projects: anyone can read"
  on public.parkview_projects for select to anon, authenticated using (true);
drop policy if exists "Parkview projects: editors can create" on public.parkview_projects;
create policy "Parkview projects: editors can create"
  on public.parkview_projects for insert to authenticated with check (public.parkview_can_edit());
drop policy if exists "Parkview projects: editors can update" on public.parkview_projects;
create policy "Parkview projects: editors can update"
  on public.parkview_projects for update to authenticated
  using (public.parkview_can_edit()) with check (public.parkview_can_edit());

-- parkview_layouts (layouts are "deleted" by setting deleted = true)
drop policy if exists "Parkview layouts: anyone can read" on public.parkview_layouts;
create policy "Parkview layouts: anyone can read"
  on public.parkview_layouts for select to anon, authenticated using (true);
drop policy if exists "Parkview layouts: editors can create" on public.parkview_layouts;
create policy "Parkview layouts: editors can create"
  on public.parkview_layouts for insert to authenticated with check (public.parkview_can_edit());
drop policy if exists "Parkview layouts: editors can update" on public.parkview_layouts;
create policy "Parkview layouts: editors can update"
  on public.parkview_layouts for update to authenticated
  using (public.parkview_can_edit()) with check (public.parkview_can_edit());


-- ---------------------------------------------------------------------
-- Storage buckets: images are public to view, editors upload/replace/delete
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('parkview-layouts', 'parkview-layouts', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('parkview-marker-photos', 'parkview-marker-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Parkview images: anyone can read" on storage.objects;
create policy "Parkview images: anyone can read"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('parkview-layouts', 'parkview-marker-photos'));

drop policy if exists "Parkview images: editors can upload" on storage.objects;
create policy "Parkview images: editors can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('parkview-layouts', 'parkview-marker-photos') and public.parkview_can_edit());

drop policy if exists "Parkview images: editors can replace" on storage.objects;
create policy "Parkview images: editors can replace"
  on storage.objects for update to authenticated
  using (bucket_id in ('parkview-layouts', 'parkview-marker-photos') and public.parkview_can_edit())
  with check (bucket_id in ('parkview-layouts', 'parkview-marker-photos') and public.parkview_can_edit());

drop policy if exists "Parkview images: editors can delete" on storage.objects;
create policy "Parkview images: editors can delete"
  on storage.objects for delete to authenticated
  using (bucket_id in ('parkview-layouts', 'parkview-marker-photos') and public.parkview_can_edit());


-- ---------------------------------------------------------------------
-- Presence ("who is online")
--   * Guests may only write anonymous guest rows.
--   * Signed-in users may only write their own row, with their real role.
--   * Only signed-in users can see signed-in users online (guests see guest rows only).
-- ---------------------------------------------------------------------
drop policy if exists "Parkview presence: signed-in users can read" on public.parkview_presence;
create policy "Parkview presence: signed-in users can read"
  on public.parkview_presence for select to authenticated using (true);
drop policy if exists "Parkview presence: guests see guest rows only" on public.parkview_presence;
create policy "Parkview presence: guests see guest rows only"
  on public.parkview_presence for select to anon using (role = 'guest');

drop policy if exists "Parkview presence: guests write guest rows" on public.parkview_presence;
create policy "Parkview presence: guests write guest rows"
  on public.parkview_presence for insert to anon
  with check (role = 'guest' and user_id like 'guest-%' and length(display_name) <= 40);
drop policy if exists "Parkview presence: guests update guest rows" on public.parkview_presence;
create policy "Parkview presence: guests update guest rows"
  on public.parkview_presence for update to anon
  using (role = 'guest' and user_id like 'guest-%')
  with check (role = 'guest' and user_id like 'guest-%' and length(display_name) <= 40);
drop policy if exists "Parkview presence: guests remove guest rows" on public.parkview_presence;
create policy "Parkview presence: guests remove guest rows"
  on public.parkview_presence for delete to anon
  using (role = 'guest' and user_id like 'guest-%');

drop policy if exists "Parkview presence: users write own row" on public.parkview_presence;
create policy "Parkview presence: users write own row"
  on public.parkview_presence for insert to authenticated
  with check (user_id = auth.uid()::text and role = public.parkview_effective_role());
drop policy if exists "Parkview presence: users update own row" on public.parkview_presence;
create policy "Parkview presence: users update own row"
  on public.parkview_presence for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text and role = public.parkview_effective_role());
drop policy if exists "Parkview presence: users remove own row" on public.parkview_presence;
create policy "Parkview presence: users remove own row"
  on public.parkview_presence for delete to authenticated
  using (user_id = auth.uid()::text);


-- ---------------------------------------------------------------------
-- Users list: each user keeps their own row; only owners can read the list
-- ---------------------------------------------------------------------
drop policy if exists "Parkview users: owners read all, users read self" on public.parkview_users;
create policy "Parkview users: owners read all, users read self"
  on public.parkview_users for select to authenticated
  using (public.parkview_is_owner() or user_id = auth.uid()::text);
drop policy if exists "Parkview users: users create own row" on public.parkview_users;
create policy "Parkview users: users create own row"
  on public.parkview_users for insert to authenticated
  with check (user_id = auth.uid()::text and role = public.parkview_effective_role());
drop policy if exists "Parkview users: users update own row" on public.parkview_users;
create policy "Parkview users: users update own row"
  on public.parkview_users for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text and role = public.parkview_effective_role());


notify pgrst, 'reload schema';
