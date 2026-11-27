// ── src/filtrePlateforme.js — LE FILTRE PAR PLATEFORME DES ONGLETS (25 nov. soir) ─────────────────────────────────────
// Julien : « On doit avoir un filtre avec toutes les plateformes et par plateforme dans les onglets. » (et, plus tôt :
// « laisse le design de l'app actuel » — aucune refonte : la rangée de puces d'Annonces, le menu de filtres du tableau).
//
// Module PUR (aucun React) : UNE règle dit à quelle plateforme appartient une ligne, la même pour chaque écran.
//   · sitesDeLigne(x) : les sites d'une ligne PAR SON CHAMP LU — `x.site` (une vente, un colis, un achat : la ligne de
//     l'écran le porte déjà, posé par SA lecture) ; un ARTICLE (Annonces) appartient aux sites de SES annonces
//     (`x.annonces[].site`, la règle de `filtrerArticles`). Jamais par titre, jamais par ressemblance (§5) : un site
//     inconnu ou absent ⇒ aucune plateforme (la ligne n'est montrée que sous « Toutes »).
//   · nombresPlateformes(lignes) : { toutes, vinted?, leboncoin?, ebay?, vestiaire? } — un site sans ligne n'a pas d'entrée.
//   · optionsPlateformes(nombres) : « Toutes » puis chaque site PRÉSENT, dans l'ordre de src/plateformes.js ; moins de deux
//     sites ⇒ [] (un filtre à une seule plateforme ne filtrerait rien : il n'est pas montré).
//   · choixEffectif(choix, options) : le choix retenu, s'il a une entrée ; sinon « toutes » (jamais un filtre vide).
//   · filtrerPlateforme(lignes, choix) : les lignes du site choisi (« toutes » ⇒ toutes).
//   · lireChoixPlateforme(ecran) / ecrireChoixPlateforme(ecran, choix) : le choix de CET appareil, par écran, dans UNE clé
//     nommée (`vrm_filtre_plateformes`, jamais synchronisée : elle ne touche à aucune donnée).
// Gardien : scripts/bancs/filtre-plateformes.cjs (rendu) et scripts/audit-filtre-plateformes.cjs (la règle).
import { IDS_PLATEFORMES } from './plateformes.js';
import { lireLocal, ecrireLocal, lireJSON } from './stockageSur.js';

export const TOUTES = 'toutes';
export const CLE_FILTRE_PLATEFORMES = 'vrm_filtre_plateformes';
export const ECRANS_FILTRE = Object.freeze(['annonces', 'ventes', 'achats']);

const connu = (s) => IDS_PLATEFORMES.includes(s);

export function sitesDeLigne(x) {
  if (!x || typeof x !== 'object') return [];
  if (Array.isArray(x.annonces)) return [...new Set(x.annonces.map((a) => a && a.site).filter(connu))];
  return connu(x.site) ? [x.site] : [];
}

export function nombresPlateformes(lignes) {
  const out = { [TOUTES]: 0 };
  for (const x of Array.isArray(lignes) ? lignes : []) {
    out[TOUTES] += 1;
    for (const s of sitesDeLigne(x)) out[s] = (out[s] || 0) + 1;
  }
  return out;
}

// `nombres` : { toutes, site: n } (nombresPlateformes, ou les nombres qu'un écran tient déjà de SA règle) ; `null` = pas su.
export function optionsPlateformes(nombres) {
  if (!nombres || typeof nombres !== 'object') return [];
  const sites = IDS_PLATEFORMES.filter((s) => Number.isFinite(nombres[s]) && nombres[s] > 0);
  if (sites.length < 2) return [];
  return [{ cle: TOUTES, n: Number.isFinite(nombres[TOUTES]) ? nombres[TOUTES] : null }, ...sites.map((s) => ({ cle: s, n: nombres[s] }))];
}

export function choixEffectif(choix, options) {
  return Array.isArray(options) && options.some((o) => o.cle === choix) ? choix : TOUTES;
}

export function filtrerPlateforme(lignes, choix) {
  if (!Array.isArray(lignes) || !choix || choix === TOUTES) return lignes;
  return lignes.filter((x) => sitesDeLigne(x).includes(choix));
}

const tous = () => { const v = lireJSON(lireLocal(CLE_FILTRE_PLATEFORMES, null), null); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
export function lireChoixPlateforme(ecran) {
  const v = tous()[ecran];
  return v === TOUTES || connu(v) ? v : TOUTES;
}
export function ecrireChoixPlateforme(ecran, choix) {
  if (!ECRANS_FILTRE.includes(ecran) || !(choix === TOUTES || connu(choix))) return false;
  return ecrireLocal(CLE_FILTRE_PLATEFORMES, { ...tous(), [ecran]: choix });
}

// ── (27 nov.) LE FILTRE « COMPTE » DES VENTES, au téléphone comme à l'ordinateur ─────────────────────────────────────────
// Julien a choisi de rendre au téléphone le filtre « Compte » que le tableau de l'ordinateur avait déjà. UNE règle pour
// les deux : une vente appartient au compte que SA lecture a posé sur sa ligne (`x.compte`, le compte sous lequel la vente
// a été lue — jamais son titre, jamais une ressemblance, §5). Un compte exclu n'a aucune ligne (l'écran l'écarte avant,
// `compteEcarte`) : il n'apparaît donc jamais ici.
//   · comptesDeLignes(lignes) : les comptes présents, triés (fr) ; une ligne sans compte n'en ajoute aucun ;
//   · choixCompteEffectif(choix, comptes) : le choix retenu s'il est encore présent, sinon '' (« Tous les comptes ») ;
//   · filtrerCompte(lignes, compte) : les lignes de CE compte ('' ⇒ toutes).
// Le choix est retenu comme celui du site (la même clé `vrm_filtre_plateformes`, jamais synchronisée), mais PAR VENDEUR
// (l'identifiant de sa session VRM) : un autre vendeur sur le même appareil repart de « Tous les comptes ».
export const COMPTE_TOUS = '';
export function comptesDeLignes(lignes) {
  return [...new Set((Array.isArray(lignes) ? lignes : []).map((x) => (x && typeof x.compte === 'string' ? x.compte : '')).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
}
export function choixCompteEffectif(choix, comptes) {
  return typeof choix === 'string' && choix && Array.isArray(comptes) && comptes.includes(choix) ? choix : COMPTE_TOUS;
}
export function filtrerCompte(lignes, compte) {
  if (!Array.isArray(lignes) || !compte) return lignes;
  return lignes.filter((x) => x && x.compte === compte);
}
const cleCompte = (ecran) => 'compte:' + ecran;
export function lireChoixCompte(ecran, vendeur) {
  const v = tous()[cleCompte(ecran)];
  if (!v || typeof v !== 'object' || !vendeur || v.vendeur !== String(vendeur)) return COMPTE_TOUS;
  return typeof v.compte === 'string' ? v.compte : COMPTE_TOUS;
}
export function ecrireChoixCompte(ecran, vendeur, compte) {
  if (!ECRANS_FILTRE.includes(ecran) || !vendeur || typeof compte !== 'string') return false;
  return ecrireLocal(CLE_FILTRE_PLATEFORMES, { ...tous(), [cleCompte(ecran)]: { vendeur: String(vendeur), compte } });
}
