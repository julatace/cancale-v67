# 15 nov. — « Même photo · sûr » (branche `claude/meme-photo-sure`, extension 5.388.0)

Julien : « Est-ce que tu peux faire la reconnaissance d'image et que ça soit parfaitement fiable ? »

Ce qu'on reconnaît : **la même photo** (le même fichier, recompressé, réduit, recadré de quelques px,
bordé de bandes, éclairci par un autre site). Ce qu'on ne fait **pas** : « la même chaussure sur une
autre photo » — avec 50 paires identiques, impossible à rendre sûr (§2.4, §5) ; pas construit.
« Sûr » PROPOSE ; relier reste TOUJOURS son toucher (rien n'est relié tout seul, même « sûr »).

## Ce que la mesure a montré AVANT de coder

- **Base de prod (SELECT seuls, 15 nov. 18 h)** : **0 ligne** `photo_emprunte_*` / `photo_empreinte_*`
  (aucun propriétaire) — aucune empreinte n'a encore été calculée chez personne (son Chrome est en
  5.329). Rien à mesurer sur ses vraies photos ; aucune image réelle copiée.
- **CORS, mesuré** : `images1.vinted.net` répond **sans** `Access-Control-Allow-Origin` ⇒ la page VRM ne
  peut pas lire les pixels d'une photo Vinted : la deuxième mesure se fait dans l'EXTENSION.
  Leboncoin / Vestiaire / eBay : non mesurables depuis le conteneur (le proxy refuse ces hôtes).
  L'extension a l'hôte `*.leboncoin.fr`, Vestiaire par ses `content_scripts`, **pas** `i.ebayimg.com`
  ⇒ un couple eBay reste « à vérifier » (dit : « eBay : une seule mesure possible »).
- **L'empreinte seule (dHash + pHash 64 bits sur 64 × 64) n'est PAS sûre** : un jeu plus dur que celui du
  lot meme-photo — **50 exemplaires du même modèle photographiés AU MÊME ENDROIT** (même fond, même
  grain du mur, même lumière, posés à ± 15 px, ± 2°, ± 2 %, usure propre à chaque exemplaire :
  `scripts/bancs/_photos-inventees.cjs`, `vueStudio`, `usure`) — tombe à une distance **0 à 12** sur
  1 088 / 1 225 couples (et 1 223 / 1 225 pour un second modèle) : le lot d'avant les aurait PROPOSÉS
  (au mieux « ambigus » / « génériques » grâce aux garde-fous, mais une seule reprise au même endroit
  aurait pu tomber sur la mauvaise paire).
- Essais écartés (mesurés, dans le banc d'exploration) : corrélation 32 × 32 stockée (0,997 entre deux
  exemplaires au même endroit, ≥ la même photo recompressée) ; corrélation 128 × 128 seule (0,996 /
  TP ≥ 0,967 : chevauchement) ; écart par case sans flou égalisé (une copie réduite de moitié
  ressemble alors à une autre prise de vue).

## La méthode retenue

Deux mesures **d'une nature différente**, la seconde prise **sur les deux images elles-mêmes** :

1. **A · l'empreinte** (inchangée, `src/photoEmpreinte.js`) : le CANDIDAT (≤ 12, `SEUIL_MEME_PHOTO`).
2. **B · la mesure fine** (`src/photoFine.js`, bloc `<photo-fine-regle>` recopié dans l'extension par
   `node scripts/audit-meme-photo.cjs --recopie`) : l'image lue à 512 px au plus, bandes unies retirées
   (variante entière ET variante rognée, la meilleure gagne), niveaux de gris centrés-réduits sur
   128 × 128 et 256 × 256 ; **recalage** (échelle 0,96–1,04 par axe, décalage ± 2 sur 16 × 16, affiné
   sur 32, 128 puis 256 au ¼ de pixel) ; puis **deux nombres** :
   - `r` = la corrélation de toute l'image recalée (128 × 128) ;
   - `s` = 1 − l'écart moyen des **10 % de cases les plus mal superposées** (8 × 8 cases sur 256 × 256),
     après **flou égalisé** (la plus nette des deux floutée de 0 à 1,5 px, le plus petit écart gardé :
     une copie réduite est plus floue que l'original ; une autre prise de vue ne s'efface pas en
     floutant — sa pose, ses plis, son ombre ne tombent pas au même endroit).
