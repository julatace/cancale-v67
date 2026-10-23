#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA MIGRATION 016 (mode équipe) : L'ESSAI ANNULÉ, PUIS LA VÉRIFICATION
//
//  node scripts/equipe-sql/essai-annule.cjs            > essai.sql     (l'essai)
//  node scripts/equipe-sql/essai-annule.cjs --verifier > verifier.sql  (après application)
//
//  1. L'ESSAI, fabriqué à partir du fichier TEL QU'IL EST : une transaction, la
//     migration SANS son propre BEGIN/COMMIT, un rapport d'UNE ligne (`essai`,
//     JSON), puis ROLLBACK. Il ne lit ni n'écrit AUCUNE donnée de vendeur.
//     ⚠️ Il pose `alter policy` sur app_data (verrou de table court,
//     lock_timeout 3 s) : le lancer d'un bloc, jamais pas à pas.
//  2. LA VÉRIFICATION, en lecture seule, une fois la migration appliquée. Une
//     ligne `verification` : `ok` doit valoir true, `ecarts` nomme ce qui
//     diffère. Elle regarde la FORME de la table (même expression que le
//     fichier, relue dedans), RLS activé ET forcé, AUCUN droit de table ni de
//     colonne pour anon/authenticated/service_role, AUCUNE règle sur la table,
//     les règles d'app_data (texte exact : les deux de la 016, plus la
//     restrictive de lecture de la 021 quand elle existe — 22 octobre), aucune
//     AUTRE règle d'app_data qui parle de l'équipe, aucune restrictive de
//     lecture qui ignore l'équipe (elle rendrait l'aide aveugle), et chaque fonction (une version, SECURITY DEFINER
//     ou non comme écrit, search_path vide, volatilité, corps md5, qui
//     l'exécute).
//  `scripts/audit-equipe-sql.cjs` exécute les deux sur un Postgres jetable.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const MIG = arg('migration', path.join(__dirname, '..', '..', 'supabase/migrations/016-equipe.sql'));
const sql = fs.readFileSync(MIG, 'utf8');
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";
const md5 = (x) => crypto.createHash('md5').update(x).digest('hex');

function sansCommentaires(s) {
  let o = '', i = 0, dollar = false, quote = false;
  while (i < s.length) {
    if (!quote && s.startsWith('$$', i)) { dollar = !dollar; o += '$$'; i += 2; continue; }
    if (!dollar && s[i] === "'") { quote = !quote; o += s[i++]; continue; }
    if (!dollar && !quote && s.startsWith('--', i)) { while (i < s.length && s[i] !== '\n') i++; continue; }
    o += s[i++];
  }
  return o.split('\n').filter((l) => l.trim() !== '').join('\n') + '\n';
}

// ── CE QUE LE FICHIER DIT ─────────────────────────────────────────────────
const FONCTIONS = {};
for (const m of sql.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)\s+returns ([\s\S]*?) as \$\$([\s\S]*?)\$\$/g)) {
  const e = m[3];
  FONCTIONS[m[1]] = { md5: md5(m[4]), def: /\bsecurity definer\b/.test(e), sp: /\bset search_path = ''/.test(e),
    vol: /\bimmutable\b/.test(e) ? 'i' : /\bstable\b/.test(e) ? 's' : 'v' };
}
// Qui exécute quoi : les `grant execute … to <rôle>;` du fichier.
const GRANTS = {};
for (const m of sql.matchAll(/^grant execute on function public\.([a-z_]+)\([^)]*\) to ([a-z_, ]+);/gm))
  for (const r of m[2].split(',')) (GRANTS[m[1]] = GRANTS[m[1]] || []).push(r.trim());
const FONCTIONS_ATTENDUES = Object.fromEntries(Object.entries(FONCTIONS).map(([k, f]) => [k,
  { n: 1, def: f.def, cfg: f.sp ? ['search_path=""'] : null, vol: f.vol, md5: f.md5,
    auth: (GRANTS[k] || []).includes('authenticated'), sr: (GRANTS[k] || []).includes('service_role'), anon: false }]));
