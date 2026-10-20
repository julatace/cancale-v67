// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : AUCUN GESTE VINTED QUI ENGAGE UNE VENTE NE PART SANS LUI, NI SOUS UN
//          AUTRE COMPTE QUE CELUI DE L'ONGLET     node scripts/audit-argent-vinted.cjs
//
//  Revue adverse du 19 octobre. On EXÉCUTE le vrai `background.js` dans un `vm`
//  (le harnais d'`audit-exec.cjs`) et on COMPTE ce qui part chez Vinted.
//   V1. accepter une offre par `exec` SANS `confirme` : rien ne part
//       (l'app l'envoyait, le pont le jetait, le fond ne l'exigeait pas) ;
//   V2. l'autre sens : avec `confirme`, l'acceptation part, une fois ;
//   V3. une réponse en ATTENTE dans la file Vinted, le compte du cookie basculé
//       entre-temps : rien ne part ;
//   V4. un bordereau en attente dans la file, même bascule : aucun PUT ;
//   V5. l'autre sens de V4 : sans bascule, le bordereau est généré.
//  --mutation=confirme|fileexec|filebord réaffaiblit une garde : rouge attendu.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
let src0 = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const MUT = {
  confirme: ["if (permis.confirmer && msg.confirme !== true) return", "if (false) return"],
  fileexec: ["arret = await gardeStricte(msg.uid, acc, { lecture: true });", "arret = null;"],
  filebord: ["const aSonTour = await gardeStricte(uid, acc, { lecture: true });", "const aSonTour = null;"],
};
const mutation = (/--mutation=(\w+)/.exec(process.argv.join(' ')) || [])[1];
if (mutation) { const m = MUT[mutation]; if (!m || !src0.includes(m[0])) { console.log('❌ mutation ' + mutation + ' introuvable'); process.exit(1); } src0 = src0.replace(m[0], m[1]); console.log('(mutation : ' + mutation + ')'); }
const src = src0;

const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); }
};
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '3175765377';
const APP = 'https://vrm.center';

function faireCtx({ connecte = UID } = {}) {
  let cookie = connecte;
  const store = {}; const envois = []; let ecouteur = null, externe = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder, crypto: require('crypto').webcrypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, onMessageExternal: { addListener(fn) { externe = fn; } }, getManifest: () => ({ version: '9.9.9' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined), create: dual({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c]; if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
    fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => 'application/json' } }),
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'angeled92', domain: 'www.vinted.fr' }, { vinted_user_id: '999', login: 'autre', domain: 'www.vinted.fr' }];
  ctx.activeAccountId = async () => cookie;
  ctx.basculer = (u) => { cookie = u; };            // le compte du cookie Vinted
  ctx.vintedSend = async (acc, method, endpoint) => { envois.push(method + ' ' + endpoint); return { ok: true, status: 200, json: {} }; };
  ctx.vintedGet = async (acc, endpoint) => { envois.push('GET ' + endpoint); return { ok: true, status: 200, json: { conversation: { id: 1 } } }; };
  const envoyer = (msg, origine = APP) => new Promise((res) => {
    if (!ecouteur) { res({ __pasDEcouteur: true }); return; }
    const r = ecouteur(Object.assign({ from: 'vmr-bridge', action: 'exec' }, msg), { origin: origine, url: origine + '/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  // 11 octobre : la session de l'extension n'arrive plus que par le canal
  // ADRESSÉ (`onMessageExternal`, `externally_connectable`). Chrome y pose
  // lui-même `sender.origin`.
  const versExt = (msg, origine = APP) => new Promise((res) => {
    if (!externe) { res({ __pasDEcouteur: true }); return; }
    const r = externe(msg, { origin: origine, url: origine + '/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  return { ctx, envois, envoyer, versExt, store };
}


const ACCEPTE = { uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/123/offer_requests/456/accept' };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await essaie('V1', async () => {
    const { envoyer, envois } = faireCtx();
    const r = await envoyer(ACCEPTE);
    dit(!envois.some((e) => /accept$/.test(e)), 'V1 — accepter une offre SANS confirmation : rien ne part chez Vinted', envois.join(',') + ' · ' + JSON.stringify(r && { ok: r.ok, code: r.code }));
  });
  await essaie('V2', async () => {
    const { envoyer, envois } = faireCtx();
    const r = await envoyer(Object.assign({ confirme: true }, ACCEPTE));
    dit(r && r.ok && envois.filter((e) => /accept$/.test(e)).length === 1, "V2 — autre sens : avec SA confirmation, l'acceptation part, une fois", envois.join(','));
  });
  await essaie('V3', async () => {
    const { ctx, envoyer, envois } = faireCtx();
    let lacher; ctx.avecVinted(() => new Promise((r) => { lacher = r; }));   // une requête Vinted en vol
    const p = envoyer({ uid: UID, method: 'POST', endpoint: '/api/v2/conversations/123/replies', body: { reply: { body: 'Oui' } } });
    await attendre(30); ctx.basculer('999'); lacher();
    const r = await p;
    dit(!envois.length, 'V3 — réponse en file, compte du cookie basculé entre-temps : rien ne part', envois.join(',') + ' · ' + JSON.stringify(r && { ok: r.ok, code: r.code }));
  });
  const bord = async (basculer) => {
    const f = faireCtx();
    const { ctx, envois } = f;
    ctx.labelDejaRange = async () => false;
    ctx.recupererLabel = async () => ({ ok: false });
    ctx.recupererLabelInsiste = async () => ({ ok: true });
    ctx.adresseVendeur = async () => 42;
    ctx.attendreBordereau = async () => {};
    let lacher; ctx.avecVinted(() => new Promise((r) => { lacher = r; }));
    const acc = await ctx.executerCommande({ cmd: 'bordereau', uid: UID, tx: '22100000001' });
    await attendre(30); if (basculer) ctx.basculer('999'); lacher();
    await attendre(80);
    const cmd = ((f.store.vrmCmds || {})['bord:' + UID + ':22100000001']) || {};
    return { acc, envois, cmd };
  };
  await essaie('V4', async () => {
    const { acc, envois, cmd } = await bord(true);
    dit(acc && acc.accepte, 'V4 — (la commande est bien admise sur le bon compte)', JSON.stringify(acc));
    dit(!envois.some((e) => /shipment\/order/.test(e)), 'V4 — bordereau en file, compte basculé entre-temps : aucun PUT chez Vinted', envois.join(',') + ' · étape=' + cmd.etape);
  });
  await essaie('V5', async () => {
    const { envois, cmd } = await bord(false);
    dit(envois.filter((e) => /shipment\/order/.test(e)).length === 1, 'V5 — autre sens : sans bascule, le bordereau est généré une fois', envois.join(',') + ' · étape=' + cmd.etape);
  });
  console.log(ko ? `\n❌ ${ko} contrôle(s) au rouge` : `\n✅ argent Vinted : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
