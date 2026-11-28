// ══════════════════════════════════════════════════════════════════════════
// LE FRANÇAIS DES ÉCRANS À LA DEMANDE, CHARGÉ AVEC EUX (17 nov., lot vitesse-poids)
// ══════════════════════════════════════════════════════════════════════════
// Le dictionnaire français de l'app (src/i18n/langues/fr.js, 8 700 clés, ≈ 520 Ko)
// partait EN ENTIER dans le morceau App, au démarrage — y compris les textes des
// écrans qui ne se chargent qu'à la demande (Compta, Stats, eBay, Réglages…).
//
// Au BUILD seulement (vite.config.js, `francaisDiffere`), le fr.js qu'importe
// src/App.jsx est remplacé par la part « démarrage » : chaque clé qu'un module du
// démarrage PEUT lire. Le reste part dans src/i18n/langues/fr-reste.js, un morceau
// importé EN PREMIER par chaque module chargé à la demande qui peut en lire une clé :
// il arrive avec l'écran, avant que l'écran ne s'évalue. Le dépôt ne change pas :
// fr.js reste le dictionnaire complet (les audits le lisent ainsi) et, sans build
// (vite dev), l'app le charge entier.
//
// « Peut lire » est jugé LARGE (mieux vaut une clé de trop au démarrage qu'une clé
// brute à l'écran) :
//   · le démarrage = le graphe des imports STATIQUES de src/main.jsx et de src/App.jsx,
//     plus celui de chaque module que main.jsx charge à la demande (ils s'ouvrent
//     avant l'app, on ne les alourdit pas) ;
//   · une clé y est lue si une chaîne d'un de ces modules (littéral ou morceau de
//     gabarit) EST la clé, en est un PRÉFIXE (`'compta.' + x`, `compta.${x}`) ou un
//     SUFFIXE (`x + '.titre'`), ou si un mot d'une phrase est la clé ;
//   · tout fichier de api/, public/ et de l'extension compte aussi (une clé qu'un
//     serveur renverrait).
// Filet : une clé demandée avant l'arrivée de fr-reste est notée
// (`window.__vrmClesEnAttente`) et fr-reste est alors chargé (src/i18n/index.js).
// La garde : scripts/audit-francais-differe.cjs.
// ══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const EXTS = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
const CLE = /^[A-Za-z0-9_.-]+$/;
const estDico = (f) => /[\\/]src[\\/]i18n[\\/]langues[\\/]/.test(f);

