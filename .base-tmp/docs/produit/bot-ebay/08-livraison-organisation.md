# Organisation — état de la première livraison

19 octobre 2026. Ce document distingue le code livré du périmètre cible des chapitres 01–07. Le catalogue de 48 idées reste un contrat de réalisation ; il ne constitue pas une liste de fonctions déjà actives.

## Parcours développés

- **Gestion → Organisation** : accès dans le rail ordinateur et le menu Gestion du téléphone, recherche et historique par rubrique, export privé JSON.
- **Missions** : création, attribution explicite à un membre actif de l’équipe existante, consignes, échéance, checklist, démarrage, blocage motivé, réalisation, validation du responsable, retour pour correction, annulation motivée et historique. L’exécutant retrouve ses missions dans son espace équipe.
- **Réservations** : référence unique saisie, quantité de départ déclarée, contrôle des quantités déjà réservées ou converties, expiration serveur, annulation et confirmation manuelle d’une vente. Prix et acompte déjà reçu en centimes, enregistrement d’un remboursement réellement effectué, sans mouvement de paiement.
- **Lots** : achat source, frais connus ou inconnus, décomposition nominative et répartition égale au plus fort reste. Export CSV avec deux colonnes séparées pour dépense source et ventilation analytique. Aucun ajout automatique à la comptabilité ou au stock existant.
- **Consommables** : unités entières explicites, stock initial inconnu ou compté, seuil, entrées, consommations, pertes et recomptages justifiés. Historique avant/après ; stock négatif refusé. Aucune consommation déclenchée par une impression.
- **Réceptions** : commande de référence, quantité attendue, quantité reçue et quantité contrôlée séparées, accessoires, numéro de série conservé comme texte, constats datés et corrections motivées. Aucun stock créé automatiquement.
- **Retours et litiges** : dossier interne lié à une référence, échéance réelle facultative, notes, étapes distinctes du retour et du contrôle, clôture et réouverture traçables. Aucun remboursement, réponse à une plateforme ou remise en stock automatique.
- **Veille eBay** : formulaire de critères sauvegardés (mots, exclusions, catégorie, état, pays et budget livré) dans Organisation et eBay → Achats. Le moteur pur de correspondance distingue oui / non / inconnu ; port, frais ou devise inconnus empêchent une correspondance vérifiée. **Aucun collecteur, notification de bonne affaire, enchère ou achat automatique n’est activé dans cette livraison.**

## Stockage et accès

Une ligne privée `app_data(owner,id)` avec `id=vrm_operations_v1`, indépendante de `main`. Les écritures propriétaire utilisent son JWT et RLS. La route vérifie sa session et son accès à chaque requête. Une révision commune et une écriture conditionnelle PostgREST empêchent deux fenêtres d’écraser les changements ou de consommer la même disponibilité sur la base d’une même version. L’insertion initiale repose sur l’unicité existante `(owner,id)`.

Chaque commande possède un UUID, une empreinte de son contenu et un auteur. Le rejeu d’une commande confirmée ne répète pas l’effet ; une collision de contenu ou d’auteur est refusée. Une réponse réseau perdue ne devient pas un succès à l’écran : actualisation et rejeu du même identifiant permettent de vérifier l’enregistrement.

Le membre passe par le serveur : l’appartenance active et l’accès du vendeur sont relus via `vrm_equipe_lister` à chaque requête. La clé de service reste au serveur, après ce contrôle. Seules les missions portant l’identifiant de cette adhésion sont renvoyées. Aucune liste de réservations, prix, lots, comptes plateforme, journal global ou consommables n’est projetée. Il peut commencer, cocher, bloquer ou terminer ses missions ; il ne peut pas les valider, créer des missions ou modifier d’autres ressources. Les consignes sont des textes explicitement partagés par le responsable : le formulaire lui demande de ne pas y inscrire de montants ni de codes secrets.

Le partage nécessite la migration équipe 016 existante et la clé serveur déjà utilisée par VRM. Une dépendance absente ou une lecture refusée produit une indisponibilité, jamais une équipe supposée vide ni un accès de repli. La révocation interdit les nouvelles requêtes ; elle ne promet pas d’effacer un écran déjà lu hors ligne.

Limites explicites de ce premier stockage : 500 éléments par rubrique, 5 000 commandes, 1,5 Mo par document. L’export ne purge pas les données. L’archivage de longue durée et une migration vers des tables métier dédiées restent à développer avant de dépasser ces limites.

## Ce qui reste à réaliser

La totalité du dossier produit n’est pas terminée. Restent notamment : collecteur eBay et cadence vérifiée, file de tâches persistante, déduplication des annonces, notifications consenties, profils avancés par catégorie, achat assisté puis automatique sous droits et mandat ; preuves photo privées, récurrence, dépendances et rôles de coordination ; liaison automatique des réservations au stock et aux plateformes, prolongation et justificatifs d’acomptes ; pondération et correction versionnée des lots vendus ; recettes d’emballage, conversions d’unités et coûts ; liens directs entre les dossiers, commandes et articles existants.

Les articles actuels et leurs montants ne sont pas rapprochés par leur seul titre. Les références internes restent explicites et les changements de statut locaux ne prétendent pas être des confirmations Vinted, Leboncoin ou eBay.

## Validation reproductible

```sh
node --test scripts/tests/operations.test.mjs
node scripts/tests/operations-interface.cjs
npm run build
node scripts/bancs/revendeurs.cjs
node scripts/bancs/equipe.cjs
```

Les tests métier/API et les parcours navigateur utilisent des données synthétiques. Ils exercent le vrai moteur, le vrai gestionnaire de route et les vrais composants, avec Supabase simulé ; ils ne prouvent ni l’installation des migrations dans une base réelle ni les droits eBay de production. Aucune commande commerciale, dépense ou communication à un acheteur n’est effectuée par ces tests.

Résultats de cette livraison : 29 tests métier/API, 27 contrôles des parcours Organisation, 202 contrôles revendeurs avec navigation Organisation intégrée et 78 contrôles équipe réussis. Compilation de production réussie. Captures synthétiques à 320, 390, 768 et 1 440 px ; absence de débordement horizontal vérifiée. Le test équipe vérifie aussi le contraste en mode sombre. La vérification d’identité et les écritures conditionnelles de la route sont testées contre un faux serveur Supabase, sans connexion aux comptes réels.
