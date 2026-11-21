# Réception : lecture complète des preuves d’adresse

La pagination des preuves applique les mêmes exigences que celle du registre :
ordre stable, décalage réellement reçu, validation de Content-Range, identifiants
uniques et 416 accepté seulement si le total confirme exactement les lignes lues.
Une lecture partielle retourne null ; les routes existantes répondent alors 503
pour que le message soit conservé/représenté, au lieu d’attribuer depuis un état
incomplet. Aucun email n’est supprimé ou réattribué par cette modification.

La lecture partagée est bornée par un signal global de 20 secondes, combiné aux
10 secondes par requête, pour les preuves et le registre. Son verrou en mémoire
est toujours libéré en finally. Il ne s’agit pas d’un verrou distribué ni d’une
réserve de capacité, et le temps de la plateforme peut être plus court.

Preuves : huit tests exécutent le vrai lecteur avec une base simulée. Les cas
2000 vendeurs avec page réduite, doublons, plages incohérentes et 416 incomplet
échouaient avant correction. Le test de blocage raccourcit seulement les délais
avec une horloge de test, vérifie 30 appels simultanés et une nouvelle tentative.
Le scénario multi-comptes vérifie 6000 adresses pour 2000 vendeurs avec des pages
de 25 lignes. Aucun accès à une boîte email, compte réel ou base de production.
