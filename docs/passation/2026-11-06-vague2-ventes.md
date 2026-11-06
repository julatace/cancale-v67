# 6 nov. — Vague 2 · Ventes (points 1, 2, 4, 5 et 7)

Feuille de route : `docs/passation/2026-11-05-ameliorations-vague-2.md` (points 1, 2, 4, 7)
et le « ce qui reste » du chantier E2 (`2026-11-05-chantier-e2.md`, l'ambre « Achat · à
saisir » répété). Style des chantiers C et E2 : composants partagés (`Bouton`, `SheetShell`,
`Segmente`, `Numero`, `PhotoVide`), `VERBES`, `montant()`, une couleur rare, 44 px.
Branche LOCALE `v36-vague2-ventes` (depuis `claude/project-review-nsk5su` 162659a6), rien
poussé, rien dans `vinted-sync-extension/`, `public/` intact.

## Mesuré d'abord (lecture seule, sa base, 6 nov.)

- **Ventes annulées avant l'envoi** : 10 ventes Vinted (9 × 520 « Annulée », 1 × 510 « pas
  envoyé à temps »), expédition jamais partie ; la liste des ventes les dit « Remboursement
  effectué » (`failed`). Les 42 transactions 500 « article indisponible » ne sont PAS dans
  la liste des ventes (pas des ventes). Sur les 7 annonces encore relues dans son dressing :
  **7/7 fermées par Vinted** (`is_closed: true`, `item_closing_action: "sold"`) — Vinted ne
  les remet pas en ligne ; aucune recréation (`recreeDe`), aucun suivi « à la main ».
  N° : 8 sur 10 en ont un (6 sur une fiche, 2 posés sur la vente seule), **7 sont des
  numéros d'archive (B…)**, 1 seul se reprend ; 2 sans N°. Coffre : 7 sur 10, dont 2 sans
  photo.
- **`recreerVinted` (extension, lue, jamais modifiée)** : lecture de l'annonce → brouillon →
  **suppression de l'ancienne** (`POST items/{id}/delete`) → mise en ligne. Il ne sait pas
  recréer sans supprimer ; sur une annonce fermée par une vente, la suppression vise une
  annonce vendue (refusée : brouillon en trop et message faux « elle est toujours en
  ligne » ; acceptée : une annonce liée à une transaction supprimée). Et l'atelier ne
  prend que des annonces EN LIGNE. ⇒ **« Remettre en vente » = « Republier à la main »
  accompagné, depuis le coffre** ; rien n'est promis au moteur (`VERDICT_MOTEUR`).

## Ce qui change

### 1. Remettre en vente une vente annulée avant l'envoi — `src/annuleesChezToi.js`
- Règle pure `annuleesChezToi` : annulée **prouvée par la transaction**
  (`txnAnnuleeAvantEnvoi` : ≥ 500, expédition jamais partie ; pas lue ⇒ rien), compte exclu
  écarté, annonce de nouveau chez lui sur Vinted (en ligne, masquée, brouillon) ⇒ rien,
  « Déjà remise en vente » (SON clic, `vrm_annulees_reglees`, synchronisé) ⇒ rien, recréée
  par l'extension ou remise faite ⇒ plus dite ; une vente une fois.
- Sur la ligne (Ventes · Vinted · **Annulées** — « Toutes » ne montre pas les annulées,
  décision du 28 sept.) : **« Remettre en vente »** visible sans « … » (`basSeul`), la ligne
  n'est plus pâlie ; « Paire pas reliée » sans N°. Le récapitulatif dit « La paire n'est
  jamais partie : elle est chez toi » (+ N° gardé / N° neuf pour une archive), porte le
  même geste et « Déjà remise en vente » ; « Article perdu ? » n'y est plus (la paire n'est
  jamais partie).
- Le geste ouvre « Republier à la main » (titré « Remettre en vente ») sur l'annonce
  fermée : photos, titre, description, prix du coffre ; « L'ancienne annonce est fermée
  chez Vinted : rien à supprimer ». Aucune commande à l'extension.
- **N°** : SON tap « C'est celle-ci » désigne la nouvelle ; la reprise est celle des
  republications (`repriseNumerosRecreation`). Un N° posé sur la VENTE seule (pas de fiche
  sous l'annonce fermée) est **prêté en lecture** à la reprise (`fichesAnciennesAnnulees`,
  la vraie fiche gagne). Un **N° d'archive ne se redonne jamais** : la nouvelle annonce en
  reçoit un neuf (dit). Sans N° : la nouvelle désignée clôt la remise.
