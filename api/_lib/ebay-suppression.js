// api/_lib/ebay-suppression.js
// ────────────────────────────────────────────────────────────────────────────
// SUPPRESSION D'UN COMPTE eBAY (« Marketplace Account Deletion », 2 nov.)
//
// eBay prévient chaque application quand un de SES utilisateurs ferme son
// compte. L'engagement pris en s'y abonnant : effacer les données de cet
// utilisateur (doc officielle « Marketplace User Account Deletion »). VRM
// répondait 200 sans rien vérifier ni rien effacer.
//
// Ce que dit eBay (doc officielle et code officiel `event-notification-nodejs-sdk`) :
//   · le défi GET : SHA-256 de challengeCode + verificationToken + adresse, en
//     hexadécimal, rendu `{ "challengeResponse": … }` en JSON (route `api/ebay.js`) ;
//   · le POST porte `x-ebay-signature` : du base64 d'un JSON `{alg, kid,
//     signature, digest}` ; la clé publique se lit par
//     `GET /commerce/notification/v1/public_key/{kid}` avec un jeton
//     d'APPLICATION (`{algorithm:"ECDSA", digest:"SHA1", key:"-----BEGIN…"}`),
//     à garder en cache (une heure conseillée) ; signature ECDSA/SHA-1 ;
//   · signature fausse ⇒ 412 ; acquitter par 200/201/202/204 ; tout le reste
//     est RENVOYÉ par eBay jusqu'à acquittement.
//
// ⇒ Ici, dans l'ordre :
//   1. signature absente, illisible ou fausse ⇒ 412, RIEN n'est lu ni écrit ;
//      clé publique illisible (réseau, eBay en panne, pas de jeton
//      d'application) ⇒ 503 : eBay rejouera, rien n'est effacé sans preuve ;
//   2. signature bonne ⇒ chez TOUS les vendeurs (clé de service, lecture
//      paginée), les commandes eBay (`ebay_orders{suffixe}`) où cet utilisateur
//      est l'ACHETEUR perdent pseudo, nom, adresse, e-mail, téléphone, notes ;
//      montants, dates, n° de commande et articles RESTENT (la compta en a
//      besoin). Où il est le VENDEUR, seul son pseudo (`sellerId`) est remplacé ;
//   3. s'il est un VENDEUR relié à VRM (son compte eBay est dans un registre
//      `ebay_comptes`, reconnu par la clé dérivée de son EIASToken ou par son
//      pseudo exact) : ce compte est DÉCONNECTÉ comme par « Déconnecter »
//      (jetons vidés — ils ne servent plus à rien, le compte n'existe plus), son
//      pseudo devient la marque neutre ;
//   4. une lecture ou une écriture ratée ⇒ 503 (eBay rejoue ; chaque étape est
//      idempotente : une commande déjà anonymisée ne se réécrit pas).
// L'identité est TOUJOURS une égalité exacte (pseudo eBay, sans casse ;
// EIASToken) — jamais une ressemblance (§5).
//
// (6 novembre, charge) eBay envoie CETTE notification pour TOUS ses
// utilisateurs du monde (~3/min, 4 640 en 24 h) ; presque aucun n'est chez
// nous. Chaque notification relisait le registre `ebay_comptes` de TOUS les
// vendeurs (O(nombre de vendeurs) lignes rendues) et parcourait toutes les
// lignes `app_data` (aucun index sur `id` seul) — deux fois. Désormais :
//   · avec la migration 026 (`vrm_ebay_cibles`, index sur les identités eBay
//     rangées) : UNE lecture indexée rend seulement les lignes où ce pseudo ou
//     cette clé figurent — 0 la plupart du temps ;
//   · sans elle (fonction absente : 404), le chemin d'avant, mais filtré PAR LA
//     BASE : le registre n'est rendu que s'il contient le pseudo ou la clé
//     (`ilike`, un sur-ensemble : la règle exacte ci-dessous trie ensuite).
// Ni la règle ni l'obligation ne changent : tout ce qui est rendu passe par la
// même égalité exacte, une lecture ratée ⇒ 503 (eBay renvoie).
// ────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { ordreStable, finALaFrontiere } from './ordre-stable.js';

