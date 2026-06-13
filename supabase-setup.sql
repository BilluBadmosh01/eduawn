-- ============================================================
-- Edu Awn — Supabase setup
-- Run this entire file in Supabase SQL Editor (one shot).
-- Then: see SUPABASE_SETUP.md for bucket + admin bootstrap.
-- ============================================================

-- ---------- Enum: app_role ----------
do $$ begin
  create type public.app_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_auth" on public.profiles;
create policy "profiles_select_all_auth" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- ---------- user_roles ----------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- has_role helper (SECURITY DEFINER to avoid RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Admins can read & manage all roles
drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_admin_all" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'user-' || substr(new.id::text, 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- files ----------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  uploader_username text not null,
  file_name text not null,
  original_file_name text not null,
  storage_path text not null,
  file_url text,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);
grant select, insert, delete on public.files to authenticated;
grant all on public.files to service_role;
alter table public.files enable row level security;

drop policy if exists "files_select_all_auth" on public.files;
create policy "files_select_all_auth" on public.files
  for select to authenticated using (true);
drop policy if exists "files_insert_own" on public.files;
create policy "files_insert_own" on public.files
  for insert to authenticated with check (uploader_id = auth.uid());
drop policy if exists "files_delete_own_or_admin" on public.files;
create policy "files_delete_own_or_admin" on public.files
  for delete to authenticated
  using (uploader_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ---------- reports ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reporter_username text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;

drop policy if exists "reports_insert_self" on public.reports;
create policy "reports_insert_self" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "reports_select_self_or_admin" on public.reports;
create policy "reports_select_self_or_admin" on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin" on public.reports
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ---------- groups ----------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  private_code text not null unique,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.groups to authenticated;
grant all on public.groups to service_role;
alter table public.groups enable row level security;

-- ---------- group_members ----------
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id, group_id)
);
grant select, insert, delete on public.group_members to authenticated;
grant all on public.group_members to service_role;
alter table public.group_members enable row level security;

-- is_group_member helper (SECURITY DEFINER to avoid recursion)
create or replace function public.is_group_member(_user_id uuid, _group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where user_id = _user_id and group_id = _group_id
  )
$$;

-- Group policies
drop policy if exists "groups_select_members_or_admin" on public.groups;
create policy "groups_select_members_or_admin" on public.groups
  for select to authenticated
  using (public.is_group_member(auth.uid(), id) or public.has_role(auth.uid(), 'admin'));
drop policy if exists "groups_insert_creator" on public.groups;
create policy "groups_insert_creator" on public.groups
  for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "groups_delete_creator_or_admin" on public.groups;
create policy "groups_delete_creator_or_admin" on public.groups
  for delete to authenticated
  using (creator_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Group members policies
drop policy if exists "gm_select_own_or_admin" on public.group_members;
create policy "gm_select_own_or_admin" on public.group_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(auth.uid(), group_id) or public.has_role(auth.uid(), 'admin'));
drop policy if exists "gm_insert_self" on public.group_members;
create policy "gm_insert_self" on public.group_members
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "gm_delete_self_or_admin" on public.group_members;
create policy "gm_delete_self_or_admin" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Join by private code RPC (security definer to read groups without RLS scope)
create or replace function public.join_group_by_code(_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare gid uuid;
begin
  select id into gid from public.groups where private_code = _code;
  if gid is null then
    raise exception 'Invalid group code';
  end if;
  insert into public.group_members (user_id, group_id)
  values (auth.uid(), gid)
  on conflict do nothing;
  return gid;
end;
$$;
grant execute on function public.join_group_by_code(text) to authenticated;

-- Lookup group preview by code (for join confirmation; bypasses RLS safely)
create or replace function public.group_by_code(_code text)
returns table(id uuid, group_name text)
language sql stable security definer set search_path = public
as $$
  select id, group_name from public.groups where private_code = _code;
$$;
grant execute on function public.group_by_code(text) to authenticated;

-- ---------- messages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_username text not null,
  message text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members" on public.messages
  for select to authenticated
  using (public.is_group_member(auth.uid(), group_id));
drop policy if exists "messages_insert_members" on public.messages;
create policy "messages_insert_members" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_group_member(auth.uid(), group_id));

-- Enable Realtime for messages
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- Storage bucket: shared-files (private)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('shared-files', 'shared-files', false)
on conflict (id) do nothing;

-- Storage policies (on storage.objects)
drop policy if exists "shared_files_select_auth" on storage.objects;
create policy "shared_files_select_auth" on storage.objects
  for select to authenticated
  using (bucket_id = 'shared-files');

drop policy if exists "shared_files_insert_own" on storage.objects;
create policy "shared_files_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shared-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "shared_files_delete_own_or_admin" on storage.objects;
create policy "shared_files_delete_own_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shared-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(), 'admin')
    )
  );