- **Ma journée « À faire »** : « N ventes annulées avant l'envoi · À remettre en vente ·
  1 sans N° » (une ligne, seulement quand les annonces ont été lues) → Ventes · Annulées.

### 2. « Prix mini… » sur une sélection — `src/annoncesActions.js`
- Une action **non robot** dans `ACTIONS_SELECTION` (`mini`, `multiComptes`) : un **lien
  sous les quatre tuiles** (comme « à la main ») — les quatre tuiles restent celles des
  moteurs (chantier C, `ACTIONS_TUILES` inchangé). Permise sur plusieurs comptes, sans
  compte ouvert ni extension (une écriture dans ses fiches) ; grisée hors « en ligne ».
- Feuille `PrixMiniFeuille` : − X % ou − X € (`Segmente`), **arrondi à l'euro, jamais
  au-dessus du prix** ; « Refuser sous » en option, toujours sous le mini (sinon pas posé,
  dit) ; prix pas lu ⇒ rien ; **« sous ton prix d'achat » en ambre** quand le mini passe
  sous un prix d'achat CONNU (son choix, rien n'est bloqué).
- « Poser » → confirmation qui liste **N° · prix → mini (· refus)**, puis `updatePair(it,
  ecritureMini(l))` — le chemin de la carte (`min`/`refuse`), un entier que l'extension lit
  (`Number(min)`). `refuse` n'est écrit que si l'option est cochée.

