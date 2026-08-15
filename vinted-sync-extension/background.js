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
  return { ok: true, connecte: !!vivant, expiree: !vivant, email: s.email || '', cloisonne: cl };
}

async function authLogout() { await saveSession(null); return { ok: true }; }
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
// ⚠️ POURQUOI CE COMPTEUR EXISTE. Vérifié en base : `harvest_*_item_*` = ZÉRO
// ligne, alors que `/api/v2/items/{id}` apparaît bien dans les chemins vus et que
// tout le code de capture est en place. Donc l'appel part et rien n'arrive : il y
// a une fuite quelque part entre inject.js et l'écriture. Trois sorties muettes
// sur ce chemin (pas de compte actif, corps non-JSON, type inconnu) — impossible
// de savoir laquelle sans mesurer. Ce compteur note CHAQUE passage et CHAQUE
// abandon, par type. Aucune donnée personnelle : des nombres.
// Conséquence concrète : sans fiche article, pas de description → « Republier »
// obligerait à tout retaper. C'est le vrai blocage de cette fonction.
const _diag = { n: {}, dernier: 0 };
async function noterDiag(cle) {
  try {
    _diag.n[cle] = (_diag.n[cle] || 0) + 1;
    // On n'écrit qu'une fois par minute (le compteur vit en mémoire entre-temps).
    if (Date.now() - _diag.dernier < 60000) return;
    _diag.dernier = Date.now();
    const rows = await sbGet('app_data?id=eq.panel_diag_capture&select=data');
    const cur = (rows && rows[0] && rows[0].data && rows[0].data.n) || {};
    const n = { ...cur };
    for (const k in _diag.n) n[k] = (n[k] || 0) + _diag.n[k];
    _diag.n = {};
    await supabaseUpsert('app_data', [{ id: 'panel_diag_capture', data: { n, majAt: new Date().toISOString() } }], 'id');
  } catch (_) {}
}

// Le dressing qui arrive est-il au moins aussi riche que celui déjà en base ?
// Lecture ULTRA légère : on ne relit que le compteur `nItems` (un scalaire),
// jamais le payload — la leçon d'égress de §34 vaut aussi ici.
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

