// Audit : la RAISON d'un refus de photo voyage de l'extension jusqu'à l'app (31 oct., 5.292).
//
// CLAUDE.md (seconde revue du 11 octobre) : « Côté extension, à faire : le pont
// ne dit pas POURQUOI il n'a pas d'octets ». Un lien MORT (404/410 du CDN) et un
// refus PASSAGER (429, 5xx, coupure) arrivaient identiques ; l'app redemandait
// les liens morts autant que les autres. Ici, la chaîne RÉELLE est exécutée :
//   photoBytes (background.js) → pont « photo » (bridge.js) → vmrPhotoIssue (App.jsx)
// et la règle (src/photosVinted.js, audit-photos-vinted) reçoit `statut`.
//
// node scripts/audit-photo-pont.cjs [--src <arbre>]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const i = process.argv.indexOf('--src');
const R = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, t, d) => { if (c) { ok++; console.log('✅ ' + t + (d ? ' — ' + d : '')); } else { ko++; console.log('❌ ' + t + (d ? ' — ' + d : '')); } };
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const extraire = (src, debut) => {
  const a = src.indexOf(debut);
  if (a < 0) return '';
  const b = src.indexOf('\n}\n', a);
  return b < 0 ? '' : src.slice(a, b + 2);
};

const BG = lire('vinted-sync-extension/background.js');
const BRIDGE = lire('vinted-sync-extension/bridge.js');
const APP = lire('src/App.jsx');
const srcPhotoBytes = extraire(BG, 'async function photoBytes(url) {');
const srcIssue = extraire(APP, 'function vmrPhotoIssue(url, timeoutMs = 8000) {');
dit(!!srcPhotoBytes, 'photoBytes se trouve dans background.js');
dit(!!srcIssue, 'vmrPhotoIssue se trouve dans App.jsx');

// Un faux CDN : la réponse par URL.
const CDN = {
  'https://images1.vinted.net/t/mort/f800/1.jpeg': { status: 404 },
  'https://images1.vinted.net/t/parti/f800/2.jpeg': { status: 410 },
  'https://images1.vinted.net/t/lent/f800/3.jpeg': { status: 503 },
  'https://images1.vinted.net/t/frein/f800/4.jpeg': { status: 429 },
  'https://images1.vinted.net/t/coupe/f800/5.jpeg': { jette: true },
  'https://images1.vinted.net/t/bonne/f800/6.jpeg': { status: 200 },
};
const fauxFetch = async (u) => {
  const r = CDN[u];
  if (!r || r.jette) throw new TypeError('Failed to fetch');
  return { ok: r.status >= 200 && r.status < 300, status: r.status,
    headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([0xFF, 0xD8, 0xFF, 1, 2, 3]).buffer };
};

// Un « monde » : une fenêtre partagée par la page (l'app) et le monde isolé (le pont).
function monde() {
  const ecoute = [];
  const win = {
    postMessage: (data) => { setTimeout(() => { for (const f of ecoute.slice()) f({ source: win, data }); }, 0); },
    addEventListener: (t, f) => { if (t === 'message') ecoute.push(f); },
    removeEventListener: (t, f) => { const k = ecoute.indexOf(f); if (k >= 0) ecoute.splice(k, 1); },
  };
  const fond = vm.createContext({ fetch: fauxFetch, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), String, Uint8Array });
  vm.runInContext(srcPhotoBytes, fond);
  const rt = {
    id: 'idextension', lastError: null, getManifest: () => ({ version: '9.9.9' }),
    // Le service worker : la même règle d'adresse que background.js, puis photoBytes.
    sendMessage: (msg, cb) => { (async () => {
      if (!/^https:\/\/[\w.-]*vinted\.net\//i.test(String(msg.url || ''))) return { ok: false, error: 'url non autorisée' };
      return await fond.photoBytes(msg.url);
    })().then((r) => setTimeout(() => cb(r), 0)); },
  };
  const isole = vm.createContext({ window: win, chrome: { runtime: rt }, document: { addEventListener() {}, removeEventListener() {}, readyState: 'complete' }, location: { origin: 'https://vrm.center' }, globalThis: {}, setTimeout, clearTimeout, String });
  isole.globalThis = isole;
  vm.runInContext(BRIDGE, isole);
  const page = vm.createContext({ window: win, __vmrExtReady: true, VMR_GRACE_VIDE_MS: 1500, setTimeout, clearTimeout, Promise, Date, Math, String });
  vm.runInContext(srcIssue, page);
  return { fond, page };
}

