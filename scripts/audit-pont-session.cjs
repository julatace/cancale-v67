// ════════════════════════════════════════════════════════════════════════════
//  « L'EXTENSION NE RÉPOND PAS » — LE PONT ET LA SESSION (extension 5.160)
//
//  Julien, 5 octobre : il clique « Générer le bordereau » et l'app répond
//  « L'extension ne répond pas ». Son extension tournait. Quatre causes, toutes
//  côté extension, toutes mesurées :
//
//   1. LE PONT ORPHELIN EMPOISONNE LES RÉPONSES. Après une mise à jour, l'ancien
//      bridge.js reste dans la page (son service worker n'existe plus) et
//      répondait `resp: null` TOUT DE SUITE — avant le pont neuf réinjecté à
//      côté. L'app prenait la première réponse. Et un pont vivant injecté deux
//      fois relayait chaque demande deux fois (une réponse à un acheteur
//      envoyée deux fois).
//   2. L'ÉTAT ATTENDAIT LE RÉSEAU (sonde de cloisonnement, renouvellement de
//      session, liste des comptes) alors que l'app abandonne au bout de 2,5 s.
//   3. LA RAFALE DE RENOUVELLEMENTS : aucun « un seul en vol », aucune pause,
//      un jeton mort retenté pour toujours — 429 puis
//      `refresh_token_already_used` dans les journaux de production (15:44).
//   4. LA SONDE DE CLOISONNEMENT MÉMORISAIT `false` SUR UN 502 : l'extension
//      écrivait avec la clé publique toute la vie du service worker, et RLS
//      refusait tout en silence.
//
//  On EXÉCUTE le vrai `background.js` dans un `vm` (faux `chrome`, faux
//  `fetch`, horloge décalable) et le vrai `bridge.js` dans de VRAIS mondes
//  isolés d'un vrai Chromium (CDP `Page.createIsolatedWorld` : c'est ce que
//  Chrome fait pour un script de contenu). Données INVENTÉES uniquement.
//  Chaque bloc passe par `essaie()` : ce qui lève devient un contrôle ROUGE et
//  le bilan est toujours imprimé (un audit ne meurt pas, il rapporte).
//
//  Usage : node scripts/audit-pont-session.cjs [--src dossier]
//  `--src` : un arbre (racine du dépôt, ou le dossier de l'extension) — sert à
//  la preuve §6.1 sur le code d'avant.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');

const iSrc = process.argv.indexOf('--src');
const BASE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const EXT = fs.existsSync(path.join(BASE, 'vinted-sync-extension', 'background.js')) ? path.join(BASE, 'vinted-sync-extension') : BASE;
const SRC_BG = fs.readFileSync(path.join(EXT, 'background.js'), 'utf8');
const SRC_PONT = fs.readFileSync(path.join(EXT, 'bridge.js'), 'utf8');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const JAMAIS = () => new Promise(() => {});
// Une promesse qui ne répond pas devient 'pend' au bout de `ms` (le contrôle
// rapporte au lieu d'attendre pour toujours).
const borne = (p, ms) => Promise.race([Promise.resolve(p), attendre(ms).then(() => 'pend')]);

const UID = '4400123', APP = 'https://vrm.center';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (p) => `${b64u({ alg: 'HS256' })}.${b64u(p)}.sig`;
const JETON = jwt({ sub: 'vendeur-1', email: 'essai@exemple.invalid' });
const session = (expDans, extra) => Object.assign({ access_token: JETON, refresh_token: 'r1', expires_at: Date.now() + expDans, user_id: 'vendeur-1', email: 'essai@exemple.invalid' }, extra || {});
const rep = (status, corps) => {
  const body = typeof corps === 'string' ? corps : JSON.stringify(corps == null ? {} : corps);
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } };
};
const JETON_NEUF = { access_token: jwt({ sub: 'vendeur-1', email: 'essai@exemple.invalid', n: 2 }), refresh_token: 'r2', expires_in: 3600, user: { id: 'vendeur-1', email: 'essai@exemple.invalid' } };

