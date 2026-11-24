// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « MORCEAUX PÉRIMÉS » (24 nov.) — les règles PURES du chantier, exécutées.
//  Le banc (scripts/bancs/morceaux-perimes.cjs) juge le tout dans un navigateur ;
//  ici, sans navigateur, ce qui se lit :
//   1. `momentSur` : jamais un rechargement avec un texte en cours ou une feuille ouverte ;
//   2. `adresseDeRetour` : le rechargement repart SUR l'écran ouvert ;
//   3. `verifierMorceauPerime` : un préchargement de fond (« preload ») ne recharge
//      jamais sous les yeux ;
//   4. `fichiersDeLaVersion` : la page ne fait ranger que les fichiers de SA version ;
//   5. le service worker : son ménage garde les fichiers des pages OUVERTES ;
//   6. main.jsx appelle la réserve de la page ; vite.config.js publie les polices.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d != null ? ' — ' + d : '')); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

(async () => {
  const cs = await import(pathToFileURL(path.join(R, 'src', 'chargementSur.js')).href);
  const rm = await import(pathToFileURL(path.join(R, 'src', 'reserveMorceaux.js')).href);

  // 1. momentSur
  const doc = (active, modal = false) => ({ activeElement: active, querySelector: (s) => (modal && /aria-modal/.test(s) ? {} : null) });
  const champ = { tagName: 'INPUT', type: 'search' }, bouton = { tagName: 'BUTTON' }, coche = { tagName: 'INPUT', type: 'checkbox' };
  dit(cs.momentSur(doc(bouton), { history: { state: {} } }) === true, '1 rien en cours : moment sûr');
  dit(cs.momentSur(doc(coche), { history: { state: {} } }) === true, '1 une case cochée n’est pas une saisie');
  dit(cs.momentSur(doc(champ), { history: { state: {} } }) === false, '1 un champ de texte en cours : PAS sûr');
  dit(cs.momentSur(doc({ tagName: 'TEXTAREA' }), {}) === false, '1 une zone de texte en cours : PAS sûr');
  dit(cs.momentSur(doc(bouton), { __vrmFeuilles: 1, history: { state: {} } }) === false, '1 une feuille ouverte (FermeAuRetour) : PAS sûr');
  dit(cs.momentSur(doc(bouton, true), {}) === false, '1 une boîte aria-modal : PAS sûr');
  dit(cs.momentSur(doc(bouton), { history: { state: { vrmFeuille: 'f1' } } }) === false, '1 l’historique porte une feuille : PAS sûr');
  dit(cs.momentSur(null) === false, '1 pas de document : PAS sûr');

  // 2. adresseDeRetour
  dit(cs.adresseDeRetour({ pathname: '/', search: '', hash: '' }, { vrmTab: 'settings' }) === '/?tab=settings', '2 adresse nettoyée + écran Réglages ⇒ /?tab=settings');
  dit(cs.adresseDeRetour({ pathname: '/', search: '?tab=achats', hash: '' }, { vrmTab: 'settings' }) === null, '2 une adresse qui porte déjà son écran est gardée telle quelle');
  dit(cs.adresseDeRetour({ pathname: '/', search: '?x=1', hash: '' }, { vrmTab: 'achats' }) === '/?x=1&tab=achats', '2 les autres paramètres restent');
  dit(cs.adresseDeRetour({ pathname: '/', search: '', hash: '' }, { vrmTab: 'javascript:alert(1)' }) === null, '2 un écran mal formé n’est jamais écrit dans l’adresse');
  dit(cs.adresseDeRetour({ pathname: '/', search: '', hash: '' }, null) === null, '2 pas d’état : rien');

  // 3. verifierMorceauPerime : un préchargement de fond ne recharge jamais tout de suite (exécuté avec une page factice)
  {
    const ecoute = {}; let recharge = 0;
    global.window = { location: { pathname: '/', search: '', hash: '', reload: () => { recharge++; } }, history: { state: { vrmTab: 'achats' }, replaceState() {} }, dispatchEvent() {}, addEventListener() {} };
    global.document = { visibilityState: 'visible', activeElement: bouton, querySelector: (s) => (/index-/.test(s) ? { getAttribute: () => '/assets/index-AAAA.js' } : null), querySelectorAll: () => [], addEventListener: (t, f) => { ecoute[t] = f; }, removeEventListener: (t) => { delete ecoute[t]; } };
    Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true });
    global.sessionStorage = { _: {}, getItem(k) { return this._[k] || null; }, setItem(k, v) { this._[k] = String(v); } };
    global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ index: '/assets/index-BBBB.js' }) });
    const r1 = await cs.verifierMorceauPerime('preload');
    dit(r1 === false && recharge === 0, '3 préchargement de fond raté, nouvelle version : AUCUN rechargement sous les yeux', `rendu ${r1}, ${recharge} rechargement(s)`);
    dit(typeof ecoute.visibilitychange === 'function', '3 … la page se relira quand elle sera cachée');
    global.document.visibilityState = 'hidden';
    ecoute.visibilitychange(); await new Promise((r) => setTimeout(r, 1700));
    dit(recharge === 1, '3 page cachée, rien en cours : UN rechargement (invisible)', `${recharge}`);
    // Un écran demandé (« morceau »), mais un texte en cours : rien.
    global.sessionStorage._ = {}; recharge = 0; global.document.visibilityState = 'visible'; global.document.activeElement = champ;
    await new Promise((r) => setTimeout(r, 2100));   // la version du serveur relue à neuf
    const r2 = await cs.verifierMorceauPerime('morceau');
    dit(r2 === false && recharge === 0, '3 écran demandé avec un texte en cours : AUCUN rechargement (l’écran dit « Mettre à jour VRM »)', `rendu ${r2}, ${recharge}`);
    global.document.activeElement = bouton;
    await new Promise((r) => setTimeout(r, 2100));
    const r3 = await cs.verifierMorceauPerime('morceau');
    await new Promise((r) => setTimeout(r, 1700));
    dit(r3 === true && recharge === 1, '3 écran demandé, moment sûr : rechargé tout de suite', `rendu ${r3}, ${recharge}`);
    for (const k of ['window', 'document', 'sessionStorage', 'fetch']) delete global[k];
  }

  // 4. fichiersDeLaVersion
  const j = { fichiers: ['/assets/index-AAAA.js', '/assets/App-x.js', '/assets/App-x.css', 'https://ailleurs/x.js'], langues: { en: ['/assets/en-1.js'] }, polices: ['/assets/inter-1.woff2'] };
  const l = rm.fichiersDeLaVersion(j, '/assets/index-AAAA.js', 'fr');
  dit(Array.isArray(l) && l.includes('/assets/App-x.js') && l.includes('/assets/inter-1.woff2') && !l.includes('/assets/en-1.js') && !l.some((x) => /ailleurs/.test(x)), '4 la liste de SA version : morceaux + polices, la langue du vendeur seule, rien d’ailleurs', JSON.stringify(l));
  dit((rm.fichiersDeLaVersion(j, '/assets/index-AAAA.js', 'en') || []).includes('/assets/en-1.js'), '4 en anglais : le dictionnaire anglais en plus');
  dit(rm.fichiersDeLaVersion(j, '/assets/index-BBBB.js') === null, '4 le serveur sert une AUTRE version : rien n’est demandé (ses fichiers ne sont pas ceux de la page)');

  // 5. le service worker
  const sw = sansCommentaires(fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8'));
  const purge = (sw.match(/async function purgerAncienneVersion[\s\S]*?\n}\n/) || [''])[0];
  dit(/nomsDesPagesOuvertes\(cache\)/.test(purge), '5 le ménage garde les fichiers des pages OUVERTES (`nomsDesPagesOuvertes`)');
  dit(/VRM_GARDER_VERSION[\s\S]{0,200}noterPage\(/.test(sw), '5 une page dit sa version et ses fichiers (`VRM_GARDER_VERSION`)');
  dit(/clients\.matchAll\(\{ type: 'window'/.test((sw.match(/async function nomsDesPagesOuvertes[\s\S]*?\n}\n/) || [''])[0]), '5 une page FERMÉE est oubliée (clients.matchAll) : rien ne s’accumule');

  // 6. branchements
  const main = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'main.jsx'), 'utf8'));
  dit(/reserverMaVersion\(/.test(main), '6 main.jsx lance la réserve de la page');
  const vite = sansCommentaires(fs.readFileSync(path.join(R, 'vite.config.js'), 'utf8'));
  dit(/polices/.test(vite) && /woff2/.test(vite), '6 la liste du build nomme les polices');

  console.log(ko ? `\n❌ audit-morceaux-perimes : ${ko} rouge(s)` : '\n✅ audit-morceaux-perimes : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
