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

export function prochainGesteAnnonces({ aVerifier, sansNum, prixConnus, prixTotal, dorment } = {}) {
  if (ok(aVerifier)) return { cle: 'verifier', n: aVerifier, texte: 'Vérifie les numéros ci-dessous sur l’étiquette de chaque paire, avant d’imprimer leur bordereau.', bouton: 'Vérifier' };
  if (ok(sansNum)) return { cle: 'sansnum', n: sansNum, texte: sansNum > 1 ? 'Des annonces en ligne n’ont pas de numéro : donne-leur un numéro et écris-le sur leur carton.' : 'Une annonce en ligne n’a pas de numéro : donne-lui un numéro et écris-le sur son carton.', bouton: 'Voir' };
  if (Number.isFinite(prixTotal) && prixTotal > 0 && Number.isFinite(prixConnus) && prixConnus < prixTotal) {
    const manque = prixTotal - prixConnus;
    return { cle: 'prix', n: manque, texte: `Prix d’achat ${prixConnus}/${prixTotal} connus : saisis les autres, sinon ton bénéfice n’est qu’un minimum.`, bouton: 'Compléter' };
  }
  if (ok(dorment)) return { cle: 'dorment', n: dorment, texte: 'Des annonces dorment depuis longtemps : relance-les (republier ou baisser le prix).', bouton: 'Voir' };
  return null;
}
