# 9 nov. 2026 (soir) — Lot AL : « Favoris & offres » dans Messages, « Republier » dans Annonces

Branche `claude/navigation-fusion` (depuis `origin/main`). Pas de PR, pas de fusion : à fusionner par le coordinateur.

Julien, mot pour mot : « Je ne pense pas qu'un onglet Republier et Favoris & offres soient dans des onglets
à part ; ils doivent exister, rien ne doit être supprimé, mais par exemple les favoris et offres doivent
être dans Messages et Republier dans Annonces, ce sera beaucoup plus clair et simple je pense. »
(propositions du 9 nov., 21 h, point 12 ; file des lots, AL).

## Ce qui change

| avant | après |
|---|---|
| colonne (ordinateur) : groupe « Vendre » = Republier · Favoris & offres | les deux entrées quittent la colonne ; « Vendre », vide, disparaît (Messages est déjà dans les tâches du haut) |
| « Plus » (téléphone) : Vendre = Messages · Republier · Favoris & offres | Vendre = Messages |
| Messages : « Conversations · Favoris reçus » | « Conversations · **Favoris & offres** » (le nom de l'ancienne entrée ; même écran `FavorisConnectes` : favoris reçus, offre aux favoris, mode auto). `data-messages-zone="conversations|favoris"`. Une ligne, jamais coupée (`white-space: nowrap`, styles-captures.css) |
| Annonces : Toutes · Sélectionner · Brouillons · … ; « Republier… » (barre d'outils) ⇒ Sélectionner | Toutes · Sélectionner · **Republier** · Brouillons · … (`data-vue-republier`). La vue « Republier » : ses annonces **en ligne** à cocher (la même sélection que Sélectionner), puis « **Republier · N** » (`data-republier-lancer`) ouvre **l'atelier** (`RepublierVinted`, action `recreer`, à l'étape « Modifier » ; « Retour » ramène au choix). « Republier… » de la barre d'outils mène désormais à cette vue |

Le lancement depuis la vue « Republier » passe par la MÊME règle que la tuile « Republier » de la feuille
Actions (`actionsPossibles` : un compte à la fois, celui de l'onglet Vinted, extension à jour) ; un refus
dit sa raison (toast), rien ne part. L'atelier garde sa vérification avant publication (`problemesLot`),
ses réglages, l'ordre, l'espacement, et c'est lui qui lance (§3, rien d'automatique). « Sélectionner » et
sa feuille « Actions » (4 tuiles, « à la main », « Prix mini… ») sont inchangés.

Badges : aucune source ne publiait de nombre pour ces deux entrées (`badgesNav`, « Favoris & offres,
Republier, Vestiaire : aucune source ») ; rien n'est à porter par Messages / Annonces, rien n'est inventé.

Affichage « Simple » (`ENTREES_SIMPLE.republier`) : il ne servait qu'à cacher l'entrée du menu ; la vue
« Republier » d'Annonces est montrée à tous (une vue parmi les autres, pas une ligne de menu). La règle
pure `entreeMontree` reste (son audit l'exécute).

## Les anciens chemins (redirigés)

`VUES_DEPLACEES = { republier: ['cat_annonces','republier'], favoris: ['cat_msg','favoris'] }`, appliqué dans
`setTab` (donc tous les appelants : liens, `vrm:aller`, reprise) :

| chemin | arrive |
|---|---|
| `?tab=republier`, `vrm:aller` « republier », `setTab('republier')` | Annonces · Vinted · vue Republier |
| `?tab=cat_annonces&vue=republier`, `?tab=annonces&vue=republier` | idem — sans `site`, le filtre retenu (ex. Leboncoin) ne la cache pas (Vinted forcé) |
| `demanderVue('republier')` (À trancher, Ma journée…) | idem (`prendreVue('republier')` ⇒ `setAnnSort('republier')`) |
| `?tab=favoris`, `vrm:aller` « favoris » | Messages · Vinted · Favoris & offres |
| `?tab=cat_msg&vue=favoris`, `?tab=messages&vue=favoris` (filtre Leboncoin retenu), `?tab=messages&site=vinted&vue=favoris` (notifications, `api/_lib/lien-notif.js`) | idem |
| « Offre aux favoris » de Qui dorment (`demanderVue('favoris')` + Messages) | inchangé |

⌘K : n'avait aucune entrée pour ces deux écrans (ses résultats mènent à `cat_annonces` / `cat_msg`,
inchangés).

## §4.11 — écrans montés, avant / après

Compté sur `origin/main` (archive) et sur la branche : `tab===` 26 distincts / 48 occurrences des deux
côtés, `GardeEcran` 42 distincts des deux côtés ; `<FavorisConnectes` 1, `<RepublierVinted` 4,
`<ChoixAnnoncesVinted` 1, `<ActionsSelectionFeuille` 1, `<AtelierFile` 1, `<RepublierALaMain` 1,
`<PiloteFavorisAuto` 2, `<QuiDorment` 1, `<SynchronisationVinted` 1 — identiques. Aucun écran perdu.

## Preuves

- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones`,
  `vendeurs-differents` verts ; `audit-annonces-coherence` 29 verts, 15/15 mutations (A2/A3 et leurs deux
  mutations réécrits pour la vue « Republier » ; la mutation `republier_feuille` ne trouvait plus sa
  cible depuis l'ajout d'`aria-label`, elle vise maintenant le vrai bouton).
- **Nouveau banc `scripts/bancs/navigation-fusion.cjs`** (données inventées, 390 tactile sombre + 1512
  clair) : **45 verts**. Sur `origin/main` (git archive, build à part) : **9 rouges** (entrées présentes,
  « Vendre » plein, vue absente). Mutations : redirection `VUES_DEPLACEES` retirée de `setTab` ⇒ 8 rouges
  (`?tab=republier|favoris`, `vrm:aller`) ; Vinted forcé retiré ⇒ 2 rouges (`?tab=messages&vue=favoris`
  avec le filtre Leboncoin retenu). Captures regardées (vue Republier au téléphone, atelier à 1512,
  Favoris & offres sur une ligne).
- Bancs mis à jour, en le disant dans leur code : `navigation-tache` (I : plus Republier/Favoris dans
  « Plus » ; A/J : groupes Gérer · Argent · Moi ; et, périmé sur main par le lot AC, « Gérer » commence
  par À trancher) **164 verts** ; `nav-v2` (N7 sans « Vendre ») **54** ; `iphone-reprise` (O) **139** ;
  `annonces-coherence` (U : « Republier… » et l'ancien lien ⇒ vue Republier) **130** ;
  `achats-messages-premium` (vise `data-messages-zone="favoris"`) **62** ; `messages-emails-communaute`
  **108** ; `vendeurs-differents` (A3/A6/B2 : Republier jamais dans le menu) ; `tous-boutons` (l'écran
  « republier » par son lien).
- Rouges qui ne viennent pas d'ici (les mêmes sur `origin/main`) : `vendeurs-differents` A5/A6 à 390
  (le banc n'ouvre pas « Plus » : il lit seulement la barre du bas) ; `stock-gestes` A, B, E (écran Stock,
  délais dépassés). D (Messages, icônes des deux sections) est vert.

## Ce qui reste

- Julien : regarder Annonces → Republier et Messages → Favoris & offres. Aucun geste technique.
- Les deux rouges anciens ci-dessus (bancs `vendeurs-differents` 390, `stock-gestes`) : à remettre au vert
  dans un lot à part.
- `ENTREES_SIMPLE.republier` n'a plus d'entrée de menu à cacher : à retirer si personne ne le relit.