const fx = /select (pg_catalog\.md5\([\s\S]*?\))\n {4}into v;/.exec(sql);
const FORME = fx ? fx[1] : null;
const em = /if v is distinct from '([0-9a-f]{32}|__EMPREINTE__)' then/.exec(sql);
const EMPREINTE = em ? em[1] : null;
// Le texte des deux règles d'app_data, normalisé comme Postgres le redonne
// (mesuré sur une installation neuve par l'audit, qui exige qu'il corresponde).
const REGLES = [
  'app_data:abonnement_requis:RESTRICTIVE:ALL:authenticated:((selectvrm_acces_ok())or(owner=(selectvrm_equipe_vendeur()))):(selectvrm_acces_ok())',
  'app_data:equipe_lit:PERMISSIVE:SELECT:authenticated:((owner=(selectvrm_equipe_vendeur()))andvrm_equipe_id_permis(id)):',
];
// Sur une base qui porte la 021 (la production, depuis le 21 octobre), sa
// restrictive de lecture doit porter la clause de l'équipe (016 §11 bis) —
// sinon le membre ne lit RIEN. Les deux listes sont triées comme `regles`.
const REGLES_021 = [...REGLES,
  'app_data:vrm_lecture_privee:RESTRICTIVE:SELECT:authenticated:((owner=(selectauth.uid()))or((owner=(selectvrm_equipe_vendeur()))andvrm_equipe_id_permis(id))):',
].sort();
const AVEC_021 = `exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'vrm_lecture_privee')`;
const norm = (x) => `regexp_replace(regexp_replace(regexp_replace(lower(coalesce(${x}, '')), '\\s+', '', 'g'), 'public\\.', '', 'g'), 'as[a-z_]+\\)', ')', 'g')`;
const etat = `json_build_object(
  'table', to_regclass('public.vrm_equipe') is not null,
  'rls', (select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('public.vrm_equipe')),
  'forme', ${FORME ? `(select ${FORME} where to_regclass('public.vrm_equipe') is not null)` : 'null'},
  'droits', (select coalesce(json_agg(r || ':' || p order by r, p), '[]') from unnest(array['anon','authenticated','service_role','public']) r,
             unnest(case when current_setting('server_version_num')::int >= 170000
                         then array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
                         else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] end) p
             where to_regclass('public.vrm_equipe') is not null and has_table_privilege(r, 'public.vrm_equipe', p)),
  'droits_colonnes', (select json_agg(a.attname) from pg_attribute a where a.attrelid = to_regclass('public.vrm_equipe') and a.attnum > 0 and a.attacl is not null),
  'regles_table', (select json_agg(policyname) from pg_policies where schemaname = 'public' and tablename = 'vrm_equipe'),
  'regles', (select coalesce(json_agg(s order by s collate "C"), '[]') from (select tablename || ':' || policyname || ':' || permissive || ':' || cmd || ':' || array_to_string(roles, ',') || ':' || ${norm('qual')} || ':' || ${norm('with_check')} s
             from pg_policies where schemaname = 'public' and tablename = 'app_data' and (policyname in ('equipe_lit', 'abonnement_requis')
               or coalesce(qual, '') like '%vrm_equipe%' or coalesce(with_check, '') like '%vrm_equipe%')) z),
  'restrictives_bloquantes', (select json_agg(policyname order by policyname) from pg_policies where schemaname = 'public' and tablename = 'app_data'
             and permissive = 'RESTRICTIVE' and cmd in ('SELECT', 'ALL') and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])
             and coalesce(qual, '') not like '%vrm_equipe_vendeur%'),
  'fonctions', (select json_object_agg(q, (select json_build_object('n', count(*), 'def', bool_and(p.prosecdef), 'cfg', (array_agg(to_jsonb(p.proconfig)))[1], 'vol', (array_agg(p.provolatile::text))[1], 'md5', (array_agg(md5(p.prosrc)))[1],
                                            'auth', bool_and(has_function_privilege('authenticated', p.oid, 'execute')),
                                            'sr', bool_and(has_function_privilege('service_role', p.oid, 'execute')),
                                            'anon', bool_or(has_function_privilege('anon', p.oid, 'execute')))
                                         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = q))
                from unnest(array[${Object.keys(FONCTIONS).map(lit).join(',')}]::text[]) q)
)`;

if (process.argv.includes('--verifier')) {
  const parties = {
    fichier: Object.keys(FONCTIONS).length === 9 && FORME && EMPREINTE && EMPREINTE !== '__EMPREINTE__' ? 'true' : 'false',
    table: `(e.j ->> 'table')::boolean`,
    rls: `(e.j ->> 'rls')::boolean`,
    forme: `e.j ->> 'forme' = ${lit(EMPREINTE)}`,
    droits: `json_array_length(e.j -> 'droits') = 0`,
    droits_colonnes: `(e.j ->> 'droits_colonnes') is null`,
    regles_table: `(e.j ->> 'regles_table') is null`,
    regles: `(e.j -> 'regles')::jsonb = case when ${AVEC_021} then ${lit(JSON.stringify(REGLES_021))}::jsonb else ${lit(JSON.stringify(REGLES))}::jsonb end`,
    restrictives_bloquantes: `(e.j ->> 'restrictives_bloquantes') is null`,
    fonctions: `(e.j -> 'fonctions')::jsonb = ${lit(JSON.stringify(FONCTIONS_ATTENDUES))}::jsonb`,
  };
  const cas = Object.entries(parties).map(([k, c]) => `case when coalesce((${c}), false) then null else ${lit(k)} end`).join(', ');
  process.stdout.write(`-- Vérification de la migration 016 APPLIQUÉE (lecture seule). verification.ok doit valoir true ; ecarts nomme ce qui diffère.
with e as (select ${etat} j), x as (select array_remove(array[${cas}], null) ecarts from e)
select json_build_object('ok', cardinality(x.ecarts) = 0, 'ecarts', to_json(x.ecarts),
  'fonctions_differentes', (select json_agg(k) from jsonb_each(${lit(JSON.stringify(FONCTIONS_ATTENDUES))}::jsonb) a(k, v) where (e.j -> 'fonctions')::jsonb -> k is distinct from v),
  'etat', e.j) as verification
from e, x;
`);
  process.exit(0);
}

const lignes = sansCommentaires(sql).split('\n').filter((l) => l.trim() !== '');
const ib = lignes.findIndex((l) => l.trim() === 'begin;');
const ic = lignes.map((l) => l.trim()).lastIndexOf('commit;');
if (ib < 0 || ic < 0 || ic < ib) { console.error('BEGIN/COMMIT introuvables dans la migration'); process.exit(1); }
process.stdout.write(`-- ESSAI ANNULÉ de la migration 016 (scripts/equipe-sql/essai-annule.cjs) : RIEN ne reste après.
begin;
${lignes.slice(ib + 1, ic).join('\n')}
select ${etat} as essai;
rollback;
`);