function creer(R) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const resoudre = (de, spec) => {
    if (typeof spec !== 'string' || !spec.startsWith('.')) return null;
    const b = path.resolve(path.dirname(de), spec.split('?')[0]);
    for (const e of EXTS) { try { if (fs.statSync(b + e).isFile()) return b + e; } catch (_) {} }
    return null;
  };
  const cache = new Map();
  // Un module : ses imports statiques, ses imports à la demande, ses chaînes.
  function lire(f, textes) {
    const cle = f;
    if (cache.has(cle)) return cache.get(cle);
    const o = { stat: [], dyn: [], exacts: new Set(), prefixes: new Set(), suffixes: new Set(), erreur: null };
    let src = '';
    try { src = textes && textes[f] != null ? textes[f] : fs.readFileSync(f, 'utf8'); } catch (e) { o.erreur = e.message; }
    if (!/\.(m?js|jsx|cjs)$/.test(f)) {
      for (const w of src.match(/[A-Za-z0-9_.-]+/g) || []) o.exacts.add(w);
      cache.set(cle, o);
      return o;
    }
    let ast = null;
    try { ast = parser.parse(src, { sourceType: 'unambiguous', plugins: ['jsx'], errorRecovery: true }); } catch (e) { o.erreur = e.message; }
    if (!ast) { for (const w of src.match(/[A-Za-z0-9_.-]+/g) || []) { o.exacts.add(w); if (/[._-]$/.test(w)) o.prefixes.add(w); } cache.set(cle, o); return o; }
    const chaine = (v) => {
      v = String(v == null ? '' : v);
      if (CLE.test(v)) { o.exacts.add(v); if (/[._-]$/.test(v)) o.prefixes.add(v); if (/^[._-]/.test(v)) o.suffixes.add(v); return; }
      for (const w of v.match(/[A-Za-z0-9_.-]+/g) || []) { o.exacts.add(w); o.exacts.add(w.replace(/[._-]+$/, '').replace(/^[._-]+/, '')); }
    };
    const SAUTE = new Set(['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra']);
    const visiter = (n) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'StringLiteral') chaine(n.value);
      else if (n.type === 'TemplateElement') chaine(n.value.cooked != null ? n.value.cooked : n.value.raw);
      if (n.type === 'ImportExpression' || (n.type === 'CallExpression' && n.callee && n.callee.type === 'Import')) {
        const a = n.source || (n.arguments && n.arguments[0]);
        if (a && a.type === 'StringLiteral') { const p = resoudre(f, a.value); if (p) o.dyn.push(p); }
      }
      for (const k in n) {
        if (SAUTE.has(k)) continue;
        const v = n[k];
        if (Array.isArray(v)) { for (const x of v) visiter(x); } else if (v && typeof v.type === 'string') visiter(v);
      }
    };
    for (const s of ast.program.body) {
      if ((s.type === 'ImportDeclaration' && s.importKind !== 'type') || ((s.type === 'ExportNamedDeclaration' || s.type === 'ExportAllDeclaration') && s.source)) {
        const p = resoudre(f, s.source.value); if (p) o.stat.push(p);
      }
    }
    visiter(ast.program);
    cache.set(cle, o);
    return o;
  }
  return { lire, resoudre };
}

function listerFichiers(dossier, acc, filtre) {
  let ents = [];
  try { ents = fs.readdirSync(dossier, { withFileTypes: true }); } catch (_) { return acc; }
  for (const e of ents) {
    const p = path.join(dossier, e.name);
    if (/(^|[\\/])(node_modules|dist|\.git)([\\/]|$)/.test(p)) continue;
    if (e.isDirectory()) listerFichiers(p, acc, filtre); else if (filtre.test(e.name)) acc.push(p);
  }
  return acc;
}

// Le dictionnaire complet (ESM) : lu par import, comme l'app le lit.
async function dictionnaire(R) {
  const u = pathToFileURL(path.join(R, 'src', 'i18n', 'langues', 'fr.js')).href + '?t=' + Date.now();
  const m = await import(u);
  return m.default;
}

