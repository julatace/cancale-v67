#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES FICHIERS public/brands/*.svg, FABRIQUÉS DEPUIS src/plateformes/marques.js
//  (15 nov.)     node scripts/marques-svg.cjs            ⇒ vérifie (rouge si écart)
//                node scripts/marques-svg.cjs --ecrire   ⇒ réécrit les quatre fichiers
// Une seule source pour les marques des plateformes : les tracés vivent dans le module ;
// les fichiers (masques CSS de la navigation, image du rail) en sont une copie exacte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
(async () => {
  const M = await import(path.join(R, 'src', 'plateformes', 'marques.js'));
  const ecrire = process.argv.includes('--ecrire');
  let ko = 0;
  for (const id of M.IDS_MARQUES) {
    const f = path.join(R, 'public', 'brands', id + '.svg');
    const voulu = M.svgTexte(id);
    if (ecrire) { fs.writeFileSync(f, voulu); console.log('écrit ' + path.relative(R, f)); continue; }
    const lu = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (lu !== voulu) { ko++; console.log('❌ ' + path.relative(R, f) + ' ≠ src/plateformes/marques.js (node scripts/marques-svg.cjs --ecrire)'); }
    else console.log('✅ ' + path.relative(R, f));
  }
  process.exit(ko ? 1 : 0);
})();
