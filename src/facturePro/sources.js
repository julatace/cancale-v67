// ════════════════════════════════════════════════════════════════════════════
//  LA FACTURE PRO — LES VENTES LEBONCOIN, EBAY ET VESTIAIRE (10 nov., lot S)
// ════════════════════════════════════════════════════════════════════════════
// Julien (proposition 28, validée) : « Factures Pro aussi pour Leboncoin, eBay et
// Vestiaire (même règle de preuve : n° de commande de la plateforme) ».
//
// Module PUR (aucun réseau, aucun DOM) : l'app l'exécute pour dire, sur chaque
// vente, si une facture peut être faite ; le serveur (api/_lib/facture-autres.js)
// le RÉEXÉCUTE sur SES propres lectures avant de numéroter — la même règle des
// deux côtés (§11). Le prix, la date et la désignation viennent TOUJOURS de la
// vente relue par le serveur, jamais du navigateur.
//
// ── CE QUE CHAQUE PLATEFORME DONNE (mesuré le 10 nov., vraie base, lecture seule)
//   · Leboncoin (`lbc_ventes.data.ventes`, clé = n° de transaction) : 16 lignes ;
//     `txId` (9 chiffres, = la clé), `price` en CENTIMES (le prix de la vente,
//     `prices.final` du détail — pas `prixListe`, qui ajoute frais et port),
//     `dateVente` ISO, `title`, `account`, `isSeller`, `stepStatus`
//     (done · validation · cancelled). AUCUN acheteur : ni nom, ni adresse, ni
//     e-mail (le bordereau a un `label` {qrUrl, reference, trackingUrl, voucherUrl}).
//   · Vestiaire (`vc_ventes.data.ventes`, clé = productId) : 1 ligne ; `montant`
//     = {valeur, devise, cle:'sellerEarning'} — CE QUE VESTIAIRE TE VERSE, pas le
//     prix payé par l'acheteur ; aucun acheteur (seulement `id_client` dans la
//     page brute, jamais rangé). ⇒ pas de facture : le prix manque, dit.
//   · eBay (`ebay_orders*.data.orders`) : 0 commande (lecture complète, total 0).
//     La forme vient de l'API Fulfillment d'eBay, déjà lue par VRM ailleurs
//     (api/_lib/ebay-a-expedier.js, ebay-suppression.js, ventes-regle.js) :
//     `orderId`, `creationDate`, `orderPaymentStatus`, `cancelStatus`,
//     `lineItems[]` {title, quantity, lineItemCost{value,currency}},
//     `buyer.buyerRegistrationAddress` {fullName, contactAddress},
//     `fulfillmentStartInstructions[].shippingStep.shipTo` {fullName,
//     contactAddress}. JAMAIS VUE dans la base : l'acheteur qu'elle porte n'est
//     qu'une PROPOSITION (pré-remplie, à confirmer par son clic) ; un champ absent
//     reste vide et la feuille dit ce qui manque.
//   · Aucun e-mail de vente de ces trois plateformes n'arrive dans VRM (mesuré :
//     seulement des annonces publicitaires et de sécurité).
//
// ── LA RÈGLE (§5 : jamais par titre, jamais par ressemblance) ───────────────
// L'identité de la vente est SON n° de commande sur la plateforme (Leboncoin :
// n° de transaction ; eBay : orderId). Le prix et la date sont ceux de CETTE
// vente, lus. Une vente annulée, d'un côté pas su (acheteur ou vendeur ?), sans
// prix lu, en autre devise (§3 International : VRM reste en euros), de plusieurs
// articles, ou pas datée n'a PAS de facture — et la raison est dite.
// L'ACHETEUR : aucune de ces plateformes ne le prouve comme l'e-mail Vinted Pro.
// Le vendeur le RECOPIE (bordereau, messagerie de la plateforme) : c'est SA
// déclaration, rangée comme telle (`acheteurSource: 'saisi'`) ; VRM n'envoie
// jamais ces factures par e-mail (aucune adresse prouvée) — PDF à joindre au
// colis ou à partager.

import { vcVenteAnnulee } from '../../api/_lib/vestiaire-regle.js';

export const PLATEFORMES = {
  leboncoin: { l: 'Leboncoin', prefixe: 'lbc' },
  ebay: { l: 'eBay', prefixe: 'ebay' },
  vestiaire: { l: 'Vestiaire Collective', prefixe: 'vc' },
};
const REF_RE = { leboncoin: /^\d{4,20}$/, ebay: /^[0-9][0-9-]{3,40}$/, vestiaire: /^\d{1,20}$/ };
export const refValide = (plateforme, ref) => !!(REF_RE[plateforme] && REF_RE[plateforme].test(String(ref == null ? '' : ref)));
// La ligne de la facture et la clé de son numéro (journal du compteur, une seule suite).
export const idFactureAutre = (plateforme, ref) => `email_invoice_${PLATEFORMES[plateforme].prefixe}${String(ref).replace(/[^0-9A-Za-z-]/g, '')}`;
export const cleNumeroAutre = (plateforme, ref) => `${PLATEFORMES[plateforme].prefixe}${ref}`;
export const ID_FACTURE_AUTRE_RE = /^email_invoice_(lbc|ebay|vc)[0-9A-Za-z-]+$/;

