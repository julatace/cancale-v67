# 5 nov. (soir) — Achats et colis à retirer : 33 → 10, un point = une carte

Julien, mot pour mot : « rien ne va c'est horrible dans achat je veux que ça soit mieux, j'ai pas
toutes les données du compte connecté avec orion qui s'affiche, ça me met que j'ai 33 colis à
retirer j'en ai à peine 10 et ça me met 2 points de retrait alors que c'est le même corrige toutes
ces erreurs ».

Branche locale `v34-achats-retraits` (depuis `claude/project-review-nsk5su`), non poussée.

## Mesuré sur sa base (lecture seule)
- La publication `main.vrm_colis_retirer` de 17 h 45 disait **33** : 9 Mondial Relay, 5 e-mails
  Vinted « Commande mise à jour » rangés par le serveur, 18 relus depuis `email_inconnu_*`, 2 achats
  « déposé » sans e-mail. 58 « à vérifier ».
- Le transporteur (`transp_*`) disait **retiré** pour presque tous les colis des 3 et 4 nov. ; seuls
  7 Mondial Relay du 5 nov. et 1 consigne restaient disponibles.
- Les e-mails Vinted (« ton achat t'attend », « livré dans le Point Relais », « t'attend ici ») sont
  la MOITIÉ Vinted des mêmes colis. 16 arrivent sur une adresse qu'aucun compte relié ne porte ; leur
  conversation n'est dans aucun achat capté. Leurs moitiés Mondial Relay arrivent sur la même adresse.
