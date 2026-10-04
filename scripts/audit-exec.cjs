// ════════════════════════════════════════════════════════════════════════════
//  LE CANAL `exec` (l'app fait agir l'extension) RESPECTE LES GARDE-FOUS DU §3
//
//  Mesuré le 2 octobre : le message `exec` du pont ne vérifiait que « /api/ ».
//  Ni l'origine (tous les autres messages du pont la vérifient), ni le compte
//  connecté dans Chrome (`garde`), ni le plafond de 20 actions/h, ni la méthode :
//  un `DELETE /api/v2/items/{id}` — la suppression d'annonce que §3 refuse —
//  serait parti depuis n'importe quel script de la page.
//
//  ⚠️ §4.10 : on EXÉCUTE le vrai `background.js` dans un `vm`, on récupère le
//  vrai écouteur `chrome.runtime.onMessage` et on COMPTE ce qui part chez Vinted.
//  ⚠️ Et l'AUTRE SENS : *tout refuser* passerait tous les contrôles « rien ne
//  part ». Une vraie réponse, sur le bon compte, doit partir.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
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
  const store = {}; const envois = []; let ecouteur = null;
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: '9.9.9' }), lastError: null, id: 'x' },
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
  ctx.activeAccountId = async () => connecte;            // le compte du cookie Vinted
  ctx.vintedSend = async (acc, method, endpoint) => { envois.push(method + ' ' + endpoint); return { ok: true, status: 200, json: {} }; };
  ctx.vintedGet = async (acc, endpoint) => { envois.push('GET ' + endpoint); return { ok: true, status: 200, json: { conversation: { id: 1 } } }; };
  const envoyer = (msg, origine = APP) => new Promise((res) => {
    if (!ecouteur) { res({ __pasDEcouteur: true }); return; }
    const r = ecouteur(Object.assign({ from: 'vmr-bridge', action: 'exec' }, msg), { origin: origine, url: origine + '/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  return { ctx, envois, envoyer };
}

const REPONSE = { uid: UID, method: 'POST', endpoint: '/api/v2/conversations/123/replies', body: { reply: { body: 'Oui !' } } };

(async () => {
  await essaie('autre sens : une vraie réponse sur le bon compte part', async () => {
    const { envois, envoyer } = faireCtx();
    const r = await envoyer(REPONSE);
    dit(r && r.ok === true && envois.length === 1, 'autre sens : une réponse à un message, sur le compte connecté, PART', JSON.stringify(r) + ' · ' + envois.join(','));
  });
  await essaie('suppression d\'annonce refusée', async () => {
    const { envois, envoyer } = faireCtx();
    const r = await envoyer({ uid: UID, method: 'DELETE', endpoint: '/api/v2/items/9944967551' });
    dit(envois.length === 0 && r && r.ok === false, '`DELETE /api/v2/items/{id}` (supprimer une annonce, §3) ne part pas', envois.join(','));
  });
  await essaie('requête arbitraire refusée', async () => {
    const { envois, envoyer } = faireCtx();
    await envoyer({ uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/1/shipment/order', body: {} });
    await envoyer({ uid: UID, method: 'POST', endpoint: '/api/v2/items/1/push_up' });
    dit(envois.length === 0, 'une requête hors liste blanche ne part pas (PUT bordereau, push_up)', envois.join(','));
  });
  await essaie('origine', async () => {
    const { envois, envoyer } = faireCtx();
    const r = await envoyer(REPONSE, 'https://site-malveillant.example');
    dit(envois.length === 0 && r && r.ok === false, 'une page qui n\'est pas l\'app ne fait rien partir', envois.join(','));
  });
  await essaie('autre compte', async () => {
    const { envois, envoyer } = faireCtx({ connecte: '999' });
    const r = await envoyer(REPONSE);
    dit(envois.length === 0 && r && r.code === 'vinted-autre', 'Chrome connecté sur UN AUTRE compte : rien ne part, et la raison est « vinted-autre »', JSON.stringify(r));
  });
  await essaie('aucun compte', async () => {
    const { envois, envoyer } = faireCtx({ connecte: null });
    const r = await envoyer(REPONSE);
    dit(envois.length === 0 && r && r.code === 'vinted-absent', 'aucun compte lisible dans Chrome : rien ne part (« pas su » ne vaut pas « oui »)', JSON.stringify(r));
  });
  await essaie('plafond', async () => {
    const { envois, envoyer } = faireCtx();
    let dernier = null;
    for (let i = 0; i < 21; i++) dernier = await envoyer(REPONSE);
    dit(envois.length === 20 && dernier && dernier.code === 'plafond', 'la 21ᵉ action dans l\'heure est refusée (plafond de 20/h)', `${envois.length} envoi(s), dernière réponse ${JSON.stringify(dernier)}`);
  });
  // ── 5.135 : la messagerie intégrée (3 octobre) ────────────────────────────
  await essaie('les gestes d\'offre depuis l\'app', async () => {
    const { envois, envoyer } = faireCtx();
    const a = await envoyer({ uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/123/offer_requests/456/accept' });
    const b = await envoyer({ uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/123/offer_requests/456/reject' });
    const c = await envoyer({ uid: UID, method: 'POST', endpoint: '/api/v2/transactions/123/offers', body: { offer: { price: '45', currency: 'EUR' } } });
    dit(a && a.ok && b && b.ok && c && c.ok && envois.length === 3, 'accepter, refuser, faire une offre : sur SON clic, ça part', envois.join(','));
  });
  await essaie('lire une conversation', async () => {
    const { envois, envoyer } = faireCtx();
    let r = null;
    for (let i = 0; i < 25; i++) r = await envoyer({ uid: UID, method: 'GET', endpoint: '/api/v2/conversations/987' });
    dit(r && r.ok && r.data && r.data.conversation && envois.length === 25, 'LIRE un fil part, et ne consomme pas le plafond des actions (25 lectures)', `${envois.length} lecture(s)`);
    const g = await envoyer({ uid: UID, method: 'GET', endpoint: '/api/v2/users/1/items' });
    dit(g && g.ok === false && envois.length === 25, 'mais une autre lecture (hors liste) ne part pas', envois.slice(25).join(','));
  });
  await essaie('lecture sur un autre compte', async () => {
    const { envois, envoyer } = faireCtx({ connecte: '999' });
    const r = await envoyer({ uid: UID, method: 'GET', endpoint: '/api/v2/conversations/987' });
    dit(envois.length === 0 && r && r.code === 'vinted-autre', 'lire le fil d\'un compte qui n\'est pas celui de Chrome : rien ne part', JSON.stringify(r));
  });
  await essaie('offre sur un autre chemin', async () => {
    const { envois, envoyer } = faireCtx();
    await envoyer({ uid: UID, method: 'DELETE', endpoint: '/api/v2/transactions/123/offers' });
    await envoyer({ uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/123/offer_requests/456/delete' });
    dit(envois.length === 0, 'une variante hors liste (DELETE, autre verbe) ne part pas', envois.join(','));
  });
  // ── 5.136 : le PDF d'un bordereau Leboncoin, et RIEN d'autre ──────────────
  await essaie('pdfBordereauLbc', async () => {
    const { ctx } = faireCtx();
    if (typeof ctx.pdfBordereauLbc !== 'function') { dit(false, 'pdfBordereauLbc existe'); return; }
    const appels = [];
    const rep = (octets, ok = true) => ({ ok, status: ok ? 200 : 403, arrayBuffer: async () => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength), headers: { get: () => 'application/pdf' } });
    ctx.fetch = async (u) => { appels.push(String(u)); return /html/.test(String(u)) ? rep(Buffer.from('<html>login</html>')) : rep(Buffer.from('%PDF-1.7 test')); };
    const a = await ctx.pdfBordereauLbc('https://api.leboncoin.fr/api/shippingproxy/v1/parcels/abc-123/label');
    dit(a && a.ok && /^data:application\/pdf;base64,/.test(a.dataUrl), 'le PDF du bordereau de CE colis est lu', JSON.stringify(a).slice(0, 80));
    const b = await ctx.pdfBordereauLbc('https://api.leboncoin.fr/api/messaging/v1/conversations');
    const c = await ctx.pdfBordereauLbc('https://www.vinted.fr/api/v2/users/1');
    dit(b && !b.ok && c && !c.ok && appels.length === 1, 'aucune autre adresse ne passe par ce pont (messagerie, Vinted…)', appels.join(','));
    ctx.fetch = async () => rep(Buffer.from('<html>connexion</html>'));
    const d = await ctx.pdfBordereauLbc('https://api.leboncoin.fr/api/shippingproxy/v1/parcels/abc-123/label');
    dit(d && !d.ok, 'une page HTML (session expirée) n\'est jamais prise pour un bordereau', JSON.stringify(d));
  });
  // ── 4 octobre : SEULES les adresses du projet sont « l'app » ───────────────
  // L'extension faisait confiance à `cancale-v67.vercel.app` et `www.vrm.center`,
  // qui ne sont PAS au projet Vercel (la première est à quelqu'un d'autre ou à
  // prendre). Une page servie là pouvait faire adopter SA session VRM (les
  // captures de Julien partaient dans sa boutique) et commander des actions
  // Vinted. Et la règle n'était pas ancrée : `https://vrm.center.x.example` passait.
  const POSSEDEES = ['https://vrm.center', 'https://cancale-v67-ten.vercel.app'];   // vérifiées sur le projet le 4 octobre
  const IMPOSTEURS = ['https://cancale-v67.vercel.app', 'https://www.vrm.center', 'https://vrm.center.autre-site.example', 'http://vrm.center', 'https://cancale-v67-ten.vercel.app.autre.example'];
  await essaie('imposteurs', async () => {
    const acceptes = [];
    for (const o of IMPOSTEURS) {
      const { envois, envoyer } = faireCtx();
      const s1 = await envoyer({ action: 'session', session: { access_token: 'a.b.c', user_id: 'pirate' } }, o);
      const e1 = await envoyer(REPONSE, o);
      const a1 = await envoyer({ action: 'authEtat' }, o);
      if ((s1 && s1.ok) || (e1 && e1.ok) || envois.length || (a1 && a1.ok !== false)) acceptes.push(o);
    }
    dit(acceptes.length === 0, 'une adresse qui n\'est pas au projet (cancale-v67.vercel.app, www.vrm.center, vrm.center.autre…) ne transmet ni session, ni action, ni question', acceptes.join(', '));
  });
  await essaie('autre sens : les adresses du projet', async () => {
    const refuses = [];
    for (const o of POSSEDEES) {
      const { envois, envoyer } = faireCtx();
      const s1 = await envoyer({ action: 'session', session: null }, o);
      const e1 = await envoyer(REPONSE, o);
      if (!(s1 && s1.ok) || !(e1 && e1.ok) || envois.length !== 1) refuses.push(o);
    }
    dit(refuses.length === 0, 'autre sens : vrm.center et l\'adresse Vercel du projet restent l\'app', refuses.join(', '));
  });
  await essaie('manifeste', async () => {
    const m = JSON.parse(fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    const pont = (m.content_scripts || []).filter((c) => (c.js || []).includes('bridge.js')).flatMap((c) => c.matches || []);
    const appLike = (u) => /vrm\.center|vercel\.app/.test(u);
    const hors = [...pont, ...(m.host_permissions || []).filter(appLike)].filter((u) => !POSSEDEES.some((o) => u === o + '/*'));
    dit(pont.length > 0 && hors.length === 0, 'le pont n\'est injecté, et l\'app n\'est autorisée, QUE sur les adresses du projet', hors.join(', '));
  });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
