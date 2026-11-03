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
import { DESTINATIONS, lienNotif } from './lien-notif.js';
// (1er nov., audit A1) Vestiaire : ses annonces PROUVÉES en ligne, par identité
// (annonce créée par VRM ou référence VRM-n° — jamais le titre), la règle de
// l'app (api/_lib/vestiaire-regle.js, un propriétaire, importée).
import { annoncesVcEnLigne } from './vestiaire-regle.js';
import { enLigneDesLignes } from './enligne-regle.js';
export { annoncesVcEnLigne };

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
  // ⚠️ AUCUNE FICHE ACTUELLE NE PORTE CE N° ⇒ le SKU ne désigne plus une paire :
  //    on ne rapproche RIEN (parité avec l'app, App.jsx `numEbayLu` : « VRM-82
  //    publiée pendant la panne, paire devenue N°53, plus aucune fiche ne porte
  //    82 → non reliée »). Sans ça, un push « N°82 encore en vente sur eBay »
  //    partait, app fermée, sur une annonce qui n'est PAS cette paire. `fiches`
  //    vides = « pas su » (l'appelant ne lit rien) ⇒ on ne juge pas.
  if (!porteurs.length && Object.keys(F).length) return '';
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

// ── VINTED (3 nov.) : ses annonces EN LIGNE, par N° ────────────────────────
// La règle « en ligne » de l'app, recopiée par script (api/_lib/enligne-regle.js,
// `node scripts/recopie-enligne-serveur.cjs`) : lecture COMPLÈTE la plus récente
// de moins de 24 h, sans les supprimées vues après, sans les « à confirmer ».
// Le N° d'une annonce = celui de SA fiche (`vinted_annonce_numeros[id]`, clé =
// identifiant d'annonce Vinted, §5) — jamais le titre. Un compte retiré pour de
// bon (`vrm_annonces_retirees`) ne compte pas. Rend Map N° → [{ id, titre }].
// `lignesL` : [{ id, cap, uid, items }] (`harvest_{uid}_listings`, projetées) ·
// `lignesP` : les lectures publiques projetées, ou `null` (pas su — la règle
// rend alors « à confirmer » ce qu'elle ne peut plus dater) · `supp` : Map uid →
// ids, ou `null`.
export function annoncesVintedParNumero(lignesL, lignesP, supp, fiches, retirees, maintenant = Date.now()) {
  const out = new Map();
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  const ret = new Set(retirees && typeof retirees === 'object' ? Object.keys(retirees).map(String) : []);
  const lignes = (Array.isArray(lignesL) ? lignesL : []).map((r) => ({ id: r.id, cap: r.cap, data: { uid: r.uid, capturedAt: r.cap, payload: { items: Array.isArray(r.items) ? r.items : [] } } }));
  const { parCompte } = enLigneDesLignes(lignes, lignesP, supp, maintenant);
  for (const [uid, res] of parCompte) {
    if (ret.has(String(uid))) continue;
    for (const it of res.enLigne || []) {
      const f = F[String(it.id)];
      const k = f && f.numero != null ? cleNum(f.numero) : '';
      if (!k || !NUM_OK.test(k)) continue;
      if (!out.has(k)) out.set(k, []);
      out.get(k).push({ id: String(it.id), titre: String(it.title || f.title || '') });
    }
  }
  return out;
}

// eBay retiré tout seul : le journal du retrait automatique (`ebay_retraits_auto`,
// écrit par api/ebay.js après un EndFixedPriceItem accepté). Rend le Set des N°
// retirés d'eBay depuis `depuisMs` (le SKU de l'entrée, une identité).
export function numerosRetiresEbay(journal, depuisMs) {
  const s = new Set();
  for (const e of (journal && Array.isArray(journal.items) ? journal.items : [])) {
    if (!e || !(Number(e.at) >= depuisMs)) continue;
    const k = numDeSku(e.sku);
    if (k) s.add(k);
  }
  return s;
}

