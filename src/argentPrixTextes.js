// (14 nov., lot argent-prix) Les phrases courtes des cartes, d'une seule source (§5 : la phrase qui
// explique un chiffre vient de la même source que lui). Aucune règle ici : elles LISENT les sorties
// de src/litigesEcran.js, src/tauxOffres.js, src/prixVoulu.js.
import { tr, nombre } from './i18n/index.js';

export const pctTexte = (p) => (p == null ? '—' : `${nombre(p, { maximumFractionDigits: 1 })} %`);
// 112 : « Retours 13 % · Litiges 7 % » (taux « — » sous 3 ventes du modèle) ; « au moins » si une cause n'est pas lue.
export function texteTauxRetours(l) {
  if (!l) return '';
  const am = l.auMoins ? tr('ap.auMoins') + ' ' : '';
  return tr('ap.ret.taux', { r: am + pctTexte(l.tauxRetour), l: am + pctTexte(l.tauxLitige) });
}
