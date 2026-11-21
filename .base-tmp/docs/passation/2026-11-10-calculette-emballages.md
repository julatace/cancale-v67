# 10 novembre — Lot L : calculette d'achat, historique de prix, stock d'emballages

Branche `claude/calculette-emballages`. Validé par Julien (propositions 13, 17, 19). L'extension
n'est pas touchée.

## 1. Calculette d'achat — `src/calculetteAchat.js` (pur) + `src/CalculetteAchat.jsx`
- Ouverte par le bouton « Calculette » d'Achats (en-tête, `vrm:calculette`) et par ⌘K
  (« calculette », « combien je gagne », « marge »… — action `calculette` de
  `src/annulerCommandes.js`, qui OUVRE seulement). Feuille `SheetShell` sous son garde-fou.
- Il tape le prix d'achat, le prix de revente, choisit le site, l'emballage (tapé, ou une
  puce de SES emballages à coût). **Rien n'est écrit**, aucun prix n'est proposé (refus du 11 oct.).
- Le bénéfice est `cascadeVente` (la règle du bénéfice d'une vente) sur une fiche faite des
  chiffres tapés. Frais du site, tels que VRM les LIT (`src/fraisPlateformes.js`) :
  Vinted 0 et Leboncoin 0 (exact) ; eBay = Σ frais / Σ dû au vendeur de SES commandes aux frais
  lus (`fraisParPlateforme`), appliqué au prix tapé ⇒ « environ », « 13 % d'après tes N ventes
  eBay » ; aucune commande lue ⇒ frais pas sus ⇒ « au plus » ; Vestiaire : commission pas lue ⇒
  « au plus ». Emballage vide ⇒ « au plus » + « pas compté » (jamais 0).
- Non fait (dit) : le mode inverse « paie-la au plus … » et l'URSSAF ne sont pas dans la
  calculette (le texte validé dit « X € et Y € ⇒ bénéfice net »).

## 2. Historique de prix — `src/historiquePrix.js` (pur)
- `vrm_prix_lus` (synchronisé, `main`) : `{ v:1, debut, a: { [item_id]: [[ms, centimes]…] } }`.
  À chaque lecture des annonces sans erreur (et nuage chargé), App.jsx ajoute le prix d'une
  annonce vue pour la 1re fois ou CHANGÉ, daté par la lecture de SON compte (`listings.lues`),
  jamais l'heure de l'écran ; capture plus ancienne, compte sans date, autre devise ⇒ rien.
  24 prix par annonce, 4 000 annonces au plus.
- La fiche paire (étape « Prix » de `histoireArticle`) ajoute les prix lus (« lu dans le
  dressing ») aux changements faits depuis VRM (Republier, baisse en série du lot C,
  `vinted_prix_historique`), et un escalier (`EscalierPrix`, `FichePaire.jsx`) dès deux prix.
  Ce qui précède le 10 nov. n'est pas connu : « prix lus depuis le … ».

## 3. Stock d'emballages — `src/emballages.js` (pur) + `src/EmballagesCarte.jsx`
- Stock : carte DA6 « Emballages » (Ajouter ; par type : reste en gros, « compté le … · N
  utilisés », coût ; ambre « Plus que 3 : pense à en racheter » au seuil ou dessous ; « Par
  défaut » s'il y a plusieurs types). Feuille : nom, « J'en ai », coût (facultatif), « Préviens-moi à ».
- Le reste est DÉRIVÉ : compté − « Colis fait » datés APRÈS le comptage (`vinted_ship_done`,
  `vrm_lbc_colis_done`, `vrm_vc_colis_done`) — un « Annuler » rend l'emballage, deux appareils
  comptent pareil. eBay n'a pas de « Colis fait » : pas décompté (dit sur la carte).
- Type d'un colis : SON choix dans « Préparer mes colis » (puces, seulement s'il en a plusieurs,
  « Aucun » possible), sinon le défaut, sinon le seul type. Plusieurs types sans défaut ni
  choix ⇒ rien décompté, « N colis sans emballage choisi ».
- Le coût ne va dans une vente QUE par la porte « Emballage · non saisi » du récap : ses
  emballages à coût y sont proposés en puces, une puce remplit le champ, SON « OK » enregistre.

## Preuves
- `node scripts/audit-calculette-emballages.cjs` : 37 verts ; `--prouve` 15/15 mutations rouges ;
  sur l'arbre d'`origin/main` (git archive ae0e418d) : rouge (modules absents).
- `npm run build` vert.
- Banc `scripts/bancs/calculette-emballages.cjs` (données inventées ; 390 px tactile et 1512 px,
  clair et sombre) : **68 verts**. Il joue : Stock → Emballages → Ajouter (Boîte, 3, 0,80 €, seuil 2) ;
  Colis → Préparer → « Colis fait » (écrit SA vente) puis « Colis fait » + « Annuler » (rien) ;
  Stock : reste 2, ambre ; Ventes → récap → « non saisi » → puce « Boîte · 0,80 € » remplit, « OK »
  écrit `emballage: '0.80'` ; Achats → Calculette (59,20 € exact ; Vestiaire « au plus » ; rien
  écrit) ; ⌘K « calculette » ; fiche du N°11 : le prix changé (95 €) ajouté au journal, escalier
  110 → 95 €, 3 prix lus datés. Sur l'arbre d'`origin/main` rebâti : 7 rouges ; par mutation
  rebâtie (décompte retiré + prix changé jamais noté) : 3 rouges.
- Vu sur les captures et corrigé : les champs de la feuille Emballages écrasés à 22 px (flex en
  colonne) ; le bouton « Calculette » absent dans l'espace Vinted (pas d'en-tête : une rangée en
  haut d'Achats) ; « Plus que 2 » répétait le nombre (§7) ⇒ « Bientôt plus : pense à en racheter » ;
  l'escalier écrivait 110 € → 95 € déjà dans la liste ⇒ retiré ; points de l'escalier ovales en
  1512 ⇒ ronds, largeur bornée à 360 px ; « Leboncoin » tronqué au téléphone ⇒ sites en 2×2.
- Bancs relancés un à un : `fiche-paire` vert, `preparer-relais` 131 conformes, `recap-vente`
  80/0, `cout-vente` 60/0 ; `stock-annonces` : 20 rouges, EXACTEMENT les mêmes sur `origin/main`
  (diff des intitulés vide) — pas de ce lot.

## Geste de Julien
Au Stock, « Emballages » → Ajouter : ses cartons/sacs, combien, le coût s'il veut.
