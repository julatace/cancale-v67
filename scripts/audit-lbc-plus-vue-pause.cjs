// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN — « PLUS VUE SUR LEBONCOIN » ET « METTRE EN PAUSE » (22 octobre)
//   node scripts/audit-lbc-plus-vue-pause.cjs [--src background.js] [--inject lbc-inject.js]
//        [--relay lbc-relay.js] [--app App.jsx] [--serveur double-vente.js]
//   node scripts/audit-lbc-plus-vue-pause.cjs --prouve   (réaffaiblit chaque règle : chacune doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré (lecture seule, sa base, 22 octobre) :
//   · 11 annonces Leboncoin à son nom, toutes `status: 'active'` ; 4 revues le
//     22/10, 7 jamais revues depuis le 20/09 (3 vendues, 4 très probablement
//     supprimées par lui le 10/10). Rien ne marquait une ABSENCE.
//   · sa page profil charge `POST adfinder/v2/owner_listing` (corps : limit,
//     offset, sort_by, sort_order, filters.owner.user_id, filters.enums.ad_type),
//     réponse { total, total_active, max_pages, referrer_id, ads[].list_id,
//     ads[].owner.user_id } ; la v1 (« autres annonces du vendeur ») exclut
//     l'annonce affichée (`displayed_id`) : elle ne peut pas décider.
//   · la mise en pause a été VUE dans ses gestes (`lbc_recon.envois`, 23/09) :
//     `PUT api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads`, corps
//     `{list_ids:[number]}`. Ni sa réponse ni ses en-têtes n'ont été vus.
// Le VRAI lbc-inject.js (monde MAIN), le VRAI lbc-relay.js (monde isolé) et le
// VRAI background.js sont exécutés (vm), avec des identifiants INVENTÉS.
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
};