3. **Trois états** (`etatCouple`, src/memePhoto.js) :
   - **« Même photo · sûr »** : A ≤ 10 (`SEUIL_EMPREINTE_SUR`) **ET** s ≥ 0,85 **ET** r ≥ 0,998 ;
   - **« À vérifier »** : une seule mesure (pas encore mesuré, eBay, image trop petite — contenu < 96 px),
     ou l'une proche de son seuil (A 11–12, s ou r sous le seuil sûr) — montré avec les deux photos côte
     à côte, **jamais compté sûr** ;
   - **écarté** : s < 0,35 (nettement pas la même photo) ; le couple ne compte plus (ni proposition, ni
     « générique », ni « ambigu »).
   Un cas AMBIGU (deux paires) n'est jamais « sûr », même si l'une de ses paires l'est : il choisit.
4. **Où** : l'extension 5.388 (`verifFineUnTour`), seulement pour les couples candidats
   (`couplesAVerifier` : une photo Leboncoin / Vestiaire à ≤ 12 d'une photo Vinted ; photo proche de plus
   de 8 annonces Vinted = logo / fond, ignorée ; 60 couples au plus par plan). Les deux images dans le
   même tour : onglet vinted.fr ouvert (compte connecté, pause / frein, budget de lecture « photos »,
   file Vinted) ET onglet du compte sur son site (anti-robot, pauses, budget de lecture du compte, les
   8 des 20 des empreintes) ; sans cookie ; 6 couples / h ; 45 s ; un couple raté repris après 24 h.
   Rangé : `photo_meme_verif` = `{ couples: { "lbc|<annonce>|<photo>#<uid>|<annonce Vinted>|<photo>": { s, r, v, at } } }`
   — deux NOMBRES, jamais l'image. Lire-fusionner-réécrire (lecture ratée ⇒ rien écrit, la file reste).
   L'app lit cette ligne par projection (`c:data->payload->couples`) ; ligne absente ⇒ tout « à vérifier ».

## Le tableau de fiabilité

`scripts/bancs/meme-photo-fiabilite.cjs` (15 nov., Chromium du banc, 3 276 s, `BANC_TRANCHES=4 BANC_ONGLETS=3`) —
jeu INVENTÉ : **200 paires dessinées + les 21 vraies photos CC0 du mode exemple**, **50 exemplaires du même
modèle photographiés différemment**, **2 × 50 exemplaires du même modèle photographiés AU MÊME ENDROIT**,
63 « prises de vue bougées » des photos CC0 ; chaque photo passée par les 17 transformations du cahier.
**3 907 vrais couples, 84 018 faux couples** (chaque exemplaire contre les autres : original ET copie
transformée — ce que montrerait Leboncoin).

