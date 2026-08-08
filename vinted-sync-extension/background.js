// background.js — service worker de l'extension. Deux missions :
//
//  1) CAPTURE DES COMPTES : lit les cookies de session Vinted (access_token_web,
//     refresh_token_web, anon_id) dans TON navigateur — jamais ton mot de passe —
//     et les envoie dans la table Supabase "vinted_accounts". C'est ce qui permet
//     a l'app de savoir quels comptes sont lies.
//
//  2) CAPTURE PASSIVE DES DONNEES : recoit de content.js/inject.js les reponses
//     que Vinted a DEJA envoyees a ton navigateur pendant que tu navigues
//     (annonces, ventes, messages, profil) et les range dans Supabase (table
//     app_data, lignes "harvest_..."). Aucune requete supplementaire vers Vinted
//     n'est faite : on ne fait que ranger ce que tu as deja chargé en naviguant.
//
// Rien n'est envoye a Vinted par l'extension : elle ne parle qu'a Supabase.

const SUPABASE_URL = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

const VINTED_DOMAINS = ['www.vinted.fr', 'www.vinted.com', 'www.vinted.it', 'www.vinted.de'];

// ── COMPTE VENDEUR (multi-vendeurs) ────────────────────────────────────────
// Une fois la base passee en multi-vendeurs, la cle publique « anon » n'a plus
// le droit d'ecrire : chaque ligne doit porter le compte de son proprietaire.
// L'extension ne demande PAS de mot de passe : quand tu ouvres l'app VRM
// connecte, la page transmet sa session a l'extension (bridge.js), qui la
// garde et s'en sert pour ecrire sous ton compte. Si aucune session n'a encore
// ete recue, on retombe sur la cle publique — c'est le mode solo d'aujourd'hui,
// qui continue de marcher a l'identique.
let VRM_SESSION = null;   // { access_token, refresh_token, expires_at, user_id }
const SESSION_STORE = 'vrmSession';

async function loadSession() {
  if (VRM_SESSION) return VRM_SESSION;
  try {
    const got = await chrome.storage.local.get(SESSION_STORE);
    VRM_SESSION = got && got[SESSION_STORE] ? got[SESSION_STORE] : null;
  } catch (_) { VRM_SESSION = null; }
  return VRM_SESSION;
}
async function saveSession(sess) {
  VRM_SESSION = sess || null;
  try {
    if (sess) await chrome.storage.local.set({ [SESSION_STORE]: sess });
    else await chrome.storage.local.remove(SESSION_STORE);
  } catch (_) {}
}
// Le jeton d'acces dure ~1 h ; on le renouvelle tout seul, sinon l'extension
// cesserait d'ecrire des que tu fermes l'app.
async function refreshSession() {
  const s = await loadSession();
  if (!s || !s.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const next = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + ((j.expires_in || 3600) * 1000),
      user_id: (j.user && j.user.id) || s.user_id || null,
    };
    await saveSession(next);
    return next;
  } catch (_) { return null; }
}
async function authToken() {
  let s = await loadSession();
  if (!s) return null;
  if (!s.expires_at || s.expires_at < Date.now() + 60000) s = await refreshSession();
  return s && s.access_token ? s : null;
}
// EST-CE QUE LA BASE SAIT SEPARER LES VENDEURS ?
// Tant que la colonne `owner` n'existe pas, ecrire un `owner` ferait echouer
// TOUTES les captures (400 : colonne inconnue). On teste donc l'etat reel de la
// base, une fois, et on garde la reponse le temps de vie du service worker.
let CLOISONNE = null;   // null = pas encore verifie
async function isCloisonne() {
  if (CLOISONNE !== null) return CLOISONNE;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    CLOISONNE = r.ok;
  } catch (_) { CLOISONNE = false; }
  return CLOISONNE;
}

// En-tetes Supabase : jeton du vendeur UNIQUEMENT si la base sait s'en servir.
// Avant la migration on garde la cle publique — c'est le fonctionnement
// d'aujourd'hui, qui marche.
async function sbHeaders(extra) {
  const cl = await isCloisonne();
  const s = cl ? await authToken() : null;
  return Object.assign({
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${(s && s.access_token) || SUPABASE_KEY}`,
  }, extra || {});
}
// Ajoute le proprietaire a une ligne a ecrire (sans effet avant la migration).
async function withOwner(row) {
  if (!(await isCloisonne())) return row;
  const s = await authToken();
  return (s && s.user_id) ? Object.assign({ owner: s.user_id }, row) : row;
}
// Cible d'upsert sur app_data : la cle devient (owner, id) une fois migre.
async function appDataConflict() {
  if (!(await isCloisonne())) return 'id';
  const s = await authToken();
  return (s && s.user_id) ? 'owner,id' : 'id';
}

// Dernier csrf-token vu par domaine (fourni par inject.js).
const lastCsrfByDomain = {};

// --- Utilitaires -----------------------------------------------------------

function b64urlDecode(str) {
  try {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(atob(s).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch (_) { return null; }
}
function jwtPayload(token) {
  try { const p = token.split('.')[1]; const j = b64urlDecode(p); return j ? JSON.parse(j) : null; } catch (_) { return null; }
}
function getCookie(domain, name) {
  return new Promise((resolve) => {
    try { chrome.cookies.get({ url: `https://${domain}`, name }, (c) => resolve(c ? c.value : null)); }
    catch (_) { resolve(null); }
  });
}

async function supabaseUpsert(table, rows, onConflict) {
  try {
    const list = Array.isArray(rows) ? rows : [rows];
    const owned = [];
    for (const r of list) owned.push(await withOwner(r));
    // Sur app_data la cible du conflit depend du mode (solo / multi-vendeurs).
    let target = onConflict;
    if (table === 'app_data' && onConflict === 'id') target = await appDataConflict();
    if (table === 'vinted_accounts' && onConflict === 'vinted_user_id' && await isCloisonne()) {
      const s = await authToken();
      if (s && s.user_id) target = 'owner,vinted_user_id';
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${target}`, {
      method: 'POST',
      headers: await sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(owned),
    });
    return res.ok;
  } catch (_) { return false; }
}

// --- Capture des comptes ---------------------------------------------------

// Renvoie l'account_id (vinted_user_id) du compte actuellement connecte sur ce
// domaine, decode depuis le cookie access_token_web.
async function activeAccountId(domain) {
  const tok = await getCookie(domain, 'access_token_web');
  if (!tok) return null;
  const p = jwtPayload(tok);
  return p && p.account_id ? String(p.account_id) : null;
}

// ⚠️ COMPTES SUPPRIMÉS DÉFINITIVEMENT (liste vrm_blocked_accounts en base).
// Tant qu'un compte reste connecté dans Chrome, l'extension le re-capte à
// chaque cycle → il « revenait tout le temps » (cas shop_cancale). On lit donc
// cette liste et on NE capte JAMAIS un compte bloqué (et on nettoie sa ligne).
let _blockedAccts = null, _blockedAt = 0;
async function blockedAccounts() {
  if (_blockedAccts && Date.now() - _blockedAt < 300000) return _blockedAccts;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts&select=data`, { headers: await sbHeaders() });
    const rows = res.ok ? await res.json() : [];
    _blockedAccts = new Set((((rows[0] && rows[0].data && rows[0].data.uids) || [])).map(String));
    _blockedAt = Date.now();
  } catch (_) { if (!_blockedAccts) _blockedAccts = new Set(); }
  return _blockedAccts;
}

async function captureDomain(domain) {
  const access = await getCookie(domain, 'access_token_web');
  if (!access) return null;
  const refresh = await getCookie(domain, 'refresh_token_web');
  const anon = await getCookie(domain, 'anon_id');
  const payload = jwtPayload(access);
  const uid = payload && payload.account_id ? String(payload.account_id) : null;
  if (!uid) return null;
  // Compte supprimé définitivement : on ne le re-capte pas et on efface une
  // éventuelle ligne restante, puis on s'arrête là.
  if ((await blockedAccounts()).has(uid)) {
    try { await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, { method: 'DELETE', headers: await sbHeaders() }); } catch (_) {}
    return null;
  }
  const row = {
    vinted_user_id: uid,
    domain,
    access_token: access,
    refresh_token: refresh || null,
    anon_id: anon || null,
    updated_at: new Date().toISOString(),
  };
  if (lastCsrfByDomain[domain]) row.csrf_token = lastCsrfByDomain[domain];
  await supabaseUpsert('vinted_accounts', [row], 'vinted_user_id');
  return uid;
}

async function captureAllAccounts() {
  const results = [];
  for (const d of VINTED_DOMAINS) {
    const uid = await captureDomain(d);
    if (uid) results.push({ domain: d, uid });
  }
  try { chrome.storage.local.set({ lastSync: Date.now(), lastAccounts: results }); } catch (_) {}
  if (results.length) logActivity(`🔑 ${results.length} compte${results.length > 1 ? 's' : ''} synchronisé${results.length > 1 ? 's' : ''}`);
  return results;
}

// ── JOURNAL D'ACTIVITÉ (l'« interface quand je fais des actions ») ───────────
// Petit fil des dernières choses faites par l'extension, montré dans le panneau
// VRM. Anneau de 15 événements dans chrome.storage.local (léger, local).
async function logActivity(text) {
  try {
    const cur = (await chrome.storage.local.get('vrmActivity')).vrmActivity || [];
    cur.unshift({ t: Date.now(), text: String(text || '').slice(0, 90) });
    await chrome.storage.local.set({ vrmActivity: cur.slice(0, 15) });
  } catch (_) {}
}

// --- Capture passive des donnees ------------------------------------------

// Range une donnee moissonnee dans app_data sous une ligne dediee.
async function storeHarvest(domain, type, id, body) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (_) { return; }

  // Cle de ligne app_data selon le type de donnee.
  let rowId;
  if (type === 'conversation' && id) rowId = `harvest_${uid}_conv_${id}`;
  else if (type === 'transaction' && id) rowId = `harvest_${uid}_txn_${id}`;
  else if (type === 'item' && id) rowId = `harvest_${uid}_item_${id}`; // détail complet d'une annonce
  else if (type === 'complaint' && id) rowId = `harvest_${uid}_litige_${id}`; // un litige = une ligne
  else rowId = `harvest_${uid}_${type}`;

  // ⚠️ Cette voie (capture PASSIVE) ecrit en direct, sans passer par
  // storeHarvestRow : l'allegement doit donc etre applique ICI AUSSI, sinon la
  // moisson faite en naviguant reste enorme (7 Mo d'annonces) alors que celle
  // faite activement est allegee. Meme fonction, un seul comportement.
  parsed = alleger(type, parsed);

  const data = { type, uid, domain, capturedAt: new Date().toISOString(), payload: parsed };
  await supabaseUpsert('app_data', [{ id: rowId, data }], 'id');

  // Le profil contient le vrai id de profil (different de l'account_id, utile
  // pour les annonces) et le login. Le vrai id reste disponible dans la ligne
  // harvest_{uid}_profile ci-dessus (l'app le lira). On met juste a jour le
  // pseudo sur la fiche du compte (colonne login, qui existe deja).
  if (type === 'profile' && parsed && parsed.user && parsed.user.login) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, {
        method: 'PATCH',
        headers: await sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ login: parsed.user.login }),
      });
    } catch (_) { /* best-effort */ }
  }
}

