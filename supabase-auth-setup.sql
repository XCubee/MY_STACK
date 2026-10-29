create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  use_case text not null,
  experience_level text not null,
  preferred_categories text[] not null default '{}',
  onboarding_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists tools_user_id_id_uidx
  on public.tools (user_id, id);

alter table public.profiles enable row level security;
alter table public.tools enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.tools from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.tools to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'tools')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "tools_select_own"
  on public.tools for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "tools_insert_own"
  on public.tools for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tools_update_own"
  on public.tools for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tools_delete_own"
  on public.tools for delete
  to authenticated
  using ((select auth.uid()) = user_id);
