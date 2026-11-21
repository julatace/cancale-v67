# Finitions transversales et catalogue Leboncoin

## Présentation

Les composants partagés Notice, EmptyState, Input, Field, Btn et Toaster ont des repères CSS explicites. Leurs messages, formulaires et boutons suivent la palette de gestion ; les tons d'alerte et les boutons personnalisés conservent leur couleur. Les messages éphémères utilisent les icônes au trait, restent fermables et respectent la réduction des animations. Les notes des paramètres ont une interligne régulière. Les surfaces Organisation, Réception des emails et reçus sont harmonisées, sans rendre une erreur invisible. Le champ natif de photo de profil est relevé à 44 px ; les trois onglets de paramètres tiennent sur la même ligne.

## Annonces Leboncoin

L'écran ne présentait pas un catalogue complet des annonces déjà reçues : il utilisait surtout les annonces non vendues pour les files à publier/relier/retirer. Le nouveau catalogue reçoit les seules annonces attribuables au vendeur par les règles existantes. Il conserve aussi celles vendues et propose recherche et filtres Toutes / Actives / En pause / Vendues / Autres états.

Une transaction dont le vendeur et l'identifiant d'annonce sont confirmés prime sur un ancien statut actif ; achats et transactions annulées/remboursées sont exclus. Publication et suivi de vente/livraison sont affichés séparément. Un état inconnu n'est jamais inventé actif ; les formats objet ne deviennent pas `[object Object]`. Le lien Gérer n'accepte que HTTPS sur Leboncoin et ouvre le site : aucune commande distante de pause/réactivation n'est inventée. L'extension 5.212 reste inchangée ; aucun effacement ou reclassement financier.

Le catalogue montre les annonces déjà reçues, pas celles que la capture n'a jamais transmises. Une liste vide n'entraîne aucune suppression d'historique. Les règles partagées de prévention des doublons et de republication restent inchangées : une annonce en pause n'est pas reproposée automatiquement.

## Validation

Build Vite et tests unitaires ; parcours des paramètres (sous-écrans, cibles tactiles et interrupteurs), comptabilité/stock, réception des emails et organisation. Nouveau parcours React du catalogue à 320, 390 et 1512 px en clair/sombre : filtre pause, vente prouvée, recherche, montants non coupés, liens et cibles de 44 px, échec de lecture distinct d'un catalogue vide. Réponses simulées, aucune session réelle ni écriture commerciale.
