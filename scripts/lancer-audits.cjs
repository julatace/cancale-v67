#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUS LES AUDITS, EN PARALLÈLE BORNÉ   —   node scripts/lancer-audits.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 1 « CI qui bloque ») Julien : « que proposes-tu de plus pour
// que l'application ne bug jamais ». Les ~300 `scripts/audit-*.cjs` existaient,
// mais rien ne les lançait avant une fusion : chaque session lançait « les
// siens ». Ce lanceur les passe TOUS, quelques-uns à la fois, chacun borné dans
// le temps, et rend un code de sortie :
//   0  tout est vert (ou rouge CONNU, listé dans scripts/audits-exceptions.json)
//   1  au moins un audit rouge ou trop long qui n'est pas une exception
// Une exception reste LANCÉE et rapportée (« rouge connu ») : le jour où elle
// repasse au vert, le lanceur le dit (« exception à retirer ») sans échouer.
// Une exception qui n'est plus un fichier d'audit fait échouer : une liste
// d'exceptions qui pourrit ne protège plus rien.
//
// Réglages (variables d'environnement) :
//   AUDITS_PARALLELE   nombre d'audits à la fois (défaut : nombre de cœurs, au plus 8)
//   AUDITS_TIMEOUT_S   durée maximale d'UN audit, en secondes (défaut 900 : audit-renum-b a pris 7 min seul ici)
//   AUDITS_FILTRE      expression régulière sur le nom (ex. « urssaf|colis »)
//   AUDITS_PART        « k/n » : seulement la k-ième part sur n (les jobs CI
//                      parallèles) ; les audits LONGS sont répartis d'abord
//   AUDITS_JSON        chemin d'un rapport JSON (durées, codes) à écrire
//
// Rien n'est écrit dans la base : les audits lisent le code (ceux qui touchent
// l'extension exécutent le vrai background.js dans une VM). Certains
// régénèrent des zips dans public/ : le lanceur le SIGNALE à la fin (le job CI
// remet public/ comme il était, `git checkout -- public/`).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const EXCEPTIONS_FICHIER = path.join(__dirname, 'audits-exceptions.json');
const PARALLELE = Math.max(1, Number(process.env.AUDITS_PARALLELE) || Math.min(8, os.cpus().length || 2));
const TIMEOUT_MS = Math.max(10, Number(process.env.AUDITS_TIMEOUT_S) || 900) * 1000;
// Les audits les plus longs (mesurés le 6 nov., 4 à la fois : 2 à 4 min, une
// base Postgres jetable pour plusieurs) : lancés EN PREMIER et répartis entre
// les parts, pour qu'aucune part ne les porte tous.
const LOURDS = ['audit-renum-b.cjs', 'audit-agent-sql.cjs', 'audit-rappel-urssaf.cjs', 'audit-vc-publier.cjs',
  'audit-bilan-semaine.cjs', 'audit-communaute-sql.cjs', 'audit-suivi-colis.cjs', 'audit-tdz.cjs',
  'audit-accompagnement-sql.cjs', 'audit-equipe-sql.cjs', 'audit-confidentialite-sql.cjs', 'audit-garde-numeros-rapide.cjs'];
const PART = (() => { const m = /^(\d+)\/(\d+)$/.exec(String(process.env.AUDITS_PART || '')); return m && +m[1] >= 1 && +m[1] <= +m[2] ? { k: +m[1], n: +m[2] } : null; })();
const FILTRE = process.env.AUDITS_FILTRE ? new RegExp(process.env.AUDITS_FILTRE) : null;

function lireExceptions() {
  if (!fs.existsSync(EXCEPTIONS_FICHIER)) return {};
  const brut = JSON.parse(fs.readFileSync(EXCEPTIONS_FICHIER, 'utf8'));
  const liste = Array.isArray(brut.exceptions) ? brut.exceptions : [];
  const out = {};
  for (const e of liste) {
    if (!e || !e.audit || !e.raison || !e.depuis) throw new Error('exception mal formée (audit, raison, depuis exigés) : ' + JSON.stringify(e));
    out[e.audit] = e;
  }
  return out;
}