export const MARQUE_SUPPRIME = 'compte eBay supprimé';
const URL_CLE = 'https://api.ebay.com/commerce/notification/v1/public_key/';
const KID_OK = /^[A-Za-z0-9._-]{1,128}$/;
const CLE_HEURE_MS = 60 * 60 * 1000;
// Le `kid` est choisi par l'EXPÉDITEUR : des notifications forgées avec des
// `kid` au hasard feraient lire une clé à chaque fois (quota de l'API
// Notification). Un `kid` inconnu d'eBay est retenu « refusé » une heure, et
// une instance ne demande pas plus de 10 clés nouvelles par heure.
const NOUVELLES_CLES_PAR_HEURE = 10;
const _cles = new Map();       // kid → { pem, digest, expire } ou { refuse:true, expire }
let _lectures = [];
export function oublierClesEbay() { _cles.clear(); _lectures = []; }

// ── LA SIGNATURE ─────────────────────────────────────────────────────────────
export function lireEnteteSignature(v) {
  if (typeof v !== 'string' || !v || v.length > 4096) return null;
  try {
    const j = JSON.parse(Buffer.from(v, 'base64').toString('utf8'));
    if (!j || typeof j !== 'object' || typeof j.kid !== 'string' || typeof j.signature !== 'string' || !j.signature) return null;
    if (!KID_OK.test(j.kid)) return null;
    return { alg: String(j.alg || ''), kid: j.kid, signature: j.signature, digest: String(j.digest || '') };
  } catch (_) { return null; }
}
// eBay rend la clé PEM sur une seule ligne (« -----BEGIN PUBLIC KEY-----MFkw…
// -----END PUBLIC KEY----- ») ; le code officiel la recoupe en lignes.
export function pemDe(cle) {
  const corps = String(cle || '').replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  if (!corps || !/^[A-Za-z0-9+/=]+$/.test(corps)) return null;
  return '-----BEGIN PUBLIC KEY-----\n' + corps.match(/.{1,64}/g).join('\n') + '\n-----END PUBLIC KEY-----\n';
}
const DIGESTS = { SHA1: 'sha1', SHA256: 'sha256', SHA384: 'sha384', SHA512: 'sha512' };

// La clé publique d'un `kid` : `{ok:true, pem, digest}` · `{ok:false, refus:true}`
// (eBay ne connaît pas ce kid ⇒ la signature ne peut pas être la sienne) ·
// `{ok:false}` (pas su ⇒ rejouer).
export async function clePublique(kid, { jetonApplication, oublierJetonApplication, fetcher = (...a) => globalThis.fetch(...a), maintenant = Date.now() } = {}) {
  const c = _cles.get(kid);
  if (c && c.expire > maintenant) return c.refuse ? { ok: false, refus: true } : { ok: true, pem: c.pem, digest: c.digest };
  _lectures = _lectures.filter((t) => t > maintenant - CLE_HEURE_MS);
  if (_lectures.length >= NOUVELLES_CLES_PAR_HEURE) return { ok: false, raison: 'trop-de-cles' };
  _lectures.push(maintenant);
  for (let essai = 0; essai < 2; essai++) {
    const jeton = await jetonApplication();
    if (!jeton) return { ok: false, raison: 'jeton-application' };
    let r, j;
    try {
      r = await fetcher(URL_CLE + encodeURIComponent(kid), { headers: { Authorization: 'Bearer ' + jeton, Accept: 'application/json' } });
      j = await r.json().catch(() => null);
    } catch (_) { return { ok: false, raison: 'reseau' }; }
    if (r.status === 401 && essai === 0) { oublierJetonApplication(); continue; }
    if (r.status === 404) { _cles.set(kid, { refuse: true, expire: maintenant + CLE_HEURE_MS }); return { ok: false, refus: true }; }
    if (!r.ok || !j || typeof j !== 'object') return { ok: false, raison: 'ebay-' + r.status };
    const pem = pemDe(j.key);
    const digest = DIGESTS[String(j.digest || '').toUpperCase().replace(/[^A-Z0-9]/g, '')];
    if (!pem || !digest || String(j.algorithm || '').toUpperCase() !== 'ECDSA') return { ok: false, raison: 'cle-illisible' };
    _cles.set(kid, { pem, digest, expire: maintenant + CLE_HEURE_MS });
    return { ok: true, pem, digest };
  }
  return { ok: false, raison: 'jeton-refuse' };
}

