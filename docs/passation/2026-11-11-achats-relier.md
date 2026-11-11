# 11 nov. 2026 — Lot DJ5 : Achats (autre achat, reçu ouvert, nouvel achat, icônes)

Branche `claude/achats-relier` (depuis `origin/main` 3cb90230). Poussée à chaque commit. Pas de PR,
pas de fusion (la session principale intègre).

Julien, mot pour mot (11 nov.) : « Quand l'app me fait une proposition pour relier un achat, je ne
peux pas en sélectionner un autre, je peux simplement mettre un prix d'achat. » — « Quand on a relié
une annonce à un achat, je veux que quand on appuie sur Reçu ça ne télécharge pas le reçu mais que ça
l'ouvre comme dans l'onglet Achats. » — « Achat hors brocante doit être amélioré. » — « Je veux que tu
changes le logo des Annonces et de Ma journée. »

## 1. Choisir un autre achat · Déplacer · Délier

- **Où** : à côté de CHAQUE proposition — file « Sans achat relié » (Annonces : « Autre achat » à côté
  de « Relier · 40 € »), coût d'une vente (ligne et récapitulatif : avec un prix proposé, le bouton
  devient « Choisir un autre achat »), numérotage (bloc des nouveaux numéros et question « Prix
  d'achat de la N°… » : `data-ask-autre`), saisie en série (à côté de « Garder »). Dans la feuille,
  « Voir tous les achats » s'appelle désormais « Choisir un autre achat ».
- **La feuille** (`RelierAchatCorps`, src/ecrans/Achats.jsx) ouverte par ce geste (`_autre`) part sur la
  recherche (aucune suggestion, champ en focus) : photo, titre, prix, date, « Vinted · compte · de
  vendeur ». Les achats libres d'abord ; les DÉJÀ RELIÉS ensuite (mêmes filtres, `pris` de
  `tousAchatsLibresDetail`), visibles dès qu'on cherche ou par « Déjà reliés (N) », avec « Déjà relié
  à N°6 » et « Déplacer ici ».
- **Identité (§5)** : SON clic sur UNE ligne relie par le n° de transaction de cette ligne — la même
  écriture que « Relier un achat » (`ecritureRelierAchat`). « Déjà relié à N°… » se lit par
  `buyFromId` seulement (`src/relierAutreAchat.js`, pur). 50 achats au même titre ⇒ c'est le clic qui
  décide (banc A7, D2 ; audit 1).
- **Déplacer ici** : confirmation « Déjà relié à N°6 — Il sera délié de là-bas et relié ici », puis
  `ecrituresDeplacer` délie les AUTRES détenteurs (jamais la cible) : un achat simple ne compte qu'une
  fois dans les coûts. Un LOT pas complet n'est jamais « pris » (`achatDisponible`).
- **Délier** : la feuille, ouverte sur un article déjà relié (« Changer l'achat relié » du
  récapitulatif de vente, « Relier un achat » de la fiche), dit « Relié à … » + « Délier ».
  `patchDelier` retire `buyFromId`/`buyFrom` et le prix posé PAR le lien (égal à l'instantané) ; un
  prix qu'il a retapé autrement reste (§2.5).
- La feuille passe à z 1300 (au-dessus de la saisie en série, sous le reçu 1400).

## 2. Reçu : il s'ouvre

`ouvrirRecuRelie` (Comptabilite) : le reçu e-mail de l'achat, par SON n° de transaction
(`recuDeLAchat`, la règle d'Achats ; lus au toucher quand l'écran ne les a pas lus) ⇒ la même
feuille qu'Achats (`FeuilleRecuAchat`) ; sinon l'attestation de VRM s'affiche dans la visionneuse PDF
(`generateAchatJustificatif(…, { ouvrir: true })` ⇒ `_poserVisionneuse`, téléphone compris), où
« Télécharger » reste un geste second. Branché sur la fiche d'annonce (`AchatRelie`) et le
récapitulatif de vente. Les exports de la Compta (registre) téléchargent toujours (inchangés).

## 3. « Nouvel achat » hors plateforme (« hors brocante » = hors plateforme, sa dictée)

Le libellé de l'en-tête « Achats hors plateforme » est gardé (des audits le lisent ; « hors
brocante » est sa dictée). Le formulaire, une colonne : **photo d'abord** (grande tuile, un
toucher, « Changer » posé dessus) · nom · **prix en grand** (28 px, jamais pré-rempli) · **Où** (ses 4
derniers lieux d'abord, icône horloge, puis la liste courte ; pastilles 44 px) · date · **N° de
rangement** : « Prendre le N°8 » (le prochain libre) posé par SON toucher seulement, réservé dans le
pool à l'enregistrement (`recordUsed`, append-only : jamais redonné à une annonce — sans réservation,
la prochaine annonce aurait reçu le même N°) · référence · facture · « Relier à une annonce » replié ·
gros bouton « Ajouter l'achat » (54 px). Styles : `src/styles-achat-hors.css` (couche
`vrm-premium` : un `!important` dans la couche bat les règles de champ hors couche). Tous les
`data-*` d'avant sont gardés.

## 4. Icônes

`ICON_PATHS` : `vitrine` (store à auvent festonné et porte) pour Annonces, `soleilLevant` (demi-soleil
sur l'horizon, rayons) pour Ma journée — grille 24, même trait. Barre du bas / colonne, en-tête de Ma
journée, en-tête « Annonces en ligne », fiche paire. `sun` et `grid` restent (utilisés ailleurs).
Planche : `docs/passation/planches-dj5/icones-avant-apres.png`.

## Preuves

- `node scripts/audit-achats-relier.cjs` : 26 verts ; `--prouve` **9/9 mutations rouges** (déjà relié
  par le titre, délier garde le lien, délier efface un prix retapé, déplacer délie la cible, libres
  et reliés mêlés, pas d'« Autre achat », reçu téléchargé, N° proposé pré-rempli, ancienne icône).
  Sur `origin/main` (git archive) : rouge (module absent).
- `scripts/bancs/achats-relier.cjs` (neuf, données inventées, 390 tactile et 1512, clair et sombre) :
  A proposition + « Choisir un autre achat » + 50 achats au même titre, SON clic relie 91000037 jamais
  91000007 ; B reçu e-mail ⇒ feuille, sans ⇒ visionneuse, **aucun événement download** ; C Délier ;
  D « Autre achat » de « Sans achat relié » ; E Nouvel achat ; F icônes. Résultats : voir la ligne
  « Bancs » plus bas.
- Captures regardées : `docs/passation/planches-dj5/`.

## Ce qui reste

- Les achats Leboncoin/Vestiaire/eBay ne sont pas dans la feuille (seuls les achats Vinted captés,
  comme avant).
- « Délier » depuis la fiche d'annonce passe par « Relier un achat » (la feuille) : pas de bouton
  dédié sur le bloc « Achat relié ».

Geste de Julien : aucun.
