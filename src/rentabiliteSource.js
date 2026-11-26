// ════════════════════════════════════════════════════════════════════════════
//  RENTABILITÉ PAR SOURCE D'ACHAT (23 nov., lot rentabilite-source — validé par Julien)
//  « Ce que tu vends le mieux » (Statistiques › Finances, src/natif/ecrans/StatsVendsMieux.jsx) gagne un cinquième
//  regroupement : la SOURCE de l'achat (Vinted, Leboncoin, magasin, vide-grenier, un fournisseur qu'il a créé…) —
//  bénéfice moyen par revente, taux de revente, délai moyen. Le même écran, pas un second (2026-11-21-rentabilite.md).
//
//  AUCUNE RÈGLE NEUVE (§5, une règle par notion) : chaque chiffre est celui de « Tes meilleures sources »
//  (src/meilleuresSources.js `bilanSources`), PUBLIÉ par l'écran Ventes/Achats (`vrm_meilleures_sources`) :
//    · une vente n'est rattachée à son achat QUE par identité (`achatDeVente` : n° de transaction relié par SON clic,
//      achat en gros chez un fournisseur QU'IL a créé, N° écrit sur un achat hors plateforme qui n'en désigne qu'un) —
//      jamais le titre, la marque, la photo ;
//    · le bénéfice est celui de la règle unique (`beneficeLigneVente` / `ventesAutresBenefice`), jamais refait ;
//    · le bénéfice MOYEN porte sur les reventes au bénéfice connu (`nBenef`), sa couverture est rendue (« sur N ») ;
//      « au plus » quand des frais ne sont pas confirmés (`partiel`) ;
//    · le taux de revente = articles revendus ÷ articles achetés de la source (`revendus` / `articles`) ;
//    · le délai = le délai moyen achat → vente sur les reventes DATÉES (`delaiMoyen`, `nDelai`).
//  Ici on ne fait que RANGER (trois tris, la source pas saisie toujours dernière) et dire la couverture.
//  « Pas su » : publication absente (jamais calculée sur cet appareil, ou d'un autre compte VRM) ⇒ null, jamais [].
//  Module PUR. Exécuté par scripts/audit-rentabilite-source.cjs (données inventées, mutations).
// ════════════════════════════════════════════════════════════════════════════
import { lireMeilleures, CLE_MEILLEURES, EVT_MEILLEURES } from './meilleuresSources.js';

export const AXE_SOURCE = 'source';
const fini = (x) => x != null && Number.isFinite(Number(x));

// Une source du bilan ⇒ une rangée de l'écran. Les montants restent en CENTIMES (ceux de la règle).
export function rangeeSource(s) {
  const articles = Number(s.articles) || 0, revendus = Math.min(Number(s.revendus) || 0, articles);
  return {
    k: String(s.cle), nom: String(s.libelle || s.cle), genre: String(s.genre || ''),
    articles, revendus,
    // Le taux de revente : sur les articles achetés de cette source (aucun article ⇒ pas de taux, jamais 0 %).
    taux: articles > 0 ? Math.round((revendus / articles) * 100) : null,
    beneficeMoyen: fini(s.beneficeMoyen) ? Math.round(Number(s.beneficeMoyen)) : null,
    nBenef: Number(s.nBenef) || 0, partiel: !!s.partiel,
    delai: fini(s.delaiMoyen) ? Number(s.delaiMoyen) : null, nDelai: Number(s.nDelai) || 0,
    sansPrix: Number(s.sansPrix) || 0, pasSaisie: s.cle === 'non-saisie',
  };
}

// L'ordre d'un tri : « marge » = bénéfice moyen connu, le plus haut d'abord ; « vitesse » = délai le plus court ;
// « volume » = le plus de reventes. Une source sans la mesure va à la fin (jamais classée sur un chiffre qu'elle n'a
// pas) ; « source pas saisie » n'est pas une source : toujours en dernier.
export function ordreSources(rangees, tri = 'marge') {
  const v = tri === 'vitesse' ? (r) => r.delai : tri === 'volume' ? (r) => (r.revendus > 0 ? r.revendus : null) : (r) => r.beneficeMoyen;
  return (Array.isArray(rangees) ? rangees : []).slice().sort((a, b) => (a.pasSaisie - b.pasSaisie)
    || ((v(a) == null) - (v(b) == null))
    || (tri === 'vitesse' ? v(a) - v(b) : (v(b) || 0) - (v(a) || 0))
    || b.revendus - a.revendus || a.nom.localeCompare(b.nom, 'fr')).map((r) => r.k);
}

// LE MODÈLE DE L'AXE « Source » : même forme que les autres axes de `vendsMieuxAxe` là où l'écran la lit
// (`groupes`, `ordre`, `n`, `nCout`), plus ce qui est propre aux sources. `bilan` : `lireMeilleures(owner)`.
// undefined (pas encore lu) ⇒ undefined ; null (jamais publié) ⇒ null.
export function rentabiliteParSource(bilan) {
  if (bilan === undefined) return undefined;
  if (!bilan || !Array.isArray(bilan.sources)) return null;
  const rangees = bilan.sources.map(rangeeSource).filter((r) => r.articles > 0 || r.revendus > 0);
  const nBenef = rangees.reduce((t, r) => t + r.nBenef, 0), revendus = rangees.reduce((t, r) => t + r.revendus, 0);
  return {
    axe: AXE_SOURCE, groupes: rangees,
    ordre: { marge: ordreSources(rangees, 'marge'), vitesse: ordreSources(rangees, 'vitesse'), volume: ordreSources(rangees, 'volume') },
    n: revendus, nCout: nBenef,
    sansAchat: Number(bilan.sansAchat) || 0, achatPasLu: Number(bilan.achatPasLu) || 0,
    vintedLus: bilan.vintedLus !== false, at: fini(bilan.at) ? Number(bilan.at) : null,
  };
}

// La lecture (sur cet appareil, au nom de CE compte VRM) — l'écran s'abonne à la publication.
export { lireMeilleures, CLE_MEILLEURES, EVT_MEILLEURES };
