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
  majIcone(!!sess);
}

// ── L'ICÔNE OUVRE VRM, SANS FENÊTRE (1er octobre) ───────────────────────────
// Julien : « quand on appuie sur l'extension, ça envoie directement à
// l'application VRM, et ça ne lance pas l'extension ». Jusqu'à la 5.120, un
// clic ouvrait la petite fenêtre, qui redirigeait puis se fermait : on la
// voyait clignoter. Connecté : AUCUNE fenêtre (popup vide) — le clic arrive
// ici (`chrome.action.onClicked`) et ouvre VRM directement. Pas connecté : la
// petite fenêtre de connexion, et elle seule.
const APP_URL_VRM = 'https://vrm.center';
function majIcone(connecte) {
  try { chrome.action.setPopup({ popup: connecte ? '' : 'popup.html' }); } catch (_) {}
}
// Le site d'où l'on vient décide l'onglet de VRM : on arrive là où l'on travaille.
function plateformeDe(url) {
  const u = String(url || '');
  if (/leboncoin\.fr/i.test(u)) return 'leboncoin';
  if (/ebay\.(fr|com)/i.test(u)) return 'ebay';
  if (/vestiairecollective\./i.test(u)) return 'vestiaire';
  if (/vinted\.(fr|com|it|de)/i.test(u)) return 'vinted';
  return '';
}
function ouvrirVRMDepuis(urlActive) {
  const p = plateformeDe(urlActive);
  const cible = APP_URL_VRM + '/?tab=' + (p ? 'plat_' + p : 'plat_vinted');
  try {
    chrome.tabs.query({ url: APP_URL_VRM + '/*' }, (ouverts) => {
      const t = (ouverts || [])[0];
      // Déjà sur VRM : on ne recharge pas la page (on garde l'écran où l'on est).
      if (t && /vrm\.center/i.test(urlActive || '')) { chrome.tabs.update(t.id, { active: true }); return; }
      if (t) { chrome.tabs.update(t.id, { url: cible, active: true }); try { chrome.windows.update(t.windowId, { focused: true }); } catch (_) {} }
      else chrome.tabs.create({ url: cible });
    });
  } catch (_) { try { chrome.tabs.create({ url: cible }); } catch (_) {} }
}
try {
  chrome.action.onClicked.addListener(async (tab) => {
    // Le clic n'arrive ici que si le popup est vide, donc si une session
    // existe. Si elle a expiré entre-temps, on remet la fenêtre de connexion.
    const e = await authEtat().catch(() => ({ connecte: true }));
    if (!e.connecte) {
      majIcone(false);
      try { await chrome.action.openPopup(); return; } catch (_) {}
    }
    ouvrirVRMDepuis(tab && tab.url);
  });
} catch (_) {}
// Au réveil du service worker : l'icône suit la session enregistrée.
loadSession().then((s) => majIcone(!!s)).catch(() => {});
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
    // ⚠️ L'EMAIL SE PERDAIT ICI (mesuré le 2 octobre) : la session renouvelée
    //    était reconstruite SANS lui, donc « compte VRM utilisé » devenait vide
    //    au bout d'une heure — l'information même qui manquait le jour où ses
    //    captures sont parties dans un autre compte VRM.
    const next = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + ((j.expires_in || 3600) * 1000),
      user_id: (j.user && j.user.id) || s.user_id || null,
      email: (j.user && j.user.email) || s.email || emailDuJwt(j.access_token) || '',
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

// ══════════════════════════════════════════════════════════════════════════════
// SE CONNECTER DEPUIS L'EXTENSION (email + mot de passe)
// ══════════════════════════════════════════════════════════════════════════════
// Jusqu'ici la session ne pouvait venir QUE de l'app (bridge.js) : sur un
// navigateur où l'app n'est jamais ouverte, l'extension écrivait forcément avec
// la clé publique. Une fois la base cloisonnée, ça veut dire : elle n'écrit plus
// rien. On peut donc s'identifier ici, directement.
//
// ⚠️ Le mot de passe n'est JAMAIS gardé : il part une fois chez Supabase, qui
// renvoie deux jetons. Seuls les jetons sont stockés (`chrome.storage.local`,
// zone locale de l'extension — un site web ne peut pas la lire).
async function authLogin(email, password) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail || !password) return { ok: false, error: 'Email et mot de passe requis.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail, password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) {
      // On traduit : « invalid_grant » n'aide personne à se connecter.
      const brut = String(j.error_description || j.msg || j.error || '');
      let msg = brut || 'Connexion refusée.';
      if (/invalid login|invalid_grant|credentials/i.test(brut)) msg = 'Email ou mot de passe incorrect.';
      else if (/not confirmed/i.test(brut)) msg = "Cette adresse n'est pas encore confirmée. Ouvre l'email de confirmation, ou confirme le compte depuis l'app.";
      else if (/rate limit|too many/i.test(brut)) msg = 'Trop de tentatives. Réessaie dans quelques minutes.';
      return { ok: false, error: msg };
    }
    await saveSession({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + ((j.expires_in || 3600) * 1000),
      user_id: (j.user && j.user.id) || null,
      email: (j.user && j.user.email) || mail,
    });
    return { ok: true, email: (j.user && j.user.email) || mail };
  } catch (e) { return { ok: false, error: 'Réseau indisponible — réessaie.' }; }
}

// État de la session, pour l'afficher SANS mentir : connecté ou non, sous quelle
// adresse, et surtout si la base sait aujourd'hui séparer les vendeurs. Tant que
// `cloisonne` est faux, se connecter ne protège rien — on le dit.
async function authEtat() {
  const s = await loadSession();
  const cl = await isCloisonne();
  if (!s) return { ok: true, connecte: false, cloisonne: cl };
  // Un refresh_token périmé (longue absence) rend la session inutilisable : on
  // le vérifie vraiment au lieu d'afficher « connecté » sur un jeton mort.
  const vivant = await authToken();
  const email = (vivant && vivant.email) || s.email || emailDuJwt((vivant || s).access_token) || '';
  return { ok: true, connecte: !!vivant, expiree: !vivant, email, cloisonne: cl };
}
// L'email est une REVENDICATION du jeton Supabase (`email`) : une identité, pas
// une ressemblance — c'est le repli quand la session n'a pas gardé l'adresse.
function emailDuJwt(token) {
  try { const p = jwtPayload(token); return (p && typeof p.email === 'string') ? p.email : ''; } catch (_) { return ''; }
}

async function authLogout() { await saveSession(null); return { ok: true }; }
// EST-CE QUE LA BASE SAIT SEPARER LES VENDEURS ?
// Tant que la colonne `owner` n'existe pas, ecrire un `owner` ferait echouer
// TOUTES les captures (400 : colonne inconnue). On teste donc l'etat reel de la
// base, une fois, et on garde la reponse le temps de vie du service worker.
let CLOISONNE = null;   // null = pas encore verifie
// ⚠️ ON MÉMORISE LA PROMESSE, PAS SEULEMENT LE RÉSULTAT (même motif que
//    `sbGetMemo`). Cette sonde ne gardait que sa réponse : tant qu'elle était en
//    vol, chaque appelant en relançait une. Tant que les lectures partaient une
//    par une ça ne se voyait pas ; dès qu'elles partent ensemble, **six sondes
//    identiques** partaient avant que la première ne réponde — mesuré le
//    15 septembre, 6× `select=owner&limit=1` sur une construction de panneau.
let CLOISONNE_EN_VOL = null;
async function isCloisonne() {
  if (CLOISONNE !== null) return CLOISONNE;
  if (CLOISONNE_EN_VOL) return await CLOISONNE_EN_VOL;
  CLOISONNE_EN_VOL = (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      CLOISONNE = r.ok;
    } catch (_) { CLOISONNE = false; }
    CLOISONNE_EN_VOL = null;
    return CLOISONNE;
  })();
  return await CLOISONNE_EN_VOL;
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
// ⚠️⚠️ UNE LECTURE RATÉE N'EST PAS UNE LISTE VIDE — ET ICI ÇA SUPPRIME.
// Ces deux listes décident, dans `captureDomain`, si on EFFACE la ligne
// `vinted_accounts` d'un compte. Elles écrivaient `res.ok ? … : []` puis
// estampillaient le cache : un 522 devenait donc une mesure « rien », gardée
// 5 minutes (60 s pour l'autre). Deux conséquences réelles, et opposées :
//   · liste noire lue vide → un compte SUPPRIMÉ définitivement se fait
//     re-capter (« shop_cancale revenait tout le temps ») ;
//   · contre-ordre lu vide → un compte qu'il vient de RÉAUTORISER est traité
//     comme encore supprimé : **sa ligne est effacée**, ses jetons partent, et
//     il doit repasser sur Vinted. C'est « l'extension ne veut pas renvoyer mes
//     nouveaux comptes », déclenché par 60 secondes de lecture ratée.
// ⇒ `null` = « pas su ». On ne met pas en cache un échec, on garde la dernière
//   valeur connue, et l'appelant n'efface RIEN tant qu'il ne sait pas.
let _blockedAccts = null, _blockedAt = 0, _blockedNames = {};
async function blockedAccounts() {
  if (_blockedAccts && Date.now() - _blockedAt < 300000) return _blockedAccts;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_blocked_accounts&select=data`, { headers: await sbHeaders() });
    if (!res.ok) return _blockedAccts;                  // pas su : on garde ce qu'on avait (souvent `null`)
    const rows = await res.json();
    if (!Array.isArray(rows)) return _blockedAccts;     // 522 : du HTML, pas du JSON
    const d = (rows[0] && rows[0].data) || {};
    const uids = (d.uids || []).map(String);
    _blockedAccts = new Set(uids);
    // Le pseudo est stocké à côté de l'identifiant. Sans lui, un compte supprimé
    // s'affiche « compte 2413 » — illisible, alors qu'on sait qu'il s'appelle
    // shop_cancale (sa ligne `vinted_accounts` a justement été effacée).
    _blockedNames = {};
    uids.forEach((u, i) => { const n = (d.logins || [])[i]; if (n) _blockedNames[u] = String(n); });
    _blockedAt = Date.now();
  } catch (_) { return _blockedAccts; }                 // réseau coupé : pas su non plus
  return _blockedAccts;
}

// ⚠️ LE CONTRE-ORDRE : un compte RÉAUTORISÉ explicitement depuis le panneau.
// `panel_accounts_off[uid] === false` veut dire « rallume-le, ça prime sur
// l'app » (tri-état, §5.08). `buildPanelData` l'honorait déjà pour l'AFFICHAGE,
// mais la CAPTURE, elle, ne consultait que la liste noire : le compte
// réapparaissait dans le panneau et l'extension continuait de refuser ses
// jetons — et effaçait sa ligne à chaque cycle. C'est exactement « l'extension
// ne veut pas renvoyer mes nouveaux comptes ».
let _unblockAccts = null, _unblockAt = 0;
async function unblockedAccounts() {
  if (_unblockAccts && Date.now() - _unblockAt < 60000) return _unblockAccts;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.panel_accounts_off&select=data`, { headers: await sbHeaders() });
    if (!res.ok) return _unblockAccts;
    const rows = await res.json();
    if (!Array.isArray(rows)) return _unblockAccts;
    const map = (rows[0] && rows[0].data) || {};
    _unblockAccts = new Set(Object.keys(map).filter(k => map[k] === false).map(String));
    _unblockAt = Date.now();
  } catch (_) { return _unblockAccts; }
  return _unblockAccts;
}
// Vide les deux caches : sans ça, réautoriser un compte ne prenait effet
// qu'au bout de 5 minutes — le temps qu'on croie que le bouton ne marche pas.

// Dernier refus de capture, pour que le panneau puisse le DIRE. Un compte
// refusé en silence est indiscernable d'un compte jamais capté.
async function noterRefus(uid, domain, raison) {
  try {
    const cur = (await chrome.storage.local.get('vrmRefus')).vrmRefus || {};
    cur[String(uid)] = { at: Date.now(), domain, raison };
    await chrome.storage.local.set({ vrmRefus: cur });
  } catch (_) {}
}
async function oublierRefus(uid) {
  try {
    const cur = (await chrome.storage.local.get('vrmRefus')).vrmRefus || {};
    if (cur[String(uid)]) { delete cur[String(uid)]; await chrome.storage.local.set({ vrmRefus: cur }); }
  } catch (_) {}
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
  // ⚠️ SAUF s'il a été RÉAUTORISÉ explicitement (tri-état ci-dessus) : sinon la
  // suppression est un aller sans retour, et rebrancher un compte devient
  // impossible depuis Chrome — silencieusement.
  // ⚠️ ON N'EFFACE QUE SI ON SAIT. `null` veut dire « je n'ai pas pu lire » :
  //    agir dessus reviendrait à supprimer les jetons d'un compte vivant sur
  //    une simple coupure. Dans le doute, on ne touche à rien — le compte sera
  //    re-capté une fois de trop au pire, ce qui se répare d'un clic.
  const _noirs = await blockedAccounts();
  const _rallumes = await unblockedAccounts();
  if (_noirs && _rallumes && _noirs.has(uid) && !_rallumes.has(uid)) {
    try { await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?vinted_user_id=eq.${uid}`, { method: 'DELETE', headers: await sbHeaders() }); } catch (_) {}
    await noterRefus(uid, domain, 'supprime');
    logActivity(`⛔ Compte ${uid} ignoré (supprimé définitivement) — réautorise-le dans « Mes comptes »`);
    return null;
  }
  await oublierRefus(uid);
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
// ⚠️ POURQUOI CE COMPTEUR EXISTE. Vérifié en base : `harvest_*_item_*` = ZÉRO
// ligne, alors que `/api/v2/items/{id}` apparaît bien dans les chemins vus et que
// tout le code de capture est en place. Donc l'appel part et rien n'arrive : il y
// a une fuite quelque part entre inject.js et l'écriture. Trois sorties muettes
// sur ce chemin (pas de compte actif, corps non-JSON, type inconnu) — impossible
// de savoir laquelle sans mesurer. Ce compteur note CHAQUE passage et CHAQUE
// abandon, par type. Aucune donnée personnelle : des nombres.
// Conséquence concrète : sans fiche article, pas de description → « Republier »
// obligerait à tout retaper. C'est le vrai blocage de cette fonction.
// ⚠️⚠️ L'INSTRUMENTATION NE SURVIVAIT PAS AU SERVICE WORKER (2 septembre).
// `_diag.n` et `_rates` étaient des variables de MODULE, écrites en base au plus
// une fois par minute. Or Chrome tue un service worker MV3 après ~30 s
// d'inactivité : le tampon mourait donc AVANT le flush, et les compteurs comme
// les échantillons partaient avec lui.
// PREUVE DIRECTE EN BASE, pas une hypothèse : `recupererLabel` pose TROIS
// échantillons dans la même boucle (label_url, shipments/{id}, label_options),
// à quelques centaines de millisecondes d'intervalle. Le premier écrivait et
// consommait le quota d'une minute ; les deux suivants étaient jetés. En base,
// `rates` ne contient QUE `label_label_url` — jamais `label` ni
// `label_label_options`. C'est exactement pour ça qu'après trois sessions
// d'instrumentation on ne connaissait toujours la forme d'AUCUNE de ces
// réponses : on ne pouvait pas la capturer.
// Même dégât sur les compteurs : `label_url_trouve = 6` pour `label_envoye = 2`
// sans aucun compteur d'échec entre les deux — les deltas manquants n'ont jamais
// été flushés.
// ➡️ LE TAMPON VIT DÉSORMAIS DANS `chrome.storage.local` : local, gratuit, zéro
// égress, et il SURVIT à la mort du worker. Le throttle ne protège plus que
// l'écriture Supabase ; il ne peut plus rien perdre.
const DIAG_BUF = 'vrmDiagBuf';
let _diagChaine = Promise.resolve();   // sérialise les lecture-modification-écriture
let _diagFlushAt = 0;

// Toute modification du tampon passe par ici : deux appels concurrents feraient
// sinon un lire-modifier-écrire croisé et perdraient des incréments.
function majTampon(fn) {
  _diagChaine = _diagChaine.then(async () => {
    let buf = {};
    try { const s = await chrome.storage.local.get(DIAG_BUF); buf = (s && s[DIAG_BUF]) || {}; } catch (_) {}
    buf.n = buf.n || {}; buf.rates = buf.rates || {};
    fn(buf);
    try { await chrome.storage.local.set({ [DIAG_BUF]: buf }); } catch (_) {}
    // Le flux Supabase reste throttlé — mais s'il ne part pas, rien n'est perdu.
    if (Date.now() - _diagFlushAt < 60000) return;
    _diagFlushAt = Date.now();
    await viderTampon(buf);
  }).catch(() => {});
  return _diagChaine;
}

// Envoie le tampon en base et ne le vide QUE si l'écriture a abouti.
async function viderTampon(buf) {
  const aDesN = Object.keys(buf.n || {}).length, aDesR = Object.keys(buf.rates || {}).length;
  if (!aDesN && !aDesR) return;
  const rows = await sbGet('app_data?id=eq.panel_diag_capture&select=data');
  // ⚠️ LECTURE RATÉE ≠ LIGNE VIDE. `sbGet` rend `null` quand la base n'a pas
  //    répondu ; repartir de `{}` et réécrire la ligne ENTIÈRE efface tout le
  //    reste. On n'écrit pas.
  //    (et le tampon local n'est PAS vidé : les compteurs repartiront au prochain tour.)
  if (rows === null) return;
  const tout = (rows[0] && rows[0].data) || {};
  const n = { ...(tout.n || {}) };
  for (const k in buf.n) n[k] = (n[k] || 0) + buf.n[k];
  // ⚠️ ON RÉÉCRIT LA LIGNE ENTIÈRE : sans `...tout`, cette écriture EFFAÇAIT
  // `rates` — les échantillons de réponses ratées. Et comme les compteurs
  // partent à chaque capture (des centaines de fois par jour) alors qu'un
  // échantillon n'est posé que sur un échec, la preuve était détruite dans la
  // minute (constaté le 24 août).
  // ⚠️⚠️ LA VERSION QUI A VRAIMENT TOURNÉ — ET C'EST UNE MESURE, PAS UNE DÉDUCTION.
  // Le dossier le répète : « ne pas redéduire une version d'un compteur à zéro ».
  // Trois sessions de suite ont pourtant dû la DEVINER (« aucun `retrait_*` donc
  // antérieure à 5.45 »), et une de ces déductions était fausse. Le pont
  // (`bridge.js`) l'annonce, mais uniquement quand l'app est ouverte dans LE
  // Chrome où l'extension est installée : depuis son iPhone, ou depuis une
  // session comme celle-ci, personne ne peut la lire.
  // ⚠️ C'EST UN DIAGNOSTIC, PAS UNE CAPACITÉ. Cette version est celle de
  // l'extension qui a capté EN DERNIER, quelque part — jamais celle du
  // navigateur qui lit l'app. `extSait()` continue donc de n'écouter QUE le
  // pont : décider ce qu'on promet sur cette valeur-ci serait promettre à un
  // iPhone ce qu'un Chrome sait faire, c'est-à-dire le défaut le plus coûteux
  // du projet. `audit-coherence.cjs` l'interdit.
  const ver = (() => { try { return String(chrome.runtime.getManifest().version || ''); } catch (_) { return ''; } })();
  await supabaseUpsert('app_data', [{ id: 'panel_diag_capture', data: {
    ...tout, n, rates: { ...(tout.rates || {}), ...(buf.rates || {}) }, majAt: new Date().toISOString(),
    ...(ver ? { ver, verAt: new Date().toISOString() } : {}),
  } }], 'id');
  buf.n = {}; buf.rates = {};
  try { await chrome.storage.local.set({ [DIAG_BUF]: buf }); } catch (_) {}
}

// Un exemplaire par type, écrasé à chaque fois (pas d'accumulation).
async function echantillonRate(type, id, body) {
  const t = String(type || 'inconnu');
  return majTampon((buf) => {
    buf.rates[t] = {
      id: String(id == null ? '' : id).slice(0, 40),
      taille: body == null ? null : String(body).length,
      type: typeof body,
      tete: String(body == null ? '' : body).slice(0, 160),
      at: new Date().toISOString(),
    };
  });
}

// Les chemins de clés d'une réponse qui évoquent un boost (push_up, bump,
// spotlight, promotion…) — noms seulement, profondeur bornée.
function clesDeBoost(obj) {
  const out = [];
  const marche = (o, chemin, prof) => {
    if (!o || typeof o !== 'object' || prof > 4 || out.length >= 40) return;
    const cles = Array.isArray(o) ? (o.length ? ['0'] : []) : Object.keys(o);
    for (const k of cles) {
      const c = chemin ? chemin + '.' + k : k;
      if (/push_?up|bump|spotlight|promot|boost|vas_|visibil/i.test(k)) out.push(c);
      marche(o[k], c, prof + 1);
    }
  };
  try { marche(obj, '', 0); } catch (_) {}
  return out;
}
async function noterDiag(cle) {
  return majTampon((buf) => { buf.n[cle] = (buf.n[cle] || 0) + 1; });
}

// Le dressing qui arrive est-il au moins aussi riche que celui déjà en base ?
// Lecture ULTRA légère : on ne relit que le compteur `nItems` (un scalaire),
// jamais le payload — la leçon d'égress de §34 vaut aussi ici.
// ⚠️ LA MÊME RÈGLE, POUR TOUTE LISTE MOISSONNÉE. Elle ne protégeait que le
// dressing. Or les commandes et la boîte se font écraser exactement pareil :
// une réponse tronquée (page 1 seule, liste filtrée, session à moitié expirée)
// remplaçait une capture complète, et des ventes « disparaissaient » sans que
// personne ne touche à rien. Le compteur est lu EN SCALAIRE (`data->>nItems`),
// jamais le payload — la leçon d'égress de §34 vaut ici aussi.
const CLE_LISTE = { listings: 'items', orders_sold: 'my_orders', orders_purchased: 'my_orders', inbox: 'conversations' };
// ⚠️ CHAMPS STRUCTURELS — la dérive de forme QUI NE RENOMME PAS LA CLÉ DE LISTE.
// La clé de liste peut rester `items`/`my_orders` et un CHAMP INTÉRIEUR être
// renommé : c'est le vrai bug déjà vécu (§ `brand_title` vs `brand` — l'allègement
// gardait un champ qui n'existe plus, et TOUT le stock affichait « marque
// manquante » sans la moindre erreur). On vérifie donc que les champs qu'on LIT
// sont encore là.
// ⚠️ UNIQUEMENT des champs STRUCTURELS (présents quelle que soit la catégorie) :
// Julien veut que l'app serve aussi un reseller de livres ou de sacs — `brand` et
// `size` peuvent légitimement manquer à tout un stock, donc les exiger crierait au
// loup. `id`/`title`/`price`/`transaction_id` ne dépendent pas de ce qu'on vend.
const CHAMPS_CRITIQUES = {
  listings:         ['id', 'title', 'price'],
  orders_sold:      ['transaction_id', 'title'],
  orders_purchased: ['transaction_id', 'title'],
  inbox:            ['id'],
};
async function listePlusRiche(rowId, parsed, cle) {
  const n = ((parsed && parsed[cle]) || []).length;
  const total = Number(parsed && parsed.pagination && parsed.pagination.total_entries);
  if (isFinite(total) && total > 0 && n >= total) return true;   // capture complète : fait foi
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${rowId}&select=n:data->>nItems`, { headers: await sbHeaders() });
    if (!r.ok) return true;                       // on ne sait pas → on écrit
    const j = await r.json();
    const avant = Number(j[0] && j[0].n);
    if (!isFinite(avant)) return true;            // ancienne ligne sans compteur → on écrit
    return n >= avant;                            // jamais plus pauvre qu'avant
  } catch (_) { return true; }
}

async function dressingPlusRiche(rowId, parsed) {
  const n = ((parsed && parsed.items) || []).length;
  const total = Number(parsed && parsed.pagination && parsed.pagination.total_entries);
  if (isFinite(total) && total > 0 && n >= total) return true;   // capture complète : fait foi
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${rowId}&select=n:data->>nItems`, { headers: await sbHeaders() });
    if (!r.ok) return true;                       // on ne sait pas → on écrit
    const j = await r.json();
    const avant = Number(j[0] && j[0].n);
    if (!isFinite(avant)) return true;            // ancienne ligne sans compteur → on écrit
    return n >= avant;                            // jamais plus pauvre qu'avant
  } catch (_) { return true; }
}

// ── SENTINELLE DE FORME ──────────────────────────────────────────────────────
// ⚠️⚠️ LE DÉFAUT D'UNE MISE À JOUR DE VINTED/LBC/eBAY, et la raison d'être de
// cette passe (Julien : « même s'il y a des mises à jour, plus aucun problème
// dans la récupération »). Le jour où le site renomme la clé de liste
// (`my_orders` → `orders`, `items` → `catalog_items`…), `parsed[cle]` devient
// `undefined`, la capture tombe à 0, et `listePlusRiche` l'ignore EN SILENCE
// (ou l'écrit vide sur un compte neuf). Personne ne sait POURQUOI — c'est
// exactement « rien lu ne vaut pas rien », mais déclenché par une dérive de
// forme au lieu d'une panne.
// ⚠️ ON NE DEVINE PAS UN NOUVEAU PARSER. Le dossier l'interdit : pas de parser
// pour une forme jamais vue (ce serait promettre ce qu'on n'a pas mesuré). On
// rend la dérive BRUYANTE et MESURABLE : si la clé attendue est absente alors
// qu'une AUTRE clé de tête porte une liste NON VIDE, on note
// `forme_inconnue_<type>` + les NOMS des clés de tête (jamais leur contenu) et
// la clé-candidate. La prochaine passe aliasera sur une forme RÉELLEMENT
// mesurée, pas supposée.
// ⚠️ Une réponse légitimement VIDE (clé présente, tableau vide) ne déclenche
// RIEN — sinon la sentinelle crierait au loup sur chaque compte sans vente.
function verifFormeListe(type, parsed, id) {
  try {
    const cle = CLE_LISTE[type];
    if (!cle || !parsed || typeof parsed !== 'object') return;
    if (!Array.isArray(parsed) && Array.isArray(parsed[cle])) {
      // La clé de liste est là : la forme de tête est bonne. Reste à vérifier que
      // les CHAMPS qu'on lit à l'intérieur n'ont pas été renommés sous nos pieds.
      verifChampsListe(type, parsed[cle], id);
      return;
    }
    let cand = null, cles = [];
    if (Array.isArray(parsed)) {
      // Vinted a renvoyé un tableau NU au lieu de `{ <cle>: [...] }`.
      if (parsed.length > 0) cand = '(racine)';
    } else {
      cles = Object.keys(parsed);
      cand = cles.find(k => Array.isArray(parsed[k]) && parsed[k].length > 0) || null;
    }
    if (!cand) return;                            // aucune liste ailleurs : vide légitime, pas une dérive
    noterDiag(`forme_inconnue_${type}`);
    majTampon((buf) => {
      buf.rates[`forme_${type}`] = {
        id: String(id == null ? '' : id).slice(0, 40),
        attendu: cle,
        candidate: String(cand).slice(0, 40),
        cles: cles.slice(0, 20).map(k => String(k).slice(0, 40)),
        at: new Date().toISOString(),
      };
    });
  } catch (_) { /* une sentinelle ne casse jamais la capture */ }
}

// Dérive AU NIVEAU DU CHAMP (la clé de liste est bonne, un champ intérieur a
// changé de nom). Règle anti-fausse-alerte : on ne signale un champ que s'il est
// absent de TOUS les items d'une liste NON VIDE (0/N). Un champ manquant sur un
// item isolé (un brouillon sans prix, un vendeur sans marque) laisse les autres
// items le porter → pas d'alerte. Seul un RENOMMAGE fait disparaître le champ de
// tout le monde d'un coup — et c'est ça, et seulement ça, qu'on veut attraper.
// On ne devine aucun nouveau parser : on rend la dérive bruyante et mesurable
// (le NOM du champ perdu + les noms de clés d'un item), la passe suivante aliase.
function verifChampsListe(type, liste, id) {
  try {
    const champs = CHAMPS_CRITIQUES[type];
    if (!champs || !Array.isArray(liste) || liste.length === 0) return; // vide = légitime
    for (const c of champs) {
      const vu = liste.some(it => it && typeof it === 'object' && it[c] !== undefined && it[c] !== null);
      if (vu) continue;                              // au moins un item le porte : pas une dérive
      noterDiag(`forme_inconnue_champ_${type}`);
      majTampon((buf) => {
        buf.rates[`forme_champ_${type}`] = {
          id: String(id == null ? '' : id).slice(0, 40),
          champ: c,                                  // le champ disparu (un nom, pas une valeur)
          n: liste.length,
          cles: Object.keys(liste[0] || {}).slice(0, 20).map(k => String(k).slice(0, 40)),
          at: new Date().toISOString(),
        };
      });
      return;                                        // un champ perdu suffit à alerter
    }
  } catch (_) { /* une sentinelle ne casse jamais la capture */ }
}

// Dérive sur une capture OBJET (pas une liste) : une TRANSACTION, une
// CONVERSATION. Un renommage du champ qu'on lit casse EN SILENCE la preuve de
// vente, les dates de versement (« vendue → retirée ») ou la messagerie (5.135).
// ⚠️ Même prudence que la liste : on ne juge QUE si l'objet métier est clairement
// une vraie réponse (≥ 3 clés) mais que le champ LU a disparu. Test de PRÉSENCE
// de clé : un renommage fait disparaître `messages`/`status`, une valeur vide
// (`messages: []`, `status: 0`) garde la clé → aucune fausse alerte. Un objet
// maigre/raté n'est pas jugé (mieux vaut un blanc qu'un faux). On ne devine aucun
// parser : on note le NOM du champ perdu + les clés de l'objet, jamais une valeur.
const FORME_OBJET = {
  // la messagerie et le moteur d'offres lisent (p.conversation||p).messages
  conversation: { objet: (p) => (p.conversation || p), champ: 'messages', ok: (o) => Array.isArray(o.messages) },
  // la preuve de vente, les versements et « vendue → retirée » lisent p.transaction.status
  transaction:  { objet: (p) => p.transaction, champ: 'status', ok: (o) => ('status' in o) },
};
function verifFormeObjet(type, parsed, id) {
  try {
    const r = FORME_OBJET[type];
    if (!r || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const o = r.objet(parsed);
    if (!o || typeof o !== 'object' || Object.keys(o).length < 3) return; // objet maigre : pas un jugement de forme
    if (r.ok(o)) return;                                                   // champ présent : rien à signaler
    noterDiag(`forme_inconnue_champ_${type}`);
    majTampon((buf) => {
      buf.rates[`forme_champ_${type}`] = {
        id: String(id == null ? '' : id).slice(0, 40),
        champ: r.champ,
        cles: Object.keys(o).slice(0, 20).map(k => String(k).slice(0, 40)),
        at: new Date().toISOString(),
      };
    });
  } catch (_) { /* une sentinelle ne casse jamais la capture */ }
}

async function storeHarvest(domain, type, id, body) {
  noterDiag(`recu_${type || 'inconnu'}`);
  const uid = await activeAccountId(domain);
  if (!uid) { noterDiag(`abandon_sans_compte_${type || 'inconnu'}`); return; }
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (_) {
    noterDiag(`abandon_json_${type || 'inconnu'}`);
    // ⚠️ MESURER AVANT DE SUPPOSER. Le compteur a localisé la fuite des fiches
    // article (13 reçues, 13 rejetées, 0 rangée) mais pas sa CAUSE : corps vide,
    // HTML au lieu de JSON, flux déjà consommé… on ne peut pas trancher sans
    // voir. On garde donc un ÉCHANTILLON COURT (160 caractères de tête, la
    // longueur, l'URL) — assez pour reconnaître la forme, trop court pour
    // embarquer quoi que ce soit d'utile ou de lourd.
    echantillonRate(type, id, body);
    return;
  }
  // Le corps a parsé : la clé de liste attendue est-elle toujours là ? (sentinelle
  // de dérive de forme, sur le BRUT, avant tout allègement qui pourrait la masquer).
  verifFormeListe(type, parsed, id);
  verifFormeObjet(type, parsed, id);   // transaction/conversation : un champ lu renommé

  // Cle de ligne app_data selon le type de donnee.
  let rowId;
  if (type === 'conversation' && id) rowId = `harvest_${uid}_conv_${id}`;
  else if (type === 'transaction' && id) rowId = `harvest_${uid}_txn_${id}`;
  else if (type === 'item' && id) rowId = `harvest_${uid}_item_${id}`; // détail complet d'une annonce
  else if (type === 'complaint' && id) rowId = `harvest_${uid}_litige_${id}`; // un litige = une ligne
  // Une expédition = UNE ligne. Sans l'identifiant dans la clé, chaque colis
  // écraserait le précédent et on ne saurait jamais où aller chercher le bon.
  else if (type === 'shipment' && id) rowId = `harvest_${uid}_ship_${id}`;
  else rowId = `harvest_${uid}_${type}`;

  // ⚠️ Cette voie (capture PASSIVE) ecrit en direct, sans passer par
  // storeHarvestRow : l'allegement doit donc etre applique ICI AUSSI, sinon la
  // moisson faite en naviguant reste enorme (7 Mo d'annonces) alors que celle
  // faite activement est allegee. Meme fonction, un seul comportement.
  // ⚠️ On garde le brut SOUS LA MAIN pour le coffre : le dressing complet porte
  // TOUTES les URL de photos de chaque annonce, et l'allègement n'en laisse
  // qu'une. Or republier demande toutes les photos. La ligne moissonnée reste
  // légère (c'est elle qui repart à chaque lecture, §34), et les URL vont dans
  // le coffre — une ligne par annonce, lue seulement quand on republie.
  const brut = parsed;
  parsed = alleger(type, parsed);

  // ⚠️⚠️ ON NE REMPLACE JAMAIS UN DRESSING PAR UN PLUS PAUVRE.
  // C'est LE défaut qui vidait les annonces. Mesuré en base le 15 août :
  //   julatace35260 → 4 articles captés alors que Vinted en annonce 100
  //   julatace3535  → 20 captés sur 55 · shop_cancale → 96 sur 603
  // La capture passive écrivait **tout ce que la page chargeait**, y compris
  // une réponse partielle (une page 2, une liste filtrée, un aperçu de
  // profil) — et cette réponse partielle ÉCRASAIT la moisson complète. Le
  // compte tombait alors à « 0 annonce en ligne » dans l'app, alors que
  // l'extension avait bien fait son travail quelques minutes plus tôt.
  // Le garde-fou `plein()` ne rejetait que le VIDE, pas le partiel.
  // Règle : une réponse COMPLÈTE (items ≥ total annoncé par Vinted) fait
  // toujours foi ; sinon on n'écrase que si on apporte AU MOINS autant
  // d'articles qu'avant.
  if (CLE_LISTE[type] && !(await listePlusRiche(rowId, parsed, CLE_LISTE[type]))) {
    noterDiag(`ignore_partiel_${type}`);
    return;
  }
  // ⚠️ MÊME PIÈGE QUE LE DRESSING, SUR LE PORTE-MONNAIE. Le motif « billing » de
  // `inject.js` attrape aussi des réponses de tarification : l'une d'elles
  // (`minimum_price`) avait REMPLACÉ le vrai solde d'un compte — il n'y a qu'une
  // ligne `harvest_{uid}_billing`, donc la dernière réponse gagne. On n'écrit
  // que ce qui porte vraiment un montant de porte-monnaie.
  // Le RELEVÉ part dans sa propre ligne, AVANT le tri ci-dessous : une réponse
  // peut porter les mouvements sans porter de solde, et il n'y a qu'une ligne
  // `billing` par compte — c'est elle qui écrasait le relevé (§5.91).
  if (type === 'billing') { try { await storeReleve(uid, parsed, domain); } catch (_) {} }
  if (type === 'billing' && !estPorteMonnaie(parsed)) {
    noterDiag('ignore_billing_hors_sujet');
    // ⚠️ LES BOOSTS (3 octobre) : « les boosts, c'est à toi de les capter ».
    //    Mesuré : AUCUNE trace de boost en base — 71 réponses « billing »
    //    jetées sans échantillon. Avant de jeter, on relève la FORME d'une
    //    réponse qui parle de boost (les NOMS de clés seulement, jamais une
    //    valeur) : c'est ce qui dira si un montant se relie à une annonce par
    //    son identifiant. On mesure d'abord, on n'invente pas de rattachement.
    const cles = clesDeBoost(parsed);
    if (cles.length) { noterDiag('boost_vu'); echantillonRate('boost_forme', id, JSON.stringify(cles).slice(0, 600)); }
    return;
  }
  const data = { type, uid, domain, capturedAt: new Date().toISOString(), payload: parsed };
  if (CLE_LISTE[type]) data.nItems = ((parsed && parsed[CLE_LISTE[type]]) || []).length;
  data.resume = resumeCommandes(type, parsed) || undefined;   // même règle que la voie active
  const ecrit = await supabaseUpsert('app_data', [{ id: rowId, data }], 'id');
  // Dernière sortie muette possible : l'écriture elle-même. On la mesure aussi,
  // sinon « rien en base » resterait indiscernable de « jamais reçu ».
  noterDiag(`${ecrit === false ? 'ecriture_ratee' : 'ecrit'}_${type || 'inconnu'}`);
  noterFlux('vinted', ecrit !== false);
  // Des ventes viennent d'être rangées : l'app ouverte les relit TOUT DE SUITE
  // (« presque instantanément dès que je fais une vente », 2 octobre).
  if (ecrit !== false && type === 'orders_sold') notifierApp({ type: 'maj', quoi: 'ventes', uid: String(uid) });

  // Apprentissage passif des codes de statut d'offre (voir noterStatutsOffres).
  if (type === 'conversation') { try { await noterStatutsOffres(parsed); } catch (_) {} }
  // Une conversation vient d'arriver → si elle porte le message « ton colis est
  // arrivé », on en sort l'adresse du relais et le CODE de retrait tout de
  // suite. C'est le moment où on les a sous la main, et c'est la seule source
  // pour Vinted Go (aucun email ne les porte).
  if (type === 'conversation') {
    try { const r = retraitDeConversation(parsed); if (r) await noterRetrait(r); } catch (_) {}
  }

  // Une fiche d'annonce vient d'arriver → on la met au COFFRE (texte complet +
  // URL des photos). C'est le moment où on en sait le plus sur cette annonce.
  if (type === 'item' && id) {
    try {
      const f = (parsed && (parsed.item || parsed)) || {};
      await archiverAnnonce(uid, { id, url: f.url || '', photo: null }, f);
    } catch (_) {}
  }
  // Le dressing passe → on archive l'essentiel de chaque annonce en ligne.
  // ⚠️ EN UN SEUL ALLER-RETOUR : une boucle d'archivage unitaire ferait 200
  // lectures + 200 écritures à chaque chargement du dressing. C'est la faute
  // qui a crevé le quota d'égress en août (§34). Une lecture, une écriture.
  if (type === 'listings') {
    try { const tous = (brut && brut.items) || []; await archiverLot(uid, tous.filter(it => it && !it.is_closed && !it.is_hidden && !it.is_draft), tous); } catch (_) {}
  }

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
    // COMPTE VRM (identification du vendeur, depuis la fenêtre de l'extension).
    if (msg && msg.from === 'cancale-popup' && msg.action === 'authEtat') {
      authEtat().then(sendResponse); return true;
    }
    if (msg && msg.from === 'cancale-popup' && msg.action === 'authLogin') {
      authLogin(msg.email, msg.password).then(sendResponse); return true;
    }
    if (msg && msg.from === 'cancale-popup' && msg.action === 'authLogout') {
      authLogout().then(sendResponse); return true;
    }
    // LA PETITE CARTE (vrm-badge.js) : son état, et « ouvrir VRM ». Le site est
    // celui de l'ONGLET qui demande (sender.tab), jamais ce que dit le message.
    if (msg && msg.from === 'vrm-badge' && msg.action === 'etat') {
      etatSite(sender && sender.tab && sender.tab.url).then(sendResponse, () => sendResponse({ ok: false }));
      return true;
    }
    if (msg && (msg.from === 'vrm-badge' || msg.from === 'cancale-popup') && msg.action === 'ouvrirVRM') {
      // La carte de connexion vit dans un iframe de l'onglet : sender.tab est
      // l'onglet du site, c'est lui qui décide l'onglet de VRM.
      ouvrirVRMDepuis((sender && sender.tab && sender.tab.url) || '');
      sendResponse({ ok: true });
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
    // L'app demande l'état de la session côté extension (pour l'afficher).
    // Même contrôle d'origine : un site quelconque n'a pas à savoir sous quelle
    // adresse tu es connecté.
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'authEtat') {
      const src = (sender && sender.origin) || (sender && sender.url) || '';
      if (!/^https:\/\/(cancale-v67(-ten)?\.vercel\.app|(www\.)?vrm\.center)/.test(src)) {
        sendResponse({ ok: false, error: 'origine non autorisee' }); return true;
      }
      authEtat().then(sendResponse);
      return true;
    }
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'session') {
      const from = (sender && sender.origin) || (sender && sender.url) || '';
      const trusted = /^https:\/\/(cancale-v67(-ten)?\.vercel\.app|(www\.)?vrm\.center)/.test(from);
      if (!trusted) { sendResponse({ ok: false, error: 'origine non autorisee' }); return true; }
      (async () => {
        // ⚠️⚠️ L'APP TRANSMET SA SESSION, ET L'EXTENSION L'ADOPTE. Mesuré le
        //    2 octobre : quelqu'un s'est connecté à VRM avec une AUTRE adresse
        //    dans ce Chrome, et pendant quatre minutes les captures de
        //    `angeled92` (bordereaux compris) sont parties dans cette autre
        //    boutique — sans un mot nulle part. On garde la trace de la bascule
        //    pour que le petit écran de l'extension la DISE.
        try {
          const avant = await loadSession();
          const apres = msg.session || null;
          if (avant && apres && avant.user_id && apres.user_id && String(avant.user_id) !== String(apres.user_id)) {
            await chrome.storage.local.set({ vrmBascule: { de: avant.email || emailDuJwt(avant.access_token) || '', vers: apres.email || emailDuJwt(apres.access_token) || '', at: Date.now() } });
          }
        } catch (_) {}
        await saveSession(msg.session || null);
        sendResponse({ ok: true });
      })();
      return true;
    }

    // PONT APP -> EXTENSION : l'app VRM demande d'EXECUTER une action Vinted
    // depuis TON navigateur/IP.
    // ⚠️⚠️ MESURÉ LE 2 OCTOBRE : CE CANAL PASSAIT À CÔTÉ DE TOUS LES GARDE-FOUS
    //    DU §3. Il ne vérifiait que « /api/ » : ni l'origine (tous les autres
    //    messages du pont la vérifient), ni le compte connecté (`garde`), ni le
    //    plafond de 20/h, ni la méthode — un `DELETE /api/v2/items/{id}` (la
    //    suppression d'annonce que §3 refuse) serait parti. Son seul usage réel
    //    est la réponse à un message (`sendReply`, App.jsx).
    //    ⇒ Origine de l'app · LISTE BLANCHE (méthode + chemin) · garde STRICTE
    //    (le compte doit être celui connecté dans Chrome — « pas su » ne vaut
    //    pas « oui ») · plafond. Tout le reste est refusé, avec la raison.
    // ── L'APP INTERROGE ET COMMANDE (5.129) ────────────────────────────────
    if (msg && msg.from === 'vmr-bridge' && (msg.action === 'etat' || msg.action === 'cmd' || msg.action === 'cmd:statut')) {
      const src = (sender && sender.origin) || (sender && sender.url) || '';
      if (!ORIGINE_APP.test(src)) { sendResponse({ ok: false, code: 'origine', error: 'origine non autorisee' }); return true; }
      (async () => {
        try {
          if (msg.action === 'etat') { sendResponse(await etatPourApp()); return; }
          if (msg.action === 'cmd:statut') { const c = (await lireCmds())[String(msg.jobId || '')] || null; sendResponse({ ok: true, cmd: c }); return; }
          sendResponse(await executerCommande(msg));
        } catch (e) { sendResponse({ ok: false, accepte: false, code: 'erreur', raison: String(e && e.message || e) }); }
      })();
      return true;
    }
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'exec') {
      executerPourApp(msg, sender).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
      return true; // reponse asynchrone
    }
    // PONT APP -> EXTENSION : la photo d'une paire, pour l'imprimer sur un reçu.
    // ⚠️ POURQUOI PASSER PAR L'EXTENSION : le CDN de Vinted ne renvoie AUCUN
    // en-tête CORS (vérifié : pas d'`access-control-allow-origin`). Une page web
    // peut AFFICHER l'image mais pas en LIRE les octets — et la charger dans un
    // canvas le « tainte », donc l'export devient impossible (§4.93). Le service
    // worker, lui, a les permissions d'hôte. Sans extension : pas de photo sur
    // le reçu, et c'est tout — rien ne casse.
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'pdfLbc') {
      (async () => {
        try {
          const src = (sender && sender.origin) || (sender && sender.url) || '';
          if (!ORIGINE_APP.test(src)) { sendResponse({ ok: false, error: 'origine non autorisee' }); return; }
          sendResponse(await pdfBordereauLbc(msg.url));
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'photo') {
      (async () => {
        try {
          // Seulement le CDN d'images de Vinted : ce pont ne doit pas devenir un
          // téléchargeur d'URL arbitraire pour n'importe quelle page.
          if (!/^https:\/\/[\w.-]*vinted\.net\//i.test(String(msg.url || ''))) { sendResponse({ ok: false, error: 'url non autorisée' }); return; }
          const r = await photoBytes(msg.url);
          sendResponse(r);
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    // CE QUI RESTE SUR VINTED (vinted-capture.js, 5.130) : la date, la
    // description et les photos LUES sur la page d'une annonce. Le panneau
    // (bouton orange, 14 onglets) est retiré — tout se pilote dans l'app.
    if (msg && msg.from === 'cancale-vcapture') {
      (async () => {
        try {
          if (msg.action === 'saveDate' && msg.id && msg.ts) { await saveListingDate(msg.id, msg.ts, msg.text); sendResponse({ ok: true }); return; }
          if (msg.action === 'saveDetail' && msg.id && msg.detail) { await saveItemDetail(msg.id, msg.detail); sendResponse({ ok: true }); return; }
          sendResponse({ ok: false, error: 'action inconnue' });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    // PONT LEBONCOIN : le script lbc.js (sur leboncoin.fr) demande la liste des
    // annonces Vinted prêtes à publier, ou marque une annonce comme publiée.
    if (msg && msg.from === 'cancale-ebay') {
      (async () => {
        try {
          // Les OCTETS des photos, pour les ATTACHER au formulaire eBay au lieu
          // de les déposer sur son disque. Le fond les lit parce que le CDN de
          // Vinted ne renvoie aucun en-tête CORS — la page seule ne peut pas.
          if (msg.action === 'photoBytes' && Array.isArray(msg.urls)) { const ph = await photosPourEbay(msg.urls, msg.max); sendResponse({ ok: true, photos: ph }); return; }
          if (msg.action === 'setPending') { await chrome.storage.local.set({ vrmPendingEbay: msg.ad ? { ad: msg.ad, at: Date.now() } : null }); sendResponse({ ok: true }); return; }
          if (msg.action === 'getPending') {
            const g = await chrome.storage.local.get('vrmPendingEbay');
            const p = g && g.vrmPendingEbay;
            sendResponse({ ok: true, ad: (p && p.at && (Date.now() - p.at) < 30 * 60 * 1000) ? p.ad : null }); return;
          }
          // ⚠️ JE N'AI JAMAIS VU LE FORMULAIRE eBAY. Plutôt que de deviner ses
          //    champs, l'extension me les RAPPORTE depuis son navigateur : c'est
          //    la méthode du projet (mesurer d'abord) appliquée à ce que je ne
          //    peux pas mesurer moi-même. Aucun contenu, juste des noms de champs.
          if (msg.action === 'ebayForm' && Array.isArray(msg.fields)) {
            // ⚠️ LA MISE EN VENTE eBAY SE FAIT AUSSI EN ÉTAPES, et cette ligne
            //    était ÉCRASÉE à chaque passage : la dernière étape vue effaçait
            //    la seule que j'avais. C'est le défaut corrigé pour `lbc_recon`
            //    le 13 septembre, resté entier ici. On garde TOUTES les étapes,
            //    par signature — noms de champs et libellés d'options seulement,
            //    jamais un contenu saisi.
            const prev = await sbGet('app_data?id=eq.panel_ebay_form&select=data');
            if (prev === null) { sendResponse({ ok: false, error: 'lecture' }); return; }   // « pas su » ≠ « rien »
            const cur = (prev && prev[0] && prev[0].data) || {};
            const etapes = Object.assign({}, cur.etapes || {});
            etapes[String(msg.etape || msg.url || Object.keys(etapes).length)] =
              { url: msg.url, fields: msg.fields.slice(0, 150), selects: (msg.selects || []).slice(0, 30), fichiers: msg.fichiers || 0, at: new Date().toISOString() };
            await supabaseUpsert('app_data', [{ id: 'panel_ebay_form', data: { ...cur, url: msg.url, fields: msg.fields.slice(0, 150), etapes, at: new Date().toISOString() } }], 'id');
            sendResponse({ ok: true }); return;
          }
          sendResponse({ ok: false, error: 'action inconnue' });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
      })();
      return true;
    }
    if (msg && msg.from === 'cancale-lbc') {
      (async () => {
        try {
          // Les OCTETS des photos, pour les ATTACHER au formulaire au lieu de
          // les télécharger sur son disque. Le fond les lit parce que le CDN de
          // Vinted ne renvoie aucun en-tête CORS : la page seule ne peut pas.
          if (msg.action === 'photoBytes' && Array.isArray(msg.urls)) { const ph = await photosEnOctets(msg.urls, msg.max); sendResponse({ ok: true, photos: ph }); return; }
          // Ce que la page Leboncoin porte vraiment. Aucune donnée d'annonce :
          // juste de quoi savoir si la capture a pu lire quelque chose. Sans ça,
          // « 0 annonce » et « je n'ai rien pu lire » sont le même silence.
          if (msg.action === 'lbcDiag') {
            await storeLbcRecon({ capture: { source: msg.source, vues: msg.vues, compte: !!msg.compte, url: msg.url, a_next_data: !!msg.a_next_data, a_next_f: !!msg.a_next_f, at: new Date().toISOString() } });
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcForm' && Array.isArray(msg.fields)) {
            // ⚠️ UNE SEULE ÉTAPE NE SUFFIT PAS : le dépôt Leboncoin en compte
            //    plusieurs, et je n'ai jamais vu que la première. On les garde
            //    TOUTES (par signature), sinon la dernière écrase la seule que
            //    j'avais — et je ne saurai jamais où vivent la catégorie, l'état
            //    ou le champ photo. Noms de champs et libellés d'options
            //    uniquement : aucun contenu saisi.
            const prev = await sbGet('app_data?id=eq.lbc_recon&select=data');
            if (prev !== null) {
              const cur = (prev && prev[0] && prev[0].data) || {};
              const etapes = Object.assign({}, cur.etapes || {});
              // ⚠️⚠️ « C'EST DIFFÉRENT POUR CHAQUE ANNONCE » (Julien, 17 sept.) :
              //    les étapes du dépôt dépendent de la CATÉGORIE. Une clé qui ne
              //    porte que la structure ferait passer le formulaire d'un livre
              //    pour celui d'une paire de chaussures. La catégorie entre donc
              //    dans la clé, et l'étape garde son DÉPÔT et son RANG — sans
              //    quoi on ne sait ni quelle étape suit laquelle, ni laquelle
              //    appartient à quelle annonce.
              const cle = [String(msg.categorie || 'sans-categorie').slice(0, 40),
                String(msg.etape || msg.url || Object.keys(etapes).length)].join(' :: ');
              etapes[cle] = { url: msg.url, fields: msg.fields, selects: msg.selects || [],
                livraison: msg.livraison || [], fichiers: msg.fichiers || 0,
                fichiersMultiple: !!msg.fichiersMultiple, categorie: String(msg.categorie || ''),
                depot: String(msg.depot || ''), ordre: Number(msg.ordre) || 0,
                ver: String(msg.ver || ''),
                at: new Date().toISOString() };
              // Borné : on garde les plus récentes, jamais une ligne qui enfle.
              const cles = Object.keys(etapes);
              if (cles.length > 40) {
                const gardees = cles.sort((x, y) => Date.parse((etapes[y] || {}).at || 0) - Date.parse((etapes[x] || {}).at || 0)).slice(0, 40);
                for (const k of cles) if (!gardees.includes(k)) delete etapes[k];
              }
              await storeLbcRecon({ form: { url: msg.url, fields: msg.fields, at: new Date().toISOString() }, etapes });
            }
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'markPosted' && msg.id) {
            await markLbcPosted(msg.id);
            // Publiée depuis une commande de l'app : l'app le sait tout de suite.
            const jid = 'lbc:' + String(msg.id);
            if ((await lireCmds())[jid]) await majCmd(jid, { etape: 'fait' });
            notifierApp({ type: 'maj', quoi: 'lbc' });
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcCapture') {
            if (Array.isArray(msg.listings) && msg.listings.length) await storeLbcListings(msg.url, msg.listings);
            if (msg.account && msg.account.id) await storeLbcAccount(msg.account);
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcRaw' && msg.body) { await handleLbcRaw(msg.url, msg.body); sendResponse({ ok: true }); return; }
          // LA VENTE LEBONCOIN : détail transaction / commande / livraison. On
          // range un échantillon capé par famille d'endpoint, pour voir la FORME
          // (où vivent l'état, l'acheteur, le bordereau) — sans rien analyser
          // encore. C'est une lecture de SES ventes (§3), rangée dans lbc_recon.
          // On garde une place par famille (pas par id) : la 100e vente n'écrase
          // pas la carte, elle la rafraîchit. Jamais dans une fixture (§6).
          if (msg.action === 'lbcVente' && msg.body) { const corps = String(msg.body).slice(0, 200000); await storeLbcVente(msg.url, corps, !!msg.coupe); try { await rangerLbcVentes(extraireVentesLbc(msg.url, corps)); } catch (_) {} sendResponse({ ok: true }); return; }
          // Le catalogue Leboncoin (codes de catégorie/marque/taille/état) : sa
          // propre ligne, une place par endpoint, rien ne peut l'évincer.
          if (msg.action === 'lbcCatalogue' && msg.body) { await storeLbcCatalogue(msg.url, String(msg.body).slice(0, LBC_CATALOGUE_MAX), !!msg.coupe || String(msg.body).length > LBC_CATALOGUE_MAX); sendResponse({ ok: true }); return; }
          // ⚠️ LA FORME DE CE QUI PART VERS LEBONCOIN — chemins de clés et types,
          //    JAMAIS les valeurs (son titre, sa description, son prix ne
          //    quittent pas sa page). C'est ce qui dit quels champs le dépôt
          //    attend vraiment, catégorie par catégorie.
          if (msg.action === 'lbcEnvoi' && Array.isArray(msg.cles)) {
            const prev = await sbGet('app_data?id=eq.lbc_recon&select=data');
            if (prev !== null) {
              const cur = (prev && prev[0] && prev[0].data) || {};
              const envois = Object.assign({}, cur.envois || {});
              const cle = (String(msg.methode || '') + ' ' + String(msg.url || '').replace(/^https?:\/\//, '').split('?')[0]).trim().slice(0, 110);
              envois[cle] = { at: new Date().toISOString(), ver: EXT_VERSION, methode: String(msg.methode || ''), cles: msg.cles.slice(0, 400) };
              const noms = Object.keys(envois);
              if (noms.length > 60) { const g = noms.sort((x, y) => Date.parse((envois[y] || {}).at || 0) - Date.parse((envois[x] || {}).at || 0)).slice(0, 60); for (const n of noms) if (!g.includes(n)) delete envois[n]; }
              await storeLbcRecon({ envois });
            }
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcPaths' && Array.isArray(msg.paths)) { await storeLbcRecon({ paths: msg.paths, url: msg.url }); sendResponse({ ok: true }); return; }
          // La carte complète de Leboncoin : structure (chemins de clés) d'une
          // réponse, par endpoint. Jamais de valeur (§ « capte tout »).
          if (msg.action === 'lbcSchema' && msg.endpoint && Array.isArray(msg.cles)) { await storeLbcRecon({ schemaOne: { endpoint: msg.endpoint, cles: msg.cles } }); sendResponse({ ok: true }); return; }
          // SONDE PHOTOS (lecture seule, aucun contenu) : à quoi ressemblent les
          // vignettes acceptées + combien l'extension a posé. Sert à MESURER la
          // vraie mécanique de l'uploader Leboncoin (blob ? http ? multiple ?),
          // qu'on ne voit pas d'ici (403). Rangé pour la prochaine passe.
          if (msg.action === 'photoDiag' && msg.diag) { await storeLbcRecon({ photodiag: Object.assign({ ver: EXT_VERSION }, msg.diag) }); sendResponse({ ok: true }); return; }
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
    storeSeenUrls(domain, msg.paths, msg.reponses);
  }
});

// ── DIAGNOSTIC : apprendre le code « offre EN ATTENTE » ─────────────────────
// On sait lire une offre (`transaction_id`, `offer_request_id`, prix) mais PAS
// reconnaître à coup sûr celle qui est encore ouverte : sur les 40 conversations
// captées, les 21 offres étaient toutes en `status` 20 (acceptée) ou 30
// (refusée). Tant que le code « en attente » est inconnu, on ne peut rien
// décider automatiquement sans risquer de vendre une paire à n'importe quel prix.
// Alors on APPREND, passivement : chaque fois qu'une conversation passe, on note
// les couples status → libellé rencontrés. Zéro requête, zéro action.
// Dès qu'une offre réellement en attente sera vue, son code sera dans cette ligne.
async function noterStatutsOffres(parsed) {
  try {
    const c = (parsed && (parsed.conversation || parsed)) || {};
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    const vus = {};
    for (const m of msgs) {
      if (!m || m.entity_type !== 'offer_request_message') continue;
      const e = m.entity || {};
      if (e.status == null) continue;
      vus[String(e.status)] = String(e.status_title || '').trim() || '(sans libellé)';
    }
    if (!Object.keys(vus).length) return;
    const rows = await sbGet('app_data?id=eq.panel_offer_statuts&select=data');
      // ⚠️ LECTURE RATÉE ≠ LIGNE VIDE. `sbGet` rend `null` quand la base n'a pas
    //    répondu ; repartir de `{}` et réécrire la ligne ENTIÈRE efface tout le
    //    reste. On n'écrit pas.
    if (rows === null) return;
    const cur = (rows[0] && rows[0].data) || {};
    const next = { ...(cur.statuts || {}), ...vus };
    // Rien de nouveau → on n'écrit pas (inutile de repousser la même ligne).
    if (JSON.stringify(next) === JSON.stringify(cur.statuts || {})) return;
    await supabaseUpsert('app_data', [{ id: 'panel_offer_statuts', data: { statuts: next, majAt: new Date().toISOString() } }], 'id');
  } catch (_) { /* purement diagnostique : ne doit jamais gêner la capture */ }
}

// Diagnostic : liste des CHEMINS d'API que le site appelle réellement (aucun
// contenu, aucun paramètre). Sert à repérer tout de suite quand Vinted déplace
// un endpoint — c'est ce qui avait rendu la moisson muette pendant 18 jours.
async function storeSeenUrls(domain, paths, reponses) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  // ⚠️⚠️ ÇA ÉCRASAIT LA LISTE À CHAQUE VISITE. Une page ne fait qu'une poignée
  //    d'appels : la visite suivante remplaçait donc tout ce qu'on avait appris
  //    ailleurs. Mesuré le 19 septembre — 41 chemins distincts en tout sur
  //    11 comptes, alors que chaque compte en voit une dizaine à chaque passage.
  //    Pour un diagnostic dont le but est justement d'attraper UN endpoint vu
  //    UNE fois (le bouton d'export des données, inaccessible depuis son compte
  //    pro bloqué), écraser était fatal.
  // ⚠️ Et « rien lu » ne vaut pas « rien » : lecture ratée ⇒ on n'écrit pas,
  //    sinon on efface ce qu'on avait (la leçon des lire-fusionner-réécrire).
  const rows = await sbGet(`app_data?id=eq.harvest_${uid}_seen_urls&select=data`);
  if (rows === null) return;
  const cur = (rows[0] && rows[0].data) || {};
  const tous = new Set([...(Array.isArray(cur.paths) ? cur.paths : []), ...paths]);
  const rep = Object.assign({}, cur.reponses || {}, reponses || {});
  // Bornes par construction : un diagnostic ne doit jamais grossir sans fin.
  const repBorne = {};
  for (const k of Object.keys(rep).slice(0, 400)) repBorne[k] = rep[k];
  const data = { uid, paths: Array.from(tous).slice(0, 600), reponses: repBorne,
    capturedAt: new Date().toISOString(), ver: EXT_VERSION };
  // Rien de neuf → on ne repousse pas la même ligne.
  if (JSON.stringify(data.paths) === JSON.stringify(cur.paths || [])
      && JSON.stringify(repBorne) === JSON.stringify(cur.reponses || {})) return;
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_seen_urls`, data }], 'id');
}

// Range une requete d'ECRITURE observee (baisser prix, message...) dans une
// ligne dediee, une par type d'action (regroupee par chemin). Pure observation :
// sert a l'app pour reproduire ensuite l'action exacte en 1 clic, sans deviner.
// ⚠️⚠️ CE QUI NE DOIT JAMAIS ÊTRE RANGÉ EN CLAIR (mesuré le 30 sept.) : la base
//    contenait, recopiés tels quels, un IBAN (`bank_accounts`), un scan de
//    passeport en base64 (`payments/identity`), des jetons de carte bancaire,
//    des codes de double authentification (`user_2fa`) et des changements
//    d'email — dans une table encore lisible avec la clé publique. Aucune de
//    ces requêtes ne sert à reproduire une action de vente. On garde leur
//    CHEMIN et leur méthode (diagnostic), jamais leur contenu. Et une requête
//    vers un autre site (publicité, mesure d'audience) n'est pas rangée du tout.
const WREQ_SENSIBLE = /bank_account|credit_card|payments|payment|payout|user_2fa|save_email|email_change|personal_data|purchases\/|checkout|identity|password|dsa\/|help_center|complaint|refund|user_addresses/i;
async function storeWriteReq(domain, method, url, body) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  let path = url;
  let hote = '';
  try { const U = new URL(url, `https://${domain}`); path = U.pathname; hote = U.hostname; } catch (_) {}
  // Une URL relative part forcément vers Vinted ; une absolue, on vérifie l'hôte.
  if (/^https?:/i.test(String(url)) && !/(^|\.)vinted\.[a-z.]+$/i.test(hote)) return;
  if (WREQ_SENSIBLE.test(path)) body = '[retiré : donnée personnelle ou bancaire]';
  // Cle courte par type d'action : on remplace les ids numeriques pour regrouper
  // (ex: /api/v2/items/123 et /api/v2/items/456 -> meme cle).
  const key = (path.replace(/\/\d+/g, '/_id').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60)) || 'root';
  const data = { uid, method, url: WREQ_SENSIBLE.test(path) ? path : url, path, body: body || '', capturedAt: new Date().toISOString() };
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_wreq_${key}`, data }], 'id');
}

// ⚠️ LE TÉLÉCHARGEMENT MANUEL NE POUVAIT PAS ÊTRE RELIÉ QUAND IL Y EN A DEUX.
// `storeLabel` n'attribue le PDF que s'il n'existe QU'UN seul colis possible
// (règle juste : on ne devine jamais, §24). Mais mesuré le 2 septembre :
// `tomj606` a EXACTEMENT DEUX ventes qui attendent l'envoi et dont aucun
// bordereau n'a pu être récupéré — donc même en les téléchargeant à la main,
// aucun des deux n'était relié à sa vente, et le second écrasait le premier
// dans `label_latest`. C'est précisément le compte dont Julien se plaint.
// ➡️ Quand c'est NOUS qui l'envoyons télécharger UNE vente précise (le bouton
// « Télécharger sur Vinted » du panneau), on sait laquelle : on pose un rendez-
// vous. Ce n'est pas une devinette — c'est l'identité de la vente qu'il vient
// d'ouvrir, sur SON clic. Court (15 min) et à usage unique.
const BORD_ATTENDU = 'vrmBordAttendu';
const BORD_ATTENDU_MS = 15 * 60 * 1000;

async function attendreBordereau(uid, tx) {
  if (!uid || !tx) return { ok: false };
  try { await chrome.storage.local.set({ [BORD_ATTENDU]: { uid: String(uid), tx: String(tx), at: Date.now() } }); } catch (_) {}
  return { ok: true };
}

// Le rendez-vous vaut-il pour ce compte, et est-il encore frais ? Usage unique :
// on l'efface en le consommant, pour qu'un PDF suivant ne reprenne pas la même
// identité.
async function bordereauAttendu(uid) {
  try {
    const s = await chrome.storage.local.get(BORD_ATTENDU);
    const a = s && s[BORD_ATTENDU];
    if (!a || String(a.uid) !== String(uid)) return null;
    if (Date.now() - (a.at || 0) > BORD_ATTENDU_MS) return null;
    await chrome.storage.local.remove(BORD_ATTENDU);
    return String(a.tx);
  } catch (_) { return null; }
}

// Range le dernier bordereau (PDF) telecharge, pour que l'app le tamponne.
async function storeLabel(domain, url, b64) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  // À quel colis appartient ce PDF ? Le téléchargement ne le dit pas. On ne
  // DEVINE pas (§24) : soit on l'a envoyé télécharger CETTE vente-là (rendez-
  // vous ci-dessus, identité certaine), soit il n'y a QU'UN SEUL colis possible
  // pour ce compte — là ce n'est plus une supposition, c'est le seul candidat.
  let tx = await bordereauAttendu(uid);
  if (!tx) try {
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_orders_sold&select=data`);
    const ventes = (rows && rows[0] && rows[0].data && rows[0].data.payload && rows[0].data.payload.my_orders) || [];
    const dejaCapte = new Set();
    const cur = await sbGet(`app_data?id=like.harvest_${uid}_label_*&select=tx:meta->>tx`);
    for (const r of (cur || [])) if (r && r.tx) dejaCapte.add(String(r.tx));
    const cands = ventes.filter(o => o && o.transaction_id != null && AWAITING_SHIP(o.status) && !dejaCapte.has(String(o.transaction_id)));
    if (cands.length === 1) tx = String(cands[0].transaction_id);
  } catch (_) { /* sans certitude, le PDF reste simplement « le dernier capté » */ }
  const data = { uid, url, capturedAt: new Date().toISOString(), pdfB64: b64, ...(tx ? { tx } : {}) };
  const lignes = [{ id: `harvest_${uid}_label_latest`, data }];
  if (tx) lignes.unshift({ id: `harvest_${uid}_label_${tx}`, data });
  await supabaseUpsert('app_data', lignes, 'id');
  logActivity(tx ? '📎 Bordereau capté et relié à sa vente' : '📄 Bordereau capté (prêt à imprimer)');
}
// ══════════════════════════════════════════════════════════════════════════════
// CAPTURE DU BORDEREAU — PAR LES TÉLÉCHARGEMENTS DU NAVIGATEUR
// ══════════════════════════════════════════════════════════════════════════════
// ⚠️ POURQUOI ÇA N'A JAMAIS MARCHÉ (vérifié en base : `harvest_*_label_latest`
// = ZÉRO ligne, sur tous les comptes) : `inject.js` n'observe que `fetch` et
// `XMLHttpRequest`. Or Vinted sert le bordereau par un LIEN DIRECT — le
// navigateur le télécharge lui-même, sans passer par l'un ni par l'autre. La
// capture ne pouvait donc rien voir, et l'URL du label n'apparaît nulle part
// ailleurs (ni dans les transactions captées, ni dans `seen_urls`).
//
// La bonne porte, c'est `chrome.downloads` (permission déjà accordée, jamais
// utilisée jusqu'ici) : elle voit TOUS les téléchargements, y compris ceux qui
// ne passent pas par JavaScript. Pure observation : on ne déclenche rien.
//
// Double bénéfice : ça range enfin le PDF, ET ça APPREND l'URL du bordereau —
// la pièce qui manquait pour aller le chercher soi-même plus tard.
const LABEL_VU = 'panel_label_urls';   // ce qu'on a appris des URL de bordereaux

async function noterUrlLabel(url, ok) {
  try {
    let hote = '', chemin = '';
    try { const u = new URL(url); hote = u.hostname; chemin = u.pathname.replace(/\/\d{4,}/g, '/_id'); } catch (_) { return; }
    const rows = await sbGet(`app_data?id=eq.${LABEL_VU}&select=data`);
    const cur = (rows && rows[0] && rows[0].data) || {};
    const vus = cur.vus || {};
    const cle = `${hote}${chemin}`;
    if (vus[cle] && vus[cle].ok === ok) return;              // rien de nouveau
    vus[cle] = { ok, exemple: String(url).slice(0, 300), vuAt: new Date().toISOString() };
    await supabaseUpsert('app_data', [{ id: LABEL_VU, data: { vus, majAt: new Date().toISOString() } }], 'id');
  } catch (_) {}
}

// Un téléchargement vient de démarrer. Est-ce un bordereau Vinted ?
async function capterTelechargement(item) {
  try {
    const url = String((item && (item.finalUrl || item.url)) || '');
    if (!/^https:/i.test(url)) return;
    const nom = String((item && item.filename) || '');
    const mime = String((item && item.mime) || '');
    const estPdf = /application\/pdf/i.test(mime) || /\.pdf(\?|$)/i.test(url) || /\.pdf$/i.test(nom);
    if (!estPdf) return;
    // Un PDF téléchargé depuis Vinted (ou par un lien venant de Vinted). Le
    // label peut être hébergé par le transporteur : on accepte aussi un
    // référent Vinted, sinon on raterait Mondial Relay / Chronopost.
    const ref = String((item && item.referrer) || '');
    const deVinted = /vinted\.(fr|com|it|de|net)/i.test(url) || /vinted\.(fr|com|it|de)/i.test(ref);
    if (!deVinted) return;
    // Un reçu / une facture n'est pas un bordereau (même distinction qu'inject.js).
    const estRecu = /invoice|receipt|facture|re[çc]u|billing/i.test(url);
    let b64 = null;
    try {
      // On relit le fichier depuis son URL, avec la session du navigateur.
      // Si le lien est à usage unique ou hors permissions, on n'insiste pas :
      // l'URL apprise sert quand même (c'est elle qui manquait).
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength && buf.byteLength < 4000000) {
          const bytes = new Uint8Array(buf);
          let bin = '';
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          b64 = btoa(bin);
        }
      }
    } catch (_) { /* lien à usage unique, CORS, hors permissions… */ }
    await noterUrlLabel(url, !!b64);
    if (!b64) { logActivity('📄 Bordereau vu (URL apprise, PDF non relu)'); return; }
    if (estRecu) await storeReceipt('www.vinted.fr', url, b64);
    else await storeLabel('www.vinted.fr', url, b64);
  } catch (_) {}
}

try {
  if (chrome.downloads && chrome.downloads.onCreated) {
    chrome.downloads.onCreated.addListener((item) => { capterTelechargement(item); });
  }
} catch (_) {}

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
// ⚠️ VINTED ENVOIE `brand`, `size`, `status` — PAS `brand_title`/`size_title`.
// Vérifié sur les 112 annonces en ligne de la vraie base : `brand_title` et
// `size_title` sont absents des 112, `brand`/`size` présents partout. On ne
// gardait donc que des champs qui n'existent pas : chaque annonce allégée
// perdait sa marque ET sa taille, et l'app affichait « marque manquante ·
// taille manquante » sur tout le stock (note d'annonce faussée, conseils faux).
// Les deux orthographes sont conservées : Vinted a déjà renommé des champs.
// ⚠️ `item_closing_action` : Vinted NE SUPPRIME PAS une annonce vendue, il la
// ferme en marquant POURQUOI — 'sold' quand elle est partie (vérifié sur les
// données réelles). C'est donc Vinted lui-même qui dit « cette annonce-là est
// vendue », par IDENTIFIANT : l'identité qui manquait pour ne plus jamais
// deviner par titre. Sans ce champ, `is_closed` mélange « vendue » et « retirée
// par moi » — 235 articles fermés en base, indiscernables.
// Il arrivait bien dans la réponse Vinted mais l'allègement le JETAIT.
const CHAMPS_ARTICLE = ['id','title','price','url','brand','size','brand_title','size_title','status',
  'view_count','favourite_count','favourites_count','created_at_ts',
  'is_closed','is_hidden','is_draft','item_closing_action','is_reserved',
  // Boost en cours sur l'annonce (3 octobre) : Vinted l'envoie déjà dans le
  // dressing (prouvé sur 3 articles non allégés), l'allègement le jetait.
  'promoted','can_push_up'];

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
  // ⚠️ COMBIEN de photos, pas lesquelles. L'allègement (§23) ne garde qu'une
  // photo par annonce — l'app en déduisait « 1 seule photo » pour TOUTES les
  // annonces (mapWardrobeItem comptait it.photos, absent), retirait 15 points
  // à chacune dans la note d'annonce et conseillait « ajoute des photos » à
  // des annonces qui en ont six. Un entier par article coûte trois octets et
  // rend le diagnostic honnête. Les URL, elles, vont au coffre (archiverLot).
  if (Array.isArray(it.photos)) o.nPhotos = it.photos.length;
  else if (o.photo) o.nPhotos = 1;
  // ⚠️ MÊME PROBLÈME QUE LES PHOTOS, POUR LA DESCRIPTION (mesuré le 23 août).
  // L'allègement ne garde pas `description` (elle pèse), donc `descLen` était
  // TOUJOURS nul dans l'app : la note d'annonce ne pouvait jamais juger la
  // description, et l'atelier « Republier » ne conseillait jamais dessus — sur
  // les 25 annonces en ligne, aucune n'était évaluée sur ce critère.
  // Un entier coûte trois octets et rend le diagnostic possible. Le TEXTE, lui,
  // va au coffre (archiverLot) — c'est là qu'on le recopie pour republier.
  if (typeof it.description === 'string') o.descLen = it.description.trim().length;
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

// ══════════════════════════════════════════════════════════════════════════════
// RÉSUMÉ DES COMMANDES — écrit à la capture, lu par le widget iPhone
// ══════════════════════════════════════════════════════════════════════════════
// ⚠️ ÉGRESS (la faute d'août, §34, dans sa dernière poche). `api/widget.js`
// lisait les commandes en `select=data` : mesuré aujourd'hui, **791 Ko à CHAQUE
// rafraîchissement** du widget (609 Ko de ventes + 181 Ko d'achats). Un widget
// d'écran d'accueil se rafraîchit tout seul, jour et nuit — c'est des gigas par
// mois pour afficher deux nombres.
// On écrit donc les deux nombres AU MOMENT DE LA CAPTURE, dans la ligne
// elle-même : le widget les lit en scalaires (~1 Ko) et garde sa propriété
// essentielle — il se met à jour même app fermée, puisque c'est l'extension qui
// capture. ⚠️ Les deux tests de statut sont la COPIE EXACTE de ceux de l'app
// (`isAwaitingShipStatus` / `isAtRelayStatus`) : deux règles différentes pour la
// même notion, c'est la garantie de deux chiffres qui se contredisent.
// Un porte-monnaie porte un montant : `{main,escrow}` (solde) ou `{balance}`
// (versements). Tout le reste qui passe par le motif « billing » n'en est pas un.
// ⚠️ Il FAUT un montant réel. L'ancienne version finissait par `|| p.main ||
// p.escrow` : un objet vide passait, et une capture sans montant remplaçait le
// vrai solde (il n'y a qu'une ligne par compte, la dernière gagne). Mesuré en
// base : 4 comptes sur 8 avaient un `payload: {}` écrit par-dessus leur solde,
// donc de l'argent en attente invisible dans l'app.
// `pending_balance` compte aussi : c'est l'« en attente » de la forme versement.
const MONTANTS_PM = ['main', 'escrow', 'balance', 'pending_balance'];
const estPorteMonnaie = (p) => !!(p && typeof p === 'object' && MONTANTS_PM.some(k => p[k] && p[k].amount != null));

// ══════════════════════════════════════════════════════════════════════════════
// LE RELEVÉ DU PORTE-MONNAIE : l'argent réellement crédité, DATÉ
// ══════════════════════════════════════════════════════════════════════════════
// §5.88 avait nommé ça « le vrai chantier suivant » : pour sa déclaration,
// Julien doit compter l'argent REÇU, alors que l'app ne sait dater que la VENTE
// (7 jours d'écart en médiane, jusqu'à 25). La date de finalisation n'existe
// nulle part dans la moisson des commandes.
// MESURÉ EN BASE avant de coder (méthode §46) : la réponse de
// `/api/v2/users/{id}/payouts` — que l'extension appelle DÉJÀ à chaque moisson
// — porte le relevé complet, et personne ne le lisait (même famille que §5.26) :
//   starting_date  : "2026-08-01"                     ← le mois du relevé
//   history        : [{year:2026, month:7, …}]        ← les mois consultables
//   invoice_lines  : [{ id, date:"2026-08-07T18:02:15Z", type:"credit",
//                       title:"Transfert vers le compte bancaire",
//                       amount:{amount:"-54.0"}, pending, entity_type:"payout" }]
// ⚠️ POURQUOI ON CAPTE SANS RIEN CALCULER. Le seul exemplaire observé est un
// VIREMENT SORTANT vers sa banque — et il porte `type:"credit"`. Donc « credit »
// ne veut PAS dire « recette », et la forme d'une ligne de VENTE n'a jamais été
// vue. Bâtir un chiffre de déclaration là-dessus serait deviner, exactement ce
// que §22/§5.23 s'interdisent : un montant faux ne se voit pas. On capte
// d'abord, on mesurera sur du vrai ensuite.
// ⚠️ ET SURTOUT : il n'y a qu'UNE ligne `harvest_{uid}_billing`, donc la
// dernière réponse gagne (§5.14). Le porte-monnaie de la page renvoie
// `{main,escrow}` et écrase donc le relevé de `payouts` — c'est pour ça qu'AUCUN
// compte vivant ne porte d'`invoice_lines` aujourd'hui alors que l'appel est
// fait à chaque visite. Le relevé a donc sa PROPRE ligne, une par mois.
const RELEVE_MAX_PAR_VISITE = 2;
const RELEVE_RETRY_MS = 24 * 60 * 60 * 1000;
// ⚠️ DÉBIT DES PHOTOS (Julien : « augmente le débit… les 12 photos doivent
// transiter »). Chaque annonce est captée en UN appel API qui rend TOUTES ses
// photos (jusqu'à 20) — la seule limite est le nombre d'annonces rattrapées par
// visite. Monté 3 → 8 pour remplir le catalogue plus vite. Le vrai garde-fou
// anti-blocage reste le plafond de 20 actions/h par compte (`garde`), une requête
// à la fois : monter ce nombre front-charge le rattrapage sans jamais le dépasser.
const PHOTOS_MAX_PAR_VISITE = 20;
const PHOTOS_RETRY_MS = 6 * 60 * 60 * 1000;
// Quand il ne manque plus aucune photo, on met une pause avant de relire la
// base : sans elle, un onglet Vinted laissé ouvert relirait `vinted_item_details`
// (lourde) toutes les minutes pour rien (§4.4, égress). 5 min = la même cadence
// que la moisson de visite, donc une nouvelle annonce est prise vite.
const PHOTOS_TICK_COOLDOWN_MS = 5 * 60 * 1000;

// Un mouvement, réduit à ce qui l'identifie et le date. On ne garde pas le
// libellé complet ni les champs de présentation : ces lignes repartent à chaque
// lecture (§34), et un relevé se lit sur la date, le sens et le montant.
function ligneReleve(l) {
  if (!l || typeof l !== 'object') return null;
  const brut = l.amount && typeof l.amount === 'object' ? l.amount.amount : l.amount;
  const n = parseFloat(String(brut == null ? '' : brut).replace(',', '.'));
  if (!isFinite(n)) return null;                       // sans montant, ce n'est pas un mouvement
  const d = l.date || l.created_at || l.updated_at || null;
  return {
    id: l.id != null ? String(l.id) : undefined,
    date: d ? String(d) : undefined,
    montant: n,
    type: l.type ? String(l.type).slice(0, 40) : undefined,
    quoi: l.entity_type ? String(l.entity_type).slice(0, 40) : undefined,
    ref: l.entity_id != null ? String(l.entity_id) : undefined,
    titre: l.title ? String(l.title).slice(0, 80) : undefined,
    attente: l.pending === true ? true : undefined,
  };
}

// Le mois que ce relevé décrit. `starting_date` fait foi (c'est Vinted qui le
// dit) ; à défaut on prend le mois du mouvement le plus récent. Jamais la date
// du jour : un relevé de juillet capté en septembre n'est pas un relevé de
// septembre.
function moisDuReleve(p) {
  const sd = p && p.starting_date;
  if (sd && /^\d{4}-\d{2}/.test(String(sd))) return String(sd).slice(0, 7);
  const l = (p && Array.isArray(p.invoice_lines) ? p.invoice_lines : [])
    .map(x => x && x.date).filter(Boolean).sort();
  const der = l[l.length - 1];
  return der && /^\d{4}-\d{2}/.test(String(der)) ? String(der).slice(0, 7) : null;
}

// Range le relevé dans SA ligne, une par compte et par mois. Appelé depuis les
// deux voies d'écriture (§5.27 : un garde-fou vit dans la fonction qui écrit).
// Aucune requête Vinted ajoutée : c'est la réponse qu'on a déjà sous la main.
async function storeReleve(uid, payload, domain) {
  try {
    const lignes = payload && Array.isArray(payload.invoice_lines) ? payload.invoice_lines : null;
    if (!lignes || !lignes.length) return false;
    const mois = moisDuReleve(payload);
    if (!mois) { noterDiag('releve_sans_mois'); echantillonRate('releve', String(uid), JSON.stringify(payload).slice(0, 400)); return false; }
    const propres = lignes.map(ligneReleve).filter(Boolean);
    if (!propres.length) { noterDiag('releve_sans_montant'); return false; }
    // ⚠️ On n'écrase un relevé que par un relevé AU MOINS aussi complet — même
    // règle que le dressing (§5.13) : `invoice_lines_has_more` dit que Vinted
    // en a gardé sous le coude, et une réponse tronquée ne doit pas remplacer
    // une réponse entière.
    const rowId = `harvest_${uid}_releve_${mois}`;
    try {
      const av = await sbGet(`app_data?id=eq.${encodeURIComponent(rowId)}&select=n:data->>nLignes`);
      const avant = Number(av && av[0] && av[0].n);
      if (isFinite(avant) && avant > propres.length) { noterDiag('ignore_releve_partiel'); return false; }
    } catch (_) {}
    // ⚠️ `supabaseUpsert` pose DÉJÀ le propriétaire et choisit la cible du
    // conflit (§12) : rappeler `withOwner` ici écrivait une Promise à la place
    // du relevé — la ligne partait avec un `data` VIDE, et ni le build ni
    // `node --check` ne le voyaient. C'est le banc qui l'a attrapé.
    const ok = await supabaseUpsert('app_data', [{
      id: rowId,
      data: {
        type: 'releve', uid: String(uid), mois, domain: domain || 'www.vinted.fr',
        capturedAt: new Date().toISOString(),
        nLignes: propres.length,
        complet: payload.invoice_lines_has_more === false ? true : undefined,
        // ⚠️ LE RÉSUMÉ EST CALCULÉ ICI, À LA CAPTURE — même motif que le widget
        // (§5.14) : un mois chargé pèse des dizaines de Ko par compte, et l'app
        // n'a besoin que de trois nombres. Elle les lira en SCALAIRES (§34) ;
        // le détail ne repart que quand on ouvre vraiment le relevé.
        // Ce sont trois FAITS arithmétiques, pas une interprétation : la seule
        // chose que Vinted nous dit avec certitude, c'est qu'un mouvement
        // `entity_type:"payout"` est un virement vers SA banque (donc un
        // déplacement entre ses propres comptes, jamais une recette).
        resume: {
          virements: +propres.filter(l => l.quoi === 'payout').reduce((a, l) => a + l.montant, 0).toFixed(2),
          entrees: +propres.filter(l => l.quoi !== 'payout' && l.montant > 0).reduce((a, l) => a + l.montant, 0).toFixed(2),
          sorties: +propres.filter(l => l.quoi !== 'payout' && l.montant < 0).reduce((a, l) => a + l.montant, 0).toFixed(2),
          n: propres.length,
        },
        lignes: propres,
      },
    }], 'id');
    noterDiag(ok === false ? 'releve_ecriture_ratee' : 'releve_ecrit');
    return ok !== false;
  } catch (_) { return false; }
}

// Les mois PASSÉS. `history` les liste ; on va les chercher un par un, sur le
// compte connecté, avec les mêmes garde-fous que partout (§48) : plafond
// horaire, compte connecté, N par visite, pas de nouvel essai avant 24 h.
// ⚠️ LE PARAMÈTRE N'A JAMAIS ÉTÉ OBSERVÉ. On tente `?year=&month=` ; si Vinted
// l'ignore, il rend le mois COURANT — on le voit à `starting_date`, on garde un
// échantillon et ON ARRÊTE (`vrmReleveMuet`). Boucler sur un endpoint qui
// ignore nos paramètres, ce serait des requêtes pour rien dans l'empreinte du
// compte, et c'est exactement ce que §5.52 a dû retirer après 73 échecs.
async function capterReleves(uid) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    const muet = (await chrome.storage.local.get('vrmReleveMuet')).vrmReleveMuet || {};
    if (muet[String(uid)]) return 0;                    // ce compte a déjà prouvé que le paramètre ne passe pas
    // Ce qu'on a déjà (une seule lecture, deux scalaires — jamais le payload).
    let cur = [];
    try { cur = await sbGet(`app_data?id=like.harvest_${uid}_releve_*&select=m:meta->>mois`); } catch (_) {}
    const dejaMois = new Set((cur || []).map(r => r && r.m).filter(Boolean));
    const bill = await sbGet(`app_data?id=eq.harvest_${uid}_billing&select=h:data->payload->history`);
    const hist = (bill && bill[0] && bill[0].h) || [];
    if (!Array.isArray(hist) || !hist.length) return 0;
    // ⚠️ LE DRESSING ET LE PORTE-MONNAIE UTILISENT L'ID DE PROFIL, PAS
    // L'IDENTIFIANT DE COMPTE (§7 : sans ça, 0 annonce — et ici, 0 relevé).
    // `vinted_accounts` ne porte PAS ce champ : il vit dans la réponse
    // `users/current` déjà moissonnée. On le lit en SCALAIRE (§34), zéro
    // requête Vinted ajoutée.
    let pid = null;
    try {
      const pr = await sbGet(`app_data?id=eq.harvest_${uid}_profile&select=pid:data->payload->user->>id`);
      pid = (pr && pr[0] && pr[0].pid) || null;
    } catch (_) {}
    const memo = (await chrome.storage.local.get('vrmReleveFaits')).vrmReleveFaits || {};
    let n = 0;
    // Du plus récent au plus ancien : c'est le mois qu'il déclare qui compte.
    const voulus = hist
      .filter(h => h && h.year && h.month)
      .map(h => ({ y: Number(h.year), m: Number(h.month), cle: `${h.year}-${String(h.month).padStart(2, '0')}` }))
      .filter(h => !dejaMois.has(h.cle))
      .sort((a, b) => b.cle.localeCompare(a.cle));
    for (const v of voulus) {
      if (n >= RELEVE_MAX_PAR_VISITE) break;
      const k = `${uid}_${v.cle}`;
      if (memo[k] && Date.now() - Number(memo[k]) < RELEVE_RETRY_MS) continue;
      const refus = await garde(uid, acc);
      if (refus) { logActivity(`⚠️ Relevé non lu : ${refus.error}`); break; }
      memo[k] = Date.now();
      n++;
      if (!pid) { noterDiag('releve_sans_profil'); break; }
      const rep = await vintedGet(acc, `/api/v2/users/${encodeURIComponent(pid)}/payouts?year=${v.y}&month=${v.m}`);
      if (!rep.ok || !rep.json) { noterDiag(`releve_refuse_${rep.status}`); continue; }
      const recu = moisDuReleve(rep.json);
      // Le mois rendu n'est pas celui demandé ⟹ le paramètre est ignoré.
      if (recu && recu !== v.cle) {
        noterDiag('releve_parametre_ignore');
        echantillonRate('releve_mois', v.cle, JSON.stringify({ demande: v.cle, recu, starting_date: rep.json.starting_date }).slice(0, 300));
        muet[String(uid)] = Date.now();
        await chrome.storage.local.set({ vrmReleveMuet: muet });
        break;
      }
      await storeReleve(uid, rep.json, 'www.vinted.fr');
    }
    await chrome.storage.local.set({ vrmReleveFaits: memo });
    return n;
  } catch (_) { return 0; }
}

// ══════════════════════════════════════════════════════════════════════════════
// CAPTER TOUTES LES PHOTOS D'UNE ANNONCE — EN PASSIF (Julien, 20 sept. : « je
// veux pas aller sur l'annonce »)
// ══════════════════════════════════════════════════════════════════════════════
// MESURÉ sur sa base le 20 sept. : la LISTE du dressing (`harvest_{uid}_listings`,
// ce qui charge quand il ouvre Vinted) ne porte, par annonce, que **la
// couverture** (`photo` = UN objet) + le VRAI compte (`nPhotos`, ex. 9). Le jeu
// complet ne vit QUE dans le détail de l'annonce. Pour l'avoir « sans ouvrir
// l'annonce », c'est donc l'extension qui va lire ce détail — une LECTURE sur SES
// propres annonces, exactement la forme de `capterRetraits`/`capterReleves`
// (§3 l'autorise), avec les MÊMES garde-fous : compte connecté (`garde`), N par
// visite, une requête à la fois, pas de nouvel essai avant 24 h.
// ⚠️ L'ENDPOINT DE DÉTAIL N'A JAMAIS ÉTÉ OBSERVÉ D'ICI (403 vers Vinted). On lit
// `/api/v2/items/{id}` DÉFENSIVEMENT : on prend `item.photos[].full_size_url|url`,
// et si cette forme ne donne rien on balaie la réponse pour toute URL d'image
// vinted.net. Un diag (`photos_annonce_*`) + un échantillon des CLÉS (jamais le
// corps) disent la vraie forme au cas où — la prochaine visite corrigera le tri
// sans deviner. On n'écrit JAMAIS moins de photos qu'on en a déjà (saveItemDetail
// ne remplace pas par du vide).
function urlsPhotosDeItem(json) {
  const out = [];
  const pousse = (u) => { if (typeof u === 'string' && /vinted\.net\//i.test(u) && !out.includes(u)) out.push(u); };
  try {
    const it = (json && (json.item || json)) || {};
    const ph = Array.isArray(it.photos) ? it.photos : [];
    for (const p of ph) { if (p) pousse(p.full_size_url || p.url || (p.thumbnails && p.thumbnails.length && p.thumbnails[p.thumbnails.length - 1].url)); }
    if (out.length) return out;
    // Forme inattendue : on balaie pour toute grande image vinted.net (jamais du
    // texte, jamais un mouchard — seulement des URL d'image du CDN).
    const vu = new Set();
    const scan = (o, prof) => {
      if (!o || prof > 6 || out.length >= 25) return;
      if (typeof o === 'string') { if (/vinted\.net\/.+\/(f800|f1200|1600|large|full)/i.test(o) || /vinted\.net\//i.test(o) && /\.(jpe?g|webp|png)/i.test(o)) pousse(o); return; }
      if (Array.isArray(o)) { for (const x of o) scan(x, prof + 1); return; }
      if (typeof o === 'object') { if (vu.has(o)) return; vu.add(o); for (const k of Object.keys(o)) scan(o[k], prof + 1); }
    };
    scan(json, 0);
  } catch (_) {}
  return out.slice(0, 25);
}

// ⚠️⚠️ VINTED N'A PLUS D'API DE DÉTAIL (mesuré le 29 sept. sur la vraie base :
// `/api/v2/items/{id}` renvoie 404, et en ouvrant une annonce la page n'appelle
// AUCUNE API item — les photos sont EMBARQUÉES dans le HTML rendu serveur).
// On récupère donc la PAGE publique de l'annonce (elle montre TOUTES les photos,
// même déconnecté) et on l'analyse. `credentials:'omit'` : on ne touche pas à la
// session, c'est une page publique.
async function vintedGetHtml(acc, endpoint) {
  try {
    const res = await fetch(`https://${acc.domain || 'www.vinted.fr'}${endpoint}`, {
      method: 'GET',
      credentials: 'omit',
      headers: { 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' },
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok, text };
  } catch (_) { return { status: 0, ok: false, text: '' }; }
}
// Extrait { photos, description } de la PAGE d'une annonce. Priorité au bloc
// `__NEXT_DATA__` (rendu serveur) où vit l'objet de l'annonce avec TOUTES ses
// photos — on ne prend QUE l'objet dont l'id == celui de l'annonce (§5,
// l'identité prime, jamais un autre article). Repli : balayage des grandes
// images vinted.net du HTML.
function extraireDetailPage(html, id) {
  const out = { photos: [], description: '', codes: null, cles: null, photoIds: [] };
  if (!html) return out;
  try {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    let data = null;
    if (m) { try { data = JSON.parse(m[1]); } catch (_) {} }
    if (data) {
      const cible = String(id);
      let found = null;
      const vu = new Set();
      const walk = (o, prof) => {
        if (!o || found || prof > 9 || typeof o !== 'object') return;
        if (vu.has(o)) return; vu.add(o);
        if (String(o.id) === cible && Array.isArray(o.photos) && o.photos.length) { found = o; return; }
        for (const k of Object.keys(o)) walk(o[k], prof + 1);
      };
      walk(data, 0);
      if (found) {
        for (const p of found.photos) { const u = p && (p.full_size_url || p.url || (p.thumbnails && p.thumbnails.length && p.thumbnails[p.thumbnails.length - 1].url)); if (typeof u === 'string' && /vinted\.net\//i.test(u) && !out.photos.includes(u)) out.photos.push(u); }
        if (typeof found.description === 'string') out.description = found.description;
        // ── LA FICHE POUR REPUBLIER (1er oct.) ─────────────────────────────
        // Recréer une annonce exige des CODES Vinted (catégorie, marque,
        // taille, état, couleurs, format du colis) — `GET /api/v2/items/{id}`
        // répond 404 (mesuré ×120), et la liste du dressing ne les porte pas.
        // La page de l'annonce, elle, les a dans ses données internes : on ne
        // garde QUE ces codes (aucune donnée personnelle), et la liste des
        // CLÉS de l'objet pour vérifier la forme au premier passage (§6).
        const pick = (o, ks) => { const r = {}; for (const k of ks) if (o[k] !== undefined && o[k] !== null && typeof o[k] !== 'object') r[k] = o[k]; return r; };
        const c = pick(found, ['catalog_id', 'brand_id', 'brand', 'size_id', 'size_title', 'status_id', 'status', 'color1_id', 'color2_id',
          'package_size_id', 'is_unisex', 'isbn', 'measurement_length', 'measurement_width', 'title', 'currency', 'item_closing_action']);
        if (found.brand_dto && typeof found.brand_dto === 'object') { if (found.brand_dto.id != null && c.brand_id == null) c.brand_id = found.brand_dto.id; if (found.brand_dto.title && !c.brand) c.brand = found.brand_dto.title; }
        if (found.price && typeof found.price === 'object') { if (found.price.amount != null) c.price = String(found.price.amount); if (found.price.currency_code) c.currency = found.price.currency_code; }
        else if (found.price != null) c.price = String(found.price);
        if (Array.isArray(found.color_ids)) c.color_ids = found.color_ids.filter(x => typeof x === 'number');
        if (Array.isArray(found.item_attributes)) c.item_attributes = found.item_attributes.map(a => a && ({ code: String(a.code || ''), ids: Array.isArray(a.ids) ? a.ids.filter(x => typeof x === 'number') : [] })).filter(a => a && a.code);
        out.codes = Object.keys(c).length ? c : null;
        out.cles = Object.keys(found).slice(0, 80);
        for (const p of found.photos) if (p && typeof p.id === 'number') out.photoIds.push(p.id);
      }
    }
    if (!out.photos.length) {
      const re = /https:\/\/images\d*\.vinted\.net\/[^"'\\\s)]+/gi;
      const vus = new Set(); let mm;
      while ((mm = re.exec(html)) && out.photos.length < 25) {
        const u = mm[0];
        if (!/\/(f800|f1200|1600|large|full)\//i.test(u)) continue;   // grandes images = photos d'article, pas les avatars
        const cle = u.split('?')[0];
        if (vus.has(cle)) continue; vus.add(cle);
        out.photos.push(u);
      }
    }
  } catch (_) {}
  return out;
}
async function capterPhotosAnnonces(uid) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    // La liste du dressing : id + nPhotos + état. C'est SA donnée (ligne du compte).
    let items = [];
    try {
      const rows = await sbGet(`app_data?id=eq.harvest_${uid}_listings&select=items:data->payload->items`);
      items = (rows && rows[0] && Array.isArray(rows[0].items)) ? rows[0].items : [];
    } catch (_) {}
    if (!items.length) return 0;
    // Ce qu'on a DÉJÀ capté (photos par id) — une lecture, la carte complète.
    let dej = {};
    try {
      const dr = await sbGet('app_data?id=eq.vinted_item_details&select=data');
      if (dr === null) return 0;                          // pas su ≠ « rien capté » : on ne rejoue pas à l'aveugle
      dej = (dr[0] && dr[0].data) || {};
    } catch (_) {}
    const manquants = items.filter((it) => {
      if (!it || !it.id) return false;
      if (it.is_closed || it.is_hidden || it.is_draft) return false;   // en ligne seulement
      const veut = Number(it.nPhotos || 0);
      const d0 = dej[String(it.id)] || {};
      const a = (d0.photos || []).length;
      // Il manque des photos, OU la fiche de codes (pour republier). La même
      // lecture de page donne les deux : aucune requête de plus par annonce.
      return (veut > 1 && a < veut) || !d0.codes;
    }).sort((a, b) => Number(b.nPhotos || 0) - Number(a.nPhotos || 0));
    if (!manquants.length) return 0;
    const memo = (await chrome.storage.local.get('vrmPhotosFaites')).vrmPhotosFaites || {};
    let n = 0, dirty = false;
    for (const it of manquants) {
      if (n >= PHOTOS_MAX_PAR_VISITE) break;
      const k = `${uid}_${it.id}`;
      if (memo[k] && Date.now() - Number(memo[k]) < PHOTOS_RETRY_MS) continue;
      const refus = await garde(uid, acc);
      if (refus) { logActivity(`⚠️ Photos non captées : ${refus.error}`); break; }
      memo[k] = Date.now();
      n++;
      const rep = await vintedGetHtml(acc, `/items/${encodeURIComponent(it.id)}`);
      if (!rep.ok || !rep.text) { noterDiag(`photos_page_refuse_${rep.status}`); continue; }
      const det = extraireDetailPage(rep.text, it.id);
      const urls = det.photos;
      if (!urls.length) {
        noterDiag('photos_page_vide');
        echantillonRate('photos_page', String(it.id), 'nextdata=' + (/__NEXT_DATA__/.test(rep.text) ? 'oui' : 'non') + ' len=' + rep.text.length);
        continue;
      }
      const it2 = { description: det.description || '' };
      // ⚠️ ÉCRITURE GROUPÉE (§4.4, égress — « c'est pas trop coûteux pour
      //    Supabase ? », 29 sept.). AVANT : `saveItemDetail` relisait ET
      //    réécrivait la ligne ENTIÈRE `vinted_item_details` à CHAQUE annonce —
      //    20 annonces = 20 réécritures d'une ligne qui grossit (coût en n²).
      //    Ici on met à jour la carte DÉJÀ en mémoire (`dej`, lue une seule
      //    fois plus haut) et on n'écrit qu'UNE fois, après la boucle. Même
      //    règle de fusion que `saveItemDetail` : ne jamais écraser par du vide.
      const kk = String(it.id);
      const prev = dej[kk] || {};
      const desc = String(it2.description || '').trim();
      const photos = urls.filter(Boolean).slice(0, 24);
      // MESURE (§6, « on ne prend que 5 photos », 29 sept.) : si on en récupère
      // MOINS que Vinted n'en annonce (`nPhotos`), on note combien + les CLÉS de
      // la réponse (jamais le corps) — pour trancher si l'API de détail limite,
      // ou si les photos vivent dans un champ qu'on ne lit pas encore.
      if (Number(it.nPhotos || 0) > photos.length) echantillonRate('photos_incomplet', String(it.id), 'got=' + photos.length + ' want=' + Number(it.nPhotos || 0) + ' cles=' + Object.keys(it2).slice(0, 30).join(','));
      dej[kk] = { description: desc || prev.description || '', photos: photos.length ? photos : (prev.photos || []), readAt: new Date().toISOString(),
        codes: det.codes || prev.codes || null, photoIds: (det.photoIds && det.photoIds.length) ? det.photoIds : (prev.photoIds || []) };
      dirty = true;
      noterDiag('photos_page_ecrit');
      // Mesure de la fiche : codes trouvés, ou non — et alors les CLÉS (jamais les valeurs).
      if (det.codes && det.codes.catalog_id != null) noterDiag('fiche_codes_ok');
      else { noterDiag('fiche_codes_absents'); echantillonRate('fiche_codes', String(it.id), 'cles=' + (det.cles || []).join(',').slice(0, 600)); }
    }
    if (dirty) await supabaseUpsert('app_data', [{ id: 'vinted_item_details', data: dej }], 'id');
    await chrome.storage.local.set({ vrmPhotosFaites: memo });
    return n;
  } catch (_) { return 0; }
}

// ⚠️ CAPTURE PLUS RAPIDE, SANS ATTENDRE UNE NAVIGATION (Julien, 29 sept. :
// « elle doit être bcp plus rapide et pas attendre que je l'ouvre »).
// L'extension a BESOIN d'une session Vinted (elle lit avec TES jetons) : elle
// ne peut donc rien capter sans qu'un onglet Vinted soit ouvert. Mais tant
// qu'UN onglet Vinted est ouvert — même sans que tu cliques — cette alarme
// (1 min) complète les photos manquantes du compte connecté, 20 par tour, une
// par une (§3, garde interne). Dès qu'il ne manque plus rien, on marque une
// pause (`PHOTOS_TICK_COOLDOWN_MS`) pour ne pas relire la base en boucle
// (§4.4). Aucun onglet Vinted ⇒ rien ne part, aucun coût.
async function tickPhotos() {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://*.vinted.fr/*', 'https://*.vinted.com/*', 'https://*.vinted.it/*', 'https://*.vinted.de/*'] });
    if (!tabs || !tabs.length) return;                 // pas d'onglet Vinted : on ne touche à rien
    const uid = await activeUidForDomain('www.vinted.fr');
    if (!uid) return;                                  // pas connecté : rien à capter
    const cd = (await chrome.storage.local.get('vrmPhotosCooldown')).vrmPhotosCooldown || {};
    if (Date.now() - Number(cd[uid] || 0) < PHOTOS_TICK_COOLDOWN_MS) return; // fini récemment : on ne relit pas la base
    const n = await capterPhotosAnnonces(uid);
    // Plus rien à faire (ou garde qui refuse) → on met en pause ce compte.
    if (!n) { cd[uid] = Date.now(); await chrome.storage.local.set({ vrmPhotosCooldown: cd }); }
  } catch (_) { /* une capture ratée n'a pas à réveiller d'erreur */ }
}

const AWAITING_SHIP = (s) => /bordereau\s+envoy[ée]\s+au\s+vendeur/i.test(s || '') || /paiement.*valid/i.test(s || '');
const AT_RELAY = (s) => /d[ée]pos[ée]/i.test(s || '') && /point\s+relais|bureau\s+de\s+poste/i.test(s || '');
// ══════════════════════════════════════════════════════════════════════════════
// LE CODE DE RETRAIT VINTED GO EST DANS LA CONVERSATION, PAS DANS UN EMAIL
// ══════════════════════════════════════════════════════════════════════════════
// Capture d'écran de Julien (27 août), dans le fil de discussion Vinted :
//   « Ton colis est arrivé ! Il t'attend à l'adresse suivante : Kusmi Tea,
//     13 Rue Saint-Vincent, 56000 Vannes, France. Scanne ton code de retrait
//     ou saisis le code C65735 pour le récupérer. »
// MESURÉ en base avant de coder : ce message existe bien dans les conversations
// captées, sous `entity_type: 'action_message'` —
//   title    : « Ta commande est arrivée. »
//   subtitle : « Ton colis a été livré dans le Point Relais MAISON DE LA PRESSE,
//               40 RUE DU PORT, 35260 CANCALE. Tu peux … aller le récupérer. »
//   actions  : track_shipment · mark_as_delivered
// …et **rien ne le lisait**. Pour Vinted Go, l'adresse ET le code de retrait
// n'arrivent QUE par là : aucun email transporteur ne les porte (§5.47 —
// 2 comptes sur 8 ne reçoivent même aucun email). Sans ça, le colis repart chez
// l'expéditeur au bout du délai, et c'est une vente perdue.
const sansBalises = (s) => String(s == null ? '' : s)
  .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
// ⚠️ UN CODE DE RETRAIT PEUT COMMENCER PAR UNE LETTRE (« C65735 », relevé sur
// une vraie capture Vinted Go). La règle strictement numérique de §5.37 — posée
// parce que le mot « suivant » avait été capté comme code — l'aurait REJETÉ.
// On accepte donc au plus deux lettres majuscules suivies de 4 à 10 chiffres :
// « suivant » n'a aucun chiffre, il reste écarté.
const CODE_APRES = /^([A-Z]{0,2}\d{4,10})\b/;
// Le message d'ARRIVÉE, et lui seul. « Article à emballer et envoyer » parle
// aussi de point relais : c'est un colis qui PART, pas un colis à retirer.
const CONV_ARRIVE = /(?:ton\s+colis|ta\s+commande)\s+est\s+arriv|t['’]attend\s+à\s+l['’]adresse/i;
function retraitDeConversation(conv) {
  try {
    const c = (conv && conv.conversation) || conv || {};
    const t = c.transaction || {};
    // ⚠️ CÔTÉ ACHETEUR UNIQUEMENT. Côté vendeur, « la commande est arrivée »
    // veut dire que l'ACHETEUR l'a reçue — ce n'est pas un colis pour nous.
    if (String(t.current_user_side || '') === 'seller') return null;
    let trouve = null;
    for (const m of (Array.isArray(c.messages) ? c.messages : [])) {
      if (!m || (m.entity_type !== 'action_message' && m.entity_type !== 'status_message')) continue;
      const e = m.entity || {};
      const titre = sansBalises(e.title);
      const sous = sansBalises(e.subtitle);
      if (!CONV_ARRIVE.test(titre + ' ' + sous)) continue;
      // On garde le HTML BRUT : « Scanne ton code de retrait » est un LIEN, et
      // c'est derrière lui que vit le QR (capture d'écran de Julien).
      trouve = { titre, sous, html: String(e.subtitle || ''), actions: e.actions || [] };
    }
    if (!trouve) return null;
    const txt = trouve.titre + ' ' + trouve.sous;
    // Lieu : ce qui suit le marqueur, jusqu'à la fin de la phrase.
    let lieu = '';
    for (const re of [/à\s+l['’]adresse\s+suivante\s*:\s*/i, /livr[ée]\s+dans\s+le\s+[Pp]oint\s+[Rr]elais\s+/i,
                      /livr[ée]\s+(?:dans|à|au|chez)\s+/i, /t['’]attend\s+(?:dans|à|au|chez)\s+/i]) {
      const m = txt.match(re); if (!m) continue;
      lieu = txt.slice(m.index + m[0].length).split(/\.\s|\.$/)[0].trim();
      if (lieu) break;
    }
    // Code : « saisis le code X », sinon « le code X pour ».
    let code = '';
    for (const re of [/sais(?:is|issez)\s+le\s+code\s+/i, /\bcode\s+(?=[A-Z]{0,2}\d{4,10}\b)/]) {
      const m = txt.match(re); if (!m) continue;
      const suite = txt.slice(m.index + m[0].length).match(CODE_APRES);
      if (suite) { code = suite[1]; break; }
    }
    // ── LE LIEN DU QR ─────────────────────────────────────────────────────
    // « Scanne ton code de retrait » est un <a href>. On ne garde QUE ce qui
    // mène quelque part : dans les messages réellement captés, la plupart des
    // liens valent `href="/"` (Vinted les recâble côté client). Un lien qui
    // ouvre la page d'accueil serait pire que pas de lien du tout.
    let qr = '';
    for (const m of String(trouve.html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = String(m[1] || '').trim();
      const texte = sansBalises(m[2]);
      if (!/scanne|code de retrait|qr|retrait/i.test(texte)) continue;
      if (!href || href === '/' || href === '#') continue;
      qr = /^https?:/i.test(href) ? href : ('https://www.vinted.fr' + (href[0] === '/' ? '' : '/') + href);
      break;
    }
    if (!lieu && !code && !qr) return null;           // rien d'utile : on n'invente pas
    const cid = String(c.id || '');
    return {
      tx: String(t.id || ''), item: String(t.item_id || ''),
      titre: String(t.item_title || c.subtitle || c.description || ''),
      photo: (t.item_photo && t.item_photo.url) || null,
      lieu, code, qr, conv: cid,
      url: c.conversation_url || (cid ? `https://www.vinted.fr/inbox/${cid}` : ''),
      at: new Date().toISOString(),
    };
  } catch (_) { return null; }
}

// La ligne DÉDIÉE que l'app lit (motif anti-clobber §35 : le panneau n'écrit
// jamais `main`). Clé = n° de transaction, l'identité de l'achat (§24) — jamais
// un rapprochement par titre. Une entrée de plus de 45 jours est purgée : un
// colis n'attend pas si longtemps, et la ligne doit rester légère (§34).
const RETRAIT_MAX_J = 45;
async function noterRetrait(r) {
  if (!r || !r.tx) return false;
  try {
    const rows = await sbGet('app_data?id=eq.panel_colis_relais&select=data');
      // ⚠️ LECTURE RATÉE ≠ LIGNE VIDE. `sbGet` rend `null` quand la base n'a pas
    //    répondu ; repartir de `{}` et réécrire la ligne ENTIÈRE efface tout le
    //    reste. On n'écrit pas.
    //    Ici on perdrait les CODES DE RETRAIT déjà lus dans les conversations.
    if (rows === null) return false;
    const cur = (rows[0] && rows[0].data) || {};
    const avant = cur[r.tx];
    // Rien de neuf → aucune écriture (égress, §34).
    if (avant && avant.code === r.code && avant.lieu === r.lieu && avant.qr === r.qr) return false;
    const limite = Date.now() - RETRAIT_MAX_J * 86400000;
    const out = {};
    for (const k in cur) { const v = cur[k]; if (v && Date.parse(v.at || '') > limite) out[k] = v; }
    out[r.tx] = r;
    await supabaseUpsert('app_data', [{ id: 'panel_colis_relais', data: out }], 'id');
    noterDiag('retrait_conv_ecrit');
    return true;
  } catch (_) { return false; }
}

function resumeCommandes(type, payload) {
  // ⚠️ EXACTEMENT `orders_sold` ou `orders_purchased`, jamais une ligne
  // générique. Une réponse `/my_orders` sans `?type=` MÉLANGE ventes et achats
  // (§25) : mesuré sur la vraie base, un `/^orders/` laxiste faisait passer 7
  // ventes anciennes pour des colis « à retirer ». Ces lignes ne sont plus
  // écrites, mais elles existent encore en base.
  const vente = type === 'orders_sold';
  if (!vente && type !== 'orders_purchased') return null;
  const cmds = (payload && payload.my_orders) || [];
  if (!Array.isArray(cmds)) return null;
  const txns = [];
  for (const o of cmds) {
    if (!o) continue;
    const ok = vente ? AWAITING_SHIP(o.status) : AT_RELAY(o.status);
    if (ok && o.transaction_id != null) txns.push(String(o.transaction_id));
  }
  // Les transactions (pas seulement le compte) : le widget dédoublonne entre
  // comptes, sinon une même vente vue sur deux lignes compterait double.
  return { n: cmds.length, txns, at: Date.now() };
}

async function storeHarvestRow(uid, type, payload, domain) {
  // ⚠️ LA MOISSON ACTIVE N'ALIMENTAIT PAS LE COFFRE. « 🔄 Tout recapter » va
  // chercher le dressing COMPLET (toutes les pages) — et jetait tout au coffre
  // près : seule la voie passive archivait. C'est pour ça que le coffre plafonne
  // à 25 annonces quand 112 sont en ligne, donc que « Republier » n'a ni texte
  // ni photos pour la plupart des paires. On archive depuis le payload BRUT
  // (l'allègement ci-dessous ne laisse qu'une photo par annonce).
  const brut = payload;
  // Sentinelle de dérive de forme, sur le BRUT (voie active : même protection).
  verifFormeListe(type, brut, '');
  verifFormeObjet(type, brut, '');
  payload = alleger(type, payload);
  // ⚠️ MÊME GARDE QUE LA VOIE PASSIVE, ICI AUSSI. Le test `estPorteMonnaie`
  // n'existait que chez l'APPELANT (la moisson active) : n'importe quel autre
  // chemin pouvait donc écrire un porte-monnaie vide par-dessus le vrai solde.
  // Mesuré en base : 4 comptes sur 8 avaient un `payload: {}`, donc leur argent
  // en attente n'apparaissait nulle part. Un garde-fou doit vivre dans la
  // fonction qui écrit, pas chez ceux qui l'appellent.
  // Idem côté moisson active — depuis le payload BRUT : l'allègement ne touche
  // pas `billing` aujourd'hui, mais un relevé ne doit pas dépendre de ça.
  if (type === 'billing') { try { await storeReleve(uid, brut, domain); } catch (_) {} }
  if (type === 'billing' && !estPorteMonnaie(payload)) return;
  const maintenant = new Date().toISOString();
  const data = { type, uid, domain: domain || 'www.vinted.fr', capturedAt: maintenant, payload };
  // Même règle que la voie passive : un dressing partiel n'écrase pas un
  // dressing complet. La moisson ACTIVE pagine (fetchAllWardrobe) donc elle
  // passe toujours — mais si un jour une page échoue en cours de route, on ne
  // veut pas que le résultat tronqué remplace la bonne capture.
  if (CLE_LISTE[type]) {
    data.nItems = ((payload && payload[CLE_LISTE[type]]) || []).length;
    if (!(await listePlusRiche(`harvest_${uid}_${type}`, payload, CLE_LISTE[type]))) return;
  }
  data.resume = resumeCommandes(type, payload) || undefined;
  // On ecrit AUSSI updated_at : la table n'a pas de trigger, la colonne gardait
  // donc la date de creation de la ligne et faisait passer une moisson de deux
  // heures pour une moisson de 25 jours. `capturedAt` reste la reference cote
  // app, mais autant que la colonne cesse de mentir aux autres lecteurs.
  const ecritRow = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_${type}`, data, updated_at: maintenant }], 'id');
  if (ecritRow !== false && type === 'orders_sold') notifierApp({ type: 'maj', quoi: 'ventes', uid: String(uid) });
  noterFlux('vinted', ecritRow !== false);
  if (type === 'listings') {
    try { const tous = (brut && brut.items) || []; await archiverLot(uid, tous.filter(it => it && !it.is_closed && !it.is_hidden && !it.is_draft), tous); } catch (_) {}
  }
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
        // ⚠️ LES COMMANDES AUSSI SE PAGINENT. On ne prenait QUE la page 1 ici,
        // alors que l'autre chemin (par cookie) paginait — donc selon le chemin
        // emprunté, un compte à 320 ventes en rendait 320 ou 100. Et comme une
        // capture écrase la précédente, la version tronquée EFFAÇAIT la
        // complète : des ventes disparaissaient toutes seules. Même faute que
        // le dressing (§5.13), sur les commandes.
        const toutesCommandes = async (type) => {
          const MAX = 10; let out = null;
          for (let pg = 1; pg <= MAX; pg++) {
            const r = await get('/api/v2/my_orders?type=' + type + '&page=' + pg + '&per_page=100');
            const lot = r && Array.isArray(r.my_orders) ? r.my_orders : null;
            if (!lot) break;
            if (!out) out = r; else out.my_orders = out.my_orders.concat(lot);
            const tp = r.pagination && r.pagination.total_pages;
            if (!lot.length || (tp && pg >= tp) || lot.length < 100) break;
            await new Promise(res => setTimeout(res, 700));
          }
          return out;
        };
        const sold = await toutesCommandes('sold');
        const bought = await toutesCommandes('purchased');
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
  // `payouts` renvoie `{balance}` là où le porte-monnaie renvoie `{main,escrow}` :
  // sans ce troisième cas, la lecture ajoutée en 4.26 était jetée à l'arrivée.
  if (estPorteMonnaie(out.wallet)) { await storeHarvestRow(uid, 'billing', out.wallet, domain); stored = true; }
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
// Rend VRAI si quelque chose a été rangé — la visite peut alors le dire dans
// le journal au lieu d'annoncer un rafraîchissement qui n'a rien capté.
async function runActive() {
  if (await pageActiveFetch()) return true;
  if (await activeFetchActiveAccount()) return true;
  await activeFetchAll();
  return false;
}
function fullSync() { captureAllAccounts().then(() => runActive()); }

// ⚠️ APRÈS UNE MISE À JOUR, Chrome n'injecte PAS le nouveau bridge.js dans les
//    onglets de l'app déjà ouverts : l'app parlerait à l'ancien (orphelin,
//    muet) jusqu'à ce qu'il recharge la page. On le réinjecte nous-mêmes.
async function reinjecterPont() {
  try {
    const tabs = await chrome.tabs.query({ url: APP_URLS });
    for (const t of tabs || []) {
      try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['bridge.js'] }); } catch (_) {}
    }
  } catch (_) {}
}
chrome.runtime.onInstalled.addListener(() => { fullSync(); reinjecterPont(); });
chrome.runtime.onStartup.addListener(() => { fullSync(); });

try {
  // Capture des comptes toutes les 10 min ; fetch actif toutes les 20 min
  // (assez pour etre a jour, assez espace pour rester discret).
  chrome.alarms.create('cancale-sync', { periodInMinutes: 10 });
  chrome.alarms.create('cancale-active', { periodInMinutes: 20 });
  // ⚠️ ENTRETIEN DE LA SESSION VENDEUR. Le jeton d'accès dure ~1 h ; il n'était
  // renouvelé qu'au moment d'écrire, et SEULEMENT si la base est cloisonnée.
  // Une fois la migration passée, une extension restée ouverte sans écrire
  // aurait laissé mourir son jeton, puis serait retombée sur la clé publique —
  // c'est-à-dire, sous RLS, plus aucune capture enregistrée, en silence.
  // 40 min : bien avant l'heure, et rien ne part si aucune session n'existe.
  chrome.alarms.create('vrm-session', { periodInMinutes: 40 });
  // Photos des annonces : tant qu'un onglet Vinted est ouvert, on complète tout
  // seul, sans attendre une navigation (Julien, 29 sept.). Voir `tickPhotos`.
  chrome.alarms.create('vrm-photos', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === 'cancale-sync') captureAllAccounts();
    else if (a.name === 'cancale-active') runActive();
    else if (a.name === 'vrm-session') { loadSession().then(s => { if (s) authToken(); }); }
    else if (a.name === 'vrm-photos') tickPhotos();
    // Le tampon de diagnostic survit au worker (chrome.storage.local) ; encore
    // faut-il qu'il PARTE un jour. Sans ce réveil, un tampon posé juste avant
    // une longue période calme attendrait la prochaine capture pour être écrit.
    majTampon(() => {});
  });
} catch (_) {}

// ── CAPTURE À CHAQUE VISITE SUR VINTED ──────────────────────────────────────
// Demande de Julien : « à chaque fois que je vais sur Vinted, l'extension capte
// toutes les données et rafraîchit pour l'application ». Jusqu'ici la moisson
// active ne partait qu'au démarrage de Chrome, au changement de session, ou
// toutes les 20 min — donc en ouvrant Vinted on pouvait travailler sur des
// chiffres vieux de vingt minutes, et un compte peu visité restait figé.
//
// ⚠️ CE QUE ÇA N'EST PAS. On ne rafraîchit QUE le compte connecté dans cet
// onglet, depuis SA session et SON IP, avec les mêmes appels qu'une visite
// normale (§5). Jamais tous les comptes d'un coup — c'est ça, la signature
// multi-comptes que Vinted sanctionne.
//
// Le délai de garde n'est pas un « rythme faussement humain » (toujours refusé,
// §32) : c'est simplement ne pas refaire dix fois la même lecture pendant qu'on
// navigue de page en page. Sans lui, ouvrir 30 annonces = 30 moissons complètes.
const VISITE_DELAI_MS = 5 * 60 * 1000;   // au plus une moisson complète / 5 min / compte
// ⚠️ « ÇA PREND DU TEMPS À CE QUE LA VENTE SOIT CAPTÉE » — c'était ce garde-là.
// Il protège d'une moisson COMPLÈTE (dressing de 600 articles, achats, boîte…)
// à chaque page ouverte. Mais une vente, c'est UNE requête (`my_orders?sold`) :
// la rafraîchir plus souvent ne pèse presque rien et c'est ce qu'il attend.
// Ce n'est pas un rythme « faussement humain » (§32) : c'est une limite de
// volume, comme le plafond horaire.
const VENTES_DELAI_MS = 90 * 1000;       // les VENTES seules : au plus 1 / 90 s / compte
let visiteTimer = null;
// ── LA VENTE, CAPTÉE VITE ───────────────────────────────────────────────────
// Une moisson complète, c'est le dressing (jusqu'à 600 articles, 7 pages), les
// achats, la boîte : lourd, d'où le garde de 5 minutes. Mais la question « ai-je
// vendu ? » ne demande QU'UNE liste — `my_orders?type=sold`. On la rafraîchit
// donc seule, plus souvent, pour que le récap et le bordereau ne soient pas en
// retard d'un quart d'heure sur la réalité.
// ⚠️ Réutilise `fetchAllOrders` + `storeHarvestRow` (donc les garde-fous
//    existants : jamais écraser une capture plus riche par une plus pauvre,
//    §5.19). On n'écrit pas une deuxième façon de lire les ventes (§11).
async function rafraichirVentes(uid) {
  const accts = await getStoredAccounts();
  const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
  if (!acc) return false;
  const sold = await fetchAllOrders(acc, 'sold');
  if (!sold || !sold.my_orders || !sold.my_orders.length) return false;
  await storeHarvestRow(uid, 'orders_sold', sold, acc.domain || 'www.vinted.fr');
  // ⚠️ On vient d'écrire des ventes FRAÎCHES : tout ce que le mémo de visite
  // garde sur ce compte est périmé à la milliseconde près. On le vide.
  viderMemoVisite(uid);
  noterDiag('ventes_rafraichies');
  return true;
}

async function visiteVinted() {
  try {
    const uid = await activeUidForDomain('www.vinted.fr');
    if (!uid) return;                                   // pas connecté : rien à capter

    // ═══ 1. CE QU'IL ATTEND, TOUT DE SUITE ═══════════════════════════════
    // ⚠️ ORDRE INVERSÉ (Julien, 3 septembre : « quand je me connecte, que ça me
    // demande plus vite de générer le bordereau »). Avant, la vente, le
    // bordereau et le récap arrivaient APRÈS `runActive()` — une moisson
    // COMPLÈTE : dressing jusqu'à 7 pages avec pauses, achats, boîte,
    // porte-monnaie. Le récap pouvait donc mettre une minute à s'afficher
    // alors que la vente ne demande QU'UNE requête (`my_orders?type=sold`).
    // Ce bloc ne coûte rien de plus : ce sont les mêmes appels, simplement
    // placés avant le lourd. Rien à voir avec un « rythme humain » (§32).
    const dv = (await chrome.storage.local.get('vrmDerniereVente')).vrmDerniereVente || {};
    if (Date.now() - Number(dv[uid] || 0) >= VENTES_DELAI_MS) {
      dv[uid] = Date.now();
      await chrome.storage.local.set({ vrmDerniereVente: dv });
      try { await rafraichirVentes(uid); } catch (_) {}
    }
    // ⚠️ LA VISITE GÉNÈRE, TOUTE SEULE (Julien, 27 août puis 3 septembre :
    // « que ça envoie direct dans l'app sans me demander »). Cohérent avec
    // §5.29 : générer un bordereau n'engage AUCUN argent et ne décide de rien
    // — la vente est faite, le colis doit partir. Tous les garde-fous restent :
    // compte connecté uniquement, 20 actions/h, plafond par visite, pas de
    // nouvel essai avant 6 h.
    const genes = await avecVinted(() => genererBordereauxEnAttente(uid));
    // Ce qui vient de partir : l'APP l'annonce (5.130 — plus de fenêtre sur
    // Vinted). Elle relit ses bordereaux quand on la prévient.
    if (Number(genes) > 0) notifierApp({ type: 'maj', quoi: 'label', uid: String(uid) });
    // ⚠️ ET LES MESSAGES, sur sa décision du 19 septembre (« tout, elle répond à
    //    tout »). Éteint par défaut : c'est lui qui allume depuis l'app.
    try { await avecVinted(() => repondreAuxMessages(uid)); } catch (_) {}

    // ═══ 2. LE RESTE, ENSUITE ════════════════════════════════════════════
    // Le garde de 5 min ne protège plus que la moisson COMPLÈTE — c'est elle
    // qui est lourde, et refaire dix fois la même en naviguant de page en page
    // n'apporte rien (§5.19).
    const st = (await chrome.storage.local.get('vrmDerniereVisite')).vrmDerniereVisite || {};
    if (Date.now() - Number(st[uid] || 0) < VISITE_DELAI_MS) return;
    st[uid] = Date.now();
    await chrome.storage.local.set({ vrmDerniereVisite: st });
    const ok = await runActive();
    logActivity(ok ? '🔄 Données rafraîchies en arrivant sur Vinted' : '🔄 Rien de neuf à capter');
    // ⚠️ APRÈS la moisson : les offres viennent des conversations captées, donc
    //    travailler avant la capture reviendrait à décider sur des données
    //    périmées. Éteint par défaut, un plancher par annonce est obligatoire.
    await avecVinted(() => autoAccepterOffres(uid));
    // ⚠️ APRÈS la moisson elle aussi : la liste des colis « déposés en point
    // relais » vient des achats qu'on vient de capter. Sans ça, on lirait la
    // photo d'hier et on redemanderait des conversations pour rien.
    await capterRetraits(uid);
    // ⚠️ APRÈS la moisson : les ventes « finalisées » viennent d'être captées.
    // On relit le détail de celles dont on n'a pas encore la date de versement
    // (le CA déclaré est daté à ce jour-là — demande du 3 octobre).
    await capterDatesVersement(uid);
    // ⚠️ APRÈS la moisson : le mois COURANT vient d'être capté gratuitement par
    // `/payouts` (aucune requête ajoutée) ; ici on ne va chercher que les mois
    // PASSÉS encore absents, deux par visite au plus.
    await capterReleves(uid);
    // ⚠️ APRÈS la moisson : la liste du dressing (id + nPhotos) vient d'être
    // captée. On complète EN PASSIF les photos manquantes de ses annonces en
    // ligne — 3 par visite, une par une, compte connecté (§3). Sans ouvrir
    // l'annonce : c'est l'extension qui lit le détail (Julien, 20 sept.).
    await capterPhotosAnnonces(uid);
  } catch (_) { /* une visite ratée n'a pas à casser la navigation */ }
}




try {
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (!info || info.status !== 'complete') return;
    const u = (tab && tab.url) || '';
    if (!/^https:\/\/(www\.)?vinted\.(fr|com|it|de)\//.test(u)) return;
    // Petit délai : on laisse la page finir de se charger, la capture passive
    // en profite aussi (elle observe ce que la page demande d'elle-même).
    // ⚠️ 3 s → 1,2 s → 250 ms : c'est NOTRE minuterie, pas un rythme montré à
    // Vinted (§32). Une fois les lectures dédoublonnées et mises en parallèle,
    // cette attente était devenue le plus GROS morceau du délai — on attendait
    // plus longtemps qu'on ne travaillait. La capture passive continue de
    // tourner pendant ce temps, elle ne perd rien ; et le récap sait désormais
    // patienter tout seul si l'onglet n'est pas encore prêt à le recevoir.
    clearTimeout(visiteTimer);
    visiteTimer = setTimeout(() => { visiteVinted(); }, 250);
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
  // ⚠️ LECTURE RATÉE ≠ LIGNE VIDE. `sbGet` rend `null` quand la base n'a pas
  //    répondu ; repartir de `{}` et réécrire la ligne ENTIÈRE efface tout le
  //    reste. On n'écrit pas.
  if (rows === null) return;
  const cur = (rows[0] && rows[0].data) || {};
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
  // ⚠️ LECTURE RATÉE ≠ LIGNE VIDE. `sbGet` rend `null` quand la base n'a pas
  //    répondu ; repartir de `{}` et réécrire la ligne ENTIÈRE efface tout le
  //    reste. On n'écrit pas.
  if (rows === null) return;
  const cur = (rows[0] && rows[0].data) || {};
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

// ══════════════════════════════════════════════════════════════════════════════
// GARDE-FOU ANTI-BLOCAGE — à passer AVANT toute action envoyée à Vinted
// ══════════════════════════════════════════════════════════════════════════════
// Demande de Julien : « améliore tout ça pour ne pas que je me fasse ban ».
// Les boutons du panneau envoient de vraies requêtes. Sans garde-fou, deux
// comportements très détectables passaient :
//
// 1. ⚠️ AGIR AU NOM D'UN COMPTE QUI N'EST PAS CELUI CONNECTÉ. `vintedSend`
//    utilise le jeton du compte visé — donc accepter une offre du compte B
//    pendant que le navigateur est sur le compte A envoie une requête de B
//    depuis la session/l'empreinte de A. C'est LE signal multi-comptes que
//    Vinted sanctionne (§5, et c'est ce qui a fait tomber `vanessa5723`).
//    ➡️ On refuse, et on dit de basculer sur le bon compte d'abord.
//
// 2. ⚠️ LA RAFALE. Un plafond par heure et par compte empêche qu'un clic
//    répété (ou un bug) parte en série. Ce n'est PAS un déguisement de rythme
//    « faussement humain » (toujours refusé, §32) : c'est une limite dure.
//
// Si on n'arrive pas à savoir quel compte est connecté (cookie absent), on
// LAISSE PASSER : bloquer sur une détection ratée casserait l'outil.
const ACTIONS_MAX_HEURE = 20;

async function compteConnecte(domain) {
  try { return await activeAccountId(domain || 'www.vinted.fr'); } catch (_) { return null; }
}

async function compterAction(uid) {
  try {
    const cle = 'vrmActions';
    const cur = (await chrome.storage.local.get(cle))[cle] || {};
    const t = Date.now(), ilYaUneHeure = t - 3600000;
    const list = (cur[uid] || []).filter(x => x > ilYaUneHeure);
    if (list.length >= ACTIONS_MAX_HEURE) return { ok: false, n: list.length };
    list.push(t); cur[uid] = list;
    await chrome.storage.local.set({ [cle]: cur });
    return { ok: true, n: list.length };
  } catch (_) { return { ok: true, n: 0 }; }
}

// ── ACTIONS COMMANDÉES PAR L'APP : LA GARDE STRICTE ─────────────────────────
// `garde` laisse passer quand aucun cookie n'est lisible (une détection ratée
// ne doit pas casser une visite sur Vinted, où l'onglet prouve le compte). Une
// commande venue de l'APP n'a pas cette preuve : on ne sait pas quel compte est
// connecté, donc on n'agit pas. « Pas su » ne vaut pas « oui ».
const ORIGINE_APP = /^https:\/\/(cancale-v67(-ten)?\.vercel\.app|(www\.)?vrm\.center)/;
// Ce que l'app peut faire passer par `exec`, et RIEN d'autre (§3 : jamais de
// suppression, jamais de requête arbitraire).
// 5.135 (3 octobre, « la messagerie intégrée, répondre et faire l'offre ») :
// LIRE une conversation, et les trois gestes d'offre — toujours sur SON clic
// dans l'app, un par un, au nom du compte connecté (garde stricte). Rien qui
// supprime, rien d'arbitraire. Une LECTURE ne compte pas dans le plafond
// horaire (elle n'engage rien) ; un geste, si.
const EXEC_PERMIS = [
  { methode: 'POST', chemin: /^\/api\/v2\/conversations\/\d+\/replies$/ },   // répondre à un message
  { methode: 'GET',  chemin: /^\/api\/v2\/conversations\/\d+$/, lecture: true }, // lire le fil
  { methode: 'PUT',  chemin: /^\/api\/v2\/transactions\/\d+\/offer_requests\/\d+\/(accept|reject)$/ }, // trancher une offre
  { methode: 'POST', chemin: /^\/api\/v2\/transactions\/\d+\/offers$/ },     // faire une offre
];
function execPermis(methode, endpoint) {
  const e = String(endpoint || '');
  return EXEC_PERMIS.find((p) => p.methode === methode && p.chemin.test(e)) || null;
}
async function gardeStricte(uid, acc, opts = {}) {
  const actif = await compteConnecte(acc && acc.domain);
  if (!actif) {
    return { ok: false, code: 'vinted-absent',
             error: "aucun compte Vinted n'est connecté dans ce Chrome — connecte-toi sur vinted.fr avec ce compte d'abord" };
  }
  if (String(actif) !== String(uid)) {
    return { ok: false, code: 'vinted-autre', actif: String(actif),
             error: "ton navigateur est connecté à un autre compte Vinted — bascule sur celui-ci sur vinted.fr d'abord" };
  }
  if (opts.lecture) return null;            // lire n'engage rien : pas de plafond
  const c = await compterAction(String(uid));
  if (!c.ok) {
    return { ok: false, code: 'plafond',
             error: `${ACTIONS_MAX_HEURE} actions sur ce compte dans l'heure — on s'arrête là pour ne pas attirer l'attention. Réessaie plus tard.` };
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// UNE REQUÊTE VINTED À LA FOIS, QUELLE QUE SOIT LA SOURCE (§3)
// ══════════════════════════════════════════════════════════════════════════
// La visite (génération des bordereaux, réponses, offres), une commande de
// l'app et un clic : sans file commune, deux d'entre elles pouvaient mettre des
// requêtes en vol en même temps — mesuré, rien ne les sérialisait. Une simple
// chaîne de promesses en mémoire : si le service worker meurt, rien n'est en
// vol de toute façon (§4.9 ne s'applique qu'aux DONNÉES à garder).
// Une demande de l'app (`exec`) : origine de l'app, liste blanche, compte
// connecté (garde stricte), puis la requête DANS la file Vinted (une à la fois).
async function executerPourApp(msg, sender) {
  const src = (sender && sender.origin) || (sender && sender.url) || '';
  if (!ORIGINE_APP.test(src)) return { ok: false, code: 'origine', error: 'origine non autorisee' };
  const methode = String(msg.method || 'POST').toUpperCase();
  const permis = execPermis(methode, msg.endpoint);
  if (!permis) return { ok: false, code: 'non-autorise', error: 'action non autorisée depuis l\'app' };
  const accts = await getStoredAccounts();
  const acc = accts.find((a) => String(a.vinted_user_id) === String(msg.uid));
  if (!acc) return { ok: false, error: 'compte introuvable' };
  const stop = await gardeStricte(msg.uid, acc, { lecture: !!permis.lecture });
  if (stop) return stop;
  const r = await avecVinted(() => (methode === 'GET' ? vintedGet(acc, msg.endpoint) : vintedSend(acc, methode, msg.endpoint, msg.body)));
  if (!permis.lecture) logActivity(r.ok ? `✉️ ${methode} ${String(msg.endpoint).replace(/\d{4,}/g, '…')} — fait depuis l'app` : `⚠️ ${methode} depuis l'app : Vinted a refusé (${r.status})`);
  return { ok: !!r.ok, status: r.status, data: r.json,
           error: r.ok ? '' : ((r.json && (r.json.message || r.json.error)) || `erreur ${r.status}`) };
}
let _fileVinted = Promise.resolve();
function avecVinted(fn) {
  const suite = _fileVinted.then(() => fn(), () => fn());
  _fileVinted = suite.then(() => {}, () => {});
  return suite;
}

// ══════════════════════════════════════════════════════════════════════════
// LES COMMANDES DE L'APP (5.129) — « c'est l'application qui contrôle
// l'extension » (Julien, 2 octobre)
// ══════════════════════════════════════════════════════════════════════════
// L'app demande ; l'extension vérifie (garde STRICTE, plafond), exécute dans la
// file, et prévient l'app à chaque étape. L'état de chaque demande vit dans
// `chrome.storage.local` (§4.9 : un service worker meurt au bout de 30 s).
const APP_URLS = ['https://vrm.center/*', 'https://www.vrm.center/*', 'https://cancale-v67.vercel.app/*', 'https://cancale-v67-ten.vercel.app/*'];
const CMD_EN_COURS = ['file', 'generation', 'pdf'];
async function lireCmds() {
  try { return (await chrome.storage.local.get('vrmCmds')).vrmCmds || {}; } catch (_) { return {}; }
}
async function majCmd(jobId, patch) {
  const cmds = await lireCmds();
  const t = Date.now();
  // On ne garde qu'un jour d'historique : c'est un état, pas un journal.
  for (const k of Object.keys(cmds)) if (t - Number((cmds[k] && cmds[k].at) || 0) > 86400000) delete cmds[k];
  cmds[jobId] = Object.assign({}, cmds[jobId] || {}, patch, { at: t });
  try { await chrome.storage.local.set({ vrmCmds: cmds }); } catch (_) {}
  notifierApp(Object.assign({ type: 'cmd', jobId }, cmds[jobId]));
  return cmds[jobId];
}
// ── « LES INFORMATIONS CIRCULENT-ELLES BIEN ? » ─────────────────────────────
// Le petit écran de l'extension le dit, plateforme par plateforme : dernier
// envoi réussi, dernier envoi refusé. MESURÉ aux points d'écriture, jamais
// supposé (« pas su » ≠ « oui ») — c'est `chrome.storage` (§4.9).
async function noterFlux(plateforme, ok) {
  try {
    const cur = (await chrome.storage.local.get('vrmFlux')).vrmFlux || {};
    const p = cur[plateforme] || {};
    if (ok) p.okAt = Date.now(); else p.koAt = Date.now();
    cur[plateforme] = p;
    await chrome.storage.local.set({ vrmFlux: cur });
  } catch (_) {}
}
// Prévenir les onglets de l'app (bridge.js relaie à la page). Sans onglet
// ouvert : rien, et l'app relira l'état au retour (`cmd:statut`).
async function notifierApp(evt) {
  try {
    const tabs = await chrome.tabs.query({ url: APP_URLS });
    for (const t of tabs || []) {
      try { chrome.tabs.sendMessage(t.id, { __vmrEvt: true, evt }, () => { void chrome.runtime.lastError; }); } catch (_) {}
    }
  } catch (_) {}
}
// Le login lisible du compte connecté (l'app l'écrit à côté du bouton grisé :
// « Chrome est connecté sur X »). Mémorisé 5 min, aucune requête Vinted.
async function loginDe(uid) {
  if (!uid) return '';
  try {
    const memo = (await chrome.storage.local.get('vrmLogins')).vrmLogins || {};
    if (memo.at && Date.now() - memo.at < 300000 && memo.map) return memo.map[uid] || '';
    const accts = await getStoredAccounts();
    const map = {}; for (const a of accts || []) map[String(a.vinted_user_id)] = a.login || '';
    if ((accts || []).length) await chrome.storage.local.set({ vrmLogins: { at: Date.now(), map } });
    return map[uid] || '';
  } catch (_) { return ''; }
}
// ── LA PETITE CARTE EN BAS À DROITE (vrm-badge.js) ──────────────────────────
// Julien, 2 octobre : « il ne doit pas y avoir d'informations autres que les
// moyens de connexion, le compte utilisé, le compte connecté, si les
// informations circulent bien ». ZÉRO requête Vinted, ZÉRO lecture de données :
// la session VRM, le cookie du site, et ce que les écritures ont noté.
// Trois états partout : une information qu'on n'a pas est `null` (« pas su »),
// jamais un « oui » ni un « non » inventé.
const BASCULE_VISIBLE_MS = 7 * 86400000;
async function etatSite(url) {
  const plateforme = plateformeDe(url);
  let version = ''; try { version = chrome.runtime.getManifest().version; } catch (_) {}
  const vrm = await authEtat().catch(() => null);
  let local = {};
  try { local = await chrome.storage.local.get(['vrmFlux', 'vrmBascule', 'vrmLbcCompte']); } catch (_) {}
  // Le compte du SITE : sur Vinted le cookie le dit (une identité) ; sur
  // Leboncoin le dernier compte « moi » vu ; eBay et Vestiaire ne sont pas
  // encore captés par VRM — on le dit plutôt que de laisser croire.
  let site = null;
  if (plateforme === 'vinted') {
    let dom = 'www.vinted.fr'; try { dom = new URL(url).hostname || dom; } catch (_) {}
    const uid = await compteConnecte(dom);
    site = uid ? { id: String(uid), nom: await loginDe(String(uid)) } : { id: null, nom: '' };
  } else if (plateforme === 'leboncoin') {
    const c = local.vrmLbcCompte;
    site = c && c.name ? { id: c.id || null, nom: c.name, type: c.type || '' } : { id: null, nom: '' };
  }
  const capte = plateforme === 'vinted' || plateforme === 'leboncoin';
  const flux = capte ? ((local.vrmFlux || {})[plateforme] || {}) : null;
  const b = local.vrmBascule;
  const bascule = b && Date.now() - Number(b.at || 0) < BASCULE_VISIBLE_MS ? b : null;
  return { ok: true, plateforme, capte, version, vrm, site, flux, bascule };
}

// L'état que l'app interroge toutes les 20 s : ZÉRO requête Vinted (cookie,
// stockage local, session VRM).
async function etatPourApp() {
  let version = ''; try { version = chrome.runtime.getManifest().version; } catch (_) {}
  const uid = await compteConnecte('www.vinted.fr');
  const vrm = await authEtat().catch(() => null);
  const cmds = await lireCmds();
  // L'interrupteur LOCAL d'avant (ancien panneau) : l'app l'affiche tant
  // qu'elle n'a pas son propre réglage — sinon elle dirait « éteint » pendant
  // que l'extension accepte.
  let offresAutoLocal = false;
  try { offresAutoLocal = !!(((await chrome.storage.local.get('vrmAutoOffres')).vrmAutoOffres || {}).actif); } catch (_) {}
  return { ok: true, version, vrm, vinted: uid ? { uid: String(uid), login: await loginDe(String(uid)) } : null, cmds, offresAutoLocal };
}
// Le bordereau de CETTE vente est-il déjà rangé (avec son PDF) ? Une lecture
// scalaire (§4.4) — `null` = la base n'a pas répondu (« pas su » ≠ « non »).
async function labelDejaRange(uid, tx) {
  const rows = await sbGet(`app_data?id=eq.harvest_${uid}_label_${tx}&meta->>_pdf=eq.true&select=id,cap:meta->>capturedAt`);
  if (rows === null) return null;
  return Array.isArray(rows) && rows.length ? rows[0] : false;
}
// ══════════════════════════════════════════════════════════════════════════
// PUBLIER DEPUIS L'APP (5.130) — les panneaux Leboncoin et eBay sont retirés
// ══════════════════════════════════════════════════════════════════════════
// Julien, 2 octobre : « tout doit être centralisé dans VRM ». La liste vit dans
// l'app ; l'app ne transmet qu'un IDENTIFIANT d'annonce, jamais un contenu : la
// paire est relue dans la file que l'extension construit elle-même
// (`buildLbcData` / `buildEbayData` — mêmes règles que l'app, §11). Une paire
// prouvée vendue, décochée ou déjà publiée n'y est plus : refusée.
// ⚠️ Aucune requête vers Leboncoin, eBay ou Vinted ici : on MÉMORISE la paire et
//    on OUVRE la page de dépôt ; c'est lbc.js / ebay.js qui remplissent (et, sur
//    Leboncoin, publient sans booster — décision du 20 septembre).
async function publierDepuisApp(msg) {
  const cmd = String(msg.cmd || '');
  const id = String(msg.id || '');
  if (cmd === 'lbcQuota') {
    const ok = await setLbcLimit(msg.limit, msg.plan);
    notifierApp({ type: 'maj', quoi: 'lbc' });
    return ok === false ? { accepte: false, code: 'lecture', raison: "la base n'a pas répondu — réessaie dans un moment" } : { accepte: true, etape: 'fait' };
  }
  if (!/^\d+$/.test(id)) return { accepte: false, code: 'invalide', raison: 'annonce inconnue' };
  if (cmd === 'lbcMarque' || cmd === 'ebayMarque') {
    const pose = msg.etat === 'posted';
    if (cmd === 'lbcMarque') { if (pose) await markLbcPosted(id); else await unmarkLbcPosted(id); }
    else await markEbayPosted(id, pose);
    notifierApp({ type: 'maj', quoi: cmd === 'lbcMarque' ? 'lbc' : 'ebay' });
    return { accepte: true, etape: 'fait' };
  }
  const lbc = cmd === 'lbcPublier';
  const r = lbc ? await buildLbcData() : await buildEbayData();
  const preuveKO = lbc ? !!(r && r.stats && r.stats.preuveKO) : !!(r && r.preuveKO);
  if (preuveKO) return { accepte: false, code: 'preuve', raison: "je n'ai pas pu vérifier qu'elle n'est pas déjà vendue — réessaie dans un moment" };
  const ad = ((r && r.queue) || []).find((a) => String(a.id) === id);
  if (!ad) return { accepte: false, code: 'absente', raison: "elle n'est plus dans la file (vendue, déjà publiée, ou décochée)" };
  const jobId = (lbc ? 'lbc:' : 'ebay:') + id;
  if (lbc) await chrome.storage.local.set({ vrmPendingAd: { ad: Object.assign({}, ad, { publier: true }), at: Date.now() } });
  else await chrome.storage.local.set({ vrmPendingEbay: { ad, at: Date.now() } });
  await majCmd(jobId, { etape: 'depot', id, numero: ad.numero || '' });
  try { await chrome.tabs.create({ url: lbc ? 'https://www.leboncoin.fr/deposer-une-annonce' : 'https://www.ebay.fr/sl/sell', active: true }); } catch (_) {}
  return { accepte: true, jobId, etape: 'depot' };
}
async function executerCommande(msg) {
  // « Relis mes ventes » : l'app vient d'ouvrir Ventes / Colis / Ma journée.
  // UNE lecture (my_orders) du compte connecté dans Chrome — jamais d'un autre —
  // bornée par le même délai que la visite (90 s) : ouvrir l'app dix fois ne
  // fait pas dix requêtes. C'est une LECTURE de ses propres ventes (§3).
  if (msg && msg.cmd === 'ventes') {
    const uid = await compteConnecte('www.vinted.fr');
    if (!uid) return { accepte: false, code: 'vinted-absent', raison: "aucun compte Vinted connecté dans ce Chrome" };
    const dv = (await chrome.storage.local.get('vrmDerniereVente')).vrmDerniereVente || {};
    if (Date.now() - Number(dv[uid] || 0) < VENTES_DELAI_MS) return { accepte: true, etape: 'recent' };
    dv[uid] = Date.now();
    await chrome.storage.local.set({ vrmDerniereVente: dv });
    avecVinted(() => rafraichirVentes(uid)).catch(() => {});
    return { accepte: true, etape: 'ventes' };
  }
  if (msg && /^(lbcPublier|lbcMarque|lbcQuota|ebayPreparer|ebayMarque)$/.test(String(msg.cmd || ''))) return await publierDepuisApp(msg);
  if (!msg || msg.cmd !== 'bordereau') return { accepte: false, code: 'inconnue', raison: 'commande inconnue' };
  const uid = String(msg.uid || ''), tx = String(msg.tx || '');
  if (!/^\d+$/.test(uid) || !/^\d+$/.test(tx)) return { accepte: false, code: 'invalide', raison: 'vente incomplète' };
  const jobId = `bord:${uid}:${tx}`;
  const cur = (await lireCmds())[jobId];
  // Déjà en cours (deux clics, deux onglets) : on renvoie la même demande.
  if (cur && CMD_EN_COURS.includes(cur.etape) && Date.now() - Number(cur.at || 0) < 120000) return { accepte: true, jobId, etape: cur.etape, deja: true };
  const accts = await getStoredAccounts();
  const acc = (accts || []).find((a) => String(a.vinted_user_id) === uid);
  if (!acc) return { accepte: false, code: 'compte', raison: 'compte introuvable dans VRM' };
  // Idempotence : le PDF est déjà rangé → rien à demander à Vinted.
  if (await labelDejaRange(uid, tx)) { await majCmd(jobId, { etape: 'fait', uid, tx, deja: true }); return { accepte: true, jobId, etape: 'fait', deja: true }; }
  const stop = await gardeStricte(uid, acc);
  if (stop) return { accepte: false, code: stop.code, raison: stop.error, actif: stop.actif || null, actifLogin: stop.actif ? await loginDe(stop.actif) : '' };
  await majCmd(jobId, { etape: 'file', uid, tx, code: null, raison: null });
  // L'exécution part dans la file ; l'app reçoit l'accusé TOUT DE SUITE.
  avecVinted(async () => {
    try {
      await noterDiag('commande_bordereau');
      // 1. Le bordereau existe peut-être déjà chez Vinted (commandé à la main,
      //    ou par la visite) : on regarde AVANT de commander — sinon Vinted
      //    répond 400 « impossible de générer » (course mesurée le 28 sept.).
      const connu = { t: null, vus: new Set() };
      let r = await recupererLabel(acc, uid, tx, connu);
      if (!r.ok) {
        if (!connu.t) {
          await majCmd(jobId, { etape: 'generation' });
          const g = await genererBordereau(uid, tx, { gardeFaite: true });
          if (!g.ok && !g.deja) { await majCmd(jobId, { etape: 'echec', code: 'vinted-' + (g.status || '?'), raison: g.error || 'Vinted a refusé' }); return; }
        }
        await majCmd(jobId, { etape: 'pdf' });
        r = await recupererLabelInsiste(acc, uid, tx);
      }
      if (r.ok) {
        await majCmd(jobId, { etape: 'fait' });
        notifierApp({ type: 'maj', quoi: 'label', uid, tx });
      } else {
        // Le PDF n'est pas encore prêt chez Vinted : l'app propose d'ouvrir la
        // vente pour le télécharger à la main. On pose le RENDEZ-VOUS (15 min,
        // usage unique) : le PDF téléchargé sera relié à CETTE vente — une
        // identité, pas une devinette, même s'il y a deux colis sur le compte.
        await attendreBordereau(uid, tx);
        await majCmd(jobId, { etape: 'genere_sans_pdf', raison: r.raison || "le PDF n'est pas encore prêt chez Vinted" });
      }
    } catch (e) {
      await majCmd(jobId, { etape: 'echec', code: 'erreur', raison: String(e && e.message || e).slice(0, 120) });
    }
  });
  return { accepte: true, jobId, etape: 'file' };
}

// Renvoie null si l'action peut partir, sinon l'objet d'erreur à renvoyer tel quel.
async function garde(uid, acc) {
  const actif = await compteConnecte(acc && acc.domain);
  if (actif && String(actif) !== String(uid)) {
    return { ok: false, code: 'autre-compte',
             error: "ton navigateur est connecté à un autre compte — bascule sur celui-ci sur Vinted avant d'agir (sinon Vinted voit deux comptes depuis la même session)" };
  }
  const c = await compterAction(String(uid));
  if (!c.ok) {
    return { ok: false, code: 'trop-d-actions',
             error: `${ACTIONS_MAX_HEURE} actions sur ce compte dans l'heure — on s'arrête là pour ne pas attirer l'attention. Réessaie plus tard.` };
  }
  return null;
}

// ── RÉPONDRE À UNE OFFRE, EN UN CLIC DEPUIS LE PANNEAU ──────────────────────
// Julien voulait que ça parte tout seul dès qu'une offre arrive. Refusé, et la
// raison n'est pas le risque de blocage : accepter une offre engage une VENTE
// FERME qu'on n'annule pas, et le champ qui dit « cette offre est encore en
// attente » n'a jamais été observé (aucune offre ouverte dans les conversations
// captées — que des 20 « acceptée » et 30 « refusée »). Un moteur qui décide
// seul sur un champ inconnu peut vendre une paire à n'importe quel prix.
// Ici : un clic = une requête, et il vient de lui.
//
// Les deux routes viennent de SES propres actions, captées par `storeWriteReq`
// sur 5 comptes (jamais devinées) :
//   PUT  /api/v2/transactions/{tx}/offer_requests/{oid}/accept   (corps vide)
//   PUT  /api/v2/transactions/{tx}/offer_requests/{oid}/reject   (corps vide)
//   POST /api/v2/transactions/{tx}/offers  {"offer":{"price":"32","currency":"EUR"}}
// ══════════════════════════════════════════════════════════════════════════════
// ACCEPTER AUTOMATIQUEMENT UNE OFFRE ≥ TON PRIX PLANCHER
// ══════════════════════════════════════════════════════════════════════════════
// Julien, plusieurs fois : « pour chaque annonce que je poste je mets un prix
// minimum que l'app accepte dès que je reçois une offre ».
//
// ⚠️ CE QUI BLOQUAIT AVANT, ET QUI EST LEVÉ (26 août). Le refus précédent
// n'était pas de principe : accepter engage une VENTE FERME qu'on n'annule pas,
// et le champ qui dit « cette offre est ENCORE EN ATTENTE » n'avait jamais été
// observé — les 21 offres captées étaient toutes en 20 (acceptée) ou 30
// (refusée). Un moteur aurait tranché sur un code inconnu, avec de l'argent au
// bout. Relevé du 26 août sur **326 offres** dans 557 conversations captées :
//   10 = En attente (4)   ·   20 = Offre acceptée (118)
//   30 = Refusée (195)    ·   40 = Annulée (9)
// Le code « en attente » EXISTE et vaut **10**. On sait donc lire l'état, et le
// moteur peut être écrit sans deviner.
//
// ⚠️ CE QUI DÉCIDE, C'EST TOI, À L'AVANCE. Le plancher est posé annonce par
// annonce : accepter au-dessus n'est pas une décision de la machine, c'est
// l'exécution d'un ordre déjà donné — comme un ordre à cours limité. Sans
// plancher sur CETTE annonce, on ne touche à rien.
const OFFRE_EN_ATTENTE = 10;                 // relevé en base, pas deviné
const OFFRES_MAX_PAR_VISITE = 3;             // limite de VOLUME, pas un rythme déguisé

// Le prix plancher d'une annonce. ⚠️ UN SEUL PROPRIÉTAIRE : l'app l'écrit dans
// `vinted_annonce_numeros[itemId].minPrice` (elle est déjà propriétaire de cette
// structure — numéro, prix d'achat, boost). L'extension le LIT, et garde sa
// propre ligne `panel_min_prices` en repli pour ce qui a été saisi ici avant.
// Deux écrivains sur la même donnée finissent toujours par diverger (§5.15).
async function planchers() {
  const out = {};
  try {
    const rows = await sbGet('app_data?id=eq.panel_min_prices&select=data');
    const d = (rows && rows[0] && rows[0].data) || {};
    for (const k in d) { const n = Number(d[k]); if (isFinite(n) && n > 0) out[String(k)] = n; }
  } catch (_) {}
  try {
    const rows = await sbGet('app_data?id=eq.main&select=nums:data->vinted_annonce_numeros');
    const nums = (rows && rows[0] && rows[0].nums) || {};
    for (const k in nums) {
      const n = Number(nums[k] && nums[k].minPrice);
      if (isFinite(n) && n > 0) out[String(k)] = n;      // l'app prime
    }
  } catch (_) {}
  return out;
}

// Les offres de CE compte qui attendent VRAIMENT une réponse, lues dans les
// conversations déjà captées (aucun appel Vinted ajouté).
async function offresEnAttente(uid) {
  const out = [];
  try {
    // ⚠️ MÊME PROJECTION QUE LE PANNEAU (§4.4) : sur ses 939 conversations,
    //    `select=id,data` rend 4,3 Mo quand les champs utiles tiennent en
    //    994 Ko — et ce chemin-ci tourne à CHAQUE visite sur Vinted.
    const rows = (await sbGetTout(`app_data?id=like.harvest_${uid}_conv_*&select=id,cap:data->>capturedAt,cid:data->payload->conversation->>id,opp:data->payload->conversation->opposite_user->>id,descr:data->payload->conversation->>description,it:data->payload->conversation->transaction->>item_id,msgs:data->payload->conversation->messages`) || [])
      .map((r) => ({ id: r.id, data: { capturedAt: r.cap, payload: { conversation: {
        id: r.cid, opposite_user: r.opp != null ? { id: Number(r.opp) } : null,
        description: r.descr, transaction: r.it != null ? { item_id: r.it } : null,
        messages: Array.isArray(r.msgs) ? r.msgs : [],
      } } } }));
    // ⚠️ TRI INLINÉ, PAS `parFraicheur` : ce helper vit DANS `buildPanelData`.
    //    L'appeler d'ici lève une ReferenceError avalée par le try/catch — la
    //    fonction rendait donc toujours une liste vide, en silence. Troisième
    //    fois que ce piège se présente (§5.46, §5.48) : dans ce fichier, un
    //    helper n'existe que dans la fonction où il est déclaré.
    rows.sort((a, b) => (Date.parse((b.data && b.data.capturedAt) || '') || 0) - (Date.parse((a.data && a.data.capturedAt) || '') || 0));
    const vus = new Set();
    for (const r of rows) {
      const p = (r.data && r.data.payload) || {};
      const c = p.conversation || p;
      const cid = String(c.id || ''); if (!cid || vus.has(cid)) continue; vus.add(cid);
      const opp = (c.opposite_user && c.opposite_user.id) != null ? c.opposite_user.id : null;
      let derniere = null;
      for (const m of (Array.isArray(c.messages) ? c.messages : [])) {
        if (!m || m.entity_type !== 'offer_request_message') continue;
        const e = m.entity || {};
        // Quatre conditions, toutes nécessaires :
        //  • c'est l'ACHETEUR qui propose (sinon c'est ma propre contre-offre) ;
        //  • l'offre est la COURANTE (une plus récente l'a peut-être remplacée) ;
        //  • Vinted la dit EN ATTENTE (10), pas acceptée/refusée/annulée ;
        //  • le libellé ne dit rien de tranché non plus (ceinture + bretelles).
        if (opp != null && e.user_id !== opp) continue;
        if (e.current === false) continue;
        if (e.status !== OFFRE_EN_ATTENTE) continue;
        if (/accept|refus|reject|expir|annul|cancel|retir/i.test(String(e.status_title || ''))) continue;
        const px = e.price && (e.price.amount != null ? e.price.amount : e.price);
        const prix = Number(String(px == null ? '' : px).replace(',', '.'));
        if (!isFinite(prix) || prix <= 0) continue;      // sans montant, on ne décide rien
        if (e.transaction_id == null || e.offer_request_id == null) continue;
        derniere = { conv: cid, prix,
          tx: String(e.transaction_id), oid: String(e.offer_request_id),
          item: String((c.transaction && c.transaction.item_id) || ''),
          titre: String(c.description || '') };
      }
      if (derniere) out.push(derniere);
    }
  } catch (_) { /* forme inattendue → aucune offre plutôt qu'une fausse */ }
  return out;
}

// Le moteur. Appelé à chaque visite sur Vinted, APRÈS la moisson (sinon on
// travaillerait sur des offres périmées).
// ── QUI ALLUME L'ACCEPTATION AUTOMATIQUE ? L'APP (5.130) ────────────────────
// Julien, 2 octobre : « tout doit être centralisé dans VRM ». L'interrupteur
// vivait dans le panneau de Vinted, qui est retiré : il passe dans Réglages de
// l'app (`vinted_offres_auto`, ligne `main` — l'extension la LIT, ne l'écrit
// jamais). Trois cas, jamais deux :
// - un booléen dans l'app (il a touché l'interrupteur) : c'est lui qui décide ;
// - rien dans l'app (jamais touché) : on garde l'interrupteur local d'avant —
//   une nouveauté n'éteint pas ce qui marchait ;
// - la base n'a pas répondu : on n'allume RIEN (« pas su » ne vaut pas « oui »).
async function offresAutoActif() {
  const reglages = await lireMain(['vinted_offres_auto']);
  if (reglages === null) return false;
  const v = reglages.vinted_offres_auto;
  if (v === true || v === false) return v;
  try { return !!(((await chrome.storage.local.get('vrmAutoOffres')).vrmAutoOffres || {}).actif); } catch (_) { return false; }
}
async function autoAccepterOffres(uid) {
  try {
    if (!(await offresAutoActif())) return 0;            // ÉTEINT PAR DÉFAUT
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    // ⚠️ Jamais au nom d'un compte qui n'est pas celui connecté dans cet onglet :
    //    c'est LE signal multi-comptes que Vinted sanctionne (§48).
    if (await garde(uid, acc)) return 0;

    const [offres, mins] = await Promise.all([offresEnAttente(uid), planchers()]);
    if (!offres.length) return 0;
    const st = (await chrome.storage.local.get('vrmOffresFaites')).vrmOffresFaites || {};
    const limite = Date.now() - 7 * 86400000;
    for (const k in st) if (!st[k] || st[k] < limite) delete st[k];

    let faites = 0;
    for (const o of offres) {
      if (faites >= OFFRES_MAX_PAR_VISITE) break;        // limite de volume
      if (st[o.oid]) continue;                           // déjà traitée : jamais deux fois
      const min = o.item ? mins[o.item] : null;
      if (!(isFinite(min) && min > 0)) continue;         // pas de plancher → on ne touche à rien
      if (o.prix < min) continue;                        // en dessous : c'est à toi de contrer
      const r = await repondreOffre({ uid, tx: o.tx, oid: o.oid, quoi: 'accept' });
      st[o.oid] = Date.now();
      await chrome.storage.local.set({ vrmOffresFaites: st });
      if (r && r.ok) {
        faites += 1;
        logActivity(`✅ Offre de ${o.prix.toFixed(2)} € acceptée automatiquement (ton minimum : ${min} €) — ${o.titre.slice(0, 40)}`);
        // ⚠️ Julien (16 sept., redemandé) : « elle accepte ET répond —
        //    "bonjour, je viens d'accepter votre offre" — et répond à sa
        //    question ». UN message part (salut fixe + réponse IA si question).
        await saluerAcheteurApresOffre({ uid, acc, conv: o.conv, titre: o.titre });
      } else {
        logActivity(`⚠️ Offre de ${o.prix.toFixed(2)} € : Vinted a refusé (${(r && r.error) || '?'})`);
        if (r && r.code) break;                          // garde-fou atteint : on arrête le lot
      }
    }
    return faites;
  } catch (_) { return 0; }
}

// ── SALUT + RÉPONSE APRÈS UNE OFFRE ACCEPTÉE ────────────────────────────────
// Julien (16 sept., redemandé le 3 oct.) : quand on accepte, il faut dire bonjour
// ET répondre à la question de l'acheteur. UN SEUL message part (salut fixe +
// réponse IA si question) : moins de requêtes Vinted, jamais deux « bonjour ».
// Garde-fous §3 : compte de l'onglet, plafond horaire au moment de l'envoi,
// jamais deux fois le même message. L'IA est GATÉE (seuil de confiance, rien sur
// réponse vide) : mieux vaut un blanc qu'un faux — on envoie alors le salut seul.
const OFFRE_SALUT = 'Bonjour, je viens d’accepter votre offre, merci beaucoup ! 😊';
async function saluerAcheteurApresOffre({ uid, acc, conv, titre }) {
  try {
    if (!conv) return;
    const det = await convDernierMessageId(uid, String(conv));
    if (!det) return;                                   // conversation pas captée : rien à envoyer
    if (det.allowReply === false) return;               // Vinted refuse la réponse ici
    // Lire-fusionner-réécrire, garde du dossier : « pas su » ne vaut pas « jamais
    // salué » — on n'envoie pas à l'aveugle, et on ne réécrira pas sur du vide.
    const lu = await sbGet('app_data?id=eq.panel_msg_repondus&select=data');
    if (lu === null) return;
    const deja = (lu[0] && lu[0].data) || {};
    const cle = String(conv) + ':offre';
    if (deja[cle]) return;                              // déjà salué sur cette offre : jamais deux fois
    // La question de l'acheteur. Si le moteur de messages (qui tourne AVANT dans
    // la visite) y a déjà répondu — clé `conv:idMessage` présente —, on ne
    // ré-répond pas : on envoie le salut seul (pas de double réponse).
    let texte = OFFRE_SALUT, intention = '', confiance = 0;
    const dejaRepondu = det.id && deja[String(conv) + ':' + det.id];
    if (det.body && !dejaRepondu) {
      const sugg = await aiReply(det.body, det.article || titre || '', det.price);
      const rep = (sugg && sugg.ok && Array.isArray(sugg.suggestions) && sugg.suggestions[0]
        && String(sugg.suggestions[0].text || '').trim()) || '';
      if (rep && Number(sugg.confidence || 0) >= MSG_MIN_CONFIANCE) {
        texte = OFFRE_SALUT + '\n\n' + rep;
        intention = String(sugg.intent || ''); confiance = Number(sugg.confidence || 0);
      }
      // IA qui hésite ou se tait ⇒ salut seul (mieux vaut un blanc qu'un faux).
    }
    const stop = await garde(uid, acc);                 // compte de l'onglet + plafond horaire
    if (stop) return;
    const r = await vintedSend(acc, 'POST', `/api/v2/conversations/${conv}/replies`,
      { reply: { body: texte, photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } });
    noterDiag(r.ok ? 'offre_salut_envoye' : `offre_salut_refuse_${r.status}`);
    if (!r.ok) return;
    // Il doit pouvoir relire ce que j'ai dit en son nom.
    const neuf = Object.assign({}, deja, { [cle]: { conv: String(conv), at: new Date().toISOString(),
      texte: texte.slice(0, 400), intention, confiance, apresOffre: true, titre: String(titre || '').slice(0, 80) } });
    await supabaseUpsert('app_data', [{ id: 'panel_msg_repondus', data: neuf }], 'id');
    logActivity(`💬 Message envoyé à l'acheteur — « ${texte.slice(0, 50)}${texte.length > 50 ? '…' : ''} »`);
  } catch (_) { /* un salut raté n'annule JAMAIS l'acceptation */ }
}

async function repondreOffre({ uid, tx, oid, quoi, prix }) {
  if (!uid || !tx) return { ok: false, error: 'offre incomplète' };
  if (quoi !== 'contre' && !oid) return { ok: false, error: 'offre incomplète' };
  const accts = await getStoredAccounts();
  const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
  if (!acc) return { ok: false, error: 'compte introuvable' };
  const stop = await garde(uid, acc); if (stop) return stop;   // anti-blocage
  let r;
  if (quoi === 'accept') r = await vintedSend(acc, 'PUT', `/api/v2/transactions/${tx}/offer_requests/${oid}/accept`, null);
  else if (quoi === 'reject') r = await vintedSend(acc, 'PUT', `/api/v2/transactions/${tx}/offer_requests/${oid}/reject`, null);
  else if (quoi === 'contre') {
    const p = Number(prix);
    if (!isFinite(p) || p <= 0) return { ok: false, error: 'prix invalide' };
    r = await vintedSend(acc, 'POST', `/api/v2/transactions/${tx}/offers`, { offer: { price: String(p), currency: 'EUR' } });
  } else return { ok: false, error: 'action inconnue' };
  const mot = quoi === 'accept' ? 'acceptée' : quoi === 'reject' ? 'refusée' : `contrée à ${prix} €`;
  logActivity(r.ok ? `💶 Offre ${mot}` : `⚠️ Offre ${mot} : Vinted a refusé (${r.status})`);
  return { ok: !!r.ok, status: r.status, error: r.ok ? '' : ((r.json && (r.json.message || r.json.error)) || `erreur ${r.status}`) };
}

// ══════════════════════════════════════════════════════════════════════════════
// LE COFFRE — chaque annonce enregistrée EN ENTIER, chez toi
// ══════════════════════════════════════════════════════════════════════════════
// Demande de Julien : « faire un cloud avec la possibilité d'enregistrer
// intégralement une annonce ». Ça protège son stock pour de vrai : si une
// annonce disparaît (suppression par erreur, compte fermé, republication ratée),
// il garde le texte ET les photos.
//
// ⚠️ CHOIX DE STOCKAGE — les photos ne vont PAS en base. 119 annonces × plusieurs
// images = des centaines de Mo, et c'est très exactement ce qui a fait exploser
// le quota d'égress en août (§34, le widget qui retéléchargeait les PDF). Le
// coffre garde le TEXTE COMPLET + les URL des photos (quelques Ko par annonce) ;
// les fichiers se téléchargent à la demande dans un dossier, chez lui.
//
// ⚠️ IL NE DÉPEND PAS de la capture de fiche (`harvest_*_item_*`), qui ne range
// rien aujourd'hui pour une raison encore inconnue (cf. `noterDiag`). Il se
// construit avec CE QU'ON A : la fiche si elle existe, sinon les données du
// dressing (titre, prix, marque, taille, photo). Il s'enrichit tout seul ensuite.
function coffreRecord(uid, it, fiche) {
  const f = fiche || {};
  const photos = [];
  const push = (u) => { const s = String(u || ''); if (s && !photos.includes(s)) photos.push(s); };
  if (Array.isArray(f.photos)) for (const p of f.photos) push(p && (p.full_size_url || p.url));
  // ⚠️ Le DRESSING porte lui aussi toutes les photos de l'annonce. On ne les
  // lisait pas (seulement `it.photo`, la vignette) : le coffre gardait UNE
  // photo pour une annonce qui en a six, et republier repartait quasi nu.
  if (Array.isArray(it && it.photos)) for (const p of it.photos) push(p && (p.full_size_url || p.url));
  push(it && it.photo && (it.photo.url || it.photo));
  // Combien l'annonce en a VRAIMENT (même quand on n'a pas pu toutes les lire) :
  // sert à dire « 2 photos sur 6 » plutôt que de faire croire au compte complet.
  const nReel = (Array.isArray(f.photos) && f.photos.length)
             || (Array.isArray(it && it.photos) && it.photos.length)
             || (it && it.nPhotos) || photos.length || 0;
  return {
    id: String((it && it.id) || f.id || ''),
    uid: String(uid || ''),
    title: String((f.title || (it && it.title) || '')),
    desc: String(f.description || ''),
    brand: String(f.brand || (f.brand_dto && f.brand_dto.title) || (it && (it.brand || it.brand_title)) || ''),
    size: String(f.size_title || f.size || (it && (it.size || it.size_title)) || ''),
    // L'état ("Très bon état") est aussi sur l'article du dressing — on ne le
    // lisait que sur la fiche, qui n'arrive presque jamais (§46).
    etat: String(f.status || (it && it.status) || ''),
    catalogId: f.catalog_id != null ? f.catalog_id : null,
    price: (f.price && f.price.amount != null) ? f.price.amount
         : ((it && it.price && it.price.amount != null) ? it.price.amount : (it && it.price) ?? null),
    photos,
    nPhotos: Number(nReel) || photos.length || 0,
    url: String((it && it.url) || f.url || ''),
    savedAt: new Date().toISOString(),
  };
}

async function archiverAnnonce(uid, it, fiche) {
  try {
    const rec = coffreRecord(uid, it, fiche);
    if (!rec.id) return false;
    // On ne REMPLACE pas un enregistrement riche par un pauvre : si le coffre a
    // déjà la description et qu'on n'apporte que le dressing, on complète.
    const rows = await sbGet(`app_data?id=eq.coffre_${rec.uid}_${rec.id}&select=data`);
    const anc = (rows && rows[0] && rows[0].data) || null;
    if (anc) {
      if (!rec.desc && anc.desc) rec.desc = anc.desc;
      if (!rec.brand && anc.brand) rec.brand = anc.brand;
      if (!rec.size && anc.size) rec.size = anc.size;
      if (!rec.etat && anc.etat) rec.etat = anc.etat;
      if (rec.catalogId == null && anc.catalogId != null) rec.catalogId = anc.catalogId;
      for (const p of (anc.photos || [])) if (!rec.photos.includes(p)) rec.photos.push(p);
      rec.nPhotos = Math.max(Number(rec.nPhotos) || 0, Number(anc.nPhotos) || 0, rec.photos.length);
      rec.firstSavedAt = anc.firstSavedAt || anc.savedAt;
    } else rec.firstSavedAt = rec.savedAt;
    return await supabaseUpsert('app_data', [{ id: `coffre_${rec.uid}_${rec.id}`, data: rec }], 'id');
  } catch (_) { return false; }
}

// Archivage EN LOT (tout le dressing d'un compte) : une lecture, une écriture.
// Ne dégrade jamais un enregistrement déjà riche (la description vient de la
// fiche, le dressing ne l'a pas — on complète, on n'écrase pas).
async function archiverLot(uid, items, tous) {
  items = items || [];
  // ⚠️ ON NE SORT PLUS QUAND IL N'Y A AUCUNE ANNONCE EN LIGNE : la passe de
  // complétion ci-dessous (le texte lu sur la page) doit tourner même pour un
  // compte dont tout le stock est vendu — c'est justement là qu'on republie.
  if (!items.length && !(tous && tous.length)) return false;
  const rows = await sbGet(`app_data?id=like.coffre_${uid}_*&select=id,data`) || [];
  const anciens = {};
  for (const r of rows) { const d = r && r.data; if (d && d.id) anciens[String(d.id)] = d; }
  // ⚠️ LE COFFRE IGNORAIT LE SEUL ENDROIT OÙ LE TEXTE EXISTE VRAIMENT.
  // Mesuré le 15 août : coffre = 25 annonces, **0 avec description** ; en face,
  // `vinted_item_details` (les fiches lues sur la PAGE de l'annonce, écrites
  // par le panneau) = 23 fiches, **23 avec description ET photos HD**. Les deux
  // magasins ne se parlaient pas : `coffreRecord` n'attendait la description
  // que d'une fiche d'API (`harvest_*_item_*`) qui ne se range quasiment
  // jamais (§46). Résultat : « Republier » n'avait ni texte ni photos alors
  // que les deux étaient en base.
  let pages = {};
  try {
    const dr = await sbGet('app_data?id=eq.vinted_item_details&select=data');
    pages = (dr && dr[0] && dr[0].data) || {};
  } catch (_) { pages = {}; }
  const PUB = /une communaut[ée].{0,60}marques|pour chaque achat effectu|thousands of brands|politique de rembours/i;

  // ⚠️ MESURÉ LE 26 AOÛT : 45 fiches lues sur la page, **28 ne correspondaient à
  // AUCUNE ligne du coffre**. Cause : on n'archivait que les annonces EN LIGNE,
  // alors qu'une fiche est lue dès que Julien ouvre l'annonce — y compris une
  // paire déjà vendue ou retirée. Or c'est exactement celle-là qu'on veut au
  // coffre : le coffre sert à RECRÉER une annonce disparue (§47).
  // On ajoute donc les articles fermés **dont la page a été lue** : la preuve
  // qu'il s'y est intéressé, et l'identité vient de l'id d'annonce Vinted
  // (jamais du titre, §5.34). Borné aux fiches existantes → pas d'inflation.
  const enLigne = new Set(items.map(it => String(it && it.id)));
  const extras = [];
  for (const it of (tous || [])) {
    const id = String(it && it.id || '');
    if (!id || enLigne.has(id) || !pages[id]) continue;
    extras.push(it);
  }

  const out = [];
  for (const it of items.slice(0, 300).concat(extras.slice(0, 200))) {
    const rec = coffreRecord(uid, it, null);
    if (!rec.id) continue;
    // Ce que la page de l'annonce a livré : le vrai texte du vendeur + les
    // photos en grand. On complète, on n'écrase jamais une source plus riche.
    const p = pages[String(rec.id)];
    if (p) {
      const t = String(p.description || '').trim();
      if (!rec.desc && t.length > 15 && !PUB.test(t)) rec.desc = t;
      for (const u of (p.photos || [])) if (u && !rec.photos.includes(u)) rec.photos.push(u);
    }
    const anc = anciens[rec.id];
    if (anc) {
      if (!rec.desc && anc.desc) rec.desc = anc.desc;
      if (!rec.brand && anc.brand) rec.brand = anc.brand;
      if (!rec.size && anc.size) rec.size = anc.size;
      if (!rec.etat && anc.etat) rec.etat = anc.etat;
      if (rec.catalogId == null && anc.catalogId != null) rec.catalogId = anc.catalogId;
      for (const p of (anc.photos || [])) if (!rec.photos.includes(p)) rec.photos.push(p);
      rec.nPhotos = Math.max(Number(rec.nPhotos) || 0, Number(anc.nPhotos) || 0, rec.photos.length);
      rec.firstSavedAt = anc.firstSavedAt || anc.savedAt;
      // Rien de nouveau ? on ne réécrit pas cette ligne (égress inutile).
      if (anc.title === rec.title && String(anc.price) === String(rec.price)
          && (anc.photos || []).length === rec.photos.length && anc.desc === rec.desc
          && Number(anc.nPhotos) === Number(rec.nPhotos)) continue;
    } else rec.firstSavedAt = rec.savedAt;
    out.push({ id: `coffre_${uid}_${rec.id}`, data: rec });
  }
  // ⚠️ LES FICHES DÉJÀ AU COFFRE N'ÉTAIENT JAMAIS COMPLÉTÉES (mesuré le 23 août :
  // 89 annonces au coffre, **8 seulement avec leur texte**, alors que 40 fiches
  // lues sur la page en portaient un). La boucle ci-dessus ne voit que les
  // articles du dressing EN COURS d'archivage : une annonce plus en ligne, ou
  // d'un autre compte, ne récupérait jamais son texte — et « Republier »
  // annonçait « texte à capter » pour une paire dont le texte est en base.
  // On repasse donc sur les lignes DÉJÀ enregistrées à qui il manque la
  // description, en n'écrivant que celles qui changent vraiment.
  const dejaEcrites = new Set(out.map(o => o.id));
  for (const id in anciens) {
    const anc = anciens[id];
    const cle = `coffre_${uid}_${id}`;
    if (!anc || dejaEcrites.has(cle)) continue;
    const p = pages[String(id)];
    if (!p) continue;
    const t = String(p.description || '').trim();
    const photos = Array.isArray(anc.photos) ? anc.photos.slice() : [];
    let change = false;
    if (!anc.desc && t.length > 15 && !PUB.test(t)) { anc.desc = t; change = true; }
    for (const u of (p.photos || [])) if (u && !photos.includes(u)) { photos.push(u); change = true; }
    if (!change) continue;
    anc.photos = photos;
    anc.nPhotos = Math.max(Number(anc.nPhotos) || 0, photos.length);
    out.push({ id: cle, data: anc });
  }
  if (!out.length) return true;
  return await supabaseUpsert('app_data', out, 'id');
}

// Rapatrie une photo (CDN Vinted) en data: URL.
// ⚠️ POURQUOI PAR LE BACKGROUND : dans une page, une image du CDN chargée dans
// un <canvas> le rend « tainted » (cross-origin) et l'export devient interdit —
// on ne pourrait ni recadrer ni enregistrer. Le service worker, lui, a les
// permissions d'hôte : il récupère les octets, et une data: URL se recadre sans
// aucune restriction.
// ── LE PDF D'UN BORDEREAU LEBONCOIN (5.136, 3 octobre) ──────────────────────
// « Le tampon titre + N° partout » : sur Leboncoin, « Imprimer » ouvrait le PDF
// tel quel, sans N° ni titre. Ce PDF vit derrière SA session Leboncoin
// (`api.leboncoin.fr/api/shippingproxy/v1/parcels/{id}/label`, mesuré sur ses
// 3 bordereaux captés) : l'app ne peut pas le lire, l'extension si (elle a les
// droits sur leboncoin.fr). C'est une LECTURE de SON bordereau — rien d'autre
// n'est lisible par ce pont (adresse exacte exigée, PDF exigé).
const URL_PDF_LBC = /^https:\/\/api\.leboncoin\.fr\/api\/shippingproxy\/v1\/parcels\/[A-Za-z0-9-]+\/label$/;
async function pdfBordereauLbc(url) {
  try {
    if (!URL_PDF_LBC.test(String(url || ''))) return { ok: false, error: 'adresse non autorisée' };
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return { ok: false, error: `bordereau ${res.status}` };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // %PDF en tête : une page de connexion HTML n'est pas un bordereau.
    if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return { ok: false, error: 'pas un PDF (session Leboncoin expirée ?)' };
    if (bytes.byteLength > 12000000) return { ok: false, error: 'PDF trop lourd' };
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { ok: true, dataUrl: `data:application/pdf;base64,${btoa(bin)}` };
  } catch (e) { return { ok: false, error: String(e).slice(0, 80) }; }
}

async function photoBytes(url) {
  try {
    if (!/^https:/i.test(String(url || ''))) return { ok: false };
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `image ${res.status}` };
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 12000000) return { ok: false, error: 'image trop lourde' };
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return { ok: true, dataUrl: `data:${mime};base64,${btoa(bin)}` };
  } catch (e) { return { ok: false, error: String(e).slice(0, 60) }; }
}

// ── GÉNÉRER LE BORDEREAU, À TA PLACE ────────────────────────────────────────
// Julien : « je ne veux pas avoir à le faire ». Ici je le fais, et sans réserve :
// générer un bordereau n'engage AUCUN argent et ne décide de rien. La vente est
// déjà conclue, le colis DOIT partir, l'étiquette est une formalité obligatoire
// sans prix ni choix — rien à voir avec accepter une offre.
//
// La requête vient de SES actions, captée sur 5 comptes (`storeWriteReq`) :
//   PUT /api/v2/transactions/{tx}/shipment/order
//   {"seller_address_id":310525135,"drop_off_type":null,"label_type":null}
// `seller_address_id` change par compte : on le relit dans la capture de CE
// compte. Sans capture pour ce compte, on ne devine pas — on le dit.
// ⚠️ MESURÉ LE 26 AOÛT : 6 comptes sur 9 ont une adresse d'envoi captée, et les
// 3 qui n'en ont pas ne peuvent PAS générer de bordereau — dont `julatace3535`,
// qui avait justement une vente en attente. C'est ça, « la génération a du mal
// à se faire » : le refus est honnête mais il ne se débloquait qu'en générant
// un bordereau à la main une fois.
// La capture reste la source PREMIÈRE (c'est l'adresse qu'il a réellement
// choisie). À défaut, on demande la liste de SES adresses à Vinted — une
// lecture, sur son propre compte, avec les mêmes garde-fous. Le résultat est
// mémorisé pour qu'on ne redemande pas.
// ⚠️ La forme de la réponse n'a JAMAIS été observée : lecture défensive sur
// plusieurs noms de champ, et si rien ne ressemble à une adresse on ne prétend
// rien (§5.24 — on instrumente au lieu de supposer).
function idDAdresse(j) {
  const listes = [j && j.user_addresses, j && j.addresses, j && j.items, Array.isArray(j) ? j : null];
  for (const l of listes) {
    if (!Array.isArray(l) || !l.length) continue;
    // Une adresse d'EXPÉDITION, sinon la première venue.
    const pref = l.find(a => a && (a.is_default || a.default || a.entry_type === 2)) || l[0];
    const id = pref && (pref.id != null ? pref.id : pref.user_address_id);
    if (id != null && /^\d+$/.test(String(id))) return id;
  }
  const un = j && (j.user_address || j.address);
  if (un && un.id != null) return un.id;
  return null;
}

async function adresseVendeur(uid, acc) {
  try {
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_wreq_api_v2_transactions_id_shipment_order&select=data`);
    const body = rows && rows[0] && rows[0].data && rows[0].data.body;
    if (body) {
      const j = typeof body === 'string' ? JSON.parse(body) : body;
      if (j && j.seller_address_id != null) return j.seller_address_id;
    }
  } catch (_) {}
  // Mémo local (aucun égress) : une fois trouvée, on ne redemande plus.
  let memo = {};
  try { memo = (await chrome.storage.local.get('vrmAdresses')).vrmAdresses || {}; } catch (_) {}
  if (memo[String(uid)] != null) return memo[String(uid)];
  if (!acc) return null;
  try {
    const r = await vintedSend(acc, 'GET', '/api/v2/user_addresses');
    const id = r && r.ok ? idDAdresse(r.json) : null;
    if (id == null) {
      noterDiag(r && r.ok ? 'adresse_forme_inconnue' : 'adresse_refusee');
      if (r && r.ok) echantillonRate('adresse', String(uid), JSON.stringify(r.json || {}));
      return null;
    }
    memo[String(uid)] = id;
    try { await chrome.storage.local.set({ vrmAdresses: memo }); } catch (_) {}
    noterDiag('adresse_trouvee');
    return id;
  } catch (_) { return null; }
}

async function genererBordereau(uid, tx, opts = {}) {
  if (!uid || !tx) return { ok: false, error: 'vente incomplète' };
  const accts = await getStoredAccounts();
  const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
  if (!acc) return { ok: false, error: 'compte introuvable' };
  // `gardeFaite` : une commande de l'app est déjà passée par `gardeStricte`
  // (et a déjà consommé son créneau du plafond) — la refaire en brûlerait deux.
  if (!opts.gardeFaite) { const stop = await garde(uid, acc); if (stop) return stop; }   // anti-blocage
  // ⚠️ Le garde-fou passe AVANT la lecture d'adresse : celle-ci est une requête
  // Vinted comme une autre, elle n'a pas à partir depuis la session d'un autre
  // compte ni à dépasser le plafond horaire (§48).
  const adr = await adresseVendeur(uid, acc);
  if (adr == null) return { ok: false, error: "adresse d'envoi inconnue pour ce compte — génère-en un à la main une fois, l'extension la retiendra" };
  const r = await vintedSend(acc, 'PUT', `/api/v2/transactions/${tx}/shipment/order`,
    { seller_address_id: adr, drop_off_type: null, label_type: null });
  logActivity(r.ok ? '📄 Bordereau généré' : `⚠️ Bordereau : Vinted a refusé (${r.status})`);
  // ⚠️ ON MESURE LES ÉCHECS AU LIEU DE LES SUPPOSER (§5.24). Sans ça, « il y a
  // des messages d'erreur » ne peut mener qu'à des hypothèses : on ne sait ni
  // combien, ni ce que Vinted a répondu. Un échantillon de la réponse est gardé
  // dans `panel_diag_capture.rates.bordereau` — assez pour reconnaître la cause,
  // trop court pour peser.
  noterDiag(r.ok ? 'bordereau_genere' : `bordereau_refuse_${r.status}`);
  if (!r.ok) { try { echantillonRate('bordereau', String(tx), JSON.stringify(r.json || {})); } catch (_) {} }
  // Le message brut de Vinted ne dit rien à Julien. On traduit ce qu'on sait.
  const brut = (r.json && (r.json.message || r.json.error)) || '';
  // ⚠️⚠️ UN 409 VEUT DIRE « IL Y EN A DÉJÀ UN », PAS « ÇA A RATÉ ».
  //    Mesuré le 17 septembre sur sa base, et les deux bouts se rejoignent :
  //      · `bordereau_genere` **1** contre `bordereau_refuse_409` **1** ;
  //      · et dans les requêtes captées de SA page, à 11:58:40 :
  //        `PUT /api/v2/transactions/22355375065/shipment/order` — c'est LUI
  //        qui l'a commandé à la main, et cette vente est bien passée en
  //        « Bordereau envoyé au vendeur ».
  //    Quand l'extension repasse derrière, Vinted répond **409 : déjà commandé**.
  //    Or on traitait ça comme un échec sec : on n'allait **jamais** chercher le
  //    PDF, et `vrmBordFaits` bloquait la vente **6 h**. Le bordereau existait,
  //    et il n'arrivait jamais dans l'app — mot pour mot ce qu'il décrit.
  //    ⇒ `deja: true` : l'appelant enchaîne sur la récupération du PDF, exactement
  //      comme après un succès. Le commentaire plus haut disait déjà que le
  //      statut est périmé après une génération manuelle ; le correctif portait
  //      sur le STATUT, jamais sur la réponse 409 elle-même.
  const deja = r.status === 409;
  const clair = r.ok ? ''
    : deja ? 'le bordereau existait déjà chez Vinted — je vais chercher le PDF'
    : r.status === 401 ? 'session expirée pour ce compte — recharge une page Vinted et réessaie'
    : r.status === 403 ? 'Vinted a refusé pour ce compte'
    : r.status === 404 ? "cette vente n'attend plus de bordereau chez Vinted"
    : r.status === 422 ? (brut || "Vinted refuse ces informations d'envoi — génère-en un à la main une fois")
    : (brut || `Vinted a répondu ${r.status}`);
  return { ok: !!r.ok, deja, status: r.status, error: clair };
}

// ══════════════════════════════════════════════════════════════════════════════
// GÉNÉRER LES BORDEREAUX MANQUANTS EN ARRIVANT SUR VINTED
// ══════════════════════════════════════════════════════════════════════════════
// Demande de Julien : « dès que je me connecte sur Vinted, si une vente n'a pas
// son bordereau, que l'extension appuie et le mette dans l'application ».
//
// POURQUOI C'EST ACCEPTÉ ALORS QUE L'AUTO-ACCEPTATION D'OFFRE EST REFUSÉE :
// générer un bordereau **n'engage aucun argent et ne décide de rien**. La vente
// est déjà faite, le colis DOIT partir, il n'y a ni prix ni choix — c'est une
// formalité obligatoire. Accepter une offre, si (§45).
//
// LES GARDE-FOUS, TOUS DÉJÀ EN PLACE (§48) :
//  • UNIQUEMENT le compte connecté dans cet onglet (`garde`) — agir au nom d'un
//    autre compte est LE signal multi-comptes que Vinted sanctionne (§5) ;
//  • plafond de 20 actions/heure par compte (`compterAction`) ;
//  • ⚠️ AU PLUS 3 PAR VISITE. Ce n'est pas un « rythme faussement humain »
//    (toujours refusé, §32) : c'est une limite de volume, comme le plafond
//    horaire. Le reste part à la visite suivante. Mesuré sur les vraies
//    données : il y a 1 vente à générer aujourd'hui, la rafale est théorique.
//  • on ne réessaie pas une vente refusée avant 6 h (mémo local, aucun égress).
// ⚠️ 3 → 6 (Julien, 3 septembre : « améliore encore la rapidité »). Ce n'est
// PAS le garde-fou anti-blocage : le vrai plafond reste `ACTIONS_MAX_HEURE`
// (20 actions/h par compte, §48), et il est vérifié AVANT chaque requête. Ce
// nombre-ci ne fait que borner une seule visite pour ne pas tout envoyer d'un
// coup ; à 3, une journée à 8 ventes demandait trois passages sur Vinted.
// Les requêtes restent envoyées UNE PAR UNE, jamais en rafale (§5.36).
const BORD_MAX_PAR_VISITE = 6;
const BORD_RETRY_MS = 6 * 60 * 60 * 1000;
// ⚠️ Le récap ne DEMANDE plus rien (§5.88) : il annonce. Donc quand la
// génération s'arrête sur un garde-fou, il faut pouvoir DIRE pourquoi, sinon
// « il reste 2 bordereaux » est un mur sans explication. Mémoire volatile : un
// blocage périmé ne doit pas ressortir demain.
let dernierBlocage = {};
// Au-delà, on ne va plus chercher le PDF d'une vente : le colis est livré depuis
// longtemps et le lien de Vinted n'existe plus. Mesuré : les 28 ventes sans PDF
// qui ne sont pas encore livrées tiennent TOUTES dans cette fenêtre.
const BORD_RATTRAPAGE_J = 21;

// ── ALLER CHERCHER LE CODE DE RETRAIT D'UN COLIS QUI M'ATTEND ────────────────
// La capture passive ne voit que ce que la page charge : mesuré en base, sur
// 343 conversations captées, **12 seulement sont côté acheteur** — Julien passe
// son temps sur ses ventes. Donc le message « ton colis est arrivé » n'arrive
// presque jamais tout seul, alors que c'est LA seule source du code Vinted Go.
//
// On va donc le lire, mais de façon strictement bornée :
//   · uniquement les ACHATS que Vinted dit « déposés en point relais »,
//   · uniquement ceux dont on n'a pas déjà le code,
//   · le compte CONNECTÉ dans cet onglet (`garde` — agir au nom d'un autre
//     compte est LE signal multi-comptes que Vinted sanctionne, §48),
//   · 3 par visite au plus, pas de nouvel essai avant 6 h.
// ⚠️ Ce n'est ni une rafale ni un rythme « faussement humain » (§32) : c'est une
// LECTURE, sur ses propres achats, plafonnée en volume — la même forme que la
// récupération du bordereau (§5.29). Elle ne décide de rien et n'engage rien.
// ══════════════════════════════════════════════════════════════════════════════
// RÉPONDRE AUX MESSAGES — IL A TRANCHÉ : « TOUT, ELLE RÉPOND À TOUT »
// ══════════════════════════════════════════════════════════════════════════════
// Demande de Julien, 19 septembre, après que je lui ai posé la question et
// présenté le risque : « tout, elle répond à tout ». C'est SA décision, elle est
// prise, elle ne se re-négocie pas.
//
// Les trois morceaux existaient déjà et ne se parlaient pas :
//   · `convLastMessage(convId)` — le dernier message de l'ACHETEUR, lu dans la
//     donnée moissonnée (pas dans la page) ;
//   · `aiReply(...)` — `/api/ai` mode `reply`, qui rend une intention, une
//     confiance et 3 à 5 suggestions ;
//   · `POST /api/v2/conversations/{id}/replies` — **mesuré dans SES propres
//     requêtes**. ⚠️ Remesuré le 30 sept. sur les 9 captures (`wreq_…_replies`) :
//     `reply` est un OBJET — `{reply:{body, photo_temp_uuids:null,
//     is_personal_data_sharing_check_skipped:false}}` — pas une chaîne. La
//     5.77→5.118 envoyait `{reply: texte}` : l'endpoint était juste, la FORME
//     du corps non (§6 : vérifier le nom ET la forme du champ).
// Il ne manquait que le maillon qui envoie. C'est exactement l'histoire du
// bordereau : le pipeline était là, le dernier chaînon absent.
//
// ⚠️ LES GARDE-FOUS RESTENT, ET CE N'EST PAS UNE RE-NÉGOCIATION DE SON CHOIX :
//    ce sont des protections ANTI-BLOCAGE (§3), pas des scrupules. `vanessa5723`
//    a été bloqué, et neuf comptes sont son gagne-pain :
//      · uniquement le compte connecté dans l'onglet (`garde`) ;
//      · plafond de 20 actions/heure par compte, déjà tenu par `garde` —
//        **c'est LUI la vraie protection anti-blocage**, pas le plafond par
//        visite (§ « répond à tout mais étalé ») ;
//      · **8 réponses par visite** — Julien, 24 septembre : « améliore la
//        fiabilité, tu peux mettre plus de 3 répétitions… répond à tout mais
//        étalé ». Le plafond par visite n'évite qu'une RAFALE sur une seule
//        page ; répondre à tout se fait sur plusieurs visites, borné par le
//        plafond horaire de 20 qui, lui, ne bouge pas. Monté de 3 à 8 : plus de
//        3 (sa demande), mais jamais une salve de vingt d'un coup.
//      · une requête à la fois, jamais deux en vol.
// ⚠️ ET DEUX RÈGLES DE FOND, celles du dossier :
//    1. **JAMAIS DEUX FOIS LE MÊME MESSAGE.** L'identité est l'`id` du message
//       de l'acheteur — pas le texte, pas la date (§5 : jamais une
//       ressemblance). Sans ça, un acheteur reçoit trois réponses au même
//       message et ça se lit comme un robot.
//    2. **MIEUX VAUT UN BLANC QU'UN FAUX.** Si l'IA ne rend rien, ou rend une
//       réponse vide, on n'envoie RIEN. Un silence d'une heure coûte moins
//       qu'une réponse inventée sur un prix ou une disponibilité.
// ⚠️ ET ON DIT CE QU'ON A ENVOYÉ EN SON NOM. Le texte parti est gardé dans
//    `panel_msg_repondus` et le journal l'annonce : un message envoyé à sa place
//    qu'il ne peut pas relire serait le pire de tout — c'est « un colis caché
//    est un colis perdu » appliqué à ce qu'on dit à ses acheteurs.
const MSG_MAX_PAR_VISITE = 8;
const MSG_MIN_CONFIANCE = 55;    // en dessous, l'IA hésite : on ne parle pas à sa place

// ══════════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ QUI VEND ? C'EST UNE IDENTITÉ, ET ELLE M'A ÉVITÉ D'ÉCRIRE N'IMPORTE QUOI
// ══════════════════════════════════════════════════════════════════════════════
// MESURÉ LE 19 SEPTEMBRE, avant de brancher quoi que ce soit, sur ses 32
// conversations NON LUES : **deux** sont des échanges où c'est LUI l'acheteur —
// « Trainers are in post, thanks for buying », « juste pour vous dire que
// j'envoie demain, le colis est prêt ». Or `api/ai` répond en VENDEUR (sa
// consigne dit mot pour mot « on te donne le message d'un ACHETEUR ») : sur ces
// deux-là elle aurait envoyé, EN SON NOM, une réponse à côté de la plaque à
// quelqu'un qui lui expédie un colis. « toute conversation non lue = un acheteur
// qui demande » est une RESSEMBLANCE (§5), et elle se trompait 2 fois sur 5.
// ⇒ L'identité, c'est l'ARTICLE : `transaction.item_id` est-il une de SES
//    annonces captées ? (§5, identité d'annonce — jamais le titre.) Mesuré :
//    les 3 vraies questions d'acheteur passent, les 2 conversations où il achète
//    sont écartées, 0 erreur.
// ⚠️ CE QUE J'AI ESSAYÉ ET ÉCARTÉ, mesuré aussi :
//    · `transaction.user_side` — **null sur les 1 030 conversations** captées ;
//    · l'identifiant de participant déduit de `harvest_*_txn_*` : ces lignes
//      portent AUSSI ses achats, donc `seller_id` y varie (162 fois l'un, une
//      fois chacun des autres). Le prendre « le plus fréquent » serait un
//      rapprochement par fréquence, exactement ce que ce projet s'interdit.
//      Et ancré sur l'article il n'apportait **rien** (0 conversation de plus).
// ⚠️ « PAS SU » NE VAUT PAS « OUI » : lecture ratée ⇒ `null` ⇒ on ne répond pas.
async function sesAnnonces(uid) {
  const rows = await sbGetMemo(`app_data?id=eq.harvest_${uid}_listings&select=data`);
  if (rows === null) return null;                 // pas su ≠ « aucune annonce à lui »
  const items = (rows[0] && rows[0].data && rows[0].data.payload && rows[0].data.payload.items) || [];
  const s = new Set();
  for (const it of items) if (it && it.id != null) s.add(String(it.id));
  return s;
}

async function repondreAuxMessages(uid) {
  try {
    if (!uid) return 0;
    const reglages = await lireMain(['vinted_repond_auto']);
    // ⚠️ ÉTEINT PAR DÉFAUT, comme le moteur d'offres (§3). C'est lui qui allume,
    //    depuis l'app — et « pas su » (lecture ratée) ne vaut pas « allumé ».
    if (reglages === null) return 0;
    if (!reglages.vinted_repond_auto) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find((a) => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;

    // Les conversations NON LUES de ce compte, telles que Vinted les a rendues.
    const inbox = await sbGetMemo(`app_data?id=eq.harvest_${uid}_inbox&select=data`);
    if (inbox === null) return 0;                  // pas su ≠ aucune conversation
    const convs = (inbox[0] && inbox[0].data && inbox[0].data.payload && inbox[0].data.payload.conversations) || [];
    const nonLues = convs.filter((c) => c && c.unread && c.id != null);
    if (!nonLues.length) return 0;

    // Ses annonces : c'est ce qui dit s'il VEND dans cette conversation.
    const miennes = await sesAnnonces(uid);
    if (miennes === null) return 0;

    // Ce à quoi on a DÉJÀ répondu — par l'identité du message, jamais son texte.
    const rows = await sbGet('app_data?id=eq.panel_msg_repondus&select=data');
    if (rows === null) return 0;                   // on ne risque pas de répondre deux fois
    const deja = (rows[0] && rows[0].data) || {};

    let envoyes = 0;
    const neufs = {};
    // ⚠️ LE BILAN, PARCE QUE « ELLE RÉPOND À TOUT » SERAIT FAUX. Mesuré sur ses
    //    32 non lues : 17 n'ont AUCUNE conversation captée, 9 n'ont aucun
    //    message de l'acheteur dedans, 1 est refusée à la réponse par Vinted,
    //    1 est un échange où il achète — il en reste **3**. L'app écrit ces
    //    nombres ; un total partiel présenté comme complet est pire qu'absent.
    const bilan = { nonLues: nonLues.length, pasCaptee: 0, sansMessage: 0, pasVendeur: 0,
      replyRefuse: 0, dejaRepondu: 0, pasSure: 0, envoyes: 0, refusees: 0, at: new Date().toISOString() };
    for (const c of nonLues) {
      const cid = String(c.id);
      const det = await convDernierMessageId(uid, cid);
      if (!det) { bilan.pasCaptee++; continue; }
      if (!det.id || !det.body) { bilan.sansMessage++; continue; }
      if (det.allowReply === false) { bilan.replyRefuse++; continue; }   // Vinted refuse la réponse
      // L'IDENTITÉ : cette conversation porte-t-elle une de SES annonces ?
      if (!(det.itemId && miennes.has(String(det.itemId)))) { bilan.pasVendeur++; continue; }
      const cle = cid + ':' + det.id;
      if (deja[cle] || neufs[cle]) { bilan.dejaRepondu++; continue; }    // déjà répondu à CE message
      if (envoyes >= MSG_MAX_PAR_VISITE) continue;                       // le reste attend la prochaine visite
      const sugg = await aiReply(det.body, det.article || c.description || '', det.price);
      const texte = (sugg && sugg.ok && Array.isArray(sugg.suggestions) && sugg.suggestions[0]
        && String(sugg.suggestions[0].text || '').trim()) || '';
      // Mieux vaut un blanc qu'un faux : rien à dire ⇒ on se tait et on le note.
      if (!texte || Number(sugg.confidence || 0) < MSG_MIN_CONFIANCE) {
        bilan.pasSure++;
        noterDiag(!texte ? 'repond_sans_reponse' : 'repond_peu_sur');
        continue;
      }
      // ⚠️ LE PLAFOND HORAIRE SE CONSOMME AU MOMENT DE L'ENVOI, JAMAIS AVANT.
      //    `garde` → `compterAction` POUSSE un créneau du budget 20/h à chaque
      //    appel. L'appeler avant l'IA brûlait un créneau pour une conversation
      //    « pas sûre » qui n'envoyait rien : invisible à 3 par visite, mais dès
      //    qu'on monte le plafond (sa demande « plus de 3 »), le budget de
      //    l'heure s'épuisait sur des NON-réponses et les vraies réponses
      //    suivantes se faisaient refuser à tort. On ne compte une action que
      //    quand une réponse VA réellement partir. (Le contrôle « autre compte »
      //    de `garde` reste ici : au pire on a payé un appel à NOTRE serveur IA,
      //    jamais une requête à Vinted.)
      const stop = await garde(uid, acc);          // compte de l'onglet + plafond horaire
      if (stop) break;
      const r = await vintedSend(acc, 'POST', `/api/v2/conversations/${cid}/replies`,
        { reply: { body: texte, photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } });
      noterDiag(r.ok ? 'repond_envoye' : `repond_refuse_${r.status}`);
      if (!r.ok) {
        bilan.refusees++;
        logActivity(`⚠️ Réponse non envoyée (Vinted a répondu ${r.status})`);
        if (r.status === 401 || r.status === 403) break;   // inutile d'insister
        continue;
      }
      envoyes++;
      neufs[cle] = { conv: cid, at: new Date().toISOString(), texte: texte.slice(0, 400),
        intention: String(sugg.intent || ''), confiance: Number(sugg.confidence || 0),
        login: (c.opposite_user && c.opposite_user.login) || '', titre: String(c.description || '').slice(0, 80) };
      // ⚠️ IL DOIT POUVOIR RELIRE CE QUE J'AI DIT EN SON NOM.
      logActivity(`💬 Répondu à ${neufs[cle].login || 'un acheteur'} — « ${texte.slice(0, 60)}${texte.length > 60 ? '…' : ''} »`);
    }
    bilan.envoyes = envoyes;
    // Lire-fusionner-réécrire, avec la garde du dossier : on ne fusionne que si
    // on a lu (la lecture plus haut a déjà refusé le cas `null`). Le bilan vit
    // sous une clé réservée, jamais confondue avec un envoi (`conv:message`).
    await supabaseUpsert('app_data', [{ id: 'panel_msg_repondus',
      data: Object.assign({}, deja, neufs, { bilan: Object.assign({}, bilan, { uid: String(uid), ver: EXT_VERSION }) }) }], 'id');
    return envoyes;
  } catch (_) { return 0; }
}

// Le dernier message de l'acheteur AVEC SON IDENTITÉ — c'est elle qui empêche
// de répondre deux fois. `convLastMessage` ne rendait que le texte.
// ⚠️ Et il rend AUSSI `itemId` et `allowReply` : sans l'article on ne sait pas
//    s'il VEND dans cette conversation (voir `sesAnnonces`), et `allow_reply`
//    est mesuré `false` sur une de ses conversations non lues — Vinted y refuse
//    la réponse, insister ne ferait qu'un refus de plus au compteur.
// ⚠️ La ligne est lue sur SON compte (`id=eq.harvest_{uid}_conv_{cid}`) :
//    vérifié sur ses vraies données, une conversation est toujours captée sous
//    le compte de sa boîte — et une identité exacte coûte moins qu'un `like`.
async function convDernierMessageId(uid, convId) {
  try {
    const rows = await sbGet(`app_data?id=eq.harvest_${encodeURIComponent(String(uid))}_conv_${encodeURIComponent(String(convId))}&select=data`);
    for (const r of (rows || [])) {
      const conv = r.data && r.data.payload && r.data.payload.conversation;
      if (!conv || !Array.isArray(conv.messages)) continue;
      const oppId = conv.opposite_user && conv.opposite_user.id;
      let last = null;
      for (const m of conv.messages) {
        if ((m.entity_type || '') !== 'message') continue;
        const e = m.entity || {};
        if (oppId != null && e.user_id !== oppId) continue;   // uniquement l'acheteur
        if (e.body) last = { id: String(e.id != null ? e.id : (m.id != null ? m.id : '')), body: String(e.body).slice(0, 1000) };
      }
      const t = conv.transaction || {};
      const commun = { itemId: t.item_id != null ? String(t.item_id) : '', allowReply: conv.allow_reply,
        article: String(conv.description || conv.title || '').slice(0, 160),
        price: t.offer_price != null ? t.offer_price : undefined };
      // ⚠️ On rend l'objet MÊME sans message lisible : c'est ce qui permet au
      //    bilan de distinguer « pas de conversation captée » de « captée, mais
      //    aucun message de l'acheteur dedans » — deux causes, deux phrases.
      return Object.assign({ id: '', body: '' }, commun, last || {});
    }
    return null;
  } catch (_) { return null; }
}

const RETRAIT_MAX_PAR_VISITE = 3;
async function capterRetraits(uid) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_orders_purchased&select=data`);
    const achats = (rows && rows[0] && rows[0].data && rows[0].data.payload && rows[0].data.payload.my_orders) || [];
    const attend = achats.filter(o => o && AT_RELAY(o.status) && o.conversation_id != null);
    if (!attend.length) return 0;
    // Ce qu'on a déjà : inutile de redemander une conversation dont le code est
    // en base (lecture d'une seule ligne, quelques Ko).
    let deja = {};
    try {
      const r = await sbGet('app_data?id=eq.panel_colis_relais&select=data');
      deja = (r && r[0] && r[0].data) || {};
    } catch (_) {}
    const memo = (await chrome.storage.local.get('vrmRetraitFaits')).vrmRetraitFaits || {};
    let n = 0;
    for (const o of attend) {
      if (n >= RETRAIT_MAX_PAR_VISITE) break;
      const tx = String(o.transaction_id || '');
      if (tx && deja[tx] && deja[tx].code) continue;             // on a déjà le code
      const cid = String(o.conversation_id);
      if (memo[cid] && Date.now() - Number(memo[cid]) < BORD_RETRY_MS) continue;
      const refus = await garde(uid, acc);
      if (refus) { logActivity(`⚠️ Code de retrait non lu : ${refus.error}`); break; }
      memo[cid] = Date.now();
      n++;
      const rep = await vintedGet(acc, `/api/v2/conversations/${encodeURIComponent(cid)}`);
      if (!rep.ok || !rep.json) { noterDiag(`retrait_conv_refuse_${rep.status}`); continue; }
      const r = retraitDeConversation(rep.json);
      if (!r) { noterDiag('retrait_conv_sans_message'); continue; }
      if (!r.tx && tx) r.tx = tx;                                 // identité de l'achat
      const ecrit = await noterRetrait(r);
      if (ecrit) logActivity(`📦 Code de retrait récupéré — ${(r.code || r.lieu || '').slice(0, 40)}`);
    }
    await chrome.storage.local.set({ vrmRetraitFaits: memo });
    return n;
  } catch (_) { return 0; }
}

// ═══ LA DATE DE VERSEMENT (3 octobre, 5.133) ═══════════════════════════════
// Julien : « il faut dater la vente pour le CA du mois à la date de réception
// d'argent ». La seule date certaine que Vinted donne est celle où la
// transaction passe « Commande finalisée » (statut 450,
// `transaction.status_updated_at`) — c'est le moment où l'argent est versé.
// Mesuré le 3 octobre : en septembre, 26 ventes finalisées sur 56 avaient déjà
// cette ligne ; les autres n'avaient jamais eu leur détail relu APRÈS la
// finalisation. On va le relire ici.
// ⚠️ Une LECTURE sur ses propres ventes (§3 l'autorise), la forme exacte de
// `capterRetraits` : compte connecté (`garde`), une requête à la fois, borné
// par visite, pas de nouvel essai avant 24 h. Rien n'est décidé ici.
// ⚠️ « Pas su » ne vaut pas « rien » : ventes ou détails illisibles ⇒ on ne
// redemande RIEN (sinon une lecture ratée relancerait tout l'historique).
const VERSEMENT_MAX_PAR_VISITE = 5;
const VERSEMENT_RETRY_MS = 24 * 60 * 60 * 1000;
async function capterDatesVersement(uid) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_orders_sold&select=v:data->payload->my_orders`);
    if (!Array.isArray(rows)) return 0;                                   // pas su
    const ventes = (rows[0] && Array.isArray(rows[0].v)) ? rows[0].v : [];
    const finalisees = ventes.filter(o => o && o.transaction_id != null
      && /finalis/i.test(String(o.status || '')) && !/annul|cancel|refus|rembours|retour|suspend/i.test(String(o.status || '')));
    if (!finalisees.length) return 0;
    const det = await sbGetTout(`app_data?id=like.harvest_${uid}_txn_*&select=id,s:meta->>status,su:meta->>status_updated_at`);
    if (det === null) return 0;                                           // pas su
    const datees = new Set();
    for (const r of det) {
      const tx = (/_txn_(\d+)$/.exec(String((r && r.id) || '')) || [])[1];
      if (tx && String(r.s) === '450' && r.su && !isNaN(Date.parse(r.su))) datees.add(tx);
    }
    const memo = (await chrome.storage.local.get('vrmVersementFaits')).vrmVersementFaits || {};
    let n = 0, ecrites = 0;
    for (const o of finalisees) {
      if (n >= VERSEMENT_MAX_PAR_VISITE) break;
      const tx = String(o.transaction_id);
      if (!/^\d+$/.test(tx) || datees.has(tx)) continue;
      if (memo[tx] && Date.now() - Number(memo[tx]) < VERSEMENT_RETRY_MS) continue;
      const refus = await garde(uid, acc);
      if (refus) { logActivity(`⚠️ Dates de versement non lues : ${refus.error}`); break; }
      memo[tx] = Date.now();
      n++;
      const rep = await vintedGet(acc, `/api/v2/transactions/${encodeURIComponent(tx)}`);
      if (!rep.ok || !rep.json) { noterDiag(`versement_refuse_${rep.status}`); continue; }
      const t = rep.json.transaction;
      if (!t || typeof t !== 'object') { noterDiag('versement_sans_transaction'); continue; }
      const data = { type: 'transaction', uid: String(uid), domain: acc.domain || 'www.vinted.fr',
        capturedAt: new Date().toISOString(), payload: alleger('transaction', rep.json) };
      const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_txn_${tx}`, data }], 'id');
      if (ok === false) { noterDiag('versement_ecriture_ratee'); continue; }
      if (String(t.status) === '450' && t.status_updated_at) { ecrites++; noterDiag('versement_date_ecrit'); }
      else noterDiag(`versement_statut_${String(t.status).slice(0, 8)}`);
    }
    await chrome.storage.local.set({ vrmVersementFaits: memo });
    if (ecrites) {
      logActivity(`💶 ${ecrites} date${ecrites > 1 ? 's' : ''} de versement récupérée${ecrites > 1 ? 's' : ''}`);
      notifierApp({ type: 'maj', quoi: 'versements', uid: String(uid) });
    }
    return n;
  } catch (_) { return 0; }
}

// ⚠️ LE DÉTAIL D'EXPÉDITION PARLE UNE AUTRE LANGUE QUE LA COMMANDE.
// Mesuré en base le 1er septembre : `shipment.status_title` emploie des
// libellés que la commande n'utilise jamais — « Commande du bordereau d'envoi
// validée » (le statut qui apparaît JUSTE APRÈS une génération manuelle),
// « Commande annulée - article indisponible », « Le paiement a échoué ». Et
// 284 lignes portent `shipment: {}` + `status_title: ""` : la chaîne de replis
// retombe alors sur `t.status`, le NOMBRE 1 — un code, pas un libellé.
// `awaitingShip` étant une liste POSITIVE de deux phrases, tout ce vocabulaire
// répondait « non, plus rien à expédier » et la vente DISPARAISSAIT de la liste
// (plainte de Julien : « la vente s'est automatiquement supprimée »).
// ➡️ Trois états, et le troisième est le plus important : `null` = « ce statut
// ne nous dit rien ». On ne conclut JAMAIS « le colis est parti » depuis un
// statut qu'on ne sait pas lire. C'est la règle de §5.17 (la bonne question
// n'est pas « ça ressemble à un colis parti ? ») et de §16 (une réponse
// illisible n'est pas une réponse).
const etatExpedition = (st) => {
  const s = String(st == null ? '' : st).trim();
  if (!s || /^\d+$/.test(s)) return null;                       // un code n'est pas un libellé
  if (/annul|refus|rembours|retour|suspend|non r[ée]clam|[ée]chou/i.test(s)) return 'parti';
  if (/bordereau/i.test(s) && /envoy|valid|pr[êe]t|disponible/i.test(s)) return 'attend';
  if (/paiement.*valid/i.test(s)) return 'attend';
  if (/exp[ée]di|achemin|livr|d[ée]pos|finalis|remis/i.test(s)) return 'parti';
  return null;                                                  // libellé inconnu : on ne tranche pas
};

// Une vente attend une GÉNÉRATION quand Vinted dit que le paiement est validé
// ET qu'aucun bordereau n'a encore été émis. ⚠️ « Bordereau envoyé au vendeur »
// veut dire qu'il EXISTE DÉJÀ : le regénérer ne sert à rien (et c'est une
// requête pour rien). Les deux libellés se ressemblent, la distinction est ici.
const aGenererBordereau = (statut) => {
  const s = String(statut || '');
  if (/bordereau/i.test(s)) return false;
  if (/annul|cancel|refus|rembours|retour|suspend|finalis/i.test(s)) return false;
  return /paiement.*valid/i.test(s);
};

// Après génération, on ESSAIE de récupérer le PDF pour le déposer dans l'app.
// ⚠️ HONNÊTE : l'endpoint `/api/v2/shipments/{id}/label_url` a été VU dans les
// URL observées (§5.26) mais sa réponse n'a jamais été capturée — on ne connaît
// donc pas sa forme exacte. Lecture DÉFENSIVE : si ça ne donne rien, on ne
// prétend rien, le PDF arrivera par email comme aujourd'hui (§3).
// Cherche l'URL du PDF n'importe où dans une réponse JSON. On ne connaît pas la
// forme exacte (voir plus haut) : plutôt que de deviner un nom de champ, on
// balaie l'objet et on retient la première URL qui ressemble à une étiquette.
const urlDeLabel = (o, prof = 0) => {
  if (o == null || prof > 4) return null;
  if (typeof o === 'string') return /^https?:\/\/\S+/.test(o) && /(label|shipment|pdf|document)/i.test(o) ? o : null;
  if (Array.isArray(o)) { for (const x of o) { const u = urlDeLabel(x, prof + 1); if (u) return u; } return null; }
  if (typeof o !== 'object') return null;
  // les noms plausibles d'abord, le balayage ensuite
  for (const k of ['url', 'label_url', 'download_url', 'pdf_url', 'href', 'link']) {
    const v = o[k];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
  }
  for (const k of Object.keys(o)) { const u = urlDeLabel(o[k], prof + 1); if (u) return u; }
  return null;
};

// ⚠️ `connu` : ce qu'un essai précédent a DÉJÀ appris sur cette vente
// (l'identifiant d'expédition, et la transaction elle-même). Ils ne changent
// pas d'un essai à l'autre — les redemander était trois allers-retours Vinted
// pour rien, sur le chemin dont Julien dit qu'il est lent.
async function recupererLabel(acc, uid, tx, connu) {
  try {
    const t = (connu && connu.t) || await vintedGet(acc, `/api/v2/transactions/${tx}`);
    const shipId = t && t.json && (t.json.transaction?.shipment?.id ?? t.json.shipment?.id);
    // ⚠️⚠️ ON NE GARDE LA TRANSACTION QUE SI ELLE A RÉPONDU CE QU'ON LUI
    //    DEMANDAIT. « Vinted n'expose pas encore l'expédition » est justement le
    //    cas où il FAUT la redemander : le service d'expédition est en train de
    //    la créer. Mon premier jet mettait la réponse en cache dans tous les
    //    cas — les trois essais suivants relisaient donc la même réponse vide et
    //    échouaient à l'identique. C'est `audit-bordereau-rattrapage.cjs` qui
    //    l'a vu, sur un contrôle écrit avant : « on réessaie le temps que le PDF
    //    arrive ».
    if (connu && shipId) connu.t = t;
    if (!shipId) { await echantillonRate('label_txn', tx, JSON.stringify(t && t.json).slice(0, 400)); return { ok: false, raison: "Vinted n'expose pas encore l'expédition de cette vente" }; }
    // ⚠️ On ne connaît la forme d'AUCUNE de ces réponses (§5.29). On essaie donc
    // les chemins observés dans `seen_urls` (§5.26), l'un après l'autre, et on
    // GARDE UN ÉCHANTILLON de ce qui revient : c'est comme ça qu'on a fini par
    // comprendre la fiche article (§5.24 → §5.26). Sans mesure, on devinerait.
    // ⚠️⚠️ ON SAVAIT QUEL CHEMIN MARCHE, ET ON LE JETAIT. `via` était calculé —
    //    et jamais enregistré nulle part. Or c'est LA mesure qui manque pour
    //    rendre cette capture plus rapide : relevé du 13 septembre,
    //    **`label_url_trouve` 29 contre `label_url_introuvable` 61** (l'URL est
    //    introuvable deux fois sur trois), et rien ne disait **lequel** des trois
    //    chemins avait répondu quand ça marchait. Sans ça, réordonner ou en
    //    retirer un serait une supposition — et la supposition est précisément ce
    //    que ce projet s'interdit. On note donc le chemin gagnant, et le STATUT
    //    de chacun quand aucun ne donne rien : « Vinted a refusé » et « Vinted a
    //    répondu sans URL » ne se corrigent pas de la même façon.
    let url = null, via = '';
    const statuts = [];
    for (const chemin of [`/api/v2/shipments/${shipId}/label_url`, `/api/v2/shipments/${shipId}`, `/api/v2/shipments/${shipId}/label_options`]) {
      const l = await vintedGet(acc, chemin);
      const brut = l && l.json ? JSON.stringify(l.json) : '';
      // ⚠️ L'ÉCHANTILLON EST UN DIAGNOSTIC, PAS UNE MESURE PAR ESSAI. Il passe
      //    par `majTampon`, donc une lecture + une écriture de
      //    `chrome.storage.local` — trois par essai, quatre essais : douze
      //    aller-retours de stockage pour garder QUATRE FOIS le même
      //    échantillon. Un par type et par visite suffit à comprendre la forme.
      const cle = 'label' + chemin.replace(/^.*\/shipments\/\d+/, '').replace(/\W+/g, '_');
      if (!connu || !connu.vus || !connu.vus.has(cle)) {
        await echantillonRate(cle, shipId, brut.slice(0, 400));
        if (connu && connu.vus) connu.vus.add(cle);
      }
      statuts.push(String((l && l.status) || 'sans_reponse'));
      const u = urlDeLabel(l && l.json);
      if (u) { url = u; via = chemin; break; }
    }
    const nomChemin = (c) => (c.replace(/^.*\/shipments\/\d+/, '').replace(/\W+/g, '_') || '_racine');
    if (!url) {
      await noterDiag('label_url_introuvable');
      // Bornée par construction : trois chemins, trois statuts HTTP.
      await noterDiag('label_ko_statuts_' + statuts.join('_'));
      return { ok: false, raison: "Vinted n'a pas donné l'URL du PDF" };
    }
    await noterDiag('label_url_trouve');
    await noterDiag('label_via' + nomChemin(via));
    // ⚠️ LE PDF N'EST PAS SERVI PAR VINTED. `label_url` renvoie une URL **S3**
    // (`svc-shipping-labels.s3.eu-central-1.amazonaws.com`) — vérifié dans
    // l'échantillon de diagnostic. Sans `https://*.amazonaws.com/*` dans les
    // permissions, ce `fetch` est bloqué par Chrome et la capture échouait EN
    // SILENCE, en affichant « Vinted n'a pas donné l'URL » alors que l'URL était
    // bien là. C'était ça, le vrai blocage.
    let res;
    try { res = await fetch(url); }
    catch (e) { await noterDiag('label_fetch_bloque'); return { ok: false, raison: 'Téléchargement du PDF refusé par le navigateur — recharge l\'extension (permissions)' }; }
    if (!res.ok) { await noterDiag('label_fetch_' + res.status); return { ok: false, raison: `Le PDF a répondu ${res.status}` }; }
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) { await noterDiag('label_pdf_vide'); return { ok: false, raison: 'PDF vide' }; }
    if (buf.byteLength > 12000000) return { ok: false, raison: 'PDF trop lourd' };
    const bytes = new Uint8Array(buf);
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    // ⚠️ UNE LIGNE PAR BORDEREAU, PAS UNE SEULE « DERNIÈRE ». `label_latest` est
    // écrasée à chaque capture : avec 3 colis à envoyer, l'app n'en voyait qu'UN.
    // La clé porte donc le n° de transaction — c'est l'identité de la vente, donc
    // du bordereau (il ne peut pas y avoir de bordereau sans vente, §5.28).
    // ⚠️ ON ENVOIE L'IDENTITÉ DE L'ANNONCE AVEC LE BORDEREAU (idée de Julien).
    //    La transaction est DÉJÀ chargée juste au-dessus : `item_id` est donc
    //    gratuit — zéro requête de plus. Avec lui, l'app n'a plus rien à déduire
    //    pour savoir quelle paire part dans ce carton : elle lit directement
    //    `vinted_annonce_numeros[item]`, qui est indexé par id d'annonce. Fini
    //    la chaîne bordereau → transaction → vente → annonce, et fini le moindre
    //    risque de confondre deux articles identiques.
    const trx = (t && t.json && (t.json.transaction || t.json)) || {};
    const item = trx.item_id != null ? String(trx.item_id) : '';
    // Un LOT porte plusieurs articles : on les transporte tous (l'app saura dire
    // « ce bordereau couvre 3 paires » au lieu d'en désigner une au hasard).
    const items = Array.isArray(trx.order && trx.order.items)
      ? trx.order.items.map(x => x && x.id != null ? String(x.id) : '').filter(Boolean) : [];
    const data = { uid, url, tx: String(tx), item, items, capturedAt: new Date().toISOString(), pdfB64: btoa(bin) };
    const range = await supabaseUpsert('app_data', [
      { id: `harvest_${uid}_label_${tx}`, data },
      { id: `harvest_${uid}_label_latest`, data },   // gardée : d'anciens écrans la lisent
    ], 'id');
    // ⚠️ « Envoyé dans l'application » ne se dit que si la base l'a RANGÉ : une
    //    écriture ratée ne doit pas devenir un « fait » côté app (§ « on
    //    n'acquitte pas ce qu'on n'a pas rangé »).
    if (range === false) { await noterDiag('label_ecriture_ratee'); return { ok: false, raison: "PDF récupéré mais la base ne l'a pas enregistré — réessaie" }; }
    await noterUrlLabel(url, true);
    await noterDiag('label_envoye');
    logActivity('📎 Bordereau envoyé dans l\'application');
    return { ok: true };
  } catch (e) { await noterDiag('label_erreur'); return { ok: false, raison: String(e).slice(0, 80) }; }
}

// ⚠️ « JE VEUX QUE LA TRANSMISSION DU BORDEREAU SOIT AUTOMATIQUE DÈS QU'IL EST
// GÉNÉRÉ, IL NE DOIT PAS Y AVOIR D'ERREUR » (Julien, 23 août).
// Le PDF n'existe pas à la milliseconde où Vinted accepte la génération : le
// service d'expédition le fabrique, puis le dépose sur S3. Un seul essai juste
// après la génération tombait donc souvent sur « pas encore d'URL » — et le
// bordereau n'arrivait dans l'app qu'à la visite suivante, voire par email.
// On réessaie, en laissant le temps à Vinted de le produire.
// ⚠️ Ce n'est PAS un rythme « faussement humain » (toujours refusé, §32) : c'est
// attendre qu'un fichier soit prêt, sur UNE vente, après une action de Julien.
const LABEL_ATTENTES_MS = [1500, 4000, 9000];
async function recupererLabelInsiste(acc, uid, tx) {
  let dernier = { ok: false, raison: 'non tenté' };
  // Ce que les essais successifs se transmettent : la transaction (donc
  // l'identifiant d'expédition) et les échantillons déjà pris. Mesuré : une
  // vente dont le PDF n'est pas prêt coûtait 4 × (1 + 3) = 16 requêtes Vinted ;
  // elle en coûte 13, et 3 écritures de stockage au lieu de 12.
  const connu = { t: null, vus: new Set() };
  for (let i = 0; i <= LABEL_ATTENTES_MS.length; i++) {
    dernier = await recupererLabel(acc, uid, tx, connu);
    if (dernier.ok) { if (i) await noterDiag('label_ok_apres_' + i + '_essai'); return dernier; }
    // On n'insiste que sur les échecs TRANSITOIRES (le PDF n'est pas encore là).
    // Un refus dur (permissions, PDF vide, 4xx) ne s'arrangera pas en attendant.
    const transitoire = /pas donné l'URL|n'expose pas encore/i.test(dernier.raison || '');
    if (!transitoire || i === LABEL_ATTENTES_MS.length) break;
    await new Promise(r => setTimeout(r, LABEL_ATTENTES_MS[i]));
  }
  if (!dernier.ok) await noterDiag('label_abandon_apres_essais');
  return dernier;
}

async function genererBordereauxEnAttente(uid, opts = {}) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    // Les ventes telles que Vinted les a rendues à la dernière moisson.
    const rows = await sbGetMemo(`app_data?id=eq.harvest_${uid}_orders_sold&select=data`);
    const ventesBrutes = (rows && rows[0] && rows[0].data && rows[0].data.payload && rows[0].data.payload.my_orders) || [];
    const capCmd = Date.parse((rows && rows[0] && rows[0].data && rows[0].data.capturedAt) || '') || 0;
    // ⚠️ LE STATUT DE LA COMMANDE EST PÉRIMÉ JUSTE APRÈS UNE GÉNÉRATION MANUELLE.
    // Julien génère le bordereau lui-même sur Vinted : le détail de transaction
    // passe à « Commande du bordereau d'envoi validée », mais la ligne
    // `orders_sold` dit encore « Le paiement a été validé » jusqu'à la prochaine
    // moisson. Avec ce seul statut, la 1ʳᵉ passe REGÉNÈRE une étiquette qui
    // existe déjà (une requête pour rien, refusée par Vinted → « message
    // d'erreur ») et la 2ᵉ passe REFUSE d'aller chercher le PDF qui vient
    // d'apparaître (`aGenererBordereau` la fait sortir). Résultat : le bordereau
    // n'arrive jamais dans l'app.
    // ➡️ On lit le détail de transaction de CE compte, en SCALAIRES (§34 : jamais
    // `select=data`), et il fait foi quand il est plus frais ET lisible.
    const detFrais = new Map();
    try {
      const dr = await sbGetMemo(`app_data?id=like.harvest_${uid}_txn_*&select=id,st:meta->>ship_status_title,cap:meta->>capturedAt`);
      for (const r of (dr || [])) {
        const tx = (/_txn_(\d+)$/.exec(String(r.id || '')) || [])[1];
        if (!tx || !r.st) continue;
        const c = Date.parse(r.cap || '') || 0;
        if (!detFrais.has(tx) || c > detFrais.get(tx).cap) detFrais.set(tx, { st: String(r.st), cap: c });
      }
    } catch (_) { /* sans le détail on retombe sur la commande, comme avant */ }
    const statutDe = (o) => {
      const tx = o && o.transaction_id != null ? String(o.transaction_id) : '';
      const d = tx ? detFrais.get(tx) : null;
      if (d && d.cap >= capCmd && etatExpedition(d.st)) return d.st;
      return (o && o.status) || '';
    };
    const ventes = ventesBrutes.map(o => (o ? { ...o, status: statutDe(o) } : o));
    const candidates = ventes.filter(o => aGenererBordereau(o && o.status) && (o.transaction_id != null));
    // ⚠️ PAS DE SORTIE ANTICIPÉE ICI : même sans rien à générer, la 2ᵉ passe doit
    // tourner pour aller chercher les bordereaux DÉJÀ émis (c'est le cas le plus
    // fréquent — 2 des 3 colis de Julien).
    // Un bordereau reçu par email prouve qu'il existe déjà : on ne regénère pas.
    const dejaMail = new Set();
    try {
      const mails = await sbGet('app_data?id=like.email_bord_*&select=tx:meta->>transaction');
      for (const m of (mails || [])) if (m && m.tx) dejaMail.add(String(m.tx));
    } catch (_) { /* sans cette lecture on retombe sur le statut Vinted, qui suffit */ }
    const memo = (await chrome.storage.local.get('vrmBordFaits')).vrmBordFaits || {};
    let faits = 0;
    for (const o of (opts.lectureSeule ? [] : candidates)) {
      if (faits >= BORD_MAX_PAR_VISITE) break;
      const tx = String(o.transaction_id);
      if (dejaMail.has(tx)) continue;
      if (memo[tx] && Date.now() - Number(memo[tx].t || 0) < BORD_RETRY_MS) continue;
      const r = await genererBordereau(uid, tx);
      // ⚠️ « Déjà commandé » (409) compte comme un SUCCÈS pour la suite : le
      //    bordereau existe, c'est le PDF qu'on veut. Et on ne bloque pas la
      //    vente 6 h sur un « c'est déjà fait ».
      memo[tx] = { t: Date.now(), ok: !!r.ok || !!r.deja };
      if (r.ok || r.deja) {
        if (r.ok) faits++;
        delete dernierBlocage[String(uid)];
        const eu = (await recupererLabelInsiste(acc, uid, tx)).ok;
        const quoi = r.deja ? 'Bordereau déjà commandé' : 'Bordereau généré';
        logActivity(eu ? `📄 ${quoi} et rangé dans l'app — ${String(o.title || '').slice(0, 40)}`
                       : `📄 ${quoi} — ${String(o.title || '').slice(0, 40)} (le PDF arrivera par email)`);
      } else {
        logActivity(`⚠️ Bordereau non généré : ${r.error || 'refus Vinted'}`);
        // Compte connecté ailleurs / plafond atteint : inutile d'insister sur
        // les suivantes, elles échoueront pareil.
        if (r.code === 'autre-compte' || r.code === 'trop-d-actions') {
          dernierBlocage[String(uid)] = { code: r.code, error: r.error || '', at: Date.now() };
          break;
        }
      }
    }
    // ── 2ᵉ PASSE : LE BORDEREAU EXISTE DÉJÀ, ON VA LE CHERCHER ──────────────
    // ⚠️ LE TROU QUE JULIEN A VU (« ça ne capte pas le bordereau »). On n'allait
    // chercher le PDF qu'APRÈS l'avoir généré nous-mêmes. Or une vente au statut
    // « Bordereau envoyé au vendeur » a DÉJÀ son étiquette chez Vinted : il n'y
    // a rien à générer, donc on ne passait jamais la chercher. Mesuré : 2 de ses
    // 3 colis étaient exactement dans ce cas, et le diagnostic ne portait aucune
    // clé « label » — la fonction n'avait jamais été atteinte.
    const dejaCapte = new Set();
    try {
      const cur = await sbGet(`app_data?id=like.harvest_${uid}_label_*&select=tx:meta->>tx`);
      for (const r of (cur || [])) if (r && r.tx) dejaCapte.add(String(r.tx));
    } catch (_) { /* pas de ligne : rien de capté, on tente */ }
    // ⚠️⚠️ ON N'ABANDONNE PLUS DÈS QUE VINTED FAIT AVANCER LE STATUT (27 août).
    // Julien : « des fois je génère et la vente s'en va sans même avoir envoyé
    // le bordereau à l'app ». La 2ᵉ passe ne regardait que `AWAITING_SHIP` : à
    // la seconde où Vinted passe la vente à « expédiée » / « finalisée », on
    // cessait DÉFINITIVEMENT d'aller chercher son PDF. Or le PDF n'est pas prêt
    // à l'instant où on génère (Vinted le fabrique puis le dépose) — donc la
    // seule fenêtre où on essayait était justement celle où ça échoue le plus.
    // MESURÉ sur la vraie base : **90 ventes de moins de 45 jours** ont leur
    // étiquette chez Vinted et AUCUN PDF dans l'app (ni capté, ni email) — et
    // l'ancienne condition n'en couvrait qu'**1**. 28 d'entre elles ne sont même
    // pas encore livrées.
    // Nouvelle règle : toute vente RÉCENTE, non annulée, dont l'étiquette existe
    // (donc au-delà de « paiement validé ») et dont on n'a pas le PDF. Les plus
    // utiles d'abord : celles qui attendent encore l'envoi, puis les plus
    // récentes. Le plafond de 3 par visite et le mémo de 6 h restent : c'est
    // une limite de volume, pas un rythme déguisé (§32).
    const limite = Date.now() - BORD_RATTRAPAGE_J * 86400000;
    const aRecuperer = ventes.filter(o => {
      if (!o || o.transaction_id == null) return false;
      const tx = String(o.transaction_id);
      if (dejaMail.has(tx) || dejaCapte.has(tx)) return false;   // on a déjà le PDF
      if (aGenererBordereau(o.status)) return false;             // l'étiquette n'existe pas encore
      if (/annul|cancel|refus|rembours/i.test(String(o.status || ''))) return false;
      const d = Date.parse(o.date || '') || 0;
      if (!d || d < limite) return false;                        // trop vieux : le lien n'existe plus
      const mk = 'get' + tx;
      if (memo[mk] && Date.now() - Number(memo[mk].t || 0) < BORD_RETRY_MS) return false;
      return true;
    }).sort((a, b) => {
      const pa = AWAITING_SHIP(a.status) ? 0 : 1, pb = AWAITING_SHIP(b.status) ? 0 : 1;
      if (pa !== pb) return pa - pb;                             // ce qui attend TON envoi d'abord
      return (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0);
    });
    let recup = 0;
    for (const o of aRecuperer) {
      if (recup >= BORD_MAX_PAR_VISITE) break;
      const tx = String(o.transaction_id);
      memo['get' + tx] = { t: Date.now() };
      // ⚠️ ON N'INSISTE QUE QUAND ÇA A UN SENS. L'insistance (§5.48) sert à
      // attendre un PDF que Vinted est en train de fabriquer — donc uniquement
      // sur une vente qui attend encore l'envoi. Sur une vente déjà partie, un
      // « pas d'expédition exposée » ne s'arrangera pas : réessayer 4 fois, ce
      // serait 4 requêtes pour rien dans l'empreinte du compte (§5, §48).
      const eu = AWAITING_SHIP(o.status)
        ? (await recupererLabelInsiste(acc, uid, tx)).ok
        : (await recupererLabel(acc, uid, tx)).ok;
      recup++;
      if (eu) logActivity(`📎 Bordereau récupéré chez Vinted — ${String(o.title || '').slice(0, 40)}`);
    }
    await chrome.storage.local.set({ vrmBordFaits: memo });
    return faits + recup;
  } catch (_) { return 0; }
}

// ── ASSISTANT DE RÉPONSE (spec « Messaging Intelligence ») ───────────────────
// Le panneau relaie le message de l'acheteur ; on le passe à /api/ai (mode
// reply), qui renvoie une intention + des réponses suggérées. ⚠️ On n'ENVOIE
// RIEN sur Vinted : Julien relit, choisit, adapte et envoie LUI-MÊME (assistance
// stricte, conforme). La clé de l'IA reste côté serveur (Vercel), jamais ici.
const VRM_APP_API = 'https://vrm.center';
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

async function sbGet(query) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: await sbHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════
// LA LIGNE `main` PÈSE 197 Ko, ET AUCUN LECTEUR N'EN VEUT PLUS DE QUELQUES CLÉS
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré le 15 septembre sur sa vraie base : `main` fait **197 Ko** (dont 127 Ko
// de `vinted_annonce_numeros` et 25 Ko de `vinted_sale_overrides`), et **six**
// endroits de ce fichier la lisaient en `select=data` — le panneau à chaque
// visite sur Vinted, la file Leboncoin sur chaque page leboncoin.fr, la file
// eBay de même. C'est §4.4 mot pour mot (« jamais `select=data` sur une ligne
// lourde »), sur la ligne la plus lue du projet.
//
// ⚠️ ET C'EST DE L'ÉGRESS : un `select=data` avait déjà crevé le quota (5,7 Go).
//    La leçon avait été apprise pour les commandes, jamais pour `main`.
//
// ⇒ Un seul lecteur (§11), qui projette EXACTEMENT les clés demandées. L'alias
//   porte le nom de la clé, donc la ligne rendue se lit comme avant
//   (`d.vinted_annonce_numeros`) : rien à renommer chez les appelants, donc
//   aucune chance d'en oublier un.
// ⚠️ La LISTE de clés d'un lecteur est une déclaration : une clé oubliée vaut
//    `undefined`, c'est-à-dire un compte exclu qui revient ou une paire retirée
//    du stock qu'on republie — **en silence**. `audit-lectures.cjs` compare donc
//    chaque liste aux clés que la fonction lit vraiment.
const qMain = (cles) => `app_data?id=eq.main&select=${cles.map((k) => `${k}:data->${k}`).join(',')}`;
// Mesuré : 197 Ko → 133 Ko (les files).
// ⚠️ `vinted_pairs_lost` EST DANS LES DEUX FILES, ET IL MANQUAIT À LEBONCOIN.
//    L'app et la file eBay écartent une paire qu'il a déclarée retirée du stock ;
//    la file Leboncoin du panneau, non — elle lui proposait de publier une paire
//    qu'il n'a plus. Mesuré aujourd'hui : **0 paire retirée**, donc 0 cas réel —
//    mais c'est le motif exact de « l'app annonçait 39, le panneau 40 » (§11),
//    et `audit-places.cjs` existe pour ça. Les trois lecteurs, une seule règle.
const MAIN_FILE = ['vinted_account_labels', 'vinted_accounts', 'vinted_accounts_blocked',
  'vinted_accounts_hidden', 'vinted_annonce_numeros', 'vinted_pairs_lost', 'vrm_lbc_liens'];
// Rend la ligne projetée (les clés absentes valent `null`), ou `null` si la base
// n'a pas répondu — « rien lu » ne vaut pas « rien ».
async function lireMain(cles) {
  const rows = await sbGet(qMain(cles));
  if (rows === null) return null;
  return (rows && rows[0]) || {};
}

// ══════════════════════════════════════════════════════════════════════════════
// AU-DELÀ DE 1 000 LIGNES, SUPABASE COUPE — ET NE LE DIT PAS (§4.5)
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré le 15 septembre sur sa vraie base : une requête sans `Range` rend
// **1 000 lignes** avec `Content-Range: 0-999/4999` — les 3 999 autres sont
// perdues **en silence**. `sbGet` ne paginait pas, et la famille des
// conversations est à **939 lignes** : à soixante et une conversations du
// plafond. Le jour où il le franchit, le panneau cesse de voir des offres et des
// codes de retrait **sans aucun message** — « un colis caché est un colis
// perdu », et ici c'est le silence qui cache.
// ⚠️ On garde la règle du fichier : `null` sur échec, jamais une liste partielle
//    présentée comme complète. Si UNE page échoue, tout l'appel rend `null` —
//    une moitié de liste serait pire qu'une lecture ratée, parce qu'elle a l'air
//    d'une réponse.
const SB_PAGE = 1000;
async function sbGetTout(query) {
  const out = [];
  for (let de = 0; ; de += SB_PAGE) {
    let page = null;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
        headers: { ...(await sbHeaders()), Range: `${de}-${de + SB_PAGE - 1}`, 'Range-Unit': 'items' },
      });
      if (!res.ok) return null;
      page = await res.json();
    } catch (_) { return null; }
    if (!Array.isArray(page)) return null;
    out.push(...page);
    if (page.length < SB_PAGE) return out;
    if (de > 100000) return out;                  // garde-fou : jamais de boucle sans fin
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LE MÉMO DE VISITE — la même lecture lourde ne repart plus trois fois
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré (banc `reads.cjs`, vrai `visiteVinted()` en vm) : sur UNE arrivée sur
// Vinted, `harvest_{uid}_orders_sold` — le payload ENTIER des ventes, plusieurs
// centaines de Ko même après l'allègement (§23) — était demandé TROIS fois de
// suite : par `genererBordereauxEnAttente`, par `nouveautes`, puis par
// `ventesSansBordereau` que `nouveautes` appelle. Trois allers-retours réseau
// AVANT que le récap puisse s'afficher, et trois fois l'égress (§34).
//
// On mémorise la PROMESSE, pas seulement le résultat : deux appelants lancés en
// même temps partagent le même aller-retour au lieu d'en faire deux (le motif
// `cachedRow` de l'app, §23).
//
// ⚠️ TTL très court, et VIDÉ par `rafraichirVentes` juste après l'écriture des
// ventes fraîches : ce mémo ne doit JAMAIS servir des ventes plus vieilles que
// la capture qu'on vient de faire — ce serait le piège `updated_at` de §15 sous
// une autre forme.
const VISITE_MEMO_MS = 20 * 1000;
const _memoVisite = new Map();          // requête → { at, p }

function sbGetMemo(query) {
  const e = _memoVisite.get(query);
  if (e && Date.now() - e.at < VISITE_MEMO_MS) return e.p;
  const p = sbGet(query);
  _memoVisite.set(query, { at: Date.now(), p });
  return p;
}

function viderMemoVisite(uid) {
  if (uid == null) { _memoVisite.clear(); return; }
  const k = String(uid);
  for (const q of [..._memoVisite.keys()]) if (q.includes(k)) _memoVisite.delete(q);
}
// Correspondance de catégorie Vinted → Leboncoin. La boutique = sneakers → la
// catégorie Leboncoin est « Chaussures » (Mode). On garde une logique simple et
// extensible (vêtements/accessoires si un jour d'autres articles).
// ⚠️⚠️ PLUS DE DÉFAUT « Chaussures » CODÉ EN DUR (Julien, 20 sept. : « qu'un
//    reseller qui fasse autre chose que des chaussures puisse l'utiliser »).
//    La catégorie est un CHOIX, pas une ressemblance (§5) : on ne la renvoie que
//    si un mot la DÉSIGNE, ou si la taille est une POINTURE (nombre en fourchette
//    chaussure) — sinon on rend '' et Leboncoin la propose (il la devine du
//    titre), l'utilisateur tranche. Une catégorie FAUSSE fait plus de mal que
//    pas de catégorie (« 3 manuels première ST2S » partait en Chaussures).
//    ⚠️ Les vêtements sont testés AVANT la pointure : « jean taille 40 » est un
//    vêtement, pas une paire du 40.
function lbcCategory(det, raw) {
  const t = ((det.title || raw.title || '') + ' ' + (det.description || '')).toLowerCase();
  if (/(sac|sacoche|bandouli|cabas|pochette|portefeuille|porte-monnaie)/.test(t)) return 'Sacs à main';
  if (/(veste|manteau|pull|t-?shirt|tee-?shirt|chemise|jean|pantalon|robe|jupe|short|sweat|hoodie|doudoune|gilet|d[ée]bardeur|combinaison|legging|surv[êe]tement|maillot)/.test(t)) return 'Vêtements';
  if (/(casquette|bonnet|ceinture|montre|lunettes|[ée]charpe|gants|bijou|collier|bracelet|bague|foulard|cravate|portefeuille)/.test(t)) return 'Accessoires & Bagagerie';
  if (/(manuel|livre|bouquin|roman|\bbd\b|scolaire|cahier)/.test(t)) return 'Livres';
  if (/(chaussure|basket|sneaker|running|derby|mocassin|botte|bottine|escarpin|sandale|tong|ballerine|mule|richelieu|espadrille)/.test(t)) return 'Chaussures';
  // Pointure : une taille NUMÉRIQUE en fourchette chaussure (34–50), et aucun mot
  //   de vêtement au-dessus. C'est ce qui garde l'auto-catégorie de ses sneakers
  //   (dont le titre ne dit pas « chaussure »), sans forcer les autres articles.
  const p = parseFloat(String(det.size || raw.size || det.size_title || raw.size_title || '').replace(',', '.'));
  if (isFinite(p) && p >= 34 && p <= 50) return 'Chaussures';
  return '';   // inconnu : on ne force pas — Leboncoin propose, l'utilisateur choisit
}
// ══════════════════════════════════════════════════════════════════════════════
// LE TITRE LEBONCOIN — 50 caractères, et ils se gagnent
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré le 12 septembre sur ses 59 vraies annonces en ligne. L'ancien titre
// faisait `[marque, titre].join(' ')` puis `slice(0, 50)` :
//   · 7 titres tapaient le plafond, et 6 finissaient EN PLEIN MOT
//     (« chaussures philippe model tropez fringe noir taill ») ;
//   · la marque était DOUBLÉE quand elle était déjà dans son titre
//     (« Nike nike shox tl noir et vert ») ;
//   · « taille 38,5 » mangeait 6 caractères de plus que « T38,5 » ;
//   · « Chaussures style Nike sacai » : 16 caractères de remplissage.
// Après : 0 coupé au plafond, 0 coupé en plein mot, 58 des 59 améliorés.
//
// ⚠️ LA MÊME FONCTION EXISTE DANS L'APP (`lbcTitre` dans App.jsx), parce que les
//    deux calculent la file chacun de leur côté — le panneau tourne sur
//    leboncoin.fr, où l'app n'est pas chargée (§11). `audit-places.cjs` exige que
//    les deux rendent EXACTEMENT le même titre sur les mêmes entrées : sans ça
//    l'app lui montre un titre et l'extension en publie un autre.
// ⚠️⚠️ CE QUI EST CAPTÉ SUR LA PAGE N'EST PAS TOUJOURS SA DESCRIPTION.
// Mesuré le 12 septembre sur ses 92 descriptions captées : **4** sont le texte
// PUBLICITAIRE de Vinted — « Une communauté, des milliers de marques et de
// styles de seconde main. Prêt à te lancer ? Découvre comment ça marche ! » —
// et **une de ces quatre est en ligne aujourd'hui**, donc elle partirait telle
// quelle sur Leboncoin, comme description de SON annonce. Une autre commence par
// le libellé « Description » collé au texte.
// C'est le même principe qu'`URL_PAS_UN_QR` : on ÉCARTE ce qui n'est pas la
// chose, sans jamais rien supprimer en base (la capture reste, c'est la
// PUBLICATION qui refuse).
const PAS_UNE_DESCRIPTION = /communaut[ée].{0,80}seconde main|pr[êe]t [àa] te lancer|d[ée]couvre comment [çc]a marche|t[ée]l[ée]charge l.application/i;
function lbcDescription(brut) {
  let t = String(brut || '').trim();
  if (!t) return '';
  if (PAS_UNE_DESCRIPTION.test(t)) return '';       // texte de Vinted, pas le sien
  t = t.replace(/^\s*Description\s*(?=\S)/, '');    // libellé collé au texte
  return t.trim();
}

const LBC_TITRE_MAX = 50;
// ⚠️ LE PLAFOND EST UN PARAMÈTRE, PAS UNE SECONDE RÈGLE. eBay accepte 80
//    caractères, Leboncoin 50 — mais « ne pas doubler la marque », « ne pas
//    couper en plein mot » et « la taille en suffixe » sont les MÊMES règles.
//    `buildEbayAd` recopiait sa propre version (`[marque, titre].join(' ')` puis
//    `.slice(0, 80)`) : mesuré le 13 septembre sur ses vraies annonces,
//    **18 titres sur 53 sortaient avec la marque écrite deux fois** (« Nike nike
//    shox tl », « Salomon salomon XT-6 ») — exactement le défaut corrigé pour
//    Leboncoin, resté entier à côté. Deux règles pour une notion, c'est §11.
function lbcTitre(brand, base, size, max) {
  let t = String(base || '').replace(/\s+/g, ' ').trim();
  // 1. Le remplissage PUR, et seulement lui.
  //    ⚠️ PAS le mot « chaussures » tout court : mesuré, il PORTE DU SENS trois
  //    fois sur quatre chez lui (« chaussures bateau », « chaussures de ville
  //    derby »). Mon premier jet en faisait « Bateau » et « Ville derby ». On ne
  //    le retire que devant la marque elle-même.
  t = t.replace(/^(?:chaussures?|baskets?|sneakers?)\s+(?:style|type|genre)\s+/i, '');
  const bq = String(brand || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (bq) t = t.replace(new RegExp('^(?:chaussures?|baskets?|sneakers?)\\s+(?=' + bq + '\\b)', 'i'), '');
  t = t.replace(/\s+/g, ' ').trim();
  // 2. La taille sort du texte et revient en suffixe : c'est ce sur quoi un
  //    acheteur filtre, donc elle ne doit JAMAIS être ce qu'on rogne.
  let vue = null;
  t = t.replace(/\btailles?\s*:?\s*(\d{1,2}(?:[.,]\d)?)\b/i, (m, n) => { vue = n; return ''; })
       .replace(/\bT\s*(\d{2}(?:[.,]\d)?)\b/i, (m, n) => { vue = n; return ''; })
       .replace(/\s+/g, ' ').trim();
  const taille = String(size || vue || '').replace(/^t(?=\d)/i, '').trim();
  // 3. La marque une seule fois.
  const b = String(brand || '').trim();
  if (b && !new RegExp('\\b' + bq + '\\b', 'i').test(t)) t = b + ' ' + t;
  t = t.replace(/\s+/g, ' ').trim();
  // 4. Une majuscule : un titre tout en minuscules se lit « bricolé ».
  t = t.charAt(0).toUpperCase() + t.slice(1);
  // ⚠️ Le « T » n'est une POINTURE que pour un nombre (chaussures) : une taille
  //    lettre (M, L, XL) n'est pas « TM ». Un reseller qui ne fait pas de
  //    chaussures ne doit pas voir son titre corrompu (Julien, 20 sept.).
  const estPointure = /^\d{1,2}(?:[.,]\d)?$/.test(taille);
  const suff = taille ? (estPointure ? ' T' + taille : ' ' + taille) : '';
  // 5. ⚠️ ON NE COUPE JAMAIS EN PLEIN MOT.
  const place = (max || LBC_TITRE_MAX) - suff.length;
  if (t.length > place) {
    const coupe = t.slice(0, place);
    const esp = coupe.lastIndexOf(' ');
    t = (esp > 12 ? coupe.slice(0, esp) : coupe).replace(/[\s,;:/-]+$/, '');
  }
  return (t + suff).trim();
}

function firstDefined(...v) { for (const x of v) if (x !== undefined && x !== null && x !== '') return x; return ''; }
function buildLbcAd(raw, det, num, account) {
  const brand = firstDefined(det.brand_dto && det.brand_dto.title, raw.brand_title, det.brand, raw.brand);
  const base = String(firstDefined(det.title, raw.title)).trim();
  const size = String(firstDefined(det.size, det.size_title, raw.size_title, raw.size)).trim();
  const cond = String(firstDefined(det.status, raw.status)).trim();
  const color = [firstDefined(det.color1, raw.color1), firstDefined(det.color2, raw.color2)].filter(Boolean).join(' ').trim();
  const price = String(firstDefined(det.price && det.price.amount, raw.price && raw.price.amount, raw.price, det.price)).replace(',', '.');
  const desc0 = lbcDescription(firstDefined(det.description, ''));
  // Photos HD
  let photos = [];
  const ph = det.photos || raw.photos || [];
  if (Array.isArray(ph)) photos = ph.map((p) => firstDefined(p.full_size_url, p.url, typeof p === 'string' ? p : '')).filter(Boolean);
  if (!photos.length && raw.photo && raw.photo.url) photos = [raw.photo.url];
  const title = lbcTitre(brand, base, size);
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
  // marque/taille : le formulaire Leboncoin a des listes déroulantes pour ça.
  return { id: String(raw.id), numero: String(num), ref, account: account || '', title, description, price, category: lbcCategory(det, raw), marque: brand || '', taille: size || '', etat: cond || '', photos, aDescription: !!desc0, vintedUrl: firstDefined(raw.url, det.url) };
}
// Extrait NOTRE numéro depuis n'importe quel texte d'annonce Leboncoin (titre +
// description). Marche pour un compte PRO (numérotation auto ignorée) comme pour
// un compte normal, car on lit d'abord notre jeton « VRM-{num} », puis « Réf X ».
// ── L'IDENTITÉ D'UN NUMÉRO : « 125 », « B125 »… (la MÊME règle que l'app,
// `cleNum`, §11). « VRM-b125 » et « B125 » désignent le même carton ; « 007 »
// vaut « 7 ». Sans ça, « VRM-B125 » se lisait « 125 » — une AUTRE paire.
function cleNum(v) {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
}
// Le numéro porté par « VRM-B125 » / « VRM-125 » ; sans « VRM- », l'ancienne
// lecture (les chiffres seuls). Identique à `refVRMDe` dans l'app.
const RE_VRM = /VRM[-\s]?((?:[A-Z]{1,3})?\d{1,6})(?!\d)/i;
function refVRMDe(txt) {
  const t = String(txt == null ? '' : txt);
  const m = RE_VRM.exec(t);
  if (m) return cleNum(m[1]);
  const d = /(\d{1,5})/.exec(t); return d ? cleNum(d[1]) : '';
}
function refFromVRM(text) { const m = RE_VRM.exec(String(text || '')); return m ? cleNum(m[1]) : ''; }
function refFromText(text) {
  const s = String(text || '');
  let m = RE_VRM.exec(s);
  if (m) return cleNum(m[1]);
  m = /r[ée]f\.?\s*[:#]?\s*(\d{1,5})/i.exec(s);
  return m ? m[1] : null;
}
// ⚠️⚠️ UNE ANNONCE QU'ON NE PEUT PAS LUI ATTRIBUER N'EST PAS LA SIENNE, ET CE
// FILTRE VIT AU **READ** — pas chez l'un des lecteurs.
// Mesuré le 13 septembre sur sa vraie base : `lbc_listings` contient **81
// annonces qui ne sont pas à lui** (chalets, gîtes, un appartement à La Plagne —
// le flux `api/discovery/category/53` de la page qu'il regardait, rangé à 06:38).
// Le filtre avait bien été posé sur `lbcCount`… et seulement là. `readLbcItems`
// rendait TOUT, donc :
//   · le panneau affichait « **81** vues sur Leboncoin » et déroulait
//     **81 chalets en « annonces non reliées »**, sur l'écran qui sert à publier
//     ses baskets — pendant que l'APP, elle, en affichait 0 (elle filtre depuis
//     le 13 au matin). Deux lecteurs, deux règles, la même ligne : §11.
//   · et surtout `adRefKeys` lit « n° 1234 » dans le TITRE de n'importe quelle
//     annonce : un chalet nommé « … n°412 » aurait relié la paire N°412 et
//     l'aurait **retirée de sa file en silence** (« déjà en ligne sur
//     Leboncoin »). Mesuré aujourd'hui : 0 cas — mais c'est un rapprochement par
//     ressemblance (§5) sur des données qui ne sont même pas les siennes.
// ⇒ Une seule règle, un seul propriétaire : `estALui` est la MÊME que celle de
//   l'app (`ad.ref || ad.customRef || ad.lbcUser`). Rien n'est supprimé en base.
function estALui(ad) { return !!(ad && (ad.ref || ad.customRef || ad.lbcUser)); }
// Lit les annonces Leboncoin captées (ligne lbc_listings) sous forme de tableau.
async function readLbcItems() {
  try {
    const rows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    const items = (rows && rows[0] && rows[0].data && rows[0].data.items) || {};
    return Object.values(items).filter((ad) => ad && estALui(ad));
  } catch (_) { return []; }
}
// Clés de rapprochement d'une annonce Leboncoin : sa référence pro (CustomRef),
// le VRM-xxx éventuel, et tout numéro « nXXXX » présent dans son titre.
// ⚠️ `liens` = `vrm_lbc_liens` (annonce LBC → N°), posé À LA MAIN dans l'app
// (« Relier », C4). Une identité qu'il pose lui-même ; l'app applique la même
// règle (`adKeys`), sinon l'app relie et le panneau ne relie pas (§11).
function adRefKeys(ad, liens) {
  const keys = [];
  // Toutes les clés passent par `cleNum` — des deux côtés (`vintedKeys`).
  const push = (v) => { const t = cleNum(v); if (t && !keys.includes(t)) keys.push(t); };
  if (liens && ad && ad.id != null && liens[String(ad.id)] != null) push(liens[String(ad.id)]);
  if (ad.customRef) push(refVRMDe(ad.customRef));
  if (ad.ref) push(ad.ref);
  const t = String(ad.subject || '');
  let m = RE_VRM.exec(t); if (m) push(m[1]);
  m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(t); if (m) push(m[1]);
  return keys;
}

// ── LE CHOIX DE JULIEN, ANNONCE PAR ANNONCE ─────────────────────────────────
// L'app est PROPRIÉTAIRE de `vinted_annonce_numeros[id].mp` (§11) ; ici on ne
// fait que LIRE. `undefined` = jamais touché → défaut ; `false` = retiré exprès.
// ⚠️ Le défaut de Leboncoin est OUI : c'est le comportement d'avant la
//    sélection, personne ne perd sa file du jour au lendemain.
const MP_DEFAUT = { lbc: true };
function mpChoisi(e, place) {
  const v = e && e.mp ? e.mp[place] : undefined;
  return (v === undefined || v === null) ? !!MP_DEFAUT[place] : !!v;
}

// ══════════════════════════════════════════════════════════════════════════════
// LA PREUVE D'UNE VENTE — UNE SEULE LECTURE, ET ELLE NE RAPATRIE QUE L'IDENTITÉ
// ══════════════════════════════════════════════════════════════════════════════
// `harvest_*_txn_*` porte `transaction.item_id` : c'est l'identité qui relie une
// vente à son annonce (§5), et c'est TOUT ce dont la file a besoin.
// ⚠️⚠️ CE BLOC ÉTAIT ÉCRIT TROIS FOIS, chaque fois en `select=data`. Mesuré le
// 15 septembre sur sa vraie base : **19,8 Mo en 5,0 s** par lecture, contre
// **16 Ko en 0,36 s** pour la projection — **1 251× moins d'octets, 14× plus
// vite**, et **exactement les mêmes 242 ventes prouvées** (0 manquante, 0 en
// trop). C'est §4.4 mot pour mot, et c'est de l'égress : un `select=data` sur le
// widget avait déjà crevé le quota (5,7 Go).
// ⚠️ Le repli `t.item.id` n'existe nulle part dans ses données (704 lignes sur
//    704 portent `item_id`) — mesuré avant de le retirer, pas supposé.
// ⚠️ Et « rien lu » ne vaut pas « rien » : une lecture ratée rend `null`, et
//    l'appelant doit pouvoir la distinguer d'une base sans aucune vente — sinon
//    une file entière se vide sur un timeout.
// ⚠️⚠️⚠️ ET « CITÉE DANS UNE TRANSACTION » N'EST PAS « VENDUE ». Mesuré le
// 15 septembre, en vérifiant la FORME (§6) : sur les **711 lignes** de cette
// famille, **468 portent `status: 1` et un `status_title` VIDE** — ce sont des
// **conversations**, pas des ventes. Une seule annonce en portait **treize**
// (« salomon XT-6 blanc taille 40 », toujours en ligne) : treize acheteurs lui
// ont écrit, aucun n'a acheté.
// Conséquence, sur ses **65 annonces en ligne** : la « preuve » en écartait
// **15** des files Leboncoin et eBay — **quinze paires qu'il a encore** et qu'il
// ne pouvait donc plus publier ailleurs. Avec un vrai statut de commande :
// **zéro**. (Sur les 412 annonces FERMÉES la preuve tenait : 188 statuts de
// vente — c'est ce qui l'a rendue invisible.)
// ⇒ Une vente est prouvée quand Vinted donne un **état de commande** à la
//   transaction (`status_title` non vide) ET que cet état ne la fait pas
//   REVENIR (annulée, retour, suspendue, paiement échoué → la paire est là).
//   On ne liste pas des codes numériques : un code inconnu demain doit compter
//   comme une vente, pas disparaître — c'est le même sens que
//   `classifyOrderStatus` côté app.
const PAS_UNE_VENTE = /annul|cancel|refus|rembours|retour|suspend|[ée]chou/i;
async function lireVentesProuvees() {
  const rows = await sbGetTout('app_data?id=like.harvest_*_txn_*&select=it:meta->>item_id,ti:meta->>status_title');
  if (rows === null) return { echec: true, vendus: new Set() };
  const vendus = new Set();
  for (const r of rows) {
    if (!r || !r.it) continue;
    const etat = String(r.ti || '').trim();
    if (!etat) continue;                       // conversation : aucune commande
    if (PAS_UNE_VENTE.test(etat)) continue;    // la paire revient
    vendus.add(String(r.it));
  }
  return { echec: false, vendus };
}

// ══════════════════════════════════════════════════════════════════════════════
// eBAY — MÊME MODÈLE QUE LEBONCOIN : ON PRÉPARE, C'EST LUI QUI PUBLIE
// ══════════════════════════════════════════════════════════════════════════════
// Julien a un compte particulier ET un compte professionnel. Le compte pro a un
// champ SKU (« numéro de référence ») : on y met `VRM-{n°}`, exactement comme la
// référence pro de Leboncoin — c'est ce qui permettra plus tard de reconnaître
// tout seul ce qui est déjà en ligne là-bas, sans rapprochement par titre (§5).
//
// ⚠️ AUCUNE PUBLICATION AUTOMATIQUE. On télécharge les photos, on copie le texte,
//    on ouvre le formulaire et on remplit les champs qu'on RECONNAÎT. Le bandeau
//    dit combien ont été remplis — s'il dit 0, rien n'a été reconnu et il le voit.
//    On ne promet pas une annonce prête : on prépare, il relit, il publie.
const EBAY_POSTED = 'vinted_ebay_posted';
async function readEbayPosted() {
  const rows = await sbGet(`app_data?id=eq.${EBAY_POSTED}&select=data`);
  const d = (rows && rows[0] && rows[0].data) || {};
  // Même règle que partout : une lecture ratée ne doit pas faire réécrire la
  // ligne depuis une liste vide (§ lire-fusionner-réécrire).
  return { echec: rows === null, ids: (d.ids || []).map(String) };
}
async function markEbayPosted(id, on) {
  const d = await readEbayPosted();
  if (d.echec) return false;
  const s = new Set(d.ids);
  if (on === false) s.delete(String(id)); else s.add(String(id));
  return await supabaseUpsert('app_data', [{ id: EBAY_POSTED, data: { ids: [...s], updatedAt: new Date().toISOString() } }], 'id');
}
// Le titre eBay va jusqu'à 80 caractères (50 sur Leboncoin) : on ne coupe pas
// au même endroit, et on ne devine AUCUNE catégorie — eBay la propose lui-même
// à partir du titre, une catégorie fausse ferait plus de mal que pas de
// catégorie du tout.
const EBAY_TITRE_MAX = 80;
function buildEbayAd(raw, det, num, account) {
  const a = buildLbcAd(raw, det, num, account);
  // ⚠️ LA MÊME RÈGLE DE TITRE QUE LEBONCOIN, AVEC UN AUTRE PLAFOND. L'ancienne
  //    version recollait marque + titre et coupait à 80 : mesuré sur ses vraies
  //    annonces, **18 titres sur 53 portaient la marque deux fois** et 51
  //    écrivaient « taille 42 » au lieu de « T42 ». Une seule règle, un seul
  //    propriétaire (§11) — le plafond est son paramètre.
  const marque = firstDefined(det.brand_dto && det.brand_dto.title, raw.brand_title, det.brand, raw.brand);
  const base = String(firstDefined(det.title, raw.title)).trim();
  const size = String(firstDefined(det.size, det.size_title, raw.size_title, raw.size)).trim();
  return { ...a, title: lbcTitre(marque, base, size, EBAY_TITRE_MAX), sku: a.ref, category: '' };
}
async function buildEbayData() {
  const main = (await lireMain(MAIN_FILE)) || {};
  const numeros = main.vinted_annonce_numeros || {};
  const labels = main.vinted_account_labels || {};
  const uid2login = {};
  (main.vinted_accounts || []).forEach((a) => { uid2login[String(a.vinted_user_id)] = labels[String(a.vinted_user_id)] || a.login || String(a.vinted_user_id); });
  // ⚠️ Un compte MASQUÉ à la main n'alimente pas la file. Un compte BANNI par
  //    Vinted (`vinted_accounts_blocked`), LUI, RESTE dans la file (Julien,
  //    25 sept.) : ses paires existent encore, il veut les publier ailleurs.
  //    Seuls les SUPPRIMÉS définitivement (`vrm_blocked_accounts`) restent exclus.
  const off = new Set((main.vinted_accounts_hidden || []).map(String));
  { const noirs = await blockedAccounts(); if (noirs) noirs.forEach((u) => off.add(String(u))); }
  const lost = main.vinted_pairs_lost || {};
  const pos = await readEbayPosted();
  const posted = new Set(pos.ids);
  const listRows = (await sbGet('app_data?id=like.harvest_*_listings&select=id,data')) || [];
  const itemRows = (await sbGet('app_data?id=like.harvest_*_item_*&select=id,data')) || [];
  const details = {};
  for (const r of itemRows) { const p = (r.data || {}).payload || {}; const it = (p && p.item) || p; if (it && it.id) details[String(it.id)] = it; }
  const pageRows = await sbGet('app_data?id=eq.vinted_item_details&select=data');
  const pageDet = (pageRows && pageRows[0] && pageRows[0].data) || {};
  for (const id in pageDet) {
    const pd = pageDet[id] || {}; const cur = details[id] || {};
    if (!cur.description && pd.description) cur.description = pd.description;
    if ((!cur.photos || !cur.photos.length) && pd.photos && pd.photos.length) cur.photos = pd.photos.map(u => ({ url: u }));
    details[id] = cur;
  }
  // ⚠️⚠️ UNE PAIRE DÉJÀ VENDUE NE DOIT PAS ENTRER DANS LA FILE eBAY.
  // C'est la plainte de Julien du 13 septembre (« des paires qui sont vendues »),
  // corrigée pour Leboncoin le jour même — et laissée entière ici. Mesuré le même
  // jour sur ses vraies données : sur ses **53 annonces en ligne et numérotées,
  // 14 portent une vente PROUVÉE** (`transaction → item_id`, §5 : l'identité,
  // jamais la ressemblance). Vinted ne ferme pas toujours l'annonce après la
  // vente, et la capture d'un compte peut dater de plusieurs jours : l'état de
  // l'annonce ne suffit donc pas. La preuve de vente PRIME.
  // Le jour où il coche « eBay », il se verrait proposer de mettre en vente
  // quatorze paires qu'il n'a plus — et sur eBay une vente engage une expédition.
  // ⚠️ Même règle que Leboncoin : une preuve qu'on n'a PAS PU LIRE ne vaut pas
  //    « rien n'est vendu ». Sur eBay c'est plus coûteux encore — une vente y
  //    engage une expédition qu'il ne peut pas faire.
  const preuve = await lireVentesProuvees();
  const vendus = preuve.vendus;
  const queue = []; const vus = new Set(); let retirees = 0, vendues = 0;
  for (const r of listRows) {
    const d = r.data || {}; const p = d.payload || {}; const uid = String(d.uid);
    if (off.has(uid)) continue;
    for (const it of (p.items || [])) {
      const oid = String(it.id);
      if (it.is_closed || it.is_hidden || it.is_draft) continue;
      if (vus.has(oid)) continue; vus.add(oid);
      const e = numeros[oid]; const num = e && e.numero;
      if (!num || String(num).trim() === '') continue;      // il lui faut un N° (la réf)
      if (!mpChoisi(e, 'ebay')) { retirees++; continue; }   // pas cochée pour eBay
      // ⚠️ On compte celles qu'on écarte : une file qui rétrécit sans explication
      //    se lit comme une perte (leçon de l'écran Leboncoin).
      if (vendus.has(oid)) { vendues++; continue; }
      if (lost[String(num).trim()]) continue;
      if (posted.has(oid) || posted.has(String(num))) continue;
      queue.push(buildEbayAd(it, details[oid] || {}, num, uid2login[uid]));
    }
  }
  queue.sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  return { queue, retirees, vendues, preuveKO: preuve.echec, postedCount: posted.size, echec: pos.echec };
}

async function buildLbcData() {
  const main = (await lireMain(MAIN_FILE)) || {};
  const numeros = main.vinted_annonce_numeros || {};
  const lost = main.vinted_pairs_lost || {};
  const liens = main.vrm_lbc_liens || {};
  const labels = main.vinted_account_labels || {};
  const accounts = main.vinted_accounts || [];
  const uid2login = {};
  accounts.forEach((a) => { uid2login[String(a.vinted_user_id)] = labels[String(a.vinted_user_id)] || a.login || String(a.vinted_user_id); });
  // ⚠️⚠️ UN COMPTE QU'IL A EXCLU DE L'APP N'ALIMENTE PAS LA FILE.
  // Mesuré le 13 septembre sur sa vraie base : la file du panneau contenait
  // **la N°118, qui vient de `liliand653`** — le compte que Julien a lui-même
  // mis de côté. Le panneau lui proposait donc de publier sur Leboncoin
  // l'annonce d'un compte qu'il a écarté. C'est § « un CHOIX n'est pas une
  // panne » retourné : une fois le geste fait, l'app n'a plus rien à en tirer.
  // ⚠️ Et l'APP, elle, filtrait déjà (`offAcc`) — comme `buildEbayData`. Seule
  //    cette file-ci ne le faisait pas : l'app annonçait 39 et le panneau 40,
  //    sur exactement la même donnée. Deux règles pour une notion, §11.
  // ⚠️ Un compte MASQUÉ à la main n'alimente pas la file (choix explicite).
  // ⚠️⚠️ UN COMPTE BANNI PAR VINTED (`vinted_accounts_blocked`) RESTE dans la
  //    file (Julien, 25 sept.) : ses paires existent encore, il veut pouvoir les
  //    publier sur Leboncoin/eBay/Vestiaire. Elles sortent de « en ligne »
  //    Vinted mais restent PUBLIABLES ailleurs — renversement assumé de l'ancienne
  //    règle « un compte mort n'alimente aucune file ».
  const off = new Set((main.vinted_accounts_hidden || []).map(String));
  // ⚠️⚠️ SEULS LES SUPPRIMÉS DÉFINITIVEMENT (`vrm_blocked_accounts`) RESTENT
  // exclus : c'est un choix explicite de suppression (shop_cancale, 199082413),
  // pas un bannissement subi. `null` (jamais lu) ⇒ on n'exclut RIEN (ne pas
  // cacher les paires d'un compte vivant sur un hoquet).
  { const noirs = await blockedAccounts(); if (noirs) noirs.forEach((u) => off.add(String(u))); }
  // Déjà publiées sur Leboncoin (ligne DÉDIÉE → on n'écrase jamais le blob main).
  const postedData = await readPostedData();
  const posted = new Set(postedData.ids);
  const lbcLimit = postedData.limit;
  const lbcPlan = postedData.plan;
  // Annonces EN LIGNE (harvest listings).
  const listRows = (await sbGet('app_data?id=like.harvest_*_listings&select=id,data')) || [];
  const online = []; const onlineIds = new Set(); const seen = new Set();
  let exclues = 0;
  for (const r of listRows) {
    const d = r.data || {}; const p = d.payload || {}; const uid = String(d.uid);
    // ⚠️ On COMPTE ce qu'on écarte : une file qui rétrécit sans explication se
    //    lit comme une perte (leçon de l'écran Leboncoin).
    if (off.has(uid)) {
      for (const it of (p.items || [])) {
        if (it.is_closed || it.is_hidden || it.is_draft) continue;
        const e = numeros[String(it.id)];
        if (e && String(e.numero || '').trim() !== '' && mpChoisi(e, 'lbc')) exclues++;
      }
      continue;
    }
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
  // ── « VENDUE » SE PROUVE, ELLE NE SE DÉDUIT PAS D'UNE ABSENCE ─────────────
  // ⚠️⚠️ Le moteur disait « vendue sur Vinted » dès qu'une annonce n'était PLUS
  // en ligne — et l'écran l'écrivait en rouge. Or une annonce peut sortir de la
  // liste parce qu'il l'a MISE EN PAUSE ou retirée. Mesuré le 12 septembre sur
  // ses vraies données : sur ses **400 annonces fermées, seules 151** portent une
  // vente prouvée. Dire « vendue » pour les 249 autres, c'est lui faire retirer
  // de Leboncoin une paire qu'il a encore — donc perdre la vente.
  // L'identité, elle, existe et elle est complète : les 400 lignes
  // `harvest_*_txn_*` portent TOUTES leur `item_id` (§5 : l'identité d'une paire,
  // jamais la ressemblance). C'est donc ça qui prouve la vente.
  // ⚠️ Et l'absence de preuve n'est PAS une preuve d'absence : une paire fermée
  //    sans transaction captée se dit « à vérifier », jamais « pas vendue ».
  // ⚠️⚠️ ET « JE N'AI PAS PU LIRE » N'EST PAS « AUCUNE VENTE ».
  // Mesuré en direct le 15 septembre, pendant les essais : cette lecture a
  // échoué une fois (la base sous charge), `|| []` l'a transformée en « aucune
  // vente prouvée » — et la file est passée de **40 à 55 paires**. Quinze paires
  // DÉJÀ VENDUES se seraient reproposées à la publication, sans un mot. C'est
  // exactement la plainte du 13 septembre (« des paires qui sont vendues »),
  // ressuscitée par un simple timeout. Quinzième forme de « rien lu ne vaut pas
  // rien » — et la première où c'est une LECTURE RATÉE qui rallume un défaut
  // qu'on venait de corriger.
  const preuveLbc = await lireVentesProuvees();
  const vendus = preuveLbc.vendus;
  // L'état Vinted réel de chaque annonce connue : vendue (prouvé) · en pause ·
  // fermée sans preuve · jamais vue. Trois états, pas deux (même leçon que le
  // panneau de sécurité).
  const etatVinted = {};
  for (const r of listRows) {
    const p = (r.data && r.data.payload) || {};
    for (const it of (p.items || [])) {
      const oid = String(it.id);
      etatVinted[oid] = it.is_hidden ? 'pause' : (it.is_draft ? 'brouillon'
        : (it.is_closed ? (vendus.has(oid) ? 'vendue' : 'fermee') : 'enligne'));
    }
  }
  const etatDe = (oid) => etatVinted[String(oid)] || (vendus.has(String(oid)) ? 'vendue' : 'inconnue');

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
    for (const k of adRefKeys(ad, liens)) if (!lbcByRef.has(k)) lbcByRef.set(k, ad);
  }
  // Clés de rapprochement d'une annonce Vinted : son numéro VRM + le « nXXXX »
  // présent dans son titre (les deux numérotations coexistent chez toi).
  const vintedKeys = (o, num) => {
    const keys = [];
    if (num != null && String(num).trim() !== '') keys.push(cleNum(num));
    const t = String((o.raw && o.raw.title) || '');
    const m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(t);
    if (m) keys.push(cleNum(m[1]));
    return keys;
  };
  const autoMatched = new Map(); // id d'annonce Vinted -> annonce LBC trouvée

  const queue = [];
  for (const o of online) {
    const e = numeros[o.id]; const num = e && e.numero;
    if (!num || String(num).trim() === '') continue;          // seulement les annonces numérotées
    if (!mpChoisi(e, 'lbc')) continue;                          // retirée par Julien (écran Annonces)
    // ⚠️⚠️ VENDUE = HORS DE LA FILE, même si Vinted la dit encore en ligne.
    // Mesuré le 13 septembre sur ses vraies données : **14 des 57** annonces
    // « en ligne » portent une vente PROUVÉE (`transaction → item_id`). Vinted
    // ne ferme pas toujours l'annonce, et la capture d'un compte peut dater
    // (mesuré : `julatace3535` à 85 h). Résultat, il voyait dans la file des
    // paires déjà vendues — exactement ce qu'il a signalé. La preuve de vente
    // prime sur l'état de l'annonce : on ne propose pas de publier une paire
    // qu'il n'a plus.
    if (vendus.has(o.id)) continue;
    // ⚠️ UNE PAIRE RETIRÉE DU STOCK N'EST PAS À PUBLIER NON PLUS, et cette
    //    ligne-ci manquait : l'app et la file eBay écartaient déjà `pairs_lost`,
    //    le panneau Leboncoin lui proposait de publier une paire qu'il n'a plus.
    //    Mesuré le 15 septembre : **0 paire retirée aujourd'hui**, donc 0 cas
    //    réel — mais c'est le motif exact de « l'app annonçait 39, le panneau
    //    40 » (§11), et une paire publiée qu'on ne peut pas envoyer coûte cher.
    if (lost[String(num).trim()]) continue;
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
    removals.push({ id: pid, numero: String(e.numero || '?'), ref: 'VRM-' + (e.numero || '?'), title: e.title || '', etat: etatDe(pid) });
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
      if (e.numero != null && String(e.numero).trim() !== '') keysKnown.add(cleNum(e.numero));
      const m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(String(e.title || ''));
      if (m) keysKnown.add(cleNum(m[1]));
    }
    for (const ad of lbcItems) {
      if (/(supprim|delete|expir|refus|sold|vendu)/i.test(String(ad.status || ''))) continue;
      const keys = adRefKeys(ad, liens);
      if (!keys.length) { unlinked.push(lbcRow(ad, keys)); continue; }
      if (keys.some((k) => keysOnline.has(k))) continue;   // encore en ligne sur Vinted
      // Paire inconnue de VRM : on ne crie PAS « à retirer » (on risquerait de
      // faire supprimer une bonne annonce). On la remonte à part, pour info.
      if (!keys.some((k) => keysKnown.has(k))) { unlinked.push(lbcRow(ad, keys)); continue; }
      const key = 'lbc:' + ad.id;
      if (removalSeen.has(key)) continue; removalSeen.add(key);
      // L'état vient de l'annonce VINTED que ces clés désignent — pas de
      // l'annonce Leboncoin, qui ne sait rien de la vente.
      let etat = 'inconnue';
      for (const id in numeros) {
        const en = numeros[id] || {};
        const k2 = cleNum(en.numero);
        if (k2 && keys.includes(k2)) { etat = etatDe(id); break; }
      }
      removals.push({
        id: key, lbcId: String(ad.id), numero: keys[0] || '?',
        ref: ad.customRef || keys[0] || '?', title: ad.subject || '',
        url: ad.url || '', auto: true, etat,
      });
    }
  }
  removals.sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  // Compteur d'annonces Leboncoin : ce que TU as marqué publié (fiable) et, si la
  // capture LBC a remonté quelque chose, le nombre réellement vu en ligne.
  // ⚠️⚠️ « JAMAIS LU » N'EST PAS « ZÉRO ». Mesuré le 12 septembre : `lbc_listings`
  // est ABSENTE de sa base — la capture, qui dépendait de `__NEXT_DATA__`, ne
  // trouvait plus rien depuis que Leboncoin a changé de format. Le panneau
  // annonçait pourtant « 📊 0 annonce sur Leboncoin », et la liste « à retirer »
  // restait vide : le « vendue sur Vinted → retire-la » ne pouvait PAS marcher,
  // sans que rien ne le dise. On porte donc l'information.
  let lbcCount = 0;
  let lbcJamaisLu = true;
  try {
    const lbcRows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    if (lbcRows !== null) {                       // `null` = la base n'a pas répondu
      const ligne = lbcRows && lbcRows[0];
      // ⚠️ « jamais capté » veut dire : aucune annonce QUI SOIT À LUI. La ligne
      //    peut exister et ne contenir que des annonces d'autres (les 81 du
      //    13 septembre) — auquel cas on n'a toujours rien vu de son côté, et
      //    afficher « 0 » serait le zéro inventé qu'on vient de retirer.
      lbcJamaisLu = !ligne;
      const items = (ligne && ligne.data && ligne.data.items) || {};
      // ⚠️ 81 annonces rangées le 13 septembre n'étaient PAS à lui (le flux
      //    « découverte » de la page). Elles restent en base — on ne supprime
      //    rien — mais elles ne COMPTENT pas : une annonce qu'on ne peut pas
      //    lui attribuer n'est pas la sienne.
      // ⚠️ LA MÊME règle que `readLbcItems` (`estALui`), pas une copie qui dérive :
      //    celle-ci oubliait `customRef`, que l'app accepte — un troisième écart
      //    sur la même notion.
      lbcCount = Object.values(items).filter((v) => estALui(v)
        && !/(supprim|delete|expir|refus|sold|vendu)/i.test(String(v.status || ''))).length;
    }
  } catch (_) {}
  if (lbcCount === 0) lbcJamaisLu = true;       // rien d'attribuable = rien vu
  const postedCount = [...posted].filter((x) => /^\d+$/.test(x)).length;
  // Quota détecté automatiquement depuis l'offre Leboncoin (si trouvé).
  let detected = null;
  // ⚠️ §4.4 : `lbc_recon` pèse **67 Ko** (échantillons de réponses) et on n'en
  //    veut qu'UNE valeur — mesuré : 67 Ko / 725 ms en entier, **16 octets /
  //    165 ms** projetée, à chaque ouverture du panneau sur leboncoin.fr.
  try { const rec = await sbGet('app_data?id=eq.lbc_recon&select=quota:data->quota'); const q = rec && rec[0] && rec[0].quota; if (q && q.value) detected = q.value; } catch (_) {}
  // Compteurs de diagnostic (pour comprendre si la file est vide et pourquoi).
  const numberedOnline = online.filter((o) => { const e = numeros[o.id]; return e && String(e.numero || '').trim() !== ''; }).length;
  const stats = { postedCount, lbcCount, lbcJamaisLu, preuveKO: preuveLbc.echec, limit: lbcLimit, plan: lbcPlan, detected, exclues, onlineCount: online.length, numberedCount: numberedOnline, queueCount: queue.length,
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
    // ⚠️ « RIEN LU » NE VAUT PAS « RIEN ». `sbGet` rend `null` quand la base n'a
    //    pas répondu : repartir de `{}` réécrirait la ligne avec la seule annonce
    //    du moment, et effacerait tout l'historique de ses annonces Leboncoin.
    //    Le cas qui détruit n'est pas la panne totale (l'écriture échoue aussi),
    //    c'est LECTURE KO / ÉCRITURE OK — un simple timeout.
    if (prevRows === null) return;
    const prev = (prevRows[0] && prevRows[0].data && prevRows[0].data.items) || {};
    const merged = Object.assign({}, prev);
    for (const l of listings) { if (l && l.id) merged[String(l.id)] = Object.assign({}, merged[String(l.id)], l, { seenAt: new Date().toISOString() }); }
    const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_listings', data: { items: merged, updatedAt: new Date().toISOString(), lastUrl: url } }], 'id');
    noterFlux('leboncoin', _okFlux !== false);
  } catch (_) {}
}
// COMPTES LEBONCOIN connectes. Julien en a plusieurs : on garde la liste des
// comptes reellement vus dans le navigateur, avec la date de derniere vue. L'app
// s'en sert pour dire depuis quel compte publier, et pour repartir les annonces.
async function storeLbcAccount(acc) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
    if (prevRows === null) return;                 // pas su ≠ aucun compte (voir storeLbcListings)
    const prev = (prevRows[0] && prevRows[0].data && prevRows[0].data.accounts) || {};
    const merged = Object.assign({}, prev);
    // ⚠️ AUTO-NETTOYAGE (§5) : un correctif de la détection ne suffit pas — les
    //    comptes captés à tort AVANT restent en base. On retire ceux dont la
    //    `source` est une fiche d'AUTRUI (user-card / discovery / same / search /
    //    dashboard). On ne retire QUE sur une source positivement « autrui » :
    //    une source absente ou inconnue est laissée (mieux vaut garder un compte
    //    douteux que supprimer le sien sur un doute). Le compte à lui, venu de
    //    `linked_accounts`, ne matche pas et reste.
    for (const id of Object.keys(merged)) {
      const s = merged[id] && merged[id].source;
      if (s && LBC_URL_AUTRUI.test(String(s))) delete merged[id];
    }
    merged[String(acc.id)] = Object.assign({}, merged[String(acc.id)], acc, { seenAt: new Date().toISOString() });
    // Le compte Leboncoin CONNECTÉ, gardé dans le navigateur : la petite carte
    // de l'extension le nomme sans relire la base. Seulement sur un endpoint
    // « moi » (jamais la fiche d'autrui — même règle que la détection, §11).
    try {
      if (!acc.source || !LBC_URL_AUTRUI.test(String(acc.source))) {
        await chrome.storage.local.set({ vrmLbcCompte: { id: String(acc.id), name: String(acc.name || ''), type: acc.type || '', at: Date.now() } });
      }
    } catch (_) {}
    const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_accounts', data: { accounts: merged, updatedAt: new Date().toISOString() } }], 'id');
    noterFlux('leboncoin', _okFlux !== false);
  } catch (_) {}
}
// RECON : on garde un échantillon des réponses Leboncoin (chemins d'API + un bout
// de corps) pour brancher l'extraction au millimètre. Ligne dédiée lbc_recon.
async function storeLbcRecon(patch) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_recon&select=data');
    // ⚠️⚠️ C'EST LA LIGNE QUI PORTE LA CARTE DU FORMULAIRE DE DÉPÔT (`form`,
    //    `etapes`) — celle qu'on attend depuis des semaines, et qu'un seul dépôt
    //    fait à la main remplira. Une lecture ratée réécrivait la ligne avec le
    //    seul échantillon du moment : la carte partait, et il faudrait refaire
    //    le dépôt. Prouvé : `form:PERDU · etapes:PERDUES`.
    if (prevRows === null) return;
    const prev = (prevRows[0] && prevRows[0].data) || {};
    const next = Object.assign({ paths: [], samples: [] }, prev);
    if (patch.paths) { const set = new Set([...(next.paths || []), ...patch.paths]); next.paths = [...set].slice(0, 300); }
    if (patch.sample) { next.samples = [patch.sample, ...(next.samples || [])].slice(0, 6); }
    // La carte complète : un schéma par endpoint, fusionné (jamais remplacé),
    // borné aux 80 endpoints les plus récents. Structure seule, pas de valeur.
    if (patch.schemaOne && patch.schemaOne.endpoint) {
      const sc = Object.assign({}, next.schemas || {});
      sc[String(patch.schemaOne.endpoint).slice(0, 120)] = { cles: (patch.schemaOne.cles || []).slice(0, 200), at: new Date().toISOString() };
      const ks = Object.keys(sc);
      if (ks.length > 80) { const keep = ks.sort((a, b) => Date.parse(sc[b].at || 0) - Date.parse(sc[a].at || 0)).slice(0, 80); for (const k of ks) if (!keep.includes(k)) delete sc[k]; }
      next.schemas = sc;
    }
    if (patch.url) next.lastUrl = patch.url;
    // ⚠️⚠️⚠️ CETTE FONCTION JETAIT `etapes` ET `capture` — EN SILENCE.
    //    Mesuré le 17 septembre, juste après que Julien a fait son dépôt à la
    //    main : `lbc_recon.form` écrit à 12:18:55 avec 3 champs (donc
    //    `captureDepositForm` a bel et bien tourné, et le handler a bel et bien
    //    construit `etapes`)… et `etapes` **toujours absente de la base**.
    //    Cause : il y avait `if (patch.form)` et `if (patch.quota)`, et RIEN
    //    pour `patch.etapes` ni `patch.capture`. Les deux moitiés existaient,
    //    le raccord manquait — le motif du tiroir `Nav` (§4.11), sur la donnée
    //    que j'attends depuis trois passes. **Il a fait ce dépôt pour rien, et
    //    c'est de mon fait.**
    //    ⚠️ Et ça réécrit l'histoire de `lbcDiag` : le dossier disait « il n'a
    //      jamais tourné » ; en réalité c'est son rangement qui le jetait.
    // ⇒ ON NE RANGE PLUS CLÉ PAR CLÉ. Tout ce qu'un appelant envoie est gardé ;
    //   seules `paths` et `sample` ont besoin d'une fusion particulière (au-dessus).
    //   Une clé oubliée ne peut plus disparaître sans un mot.
    for (const k of Object.keys(patch)) {
      if (k === 'paths' || k === 'sample' || k === 'url' || k === 'schemaOne') continue;   // déjà traitées
      if (patch[k] === undefined) continue;
      next[k] = patch[k];
    }
    next.updatedAt = new Date().toISOString();
    const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_recon', data: next }], 'id');
    noterFlux('leboncoin', _okFlux !== false);
    if (patch.etapes || patch.envois) await publierPrepLbc();   // idem
  } catch (_) {}
}
// LA VENTE LEBONCOIN — la surface qu'on attendait pour « vendue → à retirer » et
// « capter le bordereau comme sur Vinted ». On range un échantillon capé par
// FAMILLE d'endpoint (ids gommés), une place chacune : la vente d'après rafraîchit
// la carte au lieu de l'écraser, et rien ne peut l'évincer. On NE parse RIEN ici
// (on ne devine pas la forme d'une vente jamais vue) — on collecte, la prochaine
// passe branchera l'extraction + la capture du PDF sur la vraie forme (§6.3).
async function storeLbcVente(url, body, coupe) {
  try {
    let fam = '';
    try { const u = new URL(url); fam = (u.host + u.pathname).replace(/\/\d{3,}/g, '/{id}').replace(/\/[0-9a-f]{16,}/gi, '/{id}'); }
    catch (_) { fam = String(url).split('?')[0].slice(0, 120); }
    fam = fam.slice(0, 120);
    if (!fam) return;
    const prevRows = await sbGet('app_data?id=eq.lbc_recon&select=data');
    if (prevRows === null) return;                 // pas su ≠ vide (§ storeLbcListings)
    const cur = (prevRows[0] && prevRows[0].data) || {};
    const ventes = Object.assign({}, cur.ventes || {});
    ventes[fam] = { url: String(url).split('?')[0].slice(0, 160), body, coupe: !!coupe, ver: EXT_VERSION, at: new Date().toISOString() };
    // Borné : au plus 12 familles, les plus récentes.
    const noms = Object.keys(ventes);
    if (noms.length > 12) { const g = noms.sort((x, y) => Date.parse((ventes[y] || {}).at || 0) - Date.parse((ventes[x] || {}).at || 0)).slice(0, 12); for (const n of noms) if (!g.includes(n)) delete ventes[n]; }
    await storeLbcRecon({ ventes });
  } catch (_) {}
}

// ══════════════════════════════════════════════════════════════════════════════
// LES VENTES LEBONCOIN — comme sur Vinted : l'état + le BORDEREAU, par vente
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « je veux comme pour Vinted les ventes, les bordereaux, les annonces ».
// MESURÉ le 20 septembre sur sa vraie base, après son tour (capture 5.101 non
// tronquée) : le détail d'une transaction Leboncoin porte, POUR UNE VENTE :
//   • `is_seller: true` — l'identité « c'est bien MOI le vendeur » (§5, jamais
//     déduite d'un titre) ;
//   • `item.id` + `item.title` + `item.prices.final` — l'annonce concernée ;
//   • `step.status` / `step.label` (« Colis à envoyer », …) — l'état de la vente ;
//   • `mondial_relay.label_information.{reference,voucher_url,qrcode_url,tracking_url}`
//     — LE BORDEREAU (le `voucher_url` est le PDF), exactement le pendant du
//     `label_latest` de Vinted.
// La liste `v3/pages/transactions` donne le résumé (purchase_id, item, step).
//
// ⇒ On range chaque vente dans une ligne DÉDIÉE `lbc_ventes`, clé = id de
//   transaction, en lire-fusionner-réécrire ENRICHISSANT (le résumé pose l'état,
//   le détail ajoute le bordereau) — jamais un vide n'écrase une valeur connue,
//   et `null` sur lecture ratée = on n'écrit pas (§ storeLbcListings, la famille
//   « rien lu ≠ rien »). Aucune donnée perso : ni acheteur, ni adresse.
// ⚠️ On COLLECTE seulement — l'app ne promet encore rien : le lien avec sa PAIRE
//   VRM passe par la réf lue sur l'annonce Leboncoin (`lbc_listings`), pas encore
//   captée. « On collecte, on vérifie, PUIS on promet. »
function labelInfoDe(d) {
  // Le bloc `label_information` vit sous le transporteur (mesuré : `mondial_relay`).
  // On le trouve par sa FORME, pas par un nom deviné : le premier objet de premier
  // niveau qui en porte un.
  if (!d || typeof d !== 'object') return null;
  if (d.label_information && typeof d.label_information === 'object') return d.label_information;
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (v && typeof v === 'object' && v.label_information && typeof v.label_information === 'object') return v.label_information;
  }
  return null;
}
// La première URL d'image trouvée dans l'article d'une transaction Leboncoin.
// On ne connaît pas le champ exact (page jamais vue d'ici, 403) : on essaie les
// formes usuelles, puis on balaie l'objet `item` à la recherche d'une URL
// d'image. Rien trouvé ⇒ chaîne vide (la carte garde sa place, sans fausse image).
function imageDeVente(d) {
  try {
    const it = (d && d.item) || {};
    // ⚠️ MESURÉ : le détail v2 d'une vente Leboncoin porte la photo dans
    //    `item.thumb_url` (CDN `img.leboncoin.fr`, URL en `.jpg?rule=ad-thumb`),
    //    la liste v3 dans `item.thumbnail_url`. On accepte donc l'extension d'image
    //    ET le CDN Leboncoin/Vinted (une URL d'image sans extension propre existe).
    const estImg = (s) => typeof s === 'string' && /^https?:\/\//.test(s) && (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(s) || /img\.leboncoin\.fr|images?\.vinted|vinted\.net/i.test(s));
    const prem = (x) => {
      if (!x) return '';
      if (estImg(x)) return x;
      if (Array.isArray(x)) { for (const e of x) { const u = prem(e); if (u) return u; } return ''; }
      if (typeof x === 'object') { for (const k of ['url', 'href', 'src', 'large_url', 'thumb_url', 'thumbnail_url', 'small_url', 'image_url']) if (estImg(x[k])) return x[k]; }
      return '';
    };
    // formes usuelles d'abord — y compris les CHAÎNES directes `thumb_url` /
    // `thumbnail_url` portées par l'article Leboncoin (ni objet, ni tableau).
    for (const champ of [it.thumb_url, it.thumbnail_url, it.image_url, it.large_url, it.images, it.image, it.pictures, it.picture, it.photos, it.photo, it.thumb, it.thumbnail]) {
      const u = prem(champ); if (u) return u;
    }
    // sinon, balayage borné de l'article (profondeur 3) pour toute URL d'image
    const vu = new Set(); const pile = [[it, 0]];
    while (pile.length) {
      const [o, prof] = pile.pop();
      if (!o || typeof o !== 'object' || prof > 3 || vu.has(o)) continue; vu.add(o);
      for (const k in o) { const val = o[k]; if (estImg(val)) return val; if (val && typeof val === 'object') pile.push([val, prof + 1]); }
    }
  } catch (_) {}
  return '';
}
// La date de VENTE d'une transaction Leboncoin (5.131) : `created_at` de la
// liste v3, et seulement si elle se lit comme une date — sinon rien (« à dater »).
function dateVenteLbc(t) {
  const c = t && t.created_at;
  return (typeof c === 'string' && !isNaN(Date.parse(c))) ? c : '';
}
function extraireVentesLbc(url, body) {
  let j; try { j = typeof body === 'string' ? JSON.parse(body) : body; } catch (_) { return []; }
  // Résumé : la liste des transactions (v3).
  if (Array.isArray(j)) {
    // ⚠️⚠️ LA DATE DE LA VENTE (3 octobre) : le CA déclaré à l'URSSAF est daté
    //    au jour de la VENTE (§5), et AUCUNE vente Leboncoin n'en portait — `at`
    //    est l'heure de capture. Seule la liste v3 la porte (`created_at`, relevé
    //    dans `lbc_recon.schemas`) : on la garde, et une fois posée elle ne
    //    bouge plus (`rangerLbcVentes`). Une chaîne qui ne se lit pas comme une
    //    date n'est pas gardée — mieux vaut « à dater » qu'une date fausse.
    // ⚠️ LE PRIX DE LA LISTE N'EST PAS LE PRIX DE LA VENTE : mesuré 2928 dans la
    //    liste (total acheteur, frais et port) contre 2500 dans le détail
    //    (`prices.final`). Il est gardé à part (`prixListe`) et n'écrase plus
    //    jamais `price`, qui ne vient que du détail.
    return j.map((t) => t && {
      txId: String((t.id && t.id.purchase_id) || t.purchase_id || ''),
      title: (t.item && t.item.title) || '',
      prixListe: (t.item && t.item.price != null) ? t.item.price : (t.price != null ? t.price : null),
      dateVente: dateVenteLbc(t),
      stepStatus: typeof t.step === 'string' ? t.step : ((t.step && t.step.status) || ''),
    }).filter((x) => x && x.txId);
  }
  // Détail : une transaction (v2 API, ou page Next enveloppée).
  const d = (j && j.pageProps && (j.pageProps.transaction || j.pageProps.data)) || j;
  if (d && typeof d === 'object' && (d.item || d.step || d.parcel_id || d.is_seller != null)) {
    const mid = String(url).match(/transactions?\/(\d+)/);
    const li = labelInfoDe(d);
    const pr = (d.item && d.item.prices) || {};
    // ⚠️ LE VRAI SIGNAL « FINALISÉ » (Julien : « regarde ce que l'extension dit »).
    // MESURÉ sur le détail v2 : `step.label` « Paiement effectué » est ambigu, mais
    // `parcel` tranche — `last_event_status: delivered`, `timeline_config.color_status:
    // finished` (current_step_index 3/4). On capte ces deux-là pour que l'app
    // classe sur la mesure, pas sur un mot. LECTURE seule, aucune donnée perso.
    const pcl = (d.parcel && d.parcel.timeline_config) || {};
    const v = {
      txId: (mid && mid[1]) || String((d.id && d.id.purchase_id) || d.purchase_id || (d.item && d.item.id) || ''),
      itemId: String((d.item && d.item.id) || ''),
      // ⚠️ L'IMAGE DE LA VENTE — on ne DEVINE pas un champ : on cherche la
      // première URL d'image réelle dans l'article (plusieurs formes possibles,
      // jamais vues d'ici en 403). Absente ⇒ la carte garde sa place vide, elle
      // n'invente pas d'image (§5). LECTURE seule.
      image: imageDeVente(d),
      title: (d.item && d.item.title) || '',
      price: (pr.final != null ? pr.final : (pr.total != null ? pr.total : null)),
      isSeller: d.is_seller === true ? true : (d.is_seller === false ? false : undefined),
      stepStatus: (d.step && d.step.status) || (typeof d.step === 'string' ? d.step : ''),
      stepLabel: (d.step && d.step.label) || '',
      parcelStatus: (d.parcel && d.parcel.last_event_status) || '',
      parcelColor: pcl.color_status || '',
      deliveryMethod: d.delivery_method || '',
      deliveryLabel: d.delivery_method_label || '',
      label: li ? {
        reference: li.reference || '', voucherUrl: li.voucher_url || '',
        qrUrl: li.qrcode_url || '', trackingUrl: li.tracking_url || '',
      } : null,
    };
    return v.txId ? [v] : [];
  }
  return [];
}
async function rangerLbcVentes(list) {
  if (!list || !list.length) return;
  const prev = await sbGet('app_data?id=eq.lbc_ventes&select=data');
  if (prev === null) return;                          // pas su ≠ vide — on n'écrase rien
  const cur = (prev[0] && prev[0].data) || {};
  const ventes = Object.assign({}, cur.ventes || {});
  for (const v of list) {
    const k = v.txId; if (!k) continue;
    const old = ventes[k] || {};
    const m = Object.assign({}, old);
    for (const [kk, vv] of Object.entries(v)) {
      if (kk === 'label') continue;                   // fusionné à part
      if (vv === '' || vv == null) continue;          // un vide n'écrase pas une valeur connue
      if (kk === 'dateVente' && old.dateVente) continue;   // la date de VENTE ne bouge plus une fois posée
      m[kk] = vv;
    }
    if (v.label) {                                     // enrichit le bordereau champ par champ
      const lm = Object.assign({}, old.label || {});
      for (const [lk, lv] of Object.entries(v.label)) if (lv) lm[lk] = lv;
      m.label = lm;
    }
    m.at = new Date().toISOString();
    ventes[k] = m;
  }
  const noms = Object.keys(ventes);
  if (noms.length > 500) { const g = noms.sort((x, y) => Date.parse((ventes[y] || {}).at || 0) - Date.parse((ventes[x] || {}).at || 0)).slice(0, 500); for (const n of noms) if (!g.includes(n)) delete ventes[n]; }
  const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_ventes', data: { ventes, updatedAt: new Date().toISOString() } }], 'id');
  noterFlux('leboncoin', _okFlux !== false);
}
// ══════════════════════════════════════════════════════════════════════════════
// LE CATALOGUE LEBONCOIN — SES CODES EXACTS DE CATÉGORIE, MARQUE, TAILLE, ÉTAT
// ══════════════════════════════════════════════════════════════════════════════
// Julien demande « le titre, la description, les catégories au bon endroit, le
// prix — tout paramétré pour l'annonce ». Mettre une catégorie au bon endroit
// suppose de connaître le CODE que Leboncoin attend, pas son libellé : son
// formulaire ne prend pas « Chaussures », il prend une valeur (`{value,label}`).
//
// ⚠️ MESURÉ LE 17 SEPTEMBRE, et c'est ce qui bloquait. Ces codes passent par
//    DEUX endpoints, tous deux VUS dans son navigateur (`lbc_recon.paths`) :
//      · `api/frontend/v1/data/v7/fdata`  — le dictionnaire des attributs
//        (mesuré : `features.accessories_brand.values.simpleData[{value,label}]`) ;
//      · `api/frontend/v1/data/v5/fforms` — les formulaires par catégorie.
//    Or `fdata` n'arrivait ici que **coupé à 9 000 caractères**, et `fforms`
//    n'a JAMAIS eu d'échantillon : les six places de `lbc_recon.samples` étaient
//    prises en ordre d'arrivée, et la moitié par des enchères PUBLICITAIRES
//    (`nexx360`, `adnxs`, `pubmatic` — mesuré, 3 sur 6) qui ne sont même pas
//    Leboncoin. Le bruit évinçait la seule chose qui sert.
//
// ⇒ Le catalogue a sa PROPRE ligne (`lbc_catalogue`), une place par endpoint :
//   rien ne peut plus l'évincer, et il ne pèse pas sur `lbc_recon` que le
//   panneau relit (§4.4). On le garde ENTIER dans la limite ci-dessous, et
//   **on dit s'il a été coupé** — la moitié d'un catalogue a l'air d'un
//   catalogue, et l'analyser en croyant l'avoir en entier serait promettre ce
//   qu'on n'a pas mesuré.
// ⚠️ ON N'ANALYSE RIEN ICI. Je n'ai vu que 9 000 caractères de `fdata` et zéro
//    de `fforms` : écrire l'analyseur aujourd'hui serait deviner. On collecte,
//    la prochaine passe branche — même méthode que `panel_ebay_form`.
// ⚠️ MESURÉ LE 17 SEPTEMBRE, sur sa vraie base : `fdata` est arrivé **coupé à
//    400 000** — le catalogue est donc plus gros que ça. On monte le plafond ;
//    la ligne n'est réécrite que si le corps CHANGE, donc ça ne coûte qu'une
//    fois. Et le drapeau `coupe` reste : on saura si ça ne suffit toujours pas.
const EXT_VERSION = (() => { try { return (chrome.runtime.getManifest() || {}).version || ''; } catch (_) { return ''; } })();
const LBC_CATALOGUE_MAX = 3000000;
async function storeLbcCatalogue(url, body, coupe) {
  try {
    const cle = String(url || '').replace(/^https?:\/\//, '').split('?')[0].replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80);
    if (!cle) return;
    const prevRows = await sbGet('app_data?id=eq.lbc_catalogue&select=data');
    if (prevRows === null) return;                 // pas su ≠ vide (voir storeLbcListings)
    const prev = (prevRows[0] && prevRows[0].data) || {};
    const next = Object.assign({}, prev);
    const dejala = next[cle];
    // Rien de neuf → on n'écrit pas : inutile de renvoyer 400 Ko à chaque visite.
    if (dejala && dejala.taille === body.length && dejala.coupe === !!coupe) return;
    next[cle] = { url, at: new Date().toISOString(), taille: body.length, coupe: !!coupe, corps: body };
    next.updatedAt = new Date().toISOString();
    await supabaseUpsert('app_data', [{ id: 'lbc_catalogue', data: next }], 'id');
    await publierPrepLbc();      // l'app doit VOIR ce qui a été capté (§11)
  } catch (_) {}
}
// ══════════════════════════════════════════════════════════════════════════════
// CE QUI EST PRÊT POUR PUBLIER SUR LEBONCOIN — PUBLIÉ, PAS DEVINÉ
// ══════════════════════════════════════════════════════════════════════════════
// L'extension collecte depuis quatre versions (le catalogue des codes, la config
// du formulaire dynamique, la forme de ce qui part, les étapes) — et **l'app
// n'en voyait rien**. Julien ne pouvait donc pas savoir si ça avançait, ni quel
// geste faisait avancer. C'est le motif du tiroir `Nav` (§4.11) : du code qui
// tourne et que personne ne lit.
// ⚠️ §4.4 : `lbc_catalogue` pèse des centaines de Ko et `lbc_recon` 67 Ko —
//    l'app ne doit RIEN en rapatrier. C'est donc l'extension qui PUBLIE un
//    résumé de 1 Ko dans sa propre ligne, et l'app qui CONSOMME (§11, le motif
//    de `vrm_colis_prets`). Un seul propriétaire, aucune divergence possible.
// ⚠️ Et on n'y met que des FAITS : des tailles, des noms d'endpoint, des dates.
//    Aucune promesse — c'est l'app qui dira le geste.
async function publierPrepLbc() {
  try {
    const cat = await sbGet('app_data?id=eq.lbc_catalogue&select=data');
    const rec = await sbGet('app_data?id=eq.lbc_recon&select=data');
    // « Pas su » ne vaut pas « rien » : sans lecture, on ne publie pas — sinon
    // un simple timeout annoncerait « rien n'est capté » et le ferait
    // recommencer un dépôt pour rien.
    if (cat === null || rec === null) return;
    const cd = (cat[0] && cat[0].data) || {};
    const rd = (rec[0] && rec[0].data) || {};
    const morceaux = {};
    for (const k of Object.keys(cd)) {
      if (k === 'updatedAt') continue;
      const v = cd[k] || {};
      const nom = /fdata/.test(k) ? 'codes' : /fforms/.test(k) ? 'formulaires'
        : /dynamic-deposit|config/.test(k) ? 'config' : /adparams|prediction/.test(k) ? 'prerempli'
        : /classifieds|adsubmit/.test(k) ? 'soumission' : /upload.image/.test(k) ? 'photos' : k.slice(-24);
      morceaux[nom] = { taille: v.taille || 0, coupe: !!v.coupe, at: v.at || null };
    }
    const envois = Object.keys(rd.envois || {}).slice(0, 40);
    const etapes = Object.values(rd.etapes || {});
    await supabaseUpsert('app_data', [{ id: 'vrm_lbc_prep', data: {
      morceaux, envois,
      // Une étape « utile » porte au moins une liste ou un champ photo : sans ça
      // c'est l'en-tête du site, et on l'a déjà payé une fois.
      etapes: etapes.length,
      etapesUtiles: etapes.filter((e) => ((e.selects || []).length || (e.fichiers || 0))).length,
      categories: [...new Set(etapes.map((e) => String(e.categorie || '')).filter(Boolean))].slice(0, 10),
      ver: EXT_VERSION, majAt: new Date().toISOString(),
    } }], 'id');
  } catch (_) {}
}

// Extraction GÉNÉRIQUE des annonces depuis une réponse JSON Leboncoin : on cherche
// récursivement les objets qui ressemblent à une annonce (un id + un titre + un
// prix). Marche quel que soit l'endpoint. On garde aussi un échantillon (recon).
// ⚠️ À QUI APPARTIENT LA SESSION ? — la brique de l'écosystème multi-comptes.
// On cherche dans une réponse Leboncoin l'identité du compte CONNECTÉ : un objet
// qui porte un id + un nom ET un marqueur de « c'est MOI » (email, téléphone,
// siren, store_id, is_pro). On reste PRUDENT (§5, mieux vaut un blanc qu'un faux) :
// un acheteur a aussi un id + un pseudo, mais pas ton email/siren — sans marqueur
// personnel (ou sous une clé « user/account/store/me/pro »), on ne prend pas.
// Taguer une annonce du MAUVAIS compte serait pire que ne rien taguer.
// ⚠️⚠️ §5 — L'IDENTITÉ DU COMPTE CONNECTÉ NE SE LIT QUE SUR UN ENDPOINT « MOI ».
//   Mesuré le 20 sept. sur sa base : 8 des 9 comptes captés N'ÉTAIENT PAS les
//   siens (Ethan, Chloé, David, Miguel…), venus de `api/user-card/v2/{id}/infos`,
//   `api/discovery/category/N`, `api/same/v4/search/{id}`, `api/dashboard/v1/
//   search` — des fiches D'AUTRES vendeurs. Elles passaient parce que TOUTE fiche
//   pro publique porte `is_pro`/`store_id` : ce marqueur « c'est moi » n'en est
//   pas un. Le SEUL compte à lui (`SHOPCANCALE`) est venu de
//   `/users/me/linked_accounts`. Taguer une paire du MAUVAIS compte est la faute
//   irréversible (§5) : on n'accepte l'identité QUE d'un endpoint qui décrit
//   l'utilisateur CONNECTÉ, jamais la carte/le feed d'un id précis. Manquer un
//   futur endpoint « moi » ⇒ on ne tague pas (blanc, safe) ; accepter une fiche
//   d'autrui ⇒ on tague faux (perte). L'asymétrie tranche. Même règle des deux
//   côtés (détection ET auto-nettoyage de storeLbcAccount), §11.
const LBC_URL_MOI = /\/(users?|accounts?)\/me(\b|\/|$)|linked_accounts|\/me(\b|\/|$)|mon-compte|\/user\/settings/i;
const LBC_URL_AUTRUI = /user-card|\/discovery\/|\/same\/|\/search(\b|\/|\?)|\/dashboard\//i;
function detectLbcAccount(data, url) {
  let best = null;
  const u = String(url || '');
  // Un compte ne se reconnaît que sur un endpoint « moi » — jamais une fiche
  // d'autrui (voir le bloc ci-dessus). Sinon on ne prend rien.
  if (!LBC_URL_MOI.test(u) || LBC_URL_AUTRUI.test(u)) return null;
  const marqueurMoi = (o) => !!(o.email || o.phone || o.phone_number || o.phoneNumber
    || o.siren || o.siret || o.is_pro != null || o.store_id || o.storeId || o.company_name);
  const walk = (node, depth, key) => {
    if (best || !node || depth > 8 || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1, key); return; }
    const id = node.user_id || node.userId || node.store_id || node.storeId || node.account_id || node.accountId || node.id;
    const name = node.store_name || node.storeName || node.company_name || node.companyName
      || node.pseudo || node.pseudonym || node.name || node.display_name || node.displayName;
    const cleMoi = /^(user|account|store|owner|me|profile|pro|seller|self|current)/i.test(String(key || ''));
    if (id && name && (marqueurMoi(node) || (cleMoi && (node.pseudo || node.pseudonym || node.email)))) {
      const pro = !!(node.siren || node.siret || node.store_id || node.storeId || node.company_name || node.is_pro);
      best = { id: String(id), name: String(name), type: pro ? 'pro' : 'particulier', platform: 'leboncoin', source: String(url || '').slice(0, 120) };
      return;
    }
    for (const k in node) if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1, k);
  };
  try { walk(data, 0, ''); } catch (_) {}
  return best;
}

// Les ids des comptes Leboncoin qui sont À LUI (source = endpoint « moi »).
// Sert à ne ranger, dans le parcours générique, QUE ses annonces — jamais le
// flux « découverte » d'autrui. Une source absente est gardée (on ne perd pas
// un compte au doute) ; une source « autrui » (user-card/discovery/…) est
// exclue. Lecture ratée ⇒ Set vide ⇒ on ne garde que ce qui porte une réf VRM
// (mieux vaut un blanc qu'un faux : ne pas ranger 183 annonces d'autrui).
async function comptesMiens() {
  const s = new Set();
  try {
    const rows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
    const accs = (rows && rows[0] && rows[0].data && rows[0].data.accounts) || {};
    for (const id in accs) { const src = accs[id] && accs[id].source; if (!src || (LBC_URL_MOI.test(String(src)) && !LBC_URL_AUTRUI.test(String(src)))) s.add(String(id)); }
  } catch (_) {}
  return s;
}

async function handleLbcRaw(url, body) {
  let data = null;
  try { data = JSON.parse(body); } catch (_) { return; }
  const found = []; const seen = new Set();
  // Qui suis-je ? (pour ne garder que MES annonces dans le parcours générique)
  const miens = await comptesMiens();
  // Le compte connecté (id + nom + pro/particulier), s'il transparaît ici.
  const acct = detectLbcAccount(data, url);
  if (acct) await storeLbcAccount(acct);

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
        ref: refVRMDe(custom) || (title.match(RE_VRM) ? cleNum(title.match(RE_VRM)[1]) : '') || null,
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
        // ⚠️ CE TABLEAU DE BORD est le SIEN : ses annonces appartiennent au
        //    compte connecté. On les tague pour relier chaque paire à SON compte
        //    Leboncoin (il en aura plusieurs) — sans compte détecté, on laisse
        //    vide (mieux vaut un blanc qu'un faux, §5).
        account: acct ? acct.id : null,
        accountName: acct ? acct.name : null,
        accountType: acct ? acct.type : null,
        platform: 'leboncoin',
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
        const refVRM = refFromVRM(bodyTxt) || refFromVRM(title) || null;
        // ⚠️⚠️ ON NE RANGE QUE SES ANNONCES (§5). Une réponse générique
        //    (`dashboard/v1/search`, `discovery/…`) MÊLE ses annonces au flux
        //    « découverte » d'autrui — mesuré le 20 sept. : 183 annonces rangées,
        //    la quasi-totalité d'AUTRES vendeurs (ted, Gabriel, Coccinelle…).
        //    Une annonce est à lui si elle porte notre réf VRM, OU si son owner
        //    est un de SES comptes (source « moi »). Sinon on l'IGNORE — jamais
        //    « caché », juste pas rangé (élargir une lecture sans l'attribuer,
        //    c'est inventer des données). `miens` vide ⇒ seule la réf VRM garde.
        const ownerId = String((node.owner && (node.owner.user_id || node.owner.store_id)) || node.user_id || node.store_id || '');
        if (refVRM || (ownerId && miens.has(ownerId))) found.push({
          id: sid, subject: String(title), price,
          body: bodyTxt.slice(0, 400),
          ref: refVRM,
          url: node.url || '',
          images: (node.images && (node.images.urls || node.images.thumb_urls || node.images.urls_thumb)) || node.image_urls || [],
          category: node.category_name || node.category_id || '',
          status: node.status || node.ad_status || '',
          // ⚠️ Le propriétaire de CETTE annonce (une réponse générique mêle ses
          //    annonces et le flux « découverte » d'autrui) : on prend l'owner
          //    porté par l'annonce ELLE-MÊME, jamais le compte de session (qui,
          //    ici, ne prouverait pas que le chalet d'à côté est à lui, §5).
          account: String((node.owner && (node.owner.user_id || node.owner.store_id)) || node.user_id || node.store_id || '') || null,
          accountName: String((node.owner && (node.owner.name || node.owner.pseudo)) || node.owner_name || '') || null,
          platform: 'leboncoin',
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
// Télécharge les photos d'une paire en FICHIERS (fini les onglets). Rangées dans
// un sous-dossier VRM-{N°} pour les retrouver et les glisser dans Leboncoin.
// ⚠️⚠️ LE MUR DES PHOTOS N'EXISTE PAS — CE QUE J'AVAIS ÉCRIT ÉTAIT FAUX.
// Le dossier affirmait : « les photos ne peuvent pas être injectées (un
// navigateur interdit de remplir un champ fichier par programme) ». **Mesuré le
// 13 septembre dans Chromium** : ce qui est interdit, c'est d'écrire
// `input.value = '/chemin/photo.jpg'`. En revanche `input.files =
// dataTransfer.files` MARCHE — la page reçoit un vrai `File` (nom, taille,
// type), l'événement `change` part, et le glisser-déposer synthétique marche
// aussi. Julien : « ça me fait télécharger des photos dans mon ordi » — il
// n'avait pas à les télécharger du tout.
// ⇒ Le fond récupère les OCTETS (il a les permissions d'hôte ; le CDN de Vinted
//   ne renvoie aucun en-tête CORS, donc la page seule ne peut pas les lire) et
//   les passe au panneau, qui les attache. Rien ne touche son disque.
async function photosEnOctets(urls, max) {
  const out = [];
  for (const u of (urls || []).slice(0, max || 12)) {
    try {
      const r = await fetch(String(u));
      if (!r.ok) { out.push({ url: u, erreur: 'http ' + r.status }); continue; }
      const buf = new Uint8Array(await r.arrayBuffer());
      if (!buf.length) { out.push({ url: u, erreur: 'vide' }); continue; }
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      const type = r.headers.get('content-type') || 'image/jpeg';
      out.push({ url: u, b64: btoa(bin), type: type.split(';')[0].trim(), taille: buf.length });
    } catch (e) { out.push({ url: u, erreur: String((e && e.message) || e).slice(0, 60) }); }
  }
  return out;
}

// ⚠️ UNE FONCTION NOMMÉE, EXPRÈS : c'est elle que l'app DATE dans
//    `EXT_CAPACITES.photosebay`. Les photos s'attachent côté Leboncoin depuis la
//    5.58 et côté eBay depuis la 5.59 — deux dates, donc deux seuils, sinon l'app
//    promet à une 5.58 que ses annonces eBay partent avec leurs photos (le défaut
//    le plus coûteux du projet) ou réclame une mise à jour qui ne change rien
//    (son miroir, aussi interdit). Une ligne de pont ne se date pas ; une
//    fonction, oui.
async function photosPourEbay(urls, max) { return await photosEnOctets(urls, max); }

async function readPostedData() {
  const rows = await sbGet('app_data?id=eq.vinted_lbc_posted&select=data');
  const d = (rows && rows[0] && rows[0].data) || {};
  // ⚠️ Trois ÉCRIVAINS passent par ici (marquer, démarquer, poser la limite) et
  //    réécrivent la ligne entière. Une lecture ratée leur ferait repartir d'une
  //    liste vide : toutes les annonces déjà publiées sur Leboncoin seraient
  //    « à publier » de nouveau. `echec` le dit ; eux s'abstiennent.
  return { echec: rows === null, ids: (d.ids || []).map(String), limit: d.limit != null ? d.limit : null, plan: d.plan || null };
}
async function readPostedIds() { return new Set((await readPostedData()).ids); }
async function writePosted(d) {
  await supabaseUpsert('app_data', [{ id: 'vinted_lbc_posted', data: { ids: d.ids, limit: d.limit != null ? d.limit : null, plan: d.plan || null, updatedAt: new Date().toISOString() } }], 'id');
}
async function markLbcPosted(id) {
  const d = await readPostedData(); if (d.echec) return false; const s = new Set(d.ids); s.add(String(id));
  await writePosted({ ids: [...s], limit: d.limit, plan: d.plan });
}
async function unmarkLbcPosted(id) {
  const d = await readPostedData(); if (d.echec) return false; const s = new Set(d.ids); s.delete(String(id));
  await writePosted({ ids: [...s], limit: d.limit, plan: d.plan });
}
async function setLbcLimit(limit, plan) {
  const d = await readPostedData();
  if (d.echec) return false;
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
