-- Aplicar por migration em um projeto exclusivo do Iran Solutions.
-- Vincular o UUID do administrador em iran_private.administrators somente
-- depois de conferir seu e-mail confirmado no Auth. Não usar metadados editáveis.
begin;
create schema if not exists iran_private;
revoke all on schema iran_private from public, anon;
grant usage on schema iran_private to authenticated;
create table iran_private.administrators (user_id uuid primary key references auth.users(id) on delete cascade);
alter table iran_private.administrators enable row level security;
revoke all on iran_private.administrators from public, anon, authenticated;
create table public.iran_members (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, name text not null default '',
 status text not null default 'pending' check (status in ('pending','active','blocked')),
 created_at timestamptz not null default now()
);
alter table public.iran_members enable row level security;
revoke all on public.iran_members from public, anon, authenticated;
grant select on public.iran_members to authenticated;
grant update(status) on public.iran_members to authenticated;
-- Privilégio restrito à leitura das tabelas internas de identidade e sessão.
create function iran_private.session_valid() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and u.email_confirmed_at is not null
  and s.id::text=auth.jwt()->>'session_id'
  and (s.not_after is null or s.not_after>now())
 );
$$;
create function iran_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select iran_private.session_valid() and exists (select 1 from iran_private.administrators a where a.user_id=auth.uid());
$$;
revoke all on function iran_private.session_valid() from public,anon;
revoke all on function iran_private.is_admin() from public,anon;
grant execute on function iran_private.session_valid() to authenticated;
grant execute on function iran_private.is_admin() to authenticated;
create function public.iran_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select iran_private.is_admin(); $$;
revoke all on function public.iran_is_admin() from public,anon;
grant execute on function public.iran_is_admin() to authenticated;
create policy iran_read_members on public.iran_members for select to authenticated
 using ((select iran_private.session_valid()) and (id=(select auth.uid()) or (select iran_private.is_admin())));
create policy iran_admin_status on public.iran_members for update to authenticated
 using ((select iran_private.is_admin()) and id<>(select auth.uid()))
 with check ((select iran_private.is_admin()) and id<>(select auth.uid()));
create function iran_private.member_from_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.iran_members(id,email,name)
 values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'name',''),80))
 on conflict(id) do update set email=excluded.email;
 return new;
end;
$$;
revoke all on function iran_private.member_from_auth() from public,anon,authenticated;
create trigger iran_member_created after insert or update of email on auth.users
 for each row execute function iran_private.member_from_auth();
insert into public.iran_members(id,email,name)
 select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'name',''),80) from auth.users on conflict(id) do nothing;
commit;
