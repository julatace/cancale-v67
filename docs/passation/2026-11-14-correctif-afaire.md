# Correctif « À faire » — la feuille qui ne se fermait plus (14 nov.)

Branche `claude/correctif-afaire` (depuis `claude/integration-refonte`). Banc : `scripts/bancs/afaire-feuille.cjs`.

## Ce que Julien a vu
La version `claude/integration-refonte` en ligne, sur son iPhone : Annonces · Vestiaire, la feuille « À faire »
ouverte (« Baisser des prix » seul dans une rangée blanche), le voile gris, la page derrière décalée vers la
gauche (« Mettre en vente » coupé au bord). « OK », le voile : rien ne fermait. Mise en ligne annulée
(`main` = 578bd343).

## Les causes (mesurées sur l'app rendue, base inventée à la vraie forme)
1. **La feuille d'un site était dessinée « fermée ».** `src/plateformes/AFaireSite.jsx` garde sa feuille
   MONTÉE fermée (`hidden`) pour ne pas couper une série en cours. Mais `.vrm-ui-voile` porte
   `display:flex !important` (ui.css, sélecteur `:root:root:root:root:root:root body …` = spécificité 0,7,1,
   monté par la refonte des listes) et la règle qui la cachait (`plateformes.css`,
   `:root:root body .vrm-ui-voile.vrm-pf-voile[hidden]` = 0,5,1, écrite sur l'autre branche) perdait : les deux
   branches réunies, **le voile et la feuille étaient affichés dès l'arrivée sur l'écran** (Vestiaire,
   Leboncoin, eBay — et Paramètres pour le propriétaire : « Ouvrir le paiement »). « OK » et le voile posaient
   `ouvert = false` sur un état qui l'était déjà : rien ne pouvait la fermer. Mesuré dans Chromium 390 tactile :
   `hidden = true`, `display: flex`.
2. **La page décalée : la section Vestiaire centrait ses cartes.** `rendreVestiaire` pose en ligne
   `display:flex; flex-direction:column` sur `.vrm-market-space`, dont la règle d'origine
   (`styles-mineral.css`, une GRILLE) dit `align-items:center`. En colonne, chaque carte est alors centrée et
   prend la largeur de son CONTENU : une ligne qui ne se coupe pas (« N°215 · adidas handball spezial marron
   taille 38 ») l'élargit au-delà de l'écran, des deux côtés — le bord gauche coupé (« Mettre en vente »), le
   droit qui élargit la page (le doigt la fait glisser de côté). Mesuré : `align-items: center` sur
   `[data-tache-vestiaire]`.
3. Sur toutes les feuilles de `src/ui` (« À faire » d'Annonces et de Colis, comptes, comparer, phrase…) :
   aucun **glisser** ni **retour** (le geste retour changeait d'écran SOUS la feuille), et `onClose` en
   dépendance de l'effet de focus — chaque nouveau rendu de l'écran rendait le focus au bouton d'avant puis à
   la feuille (`focus()` sans `preventScroll`, qui fait défiler ce qui contient le bouton).

## La correction (à la racine)
- `src/ui/Feuille.jsx` : `ouvert` (vrai par défaut). Fermée mais montée, le voile ne porte PLUS la classe
  `vrm-ui-voile` (classe de repos, `hidden`, `display:none`) ; quatre fermetures : « OK », le voile, glisser
  vers le bas (poignée 36 × 5 et tête, au doigt et à la souris), le geste retour + Échap (le vrai
  `FermeAuRetour` de l'app, prêté par `src/ui/retour.jsx` : App le pose au chargement) ; `onClose` dans une
  référence ; focus `preventScroll` à l'entrée et au retour.
- `src/plateformes/AFaireSite.jsx` : bâtie sur `Feuille ouvert={…}` (une seule feuille, mêmes `data-*`) ; se
  ferme quand il n'y a plus rien à faire ; un geste `data-afaire-ferme` (« Baisser des prix ») la referme avant
  que l'autre feuille ne s'ouvre.
- `src/ui/AFaire.jsx` : la feuille se ferme quand il n'y a plus d'alerte (ou passée à l'ordinateur).
- `src/ui/ui.css` : `[hidden]` et la classe de repos gagnent sur tout `display` posé sur ces classes (0,8,1).
- `src/App.jsx` : `alignItems:'stretch'` sur la section Vestiaire ; `poserFermeAuRetour(FermeAuRetour)`.

## Preuves
Voir le rapport chiffré en bas (mis à jour à la fin de la session).
