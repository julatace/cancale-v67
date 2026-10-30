// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN — « MES ANNONCES » DÉCIDE, ET UNE SUPPRESSION VUE SORT L'ANNONCE (29 oct.)
//   node scripts/audit-lbc-mes-annonces.cjs [--src background.js] [--inject lbc-inject.js]
//        [--relay lbc-relay.js] [--app App.jsx] [--serveur double-vente.js]
//   node scripts/audit-lbc-mes-annonces.cjs --prouve   (réaffaiblit chaque règle : chacune doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (29 oct.) : « il n'y a plus que 2 annonces et VRM en a encore 8 ».
// MESURÉ (lecture seule, sa base) :
//   · 11 annonces à son compte particulier, toutes `status: 'active'` ; 3 vendues
//     sur Leboncoin ⇒ 8 « en vente » pour VRM ; seules 2 revues ce matin par
//     sa page « Mes annonces » ; aucune lecture complète jamais posée (`lectures`
//     absent) ;
//   · « Mes annonces » charge `POST api.leboncoin.fr/api/dashboard/v1/search`,
//     corps { context, filters.owner.user_id, limit, offset, sort_by,
//     sort_order, include_inactive, include_draft }, réponse { total,
//     account_stats, pivot, ads[].list_id, ads[].status, ads[].owner.user_id } —
//     elle passait en `lbcraw`, sans jamais DÉCIDER ;
//   · sa suppression de la N°18 (vendue sur Vinted le 18) sur leboncoin.fr le
//     28 oct. à 22:47 : `DELETE …/pintad/v1/public/manual/delete/ads`,
//     corps { list_ids:[number] } — VRM ne l'a pas vue.
// Le VRAI lbc-inject.js, le VRAI lbc-relay.js et le VRAI background.js sont
// exécutés (vm), avec des identifiants INVENTÉS.
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/lbc-inject.js')),
  relay: arg('--relay', path.join(racine, 'vinted-sync-extension/lbc-relay.js')),
  app: arg('--app', path.join(racine, 'src/App.jsx')),
  serveur: arg('--serveur', path.join(racine, 'api/_lib/double-vente.js')),
  etat: arg('--etat', path.join(racine, 'src/etatAnnonceLeboncoin.js')),
};
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['tableauIgnore', 'inject', "const LISTE_VENDEUR = (u) => OWNER_LISTING.test(String(u || '')) || DASHBOARD.test(String(u || ''));", "const LISTE_VENDEUR = (u) => OWNER_LISTING.test(String(u || ''));"],
    ['tableauFiltre', 'inject', "if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).length !== 1) return null;", "if (!f || typeof f !== 'object' || Array.isArray(f)) return null;"],
    ['retrait2xx', 'inject', "if (!m || !(statut >= 200 && statut < 300)) return;", 'if (!m) return;'],
    ['retraitMiens', 'src', "if (!miens.has(idCompteLbc(ad.account || ad.lbcUser))) continue;\n        if (quoi === 'supprime') {", "if (quoi === 'supprime') {"],
    ['etatSansSortie', 'etat', " const sortie = etat==='vendue' || etat==='retiree' ? null : (typeof sortieDe==='function' ? sortieDe(ad) : null);", " const sortie = null;"],
    ['retraitStatutFond', 'src', "|| !(msg.quoi === 'supprime' || msg.quoi === 'pause') || !(statut >= 200 && statut < 300)) { sendResponse({ ok: false }); return; }", "|| !(msg.quoi === 'supprime' || msg.quoi === 'pause')) { sendResponse({ ok: false }); return; }"],
    ['statsUnId', 'inject', "if (new Set(ids).size !== 1) return;", "if (!ids.length) return;"],
    ['statsMiens', 'src', "if (!ad || typeof ad !== 'object' || !miens.has(idCompteLbc(ad.account || ad.lbcUser))) { noterDiag('lbc_stats_pas_a_lui'); return { ok: true, n: 0 }; }", "if (!ad || typeof ad !== 'object') { return { ok: true, n: 0 }; }"],
    ['suppressionCollante', 'src', "if(st&&!LBC_ANNONCE_MORTE.test(st)&&!(Date.now()-Date.parse(ancien.supprimeeAt)<=LBC_PAUSE_INDEX_MS))", "if(st&&!LBC_ANNONCE_MORTE.test(st))"],
    ['suppressionDefinitiveCapture', 'src', "if(st&&!LBC_ANNONCE_MORTE.test(st)&&!(Date.now()-Date.parse(ancien.supprimeeAt)<=LBC_PAUSE_INDEX_MS))", "if(false)"],
    ['suppressionDefinitiveListe', 'src', "if (n.supprimeeAt && maintenant - Date.parse(n.supprimeeAt) > LBC_PAUSE_INDEX_MS) {", "if (false) {"],
    ['compteursSansFiltre', 'src', "if (/^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(k) && typeof v !== 'boolean' && v !== '' && v !== null && Number.isFinite(n) && n >= 0 && n < 1e7) cpt[k] = Math.round(n);", "cpt[k] = v;"],
    ['retraitSite', 'src', "|| !/^https:\\/\\/(?:[a-z0-9-]+\\.)*leboncoin\\.fr\\//i.test(tabUrl) || !ids", "|| !ids"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-mes-annonces-prouve-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 240000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

const SRC = fs.readFileSync(F.src, 'utf8');
const INJ = fs.readFileSync(F.inject, 'utf8');
const REL = fs.readFileSync(F.relay, 'utf8');
const APP = fs.readFileSync(F.app, 'utf8');
const SRV = fs.readFileSync(F.serveur, 'utf8');

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + (e && e.message)); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const silence = { log() {}, warn() {}, error() {}, info() {} };

