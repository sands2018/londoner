create extension if not exists pgcrypto;

update public.londoner_shared_users
set password_hash = extensions.crypt('zxczxc123!@#', extensions.gen_salt('bf'))
where username = 'ww';
