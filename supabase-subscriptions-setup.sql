create table if not exists public.subscriptions (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  renewal_date date not null,
  billing_cycle text not null check (billing_cycle in ('weekly', 'monthly', 'yearly')),
  category text not null default 'Other',
  reminder_enabled boolean not null default true,
  reminder_days_before smallint not null default 1
    check (reminder_days_before in (0, 1, 3, 7, 14)),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists subscriptions_user_renewal_idx
  on public.subscriptions (user_id, renewal_date);

alter table public.subscriptions enable row level security;

revoke all on table public.subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.subscriptions to authenticated;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists subscriptions_insert_own on public.subscriptions;
create policy subscriptions_insert_own
  on public.subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists subscriptions_update_own on public.subscriptions;
create policy subscriptions_update_own
  on public.subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists subscriptions_delete_own on public.subscriptions;
create policy subscriptions_delete_own
  on public.subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);