// --- Messages venant de content.js ----------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.from !== 'cancale-content') {
    // FRAÎCHEUR : pour chaque compte, quand ses annonces ont-elles été captées
    // pour la dernière fois ? C'est LA question qui compte — un compte capté
    // mais dont le dressing date de trois semaines fait raconter n'importe quoi
    // à l'app (stock fantôme, file Leboncoin fausse, numéros bloqués).
    if (msg && msg.from === 'cancale-popup' && msg.action === 'freshness') {
      (async () => {
        try {
          const accts = await getStoredAccounts();
          // ⚠️ NE PAS SE FIER A `updated_at` : la table n'a pas de trigger, la
          // colonne garde donc la date de CREATION de la ligne. Elle affichait
          // « 25 jours » sur des comptes moissonnes deux heures plus tot.
          // La vraie date de capture est ecrite par nous dans data.capturedAt.
          const rows = await sbGet('app_data?id=like.harvest_*_listings&select=id,updated_at,cap:data->>capturedAt,n:data->payload->pagination->total_entries') || [];
          const parUid = {};
          for (const r of rows) {
            const m = /^harvest_(\d+)_listings$/.exec(r.id); if (!m) continue;
            const t = Date.parse(r.cap || '') || Date.parse(r.updated_at || '');
            if (!isNaN(t)) parUid[m[1]] = { at: t, n: Number(r.n) || 0 };
          }
          const fresh = accts.map(a => {
            const e = parUid[String(a.vinted_user_id)] || {};
            return { uid: String(a.vinted_user_id), login: a.login || '', at: e.at || 0, n: e.n || 0 };
          });
          sendResponse({ ok: true, fresh });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    if (msg && msg.from === 'cancale-popup' && msg.action === 'syncNow') {
      captureAllAccounts().then((r) => { activeFetchAll(); sendResponse({ ok: true, accounts: r }); });
      return true; // reponse asynchrone
    }
    // SESSION DU VENDEUR : relayee par bridge.js depuis l'app connectee.
    // On ne l'accepte QUE d'un onglet de l'app elle-meme (verification de
    // l'origine de l'expediteur) — sinon n'importe quel site pourrait nous
    // refiler un jeton et ecrire sous le compte de quelqu'un d'autre.
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'session') {
      const from = (sender && sender.origin) || (sender && sender.url) || '';
      const trusted = /^https:\/\/(cancale-v67(-ten)?\.vercel\.app|vrm\.center)/.test(from);
      if (!trusted) { sendResponse({ ok: false, error: 'origine non autorisee' }); return true; }
      saveSession(msg.session || null).then(() => sendResponse({ ok: true }));
      return true;
    }

    // PONT APP -> EXTENSION : l'app VRM demande d'EXECUTER une action Vinted
    // (repondre, faire une offre...) depuis TON navigateur/IP. On n'accepte que
    // des endpoints /api/ Vinted, et on agit avec le token du compte vise.
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'exec') {
      (async () => {
        try {
          if (!/^\/api\//.test(msg.endpoint || '')) { sendResponse({ ok: false, error: 'endpoint invalide' }); return; }
          const accts = await getStoredAccounts();
          const acc = accts.find((a) => String(a.vinted_user_id) === String(msg.uid));
          if (!acc) { sendResponse({ ok: false, error: 'compte introuvable' }); return; }
          const r = await vintedSend(acc, msg.method || 'POST', msg.endpoint, msg.body);
          sendResponse({ ok: r.ok, status: r.status, data: r.json });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true; // reponse asynchrone
    }
    // PANNEAU VRM SUR VINTED : vinted-panel.js demande les données de TON app
    // (numéros, garage, paires qui dorment, stats). Lecture Supabase seule —
    // aucune requête vers Vinted, aucune action automatisée sur le site.
    if (msg && msg.from === 'cancale-vpanel') {
      (async () => {
        try {
          if (msg.action === 'panelData') { const r = await buildPanelData(); sendResponse({ ok: true, ...r }); return; }
          if (msg.action === 'saveDate' && msg.id && msg.ts) { await saveListingDate(msg.id, msg.ts, msg.text); sendResponse({ ok: true }); return; }
          if (msg.action === 'saveDetail' && msg.id && msg.detail) { await saveItemDetail(msg.id, msg.detail); sendResponse({ ok: true }); return; }
          if (msg.action === 'aiReply') { const r = await aiReply(msg.message, msg.article, msg.price); sendResponse(r); return; }
          if (msg.action === 'convLastMessage') { const r = await convLastMessage(msg.convId); sendResponse(r); return; }
          if (msg.action === 'markBordDone' && msg.key) { const ok = await markBordDone(msg.key, msg.done); sendResponse({ ok }); return; }
          if (msg.action === 'markPickupDone' && msg.key) { const ok = await markPickupDone(msg.key, msg.done); sendResponse({ ok }); return; }
          sendResponse({ ok: false, error: 'action inconnue' });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    // PONT LEBONCOIN : le script lbc.js (sur leboncoin.fr) demande la liste des
    // annonces Vinted prêtes à publier, ou marque une annonce comme publiée.
    if (msg && msg.from === 'cancale-lbc') {
      (async () => {
        try {
          if (msg.action === 'getQueue') { const r = await buildLbcData(); sendResponse({ ok: true, queue: r.queue, removals: r.removals, stats: r.stats, postedList: r.postedList }); return; }
          if (msg.action === 'setLimit') { await setLbcLimit(msg.limit, msg.plan); sendResponse({ ok: true }); return; }
          if (msg.action === 'getPhotos') { const r = await getPairPhotos(msg.numero); sendResponse({ ok: true, numero: r.numero, title: r.title, photos: r.photos }); return; }
          if (msg.action === 'downloadPhotos' && Array.isArray(msg.urls)) { const nb = await downloadPhotos(msg.urls, msg.numero); sendResponse({ ok: true, count: nb }); return; }
          if (msg.action === 'lbcForm' && Array.isArray(msg.fields)) { await storeLbcRecon({ form: { url: msg.url, fields: msg.fields, at: new Date().toISOString() } }); sendResponse({ ok: true }); return; }
          if (msg.action === 'markPosted' && msg.id) { await markLbcPosted(msg.id); sendResponse({ ok: true }); return; }
          if (msg.action === 'unmarkPosted' && msg.id) { await unmarkLbcPosted(msg.id); sendResponse({ ok: true }); return; }
          if (msg.action === 'markRemoved' && msg.id) { await unmarkLbcPosted(msg.id); sendResponse({ ok: true }); return; }
          if (msg.action === 'lbcCapture') {
            if (Array.isArray(msg.listings) && msg.listings.length) await storeLbcListings(msg.url, msg.listings);
            if (msg.account && msg.account.id) await storeLbcAccount(msg.account);
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcRaw' && msg.body) { await handleLbcRaw(msg.url, msg.body); sendResponse({ ok: true }); return; }
          if (msg.action === 'lbcPaths' && Array.isArray(msg.paths)) { await storeLbcRecon({ paths: msg.paths, url: msg.url }); sendResponse({ ok: true }); return; }
          // ANNONCE EN COURS DE DEPOT : memorisee au clic sur « Tout preparer »,
          // relue par la page de depot qui s'ouvre dans un AUTRE onglet. Sans ce
          // relais, le nouvel onglet ne savait pas quelle paire etait choisie.
          // Duree de vie courte : au-dela de 30 min, on considere que le depot a
          // ete abandonne et on ne pre-remplit pas une annonce oubliee.
          if (msg.action === 'setPending') {
            await chrome.storage.local.set({ vrmPendingAd: msg.ad ? { ad: msg.ad, at: Date.now() } : null });
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'getPending') {
            const g = await chrome.storage.local.get('vrmPendingAd');
            const p = g && g.vrmPendingAd;
            const frais = p && p.at && (Date.now() - p.at) < 30 * 60 * 1000;
            sendResponse({ ok: true, ad: frais ? p.ad : null }); return;
          }
          sendResponse({ ok: false, error: 'action inconnue' });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    return;
  }
  const domain = msg.domain || 'www.vinted.fr';
  if (msg.kind === 'csrf' && msg.csrf) {
    lastCsrfByDomain[domain] = msg.csrf;
    // On rattache le csrf au compte actif (mise a jour legere).
    captureDomain(domain);
  } else if (msg.kind === 'harvest' && msg.body) {
    storeHarvest(domain, msg.type, msg.id, msg.body);
  } else if (msg.kind === 'label' && msg.b64) {
    storeLabel(domain, msg.url, msg.b64);
  } else if (msg.kind === 'receipt' && msg.b64) {
    storeReceipt(domain, msg.url, msg.b64);
  } else if (msg.kind === 'writereq' && msg.url) {
    storeWriteReq(domain, msg.method, msg.url, msg.body);
  } else if (msg.kind === 'seen_urls' && Array.isArray(msg.paths)) {
    storeSeenUrls(domain, msg.paths);
  }
});

// Diagnostic : liste des CHEMINS d'API que le site appelle réellement (aucun
// contenu, aucun paramètre). Sert à repérer tout de suite quand Vinted déplace
// un endpoint — c'est ce qui avait rendu la moisson muette pendant 18 jours.
async function storeSeenUrls(domain, paths) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  const data = { uid, paths: paths.slice(0, 300), capturedAt: new Date().toISOString() };
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_seen_urls`, data }], 'id');
}

// Range une requete d'ECRITURE observee (baisser prix, message...) dans une
// ligne dediee, une par type d'action (regroupee par chemin). Pure observation :
// sert a l'app pour reproduire ensuite l'action exacte en 1 clic, sans deviner.
async function storeWriteReq(domain, method, url, body) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  let path = url;
  try { path = new URL(url, `https://${domain}`).pathname; } catch (_) {}
  // Cle courte par type d'action : on remplace les ids numeriques pour regrouper
  // (ex: /api/v2/items/123 et /api/v2/items/456 -> meme cle).
  const key = (path.replace(/\/\d+/g, '/_id').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60)) || 'root';
  const data = { uid, method, url, path, body: body || '', capturedAt: new Date().toISOString() };
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_wreq_${key}`, data }], 'id');
}

// Range le dernier bordereau (PDF) telecharge, pour que l'app le tamponne.
async function storeLabel(domain, url, b64) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  const data = { uid, url, capturedAt: new Date().toISOString(), pdfB64: b64 };
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_label_latest`, data }], 'id');
  logActivity('📄 Bordereau capté (prêt à imprimer)');
}
// Range le dernier REÇU / FACTURE officiel Vinted (PDF) consulte, pour la compta pro.
async function storeReceipt(domain, url, b64) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  const data = { uid, url, capturedAt: new Date().toISOString(), pdfB64: b64 };
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_receipt_latest`, data }], 'id');
}

// --- FETCH ACTIF (v3) ------------------------------------------------------
// En plus de la capture passive, l'extension va CHERCHER activement les donnees
// de TOUS les comptes lies, depuis TON navigateur / TON IP (jamais un serveur).
// Ainsi l'app est a jour sans que tu ouvres chaque page Vinted, et sans passer
// par le proxy Vercel (IP datacenter = risque). On utilise le token Bearer de
// chaque compte, SANS cookie (credentials:'omit') pour ne pas melanger les
// comptes. Rythme doux : un compte a la fois, avec des pauses.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Un GET Vinted authentifie pour un compte donne (depuis le navigateur).
async function vintedGet(acc, endpoint) {
  try {
    const res = await fetch(`https://${acc.domain || 'www.vinted.fr'}${endpoint}`, {
      method: 'GET',
      credentials: 'omit',
      headers: {
        'Authorization': `Bearer ${acc.access_token}`,
        'x-anon-id': acc.anon_id || '',
        'x-csrf-token': acc.csrf_token || '',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'locale': 'fr-FR',
      },
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, ok: res.ok, json };
  } catch (_) { return { status: 0, ok: false, json: null }; }
}

// Renouvelle le token d'un compte — MAIS uniquement s'il est celui actuellement
// connecte dans le navigateur (le cookie access_token_web decode le meme
// account_id). Dans ce cas on declenche exactement le meme refresh que la page
// Vinted fait d'elle-meme (POST /web/api/auth/refresh, cookies du navigateur) :
// c'est indetectable et ca N'AJOUTE AUCUN signal multi-comptes. Pour un compte
// NON actif, on ne fait RIEN (il se rafraichira quand tu l'ouvriras) — on refuse
// volontairement le refresh de masse qui avait fait bloquer un compte.
// Renvoie l'acc mis a jour (token frais) ou null.
async function refreshIfActive(acc) {
  const domain = acc.domain || 'www.vinted.fr';
  const cookieTok = await getCookie(domain, 'access_token_web');
  if (!cookieTok) return null;
  const p = jwtPayload(cookieTok);
  const cookieUid = p && p.account_id ? String(p.account_id) : null;
  // Garde-fou : on ne rafraichit QUE le compte actuellement actif dans le navigateur.
  if (!cookieUid || cookieUid !== String(acc.vinted_user_id)) return null;
  try {
    const res = await fetch(`https://${domain}/web/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // laisse le navigateur envoyer les cookies du compte actif
      headers: {
        'x-anon-id': acc.anon_id || '',
        'x-csrf-token': acc.csrf_token || lastCsrfByDomain[domain] || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      body: '{}',
    });
    if (!res.ok) return null;
  } catch (_) { return null; }
  await wait(400);
  // Vinted a pose les nouveaux cookies (Set-Cookie applique par le navigateur) :
  // on relit les tokens frais et on les persiste pour l'app + les prochains cycles.
  const newAccess = await getCookie(domain, 'access_token_web');
  const newRefresh = await getCookie(domain, 'refresh_token_web');
  if (!newAccess || newAccess === acc.access_token) return null;
  acc.access_token = newAccess;
  if (newRefresh) acc.refresh_token = newRefresh;
  await supabaseUpsert('vinted_accounts', [{
    vinted_user_id: String(acc.vinted_user_id),
    domain,
    access_token: newAccess,
    refresh_token: newRefresh || acc.refresh_token || null,
    anon_id: acc.anon_id || null,
    updated_at: new Date().toISOString(),
  }], 'vinted_user_id');
  return acc;
}

// Un appel Vinted authentifie AVEC CORPS (POST/PUT/PATCH) pour executer une
// action (repondre, offre, prix...). Meme auth que vintedGet. Sur 401, si le
// compte est l'actif du navigateur, on renouvelle le token et on rejoue.
async function vintedSend(acc, method, endpoint, body) {
  const domain = acc.domain || 'www.vinted.fr';
  const payload = (body != null && String(method).toUpperCase() !== 'GET')
    ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
  const doCall = () => fetch(`https://${domain}${endpoint}`, {
    method: method || 'POST',
    credentials: 'omit',
    headers: {
      'Authorization': `Bearer ${acc.access_token}`,
      'x-anon-id': acc.anon_id || '',
      'x-csrf-token': acc.csrf_token || lastCsrfByDomain[domain] || '',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    body: payload,
  });
  let res = await doCall();
  if (res.status === 401) { const r = await refreshIfActive(acc); if (r) res = await doCall(); }
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, ok: res.ok, json };
}

// Range une reponse Vinted dans une ligne harvest_{uid}_{type} (meme format que
// la capture passive, donc l'app la lit deja).
// ── ON NE RANGE QUE CE QUE L'APP LIT ──────────────────────────────────────
// Mesuré : le dressing de 8 comptes pesait 7,5 Mo, soit ~11 s de chargement sur
// un telephone en 4G, alors que l'app n'utilise qu'une quinzaine de champs par
// article. Vinted renvoie toutes les variantes de photos, les traductions, les
// blocs de promotion... Alleger ici fait tomber le meme contenu a 0,15 Mo (-98 %).
// Les anciennes lignes deja en base restent lisibles : on ne fait qu'enlever des
// champs, jamais en renommer.
const CHAMPS_ARTICLE = ['id','title','price','url','brand_title','size_title','status',
  'view_count','favourite_count','favourites_count','created_at_ts',
  'is_closed','is_hidden','is_draft'];

function photoUtile(it) {
  const p = it.photo || (Array.isArray(it.photos) ? it.photos[0] : null) || null;
  if (!p) return null;
  const url = p.url || (Array.isArray(p.thumbnails) && p.thumbnails[0] && p.thumbnails[0].url) || null;
  if (!url) return null;
  const out = { url };
  const ts = p.high_resolution && p.high_resolution.timestamp;
  if (ts) out.high_resolution = { timestamp: ts };   // sert a dater la mise en ligne
  return out;
}

function articleMaigre(it) {
  const o = {};
  for (const c of CHAMPS_ARTICLE) if (it[c] !== undefined) o[c] = it[c];
  const ph = photoUtile(it); if (ph) o.photo = ph;
  return o;
}

function commandeMaigre(o) {
  const out = {};
  for (const c of ['date','price','title','status','transaction_id','conversation_id','transaction_user_status']) {
    if (o[c] !== undefined) out[c] = o[c];
  }
  const ph = photoUtile(o); if (ph) out.photo = ph;
  return out;
}

function alleger(type, payload) {
  try {
    if (!payload || typeof payload !== 'object') return payload;
    if (type === 'listings' && Array.isArray(payload.items)) {
      return { code: payload.code, pagination: payload.pagination, items: payload.items.map(articleMaigre) };
    }
    if (/^orders/.test(type) && Array.isArray(payload.my_orders)) {
      return { pagination: payload.pagination, order_details_enabled: payload.order_details_enabled,
               my_orders: payload.my_orders.map(commandeMaigre) };
    }
    if (type === 'inbox' && Array.isArray(payload.conversations)) {
      return { pagination: payload.pagination, conversations: payload.conversations.map(c => ({
        id: c.id, description: c.description, unread: c.unread, updated_at: c.updated_at,
        opposite_user: c.opposite_user ? { id: c.opposite_user.id, login: c.opposite_user.login, photo:
          (c.opposite_user.photo && { url: c.opposite_user.photo.url }) || null } : null,
        item_photos: Array.isArray(c.item_photos) ? c.item_photos.slice(0, 1).map(p => ({ url: p && p.url })) : null,
      })) };
    }
    return payload;
  } catch (_) { return payload; }
}

async function storeHarvestRow(uid, type, payload, domain) {
  payload = alleger(type, payload);
  const maintenant = new Date().toISOString();
  const data = { type, uid, domain: domain || 'www.vinted.fr', capturedAt: maintenant, payload };
  // On ecrit AUSSI updated_at : la table n'a pas de trigger, la colonne gardait
  // donc la date de creation de la ligne et faisait passer une moisson de deux
  // heures pour une moisson de 25 jours. `capturedAt` reste la reference cote
  // app, mais autant que la colonne cesse de mentir aux autres lecteurs.
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_${type}`, data, updated_at: maintenant }], 'id');
}

// Recupere TOUTES les pages du dressing. Vinted plafonne per_page a ~96 : sans
// pagination, un compte de 604 articles n'en rendait que 96 et le reste etait
// invisible pour l'app (annonces « disparues », numerotation faussee).
// `getter(path)` renvoie { ok, json } — on branche indifferemment la version a
// jetons ou la version a cookies.
async function fetchAllWardrobe(getter, profileId, maxPages = 10) {
  let out = null;
  for (let page = 1; page <= maxPages; page++) {
    const r = await getter(`/api/v2/wardrobe/${profileId}/items?page=${page}&per_page=100`);
    const lot = r && r.ok && r.json && Array.isArray(r.json.items) ? r.json.items : null;
    if (!lot) break;
    if (!out) out = r.json; else out.items = out.items.concat(lot);
    const tp = r.json.pagination && r.json.pagination.total_pages;
    if (!lot.length || (tp && page >= tp)) break;
    await wait(1200); // rythme d'une navigation humaine
  }
  return out;
}

// Recupere TOUTES les pages de commandes d'un type (ventes/achats), en douceur.
// On s'arrete quand une page est incomplete (derniere) ou au plafond de securite.
async function fetchAllOrders(acc, type, maxPages = 8) {
  let all = []; let pagination = null;
  for (let page = 1; page <= maxPages; page++) {
    const r = await vintedGet(acc, `/api/v2/my_orders?type=${type}&page=${page}&per_page=40`);
    if (!r.ok || !r.json || !Array.isArray(r.json.my_orders)) break;
    all = all.concat(r.json.my_orders);
    pagination = r.json.pagination || pagination;
    if (r.json.my_orders.length < 40) break; // derniere page atteinte
    await wait(1200); // pause entre pages (discret)
  }
  return { my_orders: all, pagination };
}

// Rafraichit toutes les donnees d'UN compte.
async function activeFetchAccount(acc) {
  const uid = acc.vinted_user_id;
  if (!uid || !acc.access_token) return;
  const domain = acc.domain || 'www.vinted.fr';

  // 1) Profil (donne l'id de PROFIL, different de l'account_id, requis pour le
  //    dressing) + le pseudo.
  let prof = await vintedGet(acc, '/api/v2/users/current');
  // Token expire ? Si ce compte est celui actif dans le navigateur, on le
  // renouvelle (comme la page Vinted) puis on rejoue. acc.access_token est
  // mis a jour en place -> tous les appels suivants (annonces/ventes/achats/
  // messages) profitent du token frais. Sinon on laisse tomber sans risque.
  if (prof.status === 401) {
    const refreshed = await refreshIfActive(acc);
    if (refreshed) { await wait(500); prof = await vintedGet(acc, '/api/v2/users/current'); }
  }
  if (prof.ok && prof.json) {
    await storeHarvestRow(uid, 'profile', prof.json, domain);
    const login = prof.json.user && prof.json.user.login;
    if (login) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, {
          method: 'PATCH',
          headers: await sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({ login }),
        });
      } catch (_) {}
    }
  }
  await wait(1500);

  // 2) Annonces en ligne (dressing) via l'ID DE PROFIL.
  const profileId = prof.json && prof.json.user && prof.json.user.id;
  if (profileId) {
    const w = await fetchAllWardrobe((path) => vintedGet(acc, path), profileId);
    if (w && Array.isArray(w.items) && w.items.length) await storeHarvestRow(uid, 'listings', w, domain);
    await wait(1500);
  }

  // 3) Ventes (TOUTES les pages, pour une compta complete).
  const sold = await fetchAllOrders(acc, 'sold');
  if (sold && sold.my_orders.length) await storeHarvestRow(uid, 'orders_sold', sold, domain);
  await wait(1500);

  // 4) Achats (toutes les pages).
  const bought = await fetchAllOrders(acc, 'purchased');
  if (bought && bought.my_orders.length) await storeHarvestRow(uid, 'orders_purchased', bought, domain);
  await wait(1500);

  // 5) Messages (inbox).
  const inbox = await vintedGet(acc, '/api/v2/inbox?page=1&per_page=30');
  if (inbox.ok && inbox.json) await storeHarvestRow(uid, 'inbox', inbox.json, domain);
}

// Recupere la liste des comptes lies depuis Supabase.
async function getStoredAccounts() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=*`, {
      headers: await sbHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (_) { return []; }
}

// Rafraichit TOUS les comptes, un par un, en douceur (pauses entre comptes).
let activeFetchRunning = false;
async function activeFetchAll() {
  if (activeFetchRunning) return;
  activeFetchRunning = true;
  try {
    const accts = await getStoredAccounts();
    for (const acc of accts) {
      await activeFetchAccount(acc);
      await wait(4000); // pause entre comptes (rythme humain, discret)
    }
    try { chrome.storage.local.set({ lastActiveFetch: Date.now(), activeCount: accts.length }); } catch (_) {}
  } finally { activeFetchRunning = false; }
}

// ── FETCH ACTIF PAR COOKIE (v3.8.1) ────────────────────────────────────────
// Vinted a durci son auth : un GET avec token Bearer SANS cookie (ci-dessus)
// est desormais refuse -> plus rien depuis le 13/07. L'auth qui marche est
// celle du navigateur : les COOKIES de session. On refait donc les appels avec
// credentials:'include' (le navigateur envoie les cookies du compte ACTIF).
// ⚠️ Comme les cookies sont ceux du compte actif, on ne rafraichit QUE ce
// compte-la (sinon on rangerait ses donnees sous un autre uid). Les autres se
// mettront a jour quand tu basculeras dessus. C'est aussi le plus discret.
async function activeUidForDomain(domain) {
  const tok = await getCookie(domain, 'access_token_web');
  if (!tok) return null;
  const p = jwtPayload(tok);
  return p && p.account_id ? String(p.account_id) : null;
}
// ID de PROFIL (≠ account_id) deja connu pour ce compte, lu dans la derniere
// ligne harvest_{uid}_profile. Stable dans le temps → sert de repli fiable.
async function lastProfileId(uid) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.harvest_${uid}_profile&select=data`, {
      headers: await sbHeaders(),
    });
    if (!r.ok) return null;
    const rows = await r.json();
    const u = rows[0] && rows[0].data && rows[0].data.payload && rows[0].data.payload.user;
    return u && u.id ? u.id : null;
  } catch (_) { return null; }
}
async function vintedGetCookie(domain, endpoint) {
  try {
    const res = await fetch(`https://${domain}${endpoint}`, {
      method: 'GET',
      credentials: 'include', // ← cookies du compte actif (host permission accordee)
      headers: {
        'x-csrf-token': lastCsrfByDomain[domain] || '',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    let json = null; try { json = await res.json(); } catch (_) {}
    return { status: res.status, ok: res.ok, json };
  } catch (_) { return { status: 0, ok: false, json: null }; }
}
async function fetchAllOrdersCookie(domain, type, maxPages = 8) {
  let all = []; let pagination = null;
  for (let page = 1; page <= maxPages; page++) {
    const r = await vintedGetCookie(domain, `/api/v2/my_orders?type=${type}&page=${page}&per_page=40`);
    if (!r.ok || !r.json || !Array.isArray(r.json.my_orders)) break;
    all = all.concat(r.json.my_orders);
    pagination = r.json.pagination || pagination;
    if (r.json.my_orders.length < 40) break;
    await wait(1200);
  }
  return { my_orders: all, pagination };
}
// ── FETCH ACTIF DANS LA PAGE (v3.8.2) ──────────────────────────────────────
// Le cookie de session Vinted est SameSite : le navigateur ne l'attache PAS a
// une requete lancee par l'extension (service worker). Il n'est valide que dans
// le contexte de la PAGE vinted.fr (premiere partie). Donc : au lieu d'appeler
// depuis le service worker, on INJECTE le fetch dans un onglet Vinted deja
// ouvert et on l'y fait executer. La requete part alors de la page, avec ses
// cookies, exactement comme si tu cliquais — et sans que tu recharges rien.
async function pageActiveFetch() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: ['https://*.vinted.fr/*', 'https://*.vinted.com/*'] }); } catch (_) { return false; }
  const tab = tabs.find((t) => t && t.id != null && !t.discarded && t.status === 'complete') || tabs.find((t) => t && t.id != null && !t.discarded);
  if (!tab) return false; // aucun onglet Vinted exploitable
  const domain = (() => { try { return new URL(tab.url).host; } catch (_) { return 'www.vinted.fr'; } })();
  const csrf = lastCsrfByDomain[domain] || '';
  // ID de profil connu (stable) du compte actif, lu dans la derniere moisson :
  // sert de repli si /users/current echoue (c'est ce qui bloquait le dressing).
  const activeUid0 = await activeUidForDomain(domain);
  let knownPid = null;
  if (activeUid0) { try { knownPid = await lastProfileId(activeUid0); } catch (_) {} }
  let out = null;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      args: [csrf, knownPid],
      func: async (csrfTok, knownPidArg) => {
        const get = async (p) => {
          try {
            const h = { accept: 'application/json' };
            if (csrfTok) h['x-csrf-token'] = csrfTok;
            const r = await fetch(p, { credentials: 'include', headers: h });
            if (!r || !r.ok) return null;
            return await r.json();
          } catch (_) { return null; }
        };
        const who = await get('/api/v2/users/current');
        const pid = (who && who.user && who.user.id) || knownPidArg; // repli sur l'id connu
        // ⚠️ TOUTES LES PAGES, pas seulement la premiere. Constate en base : un
        // compte annoncait 604 articles sur 7 pages et l'app n'en voyait que 96
        // — les autres etaient invisibles (annonces « disparues », numerotation
        // faussee). Vinted plafonne per_page a ~96, donc il FAUT paginer.
        let listings = null;
        if (pid) {
          const MAX_PAGES = 10;               // garde-fou
          for (let pg = 1; pg <= MAX_PAGES; pg++) {
            const r = await get('/api/v2/wardrobe/' + pid + '/items?page=' + pg + '&per_page=100');
            const lot = r && Array.isArray(r.items) ? r.items : null;
            if (!lot) break;
            if (!listings) listings = r; else listings.items = listings.items.concat(lot);
            const tp = r.pagination && r.pagination.total_pages;
            if (!lot.length || (tp && pg >= tp)) break;
            // Petite pause : on reste sur le rythme d'une navigation humaine.
            await new Promise(res => setTimeout(res, 700));
          }
        }
        const sold = await get('/api/v2/my_orders?type=sold&page=1&per_page=100');
        const bought = await get('/api/v2/my_orders?type=purchased&page=1&per_page=100');
        const inbox = await get('/api/v2/inbox?page=1&per_page=30');
        // PORTE-MONNAIE. Julien : « l'extension n'a pas moyen de capter tout
        // Vinted sans que j'aie besoin de tout ouvrir ? » — si, justement.
        // Le solde (dispo + BLOQUE) vient de /users/{id}/payouts. Sans ca, il
        // fallait ouvrir le porte-monnaie de chaque compte a la main pour que
        // la capture passive le voie : 5 comptes sur 7 n'avaient donc aucun
        // solde. Un appel de plus, depuis SON navigateur, sur une page ou il
        // est deja connecte — c'est le meme profil de trafic qu'une visite.
        const wallet = pid ? await get('/api/v2/users/' + pid + '/payouts') : null;
        return { who: who || null, listings: listings || null, sold: sold || null, bought: bought || null, inbox: inbox || null, wallet: wallet || null };
      },
    });
    out = res && res[0] && res[0].result;
  } catch (_) { return false; }
  if (!out) return false;
  // On range sous l'uid du COMPTE ACTIF (decode du cookie de session).
  const uid = await activeUidForDomain(domain);
  if (!uid) return false;
  let stored = false;
  // ⚠️ NE JAMAIS ECRASER UNE MOISSON PAR DU VIDE. Une session expiree, une
  // page pas encore chargee ou un appel refuse renvoient une LISTE VIDE, pas
  // une erreur : en rangeant ce vide, on effacait des donnees valides et
  // l'onglet Ventes se retrouvait desesperement vide alors que les ventes
  // existaient. C'est exactement ce qui etait arrive aux 10 comptes.
  const plein = (o, cle) => o && Array.isArray(o[cle]) && o[cle].length > 0;
  if (out.who) { await storeHarvestRow(uid, 'profile', out.who, domain); stored = true; }
  if (plein(out.listings, 'items')) { await storeHarvestRow(uid, 'listings', out.listings, domain); stored = true; }
  if (plein(out.sold, 'my_orders')) { await storeHarvestRow(uid, 'orders_sold', out.sold, domain); stored = true; }
  if (plein(out.bought, 'my_orders')) { await storeHarvestRow(uid, 'orders_purchased', out.bought, domain); stored = true; }
  if (plein(out.inbox, 'conversations')) { await storeHarvestRow(uid, 'inbox', out.inbox, domain); stored = true; }
  // Le solde n'est pas une liste : on le range des qu'il porte un montant.
  if (out.wallet && (out.wallet.main || out.wallet.escrow)) { await storeHarvestRow(uid, 'billing', out.wallet, domain); stored = true; }
  if (stored) { try { chrome.storage.local.set({ lastActiveFetch: Date.now(), activeUid: uid, via: 'page' }); } catch (_) {} }
  return stored;
}

