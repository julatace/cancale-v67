// ════════════════════════════════════════════════════════════════════════════
//  LA FRISE Vendue → Postée → Livrée → Payée POUR eBAY ET VESTIAIRE (3 nov.)
//
//  La même frise que Vinted (`friseVente`, src/recapVente.js, projetée par
//  `friseVenteFusion`) : ce module ne fait que dire QUELLES DONNÉES LUES
//  prouvent chaque étape. Aucune règle neuve sur la frise elle-même : une étape
//  n'est cochée que PROUVÉE (ou déduite d'une étape plus loin prouvée) ; ce qui
//  n'est pas lu reste « à venir » — jamais « en retard », jamais deviné d'une
//  date, d'un délai ou d'une absence.
//
//  VESTIAIRE — forme MESURÉE en lecture seule le 3 nov. (`vc_ventes`, 1 vente) :
//    `etapesVc` = { sellerSale, sellerShipment, sellerConformity, sellerDelivery,
//    sellerPayment } valant « done » / « pending » / « upcoming » (la frise du
//    vendeur telle que Vestiaire l'écrit) ; `etat` (« ACTION_NEEDED »),
//    `statutVc` (« shipmentInProgress »). Seul « done » prouve une étape.
//    + « Colis fait » posé par lui (`vrm_vc_colis_done`) prouve « Postée »,
//    + le mot de Vestiaire rangé par `etapeMotVc` (envoyée, livrée, versée…).
//  eBAY — `ebay_orders*` vide chez lui le 3 nov. (aucune commande rangée) : la
//    forme est celle de l'API Fulfillment `getOrders` que VRM range telle quelle.
//    Postée = `orderFulfillmentStatus` FULFILLED (ou SHIPPED) ; Payée =
//    l'argent LIBÉRÉ au vendeur (`paymentSummary.payments[].paymentHolds[]`
//    `holdState` RELEASED / RELEASE_CONFIRMED). ⚠️ `orderPaymentStatus: PAID`
//    veut dire que l'ACHETEUR a payé (avant l'envoi) : ce n'est PAS « Payée »
//    (sinon tout serait coché dès la vente). Livrée : l'API ne le dit pas ⇒
//    jamais cochée seule (déduite seulement si l'argent libéré est lu).
//  Une vente annulée / remboursée ⇒ `null` (pas de frise, l'état le dit).
//  Module PUR : `scripts/audit-frise-sites.cjs` l'exécute.
// ════════════════════════════════════════════════════════════════════════════
import { etapeMotVc, vcVenteAnnulee, vcVentePartie } from '../api/_lib/vestiaire-regle.js';
import { etatCommandeEbay } from '../api/_lib/ebay-etat-commande.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const fait = (etapes, k) => !!etapes && String(etapes[k] == null ? '' : etapes[k]).trim().toLowerCase() === 'done';

// Les preuves d'une vente Vestiaire (`v` = une ligne de `vc_ventes.ventes`,
// `colisFait` = la date du « Colis fait » posé par lui, ou rien).
export function preuvesFriseVc(v, colisFait = null) {
  if (!objet(v) || vcVenteAnnulee(v)) return null;
  const e = objet(v.etapesVc), mot = etapeMotVc(v);
  return {
    vendue: { lu: true, t: v.date || null },
    bordereau: { lu: !!(v.bordereau && v.bordereau.id), t: (v.bordereau && v.bordereau.at) || null },
    deposee: { lu: !!colisFait || vcVentePartie(v) || fait(e, 'sellerShipment'), t: colisFait || null },
    livree: { lu: ['livree', 'terminee', 'versee'].includes(mot) || fait(e, 'sellerDelivery'), t: null },
    argent: { lu: mot === 'versee' || fait(e, 'sellerPayment'), t: v.verseLe || null },
  };
}

const LIBERE = /^(RELEASED|RELEASE_CONFIRMED)$/;
// L'argent libéré au vendeur : au moins une retenue lue, TOUTES libérées.
export function argentLibereEbay(o) {
  const pays = objet(o && o.paymentSummary) && Array.isArray(o.paymentSummary.payments) ? o.paymentSummary.payments : [];
  const holds = pays.flatMap((p) => (p && Array.isArray(p.paymentHolds) ? p.paymentHolds : []));
  if (!holds.length || !holds.every((h) => h && LIBERE.test(String(h.holdState || '').toUpperCase()))) return { lu: false, t: null };
  const dates = holds.map((h) => Date.parse(h.releaseDate || '')).filter(Number.isFinite);
  return { lu: true, t: dates.length ? new Date(Math.max(...dates)).toISOString() : null };
}
// Les preuves d'une commande eBay (forme `getOrders`).
export function preuvesFriseEbay(o) {
  if (!objet(o)) return null;
  const etat = etatCommandeEbay(o);
  if (etat.kind === 'cancelled' || etat.kind === 'refunded') return null;
  const ful = String(o.orderFulfillmentStatus || '').toUpperCase();
  return {
    vendue: { lu: true, t: o.creationDate || null },
    deposee: { lu: ful === 'FULFILLED' || ful === 'SHIPPED', t: null },
    livree: { lu: false, t: null },
    argent: argentLibereEbay(o),
  };
}
