// Banc `vm` : exécute le VRAI autoAccepterOffres() du background.
// On relève les requêtes réellement envoyées à Vinted -> on voit exactement
// quelles offres ont été acceptées, et lesquelles ne l'ont PAS été.
const fs = require('fs'), vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

// Une conversation captée qui porte une offre de l'acheteur.
const conv = ({ id, tx, oid, item, prix, status = 10, current = true, titre = 'paire', deMoi = false }) => ({
  id: `harvest_111_conv_${id}`,
  data: {
    capturedAt: new Date().toISOString(),
    payload: {
      conversation: {
        id, description: titre,
        opposite_user: { id: 42 },
        transaction: { item_id: item },
        messages: [{
          entity_type: 'offer_request_message',
          entity: {
            user_id: deMoi ? 7 : 42, current, status,
            price: { amount: String(prix) },
            transaction_id: tx, offer_request_id: oid,
          },
        }],
      },
    },
  },
});

function faireBanc({ convs, mins = {}, minsApp = {}, actif = true, connecte = '111', memo = {} }) {
  const envois = [], logs = [];
  const store = { vrmAutoOffres: { actif }, vrmOffresFaites: memo, vrmActions: {} };
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'), URL, TextDecoder, TextEncoder,
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 'test' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      tabs: { onUpdated: { addListener() {} }, query: dual([]) },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      storage: { local: {
        get: function (k, cb) { const out = {}; const ks = typeof k === 'string' ? [k] : (Array.isArray(k) ? k : Object.keys(k || {})); ks.forEach(x => { if (store[x] !== undefined) out[x] = store[x]; }); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined) } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    },
    fetch: async (url, opt = {}) => {
      const u = String(url); const m = (opt.method || 'GET').toUpperCase();
      const J = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => 'application/json' }, arrayBuffer: async () => new ArrayBuffer(0) });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) return J([{ vinted_user_id: '111', login: 'moi', domain: 'www.vinted.fr', access_token: 't', anon_id: 'a', csrf_token: 'c' }]);
      if (/id=eq\.panel_min_prices/.test(u)) return J([{ data: mins }]);
      if (/id=eq\.main.*vinted_annonce_numeros/.test(u)) return J([{ nums: minsApp }]);
      if (/id=like\.harvest_111_conv_/.test(u)) return J(convs);
      if (/\/rest\/v1\//.test(u)) return J([]);
      if (/vinted\.[a-z]+\/api\//.test(u)) { envois.push(m + ' ' + u.replace(/^https:\/\/[^/]+/, '')); return J({ ok: true }); }
      return J({});
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.activeUidForDomain = async () => connecte;
  ctx.activeAccountId = async () => connecte;
  return { ctx, envois, logs, store };
}

const A = (n) => `PUT /api/v2/transactions/${n}`;

(async () => {
  const cas = [
    { nom: "offre EN ATTENTE au-dessus du plancher -> acceptée",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })],
      mins: { i1: 40 }, attendu: 1 },

    { nom: "offre EN DESSOUS du plancher -> jamais touchée",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 30 })],
      mins: { i1: 40 }, attendu: 0 },

    { nom: "AUCUN plancher sur cette annonce -> on ne touche à rien",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 999 })],
      mins: {}, attendu: 0 },

    { nom: "offre DÉJÀ ACCEPTÉE (status 20) -> rien",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45, status: 20 })],
      mins: { i1: 40 }, attendu: 0 },

    { nom: "offre REFUSÉE (status 30) -> rien",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45, status: 30 })],
      mins: { i1: 40 }, attendu: 0 },

    { nom: "offre remplacée par une plus récente (current:false) -> rien",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45, current: false })],
      mins: { i1: 40 }, attendu: 0 },

    { nom: "MA propre contre-offre -> jamais acceptée",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45, deMoi: true })],
      mins: { i1: 40 }, attendu: 0 },

    { nom: "interrupteur ÉTEINT -> rien, même au-dessus du plancher",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })],
      mins: { i1: 40 }, actif: false, attendu: 0 },

    { nom: "navigateur sur un AUTRE compte -> rien (garde-fou §48)",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })],
      mins: { i1: 40 }, connecte: '999', attendu: 0 },

    { nom: "déjà traitée -> jamais deux fois",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })],
      mins: { i1: 40 }, memo: { '5001': Date.now() - 60000 }, attendu: 0 },

    { nom: "plafond 3 par visite (5 offres acceptables)",
      convs: [1, 2, 3, 4, 5].map(i => conv({ id: i, tx: 900 + i, oid: 5000 + i, item: 'i' + i, prix: 45 })),
      mins: { i1: 40, i2: 40, i3: 40, i4: 40, i5: 40 }, attendu: 3 },

    { nom: "le plancher de l'APP (vinted_annonce_numeros) est appliqué",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })],
      mins: {}, minsApp: { i1: { minPrice: 40 } }, attendu: 1 },

    { nom: "l'APP prime sur l'ancienne ligne du panneau (60 > 45 -> refus)",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })],
      mins: { i1: 10 }, minsApp: { i1: { minPrice: 60 } }, attendu: 0 },

    { nom: "offre pile AU plancher -> acceptée (>=)",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 40 })],
      mins: { i1: 40 }, attendu: 1 },
  ];

  let ko = 0;
  for (const c of cas) {
    const b = faireBanc(c);
    await b.ctx.autoAccepterOffres('111');
    const acc = b.envois.filter(e => /offer_requests\/\d+\/accept$/.test(e));
    const ok = acc.length === c.attendu;
    if (!ok) ko++;
    console.log(`${ok ? '✅' : '❌'} ${c.nom} — accepté ${acc.length}, attendu ${c.attendu}`);
    if (!ok) console.log('     envois :', JSON.stringify(b.envois));
  }
  console.log(ko ? `\n${ko} cas non conforme(s).` : "\nLe moteur d'offres n'accepte que ce qui est explicitement autorisé.");
  process.exit(ko ? 1 : 0);
})();
