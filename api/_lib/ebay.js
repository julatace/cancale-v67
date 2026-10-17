import crypto from 'crypto';
import { sbCle } from './cle.js';
// Base cloisonnée : sans propriétaire ni cible (owner,id), l'écriture est refusée.
import { withOwnerAll, conflictTarget } from './owner.js';
// La base sait-elle séparer les vendeurs ? (trois états, voir session.js)
import { baseCloisonnee } from './session.js';
// api/_lib/ebay.js — la logique OAuth eBay, en UN seul endroit (§11).
// Utilisée par api/ebay.js (l'app pilote, et `?mode=callback`, le retour de
// consentement d'eBay). Une seule règle : les clés vivent dans les variables
// Vercel, les jetons ne repartent jamais vers le navigateur, on ne ment jamais
// sur un échec — et (5 octobre) chaque vendeur a SES jetons et SES lignes :
// toute fonction qui lit ou écrit reçoit le vendeur en paramètre (`owner`).

const EBAY_AUTH_URL  = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
// ⚠️ Scopes demandés à la CONSENTEMENT (authorize). `sell.finances` (lecture)
// ouvre le solde à virer (getSellerFundsSummary). Il n'entre en vigueur qu'au
// PROCHAIN consentement : un jeton déjà accordé SANS ce droit ne l'a pas — c'est
// pourquoi le rafraîchissement (accessToken) ne redemande AUCUN scope (voir
// plus bas), sinon eBay refuserait un droit non accordé et casserait TOUT accès.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
  // (17 octobre) La promotion des annonces (Marketing API). Comme `sell.finances`,
  // il n'arrive qu'au PROCHAIN consentement ; sans lui l'écran dit « reconnecte ».
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
].join(' ');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const TOKENS_ID = 'ebay_tokens';

// ⚠️ TOUT est lu à l'APPEL (jamais à l'import) : une fonction serverless
// capturerait sinon un env absent au chargement (piège vu au banc).
const appId  = () => process.env.EBAY_APP_ID || '';
const certId = () => process.env.EBAY_CERT_ID || '';
// Le « RuName » (URL de redirection) configuré dans le portail eBay Developer.
const ruName = () => process.env.EBAY_RUNAME || process.env.EBAY_REDIRECT || '';
// ⚠️ REPLI SUR LA CLÉ PUBLIQUE « anon », comme api/push.js et api/email-inbound.js.
// Sans lui, la route eBay n'avait AUCUNE clé pour ranger/lire le jeton quand
// SUPABASE_SERVICE_KEY n'est pas posée sur Vercel → l'échange OAuth échouait à la
// dernière ligne (« store-failed »), et status répondait « store-unreachable ».
// Tant que la base n'est pas cloisonnée, la clé anon lit/écrit app_data (mesuré).
// Le jeton n'est donc pas plus exposé que les jetons Vinted déjà en base — la
// migration RLS (SECURITE.md) protège tout d'un coup, ce jeton compris.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const sbKey  = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || ANON;

const keysReady  = () => !!(appId() && certId());
const canConsent = () => !!(appId() && ruName());
const basicAuth  = () => 'Basic ' + Buffer.from(`${appId()}:${certId()}`).toString('base64');

// `ajout` : « Connecter un AUTRE compte eBay » (9 octobre). `prompt=login`
// demande à eBay de montrer sa page de connexion même si un compte eBay est
// déjà ouvert dans ce navigateur — sans lui, eBay reconnecterait EN SILENCE le
// compte déjà ouvert (⚠️ NON MESURÉ ici : la doc OAuth d'eBay le décrit, aucun
// appel réel n'a été fait ; le premier essai se fera chez Julien).
function authUrl(state, opts) {
  return `${EBAY_AUTH_URL}?client_id=${encodeURIComponent(appId())}`
    + `&redirect_uri=${encodeURIComponent(ruName())}`
    + `&response_type=code&scope=${encodeURIComponent(SCOPES)}`
    + (opts && opts.ajout ? '&prompt=login' : '')
    + (state ? `&state=${encodeURIComponent(String(state).slice(0, 140))}` : '');
}

// Jeton applicatif (client_credentials) : sert à TESTER que les clés marchent.
async function appToken() {
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status >= 500 ? 502 : r.status, error: 'eBay a refusé les clés', detail: (j && (j.error_description || j.error)) || '' };
  return { ok: true, status: 200, works: true, expires_in: j.expires_in || null };
}

