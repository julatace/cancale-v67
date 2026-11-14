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
    ['main.jsx empêche l’erreur (import résolu à undefined)', MAIN, '    window.location.reload();\n  });', '    ev.preventDefault();\n    window.location.reload();\n  });'],
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
  dit(/compterMorceauPerime\(ev && ev\.payload\);[\s\S]*?window\.location\.reload\(\);/.test(bloc), 'main.jsx compte le morceau PUIS recharge (le rechargement le rattrape)', bloc.slice(0, 300));
  // (14 nov., fiabilité prod) LE VRAI `preload` DE VITE, EXÉCUTÉ avec le VRAI gestionnaire de main.jsx.
  // Mesuré dans la base (`plantage_*`, `plantages_terrain_*`) : 64 écrans tombés du 10 au 12 nov. sur
  // « undefined is not an object (evaluating 'e.FactureVente') », « …reading 'default' » — l'import
  // rendait `undefined` parce que main.jsx appelait `ev.preventDefault()`. Il doit être REJETÉ avec sa
  // vraie raison (un morceau périmé, compté à part), jamais résolu à `undefined`.
  await (async () => {
    const VITE = path.join(R, 'node_modules', 'vite', 'dist', 'node', 'chunks');
    let src = '';
    try { for (const f of fs.readdirSync(VITE)) { const t = fs.readFileSync(path.join(VITE, f), 'utf8'); const a = t.indexOf('function preload(baseModule, deps, importerUrl) {'); if (a >= 0) { src = t.slice(a, t.indexOf('\nfunction buildImportAnalysisPlugin', a)); break; } } } catch (_) {}
    dit(src.length > 200 && /vite:preloadError/.test(src) && /baseModule\(\)\.catch\(handlePreloadError\)/.test(src), 'le `preload` de Vite est trouvé dans node_modules (celui qui part dans le build)', src.slice(0, 120));
    if (!src) return;
    // Une fausse fenêtre : le gestionnaire de main.jsx, un rechargement compté, une CSS et un JS introuvables.
    const ecoutes = [];
    let recharges = 0, comptes = 0;
    const sess = new Map();
    const fen = { addEventListener: (t, f) => { if (t === 'vite:preloadError') ecoutes.push(f); }, dispatchEvent: (e) => { for (const f of ecoutes) f(e); return true; }, location: { reload: () => { recharges++; } } };
    class Ev { constructor(t, o) { this.type = t; this.cancelable = !!(o && o.cancelable); this.defaultPrevented = false; } preventDefault() { if (this.cancelable) this.defaultPrevented = true; } }
    const doc = { getElementsByTagName: () => [], querySelector: () => null, head: { appendChild: (l) => { if (/\.css$/.test(l.href)) setTimeout(() => (l._err || []).forEach((f) => f()), 1); } }, createElement: () => ({ relList: { supports: () => true }, setAttribute() {}, addEventListener(t, f) { if (t === 'error') (this._err = this._err || []).push(f); } }) };
    const blocMain = main.slice(i, main.indexOf('});', i) + 3);
    // eslint-disable-next-line no-new-func
    new Function('window', 'sessionStorage', 'compterMorceauPerime', blocMain)(fen, { getItem: (k) => (sess.has(k) ? sess.get(k) : null), setItem: (k, v) => sess.set(k, String(v)) }, () => { comptes++; });
    // eslint-disable-next-line no-new-func
    const preload = new Function('window', 'document', 'Event', 'seen', 'assetsURL', 'scriptRel', '__VITE_IS_MODERN__', src + '\nreturn preload;')(fen, doc, Ev, {}, (d) => d, 'modulepreload', true);
    const absent = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://vrm.center/assets/FacturePro-ancien.js'));
    let issue = 'en attente';
    try { const m = await preload(absent, ['assets/FacturePro-ancien.css'], ''); issue = m === undefined ? 'résolu à undefined' : 'résolu'; }
    catch (e) { issue = 'rejeté : ' + String((e && e.message) || e); }
    dit(/^rejeté/.test(issue), 'un morceau introuvable : l’import est REJETÉ, jamais résolu à `undefined` (React.lazy lirait `undefined.default`)', issue);
    dit(/^rejeté/.test(issue) && P.estMorceauPerime(issue.replace(/^rejeté : /, '')), 'sa raison est celle d’un morceau périmé (comptée à part, jamais notée comme plantage)', issue);
    dit(recharges === 1 && comptes >= 1, 'la page se recharge quand même, une fois, après avoir compté le morceau', `recharges=${recharges} comptes=${comptes}`);
    // Le même chemin que FactureVente (App.jsx) : `.then((m) => ({ default: m.FactureVente }))`.
    let lazyErr = '';
    sess.clear();
    try { await preload(absent, [], '').then((m) => ({ default: m.FactureVente })); } catch (e) { lazyErr = String((e && e.message) || e); }
    dit(lazyErr && P.estMorceauPerime(lazyErr) && !/FactureVente|reading 'default'/.test(lazyErr), 'un écran nommé (`m.FactureVente`) reçoit l’erreur du morceau, pas « undefined is not an object »', lazyErr);
  })();
  dit(/if \(Date\.now\(\) - dernier < 60000\) return;/.test(bloc), 'une fois par minute au plus (jamais une boucle de rechargements)');
  dit(!/fetch\(|rest\/v1/.test(fs.readFileSync(PL, 'utf8').slice(fs.readFileSync(PL, 'utf8').indexOf('export function compterMorceauPerime'), fs.readFileSync(PL, 'utf8').indexOf('// ⚠️ Revue adverse du 4 octobre'))), 'le compte reste sur l’appareil (aucune écriture vers la base)');
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ un morceau d’un ancien déploiement est compté à part, jamais noté comme plantage');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
