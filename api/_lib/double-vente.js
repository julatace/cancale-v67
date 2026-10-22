// ════════════════════════════════════════════════════════════════════════════
//  DOUBLE VENTE, APP FERMÉE (fonction n°2 retenue le 11 octobre)
//
//  L'alerte « vendue sur Vinted → encore en vente sur eBay / Leboncoin » ne se
//  calculait que VRM ouvert (`doublesVenteEbay`, `doublesVenteLbc` dans l'app).
//  Ici, le serveur la calcule dès qu'une vente Vinted arrive par email
//  (bordereau, « ton article s'est vendu ») et envoie UNE notification — à la
//  seule condition que la paire soit PROUVÉE en vente ailleurs.
//
//  Identité par le N° SEULEMENT (§5) :
//    • eBay     : le SKU `VRM-{n°}` d'une annonce ACTIVE (`ebay_listings*`, ses
//                 comptes eBay actifs), traduit par la numérotation 013
//                 (`numeroExterne`, carte `ebayAnnonces`) — la même lecture que
//                 `numEbayLu` dans l'app ;
//    • Leboncoin: une annonce À LUI (`annonceLbcALui` : réf, CustomRef, compte
//                 prouvé par une de SES ventes), pas morte, pas vendue sur
//                 Leboncoin, dont la clé est le lien posé à la main
//                 (`vrm_lbc_liens`) ou la référence VRM (réf / CustomRef),
//                 traduite par `lbcAnnonces`.
//    ⚠️ Plus STRICT que l'app sur un point, exprès : le « nXXX » écrit dans le
//       TITRE d'une annonce Leboncoin n'est PAS retenu ici. C'est une
//       ressemblance (§5) et, après la remise à zéro du 11 octobre, il peut
//       porter l'ANCIEN numéro. Une notification se reçoit app fermée, sans
//       contexte pour la corriger : mieux vaut un blanc qu'un faux.
//
//  Fonctions PURES : `scripts/bancs/double-vente-push.cjs` exécute la route.
// ════════════════════════════════════════════════════════════════════════════
import { cleNum, numeroExterne } from './numerotation.js';

const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;
// STRICT : « VRM-125 », « VRM-B125 », et rien d'autre (la même que `numDeSkuEbay`).
export const numDeSku = (sku) => {
  const m = /^\s*VRM[-\s]?((?:[A-Z]{1,3})?\d{1,6})\s*$/i.exec(String(sku == null ? '' : sku));
  const c = m ? cleNum(m[1]) : '';
  return c && NUM_OK.test(c) ? c : '';
};
// La même que `refVRMDe` dans l'app et l'extension.
export const refVRMDe = (txt) => {
  const t = String(txt == null ? '' : txt);
  const m = /VRM[-\s]?((?:[A-Z]{1,3})?\d{1,6})(?!\d)/i.exec(t);
  if (m) return cleNum(m[1]);
  const d = /(\d{1,5})/.exec(t); return d ? cleNum(d[1]) : '';
};

// Les N° d'une vente (« 12+15 » pour un lot). Aucun N° ⇒ liste vide ⇒ rien.
export function numerosDeVente(numero) {
  return [...new Set(String(numero == null ? '' : numero).split('+').map(cleNum).filter((k) => k && NUM_OK.test(k)))];
}

