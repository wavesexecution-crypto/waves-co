-- ============================================================================
-- WavesCo Prototype - Initial Supabase Schema
-- ============================================================================
-- Multi-tenant schema with RLS for business data isolation
-- ============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. prototype_business_config
-- Stores business configuration per tenant
-- ============================================================================
create table prototype_business_config (
  id uuid default gen_random_uuid() primary key,
  business_id text not null unique,
  business_name text not null default 'Waves Business',
  timezone text not null default 'Asia/Kolkata',
  business_hours jsonb not null default '{"monday": {"open": "09:00", "close": "18:00"}, "tuesday": {"open": "09:00", "close": "18:00"}, "wednesday": {"open": "09:00", "close": "18:00"}, "thursday": {"open": "09:00", "close": "18:00"}, "friday": {"open": "09:00", "close": "18:00"}, "saturday": {"open": "10:00", "close": "16:00"}, "sunday": {"open": "10:00", "close": "16:00"}}'::jsonb,
  qualification_fields jsonb not null default '["service_needed","budget","timeline","location"]'::jsonb,
  notification_channels jsonb not null default '["sms","email"]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),

  constraint business_id_unique unique (business_id)
);

-- Index for business config lookups
create index idx_prototype_business_config_business_id on prototype_business_config(business_id);

-- Row-level security policies
alter table prototype_business_enable row level security;

create policy "Business owners can manage their own config"
  on prototype_business_config
  for all
  using (auth.jwt() ->> 'business_id' = business_id)
  with check (auth.jwt() ->> 'business_id' = business_id);

-- ============================================================================
-- 2. prototype_leads
-- Stores lead data with full qualification fields
-- ============================================================================
create table prototype_leads (
  id uuid default gen_random_uuid() primary key,
  business_id text not null,
  -- Core lead fields
  name text not null,
  phone text not null,
  email text,
  source text not null default 'website',
  -- Qualification fields
  service_needed text,
  budget text,
  timeline text,
  location text,
  intent text default 'low' check (intent in ('low','medium','high')),
  lead_score integer default 0 check (lead_score >= 0 and lead_score <= 100),
  classification text default 'cold' check (classification in ('cold','warm','hot')),
  score_reasons jsonb not null default '[]'::jsonb,
  -- Status tracking
  status text not null default 'new' check (status in ('new','after-hours','qualifying','qualified','hot','warm','cold','converted','closed')),
  received_at timestamp with time zone default timezone('utc'::text, now()),
  last_contacted_at timestamp with time zone,
  converted_at timestamp with time zone,
  -- Tenant isolation
  constraint fk_leads_business foreign key (business_id) references prototype_business_config(business_id),
  constraint leads_business_id_idx check (business_id is not null)
);

-- Indexes for common lead queries
create index idx_prototype_leads_business_id on prototype_leads(business_id);
create index idx_prototype_leads_status on prototype_leads(status);
create index idx_prototype_leads_classification on prototype_leads(classification);
create index idx_prototype_leads_score on prototype_leads(lead_score);
create index idx_prototype_leads_source on prototype_leads(source);
create index idx_prototype_leads_received_at on prototype_leads(received_at);

-- Row-level security policies
alter table prototype_leads enable row level security;

create policy "Business owners can manage their own leads"
  on prototype_leads
  for all
  using (auth.jwt() ->> 'business_id' = business_id)
  with check (auth.jwt() ->> 'business_id' = business_id);

-- ============================================================================
-- 3. prototype_conversations
-- Tracks conversation sessions per lead
-- ============================================================================
create table prototype_conversations (
  id uuid default gen_random_uuid() primary key,
  business_id text not null,
  lead_id uuid not null references prototype_leads(id) on delete cascade,
  channel text not null default 'webchat',
  status text not null default 'active' check (status in ('active','completed','archived')),
  started_at timestamp with time zone default timezone('utc'::text, now()),
  ended_at timestamp with time zone,

  constraint conversations_lead_id_idx check (lead_id is not null),

  constraint conversations_business_id_idx check (business_id is not null)
);

-- Indexes
create index idx_prototype_conversations_business_id on prototype_conversations(business_id);
create index idx_prototype_conversations_lead_id on prototype_conversations(lead_id);
create index idx_prototype_conversations_started_at on prototype_conversations(started_at);

-- Row-level security policies
alter table prototype_conversations enable row level security;

