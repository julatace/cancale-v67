-- ═══════════════════════════════════════════════════════════════════════════
-- 3 octobre 2026 — appliqué en production (projet lgonxzrzjcqthjtbdpzo).
-- VITESSE : une colonne `meta` (petits champs) calculée par la base à chaque
-- écriture, et des politiques RLS qui lisent l'identité UNE fois par requête.
-- Mesuré : lecture des transactions 2 140 ms → 8 ms, 0 écart sur 5 959 lignes.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Les politiques : `auth.uid()` réévalué à chaque ligne → `(select auth.uid())`.
alter policy "chacun ses lignes" on public.app_data using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
alter policy tout_select on public.app_data using (owner = (select auth.uid()));
alter policy tout_insert on public.app_data with check (owner = (select auth.uid()));
alter policy tout_update on public.app_data using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
alter policy "chacun ses comptes" on public.vinted_accounts using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
-- (tout_select / tout_insert / tout_update doublonnent « chacun ses lignes » ;
--  les retirer demande une confirmation humaine — sans effet sur les droits.)

create index if not exists app_data_owner_id_prefixe on public.app_data (owner, id text_pattern_ops);

-- 2. `meta` : les champs scalaires de premier niveau (≤ 600 car.), un témoin
--    `_pdf` (la ligne porte un PDF), et pour `harvest_{uid}_txn_*` les champs
--    de la transaction. Lire `meta` ne décompresse jamais `data`.
create or replace function public.vrm_meta(p_id text, d jsonb) returns jsonb
language sql immutable as $$
  select case when d is null or jsonb_typeof(d) <> 'object' then null else
    coalesce((select jsonb_object_agg(k, v) from jsonb_each(d) e(k, v)
               where jsonb_typeof(v) in ('string','number','boolean') and octet_length(v::text) <= 600), '{}'::jsonb)
    || case when coalesce(d->>'pdfB64','') <> '' then '{"_pdf":true}'::jsonb else '{}'::jsonb end
    || case when p_id ~ '^harvest_[0-9]+_txn_' then jsonb_strip_nulls(jsonb_build_object(
         'id', d->'payload'->'transaction'->'id',
         'item_id', d->'payload'->'transaction'->'item_id',
         'status', d->'payload'->'transaction'->'status',
         'status_title', d->'payload'->'transaction'->'status_title',
         'status_updated_at', d->'payload'->'transaction'->'status_updated_at',
         'ship_status_title', d->'payload'->'transaction'->'shipment'->'status_title'))
       else '{}'::jsonb end
  end
$$;
alter table public.app_data add column if not exists meta jsonb;
create or replace function public.vrm_meta_trigger() returns trigger language plpgsql as $$
begin
  new.meta := public.vrm_meta(new.id, new.data);
  return new;
end $$;
create trigger vrm_meta_maj before insert or update of data, id on public.app_data
  for each row execute function public.vrm_meta_trigger();
-- Rattrapage (fait par lots de ~1 500) :
-- update public.app_data set meta = public.vrm_meta(id, data);
