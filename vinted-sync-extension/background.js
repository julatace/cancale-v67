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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
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

async function captureDomain(domain) {
  const access = await getCookie(domain, 'access_token_web');
  if (!access) return null;
  const refresh = await getCookie(domain, 'refresh_token_web');
  const anon = await getCookie(domain, 'anon_id');
  const payload = jwtPayload(access);
  const uid = payload && payload.account_id ? String(payload.account_id) : null;
  if (!uid) return null;
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
  return results;
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
  else rowId = `harvest_${uid}_${type}`;

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
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ login: parsed.user.login }),
      });
    } catch (_) { /* best-effort */ }
  }
}

// --- Messages venant de content.js ----------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.from !== 'cancale-content') {
    if (msg && msg.from === 'cancale-popup' && msg.action === 'syncNow') {
      captureAllAccounts().then((r) => { activeFetchAll(); sendResponse({ ok: true, accounts: r }); });
      return true; // reponse asynchrone
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
    // PONT LEBONCOIN : le script lbc.js (sur leboncoin.fr) demande la liste des
    // annonces Vinted prêtes à publier, ou marque une annonce comme publiée.
    if (msg && msg.from === 'cancale-lbc') {
      (async () => {
        try {
          if (msg.action === 'getQueue') { const r = await buildLbcData(); sendResponse({ ok: true, queue: r.queue, removals: r.removals, stats: r.stats }); return; }
          if (msg.action === 'setLimit') { await setLbcLimit(msg.limit, msg.plan); sendResponse({ ok: true }); return; }
          if (msg.action === 'getPhotos') { const r = await getPairPhotos(msg.numero); sendResponse({ ok: true, numero: r.numero, title: r.title, photos: r.photos }); return; }
          if (msg.action === 'markPosted' && msg.id) { await markLbcPosted(msg.id); sendResponse({ ok: true }); return; }
          if (msg.action === 'unmarkPosted' && msg.id) { await unmarkLbcPosted(msg.id); sendResponse({ ok: true }); return; }
          if (msg.action === 'markRemoved' && msg.id) { await unmarkLbcPosted(msg.id); sendResponse({ ok: true }); return; }
          if (msg.action === 'lbcCapture' && Array.isArray(msg.listings)) { await storeLbcListings(msg.url, msg.listings); sendResponse({ ok: true }); return; }
          if (msg.action === 'lbcRaw' && msg.body) { await handleLbcRaw(msg.url, msg.body); sendResponse({ ok: true }); return; }
          if (msg.action === 'lbcPaths' && Array.isArray(msg.paths)) { await storeLbcRecon({ paths: msg.paths, url: msg.url }); sendResponse({ ok: true }); return; }
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
async function storeHarvestRow(uid, type, payload, domain) {
  const data = { type, uid, domain: domain || 'www.vinted.fr', capturedAt: new Date().toISOString(), payload };
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_${type}`, data }], 'id');
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
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ login }),
        });
      } catch (_) {}
    }
  }
  await wait(1500);

  // 2) Annonces en ligne (dressing) via l'ID DE PROFIL.
  const profileId = prof.json && prof.json.user && prof.json.user.id;
  if (profileId) {
    const w = await vintedGet(acc, `/api/v2/wardrobe/${profileId}/items?page=1&per_page=100`);
    if (w.ok && w.json) await storeHarvestRow(uid, 'listings', w.json, domain);
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
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
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
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
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
        const listings = pid ? await get('/api/v2/wardrobe/' + pid + '/items?page=1&per_page=100') : null;
        const sold = await get('/api/v2/my_orders?type=sold&page=1&per_page=100');
        const bought = await get('/api/v2/my_orders?type=purchased&page=1&per_page=100');
        const inbox = await get('/api/v2/inbox?page=1&per_page=30');
        return { who: who || null, listings: listings || null, sold: sold || null, bought: bought || null, inbox: inbox || null };
      },
    });
    out = res && res[0] && res[0].result;
  } catch (_) { return false; }
  if (!out) return false;
  // On range sous l'uid du COMPTE ACTIF (decode du cookie de session).
  const uid = await activeUidForDomain(domain);
  if (!uid) return false;
  let stored = false;
  if (out.who) { await storeHarvestRow(uid, 'profile', out.who, domain); stored = true; }
  if (out.listings) { await storeHarvestRow(uid, 'listings', out.listings, domain); stored = true; }
  if (out.sold && Array.isArray(out.sold.my_orders)) { await storeHarvestRow(uid, 'orders_sold', out.sold, domain); stored = true; }
  if (out.bought && Array.isArray(out.bought.my_orders)) { await storeHarvestRow(uid, 'orders_purchased', out.bought, domain); stored = true; }
  if (out.inbox) { await storeHarvestRow(uid, 'inbox', out.inbox, domain); stored = true; }
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
      const w = await vintedGetCookie(domain, `/api/v2/wardrobe/${profileId}/items?page=1&per_page=100`);
      if (w.ok && w.json) await storeHarvestRow(uid, 'listings', w.json, domain);
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
async function sbGet(query) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
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
  const queue = [];
  for (const o of online) {
    const e = numeros[o.id]; const num = e && e.numero;
    if (!num || String(num).trim() === '') continue;          // seulement les annonces numérotées
    if (posted.has(o.id) || posted.has(String(num))) continue;  // déjà publiée sur LBC
    queue.push(buildLbcAd(o.raw, details[o.id] || {}, num, uid2login[o.uid]));
  }
  queue.sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  // À RETIRER de Leboncoin : une paire publiée sur LBC qui n'est PLUS en ligne
  // sur Vinted = vendue (ou retirée) côté Vinted → il faut la retirer de LBC pour
  // ne pas la vendre deux fois. On la retrouve par son id d'annonce Vinted.
  const removals = [];
  for (const pid of posted) {
    if (!/^\d+$/.test(pid)) continue;                 // on ne suit que les ids d'annonce
    if (onlineIds.has(pid)) continue;                  // encore en ligne sur Vinted → RAS
    const e = numeros[pid] || {};
    removals.push({ id: pid, numero: String(e.numero || '?'), ref: 'VRM-' + (e.numero || '?'), title: e.title || '' });
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
  const stats = { postedCount, lbcCount, limit: lbcLimit, plan: lbcPlan, detected };
  return { queue, removals, stats };
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
