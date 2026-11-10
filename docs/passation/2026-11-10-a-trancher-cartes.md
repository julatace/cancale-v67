# 10 nov. — « À trancher » en CARTES — branche `claude/a-trancher-cartes`

Julien, sur une capture iPhone de l'écran « À trancher » (lot AC, `2026-11-09-a-trancher.md`) :
« Améliore ça stp ». Avant, sur d'autres écrans : « je n'aime pas du tout les pop-up, ça n'a rien
changé », « Encore du texte ». Proposition validée : UNE CARTE PAR DOUTE, du visuel, moins de texte.
Aucune base réelle lue d'ici (données inventées). Extension : rien changé.

## 1. Ce qui change pour lui

- **Une carte par doute** quand l'écran propriétaire connaît les choses : la **photo de la paire**
  (celle de SON annonce ou de SA fiche — une identité, jamais une ressemblance, §5), son **N°** en
  grand, **une question de 12 mots au plus** (« Deux paires sous ce N° », « Supprimée de Vinted.
  Encore chez toi ? », « Remise en ligne : même paire que N°9 ? », « Prix d'achat pas saisi »),
  et le geste en **gros boutons** (48 px, pilules).
- Une source dont l'écran ne publie qu'un nombre (colis cochés « posté », colis à retirer, SMS,
  comptes à relire, ventes à dater) = **une carte** : le nombre en grand dans la vignette, la
  question, un bouton. Au plus 3 cartes par source, le reste « + N » (ouvre l'écran).
- **Groupes par type**, titre court + compte : Numéros · Colis · Paires · Comptes · Compta (le
  rouge « deux paires sous un N° » reste en tête). Un nombre ne s'écrit qu'une fois : le titre d'un
  groupe n'a pas de compte quand sa seule carte le porte déjà, ni quand il n'y a qu'un groupe (le
  grand total du haut le dit).
- En haut : « **23** à trancher » (« Au moins **23** » s'il manque une source). La phrase sous le
  titre (« un geste par ligne, objectif zéro ») est retirée.
- **Deux boutons quand le geste est binaire et interne à VRM** : sur « N°12 supprimée de Vinted »,
  **« Oui, chez moi »** écrit tout de suite la MÊME réponse que la pilule « Toujours chez moi » de Ma
  journée (`vrm_cycle_decisions[id] = { choix: 'chez-moi', numero, at }`), **sans confirmation** :
  la carte sort, total et badge baissent, la pilule « Annuler » 5 s (lot B) remet l'état d'avant
  exact (la sous-clé retirée). **« Non »** n'écrit rien : il ouvre Ma journée, où se disent les
  trois autres réponses (remise en ligne, vendu en main propre, je m'en sépare — cette dernière
  garde sa confirmation, elle sort la paire du stock).
- **Un seul bouton qui OUVRE** quand le geste n'est pas binaire ou n'est pas interne : remise en
  ligne « même paire » (elle CHANGE un N° — §5 et lot B : un N° garde sa confirmation, dans
  Annonces ; la carte ouvre Annonces sur SA ligne `[data-remise-ligne=id]`), deux paires sous un
  N° (Colis, bloc rouge), N° à écrire / à vérifier, prix d'achat, colis, SMS, adresses, comptes.
- **Ventes à dater** : rien n'est décidé à sa place (le CA déclaré est daté au jour du versement,
  §5). La carte « Ventes sans date de versement » → **« Dater »** ouvre Compta et touche « Les
  dater » (`[data-urssaf-dater]`, le repli « CA » où il date) ; s'il n'est pas à l'écran, Compta
  seulement.
- **Pas encore compté** : le groupe reste (« — », jamais 0), raison raccourcie à « Ouvre Colis »,
  « Ouvre E-mails »… (« compté il y a 14 h : … » gardé tel quel).
- **Rien à trancher** : une carte dessinée (coche dans un rond) et trois mots.
- **Ma journée** : la ligne « N choses à trancher » prend le même langage — les photos des
  premières choses en pile (`PileVignettes`, par identité), les types en dessous (« Colis · Paires ·
  Comptes ») au lieu de la phrase, le verbe « Trancher ».
- Style (DA6, `src/styles-a-trancher.css`, importé par l'écran) : widgets blancs (#1C1C1E la
  nuit), rayon 22, ombre douce le jour, titres de groupe 22/800, total 44/800 ; une colonne au
  téléphone, grille `auto-fill 300 px` sur ordinateur. Couleur rare : le **mot** du geste en ambre
  sur fond neutre, seul « Oui » rempli d'ambre ; **rouge** pour la seule source « deux paires sous
  un N° » (N°, bouton, tuile) ; aucun bleu dans l'écran.

## 2. Le code

| fichier | quoi |
|---|---|
| `src/aTrancher.js` | `publierSource(…, ex)` : les premières CHOSES d'un nombre (`exemplesPropres` : `{ id, num, photo, photo2, de }` seulement, au plus 4, photo https ou `data:image/`) ; même nombre + autres choses ⇒ republié ; nombre changé sans choses ⇒ les anciennes tombent. `lignesATrancher` passe `ex`. **Nouveau, pur** : `TYPES`, `QUESTIONS` (≤ 12 mots, `mots`, `MOTS_MAX`), `BINAIRES` (seul `supprimes-vinted`), `cartesATrancher`, `appliquerTranches` (optimiste : une chose tranchée ici sort, le nombre −1, tant que la publication la porte encore), `photosJournee`, `typesJournee`. « ventes-a-dater » : libellé « Dater » + `clic: '[data-urssaf-dater]'`. Les nombres et leurs règles : inchangés. |
| `src/ATrancher.jsx` | réécrit en cartes ; props `onTrancher`, `Photo` (la coque passe `PhotoVinted`). |
| `src/styles-a-trancher.css` | nouveau (couche `vrm-premium`, sélecteurs de l'écran seulement). |
| `src/App.jsx` | `Comptabilite` publie `ex` avec ses nombres (N° portés deux fois : N° + photos des fiches des annonces porteuses ; N° à écrire / à vérifier, sans prix d'achat : `exAnnonce` = id, N°, photo de l'annonce ; remises : photo de la NOUVELLE annonce + « de » = l'ancien N° quand il n'y a qu'une option ; supprimés : `cycle.cartes`). La coque publie aussi « supprimes-vinted » de `cycleCartes` (les MÊMES cartes que Ma journée, même règle `cartes.length`) : une réponse donnée dans À trancher y est recomptée sans repasser par Ma journée. `tranchesAT` + `appliquerTranches` (badge, écran et Ma journée lisent la même chose), `trancherAT` (`gesteVrm`, puis recalcul de `cycleCartes` 1,2 s après). Ligne de Ma journée : `photos`, `detail: typesATrancher`, `action: 'Trancher'`. |

Ce qui est rangé sur l'appareil grandit : `vrm_a_trancher` porte, par source, au plus 4 choses
(id d'annonce, N°, adresse de photo) — toujours locale, jamais synchronisée, un autre compte VRM
ne la lit pas (`uid`) ; ni titre, ni montant, ni acheteur (`audit-a-trancher` §9).

## 3. Preuves (§6)

- `node scripts/audit-a-trancher.cjs` — 23 + **13 contrôles §9** : choses propres (rien que
  id/N°/photo/de, doublons écartés, photo non https refusée), republication sur autres choses,
  choses périmées qui tombent, une carte par chose + « + N », carte unique d'une source sans
  choses et titre de groupe sans répétition, toutes les questions (singulier, pluriel, avec ou sans
  « de ») ≤ 12 mots, seul « supprimé de Vinted » binaire, rouge pour la seule source N° double,
  `appliquerTranches` (−1, et plus rien une fois republiée sans elle), corps de `trancherAT` :
  `gesteVrm` + `CYCLE_DECISIONS` + `CHEZ_MOI`, ni confirmation, ni Vinted, ni vendu, ni sorti.
- `node scripts/bancs/a-trancher.cjs` (`AT_SEUL=C` : la partie neuve) — **110 verts** (S, G, T, J, Z
  mis à jour : ordre par type ; G clique `[data-a-trancher-ouvrir]`). C, sur 390 tactile clair,
  390 sombre et 1512 sombre : la carte « supprimé de Vinted » est la VRAIE carte de la coque (fiche
  7002 vue en ligne il y a 2 j, absente de la lecture complète ⇒ `cycleCartes` ⇒ publication), sa
  photo chargée, N°12, deux boutons ; N°31 deux photos, en rouge ; sans prix d'achat 3 cartes +
  « + 1 », la chose sans photo n'en reçoit aucune ; une source sans choses = une carte + son nombre ;
  groupes dans l'ordre, chacun = somme de ses sources ; 14 questions ≤ 12 mots ; 17 boutons ≥ 44 px ;
  rouge seulement sur N° double ; aucun débordement, aucune erreur. C geste : « Oui, chez moi » ⇒
  carte sortie en 250 ms, total et badge −1, ni confirmation ni dialogue, pilule « Annuler » ;
  `vrm_cycle_decisions[7002] = chez-moi, 12` écrit, aucune autre clé ni ligne ; « Annuler » ⇒ la
  carte et le total reviennent, la décision est retirée.
- **Rouge sur `origin/main`** (arbre `git archive`, banc et audit copiés dedans, son build) et
  **par mutation** : chiffres dans le rapport de la session (§4 ci-dessous).
- Audits verts : `variables`, `tdz`, `coherence`, `identite`, `icones`, `cycle-article`,
  `argent-offres-masquees`, `offres-expirent` ; `npm run build`.
- Captures regardées (390 clair/sombre, 1512 sombre, haut / Paires / bas, geste + pilule, Ma
  journée 390 sombre, Z vide).

## 4. Rouges mesurés

- **`origin/main`** (arbre `git archive`, banc et audit d'ici copiés dedans, son propre build) :
  banc **37 rouges / 27 verts** (C 16, G 12 — aucun bouton `[data-a-trancher-ouvrir]`, S 7 —
  ordre par type et carte « supprimé de Vinted » jamais publiée par la coque, T 2) ; audit :
  « 9 · le module des cartes existe » rouge.
- **Mutation 1** — `appliquerTranches` rend l'état tel quel : audit 1 rouge (§9 −1), banc
  « C geste : la carte sort TOUT DE SUITE » rouge (carte encore là, total 23).
- **Mutation 2** — `trancherAT` pose comme « avant » la même décision (Annuler ne remet rien) :
  banc 2 rouges (« Annuler ⇒ la carte revient » ; « Annuler ⇒ la décision est retirée »).
- Bancs voisins verts sur la branche : `cycle-supprime`, `journee-v2`, `journee-photos`,
  `journee-coherence`.

## 5. Ce qui reste / à décider

- Un seul geste binaire est fait sur place (« Oui, chez moi »). Candidats si Julien le veut :
  « Non, une autre paire » d'une remise en ligne (écrit `vrm_remise_refus`, interne, annulable) —
  pas fait : la question porte un N° (« même paire que N°9 ? ») et son « Oui » reste dans Annonces
  (confirmation, §5) ; « C'est écrit » des N° à écrire (déjà annulable dans Colis) — pas fait : il
  faut la fiche entière, que seul Colis tient.
- Les sources qui ne publient qu'un nombre (colis, SMS, comptes, ventes à dater) restent une carte
  par source : leurs écrans n'ont pas de photo par identité à donner (un colis n'a pas d'annonce).
- « Ventes à dater » : chez lui ≈ 1 780 — la carte dit le nombre et ouvre « Les dater » ; la
  décision (garder, année en cours, sortir du compteur) reste la sienne (lot AC §4).
