// ════════════════════════════════════════════════════════════════════════════
//  LE VRAI `background.js` DANS UN `vm` — banc commun des audits de la 5.162
//  (audit-budget-lectures, audit-inbox-fusion, audit-frein-vinted).
//
//  · une fausse base Supabase À ÉTAT : ce qui est écrit se relit, la projection
//    `select=` est APPLIQUÉE (§6.3 — une ligne brute rendue à une requête
//    projetée fait lire un champ absent), `meta->>k` est retraduit vers son
//    chemin d'origine (`bancs/_meta.cjs`, la même règle que le SQL) ;
//  · un faux Vinted qui COMPTE chaque requête (méthode, chemin, origine) et
//    mesure combien sont EN VOL en même temps ;
//  · `chrome.storage.local` à état (le budget, la pause, les mémos y vivent) ;
//  · `chrome.scripting.executeScript` exécute VRAIMENT la fonction injectée :
//    ses `fetch('/api/…')` relatifs sont des requêtes de la PAGE Vinted.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
//  `--src chemin` (dans `process.argv`) exécute une autre copie du fichier —
//  c'est la preuve sur le code d'AVANT (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const { metaVersData } = require('./bancs/_meta.cjs');

function cheminSource(argv = process.argv) {
  const i = argv.indexOf('--src');
  return i > 0 ? path.resolve(argv[i + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
}
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Projection PostgREST : `data`, `id`, `alias:data->a->b`, `alias:data->>k`.
function projette(row, select) {
  if (!select) return { id: row.id, data: row.data };
  const out = {};
  for (const champ of select.split(',')) {
    const m = /^(?:([A-Za-z_]\w*):)?(.+)$/.exec(champ.trim());
    if (!m) continue;
    const alias = m[1], expr = m[2];
    if (expr === 'data' || expr === 'id') { out[alias || expr] = expr === 'id' ? row.id : row.data; continue; }
    const texte = /->>[^>]*$/.test(expr);
    const parts = expr.split(/->>|->/);
    let v = parts[0] === 'data' ? row.data : row[parts[0]];
    for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias || parts[parts.length - 1]] = v === undefined ? null : v;
  }
  return out;
}
// Un filtre PostgREST sur un chemin JSON (`data->>status=eq.450`, `…=not.is.null`).
function filtreOk(row, u) {
  const re = /[?&](data(?:->>?[A-Za-z_]+)+)=([^&]+)/g; let m;
  while ((m = re.exec(u))) {
    const parts = m[1].split(/->>|->/); let v = row.data;
    for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
    const cond = m[2];
    if (/^eq\./.test(cond) && String(v) !== cond.slice(3)) return false;
    if (cond === 'not.is.null' && v == null) return false;
    if (cond === 'is.null' && v != null) return false;
  }
  return true;
}

// `vinted(req)` → { status, body } (body : objet → JSON, chaîne → texte).
// `lectureKO(u)` → vrai pour faire échouer une LECTURE de la base (522).
function faireFond({ src, lignes = {}, vinted = () => ({ status: 404, body: {} }), lectureKO = () => false,
  connecte = '111', comptes = null, store = {}, onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }] } = {}) {
  const SRC = fs.readFileSync(src || cheminSource(), 'utf8');
  let ecouteur = null;
  const j = { vinted: [], enVol: 0, maxEnVol: 0, posts: [], evts: [], diags: [], journal: [], tampon: { n: {}, rates: {} } };
  const rep = (status, body, ctype = 'application/json') => {
    const texte = typeof body === 'string' ? body : JSON.stringify(body == null ? null : body);
    return { ok: status >= 200 && status < 400, status, headers: { get: () => ctype },
      json: async () => JSON.parse(texte), text: async () => texte, clone() { return this; },
      arrayBuffer: async () => Buffer.from(texte).buffer };
  };
  const appelVinted = async (url, opts, origine) => {
    const u = String(url);
    const chemin = u.replace(/^https:\/\/[^/]+/, '');
    const entree = { methode: String((opts && opts.method) || 'GET').toUpperCase(), chemin, origine, at: Date.now() };
    j.vinted.push(entree);
    j.enVol++; j.maxEnVol = Math.max(j.maxEnVol, j.enVol);
    await new Promise((r) => setTimeout(r, 3));
    let r;
    try { r = await vinted(entree); } finally { j.enVol--; }
    r = r || { status: 404, body: {} };
    return rep(r.status, r.body, typeof r.body === 'string' ? 'text/html' : 'application/json');
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder, Buffer,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } },
        getManifest: () => ({ version: '5.162.0' }), lastError: null, id: 'x', getURL: (p) => 'chrome-extension://x/' + p },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, onRemoved: { addListener() {} }, query: async () => onglets,
        sendMessage: (id, m, cb) => { if (m && m.__vmrEvt) j.evts.push(m.evt); if (typeof cb === 'function') cb(); }, create: dual({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = copie(store[c]); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, copie(o)); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove(k, cb) { for (const c of [].concat(k)) delete store[c]; if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: async ({ func, args }) => [{ result: await func(...(args || [])) }] },
      windows: { onRemoved: { addListener() {} } },
      contextMenus: { create() {}, onClicked: { addListener() {} }, removeAll: dual(undefined) },
    },
    fetch: async (url, opts = {}) => {
      const u0 = String(url);
      // Une requête relative vient de la PAGE Vinted (fonction injectée).
      if (/^\//.test(u0)) return appelVinted('https://www.vinted.fr' + u0, opts, 'page');
      if (/^https:\/\/[^/]*vinted\.(fr|com|it|de)\//.test(u0)) return appelVinted(u0, opts, 'fond');
      if (!/\/rest\/v1\//.test(u0)) return rep(404, {});
      if ((opts.method || 'GET') === 'POST') {
        let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
        j.posts.push(rows.map((r) => r.id));
        for (const r of rows) if (r && r.id != null) lignes[r.id] = copie(r.data);
        return rep(201, '');
      }
      if ((opts.method || 'GET') !== 'GET') return rep(204, '');
      const u = decodeURIComponent(metaVersData(u0));
      if (/app_data\?select=owner&limit=1/.test(u)) return rep(400, { message: 'column app_data.owner does not exist' });
      if (lectureKO(u)) return rep(522, '<html>522</html>', 'text/html');
      const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.([^&]+)/.exec(u);
      const sortie = [];
      if (eq) { if (lignes[eq[1]] !== undefined) sortie.push({ id: eq[1], data: lignes[eq[1]] }); }
      else if (like) {
        const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$');
        for (const k of Object.keys(lignes)) if (re.test(k)) sortie.push({ id: k, data: lignes[k] });
      }
      // Pagination par `Range` (sbGetTout) : on sert tout d'un coup, c'est un banc.
      if (opts.headers && opts.headers.Range && !/^0-/.test(opts.headers.Range)) return rep(200, []);
      return rep(200, sortie.filter((r) => filtreOk(r, u)).map((r) => projette(r, sel)));
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'background.js' });
  // Les portes du monde extérieur, remplacées pour COMPTER.
  ctx.getStoredAccounts = async () => (comptes || [{ vinted_user_id: connecte || '111', login: 'compte_banc', domain: 'www.vinted.fr', access_token: 'jeton' }]);
  ctx.activeAccountId = async () => connecte;
  ctx.activeUidForDomain = async () => connecte;
  ctx.noterDiag = async (k) => { j.diags.push(k); };
  ctx.echantillonRate = async () => {};
  ctx.majTampon = (fn) => { try { fn(j.tampon); } catch (_) {} return Promise.resolve(); };
  ctx.logActivity = async (t) => { j.journal.push(String(t)); };
  const envoyer = (msg, sender) => new Promise((res) => {
    if (!ecouteur) { res(undefined); return; }
    const r = ecouteur(msg, sender || { origin: 'https://vrm.center', url: 'https://vrm.center/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  return { ctx, j, store, lignes, envoyer };
}
module.exports = { faireFond, cheminSource, projette };
