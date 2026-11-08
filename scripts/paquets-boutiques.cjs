#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES PAQUETS DES BOUTIQUES (8 nov.) — Chrome Web Store, Microsoft Edge
//  Add-ons, Firefox (addons.mozilla.org)
//
//  Julien : « fais tout » — que les vendeurs installent l'extension depuis une
//  boutique officielle et reçoivent ses MISES À JOUR toutes seules (le 8 nov.
//  son iPhone tournait encore en 5.322 : le zip ne se met jamais à jour seul).
//
//  Fabrique, depuis `vinted-sync-extension/` et SANS RIEN Y CHANGER :
//    VRM-<version>-chrome.zip   Chrome Web Store (et Brave, Vivaldi, Arc)
//    VRM-<version>-edge.zip     Microsoft Edge Add-ons (même contenu que chrome)
//    VRM-<version>-firefox.zip  addons.mozilla.org (ordinateur ET Android, Orion)
//  dans `dist/boutiques/` (hors du dépôt) ou le dossier donné par `--sortie`.
//
//  Les boutiques veulent `manifest.json` À LA RACINE du zip (jamais le dossier
//  `VRM-extension/` de public/VRM-extension.zip, §2.6, qui sert l'installation
//  à la main). README.md n'y va pas (documentation interne).
//  Firefox : le manifeste adapté par `manifesteFirefox` (scripts/zip-extension.cjs
//  — `browser_specific_settings.gecko.id` = vrm@vrm.center, définitif ;
//  `data_collection_permissions` ; page de fond au lieu du service worker) et
//  `compat-firefox.js` devant chaque script. Le code, lui, est le même octet
//  pour octet : `scripts/audit-paquets-boutiques.cjs` le vérifie contre la
//  version SERVIE (public/VRM-extension.zip).
//
//  Les fichiers portent une date fixe : deux fabrications du même code donnent
//  le même zip (une boutique qui reçoit deux fois la même version reçoit les
//  mêmes octets).
//    node scripts/paquets-boutiques.cjs [--sortie dossier]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const Z = require('./zip-extension.cjs');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'vinted-sync-extension');
const DATE_FIXE = new Date('2026-01-01T00:00:00Z');
const HORS_PAQUET = new Set(['README.md']);
const BOUTIQUES = [
  { id: 'chrome', nom: 'Chrome Web Store', moteur: 'chromium' },
  { id: 'edge', nom: 'Microsoft Edge Add-ons', moteur: 'chromium' },
  { id: 'firefox', nom: 'Firefox (addons.mozilla.org)', moteur: 'firefox' },
];

function dater(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const f = path.join(dossier, e.name);
    if (e.isDirectory()) dater(f);
    fs.utimesSync(f, DATE_FIXE, DATE_FIXE);
  }
  fs.utimesSync(dossier, DATE_FIXE, DATE_FIXE);
}

// Prépare le DOSSIER d'une boutique (ce qui sera zippé, manifeste à la racine).
function preparerDossier(moteur, source, dest) {
  fs.cpSync(source, dest, { recursive: true });
  for (const f of HORS_PAQUET) fs.rmSync(path.join(dest, f), { force: true });
  if (moteur === 'firefox') {
    fs.copyFileSync(path.join(__dirname, 'extension-firefox', Z.COMPAT), path.join(dest, Z.COMPAT));
    const m = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
    fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(Z.manifesteFirefox(m), null, 2) + '\n');
    Z.compatDansPopup(dest);
  }
  Z.preparerArchive(dest);
  dater(dest);
}

function fabriquer({ sortie = path.join(RACINE, 'dist', 'boutiques'), source = SOURCE } = {}) {
  const version = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8')).version;
  fs.mkdirSync(sortie, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-boutiques-'));
  const faits = [];
  try {
    for (const b of BOUTIQUES) {
      const d = path.join(tmp, b.id);
      preparerDossier(b.moteur, source, d);
      const zip = path.join(sortie, `VRM-${version}-${b.id}.zip`);
      fs.rmSync(zip, { force: true });
      const fichiers = fs.readdirSync(d).sort();
      execFileSync('zip', ['-qrX', zip, ...fichiers], { cwd: d, env: { ...process.env, TZ: 'UTC' } });
      faits.push({ ...b, version, zip });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return faits;
}

module.exports = { fabriquer, preparerDossier, BOUTIQUES, HORS_PAQUET };

if (require.main === module) {
  const a = process.argv.slice(2);
  const i = a.indexOf('--sortie');
  const sortie = i >= 0 ? path.resolve(a[i + 1] || '') : undefined;
  for (const f of fabriquer(sortie ? { sortie } : {})) console.log(`✓ ${path.relative(process.cwd(), f.zip)}  →  ${f.nom}`);
  console.log('Vérifier avant d’envoyer : node scripts/audit-paquets-boutiques.cjs');
}
