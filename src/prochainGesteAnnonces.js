// ══ ANNONCES : LE PROCHAIN GESTE, EN TÊTE (6 nov.) ═══════════════════════════
// Julien : « on doit être beaucoup plus accompagné par l'app ». L'écran Annonces
// disait déjà chaque manque à sa place (« N numéros à vérifier », le filtre
// « Sans numéro », « Prix d'achat N/M », « À relancer ») — sans dire PAR OÙ
// commencer. Une ligne en tête nomme LE geste qui compte le plus, avec son bouton.
// L'ordre est celui du risque (§5) :
//   1. un N° à vérifier sur son étiquette : un faux N° envoie la mauvaise paire ;
//   2. une annonce en ligne sans N° : rien sur le carton pour la retrouver ;
//   3. des prix d'achat manquants : le bénéfice n'est qu'un minimum ;
//   4. des annonces qui dorment : à relancer (son choix : republier, baisser).
// Le même nombre ne s'écrit pas deux fois (§7) : le geste ne redit pas un compteur
// déjà affiché à côté (« N numéros à vérifier », le filtre « Sans numéro ») ; seul
// « Prix d'achat N/M » passe dans la ligne du geste (l'écran ne le redit plus).
// Aucun nombre n'est recalculé ici : l'écran passe ses compteurs (§11). Un compteur
// pas su (`null`/`undefined`) ne déclenche rien — jamais un geste inventé.
// Règle PURE : l'écran et `scripts/audit-onglets-d.cjs` l'appellent.

const ok = (n) => Number.isFinite(n) && n > 0;

// (10 nov., lot AI — « Encore du texte ») Chaque phrase tient en 12 mots au plus.
// (7 nov.) `ecrit` : le vendeur numérote LUI-MÊME dans ses annonces (src/numeroEcrit.js) — VRM ne
// donne aucun N° : le geste est de l'écrire dans l'annonce.
export function prochainGesteAnnonces({ aVerifier, sansNum, prixConnus, prixTotal, dorment, ecrit = false } = {}) {
  if (ok(aVerifier)) return { cle: 'verifier', n: aVerifier, texte: 'Vérifie les numéros sur l’étiquette avant d’imprimer.', bouton: 'Vérifier' };
  if (ok(sansNum)) return { cle: 'sansnum', n: sansNum, texte: ecrit ? (sansNum > 1 ? 'Annonces sans numéro : écris-le en fin de description.' : 'Annonce sans numéro : écris-le en fin de description.') : (sansNum > 1 ? 'Des annonces n’ont pas de numéro : donne-leur un N°.' : 'Une annonce n’a pas de numéro : donne-lui un N°.'), bouton: 'Voir' };
  if (Number.isFinite(prixTotal) && prixTotal > 0 && Number.isFinite(prixConnus) && prixConnus < prixTotal) {
    const manque = prixTotal - prixConnus;
    // (12 nov., finitions) §5 : un total partiel ne se présente pas comme complet, et « au moins » ne se
    // dit jamais sans rien de connu. 0 prix connu ⇒ le bénéfice est « — » et le manque est NOMMÉ ;
    // k connus ⇒ « au moins », avec la couverture. « Compléter » ouvre la saisie en série.
    const texte = prixConnus === 0
      ? `Bénéfice — : prix d’achat 0/${prixTotal} connus.`
      : `Bénéfice au moins : prix d’achat ${prixConnus}/${prixTotal} connus.`;
    return { cle: 'prix', n: manque, texte, bouton: 'Compléter' };
  }
  if (ok(dorment)) return { cle: 'dorment', n: dorment, texte: 'Des annonces dorment : republie-les ou baisse le prix.', bouton: 'Voir' };
  return null;
}
