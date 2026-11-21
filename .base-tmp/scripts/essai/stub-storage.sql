-- POUR L'AUDIT SEULEMENT (scripts/audit-base-essai.cjs) : ce qu'un projet
-- Supabase a déjà et qu'un Postgres nu n'a pas, au-delà de
-- scripts/sauvegarde/stub-supabase.sql — le schéma `storage` (seaux, objets,
-- `storage.foldername`). Jamais appliqué sur un vrai projet (il a tout cela).
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists created_at timestamptz default now();
alter table auth.users add column if not exists raw_user_meta_data jsonb;
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists raw_app_meta_data jsonb;
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz, updated_at timestamptz, refreshed_at timestamp, user_agent text, aal text, not_after timestamptz);
