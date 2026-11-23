# 23 nov. 2026 — Améliorer les photos d'une paire en un geste (lot `claude/photos-un-geste`)

Validé par Julien le 23 nov. (n° 5) : « améliorer les photos d'une annonce en un geste (lumière, recadrage, fond
uniforme) LOCALEMENT dans le navigateur, gratuit, sans IA payante ; s'appuie sur le studio photo existant (détourage
local U²-Net, Vestiaire seul pour le détourage — §3 : ne pas l'étendre à Leboncoin), réglages appliqués à toutes les
photos d'une annonce, original conservé ».

## Ce qui est fait

- **Où** : Studio photo (Annonces → Outils → Studio photo, ou la fiche / la séance photo), une paire choisie, dès
  qu'elle a une photo : un panneau « Améliorer en un geste » — trois réglages (Lumière · Recadrage · Fond uniforme,
  tous allumés par défaut, gardés sur l'appareil `vrm_studio_un_geste`) et UN bouton « Améliorer les N photos ».
- **Le même réglage sur CHAQUE photo de la paire**, l'une après l'autre (« Photo 2 sur 5… »), puis UNE écriture (comme
  le détourage : liée à la paire où le geste a commencé, comparer-et-échanger `modifierStudio`).
- **L'original reste** : le résultat est rangé À CÔTÉ (`ameliore`, `amelioreAt`, `ameliorePar`, `amelioreFait`) ; la
  vignette montre l'original et l'améliorée côte à côte ; « Télécharger » prend la détourée, sinon l'améliorée, sinon
  l'original ; « Revenir aux originaux » retire les versions améliorées.
- **La règle** (`src/ameliorerPhoto.js`, pure sauf le canvas) : lumière = niveaux automatiques 1 %/99 %, gain BORNÉ
  à 2,2, rien si la photo est déjà étalée ; fond = la médiane du BORD, appliqué seulement si ce bord est uni (sinon
  « Fond pas assez uni sur N : laissé tel quel ») — remplissage depuis le bord, un pixel de la même teinte ENFERMÉ par la
  chaussure n'est jamais blanchi ; recadrage = la boîte de ce qui n'est pas le fond, marge 8 %, format 3:4 ; aucun sujet
  net ⇒ pas de recadrage.
- **§2.9 / §3** : aucune IA, aucun modèle, aucune clé, aucun envoi — de l'arithmétique sur les pixels dans la page. Ce
  n'est PAS un détourage : U²-Net et Photoroom restent tels quels ; seul le studio importe le module (rien n'est promis
  à Leboncoin ni à eBay).
- Textes `ug.*` dans `src/i18n/langues/{fr,en,es,it,de}/memePhoto.js` ; Quoi de neuf `photos-un-geste`.

## Preuves

- `node scripts/audit-photos-un-geste.cjs` : **16 verts** sur des images INVENTÉES (pixels calculés : fond gris uni,
  chaussure, œillet de la couleur du fond enfermé, fond bruité, photo terne, dégradé déjà étalé). Mutations rouges
  (7/7) : `gain`, `connexe`, `uni`, `original`, `ratio`, `envoi`, `un-reglage`. Code d'avant : le module n'existe pas.
- Qualité sur de VRAIES photos de chaussures : pas mesurée (aucune photo réelle dans le dépôt public) — voir ci-dessous.

## Textes et boutons (consigne de Julien relayée le 23 nov. : « trop de texte, pas assez de beaux boutons »)

- Au plus une phrase courte par bloc (≤ 8 mots), le détail sous « Pourquoi ? » (repli `vrm-repli`), les gestes en
  boutons communs (`Bouton` natif, icône + verbe court). La branche `claude/style-clair` n'ajoute pas d'autre composant
  bouton : c'est celui de `src/natif/Bouton.jsx`.

## Mesures de la vraie base (lecture seule)

Mesures base (lecture seule, 23 nov. ~11:55 UTC, projections scalaires) :
- ext_appareil_* : 19 lignes, 1 owner, 19/19 à la forme attendue (data->>atMs, data->appareil->>nav).
- vrm_meilleures_sources : 0 ligne en base (publication sur l'appareil, normal).
- studio_photos_* : 0 ligne (personne n'a encore rangé de photo au studio).
- email_invoice_* : 24 lignes.
- main : vrm_colis_retirer présent sur 4 lignes main (1 colis, tuple à 8 cases, limite lue AAAA-MM-JJ, transporteur vinted) ;
  vrm_colis_aposter ABSENT de la base (publication de CET appareil seulement : la liste des envois n'existe que là où Colis/Ma journée l'a calculée) ;
  vrm_fiches_neuves ABSENT partout ; vrm_slots : 1 ligne main, 8 cases.

## ÉTAT À LA REPRISE

- Branche poussée ; banc de rendu (studio, 390/1512) et PR après 15:30 UTC ; fusion pas avant le 24 nov. 07:00 UTC.
- À mesurer avec Julien : sur ses photos (fond de son studio), les seuils `SEUIL_UNI` (14) et `TOLERANCE_FOND` (26)
  — un fond légèrement ombré peut être jugé « pas uni » (rien n'est alors changé, c'est dit).

Geste de Julien : essayer « Améliorer en un geste » sur une paire et dire si le fond et le cadrage lui vont.