- Causes du « 33 » :
  1. un e-mail Vinted relié à SA commande (conversation) ne regardait pas le n° de suivi de cette
     commande, que le transporteur disait « livré au destinataire » (2 colis) ;
  2. le code de retrait n'était pas une identité entre lignes : « Utilise le code X » et la consigne
     Vinted Go au même code, retirée, comptaient chacune (jusqu'à 13 lignes gardées) ;
  3. le doute « même point » ne comparait qu'aux colis du transporteur ENCORE à retirer : dès qu'ils
     étaient retirés, leurs moitiés Vinted redevenaient « à retirer » ;
  4. une moitié Vinted reliée à une commande « déposé » SANS n° de suivi comptait en plus de la ligne
     Mondial Relay du même colis (3 colis comptés deux fois).
- Causes des « 2 points » : un même point était dessiné dans « Prêts à
  retirer » ET dans « Code à venir ». Les écritures du lieu (majuscules, apostrophe, nom répété,
  « Consigne Vinted Go, Nom, rue ») étaient déjà regroupées.
- « à vérifier » : la carte disait 31, la liste en montrait 3 (les lignes sans n° de suivi avaient
  une clé vide et s'écrasaient l'une l'autre).
- `needs_action` sur un ACHAT : 12 des 21 achats ouverts le portent avec « Commande livrée ! » (déjà
  retiré, reste « Tout est OK ») ou « non réclamée - retournée ». Seul l'écran équipe le prenait pour
  « à retirer ».
- Achats (Orion) : la ligne du compte relu par Orion porte 1 985 achats (forme normale,
  `my_orders`) ; l'app les lit tous (une ligne par compte, pas de plafond de 1 000) et en montre 60
  avec « Voir plus — 60 affichés sur N ». 1 759 achats anciens n'ont pas de photo chez Vinted. Les
  achats des 3 et 4 nov. disaient « À retirer » parce que l'écran reliait un e-mail à un achat par
  le TITRE (« Commande mise à jour pour <titre> »).

## Rendu sur ses données (fixtures locales hors dépôt, horloge 5 nov. 21 h 30)
Copie réduite à la forme exacte (projections, `meta->>`) : 9 comptes, 96 achats réels depuis le
1er oct., les plus anciens remplacés par des copies de même nombre et mêmes statuts, 95 lignes de
suivi, 28 e-mails gardés, 27 suivis Vinted, 61 statuts transporteur, 22 codes lus.
- **Avant** (build de la base) : **22** à retirer, le point principal deux fois, carte
  « 31 à vérifier », liste « 3 ».
- **Après** : **10** à retirer — 7 Mondial Relay disponibles au même point, 1 locker,
  2 achats que Vinted dit « déposé » dans une autre ville ; **4 points**, chacun une fois ; « à vérifier » 7
  (carte = liste) ; « Peut-être en double » 24, montrés, jamais comptés.
- Achats : une carte (Dépensé · En route 28 · À retirer 10 · Arrivés), la barre « En route ·
  Arrivés · Tous » et « … » ; les achats « Commande livrée ! » et ceux que le transporteur dit
  retirés disent « Arrivé ».

## Ce qui a changé
- `src/retraitPreuves.js` (nouveau) : `indexCodesSuivis`, `suivisLiesDuColis`, `finParIdentite`,
  `fusionnerParCode`. `pickupUnion` les appelle avant le statut de la commande.
- `api/_lib/achat-arrive-relais.js` : `regrouperArrivees({ temoins, sansIdentite })`,
  `cleLieuDoute`, `aUnTemoin` (même lieu, même adresse de réception si les deux la donnent, ±3 j,
  jamais un témoin relié à une AUTRE commande). Sans `temoins`, la règle d'avant.
- `pickupUnion` rend `enDouble` (à part) et `txFinis` ; l'écran Achats lit `txFinis`.
- `etapeAchat` : « Arrivé » (plus « Reçu », réservé à l'argent), « En route » ; « Commande livrée »
  et une fin prouvée passent avant « À retirer ». `trackForBuy` relie par conversation ou n° de
  suivi (`colisParTx`), plus par titre.
- `CarteRelais.jsx` : un point va dans la section de son colis le plus pressé, avec tous ses colis ;
  section repliée « Peut-être en double ».
- Achats : la grille sous la carte sombre est retirée (elle reste hors de l'espace Vinted) ;
  Fournisseurs · Délai · Lots derrière « … » (`AchatsOutils.jsx` inchangé) ; le compte sans
  pastille de couleur ; le bandeau de l'extension (pourquoi des codes manquent) en tête d'écran.
- Équipe : `needs_action` n'est plus « à retirer ».

## Preuves
- `node scripts/audit-retrait-preuves.cjs --prouve` : 26 contrôles, **9 rouges sur la base**,
  **8/8 mutations** rouges.
- Banc `scripts/bancs/achats-retraits.cjs` (données inventées, 390 tactile et 1512, clair et sombre,
  `BANC_PORT` 8812) : **72 verts** ; sur le build de la base **12 rouges** (8 au lieu de 3,
  deux cartes pour un point, grille, outils, « À retirer » sur un achat livré…).
- `npm run build` vert. Audits voisins identiques à la base ou verts : codes-retrait, colis-trois,
  villes-colis (1 rouge, déjà sur la base), suivi-colis, retrait-qr, qr-capture-mr, identite,
  coherence, fonctions-api, retrait-fiable, achat-attend-relais, retrait-conv, colis-retrait,
  achats-sourcing, statut-transporteurs (3 rouges, déjà sur la base). Bancs colis-villes, colis-qr,
  achats-en-route-ordre verts.
- Adaptés pour juger la règle : `audit-retrait` (le bandeau est dans l'écran Achats, avant la liste
  — il cherchait dans les 1 800 premiers caractères, il était rouge sur la base), `audit-identite`
  (exécute le nouveau `trackForBuy`), `audit-statuts` (`achatStage` lit `pickupUnion.txFinis`),
  bancs `colis-retirer-propre` (un point = une carte) et `achats-sourcing` (outils derrière « … »).
- Captures regardées : Colis → À retirer et Achats, 390 et 1512, clair et sombre, banc et ses données.

## Ce qui reste
- 16 e-mails Vinted arrivent sur une adresse qu'aucun compte relié ne porte : un compte Vinted pas
  relié à VRM ? Geste : relier ce compte, ou dire à qui il est.
- 3 achats « déposé » de son compte relu par Orion n'ont pas de n° de suivi relevé : ils sont en
  « Peut-être en double » face aux Mondial Relay du même point. Geste : ouvrir ces commandes sur
  Vinted (l'extension relève alors leur suivi).
- Les e-mails gardés avant le 3 nov. ont un lien de conversation coupé (2 000 caractères) : sans
  code, ils ne se relient à rien et finissent « à vérifier » ou « en double ».
- `audit-villes-colis` (1) et `audit-statut-transporteurs` (3) étaient déjà rouges sur la base.