// La signature porte sur le corps tel qu'eBay l'a envoyé. Le code officiel
// d'eBay vérifie `JSON.stringify(message)` (le JSON re-sérialisé) : les deux
// coïncident pour un JSON compact. On essaie le corps brut, puis sa forme
// re-sérialisée — jamais rien d'autre. Rend le texte VÉRIFIÉ, ou null.
export function texteSigne(candidats, entete, cle) {
  let sig;
  try { sig = Buffer.from(entete.signature, 'base64'); } catch (_) { return null; }
  if (!sig.length) return null;
  const vus = new Set();
  for (const t of candidats) {
    if (typeof t !== 'string' || !t || vus.has(t)) continue;
    vus.add(t);
    try { if (crypto.verify(cle.digest, Buffer.from(t, 'utf8'), cle.pem, sig)) return t; } catch (_) {}
  }
  return null;
}

// ── L'ANONYMISATION D'UNE COMMANDE eBAY (Fulfillment API, `Order`) ───────────
const memeId = (v, u) => typeof v === 'string' && !!u && v.trim().toLowerCase() === u.toLowerCase();
const PERSO = new Set(['email', 'primaryPhone', 'secondaryPhone', 'phoneNumber', 'recipientEmail', 'senderName', 'companyName', 'taxIdentifier', 'buyerCheckoutNotes', 'giftDetails', 'finalDestinationAddress', 'shipToReferenceId']);
// Tout ce qui est une donnée de contact disparaît, toute chaîne égale à son
// pseudo devient la marque. Le reste (montants, dates, articles) ne bouge pas.
function nettoyer(v, u) {
  if (Array.isArray(v)) return v.map((x) => nettoyer(x, u));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { if (!PERSO.has(k)) o[k] = nettoyer(x, u); }
    return o;
  }
  return memeId(v, u) ? MARQUE_SUPPRIME : v;
}
const pays = (a) => (a && typeof a === 'object' && typeof a.countryCode === 'string') ? a.countryCode : null;
function adresseNeutre(dest) {
  if (!dest || typeof dest !== 'object') return dest;
  const p = pays(dest.contactAddress);
  return { fullName: MARQUE_SUPPRIME, ...(p ? { contactAddress: { countryCode: p } } : {}) };
}
export function anonymiserAcheteur(o, u) {
  const b = (o.buyer && typeof o.buyer === 'object') ? o.buyer : {};
  const p = pays(b.taxAddressDetails) || pays(b.buyerRegistrationAddress && b.buyerRegistrationAddress.contactAddress);
  const fsi = Array.isArray(o.fulfillmentStartInstructions) ? o.fulfillmentStartInstructions.map((f) => {
    if (!f || typeof f !== 'object') return f;
    const s = f.shippingStep;
    return (s && typeof s === 'object') ? { ...f, shippingStep: { ...s, shipTo: adresseNeutre(s.shipTo) } } : f;
  }) : o.fulfillmentStartInstructions;
  const out = nettoyer({ ...o, fulfillmentStartInstructions: fsi }, u);
  out.buyer = { username: MARQUE_SUPPRIME, ...(p ? { taxAddressDetails: { countryCode: p } } : {}) };
  if (out.fulfillmentStartInstructions === undefined) delete out.fulfillmentStartInstructions;
  out._compteEbaySupprime = true;
  return out;
}
// La donnée d'une ligne `ebay_orders*` ⇒ la nouvelle donnée, ou `undefined`
// (rien à changer : cet utilisateur n'y figure pas, ou plus).
export function anonymiserLigneCommandes(d, u) {
  if (!u || !d || !Array.isArray(d.orders)) return undefined;
  let n = 0;
  const orders = d.orders.map((o) => {
    if (!o || typeof o !== 'object') return o;
    if (o.buyer && memeId(o.buyer.username, u)) { n++; return anonymiserAcheteur(o, u); }
    if (memeId(o.sellerId, u)) { n++; return { ...o, sellerId: MARQUE_SUPPRIME }; }
    return o;
  });
  if (!n) return undefined;
  const { rev: _rev, ...reste } = d;
  return { ...reste, orders };
}