// ── À QUI APPARTIENT UNE LIGNE eBAY ? (5 octobre, chaque vendeur son eBay) ────
// Julien : « tout doit être adaptable en fonction de la personne en face ».
// Jusqu'ici `ebay_tokens` et les lignes `ebay_*` étaient celles de
// l'INSTALLATION (écrites au nom de VRM_OWNER_UID, lues avec la clé de service
// SANS filtre) : un second vendeur aurait lu les jetons eBay de Julien — ou la
// première ligne venue, la sienne ou celle d'un autre.
// ⇒ Le vendeur est passé EXPLICITEMENT à chaque fonction (jamais une variable
//   de module : deux requêtes se traitent en parallèle dans la même instance).
//   Base cloisonnée : on lit `owner=eq.{vendeur}` et on écrit `owner` = lui,
//   cible `(owner,id)`. Base pas encore cloisonnée : EXACTEMENT comme avant
//   (un seul jeu de données, `withOwnerAll` / `conflictTarget`).
// ⚠️ Rétrocompatible : la ligne `ebay_tokens` de Julien porte déjà
//   owner = VRM_OWNER_UID = son identifiant — elle reste la sienne, sans rien
//   refaire.
// `null` = on ne SAIT PAS pour qui (base cloisonnée, vendeur absent ou mal
// formé) : on ne lit ni n'écrit rien — jamais « au hasard ».
const UUID_VENDEUR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function portee(owner) {
  const cloison = await baseCloisonnee();
  if (cloison) {
    if (!owner || !UUID_VENDEUR.test(String(owner))) return null;
    const o = String(owner);
    return { filtre: `&owner=eq.${encodeURIComponent(o)}`, lignes: (rows) => rows.map((r) => ({ owner: o, ...r })), conflit: 'owner,id' };
  }
  return { filtre: '', lignes: withOwnerAll, conflit: conflictTarget('id') };
}

