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

// La version écrite DANS CE FICHIER (voir `viderTampon`) — égale au manifeste
// dans le zip livré (`audit-extension-zip.cjs`). À monter avec lui.
const CODE_VERSION = '5.214.0';

// ══════════════════════════════════════════════════════════════════════════
// LE CODE QUI TOURNE N'ÉTAIT PAS CELUI QUE LE MANIFESTE ANNONCE (11 octobre)
// ══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ MESURÉ dans ses journaux, et reproduit au banc dans un vrai Chromium :
//    sur 5 des 6 Chrome qui travaillent pour lui, le dossier a été remplacé par
//    la 5.164 mais le SERVICE WORKER exécutait encore une 5.95–5.129 — en
//    annonçant « 5.164.0 », parce que `getManifest()` lit le FICHIER, pas le
//    code. Ni l'attente, ni l'arrêt du service worker, ni un redémarrage de
//    Chrome ne réparent : seul ⟳ (chrome://extensions) le fait, et seulement
//    dans le Chrome où on le clique. Aucune correction depuis le 3 octobre ne
//    tournait chez lui.
// ⇒ À chaque démarrage du service worker : si le code n'est pas celui du
//   manifeste, on se recharge UNE fois (`chrome.runtime.reload()` = le ⟳).
//   La garde vit dans `chrome.storage.local` (§4.9) et porte la PAIRE
//   code → manifeste : un rechargement qui ne réparerait rien ne tourne pas en
//   boucle. Stockage illisible ⇒ on ne recharge pas (« pas su » ne vaut pas
//   « vas-y » : sans garde, une boucle de rechargements est possible).
// ⚠️ Ça répare les mises à jour SUIVANTES. Le vieux code qui tourne aujourd'hui
//    n'a pas ce contrôle : c'est le pont (bridge.js, toujours lu depuis le
//    disque) qui le repère et demande la réparation (popup.html?mode=reparer).
const RECHARGE_CODE_STORE = 'vrmRechargeCode';
async function rechargerSiCodePerime() {
  let manif = '';
  try { manif = String(chrome.runtime.getManifest().version || ''); } catch (_) { return false; }
  if (!/^\d+\.\d+\.\d+$/.test(manif) || manif === CODE_VERSION) return false;
  if (!chrome.runtime || typeof chrome.runtime.reload !== 'function') return false;
  const cle = CODE_VERSION + '>' + manif;
  let deja;
  try { deja = (await chrome.storage.local.get(RECHARGE_CODE_STORE))[RECHARGE_CODE_STORE]; } catch (_) { return false; }
  if (deja && deja.cle === cle) return false;
  try { await chrome.storage.local.set({ [RECHARGE_CODE_STORE]: { cle, at: Date.now() } }); } catch (_) { return false; }
  try { chrome.runtime.reload(); } catch (_) { return false; }
  return true;
}
rechargerSiCodePerime().catch(() => {});
const SUPABASE_URL = 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

const VINTED_DOMAINS = ['www.vinted.fr', 'www.vinted.com', 'www.vinted.it', 'www.vinted.de'];

// ══════════════════════════════════════════════════════════════════════════
// CE QUE CE NAVIGATEUR SAIT FAIRE — MESURÉ, JAMAIS DEVINÉ (20 octobre, Orion)
// ══════════════════════════════════════════════════════════════════════════
// Julien : « qu'elle marche sur Orion sur l'iPhone, pareil que sur Chrome ».
// Orion (Kagi) a SA propre implémentation des API d'extension, et sur iOS
// Apple en limite la portée : sa liste officielle n'est pas joignable d'ici,
// et rien ne dit que `cookies`, `alarms`, `scripting` (monde MAIN),
// `downloads` ou `externally_connectable` y marchent. On ne lit donc PAS
// l'agent utilisateur : on regarde, une fois, ce qui EXISTE ici. Une API
// présente garde le chemin de Chrome à l'identique ; une API absente prend un
// chemin de remplacement qui garde la FONCTION :
//   · cookies   → la page Vinted les donne au script de contenu (`vrm-cookies`) ;
//   · alarms    → minuteries + rattrapage daté dans `chrome.storage.local`
//                 (iOS suspend le fond : rien ne se perd, tout repart au réveil) ;
//   · scripting (monde MAIN) → le relais de la page (content.js ↔ inject.js) ;
//   · downloads → les deux autres portes du bordereau (API Vinted, inject.js) ;
//   · externally_connectable → le pont de la page (comme Firefox).
// Ce qui ne se remplace pas est DIT à l'app (`nav` dans l'état du pont).
function mesurerCapacites() {
  const fn = (o, k) => { try { return !!(o && typeof o[k] === 'function'); } catch (_) { return false; } };
  const ev = (o) => { try { return !!(o && typeof o.addListener === 'function'); } catch (_) { return false; } };
  let c = null; try { c = (typeof chrome !== 'undefined' && chrome) || null; } catch (_) { c = null; }
  c = c || {};
  return {
    cookies: fn(c.cookies, 'get'),
    cookiesEvt: ev(c.cookies && c.cookies.onChanged),
    alarms: fn(c.alarms, 'create') && ev(c.alarms && c.alarms.onAlarm),
    scripting: fn(c.scripting, 'executeScript'),
    downloads: ev(c.downloads && c.downloads.onCreated),
    tabsMsg: fn(c.tabs, 'sendMessage'),
    externe: ev(c.runtime && c.runtime.onMessageExternal),
    popup: fn(c.action, 'setPopup'),
  };
}
const CAP = mesurerCapacites();
// `executeScript` existe mais refuse le monde MAIN (constaté au premier essai).
let CAP_MAIN_REFUSE = false;

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
// ⚠️ UNE SESSION PEUT ÊTRE « MORTE » (5.160). Quand Supabase refuse le jeton de
//    renouvellement (déjà utilisé, introuvable, session effacée), la session
//    ne reviendra JAMAIS toute seule : on la marque `mort` dans le stockage, et
//    `authToken()` rend `null` SANS RÉSEAU jusqu'à ce qu'une NOUVELLE session
//    arrive (l'app par le pont, ou la connexion dans la fenêtre). Sans cette
//    marque, chaque écriture retentait le même jeton mort : c'est la rafale de
//    429 + `refresh_token_already_used` mesurée le 5 octobre à 15:44 dans les
//    journaux d'authentification de production.
//    ⚠️ « Nouvelle » veut dire un AUTRE jeton de renouvellement : l'app renvoie
//    sa session à chaque « ready » du pont ; si c'est le jeton qui vient de
//    mourir, la ressusciter ne ferait que relancer un refus de plus.
function normaliserSession(sess) {
  if (!sess || typeof sess !== 'object') return null;
  const s = Object.assign({}, sess);
  // `expires_at` en SECONDES (forme Supabase) ⇒ en millisecondes, comme le
  // reste du fichier — sinon un jeton neuf passerait pour périmé depuis 1970.
  if (typeof s.expires_at === 'number' && s.expires_at > 0 && s.expires_at < 1e11) s.expires_at = s.expires_at * 1000;
  return s;
}
async function saveSession(sess) {
  let s = normaliserSession(sess);
  let avant = null;
  try { avant = await loadSession(); } catch (_) {}
  if (s && !s.mort && avant && avant.mort && avant.refresh_token && avant.refresh_token === s.refresh_token) {
    s = Object.assign({}, s, { mort: true, mortAt: avant.mortAt || Date.now(), mortRaison: avant.mortRaison || '' });
  }
  VRM_SESSION = s;
  if (avant?.user_id !== s?.user_id) {
    try { _memoVisite.clear(); } catch (_) {}
    try { await chrome.storage.local.remove(['vrmLogins','vrmCompteEcrit']); } catch (_) {}
  }
  try {
    if (s) await chrome.storage.local.set({ [SESSION_STORE]: s });
    else await chrome.storage.local.remove(SESSION_STORE);
  } catch (_) {}
  // Une session VIVANTE et NEUVE (autre jeton de renouvellement) lève la pause
  // des renouvellements : la pause portait sur l'ancien jeton. La même session
  // renvoyée, elle, ne lève rien (sinon chaque « ready » relancerait un essai).
  if (!s || (!s.mort && (!avant || avant.refresh_token !== s.refresh_token))) await effacerPauseRenouv(!s);
  majIcone(!!s && !s.mort);
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
// `lier` (11 octobre) : « Se connecter » dans l'extension ouvre VRM avec
// `lier-extension=<identifiant de CETTE extension>` — l'app, connectée, lui
// adresse sa propre session (voir `demanderLiaison`). Plus de mot de passe VRM
// tapé dans l'extension quand l'app peut la connecter.
function ouvrirVRMDepuis(urlActive, opts) {
  const p = plateformeDe(urlActive);
  let idExt = ''; try { idExt = String(chrome.runtime.id || ''); } catch (_) {}
  const lier = !!(opts && opts.lier && idExt);
  const cible = APP_URL_VRM + '/?tab=' + (p ? 'plat_' + p : 'plat_vinted') + (lier ? '&lier-extension=' + encodeURIComponent(idExt) : '');
  try {
    chrome.tabs.query({ url: APP_URL_VRM + '/*' }, (ouverts) => {
      const t = (ouverts || [])[0];
      // Déjà sur VRM : on ne recharge pas la page (on garde l'écran où l'on est)
      // — sauf pour une liaison, que l'app lit dans l'adresse.
      if (t && !lier && /vrm\.center/i.test(urlActive || '')) { chrome.tabs.update(t.id, { active: true }); return; }
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
loadSession().then((s) => majIcone(!!s && !s.mort)).catch(() => {});

// Une promesse qui ne répond pas ne doit jamais bloquer un appelant : au bout de
// `ms`, on rend `repli` (« pas su »). La promesse d'origine continue sa vie.
function avecDelai(p, ms, repli) {
  let t = null;
  return Promise.race([
    Promise.resolve(p).finally(() => { if (t) clearTimeout(t); }),
    new Promise((r) => { t = setTimeout(() => r(repli), ms); }),
  ]);
}

// ── LE RENOUVELLEMENT DE LA SESSION VRM (5.160) ─────────────────────────────
// Le jeton d'acces dure ~1 h ; on le renouvelle tout seul, sinon l'extension
// cesserait d'ecrire des que tu fermes l'app.
// ⚠️⚠️ MESURÉ LE 5 OCTOBRE (journaux d'authentification de production, 15:44) :
//    une RAFALE de 429 puis `refresh_token_already_used`. Trois défauts ici :
//    1. AUCUN « un seul en vol » : cinq écritures qui trouvent le jeton périmé
//       en même temps envoyaient CINQ renouvellements avec le MÊME jeton de
//       renouvellement — le premier le consomme, les quatre autres se font
//       refuser « already used », et Supabase révoque alors toute la famille ;
//    2. AUCUNE pause : un refus (429, 5xx, réseau) était retenté à l'appel
//       suivant, c'est-à-dire à chaque écriture ;
//    3. un refus DÉFINITIF (jeton mort) était retenté lui aussi, pour toujours.
// ⇒ Un seul renouvellement en vol (la PROMESSE est partagée) ; un refus
//    d'authentification marque la session MORTE (plus aucun appel tant qu'une
//    nouvelle session n'est pas arrivée) ; un refus passager ouvre une PAUSE
//    croissante (30 s → 1 min → … → 10 min), rangée dans `chrome.storage.local`
//    (§4.9 : un service worker meurt au bout de 30 s, une variable de module ne
//    retiendrait rien). Pendant la pause, un jeton d'accès encore valide sert.
const RENOUV_STORE = 'vrmRenouv';          // { echecs, prochainAt, code, at, okAt }
const RENOUV_PAUSE_MIN_MS = 30000, RENOUV_PAUSE_MAX_MS = 600000;
const RENOUV_DELAI_MS = 4000;              // un renouvellement qui ne répond pas = échec passager
// Les rejeux du MÊME jeton après une réponse perdue (11 octobre) : +1,5 s puis
// +4 s, avant la pause croissante. Mesuré : `/auth/v1/token` répond chez lui en
// 247 ms au plus — au-delà de 4 s, c'est une réponse perdue, pas une base lente.
const RENOUV_REJEUX_MS = [1500, 4000];
async function lireRenouv() {
  try { return (await chrome.storage.local.get(RENOUV_STORE))[RENOUV_STORE] || {}; } catch (_) { return {}; }
}
async function ecrireRenouv(v) { try { await chrome.storage.local.set({ [RENOUV_STORE]: v }); } catch (_) {} }
// `toutOublier` : déconnexion (on oublie aussi la date du dernier succès).
async function effacerPauseRenouv(toutOublier) {
  const cur = toutOublier ? {} : await lireRenouv();
  await ecrireRenouv(cur.okAt && !toutOublier ? { okAt: cur.okAt } : {});
}
// Un refus qui dit « ce jeton ne marchera plus jamais ». Seulement un statut
// d'authentification ET un code d'erreur d'authentification : une page HTML de
// proxy en 404, ou un 400 dont on ne reconnaît pas le corps, reste un échec
// PASSAGER — « pas su » ne vaut pas « mort ».
const RENOUV_MORT = /invalid_grant|refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|user_not_found|user_banned|invalid refresh token|refresh token not found|already used|session (?:not found|expired)/i;
function renouvellementMort(status, corps) {
  if (![400, 401, 403, 404].includes(Number(status))) return false;
  const c = corps && typeof corps === 'object' ? corps : {};
  const texte = [c.error_code, c.code, c.error, c.error_description, c.msg, c.message].filter((x) => typeof x === 'string').join(' ');
  return RENOUV_MORT.test(texte);
}
let _refreshEnVol = null;
// `force` : la base vient de refuser le jeton (401) alors qu'il n'est pas
// encore périmé — on veut un jeton NEUF, pas celui qu'on a.
function refreshSession(opts) {
  if (!_refreshEnVol) {
    _refreshEnVol = renouvelerSession(opts || {}).catch(() => null).finally(() => { _refreshEnVol = null; });
  }
  return _refreshEnVol;
}
async function renouvelerSession({ force = false } = {}) {
  const s = await loadSession();
  if (!s || !s.refresh_token || s.mort) return null;
  const maintenant = Date.now();
  // Un appelant qui avait lu l'ancienne session arrive après le renouvellement :
  // elle est déjà neuve, on ne consomme pas le nouveau jeton pour rien.
  if (!force && s.access_token && s.expires_at && s.expires_at > maintenant + 60000) return s;
  const rv = await lireRenouv();
  if (rv.prochainAt && maintenant < Number(rv.prochainAt)) return null;            // en pause
  // Forcé juste après un succès : le jeton a moins d'une minute, en refaire un
  // ne changera rien au refus — c'est une autre cause (et une rafale évitée).
  if (force && rv.okAt && maintenant - Number(rv.okAt) < 60000 && s.access_token && s.expires_at > maintenant) return s;
  const jeton = s.refresh_token;
  // ⚠️⚠️ UNE RÉPONSE PERDUE NE TUE PLUS LA SESSION (11 octobre). Le serveur a pu
  //    faire tourner le jeton et la réponse se perdre (veille, réseau qui
  //    change, délai dépassé) : le nouveau jeton n'est jamais arrivé. On rejoue
  //    alors le MÊME jeton, vite, deux fois (+1,5 s puis +4 s) — dans la fenêtre
  //    où Supabase rend le jeton courant au parent qui n'a pas pu ranger sa
  //    réponse (mesuré sur le vrai GoTrue : le PARENT du jeton actif est même
  //    accepté sans limite). Avant, on attendait 30 s de pause, et pendant ce
  //    temps rien ne s'écrivait. Un 429 n'est PAS rejoué (c'est « ralentis »).
  const UN_ESSAI = async () => {
    let r = null, c = null;
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const envoi = fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, Object.assign({
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: jeton }),
      }, ctrl ? { signal: ctrl.signal } : {}));
      r = await avecDelai(envoi, RENOUV_DELAI_MS, null);
      if (!r && ctrl) { try { ctrl.abort(); } catch (_) {} }
      if (r && typeof r.text === 'function') {
        const t = await avecDelai(r.text().catch(() => ''), RENOUV_DELAI_MS, '');
        try { c = t ? JSON.parse(t) : null; } catch (_) { c = null; }
      } else if (r && typeof r.json === 'function') {
        c = await avecDelai(r.json().catch(() => null), RENOUV_DELAI_MS, null);
      }
    } catch (_) { r = null; }
    return { r, c };
  };
  // Rejouable : rien reçu (réseau, délai), 5xx, ou un 2xx illisible. Jamais un
  // 429 (Supabase demande de ralentir) ni un refus d'authentification.
  const rejouable = (x) => !x.r || Number(x.r.status) >= 500 || (x.r.ok && !(x.c && x.c.access_token));
  let res = null, corps = null, rejoue = 0;
  for (let i = 0; ; i++) {
    const x = await UN_ESSAI();
    res = x.r; corps = x.c;
    if (!rejouable(x) || i >= RENOUV_REJEUX_MS.length) break;
    // La session a changé entre-temps (l'app vient d'en donner une) : on s'arrête.
    const cur = await loadSession();
    if (!cur || cur.refresh_token !== jeton) break;
    await new Promise((ok) => setTimeout(ok, RENOUV_REJEUX_MS[i]));
    rejoue++;
  }
  if (rejoue) Promise.resolve().then(() => noterDiag('session_renouv_rejoue_' + rejoue + (res && res.ok ? '_ok' : ''))).catch(() => {});
  // ⚠️ LA SESSION A PU CHANGER PENDANT LE VOL (l'app vient d'envoyer la sienne,
  //    ou une déconnexion) : on n'écrase rien, et un refus de l'ANCIEN jeton ne
  //    tue pas la NOUVELLE session.
  const apres = await loadSession();
  if (!apres || apres.refresh_token !== jeton) {
    return (apres && !apres.mort && apres.access_token && apres.expires_at > Date.now()) ? apres : null;
  }
  if (res && res.ok && corps && corps.access_token) {
    // ⚠️ L'EMAIL SE PERDAIT ICI (mesuré le 2 octobre) : la session renouvelée
    //    était reconstruite SANS lui, donc « compte VRM utilisé » devenait vide
    //    au bout d'une heure — l'information même qui manquait le jour où ses
    //    captures sont parties dans un autre compte VRM.
    const next = {
      access_token: corps.access_token,
      refresh_token: corps.refresh_token || jeton,
      expires_at: Date.now() + ((corps.expires_in || 3600) * 1000),
      user_id: (corps.user && corps.user.id) || s.user_id || subDuJwt(corps.access_token) || null,
      email: (corps.user && corps.user.email) || s.email || emailDuJwt(corps.access_token) || '',
    };
    await saveSession(next);
    await ecrireRenouv({ okAt: Date.now() });
    return next;
  }
  if (res && renouvellementMort(res.status, corps)) {
    const raison = String((corps && (corps.error_code || corps.error || corps.code)) || res.status).slice(0, 60);
    await saveSession(Object.assign({}, s, { mort: true, mortAt: Date.now(), mortRaison: raison }));
    Promise.resolve().then(() => noterDiag('session_morte_' + raison.replace(/[^a-z_]/gi, '').slice(0, 40))).catch(() => {});
    // ⚠️ 11 octobre : une session morte ne se répare plus en silence au bout de
    //    20 s (le battement de l'app) — ni jamais si personne ne regarde. On
    //    prévient TOUT DE SUITE l'app ouverte dans ce Chrome : connectée, elle
    //    redonne une session À CETTE extension (adressée, `onMessageExternal`).
    //    Sans app ouverte : rien ne part, la carte du logo dit « reconnecte ».
    Promise.resolve().then(() => notifierApp({ type: 'session', etat: 'morte' })).catch(() => {});
    return null;
  }
  // Passager (429, 5xx, réseau, délai, réponse illisible) : pause croissante.
  const echecs = Number(rv.echecs || 0) + 1;
  const pause = Math.min(RENOUV_PAUSE_MAX_MS, RENOUV_PAUSE_MIN_MS * Math.pow(2, echecs - 1));
  const code = res ? String(res.status || 'inconnu') : 'reseau';
  await ecrireRenouv({ echecs, prochainAt: Date.now() + pause, code, at: Date.now(), okAt: rv.okAt || 0 });
  Promise.resolve().then(() => noterDiag('session_renouv_pause_' + code)).catch(() => {});
  return null;
}
async function authToken() {
  const s = await loadSession();
  if (!s || s.mort) return null;                 // morte : AUCUN réseau
  if (s.access_token && s.expires_at && s.expires_at > Date.now() + 60000) return s;
  const r = await refreshSession();
  if (r && r.access_token) return r;
  // Pas renouvelée (pause, échec passager) : le jeton actuel tient-il ENCORE ?
  const cur = await loadSession();
  return (cur && !cur.mort && cur.access_token && cur.expires_at > Date.now()) ? cur : null;
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
const MSG_MDP_CAPTCHA = 'La connexion par mot de passe n’est plus possible depuis l’extension : utilise « Se connecter avec VRM ».';
function estRefusCaptcha(j, brut) {
  return !!((j && /captcha/i.test(String(j.error_code || j.code || ''))) || /captcha/i.test(String(brut || '')));
}
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
      // ⚠️ CAPTCHA (21 oct.) : le jour où Julien allume Turnstile dans Supabase,
      //    GoTrue refuse `grant_type=password` sans jeton captcha (400,
      //    `captcha_failed`, « captcha protection: request disallowed »). Une page
      //    d'extension MV3 ne peut pas charger le script distant de Turnstile :
      //    ce chemin est fermé pour de bon, le geste est « Se connecter avec VRM »
      //    (session fabriquée par le serveur, exemptée du captcha).
      if (estRefusCaptcha(j, brut)) {
        return { ok: false, captcha: true, error: MSG_MDP_CAPTCHA };
      }
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
    // 22 oct. : l'onglet Vinted déjà ouvert est relu tout de suite (voir `visiteApresSession`).
    visiteApresSession('connexion');
    return { ok: true, email: (j.user && j.user.email) || mail };
  } catch (e) { return { ok: false, error: 'Réseau indisponible — réessaie.' }; }
}

// État de la session, pour l'afficher SANS mentir : connecté ou non, sous quelle
// adresse, et surtout si la base sait aujourd'hui séparer les vendeurs. Tant que
// `cloisonne` est faux, se connecter ne protège rien — on le dit.
// ── SANS RÉSEAU (5.160) ──────────────────────────────────────────────────────
// ⚠️⚠️ « L'EXTENSION NE RÉPOND PAS » (Julien, 5 octobre, en cliquant « Générer
//    le bordereau »). L'app demande l'état toutes les 20 s et abandonne au bout
//    de 2,5 s. Or l'état attendait le RÉSEAU : la sonde de cloisonnement (une
//    fois par vie du service worker — donc à chaque réveil à froid), puis le
//    renouvellement de la session, puis la liste des comptes. Un service
//    worker qui se réveille, une base lente : la réponse arrivait après
//    l'abandon, et l'app concluait que l'extension était morte.
// ⇒ L'état se lit dans le STOCKAGE LOCAL. Si le jeton est à renouveler, on
//    lance le renouvellement (le seul en vol) et on l'attend au plus
//    `attenteMs` ; au-delà, on ne devine ni oui ni non : `connecte: null`
//    (« pas su, renouvellement en cours »). TROIS états, jamais deux.
function subDuJwt(token) {
  try { const p = jwtPayload(token); return (p && typeof p.sub === 'string') ? p.sub : ''; } catch (_) { return ''; }
}
async function authEtatRapide(attenteMs = 1500, attenteCloisonneMs = 0) {
  const cloisonneP = cloisonneConnu(attenteCloisonneMs).catch(() => null);
  const s = await loadSession();
  const ident = (x) => ({
    email: (x && (x.email || emailDuJwt(x.access_token))) || '',
    user_id: (x && (x.user_id || subDuJwt(x.access_token))) || null,
  });
  const rendre = async (connecte, expiree, x, extra) => Object.assign(
    { ok: true, connecte, expiree }, ident(x), { cloisonne: await cloisonneP }, extra || {});
  if (!s) return rendre(false, false, null);
  if (s.mort) return rendre(false, true, s, { mort: true });
  const valide = (x) => !!(x && !x.mort && x.access_token && x.expires_at && x.expires_at > Date.now());
  if (s.access_token && s.expires_at && s.expires_at > Date.now() + 60000) return rendre(true, false, s);
  if (!s.refresh_token) return valide(s) ? rendre(true, false, s) : rendre(false, true, s);
  // À renouveler : le renouvellement part (un seul en vol), on l'attend au plus
  // `attenteMs`. Il continue sa vie au-delà — la question suivante en profite.
  const enVol = refreshSession().catch(() => null);
  const fait = await avecDelai(enVol.then((v) => ({ v })), attenteMs, null);
  if (fait && fait.v && fait.v.access_token) return rendre(true, false, fait.v);
  const cur = await loadSession();
  if (!cur) return rendre(false, false, null);              // déconnecté entre-temps
  if (cur.mort) return rendre(false, true, cur, { mort: true });
  if (valide(cur)) return rendre(true, false, cur);
  return rendre(null, null, cur, { renouvellement: fait ? 'pause' : 'en-cours' });
}
// L'état « complet », pour la fenêtre de connexion et l'icône : leur contrat est
// À DEUX ÉTATS (connecté ou pas). On attend donc un peu plus le renouvellement,
// et si on ne sait toujours pas, on dit « expirée » comme avant — avec
// `incertain` pour qui sait le lire (se reconnecter règle le cas de toute façon).
async function authEtat() {
  const e = await authEtatRapide(2000, 1000);
  if (e.connecte === null) return Object.assign({}, e, { connecte: false, expiree: true, incertain: true });
  return e;
}
// L'email est une REVENDICATION du jeton Supabase (`email`) : une identité, pas
// une ressemblance — c'est le repli quand la session n'a pas gardé l'adresse.
function emailDuJwt(token) {
  try { const p = jwtPayload(token); return (p && typeof p.email === 'string') ? p.email : ''; } catch (_) { return ''; }
}

async function authLogout() { await saveSession(null); return { ok: true }; }

// ══════════════════════════════════════════════════════════════════════════
// « SE CONNECTER AVEC VRM » — LA SESSION ADRESSÉE À UNE EXTENSION (11 octobre)
// ══════════════════════════════════════════════════════════════════════════
// Julien : « quand j'appuie sur se connecter ça doit envoyer directement dans
// l'application VRM », « elle ne garde pas les connexions ». MESURÉ (journaux
// d'authentification de production, et rejoué sur un vrai GoTrue) :
//   · l'app POSTAIT une session par `window.postMessage` : TOUTE extension de la
//     page l'adoptait — une copie ancienne restée à côté (même famille de jetons,
//     qui finit révoquée) ; et un `session: null` posté au démarrage d'une app
//     dont la session était morte faisait OUBLIER à l'extension la sienne, saine
//     (9 oct. 18:37, 10 oct. 09:08 : une écriture, puis plus rien) ;
//   · se connecter DANS l'extension ne connectait pas l'app : il retapait son
//     mot de passe une seconde fois dans VRM.
// ⇒ Un seul canal, ADRESSÉ : `chrome.runtime.onMessageExternal` (le manifeste
//   déclare `externally_connectable` pour l'app). Chrome pose lui-même l'origine
//   de l'expéditeur, et seule l'extension dont l'app a donné l'IDENTIFIANT reçoit
//   le message — une copie ancienne, qui n'écoute pas ce canal, n'entend rien.
//   Trois messages, tous refusés hors de l'origine de l'app :
//     · `liaison` {pour, force, raison} : « as-tu besoin d'une session pour le
//       compte VRM `pour` ? » — l'extension décide, et seulement si oui rend un
//       NONCE (128 bits, 2 min, une seule fois) ;
//     · `session` {nonce, session} : acceptée seulement avec CE nonce, et pour
//       le compte annoncé — jamais une session venue d'ailleurs ;
//     · `deconnexion` {pour} : « Se déconnecter » dans VRM — seulement si
//       l'extension écrit sous CE compte (une session morte de l'app, elle, ne
//       fait plus rien oublier).
const LIAISON_STORE = 'vrmLiaison';          // { demandeAt, nonce: { n, at, pour } }
const LIAISON_DEMANDE_MS = 15 * 60000;       // « Se connecter » cliqué : valable 15 min
const LIAISON_NONCE_MS = 2 * 60000;
async function lireLiaison() {
  try { return (await chrome.storage.local.get(LIAISON_STORE))[LIAISON_STORE] || {}; } catch (_) { return null; }
}
async function ecrireLiaison(v) { try { await chrome.storage.local.set({ [LIAISON_STORE]: v }); return true; } catch (_) { return false; } }
function nonceAleatoire() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
// « Se connecter » (fenêtre de l'icône, carte du logo) : on note la demande, et
// on ouvre VRM TOUT DE SUITE — aucune attente avant l'ouverture (la carte de
// connexion pouvait disparaître avant d'avoir ouvert VRM : 5 fois sur 50).
async function lierAvecVRM(urlActive) {
  const l = (await lireLiaison()) || {};
  await ecrireLiaison(Object.assign({}, l, { demandeAt: Date.now() }));
  ouvrirVRMDepuis(urlActive, { lier: true });
  return { ok: true };
}
const UUID_VRM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function demanderLiaison(msg) {
  const pour = String((msg && msg.pour) || '');
  if (!UUID_VRM.test(pour)) return { ok: false, code: 'invalide' };
  const l = await lireLiaison();
  if (l === null) return { ok: false, code: 'stockage' };       // pas su ⇒ on ne s'engage à rien
  const s = await loadSession();
  const sonId = s ? String(s.user_id || subDuJwt(s.access_token) || '') : '';
  const demande = !!(l.demandeAt && Date.now() - Number(l.demandeAt) < LIAISON_DEMANDE_MS);
  let raison = '';
  if (!s || !s.refresh_token) raison = 'aucune';
  else if (s.mort) raison = 'morte';
  else if (sonId && sonId !== pour) raison = (demande || msg.force === true) ? 'autre' : '';
  else if (demande) raison = 'demande';
  // Une session donnée par l'app AVANT le 6 octobre partage encore sa famille
  // de jetons : l'app demande UNE fois, par appareil, de la remplacer.
  else if (msg.raison === 'separer') raison = 'separer';
  if (!raison) return { ok: true, besoin: false };
  const n = nonceAleatoire();
  if (!(await ecrireLiaison(Object.assign({}, l, { nonce: { n, at: Date.now(), pour } })))) return { ok: false, code: 'stockage' };
  return { ok: true, besoin: true, nonce: n, raison };
}
async function recevoirSessionAdressee(msg) {
  const l = await lireLiaison();
  const att = l && l.nonce;
  if (!att || !msg || typeof msg.nonce !== 'string' || att.n !== msg.nonce) return { ok: false, code: 'nonce' };
  if (Date.now() - Number(att.at || 0) > LIAISON_NONCE_MS) return { ok: false, code: 'nonce-perime' };
  const sess = msg.session;
  if (!sess || typeof sess.access_token !== 'string' || typeof sess.refresh_token !== 'string' || !sess.access_token || !sess.refresh_token) return { ok: false, code: 'session' };
  const uid = String(sess.user_id || subDuJwt(sess.access_token) || '');
  if (!uid || uid !== String(att.pour || '')) return { ok: false, code: 'compte' };
  // Le nonce ne sert qu'UNE fois — consommé avant tout le reste.
  if (!(await ecrireLiaison({}))) return { ok: false, code: 'stockage' };
  // ⚠️⚠️ L'APP TRANSMET UNE SESSION, ET L'EXTENSION L'ADOPTE. Mesuré le
  //    2 octobre : quelqu'un s'est connecté à VRM avec une AUTRE adresse dans ce
  //    Chrome, et les captures sont parties dans cette autre boutique. On garde
  //    la trace de la bascule pour que la carte du logo la DISE.
  // Écrivait-elle déjà, vivante, sous CE compte ? (sinon la session est NEUVE
  // pour la capture : voir `visiteApresSession`, plus bas.)
  let dejaVivante = false;
  try {
    const avant = await loadSession();
    const sonAvant = avant ? String(avant.user_id || subDuJwt(avant.access_token) || '') : '';
    dejaVivante = !!(avant && !avant.mort && avant.refresh_token && sonAvant === uid);
    if (avant && sonAvant && sonAvant !== uid) {
      await chrome.storage.local.set({ vrmBascule: { de: avant.email || emailDuJwt(avant.access_token) || '', vers: sess.email || emailDuJwt(sess.access_token) || '', at: Date.now() } });
    }
  } catch (_) {}
  const email = String(sess.email || emailDuJwt(sess.access_token) || '');
  await saveSession({ access_token: sess.access_token, refresh_token: sess.refresh_token, expires_at: sess.expires_at, user_id: uid, email });
  Promise.resolve().then(() => noterDiag('session_liee')).catch(() => {});
  notifierApp({ type: 'session', etat: 'liee', email });
  if (!dejaVivante) visiteApresSession('liaison');
  return { ok: true, email };
}
// ── 22 oct. — LA PREMIÈRE VISITE, DÈS QUE LA SESSION ARRIVE ─────────────────
// Mesuré (lecture seule, sa base, le premier inscrit relié le 22 au matin) :
// son onglet Vinted était ouvert AVANT que l'extension ait une session VRM.
// La visite de cette page est sortie sur `visite_sans_session` (sans prendre
// de garde, à raison : 5.165), la capture passive du profil a été refusée
// (`ecriture_ratee_harvest_profile_sans_session` ×2) et le dressing passif
// ignoré (`ignore_dressing_profil_pas_lu` ×2). Puis la session est arrivée…
// et RIEN n'a relancé la visite : profil et annonces ont attendu l'alarme des
// 20 minutes (achats et messages, eux, sont arrivés par la capture passive).
// Pour quelqu'un qui découvre VRM, c'est vingt minutes d'une boutique vide.
// ⇒ Une session NEUVE pour la capture (aucune, morte, ou un autre compte VRM)
//    relance la visite de l'onglet Vinted DÉJÀ ouvert — la même
//    `visiteVinted`, donc les MÊMES garde-fous : compte supprimé ou ignoré,
//    pause demandée par Vinted, recul de notre base, garde des 5 minutes, file
//    Vinted, budgets. Aucune requête de plus qu'une page rechargée à la main.
//    Aucun onglet Vinted ouvert ⇒ rien (la prochaine page fera la visite).
async function visiteApresSession(raison) {
  try {
    const onglets = await chrome.tabs.query({});
    const surVinted = (onglets || []).some((t) => /^https:\/\/(www\.)?vinted\.(fr|com|it|de)\//.test(String((t && t.url) || '')));
    if (!surVinted) return false;
    Promise.resolve().then(() => noterDiag('visite_apres_' + String(raison || 'session').replace(/[^a-z]/g, ''))).catch(() => {});
    clearTimeout(visiteTimer);
    visiteTimer = setTimeout(() => { visiteVinted(); }, 1500);
    return true;
  } catch (_) { return false; }
}
async function deconnexionAdressee(msg) {
  const s = await loadSession();
  if (!s) return { ok: true, deja: true };
  const sonId = String(s.user_id || subDuJwt(s.access_token) || '');
  if (!sonId || sonId !== String((msg && msg.pour) || '')) return { ok: false, code: 'compte' };
  await saveSession(null);
  return { ok: true };
}
try {
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    const src = (sender && (sender.origin || sender.url)) || '';
    // `ORIGINE_APP` est posée plus bas dans ce fichier : un message n'arrive
    // jamais avant la fin de son évaluation.
    if (!ORIGINE_APP.test(src)) { sendResponse({ ok: false, code: 'origine' }); return false; }
    if (!msg || typeof msg !== 'object') { sendResponse({ ok: false, code: 'invalide' }); return false; }
    (async () => {
      try {
        if (msg.type === 'liaison') { sendResponse(await demanderLiaison(msg)); return; }
        if (msg.type === 'session') { sendResponse(await recevoirSessionAdressee(msg)); return; }
        if (msg.type === 'deconnexion') { sendResponse(await deconnexionAdressee(msg)); return; }
        if (msg.type === 'code') { let ext = ''; try { ext = String(chrome.runtime.id || ''); } catch (_) {} sendResponse({ ok: true, code: CODE_VERSION, ext }); return; }
        sendResponse({ ok: false, code: 'inconnu' });
      } catch (e) { sendResponse({ ok: false, code: 'erreur' }); }
    })();
    return true;
  });
} catch (_) {}
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
// ⚠️⚠️ TROIS ÉTATS, COMME `baseCloisonnee` CÔTÉ SERVEUR (api/_lib/session.js,
//    §11 : une règle, la même partout). La sonde mémorisait `false` sur TOUT
//    échec (`CLOISONNE = r.ok`, et `false` dans le `catch`) : un 502 au réveil
//    du service worker, et l'extension écrivait avec la clé publique pour toute
//    sa vie — que RLS refuse en silence. Désormais :
//      · 200 ⇒ cloisonnée : mémorisé ET rangé dans `chrome.storage.local`
//        (une base n'est jamais dé-cloisonnée : au prochain réveil, plus besoin
//        de sonder) ;
//      · 400 ⇒ la colonne `owner` n'existe pas : mémorisé pour cette vie ;
//      · tout le reste (5xx, réseau, délai) ⇒ PAS SU : rien n'est mémorisé ; on
//        rend la valeur rangée s'il y en a une, sinon `true` — l'état de
//        production. L'asymétrie décide : écrire AVEC `owner` dans une base
//        non cloisonnée échoue BRUYAMMENT (400, compté, retenté au cycle
//        suivant) ; écrire SANS `owner` dans une base cloisonnée est refusé EN
//        SILENCE par RLS — la capture disparaît sans que rien ne le dise.
const CLOISONNE_STORE = 'vrmCloisonne';
const CLOISONNE_DELAI_MS = 8000;
// Après un « pas su », on ne resonde pas avant 30 s : en pleine panne, chaque
// écriture relancerait sinon une sonde. (Simple frein : le perdre au réveil du
// service worker coûte au pire UNE sonde de plus — rien n'est retenu ici.)
let CLOISONNE_ECHEC_AT = 0;
async function cloisonneRange() {
  try { return (await chrome.storage.local.get(CLOISONNE_STORE))[CLOISONNE_STORE] === true ? true : null; } catch (_) { return null; }
}
// Rend true · false · null (pas su). Une seule sonde en vol.
function sonderCloisonne() {
  if (CLOISONNE !== null) return Promise.resolve(CLOISONNE);
  if (CLOISONNE_EN_VOL) return CLOISONNE_EN_VOL;
  CLOISONNE_EN_VOL = (async () => {
    if (await cloisonneRange() === true) { CLOISONNE = true; return true; }
    if (Date.now() - CLOISONNE_ECHEC_AT < 30000) return null;
    let r = null;
    try {
      r = await avecDelai(fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }), CLOISONNE_DELAI_MS, null);
    } catch (_) { r = null; }
    if (r && r.ok) {
      CLOISONNE = true;
      try { await chrome.storage.local.set({ [CLOISONNE_STORE]: true }); } catch (_) {}
      return true;
    }
    if (r && r.status === 400) { CLOISONNE = false; return false; }
    CLOISONNE_ECHEC_AT = Date.now();
    return null;
  })().catch(() => null).finally(() => { CLOISONNE_EN_VOL = null; });
  return CLOISONNE_EN_VOL;
}
async function isCloisonne() {
  if (CLOISONNE !== null) return CLOISONNE;
  const v = await sonderCloisonne();
  return v === null ? true : v;
}
// Pour un ÉTAT à afficher (jamais pour décider d'une écriture) : ce qu'on SAIT
// déjà — mémoire, puis valeur rangée — sans attendre le réseau au-delà de
// `attenteMs`. La sonde part en fond si on ne sait pas. `null` = pas su.
async function cloisonneConnu(attenteMs) {
  if (CLOISONNE !== null) return CLOISONNE;
  const enVol = sonderCloisonne();
  if (await cloisonneRange() === true) return true;
  if (!attenteMs) return null;
  return await avecDelai(enVol, attenteMs, null);
}

// Aucune lecture/écriture métier anonyme, même si la sonde de schéma échoue.
// Les sondes de structure utilisent leurs propres en-têtes publics.
async function sbHeaders(extra) {
  const s = await authToken();
  return Object.assign({}, extra || {}, {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${(s && s.access_token) || 'session-vrm-requise'}`,
  });
}
async function withOwner(row) {
  const s = await authToken();
  if (!s?.user_id || !s.access_token) throw new Error('Session VRM requise');
  return Object.assign({}, row, { owner: s.user_id });
}
async function appDataConflict() { return 'owner,id'; }

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
  // Orion iPhone : sans API `cookies`, la page Vinted les donne (voir `vrm-cookies`).
  if (!CAP.cookies) return cookieDeLaPage(domain, name);
  return new Promise((resolve) => {
    try { chrome.cookies.get({ url: `https://${domain}`, name }, (c) => resolve(c ? c.value : null)); }
    catch (_) { resolve(null); }
  });
}
// ── LES COOKIES DE SESSION, LUS PAR LA PAGE (navigateur sans API `cookies`) ──
// Le script de contenu de vinted.fr lit `document.cookie` (ce que la page voit
// elle-même) et l'envoie ici ; on le range dans `chrome.storage.local` (§4.9 :
// iOS suspend le fond, une variable de module ne survivrait pas). Seuls les
// trois noms utiles sont acceptés, seulement depuis un onglet Vinted, et pour
// SON domaine. ⚠️ Si Vinted pose ces cookies en HttpOnly, la page ne les voit
// pas : la session reste « pas vue », et c'est DIT à l'app (`nav`), jamais
// remplacé par une identité devinée.
const COOKIES_PAGE_STORE = 'vrmCookiesPage';
const COOKIES_UTILES = ['access_token_web', 'refresh_token_web', 'anon_id'];
async function cookieDeLaPage(domain, name) {
  try {
    const o = (await chrome.storage.local.get(COOKIES_PAGE_STORE))[COOKIES_PAGE_STORE] || {};
    const d = o[String(domain || '')];
    const v = d && d.c && d.c[name];
    return typeof v === 'string' && v ? v : null;
  } catch (_) { return null; }
}
let cookiesPageTimer = null;
async function recevoirCookiesPage(msg, sender) {
  if (CAP.cookies) return { ok: true, ignore: true };
  let hote = ''; try { hote = new URL(String((sender && sender.tab && sender.tab.url) || (sender && sender.url) || '')).hostname; } catch (_) {}
  if (!VINTED_DOMAINS.includes(hote) || String(msg.domain || '') !== hote) return { ok: false, raison: 'site' };
  const c = {};
  const src = msg.c && typeof msg.c === 'object' ? msg.c : {};
  for (const k of COOKIES_UTILES) if (typeof src[k] === 'string' && src[k].length > 0 && src[k].length <= 8192) c[k] = src[k];
  let avant = null;
  try {
    const o = (await chrome.storage.local.get(COOKIES_PAGE_STORE))[COOKIES_PAGE_STORE] || {};
    avant = o[hote] || null;
    o[hote] = { c, vu: !!c.access_token_web, at: Date.now() };
    await chrome.storage.local.set({ [COOKIES_PAGE_STORE]: o });
  } catch (_) { return { ok: false, raison: 'stockage' }; }
  // L'équivalent de `cookies.onChanged` : une session qui change (connexion,
  // bascule de compte, renouvellement) relance la capture, comme sur Chrome.
  const change = !avant || (avant.c || {}).access_token_web !== c.access_token_web || (avant.c || {}).refresh_token_web !== c.refresh_token_web;
  if (change && c.access_token_web) {
    clearTimeout(cookiesPageTimer);
    cookiesPageTimer = setTimeout(() => { captureDomain(hote).then(() => runActive()).catch(() => {}); }, 2000);
  }
  return { ok: true, vu: !!c.access_token_web };
}

// ⚠️ UNE ÉCRITURE RATÉE SE DIT AVEC SON CODE (4 octobre, 5.155). `supabaseUpsert`
//    rendait `res.ok` et rien d'autre : « la base a refusé » (401 jeton mort,
//    403 abonnement, 400 colonne absente, 413 trop gros) et « la base n'a pas
//    répondu » (522, réseau) finissaient tous en un même `false`, et chaque
//    appelant notait au mieux `ecriture_ratee_<type>` — sans dire POURQUOI.
//    Ces cas ne se corrigent pas de la même façon. On note donc la FAMILLE de la
//    ligne et le CODE HTTP (`ecriture_ratee_<famille>_<code>`), jamais le corps.
//    Le contrat ne bouge pas : on rend toujours un booléen.
//    La famille retire les identifiants (compte, transaction, UUID) : le nombre
//    de clés reste borné, et aucun identifiant ne part dans le diagnostic.
function familleEcriture(table, rows) {
  if (table !== 'app_data') return String(table || 'table').replace(/[^a-zA-Z_]/g, '').slice(0, 30) || 'table';
  const id = String((rows && rows[0] && rows[0].id) || '');
  // Un segment qui porte un chiffre ou un signe (n° de compte, de transaction,
  // de suivi, UUID) est une IDENTITÉ, pas une famille : on le retire en entier
  // (sinon `XW476115185SP` laisserait `XWSP`). Quatre mots au plus.
  return id.split('_').filter((s) => /^[a-zA-Z]+$/.test(s)).slice(0, 4).join('_').slice(0, 40) || 'inconnu';
}
// Un seul renouvellement de session en vol : deux écritures refusées en même
// temps ne doivent pas consommer deux fois le même jeton de renouvellement.
// (5.160 : c'est `refreshSession` lui-même qui partage sa promesse, et qui
// respecte la session morte et la pause — ce chemin-ci en profite.)
function renouvelerUneFois() {
  return refreshSession({ force: true });
}
// Code HTTP du DERNIER envoi refusé par la base (401, 403, 400, 5xx…). Posé
// ici à l'échec, lu par `noterFlux` : le logo DIT alors pourquoi. Un 4xx est un
// refus DURABLE (accès coupé, session rejetée) — « ça réessaie tout seul »
// serait une fausse promesse (le défaut le plus coûteux du projet). On ne le
// remet jamais à `null` sur un succès : `noterFlux` ne le lit que sur un échec,
// qui vient de le poser — donc toujours frais, même en cas d'écritures en
// parallèle.
let _statutDernierRefus = null;
async function supabaseUpsert(table, rows, onConflict, ownerAttendu = null) {
  const list = Array.isArray(rows) ? rows : [rows];
  // ⚠️⚠️ 19 octobre (5.193) — LA SESSION SE LIT UNE FOIS PAR ENVOI, ET SANS
  //    ELLE UNE BASE CLOISONNÉE NE REÇOIT RIEN. Mesuré chez Julien :
  //    `ecriture_ratee_vinted_accounts_400` ×82, `ecriture_ratee_harvest_*_400`
  //    (txn, conv, inbox, seen_urls…). Session morte ou en pause : `withOwner`
  //    rendait la ligne SANS `owner`, `sbHeaders` mettait la clé publique et la
  //    cible retombait sur `id` / `vinted_user_id` — qu'aucun index unique ne
  //    porte une fois cloisonnée ⇒ 400 à coup sûr, une requête pour rien. Et la
  //    session était relue pour CHAQUE ligne puis pour l'en-tête : un
  //    renouvellement en route envoyait `owner` d'un côté et la clé publique de
  //    l'autre. Une seule lecture ⇒ une seule identité pour tout l'envoi.
  //    Une session est désormais obligatoire, même si le schéma est inconnu.
  const envoyer = async () => {
    const s = await authToken();
    if (!(s && s.access_token && s.user_id)) return 'sans_session';
    if(ownerAttendu!=null&&String(s.user_id)!==String(ownerAttendu))return 'sans_session';
    const owned = list.map((r) => Object.assign({}, r, { owner: s.user_id }));
    let target = onConflict;
    if (table === 'app_data' && onConflict === 'id') target = 'owner,id';
    if (table === 'vinted_accounts' && onConflict === 'vinted_user_id') target = 'owner,vinted_user_id';
    return fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${target}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${(s && s.access_token) || SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(owned),
    });
  };
  let statut = 'reseau';
  try {
    let res = await envoyer();
    if (res === 'sans_session') throw Object.assign(new Error('sans_session'), { statut: 'sans_session' });
    // ⚠️ UN SEUL nouvel essai, et SEULEMENT après un 401 sur une base
    //    cloisonnée dont la session vient d'être renouvelée : un 401 veut dire
    //    « la base a refusé AVANT d'écrire » (jeton périmé), donc rejouer ne peut
    //    pas écrire deux fois — et l'upsert fusionne de toute façon sur l'id.
    //    Aucun nouvel essai sur un 5xx / réseau : l'écriture a pu passer, et la
    //    rejouer à l'aveugle n'est pas notre affaire ici (l'appelant réessaie au
    //    cycle suivant, avec une donnée fraîche).
    if (res.status === 401 && await isCloisonne()) {
      const s2 = await renouvelerUneFois();
      if (s2 && s2.access_token) res = await envoyer();
      if (res === 'sans_session') throw Object.assign(new Error('sans_session'), { statut: 'sans_session' });
    }
    if (res.ok) {
      // La base a pris une ligne de CAPTURE : elle répond — le recul tombe
      // (`effacerReculBase`). Jamais sur une ligne de diagnostic ou de réglage,
      // qui peut passer quand les captures, elles, sont refusées.
      if (table === 'app_data' && list.some((r) => r && RE_LIGNE_CAPTURE.test(String(r.id || '')))) await effacerReculBase();
      return true;
    }
    statut = String(res.status || 'inconnu');
  } catch (e) { statut = (e && e.statut) || 'reseau'; }
  // ⚠️ JAMAIS `await` ici : `viderTampon` écrit lui-même par `supabaseUpsert`
  //    depuis la chaîne du tampon — attendre `noterDiag` l'y bloquerait.
  try { noterDiag(`ecriture_ratee_${familleEcriture(table, list)}_${statut}`); } catch (_) {}
  _statutDernierRefus = statut;
  return false;
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
// ⛔ (5.180, 16 octobre) UN COMPTE SUPPRIMÉ DÉFINITIVEMENT N'EST PLUS CAPTÉ DU
//    TOUT — Julien : « quand on supprime les annonces d'un compte, ça doit
//    supprimer vraiment ; dans la recherche il y a encore les annonces de
//    Shopcancale ». Mesuré : une visite du 19 septembre sur ce compte (pour le
//    diagnostic d'export) avait réécrit son dressing, ses ventes et sa boîte.
//    Avant, `vrm_blocked_accounts` ne gardait que les JETONS ; il garde
//    maintenant toutes ses lignes. Liste illisible ⇒ « pas su » ⇒ on capte
//    comme avant (sur-exclure couperait un compte vivant sur un hoquet).
async function compteSupprime(uid) {
  if (uid == null) return false;
  const l = await blockedAccounts();
  if (!(l && l.has(String(uid)))) return false;
  // Réautorisé depuis l'app (`panel_accounts_off[uid] === false`) : il revit.
  const r = await unblockedAccounts();
  return !!(r && !r.has(String(uid)));
}
// ── CONFIRMER LE BON COMPTE VINTED (5.191, 19 octobre) ───────────────────────
// Julien : « à l'installation de l'extension, confirmer le bon compte Vinted ».
// La petite carte (vrm-badge.js) demande UNE fois, pour chaque compte Vinted vu
// dans le cookie : « c'est bien un de tes comptes à capter ? ». Le choix vit
// dans `chrome.storage.local` (ce Chrome ; §4.9 : jamais une variable de module).
// · « non » ⇒ ce compte n'est plus capté du tout (comme un compte supprimé :
//   ni dressing, ni ventes, ni messages, ni jetons), jusqu'à ce qu'il change
//   d'avis depuis la carte ;
// · pas encore répondu, ou stockage illisible ⇒ « pas su » ⇒ on capte COMME
//   AVANT (une nouveauté n'éteint pas ce qui marchait) ;
// · la carte ne demande que si elle sait NOMMER le compte (login lu dans la
//   base ou dans la réponse `users/current` déjà reçue) — jamais deviné.
const CHOIX_COMPTES = 'vrmChoixComptes';
const LOGINS_VUS = 'vrmLoginsVus';
async function lireChoixComptes() {
  try { const s = await chrome.storage.local.get(CHOIX_COMPTES); const m = s && s[CHOIX_COMPTES]; return m && typeof m === 'object' ? m : {}; }
  catch (_) { return null; }
}
async function choixCompte(uid) {
  if (uid == null) return null;
  const m = await lireChoixComptes();
  const c = m && m[String(uid)];
  return c && (c.choix === 'oui' || c.choix === 'non') ? c.choix : null;
}
async function compteRefuse(uid) { return (await choixCompte(uid)) === 'non'; }
async function comptesRefuses() {
  const m = await lireChoixComptes();
  return new Set(Object.keys(m || {}).filter((k) => m[k] && m[k].choix === 'non'));
}
// La porte de toute capture : refusé dans ce Chrome, OU supprimé définitivement.
async function compteNonCapte(uid) {
  if (uid == null) return false;
  if (await compteRefuse(uid)) { noterDiag('ignore_compte_refuse'); return true; }
  return compteSupprime(uid);
}
let _choixChaine = Promise.resolve();
function noterChoixCompte(uid, choix, login) {
  const p = _choixChaine.then(async () => {
    const m = await lireChoixComptes();
    if (m === null) return false;                       // pas su : on n'écrase rien
    m[String(uid)] = { choix, login: String(login || ''), at: Date.now() };
    try { await chrome.storage.local.set({ [CHOIX_COMPTES]: m }); return true; } catch (_) { return false; }
  }).catch(() => false);
  _choixChaine = p.then(() => {}, () => {});
  return p;
}
// Le login lu dans `users/current` (la réponse que la page a déjà reçue) : sert
// à NOMMER le compte dans la question, avant même qu'il soit dans la base.
async function noterLoginVu(uid, json) {
  try {
    const u = json && (json.user || json);
    const login = u && typeof u.login === 'string' ? u.login.trim() : '';
    if (!uid || !login) return;
    const s = await chrome.storage.local.get(LOGINS_VUS);
    const m = (s && s[LOGINS_VUS]) || {};
    if (m[String(uid)] && m[String(uid)].login === login) return;
    m[String(uid)] = { login, at: Date.now() };
    await chrome.storage.local.set({ [LOGINS_VUS]: m });
  } catch (_) {}
}
async function loginVu(uid) {
  try { const s = await chrome.storage.local.get(LOGINS_VUS); const e = s && s[LOGINS_VUS] && s[LOGINS_VUS][String(uid)]; return (e && e.login) || ''; }
  catch (_) { return ''; }
}

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
    // 5.197 : un compte refusé/supprimé n'est plus « déjà écrit » — réautorisé,
    // sa ligne repart tout de suite (pas dans 30 min).
    const m = (await chrome.storage.local.get('vrmCompteEcrit')).vrmCompteEcrit || {};
    if (m[String(uid)]) { delete m[String(uid)]; await chrome.storage.local.set({ vrmCompteEcrit: m }); }
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
  // 5.191 : « Non, ignorer ce compte » dans la carte — ses jetons ne partent
  // pas (on n'efface rien : c'est un choix de CE Chrome, réversible d'un clic).
  if (await compteRefuse(uid)) { await noterRefus(uid, domain, 'refuse'); return null; }
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
  // ⚠️⚠️ 20 octobre (5.197) — UNE ÉCRITURE PAR CHANGEMENT, PAS PAR REQUÊTE.
  //    Mesuré en production (journaux du 20 octobre) : jusqu'à 90 écritures de
  //    `vinted_accounts` PAR MINUTE, 687 en 73 min. Chaque requête de la page
  //    Vinted portant un `x-csrf-token` envoie un message `csrf` → ici → la
  //    ligne entière réécrite, jetons identiques. On n'écrit que si les jetons
  //    (ou le csrf) ont CHANGÉ, ou une fois toutes les 30 min au plus.
  //    L'empreinte vit dans `chrome.storage.local` (§4.9) ; perdue, elle ne
  //    coûte qu'une écriture de plus. Elle n'est posée qu'après une écriture
  //    RÉUSSIE : un refus de la base fait réessayer à la requête suivante.
  const sig = empreinteCompte(row);
  if (await compteDejaEcrit(uid, sig)) { noterDiag('compte_inchange'); return uid; }
  const ok = await supabaseUpsert('vinted_accounts', [row], 'vinted_user_id');
  if (ok !== false) await noterCompteEcrit(uid, sig);
  return uid;
}

const COMPTE_REECRIT_MS = 30 * 60 * 1000;
// Empreinte courte (FNV-1a 32 bits) : on ne garde JAMAIS un jeton en clair
// dans le stockage de l'extension pour cette comparaison.
function empreinteCompte(row) {
  const s = [row.vinted_user_id, row.domain, row.access_token, row.refresh_token, row.anon_id, row.csrf_token || ''].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16) + ':' + s.length;
}
async function compteDejaEcrit(uid, sig) {
  try {
    const m = (await chrome.storage.local.get('vrmCompteEcrit')).vrmCompteEcrit || {};
    const e = m[String(uid)];
    return !!(e && e.sig === sig && Date.now() - Number(e.at || 0) < COMPTE_REECRIT_MS);
  } catch (_) { return false; }                    // pas su : on écrit (comme avant)
}
async function noterCompteEcrit(uid, sig) {
  try {
    const m = (await chrome.storage.local.get('vrmCompteEcrit')).vrmCompteEcrit || {};
    m[String(uid)] = { sig, at: Date.now() };
    await chrome.storage.local.set({ vrmCompteEcrit: m });
  } catch (_) {}
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
  // ⚠️ 5.165 : la version ÉCRITE DANS LE CODE, à côté de celle du manifeste.
  //    Mesuré le 9 octobre : des sessions qui écrivaient `ver = 5.164.0`
  //    envoyaient des requêtes que seul un `background.js` d'avant la 5.134
  //    sait former. Copie partielle (manifeste neuf, code ancien) ou deux
  //    extensions sous la même session ? On n'a pas pu trancher. Les deux
  //    nombres côte à côte le diront la prochaine fois (`audit-extension-zip`
  //    exige qu'ils soient égaux dans le zip livré).
  const okDiag = await supabaseUpsert('app_data', [{ id: 'panel_diag_capture', data: {
    ...tout, n, rates: { ...(tout.rates || {}), ...(buf.rates || {}) }, majAt: new Date().toISOString(),
    ...(ver ? { ver, verAt: new Date().toISOString() } : {}), verCode: CODE_VERSION,
  } }], 'id');
  // ⚠️ LE TITRE DE CETTE FONCTION LE DISAIT, LE CODE NE LE FAISAIT PAS : le
  //    tampon était vidé même quand l'écriture avait échoué — les compteurs d'un
  //    tour partaient avec elle. On ne vide que ce qui est arrivé en base.
  if (okDiag === false) return;
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
// ⚠️⚠️ 5.165 — « LISTE COMPLÈTE DEVENUE PLUS COURTE » N'EST PAS « PAGE PARTIELLE ».
//    Julien, 9 octobre : « je viens de supprimer beaucoup de paires et elles
//    sont encore marquées dans les annonces ». Une annonce SUPPRIMÉE disparaît
//    du dressing (mesuré : 10010415608 d'angeled92, absente de la lecture
//    suivante) — et un compte dont il supprime TOUT rend `items: []`,
//    `total_entries: 0`. `listePlusRiche` (total > 0 exigé) et `plein()`
//    refusaient ce vide POUR TOUJOURS : le compte restait figé sur ses
//    anciennes annonces, toutes affichées « en ligne » (prouvé au banc).
//    Ce qui sépare une liste complète d'une page partielle, c'est ce que la
//    moisson ACTIVE sait et qu'une page captée en passant ignore : elle a lu
//    TOUTES les pages, sans un échec, jusqu'à la dernière que Vinted annonce
//    (`opts.complet`). Elle fait alors foi — y compris vide —
//      · si Vinted donne un total, il doit être ATTEINT (sinon sa pagination se
//        contredit : 96 articles lus pour 150 annoncés, c'est une page qui
//        manque, et §4.2 reste vrai) ;
//      · sans total, une liste VIDE n'est jamais une preuve (§4.1).
//    ⚠️ La capture PASSIVE (`storeHarvest`) n'a jamais `complet` : une page 1
//    de 20 annonces n'écrase toujours pas un dressing de 61.
function dressingCompletFaitFoi(parsed, opts) {
  if (!(opts && opts.complet === true)) return false;
  const items = parsed && Array.isArray(parsed.items) ? parsed.items : null;
  if (!items) return false;
  const pg = parsed.pagination || {};
  const total = Number(pg.total_entries);
  if (pg.total_entries != null && pg.total_entries !== '' && isFinite(total)) return items.length >= total;
  return items.length > 0;
}
// ⚠️⚠️ REVUE DE LA 5.165 — « PAS SU » NE VAUT PAS « ON ÉCRIT » (§4.1, §4.2).
//    La lecture du compteur ratée (522, réseau, une réponse qui n'est pas un
//    tableau) rendait `true` : « on ne sait pas → on écrit ». Prouvé au banc
//    (lecture KO, écriture OK — le cas qui détruit) : la page 1 du dressing,
//    20 annonces sur 61, ÉCRASAIT la liste complète, et depuis la 5.165 avec un
//    `capturedAt` rajeuni — la liste tronquée se présentait comme fraîche et
//    complète. Trois états désormais : `true` on écrit · `false` plus pauvre ·
//    `null` PAS SU (on n'écrit pas ; l'appelant le compte à part). On n'écrit
//    sans comparer que sur une capture complète, ou quand la base dit qu'il n'y
//    a pas encore de ligne (ou une ligne sans compteur).
async function listePlusRiche(rowId, parsed, cle) {
  const n = ((parsed && parsed[cle]) || []).length;
  const total = Number(parsed && parsed.pagination && parsed.pagination.total_entries);
  if (isFinite(total) && total > 0 && n >= total) return true;   // capture complète : fait foi
  const passu = () => { noterDiag('ignore_partiel_lecture_ratee'); return null; };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${rowId}&select=n:data->>nItems`, { headers: await sbHeaders() });
    if (!r.ok) return passu();                    // pas su : on n'écrase rien
    const j = await r.json();
    if (!Array.isArray(j)) return passu();        // un 522 Cloudflare rend du HTML
    if (!j.length) return true;                   // aucune ligne encore : on écrit
    const avant = Number(j[0] && j[0].n);
    if (j[0].n == null || !isFinite(avant)) return true;   // ancienne ligne sans compteur → on écrit
    return n >= avant;                            // jamais plus pauvre qu'avant
  } catch (_) { return passu(); }
}

// ══ LA BOÎTE DE RÉCEPTION SE FUSIONNE, ELLE NE SE COMPTE PAS (5.162) ═══════
// MESURÉ le 6 octobre sur sa base : deux comptes avaient leur boîte figée sur
// une page ANCIENNE — `24602614` sur la page 5 (dernière conversation captée le
// 27 juillet, dernière vente le 2 octobre), `3156028798` sur la page 3
// (25 août / 5 octobre). Cause : `listePlusRiche` ne compare que des NOMBRES.
// Quand il fait défiler sa messagerie, la page charge les pages 2…6 (50
// conversations chacune) et la plus profonde est rangée ; la page 1 fraîche
// (30 conversations, moisson active) est ensuite refusée comme « plus
// pauvre ». La boîte ne bougeait plus — et la messagerie de l'app non plus.
// ⇒ Pour la boîte, on FUSIONNE par identifiant de conversation :
//   · une réponse `current_page === 1` met à jour le HAUT de la liste (ses
//     conversations remplacent celles qu'on avait, non lues comprises) ;
//   · une page plus profonde ne fait que COMPLÉTER (une conversation absente
//     s'ajoute ; une présente n'est remplacée que si elle est plus récente) ;
//   · triée par `updated_at`, bornée aux 300 plus récentes ;
//   · même forme rangée `{ pagination, conversations }` pour tous les lecteurs.
// ⚠️ « Rien lu ne vaut pas rien » : si la ligne en base n'a pas pu être lue, on
//    n'écrit PAS (une page 1 seule écraserait les 300 conversations gardées —
//    la famille lire-fusionner-réécrire, `audit-fusion`). Et une réponse VIDE
//    n'est jamais une réponse (§4.1) : rien n'est écrit.
const INBOX_MAX = 300;
function pageDeInbox(p) {
  const pg = p && p.pagination;
  const n = Number(pg && (pg.current_page != null ? pg.current_page : pg.page));
  return isFinite(n) && n > 0 ? n : null;
}
const tsConversation = (c) => { const t = Date.parse((c && c.updated_at) || ''); return isNaN(t) ? 0 : t; };
function fusionnerInbox(avant, neuf) {
  const convsN = (neuf && Array.isArray(neuf.conversations)) ? neuf.conversations : [];
  const convsA = (avant && Array.isArray(avant.conversations)) ? avant.conversations : [];
  const haut = pageDeInbox(neuf) === 1;
  const par = new Map();
  for (const c of convsA) if (c && c.id != null) par.set(String(c.id), c);
  for (const c of convsN) {
    if (!c || c.id == null) continue;
    const k = String(c.id), a = par.get(k);
    if (haut || !a || tsConversation(c) > tsConversation(a)) par.set(k, c);
  }
  const conversations = [...par.values()].sort((x, y) => tsConversation(y) - tsConversation(x)).slice(0, INBOX_MAX);
  // La pagination dit d'où vient le HAUT de la liste : celle de la page 1 quand
  // elle arrive, sinon on garde celle qu'on avait (une page 5 ne la remplace pas).
  const pagination = (haut || !convsA.length || !(avant && avant.pagination))
    ? ((neuf && neuf.pagination) || (avant && avant.pagination) || null)
    : avant.pagination;
  return { pagination, conversations };
}
// Lit la boîte rangée et rend la fusion — `null` si la lecture a échoué
// (« pas su » : l'appelant n'écrit pas).
async function inboxFusionnee(rowId, neuf) {
  const rows = await sbGet(`app_data?id=eq.${encodeURIComponent(rowId)}&select=pg:data->payload->pagination,cv:data->payload->conversations`);
  if (rows === null) return null;
  const r0 = rows[0] || null;
  const avant = r0 ? { pagination: r0.pg || null, conversations: Array.isArray(r0.cv) ? r0.cv : [] } : null;
  return fusionnerInbox(avant, neuf);
}

// Les pages d'un même fil se réunissent par identité de message.
// BEGIN CONVERSATION PARTAGEE
function fusionnerConversation(avant, neuf) {
  const a = avant && (avant.conversation || avant), n = neuf && (neuf.conversation || neuf);
  if (!n || !Array.isArray(n.messages)) return null;
  if (a?.id != null && n.id != null && String(a.id) !== String(n.id)) return null;
  const messages = [], index = new Map();
  for (const m of [...(Array.isArray(a?.messages) ? a.messages : []), ...n.messages]) {
    if (!m || typeof m !== 'object') continue;
    const id = m.id ?? m.entity?.id;
    const cle = id == null || String(id).trim() === '' ? null : String(m.entity_type || '') + ':' + String(id);
    if (cle != null && index.has(cle)) { const i = index.get(cle); messages[i] = { ...messages[i], ...m, ...(m.entity ? { entity: { ...(messages[i].entity || {}), ...m.entity } } : {}) }; }
    else { if (cle != null) index.set(cle, messages.length); messages.push(m); }
  }
  const ts = m => { const v = m.created_at_ts ?? m.entity?.created_at_ts ?? m.created_at ?? m.entity?.created_at; const num = Number(v); return v == null ? 0 : Number.isFinite(num) ? (num < 1e12 ? num * 1000 : num) : (Date.parse(v) || 0); };
  messages.sort((x,y) => ts(x) - ts(y));
  const conversation = { ...(a || {}), ...n, messages };
  return neuf.conversation ? { ...neuf, conversation } : conversation;
}
// END CONVERSATION PARTAGEE

async function conversationFusionnee(rowId, neuf) {
  const rows = await sbGet(`app_data?id=eq.${encodeURIComponent(rowId)}&select=p:data->payload`);
  if (rows === null) return null;
  return fusionnerConversation(rows[0]?.p || null, neuf);
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
  // le coffre ET la capture photo passive (Leboncoin/eBay) lisent (p.item||p).photos
  item:         { objet: (p) => (p.item || p), champ: 'photos', ok: (o) => Array.isArray(o.photos) },
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

// ⚠️⚠️ 19 octobre (5.193) — UN REFUS DE VINTED N'EST PAS UNE CAPTURE. Mesuré chez
//    Julien : `forme_inconnue_champ_conversation` ×246 avec
//    `cles=[code,message,message_code]` — le corps d'une réponse d'ERREUR de
//    Vinted (conversation introuvable, accès refusé…) jugé comme une
//    conversation dont `messages` aurait été renommé : fausse alerte « Format
//    d'un site » dans Réglages, et `conversation_lecture_ou_forme_ratee` ×206.
//    Vinted met `code: 0` sur une réponse réussie ; un `code` non nul AVEC un
//    `message_code` est un refus. On le compte pour ce qu'il est, on ne range
//    rien, on ne juge aucune forme. Un profil d'erreur n'apprenait rien non plus
//    (« banni » exige `is_account_banned === true`).
function estErreurVinted(p) {
  return !!(p && typeof p === 'object' && !Array.isArray(p)
    && typeof p.message_code === 'string' && typeof p.code === 'number' && p.code !== 0);
}

async function storeHarvest(domain, type, id, body) {
  noterDiag(`recu_${type || 'inconnu'}`);
  const uid = await activeAccountId(domain);
  if (!uid) { noterDiag(`abandon_sans_compte_${type || 'inconnu'}`); return; }
  if (await compteNonCapte(uid)) { noterDiag('ignore_compte_supprime'); return; }
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
  if (estErreurVinted(parsed)) { noterDiag(`ignore_erreur_vinted_${type || 'inconnu'}`); return; }
  // Le corps a parsé : la clé de liste attendue est-elle toujours là ? (sentinelle
  // de dérive de forme, sur le BRUT, avant tout allègement qui pourrait la masquer).
  verifFormeListe(type, parsed, id);
  verifFormeObjet(type, parsed, id);   // transaction/conversation : un champ lu renommé
  if (type === 'profile') { try { await noterEtatCompte(uid, parsed); } catch (_) {} noterLoginVu(uid, parsed); }   // 5.181 : actif / banni ; 5.191 : le login, pour nommer le compte

  // ⚠️⚠️ 5.165 — LE DRESSING D'UN AUTRE MEMBRE N'EST JAMAIS LE SIEN (§5).
  //    `/wardrobe/{id}/items` passe par ici quel que soit `{id}` : ouvrir le
  //    dressing d'un vendeur concurrent (ou d'un acheteur) rangeait SES annonces
  //    sous le compte du cookie — prouvé au banc (`audit-moisson-dressing`,
  //    15 annonces d'un inconnu dans `harvest_A_listings`). On ne range que le
  //    dressing dont l'id est le PROFIL du compte connecté. Profil pas lu ou
  //    pas encore rangé : on ne range pas (un dressing manqué se rattrape à la
  //    visite suivante ; le dressing d'un autre affiché comme le sien, non).
  if (type === 'listings') {
    const pid = await profilIdRange(uid);
    if (pid === null) { noterDiag('ignore_dressing_profil_pas_lu'); return; }
    if (!pid || id == null || String(id) !== pid) { noterDiag('ignore_dressing_autre_membre'); return; }
  }

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
  // ⚠️ SAUF LA BOÎTE DE RÉCEPTION (5.162) : elle se FUSIONNE par identifiant de
  // conversation (`fusionnerInbox`) — comparer des nombres la figeait sur une
  // page ancienne.
  if (type === 'inbox') {
    if (!((parsed && parsed.conversations) || []).length) { noterDiag('ignore_inbox_vide'); return; }
    const f = await inboxFusionnee(rowId, parsed);
    if (f === null) { noterDiag('inbox_lecture_ratee'); return; }   // pas su : on n'écrase rien
    parsed = f;
  } else if (type === 'conversation') {
    const f = await conversationFusionnee(rowId, parsed);
    if (f === null) { noterDiag('conversation_lecture_ou_forme_ratee'); return; }
    parsed = f;
  } else if (CLE_LISTE[type]) {
    const riche = await listePlusRiche(rowId, parsed, CLE_LISTE[type]);
    if (riche === null) return;                   // compteur illisible : pas su, on n'écrase rien (déjà noté)
    if (!riche) { noterDiag(`ignore_partiel_${type}`); return; }
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
  if (type === 'orders_sold' && data.resume) { try { data.resume = retirerDuResume(data.resume, await transactionsQuiNeSExpedientPlus(uid)); } catch (_) {} }
  const ecrit = await supabaseUpsert('app_data', [{ id: rowId, data }], 'id');
  // Dernière sortie muette possible : l'écriture elle-même. On la mesure aussi,
  // sinon « rien en base » resterait indiscernable de « jamais reçu ».
  noterDiag(`${ecrit === false ? 'ecriture_ratee' : 'ecrit'}_${type || 'inconnu'}`);
  noterFlux('vinted', ecrit !== false);
  // Des ventes viennent d'être rangées : l'app ouverte les relit TOUT DE SUITE
  // (« presque instantanément dès que je fais une vente », 2 octobre).
  if (ecrit !== false && type === 'orders_sold') notifierApp({ type: 'maj', quoi: 'ventes', uid: String(uid) });
  // Même chose pour les ACHATS (4 octobre) : un colis qui passe « déposé en point
  // relais » est vu ici en premier — l'app ne le voyait qu'à sa relecture
  // suivante. Seulement si l'écriture a ABOUTI : prévenir sur un échec ferait
  // relire une ligne qui n'a pas bougé.
  if (ecrit !== false && type === 'orders_purchased') notifierApp({ type: 'maj', quoi: 'achats', uid: String(uid) });
  // 5.165 : un dressing RANGÉ fait foi sur les suppressions d'avant (règle
  // `supprimeeApres`) et rajeunit « annonces lues il y a… » : l'app relit.
  if (ecrit !== false && type === 'listings') notifierApp({ type: 'maj', quoi: 'annonces', uid: String(uid) });
  if (ecrit !== false && (type === 'inbox' || type === 'conversation')) notifierApp({ type: 'maj', quoi: 'messages', uid: String(uid), ...(type === 'conversation' ? {conv:String(id)} : {}) });

  // Apprentissage passif des codes de statut d'offre (voir noterStatutsOffres).
  if (type === 'conversation') { try { await noterStatutsOffres(parsed); } catch (_) {} }
  // Une conversation vient d'arriver → si elle porte le message « ton colis est
  // arrivé », on en sort l'adresse du relais et le CODE de retrait tout de
  // suite. C'est le moment où on les a sous la main, et c'est la seule source
  // pour Vinted Go (aucun email ne les porte).
  if (type === 'conversation') {
    try { const r = retraitDeConversation(parsed); if (r) await noterRetrait(r, uid); } catch (_) {}
    // 5.204 : une conversation captée en passant dit aussi si une confirmation
    // (« Tout est OK ») attend — ou si elle est réglée (l'entrée sort).
    try { const c = confirmationDeConversation(parsed); if (c) await noterConfirmation(c, uid); } catch (_) {}
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
  // Navigateur sans `alarms` (Orion iPhone) : chaque réveil rattrape les
  // tâches périodiques en retard (iOS a pu suspendre le fond entre-temps).
  if (!CAP.alarms) rattraperMinuteries();
  // Navigateur sans API `cookies` : la page Vinted donne les siens (voir
  // `recevoirCookiesPage`). Sur Chrome, `veux` répond non et rien d'autre ne part.
  if (msg && msg.from === 'vrm-cookies') {
    if (msg.action === 'veux') { sendResponse({ ok: true, veux: !CAP.cookies }); return true; }
    recevoirCookiesPage(msg, sender).then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  }
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
      // Depuis la CARTE (un iframe dans l'onglet du site) : c'est le service
      // worker qui ouvre VRM après la connexion. La carte se referme dès que la
      // session change, AVANT d'avoir reçu cette réponse : elle n'ouvrait VRM
      // que 45 fois sur 50 (mesuré, 11 octobre).
      authLogin(msg.email, msg.password).then((r) => {
        if (r && r.ok && msg.ouvrir && sender && sender.tab) ouvrirVRMDepuis(sender.tab.url || '');
        sendResponse(r);
      });
      return true;
    }
    // « Se connecter avec VRM » : ouvre l'app, qui connecte l'extension.
    // Le logo des sites (vrm-badge) aussi : il ouvre VRM à chaque fois (11 octobre).
    if (msg && (msg.from === 'cancale-popup' || msg.from === 'vrm-badge') && msg.action === 'lierAvecVRM') {
      lierAvecVRM((sender && sender.tab && sender.tab.url) || msg.urlActive || '').then(sendResponse, () => sendResponse({ ok: false }));
      return true;
    }
    // La version du CODE qui tourne (la page de réparation la compare au
    // manifeste — un code plus ancien que le manifeste ne connaît pas ce
    // message, et c'est justement ce qui le trahit).
    if (msg && msg.from === 'cancale-popup' && msg.action === 'codeVersion') {
      sendResponse({ ok: true, code: CODE_VERSION }); return true;
    }
    if (msg && msg.from === 'cancale-popup' && msg.action === 'authLogout') {
      authLogout().then(sendResponse); return true;
    }
    // LA PETITE CARTE (vrm-badge.js) : son état, et « ouvrir VRM ». Le site est
    // celui de l'ONGLET qui demande (sender.tab), jamais ce que dit le message.
    if (msg && msg.from === 'vrm-badge' && msg.action === 'etat') {
      etatSite(sender && sender.tab && sender.tab.url,sender?.tab?.id).then(sendResponse, () => sendResponse({ ok: false }));
      return true;
    }
    // 5.191 : « Oui, capter ce compte » / « Non, ignorer ce compte ». Seulement
    // pour le compte du COOKIE de l'onglet qui demande (jamais un autre compte
    // nommé par le message) — c'est la règle « garde » de l'extension.
    if (msg && msg.from === 'vrm-badge' && msg.action === 'choixCompte') {
      (async () => {
        const choix = msg.choix === 'oui' ? 'oui' : msg.choix === 'non' ? 'non' : null;
        if (!choix) return { ok: false, raison: 'invalide' };
        let dom = ''; try { dom = new URL(sender && sender.tab && sender.tab.url).hostname; } catch (_) {}
        if (!/(^|\.)vinted\.[a-z.]+$/.test(dom)) return { ok: false, raison: 'site' };
        const uid = await compteConnecte(dom);
        if (!uid || String(uid) !== String(msg.uid || '')) return { ok: false, raison: 'compte' };
        const login = (await loginDe(String(uid), { attendreMs: 0 })) || (await loginVu(String(uid)));
        const ok = await noterChoixCompte(String(uid), choix, login);
        if (!ok) return { ok: false, raison: 'stockage' };
        if (choix === 'oui') { await oublierRefus(uid); captureDomain(dom).catch(() => {}); }
        logActivity(choix === 'oui' ? `✅ Compte ${login || uid} confirmé : il est capté` : `🚫 Compte ${login || uid} ignoré : plus rien n'est capté pour lui dans ce Chrome`);
        notifierApp({ type: 'maj', quoi: 'comptes' });
        return { ok: true, choix };
      })().then(sendResponse, () => sendResponse({ ok: false, raison: 'erreur' }));
      return true;
    }
    if (msg && (msg.from === 'vrm-badge' || msg.from === 'cancale-popup') && msg.action === 'ouvrirVRM') {
      // La carte de connexion vit dans un iframe de l'onglet : sender.tab est
      // l'onglet du site, c'est lui qui décide l'onglet de VRM.
      ouvrirVRMDepuis((sender && sender.tab && sender.tab.url) || '');
      sendResponse({ ok: true });
      return true;
    }
    // (5.165 : `syncNow` — sans appelant depuis la 5.130 — est retiré avec
    //  `activeFetchAll`, le balayage de tous les comptes, voir plus bas.)
    // SESSION DU VENDEUR : relayee par bridge.js depuis l'app connectee.
    // On ne l'accepte QUE d'un onglet de l'app elle-meme (verification de
    // l'origine de l'expediteur) — sinon n'importe quel site pourrait nous
    // refiler un jeton et ecrire sous le compte de quelqu'un d'autre.
    // L'app demande l'état de la session côté extension (pour l'afficher).
    // Même contrôle d'origine : un site quelconque n'a pas à savoir sous quelle
    // adresse tu es connecté.
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'authEtat') {
      const src = (sender && sender.origin) || (sender && sender.url) || '';
      if (!ORIGINE_APP.test(src)) {
        sendResponse({ ok: false, error: 'origine non autorisee' }); return true;
      }
      authEtat().then(sendResponse);
      return true;
    }
    // ⚠️⚠️ PLUS AUCUNE SESSION PAR LA PAGE (11 octobre). `window.postMessage`
    //    est entendu par TOUTE extension de la page : une copie ancienne restée
    //    à côté adoptait la même session (une famille de jetons pour deux, qui
    //    finit révoquée), et un `session: null` posté par une app dont la session
    //    venait de mourir faisait oublier à l'extension la sienne, saine. La
    //    session arrive maintenant ADRESSÉE, avec un nonce (`onMessageExternal`,
    //    plus haut). Ce relais-ci est refusé, et le dit.
    // ══ LA LIAISON PAR LE PONT (5.188 — Firefox, et tout navigateur sans
    // `externally_connectable`) ══════════════════════════════════════════
    // Firefox ne connaît pas le canal adressé de Chrome : l'app ne peut pas
    // appeler `chrome.runtime.sendMessage(<identifiant>, …)`. Elle passe donc
    // par le pont de SA page, et le message reste ADRESSÉ : bridge.js ne le
    // relaie que s'il nomme l'identifiant de CETTE extension (une copie
    // ancienne à côté, qui a un autre identifiant ou ne connaît pas ce message,
    // n'entend rien). Ici : la même origine exigée, les MÊMES trois fonctions
    // que le canal adressé (nonce de 2 min, une seule fois, compte annoncé) —
    // aucune règle de plus, aucune de moins.
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'adresse') {
      const src = (sender && sender.origin) || (sender && sender.url) || '';
      if (!ORIGINE_APP.test(src)) { sendResponse({ ok: false, code: 'origine' }); return true; }
      const m = msg.msg;
      if (!m || typeof m !== 'object') { sendResponse({ ok: false, code: 'invalide' }); return true; }
      (async () => {
        try {
          if (m.type === 'liaison') { sendResponse(await demanderLiaison(m)); return; }
          if (m.type === 'session') { sendResponse(await recevoirSessionAdressee(m)); return; }
          if (m.type === 'deconnexion') { sendResponse(await deconnexionAdressee(m)); return; }
          if (m.type === 'code') { let ext = ''; try { ext = String(chrome.runtime.id || ''); } catch (_) {} sendResponse({ ok: true, code: CODE_VERSION, ext }); return; }
          sendResponse({ ok: false, code: 'inconnu' });
        } catch (e) { sendResponse({ ok: false, code: 'erreur' }); }
      })();
      return true;
    }
    if (msg && msg.from === 'vmr-bridge' && msg.action === 'session') {
      sendResponse({ ok: false, code: 'canal', error: 'la session passe par le canal adressé (5.171)' });
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
          if (msg.action === 'numeroPourPublier') { sendResponse(await reserverNumeroPourOnglet(sender && sender.tab ? sender.tab.id : null, msg.domain || 'www.vinted.fr')); return; }
          if (msg.action === 'numeros') {
            const m = await numerosPourAffichage();
            if (!m) { sendResponse({ ok: false }); return; }
            const pick = (src, ids) => { const o = {}; for (const id of (Array.isArray(ids) ? ids.slice(0, 400) : [])) if (src[String(id)]) o[String(id)] = src[String(id)]; return o; };
            sendResponse({ ok: true, items: pick(m.parItem, msg.items), convs: pick(m.parConv, msg.convs), txs: pick(m.parTx, msg.txs) }); return;
          }
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
    // ── VESTIAIRE COLLECTIVE : LA MESURE DU SITE (5.154) ─────────────────────
    // Des chemins, des noms de champs, des types — jamais une valeur (voir
    // vc-inject.js). On n'accepte que d'un onglet vestiairecollective.com.
    if (msg && msg.from === 'cancale-vc' && msg.action === 'vcRecon') {
      (async () => {
        try {
          let hote = ''; try { hote = new URL((sender && sender.tab && sender.tab.url) || '').hostname; } catch (_) {}
          if (!/(^|\.)vestiairecollective\.com$/i.test(hote)) { sendResponse({ ok: false }); return; }
          await storeVcRecon(msg.patch || {});
          sendResponse({ ok: true });
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

          if(msg.action==='lbcSessionPrivee'){
            const ownerReception=(await loadSession())?.user_id;
            if(!ownerReception){sendResponse({ok:false});return;}
            const compte=lireSessionPriveeLbc(msg.preuve,msg.url),tabId=sender?.tab?.id;
            if(!compte||tabId==null||sender?.frameId>0||!/^https:\/\/(?:[a-z0-9-]+\.)*leboncoin\.fr\//i.test(sender?.tab?.url||'')){sendResponse({ok:false});return;}
            const cartes=(await chrome.storage.local.get('vrmLbcTransport')).vrmLbcTransport||{},avant=cartes[tabId]||{};
            const ambigue=avant.source==='prive'&&(avant.ambigue===true||!!(avant.compte&&avant.compte!==compte.id));
            cartes[tabId]={...avant,source:'prive',compte:ambigue?'':compte.id,ambigue,at:Date.now()};
            await chrome.storage.local.set({vrmLbcTransport:Object.fromEntries(Object.entries(cartes).sort((a,b)=>b[1].at-a[1].at).slice(0,32))});
            if(ambigue){sendResponse({ok:false});return;}
            const ok=await storeLbcAccount(compte,ownerReception);sendResponse({ok});return;
          }
          if(msg.action==='lbcTransport'){
            const tabId=sender?.tab?.id;
            if(sender?.frameId>0||tabId==null||!/^https:\/\/(?:[a-z0-9-]+\.)*leboncoin\.fr\//i.test(sender?.tab?.url||'')){sendResponse({ok:false});return;}
            const avant=(await chrome.storage.local.get('vrmLbcTransport')).vrmLbcTransport||{};
            avant[tabId]={...(msg.capteur===true?avant[tabId]:{}),capteur:msg.capteur===true,at:Date.now()};
            for(const cle of ['capteurVersion','relaisVersion'])if(/^\d+\.\d+\.\d+$/.test(msg[cle]||''))avant[tabId][cle]=msg[cle];
            if(Object.prototype.hasOwnProperty.call(msg,'erreurCapture'))avant[tabId].erreurCapture=['identite','taille'].includes(msg.erreurCapture)?msg.erreurCapture:null;
            const recent=Object.fromEntries(Object.entries(avant).sort((a,b)=>b[1].at-a[1].at).slice(0,32));
            await chrome.storage.local.set({vrmLbcTransport:recent});sendResponse({ok:true});return;
          }
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
            // ⚠️⚠️ « C'EST DIFFÉRENT POUR CHAQUE ANNONCE » (Julien, 17 sept.) :
            //    les étapes du dépôt dépendent de la CATÉGORIE. Une clé qui ne
            //    porte que la structure ferait passer le formulaire d'un livre
            //    pour celui d'une paire de chaussures. La catégorie entre donc
            //    dans la clé, et l'étape garde son DÉPÔT et son RANG.
            // 11 octobre : l'étape part comme un MORCEAU (`etapeOne`) ; c'est le
            //    vidage regroupé de `lbc_recon` qui la fusionne à la ligne (et
            //    borne à 40 étapes) — plus de relecture entière à chaque étape.
            const cle = [String(msg.categorie || 'sans-categorie').slice(0, 40),
              String(msg.etape || msg.url || ('etape-' + Date.now()))].join(' :: ');
            await storeLbcRecon({
              form: { url: msg.url, fields: msg.fields, at: new Date().toISOString() },
              etapeOne: { cle, val: { url: msg.url, fields: msg.fields, selects: msg.selects || [],
                livraison: msg.livraison || [], fichiers: msg.fichiers || 0,
                fichiersMultiple: !!msg.fichiersMultiple, categorie: String(msg.categorie || ''),
                depot: String(msg.depot || ''), ordre: Number(msg.ordre) || 0,
                ver: String(msg.ver || ''),
                // 5.186 : les BOUTONS de l'étape (libellé de Leboncoin, borné) et
                // l'état coché des options payantes — pour voir où le dépôt cale
                // et vérifier qu'aucun boost n'est actif. Aucun contenu saisi.
                boutons: (Array.isArray(msg.boutons) ? msg.boutons : []).slice(0, 25).map((b) => ({ t: String((b && b.t) || '').slice(0, 50), prix: !!(b && b.prix), off: !!(b && b.off) })),
                optionsCochees: Number(msg.optionsCochees) || 0,
                at: new Date().toISOString() } },
            });
            sendResponse({ ok: true }); return;
          }
          // ⚠️ 11 octobre : un dépôt qui n'aboutit pas le DIT à l'app (arrêt à
          //    90 s, bandeau fermé). Son bouton restait « Publication en
          //    cours… » 15 minutes, sans un mot. L'onglet est retenu : un
          //    « Réessayer » le remet devant au lieu d'en ouvrir un second.
          if ((msg.action === 'depotArrete' || msg.action === 'depotRepris') && msg.id) {
            const jid = 'lbc:' + String(msg.id);
            const cur = (await lireCmds())[jid];
            if (cur && (cur.etape === 'depot' || cur.etape === 'abandonne')) {
              const tabId = sender && sender.tab ? sender.tab.id : cur.tabId;
              if (msg.action === 'depotArrete') await majCmd(jid, { etape: 'abandonne', raison: String(msg.raison || 'arret').slice(0, 30), tabId });
              else await majCmd(jid, { etape: 'depot', raison: null, tabId });
            }
            sendResponse({ ok: true }); return;
          }
          // 5.182 : l'avancement d'un dépôt lancé depuis l'app (étape, photos
          // posées N/M, champ obligatoire manquant). Seulement pour un dépôt EN
          // COURS de cette paire, et seulement depuis SON onglet quand on le
          // connaît — une autre page de dépôt ne parle pas à sa place.
          if (msg.action === 'depotProgres' && /^\d+$/.test(String(msg.id || ''))) {
            const jid = 'lbc:' + String(msg.id);
            const cur = (await lireCmds())[jid];
            const tabId = sender && sender.tab ? sender.tab.id : null;
            if (cur && cur.etape === 'depot' && (cur.tabId == null || tabId == null || cur.tabId === tabId)) await majCmd(jid, { progres: progresLbcSur(msg.progres) });
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'markPosted' && msg.id) {
            // ⚠️⚠️ Revue du 17 octobre : une marque RATÉE (lecture ou écriture de
            //    `vinted_lbc_posted`) laissait la paire PUBLIÉE dans la file, et
            //    « Publier » ouvrait un second dépôt qui publie tout seul — la
            //    paire deux fois sur Leboncoin. La commande garde la trace
            //    (`nonMarquee`) et `publierDepuisApp` ne relance pas sans elle.
            const marque = await markLbcPosted(msg.id);
            if (marque !== true) noterDiag('lbc_marque_ratee');
            // Publiée depuis une commande de l'app : l'app le sait tout de suite.
            const jid = 'lbc:' + String(msg.id);
            if ((await lireCmds())[jid]) await majCmd(jid, { etape: 'fait', nonMarquee: marque !== true ? true : null });
            notifierApp({ type: 'maj', quoi: 'lbc' });
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcCapture') {
            // Un objet du DOM, même avec un email, ne prouve pas la session.
            // Les listes privées passent par lbcRaw avec le compte du même document.
            sendResponse({ok:false,raison:'source-compte-non-confirmee'});return;
          }
          if (msg.action === 'lbcRaw' && msg.body) {
            if(/\/compte\/(?:part|pro)\/mes-annonces/i.test(String(msg.url))){try{const u=new URL(msg.url),t=new URL(sender.url||sender.tab?.url);if(sender.frameId>0||u.origin+u.pathname!==t.origin+t.pathname){sendResponse({ok:false});return;}}catch(_){sendResponse({ok:false});return;}}
            const r=await handleLbcRaw(msg.url,msg.body,msg.session);if(r&&(r.etat==='enregistre'||/\/adfinder\/v\d+\/myads\b|\/classifieds\/analysis\/list|\/compte\/(?:part|pro)\/mes-annonces/i.test(String(msg.url))))await noterReceptionLbc('annonces',r,sender);sendResponse(r||{ok:true,etat:'sans-annonce'});return;
          }
          // 22 oct. : une liste COMPLÈTE d'un vendeur (toutes les pages, total
          // atteint — prouvé par la page, voir lbc-inject.js). Seulement depuis le
          // cadre principal d'un onglet leboncoin.fr, et seulement pour un de SES
          // comptes : la liste d'un autre vendeur ne marque rien.
          if (msg.action === 'lbcListeComplete') {
            const tabUrl = (sender && sender.tab && sender.tab.url) || '';
            const owner = String(msg.owner || ''), total = Number(msg.total);
            const ids = Array.isArray(msg.ids) ? msg.ids.map(String) : null;
            if ((sender && sender.frameId > 0) || !/^https:\/\/(?:[a-z0-9-]+\.)*leboncoin\.fr\//i.test(tabUrl) || !/^[0-9a-f-]{8,64}$/i.test(owner)
              || !ids || !Number.isInteger(total) || total < 1 || ids.length !== total || new Set(ids).size !== total || ids.some((x) => !/^\d{1,15}$/.test(x))) { sendResponse({ ok: false }); return; }
            const miens = await comptesMiens();
            if (!miens.has(owner) && !miens.has('lbc-account:' + owner)) { noterDiag('lbc_liste_complete_autrui'); sendResponse({ ok: true }); return; }
            await noterListeLbcComplete(owner, ids, total);
            sendResponse({ ok: true }); return;
          }
          // LA VENTE LEBONCOIN : détail transaction / commande / livraison. On
          // range un échantillon capé par famille d'endpoint, pour voir la FORME
          // (où vivent l'état, l'acheteur, le bordereau) — sans rien analyser
          // encore. C'est une lecture de SES ventes (§3), rangée dans lbc_recon.
          // On garde une place par famille (pas par id) : la 100e vente n'écrase
          // pas la carte, elle la rafraîchit. Jamais dans une fixture (§6).
          if (msg.action === 'lbcVente' && msg.body) {
            const ownerReception=(await loadSession())?.user_id;
            if(!ownerReception){sendResponse({ok:false,etat:'ecriture-refusee'});return;}
            const corps=String(msg.body);
            if(/\/compte\/(?:part|pro)\/(?:transaction|mes-transactions)/i.test(String(msg.url))){try{const u=new URL(msg.url),t=new URL(sender.url||sender.tab?.url);if(sender.frameId>0||u.origin+u.pathname!==t.origin+t.pathname){sendResponse({ok:false});return;}}catch(_){sendResponse({ok:false});return;}}
            if(msg.coupe||new TextEncoder().encode(corps).length>200000){const r={ok:false,etat:'partiel'};await noterReceptionLbc('transactions',r,sender);sendResponse(r);return;}
            const compte=msg.session?await sessionDeListe(msg.session):null;
            if(msg.session&&!compte){sendResponse({ok:false,etat:'compte-non-confirme'});return;}
            const ventes=extraireVentesLbc(msg.url,corps);
            if(compte)for(const v of ventes){v.account=compte.id;v.accountName=compte.name||'';}

            if(!ventes.length){const r={ok:false,etat:'format-non-reconnu',nombre:0};await noterReceptionLbc('transactions',r,sender);sendResponse(r);return;}
            const ok=await rangerLbcVentes(ventes,ownerReception),r={ok:ok===true,etat:ok===true?'enregistre':'ecriture-refusee',nombre:ventes.length};await noterReceptionLbc('transactions',r,sender);sendResponse(r);storeLbcVente(msg.url,corps,false,ownerReception).catch(()=>{});return;
          }
          // Le catalogue Leboncoin (codes de catégorie/marque/taille/état) : sa
          // propre ligne, une place par endpoint, rien ne peut l'évincer.
          if (msg.action === 'lbcCatalogue' && msg.body) { await storeLbcCatalogue(msg.url, String(msg.body).slice(0, LBC_CATALOGUE_MAX), !!msg.coupe || String(msg.body).length > LBC_CATALOGUE_MAX); sendResponse({ ok: true }); return; }
          // ⚠️ LA FORME DE CE QUI PART VERS LEBONCOIN — chemins de clés et types,
          //    JAMAIS les valeurs (son titre, sa description, son prix ne
          //    quittent pas sa page). C'est ce qui dit quels champs le dépôt
          //    attend vraiment, catégorie par catégorie.
          if (msg.action === 'lbcEnvoi' && Array.isArray(msg.cles)) {
            const cle = (String(msg.methode || '') + ' ' + String(msg.url || '').replace(/^https?:\/\//, '').split('?')[0]).trim().slice(0, 110);
            await storeLbcRecon({ envoiOne: { cle, val: { at: new Date().toISOString(), ver: EXT_VERSION, methode: String(msg.methode || ''), cles: msg.cles.slice(0, 400) } } });
            sendResponse({ ok: true }); return;
          }
          if (msg.action === 'lbcPaths' && Array.isArray(msg.paths)) { await storeLbcRecon({ paths: msg.paths, url: msg.url }); sendResponse({ ok: true }); return; }
          // La carte complète de Leboncoin : structure (chemins de clés) d'une
          // réponse, par endpoint. Jamais de valeur (§ « capte tout »).
          if (msg.action === 'lbcSchema' && msg.endpoint && Array.isArray(msg.cles)) { await storeLbcRecon({ schemaOne: { endpoint: msg.endpoint, cles: msg.cles } }); sendResponse({ ok: true }); return; }
          // La messagerie Leboncoin : le nombre de non-lus d'un compte, et ses
          // comptes liés. Rangés dans `lbc_messages` (voir storeLbcMessages).
          if (msg.action === 'lbcMsgCompteur' && msg.userId) {
            const id=String(msg.userId).slice(0,64);if(!/^[0-9a-f-]{8,64}$/i.test(id)){sendResponse({ok:false});return;}
            await storeLbcMessages({compteur:{userId:id,unread:Number(msg.unread)}});
            const tabId=sender?.tab?.id;
            const cartes=(await chrome.storage.local.get('vrmLbcTransport')).vrmLbcTransport||{};
            const avant=cartes[tabId]||{};
            if(avant.source==='prive'){sendResponse({ok:true});return;}
            const ambigue=avant.ambigue===true||!!(avant.compte&&avant.compte!==id);
            if(tabId!=null && !(sender?.frameId>0)){
              cartes[tabId]={...avant,compte:ambigue?'':id,ambigue,at:Date.now()};
              await chrome.storage.local.set({vrmLbcTransport:Object.fromEntries(Object.entries(cartes).sort((a,b)=>b[1].at-a[1].at).slice(0,32))});
              if(!ambigue)try{await noterSessionLbc(id);}catch(_){}
            }
            sendResponse({ok:!ambigue});return;
          }
          if (msg.action === 'lbcComptes' && Array.isArray(msg.comptes)) { try { await noterComptesLies(msg.comptes); } catch (_) {} await storeLbcMessages({ comptes: msg.comptes }); sendResponse({ ok: true }); return; }
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
            // ⚠️ Revue du 11 octobre : la paire en dépôt ne se remplit que dans
            //    l'onglet ouvert POUR elle. Une autre page de dépôt restée
            //    ouverte (un dépôt abandonné, puis relancé ailleurs) la reprenait
            //    au premier retour sur l'onglet — et publiait une seconde fois.
            //    Sans onglet connu (dépôt lancé autrement) : comme avant.
            let ad = frais ? p.ad : null;
            if (ad && sender && sender.tab && sender.tab.id != null) {
              const job = (await lireCmds())['lbc:' + String(ad.id)];
              if (job && job.tabId != null && job.tabId !== sender.tab.id) ad = null;
            }
            sendResponse({ ok: true, ad }); return;
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
  } else if (msg.kind === 'suppression' && msg.itemId) {
    noterSuppression(domain, msg.itemId, msg.status, msg.at);
  } else if (msg.kind === 'publication') {
    if (msg.itemId) noterPublication(sender && sender.tab ? sender.tab.id : null, msg.itemId, msg.status);
    else noterDiag('publication_forme_inconnue');
  } else if (msg.kind === 'fiche') {
    // 22 oct. : la description et les codes qu'il vient d'ENREGISTRER sur Vinted
    // (2xx, identifiant de l'adresse ou de la réponse) — voir `noterFicheVinted`.
    // 23 oct. : jugée sur l'ONGLET qui l'envoie, jamais sur ce que dit le message
    // (`ficheDeLaPage`).
    ficheDeLaPage(msg, sender, domain);
  } else if (msg.kind === 'vintedFrein' && freinVinted(Number(msg.statut))) {
    // 5.162 : la moisson faite DANS la page (`inject.js`) a reçu un 429/403 sur
    // SA propre requête. Même pause que pour les requêtes du fond. (Un message
    // forgé par la page ne peut que nous FAIRE ralentir — jamais l'inverse.)
    poserPauseVinted(Number(msg.statut), 'navigateur');
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
  if (await compteNonCapte(uid)) return;
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
// (17 oct.) LA FORME D'UNE DEMANDE DE RETRAIT D'ARGENT. Julien veut « un endroit
// où on peut retirer l'argent du porte-monnaie ». Sa page a déjà appelé
// `POST /api/v2/users/{id}/payouts`, mais VRM n'en connaît que le chemin : son
// contenu est retiré (WREQ_SENSIBLE, c'est de l'argent et un compte bancaire).
// On garde ici la FORME seulement — noms des clés et TYPE de chaque valeur
// (« amount:number », « bank_account_id:number »), jamais une valeur, jamais une
// longueur — pour pouvoir un jour proposer le virement sans rien deviner.
// VRM n'appelle JAMAIS cette adresse : c'est une lecture de ce que la page a fait.
const WREQ_FORME = /payout/i;
function formeCorps(body) {
  const out = [];
  const t = String(body == null ? '' : body).trim();
  if (!t) return out;
  if (/^\[FormData\]/.test(t)) {
    for (const part of t.replace(/^\[FormData\]\s*/, '').split(' & ')) { const k = part.split('=')[0].trim(); if (k) out.push(k.slice(0, 60) + ':form'); }
    return out.slice(0, 60);
  }
  let j = null;
  try { j = JSON.parse(t); } catch (_) { j = null; }
  if (j === null && /^[\w.%\[\]-]+=/.test(t)) {
    for (const part of t.split('&')) { const k = decodeURIComponent(part.split('=')[0] || '').trim(); if (k) out.push(k.slice(0, 60) + ':form'); }
    return out.slice(0, 60);
  }
  const typ = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const walk = (v, pre, prof) => {
    if (out.length >= 60) return;
    if (v && typeof v === 'object' && !Array.isArray(v) && prof < 5) {
      for (const k of Object.keys(v)) walk(v[k], pre ? pre + '.' + k : k, prof + 1);
    } else if (Array.isArray(v) && v.length && prof < 5) {
      walk(v[0], pre + '[]', prof + 1);
    } else out.push(String(pre || '(racine)').slice(0, 80) + ':' + typ(v));
  };
  if (j !== null && typeof j === 'object') walk(j, '', 0); else if (j !== null) out.push('(racine):' + typ(j));
  return out;
}
async function storeWriteReq(domain, method, url, body) {
  const uid = await activeAccountId(domain);
  if (!uid) return;
  let path = url;
  let hote = '';
  try { const U = new URL(url, `https://${domain}`); path = U.pathname; hote = U.hostname; } catch (_) {}
  // Une URL relative part forcément vers Vinted ; une absolue, on vérifie l'hôte.
  if (/^https?:/i.test(String(url)) && !/(^|\.)vinted\.[a-z.]+$/i.test(hote)) return;
  const forme = WREQ_FORME.test(path) ? formeCorps(body) : null;   // AVANT de retirer le contenu
  if (WREQ_SENSIBLE.test(path)) body = '[retiré : donnée personnelle ou bancaire]';
  // Cle courte par type d'action : on remplace les ids numeriques pour regrouper
  // (ex: /api/v2/items/123 et /api/v2/items/456 -> meme cle).
  const key = (path.replace(/\/\d+/g, '/_id').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60)) || 'root';
  const data = { uid, method, url: WREQ_SENSIBLE.test(path) ? path : url, path, body: body || '', capturedAt: new Date().toISOString() };
  if (forme) data.forme = forme;
  await supabaseUpsert('app_data', [{ id: `harvest_${uid}_wreq_${key}`, data }], 'id');
}

// ══════════════════════════════════════════════════════════════════════════════
// UNE ANNONCE SUPPRIMÉE SUR VINTED SORT DE VRM TOUT DE SUITE (5.165)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 9 octobre 18:40 : « je viens de supprimer beaucoup de paires et elles
// sont encore marquées dans les annonces ». Il supprime tout pour reposter ; le
// dressing de cinq comptes datait du 8 au soir (~41 annonces affichées « en
// ligne »). La seule trace d'une suppression était `writereq` — posée AVANT la
// requête (donc aussi pour une suppression refusée), sans statut, une ligne par
// compte écrasée à chaque fois.
// ⇒ `inject.js` voit la RÉPONSE de `POST /api/v2/items/{id}/delete` et ne poste
//   qu'un 2xx, avec l'IDENTIFIANT de l'annonce (§5). On le range ici dans UNE
//   ligne par compte, `harvest_{uid}_supprimees = { uid, ids: { [id]: atISO } }`,
//   bornée aux 500 plus récentes.
// ⚠️ Il en supprime des dizaines à la suite : deux lire-fusionner-réécrire en
//    même temps sur la MÊME ligne se perdraient l'un l'autre. Une seule chaîne,
//    et la file d'attente vit dans `chrome.storage.local` (§4.9 : le service
//    worker meurt, la suppression vue ne doit pas mourir avec lui).
// ⚠️ « Rien lu ne vaut pas rien » : lecture de la ligne ratée ⇒ on n'écrit PAS
//    (on écraserait les suppressions déjà rangées) ; l'entrée reste en file et
//    repart au tour suivant (alarme, visite). `audit-fusion` porte le cas.
// ⚠️ Supprimée n'est PAS vendue : rien de tout ça n'entre dans une preuve de
//    vente, un CA, ni « à retirer de Leboncoin ». Le numéro n'est pas touché.
const SUPPR_FILE = 'vrmSupprAttente';
const SUPPR_MAX = 500;
let _chaineSuppr = Promise.resolve();
async function noterSuppression(domain, itemId, status, at) {
  const id = String(itemId || '');
  const st = Number(status);
  if (!/^\d{4,15}$/.test(id) || !(st >= 200 && st < 300)) { noterDiag('suppression_refusee_forme'); return; }
  const uid = await activeAccountId(domain);
  if (!uid) { noterDiag('suppression_sans_compte'); return; }   // on ne devine pas le compte
  let t = Date.parse(String(at || ''));
  if (isNaN(t) || t > Date.now() + 5 * 60000) t = Date.now();   // l'heure de la page ne dicte rien de futur
  // ⚠️ L'ENFILAGE PASSE AUSSI PAR LA CHAÎNE. Dix suppressions reçues en même
  //    temps faisaient dix lire-ajouter-réécrire de la file dans
  //    `chrome.storage` : la dernière écriture gagnait, neuf se perdaient
  //    (prouvé au banc, `audit-supprimees` : 1/10).
  const entree = { uid: String(uid), id, at: new Date(t).toISOString() };
  const enfiler = async () => {
    try {
      const enAttente = (await chrome.storage.local.get(SUPPR_FILE))[SUPPR_FILE] || [];
      enAttente.push(entree);
      await chrome.storage.local.set({ [SUPPR_FILE]: enAttente.slice(-SUPPR_MAX) });
      noterDiag('suppression_vue');
    } catch (_) {}
  };
  _chaineSuppr = _chaineSuppr.then(enfiler, enfiler);
  await viderSuppressions();
}
function viderSuppressions() {
  _chaineSuppr = _chaineSuppr.then(rangerSuppressions, rangerSuppressions);
  return _chaineSuppr;
}
async function rangerSuppressions() {
  let file = [];
  try { file = (await chrome.storage.local.get(SUPPR_FILE))[SUPPR_FILE] || []; } catch (_) { return; }
  if (!file.length) return;
  const parCompte = {};
  for (const e of file) if (e && e.uid && e.id) (parCompte[e.uid] = parCompte[e.uid] || []).push(e);
  const ranges = new Set();
  for (const uid of Object.keys(parCompte)) {
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_supprimees&select=data`);
    if (rows === null) { noterDiag('suppression_lecture_ratee'); continue; }   // pas su : on n'écrase rien
    const cur = (rows[0] && rows[0].data) || {};
    const ids = Object.assign({}, (cur.ids && typeof cur.ids === 'object') ? cur.ids : {});
    for (const e of parCompte[uid]) {
      const av = Date.parse(ids[e.id] || '');
      if (isNaN(av) || Date.parse(e.at) < av) ids[e.id] = e.at;      // la PREMIÈRE suppression vue fait foi
    }
    const garde = Object.entries(ids).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).slice(0, SUPPR_MAX);
    const data = { uid: String(uid), ids: Object.fromEntries(garde), capturedAt: new Date().toISOString(), ver: EXT_VERSION };
    const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_supprimees`, data }], 'id');
    if (ok === false) { noterDiag('suppression_ecriture_ratee'); continue; }
    for (const e of parCompte[uid]) ranges.add(e);
    noterDiag('suppression_rangee');
    notifierApp({ type: 'maj', quoi: 'annonces', uid: String(uid) });
  }
  if (!ranges.size) return;
  // On ne retire de la file que ce qui est RANGÉ — relu au dernier moment : une
  // suppression vue pendant l'écriture ne doit pas disparaître avec les autres.
  try {
    const now = (await chrome.storage.local.get(SUPPR_FILE))[SUPPR_FILE] || [];
    const cle = (e) => `${e.uid}|${e.id}|${e.at}`;
    const faits = new Set([...ranges].map(cle));
    await chrome.storage.local.set({ [SUPPR_FILE]: now.filter((e) => !faits.has(cle(e))) });
  } catch (_) {}
}
// ══════════════════════════════════════════════════════════════════════════════
// LE NUMÉRO SUR VINTED (20 octobre, 5.201)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « quand on publie sur Vinted je veux que le numéro soit écrit à côté
// du bouton Publier, et après, quand on va sur Vinted, qu'il y ait le numéro
// dessus ; pareil dans les ventes ». Trois gestes, tous LECTURE ou écriture de
// NOTRE base — zéro requête vers Vinted (§3) :
//  1. la page de dépôt s'ouvre ⇒ on RÉSERVE le prochain numéro (jamais servi)
//     dans `panel_num_reserves.attente` AVANT de l'afficher (sinon l'app pourrait
//     le donner ailleurs entre-temps) ; illisible ou pas écrit ⇒ rien n'est
//     affiché (« pas su » ne promet pas un numéro) ;
//  2. Vinted répond à `POST /api/v2/item_upload/items` (2xx) avec l'identifiant
//     de l'annonce créée ⇒ la réservation de CET onglet est liée à CETTE annonce
//     (`items[itemId]`), une identité (§5) — l'app lui donne ce numéro-là ;
//  3. sur les pages Vinted, un numéro n'est affiché que s'il est CONNU par
//     identité : fiche de l'annonce, vente (transaction, conversation). Jamais
//     un titre. Inconnu ⇒ rien.
const RESA_LIGNE = 'panel_num_reserves';
const RESA_ATTENTE_MS = 3 * 3600e3;
const RESA_ITEMS_MAX = 400;
const RESA_LOCAL = 'vrmNumResaOnglets';
let _chaineResa = Promise.resolve();
const unResaALaFois = (fn) => { const p = _chaineResa.then(fn, fn); _chaineResa = p.catch(() => {}); return p; };
// Le prochain numéro jamais servi : APRÈS le plus haut (la règle `prochainLibre`
// de l'app : jamais dans un trou), dans la série à lettre si elle est choisie.
function prochainNumeroDe(main, resa, maintenant) {
  const pref = String((main && main.vrm_num_prefixe) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const cles = [];
  const add = (v) => { const c = cleNum(v); if (c) cles.push(c); };
  for (const x of (Array.isArray(main && main.vinted_used_numeros) ? main.vinted_used_numeros : [])) add(x);
  for (const e of Object.values((main && main.vinted_annonce_numeros) || {})) add(e && e.numero);
  for (const e of Object.values((main && main.vinted_sale_overrides) || {})) add(e && e.numero);
  const t = Number(maintenant) || Date.now();
  for (const [n, v] of Object.entries((resa && resa.attente) || {})) { const at = Date.parse((v && v.at) || ''); if (!isNaN(at) && t - at < RESA_ATTENTE_MS) add(n); }
  for (const v of Object.values((resa && resa.items) || {})) add(v && v.numero);
  let c = 1;
  for (const k of cles) {
    if (!pref) { if (/^\d+$/.test(k) && Number(k) >= c) c = Number(k) + 1; }
    else { const m = /^([A-Z]{1,3})(\d+)$/.exec(k); if (m && m[1] === pref && Number(m[2]) >= c) c = Number(m[2]) + 1; }
  }
  return pref ? pref + c : String(c);
}
function resaPropre(data, maintenant) {
  const t = Number(maintenant) || Date.now();
  const attente = {}, items = {};
  for (const [n, v] of Object.entries((data && data.attente) || {})) { const at = Date.parse((v && v.at) || ''); if (!isNaN(at) && t - at < RESA_ATTENTE_MS) attente[n] = v; }
  const its = Object.entries((data && data.items) || {}).filter(([id, v]) => /^\d{4,15}$/.test(id) && v && v.numero);
  its.sort((a, b) => String(b[1].at || '').localeCompare(String(a[1].at || '')));
  for (const [id, v] of its.slice(0, RESA_ITEMS_MAX)) items[id] = v;
  return { attente, items };
}
async function lireResa() {
  const rows = await sbGet(`app_data?id=eq.${RESA_LIGNE}&select=data`);
  if (rows === null) return null;
  return resaPropre(rows[0] && rows[0].data);
}
async function ecrireResa(r) {
  const ok = await supabaseUpsert('app_data', [{ id: RESA_LIGNE, data: { attente: r.attente, items: r.items, capturedAt: new Date().toISOString(), ver: EXT_VERSION } }], 'id');
  return ok !== false;
}
async function reserverNumeroPourOnglet(tabId, domain) {
  return unResaALaFois(async () => {
    if (tabId == null) return { ok: false, raison: 'onglet' };
    await lierPublicationsEnAttente();
    let loc = {};
    try { loc = (await chrome.storage.local.get(RESA_LOCAL))[RESA_LOCAL] || {}; } catch (_) { return { ok: false, raison: 'stockage' }; }
    const deja = loc[tabId];
    if (deja && !deja.item && Date.now() - deja.at < RESA_ATTENTE_MS) return { ok: true, numero: deja.numero };
    // Une publication vue mais pas encore rangée (base injoignable) : on la garde
    // à part — une nouvelle réservation dans cet onglet ne doit pas l'effacer.
    if (deja && deja.item) { loc['lie_' + tabId + '_' + deja.at] = deja; delete loc[tabId]; }
    const uid = await activeAccountId(domain);
    if (!uid) return { ok: false, raison: 'compte' };
    const main = await lireMain(['vinted_used_numeros', 'vinted_annonce_numeros', 'vinted_sale_overrides', 'vrm_num_prefixe']);
    const r = await lireResa();
    if (main === null || r === null) { noterDiag('resa_lecture_ratee'); return { ok: false, raison: 'lecture' }; }
    const numero = prochainNumeroDe(main, r);
    r.attente[numero] = { at: new Date().toISOString(), uid: String(uid) };
    if (!(await ecrireResa(r))) { noterDiag('resa_ecriture_ratee'); return { ok: false, raison: 'ecriture' }; }
    loc[tabId] = { numero, at: Date.now(), uid: String(uid) };
    try { await chrome.storage.local.set({ [RESA_LOCAL]: loc }); } catch (_) {}
    noterDiag('resa_posee');
    notifierApp({ type: 'maj', quoi: 'numeros' });
    return { ok: true, numero };
  });
}
// La publication vue dans la page : on note l'identifiant sur la réservation de
// l'onglet (stockage local, §4.9), puis on range — une écriture ratée repart au
// geste suivant, la publication vue ne meurt pas avec le service worker.
async function noterPublication(tabId, itemId, status) {
  const id = String(itemId || ''), st = Number(status);
  if (tabId == null || !/^\d{4,15}$/.test(id) || !(st >= 200 && st < 300)) { noterDiag('publication_refusee_forme'); return; }
  return unResaALaFois(async () => {
    let loc = {};
    try { loc = (await chrome.storage.local.get(RESA_LOCAL))[RESA_LOCAL] || {}; } catch (_) { return; }
    const r = loc[tabId];
    if (!r || r.item) { noterDiag('publication_sans_resa'); return; }
    loc[tabId] = { ...r, item: id };
    try { await chrome.storage.local.set({ [RESA_LOCAL]: loc }); } catch (_) {}
    // 23 oct. : la fiche de CETTE publication n'est acceptée que de CET onglet
    // (`ficheDeLaPage`) — la réservation, elle, est effacée dès qu'elle est rangée.
    await noterOngletFiche(PUBLIS_ONGLETS, tabId, id);
    noterDiag('publication_vue');
    await lierPublicationsEnAttente();
  });
}
async function lierPublicationsEnAttente() {
  let loc = {};
  try { loc = (await chrome.storage.local.get(RESA_LOCAL))[RESA_LOCAL] || {}; } catch (_) { return; }
  const aLier = Object.entries(loc).filter(([, v]) => v && v.item);
  if (!aLier.length) return;
  const r = await lireResa();
  if (r === null) { noterDiag('publication_lecture_ratee'); return; }   // pas su : on n'écrase rien
  for (const [, v] of aLier) {
    if (!r.items[v.item]) r.items[v.item] = { numero: v.numero, at: new Date().toISOString(), uid: v.uid };
    delete r.attente[v.numero];
  }
  if (!(await ecrireResa(r))) { noterDiag('publication_ecriture_ratee'); return; }
  for (const [tab] of aLier) delete loc[tab];
  try { await chrome.storage.local.set({ [RESA_LOCAL]: loc }); } catch (_) {}
  noterDiag('publication_liee');
  _numsAffichage = null;
  notifierApp({ type: 'maj', quoi: 'annonces' });
}
// Les numéros à AFFICHER sur Vinted, par identité seulement (cache 2 min).
let _numsAffichage = null;
async function numerosPourAffichage() {
  if (_numsAffichage && Date.now() - _numsAffichage.at < 120000) return _numsAffichage;
  const main = await lireMain(['vinted_annonce_numeros', 'vinted_sale_overrides']);
  if (main === null) return null;
  const r = await lireResa();
  const parItem = {}, parTx = {}, parConv = {};
  for (const [id, e] of Object.entries(main.vinted_annonce_numeros || {})) { const n = e && String(e.numero == null ? '' : e.numero).trim(); if (n) parItem[id] = n; }
  if (r) for (const [id, v] of Object.entries(r.items)) if (!parItem[id]) parItem[id] = String(v.numero);
  const txItems = await sbGetTout('app_data?id=like.harvest_*_txn_*&select=id,item:meta->>item_id');
  for (const row of (txItems || [])) { const m = /_txn_(\d+)$/.exec(String(row.id || '')); if (m && row.item && parItem[String(row.item)]) parTx[m[1]] = parItem[String(row.item)]; }
  for (const [tx, e] of Object.entries(main.vinted_sale_overrides || {})) { const n = e && String(e.numero == null ? '' : e.numero).trim(); if (n && /^\d+$/.test(tx)) parTx[tx] = n; }
  const ventes = await sbGetTout('app_data?id=like.harvest_*_orders_sold&select=id,o:data->payload->my_orders');
  for (const row of (ventes || [])) for (const o of (Array.isArray(row.o) ? row.o : [])) {
    const tx = o && o.transaction_id != null ? String(o.transaction_id) : '', cv = o && o.conversation_id != null ? String(o.conversation_id) : '';
    if (tx && cv && parTx[tx]) parConv[cv] = parTx[tx];
  }
  _numsAffichage = { at: Date.now(), parItem, parTx, parConv };
  return _numsAffichage;
}
// <supprimees-regle> — LA MÊME RÈGLE QUE L'APP (src/App.jsx), §11 ; comparées par
// `audit-supprimees.cjs`. Une annonce `id` lue dans un dressing capturé à `capTs`
// est cachée si elle a été supprimée APRÈS cette lecture. `capturedAt` est l'heure
// du RANGEMENT, pas de la lecture : une moisson partie avant la suppression et
// rangée après la ressusciterait — d'où la marge. Une annonce supprimée ne revient
// jamais légitimement (republiée, elle a un NOUVEL identifiant) : la marge ne fait
// que retarder une résurrection qui ne doit pas avoir lieu.
const SUPPR_MARGE_MS = 5 * 60 * 1000;
function supprimeeApres(ids, id, capTs) {
  if (!ids || typeof ids !== 'object') return false;          // pas su : on n'écarte rien
  const at = Date.parse(ids[String(id)] || '');
  if (isNaN(at)) return false;
  return !(Number(capTs) >= at + SUPPR_MARGE_MS);             // lecture d'avant, ou sans date : écartée
}
// La date de LECTURE d'un dressing — UNE fonction pour les quatre lecteurs
// (écran Annonces, file Leboncoin de l'app, files LBC/eBay et photos de
// l'extension, §11) : `capturedAt` écrit par l'extension (la colonne `cap`
// d'une projection, ou `data.capturedAt` d'une ligne entière). JAMAIS
// `updated_at`, qui ment (§4.3) — l'écran Annonces y retombait, les autres non :
// la même ligne rendait deux listes (revue de la 5.165). Sans date : `NaN`.
function dateLectureDressing(ligne) {
  const c = ligne && (ligne.cap != null ? ligne.cap : (ligne.data && ligne.data.capturedAt));
  return Date.parse(c || '');
}
// </supprimees-regle>
// <enligne-regle> — LA MÊME RÈGLE DANS L'APP (src/App.jsx) ET DANS L'EXTENSION
// (background.js), §11. `audit-enligne.cjs` exige que les deux blocs soient
// IDENTIQUES et compare leurs sorties sur les mêmes entrées. Il dépend de
// `supprimeeApres` (bloc <supprimees-regle>, juste au-dessus dans les deux).
// Julien, 11 octobre : « quand les annonces ne sont plus en ligne, elles doivent
// être enlevées, automatiquement — je me retrouve avec trois fois la même paire
// alors qu'il n'y a qu'une seule annonce ». Une annonce est EN LIGNE si :
//   · la lecture COMPLÈTE la plus récente de son compte la contient ouverte —
//     son propre dressing (`harvest_{uid}_listings`, quand il est connecté) ou
//     son dressing PUBLIC relu depuis un autre de ses comptes
//     (`harvest_{uid}_enligne`, 5.167) : la plus récente des deux fait foi ;
//   · aucune suppression vue APRÈS cette lecture ne la retire ;
//   · et cette lecture a moins de 24 h. Au-delà (ou jamais lue) on ne SAIT pas :
//     ses annonces ne sont ni « en ligne » ni « disparues » — « à confirmer »,
//     dites à part, jamais comptées (« rien lu ne vaut pas rien », §4.1).
// Une annonce présente dans la lecture publique mais pas dans le dressing (elle
// vient d'être republiée) est en ligne, avec ce que la lecture publique en sait.
// Une annonce ouverte dans un dressing plus ancien et ABSENTE de la lecture
// publique plus récente n'est plus en ligne (supprimée, vendue ou masquée) : elle
// est rendue FERMÉE (`_vrmAbsente`), jamais « vendue » (rien ne le prouve).
// ⚠️ Une annonce que son vendeur voit VENDUE ne se rouvre pas d'un coup d'œil
//    public (la vue publique n'est pas mesurée sur les ventes) : la vente fait foi
//    — et elle RESTE parmi les fermées (revue de la 5.167 : elle disparaissait de
//    toutes les sorties, et avec elle la seule preuve sans ressemblance qu'une
//    paire numérotée est partie).
// ⚠️ Une suppression vue en 2xx ne se « rattrape » pas par une lecture PUBLIQUE
//    qui la montre encore (revue de la 5.167) : Vinted ne réutilise jamais un
//    identifiant, et la vue publique n'est pas mesurée (index, cache en retard ?).
//    Le dressing de son vendeur, lui, reste la mesure qui fait foi (5.165).
// ⚠️⚠️ « PAS SU » LES LECTURES PUBLIQUES (`pub = { passu: true }`, revue de la
//    5.167) : sur un hoquet, les annonces qu'une lecture plus récente savait
//    PARTIES revenaient « en ligne » — la triple paire de sa plainte, sans un mot.
//    Sans les lectures publiques, un dressing ne décide QUE s'il a moins de
//    `ENLIGNE_SUR_MS` : l'extension ne relit jamais en public un compte lu depuis
//    moins de 30 min (`ENLIGNE_DELAI_MS`), donc aucune lecture plus récente ne
//    peut exister. Au-delà, ses annonces sont « à confirmer ».
const ENLIGNE_FRAIS_MS = 24 * 60 * 60 * 1000;
const ENLIGNE_SUR_MS = 30 * 60 * 1000;
function ouverteSurVinted(it) { return !!(it && !it.is_closed && !it.is_hidden && !it.is_draft); }
function venduePourSonVendeur(it) { return !!(it && it.is_closed && /sold/i.test(String(it.item_closing_action || ''))); }
function enLigneDuCompte(liste, pub, suppIds, maintenant) {
  const itemsL = (liste && Array.isArray(liste.items)) ? liste.items : null;
  const capL = itemsL && liste.cap != null && liste.cap !== '' ? Number(liste.cap) : NaN;
  const pubPasSu = !!(pub && pub.passu === true);
  const pubLisible = !pubPasSu && !!(pub && (pub.complet === true || pub.complet === 'true') && Array.isArray(pub.ids));
  const capP = pubLisible && pub.cap != null && pub.cap !== '' ? Number(pub.cap) : NaN;
  const r = { enLigne: [], aConfirmer: [], fermees: [], absentes: [], supprimees: [], lu: NaN, source: '', pubPasSu };
  const cand = [];
  if (isFinite(capP) && !(isFinite(capL) && capL >= capP)) {
    r.source = 'public'; r.lu = capP;
    const parL = new Map(), parP = new Map(), vus = new Set();
    for (const it of itemsL || []) if (it && it.id != null) parL.set(String(it.id), it);
    for (const it of (Array.isArray(pub.items) ? pub.items : [])) if (it && it.id != null) parP.set(String(it.id), it);
    for (const x of pub.ids) {
      const id = String(x == null ? '' : x);
      if (!id || vus.has(id)) continue;
      vus.add(id);
      const l = parL.get(id) || null, p = parP.get(id) || null;
      if (!l && !p) continue;
      if (l && venduePourSonVendeur(l)) { r.fermees.push(l); continue; }
      cand.push(Object.assign({}, l || {}, p || {}, { id: (l || p).id, is_closed: false, is_hidden: false, is_draft: false }));
    }
    for (const it of itemsL || []) {
      if (!it || it.id == null || vus.has(String(it.id))) continue;
      if (ouverteSurVinted(it)) r.absentes.push(it); else r.fermees.push(it);
    }
  } else if (isFinite(capL)) {
    r.source = 'dressing'; r.lu = capL;
    for (const it of itemsL) { if (!it) continue; if (ouverteSurVinted(it)) cand.push(it); else r.fermees.push(it); }
  } else if (itemsL) {
    for (const it of itemsL) { if (!it) continue; if (ouverteSurVinted(it)) cand.push(it); else r.fermees.push(it); }
  }
  const garde = [];
  for (const it of cand) { if (supprimeeApres(suppIds, it.id, r.source === 'public' ? -Infinity : r.lu)) r.supprimees.push(it); else garde.push(it); }
  const age = Number(maintenant) - r.lu;
  const sur = !pubPasSu || age < ENLIGNE_SUR_MS;
  if (isFinite(r.lu) && age <= ENLIGNE_FRAIS_MS && sur) r.enLigne = garde; else r.aConfirmer = garde;
  return r;
}
// Les lignes de tous les comptes, telles que les balayages les lisent :
// `lignesL` = `harvest_{uid}_listings` (`select=id,data` ou `data`), `lignesP` =
// `harvest_{uid}_enligne` projetées (`id, cap, complet, ids, items`) — `null` =
// la base n'a pas répondu (« pas su » : chaque compte reçoit `{ passu: true }`) —,
// `supp` = Map uid → suppressions (`null` = pas su). Chaque compte rend UNE ligne au
// format d'un dressing : ses annonces fermées, les absentes rendues fermées, et
// celles qui sont en ligne — jamais celles « à confirmer », rendues à part.
function enLigneDesLignes(lignesL, lignesP, supp, maintenant) {
  const parL = new Map(), parP = new Map();
  for (const r of lignesL || []) {
    const d = r && r.data; if (!d) continue;
    const k = /^harvest_(\d+)_listings$/.exec(String((r && r.id) || ''));
    const uid = k ? k[1] : (d.uid != null ? String(d.uid) : '');
    if (uid) parL.set(uid, r);
  }
  for (const r of lignesP || []) {
    const k = /^harvest_(\d+)_enligne$/.exec(String((r && r.id) || ''));
    if (k) parP.set(k[1], r);
  }
  const lignes = [], aConfirmer = new Map(), parCompte = new Map();
  for (const uid of new Set([...parL.keys(), ...parP.keys()])) {
    const r = parL.get(uid) || null, d = r ? r.data : null, p = d ? d.payload : null;
    const liste = (p && Array.isArray(p.items)) ? { items: p.items, cap: dateLectureDressing(r) } : null;
    const q = parP.get(uid) || null;
    const pub = lignesP === null ? { passu: true } : (q ? { complet: q.complet, ids: q.ids, items: q.items, cap: Date.parse(q.cap || '') } : null);
    const res = enLigneDuCompte(liste, pub, supp ? (supp.get(uid) || null) : null, maintenant);
    parCompte.set(uid, res);
    if (res.aConfirmer.length) aConfirmer.set(uid, res.aConfirmer);
    const items = res.fermees.concat(res.absentes.map((it) => Object.assign({}, it, { is_closed: true, _vrmAbsente: true })), res.enLigne);
    if (!liste && !items.length) continue;
    const data = Object.assign({ type: 'listings' }, d || {}, { uid: (d && d.uid != null) ? d.uid : uid,
      _vrmLu: isFinite(res.lu) ? res.lu : null, _vrmSource: res.source,
      payload: Object.assign({}, p || {}, { items }) });
    lignes.push(Object.assign({}, r || {}, { id: (r && r.id) || `harvest_${uid}_listings`, data }));
  }
  return { lignes, aConfirmer, parCompte };
}
// </enligne-regle>
// (5.167, 11 octobre : `retirerSupprimeesLignes` est RETIRÉE — les suppressions
//  s'appliquent désormais dans `enLigneDesLignes`, avec la lecture la plus
//  récente de chaque compte : la même règle que l'app, §11.)
// Toutes les suppressions rangées, par compte. `null` = la base n'a pas répondu
// (« pas su » : l'appelant n'écarte rien). Une ligne par compte : famille bornée.
async function lireSupprimeesTous() {
  const rows = await sbGet('app_data?id=like.harvest_*_supprimees&select=id,ids:data->ids');
  if (rows === null || !Array.isArray(rows)) return null;
  const m = new Map();
  for (const r of rows) {
    const k = /^harvest_(\d+)_supprimees$/.exec(String(r && r.id || ''));
    if (k && r.ids && typeof r.ids === 'object') m.set(k[1], r.ids);
  }
  return m;
}
// Les dressings de TOUS les comptes, avec la règle « en ligne » appliquée
// (`enLigneDesLignes`, la même que l'app — §11). Les lectures publiques des
// autres comptes (`harvest_{uid}_enligne`, une ligne par compte : famille
// bornée) n'ajoutent ni n'ôtent rien quand elles sont illisibles : le dressing
// seul décide alors, et un compte qu'on ne peut pas dater reste « à confirmer ».
const SELECT_ENLIGNE = 'id,cap:data->>capturedAt,complet:data->complet,ids:data->ids,items:data->items';
// ⚠️ Revue de la 5.167 — deux lectures ratées passaient pour « rien » :
//    · les DRESSINGS illisibles (`|| []`) : aucune annonce en ligne, donc toutes
//      ses paires publiées sur Leboncoin dites « plus en ligne, à retirer »
//      (prouvé : celles du compte connecté, jamais relu en public). ⇒ `echec` :
//      les files ne calculent rien et le disent ;
//    · les lectures PUBLIQUES illisibles (`|| []`) : le vieux dressing redécidait,
//      et les annonces qu'une lecture plus récente savait parties revenaient dans
//      la file. ⇒ la dernière valeur connue (ce service worker), sinon « pas su »
//      (`null`) : la règle rend « à confirmer » ce qu'elle ne peut plus dater.
let _dernieresLecturesPubliques = null;
async function lireDressingsEnLigne() {
  const lignesL = await sbGet('app_data?id=like.harvest_*_listings&select=id,data');
  if (!Array.isArray(lignesL)) { noterDiag('enligne_dressings_pas_lus'); return { echec: true, lignes: [], aConfirmer: new Map(), parCompte: new Map() }; }
  let lignesP = await sbGet(`app_data?id=like.harvest_*_enligne&select=${SELECT_ENLIGNE}`);
  if (Array.isArray(lignesP)) _dernieresLecturesPubliques = lignesP;
  else { noterDiag('enligne_lignes_pas_lues'); lignesP = _dernieresLecturesPubliques; }
  return enLigneDesLignes(lignesL, lignesP, await lireSupprimeesTous(), Date.now());
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

// ⚠️ UN BORDEREAU EST UN PDF (4 octobre). Les trois portes de capture ne
// regardaient que l'en-tête `application/pdf` ou l'extension du fichier : une
// page HTML de session expirée servie sous ce type, ou un lien « .pdf » qui
// redirige vers la connexion, était rangée comme un bordereau — `_pdf` passait
// à vrai, l'app proposait « Imprimer », et le vrai bordereau n'était plus
// jamais redemandé (`labelDejaRange`). On vérifie les OCTETS : `%PDF`.
function estPdfOctets(u8) {
  return !!(u8 && u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46);
}
function estPdfB64(b64) {
  try { const t = atob(String(b64 || '').slice(0, 8)); return t.length >= 4 && t.slice(0, 4) === '%PDF'; } catch (_) { return false; }
}

// Range le dernier bordereau (PDF) telecharge, pour que l'app le tamponne.
// Rend true si la base l'a RANGÉ, false sinon.
async function storeLabel(domain, url, b64) {
  if (!estPdfB64(b64)) { await noterDiag('label_pas_un_pdf'); return false; }
  const uid = await activeAccountId(domain);
  if (!uid) return false;
  // À quel colis appartient ce PDF ? Le téléchargement ne le dit pas. On ne
  // DEVINE pas (§24) : soit on l'a envoyé télécharger CETTE vente-là (rendez-
  // vous ci-dessus, identité certaine), soit il n'y a QU'UN SEUL colis possible
  // pour ce compte — là ce n'est plus une supposition, c'est le seul candidat.
  let tx = await bordereauAttendu(uid);
  if (!tx) try {
    // §4.4 : la liste des ventes seulement, jamais la ligne entière.
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_orders_sold&select=ventes:data->payload->my_orders`);
    const ventes = (rows && rows[0] && Array.isArray(rows[0].ventes) && rows[0].ventes) || [];
    const dejaCapte = new Set();
    const cur = await sbGetTout(`app_data?id=like.harvest_${uid}_label_*&select=tx:meta->>tx`); // §4.5 : un compte à fort volume dépasse 1000 bordereaux — sbGet tronquait en silence
    for (const r of (cur || [])) if (r && r.tx) dejaCapte.add(String(r.tx));
    const cands = ventes.filter(o => o && o.transaction_id != null && A_EXPEDIER(o) && !dejaCapte.has(String(o.transaction_id)));
    if (cands.length === 1) tx = String(cands[0].transaction_id);
  } catch (_) { /* sans certitude, le PDF reste simplement « le dernier capté » */ }
  const data = { uid, url, capturedAt: new Date().toISOString(), pdfB64: b64, ...(tx ? { tx } : {}) };
  const lignes = [{ id: `harvest_${uid}_label_latest`, data }];
  if (tx) lignes.unshift({ id: `harvest_${uid}_label_${tx}`, data });
  // « capté » ne se dit que si la base l'a RANGÉ (comme `recupererLabel`).
  const range = await supabaseUpsert('app_data', lignes, 'id');
  if (range === false) { await noterDiag('label_ecriture_ratee'); logActivity('⚠️ Bordereau lu, mais la base ne l\'a pas enregistré'); return false; }
  logActivity(tx ? '📎 Bordereau capté et relié à sa vente' : '📄 Bordereau capté (prêt à imprimer)');
  return true;
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

// ── ÉTAT DU COMPTE : ACTIF OU BANNI (5.181) ──────────────────────────────────
// Julien (16 oct.) : « l'extension doit être capable d'évaluer l'état du compte ;
// il doit juste y avoir s'il est actif ou banni ». ⚠️ AUCUNE REQUÊTE DE PLUS (§3) :
// on lit la réponse de `/api/v2/users/current` que la moisson et la capture
// passive reçoivent DÉJÀ (le profil du compte connecté, rangé dans
// `harvest_{uid}_profile`). MESURÉ le 16 octobre sur sa base (lecture seule) :
// ce profil porte `is_account_banned` (booléen) et `account_status` ; les trois
// comptes bloqués connus valent `true` / 8, les sept vivants `false` / 0 — et
// Vinted RÉPOND bien `/users/current` à un compte banni (captures datées).
// ⇒ « banni » UNIQUEMENT sur `is_account_banned === true` ; `false` ⇒ « actif » ;
//   champ absent ou d'une autre forme ⇒ « passu ». Un statut HTTP (429 = frein,
//   401 = session expirée, 403 = frein ou refus) ne fait JAMAIS « banni » : il
//   n'arrive même pas ici (le profil n'est pas rendu). Doute ⇒ jamais « banni ».
const ETAT_COMPTE_ROW = 'panel_comptes_etat';
function etatDuProfil(json) {
  const u = json && typeof json === 'object' ? (json.user && typeof json.user === 'object' ? json.user : null) : null;
  if (!u) return { etat: 'passu', preuve: 'profil illisible' };
  if (u.is_account_banned === true) return { etat: 'banni', preuve: 'champ profil is_account_banned' };
  if (u.is_account_banned === false) return { etat: 'actif', preuve: 'champ profil is_account_banned' };
  return { etat: 'passu', preuve: 'champ profil is_account_banned absent' };
}
// ── COMPTE PRO OU PARTICULIER (17 octobre, 5.185). Julien : « elle doit être
//    capable de voir si le compte connecté est un compte pro ou non ». MESURÉ
//    avant d'écrire (les 10 profils `harvest_*_profile` de sa base) : le profil
//    `users/current` porte `business` (booléen), `business_account` (objet, ou
//    null) et `business_account_id`. Chez lui : `business: false`,
//    `business_account: null` partout — tous ses comptes sont particuliers.
//    Trois états, jamais deux : true · false · null (champ absent = pas su,
//    jamais « particulier » par défaut). Le pro se reconnaît à N'IMPORTE lequel
//    des trois signaux ; le particulier exige `business === false` ET aucun
//    compte professionnel rattaché.
function typeCompteVinted(json) {
  const u = json && typeof json === 'object' ? (json.user && typeof json.user === 'object' ? json.user : null) : null;
  if (!u) return null;
  const ba = u.business_account;
  const baid = u.business_account_id;
  if (u.business === true || (ba && typeof ba === 'object') || (baid != null && baid !== 0 && baid !== '')) return true;
  if (u.business === false && (ba == null) && (baid == null || baid === 0 || baid === '')) return false;
  return null;
}
// Une écriture à la fois (lire-fusionner-réécrire) : deux profils rangés coup sur
// coup ne s'effacent pas l'un l'autre. Une chaîne perdue au réveil du service
// worker ne perd qu'une mise à jour, refaite à la visite suivante (§4.9).
let chaineEtatCompte = Promise.resolve();
function noterEtatCompte(uid, json) {
  const k = String(uid || '');
  if (!k) return Promise.resolve(false);
  const ev = etatDuProfil(json);
  const pro = typeCompteVinted(json);
  const fait = chaineEtatCompte.then(async () => {
    try {
      const rows = await sbGet(`app_data?id=eq.${ETAT_COMPTE_ROW}&select=data`);
      if (rows === null) { noterDiag('etat_compte_lecture_ratee'); return false; }   // pas su : on n'écrit rien (§5)
      const cur = (rows && rows[0] && rows[0].data) || {};
      const comptes = (cur.comptes && typeof cur.comptes === 'object') ? { ...cur.comptes } : {};
      const avant = comptes[k];
      // « passu » ne remplace jamais un verdict lu (un profil illisible n'apprend rien).
      // Le TYPE (pro / particulier) suit la même règle : `null` garde le connu.
      const proConnu = (avant && typeof avant.pro === 'boolean') ? avant.pro : null;
      const proNeuf = typeof pro === 'boolean' ? pro : proConnu;
      const proChange = proNeuf !== proConnu;
      const etatGarde = ev.etat === 'passu' && avant && (avant.etat === 'actif' || avant.etat === 'banni');
      if (etatGarde && !proChange) return false;
      const etat = etatGarde ? avant.etat : ev.etat;
      const preuve = etatGarde ? avant.preuve : ev.preuve;
      const maintenant = Date.now();
      const recent = avant && avant.etat === etat && !proChange && avant.at && (maintenant - Date.parse(avant.at)) < 3600000;
      if (recent) return false;                     // rien de neuf : pas d'écriture (égress)
      comptes[k] = { etat, at: etatGarde ? avant.at : new Date(maintenant).toISOString(), preuve };
      if (typeof proNeuf === 'boolean') { comptes[k].pro = proNeuf; comptes[k].proAt = (proChange || !avant || !avant.proAt) ? new Date(maintenant).toISOString() : avant.proAt; }
      const ok = await supabaseUpsert('app_data', [{ id: ETAT_COMPTE_ROW, data: { comptes, majAt: new Date(maintenant).toISOString() } }], 'id');
      noterDiag(ok === false ? 'etat_compte_ecriture_ratee' : `etat_compte_${etat}`);
      if (ok !== false && (!avant || avant.etat !== etat || proChange)) { try { notifierApp({ type: 'maj', quoi: 'etatcompte', uid: k }); } catch (_) {} }
      return ok !== false;
    } catch (_) { return false; }
  });
  chaineEtatCompte = fait.catch(() => false);
  return fait;
}

async function noterUrlLabel(url, ok) {
  try {
    let hote = '', chemin = '';
    try { const u = new URL(url); hote = u.hostname; chemin = u.pathname.replace(/\/\d{4,}/g, '/_id'); } catch (_) { return; }
    const rows = await sbGet(`app_data?id=eq.${LABEL_VU}&select=data`);
    if (rows === null) return;                     // « pas su » ≠ « rien vu » : une lecture ratée ne doit pas réécrire la ligne avec la seule URL du moment (famille §5.53)
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
        if (buf.byteLength && buf.byteLength < 4000000 && estPdfOctets(new Uint8Array(buf, 0, Math.min(8, buf.byteLength)))) {
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
  if (!estPdfB64(b64)) { await noterDiag('recu_pas_un_pdf'); return false; }
  const uid = await activeAccountId(domain);
  if (!uid) return false;
  const data = { uid, url, capturedAt: new Date().toISOString(), pdfB64: b64 };
  const range = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_receipt_latest`, data }], 'id');
  if (range === false) { await noterDiag('recu_ecriture_ratee'); return false; }
  return true;
}

// --- FETCH ACTIF (v3) ------------------------------------------------------
// En plus de la capture passive, l'extension va CHERCHER activement les donnees
// de TOUS les comptes lies, depuis TON navigateur / TON IP (jamais un serveur).
// Ainsi l'app est a jour sans que tu ouvres chaque page Vinted, et sans passer
// par le proxy Vercel (IP datacenter = risque). On utilise le token Bearer de
// chaque compte, SANS cookie (credentials:'omit') pour ne pas melanger les
// comptes. Rythme doux : un compte a la fois, avec des pauses.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════════════════
// UNE SEULE FILE POUR CHAQUE REQUÊTE VINTED, ET L'ARRÊT NET SUR 429 / 403
// (5.162, 6 octobre)
// ══════════════════════════════════════════════════════════════════════════
// MESURÉ dans ce fichier avant de coder :
//   · `avecVinted` ne couvrait QUE la génération de bordereaux, les réponses et
//     les commandes de l'app. La moisson (`runActive` : jusqu'à ~33 requêtes),
//     les codes de retrait, les dates de versement, les relevés et les photos
//     partaient HORS file — la capture photo tourne même toute seule chaque
//     minute (`tickPhotos`, jusqu'à 20 pages). Deux sources pouvaient donc
//     avoir une requête en vol en même temps (§3 : « une par une »).
//   · Quand Vinted répondait 429 (« ralentis ») ou 403 (« non »), RIEN ne
//     s'arrêtait : chaque boucle cassait la sienne puis la suivante repartait —
//     jusqu'à une trentaine de requêtes enchaînées dans la même visite, dans
//     l'empreinte d'un compte que Vinted venait justement de freiner. C'est la
//     forme exacte de ce qui a fait bloquer `vanessa5723`.
// ⇒ TOUTE requête Vinted passe par `requeteVinted` (les primitives
//   `vintedGet`, `vintedSend`, `vintedGetHtml`, `vintedGetCookie`, le
//   renouvellement de session et la moisson faite dans la page) : UNE en vol,
//   quelle que soit la source. `avecVinted` reste au-dessus, pour l'ORDRE des
//   gestes (deux générations du même bordereau ne s'entrelacent pas) — les deux
//   chaînes sont distinctes, donc aucune ne peut attendre l'autre.
// ⇒ Un 429 ou un 403 venu de Vinted ouvre une PAUSE rangée dans
//   `chrome.storage.local` (§4.9 : le service worker meurt, une variable de
//   module ne retiendrait rien) : 15 min, puis 30, 1 h, 2 h, 4 h si Vinted
//   recommence dans les 6 h qui suivent la pause précédente. Pendant la pause,
//   AUCUNE requête ne part — pas même un clic : la commande de l'app est refusée
//   avec la raison (« Vinted demande de ralentir — réessaie dans X min »).
//   Le diagnostic la note (`vinted_frein_*`, `vinted_pause_palier_*`,
//   `rates.vinted_pause`). Aucun plafond n'est monté, aucune requête ajoutée.
const PAUSE_VINTED = 'vrmPauseVinted';          // { jusqua, niveau, statut, depuis, quoi }
const PAUSE_PALIERS_MIN = [15, 30, 60, 120, 240];
const PAUSE_OUBLI_MS = 6 * 3600000;             // au-delà, on repart du premier palier
const freinVinted = (s) => s === 429 || s === 403;
async function lirePauseVinted() {
  try { return (await chrome.storage.local.get(PAUSE_VINTED))[PAUSE_VINTED] || {}; } catch (_) { return {}; }
}
// La pause EN COURS, ou `null`. (« Pas lu » le stockage local ⇒ pas de pause :
// le stockage local ne tombe pas en panne comme une base distante.)
async function pauseVinted() {
  const p = await lirePauseVinted();
  const reste = Number(p.jusqua || 0) - Date.now();
  return reste > 0 ? Object.assign({}, p, { resteMs: reste }) : null;
}
function raisonPauseVinted(p) {
  const min = Math.max(1, Math.ceil(Number((p && p.resteMs) || 0) / 60000));
  return `Vinted demande de ralentir — réessaie dans ${min} min`;
}
// Sérialisé : deux réponses 429 arrivées l'une derrière l'autre ne montent pas
// de deux paliers (la seconde trouve la pause déjà posée).
let _pauseChaine = Promise.resolve();
function poserPauseVinted(statut, quoi) {
  _pauseChaine = _pauseChaine.then(async () => {
    const t = Date.now();
    const cur = await lirePauseVinted();
    if (Number(cur.jusqua || 0) > t) return;                  // déjà en pause : rien ne monte
    const recent = cur.jusqua && (t - Number(cur.jusqua)) < PAUSE_OUBLI_MS;
    const niveau = recent ? Math.min(Number(cur.niveau || 0) + 1, PAUSE_PALIERS_MIN.length) : 1;
    const minutes = PAUSE_PALIERS_MIN[niveau - 1];
    const famille = String(quoi || 'api').replace(/[^a-z]/gi, '').slice(0, 20) || 'api';
    try { await chrome.storage.local.set({ [PAUSE_VINTED]: { jusqua: t + minutes * 60000, niveau, statut: Number(statut) || 0, depuis: t, quoi: famille } }); } catch (_) {}
    noterDiag(`vinted_frein_${Number(statut) || 0}`);
    noterDiag(`vinted_pause_palier_${niveau}`);
    majTampon((buf) => { buf.rates.vinted_pause = { statut: Number(statut) || 0, niveau, minutes, quoi: famille, at: new Date(t).toISOString() }; });
    logActivity(`⏸ Vinted demande de ralentir (${statut}) — plus aucune requête pendant ${minutes} min`);
  }).catch(() => {});
  return _pauseChaine;
}
// LA FILE : une requête Vinted à la fois, quelle que soit la source. `fn` ne
// fait QUE la requête (jamais une autre primitive : elle attendrait sa propre
// place dans la file). Pendant une pause, rien ne part.
let _fileRequetes = Promise.resolve();
function requeteVinted(quoi, fn) {
  const tour = async () => {
    const p = await pauseVinted();
    if (p) { noterDiag('vinted_pause_refus'); return { status: 0, ok: false, json: null, text: '', pause: true, raison: raisonPauseVinted(p) }; }
    const r = await fn();
    if (r && freinVinted(r.status)) await poserPauseVinted(r.status, quoi);
    return r;
  };
  const suite = _fileRequetes.then(tour, tour);
  _fileRequetes = suite.then(() => {}, () => {});
  return suite;
}

// Un GET Vinted authentifie pour un compte donne (depuis le navigateur).
async function vintedGet(acc, endpoint) {
  return requeteVinted('api', async () => {
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
  });
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
  // Une requête Vinted comme une autre : dans la file, et jamais pendant une pause.
  const rf = await requeteVinted('auth', async () => {
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
      return { status: res.status, ok: res.ok };
    } catch (_) { return { status: 0, ok: false }; }
  });
  if (!rf || !rf.ok) return null;
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
  // Chaque appel prend SA place dans la file (`requeteVinted`) ; le
  // renouvellement de session sur un 401 en prend une autre, entre les deux —
  // jamais une requête appelée de l'intérieur d'une autre (elle attendrait sa
  // propre place pour toujours).
  const doCall = () => requeteVinted('api', async () => {
    try {
      const res = await fetch(`https://${domain}${endpoint}`, {
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
      let json = null;
      try { json = await res.json(); } catch (_) {}
      return { status: res.status, ok: res.ok, json };
    } catch (_) { return { status: 0, ok: false, json: null }; }
  });
  let rep = await doCall();
  if (rep.status === 401) { const r = await refreshIfActive(acc); if (r) rep = await doCall(); }
  return rep;
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
  const candidats = [it.photo,it.photo_url,it.photoUrl,it.image_url,it.imageUrl,it.item_photo,
    ...(Array.isArray(it.item_photos) ? it.item_photos : []),it.transaction?.item_photo, ...(Array.isArray(it.photos) ? it.photos : []), it.item?.photo,
    ...(Array.isArray(it.item?.photos) ? it.item.photos : []), it.image, it.item?.image];
  for (const p of candidats) {
    if (!p) continue;
    const url = typeof p === 'string' ? p : p.full_size_url || p.url || p.photo_url || p.imageUrl || p.src
      || (Array.isArray(p.thumbnails) && p.thumbnails.find(t => t && t.url)?.url);
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
    const out = { url };
    const ts = p.high_resolution && p.high_resolution.timestamp;
    if (ts) out.high_resolution = { timestamp: ts };
    return out;
  }
  return null;
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
  const itemId = o.item_id ?? o.item?.id ?? o.item?.item_id;
  if (itemId != null) out.item_id = itemId;
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
// ⚠️⚠️ 22 octobre — 23 DES 27 PAUSES DE VINTED (TOUS LES 429) VENAIENT D'UNE PAGE PHOTO.
//    Mesuré chez Julien (`panel_diag_capture`, extension 5.211, relu le 23 oct.) :
//    `vinted_frein_429` = 23 = `photos_page_refuse_429` = 23 — les 23 « trop de
//    demandes » de Vinted venaient TOUS d'une lecture de page d'annonce pour les
//    photos ; les 4 autres pauses sont des 403 (`vinted_frein_403` = 4) sur
//    d'AUTRES requêtes (aucun `photos_page_refuse_403`) ; paliers de pause 1/2/3
//    atteints 24/2/1 fois (27 = 23 + 4) ; `visite_en_pause` = 119 visites sautées
//    (ventes et colis arrivés en retard dans VRM). Rien n'est promis sur la
//    disparition des pauses : ce correctif ne touche que les pages photo. Cause :
//    jusqu'à 20 pages lues d'affilée, sans aucun écart, à chaque minute
//    (`tickPhotos`) ET à la fin de chaque visite. (Avant : « monté 3 → 8 → 20
//    pour remplir le catalogue plus vite » — c'est ce front-chargement que Vinted
//    refusait.)
// ⇒ UNE page par tour (`PHOTOS_PAR_TOUR`) ; jamais deux pages de fond à moins de
//   `PHOTOS_ECART_MS` (un écart FIXE, jamais « faussement humain », §3) ; aucune
//   page pendant qu'il navigue sur Vinted (`PHOTOS_CALME_MS`, vu par les onglets,
//   sans requête) — et plus aucune dans la visite ; un 429/403 sur une page photo
//   coupe les photos de fond 24 h (`PHOTOS_FREIN_MS`), le reste de l'extension
//   suivant la pause habituelle. Le total horaire ne bouge pas (`gardeLecture`,
//   20 lectures/h moins les réserves) : les lectures sont ÉTALÉES, pas multipliées.
//   Le clic « Publier » (`completerPhotos`, classe `clic`) n'est soumis ni à
//   l'écart, ni au calme, ni au frein photos — seulement à la pause de Vinted.
const PHOTOS_PAR_TOUR = 1;
const PHOTOS_ECART_MS = 45 * 1000;
const PHOTOS_CALME_MS = 2 * 60 * 1000;
const PHOTOS_FREIN_MS = 24 * 3600 * 1000;
const PHOTOS_FREIN = 'vrmPhotosFrein';          // { at, statut } du dernier 429/403 sur une page photo (§4.9)
const PHOTOS_DERNIERE = 'vrmPhotosDerniere';    // ms de la dernière page photo de FOND
const ACTIVITE_VINTED = 'vrmActiviteVinted';    // ms de sa dernière navigation sur Vinted
const PHOTOS_PLAN = 'vrmPhotosPlan';            // { [uid]: { ids, veut, at } } — la liste à compléter, calculée une fois
const PHOTOS_PLAN_MS = 15 * 60 * 1000;
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
    if (muet[String(uid)]) { await noterLecturesDues(uid, 'releve', 0); return 0; }  // ce compte a déjà prouvé que le paramètre ne passe pas
    // Ce qu'on a déjà (une seule lecture, deux scalaires — jamais le payload).
    let cur = [];
    try { cur = await sbGet(`app_data?id=like.harvest_${uid}_releve_*&select=m:meta->>mois`); } catch (_) {}
    const dejaMois = new Set((cur || []).map(r => r && r.m).filter(Boolean));
    const bill = await sbGet(`app_data?id=eq.harvest_${uid}_billing&select=h:data->payload->history`);
    // « Pas su » (une des deux lectures ratée) : on ne dit rien de ce qui reste
    // à lire — la réserve de l'argent reste entière (`reserveLectures`).
    const su = cur !== null && bill !== null;
    const hist = (bill && bill[0] && bill[0].h) || [];
    if (!Array.isArray(hist) || !hist.length) { if (su) await noterLecturesDues(uid, 'releve', 0); return 0; }
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
      // Sans l'id de profil, aucune requête ne partirait : on ne consomme pas
      // une place du budget pour rien.
      if (!pid) { noterDiag('releve_sans_profil'); break; }
      // 5.162 : une LECTURE de son propre relevé — budget de lecture, priorité argent.
      const refus = await gardeLecture(uid, acc, 'argent');
      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Relevé non lu : ${refus.error}`); break; }
      memo[k] = Date.now();
      n++;
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
    // Ce qu'il RESTE à lire maintenant (hors mois en attente de 24 h) — c'est
    // ce que les photos laissent de côté pour l'argent.
    if (su) {
      const plusMuet = !!(((await chrome.storage.local.get('vrmReleveMuet')).vrmReleveMuet || {})[String(uid)]);
      const reste = (plusMuet || !pid) ? 0 : voulus.filter(v => { const k = `${uid}_${v.cle}`; return !(memo[k] && Date.now() - Number(memo[k]) < RELEVE_RETRY_MS); }).length;
      await noterLecturesDues(uid, 'releve', reste);
    }
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
// ⚠️ 23 oct. : BORNÉE à `PAGE_DELAI_MS`. Sans délai, une page que Vinted ne rend
//    jamais tenait la file Vinted ENTIÈRE (une requête à la fois) : bordereaux,
//    réponses et ventes attendaient derrière elle. Interrompue ⇒ statut 0
//    (« pas su » : le mémo de l'annonce est rendu, `memoApresEchec`).
const PAGE_DELAI_MS = 30 * 1000;
async function vintedGetHtml(acc, endpoint) {
  return requeteVinted('page', async () => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const minuterie = ctl ? setTimeout(() => { try { ctl.abort(); } catch (_) {} }, PAGE_DELAI_MS) : null;
    try {
      const res = await fetch(`https://${acc.domain || 'www.vinted.fr'}${endpoint}`, {
        method: 'GET',
        credentials: 'omit',
        headers: { 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' },
        signal: ctl ? ctl.signal : undefined,
      });
      const text = await res.text();
      return { status: res.status, ok: res.ok, text };
    } catch (_) { return { status: 0, ok: false, text: '' }; }
    finally { if (minuterie) clearTimeout(minuterie); }
  });
}
// Extrait { photos, description } de la PAGE d'une annonce. Priorité au bloc
// `__NEXT_DATA__` (rendu serveur) où vit l'objet de l'annonce avec TOUTES ses
// photos — on ne prend QUE l'objet dont l'id == celui de l'annonce (§5,
// l'identité prime, jamais un autre article). Repli : balayage des grandes
// images vinted.net du HTML.
// Le texte du flux Next « app router » : la page porte des
// `<script>self.__next_f.push([1,"…"])</script>` dont le 2ᵉ élément est une
// chaîne JSON. On ne garde que ce qui se décode proprement.
function texteDuFluxNext(html) {
  try {
    const re = /self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:[^"\\]|\\[\s\S])*")\s*\]\)/g;
    let txt = '', m, n = 0;
    while ((m = re.exec(html)) && n < 2000) { n++; try { const v = JSON.parse(m[1]); if (typeof v === 'string') txt += v; } catch (_) {} }
    return txt;
  } catch (_) { return ''; }
}
// Les objets JSON COMPLETS et bien fermés qui entourent une mention de l'id de
// l'annonce (`"id":123`). Un fragment tronqué est ignoré, jamais deviné.
function objetsAutourDeLId(txt, cible) {
  const out = [];
  try {
    const re = new RegExp('"id"\\s*:\\s*"?' + String(cible).replace(/\D/g, '') + '(?!\\d)', 'g');
    let m, essais = 0;
    while ((m = re.exec(txt)) && essais < 12 && out.length < 6) {
      essais++;
      // On remonte jusqu'à 40 accolades ouvrantes en arrière : la plus proche
      // qui s'ouvre AVANT la mention et se ferme APRÈS est l'objet qui la porte.
      let k = m.index, tours = 0;
      while (k > 0 && tours < 40) {
        k = txt.lastIndexOf('{', k - 1); if (k < 0) break; tours++;
        let p = 0, fin = -1, chaine = false, ech = false;
        for (let j = k; j < txt.length && j < k + 400000; j++) {
          const c = txt[j];
          if (ech) { ech = false; continue; }
          if (c === '\\') { ech = true; continue; }
          if (c === '"') { chaine = !chaine; continue; }
          if (chaine) continue;
          if (c === '{') p++;
          else if (c === '}') { p--; if (!p) { fin = j; break; } }
        }
        if (fin < 0 || fin < m.index) continue;
        try { const o = JSON.parse(txt.slice(k, fin + 1)); if (o && typeof o === 'object') { out.push(o); break; } } catch (_) {}
      }
    }
  } catch (_) {}
  return out;
}
function extraireDetailPage(html, id) {
  const out = { photos: [], description: '', codes: null, cles: null, photoIds: [], couleur: '', format: 'aucun', nextData: false, nextFlux: false, idVu: false };
  if (!html) return out;
  try {
    const cible = String(id);
    out.idVu = html.indexOf(cible) >= 0;
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    let data = null;
    if (m) { out.nextData = true; try { data = JSON.parse(m[1]); } catch (_) {} }
    let found = null;
    const vu = new Set();
    const walk = (o, prof) => {
      if (!o || found || prof > 12 || typeof o !== 'object') return;
      if (vu.has(o)) return; vu.add(o);
      if (String(o.id) === cible && Array.isArray(o.photos) && o.photos.length) { found = o; return; }
      for (const k of Object.keys(o)) walk(o[k], prof + 1);
    };
    if (data) { walk(data, 0); if (found) out.format = 'next_data'; }
    // ⚠️⚠️ 20 octobre (5.197) — MESURÉ CHEZ JULIEN : `fiche_codes_absents` = 650
    //    = `photos_page_ecrit` 650, et l'échantillon dit `cles=` (vide). Sur ses
    //    pages d'annonce, `__NEXT_DATA__` ne porte plus l'objet de l'annonce :
    //    les photos venaient TOUTES du balayage d'images ci-dessous, et les
    //    codes (catégorie, marque, couleur) n'étaient JAMAIS trouvés. Le routeur
    //    « app » de Next diffuse ses données dans `self.__next_f.push([1,"…"])`
    //    (comme Leboncoin, 12 sept.) : on lit ce flux, et on n'y prend QUE
    //    l'objet dont l'id est celui de l'annonce (§5). Je n'ai jamais vu la
    //    page (403) : `out.format` dit ce qui a servi, pour la passe suivante.
    if (!found) {
      const flux = texteDuFluxNext(html);
      if (flux) {
        out.nextFlux = true;
        for (const o of objetsAutourDeLId(flux, cible)) { walk(o, 0); if (found) break; }
        if (found) out.format = 'next_f';
      }
    }
    {
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
        // (17 oct.) LA COULEUR telle que Vinted l'AFFICHE (« Blanc », « Noir ») —
        // un libellé texte de l'annonce, jamais déduit d'une photo ni d'un titre.
        // Leboncoin la demande dans sa liste Couleur ; lbc.js ne la pose que sur
        // une option EXACTE. Absente ou d'une autre forme ⇒ '' (rien d'inventé).
        const libCouleur = (v) => typeof v === 'string' ? v.trim() : (v && typeof v === 'object' && typeof v.title === 'string' ? v.title.trim() : '');
        out.couleur = [libCouleur(found.color1), libCouleur(found.color2)].filter(Boolean).join(' / ').slice(0, 60);
        out.codes = Object.keys(c).length ? c : null;
        out.cles = Object.keys(found).slice(0, 80);
        for (const p of found.photos) if (p && typeof p.id === 'number') out.photoIds.push(p.id);
      }
    }
    if (!out.photos.length) {
      out.format = 'html';
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
// ⚠️⚠️ 20 octobre (5.197) — QUAND RELIRE LA PAGE D'UNE ANNONCE.
//    Mesuré chez Julien : 650 pages lues, 650 « fiche_codes_absents », et les
//    17 freins 429 de Vinted (`photos_page_refuse_429` = `vinted_frein_429`) —
//    la pause qui suit refuse aussi les bordereaux et les réponses. Cause : une
//    annonce était relue toutes les 6 h tant que ses CODES manquaient… or la
//    page ne les donnait jamais. Une annonce déjà lue par la page et restée
//    incomplète n'est relue qu'après `PAGE_REESSAI_INCOMPLET_MS` (3 jours) ; une
//    annonce jamais lue par la page (ou à qui il manque ENCORE des photos alors
//    qu'on n'en a aucune) passe tout de suite.
const PAGE_REESSAI_INCOMPLET_MS = 3 * 24 * 3600 * 1000;
function aRelirePageAnnonce(it, d0, maintenant) {
  const d = d0 || {};
  const veut = Number((it && it.nPhotos) || 0);
  const a = (d.photos || []).length;
  const manquePhotos = veut > 1 && a < veut;
  const manqueCodes = !d.codes;
  if (!manquePhotos && !manqueCodes) return false;
  if (a === 0) return true;                                   // rien capté : on lit
  const lu = Date.parse(d.pageAt || '');
  if (isFinite(lu) && (maintenant || Date.now()) - lu < PAGE_REESSAI_INCOMPLET_MS) return false;
  return true;
}
// La photo d'une annonce s'identifie par son fichier sur le CDN
// (`/t/{empreinte}/f800/…`), jamais par sa taille ni sa signature `?s=`.
function clePhotoVinted(u) {
  const s = String(u || '').split('?')[0];
  const m = /\/t\/([^/]+)\//.exec(s);
  return m ? m[1] : s.replace(/\/(f\d+|tc|large|full)\//, '/');
}
// ⚠️⚠️ 20 octobre (5.197) — UNE PHOTO QUI N'EST PAS DE L'ANNONCE (§5).
//    Mesuré : le même fichier (`02_024a3_…`) dans les photos de 29 annonces
//    DIFFÉRENTES, un autre (`06_01e6b_…`) dans 17 — une image de la page
//    (bandeau, autre article), jamais une paire. Elle partait sur Leboncoin et
//    eBay comme photo de la paire. Règle, par IDENTITÉ de fichier, jamais par
//    ressemblance : un fichier présent dans des annonces aux couvertures
//    (1re photo) TOUTES différentes — au moins 3 — et qui n'est la couverture
//    d'aucune n'appartient à aucune. Deux annonces de la même paire (mêmes
//    photos, même couverture) ne déclenchent jamais rien.
function retirerPhotosEtrangeres(carte) {
  if (!carte || typeof carte !== 'object') return 0;
  const couvertures = new Set();
  const parCle = new Map();                       // clé → Set des couvertures des annonces qui la portent
  for (const k of Object.keys(carte)) {
    const ph = carte[k] && Array.isArray(carte[k].photos) ? carte[k].photos : [];
    if (!ph.length) continue;
    const couv = clePhotoVinted(ph[0]);
    couvertures.add(couv);
    for (const u of ph.slice(1)) {
      const c = clePhotoVinted(u);
      if (!parCle.has(c)) parCle.set(c, new Set());
      parCle.get(c).add(couv);
    }
  }
  const etrangeres = new Set();
  for (const [c, couvs] of parCle) if (couvs.size >= 3 && !couvertures.has(c)) etrangeres.add(c);
  if (!etrangeres.size) return 0;
  let n = 0;
  for (const k of Object.keys(carte)) {
    const e = carte[k];
    if (!e || !Array.isArray(e.photos) || e.photos.length < 2) continue;
    const garde = [e.photos[0]].concat(e.photos.slice(1).filter((u) => !etrangeres.has(clePhotoVinted(u))));
    if (garde.length !== e.photos.length) { n += e.photos.length - garde.length; carte[k] = Object.assign({}, e, { photos: garde }); }
  }
  return n;
}
// ── LE FREIN DES PHOTOS (22 octobre) ─────────────────────────────────────────
// Un 429/403 reçu sur une PAGE d'annonce lue pour ses photos coupe les photos de
// FOND pendant 24 h (la relecture publique des autres comptes a le même frein,
// `ENLIGNE_FREINS`). Rangé dans `chrome.storage.local` (§4.9). « Pas lu » le
// stockage local ⇒ pas de frein (même règle que `pauseVinted`).
async function freinPhotos() {
  try {
    const f = (await chrome.storage.local.get(PHOTOS_FREIN))[PHOTOS_FREIN];
    const at = Number(f && f.at);
    return (at > 0 && Date.now() - at < PHOTOS_FREIN_MS) ? f : null;
  } catch (_) { return null; }
}
async function poserFreinPhotos(statut) {
  try { await chrome.storage.local.set({ [PHOTOS_FREIN]: { at: Date.now(), statut: Number(statut) || 0 } }); } catch (_) {}
  noterDiag(`photos_frein_${Number(statut) || 0}`);
  logActivity(`⏸ Vinted a refusé une page photo (${statut}) — plus aucune photo lue en arrière-plan pendant 24 h`);
}
// Il navigue sur Vinted : un onglet Vinted vient de charger une page (vu par
// `chrome.tabs.onUpdated`, aucune requête) ou une visite tourne. Ses propres
// requêtes et celles de la visite suffisent : on n'y ajoute pas de page photo.
async function noterActiviteVinted() {
  try { await chrome.storage.local.set({ [ACTIVITE_VINTED]: Date.now() }); } catch (_) {}
}

// La LISTE des annonces à compléter, calculée UNE fois (listings + fiches) puis
// gardée `PHOTOS_PLAN_MS` dans `chrome.storage.local` : à une page par tour, la
// relire à chaque tour ferait redescendre la ligne `vinted_item_details`
// (283 Ko chez Julien, mesuré le 22 oct.) pour CHAQUE page (§4.4, égress).
// `null` = pas su (une lecture ratée) : rien n'est lu chez Vinted.
async function planPhotos(uid) {
  let tous = {};
  try { tous = (await chrome.storage.local.get(PHOTOS_PLAN))[PHOTOS_PLAN] || {}; } catch (_) { tous = {}; }
  const p = tous[String(uid)];
  // Une liste vide ne vaut que `PHOTOS_TICK_COOLDOWN_MS` : une annonce qu'il vient
  // de publier est prise aussi vite qu'avant.
  const validite = (p && Array.isArray(p.ids) && p.ids.length) ? PHOTOS_PLAN_MS : PHOTOS_TICK_COOLDOWN_MS;
  if (p && Array.isArray(p.ids) && Date.now() - Number(p.at || 0) < validite && Number(p.at || 0) <= Date.now()) return p;
  // La liste du dressing : id + nPhotos + état. C'est SA donnée (ligne du compte).
  let items = [];
  let capListe = NaN;
  try {
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_listings&select=items:data->payload->items,cap:data->>capturedAt`);
    if (rows === null) return null;
    items = (rows && rows[0] && Array.isArray(rows[0].items)) ? rows[0].items : [];
    capListe = dateLectureDressing(rows && rows[0]);
  } catch (_) { return null; }
  // 5.165 : une annonce qu'il vient de SUPPRIMER n'est plus en ligne — la lire
  // coûtait une requête Vinted pour un 404 (mesuré : `photos_annonce_refuse_404`
  // = 96). Même règle que l'app ; suppressions illisibles ⇒ on n'écarte rien.
  if (items.length) { const supp = await lireSupprimeesTous(); const ids = supp && supp.get(String(uid));
    if (ids) items = items.filter((it) => !(it && supprimeeApres(ids, it.id, capListe))); }
  // Ce qu'on a DÉJÀ capté (photos par id) — une lecture, la carte complète.
  let dej = {};
  if (items.length) {
    try {
      const dr = await sbGet('app_data?id=eq.vinted_item_details&select=data');
      if (dr === null) return null;                     // pas su ≠ « rien capté » : on ne rejoue pas à l'aveugle
      dej = (dr[0] && dr[0].data) || {};
    } catch (_) { return null; }
  }
  // Les fiches lues mais pas encore rangées comptent comme captées.
  for (const e of await lireFichesEnAttente()) if (e && e.src === 'page' && e.id && e.f) dej[String(e.id)] = Object.assign({}, dej[String(e.id)], e.f, { pageAt: e.at });
  const maintenant = Date.now();
  const manquants = items.filter((it) => {
    if (!it || !it.id) return false;
    if (it.is_closed || it.is_hidden || it.is_draft) return false;   // en ligne seulement
    return aRelirePageAnnonce(it, dej[String(it.id)], maintenant);
  }).sort((a, b) => Number(b.nPhotos || 0) - Number(a.nPhotos || 0));
  const plan = { ids: manquants.map((it) => String(it.id)), veut: {}, at: maintenant };
  for (const it of manquants) plan.veut[String(it.id)] = Number(it.nPhotos || 0);
  try { tous[String(uid)] = plan; await chrome.storage.local.set({ [PHOTOS_PLAN]: tous }); } catch (_) {}
  return plan;
}

// Le mémo « annonce lue » (`vrmPhotosFaites`), modifié clé par clé sur la valeur
// RELUE : `null` retire la clé. Un tour et un clic « Publier » qui écrivent en
// même temps ne s'effacent plus l'un l'autre.
let _chaineMemoPhotos = Promise.resolve();
function majMemoPhotos(changes) {
  const p = _chaineMemoPhotos.then(async () => {
    const ks = Object.keys(changes || {});
    if (!ks.length) return;
    const m = (await chrome.storage.local.get('vrmPhotosFaites')).vrmPhotosFaites || {};
    for (const k of ks) { if (changes[k] == null) delete m[k]; else m[k] = changes[k]; }
    await chrome.storage.local.set({ vrmPhotosFaites: m });
  });
  _chaineMemoPhotos = p.then(() => {}, () => {});
  return p;
}
// ⚠️ SEUL `tickPhotos` APPELLE CETTE FONCTION (22 octobre) : c'est lui qui tient
//    l'écart fixe, le calme et le frein. `max` vaut une page par tour.
async function capterPhotosAnnonces(uid, max = PHOTOS_PAR_TOUR) {
  try {
    if (!uid) return 0;
    if (await freinPhotos()) return 0;                      // 24 h après un refus de Vinted sur une page photo
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    const plan = await planPhotos(uid);
    if (!plan || !plan.ids.length) return 0;
    const memo = (await chrome.storage.local.get('vrmPhotosFaites')).vrmPhotosFaites || {};
    let n = 0; const lues = [], touchees = [];
    for (const id of plan.ids) {
      if (n >= Math.max(1, Number(max) || PHOTOS_PAR_TOUR)) break;
      const k = `${uid}_${id}`;
      if (memo[k] && Date.now() - Number(memo[k]) < PHOTOS_RETRY_MS) continue;
      const refus = await gardeLecture(uid, acc, 'photos');   // s'arrête avant la réserve argent/colis
      if (refus) { if (refus.code !== 'lectures-reservees' && refus.code !== 'vinted-pause') logActivity(`⚠️ Photos non captées : ${refus.error}`); break; }
      memo[k] = Date.now();
      n++; touchees.push(k);
      // 23 oct. : le mémo de CETTE annonce est enregistré AVANT la requête — un
      // tour qui partirait pendant qu'elle tarde ne la remet pas en file.
      try { await majMemoPhotos({ [k]: memo[k] }); await chrome.storage.local.set({ [PHOTOS_DERNIERE]: Date.now() }); } catch (_) {}
      const rep = await vintedGetHtml(acc, `/items/${encodeURIComponent(id)}`);
      // L'écart se compte depuis la RÉPONSE (une page qui a mis 40 s ne doit pas
      // laisser partir la suivante 5 s après).
      try { await chrome.storage.local.set({ [PHOTOS_DERNIERE]: Date.now() }); } catch (_) {}
      // 5.193 : un frein de Vinted (429/403), une pause, un 401 ou une coupure ne
      // disent rien de l'annonce — le mémo de 6 h était posé quand même (mesuré :
      // `photos_page_refuse_429` ×15). Même règle que les codes de retrait et les
      // preuves de vente (`memoApresEchec`) ; un frein arrête la boucle.
      // 22 oct. : et un frein coupe les photos de fond 24 h (la pause habituelle,
      // posée par `requeteVinted`, vaut pour tout le reste).
      if (!rep.ok || !rep.text) {
        noterDiag(`photos_page_refuse_${rep.status}`);
        if (!rep.ok && !rep.pause && freinVinted(Number(rep.status) || 0)) await poserFreinPhotos(rep.status);
        if (!rep.ok && memoApresEchec(memo, k, rep, PHOTOS_RETRY_MS)) break;
        continue;
      }
      const det = extraireDetailPage(rep.text, id);
      const urls = det.photos;
      if (!urls.length) {
        noterDiag('photos_page_vide');
        echantillonRate('photos_page', String(id), 'nextdata=' + (/__NEXT_DATA__/.test(rep.text) ? 'oui' : 'non') + ' len=' + rep.text.length);
        continue;
      }
      // 5.197 : le balayage d'images de la page (`format: 'html'`) attrapait
      // aussi une image qui n'est PAS de l'annonce, toujours APRÈS les siennes
      // (mesuré : la même photo étrangère en position nPhotos+1 sur 29 de ses
      // annonces). Quand Vinted dit combien l'annonce en a, on n'en garde pas plus.
      const veutN = Number(plan.veut[id] || 0);
      const photos = urls.filter(Boolean).slice(0, (det.format === 'html' && veutN > 0) ? veutN : 24);
      // MESURE (§6, « on ne prend que 5 photos », 29 sept.) : si on en récupère
      // MOINS que Vinted n'en annonce (`nPhotos`), on le note — jamais le corps.
      if (veutN > photos.length) echantillonRate('photos_incomplet', String(id), 'got=' + photos.length + ' want=' + veutN + ' format=' + (det.format || ''));
      // ⚠️ ÉCRITURE GROUPÉE (§4.4, égress). La fiche part dans la FILE des fiches
      //    (`chrome.storage.local`, §4.9) : une écriture de la ligne pour
      //    `FICHES_LOT` pages, et la fusion se fait au moment d'écrire, sur la
      //    ligne relue (jamais sur une copie de début de boucle — 5.193).
      lues.push({ id: String(id), src: 'page', at: new Date(Date.now()).toISOString(), f: {
        description: String(det.description || '').trim(), photos, codes: det.codes || null,
        photoIds: det.photoIds || [], couleur: det.couleur || '', pageFormat: det.format || '' } });
      noterDiag('photos_page_ecrit');
      // Mesure de la fiche : codes trouvés, ou non — et alors les CLÉS (jamais les valeurs).
      if (det.codes && det.codes.catalog_id != null) noterDiag('fiche_codes_ok');
      else { noterDiag('fiche_codes_absents'); echantillonRate('fiche_codes', String(id), 'format=' + det.format + ' next_data=' + (det.nextData ? 'oui' : 'non') + ' next_f=' + (det.nextFlux ? 'oui' : 'non') + ' id_vu=' + (det.idVu ? 'oui' : 'non') + ' cles=' + (det.cles || []).join(',').slice(0, 560)); }
      noterDiag('fiche_format_' + (det.format || 'aucun'));
    }
    if (lues.length) await enfilerFiches(lues);
    // Les seules annonces de CE tour (posées, ou rendues par `memoApresEchec`),
    // fusionnées dans le mémo RELU — jamais une copie du début de tour par-dessus
    // ce qu'un clic « Publier » a noté entre-temps.
    await majMemoPhotos(Object.fromEntries(touchees.map((k) => [k, memo[k] === undefined ? null : memo[k]])));
    // Plus rien à lire dans la liste : on range tout de suite (sinon au lot).
    const reste = plan.ids.some((id) => { const m = memo[`${uid}_${id}`]; return !(m && Date.now() - Number(m) < PHOTOS_RETRY_MS); });
    await viderFiches({ force: !reste });
    return n;
  } catch (_) { return 0; }
}

// ⚠️ CAPTURE AU CLIC « PUBLIER » (Julien, 3 octobre). Plutôt que d'attendre le
// goutte-à-goutte de fond, quand il lance la publication d'UNE paire on va
// chercher SES photos TOUT DE SUITE : 1 lecture de la page de l'annonce,
// déclenchée par SON clic (donc humaine), sous garde de LECTURE, dans la file
// Vinted (une à la fois). Jamais de rafale. Il ne publie plus une annonce sans
// ses photos, et il n'attend aucun fond.
// 22 oct. : ni l'écart, ni le calme, ni le frein des photos de fond ne
// s'appliquent (c'est SON clic) — la pause de Vinted, si (`requeteVinted`). Un
// refus de Vinted ici coupe quand même les photos de FOND 24 h.
async function completerPhotos(uid, id) {
  try {
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return false;
    const refus = await gardeLecture(uid, acc, 'clic');      // SON clic : pas de réserve à respecter
    if (refus) { logActivity(`⚠️ Photos non captées : ${refus.error}`); return false; }
    const rep = await vintedGetHtml(acc, `/items/${encodeURIComponent(id)}`);
    if (!rep.ok || !rep.text) {
      noterDiag(`photos_page_refuse_${rep.status}`);
      if (!rep.ok && !rep.pause && freinVinted(Number(rep.status) || 0)) await poserFreinPhotos(rep.status);
      return false;
    }
    const det = extraireDetailPage(rep.text, id);
    if (!det || !Array.isArray(det.photos) || !det.photos.length) { noterDiag('photos_page_vide'); return false; }
    await saveItemDetail(id, { description: det.description || '', photos: det.photos, couleur: det.couleur || '' });
    noterDiag('photos_page_ecrit');
    // Lue sur son clic : le fond ne la relit pas dans la foulée (une page Vinted de moins).
    try { await majMemoPhotos({ [`${uid}_${id}`]: Date.now() }); } catch (_) {}
    return true;
  } catch (_) { return false; }
}
// Ne va chercher QUE si ça manque (évite une lecture inutile quand c'est déjà là).
async function completerPhotosSiManque(uid, id) {
  try {
    if (!uid || !id) return;
    await viderFiches({ force: true });            // une fiche lue mais pas encore rangée compte
    const dr = await sbGet('app_data?id=eq.vinted_item_details&select=data');
    if (dr === null) return;                       // pas su : on ne force rien
    const d0 = (dr[0] && dr[0].data && dr[0].data[String(id)]) || null;
    const a = (d0 && Array.isArray(d0.photos)) ? d0.photos.length : 0;
    if (a > 0) return;                             // on a déjà des photos : le fond complétera le reste
    await completerPhotos(uid, id);
  } catch (_) {}
}

// ⚠️ CAPTURE SANS ATTENDRE UNE NAVIGATION (Julien, 29 sept. : « elle doit être
// bcp plus rapide et pas attendre que je l'ouvre »). L'extension lit la page
// avec la session d'un onglet Vinted ouvert : sans onglet Vinted, rien ne part.
// 22 octobre : UNE page par minute au plus (l'alarme `vrm-photos`), jamais deux
// à moins de `PHOTOS_ECART_MS`, rien pendant qu'il navigue sur Vinted
// (`PHOTOS_CALME_MS`), rien pendant 24 h après un refus de Vinted sur une page
// photo. Dès qu'il ne manque plus rien, une pause (`PHOTOS_TICK_COOLDOWN_MS`)
// pour ne pas relire la base en boucle (§4.4). Aucun délai aléatoire (§3).
// ⚠️⚠️ REVUE DU 23 OCTOBRE — UN TOUR À LA FOIS. L'alarme n'attend pas la fin du
//    tour précédent : quand une page tardait (Vinted qui ralentit, justement
//    quand il freine), les tours suivants repassaient l'écart (compté depuis le
//    DÉPART de la page), relisaient le mémo AVANT que le tour bloqué ne l'ait
//    écrit, et remettaient la MÊME annonce en file — trois pages de la même
//    annonce à 0 s d'écart quand Vinted répondait (reproduit sur 5f6943d). Un
//    tour qui en trouve un autre en cours SORT : la promesse en vol (ce service
//    worker) et un verrou daté dans `chrome.storage.local` (§4.9 : il survit au
//    redémarrage du service worker, `PHOTOS_TOUR_MS` au plus).
const PHOTOS_TOUR = 'vrmPhotosTour';
const PHOTOS_TOUR_MS = 3 * 60 * 1000;
let _tourPhotos = null;
function tickPhotos() {
  if (_tourPhotos) { noterDiag('photos_tour_en_cours'); return Promise.resolve(); }
  _tourPhotos = (async () => {
    try {
      const v = (await chrome.storage.local.get(PHOTOS_TOUR))[PHOTOS_TOUR];
      const age = Date.now() - Number(v && v.at || 0);
      if (v && age >= 0 && age < PHOTOS_TOUR_MS) { noterDiag('photos_tour_en_cours'); return; }
      await chrome.storage.local.set({ [PHOTOS_TOUR]: { at: Date.now() } });
    } catch (_) { return; }                            // stockage illisible : on ne lit aucune page
    try { await tickPhotosUn(); }
    finally { try { await chrome.storage.local.remove(PHOTOS_TOUR); } catch (_) {} }
  })().finally(() => { _tourPhotos = null; });
  return _tourPhotos;
}
async function tickPhotosUn() {
  try {
    await viderFiches();                               // une fiche en attente depuis 10 min part (rien sinon)
    const tabs = await chrome.tabs.query({ url: ['https://*.vinted.fr/*', 'https://*.vinted.com/*', 'https://*.vinted.it/*', 'https://*.vinted.de/*'] });
    if (!tabs || !tabs.length) return;                 // pas d'onglet Vinted : on ne touche à rien
    const uid = await activeUidForDomain('www.vinted.fr');
    if (!uid) return;                                  // pas connecté : rien à capter
    if (await pauseVinted()) return;                   // 5.162 : Vinted a demandé de ralentir
    if (await freinPhotos()) return;                   // 22 oct. : Vinted a refusé une page photo il y a moins de 24 h
    const st = await chrome.storage.local.get([ACTIVITE_VINTED, PHOTOS_DERNIERE, 'vrmPhotosCooldown']);
    const t = Date.now();
    const depuisNav = t - Number(st[ACTIVITE_VINTED] || 0);
    if (depuisNav >= 0 && depuisNav < PHOTOS_CALME_MS) { noterDiag('photos_attend_navigation'); return; }   // il navigue sur Vinted
    const depuisPage = t - Number(st[PHOTOS_DERNIERE] || 0);
    if (depuisPage >= 0 && depuisPage < PHOTOS_ECART_MS) return;                   // l'écart fixe entre deux pages
    const cd = st.vrmPhotosCooldown || {};
    if (t - Number(cd[uid] || 0) < PHOTOS_TICK_COOLDOWN_MS) return; // fini récemment : on ne relit pas la base
    const n = await capterPhotosAnnonces(uid, PHOTOS_PAR_TOUR);
    // Plus rien à faire (ou garde qui refuse) → on met en pause ce compte.
    if (!n) { cd[uid] = Date.now(); await chrome.storage.local.set({ vrmPhotosCooldown: cd }); }
  } catch (_) { /* une capture ratée n'a pas à réveiller d'erreur */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// CE QUI EST EN LIGNE SUR SES AUTRES COMPTES — RELU À CHAQUE VISITE (5.167)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, 11 octobre : « j'avais supprimé mes annonces sur Vinted, il y avait
// encore toutes mes annonces sur VRM — je me retrouve avec trois fois la même
// paire alors qu'il n'y a qu'une seule annonce ». MESURÉ le même jour : l'écran
// Annonces montrait 27 annonces « en ligne », dont 16 d'une lecture du
// 8 octobre (arthuror2, tomj683) — l'extension ne relit le dressing QUE du
// compte connecté dans Chrome, et ces deux-là n'y étaient pas passés (la copie
// qui les lisait n'avait pas de session : ses écritures étaient refusées).
// ⇒ À chaque visite, après la moisson du compte connecté, on relit le dressing
//   PUBLIC de ses AUTRES comptes : `GET /api/v2/wardrobe/{profil}/items`, la
//   requête que la page de profil fait d'elle-même quand on ouvre un dressing.
//   C'est une LECTURE de données publiques, faite avec la session du compte
//   connecté — jamais une action, jamais au nom d'un autre compte, jamais avec
//   les jetons d'un autre compte (`activeFetchAll` est retiré, §3).
// Bornes (§3) : uniquement les comptes LIÉS (`vinted_accounts`), jamais un compte
// masqué dans l'app (`vinted_accounts_hidden`) ni supprimé (`vrm_blocked_accounts`)
// — et « pas su » sur ces listes ⇒ personne n'est lu ; dans la file Vinted (une
// requête à la fois), pause et frein respectés ; sur le budget de LECTURE du
// compte connecté, après l'argent et les colis, avant les photos (`gardeLecture`,
// classe `enligne`) ; au plus 3 comptes par visite, aucun relu depuis moins de
// 30 min ; toutes les pages, jusqu'à la dernière annoncée par Vinted — sinon la
// lecture n'est PAS complète et ne décide rien.
// ⚠️ Revue de la 5.167 : ce paragraphe promettait aussi « jamais un compte refusé
//    par Vinted ». C'était faux : cette liste-là (`vinted_accounts_blocked`) est
//    PROPRE À L'APPAREIL qui l'a vue (elle n'est pas synchronisée — mesuré, absente
//    de `main` chez lui) ; l'extension ne la voit donc pas. Ce n'est pas un risque :
//    la lecture publique se fait avec la session du compte CONNECTÉ, elle ne touche
//    à aucun jeton du compte refusé. On ne promet plus ce qu'on ne lit pas.
// ⚠️⚠️ Revue de la 5.167 — UN 403 SUR UN SEUL COMPTE FAISAIT MONTER LA PAUSE À 4 H.
//    Après un échec, ce compte réessayait dans 5 min (moins que la pause de 15 min)
//    et restait le plus ancien : la première requête partie après CHAQUE pause
//    était celle que Vinted venait de refuser — 15, 30, 60, 120, 240 min, et 705
//    minutes de pause sur 738 en douze heures (prouvé au banc) ; bordereaux,
//    réponses et commandes de l'app bloqués presque tout le temps. C'est la forme
//    exacte du §3. ⇒ Un frein (403/429) sur une lecture publique écarte CE compte
//    24 h (comme les autres lecteurs : codes 6 h, versements et photos 24 h) ; un
//    429 (« ralentis ») ou un second compte freiné dans les 24 h coupe TOUTE la
//    relecture publique pour la journée (c'est le lecteur qui est en cause, pas un
//    compte). Et un compte en échec récent passe APRÈS les autres.
// Rangé dans une ligne DÉDIÉE `harvest_{uid}_enligne` — jamais par-dessus
// `harvest_{uid}_listings` : la vue publique est plus pauvre (vues, boost) et ne
// doit rien effacer. Une lecture ratée ou incomplète n'écrit RIEN.
const ENLIGNE_MAX_PAR_VISITE = 3;
const ENLIGNE_DELAI_MS = 30 * 60 * 1000;
const ENLIGNE_REESSAI_MS = 5 * 60 * 1000;
const ENLIGNE_PAR_PAGE = 96;                 // Vinted plafonne à 96 (mesuré : 101 articles = 2 pages)
const ENLIGNE_MAX_PAGES = 10;
const ENLIGNE_ESSAIS = 'vrmEnLigneEssais';   // { [uid]: ms de la dernière tentative } (§4.9)
const ENLIGNE_FREINS = 'vrmEnLigneFreins';   // { [uid]: ms du dernier 403/429 ; _tous : ms de la coupure } (§4.9)
const ENLIGNE_ECHECS = 'vrmEnLigneEchecs';   // { [uid]: ms du dernier échec (lecture incomplète) }
const ENLIGNE_FREIN_MS = 24 * 3600 * 1000;
const ENLIGNE_ECHEC_RECENT_MS = 48 * 3600 * 1000;
// Le moyen de lire : dans un onglet Vinted ouvert (la requête part de la page,
// avec ses cookies, comme quand on ouvre un dressing), sinon par le service
// worker avec les cookies du compte connecté. Une requête = une place de la file.
// ⚠️⚠️ REVUE DE LA 5.167 — L'ONGLET PEUT QUITTER VINTED PENDANT LA RELECTURE.
//    Il était choisi UNE fois, au début : s'il naviguait vers Leboncoin entre deux
//    pages, `executeScript({target:{tabId}})` injectait dans le document COURANT
//    (aucune épingle d'origine) — la requête partait CHEZ LEBONCOIN, avec le jeton
//    CSRF de Vinted, les identifiants de profil Vinted et les cookies Leboncoin ;
//    et un 403 de Leboncoin posait la pause Vinted (prouvé dans Chromium et au
//    banc : un bordereau commandé juste après était refusé « Vinted demande de
//    ralentir »). ⇒ Avant CHAQUE requête on revérifie l'adresse de l'onglet
//    (sinon on en reprend un autre, ou le repli par cookie) ; la fonction
//    injectée vérifie elle-même `location.hostname` AVANT tout `fetch` et rend
//    son origine ; une réponse qui ne vient pas de Vinted vaut « rien lu »
//    (statut 0) — jamais une pause Vinted.
const VINTED_HOTE = /(^|\.)vinted\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\.uk)$/i;
const ongletEstVinted = (t) => { try { return !!(t && t.id != null && !t.discarded && VINTED_HOTE.test(new URL(String(t.url || '')).hostname)); } catch (_) { return false; } };
async function ongletVinted(prefere) {
  if (prefere != null) {
    try { const t = await chrome.tabs.get(prefere); if (ongletEstVinted(t) && t.status === 'complete') return t; } catch (_) {}
  }
  try {
    const tabs = await chrome.tabs.query({ url: ['https://*.vinted.fr/*', 'https://*.vinted.com/*'] });
    return (tabs || []).find((t) => ongletEstVinted(t) && t.status === 'complete') || null;
  } catch (_) { return null; }
}
// ── LE RELAIS DE LA PAGE : « exécuter dans le monde MAIN » SANS `scripting` ──
// (Orion iPhone, 20 octobre.) Chrome injecte la fonction dans la page
// (`executeScript`, world MAIN) : la requête part DE LA PAGE, avec ses cookies.
// Un navigateur qui n'a pas `scripting`, ou qui refuse le monde MAIN, garde la
// même fonction — exécutée ici — mais chacune de ses requêtes part de la page
// par le relais : fond → content.js (`chrome.tabs.sendMessage`, sinon une
// boîte aux lettres dans `chrome.storage.local`) → inject.js (monde MAIN, déjà
// posé par une balise `<script>`) → `fetch` de la page. Mêmes requêtes, même
// origine, même file Vinted (`requeteVinted`), mêmes garde-fous (§3).
// Sur Chrome, `executerMain` fait exactement l'appel d'avant : rien ne change.
const PAGE_REQ_STORE = 'vrmPageReq', PAGE_REP_STORE = 'vrmPageRep';
const reponsePage = (o) => (o && typeof o === 'object')
  ? { status: Number(o.status) || 0, ok: !!o.ok, origine: String(o.origine || ''),
      json: async () => { if (o.json === undefined || o.json === null) throw new Error('vide'); return o.json; } }
  : { status: 0, ok: false, origine: '', json: async () => { throw new Error('rien'); } };
function demandeParStockage(req, fin) {
  let ecoute = null;
  try {
    ecoute = (ch, zone) => {
      try {
        if (zone !== 'local' || !ch || !ch[PAGE_REP_STORE]) return;
        const v = ch[PAGE_REP_STORE].newValue;
        if (!v || v.id !== req.id) return;
        try { chrome.storage.onChanged.removeListener(ecoute); } catch (_) {}
        try { chrome.storage.local.remove(PAGE_REP_STORE); } catch (_) {}
        fin(v);
      } catch (_) {}
    };
    chrome.storage.onChanged.addListener(ecoute);
    chrome.storage.local.set({ [PAGE_REQ_STORE]: Object.assign({}, req, { at: Date.now() }) });
  } catch (_) { try { if (ecoute) chrome.storage.onChanged.removeListener(ecoute); } catch (_) {} fin(null); }
}
function fetchParLaPage(tabId, p, headers) {
  const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const req = { vrm: 'fetchPage', id, p: String(p || ''), h: (headers && typeof headers === 'object') ? headers : {} };
  return new Promise((res) => {
    let fini = false, t = null;
    const fin = (o) => { if (fini) return; fini = true; clearTimeout(t); res(reponsePage(o)); };
    t = setTimeout(() => fin(null), 25000);
    if (CAP.tabsMsg && tabId != null) {
      try {
        chrome.tabs.sendMessage(tabId, req, (o) => {
          void (chrome.runtime && chrome.runtime.lastError);
          if (o && typeof o === 'object' && o.id === id) fin(o); else demandeParStockage(req, fin);
        });
        return;
      } catch (_) {}
    }
    demandeParStockage(req, fin);
  });
}
async function executerMain(tabId, func, args) {
  if (CAP.scripting && !CAP_MAIN_REFUSE) {
    try { return await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', args, func }); }
    catch (e) {
      const m = String((e && e.message) || e || '');
      // Un refus ORDINAIRE (onglet fermé, page qui navigue) reste un refus, comme avant.
      if (!/world|MAIN|unsupported|not supported|not implemented|is not a function|Unexpected property/i.test(m)) throw e;
      CAP_MAIN_REFUSE = true;
      try { noterDiag('nav_main_refuse'); } catch (_) {}
    }
  }
  let loc = null;
  try { const t = await chrome.tabs.get(tabId); loc = new URL(String((t && t.url) || '')); } catch (_) { loc = null; }
  const relais = {
    fetch: (p, init) => fetchParLaPage(tabId, p, init && init.headers),
    location: loc ? { hostname: loc.hostname, origin: loc.origin } : { hostname: '', origin: '' },
  };
  try { noterDiag('nav_relais_page'); } catch (_) {}
  return [{ result: await func(...(args || []), relais) }];
}
async function lecteurPublic(domain) {
  let tabId = ((await ongletVinted(null)) || {}).id;
  const csrf = lastCsrfByDomain[domain] || '';
  if (tabId == null) return (chemin) => vintedGetCookie(domain, chemin);
  return async (chemin) => {
    // L'onglet a pu naviguer depuis la page précédente : on le revérifie, à chaque fois.
    const tab = await ongletVinted(tabId);
    if (!tab) { noterDiag('enligne_onglet_parti'); tabId = null; return vintedGetCookie(domain, chemin); }
    tabId = tab.id;
    return requeteVinted('public', async () => {
      try {
        const res = await executerMain(tabId, async (p, csrfTok, __relais) => {
            // `__relais` n'existe que hors de Chrome (navigateur sans monde MAIN) :
            // la même fonction, ses requêtes passent par la page (`executerMain`).
            const L = __relais ? __relais.location : (typeof location !== 'undefined' ? location : null);
            const fetch = __relais ? __relais.fetch : globalThis.fetch;
            // Hors de Vinted, AUCUNE requête : un fetch relatif partirait chez l'autre site.
            const hote = String((L && L.hostname) || '');
            const origine = String((L && L.origin) || '');
            if (!/(^|\.)vinted\.(fr|com|it|de|es|be|nl|lu|at|pt|pl|cz|lt|co\.uk)$/i.test(hote)) return { status: 0, ok: false, json: null, horsVinted: true, origine };
            try {
              const h = { accept: 'application/json' };
              if (csrfTok) h['x-csrf-token'] = csrfTok;
              const r = await fetch(p, { credentials: 'include', headers: h });
              let json = null; try { json = await r.json(); } catch (_) {}
              return { status: r.status, ok: r.ok, json, origine };
            } catch (_) { return { status: 0, ok: false, json: null, origine }; }
          }, [chemin, csrf]);
        const o = res && res[0] && res[0].result;
        if (!o || typeof o !== 'object') return { status: 0, ok: false, json: null };
        // La réponse ne vient pas de Vinted : « rien lu » — jamais une pause Vinted.
        let hote = ''; try { hote = new URL(String(o.origine || '')).hostname; } catch (_) {}
        if (o.horsVinted || !VINTED_HOTE.test(hote)) { noterDiag('enligne_hors_vinted'); return { status: 0, ok: false, json: null, horsVinted: true }; }
        return o;
      } catch (_) { return { status: 0, ok: false, json: null }; }
    });
  };
}
// Le dressing public d'UN profil, page par page. `avantPage()` rend un refus
// (budget, pause) ou `null`. Complet SEULEMENT si la boucle s'arrête d'elle-même
// (page vide, ou dernière page annoncée) ET que le total annoncé est atteint.
// ⚠️⚠️ REVUE DE LA 5.167 — UNE LECTURE « DÉCHIRÉE » PASSAIT POUR COMPLÈTE. Une
//    suppression faite entre la page 1 et la page 2 (il supprime et republie
//    tout en ce moment) décale la liste : une annonce TOUJOURS en ligne passe en
//    page 1 déjà lue et n'est jamais vue, le total baisse d'autant, et « lus =
//    total » passait — l'annonce en ligne sortait de VRM, la supprimée y restait
//    (prouvé au banc, et la republiée manquait aussi avec une suppression + une
//    republication). ⇒ Chaque page doit annoncer le MÊME total et le même nombre
//    de pages que la page 1, et quand il y a plusieurs pages on RELIT la page 1 à
//    la fin : mêmes identifiants, même total. Sinon la lecture est « mouvante »,
//    rien n'est rangé, et ce compte réessaie dans 5 min.
// ⚠️ Un 403/429 de Vinted (« non » / « ralentis ») rend `frein` : l'appelant ne
//    réessaie pas ce compte avant le lendemain (§3).
async function lireDressingPublic(lire, pid, avantPage) {
  const vus = new Set(), items = [];
  let total = null, complet = false, raison = 'lecture', statut = 0, pages = 0, signature = null, idsPage1 = null;
  const url = (page) => `/api/v2/wardrobe/${encodeURIComponent(pid)}/items?page=${page}&per_page=${ENLIGNE_PAR_PAGE}`;
  const echec = (r) => {
    statut = Number(r && r.status) || 0;
    if (r && r.pause) return { complet: false, raison: 'vinted-pause' };
    if (freinVinted(statut)) return { complet: false, raison: 'frein', statut };
    return { complet: false, raison: (r && r.horsVinted) ? 'hors-vinted' : 'lecture', statut };
  };
  const sig = (pg) => `${pg.total_entries == null ? '' : String(pg.total_entries)}|${pg.total_pages == null ? '' : String(pg.total_pages)}`;
  for (let page = 1; page <= ENLIGNE_MAX_PAGES; page++) {
    const refus = avantPage ? await avantPage() : null;
    if (refus) return { complet: false, raison: refus.code || 'refus' };
    const r = await lire(url(page));
    if (!r || r.pause || !r.ok || !r.json || !Array.isArray(r.json.items)) return echec(r);
    pages++;
    const lot = r.json.items;
    const pg = r.json.pagination || {};
    if (signature == null) signature = sig(pg);
    else if (sig(pg) !== signature) return { complet: false, raison: 'mouvant' };   // la liste a bougé entre deux pages
    if (page === 1) idsPage1 = lot.map((it) => String(it && it.id)).join(',');
    for (const it of lot) {
      if (!it || it.id == null) continue;
      // L'IDENTITÉ (§5) : un article d'un AUTRE membre n'est jamais rangé sous ce compte.
      const proprio = it.user_id != null ? it.user_id : (it.user && it.user.id);
      if (proprio != null && String(proprio) !== String(pid)) return { complet: false, raison: 'autre-membre' };
      const k = String(it.id);
      if (vus.has(k)) continue;
      vus.add(k); items.push(it);
    }
    if (pg.total_entries != null && pg.total_entries !== '' && isFinite(Number(pg.total_entries))) total = Number(pg.total_entries);
    const tp = Number(pg.total_pages);
    if (!lot.length || (isFinite(tp) && tp > 0 && page >= tp)) { complet = true; break; }
    await wait(1200);
  }
  if (complet && total != null && items.length < total) return { complet: false, raison: 'total', total, n: items.length };
  // Sans total annoncé (forme inattendue, page vide sans pagination), on ne peut
  // pas prouver qu'on a TOUT lu : une réponse vide déciderait sinon que toutes
  // ses annonces sont parties. « Rien lu » ne vaut pas « rien » (§4.1).
  if (complet && total == null) return { complet: false, raison: 'sans-total', n: items.length };
  if (!complet) return { complet: false, raison, statut };
  // Plusieurs pages : la page 1 relue doit être la même (une suppression suivie
  // d'une republication garde le total, mais décale la page 1).
  if (pages > 1) {
    const refus = avantPage ? await avantPage() : null;
    if (refus) return { complet: false, raison: refus.code || 'refus' };
    const r = await lire(url(1));
    if (!r || r.pause || !r.ok || !r.json || !Array.isArray(r.json.items)) return echec(r);
    const pg = r.json.pagination || {};
    if (sig(pg) !== signature || r.json.items.map((it) => String(it && it.id)).join(',') !== idsPage1) return { complet: false, raison: 'mouvant' };
  }
  return { complet: true, items, total };
}
// La dernière lecture de chaque compte (son dressing ou sa lecture publique),
// en scalaires (§4.4). `null` = la base n'a pas répondu (« pas su »).
async function lecturesParCompte() {
  const a = await sbGet('app_data?id=like.harvest_*_listings&select=id,cap:meta->>capturedAt');
  const b = await sbGet('app_data?id=like.harvest_*_enligne&select=id,cap:meta->>capturedAt');
  if (a === null || b === null) return null;
  const m = new Map();
  for (const r of [...a, ...b]) {
    const k = /^harvest_(\d+)_(?:listings|enligne)$/.exec(String((r && r.id) || ''));
    if (!k) continue;
    const t = Date.parse((r && r.cap) || '');
    if (isFinite(t) && t > (m.get(k[1]) || 0)) m.set(k[1], t);
  }
  return m;
}
async function relireAnnoncesAutresComptes(uidConnecte) {
  try {
    if (!uidConnecte) return 0;
    if (await pauseVinted()) return 0;
    if (await sansSessionPourEcrire()) { noterDiag('enligne_sans_session'); return 0; }
    const st0 = await chrome.storage.local.get([ENLIGNE_ESSAIS, ENLIGNE_FREINS, ENLIGNE_ECHECS]);
    const freins = st0[ENLIGNE_FREINS] || {}, echecs = st0[ENLIGNE_ECHECS] || {};
    if (Date.now() - Number(freins._tous || 0) < ENLIGNE_FREIN_MS) { noterDiag('enligne_coupee_frein'); await noterLecturesDues(uidConnecte, 'enligne', 0); return 0; }
    const accts = await getStoredAccounts({ ouNull: true });
    if (!Array.isArray(accts)) { noterDiag('enligne_comptes_pas_lus'); return 0; }
    const acc = accts.find((a) => String(a.vinted_user_id) === String(uidConnecte));
    if (!acc) return 0;                       // la session de lecture doit être celle d'un de SES comptes
    const noirs = await blockedAccounts();
    if (!noirs) { noterDiag('enligne_supprimes_pas_lus'); return 0; }      // pas su : on ne lit personne
    const main = await lireMain(['vinted_accounts_hidden', 'vinted_accounts_blocked']);
    if (main === null) { noterDiag('enligne_exclus_pas_lus'); return 0; }
    const off = new Set([...(main.vinted_accounts_hidden || []), ...(main.vinted_accounts_blocked || [])].map(String));
    const lus = await lecturesParCompte();
    if (lus === null) { noterDiag('enligne_dates_pas_lues'); return 0; }
    const refuses = await comptesRefuses();   // 5.191 : « Non, ignorer ce compte » dans ce Chrome
    const essais = st0[ENLIGNE_ESSAIS] || {};
    const t = Date.now();
    const recent = (u) => (t - Number(echecs[u] || 0) < ENLIGNE_ECHEC_RECENT_MS) || (t - Number(freins[u] || 0) < ENLIGNE_ECHEC_RECENT_MS);
    const candidats = [...new Set(accts.map((a) => String((a && a.vinted_user_id) || '')))]
      .filter((u) => u && u !== String(uidConnecte) && !noirs.has(u) && !off.has(u) && !refuses.has(u))
      .filter((u) => !(t - Number(freins[u] || 0) < ENLIGNE_FREIN_MS))             // freiné : pas avant demain
      .filter((u) => !(t - Number(essais[u] || 0) < ENLIGNE_DELAI_MS))
      .filter((u) => !(t - Number(lus.get(u) || 0) < ENLIGNE_DELAI_MS))
      // Le plus ancien d'abord — mais un compte en échec récent APRÈS les autres :
      // sinon il repasse en tête à chaque visite et prend la place des autres.
      .sort((a, b) => (Number(recent(a)) - Number(recent(b))) || (Number(lus.get(a) || 0) - Number(lus.get(b) || 0)));
    // Ce qui reste à lire se NOTE : les photos s'arrêtent avant (`reserveLectures`).
    await noterLecturesDues(uidConnecte, 'enligne', candidats.length);
    if (!candidats.length) return 0;
    const domain = acc.domain || 'www.vinted.fr';
    const lire = await lecteurPublic(domain);
    let n = 0, tentes = 0;
    const ranges = new Set();
    const ranger = async () => { try { await chrome.storage.local.set({ [ENLIGNE_ESSAIS]: essais, [ENLIGNE_FREINS]: freins, [ENLIGNE_ECHECS]: echecs }); } catch (_) {} };
    for (const uid of candidats) {
      if (tentes >= ENLIGNE_MAX_PAR_VISITE) break;
      if (await pauseVinted()) break;
      const pid = await profilIdRange(uid);
      if (!pid) { noterDiag(pid === null ? 'enligne_profil_pas_lu' : 'enligne_sans_profil'); continue; }
      tentes++;
      const debut = Date.now();
      essais[uid] = debut;
      await ranger();
      const lu = await lireDressingPublic(lire, pid, () => gardeLecture(uidConnecte, acc, 'enligne'));
      if (!lu.complet) {
        noterDiag(`enligne_incomplet_${lu.raison}`);
        if (lu.raison === 'frein') {
          // Vinted a dit non (403) ou ralentis (429) : ce compte attend demain. Un
          // 429, ou un SECOND compte freiné dans les 24 h, coupe toute la relecture
          // publique pour la journée — c'est le lecteur qui est en cause.
          const autre = Object.keys(freins).some((u) => u !== '_tous' && u !== uid && t - Number(freins[u] || 0) < ENLIGNE_FREIN_MS);
          freins[uid] = Date.now();
          if (Number(lu.statut) === 429 || autre) { freins._tous = Date.now(); noterDiag('enligne_coupee_frein'); }
          echecs[uid] = Date.now();
          await ranger();
          break;
        }
        // Rien de rangé : ce compte réessaie dans 5 min (jamais en rafale) —
        // pas dans 30, sa lecture n'a pas eu lieu. Un échec qui vient de CE
        // dressing (lecture, total, liste qui bouge, autre membre) le fait passer
        // après les autres ; une pause, un budget vide ou un compte changé ne
        // sont pas de son fait.
        essais[uid] = Date.now() - ENLIGNE_DELAI_MS + ENLIGNE_REESSAI_MS;
        if (['lecture', 'total', 'sans-total', 'mouvant', 'autre-membre'].includes(lu.raison)) echecs[uid] = Date.now();
        await ranger();
        // Vinted freine, le budget est vide ou le compte a changé : on s'arrête là.
        if (lu.raison === 'vinted-pause' || lu.raison === 'lectures-reservees' || lu.raison === 'trop-de-lectures' || lu.raison === 'autre-compte') break;
        continue;
      }
      const ouvertes = lu.items.filter((it) => ouverteSurVinted(it) && !venduePourSonVendeur(it)).map(articleMaigre);
      const data = { type: 'enligne', uid: String(uid), pid: String(pid), source: 'public', complet: true,
        capturedAt: new Date(debut).toISOString(), n: ouvertes.length, ids: ouvertes.map((x) => String(x.id)),
        items: ouvertes, lus: lu.items.length, total: lu.total, ver: EXT_VERSION };
      const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_enligne`, data, updated_at: data.capturedAt }], 'id');
      if (ok === false) {
        noterDiag('enligne_ecriture_ratee');
        essais[uid] = Date.now() - ENLIGNE_DELAI_MS + ENLIGNE_REESSAI_MS;
        await ranger();
        continue;
      }
      delete echecs[uid];
      await ranger();
      ranges.add(uid);
      n++;
      noterDiag('enligne_range');
      notifierApp({ type: 'maj', quoi: 'annonces', uid: String(uid) });
    }
    // Ce qu'il reste à lire, pour la réserve : rien quand la relecture est coupée
    // pour la journée (les photos n'ont pas à attendre ce qui ne viendra pas).
    const coupee = Date.now() - Number(freins._tous || 0) < ENLIGNE_FREIN_MS;
    const restent = coupee ? 0 : candidats.filter((u) => !ranges.has(u) && !(Date.now() - Number(freins[u] || 0) < ENLIGNE_FREIN_MS)).length;
    await noterLecturesDues(uidConnecte, 'enligne', restent);
    if (n) logActivity(`🟢 Annonces en ligne relues sur ${n} autre${n > 1 ? 's' : ''} compte${n > 1 ? 's' : ''}`);
    return n;
  } catch (_) { return 0; }
}

// MÊME EXPRESSION que `isAwaitingShipStatus` (src/App.jsx) et `awaitingShip`
// (api/widget.js) — « Bordereau d'envoi commandé » (4 oct.) et « Commande du
// bordereau d'envoi validée » (1er sept.) sont la même étape que « bordereau
// envoyé » : la vente attend l'envoi. `audit-statuts.cjs` compare les trois.
const AWAITING_SHIP = (s) => /bordereau\s+envoy[ée]\s+au\s+vendeur|bordereau\s+d.envoi\s+command|commande\s+du\s+bordereau/i.test(s || '') || /paiement.*valid/i.test(s || '');
// ── « CETTE VENTE ATTEND-ELLE L'ENVOI ? » — LA RÈGLE DE L'APP (`aExpedier`) ──
// Le champ machine de Vinted (`transaction_user_status`, présent sur 1 505
// ventes sur 1 505) d'abord ; le texte seulement pour une vieille capture. Un
// texte qui dit annulé / remboursé / retour / finalisé / paiement échoué gagne
// toujours. Sur une liste d'ACHATS, `needs_action` veut dire « va retirer » :
// cette règle ne s'applique qu'aux VENTES. Le repli texte est celui de l'app
// (`needsBordereau`) — un statut inconnu compte comme à expédier : mieux vaut
// proposer un colis que le cacher.
const PAS_UN_ENVOI = /annul|cancel|refus|rembours|retour|suspend|finalis|paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement/i;
// ⚠️ 17 octobre — la Nike Air Max 1 nB546 (tx 22592792923) en LITIGE revenait
//    dans « à faire » : Vinted la liste « La livraison n'a pas encore eu lieu -
//    colis déposé en bureau de Poste ou point relais » avec `needs_action` — le
//    colis de RETOUR ; sa transaction dit 440 « Retour initié ». `needs_action`
//    ne vaut « à expédier » que si le texte ne dit pas que le colis a DÉJÀ
//    bougé. Le MÊME texte que l'app (`COLIS_DEJA_BOUGE`, §11 — audit-statuts).
const COLIS_DEJA_BOUGE = /d[ée]pos[ée]|exp[ée]di[ée]|achemin|transit|livr[ée]e?\b|non\s+r[ée]clam|r[ée]ceptionn/i;
function besoinBordereauTexte(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return true;
  if (/annul|refus|rembours|cancel|retour|suspend/.test(s)) return false;
  if (/paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement/.test(s)) return false;
  if (/finalis|termin|complet|cl[oô]tur/.test(s)) return false;
  if (AWAITING_SHIP(s)) return true;
  if (/exp[eé]di|envoy|transit|achemin|en route|livr|remis|r[ée]ception/.test(s)) return false;
  return true;
}
function A_EXPEDIER(o) {
  if (!o) return false;
  const s = String(o.status || '');
  if (PAS_UN_ENVOI.test(s)) return false;
  const t = String(o.transaction_user_status || '').toLowerCase();
  if (t === 'needs_action') return !COLIS_DEJA_BOUGE.test(s);
  if (t === 'waiting' || t === 'completed' || t === 'failed') return false;
  return besoinBordereauTexte(s);
}
// ⚠️ ÉLARGI le 20 sept. : l'ancienne règle ne reconnaissait que « déposé en
// point relais / bureau de poste ». Les colis Vinted Go (casier/consigne) et les
// statuts « prêt à être retiré / disponible » étaient donc INVISIBLES — leur
// conversation jamais ouverte, leur code jamais capté (plainte de Julien). On
// ajoute ces formes, en EXCLUANT d'abord ce qui n'est pas à retirer (livré à
// domicile, finalisé, annulé, remboursé, retour). Lire une conversation de trop
// est une LECTURE bornée sans risque ; en manquer une fait perdre un colis —
// l'asymétrie penche vers l'élargissement. EXPRESSION IDENTIQUE à
// `isAtRelayStatus` (src/App.jsx), §11 : les deux comparées par audit-coherence.
const AT_RELAY = (s) => !!(s) && !/livr[ée]\s+(?:chez|à\s+(?:ton|votre|son)\s+domicile|à\s+domicile)/i.test(s) && !/finalis|termin|annul|rembours|retour/i.test(s) && ((/d[ée]pos[ée]|arriv[ée]/i.test(s) && /point\s+relais|bureau\s+de\s+poste|casier|consigne|locker|vinted\s*go|point\s+de\s+retrait/i.test(s)) || /pr[êe]t\s+à\s+[êe]tre\s+retir/i.test(s) || (/disponible|à\s+retirer|au\s+point\s+de\s+retrait/i.test(s) && /relais|bureau\s+de\s+poste|casier|consigne|point|retrait|locker|vinted\s*go/i.test(s)));
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
// ⚠️ UN COLIS QUI PART N'EST JAMAIS UN COLIS À RETIRER. « Article à emballer et
// envoyer », « imprime le bordereau », « dépose ton colis dans n'importe quel
// point relais » parlent de point relais mais pour un ENVOI. On l'écarte EN
// PREMIER, avant toute reconnaissance d'arrivée.
const CONV_SORTANT = /à\s+emballer|à\s+envoyer|imprime\s+(?:le|ton)\s+bordereau|bordereau\s+d['’]envoi|pr[ée]pare\s+ta\s+commande|d[ée]pose\s+(?:ensuite\s+)?(?:ton|votre)\s+colis/i;
// Le message d'ARRIVÉE au point de retrait — dans TOUTES ses formulations.
// ⚠️ ÉLARGI le 20 sept. : l'ancienne règle n'acceptait que « ton colis est
// arrivé » / « t'attend à l'adresse ». « Rends-toi au point relais Phone Cash… »
// (Mondial Relay) et « Récupère-le au casier Vinted Go. Scanne ton code de
// retrait » étaient MANQUÉS — leur code jamais capté (plainte de Julien). On
// reconnaît aussi « rends-toi », « récupère-le au », « livré dans le point
// relais/casier/consigne », « prêt à être retiré », « scanne/code de retrait ».
// On ne prend PAS « est disponible » seul (un « bordereau disponible » n'est pas
// un retrait) : la garde reste l'extraction d'un code/lieu/qr plus bas.
const CONV_ARRIVE = /(?:ton\s+colis|ta\s+commande)\s+est\s+arriv|t['’]attend\s+à\s+l['’]adresse|rends[-\s]toi\s+(?:au|à|dans|chez)|(?:a\s+été|est)\s+livr[ée]\s+(?:dans|au)\s+(?:le\s+|la\s+)?(?:point\s+relais|bureau|casier|consigne)|pr[êe]t\s+à\s+[êe]tre\s+retir|scanne\s+ton\s+code\s+de\s+retrait|code\s+de\s+retrait|r[ée]cup[èe]re[-\s]le\s+(?:au|à|dans|chez)/i;
function retraitDeConversation(conv) {
  try {
    const c = (conv && conv.conversation) || conv || {};
    const t = c.transaction || {};
    // ⚠️ CÔTÉ ACHETEUR UNIQUEMENT. Côté vendeur, « la commande est arrivée »
    // veut dire que l'ACHETEUR l'a reçue — ce n'est pas un colis pour nous.
    if (String(t.current_user_side || '') === 'seller') return null;
    let trouve = null, arriveMs = null;
    for (const m of (Array.isArray(c.messages) ? c.messages : [])) {
      if (!m || (m.entity_type !== 'action_message' && m.entity_type !== 'status_message')) continue;
      const e = m.entity || {};
      const titre = sansBalises(e.title);
      const sous = sansBalises(e.subtitle);
      const brut = titre + ' ' + sous;
      if (CONV_SORTANT.test(brut)) continue;   // un colis qui PART, jamais à retirer
      if (!CONV_ARRIVE.test(brut)) continue;
      // 5.204 : la VRAIE date d'arrivée = l'heure du PREMIER message d'arrivée
      // (`created_at_ts`, mesuré le 21 oct. : ISO avec décalage, « 2026-10-13T
      // 10:08:35+02:00 »). Un rappel plus tardif ne la repousse pas. Illisible ⇒
      // rien (l'app retombe sur « au plus tard », jamais une date inventée).
      const ms = msDeTsMessage(m);
      if (ms && (arriveMs === null || ms < arriveMs)) arriveMs = ms;
      // On garde le HTML BRUT : « Scanne ton code de retrait » est un LIEN, et
      // c'est derrière lui que vit le QR (capture d'écran de Julien).
      trouve = { titre, sous, html: String(e.subtitle || ''), actions: e.actions || [] };
    }
    if (!trouve) return null;
    const txt = trouve.titre + ' ' + trouve.sous;
    // Lieu : ce qui suit le marqueur, jusqu'à la fin de la phrase.
    let lieu = '';
    for (const re of [/à\s+l['’]adresse\s+suivante\s*:\s*/i, /livr[ée]\s+dans\s+le\s+[Pp]oint\s+[Rr]elais\s+/i,
                      /livr[ée]\s+(?:dans|à|au|chez)\s+/i, /t['’]attend\s+(?:dans|à|au|chez)\s+/i,
                      /rends[-\s]toi\s+(?:au|à\s+la|à|dans\s+le|dans\s+la|chez)\s+/i,
                      /r[ée]cup[èe]re[-\s]le\s+(?:au|à\s+la|à|dans\s+le|dans\s+la|chez)\s+/i]) {
      const m = txt.match(re); if (!m) continue;
      lieu = txt.slice(m.index + m[0].length).split(/\.\s|\.$/)[0].trim();
      // ⚠️ « Rends-toi au … Saint-Malo POUR RÉCUPÉRER ta commande » : on coupe la
      // consigne qui suit l'adresse, sans toucher aux adresses (elles ne portent
      // pas « pour récupérer »).
      if (lieu) { lieu = lieu.replace(/\s+pour\s+(?:le\s+|la\s+|les\s+|l['’])?r[ée]cup[ée]r\w*.*$/i, '').trim(); }
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
    // (5.179) LE TRANSPORTEUR, SEULEMENT S'IL EST ÉCRIT EN TOUTES LETTRES dans le
    // message (« Mondial Relay », « Vinted Go »…). Jamais déduit du mot « point
    // relais » (tous le disent) : sans nom, on laisse vide.
    const TRANSP = [[/vinted\s*go/i, 'vinted'], [/mondial\s*relay/i, 'mondialrelay'], [/relais\s*colis/i, 'relaiscolis'],
      [/chronopost|pickup\s*station/i, 'chronopost'], [/inpost/i, 'inpost'], [/colissimo|la\s+poste/i, 'colissimo'],
      [/\bups\b/i, 'ups'], [/\bdpd\b/i, 'dpd'], [/\bgls\b/i, 'gls'], [/\bdhl\b/i, 'dhl'], [/shop2shop/i, 'shop2shop']];
    const vus = TRANSP.filter(([re]) => re.test(txt)).map(([, k]) => k);
    const transporteur = vus.length === 1 ? vus[0] : '';   // deux noms dans le texte = on ne choisit pas
    const cid = String(c.id || '');
    return {
      tx: String(t.id || ''), item: String(t.item_id || ''),
      titre: String(t.item_title || c.subtitle || c.description || ''),
      photo: (t.item_photo && t.item_photo.url) || null,
      lieu, code, qr, transporteur, conv: cid,
      url: c.conversation_url || (cid ? `https://www.vinted.fr/inbox/${cid}` : ''),
      ...(arriveMs ? { arriveLe: new Date(arriveMs).toISOString() } : {}),
      at: new Date().toISOString(),
    };
  } catch (_) { return null; }
}
// L'heure d'un message de conversation (5.204). Vinted l'écrit en ISO avec
// décalage (mesuré) ; une forme en secondes ou millisecondes est lue aussi.
// Rend des millisecondes, ou `null` (illisible, ou absurde : avant 2020 ou plus
// d'un jour dans le futur) — jamais une date devinée.
function msDeTsMessage(m) {
  const v = m && (m.created_at_ts ?? (m.entity && m.entity.created_at_ts) ?? m.created_at);
  if (v == null || v === '') return null;
  const n = Number(v);
  const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(v));
  if (!Number.isFinite(ms) || ms < Date.UTC(2020, 0, 1) || ms > Date.now() + 86400000) return null;
  return ms;
}

// La ligne DÉDIÉE que l'app lit (motif anti-clobber §35 : le panneau n'écrit
// jamais `main`). Clé = n° de transaction, l'identité de l'achat (§24) — jamais
// un rapprochement par titre. Une entrée de plus de 45 jours est purgée : un
// colis n'attend pas si longtemps, et la ligne doit rester légère (§34).
const RETRAIT_MAX_J = 45;
// ⚠️ Rend `true` UNIQUEMENT si quelque chose de NEUF a été écrit ET que la base
//    l'a accepté (avant : `true` même quand l'écriture échouait — le journal
//    annonçait « code récupéré » sur un code qui n'était nulle part). C'est
//    aussi ce qui prévient l'app (`maj · retrait`) : un seul endroit, quel que
//    soit le chemin (conversation passive ou `capterRetraits`).
// Rend `true` (un code neuf, rangé) · `false` (rien de neuf, ou rien à ranger) ·
// `null` (la base n'a pas répondu ou a refusé : le code lu n'est PAS rangé —
// relecture croisée de la 5.174 : `capterRetraits` le relit alors à la visite
// suivante au lieu d'attendre 6 h).
async function noterRetrait(r, uid) {
  if (!r || !r.tx) return false;
  try {
    const rows = await sbGet('app_data?id=eq.panel_colis_relais&select=data');
      // ⚠️ LECTURE RATÉE ≠ LIGNE VIDE. `sbGet` rend `null` quand la base n'a pas
    //    répondu ; repartir de `{}` et réécrire la ligne ENTIÈRE efface tout le
    //    reste. On n'écrit pas.
    //    Ici on perdrait les CODES DE RETRAIT déjà lus dans les conversations.
    if (rows === null) return null;
    const cur = (rows[0] && rows[0].data) || {};
    const avant = cur[r.tx];
    // Un message plus récent qui ne NOMME pas le transporteur ne l'efface pas.
    if (!r.transporteur && avant && avant.transporteur) r = { ...r, transporteur: avant.transporteur };
    // 5.204 : la date d'arrivée déjà rangée est la PREMIÈRE vue — un rappel
    // relu plus tard ne la repousse pas, une relecture sans elle ne l'efface pas.
    if (avant && avant.arriveLe && !isNaN(Date.parse(avant.arriveLe))
        && (!r.arriveLe || Date.parse(avant.arriveLe) <= Date.parse(r.arriveLe))) r = { ...r, arriveLe: avant.arriveLe };
    // Rien de neuf → aucune écriture (égress, §34).
    if (avant && avant.code === r.code && avant.lieu === r.lieu && avant.qr === r.qr && (avant.transporteur || '') === (r.transporteur || '')
        && (avant.arriveLe || '') === (r.arriveLe || '')) return false;
    // 5.204 : un CODE NEUF (aucun avant, ou un autre) appelle « 📍 Colis à
    // retirer » — la voie email était seule à sonner. Seulement un vrai code
    // (des chiffres, `CODE_APRES`) ; un lieu sans code ne sonne pas.
    const codeNeuf = !!(r.code && /\d/.test(String(r.code)) && (!avant || avant.code !== r.code));
    const limite = Date.now() - RETRAIT_MAX_J * 86400000;
    const out = {};
    for (const k in cur) { const v = cur[k]; if (v && Date.parse(v.at || '') > limite) out[k] = v; }
    out[r.tx] = r;
    const ok = await supabaseUpsert('app_data', [{ id: 'panel_colis_relais', data: out }], 'id');
    if (ok === false) { noterDiag('retrait_conv_ecriture_ratee'); return null; }
    noterDiag('retrait_conv_ecrit');
    if (uid) notifierApp({ type: 'maj', quoi: 'retrait', uid: String(uid), tx: String(r.tx) });
    if (codeNeuf) { await mettreNotifRetrait(r.tx); await envoyerNotifsRetrait(); }
    return true;
  } catch (_) { return null; }
}

// ── « 📍 COLIS À RETIRER » QUAND L'EXTENSION RANGE UN CODE NEUF (5.204) ─────
// Seul le serveur sait envoyer une notification (clé VAPID). On lui dit QUELLE
// transaction (jamais le code ni le lieu : il relit SA ligne `panel_colis_relais`
// avec la session du vendeur, et décide). L'anti-doublon vit chez lui
// (`push_dedup`, partagé avec la voie email par le code de retrait).
// La file vit dans `chrome.storage.local` (§4.9) : un envoi raté (réseau, 5xx,
// session absente) est retenté à la visite suivante, 24 h au plus ; un refus
// jugé (4xx) est oublié. Le serveur dédoublonne : un nouvel essai ne sonne pas
// deux fois.
const NOTIF_RETRAIT_URL = 'https://vrm.center/api/push';
const NOTIF_RETRAIT_MAX_MS = 24 * 3600000;
async function mettreNotifRetrait(tx) {
  try {
    if (!/^\d+$/.test(String(tx || ''))) return;
    const f = (await chrome.storage.local.get('vrmRetraitNotifs')).vrmRetraitNotifs || {};
    if (!f[tx]) f[tx] = { at: Date.now(), essais: 0 };
    await chrome.storage.local.set({ vrmRetraitNotifs: f });
  } catch (_) {}
}
async function envoyerNotifsRetrait() {
  try {
    const f = (await chrome.storage.local.get('vrmRetraitNotifs')).vrmRetraitNotifs || {};
    const txs = Object.keys(f);
    if (!txs.length) return 0;
    const s = await authToken();
    if (!s || !s.access_token) { noterDiag('retrait_notif_sans_session'); return 0; }   // pas su : on garde
    let n = 0;
    for (const tx of txs.slice(0, 5)) {
      const e = f[tx] || {};
      if (Date.now() - Number(e.at || 0) > NOTIF_RETRAIT_MAX_MS) { delete f[tx]; continue; }
      let status = 0;
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(NOTIF_RETRAIT_URL, { method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
          body: JSON.stringify({ action: 'retrait', tx: String(tx) }) });
        clearTimeout(t); status = r.status;
      } catch (_) { status = 0; }
      if (status >= 200 && status < 300) { delete f[tx]; n++; noterDiag('retrait_notif_envoyee'); }
      else if (status >= 400 && status < 500 && status !== 401 && status !== 429) { delete f[tx]; noterDiag(`retrait_notif_refus_${status}`); }
      else { f[tx] = { ...e, essais: Number(e.essais || 0) + 1 }; noterDiag(`retrait_notif_ko_${status || 'reseau'}`); }
    }
    await chrome.storage.local.set({ vrmRetraitNotifs: f });
    return n;
  } catch (_) { return 0; }
}

// ══ À CONFIRMER AVANT LA DATE LIMITE (5.204, 21 octobre) ═════════════════════
// MESURÉ en lecture seule sur sa base (21 oct.) : le seul message qui porte une
// date limite de confirmation est l'action « Confirmation nécessaire » —
// `event_type: delivered`, actions `all_is_good` (« Tout est OK ») et
// `i_have_issues`, `interpolation_values.subtitle.return_shipment_date`
// (« 21 sept. 15:59 », SANS année), « tu disposeras de 2 jours ». Vu dans 2
// conversations, toutes deux côté VENDEUR, `event_group: return_shipment` :
// c'est un RETOUR qui lui revient (vente en statut 440) et qu'il doit vérifier.
// Côté acheteur, aucune conversation captée ne porte ce message (13 achats :
// « Livrée » puis « Profite de ta commande ! »). La règle est donc posée sur la
// FORME du message (l'action `all_is_good`), pas sur le côté : un achat qui la
// porte un jour est pris pareil (`quoi: 'achat'`), un retour (`'retour'`).
// En attente seulement si c'est la DERNIÈRE action de la conversation (une
// action plus récente — « Ta vente est finalisée », un remboursement — dit que
// c'est réglé). L'ANNÉE se lit sans deviner : le message a sa date complète
// (`created_at_ts`) ; on garde l'année (ou la suivante) qui place la limite
// entre la veille du message et 30 jours après. Sinon : `limiteMs: null`, « pas
// su », et l'app recopie le texte de Vinted tel quel.
const CONFIRMER_ACTION = 'all_is_good';
const MOIS_FR = { 'janv': 0, 'jan': 0, 'févr': 1, 'fevr': 1, 'fév': 1, 'fev': 1, 'mars': 2, 'mar': 2, 'avr': 3, 'mai': 4, 'juin': 5,
  'juil': 6, 'août': 7, 'aout': 7, 'sept': 8, 'sep': 8, 'oct': 9, 'nov': 10, 'déc': 11, 'dec': 11 };
// L'instant UTC d'une heure de Paris (le texte de Vinted est en heure de Paris).
function msDeParis(y, mo, d, h, mi) {
  const voulu = Date.UTC(y, mo, d, h, mi);
  let g = voulu;
  for (let i = 0; i < 2; i++) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(g))) p[x.type] = Number(x.value);
    g += voulu - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return g;
}
// « 21 sept. 15:59 » + l'instant du message ⇒ { limiteMs, limite: 'AAAA-MM-JJTHH:MM' } ou null.
function limiteDeConfirmation(texte, msgMs) {
  const m = String(texte || '').trim().match(/^(\d{1,2})\s+([a-zéûô]+)\.?(?:\s+(\d{1,2})[:h](\d{2}))?/i);
  if (!m || !msgMs) return null;
  const mo = MOIS_FR[m[2].toLowerCase()];
  const d = Number(m[1]), h = m[3] != null ? Number(m[3]) : 23, mi = m[4] != null ? Number(m[4]) : 59;
  if (mo == null || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const y0 = new Date(msgMs).getUTCFullYear();
  for (const y of [y0, y0 + 1]) {
    if (new Date(Date.UTC(y, mo, d)).getUTCMonth() !== mo) continue;     // 31 sept. : n'existe pas
    const ms = msDeParis(y, mo, d, h, mi);
    if (ms >= msgMs - 86400000 && ms <= msgMs + 30 * 86400000) {
      return { limiteMs: ms, limite: `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` };
    }
  }
  return null;
}
// Rend null (rien à juger : pas de transaction), { tx, resolu: true } (aucune
// confirmation en attente), ou l'entrée à ranger.
function confirmationDeConversation(conv) {
  try {
    const c = (conv && conv.conversation) || conv || {};
    const t = c.transaction || {};
    const tx = String(t.id || '');
    if (!/^\d+$/.test(tx)) return null;
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    let derniere = null, derniereMs = -1;
    for (const m of msgs) {
      if (!m || m.entity_type !== 'action_message') continue;
      const ms = msDeTsMessage(m) || 0;
      if (ms >= derniereMs) { derniere = m; derniereMs = ms; }
    }
    const e = (derniere && derniere.entity) || {};
    const acts = Array.isArray(e.actions) ? e.actions : [];
    if (!derniere || !acts.some(a => a && a.action === CONFIRMER_ACTION)) return { tx, resolu: true };
    const iv = (e.interpolation_values && e.interpolation_values.subtitle) || {};
    const brut = String(iv.return_shipment_date || '').trim();
    const msgMs = msDeTsMessage(derniere);
    const lim = limiteDeConfirmation(brut, msgMs);
    const cid = String(c.id || '');
    const cote = String(t.current_user_side || '');
    return {
      tx, conv: cid, item: String(t.item_id || ''),
      titre: String(t.item_title || c.subtitle || c.description || '').slice(0, 120),
      photo: (t.item_photo && t.item_photo.url) || null,
      quoi: (derniere.event_group === 'return_shipment' || cote === 'seller') ? 'retour' : 'achat',
      limiteTexte: brut.slice(0, 40),
      limite: lim ? lim.limite : null, limiteMs: lim ? lim.limiteMs : null,
      msgAt: msgMs ? new Date(msgMs).toISOString() : null,
      url: c.conversation_url || (cid ? `https://www.vinted.fr/inbox/${cid}` : ''),
      at: new Date().toISOString(),
    };
  } catch (_) { return null; }
}
// La ligne DÉDIÉE (`panel_a_confirmer`, jamais `main`), indexée par transaction.
// Lire-fusionner-réécrire GARDÉ : une lecture ratée n'écrit RIEN. Une entrée
// réglée (`resolu`) est retirée ; une entrée dont la limite est passée depuis
// 7 jours (ou lue il y a plus de 30 jours) est purgée. Rend true (écrit) ·
// false (rien de neuf) · null (la base n'a pas répondu ou a refusé).
async function noterConfirmation(c, uid) {
  if (!c || !c.tx) return false;
  try {
    const rows = await sbGet('app_data?id=eq.panel_a_confirmer&select=data');
    if (rows === null) return null;
    const cur = (rows[0] && rows[0].data) || {};
    const avant = cur[c.tx];
    if (c.resolu && !avant) return false;
    const entree = c.resolu ? null : { ...c, uid: String(uid || '') };
    if (avant && entree && avant.limite === entree.limite && avant.limiteTexte === entree.limiteTexte
        && avant.conv === entree.conv && avant.quoi === entree.quoi && avant.uid === entree.uid) return false;
    const out = {};
    const tropVieux = Date.now() - 30 * 86400000, limPassee = Date.now() - 7 * 86400000;
    for (const k in cur) {
      const v = cur[k]; if (!v || k === c.tx) continue;
      if (Number.isFinite(v.limiteMs) && v.limiteMs < limPassee) continue;
      if (!(Date.parse(v.at || '') > tropVieux)) continue;
      out[k] = v;
    }
    if (entree) out[c.tx] = entree;
    const ok = await supabaseUpsert('app_data', [{ id: 'panel_a_confirmer', data: out }], 'id');
    if (ok === false) { noterDiag('confirmer_ecriture_ratee'); return null; }
    noterDiag(entree ? 'confirmer_ecrit' : 'confirmer_regle');
    if (uid) notifierApp({ type: 'maj', quoi: 'confirmer', uid: String(uid), tx: String(c.tx) });
    return true;
  } catch (_) { return null; }
}
// Les conversations à lire : un ACHAT « Commande livrée » qui attend son geste
// (`needs_action`), et une VENTE dont le retour est en cours (« Retour initié »,
// le colis qui revient) — jamais une commande finalisée, annulée, remboursée.
const A_CONFIRMER_ACHAT = (o) => !!o && /livr[ée]e/i.test(String(o.status || '')) && !/pas encore|non r[ée]clam|finalis|annul|rembours/i.test(String(o.status || ''))
  && String(o.transaction_user_status || '') === 'needs_action';
const A_CONFIRMER_RETOUR = (o) => !!o && /retour/i.test(String(o.status || '')) && !/finalis|annul|rembours|effectu/i.test(String(o.status || ''));
const CONFIRMER_MAX_PAR_VISITE = 3;
async function capterConfirmations(uid) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    const ra = await sbGet(`app_data?id=eq.harvest_${uid}_orders_purchased&select=v:data->payload->my_orders`);
    const rv = await sbGet(`app_data?id=eq.harvest_${uid}_orders_sold&select=v:data->payload->my_orders`);
    if (ra === null || rv === null) return 0;                                   // pas su : rien
    const liste = (r) => (r && r[0] && Array.isArray(r[0].v)) ? r[0].v : [];
    const cibles = [...liste(ra).filter(A_CONFIRMER_ACHAT), ...liste(rv).filter(A_CONFIRMER_RETOUR)]
      .filter(o => o.conversation_id != null && o.transaction_id != null);
    if (!cibles.length) return 0;
    const memo = (await chrome.storage.local.get('vrmConfirmerFaits')).vrmConfirmerFaits || {};
    let n = 0;
    for (const o of cibles) {
      if (n >= CONFIRMER_MAX_PAR_VISITE) break;
      const cid = String(o.conversation_id);
      if (memo[cid] && Date.now() - Number(memo[cid]) < BORD_RETRY_MS) continue;
      const refus = await gardeLecture(uid, acc, 'colis');
      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Colis à confirmer non lu : ${refus.error}`); break; }
      memo[cid] = Date.now();
      n++;
      const rep = await vintedGet(acc, `/api/v2/conversations/${encodeURIComponent(cid)}`);
      if (!rep.ok || !rep.json) { noterDiag(`confirmer_conv_refuse_${rep.status}`); if (memoApresEchec(memo, cid, rep, BORD_RETRY_MS)) break; continue; }
      const c = confirmationDeConversation(rep.json);
      if (!c) { noterDiag('confirmer_conv_sans_transaction'); continue; }
      // L'identité de la commande prime : la conversation doit porter SA transaction.
      if (String(c.tx) !== String(o.transaction_id)) { noterDiag('confirmer_conv_autre_tx'); continue; }
      const ecrit = await noterConfirmation(c, uid);
      if (ecrit === null) { delete memo[cid]; break; }
    }
    await chrome.storage.local.set({ vrmConfirmerFaits: memo });
    return n;
  } catch (_) { return 0; }
}

// ── LES TRANSACTIONS QUI NE S'EXPÉDIENT PLUS (17 octobre, besoin du chantier 4).
//    La liste des ventes peut garder « needs_action » sur une vente dont la
//    TRANSACTION dit autre chose — codes mesurés : 220 paiement échoué, 430
//    suspendue, 440 retour (la nB546), 450 finalisée, 500-520 annulée. Le résumé
//    posé pour le widget et les rappels les exclut. Lecture ratée ⇒ `null` :
//    on n'exclut RIEN (sur-exclure cacherait un vrai colis à poster).
function TXN_NE_S_EXPEDIE_PLUS(st) { const n = parseInt(String(st == null ? '' : st), 10); return Number.isFinite(n) && (n === 220 || n >= 430); }
async function transactionsQuiNeSExpedientPlus(uid) {
  if (!uid) return null;
  const rows = await sbGetTout(`app_data?id=like.harvest_${uid}_txn_*&select=id,st:meta->>status`);
  if (!Array.isArray(rows)) return null;
  const out = new Set();
  for (const r of rows) {
    const tx = (/_txn_(\d+)$/.exec(String((r && r.id) || '')) || [])[1];
    if (tx && TXN_NE_S_EXPEDIE_PLUS(r.st)) out.add(tx);
  }
  return out;
}
function retirerDuResume(resume, exclues) {
  if (!resume || !Array.isArray(resume.txns) || !exclues || typeof exclues.has !== 'function' || !exclues.size) return resume;
  return Object.assign({}, resume, { txns: resume.txns.filter((tx) => !exclues.has(String(tx))) });
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
    const ok = vente ? A_EXPEDIER(o) : AT_RELAY(o.status);
    if (ok && o.transaction_id != null) txns.push(String(o.transaction_id));
  }
  // Les transactions (pas seulement le compte) : le widget dédoublonne entre
  // comptes, sinon une même vente vue sur deux lignes compterait double.
  return { n: cmds.length, txns, at: Date.now() };
}

// ⚠️ 5.165 — `opts.complet` : la moisson ACTIVE a lu TOUTES les pages du
//    dressing, sans un échec, jusqu'à la dernière que Vinted annonce (ou une
//    page vide). Elle le SAIT ; une page captée en passant, jamais.
//    Voir `dressingCompletFaitFoi`.
async function storeHarvestRow(uid, type, payload, domain, opts) {
  if (await compteNonCapte(uid)) { noterDiag('ignore_compte_supprime'); return 'ignore'; }
  // ⚠️ LA MOISSON ACTIVE N'ALIMENTAIT PAS LE COFFRE. « 🔄 Tout recapter » va
  // chercher le dressing COMPLET (toutes les pages) — et jetait tout au coffre
  // près : seule la voie passive archivait. C'est pour ça que le coffre plafonne
  // à 25 annonces quand 112 sont en ligne, donc que « Republier » n'a ni texte
  // ni photos pour la plupart des paires. On archive depuis le payload BRUT
  // (l'allègement ci-dessous ne laisse qu'une photo par annonce).
  const brut = payload;
  if (estErreurVinted(brut)) { noterDiag(`ignore_erreur_vinted_${type || 'inconnu'}`); return 'erreur-vinted'; }
  // Sentinelle de dérive de forme, sur le BRUT (voie active : même protection).
  verifFormeListe(type, brut, '');
  verifFormeObjet(type, brut, '');
  if (type === 'profile') { try { await noterEtatCompte(uid, brut); } catch (_) {} noterLoginVu(uid, brut); }   // 5.181 : actif / banni ; 5.191 : login
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
  if (type === 'billing' && !estPorteMonnaie(payload)) return 'hors-sujet';
  const maintenant = new Date().toISOString();
  const data = { type, uid, domain: domain || 'www.vinted.fr', capturedAt: maintenant, payload };
  // Même règle que la voie passive : un dressing partiel n'écrase pas un
  // dressing complet. La moisson ACTIVE pagine (fetchAllWardrobe) donc elle
  // passe toujours — mais si un jour une page échoue en cours de route, on ne
  // veut pas que le résultat tronqué remplace la bonne capture.
  // La boîte se FUSIONNE (5.162, voir `fusionnerInbox`) : jamais refusée parce
  // qu'une page ancienne portait plus de conversations que la page 1 fraîche.
  if (type === 'inbox') {
    if (!((payload && payload.conversations) || []).length) { noterDiag('ignore_inbox_vide'); return 'plus-pauvre'; }
    const f = await inboxFusionnee(`harvest_${uid}_inbox`, payload);
    if (f === null) { noterDiag('inbox_lecture_ratee'); return 'ecriture-ratee'; }   // pas su : on n'écrase rien
    payload = f;
    data.payload = payload;
    data.nItems = payload.conversations.length;
  } else if (CLE_LISTE[type]) {
    data.nItems = ((payload && payload[CLE_LISTE[type]]) || []).length;
    // ⚠️ UN REFUS SE COMPTE, COMME SUR LA VOIE PASSIVE (`ignore_partiel_<type>`).
    //    Ici il se taisait : une lecture active tronquée (une page qui échoue en
    //    cours de route) ne laissait AUCUNE trace, et « rien écrit » restait
    //    indiscernable de « rien lu ». Même famille de nom, suffixe `actif` :
    //    sur cette voie le refus veut dire « une page a manqué », pas « la page
    //    affichait un aperçu ».
    const completFaitFoi = type === 'listings' && dressingCompletFaitFoi(payload, opts);
    if (completFaitFoi) noterDiag('dressing_complet_range');
    const riche = completFaitFoi || await listePlusRiche(`harvest_${uid}_${type}`, payload, CLE_LISTE[type]);
    // Compteur illisible : ce n'est pas « lu, plus pauvre » (qui vaut « rangé »
    // pour la moisson), c'est la base qui n'a pas répondu — compté comme un échec.
    if (riche === null) return 'lecture-ratee';
    if (!riche) {
      noterDiag(`ignore_partiel_actif_${type}`);
      return 'plus-pauvre';
    }
  }
  data.resume = resumeCommandes(type, payload) || undefined;
  if (type === 'orders_sold' && data.resume) { try { data.resume = retirerDuResume(data.resume, await transactionsQuiNeSExpedientPlus(uid)); } catch (_) {} }
  // On ecrit AUSSI updated_at : la table n'a pas de trigger, la colonne gardait
  // donc la date de creation de la ligne et faisait passer une moisson de deux
  // heures pour une moisson de 25 jours. `capturedAt` reste la reference cote
  // app, mais autant que la colonne cesse de mentir aux autres lecteurs.
  const ecritRow = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_${type}`, data, updated_at: maintenant }], 'id');
  if (ecritRow !== false && type === 'orders_sold') notifierApp({ type: 'maj', quoi: 'ventes', uid: String(uid) });
  if (ecritRow !== false && type === 'orders_purchased') notifierApp({ type: 'maj', quoi: 'achats', uid: String(uid) });
  if (ecritRow !== false && type === 'listings') notifierApp({ type: 'maj', quoi: 'annonces', uid: String(uid) });   // 5.165 (voir storeHarvest)
  noterFlux('vinted', ecritRow !== false);
  if (type === 'listings') {
    try { const tous = (brut && brut.items) || []; await archiverLot(uid, tous.filter(it => it && !it.is_closed && !it.is_hidden && !it.is_draft), tous); } catch (_) {}
  }
  // Ce qui s'est PASSÉ, pour qui veut le savoir (`rafraichirVentes`) : les
  // autres appelants l'ignorent, rien ne change pour eux.
  return ecritRow !== false ? 'ecrit' : 'ecriture-ratee';
}

// Recupere TOUTES les pages du dressing. Vinted plafonne per_page a ~96 : sans
// pagination, un compte de 604 articles n'en rendait que 96 et le reste etait
// invisible pour l'app (annonces « disparues », numerotation faussee).
// `getter(path)` renvoie { ok, json } — on branche indifferemment la version a
// jetons ou la version a cookies.
// `suivi` (facultatif) reçoit `complet` : VRAI seulement si la boucle s'est
// arrêtée d'elle-même (page vide, ou dernière page annoncée par Vinted) — jamais
// sur un échec ni au plafond de pages (5.165, voir `dressingCompletFaitFoi`).
async function fetchAllWardrobe(getter, profileId, maxPages = 10, suivi) {
  let out = null;
  if (suivi) suivi.complet = false;
  for (let page = 1; page <= maxPages; page++) {
    const r = await getter(`/api/v2/wardrobe/${profileId}/items?page=${page}&per_page=100`);
    const lot = r && r.ok && r.json && Array.isArray(r.json.items) ? r.json.items : null;
    if (!lot) break;
    if (!out) out = r.json; else out.items = out.items.concat(lot);
    const tp = r.json.pagination && r.json.pagination.total_pages;
    if (!lot.length || (tp && page >= tp)) { if (suivi) suivi.complet = true; break; }
    await wait(1200); // rythme d'une navigation humaine
  }
  return out;
}

// Recupere TOUTES les pages de commandes d'un type (ventes/achats), en douceur.
// On s'arrete quand une page est incomplete (derniere) ou au plafond de securite.
// `suivi` (facultatif) reçoit `pagesLues` : 0 = Vinted n'a RIEN rendu (lecture
// ratée), ce qu'une liste vide ne dit pas — un compte sans vente rend aussi `[]`.
// Il vit à côté du résultat, jamais dedans : le résultat part tel quel en base.
async function fetchAllOrders(acc, type, maxPages = 8, suivi) {
  let all = []; let pagination = null;
  if (suivi) suivi.pagesLues = 0;
  for (let page = 1; page <= maxPages; page++) {
    const r = await vintedGet(acc, `/api/v2/my_orders?type=${type}&page=${page}&per_page=40`);
    if (!r.ok || !r.json || !Array.isArray(r.json.my_orders)) { if (suivi) { suivi.statut = r && r.status; if (r && r.pause) suivi.pause = true; } break; }
    if (suivi) suivi.pagesLues++;
    all = all.concat(r.json.my_orders);
    pagination = r.json.pagination || pagination;
    if (r.json.my_orders.length < 40) break; // derniere page atteinte
    await wait(1200); // pause entre pages (discret)
  }
  return { my_orders: all, pagination };
}

// ⚠️⚠️ 5.165 — `activeFetchAccount` (moisson d'UN compte avec SES jetons, sans
//    cookie) et `activeFetchAll` (la même chose pour TOUS les comptes à la suite)
//    sont RETIRÉES. `runActive` y retombait quand aucun onglet Vinted ni cookie
//    n'était là (déconnecté, bascule de compte) : profil, dressing, ventes,
//    achats et boîte de CHAQUE compte, en vingt secondes, depuis le même
//    navigateur — la signature multi-comptes que §3 interdit. Prouvé au banc
//    (`audit-moisson-dressing`, requêtes pour A, B et C) et OBSERVÉ le 8 octobre
//    à 22:27 (une session écrit les profils de trois comptes en 20 s). Un compte
//    se relit désormais quand il est connecté dans Chrome, et seulement là ;
//    l'app dit, compte par compte, de quand date sa dernière lecture.

// Recupere la liste des comptes lies depuis Supabase.
// `{ ouNull: true }` : `null` quand la base n'a pas répondu, au lieu de `[]`
// (« pas su » ≠ « aucun compte ») — pour un appelant qui doit le DIRE.
async function getStoredAccounts(opts) {
  const ko = opts && opts.ouNull ? null : [];
  try {
    const session = await authToken();
    if (!session?.user_id || !session.access_token) return ko;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=*&owner=eq.${encodeURIComponent(session.user_id)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return ko;
    const j = await res.json();
    const actuelle = await loadSession();
    if (!Array.isArray(j) || j.some(a => a.owner !== session.user_id) || actuelle?.user_id !== session.user_id) return ko;
    return j;
  } catch (_) { return ko; }
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
// ⚠️ 5.165 : lue en SCALAIRE (§4.4), et en TROIS états — l'id (texte) · `''`
//    (aucun profil rangé) · `null` (la base n'a pas répondu, « pas su »).
//    `lastProfileId` garde son contrat d'avant (l'id ou `null`).
async function profilIdRange(uid) {
  let rows = null;
  try { rows = await sbGet(`app_data?id=eq.harvest_${uid}_profile&select=pid:data->payload->user->>id`); } catch (_) { rows = null; }
  if (rows === null || !Array.isArray(rows)) return null;
  const v = rows[0] && rows[0].pid;
  return v != null && String(v) !== '' ? String(v) : '';
}
async function lastProfileId(uid) {
  try { const v = await profilIdRange(uid); return v || null; } catch (_) { return null; }
}
async function vintedGetCookie(domain, endpoint) {
  return requeteVinted('cookie', async () => {
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
  });
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
  // 5.165 : aucun compte connecté dans ce Chrome ⇒ rien à ranger, rien ne part.
  if (!activeUid0) return false;
  let knownPid = null;
  try { knownPid = await lastProfileId(activeUid0); } catch (_) {}
  // ⚠️ 5.162 : toute la série faite dans la page occupe UNE place de la file
  // Vinted (aucune autre requête de l'extension ne part pendant ce temps), et
  // un 429/403 reçu dans la page ARRÊTE la série sur place (`frein`) — avant,
  // la boucle en cours cassait et la suivante repartait : ventes, achats,
  // boîte, porte-monnaie, une trentaine de requêtes après le refus.
  const rep = await requeteVinted('page', async () => {
   try {
    const res = await executerMain(tab.id, async (csrfTok, knownPidArg, __relais) => {
        // Hors de Chrome (sans monde MAIN), ses requêtes partent par la page.
        const fetch = __relais ? __relais.fetch : globalThis.fetch;
        let frein = 0;                        // Vinted a dit « ralentis » : plus rien ne part
        const get = async (p) => {
          if (frein) return null;
          try {
            const h = { accept: 'application/json' };
            if (csrfTok) h['x-csrf-token'] = csrfTok;
            const r = await fetch(p, { credentials: 'include', headers: h });
            if (r && (r.status === 429 || r.status === 403)) { frein = r.status; return null; }
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
        // 5.165 : VRAI seulement si la boucle s'arrête d'elle-même (page vide ou
        // dernière page annoncée) — jamais sur un échec ni au plafond.
        let listingsComplet = false;
        if (pid) {
          const MAX_PAGES = 10;               // garde-fou
          for (let pg = 1; pg <= MAX_PAGES; pg++) {
            const r = await get('/api/v2/wardrobe/' + pid + '/items?page=' + pg + '&per_page=100');
            const lot = r && Array.isArray(r.items) ? r.items : null;
            if (!lot) break;
            if (!listings) listings = r; else listings.items = listings.items.concat(lot);
            const tp = r.pagination && r.pagination.total_pages;
            if (!lot.length || (tp && pg >= tp)) { listingsComplet = true; break; }
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
        return { who: who || null, listings: listings || null, listingsComplet, pid: pid || null, sold: sold || null, bought: bought || null, inbox: inbox || null, wallet: wallet || null, frein };
      }, [csrf, knownPid]);
    const o = res && res[0] && res[0].result;
    // Le statut que la file regarde : le frein reçu dans la page, sinon « lu ».
    return { status: (o && o.frein) || (o ? 200 : 0), ok: !!o, out: o || null };
   } catch (_) { return { status: 0, ok: false, out: null }; }
  });
  const out = rep && rep.out;
  if (!out) return false;
  // On range sous l'uid du COMPTE ACTIF (decode du cookie de session).
  const uid = await activeUidForDomain(domain);
  if (!uid) return false;
  // ⚠️⚠️ 5.165 — IL A CHANGÉ DE COMPTE PENDANT LA MOISSON ⇒ ON JETTE (§5).
  //    `uid` est relu APRÈS la série : il bascule de compte en supprimant ses
  //    annonces, et les annonces de A partaient sous B (prouvé au banc :
  //    48 annonces de A dans `harvest_B_listings`). Mieux vaut un blanc qu'un faux.
  if (String(uid) !== String(activeUid0)) { noterDiag('moisson_compte_change'); return 'abandon'; }
  // Revue 5.165 : le profil que la page a rendu doit être celui qu'on a rangé
  // pour CE compte (quand on le connaît) — sinon la page parlait pour un autre.
  if (knownPid && out.who && out.who.user && out.who.user.id != null && String(out.who.user.id) !== String(knownPid)) { noterDiag('moisson_compte_change'); return 'abandon'; }
  // ⚠️⚠️ 5.165 — ON NE COMPTE QUE CE QUI EST RANGÉ. `stored = true` se posait
  //    AVANT de savoir ce que la base avait répondu : une moisson dont TOUTES les
  //    écritures étaient refusées (400, sans session, 9 octobre) se disait
  //    « Données rafraîchies », et la garde de 5 min restait posée.
  //    Lu-mais-refusé-plus-pauvre et porte-monnaie hors sujet valent « lu ».
  let stored = false, ratees = 0;
  const range = async (type, data, opts) => {
    const r = await storeHarvestRow(uid, type, data, domain, opts);
    if (r === 'ecrit' || r === 'plus-pauvre' || r === 'hors-sujet') stored = true; else if (r !== 'erreur-vinted') ratees++;   // 5.193 : un refus de VINTED n'est pas un refus de la base
  };
  // ⚠️ NE JAMAIS ECRASER UNE MOISSON PAR DU VIDE. Une session expiree, une
  // page pas encore chargee ou un appel refuse renvoient une LISTE VIDE, pas
  // une erreur : en rangeant ce vide, on effacait des donnees valides et
  // l'onglet Ventes se retrouvait desesperement vide alors que les ventes
  // existaient. C'est exactement ce qui etait arrive aux 10 comptes.
  const plein = (o, cle) => o && Array.isArray(o[cle]) && o[cle].length > 0;
  // ⚠️ 5.165 — SAUF LE DRESSING LU EN ENTIER PAR SON PROPRIÉTAIRE : Vinted
  //    l'a dit lui-même (`/users/current` a répondu, toutes les pages lues,
  //    jusqu'à la dernière). Vide ou plus court, c'est l'état réel après des
  //    suppressions — `dressingCompletFaitFoi` tranche (total atteint, §4.2).
  const dressingComplet = !!(out.listingsComplet && out.who && out.who.user && out.who.user.id
    && out.listings && Array.isArray(out.listings.items));
  if (out.who) await range('profile', out.who);
  if (plein(out.listings, 'items') || dressingComplet) await range('listings', out.listings, dressingComplet ? { complet: true } : undefined);
  if (plein(out.sold, 'my_orders')) await range('orders_sold', out.sold);
  if (plein(out.bought, 'my_orders')) await range('orders_purchased', out.bought);
  if (plein(out.inbox, 'conversations')) await range('inbox', out.inbox);
  // Le solde n'est pas une liste : on le range des qu'il porte un montant.
  // `payouts` renvoie `{balance}` là où le porte-monnaie renvoie `{main,escrow}` :
  // sans ce troisième cas, la lecture ajoutée en 4.26 était jetée à l'arrivée.
  if (estPorteMonnaie(out.wallet)) await range('billing', out.wallet);
  if (stored) { try { chrome.storage.local.set({ lastActiveFetch: Date.now(), activeUid: uid, via: 'page' }); } catch (_) {} }
  noterDiag(stored ? 'moisson_page_rangee' : (ratees ? 'moisson_page_ecriture_ratee' : 'moisson_page_vide'));
  // Lu chez Vinted, refusé par la BASE : ni « rafraîchi », ni repli (§3) — et
  // `runActive` pose le recul (revue 5.165 : relire Vinted ne rangerait rien).
  if (!stored && ratees) return 'base';
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
    // ⚠️⚠️ REVUE DE LA 5.165 — CE REPLI N'AVAIT PAS LA GARDE DE LA PAGE. `uid`
    //    était lu UNE fois au départ, puis tout partait avec le cookie du moment.
    //    Or c'est justement le chemin qui tourne quand la page navigue — à chaque
    //    suppression, à chaque bascule de compte. Prouvé au banc : il passe de A
    //    à B en route ⇒ le profil, le dressing et les ventes de B rangés sous A ;
    //    et, B venant d'être VIDÉ, son dressing complet et vide effaçait les
    //    61 annonces de A (`dressingCompletFaitFoi`). Puis la garde passive,
    //    trompée par le profil de B rangé sous A, refusait le dressing de A.
    //    ⇒ Le compte du cookie est RELU avant chaque rangement ; au moindre
    //      écart, rien de plus n'est rangé (`moisson_compte_change`). Et le profil
    //      rendu doit être celui qu'on a rangé pour ce compte : connu et
    //      différent ⇒ rien ; pas su (la base n'a pas répondu) ⇒ rien non plus.
    const pidRange = await profilIdRange(uid);    // id · '' (jamais rangé) · null (pas su)
    if (pidRange === null) { noterDiag('moisson_profil_pas_lu'); return 'base'; }
    const prof = await vintedGetCookie(domain, '/api/v2/users/current');
    if (!prof.ok || !prof.json) return false; // pas connecte / endpoint change (ou pause Vinted)
    const profileId = prof.json.user && prof.json.user.id;
    let change = false;
    const memeCompte = async () => {
      if (change) return false;
      if (String((await activeUidForDomain(domain)) || '') === String(uid)) return true;
      change = true; noterDiag('moisson_compte_change'); return false;
    };
    if (pidRange && profileId != null && String(profileId) !== pidRange) { noterDiag('moisson_compte_change'); return 'abandon'; }
    if (!(await memeCompte())) return 'abandon';
    // 5.165 : comme `pageActiveFetch` — on ne compte que ce qui est RANGÉ.
    let stored = false, ratees = 0;
    const range = async (type, data, opts) => {
      if (!(await memeCompte())) return 'abandon';
      const r = await storeHarvestRow(uid, type, data, domain, opts);
      if (r === 'ecrit' || r === 'plus-pauvre' || r === 'hors-sujet') stored = true; else if (r !== 'erreur-vinted') ratees++;   // 5.193 : un refus de VINTED n'est pas un refus de la base
      return r;
    };
    const fin = () => {
      if (stored) { try { chrome.storage.local.set({ lastActiveFetch: Date.now(), activeUid: uid }); } catch (_) {} }
      if (change) return 'abandon';
      // Lu chez Vinted, TOUT refusé par la base : `runActive` pose le recul.
      if (!stored && ratees) return 'base';
      return stored;
    };
    await range('profile', prof.json);
    await wait(1200);
    if (profileId && !change) {
      const suivi = {};
      const w = await fetchAllWardrobe((path) => vintedGetCookie(domain, path), profileId, undefined, suivi);
      // Lu en entier par son propriétaire (5.165) : vide ou plus court fait foi.
      if (w && Array.isArray(w.items) && (w.items.length || suivi.complet)) await range('listings', w, suivi.complet ? { complet: true } : undefined);
      await wait(1200);
    }
    if (change || await pauseVinted()) return fin();   // 5.162 : Vinted a freiné en route — on s'arrête là
    const sold = await fetchAllOrdersCookie(domain, 'sold');
    if (sold && sold.my_orders.length) await range('orders_sold', sold);
    await wait(1200);
    if (change || await pauseVinted()) return fin();
    const bought = await fetchAllOrdersCookie(domain, 'purchased');
    if (bought && bought.my_orders.length) await range('orders_purchased', bought);
    await wait(1200);
    if (change || await pauseVinted()) return fin();
    const inbox = await vintedGetCookie(domain, '/api/v2/inbox?page=1&per_page=30');
    if (inbox.ok && inbox.json) await range('inbox', inbox.json);
    return fin();
  } finally { cookieFetchRunning = false; }
}

// --- Declencheurs ----------------------------------------------------------

// Au demarrage / installation : on capte les comptes PUIS on rafraichit le
// compte ACTIF par cookie (fiable). L'ancien fetch Bearer reste en secours pour
// les autres comptes, mais il echoue tant que Vinted refuse le Bearer-sans-cookie.
// Rend VRAI si quelque chose a été rangé — la visite peut alors le dire dans
// le journal au lieu d'annoncer un rafraîchissement qui n'a rien capté.
async function runActive() {
  // ⚠️ 5.162 : pendant une pause demandée par Vinted, on ne tente RIEN — et un
  // frein reçu en route n'est pas suivi du chemin de secours.
  if (await pauseVinted()) return false;
  // ⚠️⚠️ 5.165 — SANS SESSION VRM, RIEN NE PART CHEZ VINTED. Mesuré le 9 octobre
  //    dans les journaux de la base : la moisson de llloollllaa (18:38:21 et
  //    18:38:29) et celle de julatace35260 (18:44:34) ont été LUES chez Vinted
  //    puis refusées en bloc (`POST app_data → 400` : une ligne sans
  //    propriétaire ne passe pas RLS). Vingt requêtes Vinted pour rien (§3 :
  //    aucune requête sans raison), et une garde de 5 min consommée.
  if (await sansSessionPourEcrire()) { noterDiag('moisson_sans_session'); return false; }
  try { if (await compteNonCapte(await activeUidForDomain('www.vinted.fr'))) { noterDiag('moisson_compte_supprime'); return false; } } catch (_) {}
  // Revue 5.165 : NOTRE base refuse tout depuis peu (panne, RLS) — rien ne part
  // chez Vinted pour une lecture qu'on ne pourrait pas ranger. Ici, et pas
  // seulement dans la visite : l'alarme des 20 min et le changement de cookie
  // appellent `runActive` sans la garde de la visite.
  if (await reculBase()) { noterDiag('moisson_base_en_recul'); return 'recul'; }
  const p = await pageActiveFetch();
  if (p === true) return true;
  // La BASE a tout refusé : refaire la même moisson par le service worker ne
  // rangerait rien de plus — pas de repli, et le recul est posé.
  if (p === 'base') { await poserReculBase(); return 'base'; }
  // Le compte a changé en route : rien rangé, pas de repli.
  if (p === 'abandon') return false;
  if (await pauseVinted()) return false;
  // (5.165 : plus de `activeFetchAll` — jamais tous les comptes d'un coup, §3.)
  const c = await activeFetchActiveAccount();
  if (c === 'base') { await poserReculBase(); return 'base'; }
  return c === true;
}
// ⚠️ 5.165 — base cloisonnée et AUCUNE session VRM utilisable : toute écriture
//    serait refusée. Même règle que `withOwner` (un `owner` n'est posé que si la
//    session porte un `user_id`) : « pas de propriétaire » ⇔ « refusé ».
async function sansSessionPourEcrire() {
  try {
    const s = await authToken();
    return !(s && s.access_token && s.user_id);
  } catch (_) { return true; }
}
// ══ NOTRE BASE REFUSE TOUT : ON NE RELIT PAS VINTED POUR RIEN (revue 5.165) ═══
// Mesuré au banc (le vrai background.js, horloge pilotée) : la garde des 5 min
// était RENDUE à 60 s sur CHAQUE échec — y compris quand c'est NOTRE base qui
// refuse toutes les écritures (RLS 403/42501, abonnement coupé) ou qui ne
// répond plus (522, du 9 au 12 septembre). La moisson complète (profil,
// dressing, ventes, achats, boîte, porte-monnaie) repartait chez Vinted à
// chaque minute de navigation : 30 moissons en 30 min (6 avant la 5.165),
// toutes jetées. Le code le disait pourtant : « lu chez Vinted, refusé par la
// BASE : ni rafraîchi, ni repli (§3) ».
// ⇒ Une moisson (ou les ventes) dont TOUTES les écritures sont refusées pose un
//   RECUL rangé dans `chrome.storage.local` (§4.9) : 1 min, puis 5, 10, 20, 40,
//   60. Pendant le recul, rien ne part chez Vinted pour une lecture qu'on ne
//   pourrait pas ranger. Il tombe dès qu'une ligne de CAPTURE est écrite (la
//   capture passive continue d'essayer : c'est elle qui dit que la base est
//   revenue) — jamais sur une ligne de diagnostic, qui peut passer quand les
//   captures sont refusées.
// ⚠️ Le premier palier (1 min) garde le simple hoquet : la page suivante, une
//    minute plus tard, range (`audit-moisson-dressing` §2).
const RECUL_BASE = 'vrmReculBase';                 // { jusqua, niveau, depuis }
const RECUL_BASE_PALIERS_MIN = [1, 5, 10, 20, 40, 60];
const RECUL_BASE_OUBLI_MS = 6 * 3600000;            // au-delà, on repart du premier palier
const RE_LIGNE_CAPTURE = /^harvest_[^_]+_(profile|listings|orders_sold|orders_purchased|inbox|billing)$/;
async function reculBase() {
  try {
    const r = (await chrome.storage.local.get(RECUL_BASE))[RECUL_BASE];
    const reste = Number((r && r.jusqua) || 0) - Date.now();
    return reste > 0 ? Object.assign({}, r, { resteMs: reste }) : null;
  } catch (_) { return null; }
}
// Économie d'écritures seulement : la vérité vit dans le stockage (§4.9).
let _reculPeutExister;
let _reculChaine = Promise.resolve();
function poserReculBase() {
  _reculChaine = _reculChaine.then(async () => {
    const t = Date.now();
    let cur = {};
    try { cur = (await chrome.storage.local.get(RECUL_BASE))[RECUL_BASE] || {}; } catch (_) {}
    if (Number(cur.jusqua || 0) > t) return;          // déjà en recul : rien ne monte
    const recent = cur.jusqua && (t - Number(cur.jusqua)) < RECUL_BASE_OUBLI_MS;
    const niveau = recent ? Math.min(Number(cur.niveau || 0) + 1, RECUL_BASE_PALIERS_MIN.length) : 1;
    const minutes = RECUL_BASE_PALIERS_MIN[niveau - 1];
    _reculPeutExister = true;
    try { await chrome.storage.local.set({ [RECUL_BASE]: { jusqua: t + minutes * 60000, niveau, depuis: Number(cur.depuis) && recent ? Number(cur.depuis) : t } }); } catch (_) {}
    noterDiag(`moisson_base_recul_${niveau}`);
    logActivity(`⏸ Ta base VRM n'a rien pris — Vinted n'est pas relu avant ${minutes} min`);
  }).catch(() => {});
  return _reculChaine;
}
function effacerReculBase() {
  if (_reculPeutExister === false) return Promise.resolve();
  _reculChaine = _reculChaine.then(async () => {
    try {
      const cur = (await chrome.storage.local.get(RECUL_BASE))[RECUL_BASE];
      if (cur) { await chrome.storage.local.remove(RECUL_BASE); noterDiag('moisson_base_revenue'); }
      _reculPeutExister = false;
    } catch (_) {}
  }).catch(() => {});
  return _reculChaine;
}
function fullSync() { captureAllAccounts().then(() => runActive()); }

// ⚠️ APRÈS UNE MISE À JOUR, Chrome n'injecte PAS le nouveau bridge.js dans les
//    onglets de l'app déjà ouverts : l'app parlerait à l'ancien (orphelin,
//    muet) jusqu'à ce qu'il recharge la page. On le réinjecte nous-mêmes.
// ⚠️⚠️ 5.160 : SEULEMENT QUAND L'EXTENSION A CHANGÉ (`install`, `update`).
//    `onInstalled` part AUSSI quand c'est CHROME qui se met à jour
//    (`chrome_update`) ou un module partagé : l'extension n'a pas bougé, le pont
//    du manifeste tourne déjà dans l'onglet, et un second pont VIVANT relaierait
//    chaque demande DEUX fois — une réponse à un acheteur envoyée deux fois.
//    bridge.js porte aussi sa propre garde (`__vrmPontVivant`) : si les deux
//    sautaient un jour, le pire serait un pont de moins, jamais un de trop.
function raisonReinjecte(details) {
  const r = details && details.reason;
  return !r || r === 'install' || r === 'update';
}
// Firefox (5.188) : le paquet Firefox pose `compat-firefox.js` devant chaque
// script — un pont réinjecté en a besoin aussi. Chrome n'a pas ce fichier.
const FICHIERS_PONT = (() => { try { return (typeof browser !== 'undefined' && browser && browser.runtime) ? ['compat-firefox.js', 'bridge.js'] : ['bridge.js']; } catch (_) { return ['bridge.js']; } })();
async function reinjecterPont() {
  try {
    const tabs = await chrome.tabs.query({ url: APP_URLS });
    for (const t of tabs || []) {
      try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: FICHIERS_PONT }); } catch (_) {}
    }
  } catch (_) {}
}
function afficherRappelLbc(version){
  if(document.querySelector('[data-vrm-maj-lbc]'))return;
  const bloc=document.createElement('aside');bloc.setAttribute('data-vrm-maj-lbc',version);bloc.setAttribute('role','status');
  Object.assign(bloc.style,{position:'fixed',left:'16px',bottom:'76px',zIndex:'2147483647',maxWidth:'calc(100vw - 32px)',width:'320px',boxSizing:'border-box',padding:'14px',background:'#203d47',color:'#fff',borderRadius:'12px',boxShadow:'0 6px 24px #0004',font:'13px/1.5 system-ui,sans-serif'});
  const titre=document.createElement('b');titre.textContent='VRM · Mise à jour '+version;
  const texte=document.createElement('p');texte.textContent='Recharge cet onglet Leboncoin pour activer le nouveau capteur.';texte.style.margin='6px 0 10px';
  const actions=document.createElement('div');Object.assign(actions.style,{display:'flex',gap:'8px'});
  for(const [lib,agir]of [['Recharger Leboncoin',()=>location.reload()],['Plus tard',()=>bloc.remove()]]){
    const b=document.createElement('button');b.type='button';b.textContent=lib;Object.assign(b.style,{minHeight:'40px',padding:'7px 10px',border:'1px solid #ffffff66',borderRadius:'8px',background:'transparent',color:'#fff',font:'600 12px system-ui,sans-serif',cursor:'pointer'});b.onclick=agir;actions.appendChild(b);
  }
  bloc.append(titre,texte,actions);(document.body||document.documentElement)?.appendChild(bloc);
}
async function rappelerMiseAJourLbc(){
  try{const tabs=await chrome.tabs.query({url:['https://*.leboncoin.fr/*']});for(const t of tabs||[])try{await chrome.scripting.executeScript({target:{tabId:t.id},func:afficherRappelLbc,args:[CODE_VERSION]});}catch(_){}}catch(_){}
}
chrome.runtime.onInstalled.addListener((details) => { fullSync(); if (raisonReinjecte(details)){reinjecterPont();rappelerMiseAJourLbc();} });
chrome.runtime.onStartup.addListener(() => { fullSync(); });

// ⚠️ 11 octobre (mesuré au banc, dans un vrai Chromium) : `chrome.alarms.create`
//    REMET À ZÉRO une alarme qui existe déjà. Refait à CHAQUE réveil du service
//    worker — et `vrm-photos` le réveille chaque minute —, `vrm-session` (40 min),
//    `cancale-active` (20) et `cancale-sync` (10) ne partaient JAMAIS : 2 398 s,
//    puis 2 378 s, puis 2 398 s après un réveil. Plus aucun entretien de la
//    session : une session morte ne se voyait qu'à la première écriture.
//    ⇒ On ne crée une alarme que si elle n'existe pas encore.
function alarmeSiAbsente(nom, opts) {
  try {
    if (typeof chrome.alarms.get !== 'function') { chrome.alarms.create(nom, opts); return; }
    chrome.alarms.get(nom, (a) => { void (chrome.runtime && chrome.runtime.lastError); if (!a) { try { chrome.alarms.create(nom, opts); } catch (_) {} } });
  } catch (_) { try { chrome.alarms.create(nom, opts); } catch (_) {} }
}
// Les tâches périodiques : nom → minutes. UNE liste pour les deux chemins.
// Capture des comptes toutes les 10 min ; fetch actif toutes les 20 min
// (assez pour etre a jour, assez espace pour rester discret).
// ⚠️ ENTRETIEN DE LA SESSION VENDEUR (`vrm-session`, 40 min). Le jeton d'accès
// dure ~1 h ; il n'était renouvelé qu'au moment d'écrire, et SEULEMENT si la
// base est cloisonnée. Une fois la migration passée, une extension restée
// ouverte sans écrire aurait laissé mourir son jeton, puis serait retombée sur
// la clé publique — c'est-à-dire, sous RLS, plus aucune capture enregistrée,
// en silence. 40 min : bien avant l'heure, et rien ne part sans session.
// Photos des annonces (`vrm-photos`, 1 min) : tant qu'un onglet Vinted est
// ouvert, on complète tout seul (Julien, 29 sept.). Voir `tickPhotos`.
// 5.183 : le relais du téléphone (`vrm-relais`, 30 s, le minimum de Chrome).
// Rien ne part sans session VRM (voir `relaisTick`).
const PERIODES = { 'cancale-sync': 10, 'cancale-active': 20, 'vrm-session': 40, 'vrm-photos': 1, 'vrm-relais': 0.5 };
function surAlarme(a) {
  if (a.name === 'cancale-sync') captureAllAccounts();
  else if (a.name === 'cancale-active') runActive();
  else if (a.name === 'vrm-session') { loadSession().then(s => { if (s) authToken(); }); }
  else if (a.name === 'vrm-photos') tickPhotos();
  else if (a.name === 'vrm-relais') relaisTick('alarme');
  // Le tampon de diagnostic survit au worker (chrome.storage.local) ; encore
  // faut-il qu'il PARTE un jour. Sans ce réveil, un tampon posé juste avant
  // une longue période calme attendrait la prochaine capture pour être écrit.
  majTampon(() => {});
  // 5.165 : une suppression vue mais pas encore rangée (base muette, pas de
  // session) repart ici — la file vit dans `chrome.storage.local`.
  viderSuppressions();
  // 11 octobre : les morceaux Leboncoin en attente (au plus une écriture par
  // 30 s) partent ici si le service worker s'est endormi entre-temps.
  try { viderLbcRecon(); viderLbcCatalogue(); } catch (_) {}
}
// ── SANS `chrome.alarms` (Orion iPhone, 20 octobre) ─────────────────────────
// Des minuteries tant que le fond est éveillé, ET la date du dernier passage de
// chaque tâche dans `chrome.storage.local` : iOS suspend le fond dès que
// l'écran se verrouille ou que l'onglet passe derrière ; au réveil (n'importe
// quel message, un onglet qui charge), ce qui est en retard repart UNE fois —
// jamais une rafale de rattrapage (une tâche en retard de 3 h tourne une fois).
// Les garde-fous de chaque tâche (garde, plafonds, file Vinted, pause) sont
// ceux de Chrome : seule l'horloge change.
const MINUTERIES_STORE = 'vrmMinuteries';
let _rattrapageA = 0, _rattrapageEnCours = false;
async function rattraperMinuteries(force) {
  if (CAP.alarms || _rattrapageEnCours) return;
  if (!force && Date.now() - _rattrapageA < 15000) return;
  _rattrapageEnCours = true; _rattrapageA = Date.now();
  try {
    let vus = {};
    try { vus = (await chrome.storage.local.get(MINUTERIES_STORE))[MINUTERIES_STORE] || {}; } catch (_) { return; }   // stockage illisible : on ne rejoue rien
    const maintenant = Date.now(), dus = [];
    for (const nom of Object.keys(PERIODES)) {
      const der = Number(vus[nom]) || 0;
      if (maintenant - der >= PERIODES[nom] * 60000 - 1000) { dus.push(nom); vus[nom] = maintenant; }
    }
    if (!dus.length) return;
    try { await chrome.storage.local.set({ [MINUTERIES_STORE]: vus }); } catch (_) { return; }   // noté AVANT d'agir : pas de double tour
    for (const nom of dus) { try { surAlarme({ name: nom }); } catch (_) {} }
  } finally { _rattrapageEnCours = false; }
}
if (CAP.alarms) {
  try {
    for (const nom of Object.keys(PERIODES)) alarmeSiAbsente(nom, { periodInMinutes: PERIODES[nom] });
    chrome.alarms.onAlarm.addListener(surAlarme);
  } catch (_) {}
} else {
  try { setInterval(() => { rattraperMinuteries(true); }, 30000); } catch (_) {}
  rattraperMinuteries(true);
}

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
// ⚠️⚠️ ELLE RENDAIT `true` SANS AVOIR RIEN ÉCRIT (4 octobre, 5.155). Une capture
//    plus pauvre refusée, une écriture que la base n'a pas prise : `true` quand
//    même, `ventes_rafraichies` au compteur, et la garde de 90 s restait posée —
//    la demande suivante de l'app tombait sur « récent » alors que RIEN n'avait
//    été rafraîchi. « Rien écrit » ne vaut pas « rafraîchi ».
//    Elle rend maintenant ce qui s'est passé :
//      { ok, ecrit, raison }
//      · ok    = la lecture ET l'écriture ont fonctionné (ou il n'y avait
//                légitimement rien à écrire) — la garde reste posée ;
//      · ecrit = des ventes sont arrivées en base ;
//      · raison ∈ compte · lecture · vinted-freine (429/403) · aucune ·
//                 plus-pauvre · ecriture.
async function rafraichirVentes(uid) {
  const accts = await getStoredAccounts();
  const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
  if (!acc) return { ok: false, ecrit: false, raison: 'compte' };
  const suivi = { pagesLues: 0 };
  const sold = await fetchAllOrders(acc, 'sold', undefined, suivi);
  // Aucune page rendue par Vinted : c'est une lecture RATÉE, pas « aucune vente ».
  if (!sold || !Array.isArray(sold.my_orders) || !suivi.pagesLues) {
    noterDiag('ventes_lecture_ratee');
    // 5.197 : 164 lectures ratées sur 615 chez Julien, sans savoir pourquoi —
    // on note le statut (une pause demandée par Vinted, un 401, une coupure).
    noterDiag('ventes_lecture_ratee_' + (suivi.pause ? 'pause' : String(suivi.statut || 0)));
    // 429 / 403 : c'est VINTED qui dit « ralentis » ou « non ». Ce n'est pas un
    // échec à réessayer vite — la garde entière reste (§3, la limite de volume).
    // Pendant une pause déjà ouverte non plus : aucune requête n'est partie.
    const freine = suivi.pause || suivi.statut === 429 || suivi.statut === 403;
    return { ok: false, ecrit: false, raison: freine ? 'vinted-freine' : 'lecture', garder: freine };
  }
  if (!sold.my_orders.length) return { ok: true, ecrit: false, raison: 'aucune' };
  const issue = await storeHarvestRow(uid, 'orders_sold', sold, acc.domain || 'www.vinted.fr');
  if (issue === 'ignore') return { ok: true, ecrit: false, raison: 'compte-supprime' };
  if (issue === 'plus-pauvre') return { ok: true, ecrit: false, raison: 'plus-pauvre' };
  if (issue !== 'ecrit') { await poserReculBase(); return { ok: false, ecrit: false, raison: 'ecriture' }; }
  // ⚠️ On vient d'écrire des ventes FRAÎCHES : tout ce que le mémo de visite
  // garde sur ce compte est périmé à la milliseconde près. On le vide.
  viderMemoVisite(uid);
  noterDiag('ventes_rafraichies');
  return { ok: true, ecrit: true, raison: '' };
}
// ── LA GARDE DES 90 s, POSÉE AVANT, RENDUE SUR UN ÉCHEC ────────────────────
// Elle est posée AVANT la lecture (deux demandes simultanées ne lisent pas deux
// fois). Mais si la lecture ou l'écriture ÉCHOUE, la garder reviendrait à dire
// « récent » pendant 90 s sur des ventes qui n'ont pas bougé : on la RELÂCHE,
// pour que la demande suivante réessaie. On ne relâche que SA propre marque —
// jamais celle qu'une autre demande aurait posée entre-temps.
// ⚠️ Une capture plus pauvre REFUSÉE n'est pas un échec : la lecture a eu lieu,
//    la garde reste (sinon un refus durable relancerait une lecture à chaque
//    ouverture d'écran — la limite de volume des 90 s tomberait).
// ⚠️ « RELÂCHER » NE VEUT PAS DIRE « EFFACER » (§3). La visite tourne à chaque
//    page Vinted chargée : une garde effacée sur un échec DURABLE (jeton mort,
//    base en panne) relirait `my_orders` à chaque page — la limite de volume
//    tomberait exactement quand quelque chose va mal. On la ramène donc à
//    `VENTES_REESSAI_MS` (20 s) : la demande suivante réessaie, jamais en rafale.
//    Et quand c'est Vinted qui freine (429/403), on ne relâche RIEN.
const VENTES_REESSAI_MS = 20 * 1000;
async function prendreGardeVentes(uid) {
  const dv = (await chrome.storage.local.get('vrmDerniereVente')).vrmDerniereVente || {};
  if (Date.now() - Number(dv[uid] || 0) < VENTES_DELAI_MS) return null;
  const marque = Date.now();
  dv[uid] = marque;
  await chrome.storage.local.set({ vrmDerniereVente: dv });
  return marque;
}
async function rendreGardeVentes(uid, marque) {
  try {
    const dv = (await chrome.storage.local.get('vrmDerniereVente')).vrmDerniereVente || {};
    if (Number(dv[uid]) !== Number(marque)) return;
    // La garde expire désormais dans 20 s au lieu de 90.
    dv[uid] = Date.now() - VENTES_DELAI_MS + VENTES_REESSAI_MS;
    await chrome.storage.local.set({ vrmDerniereVente: dv });
  } catch (_) {}
}
// Rafraîchit sous la garde : rend le résultat, et relâche la garde sur un échec.
async function rafraichirVentesGarde(uid, marque) {
  let r;
  try { r = await rafraichirVentes(uid); } catch (_) { r = { ok: false, ecrit: false, raison: 'lecture' }; }
  if (!r || (!r.ok && !r.garder)) await rendreGardeVentes(uid, marque);
  return r;
}

// ── LA GARDE DES 5 MIN, RENDUE SUR UN ÉCHEC (5.165) ─────────────────────────
// Même règle que `rendreGardeVentes` : posée AVANT la moisson (deux visites ne
// moissonnent pas deux fois), RELÂCHÉE si rien n'a été rangé — mesuré le
// 9 octobre : une moisson refusée par la base à 18:38 bloquait toute nouvelle
// lecture du dressing jusqu'à 18:43, session revenue entre-temps.
// ⚠️ « Relâcher » n'est pas « effacer » (§3) : la page suivante réessaie dans
//    `VISITE_REESSAI_MS` (60 s), jamais en rafale ; on ne relâche que SA marque ;
//    et pendant une pause demandée par Vinted, la garde reste ENTIÈRE.
const VISITE_REESSAI_MS = 60 * 1000;
async function rendreGardeVisite(uid, marque, reessaiMs = VISITE_REESSAI_MS) {
  try {
    if (await pauseVinted()) return;
    const st = (await chrome.storage.local.get('vrmDerniereVisite')).vrmDerniereVisite || {};
    if (Number(st[uid]) !== Number(marque)) return;
    st[uid] = Date.now() - VISITE_DELAI_MS + reessaiMs;
    await chrome.storage.local.set({ vrmDerniereVisite: st });
    noterDiag('visite_garde_rendue');
  } catch (_) {}
}
// ⚠️⚠️ REVUE DE LA 5.165 — RENDUE UNE FOIS, PAS À CHAQUE ÉCHEC. La garde
//    repartait à 60 s sur n'importe quel échec, sans les compter : un échec qui
//    DURE (session Vinted cassée, base qui refuse) faisait une moisson complète
//    par minute de navigation — 5× plus qu'avant la 5.165, et pour rien.
//    · `true`            : rangé — le compteur repart de zéro ;
//    · `base` / `recul`  : c'est NOTRE base — le recul (`reculBase`) décide
//      quand réessayer, la garde de la visite ne l'allonge pas ;
//    · autre échec       : le PREMIER rend la garde (nouvel essai à 60 s : une
//      page qui naviguait), les suivants gardent les 5 min entières.
//    Les échecs consécutifs vivent dans `chrome.storage.local` (§4.9).
const ECHECS_VISITE = 'vrmVisiteEchecs';            // { [uid]: n }
async function issueVisite(uid, marque, r) {
  let ech = {};
  try { ech = (await chrome.storage.local.get(ECHECS_VISITE))[ECHECS_VISITE] || {}; } catch (_) {}
  const avant = Number(ech[uid] || 0);
  if (r === true) {
    if (avant) { delete ech[uid]; try { await chrome.storage.local.set({ [ECHECS_VISITE]: ech }); } catch (_) {} }
    return;
  }
  if (r === 'base' || r === 'recul') { await rendreGardeVisite(uid, marque, 0); return; }
  ech[uid] = avant + 1;
  try { await chrome.storage.local.set({ [ECHECS_VISITE]: ech }); } catch (_) {}
  if (avant === 0) await rendreGardeVisite(uid, marque);
  else noterDiag('visite_echec_repete');
}
async function visiteVinted() {
  // 22 oct. : une visite, c'est lui sur Vinted — les photos de fond attendent
  // qu'il ait fini (`PHOTOS_CALME_MS` après la fin de la visite, `finally`).
  await noterActiviteVinted();
  try {
    const uid = await activeUidForDomain('www.vinted.fr');
    if (!uid) return;                                   // pas connecté : rien à capter
    // 5.183 : une commande du téléphone attend peut-être — relevée à chaque
    // visite aussi (NOTRE base, pas Vinted ; ses propres gardes s'appliquent).
    relaisTick('visite').catch(() => {});
    if (await compteNonCapte(uid)) { noterDiag('visite_compte_supprime'); return; }
    // ⚠️ 5.162 : Vinted a demandé de ralentir (429/403) — la visite ne lui
    // envoie RIEN tant que la pause court, et chaque étape revérifie (un frein
    // reçu en route arrête la suite). Le ménage des PDF ne touche que NOTRE
    // base : il passe quand même.
    if (await pauseVinted()) { noterDiag('visite_en_pause'); await purgeBordereaux(); await purgeBordereauxAnnules(); return; }
    // ⚠️⚠️ 5.165 — SANS SESSION VRM, LA VISITE N'ENVOIE RIEN À VINTED. Le
    //    9 octobre, la visite lisait profil, dressing, ventes, achats, boîte
    //    (vingt requêtes) que la base refusait ensuite en bloc (400, RLS), et
    //    posait la garde de 5 min : une fois la session revenue, plus rien
    //    jusqu'à ce qu'il quitte le compte. Ici on rend la main SANS garde :
    //    la page suivante réessaie dès que la session est là.
    if (await sansSessionPourEcrire()) { noterDiag('visite_sans_session'); return; }

    // ═══ 1. CE QU'IL ATTEND, TOUT DE SUITE ═══════════════════════════════
    // ⚠️ ORDRE INVERSÉ (Julien, 3 septembre : « quand je me connecte, que ça me
    // demande plus vite de générer le bordereau »). Avant, la vente, le
    // bordereau et le récap arrivaient APRÈS `runActive()` — une moisson
    // COMPLÈTE : dressing jusqu'à 7 pages avec pauses, achats, boîte,
    // porte-monnaie. Le récap pouvait donc mettre une minute à s'afficher
    // alors que la vente ne demande QU'UNE requête (`my_orders?type=sold`).
    // Ce bloc ne coûte rien de plus : ce sont les mêmes appels, simplement
    // placés avant le lourd. Rien à voir avec un « rythme humain » (§32).
    // (Revue 5.165 : pendant un recul de NOTRE base, les ventes non plus ne sont
    //  pas relues — elles ne pourraient pas être rangées.)
    const marqueVentes = (await reculBase()) ? null : await prendreGardeVentes(uid);
    if (marqueVentes !== null) await rafraichirVentesGarde(uid, marqueVentes);
    // Génération uniquement sur activation explicite dans VRM → Ventes.
    // Les PDF déjà émis continuent à être récupérés quand le réglage est coupé.
    if (await pauseVinted()) { await purgeBordereaux(); await purgeBordereauxAnnules(); return; }
    const genes = await avecVinted(() => genererBordereauxEnAttente(uid));
    // Ce qui vient de partir : l'APP l'annonce (5.130 — plus de fenêtre sur
    // Vinted). Elle relit ses bordereaux quand on la prévient.
    if (Number(genes) > 0) notifierApp({ type: 'maj', quoi: 'label', uid: String(uid) });
    // ⛔ (5.179, 16 octobre) LA RÉPONSE AUTOMATIQUE AUX MESSAGES EST COUPÉE —
    //    sa décision : aucune réponse ne part toute seule sur Vinted. Elle n'a
    //    jamais été allumée (mesuré : `vinted_repond_auto` absent partout).
    //    Répondre reste possible depuis la messagerie de l'app, sur SON clic.

    // ═══ 2. LE RESTE, ENSUITE ════════════════════════════════════════════
    // Le garde de 5 min ne protège plus que la moisson COMPLÈTE — c'est elle
    // qui est lourde, et refaire dix fois la même en naviguant de page en page
    // n'apporte rien (§5.19).
    // Revue 5.165 : NOTRE base refuse tout depuis peu — ni moisson, ni lecteurs
    // (ils liraient Vinted pour rien) ; la garde n'est pas consommée.
    if (await reculBase()) { noterDiag('visite_base_en_recul'); return; }
    const st = (await chrome.storage.local.get('vrmDerniereVisite')).vrmDerniereVisite || {};
    if (Date.now() - Number(st[uid] || 0) < VISITE_DELAI_MS) return;
    const marqueVisite = Date.now();
    st[uid] = marqueVisite;
    await chrome.storage.local.set({ vrmDerniereVisite: st });
    const r = await runActive();
    const ok = r === true;
    // ⚠️ 5.165 : une moisson qui n'a RIEN rangé rend sa garde — UNE fois pour un
    //    échec passager, jamais pour un refus de notre base (`issueVisite`).
    await issueVisite(uid, marqueVisite, r);
    logActivity(ok ? '🔄 Données rafraîchies en arrivant sur Vinted'
      : (r === 'base' || r === 'recul') ? '🔄 Ta base VRM n\'a rien pris — Vinted ne sera relu qu\'après une pause'
      : '🔄 Rien n\'a pu être rangé — nouvel essai plus tard');
    // ⚠️ APRÈS la moisson elle aussi : la liste des colis « déposés en point
    // relais » vient des achats qu'on vient de capter. Sans ça, on lirait la
    // photo d'hier et on redemanderait des conversations pour rien.
    // (Chaque lecteur passe par `gardeLecture`, qui refuse pendant une pause :
    //  un frein reçu par l'un arrête les suivants sans requête.)
    // ⚠️ 5.169 — EN PREMIER : la preuve des ventes en cours qui n'en ont pas.
    //    Les ventes viennent d'être captées ; sans leur transaction, l'anti
    //    double vente ne les voit pas (la N°553 du 10 octobre, restée en vente
    //    sur eBay). La moisson de 20:34 l'aurait prouvée dans la minute.
    await capterPreuvesVente(uid);
    await capterRetraits(uid);
    // 5.204 : les notifications « colis à retirer » restées en file (envoi raté)
    // et les colis à confirmer avant leur date limite.
    await envoyerNotifsRetrait();
    await capterConfirmations(uid);
    // ⚠️ APRÈS la moisson : les ventes « finalisées » viennent d'être captées.
    // On relit le détail de celles dont on n'a pas encore la date de versement
    // (le CA déclaré est daté à ce jour-là — demande du 3 octobre).
    await capterDatesVersement(uid);
    // ⚠️ APRÈS la moisson : le mois COURANT vient d'être capté gratuitement par
    // `/payouts` (aucune requête ajoutée) ; ici on ne va chercher que les mois
    // PASSÉS encore absents, deux par visite au plus.
    await capterReleves(uid);
    // ⚠️ 5.167 (11 octobre) — CE QUI EST EN LIGNE SUR SES AUTRES COMPTES : leur
    // dressing PUBLIC, relu avec la session du compte connecté (au plus 3 comptes
    // par visite, aucun relu depuis moins de 30 min, budget de lecture ordinaire).
    // Sans ça, un compte où il ne repasse pas restait figé sur sa dernière
    // lecture — ses annonces supprimées s'affichaient « en ligne » à côté des
    // republiées (« trois fois la même paire »). Voir `relireAnnoncesAutresComptes`.
    await relireAnnoncesAutresComptes(uid);
    // ⛔ 22 octobre : PLUS DE PAGES PHOTO DANS LA VISITE. Elles s'ajoutaient,
    //    jusqu'à 20 d'affilée, aux requêtes de la visite et de sa propre
    //    navigation — les 23 « trop de demandes » mesurés venaient tous de là.
    //    Les photos se complètent en arrière-plan (`tickPhotos`), une page par
    //    minute, et seulement quand il ne navigue plus sur Vinted.
    // ⚠️ MÉNAGE : les PDF des bordereaux de ventes FINALISÉES (livrées depuis
    // longtemps) sont retirés — métadonnée gardée, seul le poids part. Global,
    // borné, cooldown 12 h, fail-safe par sens (voir `purgeBordereaux`).
    await purgeBordereaux(); await purgeBordereauxAnnules();
  } catch (_) { /* une visite ratée n'a pas à casser la navigation */ } finally { await noterActiviteVinted(); }
}




try {
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    const u = (tab && tab.url) || (info && info.url) || '';
    if (!/^https:\/\/(www\.)?vinted\.(fr|com|it|de)\//.test(u)) return;
    // 22 oct. : il navigue sur Vinted (une page charge, ou l'adresse change) —
    // aucune page photo de fond tant qu'il est là (`PHOTOS_CALME_MS`).
    if (info && (info.url || info.status === 'loading' || info.status === 'complete')) noterActiviteVinted();
    // 23 oct. : l'annonce qu'il ouvre EN ÉDITION dans cet onglet — seule celle-là
    // peut recevoir une fiche « modification » de cet onglet (`ficheDeLaPage`).
    const ed = annonceDeAdresse(u);
    if (ed && ed.edit && tabId != null) noterOngletFiche(ANNONCES_ONGLETS, tabId, ed.id);
    if (!info || info.status !== 'complete') return;
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
// ⚠️⚠️ 19 octobre (5.193) — UNE SEULE ÉCRITURE À LA FOIS SUR `vinted_item_details`.
//    C'est une ligne lue-fusionnée-réécrite EN ENTIER, et trois chemins
//    l'écrivent : la page d'annonce ouverte (`saveDetail`), le clic « Publier »
//    (`completerPhotos`) et la capture de fond (`capterPhotosAnnonces`, dont la
//    boucle dure plusieurs secondes). Deux écritures simultanées : la seconde
//    repartait d'une copie sans la fiche de la première, et l'EFFAÇAIT. Une
//    chaîne de promesses les met à la queue — ce n'est pas un tampon de données
//    (§4.9) : chacune relit la ligne en base au moment d'écrire.
let _chaineItemDetails = Promise.resolve();
function unItemDetailsALaFois(fn) {
  const p = _chaineItemDetails.then(fn, fn);
  _chaineItemDetails = p.then(() => {}, () => {});
  return p;
}
function saveItemDetail(id, detail) { return unItemDetailsALaFois(() => saveItemDetailMaintenant(id, detail)); }
async function saveItemDetailMaintenant(id, detail) {
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
    // La couleur affichée par Vinted : jamais écrasée par du vide.
    couleur: String(detail.couleur || '').trim().slice(0, 60) || prev.couleur || '',
  };
  // On garde ce que la page de l'annonce a appris (codes, date de lecture) :
  // l'écrasement par une lecture du panneau les perdait.
  for (const k of ['codes', 'photoIds', 'pageAt', 'pageFormat', 'modifAt']) if (prev[k] !== undefined && cur[key][k] === undefined) cur[key][k] = prev[k];
  if (retirerPhotosEtrangeres(cur)) noterDiag('photos_etrangeres_retirees');
  await supabaseUpsert('app_data', [{ id: 'vinted_item_details', data: cur }], 'id');
}

// ══════════════════════════════════════════════════════════════════════════════
// LES FICHES EN ATTENTE D'ÊTRE RANGÉES DANS `vinted_item_details` (22 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// Deux sources y passent : la page d'annonce lue pour ses photos (`src:'page'`,
// une par minute au plus) et la fiche qu'il ENREGISTRE lui-même sur Vinted
// (`src:'modif'`, voir `noterFicheVinted`). La file vit dans
// `chrome.storage.local` (§4.9 : le service worker meurt, une fiche vue ne doit
// pas mourir avec lui) ; elle est rangée en UNE écriture de la ligne, relue au
// moment d'écrire (5.193) — par lot de `FICHES_LOT` pages, au bout de
// `FICHES_DELAI_MS`, ou tout de suite quand il a modifié une annonce.
// ⚠️ « Rien lu ne vaut pas rien » : ligne illisible ⇒ on n'écrit PAS (on
//    effacerait les autres fiches), la file reste et repart au tour suivant.
// ⚠️ On ne retire de la file que ce qui est RANGÉ, relu au dernier moment : une
//    fiche arrivée pendant l'écriture ne disparaît pas avec les autres.
const FICHES_FILE = 'vrmFichesAttente';     // [{ id, src: 'page'|'modif', at, f }]
const FICHES_MAX = 300;
const FICHES_LOT = 5;
const FICHES_DELAI_MS = 10 * 60 * 1000;
// Après une lecture ou une écriture ratée, le rangement AUTOMATIQUE attend
// `FICHES_DELAI_MS` avant de réessayer : sinon une base qui refuse (ou une
// session VRM absente) ferait redescendre la ligne entière à chaque minute pour
// rien (§4.4). Un geste de sa part (publier, modifier) réessaie tout de suite.
const FICHES_ECHEC = 'vrmFichesEchecAt';
let _chaineFiches = Promise.resolve();
function surFileFiches(fn) {
  const p = _chaineFiches.then(fn, fn);
  _chaineFiches = p.then(() => {}, () => {});
  return p;
}
async function lireFichesEnAttente() {
  try { const f = (await chrome.storage.local.get(FICHES_FILE))[FICHES_FILE]; return Array.isArray(f) ? f : []; } catch (_) { return []; }
}
function enfilerFiches(entrees) {
  return surFileFiches(async () => {
    try {
      const f = await lireFichesEnAttente();
      await chrome.storage.local.set({ [FICHES_FILE]: f.concat(entrees).slice(-FICHES_MAX) });
      return true;
    } catch (_) { return false; }
  });
}
const cleFiche = (e) => `${e && e.id}|${e && e.src}|${e && e.at}`;
function retirerFichesRangees(faites) {
  const cles = new Set(faites.map(cleFiche));
  return surFileFiches(async () => {
    try { const f = await lireFichesEnAttente(); await chrome.storage.local.set({ [FICHES_FILE]: f.filter((e) => !cles.has(cleFiche(e))) }); } catch (_) {}
  });
}
// UNE règle de fusion pour les deux sources : une valeur PLEINE remplace,
// une valeur vide ne remplace JAMAIS (« un texte rempli n'est jamais remplacé
// par du vide »). Les codes se fusionnent clé par clé. Ordre : la plus ancienne
// d'abord — la dernière chose qu'il a enregistrée gagne.
const valeurPleine = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
function fusionFiche(prev0, e) {
  const prev = (prev0 && typeof prev0 === 'object') ? prev0 : {};
  const f = (e && e.f && typeof e.f === 'object') ? e.f : {};
  const out = Object.assign({}, prev);
  const desc = typeof f.description === 'string' ? f.description.trim() : '';
  if (desc) out.description = desc; else if (typeof out.description !== 'string') out.description = '';
  if (Array.isArray(f.photos) && f.photos.length) out.photos = f.photos.filter(Boolean).slice(0, 24);
  else if (!Array.isArray(out.photos)) out.photos = [];
  if (f.codes && typeof f.codes === 'object') {
    const c = Object.assign({}, (prev.codes && typeof prev.codes === 'object') ? prev.codes : {});
    for (const k of Object.keys(f.codes)) if (valeurPleine(f.codes[k])) c[k] = f.codes[k];
    if (Object.keys(c).length) out.codes = c;
  }
  if (Array.isArray(f.photoIds) && f.photoIds.length) out.photoIds = f.photoIds;
  const coul = typeof f.couleur === 'string' ? f.couleur.trim().slice(0, 60) : '';
  if (coul) out.couleur = coul; else if (typeof out.couleur !== 'string') out.couleur = '';
  if (e && e.src === 'page') { out.readAt = e.at; out.pageAt = e.at; out.pageFormat = String(f.pageFormat || ''); }
  if (e && e.src === 'modif') out.modifAt = e.at;
  return out;
}
function appliquerFiches(cur, file) {
  const ok = file.filter((e) => e && /^\d{1,15}$/.test(String(e.id || '')) && e.f && (e.src === 'page' || e.src === 'modif'));
  ok.sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
  for (const e of ok) cur[String(e.id)] = fusionFiche(cur[String(e.id)], e);
  return ok;
}
// `force` : ranger maintenant. Sinon seulement s'il y a une fiche qu'il a
// enregistrée, un lot complet, ou une fiche qui attend depuis `FICHES_DELAI_MS`.
// Rend `true` quand la file est vide après coup.
function viderFiches({ force = false } = {}) {
  return unItemDetailsALaFois(async () => {
    const file = await lireFichesEnAttente();
    if (!file.length) return true;
    if (!force) {
      const plusVieille = Math.min(...file.map((e) => Date.parse(e && e.at) || Date.now()));
      if (!(file.some((e) => e && e.src === 'modif') || file.length >= FICHES_LOT || Date.now() - plusVieille >= FICHES_DELAI_MS)) return false;
      let echec = 0; try { echec = Number((await chrome.storage.local.get(FICHES_ECHEC))[FICHES_ECHEC] || 0); } catch (_) {}
      const depuis = Date.now() - echec;
      if (echec && depuis >= 0 && depuis < FICHES_DELAI_MS) return false;
    }
    const rate = async (diag) => { noterDiag(diag); try { await chrome.storage.local.set({ [FICHES_ECHEC]: Date.now() }); } catch (_) {} return false; };
    if (await sansSessionPourEcrire()) return rate('fiches_sans_session');   // sans session, la base refuserait : on ne la relit pas
    const rr = await sbGet('app_data?id=eq.vinted_item_details&select=data');
    if (rr === null) return rate('fiches_lecture_ratee');                    // pas su : on n'écrase rien, la file reste
    const cur = (rr[0] && rr[0].data) || {};
    const faites = appliquerFiches(cur, file);
    if (retirerPhotosEtrangeres(cur)) noterDiag('photos_etrangeres_retirees');
    const ok = await supabaseUpsert('app_data', [{ id: 'vinted_item_details', data: cur }], 'id');
    if (!ok) return rate('fiches_ecriture_ratee');
    try { await chrome.storage.local.remove(FICHES_ECHEC); } catch (_) {}
    await retirerFichesRangees(file);
    for (const e of faites) noterDiag(e.src === 'modif' ? 'fiche_modif_rangee' : 'fiche_page_rangee');
    return true;
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// LA FICHE QU'IL ENREGISTRE SUR VINTED (22 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// Mesuré le 22 octobre chez Julien : sur ses 49 annonces en ligne, 4 seulement
// ont leur description dans `vinted_item_details`, aucune n'a sa catégorie ni
// ses couleurs (`fiche_codes_absents` = 804 : la page lue ne les livre jamais).
// Or quand il MODIFIE une annonce, sa page envoie
// `PUT /api/v2/item_upload/items/{id}` avec `{ item: { id, description,
// catalog_id, brand_id, brand, color_ids, item_attributes, package_size_id… } }`
// — mesuré sur 6 modifications : l'`id` du corps est TOUJOURS celui de
// l'adresse. Et quand il publie, `POST /api/v2/item_upload/items` (l'identifiant
// vient alors de la réponse de Vinted, comme pour le numéro, 5.201).
// ⇒ `inject.js` ne poste cette fiche qu'après un 2xx de Vinted, avec
//   l'identifiant de l'ADRESSE (ou de la réponse) ; on n'y garde que la
//   description et les codes. Un corps dont l'`id` contredit l'adresse ne range
//   RIEN (§5 : l'identité, jamais un titre). Jamais les photos envoyées, ni les
//   frais de port, ni la session de dépôt.
// ⚠️ La COULEUR affichée (« Blanc ») n'est pas dans le corps — seulement ses
//    codes (`color_ids`) : on range les codes, on n'invente pas le libellé.
function ficheDeCorpsVinted(corps, id) {
  let j = null;
  if (corps && typeof corps === 'object') j = corps;
  else {
    const t = String(corps == null ? '' : corps).trim();
    if (!t || t[0] !== '{') return null;
    try { j = JSON.parse(t); } catch (_) { return null; }
  }
  const it = (j && j.item && typeof j.item === 'object') ? j.item : null;
  if (!it) return null;
  if (it.id != null && String(it.id) !== String(id)) return { contredit: true };
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : ((typeof v === 'string' && /^\d{1,12}$/.test(v)) ? Number(v) : null);
  const out = {};
  if (typeof it.description === 'string' && it.description.trim()) out.description = it.description.trim().slice(0, 5000);
  const c = {};
  for (const k of ['catalog_id', 'brand_id', 'package_size_id']) if (num(it[k]) != null) c[k] = num(it[k]);
  if (typeof it.brand === 'string' && it.brand.trim()) c.brand = it.brand.trim().slice(0, 80);
  if (typeof it.is_unisex === 'boolean') c.is_unisex = it.is_unisex;
  if (Array.isArray(it.color_ids)) { const ids = it.color_ids.map(num).filter((x) => x != null).slice(0, 4); if (ids.length) c.color_ids = ids; }
  if (Array.isArray(it.item_attributes)) {
    const a = it.item_attributes.map((x) => (x && typeof x === 'object' && typeof x.code === 'string')
      ? { code: x.code.slice(0, 40), ids: Array.isArray(x.ids) ? x.ids.map(num).filter((v) => v != null).slice(0, 10) : [] } : null)
      .filter((x) => x && x.code && x.ids.length).slice(0, 10);
    if (a.length) c.item_attributes = a;
  }
  if (Object.keys(c).length) out.codes = c;
  return out;
}
// ⚠️⚠️ REVUE DU 23 OCTOBRE — LE MESSAGE « fiche » SE FORGE. `content.js` relaie
//    tout message de la page qui porte l'étiquette ; n'importe quel script de
//    vinted.fr (pub, mesure d'audience, faille) pouvait poster
//    `{kind:'fiche', itemId: <n'importe laquelle de ses annonces>, corps}` SANS
//    aucune requête chez Vinted : le texte remplaçait la description rangée, et
//    partait tel quel dans les files Leboncoin et eBay — publié sous son nom
//    (reproduit sur 5f6943d : « Paye-moi hors plateforme… » dans la file).
// ⇒ On juge l'ONGLET ÉMETTEUR (`sender`, posé par le navigateur, jamais par la page) :
//   · une MODIFICATION n'est acceptée que de l'onglet qui montre CETTE annonce
//     (`/items/{id}/edit` ou `/items/{id}`), ou qui l'a ouverte en édition il y a
//     moins de 30 min (`ANNONCES_ONGLETS`, noté par `chrome.tabs.onUpdated` — la
//     page peut changer d'adresse juste après l'enregistrement) ;
//   · une PUBLICATION, que de l'onglet dont la réservation de numéro vient d'être
//     liée à CETTE annonce (`noterPublication`, 2xx de Vinted) ;
//   · un compte refusé (« Non, ignorer ce compte ») ou supprimé définitivement :
//     rien (`compteNonCapte`, la porte des cinq autres captures, 5.191).
// ⚠️ CE QUI RESTE, dit tel quel : un script de la page peut encore changer
//    l'adresse de SON onglet (`history.pushState`) vers `/items/{X}/edit` puis
//    poster une fiche pour X. La falsification ne vaut donc plus « pour toutes
//    ses annonces, de n'importe quelle page », mais pour l'annonce dont l'onglet
//    affiche l'adresse ; et un tel script peut de toute façon modifier l'annonce
//    chez Vinted lui-même, avec sa session.
const FICHE_ONGLET_MS = 30 * 60 * 1000;
const ANNONCES_ONGLETS = 'vrmOngletsAnnonces';   // { [tabId]: { id, at } } — l'annonce ouverte EN ÉDITION dans cet onglet
const PUBLIS_ONGLETS = 'vrmOngletsPublications'; // { [tabId]: { id, at } } — l'annonce que cet onglet vient de publier (2xx)
// L'annonce que montre une adresse Vinted : `/items/{id}` (avec ou sans le
// libellé `-nike-air-max`), `/items/{id}/edit` (ou `/items/edit/{id}` : la forme
// exacte de la page de modification n'a pas été vue d'ici). Autre chose ⇒ `null`.
function annonceDeAdresse(u) {
  let U = null; try { U = new URL(String(u || '')); } catch (_) { return null; }
  if (U.protocol !== 'https:' || !/(^|\.)vinted\.[a-z.]+$/i.test(U.hostname)) return null;
  const m = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/items\/(edit\/)?(\d{4,15})(?:-[^/]*)?(\/edit)?\/?$/i.exec(U.pathname);
  return m ? { id: m[2], edit: !!(m[1] || m[3]) } : null;
}
let _chaineOngletsFiche = Promise.resolve();
function noterOngletFiche(cle, tabId, id) {
  const p = _chaineOngletsFiche.then(async () => {
    try {
      const m = (await chrome.storage.local.get(cle))[cle] || {};
      const t = Date.now(), v = m[String(tabId)];
      if (v && v.id === String(id) && t - Number(v.at || 0) < 60 * 1000) return;   // rien de neuf : pas d'écriture
      m[String(tabId)] = { id: String(id), at: t };
      const garde = Object.entries(m).filter(([, x]) => x && t - Number(x.at || 0) < FICHE_ONGLET_MS)
        .sort((a, b) => Number(b[1].at) - Number(a[1].at)).slice(0, 20);
      await chrome.storage.local.set({ [cle]: Object.fromEntries(garde) });
    } catch (_) {}
  });
  _chaineOngletsFiche = p.then(() => {}, () => {});
  return p;
}
async function ongletFicheVu(cle, tabId, id) {
  if (tabId == null) return false;
  try {
    const v = ((await chrome.storage.local.get(cle))[cle] || {})[String(tabId)];
    const age = Date.now() - Number(v && v.at || 0);
    return !!(v && v.id === String(id) && age >= 0 && age < FICHE_ONGLET_MS);
  } catch (_) { return false; }
}
function ficheDeLaPage(msg, sender, domain) {
  const id = String((msg && msg.itemId) || '');
  const tabId = sender && sender.tab && sender.tab.id != null ? sender.tab.id : null;
  if (msg && msg.via === 'publication') {
    // Dans la file des réservations : la publication de CET onglet (message
    // précédent de la page) est notée avant qu'on ne la cherche ici.
    return unResaALaFois(async () => {
      if (!(await ongletFicheVu(PUBLIS_ONGLETS, tabId, id))) { noterDiag('fiche_onglet_refuse'); return false; }
      return noterFicheVinted(id, msg.status, msg.corps, domain);
    });
  }
  if (msg && msg.via === 'modif') {
    return (async () => {
      const adr = annonceDeAdresse((sender && sender.tab && sender.tab.url) || (sender && sender.url) || '');
      if (!((adr && adr.id === id) || (await ongletFicheVu(ANNONCES_ONGLETS, tabId, id)))) { noterDiag('fiche_onglet_refuse'); return false; }
      return noterFicheVinted(id, msg.status, msg.corps, domain);
    })();
  }
  noterDiag('fiche_onglet_refuse');
  return Promise.resolve(false);
}
async function noterFicheVinted(itemId, status, corps, domain) {
  const id = String(itemId || '');
  const st = Number(status);
  if (!/^\d{4,15}$/.test(id) || !(st >= 200 && st < 300)) { noterDiag('fiche_modif_forme'); return false; }
  // 23 oct. : la porte de TOUTE capture (5.191) — un compte qu'il a refusé dans ce
  // Chrome, ou supprimé définitivement, ne range rien. Compte du cookie illisible
  // ⇒ comme les autres portes : « pas répondu », on capte.
  let uid = null; try { uid = await activeUidForDomain(domain || 'www.vinted.fr'); } catch (_) { uid = null; }
  if (uid && await compteNonCapte(uid)) { noterDiag('fiche_compte_non_capte'); return false; }
  const f = ficheDeCorpsVinted(corps, id);
  if (!f) { noterDiag('fiche_modif_illisible'); return false; }
  if (f.contredit) { noterDiag('fiche_modif_id_contredit'); return false; }
  if (!f.description && !f.codes) { noterDiag('fiche_modif_vide'); return false; }
  await enfilerFiches([{ id, src: 'modif', at: new Date(Date.now()).toISOString(), f }]);
  noterDiag('fiche_modif_vue');
  return viderFiches({ force: true });
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

// `plafond` : la part des 20 actions que CE geste a le droit d'atteindre (les
// bordereaux commandés par l'app s'arrêtent avant la réserve des gestes sur
// clic, voir `RESERVE_GESTES`). `resteMs` dit quand une place se libère : la
// raison d'un refus donne une heure, pas « plus tard ».
// ⚠️⚠️ REVUE DU 17 OCTOBRE — UN COMPTEUR À LA FOIS. Lire-ajouter-réécrire dans
//    `chrome.storage.local` sans file : deux gestes simultanés (le relais du
//    téléphone pendant un clic dans l'app, un double clic) lisaient tous les deux
//    19, passaient tous les deux, et la seconde écriture effaçait la première —
//    22 réponses parties dans l'heure, 20 notées (prouvé :
//    `audit-compteurs-concurrents.cjs`). Une chaîne de promesses en mémoire
//    sérialise le compte : ce n'est pas un tampon de données (§4.9), rien n'y
//    est gardé — l'état reste dans le stockage.
let _chaineCompteurs = Promise.resolve();
function unCompteurALaFois(fn) {
  const suite = _chaineCompteurs.then(() => fn(), () => fn());
  _chaineCompteurs = suite.then(() => {}, () => {});
  return suite;
}
function compterAction(uid, plafond = ACTIONS_MAX_HEURE) { return unCompteurALaFois(() => compterActionUn(uid, plafond)); }
async function compterActionUn(uid, plafond) {
  try {
    const cle = 'vrmActions';
    const cur = (await chrome.storage.local.get(cle))[cle] || {};
    const t = Date.now(), ilYaUneHeure = t - 3600000;
    const list = (cur[uid] || []).filter(x => x > ilYaUneHeure).sort((a, b) => a - b);
    const max = Math.min(ACTIONS_MAX_HEURE, plafond);
    if (list.length >= max) return { ok: false, n: list.length, resteMs: Math.max(0, list[list.length - max] + 3600000 - t) };
    list.push(t); cur[uid] = list;
    await chrome.storage.local.set({ [cle]: cur });
    return { ok: true, n: list.length };
  } catch (_) { return { ok: true, n: 0 }; }
}
// ⚠️⚠️ UNE RÉSERVE POUR LES GESTES SUR CLIC (revue du 9 octobre). Un seul clic
//    « Tout générer (20) » commandait 20 bordereaux et prenait les 20 actions de
//    l'heure : une réponse à un acheteur depuis la messagerie de l'app était
//    ensuite refusée pendant une heure (mesuré dans un vm, chaîne réelle). Les
//    bordereaux COMMANDÉS PAR L'APP s'arrêtent donc à 20 − 5 : les 5 dernières
//    actions de l'heure restent à ce qui part sur SON clic un par un (répondre,
//    trancher une offre). Le total ne bouge pas (20/h) — monter ce chiffre
//    serait deviner le seuil de Vinted (§3).
const RESERVE_GESTES = 5;

// ⚠️ BUDGET DE *LECTURE*, SÉPARÉ DU BUDGET D'ACTIONS (Julien, 3 octobre :
// « capte toutes mes photos »). Lire la PAGE de ses propres annonces (photos,
// description) est une LECTURE — pas un geste qui vend ou qui écrit chez Vinted.
// Le dossier le pose déjà (§messagerie 5.135 : « une lecture ne consomme pas le
// plafond de 20 actions/heure ; un geste, si »). Or `capterPhotosAnnonces`
// passait par `garde` → `compterAction` : la capture photo MANGEAIT le budget
// de tes vraies actions (accepter une offre, générer un bordereau) et les
// bloquait. On lui donne son PROPRE compteur horaire, borné lui aussi (jamais
// une rafale — toujours une par une, compte connecté). Les deux restent à 20/h
// (le rythme qui tourne sans blocage) : ça n'ACCÉLÈRE pas la capture, ça
// l'empêche d'affamer les actions. Monter ce chiffre = deviner le seuil de
// Vinted (refusé, §3).
const LECTURES_MAX_HEURE = 20;
// `plafond` : la part du budget que CETTE lecture a le droit d'atteindre (les
// photos s'arrêtent avant la réserve de l'argent et des colis, voir plus bas).
function compterLecture(uid, plafond = LECTURES_MAX_HEURE) { return unCompteurALaFois(() => compterLectureUn(uid, plafond)); }
async function compterLectureUn(uid, plafond) {
  try {
    const cle = 'vrmLectures';
    const cur = (await chrome.storage.local.get(cle))[cle] || {};
    const t = Date.now(), ilYaUneHeure = t - 3600000;
    const list = (cur[uid] || []).filter(x => x > ilYaUneHeure);
    if (list.length >= Math.min(LECTURES_MAX_HEURE, plafond)) return { ok: false, n: list.length };
    list.push(t); cur[uid] = list;
    await chrome.storage.local.set({ [cle]: cur });
    return { ok: true, n: list.length };
  } catch (_) { return { ok: true, n: 0 }; }
}
// ══ L'ARGENT ET LES COLIS PASSENT AVANT LES PHOTOS (5.162, 6 octobre) ══════
// MESURÉ avant de coder : `capterRetraits`, `capterDatesVersement` et
// `capterReleves` passaient par `garde` → `compterAction`, le budget de 20
// ACTIONS/heure partagé avec « Générer le bordereau » et les réponses. Une
// visite pouvait en manger 10 (3 codes + 5 versements + 2 relevés) — pour de
// simples LECTURES de ses propres données. Elles passent sur le budget de
// LECTURE (`gardeLecture`), comme les photos depuis la 5.144.
// ⚠️ Mais ce budget-là, les PHOTOS le vidaient : `tickPhotos` tourne chaque
// minute (jusqu'à 20 pages par tour). Mesuré le 6 octobre : 238 ventes
// finalisées sans date de versement sur ses comptes actifs — c'est le CA qu'il
// déclare. Les lectures d'argent et de colis ont donc la PRIORITÉ : les photos
// s'arrêtent avant une RÉSERVE égale à ce qu'une visite peut encore lire pour
// elles (au plus 5 versements + 2 relevés + 3 codes), et seulement tant
// qu'elles ont quelque chose à lire. Chaque lecteur prioritaire note ce qu'il
// lui RESTE (`vrmLecturesDues`) ; « pas su » (jamais noté, ou noté il y a plus
// d'une heure) garde la réserve entière. Le plafond total ne bouge pas (20/h).
const LECTURES_DUES = 'vrmLecturesDues';          // { [uid]: { versement:{reste,at}, releve:{…}, retrait:{…}, preuve:{…} } }
const LECTURES_DUES_VALIDITE_MS = 60 * 60 * 1000;
// Les lecteurs prioritaires et ce qu'une visite peut lire pour chacun. Lu à
// l'appel (les constantes vivent plus bas dans le fichier).
const lecteursPrioritaires = () => ({ versement: VERSEMENT_MAX_PAR_VISITE, releve: RELEVE_MAX_PAR_VISITE, retrait: RETRAIT_MAX_PAR_VISITE, preuve: PREUVE_MAX_PAR_VISITE });
// ⚠️⚠️ REVUE DE LA 5.167 — LA RELECTURE PUBLIQUE ÉTAIT DANS LA CLASSE DES PHOTOS.
//    Après une republication (30 annonces neuves dont il manque les photos),
//    `tickPhotos` vidait le budget à la minute 0, et les autres comptes attendaient
//    une HEURE — pendant que l'écran promettait « à ta prochaine visite » (prouvé
//    au banc, horloge simulée). ⇒ Trois étages, le total ne bouge pas (20/h) :
//    l'argent et les colis d'abord (tout le budget), puis la relecture des autres
//    comptes (tout sauf la réserve de l'argent), puis les photos (tout sauf les
//    deux réserves). La relecture note elle aussi ce qui lui reste
//    (`noterLecturesDues(uid, 'enligne', …)`) ; « pas su » garde sa réserve.
const lecteursAvantPhotos = () => ({ enligne: ENLIGNE_MAX_PAR_VISITE });
async function noterLecturesDues(uid, quoi, reste) {
  try {
    const cur = (await chrome.storage.local.get(LECTURES_DUES))[LECTURES_DUES] || {};
    const u = cur[String(uid)] || {};
    u[quoi] = { reste: Math.max(0, Number(reste) || 0), at: Date.now() };
    cur[String(uid)] = u;
    await chrome.storage.local.set({ [LECTURES_DUES]: cur });
  } catch (_) {}
}
async function reserveLectures(uid, classe = 'photos') {
  const max = Object.assign({}, lecteursPrioritaires(), classe === 'photos' ? lecteursAvantPhotos() : {});
  let dues = {};
  try { dues = ((await chrome.storage.local.get(LECTURES_DUES))[LECTURES_DUES] || {})[String(uid)] || {}; } catch (_) {}
  let r = 0;
  for (const k of Object.keys(max)) {
    const d = dues[k];
    const connu = d && Date.now() - Number(d.at || 0) < LECTURES_DUES_VALIDITE_MS;
    r += connu ? Math.min(Number(d.reste) || 0, max[k]) : max[k];   // pas su ⇒ réserve entière
  }
  return r;
}
// Garde d'une LECTURE : même exigence de compte connecté que `garde` (on ne lit
// JAMAIS au nom d'un autre compte que celui du cookie — §3), mais sur le budget
// de lecture, pas celui des actions.
// `classe` : 'argent' (versements, relevés) et 'colis' (codes de retrait) ont
// tout le budget ; 'clic' (une lecture déclenchée par SON clic) aussi ;
// 'enligne' (la relecture des autres comptes) s'arrête avant la réserve de
// l'argent et des colis ; 'photos' (le défaut) avant celle-ci ET celle de la
// relecture.
async function gardeLecture(uid, acc, classe = 'photos') {
  const p = await pauseVinted();
  if (p) return { ok: false, code: 'vinted-pause', error: raisonPauseVinted(p) };
  const actif = await compteConnecte(acc && acc.domain);
  if (actif && String(actif) !== String(uid)) {
    return { ok: false, code: 'autre-compte',
             error: "ton navigateur est connecté à un autre compte — bascule sur celui-ci sur Vinted" };
  }
  const prioritaire = classe === 'argent' || classe === 'colis' || classe === 'clic';
  const plafond = prioritaire ? LECTURES_MAX_HEURE : LECTURES_MAX_HEURE - (await reserveLectures(uid, classe === 'enligne' ? 'enligne' : 'photos'));
  const c = await compterLecture(String(uid), plafond);
  if (!c.ok) return prioritaire
    ? { ok: false, code: 'trop-de-lectures',
        error: `${LECTURES_MAX_HEURE} lectures sur ce compte dans l'heure — on s'arrête pour ne pas attirer l'attention. La suite au prochain passage.` }
    : { ok: false, code: 'lectures-reservees',
        error: "le reste des lectures de l'heure est gardé pour l'argent et les colis — les photos continuent au prochain passage" };
  return null;
}

// ── ACTIONS COMMANDÉES PAR L'APP : LA GARDE STRICTE ─────────────────────────
// `garde` laisse passer quand aucun cookie n'est lisible (une détection ratée
// ne doit pas casser une visite sur Vinted, où l'onglet prouve le compte). Une
// commande venue de l'APP n'a pas cette preuve : on ne sait pas quel compte est
// connecté, donc on n'agit pas. « Pas su » ne vaut pas « oui ».
// ⚠️⚠️ LES SEULES ADRESSES DE L'APP — vérifiées sur le projet Vercel le
//    4 octobre : `vrm.center` et `cancale-v67-ten.vercel.app` (qui redirige
//    dessus). La liste faisait aussi confiance à `cancale-v67.vercel.app` et à
//    `www.vrm.center`, qui ne sont PAS au projet — la première est à quelqu'un
//    d'autre ou à prendre (Vercel a ajouté « -ten » parce que le nom était
//    pris). Une page servie là recevait le pont : elle pouvait faire adopter SA
//    session VRM à l'extension (les captures de Julien, jetons Vinted compris,
//    partaient dans sa boutique) et commander des actions Vinted (accepter une
//    offre, répondre). Et la règle n'était pas ancrée à droite :
//    `https://vrm.center.autre-site.com` passait. Une seule liste, ici, pour
//    tous les messages du pont, et `APP_URLS` en découle.
const ORIGINES_APP = ['https://vrm.center', 'https://cancale-v67-ten.vercel.app'];
const ORIGINE_APP = { test: (src) => { try { return ORIGINES_APP.includes(new URL(String(src || '')).origin); } catch (_) { return false; } } };
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
  // 5.183 : accepter VEND la paire — une commande venue du téléphone n'est
  // exécutée que si elle porte SA confirmation (`confirmer`, voir le relais).
  { methode: 'PUT',  chemin: /^\/api\/v2\/transactions\/\d+\/offer_requests\/\d+\/accept$/, confirmer: true }, // accepter une offre
  { methode: 'PUT',  chemin: /^\/api\/v2\/transactions\/\d+\/offer_requests\/\d+\/reject$/ }, // refuser une offre
  { methode: 'POST', chemin: /^\/api\/v2\/transactions\/\d+\/offers$/ },     // faire une offre
];
function execPermis(methode, endpoint) {
  const e = String(endpoint || '');
  return EXEC_PERMIS.find((p) => p.methode === methode && p.chemin.test(e)) || null;
}
async function gardeStricte(uid, acc, opts = {}) {
  // Vinted a demandé de ralentir : même un clic attend (5.162). On le DIT.
  const pause = await pauseVinted();
  if (pause) return { ok: false, code: 'vinted-pause', error: raisonPauseVinted(pause) };
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
  const reserve = Math.max(0, Number(opts.reserve) || 0);
  const c = await compterAction(String(uid), ACTIONS_MAX_HEURE - reserve);
  if (!c.ok) {
    const min = Math.max(1, Math.ceil(Number(c.resteMs || 0) / 60000));
    if (reserve && c.n < ACTIONS_MAX_HEURE) {
      return { ok: false, code: 'plafond-bordereaux',
               error: `${ACTIONS_MAX_HEURE - reserve} actions sur ce compte dans l'heure — les ${reserve} dernières sont gardées pour répondre à tes acheteurs. La suite dans ${min} min.` };
    }
    return { ok: false, code: 'plafond',
             error: `${ACTIONS_MAX_HEURE} actions sur ce compte dans l'heure — on s'arrête là pour ne pas attirer l'attention. Réessaie dans ${min} min.` };
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
  // ⚠️⚠️ Revue du 19 oct. (rouge sur l'avant, `audit-argent-vinted.cjs`) :
  //    accepter une offre VEND la paire. L'app envoyait bien `confirme` après sa
  //    confirmation… et le pont le jetait : le fond ne l'exigeait que par le
  //    relais du téléphone. N'importe quel message `exec` de l'app acceptait
  //    donc une offre sans elle. Exigé ici, pour toutes les voies.
  if (permis.confirmer && msg.confirme !== true) return { ok: false, code: 'confirmation', error: 'ce geste vend la paire : il demande ta confirmation — rien n\'est parti' };
  const accts = await getStoredAccounts();
  const acc = accts.find((a) => String(a.vinted_user_id) === String(msg.uid));
  if (!acc) return { ok: false, error: 'compte introuvable' };
  const stop = await gardeStricte(msg.uid, acc, { lecture: !!permis.lecture });
  if (stop) return stop;
  // ⚠️ 19 oct. : la file peut attendre (une autre requête Vinted en vol) — le
  //   compte du cookie est REVÉRIFIÉ à son tour, juste avant de partir. Basculé
  //   entre-temps sur un autre compte ⇒ rien ne part (rouge sur l'avant).
  let arret = null;
  const r = await avecVinted(async () => {
    arret = await gardeStricte(msg.uid, acc, { lecture: true });
    if (arret) return null;
    return methode === 'GET' ? vintedGet(acc, msg.endpoint) : vintedSend(acc, methode, msg.endpoint, msg.body);
  });
  if (arret) return arret;
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
const APP_URLS = ORIGINES_APP.map((o) => o + '/*');
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
  notifierApp(Object.assign({ type: 'cmd', jobId }, cmds[jobId], avecVivant(jobId)));
  // 5.183 : une commande du TÉLÉPHONE suit ce bordereau — sa ligne avance aussi.
  relaisSuivreJob(jobId, cmds[jobId]).catch(() => {});
  return cmds[jobId];
}
// `vivant: true` = cette demande est RÉELLEMENT dans la file de ce service
// worker (pas seulement notée « file » dans le stockage). L'app s'y fie pour
// garder « En file… » tant qu'elle attend son tour, sans délai arbitraire ;
// une demande orpheline (service worker redémarré) ne le porte plus.
const avecVivant = (jobId) => (/^bord:/.test(String(jobId)) && BORD_EN_COURS.has(String(jobId)) ? { vivant: true } : {});
// ── « LES INFORMATIONS CIRCULENT-ELLES BIEN ? » ─────────────────────────────
// Le petit écran de l'extension le dit, plateforme par plateforme : dernier
// envoi réussi, dernier envoi refusé. MESURÉ aux points d'écriture, jamais
// supposé (« pas su » ≠ « oui ») — c'est `chrome.storage` (§4.9).
async function noterFlux(plateforme, ok) {
  try {
    const cur = (await chrome.storage.local.get('vrmFlux')).vrmFlux || {};
    const p = cur[plateforme] || {};
    if (ok) { p.okAt = Date.now(); p.koStatut = null; } else { p.koAt = Date.now(); p.koStatut = _statutDernierRefus; }
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
// ⚠️ 5.160 : PÉRIMÉ-MAIS-SERVI. Le mémo avait 5 min de vie, et au-delà la
//    réponse ATTENDAIT la liste des comptes en base (réseau) — dans l'état que
//    l'app interroge toutes les 20 s avec 2,5 s de patience. Un login ne change
//    presque jamais : on rend le mémo même ancien et on le rafraîchit EN FOND
//    (un seul en vol). On n'attend la base que si ce compte n'est pas connu du
//    tout, et au plus `attendreMs`.
let _loginsEnVol = null, _loginsOwner='';
async function rafraichirLogins() {
  const owner=(await loadSession())?.user_id;
  if(!owner)return null;
  if (_loginsEnVol && _loginsOwner===owner) return _loginsEnVol;
  _loginsOwner=owner;
  _loginsEnVol = (async () => {
    const accts = await avecDelai(getStoredAccounts(), 15000, null);
    if (!Array.isArray(accts) || !accts.length) return null;   // rien lu ⇒ on garde l'ancien mémo
    if((await loadSession())?.user_id!==owner||accts.some(a=>a.owner!==owner))return null;
    const map = {}; for (const a of accts) map[String(a.vinted_user_id)] = a.login || '';
    try { await chrome.storage.local.set({ vrmLogins: { owner, at: Date.now(), map } }); } catch (_) {}
    return map;
  })().catch(() => null).finally(() => { _loginsEnVol = null; });
  return _loginsEnVol;
}
async function loginDe(uid, opts) {
  if (!uid) return '';
  const attendreMs = opts && typeof opts.attendreMs === 'number' ? opts.attendreMs : 1500;
  try {
    const owner=(await loadSession())?.user_id;
    const brut = (await chrome.storage.local.get('vrmLogins')).vrmLogins || {};
    const memo=owner && brut.owner===owner?brut:{};
    const connu = !!(memo.map && Object.prototype.hasOwnProperty.call(memo.map, uid));
    const frais = !!(memo.at && Date.now() - memo.at < 300000 && memo.map);
    if (frais) return (memo.map && memo.map[uid]) || '';
    const enVol = rafraichirLogins();
    if (connu) return memo.map[uid] || '';
    if (!attendreMs) return '';
    const map = await avecDelai(enVol, attendreMs, null);
    if((await loadSession())?.user_id!==owner)return '';
    return (map && map[uid]) || '';
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
async function etatSite(url,tabId) {
  const plateforme = plateformeDe(url);
  let version = ''; try { version = chrome.runtime.getManifest().version; } catch (_) {}
  // La carte sait dire « pas su pour l'instant » (`vrm: null`) : elle lit l'état
  // SANS RÉSEAU, et un renouvellement en cours n'y devient pas « pas connecté ».
  const brut = await authEtatRapide(1500).catch(() => null);
  const vrm = brut && brut.connecte !== null ? brut : null;
  let local = {};
  try { local = await chrome.storage.local.get(['vrmFlux', 'vrmBascule', 'vrmLbcCompte','vrmLbcTransport']); } catch (_) {}
  // Le compte du SITE : sur Vinted le cookie le dit (une identité) ; sur
  // Leboncoin le dernier compte « moi » vu ; eBay et Vestiaire ne sont pas
  // encore captés par VRM — on le dit plutôt que de laisser croire.
  let site = null;
  if (plateforme === 'vinted') {
    let dom = 'www.vinted.fr'; try { dom = new URL(url).hostname || dom; } catch (_) {}
    const uid = await compteConnecte(dom);
    // 5.191 : le login de la base, sinon celui lu dans `users/current` ; et le
    // choix fait dans CE Chrome (`oui` · `non` · `null` = jamais répondu).
    site = uid ? { id: String(uid), nom: (await loginDe(String(uid))) || (await loginVu(String(uid))), choix: await choixCompte(String(uid)) } : { id: null, nom: '' };
  } else if (plateforme === 'leboncoin') {
    const vu=local.vrmLbcTransport?.[tabId];
    const connu=local.vrmLbcCompte;
    const c=vu?.compte&&!vu.ambigue?(connu?.id===vu.compte?connu:{v:2,id:vu.compte}):null;
    // 5.186 : seul un compte vu sur l'endpoint de la SESSION (`courant`, v:2)
    // nomme le compte connecté — une ancienne valeur (le dernier « moi » vu,
    // parfois un autre compte lié ou un vendeur) n'est plus montrée.
    site = c && c.v === 2 && c.id ? { id: c.id, nom: c.name || '', type: c.type || '' } : { id: null, nom: '' };
  }
  const capte = plateforme === 'vinted' || plateforme === 'leboncoin';
  // Vestiaire : rien n'est capté, mais le site est MESURÉ (5.154) — la carte le
  // dit, avec le dernier envoi de la mesure. Jamais « Tes données » ni
  // « Envoyées » : ce serait un faux vert sur des données qui ne sont pas lues.
  const mesure = plateforme === 'vestiaire';
  const flux = (capte || mesure) ? ((local.vrmFlux || {})[plateforme] || {}) : null;
  const b = local.vrmBascule;
  const bascule = b && Date.now() - Number(b.at || 0) < BASCULE_VISIBLE_MS ? b : null;
  const transport=plateforme==='leboncoin'?(local.vrmLbcTransport?.[tabId]||null):null;
  return { ok: true, plateforme, capte, mesure, version, code: CODE_VERSION, vrm, site, flux, bascule,transport };
}

// L'état que l'app interroge toutes les 20 s : ZÉRO requête Vinted (cookie,
// stockage local, session VRM).
// ⚠️⚠️ 5.160 : ET ZÉRO ATTENTE RÉSEAU. Il passait par `authEtat()` (sonde de
//    cloisonnement + renouvellement de session) et `loginDe()` (liste des
//    comptes en base toutes les 5 min) : au réveil à froid du service worker,
//    ou base lente, la réponse dépassait les 2,5 s de l'app — qui affichait
//    « L'extension ne répond pas » sur le bouton « Générer le bordereau ».
//    Tout se lit maintenant dans le stockage local ; seul un jeton à renouveler
//    fait attendre, au plus 1,5 s, et au-delà l'état dit `connecte: null`.
//    `user_id` voyage avec : l'app compare des IDENTITÉS, pas des adresses.
async function etatPourApp() {
  let version = ''; try { version = chrome.runtime.getManifest().version; } catch (_) {}
  // ⚠️ « Pas su » n'est pas « aucun compte » (revue du 5 octobre) : un cookie
  //    pas lu à temps se dit `vintedPasSu`, jamais `vinted: null` — l'app
  //    affichait « aucun compte Vinted ouvert » sur une simple lenteur.
  const PAS_SU = {};
  const uid = await avecDelai(compteConnecte('www.vinted.fr'), 1000, PAS_SU).catch(() => PAS_SU);
  const vintedPasSu = uid === PAS_SU;
  const PAUSE_PAS_SUE = {};
  const [e, cmds, login, pause] = await Promise.all([
    authEtatRapide(1500).catch(() => null),
    avecDelai(lireCmds(), 300, {}).catch(() => ({})),
    uid && !vintedPasSu ? avecDelai(loginDe(String(uid), { attendreMs: 250 }), 300, '').catch(() => '') : Promise.resolve(''),
    avecDelai(pauseVinted(), 300, PAUSE_PAS_SUE).catch(() => PAUSE_PAS_SUE),
  ]);
  const vrm = e ? Object.assign({ ok: true, connecte: e.connecte, expiree: e.expiree, email: e.email || '', user_id: e.user_id || null, cloisonne: e.cloisonne === undefined ? null : e.cloisonne },
    e.mort ? { mort: true } : {}, e.renouvellement ? { renouvellement: e.renouvellement } : {}) : null;
  // Les demandes réellement dans la file portent `vivant` (voir `avecVivant`).
  const cmdsVus = {};
  for (const k of Object.keys(cmds || {})) cmdsVus[k] = Object.assign({}, cmds[k], avecVivant(k));
  // ⚠️⚠️ LA PAUSE DEMANDÉE PAR VINTED SE DIT AVANT LE CLIC (revue du 9 octobre).
  //    Pendant les 15 min de pause, l'en-tête disait « Actions possibles » et
  //    « Tout générer (3) » était actif : le clic seul révélait le refus —
  //    et le bouton d'ensemble le jetait. `pause.jusqua` laisse l'app griser
  //    et DIRE « Vinted demande de ralentir — X min ». « Pas su » (stockage
  //    lent) ⇒ rien n'est affirmé, ni pause ni absence de pause.
  // 5.171 : `code` = la version du CODE qui répond (le manifeste peut être plus
  //    récent que lui, voir `rechargerSiCodePerime`) ; `ext` = l'identifiant de
  //    CETTE extension, à qui l'app adresse sa session (jamais à toutes).
  let ext = ''; try { ext = String(chrome.runtime.id || ''); } catch (_) {}
  // 20 octobre : ce que CE navigateur n'a pas (Orion iPhone…), mesuré par
  // l'extension elle-même. Absent sur Chrome (tout est là) : l'état est inchangé.
  const nav = await avecDelai(etatNavigateur(), 300, null).catch(() => null);
  // 22 oct. : `lbcPause` — cette extension sait mettre une annonce Leboncoin en
  //    pause sur commande (l'app ne montre le bouton qu'à elle, capacité par
  //    présence comme `pause` et `vivant`).
  return Object.assign({ ok: true, version, code: CODE_VERSION, ext, vrm, vinted: uid && !vintedPasSu ? { uid: String(uid), login: login || '' } : null, cmds: cmdsVus, lbcPause: true },
    vintedPasSu ? { vintedPasSu: true } : {},
    pause && pause !== PAUSE_PAS_SUE ? { pause: { jusqua: Number(pause.jusqua) || 0 } } : {},
    nav ? { nav } : {});
}
// `remplace` : l'API manque, un autre chemin garde la fonction (rien à faire).
// `indispo` : rien ne la remplace ICI, aujourd'hui — l'app le dit, une fois.
//   · `cookies` : la page Vinted n'a montré aucune session (déconnecté, ou
//     cookies invisibles aux scripts) — sans elle, rien ne se capte.
//   · `cookies-passu` : le stockage n'a pas répondu (« pas su », pas « non »).
async function etatNavigateur() {
  const remplace = [], indispo = [];
  if (!CAP.cookies) {
    let vu = null;
    try { const o = (await chrome.storage.local.get(COOKIES_PAGE_STORE))[COOKIES_PAGE_STORE] || {}; vu = Object.keys(o).some((k) => o[k] && o[k].vu); } catch (_) { vu = null; }
    if (vu === true) remplace.push('cookies'); else indispo.push(vu === null ? 'cookies-passu' : 'cookies');
  }
  if (!CAP.alarms) remplace.push('alarms');
  if (!CAP.scripting || CAP_MAIN_REFUSE) remplace.push('scripting');
  if (!CAP.downloads) remplace.push('downloads');
  if (!CAP.externe) remplace.push('externe');
  return (remplace.length || indispo.length) ? { remplace, indispo } : null;
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
    // ⚠️ Revue du 17 octobre : le résultat de l'écriture était JETÉ — base qui
    //    hoquette, et l'app lisait « fait » pour une marque jamais posée (la
    //    paire restait dans la file, « Publier » repartait). On dit ce qui est.
    let note;
    if (cmd === 'lbcMarque') note = pose ? await markLbcPosted(id) : await unmarkLbcPosted(id);
    else note = (await markEbayPosted(id, pose)) === true;
    if (note !== true) return { accepte: false, code: 'lecture', raison: "la base VRM n'a pas répondu — rien n'est noté, réessaie dans un moment" };
    if (cmd === 'lbcMarque') { const jid = 'lbc:' + id; const j = (await lireCmds())[jid]; if (j && j.nonMarquee) await majCmd(jid, { nonMarquee: null }); }
    notifierApp({ type: 'maj', quoi: cmd === 'lbcMarque' ? 'lbc' : 'ebay' });
    return { accepte: true, etape: 'fait' };
  }
  const lbc = cmd === 'lbcPublier';
  // ⚠️⚠️ UNE PUBLICATION À LA FOIS PAR PAIRE (revue du 5 octobre). Avec le pont
  //    qui relaie enfin la commande entière (5.160), un double clic — ou deux
  //    onglets VRM — ouvrait DEUX dépôts, et Leboncoin publie sans booster tout
  //    seul : deux annonces pour la même paire. Un dépôt de moins de 15 min pour
  //    CETTE paire ⇒ refusé, avec la raison. L'état vit dans `chrome.storage`
  //    (§4.9), pas dans une variable du service worker.
  const cleJob = (lbc ? 'lbc:' : 'ebay:') + id;
  // Le verrou est posé AVANT toute attente : deux clics simultanés passeraient
  // sinon tous les deux la lecture de l'état (prouvé par l'audit).
  if (PUBLICATIONS_EN_VOL.has(cleJob)) return { accepte: false, code: 'en-cours', raison: 'elle est déjà en train de partir' };
  PUBLICATIONS_EN_VOL.add(cleJob);
  try {
    const jobDeja = (await lireCmds())[cleJob];
    // ⚠️⚠️ 11 octobre : « JE NE PEUX PAS POSTER SUR LEBONCOIN ». Un dépôt qui
    //    n'aboutissait pas (onglet fermé, connexion demandée par Leboncoin)
    //    bloquait la paire 15 minutes, et le clic suivant était refusé sans
    //    rien montrer. On regarde maintenant l'ONGLET du dépôt :
    //      · encore ouvert ⇒ on le remet devant (un dépôt en cours n'est pas
    //        relancé : Leboncoin publierait deux fois), et on DIT pourquoi ;
    //        arrêté ⇒ on lui demande de reprendre, dans CET onglet ;
    //      · fermé ⇒ le dépôt est abandonné : on relance.
    //    Sans onglet connu (dépôt d'avant la 5.171), l'ancienne règle des 15 min.
    // ⚠️⚠️ Revue du 17 octobre : PUBLIÉE PAR VRM, MAIS PAS NOTÉE (la base n'a
    //    pas pris la marque) ⇒ elle est encore dans la file. On retente la
    //    marque ; tant qu'elle ne passe pas, AUCUN nouveau dépôt (il publierait
    //    la paire une seconde fois) — elle EST publiée, seule la note manque.
    if (lbc && jobDeja && jobDeja.etape === 'fait' && jobDeja.nonMarquee) {
      if (await markLbcPosted(id)) {
        await majCmd(cleJob, { nonMarquee: null });
        notifierApp({ type: 'maj', quoi: 'lbc' });
        return { accepte: false, code: 'deja-publiee', jobId: cleJob, etape: 'fait', raison: 'VRM l\'a déjà publiée sur Leboncoin — elle est maintenant notée' };
      }
      return { accepte: false, code: 'deja-publiee', jobId: cleJob, etape: 'fait', raison: 'VRM l\'a déjà publiée sur Leboncoin, mais la base n\'a pas pu le noter — rien n\'est relancé, réessaie dans un moment' };
    }
    let etapeDeja = jobDeja ? jobDeja.etape : '';
    if (jobDeja && (jobDeja.etape === 'depot' || jobDeja.etape === 'abandonne')) {
      let onglet = jobDeja.tabId != null ? await ongletOuvert(jobDeja.tabId) : undefined;
      // ⚠️⚠️ Revue du 11 octobre : un onglet OUVERT n'est pas un dépôt VIVANT.
      //    Navigué ailleurs (vinted.fr, la liste de Leboncoin…), il restait
      //    ouvert, et « son dépôt est encore ouvert — je te le remets devant »
      //    revenait à chaque clic, pour toujours (reproduit : un job de 20 h,
      //    l'onglet sur vinted.fr, trois clics, trois refus). Vivant = l'adresse
      //    est encore une page de dépôt ET le script de la page RÉPOND pour CETTE
      //    paire. Sinon, le dépôt est abandonné — on ne sait pas comment il a
      //    fini (voir plus bas).
      if (onglet) {
        // Un dépôt ouvert il y a moins de 30 s : sa page charge encore, lbc.js
        // ne peut pas encore répondre — un double clic ne doit pas le déclarer
        // abandonné (ni en ouvrir un second).
        const recent = jobDeja.etape === 'depot' && Date.now() - Number(jobDeja.at || 0) < 30000;
        const vivant = await ongletDepotVivant(onglet, id, lbc, jobDeja.etape === 'abandonne', recent);
        if (vivant) {
          try { await chrome.tabs.update(onglet.id, { active: true }); if (onglet.windowId != null) chrome.windows.update(onglet.windowId, { focused: true }); } catch (_) {}
          if (jobDeja.etape === 'abandonne') {
            await majCmd(cleJob, { etape: 'depot', raison: null });
            return { accepte: true, jobId: cleJob, etape: 'depot', repris: true };
          }
          return { accepte: false, code: 'en-cours', ouvert: true, raison: lbc ? 'son dépôt est encore ouvert dans un onglet Leboncoin — je te le remets devant' : 'sa préparation eBay est encore ouverte — je te la remets devant' };
        }
        await majCmd(cleJob, { etape: 'abandonne', raison: 'onglet-quitte', tabId: null });
        // Comme un onglet fermé : la paire n'attend plus dans une page de dépôt
        // (une page restée sur le dépôt la reprendrait toute seule).
        try {
          const cle = lbc ? 'vrmPendingAd' : 'vrmPendingEbay';
          const pend = (await chrome.storage.local.get(cle))[cle];
          if (pend && pend.ad && String(pend.ad.id) === String(id)) await chrome.storage.local.set({ [cle]: null });
        } catch (_) {}
        etapeDeja = 'abandonne';
        onglet = null;
      }
      if (onglet === undefined && jobDeja.etape === 'depot' && Date.now() - Number(jobDeja.at || 0) < 15 * 60000) {
        return { accepte: false, code: 'en-cours', raison: lbc ? 'sa publication est déjà en cours dans un autre onglet' : 'sa préparation eBay est déjà ouverte dans un autre onglet' };
      }
    }
    // ⚠️⚠️ Revue du 11 octobre : UN DÉPÔT ABANDONNÉ A PU ÊTRE FINI À LA MAIN.
    //    L'arrêt à 90 s arrive justement quand un champ obligatoire ne se devine
    //    pas — il le termine lui-même, VRM ne voit pas la page de fin, puis il
    //    ferme l'onglet. « Réessayer » ouvrait alors un SECOND dépôt qui publie
    //    tout seul : la paire deux fois sur Leboncoin. On ne relance une
    //    publication automatique qu'avec sa confirmation (l'app la demande, avec
    //    « Déjà publiée » en face). eBay ne publie rien tout seul : pas besoin.
    if (lbc && etapeDeja === 'abandonne' && msg.confirme !== true) {
      return { accepte: false, code: 'confirmer', jobId: cleJob, etape: 'abandonne', raison: "VRM n'a pas vu la fin du dépôt précédent — si tu l'as publiée toi-même, clique « Déjà publiée » ; sinon confirme pour relancer" };
    }
    return await publierDepuisAppSuite(msg, cmd, id, lbc);
  } finally { PUBLICATIONS_EN_VOL.delete(cleJob); }
}
// Le dépôt de CETTE paire vit-il encore dans cet onglet ? (revue du 11 octobre)
//    Leboncoin : l'adresse est une page de dépôt (pas la page de fin) ET lbc.js
//    y répond pour cette paire — un acquittement, pas seulement l'existence de
//    l'onglet. `reprendre` : on lui demande en même temps de reprendre le
//    remplissage (dépôt arrêté) ; vivant = il a repris. Pas de réponse (lbc.js
//    absent, page partie ailleurs, ancienne version) ⇒ pas vivant.
//    eBay : ebay.js ne répond pas à ce message — l'adresse seule juge.
async function ongletDepotVivant(onglet, id, lbc, reprendre, recent) {
  const url = String((onglet && (onglet.url || onglet.pendingUrl)) || '');
  if (!lbc) return !url || /^https:\/\/([a-z0-9-]+\.)*ebay\.(fr|com)\//i.test(url);
  if (url && (!/^https:\/\/([a-z0-9-]+\.)*leboncoin\.fr\/deposer-une-annonce/i.test(url) || /\/confirmation/i.test(url))) return false;
  // Page qui charge (ou dépôt ouvert à l'instant) : lbc.js ne répond pas
  // ENCORE — elle reprendra d'elle-même la paire en chargeant (`getPending`).
  if ((onglet && onglet.status === 'loading') || recent) return true;
  const rep = await new Promise((res) => {
    let fini = false;
    const t = setTimeout(() => { if (!fini) { fini = true; res(null); } }, 2500);
    try {
      chrome.tabs.sendMessage(onglet.id, { __vrmLbc: reprendre ? 'reprendre' : 'vivant', id: String(id) }, { frameId: 0 }, (r) => {
        if (fini) return; fini = true; clearTimeout(t);
        let e = null; try { e = chrome.runtime.lastError; } catch (_) { e = null; }
        res(e ? null : (r || null));
      });
    } catch (_) { if (!fini) { fini = true; clearTimeout(t); res(null); } }
  });
  if (!rep || !rep.ok) return false;
  return reprendre ? rep.repris === true : (rep.depot === true && rep.sienne === true);
}
// L'onglet d'un dépôt : l'objet s'il est encore ouvert, `null` s'il est fermé,
// `undefined` si on ne sait pas (pas d'identifiant, API absente).
async function ongletOuvert(tabId) {
  if (tabId == null || !chrome.tabs || typeof chrome.tabs.get !== 'function') return undefined;
  try { const t = await chrome.tabs.get(Number(tabId)); return t && t.id != null ? t : null; } catch (_) { return null; }
}
// Un onglet de dépôt fermé ⇒ le dépôt est abandonné, l'app le sait aussitôt.
async function depotOngletFerme(tabId) {
  const cmds = await lireCmds();
  for (const jid of Object.keys(cmds)) {
    const c = cmds[jid];
    if (!/^(lbc|ebay):/.test(jid) || !c || c.tabId !== tabId) continue;
    if (c.etape === 'depot') await majCmd(jid, { etape: 'abandonne', raison: 'onglet-ferme', tabId: null });
    else if (c.etape === 'abandonne') await majCmd(jid, { tabId: null });
    else continue;
    // La paire n'est plus « en dépôt » : une page de dépôt ouverte plus tard ne
    // doit pas se remplir toute seule avec elle.
    try {
      const cle = /^lbc:/.test(jid) ? 'vrmPendingAd' : 'vrmPendingEbay';
      const p = (await chrome.storage.local.get(cle))[cle];
      if (p && p.ad && String(p.ad.id) === String(c.id)) await chrome.storage.local.set({ [cle]: null });
    } catch (_) {}
  }
}
try { chrome.tabs.onRemoved.addListener((tabId) => { depotOngletFerme(tabId).catch(() => {}); }); } catch (_) {}
const PUBLICATIONS_EN_VOL = new Set();
// La fiche envoyée par l'app pour CETTE paire (5.182). On ne prend que les champs
// qu'on sait vérifier (`valideAnnonceLbc`, la règle partagée avec l'app, §11) ;
// l'identifiant, le N°, la référence et la catégorie restent ceux de la file.
// Une fiche invalide est REFUSÉE en entier (jamais une annonce à moitié
// corrigée), avec la raison du premier champ fautif.
function appliquerAnnonceLbc(ad, saisie) {
  const v = valideAnnonceLbc(saisie, { ref: ad.ref || ('VRM-' + ad.numero), photos: ad.photos, etat: ad.etat });
  if (!v.ok) return { ok: false, erreurs: v.erreurs, raison: (v.erreurs[0] && v.erreurs[0].raison) || 'fiche invalide' };
  // Les drapeaux disent à lbc.js quels champs POSER par-dessus ce que Leboncoin
  // aurait écrit : seulement ceux qu'il a vraiment changés dans la fiche.
  return { ok: true, ad: Object.assign({}, ad, v.annonce, {
    edite: true,
    titreEdite: v.annonce.title !== String(ad.title || ''),
    descriptionEditee: v.annonce.description !== String(ad.description || ''),
    prixEdite: Number(v.annonce.price) !== Number(String(ad.price).replace(',', '.')),
  }) };
}
// Ce que lbc.js dit de l'avancement d'un dépôt lancé depuis l'app : une étape
// connue, des NOMBRES, et le libellé des champs obligatoires que VRM n'a pas pu
// remplir (des libellés de Leboncoin, jamais un contenu saisi).
const ETAPES_PROGRES_LBC = ['ouverture', 'remplissage', 'photos', 'etapes', 'publication', 'champ-manquant', 'publication-refusee'];
function progresLbcSur(p) {
  const x = p && typeof p === 'object' ? p : {};
  const nb = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 99) : null; };
  const out = { etape: ETAPES_PROGRES_LBC.indexOf(String(x.etape)) >= 0 ? String(x.etape) : 'remplissage', at: Date.now() };
  if (x.photos && typeof x.photos === 'object') out.photos = { posees: nb(x.photos.posees), total: nb(x.photos.total), confirmees: nb(x.photos.confirmees), rates: nb(x.photos.rates) };
  if (x.champs != null) out.champs = nb(x.champs);
  if (Array.isArray(x.manque)) out.manque = x.manque.slice(0, 5).map((t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean);
  if (x.raison) out.raison = String(x.raison).slice(0, 140);
  return out;
}
async function publierDepuisAppSuite(msg, cmd, id, lbc) {
  // Capture au clic : si les photos de CETTE paire manquent, on les cherche
  // MAINTENANT (1 lecture, sur son clic) avant de construire l'ad — ainsi
  // l'annonce part avec ses photos, sans attendre le fond.
  try { const cu = await compteConnecte('www.vinted.fr'); if (cu) await avecVinted(() => completerPhotosSiManque(cu, id)).catch(() => {}); } catch (_) {}
  await viderFiches({ force: true }).catch(() => {});   // 22 oct. : sa description enregistrée sur Vinted part avec l'annonce
  const r = lbc ? await buildLbcData() : await buildEbayData();
  const preuveKO = lbc ? !!(r && r.stats && r.stats.preuveKO) : !!(r && r.preuveKO);
  if (preuveKO) return { accepte: false, code: 'preuve', raison: "je n'ai pas pu vérifier qu'elle n'est pas déjà vendue — réessaie dans un moment" };
  const lecturesKO = lbc ? !!(r && r.stats && r.stats.lecturesKO) : !!(r && r.lecturesKO);
  if (lecturesKO) return { accepte: false, code: 'lecture', raison: "je n'ai pas pu relire tes annonces Vinted — réessaie dans un moment" };
  let ad = ((r && r.queue) || []).find((a) => String(a.id) === id);
  if (!ad) return { accepte: false, code: 'absente', raison: "elle n'est plus dans la file (vendue, déjà publiée, ou décochée)" };
  // 5.182 : la FICHE de l'app (titre, description, prix, état, photos choisies et
  // ordonnées). L'identité et toutes les gardes viennent d'ABORD de la file
  // ci-dessus ; la fiche ne fait que remplacer des champs, revérifiés ici.
  if (lbc && msg.annonce !== undefined) {
    const a = appliquerAnnonceLbc(ad, msg.annonce);
    if (!a.ok) return { accepte: false, code: 'invalide', raison: a.raison, erreurs: a.erreurs };
    ad = a.ad;
  }
  const jobId = (lbc ? 'lbc:' : 'ebay:') + id;
  if (lbc) await chrome.storage.local.set({ vrmPendingAd: { ad: Object.assign({}, ad, { publier: true }), at: Date.now() } });
  else await chrome.storage.local.set({ vrmPendingEbay: { ad, at: Date.now() } });
  // L'onglet du dépôt est RETENU (11 octobre) : fermé, le dépôt passe à
  // « abandonné » et l'app propose de réessayer ; encore ouvert, un second clic
  // le remet devant au lieu d'en ouvrir un autre.
  let tab = null;
  try { tab = await chrome.tabs.create({ url: lbc ? 'https://www.leboncoin.fr/deposer-une-annonce' : 'https://www.ebay.fr/sl/sell', active: true }); } catch (_) { tab = null; }
  await majCmd(jobId, { etape: 'depot', id, numero: ad.numero || '', tabId: tab && tab.id != null ? tab.id : null, raison: null });
  return { accepte: true, jobId, etape: 'depot' };
}
async function executerCommande(msg) {
  // « Relis mes ventes » : l'app vient d'ouvrir Ventes / Colis / Ma journée.
  // UNE lecture (my_orders) du compte connecté dans Chrome — jamais d'un autre —
  // bornée par le même délai que la visite (90 s) : ouvrir l'app dix fois ne
  // fait pas dix requêtes. C'est une LECTURE de ses propres ventes (§3).
  // ⚠️ ELLE RÉPONDAIT « ventes » TOUT DE SUITE, AVANT D'AVOIR LU QUOI QUE CE SOIT,
  //    et rien ne disait ensuite si des ventes étaient vraiment arrivées. Elle
  //    suit maintenant la forme de la commande « bordereau » : accusé immédiat
  //    (`file`), puis l'étape VRAIE dans `vrmCmds` sous `ventes:{uid}` —
  //    `fait` (des ventes sont arrivées) · `rien` (lu, rien de neuf à écrire,
  //    avec la raison) · `echec` (lecture ou écriture ratée — la garde est
  //    ramenée à 20 s, la prochaine demande réessaie ; Vinted qui freine en
  //    429/403 : garde entière).
  if (msg && msg.cmd === 'ventes') {
    const uid = await compteConnecte('www.vinted.fr');
    if (!uid) return { accepte: false, code: 'vinted-absent', raison: "aucun compte Vinted connecté dans ce Chrome" };
    // 5.162 : Vinted a demandé de ralentir — on ne relit rien, et on le dit.
    const pause = await pauseVinted();
    if (pause) return { accepte: false, code: 'vinted-pause', raison: raisonPauseVinted(pause) };
    const jobId = `ventes:${uid}`;
    const marque = await prendreGardeVentes(uid);
    if (marque === null) return { accepte: true, jobId, etape: 'recent' };
    await majCmd(jobId, { etape: 'file', uid: String(uid), raison: null });
    avecVinted(async () => {
      const r = await rafraichirVentesGarde(uid, marque);
      const etape = r && r.ecrit ? 'fait' : (r && r.ok ? 'rien' : 'echec');
      await majCmd(jobId, { etape, raison: (r && r.raison) || null });
    }).catch(() => {});
    return { accepte: true, jobId, etape: 'file' };
  }
  // (16 oct., Julien : « j'ai publié une paire sur Vinted et 2 min après je
  // voulais la mettre sur eBay, mais VRM n'avait pas capté les photos »). Sur
  // SON clic (choisir la paire dans « Vendre sur eBay »), on lit TOUT DE SUITE
  // la page de cette annonce : 1 lecture, sous garde de LECTURE, dans la file
  // Vinted — la forme de `completerPhotos` au clic « Publier » (3 octobre).
  // Uniquement pour le compte connecté dans ce Chrome (la session qui lit).
  if (msg && msg.cmd === 'photos') {
    const uid = String(msg.uid || ''), id = String(msg.id || '');
    if (!/^\d+$/.test(uid) || !/^\d+$/.test(id)) return { accepte: false, code: 'invalide', raison: 'annonce incomplète' };
    const connecte = await compteConnecte('www.vinted.fr');
    if (!connecte) return { accepte: false, code: 'vinted-absent', raison: 'aucun compte Vinted connecté dans ce Chrome' };
    if (String(connecte) !== uid) return { accepte: false, code: 'autre-compte', raison: 'cette annonce est sur un autre compte Vinted que celui ouvert dans Chrome' };
    const pause = await pauseVinted();
    if (pause) return { accepte: false, code: 'vinted-pause', raison: raisonPauseVinted(pause) };
    let ok = false;
    try { await viderFiches({ force: true }); } catch (_) {}   // 22 oct. : une fiche en attente est rangée avant la relecture de l'app
    try { ok = await avecVinted(() => completerPhotos(uid, id)); } catch (_) { ok = false; }
    return ok ? { accepte: true, etape: 'fait' } : { accepte: true, etape: 'echec', raison: "Vinted n'a pas rendu ses photos pour l'instant" };
  }
  // 22 oct. : mettre UNE annonce Leboncoin en pause, sur son clic (voir `pauseLbcDepuisApp`).
  if (msg && msg.cmd === 'lbcPause') return await pauseLbcDepuisApp(msg);
  if (msg && /^(lbcPublier|lbcMarque|lbcQuota|ebayPreparer|ebayMarque)$/.test(String(msg.cmd || ''))) return await publierDepuisApp(msg);
  if (!msg || msg.cmd !== 'bordereau') return { accepte: false, code: 'inconnue', raison: 'commande inconnue' };
  const uid = String(msg.uid || ''), tx = String(msg.tx || '');
  if (!/^\d+$/.test(uid) || !/^\d+$/.test(tx)) return { accepte: false, code: 'invalide', raison: 'vente incomplète' };
  const jobId = `bord:${uid}:${tx}`;
  // ⚠️⚠️ DÉJÀ EN FILE OU EN COURS : LA MÉMOIRE DE LA FILE FAIT FOI, PAS L'ÂGE
  //    DE L'ACCUSÉ (revue du 9 octobre). Avant, une demande « en file » depuis
  //    plus de 120 s était réacceptée : un colis qui attendait son tour derrière
  //    d'autres (16,5 s chacun quand le PDF tarde) repartait en second job et
  //    brûlait une action de plus (mesuré : 7 actions pour 4 colis). La file
  //    vit en mémoire (une chaîne de promesses) : si le service worker meurt,
  //    elle meurt avec lui — et ce Set aussi, donc une demande orpheline est
  //    bien réacceptée. Vérifié AVANT toute attente : deux clics simultanés ne
  //    passent pas tous les deux.
  if (BORD_EN_COURS.has(jobId)) {
    const cur = (await lireCmds())[jobId];
    return { accepte: true, jobId, etape: (cur && CMD_EN_COURS.includes(cur.etape)) ? cur.etape : 'file', deja: true, vivant: true };
  }
  BORD_EN_COURS.add(jobId);
  let parti = false;                              // vrai dès que la file a pris le relais
  let acc = null;
  try {
    // ⚠️⚠️ L'ACCUSÉ NE DÉPEND PLUS D'UNE BASE LENTE (revue du 9 octobre). La liste
    //    des comptes et « ce PDF est-il déjà rangé ? » se lisaient SANS délai
    //    maximum, AVANT l'accusé : base qui traîne (522 au bout de 20 s, mesuré
    //    en septembre) ⇒ l'app abandonnait à 9 s et comptait le colis « refusé »
    //    pendant que l'extension, elle, le générait chez Vinted. Les deux
    //    lectures sont bornées ; « pas su » pour le PDF ⇒ on continue
    //    (`recupererLabel` regarde chez Vinted d'abord, aucun PUT en double).
    const accts = await avecDelai(getStoredAccounts({ ouNull: true }), 4000, null);
    if (!Array.isArray(accts)) return { accepte: false, code: 'lecture', raison: "la base VRM n'a pas répondu — rien n'est parti chez Vinted, réessaie dans un moment" };
    acc = accts.find((a) => String(a.vinted_user_id) === uid) || null;
    if (!acc) return { accepte: false, code: 'compte', raison: 'compte introuvable dans VRM' };
    // Idempotence : le PDF est déjà rangé → rien à demander à Vinted.
    if (await avecDelai(labelDejaRange(uid, tx), 1500, null)) { await majCmd(jobId, { etape: 'fait', uid, tx, deja: true }); return { accepte: true, jobId, etape: 'fait', deja: true }; }
    // L'admission (fenêtre du lot + plafond horaire) est SÉRIALISÉE : deux
    // commandes simultanées (deux onglets) ne lisent pas toutes les deux une
    // fenêtre à 5 et ne passent pas toutes les deux.
    const refusDe = async (stop) => ({ accepte: false, code: stop.code, raison: stop.error, actif: stop.actif || null, actifLogin: stop.actif ? await loginDe(stop.actif) : '' });
    const refus = await sousAdmission(async () => {
      // La pause demandée par Vinted et le compte du cookie passent AVANT la
      // fenêtre : sur un autre compte, « 6 bordereaux ces 5 min » serait la
      // mauvaise raison (et le mauvais geste).
      const pre = await gardeStricte(uid, acc, { lecture: true });
      if (pre) return await refusDe(pre);
      // ⚠️⚠️ « TOUT GÉNÉRER » NE CONTOURNE PLUS LE PLAFOND PAR VISITE (§3, revue
      //    du 9 octobre). Un clic envoyait autant de commandes que de colis :
      //    20 colis ⇒ 20 PUT chez Vinted d'affilée (jusqu'à 300 requêtes quand
      //    les PDF tardent), là où une visite s'arrête à BORD_MAX_PAR_VISITE.
      //    Les commandes de l'app suivent la même borne, sur une fenêtre de
      //    5 minutes par compte — quelle que soit leur origine (un clic par
      //    colis ou « Tout générer ») : c'est l'extension qui juge, pas l'app.
      const lot = await fenetreBordereaux(uid);
      if (lot.n >= BORD_MAX_PAR_VISITE) {
        const min = Math.max(1, Math.ceil(lot.resteMs / 60000));
        return { accepte: false, code: 'lot',
                 raison: `${BORD_MAX_PAR_VISITE} bordereaux demandés ces ${Math.round(BORD_CMD_FENETRE_MS / 60000)} dernières minutes sur ce compte — jamais plus d'affilée chez Vinted. La suite dans ${min} min.` };
      }
      const stop = await gardeStricte(uid, acc, { reserve: RESERVE_GESTES });
      if (stop) return await refusDe(stop);
      await noterBordereauCommande(uid);
      return null;
    });
    if (refus) return refus;
    await majCmd(jobId, { etape: 'file', uid, tx, code: null, raison: null });
    parti = true;
  } finally { if (!parti) BORD_EN_COURS.delete(jobId); }
  // L'exécution part dans la file ; l'app reçoit l'accusé TOUT DE SUITE.
  avecVinted(async () => {
    // 5.162 : un 429/403 reçu EN ROUTE arrête la commande sur place, avec la
    // raison — pas une génération ni une insistance de plus.
    const arretSiPause = async () => {
      const p = await pauseVinted();
      if (!p) return false;
      await majCmd(jobId, { etape: 'echec', code: 'vinted-pause', raison: raisonPauseVinted(p) });
      return true;
    };
    try {
      // ⚠️ 19 oct. : à SON tour dans la file (derrière d'autres bordereaux, ~16 s
      //   chacun quand le PDF tarde), le compte du cookie est revérifié : basculé
      //   sur un autre compte entre-temps ⇒ rien ne part chez Vinted (rouge sur
      //   l'avant, `audit-argent-vinted.cjs`).
      const aSonTour = await gardeStricte(uid, acc, { lecture: true });
      if (aSonTour) { await majCmd(jobId, { etape: 'echec', code: aSonTour.code, raison: aSonTour.error }); return; }
      await noterDiag('commande_bordereau');
      // 1. Le bordereau existe peut-être déjà chez Vinted (commandé à la main,
      //    ou par la visite) : on regarde AVANT de commander — sinon Vinted
      //    répond 400 « impossible de générer » (course mesurée le 28 sept.).
      const connu = { t: null, vus: new Set() };
      let r = await recupererLabel(acc, uid, tx, connu);
      if (!r.ok) {
        if (await arretSiPause()) return;
        if (!connu.t) {
          await majCmd(jobId, { etape: 'generation' });
          const g = await genererBordereau(uid, tx, { gardeFaite: true });
          if (!g.ok && !g.deja) {
            if (await arretSiPause()) return;
            await majCmd(jobId, { etape: 'echec', code: 'vinted-' + (g.status || '?'), raison: g.error || 'Vinted a refusé' }); return;
          }
        }
        await majCmd(jobId, { etape: 'pdf' });
        r = await recupererLabelInsiste(acc, uid, tx);
        if (!r.ok && await arretSiPause()) return;
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
    } finally { BORD_EN_COURS.delete(jobId); }
  });
  return { accepte: true, jobId, etape: 'file', vivant: true };
}
// Les bordereaux de l'app EN FILE ou EN COURS dans CE service worker (voir plus
// haut). En mémoire exprès : c'est l'état de la file, qui vit en mémoire.
const BORD_EN_COURS = new Set();
// La fenêtre des bordereaux commandés par l'app, par compte (§4.9 : dans
// `chrome.storage.local`, elle doit survivre au service worker — 5 min).
const BORD_CMD_FENETRE_MS = 5 * 60 * 1000;
async function fenetreBordereaux(uid) {
  try {
    const cur = (await chrome.storage.local.get('vrmBordCmds')).vrmBordCmds || {};
    const t = Date.now();
    const list = (cur[String(uid)] || []).filter((x) => t - x < BORD_CMD_FENETRE_MS).sort((a, b) => a - b);
    const n = list.length;
    const resteMs = n >= BORD_MAX_PAR_VISITE ? Math.max(0, list[n - BORD_MAX_PAR_VISITE] + BORD_CMD_FENETRE_MS - t) : 0;
    return { n, resteMs };
  } catch (_) { return { n: 0, resteMs: 0 }; }
}
async function noterBordereauCommande(uid) {
  try {
    const cur = (await chrome.storage.local.get('vrmBordCmds')).vrmBordCmds || {};
    const t = Date.now();
    for (const k of Object.keys(cur)) { cur[k] = (cur[k] || []).filter((x) => t - x < BORD_CMD_FENETRE_MS); if (!cur[k].length) delete cur[k]; }
    cur[String(uid)] = (cur[String(uid)] || []).concat(t);
    await chrome.storage.local.set({ vrmBordCmds: cur });
  } catch (_) {}
}
let _admission = Promise.resolve();
function sousAdmission(fn) {
  const suite = _admission.then(() => fn(), () => fn());
  _admission = suite.then(() => {}, () => {});
  return suite;
}


// ══════════════════════════════════════════════════════════════════════════
// LE RELAIS DU TÉLÉPHONE (5.183) — « quand je suis sur mon téléphone et que
// l'extension est allumée sur mon ordinateur, je veux pouvoir faire des
// actions » (Julien, 16 octobre)
// ══════════════════════════════════════════════════════════════════════════
// Le téléphone n'a pas d'extension : il dépose une COMMANDE dans SA base (une
// ligne `cmd_relais_{id}` par commande, au nom du vendeur — RLS la protège ;
// une ligne par commande, donc aucune fusion à rater) ; cette extension, dans
// le Chrome de l'ordinateur, la prend et l'exécute avec EXACTEMENT les gardes
// d'une commande venue de l'app sur l'ordinateur : `executerCommande`
// (bordereau), `executerPourApp` (répondre, trancher ou faire une offre),
// `publierDepuisApp` (Leboncoin) — donc `gardeStricte` (le compte du cookie
// Vinted doit être celui visé), 20 actions/heure, la file `avecVinted` (une
// requête Vinted à la fois), la pause quand Vinted freine.
// L'extension REVÉRIFIE tout ce que le téléphone envoie :
//   · liste blanche (rien d'autre que ces trois commandes ; `exec` passe par
//     EXEC_PERMIS, sans les lectures) — aucun endpoint Vinted nouveau ;
//   · forme des arguments ;
//   · propriétaire de la ligne = propriétaire de SA session VRM ;
//   · échéance (10 min au plus après la demande) : une commande expirée est
//     REFUSÉE, jamais exécutée en retard ; une commande annulée (le téléphone
//     ne l'a pas vue prise en 2 min) n'est jamais relevée ;
//   · une seule fois : la ligne est PRISE par une écriture conditionnelle
//     (`etat=attente` → `pris`), et l'identifiant est noté dans
//     `chrome.storage.local` (§4.9) AVANT d'agir — un service worker qui
//     redémarre ne la rejoue jamais.
// ⚠️ ACCEPTER UNE OFFRE n'est jamais automatique (§3) : le téléphone l'envoie
//    sur SON clic, après confirmation, et la ligne le porte (`confirme`) —
//    sans, refusé.
// La relève lit NOTRE base (pas Vinted) : une requête scalaire bornée, par
// alarme (30 s, le minimum de Chrome) et à chaque visite sur Vinted — et RIEN
// sans session VRM. Le battement (`relais_ext`) dit au téléphone que ce Chrome
// tourne, sa version et le compte Vinted ouvert : au plus une écriture par
// minute.
const RELAIS_EXPIRE_MAX_MS = 10 * 60000;
const RELAIS_BATTEMENT_MS = 60000;
const RELAIS_LOT = 5;
const RE_ID_RELAIS = /^cmd_relais_[a-z0-9]{8,40}$/;
const RELAIS_VUS = 'vrmRelaisVus';            // { [id]: { at, resultat? } }
const RELAIS_JOBS = 'vrmRelaisJobs';          // { [jobId]: { id, at } } — suivre un bordereau
function ownerDeSession(s) { return String((s && (s.user_id || subDuJwt(s.access_token))) || ''); }
// Une commande du téléphone → le message interne qu'exécuterait l'app de
// l'ordinateur. `{ refus }` ⇒ refusée, avec le code.
function relaisCommande(d) {
  const a = (d && d.args && typeof d.args === 'object') ? d.args : {};
  const num = (x) => /^\d{1,20}$/.test(String(x == null ? '' : x));
  if (d.cmd === 'bordereau') {
    if (!num(a.uid) || !num(a.tx)) return { refus: 'arguments' };
    return { type: 'cmd', msg: { cmd: 'bordereau', uid: String(a.uid), tx: String(a.tx) } };
  }
  if (d.cmd === 'lbcPublier') {
    if (!num(a.id)) return { refus: 'arguments' };
    // 5.182 : la fiche de l'app voyage avec (revérifiée par `appliquerAnnonceLbc`) ; bornée.
    let fiche = '';
    try { fiche = a.annonce === undefined ? '' : JSON.stringify(a.annonce); } catch (_) { return { refus: 'arguments' }; }
    if (fiche.length > 20000) return { refus: 'arguments' };
    return { type: 'pub', msg: Object.assign({ cmd: 'lbcPublier', id: String(a.id) }, a.confirme === true ? { confirme: true } : {}, a.annonce !== undefined ? { annonce: a.annonce } : {}) };
  }
  if (d.cmd === 'exec') {
    const methode = String(a.method || '').toUpperCase();
    const permis = execPermis(methode, a.endpoint);
    if (!num(a.uid) || !permis || permis.lecture) return { refus: 'non-autorise' };
    let corps = '';
    try { corps = a.body == null ? '' : JSON.stringify(a.body); } catch (_) { return { refus: 'arguments' }; }
    if (corps.length > 4000) return { refus: 'arguments' };
    if (permis.confirmer && d.confirme !== true) return { refus: 'confirmation' };
    return { type: 'exec', msg: Object.assign({ uid: String(a.uid), method: methode, endpoint: String(a.endpoint), body: a.body == null ? null : a.body }, permis.confirmer ? { confirme: true } : {}) };
  }
  return { refus: 'non-autorise' };
}
const RAISON_REFUS_RELAIS = {
  'arguments': 'commande incomplète — rien n\'est parti',
  'non-autorise': 'action non autorisée depuis le téléphone — rien n\'est parti',
  'confirmation': 'ce geste vend la paire : il demande ta confirmation — rien n\'est parti',
  'expiree': 'commande trop ancienne (plus de 10 min) — rien n\'est parti, relance-la si tu le veux encore',
};
// `null` = le stockage n'a pas répondu (on ne décide rien sur « pas su »).
async function lireRelaisVus() {
  try { return (await chrome.storage.local.get(RELAIS_VUS))[RELAIS_VUS] || {}; } catch (_) { return null; }
}
async function noterRelaisVu(id, patch) {
  const vus = (await lireRelaisVus()) || {};
  const t = Date.now();
  for (const k of Object.keys(vus)) if (t - Number((vus[k] && vus[k].at) || 0) > 86400000) delete vus[k];
  vus[id] = Object.assign({}, vus[id] || {}, patch, { at: (vus[id] && vus[id].at) || t });
  try { await chrome.storage.local.set({ [RELAIS_VUS]: vus }); } catch (_) {}
}
// Écrit la ligne de la commande — sous condition d'état (`cond`) quand on la
// PREND : `true` = écrite · `false` = l'état avait changé (annulée, prise
// ailleurs) · `null` = la base n'a pas répondu (« pas su »).
async function relaisEcrire(id, moi, data, cond) {
  try {
    const q = `app_data?id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(moi)}${cond ? `&meta->>etat=eq.${cond}` : ''}&select=id`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      method: 'PATCH',
      headers: await sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows.length > 0 : null;
  } catch (_) { return null; }
}
async function relaisResultat(id, moi, d, etat, resultat) {
  const data = Object.assign({}, d, { etat, resultat: resultat || null, finiLe: Date.now() });
  await noterRelaisVu(id, { resultat: { etat, resultat: resultat || null } });
  const ok = await relaisEcrire(id, moi, data, null);
  if (!ok) noterDiag('relais_resultat_ecriture_ratee');
  return ok;
}
// Le battement : « ce Chrome tourne, sa version, le compte Vinted ouvert ».
async function battementRelais(moi, force) {
  let bat = {};
  try { bat = (await chrome.storage.local.get('vrmRelaisBat')).vrmRelaisBat || {}; } catch (_) {}
  if (!force && bat.owner === moi && Date.now() - Number(bat.at || 0) < RELAIS_BATTEMENT_MS) return false;
  let version = ''; try { version = chrome.runtime.getManifest().version; } catch (_) {}
  const uid = await avecDelai(compteConnecte('www.vinted.fr'), 1500, null).catch(() => null);
  const login = uid ? await loginDe(String(uid), { attendreMs: 800 }) : '';
  const pause = await pauseVinted().catch(() => null);
  const data = { at: new Date().toISOString(), atMs: Date.now(), ver: version, code: CODE_VERSION,
    vUid: uid ? String(uid) : '', vLogin: login || '', pauseJusqua: pause ? Number(pause.jusqua) || 0 : 0 };
  const ok = await supabaseUpsert('app_data', [{ id: 'relais_ext', data }], 'id');
  if (ok) { try { await chrome.storage.local.set({ vrmRelaisBat: { at: Date.now(), owner: moi } }); } catch (_) {} }
  return ok;
}
async function relaisSessionOwner() {
  // AUCUN réseau sans session : on regarde d'abord le stockage local.
  const s = await loadSession();
  if (!s || s.mort || !(s.access_token || s.refresh_token)) return null;
  const tok = await authToken();
  if (!tok) return null;
  if (!(await isCloisonne())) return null;   // une base non cloisonnée n'a pas de propriétaire à vérifier
  return ownerDeSession(tok) || null;
}
let _relaisEnVol = null;
function relaisTick(source) {
  if (_relaisEnVol) return _relaisEnVol;
  _relaisEnVol = relaisTickUn(source).catch(() => ({ erreur: true })).finally(() => { _relaisEnVol = null; });
  return _relaisEnVol;
}
async function relaisTickUn() {
  const moi = await relaisSessionOwner();
  if (!moi) return { saute: 'session' };
  await battementRelais(moi).catch(() => {});
  const rows = await sbGet(`app_data?id=like.cmd_relais_*&meta->>etat=eq.attente&select=id,owner,data&order=id.asc&limit=${RELAIS_LOT}`);
  if (!Array.isArray(rows)) { noterDiag('relais_lecture_ratee'); return { lu: false }; }
  const issues = [];
  for (const row of rows) issues.push(await traiterRelais(row, moi).catch(() => 'erreur'));
  return { lu: true, n: rows.length, issues };
}
const texteAutreCompte = (login) => `Chrome est connecté sur ${login || 'un autre compte Vinted'} sur ton ordinateur — bascule sur le bon compte sur vinted.fr`;
async function traiterRelais(row, moi) {
  const id = String((row && row.id) || '');
  const d = (row && row.data && typeof row.data === 'object') ? row.data : {};
  if (!RE_ID_RELAIS.test(id)) return 'id';
  // Le propriétaire de la ligne ET celui qu'elle annonce doivent être celui de
  // SA session : une commande d'un autre vendeur n'est jamais exécutée.
  if (String(row.owner || '') !== moi || String(d.pour || '') !== moi) { noterDiag('relais_autre_vendeur'); return 'proprietaire'; }
  const vus = await lireRelaisVus();
  if (vus === null) return 'pas-su';
  if (vus[id]) {
    // Déjà prise par ce Chrome : JAMAIS rejouée. Si son résultat n'avait pas
    // pu être écrit, on le réécrit.
    if (vus[id].resultat) await relaisEcrire(id, moi, Object.assign({}, d, { etat: vus[id].resultat.etat, resultat: vus[id].resultat.resultat, finiLe: Date.now() }), null);
    return 'deja';
  }
  if (d.etat !== 'attente') return 'etat';
  const t = Date.now();
  const dem = Number(d.demandeLe) || 0;
  const fin = Math.min(Number(d.expire) || 0, dem + RELAIS_EXPIRE_MAX_MS);
  if (!dem || !fin || t > fin || dem > t + 120000) {
    const res = { code: 'expiree', raison: RAISON_REFUS_RELAIS.expiree };
    const ok = await relaisEcrire(id, moi, Object.assign({}, d, { etat: 'expiree', resultat: res, finiLe: t }), 'attente');
    if (ok) await noterRelaisVu(id, { resultat: { etat: 'expiree', resultat: res } });
    noterDiag('relais_expiree');
    return 'expiree';
  }
  const c = relaisCommande(d);
  if (c.refus) {
    const res = { code: c.refus, raison: RAISON_REFUS_RELAIS[c.refus] || 'refusé' };
    const ok = await relaisEcrire(id, moi, Object.assign({}, d, { etat: 'refuse', resultat: res, finiLe: t }), 'attente');
    if (ok) await noterRelaisVu(id, { resultat: { etat: 'refuse', resultat: res } });
    noterDiag('relais_refus_' + c.refus);
    return 'refus:' + c.refus;
  }
  // La PRISE : conditionnelle — une commande annulée entre-temps ne part pas.
  const pris = await relaisEcrire(id, moi, Object.assign({}, d, { etat: 'pris', prisLe: t }), 'attente');
  if (pris !== true) return pris === null ? 'pas-su' : 'annulee';
  await noterRelaisVu(id, {});                  // AVANT d'agir : un redémarrage ne la rejoue pas
  const dPris = Object.assign({}, d, { etat: 'pris', prisLe: t });
  noterDiag('relais_' + d.cmd);
  if (c.type === 'exec') {
    const r = await executerPourApp(c.msg, { origin: ORIGINES_APP[0] });
    if (r && r.ok) { await relaisResultat(id, moi, dPris, 'fait', { ok: true, status: r.status || 200 }); return 'fait'; }
    const actifLogin = r && r.actif ? await loginDe(String(r.actif)) : '';
    const raison = r && r.code === 'vinted-autre' ? texteAutreCompte(actifLogin) : ((r && r.error) || 'refusé');
    await relaisResultat(id, moi, dPris, r && r.code ? 'refuse' : 'echec', { ok: false, code: (r && r.code) || '', status: (r && r.status) || 0, raison, actifLogin });
    return r && r.code ? 'refuse:' + r.code : 'echec';
  }
  const r = c.type === 'cmd' ? await executerCommande(c.msg) : await publierDepuisApp(c.msg);
  if (!r || !r.accepte) {
    const raison = r && r.code === 'vinted-autre' ? texteAutreCompte(r.actifLogin) : ((r && r.raison) || 'refusé');
    await relaisResultat(id, moi, dPris, 'refuse', { accepte: false, code: (r && r.code) || '', raison, actifLogin: (r && r.actifLogin) || '' });
    return 'refuse:' + ((r && r.code) || '');
  }
  // Un dépôt Leboncoin ouvert n'est pas fini : sa ligne suit l'avancement (5.182).
  const termine = r.etape === 'fait';
  // ⚠️⚠️ Revue du 17 octobre : « en-cours » s'écrit AVANT d'inscrire le suivi.
  //    Inscrit d'abord, un job rapide (PDF déjà prêt chez Vinted : deux
  //    requêtes) écrivait « fait » pendant que « en-cours » traînait dans une
  //    base lente — qui l'écrasait en arrivant : le téléphone restait « en
  //    cours » pour toujours (prouvé : `audit-relais.cjs` §10). Et un job fini
  //    avant l'inscription n'aurait plus jamais été relayé : on relit son état.
  await relaisResultat(id, moi, dPris, termine ? 'fait' : 'en-cours', { accepte: true, jobId: r.jobId || '', etape: r.etape || '', deja: !!r.deja });
  if (r.jobId && !termine) {
    try {
      const jobs = (await chrome.storage.local.get(RELAIS_JOBS))[RELAIS_JOBS] || {};
      jobs[r.jobId] = { id, at: Date.now() };
      await chrome.storage.local.set({ [RELAIS_JOBS]: jobs });
    } catch (_) {}
    const cur = (await lireCmds())[r.jobId];
    if (cur && JOB_TERMINE.includes(cur.etape)) await relaisSuivreJob(r.jobId, cur).catch(() => {});
  }
  return termine ? 'fait' : 'en-cours';
}
// Un bordereau commandé par le téléphone avance (file → génération → PDF) :
// la ligne de la commande suit, le téléphone la relit.
const JOB_TERMINE = ['fait', 'echec', 'genere_sans_pdf', 'abandonne'];
// Une étape à la fois, dans l'ordre (revue du 17 octobre) : « pdf » puis
// « fait » partaient en parallèle, et une base lente pouvait poser « pdf »
// par-dessus « fait ».
let _chaineSuiviRelais = Promise.resolve();
function relaisSuivreJob(jobId, job) {
  const suite = _chaineSuiviRelais.then(() => relaisSuivreJobUn(jobId, job), () => relaisSuivreJobUn(jobId, job));
  _chaineSuiviRelais = suite.then(() => {}, () => {});
  return suite;
}
async function relaisSuivreJobUn(jobId, job) {
  let jobs = {};
  try { jobs = (await chrome.storage.local.get(RELAIS_JOBS))[RELAIS_JOBS] || {}; } catch (_) { return; }
  const lien = jobs[jobId];
  if (!lien || !lien.id || !job) return;
  const moi = ownerDeSession(await loadSession());
  if (!moi) return;
  const fini = JOB_TERMINE.includes(job.etape);
  const res = Object.assign({ accepte: true, jobId, etape: job.etape || '', raison: job.raison || null, code: job.code || null }, job.progres ? { progres: job.progres } : {});
  const patch = { etat: fini ? (job.etape === 'echec' || job.etape === 'abandonne' ? 'echec' : 'fait') : 'en-cours', resultat: res };
  // On relit la ligne pour garder sa demande (cmd, args, pour…) — une lecture
  // ratée n'écrit rien (« rien lu ne vaut pas rien »).
  const rows = await sbGet(`app_data?id=eq.${encodeURIComponent(lien.id)}&select=data`);
  if (!Array.isArray(rows) || !rows[0] || !rows[0].data) return;
  await relaisEcrire(lien.id, moi, Object.assign({}, rows[0].data, patch, fini ? { finiLe: Date.now() } : {}), null);
  if (fini) {
    delete jobs[jobId];
    try { await chrome.storage.local.set({ [RELAIS_JOBS]: jobs }); } catch (_) {}
    await noterRelaisVu(lien.id, { resultat: { etat: patch.etat, resultat: res } });
  }
}


// Renvoie null si l'action peut partir, sinon l'objet d'erreur à renvoyer tel quel.
async function garde(uid, acc) {
  const pause = await pauseVinted();
  if (pause) return { ok: false, code: 'vinted-pause', error: raisonPauseVinted(pause) };
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

// ── L'ACCEPTATION AUTOMATIQUE DES OFFRES A ÉTÉ RETIRÉE (5.159, 5 octobre) ───
// Coupée le 4 octobre (« je ne veux pas que ça accepte tout seul les offres »),
// puis RETIRÉE le 5 octobre à sa demande (« enlève l'acceptation de l'offre ») :
// le moteur, ses planchers, son salut automatique et `repondreOffre` ne servaient
// plus qu'à lui. Accepter une offre à sa place ressemble à un robot (§3) et
// engage une vente ferme. ⚠️ NE PAS LE RÉÉCRIRE sans sa demande explicite.
// L'acceptation MANUELLE depuis la messagerie de l'app (son clic, avec
// confirmation) passe par `executerPourApp` / EXEC_PERMIS : elle reste.
// `scripts/audit-offres-auto.cjs` refuse tout autre chemin vers /accept.
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
    // ⚠️ LECTURE RATÉE ≠ COFFRE VIDE (famille §5.53). `sbGet` rend `null` quand
    //    la base n'a pas répondu : repartir de « aucun enregistrement » et
    //    réécrire remplacerait une fiche RICHE (description + photos HD, §47)
    //    par la fiche pauvre du dressing. `null` = pas su (on n'écrit pas) ;
    //    `[]` = première sauvegarde (écriture légitime). Seul `null` bloque.
    if (rows === null) return false;
    const anc = (rows[0] && rows[0].data) || null;
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
  // ⚠️ Famille NON BORNÉE (une ligne par annonce, tous comptes confondus) →
  //    PAGINÉE (`sbGetTout`, §4.5 : au-delà de 1000 lignes Supabase tronque en
  //    silence). ET LECTURE RATÉE ≠ COFFRE VIDE (§5.53) : `null` (pas su) ne
  //    doit pas faire réécrire par-dessus des fiches riches — ce lot tourne à
  //    CHAQUE visite Vinted (lignes 849, 2348), c'est le chemin le plus fréquent.
  const rows = await sbGetTout(`app_data?id=like.coffre_${uid}_*&select=id,data`);
  if (rows === null) return false;
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
  if (opts.automatique && !(await bordereauxAutoActifs())) return { ok: false, error: 'Génération automatique désactivée dans VRM' };
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
// ⛔ (5.179, 16 octobre) La réponse automatique aux messages Vinted est
//    RETIRÉE — sa décision : aucune réponse ne part toute seule. Répondre à
//    UNE conversation reste possible depuis la messagerie de l'app, sur son
//    clic (`executerPourApp`, liste blanche `…/replies`).

// ══ UN ÉCHEC PASSAGER NE BLOQUE PAS 6 H (relecture croisée de la 5.174) ══════
// Les lecteurs bornés (`capterRetraits` 6 h, `capterDatesVersement` 24 h,
// `capterPreuvesVente` 6 h) posaient leur mémo AVANT la requête et ne l'ôtaient
// jamais : un 429 de Vinted (pause de 15 min), un 401, une coupure réseau, ou une
// écriture refusée par NOTRE base cachaient la vente 6 ou 24 h. Mesuré (vrai
// background.js dans un vm, 12 octobre) : 2 ventes lues, 0 rangée, relues
// seulement à +6 h 06 — pendant que l'écran eBay promettait « à ta prochaine
// visite », et que le retrait automatique d'eBay ne voyait pas la vente.
// Ce qu'un échec dit de la suite :
//   'garder'  — Vinted a JUGÉ cette demande (4xx autre que 401/403/429) : le
//               délai normal ;
//   'bref'    — Vinted en panne (5xx) : 30 min, pas 6 h (une transaction cassée
//               ne mange pas le budget de lecture à chaque visite) ;
//   'oublier' — rien n'a été jugé (pause, frein 429/403, 401, réseau) : la visite
//               suivante la relit — la pause, elle, l'empêche avant.
// (Une réponse 200 sans l'objet attendu est un jugement : le délai normal, posé
// par l'appelant. Une ÉCRITURE refusée par notre base : l'appelant ôte le mémo
// et s'arrête — la base refuse, la suivante échouerait aussi.)
const RELECTURE_BREVE_MS = 30 * 60000;
function suiteLectureRatee(rep) {
  if (!rep || rep.pause) return 'oublier';
  const s = Number(rep.status) || 0;
  if (!s || s === 401 || freinVinted(s)) return 'oublier';
  if (s >= 500) return 'bref';
  return 'garder';
}
// Applique la suite au mémo (`cle` → date de l'essai, relu avec `delaiMs`) ;
// rend `true` quand la boucle doit s'arrêter (Vinted a demandé de ralentir).
function memoApresEchec(memo, cle, rep, delaiMs) {
  const suite = suiteLectureRatee(rep);
  if (suite === 'oublier') delete memo[cle];
  else if (suite === 'bref') memo[cle] = Date.now() - delaiMs + RELECTURE_BREVE_MS;
  return !!(rep && (rep.pause || freinVinted(Number(rep.status) || 0)));
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
    if (!attend.length) { if (rows !== null) await noterLecturesDues(uid, 'retrait', 0); return 0; }
    // Ce qu'on a déjà : inutile de redemander une conversation dont le code est
    // en base (lecture d'une seule ligne, quelques Ko).
    let deja = {}, dejaSu = true;
    try {
      const r = await sbGet('app_data?id=eq.panel_colis_relais&select=data');
      if (r === null) dejaSu = false;
      deja = (r && r[0] && r[0].data) || {};
    } catch (_) { dejaSu = false; }
    const memo = (await chrome.storage.local.get('vrmRetraitFaits')).vrmRetraitFaits || {};
    // Une conversation ENCORE à lire maintenant : pas de code en base, pas
    // d'essai dans les 6 dernières heures.
    const aLire = (o) => {
      const tx = String(o.transaction_id || '');
      if (tx && deja[tx] && deja[tx].code) return false;          // on a déjà le code
      const cid = String(o.conversation_id);
      return !(memo[cid] && Date.now() - Number(memo[cid]) < BORD_RETRY_MS);
    };
    let n = 0;
    for (const o of attend) {
      if (n >= RETRAIT_MAX_PAR_VISITE) break;
      if (!aLire(o)) continue;
      const tx = String(o.transaction_id || '');
      const cid = String(o.conversation_id);
      // 5.162 : lire SA conversation est une LECTURE — budget de lecture,
      // priorité colis (un code manqué, c'est un colis qui repart).
      const refus = await gardeLecture(uid, acc, 'colis');
      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Code de retrait non lu : ${refus.error}`); break; }
      memo[cid] = Date.now();
      n++;
      const rep = await vintedGet(acc, `/api/v2/conversations/${encodeURIComponent(cid)}`);
      if (!rep.ok || !rep.json) { noterDiag(`retrait_conv_refuse_${rep.status}`); if (memoApresEchec(memo, cid, rep, BORD_RETRY_MS)) break; continue; }
      const r = retraitDeConversation(rep.json);
      if (!r) { noterDiag('retrait_conv_sans_message'); continue; }
      if (!r.tx && tx) r.tx = tx;                                 // identité de l'achat
      const ecrit = await noterRetrait(r, uid);
      // Code lu mais PAS rangé (notre base) : relu à la visite suivante.
      if (ecrit === null) { delete memo[cid]; break; }
      if (ecrit) logActivity(`📦 Code de retrait récupéré — ${(r.code || r.lieu || '').slice(0, 40)}`);
    }
    await chrome.storage.local.set({ vrmRetraitFaits: memo });
    // « Pas su » ce qui est déjà en base ⇒ on ne dit rien (la réserve reste).
    if (dejaSu) await noterLecturesDues(uid, 'retrait', attend.filter(aLire).length);
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
    if (!finalisees.length) { await noterLecturesDues(uid, 'versement', 0); return 0; }
    const det = await sbGetTout(`app_data?id=like.harvest_${uid}_txn_*&select=id,s:meta->>status,su:meta->>status_updated_at`);
    if (det === null) return 0;                                           // pas su
    const datees = new Set();
    for (const r of det) {
      const tx = (/_txn_(\d+)$/.exec(String((r && r.id) || '')) || [])[1];
      if (tx && String(r.s) === '450' && r.su && !isNaN(Date.parse(r.su))) datees.add(tx);
    }
    const memo = (await chrome.storage.local.get('vrmVersementFaits')).vrmVersementFaits || {};
    // Une vente dont la date reste à lire MAINTENANT (pas datée, pas d'essai
    // dans les 24 dernières heures).
    const aLire = (o) => {
      const tx = String(o.transaction_id);
      if (!/^\d+$/.test(tx) || datees.has(tx)) return false;
      return !(memo[tx] && Date.now() - Number(memo[tx]) < VERSEMENT_RETRY_MS);
    };
    let n = 0, ecrites = 0;
    for (const o of finalisees) {
      if (n >= VERSEMENT_MAX_PAR_VISITE) break;
      if (!aLire(o)) continue;
      const tx = String(o.transaction_id);
      // 5.162 : lire le détail de SA vente est une LECTURE — budget de lecture,
      // priorité argent (c'est le CA qu'il déclare).
      const refus = await gardeLecture(uid, acc, 'argent');
      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Dates de versement non lues : ${refus.error}`); break; }
      memo[tx] = Date.now();
      n++;
      const rep = await vintedGet(acc, `/api/v2/transactions/${encodeURIComponent(tx)}`);
      if (!rep.ok || !rep.json) { noterDiag(`versement_refuse_${rep.status}`); if (memoApresEchec(memo, tx, rep, VERSEMENT_RETRY_MS)) break; continue; }
      const t = rep.json.transaction;
      if (!t || typeof t !== 'object') { noterDiag('versement_sans_transaction'); continue; }
      const data = { type: 'transaction', uid: String(uid), domain: acc.domain || 'www.vinted.fr',
        capturedAt: new Date().toISOString(), payload: alleger('transaction', rep.json) };
      const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_txn_${tx}`, data }], 'id');
      // Notre base refuse : la date n'est PAS rangée — relue à la visite suivante
      // (pas dans 24 h), et on s'arrête (la suivante échouerait aussi).
      if (ok === false) { noterDiag('versement_ecriture_ratee'); delete memo[tx]; break; }
      if (String(t.status) === '450' && t.status_updated_at) { ecrites++; noterDiag('versement_date_ecrit'); }
      else noterDiag(`versement_statut_${String(t.status).slice(0, 8)}`);
    }
    await chrome.storage.local.set({ vrmVersementFaits: memo });
    await noterLecturesDues(uid, 'versement', finalisees.filter(aLire).length);
    if (ecrites) {
      logActivity(`💶 ${ecrites} date${ecrites > 1 ? 's' : ''} de versement récupérée${ecrites > 1 ? 's' : ''}`);
      notifierApp({ type: 'maj', quoi: 'versements', uid: String(uid) });
    }
    return n;
  } catch (_) { return 0; }
}

// ═══ LA PREUVE DE VENTE, RANGÉE (5.169, 11 octobre) ════════════════════════
// Une transaction LUE (par le bordereau ou par `capterPreuvesVente`) est rangée
// sous `harvest_{uid}_txn_{tx}`, la forme EXACTE de `capterDatesVersement` : la
// base en tire `meta->>item_id` et `meta->>status_title`, ce que lit la preuve
// de vente de l'app et de l'extension — rien à changer chez elles.
// ⚠️ Une réponse qui porte une AUTRE transaction n'est pas rangée sous ce
//    numéro (on ne fabrique pas une preuve pour la mauvaise vente).
// Rend `true` si la base l'a RANGÉE · `false` si ce n'est pas une transaction
// rangeable (absente, ou une AUTRE) · `null` si NOTRE base a refusé l'écriture
// (relecture croisée de la 5.174 : la preuve se relit alors à la visite suivante).
async function rangerTransaction(uid, acc, tx, json, quoi) {
  try {
    const t = json && json.transaction;
    if (!t || typeof t !== 'object' || !/^\d+$/.test(String(tx))) return false;
    if (t.id != null && String(t.id) !== String(tx)) { await noterDiag(`${quoi}_txn_autre`); return false; }
    const data = { type: 'transaction', uid: String(uid), domain: (acc && acc.domain) || 'www.vinted.fr',
      capturedAt: new Date().toISOString(), payload: alleger('transaction', json) };
    const ok = await supabaseUpsert('app_data', [{ id: `harvest_${uid}_txn_${tx}`, data }], 'id');
    if (ok === false) { await noterDiag(`${quoi}_txn_ecriture_ratee`); return null; }
    await noterDiag(`${quoi}_txn_rangee`);
    return true;
  } catch (_) { return null; }
}

// ═══ LA PREUVE DES VENTES EN COURS (5.169, 11 octobre) ═════════════════════
// Une vente à poster ou en route dont aucune preuve n'existe (ni transaction
// rangée, ni bordereau qui porte son annonce) est INVISIBLE pour l'anti double
// vente : sa paire peut rester en vente sur eBay. Mesuré le 11 octobre : 4 des
// 18 ventes en cours n'avaient ni l'une ni l'autre. On lit leur transaction.
// ⚠️ Une LECTURE sur ses propres ventes (§3 l'autorise), la forme exacte de
// `capterDatesVersement` : compte connecté (`gardeLecture`, priorité colis),
// dans la file Vinted (une requête à la fois), 3 par visite, jamais deux fois
// la même vente en 6 h. « Pas su » (ventes, transactions ou bordereaux
// illisibles) ⇒ on ne lit RIEN chez Vinted.
const PREUVE_MAX_PAR_VISITE = 3;
const PREUVE_RETRY_MS = 6 * 60 * 60 * 1000;
async function capterPreuvesVente(uid) {
  try {
    if (!uid) return 0;
    const accts = await getStoredAccounts();
    const acc = accts.find(a => String(a.vinted_user_id) === String(uid));
    if (!acc) return 0;
    const rows = await sbGet(`app_data?id=eq.harvest_${uid}_orders_sold&select=v:data->payload->my_orders`);
    if (!Array.isArray(rows)) return 0;                                   // pas su
    const ventes = (rows[0] && Array.isArray(rows[0].v)) ? rows[0].v : [];
    const maintenant = Date.now();
    const enCours = ventes.filter(o => venteEnCoursPreuve(o, maintenant) && /^\d+$/.test(String(o.transaction_id)));
    if (!enCours.length) { await noterLecturesDues(uid, 'preuve', 0); return 0; }
    const det = await sbGetTout(`app_data?id=like.harvest_${uid}_txn_*&select=id,it:meta->>item_id,ti:meta->>status_title`);
    if (det === null) return 0;                                           // pas su
    const bords = await sbGetTout(`app_data?id=like.harvest_${uid}_label_*&select=id,tx:meta->>tx,it:meta->>item`);
    if (bords === null) return 0;                                         // pas su
    const prouvees = preuvesParTransaction(det, { [String(uid)]: ventes }).tx;
    const parBord = preuvesParBordereau(bords, { [String(uid)]: ventes }).tx;
    const memo = (await chrome.storage.local.get('vrmPreuveFaits')).vrmPreuveFaits || {};
    for (const k of Object.keys(memo)) if (maintenant - Number(memo[k]) > 2 * 86400000) delete memo[k];
    const aLire = (o) => {
      const tx = String(o.transaction_id);
      if (prouvees.has(tx) || parBord.has(tx)) return false;
      return !(memo[tx] && Date.now() - Number(memo[tx]) < PREUVE_RETRY_MS);
    };
    let n = 0, ecrites = 0;
    for (const o of enCours) {
      if (n >= PREUVE_MAX_PAR_VISITE) break;
      if (!aLire(o)) continue;
      const tx = String(o.transaction_id);
      const refus = await gardeLecture(uid, acc, 'colis');
      if (refus) { if (refus.code !== 'vinted-pause') logActivity(`⚠️ Preuve de vente non lue : ${refus.error}`); break; }
      memo[tx] = Date.now();
      n++;
      const rep = await vintedGet(acc, `/api/v2/transactions/${encodeURIComponent(tx)}`);
      if (!rep || !rep.ok || !rep.json) { await noterDiag(`preuve_refuse_${(rep && rep.status) || 0}`); if (memoApresEchec(memo, tx, rep, PREUVE_RETRY_MS)) break; continue; }
      const range = await rangerTransaction(uid, acc, tx, rep.json, 'preuve');
      // Notre base refuse : la preuve n'est PAS rangée — relue à la visite
      // suivante (et comptée dans la réserve), et on s'arrête.
      if (range === null) { delete memo[tx]; break; }
      if (range) ecrites++;
    }
    await chrome.storage.local.set({ vrmPreuveFaits: memo });
    await noterLecturesDues(uid, 'preuve', enCours.filter(aLire).length);
    if (ecrites) {
      logActivity(`🧾 ${ecrites} vente${ecrites > 1 ? 's' : ''} reliée${ecrites > 1 ? 's' : ''} à leur annonce (anti double vente)`);
      notifierApp({ type: 'maj', quoi: 'preuves', uid: String(uid) });
    }
    return n;
  } catch (_) { return 0; }
}

// ═══ PURGE DES VIEUX BORDEREAUX (4 octobre) ════════════════════════════════
// Julien : « 117 colis partis… après avoir expédié / au-delà de 2 semaines tu
// peux supprimer les bordereaux, ça ferait énormément d'économie ». Il a tranché :
// « après vente FINALISÉE ». Un bordereau sert jusqu'à l'envoi du colis ; une
// vente finalisée (statut 450, argent versé) est livrée depuis longtemps — son
// PDF (100-200 Ko, le gros du stockage/égress) est mort. On retire les OCTETS
// (`pdfB64`, `pdfTamponneB64`) et on GARDE toute la métadonnée (date, N°, suivi,
// transaction) : l'historique reste, seul le poids part.
// ⚠️ DESTRUCTIF — donc FAIL-SAFE PAR SENS : on SOUS-purge au moindre doute.
//   · lecture ratée (`null`) → on n'agit pas (« rien lu » ne vaut pas « rien ») ;
//   · on ne purge QUE si on a trouvé de VRAIS octets — une forme inconnue
//     (champs renommés) ne perd rien et ne se dit pas « purgée » ;
//   · ceinture : jamais un bordereau de moins de 7 jours, même « finalisé ».
// L'app liste les `email_bord` par `meta->>filename` (témoin du PDF) : vider
// `filename` sort la ligne purgée de « à imprimer » — aucun bouton « Imprimer »
// cassé, AUCUN changement côté app nécessaire. §3 ne s'applique pas (ce sont NOS
// lectures/écritures Supabase, pas des requêtes Vinted).
const PURGE_MAX_PAR_RUN = 20;
const PURGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const PURGE_MIN_AGE_MS = 7 * 86400000;
async function purgeBordereaux() {
  try {
    const cd = (await chrome.storage.local.get('vrmPurgeBord')).vrmPurgeBord || 0;
    if (Date.now() - Number(cd) < PURGE_COOLDOWN_MS) return 0;
    // Ventes finalisées (statut 450), TOUS comptes — `email_bord` est global.
    const det = await sbGetTout('app_data?id=like.harvest_*_txn_*&meta->>status=eq.450&select=id');
    if (det === null) return 0;                                   // pas su → on ne purge RIEN
    const finalisees = new Set();
    for (const r of det) { const tx = (/_txn_(\d+)$/.exec(String((r && r.id) || '')) || [])[1]; if (tx) finalisees.add(tx); }
    if (!finalisees.size) { await chrome.storage.local.set({ vrmPurgeBord: Date.now() }); return 0; }
    // Candidats : bordereaux qui PORTENT ENCORE un PDF (témoin `filename`), pas
    // déjà purgés, d'une vente finalisée, et vieux d'au moins 7 jours.
    const bords = await sbGetTout('app_data?id=like.email_bord_*&select=id,fn:meta->>filename,pg:meta->>pdfPurged,rc:meta->>receivedAt');
    if (bords === null) return 0;                                 // pas su
    const limite = Date.now() - PURGE_MIN_AGE_MS;
    const candidats = bords.filter(r => {
      if (!r || !r.fn || r.fn === 'None') return false;          // pas de PDF (déjà purgé / jamais eu)
      if (String(r.pg) === 'true') return false;                 // déjà purgé
      const tx = (/^email_bord_(\d+)$/.exec(String(r.id || '')) || [])[1];
      if (!tx || !finalisees.has(tx)) return false;              // pas (encore) finalisée
      const t = Date.parse(r.rc || '');
      // ⚠️ SANS DATE LISIBLE, ON GARDE (même règle que la branche `label_*` juste
      //    en dessous, et principe du dossier : pour un effacement IRRÉVERSIBLE,
      //    au moindre doute on sous-purge). Avant, une date absente/illisible
      //    (`!isNaN(t)` faux) sautait la ceinture et le PDF partait sans contrôle
      //    d'âge — l'asymétrie avec `label_*` sur la MÊME fonction. 0 ligne
      //    concernée aujourd'hui (toutes datées), c'est un verrou pour plus tard.
      if (isNaN(t) || t > limite) return false;                  // ceinture : sans date OU trop récent → on garde
      return true;
    });
    let n = 0;
    for (const r of candidats) {
      if (n >= PURGE_MAX_PAR_RUN) break;
      const plein = await sbGet(`app_data?id=eq.${encodeURIComponent(r.id)}&select=data`);
      if (!Array.isArray(plein)) continue;                       // lecture ratée → on saute
      const data = plein[0] && plein[0].data;
      if (!data || typeof data !== 'object') continue;
      // ⚠️ On ne marque « purgé » QUE si on a trouvé de VRAIS octets : une forme
      //    inconnue (champs renommés) ne doit RIEN perdre ni se dire purgée.
      const avaitPdf = (data.pdfB64 && data.pdfB64 !== 'None') || (data.pdfTamponneB64 && data.pdfTamponneB64 !== 'None');
      if (!avaitPdf) continue;
      const neuf = { ...data, pdfB64: null, pdfTamponneB64: null, filename: '', pdfPurged: true, pdfPurgedAt: new Date().toISOString() };
      const ok = await supabaseUpsert('app_data', [{ id: r.id, data: neuf }], 'id');
      if (ok === false) { noterDiag('bordereau_purge_ecriture_ratee'); continue; }
      n++; noterDiag('bordereau_purge');
    }
    // ── Les bordereaux CAPTÉS PAR L'EXTENSION (`harvest_{uid}_label_{tx}`) ──────
    // Autorisé par Julien le 4 octobre (mesuré : 55 lignes de ventes finalisées,
    // 10,8 Mo, qu'aucune règle ne purgeait). Même règle, mêmes ceintures, et une
    // de plus : ici la date doit être LISIBLE et vieille de 7 jours — sans date,
    // on ne sait pas, donc on garde. On ne lit que les lignes qui portent ENCORE
    // un PDF (`_pdf`, posé par la base) : une ligne purgée ne revient jamais.
    // `label_latest` (le « dernier capté » d'un compte) suit la même règle par sa
    // transaction : il n'est qu'une copie d'un `label_{tx}`.
    const labels = await sbGetTout('app_data?id=like.harvest_*_label_*&meta->>_pdf=eq.true&select=id,tx:meta->>tx,cap:meta->>capturedAt');
    let nl = 0, resteLabels = 0;
    if (labels !== null) {                                        // pas su → on ne touche à aucun
      const candLabels = labels.filter(r => {
        const id = String((r && r.id) || '');
        const m = /^harvest_\d+_label_(\d+|latest)$/.exec(id);
        if (!m) return false;
        const tx = m[1] === 'latest' ? String(r.tx || '') : m[1];
        if (!/^\d+$/.test(tx)) return false;                     // latest sans transaction : on ne sait pas
        if (r.tx && String(r.tx) !== tx) return false;            // ligne incohérente : doute → on garde
        if (!finalisees.has(tx)) return false;                    // pas (encore) finalisée
        const t = Date.parse(r.cap || '');
        if (isNaN(t) || t > limite) return false;                 // date illisible ou trop récente
        return true;
      });
      for (const r of candLabels) {
        if (nl >= PURGE_MAX_PAR_RUN) { resteLabels++; continue; }
        const plein = await sbGet(`app_data?id=eq.${encodeURIComponent(r.id)}&select=data`);
        if (!Array.isArray(plein)) continue;                     // lecture ratée → on saute
        const data = plein[0] && plein[0].data;
        if (!data || typeof data !== 'object') continue;
        if (!(data.pdfB64 && data.pdfB64 !== 'None')) continue;  // pas de vrais octets : rien à retirer
        const neuf = { ...data, pdfB64: null, pdfPurged: true, pdfPurgedAt: new Date().toISOString() };
        const ok = await supabaseUpsert('app_data', [{ id: r.id, data: neuf }], 'id');
        if (ok === false) { noterDiag('label_purge_ecriture_ratee'); continue; }
        nl++; noterDiag('label_purge');
      }
    }
    // Un arriéré (plus de 20 candidats) se résorbe en une heure de visites, pas
    // en trois jours ; sans arriéré, on attend 12 h.
    const reste = candidats.length > PURGE_MAX_PAR_RUN || resteLabels > 0;
    await chrome.storage.local.set({ vrmPurgeBord: reste ? Date.now() - PURGE_COOLDOWN_MS + 3600000 : Date.now() });
    if (n) logActivity(`🧹 ${n} vieux bordereau${n > 1 ? 'x' : ''} allégé${n > 1 ? 's' : ''} (vente finalisée — PDF retiré, infos gardées)`);
    if (nl) logActivity(`🧹 ${nl} bordereau${nl > 1 ? 'x' : ''} capté${nl > 1 ? 's' : ''} allégé${nl > 1 ? 's' : ''} (vente finalisée — PDF retiré, infos gardées)`);
    return n + nl;
  } catch (_) { return 0; }
}

// ═══ VENTE ANNULÉE → SON BORDEREAU PART (17 octobre, 5.185) ════════════════
// Julien : « j'ai fait une vente et elle a été annulée, l'extension doit être
// capable de voir que la vente est annulée, supprimer le bordereau et la retirer
// des colis à faire et des ventes ». Quand la TRANSACTION dit annulée (codes
// 500-520, mesurés) et que son expédition n'avait PAS bougé (aucun « expédié /
// acheminement / déposé / livré / remis »), le PDF de son bordereau ne sert plus
// à rien — l'imprimer enverrait un colis que personne n'a payé. On retire les
// OCTETS (`email_bord_{tx}`, `harvest_{uid}_label_{tx}`, et `label_latest` s'il
// porte cette transaction), on GARDE la métadonnée, et on prévient l'app
// (`maj · annulee`) — sans attendre les 7 jours de la purge des finalisées.
// ⚠️ DESTRUCTIF, donc fail-safe par sens : lecture ratée ⇒ rien ; une
//    expédition qui a bougé ⇒ on garde (c'est un retour, pas une annulation
//    sèche) ; pas de vrais octets ⇒ rien n'est marqué. 20 par passage.
const ANNUL_COOLDOWN_MS = 20 * 60 * 1000;
const EXPEDITION_A_BOUGE = /exp[ée]di|achemin|transit|livr|d[ée]pos|remis|r[ée]ceptionn/i;
const TXN_ANNULEE = (st) => { const n = parseInt(String(st == null ? '' : st), 10); return Number.isFinite(n) && n >= 500 && n < 600; };
async function purgeBordereauxAnnules() {
  try {
    const cd = (await chrome.storage.local.get('vrmPurgeAnnul')).vrmPurgeAnnul || 0;
    if (Date.now() - Number(cd) < ANNUL_COOLDOWN_MS) return 0;
    const det = await sbGetTout('app_data?id=like.harvest_*_txn_*&meta->>status=like.5*&select=id,st:meta->>status,sst:meta->>ship_status_title');
    if (det === null) return 0;                                   // pas su → RIEN
    const annulees = new Map();                                   // tx → uid
    for (const r of det) {
      const m = /^harvest_(\d+)_txn_(\d+)$/.exec(String((r && r.id) || ''));
      if (!m || !TXN_ANNULEE(r.st)) continue;
      if (EXPEDITION_A_BOUGE.test(String(r.sst || ''))) continue;  // le colis a bougé : on garde
      annulees.set(m[2], m[1]);
    }
    if (!annulees.size) { await chrome.storage.local.set({ vrmPurgeAnnul: Date.now() }); return 0; }
    const bords = await sbGetTout('app_data?id=like.email_bord_*&select=id,fn:meta->>filename,pg:meta->>pdfPurged');
    if (bords === null) return 0;
    const labels = await sbGetTout('app_data?id=like.harvest_*_label_*&meta->>_pdf=eq.true&select=id,tx:meta->>tx');
    if (labels === null) return 0;
    const cibles = [];
    for (const r of bords) {
      const tx = (/^email_bord_(\d+)$/.exec(String((r && r.id) || '')) || [])[1];
      if (!tx || !annulees.has(tx) || !r.fn || r.fn === 'None' || String(r.pg) === 'true') continue;
      cibles.push({ id: r.id, tx, email: true });
    }
    for (const r of labels) {
      const m = /^harvest_\d+_label_(\d+|latest)$/.exec(String((r && r.id) || ''));
      if (!m) continue;
      const tx = m[1] === 'latest' ? String(r.tx || '') : m[1];
      if (!/^\d+$/.test(tx) || !annulees.has(tx)) continue;
      if (r.tx && String(r.tx) !== tx) continue;                  // incohérent : doute → on garde
      cibles.push({ id: r.id, tx, email: false });
    }
    let n = 0; const prevenus = new Set();
    for (const c of cibles.slice(0, PURGE_MAX_PAR_RUN)) {
      const plein = await sbGet(`app_data?id=eq.${encodeURIComponent(c.id)}&select=data`);
      if (!Array.isArray(plein)) continue;                        // lecture ratée → on saute
      const data = plein[0] && plein[0].data;
      if (!data || typeof data !== 'object') continue;
      const avaitPdf = (data.pdfB64 && data.pdfB64 !== 'None') || (c.email && data.pdfTamponneB64 && data.pdfTamponneB64 !== 'None');
      if (!avaitPdf) continue;
      const neuf = c.email
        ? { ...data, pdfB64: null, pdfTamponneB64: null, filename: '', pdfPurged: true, pdfPurgedAt: new Date().toISOString(), annulee: true }
        : { ...data, pdfB64: null, pdfPurged: true, pdfPurgedAt: new Date().toISOString(), annulee: true };
      const ok = await supabaseUpsert('app_data', [{ id: c.id, data: neuf }], 'id');
      if (ok === false) { noterDiag('bordereau_annulee_ecriture_ratee'); continue; }
      n++; noterDiag('bordereau_annulee_purge');
      if (!prevenus.has(c.tx)) { prevenus.add(c.tx); try { notifierApp({ type: 'maj', quoi: 'annulee', uid: String(annulees.get(c.tx) || ''), tx: c.tx }); } catch (_) {} }
    }
    await chrome.storage.local.set({ vrmPurgeAnnul: cibles.length > PURGE_MAX_PAR_RUN ? Date.now() - ANNUL_COOLDOWN_MS + 60000 : Date.now() });
    if (n) logActivity(`🧹 ${n} bordereau${n > 1 ? 'x' : ''} de vente${prevenus.size > 1 ? 's' : ''} annulée${prevenus.size > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''} (PDF effacé, infos gardées)`);
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
    if (t && (t.pause || freinVinted(t.status))) return { ok: false, pause: true, raison: t.raison || 'Vinted demande de ralentir' };   // 5.162
    // ⚠️⚠️ 5.169 — LA TRANSACTION LUE ICI ÉTAIT JETÉE. C'est pourtant la PREUVE
    //    de vente que lit l'anti double vente (`harvest_{uid}_txn_{tx}` →
    //    `item_id` + état de commande) : la N°553 vendue le 10 octobre a eu son
    //    bordereau à 21:55, et aucune ligne de transaction — l'annonce eBay est
    //    restée en vente. On la range, sous la forme exacte de
    //    `capterDatesVersement` : AUCUNE requête Vinted de plus, et une seule
    //    écriture réussie par appel, même quand `recupererLabelInsiste` réessaie.
    if (t && t.ok && t.json && t.json.transaction && !(connu && connu.txnRangee)) {
      const range = await rangerTransaction(uid, acc, tx, t.json, 'label');
      if (connu && range) connu.txnRangee = true;
    }
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
      if (l && (l.pause || freinVinted(l.status))) return { ok: false, pause: true, raison: l.raison || 'Vinted demande de ralentir' };   // 5.162
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
    // Une page HTML (session expirée, erreur S3) n'est pas un bordereau : on ne
    // la range pas, sinon `_pdf` passerait à vrai et le vrai PDF ne serait plus
    // jamais redemandé. Transitoire (le PDF peut ne pas être encore déposé) :
    // `recupererLabelInsiste` réessaie.
    if (!estPdfOctets(bytes)) { await noterDiag('label_pas_un_pdf'); return { ok: false, raison: "Le fichier reçu n'est pas encore le PDF du bordereau" }; }
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
    if (dernier.pause) return dernier;                       // 5.162 : Vinted freine, on n'insiste pas
    // On n'insiste que sur les échecs TRANSITOIRES (le PDF n'est pas encore là).
    // Un refus dur (permissions, PDF vide, 4xx) ne s'arrangera pas en attendant.
    const transitoire = /pas donné l'URL|n'expose pas encore|pas encore le PDF/i.test(dernier.raison || '');
    if (!transitoire || i === LABEL_ATTENTES_MS.length) break;
    await new Promise(r => setTimeout(r, LABEL_ATTENTES_MS[i]));
  }
  if (!dernier.ok) await noterDiag('label_abandon_apres_essais');
  return dernier;
}

// Pas de cache : une coupure dans VRM doit arrêter la prochaine génération.
async function bordereauxAutoActifs() {
  try {
    const session = await authToken();
    if (!session?.access_token || !session.user_id) return false;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_bordereaux_auto&owner=eq.${encodeURIComponent(session.user_id)}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return rows.length === 1 && rows[0]?.data?.active === true;
  } catch (_) { return false; }
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
      const mails = await sbGetTout('app_data?id=like.email_bord_*&select=tx:meta->>transaction'); // §4.5 : les bordereaux s'accumulent au-delà de 1000 — sbGet tronquait en silence
      for (const m of (mails || [])) if (m && m.tx) dejaMail.add(String(m.tx));
    } catch (_) { /* sans cette lecture on retombe sur le statut Vinted, qui suffit */ }
    const memo = (await chrome.storage.local.get('vrmBordFaits')).vrmBordFaits || {};
    let faits = 0;
    for (const o of (opts.lectureSeule || !(await bordereauxAutoActifs()) ? [] : candidates)) {
      if (faits >= BORD_MAX_PAR_VISITE) break;
      if (await pauseVinted()) break;                            // 5.162 : Vinted a freiné
      const tx = String(o.transaction_id);
      if (dejaMail.has(tx)) continue;
      if (memo[tx] && Date.now() - Number(memo[tx].t || 0) < BORD_RETRY_MS) continue;
      const r = await genererBordereau(uid, tx, { automatique: true });
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
        if (r.code === 'autre-compte' || r.code === 'trop-d-actions' || r.code === 'vinted-pause') {
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
      const cur = await sbGetTout(`app_data?id=like.harvest_${uid}_label_*&select=tx:meta->>tx`); // §4.5 : un compte à fort volume dépasse 1000 bordereaux — sbGet tronquait en silence
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
      const pa = A_EXPEDIER(a) ? 0 : 1, pb = A_EXPEDIER(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;                             // ce qui attend TON envoi d'abord
      return (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0);
    });
    let recup = 0;
    for (const o of aRecuperer) {
      if (recup >= BORD_MAX_PAR_VISITE) break;
      if (await pauseVinted()) break;                            // 5.162 : rien ne part, aucun mémo posé pour rien
      const tx = String(o.transaction_id);
      memo['get' + tx] = { t: Date.now() };
      // ⚠️ ON N'INSISTE QUE QUAND ÇA A UN SENS. L'insistance (§5.48) sert à
      // attendre un PDF que Vinted est en train de fabriquer — donc uniquement
      // sur une vente qui attend encore l'envoi. Sur une vente déjà partie, un
      // « pas d'expédition exposée » ne s'arrangera pas : réessayer 4 fois, ce
      // serait 4 requêtes pour rien dans l'empreinte du compte (§5, §48).
      const eu = A_EXPEDIER(o)
        ? (await recupererLabelInsiste(acc, uid, tx)).ok
        : (await recupererLabel(acc, uid, tx)).ok;
      recup++;
      if (eu) logActivity(`📎 Bordereau récupéré chez Vinted — ${String(o.title || '').slice(0, 40)}`);
    }
    await chrome.storage.local.set({ vrmBordFaits: memo });
    return faits + recup;
  } catch (_) { return 0; }
}

const VRM_APP_API = 'https://vrm.center';

async function sbGet(query) {
  try {
    const session=await authToken();
    if(!session?.user_id||!session.access_token)return null;
    const filtre=`${query.includes('?')?'&':'?'}owner=eq.${encodeURIComponent(session.user_id)}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}${filtre}`, { headers: {apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`} });
    if (!res.ok) return null;
    const rows=await res.json();
    return (await loadSession())?.user_id===session.user_id?rows:null;
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
  'vinted_accounts_hidden', 'vinted_annonce_numeros', 'vinted_pairs_lost', 'vrm_lbc_liens', 'vrm_numerotation', 'vrm_ville'];
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
  const session=await authToken();
  if(!session?.user_id||!session.access_token)return null;
  const filtre=`${query.includes('?')?'&':'?'}owner=eq.${encodeURIComponent(session.user_id)}`;
  const out = [];
  for (let de = 0; ; de += SB_PAGE) {
    let page = null;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}${filtre}`, {
        headers: { apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`, Range: `${de}-${de + SB_PAGE - 1}`, 'Range-Unit': 'items' },
      });
      if (!res.ok) return null;
      page = await res.json();
    } catch (_) { return null; }
    if (!Array.isArray(page) || (await loadSession())?.user_id!==session.user_id) return null;
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

async function sbGetMemo(query) {
  const session=await authToken();
  if(!session?.user_id)return null;
  const cle=JSON.stringify([session.user_id,query]);
  const e = _memoVisite.get(cle);
  if (e && Date.now() - e.at < VISITE_MEMO_MS) {const resultat=await e.p;return (await loadSession())?.user_id===session.user_id?resultat:null;}
  // §4.5 : un BALAYAGE de famille (`id=like.`) passe par la pagination — Supabase
  // coupe une réponse à 1 000 lignes sans le dire. Vu le 5 octobre par
  // audit-lectures (enfin capable de lire tout le fichier) : les transactions
  // d'un compte lues ici auraient été tronquées, et l'extension aurait redemandé
  // à Vinted un bordereau qui existe déjà. `sbGetTout` rend `null` si une page
  // échoue, comme `sbGet` sur un échec.
  const p = /[?&]id=like\./.test(query) ? sbGetTout(query) : sbGet(query);
  _memoVisite.set(cle, { at: Date.now(), p });
  const resultat=await p;return (await loadSession())?.user_id===session.user_id?resultat:null;
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
  // La règle vit dans le bloc partagé avec l'app (`categorieLbcDe`, §11) : la
  // fiche de VRM montre la catégorie que l'extension choisira.
  return categorieLbcDe(det.title || raw.title || '', det.description || '', det.size || raw.size || det.size_title || raw.size_title || '');
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
  // (16 oct., Julien : « au lieu de mettre taille 43 il a mis T43 ») : en
  //    toutes lettres, comme sur Vinted — c'est ce qu'un acheteur tape.
  const suff = taille ? (estPointure ? ' taille ' + taille : ' ' + taille) : '';
  // 5. ⚠️ ON NE COUPE JAMAIS EN PLEIN MOT.
  const place = (max || LBC_TITRE_MAX) - suff.length;
  if (t.length > place) {
    const coupe = t.slice(0, place);
    const esp = coupe.lastIndexOf(' ');
    t = (esp > 12 ? coupe.slice(0, esp) : coupe).replace(/[\s,;:/-]+$/, '');
  }
  return (t + suff).trim();
}

// <annonce-lbc-regle> — LA MÊME RÈGLE DANS L'APP ET L'EXTENSION, §11 ; texte
// identique, comparé (et exécuté des deux côtés) par scripts/audit-lbc-fiche.cjs.
// (16 oct., Julien : « je veux que le poste d'annonce sur leboncoin se fasse
// comme pour eBay, pour tout gérer depuis VRM ».) La fiche de l'app montre et
// laisse corriger titre, description, prix, état et photos ; l'extension les
// REVÉRIFIE avant de les poser — elle ne croit pas la page sur parole :
//   · le titre tient en 50 caractères, la description en 4 000, le prix est un
//     nombre en euros (> 0, deux décimales au plus) ;
//   · la référence VRM-{n°} reste DANS la description (c'est elle qui relie
//     l'annonce à la paire sans rapprochement par titre, §5) — retirée, elle
//     est remise à la fin ;
//   · une photo n'est acceptée que si c'est une photo CAPTÉE de cette annonce
//     (même chemin chez vinted.net) : on choisit et on ordonne, on n'ajoute rien
//     venu d'ailleurs ;
//   · l'état est un libellé MESURÉ du dépôt Leboncoin (`lbc_recon.etapes`), ou
//     l'état Vinted d'origine (le remplissage ne clique qu'une option au texte
//     exactement égal), ou vide (Leboncoin le laisse à choisir).
const LBC_DESC_MAX = 4000;
const LBC_PRIX_MAX = 100000;
const LBC_PHOTOS_MAX = 15;
const LBC_ETATS = ['Neuf avec étiquette', 'Très bon état', 'Bon état', 'État satisfaisant'];
function refLbcPresente(texte, ref) {
  if (!ref) return false;
  return new RegExp(String(ref).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9A-Z])', 'i').test(String(texte || ''));
}
function clePhotoLbc(u) {
  try {
    const x = new URL(String(u || ''));
    if (x.protocol !== 'https:' || !/(^|\.)vinted\.net$/i.test(x.hostname)) return '';
    return x.pathname.replace(/\/(f\d+(?:x\d+)?|tc)\//, '/');
  } catch (_) { return ''; }
}
function categorieLbcDe(titre, description, taille) {
  const t = (String(titre || '') + ' ' + String(description || '')).toLowerCase();
  if (/(sac|sacoche|bandouli|cabas|pochette|portefeuille|porte-monnaie)/.test(t)) return 'Sacs à main';
  if (/(veste|manteau|pull|t-?shirt|tee-?shirt|chemise|jean|pantalon|robe|jupe|short|sweat|hoodie|doudoune|gilet|d[ée]bardeur|combinaison|legging|surv[êe]tement|maillot)/.test(t)) return 'Vêtements';
  if (/(casquette|bonnet|ceinture|montre|lunettes|[ée]charpe|gants|bijou|collier|bracelet|bague|foulard|cravate|portefeuille)/.test(t)) return 'Accessoires & Bagagerie';
  if (/(manuel|livre|bouquin|roman|\bbd\b|scolaire|cahier)/.test(t)) return 'Livres';
  if (/(chaussure|basket|sneaker|running|derby|mocassin|botte|bottine|escarpin|sandale|tong|ballerine|mule|richelieu|espadrille)/.test(t)) return 'Chaussures';
  const p = parseFloat(String(taille || '').replace(',', '.'));
  if (isFinite(p) && p >= 34 && p <= 50) return 'Chaussures';
  return '';
}
function descriptionLbcDe(o) {
  const ref = String(o.ref || '');
  const specs = [];
  if (o.marque) specs.push('Marque : ' + o.marque);
  if (o.taille) specs.push('Taille : ' + o.taille);
  if (o.etat) specs.push('État : ' + o.etat);
  if (o.couleur) specs.push('Couleur : ' + o.couleur);
  const parts = ['📦 Réf. ' + ref, '', String(o.texte || o.base || '').trim()];
  if (specs.length) { parts.push(''); parts.push(specs.join('\n')); }
  parts.push('');
  parts.push('Envoi rapide et soigné (remise en main propre possible). N\'hésitez pas pour toute question.');
  parts.push('Réf. ' + ref);
  return parts.join('\n');
}
// `base` = ce que la file de l'extension sait de CETTE paire : { ref, photos
// (captées), etat (Vinted d'origine) }. Rend { ok, annonce } ou { ok:false,
// erreurs:[{champ, raison}] } — jamais une annonce à moitié vérifiée.
function valideAnnonceLbc(saisie, base) {
  const s = saisie && typeof saisie === 'object' ? saisie : {};
  const b = base && typeof base === 'object' ? base : {};
  const err = [];
  const titre = String(s.title == null ? '' : s.title).replace(/\s+/g, ' ').trim();
  if (!titre) err.push({ champ: 'title', raison: 'le titre est vide' });
  else if (titre.length > LBC_TITRE_MAX) err.push({ champ: 'title', raison: 'le titre dépasse ' + LBC_TITRE_MAX + ' caractères (' + titre.length + ')' });
  let desc = String(s.description == null ? '' : s.description).replace(/\r\n?/g, '\n').trim();
  if (!desc) err.push({ champ: 'description', raison: 'la description est vide' });
  else if (b.ref && !refLbcPresente(desc, b.ref)) desc = desc + '\n\nRéf. ' + b.ref;
  if (desc.length > LBC_DESC_MAX) err.push({ champ: 'description', raison: 'la description dépasse ' + LBC_DESC_MAX + ' caractères (' + desc.length + ')' });
  const brut = String(s.price == null ? '' : s.price).replace(/[\s€]/g, '').replace(',', '.');
  const p = /^\d+(?:\.\d{1,2})?$/.test(brut) ? Number(brut) : NaN;
  if (!(isFinite(p) && p > 0 && p <= LBC_PRIX_MAX)) err.push({ champ: 'price', raison: 'le prix doit être un nombre en euros, plus grand que 0' });
  const parCle = new Map();
  for (const u of (Array.isArray(b.photos) ? b.photos : [])) { const k = clePhotoLbc(u); if (k && !parCle.has(k)) parCle.set(k, String(u)); }
  const photos = []; const vues = new Set();
  if (!Array.isArray(s.photos)) err.push({ champ: 'photos', raison: 'aucune photo choisie' });
  else {
    for (const u of s.photos) {
      const k = clePhotoLbc(u);
      if (!k || !parCle.has(k)) { err.push({ champ: 'photos', raison: 'une photo n\'est pas une photo captée de cette annonce' }); break; }
      if (!vues.has(k)) { vues.add(k); photos.push(parCle.get(k)); }
    }
    if (!photos.length && !err.some((e) => e.champ === 'photos')) err.push({ champ: 'photos', raison: 'choisis au moins une photo — Leboncoin refuse une annonce sans photo' });
    if (photos.length > LBC_PHOTOS_MAX) err.push({ champ: 'photos', raison: 'au plus ' + LBC_PHOTOS_MAX + ' photos' });
  }
  const etat = String(s.etat == null ? '' : s.etat).trim();
  if (etat && LBC_ETATS.indexOf(etat) < 0 && etat !== String(b.etat || '').trim()) err.push({ champ: 'etat', raison: 'état inconnu de Leboncoin' });
  if (err.length) return { ok: false, erreurs: err };
  return { ok: true, annonce: { title: titre, description: desc, price: String(Math.round(p * 100) / 100), photos, etat } };
}
// </annonce-lbc-regle>

function firstDefined(...v) { for (const x of v) if (x !== undefined && x !== null && x !== '') return x; return ''; }
function buildLbcAd(raw, det, num, account) {
  const brand = firstDefined(det.brand_dto && det.brand_dto.title, raw.brand_title, det.brand, raw.brand);
  const base = String(firstDefined(det.title, raw.title)).trim();
  const size = String(firstDefined(det.size, det.size_title, raw.size_title, raw.size)).trim();
  const cond = String(firstDefined(det.status, raw.status)).trim();
  const color = String(firstDefined(det.couleur, [firstDefined(det.color1, raw.color1), firstDefined(det.color2, raw.color2)].filter(Boolean).join(' / '))).trim();
  // (16 oct., « il a mis un prix au pif, je veux le même que sur Vinted ») :
  // le prix de l'annonce EN LIGNE (le dressing, relu à chaque visite) d'abord ;
  // le détail capté à l'ouverture de la page peut dater d'avant une baisse.
  const prixDe = (p) => (p && typeof p === 'object') ? p.amount : p;
  const price = String(firstDefined(prixDe(raw.price), prixDe(det.price))).replace(',', '.');
  const desc0 = lbcDescription(firstDefined(det.description, ''));
  // Photos HD
  let photos = [];
  const ph = det.photos || raw.photos || [];
  if (Array.isArray(ph)) photos = ph.map((p) => firstDefined(p.full_size_url, p.url, typeof p === 'string' ? p : '')).filter(Boolean);
  if (!photos.length && raw.photo && raw.photo.url) photos = [raw.photo.url];
  const title = lbcTitre(brand, base, size);
  // Description structurée — la règle vit dans le bloc partagé avec l'app
  // (`descriptionLbcDe`, §11) : la fiche de VRM montre exactement ce texte.
  // RÉFÉRENCE UNIVERSELLE : NOTRE numéro « VRM-{num} », en HAUT et en bas.
  const ref = 'VRM-' + num;
  const description = descriptionLbcDe({ ref, texte: desc0, base, marque: brand, taille: size, etat: cond, couleur: color });
  // marque/taille : le formulaire Leboncoin a des listes déroulantes pour ça.
  return { id: String(raw.id), numero: String(num), ref, account: account || '', title, description, price, category: lbcCategory(det, raw), marque: brand || '', taille: size || '', etat: cond || '', couleur: color || '', photos, aDescription: !!desc0, vintedUrl: firstDefined(raw.url, det.url) };
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
// ⚠️⚠️ ET UN COMPTE DONT IL A VENDU UNE ANNONCE EST LE SIEN (4 octobre). Mesuré :
//    58 annonces portent un champ `account`, réparties sur **48 comptes** — la
//    5.88 étiquetait les annonces d'AUTRUI avec leur propre propriétaire, donc
//    `account` seul ne prouve rien. Une vente où il est le VENDEUR (`isSeller`)
//    désigne une annonce : le compte de cette annonce est le sien, et ses autres
//    annonces aussi (8 sur 58 chez lui, dont 7 qu'aucune règle ne voyait).
//    C'est une identité (le même compte), pas une ressemblance. La MÊME règle
//    vit dans l'app (`comptesLbcProuves` / `annonceLbcALui`, §11).
function comptesLbcProuves(ventes, items) {
  const s = new Set();
  for (const v of Object.values(ventes || {})) {
    if (!v || v.isSeller !== true || v.itemId == null) continue;
    const ad = items && items[String(v.itemId)];
    if (ad && ad.account) s.add(String(ad.account));
  }
  return s;
}
// 5.195 : un compte dont la SESSION a été vue dans son navigateur (`sessionAt`)
// est le sien aussi (même règle que `comptesLbcSession` dans l'app, §11).
function comptesLbcSession(accounts) {
  const s = new Set();
  for (const [id, a] of Object.entries(accounts || {})) if (a && a.sessionAt) s.add(String(a.id || id));
  return s;
}
function estALui(ad, prouves) { return !!(ad && (ad.ref || ad.customRef || (ad.lbcUser && prouves && prouves.has(String(ad.lbcUser))) || (ad.account && prouves && prouves.has(String(ad.account))))); }
// <lbc-en-vente-regle> — LA MÊME, texte pour texte, dans l'app, l'extension et le
// serveur (§11 ; `audit-lbc-restes.cjs` compare les trois). Une annonce Leboncoin
// n'est « en vente » que si son état ne la dit pas morte ET qu'aucune vente
// PROUVÉE (il est le vendeur, `isSeller`, pas annulée) ne l'a emportée : la vente
// prime sur un `status: 'active'` périmé (mesuré le 20 octobre : ses 3 annonces
// vendues sont restées « active » en base). On ne juge JAMAIS sur une absence dans
// une liste paginée — seulement sur une vente vue, sur une liste COMPLÈTE de son
// compte qui ne la montre plus (`plusVueAt` : toutes les pages lues, le total
// annoncé atteint — posé par l'extension, 22 octobre), ou sur une mise en pause
// que Leboncoin a acceptée depuis VRM, sur SON clic (`pauseAt`, réponse 2xx).
// Rien n'est effacé : ce sont des états, et une liste complète qui la remontre
// les retire.
// ⚠️ (22 oct., revue) LA DONNÉE LA PLUS RÉCENTE GAGNE. Ces marques restaient
// collées : sa page privée « Mes annonces » qui la remontrait ACTIVE après coup
// (`seenAt` plus récent) ne les levait pas — l'annonce sortait de « en vente »,
// l'alerte « à retirer de Leboncoin » tombait et la paire pouvait être reproposée
// à la publication. « Plus vue » ne compte que si aucune capture ne l'a revue
// APRÈS ; une pause, que si aucune capture ne l'a revue plus d'une heure après
// (`LBC_PAUSE_INDEX_MS` : l'index de Leboncoin peut avoir du retard — borne
// prudente, non mesurée). Douter ⇒ « en vente » : le sens sûr (l'alerte reste,
// la paire n'est pas reproposée).
const LBC_PAUSE_INDEX_MS = 3600e3;
function lbcSortieDe(ad) {
  if (!ad) return null;
  const vu = Date.parse(ad.seenAt || '');
  if (ad.plusVueAt && !(isFinite(vu) && vu > Date.parse(ad.plusVueAt))) return 'plusvue';
  if (ad.pauseAt && !(isFinite(vu) && vu > Date.parse(ad.pauseAt) + LBC_PAUSE_INDEX_MS)) return 'pause';
  return null;
}
const LBC_ANNONCE_MORTE = /(supprim|delete|expir|refus|sold|vendu|paus|inacti)/i;
function annoncesLbcVendues(ventes) {
  const s = new Set();
  for (const v of Object.values(ventes || {})) {
    if (!v || v.isSeller !== true || v.itemId == null) continue;
    if (v.stepStatus === 'cancelled' || /annul|cancel|refund|rembours/i.test((v.parcelStatus || '') + ' ' + (v.stepStatus || '') + ' ' + (v.stepLabel || ''))) continue;
    s.add(String(v.itemId));
  }
  return s;
}
function annonceLbcEnVente(ad, vendues) {
  return !!(ad && ad.id != null && !LBC_ANNONCE_MORTE.test(String(ad.status || '')) && !lbcSortieDe(ad) && !(vendues && vendues.has(String(ad.id))));
}
// </lbc-en-vente-regle>
// Ses annonces Leboncoin : celles qu'on peut lui attribuer, moins celles qu'il
// a VENDUES là-bas (elles n'y sont plus en vente). `ok:false` = la base n'a pas
// répondu sur les annonces. Une lecture ratée des VENTES n'attribue rien de plus
// (on retombe sur la règle d'avant) — jamais l'inverse.
async function lireLbcAnnonces() {
  const [rows, vRows, aRows] = await Promise.all([
    sbGet('app_data?id=eq.lbc_listings&select=data'),
    sbGet('app_data?id=eq.lbc_ventes&select=data'),
    sbGet('app_data?id=eq.lbc_accounts&select=data'),
  ]);
  if (rows === null) return { ok: false, ligne: false, items: [] };
  const items = (rows && rows[0] && rows[0].data && rows[0].data.items) || {};
  const ventes = (vRows && vRows[0] && vRows[0].data && vRows[0].data.ventes) || {};
  const accs = (aRows && aRows[0] && aRows[0].data && aRows[0].data.accounts) || {};
  const prouves = new Set([...comptesLbcProuves(ventes, items), ...comptesLbcSession(accs)]);
  const vendues = annoncesLbcVendues(ventes);
  return { ok: true, ligne: !!(rows && rows[0]), items: Object.values(items).filter((ad) => ad && estALui(ad, prouves) && annonceLbcEnVente(ad, vendues)) };
}
// Lit les annonces Leboncoin captées (ligne lbc_listings) sous forme de tableau.
async function readLbcItems() {
  try { return (await lireLbcAnnonces()).items; } catch (_) { return []; }
}
// Clés de rapprochement d'une annonce Leboncoin : sa référence pro (CustomRef),
// le VRM-xxx éventuel, et tout numéro « nXXXX » présent dans son titre.
// ⚠️ `liens` = `vrm_lbc_liens` (annonce LBC → N°), posé À LA MAIN dans l'app
// (« Relier », C4). Une identité qu'il pose lui-même ; l'app applique la même
// règle (`adKeys`), sinon l'app relie et le panneau ne relie pas (§11).
// ⚠️ LA REMISE À ZÉRO DES NUMÉROS (migration 013, 10 octobre) : une annonce
// Leboncoin qui portait un ancien numéro à la coupure (son IDENTIFIANT est dans
// `vrm_numerotation.lbcAnnonces`, posé par le serveur) parle de l'ANCIENNE
// paire — sa référence « 230 » est la B230, jamais la nouvelle 230. La MÊME
// règle que `clesAnnonceLbc` / `numeroExterne` dans l'app (§11) ; le lien posé
// À LA MAIN reste ce qu'il dit. Marqueur absent ou annulé : comme avant.
// Le marqueur garde, PAR ANNONCE, chaque numéro qu'elle portait à la coupure et
// ce qu'il devient ({ "<id>": { "553": "1", "266": "B266" } }) : un numéro donné
// après la coupure suit sa nouvelle paire, un numéro réécrit APRÈS se lit tel
// quel. La même règle que `traductionAnnonce` dans l'app et le serveur (§11).
function numeroLbcLu(k, ad, mk) {
  const arch = mk && typeof mk === 'object' && !mk.annule && /^[A-Z]{1,3}$/.test(String(mk.archive || '')) ? String(mk.archive) : '';
  if (!k || !arch || !/^\d+$/.test(k)) return k;
  const carte = mk.lbcAnnonces;
  if (!ad || ad.id == null || !carte || typeof carte !== 'object' || Array.isArray(carte)) return k;
  const e = carte[String(ad.id)];
  if (!e || typeof e !== 'object' || Array.isArray(e) || !Object.prototype.hasOwnProperty.call(e, k)) return k;
  return typeof e[k] === 'string' ? cleNum(e[k]) : '';
}
function adRefKeys(ad, liens, mk) {
  const keys = [];
  // Toutes les clés passent par `cleNum` — des deux côtés (`vintedKeys`).
  const push = (v) => { const t = cleNum(v); if (t && !keys.includes(t)) keys.push(t); };
  const ext = (v) => { const t = cleNum(v); if (t) push(numeroLbcLu(t, ad, mk)); };
  if (liens && ad && ad.id != null && liens[String(ad.id)] != null) push(liens[String(ad.id)]);
  if (ad.customRef) ext(refVRMDe(ad.customRef));
  if (ad.ref) ext(ad.ref);
  const t = String(ad.subject || '');
  let m = RE_VRM.exec(t); if (m) ext(m[1]);
  m = /\bn\s*°?\s*(\d{1,5})\b/i.exec(t); if (m) ext(m[1]);
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
// ⚠️⚠️ 5.169 (11 octobre) — LA PREUVE QUI MANQUAIT À L'ANTI DOUBLE VENTE.
// Plainte de Julien : « J'ai fait une vente hier, j'avais relié les deux paires,
// ça n'a pas retiré la paire sur eBay, ça ne m'a même pas proposé ». Mesuré en
// lecture seule : la N°553 (tx 23052006117, angeled92) n'avait AUCUNE ligne
// `harvest_*_txn_*` — elle n'arrive que quand la CONVERSATION de la vente est
// ouverte sur vinted.fr, geste que « Générer le bordereau » depuis l'app rend
// inutile. Sur 18 ventes en cours, 6 seulement étaient prouvées. Or
// l'extension avait LU la transaction pour le bordereau (21:55) et l'avait
// jetée. Trois voies, une règle (§11, la même dans `src/App.jsx`) :
//   · `recupererLabel` range la transaction qu'il lit (aucune requête de plus) ;
//   · `capterPreuvesVente` lit celle des ventes en cours qui n'ont rien ;
//   · le BORDEREAU (`harvest_{uid}_label_{tx}`, il porte l'annonce) prouve la
//     vente quand la transaction est LUE dans les ventes du même compte, ni
//     annulée ni revenue. ⚠️ Jamais `item_closing_action: 'sold'` seul : mesuré,
//     10 annonces « sold » n'ont que des transactions revenues.
// <preuve-vente-regle> — LA MÊME RÈGLE QUE L'APP (src/App.jsx), §11 ; comparées par
// `audit-preuve-vente.cjs` (texte ET sorties). Fonctions PURES.
const PREUVE_RECENTE_MS = 30 * 86400000;
// Une vente qui n'est pas REVENUE : son état ne l'annule pas, et Vinted ne la
// classe pas « en échec » (`failed` : remboursée, annulée).
function venteVivante(o) {
  if (!o || o.transaction_id == null) return false;
  if (PAS_UNE_VENTE.test(String(o.status || ''))) return false;
  return String(o.transaction_user_status || '') !== 'failed';
}
// Une vente EN COURS (à poster ou en route) : vivante, pas finalisée, de moins
// de 30 jours. C'est la fenêtre où une double vente peut encore arriver.
function venteEnCoursPreuve(o, maintenant) {
  if (!venteVivante(o)) return false;
  if (/finalis/i.test(String(o.status || '')) || String(o.transaction_user_status || '') === 'completed') return false;
  const d = Date.parse(o.date || '');
  return !(Number.isFinite(d) && maintenant - d > PREUVE_RECENTE_MS);
}
// La preuve par la TRANSACTION (ce qui existait) : l'annonce (`item_id`) et un
// état de commande qui ne la fait pas revenir. Une conversation (état vide)
// n'est pas une vente. Rend { items, tx } (annonces, transactions prouvées).
// ⚠️⚠️ (revue du 11 octobre) LA LIGNE `harvest_{uid}_txn_{tx}` EST UN
// INSTANTANÉ, JAMAIS RELU : celle que range le bordereau (5.169) dit « Bordereau
// envoyé au vendeur » pour toujours, même quand la vente finit remboursée — la
// paire, revenue chez lui, restait « vendue » (retrait d'eBay, file Leboncoin).
// Mesuré en production : 46 preuves à un état NON terminal, 5 contredites par
// leur vente (« Le paiement a été validé » / « Remboursement effectué », failed).
// ⇒ Un état non terminal ne prouve que si la vente `tx`, lue dans les ventes du
//   MÊME compte (relues à chaque visite), n'est pas revenue. Vente pas trouvée
//   dans les ventes lues : l'instantané est la seule information, il tient.
//   « Commande finalisée » est terminal : rien ne la fait revenir.
const ETAT_TXN_TERMINAL = /finalis/i;
function preuvesParTransaction(lignes, ventesParCompte) {
  const items = new Set(), tx = new Set();
  for (const r of (Array.isArray(lignes) ? lignes : [])) {
    if (!r || !r.it) continue;
    const etat = String(r.ti || '').trim();
    if (!etat || PAS_UNE_VENTE.test(etat)) continue;
    const id = String(r.id || '');
    const t = (/_txn_(\d+)$/.exec(id) || [])[1];
    const u = (/^harvest_(\d+)_txn_\d+$/.exec(id) || [])[1];
    if (u && t && ventesParCompte && !ETAT_TXN_TERMINAL.test(etat)) {
      const ventes = ventesParCompte[u];
      const o = Array.isArray(ventes) ? ventes.find((v) => v && String(v.transaction_id) === t) : null;
      if (o && !venteVivante(o)) continue;
    }
    items.add(String(r.it));
    if (t) tx.add(t);
  }
  return { items, tx };
}
// La preuve par le BORDEREAU : `harvest_{uid}_label_{tx}` porte l'annonce que
// l'extension a lue dans la transaction (une identité, §5). Elle ne vaut que si
// la vente `tx` est LUE dans les ventes du MÊME compte et qu'elle est vivante
// (mesuré : 4 bordereaux sur 71 finissent « Remboursement effectué »).
// `label_latest` (une copie) n'est jamais lu ; un `tx` de méta qui contredit
// l'identifiant de la ligne = doute ⇒ rien. `ventesParCompte` : { uid: [ventes] }
// — un compte absent n'a pas été lu ⇒ aucun de ses bordereaux ne prouve rien.
function preuvesParBordereau(bordereaux, ventesParCompte) {
  const items = new Set(), tx = new Set();
  for (const b of (Array.isArray(bordereaux) ? bordereaux : [])) {
    const m = /^harvest_(\d+)_label_(\d+)$/.exec(String((b && b.id) || ''));
    if (!m) continue;
    const t = m[2];
    if (b.tx != null && String(b.tx).trim() !== '' && String(b.tx).trim() !== t) continue;
    const it = String(b.it == null ? '' : b.it).trim();
    if (!/^\d+$/.test(it)) continue;
    const ventes = ventesParCompte ? ventesParCompte[m[1]] : null;
    if (!Array.isArray(ventes)) continue;
    const o = ventes.find((v) => v && String(v.transaction_id) === t);
    if (!o || !venteVivante(o)) continue;
    items.add(it); tx.add(t);
  }
  return { items, tx };
}
// Les comptes dont il faut LIRE les ventes : ceux qui portent un bordereau dont
// l'annonce n'est pas déjà prouvée par une transaction, et ceux dont une
// transaction ne prouve qu'un instantané (état non terminal, ci-dessus) — sa
// vente peut l'avoir dépassé. Le reste ne coûte rien.
function comptesAJuger(bordereaux, dejaProuves, transactions) {
  const out = [];
  for (const r of (Array.isArray(transactions) ? transactions : [])) {
    const m = /^harvest_(\d+)_txn_\d+$/.exec(String((r && r.id) || ''));
    const etat = String((r && r.ti) || '').trim();
    if (m && r.it && etat && !PAS_UNE_VENTE.test(etat) && !ETAT_TXN_TERMINAL.test(etat) && !out.includes(m[1])) out.push(m[1]);
  }
  for (const b of (Array.isArray(bordereaux) ? bordereaux : [])) {
    const m = /^harvest_(\d+)_label_(\d+)$/.exec(String((b && b.id) || ''));
    const it = String((b && b.it) == null ? '' : b.it).trim();
    if (m && /^\d+$/.test(it) && !(dejaProuves && dejaProuves.has(it)) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}
// Les ventes lues, par compte (`select=id,v:data->payload->my_orders`). Un
// compte demandé sans ligne n'a aucune vente captée : `[]`, rien n'est prouvé.
function ventesParCompteDe(lignes, uids) {
  const out = {};
  for (const u of (Array.isArray(uids) ? uids : [])) out[String(u)] = [];
  for (const r of (Array.isArray(lignes) ? lignes : [])) {
    const m = /^harvest_(\d+)_orders_sold$/.exec(String((r && r.id) || ''));
    if (m && Array.isArray(out[m[1]]) && Array.isArray(r.v)) out[m[1]] = out[m[1]].concat(r.v);
  }
  return out;
}
// </preuve-vente-regle>
async function lireVentesProuvees() {
  const rows = await sbGetTout('app_data?id=like.harvest_*_txn_*&select=id,it:meta->>item_id,ti:meta->>status_title');
  if (rows === null) return { echec: true, vendus: new Set() };
  // 5.169 : + le bordereau. Paginé (une ligne par vente, tous comptes) et
  // strict : une lecture ratée vaut « pas su », jamais une demi-preuve.
  const bords = await sbGetTout('app_data?id=like.harvest_*_label_*&select=id,tx:meta->>tx,it:meta->>item');
  if (bords === null) return { echec: true, vendus: new Set() };
  // (revue du 11 octobre) + les ventes des comptes dont une transaction ne
  // prouve qu'un instantané (état non terminal) : la vente, relue à chaque
  // visite, prime — une vente remboursée ne garde pas sa paire « vendue ».
  const uids = comptesAJuger(bords, preuvesParTransaction(rows).items, rows);
  let parCompte = {};
  if (uids.length) {
    const lignes = await sbGet(`app_data?id=in.(${uids.map((u) => `harvest_${u}_orders_sold`).join(',')})&select=id,v:data->payload->my_orders`);
    if (!Array.isArray(lignes)) return { echec: true, vendus: new Set() };
    parCompte = ventesParCompteDe(lignes, uids);
  }
  const vendus = new Set(preuvesParTransaction(rows, parCompte).items);
  for (const it of preuvesParBordereau(bords, parCompte).items) vendus.add(it);
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
  // 5.167 (11 octobre) : seulement ce qui est EN LIGNE d'après la lecture la plus
  // récente de chaque compte — sans les supprimées, sans celles qu'une lecture
  // publique plus récente ne montre plus, et sans celles « à confirmer ».
  const enl = await lireDressingsEnLigne();
  if (enl.echec) return { queue: [], retirees: 0, vendues: 0, aConfirmer: 0, preuveKO: false, lecturesKO: true, postedCount: posted.size, echec: pos.echec };
  const listRows = enl.lignes;
  let aConfirmer = 0;
  for (const [u, l] of enl.aConfirmer) if (!off.has(String(u))) aConfirmer += l.length;
  const itemRows = (await sbGetTout('app_data?id=like.harvest_*_item_*&select=id,data')) || []; // §4.5 : une ligne par annonce, tous comptes → dépasse 1000 chez un vendeur actif, sbGet tronquait
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
  return { queue, retirees, vendues, aConfirmer, preuveKO: preuve.echec, postedCount: posted.size, echec: pos.echec };
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
  // Annonces EN LIGNE d'après la lecture la plus récente de chaque compte
  // (5.167, `lireDressingsEnLigne`) — sans les supprimées, sans celles qu'une
  // lecture publique plus récente ne montre plus. Celles « à confirmer » (compte
  // pas relu depuis 24 h) ne sont ni dans la file, ni « à retirer de Leboncoin » :
  // on ne sait pas, on ne dit rien.
  const enl = await lireDressingsEnLigne();
  // Ses annonces Vinted n'ont pas pu être lues : ni file, ni « à retirer » — on le dit.
  if (enl.echec) return { queue: [], removals: [], unlinked: [], postedList: [],
    stats: { postedCount: [...posted].filter((x) => /^\d+$/.test(x)).length, lecturesKO: true, preuveKO: false, aConfirmer: 0, onlineCount: 0, queueCount: 0, limit: lbcLimit, plan: lbcPlan } };
  const listRows = enl.lignes;
  const aConfirmerIds = new Set();
  for (const [u, l] of enl.aConfirmer) if (!off.has(String(u))) for (const it of l) if (it && it.id != null) aConfirmerIds.add(String(it.id));
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
  const itemRows = (await sbGetTout('app_data?id=like.harvest_*_item_*&select=id,data')) || []; // §4.5 : une ligne par annonce, tous comptes → dépasse 1000 chez un vendeur actif, sbGet tronquait
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
    if (LBC_ANNONCE_MORTE.test(String(ad.status || ''))) continue;
    for (const k of adRefKeys(ad, liens, main.vrm_numerotation)) if (!lbcByRef.has(k)) lbcByRef.set(k, ad);
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
    // La localisation que le vendeur a renseignée dans VRM (Réglages → ville).
    queue.push({ ...buildLbcAd(o.raw, details[o.id] || {}, num, uid2login[o.uid]), ville: String(main.vrm_ville || '').trim() });
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
    if (aConfirmerIds.has(pid)) continue;              // à confirmer : on ne sait pas, on n'alerte pas
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
    // Une paire « à confirmer » n'est pas « plus en ligne » : on ne sait pas.
    for (const [u, l] of enl.aConfirmer) {
      if (off.has(String(u))) continue;
      for (const it of l) { const e = numeros[String(it.id)]; for (const k of vintedKeys({ raw: it }, e && e.numero)) keysOnline.add(k); }
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
      if (LBC_ANNONCE_MORTE.test(String(ad.status || ''))) continue;
      const keys = adRefKeys(ad, liens, main.vrm_numerotation);
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
    const lu = await lireLbcAnnonces();
    if (lu.ok) {                                  // `ok:false` = la base n'a pas répondu
      // ⚠️ « jamais capté » veut dire : aucune annonce QUI SOIT À LUI. La ligne
      //    peut exister et ne contenir que des annonces d'autres (les 81 du
      //    13 septembre) — auquel cas on n'a toujours rien vu de son côté, et
      //    afficher « 0 » serait le zéro inventé qu'on vient de retirer.
      lbcJamaisLu = !lu.ligne;
      // ⚠️ 81 annonces rangées le 13 septembre n'étaient PAS à lui (le flux
      //    « découverte » de la page). Elles restent en base — on ne supprime
      //    rien — mais elles ne COMPTENT pas : une annonce qu'on ne peut pas
      //    lui attribuer n'est pas la sienne.
      // ⚠️ LA MÊME règle que `readLbcItems` (`estALui`), pas une copie qui dérive :
      //    celle-ci oubliait `customRef`, que l'app accepte — un troisième écart
      //    sur la même notion.
      lbcCount = lu.items.filter((v) => !LBC_ANNONCE_MORTE.test(String(v.status || ''))).length;
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
  const stats = { postedCount, lbcCount, lbcJamaisLu, preuveKO: preuveLbc.echec, limit: lbcLimit, plan: lbcPlan, detected, exclues, aConfirmer: aConfirmerIds.size, onlineCount: online.length, numberedCount: numberedOnline, queueCount: queue.length,
    autoMatched: autoMatched.size, lbcSeen: lbcItems.length, unlinkedCount: unlinked.length };
  // Liste des paires marquées « publiées » (pour pouvoir annuler une erreur).
  const postedList = [...posted].filter((x) => /^\d+$/.test(x)).map((pid) => { const e = numeros[pid] || {}; return { id: pid, numero: String(e.numero || '?'), title: e.title || '' }; }).sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0));
  return { queue, removals, unlinked, stats, postedList };
}
// Un accusé porte le résultat d'une écriture de données, pas d'un compteur.
async function noterReceptionLbc(famille,resultat,sender){
  const tab=sender?.tab?.id;if(tab==null||sender?.frameId>0||!['annonces','transactions'].includes(famille))return;
  try{const cartes=(await chrome.storage.local.get('vrmLbcTransport')).vrmLbcTransport||{},avant=cartes[tab]||{};
    const etats=['enregistre','liste-vide','compte-non-confirme','aucune-annonce-reconnue','format-non-reconnu','ecriture-refusee','lecture-refusee','partiel'];
    const etat=etats.includes(resultat?.etat)?resultat.etat:'format-non-reconnu';
    cartes[tab]={...avant,receptions:{...(avant.receptions||{}),[famille]:{etat,nombre:Math.max(0,Math.min(10000,Number(resultat?.nombre)||0)),photos:Math.max(0,Math.min(10000,Number(resultat?.photos)||0)),at:Date.now()}},at:Date.now()};
    await chrome.storage.local.set({vrmLbcTransport:Object.fromEntries(Object.entries(cartes).sort((a,b)=>b[1].at-a[1].at).slice(0,32))});
  }catch(_){}
}
// Range TES annonces Leboncoin captées passivement dans une ligne dédiée. On
// fusionne (par id) avec ce qui est déjà connu → l'historique se complète au fil
// de ta navigation, sans écraser. Sert au dispatcher LBC→Vinted + synchro inverse.
function photosAnnonceLbc(node){
  const images=node?.images;
  const candidats=[images?.urls,images?.urls_large,images?.thumb_urls,images?.urls_thumb,Array.isArray(images)?images:null,node?.image_urls,node?.ImageSmall];
  const out=[];
  for(const valeur of candidats){for(const item of Array.isArray(valeur)?valeur:[valeur]){
    const brut=typeof item==='string'?item:item?.url||item?.url_large||item?.large||item?.thumbnail;
    if(typeof brut!=='string')continue;
    try{const u=new URL(brut);if(u.protocol!=='https:'||u.username||u.password||!/(^|\.)leboncoin\.fr$/i.test(u.hostname))continue;if(!out.includes(u.href))out.push(u.href);}catch(_){}
    if(out.length>=20)return out;
  }}return out;
}
// ⚠️ (22 oct.) TROIS ÉCRIVAINS DE `lbc_listings` — les annonces vues, la liste
//    complète d'un compte (`noterListeLbcComplete`) et la mise en pause
//    (`noterPauseLbc`) — chacun en lire-fusionner-réécrire. Ils passent par la
//    MÊME file que `storeLbcListings` : deux écritures proches repartaient sinon
//    de la même lecture, et la seconde effaçait la première (une annonce marquée
//    « plus vue » redevenait muette). Une étape qui lève n'arrête pas la suite.
let _chainestoreLbcListings=Promise.resolve();
function enChaineLbcListings(fn){
  const p=_chainestoreLbcListings.then(fn,fn);
  _chainestoreLbcListings=p.catch(()=>{});return p;
}
async function storeLbcListings(url, listings,ownerAttendu=null){
  const owner=ownerAttendu||(await loadSession())?.user_id;
  if(!owner)return {ok:false,etat:'ecriture-refusee'};
  return enChaineLbcListings(()=>storeLbcListingsUneFois(url, listings,owner));
}
async function storeLbcListingsUneFois(url, listings,owner) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_listings&select=data');
    // ⚠️ « RIEN LU » NE VAUT PAS « RIEN ». `sbGet` rend `null` quand la base n'a
    //    pas répondu : repartir de `{}` réécrirait la ligne avec la seule annonce
    //    du moment, et effacerait tout l'historique de ses annonces Leboncoin.
    //    Le cas qui détruit n'est pas la panne totale (l'écriture échoue aussi),
    //    c'est LECTURE KO / ÉCRITURE OK — un simple timeout.
    if (prevRows === null) return {ok:false,etat:'lecture-refusee'};
    const prev = (prevRows[0] && prevRows[0].data && prevRows[0].data.items) || {};
    const merged = Object.assign({}, prev);
    for (const l of listings) { if (l && l.id) {
      const ancien=merged[String(l.id)]||{};
      const images=photosAnnonceLbc(l);
      const n=Object.assign({},ancien,l,{images:images.length?images:photosAnnonceLbc(ancien),seenAt:new Date().toISOString()});
      // ⚠️ (22 oct., revue) LA CAPTURE LA PLUS RÉCENTE GAGNE : revue maintenant,
      //    elle n'est plus « plus vue » ; une pause posée d'ici il y a plus d'une
      //    heure est levée (sa page la remontre). La MÊME borne que la règle
      //    partagée (`lbcSortieDe`) : une pause de moins d'une heure reste (index
      //    en retard). Sinon ces marques survivaient à `Object.assign` et
      //    l'annonce, revue active, restait hors de « en vente ».
      delete n.plusVueAt;
      if(n.pauseAt&&!(Date.now()-Date.parse(n.pauseAt)<=LBC_PAUSE_INDEX_MS)){delete n.pauseAt;delete n.pauseStatut;}
      merged[String(l.id)]=n;
    } }
    // (22 oct.) On garde les autres clés de la ligne — `lectures`, la date de la
    // dernière liste COMPLÈTE de chaque compte — : réécrire `{items,…}` seul les
    // effaçait à chaque annonce vue.
    const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_listings', data: Object.assign({}, (prevRows[0] && prevRows[0].data) || {}, { items: merged, updatedAt: new Date().toISOString(), lastUrl: url }) }], 'id',owner);
    await noterFlux('leboncoin', _okFlux === true);
    if(_okFlux===true)notifierApp({type:'maj',quoi:'lbc'});
    return {ok:_okFlux===true,etat:_okFlux===true?'enregistre':'ecriture-refusee',nombre:listings.length,photos:listings.filter(l=>photosAnnonceLbc(merged[String(l.id)]).length>0).length};
  } catch (_) {return {ok:false,etat:'ecriture-refusee'};}
}
// ══════════════════════════════════════════════════════════════════════════
// LA LISTE COMPLÈTE D'UN COMPTE LEBONCOIN (22 octobre — proposition 14)
// ══════════════════════════════════════════════════════════════════════════
// Mesuré (lecture seule, sa base) : 11 annonces à son nom, toutes « active » ;
// 4 revues le 22 octobre, 7 jamais revues depuis le 20 septembre — 3 vendues,
// 4 très probablement supprimées par lui le 10 octobre (`lbc_recon.envois` porte
// son `DELETE …/manual/delete/ads`). Rien ne marquait une annonce ABSENTE :
// `storeLbcListings` ne fait que fusionner ce qu'il voit. Deux d'entre elles
// demandaient « quelle paire ? » — relier une annonce morte à une paire vivante.
// ⇒ La page (`lbc-inject.js`) n'envoie `lbcListeComplete` que pour une liste
//   PROUVÉE complète : `adfinder/v2/owner_listing` filtré sur le SEUL vendeur,
//   le total annoncé atteint (toutes les pages), chaque annonce à ce vendeur.
//   Ici : le vendeur doit être un de SES comptes ; chacune de ses annonces
//   rangées qui n'y figure pas reçoit `plusVueAt` — un ÉTAT : jamais une
//   suppression, jamais « vendue », jamais « supprimée » (pause, suppression,
//   vente : on ne sait pas laquelle). Une liste complète qui la remontre
//   l'efface. Lecture ratée ⇒ rien n'est écrit (« rien lu » ne vaut pas « rien »).
// Une pause acceptée depuis VRM (`pauseAt`) n'est effacée par une liste complète
// qui la montre encore qu'au-delà d'une heure : l'index de recherche de
// Leboncoin peut avoir du retard (non mesuré — borne prudente). La borne
// (`LBC_PAUSE_INDEX_MS`) vit dans la règle partagée `<lbc-en-vente-regle>`.
// ⚠️ (22 oct., revue) Et l'inverse : une annonce VUE il y a moins d'une heure
// (sa page « Mes annonces », une autre réponse) n'est pas jugée absente par une
// liste publique — l'index peut ne pas encore montrer une annonce publiée le
// matin. Une « plus vue » levée depuis (capture plus récente) est reposée.
// Le compte d'une annonce s'écrit de deux façons : l'identifiant nu (captures
// d'avant) ou `lbc-account:{id}` (la source privée, depuis le 22 octobre). Une
// seule identité : on compare sans le préfixe.
const idCompteLbc = (x) => String(x || '').replace(/^lbc-account:/i, '');
async function noterListeLbcComplete(owner, ids, total) {
  owner = idCompteLbc(owner);
  return enChaineLbcListings(async () => {
    try {
      const rows = await sbGet('app_data?id=eq.lbc_listings&select=data');
      if (rows === null) { noterDiag('lbc_liste_complete_lecture_ratee'); return { ok: false, code: 'lecture' }; }
      const data = (rows[0] && rows[0].data) || {};
      const items = Object.assign({}, data.items || {});
      const vus = new Set(ids.map(String));
      const maintenant = Date.now(), nowIso = new Date(maintenant).toISOString();
      let sortent = 0, reviennent = 0;
      for (const [id, ad] of Object.entries(items)) {
        if (!ad || typeof ad !== 'object') continue;
        if (idCompteLbc(ad.account || ad.lbcUser) !== owner) continue;
        if (vus.has(String(id))) {
          const n = Object.assign({}, ad); let change = false;
          if (n.plusVueAt) { delete n.plusVueAt; change = true; }
          if (n.pauseAt && maintenant - Date.parse(n.pauseAt) > LBC_PAUSE_INDEX_MS) { delete n.pauseAt; delete n.pauseStatut; change = true; }
          if (change) { items[id] = n; reviennent++; }
        } else if (lbcSortieDe(ad) !== 'plusvue') {
          const vu = Date.parse(ad.seenAt || '');
          if (isFinite(vu) && maintenant - vu < LBC_PAUSE_INDEX_MS) continue;
          items[id] = Object.assign({}, ad, { plusVueAt: nowIso }); sortent++;
        }
      }
      const lectures = Object.assign({}, data.lectures || {});
      const avant = lectures[owner];
      lectures[owner] = { at: nowIso, total, n: ids.length };
      // Rien ne change et la dernière lecture complète date de moins d'une heure :
      // on ne réécrit pas 230 Ko pour une date (§4.4).
      if (!sortent && !reviennent && avant && maintenant - Date.parse(avant.at || 0) < 3600e3 && avant.total === total) return { ok: true, sortent, reviennent, ecrit: false };
      const ok = await supabaseUpsert('app_data', [{ id: 'lbc_listings', data: Object.assign({}, data, { items, lectures, updatedAt: nowIso }) }], 'id');
      noterDiag(ok === false ? 'lbc_liste_complete_ecriture_ratee' : 'lbc_liste_complete');
      if (ok !== false && (sortent || reviennent)) { try { notifierApp({ type: 'maj', quoi: 'lbc' }); } catch (_) {} }
      return { ok: ok !== false, sortent, reviennent, ecrit: ok !== false };
    } catch (_) { return { ok: false, code: 'erreur' }; }
  });
}
// Après une mise en pause que Leboncoin a ACCEPTÉE (réponse 2xx) : l'état, sur
// l'annonce. Lecture ratée ⇒ rien n'est écrit, et l'app le dit (`note:false`).
async function noterPauseLbc(id, statut) {
  return enChaineLbcListings(async () => {
    try {
      const rows = await sbGet('app_data?id=eq.lbc_listings&select=data');
      if (rows === null) return false;
      const data = (rows[0] && rows[0].data) || {};
      const items = Object.assign({}, data.items || {});
      if (!items[id]) return false;
      items[id] = Object.assign({}, items[id], { pauseAt: new Date().toISOString(), pauseStatut: statut });
      const ok = await supabaseUpsert('app_data', [{ id: 'lbc_listings', data: Object.assign({}, data, { items, updatedAt: new Date().toISOString() }) }], 'id');
      return ok !== false;
    } catch (_) { return false; }
  });
}
// ══════════════════════════════════════════════════════════════════════════
// METTRE EN PAUSE UNE ANNONCE LEBONCOIN, SUR SON CLIC (22 octobre — proposition 6)
// ══════════════════════════════════════════════════════════════════════════
// La N°18, vendue sur Vinted le 18 octobre, était encore en ligne sur Leboncoin
// 4 jours après : VRM disait « à retirer de Leboncoin » avec un simple lien.
// ⚠️ La requête n'est PAS devinée : l'extension l'a VUE dans ses propres gestes
//    (`lbc_recon.envois`, 23 septembre, 5.106) — `PUT api.leboncoin.fr/api/
//    pintad/v1/public/manual/pause/ads`, corps `{list_ids:[nombre]}`. Ni sa
//    réponse, ni ses en-têtes n'ont été vus : le premier clic est une MESURE,
//    la réponse de Leboncoin est rendue telle quelle, et un refus dit « pas fait ».
// Garde-fous : sur SON clic (l'app confirme en nommant l'annonce) · l'annonce
// est relue EN BASE (l'app n'envoie qu'un identifiant) · elle doit être sur le
// compte Leboncoin CONNECTÉ dans l'onglet (l'identité privée que la page a lue,
// `vrmLbcTransport`) · UNE à la fois · 10 par heure · une PAUSE, jamais une
// suppression (§3) · la requête part de la page leboncoin.fr (avec les en-têtes
// du site), adresse exacte écrite en dur dans `lbc-inject.js` : rien d'autre ne
// passe par cet ordre.
const LBC_PAUSE_MAX_HEURE = 10;
const LBC_PAUSE_ATTENTE_SESSION_MS = 20000;
let PAUSE_LBC_EN_VOL = false;
const nomCompteLbc = (accs, id) => { const a = accs && (accs['lbc-account:' + id] || accs[id]); return (a && a.name) || ''; };
async function ongletLbcDuCompte(compte) {
  const voulu = 'lbc-account:' + compte;
  let cartes = {};
  try { cartes = (await chrome.storage.local.get('vrmLbcTransport')).vrmLbcTransport || {}; } catch (_) { return { ok: false, code: 'lecture', raison: "le stockage de l'extension n'a pas répondu — rien n'est parti" }; }
  const autres = [];
  const ordre = Object.entries(cartes).sort((a, b) => (((b[1] && b[1].at) || 0) - ((a[1] && a[1].at) || 0)));
  for (const [tid, c] of ordre) {
    if (!c || c.source !== 'prive' || c.ambigue || !c.compte) continue;
    let tab = null; try { tab = await chrome.tabs.get(Number(tid)); } catch (_) { tab = null; }
    if (!tab || !/^https:\/\/(?:[a-z0-9-]+\.)*leboncoin\.fr\//i.test(tab.url || '')) continue;
    if (c.compte === voulu) return { ok: true, tabId: Number(tid) };
    autres.push(String(c.compte).replace(/^lbc-account:/, ''));
  }
  return { ok: false, autres };
}
async function attendreSessionOnglet(tabId, ms) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 500));
    try { const c = ((await chrome.storage.local.get('vrmLbcTransport')).vrmLbcTransport || {})[tabId]; if (c && c.source === 'prive') return c; } catch (_) {}
  }
  return null;
}
async function pauseLbcDepuisApp(msg) {
  const id = String((msg && msg.id) || '');
  if (!/^\d{6,12}$/.test(id)) return { accepte: false, code: 'invalide', raison: 'annonce inconnue' };
  if (PAUSE_LBC_EN_VOL) return { accepte: false, code: 'en-cours', raison: 'une autre mise en pause est en cours — une à la fois' };
  PAUSE_LBC_EN_VOL = true;
  let ouvert = null;
  try {
    let journal;
    try { journal = ((await chrome.storage.local.get('vrmLbcPauses')).vrmLbcPauses || []).filter((t) => Date.now() - Number(t) < 3600e3); } catch (_) { return { accepte: false, code: 'lecture', raison: "le stockage de l'extension n'a pas répondu — rien n'est parti" }; }
    if (journal.length >= LBC_PAUSE_MAX_HEURE) return { accepte: false, code: 'plafond', raison: `déjà ${LBC_PAUSE_MAX_HEURE} mises en pause cette heure-ci — réessaie plus tard` };
    // L'annonce, relue EN BASE (l'app n'envoie qu'un identifiant, jamais un compte).
    const [rows, accRows] = await Promise.all([
      sbGet(`app_data?id=eq.lbc_listings&select=a:data->items->${id}`),
      sbGet('app_data?id=eq.lbc_accounts&select=a:data->accounts'),
    ]);
    if (rows === null) return { accepte: false, code: 'lecture', raison: "la base VRM n'a pas répondu — rien n'est parti chez Leboncoin" };
    const ad = rows[0] && rows[0].a;
    if (!ad || typeof ad !== 'object') return { accepte: false, code: 'inconnue', raison: "cette annonce n'est pas parmi tes annonces Leboncoin captées — rien n'est parti" };
    const compte = idCompteLbc(ad.account || ad.lbcUser);
    if (!/^[0-9a-f-]{8,64}$/i.test(compte)) return { accepte: false, code: 'compte', raison: "je ne sais pas sur quel compte Leboncoin est cette annonce — rien n'est parti" };
    const accs = (accRows && accRows[0] && accRows[0].a) || {};
    const nom = nomCompteLbc(accs, compte) || 'le compte de cette annonce';
    const autreCompte = (autre) => ({ accepte: false, code: 'autre-compte', raison: `Leboncoin est connecté sur ${nomCompteLbc(accs, autre) || 'un autre compte'} dans ce Chrome, l'annonce est sur ${nom} — connecte-toi sur ${nom}, puis réessaie` });
    let o = await ongletLbcDuCompte(compte);
    if (!o.ok && o.code) return { accepte: false, code: o.code, raison: o.raison };
    if (!o.ok && o.autres && o.autres.length) return autreCompte(o.autres[0]);
    if (!o.ok) {
      // Aucun onglet Leboncoin connu : on en ouvre UN, en arrière-plan, et on
      // attend que la page dise quel compte est connecté. Rien n'est envoyé avant.
      try { ouvert = await chrome.tabs.create({ url: 'https://www.leboncoin.fr/compte/part/mes-annonces', active: false }); } catch (_) { ouvert = null; }
      if (!ouvert || ouvert.id == null) return { accepte: false, code: 'lbc-absent', raison: `ouvre leboncoin.fr dans ce Chrome, connecté sur ${nom}, puis réessaie` };
      const c = await attendreSessionOnglet(ouvert.id, LBC_PAUSE_ATTENTE_SESSION_MS);
      if (!c || c.ambigue || !c.compte) return { accepte: false, code: 'session', raison: `Leboncoin ne m'a pas dit quel compte est connecté — ouvre leboncoin.fr connecté sur ${nom}, puis réessaie` };
      if (c.compte !== 'lbc-account:' + compte) return autreCompte(String(c.compte).replace(/^lbc-account:/, ''));
      o = { ok: true, tabId: ouvert.id };
    }
    // L'ordre part : il compte dans le plafond, quoi qu'il arrive ensuite.
    try { await chrome.storage.local.set({ vrmLbcPauses: [...journal, Date.now()] }); } catch (_) {}
    let rep = null;
    try { rep = await avecDelai(chrome.tabs.sendMessage(o.tabId, { from: 'vrm-fond', action: 'lbcPauseAnnonce', id }, { frameId: 0 }), 25000, null); } catch (_) { rep = null; }
    const statut = (rep && Number(rep.statut)) || 0;
    const reponse = rep && typeof rep.corps === 'string' ? rep.corps.slice(0, 300) : '';
    // La FORME de la réponse (clés et types, jamais une valeur) : la passe suivante saura.
    try { await storeLbcRecon({ envoiOne: { cle: 'VRM PUT api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads', val: { at: new Date().toISOString(), ver: EXT_VERSION, methode: 'PUT', cles: ['list_ids[]:number'], reponse: { statut, cles: (rep && Array.isArray(rep.cles)) ? rep.cles.slice(0, 60) : [], entetes: (rep && Number(rep.entetes)) || 0 } } } }); } catch (_) {}
    if (rep && rep.ok === true && rep.erreur === 'en-cours') return { accepte: false, code: 'en-cours', raison: 'une autre mise en pause est en cours dans cet onglet' };
    if (!rep || rep.ok !== true || !statut) {
      noterDiag('lbc_pause_incertain');
      return { accepte: true, etape: 'incertain', statut, raison: "l'onglet Leboncoin n'a pas répondu — je ne sais pas si la pause est partie : regarde l'annonce sur Leboncoin" };
    }
    noterDiag('lbc_pause_' + statut);
    if (statut >= 200 && statut < 300) {
      const note = await noterPauseLbc(id, statut);
      try { notifierApp({ type: 'maj', quoi: 'lbc' }); } catch (_) {}
      return { accepte: true, etape: 'fait', statut, reponse, note };
    }
    return { accepte: true, etape: 'refuse', statut, reponse };
  } finally {
    PAUSE_LBC_EN_VOL = false;
    if (ouvert && ouvert.id != null) { try { await chrome.tabs.remove(ouvert.id); } catch (_) {} }
  }
}
// COMPTES LEBONCOIN connectes. Julien en a plusieurs : on garde la liste des
// comptes reellement vus dans le navigateur, avec la date de derniere vue. L'app
// s'en sert pour dire depuis quel compte publier, et pour repartir les annonces.
// ── LA MESSAGERIE LEBONCOIN : LE NOMBRE DE NON-LUS, PAR COMPTE (4 octobre) ──
// Une ligne dédiée, `lbc_messages` : `compteurs[userId] = {unread, at}` et
// `comptes[id] = {name, pro, at}`. Lire-fusionner-réécrire : une lecture ratée
// (`null`) n'écrit RIEN (elle effacerait les autres comptes — la famille de
// « rien lu ne vaut pas rien »). La page recharge le compteur en continu : on
// n'écrit que si le nombre change, ou pour rafraîchir sa date toutes les 10 min.
// ── VESTIAIRE : RANGER LA MESURE DANS `vc_recon` ─────────────────────────────
// Lire-fusionner-réécrire, gardé : une lecture ratée (`null`) n'écrit RIEN.
// Chaque morceau est borné (300 chemins, 60 pages, 40 hôtes, 60 schémas) et un
// schéma n'est jamais remplacé par une version plus pauvre. Les SCALAIRES de tête
// (nChemins, nPages, nSchemas, vuAt, ver) passent dans la colonne `meta` : l'app
// les lit sans rapatrier la ligne (§4.4).
// ⚠️ La page relève en continu : un mémo LOCAL (chrome.storage.local — jamais une
//    variable de module, §4.9) retient ce qui a déjà été envoyé, et un envoi sans
//    rien de neuf ne lit ni n'écrit la base.
async function storeVcRecon(patch) {
  try {
    const sig = (x) => String(x).slice(0, 220);
    const neuf = [];
    for (const c of (patch.chemins || [])) neuf.push('c:' + sig(c));
    for (const pg of (patch.pages || [])) neuf.push('p:' + sig(pg));
    for (const h of Object.keys(patch.hotes || {})) neuf.push('h:' + sig(h));
    for (const e of Object.keys(patch.schemas || {})) neuf.push('s:' + sig(e) + ':' + ((patch.schemas[e] || []).length));
    let connu = {};
    try { connu = (await chrome.storage.local.get('vrmVcConnu')).vrmVcConnu || {}; } catch (_) {}
    const nouveaux = neuf.filter((k) => !connu[k]);
    if (!nouveaux.length) return;
    const rows = await sbGet('app_data?id=eq.vc_recon&select=data');
    if (rows === null) return;                      // pas su ≠ vide : on n'écrit pas
    const cur = (rows[0] && rows[0].data) || {};
    const chemins = [...new Set([...(cur.chemins || []), ...(patch.chemins || [])])].slice(-300);
    const pages = [...new Set([...(cur.pages || []), ...(patch.pages || [])])].slice(-60);
    const hotes = Object.assign({}, cur.hotes || {});
    for (const [h, n] of Object.entries(patch.hotes || {})) if (Object.keys(hotes).length < 40 || hotes[h] != null) hotes[h] = Math.max(Number(hotes[h]) || 0, Number(n) || 0);
    const schemas = Object.assign({}, cur.schemas || {});
    for (const [e, cles] of Object.entries(patch.schemas || {})) {
      if (!Array.isArray(cles)) continue;
      if (!schemas[e] && Object.keys(schemas).length >= 60) continue;
      if (!schemas[e] || (schemas[e].cles || []).length < cles.length) schemas[e] = { cles: cles.slice(0, 200), at: new Date().toISOString() };
    }
    const now = new Date().toISOString();
    const data = Object.assign({}, cur, {
      nChemins: chemins.length, nPages: pages.length, nSchemas: Object.keys(schemas).length, nHotes: Object.keys(hotes).length,
      vuAt: now, ver: EXT_VERSION, nextData: !!(patch.nextData || cur.nextData), nextFlux: !!(patch.nextFlux || cur.nextFlux),
      chemins, pages, hotes, schemas,
    });
    const ok = await supabaseUpsert('app_data', [{ id: 'vc_recon', data }], 'id');
    noterFlux('vestiaire', ok !== false);
    if (ok !== false) {
      for (const k of nouveaux) connu[k] = 1;
      const cles = Object.keys(connu); if (cles.length > 900) for (const k of cles.slice(0, cles.length - 900)) delete connu[k];
      try { await chrome.storage.local.set({ vrmVcConnu: connu }); } catch (_) {}
    }
  } catch (_) {}
}
async function storeLbcMessages(patch) {
  try {
    const rows = await sbGet('app_data?id=eq.lbc_messages&select=data');
    if (rows === null) return;
    const cur = (rows[0] && rows[0].data) || {};
    const compteurs = Object.assign({}, cur.compteurs || {});
    const comptes = Object.assign({}, cur.comptes || {});
    const now = new Date().toISOString();
    let change = false;
    if (patch.compteur) {
      const id = String(patch.compteur.userId || '');
      const n = Math.max(0, Math.min(99999, Math.round(Number(patch.compteur.unread) || 0)));
      const avant = compteurs[id];
      if (id && (!avant || avant.unread !== n || Date.now() - Date.parse(avant.at || 0) > 10 * 60e3)) { compteurs[id] = { unread: n, at: now }; change = true; }
    }
    for (const c of (patch.comptes || [])) {
      const id = String((c && c.id) || ''); if (!id) continue;
      const avant = comptes[id] || {};
      const nom = String(c.name || '').slice(0, 60), pro = !!c.pro;
      if (avant.name !== nom || avant.pro !== pro || Date.now() - Date.parse(avant.at || 0) > 6 * 3600e3) { comptes[id] = { name: nom, pro, at: now }; change = true; }
    }
    if (!change) return;
    const ok = await supabaseUpsert('app_data', [{ id: 'lbc_messages', data: { compteurs, comptes, updatedAt: now, ver: EXT_VERSION } }], 'id');
    noterFlux('leboncoin', ok !== false);
  } catch (_) {}
}
let _chainestoreLbcAccount=Promise.resolve();
async function storeLbcAccount(acc,ownerAttendu=null){
  const owner=ownerAttendu||(await loadSession())?.user_id;
  if(!owner)return false;
  const p=_chainestoreLbcAccount.then(()=>storeLbcAccountUneFois(acc,owner));
  _chainestoreLbcAccount=p.catch(()=>{});return p;
}
async function storeLbcAccountUneFois(acc,owner) {
  try {
    const prevRows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
    if (prevRows === null) {await noterFlux('leboncoin',false);return false;}                 // pas su ≠ aucun compte (voir storeLbcListings)
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
      if (s && LBC_URL_AUTRUI.test(String(s)) && !merged[id].sessionAt) delete merged[id];
    }
    { const { courant: _c, session: _s, ...sansCourant } = acc; const nowIso = new Date().toISOString();
      const ancien = merged[String(acc.id)] || {};
      // Une entrée de SESSION garde sa source d'avant si elle en avait une « moi »
      // (on ne remplace pas un nom lu par une source sans nom).
      merged[String(acc.id)] = Object.assign({}, ancien, sansCourant, { seenAt: nowIso }, acc.session === true ? { sessionAt: nowIso } : {}); }
    // Le compte Leboncoin CONNECTÉ, gardé dans le navigateur : la petite carte
    // de l'extension le nomme sans relire la base. Seulement sur un endpoint
    // « moi » (jamais la fiche d'autrui — même règle que la détection, §11).
    const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_accounts', data: { accounts: merged, updatedAt: new Date().toISOString() } }], 'id',owner);
    await noterFlux('leboncoin', _okFlux === true);
    if(_okFlux===true&&(await loadSession())?.user_id===owner){
    try {
      if (acc.courant === true && acc.source && !LBC_URL_AUTRUI.test(String(acc.source))) {
        await chrome.storage.local.set({ vrmLbcCompte: { v: 2, id: String(acc.id), name: String(acc.name || ''), type: acc.type || '', source:acc.source||'', at: Date.now() } });
      }
    } catch (_) {}
    }

    return _okFlux === true;
  } catch (_) {await noterFlux('leboncoin',false);return false;}
}
// ══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ LE COMPTE LEBONCOIN CONNECTÉ, ENFIN LU (20 octobre, 5.195). Julien : « il
//    capte pas les bonnes données ni le bon compte ». MESURÉ sur sa base (lecture
//    seule) : il a DEUX comptes Leboncoin — `Totomondu` (8442c3e8…, particulier,
//    ses 10 annonces de baskets) et `SHOPCANCALE` (faf3fbba…, pro). Connecté sur
//    Totomondu à 11:14, la base disait « SHOPCANCALE, particulier » :
//    · `members/me/account` (la seule source « session » de la 5.186) a la forme
//      `{account:{account_id,type}, member:{account_id, first_name, nickname:{value}}}`
//      — aucun couple id + nom que `detectLbcAccount` sache lire : le compte de
//      session n'a JAMAIS été reconnu, donc `vrmLbcCompte` jamais posé, donc
//      « mes annonces » (`myads`) jamais rangées sans réf VRM ;
//    · `users/me/linked_accounts` liste les AUTRES comptes liés (connecté sur
//      Totomondu, il rend SHOPCANCALE seul), et `is_business_user` n'était pas lu
//      ⇒ SHOPCANCALE rangé « particulier » alors qu'il est pro.
// ⇒ L'identité de la session : le compteur de messagerie
//   `messaging/proxy/api/hal/{userId}/counter` — la page ne le relit QUE pour le
//   compte connecté (mesuré : 8442c3e8 à 11:16, pendant que linked_accounts
//   listait faf3fbba ; et le compteur de faf3fbba quand il était sur le compte
//   pro). Garde : un id présent dans la dernière liste des comptes LIÉS n'est
//   jamais pris pour la session (c'est un autre compte). Le NOM ne vient que
//   d'une fiche dont l'`user_id` est EXACTEMENT celui de la session
//   (`user-card/v2/{id}/infos`) ou d'une entrée déjà connue sous cet id — jamais
//   d'un titre, jamais d'une fréquence (§5). Nom pas encore lu ⇒ id seul.

function lireSessionPriveeLbc(preuve,url){
 let u;try{u=new URL(url);}catch(_){return null;}
 if(u.username||u.password||u.origin!=='https://api.leboncoin.fr'||!/^\/api\/account\/v\d+\/members\/me\/account\/?$/.test(u.pathname))return null;
 const a=preuve?.account,m=preuve?.member,id=String(a?.account_id||''),nom=m?.nickname?.value;
 if(!['string','number'].includes(typeof a?.account_id)||!['string','number'].includes(typeof m?.account_id)||!/^[a-z0-9_-]{1,64}$/i.test(id)||String(m?.account_id||'')!==id||typeof nom!=='string'||!nom.trim())return null;
 return{id:'lbc-account:'+id,name:nom.trim().slice(0,60),type:typeLbcDe(a.type),session:true,courant:true,platform:'leboncoin',source:u.origin+u.pathname,preuveCompte:'membre-prive-v1'};
}
const LBC_LIES_MS = 12 * 3600e3;
async function noterComptesLies(comptes) {
  const ids = (comptes || []).map((c) => String((c && c.id) || '')).filter(Boolean).slice(0, 10);
  if (!ids.length) return;
  try { await chrome.storage.local.set({ vrmLbcLies: { ids, at: Date.now() } }); } catch (_) {}
  // Le compte de session courant ne peut pas être dans sa propre liste de
  // comptes liés : s'il y est, ce qu'on croyait la session ne l'est plus.
  try {
    const c = (await chrome.storage.local.get('vrmLbcCompte')).vrmLbcCompte;
    if (c && c.v === 2 && c.id && ids.includes(String(c.id))) await chrome.storage.local.remove('vrmLbcCompte');
  } catch (_) {}
}
function typeLbcDe(v) {
  const t = String(v == null ? '' : v);
  if (v === true || /^pro|business|company|store/i.test(t)) return 'pro';
  if (v === false || /^(part|priv|individual|personal)/i.test(t)) return 'particulier';
  return '';
}
async function noterSessionLbc(userId, ident) {
  const id = String(userId || '').trim();
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) return false;
  let local = {};
  try { local = await chrome.storage.local.get(['vrmLbcLies', 'vrmLbcCompte', 'vrmLbcSessionEcrit']); } catch (_) { return false; }
  const lies = local.vrmLbcLies;
  if (lies && Array.isArray(lies.ids) && Date.now() - Number(lies.at || 0) < LBC_LIES_MS && lies.ids.includes(id)) { noterDiag('lbc_session_compte_lie'); return false; }
  const avant = local.vrmLbcCompte;
  const meme = !!(avant && avant.v === 2 && String(avant.id) === id);
  let name = (ident && ident.name) || (meme ? String(avant.name || '') : '');
  let type = (ident && ident.type) || (meme ? String(avant.type || '') : '');
  // Un nom déjà rangé SOUS CET ID (une fiche à son id, une capture d'avant).
  if (!name || !type) {
    try {
      const rows = await sbGet('app_data?id=eq.lbc_accounts&select=data');
      const a = rows && rows[0] && rows[0].data && rows[0].data.accounts && rows[0].data.accounts[id];
      if (a && !(a.source && LBC_URL_AUTRUI.test(String(a.source)) && !a.sessionAt)) { name = name || String(a.name || ''); type = type || String(a.type || ''); }
    } catch (_) {}
  }
  const neuf = { v: 2, id, name, type, at: Date.now(), source: 'compteur' };
  try { await chrome.storage.local.set({ vrmLbcCompte: neuf }); } catch (_) {}
  // Écrit dans `lbc_accounts` au changement de compte, à un nom/type appris, ou
  // toutes les 6 h — jamais à chaque relevé du compteur.
  const e = local.vrmLbcSessionEcrit || {};
  if (e.id === id && e.name === name && e.type === type && Date.now() - Number(e.at || 0) < 6 * 3600e3) return true;
  const acc = { id, session: true, platform: 'leboncoin', source: 'session:messagerie' };
  if (name) acc.name = name;
  if (type) acc.type = type;
  if(await storeLbcAccount(acc)!==true)return false;
  try { await chrome.storage.local.set({ vrmLbcSessionEcrit: { id, name, type, at: Date.now() } }); } catch (_) {}
  return true;
}
// RECON : on garde un échantillon des réponses Leboncoin (chemins d'API + un bout
// de corps) pour brancher l'extraction au millimètre. Ligne dédiée lbc_recon.
// ══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ 40 Mo PAR VISITE SUR LEBONCOIN (mesuré dans les journaux de la base,
//    10 octobre, 12:37) : 89 écritures en une minute, la plus grosse de 2,6 Mo ;
//    `lbc_recon` (462 Ko) relue EN ENTIER 77 fois dans la même minute, puis
//    réécrite en entier à CHAQUE réponse relayée (chemins, schéma, échantillon…)
//    — et `lbc_catalogue` (2,6 Mo) relu entier pour savoir s'il avait changé.
//    C'est de l'égress (le quota que §4.4 a déjà vu crever), et c'est la voie
//    montante de son Mac saturée pendant qu'il revient sur VRM.
// ⇒ Les MORCEAUX s'accumulent dans `chrome.storage.local` (§4.9 : un service
//   worker meurt au bout de 30 s, une variable de module ne retiendrait rien) ;
//   la ligne n'est relue et réécrite qu'AU PLUS une fois toutes les 30 s, et
//   SEULEMENT si la fusion change quelque chose (un chemin déjà connu, un schéma
//   identique ⇒ aucune écriture). Lecture ratée ⇒ rien n'est écrit, les morceaux
//   restent pour le passage suivant (« pas su » ≠ « vide » — la carte du
//   formulaire de dépôt vit dans cette ligne).
// ⚠️ Les morceaux SE FUSIONNENT en attendant : `etapeOne`/`envoiOne`/`venteOne`
//    par clé, `paths` en ensemble, `sample` en tête, `schemaOne` par endpoint ;
//    toute autre clé remplace la précédente (comme avant). Rien n'est perdu entre
//    deux vidages, et une clé inconnue est gardée telle quelle (la leçon du
//    17 septembre : on ne range plus clé par clé).
const LBC_RECON_TAMPON = 'vrmLbcReconTampon';     // { patch, dernier }
const LBC_ECRITURE_MIN_MS = 30000;
let _lbcReconChaine = Promise.resolve();
let _lbcReconMinuteur = null;
const LBC_DICTS = { etapeOne: ['etapes', 40], envoiOne: ['envois', 60], venteOne: ['ventes', 12] };
// Accumule un morceau dans le tampon (sans réseau).
function fusionnerMorceauLbc(t0, patch) {
  const t = Object.assign({}, t0 || {});
  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    if (v === undefined) continue;
    if (k === 'paths') { t.paths = fusionnerCheminsLbc(t.paths, v, 600); continue; }
    if (k === 'sample') { t.samples = [v, ...(t.samples || [])].slice(0, 6); continue; }
    if (k === 'schemaOne') {
      if (v && v.endpoint) { t.schemas = Object.assign({}, t.schemas || {}); t.schemas[String(v.endpoint).slice(0, 120)] = { cles: (v.cles || []).slice(0, 200), at: new Date().toISOString() }; }
      continue;
    }
    if (LBC_DICTS[k]) {
      if (v && v.cle) { const d = LBC_DICTS[k][0]; t[d] = Object.assign({}, t[d] || {}); t[d][String(v.cle)] = v.val; }
      continue;
    }
    t.autres = Object.assign({}, t.autres || {}, { [k]: v });
  }
  return t;
}
// ⚠️⚠️ (20 oct., 5.196) LES CHEMINS VUS ÉTAIENT FIGÉS. `lbc_recon.paths` gardait
//    les 300 PREMIERS chemins jamais vus : mesuré le 20 octobre, la ligne est
//    pleine (300/300) depuis des semaines, au vieux format (sans méthode, sans
//    statut) — aucun chemin neuf ne s'ajoutait plus, la mesure qui devait faire
//    trouver le bordereau Leboncoin était muette. ⇒ Le plus RÉCENT d'abord : un
//    chemin revu remonte, les plus anciens tombent. Ce qui SERT ne tombe pas
//    avant le reste : les chemins de vente/transaction/bordereau, de compte, de
//    messagerie, tout PDF et tout échec (≥ 400) gardent jusqu'à la moitié des
//    places. Un ancien chemin sans méthode dont la forme neuve est là s'efface
//    (doublon). Borné, toujours.
const LBC_CHEMINS_MAX = 300;
const LBC_CHEMIN_UTILE = /(transaction|purchase|order|label|parcel|shipping|deliver|voucher|myads|classifieds|account|users?\/me|messaging|counter|packages|\[pdf\]|→ [45]\d\d)/i;
function fusionnerCheminsLbc(avant, neufs, max) {
  const n = (Array.isArray(neufs) ? neufs : []).filter((x) => typeof x === 'string' && x).slice(-400);
  const tous = [...new Set([...n.slice().reverse(), ...(Array.isArray(avant) ? avant : []).filter((x) => typeof x === 'string' && x)])];
  // Forme neuve « GET host/chemin → 200 [json] » présente ⇒ l'ancienne « host/chemin » est un doublon.
  const avecMethode = (x) => /^[A-Z]+ /.test(x);
  const nus = new Set(tous.map((x) => { const m = /^[A-Z]+ (\S+)/.exec(x); return m ? m[1] : null; }).filter(Boolean));
  const propres = tous.filter((x) => avecMethode(x) || !nus.has(x));
  if (propres.length <= max) return propres;
  // Ordre de garde : les utiles (jusqu'à la moitié), puis les chemins au format
  // neuf du plus récent au plus ancien, puis l'ancien format (rangé jadis du plus
  // ancien au plus récent) en partant de la FIN. L'ordre rangé, lui, ne bouge pas.
  const neufsF = propres.filter(avecMethode), vieuxF = propres.filter((x) => !avecMethode(x));
  const gardes = new Set(propres.filter((x) => LBC_CHEMIN_UTILE.test(x)).slice(0, Math.floor(max / 2)));
  for (const x of [...neufsF, ...vieuxF.slice().reverse()]) { if (gardes.size >= max) break; gardes.add(x); }
  return propres.filter((x) => gardes.has(x));
}
// Applique les morceaux accumulés à la ligne lue (même règles qu'avant).
const garderRecents = (d, max) => {
  const ks = Object.keys(d);
  if (ks.length <= max) return d;
  const keep = ks.sort((x, y) => Date.parse((d[y] || {}).at || 0) - Date.parse((d[x] || {}).at || 0)).slice(0, max);
  for (const k of ks) if (!keep.includes(k)) delete d[k];
  return d;
};
function appliquerMorceauxLbc(prev, t) {
  const next = Object.assign({ paths: [], samples: [] }, prev);
  // Rien de neuf (que des chemins déjà rangés) ⇒ la ligne ne bouge pas : un
  // simple réordonnancement ne vaut pas une écriture (§ « 40 Mo par visite »).
  if (t.paths) { const deja = new Set(next.paths || []); if (t.paths.some((x) => !deja.has(x))) next.paths = fusionnerCheminsLbc(next.paths, t.paths, LBC_CHEMINS_MAX); }
  if (t.samples) next.samples = [...t.samples, ...(next.samples || [])].slice(0, 6);
  if (t.schemas) next.schemas = garderRecents(Object.assign({}, next.schemas || {}, t.schemas), 80);
  for (const k of Object.keys(LBC_DICTS)) {
    const [d, max] = LBC_DICTS[k];
    if (t[d]) next[d] = garderRecents(Object.assign({}, next[d] || {}, t[d]), max);
  }
  if (t.autres && t.autres.url) next.lastUrl = t.autres.url;
  for (const k of Object.keys(t.autres || {})) {
    if (k === 'url') continue;
    next[k] = t.autres[k];
  }
  return next;
}
const sansDateLbc = (d) => { try { const c = Object.assign({}, d || {}); delete c.updatedAt; return JSON.stringify(c); } catch (_) { return ''; } };
function programmerLbcRecon(ms) {
  try { clearTimeout(_lbcReconMinuteur); } catch (_) {}
  _lbcReconMinuteur = setTimeout(() => { _lbcReconMinuteur = null; viderLbcRecon().catch(() => {}); }, Math.max(1000, ms));
}
async function lireTamponLbc() {
  try { return (await chrome.storage.local.get(LBC_RECON_TAMPON))[LBC_RECON_TAMPON] || {}; } catch (_) { return null; }
}
async function ecrireTamponLbc(v) { try { await chrome.storage.local.set({ [LBC_RECON_TAMPON]: v }); return true; } catch (_) { return false; } }
function viderLbcRecon() {
  const p = _lbcReconChaine.then(async () => {
    const st = await lireTamponLbc();
    if (!st || !st.patch || !Object.keys(st.patch).length) return;
    if(!st.owner||(await loadSession())?.user_id!==st.owner)return;
    const reste = LBC_ECRITURE_MIN_MS - (Date.now() - Number(st.dernier || 0));
    if (reste > 0) { programmerLbcRecon(reste); return; }
    const prevRows = await sbGet('app_data?id=eq.lbc_recon&select=data');
    // ⚠️⚠️ C'EST LA LIGNE QUI PORTE LA CARTE DU FORMULAIRE DE DÉPÔT (`form`,
    //    `etapes`) — celle qu'un seul dépôt fait à la main remplit. Une lecture
    //    ratée réécrivait la ligne avec le seul échantillon du moment : la carte
    //    partait. Prouvé : `form:PERDU · etapes:PERDUES`. Ici : on garde les
    //    morceaux, et on réessaie au prochain passage.
    if (prevRows === null) { await ecrireTamponLbc({ owner:st.owner,patch: st.patch, dernier: Date.now() }); programmerLbcRecon(LBC_ECRITURE_MIN_MS); return; }
    const prev = (prevRows[0] && prevRows[0].data) || {};
    const next = appliquerMorceauxLbc(prev, st.patch);
    const change = sansDateLbc(next) !== sansDateLbc(prev);
    if (change) {
      next.updatedAt = new Date().toISOString();
      const ok = await supabaseUpsert('app_data', [{ id: 'lbc_recon', data: next }], 'id',st.owner);
      noterFlux('leboncoin', ok !== false);
      if (ok === false) { await ecrireTamponLbc({ owner:st.owner,patch: st.patch, dernier: Date.now() }); programmerLbcRecon(LBC_ECRITURE_MIN_MS); return; }
    } else noterDiag('lbc_recon_inchange');
    await ecrireTamponLbc({ owner:st.owner,patch: {}, dernier: Date.now() });
    if (change && (st.patch.etapes || st.patch.envois)) await publierPrepLbc({ recon: next });
  });
  _lbcReconChaine = p.catch(() => {});
  return _lbcReconChaine;
}
// Un appelant donne un MORCEAU ; il est rangé tout de suite dans le tampon
// (sans réseau), et la ligne est écrite si le dernier vidage date de 30 s ou plus.
async function storeLbcRecon(patch,ownerAttendu=null) {
  const owner=ownerAttendu||(await loadSession())?.user_id;if(!owner)return;

  const p = _lbcReconChaine.then(async () => {
    const avant=await lireTamponLbc();
    if(avant===null)return;
    const st=avant.owner===owner?avant:{owner,patch:{},dernier:0};
    await ecrireTamponLbc({ owner,patch: fusionnerMorceauLbc(st.patch, patch || {}), dernier: st.dernier || 0 });
  });
  _lbcReconChaine = p.catch(() => {});
  return _lbcReconChaine.then(() => viderLbcRecon());
}
// LA VENTE LEBONCOIN — la surface qu'on attendait pour « vendue → à retirer » et
// « capter le bordereau comme sur Vinted ». On range un échantillon capé par
// FAMILLE d'endpoint (ids gommés), une place chacune : la vente d'après rafraîchit
// la carte au lieu de l'écraser, et rien ne peut l'évincer. On NE parse RIEN ici
// (on ne devine pas la forme d'une vente jamais vue) — on collecte, la prochaine
// passe branchera l'extraction + la capture du PDF sur la vraie forme (§6.3).
async function storeLbcVente(url, body, coupe,ownerAttendu=null) {
  try {
    let fam = '';
    try { const u = new URL(url); fam = (u.host + u.pathname).replace(/\/\d{3,}/g, '/{id}').replace(/\/[0-9a-f]{16,}/gi, '/{id}'); }
    catch (_) { fam = String(url).split('?')[0].slice(0, 120); }
    fam = fam.slice(0, 120);
    if (!fam) return;
    // 11 octobre : un MORCEAU, fusionné (et borné à 12 familles) par le vidage
    //    regroupé de `lbc_recon` — plus de relecture entière à chaque vente.
    await storeLbcRecon({ venteOne: { cle: fam, val: { url: String(url).split('?')[0].slice(0, 160), taille: new TextEncoder().encode(String(body)).length, coupe: !!coupe, ver: EXT_VERSION, at: new Date().toISOString() } } },ownerAttendu);
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
    const explicite=d.id?.purchase_id??d.purchase_id??j?.pageProps?.purchaseId;
    if(mid&&explicite!=null&&String(explicite)!==mid[1])return [];
    const transactionId=mid?.[1]||(explicite!=null?String(explicite):'');
    if(!/^\d+$/.test(transactionId))return []; // Un id d'annonce n'est jamais un id de transaction.
    const li = labelInfoDe(d);
    const pr = (d.item && d.item.prices) || {};
    // ⚠️ LE VRAI SIGNAL « FINALISÉ » (Julien : « regarde ce que l'extension dit »).
    // MESURÉ sur le détail v2 : `step.label` « Paiement effectué » est ambigu, mais
    // `parcel` tranche — `last_event_status: delivered`, `timeline_config.color_status:
    // finished` (current_step_index 3/4). On capte ces deux-là pour que l'app
    // classe sur la mesure, pas sur un mot. LECTURE seule, aucune donnée perso.
    const pcl = (d.parcel && d.parcel.timeline_config) || {};
    const v = {
      txId: transactionId,
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
// ⚠️⚠️ (20 oct., 5.196) UNE ÉCRITURE À LA FOIS. La liste des transactions (la
//    seule qui porte la DATE de vente) et les détails lus juste après (jusqu'à
//    5, à ~150 ms d'écart) arrivaient en même temps : chacun relisait la ligne,
//    fusionnait SA part et réécrivait la ligne entière — le dernier écrivain,
//    parti d'une lecture faite AVANT l'écriture de la liste, effaçait les dates
//    qu'elle venait de poser. Prouvé (audit-lbc-restes.cjs) : la liste et un
//    détail envoyés ensemble ⇒ plus aucune `dateVente`. Les rangements passent
//    maintenant à la file : chacun relit ce que le précédent a écrit.
let _lbcVentesChaine = Promise.resolve();
async function rangerLbcVentes(list,ownerAttendu=null) {
  const owner=ownerAttendu||(await loadSession())?.user_id;if(!owner)return false;
  const p = _lbcVentesChaine.then(() => rangerLbcVentesUneFois(list,owner));
  _lbcVentesChaine = p.catch(() => {});
  return p;
}
async function rangerLbcVentesUneFois(list,owner) {
  if (!list || !list.length) return false;
  const prev = await sbGet('app_data?id=eq.lbc_ventes&select=data');
  if (prev === null) return false;                          // pas su ≠ vide — on n'écrase rien
  const cur = (prev[0] && prev[0].data) || {};
  const ventes = Object.assign({}, cur.ventes || {});
  for (const v of list) {
    const k = v.txId; if (!k) continue;
    const old = ventes[k] || {};
    if(old.account&&String(old.account)!==String(v.account||''))return false; // Une source non concordante ne déplace pas une vente.
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
  const _okFlux = await supabaseUpsert('app_data', [{ id: 'lbc_ventes', data: { ventes, updatedAt: new Date().toISOString() } }], 'id',owner);
  await noterFlux('leboncoin', _okFlux === true);
  if(_okFlux===true)notifierApp({type:'maj',quoi:'lbc'});
  return _okFlux===true;
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
// ⚠️⚠️ 11 octobre (mesuré : 2,6 Mo par écriture, plusieurs fois par minute). Le
//    catalogue était RELU EN ENTIER (2,6 Mo) à chaque réponse, juste pour savoir
//    s'il avait changé, puis réécrit en entier — tous les endpoints à la fois —
//    dès qu'UN changeait de taille. Désormais :
//      · son EMPREINTE (SHA-256) est comparée à ce qu'on a déjà écrit, rangée
//        dans `chrome.storage.local` : rien de neuf ⇒ pas un octet ne part ;
//      · ce qui change attend en mémoire, et la ligne est écrite AU PLUS une
//        fois toutes les 30 s, avec tous les morceaux du moment. Perdre ce
//        tampon (service worker endormi) ne coûte rien : l'empreinte n'a pas
//        été notée, la visite suivante le reprend ;
//      · la ligne porte un `index` (taille, coupé, date par endpoint) : le
//        résumé publié pour l'app ne relit plus 2,6 Mo pour trois nombres.
const LBC_CAT_VU = 'vrmLbcCatalogueVu';    // { [cle]: { h, at }, __dernier }
let _lbcCatTampon = {};
let _lbcCatChaine = Promise.resolve();
let _lbcCatMinuteur = null;
async function empreinteTexte(t) {
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t)));
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  } catch (_) { return 'taille:' + String(t).length; }
}
async function lireCatVu() { try { return (await chrome.storage.local.get(LBC_CAT_VU))[LBC_CAT_VU] || {}; } catch (_) { return null; } }
async function storeLbcCatalogue(url, body, coupe) {
  try {
    const cle = String(url || '').replace(/^https?:\/\//, '').split('?')[0].replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80);
    if (!cle || cle === 'index' || cle === 'updatedAt') return;
    const h = await empreinteTexte(String(body) + '|' + (coupe ? 1 : 0));
    const vu = await lireCatVu();
    if (vu && vu[cle] && vu[cle].h === h) return;          // déjà écrit tel quel : rien ne part
    _lbcCatTampon[cle] = { url, body: String(body), coupe: !!coupe, h };
    await viderLbcCatalogue();
  } catch (_) {}
}
function viderLbcCatalogue() {
  const p = _lbcCatChaine.then(async () => {
    const cles = Object.keys(_lbcCatTampon);
    if (!cles.length) return;
    const vu = await lireCatVu();
    if (vu === null) return;
    const reste = LBC_ECRITURE_MIN_MS - (Date.now() - Number(vu.__dernier || 0));
    if (reste > 0) {
      try { clearTimeout(_lbcCatMinuteur); } catch (_) {}
      _lbcCatMinuteur = setTimeout(() => { _lbcCatMinuteur = null; viderLbcCatalogue().catch(() => {}); }, Math.max(1000, reste));
      return;
    }
    const lot = _lbcCatTampon; _lbcCatTampon = {};
    const prevRows = await sbGet('app_data?id=eq.lbc_catalogue&select=data');
    if (prevRows === null) { _lbcCatTampon = Object.assign({}, lot, _lbcCatTampon); return; }   // pas su ≠ vide
    const prev = (prevRows[0] && prevRows[0].data) || {};
    const next = Object.assign({}, prev);
    const memo = Object.assign({}, vu);
    let change = false;
    for (const cle of Object.keys(lot)) {
      const x = lot[cle];
      const deja = prev[cle];
      memo[cle] = { h: x.h, at: Date.now() };
      // Un autre Chrome l'a peut-être déjà écrit, identique : on ne réécrit pas.
      if (deja && deja.corps === x.body && !!deja.coupe === x.coupe) continue;
      next[cle] = { url: x.url, at: new Date().toISOString(), taille: x.body.length, coupe: x.coupe, corps: x.body };
      change = true;
    }
    if (change) {
      const index = {};
      for (const k of Object.keys(next)) {
        if (k === 'index' || k === 'updatedAt') continue;
        const v = next[k] || {};
        index[k] = { taille: v.taille || 0, coupe: !!v.coupe, at: v.at || null };
      }
      next.index = index;
      next.updatedAt = new Date().toISOString();
      const ok = await supabaseUpsert('app_data', [{ id: 'lbc_catalogue', data: next }], 'id');
      if (ok === false) { _lbcCatTampon = Object.assign({}, lot, _lbcCatTampon); return; }
    }
    memo.__dernier = Date.now();
    try { await chrome.storage.local.set({ [LBC_CAT_VU]: memo }); } catch (_) {}
    if (change) await publierPrepLbc({ index: next.index });      // l'app doit VOIR ce qui a été capté (§11)
  });
  _lbcCatChaine = p.catch(() => {});
  return _lbcCatChaine;
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
async function publierPrepLbc(enMain) {
  try {
    const em = enMain || {};
    // 11 octobre : on ne relit plus 2,6 Mo + 462 Ko pour trois nombres. Le
    // catalogue porte son `index` ; de `lbc_recon` on ne lit que `envois` et
    // `etapes`. Ce que l'appelant a déjà en main n'est pas relu du tout.
    let idx = em.index || null;
    if (!idx) {
      const r = await sbGet('app_data?id=eq.lbc_catalogue&select=index:data->index');
      if (r === null) return;
      idx = (r[0] && r[0].index) || null;
      if (!idx) {
        // Une ligne d'avant l'index : une fois, en entier (la prochaine écriture le pose).
        const full = await sbGet('app_data?id=eq.lbc_catalogue&select=data');
        if (full === null) return;
        const d = (full[0] && full[0].data) || {};
        idx = {};
        for (const k of Object.keys(d)) { if (k === 'updatedAt' || k === 'index') continue; const v = d[k] || {}; idx[k] = { taille: v.taille || 0, coupe: !!v.coupe, at: v.at || null }; }
      }
    }
    let rd = em.recon || null;
    if (!rd) {
      const r = await sbGet('app_data?id=eq.lbc_recon&select=envois:data->envois,etapes:data->etapes');
      // « Pas su » ne vaut pas « rien » : sans lecture, on ne publie pas — sinon
      // un simple timeout annoncerait « rien n'est capté » et le ferait
      // recommencer un dépôt pour rien.
      if (r === null) return;
      rd = (r[0]) || {};
    }
    const cd = idx;
    const morceaux = {};
    for (const k of Object.keys(cd)) {
      if (k === 'updatedAt' || k === 'index') continue;
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
// (17 oct., Julien : « ça met le mauvais compte Leboncoin connecté »). Mesuré :
// le compte « connecté » de la petite carte était le DERNIER compte vu sur un
// endpoint « moi » — y compris `users/me/linked_accounts`, qui LISTE tous ses
// comptes liés : le premier de la liste devenait « le compte connecté », quel
// que soit celui ouvert dans l'onglet. Et la page (`lbc.js`) remontait n'importe
// quel objet { user_id, pseudo } — le vendeur de l'annonce affichée.
// ⇒ Seul l'endpoint qui décrit LA SESSION (`members/me/account`, vu dans son
//   navigateur ; `users/me` en repli) désigne le compte courant, et seulement
//   pour un objet hors d'une liste. Les autres « moi » enrichissent la liste de
//   ses comptes, jamais « celui qui est connecté ».
const LBC_URL_SESSION = /\/members\/me\/account\/?(\?|$)|\/(?:users?|accounts?)\/me\/?(\?|$)/i;
function detectLbcAccount(data, url) {
  let best = null;
  const u = String(url || '');
  // Un compte ne se reconnaît que sur un endpoint « moi » — jamais une fiche
  // d'autrui (voir le bloc ci-dessus). Sinon on ne prend rien.
  if (!LBC_URL_MOI.test(u) || LBC_URL_AUTRUI.test(u)) return null;
  if(!LBC_URL_SESSION.test(u)&& !/\/users\/me\/linked_accounts\/?(?:\?|$)/i.test(u))return null;
  const marqueurMoi = (o) => !!(o.email || o.phone || o.phone_number || o.phoneNumber
    || o.siren || o.siret || o.is_pro != null || o.is_business_user != null || o.store_id || o.storeId || o.company_name);
  const session = LBC_URL_SESSION.test(u);
  const walk = (node, depth, key, dansListe) => {
    if (best || !node || depth > 8 || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1, key, true); return; }
    const id = node.user_id || node.userId || node.store_id || node.storeId || node.account_id || node.accountId || node.id;
    const name = node.store_name || node.storeName || node.company_name || node.companyName
      || node.pseudo || node.pseudonym || node.name || node.display_name || node.displayName;
    const cleMoi = /^(user|account|store|owner|me|profile|pro|seller|self|current)/i.test(String(key || ''));
    if (id && name && (marqueurMoi(node) || (cleMoi && (node.pseudo || node.pseudonym || node.email)))) {
      // 5.195 : `linked_accounts` dit `is_business_user` (mesuré) — c'est LUI qui
      // tranche quand il est présent (SHOPCANCALE était rangé « particulier »).
      const pro = typeof node.is_business_user === 'boolean' ? node.is_business_user
        : !!(node.siren || node.siret || node.store_id || node.storeId || node.company_name || node.is_pro);
      best = { id: String(id), name: String(name), type: pro ? 'pro' : 'particulier', platform: 'leboncoin', source: String(url || '').slice(0, 120) };
      if (session && !dansListe) best.courant = true;
      return;
    }
    for (const k in node) if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1, k, dansListe);
  };
  try { walk(data, 0, '', false); } catch (_) {}
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
    for (const id in accs) { const src = accs[id] && accs[id].source; if ((accs[id] && accs[id].sessionAt) || !src || (LBC_URL_MOI.test(String(src)) && !LBC_URL_AUTRUI.test(String(src)))) s.add(String(id)); }
  } catch (_) {}
  return s;
}

// ── LE PACK PHOTO LEBONCOIN (17 octobre, 5.185). Julien : « l'extension peut
//    capter si oui ou non l'utilisateur a pris un pack photo » — plutôt que de
//    le lui faire saisir dans la compta. MESURÉ dans `lbc_recon.paths` : la page
//    de son compte charge d'elle-même `api/usage-consumption-bff/v2/users/me/
//    packages` (ses packs) et `selfserve-public-api/v1/users/me/product-catalog`
//    (le CATALOGUE de ce qui s'achète — jamais une preuve de possession).
//    ⚠️ JE N'AI JAMAIS VU LE CORPS de `packages` (aucun échantillon en base) :
//    on ne décide donc que sur ce qui se LIT sans deviner —
//      · un pack dont le nom / type / code dit « photo » ⇒ actif: true ;
//      · une liste de packs LISIBLE (des objets qui portent un nom, ou une liste
//        vide) sans aucun « photo » ⇒ actif: false ;
//      · une forme qu'on ne sait pas lire ⇒ RIEN n'est écrit (pas su), et la
//        FORME (noms de clés, types — jamais une valeur) est gardée pour la
//        passe suivante (`lbc_pack_photo.forme`).
//    Zéro requête de plus : on lit ce que la page a déjà reçu.
const LBC_URL_PACKS = /\/usage-consumption-bff\/v\d+\/users\/me\/packages/i;
const CHAMPS_NOM_PACK = ['name', 'label', 'title', 'type', 'code', 'product', 'productCode', 'product_code', 'kind', 'category', 'slug', 'offer', 'package'];
function lirePackPhoto(data) {
  const listes = [];
  const walk = (n, d) => {
    if (!n || d > 5) return;
    if (Array.isArray(n)) { listes.push(n); for (const v of n) walk(v, d + 1); return; }
    if (typeof n === 'object') for (const k of Object.keys(n)) walk(n[k], d + 1);
  };
  walk(data, 0);
  const nomsDe = (o) => (o && typeof o === 'object' && !Array.isArray(o)) ? CHAMPS_NOM_PACK.map((k) => o[k]).filter((v) => typeof v === 'string' && v.trim()) : [];
  let lisible = false, photo = false;
  for (const l of listes) {
    if (!l.length) { lisible = true; continue; }
    const objets = l.filter((o) => o && typeof o === 'object' && !Array.isArray(o));
    if (!objets.length || !objets.every((o) => nomsDe(o).length)) continue;
    lisible = true;
    if (objets.some((o) => nomsDe(o).some((t) => /photo/i.test(t)))) photo = true;
  }
  return photo ? true : (lisible ? false : null);
}
function formeDe(data) {
  const out = []; const vus = new Set();
  const walk = (n, chemin, d) => {
    if (out.length >= 60 || d > 6) return;
    const t = Array.isArray(n) ? 'array' : n === null ? 'null' : typeof n;
    const c = chemin + ':' + t;
    if (!vus.has(c)) { vus.add(c); out.push(c); }
    if (Array.isArray(n)) { if (n.length) walk(n[0], chemin + '[]', d + 1); return; }
    if (n && typeof n === 'object') for (const k of Object.keys(n).slice(0, 30)) walk(n[k], chemin ? chemin + '.' + k : k, d + 1);
  };
  walk(data, '', 0);
  return out;
}
let chainePack = Promise.resolve();
function noterPackPhoto(data, url) {
  const actif = lirePackPhoto(data);
  const forme = formeDe(data);
  const fait = chainePack.then(async () => {
    try {
      const rows = await sbGet('app_data?id=eq.lbc_pack_photo&select=data');
      if (rows === null) { noterDiag('lbc_pack_lecture_ratee'); return false; }   // pas su : on n'écrit rien
      const avant = (rows[0] && rows[0].data) || {};
      const at = new Date().toISOString();
      const neuf = Object.assign({}, avant, { forme, formeAt: at, source: 'extension', endpoint: String(url || '').replace(/^https?:\/\//, '').split('?')[0].slice(0, 120) });
      if (typeof actif === 'boolean') { neuf.actif = actif; neuf.at = at; }
      const memeForme = JSON.stringify(avant.forme || []) === JSON.stringify(forme);
      const recent = avant.at && (Date.now() - Date.parse(avant.at)) < 6 * 3600e3;
      if (memeForme && (typeof actif !== 'boolean' || (avant.actif === actif && recent))) return false;   // rien de neuf
      const ok = await supabaseUpsert('app_data', [{ id: 'lbc_pack_photo', data: neuf }], 'id');
      noterDiag(ok === false ? 'lbc_pack_ecriture_ratee' : (typeof actif === 'boolean' ? `lbc_pack_${actif ? 'oui' : 'non'}` : 'lbc_pack_forme_inconnue'));
      if (ok !== false && typeof actif === 'boolean' && avant.actif !== actif) { try { notifierApp({ type: 'maj', quoi: 'lbcpack' }); } catch (_) {} }
      return ok !== false;
    } catch (_) { return false; }
  });
  chainePack = fait.catch(() => false);
  return fait;
}
// ⚠️⚠️ (20 oct., 5.196) LE COMPTE D'UNE LISTE « À MOI » VIENT DE LA PAGE QUI L'A
//    REÇUE, PLUS DU DERNIER COMPTE VU PAR LE FOND. Changer de compte Leboncoin
//    dans le même onglet recharge la page : « mes annonces » du NOUVEAU compte
//    peut arriver avant son compteur de messagerie, et le fond, qui gardait
//    l'ancien `vrmLbcCompte`, la rangeait sous l'ANCIEN compte (ses annonces
//    mélangées à celles de l'autre, §5). ⇒ `lbc-inject.js` joint à une liste
//    « à moi » le compte du compteur relu DANS LE MÊME DOCUMENT, AVANT elle (ou
//    la retient jusqu'au premier compteur de ce document) ; un second compte vu
//    dans le même document ⇒ rien n'est plus joint. Ici : sans ce compte joint
//    (ou s'il est un compte LIÉ), on ne tague rien — jamais l'ancien.
async function sessionDeListe(sessionPage) {
  const id = String(sessionPage || '').trim();
  const prive=/^lbc-account:[a-z0-9_-]{1,64}$/i.test(id);
  if (!prive&&!/^[0-9a-f-]{8,64}$/i.test(id)) return null;
  let local = {};
  try { local = await chrome.storage.local.get(['vrmLbcLies', 'vrmLbcCompte']); } catch (_) { return null; }
  if(prive){const rows=await sbGet('app_data?id=eq.lbc_accounts&select=data');const a=rows?.[0]?.data?.accounts?.[id];if(!a||a.preuveCompte!=='membre-prive-v1')return null;return{id,name:a.name||'',type:a.type||'',prive:true};}
  const lies = local.vrmLbcLies;
  if (lies && Array.isArray(lies.ids) && Date.now() - Number(lies.at || 0) < LBC_LIES_MS && lies.ids.includes(id)) return null;
  const c = local.vrmLbcCompte;
  const meme = !!(c && c.v === 2 && String(c.id) === id);
  return { id, name: meme ? String(c.name || '') : '', type: meme ? String(c.type || '') : '' };
}
async function handleLbcRaw(url, body, sessionPage,ownerAttendu=null) {
  const owner=ownerAttendu||(await loadSession())?.user_id;if(!owner)return {ok:false,etat:'ecriture-refusee'};
  let data = null;
  try { data = JSON.parse(body); } catch (_) { return; }
  if (LBC_URL_PACKS.test(String(url || ''))) { try { await noterPackPhoto(data, url); } catch (_) {} }
  const found = []; const seen = new Set();
  // Qui suis-je ? (pour ne garder que MES annonces dans le parcours générique)
  const miens = await comptesMiens();
  // ⚠️⚠️ (19 oct.) « MES ANNONCES » NE DIT PAS À QUI ELLES SONT — ce sont les
  //    siennes. Mesuré sur sa base : l'extension a VU `api/adfinder/v2/myads`
  //    (sa page « mes annonces »), mais ses annonces n'y portent pas d'owner ;
  //    la garde « réf VRM ou owner à moi » les rejetait toutes : AUCUNE de ses
  //    annonces Leboncoin n'a jamais été rangée (compte et images introuvables
  //    dans l'app). Sur CET endpoint « moi », une annonce sans owner (ou dont
  //    l'owner est le compte de la SESSION) est à lui, taguée de ce compte.
  //    Compte de session inconnu ⇒ on ne tague rien (blanc plutôt que faux, §5).
  const listeMoi = /\/adfinder\/v\d+\/myads\b|\/compte\/(?:part|pro)\/mes-annonces\/?$/i.test(String(url || ''));
  let sess = null;
  try { const c = (await chrome.storage.local.get('vrmLbcCompte')).vrmLbcCompte; if (c && c.v === 2 && c.id) sess = c; } catch (_) {}
  // 5.195 : la fiche publique DU compte de session (même id, exactement) donne
  // son nom et son type. Jamais celle d'un autre id (§5).
  { const m = /\/user-card\/v\d+\/([0-9a-f-]{8,64})\/infos/i.exec(String(url || ''));
    if (m && sess && String(m[1]) === String(sess.id) && data && String(data.user_id || '') === String(sess.id) && data.name) {
      try { await noterSessionLbc(sess.id, { name: String(data.name).slice(0, 60), type: typeLbcDe(data.account_type) }); } catch (_) {}
      return;
    } }
  if (sess) miens.add(String(sess.id));
  // Le compte qui TAGUE une liste « à moi » : celui que la page a joint (même
  // document), jamais `vrmLbcCompte` (le dernier vu, peut-être l'ancien).
  const sessListe = await sessionDeListe(sessionPage);
  if (sessListe) miens.add(sessListe.id);
  if(listeMoi&&String(sessionPage||'').startsWith('lbc-account:')&&!sessListe)return {ok:false,etat:'compte-non-confirme'};
  if(listeMoi&&sessListe?.prive){try{const u=new URL(url);for(const[k,v]of u.searchParams)if(/^(user_id|store_id|account_id|owner_id)$/i.test(k)&&!(k==='account_id'&&v===sessListe.id.slice('lbc-account:'.length)))return;}catch(_){return;}}
  // Le compte connecté (id + nom + pro/particulier), s'il transparaît ici.
  const acct = detectLbcAccount(data, url);
  if (acct) await storeLbcAccount(acct,owner);

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
        images: photosAnnonceLbc(info),
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
        account: acct ? acct.id : (sessListe ? sessListe.id : null),
        accountName: acct ? acct.name : (sessListe ? (sessListe.name || null) : null),
        accountType: acct ? acct.type : (sessListe ? (sessListe.type || null) : null),
        platform: 'leboncoin',
      });
    }
    if (found.length) return await storeLbcListings(url, found,owner);
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
        const aMoiParSession = !!(listeMoi && sessListe && (sessListe.prive || !ownerId || ownerId === sessListe.id));
        if (refVRM || (ownerId && miens.has(ownerId)) || aMoiParSession) found.push({
          id: sid, subject: String(title), price,
          body: bodyTxt.slice(0, 400),
          ref: refVRM,
          url: node.url || '',
          images: photosAnnonceLbc(node),
          category: node.category_name || node.category_id || '',
          status: node.status || node.ad_status || '',
          // ⚠️ Le propriétaire de CETTE annonce (une réponse générique mêle ses
          //    annonces et le flux « découverte » d'autrui) : on prend l'owner
          //    porté par l'annonce ELLE-MÊME, jamais le compte de session (qui,
          //    ici, ne prouverait pas que le chalet d'à côté est à lui, §5).
          account: aMoiParSession&&sessListe.prive?sessListe.id:ownerId || (aMoiParSession ? sessListe.id : null),
          accountName: aMoiParSession&&sessListe.prive?sessListe.name:String((node.owner && (node.owner.name || node.owner.pseudo)) || node.owner_name || '') || (aMoiParSession ? sessListe.name || null : null),
          platform: 'leboncoin',
        });
      }
    }
    for (const k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1); }
  };
  const racine=listeMoi&&sessListe?.prive?(Array.isArray(data?.ads)?data.ads:Array.isArray(data?.data?.ads)?data.data.ads:[]):data;
  try { walk(racine, 0); } catch (_) {}
  // Détection auto du quota d'annonces (offre Leboncoin) → la limite s'adapte.
  const quota = detectLbcQuota(data);
  // Recon : un échantillon du corps (tronqué) + l'URL, pour inspecter la vraie forme.
  await storeLbcRecon({ url, quota: quota || undefined, sample: { url, at: new Date().toISOString(), found: found.length, quota, body: String(body).slice(0, 9000) } },owner);
  if (found.length) return await storeLbcListings(url, found,owner);
  if(listeMoi&&sessListe&&(Array.isArray(data?.ads)||Array.isArray(data?.data?.ads))&&racine.length===0)return {ok:true,etat:'liste-vide',nombre:0,photos:0};
  return {ok:true,etat:'aucune-annonce-reconnue',nombre:0,photos:0};
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
// ⚠️ 17 octobre — Julien : « le détourage de photo doit être présent QUE dans
//    Vestiaire Collective, pas du tout pour Leboncoin ; ne mets pas cette
//    fonctionnalité dans les paramètres ». Vestiaire oblige le fond détouré ;
//    Leboncoin et eBay reçoivent les photos D'ORIGINE, toujours, quel que soit
//    l'ancien réglage `vrm_detourage` (il n'est plus lu). Le détourage ne part
//    donc que par `photosPourVestiaire` (aucune publication Vestiaire n'existe
//    encore : rien n'est dépensé aujourd'hui).
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
// Vestiaire Collective seulement : TOUTES les photos détourées (le site l'exige),
// sans réglage. Toute issue autre qu'un succès garde la photo d'origine.
async function photosPourVestiaire(urls, max) { return await detourerPhotos(await photosEnOctets(urls, max), 'toutes'); }

// ══════════════════════════════════════════════════════════════════════════════
// DÉTOURAGE PHOTOROOM — juste avant d'attacher les photos (5.156, 4 octobre)
// ══════════════════════════════════════════════════════════════════════════════
// Julien : « intègre l'API de Photoroom pour le détourage des photos avant chaque
// poste ». ⚠️ Depuis le 17 octobre (sa décision) : Vestiaire Collective SEUL
// (`photosPourVestiaire`, mode « toutes », aucun réglage) — plus jamais
// Leboncoin ni eBay.
//
// Les bornes, chacune pour une raison :
//   • Sans mode donné par l'appelant ⇒ ÉTEINT : ici « oui » coûte de l'argent à
//     chaque photo.
//   • Seules les vraies photos du CDN Vinted partent (`images*.vinted.net/t/`) :
//     12 des 780 photos captées sont le visuel générique du site, pas une paire —
//     on ne paie pas pour détourer une affiche.
//   • L'empreinte SHA-256 des octets D'ORIGINE est envoyée d'abord, SANS la photo :
//     si le serveur l'a déjà détourée, il la rend (on ne paie jamais deux fois).
//   • Toute autre issue — pas de session, clé non posée, plafond du mois atteint,
//     Photoroom en panne, délai — GARDE LA PHOTO D'ORIGINE et note la raison.
//     Jamais une photo perdue, jamais un faux « détourée » (le bandeau compte).
//   • 3 envois en même temps au plus : c'est NOTRE serveur, pas Vinted (le
//     garde-fou « une requête à la fois » du §3 porte sur Vinted et ne bouge pas).
//   • 45 s de budget en tout : le remplissage Leboncoin abandonne à 90 s.
//   • Aucun octet gardé en variable de module (§4.9) : le cache vit sur le serveur.
const DETOURAGE_URL = `${VRM_APP_API}/api/ai?mode=detourage`;
const PHOTO_VINTED_CDN = /^https:\/\/images\d*\.vinted\.net\/t\//;
const DETOURAGE_MAX_B64 = 3000000;     // même borne que le serveur (api/_lib/detourage.js)
const DETOURAGE_BUDGET_MS = 45000;
// Une raison qui vaut pour TOUTES les photos suivantes : inutile d'insister.
const DETOURAGE_ARRET = { session: 1, abonnement: 1, reserve: 1, 'no-key': 1, plafond: 1, compteur: 1, cache: 1, acces: 1 };

async function empreinteB64(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const d = await crypto.subtle.digest('SHA-256', u);
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}

// Un appel au serveur, borné dans le temps. Rend {status, j} ou {status:0}.
async function appelDetourage(jeton, corps, restantMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1000, Math.min(25000, restantMs)));
  try {
    const r = await fetch(DETOURAGE_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(corps),
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, j: (j && typeof j === 'object') ? j : {} };
  } catch (_) { return { status: 0, j: {} }; }
  finally { clearTimeout(t); }
}

// Rend la MÊME liste, dans le même ordre : une photo détourée porte `detoure:true`
// (octets et type remplacés), une photo laissée telle quelle porte `detoure:false`
// et `detourage` (la raison). Réglage éteint ⇒ la liste revient intacte.
async function detourerPhotos(photos, modeForce) {
  const liste = Array.isArray(photos) ? photos : [];
  // Le mode est DONNÉ par l'appelant (Vestiaire : « toutes ») — plus aucun
  // réglage lu : sans mode, rien ne part (rien n'est dépensé).
  const mode = modeForce;
  if (mode !== 'couverture' && mode !== 'toutes') return liste;
  const cibles = [];
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    if (!p || !p.b64) continue;                       // illisible : rien à détourer
    if (mode === 'couverture' && cibles.length >= 1) break;
    if (!PHOTO_VINTED_CDN.test(String(p.url || ''))) {
      liste[i] = Object.assign({}, p, { detoure: false, detourage: 'pas-une-photo' });
      noterDiag('detourage_filtre_url').catch(() => {});
      if (mode === 'couverture') break;               // la couverture n'est pas une photo de paire
      continue;
    }
    cibles.push(i);
  }
  if (!cibles.length) return liste;
  let s = null; try { s = await authToken(); } catch (_) {}
  if (!s || !s.access_token) {
    for (const i of cibles) liste[i] = Object.assign({}, liste[i], { detoure: false, detourage: 'session' });
    noterDiag('detourage_session').catch(() => {});
    return liste;
  }
  const debut = Date.now();
  let arret = '';
  const traiter = async (i) => {
    const p = liste[i];
    const garde = (raison) => { liste[i] = Object.assign({}, p, { detoure: false, detourage: raison }); noterDiag('detourage_' + raison.replace(/[^a-z0-9]+/gi, '_')).catch(() => {}); };
    if (arret) return garde(arret);
    const restant = DETOURAGE_BUDGET_MS - (Date.now() - debut);
    if (restant < 1500) return garde('delai');
    if (p.b64.length > DETOURAGE_MAX_B64) return garde('trop-lourde');
    let sha;
    try { sha = await empreinteB64(p.b64); } catch (_) { return garde('illisible'); }
    // 1. La sonde : l'empreinte seule.
    let r = await appelDetourage(s.access_token, { sha }, restant);
    if (r.status === 200 && r.j.ok && !r.j.hit) {
      // 2. Pas encore détourée : on envoie la photo.
      r = await appelDetourage(s.access_token, { sha, b64: p.b64 }, DETOURAGE_BUDGET_MS - (Date.now() - debut));
    }
    if (r.status === 200 && r.j.ok && typeof r.j.b64 === 'string' && r.j.b64) {
      liste[i] = Object.assign({}, p, { b64: r.j.b64, type: 'image/jpeg', taille: Number(r.j.bytes) || p.taille, detoure: true, detourageCache: !!r.j.hit });
      noterDiag(r.j.hit ? 'detourage_cache' : 'detourage_ok').catch(() => {});
      return;
    }
    const raison = r.status === 0 ? 'delai'
      : (r.j && r.j.reason) ? String(r.j.reason)
      : ('refus-' + r.status);
    const finale = raison === 'photoroom' ? 'photoroom-' + (r.j.status || r.status) : raison;
    // Photoroom 402 (crédits épuisés) ou 403 (clé refusée) : vrai pour toutes les suivantes.
    if (DETOURAGE_ARRET[raison] || finale === 'photoroom-402' || finale === 'photoroom-403') arret = finale;
    garde(finale);
  };
  // 3 en même temps au plus, dans l'ordre.
  let k = 0;
  const ouvrier = async () => { while (k < cibles.length) { const i = cibles[k++]; await traiter(i); } };
  await Promise.all([ouvrier(), ouvrier(), ouvrier()]);
  return liste;
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
// Rend `true` seulement si la base a pris l'écriture (revue du 17 octobre : un
// « Déjà publiée » ou une publication qui n'a pas été NOTÉE se disait « fait »).
async function writePosted(d) {
  return await supabaseUpsert('app_data', [{ id: 'vinted_lbc_posted', data: { ids: d.ids, limit: d.limit != null ? d.limit : null, plan: d.plan || null, updatedAt: new Date().toISOString() } }], 'id');
}
async function markLbcPosted(id) {
  const d = await readPostedData(); if (d.echec) return false; const s = new Set(d.ids); s.add(String(id));
  return (await writePosted({ ids: [...s], limit: d.limit, plan: d.plan })) === true;
}
async function unmarkLbcPosted(id) {
  const d = await readPostedData(); if (d.echec) return false; const s = new Set(d.ids); s.delete(String(id));
  return (await writePosted({ ids: [...s], limit: d.limit, plan: d.plan })) === true;
}
async function setLbcLimit(limit, plan) {
  const d = await readPostedData();
  if (d.echec) return false;
  const n = parseInt(String(limit), 10);
  return (await writePosted({ ids: d.ids, limit: (isNaN(n) || n <= 0) ? null : n, plan: (plan && String(plan).trim()) || null })) === true;
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
