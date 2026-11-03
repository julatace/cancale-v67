// ════════════════════════════════════════════════════════════════════════════
//  RETRAIT AUTOMATIQUE D'eBAY APRÈS UNE VENTE LEBONCOIN OU VESTIAIRE (3 nov. 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien, 3 nov. : vendu sur un site ⇒ « les deux » — VRM le rappelle (carte
// « à retirer de … ») ET le retire seul là où c'est permis : eBay (le retrait
// automatique existe, ALLUMÉ chez lui). Il ne couvrait QUE les ventes Vinted
// (`retraitsEbayAutoPermis`, App.jsx) : une paire vendue sur Leboncoin ou
// Vestiaire restait en vente sur eBay jusqu'à son clic.
//
// La règle la plus STRICTE, la même philosophie que pour Vinted (une annonce eBay
// terminée ne revient pas) — tout doit être SU, et su par une IDENTITÉ (§5) :
//   1. le SKU de l'annonce eBay désigne ce N° (`numEbayLu`, VRM-n°) ;
//   2. ce N° n'est porté que par UN article dans VRM (au plus une fiche Vinted) ;
//   3. Leboncoin : une vente où il est VENDEUR, pas annulée, dont l'annonce se
//      relie à ce N° par identité (`clesAnnonce` : lien posé, référence VRM) ;
//      Vestiaire : une vente dont le N° vient de l'annonce Vestiaire (`num`,
//      identité seulement), pas annulée ;
//   4. aucune vente de ce N° sur ce site n'est annulée / revenue (deux sources
//      qui se contredisent ne font pas une certitude), et l'article n'est jamais
//      revenu sur Vinted (`revenues`) ;
//   5. la liste des ventes de ce site a été lue il y a moins de 48 h ;
//   6. l'annonce eBay a été mise en ligne AVANT la vente (dates connues) ;
//   7. eBay ne la dit pas déjà terminée.
// Ce qui ne passe pas reste dans « à retirer d'eBay », avec le bouton, et sa
// raison (`RAISON_RETRAIT_AILLEURS`). Module PUR : l'app (passage de la coque,
// écran eBay) et `scripts/audit-cycle-article.cjs` exécutent CETTE fonction.
import { vcVenteAnnulee, dateVenteVc } from '../api/_lib/vestiaire-regle.js';

export const VENTES_AILLEURS_FRAICHES_MS = 48 * 3600000;

export const RAISON_RETRAIT_AILLEURS = Object.freeze({
  'pas-su': "je n'ai pas pu tout vérifier (une liste de ventes pas lue)",
  sku: "le N° de son annonce eBay ne correspond pas à l'article",
  'numero-partage': 'ce N° est porté par plusieurs articles dans VRM',
  'revenue-une-fois': 'une vente de cet article a été annulée ou il est déjà revenu',
  'vente-non-confirmee': "la vente n'est pas reliée à cet article par son N°",
  'liste-perimee': "la liste des ventes de ce site n'a pas été relue depuis plus de 48 h",
  'date-pas-sue': 'je ne connais pas la date de la vente ou de la mise en ligne eBay',
  'ebay-apres-vente': "l'annonce eBay a été mise en ligne après la vente",
  'deja-terminee': 'eBay la dit déjà terminée',
});

