// ════════════════════════════════════════════════════════════════════════════
//  COPIE D'UN ARBRE POUR UN AUDIT : LES IMPORTS QUI MANQUENT (16 nov., audits-vert-main)
//  Plusieurs audits copient api/_lib (et quelques fichiers de src/) dans un dossier
//  jetable, appliquent une mutation, puis importent. Le jour où une règle du serveur
//  importe une règle de l'app (`api/_lib/argent-notif.js` → `src/alertesSeuils.js`,
//  15 nov.), la copie ne se charge plus : « Cannot find module ». Ce n'est pas un
//  défaut de l'app (Vercel suit les imports), c'est la copie qui est incomplète.
//
//    const { completerImports } = require('./_copie-imports.cjs');
//    completerImports(RACINE, dossier);   // après les copies (et les mutations)
//
//  Ne copie QUE ce qui manque dans le dossier (un fichier déjà copié, peut-être muté,
//  n'est jamais réécrit), en suivant les imports relatifs, de proche en proche.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\n]+)\1/g;
const CODE = /\.(m?js|cjs|jsx)$/;

function fichiers(dossier) {
  const out = [];
  const pile = [dossier];
  while (pile.length) {
    const d = pile.pop();
    let noms = [];
    try { noms = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of noms) {
      if (e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p); else if (CODE.test(e.name)) out.push(p);
    }
  }
  return out;
}

function completerImports(racine, dossier) {
  const R = path.resolve(racine);
  const D = path.resolve(dossier);
  const vus = new Set();
  const file = fichiers(D);
  const copies = [];
  while (file.length) {
    const f = file.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    let texte = '';
    try { texte = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    for (const m of texte.matchAll(IMPORT)) {
      const cible = path.resolve(path.dirname(f), m[2]);
      if (!cible.startsWith(D + path.sep) || fs.existsSync(cible)) continue;
      const source = path.join(R, path.relative(D, cible));
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      fs.copyFileSync(source, cible);
      copies.push(path.relative(D, cible));
      if (CODE.test(cible)) file.push(cible);
    }
  }
  return copies;
}

module.exports = { completerImports };