// ── LA ROUTE ─────────────────────────────────────────────────────────────────
const ID_COMMANDES = /^ebay_orders(?:_[0-9a-f]{16})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PSEUDO_SUR = /^[A-Za-z0-9._-]{1,64}$/;

// ── QUI EST CONCERNÉ ? (migration 026) ───────────────────────────────────────
// `{ ok:true, lignes:[{owner,id}] }` · `{ absente:true }` (fonction pas encore
// créée : chemin sans elle) · `null` (pas su). La fonction rend les lignes
// `ebay_orders*` et `ebay_comptes` dont une identité rangée (pseudo en
// minuscules sans espaces autour, clé de compte) est dans `ids`.
// L'absence est retenue 10 min par instance (pas une sonde par notification).
const RPC_CIBLES = 'vrm_ebay_cibles';
let _rpcAbsenteJusqua = 0;
export function oublierRpcEbay() { _rpcAbsenteJusqua = 0; }
async function lireCibles(base, cle, sbCle, ids, fetcher, maintenant = Date.now()) {
  if (_rpcAbsenteJusqua > maintenant) return { absente: true };
  let r;
  try {
    r = await fetcher(`${base}/rest/v1/rpc/${RPC_CIBLES}`, { method: 'POST', headers: { ...sbCle(cle), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_ids: ids }) });
  } catch (_) { return null; }
  // PostgREST : fonction inconnue ⇒ 404 (PGRST202). Rien d'autre ne vaut « absente ».
  if (r.status === 404) {
    let j = null; try { j = await r.json(); } catch (_) {}
    if (j && j.code === 'PGRST202') { _rpcAbsenteJusqua = maintenant + 10 * 60 * 1000; return { absente: true }; }
    return null;
  }
  if (!r.ok) return null;
  let j; try { j = await r.json(); } catch (_) { return null; }
  // 1 000 lignes = le plafond silencieux de Supabase (§4.5) : « pas su ».
  if (!Array.isArray(j) || j.length >= 1000) return null;
  return { ok: true, lignes: j };
}
// L'identité telle que la fonction la range : minuscules, sans espaces autour.
export const idRangee = (v) => String(v == null ? '' : v).trim().toLowerCase();

// Toutes les lignes d'une requête, TOUS vendeurs (clé de service), par pages
// de 1 000 (§4.5 : Supabase coupe sans le dire). `null` = pas su.
async function lireToutesLignes(base, cle, sbCle, requete, fetcher) {
  const out = []; const page = 1000;
  for (let from = 0; from < 200000; from += page) {
    let r;
    try { r = await fetcher(ordreStable(`${base}/rest/v1/app_data?${requete}`), { headers: { ...sbCle(cle), 'Range-Unit': 'items', Range: `${from}-${from + page - 1}` } }); }
    catch (_) { return null; }
    if (finALaFrontiere(r, from)) return out;   // (11 nov.) 416 à une frontière exacte = fin de liste
    if (!r.ok) return null;
    let j; try { j = await r.json(); } catch (_) { return null; }
    if (!Array.isArray(j)) return null;
    out.push(...j);
    if (j.length < page) return out;
  }
  return null;
}

// Le corps reçu, sous ses formes vérifiables : le flux brut s'il est encore
// lisible (2 s au plus), sinon `req.rawBody` / `req.body` (texte, octets, ou
// objet déjà analysé par la plateforme ⇒ sa re-sérialisation, comme le code
// officiel d'eBay).
async function corpsRecu(req) {
  const morceaux = [];
  try {
    if (req && typeof req[Symbol.asyncIterator] === 'function' && !req.readableEnded) {
      const lire = (async () => { for await (const c of req) morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); })();
      let minuterie;
      await Promise.race([lire.catch(() => {}), new Promise((ok) => { minuterie = setTimeout(ok, 2000); })]);
      clearTimeout(minuterie);
    }
  } catch (_) {}
  const candidats = [];
  const ajoute = (t) => { if (typeof t === 'string' && t) { candidats.push(t); try { candidats.push(JSON.stringify(JSON.parse(t))); } catch (_) {} } };
  if (morceaux.length) ajoute(Buffer.concat(morceaux).toString('utf8'));
  const b = req && (req.rawBody != null ? req.rawBody : req.body);
  if (Buffer.isBuffer(b)) ajoute(b.toString('utf8'));
  else if (typeof b === 'string') ajoute(b);
  else if (b && typeof b === 'object') { try { candidats.push(JSON.stringify(b)); } catch (_) {} }
  return candidats;
}

