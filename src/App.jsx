import React, { useState, useMemo, useEffect } from "react";

const THEMES = {
  light: {
    bg:"#f6f8f6", surface:"#ffffff", card:"#ffffff", border:"#e3e8e4",
    accent:"#1f7a55", onAccent:"#ffffff", danger:"#c34a4a", warn:"#b07d18",
    blue:"#3f7fae", purple:"#7a6ad0", text:"#162019", muted:"#697971",
  },
  dark: {
    bg:"#0f1411", surface:"#161f1a", card:"#1c2822", border:"#283831",
    accent:"#3f9e74", onAccent:"#ffffff", danger:"#e0737a", warn:"#d2a44e",
    blue:"#5a9fcf", purple:"#a394e6", text:"#e9f1ec", muted:"#88998f",
  },
};
let C = THEMES.light;

// Données d'amorçage vidées : chaque utilisateur part d'un catalogue/ventes
// vierge et ses vraies données viennent du cloud (Supabase). Aucune donnée
// personnelle n'est embarquée dans le code (confidentialité + poids du bundle).
const INIT_CAT = [];
const INIT_SAL = [];

// ============ SYNCHRO SUPABASE (Mac <-> iPhone) ============
// Base de donnees en ligne : les donnees sont partagees entre tous les appareils
const SUPABASE_URL = "https://lgonxzrzjcqthjtbdpzo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ";
const SUPABASE_ROW = "main"; // une seule boite qui contient toutes les donnees

// Liste des cles synchronisees dans le cloud
const SYNC_KEYS = [
  'vinted_catalog','vinted_sales','vinted_garage_grid','vinted_blocked',
  'vinted_extracols','vinted_colors','vinted_invoices',
  'vinted_invoice_settings','vinted_custom_logo','vinted_dark','vinted_stock_vinted',
  'vinted_accounts','vinted_account_labels',
  'vinted_inventory','vinted_annonce_numeros','vinted_used_numeros',
  'vinted_goal','vinted_regime','vinted_tva','vinted_bordereau_formats',
  'vinted_txn_link','vinted_sales_hidden','vinted_accounts_hidden',
];

// Indicateur de synchro (mis a jour par l'app)
let _syncListeners = [];
const onSyncChange = (fn) => { _syncListeners.push(fn); return () => { _syncListeners = _syncListeners.filter(f=>f!==fn); }; };
const _emitSync = (status) => { _syncListeners.forEach(fn=>{ try{fn(status);}catch(_){}}); };

// Lecture locale (instantanee)
const load = (k,d) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):d; } catch { return d; } };

// Recupere TOUT le contenu du cloud (au demarrage)
const cloudLoad = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (rows && rows[0] && rows[0].data) return rows[0].data;
    return null;
  } catch (_) { return null; }
};

// Envoie TOUT le contenu local vers le cloud (groupe, differe)
let _cloudTimer = null;
const cloudPush = () => {
  if (_cloudTimer) clearTimeout(_cloudTimer);
  _emitSync('saving');
  _cloudTimer = setTimeout(async () => {
    try {
      const payload = {};
      SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) { try { payload[k] = JSON.parse(v); } catch { payload[k] = v; } } });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${SUPABASE_ROW}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ data: payload, updated_at: new Date().toISOString() }),
      });
      _emitSync(res.ok ? 'synced' : 'error');
    } catch (_) { _emitSync('error'); }
    _cloudTimer = null;
  }, 800);
};

// Sauvegarde : localStorage immediat (differe 500ms) PUIS push cloud
let _saveTimers = {};
const save = (k,v) => {
  if (_saveTimers[k]) clearTimeout(_saveTimers[k]);
  _saveTimers[k] = setTimeout(() => {
    try { localStorage.setItem(k,JSON.stringify(v)); } catch {}
    delete _saveTimers[k];
    if (SYNC_KEYS.includes(k)) cloudPush(); // declenche la synchro cloud
  }, 500);
};

// ============ COMPTES VINTED CONNECTES DIRECTEMENT (API interne) ============
// Un compte Vinted est capture par l'extension Chrome "Shop Cancale35 - Vinted
// Sync" (lit le cookie de session dans le navigateur, jamais le mot de passe)
// et pousse dans la table Supabase "vinted_accounts". L'app lit cette table
// pour savoir quels comptes sont lies et appelle l'API Vinted via le proxy
// serverless "/api/vinted-proxy" (necessaire pour contourner le CORS).
const fetchVintedAccounts = async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (_) { return []; }
};

// Retire un compte de l'app : supprime sa ligne dans Supabase "vinted_accounts".
// Sert quand un compte est bloqué/fermé définitivement et qu'on ne veut plus le
// voir. NB : si la session Chrome du compte est encore valide, l'extension peut
// le re-capturer au prochain passage sur vinted.fr — mais pour un compte bloqué
// (cookie mort), il ne réapparaît pas. Renvoie true si la suppression a réussi.
const deleteVintedAccount = async (vintedUserId) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${vintedUserId}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
    });
    return res.ok;
  } catch (_) { return false; }
};

// L'extension ne capture pas toujours le pseudo Vinted (colonne login vide) ->
// on va le chercher via /api/v2/users/current et on le met en cache dans
// Supabase pour ne pas refaire l'appel a chaque fois. Renvoie le login ou null.
const fetchVintedLogin = async (account) => {
  const res = await vintedApiCall(account, '/api/v2/users/current');
  const login = res?.data?.user?.login || null;
  if (login && account.vinted_user_id) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${account.vinted_user_id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ login }),
      });
    } catch (_) { /* cache best-effort */ }
  }
  return login;
};

// Lit une donnee moissonnee PASSIVEMENT par l'extension (voir dossier
// vinted-sync-extension) dans Supabase, table app_data, ligne
// harvest_{account_id}_{type}. Renvoie la reponse Vinted brute (payload) ou
// null si l'extension n'a pas encore capté cette donnee (= tu n'as pas encore
// ouvert la page correspondante sur vinted.fr). Aucun appel a Vinted ici :
// c'est le mode le plus discret, tout vient de ta navigation.
const fetchHarvest = async (uid, type) => {
  if (!uid) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.harvest_${uid}_${type}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.data?.payload || null;
  } catch (_) { return null; }
};
// Récupère les commandes moissonnées d'un côté donné (ventes ou achats). Les
// lignes sont nommées harvest_{uid}_orders_{type} où {type} est le param d'URL
// capté par l'extension (sold/sell pour les ventes, bought/buy/purchased pour
// les achats). On classe par le nom de la clé pour être robuste au libellé exact.
const fetchHarvestOrders = async (uid, side) => {
  if (!uid) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=like.harvest_${uid}_orders_%25&select=id,data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const wantSold = side === 'sold';
    for (const r of rows) {
      const key = String(r.id).replace(`harvest_${uid}_orders_`, '');
      const isSold = /sold|sell/i.test(key);
      const isBought = /bought|buy|purchas/i.test(key);
      if ((wantSold && isSold) || (!wantSold && isBought)) return r.data?.payload || null;
    }
    return null;
  } catch (_) { return null; }
};
// Récupère le dernier bordereau (PDF) capté par l'extension pour ce compte
// (ligne harvest_{uid}_label_latest = {url, capturedAt, pdfB64}).
const fetchCapturedLabel = async (uid) => {
  if (!uid) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.harvest_${uid}_label_latest&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.data || null;
  } catch (_) { return null; }
};
const b64ToArrayBuffer = (b64) => {
  const bin = atob(b64); const len = bin.length; const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};
// Detail d'une conversation moissonnee (ligne harvest_{uid}_conv_{convId}).
const fetchHarvestConversation = async (uid, convId) => {
  if (!uid || !convId) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.harvest_${uid}_conv_${convId}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.data?.payload || null;
  } catch (_) { return null; }
};

// Vinted utilise DEUX hosts differents selon l'endpoint (constate via
// plusieurs vraies requetes "Copy as fetch") :
// - www.vinted.fr/api/v2/...      -> commandes, ventes, achats
// - api.vinted.fr/{service}/v1/...  -> notifications et autres services annexes
// Le domaine "site" (compte.domain, ex. www.vinted.fr) sert de defaut ; les
// appels qui ont besoin de l'autre host le precisent via opts.host.
const VINTED_NOTIF_API_HOST = {
  'www.vinted.fr': 'api.vinted.fr', 'www.vinted.com': 'api.vinted.com',
  'www.vinted.it': 'api.vinted.it', 'www.vinted.de': 'api.vinted.de',
};

// Persistance des tokens rafraichis automatiquement par le proxy (voir
// api/vinted-proxy.js : quand un appel renvoie 401, le proxy refait un refresh
// et nous renvoie de nouveaux tokens dans json.refreshed). Il FAUT les persister
// car Vinted invalide l'ancien refresh_token a chaque refresh - sinon le refresh
// suivant echouerait. Le composant App enregistre un handler pour repercuter les
// nouveaux tokens dans son state ; en parallele on met a jour la ligne Supabase
// pour que l'extension et les autres appareils repartent du bon refresh_token.
let onVintedTokensRefreshed = null;
const setVintedTokensRefreshedHandler = (fn) => { onVintedTokensRefreshed = fn; };

const persistRefreshedTokens = async (account, refreshed) => {
  if (!refreshed || !refreshed.access_token) return;
  // Mutation en memoire : les appels suivants de la meme sequence utilisent
  // deja le token frais sans attendre le re-render React.
  account.access_token = refreshed.access_token;
  account.refresh_token = refreshed.refresh_token;
  try {
    if (account.vinted_user_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${account.vinted_user_id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          updated_at: new Date().toISOString(),
        }),
      });
    }
  } catch (_) { /* best effort : la mutation memoire suffit pour la session */ }
  if (onVintedTokensRefreshed) {
    try { onVintedTokensRefreshed(account.vinted_user_id, refreshed); } catch (_) { /* ignore */ }
  }
};

// Appelle un endpoint de l'API Vinted pour le compte donne, via le proxy
// (evite le blocage CORS puisque le navigateur ne parle qu'a notre propre domaine).
const vintedApiCall = async (account, endpoint, opts = {}) => {
  try {
    const siteDomain = account.domain || 'www.vinted.fr';
    const host = opts.host || siteDomain;
    const res = await fetch('/api/vinted-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: account.access_token,
        refreshToken: account.refresh_token,
        anonId: account.anon_id,
        csrfToken: account.csrf_token,
        host,
        endpoint,
        method: opts.method || 'GET',
        body: opts.body,
      }),
    });
    const json = await res.json();
    // Le proxy a du rafraichir le token expire : on persiste les nouveaux tokens.
    if (json && json.refreshed) await persistRefreshedTokens(account, json.refreshed);
    return json; // { status, ok, data, refreshed? }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
};

// Classe le texte de statut renvoye par Vinted en 3 categories utilisables
// partout dans l'app : 'cancelled' (annulee, remboursee, refusee...),
// 'completed' (transaction finalisee), 'pending' (tout le reste, en cours).
// Avant ce correctif, "En attente" ne filtrait que sur "finalisee", donc les
// achats annules par l'acheteur/le vendeur restaient affiches comme en
// attente au lieu d'etre a part - d'ou la confusion remontee par l'utilisateur.
const classifyOrderStatus = (status) => {
  const s = status || '';
  if (/annul|cancel|refus|rembours/i.test(s)) return 'cancelled';
  if (/finalis/i.test(s)) return 'completed';
  return 'pending';
};
// Une vente a besoin d'un BORDEREAU seulement si elle est À EXPÉDIER : ni
// annulée, ni finalisée, ni déjà expédiée/livrée. On exclut donc les statuts
// « expédié / en transit / livré / finalisé ». Le reste (payé, en attente
// d'expédition, en préparation…) = à expédier. Statut inconnu -> on montre quand
// même (mieux vaut proposer que cacher à tort).
const needsBordereau = (status) => {
  const s = (status || '').toLowerCase();
  if (!s) return true;
  if (/annul|refus|rembours|cancel/.test(s)) return false;
  if (/finalis|termin|complet|cl[oô]tur/.test(s)) return false;            // vente finie
  if (/exp[eé]di|envoy|transit|achemin|en route|livr|remis|r[ée]ception/.test(s)) return false; // déjà parti/arrivé
  return true;                                                              // à expédier
};

// Recupere une page d'achats ou de ventes pour un compte (endpoint reel
// trouve via "Copy as fetch" : www.vinted.fr/api/v2/my_orders).
// type: 'purchased' | 'sold' ; statusFilter: 'completed' | 'pending' | 'cancelled' | 'all'
const fetchVintedOrders = async (account, type, page = 1, statusFilter = 'completed', opts = {}) => {
  const applyStatus = (items) => {
    if (statusFilter === 'pending') return items.filter(it => classifyOrderStatus(it.status) === 'pending');
    if (statusFilter === 'cancelled') return items.filter(it => classifyOrderStatus(it.status) === 'cancelled');
    if (statusFilter === 'completed') return items.filter(it => classifyOrderStatus(it.status) === 'completed');
    return items;
  };
  // 1) Données moissonnées par l'extension (aucun appel Vinted). On sépare
  //    achats/ventes par le type d'URL capté ; repli sur l'ancienne clé générique.
  //    opts.force = on saute la moisson (bouton "Synchroniser") pour le dernier état.
  if (page === 1 && !opts.force) {
    const h = (await fetchHarvestOrders(account.vinted_user_id, type)) || (await fetchHarvest(account.vinted_user_id, 'orders'));
    if (h && Array.isArray(h.my_orders)) {
      return { ok: true, items: applyStatus(h.my_orders), pagination: h.pagination || null, source: 'harvest' };
    }
  }
  // Mode "moisson seulement" : on n'interroge PAS Vinted, on renvoie du vide si
  // la page n'a pas encore été ouverte dans le navigateur.
  if (opts.harvestOnly) return { ok: true, items: [], pagination: null, source: 'harvest' };
  // 2) Repli : proxy.
  const endpoint = statusFilter === 'completed'
    ? `/api/v2/my_orders?type=${type}&status=completed&per_page=20&page=${page}`
    : `/api/v2/my_orders?type=${type}&per_page=20&page=${page}`;
  const res = await vintedApiCall(account, endpoint);
  if (!res.ok) return { ok: false, error: res.status || res.error, items: [], pagination: null };
  const items = applyStatus(res.data?.my_orders || []);
  return {
    ok: true,
    items,
    pagination: res.data?.pagination || null,
  };
};

// Recupere la liste des conversations (boite de reception).
// Endpoint reel confirme : GET /api/v2/inbox -> { conversations: [...] }.
// Chaque conversation contient : id, description (titre de l'article),
// unread, updated_at, opposite_user {id, login, photo}, item_photos.
// (Les anciennes tentatives /api/v2/conversations et /transaction_messages
// renvoyaient 404 ; /api/v2/inbox est le bon chemin.)
const fetchVintedConversations = async (account, page = 1, opts = {}) => {
  // 1) Priorité aux données moissonnées par l'extension (aucun appel Vinted).
  //    opts.force = on saute la moisson (bouton "Synchroniser") pour le dernier état.
  if (page === 1 && !opts.force) {
    const h = await fetchHarvest(account.vinted_user_id, 'inbox');
    if (h && Array.isArray(h.conversations)) {
      return { ok: true, items: h.conversations, pagination: h.pagination || null, raw: null, source: 'harvest' };
    }
  }
  // Mode "moisson seulement" : aucun appel Vinted.
  if (opts.harvestOnly) return { ok: true, items: [], pagination: null, raw: null, source: 'harvest' };
  // 2) Repli : proxy (si l'inbox n'a pas encore été ouverte dans le navigateur).
  const res = await vintedApiCall(account, `/api/v2/inbox?page=${page}&per_page=20`);
  if (!res.ok) return { ok: false, error: res.status || res.error, items: [], pagination: null, raw: res };
  const items = res.data?.conversations || [];
  return {
    ok: true,
    items,
    pagination: res.data?.pagination || null,
    raw: res,
  };
};

// Recupere le detail d'une conversation (fil de messages).
// Endpoint reel confirme : GET /api/v2/conversations/{id} -> { conversation }.
// conversation.messages est une liste d'entites { entity_type, entity }.
// entity_type = 'message' pour un vrai message (entity.body + entity.user_id) ;
// d'autres types existent (offer_request_message, status_message,
// action_message) qu'on affiche comme evenements. Pour distinguer "moi" de
// "l'acheteur" on compare entity.user_id a opposite_user.id (fiable meme si
// l'id vendeur differe du vinted_user_id du compte).
const fetchVintedConversationDetail = async (account, conversationId) => {
  // 1) Données moissonnées (si tu as déjà ouvert ce fil sur vinted.fr).
  const h = await fetchHarvestConversation(account.vinted_user_id, conversationId);
  if (h && h.conversation) return { ok: true, conversation: h.conversation, source: 'harvest' };
  // 2) Repli : proxy.
  const res = await vintedApiCall(account, `/api/v2/conversations/${conversationId}`);
  if (!res.ok) return { ok: false, error: res.status || res.error, conversation: null };
  return { ok: true, conversation: res.data?.conversation || null };
};

// Aplati les entites d'une conversation en messages affichables et tries.
// Extrait TOUT le texte lisible d'une entité d'évènement système : titre,
// sous-titre, corps, actions... ET surtout tout champ qui ressemble à un CODE
// (retrait en point relais, PIN, suivi, référence). Vinted range parfois le
// « code de retrait » dans un champ imbriqué : on scanne défensivement pour ne
// rien cacher (« voir tout dans la conv »).
const extractEventText = (e, entity_type) => {
  const parts = [];
  ['title','subtitle','body','text','header','description'].forEach(k => { if (typeof e[k] === 'string' && e[k].trim()) parts.push(e[k].trim()); });
  const seen = new Set(parts);
  const scan = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 3) return;
    for (const k in obj) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) {
        // Champs qui portent typiquement un code / numéro de suivi / retrait.
        if (/code|pin|pickup|retrait|tracking|suivi|reference|référence|numero|numéro|colis|shipment|drop/i.test(k) && !seen.has(v.trim())) {
          seen.add(v.trim()); parts.push(`${k}: ${v.trim()}`);
        }
      } else if (v && typeof v === 'object') scan(v, depth + 1);
    }
  };
  scan(e);
  return parts.length ? [...new Set(parts)].join(' · ') : entity_type;
};

// Récupère tous les LIENS d'une entité (le bordereau/étiquette d'expédition est
// souvent un lien dans la conversation). On scanne en profondeur, on repère les
// liens de type bordereau/étiquette/suivi pour les mettre en avant.
const URL_RE = /(https?:\/\/[^\s"'<>]+)/gi;
const extractLinks = (e) => {
  const found = []; const seen = new Set();
  const push = (url, ctx) => {
    url = url.replace(/[.,)]+$/, '');
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    const hay = (url + ' ' + (ctx||'')).toLowerCase();
    const isBordereau = /label|bordereau|shipping|shipment|étiquette|etiquette|parcel|colis|waybill|expedition|expédition|\.pdf/.test(hay);
    found.push({ url, bordereau: isBordereau });
  };
  const scan = (obj, key = '', depth = 0) => {
    if (obj == null || depth > 4) return;
    if (typeof obj === 'string') {
      let m; URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(obj))) push(m[1], key);
      // champ dédié dont la clé évoque un lien direct (url/link/href)
      if (/url|link|href|download/i.test(key) && /^https?:\/\//i.test(obj)) push(obj, key);
      return;
    }
    if (typeof obj === 'object') for (const k in obj) scan(obj[k], k, depth + 1);
  };
  scan(e);
  return found;
};

const normalizeConversationMessages = (conversation) => {
  if (!conversation || !Array.isArray(conversation.messages)) return [];
  const oppId = conversation.opposite_user?.id;
  return conversation.messages.map((m) => {
    const e = m.entity || {};
    const ts = m.created_at_ts || e.created_at_ts || null;
    const links = extractLinks(e);
    if (m.entity_type === 'message') {
      return { kind: 'message', mine: oppId != null && e.user_id !== oppId, body: e.body || '', photos: e.photos || [], ts, links };
    }
    // Évènements système (offre, statut, expédition, retrait…) : on montre TOUT,
    // codes de retrait compris.
    return { kind: 'event', body: extractEventText(e, m.entity_type), ts, links };
  });
};

// ── Pont vers l'extension VRM (v3.4+) ───────────────────────────────────────
// Permet d'EXÉCUTER une action Vinted (répondre, faire une offre…) depuis le
// navigateur de l'utilisateur (son IP), via bridge.js injecté par l'extension
// sur cette page. Aucune écriture ne passe par un serveur → zéro risque de ban.
// Si l'extension n'est pas là (mobile, pas Chrome…), vmrExtPresent() est faux et
// l'app propose le repli « répondre sur Vinted ».
let __vmrExtReady = false;
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('message', (e) => { if (e.source === window && e.data && e.data.__vmr === 'ready') __vmrExtReady = true; });
    window.postMessage({ __vmr: 'ping' }, '*');
    setTimeout(() => { try { window.postMessage({ __vmr: 'ping' }, '*'); } catch (_) {} }, 1500);
  } catch (_) {}
}
const vmrExtPresent = () => __vmrExtReady;
function vmrExec({ uid, method, endpoint, body }, timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve({ ok: false, error: 'no window' }); return; }
    const reqId = 'r' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const cleanup = () => { clearTimeout(to); window.removeEventListener('message', onMsg); };
    const onMsg = (e) => { if (e.source === window && e.data && e.data.__vmr === 'result' && e.data.reqId === reqId) { cleanup(); resolve(e.data); } };
    const to = setTimeout(() => { cleanup(); resolve({ ok: false, error: 'timeout' }); }, timeoutMs);
    window.addEventListener('message', onMsg);
    try { window.postMessage({ __vmr: 'exec', reqId, uid, method, endpoint, body }, '*'); }
    catch (e) { cleanup(); resolve({ ok: false, error: String(e) }); }
  });
}

// Recupere les annonces actuellement EN LIGNE d'un compte (sa "penderie").
// Endpoint reel confirme : GET /api/v2/wardrobe/{profil_id}/items.
// ATTENTION : la penderie utilise l'ID DE PROFIL Vinted (celui du /member/...),
// PAS le vinted_user_id stocke par l'extension (qui est l'account_id du token,
// un nombre different). Avec le mauvais id, Vinted renvoie 0 annonce alors que
// le compte en a. On resout donc d'abord le vrai id via users/current, puis on
// le garde en cache memoire sur l'objet compte (1 seul appel supplementaire).
const mapWardrobeItem = (it) => ({
  id: String(it.id),
  title: it.title || '',
  price: it.price?.amount ?? (typeof it.price === 'number' ? it.price : null),
  currency: it.price?.currency_code || 'EUR',
  // Certaines annonces ont photo=null mais une liste photos[] : on prend la 1re.
  photo: it.photo?.url || it.photo?.thumbnails?.[0]?.url
       || it.photos?.[0]?.url || it.photos?.[0]?.thumbnails?.[0]?.url || null,
  url: it.url || null,
  // Champs "à la Vinted" pour un affichage proche du site.
  brand: it.brand_title || it.brand?.title || null,
  size: it.size_title || it.size?.title || null,
  condition: it.status || null,
  // Engagement (défensif : présent sur la plupart des articles wardrobe, mais on
  // ne suppose rien — n'affiché que si c'est bien un nombre). Précieux pour un
  // revendeur : beaucoup de vues sans vente = prix trop haut ; favoris = proche
  // de vendre. Voir badges dans l'onglet Annonces.
  views: Number.isFinite(it.view_count) ? it.view_count : null,
  favourites: Number.isFinite(it.favourite_count) ? it.favourite_count
            : (Number.isFinite(it.favourites_count) ? it.favourites_count : null),
  // Timestamp de mise en ligne (secondes epoch) si Vinted le fournit -> "âge".
  createdTs: Number.isFinite(it.created_at_ts) ? it.created_at_ts
           : (it.photo?.high_resolution?.timestamp && Number.isFinite(it.photo.high_resolution.timestamp) ? it.photo.high_resolution.timestamp : null),
});
// Une annonce est reellement EN LIGNE si elle n'est ni fermee (vendue/retiree),
// ni masquee, ni un brouillon. La penderie Vinted renvoie AUSSI les articles
// vendus/fermes (is_closed=true) : on ne veut garder que les actives.
const isOnlineListing = (it) => it && !it.is_closed && !it.is_hidden && !it.is_draft;
const fetchVintedListings = async (account, page = 1, opts = {}) => {
  // 1) Données moissonnées par l'extension (aucun appel Vinted). Tu dois avoir
  //    ouvert ta boutique/ton dressing sur vinted.fr pour qu'elles existent.
  //    opts.force = on saute la moisson pour aller chercher le dernier état
  //    directement sur Vinted (bouton "Synchroniser").
  if (page === 1 && !opts.force) {
    const h = await fetchHarvest(account.vinted_user_id, 'listings');
    if (h && Array.isArray(h.items)) {
      return { ok: true, items: h.items.filter(isOnlineListing).map(mapWardrobeItem), pagination: h.pagination || null, source: 'harvest' };
    }
  }
  // Mode "moisson seulement" : aucun appel Vinted.
  if (opts.harvestOnly) return { ok: true, items: [], pagination: null, source: 'harvest' };
  // 2) Repli : proxy. La penderie utilise l'ID DE PROFIL (celui du /member/…),
  //    différent du vinted_user_id (account_id du token) — sinon 0 annonce.
  let profileId = account._vintedProfileId;
  if (!profileId) {
    const who = await vintedApiCall(account, '/api/v2/users/current');
    profileId = who?.data?.user?.id;
    if (profileId) account._vintedProfileId = profileId;
  }
  if (!profileId) return { ok: false, error: 'Profil Vinted introuvable', items: [], pagination: null };
  const res = await vintedApiCall(account, `/api/v2/wardrobe/${profileId}/items?page=${page}&per_page=40&order=relevance`);
  if (!res.ok) return { ok: false, error: res.status || res.error, items: [], pagination: null };
  const items = (res.data?.items || []).filter(isOnlineListing).map(mapWardrobeItem);
  return { ok: true, items, pagination: res.data?.pagination || null };
};

// Detecte un numero de paire ecrit dans un titre Vinted, au format "nXX",
// "n XX" ou "n°XX" (ex: "Adidas spezial n20" -> "20"). Sert UNIQUEMENT de
// suggestion lors de l'import : l'attribution du numero reste manuelle.
const extractPairNumber = (text) => {
  if (!text) return null;
  const m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(text);
  return m ? m[1] : null;
};

// Annote un bordereau (PDF) en imprimant le NUMERO de la paire (en gros) et le
// TITRE en bas de la premiere page, sur un bandeau blanc, puis declenche le
// telechargement. But : ne pas se tromper de paire quand on prepare un envoi.
// Lit la taille (en points PDF) de la 1re page — sert d'empreinte de "format"
// de bordereau (chaque transporteur a des dimensions d'étiquette différentes).
const readPdfFirstPageSize = async (pdfArrayBuffer) => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(pdfArrayBuffer);
  const { width, height } = pdf.getPages()[0].getSize();
  return { width, height };
};
// Empreinte de format = dimensions arrondies (ex "210x297").
const bordereauFormatKey = (w, h) => `${Math.round(w)}x${Math.round(h)}`;
// Emplacement par défaut intelligent du tampon : en HAUT À GAUCHE. Sur le
// bordereau Vinted (A4 : instructions en haut, étiquette/code-barres en bas),
// le haut est vide -> on ne recouvre jamais le code-barres. Fonctionne aussi
// pour les autres formats (le haut est presque toujours dégagé).
const smartDefaultBordPos = (w, h) => ({ xr: 0.05, yr: 0.02 });

// pdf-lib est charge dynamiquement (import()) pour ne pas alourdir le bundle
// initial - il n'est telecharge que la 1re fois qu'on genere un bordereau.
// `pos` = { xr, yr } position (ratio 0..1, coin haut-gauche du tampon, yr depuis
// le HAUT) choisie par l'utilisateur pour CE format. Si absent -> bandeau en bas
// (comportement historique).
const annotateAndDownloadBordereau = async (numero, title, pdfArrayBuffer, pos) => {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.load(pdfArrayBuffer);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.getPages()[0];
  const { width, height } = first.getSize();
  const hasNum = numero != null && String(numero).trim() !== '';
  if (pos && typeof pos.xr === 'number') {
    // Tampon positionné : cartouche blanc + bord noir. N° (si présent) + titre.
    const boxW = Math.min(width * 0.62, 230);
    const boxH = 46;
    let x = pos.xr * width, yTop = pos.yr * height;
    x = Math.max(2, Math.min(width - boxW - 2, x));
    let y = height - yTop - boxH; // origine PDF en bas à gauche
    y = Math.max(2, Math.min(height - boxH - 2, y));
    first.drawRectangle({ x, y, width:boxW, height:boxH, color: rgb(1,1,1), borderColor: rgb(0,0,0), borderWidth:1.5 });
    const maxChars = Math.max(16, Math.floor((boxW - 16) / 5));
    const t = (title || '').slice(0, maxChars);
    if (hasNum) {
      first.drawText(`N° ${numero}`, { x:x+8, y:y+boxH-26, size:20, font:bold, color:rgb(0,0,0) });
      if (t) first.drawText(t, { x:x+8, y:y+6, size:9, font:reg, color:rgb(0.12,0.12,0.12) });
    } else if (t) {
      // Pas de numéro : le titre prend toute la place, plus gros.
      first.drawText(t.slice(0, Math.max(20, Math.floor((boxW-16)/6.5))), { x:x+8, y:y+boxH/2-6, size:13, font:bold, color:rgb(0,0,0) });
    }
  } else {
    const bandH = 74;
    first.drawRectangle({ x:0, y:0, width, height:bandH, color: rgb(1,1,1) });
    first.drawRectangle({ x:0, y:bandH, width, height:2, color: rgb(0,0,0) });
    const maxChars = Math.max(20, Math.floor((width - 36) / 6.2));
    const t = (title || '').slice(0, maxChars);
    if (hasNum) {
      first.drawText(`N° ${numero}`, { x:18, y:bandH-38, size:32, font:bold, color:rgb(0,0,0) });
      if (t) first.drawText(t, { x:18, y:12, size:12, font:reg, color:rgb(0.12,0.12,0.12) });
    } else if (t) {
      first.drawText(t, { x:18, y:bandH-46, size:20, font:bold, color:rgb(0.08,0.08,0.08) });
    }
  }
  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type:'application/pdf' });
  const url = URL.createObjectURL(blob);
  const safeTitle = (title||'').replace(/[^\w\-]+/g,'_').slice(0,40);
  const filename = `bordereau${hasNum?'-N'+numero:''}${safeTitle?'-'+safeTitle:''}.pdf`;
  // Sur ordinateur, on déclenche le téléchargement direct. Sur iOS/iPhone, le
  // `download` programmatique ne marche pas (le dossier reste vide) -> on renvoie
  // l'URL pour que l'appelant affiche un bouton « Ouvrir » (vrai geste utilisateur).
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if (!isIOS) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return { url, filename };
};

// Génère un JUSTIFICATIF D'ACHAT (PDF) à partir des données de la commande —
// utile pour le registre d'achats d'un pro (surtout en régime de la marge, où
// l'achat à un particulier n'a pas de facture TVA mais doit être tracé). Ce
// n'est pas la facture officielle Vinted, mais un récapitulatif daté et complet.
const generateAchatJustificatif = async (o, opts = {}) => {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 560]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();
  let y = height - 48;
  const line = (label, val, o2={}) => {
    page.drawText(label, { x:32, y, size:9, font:reg, color:rgb(0.45,0.45,0.45) });
    page.drawText(String(val==null?'—':val), { x:32, y:y-15, size:o2.big?15:12, font:o2.big?bold:reg, color:rgb(0.1,0.1,0.1) });
    y -= o2.gap || 40;
  };
  page.drawText('Justificatif d\'achat', { x:32, y, size:20, font:bold, color:rgb(0,0.47,0.51) }); y -= 14;
  page.drawText(opts.shop || 'Shop Cancale35', { x:32, y, size:10, font:reg, color:rgb(0.45,0.45,0.45) }); y -= 30;
  page.drawRectangle({ x:32, y, width:356, height:2, color:rgb(0.9,0.9,0.9) }); y -= 24;
  line('Date d\'achat', o.date ? new Date(o.date).toLocaleDateString('fr-FR') : '—');
  line('N° de transaction Vinted', o.transaction_id || '—');
  line('Vendeur', o.seller || o.user_login || o.opposite_user?.login || '—');
  line('Article', o.title || '—');
  line('Montant payé (TTC)', o.price?.amount!=null ? `${Number(o.price.amount).toFixed(2)} ${o.price.currency_code==='EUR'?'€':o.price.currency_code||''}` : '—', { big:true });
  line('Compte acheteur', opts.account || '—');
  y -= 6;
  const note = opts.regime==='marge'
    ? 'Achat de seconde main a un particulier : pas de TVA deductible. A conserver pour le regime de la marge (TVA sur la marge a la revente).'
    : 'Justificatif d\'achat a conserver avec ta comptabilite.';
  // Retour à la ligne simple.
  const wrap = (txt, max) => { const words=txt.split(' '); const rows=[]; let cur=''; for(const w of words){ if((cur+' '+w).trim().length>max){ rows.push(cur.trim()); cur=w; } else cur+=' '+w; } if(cur.trim()) rows.push(cur.trim()); return rows; };
  wrap(note, 62).forEach((r,i)=> page.drawText(r, { x:32, y:y-i*13, size:8.5, font:reg, color:rgb(0.5,0.5,0.5) }));

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type:'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `justificatif-achat-${o.transaction_id || (o.title||'').replace(/[^\w\-]+/g,'_').slice(0,24)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
};

// Synchro avec Google Sheets
async function syncFromSheets() {
  try {
    const r = await fetch(API_URL);
    const data = await r.json();
    if (data.error) { console.error('Sync error:', data.error); return null; }
    if (data.catalog && data.catalog.length > 0) save('vinted_catalog', data.catalog);
    if (data.sales && data.sales.length > 0) save('vinted_sales', data.sales);
    if (data.garageGrid && Object.keys(data.garageGrid).length > 0) save('vinted_garage_grid', data.garageGrid);
    return data;
  } catch (err) {
    console.error('Sync failed:', err);
    return null;
  }
}

async function syncToSheets(catalog, sales, garageGrid) {
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ catalog, sales, garageGrid })
    });
    return true;
  } catch (err) {
    console.error('Sync up failed:', err);
    return false;
  }
}
const fmt  = n => isNaN(+n)?'—':Number(n).toFixed(2).replace('.',',')+' €';
const fmtN = n => isNaN(+n)?'—':Number(n).toFixed(2).replace('.',',');
const uid  = () => Math.random().toString(36).slice(2,9);
const tod  = () => new Date().toLocaleDateString('fr-FR');

const KNOWN_BRANDS=['New Balance','Under Armour','Air Jordan','Le Coq Sportif','Sergio Tacchini',
  'Nike','Adidas','Asics','Jordan','Puma','Reebok','Vans','Converse','Lacoste','Wilson',
  'Babolat','Head','Yonex','Salomon','Brooks','Hoka','Mizuno','Fila','Saucony','New Era',
  'Kappa','Hummel','Umbro','Ellesse','Diadora','Lotto'];
function extractBrand(text){
  if(!text) return null;
  const t=text.toLowerCase();
  for(const b of KNOWN_BRANDS){if(t.includes(b.toLowerCase())) return b;}
  return null;
}
// Extrait une pointure (taille chaussure) depuis un titre d'annonce. Heuristique
// volontairement prudente : "taille 42", "T42", "pointure 40", ou un nombre isolé
// dans la plage 34–52 (les modèles Nike 90/95/97/270… sont hors plage → ignorés).
// Demi-pointures gérées (42,5). Sert uniquement aux stats de sourcing (approximatif).
function extractSize(text){
  if(!text) return null;
  const t=String(text).toLowerCase().replace(',','.');
  const grab=(m)=> m ? m[1]+(/\.5/.test(m[0])?'.5':'') : null;
  let m=t.match(/(?:taille|pointure|t|eu|fr)\s*\.?\s*(3[4-9]|4[0-9]|5[0-2])(?:\.5)?/);
  if(m) return grab(m);
  m=t.match(/(?:^|[^0-9.])(3[4-9]|4[0-9]|5[0-2])(?:\.5)?(?:[^0-9]|$)/);
  return grab(m);
}
const COUNTRY_MAP_DATA=[
  [['france'],'France'],[['allemagne','deutschland','germany'],'Allemagne'],
  [['belgique','belgium','belgie'],'Belgique'],[['espagne','españa','spain','espana'],'Espagne'],
  [['italie','italia','italy'],'Italie'],[['pays-bas','nederland','netherlands','holland'],'Pays-Bas'],
  [['suisse','schweiz','switzerland'],'Suisse'],[['luxembourg'],'Luxembourg'],
  [['autriche','österreich','austria','osterreich'],'Autriche'],[['portugal'],'Portugal'],
  [['pologne','poland','polska'],'Pologne'],[['roumanie','romania'],'Roumanie'],
  [['suede','sweden','sverige'],'Suède'],[['danemark','denmark','danmark'],'Danemark'],
  [['tchequie','czech','tschechien'],'Tchéquie'],
];
function extractCountry(address){
  if(!address) return 'France';
  const lines=address.split(/[\n,]+/).map(l=>l.trim().toLowerCase()).filter(Boolean);
  for(const line of [...lines].reverse()){
    for(const [keys,name] of COUNTRY_MAP_DATA){
      if(keys.some(k=>line.includes(k))) return name;
    }
  }
  return 'France';
}
function getISOWeekKey(){
  const d=new Date();const day=d.getDay()||7;
  d.setDate(d.getDate()+4-day);
  const y=d.getFullYear();
  const wk=Math.ceil(((d-new Date(y,0,1))/864e5+1)/7);
  return `${y}-W${String(wk).padStart(2,'0')}`;
}

// ── Notifications ──────────────────────────────────────
// Demande la permission d'envoyer des notifications (à appeler sur action utilisateur).
function askNotifPermission(){
  if(typeof Notification==='undefined') return Promise.resolve('unsupported');
  if(Notification.permission==='granted') return Promise.resolve('granted');
  return Notification.requestPermission().catch(()=>'denied');
}
// Envoie une notification navigateur si autorisée (app ouverte / en arrière-plan récent).
function pushNotif(title, body){
  try{
    if(typeof Notification!=='undefined' && Notification.permission==='granted'){
      new Notification(title, { body, icon:'/icon-192.png', badge:'/icon-192.png' });
      return true;
    }
  }catch(_){/* ignore */}
  return false;
}


// Garage : une seule zone neutre. L'utilisateur ajoute lui-même ses colonnes
// via le bouton +. La porte est optionnelle (bouton afficher/masquer).
// On démarre avec 1 colonne ; tout le reste s'ajoute à la main.
const LAYOUT = [
  {id:"zone", name:"", elev:0, cols:[25]},
];
const TOTAL_SLOTS = LAYOUT.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0);

// Garage vide par défaut
const INIT_GARAGE = {};

/* ── Editable cell ───────────────────────────────────── */
function Cell({value, onChange, align="left", mono=false}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const commit = () => { setEditing(false); if(String(val)!==String(value)) onChange(val); };
  if(editing) return (
    <input autoFocus value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(value);setEditing(false);}}}
      style={{background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,
        color:C.text,padding:'3px 6px',fontSize:12,fontFamily:'inherit',
        width:'100%',boxSizing:'border-box',textAlign:align,outline:'none'}}
    />
  );
  return (
    <span onClick={()=>{setVal(value);setEditing(true);}} title="Cliquer pour modifier"
      style={{cursor:'text',display:'block',padding:'3px 6px',borderRadius:8,minHeight:22,
        textAlign:align,fontFamily:mono?'monospace':'inherit'}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >{value||<span style={{color:C.muted,fontSize:10}}>—</span>}</span>
  );
}

/* ── UI ──────────────────────────────────────────────── */
function Btn({children,onClick,color,small,danger,outline,disabled,style={}}) {
  const bg=outline?'transparent':(danger?C.danger:(color||C.accent));
  const col=outline?(color||C.accent):(color?'#fff':C.onAccent);
  return (
    <button type="button" onClick={onClick} disabled={!!disabled} style={{
      background:bg,color:col,
      border:outline?`1.5px solid ${color||C.accent}`:'none',
      borderRadius:6,padding:small?'6px 14px':'10px 22px',
      fontSize:small?12:14,fontWeight:700,
      cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,
      fontFamily:'inherit',...style,
    }}>{children}</button>
  );
}
function Input({label,...p}) {
  return (
    <label style={{display:'flex',flexDirection:'column',gap:4}}>
      {label&&<span style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>{label}</span>}
      <input {...p} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,
        color:C.text,padding:'8px 12px',fontSize:13,outline:'none',fontFamily:'inherit',...(p.style||{})}}
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.border}
      />
    </label>
  );
}
function Card({children,style={}}) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,...style}}>{children}</div>;
}
function Badge({children,color}) {
  return <span style={{display:'inline-block',padding:'2px 10px',borderRadius:999,background:color+'22',color,fontSize:11,fontWeight:700}}>{children}</span>;
}
function StatBox({label,value,color=C.text,sub=null}) {
  return (
    <Card style={{flex:1,minWidth:110}}>
      <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{label}</div>
      <div style={{fontSize:18,fontWeight:800,color,lineHeight:1.2}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{sub}</div>}
    </Card>
  );
}
function PieChartSVG({data,size=160}){
  const total=data.reduce((s,d)=>s+d.v,0);
  if(total===0) return null;
  const cx=size/2,cy=size/2,r=size/2-8;
  let angle=-Math.PI/2;
  const slices=data.map(d=>{
    const a=(d.v/total)*2*Math.PI;
    const ea=angle+a;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
    const path=`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a>Math.PI?1:0},1 ${x2},${y2} Z`;
    angle=ea;
    return {...d,path};
  });
  return(
    <svg width={size} height={size} style={{display:'block',flexShrink:0}}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1.5}/>)}
    </svg>
  );
}

/* ── Nav ─────────────────────────────────────────────── */
const LOGO_CANCALE = "data:image/jpeg;base64,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";

const TABS=[
  {id:'dashboard',icon:'📊',label:'Stats'},
  {id:'comptabilite',icon:'💸',label:'Comptabilité'},
  {id:'invoices', icon:'📄',label:'Factures'},
  {id:'garage',   icon:'🏠',label:'Garage'},
  {id:'vintedaccounts',icon:'🔗',label:'Comptes Vinted'},
];
// Barre de navigation du bas (façon Vinted) : un onglet dédié par catégorie.
// Défilable horizontalement (plus de 5 entrées).
const BOTTOM_TABS=[
  {id:'dashboard',    icon:'📊',label:'Stats'},
  {id:'cat_annonces', icon:'🟢',label:'Annonces'},
  {id:'cat_ventes',   icon:'💸',label:'Ventes'},
  {id:'cat_achats',   icon:'🛍️',label:'Achats'},
  {id:'cat_bord',     icon:'📄',label:'Bordereaux'},
  {id:'cat_msg',      icon:'💬',label:'Messages'},
  {id:'garage',       icon:'🏠',label:'Garage'},
  {id:'invoices',     icon:'🧾',label:'Factures'},
];
function BottomBar({tab,setTab}) {
  return (
    <nav style={{position:'fixed',left:0,right:0,bottom:0,zIndex:60,display:'flex',overflowX:'auto',
      background:C.surface,borderTop:`1px solid ${C.border}`,boxShadow:'0 -2px 10px rgba(0,0,0,0.08)',
      paddingBottom:'env(safe-area-inset-bottom)',WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
      {BOTTOM_TABS.map(t=>{ const on=tab===t.id; return (
        <button key={t.id} type="button" onClick={()=>setTab(t.id)} aria-label={t.label} aria-current={on?'page':undefined} style={{
          flex:'1 0 auto',minWidth:64,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'8px 6px 7px',
          background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',
          color:on?C.accent:C.muted}}>
          <span aria-hidden="true" style={{fontSize:20,lineHeight:1,opacity:on?1:0.65}}>{t.icon}</span>
          <span style={{fontSize:10,fontWeight:on?800:600,whiteSpace:'nowrap'}}>{t.label}</span>
        </button>
      );})}
    </nav>
  );
}
// Ancienne application : le catalogue et les ventes historiques restent
// accessibles (les stats du tableau de bord les lisent toujours) mais sont
// ranges a part, hors du flux principal, comme demande.
const ARCHIVE_TABS=[
  {id:'catalog',  icon:'📦',label:'Ancien catalogue'},
  {id:'sales',    icon:'💸',label:'Anciennes ventes'},
];
function Nav({tab,setTab,open,setOpen}) {
  if(!open) return null;
  return (
    <>
      {/* Voile pour fermer en cliquant à côté */}
      <div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:59,background:'rgba(0,0,0,0.25)'}}/>
      {/* Panneau déroulant */}
      <nav style={{
        position:'fixed',top:0,left:0,bottom:0,zIndex:60,width:'min(78vw,280px)',
        background:C.surface,borderRight:`1px solid ${C.border}`,
        boxShadow:'2px 0 16px rgba(0,0,0,0.12)',display:'flex',flexDirection:'column',
        padding:'14px 10px',gap:2,
      }}>
        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1.5,fontWeight:700,padding:'6px 12px 10px'}}>Menu</div>
        {TABS.map(t=>{
          const on=tab===t.id;
          return (
            <button key={t.id} type="button" onClick={()=>{setTab(t.id);setOpen(false);}} style={{
              display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',
              padding:'12px 14px',cursor:'pointer',
              background:on?C.accent:'transparent',
              color:on?C.onAccent:C.text,
              border:'none',borderRadius:6,fontFamily:'inherit',
              fontSize:14,fontWeight:on?800:600,transition:'background .12s',
            }}>
              <span style={{fontSize:17,lineHeight:1}}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}

        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1.5,fontWeight:700,padding:'18px 12px 8px',marginTop:'auto',borderTop:`1px solid ${C.border}`}}>Ancienne application</div>
        {ARCHIVE_TABS.map(t=>{
          const on=tab===t.id;
          return (
            <button key={t.id} type="button" onClick={()=>{setTab(t.id);setOpen(false);}} style={{
              display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',
              padding:'10px 14px',cursor:'pointer',
              background:on?C.accent:'transparent',
              color:on?C.onAccent:C.muted,
              border:'none',borderRadius:6,fontFamily:'inherit',
              fontSize:13,fontWeight:on?800:600,
            }}>
              <span style={{fontSize:15,lineHeight:1}}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

/* ── Sparkline ───────────────────────────────────────── */
function Sparkline({data,color=C.accent,h=60}) {
  if(!data||data.length<2) return null;
  const W=400,H=h;
  const max=Math.max(...data,0.01), min=Math.min(...data,0), range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-((v-min)/range)*(H-10)-5}`).join(' ');
  const area=`0,${H} ${pts} ${W},${H}`;
  const id='g'+color.replace('#','');
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <polygon points={area} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Month curve ─────────────────────────────────────── */
function MonthChart({sales}) {
  const monthly=useMemo(()=>{
    const m={};
    sales.forEach(v=>{
      const p=(v.saleDate||''). split('/');
      if(p.length!==3) return;
      const k=p[1]+'/'+p[2];
      if(!m[k]) m[k]={ca:0,profit:0};
      m[k].ca+=+v.sellPrice;
      m[k].profit+=(+v.sellPrice-+v.buyPrice);
    });
    return m;
  },[sales]);
  const keys=Object.keys(monthly).sort((a,b)=>{
    const [ma,ya]=a.split('/'); const [mb,yb]=b.split('/');
    return new Date(ya,ma-1)-new Date(yb,mb-1);
  }).slice(-12);
  if(keys.length<2) return <div style={{color:C.muted,fontSize:13}}>Pas assez de données.</div>;
  const caD=keys.map(k=>monthly[k].ca), pD=keys.map(k=>monthly[k].profit);
  const maxCA=Math.max(...caD,1);
  const W=500,H=120;
  const toP=(data,max)=>data.map((v,i)=>`${(i/(data.length-1))*W},${H-((Math.max(v,0)/max)*(H-16))-8}`).join(' ');
  return (
    <div style={{overflowX:'auto'}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H+24}`} preserveAspectRatio="none" style={{display:'block',minWidth:300}}>
        <defs>
          <linearGradient id="gCA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.2"/><stop offset="100%" stopColor={C.accent} stopOpacity="0"/></linearGradient>
          <linearGradient id="gP2"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.warn}   stopOpacity="0.2"/><stop offset="100%" stopColor={C.warn}   stopOpacity="0"/></linearGradient>
        </defs>
        <polygon points={`0,${H} ${toP(caD,maxCA)} ${W},${H}`} fill="url(#gCA2)"/>
        <polyline points={toP(caD,maxCA)} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round"/>
        <polygon points={`0,${H} ${toP(pD,maxCA)} ${W},${H}`} fill="url(#gP2)"/>
        <polyline points={toP(pD,maxCA)} fill="none" stroke={C.warn} strokeWidth="2" strokeLinejoin="round" strokeDasharray="5,3"/>
        {keys.map((k,i)=><text key={k} x={(i/(keys.length-1))*W} y={H+16} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="monospace">{k}</text>)}
        {caD.map((v,i)=><circle key={i} cx={(i/(caD.length-1))*W} cy={H-((Math.max(v,0)/maxCA)*(H-16))-8} r={3} fill={C.accent}/>)}
      </svg>
      <div style={{display:'flex',gap:16,fontSize:11,marginTop:4}}>
        <span style={{color:C.accent}}>— CA</span>
        <span style={{color:C.warn}}>- - Bénéfice</span>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────── */
// Détail des ventes d'un mois (affiché au clic sur une barre du graphique)
function MonthDetail({mois,type,C,fmt,catMap,catalog,onClose}){
  // Construit le nom de chaque paire depuis le catalogue (si dispo)
  const catName={};
  (catalog||[]).forEach(p=>{ if(p.name) catName[p.id]=p.name; });
  const ventes=[...(mois.ventes||[])].sort((a,b)=>{
    // tri par date (la plus récente d'abord) selon le type de graphique
    const da=(type==='encaisse'?a.receiveDate:a.saleDate)||'';
    const db=(type==='encaisse'?b.receiveDate:b.saleDate)||'';
    return db.localeCompare(da);
  });
  const totalCA=ventes.reduce((s,v)=>s+(+v.sellPrice||0),0);
  const totalProfit=ventes.reduce((s,v)=>s+((+v.sellPrice||0)-(+v.buyPrice||0)),0);
  return (
    <div style={{marginTop:16,padding:14,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:800,color:C.text}}>{mois.nomComplet} — {ventes.length} vente{ventes.length>1?'s':''}</span>
        <span onClick={onClose} style={{cursor:'pointer',color:C.muted,fontSize:18,fontWeight:700,lineHeight:1}}>×</span>
      </div>
      <div style={{display:'flex',gap:16,marginBottom:12,fontSize:12}}>
        <span style={{color:C.text}}>CA : <b>{fmt(totalCA)}</b></span>
        <span style={{color:C.accent}}>Bénéfice : <b>{fmt(totalProfit)}</b></span>
      </div>
      <div style={{maxHeight:260,overflowY:'auto'}}>
        {ventes.map((v,i)=>{
          const nom=catName[v.productId]||(v.productId?('Paire '+v.productId):'—');
          const dateAff=(type==='encaisse'?v.receiveDate:v.saleDate)||'';
          const benef=(+v.sellPrice||0)-(+v.buyPrice||0);
          return (
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:C.text,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nom}</div>
                <div style={{color:C.muted,fontSize:10}}>{dateAff}{v.productId?` · n°${v.productId}`:''}</div>
              </div>
              <div style={{textAlign:'right',marginLeft:10}}>
                <div style={{color:C.text,fontWeight:700}}>{fmt(+v.sellPrice||0)}</div>
                <div style={{color:benef>=0?C.accent:C.warn,fontSize:10}}>{benef>=0?'+':''}{fmt(benef)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Carte d'accueil affichée tant qu'aucun compte Vinted n'est connecté : guide
// le nouvel utilisateur en 3 étapes (installer l'extension, se connecter sur
// Vinted, revenir). Disparaît d'elle-même dès qu'un compte est capté.
function Onboarding({ setTab }) {
  const steps = [
    { n:1, t:'Installe l\'extension Chrome', d:'« Shop Cancale35 – Vinted Sync » (mode développeur). Elle synchronise tes données Vinted en toute discrétion, sans jamais toucher à ton mot de passe.' },
    { n:2, t:'Connecte-toi sur vinted.fr', d:'Ouvre ta boutique une fois, connecté. L\'extension capte automatiquement ton compte et tes annonces — aucune manip supplémentaire.' },
    { n:3, t:'Reviens ici', d:'Tes annonces, ventes, achats et messages apparaissent tout seuls. Mets un numéro sur chaque paire pour la retrouver au garage et sur le bordereau.' },
  ];
  return (
    <div style={{padding:'20px 16px 8px'}}>
      <div style={{borderRadius:18,border:`1px solid ${C.border}`,background:C.card,padding:'22px 20px',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
        <div style={{fontSize:22,fontWeight:900,color:C.text,marginBottom:2}}>Bienvenue sur VRM 👋</div>
        <div style={{fontSize:12,fontWeight:700,color:C.accent,letterSpacing:0.3,marginBottom:8}}>Vendre · Ranger · Marge</div>
        <div style={{fontSize:14,color:C.muted,lineHeight:1.5,marginBottom:20}}>
          Le CRM des revendeurs Vinted : vends tes paires, range-les au garage, suis ta marge. Connecte ton compte Vinted pour commencer — c'est parti en 3 étapes :
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {steps.map(s=>(
            <div key={s.n} style={{display:'flex',gap:14,alignItems:'flex-start'}}>
              <div style={{flexShrink:0,width:32,height:32,borderRadius:999,background:C.accent,color:C.onAccent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900}}>{s.n}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:15,fontWeight:800,color:C.text}}>{s.t}</div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.45,marginTop:2}}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={()=>setTab('vintedaccounts')}
          style={{marginTop:22,width:'100%',background:C.accent,color:C.onAccent,border:'none',borderRadius:12,padding:'13px 16px',cursor:'pointer',fontSize:15,fontWeight:800}}>
          Voir mes comptes connectés
        </button>
        <div style={{fontSize:11.5,color:C.muted,textAlign:'center',marginTop:12,lineHeight:1.4}}>
          Déjà des données ailleurs ? Va dans ⚙️ Paramètres → Importer pour les récupérer.
        </div>
      </div>
    </div>
  );
}

function Dashboard({catalog,sales,garageGrid,invoices,liveStats,onGo}) {
  // Mois sélectionné au clic sur un graphique (affiche le détail des ventes)
  const [selMonthEnc,setSelMonthEnc]=useState(null);   // graphique encaissé
  const [selMonthVente,setSelMonthVente]=useState(null); // graphique date de vente

  // Paires réellement présentes dans le garage (mémorisé)
  const garageVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='').map(v=>v.trim()),
  [garageGrid]);
  
  // Map id -> buyPrice depuis le catalogue (mémorisé)
  const catMap=useMemo(()=>{
    const m={};
    catalog.forEach(p=>{m[p.id]=+p.buyPrice;});
    return m;
  },[catalog]);
  
  // Stock & valeur (mémorisés)
  const stockCount=garageVals.length;
  const stockValue=useMemo(()=>garageVals.reduce((s,id)=>s+(catMap[id]||0),0),[garageVals,catMap]);
  const freeSlots=TOTAL_SLOTS-stockCount;
  const fillRate=Math.round((stockCount/TOTAL_SLOTS)*100);
  
  const totalSold=useMemo(()=>catalog.filter(p=>p.status==='vendu').length,[catalog]);
  const encaissees=useMemo(()=>sales.filter(v=>v.receiveDate&&v.receiveDate.trim()!==''),[sales]);
  const ca=useMemo(()=>encaissees.reduce((s,v)=>s+ +v.sellPrice,0),[encaissees]);
  const profit=useMemo(()=>encaissees.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[encaissees]);
  const enAttente=useMemo(()=>sales.filter(v=>!v.receiveDate||v.receiveDate.trim()===''),[sales]);
  const caAttente=useMemo(()=>enAttente.reduce((s,v)=>s+ +v.sellPrice,0),[enAttente]);
  const avgX=useMemo(()=>encaissees.length?(encaissees.reduce((s,v)=>s+ +v.multi,0)/encaissees.length).toFixed(2):'—',[encaissees]);
  const avgMargin=ca>0?((profit/ca)*100).toFixed(1):'0';
  const avgSale=encaissees.length?(ca/encaissees.length):0;
  const avgProfit=encaissees.length?(profit/encaissees.length):0;

  const PIE_COLORS=['#1f7a55','#3f7fae','#b07d18','#7a6ad0','#c34a4a','#2aa198','#6c71c4','#d33682','#268bd2','#cb4b16'];

  const brandStats=useMemo(()=>{
    const map={};
    invoices.forEach(inv=>{
      const b=extractBrand(inv.itemName)||extractBrand(inv.productId);
      if(b) map[b]=(map[b]||0)+1;
    });
    sales.forEach(s=>{
      const pid=String(s.productId||'');
      if(!/^\d+(\+\d+)*$/.test(pid.trim())){
        const b=extractBrand(pid);
        if(b) map[b]=(map[b]||0)+1;
      }
    });
    const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    const top7=sorted.slice(0,7);
    const rest=sorted.slice(7).reduce((s,x)=>s+x[1],0);
    const items=top7.map(([k,v],i)=>({label:k,v,color:PIE_COLORS[i%PIE_COLORS.length]}));
    if(rest>0) items.push({label:'Autre',v:rest,color:'#aaa'});
    return items;
  },[invoices,sales]);

  const countryStats=useMemo(()=>{
    const map={};
    invoices.forEach(inv=>{
      const c=extractCountry(inv.buyerAddress);
      map[c]=(map[c]||0)+1;
    });
    const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    return sorted.map(([k,v],i)=>({label:k,v,color:PIE_COLORS[i%PIE_COLORS.length]}));
  },[invoices]);

  const weeklyRecapData=useMemo(()=>{
    const today=new Date();
    const day=today.getDay()||7;
    const lastMon=new Date(today);lastMon.setDate(today.getDate()-day-6);lastMon.setHours(0,0,0,0);
    const lastSun=new Date(today);lastSun.setDate(today.getDate()-day);lastSun.setHours(23,59,59,999);
    const parseDt=s=>{if(!s)return null;const p=s.split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):null;};
    const ventes=encaissees.filter(v=>{const d=parseDt(v.receiveDate);return d&&d>=lastMon&&d<=lastSun;});
    const ca=ventes.reduce((s,v)=>s+ +v.sellPrice,0);
    const profit=ventes.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
    return{count:ventes.length,ca,profit,from:lastMon.toLocaleDateString('fr-FR'),to:lastSun.toLocaleDateString('fr-FR')};
  },[encaissees]);

  const monthlyRecapData=useMemo(()=>{
    const today=new Date();
    const prevM=today.getMonth()===0?11:today.getMonth()-1;
    const prevY=today.getMonth()===0?today.getFullYear()-1:today.getFullYear();
    const prevMM=String(prevM+1).padStart(2,'0');
    const prevY4=String(prevY);
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const ventes=encaissees.filter(v=>{const p=(v.receiveDate||'').split('/');return p.length===3&&p[1]===prevMM&&p[2]===prevY4;});
    const ca=ventes.reduce((s,v)=>s+ +v.sellPrice,0);
    const profit=ventes.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
    return{count:ventes.length,ca,profit,nom:`${moisNoms[prevM]} ${prevY4}`};
  },[encaissees]);

  const isoWeek=getISOWeekKey();
  const monthKey=new Date().toISOString().slice(0,7);
  const [showWeekly,setShowWeekly]=useState(()=>load('vinted_last_weekly_recap','')!==isoWeek);
  const [showMonthly,setShowMonthly]=useState(()=>load('vinted_last_monthly_recap','')!==monthKey);

  // Stats journalières basées sur la date de réception (CA encaissé) (mémorisé)
  const dayStats=useMemo(()=>{
    const ds={};
    encaissees.forEach(v=>{
      const dt=v.receiveDate||'';
      if(!dt) return;
      if(!ds[dt]) ds[dt]={ca:0,count:0,profit:0};
      ds[dt].ca+=+v.sellPrice;
      ds[dt].count++;
      ds[dt].profit+=(+v.sellPrice-+v.buyPrice);
    });
    return ds;
  },[encaissees]);
  const days=useMemo(()=>Object.entries(dayStats),[dayStats]);

  // (Estimation des cotisations URSSAF déplacée après moisCourant, voir plus bas)

  // CA et bénéfice du MOIS EN COURS (basé sur la date de réception JJ/MM/AAAA)
  const moisCourant=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    encaissees.forEach(v=>{
      const dt=(v.receiveDate||'').trim(); // format attendu JJ/MM/AAAA
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[encaissees]);

  // Cotisations + impôt du MOIS EN COURS : 13,5 % du CA encaissé du mois.
  // C'est la somme à payer à la fin du mois (versement libératoire).
  const TAUX_URSSAF=0.135;
  const urssafEstime=moisCourant.ca*TAUX_URSSAF;
  const netApresUrssaf=moisCourant.ca-urssafEstime;

  const bestDayCA=useMemo(()=>[...days].sort((a,b)=>b[1].ca-a[1].ca)[0],[days]);
  const bestDayProfit=useMemo(()=>[...days].sort((a,b)=>b[1].profit-a[1].profit)[0],[days]);
  const avgDayCA=days.length>0?ca/days.length:0;

  // Historique du CA ENCAISSÉ par mois (12 derniers mois, basé sur receiveDate)
  const caHistory=useMemo(()=>{
    const moisCourts=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    encaissees.forEach(v=>{
      const p=(v.receiveDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,label:moisCourts[parseInt(p[1],10)-1]||p[1],nomComplet:`${moisNoms[parseInt(p[1],10)-1]||p[1]} ${p[2]}`,ventes:[]};
        map[key].ca+=+v.sellPrice;
        map[key].ventes.push(v);
      }
    });
    return Object.keys(map).sort().slice(-12).map(k=>({key:k,label:map[k].label,nomComplet:map[k].nomComplet,ca:map[k].ca,ventes:map[k].ventes}));
  },[encaissees]);

  // Historique du CA par DATE DE VENTE (12 derniers mois, basé sur saleDate)
  const caHistoryVente=useMemo(()=>{
    const moisCourts=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    sales.forEach(v=>{
      const p=(v.saleDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,label:moisCourts[parseInt(p[1],10)-1]||p[1],nomComplet:`${moisNoms[parseInt(p[1],10)-1]||p[1]} ${p[2]}`,ventes:[]};
        map[key].ca+=+v.sellPrice;
        map[key].ventes.push(v);
      }
    });
    return Object.keys(map).sort().slice(-12).map(k=>({key:k,label:map[k].label,nomComplet:map[k].nomComplet,ca:map[k].ca,ventes:map[k].ventes}));
  },[sales]);

  // Paires ajoutées par jour (basé sur addedAt JJ/MM/AAAA).
  // On ignore la date d'init "01/01/2024" qui regroupe tout l'historique importé,
  // pour ne montrer que le rythme réel d'ajout jour après jour.
  const ajoutsParJour=useMemo(()=>{
    const map={};
    catalog.forEach(p=>{
      const d=(p.addedAt||'').trim();
      if(!d||d==='01/01/2024') return; // on saute l'historique initial
      const parts=d.split('/');
      if(parts.length!==3) return;
      const key=parts[2]+'-'+parts[1].padStart(2,'0')+'-'+parts[0].padStart(2,'0'); // AAAA-MM-JJ pour tri
      if(!map[key]) map[key]={count:0,label:`${parts[0]}/${parts[1]}`};
      map[key].count++;
    });
    // 30 derniers jours d'activité (ceux qui ont au moins une paire)
    return Object.keys(map).sort().slice(-30).map(k=>({key:k,count:map[k].count,label:map[k].label}));
  },[catalog]);

  // Récap comptable par MOIS (CA encaissé, bénéfice, cotisations + impôt 13,5 %)
  // Basé sur la date d'encaissement car c'est ce qui compte pour l'URSSAF.
  const moisRecap=useMemo(()=>{
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    encaissees.forEach(v=>{
      const p=(v.receiveDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,profit:0,count:0,annee:p[2],mois:parseInt(p[1],10)};
        map[key].ca+=+v.sellPrice; map[key].profit+=(+v.sellPrice-+v.buyPrice); map[key].count++;
      }
    });
    return Object.keys(map).sort().reverse().map(k=>({
      label:`${moisNoms[map[k].mois-1]||map[k].mois} ${map[k].annee}`,
      ca:map[k].ca, profit:map[k].profit, count:map[k].count,
      urssaf:map[k].ca*0.135, net:map[k].ca-map[k].ca*0.135
    }));
  },[encaissees]);

  // Téléchargement du récap comptable MENSUEL en CSV
  const exportCompta=()=>{
    try{
      const rows=[['Mois','Ventes','CA encaisse','Benefice','Cotisations+impot 13,5%','Net estime']];
      moisRecap.forEach(m=>rows.push([m.label,m.count,m.ca.toFixed(2),m.profit.toFixed(2),m.urssaf.toFixed(2),m.net.toFixed(2)]));
      const csv=rows.map(r=>r.join(';')).join('\n');
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download=`cancale-comptabilite-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }catch(err){ alert('Erreur export : '+err.message); }
  };

  // Carte avec icône et taille
  const StatCard=({icon,label,value,color=C.text,sub,gradient})=>(
    <div style={{
      flex:1,minWidth:140,
      background:gradient||C.card,
      border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 18px',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{fontSize:18,opacity:0.9}}>{icon}</span>
        <span style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1.5,fontWeight:600}}>{label}</span>
      </div>
      <div style={{fontSize:22,fontWeight:800,color,lineHeight:1.1,letterSpacing:-0.5}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>{sub}</div>}
    </div>
  );

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:18}}>
      <div>
        <h2 style={{margin:0,color:C.text,fontSize:24,fontWeight:800,letterSpacing:-0.5}}>Tableau de bord</h2>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>Vue d'ensemble de ton activité</div>
      </div>

      {/* Résumé Vinted EN DIRECT (cliquable) */}
      {liveStats && (
        <div>
          <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:8}}>Vinted en direct · ce mois</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:10}}>
            {[
              {k:'caMois', icon:'💸', label:'CA du mois', val:`${liveStats.caMois.toFixed(0)} €`, go:'cat_ventes', color:C.accent},
              {k:'enCours', icon:'⏳', label:'Ventes en cours', val:liveStats.enCours, go:'cat_ventes', color:C.warn},
              {k:'online', icon:'🟢', label:'Annonces en ligne', val:liveStats.online, go:'cat_annonces', color:C.blue||C.accent},
              {k:'unread', icon:'💬', label:'Messages non lus', val:liveStats.unread, go:'cat_msg', color:liveStats.unread>0?C.danger:C.muted},
            ].map(s=>(
              <button key={s.k} onClick={()=>onGo&&onGo(s.go)} style={{textAlign:'left',border:`1px solid ${C.border}`,background:C.card,borderRadius:14,padding:'12px 14px',cursor:'pointer',display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:16}}>{s.icon}</span>
                <span style={{fontSize:22,fontWeight:900,color:s.color,letterSpacing:-0.5}}>{s.val}</span>
                <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats principales */}
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        <StatCard icon="📦" label="Stock garage" value={stockCount} color={C.accent} sub={`${freeSlots} places libres`}/>
        <StatCard icon="💰" label="Valeur stock" value={fmt(stockValue)} color={C.warn} sub="prix d'achat total"/>
        <StatCard icon="✅" label="Vendues" value={totalSold} color={C.danger}/>
        <StatCard icon="💸" label="CA encaissé" value={fmt(ca)} color={C.text} sub={`${encaissees.length} ventes reçues`}/>
        <StatCard icon="📈" label="Bénéfice net" value={fmt(profit)} color={profit>=0?C.accent:C.danger} sub="argent reçu uniquement"/>
        <StatCard icon="🎯" label="Taux marge" value={`${avgMargin}%`} color={C.blue} sub="bénéf / CA"/>
      </div>

      {/* Mois en cours */}
      <Card style={{padding:18,background:C.card,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
          📅 Mois en cours — {moisCourant.nom}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:18}}>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>CA du mois</div>
            <div style={{fontSize:24,fontWeight:800,color:C.text,letterSpacing:-0.5}}>{fmt(moisCourant.ca)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Bénéfice du mois</div>
            <div style={{fontSize:24,fontWeight:800,color:moisCourant.profit>=0?C.accent:C.danger,letterSpacing:-0.5}}>{fmt(moisCourant.profit)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Ventes</div>
            <div style={{fontSize:24,fontWeight:800,color:C.muted,letterSpacing:-0.5}}>{moisCourant.count}</div>
          </div>
        </div>
      </Card>

      {/* Estimation cotisations du MOIS EN COURS */}
      <Card style={{padding:18,background:C.card,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.warn,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
          🧾 À payer pour {moisCourant.nom} (13,5 % du CA encaissé)
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:18}}>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Somme à payer ce mois</div>
            <div style={{fontSize:28,fontWeight:800,color:C.warn,letterSpacing:-0.5}}>{fmt(urssafEstime)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Net estimé après paiement</div>
            <div style={{fontSize:28,fontWeight:800,color:C.accent,letterSpacing:-0.5}}>{fmt(netApresUrssaf)}</div>
          </div>
        </div>
        <div style={{fontSize:10,color:C.muted,marginTop:10,lineHeight:1.5}}>
          Calculé sur le CA encaissé de {moisCourant.nom} ({fmt(moisCourant.ca)}). C'est la somme à verser à la fin du mois (versement libératoire). Vérifie ton taux sur autoentrepreneur.urssaf.fr — je ne suis pas comptable.
        </div>
      </Card>

      {/* Barre de progression du garage */}
      <Card style={{padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>🏠 Remplissage garage</span>
          <span style={{fontSize:13,fontWeight:800,color:C.accent}}>{fillRate}%</span>
        </div>
        <div style={{height:10,background:C.surface,borderRadius:999,overflow:'hidden',border:`1px solid ${C.border}`}}>
          <div style={{
            height:'100%',
            width:`${fillRate}%`,
            background:C.accent,
            borderRadius:999,
            transition:'width 0.4s ease',
          }}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:11,color:C.muted}}>
          <span><b style={{color:C.accent}}>{stockCount}</b> boîtes occupées</span>
          <span><b style={{color:C.warn}}>{freeSlots}</b> libres / {TOTAL_SLOTS} total</span>
        </div>
      </Card>

      {/* Stats secondaires */}
      <div>
        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:10,paddingLeft:4}}>Détails</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          <StatCard icon="⭐" label="× moyen" value={`×${avgX}`} color={C.warn}/>
          <StatCard icon="💵" label="Vente moyenne" value={fmt(avgSale)} color={C.text}/>
          <StatCard icon="✨" label="Bénéf. moyen / vente" value={fmt(avgProfit)} color={C.accent}/>
          <StatCard icon="📅" label="CA / jour actif" value={fmt(avgDayCA)} color={C.blue} sub={`${days.length} jours`}/>
        </div>
      </div>

      {/* Records */}
      <div>
        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:10,paddingLeft:4}}>Records</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          {bestDayCA&&(
            <Card style={{flex:1,minWidth:160,background:C.card,borderColor:C.border}}>
              <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🏆 Meilleur jour encaissé</div>
              <div style={{fontSize:20,fontWeight:800,color:C.warn}}>{fmt(bestDayCA[1].ca)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{bestDayCA[0]} · {bestDayCA[1].count} vente{bestDayCA[1].count>1?'s':''}</div>
            </Card>
          )}
          {bestDayProfit&&(
            <Card style={{flex:1,minWidth:160,background:C.card,borderColor:C.border}}>
              <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🚀 Meilleur jour bénéfice</div>
              <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{fmt(bestDayProfit[1].profit)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{bestDayProfit[0]}</div>
            </Card>
          )}
        </div>
      </div>

      {/* Graphique du CA encaissé par mois (cliquable) */}
      {caHistory.length>0&&(()=>{
        const maxCA=Math.max(...caHistory.map(h=>h.ca),1);
        const sel=caHistory.find(h=>h.key===selMonthEnc);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>💰 Évolution du CA encaissé (argent reçu, 12 derniers mois)</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche une barre pour voir le détail des ventes du mois.</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:150,paddingTop:10}}>
              {caHistory.map((h,i)=>{
                const pct=Math.round(h.ca/maxCA*100);
                const actif=h.key===selMonthEnc;
                return (
                  <div key={i} onClick={()=>setSelMonthEnc(actif?null:h.key)}
                       style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end',cursor:'pointer'}}>
                    <div style={{fontSize:9,color:C.muted,fontWeight:700,whiteSpace:'nowrap'}}>{Math.round(h.ca)}</div>
                    <div style={{width:'100%',maxWidth:34,height:`${pct}%`,minHeight:4,background:actif?C.text:C.accent,borderRadius:'3px 3px 0 0',transition:'height .4s',outline:actif?`2px solid ${C.accent}`:'none'}}/>
                    <div style={{fontSize:10,color:actif?C.accent:C.muted,fontWeight:actif?800:600}}>{h.label}</div>
                  </div>
                );
              })}
            </div>
            {sel&&<MonthDetail mois={sel} type="encaisse" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthEnc(null)}/>}
          </Card>
        );
      })()}

      {/* Graphique du CA par date de vente (cliquable) */}
      {caHistoryVente.length>0&&(()=>{
        const maxCA=Math.max(...caHistoryVente.map(h=>h.ca),1);
        const sel=caHistoryVente.find(h=>h.key===selMonthVente);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>🛒 Évolution du CA par date de vente (12 derniers mois)</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche une barre pour voir le détail des ventes du mois.</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:150,paddingTop:10}}>
              {caHistoryVente.map((h,i)=>{
                const pct=Math.round(h.ca/maxCA*100);
                const actif=h.key===selMonthVente;
                return (
                  <div key={i} onClick={()=>setSelMonthVente(actif?null:h.key)}
                       style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end',cursor:'pointer'}}>
                    <div style={{fontSize:9,color:C.muted,fontWeight:700,whiteSpace:'nowrap'}}>{Math.round(h.ca)}</div>
                    <div style={{width:'100%',maxWidth:34,height:`${pct}%`,minHeight:4,background:actif?C.text:C.blue,borderRadius:'3px 3px 0 0',transition:'height .4s',outline:actif?`2px solid ${C.blue}`:'none'}}/>
                    <div style={{fontSize:10,color:actif?C.blue:C.muted,fontWeight:actif?800:600}}>{h.label}</div>
                  </div>
                );
              })}
            </div>
            {sel&&<MonthDetail mois={sel} type="vente" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthVente(null)}/>}
          </Card>
        );
      })()}

      {/* Graphique : paires ajoutées par jour */}
      {ajoutsParJour.length>0&&(()=>{
        const maxAjout=Math.max(...ajoutsParJour.map(h=>h.count),1);
        const totalAjouts=ajoutsParJour.reduce((s,h)=>s+h.count,0);
        const moyenne=(totalAjouts/ajoutsParJour.length);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>📦 Paires ajoutées par jour</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>
              {totalAjouts} paire{totalAjouts>1?'s':''} sur {ajoutsParJour.length} jour{ajoutsParJour.length>1?'s':''} d'activité — moyenne {moyenne.toFixed(1)}/jour.
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:4,height:150,paddingTop:10,overflowX:'auto'}}>
              {ajoutsParJour.map((h,i)=>{
                const pct=Math.round(h.count/maxAjout*100);
                return (
                  <div key={i} style={{flex:'1 0 auto',minWidth:22,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end'}}>
                    <div style={{fontSize:9,color:C.muted,fontWeight:700}}>{h.count}</div>
                    <div style={{width:'100%',maxWidth:30,height:`${pct}%`,minHeight:4,background:C.accent,borderRadius:'3px 3px 0 0',transition:'height .4s'}}/>
                    <div style={{fontSize:9,color:C.muted,fontWeight:600,whiteSpace:'nowrap'}}>{h.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Récap comptable mensuel */}
      {moisRecap.length>0&&(
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:800,color:C.text}}>📊 Récap comptable mensuel</span>
            <Btn small onClick={exportCompta}>📥 Exporter (CSV)</Btn>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {['Mois','Ventes','CA encaissé','Bénéfice','Cotis.+impôt 13,5 %','Net estimé'].map(h=>(
                    <th key={h} style={{textAlign:h==='Mois'?'left':'right',padding:'8px 10px',color:C.muted,fontWeight:600,fontSize:10,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moisRecap.map(m=>(
                  <tr key={m.label} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'8px 10px',fontWeight:800,color:C.accent,whiteSpace:'nowrap'}}>{m.label}</td>
                    <td style={{padding:'8px 10px',textAlign:'right'}}>{m.count}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700}}>{fmt(m.ca)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.accent}}>{fmt(m.profit)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.warn}}>{fmt(m.urssaf)}</td>
                    <td style={{padding:'8px 10px',textAlign:'right',color:C.accent,fontWeight:700}}>{fmt(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:12,lineHeight:1.5}}>
            Cotisations + impôt estimés à 13,5 % du CA encaissé chaque mois (versement libératoire). Vérifie auprès de l'URSSAF.
          </div>
        </Card>
      )}

      {/* Récap hebdomadaire */}
      {showWeekly&&weeklyRecapData.count>0&&(
        <Card style={{borderLeft:`4px solid ${C.blue}`,background:`${C.blue}11`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.blue,marginBottom:6}}>📅 Récap semaine dernière ({weeklyRecapData.from} → {weeklyRecapData.to})</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12}}>
                <span><b style={{color:C.text}}>{weeklyRecapData.count}</b> <span style={{color:C.muted}}>vente{weeklyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accent}}>{fmt(weeklyRecapData.ca)}</b> <span style={{color:C.muted}}>encaissé</span></span>
                <span><b style={{color:C.accent}}>{fmt(weeklyRecapData.profit)}</b> <span style={{color:C.muted}}>bénéfice</span></span>
              </div>
            </div>
            <button type="button" onClick={()=>{localStorage.setItem('vinted_last_weekly_recap',isoWeek);setShowWeekly(false);}}
              style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,fontSize:16,lineHeight:1,padding:'2px 4px'}}>✕</button>
          </div>
        </Card>
      )}

      {/* Récap mensuel */}
      {showMonthly&&monthlyRecapData.count>0&&(
        <Card style={{borderLeft:`4px solid ${C.purple}`,background:`${C.purple}11`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.purple,marginBottom:6}}>📆 Récap {monthlyRecapData.nom}</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12}}>
                <span><b style={{color:C.text}}>{monthlyRecapData.count}</b> <span style={{color:C.muted}}>vente{monthlyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accent}}>{fmt(monthlyRecapData.ca)}</b> <span style={{color:C.muted}}>encaissé</span></span>
                <span><b style={{color:C.accent}}>{fmt(monthlyRecapData.profit)}</b> <span style={{color:C.muted}}>bénéfice</span></span>
              </div>
            </div>
            <button type="button" onClick={()=>{localStorage.setItem('vinted_last_monthly_recap',monthKey);setShowMonthly(false);}}
              style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,fontSize:16,lineHeight:1,padding:'2px 4px'}}>✕</button>
          </div>
        </Card>
      )}

      {/* Camemberts */}
      {(brandStats.length>0||countryStats.length>0)&&(
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          {brandStats.length>0&&(
            <Card style={{flex:'1 1 260px'}}>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:12}}>🏷️ Répartition par marque</div>
              <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
                <PieChartSVG data={brandStats} size={140}/>
                <div style={{flex:1,minWidth:120}}>
                  {brandStats.map((b,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:11}}>
                      <div style={{width:10,height:10,borderRadius:2,background:b.color,flexShrink:0}}/>
                      <span style={{color:C.text,fontWeight:700,flex:1}}>{b.label}</span>
                      <span style={{color:C.muted}}>{b.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {countryStats.length>0&&(
            <Card style={{flex:'1 1 260px'}}>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:12}}>🌍 Répartition par pays</div>
              <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
                <PieChartSVG data={countryStats} size={140}/>
                <div style={{flex:1,minWidth:120}}>
                  {countryStats.map((b,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:11}}>
                      <div style={{width:10,height:10,borderRadius:2,background:b.color,flexShrink:0}}/>
                      <span style={{color:C.text,fontWeight:700,flex:1}}>{b.label}</span>
                      <span style={{color:C.muted}}>{b.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Catalogue ───────────────────────────────────────── */
function Catalog({catalog,setCatalog,onDeleteId}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [newRow,setNewRow]=useState({id:'',buyPrice:''});
  const [lastAddedId,setLastAddedId]=useState(null); // dernier n° ajouté
  const priceInputRef=React.useRef(null);
  const [page,setPage]=useState(null); // null = dernière page
  const [showAll,setShowAll]=useState(false);
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};

  const update=(id,field,val)=>{
    const u=catalog.map(p=>p.id===id?{...p,[field]:field==='buyPrice'?+val:val}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const remove=(id)=>{
    if(!window.confirm(`Supprimer #${id} ?`)) return;
    const u=catalog.filter(p=>p.id!==id);
    setCatalog(u); save('vinted_catalog',u);
    if(onDeleteId) onDeleteId(id);
  };
  const toggleStatus=(id)=>{
    const u=catalog.map(p=>p.id===id?{...p,status:p.status==='stock'?'vendu':'stock'}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const addRow=()=>{
    const id=newRow.id.trim();
    if(!id||!newRow.buyPrice) return;
    if(catalog.find(p=>p.id===id)){alert('Numéro déjà existant !');return;}
    const u=[...catalog,{id,buyPrice:+newRow.buyPrice,status:'stock',addedAt:tod()}];
    setCatalog(u); save('vinted_catalog',u);
    setLastAddedId(id);
    // Pré-remplit automatiquement le numéro suivant (ex: après 50 → 51 prêt pour le prix)
    let nextId='';
    if(/^\d+$/.test(id)) nextId=String(parseInt(id,10)+1);
    setNewRow({id:nextId,buyPrice:''});
    setPage(null); // reste sur la dernière page (où se trouve la ligne d'ajout)
    // Place le curseur sur le champ prix pour enchaîner directement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  // Bouton +1 : pré-remplit le champ N° avec (dernier n° ajouté + 1).
  // Si rien n'a encore été ajouté dans cette session, part du plus grand n° du catalogue.
  const fillNextId=()=>{
    let base;
    if(lastAddedId!==null && /^\d+$/.test(lastAddedId)){
      base=parseInt(lastAddedId,10);
    } else {
      const nums=catalog.map(p=>parseInt(p.id,10)).filter(n=>!isNaN(n));
      base=nums.length?Math.max(...nums):0;
    }
    setNewRow(r=>({...r,id:String(base+1)}));
    // Place le curseur sur le champ prix pour enchaîner rapidement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  const fullList=useMemo(()=>catalog
    .filter(p=>p.id.toString().includes(search.trim())&&(filter==='all'||p.status===filter))
    .sort((a,b)=>+a.id-+b.id),[catalog,search,filter]);
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const oldStockCount=useMemo(()=>{
    const now=new Date();
    return catalog.filter(p=>{
      if(p.status!=='stock') return false;
      const parts=(p.addedAt||'').split('/');
      if(parts.length!==3) return false;
      const d=new Date(+parts[2],+parts[1]-1,+parts[0]);
      return (now-d)/86400000>30;
    }).length;
  },[catalog]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Catalogue ({catalog.length})</h2>
        <Btn small onClick={()=>{
          if(fullList.length===0){alert('Aucune paire à exporter');return;}
          const headers=['N° Paire','Prix Achat (€)','Statut','Date ajout'];
          const rows=fullList.map(p=>[p.id||'',String(p.buyPrice||'').replace('.',','),p.status||'',p.addedAt||'']);
          const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
          const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url;
          a.download=`catalogue-${new Date().toISOString().slice(0,10)}.csv`;
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }} color={C.blue}>📤 Exporter Excel</Btn>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:200}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="🔍 Numéro... puis Entrée"
            style={{flex:1,minWidth:120}}/>
          <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
          {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
        {['all','stock','vendu'].map(f=>(
          <Btn key={f} small onClick={()=>setFilter(f)} color={filter===f?C.accent:C.border} style={{color:filter===f?'#fff':C.muted}}>
            {f==='all'?'Tous':f==='stock'?'Stock':'Vendus'}
          </Btn>
        ))}
      </div>
      {oldStockCount>0&&(
        <div style={{background:`${C.warn}22`,border:`1px solid ${C.warn}66`,borderRadius:8,padding:'8px 14px',fontSize:12,color:C.warn,fontWeight:700}}>
          ⚠️ {oldStockCount} paire{oldStockCount>1?'s':''} en stock depuis + de 30 jours
        </div>
      )}
      <Card style={{padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{background:C.surface}}><tr>
            {['N°','Prix achat','Statut','Ajouté',''].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'10px 12px',color:C.muted,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {list.length===0&&<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune paire</td></tr>}
            {list.map(p=>(
              <tr key={p.id} style={{borderTop:`1px solid ${C.border}`,background:(()=>{if(p.status==='vendu') return '#ff4d6d08';const parts=(p.addedAt||'').split('/');if(parts.length===3){const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>60) return `${C.danger}18`;if(days>30) return `${C.warn}18`;}return 'transparent';})()}}>
                <td style={{padding:'2px 12px',fontWeight:800,color:C.accent,fontSize:14,minWidth:60}}>
                  <Cell value={p.id} onChange={v=>update(p.id,'id',v)} mono/>
                </td>
                <td style={{padding:'2px 12px',minWidth:80}}>
                  <Cell value={String(p.buyPrice)} onChange={v=>update(p.id,'buyPrice',v)} align="right"/>
                </td>
                <td style={{padding:'2px 12px'}}>
                  <span onClick={()=>toggleStatus(p.id)} style={{cursor:'pointer'}}>
                    <Badge color={p.status==='stock'?C.accent:C.danger}>{p.status==='stock'?'Stock':'Vendu'}</Badge>
                  </span>
                </td>
                <td style={{padding:'2px 12px',color:C.muted,fontSize:11,minWidth:80}}>
                  <Cell value={p.addedAt||'—'} onChange={v=>update(p.id,'addedAt',v)}/>
                  {p.status==='stock'&&(()=>{const parts=(p.addedAt||'').split('/');if(parts.length!==3) return null;const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>30) return <span style={{fontSize:10,color:days>60?C.danger:C.warn,fontWeight:700,marginLeft:3}}>{days}j</span>;return null;})()}
                </td>
                <td style={{padding:'2px 12px'}}>
                  <Btn small danger onClick={()=>remove(p.id)}>✕</Btn>
                </td>
              </tr>
            ))}
            {/* Ligne d'ajout en bas (dernière page uniquement) */}
            {(showAll||currentPage===totalPages-1)&&<tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
              <td style={{padding:'6px 8px'}}>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <input value={newRow.id} onChange={e=>setNewRow(n=>({...n,id:e.target.value}))}
                    placeholder="N°" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:12,width:60,fontFamily:'monospace',outline:'none'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                  <button type="button" onClick={fillNextId} title="Numéro suivant (dernier ajouté +1)"
                    style={{background:`${C.accent}22`,border:`1px solid ${C.accent}66`,borderRadius:6,color:C.accent,padding:'4px 6px',fontSize:14,fontWeight:800,cursor:'pointer',lineHeight:1}}>
                    +1
                  </button>
                </div>
              </td>
              <td style={{padding:'6px 8px'}}>
                <input ref={priceInputRef} value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                  type="number" placeholder="Prix achat €" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                  style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:12,width:100,outline:'none',fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                />
              </td>
              <td colSpan={2} style={{padding:'6px 8px',color:C.muted,fontSize:11}}>← Entrée ou bouton pour ajouter</td>
              <td style={{padding:'6px 8px'}}>
                <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
              </td>
            </tr>}
          </tbody>
        </table>
      </Card>
      {/* Pagination Catalogue */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} paires</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
    </div>
  );
}

/* ── Ventes ──────────────────────────────────────────── */
function Sales({catalog,setCatalog,sales,setSales,invoices,invoiceSettings}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [newRow,setNewRow]=useState({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
  const [err,setErr]=useState('');
  const [page,setPage]=useState(null); // null = dernière page (init)
  const [showAll,setShowAll]=useState(false);
  const [selectMode,setSelectMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [isDragging,setIsDragging]=useState(false);
  const dragModeRef=React.useRef('add');
  const selectedIdsRef=React.useRef(new Set());
  selectedIdsRef.current=selectedIds;
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Drag global avec écoute des événements window
  useEffect(()=>{
    if(!selectMode) return;
    
    const onMove=(e)=>{
      if(!isDragging) return;
      const t=e.touches?e.touches[0]:e;
      if(!t) return;
      const el=document.elementFromPoint(t.clientX,t.clientY);
      if(!el) return;
      const tr=el.closest('tr[data-vid]');
      if(!tr) return;
      const vid=tr.getAttribute('data-vid');
      if(!vid) return;
      const ns=new Set(selectedIdsRef.current);
      if(dragModeRef.current==='add') ns.add(vid); else ns.delete(vid);
      // Si pas de changement, on ne re-render pas
      if(ns.size===selectedIdsRef.current.size&&dragModeRef.current==='add'?selectedIdsRef.current.has(vid):!selectedIdsRef.current.has(vid)) return;
      setSelectedIds(ns);
    };
    
    const onUp=()=>setIsDragging(false);
    
    window.addEventListener('mousemove',onMove);
    window.addEventListener('touchmove',onMove,{passive:true});
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchend',onUp);
    return ()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchend',onUp);
    };
  },[selectMode,isDragging]);
  


  const updateSale=(id,field,val)=>{
    const u=sales.map(s=>{
      if(s.id!==id) return s;
      const ns={...s,[field]:val};
      const sell=+(field==='sellPrice'?val:ns.sellPrice);
      const buy=+(field==='buyPrice'?val:ns.buyPrice);
      ns.profit=+(sell-buy).toFixed(2);
      ns.multi=buy>0?+(sell/buy).toFixed(2):0;
      return ns;
    });
    setSales(u); save('vinted_sales',u);
  };

  const del=(sid,pid)=>{
    if(!window.confirm('Supprimer cette vente ?')) return;
    const ns=sales.filter(s=>s.id!==sid); setSales(ns); save('vinted_sales',ns);
    const pids=String(pid||'').split('+').map(v=>v.trim()).filter(Boolean);
    const nc=catalog.map(p=>pids.includes(p.id)?{...p,status:'stock'}:p); setCatalog(nc); save('vinted_catalog',nc);
  };

  const addRow=()=>{
    setErr('');
    const rawPid=newRow.productId.trim();
    if(!rawPid||!newRow.saleDate||!newRow.sellPrice){setErr('Article, date et prix vente obligatoires');return;}
    const pids=rawPid.split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
    const pid=pids.join('+');
    const foundItems=pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
    const alreadySold=pids.find(id=>{const cp=catalog.find(x=>x.id===id);return cp&&cp.status==='vendu';});
    if(alreadySold){setErr(`#${alreadySold} déjà vendue`);return;}
    const buy=foundItems.length>0?foundItems.reduce((s,cp)=>s+(+cp.buyPrice),0):(+newRow.buyPrice||0);
    const sell=+newRow.sellPrice;
    const sale={id:uid(),productId:pid,buyPrice:+buy.toFixed(2),sellPrice:sell,
      profit:+(sell-buy).toFixed(2),multi:buy>0?+(sell/buy).toFixed(2):0,
      saleDate:newRow.saleDate,receiveDate:newRow.receiveDate,createdAt:new Date().toISOString(),
      ...(pids.length>1?{isLot:true}:{})};
    const ns=[sale,...sales]; setSales(ns); save('vinted_sales',ns);
    if(foundItems.length>0){const nc=catalog.map(x=>pids.includes(x.id)?{...x,status:'vendu'}:x);setCatalog(nc);save('vinted_catalog',nc);}
    setNewRow({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
  };

  const fullFiltered=useMemo(()=>sales.filter(s=>
    !search||(s.productId||'').toLowerCase().includes(search.toLowerCase())||(s.saleDate||'').includes(search)||(s.receiveDate||'').includes(search)
  ),[sales,search]);
  const totalPages=Math.max(1,Math.ceil(fullFiltered.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const filtered=showAll?fullFiltered:fullFiltered.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const totalCA=useMemo(()=>fullFiltered.reduce((s,v)=>s+ +v.sellPrice,0),[fullFiltered]);
  const totalProfit=useMemo(()=>fullFiltered.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[fullFiltered]);

  const _pids=newRow.productId.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
  const p=_pids.length===1?catalog.find(x=>x.id===_pids[0]):null;
  const _foundItems=_pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
  const previewBuy=_foundItems.length>0?_foundItems.reduce((s,x)=>s+(+x.buyPrice),0):(+newRow.buyPrice||null);
  const previewSell=newRow.sellPrice?+newRow.sellPrice:null;

  // CA + bénéfice du mois en cours (basé sur la date de réception JJ/MM/AAAA = argent encaissé)
  const moisVentes=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    sales.forEach(v=>{
      const dt=(v.receiveDate||'').trim();
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[sales]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* Bandeau mois en cours */}
      <div style={{display:'flex',flexWrap:'wrap',gap:14,background:C.card,
        border:`1px solid ${C.blue}44`,borderRadius:8,padding:'12px 16px'}}>
        <div style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:1,fontWeight:700,width:'100%'}}>
          📅 {moisVentes.nom} — mois en cours
        </div>
        <div><span style={{fontSize:10,color:C.muted}}>CA encaissé</span><div style={{fontSize:20,fontWeight:800,color:C.text}}>{fmt(moisVentes.ca)}</div></div>
        <div><span style={{fontSize:10,color:C.muted}}>Bénéfice</span><div style={{fontSize:20,fontWeight:800,color:moisVentes.profit>=0?C.accent:C.danger}}>{fmt(moisVentes.profit)}</div></div>
        <div><span style={{fontSize:10,color:C.muted}}>Ventes</span><div style={{fontSize:20,fontWeight:800,color:C.muted}}>{moisVentes.count}</div></div>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Ventes ({sales.length})</h2>
        <div style={{display:'flex',gap:12,fontSize:13,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{color:C.muted}}>CA filtré : <b style={{color:C.text}}>{fmt(totalCA)}</b></span>
          <span style={{color:C.muted}}>Bénéf. : <b style={{color:totalProfit>=0?C.accent:C.danger}}>{fmt(totalProfit)}</b></span>
          <Btn small onClick={()=>{
            if(fullFiltered.length===0){alert('Aucune vente à exporter');return;}
            const headers=['ID','N° Paire','Date vente','Date réception','Prix achat (€)','Prix vente (€)','Bénéfice (€)','Multi'];
            const rows=fullFiltered.map(s=>[
              s.id||'',s.productId||'',s.saleDate||'',s.receiveDate||'',
              String(s.buyPrice||'').replace('.',','),String(s.sellPrice||'').replace('.',','),
              String(s.profit||'').replace('.',','),String(s.multi||'').replace('.',','),
            ]);
            const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
            const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=`ventes-${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);a.click();document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} color={C.blue}>📤 Exporter Excel</Btn>
        </div>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <Input value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="🔍 Article, date... puis Entrée"
          style={{maxWidth:280,flex:1,minWidth:160}}/>
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
      </div>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div className={selectMode?'sales-select-mode':''} style={{overflowX:'auto',position:'relative'}}>
          <style>{`
            .sales-select-mode tbody td > * { pointer-events: none !important; }
            .sales-select-mode tbody tr { pointer-events: auto !important; }
          `}</style>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,
            ...(selectMode?{userSelect:'none',WebkitUserSelect:'none'}:{})}}>
            <thead style={{background:C.surface,position:'sticky',top:0,zIndex:1}}><tr>
              {['Article','Date vente','Réception €','Achat','Vente','Bénéfice','×','Facture',''].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'10px 10px',color:C.muted,fontWeight:600,fontSize:10,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={9} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune vente</td></tr>}
              {filtered.map(v=>{
                const b=+(+v.sellPrice-+v.buyPrice);
                const isSelected=selectedIds.has(v.id);
                return (
                  <tr key={v.id}
                    onMouseDown={selectMode?(e)=>{
                      e.preventDefault();
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    onTouchStart={selectMode?(e)=>{
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    data-vid={v.id}
                    style={{borderTop:`1px solid ${C.border}`,background:isSelected?`${C.accent}33`:'transparent',cursor:selectMode?'pointer':'auto',userSelect:selectMode?'none':'auto',position:'relative'}}>
                    <td style={{padding:'2px 10px',minWidth:100,fontWeight:700,color:C.accent}}>
                      <Cell value={v.productId||''} onChange={val=>updateSale(v.id,'productId',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.saleDate||''} onChange={val=>updateSale(v.id,'saleDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.receiveDate||''} onChange={val=>updateSale(v.id,'receiveDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.buyPrice)} onChange={val=>updateSale(v.id,'buyPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.sellPrice)} onChange={val=>updateSale(v.id,'sellPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',color:b>=0?C.accent:C.danger,fontWeight:800,whiteSpace:'nowrap'}}>{fmt(b)}</td>
                    <td style={{padding:'2px 10px',color:C.warn,whiteSpace:'nowrap'}}>×{fmtN(v.multi)}</td>
                    <td style={{padding:'2px 10px',whiteSpace:'nowrap'}}>
                      {(() => {
                        const inv=invoices&&invoices.find(i=>String(i.productId).trim()===String(v.productId||'').trim());
                        if(!inv) return <span style={{color:C.muted,fontSize:11}}>—</span>;
                        return <button type="button" onClick={()=>generatePDF(inv,invoiceSettings||{companyName:'Shop Cancale35',companyType:'Entrepreneur individuel',companyAddress:'80 rue de la vieille rivière 35260',siret:'94135104100012',footer:'Merci pour votre achat !'})}
                          title={`Voir la facture ${inv.number}`}
                          style={{background:`${C.blue}22`,border:`1px solid ${C.blue}66`,borderRadius:6,color:C.blue,padding:'2px 8px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'monospace'}}>
                          📄 {inv.number}
                        </button>;
                      })()}
                    </td>
                    <td style={{padding:'2px 10px'}}>
                      <Btn small danger onClick={()=>del(v.id,v.productId)}>✕</Btn>
                    </td>
                  </tr>
                );
              })}
              {/* Ligne d'ajout en bas */}
              <tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.productId} onChange={e=>{
                    const pid=e.target.value;
                    const parts=pid.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
                    const inv=parts.length===1?(invoices?invoices.find(i=>String(i.productId).trim()===parts[0]):null):null;
                    setNewRow(n=>({
                      ...n,
                      productId:pid,
                      ...(inv?{saleDate:inv.saleDate||n.saleDate}:{}),
                    }));
                  }}
                    placeholder="N° ou N°+N° (lot)" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.accent,padding:'4px 6px',fontSize:12,width:90,fontFamily:'monospace',outline:'none',fontWeight:700}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.saleDate} onChange={e=>setNewRow(n=>({...n,saleDate:e.target.value}))}
                    placeholder="jj/mm/aaaa"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.receiveDate} onChange={e=>setNewRow(n=>({...n,receiveDate:e.target.value}))}
                    placeholder="jj/mm/aaaa"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  {_foundItems.length>0?<span style={{color:C.muted,fontSize:12,padding:'0 6px'}}>{fmt(previewBuy)}{_foundItems.length>1?<span style={{fontSize:10,color:C.purple,marginLeft:3}}>lot</span>:null}</span>:
                  <input value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                    type="number" placeholder="Achat €"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input value={newRow.sellPrice} onChange={e=>setNewRow(n=>({...n,sellPrice:e.target.value}))}
                    type="number" placeholder="Vente €"
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px',color:previewBuy!==null&&previewSell!==null?(previewSell-previewBuy>=0?C.accent:C.danger):C.muted,fontWeight:800,fontSize:12,whiteSpace:'nowrap'}}>
                  {previewBuy!==null&&previewSell!==null?fmt(previewSell-previewBuy):''}
                </td>
                <td style={{padding:'6px 6px',color:C.warn,fontSize:12}}>
                  {previewBuy&&previewBuy>0&&previewSell?`×${(previewSell/previewBuy).toFixed(2)}`:''}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
                </td>
              </tr>
              {err&&<tr><td colSpan={8} style={{padding:'6px 12px',color:C.danger,fontSize:12}}>⚠ {err}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Pagination */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullFiltered.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullFiltered.length} ventes</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Barre flottante en bas : bouton sélection + somme */}
      <div style={{position:'sticky',bottom:0,zIndex:20,padding:'8px 0',background:`linear-gradient(180deg, transparent 0%, ${C.bg} 30%)`}}>
        <Card style={{padding:'10px 14px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',background:selectMode?`${C.accent}15`:C.card,borderColor:selectMode?`${C.accent}66`:C.border}}>
          <Btn small onClick={()=>{setSelectMode(!selectMode);if(selectMode)setSelectedIds(new Set());}} color={selectMode?C.accent:C.border} style={{color:selectMode?'#fff':C.muted}}>
            {selectMode?'✓ Mode sélection actif':'☑️ Activer la sélection'}
          </Btn>
          {selectMode&&<>
            <span style={{fontSize:11,color:C.muted}}>
              {selectedIds.size===0?'Clique ou glisse sur les lignes du tableau pour les sélectionner':`${selectedIds.size} vente${selectedIds.size>1?'s':''} sélectionnée${selectedIds.size>1?'s':''}`}
            </span>
            {selectedIds.size>0&&(()=>{
              const sel=fullFiltered.filter(v=>selectedIds.has(v.id));
              const sumCA=sel.reduce((s,v)=>s+ +v.sellPrice,0);
              const sumProfit=sel.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
              const sumRecu=sel.filter(v=>v.receiveDate&&v.receiveDate.trim()!=='').reduce((s,v)=>s+ +v.sellPrice,0);
              return (<>
                <span style={{fontSize:13,color:C.muted,marginLeft:'auto'}}>Σ : <b style={{color:C.text}}>{fmt(sumCA)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>💰 Reçu : <b style={{color:C.accent}}>{fmt(sumRecu)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>Bénéf. : <b style={{color:sumProfit>=0?C.accent:C.danger}}>{fmt(sumProfit)}</b></span>
              </>);
            })()}
          </>}
        </Card>
      </div>
    </div>
  );
}

/* ── Box & Door ──────────────────────────────────────── */
const Box = React.memo(function Box({val,isSold,highlight}) {
  const W=46,H=26,SW=6,TH=5;
  const hasVal=val&&val.trim()!=='';
  // Cases vides : rendu ultra simple, pas de SVG complexe
  if(!hasVal&&!highlight){
    return (
      <svg width={W+SW} height={H+TH} style={{display:'block'}}>
        <rect x={0} y={TH} width={W} height={H} rx={2} fill="#2e2e2e"/>
      </svg>
    );
  }
  let front,side,top,textCol;
  if(isSold)      {front='#8a1a2a';side='#5a0e1a';top='#aa2535';textCol='#ffaaaa';}
  else if(hasVal) {front='#b07830';side='#7a5218';top='#d09040';textCol='#2a1200';}
  else            {front='#2e2e2e';side='#1e1e1e';top='#3a3a3a';textCol='transparent';}
  return (
    <svg width={W+SW} height={H+TH} style={{display:'block',overflow:'visible',
      filter:highlight?'drop-shadow(0 0 8px #ffb830) drop-shadow(0 0 16px #ffb830) brightness(1.5)':'none'}}>
      {highlight&&<rect x={-2} y={TH-2} width={W+4} height={H+4} rx={3} fill="none" stroke="#ffb830" strokeWidth="2.5"/>}      <polygon points={`0,${TH} ${SW},0 ${W+SW},0 ${W},${TH}`} fill={top} stroke="#111" strokeWidth="0.6"/>
      <rect x={0} y={TH} width={W} height={H} rx={2} fill={front} stroke="#111" strokeWidth="0.6"/>
      <polygon points={`${W},${TH} ${W+SW},0 ${W+SW},${H} ${W},${H+TH}`} fill={side} stroke="#111" strokeWidth="0.6"/>
      {hasVal&&<rect x={8} y={TH+H/2-2} width={W-16} height={4} rx={1} fill={side} opacity="0.6"/>}
      {hasVal&&<text x={W/2} y={TH+H/2+4} textAnchor="middle" fill={textCol} fontSize={8} fontWeight="800" fontFamily="monospace">{val.trim()}</text>}
    </svg>
  );
});
function Door({h}) {
  const W=80,H=h;
  return (
    <svg width={W} height={H} style={{display:'block',flexShrink:0}}>
      <rect width={W} height={H} fill="#3a2a1a"/>
      <rect x={4} y={4} width={W-8} height={H-4} rx={3} fill="#6a4828"/>
      <rect x={8} y={8} width={W-16} height={H-12} rx={2} fill="#c8a060"/>
      <rect x={13} y={14} width={W-26} height={H*0.28} rx={2} fill="#b08848" stroke="#7a5820" strokeWidth="0.8"/>
      <rect x={18} y={18} width={W-36} height={H*0.28-8} rx={1} fill="#88b8d8" opacity="0.4"/>
      <rect x={13} y={14+H*0.28+8} width={W-26} height={H*0.42} rx={2} fill="#b08848" stroke="#7a5820" strokeWidth="0.8"/>
      <circle cx={W-16} cy={H*0.56} r={5} fill="#d4a820" stroke="#8a6800" strokeWidth="1"/>
      <circle cx={W-16} cy={H*0.56} r={2} fill="#ffe060"/>
      <rect x={10} y={H*0.18} width={7} height={12} rx={1} fill="#4a3010"/>
      <rect x={10} y={H*0.72} width={7} height={12} rx={1} fill="#4a3010"/>
      <rect x={0} y={H-6} width={W} height={6} fill="#2a1a08"/>
    </svg>
  );
}

/* ── Factures ───────────────────────────────────────── */
function Invoices({invoices,setInvoices,catalog,sales,invoiceSettings,setInvoiceSettings}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [zone,setZone]=useState('attente'); // 'attente' | 'comptabilisees'
  const [page,setPage]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [fetching,setFetching]=useState(false);
  const PER_PAGE=50;
  
  // URL de l'API Apps Script (Vinted Auto)
  const VINTED_API_URL='https://script.google.com/macros/s/AKfycbzO-jwmFwOwJI49W0LjR8EOcIKAWsTzElWsWc6IVg0luX6MhbJNdOXzpe2BhYUCXmHb/exec';
  
  // Récupère les factures depuis Google Sheets via Apps Script
  // silencieux = true : pas d'alertes (utilisé pour le rafraîchissement auto au démarrage)
  const fetchVintedInvoices=async(silencieux=false)=>{
    setFetching(true);
    try {
      const res=await fetch(VINTED_API_URL);
      const data=await res.json();
      if(!Array.isArray(data)){
        if(!silencieux) alert('Format de données inattendu');
        return;
      }
      // Convertir les lignes Sheets en factures de l'app
      const existingKeys=new Set(invoices.map(i=>`${i.productId}|${i.sellPrice}|${i.buyerName}`));
      // Point de départ pour la numérotation auto : max des numéros existants de l'année
      const year=new Date().getFullYear();
      let maxNum=invoices.reduce((mx,i)=>{
        if(i.number&&i.number.startsWith(`${year}-`)){
          const n=parseInt(i.number.split('-')[1],10);
          return isNaN(n)?mx:Math.max(mx,n);
        }
        return mx;
      },0);
      const newInvoices=[];
      data.forEach(row=>{
        const productId=String(row['N° paire']||'').trim();
        const designation=String(row['Désignation']||'').trim();
        const prix=row['Prix'];
        const pseudo=String(row['Pseudo']||'').trim();
        const nomComplet=String(row['Nom complet']||'').trim();
        const email=String(row['Email']||'').trim();
        const adresse=String(row['Adresse']||'').trim();
        const dateMail=row['Date mail'];
        
        if(!pseudo||!prix) return; // données incomplètes
        
        const key=`${productId}|${prix}|${nomComplet}`;
        if(existingKeys.has(key)) return; // déjà importé
        
        // Attribue un numéro de facture dès l'arrivée (la facture reste en Boîte de réception à valider)
        maxNum+=1;
        const autoNumber=`${year}-${String(maxNum).padStart(6,'0')}`;
        
        newInvoices.push({
          id:'inv_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
          number:autoNumber, // numéro déjà attribué
          productId:productId,
          itemName:designation,
          sellPrice:String(prix),
          saleDate:dateMail?new Date(dateMail).toISOString().slice(0,10):'',
          buyerName:nomComplet,
          buyerEmail:email,
          buyerAddress:adresse,
          vintedNumber:'',
          source:'auto',
          validated:false,
          pseudo:pseudo,
          createdAt:new Date().toISOString(),
        });
      });
      
      if(newInvoices.length===0){
        if(!silencieux) alert('Aucune nouvelle facture à importer');
      } else {
        const u=[...newInvoices,...invoices];
        setInvoices(u); save('vinted_invoices',u);
        if(!silencieux) alert(`✓ ${newInvoices.length} nouvelle(s) facture(s) importée(s) depuis Vinted !`);
      }
    } catch(err) {
      if(!silencieux) alert('Erreur récupération : '+err.message);
    } finally {
      setFetching(false);
    }
  };

  // 🔄 Rafraîchissement automatique au démarrage (silencieux) + toutes les 5 min
  const _autoFetchedRef=React.useRef(false);
  useEffect(()=>{
    if(_autoFetchedRef.current) return;
    _autoFetchedRef.current=true;
    // Premier chargement au démarrage de l'onglet Factures
    fetchVintedInvoices(true);
    // Puis toutes les 5 minutes tant que l'app est ouverte
    const interval=setInterval(()=>fetchVintedInvoices(true), 5*60*1000);
    return ()=>clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  
  // Numéro auto pour la prochaine facture
  const nextInvoiceNumber=useMemo(()=>{
    const year=new Date().getFullYear();
    const yearInvoices=invoices.filter(i=>i.number&&i.number.startsWith(`${year}-`));
    const maxNum=yearInvoices.reduce((mx,i)=>{
      const n=parseInt(i.number.split('-')[1],10);
      return isNaN(n)?mx:Math.max(mx,n);
    },0);
    return `${year}-${String(maxNum+1).padStart(6,'0')}`;
  },[invoices]);
  
  // Set des productIds qui sont déjà dans Ventes (= comptabilisés)
  const accountedSet=useMemo(()=>{
    const s=new Set();
    sales.forEach(v=>{
      if(v.productId) String(v.productId).trim().split('+').forEach(id=>{const t=id.trim();if(t) s.add(t);});
    });
    return s;
  },[sales]);
  
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Filtrage par zone + recherche
  const fullList=useMemo(()=>{
    let list=invoices;
    // Si une recherche est active, on cherche dans TOUTES les zones (pratique pour retrouver/supprimer une facture)
    if(search.trim()){
      const q=search.trim().toLowerCase();
      list=list.filter(i=>(i.number||'').toLowerCase().includes(q)||
        String(i.productId||'').toLowerCase().includes(q)||
        (i.itemName||'').toLowerCase().includes(q)||
        (i.buyerName||'').toLowerCase().includes(q)||
        fmtDate(i.saleDate||'').toLowerCase().includes(q)||
        String(i.saleDate||'').toLowerCase().includes(q));
      return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
    }
    // Sinon, filtrage normal par zone
    if(zone==='attente') list=list.filter(i=>!accountedSet.has(String(i.productId).trim()));
    else if(zone==='comptabilisees') list=list.filter(i=>accountedSet.has(String(i.productId).trim()));
    return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
  },[invoices,zone,search,accountedSet]);
  
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?0:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);
  
  // Compteurs par zone
  const counters=useMemo(()=>{
    const attente=invoices.filter(i=>!accountedSet.has(String(i.productId).trim())).length;
    const comptabilisees=invoices.filter(i=>accountedSet.has(String(i.productId).trim())).length;
    return {attente,comptabilisees};
  },[invoices,accountedSet]);
  
  const deleteInvoice=(id)=>{
    const inv=invoices.find(i=>i.id===id);
    const isAcc=inv&&accountedSet.has(String(inv.productId).trim());
    const msg=isAcc
      ? `⚠️ La paire #${inv.productId} a une vente saisie dans ta compta.\nSupprimer cette facture quand même ?`
      : 'Supprimer cette facture ?';
    if(!window.confirm(msg)) return;
    const u=invoices.filter(i=>i.id!==id);
    setInvoices(u); save('vinted_invoices',u);
  };
  
  const addInvoice=(data)=>{
    const newInvoice={
      id:'inv_'+Date.now(),
      number:nextInvoiceNumber,
      ...data,
      createdAt:new Date().toISOString(),
    };
    const u=[newInvoice,...invoices];
    setInvoices(u); save('vinted_invoices',u);
    setShowForm(false);
  };
  
  // Export CSV/Excel
  const exportExcel=()=>{
    if(fullList.length===0){alert('Aucune facture à exporter');return;}
    const headers=['N° Facture','Date vente','N° Paire','Désignation','Prix vente','Acheteur','Email','Adresse','N° Vinted','Statut'];
    const rows=fullList.map(i=>[
      i.number||'',i.saleDate||'',i.productId||'',i.itemName||'',
      (i.sellPrice||'').toString().replace('.',','),
      i.buyerName||'',i.buyerEmail||'',i.buyerAddress||'',i.vintedNumber||'',
      accountedSet.has(String(i.productId).trim())?'Comptabilisée':'En attente',
    ]);
    const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`factures-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Factures ({invoices.length})</h2>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Btn small onClick={()=>setShowForm(true)} color={C.accent}>+ Nouvelle facture</Btn>
          <Btn small onClick={()=>fetchVintedInvoices(false)} color={C.purple} disabled={fetching}>
            {fetching?'⏳ Chargement...':'📥 Récupérer Vinted'}
          </Btn>
          <Btn small onClick={exportExcel} color={C.blue}>📤 Exporter Excel</Btn>
          <Btn small onClick={()=>setShowSettings(true)} color={C.border}>⚙ Réglages</Btn>
        </div>
      </div>
      
      {/* Barre de recherche : par n° de paire ou date de vente (cherche dans toutes les zones) */}
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <input
          value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="🔍 N° de paire ou date de vente... puis Entrée"
          style={{flex:1,minWidth:200,padding:'9px 12px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,
            color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'}}
        />
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕ Effacer</Btn>}
      </div>
      {search&&<div style={{fontSize:12,color:C.warn}}>
        🔍 Recherche « {search} » dans toutes les factures — {fullList.length} résultat{fullList.length>1?'s':''}. Tu peux supprimer directement avec 🗑.
      </div>}
      
      {/* Sous-onglets zones */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${C.border}`,overflowX:'auto',opacity:search?0.4:1,pointerEvents:search?'none':'auto'}}>
        {[
          {id:'attente',icon:'⏳',label:'En attente',count:counters.attente},
          {id:'comptabilisees',icon:'✅',label:'Comptabilisées',count:counters.comptabilisees},
        ].map(z=>(
          <button key={z.id} type="button" onClick={()=>{setZone(z.id);setPage(null);}}
            style={{background:'transparent',border:'none',borderBottom:zone===z.id?`3px solid ${C.accent}`:'3px solid transparent',
              color:zone===z.id?C.accent:C.muted,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {z.icon} {z.label} ({z.count})
          </button>
        ))}
      </div>
      
      {/* Recherche */}
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <Input value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="🔍 N° paire, date de vente, acheteur, n° facture..."
          style={{flex:1,minWidth:120}}/>
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
      </div>
      {search.trim()&&<div style={{fontSize:11,color:C.warn,marginTop:6}}>🔍 Recherche active dans toutes les factures.</div>}
      
      {/* Tableau factures */}
      <Card style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:700}}>
          <thead>
            <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.warn,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>N° Paire</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>N° Facture</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Date vente</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Désignation</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Prix</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Acheteur</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length===0&&<tr><td colSpan={7} style={{padding:30,textAlign:'center',color:C.muted}}>{search.trim()?`Aucune facture trouvée pour « ${search} »`:`Aucune facture ${zone==='attente'?'en attente':'comptabilisée'}`}</td></tr>}
            {list.map(inv=>{
              const isAccounted=accountedSet.has(String(inv.productId).trim());
              return (
                <tr key={inv.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px',color:C.warn,fontWeight:800,fontFamily:'monospace',fontSize:15}}>#{inv.productId||'?'}</td>
                  <td style={{padding:'8px',color:C.accent,fontWeight:700,fontFamily:'monospace',fontSize:11}}>{inv.number||'—'}</td>
                  <td style={{padding:'8px',color:C.text,fontFamily:'monospace',fontSize:11}}>{fmtDate(inv.saleDate)}</td>
                  <td style={{padding:'8px',color:C.text}}>{String(inv.itemName||'—').replace(/\bimages?\s*:\s*/gi,'').replace(/\bimages?\b/gi,'').replace(/\s+/g,' ').trim()||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',color:C.accent,fontWeight:700}}>{fmt(+inv.sellPrice||0)}</td>
                  <td style={{padding:'8px',color:C.muted,fontSize:11}}>{inv.buyerName||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',whiteSpace:'nowrap'}}>
                    <Btn small onClick={()=>generatePDF(inv,invoiceSettings)} color={C.blue} style={{marginRight:4}}>📄</Btn>
                    <Btn small onClick={()=>deleteInvoice(inv.id)} color={C.danger}>🗑</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      
      {/* Pagination */}
      {!showAll&&totalPages>1&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?0:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?0:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} factures</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Modale création facture */}
      {showForm&&<InvoiceForm onClose={()=>setShowForm(false)} onSave={addInvoice} nextNumber={nextInvoiceNumber} catalog={catalog}/>}
      
      {/* Modale réglages */}
      {showSettings&&<InvoiceSettings settings={invoiceSettings} setSettings={(s)=>{setInvoiceSettings(s);save('vinted_invoice_settings',s);}} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}

// Formulaire de création d'une facture
function InvoiceForm({onClose,onSave,nextNumber,catalog}) {
  const [data,setData]=useState({
    productId:'',itemName:'',sellPrice:'',saleDate:tod(),
    buyerName:'',buyerEmail:'',buyerAddress:'',
    vintedNumber:'',source:'manual',
  });
  const [err,setErr]=useState('');
  
  const submit=()=>{
    setErr('');
    if(!data.productId.trim()){setErr('Le numéro de paire est obligatoire');return;}
    if(!data.sellPrice||+data.sellPrice<=0){setErr('Prix de vente invalide');return;}
    if(!data.itemName.trim()){setErr('La désignation est obligatoire');return;}
    onSave(data);
  };
  
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accent}}>Nouvelle facture</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Numéro auto : <b style={{color:C.accent}}>{nextNumber}</b></div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="N° paire (étiquetage) *">
            <Input type="number" value={data.productId} onChange={e=>{
              const id=e.target.value;
              const p=catalog.find(p=>p.id===id);
              setData(d=>({...d,productId:id, itemName:p?(d.itemName||''):d.itemName}));
            }} placeholder="ex: 1280"/>
          </Field>
          <Field label="Désignation *">
            <Input value={data.itemName} onChange={e=>setData(d=>({...d,itemName:e.target.value}))} placeholder="ex: Adidas Spezial bleu marine taille 365"/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <Field label="Prix de vente € *">
              <Input type="number" step="0.01" value={data.sellPrice} onChange={e=>setData(d=>({...d,sellPrice:e.target.value}))} placeholder="38.00"/>
            </Field>
            <Field label="Date vente">
              <Input type="date" value={data.saleDate} onChange={e=>setData(d=>({...d,saleDate:e.target.value}))}/>
            </Field>
          </div>
          
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:4}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8,fontWeight:700}}>Acheteur</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Field label="Nom complet"><Input value={data.buyerName} onChange={e=>setData(d=>({...d,buyerName:e.target.value}))} placeholder="Morel Anne-Sophie"/></Field>
              <Field label="Email"><Input type="email" value={data.buyerEmail} onChange={e=>setData(d=>({...d,buyerEmail:e.target.value}))} placeholder="annesomorel@yahoo.fr"/></Field>
              <Field label="Adresse complète"><Input value={data.buyerAddress} onChange={e=>setData(d=>({...d,buyerAddress:e.target.value}))} placeholder="6 rue Gutenberg, Montreuil, 93100, FR, France"/></Field>
            </div>
          </div>
          
          <Field label="N° transaction Vinted">
            <Input value={data.vintedNumber} onChange={e=>setData(d=>({...d,vintedNumber:e.target.value}))} placeholder="19921523337"/>
          </Field>
          
          {err&&<div style={{color:C.danger,fontSize:12}}>⚠ {err}</div>}
          
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn onClick={submit} color={C.accent} style={{flex:1}}>✓ Créer la facture</Btn>
            <Btn onClick={onClose} color={C.border}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Réglages personnalisables
function InvoiceSettings({settings,setSettings,onClose}) {
  const [data,setData]=useState(settings);
  const save=()=>{setSettings(data);onClose();};
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accent}}>⚙ Réglages factures</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="Nom de l'entreprise"><Input value={data.companyName} onChange={e=>setData(d=>({...d,companyName:e.target.value}))}/></Field>
          <Field label="Forme juridique"><Input value={data.companyType} onChange={e=>setData(d=>({...d,companyType:e.target.value}))}/></Field>
          <Field label="Adresse"><Input value={data.companyAddress} onChange={e=>setData(d=>({...d,companyAddress:e.target.value}))}/></Field>
          <Field label="SIRET"><Input value={data.siret} onChange={e=>setData(d=>({...d,siret:e.target.value}))}/></Field>
          <Field label="Message de bas de page"><Input value={data.footer} onChange={e=>setData(d=>({...d,footer:e.target.value}))}/></Field>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn onClick={save} color={C.accent} style={{flex:1}}>✓ Enregistrer</Btn>
            <Btn onClick={onClose} color={C.border}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper pour les champs du formulaire
function Field({label,children}) {
  return <label style={{display:'flex',flexDirection:'column',gap:4}}>
    <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</span>
    {children}
  </label>;
}

// Helper format date FR
function fmtDate(d) {
  if(!d) return '—';
  try {
    const dt=new Date(d);
    if(isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});
  } catch { return d; }
}

// Génération du PDF (HTML imprimable qui s'ouvre dans une nouvelle fenêtre)
function generatePDF(inv,settings) {
  let _logo=LOGO_CANCALE;
  try{ const _c=localStorage.getItem('vinted_custom_logo'); if(_c){ _logo=JSON.parse(_c); } }catch(_){}
  const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Facture ${inv.number}</title>
<style>
body{font-family:Arial,sans-serif;color:#222;max-width:800px;margin:30px auto;padding:30px;background:#fff;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}
.logo{width:140px;height:140px;background:#0a0a0a;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:800;text-align:center;padding:10px;box-sizing:border-box;}
.logo .top{font-size:14px;letter-spacing:2px;border:1.5px solid #fff;border-radius:4px;padding:2px 8px;}
.logo .shoe{font-size:50px;margin:8px 0;}
.logo .bot{font-size:9px;letter-spacing:3px;}
.title{text-align:right;}
.title h1{margin:0;font-size:32px;letter-spacing:1px;}
.title .num{color:#666;font-size:14px;margin-top:6px;}
.parties{display:flex;justify-content:space-between;margin-bottom:30px;}
.party{flex:1;}
.party-label{font-weight:700;font-size:13px;color:#666;margin-bottom:4px;}
.party-info{font-size:13px;line-height:1.5;}
.party-info b{font-size:14px;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
th{background:#f5f5f5;text-align:left;padding:10px;font-size:13px;border-bottom:2px solid #ddd;}
th.right{text-align:right;}
td{padding:10px;font-size:13px;border-bottom:1px solid #eee;}
td.right{text-align:right;}
.totals{margin-left:auto;width:50%;}
.totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;}
.totals .row b{font-weight:700;}
.totals .total{border-top:1px solid #ccc;margin-top:6px;padding-top:8px;font-size:14px;}
.acquittee{color:#27a85d;text-align:right;margin-top:14px;font-size:14px;font-weight:700;}
.remarques{margin-top:40px;padding-top:20px;border-top:1px solid #eee;}
.remarques .label{font-weight:700;font-size:13px;color:#666;margin-bottom:6px;}
.remarques p{margin:4px 0;font-size:13px;}
.footer{margin-top:50px;text-align:center;color:#999;font-size:10px;}
@media print{body{margin:0;}}
</style></head><body>
<div class="header">
  <div class="logo">
    <img src="${_logo}" alt="Cancale Shoes Store" style="width:140px;height:auto;border-radius:8px;" />
  </div>
  <div class="title">
    <h1>FACTURE</h1>
    <div class="num"># ${inv.number}</div>
    <div class="num">Date : ${fmtDate(inv.saleDate)}</div>
  </div>
</div>
<div class="parties">
  <div class="party">
    <div class="party-label">De :</div>
    <div class="party-info"><b>${settings.companyName}</b><br>${settings.companyType}<br>${settings.companyAddress}<br>SIRET : ${settings.siret}</div>
  </div>
  <div class="party" style="text-align:right">
    <div class="party-label">À :</div>
    <div class="party-info"><b>${inv.buyerEmail||''}</b><br>${inv.buyerName||''}${inv.buyerAddress?', '+inv.buyerAddress:''}</div>
  </div>
</div>
<table>
  <thead><tr><th>Objet</th><th class="right">Quantité</th><th class="right">Prix unitaire (HT)</th><th class="right">Montant (HT)</th></tr></thead>
  <tbody><tr><td>${inv.itemName||''}</td><td class="right">1</td><td class="right">${(+inv.sellPrice).toFixed(2)} €</td><td class="right">${(+inv.sellPrice).toFixed(2)} €</td></tr></tbody>
</table>
<div class="totals">
  <div class="row"><b>Sous-total (TTC) :</b> <b>${(+inv.sellPrice).toFixed(2)} €</b></div>
  <div class="row total"><b>Total :</b> <b>${(+inv.sellPrice).toFixed(2)} €</b></div>
  <div class="row"><b>Montant payé :</b> <b>${(+inv.sellPrice).toFixed(2)} €</b></div>
</div>
<div class="acquittee">Facture acquittée</div>
<div class="remarques">
  <div class="label">Remarques :</div>
  ${inv.vintedNumber?`<p>Transaction Vinted n°${inv.vintedNumber}</p>`:''}
  <p>${settings.footer||'Merci pour votre achat !'}</p>
</div>
<div class="footer">N° d'étiquetage : ${inv.productId}</div>
<script>setTimeout(()=>{window.print();},400);</script>
</body></html>`;
  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
}

/* ── Garage ──────────────────────────────────────────── */
function Garage({catalog,garageGrid,setGarageGrid,blockedCells,setBlockedCells,extraCols,setExtraCols,cellColors,setCellColors,locate,onLocateConsumed,placeNum,onPlaced}) {
  const [searchInput,setSearchInput]=useState('');
  const [garageSearch,setGarageSearch]=useState(''); // recherche validée

  // Localisation demandee depuis l'inventaire : amorce la recherche sur le numero.
  useEffect(()=>{
    if(locate){
      setSearchInput(String(locate));
      setGarageSearch(String(locate));
      onLocateConsumed && onLocateConsumed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[locate]);
  const [blockMode,setBlockMode]=useState(false);
  const [colorMode,setColorMode]=useState(false);
  const [addMode,setAddMode]=useState(false); // masquer les cases vides par défaut
  const [activeColor,setActiveColor]=useState('#ffb830');
  const [focusedCell,setFocusedCell]=useState(null); // {zid, ci, si}
  const highlightRef=React.useRef(null);

  // Quand une recherche trouve une case, on défile automatiquement jusqu'à elle (centré)
  useEffect(()=>{
    if(garageSearch.trim()&&highlightRef.current){
      setTimeout(()=>{
        try{ highlightRef.current.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); }catch(e){}
      },100);
    }
  },[garageSearch]);
  
  const isBlocked=(zid,ci,si)=>blockedCells[`${zid}_${ci}_${si}`]===true;
  const toggleBlock=(zid,ci,si)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...blockedCells};
    if(u[k]) delete u[k]; else u[k]=true;
    setBlockedCells(u); save('vinted_blocked',u);
  };
  
  const getColor=(zid,ci,si)=>cellColors[`${zid}_${ci}_${si}`];
  const setColor=(zid,ci,si,color)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...cellColors};
    if(color===null||u[k]===color) delete u[k]; else u[k]=color;
    setCellColors(u); save('vinted_colors',u);
  };
  
  const soldIds=useMemo(()=>new Set(catalog.filter(p=>p.status==='vendu').map(p=>p.id)),[catalog]);
  const BW=46,BH=26,SW=6,TH=5;
  const CW=BW+SW,CH=BH+TH,GAP=3;
  
  // LAYOUT effectif avec colonnes ajoutées par l'utilisateur
  const effectiveLayout=useMemo(()=>LAYOUT.map(z=>{
    const extra=extraCols[z.id]||0;
    return {...z, cols:[...z.cols, ...Array(extra).fill(25)]};
  }),[extraCols]);
  
  const globalMax=useMemo(()=>Math.max(...effectiveLayout.flatMap(z=>z.cols.map(b=>b+z.elev))),[effectiveLayout]);
  const TOTAL=useMemo(()=>effectiveLayout.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0),[effectiveLayout]);

  const allVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='')
  ,[garageGrid]);
  
  // Set des valeurs en lowercase (recherche instantanée)
  const allValsSet=useMemo(()=>{
    const s=new Set();
    allVals.forEach(v=>s.add(v.trim().toLowerCase()));
    return s;
  },[allVals]);

  // Cohérence garage ↔ paires numérotées (annonces). Chargé depuis la même
  // source que l'onglet Comptes (clé vinted_annonce_numeros).
  const pairNumeros=useMemo(()=>load('vinted_annonce_numeros',{}),[]);
  const numberedSet=useMemo(()=>{
    const s=new Set();
    Object.values(pairNumeros).forEach(e=>{ const t=String((e&&e.numero)||'').trim().toLowerCase(); if(t) s.add(t); });
    return s;
  },[pairNumeros]);
  // Numérotées (paires connues) mais absentes du garage → à ranger.
  const numberedNotStored=useMemo(()=>Array.from(numberedSet).filter(n=>!allValsSet.has(n)).sort((a,b)=>(+a||0)-(+b||0)),[numberedSet,allValsSet]);
  // Au garage mais numéro inconnu (aucune paire numérotée) → doute/typo/ancien.
  const storedUnknown=useMemo(()=>Array.from(allValsSet).filter(n=>numberedSet.size>0&&!numberedSet.has(n)).sort((a,b)=>(+a||0)-(+b||0)),[allValsSet,numberedSet]);

  // Détection des doublons
  const duplicates=useMemo(()=>{
    const counts={};
    Object.entries(garageGrid).forEach(([key,arr])=>{
      if(!Array.isArray(arr)) return;
      arr.forEach((v,si)=>{
        const t=v&&v.trim();
        if(!t) return;
        if(!counts[t]) counts[t]=[];
        counts[t].push(`${key}_${si}`);
      });
    });
    return Object.entries(counts).filter(([k,v])=>v.length>1).map(([num,locs])=>({num,locs,count:locs.length}));
  },[garageGrid]);

  const getCol=(zid,ci,n)=>{
    const a=garageGrid[`${zid}_${ci}`];
    const r=Array.isArray(a)?[...a]:[];
    while(r.length<n) r.push('');
    return r.slice(0,n);
  };
  const setCol=(zid,ci,arr)=>{
    const u={...garageGrid,[`${zid}_${ci}`]:arr};
    setGarageGrid(u); save('vinted_garage_grid',u);
  };
  const onChange=(zid,ci,si,val,n)=>{const arr=getCol(zid,ci,n);arr[si]=val;setCol(zid,ci,arr);};
  
  // Compactage qui IGNORE les cases bloquées
  const onBlur=(zid,ci,n)=>{
    const arr=getCol(zid,ci,n);
    // Pour chaque position, savoir si elle est bloquée
    const blockedSet=new Set();
    for(let i=0;i<n;i++){
      if(isBlocked(zid,ci,i)) blockedSet.add(i);
    }
    // On extrait les valeurs non-bloquées avec leur statut
    const free=[]; // positions non-bloquées
    for(let i=0;i<n;i++){
      if(!blockedSet.has(i)) free.push({pos:i, val:arr[i]||''});
    }
    // Récupérer les valeurs remplies parmi free, en gardant l'ordre
    const filled=free.filter(f=>f.val.trim()!=='').map(f=>f.val);
    // Reconstruire : positions libres = vides en haut puis filled en bas
    const newArr=[...arr]; // garder les bloquées intactes
    let fillIdx=filled.length-1; // on remplit du bas vers le haut parmi les positions libres
    for(let i=free.length-1;i>=0;i--){
      const pos=free[i].pos;
      if(fillIdx>=0){
        newArr[pos]=filled[fillIdx];
        fillIdx--;
      } else {
        newArr[pos]='';
      }
    }
    setCol(zid,ci,newArr);
  };

  // Recherche : déclenchée seulement quand on appuie sur Entrée
  const triggerSearch=()=>setGarageSearch(searchInput);
  const clearSearch=()=>{setSearchInput('');setGarageSearch('');};
  const searchTrim=garageSearch.trim().toLowerCase();
  
  // Liste des cellules de chaque colonne pour navigation flèches
  const navigateFromCell=(zid,ci,si,direction)=>{
    // Trouve la zone et colonne courante dans effectiveLayout
    const zIdx=effectiveLayout.findIndex(z=>z.id===zid);
    if(zIdx<0) return;
    const z=effectiveLayout[zIdx];
    const maxBoxes=z.cols[ci];
    let newZ=zIdx, newCi=ci, newSi=si;
    if(direction==='up') newSi=Math.max(0,si-1);
    else if(direction==='down') newSi=Math.min(maxBoxes-1,si+1);
    else if(direction==='left') {
      if(ci>0){newCi=ci-1;}
      else if(zIdx>0){newZ=zIdx-1;newCi=effectiveLayout[zIdx-1].cols.length-1;}
      else return;
    }
    else if(direction==='right'){
      if(ci<z.cols.length-1){newCi=ci+1;}
      else if(zIdx<effectiveLayout.length-1){newZ=zIdx+1;newCi=0;}
      else return;
    }
    const targetZ=effectiveLayout[newZ];
    const targetMax=targetZ.cols[newCi];
    if(newSi>=targetMax) newSi=targetMax-1;
    setFocusedCell({zid:targetZ.id,ci:newCi,si:newSi});
    // Focus l'input après le rendu
    setTimeout(()=>{
      const inp=document.querySelector(`input[data-cell="${targetZ.id}_${newCi}_${newSi}"]`);
      if(inp) inp.focus();
    },10);
  };
  
  const COLORS=['#ffb830','#ff4d6d','#4da6ff','#a78bfa','#00e5a0','#ff8c42','#ec4899'];
  
  const addColumn=(zid)=>{
    const u={...extraCols, [zid]:(extraCols[zid]||0)+1};
    setExtraCols(u); save('vinted_extracols',u);
  };
  const removeColumn=(zid)=>{
    const u={...extraCols, [zid]:Math.max(0,(extraCols[zid]||0)-1)};
    setExtraCols(u); save('vinted_extracols',u);
  };

  let colN=0;
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Garage 🏠</h2>

      {placeNum && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 14px',borderRadius:10,background:C.accent,color:C.onAccent,fontSize:13,fontWeight:800}}>
          <span>📦 Range la paire <b>N°{placeNum}</b> : clique une case vide pour l'y placer.</span>
          <button onClick={()=>onPlaced&&onPlaced()} style={{background:'transparent',border:`1px solid ${C.onAccent}`,borderRadius:8,color:C.onAccent,cursor:'pointer',fontSize:11,fontWeight:700,padding:'3px 10px'}}>Annuler</button>
        </div>
      )}

      {/* Compteurs */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {duplicates.length>0&&<Card style={{flex:'none',padding:'10px 16px',background:`${C.danger}22`,borderColor:`${C.danger}66`}}>
          <div style={{fontSize:9,color:C.danger,textTransform:'uppercase',letterSpacing:1,fontWeight:700}}>⚠ Doublons</div>
          <div style={{fontSize:20,fontWeight:800,color:C.danger,marginTop:4}}>{duplicates.length}</div>
        </Card>}
      </div>
      
      {/* Liste des doublons */}
      {duplicates.length>0&&<Card style={{padding:12,background:`${C.danger}11`,borderColor:`${C.danger}44`}}>
        <div style={{fontSize:11,color:C.danger,fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>⚠ Numéros en doublon</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
          {duplicates.map(d=>(
            <span key={d.num} onClick={()=>{setSearchInput(d.num);setGarageSearch(d.num);}}
              style={{background:C.bg,padding:'4px 10px',borderRadius:6,cursor:'pointer',color:C.text,border:`1px solid ${C.danger}66`}}>
              <b style={{color:C.danger}}>#{d.num}</b> <span style={{color:C.muted}}>×{d.count}</span>
            </span>
          ))}
        </div>
      </Card>}
      
      {/* Cohérence : paires numérotées vs garage */}
      {(numberedNotStored.length>0||storedUnknown.length>0)&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {numberedNotStored.length>0&&(
            <Card style={{padding:12,background:`${C.warn}11`,borderColor:`${C.warn}44`}}>
              <div style={{fontSize:11,color:C.warn,fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>📦 Numérotées mais pas au garage ({numberedNotStored.length})</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Ces paires ont un numéro mais ne sont dans aucune case — à ranger.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
                {numberedNotStored.map(n=>(<span key={n} style={{background:C.bg,padding:'4px 10px',borderRadius:6,color:C.text,border:`1px solid ${C.warn}66`,fontWeight:700}}>N°{n}</span>))}
              </div>
            </Card>
          )}
          {storedUnknown.length>0&&(
            <Card style={{padding:12,background:`${C.blue||C.accent}11`,borderColor:`${C.blue||C.accent}44`}}>
              <div style={{fontSize:11,color:C.blue||C.accent,fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>❓ Au garage mais numéro inconnu ({storedUnknown.length})</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Numéros présents au garage sans paire numérotée correspondante (ancien numéro, faute de frappe, ou vendue).</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
                {storedUnknown.map(n=>(<span key={n} onClick={()=>{setSearchInput(n);setGarageSearch(n);}} style={{background:C.bg,padding:'4px 10px',borderRadius:6,cursor:'pointer',color:C.text,border:`1px solid ${(C.blue||C.accent)}66`,fontWeight:700}}>#{n}</span>))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Recherche avec bouton + Entrée */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200,display:'flex',gap:6}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="🔍 Numéro à chercher (puis Entrée)..."
          />
          <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
          {garageSearch&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
      </div>
      {searchTrim&&<div style={{fontSize:12,color:C.muted}}>
        {allValsSet.has(searchTrim)
          ?<span style={{color:C.warn}}>✓ Numéro #{garageSearch} trouvé — case en surbrillance</span>
          :<span style={{color:C.danger}}>✗ Numéro #{garageSearch} non trouvé dans le garage</span>}
      </div>}
      
      {/* Modes & boutons */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <Btn small onClick={()=>{setAddMode(!addMode);setBlockMode(false);setColorMode(false);}} color={addMode?C.accent:C.border} style={{color:addMode?'#fff':C.muted}}>
          {addMode?'✓ Mode ajout actif':'➕ Mode ajout'}
        </Btn>
        <Btn small onClick={()=>{setBlockMode(!blockMode);setColorMode(false);setAddMode(false);}} color={blockMode?C.danger:C.border} style={{color:blockMode?'#fff':C.muted}}>
          {blockMode?'✓ Mode blocage':'🔒 Mode blocage'}
        </Btn>
        <Btn small onClick={()=>{setColorMode(!colorMode);setBlockMode(false);setAddMode(false);}} color={colorMode?activeColor:C.border} style={{color:colorMode?'#fff':C.muted}}>
          {colorMode?'✓ Mode couleur':'🎨 Mode couleur'}
        </Btn>
        {colorMode&&<div style={{display:'flex',gap:4,alignItems:'center'}}>
          {COLORS.map(col=>(
            <button key={col} onClick={()=>setActiveColor(col)}
              style={{width:22,height:22,borderRadius:'50%',background:col,border:activeColor===col?'2px solid #fff':'2px solid transparent',cursor:'pointer'}}
              title={col}/>
          ))}
          <button onClick={()=>setActiveColor(null)}
            style={{width:22,height:22,borderRadius:'50%',background:'transparent',border:'2px dashed #555',cursor:'pointer',fontSize:10,color:'#666'}}
            title="Effacer">✕</button>
        </div>}
      </div>
      {(blockMode||colorMode||addMode)&&<div style={{fontSize:11,color:C.muted}}>
        {addMode&&'Toutes les cases sont visibles. Tu peux ajouter des paires dans les cases vides.'}
        {blockMode&&'Clique sur une case vide pour la bloquer/débloquer (zone non utilisable). '}
        {colorMode&&(activeColor?'Clique sur une case pour la colorier. Re-clique pour effacer la couleur.':'Sélectionne une couleur, ou ✕ pour effacer la couleur d\'une case.')}
      </div>}
      {/* Boutons d'ajout de colonnes */}
      <Card style={{padding:10}}>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6,fontWeight:700}}>Colonnes</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {LAYOUT.map(z=>(
            <div key={z.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,background:C.bg,padding:'4px 8px',borderRadius:6}}>
              <span style={{color:C.muted}}>Colonnes :</span>
              <button onClick={()=>removeColumn(z.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.danger,borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>−</button>
              <span style={{color:C.accent,fontWeight:700,minWidth:24,textAlign:'center'}}>{z.cols.length+(extraCols[z.id]||0)}</span>
              <button onClick={()=>addColumn(z.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>+</button>
            </div>
          ))}
        </div>
      </Card>
      
      {/* Garage visuel */}
      <Card style={{overflowX:'auto',padding:'14px 10px'}}>
        <div style={{display:'flex',gap:GAP,marginBottom:6}}>
          {effectiveLayout.flatMap((z,zi)=>{
            const labels=z.cols.map((_,ci)=>(
              <div key={`l${zi}_${ci}`} style={{width:CW,flexShrink:0,fontSize:7,fontWeight:800,color:ci===0?C.accent:'transparent',textTransform:'uppercase',letterSpacing:0.5}}>
                {ci===0?z.name:''}
              </div>
            ));
            return labels;
          })}
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:GAP}}>
          {effectiveLayout.flatMap((z,zi)=>{
            const cols=z.cols.map((maxBoxes,ci)=>{
              const spacerTop=globalMax-(maxBoxes+z.elev);
              const arr=getCol(z.id,ci,maxBoxes);
              const cn=++colN;
              return (
                <div key={`c${zi}_${ci}`} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:GAP}}>
                  {Array.from({length:spacerTop},(_,i)=><div key={`sp${i}`} style={{width:CW,height:CH}}/>)}
                  {Array.from({length:z.elev},(_,i)=><div key={`ev${i}`} style={{width:CW,height:CH}}/>)}
                  {arr.map((val,si)=>{
                    const t=val?val.trim():'';
                    const isSold=t!==''&&soldIds.has(t);
                    const highlight=searchTrim!==''&&t.toLowerCase()===searchTrim;
                    const blocked=isBlocked(z.id,ci,si);
                    const cellColor=getColor(z.id,ci,si);
                    
                    // Masquer les cases vides (non bloquées, sans couleur) sauf en mode ajout/blocage/couleur/rangement
                    const showAllCells=addMode||blockMode||colorMode||!!placeNum;
                    if(!showAllCells&&!blocked&&t===''&&!cellColor){
                      // Case invisible : on rend juste un placeholder vide pour garder l'alignement
                      return <div key={si} style={{width:CW,height:CH}}/>;
                    }
                    
                    if(blocked) return (
                      <div key={si} onClick={()=>{if(blockMode)toggleBlock(z.id,ci,si);}}
                        style={{position:'relative',width:CW,height:CH,
                          cursor:blockMode?'pointer':'default',
                          opacity:0.5}}>
                        <svg width={BW+SW} height={BH+TH} style={{display:'block',overflow:'visible'}}>
                          <rect x={0} y={TH} width={BW} height={BH} rx={2} fill='transparent' stroke='#444' strokeWidth='1' strokeDasharray='3,2'/>
                          <line x1={4} y1={TH+4} x2={BW-4} y2={TH+BH-4} stroke='#666' strokeWidth='1.5'/>
                          <line x1={BW-4} y1={TH+4} x2={4} y2={TH+BH-4} stroke='#666' strokeWidth='1.5'/>
                        </svg>
                      </div>
                    );
                    
                    return (
                      <div key={si} ref={highlight?highlightRef:null} onClick={()=>{
                        if(blockMode&&!t) toggleBlock(z.id,ci,si);
                        else if(colorMode) setColor(z.id,ci,si,activeColor);
                      }}
                        style={{position:'relative',width:CW,height:CH,
                          cursor:(blockMode&&!t)||colorMode?'pointer':'auto'}}>
                        {cellColor&&<div style={{position:'absolute',inset:0,top:TH,background:cellColor,opacity:0.35,borderRadius:2,zIndex:1,pointerEvents:'none'}}/>}
                        <Box val={val} isSold={isSold} highlight={highlight}/>
                        {!blockMode&&!colorMode&&<input value={val}
                          data-cell={`${z.id}_${ci}_${si}`}
                          onChange={e=>onChange(z.id,ci,si,e.target.value,maxBoxes)}
                          onClick={()=>{ if(placeNum&&!t){ onChange(z.id,ci,si,String(placeNum),maxBoxes); onBlur(z.id,ci,maxBoxes); onPlaced&&onPlaced(); } }}
                          onBlur={()=>onBlur(z.id,ci,maxBoxes)}
                          onKeyDown={e=>{
                            if(e.key==='ArrowUp'){e.preventDefault();navigateFromCell(z.id,ci,si,'up');}
                            else if(e.key==='ArrowDown'){e.preventDefault();navigateFromCell(z.id,ci,si,'down');}
                            else if(e.key==='ArrowLeft'&&e.target.selectionStart===0){e.preventDefault();navigateFromCell(z.id,ci,si,'left');}
                            else if(e.key==='ArrowRight'&&e.target.selectionStart===e.target.value.length){e.preventDefault();navigateFromCell(z.id,ci,si,'right');}
                            else if(e.key==='Enter'){e.preventDefault();navigateFromCell(z.id,ci,si,'down');}
                          }}
                          style={{position:'absolute',left:0,top:TH,width:BW,height:BH,background:'transparent',border:'none',outline:'none',textAlign:'center',fontSize:8,fontWeight:800,color:'transparent',caretColor:C.warn,fontFamily:'inherit',cursor:'text',zIndex:3,boxSizing:'border-box'}}
                          onFocus={e=>{e.target.parentElement.style.filter='brightness(1.35)';}}
                          onBlurCapture={e=>{e.target.parentElement.style.filter='';}}
                        />}
                      </div>
                    );
                  })}
                  <div style={{fontSize:7,color:'#333',textAlign:'center',width:CW}}>{cn}</div>
                </div>
              );
            });
            return cols;
          })}
        </div>
      </Card>
    </div>
  );
}

/* ── App ─────────────────────────────────────────────── */

/* ── BackupModal ─────────────────────────────────────── */
function BackupModal({catalog,sales,garageGrid,blockedCells,onClose,onImport}) {
  const exportData=()=>{
    const data={
      catalog,sales,garageGrid,blockedCells,
      exportedAt:new Date().toISOString(),
      version:'1.0',
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`shop-cancale-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const importData=(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.catalog&&!data.sales){
          alert('❌ Fichier invalide : pas de données détectées');
          return;
        }
        if(window.confirm(`Importer cette sauvegarde ?\n\nCatalogue: ${data.catalog?.length||0} paires\nVentes: ${data.sales?.length||0} ventes\n\n⚠️ Tes données actuelles seront remplacées.`)){
          onImport(data);
        }
      }catch(err){
        alert('❌ Erreur de lecture : '+err.message);
      }
    };
    reader.readAsText(file);
  };
  
  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20,
      animation:'fadeIn 0.2s',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:C.card,border:`1px solid ${C.border}`,borderRadius:8,
        padding:24,maxWidth:480,width:'100%',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,color:C.accent,fontSize:18,fontWeight:800}}>💾 Sauvegarde</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        
        <div style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.5}}>
          Sauvegarde toutes tes données (catalogue, ventes, garage) dans un fichier JSON. Tu peux le restaurer plus tard ou sur un autre appareil.
        </div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📤 Exporter</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              <b>{catalog.length}</b> paires · <b>{sales.length}</b> ventes
            </div>
            <Btn small onClick={exportData} color={C.accent}>💾 Télécharger sauvegarde</Btn>
          </div>
          
          <div style={{background:`${C.warn}11`,border:`1px solid ${C.warn}44`,borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📥 Restaurer</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              ⚠️ Cela remplacera toutes tes données actuelles
            </div>
            <label style={{display:'inline-block',cursor:'pointer'}}>
              <input type="file" accept=".json" onChange={importData} style={{display:'none'}}/>
              <span style={{
                display:'inline-block',background:C.warn,color:'#000',
                border:'none',borderRadius:8,padding:'5px 12px',
                fontSize:12,fontWeight:700,fontFamily:'inherit',
              }}>📁 Choisir un fichier JSON</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stock Vinted ──────────────────────────────────────── */
// Suivi des annonces en ligne sur Vinted, avec réconciliation garage.
// - Saisie manuelle des numéros (à l'unité + collage en masse)
// - Une facture qui arrive => le numéro se retire automatiquement (géré dans App via useEffect)
// - Une facture supprimée => le numéro revient (géré dans App)
// - Nouveau numéro au catalogue (à partir de maintenant) => ajout auto (géré dans App)
// - Incohérences : compare le Stock Vinted avec les numéros présents dans le Garage
function StockVinted({stockVinted,setStockVinted,garageGrid,invoices}) {
  const [input,setInput]=useState('');
  const [bulk,setBulk]=useState('');
  const [showBulk,setShowBulk]=useState(false);
  const [search,setSearch]=useState('');

  // Normalise un numéro (string, trim)
  const norm=(v)=>String(v||'').trim();

  // Ajoute un numéro à l'unité
  const addOne=()=>{
    const n=norm(input);
    if(!n){ return; }
    if(stockVinted.includes(n)){ alert('Le numéro '+n+' est déjà dans le stock Vinted.'); setInput(''); return; }
    const u=[...stockVinted,n];
    setStockVinted(u); save('vinted_stock_vinted',u);
    setInput('');
  };

  // Ajoute plusieurs numéros d'un coup (séparés par virgule, espace, point-virgule ou saut de ligne)
  const addBulk=()=>{
    const parts=bulk.split(/[\s,;]+/).map(norm).filter(Boolean);
    if(parts.length===0){ alert('Aucun numéro détecté.'); return; }
    const set=new Set(stockVinted);
    let added=0;
    parts.forEach(p=>{ if(!set.has(p)){ set.add(p); added++; } });
    const u=Array.from(set);
    setStockVinted(u); save('vinted_stock_vinted',u);
    setBulk(''); setShowBulk(false);
    alert(added+' numéro(s) ajouté(s) au stock Vinted.');
  };

  // Retire un numéro manuellement
  const removeOne=(n)=>{
    const u=stockVinted.filter(x=>x!==n);
    setStockVinted(u); save('vinted_stock_vinted',u);
  };

  // Numéros présents dans le garage (toutes les cases non vides)
  const garageNums=useMemo(()=>{
    const s=new Set();
    Object.values(garageGrid||{}).forEach(arr=>{
      if(Array.isArray(arr)) arr.forEach(v=>{ const t=norm(v); if(t) s.add(t); });
    });
    return s;
  },[garageGrid]);

  // Set du stock Vinted pour comparaisons rapides
  const stockSet=useMemo(()=>new Set(stockVinted.map(norm)),[stockVinted]);

  // Incohérences :
  //  - "en ligne mais pas au garage" : numéro dans Stock Vinted mais introuvable dans le garage
  //    (=> l'annonce est en ligne alors que la paire n'est plus là : à vérifier)
  //  - "au garage mais pas en ligne" : numéro présent au garage mais pas dans Stock Vinted
  //    (=> paire stockée mais pas annoncée : peut-être à mettre en ligne)
  const enLignePasGarage=useMemo(()=>
    stockVinted.map(norm).filter(n=>n&&!garageNums.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[stockVinted,garageNums]);

  const garagePasEnLigne=useMemo(()=>
    Array.from(garageNums).filter(n=>!stockSet.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[garageNums,stockSet]);

  // Liste filtrée pour l'affichage
  const liste=useMemo(()=>{
    const arr=[...stockVinted].map(norm).sort((a,b)=>(+a||0)-(+b||0));
    const q=norm(search).toLowerCase();
    if(!q) return arr;
    return arr.filter(n=>n.toLowerCase().includes(q));
  },[stockVinted,search]);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:800}}>🟢 Stock Vinted ({stockVinted.length})</h2>
        <button onClick={()=>setShowBulk(s=>!s)} style={{background:C.purple,color:'#fff',border:'none',borderRadius:8,padding:'7px 12px',fontWeight:700,fontSize:12,cursor:'pointer'}}>
          {showBulk?'Fermer':'Coller en masse'}
        </button>
      </div>

      <p style={{fontSize:12.5,color:C.muted,margin:'0 0 14px',lineHeight:1.5}}>
        Liste de tes annonces actuellement en ligne sur Vinted. Ajoute tes numéros un par un ci-dessous.
        Quand une facture arrive, le numéro se retire tout seul ; si tu supprimes la facture, il revient. Les nouveaux numéros ajoutés au catalogue s'ajoutent aussi automatiquement.
      </p>

      {/* Saisie à l'unité */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') addOne(); }}
          placeholder="N° de l'annonce (ex : 1908)"
          inputMode="numeric"
          style={{flex:1,padding:'10px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:14}}
        />
        <button onClick={addOne} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'10px 16px',fontWeight:700,fontSize:14,cursor:'pointer'}}>
          Ajouter
        </button>
      </div>

      {/* Collage en masse (optionnel) */}
      {showBulk&&(
        <div style={{marginBottom:14,padding:12,background:C.card2||'rgba(0,0,0,0.04)',borderRadius:8}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Colle plusieurs numéros (séparés par espace, virgule ou retour à la ligne) :</div>
          <textarea
            value={bulk}
            onChange={e=>setBulk(e.target.value)}
            rows={4}
            placeholder="1908 1925 898 ..."
            style={{width:'100%',padding:10,border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:13,boxSizing:'border-box',resize:'vertical'}}
          />
          <button onClick={addBulk} style={{marginTop:8,background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'9px 16px',fontWeight:700,fontSize:13,cursor:'pointer'}}>
            Ajouter tout
          </button>
        </div>
      )}

      {/* Incohérences */}
      {(enLignePasGarage.length>0||garagePasEnLigne.length>0)&&(
        <div style={{marginBottom:16}}>
          <h3 style={{fontSize:14,fontWeight:800,margin:'0 0 8px',color:C.warn}}>⚠️ Incohérences avec le garage</h3>

          {enLignePasGarage.length>0&&(
            <div style={{marginBottom:10,padding:10,background:'rgba(156,106,31,0.10)',borderRadius:8}}>
              <div style={{fontSize:12.5,fontWeight:700,marginBottom:4}}>En ligne mais absent du garage ({enLignePasGarage.length})</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces annonces sont dans ton stock Vinted mais leur numéro n'est pas dans le garage.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {enLignePasGarage.map(n=>(
                  <span key={n} style={{background:C.warn,color:'#fff',borderRadius:6,padding:'3px 8px',fontSize:12,fontWeight:700}}>{n}</span>
                ))}
              </div>
            </div>
          )}

          {garagePasEnLigne.length>0&&(
            <div style={{padding:10,background:'rgba(0,119,130,0.08)',borderRadius:8}}>
              <div style={{fontSize:12.5,fontWeight:700,marginBottom:4}}>Au garage mais pas en ligne ({garagePasEnLigne.length})</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces paires sont dans le garage mais pas dans ton stock Vinted (peut-être à mettre en ligne).</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {garagePasEnLigne.map(n=>(
                  <span key={n} style={{background:C.accent,color:C.onAccent,borderRadius:6,padding:'3px 8px',fontSize:12,fontWeight:700}}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recherche */}
      {stockVinted.length>0&&(
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher un numéro…"
          style={{width:'100%',padding:'9px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:13,boxSizing:'border-box',marginBottom:12}}
        />
      )}

      {/* Liste des numéros en ligne */}
      {liste.length===0?(
        <div style={{textAlign:'center',color:C.muted,fontSize:13,padding:'30px 0'}}>
          {stockVinted.length===0?'Aucun numéro pour le moment. Ajoute tes annonces en ligne ci-dessus.':'Aucun résultat.'}
        </div>
      ):(
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {liste.map(n=>{
            const absentGarage=!garageNums.has(n);
            return (
              <span key={n} style={{
                display:'inline-flex',alignItems:'center',gap:6,
                background:absentGarage?'rgba(156,106,31,0.12)':(C.card2||'rgba(0,0,0,0.05)'),
                border:absentGarage?`1px solid ${C.warn}`:'1px solid transparent',
                borderRadius:8,padding:'5px 8px 5px 10px',fontSize:13,fontWeight:700
              }}>
                {n}
                <button onClick={()=>removeOne(n)} title="Retirer" style={{background:'none',border:'none',color:C.danger,cursor:'pointer',fontSize:15,lineHeight:1,padding:0,fontWeight:900}}>×</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ── Comptes Vinted liés (gestion des comptes uniquement) ───────────────
   Cet écran ne sert plus qu'à GÉRER les comptes liés (les capturés par
   l'extension) : les lister, les renommer, tester la connexion, resynchroniser.
   Les données (annonces, ventes, achats, messages, bordereaux) vivent désormais
   dans les onglets DÉDIÉS du menu (Annonces / Ventes / Achats / Bordereaux /
   Messages), tous rendus par <Comptabilite/>. On a donc retiré d'ici tout ce
   qui était en doublon (numérotation, sélecteur d'achat, vues, conversations,
   bordereaux) — un seul endroit par chose. */
function VintedAccounts({ accounts, setAccounts }) {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState({}); // { [vinted_user_id]: {ok, label, loading} }
  const [labels, setLabels] = useState(() => load('vinted_account_labels', {}));
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  // Comptes exclus de la comptabilité (leurs ventes ne comptent pas).
  const [hiddenAccts, setHiddenAccts] = useState(() => new Set((load('vinted_accounts_hidden', []) || []).map(String)));
  const toggleAcctCompta = (uid) => {
    setHiddenAccts(prev => { const n = new Set(prev); const k = String(uid); if (n.has(k)) n.delete(k); else n.add(k); save('vinted_accounts_hidden', [...n]); return n; });
  };

  const startEditLabel = (acc) => { setEditingLabel(acc.vinted_user_id); setLabelDraft(labels[acc.vinted_user_id] || acc.login || ''); };
  const commitLabel = (acc) => {
    const u = { ...labels, [acc.vinted_user_id]: labelDraft.trim() };
    if (!u[acc.vinted_user_id]) delete u[acc.vinted_user_id];
    setLabels(u); save('vinted_account_labels', u);
    setEditingLabel(null);
  };
  const accountName = (acc) => labels[acc.vinted_user_id] || acc.login || `Compte #${acc.vinted_user_id}`;

  // Déconnecter un compte : le retire de l'app (Supabase + state). Utile quand un
  // compte est bloqué/fermé définitivement. On garde son étiquette au cas où.
  const [removing, setRemoving] = useState(null);
  const disconnectAccount = async (acc) => {
    if (!window.confirm(`Déconnecter « ${accountName(acc)} » de l'application ?\n\nSes tokens seront supprimés. Un compte encore actif dans Chrome pourra revenir au prochain passage sur Vinted ; un compte bloqué ne reviendra pas.`)) return;
    setRemoving(acc.vinted_user_id);
    const ok = await deleteVintedAccount(acc.vinted_user_id);
    setRemoving(null);
    if (!ok) { alert('Échec de la déconnexion. Réessaie.'); return; }
    setAccounts(prev => prev.filter(a => a.vinted_user_id !== acc.vinted_user_id));
  };

  const refreshAccounts = async () => {
    setLoading(true);
    const list = await fetchVintedAccounts();
    setAccounts(list);
    setLoading(false);
  };
  useEffect(() => { refreshAccounts(); /* eslint-disable-next-line */ }, []);

  // Test de connexion : un appel léger (compteur de notifications non lues) sur
  // LE compte testé uniquement — jamais tous d'un coup, pour ne pas ressembler à
  // un robot multi-comptes (voir CLAUDE.md §5, profil discret).
  const testAccount = async (acc) => {
    setTestResult(r => ({ ...r, [acc.vinted_user_id]: { loading: true } }));
    const notifHost = VINTED_NOTIF_API_HOST[acc.domain] || 'api.vinted.fr';
    const res = await vintedApiCall(acc, '/inbox-notifications/v1/notifications/unread_count', { host: notifHost });
    setTestResult(r => ({
      ...r,
      [acc.vinted_user_id]: {
        ok: !!res.ok,
        label: res.ok
          ? `✓ Connexion acceptée`
          : `✗ Échec (${res.status || res.error || 'erreur inconnue'})${res.status === 403 ? ' — anti-robot Vinted' : ''}`,
      },
    }));
  };

  return (
    <div style={{padding:'16px 14px 40px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <h2 style={{fontSize:18,fontWeight:800,color:C.text,margin:0}}>🔗 Comptes Vinted liés</h2>
        <button onClick={refreshAccounts} title="Recharge la liste des comptes captés par l'extension" style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:999,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,color:C.text}}>
          {loading ? '…' : '↻ Actualiser'}
        </button>
      </div>

      <div style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.5}}>
        Les comptes ci-dessous sont ceux captés par l'extension Chrome quand tu navigues sur Vinted.
        Les annonces, ventes, achats et messages se consultent dans les onglets dédiés du menu.
      </div>

      {accounts.length === 0 && (
        <div style={{padding:16,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,fontSize:13,color:C.muted,lineHeight:1.5}}>
          Aucun compte détecté pour l'instant. Installe l'extension « Shop Cancale35 – Vinted Sync »,
          connecte-toi sur vinted.fr, puis clique sur « Actualiser ».
        </div>
      )}

      {accounts.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {accounts.map(acc => {
            const tr = testResult[acc.vinted_user_id];
            return (
              <div key={acc.vinted_user_id} style={{borderRadius:14,border:`1px solid ${C.border}`,background:C.card,padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
                  <span style={{width:36,height:36,flexShrink:0,borderRadius:999,background:C.border,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900}}>
                    {accountName(acc).slice(0,1).toUpperCase()}
                  </span>
                  <div style={{minWidth:0}}>
                    {editingLabel === acc.vinted_user_id ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input autoFocus value={labelDraft} onChange={e=>setLabelDraft(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter') commitLabel(acc); if(e.key==='Escape') setEditingLabel(null); }}
                          placeholder={acc.login || `Compte #${acc.vinted_user_id}`}
                          style={{fontSize:15,fontWeight:800,color:C.text,background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,padding:'3px 8px',width:170}}/>
                        <button onClick={()=>commitLabel(acc)} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:700}}>OK</button>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer'}} onClick={()=>startEditLabel(acc)} title="Cliquer pour renommer">
                        <div style={{fontWeight:800,color:C.text,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{accountName(acc)}</div>
                        <span style={{fontSize:11,color:C.muted}}>✎</span>
                      </div>
                    )}
                    <div style={{fontSize:11,color:C.muted,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {acc.login && acc.login !== accountName(acc) ? `@${acc.login} · ` : ''}
                      maj {acc.updated_at ? new Date(acc.updated_at).toLocaleString('fr-FR') : '—'}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {tr && !tr.loading && <span style={{fontSize:11,fontWeight:700,color:tr.ok?C.accent:C.danger}}>{tr.label}</span>}
                  {(() => { const off = hiddenAccts.has(String(acc.vinted_user_id)); return (
                    <button onClick={()=>toggleAcctCompta(acc.vinted_user_id)} title={off?'Ce compte est EXCLU de ta comptabilité':'Ce compte compte dans ta comptabilité'}
                      style={{background:off?'transparent':`${C.accent}14`,border:`1px solid ${off?C.border:C.accent}`,borderRadius:999,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:700,color:off?C.muted:C.accent}}>
                      {off ? '🚫 Hors compta' : '✅ Dans la compta'}
                    </button>
                  ); })()}
                  <button onClick={()=>testAccount(acc)} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:999,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:700,color:C.text}}>
                    {tr?.loading ? 'Test…' : 'Tester la connexion'}
                  </button>
                  <button onClick={()=>disconnectAccount(acc)} disabled={removing===acc.vinted_user_id} title="Retirer ce compte de l'application"
                    style={{background:'transparent',border:`1px solid ${C.danger}`,borderRadius:999,padding:'5px 12px',cursor:'pointer',fontSize:11,fontWeight:700,color:C.danger,opacity:removing===acc.vinted_user_id?0.5:1}}>
                    {removing===acc.vinted_user_id ? '…' : 'Déconnecter'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Inventaire numéroté ─────────────────────────────────
   Nouveau coeur de l'app : chaque paire porte un NUMERO attribue a la main par
   Julien. On peut :
   - ajouter une paire manuellement (numero + titre + statut) ;
   - importer les annonces EN LIGNE d'un compte Vinted (wardrobe) et associer
     manuellement un numero a chacune ("je montre a quoi correspond quoi") ;
   - voir si la paire est rangee au garage (les cases du garage contiennent ces
     memes numeros) ;
   - marquer En ligne / Vendu / Stock.
   Stocke dans la cle localStorage synchronisee "vinted_inventory". */
const INV_STATUS = {
  online:       { label: 'En ligne',      color: '#22a06b', icon: '🟢' },
  pending_sale: { label: 'Vente en cours', color: '#2f80ed', icon: '⏳' },
  sold:         { label: 'Vendu',         color: '#c0392b', icon: '💸' },
  stock:        { label: 'Stock',         color: '#f39c12', icon: '📦' },
};
// Normalise un titre pour comparer une annonce et une commande vendue (Vinted
// renvoie le titre exact de l'article dans les deux). Insensible casse/espaces.
const normTitle = (t) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim();
// Clé photo stable (indépendante de la taille d'image) extraite d'une URL Vinted :
//   https://images1.vinted.net/t/{JETON}/{taille}/{n}.jpeg  ->  {JETON}
// Le JETON identifie LA photo de l'article, identique sur l'annonce et sur la
// vente. Permet de relier une VENTE à sa paire numérotée PAR LA PHOTO — même sans
// numéro dans le titre, et même si le titre est en double.
const photoKey = (url) => { const m = String(url || '').match(/\/t\/([^/?]+)/); return m ? m[1] : null; };
function Inventory({ inventory, setInventory, accounts, garageGrid, labels, onLocate }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | online | sold | stock
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ numero:'', title:'', status:'stock' });
  const [showImport, setShowImport] = useState(false);
  const [importState, setImportState] = useState({}); // { [accId]: {loading, items, error} }
  const [importNums, setImportNums] = useState({});   // { [itemId]: numero }
  const [editing, setEditing] = useState(null);       // pair id
  const [editDraft, setEditDraft] = useState(null);
  const bordereauInputRef = React.useRef(null);
  const bordereauPairRef = React.useRef(null);        // paire ciblee par l'annotation

  const persist = (next) => { setInventory(next); save('vinted_inventory', next); };

  // Bordereau : on demande a l'utilisateur le PDF telecharge depuis Vinted, puis
  // on y imprime le numero + le titre de la paire avant de le retelecharger.
  const startBordereau = (pair) => { bordereauPairRef.current = pair; bordereauInputRef.current?.click(); };
  const onBordereauFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    const pair = bordereauPairRef.current;
    if (!file || !pair) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Merci de choisir le bordereau au format PDF téléchargé depuis Vinted.'); return;
    }
    try {
      const buf = await file.arrayBuffer();
      await annotateAndDownloadBordereau(pair.numero, pair.title, buf);
    } catch (err) {
      alert('Impossible d\'annoter ce PDF : ' + String(err));
    }
  };

  // Index inverse garage : numero (normalise) -> present dans une case ?
  const garageNums = useMemo(() => {
    const s = new Set();
    Object.values(garageGrid || {}).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(v => { const t = (v||'').trim().toLowerCase(); if (t) s.add(t); });
    });
    return s;
  }, [garageGrid]);
  const inGarage = (numero) => !!numero && garageNums.has(String(numero).trim().toLowerCase());

  const accName = (accId) => (labels && labels[accId]) || accounts.find(a=>a.vinted_user_id===accId)?.login || `Compte #${accId}`;

  const numeroExists = (numero, exceptId=null) =>
    inventory.some(p => String(p.numero).trim().toLowerCase() === String(numero).trim().toLowerCase() && p.id !== exceptId);

  const addPair = () => {
    const numero = addForm.numero.trim();
    if (!numero) { alert('Indique un numéro.'); return; }
    if (numeroExists(numero)) { alert(`Le numéro ${numero} est déjà utilisé.`); return; }
    const pair = { id: uid(), numero, title: addForm.title.trim(), status: addForm.status,
      vintedItemId:null, vintedAccountId:null, price:null, photo:null, soldAt:null, transactionId:null, createdAt: tod() };
    persist([pair, ...inventory]);
    setAddForm({ numero:'', title:'', status:'stock' });
    setShowAdd(false);
  };

  const deletePair = (id) => {
    if (!window.confirm('Supprimer cette paire de l\'inventaire ?')) return;
    persist(inventory.filter(p => p.id !== id));
  };

  const startEdit = (p) => { setEditing(p.id); setEditDraft({ ...p }); };
  const commitEdit = () => {
    const numero = String(editDraft.numero).trim();
    if (!numero) { alert('Le numéro ne peut pas être vide.'); return; }
    if (numeroExists(numero, editDraft.id)) { alert(`Le numéro ${numero} est déjà utilisé.`); return; }
    persist(inventory.map(p => p.id === editDraft.id ? { ...editDraft, numero } : p));
    setEditing(null); setEditDraft(null);
  };

  // Import : charge les annonces en ligne d'un compte.
  const loadListings = async (acc) => {
    setImportState(s => ({ ...s, [acc.vinted_user_id]: { loading:true } }));
    const res = await fetchVintedListings(acc);
    setImportState(s => ({ ...s, [acc.vinted_user_id]: { loading:false, items: res.ok?res.items:[], error: res.ok?null:res.error } }));
    // Pre-remplit une suggestion de numero depuis le titre (nXX) - modifiable.
    if (res.ok) {
      setImportNums(prev => {
        const u = { ...prev };
        res.items.forEach(it => { if (u[it.id] === undefined) u[it.id] = extractPairNumber(it.title) || ''; });
        return u;
      });
    }
  };

  // Associe une annonce en ligne a un numero (cree ou met a jour la paire).
  const associate = (acc, listing) => {
    const numero = String(importNums[listing.id] || '').trim();
    if (!numero) { alert('Indique le numéro à associer à cette annonce.'); return; }
    const existing = inventory.find(p => String(p.numero).trim().toLowerCase() === numero.toLowerCase());
    if (existing) {
      // On sauvegarde le titre EXACT de l'annonce : c'est ce même titre qui
      // reviendra dans la commande vendue, et qui permettra de retrouver le
      // numéro au moment de la vente (les commandes n'ont pas d'id d'article).
      persist(inventory.map(p => p.id === existing.id
        ? { ...p, title: listing.title, status:'online', vintedItemId: listing.id,
            vintedAccountId: acc.vinted_user_id, price: listing.price, photo: listing.photo }
        : p));
    } else {
      const pair = { id: uid(), numero, title: listing.title, status:'online', vintedItemId: listing.id,
        vintedAccountId: acc.vinted_user_id, price: listing.price, photo: listing.photo, soldAt:null, transactionId:null, createdAt: tod() };
      persist([pair, ...inventory]);
    }
  };

  const isListingLinked = (itemId) => inventory.some(p => p.vintedItemId === String(itemId));

  // Synchronise les VENTES depuis Vinted : recupere les commandes vendues de
  // chaque compte et bascule en "Vendu" les paires de l'inventaire dont le
  // numero (nXX) apparait dans le titre de la commande. Ne touche jamais une
  // paire deja marquee vendue, ni une commande annulee/remboursee.
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const syncSalesFromVinted = async () => {
    if (accounts.length === 0) { setSyncResult({ msg:'Aucun compte Vinted lié.' }); return; }
    setSyncing(true); setSyncResult(null);
    // Matching par TITRE : les annonces Vinted n'exposent pas d'id d'article
    // dans les commandes, seulement le titre exact. On a sauvegardé ce titre
    // sur chaque paire au moment de l'association -> on relie ainsi la vente au
    // numéro sans dépendre d'un "nXX" dans le titre.
    const byTitle = new Map();
    inventory.forEach(p => { const k = normTitle(p.title); if (k) byTitle.set(k, p); });
    const updates = new Map(); // id -> patch
    let sold = 0, pending = 0, scanned = 0;
    for (const acc of accounts) {
      // Priorité aux ventes moissonnées par l'extension (aucun appel Vinted).
      // Sinon repli sur le proxy (jusqu'à 3 pages).
      const harvested = await fetchHarvest(acc.vinted_user_id, 'orders');
      let pages;
      if (harvested && Array.isArray(harvested.my_orders)) {
        pages = [harvested.my_orders];
      } else {
        pages = [];
        for (let page = 1; page <= 3; page++) {
          const res = await fetchVintedOrders(acc, 'sold', page, 'all');
          if (!res.ok) break;
          pages.push(res.items || []);
          if (!res.pagination || page >= (res.pagination.total_pages || 1)) break;
        }
      }
      for (const orders of pages) {
        scanned += orders.length;
        for (const o of orders) {
          const cls = classifyOrderStatus(o.status);
          const pair = byTitle.get(normTitle(o.title));
          if (!pair) continue;
          const base = {
            transactionId: o.transaction_id || pair.transactionId || null,
            photo: pair.photo || o.photo_url || null,
            price: pair.price ?? (o.price?.amount != null ? Number(o.price.amount) : null),
            vintedAccountId: pair.vintedAccountId || acc.vinted_user_id,
          };
          if (cls === 'completed') {
            // Vente FINALISÉE = argent reçu -> on la comptabilise.
            if (pair.status !== 'sold') { updates.set(pair.id, { ...base, status:'sold', soldAt: o.date ? new Date(o.date).toLocaleDateString('fr-FR') : tod() }); sold++; }
          } else if (cls === 'cancelled') {
            // Annulée/remboursée : si on l'avait mise "en cours", on la remet en ligne.
            if (pair.status === 'pending_sale') updates.set(pair.id, { status:'online' });
          } else {
            // Vente en cours (expédiée, en acheminement...) : on l'affiche mais on
            // NE la compte PAS tant que l'acheteur n'a pas validé (argent reçu).
            if (pair.status === 'online' || pair.status === 'stock') { updates.set(pair.id, { ...base, status:'pending_sale' }); pending++; }
          }
        }
      }
    }
    if (updates.size > 0) {
      persist(inventory.map(p => updates.has(p.id) ? { ...p, ...updates.get(p.id) } : p));
    }
    setSyncing(false);
    setSyncResult({ sold, pending, scanned });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inventory
      .filter(p => filter === 'all' ? true : p.status === filter)
      .filter(p => !term || String(p.numero).toLowerCase().includes(term) || (p.title||'').toLowerCase().includes(term))
      .sort((a,b) => {
        const na = parseInt(a.numero,10), nb = parseInt(b.numero,10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return String(a.numero).localeCompare(String(b.numero));
      });
  }, [inventory, q, filter]);

  const counts = useMemo(() => ({
    all: inventory.length,
    online: inventory.filter(p=>p.status==='online').length,
    pending_sale: inventory.filter(p=>p.status==='pending_sale').length,
    sold: inventory.filter(p=>p.status==='sold').length,
    stock: inventory.filter(p=>p.status==='stock').length,
  }), [inventory]);

  const inputStyle = { padding:'8px 10px', borderRadius:8, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:13 };
  const btn = (bg, fg='#fff') => ({ padding:'8px 12px', borderRadius:8, border:'none', background:bg, color:fg, fontWeight:700, fontSize:13, cursor:'pointer' });

  return (
    <div style={{padding:'0 4px'}}>
      <input ref={bordereauInputRef} type="file" accept="application/pdf,.pdf" onChange={onBordereauFile} style={{display:'none'}}/>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
        <StatBox label="Paires" value={counts.all}/>
        <StatBox label="En ligne" value={counts.online} color={INV_STATUS.online.color}/>
        <StatBox label="Vente en cours" value={counts.pending_sale} color={INV_STATUS.pending_sale.color}/>
        <StatBox label="Vendues" value={counts.sold} color={INV_STATUS.sold.color} sub="argent reçu"/>
        <StatBox label="En stock" value={counts.stock} color={INV_STATUS.stock.color}/>
      </div>

      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:12}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un numéro ou un titre…"
          style={{...inputStyle, flex:1, minWidth:180}}/>
        <button type="button" onClick={()=>{setShowAdd(v=>!v);setShowImport(false);}} style={btn(C.accent)}>➕ Ajouter</button>
        <button type="button" onClick={()=>{setShowImport(v=>!v);setShowAdd(false);}} style={btn(C.blue||C.accent)}>🔄 Importer mes annonces</button>
        <button type="button" onClick={syncSalesFromVinted} disabled={syncing} style={{...btn(INV_STATUS.sold.color),opacity:syncing?0.6:1,cursor:syncing?'default':'pointer'}}>
          {syncing ? 'Synchronisation…' : '💸 Mettre à jour les ventes'}
        </button>
      </div>

      {syncResult && (
        <div style={{fontSize:12,marginBottom:12,padding:'8px 12px',borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,color:C.text}}>
          {syncResult.msg
            ? syncResult.msg
            : ((syncResult.sold + syncResult.pending) > 0
                ? `✅ ${syncResult.sold} vente(s) finalisée(s) comptée(s)${syncResult.pending?`, ${syncResult.pending} en cours (non comptée(s), en attente de validation)`:''} — sur ${syncResult.scanned} commandes analysées.`
                : `Aucune vente à reporter (${syncResult.scanned} commandes analysées). Chaque paire doit avoir le même titre que son annonce Vinted (via « Importer mes annonces »).`)}
        </div>
      )}

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {[['all','Toutes'],['online','En ligne'],['pending_sale','En cours'],['sold','Vendues'],['stock','Stock']].map(([id,label]) => (
          <button key={id} type="button" onClick={()=>setFilter(id)}
            style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${filter===id?C.accent:C.border}`,
              background:filter===id?C.accent:'transparent',color:filter===id?'#fff':C.text,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            {label} <span style={{opacity:0.7}}>({counts[id]})</span>
          </button>
        ))}
      </div>

      {showAdd && (
        <Card style={{marginBottom:14}}>
          <div style={{fontWeight:800,marginBottom:10,color:C.text}}>Nouvelle paire</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
            <input value={addForm.numero} onChange={e=>setAddForm(f=>({...f,numero:e.target.value}))} placeholder="Numéro (ex : 2057)" style={{...inputStyle,width:150}}/>
            <input value={addForm.title} onChange={e=>setAddForm(f=>({...f,title:e.target.value}))} placeholder="Titre (ex : Adidas Spezial 38)" style={{...inputStyle,flex:1,minWidth:180}}/>
            <select value={addForm.status} onChange={e=>setAddForm(f=>({...f,status:e.target.value}))} style={inputStyle}>
              <option value="stock">📦 Stock</option>
              <option value="online">🟢 En ligne</option>
              <option value="sold">💸 Vendu</option>
            </select>
            <button type="button" onClick={addPair} style={btn(C.accent)}>Enregistrer</button>
          </div>
        </Card>
      )}

      {showImport && (
        <Card style={{marginBottom:14}}>
          <div style={{fontWeight:800,marginBottom:4,color:C.text}}>Importer mes annonces en ligne</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Charge tes annonces Vinted actuellement en ligne, puis attribue à chacune son numéro et clique « Associer ».
            {' '}Si le titre contient déjà « nXX », le numéro est pré-rempli (tu peux le corriger).
          </div>
          {accounts.length === 0 && <div style={{fontSize:13,color:C.muted}}>Aucun compte Vinted lié.</div>}
          {accounts.map(acc => {
            const st = importState[acc.vinted_user_id] || {};
            return (
              <div key={acc.vinted_user_id} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{fontWeight:700,color:C.text,fontSize:13}}>{accName(acc.vinted_user_id)}</div>
                  <button type="button" onClick={()=>loadListings(acc)} style={{...btn(C.blue||C.accent),padding:'5px 10px',fontSize:12}}>
                    {st.loading ? 'Chargement…' : (st.items ? 'Recharger' : 'Charger les annonces')}
                  </button>
                </div>
                {st.error && <div style={{fontSize:12,color:C.danger}}>Erreur : {String(st.error)}</div>}
                {st.items && st.items.length === 0 && <div style={{fontSize:12,color:C.muted}}>Aucune annonce en ligne sur ce compte.</div>}
                {st.items && st.items.length > 0 && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:12}}>
                    {st.items.map(listing => {
                      const linked = isListingLinked(listing.id);
                      return (
                        <div key={listing.id} style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:'hidden',background:C.bg,opacity:linked?0.6:1}}>
                          <div style={{width:'100%',aspectRatio:'1/1',background:C.border,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {listing.photo ? <img src={listing.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:26}}>👟</span>}
                          </div>
                          <div style={{padding:8}}>
                            <div title={listing.title} style={{fontSize:11,fontWeight:600,color:C.text,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:28}}>{listing.title}</div>
                            {linked ? (
                              <div style={{fontSize:11,color:INV_STATUS.online.color,fontWeight:700,marginTop:6}}>✓ Associée</div>
                            ) : (
                              <div style={{display:'flex',gap:4,marginTop:6}}>
                                <input value={importNums[listing.id] ?? ''} onChange={e=>setImportNums(n=>({...n,[listing.id]:e.target.value}))}
                                  placeholder="N°" style={{...inputStyle,width:52,padding:'5px 6px'}}/>
                                <button type="button" onClick={()=>associate(acc, listing)} style={{...btn(C.accent),padding:'5px 8px',fontSize:11,flex:1}}>Associer</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {filtered.length === 0 && (
        <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'30px 0'}}>
          {inventory.length === 0 ? 'Ton inventaire est vide. Ajoute une paire ou importe tes annonces en ligne.' : 'Aucune paire pour ce filtre.'}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(p => {
          const stt = INV_STATUS[p.status] || INV_STATUS.stock;
          const garage = inGarage(p.numero);
          return (
            <div key={p.id} style={{display:'flex',gap:12,alignItems:'center',padding:10,borderRadius:12,border:`1px solid ${C.border}`,background:C.card}}>
              <div style={{width:52,height:52,borderRadius:8,background:C.border,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                {p.photo ? <img src={p.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:22}}>👟</span>}
              </div>
              <div style={{flexShrink:0,minWidth:54,textAlign:'center'}}>
                <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>N°</div>
                <div style={{fontSize:20,fontWeight:900,color:C.text,lineHeight:1}}>{p.numero}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title || <span style={{color:C.muted,fontStyle:'italic'}}>Sans titre</span>}</div>
                <div style={{display:'flex',gap:6,alignItems:'center',marginTop:5,flexWrap:'wrap'}}>
                  <Badge color={stt.color}>{stt.icon} {stt.label}</Badge>
                  <button type="button" onClick={()=>garage && onLocate && onLocate(p.numero)}
                    title={garage?'Voir dans le garage':'Ce numéro n\'apparaît dans aucune case du garage'}
                    style={{border:'none',background:'transparent',cursor:garage?'pointer':'default',padding:0,fontSize:11,fontWeight:700,color:garage?C.blue||C.accent:C.muted}}>
                    {garage ? '🏠 Au garage' : '🏠 Absent du garage'}
                  </button>
                  {p.price != null && <span style={{fontSize:11,color:C.muted}}>{p.price} €</span>}
                  {p.vintedItemId && <span style={{fontSize:11,color:C.muted}}>🔗 annonce liée</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button type="button" title="Générer le bordereau annoté (numéro + titre)" onClick={()=>startBordereau(p)} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`,padding:'6px 10px'}}>📄</button>
                <button type="button" onClick={()=>startEdit(p)} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`,padding:'6px 10px'}}>✏️</button>
                <button type="button" onClick={()=>deletePair(p.id)} style={{...btn('transparent',C.danger),border:`1px solid ${C.border}`,padding:'6px 10px'}}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && editDraft && (
        <div onClick={()=>{setEditing(null);setEditDraft(null);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:14,padding:20,width:'100%',maxWidth:420}}>
            <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>Modifier la paire</div>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Numéro</label>
            <input value={editDraft.numero} onChange={e=>setEditDraft(d=>({...d,numero:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Titre</label>
            <input value={editDraft.title||''} onChange={e=>setEditDraft(d=>({...d,title:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:12}}/>
            <label style={{display:'block',fontSize:11,color:C.muted,marginBottom:4}}>Statut</label>
            <select value={editDraft.status} onChange={e=>setEditDraft(d=>({...d,status:e.target.value}))} style={{...inputStyle,width:'100%',marginBottom:16}}>
              <option value="stock">📦 Stock</option>
              <option value="online">🟢 En ligne</option>
              <option value="pending_sale">⏳ Vente en cours</option>
              <option value="sold">💸 Vendu</option>
            </select>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button type="button" onClick={()=>{setEditing(null);setEditDraft(null);}} style={{...btn('transparent',C.text),border:`1px solid ${C.border}`}}>Annuler</button>
              <button type="button" onClick={commitEdit} style={btn(C.accent)}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Comptabilité (onglet dédié, tous comptes agrégés) ──────────────────── */
// Couleur stable par compte (pour l'étiquette "d'où vient" chaque ligne).
const ACCT_COLORS = ['#2f80ed','#9b51e0','#eb5757','#27ae60','#f2994a','#00b8a9','#e056fd','#f39c12'];
const acctColor = (uid) => { let h=0; const s=String(uid||''); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return ACCT_COLORS[h%ACCT_COLORS.length]; };
function AcctTag({ acc, name }) {
  const col = acctColor(acc?.vinted_user_id);
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,background:col+'22',color:col,fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:999,whiteSpace:'nowrap'}}>
    <span style={{width:6,height:6,borderRadius:999,background:col}}/>{name}
  </span>;
}

// Squelettes de chargement : un rectangle gris animé, plus agréable qu'un texte
// « Chargement… » figé. `variant` = 'card' (grille d'annonces) ou 'row' (listes).
function Skeleton({ variant='row', count=6 }) {
  const bg = C.border;
  const shimmer = { background:`linear-gradient(90deg, ${bg}55 25%, ${bg}aa 37%, ${bg}55 63%)`, backgroundSize:'400% 100%', animation:'cancaleSkeleton 1.4s ease infinite', borderRadius:8 };
  if (variant==='card') {
    return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:14}}>
      {Array.from({length:count}).map((_,i)=>(
        <div key={i} style={{borderRadius:14,overflow:'hidden',background:C.surface,border:`1px solid ${C.border}`}}>
          <div style={{...shimmer,width:'100%',aspectRatio:'3/4',borderRadius:0}}/>
          <div style={{padding:'8px 10px 10px',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{...shimmer,height:14,width:'55%'}}/>
            <div style={{...shimmer,height:11,width:'80%'}}/>
          </div>
        </div>
      ))}
    </div>;
  }
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    {Array.from({length:count}).map((_,i)=>(
      <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 12px',border:`1px solid ${C.border}`,borderRadius:12,background:C.surface}}>
        <div style={{...shimmer,width:48,height:48,borderRadius:10,flexShrink:0}}/>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
          <div style={{...shimmer,height:13,width:'45%'}}/>
          <div style={{...shimmer,height:11,width:'70%'}}/>
        </div>
      </div>
    ))}
  </div>;
}

// État d'erreur de chargement, avec un bouton « Réessayer ».
function LoadError({ onRetry }) {
  return <div style={{textAlign:'center',padding:'28px 16px'}}>
    <div style={{fontSize:32,marginBottom:8}}>😕</div>
    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Impossible de charger ces données</div>
    <div style={{fontSize:12,color:C.muted,marginBottom:16,lineHeight:1.4}}>Vérifie ta connexion, ou que ton compte Vinted est toujours actif.</div>
    <button onClick={onRetry} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:999,padding:'8px 20px',cursor:'pointer',fontSize:13,fontWeight:700}}>Réessayer</button>
  </div>;
}

// Modale de placement du tampon sur un NOUVEAU format de bordereau. L'utilisateur
// fait glisser le cartouche « N° + titre » là où il y a de la place sur SON
// étiquette (proportions réelles de la page), puis l'app mémorise cette position
// pour ce format et ne redemandera plus.
function BordPlacer({ place, onConfirm, onCancel }) {
  const { numero, title, w, h, blobUrl } = place;
  const padRef = React.useRef(null);
  const boxW = Math.min(w*0.62, 230), boxH = 46;      // taille réelle du tampon (pt)
  const wr = boxW/w, hr = boxH/h;                       // taille en ratio de page
  const [xr,setXr] = useState(place.initPos?.xr ?? 0.05);
  const [yr,setYr] = useState(place.initPos?.yr ?? 0.02); // défaut : haut de page
  const dragging = React.useRef(false);
  const moveTo = (cx, cy) => {
    const r = padRef.current?.getBoundingClientRect(); if(!r) return;
    let nx = (cx - r.left)/r.width - wr/2;
    let ny = (cy - r.top)/r.height - hr/2;
    nx = Math.max(0, Math.min(1-wr, nx));
    ny = Math.max(0, Math.min(1-hr, ny));
    setXr(nx); setYr(ny);
  };
  const pt = (e)=> e.touches && e.touches[0] ? e.touches[0] : e;
  const onDown = (e)=>{ dragging.current=true; const p=pt(e); moveTo(p.clientX,p.clientY); };
  const onMove = (e)=>{ if(!dragging.current) return; const p=pt(e); moveTo(p.clientX,p.clientY); if(e.cancelable) e.preventDefault(); };
  const onUp = ()=>{ dragging.current=false; };
  return (
    <div onClick={onCancel} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:16,maxWidth:420,width:'100%',maxHeight:'92vh',overflow:'auto',padding:16}}>
        <div style={{fontSize:15,fontWeight:900,color:C.text,marginBottom:2}}>📄 Nouveau format de bordereau</div>
        <div style={{fontSize:12,color:C.muted,lineHeight:1.45,marginBottom:12}}>
          Fais glisser l'étiquette <b>N° + titre</b> là où il y a de la place sur ton bordereau. L'app <b>retiendra</b> cet emplacement pour ce format.
          <button onClick={()=>window.open(blobUrl,'_blank')} style={{marginLeft:6,border:'none',background:'transparent',color:C.blue||C.accent,fontWeight:700,cursor:'pointer',padding:0,fontSize:12}}>👁 Voir mon bordereau</button>
        </div>
        <div ref={padRef}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          style={{position:'relative',aspectRatio:`${w} / ${h}`,maxWidth:'100%',maxHeight:'56vh',margin:'0 auto',background:C.surface,border:`1px dashed ${C.border}`,borderRadius:8,touchAction:'none',cursor:'grab',overflow:'hidden'}}>
          {/* Repères de zones (indicatif) */}
          <div style={{position:'absolute',top:0,left:0,right:0,height:'34%',background:`${C.muted}0d`,borderBottom:`1px dashed ${C.border}`}}/>
          <div style={{position:'absolute',top:'4%',left:0,right:0,textAlign:'center',fontSize:9,color:C.muted}}>haut (souvent code-barres / adresse)</div>
          {/* Le tampon déplaçable */}
          <div style={{position:'absolute',left:`${xr*100}%`,top:`${yr*100}%`,width:`${wr*100}%`,height:`${hr*100}%`,background:'#fff',border:'1.5px solid #000',borderRadius:4,display:'flex',flexDirection:'column',justifyContent:'center',padding:'2px 5px',boxSizing:'border-box',boxShadow:'0 1px 6px rgba(0,0,0,.25)',cursor:'grab'}}>
            <div style={{fontSize:'min(3.4vw,15px)',fontWeight:900,color:'#000',lineHeight:1}}>N° {numero}</div>
            <div style={{fontSize:'min(2.4vw,9px)',color:'#222',lineHeight:1.1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{title}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:14}}>
          <button onClick={onCancel} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:10,background:'transparent',color:C.text,cursor:'pointer',fontSize:13,fontWeight:700,padding:'10px'}}>Annuler</button>
          <button onClick={()=>onConfirm({xr,yr})} style={{flex:2,border:'none',borderRadius:10,background:C.accent,color:C.onAccent,cursor:'pointer',fontSize:13,fontWeight:800,padding:'10px'}}>Valider & tamponner</button>
        </div>
      </div>
    </div>
  );
}

// Cache partagé entre les onglets (évite de recharger à chaque changement
// d'onglet) : moins de requêtes, navigation instantanée. TTL court.
const _acctCache = {};
const _CACHE_TTL = 180000; // 3 min
function Comptabilite({ accounts, only, garageGrid, onLocate, onStore }) {
  const [numeros, setNumeros] = useState(() => load('vinted_annonce_numeros', {}));
  const [usedNumeros, setUsedNumeros] = useState(() => load('vinted_used_numeros', []));
  const [sub, setSubRaw] = useState(only || 'ventes'); // ventes | achats | annonces | messages | bordereaux
  const setSub = only ? (()=>{}) : setSubRaw;
  const curSub = only || sub;
  const [msgAcc, setMsgAcc] = useState('all'); // filtre compte pour les messages
  const [msgWaitingOnly, setMsgWaitingOnly] = useState(false); // n'afficher que les conversations en attente de réponse
  // Ventes masquées de la compta (par n° de transaction). Réversible.
  const [hiddenSales, setHiddenSales] = useState(() => new Set((load('vinted_sales_hidden', []) || []).map(String)));
  // Comptes entiers exclus de la compta (par vinted_user_id).
  const [hiddenAccts, setHiddenAccts] = useState(() => new Set((load('vinted_accounts_hidden', []) || []).map(String)));
  const [showHidden, setShowHidden] = useState(false);
  const isHidden = (o) => hiddenSales.has(String(o.transaction_id)) || hiddenAccts.has(String(o._acc?.vinted_user_id));
  const toggleHidden = (tid) => {
    setHiddenSales(prev => { const n = new Set(prev); const k = String(tid); if (n.has(k)) n.delete(k); else n.add(k); save('vinted_sales_hidden', [...n]); return n; });
  };
  const [annSearch, setAnnSearch] = useState(''); // recherche annonces (titre/marque/N°)
  const [annSort, setAnnSort] = useState('recent'); // recent | price_desc | price_asc | favs | views | nonum | boost
  const [ordSearch, setOrdSearch] = useState(''); // recherche ventes/achats (titre/N°/pseudo)
  const [pickerFor, setPickerFor] = useState(null);
  const [purchasesPick, setPurchasesPick] = useState({ loading:false, items:[] });

  // Numéros : édition depuis l'onglet Annonces.
  const updatePair = (item, patch) => {
    setNumeros(prev => {
      const u = { ...prev }; const c = u[item.id] || {};
      const next = { ...c, ...patch, title:item.title, photo:item.photo||null, price:item.price??null, accountId:item._acc?.vinted_user_id };
      const emptyNum = !String(next.numero||'').trim();
      const emptyBuy = next.buyPrice==null || String(next.buyPrice).trim()==='';
      if (emptyNum && emptyBuy) delete u[item.id]; else u[item.id] = next;
      save('vinted_annonce_numeros', u); return u;
    });
  };
  const recordUsed = (num) => { const n=parseInt(String(num),10); if(isNaN(n)||n<=0) return; setUsedNumeros(prev=>{ if(prev.includes(n))return prev; const u=[...prev,n]; save('vinted_used_numeros',u); return u; }); };
  const nextNumero = useMemo(() => { let m=0; usedNumeros.forEach(x=>{const n=parseInt(String(x),10);if(!isNaN(n)&&n>m)m=n;}); Object.values(numeros).forEach(e=>{const n=parseInt(String(e.numero),10);if(!isNaN(n)&&n>m)m=n;}); return m+1; }, [usedNumeros, numeros]);
  const garageNums = useMemo(()=>{ const s=new Set(); Object.values(garageGrid||{}).forEach(a=>{ if(Array.isArray(a)) a.forEach(v=>{const t=(v||'').trim().toLowerCase(); if(t)s.add(t);}); }); return s; }, [garageGrid]);
  const inGarage = (n)=> !!n && garageNums.has(String(n).trim().toLowerCase());
  const linkedBuyIds = useMemo(()=>{ const s=new Set(); Object.values(numeros).forEach(e=>{ if(e&&e.buyFromId) s.add(String(e.buyFromId)); }); return s; }, [numeros]);
  const openPicker = async (item) => {
    setPickerFor(item); setPurchasesPick({loading:true,items:[]});
    const seen=new Set(); const out=[];
    for(const acc of accounts){ const r=await fetchVintedOrders(acc,'purchased',1,'all'); if(r.ok) for(const o of r.items){ const id=String(o.transaction_id); if(!seen.has(id)){seen.add(id); out.push({...o,_acc:acc});} } }
    out.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    setPurchasesPick({loading:false,items:out});
  };
  const choosePick = (p) => { const price=p.price?.amount!=null?Number(p.price.amount):null; updatePair(pickerFor,{buyPrice:price!=null?String(price):'',buyFromId:p.transaction_id?String(p.transaction_id):null}); setPickerFor(null); };
  const [vFilter, setVFilter] = useState('all'); // encours | finalisees | annulees | all
  const [aFilter, setAFilter] = useState('all'); // attente | recus | all
  // Statut d'un ACHAT : un achat "reçu" n'a pas le mot "finalisé" (c'est
  // spécifique aux ventes). On élargit donc la détection pour les achats.
  const purchasePhase = (status) => {
    const s = status || '';
    if (/annul|rembours|refus/i.test(s)) return 'cancelled';
    if (/finalis|livr|termin|re[çc]u|valid|complet|arriv/i.test(s)) return 'completed';
    return 'pending';
  };
  const [sales, setSales] = useState({ loading:false, items:null });
  const [buys, setBuys] = useState({ loading:false, items:null });
  const [listings, setListings] = useState({ loading:false, items:null });
  const [convs, setConvs] = useState({ loading:false, items:null });
  const [openConv, setOpenConv] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyErr, setReplyErr] = useState(null);
  const bordRef = React.useRef(null); const bordCtx = React.useRef(null);
  // Formats de bordereaux mémorisés : { [empreinte dimensions] : {xr,yr} }.
  const [bordFormats, setBordFormats] = useState(() => load('vinted_bordereau_formats', {}));
  // Modale de placement du tampon quand un NOUVEAU format apparaît.
  const [bordPlace, setBordPlace] = useState(null); // { numero, title, pdfBuf, w, h, key, blobUrl }
  // Résultat prêt : { url, filename } -> bouton « Ouvrir » (fiable sur iPhone).
  const [bordResult, setBordResult] = useState(null);
  const accNameOf = (acc) => { const labels = load('vinted_account_labels',{}); return labels[acc.vinted_user_id] || acc.login || `#${acc.vinted_user_id}`; };

  const entryByTitle = (title) => { const t = normTitle(title); for (const k in numeros) { if (normTitle(numeros[k].title) === t) return numeros[k]; } return null; };
  const entryKeyByTitle = (title) => { const t = normTitle(title); for (const k in numeros) { if (normTitle(numeros[k].title) === t) return k; } return null; };
  // Lien VENTE↔PAIRE verrouillé par n° de transaction (robuste, permanent, gère
  // les titres en double une fois établi). L'app le remplit AUTOMATIQUEMENT quand
  // le titre d'une vente correspond à une SEULE annonce numérotée (cas non
  // ambigu). Le pipeline mail/bordereau réutilisera ce lien.
  const [txnLink, setTxnLink] = useState(() => load('vinted_txn_link', {}));
  // Retrouve l'entrée numéro d'une vente : par le lien transaction si connu,
  // sinon par le titre (si non ambigu). Permet de coller le bon N° SANS avoir le
  // numéro dans le titre.
  // Index photo -> clé numéro (pour relier une vente à sa paire par la photo).
  // On ignore une photo partagée par 2 entrées (ambiguë) pour ne pas se tromper.
  const numerosByPhoto = useMemo(() => {
    const m = {}; const dup = new Set();
    for (const k in numeros) {
      const pk = photoKey(numeros[k].photo);
      if (!pk) continue;
      if (m[pk] && m[pk] !== k) dup.add(pk); else m[pk] = k;
    }
    dup.forEach(pk => delete m[pk]);
    return m;
  }, [numeros]);
  const entryKeyByPhoto = (o) => { const pk = o ? photoKey(o.photo_url || (o.photo && o.photo.url)) : null; return pk ? (numerosByPhoto[pk] || null) : null; };
  const resolvedEntry = (o) => {
    const linked = o && o.transaction_id != null ? txnLink[String(o.transaction_id)] : null;
    if (linked && numeros[linked]) return numeros[linked];
    // 1) Par la PHOTO (fiable, gère les titres en double, sans N° dans le titre).
    const pk = entryKeyByPhoto(o);
    if (pk && numeros[pk]) return numeros[pk];
    // 2) Sinon par le titre exact (si non ambigu).
    if (o && !titleAmbiguous(o.title)) return entryByTitle(o.title);
    return null;
  };
  // Montant d'un champ € (prix d'achat, frais/boost) -> nombre ou 0.
  const eur = (v) => { if (v==null || String(v).trim()==='') return 0; const n = parseFloat(String(v).replace(',','.')); return isNaN(n)?0:n; };
  const feesOf = (e) => e ? eur(e.fees) : 0;
  // Fiabilité : deux annonces avec le MÊME titre rendent l'attribution d'une
  // vente ambiguë (le lien vente↔paire se fait par le titre). On les détecte
  // pour prévenir au lieu de risquer d'attribuer le mauvais numéro.
  const titleCount = useMemo(() => { const m={}; Object.values(numeros).forEach(e=>{ const t=normTitle(e.title); if(t) m[t]=(m[t]||0)+1; }); return m; }, [numeros]);
  const titleAmbiguous = (title) => (titleCount[normTitle(title)]||0) > 1;

  // Ancienneté d'une annonce (jours en ligne). On prend la date Vinted de mise en
  // ligne si dispo (createdTs, en secondes ou ms), sinon la date de numérotation
  // (quand on a commencé à la suivre). null si on ne sait pas.
  const SLEEP_DAYS = 30; // seuil « paire qui dort »
  const listedAgeDays = (it) => {
    let ts = null;
    if (it.createdTs!=null) ts = it.createdTs < 1e12 ? it.createdTs*1000 : it.createdTs;
    else { const e = numeros[it.id]; if (e?.numberedAt) { const d=new Date(e.numberedAt).getTime(); if(!isNaN(d)) ts=d; } }
    return ts!=null ? Math.floor((Date.now()-ts)/86400000) : null;
  };

  // Recherche sur une commande (vente/achat) : titre, numéro, ou pseudo acheteur.
  const matchOrd = (o) => {
    const q = ordSearch.trim().toLowerCase(); if (!q) return true;
    const e = resolvedEntry(o); const num = String(e?.numero||'');
    const buyer = (o.user_login || o.buyer?.login || o.opposite_user?.login || '').toLowerCase();
    return (o.title||'').toLowerCase().includes(q) || num===q || num.includes(q) || buyer.includes(q);
  };

  // Annonces filtrées (recherche titre/marque/N°) + triées. Sert à retrouver vite
  // une paire quand il y en a beaucoup, comme dans les outils pros de revente.
  const annShown = useMemo(() => {
    let arr = [...(listings.items || [])];
    const q = annSearch.trim().toLowerCase();
    if (q) arr = arr.filter(it => {
      const num = String(numeros[it.id]?.numero || '');
      return (it.title||'').toLowerCase().includes(q)
        || (it.brand||'').toLowerCase().includes(q)
        || num.toLowerCase()===q || num.toLowerCase().includes(q);
    });
    const price = it => (it.price!=null ? Number(it.price) : 0);
    if (annSort==='price_desc') arr.sort((a,b)=>price(b)-price(a));
    else if (annSort==='price_asc') arr.sort((a,b)=>price(a)-price(b));
    else if (annSort==='favs') arr.sort((a,b)=>(b.favourites??-1)-(a.favourites??-1));
    else if (annSort==='views') arr.sort((a,b)=>(b.views??-1)-(a.views??-1));
    else if (annSort==='nonum') arr = arr.filter(it=>!(numeros[it.id]?.numero));
    else if (annSort==='boost') {
      // « À booster » : les paires qui ont de l'audience mais ne se vendent pas
      // (beaucoup de vues, peu/pas de favoris) -> candidates à une baisse de prix.
      arr = arr.filter(it=> it.views!=null && it.views>=20 && (it.favourites??0) <= 1);
      arr.sort((a,b)=>(b.views??0)-(a.views??0));
    }
    else if (annSort==='sleeping') {
      // « Qui dorment » : en ligne depuis longtemps -> baisser le prix / republier.
      arr = arr.map(it=>({it,age:listedAgeDays(it)})).filter(x=>x.age!=null&&x.age>=SLEEP_DAYS)
               .sort((a,b)=>b.age-a.age).map(x=>x.it);
    }
    return arr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.items, annSearch, annSort, numeros]);
  // Stats d'en-tête : nb d'annonces + valeur totale en ligne + engagement dispo.
  const annStats = useMemo(() => {
    const arr = listings.items || [];
    let val=0, favs=0, views=0, hasFav=false, hasView=false, sansNum=0, sleeping=0, sleepingVal=0;
    for (const it of arr) {
      const p = it.price!=null ? Number(it.price) : 0;
      if (it.price!=null) val += p;
      if (it.favourites!=null) { favs+=it.favourites; hasFav=true; }
      if (it.views!=null) { views+=it.views; hasView=true; }
      if (!(numeros[it.id]?.numero)) sansNum++;
      const age = listedAgeDays(it); if (age!=null && age>=SLEEP_DAYS) { sleeping++; sleepingVal+=p; }
    }
    return { n:arr.length, val, favs, views, hasFav, hasView, sansNum, sleeping, sleepingVal };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.items, numeros]);

  const fromCache = (key) => { const c=_acctCache[key]; return (c && Date.now()-c.ts<_CACHE_TTL) ? c.items : null; };
  const putCache = (key, items) => { _acctCache[key] = { ts:Date.now(), items }; };

  const loadOrders = async (type, setter, force) => {
    const cached = !force && fromCache(type);
    if (cached) { setter({ loading:false, items:cached }); return; }
    setter({ loading:true, items:null, error:false });
    const seen = new Set(); const out = []; let anyOk=false, anyErr=false; const failed=[];
    for (const acc of accounts) {
      const res = await fetchVintedOrders(acc, type, 1, 'all', { force });
      if (res.ok) { anyOk=true; for (const o of res.items) { const id = String(o.transaction_id); if (!seen.has(id)) { seen.add(id); out.push({ ...o, _acc: acc }); } } }
      else { anyErr=true; failed.push(accNameOf(acc)); }
    }
    out.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    // Erreur seulement si RIEN n'a pu être chargé et qu'au moins un appel a échoué.
    const error = out.length===0 && anyErr && !anyOk;
    if (!error) putCache(type, out);
    setter({ loading:false, items: out, error, failed });
  };
  useEffect(() => { if (accounts.length) loadOrders('sold', setSales); /* eslint-disable-next-line */ }, [accounts.length]);
  useEffect(() => { if (curSub==='achats' && accounts.length && buys.items===null) loadOrders('purchased', setBuys); /* eslint-disable-next-line */ }, [sub, accounts.length]);

  // AUTO-LOCK : dès qu'une vente finalisée correspond à UNE SEULE annonce
  // numérotée (titre non ambigu), on verrouille le lien vente↔paire par n° de
  // transaction. C'est permanent et robuste (survit aux titres en double créés
  // plus tard) et servira au tampon auto des bordereaux. Aucune action requise.
  useEffect(() => {
    if (!sales.items || !sales.items.length) return;
    let changed = false; const next = { ...txnLink };
    for (const o of sales.items) {
      if (classifyOrderStatus(o.status) !== 'completed') continue;
      const tid = o.transaction_id != null ? String(o.transaction_id) : null;
      if (!tid || next[tid]) continue;
      // On verrouille d'abord par la photo (marche même si le titre est en double),
      // sinon par le titre exact non ambigu.
      const key = entryKeyByPhoto(o) || (titleAmbiguous(o.title) ? null : entryKeyByTitle(o.title));
      if (key) { next[tid] = key; changed = true; }
    }
    if (changed) { setTxnLink(next); save('vinted_txn_link', next); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, numeros]);

  const loadListings = async (force) => {
    const cached = !force && fromCache('listings');
    if (cached) { setListings({ loading:false, items:cached }); return; }
    setListings({ loading:true, items:null, error:false });
    const out = []; let anyOk=false, anyErr=false;
    for (const acc of accounts) { const r = await fetchVintedListings(acc, 1, { force }); if (r.ok) { anyOk=true; r.items.forEach(it => out.push({ ...it, _acc:acc })); } else anyErr=true; }
    const error = out.length===0 && anyErr && !anyOk;
    if (!error) putCache('listings', out);
    setListings({ loading:false, items: out, error });
  };
  const loadConvs = async (force) => {
    const cached = !force && fromCache('convs');
    if (cached) { setConvs({ loading:false, items:cached }); return; }
    setConvs({ loading:true, items:null, error:false });
    const out = []; let anyOk=false, anyErr=false;
    for (const acc of accounts) { const r = await fetchVintedConversations(acc, 1, { force }); if (r.ok) { anyOk=true; r.items.forEach(c => out.push({ ...c, _acc:acc })); } else anyErr=true; }
    out.sort((a,b) => new Date(b.updated_at||0) - new Date(a.updated_at||0));
    const error = out.length===0 && anyErr && !anyOk;
    if (!error) putCache('convs', out);
    setConvs({ loading:false, items: out, error });
  };
  useEffect(() => { if (curSub==='annonces' && accounts.length && listings.items===null) loadListings(); /* eslint-disable-next-line */ }, [sub, accounts.length]);
  useEffect(() => { if (curSub==='messages' && accounts.length && convs.items===null) loadConvs(); /* eslint-disable-next-line */ }, [sub, accounts.length]);

  const openConversation = async (conv) => {
    setReplyText(''); setReplyErr(null); setReplyBusy(false);
    setOpenConv({ loading:true, error:null, conversation:null, messages:[], acc:conv._acc, convId:conv.id, header:{ login:conv.opposite_user?.login, title:conv.description, photo:conv.opposite_user?.photo?.url||conv.item_photos?.[0]?.url||null } });
    const res = await fetchVintedConversationDetail(conv._acc, conv.id);
    if (!res.ok) { setOpenConv(o => ({ ...o, loading:false, error:res.error })); return; }
    setOpenConv(o => ({ ...o, loading:false, conversation:res.conversation, messages:normalizeConversationMessages(res.conversation) }));
  };

  // Envoi d'une réponse via l'extension (depuis le navigateur = ton IP, sans
  // risque). Requête réelle captée : POST /api/v2/conversations/{id}/replies.
  const sendReply = async () => {
    const oc = openConv; const text = replyText.trim();
    if (!oc || !oc.acc || !oc.convId || !text || replyBusy) return;
    if (!vmrExtPresent()) { setReplyErr("Extension VRM non détectée sur cet appareil. Ouvre l'app dans le Chrome où l'extension est installée, ou réponds sur Vinted."); return; }
    setReplyBusy(true); setReplyErr(null);
    const r = await vmrExec({ uid: oc.acc.vinted_user_id, method:'POST', endpoint:`/api/v2/conversations/${oc.convId}/replies`, body:{ reply:{ body:text, photo_temp_uuids:null, is_personal_data_sharing_check_skipped:false } } });
    setReplyBusy(false);
    if (r && r.ok) {
      setReplyText('');
      setOpenConv(o => o ? ({ ...o, messages:[...o.messages, { kind:'message', mine:true, body:text }] }) : o);
    } else {
      setReplyErr((r && (r.error || (r.status ? 'HTTP '+r.status : ''))) || "Échec de l'envoi");
    }
  };

  const accName = (acc) => { const labels = load('vinted_account_labels',{}); return labels[acc.vinted_user_id] || acc.login || `#${acc.vinted_user_id}`; };

  const totals = useMemo(() => {
    const items = sales.items || [];
    let ca=0, cout=0, frais=0, nb=0, nbCout=0, margeSum=0, margeNb=0;
    for (const o of items) {
      if (isHidden(o)) continue;
      if (classifyOrderStatus(o.status) !== 'completed') continue;
      const sell = o.price?.amount!=null ? Number(o.price.amount) : 0; ca+=sell; nb+=1;
      const e = resolvedEntry(o);
      const fee = feesOf(e); frais += fee;
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : null;
      if (buy!=null && !isNaN(buy)) { cout+=buy; nbCout+=1; if (sell>0){ margeSum+=((sell-buy-fee)/sell)*100; margeNb+=1; } }
    }
    return { ca, cout, frais, benef:ca-cout-frais, nb, nbCout, margeMoy: margeNb?margeSum/margeNb:null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, numeros, hiddenSales, hiddenAccts]);

  // ── Analyse de perf (façon outil pro) ──────────────────────────────
  // Objectif de CA mensuel (synchronisé). L'utilisateur le fixe, la barre suit le
  // CA finalisé du mois en cours.
  const [goal, setGoal] = useState(() => Number(load('vinted_goal', 0)) || 0);
  const [goalEdit, setGoalEdit] = useState(false);
  const saveGoal = (v) => { const n = Math.max(0, Math.round(Number(v)||0)); setGoal(n); save('vinted_goal', n); };
  // Métriques : temps de vente moyen (jours entre la numérotation de l'annonce et
  // la vente), taux d'écoulement (vendues / (vendues + en ligne)), meilleure
  // marque (bénéfice moyen par paire), et CA du mois en cours.
  const perf = useMemo(() => {
    const items = sales.items || [];
    let daysSum=0, daysNb=0, caMois=0;
    const now = new Date(); const ym = now.getFullYear()*100 + now.getMonth();
    const brands = {}; // marque -> {benef, nb}
    for (const o of items) {
      if (isHidden(o)) continue;
      if (classifyOrderStatus(o.status) !== 'completed') continue;
      const sell = o.price?.amount!=null ? Number(o.price.amount) : 0;
      const e = resolvedEntry(o);
      if (o.date) { const d=new Date(o.date); if (!isNaN(d) && d.getFullYear()*100+d.getMonth()===ym) caMois += sell; }
      // Temps de vente : de la numérotation (mise en suivi) à la date de vente.
      if (e && e.numberedAt && o.date) {
        const j = (new Date(o.date) - new Date(e.numberedAt)) / 86400000;
        if (j>=0 && j<3650) { daysSum+=j; daysNb+=1; }
      }
      // Meilleure marque : bénéfice moyen par paire (si prix d'achat connu).
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : null;
      if (buy!=null && !isNaN(buy)) {
        const b = extractBrand(o.title) || '—';
        if (!brands[b]) brands[b] = { benef:0, nb:0 };
        brands[b].benef += (sell-buy-feesOf(e)); brands[b].nb += 1;
      }
    }
    let bestBrand=null;
    Object.entries(brands).forEach(([b,v])=>{ if (v.nb>=2){ const moy=v.benef/v.nb; if (!bestBrand||moy>bestBrand.moy) bestBrand={ brand:b, moy, nb:v.nb }; } });
    // Taux d'écoulement : nécessite le nb d'annonces en ligne (chargé si dispo).
    const online = (listings.items||[]).length;
    const vendues = items.filter(o=>!isHidden(o) && classifyOrderStatus(o.status)==='completed').length;
    const ecoul = (online+vendues)>0 ? (vendues/(online+vendues))*100 : null;
    return { joursMoy: daysNb?daysSum/daysNb:null, joursNb:daysNb, bestBrand, caMois, ecoul, online, vendues };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, listings.items, numeros, hiddenSales, hiddenAccts]);

  // Pour le taux d'écoulement, on s'assure que les annonces en ligne sont
  // chargées même en étant sur l'onglet Ventes (harvest-first, donc gratuit).
  useEffect(() => { if (curSub==='ventes' && accounts.length && listings.items===null) loadListings(); /* eslint-disable-next-line */ }, [sub, accounts.length]);

  // Tendance sur 6 mois (CA finalisé + bénéfice net) pour le mini-graphique.
  const monthlyChart = useMemo(() => {
    const now = new Date(); const months = [];
    for (let i=5;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); months.push({ ym:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('fr-FR',{month:'short'}).replace('.',''), ca:0, benef:0 }); }
    const idx = {}; months.forEach((m,i)=>{ idx[m.ym]=i; });
    for (const o of (sales.items||[])){
      if (isHidden(o)) continue;
      if (classifyOrderStatus(o.status)!=='completed' || !o.date) continue;
      const d=new Date(o.date); if(isNaN(d)) continue;
      const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (idx[ym]==null) continue;
      const sell=o.price?.amount!=null?Number(o.price.amount):0;
      const e=resolvedEntry(o); const buy=e&&e.buyPrice!=null&&String(e.buyPrice).trim()!==''?parseFloat(String(e.buyPrice).replace(',','.')):null;
      months[idx[ym]].ca+=sell;
      if(buy!=null&&!isNaN(buy)) months[idx[ym]].benef += (sell-buy-feesOf(e));
    }
    const max = Math.max(1, ...months.map(m=>Math.max(m.ca, m.benef)));
    const total = months.reduce((s,m)=>s+m.ca,0);
    return { months, max, total };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, numeros, hiddenSales, hiddenAccts]);

  // ── Stats de sourcing : quelles marques / tailles rapportent le plus ──
  // Agrège les ventes finalisées (hors masquées) par marque et par taille :
  // nb vendues, bénéfice moyen/paire (si prix d'achat connu), temps de vente moyen.
  // But : savoir quoi racheter en priorité.
  const [showSourcing, setShowSourcing] = useState(false);
  const sourcing = useMemo(() => {
    const items = sales.items || [];
    const mk = () => ({ nb:0, ca:0, benef:0, benefNb:0, daysSum:0, daysNb:0 });
    const brands={}, sizes={}; let total=0;
    for (const o of items) {
      if (isHidden(o)) continue;
      if (classifyOrderStatus(o.status) !== 'completed') continue;
      total+=1;
      const sell = o.price?.amount!=null ? Number(o.price.amount) : 0;
      const e = resolvedEntry(o);
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : null;
      const fee = feesOf(e);
      const days = (e && e.numberedAt && o.date) ? (new Date(o.date)-new Date(e.numberedAt))/86400000 : null;
      const b = extractBrand(o.title) || '—';
      const s = extractSize(o.title) || '?';
      for (const [map,key] of [[brands,b],[sizes,s]]) {
        if (!map[key]) map[key]=mk();
        const bk=map[key];
        bk.nb+=1; bk.ca+=sell;
        if (buy!=null && !isNaN(buy)) { bk.benef+=(sell-buy-fee); bk.benefNb+=1; }
        if (days!=null && days>=0 && days<3650) { bk.daysSum+=days; bk.daysNb+=1; }
      }
    }
    const finalize = (map) => Object.entries(map).map(([k,v])=>({
      key:k, nb:v.nb, ca:v.ca,
      benefMoy: v.benefNb ? v.benef/v.benefNb : null, benefNb:v.benefNb,
      joursMoy: v.daysNb ? v.daysSum/v.daysNb : null,
    })).sort((a,b)=> b.nb-a.nb || (b.benefMoy||-1e9)-(a.benefMoy||-1e9));
    return { brands:finalize(brands), sizes:finalize(sizes), total };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, numeros, hiddenSales, hiddenAccts]);

  // ── Rapport comptable (#3) ─────────────────────────────────────────
  const [showReport, setShowReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const ymOf = (dstr) => { if(!dstr) return null; const d=new Date(dstr); if(isNaN(d)) return null; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
  // Mois disponibles (ventes + achats) pour le sélecteur.
  const reportMonths = useMemo(() => {
    const s = new Set();
    (sales.items||[]).forEach(o=>{ const m=ymOf(o.date); if(m) s.add(m); });
    (buys.items||[]).forEach(o=>{ const m=ymOf(o.date); if(m) s.add(m); });
    s.add(reportMonth);
    return [...s].sort().reverse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, buys.items]);
  const report = useMemo(() => {
    const regime = load('vinted_regime','micro');
    const tvaRate = Number(load('vinted_tva',20))||20;
    const monthLabel = (()=>{ const [y,m]=reportMonth.split('-'); return new Date(Number(y),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); })();
    let ca=0, cout=0, frais=0, nb=0, nbCout=0, margeKnown=0;
    const saleLines=[];
    for (const o of (sales.items||[])) {
      if (isHidden(o)) continue;
      if (classifyOrderStatus(o.status)!=='completed') continue;
      if (ymOf(o.date)!==reportMonth) continue;
      const sell = o.price?.amount!=null?Number(o.price.amount):0;
      const e = resolvedEntry(o); const fee=feesOf(e);
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : null;
      ca+=sell; nb+=1; frais+=fee;
      if (buy!=null && !isNaN(buy)) { cout+=buy; nbCout+=1; margeKnown+=(sell-buy); }
      saleLines.push({ date:o.date, num:e?.numero||'', title:o.title, sell, buy:(buy!=null&&!isNaN(buy))?buy:null, fee });
    }
    // Registre d'achats du mois (hors annulés).
    const buyLines=[];
    let achatsTotal=0;
    for (const o of (buys.items||[])) {
      if (classifyOrderStatus(o.status)==='cancelled') continue;
      if (ymOf(o.date)!==reportMonth) continue;
      const montant = o.price?.amount!=null?Number(o.price.amount):0;
      achatsTotal+=montant;
      buyLines.push({ o, date:o.date, seller:o.seller||o.user_login||o.opposite_user?.login||'', title:o.title, montant });
    }
    const benefNet = ca - cout - frais;
    const marge = margeKnown - frais; // marge = ventes - achats - boosts (sur ventes au coût connu)
    const tvaMarge = (regime==='marge' && marge>0) ? marge * (tvaRate/(100+tvaRate)) : 0;
    const margeHT = marge - tvaMarge;
    const urssaf = ca * 0.135;
    return { regime, tvaRate, monthLabel, ca, cout, frais, nb, nbCout, benefNet, marge, tvaMarge, margeHT, urssaf, saleLines, buyLines, achatsTotal };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, buys.items, reportMonth, numeros, hiddenSales, hiddenAccts]);

  const openReport = () => { setShowReport(true); if (buys.items===null && accounts.length) loadOrders('purchased', setBuys); };

  // Export CSV du rapport (ventes + registre d'achats).
  const exportReportCsv = () => {
    const R=report; const e=(v)=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const L=[];
    L.push([`Rapport ${R.monthLabel}`]);
    L.push([`Régime`, R.regime==='marge'?'Société (marge)':'Micro-entrepreneur']);
    L.push([]);
    L.push(['VENTES']); L.push(['Date','N°','Titre','Vente','Achat','Boost','Bénéfice net']);
    R.saleLines.forEach(s=>L.push([s.date?new Date(s.date).toLocaleDateString('fr-FR'):'',s.num,s.title,s.sell.toFixed(2),s.buy!=null?s.buy.toFixed(2):'',s.fee?s.fee.toFixed(2):'',s.buy!=null?(s.sell-s.buy-s.fee).toFixed(2):'']));
    L.push(['','','TOTAL',R.ca.toFixed(2),R.cout.toFixed(2),R.frais.toFixed(2),R.benefNet.toFixed(2)]);
    L.push([]);
    L.push(['ACHATS (registre)']); L.push(['Date','Vendeur','Article','Montant']);
    R.buyLines.forEach(b=>L.push([b.date?new Date(b.date).toLocaleDateString('fr-FR'):'',b.seller,b.title,b.montant.toFixed(2)]));
    L.push(['','','TOTAL',R.achatsTotal.toFixed(2)]);
    L.push([]);
    if (R.regime==='marge') { L.push(['Marge TTC',R.marge.toFixed(2)]); L.push([`TVA sur marge (${R.tvaRate}%)`,R.tvaMarge.toFixed(2)]); L.push(['Marge HT',R.margeHT.toFixed(2)]); }
    else { L.push(['CA encaissé',R.ca.toFixed(2)]); L.push(['Bénéfice net',R.benefNet.toFixed(2)]); L.push(['Estimation cotisations (13,5%)',R.urssaf.toFixed(2)]); }
    const csv = L.map(r=>r.map(e).join(';')).join('\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`rapport-${reportMonth}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  // Export PDF du rapport (récapitulatif).
  const exportReportPdf = async () => {
    const R=report;
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); const page = pdf.addPage([595,842]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold); const reg = await pdf.embedFont(StandardFonts.Helvetica);
    let y=800; const T=(t,x,s,f,c)=>page.drawText(String(t),{x,y,size:s,font:f||reg,color:c||rgb(0.1,0.1,0.1)});
    T('Rapport comptable',40,22,bold,rgb(0,0.47,0.51)); y-=22; T(R.monthLabel+'  ·  '+(R.regime==='marge'?'Société (régime de la marge)':'Micro-entrepreneur'),40,11,reg,rgb(0.4,0.4,0.4)); y-=28;
    const kv=(k,v,big)=>{ T(k,40,9,reg,rgb(0.45,0.45,0.45)); page.drawText(String(v),{x:40,y:y-14,size:big?15:12,font:big?bold:reg,color:rgb(0.1,0.1,0.1)}); y-=big?36:30; };
    kv('Chiffre d\'affaires encaissé', R.ca.toFixed(2)+' EUR', true);
    kv('Coût d\'achat', R.cout.toFixed(2)+' EUR ('+R.nbCout+'/'+R.nb+' renseignés)');
    if (R.frais>0) kv('Boosts / mises en avant', R.frais.toFixed(2)+' EUR');
    if (R.regime==='marge') { kv('Marge TTC', R.marge.toFixed(2)+' EUR', true); kv('TVA sur la marge ('+R.tvaRate+'%)', R.tvaMarge.toFixed(2)+' EUR'); kv('Marge HT', R.margeHT.toFixed(2)+' EUR'); }
    else { kv('Bénéfice net', R.benefNet.toFixed(2)+' EUR', true); kv('Estimation cotisations (13,5%)', R.urssaf.toFixed(2)+' EUR'); }
    kv('Nombre de ventes', String(R.nb));
    kv('Achats du mois (registre)', R.buyLines.length+' — '+R.achatsTotal.toFixed(2)+' EUR');
    y-=6; page.drawText('Document indicatif genere par l\'app. Ne remplace pas un conseil comptable.',{x:40,y,size:8,font:reg,color:rgb(0.55,0.55,0.55)});
    const bytes=await pdf.save(); const blob=new Blob([bytes],{type:'application/pdf'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`rapport-${reportMonth}.pdf`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  };

  // ── Bilan annuel (récap 12 mois, prêt pour la déclaration) ──────────
  const [showAnnual, setShowAnnual] = useState(false);
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear());
  const reportYears = useMemo(() => {
    const s = new Set([new Date().getFullYear()]);
    (sales.items||[]).forEach(o=>{ const d=o.date&&new Date(o.date); if(d&&!isNaN(d)) s.add(d.getFullYear()); });
    (buys.items||[]).forEach(o=>{ const d=o.date&&new Date(o.date); if(d&&!isNaN(d)) s.add(d.getFullYear()); });
    return [...s].sort((a,b)=>b-a);
  }, [sales.items, buys.items]);
  const annual = useMemo(() => {
    const regime = load('vinted_regime','micro');
    const tvaRate = Number(load('vinted_tva',20))||20;
    const months = Array.from({length:12},(_,i)=>({ m:i, label:new Date(reportYear,i,1).toLocaleDateString('fr-FR',{month:'short'}).replace('.',''), ca:0, cout:0, frais:0, nb:0, nbCout:0 }));
    let ca=0, cout=0, frais=0, nb=0, nbCout=0, margeKnown=0;
    for (const o of (sales.items||[])) {
      if (isHidden(o)) continue;
      if (classifyOrderStatus(o.status)!=='completed' || !o.date) continue;
      const d=new Date(o.date); if(isNaN(d) || d.getFullYear()!==reportYear) continue;
      const sell = o.price?.amount!=null?Number(o.price.amount):0;
      const e = resolvedEntry(o); const fee=feesOf(e);
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : null;
      const mo=months[d.getMonth()];
      ca+=sell; nb+=1; frais+=fee; mo.ca+=sell; mo.nb+=1; mo.frais+=fee;
      if (buy!=null && !isNaN(buy)) { cout+=buy; nbCout+=1; margeKnown+=(sell-buy); mo.cout+=buy; mo.nbCout+=1; }
    }
    let achatsTotal=0, achatsNb=0;
    const buyLines=[];
    for (const o of (buys.items||[])) {
      if (classifyOrderStatus(o.status)==='cancelled' || !o.date) continue;
      const d=new Date(o.date); if(isNaN(d) || d.getFullYear()!==reportYear) continue;
      const montant = o.price?.amount!=null?Number(o.price.amount):0;
      achatsTotal += montant; achatsNb+=1;
      buyLines.push({ o, date:o.date, seller:o.seller||o.user_login||o.opposite_user?.login||'', title:o.title, montant });
    }
    buyLines.sort((a,b)=> new Date(b.date)-new Date(a.date));
    const benefNet = ca - cout - frais;
    const marge = margeKnown - frais;
    const tvaMarge = (regime==='marge' && marge>0) ? marge*(tvaRate/(100+tvaRate)) : 0;
    const margeHT = marge - tvaMarge;
    const urssaf = ca*0.135;
    return { regime, tvaRate, year:reportYear, months, ca, cout, frais, nb, nbCout, benefNet, marge, tvaMarge, margeHT, urssaf, achatsTotal, achatsNb, buyLines };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.items, buys.items, reportYear, numeros, hiddenSales, hiddenAccts]);
  const openAnnual = () => { setShowAnnual(true); if (buys.items===null && accounts.length) loadOrders('purchased', setBuys); };
  const exportAnnualCsv = () => {
    const R=annual; const e=(v)=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const L=[];
    L.push([`Bilan annuel ${R.year}`]);
    L.push([`Régime`, R.regime==='marge'?'Société (marge)':'Micro-entrepreneur']);
    L.push([]);
    L.push(['Mois','CA encaissé','Coût achat','Boosts','Bénéfice net','Ventes']);
    R.months.forEach(m=>L.push([m.label, m.ca.toFixed(2), m.cout.toFixed(2), m.frais.toFixed(2), (m.ca-m.cout-m.frais).toFixed(2), String(m.nb)]));
    L.push(['TOTAL', R.ca.toFixed(2), R.cout.toFixed(2), R.frais.toFixed(2), R.benefNet.toFixed(2), String(R.nb)]);
    L.push([]);
    L.push(['ACHATS (registre)']); L.push(['Date','Vendeur','Article','Montant']);
    R.buyLines.forEach(b=>L.push([b.date?new Date(b.date).toLocaleDateString('fr-FR'):'',b.seller,b.title,b.montant.toFixed(2)]));
    L.push(['','','TOTAL',R.achatsTotal.toFixed(2)]);
    L.push([]);
    if (R.regime==='marge') { L.push(['Marge TTC',R.marge.toFixed(2)]); L.push([`TVA sur marge (${R.tvaRate}%)`,R.tvaMarge.toFixed(2)]); L.push(['Marge HT',R.margeHT.toFixed(2)]); }
    else { L.push(['Estimation cotisations (13,5%)',R.urssaf.toFixed(2)]); }
    const csv = L.map(r=>r.map(e).join(';')).join('\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`bilan-${R.year}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  const exportAnnualPdf = async () => {
    const R=annual;
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create(); const page = pdf.addPage([595,842]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold); const reg = await pdf.embedFont(StandardFonts.Helvetica);
    let y=800; const T=(t,x,yy,s,f,c)=>page.drawText(String(t),{x,y:yy,size:s,font:f||reg,color:c||rgb(0.1,0.1,0.1)});
    T('Bilan annuel '+R.year,40,y,22,bold,rgb(0,0.47,0.51)); y-=20; T(R.regime==='marge'?'Société (régime de la marge)':'Micro-entrepreneur',40,y,11,reg,rgb(0.4,0.4,0.4)); y-=26;
    // Tableau mensuel
    const cols=[[40,'Mois'],[150,'CA'],[240,'Coût'],[330,'Boosts'],[420,'Bénéf.'],[510,'Ventes']];
    cols.forEach(([x,h])=>T(h,x,y,9,bold,rgb(0.3,0.3,0.3))); y-=4; page.drawLine({start:{x:40,y},end:{x:555,y},thickness:0.5,color:rgb(0.8,0.8,0.8)}); y-=14;
    R.months.forEach(m=>{ T(m.label,40,y,9,reg); T(m.ca.toFixed(0),150,y,9,reg); T(m.cout.toFixed(0),240,y,9,reg); T(m.frais.toFixed(0),330,y,9,reg); T((m.ca-m.cout-m.frais).toFixed(0),420,y,9,reg); T(String(m.nb),510,y,9,reg); y-=15; });
    page.drawLine({start:{x:40,y:y+4},end:{x:555,y:y+4},thickness:0.5,color:rgb(0.8,0.8,0.8)});
    T('TOTAL',40,y-8,10,bold); T(R.ca.toFixed(0),150,y-8,10,bold); T(R.cout.toFixed(0),240,y-8,10,bold); T(R.frais.toFixed(0),330,y-8,10,bold); T(R.benefNet.toFixed(0),420,y-8,10,bold); T(String(R.nb),510,y-8,10,bold); y-=34;
    const kv=(k,v)=>{ T(k,40,y,10,reg,rgb(0.4,0.4,0.4)); T(v,300,y,11,bold); y-=20; };
    kv('Achats (registre)', R.achatsTotal.toFixed(2)+' EUR ('+R.achatsNb+')');
    if (R.regime==='marge') { kv('Marge TTC', R.marge.toFixed(2)+' EUR'); kv('TVA sur la marge ('+R.tvaRate+'%)', R.tvaMarge.toFixed(2)+' EUR'); kv('Marge HT', R.margeHT.toFixed(2)+' EUR'); }
    else { kv('Bénéfice net', R.benefNet.toFixed(2)+' EUR'); kv('Estimation cotisations (13,5%)', R.urssaf.toFixed(2)+' EUR'); }
    y-=6; T('Document indicatif genere par l\'app. Ne remplace pas un conseil comptable.',40,y,8,reg,rgb(0.55,0.55,0.55));
    const bytes=await pdf.save(); const blob=new Blob([bytes],{type:'application/pdf'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`bilan-${R.year}.pdf`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  };

  // Routeur commun : lit le format du bordereau, tamponne à l'emplacement connu
  // pour ce format (ou au défaut intelligent = haut de page, jamais sur le
  // code-barres). On stocke tout pour permettre de DÉPLACER ensuite.
  const processBordereau = async (numero, title, pdfBuf) => {
    try {
      const { width, height } = await readPdfFirstPageSize(pdfBuf);
      const key = bordereauFormatKey(width, height);
      let pos = bordFormats[key];
      if (!pos) { pos = smartDefaultBordPos(width, height); const next = { ...bordFormats, [key]: pos }; setBordFormats(next); save('vinted_bordereau_formats', next); }
      const r = await annotateAndDownloadBordereau(numero, title, pdfBuf, pos);
      setBordResult({ ...r, numero, title, pdfBuf, key, w:width, h:height });
    } catch(err){ alert('Impossible de lire ce PDF : '+String(err)); }
  };
  // Rouvre le placement pour AJUSTER l'emplacement (depuis « Bordereau prêt »).
  const adjustBordPlacement = () => {
    const r = bordResult; if(!r || !r.pdfBuf) return;
    const blobUrl = URL.createObjectURL(new Blob([r.pdfBuf], { type:'application/pdf' }));
    setBordPlace({ numero:r.numero, title:r.title, pdfBuf:r.pdfBuf, w:r.w, h:r.h, key:r.key, blobUrl, initPos: bordFormats[r.key] });
    if (r.url) URL.revokeObjectURL(r.url);
    setBordResult(null);
  };
  const confirmBordPlacement = async (pos) => {
    const p = bordPlace; if(!p) return;
    const next = { ...bordFormats, [p.key]: pos };
    setBordFormats(next); save('vinted_bordereau_formats', next);
    try { const r = await annotateAndDownloadBordereau(p.numero, p.title, p.pdfBuf, pos); setBordResult({ ...r, numero:p.numero, title:p.title, pdfBuf:p.pdfBuf, key:p.key, w:p.w, h:p.h }); } catch(err){ alert('Erreur : '+String(err)); }
    URL.revokeObjectURL(p.blobUrl); setBordPlace(null);
  };
  const cancelBordPlacement = () => { if(bordPlace){ URL.revokeObjectURL(bordPlace.blobUrl); setBordPlace(null); } };

  const startBordereau = async (numero, title, acc) => {
    bordCtx.current = { numero, title };
    const lbl = acc ? await fetchCapturedLabel(acc.vinted_user_id) : null;
    if (lbl && lbl.pdfB64) {
      const age = lbl.capturedAt ? (Date.now()-new Date(lbl.capturedAt).getTime())/60000 : 999;
      if (age<20 && window.confirm(`Utiliser le dernier bordereau téléchargé pour le N°${numero} (${title}) ?\n\nOK = oui · Annuler = choisir un fichier`)) {
        try { await processBordereau(numero, title, b64ToArrayBuffer(lbl.pdfB64)); return; } catch(_){}
      }
    }
    bordRef.current?.click();
  };
  const onBordFile = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value='';
    let ctx = bordCtx.current; if (!f || !ctx) return;
    if (f.type!=='application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { alert('Choisis le bordereau PDF téléchargé depuis Vinted.'); return; }
    // Import direct (pas depuis une vente) : on demande le N° + le titre.
    if (ctx.standalone) {
      const numero = (window.prompt('Numéro de la paire (laisse vide si aucun) :', '') || '').trim();
      const title = (window.prompt('Titre / description (ex : Nike Air Max 90) :', '') || '').trim();
      ctx = { numero, title };
    }
    try { await processBordereau(ctx.numero, ctx.title, await f.arrayBuffer()); } catch(err){ alert('Erreur : '+String(err)); }
  };

  const fmtE = (n)=> (n==null?'—':Number(n).toFixed(2).replace('.',',')+' €');
  const cur = (c)=> c==='EUR'?'€':(c||'');

  // Export CSV des ventes (pour compta / déclarations).
  const exportCsv = () => {
    const rows = [['Date','Compte','N°','Titre','Prix vente','Prix achat','Boost','Bénéfice net','Statut']];
    (sales.items||[]).filter(o=>!isHidden(o)).forEach(o=>{
      const st = classifyOrderStatus(o.status);
      const e = resolvedEntry(o); const num = e?.numero || '';
      const sell = o.price?.amount!=null ? Number(o.price.amount) : '';
      const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : '';
      const fee = feesOf(e);
      const benef = (buy!=='' && sell!=='' && !isNaN(buy)) ? (sell-buy-fee).toFixed(2) : '';
      rows.push([
        o.date?new Date(o.date).toLocaleDateString('fr-FR'):'', accName(o._acc), num, o.title||'',
        sell===''?'':String(sell).replace('.',','), buy===''?'':String(buy).replace('.',','),
        fee>0?String(fee.toFixed(2)).replace('.',','):'',
        benef===''?'':String(benef).replace('.',','), st==='completed'?'finalisée':st==='cancelled'?'annulée':'en cours',
      ]);
    });
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'comptabilite-ventes.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  };

  return (
    <div style={{padding:'16px 14px 40px'}}>
      <input ref={bordRef} type="file" accept="application/pdf,.pdf" onChange={onBordFile} style={{display:'none'}}/>
      <h2 style={{fontSize:18,fontWeight:800,color:C.text,margin:'0 0 14px'}}>{only?({ventes:'💸 Ventes',achats:'🛍️ Achats',annonces:'🟢 Annonces',bordereaux:'📄 Bordereaux',messages:'💬 Messages'}[only]||'Comptabilité'):'💸 Comptabilité'}</h2>
      {accounts.length===0 && <div style={{fontSize:13,color:C.muted}}>Aucun compte Vinted lié.</div>}

      {!only && (
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          {[['ventes','💸 Ventes'],['achats','🛍️ Achats'],['annonces','🟢 Annonces'],['bordereaux','📄 Bordereaux']].map(([id,label])=>(
            <button key={id} onClick={()=>setSub(id)} style={{padding:'6px 14px',borderRadius:999,border:`1px solid ${sub===id?C.accent:C.border}`,background:sub===id?C.accent:'transparent',color:sub===id?'#fff':C.text,fontWeight:700,fontSize:13,cursor:'pointer'}}>{label}</button>
          ))}
        </div>
      )}

      {curSub==='ventes' && (<>
        {totals.nb>0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:8}}>
            <StatBox label="CA finalisé" value={fmtE(totals.ca)} sub={`${totals.nb} vente${totals.nb>1?'s':''}`}/>
            <StatBox label="Coût d'achat" value={fmtE(totals.cout)} sub={`${totals.nbCout}/${totals.nb} renseigné${totals.nbCout>1?'s':''}`}/>
            {totals.frais>0 && <StatBox label="Boosts" value={fmtE(totals.frais)} sub="mises en avant"/>}
            <StatBox label="Bénéfice net" value={fmtE(totals.benef)} color={totals.benef>=0?INV_STATUS.online.color:C.danger} sub={totals.margeMoy!=null?`marge ${totals.margeMoy.toFixed(0)} %`:(totals.frais>0?'CA − coût − boosts':'CA − coût')}/>
          </div>
        )}
        {/* Analyse de perf : temps de vente, écoulement, meilleure marque */}
        {totals.nb>0 && (perf.joursMoy!=null || perf.ecoul!=null || perf.bestBrand) && (
          <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:8}}>
            {perf.joursMoy!=null && <StatBox label="Temps de vente" value={`${perf.joursMoy.toFixed(0)} j`} sub={`moyenne sur ${perf.joursNb}`}/>}
            {perf.ecoul!=null && <StatBox label="Écoulement" value={`${perf.ecoul.toFixed(0)} %`} sub={`${perf.vendues} vendu / ${perf.online} en ligne`}/>}
            {perf.bestBrand && <StatBox label="Top marque" value={perf.bestBrand.brand} color={INV_STATUS.online.color} sub={`+${perf.bestBrand.moy.toFixed(0)} €/paire`}/>}
          </div>
        )}
        {/* Objectif de CA mensuel */}
        {accounts.length>0 && (()=>{ const pct = goal>0 ? Math.min(100, (perf.caMois/goal)*100) : 0; return (
          <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'11px 13px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:goal>0?8:0,flexWrap:'wrap',gap:6}}>
              <div style={{fontSize:12,fontWeight:800,color:C.text}}>🎯 Objectif du mois</div>
              {goalEdit ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input autoFocus type="number" defaultValue={goal||''} placeholder="0" onKeyDown={e=>{ if(e.key==='Enter'){ saveGoal(e.target.value); setGoalEdit(false);} if(e.key==='Escape') setGoalEdit(false); }}
                    onBlur={e=>{ saveGoal(e.target.value); setGoalEdit(false); }} style={{width:90,border:`1px solid ${C.accent}`,borderRadius:8,padding:'3px 8px',fontSize:13,fontWeight:700,background:C.bg,color:C.text,outline:'none'}}/>
                  <span style={{fontSize:12,color:C.muted}}>€</span>
                </div>
              ) : (
                <button onClick={()=>setGoalEdit(true)} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:999,padding:'3px 10px',cursor:'pointer',fontSize:11,fontWeight:700,color:C.text}}>
                  {goal>0 ? `${perf.caMois.toFixed(0)} / ${goal} €` : 'Fixer un objectif'}
                </button>
              )}
            </div>
            {goal>0 && (
              <div style={{height:8,borderRadius:999,background:C.border,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:pct>=100?INV_STATUS.online.color:C.accent,borderRadius:999,transition:'width .4s'}}/>
              </div>
            )}
            {goal>0 && <div style={{fontSize:11,color:C.muted,marginTop:5}}>{pct>=100?'🎉 Objectif atteint !':`${(goal-perf.caMois).toFixed(0)} € restants ce mois-ci`}</div>}
          </div>
        ); })()}
        {/* Graphique de tendance 6 mois : CA + bénéfice net */}
        {monthlyChart.total>0 && (()=>{ const W=320, H=110, pad=6, bw=(W-pad*2)/6, gcol=INV_STATUS.online.color; return (
          <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 13px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
              <div style={{fontSize:12,fontWeight:800,color:C.text}}>📈 Tendance — 6 mois</div>
              <div style={{display:'flex',gap:12,fontSize:10.5,fontWeight:700}}>
                <span style={{color:C.accent}}>▮ CA</span><span style={{color:gcol}}>▮ Bénéfice net</span>
              </div>
            </div>
            <div style={{width:'100%',overflowX:'auto'}}>
              <svg viewBox={`0 0 ${W} ${H+20}`} style={{width:'100%',minWidth:280,height:'auto',display:'block'}} role="img" aria-label="Graphique du chiffre d'affaires et du bénéfice net sur 6 mois">
                {monthlyChart.months.map((m,i)=>{
                  const x=pad+i*bw; const caH=(m.ca/monthlyChart.max)*H; const beH=(Math.max(0,m.benef)/monthlyChart.max)*H;
                  const barW=bw*0.30;
                  return (
                    <g key={i}>
                      <rect x={x+bw*0.5-barW-1} y={H-caH} width={barW} height={caH} rx={2} fill={C.accent}/>
                      <rect x={x+bw*0.5+1} y={H-beH} width={barW} height={beH} rx={2} fill={gcol}/>
                      <text x={x+bw*0.5} y={H+14} textAnchor="middle" fontSize="9" fill={C.muted} fontWeight="700">{m.label}</text>
                    </g>
                  );
                })}
                <line x1={pad} y1={H} x2={W-pad} y2={H} stroke={C.border} strokeWidth="1"/>
              </svg>
            </div>
          </div>
        ); })()}
        {totals.nb>0 && (totals.nb-totals.nbCout)>0 && (
          <div style={{fontSize:12,fontWeight:700,color:C.warn,background:`${C.warn}18`,border:`1px solid ${C.warn}55`,borderRadius:10,padding:'8px 12px',marginBottom:12}}>
            ⚠️ {totals.nb-totals.nbCout} vente{(totals.nb-totals.nbCout)>1?'s':''} sans prix d'achat — complète le prix dans l'onglet « Annonces » (bouton 🔗).
          </div>
        )}
        {sales.failed?.length>0 && (
          <div style={{fontSize:12,fontWeight:700,color:C.danger,background:`${C.danger}14`,border:`1px solid ${C.danger}55`,borderRadius:10,padding:'8px 12px',marginBottom:12,lineHeight:1.4}}>
            ⚠️ {sales.failed.length} compte{sales.failed.length>1?'s':''} non chargé{sales.failed.length>1?'s':''} ({sales.failed.join(', ')}) — session expirée. Ouvre ce compte sur vinted.fr (l'extension le recapte) ou reconnecte-le, puis « Synchroniser ».
          </div>
        )}
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          {[['encours','En cours'],['finalisees','Finalisées'],['annulees','Annulées'],['all','Toutes']].map(([id,label])=>(
            <button key={id} onClick={()=>setVFilter(id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${vFilter===id?C.accent:C.border}`,background:vFilter===id?C.accent:'transparent',color:vFilter===id?'#fff':C.text,fontSize:12,fontWeight:700,cursor:'pointer'}}>{label}</button>
          ))}
          {accounts.length>0 && (
            <button onClick={()=>setShowSourcing(true)} title="Stats par marque et taille (quoi racheter)" style={{marginLeft:'auto',padding:'5px 12px',borderRadius:999,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accent,fontSize:12,fontWeight:800,cursor:'pointer'}}>🎯 Sourcing</button>
          )}
          {accounts.length>0 && (
            <button onClick={openReport} title="Rapport comptable mensuel" style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accent,fontSize:12,fontWeight:800,cursor:'pointer'}}>📊 Rapport</button>
          )}
          {accounts.length>0 && (
            <button onClick={openAnnual} title="Bilan annuel (12 mois)" style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accent,fontSize:12,fontWeight:800,cursor:'pointer'}}>📅 Bilan</button>
          )}
          {sales.items && sales.items.length>0 && (
            <button onClick={exportCsv} title="Exporter les ventes en CSV" style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontSize:12,fontWeight:700,cursor:'pointer'}}>⬇️ CSV</button>
          )}
        </div>
        {sales.items && sales.items.length>0 && (
          <input value={ordSearch} onChange={e=>setOrdSearch(e.target.value)} placeholder="🔎 Rechercher (titre, N°, acheteur)…"
            style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',fontSize:13,background:C.card,color:C.text,outline:'none',marginBottom:12}}/>
        )}
        {sales.loading && <Skeleton variant="row" count={5}/>}
        {sales.error && <LoadError onRetry={()=>loadOrders('sold',setSales,true)}/>}
        {sales.items && !sales.error && sales.items.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>Aucune vente pour l'instant.<br/><span style={{fontSize:11.5}}>Tes ventes finalisées apparaîtront ici automatiquement.</span></div>}
        {(()=>{ const nbH=(sales.items||[]).filter(o=>isHidden(o)).length; return nbH>0 ? (
          <div style={{fontSize:11.5,color:C.muted,marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
            🚫 {nbH} vente{nbH>1?'s':''} masquée{nbH>1?'s':''} de la compta
            <button onClick={()=>setShowHidden(v=>!v)} style={{border:'none',background:'transparent',color:C.blue||C.accent,cursor:'pointer',fontWeight:700,fontSize:11.5,padding:0}}>{showHidden?'cacher':'afficher'}</button>
          </div>
        ) : null; })()}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {(sales.items||[]).filter(o=> showHidden ? true : !isHidden(o)).filter(o=>{ const s=classifyOrderStatus(o.status); if(vFilter==='encours')return s==='pending'; if(vFilter==='finalisees')return s==='completed'; if(vFilter==='annulees')return s==='cancelled'; return true; }).filter(o=>matchOrd(o)).map(o=>{
            const st = classifyOrderStatus(o.status);
            const hidden = isHidden(o);
            const amb = titleAmbiguous(o.title);
            const e = resolvedEntry(o); const num = e?.numero;
            const sell = o.price?.amount!=null?Number(o.price.amount):null;
            const buy = e && e.buyPrice!=null && String(e.buyPrice).trim()!=='' ? parseFloat(String(e.buyPrice).replace(',','.')) : null;
            const fees = feesOf(e);
            const benef = (buy!=null && !isNaN(buy) && sell!=null) ? sell-buy-fees : null;
            return (
              <div key={o.transaction_id} style={{display:'flex',gap:10,alignItems:'center',padding:8,borderRadius:12,border:`1px solid ${hidden?C.danger+'55':C.border}`,background:C.card,opacity:hidden?0.5:(st==='cancelled'?0.6:1)}}>
                <div style={{width:46,height:46,borderRadius:8,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {o.photo_url?<img src={o.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18}}>👟</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={o.title}>{num?`N°${num} · `:''}{o.title}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <AcctTag acc={o._acc} name={accNameOf(o._acc)}/>
                    <span>{o.date?new Date(o.date).toLocaleDateString('fr-FR'):''}</span>
                    <span style={{color:st==='completed'?INV_STATUS.online.color:st==='cancelled'?C.danger:C.warn,fontWeight:700}}>{st==='completed'?'finalisée':st==='cancelled'?'annulée':'en cours'}</span>
                    {o.status && <span style={{color:C.muted,fontStyle:'italic',opacity:0.8}} title="Statut exact renvoyé par Vinted">« {o.status} »</span>}
                    {needsBordereau(o.status) && <span style={{color:C.accent,fontWeight:800}}>· à expédier</span>}
                    {amb && <span style={{color:C.danger,fontWeight:800}} title="Plusieurs annonces ont ce même titre : impossible d'attribuer le numéro de façon sûre. Rends les titres uniques.">⚠️ titre en double</span>}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:900,color:C.text}}>{sell!=null?`${sell.toFixed(2).replace('.',',')} ${cur(o.price?.currency_code)}`:''}</div>
                  {benef!=null && <div style={{fontSize:11,fontWeight:800,color:benef>=0?INV_STATUS.online.color:C.danger}}>{benef>=0?'+':''}{benef.toFixed(2).replace('.',',')}€</div>}
                  {benef!=null && fees>0 && <div style={{fontSize:9.5,color:C.muted}}>dont boost −{fees.toFixed(2).replace('.',',')}€</div>}
                  {benef==null && buy==null && !amb && <div style={{fontSize:10,color:C.muted}}>achat ?</div>}
                </div>
                {num && needsBordereau(o.status) && !hidden && inGarage(num) && (
                  <button type="button" onClick={()=>onLocate&&onLocate(num)} title={`Voir la paire N°${num} au garage`} aria-label="Voir au garage" style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:C.blue||C.accent,cursor:'pointer',fontSize:14,padding:'6px 8px'}}>📍</button>
                )}
                {needsBordereau(o.status) && !hidden && (
                  <button type="button" onClick={()=>startBordereau(num||'',o.title,o._acc)} title={num?`Bordereau N°${num}`:'Bordereau (titre)'} aria-label="Bordereau annoté" style={{flexShrink:0,border:'none',background:C.accent,color:'#fff',borderRadius:8,padding:'8px 10px',cursor:'pointer',fontSize:14}}>📄</button>
                )}
                <button type="button" onClick={()=>toggleHidden(o.transaction_id)} title={hidden?'Réintégrer à la compta':'Masquer de la compta'} aria-label={hidden?'Réafficher':'Masquer'} style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:hidden?(C.blue||C.accent):C.muted,cursor:'pointer',fontSize:13,padding:'6px 8px'}}>{hidden?'↩︎':'🚫'}</button>
              </div>
            );
          })}
        </div>
      </>)}

      {curSub==='achats' && (<>
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
          {[['attente','En attente'],['recus','Reçus'],['all','Tous']].map(([id,label])=>(
            <button key={id} onClick={()=>setAFilter(id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${aFilter===id?C.accent:C.border}`,background:aFilter===id?C.accent:'transparent',color:aFilter===id?'#fff':C.text,fontSize:12,fontWeight:700,cursor:'pointer'}}>{label}</button>
          ))}
        </div>
        {buys.items && buys.items.length>0 && (
          <input value={ordSearch} onChange={e=>setOrdSearch(e.target.value)} placeholder="🔎 Rechercher (titre, N°, vendeur)…"
            style={{width:'100%',boxSizing:'border-box',border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',fontSize:13,background:C.card,color:C.text,outline:'none',marginBottom:12}}/>
        )}
        {buys.loading && <Skeleton variant="row" count={5}/>}
        {buys.error && <LoadError onRetry={()=>loadOrders('purchased',setBuys,true)}/>}
        {buys.items && !buys.error && buys.items.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>Aucun achat pour l'instant.<br/><span style={{fontSize:11.5}}>Tes achats Vinted apparaîtront ici automatiquement.</span></div>}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {(buys.items||[]).filter(o=>{ const s=purchasePhase(o.status); if(aFilter==='attente')return s==='pending'; if(aFilter==='recus')return s==='completed'; return true; }).filter(o=>matchOrd(o)).map(o=>(
            <div key={o.transaction_id} style={{display:'flex',gap:10,alignItems:'center',padding:8,borderRadius:12,border:`1px solid ${C.border}`,background:C.card,opacity:classifyOrderStatus(o.status)==='cancelled'?0.6:1}}>
              <div style={{width:46,height:46,borderRadius:8,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {o.photo_url?<img src={o.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18}}>👟</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={o.title}>{o.title}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <AcctTag acc={o._acc} name={accNameOf(o._acc)}/>
                  <span>{o.date?new Date(o.date).toLocaleDateString('fr-FR'):''}</span>
                  {(() => { const s=purchasePhase(o.status); return <span style={{color:s==='completed'?INV_STATUS.online.color:s==='cancelled'?C.danger:C.warn,fontWeight:700}}>{s==='completed'?'reçu':s==='cancelled'?'annulé':'en attente'}</span>; })()}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:900,color:C.text}}>{o.price?.amount} {cur(o.price?.currency_code)}</div>
                <button type="button" onClick={()=>generateAchatJustificatif(o,{ account:accNameOf(o._acc), regime:load('vinted_regime','micro') })}
                  title="Télécharger un justificatif d'achat (PDF)" aria-label="Justificatif d'achat PDF"
                  style={{border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:C.text,cursor:'pointer',fontSize:11,fontWeight:700,padding:'3px 9px'}}>📄 Justif.</button>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* ── Annonces (toutes en ligne, tous comptes) ── */}
      {curSub==='annonces' && (<>
        {listings.loading && <Skeleton variant="card" count={6}/>}
        {listings.error && <LoadError onRetry={()=>loadListings(true)}/>}
        {listings.items && !listings.error && listings.items.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>Aucune annonce en ligne.<br/><span style={{fontSize:11.5}}>Ouvre ta boutique sur vinted.fr une fois pour qu'elles remontent ici.</span></div>}
        {listings.items && listings.items.length>0 && (<>
          {/* Bandeau de stats façon outil pro */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:800,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderRadius:999,padding:'4px 11px'}}>{annStats.n} en ligne</span>
            <span style={{fontSize:12,fontWeight:800,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderRadius:999,padding:'4px 11px'}}>{annStats.val.toFixed(0)} € de valeur</span>
            {annStats.hasFav && <span style={{fontSize:12,fontWeight:800,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderRadius:999,padding:'4px 11px'}}>❤️ {annStats.favs}</span>}
            {annStats.hasView && <span style={{fontSize:12,fontWeight:800,color:C.text,background:C.card,border:`1px solid ${C.border}`,borderRadius:999,padding:'4px 11px'}}>👁 {annStats.views}</span>}
            {annStats.sansNum>0 && <span style={{fontSize:12,fontWeight:800,color:C.warn,background:`${C.warn}18`,border:`1px solid ${C.warn}55`,borderRadius:999,padding:'4px 11px'}}>{annStats.sansNum} sans N°</span>}
            {annStats.sleeping>0 && <button onClick={()=>setAnnSort('sleeping')} style={{fontSize:12,fontWeight:800,color:C.danger,background:`${C.danger}14`,border:`1px solid ${C.danger}55`,borderRadius:999,padding:'4px 11px',cursor:'pointer'}}>😴 {annStats.sleeping} qui dorment{annStats.sleepingVal>0?` · ${annStats.sleepingVal.toFixed(0)} €`:''}</button>}
          </div>
          {annStats.sleeping>0 && annSort!=='sleeping' && (
            <div style={{fontSize:12,color:C.text,background:`${C.danger}12`,border:`1px solid ${C.danger}44`,borderRadius:10,padding:'8px 12px',marginBottom:10,lineHeight:1.4}}>
              😴 {annStats.sleeping} paire{annStats.sleeping>1?'s':''} en ligne depuis plus de {SLEEP_DAYS} jours{annStats.sleepingVal>0?<>, soit <b>{annStats.sleepingVal.toFixed(0)} € qui dorment</b></>:''} — pense à <b>baisser le prix</b> ou <b>republier</b>. <button onClick={()=>setAnnSort('sleeping')} style={{border:'none',background:'transparent',color:C.blue||C.accent,fontWeight:800,cursor:'pointer',padding:0,fontSize:12}}>Voir →</button>
            </div>
          )}
          {/* Recherche + tri */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
            <input value={annSearch} onChange={e=>setAnnSearch(e.target.value)} placeholder="🔎 Rechercher (titre, marque, N°)…"
              style={{flex:'1 1 180px',minWidth:0,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',fontSize:13,background:C.card,color:C.text,outline:'none'}}/>
            <select value={annSort} onChange={e=>setAnnSort(e.target.value)}
              style={{border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 10px',fontSize:13,background:C.card,color:C.text,cursor:'pointer',fontWeight:700}}>
              <option value="recent">Ordre Vinted</option>
              <option value="price_desc">Prix ↓</option>
              <option value="price_asc">Prix ↑</option>
              {annStats.hasFav && <option value="favs">Plus aimées ❤️</option>}
              {annStats.hasView && <option value="views">Plus vues 👁</option>}
              {annStats.hasView && <option value="boost">À booster 💡</option>}
              {annStats.sleeping>0 && <option value="sleeping">Qui dorment 😴</option>}
              <option value="nonum">Sans numéro</option>
            </select>
          </div>
          <div style={{fontSize:11.5,color:C.muted,marginBottom:10}}>Mets le <b>numéro</b> et le <b>prix d'achat</b> sur chaque paire. Prochain numéro libre : <b>{nextNumero}</b>.</div>
        </>)}
        {listings.items && listings.items.length>0 && annShown.length===0 && (
          <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'24px 16px'}}>Aucune annonce ne correspond.</div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:14}}>
          {annShown.map(it=>{
            const item = { id:it.id, title:it.title, photo:it.photo, price:it.price, _acc:it._acc };
            const e = numeros[it.id] || {}; const num = e.numero || ''; const buy = e.buyPrice ?? '';
            const atGarage = inGarage(num);
            const age = listedAgeDays(it); const sleeps = age!=null && age>=SLEEP_DAYS;
            return (
              <div key={it._acc.vinted_user_id+'_'+it.id} style={{borderRadius:14,overflow:'hidden',background:C.card,border:`1px solid ${num?C.accent:C.border}`,display:'flex',flexDirection:'column'}}>
                <a href={it.url||undefined} target="_blank" rel="noreferrer" style={{textDecoration:'none',display:'block',position:'relative'}}>
                  <div style={{width:'100%',aspectRatio:'3/4',background:C.border,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {it.photo?<img src={it.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:34}}>👟</span>}
                  </div>
                  {num && <div style={{position:'absolute',top:8,left:8,background:C.accent,color:'#fff',fontSize:13,fontWeight:900,padding:'3px 9px',borderRadius:999}}>N°{num}</div>}
                  {sleeps && <div title={`En ligne depuis ${age} jours`} style={{position:'absolute',top:8,right:8,background:C.danger,color:'#fff',fontSize:11,fontWeight:900,padding:'3px 8px',borderRadius:999}}>😴 {age}j</div>}
                </a>
                <div style={{padding:'8px 10px 6px'}}>
                  <div style={{fontSize:16,fontWeight:900,color:C.text}}>{it.price!=null?`${it.price} ${cur(it.currency)}`:''}</div>
                  <div style={{fontSize:11,color:C.text,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.brand||it.title}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[it.size,it.condition].filter(Boolean).join(' · ')}</div>
                  {(it.views!=null||it.favourites!=null) && (
                    <div style={{marginTop:4,display:'flex',alignItems:'center',gap:8,fontSize:11,color:C.muted,fontWeight:700}}>
                      {it.views!=null && <span>👁 {it.views}</span>}
                      {it.favourites!=null && <span>❤️ {it.favourites}</span>}
                      {it.views>=30 && it.favourites===0 && <span title="Beaucoup de vues mais aucun favori : le prix est peut-être trop haut." style={{color:C.warn}}>💡 prix ?</span>}
                    </div>
                  )}
                  <div style={{marginTop:5,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <AcctTag acc={it._acc} name={accNameOf(it._acc)}/>
                    {num && <button type="button" onClick={()=>atGarage?(onLocate&&onLocate(num)):(onStore&&onStore(num))} style={{border:'none',background:'transparent',padding:0,cursor:'pointer',fontSize:11,fontWeight:700,color:atGarage?(C.blue||C.accent):C.warn}}>{atGarage?'🏠 Au garage':'🏠 Ranger'}</button>}
                    {titleAmbiguous(it.title) && <span style={{fontSize:10,color:C.danger,fontWeight:800}} title="Une autre annonce a le même titre : la vente ne pourra pas être attribuée sûrement. Rends le titre unique.">⚠️ titre en double</span>}
                  </div>
                </div>
                <div style={{marginTop:'auto',display:'flex',gap:6,padding:'0 10px 10px'}}>
                  <div style={{flex:1,display:'flex',alignItems:'center',gap:4,border:`1px solid ${C.border}`,borderRadius:8,padding:'2px 6px',background:C.bg}}>
                    <span style={{fontSize:10,color:C.muted,fontWeight:700}}>N°</span>
                    <input value={num} onChange={ev=>updatePair(item,{numero:ev.target.value})} onBlur={ev=>recordUsed(ev.target.value)} placeholder={String(nextNumero)} style={{width:'100%',minWidth:0,border:'none',background:'transparent',color:C.text,fontSize:13,fontWeight:700,outline:'none'}}/>
                  </div>
                  <div style={{flex:1,display:'flex',alignItems:'center',gap:2,border:`1px solid ${e.buyFromId?INV_STATUS.online.color:C.border}`,borderRadius:8,padding:'2px 6px',background:C.bg}}>
                    <input value={buy} onChange={ev=>updatePair(item,{buyPrice:ev.target.value,buyFromId:null})} placeholder="achat" inputMode="decimal" style={{width:'100%',minWidth:0,border:'none',background:'transparent',color:C.text,fontSize:13,fontWeight:700,outline:'none'}}/>
                    <span style={{fontSize:10,color:C.muted}}>€</span>
                  </div>
                  <button type="button" onClick={()=>openPicker(item)} title="Relier à un achat" aria-label="Relier cette annonce à un achat Vinted" style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:e.buyFromId?INV_STATUS.online.color:C.text,cursor:'pointer',fontSize:13,padding:'2px 8px'}}>🔗</button>
                </div>
                {num && (
                  <div style={{display:'flex',alignItems:'center',gap:4,border:`1px solid ${C.border}`,borderRadius:8,padding:'2px 6px',background:C.bg,margin:'0 10px 10px'}} title="Coût d'un boost / mise en avant payée sur cette annonce (déduit du bénéfice net)">
                    <span style={{fontSize:10,color:C.muted,fontWeight:700}}>💡 boost</span>
                    <input value={e.fees ?? ''} onChange={ev=>updatePair(item,{fees:ev.target.value})} placeholder="0" inputMode="decimal" style={{width:'100%',minWidth:0,border:'none',background:'transparent',color:C.text,fontSize:13,fontWeight:700,outline:'none'}}/>
                    <span style={{fontSize:10,color:C.muted}}>€</span>
                  </div>
                )}
                {/* Assistant de baisse de prix : sur les paires qui dorment ou tres
                    vues sans favori, on suggere un prix (-15%, arrondi) et un lien
                    direct vers l'annonce pour le baisser. Le vrai 1-clic (ecriture
                    directe) viendra une fois la requete captee par l'extension. */}
                {it.price!=null && (sleeps || (it.views>=30 && it.favourites===0)) && (()=>{
                  const sugg = Math.max(1, Math.round(Number(it.price)*0.85));
                  if (!(sugg < Number(it.price))) return null;
                  return (
                    <div style={{display:'flex',alignItems:'center',gap:8,margin:'0 10px 10px',padding:'6px 8px',borderRadius:8,background:`${C.warn}14`,border:`1px solid ${C.warn}55`}}>
                      <span style={{fontSize:10.5,color:C.text,fontWeight:700,flex:1,minWidth:0,lineHeight:1.3}}>💸 Prix conseillé <b>{sugg} {cur(it.currency)}</b> <span style={{color:C.muted}}>(−15 %{sleeps?` · dort ${age}j`:''})</span></span>
                      <a href={it.url||undefined} target="_blank" rel="noreferrer" title="Ouvrir l'annonce sur Vinted pour baisser le prix" style={{flexShrink:0,textDecoration:'none',background:C.warn,color:'#fff',fontSize:11,fontWeight:800,padding:'5px 10px',borderRadius:8}}>🏷️ Baisser</a>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </>)}

      {/* ── Messages (séparés par compte via le sélecteur) ── */}
      {curSub==='messages' && (<>
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
          <button onClick={()=>setMsgAcc('all')} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${msgAcc==='all'?C.accent:C.border}`,background:msgAcc==='all'?C.accent:'transparent',color:msgAcc==='all'?'#fff':C.text,fontSize:12,fontWeight:700,cursor:'pointer'}}>Tous</button>
          {accounts.map(acc=>(
            <button key={acc.vinted_user_id} onClick={()=>setMsgAcc(acc.vinted_user_id)} style={{padding:'5px 12px',borderRadius:999,border:`1px solid ${msgAcc===acc.vinted_user_id?acctColor(acc.vinted_user_id):C.border}`,background:msgAcc===acc.vinted_user_id?acctColor(acc.vinted_user_id):'transparent',color:msgAcc===acc.vinted_user_id?'#fff':C.text,fontSize:12,fontWeight:700,cursor:'pointer'}}>{accNameOf(acc)}</button>
          ))}
        </div>
        {convs.loading && <Skeleton variant="row" count={5}/>}
        {convs.error && <LoadError onRetry={()=>loadConvs(true)}/>}
        {(() => {
          const daysSince = (d)=>{ if(!d) return null; const t=new Date(d); if(isNaN(t)) return null; return Math.floor((Date.now()-t.getTime())/86400000); };
          const base = (convs.items||[]).filter(c=>msgAcc==='all'||c._acc.vinted_user_id===msgAcc);
          // "En attente de réponse" = conversation non lue (l'acheteur a écrit, tu
          // n'as pas encore répondu). Triées de la plus ancienne à la plus récente.
          const waiting = base.filter(c=>c.unread).sort((a,b)=> new Date(a.updated_at||0) - new Date(b.updated_at||0));
          const oldest = waiting.length ? daysSince(waiting[0].updated_at) : null;
          const shown = (msgWaitingOnly ? waiting : base);
          return (<>
            {waiting.length>0 && (
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 12px',borderRadius:12,background:`${C.warn}14`,border:`1px solid ${C.warn}55`}}>
                <span style={{fontSize:18}}>⏳</span>
                <div style={{flex:1,minWidth:0,fontSize:12,color:C.text,fontWeight:700,lineHeight:1.35}}>
                  {waiting.length} acheteur{waiting.length>1?'s':''} en attente de réponse
                  {oldest!=null && oldest>=1 && <span style={{color:C.danger,fontWeight:800}}> · le plus ancien depuis {oldest} j</span>}
                  <div style={{fontSize:10.5,color:C.muted,fontWeight:600}}>Répondre vite = meilleures évaluations.</div>
                </div>
                <button type="button" onClick={()=>setMsgWaitingOnly(v=>!v)} style={{flexShrink:0,border:`1px solid ${C.warn}`,background:msgWaitingOnly?C.warn:'transparent',color:msgWaitingOnly?'#fff':C.warn,borderRadius:999,padding:'5px 10px',fontSize:11,fontWeight:800,cursor:'pointer'}}>{msgWaitingOnly?'Tout voir':'En attente'}</button>
              </div>
            )}
            {convs.items && !convs.error && shown.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>{msgWaitingOnly?'Aucune conversation en attente. 👌':<>Aucune conversation.<br/><span style={{fontSize:11.5}}>Tes échanges Vinted s'afficheront ici.</span></>}</div>}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {shown.map((conv,i)=>{
                const photo = conv.opposite_user?.photo?.url || conv.item_photos?.[0]?.url;
                const age = conv.unread ? daysSince(conv.updated_at) : null;
                return (
                  <button key={(conv.id||i)+'_'+conv._acc.vinted_user_id} type="button" onClick={()=>openConversation(conv)} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',borderRadius:10,border:`1px solid ${conv.unread?(C.warn+'88'):C.border}`,background:conv.unread?`${C.warn}0c`:C.card,cursor:'pointer',textAlign:'left',width:'100%'}}>
                    {photo?<img src={photo} alt="" style={{width:40,height:40,borderRadius:8,objectFit:'cover',flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:8,background:C.border,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}>💬</div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{conv.opposite_user?.login||'Conversation'}</div>
                      <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{conv.description||''}</div>
                      <div style={{marginTop:4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}><AcctTag acc={conv._acc} name={accNameOf(conv._acc)}/>{conv.unread && <span style={{fontSize:10,color:C.warn,fontWeight:800}}>⏳ à répondre{age!=null&&age>=1?` · ${age}j`:''}</span>}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                      <span style={{fontSize:10,color:C.muted}}>{conv.updated_at?new Date(conv.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):''}</span>
                      {conv.unread && <span style={{width:9,height:9,borderRadius:999,background:C.warn}}/>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>);
        })()}
      </>)}

      {/* ── Bordereaux (ventes non annulées avec un numéro, à imprimer) ── */}
      {curSub==='bordereaux' && (<>
        {/* Import direct : marche toujours, même si la vente n'apparaît pas / iPhone */}
        <button type="button" onClick={()=>{ bordCtx.current = { standalone:true }; bordRef.current?.click(); }}
          style={{width:'100%',border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accent,borderRadius:12,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:800,marginBottom:6}}>
          📄 Importer un bordereau à tamponner
        </button>
        <div style={{fontSize:11,color:C.muted,marginBottom:14,lineHeight:1.4}}>Télécharge d'abord ton bordereau depuis Vinted (dans la conversation), puis choisis-le ici — l'app y imprime le N° + le titre. Ça marche sur iPhone (via Fichiers/iCloud).</div>
        <div style={{fontSize:11.5,color:C.muted,marginBottom:12}}>Ou depuis une vente <b>à expédier</b> ci-dessous (numéro pré-rempli) :</div>
        {sales.loading && <Skeleton variant="row" count={4}/>}
        {sales.error && <LoadError onRetry={()=>loadOrders('sold',setSales,true)}/>}
        {(() => {
          if (sales.loading || sales.error) return null;
          // Uniquement les ventes À EXPÉDIER (ni expédiées, ni finalisées, ni annulées).
          const list = (sales.items||[]).filter(o=>needsBordereau(o.status)).filter(o=>matchOrd(o));
          if (sales.items && list.length===0) return <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>Aucune vente à expédier.<br/><span style={{fontSize:11.5}}>Les bordereaux apparaissent pour les ventes en cours d'expédition.</span></div>;
          return (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {list.map(o=>{ const amb=titleAmbiguous(o.title); const num=amb?'':(resolvedEntry(o)?.numero||''); const st=classifyOrderStatus(o.status);
                return (
                  <div key={o.transaction_id} style={{display:'flex',gap:10,alignItems:'center',padding:8,borderRadius:12,border:`1px solid ${C.border}`,background:C.card}}>
                    <div style={{width:46,height:46,borderRadius:8,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>{o.photo_url?<img src={o.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18}}>👟</span>}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{num?`N°${num} · `:''}{o.title}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        <AcctTag acc={o._acc} name={accNameOf(o._acc)}/>
                        <span style={{color:st==='completed'?INV_STATUS.online.color:C.warn,fontWeight:700}}>{st==='completed'?'finalisée':'en cours'}</span>
                        {!num && <span style={{color:C.muted}}>titre seul</span>}
                      </div>
                    </div>
                    <button type="button" onClick={()=>startBordereau(num,o.title,o._acc)} style={{flexShrink:0,border:'none',background:C.accent,color:'#fff',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:13,fontWeight:800}}>📄 Bordereau</button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </>)}

      {/* Modale : relier un achat (depuis Annonces) */}
      {pickerFor && (
        <div onClick={()=>setPickerFor(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:520,maxHeight:'85vh',borderRadius:'16px 16px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:14,fontWeight:800,color:C.text}}>Quel achat correspond à cette paire ?</div>
              <button type="button" onClick={()=>setPickerFor(null)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer'}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'8px 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
              {purchasesPick.loading && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px 0'}}>Chargement de tes achats…</div>}
              {!purchasesPick.loading && (() => {
                const curId = numeros[pickerFor.id]?.buyFromId;
                const avail = purchasesPick.items.filter(p => !linkedBuyIds.has(String(p.transaction_id)) || String(p.transaction_id)===String(curId));
                if (avail.length===0) return <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px 0'}}>Aucun achat disponible.</div>;
                return avail.map(p => (
                  <button key={p.transaction_id} type="button" onClick={()=>choosePick(p)} style={{display:'flex',gap:10,alignItems:'center',padding:8,borderRadius:10,border:`1px solid ${C.border}`,background:C.surface,cursor:'pointer',textAlign:'left'}}>
                    <div style={{width:44,height:44,borderRadius:8,background:C.border,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>{p.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18}}>👟</span>}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:2}}><AcctTag acc={p._acc} name={accNameOf(p._acc)}/> {p.date?new Date(p.date).toLocaleDateString('fr-FR'):''}</div>
                    </div>
                    <div style={{fontSize:15,fontWeight:900,color:C.text,flexShrink:0}}>{p.price?.amount} {cur(p.price?.currency_code)}</div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modale conversation */}
      {bordPlace && <BordPlacer place={bordPlace} onConfirm={confirmBordPlacement} onCancel={cancelBordPlacement}/>}

      {bordResult && (
        <div onClick={()=>{ URL.revokeObjectURL(bordResult.url); setBordResult(null); }} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1250,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,borderRadius:16,maxWidth:360,width:'100%',padding:20,textAlign:'center'}}>
            <div style={{fontSize:34,marginBottom:6}}>✅</div>
            <div style={{fontSize:16,fontWeight:900,color:C.text,marginBottom:4}}>Bordereau prêt</div>
            <div style={{fontSize:12.5,color:C.muted,lineHeight:1.45,marginBottom:16}}>Ouvre-le puis <b>Partager → Imprimer</b> (ou enregistre-le). Sur iPhone c'est le bouton de partage en bas.</div>
            <a href={bordResult.url} target="_blank" rel="noreferrer" download={bordResult.filename}
              style={{display:'block',background:C.accent,color:C.onAccent,borderRadius:12,padding:'13px 16px',fontSize:15,fontWeight:800,textDecoration:'none',marginBottom:8}}>📄 Ouvrir le bordereau</a>
            {bordResult.pdfBuf && <button onClick={adjustBordPlacement} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:12,background:'transparent',color:C.text,cursor:'pointer',fontSize:13,fontWeight:700,padding:'11px',marginBottom:8}}>✋ Le N° n'est pas au bon endroit ? Le déplacer</button>}
            <button onClick={()=>{ URL.revokeObjectURL(bordResult.url); setBordResult(null); }} style={{width:'100%',border:'none',background:'transparent',color:C.muted,cursor:'pointer',fontSize:13,fontWeight:700,padding:'8px'}}>Fermer</button>
          </div>
        </div>
      )}

      {showAnnual && (
        <div onClick={()=>setShowAnnual(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'16px 16px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:900,color:C.text}}>📅 Bilan annuel</div>
                <div style={{fontSize:11,color:C.muted}}>{annual.regime==='marge'?'Société — régime de la marge':'Micro-entrepreneur'} · <span style={{opacity:0.8}}>régime modifiable dans ⚙️ Paramètres</span></div>
              </div>
              <button type="button" onClick={()=>setShowAnnual(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:700,color:C.text}}>Année</span>
                <select value={reportYear} onChange={e=>setReportYear(Number(e.target.value))} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontSize:13,fontWeight:700,background:C.card,color:C.text,cursor:'pointer'}}>
                  {reportYears.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {buys.loading && <div style={{fontSize:11.5,color:C.muted,marginBottom:10}}>Chargement du registre d'achats…</div>}
              <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:14}}>
                <StatBox label="CA encaissé" value={fmtE(annual.ca)} sub={`${annual.nb} vente${annual.nb>1?'s':''}`}/>
                {annual.regime==='marge' ? (<>
                  <StatBox label="Marge TTC" value={fmtE(annual.marge)} color={annual.marge>=0?INV_STATUS.online.color:C.danger}/>
                  <StatBox label={`TVA marge ${annual.tvaRate}%`} value={fmtE(annual.tvaMarge)} color={C.warn}/>
                  <StatBox label="Marge HT" value={fmtE(annual.margeHT)}/>
                </>) : (<>
                  <StatBox label="Bénéfice net" value={fmtE(annual.benefNet)} color={annual.benefNet>=0?INV_STATUS.online.color:C.danger} sub={annual.frais>0?`boosts ${fmtE(annual.frais)}`:undefined}/>
                  <StatBox label="Cotisations est." value={fmtE(annual.urssaf)} color={C.warn} sub="13,5% du CA"/>
                </>)}
              </div>
              {annual.nb>annual.nbCout && <div style={{fontSize:11.5,color:C.warn,background:`${C.warn}18`,border:`1px solid ${C.warn}55`,borderRadius:10,padding:'8px 12px',marginBottom:12}}>⚠️ {annual.nb-annual.nbCout} vente(s) sans prix d'achat — le bénéfice est incomplet.</div>}
              {/* Tableau mensuel */}
              <div style={{fontSize:12,fontWeight:800,color:C.text,margin:'6px 0 8px'}}>Détail par mois</div>
              <div style={{overflowX:'auto',marginBottom:12}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11.5}}>
                  <thead><tr style={{color:C.muted,textAlign:'right'}}>
                    <th style={{textAlign:'left',padding:'4px 6px',fontWeight:700}}>Mois</th>
                    <th style={{padding:'4px 6px',fontWeight:700}}>CA</th>
                    <th style={{padding:'4px 6px',fontWeight:700}}>Coût</th>
                    <th style={{padding:'4px 6px',fontWeight:700}}>Bénéf.</th>
                    <th style={{padding:'4px 6px',fontWeight:700}}>Ventes</th>
                  </tr></thead>
                  <tbody>
                    {annual.months.map((m,i)=>{ const b=m.ca-m.cout-m.frais; return (
                      <tr key={i} style={{borderTop:`1px solid ${C.border}`,color:C.text,textAlign:'right'}}>
                        <td style={{textAlign:'left',padding:'5px 6px',textTransform:'capitalize'}}>{m.label}</td>
                        <td style={{padding:'5px 6px'}}>{m.ca?m.ca.toFixed(0)+'€':'—'}</td>
                        <td style={{padding:'5px 6px',color:C.muted}}>{m.cout?m.cout.toFixed(0)+'€':'—'}</td>
                        <td style={{padding:'5px 6px',fontWeight:700,color:m.nbCout?(b>=0?INV_STATUS.online.color:C.danger):C.muted}}>{m.nbCout?(b>=0?'+':'')+b.toFixed(0)+'€':'—'}</td>
                        <td style={{padding:'5px 6px',color:C.muted}}>{m.nb||'—'}</td>
                      </tr>
                    );})}
                    <tr style={{borderTop:`2px solid ${C.border}`,color:C.text,textAlign:'right',fontWeight:900}}>
                      <td style={{textAlign:'left',padding:'6px'}}>TOTAL</td>
                      <td style={{padding:'6px'}}>{annual.ca.toFixed(0)}€</td>
                      <td style={{padding:'6px'}}>{annual.cout.toFixed(0)}€</td>
                      <td style={{padding:'6px',color:annual.benefNet>=0?INV_STATUS.online.color:C.danger}}>{(annual.benefNet>=0?'+':'')+annual.benefNet.toFixed(0)}€</td>
                      <td style={{padding:'6px'}}>{annual.nb}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{fontSize:12,fontWeight:800,color:C.text,margin:'6px 0 8px'}}>Registre d'achats — {fmtE(annual.achatsTotal)} ({annual.buyLines.length})</div>
              {buys.items===null && <div style={{fontSize:11.5,color:C.muted,marginBottom:8}}>Registre en cours de chargement…</div>}
              {buys.items!==null && annual.buyLines.length===0 && <div style={{fontSize:12,color:C.muted,padding:'6px 0 12px'}}>Aucun achat cette année.</div>}
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12,maxHeight:260,overflowY:'auto'}}>
                {annual.buyLines.map((b,i)=>(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 10px',border:`1px solid ${C.border}`,borderRadius:10,background:C.card}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.title||'—'}</div>
                      <div style={{fontSize:10,color:C.muted}}>{b.date?new Date(b.date).toLocaleDateString('fr-FR'):''}{b.seller?` · ${b.seller}`:''}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,color:C.text,flexShrink:0}}>{b.montant.toFixed(2)}€</div>
                    <button type="button" onClick={()=>generateAchatJustificatif(b.o,{ account:accNameOf(b.o._acc), regime:annual.regime })} title="Justificatif d'achat PDF" aria-label="Justificatif d'achat" style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:C.text,cursor:'pointer',fontSize:12,padding:'3px 8px'}}>📄</button>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button onClick={exportAnnualCsv} style={{flex:1,minWidth:120,padding:'9px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:12.5,fontWeight:700,cursor:'pointer'}}>⬇️ CSV</button>
                <button onClick={exportAnnualPdf} style={{flex:1,minWidth:120,padding:'9px 12px',borderRadius:10,border:`1px solid ${C.accent}`,background:`${C.accent}12`,color:C.accent,fontSize:12.5,fontWeight:800,cursor:'pointer'}}>📄 PDF</button>
              </div>
              <div style={{fontSize:10.5,color:C.muted,lineHeight:1.5,marginTop:12}}>Document indicatif. Ne remplace pas un conseil comptable. Les mois sans prix d'achat renseigné affichent un bénéfice incomplet.</div>
            </div>
          </div>
        </div>
      )}
      {showSourcing && (
        <div onClick={()=>setShowSourcing(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'16px 16px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:900,color:C.text}}>🎯 Sourcing — quoi racheter</div>
                <div style={{fontSize:11,color:C.muted}}>{sourcing.total} vente{sourcing.total>1?'s':''} finalisée{sourcing.total>1?'s':''} analysée{sourcing.total>1?'s':''}</div>
              </div>
              <button type="button" onClick={()=>setShowSourcing(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              {sourcing.total===0 ? (
                <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'28px 16px',lineHeight:1.5}}>Pas encore de vente finalisée à analyser.</div>
              ) : (()=>{
                const bestMargin = (rows)=> rows.reduce((mx,r)=> (r.benefMoy!=null && (mx==null || r.benefMoy>mx))?r.benefMoy:mx, null);
                const Section = ({title, rows, hint})=>{
                  const bm = bestMargin(rows);
                  return (
                    <div style={{marginBottom:18}}>
                      <div style={{fontSize:12,fontWeight:800,color:C.text,marginBottom:2}}>{title}</div>
                      <div style={{fontSize:10.5,color:C.muted,marginBottom:8}}>{hint}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {rows.map((r,i)=>{ const top = r.benefMoy!=null && bm!=null && r.benefMoy===bm && r.benefNb>0;
                          return (
                          <div key={i} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',border:`1px solid ${top?(INV_STATUS.online.color+'88'):C.border}`,borderRadius:10,background:top?`${INV_STATUS.online.color}10`:C.card}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.key==='—'?'Marque inconnue':(r.key==='?'?'Taille inconnue':r.key)} {top && <span style={{fontSize:10,color:INV_STATUS.online.color,fontWeight:700}}>★ top marge</span>}</div>
                              <div style={{fontSize:10.5,color:C.muted}}>{r.nb} vendue{r.nb>1?'s':''} · CA {fmtE(r.ca)}{r.joursMoy!=null?` · ${r.joursMoy.toFixed(0)} j en moy.`:''}</div>
                            </div>
                            <div style={{textAlign:'right',flexShrink:0}}>
                              <div style={{fontSize:14,fontWeight:900,color:r.benefMoy==null?C.muted:(r.benefMoy>=0?INV_STATUS.online.color:C.danger)}}>{r.benefMoy==null?'—':`${r.benefMoy>=0?'+':''}${r.benefMoy.toFixed(0)}€`}</div>
                              <div style={{fontSize:9.5,color:C.muted}}>{r.benefMoy==null?'achat inconnu':'bénéf./paire'}</div>
                            </div>
                          </div>
                        );})}
                      </div>
                    </div>
                  );
                };
                return (<>
                  <Section title="Par marque" rows={sourcing.brands} hint="Trié par nb de ventes. Le bénéfice/paire aide à prioriser les rachats."/>
                  <Section title="Par taille" rows={sourcing.sizes} hint="Taille estimée depuis le titre — approximatif. « ? » = pointure non détectée."/>
                  <div style={{fontSize:10.5,color:C.muted,lineHeight:1.5,borderTop:`1px solid ${C.border}`,paddingTop:10}}>Le bénéfice n'est calculé que pour les ventes dont le prix d'achat est renseigné (bouton 🔗 dans Annonces). Les marques reconnues viennent d'une liste interne.</div>
                </>);
              })()}
            </div>
          </div>
        </div>
      )}
      {showReport && (
        <div onClick={()=>setShowReport(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'88vh',borderRadius:'16px 16px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:900,color:C.text}}>📊 Rapport comptable</div>
                <div style={{fontSize:11,color:C.muted}}>{report.regime==='marge'?'Société — régime de la marge':'Micro-entrepreneur'} · <span style={{opacity:0.8}}>régime modifiable dans ⚙️ Paramètres</span></div>
              </div>
              <button type="button" onClick={()=>setShowReport(false)} aria-label="Fermer" style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:700,color:C.text}}>Mois</span>
                <select value={reportMonth} onChange={e=>setReportMonth(e.target.value)} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 10px',fontSize:13,fontWeight:700,background:C.card,color:C.text,cursor:'pointer'}}>
                  {reportMonths.map(m=>{ const [y,mo]=m.split('-'); const lbl=new Date(Number(y),Number(mo)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); return <option key={m} value={m}>{lbl}</option>; })}
                </select>
              </div>
              {buys.loading && <div style={{fontSize:11.5,color:C.muted,marginBottom:10}}>Chargement du registre d'achats…</div>}
              {/* Chiffres clés selon le régime */}
              <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:14}}>
                <StatBox label="CA encaissé" value={fmtE(report.ca)} sub={`${report.nb} vente${report.nb>1?'s':''}`}/>
                {report.regime==='marge' ? (<>
                  <StatBox label="Marge TTC" value={fmtE(report.marge)} color={report.marge>=0?INV_STATUS.online.color:C.danger}/>
                  <StatBox label={`TVA marge ${report.tvaRate}%`} value={fmtE(report.tvaMarge)} color={C.warn}/>
                  <StatBox label="Marge HT" value={fmtE(report.margeHT)}/>
                </>) : (<>
                  <StatBox label="Bénéfice net" value={fmtE(report.benefNet)} color={report.benefNet>=0?INV_STATUS.online.color:C.danger} sub={report.frais>0?`boosts ${fmtE(report.frais)}`:undefined}/>
                  <StatBox label="Cotisations est." value={fmtE(report.urssaf)} color={C.warn} sub="13,5% du CA"/>
                </>)}
              </div>
              {report.nb>report.nbCout && <div style={{fontSize:11.5,color:C.warn,background:`${C.warn}18`,border:`1px solid ${C.warn}55`,borderRadius:10,padding:'8px 12px',marginBottom:12}}>⚠️ {report.nb-report.nbCout} vente(s) sans prix d'achat — le calcul de marge est incomplet.</div>}
              {/* Registre d'achats */}
              <div style={{fontSize:12,fontWeight:800,color:C.text,margin:'6px 0 8px'}}>Registre d'achats — {fmtE(report.achatsTotal)} ({report.buyLines.length})</div>
              {report.buyLines.length===0 && <div style={{fontSize:12,color:C.muted,padding:'6px 0 12px'}}>Aucun achat ce mois-ci{buys.items===null?' (registre en cours de chargement)':''}.</div>}
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                {report.buyLines.map((b,i)=>(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 10px',border:`1px solid ${C.border}`,borderRadius:10,background:C.card}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.title||'—'}</div>
                      <div style={{fontSize:10,color:C.muted}}>{b.date?new Date(b.date).toLocaleDateString('fr-FR'):''}{b.seller?` · ${b.seller}`:''}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,color:C.text,flexShrink:0}}>{b.montant.toFixed(2)}€</div>
                    <button type="button" onClick={()=>generateAchatJustificatif(b.o,{ account:accNameOf(b.o._acc), regime:report.regime })} title="Justificatif d'achat PDF" aria-label="Justificatif d'achat" style={{flexShrink:0,border:`1px solid ${C.border}`,borderRadius:8,background:'transparent',color:C.text,cursor:'pointer',fontSize:12,padding:'3px 8px'}}>📄</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8,padding:'12px 16px',borderTop:`1px solid ${C.border}`,flexShrink:0}}>
              <button onClick={exportReportCsv} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:10,background:'transparent',color:C.text,cursor:'pointer',fontSize:13,fontWeight:700,padding:'10px'}}>⬇️ CSV</button>
              <button onClick={exportReportPdf} style={{flex:1,border:'none',borderRadius:10,background:C.accent,color:C.onAccent,cursor:'pointer',fontSize:13,fontWeight:800,padding:'10px'}}>📄 PDF</button>
            </div>
          </div>
        </div>
      )}

      {openConv && (
        <div onClick={()=>setOpenConv(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.bg,width:'100%',maxWidth:560,maxHeight:'85vh',borderRadius:'16px 16px 0 0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              {openConv.header?.photo?<img src={openConv.header.photo} alt="" style={{width:38,height:38,borderRadius:8,objectFit:'cover'}}/>:<div style={{width:38,height:38,borderRadius:8,background:C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>💬</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800,color:C.text}}>{openConv.header?.login||'Conversation'}</div>
                <div style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{openConv.header?.title||''}</div>
              </div>
              <button type="button" onClick={()=>setOpenConv(null)} style={{border:'none',background:'transparent',fontSize:22,color:C.muted,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:16,display:'flex',flexDirection:'column',gap:8}}>
              {openConv.loading && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px 0'}}>Chargement…</div>}
              {openConv.error && <div style={{fontSize:13,color:C.danger}}>Erreur : {String(openConv.error)}</div>}
              {/* Bandeau BORDEREAU : lien d'étiquette détecté dans la conversation. */}
              {!openConv.loading && !openConv.error && (()=>{ const bl=[...new Set(openConv.messages.flatMap(m=>(m.links||[]).filter(l=>l.bordereau).map(l=>l.url)))]; return bl.length>0 ? (
                <div style={{background:`${C.accent}14`,border:`1px solid ${C.accent}66`,borderRadius:12,padding:'10px 12px',marginBottom:4}}>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:0.5,color:C.accent,textTransform:'uppercase',marginBottom:6}}>📄 Bordereau détecté dans la conversation</div>
                  {bl.map((u,i)=>(
                    <a key={i} href={u} target="_blank" rel="noreferrer" style={{display:'block',background:C.accent,color:C.onAccent,borderRadius:10,padding:'10px 12px',fontSize:13.5,fontWeight:800,textDecoration:'none',textAlign:'center',marginBottom:i<bl.length-1?6:0}}>Ouvrir le bordereau {bl.length>1?`(${i+1})`:''}</a>
                  ))}
                </div>
              ) : null; })()}
              {!openConv.loading && !openConv.error && openConv.messages.map((m,i)=>(
                m.kind==='event'
                  ? (/code|retrait|pickup|pin|suivi|tracking|colis|r[ée]cup[ée]rer|point relais/i.test(m.body)
                      ? <div key={i} style={{alignSelf:'center',maxWidth:'92%',background:`${C.accent}14`,border:`1px solid ${C.accent}66`,borderRadius:12,padding:'8px 12px',textAlign:'center'}}>
                          <div style={{fontSize:9.5,fontWeight:800,letterSpacing:0.5,color:C.accent,textTransform:'uppercase',marginBottom:2}}>📦 Info colis / retrait</div>
                          <div style={{fontSize:12.5,fontWeight:700,color:C.text,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{m.body}</div>
                          {(m.links||[]).map((l,j)=><a key={j} href={l.url} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:6,fontSize:12,fontWeight:700,color:C.blue||C.accent}}>{l.bordereau?'📄 Bordereau':'🔗 lien'}</a>)}
                        </div>
                      : <div key={i} style={{alignSelf:'center',fontSize:10,color:C.muted,background:C.surface,border:`1px solid ${C.border}`,borderRadius:999,padding:'3px 10px',maxWidth:'90%',textAlign:'center'}}>{m.body}{(m.links||[]).map((l,j)=><a key={j} href={l.url} target="_blank" rel="noreferrer" style={{marginLeft:6,color:C.blue||C.accent,fontWeight:700}}>{l.bordereau?'📄':'🔗'}</a>)}</div>)
                  : <div key={i} style={{alignSelf:m.mine?'flex-end':'flex-start',maxWidth:'80%'}}>
                      <div style={{background:m.mine?C.accent:C.surface,color:m.mine?'#fff':C.text,border:m.mine?'none':`1px solid ${C.border}`,borderRadius:14,padding:'8px 12px',fontSize:13,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{m.body||(m.photos?.length?'📷 photo':'')}</div>
                      {(m.links||[]).map((l,j)=><a key={j} href={l.url} target="_blank" rel="noreferrer" style={{display:'block',marginTop:3,fontSize:11.5,fontWeight:700,color:C.blue||C.accent,alignSelf:m.mine?'flex-end':'flex-start'}}>{l.bordereau?'📄 Bordereau':'🔗 lien'}</a>)}
                    </div>
              ))}
              {!openConv.loading && !openConv.error && openConv.messages.length===0 && <div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px 0'}}>Aucun message.</div>}
            </div>
            {/* Barre de réponse : envoi via l'extension (ton navigateur/IP). */}
            {!openConv.loading && !openConv.error && openConv.convId && (
              <div style={{flexShrink:0,borderTop:`1px solid ${C.border}`,padding:'10px 12px',background:C.bg}}>
                {replyErr && <div style={{fontSize:11,color:C.danger,marginBottom:6,lineHeight:1.35}}>{replyErr}</div>}
                <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                  <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={1} placeholder={vmrExtPresent()?'Écrire une réponse…':'Réponse (extension VRM requise)…'} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendReply(); } }} style={{flex:1,resize:'none',maxHeight:120,minHeight:20,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px',fontSize:13,background:C.card,color:C.text,outline:'none',fontFamily:'inherit',lineHeight:1.4}}/>
                  <button type="button" onClick={sendReply} disabled={replyBusy||!replyText.trim()} style={{flexShrink:0,border:'none',borderRadius:12,padding:'9px 14px',background:(replyBusy||!replyText.trim())?C.border:C.accent,color:'#fff',fontSize:13,fontWeight:800,cursor:(replyBusy||!replyText.trim())?'default':'pointer'}}>{replyBusy?'…':'Envoyer'}</button>
                </div>
                {!vmrExtPresent() && <a href={`https://www.vinted.fr/inbox/${openConv.convId}`} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:6,fontSize:11,fontWeight:700,color:C.blue||C.accent}}>↗ Répondre sur Vinted (sans extension)</a>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Paramètres (accessible via le rouage en haut à droite) ──────────────── */
function SettingsScreen({ setTab, onExport, onImport, dark, toggleDark }) {
  const Row = ({icon,title,desc,onClick,color}) => (
    <button type="button" onClick={onClick} style={{display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',padding:'14px 16px',borderRadius:12,border:`1px solid ${C.border}`,background:C.card,cursor:'pointer',marginBottom:10}}>
      <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:'block',fontSize:14,fontWeight:800,color:color||C.text}}>{title}</span>
        {desc && <span style={{display:'block',fontSize:11,color:C.muted,marginTop:2}}>{desc}</span>}
      </span>
      <span style={{color:C.muted,fontSize:18}}>›</span>
    </button>
  );
  return (
    <div style={{padding:'16px 14px 40px',maxWidth:600,margin:'0 auto'}}>
      <h2 style={{fontSize:18,fontWeight:800,color:C.text,margin:'0 0 16px'}}>⚙️ Paramètres</h2>

      <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,margin:'0 0 8px 2px'}}>Comptes Vinted</div>
      <Row icon="🔗" title="Comptes liés" desc="État de connexion, renommer, tester." onClick={()=>setTab('vintedaccounts')}/>

      <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,margin:'18px 0 8px 2px'}}>Sauvegarde</div>
      <Row icon="📤" title="Exporter mes données" desc="Télécharge une sauvegarde (catalogue, ventes, garage)." onClick={onExport}/>
      <Row icon="📥" title="Importer une sauvegarde" desc="Remplace tes données par un fichier de sauvegarde." onClick={onImport} color={C.blue}/>

      <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,margin:'18px 0 8px 2px'}}>Ancienne application</div>
      <Row icon="📦" title="Ancien catalogue" desc="Les paires de l'ancienne appli (toujours comptées dans les stats)." onClick={()=>setTab('catalog')}/>
      <Row icon="💸" title="Anciennes ventes" desc="Les ventes historiques de l'ancienne appli." onClick={()=>setTab('sales')}/>
      <Row icon="🟢" title="Stock Vinted (ancien)" desc="L'ancienne liste de numéros en ligne." onClick={()=>setTab('stockvinted')}/>

      <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,margin:'18px 0 8px 2px'}}>Comptabilité</div>
      <RegimeSetting/>
      <div style={{height:10}}/>
      <Row icon="📄" title="Emplacements de bordereau" desc="Réinitialise où le N° est tamponné (l'app te redemandera à chaque format)." onClick={()=>{ if(window.confirm('Oublier les emplacements de tampon mémorisés ? L\'app te redemandera où placer le N° au prochain bordereau de chaque format.')){ save('vinted_bordereau_formats',{}); alert('✓ Emplacements réinitialisés.'); } }}/>

      <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700,margin:'18px 0 8px 2px'}}>Affichage</div>
      <Row icon={dark?'☀️':'🌙'} title={dark?'Passer en mode clair':'Passer en mode sombre'} onClick={toggleDark}/>
    </div>
  );
}

// Réglage du régime fiscal : détermine comment le rapport comptable présente les
// chiffres. Micro-entrepreneur (CA + estimation cotisations) ou société au
// régime de la marge (marge + TVA sur la marge). Synchronisé (vinted_regime/tva).
function RegimeSetting() {
  const [regime, setRegime] = useState(() => load('vinted_regime', 'micro'));
  const [tva, setTva] = useState(() => Number(load('vinted_tva', 20)) || 20);
  const pick = (r) => { setRegime(r); save('vinted_regime', r); };
  const setRate = (v) => { const n = Math.max(0, Math.min(100, Number(v)||0)); setTva(n); save('vinted_tva', n); };
  return (
    <div style={{border:`1px solid ${C.border}`,background:C.card,borderRadius:12,padding:'12px 14px'}}>
      <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:4}}>Régime fiscal</div>
      <div style={{fontSize:11.5,color:C.muted,marginBottom:10,lineHeight:1.4}}>Adapte le rapport comptable à ta situation.</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {[['micro','Micro-entrepreneur','Pas de TVA. Rapport : CA encaissé, bénéfice net, estimation des cotisations.'],
          ['marge','Société — régime de la marge','TVA sur la marge. Rapport : marge, TVA sur marge à reverser, registre d\'achats.']].map(([id,t,d])=>(
          <button key={id} onClick={()=>pick(id)} style={{textAlign:'left',display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',borderRadius:10,cursor:'pointer',
            border:`1px solid ${regime===id?C.accent:C.border}`,background:regime===id?`${C.accent}12`:'transparent'}}>
            <span style={{flexShrink:0,width:18,height:18,marginTop:1,borderRadius:999,border:`2px solid ${regime===id?C.accent:C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {regime===id && <span style={{width:9,height:9,borderRadius:999,background:C.accent}}/>}
            </span>
            <span style={{minWidth:0}}>
              <span style={{fontSize:13,fontWeight:800,color:C.text,display:'block'}}>{t}</span>
              <span style={{fontSize:11.5,color:C.muted,lineHeight:1.4}}>{d}</span>
            </span>
          </button>
        ))}
      </div>
      {regime==='marge' && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
          <span style={{fontSize:12,fontWeight:700,color:C.text}}>Taux de TVA</span>
          <input type="number" value={tva} onChange={e=>setRate(e.target.value)} style={{width:64,border:`1px solid ${C.border}`,borderRadius:8,padding:'4px 8px',fontSize:13,fontWeight:700,background:C.bg,color:C.text,outline:'none'}}/>
          <span style={{fontSize:12,color:C.muted}}>%</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState('dashboard');
  const [dark,setDark]=useState(()=>load('vinted_dark',false));
  // Applique le thème (clair/sombre) en réassignant C avant chaque rendu
  C = dark ? THEMES.dark : THEMES.light;
  const toggleDark=()=>{ const d=!dark; setDark(d); save('vinted_dark',d); };
  const [catalog,setCatalog]=useState(()=>{
    const s=load('vinted_catalog',null);
    if(!s||s.length===0){return INIT_CAT;}
    return s;
  });
  const [sales,setSales]=useState(()=>{
    const s=load('vinted_sales',null);
    if(!s||s.length===0){save('vinted_sales',INIT_SAL);return INIT_SAL;}
    return s;
  });
  const [garageGrid,setGarageGrid]=useState(()=>{
    const g=load('vinted_garage_grid',null);
    if(!g||Object.keys(g).length===0){save('vinted_garage_grid',INIT_GARAGE);return INIT_GARAGE;}
    return g;
  });
  const [blockedCells,setBlockedCells]=useState(()=>load('vinted_blocked',{}));
  const [extraCols,setExtraCols]=useState(()=>load('vinted_extracols',{}));
  const [cellColors,setCellColors]=useState(()=>load('vinted_colors',{}));
  const [invoices,setInvoices]=useState(()=>load('vinted_invoices',[]));
  const [vintedAccounts,setVintedAccounts]=useState(()=>load('vinted_accounts',[]));
  const [accountLabels]=useState(()=>load('vinted_account_labels',{}));
  const [inventory,setInventory]=useState(()=>load('vinted_inventory',[]));
  const [garageLocate,setGarageLocate]=useState(null); // numéro à localiser dans le garage
  const [garagePlace,setGaragePlace]=useState(null); // numéro à ranger dans une case du garage
  const swipeStart=React.useRef(null); // pour le swipe entre onglets du bas
  const [stockVinted,setStockVinted]=useState(()=>load('vinted_stock_vinted',[]));
  const [notifEnabled,setNotifEnabled]=useState(()=>load('vinted_notif_enabled',false));
  const [notifBanner,setNotifBanner]=useState(null); // {ventes, factures} ou null
  const [vintedNotif,setVintedNotif]=useState(null); // {messages, ventes} nouveautés Vinted à l'ouverture
  const [menuOpen,setMenuOpen]=useState(false);
  const [invoiceSettings,setInvoiceSettings]=useState(()=>load('vinted_invoice_settings',{
    companyName:'Shop Cancale35',
    companyType:'Entrepreneur individuel',
    companyAddress:'80 rue de la vieille rivière 35260',
    siret:'94135104100012',
    footer:'Merci pour votre achat !',
  }));
  const [showBackup,setShowBackup]=useState(false);
  const [synced,setSynced]=useState(false);
  const [syncStatus,setSyncStatus]=useState('idle'); // idle | saving | synced | error | loading
  const [lastSync,setLastSync]=useState(null); // date de la dernière synchro réussie
  // Logo personnalisable : si l'utilisateur en charge un, il remplace le logo par défaut (header + factures)
  const [customLogo,setCustomLogo]=useState(()=>load('vinted_custom_logo',null));
  const logoSrc = customLogo || LOGO_CANCALE;
  const logoInputRef = React.useRef(null);
  const handleLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    if(!file.type.startsWith('image/')){ alert('Merci de choisir une image (jpg, png...)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setCustomLogo(dataUrl);
      try{ localStorage.setItem('vinted_custom_logo', JSON.stringify(dataUrl)); cloudPush(); }catch(_){ alert("Image trop lourde pour être enregistrée. Essaie une image plus petite."); }
    };
    reader.onerror = () => alert("Impossible de lire l'image.");
    reader.readAsDataURL(file);
    e.target.value='';
  };
  const resetLogo = () => {
    if(window.confirm('Remettre le logo Cancale par défaut ?')){
      setCustomLogo(null);
      try{ localStorage.removeItem('vinted_custom_logo'); cloudPush(); }catch(_){}
    }
  };

  // Icône externe de l'app (onglet du navigateur + écran d'accueil) = le logo de l'app.
  // On met à jour dynamiquement les balises <link> d'icônes avec le logo courant
  // (ta photo si tu en as mis une, sinon le logo Cancale par défaut).
  useEffect(()=>{
    if(!logoSrc) return;
    const setIcon=(rel)=>{
      let link=document.querySelector(`link[rel="${rel}"]`);
      if(!link){ link=document.createElement('link'); link.rel=rel; document.head.appendChild(link); }
      link.href=logoSrc;
    };
    setIcon('icon');
    setIcon('shortcut icon');
    setIcon('apple-touch-icon');
  },[logoSrc]);

  // Repercute dans le state React les tokens rafraichis automatiquement par le
  // proxy (via persistRefreshedTokens). Sans ca, seuls l'objet compte en memoire
  // et Supabase seraient a jour, mais pas le state -> le prochain rendu
  // repartirait de l'ancien token expire.
  useEffect(()=>{
    setVintedTokensRefreshedHandler((vintedUserId, refreshed)=>{
      setVintedAccounts(prev=>{
        const next=prev.map(a=> String(a.vinted_user_id)===String(vintedUserId)
          ? {...a, access_token:refreshed.access_token, refresh_token:refreshed.refresh_token}
          : a);
        try{ localStorage.setItem('vinted_accounts', JSON.stringify(next)); }catch(_){}
        return next;
      });
    });
    return ()=> setVintedTokensRefreshedHandler(null);
  },[]);

  // NOTE (profil discret vis-a-vis de Vinted) : on NE rafraichit PLUS tous les
  // comptes en arriere-plan au demarrage. Rafraichir plusieurs comptes en meme
  // temps depuis l'IP serveur de Vercel ressemble a du multi-comptes piloté par
  // un robot, ce que Vinted surveille. Desormais le token n'est rafraichi que
  // pour le compte reellement consulté, et seulement s'il a expiré (via le
  // proxy, sur 401). C'est le comportement le plus proche d'un vrai utilisateur.

  // Au démarrage : charger la liste des comptes Vinted depuis Supabase, pour que
  // TOUTE l'app (onglets Ventes/Achats/Annonces/Messages, notif, accueil) en
  // dispose immédiatement — avant, ils n'étaient chargés qu'en visitant l'écran
  // « Comptes liés », ce qui laissait les onglets vides tant qu'on n'y était pas
  // passé. C'est une lecture Supabase légère (pas un appel Vinted, aucun risque).
  const [accountsLoaded,setAccountsLoaded]=useState(false);
  const [liveStats,setLiveStats]=useState(null); // résumé Vinted en direct pour l'accueil
  useEffect(()=>{
    let stop=false;
    (async()=>{
      const list=await fetchVintedAccounts();
      if(stop) return;
      if(list && list.length){ setVintedAccounts(list); try{ localStorage.setItem('vinted_accounts',JSON.stringify(list)); }catch(_){} }
      setAccountsLoaded(true);
    })();
    return ()=>{ stop=true; };
  },[]);

  // Au démarrage : charger depuis le cloud Supabase (synchro Mac <-> iPhone)
  // Si le cloud a des données, elles remplacent les données locales.
  // Le localStorage sert de secours si pas de connexion.
  // Demande automatiquement l'autorisation de notifications au démarrage.
  // Si l'utilisateur accepte, les notifications restent activées en permanence.
  // (Le navigateur impose ce consentement une seule fois ; on ne peut pas l'éviter.)
  useEffect(()=>{
    if(typeof Notification==='undefined') return;
    if(Notification.permission==='granted'){
      if(!notifEnabled){ setNotifEnabled(true); save('vinted_notif_enabled',true); }
    } else if(Notification.permission==='default'){
      askNotifPermission().then(res=>{
        if(res==='granted'){ setNotifEnabled(true); save('vinted_notif_enabled',true); }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(() => {
    let stop = false;
    // Écoute les changements de statut de synchro (saving / synced / error)
    const off = onSyncChange((st)=>{ if(!stop){ setSyncStatus(st); if(st==='synced') setLastSync(new Date()); } });
    setSyncStatus('loading');
    (async () => {
      const cloud = await cloudLoad();
      if (stop) return;
      if (cloud && Object.keys(cloud).length > 0) {
        // Applique les données du cloud à l'app + au localStorage
        const apply = (key, setter) => {
          if (cloud[key] !== undefined && cloud[key] !== null) {
            try { localStorage.setItem(key, JSON.stringify(cloud[key])); } catch(_){}
            setter(cloud[key]);
          }
        };
        apply('vinted_catalog', setCatalog);
        apply('vinted_sales', setSales);
        apply('vinted_garage_grid', setGarageGrid);
        apply('vinted_blocked', setBlockedCells);
        apply('vinted_extracols', setExtraCols);
        apply('vinted_colors', setCellColors);
        apply('vinted_invoices', setInvoices);
        apply('vinted_stock_vinted', setStockVinted);
        apply('vinted_invoice_settings', setInvoiceSettings);
        apply('vinted_custom_logo', setCustomLogo);
        setSyncStatus('synced');
        setLastSync(new Date());
      } else {
        // Cloud vide : on y envoie les données locales actuelles (1re utilisation)
        cloudPush();
      }
      setSynced(true);
    })();
    return () => { stop = true; off(); };
  }, []);

  // ── Automatismes Stock Vinted ──────────────────────────
  // On n'active ces effets qu'APRÈS le chargement initial (synced),
  // pour ne pas travailler sur des données encore vides/non synchronisées.

  // 1) Quand des factures existent, leur numéro de paire (productId) se retire
  //    automatiquement du Stock Vinted (la paire est vendue, donc plus en ligne).
  //    Si une facture est supprimée, son numéro n'est plus dans cette liste,
  //    donc il n'est plus retiré : il « revient » naturellement au prochain
  //    ajout manuel — et surtout on conserve les numéros sans facture.
  //    Pour gérer le RETOUR après suppression, on garde la trace des numéros
  //    retirés automatiquement (vinted_sv_auto_removed) afin de les réinjecter
  //    si leur facture disparaît.
  useEffect(()=>{
    if(!synced) return;
    const norm=v=>String(v||'').trim();
    const factureNums=new Set(invoices.flatMap(i=>norm(i.productId).split('+').map(norm)).filter(Boolean));
    let autoRemoved=load('vinted_sv_auto_removed',[]).map(norm);
    let stock=stockVinted.map(norm);
    let changed=false;

    // a) Retirer du stock les numéros qui ont désormais une facture
    const stillPresent=[];
    stock.forEach(n=>{
      if(factureNums.has(n)){
        if(!autoRemoved.includes(n)){ autoRemoved.push(n); }
        changed=true; // retiré
      } else {
        stillPresent.push(n);
      }
    });

    // b) Réinjecter les numéros précédemment retirés auto dont la facture a disparu
    const stillRemoved=[];
    autoRemoved.forEach(n=>{
      if(factureNums.has(n)){
        stillRemoved.push(n); // facture toujours là -> reste retiré
      } else {
        // facture supprimée -> le numéro revient au stock (s'il n'y est pas déjà)
        if(!stillPresent.includes(n)){ stillPresent.push(n); changed=true; }
      }
    });

    if(changed){
      // Dédoublonnage
      const finalStock=Array.from(new Set(stillPresent));
      setStockVinted(finalStock); save('vinted_stock_vinted',finalStock);
      save('vinted_sv_auto_removed',stillRemoved);
    }
  },[invoices,synced]);

  // 2) Nouveaux numéros ajoutés au catalogue À PARTIR DE MAINTENANT
  //    => ajout automatique au Stock Vinted.
  //    On initialise une liste de référence (vinted_sv_seen_catalog) avec
  //    tout le catalogue actuel au premier passage : rien n'est ajouté
  //    rétroactivement. Ensuite, chaque nouvel id du catalogue est ajouté.
  useEffect(()=>{
    if(!synced) return;
    const norm=v=>String(v||'').trim();
    const seenRaw=localStorage.getItem('vinted_sv_seen_catalog');
    const currentIds=catalog.map(p=>norm(p.id)).filter(Boolean);

    if(seenRaw===null){
      // Première initialisation : on mémorise l'état actuel sans rien ajouter
      save('vinted_sv_seen_catalog',currentIds);
      return;
    }
    let seen=[];
    try{ seen=JSON.parse(seenRaw)||[]; }catch(_){ seen=[]; }
    const seenSet=new Set(seen.map(norm));
    const factureNums=new Set(invoices.flatMap(i=>norm(i.productId).split('+').map(norm)).filter(Boolean));

    // Les nouveaux ids (pas encore vus)
    const nouveaux=currentIds.filter(id=>!seenSet.has(id));
    if(nouveaux.length>0){
      const stockSet=new Set(stockVinted.map(norm));
      let added=false;
      nouveaux.forEach(id=>{
        // On n'ajoute pas si déjà vendu (facture présente) ni déjà dans le stock
        if(!stockSet.has(id)&&!factureNums.has(id)){ stockSet.add(id); added=true; }
      });
      if(added){
        const finalStock=Array.from(stockSet);
        setStockVinted(finalStock); save('vinted_stock_vinted',finalStock);
      }
      // Mémoriser tous les ids vus (anciens + nouveaux)
      save('vinted_sv_seen_catalog',currentIds);
    } else {
      // Garder la liste vue à jour (au cas où des ids auraient été retirés)
      save('vinted_sv_seen_catalog',currentIds);
    }
  },[catalog,synced]);

  // ── Notifications : ventes comptabilisées + factures reçues ──
  // Après chargement, on compare le nombre actuel de ventes (=comptabilisées)
  // et de factures avec les derniers compteurs mémorisés. S'il y a du nouveau,
  // on envoie une notification navigateur + on affiche un bandeau dans l'app.
  useEffect(()=>{
    if(!synced) return;
    const prevV=parseInt(localStorage.getItem('vinted_notif_last_sales')||'-1',10);
    const prevF=parseInt(localStorage.getItem('vinted_notif_last_invoices')||'-1',10);
    const curV=sales.length;
    const curF=invoices.length;

    // Première initialisation : on mémorise sans notifier
    if(prevV<0||prevF<0){
      save('vinted_notif_last_sales',curV);
      save('vinted_notif_last_invoices',curF);
      return;
    }

    const newV=Math.max(0,curV-prevV);
    const newF=Math.max(0,curF-prevF);

    if((newV>0||newF>0)){
      // Bandeau in-app (toujours affiché, même si les notifs système sont off)
      setNotifBanner({ventes:newV, factures:newF});

      // Notification navigateur si activée
      if(notifEnabled){
        if(newV>0&&newF>0){
          pushNotif('VRM', `${newV} vente${newV>1?'s':''} comptabilisée${newV>1?'s':''} et ${newF} facture${newF>1?'s':''} reçue${newF>1?'s':''}.`);
        } else if(newV>0){
          pushNotif('Vente comptabilisée', `${newV} nouvelle${newV>1?'s':''} vente${newV>1?'s':''} en comptabilité.`);
        } else if(newF>0){
          pushNotif('Nouvelle facture', `${newF} nouvelle${newF>1?'s':''} facture${newF>1?'s':''} reçue${newF>1?'s':''}.`);
        }
      }
    }

    // Mémoriser les nouveaux compteurs
    save('vinted_notif_last_sales',curV);
    save('vinted_notif_last_invoices',curF);
  },[sales,invoices,synced,notifEnabled]);

  // ── Notif à l'ouverture : nouveautés Vinted (messages non lus + ventes) ──
  // Calculé À PARTIR DES DONNÉES DÉJÀ MOISSONNÉES par l'extension (lignes
  // harvest_* de Supabase) : aucune requête vers Vinted. Les messages non lus
  // sont affichés en absolu (tu en as X) ; les ventes en nouveauté depuis la
  // dernière ouverture. Se lance une fois quand les comptes sont chargés.
  // Résumé « en direct » pour l'écran d'accueil : CA finalisé du mois, ventes en
  // cours, annonces en ligne, messages non lus — agrégés sur tous les comptes,
  // en lecture moissonnée (0 requête Vinted quand la donnée est déjà captée).
  useEffect(()=>{
    if(!accountsLoaded || !vintedAccounts || vintedAccounts.length===0) return;
    let stop=false;
    (async()=>{
      const now=new Date(); const ym=now.getFullYear()*100+now.getMonth();
      let caMois=0, enCours=0, online=0, unread=0, ok=false;
      for(const a of vintedAccounts){
        const sold=await fetchVintedOrders(a,'sold',1,'all');
        if(sold.ok){ ok=true; for(const o of sold.items){
          const st=classifyOrderStatus(o.status);
          if(st==='pending') enCours++;
          if(st==='completed' && o.date){ const d=new Date(o.date); if(!isNaN(d)&&d.getFullYear()*100+d.getMonth()===ym) caMois+=(o.price?.amount!=null?Number(o.price.amount):0); }
        }}
        const list=await fetchVintedListings(a,1); if(list.ok){ ok=true; online+=list.items.length; }
        const conv=await fetchVintedConversations(a,1); if(conv.ok){ ok=true; unread+=conv.items.filter(c=>c.unread).length; }
      }
      if(!stop && ok) setLiveStats({caMois,enCours,online,unread});
    })();
    return ()=>{stop=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[accountsLoaded, vintedAccounts]);

  const vintedNotifChecked = React.useRef(false);
  useEffect(()=>{
    if(!vintedAccounts || vintedAccounts.length===0 || vintedNotifChecked.current) return;
    vintedNotifChecked.current = true;
    let cancelled=false;
    (async()=>{
      // Messages : on ne signale QUE le NOUVEAU depuis la dernière ouverture.
      // Une conversation non lue que Julien laisse traîner volontairement ne doit
      // plus re-sonner à chaque lancement. On mémorise, par conversation, le
      // updated_at déjà vu (clé locale vinted_notif_seen_convs, non synchronisée).
      // Une conv compte comme "nouvelle" si elle est non lue ET (jamais vue OU son
      // updated_at a changé = nouveau message reçu). Au tout premier lancement de
      // cette logique, on initialise en silence (on ne re-nag pas sur l'existant).
      const seenConvs = load('vinted_notif_seen_convs', {});
      const firstMsgRun = localStorage.getItem('vinted_notif_seen_convs')===null;
      const nextSeen = {}; // reconstruit à chaque passage -> se purge tout seul
      let newMsgs=0, salesCount=0;
      for(const a of vintedAccounts){
        const inbox=await fetchHarvest(a.vinted_user_id,'inbox');
        if(inbox && Array.isArray(inbox.conversations)){
          for(const c of inbox.conversations){
            if(!c.unread) continue;
            const cid=String(c.id);
            const stamp=String(c.updated_at||'1');
            if(!firstMsgRun && seenConvs[cid]!==stamp) newMsgs+=1;
            nextSeen[cid]=stamp; // désormais "vu" : ne re-sonnera plus tant qu'inchangé
          }
        }
        const sold=await fetchHarvestOrders(a.vinted_user_id,'sold');
        if(sold && Array.isArray(sold.my_orders)) salesCount += sold.my_orders.filter(o=>classifyOrderStatus(o.status)!=='cancelled').length;
      }
      if(cancelled) return;
      save('vinted_notif_seen_convs',nextSeen);
      const prevS=parseInt(localStorage.getItem('vinted_notif_last_vsales')||'-1',10);
      const newSales = prevS<0 ? 0 : Math.max(0, salesCount-prevS);
      save('vinted_notif_last_vsales',salesCount);
      if(newMsgs>0 || newSales>0){
        setVintedNotif({messages:newMsgs, ventes:newSales});
        if(notifEnabled){
          const parts=[];
          if(newSales>0) parts.push(`${newSales} nouvelle${newSales>1?'s':''} vente${newSales>1?'s':''}`);
          if(newMsgs>0) parts.push(`${newMsgs} nouveau${newMsgs>1?'x':''} message${newMsgs>1?'s':''}`);
          if(parts.length) pushNotif('Vinted', parts.join(' · '));
        }
      }
    })();
    return ()=>{cancelled=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[vintedAccounts]);

  return (
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',background:C.bg,color:C.text,fontFamily:"'Nunito','Instrument Sans',system-ui,sans-serif",paddingBottom:24,transition:'background .3s,color .3s',boxSizing:'border-box'}}>
      <header style={{position:'sticky',top:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:C.surface,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {/* Logo Cancale Shoes Store - cliquable pour le changer */}
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{display:'none'}}/>
          <div
            onClick={()=>logoInputRef.current&&logoInputRef.current.click()}
            onContextMenu={(e)=>{e.preventDefault();resetLogo();}}
            title="Cliquer pour changer le logo (clic droit / appui long = remettre par défaut)"
            style={{position:'relative',width:42,height:42,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,borderRadius:6,overflow:'hidden',cursor:'pointer'}}>
            <img src={logoSrc} alt="Cancale" style={{width:42,height:42,objectFit:'cover'}}/>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:13,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff'}}>✎</div>
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:19,color:C.accent,letterSpacing:-0.3,lineHeight:1}}>Cancale</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:2.5,textTransform:'uppercase',marginTop:3,fontWeight:600}}>Shoes Store</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontSize:12,display:'flex',gap:12,alignItems:'center'}}>
            <span style={{color:C.accent,fontWeight:700}}>📦 {Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='').length}</span>
            <span style={{color:C.muted,fontWeight:700}}>💸 {sales.length}</span>
            <span title={
              syncStatus==='synced'?'Synchronisé avec le cloud':
              syncStatus==='saving'?'Sauvegarde en cours...':
              syncStatus==='loading'?'Chargement...':
              syncStatus==='error'?'Hors ligne (sauvegarde locale)':'En attente'
            } style={{fontSize:13,opacity:0.9,display:'flex',alignItems:'center',gap:4}}>
              {syncStatus==='synced'?'☁️':syncStatus==='saving'||syncStatus==='loading'?'🔄':syncStatus==='error'?'⚠️':'☁️'}
              {lastSync&&syncStatus==='synced'&&(
                <span style={{fontSize:9,color:C.muted,fontWeight:600}}>
                  {String(lastSync.getHours()).padStart(2,'0')}:{String(lastSync.getMinutes()).padStart(2,'0')}
                </span>
              )}
            </span>
          </div>
          {/* Boutons Mode sombre / Exporter / Importer */}
          <div style={{display:'flex',gap:6}}>
            <button type="button" onClick={toggleDark} title={dark?'Mode clair':'Mode sombre'}
              style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:999,padding:'6px 11px',color:C.text,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              {dark?'☀️':'🌙'}
            </button>
            <button type="button" onClick={async()=>{
              if(!notifEnabled){
                const res=await askNotifPermission();
                if(res==='granted'){
                  setNotifEnabled(true); save('vinted_notif_enabled',true);
                  pushNotif('Notifications activées','Tu seras prévenu des ventes comptabilisées et des factures reçues.');
                } else if(res==='denied'){
                  alert("Les notifications sont bloquées par ton navigateur. Pour les activer : réglages du navigateur > Notifications > autorise le site.");
                } else if(res==='unsupported'){
                  alert("Ton navigateur ne supporte pas les notifications. Tu verras quand même le bandeau dans l'app.");
                }
              } else {
                setNotifEnabled(false); save('vinted_notif_enabled',false);
              }
            }} title={notifEnabled?'Notifications activées (cliquer pour désactiver)':'Activer les notifications'}
              style={{background:notifEnabled?C.accent:'transparent',border:`1px solid ${notifEnabled?C.accent:C.border}`,borderRadius:999,padding:'6px 11px',color:notifEnabled?C.onAccent:C.text,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              {notifEnabled?'🔔':'🔕'}
            </button>
            <button type="button" onClick={()=>setTab('settings')} title="Paramètres" aria-label="Ouvrir les paramètres"
              style={{background:tab==='settings'?C.accent:'transparent',border:`1px solid ${tab==='settings'?C.accent:C.border}`,borderRadius:999,padding:'6px 11px',color:tab==='settings'?C.onAccent:C.text,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              ⚙️
            </button>
          </div>
        </div>
      </header>
      {/* Bandeau de notification in-app */}
      {notifBanner&&(notifBanner.ventes>0||notifBanner.factures>0)&&(
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 16px',background:C.accent,color:C.onAccent,fontSize:13,fontWeight:700}}>
          <span>
            🔔 {notifBanner.ventes>0&&`${notifBanner.ventes} vente${notifBanner.ventes>1?'s':''} comptabilisée${notifBanner.ventes>1?'s':''}`}
            {notifBanner.ventes>0&&notifBanner.factures>0&&' · '}
            {notifBanner.factures>0&&`${notifBanner.factures} facture${notifBanner.factures>1?'s':''} reçue${notifBanner.factures>1?'s':''}`}
          </span>
          <button onClick={()=>setNotifBanner(null)} style={{background:'transparent',border:'none',borderRadius:6,color:C.onAccent,cursor:'pointer',fontSize:16,fontWeight:900,padding:'2px 9px',lineHeight:1,opacity:0.8}}>×</button>
        </div>
      )}
      {/* Bandeau nouveautés Vinted (à l'ouverture) — clic = va aux comptes */}
      {vintedNotif&&(vintedNotif.messages>0||vintedNotif.ventes>0)&&(
        <div onClick={()=>{setTab('cat_msg');setVintedNotif(null);}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 16px',background:C.blue||C.accent,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
          <span>
            🔔 {vintedNotif.ventes>0&&`${vintedNotif.ventes} nouvelle${vintedNotif.ventes>1?'s':''} vente${vintedNotif.ventes>1?'s':''}`}
            {vintedNotif.ventes>0&&vintedNotif.messages>0&&' · '}
            {vintedNotif.messages>0&&`${vintedNotif.messages} nouveau${vintedNotif.messages>1?'x':''} message${vintedNotif.messages>1?'s':''}`}
            {' '}sur Vinted
          </span>
          <button onClick={(e)=>{e.stopPropagation();setVintedNotif(null);}} style={{background:'transparent',border:'none',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:16,fontWeight:900,padding:'2px 9px',lineHeight:1,opacity:0.8}}>×</button>
        </div>
      )}
      <main style={{maxWidth:1200,margin:'0 auto',paddingBottom:'calc(84px + env(safe-area-inset-bottom))'}}
        onTouchStart={e=>{ const t=e.touches&&e.touches[0]; if(t) swipeStart.current={x:t.clientX,y:t.clientY}; }}
        onTouchEnd={e=>{
          const s=swipeStart.current; if(!s) return; swipeStart.current=null;
          const t=e.changedTouches&&e.changedTouches[0]; if(!t) return;
          const dx=t.clientX-s.x, dy=t.clientY-s.y;
          if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*2){
            const idx=BOTTOM_TABS.findIndex(x=>x.id===tab);
            if(idx>=0){ const ni=dx<0?Math.min(BOTTOM_TABS.length-1,idx+1):Math.max(0,idx-1); if(ni!==idx) setTab(BOTTOM_TABS[ni].id); }
          }
        }}>
        {tab==='settings'&&<SettingsScreen setTab={setTab}
          onExport={()=>{ try{ const data={catalog,sales,garageGrid,exportDate:new Date().toISOString()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`cancale-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);}catch(err){alert('Erreur export : '+err.message);} }}
          onImport={()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json'; inp.onchange=async(e)=>{ const file=e.target.files[0]; if(!file) return; try{ const data=JSON.parse(await file.text()); if(!data.catalog&&!data.sales&&!data.garageGrid){alert('⚠ Fichier invalide.');return;} let msg='Importer ce fichier ?\n\n'; if(data.catalog)msg+=`📦 Catalogue : ${data.catalog.length} paires\n`; if(data.sales)msg+=`💸 Ventes : ${data.sales.length}\n`; msg+='\n⚠ Tes données actuelles seront REMPLACÉES.'; if(!window.confirm(msg))return; if(data.catalog){setCatalog(data.catalog);save('vinted_catalog',data.catalog);} if(data.sales){setSales(data.sales);save('vinted_sales',data.sales);} if(data.garageGrid){setGarageGrid(data.garageGrid);save('vinted_garage_grid',data.garageGrid);} alert('✓ Import réussi !'); }catch(err){alert('Erreur : '+err.message);} }; inp.click(); }}
          dark={dark} toggleDark={toggleDark}/>}
        {tab==='dashboard'&&accountsLoaded&&vintedAccounts.length===0&&<Onboarding setTab={setTab}/>}
        {tab==='dashboard'&&<Dashboard catalog={catalog} sales={sales} garageGrid={garageGrid} invoices={invoices} liveStats={liveStats} onGo={setTab}/>}
        {tab==='inventory'&&<Inventory inventory={inventory} setInventory={setInventory} accounts={vintedAccounts} garageGrid={garageGrid} labels={accountLabels} onLocate={(numero)=>{ setGarageLocate(String(numero)); setTab('garage'); }}/>}
        {tab==='catalog'  &&<Catalog   catalog={catalog} setCatalog={setCatalog} onDeleteId={(id)=>{
          const norm=v=>String(v||'').trim();
          const n=norm(id);
          const u=stockVinted.filter(x=>norm(x)!==n);
          setStockVinted(u); save('vinted_stock_vinted',u);
          try{const ar=load('vinted_sv_auto_removed',[]).filter(x=>norm(x)!==n);localStorage.setItem('vinted_sv_auto_removed',JSON.stringify(ar));}catch{}
        }}/>}
        {tab==='sales'    &&<Sales     catalog={catalog} setCatalog={setCatalog} sales={sales} setSales={setSales} invoices={invoices} invoiceSettings={invoiceSettings}/>}
        {tab==='invoices' &&<Invoices  invoices={invoices} setInvoices={setInvoices} catalog={catalog} sales={sales} invoiceSettings={invoiceSettings} setInvoiceSettings={setInvoiceSettings}/>}
        {tab==='stockvinted'&&<StockVinted stockVinted={stockVinted} setStockVinted={setStockVinted} garageGrid={garageGrid} invoices={invoices}/>}
        {tab==='garage'   &&<Garage    catalog={catalog} garageGrid={garageGrid} setGarageGrid={setGarageGrid} blockedCells={blockedCells} setBlockedCells={setBlockedCells} extraCols={extraCols} setExtraCols={setExtraCols} cellColors={cellColors} setCellColors={setCellColors} locate={garageLocate} onLocateConsumed={()=>setGarageLocate(null)} placeNum={garagePlace} onPlaced={()=>setGaragePlace(null)}/>}
        {tab==='comptabilite'&&<Comptabilite accounts={vintedAccounts} garageGrid={garageGrid} onLocate={(n)=>{setGarageLocate(String(n));setTab('garage');}} onStore={(n)=>{setGaragePlace(String(n));setTab('garage');}}/>}
        {(()=>{ const map={cat_annonces:'annonces',cat_ventes:'ventes',cat_achats:'achats',cat_bord:'bordereaux',cat_msg:'messages'}; return map[tab] ? <Comptabilite key={tab} accounts={vintedAccounts} only={map[tab]} garageGrid={garageGrid} onLocate={(n)=>{setGarageLocate(String(n));setTab('garage');}} onStore={(n)=>{setGaragePlace(String(n));setTab('garage');}}/> : null; })()}
        {tab==='vintedaccounts'&&<VintedAccounts accounts={vintedAccounts} setAccounts={setVintedAccounts}/>}
      </main>
      <BottomBar tab={tab} setTab={setTab}/>
      {showBackup&&<BackupModal
        catalog={catalog} sales={sales} garageGrid={garageGrid} blockedCells={blockedCells}
        onClose={()=>setShowBackup(false)}
        onImport={(data)=>{
          if(data.catalog){setCatalog(data.catalog);save('vinted_catalog',data.catalog);try{localStorage.setItem('vinted_sv_seen_catalog',JSON.stringify(data.catalog.map(p=>String(p.id||'').trim()).filter(Boolean)));}catch{}}
          if(data.sales){setSales(data.sales);save('vinted_sales',data.sales);}
          if(data.garageGrid){setGarageGrid(data.garageGrid);save('vinted_garage_grid',data.garageGrid);}
          if(data.blockedCells){setBlockedCells(data.blockedCells);save('vinted_blocked',data.blockedCells);}
          setShowBackup(false);
          alert('✓ Restauration réussie !');
        }}
      />}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&display=swap');
        html, body, #root { max-width: 100%; overflow-x: hidden; margin: 0; }
        * { box-sizing: border-box; }
        @media (max-width: 600px) {
          table { font-size: 11px !important; }
          table td, table th { padding: 6px 4px !important; }
        }
      `}</style>
    </div>
  );
}
