# 15 nov. — « Même photo · à relier » (branche `claude/meme-photo`, extension 5.384.0)

Julien : « quand je poste une paire sur Vinted et que je la poste après sur Leboncoin sans avoir dit
que c'était la même, je veux que VRM propose que c'est exactement la même — on ne parle pas du tout
de titre, mais vraiment exactement la même photo ».

## Mesuré avant de coder

| pièce | ce qui existait |
|---|---|
| Empreinte | `src/photoEmpreinte.js` (11 nov., lot photos-comptes) : dHash 9×8 + pHash (DCT 32×32, bloc 8×8 contre sa médiane), chacun sur l'image entière et recadrée de 4 % et 8 % ⇒ 6 × 64 bits = 96 hex. Distance = meilleur dHash + meilleur pHash / 2 (0…96). `SEUIL_PHOTO = 16`. Image dessinée en 64 × 64 (`COTE_EMPREINTE`) avant le calcul ; image uniforme ⇒ `null`. |
| Extension | `tickEmpreintes` (5.358) : Vinted seulement, une image par tour, 45 s d'écart, budget de LECTURE classe « photos », `credentials:'omit'`, rangé dans `photo_emprunte_{uid}` (`payload.annonces[id][clé] = hex`). |
| Chez Julien (base de prod, SELECT seuls) | **0 ligne `photo_emprunte_*`** : son Chrome est en 5.329, l'iPhone en 5.368 ; aucune empreinte n'a encore été calculée. `lbc_listings` : 186 annonces, dont 126 sans compte (vues en septembre seulement), 60 avec compte — **49 d'AUTRES vendeurs** (vues en naviguant), **11 des siennes** (2 comptes Leboncoin avec session) ; 4 portent une référence. `ebay_listings` : 4 annonces. `vc_listings` : 3. Photos Leboncoin sur `img.leboncoin.fr`. |
| Liens existants (identité §5) | Leboncoin `vrm_lbc_liens` = { annonce: N° } (lu par `numeroLbcIdentite`, `clesAnnonceLbc`, `adRefKeys` de l'extension) ; eBay `vrm_ebay_liens` = { itemId: { pairId (annonce Vinted), numero, at, par } } (lu par `lienEbay` → `numEbayLu`) ; Vestiaire `vrm_vc_liens` (`poserLienVc`, src/lienVestiaire.js, lu par `numerosVcEffectifs`). Le retrait ailleurs (`articlesVendusAilleurs`, branche `claude/retrait-ailleurs`) lit ces trois-là. |

## L'algorithme et le seuil

Aucun changement de la règle d'empreinte (le bloc `<empreinte-photo-regle>` recopié dans l'extension
reste identique) : la même empreinte sert Vinted, Leboncoin, eBay et Vestiaire.

Seuil **re-mesuré** avec le passage par un autre site (`scripts/bancs/photos-comptes-seuil.cjs`,
8 paires × 6 prises de vue inventées, 15 transformations dont **WebP 80, WebP 60, réduite 50 % + JPEG 60
+ WebP 60, vignette au quart**), plus « 50 paires IDENTIQUES » : 100 prises de vue DIFFÉRENTES du même
modèle dessiné.

| mesure (15 nov., Chromium du banc) | distance |
|---|---|
| même photo, toutes transformations (720) | **≤ 11** (recadrage 6 % / 5 % d'un côté : 11 ; JPEG 30 : 7) |
| même photo passée par un autre site (WebP 80 · WebP 60 · moitié+JPEG 60+WebP 60 · vignette) | **8 · 6 · 9 · 8** |
| deux photos différentes de la même paire (120) | ≥ 23 |
| deux paires différentes (1 008) | ≥ 19 |
| 100 prises de vue du même modèle, 4 950 couples | **≥ 15** (15 : 2 couples, 16 : 1, 17 : 4) |

⚠️ **Le seuil de l'alerte entre comptes (`SEUIL_PHOTO = 16`) ne convient PAS pour proposer une
liaison** : à 16, trois des « 50 paires identiques » recevaient une proposition fausse (15, 15, 16).
D'où **`SEUIL_MEME_PHOTO = 12`** dans `src/memePhoto.js` : la photo réutilisée (≤ 11) passe, une autre
photo de la même paire (≥ 15) jamais. L'alerte entre comptes garde 16 (prévenir de trop y est le bon
côté). Une distance = meilleur dHash + meilleur pHash / 2 sur les 3 × 3 combinaisons de recadrage.

