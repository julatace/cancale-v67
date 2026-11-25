# Logo Vinted et photo de profil en tête de chaque compte — 25 nov. 2026 (`claude/logo-vinted-pp`)

## La demande

Julien (iPhone, style Monochrome, écran Annonces), sur ses captures : chaque groupe de compte commence par
« V (S) shop_cancale · 27 ⌄ » — un « V » penché tout NOIR puis un rond coloré à l'initiale.
« corrige le logo compte Vinted » ; « le logo de Vinted, mais pour le compte la pp du compte Vinted ».
Puis, capture de Ventes → À envoyer : « Mets ce logo Vinted » (le V turquoise à gauche de la plaque N°).

## La cause du V noir

L'en-tête d'un compte (`src/natif/ecrans/Annonces.jsx`, `n-ad-compte`, et l'intertitre du tableau d'ordinateur
`src/natif/ecrans/AnnoncesTableau.jsx`) dessine `Logo(g.site)`, une fonction passée par
`src/ecrans/AnnoncesEgalite.jsx`. Elle rendait l'ANCIEN `LogoSite` de `src/SelecteurSites.jsx` : la marque en SVG
en ligne, **à la couleur du texte** (`currentColor`, choix du 15 nov. pour le sélecteur de sites — tenu par
`audit-plateformes-logo` A2c), dans une boîte de 1,05 em, plafonnée à 16 px par `.n-eg-compte-logo` ⇒ un V de
**11 × 14 px à l'encre**. Ce n'était pas propre à Monochrome : il était noir (blanc la nuit) dans TOUS les styles ;
en Monochrome l'encre est `#111111`, d'où « tout noir ». Mesuré au banc sur origin/main : `vrm-logo-site`, 11 × 14,
`rgb(17,17,17)` (Monochrome), `rgb(29,29,31)` (défaut), blanc la nuit.

Le V turquoise de Ventes est l'AUTRE composant : `src/natif/LogoSite.jsx` (`.n-logo-site`, masque
`/brands/vinted.svg`, `#007782` le jour, `#2FB4BE` la nuit, 20 px, en `@layer vrm-natif`, non touché par les styles).

## Ce qui change

1. **Le logo** : `AnnoncesEgalite.jsx` passe désormais le `LogoSite` natif, `taille={20}` (`logoDuSite`), à la liste
   ET au tableau ; `.n-eg-compte-logo` passe de 16 à 20 px. C'est exactement le V de Ventes (même classe, même couleur
   calculée, même taille — le banc le compare). Contraste : `#007782` sur `#ECEDF0` (Monochrome) ≈ 4,5:1, sur `#DFE1E5` (défaut) ≈ 4,1:1 ; `#2FB4BE` sur `#0B0B0C`
   ≈ 7,9:1 (≥ 3:1 exigé pour un graphique, WCAG 1.4.11).
2. **La photo de profil** : `AvatarCompte` (`src/natif/visuel/Inventaire.jsx`) — le même rond sur les en-têtes de
   compte, la pilule de compte des filtres et les tuiles d'inventaire (`AvatarsComptes`) — montre la photo du compte
   Vinted, ronde, recadrée (`object-fit: cover`), filet fin (`inset 0 0 0 1px`, 14 % noir / 20 % blanc la nuit),
   `loading="lazy"`, rendue par `PhotoVinted` (règle `audit-photos-vinted`) avec l'initiale en `repli` (cadre
   d'attente, photo perdue) et sur `onError`. L'intertitre du tableau (ordinateur) porte aussi ce rond. Le rond des
   en-têtes passe de 20 à 24 px.
