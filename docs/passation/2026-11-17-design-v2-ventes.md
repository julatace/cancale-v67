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
