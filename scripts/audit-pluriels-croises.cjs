#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// UN PLURIEL S'ACCORDE À SON NOMBRE — node scripts/audit-pluriels-croises.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (20 nov., chasse-bugs-2) `tr()` choisit la forme (« one » / « other ») sur `{n}` SEUL (src/i18n/index.js). Une clé
// qui porte un AUTRE nombre suivi d'un mot qui change entre ses formes l'accorde au mauvais nombre : mesuré sur
// Aujourd'hui, « 2 colis · 1 points » (`v2.retirer.resume`, `{p} point(s)` réglé par `{n}`). Règle : dans une clé
// à pluriels, seul le mot qui suit `{n}` peut changer d'une forme à l'autre après un nombre ; un autre nombre a
// sa propre clé. Lit les cinq langues.
'use strict';
// Vérifiées à la main (20 nov.) : l'appelant passe `n` ÉGAL à l'autre nombre, ou l'autre champ n'est pas un nombre.
const VERIFIEES = new Set([
  'v2.obj.detail',        // src/natif/ecrans/Aujourdhui.jsx : { j: o.jours, n: o.jours }
  'v2.st.jours',          // { n: mediane, j: nombre(mediane) }
  'fd.etat.enVenteDepuis', // src/ficheProduit.js : { j: j.n, n: j.n }
  'etag.descendus', 'etag.descendusCrans',   // {liste} : des N°, le verbe s'accorde à leur nombre {n}
  // (intégration 21 nov., journee-stats) vérifiées à la main : { n: x.n, k: nombre(x.n) } (StatsTransporteurs.jsx:80),
  // { n: Se.jours, j: nombre(Se.jours) } (StatsPilotage.jsx:63) — `n` est le MÊME nombre, écrit groupé.
  'v2.pt.nColis', 'v2.ps.jours',
]);
const VERIFIEES_PREFIXE = /^nc\.lib\./;   // {site} : un nom de site (« Vinted sale(s) »), pas un nombre
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const D = path.join(R, 'src', 'i18n', 'langues');
let rouges = [];
for (const l of fs.readdirSync(D)) {
  const dir = path.join(D, l); if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter((x) => /\.js$/.test(x))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // Les entrées à pluriels : "cle": { "one": "…", "other": "…" }
    for (const m of src.matchAll(/"([^"]+)":\s*\{((?:\s*"(?:zero|one|two|few|many|other)":\s*"(?:[^"\\]|\\.)*",?)+)\s*\}/g)) {
      const formes = {}; for (const x of m[2].matchAll(/"(zero|one|two|few|many|other)":\s*"((?:[^"\\]|\\.)*)"/g)) formes[x[1]] = x[2];
      if (!formes.one || !formes.other) continue;
      const apres = (t) => { const o = {}; for (const x of t.matchAll(/\{(\w+)\}\s*([^\s{}·,.;:!?()]+)/g)) if (!(x[1] in o)) o[x[1]] = x[2]; return o; };
      const a = apres(formes.one), b = apres(formes.other);
      for (const k of Object.keys(b)) if (k !== 'n' && a[k] != null && a[k] !== b[k] && !VERIFIEES.has(m[1]) && !VERIFIEES_PREFIXE.test(m[1])) rouges.push(`${l}/${f} ${m[1]} : « {${k}} ${a[k]} » / « {${k}} ${b[k]} » réglé par {n}`);
    }
  }
}
// Seconde règle, ciblée : les lignes d'état d'une fiche et la prévision (le nombre de jours peut valoir 0 ou 1).
const CIBLEES = ['fd.etat.enVenteSitesDepuis', 'fd.etat.enVenteSansPrixDepuis', 'fd.etat.enVenteSansPrixSitesDepuis', 'v2.st.prev.jours'];
for (const l of fs.readdirSync(D)) {
  const dir = path.join(D, l); if (!fs.statSync(dir).isDirectory()) continue;
  const tout = fs.readdirSync(dir).filter((x) => /\.js$/.test(x)).map((x) => fs.readFileSync(path.join(dir, x), 'utf8')).join('\n');
  for (const k of CIBLEES) { const m = new RegExp('"' + k.replace(/\./g, '\\.') + '":\\s*"').exec(tout); if (m) rouges.push(`${l} ${k} : une chaîne sans pluriel pour un nombre de jours qui peut valoir 1`); }
}
for (const r of rouges) console.log('❌ ' + r);
console.log(rouges.length ? `❌ audit-pluriels-croises : ${rouges.length} clé(s) accordent un nombre au pluriel d'un autre` : '✅ audit-pluriels-croises : chaque nombre a son pluriel');
process.exit(rouges.length ? 1 : 0);
