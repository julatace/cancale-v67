// scripts/tests/rls-migrations.test.mjs — revue défensive du 9 nov. (multi-vendeurs)
// ────────────────────────────────────────────────────────────────────────────
// Raisonne sur `supabase/migrations/*.sql` SANS base (statique) : ce que les
// fichiers du dépôt garantissent pour qu'un vendeur ne voie JAMAIS les lignes
// d'un autre. La vraie base se vérifie à part, en LECTURE SEULE (requêtes dans
// docs/passation/2026-11-09-securite.md) : un fichier peut ne pas avoir été passé.
//
// Règles vérifiées :
//  1. toute table créée dans `public` a RLS activée (directement ou par boucle) ;
//  2. toute fonction SECURITY DEFINER fixe son `search_path` ;
//  3. toute fonction SECURITY DEFINER de `public` est retirée à PUBLIC (le droit
//     par défaut de Postgres l'ouvre à anon) — explicitement ou par une boucle
//     `revoke … %s from public` qui la nomme ;
//  4. une fonction SECURITY DEFINER rendue à `anon`/`authenticated` qui prend un
//     identifiant (uuid) contrôle son appelant (`auth.uid()` dans son corps, ou
//     une aide qui le fait) — sinon n'importe quel connecté lirait un autre vendeur ;
//  5. une fonction qui prend le vendeur EN PARAMÈTRE (`p_user`, `p_owner`,
//     `p_vendeur` sans `auth.uid()`) n'est rendue qu'à `service_role` ;
//  6. aucune politique PERMISSIVE `using (true)` pour anon/authenticated sur une
//     table à propriétaire ; aucune écriture rendue à `anon` ;
//  7. `app_data` et `vinted_accounts` : verrou anon (021), règles par
//     `owner = auth.uid()`, et `owner` obligatoire (002).
// Mode `--prouve` : chaque règle est réaffaiblie dans une copie en mémoire des
// migrations ; le contrôle doit alors ÉCHOUER (un contrôle qui ne peut pas
// échouer est pire qu'absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER = path.resolve(ICI, '../../supabase/migrations');

export function lireMigrations(dossier = DOSSIER) {
  return fs.readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => ({ f, sql: sansCommentaires(fs.readFileSync(path.join(dossier, f), 'utf8')) }));
}
// Retire les commentaires `-- …` hors chaînes (assez pour ces fichiers).
function sansCommentaires(s) {
  return s.split('\n').map((l) => {
    let dansChaine = false;
    for (let i = 0; i < l.length; i++) {
      if (l[i] === "'") dansChaine = !dansChaine;
      if (!dansChaine && l[i] === '-' && l[i + 1] === '-') return l.slice(0, i);
    }
    return l;
  }).join('\n');
}

// Les fonctions : nom, arguments, en-tête (jusqu'à `as $$`), corps.
export function fonctions(fichiers) {
  const out = [];
  const re = /create\s+(?:or\s+replace\s+)?function\s+([a-z_]+)\.([a-z0-9_]+)\s*\(([^)]*)\)([\s\S]*?)\bas\s+\$(\w*)\$([\s\S]*?)\$\5\$/gi;
  for (const { f, sql } of fichiers) {
    let m;
    while ((m = re.exec(sql))) {
      out.push({ f, schema: m[1].toLowerCase(), nom: m[2].toLowerCase(), args: m[3], entete: m[4], corps: m[6] });
    }
  }
  return out;
}
const tout = (fichiers) => fichiers.map((x) => x.sql).join('\n;\n');

