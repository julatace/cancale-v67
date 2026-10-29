# Offres : états connus et transaction exacte — extension 5.286

Une copie en attente d’un même message pouvait écraser l’état déjà connu de
l’offre lors de la fusion des captures. L’offre redevenait alors actionnable.

La fusion partagée app/extension conserve désormais l’état accepté, refusé,
expiré/annulé ou précédent face à une copie en attente. Une nouvelle offre avec
ses propres identifiants reste distincte, et une vraie acceptation/refus peut
terminer une offre précédente. Deux identités contradictoires pour le même
message font refuser la fusion : aucune valeur choisie arbitrairement.

La sélection d’offre actionnable et le résumé des négociations protègent aussi
l’état « précédente » contre les doublons. Le résumé exclut les offres dont
l’identifiant de transaction contredit explicitement celui de la conversation.
Pas de rapprochement par titre ou pseudo ; pas de paiement déduit d’une offre.

## Validation

- Les nouveaux cas du sélecteur/suivi échouaient sur l’ancien code.
- `offres-fusion.test.mjs` exécute le module app ET la vraie fonction générée
  dans le worker. Cas : ancien état en attente, fin d’offre réelle, nouvelle
  offre distincte, identifiants contradictoires, absence de mutation des entrées.
- Tests de photos/historique et audit de fusion inbox, contrôles des archives
  et des adaptations navigateur, compilation et audits critiques.
- Archives Chrome et Orion construites depuis les mêmes sources 5.286.0.

Tests synthétiques uniquement ; aucun message, offre ni changement de compte
marchand effectué. Une extension déjà installée doit être remplacée puis rechargée
pour appliquer la correction à ses futures captures. Les états terminés perdus
avant cette mise à jour ne sont pas reconstruits : une nouvelle lecture native
reste nécessaire. La compatibilité réelle d’Orion sur iPhone reste à vérifier sur
appareil ; le paquet n’en donne pas la garantie.
