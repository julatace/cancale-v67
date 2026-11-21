#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : CE QUI CASSE SAFARI SUR IPHONE   —   node scripts/audit-safari.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (11 nov., lot webkit-fiable) « Ce qui marche dans Chrome marche dans Safari
// iPhone. » L'app vise iOS 15.4 et plus (iPhone 6s/7/SE 1 s'arrêtent en iOS 15).
// Les bancs WebKit de la CI tournent sur le DERNIER WebKit : ils ne voient pas
// ce qui manque aux Safari plus anciens. Cet audit le lit dans le code LIVRÉ :
//
//   A. aucune regex à « lookbehind » `(?<=` / `(?<!` dans dist/assets/*.js
//      (dépendances comprises) : Safari < 16.4 lève une SyntaxError en LISANT le
//      fichier ⇒ tout le paquet refuse de charger ⇒ « L'application n'a pas pu
//      démarrer » à chaque ouverture (docs/passation/audits-2026-11-01/limites.md n°9).
//   B. aucune fonction absente de Safari 15.4 appelée NUE dans dist/ :
//      AbortSignal.timeout/any, Object/Map.groupBy, Promise.withResolvers,
//      Array.fromAsync, URL.canParse/parse, requestIdleCallback. « Gardée » =
//      un `typeof` (ou un test `in`) du même nom juste avant (200 caractères).
//      Dans src/ : jamais `AbortSignal.timeout(` (passe par `signalDelai`,
//      src/compatSafari.js), jamais `.toSorted/.toReversed/.toSpliced(` ni les
//      méthodes d'ensemble de Safari 17 (`.union(`, `.isSubsetOf(`…).
//   C. src/ : aucune date écrite « AAAA-MM-JJ HH:MM » (espace) passée à
//      `new Date(` / `Date.parse(` : les anciens Safari rendent « Invalid Date ».
//   D. src/ : `navigator.share(` seulement derrière un test (`navigator.share &&`,
//      `canShare`, `peutPartager…`) — sinon un ordinateur sans partage lève au clic.
//
// `--prouve` : chaque règle est jouée sur ses défauts d'avant (les deux regex
// d'origin/main, un `AbortSignal.timeout` nu…) ⇒ rouge ; et sur leur forme
// corrigée ⇒ vert. Un contrôle qui ne peut pas échouer ne prouve rien (§6.1).
// `AUDIT_SAFARI_DIST` / `AUDIT_SAFARI_SRC` : juger un autre arbre (origin/main).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const DIST = process.env.AUDIT_SAFARI_DIST || path.join(R, 'dist');
const SRC = process.env.AUDIT_SAFARI_SRC || path.join(R, 'src');

let ok = 0, ko = 0;
const dit = (c, titre, detail) => { if (c) { ok++; console.log('  ✅ ' + titre); } else { ko++; console.log('  ❌ ' + titre + (detail ? ' — ' + detail : '')); } };

