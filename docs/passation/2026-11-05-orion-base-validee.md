# Appliquer la demande sur la base qu’il a pu installer — 5.322.0

Julien confirme le 5 novembre que l’archive de référence 5.319.0 remise intacte s’installe, puis demande d’y appliquer ses modifications. Cette confirmation établit enfin la base sur son appareil. La cause précise du refus de 5.320/5.321 n’est pas établie.

## Modification limitée
Le moteur d’authentification et l’adaptateur Orion retrouvent le code de la référence 5.319. L’adaptation supplémentaire des rappels aux API uniquement à promesses et les délais réseau ajoutés en 5.320 sont retirés : ils ne faisaient pas partie de la demande précisée par Julien (l’ouverture de VRM fait quitter Vinted). Ce retour concerne la base commune, sans créer un moteur Orion séparé qui pourrait diverger des prochaines versions. Les gardes de propriétaire, session, captcha, cookies et plafonds du moteur 5.319 restent intactes.

Seul `popup.js` change fonctionnellement par rapport à l’archive confirmée installable :
- dans Orion, les champs email/mot de passe sont directement visibles et « Me connecter » est principal ; « Autre méthode de connexion » est facultatif pour OAuth/captcha ;
- le mot de passe envoie `ouvrir:false` au moteur ;
- son succès affiche le compte connecté au lieu d’ouvrir VRM ;
- rouvrir le panneau connecté dans Orion laisse également la plateforme ouverte ; Chrome garde son ouverture habituelle à la consultation de l’icône déjà connectée ;
- le texte explique qu’aucun onglet VRM n’est requis pour la capture.

La visite après connexion, déjà présente dans la référence, relance la lecture de Vinted. Pas de nouvelle requête marchande ni de nouvelle permission. Le code de tous les autres membres du paquet Orion est identique à la référence, après substitution des numéros de version. Manifeste 5.322.0 ; les droits portables 644/755 de l’archive sont conservés.

## Contrôles et limites
`orion-base-validee.py` compare le véritable XPI à l’ancienne archive et refuse tout changement hors `popup.js` et numéros de version. Le banc du vrai popup vérifie les API natives à rappels ou hybrides de cette base : succès, compte affiché, pas d’onglet VRM, une demande malgré plusieurs Entrée, réouverture du panneau, refus d’identifiants. Il n’annonce plus de prise en charge d’API uniquement à promesses après retrait de l’adaptateur expérimental.

`orion-auth-autonome.cjs` remplace le contrôle des délais retirés : refus sans session inventée, stockage du compte authentifié sans mot de passe et sans ouvrir VRM. `audit-liaison-visite.cjs` vérifie la visite déclenchée après session et la pause Vinted ; les autres audits et contrôles de paquet sont conservés. Pas de promesse nouvelle de délai borné sur la connexion héritée.

Les changements de navigation ont été contrôlés sur navigateur de test avec API simulées. L’installation de **la référence 5.319**, pas celle de 5.322 ni sa synchronisation réelle, est confirmée par Julien. La capture requiert la plateforme ouverte dans Orion au premier plan ; les web apps autonomes de l’écran d’accueil restent distinctes.
