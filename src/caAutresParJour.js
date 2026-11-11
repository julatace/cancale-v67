// ══════════════════════════════════════════════════════════════════════════════
// LE FINALISÉ DE LEBONCOIN, eBAY ET VESTIAIRE, PAR JOUR DE VENTE (11 nov., parité)
// ══════════════════════════════════════════════════════════════════════════════
// Statistiques → « CA entre deux dates » ne sommait que Vinted (`caFinaliseParJour`
// de la coque) et l'écrivait « Vinted, tous comptes ». Ici, la MÊME population que
// « Finalisé par plateforme » (src/ecrans/Stats.jsx, `caParPlateforme`) :
//   · Leboncoin : vente (`isSeller`), ni annulée, finalisée (`lbcFinalisee`), prix lu ;
//   · eBay      : commande PAID engagée, à l'argent reçu (`montantRecuEbay`, frais retirés,
//                 port jamais compté — §2.8) ;
//   · Vestiaire : versée ou terminée, au montant reçu SÛR (`montantRecuVc`).
// Datées au jour de VENTE (heure locale), comme le Vinted de la coque. Rien n'est deviné :
//   · une plateforme pas lue (`null`) est NOMMÉE dans `pasLues` — le total dit « au moins » ;
//   · une vente finalisée sans date ou au montant pas sûr est COMPTÉE à part (`horsTotal`,
//     par plateforme) — elle n'est dans aucun jour, et l'écran le dit ;
//   · un compte écarté (`excluAutre`, Paramètres → Comptes liés) n'entre nulle part.
// Les règles sont passées par l'appelant (`R`) : les mêmes fonctions que le reste de l'app.
const jourLocal = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function caAutresParJour({ lbc, ebay, vestiaire, excluAutre = null, R }) {
  const parJour = {}, pasLues = [], horsTotal = {};
  const ajoute = (plateforme, t, eur) => {
    if (!Number.isFinite(t) || t <= 0) { horsTotal[plateforme] = (horsTotal[plateforme] || 0) + 1; return; }
    const k = jourLocal(t);
    const c = parJour[k] || (parJour[k] = { ca: 0, n: 0, cents: 0 });
    c.cents += Math.round(eur * 100); c.n += 1; c.ca = c.cents / 100;
  };
  const exclu = (p, v) => !!(excluAutre && excluAutre(p, v));
  // Leboncoin
  if (lbc === null) pasLues.push('Leboncoin');
  else for (const o of (Array.isArray(lbc) ? lbc : [])) {
    if (!o || o.isSeller !== true || exclu('leboncoin', o) || R.lbcAnnulee(o) || !R.lbcFinalisee(o)) continue;
    const eur = o.price != null ? Number(o.price) / 100 : NaN;
    if (!Number.isFinite(eur)) { horsTotal.Leboncoin = (horsTotal.Leboncoin || 0) + 1; continue; }
    // Une date saisie sans heure (« 2026-11-03 ») est le jour même, à midi (jamais la veille en UTC).
    const d = String(o.dateVente || '').trim();
    ajoute('Leboncoin', /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(d + 'T12:00:00') : Date.parse(d), eur);
  }
  // eBay
  if (ebay === null) pasLues.push('eBay');
  else for (const o of (Array.isArray(ebay) ? ebay : [])) {
    if (!o || String(o.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !R.commandeEbayEngagee(o) || exclu('ebay', o)) continue;
    const eur = R.montantRecuEbay(o).eur;
    if (eur == null) { horsTotal.eBay = (horsTotal.eBay || 0) + 1; continue; }
    ajoute('eBay', Date.parse(o.creationDate || ''), eur);
  }
  // Vestiaire
  if (vestiaire === null) pasLues.push('Vestiaire');
  else for (const v of (Array.isArray(vestiaire) ? vestiaire : [])) {
    if (!v || R.vcVenteAnnulee(v) || exclu('vestiaire', v)) continue;
    const et = R.etapeMotVc(v); if (et !== 'versee' && et !== 'terminee') continue;
    const eur = R.montantRecuVc(v).eur;
    if (eur == null) { horsTotal.Vestiaire = (horsTotal.Vestiaire || 0) + 1; continue; }
    ajoute('Vestiaire', R.dateVenteVc(v), eur);
  }
  return { parJour, pasLues, horsTotal };
}

// La somme d'une plage [du, au] (clés « AAAA-MM-JJ », bornes comprises, l'une ou l'autre vide).
export function sommePlage(parJour, du, au) {
  let cents = 0, n = 0;
  for (const [k, v] of Object.entries(parJour || {})) {
    if (du && k < du) continue;
    if (au && k > au) continue;
    cents += Math.round((Number(v && v.ca) || 0) * 100); n += Number(v && v.n) || 0;
  }
  return { ca: cents / 100, count: n };
}
