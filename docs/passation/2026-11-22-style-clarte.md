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

## 2. Preuves

(voir §4 — complété à chaque tour)

## 3. Ce qui reste (ordre proposé)

Ventes / Annonces / Achats : rangées plus denses au téléphone (la vente porte encore « Relier » + « Prix d'achat » sur sa rangée) ;
Achats à l'ordinateur (en-tête vide à droite, cartes à demi-largeur) ; puis Argent, Stock, Messages, Réglages, feuilles.

## 4. Journal des vérifications
