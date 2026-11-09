# 8 novembre — navigation par tâches et plateformes choisies

Demande de Julien : retirer les doublons de plateformes de la colonne ordinateur ; choisir les sites au premier démarrage, les activer ensuite dans les paramètres ou via une connexion.

## Livré

- Colonne : tâches uniques, groupes Vendre / Gérer / Argent et Paramètres au pied. Les anciens liens restent résolus par la tâche.
- Première visite authentifiée : « Où vends-tu ? » avant le guide existant. Le choix reste disponible dans Paramètres → Affichage → Mes plateformes.
- `vrm_plateformes_affichees` synchronisé par SYNC_KEYS, dans le stockage déjà cloisonné du vendeur. Défaut : Vinted ; sites reliés ajoutés sur preuve du registre de SON compte. Une erreur de lecture n’invente pas une connexion et ne retire pas la dernière preuve lue. Lecture légère des identifiants, rafraîchie après capture de l’extension et retour dans l’app ; dernière réponse seule applicable.
- Affichage uniquement : tous les calculs et les données restent intacts, y compris « Tous ». Un filtre mémorisé vers un site masqué revient à une vue affichée. Un compte déjà relié reste visible, ce que le panneau explique.
- Les préférences publiées dans le profil portent l’UID : aucun ancien choix présenté au propriétaire suivant avant chargement.
- Boutons désactivés : toucher affiche leur raison existante (`title` / `aria-description`), sans activer le bouton. Action occupée : attendre le résultat.
- ChampSaisie partagé : une validation qui rejette ou retourne false conserve la saisie, indique le champ invalide et accepte une nouvelle tentative ; verrou immédiat pendant la promesse ; composition protégée. Les anciens handlers qui ne renvoient pas de promesse restent compatibles (ils conservent leur propre traitement serveur).
- Impression : détail des colis exacts avant lancement, numéros et bordereaux manquants ; sélections périmées / non sélectionnables explicitement exclues.
- Favoris : état confirmé distinct du résultat incertain, invitation explicite à vérifier avant relance. Garde-fous et moteur inchangés.
- Annonces et messages : état vide dû au filtre expliqué et geste de réinitialisation, distinct d’une panne et d’une vraie liste vide.

## Vérifications

Règles pures, composants réels à 390/1512, parcours de l’app sur base fictive (premier choix → persistance → filtres → connexion détectée → paramètres), clair/sombre, toucher sur bouton réellement désactivé et fenêtre basse. Aucun message ni écriture de test en production. CI et détails de validation dans la PR.

Aucun geste technique requis, aucune extension modifiée. Ceci ne prétend pas remplacer les tests sur chaque navigateur réel ou une validation des fournisseurs OAuth.

Validation finale locale : 46 contrôles navigation/activation (dont écriture réellement reçue dans la base fictive), 20 composants dédiés, 274 contrôles du banc composants, profil de vendeurs différents vert ; 104 contrôles argent/mois verts ; audit identité et 45 contrôles prix/numérotage verts. Le banc historique cible désormais son propre summary, puisque la sélection possède un second détail. Le jeu argent/mois fixe son fuseau à Paris, comme son navigateur : le dimanche après 23 h UTC il attendait encore la semaine précédente (12 faux échecs), sans défaut dans l’app. Les tests purs exécutent aussi le hook de profil pour prouver le rejet du profil d’un autre UID.

Le refus `etat: illisible` du véritable parseur de prix est aussi transmis au champ : le texte invalide reste corrigeable, sans enregistrer de valeur inventée.

## Finition du 9 novembre

Le démarrage suit aussi un choix sans Vinted : eBay seul ne demande plus de relier Vinted ; le guide explique la connexion des sites choisis. Un seul site ne produit pas une barre de filtres inutile. L’icône d’Affichage devient un œil pour ne pas doubler celle de Mes plateformes. Les composants communs retrouvent le dernier import CSS. L’audit du raccordement des emails accepte la carte passée par son animation `P`, déjà présente sur main ; sa suppression reste refusée (12 mutations attrapées).

Les lots d’audits ont été exécutés localement : les tests SQL n’ont pas pu tourner faute de PostgreSQL, et deux anciens audits d’extension cherchent un Chromium absent à leur emplacement par défaut. Aucun code SQL, d’authentification ou d’extension n’a été modifié par cette refonte. Les paquets régénérés par les audits ont été remis à leur version originale.
