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

- `src/plateformes/plateformes.css` : une porte d'un seul bouton (« Baisser des prix ») devient la rangée
  entière (plus de capsule grise dans une rangée blanche à moitié vide).

## Les autres pièges du même genre (trouvés par le banc, corrigés)
- **Un geste d'« À faire » ouvrait sa feuille DERRIÈRE le voile** : Annonces, « Prochain geste · Compléter »
  ouvre la saisie des prix d'achat (z 1000) sous « À faire » (z 20000) — invisible ; de même tout ⓘ
  (`Pourquoi` : une `SheetShell` z 12000) posé dans « À faire » (Colis : « à envoyer en priorité ⓘ »,
  « Préparer la tournée ⓘ »). Correction générale : `Feuille fermeSiAutreCouche` (« À faire » d'Annonces, de
  Colis, des sites, `LigneAFaire`) — toute couche modale qui apparaît après un toucher dans la feuille (1,5 s)
  la referme, marquée ou non ; `data-afaire-ferme` compris par `AFaire.jsx` ; un bouton qui DÉPLIE sur place
  (`aria-expanded`, « 2 nouveaux N° · Vérifier ») la laisse ouverte (avant, `data-num-neufs-ouvrir` la fermait
  et cachait ce qu'il dépliait).
- **La page glissait de 2 px** : au téléphone, des bandes « bord à bord » (`margin: 0 -16px` : la barre collée
  d'Annonces, la recherche d'Achats) posées dans une gouttière de 14 px dépassaient de 2 px de chaque côté ;
  `.vrm-main` (overflow-x hidden, donc défilable par un focus / `scrollIntoView`) avait 392 px à faire défiler
  sur 390, et le toucher d'un « ⋯ » d'Achats le décalait de 2 px — pour de bon. Correction : au téléphone,
  chaque enfant de `.vrm-main` coupe en largeur (`overflow-x: clip`, spécificité nulle : un enfant qui pose son
  propre `overflow-x` le garde ; le collé reste collé ; une couche fixe n'est pas coupée).
- Balayage de 29 écrans au téléphone (chaque ouvreur visible : aides, comptes, « À faire », « ⋯ », périodes…) :
  rien d'autre (aucun voile laissé, aucun `[hidden]` dessiné, aucun débord, un balayage horizontal du doigt ne
  décale rien).

## Preuves (banc `afaire-feuille`)
- **Avant** (`git archive origin/claude/integration-refonte`, build, banc copié dedans) : 19 rouges sur
  Annonces · Vestiaire, Annonces · Vinted et Colis (390 tactile, clair) — voile dessiné à l'arrivée,
  `[hidden]` dessiné, « OK » / voile / glisser ne ferment pas, « retour » change d'écran, carte élargie par une
  ligne longue (H2), « Baisser des prix » ouvre derrière, « Compléter » ouvre derrière ; balayage avant la coupe
  en largeur : 20 rouges sur Achats + Annonces (`.vrm-main` 392/390, décalé de 2 px après « ⋯ »).
- **Mutation** (la feuille fermée garde `vrm-ui-voile`, sans la classe de repos ni la règle `[hidden]`) :
  23 rouges (Vestiaire + eBay).
- **Après** : feuilles 390 tactile + 1512 souris, clair + sombre, 7 cas au téléphone (Annonces · Vinted /
  Vestiaire / Leboncoin / eBay, Colis, l'exemple × 2) et 3 à l'ordinateur : **575 verts, 0 rouge** ; dernier
  build, 390 clair + sombre : **388 verts, 0 rouge**. Balayage des 29 écrans : 169 verts, 15 rouges sur le build
  intermédiaire (13 = Achats, la coupe ne passait pas sous les gardes d'écran en `display: contents` — corrigé ;
  2 = machine : un navigateur tombé sur Paramètres, une erreur du service worker « Failed to access storage »,
  disque plein à 98 %) ; Achats, Annonces, Paramètres, Communauté, Ventes rejoués sur le dernier build :
  **52 verts, 0 rouge**.
- Audits verts : traduction, tdz, variables, coherence, composants, violet, rouge-doublon, identite, csp.
- Bancs (dernier build) : garde-ecrans, accompagnement (28 moments), achats-retraits (84/0), tout-imprimer
  (28 conformes), exemple-photos verts ; accueil-reste et refonte-listes rouges sur la passe chargée (un délai de
  3 s, une recherche à 328–399 ms pour 300) puis **verts relancés seuls** (recherche 189 ms).
  refonte-plateformes-reglages : 4 rouges, tous « tailles » 14 px du bandeau du mode exemple (« Exemple —
  données inventées », « J'ai déjà un compte · Me connecter ») — **les mêmes sur `origin/claude/integration-refonte`**
  (relancé sur son build : 2 défauts par thème) : préexistant, rien à voir avec ce correctif, à reprendre à part.
- `PARTIES=feuilles|balayage`, `CAS=`, `LARGEURS=`, `THEMES=`, `ECRANS=`, `BANC_DIST=`, `SHOTS=`.
