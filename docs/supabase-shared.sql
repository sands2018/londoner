create extension if not exists pgcrypto;

create table if not exists public.londoner_shared_users (
  username text primary key,
  display_name text not null,
  password_hash text not null,
  can_delete boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.londoner_shared_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  numbers integer[] not null,
  uploader text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint londoner_shared_sessions_numbers_valid check (
    array_position(numbers, null) is null
    and numbers <@ array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]
  )
);

alter table public.londoner_shared_users enable row level security;
alter table public.londoner_shared_sessions enable row level security;

insert into public.londoner_shared_users (username, display_name, password_hash, can_delete)
values
  ('ww', 'ww', extensions.crypt('zxczxc123!@#', extensions.gen_salt('bf')), true),
  ('wzs', 'wzs', extensions.crypt('wzs@dqgs', extensions.gen_salt('bf')), true),
  ('sxr', 'sxr', extensions.crypt('sxr@dqgs', extensions.gen_salt('bf')), true),
  ('ybh', 'ybh', extensions.crypt('ybh@dqgs', extensions.gen_salt('bf')), true)
on conflict (username) do nothing;

create or replace function public.londoner_auth_user(p_username text, p_password text)
returns table (
  username text,
  display_name text,
  can_delete boolean
)
language sql
security definer
set search_path = public
as $$
  select u.username, u.display_name, u.can_delete
  from public.londoner_shared_users u
  where u.username = btrim(p_username)
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
$$;

create or replace function public.londoner_check_access(p_username text, p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.londoner_auth_user(p_username, p_password)
  );
$$;

create or replace function public.londoner_list_sessions(p_username text, p_password text)
returns table (
  id uuid,
  name text,
  numbers integer[],
  uploader text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.londoner_check_access(p_username, p_password) then
    raise exception 'Invalid shared user';
  end if;

  return query
    select s.id, s.name, s.numbers, s.uploader, s.created_at, s.updated_at
    from public.londoner_shared_sessions s
    order by s.updated_at desc, s.created_at desc;
end;
$$;

create or replace function public.londoner_upsert_session(
  p_username text,
  p_password text,
  p_id uuid,
  p_name text,
  p_numbers integer[],
  p_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_display_name text;
begin
  select auth.display_name
  into v_display_name
  from public.londoner_auth_user(p_username, p_password) auth;

  if v_display_name is null then
    raise exception 'Invalid shared user';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Session name is required';
  end if;

  if p_numbers is null or cardinality(p_numbers) = 0 then
    raise exception 'Numbers are required';
  end if;

  if p_id is null then
    insert into public.londoner_shared_sessions (name, numbers, uploader, created_at, updated_at)
    values (btrim(p_name), p_numbers, v_display_name, p_updated_at, p_updated_at)
    returning id into v_id;
  else
    update public.londoner_shared_sessions
    set name = btrim(p_name),
        numbers = p_numbers,
        uploader = v_display_name,
        updated_at = p_updated_at
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Shared session not found';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.londoner_delete_session(p_username text, p_password text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_delete boolean;
begin
  select auth.can_delete
  into v_can_delete
  from public.londoner_auth_user(p_username, p_password) auth;

  if v_can_delete is null then
    raise exception 'Invalid shared user';
  end if;

  if not v_can_delete then
    raise exception 'Delete permission denied';
  end if;

  delete from public.londoner_shared_sessions
  where id = p_id;
end;
$$;

grant execute on function public.londoner_auth_user(text, text) to anon, authenticated;
grant execute on function public.londoner_check_access(text, text) to anon, authenticated;
grant execute on function public.londoner_list_sessions(text, text) to anon, authenticated;
grant execute on function public.londoner_upsert_session(text, text, uuid, text, integer[], timestamptz) to anon, authenticated;
grant execute on function public.londoner_delete_session(text, text, uuid) to anon, authenticated;