// ── Le service worker dans un `vm` ─────────────────────────────────────────
// `jeton(n)`, `sonde(n)`, `autre(url)` rendent une réponse, ou une promesse qui
// ne répond JAMAIS (base injoignable). `store` peut être partagé entre deux
// contextes : c'est un service worker qui redémarre (§4.9 — seul
// `chrome.storage.local` survit).
function faireBg({ store = {}, jeton = () => rep(200, JETON_NEUF), sonde = () => rep(200, '[]'), autre = () => rep(200, '[]'), cookieUid = UID } = {}) {
  const j = { jetons: 0, sondes: 0 };
  let ecouteur = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder, AbortController,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    crypto: require('crypto').webcrypto,
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: 'essai' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} }, clear() {} },
      cookies: {
        get: (q, cb) => { const v = q && q.name === 'access_token_web' && cookieUid ? { value: jwt({ account_id: Number(cookieUid) }) } : null; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); },
        getAll: (q, cb) => { if (typeof cb === 'function') { cb([]); return; } return Promise.resolve([]); },
        onChanged: { addListener() {} },
      },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {}, openPopup: async () => {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: async () => [], sendMessage: (id, m, cb) => { if (typeof cb === 'function') cb(); }, create: async () => ({}) },
      windows: { update() {} },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = JSON.parse(JSON.stringify(store[c])); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove(k, cb) { for (const c of [].concat(k)) delete store[c]; if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: async () => [] },
    },
    fetch: async (url, opts = {}) => {
      const u = decodeURIComponent(String(url));
      if (/\/auth\/v1\/token\?grant_type=refresh_token/.test(u)) { j.jetons++; return jeton(j.jetons, opts); }
      if (/app_data\?select=owner&limit=1/.test(u)) { j.sondes++; const r = sonde(j.sondes); if (r === 'jette') throw new Error('réseau coupé'); return r; }
      return autre(u, opts);
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  // Une horloge qu'on peut avancer (`ctx.__decalage`, en ms) : la pause des
  // renouvellements se vérifie sans attendre trente secondes pour de vrai.
  vm.runInContext('(() => { const n = Date.now.bind(Date); Date.now = () => n() + (globalThis.__decalage || 0); })()', ctx);
  vm.runInContext(SRC_BG, ctx, { filename: 'background.js' });
  const pont = (msg) => new Promise((res) => {
    const r = ecouteur(Object.assign({ from: 'vmr-bridge' }, msg), { origin: APP, url: APP + '/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  return { ctx, j, store, pont };
}

// ── Le pont dans de vrais mondes isolés ────────────────────────────────────
function chargerPlaywright() {
  for (const p of [[__dirname], [process.cwd()]]) {
    try { return require(require.resolve('playwright', { paths: p })); } catch (_) {}
  }
  try { return require(path.join(__dirname, '..', 'node_modules', 'playwright')); } catch (_) { return null; }
}
// Un faux `chrome.runtime` par monde, de la même FORME que le vrai : il répond
// en différé, et une fois « orpheliné » son `id` vaut `undefined` et
// `sendMessage` lève — exactement ce que fait Chrome après une mise à jour.
const FAUX_CHROME = (etiquette) => `(() => {
  const appels = []; globalThis.__appels = appels;
  const rt = {
    id: 'ext', lastError: null,
    getManifest: () => ({ version: ${JSON.stringify(etiquette)} }),
    sendMessage(msg, cb) {
      if (!rt.id) throw new Error('Extension context invalidated.');
      appels.push(msg.action);
      (globalThis.__messages = globalThis.__messages || []).push(JSON.parse(JSON.stringify(msg)));
      const r = { ok: true, vivant: ${JSON.stringify(etiquette)}, action: msg.action, dataUrl: 'data:,x' };
      setTimeout(() => { if (typeof cb === 'function') cb(r); }, 15);
    },
    onMessage: { addListener() {} },
  };
  globalThis.chrome = { runtime: rt };
  globalThis.__orpheliner = () => { rt.id = undefined; };
})();`;
// Compte, dans CE monde, les écouteurs « message » retirés.
const ESPION_RETRAIT = `(() => {
  globalThis.__retraits = 0;
  const rem = window.removeEventListener.bind(window);
  window.removeEventListener = (t, f, o) => { if (t === 'message') globalThis.__retraits++; return rem(t, f, o); };
})();`;

async function nouvellePage(nav) {
  const ctx = await nav.newContext();
  const pg = await ctx.newPage();
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>VRM</body></html>' }));
  await pg.goto(APP + '/');
  await pg.evaluate(() => {
    window.__recu = [];
    window.addEventListener('message', (e) => { if (e.source === window && e.data && typeof e.data.__vmr === 'string') window.__recu.push(e.data); });
  });
  const cdp = await ctx.newCDPSession(pg);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const monde = async (nom) => (await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: nom })).executionContextId;
  const dans = async (id, expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: id, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  };
  // L'APP : elle poste une demande et regarde ce qui revient pendant `ms`.
  let n = 0;
  const demander = async (msg, ms = 400) => {
    const reqId = 'q' + (++n);
    return pg.evaluate(async ({ msg, ms }) => {
      const debut = window.__recu.length;
      window.postMessage(msg, '*');
      await new Promise((r) => setTimeout(r, ms));
      return window.__recu.slice(debut).filter((m) => m.reqId === msg.reqId && m !== msg && /result$/.test(m.__vmr));
    }, { msg: Object.assign({ reqId }, msg), ms });
  };
  const readies = async (ms = 300) => pg.evaluate(async (ms) => {
    const debut = window.__recu.length;
    window.postMessage({ __vmr: 'ping' }, '*');
    await new Promise((r) => setTimeout(r, ms));
    return window.__recu.slice(debut).filter((m) => m.__vmr === 'ready');
  }, ms);
  return { pg, ctx, monde, dans, demander, readies };
}
// Ce qu'on attend d'UNE réponse vivante, type par type.
const TYPES = [
  { msg: { __vmr: 'etat' }, vivante: (r) => r.resp && r.resp.vivant },
  { msg: { __vmr: 'cmd', cmd: 'bordereau', uid: '1', tx: '2' }, vivante: (r) => r.resp && r.resp.vivant },
  { msg: { __vmr: 'cmd:statut', jobId: 'bord:1:2' }, vivante: (r) => r.resp && r.resp.vivant },
  { msg: { __vmr: 'authEtat' }, vivante: (r) => r.etat && r.etat.vivant },
  { msg: { __vmr: 'photo', url: 'https://images1.vinted.net/x.jpg' }, vivante: (r) => !!r.dataUrl },
  { msg: { __vmr: 'pdfLbc', url: 'https://api.leboncoin.fr/x' }, vivante: (r) => !!r.dataUrl },
  { msg: { __vmr: 'exec', uid: '1', method: 'POST', endpoint: '/api/v2/conversations/1/replies', body: {} }, vivante: (r) => r.ok === true },
];
const quiRepond = (r, t) => (t.vivante(r) ? String(t.vivante(r)) : 'vide/erreur');

(async () => {
  // ══ a. CINQ ÉCRITURES, UN SEUL RENOUVELLEMENT ═════════════════════════════
  await essaie('a · un seul renouvellement en vol', async () => {
    const b = faireBg({ store: { vrmSession: session(-1000) }, jeton: async () => { await attendre(40); return rep(200, JETON_NEUF); } });
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => b.ctx.authToken()));
    dit(b.j.jetons === 1, 'a · cinq authToken() simultanés, jeton périmé : UN SEUL POST /auth/v1/token', `${b.j.jetons} POST — chacun consomme le même jeton de renouvellement, les suivants se font refuser « already used »`);
    dit(rs.every((r) => r && r.access_token === JETON_NEUF.access_token), 'a · et les cinq reçoivent le jeton neuf', rs.map((r) => (r && r.access_token === JETON_NEUF.access_token ? 'neuf' : String(r && r.access_token).slice(0, 8))).join(','));
  });

  // ══ b. UNE SESSION MORTE NE SE RETENTE PAS ════════════════════════════════
  await essaie('b · session morte', async () => {
    const b = faireBg({ store: { vrmSession: session(-1000) }, jeton: () => rep(400, { code: 400, error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' }) });
    const r1 = await b.ctx.authToken();
    dit(r1 === null && b.store.vrmSession && b.store.vrmSession.mort === true, 'b · refus « refresh_token_already_used » : la session est marquée MORTE (dans chrome.storage.local)', `rendu ${r1 && 'une session'} · rangée ${JSON.stringify(b.store.vrmSession && { mort: b.store.vrmSession.mort })}`);
    const avant = b.j.jetons;
    for (let i = 0; i < 3; i++) await b.ctx.authToken();
    dit(b.j.jetons === avant, 'b · trois authToken() de plus : AUCUN nouvel appel au renouvellement', `${b.j.jetons - avant} POST de plus`);
    const e = await borne(b.ctx.etatPourApp(), 2000);
    dit(e !== 'pend' && e.vrm && e.vrm.connecte === false && e.vrm.expiree === true, "b · et l'état le dit : pas connecté, session expirée (jamais « pas su » sur un refus certain)", JSON.stringify(e && e.vrm));
    // L'app renvoie la MÊME session à chaque « ready » du pont : elle ne doit
    // pas ressusciter le jeton qui vient de mourir.
    await b.pont({ action: 'session', session: session(-1000) });
    await b.ctx.authToken();
    dit(b.j.jetons === avant, "b · l'app renvoie la MÊME session (même jeton mort) : toujours aucun appel", `${b.j.jetons - avant} POST de plus`);
    const neuve = session(3600e3, { access_token: jwt({ sub: 'vendeur-1', n: 9 }), refresh_token: 'r9' });
    await b.pont({ action: 'session', session: neuve });
    const avant2 = b.j.jetons;
    const r2 = await b.ctx.authToken();
    dit(r2 && r2.access_token === neuve.access_token && b.j.jetons === avant2, "b · autre sens : une NOUVELLE session arrive par le pont, authToken() remarche (sans réseau)", `rendu ${r2 ? 'une session' : r2} · ${b.j.jetons - avant2} POST`);
  });

  // ══ c. UN REFUS PASSAGER OUVRE UNE PAUSE ══════════════════════════════════
  await essaie('c · pause après un 429', async () => {
    const store = { vrmSession: session(-1000) };
    // Supabase limite tant que la fenêtre n'est pas passée (`leve`), puis répond.
    let leve = false;
    const jeton = () => (leve ? rep(200, JETON_NEUF) : rep(429, { message: 'Request rate limit reached' }));
    const b = faireBg({ store, jeton });
    const r1 = await b.ctx.authToken();
    dit(r1 === null && b.j.jetons === 1, 'c · 429 : le renouvellement a bien été tenté une fois (sinon la suite ne prouverait rien)', `${b.j.jetons} POST`);
    for (let i = 0; i < 3; i++) await b.ctx.authToken();
    dit(b.j.jetons === 1, 'c · pendant la pause : AUCUN nouvel appel (c’était une rafale de 429)', `${b.j.jetons} POST au total`);
    const rv = store.vrmRenouv || {};
    dit(Number(rv.prochainAt) > Date.now() + 20000, 'c · la pause est rangée dans chrome.storage.local (§4.9)', JSON.stringify(rv));
    // Le service worker redémarre : la pause doit tenir.
    const b2 = faireBg({ store, jeton });
    await b2.ctx.authToken();
    dit(b2.j.jetons === 0, 'c · service worker redémarré pendant la pause : toujours aucun appel', `${b2.j.jetons} POST`);
    leve = true;
    b.ctx.__decalage = 31000;
    const avant = b.j.jetons;
    const r2 = await b.ctx.authToken();
    dit(b.j.jetons - avant === 1 && r2 && r2.access_token === JETON_NEUF.access_token, 'c · la pause finie (+31 s) : UN appel, et le jeton neuf revient', `${b.j.jetons - avant} POST · ${r2 ? 'session' : r2}`);
  });
  await essaie('c · le jeton encore valide sert pendant la pause', async () => {
    const s = session(30000);              // valide 30 s : dans la marge de renouvellement
    const b = faireBg({ store: { vrmSession: s }, jeton: () => rep(503, '<html>503</html>') });
    const r = await b.ctx.authToken();
    dit(r && r.access_token === s.access_token, 'c · renouvellement refusé (503) mais le jeton tient encore 30 s : on s’en sert au lieu de rendre null', `rendu ${r ? 'une session' : r}`);
  });

  // ══ d. LA SONDE DE CLOISONNEMENT : TROIS ÉTATS ════════════════════════════
  await essaie('d · 502 au réveil', async () => {
    const b = faireBg({ store: { vrmSession: session(3600e3) }, sonde: (n) => (n === 1 ? rep(502, '<html>502 Bad Gateway</html>') : rep(200, '[]')) });
    const v1 = await b.ctx.isCloisonne();
    dit(v1 === true, 'd · sonde en 502 : « pas su » ⇒ l’état de production (cloisonnée), jamais « non »', `rendu ${v1}`);
    const memo = vm.runInContext('CLOISONNE', b.ctx);
    dit(memo !== false, 'd · et « non » n’est PAS mémorisé pour la vie du service worker', `mémo ${memo}`);
    const h = await b.ctx.sbHeaders();
    dit(String(h && h.Authorization).includes(JETON), 'd · donc les écritures partent avec le jeton du vendeur, pas la clé publique (que RLS refuse en silence)', String(h && h.Authorization).slice(0, 30));
    b.ctx.__decalage = 31000;
    const v2 = await b.ctx.isCloisonne();
    dit(v2 === true && b.j.sondes === 2 && b.store.vrmCloisonne === true, 'd · plus tard la sonde répond 200 : cloisonnée, et c’est RANGÉ (une base ne se dé-cloisonne jamais)', `rendu ${v2} · ${b.j.sondes} sonde(s) · rangé ${b.store.vrmCloisonne}`);
  });
  await essaie('d · réseau coupé', async () => {
    const b = faireBg({ sonde: () => 'jette' });
    const v = await b.ctx.isCloisonne();
    const memo = vm.runInContext('CLOISONNE', b.ctx);
    dit(v === true && memo !== false, 'd · réseau coupé : ni « non » rendu, ni « non » mémorisé', `rendu ${v} · mémo ${memo}`);
  });
  await essaie('d · valeur rangée, sonde muette', async () => {
    const b = faireBg({ store: { vrmCloisonne: true }, sonde: JAMAIS });
    const t0 = Date.now();
    const v = await borne(b.ctx.isCloisonne(), 1000);
    const dt = Date.now() - t0;
    dit(v === true && dt < 300, 'd · déjà rangée « cloisonnée » et la sonde ne répond pas : vrai, tout de suite', `rendu ${v} en ${dt} ms`);
  });
  await essaie('d · 400', async () => {
    const b = faireBg({ sonde: () => rep(400, { message: 'column app_data.owner does not exist' }) });
    const v1 = await b.ctx.isCloisonne();
    const v2 = await b.ctx.isCloisonne();
    dit(v1 === false && v2 === false && b.j.sondes === 1, 'd · autre sens : 400 (colonne absente) ⇒ « non », mémorisé — une seule sonde', `${v1}/${v2} · ${b.j.sondes} sonde(s)`);
  });

  // ══ e. L'ÉTAT POUR L'APP RÉPOND VITE, QUOI QU'IL ARRIVE ═══════════════════
  await essaie('e · tout le réseau muet, jeton périmé', async () => {
    const b = faireBg({ store: { vrmSession: session(-1000) }, jeton: JAMAIS, sonde: JAMAIS, autre: JAMAIS });
    const t0 = Date.now();
    const e = await borne(b.ctx.etatPourApp(), 3000);
    const dt = Date.now() - t0;
    dit(e !== 'pend' && dt < 2000, "e · tout fetch muet, jeton à renouveler : l'état répond en moins de 2 s (l'app abandonne à 2,5 s)", e === 'pend' ? 'pas de réponse après 3 s' : `${dt} ms`);
    dit(e !== 'pend' && e && e.vrm && e.vrm.connecte === null, 'e · et il dit « pas su » (connecte: null) — ni oui ni non inventé', JSON.stringify(e && e !== 'pend' ? e.vrm : e));
    dit(e !== 'pend' && e && e.vrm && e.vrm.cloisonne !== false, 'e · cloisonnement jamais mesuré : pas « non »', JSON.stringify(e && e !== 'pend' && e.vrm && e.vrm.cloisonne));
    dit(e !== 'pend' && e && e.vinted && e.vinted.uid === UID, 'e · le compte Vinted du cookie est quand même dit', JSON.stringify(e && e !== 'pend' && e.vinted));
  });
  await essaie('e · tout le réseau muet, session valide', async () => {
    const b = faireBg({ store: { vrmSession: session(3600e3), vrmCloisonne: true, vrmLogins: { at: Date.now() - 600000, map: { [UID]: 'angeled92' } } }, jeton: JAMAIS, sonde: JAMAIS, autre: JAMAIS });
    const t0 = Date.now();
    const e = await borne(b.ctx.etatPourApp(), 3000);
    const dt = Date.now() - t0;
    dit(e !== 'pend' && dt < 300, "e · session valide, tout fetch muet : l'état répond en moins de 300 ms", e === 'pend' ? 'pas de réponse après 3 s' : `${dt} ms`);
    const v = (e && e !== 'pend' && e.vrm) || {};
    dit(v.connecte === true && v.email === 'essai@exemple.invalid' && v.user_id === 'vendeur-1', "e · connecté, avec l'email ET l'identifiant du compte VRM (l'app compare des identités)", JSON.stringify(v));
    dit(v.cloisonne === true, 'e · le cloisonnement rangé est dit sans sonder', JSON.stringify(v.cloisonne));
    dit(e !== 'pend' && e && e.vinted && e.vinted.login === 'angeled92', 'e · le login mémorisé, même ancien, est servi sans attendre la base', JSON.stringify(e && e !== 'pend' && e.vinted));
  });
  await essaie('e · login inconnu, base qui répond', async () => {
    const b = faireBg({ store: { vrmSession: session(3600e3) } });
    b.ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'angeled92' }];
    const e = await borne(b.ctx.etatPourApp(), 3000);
    dit(e !== 'pend' && e && e.vinted && e.vinted.login === 'angeled92', 'e · autre sens : sans mémo, une base qui répond donne quand même le login', JSON.stringify(e && e !== 'pend' && e.vinted));
  });

  // ══ f. LE PONT : UN ORPHELIN SE TAIT, UN DOUBLON NE RELAIE PAS DEUX FOIS ══
  const pw = chargerPlaywright();
  if (!pw) { dit(false, 'f · Playwright introuvable — le contrôle du pont ne peut pas tourner'); }
  else {
    let nav = null;
    try {
      nav = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
    } catch (e) { dit(false, 'f · le navigateur du banc ne démarre pas', e && e.message); }
    if (nav) {
      await essaie('f · orphelin à côté du vivant', async () => {
        const P = await nouvellePage(nav);
        const vieux = await P.monde('pont-5.143');
        await P.dans(vieux, ESPION_RETRAIT + FAUX_CHROME('5.143') + SRC_PONT);
        await attendre(50);
        await P.dans(vieux, '__orpheliner()');
        const neuf = await P.monde('pont-5.160');
        await P.dans(neuf, FAUX_CHROME('5.160') + SRC_PONT);
        await attendre(50);
        const ret = await P.demander({ __vmr: 'etat' });
        dit(ret.length === 1 && ret[0].resp && ret[0].resp.vivant === '5.160', "f · « état » avec un pont orphelin à côté du vivant : UNE réponse, celle du vivant", `${ret.length} réponse(s) : ${ret.map((r) => (r.resp ? r.resp.vivant : 'null')).join(', ')}`);
        const fautifs = [];
        for (const t of TYPES.slice(1)) {
          const r = await P.demander(t.msg);
          if (r.length !== 1 || !t.vivante(r[0])) fautifs.push(`${t.msg.__vmr}: ${r.length} réponse(s) [${r.map((x) => quiRepond(x, t)).join(', ')}]`);
        }
        dit(fautifs.length === 0, 'f · idem pour cmd, cmd:statut, authEtat, photo, pdfLbc, exec : une réponse, la vivante', fautifs.join(' · '));
        const retraits = await P.dans(vieux, 'globalThis.__retraits');
        dit(retraits >= 1, "f · l'orphelin retire son écouteur (il ne sert plus à rien)", `${retraits} retrait(s)`);
        const r = await P.readies();
        dit(r.length === 1 && r[0].version === '5.160', "f · autre sens : le pont vivant s'annonce, avec SA version", JSON.stringify(r));
        await P.ctx.close();
      });
      await essaie('f · orphelin seul', async () => {
        const P = await nouvellePage(nav);
        const vieux = await P.monde('pont-seul');
        await P.dans(vieux, FAUX_CHROME('5.143') + SRC_PONT);
        await attendre(50);
        await P.dans(vieux, '__orpheliner()');
        const ret = await P.demander({ __vmr: 'etat' });
        const ex = await P.demander(TYPES[6].msg);
        dit(ret.length === 0 && ex.length === 0, "f · un pont orphelin SEUL ne répond rien (l'app dira elle-même, à l'échéance, que l'extension ne répond pas)", `état : ${ret.length} réponse(s) · exec : ${ex.length} réponse(s) ${JSON.stringify(ex.map((x) => x.error || x.ok))}`);
        await P.ctx.close();
      });
      // ⚠️ Le relais d'une commande recopiait une liste FIXE (`cmd, uid, tx,
      //    jobId`) : l'identifiant d'une paire à publier (`id`), « déjà publiée »
      //    (`etat`) et la limite de l'offre (`limit`, `plan`) n'arrivaient jamais
      //    — « Publier sur Leboncoin » depuis l'app était refusé depuis la 5.130.
      await essaie('f · une commande arrive ENTIÈRE au service worker', async () => {
        const P = await nouvellePage(nav);
        const w = await P.monde('pont-charge');
        await P.dans(w, FAUX_CHROME('5.160') + SRC_PONT);
        await attendre(50);
        await P.demander({ __vmr: 'cmd', cmd: 'lbcPublier', id: '7700112233' });
        await P.demander({ __vmr: 'cmd', cmd: 'lbcMarque', id: '7700112233', etat: 'posted' });
        await P.demander({ __vmr: 'cmd', cmd: 'lbcQuota', limit: 5, plan: 'pro' });
        await P.demander({ __vmr: 'cmd', cmd: 'bordereau', uid: '1', tx: '2', from: 'page-malveillante', action: 'exec' });
        const m = (await P.dans(w, 'globalThis.__messages || []')).filter((x) => x.action === 'cmd' || x.from !== 'vmr-bridge');
        const pub = m.find((x) => x.cmd === 'lbcPublier'), mar = m.find((x) => x.cmd === 'lbcMarque'), quo = m.find((x) => x.cmd === 'lbcQuota'), bor = m.find((x) => x.cmd === 'bordereau');
        dit(!!(pub && pub.id === '7700112233'), "f · « Publier sur Leboncoin » : l'identifiant de la paire arrive au service worker", JSON.stringify(pub));
        dit(!!(mar && mar.id === '7700112233' && mar.etat === 'posted'), '« Déjà publiée » : identifiant ET état arrivent', JSON.stringify(mar));
        dit(!!(quo && quo.limit === 5 && quo.plan === 'pro'), "la limite de l'offre Leboncoin arrive", JSON.stringify(quo));
        dit(!!(bor && bor.from === 'vmr-bridge' && bor.action === 'cmd' && bor.uid === '1' && bor.tx === '2'), 'et la page ne peut dicter ni `from` ni `action` (posés par le pont)', JSON.stringify(bor));
        await P.ctx.close();
      });
      await essaie('f · double injection du pont vivant', async () => {
        const P = await nouvellePage(nav);
        const w = await P.monde('pont-double');
        await P.dans(w, FAUX_CHROME('5.160') + SRC_PONT);
        await P.dans(w, SRC_PONT);              // reinjecterPont() sur un onglet qui l'a déjà
        await attendre(50);
        const ret = await P.demander(TYPES[6].msg);
        const appels = (await P.dans(w, 'globalThis.__appels')).filter((a) => a === 'exec');
        dit(appels.length === 1 && ret.length === 1, 'f · pont vivant injecté DEUX fois : un « exec » est relayé UNE fois (pas deux réponses à un acheteur)', `${appels.length} relais · ${ret.length} réponse(s)`);
        const r = await P.readies();
        dit(r.length === 1, 'f · et il ne s’annonce qu’une fois', `${r.length} « ready »`);
        await P.ctx.close();
      });
      await essaie('f · même monde réutilisé après la mise à jour', async () => {
        const P = await nouvellePage(nav);
        const w = await P.monde('pont-meme');
        await P.dans(w, FAUX_CHROME('ancien') + SRC_PONT);
        await attendre(50);
        await P.dans(w, '__orpheliner()');
        await P.dans(w, FAUX_CHROME('neuf') + SRC_PONT);   // le nouveau `chrome` remplace l'ancien
        await attendre(50);
        const ret = await P.demander({ __vmr: 'etat' });
        const ex = await P.demander(TYPES[6].msg);
        dit(ret.length === 1 && ret[0].resp && ret[0].resp.vivant === 'neuf' && ex.length === 1, "f · si Chrome réutilise le même monde : le pont neuf prend la place, l'ancien se tait", `état : ${ret.length} réponse(s) [${ret.map((x) => (x.resp ? x.resp.vivant : 'null')).join(', ')}] · exec : ${ex.length}`);
        await P.ctx.close();
      });
      try { await nav.close(); } catch (_) {}
    }
  }

  console.log(`\n${ko ? '❌' : '✅'} pont et session : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