// Écrit (fusion par id) des lignes AU NOM du vendeur. true seulement si
// l'écriture a ABOUTI (§ « on n'acquitte pas ce qu'on n'a pas rangé »).
async function ecrireLignes(rows, owner) {
  if (!sbKey()) return false;
  const p = await portee(owner);
  if (!p) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${p.conflit}`, {
      method: 'POST',
      headers: { ...sbCle(sbKey()), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(p.lignes(rows)),
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── PLUSIEURS COMPTES eBAY PAR VENDEUR (9 octobre) ──────────────────────────
// Julien (6 octobre) : « donne la possibilité d'avoir plusieurs comptes eBay
// connectés, si c'est possible uniquement avec la connexion ». Il a un compte
// particulier ET un compte pro.
// ⇒ Chaque compte eBay a SES lignes : jetons, annonces, commandes, finances,
//   programmées, journal des retraits. Le PREMIER compte (« principal ») garde
//   les identifiants d'aujourd'hui (`ebay_tokens`, `ebay_listings`…) — la ligne
//   de Julien reste la sienne sans rien refaire ; chaque compte suivant a les
//   siennes, suffixées de sa clé (`ebay_tokens_{cle}`, `ebay_listings_{cle}`…).
//   On ne fusionne JAMAIS deux comptes dans une même ligne : l'union n'existe
//   qu'à l'affichage.
// ⇒ L'IDENTITÉ d'un compte (§5 : une identité, jamais une ressemblance) : eBay
//   la dit lui-même — Trading `GetUser` sans UserID rend le compte APPELANT :
//   `<EIASToken>` (identifiant stable) et `<UserID>` (le pseudo, qui peut
//   changer). La clé dérive de l'EIASToken haché ; le pseudo ne sert qu'à
//   l'affichage. Aucun nouveau droit n'est demandé (le droit de base suffit).
// ⇒ Le registre `ebay_comptes` (une ligne par vendeur, lisible par l'app) ne
//   porte QUE pseudo, clé et dates — JAMAIS un jeton. Les jetons restent dans
//   les lignes `ebay_tokens*`, que l'app ne lit jamais.
const COMPTES_ID = 'ebay_comptes';
const CLE_COMPTE = /^[0-9a-f]{16}$/;
// LA RÈGLE DU SUFFIXE — la même dans l'app (`suffixeCompteEbay`, §11 ;
// `audit-ebay-route.cjs` compare leurs sorties). Le principal n'en a pas.
const suffixeCompte = (c) => (c && !c.principal && CLE_COMPTE.test(String(c.cle || ''))) ? '_' + c.cle : '';
const cleCompteDe = (eias) => crypto.createHash('sha256').update('vrm-ebay-compte|' + String(eias)).digest('hex').slice(0, 16);
const PRINCIPAL = Object.freeze({ cle: '', pseudo: '', principal: true, suffixe: '' });
const pseudoPropre = (s) => String(s == null ? '' : s).replace(/&lt;|&gt;|&quot;|&apos;|&#39;|&amp;/g, (m) => ({ '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&amp;': '&' })[m])
  .replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 64);

// QUI vient de se connecter ? `{cle, pseudo}` ou `null` (« pas su » : réseau,
// refus, réponse sans EIASToken). ⚠️ NON MESURÉ sur son compte : le nom des
// balises vient de la documentation d'eBay (GetUser → User.UserID,
// User.EIASToken). Un `null` ne range JAMAIS un compte supplémentaire.
async function identiteEbay(token) {
  if (!token) return null;
  try {
    const r = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: { 'X-EBAY-API-CALL-NAME': 'GetUser', 'X-EBAY-API-SITEID': '71', 'X-EBAY-API-COMPATIBILITY-LEVEL': '1149', 'X-EBAY-API-IAF-TOKEN': token, 'Content-Type': 'text/xml' },
      body: '<?xml version="1.0" encoding="utf-8"?><GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents"></GetUserRequest>',
    });
    const xml = await r.text();
    if (!r.ok || !/<Ack>\s*(Success|Warning)\s*<\/Ack>/i.test(xml)) return null;
    const user = (/<User>([\s\S]*?)<\/User>/.exec(xml) || [])[1];
    if (!user) return null;
    const eias = ((/<EIASToken>([\s\S]*?)<\/EIASToken>/.exec(user) || [])[1] || '').trim();
    const pseudo = pseudoPropre((/<UserID>([\s\S]*?)<\/UserID>/.exec(user) || [])[1] || '');
    if (eias.length < 8) return null;
    // (17 octobre) PRO OU PARTICULIER — `User.SellerInfo.SellerBusinessType`
    // (doc d'eBay : Commercial · Private · Undefined). ⚠️ NON MESURÉ sur ses
    // comptes. Seuls « Commercial » et « Private » disent quelque chose ;
    // absent ou « Undefined » ⇒ '' (pas su : jamais « particulier » par défaut).
    const seller = (/<SellerInfo>([\s\S]*?)<\/SellerInfo>/.exec(user) || [])[1] || '';
    const bt = ((/<SellerBusinessType>([\s\S]*?)<\/SellerBusinessType>/.exec(seller) || [])[1] || '').trim().toLowerCase();
    const type = bt === 'commercial' ? 'pro' : bt === 'private' ? 'particulier' : '';
    return { cle: cleCompteDe(eias), pseudo, type };
  } catch (_) { return null; }
}

// Le registre de CE vendeur. TROIS états : `undefined` pas su · `{comptes}`
// lu (ligne absente ⇒ liste vide). Une entrée sans clé valide n'est gardée que
// pour le principal (dont l'identité a pu ne jamais être apprise).
async function lireComptes(owner) {
  const d = await lireDonnee(COMPTES_ID, owner);
  if (d === undefined) return undefined;
  return normaliserRegistre(d);
}
// La donnée brute d'une ligne `ebay_comptes` (ou null) ⇒ `{comptes, absent}`.
function normaliserRegistre(d) {
  const brut = (d && Array.isArray(d.comptes)) ? d.comptes : [];
  const comptes = brut.filter((e) => e && typeof e === 'object').map((e) => ({
    cle: CLE_COMPTE.test(String(e.cle || '')) ? String(e.cle) : '',
    pseudo: pseudoPropre(e.pseudo),
    principal: e.principal === true,
    ajouteLe: Number(e.ajouteLe) || null,
    vuLe: Number(e.vuLe) || null,
    deconnecteLe: Number(e.deconnecteLe) || null,
    // Pro / particulier lu chez eBay (GetUser). '' = demandé, eBay ne l'a pas
    // dit ; absent (undefined) = jamais demandé.
    ...(e.type === 'pro' || e.type === 'particulier' || e.type === '' ? { type: e.type, typeLuLe: Number(e.typeLuLe) || null } : {}),
  })).filter((e) => e.principal || e.cle);
  return { comptes, absent: d === null };
}
// Lire-modifier-réécrire le registre. `fn(comptes)` rend la nouvelle liste, ou
// `null` (rien à écrire). Une lecture ratée n'écrit RIEN (« rien lu » ne vaut
// pas « rien » : repartir de vide effacerait ses autres comptes). Rend true
// (écrit) · false (écriture ratée) · null (rien écrit : pas su, ou rien à faire).
// (17 octobre) Comparer-et-échanger (`modifierDonnee`) : deux connexions eBay
// qui se croisent (un 2e compte relié pendant que le principal apprend son
// identité) relisaient la même version, et la seconde écrite effaçait
// l'entrée de la première — un compte relié absent de la liste.
async function modifierComptes(owner, fn) {
  let rien = false;
  const r = await modifierDonnee(COMPTES_ID, owner, (d) => {
    const neuf = fn(normaliserRegistre(d).comptes.map((e) => ({ ...e })));
    rien = !neuf;
    return neuf ? { comptes: neuf, maj: Date.now() } : undefined;
  });
  return (r === true && rien) ? null : r;
}
// Les comptes ACTIFS (ni déconnectés) ; le principal est sous-entendu tant que
// son identité n'est pas apprise. ⚠️ La MÊME règle que l'app
// (`comptesEbayActifs`, §11) : le sélecteur, l'affichage, le CA et les
// sécurités regardent la même liste.
function comptesActifs(reg) {
  const l = (reg && Array.isArray(reg.comptes)) ? reg.comptes : [];
  const actifs = l.filter((e) => !e.deconnecteLe);
  const out = actifs.map((e) => ({ ...e, suffixe: suffixeCompte(e) }));
  if (!l.some((e) => e.principal)) out.unshift({ ...PRINCIPAL, implicite: true });
  return out;
}

// Range le refresh_token côté serveur, chez CE vendeur, dans la ligne de CE
// compte eBay (`suffixe` : '' pour le principal).
async function storeRefresh(refresh, expiresInDays, owner, suffixe = '') {
  return ecrireLignes([{ id: TOKENS_ID + (suffixe || ''), data: { refresh_token: refresh, saved_at: Date.now(), refresh_expires_days: expiresInDays || null } }], owner);
}

// L'échange seul (rien n'est rangé) : `{ok, refresh, access, jours}`.
async function echangerCode(code) {
  if (!code) return { ok: false, status: 400, error: 'code manquant' };
  if (!ruName()) return { ok: false, status: 503, reason: 'no-runame', error: 'RuName non configuré (EBAY_RUNAME).' };
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(ruName())}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status >= 500 ? 502 : r.status, error: 'eBay a refusé l\'échange', detail: (j && (j.error_description || j.error)) || '' };
  if (!j.refresh_token) return { ok: false, status: 502, error: 'eBay n\'a pas renvoyé de refresh_token' };
  return { ok: true, refresh: j.refresh_token, access: j.access_token || '', jours: j.refresh_token_expires_in ? Math.round(j.refresh_token_expires_in / 86400) : null };
}
const RANGE_KO = { ok: false, status: 500, reason: 'store-failed', error: 'Jetons reçus mais impossible de les ranger (SUPABASE_SERVICE_KEY manquante ou base injoignable).' };

// Échange le code de consentement contre les jetons ET les range chez `owner`
// dans le compte PRINCIPAL — le comportement d'avant, gardé tel quel pour une
// base PAS ENCORE cloisonnée (un seul compte) et pour le tout premier compte.
async function exchangeCode(code, owner) {
  const e = await echangerCode(code);
  if (!e.ok) return e;
  const stored = await storeRefresh(e.refresh, e.jours, owner, '');
  if (!stored) return RANGE_KO;
  return { ok: true, status: 200, connected: true };
}

// ── AU RETOUR DU CONSENTEMENT : QUEL COMPTE eBAY VIENT DE SE CONNECTER ? ─────
// Base cloisonnée seulement (pas encore cloisonnée ⇒ `exchangeCode`, comme
// avant : un seul compte). Dans l'ordre :
//   · ce qu'on sait AVANT de toucher au code (registre, compte principal) —
//     « pas su » ⇒ rien n'est rangé ;
//   · l'échange, puis `GetUser` avec le jeton tout neuf ;
//   · même identité qu'un compte connu ⇒ SES jetons sont mis à jour (aucun
//     doublon) ; identité nouvelle ⇒ compte ajouté ;
//   · ⚠️ identité ILLISIBLE ⇒ le tout premier compte garde le comportement
//     d'avant (principal) ; sinon on REFUSE : jamais deux comptes mélangés,
//     jamais un jeton qui écrase celui d'un autre compte. Pareil si l'identité
//     du principal est inconnue et ne peut pas être apprise.
// `ajout` (signé dans le state) : il a cliqué « Connecter un AUTRE compte ».
const REFUS_IDENTITE = { ok: false, status: 409, reason: 'identite-illisible', error: 'Je n\'ai pas pu savoir quel compte eBay vient de se connecter — rien n\'a été ajouté, réessaie.' };
const REFUS_PRINCIPAL = { ok: false, status: 409, reason: 'principal-inconnu', error: 'Je n\'ai pas pu relire ton premier compte eBay pour savoir si c\'est le même — rien n\'a été ajouté. Réessaie ; s\'il n\'est plus à toi, déconnecte-le d\'abord.' };
async function rangerConnexion(code, owner, opts = {}) {
  const ajout = !!(opts && opts.ajout);
  if (!(await baseCloisonnee())) {
    if (ajout) return { ok: false, status: 409, reason: 'un-seul-compte', error: 'Un seul compte eBay tant que la base n\'est pas cloisonnée.' };
    return exchangeCode(code, owner);
  }
  const reg = await lireComptes(owner);
  const refP = reg === undefined ? undefined : await lireRefresh(owner, '');
  if (reg === undefined || refP === undefined) return { ok: false, status: 503, reason: 'comptes-pas-su', error: 'Je n\'ai pas pu relire tes comptes eBay (base injoignable) — rien n\'a été rangé, réessaie.' };
  const e = await echangerCode(code);
  if (!e.ok) return e;
  const id = await identiteEbay(e.access);
  const entrees = reg.comptes;
  const princ = entrees.find((x) => x.principal);
  const autres = entrees.filter((x) => !x.principal);
  const maintenant = Date.now();
  // Range les jetons PUIS le registre (une entrée à poser ou à rafraîchir).
  // L'écriture des jetons d'abord : un registre écrit sur des jetons perdus
  // annoncerait un compte relié qui ne l'est pas.
  const ranger = async (suffixe, entreesNeuves, compte, nouveau) => {
    if (!(await storeRefresh(e.refresh, e.jours, owner, suffixe))) return RANGE_KO;
    if (entreesNeuves) {
      const w = await modifierComptes(owner, (l) => entreesNeuves(l));
      if (w !== true) return { ok: false, status: 502, reason: 'registre-ko', error: 'Le compte eBay est relié, mais je n\'ai pas pu le noter dans la liste de tes comptes — réessaie la connexion.' };
    }
    return { ok: true, status: 200, connected: true, compte: { cle: compte.cle || '', pseudo: compte.pseudo || '', principal: !!compte.principal }, nouveau: !!nouveau };
  };
  // Pose (ou remplace) l'entrée d'une identité dans une liste fraîchement relue.
  const poser = (l, entree) => [...l.filter((x) => !(x.principal && entree.principal) && x.cle !== entree.cle), entree];
  if (!id) {
    // Le tout premier compte (aucune entrée) : comportement d'avant.
    if (!ajout && entrees.length === 0) {
      if (!(await storeRefresh(e.refresh, e.jours, owner, ''))) return RANGE_KO;
      return { ok: true, status: 200, connected: true, compte: { cle: '', pseudo: '', principal: true }, nouveau: !refP };
    }
    return REFUS_IDENTITE;
  }
  const meme = entrees.find((x) => x.cle && x.cle === id.cle);
  if (meme) {
    const entree = { ...meme, pseudo: id.pseudo || meme.pseudo, vuLe: maintenant, deconnecteLe: null, type: id.type, typeLuLe: maintenant };
    return ranger(suffixeCompte(meme), (l) => poser(l, entree), entree, false);
  }
  const nouvelle = (principal) => ({ cle: id.cle, pseudo: id.pseudo, principal, ajouteLe: maintenant, vuLe: maintenant, deconnecteLe: null, type: id.type, typeLuLe: maintenant });
  if (refP && !princ) {
    // Le principal est relié mais son identité n'a jamais été apprise :
    // l'apprendre AVANT de décider (sinon on ne sait pas si c'est le même).
    const at = await accessToken(owner, '');
    const idP = at.ok ? await identiteEbay(at.token) : null;
    if (idP && idP.cle === id.cle) return ranger('', (l) => poser(l, nouvelle(true)), nouvelle(true), false);
    if (idP) {
      if (autres.some((x) => x.cle === idP.cle)) return REFUS_PRINCIPAL;
      const p = { cle: idP.cle, pseudo: idP.pseudo, principal: true, ajouteLe: maintenant, vuLe: maintenant, deconnecteLe: null, type: idP.type, typeLuLe: maintenant };
      const n = nouvelle(false);
      return ranger(suffixeCompte(n), (l) => poser(poser(l, p), n), n, true);
    }
    // Principal illisible : seul un RE-connexion, sans aucun autre compte,
    // garde le comportement d'avant (c'est le geste qui répare un jeton mort).
    if (!ajout && autres.length === 0) return ranger('', (l) => poser(l, nouvelle(true)), nouvelle(true), false);
    return REFUS_PRINCIPAL;
  }
  if (!refP && entrees.length === 0) return ranger('', (l) => poser(l, nouvelle(true)), nouvelle(true), true);
  const n = nouvelle(false);
  return ranger(suffixeCompte(n), (l) => poser(l, n), n, true);
}

// Le principal relié dont l'identité n'est pas encore apprise : on la demande
// à eBay « à la prochaine occasion » (ouverture de l'onglet, synchro) et on la
// range. Rien si la base n'est pas cloisonnée, si le registre est illisible,
// si eBay ne la dit pas, ou si cette identité occupe déjà un autre compte.
async function apprendrePrincipal(owner, token) {
  if (!(await baseCloisonnee())) return null;
  const reg = await lireComptes(owner);
  if (!reg || reg.comptes.some((x) => x.principal)) return null;
  let jeton = token;
  if (!jeton) { const at = await accessToken(owner, ''); if (!at.ok) return null; jeton = at.token; }
  const id = await identiteEbay(jeton);
  if (!id || reg.comptes.some((x) => x.cle === id.cle)) return null;
  const t = Date.now();
  return modifierComptes(owner, (l) => l.some((x) => x.principal || x.cle === id.cle) ? null
    : [{ cle: id.cle, pseudo: id.pseudo, principal: true, ajouteLe: t, vuLe: t, deconnecteLe: null, type: id.type, typeLuLe: t }, ...l]);
}

// (17 octobre) Pro ou particulier pour les comptes déjà reliés AVANT que VRM le
// demande : une question à eBay par compte (GetUser, une LECTURE), seulement si
// jamais demandé, ou si eBay ne l'avait pas dit il y a plus de 7 jours. Le
// registre se modifie en comparer-et-échanger ; un compte qui a changé
// entre-temps n'est pas touché. Rend true si quelque chose a été rangé.
const TYPE_RELECTURE_MS = 7 * 24 * 3600 * 1000;
async function apprendreTypes(owner, reg) {
  if (!reg || !Array.isArray(reg.comptes)) return null;
  const t0 = Date.now();
  const aLire = comptesActifs(reg).filter((c) => c.type === undefined || (c.type === '' && !(c.typeLuLe && t0 - c.typeLuLe < TYPE_RELECTURE_MS)));
  if (!aLire.length) return null;
  const lus = [];
  for (const c of aLire.slice(0, 3)) {
    const at = await accessToken(owner, suffixeCompte(c));
    if (!at.ok) continue;
    const id = await identiteEbay(at.token);
    // L'identité doit être CELLE du compte (la clé) — sinon on ne range rien.
    if (!id || (c.cle && id.cle !== c.cle)) continue;
    lus.push({ ref: c.principal ? '' : c.cle, principal: !!c.principal, type: id.type });
  }
  if (!lus.length) return null;
  const w = await modifierComptes(owner, (l) => {
    let change = false;
    const out = l.map((e) => { const x = lus.find((y) => (y.principal && e.principal) || (!y.principal && e.cle === y.ref)); if (!x) return e; change = true; return { ...e, type: x.type, typeLuLe: Date.now() }; });
    return change ? out : null;
  });
  return w === true;
}

// Le compte désigné par une requête (`compte` : absent ⇒ principal, sinon sa
// clé). VALIDÉ contre le registre de CE vendeur (base cloisonnée : lu
// `owner=eq.{vendeur}`) : un compte inconnu — ou celui d'un autre vendeur — ne
// désigne rien, et rien ne part chez eBay.
async function resoudreCompte(brut, owner) {
  const v = String(brut == null ? '' : brut).trim().toLowerCase();
  if (!v) return { ok: true, compte: { ...PRINCIPAL } };
  if (!CLE_COMPTE.test(v)) return { ok: false, status: 400, body: { ok: false, reason: 'compte', error: 'Compte eBay mal désigné — rien n\'a été envoyé à eBay.' } };
  if (!(await baseCloisonnee())) return { ok: false, status: 404, body: { ok: false, reason: 'compte-inconnu', error: 'Un seul compte eBay tant que la base n\'est pas cloisonnée — rien n\'a été envoyé à eBay.' } };
  const reg = await lireComptes(owner);
  if (reg === undefined) return { ok: false, status: 503, body: { ok: false, reason: 'comptes-pas-su', error: 'Je n\'ai pas pu relire tes comptes eBay — rien n\'a été envoyé à eBay.' } };
  const e = reg.comptes.find((x) => x.cle === v);
  if (!e) return { ok: false, status: 404, body: { ok: false, reason: 'compte-inconnu', error: 'Ce compte eBay n\'est pas relié à ton compte VRM — rien n\'a été envoyé à eBay.' } };
  if (e.deconnecteLe) return { ok: false, status: 409, body: { ok: false, reason: 'compte-deconnecte', error: `Le compte eBay « ${e.pseudo || 'sans nom'} » est déconnecté — reconnecte-le d'abord. Rien n'a été envoyé à eBay.` } };
  return { ok: true, compte: { cle: e.cle, pseudo: e.pseudo, principal: e.principal, suffixe: suffixeCompte(e) } };
}

// Déconnecter UN compte : ses jetons sont vidés, il est marqué déconnecté dans
// le registre. Les autres comptes ne sont pas touchés ; ses lignes de données
// restent en base (rien n'est supprimé) mais ne sont plus lues — il sort du
// sélecteur, de l'affichage, du CA et des sécurités, et une reconnexion du
// même compte eBay le retrouve tel quel.
async function deconnecterCompte(compte, owner) {
  const ok = await ecrireLignes([{ id: TOKENS_ID + (compte.suffixe || ''), data: { refresh_token: '', deconnecteLe: Date.now() } }], owner);
  if (!ok) return { ok: false, status: 502, reason: 'store-failed', error: 'Je n\'ai pas pu déconnecter ce compte (base injoignable) — rien n\'a changé, réessaie.' };
  if (!(await baseCloisonnee())) return { ok: true, status: 200, registre: null };
  const t = Date.now();
  const w = await modifierComptes(owner, (l) => {
    const i = l.findIndex((x) => compte.principal ? x.principal : x.cle === compte.cle);
    if (i >= 0) { l[i] = { ...l[i], deconnecteLe: t }; return l; }
    return compte.principal ? [{ cle: '', pseudo: '', principal: true, ajouteLe: null, vuLe: null, deconnecteLe: t }, ...l] : null;
  });
  return { ok: true, status: 200, registre: w === true };
}

// Le refresh_token rangé pour CE vendeur et CE compte. TROIS états, jamais
// deux : `undefined` = pas su (base injoignable, vendeur inconnu) · `''` =
// aucun compte eBay relié · la valeur. Avant, « pas su » valait « pas
// connecté » : un hoquet de la base disait « aucun compte eBay relié » à
// quelqu'un qui l'est.
async function lireRefresh(owner, suffixe = '') {
  if (!sbKey()) return undefined;
  const p = await portee(owner);
  if (!p) return undefined;
  if (suffixe && !/^_[0-9a-f]{16}$/.test(suffixe)) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${TOKENS_ID}${suffixe}${p.filtre}&select=refresh_token:data->>refresh_token`, {
      headers: { ...sbCle(sbKey()) },
    });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return (rows[0] && rows[0].refresh_token) || '';
  } catch (_) { return undefined; }
}
// Un compte est-il relié ? true / false / null (« pas su »).
async function hasRefresh(owner, suffixe = '') {
  const v = await lireRefresh(owner, suffixe);
  return v === undefined ? null : !!v;
}
// La valeur seule (ou null) — pour les lecteurs d'avant.
async function readRefresh(owner, suffixe = '') { return (await lireRefresh(owner, suffixe)) || null; }

