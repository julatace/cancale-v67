// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « L'ICÔNE OUVRE VRM, SANS FENÊTRE » (1er octobre 2026)
//  Julien : « quand on appuie sur l'extension, ça envoie directement à VRM, et
//  ça ne lance pas l'extension ». On exécute le VRAI background.js dans un `vm`.
//  Les deux sens : connecté → pas de fenêtre (popup vide), le clic ouvre VRM ;
//  déconnecté → la fenêtre de connexion revient (sinon on ne pourrait plus se
//  connecter), et le clic ne fabrique pas d'onglet VRM à la place.
// ════════════════════════════════════════════════════════════════════════════
//  ⚠️ 5.370 (12 nov., Julien : « comme Vintex, quand on clique sur l'extension VRM, ça ouvre un
//  onglet séparé ») : avec le menu du clic droit (Chrome, Edge, Firefox), le clic ouvre TOUJOURS un
//  onglet — l'onglet VRM de CETTE fenêtre au premier plan, sinon un nouveau ; déconnecté ⇒ vrm.center
//  (connexion, `lier-extension`) ; la fenêtre d'avant s'ouvre par le clic droit (« Connexion à VRM » /
//  « État de l'extension »). Sans menu (Orion iPhone) : la fenêtre de connexion, comme avant.
//  `SRC=<ancien background.js>` : sur la 5.369, les contrôles « 5.370 » sont rouges.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(process.env.SRC ? path.resolve(process.env.SRC) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