// L'analyse. `textes` : { cheminAbsolu: texte } pour remplacer un fichier (mutations de l'audit).
function analyser(R, fr, textes) {
  const { lire } = creer(R);
  const L = (f) => lire(f, textes);
  const fermer = (racines) => {
    const vus = new Set(); const pile = [...racines];
    while (pile.length) { const f = pile.pop(); if (vus.has(f)) continue; vus.add(f); for (const g of L(f).stat) pile.push(g); }
    return vus;
  };
  const MAIN = path.join(R, 'src', 'main.jsx'), APP = path.join(R, 'src', 'App.jsx');
  const grapheMain = fermer([MAIN]);
  const demarrage = new Set([...grapheMain, ...fermer([APP])]);
  // les modules que main.jsx ouvre à la demande (avant l'app) : comptés au démarrage
  for (const f of grapheMain) for (const d of L(f).dyn) if (d !== APP) for (const g of fermer([d])) demarrage.add(g);
  // (21 nov., lot personnel-compta) les écrans qu'App DEMANDE dès son évaluation (préchargés par index.html,
  // `data-js-ensuite`) : src/ecrans/Comptabilite.jsx rend Aujourd'hui — son français est celui du démarrage.
  // (27 nov., budget-vitesse) « À relancer » de Ventes (src/natif/ecrans/RelancesVentes.jsx, monté par Comptabilite dès que
  // la liste a une ligne) : quelques clés, qui faisaient télécharger TOUT le reste du français (≈ 150 Ko) à l'ouverture de Ventes.
  // Et la feuille « Depuis ta dernière visite » (src/capteNotif/FeuilleArrivee.jsx), montée par la coque dès la connexion :
  // selon le moment où elle arrive, elle faisait télécharger le reste du français à l'ouverture de n'importe quel écran.
  for (const p of [path.join(R, 'src', 'ecrans', 'Comptabilite.jsx'), path.join(R, 'src', 'natif', 'ecrans', 'RelancesVentes.jsx'), path.join(R, 'src', 'capteNotif', 'FeuilleArrivee.jsx')]) { try { if (fs.statSync(p).isFile()) for (const g of fermer([p])) demarrage.add(g); } catch (_) {} }
  // toutes les entrées à la demande atteignables
  const entrees = new Set();
  const aVoir = [...demarrage];
  const vusE = new Set();
  while (aVoir.length) {
    const f = aVoir.pop(); if (vusE.has(f)) continue; vusE.add(f);
    for (const d of L(f).dyn) { if (!demarrage.has(d)) entrees.add(d); for (const g of fermer([d])) aVoir.push(g); }
  }
  // le vocabulaire du démarrage
  const exacts = new Set(), prefixes = new Set(), suffixes = new Set();
  const verser = (o) => { for (const w of o.exacts) exacts.add(w); for (const w of o.prefixes) prefixes.add(w); for (const w of o.suffixes) suffixes.add(w); };
  for (const f of demarrage) if (!estDico(f)) verser(L(f));
  const ailleurs = [];
  for (const d of ['api', 'public', 'vinted-sync-extension']) listerFichiers(path.join(R, d), ailleurs, /\.(m?js|cjs|html|json)$/);
  for (const f of Object.keys(textes || {})) if (/[\\/](api|public|vinted-sync-extension)[\\/]/.test(path.relative(R, f).replace(/^/, '/')) && !ailleurs.includes(f)) ailleurs.push(f);
  for (const f of ailleurs) { let s = ''; try { s = textes && textes[f] != null ? textes[f] : fs.readFileSync(f, 'utf8'); } catch (_) {} for (const w of s.match(/[A-Za-z0-9_.-]+/g) || []) exacts.add(w); }
  const P = [...prefixes], S = [...suffixes];
  const lue = (k, ex, pr, su) => ex.has(k) || pr.some((p) => k.startsWith(p)) || su.some((s) => k.endsWith(s));
  const base = {}, reste = {};
  for (const [k, v] of Object.entries(fr)) (lue(k, exacts, P, S) ? base : reste)[k] = v;
  // (26 nov., vocabulaire-article) `cle.art` (la forme « article » d'une clé, choisie par t() hors Sneakers)
  // part AVEC sa clé : t() la lit chaque fois qu'il lit `cle`.
  for (const k of Object.keys(fr)) {
    if (!/\.art$/.test(k)) continue;
    const b = k.slice(0, -4);
    if (!(b in fr)) continue;
    if (b in base) { base[k] = fr[k]; delete reste[k]; } else { reste[k] = fr[k]; delete base[k]; }
  }
  const clesReste = Object.keys(reste);
  // les entrées qui PEUVENT lire une clé du reste (elles importent fr-reste en premier)
  const injecter = new Set();
  for (const e of entrees) {
    const ex = new Set(), pr = new Set(), su = new Set();
    for (const g of fermer([e])) { if (estDico(g) || demarrage.has(g)) continue; const o = L(g); o.exacts.forEach((w) => ex.add(w)); o.prefixes.forEach((w) => pr.add(w)); o.suffixes.forEach((w) => su.add(w)); }
    const PP = [...pr], SS = [...su];
    if (clesReste.some((k) => lue(k, ex, PP, SS))) injecter.add(e);
  }
  return { base, reste, demarrage, entrees, injecter };
}

module.exports = { analyser, dictionnaire, creer };
