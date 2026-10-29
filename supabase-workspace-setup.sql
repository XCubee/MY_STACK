-- Additive schema for the Learning, Referrals, Tasks, Notes, and Activity
-- modules. Run supabase-auth-setup.sql and supabase-subscriptions-setup.sql
-- first; this file references their public.tools and public.subscriptions
-- tables. This script does not modify or delete existing application data.

create table if not exists public.learning_items (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  item_type text not null
    check (item_type in ('course', 'topic', 'skill', 'book', 'tutorial', 'certification', 'roadmap')),
  provider text not null default '',
  source_url text not null default '',
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'paused', 'completed')),
  progress smallint check (progress between 0 and 100),
  current_position text not null default '',
  start_date date,
  target_date date,
  last_studied_date date,
  notes text not null default '',
  tags text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists learning_items_user_status_idx
  on public.learning_items (user_id, status, updated_at desc);
create index if not exists learning_items_user_target_date_idx
  on public.learning_items (user_id, target_date)
  where archived_at is null;

create table if not exists public.learning_sections (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  learning_item_id text not null,
  parent_section_id text,
  title text not null check (length(trim(title)) > 0),
  position integer not null default 0 check (position >= 0),
  is_completed boolean not null default false,
  url text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, learning_item_id, id),
  constraint learning_sections_item_fkey
    foreign key (user_id, learning_item_id)
    references public.learning_items (user_id, id) on delete cascade,
  constraint learning_sections_parent_fkey
    foreign key (user_id, learning_item_id, parent_section_id)
    references public.learning_sections (user_id, learning_item_id, id)
    on delete cascade,
  check (parent_section_id is null or parent_section_id <> id)
);

create index if not exists learning_sections_item_position_idx
  on public.learning_sections (user_id, learning_item_id, parent_section_id, position);

create table if not exists public.contacts (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  company text not null default '',
  role text not null default '',
  profile_url text not null default '',
  contact_details text not null default '',
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists contacts_user_name_idx
  on public.contacts (user_id, name);

create table if not exists public.opportunities (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null check (length(trim(company)) > 0),
  role text not null check (length(trim(role)) > 0),
  opportunity_url text not null default '',
  status text not null default 'open'
    check (status in ('open', 'applied', 'interviewing', 'offer', 'closed', 'declined')),
  deadline date,
  notes text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists opportunities_user_status_deadline_idx
  on public.opportunities (user_id, status, deadline)
  where archived_at is null;

create table if not exists public.referral_requests (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id text not null,
  opportunity_id text not null,
  request_date date not null default current_date,
  status text not null default 'to_contact'
    check (status in ('to_contact', 'requested', 'awaiting_response', 'in_discussion', 'referred', 'declined', 'closed')),
  last_interaction_at timestamptz,
  next_follow_up_at timestamptz,
  outcome text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, id, contact_id),
  constraint referral_requests_contact_fkey
    foreign key (user_id, contact_id)
    references public.contacts (user_id, id) on delete restrict,
  constraint referral_requests_opportunity_fkey
    foreign key (user_id, opportunity_id)
    references public.opportunities (user_id, id) on delete restrict
);

create index if not exists referral_requests_contact_idx
  on public.referral_requests (user_id, contact_id);
create index if not exists referral_requests_opportunity_idx
  on public.referral_requests (user_id, opportunity_id);
create index if not exists referral_requests_follow_up_idx
  on public.referral_requests (user_id, next_follow_up_at)
  where next_follow_up_at is not null;
create index if not exists referral_requests_user_status_idx
  on public.referral_requests (user_id, status, updated_at desc);

create table if not exists public.interactions (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id text not null,
  referral_request_id text,
  interaction_at timestamptz not null default now(),
  channel text not null default '',
  summary text not null check (length(trim(summary)) > 0),
  next_step text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint interactions_contact_fkey
    foreign key (user_id, contact_id)
    references public.contacts (user_id, id) on delete restrict,
  constraint interactions_referral_contact_fkey
    foreign key (user_id, referral_request_id, contact_id)
    references public.referral_requests (user_id, id, contact_id)
    on delete restrict
);

create index if not exists interactions_contact_date_idx
  on public.interactions (user_id, contact_id, interaction_at desc);
create index if not exists interactions_referral_date_idx
  on public.interactions (user_id, referral_request_id, interaction_at desc)
  where referral_request_id is not null;

create table if not exists public.tasks (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  due_date date,
  due_at timestamptz,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'canceled')),
  reminder_enabled boolean not null default false,
  remind_at timestamptz,
  completed_at timestamptz,
  learning_item_id text,
  referral_request_id text,
  subscription_id text,
  tool_id text,
  contact_id text,
  opportunity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (
    num_nonnulls(
      learning_item_id,
      referral_request_id,
      subscription_id,
      tool_id,
      contact_id,
      opportunity_id
    ) <= 1
  ),
  constraint tasks_learning_item_fkey
    foreign key (user_id, learning_item_id)
    references public.learning_items (user_id, id) on delete restrict,
  constraint tasks_referral_request_fkey
    foreign key (user_id, referral_request_id)
    references public.referral_requests (user_id, id) on delete restrict,
  constraint tasks_subscription_fkey
    foreign key (user_id, subscription_id)
    references public.subscriptions (user_id, id) on delete restrict,
  constraint tasks_tool_fkey
    foreign key (user_id, tool_id)
    references public.tools (user_id, id) on delete restrict,
  constraint tasks_contact_fkey
    foreign key (user_id, contact_id)
    references public.contacts (user_id, id) on delete restrict,
  constraint tasks_opportunity_fkey
    foreign key (user_id, opportunity_id)
    references public.opportunities (user_id, id) on delete restrict
);