## Ce qui est livré

- **Règle pure** `src/memePhoto.js` (`propositionsMemePhoto`, `duSite`) : pour chaque annonce
  Leboncoin / eBay / Vestiaire SANS identité, chaque photo est comparée à toutes les photos connues
  (distance en mots de 32 bits, égale à `distanceEmpreintes`). Une photo vue sur plus de 6 annonces
  ou sur 3 paires et plus = générique, ignorée. Une paire (N° de fiche Vinted) ⇒ proposition ; deux
  ⇒ AMBIGU (les deux montrées, il choisit) ; N° porté par deux paires ⇒ « à vérifier » ; annonce
  Vinted sans N° ⇒ rien. « Ce n'est pas la même » (`vrm_meme_photo_non`, SYNC_KEYS, clé
  `Site:annonce|N°`) ⇒ le couple ne revient plus. Aucun titre, marque, taille, prix.
- **Extension 5.384.0** (`empreintesSitesUnTour`, après Vinted dans `tickEmpreintes`) : Leboncoin et
  Vestiaire, seulement les annonces du compte CONNECTÉ dans un onglet de ce site (`ongletImpSite`),
  une image par tour, 45 s, `credentials:'omit'`, ≤ 900 Ko, budget de LECTURE du compte sur le site
  (`compterLecture('leboncoin:<compte>', 8)` : les photos s'arrêtent à 8 des 20 lectures/h, l'import
  garde le reste), anti-robot / pauses respectés, 403/429 du site des images ⇒ 24 h sans empreinte
  pour ce site (Vinted jamais en pause), couverture puis 2 suivantes (Leboncoin). Rangé dans
  `photo_empreinte_lbc` / `photo_empreinte_vc` (lire-fusionner-réécrire, lecture ratée ⇒ rien écrit,
  annonce plus en vente ⇒ sortie). **Aucun droit d'hôte de plus** (Vestiaire : couvert par les
  `content_scripts` déjà déclarés).
- **eBay dans la page** (`empreintesEbayPage`) : `img.crossOrigin='anonymous'` + canvas 64 × 64,
  une à la fois, 1,5 s, 30 par ouverture, sans lien d'abord ; `photo_empreinte_ebay`. Une image que
  le navigateur refuse de lire (CORS) ⇒ « pas vérifiée », jamais une erreur.
