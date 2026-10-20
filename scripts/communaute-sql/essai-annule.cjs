#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES MIGRATIONS 018 + 019 (carte de la communauté, Discord, classement) :
//  L'ESSAI ANNULÉ, PUIS LA VÉRIFICATION
//
//  node scripts/communaute-sql/essai-annule.cjs            > essai.sql     (l'essai de la 019)
//  node scripts/communaute-sql/essai-annule.cjs --verifier > verifier.sql  (après application)
//  --migration=fichier (répétable) : l'essai porte sur le DERNIER fichier, la
//  vérification sur leur union (une fonction redéfinie plus loin l'emporte).
//  Par défaut : 018 puis 019 (la 018 est appliquée en production, l'essai joue la 019).
//
//  1. L'ESSAI, fabriqué à partir du fichier TEL QU'IL EST : une transaction, la
//     migration SANS son propre BEGIN/COMMIT, un rapport d'UNE ligne (`essai`,
//     JSON), puis ROLLBACK. Il ne lit ni n'écrit AUCUNE donnée de vendeur, et
//     ne touche à aucune table existante.
//  2. LA VÉRIFICATION, en lecture seule, une fois la migration appliquée. Une
//     ligne `verification` : `ok` doit valoir true, `ecarts` nomme ce qui
//     diffère. Elle regarde la FORME des cinq tables (même expression que le
//     fichier, relue dedans), RLS activé ET forcé sur chacune, AUCUN droit de
//     table, de colonne ni de séquence pour anon/authenticated/service_role,
//     AUCUNE règle sur ces tables, et chaque fonction (une version, SECURITY
//     DEFINER, search_path vide, volatilité, corps md5, qui l'exécute).
//  `scripts/audit-communaute-sql.cjs` exécute les deux sur un Postgres jetable.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MIGS_ARG = process.argv.filter((x) => x.startsWith('--migration=')).map((x) => x.slice('--migration='.length));
const MIGS = MIGS_ARG.length ? MIGS_ARG : ['018-communaute.sql', '019-communaute-discord-classement.sql'].map((f) => path.join(__dirname, '..', '..', 'supabase/migrations', f));
const SQLS = MIGS.map((f) => fs.readFileSync(f, 'utf8'));
const sql = SQLS[SQLS.length - 1];      // l'essai porte sur le dernier fichier
const tout = SQLS.join('\n');
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";
const md5 = (x) => crypto.createHash('md5').update(x).digest('hex');
const TABLES = ['vrm_communaute_blocages', 'vrm_communaute_conversations', 'vrm_communaute_messages', 'vrm_communaute_profils', 'vrm_communaute_signalements'];
const SEQUENCES = ['vrm_communaute_messages_id_seq', 'vrm_communaute_signalements_id_seq'];

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

const FONCTIONS = {};
for (const m of tout.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)\s+returns ([\s\S]*?) as \$\$([\s\S]*?)\$\$/g)) {
  const e = m[3];
  FONCTIONS[m[1]] = { md5: md5(m[4]), def: /\bsecurity definer\b/.test(e), sp: /\bset search_path = ''/.test(e),
    vol: /\bimmutable\b/.test(e) ? 'i' : /\bstable\b/.test(e) ? 's' : 'v' };
}
const GRANTS = {};
for (const t of SQLS) {
  const g = {};
  for (const m of t.matchAll(/^grant execute on function public\.([a-z_]+)\([^)]*\) to ([a-z_, ]+);/gm))
    for (const r of m[2].split(',')) (g[m[1]] = g[m[1]] || []).push(r.trim());
  // Une fonction redéfinie dans un fichier plus loin y reçoit ses droits (révoqués puis accordés).
  for (const m of t.matchAll(/create or replace function public\.([a-z_]+)\(/g)) GRANTS[m[1]] = g[m[1]] || [];
}
const FONCTIONS_ATTENDUES = Object.fromEntries(Object.entries(FONCTIONS).map(([k, f]) => [k,
  { n: 1, def: f.def, cfg: f.sp ? ['search_path=""'] : null, vol: f.vol, md5: f.md5,
    auth: (GRANTS[k] || []).includes('authenticated'), sr: (GRANTS[k] || []).includes('service_role'), anon: false }]));
