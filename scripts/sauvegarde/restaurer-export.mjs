#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RESTAURER UN EXPORT QUOTIDIEN (12 nov., agent2-fiabilite-prod)
// ═══════════════════════════════════════════════════════════════════════════
// L'export : un fichier `.vrms` PAR VENDEUR et PAR JOUR, rangé par le cron dans le
// seau Supabase Storage PRIVÉ `sauvegardes` (api/_lib/sauvegarde-quotidienne.js).
// Pas-à-pas : docs/passation/2026-11-12-guide-fiabilite-julien.md (« Je veux
// récupérer des données perdues »).
//
//   Voir ce qu'il contient (rien n'est écrit nulle part) :
//     FICHIER=…/2026-11-12/<owner>.vrms CLE=… node scripts/sauvegarde/restaurer-export.mjs --liste
//   Le restaurer dans un Postgres JETABLE (sur cet ordinateur), puis comparer :
//     FICHIER=… CLE=… CIBLE_URL=postgresql://…@127.0.0.1:…/… node scripts/sauvegarde/restaurer-export.mjs
//
// CLE : la valeur de SAUVEGARDE_CLE (Vercel) si le fichier dit « cle-dediee »,
// sinon la clé de service Supabase (« cle-service »). Elle ne s'écrit jamais dans
// le chat : dans le terminal seulement.
//
// GARDE-FOUS (scripts/audit-sauvegarde-export.cjs les fait échouer exprès) :
//   · la cible doit être sur CET ordinateur (127.0.0.1, localhost, ::1) et ne
//     jamais contenir « supabase » : jamais la vraie base ;
//   · l'empreinte du fichier est recalculée AVANT d'écrire : fichier abîmé ⇒ rien ;
//   · on n'écrase rien : `on conflict do nothing` ; puis on relit la base et on
//     compare ligne à ligne (nombre ET empreinte) : un écart ⇒ code 1.
// Ensuite (hors de ce script, dans une session Claude, avec Julien) : recopier
// SEULEMENT les lignes perdues vers la vraie base, après un export frais de l'état
// actuel — jamais un écrasement.
// Codes : 0 vert · 1 écart ou refus · 2 mauvaise utilisation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dechiffrer, sourceDuFichier, empreinte, estEcartee } from '../../api/_lib/sauvegarde-quotidienne.js';

const dire = (t) => process.stdout.write(t + '\n');
const stop = (t, code = 1) => { process.stderr.write('✗ ' + t + '\n'); process.exit(code); };

export function cibleLocale(url) {
  const u = String(url || '');
  if (!u) return 'CIBLE_URL absente';
  if (/supabase/i.test(u)) return 'cible refusée : « supabase » dans l’adresse (jamais la vraie base)';
  let hote = '';
  try { hote = new URL(u.replace(/^postgres(ql)?:/, 'http:')).hostname; } catch (_) { return 'adresse illisible'; }
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hote)) return `cible refusée : ${hote} n’est pas cet ordinateur`;
  return null;
}

function psql(url, sql, extra = []) {
  const r = spawnSync(process.env.PSQL || 'psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', ...extra, '-c', sql], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.error || '').toString().slice(0, 400));
  return r.stdout;
}
function psqlFichier(url, fichier) {
  const r = spawnSync(process.env.PSQL || 'psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', fichier], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || '').toString().slice(0, 400));
}
const dollar = (texte) => { let t; do { t = '$r' + crypto.randomBytes(6).toString('hex') + '$'; } while (texte.includes(t)); return t; };

