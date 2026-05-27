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
