# 16 nov. — La photo d'origine donne le N° (lot `photo-identite-sites`, extension 5.401.0)

Julien, mot pour mot : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la
reconnaît parce que la photo utilisée est exactement la même — pas les autres caractéristiques ».
Puis : « Vinted utilise ça pour éviter qu'on poste des doublons […] je veux les mêmes méthodes que
Vinted » ; puis la correction : « non pas à quoi elle ressemble, mais son CODE » ; puis, sur la piste
du code du fichier d'origine : « vas-y, fais ça au moins ».

## ÉTAT À LA REPRISE

- Branche `claude/photo-identite-sites` (worktree `/home/user/wt/photo-identite-sites`), extension **5.401.0**
  (réservée dans `versions-reservees.txt` ; 5.394–5.400 prises par le train).
- Fait : la règle (`src/photoOrigine.js`), l'identité calculée et superposée aux liens (`src/photoIdentite.js`,
  `liensLbcLus` / `liensVcLus` dans App.jsx), l'extension (page Vinted et Leboncoin + fond), l'écran
  (feuille « Même photo », fiche de la paire), textes 5 langues, Quoi de neuf `photo-identite`, §8/§9.
- Preuves : `scripts/audit-photo-identite.cjs` (tout vert, mutations : voir plus bas),
  `scripts/bancs/photo-identite-seuil.cjs` (vert, 88 s), `scripts/bancs/meme-photo.cjs` (essai O ajouté).
- Geste de Julien : installer l'extension 5.401.0 ; ensuite, chaque paire qu'il met en ligne DEPUIS SON
  CHROME avec l'extension (Vinted puis Leboncoin, avec le même fichier) est reconnue toute seule.
- Ce qui reste (forme jamais vue, rien inventé) : eBay et Vestiaire (le chemin d'envoi de leurs photos
  n'a jamais été vu dans ses captures) ; un autre compte Vinted (la reprise d'un N° sur Vinted passe par
  `repriseNumero`, non touchée).

## 1. Mesuré d'abord (lecture seule, projections, rien recopié)

- **Le code des photos SERVIES ne survit pas d'un site à l'autre.** Les adresses de ses annonces Vinted
  (`harvest_*_listings`) ne servent que des tailles refaites : `f800` (86 adresses lues), `310x430` (21),
  `150x210` (23), `70x100` (21)… ; Leboncoin sert une « règle » par taille (`?rule=ad-large`, `ad-thumb`,
  `ad-private`). Aucune variante « originale » n'est servie : chaque site réencode le fichier téléversé,
  donc le SHA-256 d'une photo servie par Vinted ne peut pas égaler celui d'une photo servie par
  Leboncoin (formats et tailles différents). Le conteneur ne peut pas télécharger ces images (proxy :
  `images1.vinted.net`, `img.leboncoin.fr`, `i.ebayimg.com` refusés) : la mesure octet par octet n'a pas
  pu être faite ; la conclusion vient de la forme des adresses.
- **Sur ses paires réelles : 0 couple mesurable.** La base n'a encore AUCUNE empreinte Vinted ni
  Leboncoin (`photo_emprunte_*` : 0 ligne ; `photo_empreinte_lbc` : absente ; seule `photo_empreinte_ebay`,
  4 annonces) — son Chrome n'a pas l'extension récente. Donc : « sur 0 paire réelle, 0 code identique »,
  avant comme après ce lot ; le chiffre réel viendra après l'installation de la 5.401.
- **Ce que Leboncoin rend à l'envoi d'une photo** (forme lue dans `lbc_catalogue`, valeurs masquées) :
  `POST api/pintad/v1/public/upload/image` ⇒ `{ filename: "<40 hex>.jpg", url: "…/images/xx/yy/zz/<40 hex>.jpg?rule=ad-private" }`.
  Le même nom figure ensuite dans TOUTES les adresses des photos de l'annonce, quelle que soit la taille :
  c'est le lien exact entre « le fichier qu'il a envoyé » et « l'annonce ».
- **Vinted** : `POST /api/v2/photos` (FormData `photo[file]`) ⇒ `{ id }` ; l'annonce est créée par
  `POST /api/v2/item_upload/items` avec `item.assigned_photos: [{ id }]` (déjà connu : republication).

## 2. La règle

- Le **code d'origine** = SHA-256 des octets du fichier qu'il choisit, calculé DANS la page au moment de
  l'envoi (inject.js pour Vinted, lbc-inject.js pour Leboncoin). Aucune requête de plus, le geste n'est
  pas modifié, l'image et son nom ne partent nulle part ; un envoi refusé (non 2xx) ne note rien.
- Le fond (background.js, `noterPhotoOrigineVinted`, `noterAnnoncePhotosVinted`, `noterPhotoOrigineLbc`,
  `rangerOrigineMaintenant`) range :
  `photo_origine_vinted` = `{ annonces: { [itemId]: { codes, compte, at } } }` — seulement les photos
  envoyées par le compte CONNECTÉ dans l'onglet (porte `compteNonCapte`), jamais celles d'un autre compte
  du même Chrome ; `photo_origine_lbc` = `{ images: { [nom]: { code, at } } }`. Lire-fusionner-réécrire,
  une lecture ratée n'écrit rien (la file reste), lignes bornées (4 000).
