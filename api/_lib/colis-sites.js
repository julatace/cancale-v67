// ─────────────────────────────────────────────────────────────────────────────
// LES COLIS À POSTER DE TOUS LES SITES — UNE règle (§11), 1er novembre
//
// L'audit des parcours (1er nov., A4) : une vente Leboncoin ou Vestiaire à
// poster n'était comptée que dans Colis. Ma journée « À envoyer », la cloche
// (`vrm_colis_aposter`), le widget de l'iPhone et les rappels (matin, soir,
// bilan) ne comptaient que Vinted et eBay : deux nombres pour une notion, et
// une date limite Vestiaire pouvait passer sans un mot.
// Ici, les règles de Colis, pour TOUS ces lecteurs :
//   · Leboncoin : la règle de l'écran Colis Leboncoin (`LeboncoinColis`) —
//     vente PROUVÉE (vendeur, ou un bordereau existe), ni annulée, ni
//     finalisée, ni expédiée selon Leboncoin, ni cochée « Colis fait »
//     (`vrm_lbc_colis_done`). Leboncoin n'écrit AUCUNE date limite : ces colis
//     sont « sans date limite », jamais « en retard ».
//   · Vestiaire : `colisVcAPoster` (api/_lib/vestiaire-regle.js), la date limite
//     que Vestiaire écrit.
// Les règles Leboncoin (`lbcAnnulee`, `lbcFinalisee`, `lbcExpediee`) sont
// celles de l'app, recopiées au jeton près dans api/_lib/ventes-regle.js
// (audit-bilan-semaine.cjs). Trois états, jamais deux : `undefined` en cours ·
// `null` pas su · liste.
// ─────────────────────────────────────────────────────────────────────────────
import { lbcAnnulee, lbcFinalisee, lbcExpediee } from './ventes-regle.js';
import { colisVcAPoster, resumeColisVc } from './vestiaire-regle.js';

const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const aLabelLbc = (o) => !!(o && o.label && (o.label.voucherUrl || o.label.qrUrl || o.label.reference));
// Un COLIS vendeur : vente prouvée (isSeller) OU un bordereau existe (un
// bordereau n'existe que pour le vendeur). Les achats / côté inconnu : non.
export const colisLbcVendeur = (o) => !!o && o.isSeller !== false && (o.isSeller === true || aLabelLbc(o));
// `ventes` : `lbc_ventes.data.ventes` (objet) ou sa liste ; `fait` :
// `vrm_lbc_colis_done` ({ [txId]: ts }).
// Le prédicat, pour l'écran Colis Leboncoin (qui garde la vente entière) et la liste ci-dessous.
export const lbcColisAPoster = (o, fait) => colisLbcVendeur(o) && !lbcAnnulee(o) && !lbcFinalisee(o) && !lbcExpediee(o) && !(o.txId != null && (objet(fait) || {})[o.txId]);
export function colisLbcAPoster(ventes, fait) {
  if (ventes === undefined) return undefined;
  if (ventes === null) return null;
  const liste = Array.isArray(ventes) ? ventes : objet(ventes) ? Object.values(ventes) : null;
  if (!liste) return null;
  return liste.filter((o) => lbcColisAPoster(o, fait))
    .map((o) => ({ txId: String(o.txId == null ? '' : o.txId), itemId: o.itemId == null ? '' : String(o.itemId), titre: o.title || '', pret: !!(o.label && o.label.voucherUrl), jours: null }));
}
// Le résumé des deux sites, pour le widget et les rappels : `null` = pas su
// (le lecteur NOMME le site et dit « au moins »).
export function resumeColisSites({ lbc, vc, fait, maintenant = Date.now() } = {}) {
  const l = colisLbcAPoster(lbc, fait);
  const v = colisVcAPoster(vc, maintenant);
  return {
    leboncoin: Array.isArray(l) ? { total: l.length, overdue: 0, today: 0, tomorrow: 0, sansLimite: l.length } : null,
    vestiaire: Array.isArray(v) ? resumeColisVc(v) : null,
  };
}
// Le total d'une publication à plusieurs sites : la somme de ce qui est SU, et
// ce qui manque NOMMÉ (`manque`, `auMoins`) — jamais un total partiel présenté
// complet (§5). `parts` : { [site]: { total, overdue, today, tomorrow } | null }.
export function totalColis(parts) {
  let total = 0, overdue = 0, today = 0, tomorrow = 0;
  const manque = [];
  for (const [site, p] of Object.entries(parts || {})) {
    if (!p) { manque.push(site); continue; }
    total += p.total || 0; overdue += p.overdue || 0; today += p.today || 0; tomorrow += p.tomorrow || 0;
  }
  return { total, overdue, today, tomorrow, manque, auMoins: manque.length > 0 };
}