create index if not exists tasks_user_due_date_idx
  on public.tasks (user_id, due_date, due_at)
  where status in ('open', 'in_progress');
create index if not exists tasks_learning_item_idx
  on public.tasks (user_id, learning_item_id)
  where learning_item_id is not null;
create index if not exists tasks_referral_request_idx
  on public.tasks (user_id, referral_request_id)
  where referral_request_id is not null;
create index if not exists tasks_subscription_idx
  on public.tasks (user_id, subscription_id)
  where subscription_id is not null;
create index if not exists tasks_tool_idx
  on public.tasks (user_id, tool_id)
  where tool_id is not null;
create index if not exists tasks_contact_idx
  on public.tasks (user_id, contact_id)
  where contact_id is not null;
create index if not exists tasks_opportunity_idx
  on public.tasks (user_id, opportunity_id)
  where opportunity_id is not null;

create table if not exists public.notes (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  learning_item_id text,
  contact_id text,
  opportunity_id text,
  referral_request_id text,
  subscription_id text,
  tool_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check (length(trim(title)) > 0 or length(trim(content)) > 0),
  check (
    num_nonnulls(
      learning_item_id,
      contact_id,
      opportunity_id,
      referral_request_id,
      subscription_id,
      tool_id
    ) <= 1
  ),
  constraint notes_learning_item_fkey
    foreign key (user_id, learning_item_id)
    references public.learning_items (user_id, id) on delete restrict,
  constraint notes_contact_fkey
    foreign key (user_id, contact_id)
    references public.contacts (user_id, id) on delete restrict,
  constraint notes_opportunity_fkey
    foreign key (user_id, opportunity_id)
    references public.opportunities (user_id, id) on delete restrict,
  constraint notes_referral_request_fkey
    foreign key (user_id, referral_request_id)
    references public.referral_requests (user_id, id) on delete restrict,
  constraint notes_subscription_fkey
    foreign key (user_id, subscription_id)
    references public.subscriptions (user_id, id) on delete restrict,
  constraint notes_tool_fkey
    foreign key (user_id, tool_id)
    references public.tools (user_id, id) on delete restrict
);

create index if not exists notes_learning_item_idx
  on public.notes (user_id, learning_item_id)
  where learning_item_id is not null;
create index if not exists notes_contact_idx
  on public.notes (user_id, contact_id)
  where contact_id is not null;
create index if not exists notes_opportunity_idx
  on public.notes (user_id, opportunity_id)
  where opportunity_id is not null;
create index if not exists notes_referral_request_idx
  on public.notes (user_id, referral_request_id)
  where referral_request_id is not null;
create index if not exists notes_subscription_idx
  on public.notes (user_id, subscription_id)
  where subscription_id is not null;
create index if not exists notes_tool_idx
  on public.notes (user_id, tool_id)
  where tool_id is not null;

-- Activity rows intentionally retain a source type and ID instead of a
-- polymorphic foreign key, so archived/deleted source records do not erase
-- their timeline history.
create table if not exists public.activity_events (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null
    check (event_type in ('created', 'updated', 'archived', 'completed', 'status_changed', 'interaction_logged', 'follow_up_scheduled', 'reminder_completed')),
  source_type text not null
    check (source_type in ('learning_item', 'learning_section', 'contact', 'opportunity', 'referral_request', 'interaction', 'task', 'note', 'subscription', 'tool')),
  source_id text not null,
  summary text not null check (length(trim(summary)) > 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);
create index if not exists activity_events_user_source_idx
  on public.activity_events (user_id, source_type, source_id, created_at desc);

revoke all on table
  public.learning_items,
  public.learning_sections,
  public.contacts,
  public.opportunities,
  public.referral_requests,
  public.interactions,
  public.tasks,
  public.notes,
  public.activity_events
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.learning_items,
  public.learning_sections,
  public.contacts,
  public.opportunities,
  public.referral_requests,
  public.interactions,
  public.tasks,
  public.notes
to authenticated;
grant select, insert on table public.activity_events to authenticated;

do $workspace$
declare
  table_name text;
begin
  foreach table_name in array array[
    'learning_items',
    'learning_sections',
    'contacts',
    'opportunities',
    'referral_requests',
    'interactions',
    'tasks',
    'notes'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'drop policy if exists workspace_select_own on public.%I',
      table_name
    );
    execute format(
      'create policy workspace_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'drop policy if exists workspace_insert_own on public.%I',
      table_name
    );
    execute format(
      'create policy workspace_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'drop policy if exists workspace_update_own on public.%I',
      table_name
    );
    execute format(
      'create policy workspace_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'drop policy if exists workspace_delete_own on public.%I',
      table_name
    );
    execute format(
      'create policy workspace_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end
$workspace$;

alter table public.activity_events enable row level security;
drop policy if exists activity_events_select_own on public.activity_events;
create policy activity_events_select_own
  on public.activity_events for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists activity_events_insert_own on public.activity_events;
create policy activity_events_insert_own
  on public.activity_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