- L'app (`identitesParCode`) : un code porté par les annonces Vinted d'UN seul N° ⇒ l'annonce Leboncoin
  qui porte ce code PORTE ce N° (identité exacte, aucun geste) ; deux N° ⇒ rien n'est déduit et c'est dit
  (« Même photo sur N°12 et N°40 : laquelle ? », son toucher choisit) ; 3 N° ou plus ⇒ fichier générique,
  ignoré ; une annonce Vinted sans N° ne donne rien ; ses décisions gagnent (lien posé, « délier » = valeur
  vide, « ce n'est pas la même », « pas de paire », référence VRM) ; N° porté par deux paires ⇒ jamais donné.
- **Jamais écrit** : l'identité est calculée à l'ouverture (4 s après, `chargerMemePhoto(false, { sansEbay: true })`,
  lecture seule) et superposée aux liens qu'il a posés (`liensLbcLus()` — 27 lecteurs : N°, « à retirer »
  ailleurs, ventes croisées, bénéfice ; `numerosVcEffectifs`). Toute écriture part de `load('vrm_lbc_liens')`.
  Quand les identités changent, les lecteurs relisent (`EVT_IDENTITES_PHOTO`).
- **Anti double vente** : la vraie règle `aRetirerDeLbcVinted` reçoit les liens lus ⇒ N° vendu sur
  Vinted (preuve) ⇒ l'annonce Leboncoin reconnue est « à retirer » (audit P9).

## 3. La ressemblance (empreinte perceptuelle) — proposition seulement

Avant la correction de Julien, la ressemblance « sûre » (deux mesures) était devenue une identité. Elle
reste construite mais **éteinte** : `IDENTITE_PAR_RESSEMBLANCE = false` (src/photoIdentite.js). Elle ne fait
que PROPOSER (feuille « Même photo · à relier », son toucher relie), comme avant ce lot. Ne pas l'allumer
sans sa décision. Ses règles sont jugées allumées dans l'audit (P1–P8), et R0 vérifie qu'elle est éteinte.

Seuil re-mesuré (`scripts/bancs/photo-identite-seuil.cjs`, jeu inventé : 12 paires dessinées + 21 photos CC0,
12 exemplaires du même modèle photographiés autrement et 12 au même endroit) :

| même photo reprise | A (0–96) | s | r | « sûr » |
|---|---|---|---|---|
| EXIF ajouté (+436 o) / métadonnées retirées | 0 | 1 | 1 | 33/33 · 33/33 |
| JPEG 70 / 50 | 0–2 / 0–3 | ≥ 0,868 | ≥ 0,9991 | 33/33 · 33/33 |
| WebP 80 / 60 | 0–3 / 0–4 | ≥ 0,896 | ≥ 0,9987 | 33/33 · 33/33 |
| ± 10 % de lumière | 0–2 | ≥ 0,839 | ≥ 0,9979 | 32/33 · 33/33 |
| réduite 25 % / 50 % | 0–5 / 0–3 | ≥ 0,729 | ≥ 0,997 | 29/33 · 18/33 |
| moitié + JPEG 60 + WebP 60 | 0–7 | ≥ 0,713 | ≥ 0,9921 | 17/33 |

Autre photo du même article (396 couples) : même modèle ailleurs A 26–55 (jamais candidat) ; au même endroit
A 1–16, s ≤ 0,699 (seuil 0,85), r ≤ 0,989 (seuil 0,998) ⇒ **0 « sûr »**. Recompression seule : 99,5 % « sûr ».
`--mutation=une` (sûr sur l'empreinte seule) doit rougir I1.

## 4. L'écran

- Feuille « Même photo » : section « N annonces reconnues par la photo » ; une carte « Photo d'origine
  identique · N°125 » (diode, ton neutre, rien à faire) avec « Ce n'est pas la même » ; une ambiguïté du code
  montre les deux N° (« C'est N°300 »). La limite est écrite en bas : « Photo d'origine : le même fichier envoyé
  depuis ton Chrome avec l'extension. Publiée depuis une appli mobile, VRM ne la voit pas. »
- Fiche de la paire : « Aussi sur Leboncoin · reconnue par la photo d'origine » (la limite en titre de la ligne).
- Vestiaire : défaire une liaison reconnue par la photo note « ce n'est pas la même » (sinon elle reviendrait).

## 5. Preuves

- `node scripts/audit-photo-identite.cjs` — R0, C1–C9 (code), P1–P9 (ressemblance si allumée, anti double vente
  par la vraie règle d'App.jsx), E1–E5 (la VRAIE page inject.js / lbc-inject.js dans un vm : SHA-256 = celui des
  octets, aucune requête de plus, 403 ⇒ rien ; le VRAI fond dans `_fond-vm` : lignes rangées, autre compte ⇒ rien,
  lecture ratée ⇒ rien écrit), S1 (jamais écrit, lecteurs branchés). Sur l'arbre d'avant : rouge (P0 :
  `src/photoIdentite.js` absent). Mutations `--mutation=toutes` : **23/23 rouges** (proche, ambigu, generique, manuel, delier, vcnumero, ebay, passu, sansReconnues, ecrit, demarrageEbay, lecteurs, codeDeuxPaires, codeGenerique, codeDelier, codeRefus, codePasSu, codeDouteux, ressemblanceAllumee, fondAutreCompte, fondLecture, pageRefus, compte).
- `scripts/bancs/photo-identite-seuil.cjs` — I1–I4 verts.
- `scripts/bancs/meme-photo.cjs` — essai O (390 et 1512) : O1 reconnue sans geste, O2 ambiguïté dite, O3 la
  ressemblance reste une proposition, O4 limite dite, O5 rien écrit, O6 la fiche N°125.
- `audit-meme-photo` porté sur la règle (le calcul LIT les liens posés ; `numerosVcEffectifs` lit `liensVcLus`).