export async function traiterSuppressionEbay(req, dep) {
  const { supabaseUrl, cleService, sbCle, jetonApplication, oublierJetonApplication, modifierDonnee, deconnecterCompte, normaliserRegistre, suffixeCompte, cleCompteDe, fetcher = (...a) => globalThis.fetch(...a) } = dep;
  const h = (req && req.headers) || {};
  const entete = lireEnteteSignature(h['x-ebay-signature'] || h['X-EBAY-SIGNATURE'] || '');
  if (!entete) return { status: 412, body: { ok: false, reason: 'signature', error: 'Signature eBay absente ou illisible — rien n\'a été fait.' } };
  const cle = await clePublique(entete.kid, { jetonApplication, oublierJetonApplication, fetcher });
  if (!cle.ok) return cle.refus
    ? { status: 412, body: { ok: false, reason: 'signature', error: 'Clé de signature inconnue d\'eBay — rien n\'a été fait.' } }
    : { status: 503, body: { ok: false, reason: 'cle-pas-su', error: 'Je n\'ai pas pu lire la clé de signature d\'eBay — rien n\'a été fait, eBay renverra la notification.' } };
  const texte = texteSigne(await corpsRecu(req), entete, cle);
  if (!texte) return { status: 412, body: { ok: false, reason: 'signature', error: 'Signature eBay fausse — rien n\'a été fait.' } };
  let msg; try { msg = JSON.parse(texte); } catch (_) { return { status: 400, body: { ok: false, error: 'Notification illisible.' } }; }
  const topic = msg && msg.metadata && msg.metadata.topic;
  if (topic !== 'MARKETPLACE_ACCOUNT_DELETION') return { status: 200, body: { ok: true, ignore: 'sujet' } };
  const data = (msg.notification && msg.notification.data) || {};
  const u = typeof data.username === 'string' ? data.username.trim().slice(0, 128) : '';
  const eias = typeof data.eiasToken === 'string' ? data.eiasToken.trim() : '';
  if (!u && !eias) return { status: 200, body: { ok: true, ignore: 'sans-identite' } };
  // Chercher chez TOUS les vendeurs exige la clé de service : avec une clé
  // limitée par les règles de la base, « rien trouvé » ne voudrait rien dire.
  if (!cleService) return { status: 503, body: { ok: false, reason: 'sans-cle', error: 'Clé de service absente — rien n\'a été effacé, eBay renverra la notification.' } };

  const cleEias = eias ? cleCompteDe(eias) : '';
  // 0. Qui est concerné ? Avec la migration 026 : une lecture indexée. Le
  //    pseudo n'y sert que s'il est « sûr » (lettres, chiffres, . _ -) : un
  //    autre (jamais vu chez eBay) passe par le chemin complet.
  let cibles = null;
  if (!u || PSEUDO_SUR.test(u)) {
    const ids = [...new Set([u ? idRangee(u) : '', cleEias].filter(Boolean))];
    const c = await lireCibles(supabaseUrl, cleService, sbCle, ids, fetcher);
    if (c === null) return { status: 503, body: { ok: false, reason: 'base', error: 'La base n\'a pas répondu — rien n\'a été effacé, eBay renverra la notification.' } };
    if (c.ok) cibles = c.lignes.filter((l) => l && UUID.test(String(l.owner || '')));
  }

  // 1. Les commandes où il figure (acheteur ou vendeur).
  let commandes = 0;
  if (u) {
    const filtre = PSEUDO_SUR.test(u) ? `&data->>orders=ilike.${encodeURIComponent('*' + u + '*')}` : '';
    const lignes = cibles ? cibles.filter((l) => ID_COMMANDES.test(String(l.id || '')))
      : await lireToutesLignes(supabaseUrl, cleService, sbCle, `id=like.ebay_orders*&select=owner,id${filtre}&order=owner.asc,id.asc`, fetcher);
    if (!lignes) return { status: 503, body: { ok: false, reason: 'base', error: 'La base n\'a pas répondu — rien n\'a été effacé, eBay renverra la notification.' } };
    for (const l of lignes) {
      if (!l || !UUID.test(String(l.owner || '')) || !ID_COMMANDES.test(String(l.id || ''))) continue;
      let change = false;
      const w = await modifierDonnee(l.id, l.owner, (d) => { const n = anonymiserLigneCommandes(d, u); change = n !== undefined; return n; });
      if (w !== true) return { status: 503, body: { ok: false, reason: 'base', error: 'Une ligne n\'a pas pu être réécrite — eBay renverra la notification.' } };
      if (change) commandes++;
    }
  }

  // 2. Un vendeur relié à VRM dont c'est le compte eBay. Seuls les registres
  //    qui PEUVENT le porter sont lus : ceux que la fonction désigne, ou (sans
  //    elle) ceux dont le texte contient son pseudo ou sa clé — un sur-ensemble
  //    (`ilike` ignore la casse, `_` y vaut n'importe quel caractère) que la
  //    règle exacte (`cible`) trie ensuite. Pseudo « pas sûr » ⇒ tout est lu.
  let requeteRegistres = 'id=eq.ebay_comptes&select=owner,comptes:data->comptes&order=owner.asc';
  if (cibles) {
    const owners = [...new Set(cibles.filter((l) => l.id === 'ebay_comptes').map((l) => String(l.owner)))];
    requeteRegistres = owners.length ? `${requeteRegistres}&owner=in.(${owners.join(',')})` : '';
  } else if (!u || PSEUDO_SUR.test(u)) {
    const motifs = [u, cleEias].filter(Boolean).map((x) => `data->>comptes.ilike.*${x}*`);
    requeteRegistres = motifs.length ? `${requeteRegistres}&or=(${encodeURIComponent(motifs.join(','))})` : '';
  }
  const registres = requeteRegistres ? await lireToutesLignes(supabaseUrl, cleService, sbCle, requeteRegistres, fetcher) : [];
  if (!registres) return { status: 503, body: { ok: false, reason: 'base', error: 'La base n\'a pas répondu — eBay renverra la notification.' } };
  const cible = (e) => !!e && ((cleEias && e.cle === cleEias) || (u && memeId(e.pseudo, u)));
  let vendeurs = 0;
  for (const reg of registres) {
    if (!reg || !UUID.test(String(reg.owner || ''))) continue;
    const touches = normaliserRegistre({ comptes: reg.comptes }).comptes.filter(cible).filter((e) => !(e.deconnecteLe && e.pseudo === MARQUE_SUPPRIME));
    for (const e of touches) {
      const dc = await deconnecterCompte({ cle: e.cle, principal: e.principal, suffixe: suffixeCompte(e) }, reg.owner);
      if (!dc || dc.ok !== true || dc.registre === false) return { status: 503, body: { ok: false, reason: 'base', error: 'Le compte eBay supprimé n\'a pas pu être déconnecté — eBay renverra la notification.' } };
      // Le registre se relit et se réécrit en comparer-et-échanger : `true` écrit
      // (ou rien à faire), `false` écriture ratée, `null` lecture ratée.
      const w = await modifierDonnee('ebay_comptes', reg.owner, (d) => {
        let ch = false;
        const out = normaliserRegistre(d).comptes.map((x) => { if (!cible(x) || x.pseudo === MARQUE_SUPPRIME) return x; ch = true; return { ...x, pseudo: MARQUE_SUPPRIME }; });
        return ch ? { comptes: out, maj: Date.now() } : undefined;
      });
      if (w !== true) return { status: 503, body: { ok: false, reason: 'base', error: 'Le compte eBay supprimé n\'a pas pu être renommé — eBay renverra la notification.' } };
      vendeurs++;
    }
  }
  // Rien de nominatif dans la réponse ni dans les journaux.
  return { status: 200, body: { ok: true, commandes, comptesDeconnectes: vendeurs } };
}
