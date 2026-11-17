# 17 nov. 2026 — Accessibilité WCAG 2.1 AA (lot `accessibilite`)

Julien : « Corrige tout ce que l'audit trouve. » Audit en lecture seule sur `origin/main` (15f97138c), base
INVENTÉE du socle `scripts/bancs/_a11y.cjs`, puis corrections sur `claude/accessibilite`.

## Ce que l'audit a mesuré (avant)
Contraste mesuré sur les PIXELS (texte rendu transparent, capture, médiane du cadre — le verre et le dégradé
bleu comptent tels qu'ils s'affichent ; axe-core se trompait de fond sur le verre) :
- 🔴 Feuille « Tout sur le N° » : focus jamais entré, Tab sort 24/24 (1512) et 30/30 (390), focus pas rendu.
- 🔴 Encre sombre posée sur le bleu : Achats « 3 ventes sans achat relié » 1,57:1, « Comment c'est calculé »
  1,43:1 ; Annonces « 4 en ligne sur Vinted · 222 € de valeur » 1,45:1.
- 🟡 Anneau de focus `#0060CC` sur le bleu 2,36:1 (en-tête), 2,75:1 sur le verre sombre.
- 🟡 Tab : la colonne de navigation en DERNIER, 7 suggestions + « Pourquoi ? » traversées à chaque écran
  (ouvertes au focus de la recherche), aucun lien d'évitement ; un bouton invisible (0 × 44, « 2 choses à
  revoir ») sur chaque écran.
- 🟡 Nuit : « Relier un achat » 2,57:1. Cibles : N° éditables des Annonces 35–40 × 22 ; logos du choix de
  site 22 × 44 ; ronds de l'en-tête 38 × 38 (ordinateur).
- 🟡 Ventes/Colis : 3 lignes de ventes au nom VIDE pour le lecteur (`content-visibility:auto` vide le texte
  `vrm-sr-seul` hors écran).
- 🟢 Paramètres sans `h1` ; nom de la fiche et « En ligne sur … » en dur (pas `tr()`).

## Ce qui change (après)
- `src/design/accessibilite.css`, couche **`vrm-a11y` nommée AVANT `vrm-verre`** (index.html) : pour un
  `!important`, la couche nommée la première gagne. Anneau DOUBLE neutre (filet d'encre + liseré blanc) à
  `:focus-visible` ; encre claire du verre sur ce qui est posé sur le bleu ; « Relier un achat » de nuit ;
  zone de toucher étendue (`button.vrm-cible-44::before`) ; logos du choix de site et ronds de l'en-tête à 44 ;
  lien « Aller au contenu ».
- `src/FichePaire.jsx` : focus entrant, Tab/Maj+Tab tournent dans la fiche (une feuille posée dessus garde son
  tour), focus rendu à la fermeture ; en plan (`aria-modal="false"`) rien.
- `src/App.jsx` : la colonne (`SideBar`, fixe) rendue en tête de la coque ; `main#vrm-contenu` ; Tab depuis la
  barre de recherche saute les suggestions (toujours au ↓) et referme le panneau ; `aria-label` des lignes de
  ventes = leur texte lu ; `MarquePlateforme` par `tr()`.
- `src/LigneFraicheur.jsx` : `horsTab` — la ligne cachée de la coque sort de la tabulation (la même, active,
  est dans la feuille de la cloche).
- `src/ecrans/Reglages.jsx` : `h1` lu seulement. Traductions : `src/i18n/langues/*/accessibilite.js`.
- `scripts/audit-studio.cjs` S3 : `accessibilite.css` admise après studio.css (sa couche fait foi).

## Preuves
- Banc `scripts/bancs/accessibilite.cjs` **partie E** (`BANC_SEUL=E`, helpers `_a11y-mesure.cjs`) : 7 écrans,
  390 clair/sombre + 1512 clair, la fiche à 390 et 1512. **49 ❌ sur origin/main** (banc copié dans
  `git archive 15f97138c`, dist de main), **114 ✅ / 0 ❌ après**.
- Mutations (`BANC_MUTATION=`) : `contraste` (Achats rouge), `focus` (38 arrêts sans contour), `cibles`
  (N° 40×22), `noms` (3 lignes muettes), `fiche` (focus hors fiche) — chacune ROUGE.
- `audit-studio` (et `--prouve` 13/13), `audit-traduction`, `audit-quoi-de-neuf`, `audit-tdz`,
  `audit-icones` verts. Captures regardées : 390 clair et sombre, 1512.

## Laissé, avec la raison
- Ma journée, ordinateur : les 7 jours de la frise en 26 × 60 (colonne de 218 px). Au pointeur ; au-dessus du
  24 × 24 de WCAG 2.2 AA (2.5.5 est AAA). Les élargir demande de recomposer l'affiche (avis de Julien).
- Les trois cases du mois de Ma journée : l'ordre visuel (`order` CSS, verre-journee.css) ≠ l'ordre au clavier.
- Le fondu sous la barre du bas (iPhone) assombrit le texte qui passe dessous (3,5:1) : choix du Studio, la
  ligne remonte au-dessus en défilant ; le banc ignore cette bande.
- Lien « Ventes » dans une phrase d'Argent (50 × 19) : exempté (2.5.5, lien dans une phrase).
- Confirmation avant impression : le banc C ne l'ouvre pas sur la base inventée (non mesurée).
- La liste des ventes reste une suite de boutons sans `role="list"` (décision du 11 nov., un rôle ARIA faux).
