# 22 nov. 2026 — « Style et clarté » : Aujourd'hui en tableau de bord, l'accent à l'encre, la feuille « Ton extension » (branche `claude/style-clarte`)

Julien (22 nov.) : « j'aime pas trop le style de l'app, tu peux faire mieux » ; « même sur ordi tu peux faire plus beau ; je t'ai dit
simple, pas bâclé » ; sur la liste des comptes de l'extension : « c'est moche et pas visuel, dis-toi que tout le monde doit pouvoir
comprendre » ; sur Aujourd'hui (ordinateur) : « ici tu peux faire mieux avec des graphiques ». Après trois tours de directions (A Net /
B Atelier / C Encre : « j'aime pas du tout » — des retouches de jetons ; puis trois maquettes radicales ; puis « un mélange de 2 et 1
avec des couleurs pas trop osées », deux couleurs du même dessin) : **« j'aime bien en noir »**.

## 1. Les décisions

- **L'accent est l'ENCRE NOIRE** : `--n-accent` #16181D (nuit #F4F4F5), `--n-teinte` = encre à 7 % ; fond #F4F4F2 (gris chaud très
  clair), contours #E5E4E0, filets #EEEDE9. Vert SEULEMENT pour un écart positif et « fait / en ligne », ambre pour un geste, rouge
  pour le doublon de N°, pas de violet, pas de bleu vif. `themeMineral.js` suit (le code d'avant lit `C.accent`) ; les 783 couleurs
  sapin écrites en dur (posées le 21 nov. par `sapin.cjs`) passent à l'encre (script hors dépôt `encre_partout.py`, 199 fichiers ;
  logos et i18n exclus). `audit-style-vintex` juge l'encre (S2, S2 bis) ; ses mutations rougissent toujours.
- **Aujourd'hui = un tableau de bord** (maquette validée : scratchpad `maq/planche-tel-N.jpg`, `maq/planche-ordi-N.jpg`) :
  1. la **carte héros** à l'encre (`Heros`) : le bénéfice brut du MOIS en grand (`stats.mois.brut`, la règle et la couverture de
     Comptabilité ; inconnu ⇒ « — » et la porte « Saisir les prix d'achat »), le graphique de la fenêtre 7 / 30 jours (`GrapheJours` :
     barres = vendu du jour, ligne verte = bénéfice brut du jour, pointillés = moyenne ; toucher ou ← → choisit un jour), le trio
     Vendu · Ventes · Bénéfice de la fenêtre (chaque total DEMANDÉ au propriétaire `valeurSel` sur { de, a } — jamais une somme des
     barres) et l'écart nommé avec la fenêtre d'avant ;
  2. les **actions rondes** (`ActionsRondes`) : Imprimer (LE plein, avec son nombre — il n'est plus répété dans l'en-tête de Colis),
     Scanner, Annonces, Messages, Stats ;
  3. **Colis**, puis **Par site** (`Repartition` : la part de chaque site, chaque total demandé avec { site }) ;
  4. **Tes chiffres** (Jour · Mois) avec une étincelle des 7 jours sous CA, ventes, bénéfice brut ; une tuile ne montre JAMAIS un lien
     comme valeur (« Ouvrir Ventes » écrit en grand se lisait comme un chiffre) : « — » et la porte en petit ;
  5. Dernières ventes, « Toutes les statistiques ».
  À l'ordinateur : grille de 3 colonnes dès 1280 (2 de 1024 à 1279, `n-colonnes-tb`, `Colonne large`) : héros sur deux colonnes,
  actions + Colis + Par site à droite ; plus de demi-cartes ni de zone vide. Le cadre de 16 px qui doublait les marges d'Aujourd'hui
  au téléphone (cartes à 32 px du bord) est retiré (`Comptabilite.jsx`, `designV2 ? '8px 0 40px'`).
