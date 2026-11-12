// ═══════════════════════════════════════════════════════════════════════════
// CE QUE COÛTE CHAQUE SITE — LES FRAIS PAR PLATEFORME (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : sur la période, ce que coûte chaque site, en € et en % de ce que ce
// site a vendu, avec la couverture dite.
//
// Mesuré (lecture seule, 4 nov.) — ce que chaque site ÉCRIT vraiment :
//   · Vinted    : aucune commission vendeur (l'acheteur paie la protection). Ce
//                 qui coûte = ce qu'il a SAISI : boosts et frais posés sur la
//                 fiche (`coutsVente`, déjà dans le relevé `vrm_stats_ventes`,
//                 colonne frais) + les packs/options Vinted de Comptabilité.
//   · Leboncoin : le prix capté est ce que le vendeur touche (frais = 0, règle
//                 du bénéfice) ; ce qui coûte = les packs/options saisis.
//   · eBay      : `totalMarketplaceFee` de CHAQUE commande (frais lus) ; une
//                 commande sans frais lus est comptée dans la couverture.
//   · Vestiaire : la vente rangée ne garde que ce que Vestiaire VERSE
//                 (`sellerEarning`) — la commission n'y est pas : « pas lue »,
//                 dit, jamais devinée (prix − versé n'est pas rangé).
//                 (11 nov. soir, Julien : « voir les frais que la plateforme prend ») :
//                 depuis l'extension 5.340/5.364 la vente porte aussi le PRIX affiché
//                 (`prixVente`, `sellerPrice`) ⇒ commission LUE = prix − versé, par la
//                 règle `fraisVc` (api/_lib/vestiaire-regle.js, passée en `R.fraisVc` comme
//                 `commandeEbayEngagee` : module sans import), vente par vente ; `vestiaire`
//                 (les ventes rangées, `ventesVcDe`) est passé par l'appelant. Une vente
//                 sans les deux reste « pas lue » et comptée dans la couverture ; le % est
//                 calculé sur le PRIX des seules ventes aux frais lus.
// Le « vendu » d'un site, base du %, est ce que l'acheteur a payé pour l'article
// AVANT les frais du site : Vinted et Leboncoin le prix de vente ; eBay le dû
// au vendeur (`totalDueSeller`, port exclu, §2.8) ; Vestiaire le versé (la
// commission n'étant pas lue, le % n'est pas calculé).
// Les mêmes ventes que le bénéfice (relevé publié par l'écran Ventes :
// finalisées, comptes écartés exclus) ; eBay : commandes payées et engagées,
// datées de leur création (la règle du CA eBay). Exécuté par
// scripts/audit-frais-plateformes.cjs.

const ORDRE = ['Vinted', 'eBay', 'Vestiaire', 'Leboncoin'];
const c = (x) => Math.round(Number(x) * 100);
const eurLu = (m) => (m && typeof m === 'object' && m.value != null && String(m.value).trim() !== '' && isFinite(Number(m.value)) && m.currency === 'EUR') ? Number(m.value) : null;
const jourOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);