// Entrées :
//  aRetirerEbayAilleurs : [{ annonce: { itemId, sku, depuis, fin }, numero, ou: 'Leboncoin'|'Vestiaire' }]
//  numeros              : les fiches N° (`vinted_annonce_numeros`)
//  revenues             : Set d'annonces Vinted revenues (retour, annulée) · null pas su
//  lbc                  : { ventes (objet `lbc_ventes.ventes`), items (annonces LBC) , liens, cap } · null pas su
//  vc                   : { ventes ([`ventesVcDe`]), cap } · null pas su
//  cle, numEbayLu, clesAnnonce(ad, liens), lbcAnnulee(v) : les règles de l'app (§11)
// Rend { permis: [{ ...d, venduLe }], ecartes: [{ numero, itemId, raison, ou }] }.
export function retraitsEbayAutoAilleursPermis(x) {
  const o = x || {};
  const permis = [], ecartes = [];
  const liste = Array.isArray(o.aRetirerEbayAilleurs) ? o.aRetirerEbayAilleurs : [];
  const maintenant = Number.isFinite(o.maintenant) ? o.maintenant : Date.now();
  const cle = typeof o.cle === 'function' ? o.cle : (n) => String(n == null ? '' : n).trim().toUpperCase();
  const pasFn = typeof o.numEbayLu !== 'function' || typeof o.clesAnnonce !== 'function' || typeof o.lbcAnnulee !== 'function';
  const parNum = new Map();
  for (const id in (o.numeros || {})) { const k = cle((o.numeros[id] || {}).numero); if (!k) continue; if (!parNum.has(k)) parNum.set(k, []); parNum.get(k).push(String(id)); }
  const revenues = o.revenues && typeof o.revenues.has === 'function' ? o.revenues : null;
  for (const d of liste) {
    const a = (d && d.annonce) || {};
    const ecarte = (raison) => ecartes.push({ numero: d && d.numero, itemId: a.itemId, raison, ou: d && d.ou });
    if (pasFn || !revenues) { ecarte('pas-su'); continue; }
    const n = o.numEbayLu(a.sku, a.itemId, null, a.depuis);
    if (!a.itemId || !n || n !== (d && d.numero)) { ecarte('sku'); continue; }
    const ids = parNum.get(n) || [];
    if (ids.length > 1) { ecarte('numero-partage'); continue; }
    if (ids.length === 1 && revenues.has(ids[0])) { ecarte('revenue-une-fois'); continue; }
    let dates = [], annulee = false, src = null;
    if (d.ou === 'Leboncoin') {
      src = o.lbc;
      if (!src || !src.ventes || typeof src.ventes !== 'object') { ecarte('pas-su'); continue; }
      for (const v of Object.values(src.ventes)) {
        if (!v || v.isSeller !== true || v.itemId == null) continue;
        const ad = (src.items && src.items[String(v.itemId)]) || { id: String(v.itemId), subject: v.title || '' };
        if (!o.clesAnnonce(ad, src.liens || {}).includes(n)) continue;
        if (o.lbcAnnulee(v)) { annulee = true; continue; }
        dates.push(Date.parse(v.dateVente || ''));
      }
    } else if (d.ou === 'Vestiaire') {
      src = o.vc;
      if (!src || !Array.isArray(src.ventes)) { ecarte('pas-su'); continue; }
      for (const v of src.ventes) {
        if (!v || cle(v.num || '') !== n) continue;
        if (vcVenteAnnulee(v)) { annulee = true; continue; }
        dates.push(Number(dateVenteVc(v)) || NaN);
      }
    } else { ecarte('vente-non-confirmee'); continue; }
    if (annulee) { ecarte('revenue-une-fois'); continue; }
    if (!dates.length) { ecarte('vente-non-confirmee'); continue; }
    const cap = Date.parse(src.cap || '');
    if (!Number.isFinite(cap) || maintenant - cap > VENTES_AILLEURS_FRAICHES_MS) { ecarte('liste-perimee'); continue; }
    if (dates.some((t) => !Number.isFinite(t))) { ecarte('date-pas-sue'); continue; }
    const tVente = Math.min(...dates);
    const tEbay = Date.parse(a.depuis || '');
    if (!Number.isFinite(tEbay)) { ecarte('date-pas-sue'); continue; }
    if (!(tEbay < tVente)) { ecarte('ebay-apres-vente'); continue; }
    const tFin = Date.parse(a.fin || '');
    if (Number.isFinite(tFin) && tFin <= maintenant) { ecarte('deja-terminee'); continue; }
    permis.push({ ...d, venduLe: new Date(tVente).toISOString() });
  }
  return { permis, ecartes };
}