let cookieFetchRunning = false;
async function activeFetchActiveAccount() {
  if (cookieFetchRunning) return false;
  cookieFetchRunning = true;
  try {
    const domain = 'www.vinted.fr';
    const uid = await activeUidForDomain(domain);
    if (!uid) return false; // aucun compte connecte dans le navigateur
    const prof = await vintedGetCookie(domain, '/api/v2/users/current');
    if (!prof.ok || !prof.json) return false; // pas connecte / endpoint change
    await storeHarvestRow(uid, 'profile', prof.json, domain);
    const profileId = prof.json.user && prof.json.user.id;
    await wait(1200);
    if (profileId) {
      const w = await fetchAllWardrobe((path) => vintedGetCookie(domain, path), profileId);
      if (w && Array.isArray(w.items) && w.items.length) await storeHarvestRow(uid, 'listings', w, domain);
      await wait(1200);
    }
    const sold = await fetchAllOrdersCookie(domain, 'sold');
    if (sold && sold.my_orders.length) await storeHarvestRow(uid, 'orders_sold', sold, domain);
    await wait(1200);
    const bought = await fetchAllOrdersCookie(domain, 'purchased');
    if (bought && bought.my_orders.length) await storeHarvestRow(uid, 'orders_purchased', bought, domain);
    await wait(1200);
    const inbox = await vintedGetCookie(domain, '/api/v2/inbox?page=1&per_page=30');
    if (inbox.ok && inbox.json) await storeHarvestRow(uid, 'inbox', inbox.json, domain);
    try { chrome.storage.local.set({ lastActiveFetch: Date.now(), activeUid: uid }); } catch (_) {}
    return true;
  } finally { cookieFetchRunning = false; }
}

