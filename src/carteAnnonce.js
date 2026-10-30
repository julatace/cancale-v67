// ── LA FICHE D'UNE ANNONCE : L'ÉTAT EN JAUGE (29 octobre) ───────────────────
// Julien : « pour l'état peut-être faire quelque chose de plus original avec à
// côté la saisie du prix d'achat ». L'état n'est plus un mot gris perdu dans une
// ligne : c'est une JAUGE à cinq barres (comme le signal d'un téléphone), de
// « Satisfaisant » (1) à « Neuf avec étiquette » (5), le mot écrit dessous.
//
// MESURÉ le 29 octobre (lecture seule, ses 159 annonces en ligne) : Vinted écrit
// exactement cinq libellés — « Très bon état » 131 · « Bon état » 18 · « Neuf
// sans étiquette » 4 · « Neuf avec étiquette » 2 · « Satisfaisant » 2 — et deux
// annonces n'en ont aucun.
// ⚠️ On compare le libellé ENTIER (accents et casse ignorés), jamais un
//    morceau : « bon état » est dans « Très bon état ». Un libellé que Vinted
//    écrirait demain sans qu'on le connaisse est AFFICHÉ tel quel, sans jauge
//    (jamais un niveau deviné) ; aucun libellé ⇒ `null` (la fiche dit « — »).
export const ETATS_VINTED = Object.freeze([
  Object.freeze({ niveau: 5, libelle: 'Neuf avec étiquette' }),
  Object.freeze({ niveau: 4, libelle: 'Neuf sans étiquette' }),
  Object.freeze({ niveau: 3, libelle: 'Très bon état' }),
  Object.freeze({ niveau: 2, libelle: 'Bon état' }),
  Object.freeze({ niveau: 1, libelle: 'Satisfaisant' }),
]);
export const NIVEAU_ETAT_MAX = 5;

const sansAccent = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export function etatVinted(statut) {
  const brut = String(statut == null ? '' : statut).replace(/\s+/g, ' ').trim();
  if (!brut) return null;
  const n = sansAccent(brut);
  const connu = ETATS_VINTED.find((e) => sansAccent(e.libelle) === n);
  return connu ? { niveau: connu.niveau, libelle: connu.libelle } : { niveau: null, libelle: brut };
}