// Échange le refresh_token de CE vendeur (et de CE compte eBay) contre un
// access_token frais (~2 h).
async function accessToken(owner, suffixe = '') {
  const refresh = await lireRefresh(owner, suffixe);
  if (refresh === undefined) return { ok: false, status: 503, reason: 'store-unreachable', error: 'Je n\'ai pas pu lire ta connexion eBay (base injoignable) — rien n\'a été envoyé à eBay.' };
  if (!refresh) return { ok: false, status: 401, reason: 'not-connected', error: 'Aucun compte eBay relié.' };
  // ⚠️ AUCUN `scope=` ici. eBay renvoie alors TOUS les droits déjà accordés à ce
  // refresh_token. Redemander `SCOPES` casserait tout le jour où on y ajoute un
  // droit (comme `sell.finances`) que le jeton actuel n'a pas encore : eBay
  // répond `invalid_scope` et plus RIEN ne se lit. Le nouveau droit s'obtient
  // en se reconnectant (nouveau consentement), pas en le réclamant au refresh.
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return { ok: false, status: r.status >= 500 ? 502 : (r.status || 502),
    reason: 'refresh-failed', error: 'Impossible de rafraîchir le jeton eBay', detail: (j && (j.error_description || j.error)) || '' };
  return { ok: true, token: j.access_token, expires_in: j.expires_in || null };
}

