#!/usr/bin/env node
// ── L'ÉCHELLE FERMÉE DE FUSION (3 nov., critique #9) ──────────────────────────
// Mesuré à 390 px avant : 31 tailles de police, 8 graisses, 15 rayons, 101 styles de
// bouton. Ce script ramène les valeurs ÉCRITES dans le code (styles en ligne des .jsx/.js
// et feuilles .css de src/) sur l'échelle de src/design/jetons.css :
//   tailles   11 · 12 · 13 · 15 · 17 · 20 · 22 · 28 · 34 · 38 · 44
//   graisses  400 · 500 · 600 · 700 · 800
//   rayons    6 · 12 · 14 · 20 · 24 · 999   (0–3 px laissés : filets et barres fines)
// Idempotent : le relancer ne change plus rien. Il ne touche ni une donnée ni une
// règle : seulement des nombres de style. Usage : node scripts/fusion-echelle.mjs [--verifier]
// (--verifier : n'écrit rien, sort en erreur s'il reste une valeur hors échelle).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIER = process.argv.includes('--verifier');

export const TAILLES = [11, 12, 13, 15, 17, 20, 22, 28, 34, 38, 44];
export const GRAISSES = [400, 500, 600, 700, 800];
export const RAYONS = [6, 12, 14, 20, 24, 999];

export function taille(v) {
  const n = Number(v);
  if (!isFinite(n) || n < 9 || n > 48) return n;          // icônes minuscules, chiffres géants : laissés
  if (n < 11.5) return 11;
  if (n < 12.5) return 12;
  if (n < 14) return 13;
  if (n < 16) return 15;
  if (n < 19) return 17;
  if (n < 21.5) return 20;
  if (n < 25) return 22;
  if (n < 31) return 28;
  if (n < 36.5) return 34;
  if (n < 41) return 38;
  return 44;
}
export function graisse(v) {
  const n = Number(v);
  if (!isFinite(n)) return v;
  if (n <= 400) return 400;
  if (n < 550) return 500;
  if (n < 675) return 600;
  if (n < 775) return 700;
  return 800;
}
export function rayon(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 3) return n;
  if (n < 8) return 6;
  if (n < 13) return 12;
  if (n < 17) return 14;
  if (n < 22) return 20;
  if (n <= 32) return 24;
  if (n < 100) return n;                                   // gros ronds (avatars) : laissés
  return 999;
}

const fmt = (n) => String(n);
function transformer(src, css) {
  let s = src;
  if (!css) {
    // fontSize: 12.5  ·  fontSize: cond ? 13 : 12.5  ·  fontSize: '12.5px'
    s = s.replace(/(fontSize:\s*)([\d.]+)(?![\d.]*\s*(?:px|em|rem|%|vw))/g, (m, a, n) => a + fmt(taille(n)));
    s = s.replace(/(fontSize:\s*[^,}?]{1,40}\?\s*)([\d.]+)(\s*:\s*)([\d.]+)/g, (m, a, x, b, y) => a + fmt(taille(x)) + b + fmt(taille(y)));
    s = s.replace(/(fontSize:\s*['"])([\d.]+)px/g, (m, a, n) => a + fmt(taille(n)) + 'px');
    s = s.replace(/(fontWeight:\s*['"]?)(\d{3})\b/g, (m, a, n) => a + fmt(graisse(n)));
    s = s.replace(/(borderRadius:\s*)([\d.]+)(?![\d.]*\s*(?:px|em|%|\s))(?=\s*[,}])/g, (m, a, n) => a + fmt(rayon(n)));
    s = s.replace(/(borderRadius:\s*['"])([\d.]+)px(['"])/g, (m, a, n, b) => a + fmt(rayon(n)) + 'px' + b);
  }
  // Feuilles CSS ET chaînes CSS dans le JS (« font: 600 12.5px/1.3 … », « font-size:14px »)
  s = s.replace(/(font-size:\s*)([\d.]+)px/g, (m, a, n) => a + fmt(taille(n)) + 'px');
  s = s.replace(/(font-weight:\s*)(\d{3})\b/g, (m, a, n) => a + fmt(graisse(n)));
  s = s.replace(/(\bfont:\s*['"]?)(\d{3})(\s+)([\d.]+)px/g, (m, a, w, b, n) => a + fmt(graisse(w)) + b + fmt(taille(n)) + 'px');
  s = s.replace(/(\bfont:\s*['"]?)(?!\d{3}\s)([\d.]+)px/g, (m, a, n) => a + fmt(taille(n)) + 'px');
  s = s.replace(/(border-radius:\s*)([\d.]+)px(?=\s*[;!}"'])/g, (m, a, n) => a + fmt(rayon(n)) + 'px');
  return s;
}

function fichiers(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['fonts', 'images', 'textures'].includes(e.name)) out.push(...fichiers(p)); }
    else if (/\.(jsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const changes = [];
// Laissés à leurs chantiers (3 nov.) : Favoris (`claude/favoris-fusion`), Comptes liés, Stock 3D.
const HORS = /(?:^|[\\/])(favoris\.css|FavorisVinted\.jsx|favorisEcran\.js|comptes-lies\.css|Room3D\.jsx)$/;
for (const f of fichiers(path.join(RACINE, 'src')).filter((x) => !HORS.test(x))) {
  const avant = fs.readFileSync(f, 'utf8');
  const apres = transformer(avant, f.endsWith('.css'));
  if (apres !== avant) { changes.push(path.relative(RACINE, f)); if (!VERIFIER) fs.writeFileSync(f, apres); }
}
if (VERIFIER) {
  if (changes.length) { console.log(`❌ fusion-echelle : ${changes.length} fichier(s) hors échelle : ${changes.join(', ')}`); process.exit(1); }
  console.log('✅ fusion-echelle : toutes les tailles, graisses et rayons écrits sont sur l\'échelle');
} else console.log(`fusion-echelle : ${changes.length} fichier(s) ramené(s) sur l'échelle`);
