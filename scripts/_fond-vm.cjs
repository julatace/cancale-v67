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
//    ses `fetch('/api/…')` relatifs sont des requêtes de la PAGE de l'onglet —
//    Vinted, ou l'autre site si l'onglet a navigué (`onglets[i].url` est lu à
//    chaque injection, `location` la suit ; une requête partie hors de Vinted
//    est notée dans `j.horsVinted` et reçoit la réponse de ce site : 403).
//  · 5.281 : un faux TRANSPORTEUR (`transporteur(req)` → { status, body,
//    headers } — Mondial Relay, Chronopost, Vinted Go) qui note chaque requête
//    (adresse, en-têtes, `credentials`, `redirect`) et combien sont en vol ; un
//    faux VRM (`vrm(req)` pour `https://vrm.center/api/…`, corps lu) ; l'API
//    `permissions` (`permis` : vrai · faux · 'muet' · fonction(origine) — absente
//    si `permis` n'est pas donné, comme avant) ; toute AUTRE adresse est notée
//    dans `j.ailleurs` et répond 404.
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
    for (const p0 of parts.slice(1)) { const p = p0.replace(/^"(.*)"$/, '$1'); v = v == null ? undefined : v[p]; }
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
function faireFond({ src, lignes = {}, vinted = () => ({ status: 404, body: {} }), lectureKO = () => false, ecritureKO = () => false, retardLecture = () => 0,
  connecte = '111', comptes = null, store = {}, cdn = null, onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }], firefox = null, retirer = null,
  transporteur = null, vrm = null, permis = undefined, permisAccorde = undefined } = {}) {
  // 21 oct. : l'extension exige une session VRM pour toute lecture/écriture (main f9d3245) ; une session de banc par défaut, sauf si l'audit la règle lui-même.
  if (store.vrmSession === undefined && !store.__sansSession) store.vrmSession = { access_token: 'jeton.banc.defaut', refresh_token: 'r', user_id: 'owner-banc', email: 'banc@vrm.test', expires_at: Date.now() + 365*864e5 };

  const SRC = fs.readFileSync(src || cheminSource(), 'utf8');
  let ecouteur = null;
  const j = { vinted: [], enVol: 0, maxEnVol: 0, posts: [], evts: [], diags: [], journal: [], tampon: { n: {}, rates: {} }, horsVinted: [], injections: 0, minuteries: [],
    transp: [], transpEnVol: 0, transpMaxEnVol: 0, vrmApi: [], ailleurs: [], permisContains: [], permisRequetes: [], permisAjout: [] };
  // `chrome.storage.onChanged` à état (20 octobre : la boîte aux lettres du relais de la page l'utilise).
  const ecoutesStockage = [];
  // 22 oct. : les écouteurs de `chrome.tabs.onUpdated` (une page Vinted qui charge) — `ongletMaj` les rejoue.
  const ecoutesOnglets = [];
  const signaler = (changes) => { if (!Object.keys(changes).length) return; for (const f of ecoutesStockage.slice()) { try { f(changes, 'local'); } catch (_) {} } };
  const rep = (status, body, ctype = 'application/json') => {
    const texte = typeof body === 'string' ? body : JSON.stringify(body == null ? null : body);
    return { ok: status >= 200 && status < 400, status, headers: { get: () => ctype },
      json: async () => JSON.parse(texte), text: async () => texte, clone() { return this; },
      arrayBuffer: async () => Buffer.from(texte).buffer, blob: async () => new Blob([texte]) };
  };
  // Une réponse avec de VRAIS en-têtes (`get` par nom, insensible à la casse) :
  // `rep()` rend le type pour N'IMPORTE QUEL nom, ce qui ferait lire un
  // `cf-mitigated` à toute réponse de transporteur.
  const repH = (status, body, headers = {}) => {
    const texte = typeof body === 'string' ? body : JSON.stringify(body == null ? null : body);
    const h = {}; for (const k of Object.keys(headers || {})) h[k.toLowerCase()] = String(headers[k]);
    if (h['content-type'] === undefined) h['content-type'] = typeof body === 'string' ? 'text/plain' : 'application/json';
    return { ok: status >= 200 && status < 300, status, headers: { get: (k) => (h[String(k).toLowerCase()] !== undefined ? h[String(k).toLowerCase()] : null) },
      json: async () => JSON.parse(texte), text: async () => texte, clone() { return this; },
      arrayBuffer: async () => Buffer.from(texte).buffer };
  };
  const HOTES_TRANSP = /^https:\/\/(?:www\.mondialrelay\.(?:fr|be)|ws\.chronopost\.fr|carrier\.vintedgo\.com|www\.chronopost\.fr|vintedgo\.com)\//;
  const appelTransporteur = async (url, opts) => {
    const u = new URL(url);
    const entree = { url, hote: u.host, chemin: u.pathname + u.search, methode: String((opts && opts.method) || 'GET').toUpperCase(),
      headers: copie((opts && opts.headers) || {}), credentials: opts && opts.credentials, redirect: opts && opts.redirect, cache: opts && opts.cache, at: Date.now() };
    j.transp.push(entree);
    j.transpEnVol++; j.transpMaxEnVol = Math.max(j.transpMaxEnVol, j.transpEnVol);
    await new Promise((r) => setTimeout(r, 3));
    let r;
    try { r = transporteur ? await transporteur(entree) : null; } finally { j.transpEnVol--; }
    if (r && r.reseau) throw new TypeError('Failed to fetch');
    r = r || { status: 404, body: '' };
    return repH(r.status, r.body, r.headers || {});
  };
  const appelVrm = async (url, opts) => {
    const u = new URL(url);
    let corps = null; try { corps = opts && opts.body ? JSON.parse(opts.body) : null; } catch (_) { corps = opts && opts.body; }
    const entree = { url, mode: u.searchParams.get('mode'), methode: String((opts && opts.method) || 'GET').toUpperCase(),
      headers: copie((opts && opts.headers) || {}), corps, octets: opts && opts.body ? Buffer.byteLength(String(opts.body)) : 0, at: Date.now() };
    j.vrmApi.push(entree);
    let r = vrm ? await vrm(entree) : null;
    if (r && r.reseau) throw new TypeError('Failed to fetch');
    r = r || { status: 404, body: { error: 'introuvable' } };
    return repH(r.status, r.body, { 'content-type': 'application/json' });
  };
  const appelVinted = async (url, opts, origine) => {
    const u = String(url);
    const chemin = u.replace(/^https:\/\/[^/]+/, '');
    const entree = { methode: String((opts && opts.method) || 'GET').toUpperCase(), chemin, origine, at: Date.now() };
    // 23 oct. : le signal d'interruption de la requête (non énumérable : rien ne change pour les audits qui comparent `j.vinted`).
    Object.defineProperty(entree, 'signal', { value: opts && opts.signal, enumerable: false });
    // 27 oct. : le corps envoyé (non énumérable aussi) — pour les audits qui
    // doivent vérifier CE qui part (ex. le prix baissé d'une republication).
    Object.defineProperty(entree, 'corps', { value: opts && opts.body, enumerable: false });
    // 29 oct. : les en-têtes envoyés (non énumérables) — Republier part de la page, sans `Authorization`.
    Object.defineProperty(entree, 'entetes', { value: (opts && opts.headers) || {}, enumerable: false });
    Object.defineProperty(entree, 'credentials', { value: opts && opts.credentials, enumerable: false });
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
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: (fn, ms) => { j.minuteries.push(ms); return 0; }, clearInterval,
    URL, TextDecoder, TextEncoder, Buffer, AbortController, AbortSignal, FormData, Blob, Intl, crypto: require('crypto').webcrypto,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } },
        getManifest: () => ({ version: '5.162.0' }), lastError: null, id: 'x', getURL: (p) => 'chrome-extension://x/' + p },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener(fn) { ecoutesOnglets.push(fn); } }, onActivated: { addListener() {} }, onRemoved: { addListener() {} }, query: async () => onglets,
        get: async (id) => { const t = onglets.find((o) => o && o.id === id); if (!t) throw new Error('No tab with id: ' + id); return copie(t); },
        sendMessage: (id, m, cb) => { if (m && m.__vmrEvt) j.evts.push(m.evt); if (typeof cb === 'function') cb(); }, create: dual({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = copie(store[c]); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { const ch = {}; for (const k of Object.keys(o || {})) ch[k] = { oldValue: copie(store[k]), newValue: copie(o[k]) }; Object.assign(store, copie(o)); setTimeout(() => signaler(ch), 0); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove(k, cb) { for (const c of [].concat(k)) delete store[c]; if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
      }, onChanged: { addListener(f) { ecoutesStockage.push(f); }, removeListener(f) { const i = ecoutesStockage.indexOf(f); if (i >= 0) ecoutesStockage.splice(i, 1); } } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: async ({ target, func, args }) => {
        // Le document COURANT de l'onglet (aucune épingle d'origine, comme Chrome).
        const t = onglets.find((o) => o && target && o.id === target.tabId) || onglets[0];
        j.injections++;
        try { ctx.location = new URL((t && t.url) || 'https://www.vinted.fr/'); } catch (_) { ctx.location = undefined; }
        return [{ result: await func(...(args || [])) }];
      } },
      windows: { onRemoved: { addListener() {} } },
      contextMenus: { create() {}, onClicked: { addListener() {} }, removeAll: dual(undefined) },
    },
    fetch: async (url, opts = {}) => {
      const u0 = String(url);
      // Une requête relative vient de la PAGE de l'onglet (fonction injectée).
      if (/^\//.test(u0)) {
        const o = ctx.location && ctx.location.origin;
        if (o && !/(^|\.)vinted\.(fr|com|it|de)$/.test(ctx.location.hostname)) {
          j.horsVinted.push({ url: o + u0, headers: copie(opts.headers || {}), credentials: opts.credentials });
          return rep(403, '<html>Access denied</html>', 'text/html');
        }
        return appelVinted('https://www.vinted.fr' + u0, opts, 'page');
      }
      if (/^https:\/\/[^/]*vinted\.(fr|com|it|de)\//.test(u0)) return appelVinted(u0, opts, 'fond');
      // 28 oct. : le CDN des photos Vinted (recréation d'une annonce), servi par l'audit.
      if (/^https:\/\/images\d*\.vinted\.net\//.test(u0)) { j.cdn = (j.cdn || 0) + 1; const c = cdn ? cdn(u0) : null; return c ? rep(c.status || 200, c.body || 'JPEGDATA', 'image/jpeg') : rep(404, ''); }
      if (/^https:\/\/vrm\.center\/api\//.test(u0)) return appelVrm(u0, opts);
      if (HOTES_TRANSP.test(u0)) return appelTransporteur(u0, opts);
      if (!/\/rest\/v1\//.test(u0)) { j.ailleurs.push({ url: u0, methode: String(opts.method || 'GET').toUpperCase() }); return rep(404, {}); }
      if ((opts.method || 'GET') === 'POST') {
        let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
        if (rows.some((r) => r && ecritureKO(String(r.id)))) return rep(503, '{}');
        j.posts.push(rows.map((r) => r.id));
        for (const r of rows) if (r && r.id != null) lignes[r.id] = copie(r.data);
        return rep(201, '');
      }
      if ((opts.method || 'GET') !== 'GET') return rep(204, '');
      const u = decodeURIComponent(metaVersData(u0));
      if (/app_data\?select=owner&limit=1/.test(u)) return rep(400, { message: 'column app_data.owner does not exist' });
      if (lectureKO(u)) return rep(522, '<html>522</html>', 'text/html');
      const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
      // PostgREST lit un segment NUMÉRIQUE nu comme un index de tableau (int) : au-delà
      // de 2 147 483 647 il répond 400 (mesuré le 28 oct. sur `data->10312441750`).
      if (/->\d+/.test(sel) && (sel.match(/->(\d+)/g) || []).some((x) => Number(x.slice(2)) > 2147483647)) return rep(400, { code: '22003', message: 'value out of range for type integer' });
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.([^&]+)/.exec(u), dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
      const sortie = [];
      if (eq) { if (lignes[eq[1]] !== undefined) sortie.push({ id: eq[1], data: lignes[eq[1]] }); }
      else if (dans) { for (const k of dans[1].split(',')) if (lignes[k] !== undefined) sortie.push({ id: k, data: lignes[k] }); }
      else if (like) {
        const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$');
        for (const k of Object.keys(lignes)) if (re.test(k)) sortie.push({ id: k, data: lignes[k] });
      }
      // Pagination par `Range` (sbGetTout) : on sert tout d'un coup, c'est un banc.
      if (opts.headers && opts.headers.Range && !/^0-/.test(opts.headers.Range)) return rep(200, []);
      // 28 oct. : `retardLecture(u)` → ms : la réponse est l'état de la base AU MOMENT
      // de la lecture, rendue plus tard (une lecture lente pendant qu'un autre écrit).
      const res = rep(200, sortie.filter((r) => filtreOk(r, u)).map((r) => projette(r, sel)));
      const ms = retardLecture(u);
      return ms > 0 ? new Promise((ok) => setTimeout(() => ok(res), ms)) : res;
    },
  };
  // L'API `permissions` (5.281) : seulement si l'audit la décrit — sinon elle
  // manque, comme avant (le fond se tait : « pas su »).
  if (permis !== undefined) {
    const permisDe = (o) => (typeof permis === 'function' ? permis(o) : permis);
    const accordes = new Set();
    ctx.chrome.permissions = {
      contains(q, cb) {
        const origins = (q && q.origins) || [];
        j.permisContains.push(origins.slice());
        const vals = origins.map((o) => (accordes.has(o) ? true : permisDe(o)));
        if (vals.some((v) => v === 'muet')) return typeof cb === 'function' ? undefined : new Promise(() => {});
        const v = vals.every((x) => x === true);
        if (typeof cb === 'function') { Promise.resolve().then(() => cb(v)); return; }
        return Promise.resolve(v);
      },
      request(q, cb) {
        const origins = (q && q.origins) || [];
        j.permisRequetes.push(origins.slice());
        const ok = permisAccorde === undefined ? false : !!(typeof permisAccorde === 'function' ? permisAccorde(origins) : permisAccorde);
        if (ok) for (const o of origins) accordes.add(o);
        if (ok) setTimeout(() => { for (const f of j.permisAjout) { try { f({ origins }); } catch (_) {} } }, 0);
        if (typeof cb === 'function') { Promise.resolve().then(() => cb(ok)); return; }
        return Promise.resolve(ok);
      },
      onAdded: { addListener(f) { j.permisAjout.push(f); } },
      onRemoved: { addListener() {} },
    };
  }
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  // `retirer` (20 octobre) : imite un navigateur à qui il MANQUE des API
  // (Orion iPhone, Safari, Firefox pour Android) — chaque chemin pointé
  // (`alarms`, `windows.update`, `runtime.onMessageExternal`…) est SUPPRIMÉ
  // avant que le fond ne démarre, exactement comme s'il n'existait pas.
  for (const chemin of retirer || []) {
    const parts = String(chemin).split('.'); let o = ctx.chrome;
    for (const k of parts.slice(0, -1)) o = o && o[k];
    if (o) delete o[parts[parts.length - 1]];
  }
  if (!ctx.chrome.runtime.onMessageExternal && !(retirer || []).includes('runtime.onMessageExternal')) ctx.chrome.runtime.onMessageExternal = { addListener() {} };
  // `firefox` (5.188) : imite Firefox — `browser.*` rend des promesses,
  // `chrome.*` n'accepte QUE des rappels (sans rappel il ne rend rien : le pire
  // cas). `firefox.compat` = le source de compat-firefox.js, exécuté AVANT le
  // fond, comme dans le paquet (`background.scripts`). Sans lui, le fond tourne
  // sur ce `chrome` à rappels seuls : c'est la preuve que la compat compte.
  if (firefox) {
    const promesses = ctx.chrome;
    const ECOUTE = /^(addListener|removeListener|hasListener)$/;
    const rappelsSeuls = (o) => new Proxy(o, { get(c, k) {
      const v = c[k];
      if (typeof v === 'function') return function (...a) {
        if (ECOUTE.test(String(k)) || typeof a[a.length - 1] === 'function') return v.apply(c, a);
        const r = v.apply(c, a); if (r && typeof r.then === 'function') { r.catch(() => {}); return undefined; } return r;
      };
      return v && typeof v === 'object' ? rappelsSeuls(v) : v;
    } });
    ctx.browser = promesses;
    ctx.chrome = rappelsSeuls(promesses);
  }
  vm.createContext(ctx);
  if (firefox && firefox.compat) vm.runInContext(firefox.compat, ctx, { filename: 'compat-firefox.js' });
  vm.runInContext(SRC, ctx, { filename: 'background.js' });
  // Les portes du monde extérieur, remplacées pour COMPTER.
  ctx.getStoredAccounts = async () => (comptes || [{ vinted_user_id: connecte || '111', login: 'compte_banc', domain: 'www.vinted.fr', access_token: 'jeton' }]).map(a=>({...a,owner:store.vrmSession?.user_id}));
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
  const ongletMaj = (tabId, info, tab) => { for (const f of ecoutesOnglets.slice()) { try { f(tabId, info, tab); } catch (_) {} } };
  return { ctx, j, store, lignes, envoyer, signaler, ongletMaj };
}
module.exports = { faireFond, cheminSource, projette };
