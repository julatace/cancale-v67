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

__TABLEAU__

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

__PREUVES__

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
