-- ═══════════════════════════════════════════════════════════════════════════
-- 008 — DÉTOURAGE PHOTOROOM : un cache privé et un compteur atomique (4 octobre)
-- ═══════════════════════════════════════════════════════════════════════════
-- Lu et écrit par le SERVEUR (api/_lib/detourage.js, clé de service). Rien de
-- destructif : un compartiment privé, une table, deux fonctions.
--
-- • Le CACHE : un fichier par photo détourée, rangé par vendeur
--   ({owner}/{sha256 des octets d'origine}-{version des paramètres}.jpg). La clé
--   est l'empreinte exacte des octets — une identité, jamais un titre (§5). On ne
--   paie jamais deux fois la même photo. Privé : un vendeur ne lit que SON dossier.
-- • Le COMPTEUR : combien de photos un vendeur a fait détourer ce mois-ci, pour
--   un plafond. Réservé par la base en UNE instruction : jamais un
--   lire-ajouter-réécrire, dont une lecture ratée remettrait le compteur à zéro.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('detourage', 'detourage', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists detourage_lecture_vendeur on storage.objects;
create policy detourage_lecture_vendeur on storage.objects
  for select to authenticated
  using (bucket_id = 'detourage' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.detourage_usage (
  owner uuid not null,
  mois text not null check (mois ~ '^[0-9]{4}-[0-9]{2}$'),
  n integer not null default 0 check (n >= 0),
  primary key (owner, mois)
);
alter table public.detourage_usage enable row level security;
drop policy if exists detourage_usage_lecture on public.detourage_usage;
create policy detourage_usage_lecture on public.detourage_usage
  for select to authenticated using (owner = (select auth.uid()));
revoke all on public.detourage_usage from anon;
revoke insert, update, delete, truncate on public.detourage_usage from authenticated;

-- Réserve une unité si le plafond n'est pas atteint. Rend le nouveau total, ou
-- NULL quand le plafond est atteint (rien n'est compté).
create or replace function public.vrm_detourage_reserver(u uuid, m text, plafond integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v integer;
begin
  insert into public.detourage_usage (owner, mois, n) values (u, m, 0)
  on conflict (owner, mois) do nothing;
  update public.detourage_usage set n = n + 1
   where owner = u and mois = m and n < plafond
  returning n into v;
  return v;
end
$$;

-- Rend une unité (l'appel à Photoroom a échoué : un échec ne se paie pas).
create or replace function public.vrm_detourage_rendre(u uuid, m text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.detourage_usage set n = greatest(n - 1, 0) where owner = u and mois = m;
$$;

revoke execute on function public.vrm_detourage_reserver(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.vrm_detourage_rendre(uuid, text) from public, anon, authenticated;
grant execute on function public.vrm_detourage_reserver(uuid, text, integer) to service_role;
grant execute on function public.vrm_detourage_rendre(uuid, text) to service_role;
