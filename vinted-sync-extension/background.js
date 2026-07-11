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
  }
});

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

// --- Declencheurs ----------------------------------------------------------

// Au demarrage / installation : on capte les comptes PUIS on rafraichit tout.
function fullSync() { captureAllAccounts().then(() => activeFetchAll()); }

chrome.runtime.onInstalled.addListener(() => { fullSync(); });
chrome.runtime.onStartup.addListener(() => { fullSync(); });

try {
  // Capture des comptes toutes les 10 min ; fetch actif toutes les 20 min
  // (assez pour etre a jour, assez espace pour rester discret).
  chrome.alarms.create('cancale-sync', { periodInMinutes: 10 });
  chrome.alarms.create('cancale-active', { periodInMinutes: 20 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === 'cancale-sync') captureAllAccounts();
    else if (a.name === 'cancale-active') activeFetchAll();
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
    cookieTimer = setTimeout(() => captureDomain(dom), 1500);
  });
} catch (_) {}
