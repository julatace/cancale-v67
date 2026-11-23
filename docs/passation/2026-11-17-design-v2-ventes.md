# 17 nov. — Nouveau design, phase 2 : Ventes (lot design-v2-ventes, branche `claude/design-v2-ventes`)

Julien (17 nov. soir) : « J'aime pas la disposition de tout, tu peux tout revoir » ; puis « fais quelque chose d'original,
de parfait, de nickel ». Ventes est revu EN PROFONDEUR dans le système design-v2 (`claude/design-v2`), derrière le même
réglage (`vrm_design_v2`, Paramètres → Apparence → Nouveau design (essai)). Éteint : Ventes est exactement celui d'avant
(signature du DOM identique, banc).

## Ce qui change pour Julien (allumé)

De haut en bas, au téléphone :

1. **« Ventes » + « Imprimer 6 » + la cloche, sur UNE ligne.** Le plein est LE geste du jour : le même compte et le même
   geste que le plein d'hier sous la liste (`resumeLot` des cases, `imprimerLot`, sinon `ouvrirLot`). Au téléphone étroit
   il dit « Imprimer 6 » ; son nom entier (« Imprimer 6 bordereaux ») est son nom accessible et s'écrit en entier dès 430 px.
   Il est rendu par l'écran des colis (Comptabilite) dans une place posée par la tête de la tâche
   (`[data-v2-tete-plein="ventes"]`, portail). La loupe et le profil de la coque ne prennent plus de bande (comme Annonces).
2. **« Toutes les plateformes ⌄ »** : le menu plateforme · compte de design-v2 (inchangé).
3. **UN segmenté : À envoyer · En route · Toutes** (les mêmes onglets `onOngletColis`), sans nombre redit.
4. **Le chiffre d'affiche** (signature, `ChiffreAffiche`) : « 30 colis à envoyer » — le nombre PUBLIÉ (`vrm_colis_aposter`,
   « — » pas su, « au moins » partiel) ; à sa droite, sous le mot, **l'écart nommé** : « 6 prêts à imprimer · 15 sans
   bordereau · 3 imprimés, à déposer » (comptés sur les rangées).
5. **La recherche, le scanner DANS le champ** (« Scanner pour retrouver », `ouvrirRetrouver('ventes')`), et « ⋯ ».
   La recherche trouve par N° (« 124 », « n°124 », « B188 »), titre, taille, acheteur, transporteur — contient, sans
   accents ; jamais un rapprochement.
6. **Les groupes par échéance, chacun dit UNE fois avec son nombre** : Avant demain soir (ambre ; `avantDemainColis`,
   la règle de l'ambre d'hier) · Cette semaine (limite LUE ≤ 7 j) · Plus tard · Date estimée (limite estimée : jamais « en
   retard », §5) · Sans date limite · Imprimés, à déposer (`bordsPrinted`).
