-- ========================================================================
-- Johnny TEC AI Reply (v3) - Complete Supabase Database Schema
-- Safe to run directly in the Supabase SQL Editor.
-- ========================================================================

-- Enable cryptographic extension for UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. Contacts Table
-- ------------------------------------------------------------------------
create table if not exists public.contacts (
    id uuid primary key default gen_random_uuid(),
    wa_id text not null unique,
    phone_number_id text, -- Supports multiple WhatsApp business numbers
    display_name text,
    relationship text,
    custom_instruction text,
    language text,
    mode text not null default 'ask' check (mode in ('auto', 'ask', 'off')),
    archived boolean not null default false,
    human_takeover boolean not null default false,
    learned_profile jsonb not null default '{}'::jsonb,
    inbound_since_profile_update int not null default 0,
    last_inbound_at timestamptz,
    created_at timestamptz not null default now()
);

-- Idempotent column additions for existing databases
alter table public.contacts add column if not exists phone_number_id text;
alter table public.contacts add column if not exists custom_instruction text;
alter table public.contacts add column if not exists archived boolean not null default false;
alter table public.contacts add column if not exists human_takeover boolean not null default false;

create index if not exists idx_contacts_wa_id on public.contacts (wa_id);
create index if not exists idx_contacts_archived on public.contacts (archived);
create index if not exists idx_contacts_last_inbound on public.contacts (last_inbound_at desc nulls last);
create index if not exists idx_contacts_phone_id on public.contacts (phone_number_id);

-- ------------------------------------------------------------------------
-- 2. Messages Table
-- ------------------------------------------------------------------------
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    wa_message_id text unique, -- Nullable for manual outgoing messages
    phone_number_id text,      -- WhatsApp Business number that received/sent this
    contact_id uuid not null references public.contacts(id) on delete cascade,
    direction text not null check (direction in ('in', 'out')),
    sender text not null check (sender in ('contact', 'ai', 'me')),
    body text not null,
    status text not null check (status in ('pending', 'drafted', 'replied', 'failed', 'ignored', 'needs_attention', 'failed_outside_window')),
    ai_draft text,
    error text,
    attempts int not null default 0,
    tokens_used int default 0,
    latency_ms int default 0,
    created_at timestamptz not null default now(),
    replied_at timestamptz
);

-- Idempotent column additions & updated status check constraint for existing databases
alter table public.messages add column if not exists phone_number_id text;
alter table public.messages add column if not exists tokens_used int default 0;
alter table public.messages add column if not exists latency_ms int default 0;

alter table public.messages drop constraint if exists messages_status_check;
alter table public.messages add constraint messages_status_check 
    check (status in ('pending', 'drafted', 'replied', 'failed', 'ignored', 'needs_attention', 'failed_outside_window'));

create index if not exists idx_messages_contact_created on public.messages (contact_id, created_at asc);
create index if not exists idx_messages_status on public.messages (status);
create index if not exists idx_messages_created_at on public.messages (created_at desc);

-- ------------------------------------------------------------------------
-- 3. Settings Table
-- ------------------------------------------------------------------------
create table if not exists public.settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

-- Seed initial settings
insert into public.settings (key, value)
values
    ('bot_enabled', 'true'::jsonb),
    ('response_delay_seconds', '2'::jsonb),
    ('default_personality', '"friendly_helpful"'::jsonb),
    ('default_language', '"en"'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------------------
-- 4. Logs Table
-- ------------------------------------------------------------------------
create table if not exists public.logs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    category text not null check (category in ('whatsapp', 'ai', 'system')),
    level text not null check (level in ('info', 'warning', 'error')),
    message text not null,
    meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_logs_created_at on public.logs (created_at desc);
create index if not exists idx_logs_category on public.logs (category);
create index if not exists idx_logs_level on public.logs (level);

-- ------------------------------------------------------------------------
-- 5. Row Level Security (RLS) & Realtime Policies
-- ------------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.settings enable row level security;
alter table public.logs enable row level security;

-- Enable Supabase Realtime publication for messages and contacts
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end $$;

-- Drop existing policies if re-running
drop policy if exists "Owner can read contacts" on public.contacts;
drop policy if exists "Owner can read messages" on public.messages;

-- RLS SELECT Policies for Supabase Realtime:
-- Authenticated users (the owner logged in via Supabase Auth) can read contacts and messages.
-- Backend bypasses RLS using SUPABASE_SERVICE_KEY.
create policy "Owner can read contacts"
  on public.contacts
  for select
  to authenticated
  using (
    auth.role() = 'authenticated'
  );

create policy "Owner can read messages"
  on public.messages
  for select
  to authenticated
  using (
    auth.role() = 'authenticated'
  );
