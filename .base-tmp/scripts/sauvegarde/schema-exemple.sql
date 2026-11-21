-- Schéma INVENTÉ de la même forme que le public de la vraie base (mesuré le
-- 6 nov. 2026, lecture seule) : app_data clé-valeur (owner, id) + meta tenue par
-- déclencheur, déclencheur vers une fonction d'un AUTRE schéma
-- (sauvegarde.noter_ecriture), politiques RLS « TO authenticated / anon »
-- appelant auth.uid(), une clé étrangère vers auth.users, une séquence, une
-- fonction SECURITY DEFINER à search_path vide. Sert uniquement au banc local
-- (essai-local.sh). Aucune donnée réelle.
create table public.app_data (
  id text not null, data jsonb default '{}'::jsonb, updated_at timestamptz default now(),
  owner uuid default auth.uid() not null, meta jsonb,
  constraint app_data_pkey primary key (owner, id));
create index app_data_owner_id_prefixe on public.app_data using btree (owner, id text_pattern_ops);

create function public.vrm_meta_trigger() returns trigger language plpgsql set search_path to '' as $$
begin
  new.meta := jsonb_build_object('nItems', jsonb_array_length(coalesce(new.data->'payload'->'items', '[]'::jsonb)));
  return new;
end $$;
create trigger vrm_meta_maj before insert or update of data, id on public.app_data
  for each row execute function public.vrm_meta_trigger();
create trigger vrm_noter_ecriture after insert or update on public.app_data
  for each row execute function sauvegarde.noter_ecriture();
alter table public.app_data enable row level security;
create policy "chacun ses lignes" on public.app_data as permissive for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy vrm_anon_ferme on public.app_data as restrictive for all to anon using (false) with check (false);

create sequence public.vinted_accounts_id_seq;
create table public.vinted_accounts (
  id bigint default nextval('public.vinted_accounts_id_seq') not null primary key,
  vinted_user_id text not null, login text, owner uuid default auth.uid() not null,
  updated_at timestamptz default now());
alter sequence public.vinted_accounts_id_seq owned by public.vinted_accounts.id;
alter table public.vinted_accounts enable row level security;
create policy vinted_accounts_proprio on public.vinted_accounts for all to authenticated
  using (owner = (select auth.uid()));

create table public.abonnements (owner uuid not null primary key, statut text not null,
  fin_periode timestamptz, maj timestamptz default now() not null);
alter table public.abonnements add constraint abonnements_owner_fkey
  foreign key (owner) references auth.users(id) on delete cascade;

create function public.vrm_acces_ok() returns boolean language sql stable security definer
  set search_path to '' as $$ select true $$;
