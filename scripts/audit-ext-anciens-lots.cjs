// ═════════════════════════════════════════════════════════════════════════
//  LES ANCIENS LOTS DE L'EXTENSION, REFAITS SUR LA 5.440 (24 nov., lot ext-anciens-lots, ext. 5.446.0)
//  — la revue de robustesse du 16 nov. (PR #1186, « 5.396 » jamais servie), ce qui en reste utile.
//  Exécute les VRAIS fichiers de l'extension (background.js par `_fond-vm.cjs`, les scripts de page
//  dans un `vm`) ; aucune donnée réelle (le dépôt est public).
//   R1  inject.js : la marque « capteur posé » est une clé symbole non énumérable ; SANS canal privé,
//       rien ne part par `window.postMessage(…,'*')` (avant : repli sur '*', jeton CSRF compris) ;
//   R2  inject.js : « catalog », « dialog », « logistics » ne sont plus du bruit ; « event_tracking »,
//       « logs » oui (segments entiers) ;
//   R3  vc-inject.js : un ORDRE posté sur `window` par la page est ignoré ; le même par le canal privé
//       est traité ; une lettre privée (`vcpublie`, résultats, recettes) ne passe jamais par `window` ;
//   R4  vc.js : une lettre privée arrivée par `window` est jetée, la même par le port est relayée au
//       fond ; sans canal, un ordre du fond rend `code:'canal'` (rien ne part) ; vc-ecrire.js n'écoute
//       plus `window` ;
//   R5  lbc-inject.js / lbc-relay.js : l'accusé passe par le canal privé (jamais `window`) ; les
//       `sendMessage` du relais ont leur rappel `lastError` ; bridge.js et la carte encadrée parlent à
//       l'origine exacte (jamais '*') ;
//   R6  le fond : la paire en dépôt (eBay, Leboncoin) n'est rendue qu'à l'onglet ouvert pour elle ;
//   R7  le fond : diagnostic borné et par comparer-et-échanger ; lecture ratée ⇒ le tampon n'est pas vidé ;
//   R8  le fond : un tampon ou un journal illisible n'est jamais réécrit vide (vrais `majTampon`, `logActivity`) ;
//   R9  le fond : les liaisons annonce → N° de moins de 30 jours ne sont jamais coupées (au-delà de 400) ;
//   R10 le fond : le csrf ne relance la lecture du compte que s'il CHANGE ; l'import d'un autre compte
//       passe APRÈS celui en cours (jamais perdu) ; « une minute après » par alarme ;
//   R11 le fond : le mémo d'une offre restée en attente plus de 7 jours n'est pas effacé ;
//   R12 manifest : `frame-ancestors` (vrm.center et les sites servis) ; retiré des paquets Firefox/Safari.
//  `--ext <dossier>` : une autre copie de vinted-sync-extension (preuve sur le code d'avant).
//  `--prouve` : chaque mutation de MUTATIONS doit rendre l'audit rouge.
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const iExt = process.argv.indexOf('--ext');
const EXT = iExt > 0 ? path.resolve(process.argv[iExt + 1]) : path.join(__dirname, '..', 'vinted-sync-extension');
const lire = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');