function lancer(fichier) {
  return new Promise((resolve) => {
    const debut = Date.now();
    // Un groupe de processus à lui : à l'échéance, l'audit ET ses enfants partent.
    const enfant = spawn(process.execPath, [path.join('scripts', fichier)], {
      cwd: RACINE, env: Object.assign({}, process.env, { FORCE_COLOR: '0' }), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    let sortie = '';
    const garder = (b) => { sortie += b.toString(); if (sortie.length > 200000) sortie = sortie.slice(-200000); };
    enfant.stdout.on('data', garder); enfant.stderr.on('data', garder);
    let tropLong = false;
    // SIGTERM d'abord (l'audit peut arrêter sa base jetable), SIGKILL 10 s après.
    const tuer = (sig) => { try { process.kill(-enfant.pid, sig); } catch (_) { try { enfant.kill(sig); } catch (__) {} } };
    let dernier = null;
    const minuteur = setTimeout(() => { tropLong = true; tuer('SIGTERM'); dernier = setTimeout(() => tuer('SIGKILL'), 10000); }, TIMEOUT_MS);
    enfant.on('close', (code) => {
      clearTimeout(minuteur); if (dernier) clearTimeout(dernier);
      resolve({ fichier, code, tropLong, ms: Date.now() - debut, sortie });
    });
  });
}

async function main() {
  const exceptions = lireExceptions();
  const tous = fs.readdirSync(path.join(RACINE, 'scripts')).filter((f) => /^audit-.*\.cjs$/.test(f)).sort();
  const filtres = FILTRE ? tous.filter((f) => FILTRE.test(f)) : tous;
  const ordonnes = [...LOURDS.filter((f) => filtres.includes(f)), ...filtres.filter((f) => !LOURDS.includes(f))];
  const choisis = PART ? ordonnes.filter((_, i) => i % PART.n === PART.k - 1) : ordonnes;
  const orphelines = Object.keys(exceptions).filter((a) => !tous.includes(a));
  console.log(`${choisis.length} audits${PART ? ` (part ${PART.k}/${PART.n})` : ''}, ${PARALLELE} à la fois, ${TIMEOUT_MS / 1000} s au plus chacun.`);
  const debut = Date.now();
  const resultats = [];
  let i = 0;
  const ouvrier = async () => {
    while (i < choisis.length) {
      const f = choisis[i++];
      const r = await lancer(f);
      const ok = r.code === 0 && !r.tropLong;
      const exc = exceptions[f];
      r.etat = ok ? (exc ? 'exception-verte' : 'vert') : (exc ? 'rouge-connu' : (r.tropLong ? 'trop-long' : 'rouge'));
      resultats.push(r);
      const marque = { vert: 'OK ', 'exception-verte': 'OK*', 'rouge-connu': 'KO*', 'trop-long': 'TPS', rouge: 'KO ' }[r.etat];
      console.log(`${marque} ${f.padEnd(44)} ${(r.ms / 1000).toFixed(1).padStart(6)} s`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLELE, choisis.length) }, ouvrier));
  // Un audit rouge est relancé UNE fois, SEUL : quelques audits mesurent une
  // durée (« une frappe sur 10 500 entrées : < N ms ») et rougissent quand
  // quatre autres tournent à côté. Vert seul ⇒ « instable », dit, pas bloquant ;
  // rouge seul ⇒ rouge pour de bon.
  for (const r of resultats.filter((x) => x.etat === 'rouge' || x.etat === 'trop-long')) {
    const r2 = await lancer(r.fichier);
    if (r2.code === 0 && !r2.tropLong) { r.etat = 'instable'; r.ms2 = r2.ms; console.log(`OK~ ${r.fichier.padEnd(44)} vert au second essai, seul (${(r2.ms / 1000).toFixed(1)} s)`); }
    else Object.assign(r, { code: r2.code, tropLong: r2.tropLong, sortie: r2.sortie, etat: r2.tropLong ? 'trop-long' : 'rouge' });
  }
  const total = ((Date.now() - debut) / 1000).toFixed(0);

  const rouges = resultats.filter((r) => r.etat === 'rouge' || r.etat === 'trop-long');
  const instables = resultats.filter((r) => r.etat === 'instable');
  for (const r of rouges) {
    console.log('\n──────── ' + r.fichier + (r.tropLong ? ` (arrêté après ${TIMEOUT_MS / 1000} s)` : ` (code ${r.code})`) + ' ────────');
    // Les lignes rouges d'abord, puis la fin de la sortie : c'est là que l'audit dit pourquoi.
    const lignes = r.sortie.split('\n');
    const ko = lignes.filter((l) => /❌|KO|ROUGE|Error|échec/i.test(l)).slice(0, 25);
    console.log(ko.join('\n'));
    console.log('…\n' + lignes.slice(-15).join('\n'));
  }
  const connus = resultats.filter((r) => r.etat === 'rouge-connu');
  const aRetirer = resultats.filter((r) => r.etat === 'exception-verte');
  const lents = resultats.slice().sort((a, b) => b.ms - a.ms).slice(0, 8);

  console.log(`\n${resultats.length} audits en ${total} s · ${resultats.filter((r) => r.etat === 'vert').length} verts · ${instables.length} instables · ${rouges.length} rouges · ${connus.length} rouges connus`);
  console.log('Les plus longs : ' + lents.map((r) => `${r.fichier.replace(/^audit-|\.cjs$/g, '')} ${(r.ms / 1000).toFixed(0)} s`).join(', '));
  for (const r of instables) console.log(`  instable : ${r.fichier} — rouge en parallèle, vert seul (une mesure de durée ?)`);
  for (const r of connus) console.log(`  rouge connu : ${r.fichier} — ${exceptions[r.fichier].raison} (depuis le ${exceptions[r.fichier].depuis})`);
  for (const r of aRetirer) console.log(`  ⚠️ exception à retirer de scripts/audits-exceptions.json : ${r.fichier} est VERT`);
  for (const o of orphelines) console.log(`  ❌ exception sans audit (fichier renommé ou retiré ?) : ${o}`);

  // Les audits qui régénèrent un zip : dit, jamais bloquant (le job remet public/).
  try {
    const modifs = execSync('git status --porcelain -- public/', { cwd: RACINE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (modifs) console.log('\nℹ️ des audits ont réécrit public/ (zips régénérés) — `git checkout -- public/` les remet :\n' + modifs);
  } catch (_) {}

  if (process.env.AUDITS_JSON) {
    fs.writeFileSync(process.env.AUDITS_JSON, JSON.stringify(resultats.map((r) => ({ audit: r.fichier, etat: r.etat, code: r.code, ms: r.ms })), null, 1));
  }
  const echec = rouges.length > 0 || orphelines.length > 0;
  console.log(echec ? '\n❌ des audits sont rouges : la fusion attend.' : '\n✅ tous les audits passent (hors rouges connus, listés ci-dessus).');
  process.exit(echec ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
