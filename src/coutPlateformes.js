// ════════════════════════════════════════════════════════════════════════════
//  CE QUE TE COÛTE CHAQUE PLATEFORME, MOIS PAR MOIS (11 nov., lot
//  agent2-argent-parrainage — validé par Julien).
//  Côte à côte, par site et par mois : frais de vente, boosts et options,
//  étiquettes payées par lui, abonnements. Module PUR, AUCUNE règle neuve (§11) :
//    · LE TOTAL d'un site sur un mois = `fraisParPlateforme` (src/fraisPlateformes.js,
//      la carte « Frais par site ») sur les bornes du mois — frais lus chez eBay
//      (`totalMarketplaceFee`), frais notés sur les fiches (relevé `vrm_stats_ventes`
//      de l'écran Ventes, `coutsVente`), packs et options notés dans Dépenses —
//      + les échéances des abonnements rattachés au site (`chargeAbonnement`, la
//      règle de Comptabilité, injectée).
//    · LE DÉTAIL des frais notés sur une fiche Vinted vient de la MÊME fiche
//      (`detailFraisFiche`, les champs de `champsCharges` : `fees` = boost,
//      `transportVendeur` = port payé par lui, `commission`, le reste) rangé en [11]
//      du relevé ; une ligne sans détail (relevé d'avant, Leboncoin) reste « autres
//      frais notés » — jamais répartie au hasard. La somme du détail = le total.
//    · eBay : l'étiquette est payée par l'ACHETEUR (§2.8) : jamais une charge.
//    · Vestiaire : la commission n'est pas lue (rangée nulle part) ⇒ NOMMÉE.
//    · Un abonnement est rattaché à un site seulement si SON NOM commence par le nom
//      du site (« Vinted Pro », « Leboncoin pack photo ») ; sinon il n'est pas ici.
//  Chaque montant porte sa source LUE ('lu' chez le site · 'fiche' noté sur tes
//  fiches · 'depenses' noté dans Dépenses) ; un site pas lu ⇒ « — », jamais 0.
//  Exécuté par scripts/audit-cout-plateformes.cjs (données inventées, --prouve).
// ════════════════════════════════════════════════════════════════════════════
import { fraisParPlateforme } from './fraisPlateformes.js';
import { centimes } from './beneficePaire.js';

export const SITES_COUT = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
export const CATEGORIES_COUT = [
  ['vente', 'Frais de vente'],
  ['boost', 'Boosts et options'],
  ['etiquettes', 'Étiquettes'],
  ['abonnements', 'Abonnements'],
  ['autres', 'Autres frais notés'],
];
const c = (x) => Math.round(Number(x) * 100);

// Le détail d'une fiche, en centimes : [boost, port payé par lui, commission, reste].
// `null` quand la fiche ne note aucun frais (rien à ranger).
export function detailFraisFiche(e) {
  const f = e || {};
  const v = (k) => centimes(f[k]) ?? 0;
  const b = v('fees'), p = v('transportVendeur'), co = v('commission');
  const reste = v('remboursement') + v('autresFrais') + v('emballage');
  return b || p || co || reste ? [b, p, co, reste] : null;
}