const MUTATIONS = {
  marque: ['inject.js', "try { Object.defineProperty(window, MARQUE_CAPTEUR, { value: true, enumerable: false, configurable: false, writable: false }); } catch (_) { try { window[MARQUE_CAPTEUR] = true; } catch (_) {} }", 'window.__cancaleVintedInjected = true; window[MARQUE_CAPTEUR] = true;'],
  repliEtoile: ['inject.js', 'try { if (canal) canal.postMessage(m); } catch (_) {}', "try { if (canal) canal.postMessage(m); else window.postMessage(m, '*'); } catch (_) {}"],
  bruit: ['inject.js', 'return (h + \'/\' + p).split(/[./_-]+/).some((seg) => seg && WRITE_NOISE.test(seg));', 'return /(track|metric|event|impression|visit|telemetr|analytic|log|pageview|consent)/i.test(url);'],
  vcOrdreWindow: ['vc-inject.js', "  try { surOrdre(async (event) => {\n    const d = event && event.data;\n    if (event.source !== window || !d || d.__tag !== 'CANCALE_VC_ORDRE' || d.kind !== 'prix') return;", "  try { window.addEventListener('message', async (event) => {\n    const d = event && event.data;\n    if (event.source !== window || !d || d.__tag !== 'CANCALE_VC_ORDRE' || d.kind !== 'prix') return;"],
  vcPostEtoile: ['vc-inject.js', "if (SORTES_PRIVEES.has(m.kind)) { if (canalOrdres) canalOrdres.postMessage(m); return; }", "if (false) { return; }"],
  vcJete: ['vc.js', "if (SORTES_PRIVEES.has(d.kind) && prive !== true) return;   // forgé par la page : jeté", ''],
  vcSansCanal: ['vc.js', "const versCapteur = (m) => { if (!canalOrdres) return false; try { canalOrdres.postMessage(m); return true; } catch (_) { return false; } };", "const versCapteur = (m) => { try { if (canalOrdres) canalOrdres.postMessage(m); else window.postMessage(m, location.origin); } catch (_) {} return true; };"],
  lbcAccuse: ['lbc-relay.js', "versCapteur({__tag:'CANCALE_LBC_ACCUSE',sequence:m.sequence,ok:ok===true});", "try{window.postMessage({__tag:'CANCALE_LBC_ACCUSE',sequence:m.sequence,ok:ok===true},'*');}catch(_){}"],
  pontEtoile: ['bridge.js', "const poster = (m) => { try { window.postMessage(m, location.origin); } catch (_) {} };", "const poster = (m) => { try { window.postMessage(m, '*'); } catch (_) {} };"],
  carteEtoile: ['vrm-badge.js', "try { window.parent.postMessage(Object.assign({ __vrmCarte: '' }, d), o); } catch (_) {}", "try { window.parent.postMessage(Object.assign({ __vrmCarte: '' }, d), '*'); } catch (_) {}"],
  depot: ['background.js', "  return !!(job && job.tabId != null && job.tabId === tab);", "  return !job || job.tabId == null || job.tabId === tab;"],
  diagBorne: ['background.js', "  if (cles.length <= max) return n;", "  return n;"],
  diagCas: ['background.js', "  if (okDiag !== true) return;\n  buf.n = {}; buf.rates = {};", "  buf.n = {}; buf.rates = {};"],
  tamponKO: ['background.js', "try { const s = await chrome.storage.local.get(DIAG_BUF); buf = (s && s[DIAG_BUF]) || {}; } catch (_) { return; }", "try { const s = await chrome.storage.local.get(DIAG_BUF); buf = (s && s[DIAG_BUF]) || {}; } catch (_) {}"],
  journalKO: ['background.js', "try { cur = (await chrome.storage.local.get('vrmActivity')).vrmActivity || []; } catch (_) { return; }", "try { cur = (await chrome.storage.local.get('vrmActivity')).vrmActivity || []; } catch (_) { cur = []; }"],
  liaisons: ['background.js', "its.forEach(([id, v], i) => { if (i < RESA_ITEMS_MAX || (i < RESA_ITEMS_DUR && Date.parse(String(v.at || '')) >= recent)) items[id] = v; });", "its.forEach(([id, v], i) => { if (i < RESA_ITEMS_MAX) items[id] = v; });"],
  csrf: ['background.js', "  if (!d || !t || lastCsrfByDomain[d] === t) return false;", "  if (!d || !t) return false;"],
  importAutre: ['background.js', "    if (_importApres.has(u)) return _importApres.get(u);", "    return _importEnCours.then(() => 0, () => 0);"],
  memoOffre: ['background.js', "for (const k in st) if (!st[k] || (st[k] < limite && !encoreLa.has(String(k)))) delete st[k];", "for (const k in st) if (!st[k] || st[k] < limite) delete st[k];"],
  cadre: ['manifest.json', "; frame-ancestors 'self' https://vrm.center", "; img-src 'self' https://vrm.center"],
};