create policy "Business owners can manage their own conversations"
  on prototype_conversations
  for all
  using (auth.jwt() ->> 'business_id' = business_id)
  with check (auth.jwt() ->> 'business_id' = business_id);

-- ============================================================================
-- 4. prototype_messages
-- Individual messages within conversations
-- ============================================================================
create table prototype_messages (
  id uuid default gen_random_uuid() primary key,
  business_id text not null,
  conversation_id uuid not null references prototype_conversations(id) on delete cascade,
  direction text not null default 'inbound' check (direction in ('inbound','outbound')),
  sender_type text not null default 'lead' check (sender_type in ('lead','assistant','system')),
  message_content text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()),
  provider_message_id text,  -- external provider ID (Twilio, etc.)
  read_by_lead boolean default false,

  constraint messages_conversation_id_idx check (conversation_id is not null),

  constraint messages_business_id_idx check (business_id is not null)
);

-- Indexes
create index idx_prototype_messages_business_id on prototype_messages(business_id);
create index idx_prototype_messages_conversation_id on prototype_messages(conversation_id);
create index idx_prototype_messages_timestamp on prototype_messages(timestamp);

-- Row-level security policies
alter table prototype_messages enable row level security;

create policy "Business owners can manage their own messages"
  on prototype_messages
  for all
  using (auth.jwt() ->> 'business_id' = business_id)
  with check (auth.jwt() ->> 'business_id' = business_id);

-- ============================================================================
-- 5. prototype_followups
-- Follow-up sequence management
-- ============================================================================
create table prototype_followups (
  id uuid default gen_random_uuid() primary key,
  business_id text not null,
  lead_id uuid not null references prototype_leads(id) on delete cascade,
  scheduled_at timestamp with time zone not null,
  sequence_number integer not null default 1 check (sequence_number > 0),
  status text not null default 'pending' check (status in ('pending','sent','cancelled')),
  sent_at timestamp with time zone,
  cancellation_reason text,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),

  constraint followups_lead_id_idx check (lead_id is not null),
  constraint followups_business_id_idx check (business_id is not null)
);

-- Indexes
create index idx_prototype_followups_business_id on prototype_followups(business_id);
create index idx_prototype_followups_lead_id on prototype_followups(lead_id);
create index idx_prototype_followups_scheduled on prototype_followups(scheduled_at);
create index idx_prototype_followups_status on prototype_followups(status);

-- Row-level security policies
alter table prototype_followups enable row level security;

create policy "Business owners can manage their own followups"
  on prototype_followups
  for all
  using (auth.jwt() ->> 'business_id' = business_id)
  with check (auth.jwt() ->> 'business_id' = business_id);

-- ============================================================================
-- 6. prototype_events
-- Event tracking for analytics and audit trail
-- ============================================================================
create table prototype_events (
  id uuid default gen_random_uuid() primary key,
  business_id text not null,
  lead_id uuid references prototype_leads(id) on delete set null,
  event_type text not null check (event_type in (
    'lead_received',
    'after_hours_detected',
    'ai_response',
    'qualification_completed',
    'lead_scored',
    'human_escalation',
    'follow_up_sent',
    'lead_converted',
    'lead_lost'
  )),
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone default timezone('utc'::text, now()),

  constraint events_business_id_idx check (business_id is not null),
  constraint events_lead_id_idx check (lead_id is not null)

);

-- Indexes
create index idx_prototype_events_business_id on prototype_events(business_id);
create index idx_prototype_events_lead_id on prototype_events(lead_id);
create index idx_prototype_events_type on prototype_events(event_type);
create index idx_prototype_events_occurred_at on prototype_events(occurred_at);

-- Row-level security policies
alter table prototype_events enable row level security;

create policy "Business owners can manage their own events"
  on prototype_events
  for all
  using (auth.jwt() ->> 'business_id' = business_id)
  with check (auth.jwt() ->> 'business_id' = business_id);

-- ============================================================================
-- 7. Helper view for easy business config lookup
-- ============================================================================
create or replace view prototype_business_config_view as
select
  business_id,
  business_name,
  timezone,
  business_hours,
  qualification_fields,
  notification_channels,
  created_at,
  updated_at
from prototype_business_config;

-- ============================================================================
-- 8. Grant anonymous/registered access (configure as needed for your auth)
-- ============================================================================

-- Note: RLS policies use auth.jwt() ->> 'business_id' which requires
-- the JWT token to have a 'business_id' claim. This is set during
-- onboarding when a new business is created.