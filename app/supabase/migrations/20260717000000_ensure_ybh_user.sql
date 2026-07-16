insert into public.londoner_shared_users (username, display_name, password_hash, can_delete)
values (
  'ybh',
  'ybh',
  extensions.crypt('ybh@dqgs', extensions.gen_salt('bf')),
  true
)
on conflict (username) do update
set display_name = excluded.display_name,
    password_hash = excluded.password_hash,
    can_delete = excluded.can_delete;
