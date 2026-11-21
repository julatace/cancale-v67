# Lectures partagées : mémoire bornée et écritures Request

Le partage des lectures de notre base conservait les entrées de requêtes pendues
jusqu’à une écriture ou un nouvel appel à la même URL. Des URL différentes toutes
bloquées pouvaient donc accumuler des entrées sans borne. Le délai de 8 secondes
empêchait de rejoindre une ancienne requête, mais ne libérait pas les autres clés.

Le cache est désormais limité à 256 entrées. À chaque lecture éligible, les entrées
expirées sont écartées, puis les plus anciennes si la limite est atteinte. Les
requêtes des appelants ne sont pas annulées : leur réponse reste attendue par leur
promesse, et une éviction n’envoie pas de nouvelle requête à elle seule. Les entrées
restantes continuent de partager les lectures identiques. Les statistiques internes
exposent seulement le nombre d’entrées retenues, sans URL, session ou contenu.

Un second défaut concernait l’objet natif `Request` : une écriture POST construite
ainsi passait directement à fetch et ne vidait pas le cache. Les écritures Request
vers notre base ou les routes de l’app invalident maintenant le partage à leur
départ et à leur retour, comme les écritures à URL chaîne. Le corps et le signal de
la requête ne sont ni lus ni recopiés. Les lectures Request restent non partagées.

## Validation

Six tests exécutent la vraie règle : 2000 requêtes distinctes pendues, libération des
anciennes clés, éviction sans perte de réponse, partage restant, écritures Request
base et serveur, lectures Request indépendantes. Les régressions échouaient avant
correction. L’audit existant couvre également la séparation des sessions, pages,
annulations et erreurs ; ses cinq mutations sont détectées. La mutation de vol
sans fin désactive maintenant les deux protections temporelles, car chacune
protège à elle seule contre la réutilisation d’une requête trop ancienne.

La borne porte sur le nombre d’entrées, pas leur poids en octets. Ce n’est pas une
mesure de RAM sur iPhone ni une preuve de capacité serveur. Aucun changement de
plafond, de file ou d’espacement des actions marchandes ; aucune mise à jour de
l’extension nécessaire. Le démarrage est vérifié sur une base synthétique, sans
requête à une base réelle.
