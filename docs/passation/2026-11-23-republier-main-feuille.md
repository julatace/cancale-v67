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

`node scripts/bancs/republier-feuille.cjs` (vraie app construite, données INVENTÉES, Annonces → « ⋯ » / tableau de travail →
« Republier à la main », 390 tactile avec partage de fichiers simulé et 1512, clair et sombre ; captures dans `SHOTS`) :
**152 contrôles verts, 0 rouge** sur la branche après le vrai `git merge origin/main` (e34e24f0b). Captures REGARDÉES
(les quatre vues, étapes Photos, retouche, enregistrées, Supprimer, Créer, Fini, il en manque, relu).

- **Vu sur les captures et corrigé** : « Pass / er » (pied de l'étape Photos) et « Ret / our » (étape Fini) coupés sur deux
  lignes à 390 ET à 1512 — la coque remet `white-space` du bouton (`revert-layer` sous un sélecteur à id) et le libellé natif
  coupe partout (`overflow-wrap: anywhere`). `src/republier-feuille.css` : le libellé du pied tient sur une ligne. Contrôle
  neuf H10 « pied : chaque geste sur une ligne » (nœuds de texte, `Range.getClientRects`), à chaque étape.
- Ajouts au banc : service worker bloqué (`serviceWorkers: 'block'`, comme 66 autres bancs) ; H2 « prêtes, elles le
  restent » (4 s observées, le plein ne se grise pas sous le doigt) ; H8 joue le vrai geste (« Ouvrir sur Vinted », puis le
  retour dans VRM) et garde le journal des lectures de la fiche pour dire pourquoi il rougirait.
- ⚠️ Intermittent vu AVANT ce changement de H8 : 2 rouges sur 17 passages de H8 (toujours dans une passe complète) (« retour » par `visibilitychange`
  seul, sans le toucher « Ouvrir sur Vinted »), jamais reproduit en 3 passes 390 seules. Le chemin réel (toucher, puis
  retour ; relecture aussi toutes les 20 s pendant 10 min) est vert partout ; la cause exacte du retour manqué n'est pas
  établie (pas de remontage observé).

**§6.1, rouge sur le code d'avant** (banc copié dans `git archive origin/main`, e34e24f0b, construit) : **82 rouges / 152**
— H1 ×4 (masquée ⇒ « Supprimer » cochée, `{"etat":"fait","coche":true}` : la capture de Julien), H2 ×22, H3 ×4 (↓/✓ posés
sur la tuile), H4 ×8, H5 ×16, H6 ×12, H7 ×4, H8 ×8 (« VRM a lu 1 sur 5 photos… puis « Relire les photos » », deux
boutons ; jamais relu seul), H9 ×4.

**Mutations** (390 et 1512 clair, chacune rouge seule sur SON contrôle, le reste vert) :
- `etatAncienne` sans la garde « masquée » ⇒ H1 rouge (2/2) ;
- le libellé du pied sans `nowrap` ⇒ H10 rouge (Photos et Fini, 4/4) ;
- sans `visibilitychange` ⇒ H8 rouge (2/2, banc d'avant le geste « Ouvrir ») ; sans AUCUNE relecture seule (ni retour ni
  20 s) ⇒ H8 rouge avec le banc final (journal : aucune lecture après « retour »).

Audits voisins : `audit-republier-guide` 28 verts, `--prouve` **28/28** (trois ancres de mutation périmées depuis la feuille
refaite — `envoi_vinted`, `texte_en_dur`, `cle_absente_it` — portées sur `ouvrirAncienne` / `rg2.supprimer.ouvrir`, et D5
compte maintenant les clés `rg2.*` : 124 clés dans les 5 langues) ; `audit-republier-kit` 17 verts, `--prouve` 14/14 ;
`audit-traduction` 45/0 ; `audit-quoi-de-neuf`, `audit-icones` verts ; `npm run build` vert.

## ÉTAT À LA REPRISE

- Branche `claude/republier-main-feuille` poussée, `origin/main` fusionné (vrai merge ; CLAUDE.md 58 037 octets, §9 :
  les deux côtés, la ligne « Mode présentation » déjà déplacée par `main` dans `historique-divers.md`), PR ouverte, à
  prendre par le train (pas fusionnée par cette session).
- Pas vérifiable ici : la feuille sur un VRAI iPhone (partage « Enregistrer N images », maintenir-glisser au doigt réel,
  barre de Safari) ; la lecture de la fiche par l'extension sur une vraie annonce (simulée par le banc) ; le rendu au gris
  clair de `claude/style-clair` (#1326) une fois sur `main` (le plein suit `--n-plein`).
- Geste de Julien : ouvrir « Republier à la main » sur une annonce masquée et sur une de 10+ photos, au téléphone.