// --- Declencheurs ----------------------------------------------------------

// Au demarrage / installation : on capte les comptes PUIS on rafraichit le
// compte ACTIF par cookie (fiable). L'ancien fetch Bearer reste en secours pour
// les autres comptes, mais il echoue tant que Vinted refuse le Bearer-sans-cookie.
async function runActive() { if (await pageActiveFetch()) return; if (await activeFetchActiveAccount()) return; await activeFetchAll(); }
function fullSync() { captureAllAccounts().then(() => runActive()); }

chrome.runtime.onInstalled.addListener(() => { fullSync(); });
chrome.runtime.onStartup.addListener(() => { fullSync(); });

try {
  // Capture des comptes toutes les 10 min ; fetch actif toutes les 20 min
  // (assez pour etre a jour, assez espace pour rester discret).
  chrome.alarms.create('cancale-sync', { periodInMinutes: 10 });
  chrome.alarms.create('cancale-active', { periodInMinutes: 20 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === 'cancale-sync') captureAllAccounts();
    else if (a.name === 'cancale-active') runActive();
  });
} catch (_) {}

// Recapture immediatement quand un cookie de session Vinted change (login,
// refresh...). Debounce pour eviter les rafales.
let cookieTimer = null;
try {
  chrome.cookies.onChanged.addListener((info) => {
    const dom = info && info.cookie && info.cookie.domain ? info.cookie.domain.replace(/^\./, '') : '';
    const name = info && info.cookie ? info.cookie.name : '';
    if (!VINTED_DOMAINS.includes(dom)) return;
    if (name !== 'access_token_web' && name !== 'refresh_token_web') return;
    clearTimeout(cookieTimer);
    // Changement de session (login / bascule de compte) : on recapte le compte
    // ET on rafraichit ses donnees par cookie dans la foulee.
    cookieTimer = setTimeout(() => { captureDomain(dom).then(() => runActive()); }, 2000);
  });
} catch (_) {}