const txt = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const non = (code, raison) => ({ ok: false, code, raison });
const date = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) && t > 0 ? t : null; };

// ── LEBONCOIN ───────────────────────────────────────────────────────────────
// La règle d'annulation est celle de l'app (`lbcAnnulee`, api/_lib/ventes-regle.js),
// recopiée ici mot pour mot (module pur, pas d'import croisé) : scripts/audit-factures-autres.cjs
// exige qu'elles restent identiques.
export const lbcAnnuleeFacture = (o) => o.stepStatus === 'cancelled' || /annul|cancel|refund|rembours/i.test((o.parcelStatus || '') + ' ' + (o.stepStatus || '') + ' ' + (o.stepLabel || ''));
export function venteLbc(o) {
  if (!o || typeof o !== 'object') return non('vente', 'la vente n’est pas lue');
  const ref = txt(o.txId);
  if (!refValide('leboncoin', ref)) return non('ref', 'la vente n’a pas de n° de transaction lu');
  if (o.isSeller !== true) return non('cote', 'Leboncoin n’a pas encore dit que tu es le vendeur — ouvre la transaction sur Leboncoin');
  if (lbcAnnuleeFacture(o)) return non('annulee', 'la vente est annulée');
  const c = typeof o.price === 'number' ? o.price : (typeof o.price === 'string' && /^\d+$/.test(o.price.trim()) ? Number(o.price) : NaN);
  if (!(Number.isInteger(c) && c > 0)) return non('prix', 'le prix de la vente n’est pas lu — ouvre la transaction sur Leboncoin');
  const t = date(o.dateVente);
  if (t == null) return non('date', 'la date de la vente n’est pas lue — ouvre « Mes transactions » sur Leboncoin');
  return { ok: true, plateforme: 'leboncoin', ref, centimes: c, venteLe: new Date(t).toISOString(), designation: txt(o.title), compte: txt(o.account), acheteurPropose: null,
    sansAcheteur: 'Leboncoin ne donne ni le nom ni l’adresse de l’acheteur' };
}

// ── EBAY ────────────────────────────────────────────────────────────────────
const adresseEbay = (a) => {
  if (!a || typeof a !== 'object') return '';
  const rue = [a.addressLine1, a.addressLine2].map(txt).filter(Boolean).join(', ');
  const ville = [txt(a.postalCode), txt(a.city)].filter(Boolean).join(' ');
  const pays = txt(a.countryCode).toUpperCase();
  return [rue, ville, pays && pays !== 'FR' ? pays : ''].filter(Boolean).join('\n');
};
export function venteEbay(o) {
  if (!o || typeof o !== 'object') return non('vente', 'la commande n’est pas lue');
  const ref = txt(o.orderId);
  if (!refValide('ebay', ref)) return non('ref', 'la commande n’a pas de n° lu');
  const cancel = txt(o.cancelStatus && o.cancelStatus.cancelState);
  if (/CANCEL/i.test(cancel) && !/REJECT/i.test(cancel)) return non('annulee', 'la commande est annulée');
  const pay = txt(o.orderPaymentStatus).toUpperCase();
  if (/FAILED|REFUNDED/.test(pay)) return non('annulee', 'la commande est remboursée');
  if (pay !== 'PAID') return non('paiement', 'eBay ne dit pas encore la commande payée');
  const li = Array.isArray(o.lineItems) ? o.lineItems : [];
  if (li.length !== 1) return non('articles', li.length ? 'la commande a plusieurs articles (pas encore pris en charge)' : 'l’article de la commande n’est pas lu');
  const l = li[0] || {};
  if (l.quantity != null && Number(l.quantity) !== 1) return non('articles', 'la commande porte plusieurs exemplaires (pas encore pris en charge)');
  const cout = l.lineItemCost && typeof l.lineItemCost === 'object' ? l.lineItemCost : null;
  if (!cout || cout.value == null || String(cout.value).trim() === '') return non('prix', 'le prix de l’article n’est pas lu');
  if (txt(cout.currency).toUpperCase() !== 'EUR') return non('devise', `la commande est en ${txt(cout.currency) || 'devise inconnue'} : VRM ne facture qu’en euros`);
  const c = Math.round(Number(String(cout.value).replace(',', '.')) * 100);
  if (!(Number.isInteger(c) && c > 0)) return non('prix', 'le prix de l’article n’est pas lu');
  const t = date(o.creationDate);
  if (t == null) return non('date', 'la date de la commande n’est pas lue');
  // L'acheteur : seulement ce que CETTE commande porte (même n°), proposé, jamais imposé.
  const reg = o.buyer && o.buyer.buyerRegistrationAddress;
  const step = (Array.isArray(o.fulfillmentStartInstructions) && o.fulfillmentStartInstructions[0] && o.fulfillmentStartInstructions[0].shippingStep) || null;
  const dest = (step && step.shipTo) || null;
  const reg2 = reg || null;
  const nom = txt(reg2 ? reg2.fullName : '') || txt(dest ? dest.fullName : '');
  const adresse = adresseEbay(reg2 ? reg2.contactAddress : null) || adresseEbay(dest ? dest.contactAddress : null);
  return { ok: true, plateforme: 'ebay', ref, centimes: c, venteLe: new Date(t).toISOString(), designation: txt(l.title), compte: txt(o._pseudo || o._compte), acheteurPropose: nom || adresse ? { nom, adresse } : null,
    sansAcheteur: nom && adresse ? '' : 'eBay ne donne pas l’acheteur complet dans cette commande' };
}