// Les bornes LOCALES d'un mois 'AAAA-MM'.
export const bornesMois = (ym) => {
  const y = Number(String(ym).slice(0, 4)), m = Number(String(ym).slice(5, 7)) - 1;
  return { de: new Date(y, m, 1).getTime(), a: new Date(y, m + 1, 1).getTime() };
};
export const moisAvant = (maintenant = Date.now(), n = 4) => {
  const d = new Date(maintenant), out = [];
  for (let k = 0; k < n; k++) { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  return out;
};
const MOTS_SITE = { Vinted: /^vinted\b/i, Leboncoin: /^le\s?bon\s?coin\b/i, eBay: /^ebay\b/i, Vestiaire: /^vestiaire\b/i };
export const siteDAbonnement = (a) => {
  const nom = String((a && a.libelle) || '').trim();
  for (const s of SITES_COUT) if (MOTS_SITE[s].test(nom)) return s;
  return null;
};

// releve : lignes de `vrm_stats_ventes` | null ; ebay : commandes | null ; compta : `vrm_compta` | null ;
// mois : ['AAAA-MM', …] ; chargeAbo(a, ym) → € de l'échéance de ce mois (règle de Comptabilité).
export function coutParPlateforme({ releve, ebay, compta, mois = [], excluAutre, R, chargeAbo } = {}) {
  const packs = compta && Array.isArray(compta.packs) ? compta.packs : [];
  const abos = compta && Array.isArray(compta.abonnements) ? compta.abonnements : [];
  return mois.map((ym) => {
    const { de, a } = bornesMois(ym);
    const F = fraisParPlateforme({ releve, ebay, packs, de, a, excluAutre, R });
    const parSite = {};
    for (const S of F.sites) parSite[S.plateforme] = S;
    const sites = SITES_COUT.map((plat) => {
      const S = parSite[plat] || null;
      const L = { plat, n: S ? S.n : 0, passu: !!(S && S.passu), manques: [], cat: {}, src: {}, total: null, partiel: false };
      const cat = { vente: 0, boost: 0, etiquettes: 0, abonnements: 0, autres: 0 };
      if (L.passu) { L.manques.push(`ventes ${plat} pas lues`); L.partiel = true; }
      if (S && !L.passu) {
        // Les frais notés sur les fiches (relevé) : détaillés par la fiche quand elle l'a été.
        let noteFiches = 0;
        if (plat !== 'eBay') {
          for (const l of (Array.isArray(releve) ? releve : [])) {
            if (!Array.isArray(l) || l[0] !== plat) continue;
            const t = Number(l[3]); if (!(t >= de && t < a)) continue;
            if (l[4] == null || !isFinite(Number(l[4])) || plat === 'Vestiaire') continue;   // mêmes lignes que fraisParPlateforme
            const tot = l[6] == null ? 0 : c(l[6]);
            noteFiches += tot;
            const det = Array.isArray(l[11]) && l[11].length === 4 && l[11].every(Number.isFinite) ? l[11] : null;
            if (det && det[0] + det[1] + det[2] + det[3] === tot) { cat.boost += det[0]; cat.etiquettes += det[1]; cat.vente += det[2]; cat.autres += det[3]; }
            else cat.autres += tot;
          }
        } else {
          cat.vente += c(S.commission);                                   // lu chez eBay
          if (S.couverture && S.couverture.lus < S.couverture.n) { L.manques.push(`frais eBay lus sur ${S.couverture.lus}/${S.couverture.n}`); L.partiel = true; }
        }
        cat.boost += c(S.options);                                         // packs et options notés dans Dépenses
        if (plat === 'Vestiaire' && S.commissionPasLue) { L.manques.push('commission Vestiaire pas lue'); L.partiel = true; }
        if (!S.baseLue) { L.manques.push(`un montant ${plat} pas lu`); L.partiel = true; }
        L.verif = { frais: S.frais == null ? null : c(S.frais), detail: plat === 'eBay' ? c(S.commission) + c(S.options) : noteFiches + c(S.options) };
      }
      // Les abonnements rattachés à ce site (échéances du mois).
      for (const ab of abos) {
        if (siteDAbonnement(ab) !== plat || typeof chargeAbo !== 'function') continue;
        const m = Number(chargeAbo(ab, ym));
        if (Number.isFinite(m) && m > 0) cat.abonnements += c(m);
      }
      L.cat = cat;
      L.src = {
        vente: plat === 'eBay' ? 'lu' : plat === 'Vestiaire' ? 'passu' : 'fiche',
        boost: 'fiche', etiquettes: plat === 'eBay' ? 'acheteur' : 'fiche', abonnements: 'depenses', autres: 'fiche',
      };
      const somme = Object.values(cat).reduce((s, x) => s + x, 0);
      L.total = L.passu ? null : somme;
      return L;
    });
    const lus = sites.filter((s) => s.total != null);
    return { ym, de, a, sites, total: lus.length ? lus.reduce((s, x) => s + x.total, 0) : null, partiel: sites.some((s) => s.partiel) };
  });
}

// Un site montré : il a vendu, coûté, ou n'a pas pu être lu sur l'un des mois.
export const sitesMontresCout = (M) => SITES_COUT.filter((p) => (M || []).some((m) => m.sites.some((s) => s.plat === p && (s.passu || s.n > 0 || (s.total || 0) > 0))));

export const nomMois = (ym, court = false) => {
  const { de } = bornesMois(ym);
  return new Date(de).toLocaleDateString('fr-FR', { month: court ? 'short' : 'long' }).replace('.', '');
};