const derniere = (re) => { for (let i = SQLS.length - 1; i >= 0; i--) { const m = re.exec(SQLS[i]); if (m) return m[1]; } return null; };
const FORME = derniere(/select (pg_catalog\.md5\(pg_catalog\.string_agg\([\s\S]*?\) t\(n\))\n {4}into v;/);
const EMPREINTE = derniere(/if v is distinct from '([0-9a-f]{32}|__EMPREINTE__)' then/);
const FONCTIONS_COMPTE = /019/.test(MIGS.map((f) => path.basename(f)).join(' ')) ? 14 : 10;
const arr = (l) => 'array[' + l.map(lit).join(',') + ']';
const PRIVS = `case when current_setting('server_version_num')::int >= 170000
     then array['SELECT','INSERT','UPDATE','DEL' || 'ETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
     else array['SELECT','INSERT','UPDATE','DEL' || 'ETE','TRUNCATE','REFERENCES','TRIGGER'] end`;
const NOMS = `array[${Object.keys(FONCTIONS).map(lit).join(',')}]::text[]`;
const etat = `json_build_object(
  'tables', (select count(*) from unnest(${arr(TABLES)}) t where to_regclass('public.' || t) is not null),
  'rls', (select coalesce(bool_and(relrowsecurity and relforcerowsecurity), false) and count(*) = ${TABLES.length} from pg_class where oid in (select to_regclass('public.' || t) from unnest(${arr(TABLES)}) t)),
  'forme', ${FORME ? `(select ${FORME})` : 'null'},
  'droits', (select coalesce(json_agg(t || ':' || r || ':' || p order by t, r, p), '[]') from unnest(${arr(TABLES)}) t, unnest(array['anon','authenticated','service_role','public']) r,
             unnest(${PRIVS}) p
             where to_regclass('public.' || t) is not null and has_table_privilege(r, 'public.' || t, p)),
  'droits_colonnes', (select json_agg(a.attrelid::regclass::text || '.' || a.attname) from pg_attribute a where a.attrelid in (select to_regclass('public.' || t) from unnest(${arr(TABLES)}) t) and a.attnum > 0 and a.attacl is not null),
  'droits_sequences', (select json_agg(s || ':' || r || ':' || p) from unnest(${arr(SEQUENCES)}) s, unnest(array['anon','authenticated','service_role','public']) r, unnest(array['USAGE','SELECT','UPDATE']) p
             where to_regclass('public.' || s) is not null and has_sequence_privilege(r, 'public.' || s, p)),
  'regles_table', (select json_agg(tablename || ':' || policyname) from pg_policies where schemaname = 'public' and tablename = any (${arr(TABLES)})),
  'fonctions', (select json_object_agg(q, (select json_build_object('n', count(*), 'def', bool_and(p.prosecdef), 'cfg', (array_agg(to_jsonb(p.proconfig)))[1], 'vol', (array_agg(p.provolatile::text))[1], 'md5', (array_agg(md5(p.prosrc)))[1],
                                            'auth', bool_and(has_function_privilege('authenticated', p.oid, 'execute')),
                                            'sr', bool_and(has_function_privilege('service_role', p.oid, 'execute')),
                                            'anon', bool_or(has_function_privilege('anon', p.oid, 'execute')))
                                         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = q))
                from unnest(${NOMS}) q),
  'autres_fonctions', (select json_agg(proname) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'vrm_communaute_%'
                        and proname <> all (${NOMS}))
)`;

if (process.argv.includes('--verifier')) {
  const parties = {
    fichier: Object.keys(FONCTIONS).length === FONCTIONS_COMPTE && FORME && EMPREINTE && EMPREINTE !== '__EMPREINTE__' ? 'true' : 'false',
    tables: `(e.j ->> 'tables')::int = ${TABLES.length}`,
    rls: `(e.j ->> 'rls')::boolean`,
    forme: `e.j ->> 'forme' = ${lit(EMPREINTE)}`,
    droits: `json_array_length(e.j -> 'droits') = 0`,
    droits_colonnes: `(e.j ->> 'droits_colonnes') is null`,
    droits_sequences: `(e.j ->> 'droits_sequences') is null`,
    regles_table: `(e.j ->> 'regles_table') is null`,
    fonctions: `(e.j -> 'fonctions')::jsonb = ${lit(JSON.stringify(FONCTIONS_ATTENDUES))}::jsonb and (e.j ->> 'autres_fonctions') is null`,
  };
  const cas = Object.entries(parties).map(([k, c]) => `case when coalesce((${c}), false) then null else ${lit(k)} end`).join(', ');
  process.stdout.write(`-- Vérification de la carte de la communauté APPLIQUÉE (${MIGS.map((f) => path.basename(f)).join(' + ')}) (lecture seule). verification.ok doit valoir true ; ecarts nomme ce qui diffère.
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
process.stdout.write(`-- ESSAI ANNULÉ de ${path.basename(MIGS[MIGS.length - 1])} (scripts/communaute-sql/essai-annule.cjs) : RIEN ne reste après.
begin;
${lignes.slice(ib + 1, ic).join('\n')}
select ${etat} as essai;
rollback;
`);
