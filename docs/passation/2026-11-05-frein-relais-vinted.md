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

## Suite (5 nov., soir) — la réserve du COMPTE, côté serveur

Le frein de l'app est compté par appareil (ordinateur + iPhone + iPad = trois
réserves). `/api/vinted-proxy` tient désormais la même règle (la même fonction
`prendrePlaceRelais`, 24 requêtes par 30 min) pour le COMPTE, tous appareils
confondus : `api/_lib/frein-relais-serveur.js`, une ligne `app_data`
`vrm_frein_relais_{uid}` du vendeur, écrite avec SA session (RLS), en
comparer-et-échanger sur `data.rev` (lecture projetée `rev:data->>rev,t:data->t`,
jamais `select=data`). Freiné ⇒ 429 `{erreur:'frein'}` (l'app le rend comme son
propre frein) ; réserve illisible ou pas écrite ⇒ 503, rien vers Vinted.
`session.js` gagne `insererCommeVendeur` (201 → 1, 409 → 0, sinon `null`).

Preuve : `scripts/audit-frein-relais-serveur.cjs` exécute la vraie route —
7 verts ; sur `origin/main` 5 rouges ; `--muter=sans-frein` 5 rouges,
`--muter=sans-garde` 1 rouge (cinq appuis simultanés sur la dernière place en
font partir 3).
