# 10 nov. 2026 — Lot AP : republier à la main, conseillé et attirant (demande 17)

Branche `claude/republier-main`. Julien (9 nov., 21 h, mot pour mot) : « Republication à la main :
la conseiller (moins risquée) et la rendre attirante ; transmettre les photos retouchées à la galerie
du téléphone pour poster sans souci ; regarder comment garder/réattribuer le N° et comment gérer les
descriptions en sélection multiple. »

Rien n'est envoyé à Vinted par ce chemin. L'atelier automatique (`RepublierVinted`, ordre coffre →
supprimer → brouillon → mise en ligne) n'est pas touché ; rien de retiré n'est remis.

## Ce qui a changé

**Vue Annonces → Republier** (`ChoixAnnoncesVinted`, `filtre='republier'`) :
- en tête, une carte calme « À la main : conseillé, le moins risqué. Photos dans ta galerie, N° et
  description à copier » (`data-republier-conseil="main"`) ;
- consigne : « Coche des annonces, puis choisis À la main ou Par VRM » ;
- au pied, deux boutons : **« À la main · N »** (principal, `data-republier-main-lancer`) et
  « Par VRM · N » (second, garde `data-republier-lancer` : l'atelier, inchangé). Le second est rendu
  opaque (il flotte sur la liste). « À la main » passe par la règle de la tuile (`actionsPossibles`
  … `'main'` : chaque paire SON compte connu, comptes mélangés permis).

**Le kit « Republier à la main » pour plusieurs annonces** (`PreparerALaMain`, src/ecrans/Republier.jsx,
chargé à la demande) :
- conseil en tête (« Le plus sûr : tu publies toi-même ») ;
- couverture dite : « 2 descriptions prêtes » ou « Descriptions lues : 1 sur 2 » ;
- une carte par paire, dans l'ordre de ses clics : photo (réglée en aperçu), N°, titre, compte · prix,
  description TELLE QU'ELLE PARTIRA (`annonceRepubliee` : la règle de l'atelier, lettre et N° selon
  Réglages → Numéros ; prix et titre à « Garder » comme toute ouverture) ;
- trois gestes par carte : **copier le N°** (l'étiquette telle qu'écrite dans l'annonce, sinon « N°42 » ;
  pas de N° ⇒ « Sans N° », rien d'inventé), **copier la description** (seulement si la fiche est lue ;
  sinon « Description pas lue : copie-la depuis Vinted » en ambre), **enregistrer les photos réglées**
  (iPhone : menu de partage avec fichiers ⇒ « Enregistrer les images » les met dans Photos ;
  ordinateur : téléchargement `VRM-{N°}-01.jpg…`) ;
- « Tout copier » : N° + titre + description de chacune, séparés, dans l'ordre (`texteKit`) ;
- pied : « Pas à pas » (la feuille en cinq étapes existante sur la même liste : prix, titre, relier)
  et « Ouvrir Vinted ↗ » qui note le suivi de chaque paire numérotée (`vrm_repub_main`, par son id).

**Le N°** : rien de neuf côté règle. Le suivi posé par « Ouvrir Vinted » fait apparaître chaque paire
dans la vue Republier (« Republiée à la main : choisis la nouvelle annonce… », « Reprendre ») ; c'est
SON clic qui désigne la nouvelle annonce, puis `repriseNumerosRecreation` passe le N° quand l'ancienne
n'est plus sur Vinted. Jamais par ressemblance.

**Une photo seule** : dans « Pas à pas » → Photos, une fois préparées, chaque vignette porte un bouton
rond de 44 px « Enregistrer la photo N » (partage d'UN fichier, ou téléchargement).

**Une source pour les photos** : `usePhotosReglees(photos, reglage, numero)` (même fichier, juste après
`RepublierALaMain`) porte la préparation (`dessinerPhotoReglee`, le dessin de l'atelier), le partage et
le téléchargement — pour la feuille pas à pas ET le kit. Libellé au singulier pour une photo.

**Règle** : `src/republierKit.js` — `numeroACopier`, `blocPaire`, `texteKit`, `couvertureKit`,
`DESC_PAS_LUE` (pas su ≠ vide).

Styles : `src/republier-main.css` (fin du fichier, variables du thème, clair et sombre).

## Preuves

- `npm run build` vert.
- `node scripts/audit-republier-kit.cjs` : 17 contrôles verts (règle EXÉCUTÉE + branchement) ;
  `--prouve` 13/13 mutations rouges (N° inventé, étiquette ignorée, description vide copiée,
  couverture « toutes », ordre trié, « À la main » en second, conseil retiré, texte recopié dans le
  kit, photos brutes, photo seule retirée, envoi chez Vinted, règle de la tuile sautée, suivi posé
  par titre). Sur l'arbre d'avant (`git archive 4c6290f0`, audit + module copiés) : 9 rouges sur 17.
- `audit-republier-main` 36 verts, `--prouve` 22/22 (le kit renommait d'abord son texte `ann` et
  masquait la mutation `copie_texte_main` : corrigé, `annK`).
- `audit-annonces-actions` 69, `audit-variables`, `audit-tdz`, `audit-coherence`, `audit-identite`,
  `audit-icones` verts.
- Banc `scripts/bancs/republier-kit.cjs` (neuf, données inventées ; faux pont qui sert les photos ;
  390 tactile = iPhone avec `navigator.share` noté, 1512 = téléchargement) : conseil, deux boutons,
  kit (cartes, description avec N°42, copier N° ⇒ « N°42 », description ⇒ texte avec N°43 sans
  l'ancienne lettre, Tout copier dans l'ordre, 2 photos partagées/téléchargées), suivi noté par id,
  pas à pas 1/2, photo seule VRM-42-02.jpg, « Reprendre » × 2, rien parti, 44 px, aucun débordement,
  aucune erreur. Captures regardées (vue, kit, photo seule, suivis).
- Bancs voisins relancés : `republier-main`, `navigation-fusion`.

## Reste

- Le kit ne règle ni le prix ni le titre (« Pas à pas » le fait, par paire) — volontaire : le prix ne
  change jamais sans son clic.
- La description ne vient que du coffre (comme la feuille pas à pas) : sans coffre, elle est dite
  « pas lue ».

## Geste de Julien

Aucun technique. Au téléphone : Annonces → Republier, cocher deux paires → « À la main · 2 », puis
« Photos » sur une carte (« Enregistrer les images »), « N°… » et « Description » à coller dans Vinted.
