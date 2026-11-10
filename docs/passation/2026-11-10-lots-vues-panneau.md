# Lot X (10 nov.) — sélection multiple, filtres enregistrés, fiche à côté de la liste

Validé par Julien (propositions 35, 36, 37 ; `2026-11-09-propositions.md`). Branche `claude/lots-vues-panneau`.
Annonces n'est PAS touché (un autre lot la refait en grille) : sa sélection reste la sienne.

## 1. Sélection multiple — Ventes, Colis (À envoyer), Achats

- Un bouton **« Sélectionner »** (« Terminé » pour sortir) ; une case ronde par ligne (44 px), la ligne
  entière bascule aussi ; en mode sélection, toucher une ligne **n'ouvre rien** (ni la fiche, ni le menu,
  ni le glisser « Colis fait »).
- Une barre (en bas au téléphone, sous les filtres de Colis sur ordinateur) : « N choisis », puis un
  bouton par geste qui EXISTE déjà, avec le nombre qu'il TOUCHE vraiment :
  - **Ventes** : « Imprimer · N » (la règle et le contrôle de « Tout imprimer », `batchBordereaux`) ·
    « Déposé · N » (le geste « Colis fait », vente + bordereau). **Jamais « Masquer »** (29 oct.).
  - **Colis → À envoyer** (colis Vinted) : les mêmes deux gestes.
  - **Achats** : « Masquer · N ».
  - Ce qui n'a aucun geste est **dit** (« 1 sans geste possible »).
- Les gestes en série sont UN geste annulable (`gesteVrm`, pilule « Annuler » 5 s) : `gesteColisFaitSerie`,
  `masquerAchatsSerie` — les mêmes écritures que le geste un par un. Imprimer garde son contrôle
  (« Vérifier les articles avant impression »).
- Identité : le n° de transaction (jamais un titre). Une case qui n'est plus visible (filtre changé) ne compte plus.
- Règle pure : `src/selectionSerie.js`.

## 2. Filtres enregistrés

- Rangée « puces » sous le filtre des sites (Ventes, Achats) et sous les onglets (Colis) :
  une puce par combinaison, « + Enregistrer ces filtres » (un nom, `askText`), « Modifier » (× pour supprimer).
- Rangés dans **SES données** : clé synchronisée `vrm_vues_filtres` (ligne `main`, `SYNC_KEYS`), écrite par
  `gesteVrm` (annulable). Forme `{ [id]: { e, nom, f: { site, compte, etat, periode }, at } }`.
- Ce qui est rangé : la plateforme, le compte Vinted (identifiant, `''` = tous), l'état (filtre Ventes /
  onglet Achats / onglet Colis), la période. Hors Vinted, ni état ni période (ils ne s'appliqueraient pas).
  Jamais la recherche tapée. 12 par écran, noms uniques, mêmes filtres refusés deux fois.
- Appliquer : la coque pose le site et le compte, l'écran Vinted PREND l'état et la période
  (`DEMANDE_FILTRES`, comme `DEMANDE_VUE`) et PUBLIE les siens (`FILTRES_VINTED`) pour la puce appuyée.
- Règle pure : `src/vuesFiltres.js`. L'ancien « Mes vues » (Outils de Ventes, `localStorage`) est laissé tel quel.

## 3. La fiche à côté de la liste (≥ 1200 px)

- **Ventes** : le tiroir de la vente devient un panneau à droite (420 px, rayon DA6) ; la liste se pousse
  (`html[data-panneau-fiche]` → `padding-right` du `.vrm-main`) ; un toucher dans la liste ne le ferme plus,
  une autre vente le remplace. ⚠️ Son hôte porte `vrm-app-shell`, à qui la DA6 donne un sol OPAQUE
  (`@layer vrm-premium`, `!important`) : la règle qui le rend transparent est dans la même couche, plus précise.
- **Achats** et **Colis (À envoyer)** : toucher la ligne (hors boutons) ouvre `PanneauFiche` : photo, lignes
  nettes, gestes (achat : code, suivi, reçu, note, masquer ; colis : imprimer, déposé) — les mêmes fonctions.
- En dessous de 1200 px : rien ne change (feuille au téléphone, aucun panneau).
- Composants : `src/VuesPanneau.jsx` (+ `src/styles-vues-panneau.css`, importé après la DA6).

## Preuves

- `scripts/bancs/vues-panneau.cjs` (données inventées, 390 tactile sombre/clair, 1512 clair/sombre) :
  **80 verts**. Rouge sur `origin/main` construit (app chargée ; aucun « Sélectionner », aucune puce). Mutation « déposable = tout » ⇒
  S3/S4 rouges. Le panneau est jugé VISIBLE (`elementFromPoint` sur la ligne), pas seulement placé : la
  première version passait le contrôle géométrique avec un sol opaque par-dessus la liste — la capture l'a montré.
- `scripts/audit-vues-filtres.cjs` : 23 verts ; mutation « mêmes filtres sans l'état » ⇒ 4b rouge.
- Relancés un à un : `ordre-recent` 62, `vues-ventes`, `achats-fiche`, `colis-envoi` 118, `ventes-compte` 55,
  `ventes-par-compte`, `ventes-colis-premium` 32, `colis-sortants` 30, `achats-en-route-ordre`, `ventes-une-phrase` ; audits variables, tdz, coherence, identite, icones et ceux de `SYNC_KEYS` verts.

Rouges DÉJÀ sur `origin/main` (mêmes contrôles, même nombre, mesurés sur son build) — pas ce lot :
`colis-ventes-instantanes` (6 : ordre de l'instantané « À envoyer » d'avant le lot AJ, CLS 0,011 de la ligne de
fraîcheur), `achats-retraits` (8 : « Peut-être en double », retiré le 9 nov.), `colis-tous-sites` (3 : le rappel du soir).

## Reste

- La sélection Colis ne couvre que les colis **Vinted** (Leboncoin, Vestiaire, eBay ont leur carte sans case).
- « Mes vues » des Outils de Ventes (local) coexiste avec les puces ; à retirer si Julien le veut.
- Leboncoin / eBay / Vestiaire : la puce rend le site seulement (leurs écrans ont leurs propres filtres).

Geste de Julien : aucun.