(async () => {
  if (!srcPhotoBytes || !srcIssue) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }
  // ── 1. photoBytes dit le statut ──────────────────────────────────────────
  {
    const { fond } = monde();
    const r404 = await fond.photoBytes('https://images1.vinted.net/t/mort/f800/1.jpeg');
    const r503 = await fond.photoBytes('https://images1.vinted.net/t/lent/f800/3.jpeg');
    const r0 = await fond.photoBytes('https://images1.vinted.net/t/coupe/f800/5.jpeg');
    const rOk = await fond.photoBytes('https://images1.vinted.net/t/bonne/f800/6.jpeg');
    dit(r404 && r404.ok === false && r404.statut === 404, 'photoBytes : un 404 du CDN rend `statut: 404`', JSON.stringify(r404));
    dit(r503 && r503.statut === 503, 'photoBytes : un 503 rend `statut: 503`', JSON.stringify(r503));
    dit(r0 && r0.ok === false && r0.statut === 0, 'photoBytes : une coupure (fetch qui lève) rend `statut: 0` (réseau, passager)', JSON.stringify(r0));
    dit(rOk && rOk.ok === true && /^data:image\/jpeg;base64,/.test(rOk.dataUrl) && rOk.statut === undefined, 'photoBytes : une photo lue rend ses octets, sans statut', rOk && rOk.dataUrl ? 'octets' : JSON.stringify(rOk));
  }
  // ── 2. La chaîne entière : app → pont → fond → pont → app ──────────────────
  const cas = [
    ['mort', 'https://images1.vinted.net/t/mort/f800/1.jpeg', 404],
    ['parti', 'https://images1.vinted.net/t/parti/f800/2.jpeg', 410],
    ['lent', 'https://images1.vinted.net/t/lent/f800/3.jpeg', 503],
    ['frein', 'https://images1.vinted.net/t/frein/f800/4.jpeg', 429],
    ['coupé', 'https://images1.vinted.net/t/coupe/f800/5.jpeg', 0],
  ];
  for (const [nom, url, attendu] of cas) {
    const { page } = monde();
    const t0 = Date.now();
    const r = await page.vmrPhotoIssue(url, 4000);
    const ms = Date.now() - t0;
    dit(r && r.issue === 'refus' && r.statut === attendu, `chaîne réelle, lien ${nom} : l’app reçoit « refus » ET le statut ${attendu}`, JSON.stringify(r));
    dit(ms < 1000, `… tout de suite (un pont vivant qui dit pourquoi n’attend pas la grâce de 1,5 s des ponts orphelins)`, `${ms} ms`);
  }
  {
    const { page } = monde();
    const r = await page.vmrPhotoIssue('https://images1.vinted.net/t/bonne/f800/6.jpeg', 4000);
    dit(r && r.issue === 'ok' && /^data:image\//.test(r.dataUrl || ''), 'l’autre sens : une photo lue arrive avec ses octets', r && r.issue);
  }
  {
    const { page } = monde();
    const r = await page.vmrPhotoIssue('https://autre.example/x.jpg', 4000);
    dit(r && r.issue === 'refus' && r.statut === undefined, 'une adresse hors du CDN de Vinted : refusée sans statut (jamais un faux « lien mort »)', JSON.stringify(r));
  }
  console.log(`\n${ok} contrôle(s) vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + (e && e.stack || e)); process.exit(1); });