async function storeHarvest(domain, type, id, body) {
  noterDiag(`recu_${type || 'inconnu'}`);
  const uid = await activeAccountId(domain);
  if (!uid) { noterDiag(`abandon_sans_compte_${type || 'inconnu'}`); return; }
  let parsed = null;
  try { parsed = JSON.parse(body); } catch (_) { noterDiag(`abandon_json_${type || 'inconnu'}`); return; }

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
  if (type === 'listings' && !(await dressingPlusRiche(rowId, parsed))) {
    noterDiag('ignore_dressing_partiel');
    return;
  }
  // ⚠️ MÊME PIÈGE QUE LE DRESSING, SUR LE PORTE-MONNAIE. Le motif « billing » de
  // `inject.js` attrape aussi des réponses de tarification : l'une d'elles
  // (`minimum_price`) avait REMPLACÉ le vrai solde d'un compte — il n'y a qu'une
  // ligne `harvest_{uid}_billing`, donc la dernière réponse gagne. On n'écrit
  // que ce qui porte vraiment un montant de porte-monnaie.
  if (type === 'billing' && !estPorteMonnaie(parsed)) { noterDiag('ignore_billing_hors_sujet'); return; }
  const data = { type, uid, domain, capturedAt: new Date().toISOString(), payload: parsed };
  if (type === 'listings') data.nItems = ((parsed && parsed.items) || []).length;
  data.resume = resumeCommandes(type, parsed) || undefined;   // même règle que la voie active
  const ecrit = await supabaseUpsert('app_data', [{ id: rowId, data }], 'id');
  // Dernière sortie muette possible : l'écriture elle-même. On la mesure aussi,
  // sinon « rien en base » resterait indiscernable de « jamais reçu ».
  noterDiag(`${ecrit === false ? 'ecriture_ratee' : 'ecrit'}_${type || 'inconnu'}`);

  // Apprentissage passif des codes de statut d'offre (voir noterStatutsOffres).
  if (type === 'conversation') { try { await noterStatutsOffres(parsed); } catch (_) {} }

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
    try { await archiverLot(uid, ((brut && brut.items) || []).filter(it => it && !it.is_closed && !it.is_hidden && !it.is_draft)); } catch (_) {}
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
          // « Tout recapter » : relit le dressing COMPLET (toutes les pages),
          // les ventes, les achats et la boîte, pour le SEUL compte connecté
          // dans ce navigateur. Depuis sa session, sur son IP — jamais tous
          // les comptes d'un coup (c'est la signature multi-comptes, §5).
          if (msg.action === 'recapter') {
            const ok = await activeFetchActiveAccount();
            sendResponse(ok ? { ok: true } : { ok: false, error: "aucun compte Vinted connecté dans ce navigateur — ouvre vinted.fr et connecte-toi" });
            return;
          }
          if (msg.action === 'saveDate' && msg.id && msg.ts) { await saveListingDate(msg.id, msg.ts, msg.text); sendResponse({ ok: true }); return; }
          if (msg.action === 'saveDetail' && msg.id && msg.detail) { await saveItemDetail(msg.id, msg.detail); sendResponse({ ok: true }); return; }
          if (msg.action === 'aiReply') { const r = await aiReply(msg.message, msg.article, msg.price); sendResponse(r); return; }
          if (msg.action === 'convLastMessage') { const r = await convLastMessage(msg.convId); sendResponse(r); return; }
          if (msg.action === 'markBordDone' && msg.key) { const ok = await markBordDone(msg.key, msg.done); sendResponse({ ok }); return; }
          if (msg.action === 'bordPdf' && msg.row) { const r = await bordPdf(msg.row); sendResponse(r); return; }
          if (msg.action === 'setMinPrice' && msg.id) { const ok = await setMinPrice(msg.id, msg.amount); sendResponse({ ok }); return; }
          // Une offre, sur TON clic uniquement (jamais en arrière-plan).
          if (msg.action === 'offre') { const r = await repondreOffre(msg); sendResponse(r); return; }
          // Générer un bordereau (formalité obligatoire, aucun argent engagé).
          // ⚠️ UN CLIC = UN BORDEREAU, volontairement. Une version « générer mes
          //    25 sélectionnés » a été écrite puis retirée : 25 PUT enchaînés
          //    depuis un seul clic, c'est la rafale qu'on refuse partout ailleurs
          //    (§32/§43). Ici chaque requête correspond à un geste réel.
          if (msg.action === 'genererBord') { const r = await genererBordereau(msg.uid, msg.tx); sendResponse(r); return; }
          // Lire la fiche d'une de TES annonces (description, catégorie) pour
          // pouvoir la republier sans tout retaper. Lecture seule.
          if (msg.action === 'capterAnnonce') { const r = await capterAnnonce(msg.uid, msg.itemId); sendResponse(r); return; }
          // Tu viens de republier une paire : on retient son N° pour le
          // retrouver sur la nouvelle annonce (cf. marquerRepublie).
          if (msg.action === 'repubMarque') { const ok = await marquerRepublie(msg.id, msg.numero, msg.title); sendResponse({ ok }); return; }
          if (msg.action === 'photoBytes') { const r = await photoBytes(msg.url); sendResponse(r); return; }
          // Ce que Vinted peut voir de TOI, rendu visible pour que tu le pilotes.
          if (msg.action === 'empreinte') { const r = await empreinte(); sendResponse({ ok: true, ...r }); return; }
          // Gabarit de description (ce que les autres extensions appellent
          // « template ») : ton texte type, avec des variables remplies depuis
          // les vraies caractéristiques de la paire. Aucune requête Vinted.
          if (msg.action === 'gabarit') {
            if (msg.set != null) {
              await supabaseUpsert('app_data', [{ id: 'panel_gabarit', data: { texte: String(msg.set).slice(0, 4000), majAt: new Date().toISOString() } }], 'id');
              sendResponse({ ok: true });
              return;
            }
            const rows = await sbGet('app_data?id=eq.panel_gabarit&select=data');
            sendResponse({ ok: true, texte: (rows && rows[0] && rows[0].data && rows[0].data.texte) || '' });
            return;
          }
          // Sauvegarde de tes numéros (et du garage) : lecture seule de `main`.
          // Si un jour la ligne cloud est perdue, c'est ce fichier qui te sauve —
          // le numéro est ce qu'il y a d'écrit sur la boîte, ça ne se recalcule pas.
          if (msg.action === 'sauvegardeNumeros') {
            const rows = await sbGet('app_data?id=eq.main&select=data');
            const d = (rows && rows[0] && rows[0].data) || {};
            sendResponse({ ok: true, data: {
              exporteLe: new Date().toISOString(),
              vinted_annonce_numeros: d.vinted_annonce_numeros || {},
              vinted_buyprice_by_num: d.vinted_buyprice_by_num || {},
              vinted_garage_grid: d.vinted_garage_grid || null,
            } });
            return;
          }
          if (msg.action === 'achatsPour') { const items = await achatsPour(msg.title, msg.price); sendResponse({ ok: true, items }); return; }
          if (msg.action === 'setBuyPrice') { const ok = await setBuyPrice(msg.itemId, msg.prix, msg.tx, msg.titre); sendResponse({ ok }); return; }
          // LE COFFRE : tout ce qui est enregistré, texte + liens des photos.
          if (msg.action === 'coffre') {
            const rows = await sbGet('app_data?id=like.coffre_*&select=id,data') || [];
            const items = rows.map(r => r && r.data).filter(d => d && d.id)
              .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
            sendResponse({ ok: true, items });
            return;
          }
          if (msg.action === 'setAccountOff' && msg.uid) { const ok = await setAccountOff(msg.uid, !!msg.off); sendResponse({ ok }); return; }
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
    const cur = (rows && rows[0] && rows[0].data) || {};
    const next = { ...(cur.statuts || {}), ...vus };
    // Rien de nouveau → on n'écrit pas (inutile de repousser la même ligne).
    if (JSON.stringify(next) === JSON.stringify(cur.statuts || {})) return;
    await supabaseUpsert('app_data', [{ id: 'panel_offer_statuts', data: { statuts: next, majAt: new Date().toISOString() } }], 'id');
  } catch (_) { /* purement diagnostique : ne doit jamais gêner la capture */ }
}

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
const CHAMPS_ARTICLE = ['id','title','price','url','brand','size','brand_title','size_title','status',
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
  // ⚠️ COMBIEN de photos, pas lesquelles. L'allègement (§23) ne garde qu'une
  // photo par annonce — l'app en déduisait « 1 seule photo » pour TOUTES les
  // annonces (mapWardrobeItem comptait it.photos, absent), retirait 15 points
  // à chacune dans la note d'annonce et conseillait « ajoute des photos » à
  // des annonces qui en ont six. Un entier par article coûte trois octets et
  // rend le diagnostic honnête. Les URL, elles, vont au coffre (archiverLot).
  if (Array.isArray(it.photos)) o.nPhotos = it.photos.length;
  else if (o.photo) o.nPhotos = 1;
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
const estPorteMonnaie = (p) => !!(p && ((p.main && p.main.amount != null) || (p.escrow && p.escrow.amount != null) || (p.balance && p.balance.amount != null) || p.main || p.escrow));

const AWAITING_SHIP = (s) => /bordereau\s+envoy[ée]\s+au\s+vendeur/i.test(s || '') || /paiement.*valid/i.test(s || '');
const AT_RELAY = (s) => /d[ée]pos[ée]/i.test(s || '') && /point\s+relais|bureau\s+de\s+poste/i.test(s || '');
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
  payload = alleger(type, payload);
  const maintenant = new Date().toISOString();
  const data = { type, uid, domain: domain || 'www.vinted.fr', capturedAt: maintenant, payload };
  // Même règle que la voie passive : un dressing partiel n'écrase pas un
  // dressing complet. La moisson ACTIVE pagine (fetchAllWardrobe) donc elle
  // passe toujours — mais si un jour une page échoue en cours de route, on ne
  // veut pas que le résultat tronqué remplace la bonne capture.
  if (type === 'listings') {
    data.nItems = ((payload && payload.items) || []).length;
    if (!(await dressingPlusRiche(`harvest_${uid}_listings`, payload))) return;
  }
  data.resume = resumeCommandes(type, payload) || undefined;
  // On ecrit AUSSI updated_at : la table n'a pas de trigger, la colonne gardait
  // donc la date de creation de la ligne et faisait passer une moisson de deux
  // heures pour une moisson de 25 jours. `capturedAt` reste la reference cote
  // app, mais autant que la colonne cesse de mentir aux autres lecteurs.
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_${type}`, data, updated_at: maintenant }], 'id');
  if (type === 'listings') {
    try { await archiverLot(uid, ((brut && brut.items) || []).filter(it => it && !it.is_closed && !it.is_hidden && !it.is_draft)); } catch (_) {}
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
async function runActive() { if (await pageActiveFetch()) return; if (await activeFetchActiveAccount()) return; await activeFetchAll(); }
function fullSync() { captureAllAccounts().then(() => runActive()); }

chrome.runtime.onInstalled.addListener(() => { fullSync(); });
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
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === 'cancale-sync') captureAllAccounts();
    else if (a.name === 'cancale-active') runActive();
    else if (a.name === 'vrm-session') { loadSession().then(s => { if (s) authToken(); }); }
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
// ── LE BORDEREAU, EN VRAI, DEPUIS LE PANNEAU ────────────────────────────────
// Julien : « je ne sais pas trop comment tu comptes me les donner, les
// bordereaux ». Réponse : on va chercher le PDF déjà reçu par email (ligne
// `email_bord_*`) et on le lui rend directement — la version TAMPONNÉE par
// l'app (avec le N° de la paire imprimé dessus) si elle existe, sinon le PDF
// brut de Vinted. Zéro requête vers Vinted, c'est un fichier qu'il a déjà.
async function bordPdf(rowId) {
  const id = String(rowId || '').trim();
  if (!id) return { ok: false };
  try {
    const rows = await sbGet(`app_data?id=eq.${encodeURIComponent(id)}&select=pdfB64:data->>pdfB64,pdfTamponneB64:data->>pdfTamponneB64,filename:data->>filename`);
    const r = rows && rows[0];
    if (!r) return { ok: false };
    const net = (v) => (v && v !== 'None') ? v : null;
    const b64 = net(r.pdfTamponneB64) || net(r.pdfB64);
    if (!b64) return { ok: false, reason: 'no-pdf' };
    return { ok: true, b64, tamponne: !!net(r.pdfTamponneB64), filename: net(r.filename) || 'bordereau.pdf' };
  } catch (_) { return { ok: false }; }
}

// Prix MINIMUM accepté par paire (ligne dédiée `panel_min_prices`, jamais
// `main`). Sert à trancher une offre reçue en un coup d'œil : au-dessus →
// accepte, en dessous → contre-offre proposée. ⚠️ L'extension n'accepte ni ne
// refuse rien à ta place sur Vinted (cf. refus §32) : elle te dit quoi faire.
async function setMinPrice(id, amount) {
  const k = String(id || '').trim();
  if (!k) return false;
  const rows = await sbGet('app_data?id=eq.panel_min_prices&select=data');
  const cur = (rows && rows[0] && rows[0].data) || {};
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) delete cur[k]; else cur[k] = n;
  return await supabaseUpsert('app_data', [{ id: 'panel_min_prices', data: cur }], 'id');
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

// ── CE QUE VINTED PEUT VOIR DE TOI ──────────────────────────────────────────
// Le risque de blocage est invisible, donc impossible à piloter. On le montre.
// Trois signaux, du plus lourd au plus léger — c'est l'ordre dans lequel Vinted
// rapproche des comptes (§5) :
//   1. combien de comptes vivent dans CE navigateur (le facteur décisif : même
//      appareil, même empreinte — aucune automatisation n'y change quoi que ce
//      soit, c'est ce qui a fait tomber `vanessa5723`) ;
//   2. combien de comptes ont reçu une action récemment (basculer d'un compte à
//      l'autre pour agir, c'est le même signal en mouvement) ;
//   3. le rythme d'actions de la dernière heure, par compte.
async function empreinte() {
  const out = { comptes: [], actif: null, actionsHeure: 0, comptesActifs: 0 };
  try {
    out.actif = await compteConnecte('www.vinted.fr');
    const accts = await getStoredAccounts();
    const cur = (await chrome.storage.local.get('vrmActions')).vrmActions || {};
    const ilYaUneHeure = Date.now() - 3600000;
    for (const a of accts) {
      const uid = String(a.vinted_user_id);
      const n = (cur[uid] || []).filter(t => t > ilYaUneHeure).length;
      out.actionsHeure += n;
      if (n > 0) out.comptesActifs += 1;
      out.comptes.push({ uid, login: a.login || '', actif: String(out.actif || '') === uid, actions: n });
    }
    out.comptes.sort((a, b) => (b.actif ? 1 : 0) - (a.actif ? 1 : 0) || b.actions - a.actions);
  } catch (_) {}
  return out;
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

// ── ⚠️ REPUBLIER CASSE LE NUMÉRO DE LA PAIRE ────────────────────────────────
// Effet de bord jamais traité, et il est sérieux. Republier chez Vinted =
// supprimer + recréer → la nouvelle annonce a un **nouvel id**. Or les numéros
// vivent dans `vinted_annonce_numeros`, **indexés par id d'annonce** (§7). Donc
// après une republication :
//   1. le N° reste accroché à une annonce qui n'existe plus ;
//   2. la nouvelle annonce n'a PLUS de numéro ;
//   3. pire — le N° étant « libre » (plus aucune annonce en ligne ne le porte),
//      la numérotation auto peut le **redonner à une autre paire**, alors que la
//      tienne dort toujours dans cette boîte au garage. C'est exactement le
//      « deux paires dans la même boîte » que §19 traite comme dangereux.
// On mémorise donc ce qu'on republie, et on repère la nouvelle annonce ensuite.
// ⚠️ L'extension N'ÉCRIT PAS le numéro elle-même : `vinted_annonce_numeros` vit
// dans la ligne `main`, que le panneau ne doit jamais réécrire (§35). Elle
// signale, tu appliques dans l'app.
async function marquerRepublie(id, numero, title) {
  if (!id) return false;
  const rows = await sbGet('app_data?id=eq.panel_repub_pending&select=data');
  const cur = (rows && rows[0] && rows[0].data && rows[0].data.items) || {};
  const items = { ...cur };
  items[String(id)] = { numero: numero != null ? String(numero) : '', title: String(title || ''), t: Date.now() };
  // On oublie au bout de 30 jours : passé ce délai, la nouvelle annonce a été
  // captée depuis longtemps, ou la paire n'existe plus.
  const limite = Date.now() - 30 * 86400000;
  for (const k in items) if (!items[k] || (items[k].t || 0) < limite) delete items[k];
  return await supabaseUpsert('app_data', [{ id: 'panel_repub_pending', data: { items, majAt: new Date().toISOString() } }], 'id');
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
async function archiverLot(uid, items) {
  if (!items || !items.length) return false;
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
  const out = [];
  for (const it of items.slice(0, 300)) {
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
  if (!out.length) return true;
  return await supabaseUpsert('app_data', out, 'id');
}

// ══════════════════════════════════════════════════════════════════════════════
// LE PRIX D'ACHAT — le trou le plus coûteux des données
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré en base : **0 prix d'achat renseigné sur 177 paires**. Conséquence :
// tout le calcul de bénéfice tourne avec un coût de ZÉRO — marge ~100 %,
// « meilleure marque » sans valeur, rapport comptable qui sous-estime les
// charges. L'app le signale, donc rien n'est faussement affirmé, mais les
// chiffres restent inexploitables.
// Pourquoi il n'est jamais saisi : il fallait retrouver la bonne paire parmi
// ~700 achats listés par date. Ici on renverse le problème — on propose les
// candidats les plus probables pendant qu'il REGARDE l'annonce sur Vinted.
//
// Score (repris de `openPicker` dans l'app, mêmes poids → mêmes suggestions) :
//   titre identique +6 · même marque +4 · même taille +4 · payé moins cher +1
//   à score égal, le plus récent d'abord.
// ⚠️ On ne devine JAMAIS tout seul : on propose, il tape. Un mauvais prix
//    d'achat fausse la compta plus sûrement qu'une case vide.
const motsClés = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9À-ÿ ]/gi, ' ').split(/\s+/).filter(w => w.length > 2);
function extraireTaille(t) {
  const m = /\b(\d{2}(?:[.,]5)?)\b/.exec(String(t || ''));
  return m ? m[1].replace(',', '.') : '';
}
async function achatsPour(titre, prixVente) {
  const out = [];
  try {
    const rows = (await sbGet('app_data?id=like.harvest_*_orders_purchased*&select=id,data') || []);
    const vus = new Set();
    const tNorm = String(titre || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const marqueRef = motsClés(titre)[0] || '';
    const tailleRef = extraireTaille(titre);
    const pv = Number(prixVente);
    for (const r of rows) {
      for (const o of (((r.data || {}).payload || {}).my_orders || [])) {
        const tx = String(o.transaction_id || '');
        if (tx && vus.has(tx)) continue; if (tx) vus.add(tx);
        const t = String(o.title || '');
        if (!t) continue;
        if (/annul|cancel|refus|rembours/i.test(String(o.status || ''))) continue;
        const prix = Number((o.price && (o.price.amount != null ? o.price.amount : o.price)) ?? NaN);
        let s = 0;
        if (t.toLowerCase().replace(/\s+/g, ' ').trim() === tNorm) s += 6;
        const mots = motsClés(t);
        if (marqueRef && mots.includes(marqueRef)) s += 4;
        const taille = extraireTaille(t);
        if (tailleRef && taille && taille === tailleRef) s += 4;
        if (isFinite(prix) && isFinite(pv) && prix < pv) s += 1;
        if (s < 4) continue;                       // en dessous, ce n'est plus une suggestion
        const ts = o.date ? Date.parse(o.date) : 0;
        out.push({ tx, title: t, prix: isFinite(prix) ? prix : null, ts: isNaN(ts) ? 0 : ts, score: s,
                   photo: (o.photo && (o.photo.url || o.photo)) || null });
      }
    }
  } catch (_) { return []; }
  return out.sort((a, b) => (b.score - a.score) || (b.ts - a.ts)).slice(0, 6);
}

// Le prix d'achat choisi va dans une ligne DÉDIÉE : l'extension n'écrit jamais
// `main` (§35), c'est l'app qui le reportera sur la paire.
async function setBuyPrice(itemId, prix, tx, titre) {
  const k = String(itemId || '').trim();
  if (!k) return false;
  const rows = await sbGet('app_data?id=eq.panel_buyprices&select=data');
  const cur = (rows && rows[0] && rows[0].data && rows[0].data.items) || {};
  const items = { ...cur };
  const n = Number(String(prix).replace(',', '.'));
  if (!isFinite(n) || n < 0) delete items[k];
  else items[k] = { price: n, tx: tx ? String(tx) : '', title: String(titre || ''), t: Date.now() };
  return await supabaseUpsert('app_data', [{ id: 'panel_buyprices', data: { items, majAt: new Date().toISOString() } }], 'id');
}

// Rapatrie une photo (CDN Vinted) en data: URL.
// ⚠️ POURQUOI PAR LE BACKGROUND : dans une page, une image du CDN chargée dans
// un <canvas> le rend « tainted » (cross-origin) et l'export devient interdit —
// on ne pourrait ni recadrer ni enregistrer. Le service worker, lui, a les
// permissions d'hôte : il récupère les octets, et une data: URL se recadre sans
// aucune restriction.
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

// ── CAPTER LA FICHE D'UNE ANNONCE (pour pouvoir la republier) ───────────────
// Sans la fiche, on n'a QUE le titre, le prix et la photo : pas la description,
// pas la catégorie, pas les attributs. Or republier chez Vinted, c'est supprimer
// puis RECRÉER — donc tout refournir. Sans description, « Republier » revient à
// tout retaper à la main : la fonction ne peut pas être bonne.
// La capture passive devrait s'en charger, mais elle ne range rien (0 ligne en
// base, cf. `noterDiag`). En attendant de trouver la fuite, ce bouton va la
// chercher franchement, pour UNE annonce, quand tu la regardes.
// C'est une LECTURE de ta propre annonce, sur ton clic. Rien n'est modifié.
async function capterAnnonce(uid, itemId) {
  if (!itemId) return { ok: false, error: 'annonce inconnue' };
  const accts = await getStoredAccounts();
  let acc = accts.find(a => String(a.vinted_user_id) === String(uid));
  if (!acc) acc = accts[0];
  if (!acc) return { ok: false, error: 'aucun compte lié' };
  const stop = await garde(acc.vinted_user_id, acc); if (stop) return stop;   // anti-blocage
  // vintedGet renvoie { status, ok, json }.
  const r = await vintedGet(acc, `/api/v2/items/${itemId}`);
  if (!r || !r.ok || !r.json) return { ok: false, error: `Vinted a répondu ${r ? r.status : '—'}` };
  try {
    await storeHarvest(acc.domain || 'www.vinted.fr', 'item', String(itemId), JSON.stringify(r.json));
  } catch (e) { return { ok: false, error: String(e).slice(0, 80) }; }
  logActivity('📝 Fiche annonce captée (description)');
  return { ok: true };
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
async function adresseVendeur(uid) {
  try {
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_wreq_api_v2_transactions_id_shipment_order&select=data`);
    const body = rows && rows[0] && rows[0].data && rows[0].data.body;
    if (!body) return null;
    const j = typeof body === 'string' ? JSON.parse(body) : body;
    const id = j && j.seller_address_id;
    return id != null ? id : null;
  } catch (_) { return null; }
}