async function principal() {
  const liste = process.argv.includes('--liste');
  const fichier = process.env.FICHIER;
  if (!fichier) stop('FICHIER absent (le .vrms téléchargé)', 2);
  let buf; try { buf = fs.readFileSync(fichier); } catch (_) { stop('fichier illisible : ' + fichier, 2); }
  const source = sourceDuFichier(buf);
  if (!source) stop('ce n’est pas un export VRM (.vrms)');
  const cle = process.env.CLE || (source === 'cle-dediee' ? process.env.SAUVEGARDE_CLE : process.env.SUPABASE_SERVICE_KEY);
  if (!cle) stop(`clé absente : ce fichier est chiffré avec la ${source === 'cle-dediee' ? 'SAUVEGARDE_CLE posée sur Vercel' : 'clé de service Supabase'} (CLE=…)`, 2);
  let c; try { c = dechiffrer(buf, cle); } catch (_) { stop('déchiffrement refusé : mauvaise clé, ou fichier abîmé/modifié'); }
  if (!c || c.v !== 1 || !Array.isArray(c.lignes)) stop('forme inconnue');
  const e = empreinte(c.lignes);
  if (e !== c.empreinte || c.lignes.length !== c.n) stop('empreinte différente : fichier abîmé, rien écrit');
  dire(`Export du ${c.jour} · vendeur ${c.owner}`);
  dire(`  ${c.n} lignes · ${c.comptes.length} compte(s) Vinted (sans jeton) · ${c.ecartees.length} ligne(s) écartée(s) exprès`);
  const parRaison = {};
  for (const x of c.ecartees) parRaison[x.raison] = (parRaison[x.raison] || 0) + 1;
  if (c.ecartees.length) dire('  écartées : ' + Object.entries(parRaison).map(([k, v]) => `${v} ${k}`).join(' · ') + ' (recaptées par l’extension, ou PDF lourds)');
  dire('  ✓ empreinte vérifiée');
  if (liste) return 0;

  const refus = cibleLocale(process.env.CIBLE_URL);
  if (refus) stop(refus);
  const url = process.env.CIBLE_URL;
  // Écrire : un seul fichier SQL, données en JSON dollar-quoté, rien écrasé.
  const lignes = JSON.stringify(c.lignes.filter((l) => !estEcartee(l.id)));
  const comptes = JSON.stringify(c.comptes || []);
  const t1 = dollar(lignes), t2 = dollar(comptes);
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-restaure-'));
  const sql = path.join(dossier, 'restaure.sql');
  fs.writeFileSync(sql, `begin;
insert into public.app_data(owner, id, data, updated_at)
  select '${c.owner}'::uuid, r.id, r.data, coalesce(r.updated_at, now())
  from jsonb_to_recordset(${t1}${lignes}${t1}::jsonb) as r(id text, data jsonb, updated_at timestamptz)
  on conflict (owner, id) do nothing;
insert into public.vinted_accounts(id, vinted_user_id, login, owner, updated_at)
  select r.id, r.vinted_user_id, r.login, r.owner, coalesce(r.updated_at, now())
  from jsonb_to_recordset(${t2}${comptes}${t2}::jsonb) as r(id bigint, vinted_user_id text, login text, owner uuid, updated_at timestamptz)
  on conflict do nothing;
commit;
`);
  try { psqlFichier(url, sql); } catch (err) { fs.rmSync(dossier, { recursive: true, force: true }); stop('écriture refusée par la base jetable : ' + err.message); }
  fs.rmSync(dossier, { recursive: true, force: true });
  // Relire et comparer : nombre ET empreinte, ligne à ligne.
  const relu = JSON.parse(psql(url, `select coalesce(json_agg(json_build_object('id', id, 'data', data) order by id), '[]') from public.app_data where owner = '${c.owner}'::uuid`) || '[]');
  const attendu = new Map(c.lignes.map((l) => [l.id, l]));
  const manque = c.lignes.filter((l) => !relu.some((r) => r.id === l.id)).map((l) => l.id);
  const differe = relu.filter((r) => attendu.has(r.id) && JSON.stringify(r.data) !== JSON.stringify(attendu.get(r.id).data)).map((r) => r.id);
  const memes = relu.filter((r) => attendu.has(r.id));
  if (manque.length || differe.length || empreinte(memes) !== c.empreinte) {
    stop(`écart après restauration : ${manque.length} manquante(s), ${differe.length} différente(s) (déjà présentes dans la cible ?)`);
  }
  dire(`  ✓ restauré dans la base jetable : ${memes.length}/${c.n} lignes, empreinte identique`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) principal().then((c) => process.exit(c)).catch((e) => stop(String((e && e.message) || e)));
