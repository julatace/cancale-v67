# 23 nov. 2026 — « Republier à la main » refait (feuille iPhone)

Branche `claude/republier-main-feuille` (app seulement, aucune ligne de l'extension).

Julien a envoyé trois captures iPhone de la feuille « Republier à la main » (Annonces) : « ça doit être beaucoup mieux,
plus pratique ». Puis, règle générale : « trop de texte, pas assez de beaux boutons ».

## Les défauts vus, et leur cause (mesurée dans le code)

| défaut | cause |
|---|---|
| « ✓ Supprimer » cochée alors qu'il était à l'étape 1 | `etatAncienne` disait « partie » dès que l'annonce n'était pas dans `listings.items`. Or « À la main » s'ouvre aussi sur une annonce **masquée** ou en **brouillon** (`ACTIONS_SELECTION.main.etats`), qui ne sont jamais dans `items`, comme une annonce d'un compte relu il y a plus de 24 h (« à confirmer ») ou dont la lecture a raté. Une absence prise pour une preuve (§5 : jamais déduit d'une absence). |
| « VRM a lu 1 sur 13 photos… puis Relire les photos » en orange, deux boutons | la feuille lit déjà toutes les sources connues par l'identité de l'annonce (coffre, fiche de la page `vinted_item_details`, dressing, vignette). **Mesuré en base** : le dressing (`harvest_*_listings`) ne garde que la vignette et le nombre (`photo`, `nPhotos`) sur 12 comptes sur 13 ; la fiche de la page n'existe que pour 360 annonces. Il n'existe pas d'autre source à aller chercher sans l'extension. |
| ↓, ✓ et un « e » posés sur la vignette | le bouton « Enregistrer cette photo seule » (`data-main-photo-une`) et le libellé « Couverture » posés sur la même tuile de 104 px. |
| « Enregistrer la photo » en aplat noir ; « Une seule ? Touche son bouton sur la photo » | le plein suivait `--vrm-accent` (l'encre) ; la phrase renvoyait au bouton de la tuile. |
| « Présentation : retouchée · Régler » + encadré « Mêmes réglages… » ; curseurs en deux barres avec un trou | le trait du « zéro » était un dégradé posé sur la piste native : sur l'iPhone il coupait la piste en deux. |

## Ce qui change

- **La règle de l'ancienne** (`src/republierGuide.js`, `etatAncienne`) : « partie » seulement sur une lecture COMPLÈTE de CE
  compte (`complets[uid]`), qui a répondu (pas dans `ko`), l'annonce n'étant ni « à confirmer » ni masquée ; sinon « pas su ».
  L'appel (Annonces) passe ces champs de la lecture.
- **La feuille** (`src/ecrans/Republier.jsx`, styles `src/republier-feuille.css`) — même parcours, mêmes étapes, mêmes preuves :
  - une barre de progression fine (un trait de 3 px par étape, le mot dessous ; chaque segment reste un bouton de 44 px) ;
  - une étape à la fois : un titre, **une phrase de 8 mots au plus**, le reste sous « Pourquoi ? » ;
  - **la grille de toutes les photos** : un toucher retire / remet, **maintenir puis glisser** les range (souris : glisser) ;
    l'ordre est SON choix (`photosRangees`, `deplacerPhoto`), la 1re gardée = la couverture ; sur la tuile seulement la
    photo, son rang et la case ;
  - **UN bouton plein en bas** (pied collé) : « Enregistrer les 13 photos » (iPhone) / « Télécharger… » (ordinateur), puis
    « Suivant » ; à Supprimer « Ouvrir l'annonce », à Créer « Ouvrir Vinted » ; « Passer » en lien à côté ;
  - il manque des photos : **une ligne grise et UN bouton** « Ouvrir sur Vinted » ; VRM relit tout seul ce qu'il connaît
    (ses données, par l'identité de CETTE annonce) au retour dans l'app et toutes les 20 s pendant 10 min après ce bouton —
    plus de « Relire les photos » ;
  - **la retouche repliée** (« Retouche · Aucune / Retouchée ») : avant / après sur la couverture, cinq curseurs refaits
    (nom à gauche, UNE piste dessinée — le trait plein va du zéro à la valeur —, poignée ronde, valeur à droite, curseur
    natif invisible posé dessus pour le doigt, le clavier et le lecteur d'écran ; double-toucher = zéro) ; « Mêmes réglages
    que Republier » sous « Pourquoi ? » ;
  - **aucun orange** dans la feuille (ce qui était ambre passe en gras dans l'encre ; le point d'échec en gris) ; le plein
    suit `--n-plein` (l'ardoise du design gris clair dès que `claude/style-clair` est sur `main`).
- « Une photo seule » : SES touchers retirent les autres, puis le bouton du pied (le bouton posé sur la tuile est retiré).
- « Publier à la main » (une fiche « À publier ») reçoit la même feuille.
- Inchangé (§3) : un réglage pour toutes les photos (aucun « Varier », aucun réglage par annonce), aucun hasard, rien ne part
  chez Vinted d'ici (c'est lui qui supprime et publie), le N° suit la paire par SON clic.

## Preuves

- `audit-republier-guide` : A4b (« partie » seulement sur une lecture complète…) et A4c (l'ordre au glisser) ; `--prouve`
  28/28 (dont `absence_partielle`, `absence_ko`, `absence_masquee`, `glisser_perd`).
- `audit-republier-kit` B4 porté sur la règle (une photo seule par la grille, aucun bouton sur la tuile) ; `--prouve` 14/14
  (ancre `kit_photos_brutes` réparée : elle ne correspondait plus depuis le 15 nov.).
- Banc neuf `scripts/bancs/republier-feuille.cjs` (H1–H10) — résultats et captures : voir « Bancs » ci-dessous.
- Bancs `republier-guide` et `republier-kit` portés (textes courts, photo seule par la grille).

## Bancs

(rempli après la passe)

## ÉTAT À LA REPRISE

(rempli à la mise en ligne)