// ── --prouve : chaque règle réaffaiblie seule doit faire rougir l'audit ──────
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['partielle', 'inject', 'if (rep.total > 0 && l.ids.size === rep.total && !l.envoye)', 'if (rep.total > 0 && l.ids.size > 0 && !l.envoye)'],
    ['autrui', 'inject', "if (String((a.owner && a.owner.user_id) || '') !== owner) return null;", ''],
    ['filtres', 'inject', "for (const k of Object.keys(f)) if (k !== 'owner' && k !== 'enums') return null;", ''],
    // « rien lu » lu comme « rien » : la forme `|| {}` qui effaçait (audit-fusion).
    ['lecture', 'src', "if (rows === null) { noterDiag('lbc_liste_complete_lecture_ratee'); return { ok: false, code: 'lecture' }; }\n      const data = (rows[0] && rows[0].data) || {};", 'const data = (rows && rows[0] && rows[0].data) || {};'],
    ['proprio', 'src', "if (!miens.has(owner) && !miens.has('lbc-account:' + owner)) { noterDiag('lbc_liste_complete_autrui'); sendResponse({ ok: true }); return; }", ''],
    // Le compte écrit `lbc-account:{id}` (la source privée de main, 22 oct.) n'est plus reconnu.
    ['prefixe', 'src', "const idCompteLbc = (x) => String(x || '').replace(/^lbc-account:/i, '');", "const idCompteLbc = (x) => String(x || '');"],
    ['compte', 'src', 'if (c.compte === voulu) return { ok: true, tabId: Number(tid) };', 'return { ok: true, tabId: Number(tid) };'],
    ['suppression', 'inject', "const URL_PAUSE_LBC = 'https://api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads';", "const URL_PAUSE_LBC = 'https://api.leboncoin.fr/api/pintad/v1/public/manual/delete/ads';"],
    ['uneALaFois', 'src', "if (PAUSE_LBC_EN_VOL) return { accepte: false, code: 'en-cours', raison: 'une autre mise en pause est en cours — une à la fois' };", ''],
    ['refusFait', 'src', 'if (statut >= 200 && statut < 300) {', 'if (statut) {'],
    ['regleApp', 'app', "!ad.plusVueAt && !ad.pauseAt && !(vendues", '!(vendues'],
    ['ordreDePage', 'relay', "if(!sender||sender.id!==chrome.runtime.id||window.top!==window)return;", 'if(window.top!==window)return;'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-pause-prouve-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable (la règle a changé de forme ?)`); tous = false; continue; }
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
const corpsV2 = (extra) => JSON.stringify(Object.assign({ limit: 35, offset: 0, sort_by: 'time', sort_order: 'desc', filters: { owner: { user_id: MON }, enums: { ad_type: ['offer'] } } }, extra || {}));
const listes = (p) => p.envoyes.filter((m) => m.action === 'lbcListeComplete');

(async () => {
  console.log('── 1. UNE LISTE NE DÉCIDE QUE SI ELLE EST PROUVÉE COMPLÈTE (page → relais)');
  await essaie('liste complète en une page', async () => {
    const p = page({ reseau: (u) => (u === OWNER_V2 ? { status: 200, body: { total: 3, total_active: 3, max_pages: 1, referrer_id: '', ads: [annonce(301, MON), annonce(302, MON), annonce(303, MON)] } } : null) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2() });
    await attendre(60);
    const l = listes(p);
    dit(l.length === 1 && l[0].owner === MON && l[0].total === 3 && JSON.stringify(l[0].ids.slice().sort()) === JSON.stringify(['301', '302', '303']), 'toutes ses annonces, total atteint ⇒ la liste complète part au fond (identifiants + total seulement)', JSON.stringify(l.map((x) => [x.total, x.ids])));
    const raw = p.envoyes.findIndex((m) => m.action === 'lbcRaw'), comp = p.envoyes.findIndex((m) => m.action === 'lbcListeComplete');
    dit(raw >= 0 && comp > raw, 'elle part APRÈS les annonces elles-mêmes (même file)', `lbcRaw=${raw} · liste=${comp}`);
  });
  await essaie('liste partielle', async () => {
    const p = page({ reseau: () => ({ status: 200, body: { total: 5, ads: [annonce(301, MON), annonce(302, MON), annonce(303, MON)] } }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2({ limit: 3 }) });
    await attendre(60);
    dit(listes(p).length === 0, 'une page sur deux (3 annonces sur 5) ne décide RIEN', `${listes(p).length} envoi(s)`);
  });
  await essaie('deux pages', async () => {
    let n = 0;
    const p = page({ reseau: () => (++n === 1 ? { status: 200, body: { total: 5, ads: [annonce(301, MON), annonce(302, MON), annonce(303, MON)] } } : { status: 200, body: { total: 5, ads: [annonce(304, MON), annonce(305, MON)] } }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2({ limit: 3, offset: 0 }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2({ limit: 3, offset: 3 }) });
    await attendre(60);
    const l = listes(p);
    dit(l.length === 1 && l[0].ids.length === 5, 'toutes les pages lues au même total ⇒ complète', JSON.stringify(l.map((x) => x.ids)));
  });
  await essaie('liste qui bouge entre deux pages', async () => {
    let n = 0;
    const p = page({ reseau: () => (++n === 1 ? { status: 200, body: { total: 5, ads: [annonce(301, MON), annonce(302, MON), annonce(303, MON)] } } : { status: 200, body: { total: 4, ads: [annonce(305, MON)] } }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2({ limit: 3, offset: 0 }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2({ limit: 3, offset: 3 }) });
    await attendre(60);
    dit(listes(p).length === 0, 'le total change entre deux pages (une suppression pendant la lecture) ⇒ rien ne décide', `${listes(p).length} envoi(s)`);
  });
  await essaie('filtre en plus', async () => {
    const p = page({ reseau: () => ({ status: 200, body: { total: 1, ads: [annonce(301, MON)] } }) });
    await p.charge(OWNER_V2, { method: 'POST', body: JSON.stringify({ limit: 35, offset: 0, filters: { owner: { user_id: MON }, keywords: { text: 'nike' } } }) });
    await attendre(60);
    dit(listes(p).length === 0, 'une recherche DANS ses annonces (mot-clé) ne décide rien — son total est un sous-ensemble', `${listes(p).length} envoi(s)`);
  });
  await essaie('v1 autres annonces', async () => {
    const V1 = `${API}/adfinder/v1/owner_listing`;
    const p = page({ reseau: () => ({ status: 200, body: { total: 3, referrer_id: '3290000001', ads: [annonce(302, MON), annonce(303, MON), annonce(304, MON)] } }) });
    await p.charge(V1, { method: 'POST', body: JSON.stringify({ owner_user_id: MON, displayed_id: 3290000001, limit: 10, category_id: 53 }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2() });   // même réponse, avec referrer_id : rien non plus
    await attendre(60);
    dit(listes(p).length === 0, '« autres annonces du vendeur » (une annonce mise à part) ne décide jamais', `${listes(p).length} envoi(s)`);
  });
  await essaie('annonce d’un autre', async () => {
    const p = page({ reseau: () => ({ status: 200, body: { total: 2, ads: [annonce(301, MON), annonce(901, AUTRE)] } }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2() });
    await attendre(60);
    dit(listes(p).length === 0, 'une réponse qui contient l’annonce d’un AUTRE vendeur n’est pas SA liste', `${listes(p).length} envoi(s)`);
  });
  await essaie('total nul', async () => {
    const p = page({ reseau: () => ({ status: 200, body: { total: 0, ads: [] } }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2() });
    await attendre(60);
    dit(listes(p).length === 0, 'une réponse VIDE (total 0) ne décide rien — un hoquet ne fait pas « disparaître » ses annonces', `${listes(p).length} envoi(s)`);
  });

  console.log('\n── 2. LE FOND : « PLUS VUE » SUR SES ANNONCES, RIEN D’AUTRE');
  const items0 = () => ({
    '301': { id: '301', subject: 'A', account: MON, status: 'active', seenAt: '2026-10-22T10:00:00.000Z' },
    '302': { id: '302', subject: 'B (supprimée)', account: MON, status: 'active', seenAt: '2026-09-20T16:00:00.000Z' },
    '303': { id: '303', subject: 'C (revenue)', account: MON, status: 'active', plusVueAt: '2026-10-01T10:00:00.000Z' },
    '304': { id: '304', subject: 'D (pause ancienne, revue)', account: MON, status: 'active', pauseAt: new Date(Date.now() - 2 * 3600e3).toISOString(), pauseStatut: 200 },
    '305': { id: '305', subject: 'E (pause récente, encore listée)', account: MON, status: 'active', pauseAt: new Date(Date.now() - 10 * 60e3).toISOString(), pauseStatut: 200 },
    '306': { id: '306', subject: 'F (capturée par la source privée, absente)', account: 'lbc-account:' + MON, status: 'active', seenAt: '2026-10-22T14:00:00.000Z' },
    '901': { id: '901', subject: 'Chalet', account: AUTRE, status: 'active' },
  });
  const comptes = { accounts: { ['lbc-account:' + MON]: { id: 'lbc-account:' + MON, name: 'Totomondu', sessionAt: '2026-10-22T10:00:00.000Z', preuveCompte: 'membre-prive-v1' }, [MON]: { id: MON, sessionAt: '2026-10-22T10:00:00.000Z', source: 'session:messagerie' } } };
  await essaie('liste complète rangée', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const r = await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['301', '303', '304', '305'], total: 4 });
    await attendre(40);
    const it = (f.base.lbc_listings || {}).items || {};
    dit(r && r.ok === true, 'le fond accepte la liste', JSON.stringify(r));
    dit(!!(it['302'] && it['302'].plusVueAt), 'son annonce absente de la liste complète ⇒ « plus vue » (un état)', JSON.stringify(it['302']));
    dit(!!it['302'] && it['302'].subject === 'B (supprimée)' && it['302'].status === 'active', '… rien n’est effacé : l’annonce reste en base, son état Leboncoin n’est pas réécrit');
    dit(!it['301'].plusVueAt && !it['303'].plusVueAt, 'présente dans la liste ⇒ pas « plus vue » ; une « plus vue » revenue est rétablie', JSON.stringify([it['301'].plusVueAt, it['303'].plusVueAt]));
    dit(!it['304'].pauseAt && !!it['305'].pauseAt, 'une pause d’il y a 2 h encore listée est levée ; d’il y a 10 min, gardée (index en retard)', JSON.stringify([it['304'].pauseAt, it['305'].pauseAt]));
    dit(!it['901'].plusVueAt, 'l’annonce d’un autre vendeur n’est jamais touchée');
    dit(!!(it['306'] && it['306'].plusVueAt), 'une annonce rangée sous « lbc-account:{id} » (la source privée) est le MÊME compte : absente ⇒ « plus vue »', JSON.stringify(it['306']));
    const lec = ((f.base.lbc_listings || {}).lectures || {})[MON];
    dit(!!lec && lec.total === 4 && lec.n === 4, 'la lecture complète est datée, par compte', JSON.stringify(lec));
  });
  await essaie('liste d’un autre vendeur', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    await f.envoyer({ action: 'lbcListeComplete', owner: AUTRE, ids: ['999'], total: 1 });
    await attendre(40);
    dit(!f.ecrits.includes('lbc_listings'), 'la liste complète d’un AUTRE vendeur (sa page profil visitée) ne marque rien', JSON.stringify(f.ecrits));
  });
  await essaie('lecture ratée', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes }, {}, { pannes: ['lbc_listings'] });
    await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['301'], total: 1 });
    await attendre(40);
    dit(!f.ecrits.includes('lbc_listings'), 'lecture de lbc_listings KO (522) ⇒ RIEN n’est écrit (jamais une ligne refaite depuis du vide)', JSON.stringify(f.ecrits));
  });
  await essaie('message mal formé', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['301', '303'], total: 3 });
    await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['301'], total: 1 }, { tab: { id: 1, url: 'https://www.exemple.fr/' }, frameId: 0 });
    await f.envoyer({ action: 'lbcListeComplete', owner: MON, ids: ['301'], total: 1 }, { tab: { id: 1, url: 'https://www.leboncoin.fr/' }, frameId: 3 });
    await attendre(40);
    dit(!f.ecrits.includes('lbc_listings'), 'total ≠ nombre d’identifiants, autre site, cadre secondaire ⇒ rien', JSON.stringify(f.ecrits));
  });
  await essaie('bout en bout', async () => {
    const f = fond({ lbc_listings: { items: items0() }, lbc_accounts: comptes });
    const p = page({ reseau: () => ({ status: 200, body: { total: 4, ads: [annonce(301, MON), annonce(303, MON), annonce(304, MON), annonce(305, MON)] } }),
      fond: (m) => (m.action === 'lbcListeComplete' ? f.envoyer(m).then((r) => r || { ok: true }) : { ok: true }) });
    await p.charge(OWNER_V2, { method: 'POST', body: corpsV2() });
    await attendre(250);
    const it = (f.base.lbc_listings || {}).items || {};
    dit(!!(it['302'] && it['302'].plusVueAt) && !it['301'].plusVueAt, 'de la page au fond : la vraie réponse de sa page profil sort l’annonce absente, et elle seule');
  });

  console.log('\n── 3. LA RÈGLE « EN VENTE » : LA MÊME DANS L’APP, L’EXTENSION ET LE SERVEUR (§11)');
  const extraire = (src) => { const m = /\/\/ <lbc-en-vente-regle>[\s\S]*?\/\/ <\/lbc-en-vente-regle>/.exec(src); return m ? m[0] : null; };
  const rApp = extraire(APP), rExt = extraire(SRC), rSrv = extraire(SRV);
  dit(!!rApp && rApp === rExt && rExt === rSrv, 'texte pour texte, dans les trois', [rApp, rExt, rSrv].map((x) => (x ? x.length : 'absente')).join(' / '));
  for (const [nom, r] of [['app', rApp], ['extension', rExt], ['serveur', rSrv]]) {
    if (!r) continue;
    await essaie('règle ' + nom, async () => {
      const c = {}; vm.createContext(c); vm.runInContext(r + '\n;this.f=annonceLbcEnVente;', c);
      const ads = [{ id: '1', status: 'active' }, { id: '2', status: 'active', plusVueAt: '2026-10-22T10:00:00Z' }, { id: '3', status: 'active', pauseAt: '2026-10-22T10:00:00Z' }, { id: '4', status: 'paused' }];
      const en = ads.filter((a) => c.f(a, new Set())).map((a) => a.id);
      dit(JSON.stringify(en) === '["1"]', `${nom} : « plus vue », mise en pause par VRM ou en pause sur Leboncoin ⇒ plus « en vente »`, JSON.stringify(en));
    });
  }

  console.log('\n── 4. METTRE EN PAUSE : L’ORDRE DANS LA PAGE (relais → capteur)');
  const sitePause = (statut, corps) => (u, init) => (u === URL_PAUSE ? { status: statut, body: corps } : (u.indexOf(API) === 0 ? { status: 200, body: { ok: 1 } } : null));
  await essaie('ordre exécuté', async () => {
    const p = page({ reseau: sitePause(200, '{"ok":true}') });
    // Le site a appelé son API avec ses en-têtes : la pause les reprend tels quels.
    await p.charge(`${API}/pintad/v1/public/expired`, { method: 'GET', headers: { api_key: 'cle_du_site', 'Content-Type': 'text/plain', 'X-Vrm': 'non' } });
    const rep = await p.ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: '3290168823' });
    const a = p.appels.filter((x) => x.url.indexOf('/pintad/v1/public/manual/') > 0);
    dit(a.length === 1 && a[0].url === URL_PAUSE && a[0].methode === 'PUT', 'UNE requête, à l’adresse EXACTE vue dans ses gestes, en PUT', JSON.stringify(a.map((x) => x.methode + ' ' + x.url)));
    dit(a[0] && a[0].corps === '{"list_ids":[3290168823]}' && a[0].credentials === 'include', 'corps {list_ids:[n]} — une seule annonce — avec sa session (cookies)', a[0] && a[0].corps);
    dit(a[0] && a[0].entetes && a[0].entetes.api_key === 'cle_du_site' && !('X-Vrm' in a[0].entetes) && a[0].entetes['Content-Type'] === 'application/json', 'avec les en-têtes que le SITE met lui-même (jamais devinés)', a[0] && JSON.stringify(Object.keys(a[0].entetes)));
    dit(rep && rep.ok === true && rep.statut === 200 && rep.corps === '{"ok":true}' && Array.isArray(rep.cles), 'la réponse de Leboncoin revient TELLE QUELLE au fond (statut + corps + forme)', JSON.stringify(rep));
  });
  await essaie('refus de Leboncoin', async () => {
    const p = page({ reseau: sitePause(403, '{"error":"forbidden"}') });
    const rep = await p.ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: '3290168823' });
    dit(rep && rep.statut === 403 && /forbidden/.test(rep.corps), 'un refus revient avec son statut et son texte', JSON.stringify(rep));
  });
  await essaie('ordres refusés', async () => {
    const p = page({ reseau: sitePause(200, '{}') });
    const r1 = await p.ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: 'abc' });
    const r2 = await p.ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: '3290168823' }, { id: 'une-autre-extension' });
    p.win.postMessage({ __tag: 'CANCALE_LBC_ORDRE', kind: 'pause', id: '3290168823', jeton: 'abcdefgh-1', url: `${API}/pintad/v1/public/manual/delete/ads` });
    await attendre(60);
    const a = p.appels.filter((x) => x.url.indexOf('/manual/') > 0);
    dit(r1 && r1.ok === false && a.every((x) => x.url === URL_PAUSE), 'un identifiant illisible est refusé ; aucune autre adresse (suppression) ne passe, même demandée', JSON.stringify(a.map((x) => x.url)));
    dit(r2 === undefined, 'un ordre qui ne vient pas de CETTE extension est ignoré', JSON.stringify(r2));
    const q = page({ reseau: sitePause(200, '{}'), top: false });
    await q.ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: '3290168823' });
    const h = page({ reseau: sitePause(200, '{}'), hote: 'www.exemple.fr' });
    h.win.postMessage({ __tag: 'CANCALE_LBC_ORDRE', kind: 'pause', id: '3290168823', jeton: 'abcdefgh-2' });
    await attendre(60);
    dit(!q.appels.length && !h.appels.length, 'un cadre secondaire, une page hors leboncoin.fr : rien ne part', `${q.appels.length} · ${h.appels.length}`);
  });

  console.log('\n── 5. METTRE EN PAUSE : LE FOND (compte connecté, une à la fois, plafond, réponse)');
  const ID = '3290168823';
  const baseP = () => ({ lbc_listings: { items: { [ID]: { id: ID, subject: 'Nike shox TL noir', account: MON, status: 'active', ref: '18' } } }, lbc_accounts: comptes });
  const transport = (compte) => ({ vrmLbcTransport: { 1: { source: 'prive', compte: 'lbc-account:' + compte, at: Date.now() } } });
  const unOnglet = { 1: { id: 1, url: 'https://www.leboncoin.fr/compte/part/mes-annonces' } };
  const versPage = (p) => (id, msg) => p.ordre(msg);
  await essaie('pause acceptée', async () => {
    const p = page({ reseau: sitePause(200, '{"ok":true}') });
    const f = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: versPage(p) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    await attendre(40);
    dit(r && r.accepte === true && r.etape === 'fait' && r.statut === 200 && r.reponse === '{"ok":true}', 'Leboncoin répond 200 ⇒ « fait », avec la réponse telle quelle', JSON.stringify(r));
    dit(f.messagesOnglet.length === 1 && f.messagesOnglet[0].frameId === 0 && f.messagesOnglet[0].msg.id === ID && Object.keys(f.messagesOnglet[0].msg).sort().join() === 'action,from,id', 'un seul ordre, au cadre principal de l’onglet connecté, avec l’identifiant seul', JSON.stringify(f.messagesOnglet));
    const it = ((f.base.lbc_listings || {}).items || {})[ID] || {};
    dit(!!it.pauseAt && it.pauseStatut === 200 && it.status === 'active', 'l’annonce porte « mise en pause » (un état ; rien n’est effacé)', JSON.stringify(it));
    dit(((f.local.vrmLbcPauses || []).length) === 1, 'la pause compte dans le plafond horaire');
  });
  await essaie('compte écrit lbc-account:', async () => {
    const p = page({ reseau: sitePause(200, '{}') });
    const b = baseP(); b.lbc_listings.items[ID].account = 'lbc-account:' + MON;
    const f = fond(b, transport(MON), { tabs: unOnglet, onglet: versPage(p) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.etape === 'fait', 'une annonce dont le compte s’écrit « lbc-account:{id} » se met en pause sur ce compte (pas « autre compte »)', JSON.stringify(r));
  });
  await essaie('pause refusée', async () => {
    const p = page({ reseau: sitePause(403, '{"error":"forbidden"}') });
    const f = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: versPage(p) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    await attendre(40);
    const it = ((f.base.lbc_listings || {}).items || {})[ID] || {};
    dit(r && r.etape === 'refuse' && r.statut === 403 && /forbidden/.test(r.reponse) && !it.pauseAt, 'Leboncoin refuse (403) ⇒ « pas fait », sa réponse rendue, rien de noté', JSON.stringify(r));
  });
  await essaie('pas de réponse', async () => {
    const f = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: () => undefined });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    const it = ((f.base.lbc_listings || {}).items || {})[ID] || {};
    dit(r && r.etape === 'incertain' && !it.pauseAt, 'l’onglet ne répond pas ⇒ « je ne sais pas », jamais « fait » ni « pas fait »', JSON.stringify(r));
  });
  await essaie('autre compte', async () => {
    const f = fond(baseP(), transport(AUTRE), { tabs: unOnglet, onglet: () => ({ ok: true, statut: 200, corps: '{}' }) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.accepte === false && r.code === 'autre-compte' && f.messagesOnglet.length === 0, 'Leboncoin connecté sur un AUTRE compte ⇒ refusé, rien n’est envoyé, et le compte est nommé', JSON.stringify(r));
    dit(/Totomondu/.test((r && r.raison) || ''), 'la raison nomme le compte de l’annonce', r && r.raison);
  });
  await essaie('annonce inconnue, lecture ratée', async () => {
    const f = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: () => ({ ok: true, statut: 200, corps: '{}' }) });
    const r1 = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: '3111111111' });
    const g = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: () => ({ ok: true, statut: 200, corps: '{}' }), pannes: ['lbc_listings'] });
    const r2 = await g.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    const r3 = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: '18' });
    dit(r1 && r1.code === 'inconnue' && r2 && r2.code === 'lecture' && r3 && r3.code === 'invalide' && !f.messagesOnglet.length && !g.messagesOnglet.length, 'annonce absente de SES annonces, base muette, identifiant non conforme ⇒ refusé, rien n’est envoyé', [r1, r2, r3].map((x) => x && x.code).join(' · '));
  });
  await essaie('une à la fois', async () => {
    const p = page({ reseau: (u) => (u === URL_PAUSE ? { status: 200, body: '{}' } : null) });
    const f = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: (id, msg) => attendre(80).then(() => p.ordre(msg)) });
    const [a, b] = await Promise.all([f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID }), f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID })]);
    dit([a, b].filter((x) => x && x.etape === 'fait').length === 1 && [a, b].some((x) => x && x.code === 'en-cours') && f.messagesOnglet.length === 1, 'deux clics simultanés ⇒ UNE pause envoyée, la seconde refusée « une à la fois »', JSON.stringify([a && (a.etape || a.code), b && (b.etape || b.code)]));
  });
  await essaie('plafond', async () => {
    const pleins = Array.from({ length: 10 }, (_, i) => Date.now() - i * 60e3);
    const f = fond(baseP(), Object.assign(transport(MON), { vrmLbcPauses: pleins }), { tabs: unOnglet, onglet: () => ({ ok: true, statut: 200, corps: '{}' }) });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.code === 'plafond' && !f.messagesOnglet.length, '10 pauses dans l’heure ⇒ la 11e est refusée, rien n’est envoyé', JSON.stringify(r));
  });
  await essaie('aucun onglet ouvert', async () => {
    const p = page({ reseau: sitePause(200, '{}') });
    const f = fond(baseP(), {}, { tabs: {}, onglet: versPage(p), surCreation: (id, local) => { setTimeout(() => { local.vrmLbcTransport = { [id]: { source: 'prive', compte: 'lbc-account:' + MON, at: Date.now() } }; }, 300); } });
    const r = await f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID });
    dit(r && r.etape === 'fait' && f.crees.length === 1 && f.fermes.includes(f.crees[0]), 'aucun onglet Leboncoin : un onglet s’ouvre en arrière-plan, la session est vérifiée, puis il se referme', JSON.stringify({ r: r && (r.etape || r.code), crees: f.crees, fermes: f.fermes }));
  });
  await essaie('la commande et l’état', async () => {
    const f = fond(baseP(), transport(MON), { tabs: unOnglet, onglet: () => ({ ok: true, statut: 200, corps: '{}' }) });
    const r = await f.ctx.executerCommande({ cmd: 'lbcPause', id: ID });
    const e = await f.ctx.etatPourApp();
    dit(r && r.etape === 'fait', 'la commande « lbcPause » de l’app arrive à la mise en pause', JSON.stringify(r));
    dit(e && e.lbcPause === true, 'l’état de l’extension dit qu’elle SAIT mettre en pause (l’app ne montre le bouton qu’à elle)', JSON.stringify(e && e.lbcPause));
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) au rouge` : '\n✅ Leboncoin « plus vue » et « mettre en pause » : tout est vert');
  process.exit(ko ? 1 : 0);
})();
