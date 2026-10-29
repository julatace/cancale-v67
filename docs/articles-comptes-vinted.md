# Articles et comptes Vinted — 29 octobre 2026

## Accès

- **Annonces → Annonces à compléter** : deux listes, champs manquants et informations non récupérées. « Compléter » ouvre l'atelier VRM avec titre, prix, description, caractéristiques et dimensions facultatives. Le contenu enregistré est un **brouillon VRM**, pas une confirmation de modification de l'annonce native. Les photos passent par `PhotoVinted`, avec son secours par extension. Le lien vers l'édition native permet d'ajouter des photos / de choisir les attributs du catalogue. Aucun identifiant de catégorie ou taille n'est inventé.
- **Passeport de l'article → Annonces et prix** : rapprochement uniquement par `recreeDe` explicite, archives du coffre et identifiants natifs. Les conversations sont liées à `transaction.item_id`, jamais au titre. Une ancienne annonce supprimée peut ne plus être consultable sur Vinted. Les prix des sauvegardes ne prétendent pas former un historique exhaustif. Les modifications de prix futures confirmées par le geste « Modifier prix ou titre » sont conservées dans la clé privée synchronisée `vinted_prix_historique`. Un délai sans réponse ne crée aucun événement.
- **Messages → Synchronisation par compte** : capture, étendue de lecture, connexion réelle de l'extension et du compte Vinted. « Session expirée (401) » exige un refus 401 effectivement reçu lors d'une lecture forcée. Un échec générique n'est plus présenté comme une expiration certaine. Actions de vérification de l'extension, ouverture Vinted et relecture des données.
- **Ventes → Comparer mes comptes Vinted** : le même sélecteur de période pour tous les comptes, basé sur la date de vente, ventes finalisées seulement, mêmes exclusions que Ventes. CA connu, bénéfice avec couverture X/Y, annonces non vendues actuellement récupérées et expéditions restantes. Stock et tâches sont actuels : aucun stock passé n'est reconstitué. Lecture partielle explicitement signalée.

## Identité, argent, confidentialité

- Aucun rapprochement par titre, photo ou numéro seul. Parents contradictoires, cycles et numéros incompatibles bloquent l'extension de la chaîne. Lectures privées paginées avec propriétaire explicite, contrôle du résultat et de la session après les réponses.
- Le report du numéro fusionne une nouvelle fiche déjà créée sans numéro. Un numéro différent déjà attribué n'est pas écrasé.
- Un brouillon d'un autre article sous le même numéro n'est pas réutilisé dans l'atelier. Il est archivé sous `article:<identifiant>` au prochain enregistrement.
- Calcul monétaire via `beneficePaire` : coûts et frais complets exigés pour le bénéfice calculable. Un montant absent ne devient pas zéro ; les pertes restent négatives. Les chiffres ne constituent pas un bénéfice global si certaines ventes sont incomplètes.
- Aucun test ne contacte ni ne modifie un vrai compte Vinted. Pas de nouvelle extension à installer pour ces écrans.

## Contrôles

- `node scripts/tests/outils-articles-vinted.test.mjs`
- `node scripts/tests/outils-articles-vinted-interface.cjs` (320, 390, 1512 px ; changement de propriétaire pendant une lecture)
- `node scripts/tests/synchronisation-vinted-interface.cjs`
- `node scripts/audit-parcours-production.mjs`
- `npm run build`
- `VRM_MESSAGES_SEARCH_ONLY=1 node scripts/bancs/messagerie.cjs`

Les bancs utilisent des données synthétiques. Ils ne certifient pas la complétude des archives réelles, les sessions natives des utilisateurs, ni les politiques RLS de production.
