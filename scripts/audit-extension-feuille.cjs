#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA FEUILLE ET LES TEXTES COMMUNS DE L'EXTENSION (5.406, 17 nov. — vrm-ui.js)
//
//  Julien : « fait tout mieux sur l'extension ». UNE feuille et UN jeu de pièces ;
//  chaque texte neuf en cinq langues. On EXÉCUTE le vrai vrm-ui.js (dans un vm) :
//   L1. chaque clé de `MOTS` a ses cinq langues (fr, en, es, it, de), non vides ;
//   L2. les mêmes {variables} dans les cinq ;
//   L3. chaque `TU('clé')` / `T('clé')` de vrm-badge.js et vrm-action.js existe dans MOTS
//       (une clé absente afficherait son nom) ;
//   L4. la langue suit le navigateur (en ⇒ anglais), une langue inconnue ⇒ le français ;
//   S1. les messages brefs et bandeaux de lbc.js, vc-depot.js, ebay.js passent par
//       `VRM_UI.habiller` (plus de style noir en ligne propre à chaque fichier) ;
//   S2. la carte, l'écran plein, la ligne sous les annonces et l'alerte de dépôt montent la
//       feuille commune (`monter`) ; le manifeste charge vrm-ui.js AVANT chacun de ces fichiers,
//       et la fenêtre (popup.html) aussi ;
//   S3. l'écran plein : shadow root fermée, aucune saisie simulée.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2);
const EXT0 = path.join(__dirname, '..', 'vinted-sync-extension');
const MUTATIONS = {
  langue: ['vrm-ui.js', "de: 'Nachrichten an Favoriten' },", "},"],
  variable: ['vrm-ui.js', "en: 'next in {dans}'", "en: 'next in {quand}'"],
  cle: ['vrm-badge.js', "TU('c_normal')", "TU('c_normal_absente')"],
  habiller: ['vc-depot.js', "if (globalThis.VRM_UI) globalThis.VRM_UI.habiller(el, 'toast'); else ", ''],
  manifeste: ['manifest.json', '"vrm-ui.js",\n        "vrm-mots.js",\n        "vrm-badge.js"', '"vrm-mots.js",\n        "vrm-badge.js"'],
  ferme: ['vrm-action.js', "attachShadow({ mode: 'closed' })", "attachShadow({ mode: 'open' })"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe' }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const lire = (f) => {
  let s = ''; try { s = fs.readFileSync(path.join(EXT0, f), 'utf8'); } catch (_) { s = ''; }
  if (mut && MUTATIONS[mut][0] === f) { if (!s.includes(MUTATIONS[mut][1])) { console.log('mutation introuvable : ' + mut); process.exit(2); } s = s.split(MUTATIONS[mut][1]).join(MUTATIONS[mut][2]); }
  return s;
};
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 600) : ''}`); } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const UI = lire('vrm-ui.js');
const charger = (langue) => {
  const ctx = { navigator: { language: langue }, chrome: { i18n: { getUILanguage: () => langue } }, document: { createElement: () => ({ setAttribute() {}, appendChild() {} }) } };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(UI, ctx); return ctx.VRM_UI;
};
let U = null;
try { U = charger('fr-FR'); } catch (e) { dit(false, 'vrm-ui.js s’exécute', e.message); }
console.log('\nL. Les textes, en cinq langues');
if (U) {
  const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const manque = [], diff = [];
  for (const [k, m] of Object.entries(U.MOTS)) {
    for (const l of LANGUES) if (!m[l] || !String(m[l]).trim()) manque.push(`${k}.${l}`);
    for (const l of LANGUES) if (m[l] && vars(m[l]) !== vars(m.fr)) diff.push(`${k}.${l}`);
  }
  dit(Object.keys(U.MOTS).length > 40, `des textes communs (${Object.keys(U.MOTS).length} clés)`);
  dit(!manque.length, 'L1 · chaque clé a ses cinq langues', manque.join(', '));
  dit(!diff.length, 'L2 · les mêmes {variables} dans les cinq langues', diff.join(', '));
  const utilisees = new Set();
  for (const f of ['vrm-badge.js', 'vrm-action.js']) for (const m of sansCommentaires(lire(f)).matchAll(/\b(?:TU|T)\(\s*'([a-z]{1,3}_[a-z0-9_]+)'/g)) utilisees.add(m[1]);
  // Les clés composées (`TU('fa_' + k)`, la table QUOI) : la liste écrite dans le code.
  for (const m of sansCommentaires(lire('vrm-badge.js') + lire('vrm-action.js')).matchAll(/'(q_[a-z]+)'/g)) utilisees.add(m[1]);
  for (const m of sansCommentaires(lire('vrm-action.js')).matchAll(/'(a_[a-z]+)'/g)) utilisees.add(m[1]);
  const fa = /\[([^\]]+)\]\.includes\(k\) \? TU\('fa_' \+ k\)/.exec(sansCommentaires(lire('vrm-badge.js')));
  if (fa) for (const m of fa[1].matchAll(/'([a-z_]+)'/g)) utilisees.add('fa_' + m[1]);
  const absentes = [...utilisees].filter((k) => !U.MOTS[k]);
  dit(utilisees.size > 20 && !absentes.length, `L3 · chaque clé utilisée existe (${utilisees.size} clés utilisées)`, absentes.join(', '));
  const en = charger('en-GB'), xx = charger('pt-BR');
  dit(en.T('c_tout_arreter') === 'Stop everything' && en.T('f_prochain', { dans: '3 min' }) === 'next in 3 min', 'L4 · la langue du navigateur (anglais)');
  dit(xx.T('c_tout_arreter') === 'Tout arrêter', 'L4 · une langue inconnue ⇒ le français');
}
console.log('\nS. Une feuille, un jeu de pièces');
for (const f of ['lbc.js', 'vc-depot.js', 'ebay.js']) {
  const s = sansCommentaires(lire(f));
  const n = (s.match(/VRM_UI\.habiller\(el, '(toast|bandeau)'\)/g) || []).length;
  dit(n >= 2, `S1 · ${f} : message bref et bandeau habillés par la feuille commune`, `${n} sur 2`);
}
for (const f of ['vrm-badge.js', 'vrm-action.js', 'vinted-infos.js', 'vinted-capture.js']) dit(/\.monter\(/.test(sansCommentaires(lire(f))), `S2 · ${f} monte la feuille commune`);
let man = null; try { man = JSON.parse(lire('manifest.json')); } catch (_) { man = null; }
const fautes = [];
for (const cs of (man && man.content_scripts) || []) {
  const js = cs.js || [];
  for (const f of ['vrm-badge.js', 'vrm-action.js', 'vinted-infos.js', 'vinted-capture.js', 'lbc.js', 'vc-depot.js', 'ebay.js']) {
    const i = js.indexOf(f); if (i < 0) continue;
    const u = js.indexOf('vrm-ui.js'); if (u < 0 || u > i) fautes.push(`${f} (${(cs.matches || [])[0]})`);
  }
}
dit(man && !fautes.length, 'S2 · le manifeste charge vrm-ui.js avant chaque surface', fautes.join(', '));
const pop = lire('popup.html'); const iu = pop.indexOf('src="vrm-ui.js"'), ip = pop.indexOf('src="popup.js"');
dit(iu > 0 && iu < ip, 'S2 · la fenêtre de l’icône charge vrm-ui.js avant popup.js');
const act = sansCommentaires(lire('vrm-action.js'));
dit(/attachShadow\(\{\s*mode:\s*'closed'\s*\}\)/.test(act), 'S3 · l’écran plein : shadow root fermée');
dit(!/dispatchEvent|isTrusted|\.click\(\)|new (Mouse|Keyboard|Pointer|Input)Event/.test(act), 'S3 · aucune saisie simulée');
console.log(`\n${ko ? '❌' : '✅'} audit-extension-feuille : ${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
