---
name: VRM
description: L'outil de gestion du revendeur de sneakers — un outil pro calme, à la manière des apps d'Apple.
colors:
  fond: "#F2F2F7"
  carte: "#FFFFFF"
  case: "#F2F2F7"
  encre: "#1D1D1F"
  gris: "#6E6E73"
  filet: "rgba(60,60,67,.18)"
  remplir: "rgba(118,118,128,.12)"
  remplir-fort: "rgba(118,118,128,.20)"
  accent: "#0071E3"
  accent-texte: "#0066CC"
  ambre-texte: "#B25000"
  ambre-point: "#FF9F0A"
  ambre-fond: "#FFF4E5"
  doublon: "#D70015"
  carte-sombre-haut: "#1F3A5F"
  carte-sombre-bas: "#1D1D1F"
  nuit-fond: "#000000"
  nuit-carte: "#1C1C1E"
  nuit-case: "#2C2C2E"
  nuit-encre: "#F5F5F7"
  nuit-gris: "#98989D"
  nuit-accent: "#0A84FF"
  nuit-accent-texte: "#409CFF"
  nuit-ambre-texte: "#FFB340"
  nuit-doublon: "#FF6961"
typography:
  grand-titre:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  grand-chiffre:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  titre-section:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  titre-rangee:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.012em"
  texte:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.006em"
  note:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  legende:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  num: "6px"
  ctrl: "12px"
  case: "14px"
  carte: "20px"
  sombre: "24px"
  pilule: "999px"
spacing:
  e-1: "4px"
  e-2: "8px"
  e-3: "12px"
  e-4: "16px"
  e-5: "20px"
  e-6: "24px"
  e-8: "32px"
  e-10: "40px"
components:
  bouton-primaire:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.carte}"
    rounded: "{rounded.ctrl}"
    height: "44px"
    padding: "0 16px"
  bouton-secondaire:
    backgroundColor: "{colors.remplir}"
    textColor: "{colors.encre}"
    rounded: "{rounded.ctrl}"
    height: "44px"
    padding: "0 16px"
  bouton-pilule:
    backgroundColor: "{colors.remplir}"
    textColor: "{colors.encre}"
    rounded: "{rounded.pilule}"
    height: "44px"
    padding: "0 16px"
  carte:
    backgroundColor: "{colors.carte}"
    rounded: "{rounded.carte}"
    padding: "16px"
  carte-sombre:
    backgroundColor: "{colors.carte-sombre-bas}"
    textColor: "{colors.carte}"
    rounded: "{rounded.sombre}"
    padding: "20px"
  segmente:
    backgroundColor: "{colors.remplir}"
    textColor: "{colors.encre}"
    rounded: "{rounded.ctrl}"
    height: "50px"
  numero:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.carte}"
    rounded: "{rounded.num}"
    padding: "1px 7px"
---

# Design System : VRM

## Overview

**Étoile du nord : « Le carnet de l'atelier »** — l'outil qu'on garde ouvert à côté des cartons : il dit le prochain geste, il ne crie jamais, et chaque chiffre se vérifie.

VRM est un outil de travail (mode **Operate**) : Julien y revient vingt fois par jour, au point relais sur iPhone comme devant Chrome pour imprimer. Le système suit les apps d'Apple qu'il a choisies (Réglages, Mail, Wallet, Rappels) : fond groupé gris très clair, cartes blanches sans cadre, encre presque noire, un seul bleu — rare — pour l'action principale. La couleur est une information, jamais une décoration : **ambre** = un geste à faire, **rouge** = deux paires sous un même N° (le seul risque irréversible), et c'est tout.

Une signature, une seule : **la carte sombre** (« Fusion », choix de Julien du 2 nov.) en tête de Ma journée, Ventes, Colis et Compta — un bleu nuit en dégradé radial, le grand chiffre du moment en blanc, ses cases en voile translucide. Tout le reste s'efface autour d'elle.

Le système vit dans `src/styles-design-2026.css` (jetons `--d-*`, chargé en dernier) ; les couches plus anciennes (`--fu-*`, `--t-*`, `--vrm-t*`, `--r-*`, `--o-*`) lisent ces jetons. Les règles métier de `CLAUDE.md` (§3, §5, §7) passent avant toute décision de forme.