- **« En direct »** : quand rien ne tourne (pas d'extension ici, une ancienne, pas de réponse) : UNE ligne courte sans en-tête,
  qui ouvre LA feuille d'état de l'extension (plus deux messages « extension » sur le même écran).
- **La feuille « Ton extension »** (EtatActions de `src/App.jsx`, `src/EtatComptes.jsx`, `src/etatComptes.css`) : compacte (440 px
  accrochée à la pastille, 520 au plus en feuille — jamais toute la largeur d'un écran de 2 000 px) ; LE geste juste sous la phrase
  d'état ; les comptes en **liste groupée** : « À relire » (ambre, la rangée ouvre le bon site : vinted.fr, « Mes annonces » de
  leboncoin.fr, Vestiaire ; eBay ⇒ Paramètres), « À jour », « Bannis et masqués » (replié) ; une rangée = logo, pseudo, étiquette
  SEULEMENT s'il y a quelque chose à faire ou à savoir (À relire · Jamais lu · Délié · Ventes à relire · Banni · Masqué), l'âge à droite
  en chiffres alignés ; mots simples (« Vinted a banni ce compte », « Ouvrir vinted.fr sur ce compte », « Dernière nouvelle de
  l'extension : … ») — `tr()`, 5 langues (`src/i18n/langues/*/styleClarte.js`). Mêmes lignes (`lignesFraicheur`), mêmes `data-fraicheur-*`.
- L'avatar sans initiale sûre : une silhouette fine au lieu d'un rond gris vide.
- Bénéfice du mois pas su (prix d'achat manquants) : le héros dit le VENDU du mois (titre « Vendu · novembre ») et porte
  « Saisir les prix d'achat » — jamais un grand « — » en vedette.
- Aujourd'hui à l'ordinateur a son titre et la date (la coque n'en posait pas sur cet écran).
- Toast : l'action est une touche (plus un lien souligné). « Rien à retirer » : une rangée, plus un cadre vide de 200 px.
- Achats à l'ordinateur : « À régler » au-dessus des deux colonnes (le haut droit n'est plus vide).
- Fiche de vente : la note de N° en litige dit d'abord le N° retenu, puis le geste (« vérifie le carton »).

## 2. Preuves

(voir §4 — complété à chaque tour)

## 3. Ce qui reste (ordre proposé)

Ventes / Annonces / Achats : rangées plus denses au téléphone (la vente porte encore « Relier » + « Prix d'achat » sur sa rangée) ;
Achats à l'ordinateur (en-tête vide à droite, cartes à demi-largeur) ; puis Argent, Stock, Messages, Réglages, feuilles.

## 4. Journal des vérifications

- **Directions et maquettes** (scratchpad de la session, hors dépôt) : `dir/cmp-*-390.png` (A/B/C refusées : « j'aime pas du tout ») ;
  `maq/d1-pro.html`, `maq/d-mix.html` (+ `mix.css`, `mix.js`, `commun.js` : données INVENTÉES) ; planches retenues
  `maq/planche-tel-N.jpg`, `maq/planche-ordi-N.jpg` (variante « noir »).
- **Banc `scripts/bancs/style-clarte.cjs`** (C1–C8) sur l'arbre d'AVANT (`dist` de origin/main, 22 nov. 18 h) : **17 rouges** — pas de
  héros (C1), cartes à 32 px du bord (C3), accent sapin rgb(15,107,76) (C4), pas de disques (C7), feuille de l'extension de
  **1 488 px de large à 1 512** (C6, la capture de Julien reproduite), sans groupes.
- `audit-style-vintex` (accent à l'encre, mutations comprises) ✅ ; `audit-traduction` 45 verts ✅ ; `audit-quoi-de-neuf` ✅ ;
  `audit-icones` ✅ ; `audit-coherence` ✅.
- **Après** (build de 19 h 53, base de volume) : `style-clarte` **29 verts, 0 rouge** (390 clair + sombre, 1512) ; `garde-ecrans`
  « rien à signaler » ; `audit-boutons-natifs` : 1 rouge DÉJÀ sur main (`AchatsTableau.jsx:30`, `<button>` brut, pas de ce lot).
  Captures regardées : scratchpad `banc-apres3/` (journée 390 clair/sombre, 1512 ; feuille de l'extension).

## 5. Tranche 1 finie sur les MAQUETTES de Julien (22 nov. soir)

Julien a renvoyé SES maquettes de référence (« il avait commencé ça ») : c'est la cible. Description fidèle (ordinateur 1512,
données inventées) dans la mission ; ce qui est fait, avec les données RÉELLES seulement (« — » ou rien quand ce n'est pas su) :

- **En-tête d'Aujourd'hui (ordinateur)** : titre en gras, date « Dimanche 22 novembre » ; à droite « ● Mis à jour il y a N min »
  (l'heure de la dernière lecture RÉUSSIE de la veille temps réel : `creerVeille({ surLue })` → `noterLue` / `ecouterLue`,
  src/tempsReel.js ; pas encore de réponse ⇒ rien d'écrit), relire (`vrm:relire-coque` + un sondage de la veille), la loupe
  (`vrm:recherche-ouvrir` ⇒ LA recherche de la coque ; ⌘K et « / » inchangés) et la cloche ronde avec son nombre (publié par la
  cloche de la coque, src/notifsCompte.js — une seule source). Composant : src/aujourdhui/TeteDroite.jsx. La barre du haut (champ
  de recherche) ne se pose plus sur cet écran à l'ordinateur ; la pastille flottante « Mis à jour à » s'y tait (jamais deux fois).
  « 3 comptes » de la maquette n'est PAS dans la date (pas de source simple sur cet écran) : il est en pied de la barre latérale.
- **Héros** : dégradé encre ; courbe blanche en AIRE dégradée (`GrapheJours forme="aire"`, un point par jour `data-n-jour`, un
  jour pas su coupe la courbe) ; segmenté **7 j · 30 j · Mois** (Mois = du 1er à maintenant, comparé au mois d'avant coupé au même
  jour et à la même heure : « ▲ +3 % vs octobre au même jour · 45 ventes ») ; pied **Vendu (la fenêtre) · Reçu (ce mois, date de
  versement — `valeurSel('recu')`) · À venir (la règle d'Argent)**. « À venir » n'est plus répété dans « Dernières ventes » quand le
  héros le porte (§7). Le 31 du mois, la fenêtre « Mois » montre 30 jours (la série en a 30) ; le total, lui, est demandé au
  propriétaire sur tout le mois.
- **Colis** : deux cases côte à côte (`CasesChiffres`, src/natif/Heros.jsx) : « À envoyer 6 · 24 pas encore prêts » (ambre si
  une date limite lue presse) | « À retirer 3 · le point relais » (bleu-vert) — mêmes `data-v2-cj-ligne`, même toucher.
- **Dernières ventes** : le logo du site à côté du N°. Le bénéfice par vente de la maquette n'est pas montré (pas de source par
  vente sur cet écran : rien d'inventé).
- **Barre latérale** : Notifications rangée dans Gestion (à l'ordinateur ; au téléphone, toujours dans Aide) ; en pied, sous le
  nom : « 3 comptes Vinted · Pro » (nombre LU de comptes Vinted, offre lue `plan`), sinon « Paramètres ». Le groupe Aide reste
  (Extension, Mes comptes, État des actions, Communauté : aucune fonction retirée).
- **Feuille « Ton extension »** : « Une mise à jour est prête » + bouton noir pleine largeur « Mettre à jour (5.418 → 5.436) »
  quand une version plus neuve existe (`extSait('_maj') === 'retard'`) ou que celle d'ici est trop ancienne (le geste n'est
  alors pas répété dessous). Il mène où menait l'ancien bouton (Paramètres). Pas de capture : le banc n'installe pas d'extension
  ancienne — lu dans le code seulement.
- **Actions rondes** : gardées (Imprimer, Scanner, Annonces, Messages, Stats). « Publier » et « Relier » de la maquette n'ont pas
  de geste global sans N° choisi : pas posés (à décider avec Julien).

Preuves : banc `style-clarte` **C9 « Mois »**, **C10 pied Vendu · Reçu · À venir**, **C11 Colis en deux cases + en-tête (relire,
cloche) à l'ordinateur** ajoutés ; C1 compte les jours par `data-n-jour` (la règle « un repère par jour », quelle que soit la forme).
Captures : scratchpad `sc-avant1/` (avant) et `sc-apres1/` (après), 390 clair/sombre et 1512.
`journee-stats` : J3 à 1512 (les chiffres descendent quand « Dernières ventes » arrive à côté de Colis, sans graphique dans sa base)
— la cause est la grille d'avant, pas ce lot ; à 390 vert après avoir fixé la hauteur des cases. `aujourdhui-propre` F5 (ordre
d'avant le tableau de bord, carte « À retirer » d'avant Colis) : périmé depuis le tableau de bord (de7f8c0), pas dans la CI.

## ÉTAT À LA REPRISE

Tranche 1 : voir §5 et la PR. Tranche 2 (Ventes, Annonces, fiche annonce en tableau dense) : branche `claude/style-clarte-2`.