3. **Une seule lecture** : `src/natif/visuel/photosProfil.js` — un magasin (`useSyncExternalStore`) rempli par UNE
   requête projetée, au premier rond monté (rien au démarrage) :
   `id=like.harvest_*_profile&select=id,photo:data->payload->user->photo->>url,pid:data->payload->user->>id`.
   L'écran pose la source une fois, au chargement de son morceau (`poserSourcePhotosComptes({ lire: lireTout, qui:
   session, Photo: PhotoVinted })`). « Pas su » ⇒ `null` ⇒ l'initiale, nouvel essai au plus tôt 60 s après. Une
   photo n'est servie qu'au vendeur qui l'a lue (`qui` comparé à chaque lecture).
4. **Identité (§5)** : la photo d'un compte vient de `harvest_{uid}_profile` du MÊME uid (la clé du rond
   `vinted:{uid}`) ; une ligne dont `payload.user.id` dit un autre compte est écartée ; https seulement ; une ligne
   orpheline n'apparaît nulle part. Jamais par pseudo.
5. **Leboncoin, eBay, Vestiaire** : aucune photo de profil n'est captée aujourd'hui ⇒ l'initiale (`uidPhotoDe` ne
   rend un uid que pour `vinted:`).

## Où le V sort encore à l'encre (même cause, pas touché ici)

L'ancien `LogoSite` de `SelecteurSites.jsx` reste à l'encre par décision du 15 nov. (audit A2c) partout ailleurs :
Messages (`FilsTous.jsx`, en-tête de groupe `vg-ms-logo`, 13 px), Statistiques (`Stats.jsx`, ventes annulées),
« Publier partout / ailleurs », la boîte d'e-mails, `ColisVentesInstantanes`, quelques rangées d'`App.jsx`
(recherche, `MenuPlateformeV2`). Pour les passer en couleur : prendre `src/natif/LogoSite.jsx` (comme ici), pas
colorer `MarquePlateforme` (l'audit l'interdit, et le sélecteur de sites doit rester à l'encre).

## Preuves

- **Banc** `scripts/bancs/logo-vinted-pp.cjs` (lancé comme la CI : `NODE_OPTIONS=--require=scripts/bancs/_garde-reseau.cjs`) :
  Annonces + Ventes, 390 tactile et 1512, clair et sombre, style par défaut et Monochrome. L (logo `n-logo-site`
  Vinted, ≥ 18 px, ≠ encre de ≥ 80, saturé, ≥ 3:1), V (le même que Ventes), P (photo de SON compte, ronde, recadrée,
  paresseuse ; autre uid, http, orpheline, photo en erreur ⇒ initiale), R (une lecture projetée).
  **Après : 77 verts, 0 rouge. origin/main (`BANC_DIST`) : 44 rouges** (L, V, P, R partout ; à 1512 l'intertitre n'a
  pas l'attribut du compte). **Mutation `MUTATION=encre`** (logo repeint à l'encre) : 4 rouges (L, V).
- **Audit** `scripts/audit-photo-profil-compte.cjs --prouve` : la règle EXÉCUTÉE (même uid, autre compte écarté,
  https, clé `vinted:` seulement, projection, l'instantané par vendeur, `PhotoVinted` + repli) ; 6/6 mutations rouges.
- Captures (scratchpad) : `…/scratchpad/logo-pp/avant/`, `…/apres/` (`annonces-*`, `ventes-*`, `tete-*` gros plans) et
  les planches `planche-{monochrome,defaut}-{clair,sombre}-390.png` (Annonces avant · Annonces après · Ventes).
- Audits verts : photos-vinted, style-vintex, variables, tdz, coherence, identite, icones, violet, plateformes-logo,
  traduction, quoi-de-neuf, boutons, couleurs-anciens-ecrans. `stockage-sur` (clés d'index de 5 fichiers que ce lot ne
  touche pas) et `boutons-natifs` (plante : `../i18n/index.js` introuvable dans sa copie) : **identiques sur origin/main**,
  rien ajouté.

## Geste de Julien

Aucun. Si un compte garde l'initiale : ouvrir Vinted connecté sur ce compte (l'extension range `harvest_{uid}_profile`).