**Key Characteristics:**
- Police du système (SF Pro sur Apple), aucune police téléchargée ; chiffres alignés (`tabular-nums`) partout où ils se comparent.
- Fond groupé `#F2F2F7`, cartes `#FFFFFF` rayon 20, ombre douce à deux couches ; la nuit : `#000` / `#1C1C1E` / `#2C2C2E`, un liseré à la place de l'ombre.
- Un seul bleu (`#0071E3`), rare : le bouton principal, le trait franchi d'une frise, le segment de progrès.
- Cibles de 44 px affichés ; une ligne d'explication au plus, le reste derrière « Pourquoi ».
- Iphone et ordinateur aussi soignés l'un que l'autre : une rangée sur ordinateur, une carte au doigt.

## Colors

Une palette neutre d'Apple, une teinte d'action, deux teintes de sens.

### Primary
- **Bleu d'Apple** (`#0071E3`, les deux thèmes) : l'aplat du bouton principal (texte blanc, 4,7:1), le trait franchi de la frise, la barre de progrès. Un par écran.
- **Bleu de la nuit** (`#0A84FF`) : la sélection de texte la nuit (à 42 %), le bleu système d'iOS en sombre.
- **Bleu des liens** (`#0066CC` ; nuit `#409CFF`) : tout TEXTE bleu (lien, « Masquer le guide »). 5,3:1 sur le fond gris.