// ═══════════════════════════════════════════════════════════════════════════
// LEBONCOIN — préparation des annonces à publier (assistant, jamais d'auto-post)
// On lit les annonces Vinted EN LIGNE + leur détail complet (déjà moissonnés),
// on construit une annonce Leboncoin prête (titre, description avec le N°, prix,
// catégorie, photos) et on la propose dans le panneau lbc.js. La publication
// reste un geste HUMAIN (tu cliques « Publier » sur Leboncoin).
// ═══════════════════════════════════════════════════════════════════════════
// ── PANNEAU VRM SUR VINTED ──────────────────────────────────────────────────
// Agrège, POUR TOI, ce que ton app sait déjà : le numéro de chaque annonce, son
// prix d'achat, sa case au garage, et les paires « qui dorment » (en ligne
// depuis longtemps) à relancer à la main. 100 % lecture Supabase : aucun appel
// à Vinted, aucun clic automatisé. Le panneau AFFICHE, c'est toi qui agis.
// Mémorise la date de mise en ligne lue sur la page de l'annonce (« Ajouté il
// y a … »), dans une seule ligne app_data `vinted_listing_dates` = { id: ts }.
// C'est la SEULE source de l'ancienneté réelle : Vinted ne la renvoie pas dans
// les données du dressing. Elle se remplit au fil de ta navigation.
async function saveListingDate(id, ts, text) {
  const rows = await sbGet('app_data?id=eq.vinted_listing_dates&select=data');
  const cur = (rows && rows[0] && rows[0].data) || {};
  const key = String(id);
  // On ne réécrit pas une date déjà connue (la 1re lecture est la plus proche
  // de la vérité ; « il y a 3 mois » lu plus tard donnerait la même chose).
  if (cur[key] && cur[key].ts) return;
  cur[key] = { ts: Number(ts), text: String(text || '').slice(0, 60), readAt: new Date().toISOString() };
  await supabaseUpsert('app_data', [{ id: 'vinted_listing_dates', data: cur }], 'id');
}

// Mémorise la DESCRIPTION et les PHOTOS lues sur la page de l'annonce, dans
// app_data `vinted_item_details` = { id: {description, photos, readAt} }.
// Sert (1) aux annonces Leboncoin (vraie description au lieu d'un texte
// générique) et (2) d'archive de tes textes/photos.
async function saveItemDetail(id, detail) {
  const rows = await sbGet('app_data?id=eq.vinted_item_details&select=data');
  const cur = (rows && rows[0] && rows[0].data) || {};
  const key = String(id);
  const prev = cur[key] || {};
  const desc = String(detail.description || '').trim();
  const photos = Array.isArray(detail.photos) ? detail.photos.filter(Boolean).slice(0, 20) : [];
  // On complète sans écraser par du vide (une relecture partielle ne doit pas
  // effacer une description déjà captée).
  cur[key] = {
    description: desc || prev.description || '',
    photos: photos.length ? photos : (prev.photos || []),
    readAt: new Date().toISOString(),
  };
  await supabaseUpsert('app_data', [{ id: 'vinted_item_details', data: cur }], 'id');
}

// ── « TRAITER » un bordereau DEPUIS LE PANNEAU ───────────────────────────────
// Julien clique « ✓ Traiter » sur un bordereau à imprimer : on le mémorise dans
// une ligne DÉDIÉE `panel_bords_done` (= { key: ts }). ⚠️ On n'écrit JAMAIS dans
// la ligne `main` de l'app (un upsert y remplacerait TOUT le blob et pourrait
// écraser une sauvegarde de l'app faite en parallèle). Cette ligne est un
// « courrier » à sens unique : le panneau la lit pour cacher le bordereau tout
// de suite (buildPanelData), et l'app la vide dans `vinted_bords_shipped` à son
// chargement. La clé est la même que côté app (transaction || suivi || numero).
async function markBordDone(key, done) {
  const k = String(key || '').trim();
  if (!k) return false;
  const rows = await sbGet('app_data?id=eq.panel_bords_done&select=data');
  const cur = (rows && rows[0] && rows[0].data) || {};
  if (done === false) delete cur[k];
  else cur[k] = Date.now();
  return await supabaseUpsert('app_data', [{ id: 'panel_bords_done', data: cur }], 'id');
}

// « ✓ Récupéré » un colis à retirer depuis le panneau. Même principe que
// markBordDone : ligne DÉDIÉE `panel_colis_collected` = { colisKey: ts }, jamais
// `main`. Le panneau la relit pour vider la liste ; l'app la LIT comme source de
// « déjà récupéré » supplémentaire. Clé = `suivi || subject` (comme `colisKey`).
async function markPickupDone(key, done) {
  const k = String(key || '').trim();
  if (!k) return false;
  const rows = await sbGet('app_data?id=eq.panel_colis_collected&select=data');
  const cur = (rows && rows[0] && rows[0].data) || {};
  if (done === false) delete cur[k];
  else cur[k] = Date.now();
  return await supabaseUpsert('app_data', [{ id: 'panel_colis_collected', data: cur }], 'id');
}

