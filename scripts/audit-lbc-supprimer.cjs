// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN — « SUPPRIMER DE LEBONCOIN » DEPUIS VRM, SUR SON CLIC (29 octobre)
//   node scripts/audit-lbc-supprimer.cjs [--src background.js] [--inject lbc-inject.js]
//        [--relay lbc-relay.js] [--app App.jsx]
//   node scripts/audit-lbc-supprimer.cjs --prouve   (réaffaiblit chaque garde : chacune doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (29 oct.) : « je veux pouvoir sur VRM supprimer une annonce de
// Leboncoin ». MESURÉ (lecture seule, `lbc_recon.envois`) : la suppression qu'il
// a faite le 28 oct. à 22:47 (5.267) est `DELETE api.leboncoin.fr/api/pintad/
// v1/public/manual/delete/ads`, corps `{list_ids:[number]}`. Sa réponse n'a
// jamais été vue. C'est SANS RETOUR : la confirmation est exigée par l'app ET
// par l'extension. Le VRAI lbc-inject.js (MAIN), le VRAI lbc-relay.js (isolé)
// et le VRAI background.js sont exécutés (vm), identifiants INVENTÉS.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const CHEMIN = require(require('path').join(__dirname, '_chemin-json.cjs'));
const { spawnSync } = require('child_process');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/lbc-inject.js')),
  relay: arg('--relay', path.join(racine, 'vinted-sync-extension/lbc-relay.js')),
  app: arg('--app', path.join(racine, 'src/App.jsx')),
};
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['sansConfirmation', 'src', "if (!msg || msg.confirme !== true) return { accepte: false, code: 'confirmation', raison: \"la suppression n'a pas été confirmée — rien n'est parti\" };", ''],
    ['ordreRevenu', 'relay', "  const ecoutesEcrire=[];", "  const ecoutesEcrire=[];\n  try{chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{if(!msg||msg.action!=='lbcSupprimeAnnonce')return;versCapteur({__tag:'CANCALE_LBC_ORDRE',kind:'supprime',id:String(msg.id),jeton:'abcdefgh-1',compte:String(msg.compte||'')});sendResponse({ok:true});});}catch(_){}"],
    // 5.416 : le compte est vérifié DEUX fois (l'onglet connu, puis l'onglet de travail) : les deux retirées ⇒ rouge.
    ['autreCompte', 'src', [['if (c.compte === voulu) return { ok: true, tabId: Number(tid) };', 'return { ok: true, tabId: Number(tid) };'], ["    if (c.compte !== 'lbc-account:' + compte) return { rien: true, code: 'autre-compte', autre: idCompteLbc(c.compte) };\n", '']]],
    ['deja', 'src', "if (ad.status === 'deleted' && ad.supprimeeAt) return { accepte: false, code: 'deja', raison: \"elle est déjà notée supprimée de Leboncoin — rien n'est reparti\" };", ''],
    ['refusFait', 'src', "  if (statut >= 200 && statut < 300) {\n    const note = quoi === 'pause' ?", "  if (statut) {\n    const note = quoi === 'pause' ?"],
    ['plafond', 'src', 'if (journal.length >= LBC_SUPPRIME_MAX_HEURE) return', 'if (false) return'],
    ['appSansConfirmation', 'app', "    if (!ok) return;\n    setPauseEnVol(r.id);\n    let rep = null;\n    try { rep = await vmrCmd({ cmd: 'lbcSupprime', id: String(r.id), confirme: true }, 70000); }", "    setPauseEnVol(r.id);\n    let rep = null;\n    try { rep = await vmrCmd({ cmd: 'lbcSupprime', id: String(r.id), confirme: true }, 70000); }"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-supprimer-prouve-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    let txt = fs.readFileSync(F[cle], 'utf8');
    const paires = Array.isArray(avant) ? avant : [[avant, apres]];
    if (!paires.every(([a]) => txt.includes(a))) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    for (const [a, b] of paires) txt = txt.replace(a, b);
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt);
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 240000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA GARDE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque garde réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}
const SRC = fs.readFileSync(F.src, 'utf8');
const INJ = fs.readFileSync(F.inject, 'utf8');
const REL = fs.readFileSync(F.relay, 'utf8');
const APP = fs.readFileSync(F.app, 'utf8');
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + (e && e.message)); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const silence = { log() {}, warn() {}, error() {}, info() {} };
const MON = '8442aaaa-0000-4000-8000-000000000001';
const AUTRE = 'bbbb2222-0000-4000-8000-000000000002';
const API = 'https://api.leboncoin.fr/api';
const URL_PAUSE = `${API}/pintad/v1/public/manual/pause/ads`;
const URL_SUPPR = `${API}/pintad/v1/public/manual/delete/ads`;