### Neutral
- **Fond groupé** (`#F2F2F7` ; nuit `#000000`) : le sol de chaque écran.
- **Carte** (`#FFFFFF` ; nuit `#1C1C1E`) : les blocs.
- **Case** (`#F2F2F7` ; nuit `#2C2C2E`) : le second neutre, une zone DANS une carte (vignette vide, case d'info), jamais une carte dans une carte.
- **Remplissage** (`rgba(118,118,128,.12)` ; nuit `.24`) : le fond des contrôles (segmentés, pilules, boutons secondaires), lisible sur le fond comme sur une carte.
- **Encre** (`#1D1D1F` ; nuit `#F5F5F7`) : le texte, le N° en pastille.
- **Gris** (`#6E6E73` ; nuit `#98989D`) : le texte secondaire — 4,5:1 sur le fond gris (le `#8E8E93` d'iOS tombait à 2,9:1, refusé).
- **Séparateur** (`rgba(60,60,67,.18)`, .5 px ; nuit `rgba(84,84,88,.6)`) : entre deux rangées d'un groupe, commencé après la vignette.

### Sens
- **Ambre** (texte `#B25000`, point `#FF9F0A`, fond `#FFF4E5` ; nuit `#FFB340`) : un geste à faire maintenant (date limite, dernier jour). Sur une ligne de prochain geste, c'est un POINT devant la phrase, pas une phrase entière en ambre.
- **Rouge doublon** (`#D70015` ; nuit `#FF6961`) : deux paires présentes sous un même N°. Nulle part ailleurs (`scripts/audit-rouge-doublon.cjs`).

### Named Rules
**La règle de la couleur rare.** Le bleu ne marque que l'action principale ; un chiffre ne prend une couleur que s'il y a quelque chose à rattraper. Violet refusé (`scripts/audit-violet.cjs`).

## Typography

**Police :** celle du système — `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` (`--vrm-police`). Au-delà de 20 px, SF passe d'elle-même en Display.

**Caractère :** la hiérarchie vient de la graisse et de la taille ensemble, jamais d'une couleur ; l'approche est négative en grand et nulle en petit.

### Hierarchy (l'échelle de Dynamic Type, ratio 1,13–1,2)
- **Grand titre** (800, 34 px, 1,1, −0,03 em) : le nom de l'écran (« Colis », « Ma journée »).
- **Grand chiffre** (800, 38 px téléphone / 44 px ordinateur, 1,08, tabulaire) : LE chiffre de la carte sombre.
- **Titre de section** (700, 22 px, −0,022 em) : « À faire », « Prêts à retirer ».
- **Titre de rangée** (600, 17 px, −0,012 em) : une rangée de Ma journée, l'en-tête d'un groupe de colis.
- **Titre d'article** (600, 15 px, 1,3, deux lignes au plus) : le nom d'une paire dans une carte de colis, une rangée de retrait, la Tournée.
- **Texte** (400, 15 px, 1,45) : phrases, prochain geste.
- **Note** (500, 13 px) : la ligne grise sous un titre (date limite, attente).
- **Légende** (500, 12 px) : sous un chiffre de case, le mot d'une étape de frise.

Jetons : `--d-t-11 … --d-t-44`, interlignes `--d-il-*`, approches `--d-ap-*`.

### Named Rules
**La règle des deux lignes.** Le nom d'une paire tient en deux lignes au plus et se coupe à la fin, jamais réduit à une ligne écrasée (« spezial… »).
**La règle de la phrase unique.** Une même phrase sur chaque ligne est UNE phrase : elle va dans l'en-tête du groupe.

## Layout

Grille de 4 px (`--d-e-1` 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40). Marges de page 16 px au téléphone. Serré dans un groupe, large entre deux groupes : 8 px entre deux cartes d'une liste, 20 px au-dessus d'un en-tête de groupe, 24–32 px entre deux sections.

- **Téléphone :** une colonne, barre d'onglets en bas (zone sûre respectée), le grand titre qui se replie.
- **Ordinateur (≥ 1024 px) :** rail latéral, barre du haut flottante ; Ma journée en deux colonnes (carte sombre et semaine à gauche, « À faire » à droite) ; une liste de colis devient une RANGÉE par colis (photo · titre et limite · frise · gestes) au lieu d'une carte étirée ; la carte sombre de Colis se couche (grand chiffre à gauche, cases à droite).

## Elevation & Depth

Hybride, très léger : les surfaces posées ont UNE ombre douce à deux couches (contact + diffusion), ce qui flotte (menus, feuilles) une ombre plus profonde. La nuit, l'ombre ne se voit pas sur le noir : un liseré de .5 px à 6 % de blanc la remplace.

### Shadow Vocabulary
- **Posée** (`--d-ombre-carte` : `0 .5px 1px rgba(0,0,0,.04), 0 4px 18px -6px rgba(0,0,0,.08)`) : cartes, groupes de rangées, ligne de prochain geste.
- **Levée** (`--d-ombre-levee` : `0 1px 2px rgba(0,0,0,.05), 0 10px 28px -8px rgba(0,0,0,.14)`) : un élément qu'on tient (glisser).
- **Flottant** (`--d-ombre-flottant` : `0 6px 16px rgba(0,0,0,.08), 0 24px 56px rgba(0,0,0,.14)`) : menus, feuilles, fenêtres.

### Named Rules
**La règle du cadre absent.** Une carte n'a pas de bordure : l'ombre la pose. Seul `prefers-contrast: more` rend un cadre net.

## Shapes

Six rayons, pas un de plus : **6** (pastille de N°) · **12** (contrôle, bouton) · **14** (vignette, case) · **20** (carte) · **24** (carte sombre) · **999** (pilule). Une vignette de paire est un carré à rayon 14 ; le logo du transporteur LU s'y pose en badge (tuile blanche 24 px, rayon 6, dans le coin bas-droit) — rien lu, rien posé.

## Components

### Buttons
- **Forme :** 44 px de haut affichés, rayon 12 (pilule 999 pour un geste de rangée).
- **Primaire** (`.vrm-b-primaire`) : aplat bleu, texte blanc. Un par écran.
- **Secondaire** (`.vrm-b-secondaire`) : remplissage gris translucide, texte à l'encre, sans bordure.
- **Discret** (`.vrm-b-discret`) : texte bleu seul, zone de toucher 44 px.
- **Appui :** `scale(.97)` à la pression, 120 ms, courbe `--d-sortie` ; survol seulement avec une souris (`hover: hover`). Focus clavier : anneau bleu 2 px décollé de 2 px.

### Contrôles segmentés et filtres
- **Segmenté** (`.vrm-seg`) : piste remplissage, rayon 12, segment choisi en blanc (nuit `#636366`) avec ombre fine ; compteur après « · ».
- **Filtres** (`.vrm-filtres`) : pilules 13/600 ; l'actif à l'encre pleine (nuit : aplat du segment).

### Cards / Containers
- **Carte** : `#FFFFFF`, rayon 20, ombre posée, 16–20 px de marge intérieure. Jamais de carte dans une carte : l'intérieure devient une case (`#F2F2F7`, rayon 14).
- **Groupe à rangées** (« À faire », À retirer, Tournée) : UNE carte, des rangées séparées par un filet .5 px qui commence après la vignette — comme Rappels et Réglages, sur l'ordinateur aussi.

### Ligne de prochain geste (Colis)
Une rangée blanche (rayon 20, ombre posée) : un point ambre si c'est pressé, la phrase à l'encre en 15/600, un bouton pilule à droite. Jamais un paragraphe ambre ni un bouton pleine largeur.

### Carte de colis
Vignette 60 px (badge du transporteur LU) · N° en pastille encre + nom de la paire (15/600, deux lignes) · note grise 13 (limite, attente) · bouton rond du bordereau à droite. **La frise** (quatre segments « Imprimé · Déposé · En route · Livré ») n'est posée que si une étape est FAITE ; trait franchi bleu, mot à l'encre seulement sur la dernière étape faite.

### La rangée de liste (Ventes, Achats, Messages, la loupe — 8 nov.)
UNE carte par liste (rayon 20, ombre posée), une rangée par élément : vignette 56 rayon 14 (44 ronde en Messages), titre 15/600 sur deux lignes au plus, une note grise 13 (site · compte · date), le montant 15/600 en chiffres alignés, aligné en haut à droite. Filet .5 px qui commence après la vignette (84 px du bord ; 72 en Messages, 64 dans la loupe). Survol à la souris seulement, fond `--d-case` à 60 %. À l'ordinateur la même rangée, en colonnes, DANS le groupe (jamais flottante sur le gris).

### L'état d'une rangée
Un mot gris 13/500 sur sa ligne, jamais une pastille cerclée répétée sur chaque rangée. Un geste à faire (« À envoyer ») : le mot à l'encre 600 et un point ambre de 7 px devant. Le compte s'écrit en mots dans la note (`.vrm-acct-tag` y perd son cadre).

### La feuille groupée (tiroir d'une vente)
Le fond gris `--d-fond`, chaque bloc (état, argent, détails) une carte blanche à 16 px des bords, des lignes de 44 px séparées par un filet ; le titre d'un bloc en note 13/600 grise ; les gestes du bas en cartes blanches (un remplissage gris sur le fond gris ne se voit pas).

### Les bandes de chiffres (carte d'annonce)
Plusieurs petites valeurs saisissables (achat, accepter dès, refuser sous, boost, marge) : UNE bande blanche (rayon 14) en 2 × 2, filets entre les valeurs, libellé 11 gris ; une valeur vide (`data-vide`, « — » à saisir) en gris, une valeur saisie à l'encre. Jamais un mur de tuiles.

### Le champ de recherche
Celui d'iOS : remplissage `--d-remplir`, rayon 12, sans cadre ; l'anneau bleu seulement au focus.

### Réglages
Le nom du groupe en note 13/600 grise au-dessus de sa carte ; l'icône dans une tuile neutre de 30 px (rayon 6, `--d-remplir-fort`, jamais colorée) ; le nom en 17 régulier ; sa phrase en 13 grise régulière ; filet à 58 px.

### La carte sombre (signature)
Dégradé radial bleu nuit, rayon 24 ; surtitre 13/600 blanc à 70 %, grand chiffre 800, cases en voile `rgba(255,255,255,.1)` rayon 14. À garder (choix de Julien) ; l'affiner, ne jamais la retirer.

### Navigation
Téléphone : barre d'onglets en bas, icône + libellé, l'actif en bleu, pastille du compteur. Ordinateur : rail latéral gris, l'entrée active en carte blanche.

## Do's and Don'ts

### Do:
- **Do** prendre les jetons `--d-*` de `src/styles-design-2026.css` (taille, espace, rayon, ombre, surface) plutôt qu'une valeur écrite à la main.
- **Do** dire le prochain geste d'abord, en une ligne ; le détail derrière « Pourquoi ».
- **Do** écrire « — » (avec la raison) pour un chiffre pas su, jamais « 0 ».
- **Do** garder les attributs `data-*` : les bancs jugent la règle dessus.
- **Do** regarder la capture à 390 px (tactile) ET à 1512 px, clair ET sombre.

### Don't:
- **Don't** utiliser le violet, ni le rouge ailleurs que pour deux paires sous un N°.
- **Don't** télécharger une police (choix de Julien : la police du système).
- **Don't** poser une carte dans une carte, ni une bordure grise autour d'une carte.
- **Don't** répéter la même phrase sur chaque carte d'un groupe : elle va dans l'en-tête.
- **Don't** poser une frise vide (quatre traits gris) : rien de fait, pas de frise.
- **Don't** deviner un transporteur pour poser un logo : rien lu, rien posé.
- **Don't** remettre `-webkit-overflow-scrolling: touch` sur un conteneur qui peut contenir une feuille (§7).
- **Don't** animer plus de 250 ms, ni sans `prefers-reduced-motion` respecté.
