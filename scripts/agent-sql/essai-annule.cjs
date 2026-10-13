#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA MIGRATION 014 (mémoire de l'agent eBay) : L'ESSAI ANNULÉ, PUIS LA VÉRIFICATION
//
//  node scripts/agent-sql/essai-annule.cjs            > essai.sql     (l'essai)
//  node scripts/agent-sql/essai-annule.cjs --verifier > verifier.sql  (après application)
//
//  1. L'ESSAI, fabriqué à partir du fichier TEL QU'IL EST (jamais une copie qui
//     pourrait diverger) : une transaction, la migration SANS son propre
//     BEGIN/COMMIT (sinon le COMMIT du fichier validerait l'essai), un rapport
//     d'UNE ligne (colonne `essai`, en JSON), puis ROLLBACK. Les commentaires
//     HORS des corps de fonctions sont retirés (l'outil SQL ne prend pas de
//     fichier ; la 013 de 92 Ko n'était pas passée d'un bloc) ; les corps, eux,
//     restent octet pour octet ceux du fichier.
//  2. LA VÉRIFICATION, en lecture seule, une fois la migration appliquée. Une
//     ligne, `verification`, en JSON, dont `ok` doit valoir true, et `ecarts`
//     nomme ce qui diffère. Elle regarde TOUT ce qui fait une garantie, pas
//     seulement que les objets existent :
//       • la FORME de chaque table (colonnes, types, NOT NULL, et chaque
//         contrainte : son NOM et l'empreinte de son TEXTE), contre l'empreinte
//         écrite dans le fichier, calculée par la MÊME expression que le bloc 1c
//         (relue dans le fichier, jamais recopiée) ;
//       • RLS activé ET forcé sur chaque table ;
//       • les DROITS EXACTS de anon, authenticated et service_role sur chaque
//         table (dont TRUNCATE, et MAINTAIN en Postgres 17), et sur la séquence ;
//         et AUCUN droit de COLONNE (un `grant insert (owner, cle, …)` ne se
//         voit pas au niveau de la table : il ouvrait l'écriture directe des
//         mémos au serveur, la vérification rendait ok) ;
//       • les RÈGLES (RLS) et leur texte ;
//       • chaque FONCTION : une seule version, SECURITY DEFINER, search_path et
//         VOLATILITÉ tels que le fichier les écrit (la pierre tombale, STABLE,
//         relirait un instantané d'avant le verrou), corps identique (md5), et
//         qui peut l'exécuter ;
//       • chaque DÉCLENCHEUR du fichier présent ET actif (une garde suspendue
//         n'est pas une garde), avec SON moment, SES évènements, sa portée
//         (ligne / instruction), aucune restriction de colonnes (`UPDATE OF`),
//         et SA condition WHEN : le même nom recréé `when (false)`, ou pour
//         UPDATE seulement, n'est plus la même garde ;
//       • la ligne d'horloge, le réglage, aucune marque de transaction qui
//         traîne, aucune horloge simulée posée sur la base ou sur un rôle.
//
//  3. LES MORCEAUX, seulement si l'outil SQL refuse le bloc entier :
//       node scripts/agent-sql/essai-annule.cjs --morceaux --dossier=/chemin
//     écrit trois fichiers, trois transactions, À APPLIQUER DANS L'ORDRE :
//     (1) les tables et leurs droits, (2) les fonctions et leurs droits,
//     (3) les gardes, la trace, la pierre tombale, le réglage et l'horloge.
//     Chaque objet naît FERMÉ dans la transaction qui le crée (l'audit le
//     vérifie après chaque morceau) ; réappliquer un morceau ne lève rien.
//
//  ⚠️ L'essai pose des déclencheurs sur `app_data` (verrou de table court) :
//     `lock_timeout` 3 s. Le lancer d'un bloc, jamais pas à pas dans une session
//     laissée ouverte. Il ne lit ni n'écrit AUCUNE donnée de vendeur.
//  ⚠️ `audit-agent-sql.cjs` exécute les trois sur un Postgres jetable : l'essai
//     ne laisse RIEN derrière lui, la vérification rend ok après application et
//     ok = false dès qu'une garde est touchée.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const MIG = arg('migration', path.join(__dirname, '..', '..', 'supabase/migrations/014-agent.sql'));
const sql = fs.readFileSync(MIG, 'utf8');

