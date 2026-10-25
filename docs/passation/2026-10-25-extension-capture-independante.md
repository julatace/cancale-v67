# VRM Capture 1.0.0 — extension dédiée

Après l’absence du bouton intégré5.226, le vendeur a demandé une autre extension dont le seul objectif est de capturer son parcours. L’environnement est revenu après plusieurs échecs d’accès ; les fichiers ont été créés maintenant, pas pendant la panne.

Source indépendante : `vrm-capture-extension/`. Aucun code de synchronisation, authentification VRM, favoris automatiques ou endpoint serveur. Les trois boutons de commande et l’effacement sont directement visibles dans la fenêtre de l’icône « VRM Capture — diagnostic local ». L’extension peut coexister avec VRM ; stockage et indicateur de page distincts.

Le recorder reprend le protocole passif filtré et testé de5.226, sans dépendance à son moteur. Un onglet actif Vinted, démarrage confirmé, nonce privé, événements sérialisés. Arrêt manuel/route conversation/3min/100étapes/fermeture de l’onglet. Rapport local, effacement et expiration à consultation après30min. Aucun corps de requête/réponse, mot de passe, cookie, jeton, texte saisi ou contenu de conversation ; pas de valeurs de lien ni d’URL brute exportées. Les clics de confiance et catégories de requêtes sont observés, sans déclencher de navigation ou message.

`scripts/zip-capture-independante.cjs` produit `public/VRM-Capture.zip` (ChromeMV3), `VRM-Capture-Orion.xpi` et `VRM-Capture-Orion.zip` (MV2 identiques, adaptateur Orion) et le guide. Manifeste à la racine. PermissionsChrome : storage/activeTab uniquement, pas de scripting/cookies/webRequest/serveur. Les paquets Orion ajoutent les quatre domaines de contenu et le shim déjà testé. Pas de nouvelle version de l’extension VRM principale.

Validation : les tests existants du parcours acceptent désormais des chemins de source explicites et exécutent le vrai worker, collecteur et popup indépendants. 19 contrôles worker, 9 navigateur du collecteur, 21 panneau320/390/1512, 27 des archives (sources identiques, formats, pas de code réseau, bouton visible, pas de login). Aucun test sur session client réelle ni installation Orion/iOS physique.

Parcours vendeur : installer cette extension, recharger Vinted, ouvrir l’icôneVRMCapture, Enregistrer, fermerpopup, cloche/favori/conversation manuellement, rouvrirpopup, lire/copier. Ne pas chercher le bouton dans VRM ou la carte de l’ancienne extension.