// eBay. `lignes` : [{ id: 'ebay_listings' | 'ebay_listings_{clé}', items }],
// `idsActifs` : les identifiants de ligne des comptes eBay actifs (registre),
// `mk` : le marqueur 013 (`null` = aucun ; `undefined` = pas su, refusé par
// l'appelant). Rend Map N° → [{ itemId, titre }].
// (19 oct.) LE SKU SEUL NE DÉSIGNE PAS UNE PAIRE — la même règle que l'app
// (`numEbayLu`, App.jsx). Ses annonces VRM-82, 81, 48 publiées pendant la panne
// de synchro portaient des numéros redonnés le 18 à d'AUTRES paires : la vente
// de la Vapor Pro (N°82) aurait sonné « encore en vente sur eBay » sur l'annonce
// d'une Air Max. Dans l'ordre : le lien par identité (`vrm_ebay_liens`), sinon
// le SKU seulement s'il est porté par UNE fiche qui l'avait déjà à la
// publication. `fiches` illisibles ⇒ l'appelant ne lit rien (pas su).
const PANNE_NUMEROS = { de: '2026-10-11T14:58:00.000Z', a: '2026-10-18T09:30:00.000Z' };
const ficheAVerifier = (f) => {
  if (!f || typeof f !== 'object' || !String(f.numero == null ? '' : f.numero).trim() || f.cartonVerifie) return false;
  if (f.auto === false) return false;
  const t = String(f.numberedAt || '');
  if (f.manuelAt && String(f.manuelAt) > PANNE_NUMEROS.a) return false;
  return t >= PANNE_NUMEROS.de && t <= PANNE_NUMEROS.a;
};
export function numeroAnnonceEbay(a, mk, fiches, liensEbay) {
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  const lien = liensEbay && typeof liensEbay === 'object' ? liensEbay[String(a.itemId)] : null;
  if (lien && lien.pairId) { const f = F[lien.pairId]; return f && f.numero != null && String(f.numero).trim() ? cleNum(f.numero) : ''; }
  const k = numeroExterne(numDeSku(a.sku), a.itemId, 'ebayAnnonces', null, mk);
  if (!k) return '';
  const porteurs = Object.values(F).filter((f) => f && f.numero != null && cleNum(f.numero) === k);
  const tn = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();   // = normTitle (App.jsx)
  if (porteurs.length > 2 || (porteurs.length === 2 && (tn(porteurs[0].title) !== tn(porteurs[1].title) || porteurs.some(ficheAVerifier)))) return '';
  if (porteurs.length === 1) {
    const f = porteurs[0], pub = Date.parse(a.depuis || ''), quand = Date.parse(f.manuelAt || f.numberedAt || '');
    if (Number.isFinite(pub) && Number.isFinite(quand) && quand > pub + 60000) return '';
    if (!Number.isFinite(pub) && ficheAVerifier(f)) return '';
  }
  return k;
}
export function annoncesEbayParNumero(lignes, idsActifs, mk, fiches, liensEbay) {
  const out = new Map();
  const actifs = new Set(idsActifs || []);
  for (const l of (Array.isArray(lignes) ? lignes : [])) {
    if (!l || !actifs.has(l.id) || !Array.isArray(l.items)) continue;
    for (const a of l.items) {
      if (!a || !a.itemId) continue;
      const n = numeroAnnonceEbay(a, mk, fiches, liensEbay);
      if (!n) continue;                                    // pas de SKU, ou un SKU qui ne désigne plus sûrement une paire (§5)
      if (!out.has(n)) out.set(n, []);
      out.get(n).push({ itemId: String(a.itemId), titre: String(a.title || '') });
    }
  }
  return out;
}