- **App** (`chargerMemePhoto`, publié par `src/memePhotoEtat.js`) : projections seulement ; Leboncoin
  limité à SES comptes (`lbc_accounts` avec session) ou aux annonces qu'il a reliées.
  · Ma journée : carte ambre `meme-photo` (« 3 annonces à relier · Même photo que sur Vinted ·
    Leboncoin · eBay · Vestiaire »), catalogue `journeePerso.js`, comptée dans « N gestes » ;
  · Annonces → Leboncoin / eBay / Vestiaire : une ligne compacte « N annonces à relier » (rien s'il
    n'y en a pas), qui ouvre la feuille du site ;
  · Annonces → Outils : « Même photo · à relier » ;
  · la fiche de la paire (l'autre sens) : « Même photo sur Leboncoin · à relier » ;
  · la feuille (`src/MemePhoto.jsx`, studio : `sb-touche` / `sb-lien`, aucun plein) : les deux photos
    côte à côte, « Relier à N°124 » et « Ce n'est pas la même » ; ambigu : chaque paire avec « C'est
    N°300 », « Aucune de celles-là ».
- **Relier** (`relierParPhoto`) = SON toucher : Leboncoin `vrm_lbc_liens[annonce] = N°` et eBay
  `vrm_ebay_liens[itemId] = { pairId, numero, par: 'photo' }` par `gesteVrm` (annulable 5 s) ;
  Vestiaire par `relierVc` (sa confirmation « Un seul N° », N° VRM d'avant à barrer). Le N° posé est
  celui de la fiche Vinted, tel quel : un N° d'avant la remise à zéro (B…) reste le sien,
  `numeroExterne` n'est pas touché. Le retrait ailleurs, les ventes croisées et la garde des offres
  voient la liaison sans rien changer chez eux.
- Textes `memePhoto.*` en 5 langues, « Quoi de neuf » `meme-photo`, `EXT_CAPACITES.memephoto =
  5.384.0` (audit-coherence : `empreintesSitesUnTour`), `MIGRES` de audit-studio.

## Preuves

- `scripts/audit-meme-photo.cjs` — 38 verts (règle exécutée : 50 paires identiques ⇒ 0 proposition,
  la seule photo reprise ⇒ N°217 ; deux paires ⇒ ambigu ; logo sur 8 annonces / fond sur 3 paires ⇒
  ignoré ; reliée ⇒ rien ; lecture ratée ⇒ `lu:false` ; refus ; N° double ; sans N° ; Relier = les liens
  existants ; Leboncoin limité à ses comptes ; extension dans `_fond-vm` : une image, sans cookie,
  compte de l'onglet, budget 8/20, écart 45 s, Vinted d'abord, verrou levé, lecture ratée ⇒ rien
  écrit, 429 ⇒ frein du site). `--mutation=toutes` : **13/13 rouges** (seuil, ambigu, generique,
  relie, refus, douteux, passu, budget, onglet, cookie, lecture, verrou, ecart).
- `scripts/bancs/photos-comptes-seuil.cjs` : S1–S7 verts ; `--mutation=seuil` (alerte 30, proposition
  16) ⇒ S2, S3, S6, S7 rouges.
- `scripts/bancs/meme-photo.cjs` (390 tactile, 1512, clair et sombre) : 95 verts. Ma journée (carte
  ambre, 3), la feuille (2 propositions, 1 ambiguë, photos chargées côte à côte, gestes ≥ 44 px),
  Relier ⇒ `vrm_lbc_liens[5001] = 124`, « Ce n'est pas la même » ⇒ noté, Annonces → Leboncoin (ligne
  compacte ⇒ feuille du site), lecture ratée ⇒ « pas lues ». Captures regardées.
- Défaut trouvé par `audit-photos-comptes` (rouge après le premier jet) : le `finally` qui lève le
  verrou du tour ne couvrait plus que la branche « autres sites » ⇒ après une image Vinted, 3 min sans
  empreinte. Corrigé, contrôle E4 + mutation `verrou` ajoutés.
- Gardés verts : build, audits identite, coherence, extension-zip, traduction, tdz, variables, studio,
  csp, budget-lectures, photos-comptes, quoi-de-neuf.

## Ce qui reste à vérifier sur ses vraies annonces

1. **Aucune empreinte n'existe encore chez lui** : il faut l'extension 5.384 dans SON Chrome, un
   onglet vinted.fr et un onglet leboncoin.fr ouverts (sur chacun de ses comptes) ; à 8 images/h par
   compte Leboncoin, ses 11 annonces sont lues en ~2 h d'onglet ouvert.
2. **Leboncoin recompresse-t-il plus fort que le jeu inventé ?** Le banc couvre WebP 60 + moitié ;
   regarder sur 3-4 de ses vraies paires la distance (Ma journée doit proposer ; sinon, mesurer les
   distances sans rien ranger de réel dans le dépôt).
3. **eBay** : la page lit-elle les photos `i.ebayimg.com` (CORS) ? Si « N annonces pas encore
   vérifiées » ne baisse jamais côté eBay, il faut l'extension (droit d'hôte `i.ebayimg.com`, qui
   demanderait son accord à la mise à jour : pas fait).
4. **Vestiaire** : le droit d'hôte vient des `content_scripts` ; si l'image est refusée
   (`empreintes_sites_image_refusee_vc_*` dans le diagnostic), ajouter l'hôte au manifeste.
5. Une photo qu'il réutilise volontairement (sa boîte, son fond) sur 2 paires : ambiguë, montrée ;
   sur 3 et plus : ignorée.