if (process.argv.includes('--prouve')) {
  let rouges = 0;
  const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const [f, avant, apres] = MUTATIONS[nom];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-anciens-'));
    const ext = path.join(tmp, 'vinted-sync-extension');
    fs.cpSync(EXT, ext, { recursive: true, filter: (s) => !/\.zip$|_locales|\.png$/.test(s) });
    const cible = path.join(ext, f); const t = fs.readFileSync(cible, 'utf8');
    if (!t.includes(avant)) { console.log(`❓ ${nom} : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(cible, t.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename, '--ext', ext], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE' : 'reste vert'}${rouge ? ' — ' + (r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 130) : ''}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + String(det).slice(0, 300)}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, e && (e.stack || e.message)); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Une PAGE dans un vm : `window` = le contexte ; `postMessage` noté ; les écouteurs de `message` gardés.
function page(fichier, hote, { sansCanal = false, chrome = null } = {}) {
  const src = lire(fichier);
  const posts = [], ecoutes = [];
  const ctx = { console: { log() {}, warn() {}, error() {}, info() {}, debug() {} }, URL, URLSearchParams, Blob, FormData, Headers, Response, Request, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, JSON, Math, Date, Symbol, Object, Array, Map, Set, WeakMap, RegExp, Error, Number, String, Boolean };
  if (!sansCanal) ctx.MessageChannel = MessageChannel;
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.top = ctx; ctx.parent = ctx;
  ctx.location = { origin: 'https://' + hote, href: 'https://' + hote + '/', hostname: hote, host: hote, pathname: '/', protocol: 'https:', search: '' };
  ctx.addEventListener = (type, fn) => { if (type === 'message') ecoutes.push(fn); };
  ctx.removeEventListener = () => {};
  ctx.postMessage = (m, o, tr) => { posts.push({ m, o, ports: tr || [] }); };
  ctx.document = { addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; },
    createElement() { return { setAttribute() {}, appendChild() {}, remove() {}, style: {} }; }, documentElement: { appendChild() {} }, head: { appendChild() {} }, currentScript: {}, readyState: 'loading', cookie: '' };
  ctx.navigator = { userAgent: 'banc', language: 'fr' }; ctx.history = { pushState() {}, replaceState() {} };
  ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; ctx.sessionStorage = ctx.localStorage;
  ctx.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; };
  ctx.XMLHttpRequest = function () {}; ctx.XMLHttpRequest.prototype = { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} };
  ctx.fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  ctx.crypto = require('crypto').webcrypto;
  if (chrome) ctx.chrome = chrome;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: fichier });
  // ⚠️ Dans un vm, `window` est le PROXY global du contexte (pas l'objet `ctx`) : la source d'un message de la page est lui.
  const fenetre = vm.runInContext('window', ctx);
  const evt = (data, extra = {}) => ({ source: fenetre, origin: 'https://' + hote, data, ports: [], ...extra });
  const emettre = async (data, extra) => { for (const f of ecoutes.slice()) { try { await f(evt(data, extra)); } catch (_) {} } };
  return { ctx, posts, ecoutes, emettre, evt };
}

(async () => {
  // ── R1 ──
  await essaie('R1', async () => {
    const p = page('inject.js', 'www.vinted.fr');
    const cles = Object.keys(p.ctx);
    dit(!cles.includes('__cancaleVintedInjected') && !cles.some((k) => /capteur/i.test(k)) && p.ctx[Symbol.for('vrm.capteur.vinted')] === true,
      'R1 · la marque « capteur posé » est une clé symbole, absente de Object.keys(window)', cles.filter((k) => /cancale|capteur/i.test(k)).join(','));
    const s = page('inject.js', 'www.vinted.fr', { sansCanal: true });
    s.posts.length = 0;
    await s.ctx.fetch('/api/v2/items/1', { method: 'GET', headers: { 'x-csrf-token': 'JETON-SECRET-123' } });
    await attendre(30);
    const etoile = s.posts.filter((x) => x.o === '*' || JSON.stringify(x.m || {}).includes('JETON-SECRET-123'));
    dit(etoile.length === 0, 'R1 · sans canal privé, rien ne part par window.postMessage (ni "*", ni le jeton CSRF)', JSON.stringify(etoile.slice(0, 2)).slice(0, 200));
  });
  // ── R2 ──
  await essaie('R2', async () => {
    const src = lire('inject.js');
    const a = src.indexOf('const WRITE_NOISE'), b = src.indexOf('\n', src.indexOf('const bruitEcriture') >= 0 ? src.indexOf('};', src.indexOf('const bruitEcriture')) : a);
    const morceau = src.slice(a, b + 1);
    const ctx = { URL, location: { origin: 'https://www.vinted.fr' } }; vm.createContext(ctx);
    vm.runInContext(morceau + '\nthis.bruit = typeof bruitEcriture === "function" ? bruitEcriture : (u) => WRITE_NOISE.test(u);', ctx);
    const pas = ['/api/v2/catalog/items', '/api/v2/dialog/confirm', '/api/v2/logistics/options'].filter((u) => ctx.bruit(u));
    const oui = ['/api/v2/event_tracking', '/api/v2/logs', 'https://www.vinted.fr/relay/events'].filter((u) => !ctx.bruit(u));
    dit(!pas.length && !oui.length, 'R2 · « catalog », « dialog », « logistics » ne sont pas du bruit ; « event_tracking », « logs », « events » oui', JSON.stringify({ pas, oui }));
  });
  // ── R3 ──
  await essaie('R3', async () => {
    const p = page('vc-inject.js', 'fr.vestiairecollective.com');
    const canal = p.posts.find((x) => x.m && x.m.__tag === 'CANCALE_VC_CANAL' && x.ports && x.ports[0]);
    dit(!!canal && canal.o === 'https://fr.vestiairecollective.com', 'R3 · un canal privé est remis à l’origine exacte au chargement', JSON.stringify(p.posts.map((x) => x.m && x.m.__tag)));
    if (!canal) return;
    const port = canal.ports[0]; const recus = []; port.onmessage = (e) => recus.push(e.data);
    const ordre = { __tag: 'CANCALE_VC_ORDRE', kind: 'prix', jeton: 'jeton-banc-0001', produit: '12', avantCents: 1, apresCents: 2 };
    p.posts.length = 0;
    await p.emettre(ordre); await attendre(40);
    const parWindow = [...p.posts.filter((x) => x.m && /^vcprix/.test(String(x.m.kind || ''))), ...recus.filter((m) => m && /^vcprix/.test(String(m.kind || '')))];
    port.postMessage(ordre); await attendre(60);
    const parCanal = recus.filter((m) => m && /^vcprix/.test(String(m.kind || '')));
    dit(parWindow.length === 0 && parCanal.length >= 1 && !p.posts.some((x) => x.m && /^vcprix/.test(String(x.m.kind || ''))),
      'R3 · un ordre posté sur window par la page est ignoré ; par le canal privé il est traité et sa réponse ne revient QUE par le canal', JSON.stringify({ w: parWindow.length, c: parCanal.map((m) => m.kind), posts: p.posts.map((x) => x.m && x.m.kind) }));
    try { port.close(); } catch (_) {}
  });
  // ── R4 ──
  await essaie('R4', async () => {
    const envois = [], ecoutesFond = [];
    const chrome = { runtime: { id: 'x', sendMessage: (m, cb) => { envois.push(m); if (typeof cb === 'function') cb({ ok: true }); }, lastError: null, onMessage: { addListener: (fn) => ecoutesFond.push(fn) }, getURL: (p) => 'chrome-extension://x/' + p },
      storage: { local: { get: (k, cb) => cb && cb({}), set() {} }, onChanged: { addListener() {} } } };
    const p = page('vc.js', 'fr.vestiairecollective.com', { chrome });
    const lettre = { __tag: 'CANCALE_VC', kind: 'vcpublie', productId: '987654321', jeton: 'x' };
    await p.emettre(lettre); await attendre(20);
    const parWindow = envois.length;
    // Un ordre du fond SANS canal : `code:'canal'`, rien ne part.
    const reps = [];
    for (const f of ecoutesFond) { try { f({ from: 'vrm-fond', action: 'vcPrix', produit: '123456', avantCents: 2000, apresCents: 1800, recette: {} }, { id: 'x' }, (r) => reps.push(r)); } catch (_) {} }
    await attendre(20);
    const mc = new MessageChannel();
    await p.emettre({ __tag: 'CANCALE_VC_CANAL' }, { ports: [mc.port2] });
    mc.port1.postMessage(lettre); await attendre(60);
    dit(parWindow === 0 && envois.length >= 1, 'R4 · vc.js : une lettre privée (`vcpublie`) arrivée par window est jetée ; par le canal, relayée au fond', JSON.stringify({ parWindow, apres: envois.length }));
    dit(reps.some((r) => r && r.code === 'canal'), 'R4 · vc.js : sans canal, un ordre du fond rend « canal » (rien ne part)', JSON.stringify(reps));
    try { mc.port1.close(); } catch (_) {}
    const ve = lire('vc-ecrire.js');
    dit(!/addEventListener\(\s*'message'/.test(ve) && /__vrmVcPont/.test(ve), 'R4 · vc-ecrire.js n’écoute plus window : « envoi vu » et « conversation ouverte » par le pont du canal privé');
  });
  // ── R5 ──
  await essaie('R5', async () => {
    const relais = lire('lbc-relay.js'), cap = lire('lbc-inject.js'), pont = lire('bridge.js'), badge = lire('vrm-badge.js');
    const sansCommentaires = (s) => s.replace(/\/\/[^\n]*/g, '');
    dit(!/CANCALE_LBC_ACCUSE[^\n]*'\*'/.test(sansCommentaires(relais)) && /versCapteur\(\{__tag:'CANCALE_LBC_ACCUSE'/.test(relais) && !/addEventListener\('message',event=>\{\s*const d=event\.data;if\(event\.source!==window\|\|d\?\.__tag!=='CANCALE_LBC_ACCUSE'/.test(cap),
      'R5 · l’accusé Leboncoin passe par le canal privé (relais ⇒ capteur), jamais par window');
    const sans = (relais.match(/chrome\.runtime\.sendMessage\(/g) || []).length, avec = (relais.match(/lastError/g) || []).length;
    dit(sans > 0 && avec >= sans, `R5 · les ${sans} envois du relais Leboncoin ont leur rappel lastError`, `${avec}/${sans}`);
    dit(/window\.postMessage\(m, location\.origin\)/.test(pont) && !/window\.postMessage\(m, '\*'\)/.test(pont), 'R5 · bridge.js parle à l’origine exacte de vrm.center');
    dit(!/window\.parent\.postMessage\([^\n]*'\*'\)/.test(sansCommentaires(badge)) && /__vrmCadreOrigine/.test(lire('popup.js')), 'R5 · la carte encadrée ne parle qu’à l’origine exacte qui l’encadre (popup.js la pose)');
  });

  // ── Le VRAI fond ──
  const { faireFond } = require('./_fond-vm.cjs');
  const BG = path.join(EXT, 'background.js');
  await essaie('R6', async () => {
    const f = faireFond({ src: BG, store: { vrmPendingEbay: { at: Date.now(), ad: { id: 'p1', titre: 'x' } }, vrmPendingLbc: { at: Date.now(), ad: { id: 'p2', titre: 'x' } }, vrmCmds: { 'ebay:p1': { tabId: 7 }, 'lbc:p2': { tabId: 7 } } } });
    if (typeof f.ctx.ongletDuDepot !== 'function') throw new Error('ongletDuDepot absent du fond');
    const r = [await f.ctx.ongletDuDepot('ebay:p1', { tab: { id: 7 } }), await f.ctx.ongletDuDepot('ebay:p1', { tab: { id: 8 } }), await f.ctx.ongletDuDepot('lbc:inconnu', { tab: { id: 7 } }), await f.ctx.ongletDuDepot('lbc:p2', {})];
    dit(r.join() === 'true,false,false,false', 'R6 · la paire en dépôt n’est rendue qu’à l’onglet ouvert pour elle (autre onglet, dépôt inconnu, pas d’onglet ⇒ non)', r.join());
    const src = fs.readFileSync(BG, 'utf8');
    dit((src.match(/await ongletDuDepot\('(ebay|lbc):' \+ String\(ad\.id\), sender\)/g) || []).length === 2, 'R6 · getPending eBay et Leboncoin passent par cette règle');
  });
  await essaie('R7', async () => {
    const n = {}; for (let i = 0; i < 700; i++) n['k' + i] = i;
    const f = faireFond({ src: BG, lignes: { panel_diag_capture: { n, rates: {}, rev: 3 } } });
    const buf = { n: { neuf_compteur: 1 }, rates: {} };
    await f.ctx.viderTampon(buf);
    const l = f.lignes.panel_diag_capture || {};
    const k = Object.keys(l.n || {});
    dit(k.length <= 600 && k.includes('neuf_compteur') && k.includes('k699') && Object.keys(buf.n).length === 0, 'R7 · la ligne du diagnostic est bornée à 600 compteurs (les plus grands, et toujours les nouveaux) ; écrit ⇒ tampon vidé', JSON.stringify({ n: k.length, rev: l.rev }));
    dit(Number(l.rev) === 4, 'R7 · écriture par comparer-et-échanger (`rev` monté)', String(l.rev));
    const g = faireFond({ src: BG, lectureKO: (u) => /panel_diag_capture/.test(u), lignes: { panel_diag_capture: { n: { a: 1 }, rev: 1 } } });
    const b2 = { n: { x: 2 }, rates: {} };
    await g.ctx.viderTampon(b2);
    dit(b2.n.x === 2 && g.lignes.panel_diag_capture.n.a === 1 && !g.lignes.panel_diag_capture.n.x, 'R7 · lecture ratée ⇒ rien écrit, le tampon local garde ses compteurs');
  });
  await essaie('R8', async () => {
    const src = fs.readFileSync(BG, 'utf8');
    const extraire = (nom) => { const i = src.indexOf('function ' + nom + '('); let p = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') p++; else if (src[j] === '}') { p--; if (!p) break; } } return src.slice(i, j + 1); };
    const ecrits = [];
    const ctx = { chrome: { storage: { local: { get: async () => { throw new Error('illisible'); }, set: async (o) => { ecrits.push(o); } } } }, Date, Promise, Array, String, Object, console };
    vm.createContext(ctx);
    vm.runInContext(`let _diagChaine = Promise.resolve(); let _diagFlushAt = Date.now(); const DIAG_BUF = 'vrmDiagBuf'; async function viderTampon() {}\nlet _chaineActivite = Promise.resolve();\n${extraire('majTampon')}\n${extraire('logActivity')}`, ctx);
    await ctx.majTampon((b) => { b.n.x = 1; });
    await ctx.logActivity('banc');
    await attendre(10);
    dit(ecrits.length === 0, 'R8 · stockage illisible ⇒ ni le tampon du diagnostic ni le journal ne sont réécrits (vrais majTampon, logActivity)', JSON.stringify(ecrits).slice(0, 200));
  });
  await essaie('R9', async () => {
    const f = faireFond({ src: BG });
    const maintenant = Date.now(), items = {};
    for (let i = 0; i < 900; i++) items[String(100000 + i)] = { numero: String(i), at: new Date(maintenant - i * 60000).toISOString() };
    items['999999'] = { numero: '9999', at: new Date(maintenant - 60 * 86400000).toISOString() };
    const r = f.ctx.resaPropre({ attente: {}, items }, maintenant);
    const ids = Object.keys((r && r.items) || {});
    dit(ids.length === 900 && ids.includes('100899') && !ids.includes('999999'), 'R9 · les liaisons de moins de 30 jours restent toutes (900 > 400), la vieille au-delà de la borne part', String(ids.length));
  });
  await essaie('R10', async () => {
    const f = faireFond({ src: BG });
    if (typeof f.ctx.noterCsrf !== 'function') throw new Error('noterCsrf absent du fond');
    const r = [f.ctx.noterCsrf('www.vinted.fr', 'A'), f.ctx.noterCsrf('www.vinted.fr', 'A'), f.ctx.noterCsrf('www.vinted.fr', 'B')];
    dit(r.join() === 'true,false,true', 'R10 · le csrf ne relance la lecture du compte que s’il CHANGE', r.join());
    let lances = [];
    f.ctx.importerHistoriqueUn = (uid) => { lances.push(String(uid)); return new Promise((ok) => setTimeout(() => ok(1), 20)); };
    const a = f.ctx.importerHistorique('111'), b = f.ctx.importerHistorique('222'), c = f.ctx.importerHistorique('222');
    await Promise.all([a, b, c]);
    dit(lances.join() === '111,222', 'R10 · l’import d’un AUTRE compte passe après celui en cours (une fois), jamais perdu', lances.join());
    const alarmes = [];
    f.ctx.chrome.alarms.create = (nom, o) => alarmes.push(nom);
    f.ctx.planifierImport(); f.ctx.planifierImportSites();
    dit(alarmes.includes('vrm-import-bientot') && alarmes.includes('vrm-importsites-bientot'), 'R10 · « une minute après la visite » par alarme (survit au service worker)', alarmes.join());
  });
  await essaie('R11', async () => {
    const src = fs.readFileSync(BG, 'utf8');
    const i = src.indexOf('async function autoAccepterOffresUnPassage'); const bloc = src.slice(i, src.indexOf('\nasync function ', i + 10));
    const lim = bloc.indexOf('const limite = Date.now() - 7 * 86400000;');
    const lignes = bloc.slice(lim, bloc.indexOf('let faites = 0;', lim));
    const st = { vieille: Date.now() - 9 * 86400000, partie: Date.now() - 9 * 86400000, recente: Date.now() };
    const ctx = { st, offres: [{ oid: 'vieille' }], Date, Set, String }; vm.createContext(ctx);
    vm.runInContext(lignes, ctx);
    dit(ctx.st.vieille && !ctx.st.partie && ctx.st.recente, 'R11 · le mémo d’une offre ENCORE en attente après 7 jours reste (elle ne sera pas traitée deux fois) ; celui d’une offre partie s’efface', JSON.stringify(Object.keys(ctx.st)));
  });
  await essaie('R12', async () => {
    const m = JSON.parse(lire('manifest.json'));
    const csp = String((m.content_security_policy || {}).extension_pages || '');
    const fa = /frame-ancestors ([^;]+)/.exec(csp);
    const hotes = fa ? fa[1].trim().split(/\s+/) : [];
    const war = new Set((m.web_accessible_resources || []).filter((w) => (w.resources || []).includes('popup.html')).flatMap((w) => w.matches || []).map((u) => u.replace(/\/\*$/, '')));
    dit(!!fa && hotes.includes("'self'") && [...war].every((h) => hotes.includes(h)) && !hotes.includes('*') && !hotes.some((h) => /^https:\/\/\*$/.test(h)),
      'R12 · popup.html ne s’encadre que chez vrm.center et les sites où la carte est servie (frame-ancestors = les hôtes de web_accessible_resources)', JSON.stringify({ hotes, war: [...war] }));
    const Z = require(path.join(__dirname, 'zip-extension.cjs'));
    const ff = Z.manifesteFirefox(m), sa = Z.manifesteSafari(m);
    const sans = (x) => !/frame-ancestors/.test(String(((x || {}).content_security_policy || {}).extension_pages || ''));
    dit(typeof Z.sansFrameAncestors === 'function' && sans(ff) && sans(sa), 'R12 · retiré des paquets Firefox et Safari (pas garanti chez eux : `cadreAutorise` les tient)');
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-ext-anciens-lots : tout vert');
  process.exit(ko ? 1 : 0);
})();
