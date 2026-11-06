#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LES BANCS PRINCIPAUX, L'UN APRÈS L'AUTRE   —   node scripts/lancer-bancs.cjs [noms…]
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 1) Le lot de bancs que la vérification d'une PR rejoue sur
// `dist/` (déjà construit) : l'app RENDUE, à 390 et 1512 px, sur des données
// INVENTÉES (aucun de ces bancs ne lit `fx/`, les vraies données, jamais dans
// le dépôt public). Chaque banc reçoit son port (BANCS_PORT_BASE + rang, 10001
// par défaut) et une durée maximale ; le lanceur rend 1 si un banc est rouge.
//   BANCS_PORT_BASE   premier port (défaut 10000 : les bancs prennent 10001…)
//   BANCS_TIMEOUT_S   durée maximale d'un banc (défaut 1200 : nouveau-vendeur rend
//                     ~20 écrans × 2 largeurs × 2 thèmes, plus de 10 min sur une machine chargée)
//   NAVIGATEUR        chromium (défaut) ou webkit : passé aux bancs qui le
//                     savent (nouveau-vendeur, iphone-reprise, colis-retirer-propre)
// Sans argument : le lot de la CI (LOT ci-dessous).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const RACINE = path.join(__dirname, '..');
// Les parts et les durées : docs/passation/2026-11-06-filets-anti-bug.md (§1).
const LOT = ['nouveau-vendeur', 'navigation-tache', 'ventes-e2', 'colis-retirer-propre',
  'annonces-actions', 'journee-coherence', 'iphone-reprise', 'argent-mois', 'garde-ecrans', 'morceau-perime'];
const noms = process.argv.slice(2).length ? process.argv.slice(2) : LOT;
const BASE = Number(process.env.BANCS_PORT_BASE) || 10000;
const TIMEOUT_MS = (Number(process.env.BANCS_TIMEOUT_S) || 1200) * 1000;

function lancer(nom, port) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const fichier = path.join(RACINE, 'scripts', 'bancs', nom + '.cjs');
    if (!fs.existsSync(fichier)) { resolve({ nom, code: 2, ms: 0, sortie: 'banc introuvable : ' + fichier }); return; }
    const enfant = spawn(process.execPath, [fichier], {
      cwd: RACINE, env: Object.assign({}, process.env, { BANC_PORT: String(port), PORT: String(port) }), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    let sortie = '';
    const garder = (b) => { const t = b.toString(); sortie += t; process.stdout.write(t.replace(/^/gm, `[${nom}] `)); };
    enfant.stdout.on('data', garder); enfant.stderr.on('data', garder);
    let tropLong = false;
    const minuteur = setTimeout(() => { tropLong = true; try { process.kill(-enfant.pid, 'SIGKILL'); } catch (_) {} }, TIMEOUT_MS);
    enfant.on('close', (code) => { clearTimeout(minuteur); resolve({ nom, code, tropLong, ms: Date.now() - debut, sortie }); });
  });
}

(async () => {
  const res = [];
  let i = 0;
  for (const nom of noms) res.push(await lancer(nom, BASE + (++i)));
  console.log('\n── Bilan des bancs' + (process.env.NAVIGATEUR ? ` (${process.env.NAVIGATEUR})` : ''));
  for (const r of res) console.log(`${r.code === 0 && !r.tropLong ? 'OK ' : 'KO '} ${r.nom.padEnd(24)} ${(r.ms / 1000).toFixed(0).padStart(4)} s${r.tropLong ? ' (arrêté : trop long)' : r.code ? ` (code ${r.code})` : ''}`);
  const ko = res.filter((r) => r.code !== 0 || r.tropLong);
  console.log(ko.length ? `\n❌ ${ko.length} banc(s) rouge(s) : ${ko.map((r) => r.nom).join(', ')}` : '\n✅ tous les bancs du lot passent.');
  process.exit(ko.length ? 1 : 0);
})();