// Une fonction est retirée à PUBLIC si une ligne `revoke … on function <nom>(… from public…`
// existe, ou si son nom est dans un bloc qui exécute `revoke all on function %s from public`.
function retireePublic(nom, sql) {
  const ligne = new RegExp(`revoke\\s+(?:all|execute)[^;]*on\\s+function\\s+(?:public\\.)?${nom}\\s*\\([^;]*from\\s+public\\b`, 'i');
  if (ligne.test(sql)) return true;
  const blocs = sql.match(/do\s+\$\$[\s\S]*?\$\$/gi) || [];
  return blocs.some((b) => /revoke\s+all\s+on\s+function\s+%s\s+from\s+public/i.test(b) && new RegExp(`'${nom}'`, 'i').test(b));
}
function rendueA(nom, sql) {
  const roles = new Set();
  const re = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+(?:public\\.)?${nom}\\s*\\([^)]*\\)\\s+to\\s+([^;]+);`, 'gi');
  let m;
  while ((m = re.exec(sql))) for (const r of m[1].split(',')) roles.add(r.trim().toLowerCase());
  return roles;
}
// Aides qui contrôlent l'appelant par elles-mêmes (elles lisent `auth.uid()`).
function controleAppelant(fn, toutes) {
  if (/auth\.uid\(\)/i.test(fn.corps)) return true;
  const aides = toutes.filter((g) => g !== fn && /auth\.uid\(\)/i.test(g.corps)).map((g) => g.nom);
  return aides.some((a) => new RegExp(`public\\.${a}\\s*\\(`, 'i').test(fn.corps));
}

export function verifier(fichiers) {
  const rouges = [];
  const sql = tout(fichiers);
  // 1. Tables de public : RLS activée.
  const tables = new Set();
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)) tables.add(m[1].toLowerCase());
  for (const t of tables) {
    const direct = new RegExp(`alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql);
    const boucle = (sql.match(/do\s+\$\$[\s\S]*?\$\$/gi) || []).some((b) => /enable\s+row\s+level\s+security/i.test(b) && new RegExp(`'${t}'`, 'i').test(b));
    if (!direct && !boucle) rouges.push(`1. table public.${t} : RLS jamais activée`);
  }
  // 2-5. Fonctions.
  const fns = fonctions(fichiers);
  // La DERNIÈRE définition fait foi (create or replace).
  const parNom = new Map();
  for (const fn of fns) parNom.set(`${fn.schema}.${fn.nom}(${fn.args.replace(/\s+/g, ' ').trim()})`, fn);
  const dernieres = [...parNom.values()];
  for (const fn of dernieres) {
    const definer = /security\s+definer/i.test(fn.entete);
    if (!definer) continue;
    if (!/set\s+search_path\s*(=|to)/i.test(fn.entete)) rouges.push(`2. ${fn.schema}.${fn.nom} (${fn.f}) : SECURITY DEFINER sans search_path fixé`);
    if (fn.schema !== 'public') continue;
    if (/returns\s+trigger/i.test(fn.entete)) continue;   // un déclencheur ne s'appelle pas par l'API
    if (!retireePublic(fn.nom, sql)) rouges.push(`3. public.${fn.nom} (${fn.f}) : SECURITY DEFINER jamais retirée à PUBLIC (ouverte à anon par défaut)`);
    const roles = rendueA(fn.nom, sql);
    const ouverte = roles.has('anon') || roles.has('authenticated') || roles.has('public');
    const prendUnId = /\buuid\b/i.test(fn.args);
    if (ouverte && prendUnId && !controleAppelant(fn, dernieres)) rouges.push(`4. public.${fn.nom} (${fn.f}) : rendue à ${[...roles].join('/')} avec un uuid en paramètre, sans contrôle de l'appelant`);
    const vendeurEnParam = /\bp_(user|owner|vendeur|uid)\b/i.test(fn.args) && !controleAppelant(fn, dernieres);
    if (vendeurEnParam && ouverte) rouges.push(`5. public.${fn.nom} (${fn.f}) : le vendeur vient du PARAMÈTRE et la fonction est rendue à ${[...roles].join('/')}`);
  }
  // 6. Politiques permissives ouvertes, écritures à anon.
  for (const m of sql.matchAll(/create\s+policy\s+("[^"]+"|[a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)([^;]*);/gi)) {
    const corps = m[3];
    if (/as\s+restrictive/i.test(corps)) continue;
    const pourQui = /\bto\s+([a-z_, ]+?)(?:\s+using|\s+with|$)/i.exec(corps);
    const roles = pourQui ? pourQui[1] : 'public';
    if (/using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(corps) && /(anon|authenticated|public)/i.test(roles)) {
      rouges.push(`6. politique ${m[1]} sur public.${m[2]} : PERMISSIVE et ouverte à tous (using/with check true)`);
    }
  }
  for (const m of sql.matchAll(/grant\s+([a-z, ]+)\s+on\s+(?:table\s+)?public\.([a-z0-9_]+)\s+to\s+([^;]+);/gi)) {
    if (/\banon\b/i.test(m[3]) && /(insert|update|delete|all)/i.test(m[1])) rouges.push(`6. écriture rendue à anon sur public.${m[2]}`);
  }
  // 7. Les deux tables des données des vendeurs.
  for (const t of ['app_data', 'vinted_accounts']) {
    if (!/create\s+policy\s+vrm_anon_ferme\s+on\s+public\.%I\s+as\s+restrictive\s+for\s+all\s+to\s+anon\s+using\s*\(\s*false\s*\)/i.test(sql)) { rouges.push(`7. ${t} : verrou anon (vrm_anon_ferme, 021) absent`); break; }
    if (!new RegExp(`alter\\s+table\\s+public\\.${t}\\s+alter\\s+column\\s+owner\\s+set\\s+not\\s+null`, 'i').test(sql)) rouges.push(`7. ${t} : owner pas obligatoire`);
    const pol = [...sql.matchAll(new RegExp(`create\\s+policy\\s+("[^"]+"|[a-z0-9_]+)\\s+on\\s+public\\.${t}\\b([^;]*);`, 'gi'))];
    for (const p of pol) {
      if (/as\s+restrictive/i.test(p[2])) continue;
      if (!/owner\s*=\s*\(?\s*(select\s+)?auth\.uid\(\)|vrm_equipe_vendeur\(\)/i.test(p[2])) rouges.push(`7. ${t} : politique permissive ${p[1]} sans owner = auth.uid()`);
    }
  }
  return rouges;
}

test('les migrations cloisonnent les vendeurs (RLS, droits, SECURITY DEFINER)', () => {
  const rouges = verifier(lireMigrations());
  assert.deepEqual(rouges, [], 'défauts :\n  ' + rouges.join('\n  '));
});

// La preuve : chaque règle réaffaiblie ⇒ le contrôle rougit.
const MUTATIONS = [
  ['1. table sans RLS', (s) => s + '\ncreate table if not exists public.vrm_fuite (owner uuid, x text);\n'],
  ['2. definer sans search_path', (s) => s + "\ncreate or replace function public.vrm_m2() returns int language sql security definer as $$ select 1 $$;\nrevoke all on function public.vrm_m2() from public;\n"],
  ['3. definer ouverte à PUBLIC', (s) => s.replace(/revoke all on function public\.vrm_sessions_de\(uuid\) from public, anon, authenticated;/, '')],
  ['4. uuid sans contrôle d’appelant', (s) => s + "\ncreate or replace function public.vrm_m4(p_x uuid) returns jsonb language sql stable security definer set search_path = '' as $$ select to_jsonb(a) from public.app_data a where a.owner = p_x $$;\nrevoke all on function public.vrm_m4(uuid) from public;\ngrant execute on function public.vrm_m4(uuid) to authenticated;\n"],
  ['5. vendeur en paramètre rendu aux connectés', (s) => s.replace(/grant execute on function public\.vrm_sessions_de\(uuid\) to service_role;/, 'grant execute on function public.vrm_sessions_de(uuid) to authenticated;')],
  ['6. politique permissive ouverte', (s) => s + '\ncreate policy tout_lire on public.app_data for select to authenticated using (true);\n'],
  ['6b. écriture rendue à anon', (s) => s + '\ngrant insert on public.app_data to anon;\n'],
  ['7. verrou anon retiré', (s) => s.replace(/as restrictive for all to anon using \(false\)/, 'as restrictive for all to anon using (true)')],
];
test('--prouve : chaque affaiblissement est vu', () => {
  const base = lireMigrations();
  for (const [nom, muter] of MUTATIONS) {
    // Une mutation « remplace » change le fichier qui porte le motif ; une
    // mutation « ajoute » (le texte ne change dans aucun fichier) va au dernier.
    const muté = base.map((x) => ({ ...x, sql: muter(x.sql) }));
    const change = muté.filter((x, i) => x.sql !== base[i].sql && x.sql.startsWith(base[i].sql) === false);
    const final = change.length ? muté : base.map((x, i) => (i === base.length - 1 ? { ...x, sql: muter(x.sql) } : x));
    assert.ok(final.some((x, i) => x.sql !== base[i].sql), `la mutation « ${nom} » ne s'applique à rien`);
    const rouges = verifier(final);
    assert.ok(rouges.length > 0, `la mutation « ${nom} » n'a fait rougir aucun contrôle`);
  }
});