// ── ASSISTANT DE RÉPONSE (spec « Messaging Intelligence ») ───────────────────
// Le panneau relaie le message de l'acheteur ; on le passe à /api/ai (mode
// reply), qui renvoie une intention + des réponses suggérées. ⚠️ On n'ENVOIE
// RIEN sur Vinted : Julien relit, choisit, adapte et envoie LUI-MÊME (assistance
// stricte, conforme). La clé de l'IA reste côté serveur (Vercel), jamais ici.
const VRM_APP_API = 'https://cancale-v67-ten.vercel.app';
async function aiReply(message, article, price) {
  try {
    const r = await fetch(`${VRM_APP_API}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'reply', message: String(message || '').slice(0, 1000), article: String(article || '').slice(0, 160), price }),
    });
    const j = await r.json().catch(() => ({}));
    return (j && typeof j === 'object') ? j : { ok: false, reason: 'network' };
  } catch (e) { return { ok: false, reason: 'network', detail: String(e) }; }
}

// Dernier message de l'ACHETEUR dans une conversation déjà captée
// (harvest_{uid}_conv_{convId}) → pour pré-remplir l'assistant de réponse sans
// que Julien copie-colle. On lit la donnée moissonnée (fiable), pas la page.
async function convLastMessage(convId) {
  try {
    const rows = await sbGet(`app_data?id=like.harvest_*_conv_${encodeURIComponent(String(convId))}&select=data`) || [];
    for (const r of rows) {
      const conv = r.data && r.data.payload && r.data.payload.conversation;
      if (!conv || !Array.isArray(conv.messages)) continue;
      const oppId = conv.opposite_user && conv.opposite_user.id;
      let last = null;
      for (const m of conv.messages) {
        if ((m.entity_type || '') !== 'message') continue;
        const e = m.entity || {};
        if (oppId != null && e.user_id !== oppId) continue; // uniquement les messages de l'acheteur
        if (e.body) last = e.body;
      }
      if (last) return { ok: true, message: String(last).slice(0, 1000), article: conv.description || '' };
    }
    return { ok: false };
  } catch (_) { return { ok: false }; }
}

async function buildPanelData() {
  const rows = await sbGet('app_data?id=eq.main&select=data');
  const d = (rows && rows[0] && rows[0].data) || {};
  const numeros = d.vinted_annonce_numeros || {};
  const grid = d.vinted_garage_grid || {};
  // Case du garage par numéro (grille 2D : { "A1": ["12","34"], … }).
  const cellByNum = {};
  for (const cell in grid) {
    const vals = Array.isArray(grid[cell]) ? grid[cell] : [];
    for (const v of vals) { const t = String(v || '').trim(); if (t) cellByNum[t] = cell; }
  }
  // Annonces réellement en ligne, depuis la moisson (par compte).
  // Dates de mise en ligne lues sur les pages d'annonce (voir saveListingDate).
  const drows = await sbGet('app_data?id=eq.vinted_listing_dates&select=data');
  const listingDates = (drows && drows[0] && drows[0].data) || {};
  // Descriptions/photos lues sur les pages d'annonce (pour Leboncoin + archive).
  const detRows = await sbGet('app_data?id=eq.vinted_item_details&select=data');
  const pageDetails = (detRows && detRows[0] && detRows[0].data) || {};
  const lst = await sbGet('app_data?id=like.harvest_*_listings&select=id,data') || [];
  const online = [];
  const seen = new Set();
  for (const r of lst) {
    const p = (r.data && r.data.payload) || {};
    for (const it of (p.items || [])) {
      if (it.is_closed || it.is_hidden || it.is_draft) continue;
      const id = String(it.id); if (seen.has(id)) continue; seen.add(id);
      const e = numeros[id] || null;
      // Ancienneté RÉELLE : la date « Ajouté il y a … » lue sur la page de
      // l'annonce prime (seule source fiable). Sinon la date Vinted si un jour
      // elle apparaît dans le dressing. On n'utilise PAS la date de
      // numérotation : elle dit quand TU as numéroté, pas depuis quand c'est
      // en ligne — ça donnait une ancienneté fausse.
      let ts = listingDates[id] && listingDates[id].ts ? Number(listingDates[id].ts) : null;
      if (!ts) {
        const raw = it.created_at_ts || it.created_at || it.createdAt;
        if (raw != null) { const n = Number(raw); ts = isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(raw) || null; }
      }
      const ageDays = ts ? Math.floor((Date.now() - ts) / 86400000) : null;
      const numero = e && e.numero ? String(e.numero) : null;
      online.push({
        id, title: it.title || '', url: it.url || `https://www.vinted.fr/items/${id}`,
        price: (it.price && (it.price.amount != null ? it.price.amount : it.price)) ?? null,
        photo: (it.photo && it.photo.url) || (it.photos && it.photos[0] && it.photos[0].url) || null,
        views: it.view_count != null ? it.view_count : null,
        favs: it.favourite_count != null ? it.favourite_count : null,
        numero, buyPrice: e && e.buyPrice != null ? e.buyPrice : null,
        cell: numero ? (cellByNum[numero] || null) : null,
        ageDays,
        hasDesc: !!(pageDetails[id] && pageDetails[id].description),
        nPhotos: (pageDetails[id] && (pageDetails[id].photos || []).length) || 0,
      });
    }
  }
  // « À relancer » : le signal FIABLE est le ratio favoris/vues, pas l'âge.
  // (Vinted ne donne pas la date de mise en ligne dans le dressing, et la date
  // de numérotation ne mesure que le moment où TU as numéroté la paire.)
  // Une annonce très vue mais peu mise en favori par rapport à TES propres
  // annonces = prix probablement trop haut → candidate à une baisse. Le seuil
  // est calculé sur ta médiane, pas sur une valeur arbitraire.
  const rated = online.filter(o => o.views != null && o.views >= 40);
  let relance = [];
  if (rated.length >= 5) {
    const ratios = rated.map(o => (o.favs || 0) / o.views).sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    const seuil = median * 0.5;
    relance = rated.filter(o => (o.favs || 0) / o.views < seuil)
                   .sort((a, b) => b.views - a.views)
                   .map(o => ({ ...o, ratio: (o.favs || 0) / o.views }));
  }
  const noNum = online.filter(o => !o.numero);
  // ── VENTES À EXPÉDIER : le bordereau à générer (assistance, pas d'auto-clic) ──
  // On lit les ventes moissonnées au statut « bordereau envoyé au vendeur » /
  // « paiement validé », et on te les liste avec un bouton UN TAP « Générer ». On
  // NE clique PAS à ta place sur Vinted (ce motif fait bloquer les comptes) : tu
  // ouvres, tu génères d'un clic, et l'extension capte le PDF automatiquement.
  const awaitingShip = (s) => /bordereau\s+envoy[ée]\s+au\s+vendeur/i.test(s || '') || /paiement.*valid/i.test(s || '');
  const soldRows = await sbGet('app_data?id=like.harvest_*_orders_sold&select=data') || [];
  const bordRows = await sbGet("app_data?id=like.email_bord_*&select=transaction:data->>transaction") || [];
  const bordTxns = new Set(bordRows.map(b => String(b.transaction || '')).filter(Boolean));
  const toShip = [];
  const seenTx = new Set();
  for (const r of soldRows) {
    const orders = (r.data && r.data.payload && r.data.payload.my_orders) || [];
    for (const o of orders) {
      if (!awaitingShip(o.status)) continue;
      const tx = String(o.transaction_id || '');
      if (tx && seenTx.has(tx)) continue; if (tx) seenTx.add(tx);
      toShip.push({
        transaction: tx, title: o.title || '', status: o.status || '',
        photo: o.photo || o.photo_url || null,
        price: (o.price && (o.price.amount != null ? o.price.amount : o.price)) ?? null,
        conv: o.conversation_id != null ? String(o.conversation_id) : null,
        url: tx ? `https://www.vinted.fr/member/transactions/${tx}` : (o.conversation_id ? `https://www.vinted.fr/inbox/${o.conversation_id}` : 'https://www.vinted.fr/member/transactions?type=sold'),
        hasBord: tx ? bordTxns.has(tx) : false,
      });
    }
  }
  // ── ACHATS À RETIRER (colis en point relais) — AVEC LE CODE DE RETRAIT ───────
  // Source = les emails de suivi `email_track_*` (transporteur → « colis
  // disponible »), car c'est la SEULE source qui porte le CODE, le point relais et
  // le QR. Les achats moissonnés (statut Vinted) n'ont pas de code, et les relier
  // par titre serait une devinette (cf. §24 « plus aucune devinette »).
  // Même règle que l'app (`isColisRetirable`) : status='available', dans les 14
  // jours, ET (un lieu OU un code 3-8 chiffres). Clé = `suivi || subject`
  // (`colisKey` de l'app). Exclut ceux déjà « retirés » — par l'app
  // (`vrm_colis_collected`) OU depuis le panneau (`panel_colis_collected`).
  const PICKUP_MAX_DAYS = 14;
  const collectedApp = new Set((Array.isArray(d.vrm_colis_collected) ? d.vrm_colis_collected : []).map(String));
  const pcRows = await sbGet('app_data?id=eq.panel_colis_collected&select=data');
  const collectedPanel = new Set(Object.keys((pcRows && pcRows[0] && pcRows[0].data) || {}));
  const trackRows = await sbGet("app_data?id=like.email_track_*&select=suivi:data->>suivi,subject:data->>subject,status:data->>status,code:data->>code,code2:data->>code2,lieu:data->>lieu,artTitle:data->>artTitle,carrier:data->>carrier,qrUrl:data->>qrUrl,receivedAt:data->>receivedAt") || [];
  const pickups = [];
  const seenPk = new Set();
  for (const t of trackRows) {
    if (String(t.status || '') !== 'available') continue;
    const code = String(t.code || '').trim();
    const hasCode = /^\d{3,8}$/.test(code);
    const hasLieu = !!String(t.lieu || '').trim();
    if (!hasCode && !hasLieu) continue; // pas identifiable → écarté
    const d2 = Date.parse(t.receivedAt || '');
    if (!isNaN(d2) && (Date.now() - d2) / 86400000 > PICKUP_MAX_DAYS) continue; // trop vieux
    const key = String(t.suivi || t.subject || '').trim();
    if (!key || seenPk.has(key)) continue; seenPk.add(key);
    if (collectedApp.has(key) || collectedPanel.has(key)) continue;
    pickups.push({
      key, title: t.artTitle || '', carrier: t.carrier || '',
      code: hasCode ? code : '', code2: String(t.code2 || '').trim() || '',
      lieu: String(t.lieu || '').trim(), qrUrl: t.qrUrl || '', suivi: String(t.suivi || '').trim(),
    });
  }
  // ── CONVERSATIONS (inbox) : pour l'onglet Messages (relance guidée) ──────────
  // Tu sélectionnes des conversations, l'extension t'ouvre chacune une par une,
  // TU réponds toi-même (aucun message envoyé automatiquement).
  const inboxRows = await sbGet('app_data?id=like.harvest_*_inbox&select=data') || [];
  const convs = [];
  const seenC = new Set();
  for (const r of inboxRows) {
    const arr = (r.data && r.data.payload && r.data.payload.conversations) || [];
    for (const c of arr) {
      const id = String(c.id || ''); if (!id || seenC.has(id)) continue; seenC.add(id);
      const ou = c.opposite_user || {};
      const ophoto = ou.photo && (ou.photo.url || ou.photo);
      const iphoto = c.item_photos && c.item_photos[0] && (c.item_photos[0].url || c.item_photos[0]);
      convs.push({
        id, title: c.description || '', unread: !!c.unread,
        login: ou.login || '', photo: ophoto || iphoto || null,
        url: `https://www.vinted.fr/inbox/${id}`, updated: c.updated_at || null,
      });
    }
  }
  convs.sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0));
  // ── BORDEREAUX À IMPRIMER : reçus par email (avec PDF), pas encore imprimés/
  //    expédiés/masqués, avec le N° de la paire + le titre (comme dans l'app). ──
  const bp = await sbGet("app_data?id=like.email_bord_*&select=numero:data->>numero,modele:data->>modele,article:data->>article,transaction:data->>transaction,suivi:data->>suivi,filename:data->>filename,dateLimite:data->>dateLimite") || [];
  const bPrinted = d.vinted_bords_printed || {};
  const bShipped = d.vinted_bords_shipped || {};
  const bHidden = d.vinted_bords_hidden || {};
  // Bordereaux « traités » depuis le panneau (ligne dédiée, pas encore drainée
  // par l'app) → on les cache tout de suite, sans attendre la synchro de l'app.
  const pdoneRows = await sbGet('app_data?id=eq.panel_bords_done&select=data');
  const bDonePanel = (pdoneRows && pdoneRows[0] && pdoneRows[0].data) || {};
  const bKey = (b) => String(b.transaction || b.suivi || b.numero || '');
  const bordsToPrint = bp
    .filter(b => b.filename) // a bien un PDF
    .map(b => ({ numero: b.numero || '', title: b.modele || b.article || '', transaction: b.transaction || '', dateLimite: b.dateLimite || '', key: bKey(b) }))
    .filter(b => b.key && !bPrinted[b.key] && !bShipped[b.key] && !bHidden[b.key] && !bDonePanel[b.key]);
  // « Qui dorment » : ancienneté RÉELLE (date lue sur la page de l'annonce).
  // Ne compte que les annonces dont on connaît la date — pas de faux chiffre.
  const sleeping = online.filter(o => o.ageDays != null && o.ageDays >= 30)
                         .sort((a, b) => b.ageDays - a.ageDays);
  const datesKnown = online.filter(o => o.ageDays != null).length;
  const stats = {
    online: online.length,
    relance: relance.length,
    sleeping: sleeping.length,
    datesKnown,
    noNum: noNum.length,
    withDesc: online.filter(o => o.hasDesc).length,
    value: online.reduce((s, o) => s + (Number(o.price) || 0), 0),
    toShip: toShip.filter(t => !t.hasBord).length,
    toPrint: bordsToPrint.length,
    toPickup: pickups.length,
    unread: convs.filter(c => c.unread).length,
    favoris: online.filter(o => (o.favs || 0) > 0).length,
  };
  // Fraîcheur : la capture la plus récente parmi les données lues → l'utilisateur
  // sait si ses infos datent (et s'il doit repasser sur Vinted pour les capter).
  let freshestAt = 0;
  const trackFresh = (rows) => { for (const r of (rows || [])) { const t = Date.parse((r.data && r.data.capturedAt) || '') || 0; if (t > freshestAt) freshestAt = t; } };
  trackFresh(lst); trackFresh(soldRows); trackFresh(inboxRows);
  const activity = (await chrome.storage.local.get('vrmActivity')).vrmActivity || [];
  // Réponses rapides déjà enregistrées dans l'app (synchronisées) → insérables en
  // 1 tap depuis le panneau, sur une conversation.
  const quickReplies = Array.isArray(d.vinted_quick_replies) ? d.vinted_quick_replies.slice(0, 20) : [];
  // Chiffres PUBLIÉS PAR L'APP (ligne widget_stats) → on les affiche tels quels
  // dans « Ma journée » pour ne jamais recalculer un CA qui divergerait de l'app.
  // Mis à jour quand Julien ouvre l'app : on montre la fraîcheur, pas de bluff.
  const wsRows = await sbGet('app_data?id=eq.widget_stats&select=data');
  const appStats = (wsRows && wsRows[0] && wsRows[0].data) || null;
  const goal = Number(d.vinted_goal) || 0; // objectif de CA mensuel fixé dans l'app
  return { online, relance, sleeping, noNum, toShip, pickups, bordsToPrint, convs, activity, quickReplies, appStats, goal, freshestAt, stats, byId: Object.fromEntries(online.map(o => [o.id, o])) };
}

