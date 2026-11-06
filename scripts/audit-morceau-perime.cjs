// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : UN MORCEAU D'UN ANCIEN DÉPLOIEMENT N'EST PAS UN PLANTAGE
//         node scripts/audit-morceau-perime.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 3) « Unable to preload CSS for /assets/App-….css » (iOS Safari,
// après une mise en ligne) était noté comme plantage. Il est rattrapé par le
// rechargement de main.jsx (`vite:preloadError`) et COMPTÉ À PART sur l'appareil
// (`vrm_morceaux_perimes`). Cet audit EXÉCUTE le vrai src/plantages.js (un faux
// localStorage, une fausse fenêtre) :
//   1. les quatre formes d'un morceau introuvable (Chrome, Safari, Firefox, CSS)
//      ne vont PAS dans la file des plantages, et sont comptées à part ;
//   2. une vraie erreur de l'app y va toujours ;
//   3. main.jsx compte le morceau AVANT de recharger, une fois par minute au plus ;
//   4. aucun octet de plus vers la base (le compte reste sur l'appareil).
// Le comportement dans l'app rendue : scripts/bancs/morceau-perime.cjs.
// `--prouve` : chaque mutation réaffaiblit la règle ; l'audit doit devenir rouge.
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const PL = path.join(R, 'src', 'plantages.js');
const MAIN = path.join(R, 'src', 'main.jsx');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['morceau noté comme plantage', PL, '    if (message && estMorceauPerime(message)) { compterMorceauPerime(err); return null; }\n', ''],
    ['CSS oubliée', PL, 'Unable to preload CSS|', ''],
    ['Safari oublié', PL, 'Failed to fetch dynamically imported module|Importing a module script failed|', 'Failed to fetch dynamically imported module|'],
    ['compte jamais écrit', PL, '    ecrire(MORCEAUX, { n, message, at: new Date().toISOString() });\n', ''],
    ['main.jsx ne compte plus', MAIN, '    compterMorceauPerime(ev && ev.payload);\n', ''],
    ['main.jsx recharge en boucle', MAIN, '    if (Date.now() - dernier < 60000) return;\n', ''],
  ];
  let rouges = 0;
  const origines = new Map();
  const remettre = () => { for (const [f, t] of origines) fs.writeFileSync(f, t); };
  process.on('exit', remettre);
  for (const [nom, f, avant, apres] of MUTS) {
    const src = origines.get(f) || fs.readFileSync(f, 'utf8');
    origines.set(f, src);
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : le motif n'existe plus`); rouges = -999; continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 120000 });
      const rouge = r.status !== 0;
      if (rouge) rouges++;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  remettre();
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };

// Un faux navigateur : localStorage, window, navigator.
const store = new Map();
global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
global.window = { dispatchEvent() {}, addEventListener() {} };
global.CustomEvent = class { constructor(t) { this.type = t; } };
try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' }, configurable: true }); } catch (_) {}
const lireJ = (k) => { try { return JSON.parse(store.get(k) || 'null'); } catch (_) { return null; } };

(async () => {
  const P = await import(require('url').pathToFileURL(PL).href);
  const formes = [
    'Unable to preload CSS for /assets/App-CM2cYfGZ.css',
    'Failed to fetch dynamically imported module: https://vrm.center/assets/Communaute-AbCdEf12.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://vrm.center/assets/BoiteEmails-x1.js',
  ];
  for (const m of formes) {
    const e = new Error(m); e.stack = `Error: ${m}\n    at https://vrm.center/assets/index-B6YY0tpI.js:1:2`;
    dit(P.noterPlantage(e, { ecran: 'emails' }) === null, `« ${m.slice(0, 48)}… » n’est pas noté comme plantage`);
  }
  const file = lireJ('vrm_plantages_attente') || [];
  dit(!file.some((x) => formes.some((f) => (x.message || '').startsWith(f.slice(0, 20)))), 'la file des plantages (vers la base) ne porte aucun morceau', JSON.stringify(file));
  const c = lireJ('vrm_morceaux_perimes');
  dit(c && c.n === formes.length && /module|preload/i.test(c.message || '') && c.at, 'chaque morceau est compté À PART sur l’appareil (nombre, dernier message, date)', JSON.stringify(c));
  const vraie = new Error("Cannot read properties of undefined (reading 'title')"); vraie.stack = `TypeError: x\n    at https://vrm.center/assets/App-DV9TEkKC.js:1:2`;
  const n = P.noterPlantage(vraie, { ecran: 'ventes' });
  dit(n && (lireJ('vrm_plantages_attente') || []).some((x) => x.ecran === 'ventes'), 'une vraie erreur de l’app est toujours notée (avec son écran)');
  dit(P.estMorceauPerime('Unable to preload CSS for /assets/x.css') && !P.estMorceauPerime("Cannot access 'xe' before initialization"), 'la règle `estMorceauPerime` est exportée (la veille du cron la lit)');
  // main.jsx : le morceau compté avant le rechargement, une fois par minute au plus.
  const main = fs.readFileSync(MAIN, 'utf8');
  const i = main.indexOf("window.addEventListener('vite:preloadError'");
  const bloc = i >= 0 ? main.slice(i, main.indexOf('});', i)) : '';
  dit(/compterMorceauPerime\(ev && ev\.payload\);\s*\n\s*ev\.preventDefault\(\);\s*\n\s*window\.location\.reload\(\);/.test(bloc), 'main.jsx compte le morceau PUIS recharge (le rechargement le rattrape)', bloc.slice(0, 300));
  dit(/if \(Date\.now\(\) - dernier < 60000\) return;/.test(bloc), 'une fois par minute au plus (jamais une boucle de rechargements)');
  dit(!/fetch\(|rest\/v1/.test(fs.readFileSync(PL, 'utf8').slice(fs.readFileSync(PL, 'utf8').indexOf('export function compterMorceauPerime'), fs.readFileSync(PL, 'utf8').indexOf('// ⚠️ Revue adverse du 4 octobre'))), 'le compte reste sur l’appareil (aucune écriture vers la base)');
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ un morceau d’un ancien déploiement est compté à part, jamais noté comme plantage');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
