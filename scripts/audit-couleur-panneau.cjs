// ════════════════════════════════════════════════════════════════════════════
//  « DES COULEURS BLEU VIF QUI NE VONT PAS ENSEMBLE » — LA PALETTE DU PANNEAU DE L'EXTENSION (21 nov., ext. 5.419)
//
//  Julien (21 nov., panneau 5.418) : « l'affichage doit être mieux : on a un style assez simple et après des couleurs
//  bleu vif qui ne vont pas ensemble ». La palette voulue (façon Vintex) : encre pour le bouton plein, contours gris
//  fins, étiquettes pastel (vert = fait/prêt, ambre = geste, gris = attente, teal doux = en route), accent VERT SAPIN
//  rare (#0F6B4C, nuit #3FD49A) pour l'onglet actif et les interrupteurs ; rouge seulement doublon de N° ; pas de violet.
//  On lit CHAQUE couleur écrite dans les fichiers de l'interface de l'extension (hex et rgb/rgba) :
//   C1. aucun BLEU (teinte 185°–255°, saturation ≥ 30 %, luminosité 12 %–92 %) ;
//   C2. aucun VIOLET (teinte 256°–320°, saturation ≥ 30 %) ;
//   C3. l'accent du grand panneau est le vert sapin (clair et nuit), le bouton plein est l'encre ;
//  Les logos des transporteurs (`LOGOS_TRANSP`, leurs couleurs de marque) ne sont pas jugés.
//  §6.1 : `--racine <arbre d'avant>` ⇒ rouge. `--prouve` : un bleu remis ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2);
const iR = args.indexOf('--racine');
let EXT = path.join(iR >= 0 ? path.resolve(args[iR + 1]) : path.join(__dirname, '..'), 'vinted-sync-extension');
const FICHIERS = ['vrm-badge.js', 'vrm-ui.js', 'vrm-dressing.js', 'vrm-action.js', 'popup.html', 'vrm-formulaire.js', 'vrm-depot-aussi.js'];   // 5.424 : la frise de l'onglet de travail « Publier aussi »
if (args.includes('--prouve')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'couleur-'));
  fs.mkdirSync(path.join(tmp, 'vinted-sync-extension'));
  for (const f of FICHIERS.concat(['background.js'])) if (fs.existsSync(path.join(EXT, f))) fs.copyFileSync(path.join(EXT, f), path.join(tmp, 'vinted-sync-extension', f));
  const p = path.join(tmp, 'vinted-sync-extension', 'vrm-badge.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('--n-accent:#0F6B4C;', '--n-accent:#0068D6;'));
  const r = require('child_process').spawnSync(process.execPath, [__filename, '--racine', tmp], { encoding: 'utf8' });
  console.log(r.status === 1 ? '✅ mutation (#0068D6 remis) ⇒ rouge' : '❌ mutation non détectée');
  process.exit(r.status === 1 ? 0 : 1);
}
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 700) : ''}`); } };
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2, d = M - m;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}
const bleus = [], violets = [];
for (const f of FICHIERS) {
  const p = path.join(EXT, f); if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split('\n').forEach((ligne, i) => {
    if (/LOGOS_TRANSP|^\s*(google|discord): '<svg/.test(ligne)) return;   // logos de marque (transporteurs, Google, Discord)
    const cs = [];
    for (const m of ligne.matchAll(/#([0-9a-fA-F]{6})\b/g)) cs.push([m[0], parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)]);
    for (const m of ligne.matchAll(/#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])/g)) cs.push([m[0], ...m[1].split('').map((c) => parseInt(c + c, 16))]);
    for (const m of ligne.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)) cs.push([m[0] + ')', +m[1], +m[2], +m[3]]);
    for (const [txt, r, g, b] of cs) {
      const c = hsl(r, g, b);
      if (c.h >= 185 && c.h <= 255 && c.s >= 0.30 && c.l >= 0.12 && c.l <= 0.92) bleus.push(`${f}:${i + 1} ${txt}`);
      if (c.h > 255 && c.h <= 320 && c.s >= 0.30 && c.l >= 0.12 && c.l <= 0.92) violets.push(`${f}:${i + 1} ${txt}`);
    }
  });
}
console.log('\nC1. Aucun bleu dans l’interface de l’extension');
dit(!bleus.length, `aucun bleu (${bleus.length} trouvés)`, bleus.slice(0, 30).join(' · '));
console.log('\nC2. Aucun violet');
dit(!violets.length, `aucun violet (${violets.length} trouvés)`, violets.slice(0, 20).join(' · '));
console.log('\nC3. L’accent du grand panneau : vert sapin, rare ; le plein : l’encre');
const B = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
dit(/\.carte\[data-grand\] \{[^}]*--n-accent:#0F6B4C;/.test(B), 'clair : --n-accent #0F6B4C');
dit((B.match(/--n-accent:#3FD49A;/g) || []).length >= 2, 'nuit (système et choisi) : --n-accent #3FD49A');
dit(/--vu-plein:#111114;/.test(B) && /--vu-plein:#F2F2F7;/.test(B), 'bouton plein : encre (#111114 ; nuit #F2F2F7)');
const BG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
dit(!/#0068D6|#409CFF/i.test(BG), 'background.js : plus de #0068D6 / #409CFF (voile de l’onglet de travail)');
console.log(`\n${ko ? '❌' : '✅'} audit-couleur-panneau : ${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
