# 15 nov. 2026 — Ma journée, Annonces, « La paire à sortir en premier », le rail de l'ordinateur

Branche `claude/refonte-journee` (partie de `claude/project-review-nsk5su` : la couche « Verre dépoli » et le Stock en
étagères). Aucune PR. Julien a validé les maquettes (« tout est parfait ») : téléphone `maquettes-verre/vues/{journee,
annonces,sortir-*}.png`, ordinateur `maquettes-verre/ordi/vues/{journee,annonces}-{1512,1280}.png` ; sources
`kit.cjs`, `ecrans.cjs`, `e-reste.cjs`, `e-sortir.cjs`, `o-ecrans.cjs` (valeurs reprises telles quelles).

## 0. Réparé en arrivant
La fusion des étagères avait laissé DEUX `export default` dans `src/i18n/langues/{fr,en,es,it,de}.js` : le build
échouait. Réparé (premier commit).

## 1. Ma journée (téléphone) — `src/design/verre-journee.css`, `src/JourneeStudio.jsx`, `src/App.jsx`
- Tête : la date 12,5/600, « Ma journée » 26/750. Le chiffre du jour 60/700 blanc, « vendu aujourd'hui · 1 vente »
  (`journee.venduAuj` / `venduHier` / `venduLe`), la semaine en barres de 8 px (40 px pour la plus haute), le jour choisi
  blanc plein.
- Le mois en UN verre (`.trio`) : trois colonnes (.9/1/1,4), filets, libellé au-dessus, montant 19/750, « prix
  d'achat manquants » à l'ambre ; « Modifier » devient un crayon de 44 px dans le coin.
