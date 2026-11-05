# 5 nov. — Un bouton « relire » ne fait plus interroger Vinted par le serveur

## La question de Julien
« Il n'y a aucun risque de ban à appuyer trop de fois sur la flèche ? »

## Ce qui a été mesuré (dans le code)
- `/api/vinted-proxy` interroge Vinted **depuis l'adresse du serveur** de VRM, avec les jetons
  rangés en base, et les renouvelle là-bas sur un 401.
- `opts.force` (boutons « Relire les données des comptes » de Messages, « Réessayer » sous Ventes,
  Achats, Annonces, la flèche ↻ de Messages sans extension capable) **sautait la copie captée** et
  partait par ce relais pour **tous les comptes en parallèle** : ventes jusqu'à 12 pages, dressing
  jusqu'à 10 pages + `users/current`, boîte de réception. Chaque appui recommençait.
  C'est le motif « plusieurs comptes pilotés depuis un même serveur » que §3 accuse.
- Journaux Vercel : le plan Hobby ne garde qu'une heure, rien dans la fenêtre — on ne sait pas
  combien de fois c'est arrivé.

## Ce qui change
1. `force` relit la **copie captée par l'extension** sans le cache de l'écran (ventes, dressing ;
   boîte de réception : l'extension si elle sait, sinon la copie, dite ancienne). Plus de relais.
2. Le relais restant (compte jamais capté, détail d'une conversation absente, lot) est **freiné par
   compte** : 24 requêtes / 30 min, compté sur l'appareil (`src/freinRelaisVinted.js`) ; au-delà
   rien ne part (`{ok:false, error:'frein'}`), l'écran garde ce qu'il montrait. Stockage illisible ⇒ refus.
3. La lecture par l'extension (compte connecté dans l'onglet seulement, une requête à la fois,
   pause 429/403) reste la seule voie vers du neuf.

## Preuves
`scripts/audit-frein-relais-vinted.cjs` exécute les vraies fonctions (`vintedApiCall`,
`fetchVintedOrders`, `fetchVintedConversations`) : 11/11 ; 6 rouges sur le code d'avant
(8 requêtes au relais par appui, 30 sur 30 martelés) ; `--muter` 7 rouges. Build, audit-coherence,
audit-fonctions-api, audit-fusion-nuage verts.

## Reste
- Le frein est côté app : deux appareils ont chacun le leur. Un frein serveur (par compte, en base)
  demanderait une écriture à chaque appel du relais — à décider si le relais doit survivre.
- Piste : supprimer tout repli vers le relais (un compte jamais capté attendrait l'extension).