### 4. Relier l'achat aux annonces numérotées — `src/achatsARelier.js`
- Filtre Annonces **« Sans achat relié · N »** : en ligne, numérotées, ni achat relié ni
  prix d'achat connu (un prix saisi à la main n'y est pas). Vue `AchatsARelier` : par
  annonce, **la meilleure suggestion de `suggestionsAchat`** (marque ET taille, champs de
  l'annonce d'abord, achat ANTÉRIEUR à la mise en ligne, lots jusqu'à leur nombre), puis
  **« Relier · 32 € »** (l'écriture de « Relier un achat » : prix du reçu, sinon l'article
  seul ; un lot demande le prix de l'article) · **« Saisir »** (le prix tapé) · **« Plus
  tard »** (en fin de file, hors du nombre de Ma journée ; `vrm_achat_plus_tard`). Sans
  suggestion : « Aucune suggestion » + « Choisir un achat » (le sélecteur) ; la règle
  (même marque, même taille, achetée avant) est dite une fois, en tête. SON tap relie, toujours.
- **Ma journée** : « N annonces sans achat relié » → Annonces · Sans achat relié.
- L'écriture de « Relier » est sortie du sélecteur (`ecritureRelierAchat`) : sélecteur, file
  et saisie en série écrivent pareil (§11).

### 7. Une seule règle de suggestion dans la saisie en série — `suggestionsSaisieSerie`
- `fillBuySugg` passe par `suggestionsAchat` (plus `scoreAchatPrep`) : le titre seul ne
  suffit plus (marque + taille obligatoires), un achat postérieur à l'article n'est plus
  proposé, remboursés et déjà reliés écartés, lots jusqu'à leur nombre. La borne de chaque
  ligne : la date la plus ancienne connue (mise en ligne, vente, N° posé). « C'est ça » =
  les trois critères. SON tap sur une piste relie par `relierAchatCle` (même écriture ;
  `linkBuyForKey`, qui écrivait le prix d'un LOT entier, est retiré).

### 5. Ventes à l'ordinateur : le prix d'achat dit une fois
- UN bandeau **« Prix d'achat N/M connus · Compléter »** en tête de la liste Vinted (la
  forme d'Annonces, `vrm-ann-avis`) ; N/M par `bandeauPrixAchat` (src/ventesEcran.js) :
  ni annulées, ni masquées, ni autre devise ; N par la règle de la ligne
  (`beneficeLigneVente`). « Compléter » ouvre la saisie en série.
- La case « Achat · à saisir » de chaque ligne passe en **gris** (`styles-ventes-ligne.css`).

## Preuves
- `npm run build` vert ; `public/` intact ; rien dans `vinted-sync-extension/`.
- **Un audit par règle** (exécuté ; base = arbre `git archive` de 162659a6, audit copié dedans ;
  `--prouve` = chaque mutation réaffaiblit la règle) :

  | audit | après | base | mutations |
  |---|---|---|---|
  | `audit-annulees-chez-toi` (neuf) | 36/36 | 7 rouges (module absent + branchement) | **12/12** rouges |
  | `audit-prix-mini` (neuf) | 23/23 | 6 rouges | **10/10** |
  | `audit-achats-a-relier` (neuf) | 22/22 | 6 rouges | **10/10** |
  | `audit-ventes-prix-achat` (neuf) | 9/9 | 7 rouges | **5/5** |
  | `audit-suggestions-achat` (étendu : F, la saisie en série) | 43/43 | 1 rouge (F0) | **13/13** (4 neuves) |
  | `audit-annonces-actions` (B2/B15 suivent `multiComptes`, B16-B18 neufs) | 61/61 | — | **20/20** (l'ancre `chrome_passu_oui` ne mordait plus, base comprise : réparée) |

- **Banc** `scripts/bancs/vague2-ventes.cjs` (données INVENTÉES, harnais `nouveau-vendeur`,
  `BANC_PORT` 9460 ; 390 tactile et 1512, clair et sombre ; scènes R, J, A, M, S + B, G) :
  **après : 154 verts, 0 rouge** (R 24, B 6, J 12, A 36, M 34, S 8, G 34).
  **Base (dist de 162659a6) : 68 rouges / 42 verts** (R 16, B 6, J 12, A 18, S 4, M 8, G 4 — le
  passage M s'y arrêtait sur une ligne absente ; le banc est depuis robuste : **M rejoué sur la
  base : 30 rouges / 4 verts**). Captures regardées (hors dépôt) :
  `scratchpad/shots-final/v2-{390,1512}-{clair,sombre}-{ventes-bandeau,ventes-remise,remise-main,saisie-serie,journee,sans-achat,actions-mini,prix-mini,prix-mini-confirmation}.png`.
- **Audits demandés, verts** : `annonces-coherence` (29, `--prouve` 15/15), `ventes-e2` (29,
  `--prouve` 13/13), `journee-coherence` (30), `annonces-actions` (61), `suggestions-achat` (43),
  `moteur-offres` (24), `offres-garde` (25), `identite`, `coherence`, `icones`, `fonctions-api`,
  `rouge-doublon`, `composants` ; et `tdz`, `variables`, `journee-court` (60), `argent-a-venir`
  (51), `statuts`, `boutons`. `fusion-echelle --verifier` : les 8 mêmes fichiers que la base
  (`vague2-ventes.css` dans l'échelle).
- **Bancs voisins (après)** : `ventes-e2` 0 rouge · `annonces-coherence` 126 verts, 0 rouge ·
  `journee-coherence` 0 rouge · `annonces-actions` 0 rouge (adapté : sur deux comptes, tout ce qui
  agit au nom d'un compte reste grisé ; « Prix mini… » reste possible — contrôle neuf).

## Ce qui reste
- **Le moteur ne remet pas en vente une annonce fermée** : si Julien le veut un jour, il
  faudrait un chemin « brouillon depuis le coffre, SANS suppression » dans l'extension
  (`recreerVinted` sans l'étape 4 quand l'annonce est fermée) — chantier extension, pas fait.
- Les 7 N° d'archive : la nouvelle annonce prend un N° neuf (la feuille le dit) ; le carton
  porte encore « B… » — pas vérifié que la liste « à écrire sur tes cartons » le reprenne.
- « Plus tard » ne revient jamais tout seul dans le nombre de Ma journée (pas de minuterie
  inventée) : le filtre la montre toujours, en fin de file.
- La feuille « Prix d'achat à compléter » garde son dessin d'avant (hors zone).
- Dans la feuille « Actions » d'une sélection à deux comptes, la raison commune dit « une
  action se lance sur un seul compte à la fois » alors que « Prix mini… » (dessous) part :
  la phrase de `actionsPossibles` est celle des moteurs ; la ligne du lien dit la sienne.

## Geste de Julien
Ventes → Vinted → « Annulées » → « Remettre en vente » sur une paire revenue (ou « Déjà
remise en vente ») ; Annonces → « Sélectionner » → cocher → « Actions » → « Prix mini… » ;
Annonces → « Sans achat relié » → « Relier » sur une suggestion juste.