// Fabrique un contexte d'exécution du service worker, avec une session donnée.
function faire({ session = null, urlActive = '', menus = false, onglets = [] } = {}) {
  const j = { setPopup: [], crees: [], majOnglet: [], openPopup: 0, focus: [], menus: [], requetes: [], actives: [] };
  let menuClic = null;
  const store = session ? { vrmSession: session } : {};
  let clicHandler = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn) => setTimeout(fn, 1), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder, fetch: async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => '' }),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    crypto: require('crypto').webcrypto,
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: '0' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} }, clear() {} },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      tabs: {
        onUpdated: { addListener() {} },
        query: (q, cb) => { j.requetes.push(q); const r = onglets.filter((t) => /vrm\.center/.test(t.url) && (q.windowId == null || t.windowId === q.windowId)); cb && cb(r); },
        create: (o, cb) => { j.crees.push(o.url); cb && cb({ id: 1 }); },
        update: (id, o, cb) => { if (o.url) j.majOnglet.push(o.url); if (o.active) j.actives.push(id); cb && cb(); },
      },
      windows: { update: (id, o) => j.focus.push(id) },
      action: {
        setPopup: (o) => j.setPopup.push(o.popup),
        setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {},
        openPopup: async () => { j.openPopup++; },
        onClicked: { addListener: (fn) => { clicHandler = fn; } },
      },
      storage: { local: {
        get: (k, cb) => { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c]; if (cb) { cb(out); return; } return Promise.resolve(out); },
        set: (o, cb) => { Object.assign(store, o); if (cb) { cb(); return; } return Promise.resolve(); },
        remove: (k, cb) => { delete store[k]; if (cb) { cb(); return; } return Promise.resolve(); },
      } },
    },
  };
  if (menus) ctx.chrome.contextMenus = { removeAll: (cb) => cb && cb(), create: (o, cb) => { j.menus.push(o); cb && cb(); }, onClicked: { addListener: (fn) => { menuClic = fn; } } };
  ctx.chrome.runtime.getURL = (p) => 'chrome-extension://x/' + p;
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  // Une session vivante : on court-circuite le vrai réseau (authEtat lit authToken).
  ctx.authToken = async () => (session ? session : null);
  ctx.isCloisonne = async () => true;
  return { ctx, j, clic: (tab) => clicHandler && clicHandler(tab), menu: (id) => menuClic && menuClic({ menuItemId: id }) };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ── 1. CONNECTÉ : le popup est vidé (pas de fenêtre), le clic ouvre VRM ──────
  await essaie('connecté : aucune fenêtre, l\'icône ouvre VRM', async () => {
    const s = { access_token: 'x', refresh_token: 'r', expires_at: Date.now() + 3600e3, email: 'a@b.fr' };
    const { j, clic } = faire({ session: s });
    await wait(30);
    dit(j.setPopup.includes(''), 'le popup est vidé quand une session existe (pas de fenêtre qui clignote)', 'setPopup=' + JSON.stringify(j.setPopup));
    await clic({ url: 'https://www.vinted.fr/items/1' });
    await wait(30);
    const vrm = [...j.crees, ...j.majOnglet].filter((u) => /vrm\.center/.test(u || ''));
    dit(vrm.length > 0, 'le clic ouvre VRM', 'ouvert : ' + JSON.stringify([...j.crees, ...j.majOnglet]));
    dit(vrm.some((u) => /plat_vinted/.test(u)), 'depuis Vinted → onglet Vinted de VRM', vrm.join(','));
    dit(j.openPopup === 0, 'et il n\'ouvre PAS la fenêtre de l\'extension');
  });

  // ── 2. Depuis Leboncoin → onglet Leboncoin ───────────────────────────────────
  await essaie('depuis Leboncoin : onglet Leboncoin de VRM', async () => {
    const s = { access_token: 'x', expires_at: Date.now() + 3600e3 };
    const { j, clic } = faire({ session: s });
    await wait(20);
    await clic({ url: 'https://www.leboncoin.fr/compte/part/transaction/1' });
    await wait(30);
    const vrm = [...j.crees, ...j.majOnglet].filter((u) => /vrm\.center/.test(u || ''));
    dit(vrm.some((u) => /plat_leboncoin/.test(u)), 'depuis Leboncoin → onglet Leboncoin', vrm.join(','));
  });

  // ── 3. DÉCONNECTÉ : la fenêtre de connexion reste (sinon on est enfermé dehors)
  await essaie('déconnecté : la fenêtre de connexion revient', async () => {
    const { j, clic } = faire({ session: null });
    await wait(20);
    dit(j.setPopup.includes('popup.html'), 'le popup pointe sur la fenêtre de connexion quand aucune session', 'setPopup=' + JSON.stringify(j.setPopup));
    // Un clic sur un popup non vide n'arrive normalement pas ici, mais s'il
    // arrive (session expirée entre-temps), on ne doit pas ouvrir VRM à sa place.
    await clic({ url: 'https://www.vinted.fr/' });
    await wait(30);
    const vrm = [...j.crees, ...j.majOnglet].filter((u) => /vrm\.center/.test(u || ''));
    dit(vrm.length === 0, 'déconnecté : le clic n\'ouvre pas VRM (il ramène la connexion)', 'ouvert : ' + vrm.join(','));
  });

  // ── 4. 5.370 : AVEC LE MENU DU CLIC DROIT (Chrome, Edge, Firefox) ───────────
  await essaie('5.370 : déconnecté, le clic ouvre VRM (connexion)', async () => {
    const { j, clic } = faire({ session: null, menus: true });
    await wait(20);
    dit(!j.setPopup.includes('popup.html'), '5.370 : plus de fenêtre à l’icône, même déconnecté', 'setPopup=' + JSON.stringify(j.setPopup));
    await clic({ url: 'https://www.vinted.fr/', windowId: 7 });
    await wait(30);
    const vrm = [...j.crees, ...j.majOnglet].filter((u) => /vrm\.center/.test(u || ''));
    dit(vrm.length === 1 && /lier-extension=x/.test(vrm[0]) && j.openPopup === 0, '5.370 : déconnecté ⇒ un onglet vrm.center pour se connecter (lier-extension), aucune fenêtre', vrm.join(','));
  });
  await essaie('5.370 : l’onglet VRM de cette fenêtre', async () => {
    const s = { access_token: 'x', expires_at: Date.now() + 3600e3 };
    const { j, clic } = faire({ session: s, menus: true, onglets: [{ id: 41, windowId: 9, url: 'https://vrm.center/?tab=journee' }, { id: 42, windowId: 7, url: 'https://vrm.center/?tab=ventes' }] });
    await wait(20);
    await clic({ url: 'https://www.vinted.fr/', windowId: 7 });
    await wait(30);
    dit(j.requetes.some((q) => q.windowId === 7) && j.crees.length === 0 && (j.actives.includes(42)), '5.370 : un onglet VRM déjà ouvert DANS CETTE FENÊTRE est mis au premier plan (pas de second onglet)', JSON.stringify(j));
    const k = faire({ session: s, menus: true, onglets: [{ id: 41, windowId: 9, url: 'https://vrm.center/' }] });
    await wait(20);
    await k.clic({ url: 'https://www.vinted.fr/', windowId: 7 });
    await wait(30);
    dit(k.j.crees.length === 1 && !k.j.actives.includes(41), '5.370 : VRM ouvert dans une AUTRE fenêtre ⇒ un nouvel onglet dans celle-ci', JSON.stringify(k.j.crees));
  });
  await essaie('5.370 : clic droit', async () => {
    const { j, menu } = faire({ session: null, menus: true });
    await wait(20);
    dit(j.menus.map((m) => m.id).join(',') === 'vrm-connexion,vrm-etat' && j.menus.every((m) => m.contexts.join() === 'action'), '5.370 : clic droit sur l’icône ⇒ « Connexion à VRM » et « État de l’extension »', JSON.stringify(j.menus));
    menu('vrm-connexion');
    dit(j.crees.some((u) => /^chrome-extension:\/\/x\/popup\.html/.test(u)), '5.370 : le menu ouvre la fenêtre d’avant (connexion, état, réparation) dans un onglet', j.crees.join(','));
  });

  console.log(`\n${ko ? '❌' : '✅'} icône : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