// Leboncoin — les mêmes règles que l'écran Leboncoin de l'app (§11) :
// `comptesLbcProuves`, `annonceLbcALui`, et la règle « en vente » ci-dessous.
// <lbc-en-vente-regle> — LA MÊME, texte pour texte, dans l'app, l'extension et le
// serveur (§11 ; `audit-lbc-restes.cjs` compare les trois). Une annonce Leboncoin
// n'est « en vente » que si son état ne la dit pas morte ET qu'aucune vente
// PROUVÉE (il est le vendeur, `isSeller`, pas annulée) ne l'a emportée : la vente
// prime sur un `status: 'active'` périmé (mesuré le 20 octobre : ses 3 annonces
// vendues sont restées « active » en base). On ne juge JAMAIS sur une absence dans
// une liste paginée — seulement sur une vente vue.
const LBC_ANNONCE_MORTE = /(supprim|delete|expir|refus|sold|vendu)/i;
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
  return !!(ad && ad.id != null && !LBC_ANNONCE_MORTE.test(String(ad.status || '')) && !(vendues && vendues.has(String(ad.id))));
}
// </lbc-en-vente-regle>
export function annoncesLbcParNumero(items, ventes, liens, mk, accounts = {}) {
  const out = new Map();
  const prouves = new Set(), vendues = annoncesLbcVendues(ventes);
  for (const v of Object.values(ventes || {})) {
    if (!v || v.isSeller !== true || v.itemId == null) continue;
    const ad = items && items[String(v.itemId)];
    if (ad && ad.account) prouves.add(String(ad.account));
  }
  for(const [id,a] of Object.entries(accounts||{}))if(a?.sessionAt)prouves.add(String(a.id||id));
  const aLui = (ad) => !!(ad.ref || ad.customRef || (ad.lbcUser && prouves.has(String(ad.lbcUser))) || (ad.account && prouves.has(String(ad.account))));
  for (const ad of Object.values(items || {})) {
    if (!annonceLbcEnVente(ad, vendues) || !aLui(ad)) continue;
    const ks = [];
    const push = (v) => { const k = cleNum(v); if (k && NUM_OK.test(k) && !ks.includes(k)) ks.push(k); };
    const ext = (v) => { const k = cleNum(v); if (k) push(numeroExterne(k, ad.id, 'lbcAnnonces', null, mk)); };
    const lien = liens && liens[String(ad.id)];
    if (lien != null && String(lien).trim()) push(lien);
    if (ad.customRef) ext(refVRMDe(ad.customRef));
    if (ad.ref) ext(ad.ref);
    for (const k of ks) {
      if (!out.has(k)) out.set(k, []);
      out.get(k).push({ id: String(ad.id), titre: String(ad.subject || ad.title || '') });
    }
  }
  return out;
}

// Ce que la vente rencontre ailleurs. `ebay` / `lbc` : Map (lu) ou `null` (pas
// su ⇒ cette plateforme ne dit RIEN). Rend [{ numero, plateforme, annonces }].
export function doubleVenteApprise(numero, ebay, lbc) {
  const hits = [];
  for (const n of numerosDeVente(numero)) {
    if (ebay && ebay.has(n)) hits.push({ numero: n, plateforme: 'ebay', annonces: ebay.get(n) });
    if (lbc && lbc.has(n)) hits.push({ numero: n, plateforme: 'leboncoin', annonces: lbc.get(n) });
  }
  return hits;
}

const NOM = { ebay: 'eBay', leboncoin: 'Leboncoin' };
// La notification : la paire, le N°, la plateforme. Clé anti-doublon = la
// paire et les annonces qu'elle rencontre (identités) : le bordereau et l'email
// « vendu » d'une MÊME vente donnent la même clé, un email rejoué aussi.
export function notificationDoubleVente(hits, titre) {
  if (!hits.length) return null;
  const nums = [...new Set(hits.map((h) => h.numero))];
  const plats = [...new Set(hits.map((h) => h.plateforme))];
  const ou = plats.map((p) => NOM[p]).join(' et ');
  const n = nums.map((x) => 'N°' + x).join(', ');
  const paire = String(titre || '').trim().slice(0, 60);
  const ids = hits.flatMap((h) => h.annonces.map((a) => h.plateforme + ':' + (a.itemId || a.id))).sort();
  return {
    title: `⚠️ Vendue sur Vinted — ${n} encore en vente sur ${ou}`,
    body: `${paire ? paire + ' — ' : ''}${n} ${nums.length > 1 ? 'sont' : 'est'} encore en vente sur ${ou} : retire-la${plats.length > 1 ? ' des deux' : ''} pour ne pas la vendre deux fois.`,
    tag: `dv-${nums.join('+')}-${ids.join(',')}`.slice(0, 200),
    url: plats.includes('ebay') ? '/?tab=ebay_annonces' : '/?tab=leboncoin',
  };
}