- « À envoyer · N » : la pile à plat (50 px, bord blanc), les plaques N° des premiers colis (PAR IDENTITÉ : le
  bordereau de SA transaction, la fiche de SON annonce), « Le premier avant le 17 nov. » (date à l'ambre),
  « Ventes › » (un vrai bouton, `t.lien` de `BentoJournee`), « Imprimer les N bordereaux » en barre.
- « À retirer » (codes 19/750 l'un sous l'autre, le point dessous) et « Messages » (les deux dernières non lues, une
  offre à l'ambre) côte à côte ; Prix à baisser / Offres / Sans prix d'achat en pastilles de 52 px.
- Mêmes tuiles, mêmes compteurs (`data-tuile`, `data-n`), même dépliage ; la liste des colis du jour est UNE (`colisJournee`).

### Écarts gardés exprès (et pourquoi)
- Les barres de la semaine restent une rangée pleine largeur SOUS le chiffre au téléphone : chaque jour est une touche
  (il se choisit) et doit faire 44 px — 7 × 44 ne tient pas à droite d'un chiffre de 60 px. À l'ordinateur elles sont à
  droite, comme la maquette.
- « Bonsoir · » reste devant la date ; « Semaine du … » et « Ma semaine › » restent, en petit (des écrans).
- Le trio montre les chiffres que la carte réglable montre (Vendu · Reçu · Bénéfice par défaut) — pas « Semaine » :
  « Reçu » est une notion §5 ; « Modifier » change les chiffres.

## 2. « La paire à sortir en premier » (NOUVEAU) — `src/paireASortir.js` (règle pure), `src/PaireASortir.jsx`
- Seulement pour qui range dans le Stock (au moins un meuble) ; sinon chaque vente dirait « VRM ne sait pas où ».
- L'emplacement vient du Stock PAR IDENTITÉ du N° (`vrm_slots[cleNum]`), jamais le titre ; « pas su » se dit avec sa
  raison (sans N°, pas rangé, meuble disparu, case hors du meuble, N° en double) et propose « Ranger d'abord » (le
  geste existant `onStore` : le Stock s'ouvre sur CE N°).
- L'ordre : la plus pressée d'abord ; à date égale, le même meuble à la suite (celui de la dernière paire sortie
  d'abord — on y est), puis l'ordre de la pièce, rangée, case ; l'inconnue après celles de sa date.
- Mini-plan du meuble (fenêtre de 6 × 6 autour de la case dans un grand meuble, numéros RÉELS), la case allumée avec la
  photo. Une pile se dit « 2ᵉ boîte du bas ».
- « Je l'ai sortie » = le geste du Stock : la déclaration `vinted_pairs_lost` (`cleDeclarationPartie`, `from:'stock'`)
  + la case libérée et la pile tassée (`sortieCaseStock` → `opsSortieCases`) en UN geste annulable 5 s, accompagné
  (`stock.sortir`, `src/accompagnement.js`). Les N° ne changent jamais, seule la place.
- Après : « N°164 est sortie · Pile C · sa case est libre », et pour une pile Avant / Maintenant + « N°165 et N°166
  sont descendus d'un cran. Leur N° ne change pas » — dit une fois (« Compris ») ; la dernière : « Les 3 paires sont
  sorties · Imprimer les 3 bordereaux ».
- Un plein par écran : quand la section est là, « Imprimer » d'« À envoyer » devient une touche.
- Mots selon le profil (`motsVendeur` : « sortie »/« sorti », « paires »/« articles »).

## 3. Annonces (téléphone) — `src/design/verre-annonces.css`
- Rangée de 72 px : photo 52 (rayon 13), titre 14,5/650, dessous la VRAIE plaque N° (`.vrm-fiche-numero`), les sites
  où CETTE paire est (`aussiSur`, par identité) et le compte ; à droite le prix 15,5/750 et « T42 · 12 j » — « 40 j · à
  baisser » à l'ambre quand le conseil mesuré (`conseilsPrix`) le dit. La ligne d'état d'hier reste dans la page (lecteurs
  d'écran, data-*).
- La liste en UN verre posé (rayon 22) ; la recherche en verre presque opaque ; les vues en pastilles 44 px (la nuit, le
  choix est un verre clair : un seul plein) ; Annonces | Stock | Achats SOUS le titre (le sélecteur rendu dans la tête
  de la tâche, la coque ne le pose plus au-dessus pour cet écran).
- « N° à vérifier » rejoint « À faire » (la liste d'abord : 1re rangée à 417 px sur 844).
- Écart : le surtitre « 82 paires en ligne · 6 comptes » n'est pas posé (la bande de chiffres dit déjà « en ligne » :
  un nombre une fois) ; « Sites, comptes ▾ » reste la rangée des sites + le menu du compte (fonctions existantes).

## 4. L'ordinateur (maquettes `ordi/`, 1512 et 1280)
- LE RAIL COMMUN (`SideBar`, `data-rail-verre` ; classes `src/design/studio-verre.css` §11) : verre 232 px, « VRM »,
  Ma journée · VENDRE (Ventes, Annonces, Messages, E-mails) · RANGER (Stock, Achats) · COMPTER (Argent) ; au pied
  Paramètres (la maquette le remet en entrée ; le menu du profil le garde), le compte, Communauté. Sous 1400 px : 78 px,
  icône et libellé dessous, nombres en coin. Mêmes entrées, mêmes `data-nav-entree` ; une entrée non classée suit dans
  « Compter ». À FUSIONNER par `claude/refonte-ventes` et `claude/ecrans-verre-2`.
- Ma journée en trois colonnes (`BentoJournee colonnes`) : le chiffre du jour + « À sortir en premier » (photo à gauche,
  mini-plan, Ensuite dans l'ordre) + le mois · « À envoyer » en rangées (photo, plaque, site, compte, date et place dans
  le Stock par identité, prix), pastilles, « Retours et litiges » · À retirer, Messages, À faire.
- Annonces en tableau : en-tête Article · Taille · Sites · Comptes · Prix · En ligne · Place ; la place lue une fois par
  passage (`placesAnnonces`) ; sous 1400 px la colonne Place se tait.
- Écarts : le titre et ses chiffres ne montent pas dans la barre de recherche (la recherche globale reste à gauche de la
  barre du haut) ; « En route · 3 » n'est pas dans Ma journée (il vit dans Ventes) ; la fiche d'Annonces s'ouvre à droite
  au toucher d'une rangée (pas ouverte d'avance).

## 5. Ma journée ne montre que ce qui demande un geste (Julien, captures du soir)
« on n'a pas forcément d'infos sur ces cases, elles apparaissent un peu au hasard » ; « tu peux mettre litige achat,
vente ensemble ici » ; « tu peux enlever ».
- UN bloc « Retours et litiges » (`RetoursLitigesJournee`) : retours d'achat (tu renvoies : à déposer / en route / reçu
  par le vendeur), retours de vente (on te renvoie, revenu chez toi), litiges et transactions suspendues — une ligne par
  article, photo, N°, sens, étape et date, UN geste (Imprimer le bordereau, Voir). Les mêmes règles qu'Achats, Colis et
  les litiges. Plus de « À renvoyer » seul en tête ni de carte retour/litige dans « À faire ».
- Un retour d'achat SANS NOUVELLES (date limite passée depuis plus de 7 jours, ni bordereau, ni « Déposé », ni fait du
  transporteur, ni remboursement — le cas réel « Salomon xt6 · date limite passée mer. 14 oct. · bordereau pas arrivé »)
  quitte Ma journée : Achats → « À vérifier » (« Ce retour n'a plus de nouvelles depuis le … : vérifie sur Vinted »),
  « C'est réglé » (SON clic) l'archive — `vrm_retours_regles`, synchronisé (SYNC_KEYS, CLES_GESTES).
  `src/retoursAchat.js` : `retourPerime`, `classerRetoursAchat`.
- Sortis de la liste (rien supprimé) : « À trancher », les comptes dont les e-mails n'arrivent pas, la santé des
  comptes, les e-mails à trier, l'import du passé ⇒ la feuille « Tout va bien ? » (une ligne discrète « Tout va bien ? ·
  N points », `data-tvb-ligne`, puis « Tout voir dans Paramètres ») ; le contrôle de cette nuit (`VeilleJournee`) ⇒
  Paramètres → « Tout va bien ? ».
