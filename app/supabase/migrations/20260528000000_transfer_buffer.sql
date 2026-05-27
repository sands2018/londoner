create table if not exists public.londoner_transfer_buffer (
  id uuid primary key default gen_random_uuid(),
  numbers integer[] not null,
  uploader text not null,
  created_at timestamptz not null default now(),
  constraint londoner_transfer_buffer_numbers_valid check (
    array_position(numbers, null) is null
    and numbers <@ array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]
  )
);

alter table public.londoner_transfer_buffer enable row level security;

create or replace function public.londoner_list_transfer_buffer(p_username text, p_password text)
returns table (
  id uuid,
  numbers integer[],
  uploader text,
  created_at timestamptz
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
    select t.id, t.numbers, t.uploader, t.created_at
    from public.londoner_transfer_buffer t
    order by t.created_at desc;
end;
$$;

create or replace function public.londoner_upload_transfer_buffer(
  p_username text,
  p_password text,
  p_numbers integer[]
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

  if p_numbers is null or cardinality(p_numbers) = 0 then
    raise exception 'Numbers are required';
  end if;

  delete from public.londoner_transfer_buffer
  where id in (
    select id
    from public.londoner_transfer_buffer
    order by created_at desc
    offset 9
  );

  insert into public.londoner_transfer_buffer (numbers, uploader)
  values (p_numbers, v_display_name)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.londoner_list_transfer_buffer(text, text) to anon, authenticated;
grant execute on function public.londoner_upload_transfer_buffer(text, text, integer[]) to anon, authenticated;
