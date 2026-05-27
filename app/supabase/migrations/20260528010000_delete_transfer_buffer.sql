create or replace function public.londoner_delete_transfer_buffer(
  p_username text,
  p_password text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.londoner_check_access(p_username, p_password) then
    raise exception 'Invalid shared user';
  end if;

  delete from public.londoner_transfer_buffer
  where id = p_id;
end;
$$;

grant execute on function public.londoner_delete_transfer_buffer(text, text, uuid) to anon, authenticated;
