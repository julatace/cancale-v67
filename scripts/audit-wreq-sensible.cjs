// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « REQUÊTES D'ÉCRITURE : RIEN DE SENSIBLE EN CLAIR » (30 sept. 2026)
//
//  Mesuré sur sa base : `harvest_*_wreq_*` recopiait le CORPS de toute requête
//  d'écriture observée — y compris un IBAN, un scan de passeport, des jetons de
//  carte, des codes de double authentification — dans une table lisible avec
//  la clé publique. On exécute le VRAI `storeWriteReq` (background.js dans un
//  `vm`) et on regarde ce qui PART vers la base.
//  Les deux sens : le sensible perd son contenu, l'utile (une réponse, une
//  annonce) garde le sien — sinon « ne rien ranger » passerait l'audit.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };

const ecrits = [];
const ctx = {
  console: { log() {}, warn() {}, error() {} },
  setTimeout: (fn) => setTimeout(fn, 1), clearTimeout, setInterval: () => 0, clearInterval, URL, TextDecoder, TextEncoder,
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  chrome: {
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: '0' }), lastError: null, id: 'x' },
    alarms: { create() {}, onAlarm: { addListener() {} } },
    cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
    downloads: { onCreated: { addListener() {} } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
    storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
  },
  fetch: async (url, opts = {}) => {
    if ((opts.method || 'GET') === 'POST' && /\/rest\/v1\//.test(String(url))) { try { ecrits.push(...JSON.parse(opts.body || '[]')); } catch (_) {} }
    return { ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => 'application/json' } };
  },
};
ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'background.js' });
ctx.activeAccountId = async () => '123';

const cas = async (url, body) => { ecrits.length = 0; try { await ctx.storeWriteReq('www.vinted.fr', 'POST', url, body); } catch (e) { return { err: e.message }; } return ecrits[0] || null; };

(async () => {
  const IBAN = 'FR7600000000000000000000000';
  const r1 = await cas('/api/v2/bank_accounts', JSON.stringify({ bank_account: { account_number: IBAN } }));
  dit(r1 && !JSON.stringify(r1).includes(IBAN), 'un IBAN n’est jamais rangé en clair', JSON.stringify(r1).slice(0, 120));
  dit(r1 && r1.data && r1.data.path === '/api/v2/bank_accounts', 'mais le chemin reste (diagnostic)');
  const r2 = await cas('/api/v2/payments/identity', '{"documents":[{"body":"/9j/PASSEPORT"}]}');
  dit(r2 && !JSON.stringify(r2).includes('PASSEPORT'), 'un scan d’identité non plus');
  const r3 = await cas('/api/v2/users/1/user_2fa/9', '{"code":"8479"}');
  dit(r3 && !JSON.stringify(r3).includes('8479'), 'ni un code de double authentification');
  const r4 = await cas('/api/v2/purchases/abc/checkout/payment', '{"checksum":"SECRET123"}');
  dit(r4 && !JSON.stringify(r4).includes('SECRET123'), 'ni un paiement');
  const r5 = await cas('https://sdk.fra-01.braze.eu/api/v3/data/', '{"api_key":"x"}');
  dit(r5 === null, 'une requête vers un autre site n’est pas rangée du tout', JSON.stringify(r5).slice(0, 80));
  // L'autre sens : ce qui sert à reproduire une action garde son contenu.
  const r6 = await cas('/api/v2/conversations/9/replies', '{"reply":{"body":"merci"}}');
  dit(r6 && JSON.stringify(r6).includes('merci'), 'une réponse garde son contenu (elle sert à reproduire l’action)');
  const r7 = await cas('/api/v2/item_upload/items', '{"item":{"title":"nike"}}');
  dit(r7 && JSON.stringify(r7).includes('nike'), 'une création d’annonce aussi');
  console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) au vert, ${ko} au rouge.`);
  process.exit(ko ? 1 : 0);
})();