// Range n'importe quelle donnée captée (fusion par id), chez CE vendeur.
async function storeData(id, data, owner) {
  return ecrireLignes([{ id, data }], owner);
}

// Un réglage de CE vendeur (ligne `main`), lu en SCALAIRE (§4.4 : jamais la
// ligne entière, elle pèse ~200 Ko). TROIS états : `undefined` pas su ·
// `''` absent · la valeur en texte (`->>` rend « true » pour un booléen).
async function lireReglageVendeur(cle, owner) {
  if (!sbKey() || !/^[a-z0-9_]+$/i.test(String(cle || ''))) return undefined;
  const p = await portee(owner);
  if (!p) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main${p.filtre}&select=v:data->>${cle}`, { headers: { ...sbCle(sbKey()) } });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return (rows[0] && rows[0].v != null) ? String(rows[0].v) : '';
  } catch (_) { return undefined; }
}
// Une PETITE ligne de CE vendeur : `undefined` pas su · `null` absente · data.
async function lireDonnee(id, owner) {
  if (!sbKey() || !/^[a-z0-9_]+$/i.test(String(id || ''))) return undefined;
  const p = await portee(owner);
  if (!p) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&select=data`, { headers: { ...sbCle(sbKey()) } });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return rows[0] ? (rows[0].data || {}) : null;
  } catch (_) { return undefined; }
}

