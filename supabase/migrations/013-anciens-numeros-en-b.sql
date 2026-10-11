-- ════════════════════════════════════════════════════════════════════════════
-- 013 — LES ANCIENS NUMÉROS DEVIENNENT « B… », LES NOUVELLES PAIRES REPARTENT DE 1
--        Décisions de Julien, 9 et 10 octobre 2026. PAS ENCORE APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- 9 octobre, en ses mots : « On va reprendre la numérotation à zéro. Je veux que
-- tous les anciens numéros, tu les fasses commencer par B1, B2… On commence à
-- partir de zéro à partir du moment où je commence à reposter. » À la question
-- « qu'est-ce que tu vas écrire sur les cartons des paires que tu reposteras ? »,
-- il a choisi « 1, 2, 3… (anciens → B) ».
-- 10 octobre, 08:10 UTC : « j'ai tout supp et je reposte, tu regarderas par
-- rapport à la date de mise en ligne ». Il a supprimé toutes ses annonces et
-- republie AVANT que cette migration passe. La coupure n'est donc plus
-- « l'instant de la migration » : c'est une DATE, `p_coupure` (T).
--
-- LA RÈGLE, par IDENTITÉ de l'annonce (son id Vinted), jamais par titre ni photo :
--   • une fiche est ANCIENNE si son annonce a été mise en ligne AVANT T : son
--     numéro devient « B » + l'ancien (266 → B266, 1 → B1) ;
--   • elle est NOUVELLE si son annonce a été mise en ligne à partir de T : elle
--     reçoit 1, 2, 3… dans l'ordre de mise en ligne (égalité : `numberedAt`,
--     puis l'id). Le numéro qu'elle portait (553… donné automatiquement après T)
--     sort du pool : il n'a jamais été écrit sur un carton (on lui a dit de ne
--     rien écrire avant le feu vert) ;
--   • la date de mise en ligne se lit, dans l'ordre : `created_at_ts` du dressing
--     capté (`harvest_{uid}_listings` — mesuré le 10 octobre : Vinted ne l'envoie
--     PAS), puis `photo.high_resolution.timestamp` du même dressing (l'heure de
--     dépôt de la photo : c'est la date que l'app affiche déjà), puis
--     `vinted_listing_dates[id]`, puis `numberedAt` de la fiche. Le rapport dit
--     combien de fiches ont été jugées par chaque source ;
--   • une fiche NUMÉROTÉE avant T (sans reprise ni saisie à la main après T) a
--     forcément été en ligne avant T — on ne numérote pas une annonce qui
--     n'existe pas encore. Si une source de date dit le contraire, la fiche est
--     ANCIENNE et c'est compté (`contradictions`) ;
--   • ce qui porte un numéro (ventes, bordereaux, liens Leboncoin, prix d'achat
--     par N°, paires retirées, garage…) : rattaché à une fiche NOUVELLE par
--     IDENTITÉ (transaction → annonce), il suit son nouveau numéro ; sinon un
--     numéro donné après T à UNE seule fiche nouvelle suit cette fiche ; donné à
--     plusieurs, on s'arrête (on ne devine pas) ; tout le reste passe en B.
--
-- ⚠️ C'EST LA SEULE FOIS qu'un numéro change sans un clic dans l'app (§5).
-- Le changement se fait UNE fois, sur sa demande, côté serveur, avec une
-- sauvegarde. Après, plus rien ne change un numéro tout seul.
--
-- CE FICHIER NE CONVERTIT RIEN. Il installe :
--   1. les tables de sauvegarde et le registre (schéma `sauvegarde`, que l'API
--      n'expose pas) ;
--   2. les règles de conversion ;
--   3. sauvegarde.vrm_numerotation_plan / _mesurer : lecture seule ;
--   4. sauvegarde.vrm_numerotation_archiver : verrouille `main`, vérifie la
--      mesure, sauvegarde, convertit, recompte, pose le marqueur ;
--   5. sauvegarde.vrm_numerotation_rattraper : les emails rangés PENDANT la
--      conversion avec un numéro de l'ancienne ligne ;
--   6. sauvegarde.vrm_numerotation_annuler : retour arrière CIBLÉ (les numéros
--      seulement), refusé dès qu'un numéro a bougé depuis ;
--   7. les GARDE-FOUS des écritures venues d'un navigateur (`main`, `vrm_room`).
--
-- L'APPEL est une étape à part : voir CLAUDE.md (« Anciens numéros en B ») et le
-- bas de ce fichier. Il faut d'abord la mesure, puis un essai dans une
-- transaction ANNULÉE, puis l'application.
--
-- Ce qui n'est PAS réécrit, exprès :
--   • les PDF déjà tamponnés (c'est de l'historique imprimé) ;
--   • `lbc_listings` et `ebay_listings` : ce sont des CAPTURES du texte posé
--     chez Leboncoin ou eBay, re-captées à chaque visite. Le marqueur liste par
--     IDENTIFIANT les annonces qui portaient un ancien numéro ;
--   • `vinted_stock_vinted` et `vinted_catalog` : une AUTRE numérotation (l'ancien
--     catalogue, 1…1815). La préfixer mélangerait deux séries ;
--   • `email_journal` (le journal du serveur) : rien ne le relit ;
--   • les sauvegardes `backup_*` et `sauvegarde.app_data_*` : figées.
-- ════════════════════════════════════════════════════════════════════════════

begin;
-- Une installation qui ATTEND un verrou bloquerait l'app et les emails derrière
-- elle. Mieux vaut échouer vite et recommencer à un moment calme.
set local lock_timeout = '3s';
set local statement_timeout = '60s';

create schema if not exists sauvegarde;

-- La copie d'avant, UNE PAR PASSAGE (la clé porte l'heure d'application) : après
-- un retour arrière puis une relance, la copie d'un passage ne remplace jamais
-- celle d'un autre.
create table if not exists sauvegarde.numerotation_013 (
  owner uuid not null,
  id text not null,
  passage timestamptz not null,
  data jsonb,
  pris_le timestamptz not null default now(),
  primary key (owner, id, passage));
revoke all on sauvegarde.numerotation_013 from public;

-- Le registre de ce qui a été fait. C'est LUI qui rend la fonction idempotente,
-- pas la seule présence du marqueur dans `main` : une ligne `main` se remet à la
-- main ou se renvoie depuis un appareil, un registre serveur ne bouge pas avec.
create table if not exists sauvegarde.numerotation_faite (
  owner uuid not null,
  version int not null,
  passage timestamptz not null,
  coupure timestamptz not null,
  archive text not null,
  rapport jsonb,
  annule_le timestamptz,
  primary key (owner, version));
revoke all on sauvegarde.numerotation_faite from public;

-- ── 1. L'IDENTITÉ D'UN NUMÉRO, comme `cleNum` dans l'app et l'extension ───────
-- Majuscules, sans espace, tiret, point ni souligné ; « 007 » vaut « 7 ».
-- ⚠️ Elle reste exécutable par les rôles du navigateur : le garde-fou (qui
-- tourne avec leurs droits) l'appelle. Fonction pure, sans accès aux données.
create or replace function public.vrm_cle_num(v jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null or jsonb_typeof(v) not in ('string', 'number') then null
    else (select case when s ~ '^[0-9]+$' then coalesce(nullif(ltrim(s, '0'), ''), '0') else s end
            from (select upper(regexp_replace(btrim(v #>> '{}'), '[\s\-_.]', '', 'g')) s) z)
  end
$$;

-- Les numéros des cartons d'un garage 3D (`vrm_room`) : boîte seule (`num`),
-- pile (`nums`) et cases (`slots`). Rend leur clé `cleNum`.
create or replace function public.vrm_nums_garage(d jsonb)
returns setof text
language sql
immutable
set search_path = ''
as $$
  select public.vrm_cle_num(z.v)
    from jsonb_array_elements(case when jsonb_typeof(d -> 'rooms') = 'array' then d -> 'rooms' else '[]' end) r,
         jsonb_array_elements(case when jsonb_typeof(r -> 'items') = 'array' then r -> 'items' else '[]' end) it,
         lateral (
           select it -> 'num' v where jsonb_typeof(it) = 'object' and it ? 'num'
           union all
           select e from jsonb_array_elements(case when jsonb_typeof(it -> 'nums') = 'array' then it -> 'nums' else '[]' end) e
           union all
           select e from jsonb_each(case when jsonb_typeof(it -> 'slots') = 'object' then it -> 'slots' else '{}' end) s(c, a),
                         jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]' end) e
         ) z
   where public.vrm_cle_num(z.v) is not null and public.vrm_cle_num(z.v) <> ''
$$;


-- ── 2. LES RÈGLES DE CONVERSION ───────────────────────────────────────────────
-- Le GENRE d'une valeur :
--   'vide'    : absente, null, chaîne vide ;
--   'nu'      : un numéro en chiffres (entier JSON ou chaîne de 1 à 6 chiffres, > 0) ;
--   'lot'     : « 12+13 » (plusieurs paires dans un colis) : élément par élément ;
--   'lettres' : porte des lettres (« B125 », « C3 », « 1+B12 ») : on n'y touche pas ;
--   'autre'   : tout le reste (« 0 », sept chiffres, « 12a », 12.5, un objet…).
--               Une seule valeur « autre » ARRÊTE la conversion : on ne devine pas.
create or replace function sauvegarde.vrm_num_genre(v jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then 'vide'
    when jsonb_typeof(v) = 'number' then
      case when (v #>> '{}') ~ '^[0-9]{1,6}$' and (v #>> '{}')::bigint > 0 then 'nu' else 'autre' end
    when jsonb_typeof(v) = 'string' then
      case
        when btrim(v #>> '{}') = '' then 'vide'
        when btrim(v #>> '{}') ~ '^[0-9]{1,6}$' then case when (btrim(v #>> '{}'))::bigint > 0 then 'nu' else 'autre' end
        when btrim(v #>> '{}') ~ '^[0-9]{1,6}(\s*\+\s*[0-9]{1,6})+$'
             and btrim(v #>> '{}') !~ '(^|\+)\s*0+\s*(\+|$)' then 'lot'
        when public.vrm_cle_num(v) ~ '^([A-Z]{1,3})?[0-9]{1,6}(\+([A-Z]{1,3})?[0-9]{1,6})*$'
             and public.vrm_cle_num(v) ~ '[A-Z]' then 'lettres'
        else 'autre' end
    else 'autre'
  end
$$;

-- Les éléments d'un numéro ('nu' : un ; 'lot' : plusieurs), en entiers.
create or replace function sauvegarde.vrm_num_elements(v jsonb)
returns setof bigint
language sql
immutable
set search_path = ''
as $$
  select (btrim(x))::bigint
    from regexp_split_to_table(btrim(v #>> '{}'), '\+') with ordinality t(x, o)
   where sauvegarde.vrm_num_genre(v) in ('nu', 'lot')
   order by o
$$;

-- Une valeur de la série d'archive (« B266 », « B12+B13 ») ?
create or replace function sauvegarde.vrm_num_est_archive(v jsonb, prefixe text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(public.vrm_cle_num(v) ~ ('^' || prefixe || '[0-9]{1,6}(\+' || prefixe || '[0-9]{1,6})*$'), false)
$$;

-- CONVERTIR UNE VALEUR. `carte` = les numéros donnés APRÈS la coupure à une
-- fiche nouvelle : {"553": "1"} (suit la fiche) ou {"553": null} (donné à
-- plusieurs fiches nouvelles : impossible de savoir laquelle il désigne ⇒ on
-- s'arrête). Tout autre numéro en chiffres devient « B… ». Rend NULL si la
-- valeur n'est pas un numéro en chiffres (on n'y touche pas).
create or replace function sauvegarde.vrm_val(v jsonb, prefixe text, carte jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
  x text;
  c text;
  res text[] := '{}';
begin
  if sauvegarde.vrm_num_genre(v) = 'nu' then parts := array[btrim(v #>> '{}')];
  elsif sauvegarde.vrm_num_genre(v) = 'lot' then parts := regexp_split_to_array(btrim(v #>> '{}'), '\s*\+\s*');
  else return null; end if;
  foreach x in array parts loop
    c := ((btrim(x))::bigint)::text;
    if carte is not null and carte ? c then
      if jsonb_typeof(carte -> c) <> 'string' then
        raise exception 'vrm_numerotation : le numéro % a été donné après la coupure à PLUSIEURS paires nouvelles — impossible de savoir laquelle il désigne ici. Rien n''est fait.', c;
      end if;
      res := res || (carte ->> c);
    else
      res := res || (prefixe || c);
    end if;
  end loop;
  return to_jsonb(array_to_string(res, '+'));
end
$$;

-- CE QUE DEVIENT UN NUMÉRO lu sur une annonce d'une autre plateforme (SKU eBay,
-- référence Leboncoin) : la règle de `vrm_val`, sans jamais lever — un numéro
-- donné après la coupure à PLUSIEURS paires nouvelles rend '' (aucune paire :
-- mieux vaut un blanc qu'un faux), sans arrêter la conversion pour une annonce.
create or replace function sauvegarde.vrm_traduire(c text, prefixe text, carte jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when c is null or c !~ '^[0-9]+$' then null
              when carte is not null and carte ? c then case when jsonb_typeof(carte -> c) = 'string' then carte ->> c else '' end
              else prefixe || c end
$$;

-- Un TITRE comparé comme le fait le serveur (`normTitre`, api/_lib/numerotation.js) :
-- minuscules, espaces resserrés.
create or replace function sauvegarde.vrm_norm_titre(t text)
returns text
language sql
immutable
set search_path = ''
as $$ select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))) $$;

-- Une date en millisecondes : un nombre (secondes ou millisecondes), ou un texte ISO.
create or replace function sauvegarde.vrm_ms(v jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare n numeric;
begin
  if v is null then return null; end if;
  if jsonb_typeof(v) = 'number' then
    n := (v #>> '{}')::numeric;
    if n <= 0 then return null; end if;
    return case when n < 1e12 then n * 1000 else n end;
  end if;
  if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then
    return extract(epoch from (v #>> '{}')::timestamptz) * 1000;
  end if;
  return null;
exception when others then return null;
end
$$;

create or replace function sauvegarde.vrm_iso(ms numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when ms is null then null
              else to_char(to_timestamp(ms / 1000.0) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;

-- Toutes les VALEURS qui portent un numéro, selon la forme de l'endroit :
--   'liste'       : une liste de numéros (le pool) ;
--   'champ'       : un objet {clé: {…, numero}} (fiches, ventes, bordereaux
--                   reliés, brouillons eBay) ;
--   'cles'        : les CLÉS d'un objet (prix d'achat par N°, paires retirées) ;
--   'valeurs'     : les valeurs d'un objet (liens Leboncoin) ;
--   'liste_champ' : une liste d'objets {…, numero} (achats hors Vinted) ;
--   'grille'      : {case: [numéros]} (garage 2D) ;
--   'pointage'    : les clés de `pointes` (pointage du stock) ;
--   'garage'      : le garage 3D (`vrm_room`) ;
--   'pins'        : les repères de « Mon local en photo » (`vrm_local`).
create or replace function sauvegarde.vrm_valeurs(d jsonb, quoi text)
returns setof jsonb
language plpgsql
immutable
set search_path = ''
as $$
-- Une branche par endroit : seule celle demandée s'exécute (la version en UNE
-- requête à neuf branches mettait 1,9 s pour 405 fiches — mesuré).
begin
  if quoi = 'liste' then
    return query select e from jsonb_array_elements(case when jsonb_typeof(d) = 'array' then d else '[]' end) e;
  elsif quoi = 'champ' then
    return query select v -> 'numero' from jsonb_each(case when jsonb_typeof(d) = 'object' then d else '{}' end) x(k, v)
      where jsonb_typeof(v) = 'object';
  elsif quoi = 'cles' then
    return query select to_jsonb(k) from jsonb_object_keys(case when jsonb_typeof(d) = 'object' then d else '{}' end) k;
  elsif quoi = 'valeurs' then
    return query select v from jsonb_each(case when jsonb_typeof(d) = 'object' then d else '{}' end) x(k, v);
  elsif quoi = 'liste_champ' then
    return query select v -> 'numero' from jsonb_array_elements(case when jsonb_typeof(d) = 'array' then d else '[]' end) v
      where jsonb_typeof(v) = 'object';
  elsif quoi = 'grille' then
    return query select e from jsonb_each(case when jsonb_typeof(d) = 'object' then d else '{}' end) x(k, a),
                  jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]' end) e;
  elsif quoi = 'pointage' then
    return query select to_jsonb(k) from jsonb_object_keys(case when jsonb_typeof(d -> 'pointes') = 'object' then d -> 'pointes' else '{}' end) k;
  elsif quoi = 'garage' then
    return query select z.v
      from jsonb_array_elements(case when jsonb_typeof(d -> 'rooms') = 'array' then d -> 'rooms' else '[]' end) r,
           jsonb_array_elements(case when jsonb_typeof(r -> 'items') = 'array' then r -> 'items' else '[]' end) it,
           lateral (
             select it -> 'num' v where jsonb_typeof(it) = 'object' and it ? 'num'
             union all
             select e from jsonb_array_elements(case when jsonb_typeof(it -> 'nums') = 'array' then it -> 'nums' else '[]' end) e
             union all
             select e from jsonb_each(case when jsonb_typeof(it -> 'slots') = 'object' then it -> 'slots' else '{}' end) s(c, a),
                           jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]' end) e
             union all
             -- Une pile SANS liste se numérote depuis `start` (start, start+1…) :
             -- ce sont aussi des cartons étiquetés.
             select to_jsonb(((it ->> 'start')::bigint + g)::text)
               from generate_series(0, greatest(1, coalesce(nullif(it ->> 'cols', '')::int, 1)) * greatest(1, coalesce(nullif(it ->> 'rows', '')::int, 5)) - 1) g
              where jsonb_typeof(it) = 'object' and it ->> 'type' = 'pile'
                and coalesce(jsonb_array_length(case when jsonb_typeof(it -> 'nums') = 'array' then it -> 'nums' else '[]' end), 0) = 0
                and coalesce(it ->> 'start', '') ~ '^[0-9]{1,6}$' and coalesce(it ->> 'cols', '1') ~ '^[0-9]{1,3}$' and coalesce(it ->> 'rows', '5') ~ '^[0-9]{1,3}$'
           ) z;
  elsif quoi = 'pins' then
    return query select pin -> 'numero'
      from jsonb_array_elements(case when jsonb_typeof(d -> 'photos') = 'array' then d -> 'photos' else '[]' end) ph,
           jsonb_array_elements(case when jsonb_typeof(ph -> 'pins') = 'array' then ph -> 'pins' else '[]' end) pin
     where jsonb_typeof(pin) = 'object';
  end if;
end
$$;

-- Le BILAN d'un endroit : combien de valeurs de chaque genre. `neufs` = combien
-- de numéros en chiffres il porte, `neufMax` = le plus grand (après la
-- conversion, ce sont les nouvelles paires 1…N).
create or replace function sauvegarde.vrm_bilan(d jsonb, quoi text, prefixe text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*) filter (where g <> 'vide'),
    'nu', count(*) filter (where g = 'nu'),
    'lot', count(*) filter (where g = 'lot'),
    'archive', count(*) filter (where g = 'lettres' and arc),
    'lettres', count(*) filter (where g = 'lettres' and not arc),
    'autre', count(*) filter (where g = 'autre'),
    -- (Les éléments ne sont découpés que pour un LOT : un numéro seul se lit
    -- directement — l'appel par valeur coûtait 1,5 s de verrou sur `main`.)
    'neufMax', max(case when g = 'nu' then (btrim(v #>> '{}'))::bigint
                        when g = 'lot' then (select max(x) from sauvegarde.vrm_num_elements(v) x) end))
  from (select v, g, g = 'lettres' and sauvegarde.vrm_num_est_archive(v, prefixe) arc
          from (select v, sauvegarde.vrm_num_genre(v) g from sauvegarde.vrm_valeurs(d, quoi) v) y) z
$$;

-- CONVERTIR un endroit. `parcle` : {clé: "nouveau numéro"} — une entrée rattachée
-- par IDENTITÉ à une fiche nouvelle (la fiche elle-même, ou une vente par sa
-- transaction) prend ce numéro, quelle que soit la valeur qu'elle portait.
create or replace function sauvegarde.vrm_conv(d jsonb, quoi text, prefixe text, carte jsonb, parcle jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  res jsonb;
begin
  if d is null then return null; end if;
  if quoi = 'champ' then
    if jsonb_typeof(d) <> 'object' then return d; end if;
    select coalesce(jsonb_object_agg(k, case
             when jsonb_typeof(v) = 'object' and sauvegarde.vrm_num_genre(v -> 'numero') <> 'vide' and parcle ? k
               then jsonb_set(v, '{numero}', parcle -> k)
             when jsonb_typeof(v) = 'object' and sauvegarde.vrm_val(v -> 'numero', prefixe, carte) is not null
               then jsonb_set(v, '{numero}', sauvegarde.vrm_val(v -> 'numero', prefixe, carte))
             else v end), '{}'::jsonb) into res
      from jsonb_each(d) e(k, v);
    return res;
  elsif quoi = 'cles' then
    if jsonb_typeof(d) <> 'object' then return d; end if;
    select coalesce(jsonb_object_agg(coalesce(sauvegarde.vrm_val(to_jsonb(k), prefixe, carte) #>> '{}', k), v), '{}'::jsonb) into res
      from jsonb_each(d) e(k, v);
    return res;
  elsif quoi = 'valeurs' then
    if jsonb_typeof(d) <> 'object' then return d; end if;
    select coalesce(jsonb_object_agg(k, coalesce(sauvegarde.vrm_val(v, prefixe, carte), v)), '{}'::jsonb) into res
      from jsonb_each(d) e(k, v);
    return res;
  elsif quoi = 'liste_champ' then
    if jsonb_typeof(d) <> 'array' then return d; end if;
    select coalesce(jsonb_agg(case
             when jsonb_typeof(v) = 'object' and sauvegarde.vrm_val(v -> 'numero', prefixe, carte) is not null
             then jsonb_set(v, '{numero}', sauvegarde.vrm_val(v -> 'numero', prefixe, carte))
             else v end order by o), '[]'::jsonb) into res
      from jsonb_array_elements(d) with ordinality t(v, o);
    return res;
  elsif quoi = 'grille' then
    if jsonb_typeof(d) <> 'object' then return d; end if;
    select coalesce(jsonb_object_agg(c, case when jsonb_typeof(a) = 'array' then
             (select coalesce(jsonb_agg(coalesce(sauvegarde.vrm_val(e, prefixe, carte), e) order by o), '[]'::jsonb)
                from jsonb_array_elements(a) with ordinality t(e, o))
             else a end), '{}'::jsonb) into res
      from jsonb_each(d) s(c, a);
    return res;
  elsif quoi = 'pointage' then
    if jsonb_typeof(d) <> 'object' or jsonb_typeof(d -> 'pointes') <> 'object' then return d; end if;
    -- Un pointage commencé AVANT la coupure ne dit plus rien des nouvelles
    -- paires : `debut` repart à vide (le retour arrière le remet depuis la copie).
    res := jsonb_set(d, '{pointes}', sauvegarde.vrm_conv(d -> 'pointes', 'cles', prefixe, carte));
    return jsonb_set(res, '{debut}', 'null'::jsonb);
  elsif quoi = 'pins' then
    if jsonb_typeof(d) <> 'object' or jsonb_typeof(d -> 'photos') <> 'array' then return d; end if;
    select coalesce(jsonb_agg(case when jsonb_typeof(ph) = 'object' and jsonb_typeof(ph -> 'pins') = 'array'
             then jsonb_set(ph, '{pins}', sauvegarde.vrm_conv(ph -> 'pins', 'liste_champ', prefixe, carte))
             else ph end order by o), '[]'::jsonb) into res
      from jsonb_array_elements(d -> 'photos') with ordinality t(ph, o);
    return jsonb_set(d, '{photos}', res);
  end if;
  raise exception 'vrm_conv : endroit inconnu (%)', quoi;
end
$$;

-- Le garage 3D : `num`, `nums` et `slots` convertis ; une pile qui se numérotait
-- depuis `start` reçoit sa liste (B116…), et `start` est RETIRÉ des piles : l'app
-- proposait « 144 » (start + taille) pour la pile suivante — des cartons
-- étiquetés hors du pool. ⚠️ Pas de dédoublonnage dans une pile : deux boîtes
-- « 143 » sont deux boîtes, à leur place.
create or replace function sauvegarde.vrm_garage_conv(d jsonb, prefixe text, carte jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  rooms jsonb := '[]'::jsonb;
  r jsonb;
  items jsonb;
  it jsonb;
  conv jsonb;
  n int;
begin
  if d is null or jsonb_typeof(d) <> 'object' or jsonb_typeof(d -> 'rooms') is distinct from 'array' then
    return d;
  end if;
  for r in select x from jsonb_array_elements(d -> 'rooms') x loop
    items := '[]'::jsonb;
    if jsonb_typeof(r) = 'object' and jsonb_typeof(r -> 'items') = 'array' then
      for it in select x from jsonb_array_elements(r -> 'items') x loop
        if jsonb_typeof(it) = 'object' then
          if it ->> 'type' = 'pile'
             and coalesce(jsonb_array_length(case when jsonb_typeof(it -> 'nums') = 'array' then it -> 'nums' else '[]' end), 0) = 0
             and coalesce(it ->> 'start', '') ~ '^[0-9]{1,6}$' then
            n := greatest(1, coalesce(nullif(it ->> 'cols', '')::int, 1)) * greatest(1, coalesce(nullif(it ->> 'rows', '')::int, 5));
            it := jsonb_set(it, '{nums}', (select jsonb_agg(to_jsonb(((it ->> 'start')::bigint + g)::text) order by g) from generate_series(0, n - 1) g));
          end if;
          if it ? 'num' then
            conv := sauvegarde.vrm_val(it -> 'num', prefixe, carte);
            if conv is not null then it := jsonb_set(it, '{num}', conv); end if;
          end if;
          if jsonb_typeof(it -> 'nums') = 'array' then
            it := jsonb_set(it, '{nums}', (select coalesce(jsonb_agg(coalesce(sauvegarde.vrm_val(e, prefixe, carte), e) order by o), '[]'::jsonb)
                                            from jsonb_array_elements(it -> 'nums') with ordinality t(e, o)));
          end if;
          if jsonb_typeof(it -> 'slots') = 'object' then
            it := jsonb_set(it, '{slots}', sauvegarde.vrm_conv(it -> 'slots', 'grille', prefixe, carte));
          end if;
          if it ->> 'type' = 'pile' and it ? 'start' then it := it - 'start'; end if;
        end if;
        items := items || jsonb_build_array(it);
      end loop;
      r := jsonb_set(r, '{items}', items);
    end if;
    rooms := rooms || jsonb_build_array(r);
  end loop;
  return jsonb_set(d, '{rooms}', rooms);
end
$$;

-- Les ENDROITS de la ligne `main` qui portent un numéro : (clé, forme).
create or replace function sauvegarde.vrm_endroits_main()
returns table (cle text, quoi text)
language sql
immutable
set search_path = ''
as $$
  values ('vinted_used_numeros', 'liste'),
         ('vinted_annonce_numeros', 'champ'),
         ('vinted_sale_overrides', 'champ'),
         ('vinted_buyprice_by_num', 'cles'),
         ('vinted_pairs_lost', 'cles'),
         ('vrm_lbc_liens', 'valeurs'),
         ('vinted_bord_links', 'champ'),
         ('vinted_offvinted_buys', 'liste_champ'),
         ('vinted_garage_grid', 'grille'),
         ('vrm_inventaire_pointage', 'pointage')
$$;

-- LA PROJECTION des numéros d'une ligne `main` : tout ce qui porte un numéro,
-- et rien d'autre. Sert au retour arrière : il n'est permis que si AUCUN
-- numéro n'a bougé depuis la conversion.
create or replace function sauvegarde.vrm_projection(d jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'vinted_used_numeros', (select coalesce(jsonb_agg(c order by c), '[]') from (select distinct public.vrm_cle_num(e) c from jsonb_array_elements(case when jsonb_typeof(d -> 'vinted_used_numeros') = 'array' then d -> 'vinted_used_numeros' else '[]' end) e) z),
    'vinted_annonce_numeros', (select coalesce(jsonb_object_agg(k, v -> 'numero'), '{}') from jsonb_each(case when jsonb_typeof(d -> 'vinted_annonce_numeros') = 'object' then d -> 'vinted_annonce_numeros' else '{}' end) e(k, v) where jsonb_typeof(v) = 'object' and sauvegarde.vrm_num_genre(v -> 'numero') <> 'vide'),
    'vinted_sale_overrides', (select coalesce(jsonb_object_agg(k, v -> 'numero'), '{}') from jsonb_each(case when jsonb_typeof(d -> 'vinted_sale_overrides') = 'object' then d -> 'vinted_sale_overrides' else '{}' end) e(k, v) where jsonb_typeof(v) = 'object' and sauvegarde.vrm_num_genre(v -> 'numero') <> 'vide'),
    'vinted_bord_links', (select coalesce(jsonb_object_agg(k, v -> 'numero'), '{}') from jsonb_each(case when jsonb_typeof(d -> 'vinted_bord_links') = 'object' then d -> 'vinted_bord_links' else '{}' end) e(k, v) where jsonb_typeof(v) = 'object' and sauvegarde.vrm_num_genre(v -> 'numero') <> 'vide'),
    'vinted_buyprice_by_num', (select coalesce(jsonb_agg(k order by k), '[]') from jsonb_object_keys(case when jsonb_typeof(d -> 'vinted_buyprice_by_num') = 'object' then d -> 'vinted_buyprice_by_num' else '{}' end) k),
    'vinted_pairs_lost', (select coalesce(jsonb_agg(k order by k), '[]') from jsonb_object_keys(case when jsonb_typeof(d -> 'vinted_pairs_lost') = 'object' then d -> 'vinted_pairs_lost' else '{}' end) k),
    'vrm_lbc_liens', coalesce(d -> 'vrm_lbc_liens', 'null'),
    'vinted_offvinted_buys', (select coalesce(jsonb_agg(jsonb_build_array(v -> 'id', v -> 'numero') order by o), '[]') from jsonb_array_elements(case when jsonb_typeof(d -> 'vinted_offvinted_buys') = 'array' then d -> 'vinted_offvinted_buys' else '[]' end) with ordinality t(v, o) where jsonb_typeof(v) = 'object'),
    'vinted_garage_grid', coalesce(d -> 'vinted_garage_grid', 'null'),
    'vrm_inventaire_pointage', (select coalesce(jsonb_agg(k order by k), '[]') from jsonb_object_keys(case when jsonb_typeof(d -> 'vrm_inventaire_pointage' -> 'pointes') = 'object' then d -> 'vrm_inventaire_pointage' -> 'pointes' else '{}' end) k),
    'vrm_num_prefixe', coalesce(d -> 'vrm_num_prefixe', 'null'))
$$;
create or replace function sauvegarde.vrm_proj_liste(d jsonb, quoi text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(v order by v::text), '[]') from sauvegarde.vrm_valeurs(d, quoi) v where sauvegarde.vrm_num_genre(v) <> 'vide'
$$;

-- « Aucun numéro » a trois formes : une ligne absente (NULL SQL), le `null` JSON
-- rangé dans le rapport pour cette ligne absente, et une liste vide `[]`. Le
-- retour arrière compare les projections : les trois doivent être égales.
create or replace function sauvegarde.vrm_proj_aucun(j jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when j is null or jsonb_typeof(j) = 'null' or j = '[]'::jsonb then null else j end
$$;

-- ── 3. LE PLAN ET LA MESURE (lecture seule) ───────────────────────────────────
-- Le PLAN : quelles fiches sont nouvelles, jugées par quelle source de date, et
-- leur nouveau numéro. Par IDENTITÉ de l'annonce (son id Vinted), jamais par
-- titre ni photo.
create or replace function sauvegarde.vrm_numerotation_plan(p_owner uuid, p_coupure timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d jsonb;
  t_ms numeric := extract(epoch from p_coupure) * 1000;
  res jsonb;
begin
  if p_coupure is null then raise exception 'vrm_numerotation : la coupure (date de mise en ligne) est obligatoire'; end if;
  select data into d from public.app_data where owner = p_owner and id = 'main';
  if d is null then return null; end if;
  with
  dres as (
    select it ->> 'id' iid,
           min(sauvegarde.vrm_ms(it -> 'created_at_ts')) c_ms,
           min(sauvegarde.vrm_ms(it -> 'photo' -> 'high_resolution' -> 'timestamp')) p_ms,
           -- Vue OUVERTE dans au moins une capture (pour le rapport seulement :
           -- une annonce mise en ligne après T puis supprimée se voit).
           bool_or(coalesce(it ->> 'is_closed', 'false') <> 'true') ouverte
      from public.app_data a,
           jsonb_array_elements(case when jsonb_typeof(a.data -> 'payload' -> 'items') = 'array' then a.data -> 'payload' -> 'items' else '[]' end) it
     where a.owner = p_owner and a.id ~ '^harvest_[0-9]+_listings$' and jsonb_typeof(it) = 'object' and coalesce(it ->> 'id', '') <> ''
     group by 1),
  ld as (
    select k iid, sauvegarde.vrm_ms(v -> 'ts') ms
      from public.app_data a, jsonb_each(case when jsonb_typeof(a.data) = 'object' then a.data else '{}' end) e(k, v)
     where a.owner = p_owner and a.id = 'vinted_listing_dates' and jsonb_typeof(v) = 'object'),
  f as (
    select k id, v, public.vrm_cle_num(v -> 'numero') cle, sauvegarde.vrm_num_genre(v -> 'numero') genre,
           sauvegarde.vrm_ms(v -> 'numberedAt') na, sauvegarde.vrm_ms(v -> 'repriseAt') ra, sauvegarde.vrm_ms(v -> 'manuelAt') ma,
           coalesce(v -> 'auto' = 'true'::jsonb, false) auto
      from jsonb_each(case when jsonb_typeof(d -> 'vinted_annonce_numeros') = 'object' then d -> 'vinted_annonce_numeros' else '{}' end) e(k, v)
     where jsonb_typeof(v) = 'object' and sauvegarde.vrm_num_genre(v -> 'numero') <> 'vide'),
  fd as (
    select f.*, coalesce(dres.c_ms, dres.p_ms, ld.ms, f.na) date_ms, dres.ouverte,
           case when dres.c_ms is not null then 'dressing'
                when dres.p_ms is not null then 'dressingPhoto'
                when ld.ms is not null then 'listingDates'
                when f.na is not null then 'numberedAt'
                else 'aucune' end source
      from f left join dres on dres.iid = f.id left join ld on ld.iid = f.id),
  cl as (
    select fd.*,
           -- Numérotée avant T sans reprise ni saisie après T : en ligne avant T.
           (date_ms is not null and date_ms >= t_ms and source <> 'numberedAt' and na is not null and na < t_ms
              and coalesce(ra, 0) < t_ms and coalesce(ma, 0) < t_ms) contradiction
      from fd),
  cl2 as (select cl.*, (date_ms is not null and date_ms >= t_ms and not contradiction) nouvelle from cl),
  nv as (select cl2.*, row_number() over (order by date_ms, na nulls last, id) rang from cl2 where nouvelle),
  -- Les numéros donnés APRÈS la coupure : portés par des fiches nouvelles
  -- seulement, toutes numérotées automatiquement après T (ni reprise, ni saisie).
  frap as (
    select cle from cl2 where genre = 'nu' group by cle
    having bool_and(nouvelle and auto and na is not null and na >= t_ms and ra is null and ma is null)),
  carte as (
    select cle, case when count(*) = 1 then to_jsonb(min(rang)::text) else 'null'::jsonb end val
      from nv where cle in (select cle from frap) group by cle),
  txi0 as (
    select substring(a.id from '_txn_([0-9]+)$') tx, a.meta ->> 'item_id' iid, 1 prio
      from public.app_data a
     where a.owner = p_owner and a.id ~ '^harvest_[0-9]+_txn_[0-9]+$' and coalesce(a.meta ->> 'item_id', '') <> ''
    union all
    -- Le BORDEREAU capté par l'extension porte lui aussi l'annonce de sa vente
    -- (`harvest_{uid}_label_{tx}` : `meta.tx` → `meta.item`, l'identité que l'app
    -- lit déjà, `labelsCaptes[tx].item`). Mesuré chez lui le 11 octobre : 3 ventes
    -- d'après la coupure n'ont QUE lui (aucune transaction captée) — sans cette
    -- source elles passaient en « B564 » pendant que leurs voisines, captées par la
    -- transaction, suivaient leur paire. La transaction se lit dans l'IDENTIFIANT
    -- de la ligne ; si `meta.tx` en dit une autre, doute ⇒ on ne relie pas.
    -- (`label_latest` est une COPIE : écartée par la forme de l'identifiant.)
    select substring(a.id from '_label_([0-9]+)$'), a.meta ->> 'item', 1
      from public.app_data a
     where a.owner = p_owner and a.id ~ '^harvest_[0-9]+_label_[0-9]+$' and coalesce(a.meta ->> 'item', '') <> ''
       and coalesce(a.meta ->> 'tx', substring(a.id from '_label_([0-9]+)$')) = substring(a.id from '_label_([0-9]+)$')
    union all
    select k, v #>> '{}', 2 from jsonb_each(case when jsonb_typeof(d -> 'vinted_txn_link') = 'object' then d -> 'vinted_txn_link' else '{}' end) e(k, v)
     where jsonb_typeof(v) in ('string', 'number')),
  txi as (
    -- La transaction → son annonce. Ce que Vinted dit (la transaction ou le
    -- bordereau captés) passe avant ce que l'app a déduit ; deux annonces
    -- différentes ⇒ on ne relie pas. (Une fenêtre, pas une sous-requête
    -- corrélée : 1 000 transactions × 1 000 relectures, mesuré 1,7 s.)
    select tx, min(iid) iid from (select tx, iid, prio, min(prio) over (partition by tx) pmin from txi0) t
     where prio = pmin
     group by tx having count(distinct iid) = 1),
  partx as (select txi.tx, nv.rang from txi join nv on nv.id = txi.iid)
  select jsonb_build_object(
    'coupure', sauvegarde.vrm_iso(t_ms),
    'fiches', (select count(*) from cl2),
    'sources', (select coalesce(jsonb_object_agg(source, n), '{}') from (select source, count(*) n from cl2 group by source) z),
    'sourcesNouvelles', (select coalesce(jsonb_object_agg(source, n), '{}') from (select source, count(*) n from nv group by source) z),
    'contradictions', (select count(*) from cl2 where contradiction),
    'nouvelles', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'avant', v -> 'numero', 'apres', rang::text,
                                                               'date', sauvegarde.vrm_iso(date_ms), 'source', source,
                                                               'enLigne', coalesce(ouverte, false)) order by rang), '[]') from nv),
    -- Une « nouvelle » qu'aucune capture ne montre ouverte (supprimée, ou jamais
    -- vue) : elle prendra quand même un numéro neuf — à regarder AVANT d'appliquer
    -- (une coupure trop tôt numéroterait des annonces supprimées depuis).
    'nouvellesPasEnLigne', (select count(*) from nv where not coalesce(ouverte, false)),
    'carte', (select coalesce(jsonb_object_agg(cle, val), '{}') from carte),
    'parTx', (select coalesce(jsonb_object_agg(tx, rang::text), '{}') from partx))
    into res;
  return res;
end
$$;

-- Le BILAN des numéros (tout ce que la mesure compte, SANS le plan) : la
-- conversion le recalcule APRÈS avoir écrit, pour recompter. Le plan, lui, n'est
-- calculé qu'UNE fois par conversion (mesuré sur sa copie : 1,7 s sur les 6 s de
-- l'archivage, pendant lesquelles `main` est verrouillée).
create or replace function sauvegarde.vrm_numerotation_bilan(p_owner uuid, p_prefixe text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d jsonb;
  res jsonb := '{}'::jsonb;
  en record;
  pool_cles text[];
begin
  select data into d from public.app_data where owner = p_owner and id = 'main';
  if d is null then return null; end if;
  for en in select * from sauvegarde.vrm_endroits_main() loop
    res := res || jsonb_build_object(en.cle, sauvegarde.vrm_bilan(d -> en.cle, en.quoi, p_prefixe)
                   || jsonb_build_object('entrees', case jsonb_typeof(d -> en.cle)
                        when 'object' then (select count(*) from jsonb_object_keys(d -> en.cle))
                        when 'array' then jsonb_array_length(d -> en.cle) else 0 end));
  end loop;
  select array_agg(distinct public.vrm_cle_num(x)) into pool_cles
    from jsonb_array_elements(case when jsonb_typeof(d -> 'vinted_used_numeros') = 'array' then d -> 'vinted_used_numeros' else '[]' end) x;
  res := res || jsonb_build_object(
    'poolCles', coalesce(array_length(pool_cles, 1), 0),
    'poolMax', (select max((x #>> '{}')::bigint) from jsonb_array_elements(case when jsonb_typeof(d -> 'vinted_used_numeros') = 'array' then d -> 'vinted_used_numeros' else '[]' end) x
                 where sauvegarde.vrm_num_genre(x) = 'nu'),
    'dernierNumberedAt', (select max(v ->> 'numberedAt') from jsonb_each(case when jsonb_typeof(d -> 'vinted_annonce_numeros') = 'object' then d -> 'vinted_annonce_numeros' else '{}' end) x(k, v) where jsonb_typeof(v) = 'object'),
    'garage3d', coalesce((select sauvegarde.vrm_bilan(data, 'garage', p_prefixe) from public.app_data where owner = p_owner and id = 'vrm_room'), '{}'::jsonb),
    'localPhotos', coalesce((select sauvegarde.vrm_bilan(data, 'pins', p_prefixe) from public.app_data where owner = p_owner and id = 'vrm_local'), '{}'::jsonb),
    'ebayBrouillons', coalesce((select sauvegarde.vrm_bilan(data -> 'items', 'champ', p_prefixe) from public.app_data where owner = p_owner and id = 'ebay_brouillons'), '{}'::jsonb),
    'emails', (select jsonb_build_object(
        'lignes', count(*),
        'nus', count(*) filter (where g in ('nu', 'lot')),
        'archive', count(*) filter (where g = 'lettres' and sauvegarde.vrm_num_est_archive(n, p_prefixe)),
        'lettres', count(*) filter (where g = 'lettres' and not sauvegarde.vrm_num_est_archive(n, p_prefixe)),
        'autre', count(*) filter (where g = 'autre'),
        'neufMax', max(case when g = 'nu' then (btrim(n #>> '{}'))::bigint
                            when g = 'lot' then (select max(x) from sauvegarde.vrm_num_elements(n) x) end))
      from (select a.data -> 'numero' n, sauvegarde.vrm_num_genre(a.data -> 'numero') g
              from public.app_data a
             where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_') z),
    'marqueur', d -> 'vrm_numerotation');
  return res;
end
$$;


-- LES DRESSINGS DE SES COMPTES : la date de la dernière capture de chaque
-- compte lié. Un dressing capté AVANT la coupure ne montre AUCUNE annonce
-- republiée : sur ce compte, le plan ne voit rien (mesuré le 11 octobre : deux
-- comptes figés au 8 octobre, dont un avec trois ventes après la coupure). À
-- regarder AVANT d'appliquer ; ce n'est pas comparé à l'application (une
-- capture de plus entre la mesure et l'application ne change rien au plan).
create or replace function sauvegarde.vrm_numerotation_dressings(p_owner uuid, p_coupure timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with comptes as (
    select distinct va.vinted_user_id::text uid, va.login
      from public.vinted_accounts va where va.owner = p_owner and va.vinted_user_id is not null),
  caches as (
    select coalesce((select d.data -> 'vinted_accounts_hidden' from public.app_data d where d.owner = p_owner and d.id = 'main'), '[]'::jsonb) h),
  l as (
    select c.uid, c.login, sauvegarde.vrm_ms(to_jsonb(a.meta ->> 'capturedAt')) ms,
           (jsonb_typeof(caches.h) = 'array' and caches.h ? c.uid) exclu
      from comptes c cross join caches
      left join public.app_data a on a.owner = p_owner and a.id = 'harvest_' || c.uid || '_listings')
  select jsonb_build_object(
    'comptes', coalesce((select jsonb_agg(jsonb_build_object('uid', uid, 'login', login, 'capte', sauvegarde.vrm_iso(ms), 'exclu', exclu,
                                                             'avantCoupure', ms is null or ms < extract(epoch from p_coupure) * 1000) order by uid) from l), '[]'::jsonb),
    'avantCoupure', coalesce((select jsonb_agg(coalesce(login, uid) || ' (' || coalesce(sauvegarde.vrm_iso(ms), 'jamais capté') || ')' order by uid)
                                from l where not exclu and (ms is null or ms < extract(epoch from p_coupure) * 1000)), '[]'::jsonb))
$$;

-- La MESURE : ce que la session lit juste avant d'appliquer, et passe telle quelle
-- à l'appel. Si la base ne porte plus exactement ça à l'instant de la conversion
-- (une paire numérotée, une annonce recaptée…), rien n'est fait. (`dressings` est
-- une information pour celui qui applique : jamais comparée.)
create or replace function sauvegarde.vrm_numerotation_mesurer(p_owner uuid, p_prefixe text, p_coupure timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select sauvegarde.vrm_numerotation_bilan(p_owner, p_prefixe)
         || jsonb_build_object('plan', sauvegarde.vrm_numerotation_plan(p_owner, p_coupure),
                               'dressings', sauvegarde.vrm_numerotation_dressings(p_owner, p_coupure))
$$;

-- Combien de valeurs « autre » (forme inconnue), tous endroits confondus.
create or replace function sauvegarde.vrm_mesure_somme(m jsonb, champ text)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((v ->> champ)::int), 0)::int
    from jsonb_each(m) x(k, v) where jsonb_typeof(v) = 'object' and v ? champ and jsonb_typeof(v -> champ) = 'number'
$$;

-- ── 4. LA CONVERSION ──────────────────────────────────────────────────────────
-- `p_coupure` : la date T (mise en ligne avant T = ancienne). `attendu` : la mesure
-- prise juste avant (vrm_numerotation_mesurer), OBLIGATOIRE.
create or replace function sauvegarde.vrm_numerotation_archiver(p_owner uuid, p_prefixe text, p_coupure timestamptz, attendu jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d jsonb;
  nd jsonb;
  v_passage timestamptz := now();
  avant jsonb;
  apres jsonb;
  plan jsonb;
  carte jsonb;
  partx jsonb;
  parfiche jsonb;
  n_neuves int;
  fait record;
  v_ancienne int;
  v_nouvelle int;
  lbc_ids jsonb;
  ebay_ids jsonb;
  pool_cles text[];
  pool_neuf jsonb;
  en record;
  k text;
  n_suivis int;
  n_convertis int;
  n_deplaces int;
  emails_apres jsonb;
  bad int;
begin
  if p_owner is null then raise exception 'vrm_numerotation : propriétaire inconnu — rien n''est fait'; end if;
  if p_prefixe is null or p_prefixe !~ '^[A-Z]{1,3}$' then raise exception 'vrm_numerotation : préfixe invalide (%) — rien n''est fait', p_prefixe; end if;
  if p_coupure is null or p_coupure > now() then raise exception 'vrm_numerotation : coupure invalide (%) — rien n''est fait', p_coupure; end if;

  -- Verrou : aucune autre écriture de `main` ne passe pendant la conversion.
  select data into d from public.app_data where owner = p_owner and id = 'main' for update;
  if d is null then raise exception 'vrm_numerotation : pas de ligne main pour ce propriétaire — rien n''est fait'; end if;

  -- IDEMPOTENCE, sur le REGISTRE (jamais sur la seule présence du marqueur).
  select * into fait from sauvegarde.numerotation_faite where owner = p_owner and annule_le is null order by version desc limit 1;
  if found then
    if (d -> 'vrm_numerotation' ->> 'version') = fait.version::text and coalesce(d -> 'vrm_numerotation' ->> 'archive', '') = fait.archive then
      return jsonb_build_object('deja', true, 'marqueur', d -> 'vrm_numerotation');
    end if;
    raise exception 'vrm_numerotation : le registre dit « fait » (version %, passage %) mais la ligne main ne porte plus ce marqueur — elle a été remise à la main ? Rien n''est fait : regarder avant de relancer.', fait.version, fait.passage;
  end if;
  if d ? 'vrm_numerotation' and coalesce(d -> 'vrm_numerotation' ->> 'archive', '') <> ''
     and not coalesce((d -> 'vrm_numerotation' ->> 'annule')::boolean, false) then
    raise exception 'vrm_numerotation : la ligne main porte un marqueur actif sans trace dans le registre — rien n''est fait';
  end if;
  if attendu is null then
    raise exception 'vrm_numerotation : la mesure « attendu » est obligatoire (sauvegarde.vrm_numerotation_mesurer) — rien n''est fait';
  end if;

  avant := sauvegarde.vrm_numerotation_mesurer(p_owner, p_prefixe, p_coupure);
  -- La mesure de la session tient-elle encore ? (rien de numéroté, rien de recapté entre-temps)
  for k in select jsonb_object_keys(avant) union select jsonb_object_keys(attendu) loop
    if k = 'dressings' then continue; end if;   -- une information, pas une mesure
    if (avant -> k) is distinct from (attendu -> k) then
      raise exception 'vrm_numerotation : la base a changé depuis la mesure (% : attendu %, trouvé %) — rien n''est fait',
        k, left(coalesce((attendu -> k)::text, 'absent'), 300), left(coalesce((avant -> k)::text, 'absent'), 300);
    end if;
  end loop;
  if sauvegarde.vrm_mesure_somme(avant, 'autre') > 0 then
    raise exception 'vrm_numerotation : % valeur(s) de forme inconnue (ni un numéro en chiffres, ni à lettres) — rien n''est fait, on ne devine pas', sauvegarde.vrm_mesure_somme(avant, 'autre');
  end if;
  if sauvegarde.vrm_mesure_somme(avant, 'archive') > 0 then
    raise exception 'vrm_numerotation : des numéros « %… » existent déjà — les anciens numéros s''y mélangeraient, rien n''est fait', p_prefixe;
  end if;

  plan := avant -> 'plan';
  carte := coalesce(plan -> 'carte', '{}'::jsonb);
  partx := coalesce(plan -> 'parTx', '{}'::jsonb);
  select coalesce(jsonb_object_agg(x ->> 'id', x -> 'apres'), '{}'::jsonb), count(*) into parfiche, n_neuves
    from jsonb_array_elements(coalesce(plan -> 'nouvelles', '[]'::jsonb)) x;
  v_ancienne := coalesce(nullif(d -> 'vrm_numerotation' ->> 'version', '')::int, 1);
  v_nouvelle := v_ancienne + 1;

  select array_agg(distinct public.vrm_cle_num(x)) into pool_cles
    from jsonb_array_elements(case when jsonb_typeof(d -> 'vinted_used_numeros') = 'array' then d -> 'vinted_used_numeros' else '[]' end) x;

  -- Les annonces Leboncoin / eBay qui portaient un numéro À LA COUPURE, par leur
  -- IDENTIFIANT (jamais par leur titre), avec, pour CHAQUE numéro qu'elles
  -- portaient, ce qu'il devient : { "<id d'annonce>": { "553": "1", "12": "B12" } }.
  --   • un numéro donné APRÈS la coupure à une annonce republiée (la carte :
  --     « VRM-553 » d'une annonce eBay publiée le 10 octobre, mesuré chez lui)
  --     suit SA paire (553 → 1) — avant, toute annonce « VRM-n » était lue
  --     « B553 », une paire qui n'existe pas, et l'anti double vente eBay perdait
  --     ses deux vraies annonces ;
  --   • un numéro donné à PLUSIEURS paires nouvelles : '' (on ne devine pas) ;
  --   • tout autre numéro est un ANCIEN numéro : « B… ».
  -- Les lecteurs ne traduisent que si l'annonce porte ENCORE ce numéro : une
  -- annonce reliée APRÈS la coupure à une nouvelle paire (son SKU réécrit) se lit
  -- telle quelle. C'est pourquoi le numéro d'avant est gardé, pas seulement l'id.
  -- Leboncoin : la référence (`ref`, chiffres ou « VRM-n »), la référence
  -- personnalisée (`customRef`), le « VRM-n » ou le « nXXX » du titre — les
  -- mêmes sources que `clesAnnonceLbc` (app) et `adRefKeys` (extension) — et le
  -- lien posé à la main (`vrm_lbc_liens`).
  select coalesce(jsonb_object_agg(aid, tr), '{}'::jsonb) into lbc_ids from (
    select aid, jsonb_object_agg(c, sauvegarde.vrm_traduire(c, p_prefixe, carte)) tr from (
      select distinct z.aid, z.c from (
        select e2.k2 aid, public.vrm_cle_num(to_jsonb(x.c)) c
          from public.app_data a, jsonb_each(case when jsonb_typeof(a.data -> 'items') = 'object' then a.data -> 'items' else '{}' end) e2(k2, v),
               lateral (
                 select v ->> 'ref' c where sauvegarde.vrm_num_genre(v -> 'ref') = 'nu'
                 union all select (regexp_match(coalesce(v ->> 'ref', ''), 'VRM[-\s]?([0-9]{1,6})(?![0-9])', 'i'))[1]
                 union all select coalesce((regexp_match(coalesce(v ->> 'customRef', ''), 'VRM[-\s]?((?:[A-Z]{1,3})?[0-9]{1,6})(?![0-9])', 'i'))[1],
                                           (regexp_match(coalesce(v ->> 'customRef', ''), '([0-9]{1,5})'))[1])
                 union all select (regexp_match(coalesce(v ->> 'subject', ''), 'VRM[-\s]?([0-9]{1,6})(?![0-9])', 'i'))[1]
                 union all select (regexp_match(coalesce(v ->> 'subject', ''), '\mn\s*°?\s*([0-9]{1,5})\M', 'i'))[1]) x
         where a.owner = p_owner and a.id = 'lbc_listings'
        union all
        select k2, public.vrm_cle_num(v) from jsonb_each(case when jsonb_typeof(d -> 'vrm_lbc_liens') = 'object' then d -> 'vrm_lbc_liens' else '{}' end) e2(k2, v)
         where sauvegarde.vrm_num_genre(v) = 'nu') z
       where z.c ~ '^[0-9]+$') y
    group by aid) w;
  -- eBay : les annonces EN LIGNE (`ebay_listings`) et les PROGRAMMÉES
  -- (`ebay_programmees` : à venir, et déjà parties) qui portaient « VRM-n ».
  select coalesce(jsonb_object_agg(iid, tr), '{}'::jsonb) into ebay_ids from (
    select iid, jsonb_object_agg(c, sauvegarde.vrm_traduire(c, p_prefixe, carte)) tr from (
      select distinct v ->> 'itemId' iid, public.vrm_cle_num(to_jsonb((regexp_match(v ->> 'sku', '^\s*VRM[-\s]?([0-9]{1,6})\s*$', 'i'))[1])) c
        from public.app_data a,
             jsonb_array_elements(case when jsonb_typeof(a.data -> 'items') = 'array' then a.data -> 'items' else '[]' end
                                  || case when jsonb_typeof(a.data -> 'enLigne') = 'array' then a.data -> 'enLigne' else '[]' end) v
       where a.owner = p_owner and a.id in ('ebay_listings', 'ebay_programmees')
         and jsonb_typeof(v) = 'object' and coalesce(v ->> 'itemId', '') <> ''
         and coalesce(v ->> 'sku', '') ~* '^\s*VRM[-\s]?0*[0-9]{1,6}\s*$') y
    group by iid) w;

  -- SAUVEGARDE : `main`, le garage, « Mon local », les brouillons eBay en entier ;
  -- pour les emails, le numéro seul (les PDF ne bougent pas).
  insert into sauvegarde.numerotation_013 (owner, id, passage, data)
  select owner, id, v_passage, data from public.app_data
   where owner = p_owner and id in ('main', 'vrm_room', 'vrm_local', 'ebay_brouillons');
  insert into sauvegarde.numerotation_013 (owner, id, passage, data)
  select a.owner, a.id, v_passage, jsonb_build_object('numero', a.data -> 'numero', 'aNumeroTitre', a.data ? 'numeroTitre', 'numeroTitre', a.data -> 'numeroTitre')
    from public.app_data a
   where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_' and sauvegarde.vrm_num_genre(a.data -> 'numero') in ('nu', 'lot');

  -- CONVERSION de `main`.
  nd := d;
  -- Le pool : les anciens numéros deviennent « B… » ; ceux donnés après la
  -- coupure (la carte) en SORTENT ; les nouvelles paires 1…N y entrent (en
  -- entiers, comme `entreePool` les range).
  select coalesce(jsonb_agg(x order by o), '[]'::jsonb) into pool_neuf from (
    select distinct on (public.vrm_cle_num(x)) x, o from (
      select case when sauvegarde.vrm_num_genre(e) = 'nu' then to_jsonb(p_prefixe || public.vrm_cle_num(e)) else e end x, o
        from jsonb_array_elements(case when jsonb_typeof(d -> 'vinted_used_numeros') = 'array' then d -> 'vinted_used_numeros' else '[]' end) with ordinality t(e, o)
       where not (sauvegarde.vrm_num_genre(e) = 'nu' and carte ? public.vrm_cle_num(e))
      union all
      select to_jsonb(g), 1000000 + g from generate_series(1, n_neuves) g) y
     order by public.vrm_cle_num(x), o) z;
  if d ? 'vinted_used_numeros' or n_neuves > 0 then nd := jsonb_set(nd, '{vinted_used_numeros}', pool_neuf); end if;
  for en in select * from sauvegarde.vrm_endroits_main() where quoi <> 'liste' loop
    if d ? en.cle then
      nd := jsonb_set(nd, array[en.cle], sauvegarde.vrm_conv(d -> en.cle, en.quoi, p_prefixe, carte,
              case en.cle when 'vinted_annonce_numeros' then parfiche
                         when 'vinted_sale_overrides' then partx
                         when 'vinted_bord_links' then partx
                         else '{}'::jsonb end));
    end if;
  end loop;
  -- Les nouvelles paires : en CHIFFRES (1, 2, 3…), explicitement, sur tous ses appareils.
  nd := jsonb_set(nd, '{vrm_num_prefixe}', '""'::jsonb);
  nd := jsonb_set(nd, '{vrm_numerotation}', jsonb_build_object(
    'version', v_nouvelle, 'coupure', plan ->> 'coupure', 'appliqueLe', sauvegarde.vrm_iso(extract(epoch from v_passage) * 1000),
    'archive', p_prefixe, 'nouvelles', n_neuves,
    'renum', (select coalesce(jsonb_object_agg(k2, v), '{}'::jsonb) from jsonb_each(carte) x(k2, v) where jsonb_typeof(v) = 'string'),
    'lbcAnnonces', lbc_ids, 'ebayAnnonces', ebay_ids));
  update public.app_data set data = nd, updated_at = v_passage where owner = p_owner and id = 'main';

  -- Le garage 3D : converti, et ESTAMPILLÉ de la version (son garde-fou exige
  -- qu'une écriture venue d'un navigateur porte la version courante).
  update public.app_data set data = jsonb_set(sauvegarde.vrm_garage_conv(data, p_prefixe, carte), '{numerotation}', to_jsonb(v_nouvelle))
   where owner = p_owner and id = 'vrm_room' and jsonb_typeof(data) = 'object';
  update public.app_data set data = sauvegarde.vrm_conv(data, 'pins', p_prefixe, carte)
   where owner = p_owner and id = 'vrm_local' and jsonb_typeof(data) = 'object';
  update public.app_data set data = jsonb_set(data, '{items}', sauvegarde.vrm_conv(data -> 'items', 'champ', p_prefixe, carte))
   where owner = p_owner and id = 'ebay_brouillons' and jsonb_typeof(data -> 'items') = 'object';

  -- Les emails : le N° rangé à l'arrivée (jamais re-capté). `updated_at` n'est
  -- PAS touché ; `meta` suit par le déclencheur `vrm_meta_maj` ; le PDF ne bouge pas.
  --  1. rattaché par sa TRANSACTION à une fiche nouvelle → son nouveau numéro ;
  --  2. un numéro de l'ancien POOL (ou donné après la coupure) → « B… » (ou suit
  --     la fiche nouvelle à qui il a été donné) ;
  --  3. un nombre qui n'y est PAS (« 99001 », « 2079 » : lus dans un TITRE, jamais
  --     donnés par l'app) ne devient pas un faux « B99001 » : il passe dans
  --     `numeroTitre` et `numero` se vide. Mieux vaut un blanc qu'un faux.
  with cls as (
    select a.id, case
             when partx ? coalesce(a.data ->> 'transaction', '') then 'suivi'
             when not exists (select 1 from sauvegarde.vrm_num_elements(a.data -> 'numero') el
                               where not (el::text = any (coalesce(pool_cles, '{}'::text[])) or carte ? el::text)) then 'converti'
             else 'deplace' end sorte
      from public.app_data a
     where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_' and sauvegarde.vrm_num_genre(a.data -> 'numero') in ('nu', 'lot')),
  upd as (
    update public.app_data a set data = case cls.sorte
             when 'suivi' then jsonb_set(a.data, '{numero}', partx -> (a.data ->> 'transaction'))
             when 'converti' then jsonb_set(a.data, '{numero}', sauvegarde.vrm_val(a.data -> 'numero', p_prefixe, carte))
             else jsonb_set(jsonb_set(a.data, '{numeroTitre}', a.data -> 'numero'), '{numero}', '""'::jsonb) end
      from cls where a.owner = p_owner and a.id = cls.id
    returning cls.sorte)
  select count(*) filter (where sorte = 'suivi'), count(*) filter (where sorte = 'converti'), count(*) filter (where sorte = 'deplace')
    into n_suivis, n_convertis, n_deplaces from upd;

  -- RECOMPTE. Chaque ancien numéro est devenu UN « B… », chaque fiche nouvelle
  -- porte un numéro de 1 à N, et aucun numéro en chiffres ne sort de 1…N.
  -- Le bilan SANS le plan : le plan est celui d'avant (`avant`), calculé une fois.
  apres := sauvegarde.vrm_numerotation_bilan(p_owner, p_prefixe);
  if sauvegarde.vrm_mesure_somme(apres, 'autre') <> 0 then
    raise exception 'vrm_numerotation : une valeur de forme inconnue après conversion — tout est annulé (%)', apres;
  end if;
  if coalesce(sauvegarde.vrm_mesure_somme(apres, 'neufMax'), 0) > 0 then
    for en in select x.k, x.v from jsonb_each(apres) x(k, v) where jsonb_typeof(x.v) = 'object' and coalesce((x.v ->> 'neufMax')::int, 0) > n_neuves loop
      raise exception 'vrm_numerotation : % porte un numéro en chiffres hors des nouvelles paires 1…% — tout est annulé (%)', en.k, n_neuves, en.v;
    end loop;
  end if;
  for en in select * from sauvegarde.vrm_endroits_main() where quoi <> 'liste' loop
    if (apres -> en.cle ->> 'entrees') is distinct from (avant -> en.cle ->> 'entrees')
       or (apres -> en.cle ->> 'total') is distinct from (avant -> en.cle ->> 'total')
       or (en.quoi <> 'champ' and (apres -> en.cle ->> 'lettres') is distinct from (avant -> en.cle ->> 'lettres')) then
      raise exception 'vrm_numerotation : % ne tombe pas juste (avant %, après %) — tout est annulé', en.cle, avant -> en.cle, apres -> en.cle;
    end if;
  end loop;
  if (apres -> 'vinted_annonce_numeros' ->> 'nu')::int <> n_neuves then
    raise exception 'vrm_numerotation : % fiche(s) nouvelle(s) attendue(s) en chiffres, % trouvée(s) — tout est annulé', n_neuves, apres -> 'vinted_annonce_numeros' ->> 'nu';
  end if;
  select count(*) into bad from generate_series(1, n_neuves) g
   where not exists (select 1 from jsonb_array_elements(nd -> 'vinted_used_numeros') x where public.vrm_cle_num(x) = g::text);
  if bad > 0 then raise exception 'vrm_numerotation : % nouveau(x) numéro(s) absent(s) du pool — tout est annulé', bad; end if;
  if (apres -> 'vinted_used_numeros' ->> 'archive')::int
     <> (select count(*) from unnest(coalesce(pool_cles, '{}'::text[])) c where c ~ '^[0-9]+$' and not carte ? c) then
    raise exception 'vrm_numerotation : le pool ne tombe pas juste (avant %, après %) — tout est annulé', avant -> 'vinted_used_numeros', apres -> 'vinted_used_numeros';
  end if;
  if coalesce((apres -> 'garage3d' ->> 'total')::int, 0) <> coalesce((avant -> 'garage3d' ->> 'total')::int, 0) then
    raise exception 'vrm_numerotation : le garage ne tombe pas juste (avant %, après %) — tout est annulé', avant -> 'garage3d', apres -> 'garage3d';
  end if;
  if (apres -> 'emails' ->> 'lignes') is distinct from (avant -> 'emails' ->> 'lignes')
     or n_suivis + n_convertis + n_deplaces <> (avant -> 'emails' ->> 'nus')::int then
    raise exception 'vrm_numerotation : les emails ne tombent pas juste (avant %, suivis %, convertis %, déplacés %) — tout est annulé',
      avant -> 'emails', n_suivis, n_convertis, n_deplaces;
  end if;

  select coalesce(jsonb_object_agg(a.id, a.data -> 'numero'), '{}'::jsonb) into emails_apres
    from public.app_data a where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_' and sauvegarde.vrm_num_genre(a.data -> 'numero') <> 'vide';

  insert into sauvegarde.numerotation_faite (owner, version, passage, coupure, archive, rapport)
  values (p_owner, v_nouvelle, v_passage, p_coupure, p_prefixe, jsonb_build_object(
    'avant', avant, 'apres', apres - 'plan', 'finLe', sauvegarde.vrm_iso(extract(epoch from clock_timestamp()) * 1000),
    'projApres', sauvegarde.vrm_projection(nd),
    'garageApres', (select sauvegarde.vrm_proj_liste(data, 'garage') from public.app_data where owner = p_owner and id = 'vrm_room'),
    'pinsApres', (select sauvegarde.vrm_proj_liste(data, 'pins') from public.app_data where owner = p_owner and id = 'vrm_local'),
    'brouillonsApres', (select sauvegarde.vrm_proj_liste(data -> 'items', 'champ') from public.app_data where owner = p_owner and id = 'ebay_brouillons'),
    'emailsApres', emails_apres));

  return jsonb_build_object('deja', false, 'version', v_nouvelle, 'coupure', plan ->> 'coupure',
                            'appliqueLe', sauvegarde.vrm_iso(extract(epoch from v_passage) * 1000),
                            'nouvelles', plan -> 'nouvelles', 'sources', plan -> 'sources', 'sourcesNouvelles', plan -> 'sourcesNouvelles',
                            'contradictions', plan -> 'contradictions', 'numerosSortisDuPool', (select coalesce(jsonb_agg(k2 order by k2::int), '[]') from jsonb_object_keys(carte) k2),
                            'emailsSuivis', n_suivis, 'emailsConvertis', n_convertis, 'emailsDeplacesEnTitre', n_deplaces,
                            'lbcAnnonces', (select count(*) from jsonb_object_keys(lbc_ids)), 'ebayAnnonces', (select count(*) from jsonb_object_keys(ebay_ids)),
                            'apres', apres - 'plan');
end
$$;

-- ── 5. LE RATTRAPAGE DES EMAILS RANGÉS PENDANT LA CONVERSION ─────────────────
-- Un email de bordereau traité PENDANT la conversion a pu lire l'ancienne ligne
-- `main` et ranger un numéro nu juste après. On convertit, une fois, seulement
-- les emails apparus APRÈS la conversion (absents de son relevé), reçus au plus
-- `p_secondes` après sa fin, et dont le numéro appartient à l'ancien pool. Au-delà
-- de la fenêtre, un numéro en chiffres est celui d'une NOUVELLE paire : on n'y
-- touche jamais. Rend la liste, pour qu'on la regarde.
create or replace function sauvegarde.vrm_numerotation_rattraper(p_owner uuid, p_secondes int default 60)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fait record;
  ancien jsonb;
  pool_cles text[];
  carte jsonb;
  partx jsonb;
  fin timestamptz;
  ids jsonb;
  dm jsonb;
  n int;
begin
  select * into fait from sauvegarde.numerotation_faite where owner = p_owner and annule_le is null order by version desc limit 1;
  if not found then raise exception 'vrm_numerotation : rien à rattraper (aucune conversion active)'; end if;
  if p_secondes is null or p_secondes < 0 or p_secondes > 600 then raise exception 'vrm_numerotation : fenêtre invalide (% s)', p_secondes; end if;
  select data into ancien from sauvegarde.numerotation_013 where owner = p_owner and id = 'main' and passage = fait.passage;
  select array_agg(distinct public.vrm_cle_num(x)) into pool_cles
    from jsonb_array_elements(case when jsonb_typeof(ancien -> 'vinted_used_numeros') = 'array' then ancien -> 'vinted_used_numeros' else '[]' end) x;
  carte := coalesce(fait.rapport -> 'avant' -> 'plan' -> 'carte', '{}'::jsonb);
  partx := coalesce(fait.rapport -> 'avant' -> 'plan' -> 'parTx', '{}'::jsonb);
  fin := (fait.rapport ->> 'finLe')::timestamptz;
  select data into dm from public.app_data where owner = p_owner and id = 'main';
  select coalesce(jsonb_agg(a.id), '[]'::jsonb) into ids
    from public.app_data a
   where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_'
     and not (coalesce(fait.rapport -> 'emailsApres', '{}'::jsonb) ? a.id)
     and not exists (select 1 from sauvegarde.numerotation_013 s where s.owner = p_owner and s.passage = fait.passage and s.id = a.id)
     and sauvegarde.vrm_num_genre(a.data -> 'numero') in ('nu', 'lot')
     and sauvegarde.vrm_ms(a.data -> 'receivedAt') is not null
     and sauvegarde.vrm_ms(a.data -> 'receivedAt') <= extract(epoch from fin) * 1000 + p_secondes * 1000
     and (partx ? coalesce(a.data ->> 'transaction', '')
          or (not exists (select 1 from sauvegarde.vrm_num_elements(a.data -> 'numero') el
                           where not (el::text = any (coalesce(pool_cles, '{}'::text[])) or carte ? el::text))
              -- ⚠️ Le pool d'AVANT contient aussi 1…N : un « 5 » rangé dans la
              -- fenêtre peut être celui de la NOUVELLE paire 5 (l'email a lu la
              -- ligne convertie). Prouvé le 11 octobre : il devenait « B5 ». Un
              -- numéro que porte une fiche ACTUELLE au MÊME titre que l'email est
              -- de la nouvelle série (la règle `numeroDuTitreApresCoupure` du
              -- serveur, §11) : on n'y touche pas.
              and not (sauvegarde.vrm_num_genre(a.data -> 'numero') = 'nu'
                       and exists (select 1 from jsonb_each(case when jsonb_typeof(dm -> 'vinted_annonce_numeros') = 'object' then dm -> 'vinted_annonce_numeros' else '{}' end) f(fk, fv)
                                    where jsonb_typeof(fv) = 'object'
                                      and public.vrm_cle_num(fv -> 'numero') = public.vrm_cle_num(a.data -> 'numero')
                                      and sauvegarde.vrm_norm_titre(fv ->> 'title') <> ''
                                      and sauvegarde.vrm_norm_titre(fv ->> 'title') = sauvegarde.vrm_norm_titre(coalesce(a.data ->> 'article', a.data ->> 'designation', a.data ->> 'modele'))))));
  insert into sauvegarde.numerotation_013 (owner, id, passage, data)
  select a.owner, a.id, fait.passage, jsonb_build_object('numero', a.data -> 'numero', 'aNumeroTitre', a.data ? 'numeroTitre', 'numeroTitre', a.data -> 'numeroTitre', 'rattrape', true)
    from public.app_data a where a.owner = p_owner and a.id in (select jsonb_array_elements_text(ids))
  on conflict (owner, id, passage) do nothing;
  update public.app_data a set data = jsonb_set(a.data, '{numero}',
           case when partx ? coalesce(a.data ->> 'transaction', '') then partx -> (a.data ->> 'transaction')
                else sauvegarde.vrm_val(a.data -> 'numero', fait.archive, carte) end)
   where a.owner = p_owner and a.id in (select jsonb_array_elements_text(ids));
  get diagnostics n = row_count;
  update sauvegarde.numerotation_faite set rapport = jsonb_set(rapport, '{emailsApres}',
           coalesce(rapport -> 'emailsApres', '{}'::jsonb) || coalesce((select jsonb_object_agg(a.id, a.data -> 'numero') from public.app_data a
                                                                         where a.owner = p_owner and a.id in (select jsonb_array_elements_text(ids))), '{}'::jsonb))
   where owner = p_owner and version = fait.version;
  return jsonb_build_object('rattrapes', n, 'ids', ids, 'fenetreSecondes', p_secondes);
end
$$;

-- ── 6. LE RETOUR ARRIÈRE, CIBLÉ ───────────────────────────────────────────────
-- Il ne touche QU'AUX numéros (pool, fiches, ventes, clés et liens, préfixe,
-- garage, « Mon local », brouillons eBay, emails) et garde tout le reste tel qu'il
-- est AUJOURD'HUI : colis cochés, offres traitées, déclarations, prix d'achat,
-- réglages. Il REFUSE dès qu'un numéro a bougé depuis la conversion (une nouvelle
-- paire numérotée, un prix d'achat saisi sous un N°, un carton changé…) : ce
-- numéro est peut-être déjà écrit sur un carton. Il pose un marqueur `annule`
-- d'une version plus haute : un appareil chargé avant le voit et se recharge.
create or replace function sauvegarde.vrm_numerotation_annuler(p_owner uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fait record;
  d jsonb;
  nd jsonb;
  copie jsonb;
  copie_room jsonb;
  copie_local jsonb;
  copie_br jsonb;
  pr text;
  carte jsonb;
  partx jsonb;
  inv jsonb;
  bouge text := '';
  emails_maint jsonb;
  v_nouvelle int;
  en record;
  k text;
begin
  select data into d from public.app_data where owner = p_owner and id = 'main' for update;
  if d is null then raise exception 'vrm_numerotation : pas de ligne main'; end if;
  select * into fait from sauvegarde.numerotation_faite where owner = p_owner and annule_le is null order by version desc limit 1;
  if not found then raise exception 'vrm_numerotation : rien à annuler (aucune conversion active) — rien n''est fait'; end if;
  pr := fait.archive;
  carte := coalesce(fait.rapport -> 'avant' -> 'plan' -> 'carte', '{}'::jsonb);
  select data into copie from sauvegarde.numerotation_013 where owner = p_owner and id = 'main' and passage = fait.passage;
  if copie is null then raise exception 'vrm_numerotation : la copie du passage % est introuvable — rien n''est fait', fait.passage; end if;
  select data into copie_room from sauvegarde.numerotation_013 where owner = p_owner and id = 'vrm_room' and passage = fait.passage;
  select data into copie_local from sauvegarde.numerotation_013 where owner = p_owner and id = 'vrm_local' and passage = fait.passage;
  select data into copie_br from sauvegarde.numerotation_013 where owner = p_owner and id = 'ebay_brouillons' and passage = fait.passage;

  -- Un numéro a-t-il bougé depuis la conversion ? Alors on ne revient pas.
  for k in select jsonb_object_keys(fait.rapport -> 'projApres') loop
    if (sauvegarde.vrm_projection(d) -> k) is distinct from (fait.rapport -> 'projApres' -> k) then bouge := bouge || k || ' '; end if;
  end loop;
  -- ⚠️ Une ligne ABSENTE (aucun garage, aucun brouillon eBay — mesuré chez lui :
  -- pas de `ebay_brouillons`) vaut une ligne sans numéro : la sous-requête rend
  -- un NULL SQL, la conversion avait rangé un `null` JSON, et `is distinct from`
  -- les disait différents — le retour arrière était REFUSÉ sans qu'aucun numéro
  -- ait bougé. `vrm_proj_aucun` ramène les trois formes du vide à une seule.
  if sauvegarde.vrm_proj_aucun((select sauvegarde.vrm_proj_liste(data, 'garage') from public.app_data where owner = p_owner and id = 'vrm_room'))
     is distinct from sauvegarde.vrm_proj_aucun(fait.rapport -> 'garageApres') then bouge := bouge || 'vrm_room '; end if;
  if sauvegarde.vrm_proj_aucun((select sauvegarde.vrm_proj_liste(data, 'pins') from public.app_data where owner = p_owner and id = 'vrm_local'))
     is distinct from sauvegarde.vrm_proj_aucun(fait.rapport -> 'pinsApres') then bouge := bouge || 'vrm_local '; end if;
  if sauvegarde.vrm_proj_aucun((select sauvegarde.vrm_proj_liste(data -> 'items', 'champ') from public.app_data where owner = p_owner and id = 'ebay_brouillons'))
     is distinct from sauvegarde.vrm_proj_aucun(fait.rapport -> 'brouillonsApres') then bouge := bouge || 'ebay_brouillons '; end if;
  select coalesce(jsonb_object_agg(a.id, a.data -> 'numero'), '{}'::jsonb) into emails_maint
    from public.app_data a where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_' and sauvegarde.vrm_num_genre(a.data -> 'numero') <> 'vide';
  if emails_maint is distinct from coalesce(fait.rapport -> 'emailsApres', '{}'::jsonb) then bouge := bouge || 'emails '; end if;
  if bouge <> '' then
    raise exception 'vrm_numerotation : retour arrière REFUSÉ — des numéros ont bougé depuis la conversion (%). Un numéro neuf est peut-être déjà écrit sur un carton : rien n''est fait.', btrim(bouge);
  end if;

  -- La correspondance inverse des CLÉS (prix d'achat par N°, paires retirées,
  -- pointage) : on applique la conversion aux clés d'avant, et on la retourne.
  select coalesce(jsonb_object_agg(coalesce(sauvegarde.vrm_val(to_jsonb(c), pr, carte) #>> '{}', c), to_jsonb(c)), '{}'::jsonb) into inv
    from (select jsonb_object_keys(case when jsonb_typeof(copie -> 'vinted_buyprice_by_num') = 'object' then copie -> 'vinted_buyprice_by_num' else '{}' end) c
          union select jsonb_object_keys(case when jsonb_typeof(copie -> 'vinted_pairs_lost') = 'object' then copie -> 'vinted_pairs_lost' else '{}' end)
          union select jsonb_object_keys(case when jsonb_typeof(copie -> 'vrm_inventaire_pointage' -> 'pointes') = 'object' then copie -> 'vrm_inventaire_pointage' -> 'pointes' else '{}' end)) z;

  v_nouvelle := coalesce(nullif(d -> 'vrm_numerotation' ->> 'version', '')::int, fait.version) + 1;
  nd := d;
  if copie ? 'vinted_used_numeros' then nd := jsonb_set(nd, '{vinted_used_numeros}', copie -> 'vinted_used_numeros'); end if;
  for en in select * from sauvegarde.vrm_endroits_main() where quoi = 'champ' loop
    if d ? en.cle and jsonb_typeof(d -> en.cle) = 'object' then
      nd := jsonb_set(nd, array[en.cle], (select coalesce(jsonb_object_agg(k2, case
              when jsonb_typeof(v) = 'object' and jsonb_typeof(copie -> en.cle -> k2) = 'object' and (copie -> en.cle -> k2) ? 'numero'
              then jsonb_set(v, '{numero}', copie -> en.cle -> k2 -> 'numero') else v end), '{}'::jsonb)
            from jsonb_each(d -> en.cle) x(k2, v)));
    end if;
  end loop;
  foreach k in array array['vinted_buyprice_by_num', 'vinted_pairs_lost'] loop
    if jsonb_typeof(d -> k) = 'object' then
      nd := jsonb_set(nd, array[k], (select coalesce(jsonb_object_agg(coalesce(inv ->> k2, k2), v), '{}'::jsonb) from jsonb_each(d -> k) x(k2, v)));
    end if;
  end loop;
  if jsonb_typeof(d -> 'vrm_inventaire_pointage' -> 'pointes') = 'object' then
    nd := jsonb_set(nd, '{vrm_inventaire_pointage,pointes}', (select coalesce(jsonb_object_agg(coalesce(inv ->> k2, k2), v), '{}'::jsonb)
                                                               from jsonb_each(d -> 'vrm_inventaire_pointage' -> 'pointes') x(k2, v)));
    nd := jsonb_set(nd, '{vrm_inventaire_pointage,debut}', coalesce(copie -> 'vrm_inventaire_pointage' -> 'debut', 'null'::jsonb));
  end if;
  if jsonb_typeof(d -> 'vrm_lbc_liens') = 'object' then
    nd := jsonb_set(nd, '{vrm_lbc_liens}', (select coalesce(jsonb_object_agg(k2, coalesce(copie -> 'vrm_lbc_liens' -> k2, v)), '{}'::jsonb) from jsonb_each(d -> 'vrm_lbc_liens') x(k2, v)));
  end if;
  if jsonb_typeof(d -> 'vinted_offvinted_buys') = 'array' then
    nd := jsonb_set(nd, '{vinted_offvinted_buys}', (select coalesce(jsonb_agg(case when jsonb_typeof(v) = 'object' and (select c from jsonb_array_elements(copie -> 'vinted_offvinted_buys') c where c ->> 'id' = v ->> 'id' limit 1) ? 'numero'
              then jsonb_set(v, '{numero}', (select c -> 'numero' from jsonb_array_elements(copie -> 'vinted_offvinted_buys') c where c ->> 'id' = v ->> 'id' limit 1)) else v end order by o), '[]'::jsonb)
            from jsonb_array_elements(d -> 'vinted_offvinted_buys') with ordinality t(v, o)));
  end if;
  if copie ? 'vinted_garage_grid' then nd := jsonb_set(nd, '{vinted_garage_grid}', copie -> 'vinted_garage_grid'); end if;
  if copie ? 'vrm_num_prefixe' then nd := jsonb_set(nd, '{vrm_num_prefixe}', copie -> 'vrm_num_prefixe'); else nd := nd - 'vrm_num_prefixe'; end if;
  nd := jsonb_set(nd, '{vrm_numerotation}', jsonb_build_object('version', v_nouvelle, 'annule', true, 'archive', null,
          'coupure', d -> 'vrm_numerotation' -> 'coupure', 'annuleLe', sauvegarde.vrm_iso(extract(epoch from now()) * 1000)));
  update public.app_data set data = nd, updated_at = now() where owner = p_owner and id = 'main';

  -- Le garage : par meuble (son id), les numéros et `start` de la copie ; le
  -- reste (position, taille…) tel qu'il est aujourd'hui.
  if copie_room is not null then
    update public.app_data a set data = jsonb_set(jsonb_set(a.data, '{rooms}', (
        select coalesce(jsonb_agg(case when jsonb_typeof(r) = 'object' and jsonb_typeof(r -> 'items') = 'array' then jsonb_set(r, '{items}', (
                 select coalesce(jsonb_agg(case when jsonb_typeof(it) = 'object' and ci.c is not null then
                          (it - 'num' - 'nums' - 'slots' - 'start') || (select coalesce(jsonb_object_agg(kk, ci.c -> kk), '{}'::jsonb) from unnest(array['num', 'nums', 'slots', 'start']) kk where ci.c ? kk)
                          else it end order by io), '[]'::jsonb)
                   from jsonb_array_elements(r -> 'items') with ordinality ti(it, io)
                   left join lateral (select x c from jsonb_array_elements(case when jsonb_typeof(copie_room -> 'rooms') = 'array' then copie_room -> 'rooms' else '[]' end) rr,
                                                      jsonb_array_elements(case when jsonb_typeof(rr -> 'items') = 'array' then rr -> 'items' else '[]' end) x
                                       where x ->> 'id' = it ->> 'id' limit 1) ci on true))
               else r end order by ro), '[]'::jsonb)
          from jsonb_array_elements(a.data -> 'rooms') with ordinality tr(r, ro))), '{numerotation}', to_jsonb(v_nouvelle))
     where a.owner = p_owner and a.id = 'vrm_room' and jsonb_typeof(a.data -> 'rooms') = 'array';
  end if;
  if copie_local is not null then
    update public.app_data a set data = jsonb_set(a.data, '{photos}', (
        select coalesce(jsonb_agg(case when jsonb_typeof(ph) = 'object' and jsonb_typeof(ph -> 'pins') = 'array' then jsonb_set(ph, '{pins}', (
                 select coalesce(jsonb_agg(case when jsonb_typeof(p) = 'object' and cp.c ? 'numero' then jsonb_set(p, '{numero}', cp.c -> 'numero') else p end order by po), '[]'::jsonb)
                   from jsonb_array_elements(ph -> 'pins') with ordinality tp(p, po)
                   left join lateral (select y c from jsonb_array_elements(case when jsonb_typeof(copie_local -> 'photos') = 'array' then copie_local -> 'photos' else '[]' end) cph,
                                                      jsonb_array_elements(case when jsonb_typeof(cph -> 'pins') = 'array' then cph -> 'pins' else '[]' end) y
                                       where cph ->> 'id' = ph ->> 'id' and y ->> 'id' = p ->> 'id' limit 1) cp on true))
               else ph end order by pho), '[]'::jsonb)
          from jsonb_array_elements(a.data -> 'photos') with ordinality tph(ph, pho)))
     where a.owner = p_owner and a.id = 'vrm_local' and jsonb_typeof(a.data -> 'photos') = 'array';
  end if;
  if copie_br is not null then
    update public.app_data a set data = jsonb_set(a.data, '{items}', (select coalesce(jsonb_object_agg(k2, case
              when jsonb_typeof(v) = 'object' and jsonb_typeof(copie_br -> 'items' -> k2) = 'object' and (copie_br -> 'items' -> k2) ? 'numero'
              then jsonb_set(v, '{numero}', copie_br -> 'items' -> k2 -> 'numero') else v end), '{}'::jsonb)
            from jsonb_each(a.data -> 'items') x(k2, v)))
     where a.owner = p_owner and a.id = 'ebay_brouillons' and jsonb_typeof(a.data -> 'items') = 'object';
  end if;
  -- Les emails : leur numéro d'avant, exactement (le `numeroTitre` posé par la
  -- conversion repart ; celui qui existait avant revient).
  update public.app_data a set data = (jsonb_set(a.data, '{numero}', s.data -> 'numero') - 'numeroTitre')
                                       || case when coalesce((s.data ->> 'aNumeroTitre')::boolean, false)
                                               then jsonb_build_object('numeroTitre', s.data -> 'numeroTitre') else '{}'::jsonb end
    from sauvegarde.numerotation_013 s
   where s.owner = p_owner and s.passage = fait.passage and s.id ~ '^email_(bord|sale|final)_'
     and a.owner = s.owner and a.id = s.id;
  update sauvegarde.numerotation_faite set annule_le = now() where owner = p_owner and version = fait.version;
  return jsonb_build_object('annule', true, 'version', v_nouvelle, 'passage', fait.passage);
end
$$;

revoke all on function sauvegarde.vrm_numerotation_plan(uuid, timestamptz) from public;
revoke all on function sauvegarde.vrm_numerotation_mesurer(uuid, text, timestamptz) from public;
revoke all on function sauvegarde.vrm_numerotation_bilan(uuid, text) from public;
revoke all on function sauvegarde.vrm_numerotation_dressings(uuid, timestamptz) from public;
revoke all on function sauvegarde.vrm_numerotation_archiver(uuid, text, timestamptz, jsonb) from public;
revoke all on function sauvegarde.vrm_numerotation_rattraper(uuid, int) from public;
revoke all on function sauvegarde.vrm_numerotation_annuler(uuid) from public;

-- ── 7. LES GARDE-FOUS : CE QU'UN NAVIGATEUR NE PEUT PLUS ÉCRIRE ───────────────
-- `cloudPush` réécrit TOUTE la ligne `main` depuis le navigateur. Un appareil
-- resté ouvert avec l'ancienne numérotation remettrait les anciens numéros nus,
-- et deux appareils qui numérotent en même temps se volaient leurs fiches. Une
-- écriture venue d'un navigateur (rôles authenticated / anon) est REFUSÉE —
-- jamais « réparée » : on ne devine pas ce que l'appareil voulait écrire
-- d'autre. L'app reconnaît chaque refus et demande de recharger.
-- Le serveur (service_role) et l'éditeur SQL (postgres) ne sont pas concernés.
--
--   • Le MARQUEUR `vrm_numerotation` appartient au serveur : il est recopié
--     depuis la ligne d'avant, dans tous les cas, et un navigateur ne peut ni le
--     poser, ni le changer, ni le retirer.
--   • Le POOL ne rétrécit jamais (§5, append-only) : `vrm_pool_retreci`.
--   • Coupure active :
--       – une fiche ou une vente qui portait « B230 » ne repasse pas à « 230 »,
--         sauf saisie à la main datée d'après la conversion (`manuelAt`) ;
--       – une fiche republiée devenue « 1 » ne reprend pas son numéro
--         provisoire « 553 » (`renum` du marqueur) ;
--       – une clé « B385 » (prix d'achat par N°, paires retirées) ne redevient
--         pas « 385 », et un lien Leboncoin « B233 » ne redevient pas « 233 »
--         (`vrm_numeros_perimes`) ;
--       – une fiche NUMÉROTÉE ne disparaît pas, sauf reprise désignée par
--         `repriseDe` (l'appareil qui l'ignore a été chargé avant elle :
--         `vrm_fiche_perdue`) ;
--       – le préfixe des nouveaux numéros ne peut pas être celui de l'archive
--         (`vrm_prefixe_archive`).
create or replace function public.vrm_garde_numeros()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m jsonb;
  arch text;
  coup text;
  perdus int;
  n int;
  ex text;
  carte text;
begin
  if new.id <> 'main' or current_user not in ('authenticated', 'anon') then return new; end if;
  -- Le marqueur : celui de la base, toujours.
  if old.data ? 'vrm_numerotation' then
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('vrm_numerotation', old.data -> 'vrm_numerotation');
  elsif coalesce(new.data, '{}'::jsonb) ? 'vrm_numerotation' then
    new.data := new.data - 'vrm_numerotation';
  end if;
  -- Le pool ne rétrécit jamais.
  if jsonb_typeof(old.data -> 'vinted_used_numeros') = 'array' then
    select count(*), min(c) into perdus, ex from (
      select public.vrm_cle_num(e) c from jsonb_array_elements(old.data -> 'vinted_used_numeros') e
      except
      select public.vrm_cle_num(e) from jsonb_array_elements(case when jsonb_typeof(new.data -> 'vinted_used_numeros') = 'array'
                                                                  then new.data -> 'vinted_used_numeros' else '[]'::jsonb end) e) z
     where c is not null and c <> '';
    if perdus > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_pool_retreci',
        detail = perdus || ' numéro(s) disparaîtrai(en)t du pool (ex. ' || ex || ') — cet appareil a une version ancienne de tes numéros',
        hint = 'Recharge l''app : elle relira tes numéros.';
    end if;
  end if;
  m := old.data -> 'vrm_numerotation';
  if m is null or coalesce((m ->> 'annule')::boolean, false) or coalesce(m ->> 'archive', '') = '' then return new; end if;
  arch := m ->> 'archive';
  -- Une saisie à la main FAITE APRÈS la conversion (pas après la date de coupure :
  -- un appareil périmé a pu saisir entre les deux) est un geste, pas une reprise.
  coup := coalesce(m ->> 'appliqueLe', m ->> 'coupure', '');

  -- Une fiche ou une vente « B230 » qui repasse à « 230 » (sauf à la main, après la coupure).
  foreach carte in array array['vinted_annonce_numeros', 'vinted_sale_overrides'] loop
    select count(*), min(o.k) into n, ex
      from jsonb_each(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) o(k, ov)
      join jsonb_each(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) w(k2, nv) on w.k2 = o.k
     where jsonb_typeof(ov) = 'object' and jsonb_typeof(nv) = 'object'
       and public.vrm_cle_num(ov -> 'numero') ~ ('^' || arch || '[0-9]+(\+' || arch || '[0-9]+)*$')
       and public.vrm_cle_num(nv -> 'numero') ~ '^[0-9]+(\+[0-9]+)*$'
       and not (coalesce(nv ->> 'manuelAt', '') > coup and coalesce(nv ->> 'manuelAt', '') is distinct from coalesce(ov ->> 'manuelAt', ''));
    if n > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
        detail = n || ' ancien(s) numéro(s) « ' || arch || '… » repasserai(en)t en chiffres (' || carte || ', ex. ' || ex || ') — cet appareil a été chargé avant la remise à zéro',
        hint = 'Recharge l''app.';
    end if;
  end loop;
  -- Une fiche ou une vente devenue « 1 » qui repasserait à son numéro PROVISOIRE
  -- (« 553 », donné avant la conversion à une annonce republiée après la coupure) :
  -- `renum` du marqueur dit lequel était devenu quoi.
  if jsonb_typeof(m -> 'renum') = 'object' then
    foreach carte in array array['vinted_annonce_numeros', 'vinted_sale_overrides'] loop
      select count(*), min(o.k) into n, ex
        from jsonb_each(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) o(k, ov)
        join jsonb_each(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) w(k2, nv) on w.k2 = o.k
       where jsonb_typeof(ov) = 'object' and jsonb_typeof(nv) = 'object'
         and (m -> 'renum') ? coalesce(public.vrm_cle_num(nv -> 'numero'), '')
         and (m -> 'renum' ->> public.vrm_cle_num(nv -> 'numero')) = public.vrm_cle_num(ov -> 'numero');
      if n > 0 then
        raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
          detail = n || ' paire(s) republiée(s) reprendrai(en)t leur numéro provisoire (' || carte || ', ex. ' || ex || ') — cet appareil a été chargé avant la remise à zéro',
          hint = 'Recharge l''app.';
      end if;
    end loop;
    select count(*), min(k) into n, ex
      from jsonb_object_keys(case when jsonb_typeof(new.data -> 'vinted_buyprice_by_num') = 'object' then new.data -> 'vinted_buyprice_by_num' else '{}' end) k
     where (m -> 'renum') ? k
       and not (coalesce(old.data -> 'vinted_buyprice_by_num', '{}'::jsonb) ? k)
       and coalesce(old.data -> 'vinted_buyprice_by_num', '{}'::jsonb) ? (m -> 'renum' ->> k)
       and not (coalesce(new.data -> 'vinted_buyprice_by_num', '{}'::jsonb) ? (m -> 'renum' ->> k));
    if n > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
        detail = n || ' prix d''achat repasserai(en)t sous un numéro provisoire (ex. ' || ex || ')', hint = 'Recharge l''app.';
    end if;
  end if;
  -- Une clé « B385 » qui redevient « 385 ».
  foreach carte in array array['vinted_buyprice_by_num', 'vinted_pairs_lost'] loop
    select count(*), min(k) into n, ex
      from jsonb_object_keys(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) k
     where public.vrm_cle_num(to_jsonb(k)) ~ ('^' || arch || '[0-9]+$')
       and not (coalesce(new.data -> carte, '{}'::jsonb) ? k)
       and exists (select 1 from jsonb_object_keys(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) k2
                    where public.vrm_cle_num(to_jsonb(k2)) = substr(public.vrm_cle_num(to_jsonb(k)), length(arch) + 1));
    if n > 0 then
      raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
        detail = n || ' clé(s) « ' || arch || '… » repasserai(en)t en chiffres (' || carte || ', ex. ' || ex || ') — cet appareil a été chargé avant la remise à zéro',
        hint = 'Recharge l''app.';
    end if;
  end loop;
  select count(*), min(o.k) into n, ex
    from jsonb_each(case when jsonb_typeof(old.data -> 'vrm_lbc_liens') = 'object' then old.data -> 'vrm_lbc_liens' else '{}' end) o(k, ov)
    join jsonb_each(case when jsonb_typeof(new.data -> 'vrm_lbc_liens') = 'object' then new.data -> 'vrm_lbc_liens' else '{}' end) w(k2, nv) on w.k2 = o.k
   where public.vrm_cle_num(ov) ~ ('^' || arch || '[0-9]+$') and public.vrm_cle_num(nv) ~ '^[0-9]+$';
  if n > 0 then
    raise exception using errcode = 'P0001', message = 'vrm_numeros_perimes',
      detail = n || ' lien(s) Leboncoin repasserai(en)t en chiffres (ex. ' || ex || ')', hint = 'Recharge l''app.';
  end if;
  -- Une fiche numérotée qui disparaît : l'appareil ne la connaissait pas.
  select count(*), min(o.k) into n, ex
    from jsonb_each(case when jsonb_typeof(old.data -> 'vinted_annonce_numeros') = 'object' then old.data -> 'vinted_annonce_numeros' else '{}' end) o(k, ov)
   where jsonb_typeof(ov) = 'object' and coalesce(btrim(ov ->> 'numero'), '') <> ''
     and not (coalesce(new.data -> 'vinted_annonce_numeros', '{}'::jsonb) ? o.k)
     and not exists (select 1 from jsonb_each(case when jsonb_typeof(new.data -> 'vinted_annonce_numeros') = 'object' then new.data -> 'vinted_annonce_numeros' else '{}' end) w(k2, nv)
                      where jsonb_typeof(nv) = 'object' and nv ->> 'repriseDe' = o.k);
  if n > 0 then
    raise exception using errcode = 'P0001', message = 'vrm_fiche_perdue',
      detail = n || ' paire(s) numérotée(s) disparaîtrai(en)t (ex. annonce ' || ex || ') — un autre appareil les a numérotées depuis le chargement de celui-ci',
      hint = 'Recharge l''app : elle relira tes numéros.';
  end if;
  if upper(regexp_replace(coalesce(new.data ->> 'vrm_num_prefixe', ''), '[^A-Za-z]', '', 'g')) = arch then
    raise exception using errcode = 'P0001', message = 'vrm_prefixe_archive',
      detail = 'la série « ' || arch || ' » est celle de tes anciens numéros', hint = 'Choisis une autre lettre, ou des chiffres.';
  end if;
  return new;
end
$$;
revoke all on function public.vrm_garde_numeros() from public, anon, authenticated;
drop trigger if exists vrm_garde_numeros on public.app_data;
-- ⚠️ Le nom compte : les déclencheurs BEFORE d'une table passent dans l'ordre
-- ALPHABÉTIQUE — « vrm_garde… » avant « vrm_meta_maj », pour que `meta` soit
-- calculé sur la ligne finale.
create trigger vrm_garde_numeros before update of data on public.app_data
  for each row when (new.id = 'main') execute function public.vrm_garde_numeros();

-- Le garage 3D (`vrm_room`). Dès qu'une coupure a eu lieu, une écriture venue
-- d'un navigateur doit porter la VERSION de `main` (`numerotation`) : un écran
-- chargé avant la coupure, ou un code qui ne sait pas l'estampiller, ne peut
-- plus remettre les cartons en chiffres (`vrm_garage_perime`). Et même à la
-- bonne version, une copie locale d'avant ne repasse pas : deux cartons ou plus
-- qui redeviennent « 14 » au lieu de « B14 » d'un coup, c'est la signature d'une
-- copie périmée (un vrai changement de carton se fait un par un).
create or replace function public.vrm_garde_garage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m jsonb;
  arch text;
  n int;
begin
  if new.id <> 'vrm_room' or current_user not in ('authenticated', 'anon') then return new; end if;
  select a.data -> 'vrm_numerotation' into m from public.app_data a where a.owner = new.owner and a.id = 'main';
  if m is null then return new; end if;
  if coalesce(new.data ->> 'numerotation', '') is distinct from coalesce(m ->> 'version', '') then
    raise exception using errcode = 'P0001', message = 'vrm_garage_perime',
      detail = 'ce garage a été chargé avant la remise à zéro des numéros (version ' || coalesce(new.data ->> 'numerotation', 'aucune')
               || ', attendue ' || coalesce(m ->> 'version', '?') || ')',
      hint = 'Recharge l''app.';
  end if;
  arch := m ->> 'archive';
  if coalesce(arch, '') <> '' and not coalesce((m ->> 'annule')::boolean, false) then
    select count(*) into n from (
      select substr(c, length(arch) + 1) nu from (select distinct x c from public.vrm_nums_garage(old.data) x) a
       where c ~ ('^' || arch || '[0-9]+$')
         and c not in (select y from public.vrm_nums_garage(new.data) y)
         and substr(c, length(arch) + 1) in (select y from public.vrm_nums_garage(new.data) y)) z;
    if n >= 2 then
      raise exception using errcode = 'P0001', message = 'vrm_garage_perime',
        detail = n || ' cartons « ' || arch || '… » repasseraient en chiffres d''un coup — copie du garage d''avant la remise à zéro',
        hint = 'Recharge l''app.';
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.vrm_garde_garage() from public, anon, authenticated;
drop trigger if exists vrm_garde_garage on public.app_data;
create trigger vrm_garde_garage before update of data on public.app_data
  for each row when (new.id = 'vrm_room') execute function public.vrm_garde_garage();


commit;

-- ════════════════════════════════════════════════════════════════════════════
-- L'APPEL — une étape à part, jamais avec l'installation (voir CLAUDE.md,
-- « Anciens numéros en B » : mesure → essai annulé → application → contrôles).
-- Le propriétaire est lu dans `vrm_reglages` : aucun identifiant dans ce dépôt.
-- T = la coupure (date de mise en ligne) : 2026-10-09T00:00:00Z sauf décision
-- contraire, à revérifier au moment de passer la migration.
--
-- ⚠️ VRM FERMÉ PARTOUT pendant l'essai et l'application (aucun appareil qui
-- synchronise) : mesuré sur la projection de sa base (11 octobre, Postgres 16),
-- la conversion verrouille `main` ~6 s ; une écriture de l'app qui attend plus
-- de 8 s (statement_timeout / lock_timeout de ses rôles) tombe.
-- ⚠️ Lire `dressings.avantCoupure` de la mesure (`attention` dans l'essai) : un
-- compte dont le dressing a été capté AVANT T ne montre aucune annonce
-- republiée — le faire recapter (passer sur Vinted connecté sur ce compte),
-- puis refaire la mesure.
--
--   select sauvegarde.vrm_numerotation_mesurer(
--     (select valeur::uuid from public.vrm_reglages where cle = 'proprietaire'), 'B', '2026-10-09T00:00:00Z');
--
--   begin;
--   set local lock_timeout = '3s';
--   select sauvegarde.vrm_numerotation_archiver(
--     (select valeur::uuid from public.vrm_reglages where cle = 'proprietaire'), 'B', '2026-10-09T00:00:00Z',
--     '<la mesure, collée telle quelle>'::jsonb);
--   commit;          -- (ROLLBACK pour l'essai)
--
--   select sauvegarde.vrm_numerotation_rattraper(
--     (select valeur::uuid from public.vrm_reglages where cle = 'proprietaire'), 60);
--
-- RETOUR ARRIÈRE (refusé dès qu'un numéro a bougé depuis) :
--   select sauvegarde.vrm_numerotation_annuler(
--     (select valeur::uuid from public.vrm_reglages where cle = 'proprietaire'));
-- ════════════════════════════════════════════════════════════════════════════
