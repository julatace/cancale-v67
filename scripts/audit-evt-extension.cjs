// ════════════════════════════════════════════════════════════════════════════
//  L'EXTENSION PRÉVIENT L'APP — ET SEULEMENT DE CE QUI A VRAIMENT EU LIEU
//  (extension 5.155, 4 octobre)
//
//  On EXÉCUTE le vrai `background.js` dans un `vm` (§4.10) avec une fausse base
//  Supabase À ÉTAT (ce qui est écrit se relit, la projection `select=` est
//  appliquée — §6.3) et un faux Vinted. On compte ce que l'app reçoit
//  (`chrome.tabs.sendMessage` → `__vmrEvt`) et ce que le diagnostic note.
//
//   1. ACHATS : une écriture d'`orders_purchased` qui ABOUTIT prévient l'app
//      UNE fois (`maj · achats`), sur les deux voies (passive et active) ; une
//      écriture ratée ne prévient PAS.
//   2. CODE DE RETRAIT : un code NEUF rangé dans `panel_colis_relais` prévient
//      l'app (`maj · retrait`), par les trois chemins (direct, conversation
//      passive, `capterRetraits`) ; un code inchangé ou une écriture ratée, non.
//   3. CAPTURE PLUS PAUVRE (voie active) : refusée, AUCUN `maj · ventes`, et le
//      refus est COMPTÉ (`ignore_partiel_actif_<type>`).
//   4. « RELIS MES VENTES » : une lecture ou une écriture ratée RELÂCHE la garde
//      des 90 s (ramenée à 20 s : la demande suivante réessaie, jamais en
//      rafale) et la commande ne prétend pas avoir rafraîchi ; Vinted qui
//      freine (429) et un succès gardent la garde entière (l'autre sens).
//   5. `supabaseUpsert` : un refus est noté AVEC SON CODE HTTP, sans aucun
//      identifiant ni corps ; un seul nouvel essai après un 401 + session
//      renouvelée (jamais deux, jamais sur un 5xx) ; le tampon de diagnostic
//      n'est vidé que si son écriture a abouti.
//
//  Données INVENTÉES uniquement. Chaque bloc passe par `essaie()` : ce qui lève
//  devient un contrôle ROUGE et le bilan est toujours imprimé.
//  Usage : node scripts/audit-evt-extension.cjs [--src chemin/vers/background.js]
//  (`--src` sert à la preuve par mutation : on retire un envoi, ça doit rougir.)
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const { metaVersData } = require('./bancs/_meta.cjs');
const iSrc = process.argv.indexOf('--src');
const SRC = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const src = fs.readFileSync(SRC, 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const UID = '4400123', TX = '880001', TX2 = '880002', CID = '990001', APP = 'https://vrm.center';

// La projection PostgREST, appliquée pour de vrai : `select=data`, `id`,
// `alias:data->>k`, `alias:data->a->b`. Une ligne brute rendue pour une requête
// projetée ferait lire un champ absent (§6.3).
function projette(row, select) {
  if (!select) return row;
  const out = {};
  for (const champ of select.split(',')) {
    const m = /^(?:([A-Za-z_]\w*):)?(.+)$/.exec(champ.trim());
    const alias = m[1], expr = m[2];
    if (expr === 'data' || expr === 'id') { out[alias || expr] = row[expr]; continue; }
    const texte = /->>[^>]*$/.test(expr);
    const parts = expr.split(/->>|->/);
    let v = row[parts[0]];
    for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias || parts[parts.length - 1]] = v === undefined ? null : v;
  }
  return out;
}

