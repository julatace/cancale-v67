// ════════════════════════════════════════════════════════════════════════════
// AIDE À LA MIGRATION D'UN ÉCRAN VERS tr() (11 nov., lot traduction). Lecture seule :
// rien n'est réécrit, l'outil PROPOSE. Méthode complète :
// docs/passation/2026-11-11-traduction.md.
//
//   node scripts/i18n-extraire.cjs src/ecrans/Stock.jsx [--fonction StockScreen] [--prefixe stock] [--json]
//
// Il repère les textes VISIBLES (texte JSX, attributs placeholder / aria-label /
// title / alt / label, champs lib / desc / titre / pied, phrases passées à
// toast / setErr / setInfo, littéraux rendus {'…'} ou {cond ? '…' : '…'}),
// propose une clé `<prefixe>.<mots>` par texte (la même phrase ⇒ la même clé,
// une clé déjà présente dans fr.js avec ce texte ⇒ réutilisée), et sort :
//   • la liste « ligne · clé · texte » à reprendre à la main ;
//   • le bloc à coller dans src/i18n/langues/fr.js ;
//   • les gabarits `${x}` signalés : ils deviennent `{x}` et `tr('…', { x })`.
// Ce qui n'est pas du texte (noms propres, classes, adresses) n'est pas proposé.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let parser;
try { parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser')); } catch (_) { parser = require('@babel/parser'); }
const R = path.join(__dirname, '..');

const args = process.argv.slice(2);
const fichier = args.find((a) => !a.startsWith('--'));
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
if (!fichier) { console.log('usage : node scripts/i18n-extraire.cjs <fichier.jsx> [--fonction Nom] [--prefixe ecran] [--json]'); process.exit(2); }
const prefixe = opt('prefixe') || path.basename(fichier).replace(/\.(jsx?|mjs)$/, '').replace(/^./, (c) => c.toLowerCase());
const fonction = opt('fonction');

const src = fs.readFileSync(path.resolve(fichier), 'utf8');
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
let fr = {};
try { const dosFr = path.join(R, 'src', 'i18n', 'langues', 'fr'); const t = ['fr-accueil.js', 'fr.js', ...(fs.existsSync(dosFr) ? fs.readdirSync(dosFr).filter((f) => f.endsWith('.js')).map((f) => 'fr/' + f) : [])].map((n) => fs.readFileSync(path.join(R, 'src', 'i18n', 'langues', n), 'utf8')).join('\n'); for (const m of t.matchAll(/^\s*"([^"]+)": ("(?:[^"\\]|\\.)*")/gm)) fr[m[1]] = JSON.parse(m[2]); } catch (_) {}
const parTexte = new Map(Object.entries(fr).map(([k, v]) => [v, k]));

const PROPRES = /\b(?:VRM|Google|Discord|Vinted|Leboncoin|eBay|Vestiaire Collective|Scriptable|URSSAF)\b/g;
const estTexte = (s) => { const v = String(s).replace(PROPRES, '').replace(/\s+/g, ' ').trim(); return /[A-Za-zÀ-ÿ]{2,}/.test(v) && !/^[\w-]+$/.test(v) && !/^[./#?]|^https?:|^mailto:|^data:|[{};]\s*$/.test(v) && !/^[a-z-]+(\s+[a-z-]+)*$/.test(v.trim()) || /\s/.test(v) && /[A-ZÀ-Ü]|[éèêàçùô’]/.test(v); };
const SANS_ACCENT = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const VIDES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'et', 'a', 'à', 'en', 'ton', 'ta', 'tes', 'ce', 'cet', 'cette', 'pour', 'par', 'sur', 'au', 'aux', 'est', 'que', 'qui', 'ne', 'pas', 'tu', 'te', 's']);
const nomCle = (texte) => {
  const mots = SANS_ACCENT(texte).toLowerCase().replace(/\$\{[^}]*\}/g, ' ').split(/[^a-z0-9]+/).filter((m) => m && !VIDES.has(m)).slice(0, 3);
  return mots.map((m, i) => (i ? m[0].toUpperCase() + m.slice(1) : m)).join('') || 'texte';
};
const ATTR = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label']);
const APPELS = new Set(['setErr', 'setInfo', 'toast', 'setMessage', 'setErreur']);
const CHAMPS = new Set(['lib', 'desc', 'titre', 'pied', 'label', 'texte', 'phrase']);