// ── VESTIAIRE ───────────────────────────────────────────────────────────────
// Vestiaire relève ce qu'il TE verse (`sellerEarning`) : une facture à ce montant
// serait fausse. (11 nov., extension 5.340) L'extension range aussi le PRIX DE
// VENTE de l'article (`prixVente` = { valeur, devise:'EUR', cle:'sellerPrice' }),
// seulement s'il est écrit en euros au centime. Présent ⇒ la facture se fait à CE
// prix ; absent ⇒ le refus d'avant, mot pour mot. Aucun acheteur : recopié.
// L'identité : la clé de la vente dans `vc_ventes.ventes` (`id`), jamais le titre.
export function venteVc(v) {
  if (!v || typeof v !== 'object') return non('vente', 'la vente n’est pas lue');
  const pv = v.prixVente && typeof v.prixVente === 'object' ? v.prixVente : null;
  const val = pv && pv.cle === 'sellerPrice' && pv.devise === 'EUR' ? Number(pv.valeur) : NaN;
  const c = Math.round(val * 100);
  if (!(Number.isFinite(val) && Number.isInteger(c) && c > 0 && Math.abs(c - val * 100) < 1e-6)) return non('prix', 'Vestiaire ne donne pas le prix payé par l’acheteur (seulement ce qu’il te verse)');
  const ref = txt(v.id);
  if (!refValide('vestiaire', ref)) return non('ref', 'la vente n’a pas de n° lu');
  if (vcVenteAnnulee(v)) return non('annulee', 'la vente est annulée');
  const t = date(v.date);
  if (t == null) return non('date', 'la date de la vente n’est pas lue — ouvre « Mes ventes » sur Vestiaire');
  return { ok: true, plateforme: 'vestiaire', ref, centimes: c, venteLe: new Date(t).toISOString(), designation: txt(v.titre), compte: txt(v.compte), acheteurPropose: null,
    sansAcheteur: 'Vestiaire ne donne ni le nom ni l’adresse de l’acheteur' };
}

export function venteAutre(plateforme, brut) {
  if (plateforme === 'leboncoin') return venteLbc(brut);
  if (plateforme === 'ebay') return venteEbay(brut);
  if (plateforme === 'vestiaire') return venteVc(brut);
  return non('plateforme', 'plateforme inconnue');
}

// ── L'ACHETEUR RECOPIÉ PAR LE VENDEUR ───────────────────────────────────────
// Nom (une ligne) et adresse postale (lignes ; un code postal à 4-5 chiffres ou
// une ligne de pays attendu). Rend la liste de ce qui manque (vide = complet).
export function manquantsAcheteurSaisi(a) {
  const x = a && typeof a === 'object' ? a : {};
  const m = [];
  if (!txt(x.nom) || txt(x.nom).length > 200) m.push({ champ: 'acheteurNom', l: 'le nom de l’acheteur' });
  const lignes = String(x.adresse || '').split(/\r?\n/).map(txt).filter(Boolean);
  if (!lignes.length || String(x.adresse || '').length > 600) m.push({ champ: 'acheteurAdresse', l: 'l’adresse de l’acheteur' });
  else if (lignes.length < 2 && !/\b\d{4,5}\b/.test(lignes[0])) m.push({ champ: 'acheteurAdresse', l: 'la rue, le code postal et la ville de l’acheteur' });
  return m;
}

// La vente telle que `contenuFacture` (./regle.js) la veut.
export function venteFacture(v, acheteur, designation) {
  return {
    acheteur: { nom: txt(acheteur && acheteur.nom).slice(0, 200), adresse: String((acheteur && acheteur.adresse) || '').split(/\r?\n/).map(txt).filter(Boolean).join('\n').slice(0, 600), email: '' },
    designation: (txt(designation) || v.designation).slice(0, 400),
    centimes: v.centimes,
    venteLe: v.venteLe,
    reference: v.ref,
    plateforme: PLATEFORMES[v.plateforme].l,
  };
}
