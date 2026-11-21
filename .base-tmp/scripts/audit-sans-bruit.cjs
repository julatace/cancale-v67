#!/usr/bin/env node
// audit-sans-bruit.cjs — le seul « bruit » des journaux de production (DEP0169)
// est retiré, et RIEN d'autre.
//
// Mesuré le 20 octobre (Vercel, « runtime errors », 7 jours) : 1 336 lignes
// `[DEP0169] url.parse()`, émises par la plateforme Node 24 (et `web-push`),
// sur 6 routes — 100 % des « erreurs » affichées. Une vraie erreur s'y noyait.
//
// Ce que l'audit EXÉCUTE (un processus neuf par route, `--pending-deprecation`
// fait émettre DEP0169 par le Node du banc comme le fait Node 24 en production) :
//   1. chaque route `api/*.js` importe `./_lib/sans-bruit.js` en PREMIER ;
//   2. route chargée pour de vrai, puis `url.parse()` : aucune ligne DEP0169 ;
//   3. l'autre sens : une AUTRE dépréciation (DEP0999), un avertissement sans
//      code et un avertissement passé en objet `Error` sortent toujours.
//      (Couper tous les avertissements passerait le point 2 : c'est faux.)
//
// --src <dossier> : lance l'audit sur une copie de `api/` (mutations, §6.1).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ici = path.join(__dirname, '..');
const iSrc = process.argv.indexOf('--src');
const API = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(ici, 'api');

let ko = 0, ok = 0;
const ctl = (cond, msg, detail) => {
  if (cond) { ok++; console.log('  ✅ ' + msg); }
  else { ko++; console.log('  ❌ ' + msg + (detail ? ' — ' + detail : '')); }
};

const routes = fs.readdirSync(API).filter((n) => n.endsWith('.js')).sort();
console.log(`\n1. Chaque route importe sans-bruit EN PREMIER (${routes.length} routes)`);
ctl(routes.length === 12, `12 fonctions serverless (trouvé ${routes.length})`);
for (const n of routes) {
  const s = fs.readFileSync(path.join(API, n), 'utf8');
  const premier = (s.match(/^import\s+[^\n]*$/m) || [''])[0];
  ctl(/^import\s+['"]\.\/_lib\/sans-bruit\.js['"];?\s*$/.test(premier), `${n} : premier import = sans-bruit`, premier || 'aucun import');
}

const lance = (code) => spawnSync(process.execPath, ['--pending-deprecation', '--input-type=module', '-e', code], {
  encoding: 'utf8', timeout: 20000,
  env: Object.assign({}, process.env, { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_KEY: '', VRM_OWNER_UID: '' }),
});

console.log('\n2. Route chargée pour de vrai, puis url.parse() : aucune ligne DEP0169');
// Contrôle du banc lui-même : sans la route, ce Node émet bien DEP0169.
const temoin = lance("import url from 'url'; url.parse('https://a.example/b?c=1');");
ctl(/DEP0169/.test(temoin.stderr), 'témoin : ce Node émet DEP0169 sans le filtre (sinon le contrôle serait vacant)');
for (const n of routes) {
  const r = lance(`await import(${JSON.stringify('file://' + path.join(API, n))}); const url = (await import('url')).default; url.parse('https://a.example/b?c=1');`);
  const charge = r.status === 0;
  ctl(charge, `${n} : se charge`, (r.stderr || '').split('\n').find((l) => /Error/.test(l)) || `code ${r.status}`);
  ctl(!/DEP0169/.test(r.stderr || ''), `${n} : aucune ligne DEP0169`, 'la ligne est sortie');
}

console.log('\n3. L\'autre sens : tout autre avertissement sort');
const autre = lance(`await import(${JSON.stringify('file://' + path.join(API, '_lib', 'sans-bruit.js'))});
process.emitWarning('autre-depreciation', 'DeprecationWarning', 'DEP0999');
process.emitWarning('avertissement-simple');
const e = new Error('en-objet'); e.name = 'DeprecationWarning'; e.code = 'DEP0998'; process.emitWarning(e);
process.emitWarning('option-objet', { type: 'DeprecationWarning', code: 'DEP0997' });
const f = new Error('url-objet'); f.name = 'DeprecationWarning'; f.code = 'DEP0169'; process.emitWarning(f);
process.emitWarning('url-option', { type: 'DeprecationWarning', code: 'DEP0169' });`);
const err = autre.stderr || '';
ctl(autre.status === 0, 'le filtre se charge', err.split('\n').find((l) => /Error/.test(l)) || '');
ctl(/DEP0999/.test(err), 'une autre dépréciation (DEP0999) sort');
ctl(/avertissement-simple/.test(err), 'un avertissement sans code sort');
ctl(/DEP0998/.test(err), 'un avertissement passé en objet Error sort');
ctl(/DEP0997/.test(err), 'un avertissement à options sort');
ctl(!/url-objet|url-option/.test(err), 'DEP0169 sous ses trois formes est retiré');

console.log(`\n${ko ? '❌' : '✅'} audit-sans-bruit : ${ok} verts, ${ko} rouges`);
process.exit(ko ? 1 : 0);