// Le curseur de commandes suffit pour préparer la page suivante. L'historique
// entier n'est lu qu'au moment de la fusion protégée par comparaison de version.
async function lireResumeCommandes(id, owner) {
  if (!sbKey() || !/^ebay_orders(?:_[a-z0-9_]+)?$/i.test(String(id || ''))) return undefined;
  const p = await portee(owner);
  if (!p) return undefined;
  const projection = 'rev:data->rev,capturedAt:data->capturedAt,generation:data->pagination->generation,nextOffset:data->pagination->nextOffset,complete:data->pagination->complete,lues:data->pagination->lues,total:data->pagination->total';
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&select=${projection}`, { headers: { ...sbCle(sbKey()) } });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    if (!rows[0]) return null;
    const {rev,capturedAt,generation,nextOffset,complete,lues,total} = rows[0];
    return {rev,capturedAt,...(generation != null ? {pagination:{generation,nextOffset,complete,lues,total}} : {})};
  } catch (_) { return undefined; }
}

// ── LIRE-MODIFIER-ÉCRIRE UNE PETITE LIGNE SANS PERDRE CELLE D'À CÔTÉ ──────────
// (11 octobre, revue de la règle d'offre.) `lireDonnee` puis `storeData`, c'est
// une fusion qui réécrit la ligne ENTIÈRE : deux requêtes du même vendeur qui
// se croisent (deux cartes eBay, une pose et un retrait à 50 ms) relisent la
// même version, et la seconde écrite remplace la première — la base disait
// « aucune règle » sur une annonce qu'eBay vendait dès 72 €, les deux réponses
// disant « rangé ». Aucun verrou, aucune version : rien ne pouvait le voir.
// ⇒ COMPARER-ET-ÉCHANGER sur une version portée par la ligne (`data.rev`) :
//   · ligne absente ⇒ INSERT SANS fusion (un autre l'a créée entre-temps :
//     409, on relit) ;
//   · ligne présente ⇒ PATCH filtré sur la version LUE
//     (`data->>rev=eq.N`, ou `is.null` pour une ligne d'avant) : Postgres
//     réévalue ce filtre APRÈS avoir pris le verrou de la ligne, donc une
//     écriture concurrente fait rendre 0 ligne ⇒ on relit et on refait la
//     fusion sur ce que l'AUTRE a écrit.
// `modifier(d)` reçoit `null` (ligne absente) ou l'objet lu, et rend l'objet à
// écrire (sans `rev` : posé ici) ou `undefined` (rien à écrire). Il peut être
// appelé PLUSIEURS fois : il ne doit dépendre que de ce qu'il reçoit.
// Trois issues, comme `storeData` + `lireDonnee` : true écrit · false écriture
// ratée (ou toujours devancée) · null pas su (la LECTURE a échoué ⇒ rien
// n'est écrit — repartir de vide effacerait la ligne).
async function modifierDonnee(id, owner, modifier, essais = 6) {
  if (!sbKey() || !/^[a-z0-9_]+$/i.test(String(id || ''))) return null;
  const p = await portee(owner);
  if (!p) return null;
  const json = { ...sbCle(sbKey()), 'content-type': 'application/json' };
  for (let n = 0; n < essais; n++) {
    let rows;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&select=data`, { headers: { ...sbCle(sbKey()) } });
      if (!r.ok) return null;
      rows = await r.json();
    } catch (_) { return null; }
    if (!Array.isArray(rows)) return null;
    const present = !!rows[0];
    const d = present ? (rows[0].data || {}) : null;
    const nouveau = modifier(d);
    if (nouveau === undefined) return true;
    const rev0 = (d && d.rev != null) ? d.rev : null;
    const data = { ...nouveau, rev: (Number.isSafeInteger(rev0) && rev0 >= 0 ? rev0 : 0) + 1 };
    try {
      if (!present) {
        const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
          method: 'POST', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify(p.lignes([{ id, data }])),
        });
        if (w.ok) return true;
        if (w.status === 409) continue;          // créée entre-temps : on relit
        return false;
      }
      const cond = rev0 == null ? 'data->>rev=is.null' : `data->>rev=eq.${encodeURIComponent(typeof rev0 === 'object' ? JSON.stringify(rev0) : String(rev0))}`;
      const w = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&${cond}&select=id`, {
        method: 'PATCH', headers: { ...json, Prefer: 'return=representation' }, body: JSON.stringify({ data }),
      });
      if (!w.ok) return false;
      const out = await w.json().catch(() => null);
      if (!Array.isArray(out)) return false;
      if (out.length >= 1) return true;
      // 0 ligne : un autre a écrit (ou supprimé) entre la lecture et l'écriture.
      // Une attente FIXE et courte (nos propres lectures, pas Vinted — §3 ne
      // s'applique pas) laisse l'autre finir.
      await new Promise((ok) => setTimeout(ok, 30 * (n + 1)));
    } catch (_) { return false; }
  }
  return false;
}

// ── LA RÈGLE D'OFFRE eBAY (9 octobre) ─────────────────────────────────────────
// Julien : « je veux juste définir une règle sur chaque annonce et à chaque
// offre au-dessus ça accepte ». C'est le réglage NATIF d'eBay (Offre directe) :
// c'est eBay qui accepte, au seuil qu'il fixe, annonce par annonce, sur SON
// clic. VRM n'appelle jamais une route d'acceptation (Vinted n'est pas touché,
// §3 du dossier). Deux règles PARTAGÉES avec l'app (§11) : `valideRegleOffre`
// et `seuilTropBas` y ont des copies IDENTIQUES — `audit-ebay-route.cjs`
// compare leurs sorties.
// accepte : number | null (null = pas de règle d'acceptation)
// refuse  : number | null | undefined (undefined = « ne touche pas au refus »)
// prix    : number | null (null = pas encore connu : la route le relit chez eBay)
// Rend { ok:true, accepte, refuse } (montants arrondis au centime) ou
//      { ok:false, code, err }.
const MONTANT_MAX = 99999.99;
// ⚠️ (11 octobre, revue) « > 0 » ne suffisait pas : 1e-9 passait (1e-7 de
// tolérance sur les centimes), s'arrondissait à 0 et partait chez eBay en
// « BestOfferAutoAcceptPrice 0.00 » — par la création, sans aucune
// confirmation. Un montant vaut au moins UN centime UNE FOIS ARRONDI.
function montantOk(v) {
  return typeof v === 'number' && Number.isFinite(v) && v <= MONTANT_MAX && Math.round(v * 100) >= 1
    && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
}
function valideRegleOffre({ accepte, refuse, prix }) {
  if (accepte !== null && !montantOk(accepte)) return { ok: false, code: 'montant', err: 'Un montant en euros, par exemple 72 ou 72,50.' };
  if (refuse !== undefined && refuse !== null && !montantOk(refuse)) return { ok: false, code: 'refuse-montant', err: 'Le refus : un montant en euros, par exemple 50.' };
  const A = accepte === null ? null : Math.round(accepte * 100);
  const R = (refuse === undefined || refuse === null) ? refuse : Math.round(refuse * 100);
  if (A === null && R != null) return { ok: false, code: 'refuse-seul', err: 'Le refus va avec un montant d\'acceptation.' };
  if (A !== null && R != null && R >= A) return { ok: false, code: 'refuse', err: 'Le refus doit être sous le montant d\'acceptation.' };
  if (A !== null && prix != null && Number.isFinite(prix) && A >= Math.round(prix * 100)) return { ok: false, code: 'seuil-prix', err: `Ce montant doit rester sous le prix de l'annonce (${(prix).toFixed(2).replace('.', ',')} €) : eBay refuse une règle égale ou supérieure au prix.` };
  return { ok: true, accepte: A === null ? null : A / 100, refuse: R === undefined ? undefined : (R === null ? null : R / 100) };
}
// Un seuil sous la MOITIÉ du prix : la faute de frappe « 7 » au lieu de « 72 ».
// Il n'est accepté que confirmé explicitement (`sousMoitie: true`). En centimes
// entiers : 50 % pile n'est PAS « trop bas ».
function seuilTropBas(accepte, prix) {
  if (typeof accepte !== 'number' || !Number.isFinite(accepte) || typeof prix !== 'number' || !Number.isFinite(prix) || !(prix > 0)) return false;
  return 2 * Math.round(accepte * 100) < Math.round(prix * 100);
}

export { SCOPES, appId, certId, ruName, keysReady, canConsent, authUrl, appToken, exchangeCode, hasRefresh, readRefresh, lireRefresh, accessToken, storeData, portee, lireReglageVendeur, lireDonnee, lireResumeCommandes, modifierDonnee,
  COMPTES_ID, CLE_COMPTE, suffixeCompte, cleCompteDe, identiteEbay, lireComptes, normaliserRegistre, modifierComptes, comptesActifs, rangerConnexion, apprendrePrincipal, apprendreTypes, resoudreCompte, deconnecterCompte,
  MONTANT_MAX, montantOk, valideRegleOffre, seuilTropBas };
