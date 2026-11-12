#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PRÉPARER LA BASE D'ESSAI « vrm-essai » — node scripts/essai/appliquer-migrations.mjs
// ═══════════════════════════════════════════════════════════════════════════
// (12 nov., agent2-fiabilite-prod) Applique, DANS L'ORDRE, le socle
// (supabase/essai/000-socle.sql) puis chaque supabase/migrations/*.sql à une
// base d'essai VIDE. Aucune donnée réelle : rien n'est copié de la vraie base.
// Lancé par Julien depuis GitHub (Actions → « Préparer la base d'essai »,
// .github/workflows/base-essai.yml) ; pas-à-pas :
// docs/passation/2026-11-12-guide-fiabilite-julien.md.
//
// GARDE-FOUS (scripts/audit-base-essai.cjs les fait échouer exprès) :
//   · l'adresse de la VRAIE base est refusée (sa référence `lgonxzrzjcqthjtbdpzo`),
//     avant toute connexion ;
//   · une base qui porte déjà des lignes dans `app_data` est refusée (ce n'est
//     pas une base d'essai neuve, ou ce sont des données) ;
//   · chaque migration passe dans SA transaction, notée dans `vrm_essai.migrations`
//     (relancé : seules les nouvelles passent) ; une qui échoue arrête tout et
//     est NOMMÉE ;
//   · les gestes à la main des toutes premières migrations (coller un UID) sont
//     remplacés par un UID neutre ou ESSAI_PROPRIETAIRE (le compte d'essai).
// Entrées : ESSAI_DB_URL (« Session pooler » du projet vrm-essai), PSQL, ESSAI_PROPRIETAIRE.
// Codes : 0 à jour · 1 refus ou migration en échec · 2 mauvaise utilisation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..', '..');
export const REF_PRODUCTION = 'lgonxzrzjcqthjtbdpzo';
const NEUTRE = '00000000-0000-0000-0000-000000000000';

export function refusCible(url) {
  const u = String(url || '');
  if (!u) return 'ESSAI_DB_URL absente (l’adresse « Session pooler » du projet vrm-essai)';
  if (u.includes(REF_PRODUCTION)) return 'c’est l’adresse de la VRAIE base : refusé (jamais d’essai sur la production)';
  if (!/^postgres(ql)?:\/\//.test(u)) return 'adresse illisible (elle commence par postgresql://)';
  return null;
}
const DOSSIER_MIGRATIONS = process.env.ESSAI_MIGRATIONS || path.join(RACINE, 'supabase', 'migrations');   // (l'audit pose une copie)
export function listeMigrations(dossier = DOSSIER_MIGRATIONS) {
  return fs.readdirSync(dossier).filter((f) => /^\d{3}[-_].*\.sql$/.test(f)).sort();
}
// Les gestes à la main des premières migrations, rendus sans objet sur une base vide.
export function preparer(nom, sql, proprietaire) {
  const uid = /^[0-9a-f-]{36}$/i.test(String(proprietaire || '')) ? proprietaire : NEUTRE;
  // `concurrently` ne passe pas dans une transaction ; sur une base VIDE il n'apporte rien.
  return sql.replace(/\b(index)\s+concurrently\b/gi, '$1')
    .replace(/METS-TON-UID-ICI/g, uid).replace(/<UID_JULIEN>/g, uid).replace(/74eea6e7-f060-46b6-b9c7-d500cedf4738/g, uid);
}

function psql(url, args, entree) {
  const r = spawnSync(process.env.PSQL || 'psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input: entree, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || (r.error && r.error.message) || '').trim() };
}

export async function principal() {
  const url = process.env.ESSAI_DB_URL;
  const refus = refusCible(url);
  if (refus) { console.log('✗ ' + refus); return refus.includes('absente') ? 2 : 1; }
  const v = psql(url, ['-At', '-c', 'select 1']);
  if (!v.ok) { console.log('✗ La base d’essai ne répond pas : ' + v.err.split('\n')[0].slice(0, 200)); return 1; }
  const existe = psql(url, ['-At', '-c', "select to_regclass('public.app_data') is not null"]);
  const lignes = existe.ok && existe.out === 'f' ? { ok: true, out: '0' } : psql(url, ['-At', '-c', 'select count(*) from public.app_data']);
  if (!lignes.ok) { console.log('✗ Lecture impossible : ' + lignes.err.slice(0, 200)); return 1; }
  if (Number(lignes.out) > 0) { console.log(`✗ Cette base porte déjà ${lignes.out} ligne(s) dans app_data : ce n’est pas une base d’essai neuve. Rien n’est fait.`); return 1; }
  const init = psql(url, ['-c', 'create schema if not exists vrm_essai; create table if not exists vrm_essai.migrations (nom text primary key, appliquee_le timestamptz not null default now());']);
  if (!init.ok) { console.log('✗ ' + init.err.slice(0, 200)); return 1; }
  const faites = new Set(psql(url, ['-At', '-c', 'select nom from vrm_essai.migrations']).out.split('\n').filter(Boolean));
  const etapes = [['000-socle.sql', path.join(RACINE, 'supabase', 'essai', '000-socle.sql')], ...listeMigrations().map((f) => [f, path.join(DOSSIER_MIGRATIONS, f)])];
  let n = 0;
  for (const [nom, fichier] of etapes) {
    if (faites.has(nom)) continue;
    // Un pont `supabase/essai/avant-<migration>` pose d'abord ce que la vraie base avait reçu À LA MAIN.
    const pont = path.join(RACINE, 'supabase', 'essai', 'avant-' + nom);
    const sql = (fs.existsSync(pont) ? fs.readFileSync(pont, 'utf8') + '\n' : '') + preparer(nom, fs.readFileSync(fichier, 'utf8'), process.env.ESSAI_PROPRIETAIRE);
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-essai-')), nom);
    fs.writeFileSync(tmp, `begin;\n${sql}\n;\ninsert into vrm_essai.migrations(nom) values ('${nom.replace(/'/g, "''")}');\ncommit;\n`);
    const r = psql(url, ['-f', tmp]);
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    if (!r.ok) { console.log(`✗ ${nom} : ${r.err.split('\n').filter((l) => /ERROR|ERREUR/.test(l))[0] || r.err.slice(0, 300)}`); console.log(`  ${n} migration(s) appliquée(s) avant l’arrêt ; relancer reprend à ${nom}.`); return 1; }
    console.log(`✓ ${nom}`); n++;
  }
  console.log(n ? `✓ Base d’essai à jour : ${n} migration(s) appliquée(s), ${etapes.length} en tout.` : `✓ Base d’essai déjà à jour (${etapes.length} migrations).`);
  return 0;
}
if (import.meta.url === `file://${process.argv[1]}`) principal().then((c) => process.exit(c));