async function sbGet(query) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: await sbHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}
// Correspondance de catégorie Vinted → Leboncoin. La boutique = sneakers → la
// catégorie Leboncoin est « Chaussures » (Mode). On garde une logique simple et
// extensible (vêtements/accessoires si un jour d'autres articles).
function lbcCategory(det, raw) {
  const t = ((det.title || raw.title || '') + ' ' + (det.description || '')).toLowerCase();
  if (/(sac|sacoche|bandouli|cabas)/.test(t)) return 'Sacs à main';
  if (/(veste|manteau|pull|t-?shirt|chemise|jean|pantalon|robe|short|sweat|hoodie)/.test(t)) return 'Vêtements';
  if (/(casquette|bonnet|ceinture|montre|lunettes|écharpe|gants)/.test(t)) return 'Accessoires & Bagagerie';
  return 'Chaussures';
}
function firstDefined(...v) { for (const x of v) if (x !== undefined && x !== null && x !== '') return x; return ''; }
function buildLbcAd(raw, det, num, account) {
  const brand = firstDefined(det.brand_dto && det.brand_dto.title, raw.brand_title, det.brand, raw.brand);
  const base = String(firstDefined(det.title, raw.title)).trim();
  const size = String(firstDefined(det.size, det.size_title, raw.size_title, raw.size)).trim();
  const cond = String(firstDefined(det.status, raw.status)).trim();
  const color = [firstDefined(det.color1, raw.color1), firstDefined(det.color2, raw.color2)].filter(Boolean).join(' ').trim();
  const price = String(firstDefined(det.price && det.price.amount, raw.price && raw.price.amount, raw.price, det.price)).replace(',', '.');
  const desc0 = String(firstDefined(det.description, '')).trim();
  // Photos HD
  let photos = [];
  const ph = det.photos || raw.photos || [];
  if (Array.isArray(ph)) photos = ph.map((p) => firstDefined(p.full_size_url, p.url, typeof p === 'string' ? p : '')).filter(Boolean);
  if (!photos.length && raw.photo && raw.photo.url) photos = [raw.photo.url];
  // Titre Leboncoin (≤ 50 caractères, avec des termes qui « ressortent »)
  let title = [brand, base].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (size && !/taille|t\s?\d/i.test(title)) title += ' T' + size;
  if (title.length > 50) title = title.slice(0, 50).trim();
  // Description structurée
  const specs = [];
  if (brand) specs.push('Marque : ' + brand);
  if (size) specs.push('Taille : ' + size);
  if (cond) specs.push('État : ' + cond);
  if (color) specs.push('Couleur : ' + color);
  // RÉFÉRENCE UNIVERSELLE : on écrit NOTRE numéro « VRM-{num} » dans l'annonce,
  // en HAUT (visible pour retrouver la paire en rayon) ET en bas. Ça marche sur
  // TOUT compte — pas besoin de la numérotation auto des comptes PRO. C'est aussi
  // la clé qui permettra de resynchroniser (vendu sur LBC → retirer de Vinted).
  const ref = 'VRM-' + num;
  const parts = [];
  parts.push('📦 Réf. ' + ref);
  parts.push('');
  parts.push(desc0 || base);
  if (specs.length) { parts.push(''); parts.push(specs.join('\n')); }
  parts.push('');
  parts.push('Envoi rapide et soigné (remise en main propre possible). N\'hésitez pas pour toute question.');
  parts.push('Réf. ' + ref);
  const description = parts.join('\n');
  return { id: String(raw.id), numero: String(num), ref, account: account || '', title, description, price, category: lbcCategory(det, raw), photos, vintedUrl: firstDefined(raw.url, det.url) };
}
// Extrait NOTRE numéro depuis n'importe quel texte d'annonce Leboncoin (titre +
// description). Marche pour un compte PRO (numérotation auto ignorée) comme pour
// un compte normal, car on lit d'abord notre jeton « VRM-{num} », puis « Réf X ».
function refFromText(text) {
  const s = String(text || '');
  let m = /VRM[-\s]?(\d{1,5})/i.exec(s);
  if (m) return m[1];
  m = /r[ée]f\.?\s*[:#]?\s*(\d{1,5})/i.exec(s);
  return m ? m[1] : null;
}
// Lit les annonces Leboncoin captées (ligne lbc_listings) sous forme de tableau.
async function readLbcItems() {
  try {
    const rows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    const items = (rows && rows[0] && rows[0].data && rows[0].data.items) || {};
    return Object.values(items).filter(Boolean);
  } catch (_) { return []; }
}
// Clés de rapprochement d'une annonce Leboncoin : sa référence pro (CustomRef),
// le VRM-xxx éventuel, et tout numéro « nXXXX » présent dans son titre.
function adRefKeys(ad) {
  const keys = [];
  const push = (v) => { const t = String(v == null ? '' : v).trim(); if (t && !keys.includes(t)) keys.push(t); };
  if (ad.customRef) { const m = /(\d{1,5})/.exec(String(ad.customRef)); if (m) push(m[1]); }
  if (ad.ref) push(ad.ref);
  const t = String(ad.subject || '');
  let m = /VRM[-\s]?(\d{1,5})/i.exec(t); if (m) push(m[1]);
  m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(t); if (m) push(m[1]);
  return keys;
}

async function buildLbcData() {
  const mainRows = await sbGet('app_data?id=eq.main&select=data');
  const main = (mainRows && mainRows[0] && mainRows[0].data) || {};
  const numeros = main.vinted_annonce_numeros || {};
  const labels = main.vinted_account_labels || {};
  const accounts = main.vinted_accounts || [];
  const uid2login = {};
  accounts.forEach((a) => { uid2login[String(a.vinted_user_id)] = labels[String(a.vinted_user_id)] || a.login || String(a.vinted_user_id); });
  // Déjà publiées sur Leboncoin (ligne DÉDIÉE → on n'écrase jamais le blob main).
  const postedData = await readPostedData();
  const posted = new Set(postedData.ids);
  const lbcLimit = postedData.limit;
  const lbcPlan = postedData.plan;
  // Annonces EN LIGNE (harvest listings).
  const listRows = (await sbGet('app_data?id=like.harvest_*_listings&select=id,data')) || [];
  const online = []; const onlineIds = new Set(); const seen = new Set();
  for (const r of listRows) {
    const d = r.data || {}; const p = d.payload || {}; const uid = String(d.uid);
    for (const it of (p.items || [])) {
      const oid = String(it.id);
      if (it.is_closed || it.is_hidden || it.is_draft) continue;
      onlineIds.add(oid);
      if (seen.has(oid)) continue; seen.add(oid);
      online.push({ id: oid, uid, raw: it });
    }
  }
  // Détails complets (harvest_{uid}_item_{id}).
  const itemRows = (await sbGet('app_data?id=like.harvest_*_item_*&select=id,data')) || [];
  const details = {};
  for (const r of itemRows) { const d = r.data || {}; const p = d.payload || {}; const it = (p && p.item) || p; if (it && it.id) details[String(it.id)] = it; }
  // Détails lus sur la PAGE de l'annonce (description + photos HD). Vinted ne
  // les renvoyant plus par API à la consultation, c'est devenu la source
  // principale : on complète (sans écraser) ce qui vient de l'API.
  const pageRows = await sbGet('app_data?id=eq.vinted_item_details&select=data');
  const pageDet = (pageRows && pageRows[0] && pageRows[0].data) || {};
  for (const id in pageDet) {
    const pd = pageDet[id] || {};
    const cur = details[id] || {};
    if (!cur.description && pd.description) cur.description = pd.description;
    if ((!cur.photos || !cur.photos.length) && pd.photos && pd.photos.length) cur.photos = pd.photos.map(u => ({ url: u }));
    details[id] = cur;
  }
  // ── RAPPROCHEMENT AUTOMATIQUE VINTED ↔ LEBONCOIN ──────────────────────────
  // Tes annonces Leboncoin portent une RÉFÉRENCE pro (`CustomRef`, ex. « 2057 »)
  // qui correspond au numéro écrit dans ton titre Vinted (« … n2057 »). On s'en
  // sert pour reconnaître TOUT SEUL ce qui est déjà en ligne sur Leboncoin :
  // plus besoin de cliquer « je l'ai déjà publiée » à la main.
  const lbcItems = await readLbcItems();
  const lbcByRef = new Map();
  for (const ad of lbcItems) {
    const dead = /(supprim|delete|expir|refus|sold|vendu)/i.test(String(ad.status || ''));
    if (dead) continue;
    for (const k of adRefKeys(ad)) if (!lbcByRef.has(k)) lbcByRef.set(k, ad);
  }
  // Clés de rapprochement d'une annonce Vinted : son numéro VRM + le « nXXXX »
  // présent dans son titre (les deux numérotations coexistent chez toi).
  const vintedKeys = (o, num) => {
    const keys = [];
    if (num != null && String(num).trim() !== '') keys.push(String(num).trim());
    const t = String((o.raw && o.raw.title) || '');
    const m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(t);
    if (m) keys.push(m[1]);
    return keys;
  };
  const autoMatched = new Map(); // id d'annonce Vinted -> annonce LBC trouvée

  const queue = [];
  for (const o of online) {
    const e = numeros[o.id]; const num = e && e.numero;
    if (!num || String(num).trim() === '') continue;          // seulement les annonces numérotées
    if (posted.has(o.id) || posted.has(String(num))) continue;  // déjà publiée (marquée à la main)
    // Déjà en ligne sur Leboncoin d'après la capture ? -> pas dans la file.
    let hit = null;
    for (const k of vintedKeys(o, num)) { if (lbcByRef.has(k)) { hit = lbcByRef.get(k); break; } }
    if (hit) { autoMatched.set(o.id, hit); continue; }
    queue.push(buildLbcAd(o.raw, details[o.id] || {}, num, uid2login[o.uid]));
  }
  queue.sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  // À RETIRER de Leboncoin : une paire publiée sur LBC qui n'est PLUS en ligne
  // sur Vinted = vendue (ou retirée) côté Vinted → il faut la retirer de LBC pour
  // ne pas la vendre deux fois. On la retrouve par son id d'annonce Vinted.
  const removals = [];
  const removalSeen = new Set();
  // Annonces Leboncoin que VRM n'arrive pas à relier à une paire connue.
  // Informatif : on les montre au lieu de les ignorer, mais on ne les présente
  // JAMAIS comme « à retirer » (on ne sait pas si elles doivent l'être).
  const unlinked = [];
  const lbcRow = (ad, keys) => ({
    lbcId: String(ad.id), ref: ad.customRef || (keys && keys[0]) || null,
    title: ad.subject || '', price: ad.price != null ? ad.price : null,
    url: ad.url || '', status: ad.status || '', issue: ad.issue || null,
  });
  for (const pid of posted) {
    if (!/^\d+$/.test(pid)) continue;                 // on ne suit que les ids d'annonce
    if (onlineIds.has(pid)) continue;                  // encore en ligne sur Vinted → RAS
    const e = numeros[pid] || {};
    removalSeen.add(pid);
    removals.push({ id: pid, numero: String(e.numero || '?'), ref: 'VRM-' + (e.numero || '?'), title: e.title || '' });
  }
  // Détection AUTOMATIQUE (sans marquage manuel) : une annonce Leboncoin encore
  // active dont la paire n'est PLUS en ligne sur Vinted = vendue là-bas → à
  // retirer de Leboncoin pour ne pas la vendre deux fois. On rapproche par la
  // référence pro, et on ne signale que si la paire est bien connue de VRM
  // (sinon on alerterait sur des annonces Leboncoin sans rapport).
  {
    const keysOnline = new Set();
    for (const o of online) {
      const e = numeros[o.id]; const num = e && e.numero;
      for (const k of vintedKeys(o, num)) keysOnline.add(k);
    }
    // Numéros connus de VRM (toutes annonces numérotées, en ligne ou non).
    const keysKnown = new Set();
    for (const id in numeros) {
      const e = numeros[id] || {};
      if (e.numero != null && String(e.numero).trim() !== '') keysKnown.add(String(e.numero).trim());
      const m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(String(e.title || ''));
      if (m) keysKnown.add(m[1]);
    }
    for (const ad of lbcItems) {
      if (/(supprim|delete|expir|refus|sold|vendu)/i.test(String(ad.status || ''))) continue;
      const keys = adRefKeys(ad);
      if (!keys.length) { unlinked.push(lbcRow(ad, keys)); continue; }
      if (keys.some((k) => keysOnline.has(k))) continue;   // encore en ligne sur Vinted
      // Paire inconnue de VRM : on ne crie PAS « à retirer » (on risquerait de
      // faire supprimer une bonne annonce). On la remonte à part, pour info.
      if (!keys.some((k) => keysKnown.has(k))) { unlinked.push(lbcRow(ad, keys)); continue; }
      const key = 'lbc:' + ad.id;
      if (removalSeen.has(key)) continue; removalSeen.add(key);
      removals.push({
        id: key, lbcId: String(ad.id), numero: keys[0] || '?',
        ref: ad.customRef || keys[0] || '?', title: ad.subject || '',
        url: ad.url || '', auto: true,
      });
    }
  }
  removals.sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  // Compteur d'annonces Leboncoin : ce que TU as marqué publié (fiable) et, si la
  // capture LBC a remonté quelque chose, le nombre réellement vu en ligne.
  let lbcCount = 0;
  try {
    const lbcRows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    const items = (lbcRows && lbcRows[0] && lbcRows[0].data && lbcRows[0].data.items) || {};
    lbcCount = Object.values(items).filter((v) => !/(supprim|delete|expir|refus|sold|vendu)/i.test(String(v && v.status || ''))).length;
  } catch (_) {}
  const postedCount = [...posted].filter((x) => /^\d+$/.test(x)).length;
  // Quota détecté automatiquement depuis l'offre Leboncoin (si trouvé).
  let detected = null;
  try { const rec = await sbGet('app_data?id=eq.lbc_recon&select=data'); const q = rec && rec[0] && rec[0].data && rec[0].data.quota; if (q && q.value) detected = q.value; } catch (_) {}
  // Compteurs de diagnostic (pour comprendre si la file est vide et pourquoi).
  const numberedOnline = online.filter((o) => { const e = numeros[o.id]; return e && String(e.numero || '').trim() !== ''; }).length;
  const stats = { postedCount, lbcCount, limit: lbcLimit, plan: lbcPlan, detected, onlineCount: online.length, numberedCount: numberedOnline, queueCount: queue.length,
    autoMatched: autoMatched.size, lbcSeen: lbcItems.length, unlinkedCount: unlinked.length };
  // Liste des paires marquées « publiées » (pour pouvoir annuler une erreur).
  const postedList = [...posted].filter((x) => /^\d+$/.test(x)).map((pid) => { const e = numeros[pid] || {}; return { id: pid, numero: String(e.numero || '?'), title: e.title || '' }; }).sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  return { queue, removals, unlinked, stats, postedList };
}
// Range TES annonces Leboncoin captées passivement dans une ligne dédiée. On
// fusionne (par id) avec ce qui est déjà connu → l'historique se complète au fil
// de ta navigation, sans écraser. Sert au dispatcher LBC→Vinted + synchro inverse.
async function storeLbcListings(url, listings) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    const prev = (prevRows && prevRows[0] && prevRows[0].data && prevRows[0].data.items) || {};
    const merged = Object.assign({}, prev);
    for (const l of listings) { if (l && l.id) merged[String(l.id)] = Object.assign({}, merged[String(l.id)], l, { seenAt: new Date().toISOString() }); }
    await supabaseUpsert('app_data', [{ id: 'lbc_listings', data: { items: merged, updatedAt: new Date().toISOString(), lastUrl: url } }], 'id');
  } catch (_) {}
}
// COMPTES LEBONCOIN connectes. Julien en a plusieurs : on garde la liste des
// comptes reellement vus dans le navigateur, avec la date de derniere vue. L'app
// s'en sert pour dire depuis quel compte publier, et pour repartir les annonces.
async function storeLbcAccount(acc) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
    const prev = (prevRows && prevRows[0] && prevRows[0].data && prevRows[0].data.accounts) || {};
    const merged = Object.assign({}, prev);
    merged[String(acc.id)] = Object.assign({}, merged[String(acc.id)], acc, { seenAt: new Date().toISOString() });
    await supabaseUpsert('app_data', [{ id: 'lbc_accounts', data: { accounts: merged, updatedAt: new Date().toISOString() } }], 'id');
  } catch (_) {}
}
// RECON : on garde un échantillon des réponses Leboncoin (chemins d'API + un bout
// de corps) pour brancher l'extraction au millimètre. Ligne dédiée lbc_recon.
async function storeLbcRecon(patch) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_recon&select=data');
    const prev = (prevRows && prevRows[0] && prevRows[0].data) || {};
    const next = Object.assign({ paths: [], samples: [] }, prev);
    if (patch.paths) { const set = new Set([...(next.paths || []), ...patch.paths]); next.paths = [...set].slice(0, 300); }
    if (patch.sample) { next.samples = [patch.sample, ...(next.samples || [])].slice(0, 6); }
    if (patch.quota) next.quota = patch.quota;                 // quota d'annonces détecté (offre)
    if (patch.form) next.form = patch.form;                     // structure du formulaire de dépôt (pour pré-remplir juste)
    if (patch.url) next.lastUrl = patch.url;
    next.updatedAt = new Date().toISOString();
    await supabaseUpsert('app_data', [{ id: 'lbc_recon', data: next }], 'id');
  } catch (_) {}
}
// Extraction GÉNÉRIQUE des annonces depuis une réponse JSON Leboncoin : on cherche
// récursivement les objets qui ressemblent à une annonce (un id + un titre + un
// prix). Marche quel que soit l'endpoint. On garde aussi un échantillon (recon).
async function handleLbcRaw(url, body) {
  let data = null;
  try { data = JSON.parse(body); } catch (_) { return; }
  const found = []; const seen = new Set();

  // ── CAS PRO LEBONCOIN (endpoint réel de « mes annonces ») ──────────────────
  // GET /api/stats/proxy/v2/account/classifieds/analysis/list
  //   → { Facets:{Total}, Ads:[{ Id, Status, CreatedAt,
  //         Info:{ Title, Price, URL, CustomRef, Category, ImageSmall },
  //         Analysis:{ Issue, CTR, Appreciation, LowVisibility } }] }
  // ⚠️ Les clés sont en MAJUSCULES : le parcours générique plus bas cherchait
  // id/title/price en minuscules et ne trouvait donc jamais rien — c'est pour
  // ça que la liste des annonces Leboncoin restait vide.
  // La RÉFÉRENCE PRO (`CustomRef`) est le lien direct avec le numéro de paire.
  if (data && Array.isArray(data.Ads) && data.Ads.length) {
    for (const ad of data.Ads) {
      const info = ad.Info || {};
      const id = ad.Id != null ? String(ad.Id) : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const title = String(info.Title || '');
      const custom = info.CustomRef != null ? String(info.CustomRef).trim() : '';
      const an = ad.Analysis || {};
      found.push({
        id,
        subject: title,
        price: info.Price != null ? info.Price : null,
        body: '',
        // Référence : le champ pro CustomRef d'abord (c'est le bon), sinon
        // un VRM-xxx écrit dans le titre.
        ref: (custom.match(/(\d{1,5})/) || [])[1] || (title.match(/VRM[-\s]?(\d{1,5})/i) || [])[1] || null,
        customRef: custom || null,
        url: info.URL || '',
        images: info.ImageSmall ? [info.ImageSmall] : [],
        category: info.Category || info.CategoryId || '',
        status: ad.Status || '',
        createdAt: ad.CreatedAt || ad.PostedAt || null,
        // Diagnostic fourni par Leboncoin : utile pour savoir quelle annonce
        // ne sort pas (visibilité faible, peu de clics…).
        issue: an.Issue || null,
        ctr: an.CTR != null ? an.CTR : null,
        appreciation: an.Appreciation || null,
      });
    }
    if (found.length) { await storeLbcListings(url, found); return; }
  }

  const priceOf = (o) => {
    if (o.price != null) return Array.isArray(o.price) ? o.price[0] : o.price;
    if (o.price_cents != null) return o.price_cents / 100;
    if (o.list_price != null) return Array.isArray(o.list_price) ? o.list_price[0] : o.list_price;
    return null;
  };
  const walk = (node, depth) => {
    if (!node || depth > 9 || found.length > 200) return;
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
    if (typeof node !== 'object') return;
    const id = node.list_id || node.ad_id || node.id;
    const title = node.subject || node.title;
    const price = priceOf(node);
    if (id && title && price != null) {
      const sid = String(id);
      if (!seen.has(sid)) {
        seen.add(sid);
        const bodyTxt = String(node.body || node.description || '');
        found.push({
          id: sid, subject: String(title), price,
          body: bodyTxt.slice(0, 400),
          ref: (bodyTxt.match(/VRM[-\s]?(\d{1,5})/i) || [])[1] || (String(title).match(/VRM[-\s]?(\d{1,5})/i) || [])[1] || null,
          url: node.url || '',
          images: (node.images && (node.images.urls || node.images.thumb_urls || node.images.urls_thumb)) || node.image_urls || [],
          category: node.category_name || node.category_id || '',
          status: node.status || node.ad_status || '',
        });
      }
    }
    for (const k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1); }
  };
  try { walk(data, 0); } catch (_) {}
  // Détection auto du quota d'annonces (offre Leboncoin) → la limite s'adapte.
  const quota = detectLbcQuota(data);
  // Recon : un échantillon du corps (tronqué) + l'URL, pour inspecter la vraie forme.
  await storeLbcRecon({ url, quota: quota || undefined, sample: { url, at: new Date().toISOString(), found: found.length, quota, body: String(body).slice(0, 9000) } });
  if (found.length) await storeLbcListings(url, found);
}
// Toutes les photos Vinted (HD) d'une paire, par son N°. Leboncoin limite le
// nombre de photos ; ici on récupère TOUTES celles de Vinted (déjà moissonnées)
// pour pouvoir en envoyer davantage à un acheteur qui en demande, sans rien
// re-télécharger. Cherche dans le détail complet (item) puis dans le dressing.
async function getPairPhotos(numero) {
  const num = String(numero || '').trim();
  if (!num) return { numero: num, title: '', photos: [] };
  const mainRows = await sbGet('app_data?id=eq.main&select=data');
  const numeros = (mainRows && mainRows[0] && mainRows[0].data && mainRows[0].data.vinted_annonce_numeros) || {};
  const ids = Object.keys(numeros).filter((k) => String(numeros[k] && numeros[k].numero) === num);
  const photos = []; const seen = new Set(); let title = '';
  const add = (u) => { const s = typeof u === 'string' ? u : (u && (u.full_size_url || u.url)); if (s && !seen.has(s)) { seen.add(s); photos.push(s); } };
  const itemRows = (await sbGet('app_data?id=like.harvest_*_item_*&select=id,data')) || [];
  const detById = {}; for (const r of itemRows) { const p = (r.data && r.data.payload) || {}; const it = p.item || p; if (it && it.id) detById[String(it.id)] = it; }
  // Photos HD lues sur la page de l'annonce (voir saveItemDetail).
  const pageRows2 = await sbGet('app_data?id=eq.vinted_item_details&select=data');
  const pageDet2 = (pageRows2 && pageRows2[0] && pageRows2[0].data) || {};
  for (const id in pageDet2) {
    const ph = (pageDet2[id] || {}).photos || [];
    if (!ph.length) continue;
    const cur = detById[id] || {};
    if (!cur.photos || !cur.photos.length) cur.photos = ph.map(u => ({ url: u }));
    detById[id] = cur;
  }
  const listRows = (await sbGet('app_data?id=like.harvest_*_listings&select=id,data')) || [];
  const rawById = {}; for (const r of listRows) { const p = (r.data && r.data.payload) || {}; for (const it of (p.items || [])) rawById[String(it.id)] = it; }
  for (const id of ids) {
    title = title || (numeros[id] && numeros[id].title) || '';
    const det = detById[id]; if (det && Array.isArray(det.photos)) det.photos.forEach(add);
    const raw = rawById[id]; if (raw) { (raw.photos || []).forEach(add); if (raw.photo) add(raw.photo); }
    if (numeros[id] && numeros[id].photo) add(numeros[id].photo);
  }
  return { numero: num, title, photos };
}
// Télécharge les photos d'une paire en FICHIERS (fini les onglets). Rangées dans
// un sous-dossier VRM-{N°} pour les retrouver et les glisser dans Leboncoin.
async function downloadPhotos(urls, numero) {
  if (!chrome.downloads) return 0;
  const list = urls.filter(Boolean); let n = 0;
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    const ext = ((String(u).split('?')[0].match(/\.(jpe?g|png|webp)$/i) || [])[1] || 'jpg');
    try { await chrome.downloads.download({ url: u, filename: `VRM-${numero || 'paire'}/photo-${i + 1}.${ext}`, conflictAction: 'uniquify' }); n++; } catch (_) {}
  }
  return n;
}
async function readPostedData() {
  const rows = await sbGet('app_data?id=eq.vinted_lbc_posted&select=data');
  const d = (rows && rows[0] && rows[0].data) || {};
  return { ids: (d.ids || []).map(String), limit: d.limit != null ? d.limit : null, plan: d.plan || null };
}
async function readPostedIds() { return new Set((await readPostedData()).ids); }
async function writePosted(d) {
  await supabaseUpsert('app_data', [{ id: 'vinted_lbc_posted', data: { ids: d.ids, limit: d.limit != null ? d.limit : null, plan: d.plan || null, updatedAt: new Date().toISOString() } }], 'id');
}
async function markLbcPosted(id) {
  const d = await readPostedData(); const s = new Set(d.ids); s.add(String(id));
  await writePosted({ ids: [...s], limit: d.limit, plan: d.plan });
}
async function unmarkLbcPosted(id) {
  const d = await readPostedData(); const s = new Set(d.ids); s.delete(String(id));
  await writePosted({ ids: [...s], limit: d.limit, plan: d.plan });
}
async function setLbcLimit(limit, plan) {
  const d = await readPostedData();
  const n = parseInt(String(limit), 10);
  await writePosted({ ids: d.ids, limit: (isNaN(n) || n <= 0) ? null : n, plan: (plan && String(plan).trim()) || null });
}
// AUTO-DÉTECTION du quota d'annonces depuis les données Leboncoin (offre / pack).
// On cherche les champs qui ressemblent à un maximum/quota d'annonces. Best-effort :
// si on trouve, la limite s'adapte toute seule à l'abonnement en cours.
function detectLbcQuota(data) {
  let best = null;
  const KEY = /(max.?ads|ads.?(max|limit|quota|count|allowed|available|remaining|total)|listing.?(limit|quota|max)|quota|nb.?annonces|package.?size|subscription.?ads|credits?)/i;
  const walk = (node, depth) => {
    if (!node || depth > 9 || best) return;
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
    if (typeof node !== 'object') return;
    for (const k in node) {
      const v = node[k];
      if (KEY.test(k) && (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)))) {
        const n = parseInt(v, 10);
        if (n > 0 && n < 100000) { best = { value: n, key: k }; return; }
      }
    }
    for (const k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1); }
  };
  try { walk(data, 0); } catch (_) {}
  return best;
}