- Restent : « nouveaux favoris » (son geste : l'envoi préparé), « N achats à ranger », « Colis à vérifier » (avec sa
  raison).

## 6. Preuves
- `scripts/bancs/paire-a-sortir.cjs` (NOUVEAU) : la RÈGLE exécutée (R1 identité — deux ventes au même titre, une annonce
  en ligne au même titre rangée ailleurs ; R2 pas su ; R3 ordre ; R4 sortie prouvée ; R5 rester dans le meuble) et 6
  MUTATIONS (rapprochement par titre, sans date, sans enchaînement, meuble oublié, doublon pris, déclaration d'une autre
  annonce) toutes ROUGES ; l'app rendue 390 / 1512 / 1280, clair et sombre : 64/64 verts (390 + 1512), 1512 et 1280
  clair verts ; ROUGE sur l'arbre de départ (A1 « pas sur Ma journée », A6).
- `scripts/bancs/journee-retours.cjs` (NOUVEAU) : R1–R3 + 3 mutations ROUGES ; A1 UN bloc réunit achat et vente, A2 rien
  ailleurs, A3 les cartes retirées absentes hors feuille, A4 la ligne et sa feuille ; 390 et 1512 verts.
- Bancs existants, rejoués sur l'arbre FUSIONNÉ (`claude/project-review-nsk5su` amené par un vrai merge) : `verre`
  (journee, annonces ; 390/1512, clair/sombre) 80/80 ; `studio-journee` tout vert (dont l'ordinateur en colonnes) ;
  `annonces-tete` vert ; `studio-coque` 78/78 ; `accompagnement` vert (30 moments, 2 non joués) ; `studio-paires` tout
  vert (forme 390/1512 clair/sombre + volume 1 000) ; `garde-ecrans` rien à signaler ; `annonces-grille` 92/92 ;
  `afaire-feuille` 644 + 56 + 155 verts (la machine, chargée par d'autres sessions, a fait tomber Chromium deux fois :
  les cas tombés ont été rejoués seuls, verts) ; `paire-a-sortir` et `journee-retours` tout verts.
- Trois défauts trouvés par ces bancs, corrigés : (1) « Même article que N°7 ? » posé sur la rangée passait PAR-DESSUS
  la rangée voisine (hauteur fixe de 72 px) ⇒ la rangée grandit d'une 3e ligne pleine largeur (`annonces-grille` G9) ;
  (2) l'entrée active du rail avait perdu son creux et sa diode (§7 « actif = enfoncé + diode ») ⇒ la pastille blanche
  de la maquette garde un creux à peine marqué et la diode 5 px (`studio-coque` N) ; (3) la paire montée répétait taille,
  âge et compte sous sa ligne d'état ⇒ les deux lignes de la rangée se taisent quand elle est montée.
- Bancs réécrits sur la RÈGLE (dit ici, §6) : `studio-paires` (au téléphone la plaque N° est SOUS le titre, à droite
  de la photo ; à l'ordinateur la plaque est dans la colonne N° ENTRE la photo et le titre — les deux maquettes validées ;
  « À faire » jugé sur la ligne du h1, le sélecteur étant dans la tête ; avant de toucher « ⋯ » de la carte montée on
  attend que la notification passagère de la coque parte — mesuré, `elementFromPoint` tombait sur `.vrm-toast`) ;
  `studio-journee` (« À trancher » : sa porte sur Ma journée est la ligne « Tout va bien ? ») ; `paire-a-sortir` attend
  l'ÉCRITURE des cases après « Je l'ai sortie » au lieu de 900 ms fixes (rouge sous charge, §6 règle 5).
- Disque plein en route (70 Mo libres) : 152 profils Playwright abandonnés (> 30 min, aucun Chrome vivant ne les
  utilisait) supprimés de /tmp.

## Geste de Julien
Aucun. Pour voir « La paire à sortir » : avoir au moins un meuble dans le Stock et une vente à envoyer rangée.
