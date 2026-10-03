// ════════════════════════════════════════════════════════════════════════════
//  « PUBLIER » SE COMMANDE DEPUIS L'APP (5.130) — et l'app ne dicte RIEN d'autre
//  qu'un identifiant.
//
//  Les panneaux sur leboncoin.fr et ebay.fr sont retirés : le bouton vit dans
//  l'app, qui envoie `lbcPublier {id}` à l'extension. Ce qui doit rester vrai :
//   1. la paire est relue dans la file de l'EXTENSION — un titre, un prix ou une
//      photo glissés dans le message ne partent jamais ;
//   2. une paire absente de la file (vendue, décochée, déjà publiée) est refusée ;
//   3. une preuve de vente illisible refuse aussi (« pas su » ≠ « pas vendue ») ;
//   4. acceptée : la paire est mémorisée AVEC le feu vert de publication, et la
//      page de dépôt s'ouvre ; publiée, la commande passe à « fait ».
//   5. l'autre sens : une vraie demande part (sinon tout refuser passerait).
//  §4.10 : on EXÉCUTE le vrai background.js dans un `vm`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const AD = { id: '1001', numero: '401', title: 'Salomon XT-6 blanc T40', price: '99.00', photos: ['https://x/1.jpg'], ref: 'VRM-401' };

function faire({ queue = [AD], preuveKO = false } = {}) {
  const store = {}; const onglets = []; let ecouteur = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => '' } }),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: '9.9.9' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined),
        create: async (o) => { onglets.push(o.url); return { id: 1 }; } },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c]; if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.buildLbcData = async () => ({ queue, removals: [], unlinked: [], stats: { preuveKO }, postedList: [] });
  ctx.buildEbayData = async () => ({ queue, preuveKO });
  ctx.markLbcPosted = async () => true;
  const cmd = (msg) => new Promise((res) => {
    ecouteur(Object.assign({ from: 'vmr-bridge', action: 'cmd' }, msg), { origin: 'https://vrm.center', url: 'https://vrm.center/' }, res);
  });
  const lbc = (msg) => new Promise((res) => { ecouteur(Object.assign({ from: 'cancale-lbc' }, msg), { tab: { url: 'https://www.leboncoin.fr/deposer-une-annonce' } }, res); });
  return { ctx, store, onglets, cmd, lbc, ecouteur: () => ecouteur };
}

(async () => {
  await essaie('acceptée', async () => {
    const b = faire();
    const r = await b.cmd({ cmd: 'lbcPublier', id: '1001', title: 'TITRE GLISSÉ PAR LA PAGE', price: '1.00' });
    dit(r && r.accepte === true && r.jobId === 'lbc:1001', 'autre sens : une paire de la file, demandée par l\'app, est acceptée', JSON.stringify(r));
    const p = b.store.vrmPendingAd && b.store.vrmPendingAd.ad;
    dit(p && p.title === AD.title && p.price === AD.price, 'la paire mémorisée est celle de la FILE de l\'extension, jamais le contenu du message', JSON.stringify(p && { title: p.title, price: p.price }));
    dit(p && p.publier === true, 'avec le feu vert de publication (sans booster) pour CETTE paire');
    dit(b.onglets.some((u) => /leboncoin\.fr\/deposer-une-annonce/.test(u)), 'et la page de dépôt s\'ouvre', b.onglets.join(','));
    const r2 = await b.lbc({ action: 'markPosted', id: '1001' });
    const c = (b.store.vrmCmds || {})['lbc:1001'];
    dit(r2 && r2.ok && c && c.etape === 'fait', 'publiée : la commande passe à « fait » (l\'app le sait tout de suite)', JSON.stringify(c));
  });
  await essaie('absente', async () => {
    const b = faire({ queue: [] });
    const r = await b.cmd({ cmd: 'lbcPublier', id: '1001' });
    dit(r && r.accepte === false && r.code === 'absente' && !b.onglets.length && !b.store.vrmPendingAd, 'une paire absente de la file (vendue, décochée, déjà publiée) est refusée — rien ne s\'ouvre', JSON.stringify(r));
  });
  await essaie('preuve', async () => {
    const b = faire({ preuveKO: true });
    const r = await b.cmd({ cmd: 'lbcPublier', id: '1001' });
    dit(r && r.accepte === false && r.code === 'preuve' && !b.onglets.length, 'preuve de vente illisible : refusée (« pas su » ne vaut pas « pas vendue »)', JSON.stringify(r));
  });
  await essaie('invalide', async () => {
    const b = faire();
    const r = await b.cmd({ cmd: 'lbcPublier', id: '../items/1' });
    dit(r && r.accepte === false && !b.onglets.length, 'un identifiant qui n\'en est pas un est refusé', JSON.stringify(r));
  });
  await essaie('origine', async () => {
    const b = faire();
    const r = await new Promise((res) => b.ecouteur()({ from: 'vmr-bridge', action: 'cmd', cmd: 'lbcPublier', id: '1001' }, { origin: 'https://site.example', url: 'https://site.example/' }, res));
    dit(r && r.ok === false && !b.onglets.length, 'une page qui n\'est pas l\'app ne fait rien publier', JSON.stringify(r));
  });
  await essaie('ebay', async () => {
    const b = faire();
    const r = await b.cmd({ cmd: 'ebayPreparer', id: '1001' });
    const p = b.store.vrmPendingEbay && b.store.vrmPendingEbay.ad;
    dit(r && r.accepte && p && p.title === AD.title && b.onglets.some((u) => /ebay\.fr\/sl\/sell/.test(u)), 'eBay : la paire est préparée et la mise en vente s\'ouvre', JSON.stringify(r));
    dit(!(p && p.publier), 'et eBay ne reçoit AUCUN feu vert de publication (il relit et met en vente lui-même)');
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
