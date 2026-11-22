# 21 nov. 2026 — Le style « comme Vintex — 2ᵉ jet » sur TOUTE l'app (branche `claude/style-vintex`)

Julien a validé (21 nov.) d'appliquer à toute l'app les maquettes `docs/design/iphone-2026-11-21/vintex-vrai-2/`
(branche `claude/design-iphone`, README « 6ᵉ passe », planche `planche6-vintex-vrai-2.png` du scratchpad de la session).
Points décidés : ses 5 onglets (Aujourd'hui · Annonces · Ventes · Achats · Argent) ; échelle réduite (titre d'écran 22,
texte 14, méta 12, contrôles 36 dans une zone de 44, rangées ~56, marges 16) ; fond #F1F3F6 et cartes blanches à ombre très
douce ; contrôles fins (#E4E4E7, rayon 8) ; étiquettes pastel franches (vert = fait/prêt/en ligne, ambre = geste, teal = en
route, gris = en attente, rouge SEULEMENT doublon de N°, pas de violet) ; logos en couleur ; plein à l'encre (un par écran) ;
accent VERT SAPIN #0F6B4C (nuit #3FD49A), rare — l'onglet actif le porte (pas le rose de la maquette, trop proche du rouge
réservé) ; plus aucun bleu vif ; plus aucun titre en capitales ; mode sombre aux mêmes mesures (#0F0F11 / cartes #18181B).
L'extension n'est PAS touchée (son panneau a déjà sa palette en 5.419).

## 1. Ce qui a été fait (un seul lot, à la racine)

1. **Jetons** — `src/natif/jetons.css` réécrit (contrat `docs/design/NATIF.md` §0–§1) : fond, cartes, `--n-bord`,
   `--n-trait`, encres (`--n-encre-2` #62676F : 5,1:1 sur le fond), accent sapin, plein = encre, ambre, et les étiquettes
   `--n-vert*`, `--n-teal*`, `--n-gris*` ; échelle 30 · 22 · 15 · 14 · 13 · 12 · 10,5 ; `--n-h-controle` 36 (la zone reste
   `--n-cible` 44), rayons 8 / 12 / 6 / 10 ; ombres `--n-ombre-carte`, `--n-ombre-xs`. Sombre aux mêmes mesures.
   `src/themeMineral.js` (les couleurs du code d'avant, `C.*` et `--vrm-*`) prend LES MÊMES valeurs (plus le « Studio bleu
   clair ») ; en sombre le texte sur l'accent est sombre (`onAccent` #0F0F11 : le blanc sur #3FD49A ne tient pas 4,5:1) — les
   22 `background:C.accent,color:'#fff'` d'App.jsx et ebayGestion.jsx lisent désormais `C.onAccent`.
2. **Composants natifs** (`src/natif/natif.css`, `complements.css`, `tableau.css`, `ventes-lisibles.css`) : bouton DESSINÉ
   à 36 dans une boîte de 44 (bordure transparente de 4 px en haut et en bas, `background-clip: padding-box`, rayon
   `8px / 12px` dehors ⇒ 8 dedans) — les bancs qui mesurent 44 au doigt restent justes ; contour fin, fond de carte, encre ;
   plein à l'encre ; texte et icône seule à l'encre (l'accent est rare) ; pastilles et étiquettes pastel à filet ; plaque N°
   de 20 à contour ; segmenté de 36 (choix de 44 qui débordent) ; groupes et cartes à contour + ombre douce, en-têtes en
   minuscules (12/500 pour un groupe, 15/700 pour une carte ou des tuiles) ; rangées à filet de 1 px, icône grise ; case
   carrée 18 ; interrupteur 36 × 20 (zone 44 par `::before`) ; recherche à contour ; grand titre 22 ; barre d'onglets
   blanche à filet, l'actif = icône sur un voile 44 × 28 vert pâle et libellé sapin 600 ; barre latérale blanche.
   Étiquettes de statut (`TableauTravail`) : `vert` (en ligne, vendue, terminée, arrivé), `teal` (en route), `ambre`,
   gris (le reste).
3. **Plus aucun bleu** : un script (scratchpad `sapin.cjs`) a remplacé 1 687 couleurs dans 213 fichiers de `src/`,
   `public/` et `index.html` hors commentaires et hors logos : bleu vif ⇒ sapin (#0B5139 / #0F6B4C selon la luminosité,
   #34BE89 / #3FD49A pour les bleus clairs de la nuit), `rgb()` à alpha conservé ; bleu pâle ⇒ gris à peine teinté ; bleu
   nuit ⇒ zinc ; bleu moyen ⇒ gris. Gardés (logos, choix de Julien) : `src/transporteursVisuels.js`, `src/natif/logo-site.css`,
   `src/visuelsReseaux.js`, `src/Room3D.jsx`, le « blurple » de Discord.
4. **Plus aucune capitale** : 124 `text-transform: uppercase` / `textTransform:'uppercase'` passés à `none` (et leur
   interlettrage d'appoint à `normal`), plus le reçu d'achat (chaîne HTML) et `public/aide/aide.css` ; gardés : la plaque du
   N° et le champ où l'on tape un N° (`.vrm-inv-champ input`).
5. **Les écrans d'avant à l'échelle** : `src/natif/anciens-ecrans.css` (titres 34 ⇒ 22, rangées 17 ⇒ 14, détails 15 ⇒ 12,
   en-têtes de groupe 12/500, cartes à contour + ombre, boutons secondaires à contour, segmenté à contour) et
   `src/natif/vintex-echelle.css` (NOUVEAU, importé après `accessibilite.css`) : les tailles écrites en dur sous des
   `:root` ×9 et `!important` (titres d'Achats, Messages, Paramètres, Stock ; chiffres 52–104 px d'Aujourd'hui, d'Argent,
   d'Achats ; sections 24 px) ramenées à 22 / 30 / 20 / 15 / 14. Mesuré par une sonde (scratchpad `sonde.js`) avant/après.
6. **Stock** : « À écrire sur tes cartons » passe SOUS le titre (`aEcrire` posé par `Garage` → `StockV2`, au lieu d'être
   monté au-dessus de l'écran par App.jsx).
7. **Aujourd'hui** : un seul titre (celui de la coque) — le `<h1>` « Ma journée » est retiré (App.jsx et la copie
   instantanée `JourneeInstantanee.jsx`), le « ? » se pose au bout de la ligne du bonjour (`studio-finition.css`).
8. **Garde** : `scripts/audit-style-vintex.cjs` — S1 aucun bleu vif (teinte calculée, styles en ligne compris), S2 jetons
   (accent sapin, plein = encre, fond, cartes, contour ; `themeMineral` suit), S3 onglet actif sapin sur son voile, S4 aucune
   capitale hors plaque N°, S5 `audit-violet` et `audit-rouge-doublon` passent. `--mutation` : 7 mutations, chacune rougit.
   Sur l'arbre d'avant (`git archive` de la tête d'intégration) : 1 027 rouges.
   `scripts/audit-rouge-doublon.cjs` : le « e » rouge du logo eBay (#E53238 / #FF5A5F) ajouté aux couleurs de MARQUE (il
   faisait rougir l'audit sur l'intégration) ; ses mutations R6 relisaient le disque (elles ne rougissaient que grâce à ce
   rouge-là) : elles jugent maintenant le source muté ; plafond de dette d'App.jsx ramené de 12 à 9 (le compte réel).
9. **Docs** : `docs/design/NATIF.md` §0–§1 (et §1 bis, §2 bis mis d'accord), skill `.claude/skills/vrm-design/SKILL.md`
   (section en tête), ligne « Quoi de neuf » `style-vintex`.

## 2. Preuves

(voir §4 — rempli à la fin du chantier)

## 3. Ce qui reste / à savoir

- La coque garde sa tête (loupe, bulle Messages, photo du compte) : la « puce de compte » et le ⟳ à contour de la maquette
  ne sont pas posés (structure, pas valeurs).
- Les écrans d'avant ont encore des tailles intermédiaires (16–17 px) dans quelques cartes (Paramètres : tuiles ; Argent :
  rangées « Ton bénéfice ») : la sonde les liste, `vintex-echelle.css` est l'endroit où les ramener.
- `styles-identiques` (banc du 20 nov.) compare les styles calculés à une référence : l'attendu CHANGE (c'est le but du
  lot) — voir §4.