const MON = '8442aaaa-0000-4000-8000-000000000001';      // son compte Leboncoin (inventé)
const AUTRE = 'bbbb2222-0000-4000-8000-000000000002';    // un autre vendeur
const API = 'https://api.leboncoin.fr/api';
const OWNER_V2 = `${API}/adfinder/v2/owner_listing`;
const URL_PAUSE = `${API}/pintad/v1/public/manual/pause/ads`;

// ── La page leboncoin.fr : le capteur (MAIN) et le relais (isolé) sur la MÊME fenêtre ──
function page({ reseau = () => null, top = true, hote = 'www.leboncoin.fr', fond = null } = {}) {
  const ecouteurs = [], posts = [], appels = [], envoyes = [], onMsg = [];
  const win = {};
  win.postMessage = (m) => { const d = JSON.parse(JSON.stringify(m)); posts.push(d); setTimeout(() => { for (const f of ecouteurs.slice()) { try { f({ source: win, data: d }); } catch (_) {} } }, 0); };
  win.addEventListener = (t, f) => { if (t === 'message') ecouteurs.push(f); };
  win.fetch = async (u, init) => {
    const url = typeof u === 'string' ? u : u.url;
    appels.push({ url, methode: (init && init.method) || 'GET', corps: init && init.body, entetes: init && init.headers ? JSON.parse(JSON.stringify(init.headers)) : null, credentials: init && init.credentials });
    await attendre(3);
    const r = reseau(url, init) || { status: 404, body: '{}' };
    const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    const res = { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => 'application/json' }, text: async () => body, json: async () => JSON.parse(body) };
    res.clone = () => res;
    return res;
  };
  win.top = top ? win : {};
  win.crypto = { randomUUID: () => 'jeton-' + Math.random().toString(16).slice(2, 14) };
  const ls = {};
  const commun = () => ({
    window: win, self: win, location: { origin: 'https://' + hote, hostname: hote, href: 'https://' + hote + '/', pathname: '/' },
    // Un document sans `__NEXT_DATA__`, déjà chargé : le capteur est déjà dans la
    // page (`currentScript` présent), il ne se réinjecte pas.
    document: { currentScript: {}, readyState: 'complete', getElementById: () => null, addEventListener() {}, createElement: () => ({}), head: { appendChild() {} } },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    URL, FormData: class {}, TextEncoder, console: silence, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    Headers: class { constructor(o) { this.o = o || {}; } entries() { return Object.entries(this.o); } },
  });
  const ctxI = commun(); vm.createContext(ctxI); vm.runInContext(INJ, ctxI, { filename: 'lbc-inject.js' });
  const chromeR = { runtime: { id: 'ext', lastError: null,
    sendMessage: (m, cb) => { envoyes.push(JSON.parse(JSON.stringify(m))); Promise.resolve(fond ? fond(m) : { ok: true }).then((r) => { if (typeof cb === 'function') cb(r); }); },
    onMessage: { addListener: (f) => onMsg.push(f) } } };
  const ctxR = Object.assign(commun(), { chrome: chromeR, crypto: win.crypto }); vm.createContext(ctxR); vm.runInContext(REL, ctxR, { filename: 'lbc-relay.js' });
  // Le fond envoie un ordre à CET onglet (chrome.tabs.sendMessage).
  const ordre = (msg, sender = { id: 'ext' }) => new Promise((res) => {
    let garde = false;
    for (const f of onMsg) { try { if (f(msg, sender, (r) => res(r)) === true) garde = true; } catch (_) {} }
    if (!garde) setTimeout(() => res(undefined), 40);
  });
  const charge = async (url, init) => { await win.fetch(url, init); await attendre(25); };
  return { win, posts, appels, envoyes, ordre, charge };
}