7. **Les rangées A** (la rangée d'Annonces, `LigneAnnonce`, sans fourche ; Julien : « il doit y avoir plusieurs infos ») :
   ligne 1 le titre (2 lignes au plus, la taille SORTIE du titre — `tailleEnFin`, plus de « taille / 40 » orphelin) + le prix ;
   ligne 2 l'étiquette N° · T40 · le logo de la plateforme quand plusieurs sont montrées ; ligne 3, petite et grise, chaque
   fait avec son icône et seulement s'il est LU : l'acheteur · « vendue il y a 2 j » · l'état du bordereau (prêt / pas encore
   reçu / imprimé) · l'échéance (`echeanceCourteColis`, ambre à 2 jours ou moins d'une limite LUE ; une limite ESTIMÉE dit
   « vers le 20 nov. », jamais « en retard »). Rien de redit : ni le compte, ni « Choisir la vente ».
   - **Glisser à gauche : Imprimer · Plus.** « Imprimer » touche LE bouton de la carte d'hier (montée, cachée : le même
     PDF tamponné, la même facture Pro) ; sans bordereau et N° en désaccord e-mail/vente : « Choisir la vente » · Plus.
   - **Toucher : la fiche de la paire** (les mêmes `data-fl-*` que la carte d'hier ; ses gestes y sont, `DansFiche`).
   - **Imprimée : le mouvement de la signature** (`RangeeFaite` : coche, elle glisse et se replie en 220 ms) puis elle
     rejoint « Imprimés, à déposer » ; le plein descend d'un cran (son nombre vient du lot, inchangé). Le chiffre d'affiche
     ne bouge pas : un colis imprimé n'est pas encore envoyé (règle `aExpedier` inchangée).
8. **« ⋯ » est une feuille** avec les gestes d'hier : Choisir les bordereaux · Format (papier) · Préparer mes colis · Je
   dépose · Tournée de dépôt · Emballer · Scanner un bordereau · Tous les outils des colis (la rangée d'hier).
9. **En route** : les mêmes envoyés (`listeEnvoyes`), en rangées A, groupés par état : Retours · Déposés, pas encore vus
   partir · Au relais de l'acheteur · En route · Livrés. Les cartes d'hier restent montées, cachées (« Pas encore posté »
   reste dans leur fiche).
10. **Toutes** : la tête reste ; la liste des ventes d'hier dessous (pas encore en rangées A — à faire). La bande des chiffres
    d'hier (« 1 911 € vendu · 33 · 30 ») n'est plus à l'écran : montée, cachée (Argent porte les chiffres de synthèse).

« Colis » (l'ancien écran) n'existe plus comme onglet (lot DJ3 : `?tab=colis` ouvre Ventes) : son squelette « prêts · en
attente · partis » est celui-ci — prêts / sans bordereau dans « À envoyer » (l'écart nommé, « sans bordereau » sur la
rangée), partis dans « En route ».

## Qualité et fluidité (Julien : « ça doit être beaucoup plus quali et fluide ») — mesuré par le banc (Q, W)

- Appui ≤ 100 ms (`:active` forcé : rangée 100 ms, plein 100 ms) ; au repos, aucun saut (CLS hors geste = 0) ;
  1 000 rangées : `content-visibility: auto` + taille réservée ; photos en fondu dans leur boîte 64 × 64 (signature §6) ;
  pendant la lecture, le SQUELETTE partagé (`SqueletteRangees`, forme des rangées A), jamais d'écran blanc ; lecture ratée :
  une phrase dessinée (« rien n'est perdu ») ; mouvement réduit : la rangée faite ne glisse pas, photos et squelette immobiles.
- Finition : textes en 13 · 15 · 17 + 34 (titre) et 56 (affiche) ; rayons 12 · 14 · 20 (ou rond) ; grille de 4 sur tout ce
  qui est à Ventes ; champ et « ⋯ » à 44, les trois segments à la même hauteur ; aucun reste de l'écran d'hier à l'écran.
- La palette rendue comparée à l'écran d'hier, même base : tailles, graisses, rayons, part des espacements hors de la grille
  — toutes en baisse (chiffres dans la PR) ; « Choisir la vente » n'est plus redit (×15 hier, ×0).
- 375 × 667, normal et « Très grand » (×1,36) : aucun mot coupé, aucun segment ni libellé rogné (les segments passent un mot
  à la ligne s'il le faut), la ligne du titre passe à la ligne (le plein sous « Ventes », entier), la 1re vente sur le premier
  écran. « Mis à jour à hh:mm » ne se pose plus sur le grand titre (au-dessus de la barre du bas).

## Toutes, la sélection et la facture (Julien, capture de « Toutes » à l'ordinateur)

- **Toutes les plateformes** : `VentesToutes` en rangées A (le logo de la plateforme sur chaque rangée, la taille en « T. »,
  état · date · transporteur en 3e ligne). **Vinted** : la liste d'hier (`LigneVenteVinted`) rend une rangée A
  (`LigneVenteV2`) ; la ligne d'hier reste MONTÉE, cachée — toucher la rangée ouvre SA fiche (récapitulatif, facture, bon de
  retour, gestes). Plus aucun bouton par rangée (« Envoyer la facture », « Bon de retour » : dans la fiche ; « Imprimer » /
  « Déposé » : au glisser), plus d'ambre « Prix d'achat ? » (« N prix d'achat à saisir · Compléter » le dit une fois, en tête).
  La bande des chiffres et « À venir » d'hier ne sont plus à l'écran de Ventes (montées, cachées ; Argent les porte).
- **Facture envoyée** : une icône verte (document + coche, 20 px) à côté du prix — le seul vert de l'app ; toucher, appui long
  ou survol : « Facture FA-2026-0006 envoyée le 16 nov. » (`FactureEnvoyeeIcone`, src/FacturePro.jsx, la règle de
  `FactureVente`). Pas encore envoyée : rien sur la rangée.
- **Sélection** : la case dans SA colonne de 44 px à gauche de la photo, seulement en sélection (« Sélectionner », ou appui
  long) ; la rangée choisie se teinte (jamais un cadre gris).
- **La barre de sélection, redessinée pour tout le nouveau design** (`BarreSerie`, src/composants/SelectionSerie.jsx, branche
  allumée ; éteint : celle d'hier) : une barre fine au-dessus de la barre du bas (ordinateur : en bas de la colonne de la
  liste) ; « 3 ventes · Tout · 60 · Annuler » à gauche ; à droite UN plein — la première action que la sélection permet, avec
  SON nombre (« Imprimer 3 bordereaux » : cochées ET imprimables = imprimées ; sinon « Marquer déposées (2) », sinon
  « Exporter · 3 ») — et « ⋯ » : chaque autre action avec son nombre, ou la raison (« Aucun bordereau prêt dans la sélection »).
  Plus de tuiles, plus de grands boutons grisés, plus de « 0 sur 1 ». Entrée et sortie en ressort (fondu en mouvement réduit) ;
  la liste garde la place de la barre.
- **À l'ordinateur**, la barre du haut collante (recherche, plateformes) est un verre plein ; au téléphone, la tête défilée de
  Ventes / Annonces est une barre de verre pleine largeur (jamais une demi-boîte sur la liste).

## La frise d'une vente : le transporteur tranche (LES DEUX DESIGNS — Julien : « ça met livré il y a deux jours mais à côté la barre de progression avance pas »)

- La frise (Déposé · En transit · Livré · Validé) ne lisait que Vinted ; la phrase dessous lisait le transporteur. Règle
  (src/friseTransporteur.js, décidée les 12–13 nov.) : une étape = Vinted OU la ligne du transporteur OU l'e-mail du MÊME n° de
  suivi (le bordereau de la vente, `bordsParTxn` — celui de la phrase) ; « Livré » dès « livré au relais de l'acheteur »,
  retiré ou livré ; « Validé » seulement de Vinted ; une preuve n'est jamais retirée (aucun recul sur une lecture plus vieille).
  Branchée dans `preuvesFriseDe` (Ventes, En route, Colis — les deux designs) et les colis « partis d'après le transporteur ».
- Nouveau design : la PISTE (4 segments courts, l'accent pour le fait, même boîte partout, « Étape 3 sur 4 : Livré ») et, à
  côté, l'étape en mots et son âge (« Livré au relais · il y a 2 j », `statutCourt` — la MÊME source que la phrase du
  transporteur), puis le n° de suivi ; une ligne au téléphone.
- Banc `scripts/bancs/frise-transporteur.cjs` (Vinted « en cours d'acheminement », le transporteur « livré au relais ») : vert
  ici dans les deux designs, rouge sur la base et par mutation (le transporteur ne compte plus pour « Livré »).

## Rangées calmes (la capture de Julien : « c'est moche »)

- 2e ligne « N° · T42 · logo · pseudo » (passe à la ligne, jamais coupée), 3e ligne l'état et la date ; prix à droite ; la
  facture envoyée (son icône de 24 px, sa cible de 44 invisible autour) ; aucun bouton dans la rangée — gestes au glisser et
  dans la fiche. Le banc vérifie, pseudos longs et tous les gestes présents, qu'aucune boîte de texte n'en chevauche une autre.
- Ventes · À envoyer / En route : la liste des ventes (et « Litiges ») reste montée, cachée — elle est la vue « Toutes ».

## Où est le code

- `src/designV2/VentesV2.jsx` — `AfficheVentes` (sur `ChiffreAffiche`), `RechercheVentes`, `ListeColis`, `ListeEnvoyer`,
  `ListeRoute`, `filtrerLignes`, `usePartants` (le mouvement « fait » à l'impression, sur `RangeeFaite`).
- `src/designV2/LigneAnnonce.jsx` — trois props de plus (`sous`, `gestes`, `double`) : la MÊME rangée A pour un colis.
- `src/composants/ChampRecherche.jsx` — `fin` (un geste de plus dans le champ ; absent ⇒ rien).
- `src/App.jsx` — `lignesEnvoyerV2` / `lignesRouteV2` (près de `listeEnvoyes` : aucune règle neuve), la tête allumée
  (`if (!achatsSec && designV2)`), la liste (`v2Liste`, cartes d'hier dans `CacheSiV2`), En route (`v2Route`), la place du
  plein sur la ligne du titre (`v2VentesColis`, `v2Tete`).
- `src/designV2/design-v2.css` §12 ; textes `src/i18n/langues/{fr,en,es,it,de}/v2ventes.js`. Quoi de neuf : `design-v2-ventes`.

## Preuves

Banc `scripts/bancs/design-v2-ventes.cjs` (base inventée de `design-passe.cjs`, 390 tactile clair et sombre, 1512) —
chiffres exacts dans le rapport de la PR. Il est ROUGE sur la base design-v2 (aucune liste neuve) et ROUGE par mutation
(`MUTER=plein|groupe|compte` : le plein hors de la ligne du titre, un groupe oublié, le compte redit).

## Ce qui reste

- « Toutes » en rangées A (la liste des ventes d'hier est dessous, inchangée).
- Ventes · Leboncoin / eBay / Vestiaire (les sections propres des sites) : l'écran d'hier dans la coque neuve.
- « Choisir la vente » pour une rangée AVEC bordereau dont le N° de l'e-mail diffère (le glisser n'a que deux gestes) :
  dit une fois sous la liste ; le geste reste dans la carte d'hier, pas encore dans la fiche.
- Le mouvement « fait » est joué à l'impression ; « Colis fait » (déposé) le jouera quand la rangée passera dans En route.

## 18 nov. · Une ligne grise de plus (« plusieurs infos »)
Rangées À envoyer et En route : sous « N° · T. 40 », une ligne grise « logo (si plusieurs plateformes) · acheteur · vendue il y a N j » (`qui` de `LigneAnnonce`). Chaque fait n'apparaît que s'il est LU (pseudo de la commande, date de vente de la commande ou de la vente Vestiaire) ; la ligne passe à la ligne entre deux faits, seul un pseudo trop long se coupe. La 3e ligne garde le bordereau, l'échéance, l'étape et le suivi. Banc : « I … En route, chaque rangée dit l'acheteur et « vendue il y a … » » (18/18 sur la base inventée, qui n'a pas de pseudo pour ces commandes).

## 18 nov. · Frise : plus de « Livré » à côté d'une piste à « En route » (les deux designs)
Mesuré sur la base inventée : 11 rangées En route disaient « « Livré » · il y a 5 j » avec une piste à 2 sur 4. Vinted parle à deux endroits : l'état de la commande (`o.status`, « en cours d'acheminement ») et le détail de transaction (`shipment.status_title` → `etatTxn(tx).ss`, « Livré »). La phrase lisait le détail, la piste seulement la commande. `preuvesFriseDe` lit maintenant les deux (une preuve positive, jamais une absence). Banc `frise-transporteur` : « aucune rangée ne dit Livré à côté d'une piste avant livré » — rouge sur la construction d'avant (4 rouges, 11 rangées par vue), vert après ; la vente témoin n'a plus de « livré » côté Vinted, pour que le transporteur seul tranche (la mutation `MUTER=1` reste rouge).