const trouves = [];
const visiter = (n, f, parent) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach((x) => visiter(x, f, parent)); return; } if (typeof n.type === 'string') f(n, parent); for (const k of Object.keys(n)) if (!['loc', 'start', 'end', 'leadingComments', 'trailingComments'].includes(k) && n[k] && typeof n[k] === 'object') visiter(n[k], f, n); };
let racines = [ast.program];
if (fonction) {
  racines = [];
  visiter(ast.program, (n) => { const nom = (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id ? n.id.name : n.type === 'VariableDeclarator' && n.id ? n.id.name : null; if (nom === fonction) racines.push(n); });
  if (!racines.length) { console.log(`fonction « ${fonction} » introuvable dans ${fichier}`); process.exit(2); }
}
const garder = (n, texte, ou, gabarit = false) => { const t = String(texte).replace(/\s+/g, ' ').trim(); if (estTexte(t.replace(/\$\{[^}]*\}/g, ' ').trim())) trouves.push({ ligne: n.loc ? n.loc.start.line : 0, ou, texte: t, gabarit }); };
const lit = (x) => (x.type === 'StringLiteral' ? [x.value, false] : x.type === 'TemplateLiteral' ? [x.quasis.map((q, i) => q.value.cooked + (i < x.expressions.length ? '${' + src.slice(x.expressions[i].start, x.expressions[i].end) + '}' : '')).join(''), x.expressions.length > 0] : null);
for (const r of racines) visiter(r, (n) => {
  if (n.type === 'JSXElement' && n.openingElement.name && ['style', 'script', 'svg', 'path'].includes(n.openingElement.name.name)) { n.children = []; return; }
  if (n.type === 'JSXText') garder(n, n.value, 'texte');
  if (n.type === 'JSXAttribute' && n.name && ATTR.has(n.name.name) && n.value && n.value.type === 'StringLiteral') garder(n, n.value.value, n.name.name);
  if (n.type === 'ObjectProperty' && n.key && CHAMPS.has(n.key.name) && n.value) { const v = lit(n.value); if (v) garder(n, v[0], n.key.name, v[1]); }
  if (n.type === 'CallExpression' && n.callee && APPELS.has(n.callee.name) && n.arguments[0]) { const v = lit(n.arguments[0]); if (v) garder(n, v[0], n.callee.name, v[1]); }
  if (n.type === 'JSXExpressionContainer' && n.expression) {
    const prendre = (x) => { if (!x) return; if (x.type === 'ConditionalExpression') { prendre(x.consequent); prendre(x.alternate); } else if (x.type === 'LogicalExpression') prendre(x.right); else { const v = lit(x); if (v) garder(x, v[0], '{…}', v[1]); } };
    prendre(n.expression);
  }
});

const cles = new Map(); const nouvelles = {};
for (const t of trouves) {
  const texte = t.gabarit ? t.texte.replace(/\$\{([^}]*)\}/g, (m, e) => `{${(e.match(/[A-Za-z_]\w*/g) || ['x']).pop()}}`) : t.texte;
  let cle = parTexte.get(texte) || cles.get(texte);
  if (!cle) { let base = `${prefixe}.${nomCle(t.texte)}`, k = base, i = 2; while ((k in fr && fr[k] !== texte) || (k in nouvelles && nouvelles[k] !== texte)) k = `${base}${i++}`; cle = k; nouvelles[cle] = texte; }
  cles.set(texte, cle); t.cle = cle; t.texteCle = texte;
}
if (args.includes('--json')) { console.log(JSON.stringify({ fichier, prefixe, trouves, nouvelles }, null, 2)); process.exit(0); }
console.log(`${fichier}${fonction ? ' · ' + fonction : ''} — ${trouves.length} texte(s) visible(s), ${Object.keys(nouvelles).length} clé(s) nouvelle(s)\n`);
for (const t of trouves) console.log(`  ${String(t.ligne).padStart(6)}  ${t.ou.padEnd(11)} ${t.cle.padEnd(38)} ${t.texte.slice(0, 90)}${t.gabarit ? '   ⚠ gabarit : tr(\'' + t.cle + '\', { … })' : ''}${t.cle in fr ? '   (déjà dans fr.js)' : ''}`);
if (Object.keys(nouvelles).length) {
  console.log('\n── À coller dans src/i18n/langues/fr.js (puis la même clé dans en, es, it, de) :');
  for (const [k, v] of Object.entries(nouvelles)) console.log(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
}
console.log('\nPuis : node scripts/audit-traduction.cjs (et ajouter le fichier à MIGRES quand il est fini).');
