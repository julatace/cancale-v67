# Favoris : lancement, conversations existantes et progression — 5.216

Julien signale un bouton grisé avec la bonne extension, puis un fonctionnement intermittent et l'absence d'envoi. Il demande de ne jamais envoyer le message aux favoris dans un fil déjà commencé, et un suivi visible des étapes et de l'attente entre messages.

## Lancement

Le bouton reste cliquable hors requête en cours : il explique un prérequis manquant au clic sans lancer de requête d'envoi. La lecture initiale de l'état de la file n'est plus un verrou permanent si elle échoue. Ses réponses anciennes sont invalidées avant toute mutation, pour ne pas remplacer une file tout juste lancée. Un brouillon valide est sauvegardé et son reçu contrôlé au clic de lancement ; une modification en cours de sauvegarde, une session changée ou un reçu incertain interdisent le lancement.

`FavorisConnectes` écoute les changements du pont. La vérification attend la fin du comptage des extensions, puis lit un état frais ; elle utilise la version du code mesurée, sans dépendre d'un ancien `ready`. Elle conserve les refus pour plusieurs extensions et code périmé. Le banc complet reproduit l'installation en cours d'utilisation : ancien code refusé avec explication, mise à jour de l'unique pont, puis lancement sans remontage de l'écran. Il faut un identifiant de pont stable dans cette fixture : changer de version ne doit pas simuler une deuxième extension.

Le compte VRM de l'extension et le compte Vinted sélectionné sont aussi contrôlés avant préparation de la file. La liaison de session VRM utilise le mécanisme adressé existant, puis relit l'état ; aucune reprise sur une session propriétaire supposée.

## Règle d'historique et résultats

L'extension **5.216.0** lit la conversation juste avant le message, après contrôle de l'autorisation serveur. Tout message utilisateur, réponse, texte ou offre observé dans `messages[]` entraîne le résultat `ignore`, sans appel `/replies`. Historique absent, partiel ou type non reconnu => arrêt explicite sans message. Les étapes système connues seules ne prouvent pas un contact humain. Cette vérification porte sur le dernier historique retourné par Vinted : il n'existe pas de verrou atomique côté Vinted contre un message concurrent entre lecture et écriture.

Une conversation ignorée ne consomme pas de quota d'envoi ni l'intervalle du message suivant ; l'ouverture native reste une action comptée dans le plafond existant de l'extension. Le dédoublonnage des ignorés est conservé. Les refus ne sont pas rejoués automatiquement : une nouvelle sélection explicite peut les préparer à nouveau et revérifie l'historique. Envois confirmés et incertitudes restent protégés contre le renvoi. Le serveur refuse une consommation par un ancien moteur ne déclarant pas au minimum la 5.216, pour que la règle ne soit pas contournée par un paquet 5.215 resté ouvert.

Les raisons sont des codes bornés : historique non vérifié, identité non confirmée, session de l'extension, compte différent, plafond d'actions, pause Vinted, autorisation expirée, création ou accusé non confirmé. L'écran affiche leur traduction et les erreurs du pont sans présenter un refus avant dispatch comme un message peut-être envoyé.

## Suivi

Chaque lancement reçoit un identifiant de lot distinct. La barre ne compte que la sélection courante, séparément de l'historique de dédoublonnage. `envoyé`, `ignoré`, `interrompu`, `incertain` et `annulé` restent distincts. Les fractions de barre suivent exclusivement les étapes réellement émises par l'extension ; le compteur d'envois confirmés n'avance qu'après accusé et enregistrement serveur.

Les événements `favoris` portent un identifiant de suivi non secret, le compte et une étape autorisée ; aucun ticket d'autorisation ni texte de message. L'écran refuse les événements d'un autre compte ou d'une autre tentative. Le temps restant est recalculé chaque seconde avec l'horloge serveur ; le prochain passage est une vérification, pas une promesse d'envoi à la seconde. Le délai fixe choisi et le plafond horaire restent prioritaires. Même exigence d'écran VRM ouvert et visible avec extension compatible ; pas de nouveau moteur en arrière-plan ou de relais téléphone.

## Validation

45 tests unitaires (dont lot courant, ignorés distincts des envoyés, quota restitué et intervalle non consommé après historique existant, ancienne version refusée). 44 contrôles du vrai background et HTTP sur fixtures : message existant, offre, historique absent/partiel, phases réelles, absence de ticket ou texte dans les événements, session absente, aucune réponse supplémentaire ni rejeu. 66 contrôles React : erreur de lecture initiale, réponse ancienne tardive, sauvegarde au lancement et refus de sauvegarde, progression partielle sans succès fictif, événements étrangers ignorés et compte à rebours réellement mis à jour. 72 contrôles liste/préférences, 30 diagnostic ; 45 contrôles du banc application complète et audits exec/cohérence/ZIP/navigateurs/offres. Aucune session réelle utilisée pour envoyer des messages.