// `ecriture(ids, n)` → code HTTP de la n-ième écriture (ou 'jette' = réseau).
// `cloisonne` : la base sait séparer les vendeurs (sonde `select=owner`).
function faireCtx({ lignes = {}, ecriture = () => 201, cloisonne = false, session = null, vinted = null, connecte = UID } = {}) {
  const store = {}; let ecouteur = null;
  if (session) store.vrmSession = session;
  const j = { evts: [], posts: [], refresh: 0, vinted: [] };
  const rep = (status, body) => ({ ok: status < 400, status, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener(fn) { ecouteur = fn; } }, getManifest: () => ({ version: '5.155.0' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, onClicked: { addListener() {} }, setPopup() {} },
      tabs: { onUpdated: { addListener() {} }, onActivated: { addListener() {} }, query: async () => [{ id: 7 }],
        sendMessage: (id, m, cb) => { if (m && m.__vmrEvt) j.evts.push(m.evt); if (typeof cb === 'function') cb(); }, create: dual({}) },
      storage: { local: {
        get(k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = JSON.parse(JSON.stringify(store[c])); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set(o, cb) { Object.assign(store, JSON.parse(JSON.stringify(o))); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove(k, cb) { for (const c of [].concat(k)) delete store[c]; if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
      }, onChanged: { addListener() {} } },
      webNavigation: { onCompleted: { addListener() {} } },
      scripting: { executeScript: dual([]) },
    },
    fetch: async (url, opts = {}) => {
      const u0 = String(url);
      if (/\/auth\/v1\/token\?grant_type=refresh_token/.test(u0)) {
        j.refresh++;
        return rep(200, JSON.stringify({ access_token: 'jeton-neuf', refresh_token: 'r2', expires_in: 3600, user: { id: 'vendeur-1' } }));
      }
      if ((opts.method || 'GET') === 'POST') {
        let rows = []; try { rows = JSON.parse(opts.body || '[]'); } catch (_) {}
        const ids = rows.map((r) => r.id);
        const auth = (opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '';
        j.posts.push({ ids, auth, body: opts.body });
        const st = ecriture(ids, j.posts.length);
        if (st === 'jette') throw new Error('réseau coupé');
        if (st < 400) for (const r of rows) lignes[r.id] = JSON.parse(JSON.stringify(r.data));
        return rep(st, '');
      }
      const u = decodeURIComponent(metaVersData(u0));
      if (/app_data\?select=owner&limit=1/.test(u)) return cloisonne ? rep(200, '[]') : rep(400, '{"message":"column app_data.owner does not exist"}');
      const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || '';
      const eq = /[?&]id=eq\.([^&]+)/.exec(u), like = /[?&]id=like\.([^&]+)/.exec(u);
      const sortie = [];
      if (eq) { if (lignes[eq[1]] !== undefined) sortie.push({ id: eq[1], data: lignes[eq[1]] }); }
      else if (like) {
        const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$');
        for (const k of Object.keys(lignes)) if (re.test(k)) sortie.push({ id: k, data: lignes[k] });
      }
      return rep(200, JSON.stringify(sortie.map((r) => projette(r, sel))));
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  // Les portes du monde extérieur (Vinted, le cookie), remplacées pour COMPTER.
  ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'compte-essai', domain: 'www.vinted.fr' }];
  ctx.activeAccountId = async () => connecte;
  ctx.logActivity = async () => {};
  ctx.vintedGet = async (acc, chemin) => {
    j.vinted.push(chemin);
    if (vinted) return vinted(chemin);
    return { ok: false, status: 404, json: null };
  };
  const envoyer = (msg, origine = APP) => new Promise((res) => {
    const r = ecouteur(Object.assign({ from: 'vmr-bridge' }, msg), { origin: origine, url: origine + '/' }, res);
    if (r !== true) setTimeout(() => res(undefined), 5);
  });
  const finir = async (jobId) => { for (let i = 0; i < 300; i++) { const c = ((await ctx.chrome.storage.local.get('vrmCmds')).vrmCmds || {})[jobId]; if (c && c.etape !== 'file') return c; await attendre(5); } return null; };
  // Un compteur de diagnostic : ce qui est encore dans le tampon local + ce qui
  // est déjà parti en base (le tampon se vide dans `panel_diag_capture`).
  const compteur = (k) => Number(((store.vrmDiagBuf || {}).n || {})[k] || 0) + Number((((lignes.panel_diag_capture || {}).n) || {})[k] || 0);
  const cles = () => Object.keys(Object.assign({}, (store.vrmDiagBuf || {}).n || {}, ((lignes.panel_diag_capture || {}).n) || {}));
  const calme = async () => { for (let i = 0; i < 6; i++) { try { await vm.runInContext('_diagChaine', ctx); } catch (_) {} await attendre(8); } };
  const evts = (quoi) => j.evts.filter((e) => e && e.type === 'maj' && e.quoi === quoi);
  return { ctx, j, store, lignes, envoyer, finir, compteur, cles, calme, evts };
}

const commande = (tx, statut) => ({ id: Number(tx), transaction_id: Number(tx), title: 'Paire essai ' + tx, status: statut || 'Colis déposé en point relais', conversation_id: Number(CID) });
const listeAchats = (n) => ({ my_orders: Array.from({ length: n }, (_, i) => commande(String(Number(TX) + i))), pagination: { total_entries: n, total_pages: 1 } });
const listeVentes = (n, total) => ({ my_orders: Array.from({ length: n }, (_, i) => commande(String(Number(TX) + i), 'Le paiement a été validé')), pagination: { total_entries: total || n, total_pages: 1 } });
const conversationArrivee = (code) => ({ conversation: {
  id: Number(CID), conversation_url: `https://www.vinted.fr/inbox/${CID}`,
  transaction: { id: Number(TX), item_id: 5550001, item_title: 'Paire essai', current_user_side: 'buyer' },
  messages: [{ entity_type: 'action_message', entity: { title: 'Ton colis est arrivé !',
    subtitle: `Il t'attend à l'adresse suivante : Épicerie Essai, 1 Rue Inventée, 99000 Nulle-Part, France. Scanne ton code de retrait ou saisis le code ${code} pour le récupérer.` } }],
} });
const retrait = (code) => ({ tx: TX, item: '5550001', titre: 'Paire essai', photo: null, lieu: 'Épicerie Essai, 99000 Nulle-Part', code, qr: '', conv: CID, url: '', at: new Date().toISOString() });

(async () => {
  // ── 1. LES ACHATS ─────────────────────────────────────────────────────────
  await essaie('achats · voie passive', async () => {
    const a = faireCtx();
    await a.ctx.storeHarvest('www.vinted.fr', 'orders_purchased', '', JSON.stringify(listeAchats(2)));
    await attendre(30);
    dit(a.j.posts.some((p) => p.ids.includes(`harvest_${UID}_orders_purchased`)), 'voie passive : les achats sont bien écrits (sinon le contrôle suivant ne prouverait rien)', JSON.stringify(a.j.posts.map((p) => p.ids)));
    dit(a.evts('achats').length === 1 && String(a.evts('achats')[0].uid) === UID, "voie passive : l'app est prévenue UNE fois (maj · achats · avec le compte)", JSON.stringify(a.j.evts));
    dit(a.evts('ventes').length === 0, 'des achats ne se font pas passer pour des ventes', JSON.stringify(a.j.evts));
  });
  await essaie('achats · voie passive · écriture ratée', async () => {
    const a = faireCtx({ ecriture: () => 522 });
    await a.ctx.storeHarvest('www.vinted.fr', 'orders_purchased', '', JSON.stringify(listeAchats(2)));
    await attendre(30);
    dit(a.j.posts.length >= 1 && a.evts('achats').length === 0, 'voie passive, la base refuse (522) : AUCUN maj · achats', `${a.j.posts.length} écriture(s) · ${JSON.stringify(a.j.evts)}`);
  });
  await essaie('achats · voie active', async () => {
    const a = faireCtx();
    await a.ctx.storeHarvestRow(UID, 'orders_purchased', listeAchats(3), 'www.vinted.fr');
    await attendre(30);
    dit(a.evts('achats').length === 1, "voie active : l'app est prévenue UNE fois (maj · achats)", JSON.stringify(a.j.evts));
  });
  await essaie('achats · voie active · écriture ratée', async () => {
    const a = faireCtx({ ecriture: () => 503 });
    await a.ctx.storeHarvestRow(UID, 'orders_purchased', listeAchats(3), 'www.vinted.fr');
    await attendre(30);
    dit(a.j.posts.length >= 1 && a.evts('achats').length === 0, 'voie active, la base refuse (503) : AUCUN maj · achats', `${a.j.posts.length} écriture(s) · ${JSON.stringify(a.j.evts)}`);
  });
  await essaie('ventes · inchangé', async () => {
    const a = faireCtx();
    await a.ctx.storeHarvestRow(UID, 'orders_sold', listeVentes(2), 'www.vinted.fr');
    await a.ctx.storeHarvest('www.vinted.fr', 'orders_sold', '', JSON.stringify(listeVentes(2)));
    await attendre(30);
    dit(a.evts('ventes').length === 2 && a.evts('achats').length === 0, 'autre sens : les ventes préviennent toujours (une fois par voie), et jamais en « achats »', JSON.stringify(a.j.evts));
  });

  // ── 2. LE CODE DE RETRAIT ─────────────────────────────────────────────────
  await essaie('retrait · direct', async () => {
    const a = faireCtx();
    const r1 = await a.ctx.noterRetrait(retrait('C11111'), UID);
    await attendre(20);
    dit(r1 === true && a.lignes.panel_colis_relais && a.lignes.panel_colis_relais[TX] && a.lignes.panel_colis_relais[TX].code === 'C11111', 'un code NEUF est rangé dans panel_colis_relais', JSON.stringify(a.lignes.panel_colis_relais));
    dit(a.evts('retrait').length === 1 && String(a.evts('retrait')[0].uid) === UID, "et l'app est prévenue UNE fois (maj · retrait · avec le compte)", JSON.stringify(a.j.evts));
    const avant = a.j.posts.length, evAvant = a.evts('retrait').length;
    const r2 = await a.ctx.noterRetrait(retrait('C11111'), UID);
    await attendre(20);
    dit(r2 === false && a.j.posts.length === avant && a.evts('retrait').length === evAvant, 'le MÊME code relu : rien écrit, rien annoncé', `rendu ${r2} · ${a.j.posts.length - avant} écriture(s) · ${a.evts('retrait').length - evAvant} évènement(s) de plus`);
  });
  await essaie('retrait · écriture ratée', async () => {
    const a = faireCtx({ ecriture: (ids) => (ids.includes('panel_colis_relais') ? 522 : 201) });
    const r = await a.ctx.noterRetrait(retrait('C22222'), UID);
    await attendre(20);
    dit(r === false && a.evts('retrait').length === 0, "la base refuse le code : noterRetrait ne dit pas « écrit » et l'app n'est PAS prévenue", `rendu ${r} · ${JSON.stringify(a.j.evts)}`);
  });
  await essaie('retrait · conversation passive', async () => {
    const a = faireCtx();
    await a.ctx.storeHarvest('www.vinted.fr', 'conversation', CID, JSON.stringify(conversationArrivee('C33333')));
    await attendre(30);
    dit(a.lignes.panel_colis_relais && a.lignes.panel_colis_relais[TX] && a.lignes.panel_colis_relais[TX].code === 'C33333', 'conversation passive : le code est lu et rangé', JSON.stringify(a.lignes.panel_colis_relais || null));
    dit(a.evts('retrait').length === 1 && String(a.evts('retrait')[0].uid) === UID, "conversation passive : l'app est prévenue (maj · retrait · avec le compte)", JSON.stringify(a.j.evts));
  });
  await essaie('retrait · capterRetraits', async () => {
    const lignes = { [`harvest_${UID}_orders_purchased`]: { payload: { my_orders: [commande(TX, 'Colis déposé en point relais')] } } };
    const a = faireCtx({ lignes, vinted: (chemin) => (/conversations\//.test(chemin) ? { ok: true, status: 200, json: conversationArrivee('C44444') } : { ok: false, status: 404, json: null }) });
    await a.ctx.capterRetraits(UID);
    await attendre(30);
    dit(a.j.vinted.length === 1, 'capterRetraits ouvre UNE conversation (le garde-fou de volume tient)', JSON.stringify(a.j.vinted));
    dit(a.evts('retrait').length === 1 && String(a.evts('retrait')[0].uid) === UID, "capterRetraits : le code rangé prévient l'app (maj · retrait)", JSON.stringify(a.j.evts));
  });

  // ── 3. LA CAPTURE PLUS PAUVRE (voie active) ───────────────────────────────
  await essaie('plus pauvre', async () => {
    const lignes = { [`harvest_${UID}_orders_sold`]: { nItems: 5, payload: listeVentes(5) } };
    const a = faireCtx({ lignes });
    await a.ctx.storeHarvestRow(UID, 'orders_sold', listeVentes(2, 9), 'www.vinted.fr');
    await a.calme();
    dit(!a.j.posts.some((p) => p.ids.includes(`harvest_${UID}_orders_sold`)), 'une capture plus pauvre (2 contre 5) ne remplace pas la bonne', JSON.stringify(a.j.posts.map((p) => p.ids)));
    dit(a.evts('ventes').length === 0, "et elle n'annonce AUCUNE vente à l'app", JSON.stringify(a.j.evts));
    dit(a.compteur('ignore_partiel_actif_orders_sold') === 1, 'et le refus est COMPTÉ (ignore_partiel_actif_orders_sold = 1)', JSON.stringify(a.cles()));
  });

  // ── 4. « RELIS MES VENTES » ───────────────────────────────────────────────
  // La garde se juge sur ce qu'il RESTE à attendre (lu dans le stockage, avec
  // la vraie constante du fichier), et le temps qui passe se simule en vieillissant
  // la marque — jamais en dormant 90 s au banc.
  const CMD = { action: 'cmd', cmd: 'ventes' };
  const garde = async (a) => (((await a.ctx.chrome.storage.local.get('vrmDerniereVente')).vrmDerniereVente) || {})[UID];
  const reste = async (a) => { const g = await garde(a); return g === undefined ? 0 : Number(vm.runInContext('VENTES_DELAI_MS', a.ctx)) - (Date.now() - Number(g)); };
  const vieillir = async (a, ms) => { const dv = ((await a.ctx.chrome.storage.local.get('vrmDerniereVente')).vrmDerniereVente) || {}; if (dv[UID] != null) dv[UID] = Number(dv[UID]) - ms; await a.ctx.chrome.storage.local.set({ vrmDerniereVente: dv }); };
  await essaie('ventes · lecture ratée', async () => {
    const a = faireCtx({ vinted: () => ({ ok: false, status: 500, json: null }) });
    const ack = await a.envoyer(CMD);
    dit(ack && ack.accepte === true && ack.etape !== 'ventes' && !!ack.jobId, "l'accusé ne prétend rien : demande en file, avec un identifiant à suivre", JSON.stringify(ack));
    const fin = await a.finir(`ventes:${UID}`);
    dit(fin && fin.etape === 'echec', 'Vinted ne répond pas : la commande finit en « échec », jamais en « fait »', JSON.stringify(fin));
    const r1 = await reste(a);
    dit(r1 <= 25000, 'et la garde des 90 s est RELÂCHÉE (il ne reste que quelques secondes à attendre)', `reste ${Math.round(r1 / 1000)} s`);
    dit(r1 > 0, "mais pas EFFACÉE : un échec durable ne relit pas Vinted à chaque page (§3, limite de volume)", `reste ${Math.round(r1 / 1000)} s`);
    await vieillir(a, 21000);
    const lus = a.j.vinted.length;
    const ack2 = await a.envoyer(CMD);
    await a.finir(`ventes:${UID}`); await attendre(20);
    dit(ack2 && ack2.etape !== 'recent' && a.j.vinted.length > lus, 'vingt secondes plus tard, la demande suivante RÉESSAIE (pas de « récent » sur une lecture ratée)', `${JSON.stringify(ack2)} · ${a.j.vinted.length - lus} lecture(s) de plus`);
  });
  await essaie('ventes · Vinted freine (429)', async () => {
    const a = faireCtx({ vinted: () => ({ ok: false, status: 429, json: null }) });
    await a.envoyer(CMD);
    const fin = await a.finir(`ventes:${UID}`);
    dit(fin && fin.etape === 'echec' && fin.raison === 'vinted-freine', 'Vinted répond 429 : « échec » avec la raison « vinted-freine »', JSON.stringify(fin));
    const r = await reste(a);
    dit(r >= 85000, 'et la garde ENTIÈRE reste : on ne réessaie pas vite quand Vinted demande de ralentir (§3)', `reste ${Math.round(r / 1000)} s`);
    await vieillir(a, 21000);
    const lus = a.j.vinted.length;
    const ack2 = await a.envoyer(CMD);
    await attendre(30);
    dit(ack2 && ack2.etape === 'recent' && a.j.vinted.length === lus, 'vingt secondes plus tard : toujours « récent », zéro lecture Vinted', `${JSON.stringify(ack2)} · ${a.j.vinted.length - lus} lecture(s)`);
  });
  await essaie('ventes · écriture ratée', async () => {
    const a = faireCtx({ vinted: () => ({ ok: true, status: 200, json: listeVentes(2) }), ecriture: (ids) => (ids.some((x) => /orders_sold/.test(x)) ? 522 : 201) });
    await a.envoyer(CMD);
    const fin = await a.finir(`ventes:${UID}`);
    await attendre(20);
    dit(fin && fin.etape === 'echec', 'lu, mais la base refuse : « échec », pas « fait »', JSON.stringify(fin));
    const r = await reste(a);
    dit(r > 0 && r <= 25000, 'et la garde est relâchée (quelques secondes, pas 90)', `reste ${Math.round(r / 1000)} s`);
    dit(a.evts('ventes').length === 0, "aucune vente annoncée à l'app", JSON.stringify(a.j.evts));
  });
  await essaie('ventes · plus pauvre', async () => {
    const lignes = { [`harvest_${UID}_orders_sold`]: { nItems: 5, payload: listeVentes(5) } };
    const a = faireCtx({ lignes, vinted: () => ({ ok: true, status: 200, json: listeVentes(2, 9) }) });
    await a.envoyer(CMD);
    const fin = await a.finir(`ventes:${UID}`);
    await attendre(20);
    dit(fin && fin.etape === 'rien' && fin.raison === 'plus-pauvre', 'lu mais plus pauvre : « rien » avec la raison — jamais « fait »', JSON.stringify(fin));
    dit(a.evts('ventes').length === 0, "aucune vente annoncée à l'app", JSON.stringify(a.j.evts));
    const r = await reste(a);
    dit(r >= 85000, "un refus « plus pauvre » n'est pas un échec : la garde entière reste", `reste ${Math.round(r / 1000)} s`);
  });
  await essaie('ventes · succès', async () => {
    const a = faireCtx({ vinted: () => ({ ok: true, status: 200, json: listeVentes(2) }) });
    await a.envoyer(CMD);
    const fin = await a.finir(`ventes:${UID}`);
    await attendre(20);
    dit(fin && fin.etape === 'fait', 'autre sens : des ventes arrivent en base → « fait »', JSON.stringify(fin));
    dit(a.evts('ventes').length === 1, "et l'app est prévenue une fois", JSON.stringify(a.j.evts));
    await vieillir(a, 21000);
    const lus = a.j.vinted.length;
    const ack2 = await a.envoyer(CMD);
    await attendre(30);
    dit(ack2 && ack2.etape === 'recent' && a.j.vinted.length === lus, 'après un succès la garde TIENT : vingt secondes plus tard, « récent », zéro lecture Vinted', `${JSON.stringify(ack2)} · ${a.j.vinted.length - lus} lecture(s)`);
  });

  // ── 5. supabaseUpsert : LE CODE D'UNE ÉCRITURE RATÉE ──────────────────────
  const ligneVente = () => [{ id: `harvest_${UID}_orders_sold`, data: { secret: 'acheteur@exemple.invalid', payload: listeVentes(1) } }];
  await essaie('upsert · 522', async () => {
    const a = faireCtx({ ecriture: (ids) => (ids.includes('panel_diag_capture') ? 201 : 522) });
    const r = await a.ctx.supabaseUpsert('app_data', ligneVente(), 'id');
    await a.calme();
    const k = a.cles().filter((x) => /^ecriture_ratee_/.test(x));
    dit(r === false, 'le contrat ne bouge pas : un refus rend `false`', String(r));
    dit(a.j.posts.filter((p) => p.ids.includes(`harvest_${UID}_orders_sold`)).length === 1, 'un 522 ne se rejoue PAS (une seule écriture : elle a pu passer)', `${a.j.posts.length} écriture(s)`);
    dit(a.compteur('ecriture_ratee_harvest_orders_sold_522') === 1, 'le refus est noté AVEC SON CODE : ecriture_ratee_harvest_orders_sold_522', JSON.stringify(k));
    dit(k.length > 0 && k.every((x) => !/\d{4,}/.test(x.replace(/_\d{3}$/, '')) && !/@|secret|acheteur/.test(x)), "la clé ne porte ni identifiant ni contenu (ni n° de compte, ni corps)", JSON.stringify(k));
  });
  await essaie('upsert · réseau', async () => {
    const a = faireCtx({ ecriture: (ids) => (ids.includes('panel_diag_capture') ? 201 : 'jette') });
    const r = await a.ctx.supabaseUpsert('app_data', [{ id: 'panel_colis_relais', data: {} }], 'id');
    await a.calme();
    dit(r === false && a.compteur('ecriture_ratee_panel_colis_relais_reseau') === 1, 'réseau coupé : `false` et ecriture_ratee_panel_colis_relais_reseau', JSON.stringify(a.cles()));
  });
  await essaie('upsert · succès', async () => {
    const a = faireCtx();
    const r = await a.ctx.supabaseUpsert('app_data', ligneVente(), 'id');
    await a.calme();
    dit(r === true && !a.cles().some((x) => /^ecriture_ratee_/.test(x)), 'autre sens : une écriture acceptée ne note aucun échec', JSON.stringify(a.cles()));
  });
  const SESSION = { access_token: 'jeton-perime', refresh_token: 'r1', expires_at: Date.now() + 3600000, user_id: 'vendeur-1', email: 'essai@exemple.invalid' };
  await essaie('upsert · 401 puis succès', async () => {
    let n = 0;
    const a = faireCtx({ cloisonne: true, session: SESSION, ecriture: (ids) => (ids.includes('panel_diag_capture') ? 201 : (++n === 1 ? 401 : 201)) });
    const r = await a.ctx.supabaseUpsert('app_data', ligneVente(), 'id');
    const vente = a.j.posts.filter((p) => p.ids.includes(`harvest_${UID}_orders_sold`));
    dit(r === true && vente.length === 2 && a.j.refresh === 1, '401 sur base cloisonnée : session renouvelée UNE fois, UN nouvel essai, écriture acceptée', `rendu ${r} · ${vente.length} écriture(s) · ${a.j.refresh} renouvellement(s)`);
    dit(vente.length === 2 && /jeton-neuf/.test(vente[1].auth) && /jeton-perime/.test(vente[0].auth), 'et le nouvel essai part avec le jeton NEUF', vente.map((p) => p.auth).join(' | '));
  });
  await essaie('upsert · 401 deux fois', async () => {
    const a = faireCtx({ cloisonne: true, session: SESSION, ecriture: (ids) => (ids.includes('panel_diag_capture') ? 201 : 401) });
    const r = await a.ctx.supabaseUpsert('app_data', ligneVente(), 'id');
    await a.calme();
    const vente = a.j.posts.filter((p) => p.ids.includes(`harvest_${UID}_orders_sold`));
    dit(r === false && vente.length === 2 && a.compteur('ecriture_ratee_harvest_orders_sold_401') === 1, '401 qui persiste : JAMAIS plus de deux essais, `false`, et ecriture_ratee_…_401', `rendu ${r} · ${vente.length} écriture(s) · ${JSON.stringify(a.cles())}`);
  });
  await essaie('upsert · 503 cloisonné', async () => {
    const a = faireCtx({ cloisonne: true, session: SESSION, ecriture: (ids) => (ids.includes('panel_diag_capture') ? 201 : 503) });
    await a.ctx.supabaseUpsert('app_data', ligneVente(), 'id');
    const vente = a.j.posts.filter((p) => p.ids.includes(`harvest_${UID}_orders_sold`));
    dit(vente.length === 1 && a.j.refresh === 0, 'un 503 ne déclenche ni renouvellement ni nouvel essai', `${vente.length} écriture(s) · ${a.j.refresh} renouvellement(s)`);
  });
  await essaie('tampon de diagnostic', async () => {
    const a = faireCtx({ ecriture: () => 522 });
    await a.ctx.noterDiag('essai_compteur');
    await a.calme();
    const buf = ((a.store.vrmDiagBuf || {}).n) || {};
    dit(a.j.posts.some((p) => p.ids.includes('panel_diag_capture')), "le tampon a bien tenté de partir (sinon le contrôle suivant ne prouverait rien)", JSON.stringify(a.j.posts.map((p) => p.ids)));
    dit(Number(buf.essai_compteur || 0) === 1, "son écriture refusée : le compteur RESTE dans le tampon local (il repartira au tour suivant)", JSON.stringify(buf));
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
