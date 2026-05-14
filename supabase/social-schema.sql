create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_data_url text,
  contact_email text,
  portfolio_visibility text not null default 'friends' check (portfolio_visibility in ('public', 'friends', 'private')),
  public_asset_ids jsonb not null default '[]'::jsonb,
  public_list_names jsonb not null default '[]'::jsonb,
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists public_holdings jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists trade_journal jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists contact_email text;
alter table public.profiles add column if not exists portfolio_visibility text not null default 'friends';
alter table public.profiles add column if not exists wallpaper_id text not null default 'aurora-desk';
alter table public.profiles add column if not exists background_preset_id text not null default 'golden-orbit';
alter table public.profiles drop constraint if exists profiles_portfolio_visibility_check;
alter table public.profiles add constraint profiles_portfolio_visibility_check check (portfolio_visibility in ('public', 'friends', 'private'));

create table if not exists public.contacts (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, friend_user_id),
  constraint contacts_no_self check (user_id <> friend_user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint messages_body_length check (char_length(body) > 0 and char_length(body) <= 2000)
);

create table if not exists public.pokes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint pokes_no_self check (sender_id <> recipient_id)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_type text not null check (post_type in ('analysis', 'trade', 'note')),
  asset_id text,
  asset_symbol text,
  title text not null,
  body text not null,
  snapshot_data_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint social_posts_title_length check (char_length(title) > 0 and char_length(title) <= 140),
  constraint social_posts_body_length check (char_length(body) > 0 and char_length(body) <= 4000)
);

create table if not exists public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profile_comments_body_length check (char_length(body) > 0 and char_length(body) <= 1000)
);

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_social_posts_user_created_at
on public.social_posts (user_id, created_at desc);

create index if not exists idx_profiles_contact_email
on public.profiles (lower(contact_email));

create index if not exists idx_profile_comments_profile_created_at
on public.profile_comments (profile_user_id, created_at desc);

create index if not exists idx_profile_comments_author_created_at
on public.profile_comments (author_user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.pokes enable row level security;
alter table public.social_posts enable row level security;
alter table public.profile_comments enable row level security;
alter table public.user_app_state enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "contacts_select_participants" on public.contacts;
create policy "contacts_select_participants"
on public.contacts
for select
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_user_id);

drop policy if exists "contacts_insert_own" on public.contacts;
create policy "contacts_insert_own"
on public.contacts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
on public.messages
for insert
to authenticated
with check (auth.uid() = sender_id);

drop policy if exists "pokes_select_participants" on public.pokes;
create policy "pokes_select_participants"
on public.pokes
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "pokes_insert_sender" on public.pokes;
create policy "pokes_insert_sender"
on public.pokes
for insert
to authenticated
with check (auth.uid() = sender_id);

drop policy if exists "social_posts_select_authenticated" on public.social_posts;
create policy "social_posts_select_authenticated"
on public.social_posts
for select
to authenticated
using (true);

drop policy if exists "social_posts_insert_owner" on public.social_posts;
create policy "social_posts_insert_owner"
on public.social_posts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "social_posts_update_owner" on public.social_posts;
create policy "social_posts_update_owner"
on public.social_posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "profile_comments_select_authenticated" on public.profile_comments;
create policy "profile_comments_select_authenticated"
on public.profile_comments
for select
to authenticated
using (true);

drop policy if exists "profile_comments_insert_author" on public.profile_comments;
create policy "profile_comments_insert_author"
on public.profile_comments
for insert
to authenticated
with check (auth.uid() = author_user_id);

drop policy if exists "user_app_state_select_own" on public.user_app_state;
create policy "user_app_state_select_own"
on public.user_app_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_app_state_insert_own" on public.user_app_state;
create policy "user_app_state_insert_own"
on public.user_app_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_app_state_update_own" on public.user_app_state;
create policy "user_app_state_update_own"
on public.user_app_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.pokes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.social_posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profile_comments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.contacts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.user_app_state;
  exception when duplicate_object then null;
  end;
end $$;
