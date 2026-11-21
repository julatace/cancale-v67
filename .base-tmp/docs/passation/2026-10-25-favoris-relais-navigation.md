# Favoris 5.223 — navigation sans scripting et contexte à usage unique

Demande : continuer les favoris, après l'installation du paquet Orion iPhone/iPad. Aucun outil de contrôle du navigateur client n'est disponible dans cette session. La validation du compte réel reste donc ouverte.

## Deux défauts reproduits sur le code précédent

1. Le parcours ouvrait la cloche via chrome.scripting.executeScript directement, alors que le paquet Orion MV2 n'en demande pas la permission. Sans cette API, aucun relais n'était utilisé et le parcours échouait avant l'inspection du favori. Le test worker échoue sur la 5.222 avant correction.
2. La première requête POST /api/v2/conversations du même onglet consommait le contexte de vérification, même si elle concernait un autre article. Un clic natif différent sur le même article pouvait aussi voir son contexte écrasé par la sélection en attente. Le test du rédacteur passif échoue sur la 5.222 avant correction.

Pour reproduire : extraire le background.js de e1545571cb4b5537addb21ebf46622bb0e4da7c6 vers /tmp/vrm-favoris-bg-5222.js puis lancer SOURCE_FAVORIS_BG=/tmp/vrm-favoris-bg-5222.js node scripts/tests/favoris-navigation-relais.cjs et scripts/tests/favoris-contexte-course.cjs. Ces échecs n'établissent pas que chaque panne passée du vendeur avait ces causes.

## Correction

- naviguerFavoriDansPage : quatre actions fermées (sonder, ouvrir, cloche_sonder, cloche_ouvrir). Chrome conserve l'injection MAIN. Une sonde en lecture seule peut choisir le relais si MAIN est explicitement non pris en charge ; une activation sans accusé n'est jamais rejouée par un autre canal.
- Relais adressé à un onglet via tabs.sendMessage, contenu isolé puis capteur MAIN. Pas d'eval, de fonction arbitraire, d'endpoint API ou de texte de message transmis. ID aléatoire, vérification d'origine, réponse bornée à un booléen ou un état connu. Pas de diffusion des clics via le stockage entre onglets. Sans canal d'onglet utilisable, refus explicite.
- Le capteur et le relais n'acceptent les commandes de navigation que dans le cadre principal. Les mêmes fonctions DOM sont utilisées dans les deux chemins ; un test vérifie leur égalité. Un même ID de commande ne reclique pas le favori (cache mémoire borné).
- Un seul écouteur runtime route le relais de lecture existant et la navigation. La compatibilité du relais de moisson reste vérifiée.
- Le contexte en attente est consommé uniquement si l'item_id natif correspond à l'article choisi. Un contexte provenant d'un autre clic natif n'est pas écrasé ; il reste archivé sous sa propre identité. Canonicalisation limitée à l'hôte www, l'ordre des paramètres et le fragment. Les contrôles owner/UID/TTL et le reçu d'archivage restent exigés.
- Le paquet Orion masque scripting dans sa propre couche de compatibilité MV2 pour éviter de présenter comme utilisable une API dont ce manifeste ne demande pas la permission. Les autres API absentes restent absentes.
- Une capture non confirmée distingue désormais réponse native inexploitable et échec de sauvegarde dans VRM. Aucun envoi pendant la vérification.

Version 5.223.0 sur le code, le manifeste, les transports LBC et les paquets Chrome/Orion. Seuil ouverture223, envoi217, liste218 et suivi216. Pas de changement du plafond par compte, des exclusions de conversations déjà commencées, des jetons serveur, de l'isolation des vendeurs ou des endpoints d'envoi.

## Vérifications

Fixtures uniquement, aucun message réel envoyé :

- Worker sans scripting, MAIN refusé en lecture, absence de canal, fausse origine, onglet ayant navigué, activation sans accusé ; pas de rejeu.
- Navigateur réel avec contexte MAIN et monde isolé distinct : cloche fermée, ouverture native du lien exact, trace de création, refus de commande d'envoi ou de cible hors Vinted ; même ID non réexécuté.
- Requêtes natives concurrentes : autre article, autre clic sur le même article, bonne réponse ultérieure, usage unique et URL canonique.
- Archive/CAS, protocole de l'extension, interfaces favoris et file, paquet Orion, injection, build et audits habituels.

Premier banc intégral : une liste de conversations était mesurée vide malgré l'absence d'erreur, puis disponible après navigation. Le banc avalait son attente initiale expirée ; il attend maintenant les cinq lignes prévues de façon bornée, sans avaler l'échec. Aucun changement de la logique produit de chargement des conversations. Le résultat de la passe finale doit être consigné au moment de publication.

Limites conservées : pas d'Orion/iOS réel ni de session Vinted authentifiée observée ici ; une API cookies indisponible ou une injection bloquée peut encore empêcher le parcours. Ne pas annoncer les favoris fonctionnels sur le compte du vendeur sur la seule base de ces tests.
