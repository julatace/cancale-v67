# Vendus ailleurs et bilan des lectures — 29 octobre 2026

## Utilisation

Dans Ma journée, Annonces et Ventes Vinted, la section repliée **Vendus ailleurs · annonces à retirer** vérifie Vinted, Leboncoin et eBay au premier clic. Elle montre le numéro VRM, l'article, la plateforme de vente, le compte et l'annonce encore proposée. Le lien ouvre l'annonce native lorsqu'une URL vérifiée est disponible ; **Gérer le retrait** ouvre les actions existantes de la plateforme dans VRM. Le vendeur utilise le compte indiqué et confirme l'action. Cette vue ne déclenche aucune suppression, pause ou fin d'annonce automatiquement.

**Revérifier les annonces** relit les captures de VRM, pas directement les plateformes. Un changement sur la plateforme doit donc d'abord être capté/synchronisé. Une annonce inactive explicitement reçue confirme la sortie de vente ; une absence ne suffit que si une capture complète de cette plateforme est postérieure à la preuve précédente. Sinon l'ancienne alerte reste « retrait non confirmé ». Une erreur conserve les alertes ; une attente de plus de 20 secondes rend une erreur récupérable. Les correspondances contradictoires ne sont pas proposées comme certains retraits.

Le **Bilan des données lues** compare les lectures confirmées d'une même vue/session, compte par compte. Première lecture : nombre d'éléments déjà présents, aucun faux « nouveau ». Ensuite : ajouts et modifications avec accès aux éléments concernés (30 premiers affichés). Une source qui échoue ne remplace pas sa référence précédente par du vide. Les éléments absents d'une liste limitée ne sont pas comptés comme supprimés. Les dates affichées désignent le bilan local VRM, jamais une nouvelle capture native inventée.

Le bilan couvre les ventes, annonces et conversations Vinted ; les annonces Leboncoin ; les annonces et commandes eBay dans l'écran de connexion/synchronisation eBay. Il ne prétend pas compter les messages individuels à partir de conversations, ni garantir un historique complet.

## Identité et isolation

- Sources de vente Vinted : identifiants natifs vendus et transactions → `item_id` exact. Pas de titre, photo similaire ni simple marquage manuel pour affirmer un retrait natif.
- Leboncoin : vendeur prouvé et vente non annulée, annonce → référence VRM ou lien manuel (`numeroLbcIdentite`). Les annonces à retirer doivent appartenir à un compte observé ou avoir un lien manuel explicite ; un état non reçu n'est pas supposé actif.
- eBay : annonces et commandes des comptes actifs (`lireEbayTous`, propriété **items**), identification canonique par liens/SKU et commande engagée.
- Une référence doit correspondre à une fiche VRM. Plusieurs fiches sous le même numéro doivent former une chaîne explicite `recreeDe` ; aucun rapprochement par titre. Une remise en vente sur la plateforme source rend l'alerte à confirmer.
- Lectures Leboncoin privées avec propriétaire explicite et contrôle des lignes retournées ; les résultats tardifs après changement de propriétaire sont refusés. Aucun diagnostic ne transfère ces éléments à un tiers.
- Les bilans restent en mémoire dans la vue ; les alertes non confirmées sont conservées en mémoire pendant la navigation vers une autre plateforme. Ces données sont réinitialisées au changement de propriétaire. Aucun nouvel historique lourd en base, pas de migration SQL ni d'extension à installer.

## Vérification synthétique

- `node scripts/tests/bilan-synchronisation.test.mjs` : 28 assertions (première lecture, ajouts, prix modifiés, échec, pagination, identités, ambiguïtés, doublons contradictoires, retrait confirmé).
- `node scripts/tests/bilan-synchronisation-adaptateur.test.mjs` : exécute le vrai lecteur de l'app avec sources simulées ; vérifie `eBay.items`, URL/compte Leboncoin, contrôle propriétaire et changement de session.
- `node scripts/tests/bilan-synchronisation-interface.cjs` : React à 320, 390 et 1512 px ; état partiel, erreur, sortie native confirmée et réponse tardive d'une ancienne session.
- `node scripts/audit-parcours-production.mjs`, `npm run build` et banc de messagerie live.

Les tests n'accèdent à aucun compte marchand réel et ne déclenchent aucun retrait réel. La complétude des captures réelles reste indiquée dans l'interface.