**Faux positifs « sûr » : 0 / 84 018** (dont 6 256 candidats de l'empreinte, tous mesurés finement).

Vrais couples (la même photo passée par un autre site) :

| transformation | n | A (empreinte) | s | r | sûr | à vérifier | écarté | pas candidat (A > 12) |
|---|---|---|---|---|---|---|---|---|
| JPEG 70 | 230 | 0–4 | 0,910–0,987 | 0,9996–1 | **230** | 0 | 0 | 0 |
| JPEG 50 | 230 | 0–6 | 0,868–0,982 | 0,9991–1 | **230** | 0 | 0 | 0 |
| WebP 80 | 230 | 0–5 | 0,925–0,985 | 0,9994–1 | **230** | 0 | 0 | 0 |
| WebP 70 | 230 | 0–5 | 0,918–0,981 | 0,9990–1 | **230** | 0 | 0 | 0 |
| WebP 60 | 230 | 0–7 | 0,896–0,979 | 0,9987–1 | **230** | 0 | 0 | 0 |
| plus claire 10 % | 230 | 0–5 | 0,839–0,987 | 0,9979–1 | **228** | 2 | 0 | 0 |
| plus sombre 10 % | 230 | 0–3 | 0,927–0,989 | 0,9997–1 | **230** | 0 | 0 | 0 |
| réduite de 25 % | 230 | 0–8 | 0,787–0,975 | 0,9988–1 | **226** | 4 | 0 | 0 |
| réduite de 50 % | 230 | 0–4 | 0,729–0,958 | 0,9970–1 | **211** | 19 | 0 | 0 |
| moitié + JPEG 60 + WebP 60 | 230 | 0–8 | 0,713–0,940 | 0,9921–0,9997 | **201** | 29 | 0 | 0 |
| bande d'un côté (4 %) | 230 | 1–13 | 0,552–0,979 | 0,9924–1 | **202** | 27 | 0 | 1 |
| bandes noires (6 %) | 230 | 1–14 | 0,755–0,979 | 0,9948–1 | **166** | 61 | 0 | 3 |
| recadrée de 4 px tout autour | 230 | 0–8 | 0,687–0,939 | 0,9825–0,9992 | 52 | 178 | 0 | 0 |
| recadrée d'un côté (12 px) | 230 | 0–8 | 0,425–0,925 | 0,9651–0,9989 | 12 | 218 | 0 | 0 |
| mise au carré (bandes blanches) | 230 | 0–30 | 0,856–0,986 | 0,9992–1 | 24 | 3 | 0 | 203 |
| recadrée + carré + claire + moitié + WebP 65 | 227 | 0–30 | 0,666–0,923 | 0,9882–0,9977 | 0 | 26 | 0 | 201 |
| vignette (un quart) | 230 | 0–5 | 0,652–0,916 | 0,9778–0,9993 | 108 | 122 (2 « pas su ») | 0 | 0 |

- **Vrais positifs « sûr »** : **2 702 / 3 677 = 73,5 %** (vignettes à part) ; **recompression seule
  (JPEG 50–70, WebP 60–80, ± 10 % de lumière) : 1 608 / 1 610 = 99,9 %**. Les candidats de l'empreinte :
  88,9 % ; un candidat qui n'est pas « sûr » reste **« à vérifier »** (montré, il tranche). **Aucun vrai
  positif écarté** par la mesure fine. Ce qui reste « à vérifier » : surtout le recadrage d'un côté et
  tout autour (le recalage n'est jamais parfait au pixel), la mise au carré et la chaîne complète (déjà
  hors de portée de l'empreinte : A jusqu'à 30).
- **Faux couples** (deux photos différentes) :

| famille | n | A | s | r | sûr | à vérifier | écarté | rien |
|---|---|---|---|---|---|---|---|---|
| 221 paires distinctes entre elles | 24 310 | 13–68 | — | — | 0 | 0 | 0 | 24 310 |
| … contre la copie « autre site » d'une autre | 48 620 | 12–68 | 0,000 | 0,8041 | 0 | 0 | 1 | 48 619 |
| photo CC0 « bougée » (autre prise de vue) | 63 | 3–26 | 0,000–0,578 | 0,8209–0,9749 | 0 | 12 | 28 | 23 |
| 50 du même modèle, prises différentes | 1 225 | 17–64 | — | — | 0 | 0 | 0 | 1 225 |
| … contre une copie transformée | 2 450 | 17–65 | — | — | 0 | 0 | 0 | 2 450 |
| 50 au même endroit (modèle A) | 1 225 | **0–23** | 0,000–0,702 | 0,8927–0,9911 | **0** | 793 | 281 | 151 |
| … contre une copie transformée | 2 450 | 1–31 | 0,000–0,726 | 0,5067–0,9917 | **0** | 1 328 | 405 | 717 |
| 50 au même endroit (modèle B) | 1 225 | **0–13** | 0,376–0,793 | 0,9586–0,9963 | **0** | 1 223 | 0 | 2 |
| … contre une copie transformée | 2 450 | 0–23 | 0,000–0,797 | 0,9166–0,9963 | **0** | 2 169 | 16 | 265 |
| **TOUS** | **84 018** | 0–68 | 0,000–**0,797** | 0,507–**0,9963** | **0** | 5 525 (6,6 %) | 731 | 77 762 |

- **Marge** : chez les 6 256 faux couples mesurés, `s` ≤ 0,797 (seuil 0,85) et `r` ≤ 0,9963 (seuil
  0,998) ; **aucun** n'a les deux au-dessus.
- **Faux « à vérifier »** : 5 525 / 84 018 = 6,6 %, presque tous dans le cas extrême « même modèle, même
  endroit » — montrés avec les deux photos, jamais comptés sûrs. Dans le monde complet, ils deviennent
  « génériques » (photo proche de 3 paires et plus) ou « ambigus », jamais une proposition seule.
- **Le monde complet** (la vraie règle `propositionsMemePhoto` + la vraie sélection de l'extension
  `couplesAVerifier`) : « 50 au même endroit, aucune reprise » ⇒ 0 proposition (22 génériques) ;
  « 6 au même endroit + 1 reprise » ⇒ 0 « sûr » faux, et la reprise n'est PAS reconnue (photo proche de
  5 paires ⇒ générique : mieux vaut un blanc qu'un faux) ; « 221 paires distinctes, 110 reprises » ⇒
  **56 « sûr » vrais, 0 faux** (60 couples mesurés : le plafond d'un plan de l'extension, les autres au
  plan suivant, 3 h plus tard) ; « même modèle, autres prises de vue » ⇒ rien.
- **Sur ses vraies photos** : impossible aujourd'hui — 0 empreinte en base (SELECT du 15 nov.).

## Ce que Julien voit

- **La feuille « Même photo · à relier »** : chaque proposition porte son état en tête —
  **« Même photo · sûr »** (diode bleue, texte encre) ou **« À vérifier · Une seule mesure : regarde les
  deux photos »** (point ambre, texte ambre ; raisons : une seule mesure · très proche, pas certain ·
  ressemble, pas certain · eBay : une seule mesure possible). Les deux photos restent côte à côte ; les
  gestes ne changent pas : « Relier à N°124 » / « Ce n'est pas la même ». Un cas ambigu montre l'état de
  chaque paire (pour l'aider à choisir), jamais « sûr » au total.
- **Ma journée** : la carte « 3 annonces à relier » dit « … · 1 sûre · 2 à vérifier ».
- Tant que l'extension n'est pas en 5.388 : « L'extension 5.388 confirme « sûr » : mets-la à jour. En
  attendant, tout est « à vérifier ». »
- Textes en 5 langues (`memePhoto.sur`, `.aVerifier`, `.pourquoi.*`, `.nSurs`, `.nAVerifier`,
  `.extensionSure`, `.aideSure`), « Quoi de neuf » `meme-photo-sure`.

## Preuves

- `scripts/bancs/meme-photo-fiabilite.cjs` — **vert** sur le jeu complet (F1 0 faux « sûr » sur 84 018 ;
  F2 recompression 99,9 % ; F3 aucun vrai positif écarté ; F4 « pas su » jamais sûr ; F5 monde complet
  0 faux ; F6 marge). Sur l'arbre de départ (`git archive f782040f`) : **rouge** (F0 : « sûr » n'existe
  pas). Mutations (jeu réduit `BANC_PAIRES=8 BANC_FAMILLE=12`) : `--mutation=une` (sûr sur l'empreinte
  seule) ⇒ **328 faux « sûr »**, `--mutation=fine` (seuils s 0,5 / r 0,9) ⇒ **214 faux « sûr »** : rouges (F1). `BANC_CACHE=<dossier>` reprend
  une mesure interrompue (un onglet tombé est relancé).
- `scripts/audit-meme-photo.cjs` — tout vert (R0–R7, E1–E7, F0–F6, C1–C2). F : la mesure fine EXÉCUTÉE
  (même image ⇒ sûr, réduite ⇒ jamais écartée, autre ⇒ non, vignette ⇒ pas su), seuils épinglés à ceux
  du banc, `etatCouple` (10 cas), la règle avec `verifs` (sans mesure ⇒ à vérifier ; deux mesures ⇒ sûr ;
  entre ⇒ à vérifier ; contraire ⇒ écarté ; mesure d'un AUTRE couple ⇒ jamais sûr ; ambigu jamais sûr ;
  la fine écarte l'une de deux paires ⇒ l'autre seule), 6 paires au même endroit ⇒ 0 sûr, §5 (relier
  seulement sur `onRelier`, règles sans écriture). E7 : l'extension VRAIE (`_fond-vm`) — deux images dans
  le même tour, sans cookie, `photo_meme_verif` = { s, r } (jamais l'image), budgets des deux comptes,
  45 s, onglet du compte exigé, sans compte Vinted rien, plafond 6/h, lecture ratée ⇒ rien écrit.
  Sur l'arbre de départ : **rouge** (src/photoFine.js absent). `--mutation=toutes` : **26/26 rouges** (13 du lot meme-photo + 13 de la deuxième mesure : sureSeule, sureSansEmpreinte, sureSansCorrel, fineFaible, correlFaible, ecartFin, ambiguSur, relierSeul, fineCookie, fineBudget, fineOnglet, fineLecture, finePlafond).
- `scripts/bancs/meme-photo.cjs` (390 tactile, 1512, clair, sombre) — **115 verts** : la VRAIE mesure
  fine calculée sur les images du banc (P1 ~ P1 passée par un autre site : s 0,8848, r 0,9993) ⇒
  Leboncoin 5001 « Même photo · sûr », eBay 2001 « À vérifier · eBay : une seule mesure possible »,
  couleurs différentes (encre / ambre), jamais le rouge ; la feuille compte 1 sûr ; Ma journée « 1 sûre ·
  2 à vérifier » en tête ; tout le reste du lot meme-photo inchangé (Relier, Ce n'est pas la même,
  ambigu, ligne Leboncoin, lecture ratée). Captures regardées (la raison sur sa ligne, « sûr » d'abord,
  état court dans un choix ambigu : corrigés après la première série).
- Gardés verts : build, audits identite, traduction, tdz, variables, studio, csp, coherence
  (`memephotosure: 'verifFineUnTour'`), extension-zip, ext-boutique, extension-navigateurs,
  quoi-de-neuf, photos-comptes, budget-lectures.
- Extension **5.388.0** (5.386 / 5.390 / 5.392 prises par d'autres branches, 5.388 vérifiée libre) :
  `CODE_VERSION`, manifeste, `EXT_ATTENDUE`, capteur et relais Leboncoin, `public/extension-version.json`,
  `EXT_CAPACITES.memephotosure`, zips régénérés une fois après le merge de `origin/main` et
  `origin/claude/project-review-nsk5su`.

## Ce qui reste à vérifier sur ses vraies annonces

1. **Aucune empreinte n'existe encore chez lui** (0 ligne) : il faut l'extension **5.388.0** dans son
   Chrome, un onglet vinted.fr ET un onglet leboncoin.fr ouverts sur le compte ; à 6 couples / h, une
   dizaine d'annonces reprises sont vérifiées en ~2 h.
2. **La vraie recompression de Leboncoin / Vestiaire** : le jeu couvre JPEG 50–90, WebP 60–80, −25 / −50 %,
   bandes, recadrage. Si une reprise réelle reste « à vérifier », lire `s` / `r` dans `photo_meme_verif`
   (SELECT, sans rien copier) : c'est la mesure, pas une impression.
3. **eBay** : jamais « sûr » tant que l'extension n'a pas l'hôte `i.ebayimg.com` (ajout = son accord à
   la mise à jour : pas fait).
4. **Photos plus petites que 96 px** (vignettes) : « pas su », donc « à vérifier ».