// Ce que la vente rencontre ailleurs. `ebay` / `lbc` : Map (lu) ou `null` (pas
// su ⇒ cette plateforme ne dit RIEN). Rend [{ numero, plateforme, annonces }].
// `vc` : Map N° → annonces Vestiaire PROUVÉES en ligne (lecture de moins de
// 24 h), ou `null` (pas su, ou lecture trop vieille ⇒ Vestiaire ne dit RIEN).
export const PLATEFORMES = ['vinted', 'ebay', 'leboncoin', 'vestiaire'];
// `venduSur` : le site de la vente — ses propres annonces ne sont jamais « ailleurs ».
// `vinted` : Map N° → annonces Vinted en ligne, ou `null` (pas su ⇒ rien).
export function doubleVenteApprise(numero, ebay, lbc, vc = null, vinted = null, venduSur = 'vinted') {
  const hits = [];
  const src = { vinted, ebay, leboncoin: lbc, vestiaire: vc };
  for (const n of numerosDeVente(numero)) {
    for (const p of PLATEFORMES) {
      if (p === venduSur) continue;
      const m = src[p];
      if (m && typeof m.has === 'function' && m.has(n)) hits.push({ numero: n, plateforme: p, annonces: m.get(n) });
    }
  }
  return hits;
}

const NOM = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire' };
// La notification (famille Ventes) : « ⚠️ N°124 vendu sur Vinted · encore en
// ligne sur Leboncoin » — le N°, le site de la vente, les sites où il reste en
// ligne ; « retiré d'eBay » quand le retrait automatique l'a déjà fait (il n'est
// jamais refait ici). Clé anti-doublon = la VENTE (site + N°) et les annonces
// rencontrées : le bordereau et l'e-mail « vendu » d'une même vente, ou un
// e-mail rejoué, donnent la même clé. Ouvre l'annonce à retirer.
export function notificationDoubleVente(hits, titre, o = {}) {
  const venduSur = PLATEFORMES.includes(o.venduSur) ? o.venduSur : 'vinted';
  const retires = o.retiresEbay && typeof o.retiresEbay.has === 'function' ? o.retiresEbay : new Set();
  const enLigne = hits.filter((h) => !(h.plateforme === 'ebay' && retires.has(h.numero)));
  const numsVente = (Array.isArray(o.numeros) ? o.numeros : []).concat(hits.map((h) => h.numero));
  const retEbay = venduSur !== 'ebay' && numsVente.some((k) => retires.has(k));
  if (!enLigne.length && !retEbay) return null;
  const nums = [...new Set(numsVente)];
  const plats = [...new Set(enLigne.map((h) => h.plateforme))];
  const ou = plats.map((p) => NOM[p]).join(', ').replace(/, ([^,]*)$/, ' et $1');
  const n = nums.map((x) => 'N°' + x).join(', ');
  const article = String(titre || '').trim().slice(0, 80);
  const ids = enLigne.flatMap((h) => h.annonces.map((a) => h.plateforme + ':' + (a.itemId || a.id))).sort();
  const p0 = plats[0] || 'ebay', h0 = enLigne.find((h) => h.plateforme === p0) || { numero: nums[0] };
  const url = p0 === 'ebay' || p0 === 'leboncoin' ? DESTINATIONS.doublon({ plat: p0, num: h0.numero })
    // Vinted : la carte « à retirer de Vinted » de Ma journée (VRM n'y retire rien, §3) ;
    // Vestiaire : Annonces · Vestiaire.
    : p0 === 'vinted' ? DESTINATIONS.journee() : lienNotif('annonces', { site: 'vestiaire' });
  return {
    title: `⚠️ ${n} vendu sur ${NOM[venduSur]}${plats.length ? ` · encore en ligne sur ${ou}` : ''}${retEbay ? " · retiré d'eBay" : ''}`,
    body: article,
    tag: `dv-${venduSur}-${nums.join('+')}-${ids.join(',')}`.slice(0, 200),
    url,
  };
}
