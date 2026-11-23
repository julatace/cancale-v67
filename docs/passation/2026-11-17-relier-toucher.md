# 17 nov. 2026 — Relier en touchant (lot `relier-toucher`)

Julien, sur la liaison en ligne : « pour relier ça marche pas très bien : je dois rester appuyé sur l'achat ; quand je
fais les trois petits points, ça ne me propose pas de relier ; et après on ne voit pas ce que j'ai sélectionné ».

## Ce qui change (`src/RelierGlisser.jsx`, l'écran « Relier achats et ventes »)
- **Un toucher simple suffit** : toucher un achat le choisit ; un **bandeau fixe** sous le titre le montre tout du long
  (photo, « Achat choisi », titre, prix, « Changer ») et la ligne est surlignée ; au téléphone la liste des achats laisse
  sa place aux ventes / annonces ; toucher l'une ⇒ « Relier N°2 à cet achat de 40,00 € ? Oui · Annuler » ⇒ la pilule
  « Achat relié · Bénéfice … · Reçu · Annuler » (5 s). Toute la ligne de la vente / annonce se touche.
- **Dans l'autre sens** : toucher d'abord une vente / annonce (bandeau « Article choisi »), puis l'achat. Le lien
  « Relier achats et ventes » de la feuille « Relier un achat » (ouverte depuis une vente ou une annonce) ouvre l'écran
  avec CET article déjà choisi.
- **« ⋯ » d'un achat** (et « Actions » de sa fiche, mêmes gestes) : « Relier à une vente / annonce » quand l'achat est
  libre (pas annulé, ni en retour / litige, ni relié) ⇒ l'écran s'ouvre, cet achat choisi.
- Le glisser (appui long) reste un bonus. L'entrée s'appelle « Relier achats et ventes » (5 langues).

## Preuves
- `audit-relier-glisser` : 56 verts, 24/24 mutations (dont : toucher la cible ne pose pas la question, pas de bandeau,
  « ⋯ » sans « Relier »).
- Banc `relier-glisser` passe `toucher` (390 tactile, `tap`) : 15/0 — « ⋯ » montre « Relier à… », bandeau visible
  (même après défilement et pendant la question), liste d'en face seule, N°2 relié, bénéfice « au plus +31 € au prix
  affiché » + « Reçu », Annuler, **3 touchers** (achat, annonce, Oui), sens inverse. Passes 390 doigt et 1512 : vertes.
  Captures regardées (menu, choisi, question, relié, inverse).

## ÉTAT À LA REPRISE
- Branche `claude/relier-toucher`. Rien à faire de Julien ; à essayer sur son iPhone.
