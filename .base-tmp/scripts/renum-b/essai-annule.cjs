#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  L'ESSAI DE LA MIGRATION 013 DANS UNE TRANSACTION ANNULÉE
//  node scripts/renum-b/essai-annule.cjs [--coupure=2026-10-09T00:00:00Z] > essai.sql
//
//  Fabrique, à partir du fichier de migration TEL QU'IL EST (jamais une copie
//  qui pourrait diverger), un script SQL qui :
//    1. ouvre UNE transaction ;
//    2. installe la migration (sans son propre BEGIN/COMMIT — sinon le COMMIT
//       du fichier validerait l'essai) ;
//    3. mesure, puis convertit, le vendeur `proprietaire` de `vrm_reglages` ;
//    4. rend UN rapport (une ligne, une colonne `essai`, en JSON) : le plan
//       (les annonces jugées nouvelles, leur date, leur source, si une capture
//       les montre en ligne), le rapport de conversion, le marqueur, et ce que
//       contient le pool après ;
//    5. ANNULE tout (ROLLBACK).
//
//  ⚠️ Pendant l'essai, la ligne `main` du vendeur et ses emails sont verrouillés
//     (la conversion les réécrit) : ses écritures ATTENDENT jusqu'au ROLLBACK.
//     Les déclencheurs (qui verrouillent TOUTE la table `app_data`) ne sont
//     créés qu'à la fin, juste avant le ROLLBACK. `lock_timeout` (5 s) et
//     `statement_timeout` (120 s) bornent l'essai. Le lancer d'un bloc, jamais
//     pas à pas dans une session laissée ouverte.
//  ⚠️ À lancer VRM FERMÉ PARTOUT : mesuré sur la projection de sa base (11
//     octobre), l'essai dure ~8 s et `main` reste verrouillée ~6 s ; une
//     écriture de l'app qui attend plus de 8 s tombe.
//  ⚠️ Lire `attention` AVANT d'appliquer : `dressingsAvantCoupure` nomme les
//     comptes dont le dressing a été capté avant T (le plan n'y voit aucune
//     annonce republiée) ; `nouvellesPasEnLigne` compte les nouvelles qu'aucune
//     capture ne montre en ligne (vendues, ou supprimées).
//  ⚠️ `audit-renum-b.cjs` exécute ce script sur un Postgres jetable et vérifie
//     qu'il ne laisse RIEN derrière lui.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const COUPURE = arg('coupure', '2026-10-09T00:00:00Z');
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/.test(COUPURE)) { console.error('coupure illisible : ' + COUPURE); process.exit(1); }
const MIG = arg('migration', path.join(__dirname, '..', '..', 'supabase/migrations/013-anciens-numeros-en-b.sql'));
const sql = fs.readFileSync(MIG, 'utf8');
const lignes = sql.split('\n');
const iBegin = lignes.findIndex((l) => /^begin;\s*$/.test(l));
const iCommit = lignes.map((l, i) => (/^commit;\s*$/.test(l) ? i : -1)).filter((i) => i >= 0).pop();
if (iBegin < 0 || iCommit == null || iCommit < iBegin) { console.error('BEGIN/COMMIT de l\'installation introuvables : rien n\'est fabriqué'); process.exit(1); }
const corps0 = lignes.slice(iBegin + 1, iCommit).join('\n');
// Les GARDE-FOUS (déclencheurs sur `app_data`) sont installés APRÈS le rapport :
// créer un déclencheur verrouille toute la table jusqu'au ROLLBACK, et la
// conversion n'en dépend pas (ils ne jugent que les écritures des navigateurs).
// Le fichier entier est quand même essayé.
const iGarde = corps0.indexOf('\n-- ── 7. LES GARDE-FOUS');
if (iGarde < 0) { console.error('section des garde-fous introuvable : rien n\'est fabriqué'); process.exit(1); }
const corps = corps0.slice(0, iGarde), garde = corps0.slice(iGarde);
if (/^\s*(commit|end)\s*;\s*$/im.test(corps.replace(/\$\$[\s\S]*?\$\$/g, ''))) { console.error('un COMMIT reste dans le corps : rien n\'est fabriqué'); process.exit(1); }

const OWNER = "(select valeur::uuid from public.vrm_reglages where cle = 'proprietaire')";
process.stdout.write(`-- ESSAI DE LA MIGRATION 013 — DANS UNE TRANSACTION ANNULÉE (rien ne reste).
-- Fabriqué par scripts/renum-b/essai-annule.cjs depuis supabase/migrations/013-anciens-numeros-en-b.sql.
-- Coupure : ${COUPURE}
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

${corps}

-- ── L'ESSAI ─────────────────────────────────────────────────────────────────
create temp table _essai_013 on commit drop as
select sauvegarde.vrm_numerotation_mesurer(${OWNER}, 'B', '${COUPURE}') as mesure;
alter table _essai_013 add column rapport jsonb;
update _essai_013 set rapport = sauvegarde.vrm_numerotation_archiver(${OWNER}, 'B', '${COUPURE}', mesure);

select jsonb_build_object(
  'coupure', '${COUPURE}',
  'proprietaireTrouve', ${OWNER} is not null,
  'plan', (select mesure -> 'plan' from _essai_013),
  -- ⚠️ À LIRE AVANT D'APPLIQUER : un compte dont le dressing a été capté avant la
  -- coupure (ou jamais) ne montre aucune annonce republiée — le plan ne voit rien
  -- sur lui. Le faire recapter (passer sur Vinted connecté sur ce compte), puis
  -- refaire l'essai.
  'attention', (select jsonb_build_object(
      'dressingsAvantCoupure', mesure -> 'dressings' -> 'avantCoupure',
      'nouvellesPasEnLigne', mesure -> 'plan' -> 'nouvellesPasEnLigne') from _essai_013),
  'dressings', (select mesure -> 'dressings' -> 'comptes' from _essai_013),
  'rapport', (select rapport - 'apres' - 'nouvelles' from _essai_013),
  'marqueur', (select data -> 'vrm_numerotation' from public.app_data where owner = ${OWNER} and id = 'main'),
  'poolApres', (select jsonb_build_object(
      'total', count(*),
      'enB', count(*) filter (where x #>> '{}' ~ '^B[0-9]+$'),
      'enChiffres', count(*) filter (where x #>> '{}' ~ '^[0-9]+$'),
      'autres', count(*) filter (where not (x #>> '{}' ~ '^B?[0-9]+$')),
      'chiffres', coalesce(jsonb_agg(x) filter (where x #>> '{}' ~ '^[0-9]+$'), '[]'))
    from public.app_data a, jsonb_array_elements(a.data -> 'vinted_used_numeros') x
    where a.owner = ${OWNER} and a.id = 'main'),
  'fichesApres', (select jsonb_build_object(
      'enB', count(*) filter (where v ->> 'numero' ~ '^B[0-9]+$'),
      'enChiffres', count(*) filter (where v ->> 'numero' ~ '^[0-9]+$'))
    from public.app_data a, jsonb_each(a.data -> 'vinted_annonce_numeros') e(k, v)
    where a.owner = ${OWNER} and a.id = 'main')
) as essai;

-- Les garde-fous, installés en dernier (voir l'en-tête du fabricant).
${garde}

rollback;
`);
