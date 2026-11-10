-- ✅ APPLIQUÉE le 10 nov. 2026 par Julien (éditeur SQL de Supabase), en UN bloc SANS `concurrently`
--    (l'éditeur enveloppe tout dans une transaction ; app_data = 11 777 lignes, ~1 s de verrou).
-- ═══════════════════════════════════════════════════════════════════════════
-- 6 novembre 2026 — PAS ENCORE APPLIQUÉE (geste de Julien, voir
-- docs/passation/2026-11-06-charge.md). Le code marche SANS elle (chemin filtré
-- par `ilike`, plus lent côté base) et la prend dès qu'elle existe.
--
-- LA CHARGE : eBay envoie « Marketplace Account Deletion » pour TOUS ses
-- utilisateurs du monde (~3/min, 4 640 en 24 h mesurés le 6 nov.). Chaque
-- notification lisait :
--   · `id=eq.ebay_comptes` (le registre de TOUS les vendeurs, rendu en entier) ;
--   · `id=like.ebay_orders*` + `ilike` sur le texte de toutes les commandes.
-- Aucun index ne commence par `id` (la clé est (owner, id)) : chaque lecture
-- parcourait TOUTES les lignes de `app_data` (10 516 lignes, 82 Mo aujourd'hui,
-- 8 propriétaires) — O(nombre de vendeurs × leurs lignes), 9 000 fois par jour.
--
-- 1. Un index sur `id` seul (motifs `like 'x%'` compris) : toutes les lectures
--    « tous vendeurs » par identifiant (eBay, registre des e-mails,
--    `transp_*`, `colis_suivi_*`, `email_track_*` du serveur) deviennent des
--    lectures d'index.
-- 2. Les IDENTITÉS eBay rangées dans une ligne (`vrm_ebay_ids`) : pour
--    `ebay_orders` / `ebay_orders_{clé}`, le pseudo de chaque acheteur et de
--    chaque vendeur ; pour `ebay_comptes`, le pseudo et la clé de chaque compte.
--    En minuscules, sans espaces autour — la règle de l'app (`memeId` :
--    `trim().toLowerCase()`) ; l'égalité EXACTE est refaite par la route sur ce
--    qui est rendu (un sur-ensemble ne peut rien effacer à tort).
--    Index GIN sur cette expression, limité aux lignes `ebay%`.
-- 3. `vrm_ebay_cibles(p_ids)` : les (owner, id) dont une identité rangée est
--    dans `p_ids` — une lecture d'index, 0 ligne la plupart du temps.
--    Réservée à la clé de service (la route `api/ebay.js?mode=deletion`).
--
-- Rien n'est réécrit, aucune donnée ne bouge : l'index se calcule à sa
-- création (pas de rattrapage), et à chaque écriture d'une ligne `ebay%`.
-- `CONCURRENTLY` : la table reste écrivable pendant la construction (à lancer
-- HORS transaction, une instruction à la fois, dans l'éditeur SQL).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. L'index sur `id`.
create index concurrently if not exists app_data_id_motif on public.app_data (id text_pattern_ops);

-- 2. Les identités eBay d'une ligne.
create or replace function public.vrm_ebay_ids(p_id text, d jsonb) returns text[]
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(array_agg(distinct x) filter (where x is not null and x <> ''), '{}'::text[])
  from (
    select lower(regexp_replace(v, '^[[:space:]]+|[[:space:]]+$', '', 'g')) as x
    from (
      select o -> 'buyer' ->> 'username' as v
        from jsonb_array_elements(case when p_id ~ '^ebay_orders(_[0-9a-f]{16})?$' and jsonb_typeof(d -> 'orders') = 'array' then d -> 'orders' else '[]'::jsonb end) o
       where jsonb_typeof(o) = 'object' and jsonb_typeof(o -> 'buyer') = 'object'
      union all
      select o ->> 'sellerId'
        from jsonb_array_elements(case when p_id ~ '^ebay_orders(_[0-9a-f]{16})?$' and jsonb_typeof(d -> 'orders') = 'array' then d -> 'orders' else '[]'::jsonb end) o
       where jsonb_typeof(o) = 'object'
      union all
      select e ->> 'pseudo'
        from jsonb_array_elements(case when p_id = 'ebay_comptes' and jsonb_typeof(d -> 'comptes') = 'array' then d -> 'comptes' else '[]'::jsonb end) e
       where jsonb_typeof(e) = 'object'
      union all
      select e ->> 'cle'
        from jsonb_array_elements(case when p_id = 'ebay_comptes' and jsonb_typeof(d -> 'comptes') = 'array' then d -> 'comptes' else '[]'::jsonb end) e
       where jsonb_typeof(e) = 'object'
    ) brut
  ) t
$$;

create index concurrently if not exists app_data_ebay_ids on public.app_data
  using gin (public.vrm_ebay_ids(id, data)) where id like 'ebay%';

-- 3. Qui est concerné ? (même expression, même prédicat : l'index sert)
create or replace function public.vrm_ebay_cibles(p_ids text[]) returns table (owner uuid, id text)
language sql stable set search_path = '' as $$
  select a.owner, a.id from public.app_data a
   where a.id like 'ebay%' and public.vrm_ebay_ids(a.id, a.data) && p_ids
   order by a.owner, a.id
$$;
revoke all on function public.vrm_ebay_cibles(text[]) from public, anon, authenticated;
grant execute on function public.vrm_ebay_cibles(text[]) to service_role;
-- PostgREST relit son schéma (sinon la fonction reste « inconnue » — 404 — et
-- la route garde le chemin sans elle jusqu'au prochain rechargement).
notify pgrst, 'reload schema';

-- Vérifier (lecture seule) :
--   explain select owner, id from public.app_data a where a.id like 'ebay%' and public.vrm_ebay_ids(a.id, a.data) && array['inconnu'];
--   ⇒ « Bitmap Index Scan on app_data_ebay_ids »
--   select * from public.vrm_ebay_cibles(array['<un pseudo acheteur connu, en minuscules>']);