// ── Les règles (fonctions pures : un texte ⇒ la liste des fautes) ────────────
const LOOKBEHIND = /\(\?<[=!]/g;
function fautesLookbehind(texte) {
  const out = [];
  for (const m of texte.matchAll(LOOKBEHIND)) out.push(texte.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, ' '));
  return out;
}
// Fonctions de Safari > 15.4 : le nom appelé, et ce qu'un test doit nommer avant.
const APIS = [
  ['AbortSignal.timeout(', 'AbortSignal.timeout'], ['AbortSignal.any(', 'AbortSignal.any'],
  ['Object.groupBy(', 'Object.groupBy'], ['Map.groupBy(', 'Map.groupBy'],
  ['Promise.withResolvers(', 'Promise.withResolvers'], ['Array.fromAsync(', 'Array.fromAsync'],
  ['URL.canParse(', 'URL.canParse'], ['URL.parse(', 'URL.parse'],
  ['requestIdleCallback(', 'requestIdleCallback'],
];
function fautesApis(texte) {
  const out = [];
  for (const [appel, nom] of APIS) {
    const court = nom.split('.').pop();
    for (let i = texte.indexOf(appel); i >= 0; i = texte.indexOf(appel, i + 1)) {
      if (/[\w$]/.test(texte[i - 1] || '') && !appel.startsWith('.')) continue;   // un autre nom (monRequestIdleCallback)
      if (texte.slice(i - 8, i) === 'function') continue;
      const avant = texte.slice(Math.max(0, i - 200), i);
      const garde = new RegExp('typeof\\s*\\(?\\s*(?:window\\.|globalThis\\.|self\\.)?' + nom.replace(/\./g, '\\.') + '\\b').test(avant)
        || new RegExp('["\']' + court + '["\']\\s*in\\b').test(avant);
      if (!garde) out.push(texte.slice(Math.max(0, i - 60), i + 40).replace(/\s+/g, ' '));
    }
  }
  return out;
}
const METHODES_SRC = /\.(toSorted|toReversed|toSpliced|isWellFormed|toWellFormed|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(|\bAbortSignal\.timeout\(/g;
function fautesSrc(texte, fichier) {
  const out = [];
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
  if (!/compatSafari\.js$/.test(fichier)) for (const m of sansCommentaires.matchAll(METHODES_SRC)) out.push(m[0]);
  for (const m of sansCommentaires.matchAll(/\b(?:new\s+Date|Date\.parse)\(\s*(['"`])\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}/g)) out.push('date avec espace : ' + m[0]);
  const lignes = sansCommentaires.split('\n');
  lignes.forEach((l, k) => {
    if (l.indexOf('navigator.share(') < 0) return;
    const autour = lignes.slice(Math.max(0, k - 4), k + 1).join('\n');
    if (!/navigator\.share\s*&&|canShare|typeof\s+navigator\.share|peutPartager/.test(autour)) out.push(`navigator.share sans test (ligne ${k + 1})`);
  });
  return out;
}

// ── Les fichiers ─────────────────────────────────────────────────────────────
const lister = (dir, re) => { const out = []; const pas = (d) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; } for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') pas(p); } else if (re.test(e.name)) out.push(p); } }; pas(dir); return out; };

function juger() {
  console.log('── A/B. le code LIVRÉ (dist/assets, dépendances comprises)');
  const js = lister(path.join(DIST, 'assets'), /\.js$/);
  dit(js.length > 0, `dist/assets lu (${js.length} fichiers .js)`, js.length ? '' : `aucun fichier sous ${DIST}/assets — lancer npm run build d'abord`);
  const lb = [], api = [];
  for (const f of js) { const t = fs.readFileSync(f, 'utf8'); for (const x of fautesLookbehind(t)) lb.push(path.basename(f) + ' : ' + x); for (const x of fautesApis(t)) api.push(path.basename(f) + ' : ' + x); }
  dit(js.length > 0 && !lb.length, 'aucune regex à lookbehind (Safari < 16.4 refuse de lire tout le fichier)', lb.slice(0, 4).join(' ¦ '));
  dit(js.length > 0 && !api.length, 'aucune fonction absente de Safari 15.4 appelée sans test', api.slice(0, 4).join(' ¦ '));
  console.log('── B/C/D. les sources (src/)');
  // (api/_lib tourne sur le serveur, Node ; ce qu'en charge l'app est jugé dans dist/ ci-dessus.)
  const srcs = lister(SRC, /\.(js|jsx|mjs)$/);
  dit(srcs.length > 50, `sources lues (${srcs.length})`);
  const fautes = [];
  for (const f of srcs) for (const x of fautesSrc(fs.readFileSync(f, 'utf8'), f)) fautes.push(path.relative(R, f) + ' : ' + x);
  dit(!fautes.length, 'ni AbortSignal.timeout nu, ni méthodes de Safari 16-17, ni date « AAAA-MM-JJ HH:MM », ni partage sans test', fautes.slice(0, 6).join(' ¦ '));
}

function prouver() {
  console.log('── --prouve : chaque règle sur ses défauts d\'avant');
  // A : les trois regex d'origin/main (avant ce lot).
  dit(fautesLookbehind("String(l).split(/(?<= [·:]) /u)").length === 1, 'A rouge sur la regex de Tournee.jsx d\'avant');
  dit(fautesLookbehind("String(s).replace(/(?<!\\d)[,.;!?:]|[,.;!?:](?!\\d)/g, ' ')").length === 1, 'A rouge sur la regex d\'agentEbay.js d\'avant');
  dit(fautesLookbehind(".replace(/(?<![.\\w$])[A-Za-z_$][\\w$]{0,2}(?=\\.[\\w$]+ is not a function)/g, '?')").length === 1, 'A rouge sur la regex de veille-plantages.js d\'avant');
  dit(fautesLookbehind("/(?<nom>\\d+)/.exec(x); /(?=a)(?!b)/").length === 0, 'A vert sur un groupe nommé et un lookahead (Safari les lit)');
  // B
  dit(fautesApis("fetch(u,{signal:AbortSignal.timeout(15000)})").length === 1, 'B rouge sur un AbortSignal.timeout nu');
  dit(fautesApis('if(typeof AbortSignal<"u"&&typeof AbortSignal.timeout=="function")return AbortSignal.timeout(e)').length === 0, 'B vert sur un AbortSignal.timeout gardé (signalDelai)');
  dit(fautesApis("window.requestIdleCallback(f,{timeout:2000})").length === 1, 'B rouge sur un requestIdleCallback nu (Safari ne l\'a pas)');
  dit(fautesApis("if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(f)").length === 0, 'B vert sur un requestIdleCallback gardé');
  dit(fautesApis("const g = Object.groupBy(l, f)").length === 1, 'B rouge sur Object.groupBy (Safari 17.4)');
  // B/C/D sources
  dit(fautesSrc("const r = await fetch(u, { signal: AbortSignal.timeout(20000) });", 'src/x.jsx').length === 1, 'B rouge sur AbortSignal.timeout dans src/');
  dit(fautesSrc("// AbortSignal.timeout (anciens Safari)\nconst x = 1;", 'src/x.jsx').length === 0, 'B vert sur AbortSignal.timeout cité en commentaire');
  dit(fautesSrc("const t = liste.toSorted((a, b) => a - b);", 'src/x.jsx').length === 1, 'B rouge sur .toSorted (Safari 16)');
  dit(fautesSrc("const d = new Date('2026-11-11 12:00');", 'src/x.jsx').length === 1, 'C rouge sur une date « AAAA-MM-JJ HH:MM »');
  dit(fautesSrc("const d = new Date('2026-11-11T12:00:00Z');", 'src/x.jsx').length === 0, 'C vert sur une date ISO');
  dit(fautesSrc("const go = async () => { await navigator.share({ title: 'VRM' }); };", 'src/x.jsx').length === 1, 'D rouge sur un partage sans test');
  dit(fautesSrc("if (navigator.share && grand) { await navigator.share({ title: 'VRM' }); }", 'src/x.jsx').length === 0, 'D vert sur un partage testé');
}

if (process.argv.includes('--prouve')) prouver();
juger();
console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