// ── La page leboncoin.fr : le capteur (MAIN) et le relais (isolé) sur la MÊME fenêtre ──
// 5.362 : un MessageChannel de banc (deux ports, messages copiés, livrés au tour suivant).
class CanalBanc { constructor() { const a = {}, b = {}; const livre = (vers) => (m) => setTimeout(() => { if (typeof vers.onmessage === 'function') vers.onmessage({ data: JSON.parse(JSON.stringify(m)) }); }, 0); a.postMessage = livre(b); b.postMessage = livre(a); this.port1 = a; this.port2 = b; } }
const manu = (x) => x.appels.filter((y) => y.url.indexOf('/manual/') > 0);
function page({ reseau = () => null, top = true, hote = 'www.leboncoin.fr', fond = null } = {}) {
  const ecouteurs = [], posts = [], appels = [], envoyes = [], onMsg = [];
  const win = {};
  // 5.362 : `postMessage(m, origine, [port])` comme un navigateur (le canal privé des ordres passe un port).
  win.postMessage = (m, origine, transfert) => { const d = JSON.parse(JSON.stringify(m)); posts.push(d); setTimeout(() => { for (const f of ecouteurs.slice()) { try { f({ source: win, origin: 'https://' + hote, data: d, ports: transfert || [] }); } catch (_) {} } }, 0); };
  win.addEventListener = (t, f) => { if (t === 'message') ecouteurs.push(f); };
  win.fetch = async (u, init) => {
    const url = typeof u === 'string' ? u : u.url;
    appels.push({ url, methode: (init && init.method) || 'GET', corps: init && init.body, entetes: init && init.headers ? JSON.parse(JSON.stringify(init.headers)) : null, credentials: init && init.credentials });
    await attendre(3);
    const r = (/\/api\/account\/v1\/members\/me\/account$/.test(url) ? { status: 200, body: { account: { account_id: MON, type: 'private' }, member: { account_id: MON, nickname: { value: 'Moi' } } } } : null) || reseau(url, init) || { status: 404, body: '{}' };
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
    URL, MessageChannel: CanalBanc, FormData: class {}, TextEncoder, console: silence, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    Headers: class { constructor(o) { this.o = o || {}; } entries() { return Object.entries(this.o); } },
  });
  const ctxI = commun(); vm.createContext(ctxI); vm.runInContext(INJ, ctxI, { filename: 'lbc-inject.js' });
  const chromeR = { runtime: { id: 'ext', lastError: null,
    sendMessage: (m, cb) => { envoyes.push(JSON.parse(JSON.stringify(m))); Promise.resolve(fond ? fond(m) : { ok: true }).then((r) => { if (typeof cb === 'function') cb(r); }); },
    onMessage: { addListener: (f) => onMsg.push(f) } } };
  const ctxR = Object.assign(commun(), { chrome: chromeR, crypto: win.crypto }); vm.createContext(ctxR); vm.runInContext(REL, ctxR, { filename: 'lbc-relay.js' });
  // Le fond envoie un ordre à CET onglet (chrome.tabs.sendMessage).
  // 5.362 (moyenne 58) : l'ordre porte le compte attendu ; la page doit l'avoir lu
  // (la réponse `members/me/account` que le site charge lui-même) — MON par défaut.
  let compteLu = false;
  const lireCompte = async () => { if (compteLu) return; compteLu = true; await win.fetch('https://api.leboncoin.fr/api/account/v1/members/me/account', { method: 'GET' }); await attendre(10); };
  const ordre = async (msg, sender = { id: 'ext' }) => { await lireCompte(); return ordreBrut(/^lbc(Pause|Supprime)Annonce$/.test(String(msg && msg.action)) && !('compte' in msg) ? Object.assign({ compte: MON }, msg) : msg, sender); };
  const ordreBrut = (msg, sender = { id: 'ext' }) => new Promise((res) => {
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
        // (1er nov., X4) La forme de PostgREST : un segment numérique NU est un index
        // de tableau (NULL sur un objet, 400 au-delà d'un int) ; seul `"…"` est une clé.
        const e400 = CHEMIN.erreurProjection(s); if (e400) return rep(false, JSON.stringify(e400.body), e400.status);
        for (const part of s.split(',')) { const [alias, chemin] = part.includes(':') ? part.split(':') : [part, part]; const ks = chemin.split('->').map((x) => x.replace(/^>/, '')); let v = { data: base[id] }; v = v.data; if (ks[0] !== 'data') v = undefined; for (const k of ks.slice(1)) v = CHEMIN.appliquerSegment(v, k); row[alias] = v === undefined ? null : v; }
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


(async () => {
  // 5.416 (21 nov., « on ne fait plus les requêtes ») : la suppression ne part plus d'une requête de VRM — la PAGE
  // supprime quand lbc-ecrire.js touche ses boutons (banc `bancs/lbc-interface.cjs`, audit `audit-lbc-interface.cjs`).
  console.log('── 1. LA PAGE : PLUS AUCUN ORDRE DE SUPPRESSION PAR REQUÊTE (5.416)');
  const site = (statut, corps) => (u) => (u === URL_SUPPR || u === URL_PAUSE ? { status: statut, body: corps } : (u.indexOf(API) === 0 ? { status: 200, body: { ok: 1 } } : null));
  await essaie('ancien ordre', async () => {
    const p = page({ reseau: site(200, '{"ok":true}') });
    await p.charge(`${API}/pintad/v1/public/expired`, { method: 'GET', headers: { api_key: 'cle_du_site' } });
    const rep = await p.ordre({ from: 'vrm-fond', action: 'lbcSupprimeAnnonce', id: '3290000104' });
    const rep2 = await p.ordre({ from: 'vrm-fond', action: 'lbcPauseAnnonce', id: '3290000104' });
    await attendre(60);
    dit(rep === undefined && rep2 === undefined && manu(p).length === 0, 'les anciens ordres « supprimer » / « mettre en pause » du fond : plus personne ne les porte, AUCUNE requête ne part', JSON.stringify({ rep, rep2, a: manu(p).map((x) => x.methode + ' ' + x.url) }));
  });
  await essaie('adresse imposée', async () => {
    const p = page({ reseau: site(200, '{}') });
    p.win.postMessage({ __tag: 'CANCALE_LBC_ORDRE', kind: 'supprime', id: '3290000104', jeton: 'abcdefgh-7', url: `${API}/autre/chose` });
    await attendre(60);
    dit(manu(p).length === 0, 'un ordre posté par la page : rien ne part', JSON.stringify(manu(p).map((x) => x.url)));
  });

  console.log('\n── 2. LE FOND : CONFIRMATION, COMPTE CONNECTÉ, UNE À LA FOIS, PLAFOND, RÉPONSE');
  const ID = '3290000104';
  const comptes = { accounts: { ['lbc-account:' + MON]: { id: MON, name: 'Totomondu', type: 'particulier' }, ['lbc-account:' + AUTRE]: { id: AUTRE, name: 'ShopAutre', type: 'pro' } } };
  const baseS = () => ({ lbc_listings: { items: { [ID]: { id: ID, subject: 'Nike shox TL noir', account: MON, status: 'active', ref: '18' } } }, lbc_accounts: comptes });
  // 5.416 : l'interface apprise de SA suppression à la main (dans CE navigateur) ; l'onglet de travail ouvert par
  // le fond reçoit la session du même navigateur (les mêmes cookies : le même compte que l'onglet 1).
  const UI_S = { supprime: { etapes: [{ sig: { tag: 'button', attrs: { 'aria-label': 'Plus d’options' } }, portee: 'ligne' }, { sig: { tag: 'button', attrs: {}, mot: 'Supprimer' }, portee: 'page' }, { sig: { tag: 'button', attrs: {}, mot: 'Supprimer définitivement' }, portee: 'page' }], page: { modele: '/compte/part/mes-annonces', recherche: '' } },
    pause: { etapes: [{ sig: { tag: 'button', attrs: { 'aria-label': 'Plus d’options' } }, portee: 'ligne' }, { sig: { tag: 'button', attrs: {}, mot: 'Désactiver' }, portee: 'page' }, { sig: { tag: 'button', attrs: {}, mot: 'Confirmer' }, portee: 'page' }], page: { modele: '/compte/part/mes-annonces', recherche: '' } } };
  const transport = (compte) => ({ vrmLbcUi: UI_S, vrmLbcTransport: { 1: { source: 'prive', compte: 'lbc-account:' + compte, at: Date.now() } } });
  const memeSession = (id, local) => { local.vrmLbcTransport = Object.assign({}, local.vrmLbcTransport, { [id]: Object.assign({}, (local.vrmLbcTransport || {})[1]) }); };
  // L'onglet de travail : prêt, puis la réponse de lbc-ecrire.js (`statut` : ce que la PAGE a envoyé, vu par le capteur).
  const gesteUI = (rep, apres) => (id, msg) => { if (msg.action === 'lbcEcrirePret') return { ok: true, canal: true }; if (msg.action === 'lbcGesteUI') return Promise.resolve(apres ? attendre(apres) : null).then(() => (typeof rep === 'function' ? rep(msg) : rep)); return undefined; };
  const vu = (statut) => ({ ok: true, statut, confirme: statut >= 200 && statut < 300, geste: true });
  const gestes = (f) => f.messagesOnglet.filter((x) => x.msg.action === 'lbcGesteUI');
  const unOnglet = { 1: { id: 1, url: 'https://www.leboncoin.fr/compte/part/mes-annonces' } };
  const versPage = (p) => (id, msg) => p.ordre(msg);
  await essaie('sans confirmation', async () => {
    const p = page({ reseau: site(200, '{}') });
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)) });
    const r1 = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID });
    const r2 = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: 'true' });
    dit(r1 && r1.code === 'confirmation' && r2 && r2.code === 'confirmation' && !f.messagesOnglet.length && !p.appels.length, 'sans `confirme: true` (ni « true » en texte) ⇒ refusé, RIEN n’est envoyé', JSON.stringify([r1 && r1.code, r2 && r2.code]));
  });
  await essaie('suppression acceptée', async () => {
    const p = page({ reseau: site(200, '{"ok":true}') });
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)) });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    await attendre(40);
    dit(r && r.accepte === true && r.etape === 'fait' && r.statut === 200, 'la page a envoyé la suppression (200, vue par le capteur) ⇒ « fait »', JSON.stringify(r));
    const g = gestes(f);
    dit(g.length === 1 && g[0].frameId === 0 && f.crees.includes(g[0].id) && f.fermes.includes(g[0].id) && Object.keys(g[0].msg).sort().join() === 'action,compte,from,id,quoi' && g[0].msg.quoi === 'supprime' && g[0].msg.compte === MON, 'un seul geste d’INTERFACE, au cadre principal de l’onglet de travail (refermé), avec l’identifiant et le compte attendu (revérifié dans la page)', JSON.stringify(f.messagesOnglet));
    const it = ((f.base.lbc_listings || {}).items || {})[ID] || {};
    dit(it.status === 'deleted' && !!it.supprimeeAt && it.supprimeeStatut === 200 && it.statutLbc === 'active' && it.subject === 'Nike shox TL noir', 'l’annonce est notée supprimée (rien n’est effacé de la base : sa fiche reste)', JSON.stringify(it));
    dit((f.local.vrmLbcSuppressions || []).length === 1, 'la suppression compte dans le plafond horaire');
    const r2 = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    dit(r2 && r2.code === 'deja' && gestes(f).length === 1, 'recliquer sur une annonce déjà notée supprimée ⇒ rien ne repart', JSON.stringify(r2));
  });
  await essaie('suppression refusée', async () => {
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(403)) });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    const it = ((f.base.lbc_listings || {}).items || {})[ID] || {};
    dit(r && r.etape === 'refuse' && r.statut === 403 && it.status === 'active' && !it.supprimeeAt, 'Leboncoin refuse (403, vu sur la page) ⇒ « pas fait », rien de noté', JSON.stringify(r));
    const g5 = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(500)) });
    const r5 = await g5.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    const it5 = ((g5.base.lbc_listings || {}).items || {})[ID] || {};
    dit(r5 && r5.etape === 'refuse' && r5.statut === 500 && it5.status === 'active' && !it5.supprimeeAt, 'Leboncoin répond 500 (vu sur la page) ⇒ « pas fait », rien de noté', JSON.stringify(r5));
  });
  await essaie('pas de réponse', async () => {
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(undefined) });
    f.ctx.avecDelai = (p, ms, d) => Promise.race([p, attendre(Math.min(ms, 300)).then(() => d)]);
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    const it = ((f.base.lbc_listings || {}).items || {})[ID] || {};
    dit(r && r.etape === 'incertain' && !it.supprimeeAt, 'l’onglet ne répond pas ⇒ « je ne sais pas », jamais « fait »', JSON.stringify(r));
  });
  await essaie('autre compte', async () => {
    const f = fond(baseS(), transport(AUTRE), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)) });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    dit(r && r.accepte === false && r.code === 'autre-compte' && !gestes(f).length && /Totomondu/.test(r.raison || '') && /ShopAutre/.test(r.raison || ''), 'Leboncoin connecté sur un AUTRE compte ⇒ refusé, rien n’est envoyé, les deux comptes sont nommés', JSON.stringify(r));
  });
  await essaie('lecture ratée, inconnue', async () => {
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)) });
    const r1 = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: '3111111111', confirme: true, sansRetour: true });
    const g = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)), pannes: ['lbc_listings'] });
    const r2 = await g.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    dit(r1 && r1.code === 'inconnue' && r2 && r2.code === 'lecture' && !gestes(f).length && !gestes(g).length, 'annonce absente de SES annonces, base muette ⇒ refusé, rien n’est envoyé', [r1, r2].map((x) => x && x.code).join(' · '));
  });
  await essaie('une à la fois', async () => {
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200), 80) });
    const [a, b] = await Promise.all([f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true }), f.ctx.pauseLbcDepuisApp({ cmd: 'lbcPause', id: ID })]);
    dit(gestes(f).length === 1 && [a, b].some((x) => x && x.code === 'en-cours'), 'une suppression et une pause en même temps ⇒ UNE seule part', JSON.stringify([a && (a.etape || a.code), b && (b.etape || b.code)]));
  });
  await essaie('plafond', async () => {
    const pleins = Array.from({ length: 10 }, (_, i) => Date.now() - i * 60e3);
    const f = fond(baseS(), Object.assign(transport(MON), { vrmLbcSuppressions: pleins }), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)) });
    const r = await f.ctx.supprimeLbcDepuisApp({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    dit(r && r.code === 'plafond' && !gestes(f).length, '10 suppressions dans l’heure ⇒ la 11e est refusée, rien n’est envoyé', JSON.stringify(r));
  });
  await essaie('commande et état', async () => {
    const f = fond(baseS(), transport(MON), { tabs: unOnglet, surCreation: memeSession, onglet: gesteUI(vu(200)) });
    const r = await f.ctx.executerCommande({ cmd: 'lbcSupprime', id: ID, confirme: true, sansRetour: true });
    const e = await f.ctx.etatPourApp();
    dit(r && r.etape === 'fait', 'la commande « lbcSupprime » de l’app arrive à la suppression', JSON.stringify(r));
    dit(e && e.lbcSupprime === true, 'l’état de l’extension dit qu’elle SAIT supprimer (l’app ne montre le bouton qu’à elle)', JSON.stringify(e && e.lbcSupprime));
    const rc = typeof f.ctx.relaisCommande === 'function' ? f.ctx.relaisCommande({ cmd: 'lbcSupprime', args: { id: ID }, confirme: true }) : { type: 'cmd' };
    dit(!rc || !!rc.refus, 'le relais du téléphone ne la transporte pas (liste blanche inchangée)', JSON.stringify(rc));
  });

  // (20 nov., décision de Julien) Supprimer se fait dans le PANNEAU de l'extension (qui demande la confirmation « sans retour » ;
  // l'extension exige `confirme`, vérifié plus haut) : l'app ne fait qu'ouvrir le lien, sur l'annonce désignée par identité.
  console.log('\n── 3. L’APP : SUPPRIMER S’OUVRE DANS L’EXTENSION, RIEN N’EST ENVOYÉ D’ICI');
  await essaie('app', async () => {
    const i = APP.indexOf('const supprimerSurLbc = (r) =>');
    const corpsF = i >= 0 ? APP.slice(i, APP.indexOf('\n', i)) : '';
    // (25 nov., décision de Julien du 24 nov. — CLAUDE.md §3) DEPUIS VRM par la porte : SA confirmation « sans retour », puis UNE
    // commande pour CETTE annonce ; pas connecté ⇒ le panneau sur CETTE annonce (par son identifiant).
    const r = await require('./_porte-agir.cjs').supprimerLbc(corpsF, fs.readFileSync(path.join(__dirname, '..', 'src', 'agir', 'Agir.jsx'), 'utf8'));
    dit(r.ok, 'supprimer : depuis VRM par la porte (confirmé) sur CETTE annonce ; sinon le panneau sur CETTE annonce (par son identifiant)', r.detail);
    dit(!/cmd: 'lbcSupprime'/.test(APP), 'aucune suppression n’est envoyée de l’écran Leboncoin');
  });

  console.log('── Une notion, deux constantes : le plafond de suppressions par heure');
  {
    // (30 oct., intégration) L'écran Republier promet « au plus N par passage (la
    // limite de suppressions de l'extension par heure) » : N doit ÊTRE cette
    // limite. Rien ne les liait — l'extension baissée, la phrase devenait fausse.
    const mApp = APP.match(/const REPUB_LBC_MAX\s*=\s*(\d+)/), mExt = SRC.match(/const LBC_SUPPRIME_MAX_HEURE\s*=\s*(\d+)/);
    dit(!!mApp && !!mExt, 'les deux constantes sont trouvées', `app=${mApp && mApp[1]} ext=${mExt && mExt[1]}`);
    dit(!!mApp && !!mExt && mApp[1] === mExt[1], 'REPUB_LBC_MAX (app) = LBC_SUPPRIME_MAX_HEURE (extension)', `app=${mApp && mApp[1]} ext=${mExt && mExt[1]}`);
  }

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