async function genererBordereau(uid, tx) {
  if (!uid || !tx) return { ok: false, error: 'vente incomplète' };
  const adr = await adresseVendeur(uid);
  if (adr == null) return { ok: false, error: "adresse d'envoi inconnue pour ce compte — génère-en un à la main une fois, l'extension la retiendra" };
  const accts = await getStoredAccounts();
  const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
  if (!acc) return { ok: false, error: 'compte introuvable' };
  const stop = await garde(uid, acc); if (stop) return stop;   // anti-blocage
  const r = await vintedSend(acc, 'PUT', `/api/v2/transactions/${tx}/shipment/order`,
    { seller_address_id: adr, drop_off_type: null, label_type: null });
  logActivity(r.ok ? '📄 Bordereau généré' : `⚠️ Bordereau : Vinted a refusé (${r.status})`);
  return { ok: !!r.ok, status: r.status, error: r.ok ? '' : ((r.json && (r.json.message || r.json.error)) || `erreur ${r.status}`) };
}

// Couper / réafficher un compte Vinted DEPUIS LE PANNEAU. Ligne DÉDIÉE
// `panel_accounts_off` = { uid: true } — jamais `main` (un upsert y écraserait
// tout le blob de l'app). `buildPanelData` la relit : le compte disparaît de
// TOUTES les vues (annonces, ventes, achats, messages, litiges) tout de suite.
async function setAccountOff(uid, off) {
  const k = String(uid || '').trim();
  if (!k) return false;
  const rows = await sbGet('app_data?id=eq.panel_accounts_off&select=data');
  const cur = (rows && rows[0] && rows[0].data) || {};
  // `false` est ENREGISTRÉ (et non effacé) : c'est ce qui permet de rallumer
  // un compte masqué par l'app, que le panneau n'a pas le droit de modifier.
  cur[k] = !!off ? true : false;
  return await supabaseUpsert('app_data', [{ id: 'panel_accounts_off', data: cur }], 'id');
}

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
  // Titre normalisé : sert au rapprochement par titre EXACT (jamais approximatif).
  const normT = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // ── COMPTES : une seule règle d'exclusion, et tu peux couper un compte ICI ───
  // Trois sources réunies dans `acctOff` :
  //   • l'app (ligne main) : `vinted_accounts_hidden` + `vinted_accounts_blocked` ;
  //   • les comptes supprimés définitivement (`vrm_blocked_accounts`) ;
  //   • le panneau lui-même (`panel_accounts_off`, ligne DÉDIÉE) — pour couper un
  //     compte depuis l'extension sans rouvrir l'app (demande de Julien : un
  //     compte retiré continuait d'afficher ses paires).
  const hiddenAcc = new Set([
    ...(Array.isArray(d.vinted_accounts_hidden) ? d.vinted_accounts_hidden : []),
    ...(Array.isArray(d.vinted_accounts_blocked) ? d.vinted_accounts_blocked : []),
  ].map(String));
  let blockedAcc = new Set(); try { blockedAcc = await blockedAccounts(); } catch (_) {}
  const offRows = await sbGet('app_data?id=eq.panel_accounts_off&select=data');
  const offMap = (offRows && offRows[0] && offRows[0].data) || {};
  const offPanel = new Set(Object.keys(offMap).filter(k => offMap[k] === true));
  // ⚠️ « ↺ Réafficher » NE MARCHAIT PAS pour un compte masqué depuis l'APP.
  // `setAccountOff(uid,false)` se contentait d'effacer la clé de CETTE ligne,
  // or `acctOff` réunit quatre sources : le compte restait masqué par
  // `vinted_accounts_hidden` (ligne `main`, écrite par l'app) et le bouton
  // paraissait mort. C'est exactement ce que Julien a vu : « tous les autres
  // comptes sont marqués masqués » sans moyen de les rallumer depuis Chrome.
  // La ligne dédiée porte donc trois états : `true` = masqué par le panneau,
  // `false` = RALLUMÉ EXPLICITEMENT (ça prime sur l'app), absent = on suit
  // l'app. Le panneau ne réécrit toujours JAMAIS la ligne `main` (§35).
  const forceOn = new Set(Object.keys(offMap).filter(k => offMap[k] === false));
  const acctOff = (uid) => {
    const k = String(uid == null ? '' : uid);
    if (!k || forceOn.has(k)) return false;
    return hiddenAcc.has(k) || blockedAcc.has(k) || offPanel.has(k);
  };
  // Pourquoi ce compte est-il masqué ? Sans ça, un compte disparaît sans que
  // rien ne dise d'où vient la décision — et on croit à un bug de capture.
  const acctRaison = (uid) => {
    const k = String(uid == null ? '' : uid);
    if (!k || forceOn.has(k)) return '';
    if (offPanel.has(k)) return 'panneau';
    if (blockedAcc.has(k)) return 'supprime';
    if (hiddenAcc.has(k)) return 'app';
    return '';
  };
  const keepAcc = (r) => !acctOff(r && r.data && r.data.uid);
  // Nom lisible d'un compte : l'étiquette posée dans l'app, sinon le pseudo Vinted.
  const accRows = await sbGet('vinted_accounts?select=vinted_user_id,login') || [];
  const labels = (d.vinted_account_labels && typeof d.vinted_account_labels === 'object') ? d.vinted_account_labels : {};
  const nameByUid = {};
  for (const a of (accRows || [])) { const k = String(a.vinted_user_id || ''); if (k) nameByUid[k] = String(labels[k] || a.login || ('compte ' + k.slice(-4))); }
  const acctName = (uid) => { const k = String(uid == null ? '' : uid); return nameByUid[k] || (k ? 'compte ' + k.slice(-4) : ''); };
  const lstAll = (await sbGet('app_data?id=like.harvest_*_listings&select=id,data') || []);
  const soldAll = (await sbGet('app_data?id=like.harvest_*_orders_sold&select=data') || []);
  // ⚠️ LA PLUS FRAÎCHE CAPTURE GAGNE. Une même vente peut exister dans plusieurs
  // lignes moissonnées (comptes, captures successives). Avant, on gardait la
  // PREMIÈRE rencontrée — donc parfois un statut périmé : une paire déjà expédiée
  // ressortait « à générer ». On trie par date de capture décroissante : le
  // premier vu est le plus récent. On se base sur ce qu'on a capté, pas sur une
  // déduction.
  const parFraicheur = (a, b) => (Date.parse((b.data && b.data.capturedAt) || '') || 0) - (Date.parse((a.data && a.data.capturedAt) || '') || 0);
  const lst = lstAll.filter(keepAcc).sort(parFraicheur);
  const soldRows = soldAll.filter(keepAcc).sort(parFraicheur);
  // Liste des comptes pour le panneau (avec le nb d'annonces en ligne) : tu vois
  // exactement d'où viennent tes paires, et tu peux en couper un d'un clic.
  const accountsSeen = {};
  const noteAcct = (uid, n) => {
    const k = String(uid || ''); if (!k) return;
    if (!accountsSeen[k]) accountsSeen[k] = { uid: k, name: acctName(k), online: 0, off: acctOff(k), raison: acctRaison(k) };
    accountsSeen[k].online += n || 0;
  };
  for (const r of lstAll) {
    const items = (r.data && r.data.payload && r.data.payload.items) || [];
    noteAcct(r.data && r.data.uid, items.filter(it => !it.is_closed && !it.is_hidden && !it.is_draft).length);
  }
  for (const r of soldAll) noteAcct(r.data && r.data.uid, 0);
  const accounts = Object.values(accountsSeen).sort((a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || b.online - a.online);
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
        uid: String((r.data && r.data.uid) || ''), acct: acctName(r.data && r.data.uid),
        id, title: it.title || '', url: it.url || `https://www.vinted.fr/items/${id}`,
        price: (it.price && (it.price.amount != null ? it.price.amount : it.price)) ?? null,
        photo: (it.photo && it.photo.url) || (it.photos && it.photos[0] && it.photos[0].url) || null,
        views: it.view_count != null ? it.view_count : null,
        favs: it.favourite_count != null ? it.favourite_count : null,
        numero, buyPrice: e && e.buyPrice != null ? e.buyPrice : null,
        cell: numero ? (cellByNum[numero] || null) : null,
        ageDays,
        brand: String(it.brand || it.brand_title || (it.brand_dto && it.brand_dto.title) || '').trim(),
        size: String(it.size || it.size_title || '').trim(),
        hasDesc: !!(pageDetails[id] && pageDetails[id].description),
        nPhotos: (pageDetails[id] && (pageDetails[id].photos || []).length) || 0,
        // Combien de photos l'annonce a VRAIMENT sur Vinted (≠ combien on en a
        // gardées) : c'est ce qui permet de dire « 2 sur 6 » au lieu de laisser
        // croire que le coffre est complet.
        nPhotosVinted: Number(it.nPhotos) || (Array.isArray(it.photos) ? it.photos.length : 0) || 0,
      });
    }
  }
  // ── PAIRES VENDUES QUI TRAÎNENT ENCORE EN « EN LIGNE » ──────────────────────
  // Demande de Julien : « une paire vendue, je veux qu'elle soit supprimée
  // totalement de la liste en ligne ». Une moisson un peu datée garde l'annonce
  // avec `is_closed:false` alors que la paire est partie. Deux sources SÛRES :
  //   • la mémoire de l'app (`vinted_annonces_email_sold`, par ID d'annonce) ;
  //   • une vente RÉCENTE (< 60 j) dont le titre est UNIQUE parmi les annonces en
  //     ligne. Un titre en double ne retire jamais rien (§24 : pas de devinette —
  //     sinon on effacerait une paire identique encore réellement en vente).
  const emailSoldIds = new Set((Array.isArray(d.vinted_annonces_email_sold) ? d.vinted_annonces_email_sold : []).map(String));
  const soldRecentTitles = new Set();
  for (const r of soldRows) {
    for (const o of ((r.data && r.data.payload && r.data.payload.my_orders) || [])) {
      if (/annul|cancel|refus|rembours/i.test(o.status || '')) continue;
      const ts = o.date ? Date.parse(o.date) : NaN;
      if (!isNaN(ts) && (Date.now() - ts) / 86400000 > 60) continue;
      const k = normT(o.title); if (k) soldRecentTitles.add(k);
    }
  }
  const onlineTitleN = {};
  for (const o of online) { const k = normT(o.title); if (k) onlineTitleN[k] = (onlineTitleN[k] || 0) + 1; }
  let removedSold = 0;
  for (let i = online.length - 1; i >= 0; i--) {
    const o = online[i]; const k = normT(o.title);
    const vendue = emailSoldIds.has(String(o.id)) || (k && onlineTitleN[k] === 1 && soldRecentTitles.has(k));
    if (vendue) { online.splice(i, 1); removedSold++; }
  }
  // ── PRIX DES PAIRES COMPARABLES (peer price) ────────────────────────────────
  // Même logique que l'app (scoreAnnonce.peerPrice) : la MÉDIANE du prix des
  // annonces EN LIGNE de MÊME marque + MÊME taille (≥2 paires, sinon on ne dit
  // rien). Sert à repérer une paire au-dessus/en-dessous de ton propre marché,
  // pendant que tu la regardes. 0 requête Vinted (calculé sur la moisson).
  const peerGroups = {};
  for (const o of online) {
    const pr = o.price == null ? NaN : Number(o.price);
    if (!o.brand || !o.size || isNaN(pr)) continue;
    const k = (o.brand + '|' + o.size).toLowerCase();
    (peerGroups[k] = peerGroups[k] || []).push(pr);
  }
  const median = (arr) => { const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  for (const o of online) {
    if (!o.brand || !o.size) { o.peer = null; o.peerN = 0; continue; }
    const g = peerGroups[(o.brand + '|' + o.size).toLowerCase()] || [];
    o.peer = g.length >= 2 ? median(g) : null; // ≥2 paires comparables sinon rien
    o.peerN = g.length;
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
  const acctOfRow = (r) => ({ uid: String((r.data && r.data.uid) || ''), acct: acctName(r.data && r.data.uid) });
  // ⚠️ LA PHOTO EST DÉJÀ DANS LA COMMANDE. `commandeMaigre` garde `photo` ({url}),
  // mais on ne la lisait pas → la ligne de vente montrait un pictogramme alors que
  // la vraie photo Vinted était là (plainte de Julien : « je n'ai pas la photo de
  // ma paire »). C'est la source la PLUS sûre : elle vient de la commande
  // elle-même — aucun rapprochement, donc aucun risque d'afficher une autre paire.
  const photoDeCommande = (o) => (o && ((o.photo && (o.photo.url || (typeof o.photo === 'string' ? o.photo : null))) || o.photo_url)) || null;
  const bordRows = await sbGet("app_data?id=like.email_bord_*&select=transaction:data->>transaction") || [];
  const bordTxns = new Set(bordRows.map(b => String(b.transaction || '')).filter(Boolean));
  // ── ÉTAT DU COLIS : la capture la plus précise qu'on ait ────────────────────
  // Le détail de transaction (`harvest_*_txn_*`) porte `shipment.status_title` —
  // c'est Vinted qui le dit, pas une déduction de notre part. Quand ce détail est
  // PLUS RÉCENT que la ligne de commande, il fait foi : une paire dont le colis
  // est parti ne doit plus jamais apparaître « à générer » (plainte de Julien).
  const txnEtat = {};
  try {
    const txnRows = (await sbGet('app_data?id=like.harvest_*_txn_*&select=data') || []).filter(keepAcc);
    for (const r of txnRows) {
      const p = (r.data && r.data.payload) || {};
      const t = p.transaction || p;
      const tx = String((t && t.id) || '');
      if (!tx) continue;
      const sh = (t && t.shipment) || {};
      const st = String(sh.status_title || sh.status || t.status_title || t.status || '');
      const cap = Date.parse((r.data && r.data.capturedAt) || '') || 0;
      if (!st) continue;
      if (!txnEtat[tx] || cap > txnEtat[tx].cap) txnEtat[tx] = { st, cap };
    }
  } catch (_) { /* la forme du détail de transaction peut varier : on ignore */ }
  // « Encore à expédier » = ce que dit la capture LA PLUS RÉCENTE dont on dispose.
  const encoreAExpedier = (tx, statutCommande, capCommande) => {
    const d = tx ? txnEtat[String(tx)] : null;
    if (d && d.cap >= (capCommande || 0)) return awaitingShip(d.st);
    return awaitingShip(statutCommande);
  };
  const toShip = [];
  const seenTx = new Set();
  for (const r of soldRows) {
    const orders = (r.data && r.data.payload && r.data.payload.my_orders) || [];
    const capR = Date.parse((r.data && r.data.capturedAt) || '') || 0;
    for (const o of orders) {
      const tx0 = String(o.transaction_id || '');
      // ⚠️ On saute AUSSI les transactions déjà vues dans une capture plus
      // fraîche : sans ça, une vieille ligne rouvrait une vente déjà traitée.
      if (tx0 && seenTx.has(tx0)) continue;
      if (!encoreAExpedier(tx0, o.status, capR)) { if (tx0) seenTx.add(tx0); continue; }
      const tx = tx0;
      if (tx) seenTx.add(tx);
      toShip.push({
        ...acctOfRow(r), photo: photoDeCommande(o),
        transaction: tx, title: o.title || '', status: o.status || '',
        price: (o.price && (o.price.amount != null ? o.price.amount : o.price)) ?? null,
        conv: o.conversation_id != null ? String(o.conversation_id) : null,
        url: tx ? `https://www.vinted.fr/member/transactions/${tx}` : (o.conversation_id ? `https://www.vinted.fr/inbox/${o.conversation_id}` : 'https://www.vinted.fr/member/transactions?type=sold'),
        hasBord: tx ? bordTxns.has(tx) : false,
      });
    }
  }
  // ── DERNIÈRES VENTES (lecture seule) : mêmes commandes moissonnées que l'app,
  // mêmes règles de statut (classifyOrderStatus). On NE recalcule AUCUN total ici
  // (le CA du mois reste celui publié par l'app, appStats) : c'est juste la liste
  // « qu'est-ce que j'ai vendu récemment » pour éviter de rouvrir l'app. On exclut
  // les annulées/remboursées (ce n'est pas de l'argent qui rentre).
  const classifySale = (st) => /annul|cancel|refus|rembours/i.test(st || '') ? 'cancelled'
    : /finalis/i.test(st || '') ? 'completed' : 'pending';
  const salesFlat = [];
  const seenSaleTx = new Set();
  for (const r of soldRows) {
    const orders = (r.data && r.data.payload && r.data.payload.my_orders) || [];
    const capR = Date.parse((r.data && r.data.capturedAt) || '') || 0;
    for (const o of orders) {
      const tx = String(o.transaction_id || '');
      if (tx && seenSaleTx.has(tx)) continue; if (tx) seenSaleTx.add(tx);
      if (classifySale(o.status) === 'cancelled') continue;
      const ts = o.date ? Date.parse(o.date) : NaN;
      salesFlat.push({
        ...acctOfRow(r), photo: photoDeCommande(o),
        transaction: tx, title: o.title || '', status: o.status || '',
        etat: classifySale(o.status),
        // « à expédier » = Vinted attend encore le colis (même règle que l'app).
        // (capture la plus récente, détail de transaction prioritaire — sinon une
        // paire déjà expédiée ressortait « à générer »)
        aExpedier: encoreAExpedier(tx, o.status, capR),
        price: (o.price && (o.price.amount != null ? o.price.amount : o.price)) ?? null,
        ts: isNaN(ts) ? 0 : ts,
        url: tx ? `https://www.vinted.fr/member/transactions/${tx}` : 'https://www.vinted.fr/member/transactions?type=sold',
      });
    }
  }
  const salesSorted = salesFlat.sort((a, b) => b.ts - a.ts);
  const sales = salesSorted.slice(0, 80);         // liste complète (onglet Ventes)
  const recentSales = salesSorted.slice(0, 6);    // top 6 (Ma journée)
  // ── DERNIERS ACHATS (lecture seule) : mêmes commandes moissonnées `orders_purchased`.
  // On NE relabelle PAS le statut (l'app classe les achats par statut, on ne veut
  // rien inventer) : juste titre + prix + date, exclus les annulés/remboursés.
  const buyRows = (await sbGet('app_data?id=like.harvest_*_orders_purchased&select=data') || []).filter(keepAcc);
  const buysFlat = [];
  const seenBuyTx = new Set();
  for (const r of buyRows) {
    const orders = (r.data && r.data.payload && r.data.payload.my_orders) || [];
    for (const o of orders) {
      const tx = String(o.transaction_id || '');
      if (tx && seenBuyTx.has(tx)) continue; if (tx) seenBuyTx.add(tx);
      if (classifySale(o.status) === 'cancelled') continue;
      const ts = o.date ? Date.parse(o.date) : NaN;
      buysFlat.push({
        ...acctOfRow(r), photo: photoDeCommande(o),
        transaction: tx, title: o.title || '', status: o.status || '',
        price: (o.price && (o.price.amount != null ? o.price.amount : o.price)) ?? null,
        ts: isNaN(ts) ? 0 : ts,
        url: tx ? `https://www.vinted.fr/member/transactions/${tx}` : 'https://www.vinted.fr/member/transactions?type=bought',
      });
    }
  }
  const recentBuys = buysFlat.sort((a, b) => b.ts - a.ts).slice(0, 80);
  // ── LITIGES / PAIRES QUI REVIENNENT (lecture seule) ─────────────────────────
  // Source FIABLE et déjà présente : le STATUT des ventes moissonnées (comme
  // `saleOutcome` de l'app — remboursement / retour / litige / suspension). C'est
  // ce qui indique qu'une paire te revient, sans rien deviner.
  // Enrichissement OPTIONNEL : les vraies réclamations captées passivement
  // (`harvest_*_complaints`) portent parfois un MOTIF ; on l'attache par n° de
  // transaction quand on le retrouve, sinon on n'invente rien.
  const DISPUTE = [
    { re: /rembours/i, kind: 'remboursement', label: '💸 Remboursé' },
    { re: /retour/i, kind: 'retour', label: '📦 Retour initié' },
    { re: /litige|r[ée]clam|dispute|complaint|probl[èe]me|signal/i, kind: 'litige', label: '⚠️ Litige' },
    { re: /suspend/i, kind: 'suspendu', label: '⏸️ Suspendu' },
  ];
  // Motifs de réclamation captés, indexés par n° de transaction (défensif : la
  // forme exacte de l'API complaints n'est pas garantie → on lit large, sans throw).
  const complaintReasons = {};
  try {
    const compRows = await sbGet('app_data?id=like.harvest_*_complaints&select=data') || [];
    const pick = (o, keys) => { for (const k of keys) { if (o && o[k] != null && o[k] !== '') return o[k]; } return null; };
    for (const r of compRows) {
      const pay = (r.data && r.data.payload) || {};
      const arr = pay.complaints || pay.items || pay.entries || (Array.isArray(pay) ? pay : []);
      if (!Array.isArray(arr)) continue;
      for (const c of arr) {
        if (!c || typeof c !== 'object') continue;
        const tx = String(pick(c, ['transaction_id', 'transactionId']) || (c.transaction && c.transaction.id) || (c.order && c.order.id) || '');
        const reason = pick(c, ['reason', 'reason_title', 'title', 'complaint_reason', 'label', 'status_title', 'kind_title']);
        if (tx && reason) complaintReasons[tx] = String(reason).slice(0, 80);
      }
    }
  } catch (_) { /* la forme de l'API complaints peut varier : on ignore proprement */ }
  const disputes = [];
  const seenDispTx = new Set();
  for (const r of soldRows) {
    const orders = (r.data && r.data.payload && r.data.payload.my_orders) || [];
    for (const o of orders) {
      const st = o.status || '';
      const m = DISPUTE.find(d => d.re.test(st));
      if (!m) continue;
      const tx = String(o.transaction_id || '');
      if (tx && seenDispTx.has(tx)) continue; if (tx) seenDispTx.add(tx);
      const ts = o.date ? Date.parse(o.date) : NaN;
      disputes.push({
        ...acctOfRow(r), photo: photoDeCommande(o),
        transaction: tx, title: o.title || '', status: st, kind: m.kind, label: m.label,
        reason: (tx && complaintReasons[tx]) || null,
        price: (o.price && (o.price.amount != null ? o.price.amount : o.price)) ?? null,
        ts: isNaN(ts) ? 0 : ts,
        url: tx ? `https://www.vinted.fr/member/transactions/${tx}` : 'https://www.vinted.fr/member/transactions?type=sold',
      });
    }
  }
  disputes.sort((a, b) => b.ts - a.ts);
  // ── PHOTO + N° DE LA PAIRE sur les lignes ventes/achats/litiges ──────────────
  // Les commandes moissonnées sont allégées (pas de photo). On retrouve la photo
  // et le numéro dans `vinted_annonce_numeros` (gardé même pour les paires
  // vendues) PAR TITRE EXACT, et UNIQUEMENT si le titre est unique — jamais de
  // devinette sur un titre en double (même garde que l'app §7/§24 `titleAmbiguous`).
  // La photo d'une annonce ENCORE en ligne prime (plus fraîche).
  const titleCount = {};
  const numByTitle = {};
  for (const id in numeros) {
    const e = numeros[id]; if (!e) continue;
    const key = normT(e.title); if (!key) continue;
    titleCount[key] = (titleCount[key] || 0) + 1;
    if (!numByTitle[key]) numByTitle[key] = { numero: e.numero != null ? String(e.numero) : null, photo: e.photo || null };
  }
  for (const o of online) {
    const key = normT(o.title); if (!key || (titleCount[key] || 0) !== 1 || !numByTitle[key]) continue;
    if (o.photo) numByTitle[key].photo = o.photo;               // photo fraîche
    if (o.numero != null && numByTitle[key].numero == null) numByTitle[key].numero = String(o.numero);
  }
  const lookupPair = (title) => { const key = normT(title); if (!key || (titleCount[key] || 0) > 1) return null; return numByTitle[key] || null; };
  // Photo par NUMÉRO (identité certaine) — pour les bordereaux, où le rapprochement
  // par titre est INTERDIT (§24 : risque d'envoyer la mauvaise paire). Le N° d'un
  // bordereau vient de l'email/la transaction (certain) ; on l'utilise pour la photo.
  const photoByNum = {};
  for (const id in numeros) { const e = numeros[id]; if (!e || e.numero == null || !e.photo) continue; const k = String(e.numero); if (!photoByNum[k]) photoByNum[k] = e.photo; }
  for (const o of online) { if (o.numero != null && o.photo) photoByNum[String(o.numero)] = o.photo; } // annonce en ligne = photo fraîche
  const enrichPairs = (list) => { for (const o of (list || [])) { if (o.photo && o.numero != null) continue; const m = lookupPair(o.title); if (m) { if (!o.photo && m.photo) o.photo = m.photo; if (o.numero == null && m.numero != null) o.numero = m.numero; } } };
  enrichPairs(sales); enrichPairs(recentSales); enrichPairs(recentBuys); enrichPairs(disputes); enrichPairs(toShip);
  // Compte PRO = il existe une facture (reçue par email) pour cette paire (§41).
  // On marque `pro` sur les ventes dont le N° a une facture → bouton facture au panneau.
  const proNums = new Set((Array.isArray(d.vinted_invoices) ? d.vinted_invoices : []).map(i => String((i && i.productId != null ? i.productId : '')).trim()).filter(Boolean));
  const markPro = (list) => { for (const o of (list || [])) { o.pro = o.numero != null && proNums.has(String(o.numero)); } };
  markPro(sales); markPro(recentSales);
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
  const inboxRows = (await sbGet('app_data?id=like.harvest_*_inbox&select=data') || []).filter(keepAcc);
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
  // ── OFFRES REÇUES : trancher en un coup d'œil ───────────────────────────────
  // Tu poses un PRIX MINIMUM sur une paire ; dès qu'une offre est captée, on te
  // dit « accepte » ou « propose X € ». Source = les conversations DÉJÀ CAPTÉES
  // (`harvest_*_conv_*`, donc celles que tu as ouvertes) : on y lit la dernière
  // demande d'offre et son montant. Si on ne trouve pas de montant, on n'affiche
  // RIEN (jamais de chiffre inventé).
  // ⚠️ RIEN N'EST ENVOYÉ TOUT SEUL. Les boutons Accepter / Contre / Refuser du
  //    panneau partent UNIQUEMENT sur ton clic, un clic = une requête. Pas de
  //    moteur qui décide en arrière-plan : accepter une offre, c'est une vente
  //    ferme qu'on n'annule pas.
  // ── FICHES D'ANNONCE CAPTÉES → la DESCRIPTION, pour republier sans retaper ──
  // Republier chez Vinted = supprimer + recréer (vérifié dans les requêtes
  // captées : `POST /items/{id}/delete` puis `POST /item_upload/items`). Il faut
  // donc refournir tout le texte. On le sert ici quand la fiche a été captée.
  const fiches = {};
  try {
    const fRows = (await sbGet('app_data?id=like.harvest_*_item_*&select=id,data') || [])
      .filter(r => /_item_\d+$/.test(String(r.id || '')));
    for (const r of fRows) {
      const p = (r.data && r.data.payload) || {};
      const it = p.item || p;
      const id = String(it.id || (String(r.id).match(/_item_(\d+)$/) || [])[1] || '');
      if (!id) continue;
      fiches[id] = {
        desc: String(it.description || ''),
        marque: String(it.brand || (it.brand_dto && it.brand_dto.title) || ''),
        taille: String(it.size_title || it.size || ''),
        etat: String(it.status || ''),
        capAt: (r.data && r.data.capturedAt) || null,
      };
    }
  } catch (_) { /* pas de fiche : Republier le dira honnêtement */ }
  for (const o of online) { const f = fiches[String(o.id)]; if (f && f.desc) o.desc = f.desc; }
  // ⚠️ DEUXIÈME SOURCE, celle qui marche vraiment aujourd'hui : la description
  // LUE SUR LA PAGE de l'annonce (`vinted_item_details`, écrite par le panneau
  // quand tu ouvres une de tes annonces). Elle était déjà en base — 20 fiches,
  // dont 15 avec le vrai texte de Julien — mais PERSONNE ne la lisait : seules
  // les fiches d'API (`harvest_*_item_*`, qui ne se rangent quasiment jamais)
  // alimentaient `o.desc`. Résultat : l'étape « Récupérer le texte » de
  // Republier annonçait « pas encore capté » et proposait un appel Vinted alors
  // que le texte était déjà là. On complète, on n'écrase jamais une fiche d'API.
  // Le filtre `PUB_VINTED` écarte les anciennes lignes où `og:description`
  // avait enregistré le texte marketing de Vinted à la place de l'annonce.
  const PUB_VINTED = /une communaut[ée].{0,60}marques|pour chaque achat effectu|thousands of brands|politique de rembours/i;
  for (const o of online) {
    if (o.desc) continue;
    const p = pageDetails[String(o.id)];
    const t = p && String(p.description || '').trim();
    if (t && t.length > 15 && !PUB_VINTED.test(t)) o.desc = t;
  }

  // ── LE N° PERDU APRÈS UNE REPUBLICATION ─────────────────────────────────────
  // Pour chaque paire republiée récemment, on cherche la NOUVELLE annonce et on
  // te propose d'y remettre le numéro. Règles strictes, aucune devinette :
  //   • le numéro ne doit plus être porté par AUCUNE annonce en ligne
  //     (s'il l'est déjà, il a été réattribué : on ne touche à rien) ;
  //   • la nouvelle annonce doit avoir EXACTEMENT le même titre, ce titre doit
  //     être UNIQUE parmi les annonces en ligne, et elle ne doit pas déjà avoir
  //     de numéro (même garde que §24 : un titre en double n'associe jamais rien).
  // ── QUAND TES PAIRES PARTENT-ELLES VRAIMENT ? ───────────────────────────────
  // Le « meilleur moment pour republier » n'est pas un conseil générique trouvé
  // sur un blog : c'est TON histoire. On répartit tes ventes par jour de semaine
  // et par tranche horaire, et on te donne le créneau le plus chargé.
  // ⚠️ On ne l'affiche qu'à partir de 20 ventes datées — en dessous, un « pic »
  //    n'est que du hasard, et un conseil inventé vaut moins que rien.
  let momentVente = null;
  try {
    const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const parJour = [0, 0, 0, 0, 0, 0, 0];
    const parCreneau = { matin: 0, aprem: 0, soir: 0, nuit: 0 };
    let n = 0;
    for (const v of salesFlat) {
      if (!v.ts) continue;
      const d = new Date(v.ts);
      if (isNaN(d.getTime())) continue;
      parJour[d.getDay()] += 1;
      const h = d.getHours();
      parCreneau[h < 6 ? 'nuit' : h < 12 ? 'matin' : h < 18 ? 'aprem' : 'soir'] += 1;
      n += 1;
    }
    if (n >= 20) {
      const iJour = parJour.indexOf(Math.max(...parJour));
      const cle = Object.keys(parCreneau).reduce((a, b) => (parCreneau[b] > parCreneau[a] ? b : a), 'soir');
      const libelle = { matin: 'le matin', aprem: "l'après-midi", soir: 'en soirée', nuit: 'la nuit' }[cle];
      momentVente = { jour: JOURS[iJour], creneau: libelle, nJour: parJour[iJour], nCreneau: parCreneau[cle], total: n };
    }
  } catch (_) { momentVente = null; }

  // ── SANTÉ DE LA CAPTURE, compte par compte ──────────────────────────────────
  // Jusqu'ici, savoir « est-ce que ça capte ? » demandait d'aller lire la base à
  // la main. Ça se voit maintenant dans le panneau : par compte, la date de la
  // dernière moisson de chaque type. Un compte muet (session expirée) saute aux
  // yeux au lieu de se traduire par des écrans vides inexpliqués.
  const sante = [];
  try {
    const age = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? null : t; };
    const parUid = {};
    const noter = (rows, cle) => {
      for (const r of (rows || [])) {
        const uid = String((r.data && r.data.uid) || '');
        if (!uid) continue;
        (parUid[uid] = parUid[uid] || {})[cle] = age(r.data && r.data.capturedAt);
      }
    };
    noter(lst, 'annonces'); noter(soldRows, 'ventes'); noter(buyRows, 'achats'); noter(inboxRows, 'messages');
    for (const a of accounts) {
      const p = parUid[String(a.uid)] || {};
      sante.push({ uid: a.uid, name: a.name, off: a.off, online: a.online,
                   annonces: p.annonces || null, ventes: p.ventes || null,
                   achats: p.achats || null, messages: p.messages || null });
    }
  } catch (_) { /* diagnostic : ne doit jamais gêner le reste */ }

  // Quel compte est RÉELLEMENT connecté dans ce navigateur ? Le panneau s'en
  // sert pour ne PAS proposer d'agir au nom d'un autre compte (voir `garde`).
  let compteActif = null;
  try { compteActif = await compteConnecte('www.vinted.fr'); } catch (_) {}

  const renumSuggest = [];
  try {
    const pRows = await sbGet('app_data?id=eq.panel_repub_pending&select=data');
    const pend = (pRows && pRows[0] && pRows[0].data && pRows[0].data.items) || {};
    const numsEnLigne = new Set(online.map(o => String(o.numero || '')).filter(Boolean));
    for (const ancienId in pend) {
      const p = pend[ancienId] || {};
      if (!p.numero) continue;
      if (numsEnLigne.has(String(p.numero))) continue;      // déjà repris ailleurs
      const k = normT(p.title);
      if (!k || onlineTitleN[k] !== 1) continue;            // titre absent ou ambigu
      const cible = online.find(o => normT(o.title) === k && !o.numero && String(o.id) !== String(ancienId));
      if (!cible) continue;
      renumSuggest.push({ ancienId: String(ancienId), numero: String(p.numero), title: p.title,
                          nouvelId: String(cible.id), photo: cible.photo || null, prix: cible.price });
    }
  } catch (_) { /* aucune suggestion plutôt qu'une fausse */ }

  const minRows = await sbGet('app_data?id=eq.panel_min_prices&select=data');
  const minPrices = (minRows && minRows[0] && minRows[0].data) || {};
  for (const o of online) { const m = Number(minPrices[String(o.id)]); if (isFinite(m) && m > 0) o.minPrice = m; }
  // Prix d'achat posés depuis le panneau (ligne dédiée) → visibles tout de suite,
  // sans attendre que l'app les reporte sur la paire.
  try {
    const bRows = await sbGet('app_data?id=eq.panel_buyprices&select=data');
    const bItems = (bRows && bRows[0] && bRows[0].data && bRows[0].data.items) || {};
    for (const o of online) {
      const b = bItems[String(o.id)];
      if (b && o.buyPrice == null && isFinite(Number(b.price))) o.buyPrice = Number(b.price);
    }
  } catch (_) {}
  const offers = [];
  try {
    const nombre = (v) => {
      if (v == null) return null;
      if (typeof v === 'number') return isFinite(v) ? v : null;
      if (typeof v === 'object') return nombre(v.amount != null ? v.amount : v.value);
      const n = Number(String(v).replace(',', '.').replace(/[^\d.]/g, ''));
      return isFinite(n) ? n : null;
    };
    const convRows = (await sbGet('app_data?id=like.harvest_*_conv_*&select=id,data') || []).filter(keepAcc).sort(parFraicheur);
    const vus = new Set();
    for (const r of convRows) {
      const p = (r.data && r.data.payload) || {};
      const c = p.conversation || p;
      const cid = String(c.id || ''); if (!cid || vus.has(cid)) continue; vus.add(cid);
      // Forme RÉELLE, relevée sur les conversations en base (pas devinée) :
      //   entity_type 'offer_request_message' = une offre DE L'ACHETEUR
      //     → { price:{amount}, status, status_title, current, user_id,
      //         transaction_id, offer_request_id }
      //   entity_type 'offer_message'         = MES propres offres (sans id)
      // Statuts observés : 20 = « Offre acceptée », 30 = « Refusée ».
      // ⚠️ Aucune offre EN ATTENTE dans l'échantillon → le code « en attente »
      //    est inconnu. On prend donc le problème à l'envers : on écarte ce
      //    qu'on sait tranché, et c'est TON clic (plus Vinted, qui refuse une
      //    offre déjà traitée) qui décide vraiment.
      const opp = (c.opposite_user && c.opposite_user.id) != null ? c.opposite_user.id : null;
      let last = null;
      for (const m of (Array.isArray(c.messages) ? c.messages : [])) {
        if (!m || m.entity_type !== 'offer_request_message') continue;
        const e = m.entity || {};
        if (e.current === false) continue;                       // remplacée par une plus récente
        if (opp != null && e.user_id !== opp) continue;          // c'est MOI qui l'ai faite
        if (e.status === 20 || e.status === 30) continue;        // acceptée / refusée
        if (/accept|refus|reject|expir|annul|cancel|retir/i.test(String(e.status_title || ''))) continue;
        const px = nombre(e.price != null ? e.price : (e.offer_price != null ? e.offer_price : e.amount));
        if (px == null) continue;
        last = { px, tx: e.transaction_id != null ? String(e.transaction_id) : '', oid: e.offer_request_id != null ? String(e.offer_request_id) : '' };
      }
      if (!last) continue;
      const titre = String(c.description || c.title || '');
      // L'article vient de la transaction (identité certaine) ; le titre n'est
      // qu'un repli d'affichage, et seulement s'il est unique (§24).
      const itemId = String((c.transaction && c.transaction.item_id) || '');
      const key = normT(titre);
      const cible = (itemId && online.find(o => String(o.id) === itemId))
        || ((key && onlineTitleN[key] === 1) ? online.find(o => normT(o.title) === key) : null);
      const min = cible && cible.minPrice != null ? Number(cible.minPrice) : null;
      offers.push({
        conv: cid, title: titre, price: last.px,
        tx: last.tx, oid: last.oid, uid: String((r.data && r.data.uid) || ''),
        url: `https://www.vinted.fr/inbox/${cid}`,
        id: cible ? cible.id : null, numero: cible ? cible.numero : null,
        photo: cible ? cible.photo : null, prixVente: cible ? cible.price : null,
        min, verdict: min == null ? 'sansmin' : (last.px >= min ? 'accepter' : 'contre'),
      });
    }
  } catch (_) { /* la forme d'une conversation peut varier : on n'affiche rien plutôt que du faux */ }
  // ── BORDEREAUX À IMPRIMER : reçus par email (avec PDF), pas encore imprimés/
  //    expédiés/masqués, avec le N° de la paire + le titre (comme dans l'app). ──
  const bp = await sbGet("app_data?id=like.email_bord_*&select=id,numero:data->>numero,modele:data->>modele,article:data->>article,transaction:data->>transaction,suivi:data->>suivi,filename:data->>filename,dateLimite:data->>dateLimite") || [];
  const bPrinted = d.vinted_bords_printed || {};
  const bShipped = d.vinted_bords_shipped || {};
  const bHidden = d.vinted_bords_hidden || {};
  // Bordereaux « traités » depuis le panneau (ligne dédiée, pas encore drainée
  // par l'app) → on les cache tout de suite, sans attendre la synchro de l'app.
  const pdoneRows = await sbGet('app_data?id=eq.panel_bords_done&select=data');
  const bDonePanel = (pdoneRows && pdoneRows[0] && pdoneRows[0].data) || {};
  const bKey = (b) => String(b.transaction || b.suivi || b.numero || '');
  // ⚠️ VINTED FAIT FOI : si la vente liée (par n° de transaction) n'attend plus le
  // colis, c'est que le colis est PARTI → le bordereau disparaît TOUT SEUL de la
  // liste, sans que tu aies à cocher quoi que ce soit (demande de Julien : « tu
  // vois bien que la paire a été expédiée, c'est débile de me faire cocher »).
  // Même signal que `bordShipped` dans l'app (statut de la vente moissonnée).
  // `soldRows` est trié du plus frais au plus ancien → la première occurrence
  // d'une transaction est sa capture la plus récente.
  const saleByTxn = {};
  for (const r of soldRows) {
    const cap = Date.parse((r.data && r.data.capturedAt) || '') || 0;
    for (const o of ((r.data && r.data.payload && r.data.payload.my_orders) || [])) {
      const tx = String(o.transaction_id || ''); if (tx && !saleByTxn[tx]) saleByTxn[tx] = { o, cap };
    }
  }
  const bordExpedie = (tx) => { const s = saleByTxn[String(tx || '')]; return !!s && !encoreAExpedier(tx, s.o.status, s.cap); };
  const bordsToPrint = bp
    .filter(b => b.filename) // a bien un PDF
    .map(b => ({ row: b.id, numero: b.numero || '', title: b.modele || b.article || '', transaction: b.transaction || '', dateLimite: b.dateLimite || '', key: bKey(b) }))
    .filter(b => b.key && !bPrinted[b.key] && !bShipped[b.key] && !bHidden[b.key] && !bDonePanel[b.key] && !bordExpedie(b.transaction));
  // Le bordereau REMONTE SUR LA LIGNE DE VENTE (au lieu d'une liste à part) :
  // chaque vente sait si son bordereau est prêt à imprimer, ou reste à générer.
  const bordByTxn = {};
  for (const b of bordsToPrint) { if (b.transaction) bordByTxn[String(b.transaction)] = b; }
  for (const v of salesFlat) {
    const b = v.transaction ? bordByTxn[String(v.transaction)] : null;
    if (b) v.bord = { etat: 'print', row: b.row, numero: b.numero || '', key: b.key, dateLimite: b.dateLimite || '' };
    else if (v.aExpedier && !(v.transaction && bordTxns.has(String(v.transaction)))) v.bord = { etat: 'generer' };
  }
  // Photo du bordereau = par N° UNIQUEMENT (identité certaine, jamais par titre §24).
  for (const b of bordsToPrint) { if (b.numero && photoByNum[String(b.numero)]) b.photo = photoByNum[String(b.numero)]; b.pro = !!(b.numero && proNums.has(String(b.numero))); }
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
    viewsTotal: online.reduce((s, o) => s + (o.views != null ? Number(o.views) || 0 : 0), 0),
    favsTotal: online.reduce((s, o) => s + (o.favs != null ? Number(o.favs) || 0 : 0), 0),
    toShip: toShip.filter(t => !t.hasBord).length,
    offres: offers.length,
    toPrint: bordsToPrint.length,
    toPickup: pickups.length,
    unread: convs.filter(c => c.unread).length,
    favoris: online.filter(o => (o.favs || 0) > 0).length,
    // Paires sensiblement AU-DESSUS de leurs comparables (>15 %) → à baisser.
    overMarket: online.filter(o => o.peer != null && o.price != null && Number(o.price) > Number(o.peer) * 1.15).length,
    litiges: disputes.length,
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
  return { online, relance, sleeping, noNum, toShip, offers, renumSuggest, momentVente, sante, compteActif, recentSales, sales, recentBuys, disputes, pickups, bordsToPrint, convs, activity, quickReplies, appStats, goal, freshestAt, stats, accounts, removedSold, byId: Object.fromEntries(online.map(o => [o.id, o])) };
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
