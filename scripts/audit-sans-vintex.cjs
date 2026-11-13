#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUCUN TEXTE MONTRÉ NE NOMME VINTEX (12 nov., ext. 5.372)
//  Julien : « en ce qui concerne faire comme vintex je veux que tu enlèves ça et
//  que tu remplaces par un autre nom ». Le rythme s'appelle « Rapide (6–10 s) » ;
//  « Aléatoire » et « Fixe » restent.
//  Ce contrôle lit le CODE SANS SES COMMENTAIRES (esbuild les retire, les textes
//  restent) de src/ et des fichiers de l'extension montrés à l'utilisateur
//  (scripts, pages HTML, manifeste), et refuse « Vintex » dans tout texte.
//  Seuls restent permis les identifiants INTERNES déjà enregistrés dans les
//  données (le mode `'vintex'` des réglages de Republier, `RYTHME_VINTEX`,
//  l'attribut `data-favoris-rythme-vintex`) : ils ne se lisent jamais à l'écran.
//  `RACINE=chemin` : la preuve sur un autre arbre (le code d'avant ⇒ rouge).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let esbuild = null;
try { esbuild = require('esbuild'); } catch (_) { esbuild = null; }
const RACINE = process.env.RACINE ? path.resolve(process.env.RACINE) : path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, m, d, n) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, n || 900) : '')); } };

function fichiers(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!/^(node_modules|dist|vendor|lib-tierces)$/.test(n)) fichiers(p, exts, out); }
    else if (exts.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
}
function sansCommentaires(p, src) {
  if (/\.html?$/.test(p)) return src.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, js) => m.replace(js, sansCommentaires('x.js', js)));
  if (/\.json$/.test(p)) return src;
  if (!esbuild) throw new Error('esbuild absent');
  const loader = /\.jsx$/.test(p) ? 'jsx' : 'js';
  return esbuild.transformSync(src, { loader, legalComments: 'none', jsx: 'preserve', minifyWhitespace: true, charset: 'utf8' }).code;
}
// Les identifiants internes (jamais rendus) : retirés avant de chercher.
const PERMIS = [/\/Vintex\/i/g, /\b[A-Z_]*VINTEX[A-Z_]*\b/g, /(['"`])vintex\1/g, /data-favoris-rythme-vintex/g, /RYTHME_VINTEX/g, /\bvintex(?=\s*[:=]\s*)/g, /\.vintex\b/g];

dit(!!esbuild, 'esbuild (déjà là pour Vite) retire les commentaires — sans lui, pas de mesure');
const cibles = [
  ...fichiers(path.join(RACINE, 'src'), ['.js', '.jsx']),
  ...fichiers(path.join(RACINE, 'vinted-sync-extension'), ['.js', '.html', '.json']),
];
const trouves = [];
for (const p of cibles) {
  let code;
  try { code = sansCommentaires(p, fs.readFileSync(p, 'utf8')); } catch (e) { trouves.push(`${path.relative(RACINE, p)} : illisible (${e.message.slice(0, 80)})`); continue; }
  for (const re of PERMIS) code = code.replace(re, '');
  const re = /vintex/ig; let m;
  while ((m = re.exec(code))) trouves.push(`${path.relative(RACINE, p)} : …${code.slice(Math.max(0, m.index - 70), m.index + 50).replace(/\s+/g, ' ')}…`);
}
dit(cibles.length > 50, `${cibles.length} fichiers lus (src/ et l'extension)`);
dit(trouves.length === 0, 'aucun texte de l’app ni de l’extension ne nomme Vintex', trouves.join('\n   '), 20000);
// Le nouveau nom est bien là où était l'ancien.
const fr = fs.readFileSync(path.join(RACINE, 'src', 'i18n', 'langues', 'fr.js'), 'utf8');
dit(/"favoris\.quand\.rapide":\s*"Rapide \(6–10 s\)"/.test(fr), 'le rythme s’appelle « Rapide (6–10 s) » (favoris)');
console.log(`\n${ok} ✅ · ${ko} ❌`);
process.exit(ko ? 1 : 0);
