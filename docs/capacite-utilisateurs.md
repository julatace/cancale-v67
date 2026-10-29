# Préparation à 2 000 utilisateurs — état au 29 octobre 2026

## Ce qui est vérifié automatiquement

Les tests utilisent des données inventées et des services simulés. Ils vérifient
la correction du code, pas le débit ou le dimensionnement de la production.

- `scripts/tests/capacite-securite.test.mjs` : registre de 2 000 vendeurs,
  conflit d’adresse au dernier vendeur, pages manquantes/répétées, et 2 000
  requêtes entrelacées conservant chacune leur propriétaire.
- `scripts/tests/preuves-email-pagination.test.mjs` : lecture complète des
  preuves malgré une limite effective de 100 lignes par page ; 2 000 vendeurs
  possédant trois adresses chacun (6 000 preuves), avec des pages de 25 lignes.
  Le dernier compte est reconnu. Totaux incohérents, pages répétées, échec de
  lecture et fin 416 non prouvée font refuser le registre entier.
- Les appels simultanés partagent la lecture en cours, sans cache durable
  d’attribution. Un blocage de cette lecture retourne une absence de résultat,
  puis une nouvelle tentative peut repartir. Délai de 10 s par requête et
  budget de 20 s pour l’ensemble preuves + registre ; au plus 500 pages et
  50 000 preuves pour la lecture des preuves. La plateforme d’hébergement peut
  imposer son propre délai, plus court.
- Les audits critiques exécutent également les parcours d’inscription,
  récupération de compte, isolation, réception email et actions Vinted avec
  des réponses simulées. La CI contrôle les politiques SQL sur une base jetable.

## Correction livrée

La lecture des preuves d’adresse supposait que toute réponse de moins de
500 lignes était la dernière page. Si PostgREST imposait une limite inférieure,
les vendeurs suivants pouvaient être considérés sans preuve. Elle suit désormais
`Content-Range`, avance du nombre réellement lu et refuse une fin non confirmée.
Une page manquante ne devient pas un registre utilisable partiellement.

## Ce que ces résultats ne mesurent pas

Il n’y a ici ni accès administrateur Supabase/Vercel, ni mesure actuelle des
ressources, ni essai sur 2 000 utilisateurs réels. Aucun test de charge n’est
lancé sur vrm.center. Le nombre d’inscrits diffère du nombre de vendeurs actifs
simultanément et du volume d’actions réalisées par chacun.

Les anciennes estimations de simultanéité basées sur une observation de CPU à
62 % pour un vendeur ne permettent pas de calculer un plafond fiable. Elles ne
constituent pas un dimensionnement et sont retirées de cette note. Les anciens
prix et quotas ne sont pas présentés comme actuels. Une réponse anonyme vide ne
suffit pas non plus, seule, à certifier l’isolation entre deux sessions.

## Validation opérationnelle restante

Sur un environnement de préproduction isolé avec la même configuration que la
production : rejouer les parcours usuels à plusieurs niveaux de concurrence,
mesurer les latences p50/p95, les erreurs, CPU/IO, connexions et trafic sortant,
puis augmenter progressivement. Utiliser uniquement des comptes et données de
test ; désactiver les envois et gestes marchands. La limite acceptable doit être
fixée avant le test, puis le dimensionnement choisi à partir des résultats.

Dans les tableaux de bord réels : relever le niveau de compute, les limites de
fonctions, le stockage, le trafic sortant, les coûts et les alertes existantes.
La réception email lit encore le registre global : son coût réel par email doit
être mesuré à cette échelle avant de conclure sur sa capacité. Un index relationnel
par adresse pourra remplacer ce balayage si la mesure le justifie, avec migration
et contrôle d’isolation dédiés.

Les essais sur appareils restent nécessaires pour Safari/iPhone, la délivrabilité
des emails et les comptes marchands. Les tests locaux ne les certifient pas.