// Retire les commentaires `--` HORS des chaînes et des corps $$…$$ (gardés tels quels).
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
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";
const md5 = (x) => crypto.createHash('md5').update(x).digest('hex');

// ── CE QUE LE FICHIER DIT ─────────────────────────────────────────────────
// Les fonctions : `create or replace function <schéma>.<nom>(…) <en-tête> as $$<corps>$$`.
const FONCTIONS = {};
for (const m of sql.matchAll(/create or replace function ([a-z_]+)\.([a-z_]+)\(([\s\S]*?)\bas \$\$([\s\S]*?)\$\$/g)) {
  const entete = m[3];
  FONCTIONS[m[1] + '.' + m[2]] = { md5: md5(m[4]), def: /\bsecurity definer\b/i.test(entete), sp: /\bset search_path (?:=|to) ''/i.test(entete),
    vol: /\bimmutable\b/i.test(entete) ? 'i' : /\bstable\b/i.test(entete) ? 's' : 'v' };
}
// Celles que le serveur (service_role) exécute : la liste du §4 du fichier.
const sec4 = sql.slice(sql.indexOf('-- ── 4. '), sql.indexOf('-- ── 5. '));
const api = /p\.proname in \(([^)]*)\)/.exec(sec4);
const API = new Set(api ? [...api[1].matchAll(/'([a-z_]+)'/g)].map((x) => 'public.' + x[1]) : []);
// Les déclencheurs : `create or replace trigger <nom> before|after <évènements> on <table> for each row|statement
// [when (<condition>)] execute function <fonction>(`. Chacun est attendu TEL QUE le fichier l'écrit : table,
// nom, fonction, `tgtype` (ligne 1 · avant 2 · insert 4 · delete 8 · update 16 · truncate 32), et sa condition
// WHEN normalisée (minuscules, sans conversion `::type`, sans espaces ni parenthèses — la même normalisation que
// celle appliquée au texte que Postgres en redonne, `pg_get_triggerdef`).
const normWhen = (x) => String(x || '').toLowerCase().replace(/::[a-z_]+/g, '').replace(/[\s()]/g, '');
const DECLENCHEURS = [...sql.matchAll(/create or replace trigger (\w+)\s+(before|after)\s+([a-z ]+?)\s+on\s+(\w+\.\w+)\s+for each (row|statement)\s+(?:when \(([\s\S]*?)\)\s+)?execute function (\w+\.\w+)\(/g)]
  .map((m) => {
    const ev = m[3].split(/\s+or\s+/);
    const type = (m[5] === 'row' ? 1 : 0) | (m[2] === 'before' ? 2 : 0) | (ev.includes('insert') ? 4 : 0) | (ev.includes('delete') ? 8 : 0)
      | (ev.includes('update') ? 16 : 0) | (ev.includes('truncate') ? 32 : 0);
    return m[4] + ':' + m[1] + ':' + m[7] + ':' + type + ':' + normWhen(m[6]);
  });
// Chaque `create or replace trigger` du fichier doit avoir été LU : un déclencheur écrit sous une forme que
// l'expression ne reconnaît pas ne serait jamais vérifié (jamais « ok » par vide).
const NB_DECLENCHEURS = (sql.match(/create or replace trigger /g) || []).length;
// L'expression de la FORME : celle du bloc 1c du fichier, relue ici (jamais recopiée : une seule règle).
const fx = /\n {4}select (coalesce\(\(select string_agg\(x\.attname[\s\S]*?)\n {6}into v\n/.exec(sql);
const FORME = fx ? fx[1] : null;
// L'empreinte de chaque table (le bloc 1c du fichier, la MÊME que celle qui refuse une forme ancienne).
const em = /\$empreinte\$(\{[\s\S]*?\})\$empreinte\$/.exec(sql);
const EMPREINTE = em ? JSON.parse(em[1]) : {};
// Les tables, les règles et les droits attendus. Ces listes sont celles du §2 du
// fichier ; l'audit vérifie qu'elles décrivent EXACTEMENT une installation neuve
// (la vérification y rend ok) : elles ne peuvent pas diverger en silence.
const TABLES = Object.keys(EMPREINTE);
const LISIBLES = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal'];
const SANS_DROIT = ['vrm_agent_marques'];                 // pas même le serveur
const DROITS = new Set();
for (const t of TABLES) if (!SANS_DROIT.includes(t)) DROITS.add('service_role:' + t + ':SELECT');
for (const t of LISIBLES) DROITS.add('authenticated:' + t + ':SELECT');
for (const m of sql.matchAll(/^grant ([a-z, ]+) on public\.(\w+) to service_role;/gm))
  for (const p of m[1].split(',')) DROITS.add('service_role:' + m[2] + ':' + p.trim().toUpperCase());
const REGLES = LISIBLES.flatMap((t) => [
  `${t}:abonnement_requis:RESTRICTIVE:ALL:authenticated:(selectvrm_acces_ok()):(selectvrm_acces_ok())`,
  `${t}:agent_lecture_soi:PERMISSIVE:SELECT:authenticated:(owner=(selectauth.uid())):`]).sort();
const FONCTIONS_ATTENDUES = Object.fromEntries(Object.entries(FONCTIONS).map(([k, f]) => [k,
  { n: 1, def: f.def, cfg: f.sp ? ['search_path=""'] : null, vol: f.vol, md5: f.md5, sr: API.has(k), nav: false }]));

// Compter les lignes d'une table qui peut ne pas exister (une version d'avant,
// une base pas encore installée) : -1 si elle manque, jamais une erreur.
const compte = (table, ou) => `(case when to_regclass(${lit(table)}) is null then -1 else (xpath('/row/n/text()', query_to_xml(${lit(`select count(*) as n from ${table} where ${ou}`)}, false, true, '')))[1]::text::int end)`;
const tabs = 'array[' + TABLES.map(lit).join(',') + ']::text[]';
const norm = (x) => `regexp_replace(regexp_replace(regexp_replace(lower(coalesce(${x}, '')), '\\s+', '', 'g'), 'public\\.', '', 'g'), 'as[a-z_]+\\)', ')', 'g')`;
const etat = `json_build_object(
  'tables', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname = any(${tabs}) and relrowsecurity),
  'rls_force', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname = any(${tabs}) and relrowsecurity and relforcerowsecurity),
  'formes', ${FORME ? `(select json_object_agg(t, (select ${FORME}
      from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass('public.' || t))) from unnest(${tabs}) t)` : 'null'},
  'droits', (select coalesce(json_agg(r || ':' || c.relname || ':' || p order by (r || ':' || c.relname || ':' || p) collate "C"), '[]') from pg_class c,
             unnest(array['anon', 'authenticated', 'service_role']) r,
             unnest(case when current_setting('server_version_num')::int >= 170000
                         then array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
                         else array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] end) p
             where c.relnamespace = 'public'::regnamespace and c.relname = any(${tabs}) and has_table_privilege(r, c.oid, p)),
  'droits_colonnes', (select json_agg(c.relname || '.' || a.attname || ':' || a.attacl::text order by c.relname, a.attnum) from pg_attribute a join pg_class c on c.oid = a.attrelid
                      where c.relnamespace = 'public'::regnamespace and c.relname = any(${tabs}) and a.attnum > 0 and a.attacl is not null),
  'sequence', (select json_agg(r || ':' || p) from pg_class c, unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['USAGE', 'SELECT', 'UPDATE']) p
               where c.oid = to_regclass('public.vrm_agent_journal_id_seq') and has_sequence_privilege(r, c.oid, p)),
  'regles', (select coalesce(json_agg(s order by s collate "C"), '[]') from (select tablename || ':' || policyname || ':' || permissive || ':' || cmd || ':' || array_to_string(roles, ',') || ':' || ${norm('qual')} || ':' || ${norm('with_check')} s
             from pg_policies where schemaname = 'public' and tablename = any(${tabs})) z),
  'fonctions', (select json_object_agg(q, (select json_build_object('n', count(*), 'def', bool_and(p.prosecdef), 'cfg', (array_agg(to_jsonb(p.proconfig)))[1], 'vol', (array_agg(p.provolatile::text))[1], 'md5', (array_agg(md5(p.prosrc)))[1],
                                            'sr', bool_and(has_function_privilege('service_role', p.oid, 'execute')),
                                            'nav', bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
                                         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname || '.' || p.proname = q))
                from unnest(array[${Object.keys(FONCTIONS).map(lit).join(',')}]::text[]) q),
  'declencheurs', (select coalesce(json_agg(e order by e collate "C"), '[]') from unnest(array[${DECLENCHEURS.map(lit).join(',')}]::text[]) e
                   where not exists (select 1 from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace cn on cn.oid = c.relnamespace
                                       join pg_proc p on p.oid = tg.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
                                      where not tg.tgisinternal and tg.tgenabled = 'O'
                                        and cn.nspname || '.' || c.relname || ':' || tg.tgname || ':' || pn.nspname || '.' || p.proname
                                            || ':' || tg.tgtype::int || ':' || regexp_replace(regexp_replace(lower(coalesce(substring(pg_get_triggerdef(tg.oid) from ' WHEN \\((.*)\\) EXECUTE '), '')), '::[a-z_]+', '', 'g'), '[\\s()]', '', 'g') = e
                                        and tg.tgattr::text = '' and tg.tgnargs = 0)),
  'horloge', ${compte('public.vrm_agent_horloge', 'id = 1')},
  'agent_ebay', (select valeur from public.vrm_reglages where cle = 'agent_ebay'),
  'marques', ${compte('public.vrm_agent_marques', 'true')},
  'simulee', (select json_agg(c) from pg_db_role_setting s, unnest(s.setconfig) c where c like 'vrm.horloge_simulee=%'),
  'navigateur_ecrit', (select json_agg(c.relname) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname = any(${tabs})
                        and (has_table_privilege('authenticated', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'update') or has_table_privilege('authenticated', c.oid, 'delete')
                             or has_table_privilege('authenticated', c.oid, 'truncate') or has_table_privilege('anon', c.oid, 'select'))),
  'fonctions_ouvertes', (select json_agg(p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'vrm\\_agent\\_%' or p.proname like 'vrm\\_ebay\\_%') and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')))
)`;

if (process.argv.includes('--verifier')) {
  const parties = {
    // Un fichier sans empreinte (une version d'avant) ne peut rien vérifier : jamais « ok » par vide.
    empreinte: TABLES.length > 0 && Object.keys(FONCTIONS).length > 0 && DECLENCHEURS.length > 0 && DECLENCHEURS.length === NB_DECLENCHEURS && FORME ? 'true' : 'false',
    rls: `(e.j ->> 'tables')::int = ${TABLES.length} and (e.j ->> 'rls_force')::int = ${TABLES.length}`,
    formes: `(e.j -> 'formes')::jsonb = ${lit(JSON.stringify(EMPREINTE))}::jsonb`,
    droits: `(e.j -> 'droits')::jsonb = ${lit(JSON.stringify([...DROITS].sort()))}::jsonb`,
    droits_colonnes: `(e.j ->> 'droits_colonnes') is null`,
    sequence: `(e.j ->> 'sequence') is null`,
    regles: `(e.j -> 'regles')::jsonb = ${lit(JSON.stringify(REGLES))}::jsonb`,
    fonctions: `(e.j -> 'fonctions')::jsonb = ${lit(JSON.stringify(FONCTIONS_ATTENDUES))}::jsonb`,
    declencheurs: `json_array_length(e.j -> 'declencheurs') = 0`,
    horloge: `(e.j ->> 'horloge')::int = 1`,
    reglage: `e.j ->> 'agent_ebay' is not null`,
    marques: `(e.j ->> 'marques')::int = 0`,
    simulee: `(e.j ->> 'simulee') is null`,
    navigateur: `(e.j ->> 'navigateur_ecrit') is null and (e.j ->> 'fonctions_ouvertes') is null`,
  };
  const cas = Object.entries(parties).map(([k, c]) => `case when coalesce((${c}), false) then null else ${lit(k)} end`).join(', ');
  process.stdout.write(`-- Vérification de la migration 014 APPLIQUÉE (lecture seule). Rend une ligne : verification.ok doit valoir true ; ecarts nomme ce qui diffère.
with e as (select ${etat} j), x as (select array_remove(array[${cas}], null) ecarts from e)
select json_build_object(
  'ok', cardinality(x.ecarts) = 0,
  'ecarts', to_json(x.ecarts),
  'fonctions_differentes', (select json_agg(k) from jsonb_each(${lit(JSON.stringify(FONCTIONS_ATTENDUES))}::jsonb) a(k, v) where (e.j -> 'fonctions')::jsonb -> k is distinct from v),
  'formes_differentes', (select json_agg(k) from jsonb_each_text(${lit(JSON.stringify(EMPREINTE))}::jsonb) a(k, v) where (e.j -> 'formes')::jsonb ->> k is distinct from v),
  'declencheurs_absents', e.j -> 'declencheurs',
  'etat', e.j) as verification
from e, x;
`);
  process.exit(0);
}

if (process.argv.includes('--morceaux')) {
  const dossier = arg('dossier', null);
  if (!dossier) { console.error('--dossier=/chemin exigé'); process.exit(1); }
  const L = sql.split('\n');
  const sec = (n) => L.findIndex((l) => l.startsWith('-- ── ' + n + '. '));
  const fin = L.map((l) => l.trim()).lastIndexOf('commit;');
  const bornes = [sec(1), sec(3), sec(5), fin];
  if (bornes.some((b) => b < 0) || !(bornes[0] < bornes[1] && bornes[1] < bornes[2] && bornes[2] < bornes[3])) { console.error('sections introuvables dans la migration'); process.exit(1); }
  const tete = "begin;\nset local lock_timeout = '3s';\nset local statement_timeout = '60s';\n";
  fs.mkdirSync(dossier, { recursive: true });
  const noms = ['tables et leurs droits', 'fonctions et leurs droits', 'gardes, trace, pierre tombale, réglage, horloge'];
  for (let i = 0; i < 3; i++) {
    const f = path.join(dossier, `014-morceau-${i + 1}.sql`);
    fs.writeFileSync(f, `-- Migration 014, morceau ${i + 1}/3 : ${noms[i]} (à appliquer dans l'ordre).\n` + tete + sansCommentaires(L.slice(bornes[i], bornes[i + 1]).join('\n')) + 'commit;\n');
    console.log(f + ' — ' + fs.statSync(f).size + ' octets');
  }
  process.exit(0);
}

// L'essai est jeté (ROLLBACK) : on y retire AUSSI l'indentation et les lignes de
// commentaire des corps, pour qu'il tienne dans un seul appel de l'outil SQL.
// Aucun sens n'est touché (pas de littéral sur plusieurs lignes dont
// l'indentation compterait) ; la VRAIE application, elle, garde les corps
// octet pour octet (la vérification compare leur md5 au fichier).
const lignes = sansCommentaires(sql).split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('--'));
const ib = lignes.findIndex((l) => l.trim() === 'begin;');
const ic = lignes.map((l) => l.trim()).lastIndexOf('commit;');
if (ib < 0 || ic < 0 || ic < ib) { console.error('BEGIN/COMMIT introuvables dans la migration'); process.exit(1); }
const corpsMig = lignes.slice(ib + 1, ic).join('\n');
process.stdout.write(`-- ESSAI ANNULÉ de la migration 014 (fabriqué par scripts/agent-sql/essai-annule.cjs) : RIEN ne reste après.
begin;
${corpsMig}
select ${etat} as essai;
rollback;
`);