// `releve` : les lignes de `vrm_stats_ventes` ([plateforme, compte, id, ts,
// vente, achat, frais, …]) | null (pas publié) ; `ebay` : commandes | null ;
// `packs` : `vrm_compta.packs` ; [de, a) en ms.
export function fraisParPlateforme({ releve, ebay, packs, de, a, excluAutre, R, vestiaire } = {}) {
  const P = {};
  const site = (k) => (P[k] || (P[k] = { plateforme: k, n: 0, nLus: 0, cBase: 0, cFrais: 0, cPacks: 0, nPacks: 0, cPrixLus: 0, baseLue: true, passu: false, commission: k === 'eBay' || k === 'Vestiaire' }));
  // Vestiaire : les ventes rangées par leur identifiant (celui du relevé : `vestiaire:{id}`).
  const vcParId = new Map();
  for (const v of (Array.isArray(vestiaire) ? vestiaire : [])) if (v && v.id != null) vcParId.set('vestiaire:' + String(v.id), v);
  const dans = (t) => Number.isFinite(t) && t >= de && t < a;

  if (Array.isArray(releve)) {
    for (const l of releve) {
      if (!Array.isArray(l)) continue;
      const plat = String(l[0] || '');
      if (plat === 'eBay' || !ORDRE.includes(plat)) continue;   // eBay : lu sur ses commandes, plus bas
      if (!dans(Number(l[3]))) continue;
      const S = site(plat);
      S.n += 1;
      if (l[4] == null || !isFinite(Number(l[4]))) { S.baseLue = false; continue; }
      S.cBase += c(l[4]);
      if (plat === 'Vestiaire') {                                 // commission LUE vente par vente, sinon pas lue
        const f = R && typeof R.fraisVc === 'function' ? R.fraisVc(vcParId.get(String(l[2] || ''))) : { lu: false };
        if (f.lu && f.cVerse === c(l[4])) { S.nLus += 1; S.cFrais += f.cFrais; S.cPrixLus += f.cPrix; }
        continue;
      }
      S.nLus += 1;
      S.cFrais += l[6] == null ? 0 : c(l[6]);
    }
  } else for (const k of ['Vinted', 'Leboncoin', 'Vestiaire']) site(k).passu = true;

  if (Array.isArray(ebay)) {
    for (const o of ebay) {
      if (!o || !o.orderId || String(o.orderPaymentStatus || '').toUpperCase() !== 'PAID' || !R.commandeEbayEngagee(o)) continue;
      if (excluAutre && excluAutre('ebay', o)) continue;
      if (!dans(Date.parse(o.creationDate || ''))) continue;
      const S = site('eBay');
      S.n += 1;
      const du = eurLu(o.paymentSummary && o.paymentSummary.totalDueSeller);
      const f = eurLu(o.totalMarketplaceFee);
      if (du == null || f == null) continue;
      S.nLus += 1; S.cBase += c(du); S.cFrais += c(f);
    }
  } else site('eBay').passu = true;

  for (const p of (Array.isArray(packs) ? packs : [])) {
    if (!p || !jourOk(p.date)) continue;
    const t = Date.parse(String(p.date).slice(0, 10) + 'T12:00:00');
    if (!dans(t)) continue;
    const m = Number(p.montant);
    if (!isFinite(m) || m <= 0) continue;
    const S = site(ORDRE.includes(p.plateforme) ? p.plateforme : 'Autre');
    S.cPacks += c(m); S.nPacks += 1;
  }

  const sites = Object.values(P).map((S) => {
    const frais = (S.cFrais + S.cPacks) / 100;
    const base = S.cBase / 100;
    // La couverture : sur combien de ventes les frais du site sont LUS.
    const couverture = S.commission ? { lus: S.nLus, n: S.n } : null;
    const complet = !S.passu && S.baseLue && (!couverture || couverture.lus === couverture.n);
    // Le % : seulement sur ce qu'on connaît des deux côtés (ventes aux frais lus),
    // et jamais pour Vestiaire (commission pas lue) ni sans vente.
    const pct = S.plateforme === 'Vestiaire' ? (S.passu || !S.nLus || !(S.cPrixLus > 0) ? null : Math.round((S.cFrais / S.cPrixLus) * 1000) / 10)
      : S.plateforme === 'Autre' || !(S.cBase > 0) || S.passu || (couverture && couverture.lus === 0) ? null
      : Math.round(((S.cFrais + S.cPacks) / S.cBase) * 1000) / 10;
    return {
      plateforme: S.plateforme, n: S.n, base, frais: S.passu ? null : frais, commission: S.cFrais / 100, options: S.cPacks / 100, nOptions: S.nPacks,
      pct, couverture, complet, passu: S.passu, commissionPasLue: S.plateforme === 'Vestiaire' && S.n > 0 && S.nLus === 0,
    };
  }).filter((s) => s.passu || s.n > 0 || s.options > 0)
    .sort((x, y) => (ORDRE.indexOf(x.plateforme) + 99 * (x.plateforme === 'Autre')) - (ORDRE.indexOf(y.plateforme) + 99 * (y.plateforme === 'Autre')));
  return { sites, total: Math.round(sites.reduce((t, s) => t + (s.frais == null ? 0 : c(s.frais)), 0)) / 100, partiel: sites.some((s) => !s.complet || s.commissionPasLue) };
}

// « frais lus sur 3/4 ventes » — seulement là où le site a une commission à lire.
export const texteCouverture = (s) => {
  if (!s) return '';
  if (s.commissionPasLue) return 'commission pas lue';
  if (!s.couverture || s.couverture.lus === s.couverture.n) return '';
  return `frais lus sur ${s.couverture.lus}/${s.couverture.n} vente${s.couverture.n > 1 ? 's' : ''}`;
};