// ── Le fond (background.js), à état, base qui répond en quelques ms ─────────
function fond(seed, local0, opts = {}) {
  const base = JSON.parse(JSON.stringify(seed || {}));
  const local = JSON.parse(JSON.stringify(local0 || {}));
  const pannes = new Set(opts.pannes || []);
  const ecouteurs = [], ecrits = [], tabs = Object.assign({}, opts.tabs || {}), crees = [], fermes = [], messagesOnglet = [];
  let prochainTab = 100;
  const dual = (fn) => function (...a) { const cb = a[a.length - 1]; const v = fn(...(typeof cb === 'function' ? a.slice(0, -1) : a)); if (typeof cb === 'function') { Promise.resolve(v).then(cb); return; } return Promise.resolve(v); };
  const ctx = {
    console: silence, setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(f) { ecouteurs.push(f); } }, onMessageExternal: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, clear() {}, get: dual(() => null), onAlarm: { addListener() {} } },
      cookies: { get: dual(() => null), getAll: dual(() => []), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: {
        onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, query: dual(() => []),
        get: dual((id) => { if (!tabs[id]) throw new Error('No tab'); return tabs[id]; }),
        create: dual((o) => { const id = prochainTab++; tabs[id] = { id, url: o.url }; crees.push(id); if (opts.surCreation) opts.surCreation(id, local); return tabs[id]; }),
        remove: dual((id) => { fermes.push(id); delete tabs[id]; }),
        sendMessage: dual((id, msg, o) => { messagesOnglet.push({ id, msg: JSON.parse(JSON.stringify(msg)), frameId: o && o.frameId }); return opts.onglet ? opts.onglet(id, msg) : undefined; }),
      },
      storage: { local: {
        get: dual((k) => { const ks = k == null ? Object.keys(local) : Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k); const o = {}; for (const x of ks) if (x in local) o[x] = JSON.parse(JSON.stringify(local[x])); return o; }),
        set: dual((o) => { for (const k in o) local[k] = JSON.parse(JSON.stringify(o[k])); }),
        remove: dual((k) => { for (const x of (Array.isArray(k) ? k : [k])) delete local[x]; }),
      }, onChanged: { addListener() {} } },
    },
    fetch: async (url, o = {}) => {
      await attendre(2 + Math.floor(Math.random() * 3));
      const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      const m = (o.method || 'GET').toUpperCase();
      const u = decodeURIComponent(String(url));
      const mm = /id=eq\.([^&]+)/.exec(u);
      const id = mm && mm[1];
      if (m === 'POST') {
        try { JSON.parse(o.body || '[]').forEach((r) => { if (pannes.has('ecriture:' + r.id)) throw 0; base[r.id] = JSON.parse(JSON.stringify(r.data)); ecrits.push(r.id); }); } catch (_) { return rep(false, '', 522); }
        return rep(true, '', 201);
      }
      if (m !== 'GET') return rep(true, '[]');
      if (id && pannes.has(id)) return rep(false, '<html>522</html>', 522);
      if (id && base[id] !== undefined) {
        const sel = /select=([^&]+)/.exec(u); const s = sel ? sel[1] : 'data';
        if (s === 'data') return rep(true, JSON.stringify([{ id, data: base[id] }]));
        const row = {};
        for (const part of s.split(',')) { const [alias, chemin] = part.includes(':') ? part.split(':') : [part, part]; const ks = chemin.split('->').map((x) => x.replace(/^>/, '')); let v = { data: base[id] }; for (const k of ks) v = v == null ? v : v[k]; row[alias] = v === undefined ? null : v; }
        return rep(true, JSON.stringify([row]));
      }
      return rep(true, '[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(SRC, ctx, { filename: 'background.js' });
  ctx.authToken = async () => ({ access_token: 'jeton_banc', user_id: 'vendeur_banc', expires_at: Date.now() + 3600e3 }); ctx.loadSession = ctx.authToken;
  const envoyer = (msg, sender) => new Promise((res) => {
    let fini = false; const r = (v) => { if (!fini) { fini = true; res(v); } };
    let async_ = false;
    for (const f of ecouteurs) { try { const ret = f(Object.assign({ from: 'cancale-lbc' }, msg), sender || { tab: { id: 1, url: 'https://www.leboncoin.fr/profil/x' }, frameId: 0 }, r); if (ret === true) async_ = true; } catch (_) {} }
    setTimeout(() => r(undefined), async_ ? 6000 : 50);
  });
  return { ctx, base, local, envoyer, ecrits, tabs, crees, fermes, messagesOnglet };
}

const annonce = (id, owner, extra) => Object.assign({ list_id: id, subject: 'Paire ' + id, price: [50], owner: { user_id: owner, name: 'x' }, status: 'active' }, extra || {});
const TABLEAU = `${API}/dashboard/v1/search`;
const URL_SUPPR = `${API}/pintad/v1/public/manual/delete/ads`;
const corpsT = (extra) => JSON.stringify(Object.assign({ context: 'default', filters: { owner: { user_id: MON } }, limit: 30, offset: 0, sort_by: 'date', sort_order: 'desc', include_inactive: true, include_draft: false }, extra || {}));
const repT = (ads, total) => ({ status: 200, body: { account_stats: { all_ads: total, active_ads: total, inactive_ads: 0 }, total, total_private: total, total_pro: 0, pivot: '', ads } });
const listes = (p) => p.envoyes.filter((m) => m.action === 'lbcListeComplete');
const retraits = (p) => p.envoyes.filter((m) => m.action === 'lbcRetraitVu');

(async () => {
  console.log('── 1. « MES ANNONCES » (dashboard/v1/search) : une liste complète décide');
  await essaie('tableau complet', async () => {
    const p = page({ reseau: (u) => (u === TABLEAU ? repT([annonce(3290000101, MON), annonce(3290000102, MON)], 2) : null) });
    await p.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(60);
    const l = listes(p);
    dit(l.length === 1 && l[0].owner === MON && l[0].total === 2 && JSON.stringify(l[0].ids.slice().sort()) === JSON.stringify(['3290000101', '3290000102']), 'sa page « Mes annonces » lue en entier (total atteint) ⇒ la liste complète part au fond', JSON.stringify(l.map((x) => [x.total, x.ids])));
  });
  await essaie('tableau en deux pages', async () => {
    let n = 0;
    const p = page({ reseau: () => (++n === 1 ? repT([annonce(301, MON), annonce(302, MON)], 3) : repT([annonce(303, MON)], 3)) });
    await p.charge(TABLEAU, { method: 'POST', body: corpsT({ limit: 2, offset: 0 }) });
    await attendre(30);
    dit(listes(p).length === 0, 'la première page seule (2 sur 3) ne décide rien (§4.2)', `${listes(p).length} envoi(s)`);
    await p.charge(TABLEAU, { method: 'POST', body: corpsT({ limit: 2, offset: 2 }) });
    await attendre(60);
    const l = listes(p);
    dit(l.length === 1 && l[0].ids.length === 3, 'toutes les pages au même total ⇒ complète', JSON.stringify(l.map((x) => x.ids)));
  });
  await essaie('tableau filtré', async () => {
    const p = page({ reseau: () => repT([annonce(301, MON)], 1) });
    await p.charge(TABLEAU, { method: 'POST', body: JSON.stringify({ context: 'default', filters: { owner: { user_id: MON }, keywords: { text: 'nike' } }, limit: 30, offset: 0 }) });
    await attendre(60);
    dit(listes(p).length === 0, 'une recherche DANS ses annonces (filtre en plus) ne décide rien', `${listes(p).length} envoi(s)`);
  });
  await essaie('tableau avec une annonce d’autrui', async () => {
    const p = page({ reseau: () => repT([annonce(301, MON), annonce(901, AUTRE)], 2) });
    await p.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(60);
    dit(listes(p).length === 0, 'une réponse qui porte l’annonce d’un AUTRE vendeur ne décide rien', `${listes(p).length} envoi(s)`);
  });
  await essaie('tableau vide', async () => {
    const p = page({ reseau: () => repT([], 0) });
    await p.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(60);
    dit(listes(p).length === 0, 'une réponse VIDE (total 0) ne décide rien', `${listes(p).length} envoi(s)`);
  });

  console.log('\n── 2. UNE SUPPRESSION FAITE SUR LA PAGE EST VUE (réponse 2xx seulement)');
  await essaie('suppression 200', async () => {
    const p = page({ reseau: (u) => (u === URL_SUPPR ? { status: 200, body: {} } : null) });
    await p.charge(URL_SUPPR, { method: 'DELETE', body: JSON.stringify({ list_ids: [3290000104] }) });
    await attendre(60);
    const r = retraits(p);
    dit(r.length === 1 && r[0].quoi === 'supprime' && JSON.stringify(r[0].ids) === JSON.stringify(['3290000104']) && r[0].statut === 200, 'le bouton « Supprimer » de Leboncoin (200) ⇒ le fond est prévenu, identifiant seulement', JSON.stringify(r));
  });
  await essaie('suppression refusée', async () => {
    const p = page({ reseau: (u) => (u === URL_SUPPR ? { status: 403, body: {} } : null) });
    await p.charge(URL_SUPPR, { method: 'DELETE', body: JSON.stringify({ list_ids: [3290000104] }) });
    await attendre(60);
    dit(retraits(p).length === 0, 'Leboncoin refuse (403) ⇒ rien n’est dit au fond (l’annonce est toujours en ligne)', `${retraits(p).length} envoi(s)`);
  });
  await essaie('pause 200', async () => {
    const URLP = `${API}/pintad/v1/public/manual/pause/ads`;
    const p = page({ reseau: (u) => (u === URLP ? { status: 200, body: {} } : null) });
    await p.charge(URLP, { method: 'PUT', body: JSON.stringify({ list_ids: [3290000101] }) });
    await attendre(60);
    const r = retraits(p);
    dit(r.length === 1 && r[0].quoi === 'pause', 'une mise en pause faite sur la page (200) est vue aussi', JSON.stringify(r));
  });

  console.log('\n── 3. LE FOND : SES annonces seulement, et jamais sur une lecture ratée');
  const comptes = { accounts: { ['lbc-account:' + MON]: { id: 'lbc-account:' + MON, name: 'Totomondu', sessionAt: '2026-10-29T09:32:00.000Z', preuveCompte: 'membre-prive-v1' }, [MON]: { id: MON, sessionAt: '2026-10-29T09:32:00.000Z', source: 'session:messagerie' } } };
  const items0 = () => ({
    '3290000101': { id: '3290000101', subject: 'Jordan 4 gris', ref: '2', account: MON, status: 'active', seenAt: new Date().toISOString() },
    '3290000104': { id: '3290000104', subject: 'Shox TL', ref: '18', account: MON, status: 'active', seenAt: '2026-10-27T09:00:00.000Z' },
    '3290000103': { id: '3290000103', subject: 'Gazelle bleue', account: MON, status: 'active', seenAt: '2026-09-21T10:00:00.000Z' },
    '90100001': { id: '90100001', subject: 'Chalet', account: AUTRE, status: 'active', seenAt: '2026-09-21T10:00:00.000Z' },
  });
  await essaie('suppression rangée', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const r = await f.envoyer({ action: 'lbcRetraitVu', quoi: 'supprime', ids: ['3290000104', '90100001'], statut: 200 });
    await attendre(40);
    const it = (f.base.lbc_listings || {}).items || {};
    dit(r && r.ok === true, 'le fond accepte', JSON.stringify(r));
    dit(it['3290000104'] && it['3290000104'].status === 'deleted' && !!it['3290000104'].supprimeeAt && it['3290000104'].statutLbc === 'active', 'son annonce supprimée sur Leboncoin ⇒ `deleted`, l’heure notée, l’état d’avant gardé', JSON.stringify(it['3290000104']));
    dit(it['90100001'] && it['90100001'].status === 'active' && !it['90100001'].supprimeeAt, 'l’annonce d’un autre vendeur n’est jamais touchée', JSON.stringify(it['90100001']));
    dit(!!it['3290000104'] && it['3290000104'].subject === 'Shox TL', 'rien n’est effacé : l’annonce reste en base');
  });
  await essaie('suppression : lecture ratée', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes }, {}, { pannes: ['lbc_listings'] });
    await f.envoyer({ action: 'lbcRetraitVu', quoi: 'supprime', ids: ['3290000104'], statut: 200 });
    await attendre(40);
    dit(!f.ecrits.includes('lbc_listings'), 'lecture de lbc_listings KO (522) ⇒ RIEN n’est écrit', JSON.stringify(f.ecrits));
  });
  await essaie('suppression : message hors Leboncoin', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    await f.envoyer({ action: 'lbcRetraitVu', quoi: 'supprime', ids: ['3290000104'], statut: 200 }, { tab: { id: 1, url: 'https://www.exemple.fr/' }, frameId: 0 });
    await f.envoyer({ action: 'lbcRetraitVu', quoi: 'supprime', ids: ['3290000104'], statut: 404 });
    await attendre(40);
    dit(!f.ecrits.includes('lbc_listings'), 'autre site, ou réponse non 2xx ⇒ rien', JSON.stringify(f.ecrits));
  });
  await essaie('bout en bout tableau', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const p = page({ reseau: () => repT([annonce(3290000101, MON)], 1),
      fond: (m) => (m.action === 'lbcListeComplete' || m.action === 'lbcRetraitVu' ? f.envoyer(m).then((r) => r || { ok: true }) : { ok: true }) });
    await p.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(250);
    const it = (f.base.lbc_listings || {}).items || {};
    dit(!!(it['3290000103'] && it['3290000103'].plusVueAt) && !!(it['3290000104'] && it['3290000104'].plusVueAt) && !it['3290000101'].plusVueAt, 'sa page « Mes annonces » sort les annonces qu’elle ne montre plus, et elles seules', JSON.stringify(Object.fromEntries(Object.entries(it).map(([k, v]) => [k, !!v.plusVueAt]))));
    dit(it['3290000103'] && it['3290000103'].status === 'active', '« plus vue » n’est pas « vendue » : le statut n’est pas réécrit');
  });

  console.log('\n── 3 bis. CE QUE LEBONCOIN DIT DE CHAQUE ANNONCE (des nombres, jamais qui)');
  const pageFond = (f, reseau) => page({ reseau, fond: (m) => f.envoyer(m).then((r) => r || { ok: true }) });
  await essaie('compteurs et dates', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const a = annonce(3290000101, MON, { counters: { favorites: 3, libelle: 'x', vu: true }, first_publication_date: '2026-10-17 18:36:52', index_date: '2026-10-27 09:21:23' });
    const p1 = pageFond(f, () => repT([a], 1));
    await p1.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(250);
    const it = ((f.base.lbc_listings || {}).items || {})['3290000101'] || {};
    dit(it.compteurs && it.compteurs.favorites === 3 && !('libelle' in it.compteurs) && !('vu' in it.compteurs), 'les compteurs de « Mes annonces » sont gardés tels que Leboncoin les nomme, nombres seulement', JSON.stringify(it.compteurs));
    dit(it.publieeLe === '2026-10-17 18:36:52' && it.indexeeLe === '2026-10-27 09:21:23', 'la date de mise en ligne vient de Leboncoin (jamais l’heure de capture)', JSON.stringify([it.publieeLe, it.indexeeLe]));
    const p2 = pageFond(f, () => repT([annonce(3290000101, MON, { counters: {} })], 1));
    await p2.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(250);
    const it2 = ((f.base.lbc_listings || {}).items || {})['3290000101'] || {};
    dit(it2.compteurs && it2.compteurs.favorites === 3, 'une lecture sans compteur n’efface pas le dernier chiffre connu', JSON.stringify(it2.compteurs));
  });
  const STATS = `${API}/stats/proxy/v2/classified/history/daily`;
  const jours = [{ Date: '2026-10-27T00:00:00Z', Favorites: 1, TotalFavorites: 4, Views: 10, Messages: 0, TotalMessages: 2 }, { Date: '2026-10-28T00:00:00Z', Favorites: 2, TotalFavorites: 6, Views: 15, Messages: 1, TotalMessages: 3 }];
  await essaie('statistiques d’une annonce', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const p = pageFond(f, (u) => (u.startsWith(STATS) ? { status: 200, body: jours } : null));
    await p.charge(STATS + '?id=3290000101&period=7', {});
    await attendre(250);
    const st = (((f.base.lbc_listings || {}).items || {})['3290000101'] || {}).stats || null;
    dit(!!st && st.favoris === 6 && st.messages === 3 && st.vues === 25 && st.au === '2026-10-28', 'la page « Statistiques » d’une de SES annonces : favoris et messages du dernier jour, vues de la période', JSON.stringify(st));
  });
  await essaie('statistiques ambiguës', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const p = pageFond(f, (u) => (u.startsWith(STATS) ? { status: 200, body: jours } : null));
    await p.charge(STATS + '?id=3290000101&autre=3290000104', {});
    await p.charge(STATS + '?id=90100001', {});
    await attendre(250);
    const it = (f.base.lbc_listings || {}).items || {};
    dit(!(it['3290000101'] || {}).stats && !(it['90100001'] || {}).stats, 'deux identifiants dans l’adresse, ou l’annonce d’un autre vendeur ⇒ rien n’est attribué', JSON.stringify([!!(it['3290000101'] || {}).stats, !!(it['90100001'] || {}).stats]));
  });
  await essaie('suppression sans retour', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    await f.envoyer({ action: 'lbcRetraitVu', quoi: 'supprime', ids: ['3290000104'], statut: 200 });
    await attendre(40);
    const p = pageFond(f, () => repT([annonce(3290000104, MON)], 1));
    await p.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(250);
    const it = ((f.base.lbc_listings || {}).items || {})['3290000104'] || {};
    dit(it.status === 'deleted' && !!it.supprimeeAt, 'une suppression acceptée par Leboncoin est sans retour : une lecture en retard qui la montre « active » ne la remet pas en vente', JSON.stringify({ status: it.status, supprimeeAt: !!it.supprimeeAt }));
  });

  // (29 oct., revue) LA MARQUE « SUPPRIMÉE » EST BORNÉE COMME LA PAUSE : elle peut
  // venir d'un message de la page (forgeable), et la réponse de Leboncoin n'est
  // jamais relue. Plus d'une heure après, ce qui montre l'annonce vivante gagne.
  const ilYaH = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  await essaie('suppression ancienne, capture qui la montre active', async () => {
    const items = items0(); items['3290000104'] = Object.assign({}, items['3290000104'], { status: 'deleted', statutLbc: 'active', supprimeeAt: ilYaH(2), supprimeeStatut: 200 });
    const f = fond({ lbc_listings: { items }, lbc_accounts: comptes });
    // Une page PARTIELLE (1 annonce sur 3) : elle ne décide rien de la liste, mais montre l'annonce active.
    const p = pageFond(f, () => repT([annonce(3290000104, MON)], 3));
    await p.charge(TABLEAU, { method: 'POST', body: corpsT() });
    await attendre(250);
    const it = ((f.base.lbc_listings || {}).items || {})['3290000104'] || {};
    dit(it.status === 'active' && !it.supprimeeAt, 'une suppression marquée il y a plus d’une heure : une capture qui la montre active la remet en vente', JSON.stringify({ status: it.status, supprimeeAt: !!it.supprimeeAt }));
  });
  await essaie('suppression ancienne, liste complète qui la porte', async () => {
    const items = items0(); items['3290000104'] = Object.assign({}, items['3290000104'], { status: 'deleted', statutLbc: 'active', supprimeeAt: ilYaH(2), supprimeeStatut: 200 });
    const f = fond({ lbc_listings: { items }, lbc_accounts: comptes });
    await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['3290000101', '3290000104'], total: 2 });
    await attendre(80);
    const it = ((f.base.lbc_listings || {}).items || {})['3290000104'] || {};
    dit(it.status === 'active' && !it.supprimeeAt, '… et une liste « Mes annonces » COMPLÈTE plus récente qui la porte aussi', JSON.stringify({ status: it.status, supprimeeAt: !!it.supprimeeAt }));
  });
  await essaie('suppression forgée par la page', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const p = pageFond(f, () => null);
    // Un script du site poste le message sans AUCUNE requête DELETE.
    p.win.postMessage({ __tag: 'CANCALE_LBC', kind: 'lbcretraitvu', quoi: 'supprime', ids: ['3290000104'], statut: 200 });
    await attendre(200);
    const avant = ((f.base.lbc_listings || {}).items || {})['3290000104'] || {};
    if (avant.supprimeeAt) avant.supprimeeAt = ilYaH(2);   // l'index de Leboncoin a eu le temps
    await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['3290000101', '3290000104'], total: 2 });
    await attendre(80);
    const it = ((f.base.lbc_listings || {}).items || {})['3290000104'] || {};
    dit(it.status === 'active' && !it.supprimeeAt, 'une marque posée par un message de la page (sans requête) n’est pas définitive', JSON.stringify({ forgee: !!avant.supprimeeAt, status: it.status }));
  });

  console.log('\n── 4. LA RÈGLE PARTAGÉE (app) : supprimée ou plus vue ⇒ plus « en vente »');
  await essaie('règle de l’app', async () => {
    const d = APP.indexOf('// <lbc-en-vente-regle>'), fin = APP.indexOf('// </lbc-en-vente-regle>');
    const ctx = {}; vm.createContext(ctx); vm.runInContext(APP.slice(d, fin) + '\nthis.annonceLbcEnVente = annonceLbcEnVente;', ctx);
    const env = ctx.annonceLbcEnVente;
    dit(env({ id: '1', status: 'active' }, new Set()) === true, 'une annonce active, sans marque ⇒ en vente');
    dit(env({ id: '1', status: 'deleted', supprimeeAt: new Date().toISOString() }, new Set()) === false, 'supprimée sur Leboncoin ⇒ plus en vente');
    dit(env({ id: '1', status: 'active', plusVueAt: new Date().toISOString(), seenAt: '2026-09-20T00:00:00.000Z' }, new Set()) === false, 'absente d’une lecture complète plus récente ⇒ plus en vente');
  });

  await essaie('écran Mes annonces', async () => {
    const d = APP.indexOf('// <lbc-en-vente-regle>'), fin = APP.indexOf('// </lbc-en-vente-regle>');
    const ctx = {}; vm.createContext(ctx);
    vm.runInContext(APP.slice(d, fin) + '\nthis.lbcSortieDe = lbcSortieDe;\n' + fs.readFileSync(F.etat, 'utf8').replace(/^export /gm, '') + '\nthis.etat = etatAnnonceLeboncoin;', ctx);
    const e1 = ctx.etat({ id: '1', status: 'active', plusVueAt: new Date().toISOString(), seenAt: '2026-09-20T00:00:00.000Z' }, [], ctx.lbcSortieDe);
    dit(e1.etat !== 'active', 'l’écran « Mes annonces » ne dit plus « Active » pour une annonce que sa page ne montre plus', JSON.stringify(e1));
    const e2 = ctx.etat({ id: '1', status: 'deleted', supprimeeAt: new Date().toISOString() }, [], ctx.lbcSortieDe);
    dit(e2.etat === 'retiree' && /Supprim/.test(e2.label), 'supprimée sur Leboncoin ⇒ « Supprimée sur Leboncoin »', JSON.stringify(e2));
    const e3 = ctx.etat({ id: '1', status: 'active', plusVueAt: '2026-10-01T00:00:00.000Z', seenAt: new Date().toISOString() }, [], ctx.lbcSortieDe);
    dit(e3.etat === 'active', 'revue APRÈS la lecture complète ⇒ de nouveau « Active » (la donnée la plus récente gagne)', JSON.stringify(e3));
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
