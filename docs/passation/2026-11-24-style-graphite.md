# 24 nov. 2026 — Dix styles à essayer, une famille de boutons (`claude/style-graphite`)

## Ce que Julien a demandé (mot pour mot)
- « Propose un design un peu plus foncé en terme de gris pour l'iPhone et améliore en fait tous les boutons pour que tout soit beaucoup plus beau. Essaye un peu de changer de style pour l'iPhone. »
- Il ne veut pas juger des planches : il veut voir DANS la vraie app. Puis (coordinateur) : **dix styles** à essayer, chacun en clair et en sombre ; puis « ça fait encore beaucoup trop vieux, je veux quelque chose fait par un professionnel du design ».
- Rappels du 23 nov. tenus : aucun orange ni ambre (« à faire » = l'ardoise + le gras), rouge seulement pour deux paires sous un N°, texte #1D1D1F, accent rare.

## Ce qui est livré
Paramètres → Apparence et langue → Apparence → **Style** : onze tuiles d'aperçu (« Actuel » + dix styles). Chaque tuile dessine
une rangée et un bouton avec les jetons de SON style (la tuile porte son propre `data-style`). Un toucher applique tout de suite
(aucun rechargement), « Actuel » revient au défaut. Rangé sur CET appareil (`vrm_style`) : il essaie sur l'iPhone sans changer
l'ordinateur. **Le défaut ne change pas** : sans choix, aucun attribut, aucune règle de ce lot ne s'applique.

| style | idée |
|---|---|
| Graphite | gris plus foncé (#DADCE0), cartes gris-blanc #F4F5F7, plein à l'encre avec relief ; nuit graphite #232428 (pas noir) |
| Ardoise | gris bleuté froid et calme |
| Pierre | gris chaud de pierre, sans orange (beige-gris seulement) |
| Encre | presque noir, très contrasté, texte blanc, pour le soir |
| Papier | blanc cassé éditorial, grands titres à empattements (police du système : New York / Iowan / Georgia), N° en étiquette kraft (désaturée : pas orange) |
| Verre | cartes dépolies translucides sur un dégradé gris très doux |
| Nuit | bleu nuit profond, accent bleu doux |
| Menthe | gris froid, accent menthe rare |
| Studio | blanc pur, noir franc, angles nets (rayon 4), titres 800 |
| Arcade | gros boutons en relief (ombre portée « marche » de 4 px), enfoncement plus marqué (0,94 + descente de 3 px), cartes 24 |

## Comment c'est fait (un style ne coûte aucun JavaScript)
- **Une table, un générateur** : `scripts/styles-generer.cjs` porte la palette (clair, sombre) et la forme (rayons, hauteur du
  plein, profondeur, police des titres) de chaque style, et FABRIQUE `src/natif/styles-choix-jetons.css` (ne pas le modifier à la
  main). Avant d'écrire, il vérifie ~40 paires texte/fond par style et par thème (≥ 4,5:1, la carte translucide du Verre posée sur
  son fond le plus défavorable) et refuse toute couleur orange/ambre. `--verifier` (le fichier est-il à jour ?) ; `--prouve`
  (trois mutations rougissent).
- **La famille de boutons** : `src/natif/styles-choix.css`, écrite une fois, en couche `vrm-styles` (nommée après `vrm-natif`).
  ⚠️ Pas hors couche : le pont `src/coque-native.css` renvoie les contrôles natifs aux couches (`all: revert-layer`, avec un
  identifiant) — une règle hors couche était effacée (mesuré : le plein enfoncé gardait sa couleur).
  - plein : 50 (52 Arcade, 48 Papier/Studio), encre/ardoise, reflet intérieur + petite ombre (`--g-plein-relief`), enfoncé :
    échelle 0,97, plus foncé, 80 ms ; relâché 160 ms (courbe `cubic-bezier(.23,1,.32,1)`) ;
  - secondaire : fond teinté, aucun filet ; tertiaire : texte à l'accent ; rond (icône seule) 44, discret au repos ;
  - étiquettes : pilules teintées calmes avec un point devant, couleur par le SENS (« à faire » = ardoise, vert = fait) ;
  - champs : creusés (ombre intérieure), anneau de focus à l'accent ; contrôle segmenté en rail creusé, curseur en relief ;
  - barre d'onglets translucide floutée, onglet actif en capsule ; rangées : appui visible (0,985) ;
  - échelle : texte 15 / 13, contrôles DESSINÉS 40 dans une zone de 44, rangées 60, grands titres 32 (repliés au défilement
    par la barre existante), cartes 20–24 regroupées par le ton (plus de filet).
- **`data-n-famille`** : un bouton propre à un composant partagé rejoint la famille par un ATTRIBUT (le style actuel ne change
  pas) : `second`, `champ`, `rond`, `lien`, `rangee`. Posé sur « Relier » / « + prix » (`celluleAchat.jsx`), la rangée
  d'annonce, son « ⋯ », l'en-tête de compte et « N à régler » (`Annonces*.jsx`). Dans le style actuel, les « liens discrets »
  de Ventes (`complements.css`) restent identiques (`:where(:root:not([data-style]))`, spécificité inchangée).
- `src/natif/styleChoix.js` (`STYLES`, `choisirStyle`, `styleLu`) ; `public/demarrage-theme.js` pose `data-style` avant le
  premier rendu (même clé, même liste).

## Preuves
- Banc `scripts/bancs/styles-choix.cjs` : 10 styles × clair/sombre × 390 (tactile, DSF 2) × Ventes, Annonces, fiche d'une paire
  (+ `LARGEURS=390,1512`) : A style appliqué (`data-style`, `--n-fond` = la table) ; B contraste de chaque texte recomposé ET
  **sur les pixels** de la capture (plein, étiquettes, N°, titres, onglet actif, choix segmenté) ; C cibles ≥ 44 ; D aucune
  couleur orange/ambre calculée, aucun rouge hors doublon ; E chaque bouton est de la famille ; F l'état enfoncé existe
  (`data-n-force="appui"` : échelle < 1, plus foncé) ; G rien ne déborde, ne se chevauche, aucun bouton dessiné ne recouvre un
  texte, aucune erreur ; T les tuiles (11, un toucher applique et range, « Actuel » revient, cibles ≥ 44).
- Rouge : `BANC_DIST=<dist d'avant>` (aucun style) ; `MUTATION=sansstyle|orange|pale|petit|appui|vieux|deborde`.
- Planches de revue (hors dépôt) : `scripts/bancs/_planche-styles.cjs` — une par style + « avant (actuel) / après (Graphite) ».
- Résultats : voir « État à la reprise ».

## État à la reprise
(rempli en fin de lot)

## Reste
- Écrans plus anciens (Achats, Argent, Messages, Paramètres) : jetons et composants natifs suivent ; les boutons d'avant
  (`vrm-b…`) n'ont pas la famille — à rattacher par `data-n-famille` composant par composant.
- Les phrases d'aide sous un bouton (`raison`) restent : elles disent pourquoi un geste est indisponible (lecteur d'écran).
