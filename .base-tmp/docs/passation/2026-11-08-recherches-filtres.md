# 8 novembre — recherches et filtres plus compréhensibles

Suite à « continue », base `3ad43c3f`. Aucun changement d'extension, de route ni de droits d'accès.

- E-mails : un résumé compact apparaît lorsque plusieurs filtres se cumulent (rubrique, compte, non lus, à vérifier, recherche). « Réinitialiser les filtres » remet la vue complète du vendeur, ferme la lecture et efface aussi la saisie différée. Le résumé ne recopie ni adresse ni terme recherché.
- ChampRecherche partagé : effacer, saisir à la main ou commencer une composition annule la dictée active. Une ancienne transcription ou fin de session ne peut plus modifier le champ, couper une nouvelle dictée ou agir après démontage. Échap annule aussi une dictée dans un champ vide. La normalisation des numéros et le mode brut sont conservés.
- Pendant une composition de texte, Entrée ne valide pas prématurément ; Échap ne vide pas le champ ni ne remonte à un dialogue parent. Le bouton du microphone annonce « Arrêter la dictée » pendant son utilisation.

Vérifications : compilation ; audits des composants et de la recherche vocale ; 24 contrôles Chromium du vrai composant avec API vocale simulée, à 390 et 1512 px. Banc rouge sur la base, puis après mutation retirant la vérification d'identité de la reconnaissance : un résultat annulé rappelle le gestionnaire de changement. Le banc boîte mail existant vérifie aussi les requêtes de combinaison/réinitialisation de compte et rubrique, en clair/sombre et téléphone/ordinateur. Capture des nouveaux contrôles examinée.

La simulation prouve le traitement des événements tardifs, pas la qualité de la reconnaissance vocale d'un appareil réel. Aucun son réel, message ni donnée de production utilisé.
