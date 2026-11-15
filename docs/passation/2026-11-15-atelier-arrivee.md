# 15 nov. 2026 — Atelier « achat arrivé → en ligne », historique complet, note, taille du texte

Branche `claude/atelier-arrivee` (partie de `origin/claude/project-review-nsk5su`, style « Verre dépoli » en
place). Julien a validé les quatre lots (« vas-y fais tout »). Poussée à chaque commit, pas de PR.

## Ce qui existait (lu avant de coder) et ce qui a été RÉUTILISÉ

| besoin | existait | réutilisé tel quel |
|---|---|---|
| N° et case à l'arrivée | « Ranger cet achat » (11 nov., `src/rangementArrivee.js`, `src/RangerAchat.jsx`, `preparerRangement` / `ecrireRangement`) | toute la règle (prochain N° jamais un trou, case libre, empilement, habitudes, lot, « Rangé » = pool d'abord puis geste annulable) ; le plan (`Plan`, exporté) |
| photos | studio photo (`src/StudioPhoto.jsx`, détourage local U²-Net, `studio_photos_{N°}`) ouvert par `ouvrirAtelier('studio')` | ouverture et relecture (`vrm:studio-range`) |
| prix d'achat | `src/prixAchatPropose.js` (`propositionPrixAchat` : reçu juste ⇒ « Payé sur Vinted », sinon « Article seul ») ; `src/prixAuNumerotage.js` (montant tapé relu) | les deux, sans rien changer |
| fiche « À publier » | `vrm_fiches_neuves` (créée par « Rangé », origine `arrivee`) ; « Créer sur Vinted » (`FeuilleCreerVinted`) ; « Publier partout » (`vrm:publier-partout`) | les trois |
| « fiche prête à l'arrivée d'un achat » | refusée/remplacée le 3 nov. par les suggestions — rien n'avait été construit | l'atelier ne DEVINE rien : la fiche part de l'achat relié PAR IDENTITÉ (n° de transaction), comme « Ranger cet achat » |
| historique | `src/histoireArticle.js` (3 nov.) + `src/paireHistoire/ligneDeTemps.js` (14 nov., « Dans l'ordre ») | la chaîne et son rendu |
| note | `src/notePaire.js`, `NotePaireCoque`, dictée `DicterNote` (navigateur seulement, `src/noteVocale.js`) | tout ; ajoutée à deux endroits |
| taille du texte | `src/grandTexte.js` : la Taille du texte de l'appareil devient une échelle de toute l'app (`applyZoom`), corrections `html[data-grand-texte]` (`src/styles-lisible.css`) | le mécanisme ; le choix de VRM s'y ajoute |

## 1. L'atelier « achat arrivé → en ligne »

`src/atelierArrivee.js` (règle PURE), `src/AtelierArrivee.jsx` (dessin, chargé à la demande),
`src/atelier-arrivee.css`, `AtelierArriveeCoque` dans `src/App.jsx`.

- **Déclencheur** : le MÊME événement que « Ranger cet achat » (`ouvrirRangement` ⇒ `vrm:ranger-achat`) :
  « J'ai retiré » (colis ou commande Vinted), la cloche « Où ranger », la carte « N achats à ranger » de
  Ma journée, les retraits au comptoir (après fermeture du scanner / mode relais). La feuille d'avant n'est
  plus montée (`<RangerAchatCoque/>` remplacé par `<AtelierArriveeCoque/>`) : une seule feuille.
- **Six étapes, une progression** (six traits qu'on touche ; fait = encre, passé = pointillé, courant = accent) :
  1. **N°** — la plaque N° proposée (ou le champ « Je numérote moi-même ») ; lot : le compteur et les N° à la suite ;
  2. **Case** — la case libre proposée, le plan ; « **Rangé** » = l'écriture de « Ranger cet achat » appelée
     **SANS prix** (le prix a son étape) ; « Ranger sans case » ;
  3. **Photos** — « Prendre les photos » ouvre le studio sur CE N° ; l'étape est faite quand le studio a
     rangé une photo sous ce N° (preuve lue, pas un drapeau) ;
  4. **Prix d'achat** — le prix PAYÉ de CET achat : le reçu juste (« Payé sur Vinted · Article · Port ·
     Frais ») sinon l'article seul (DIT : « sans le port ni les frais ») ; « Garder 41,90 € » (SON tap) ou
     « Corriger » (champ vide) ; un lot ⇒ rien proposé, « ≈ » en indication ; un N° qui a déjà un prix
     n'est jamais réécrit ;
  5. **Fiche** — titre, marque, taille, couleur (une seule couleur nommée dans le titre de l'achat, sinon
     vide), catégorie et état (ses choix), description, et **son** prix de vente — jamais pré-rempli
     (§3 : prix conseillé à la mise en ligne refusé). La note (et sa dictée) en tête ;
  6. **Publier** — « Créer sur Vinted » (le chemin existant, brouillon depuis l'onglet vinted.fr, c'est lui
     qui publie), « Ouvrir le brouillon », puis « Publier partout » une fois en ligne.
  Puis un **bilan** (fait / plus tard, étape par étape) et la note.
- **Chaque étape a « Plus tard »**. Passer le N° ferme l'atelier (sans N° la paire n'a pas d'identité :
  photos, prix et fiche s'attachent au N°) — l'achat attend dans Ma journée comme avant.
- **Reprise** : `vrm_atelier_arrivee` (SYNC_KEYS) garde SES « Plus tard » / « C'est fait » par fiche ; le
  reste se PROUVE par les données (fiche rangée, case, photos du studio, coût posé, `completeAt`, en ligne).
  Ma journée : « **N paires à finir** » (`pairesAFinir`, 30 jours, fiches `arrivee` pas retirées) ⇒
  « Reprendre » rouvre l'atelier à la première étape ni faite ni passée.
- **Rien sans son geste** : chaque écriture passe par `gesteVrm` (pilule « Annuler » 5 s) ; l'accompagnement
  dit avant ce qui va se passer et ce qui ne se passera pas (`acc.arrivee.*` : `arrivee.ranger`,
  `arrivee.prix`, `arrivee.fiche` dans `GESTES_ACC`).
- **Le prix payé arrive avec l'achat** : `entreeAvecPaye` (écran Achats) pose sur l'entrée la proposition
  calculée AVEC le reçu de CET achat (`indexRecusAchat`, par n° de transaction) ; `prixPayeArrivee` ne
  l'accepte que si elle porte le MÊME n° de transaction.

### Décisions prises seul
- **Ordre N° → case → photos** (et non photos en premier) : le studio range les photos sous le N°
  (`studio_photos_{N°}`). Photographier avant le N° voudrait une photo sans identité, ou un N° écrit avant
  son geste. Mieux vaut un blanc qu'un faux (§5).
- **« Rangé » n'écrit plus le prix d'achat** quand il vient de l'atelier : le prix a sa propre étape, sur
  SON tap (« Garder »), avec la source dite. La feuille d'avant écrivait le prix lu de l'article seul.
- **Catégorie** : l'achat Vinted ne porte pas de catégorie lisible (mesuré dans le code : pas de
  `catalog_id` sur `my_orders`) ⇒ jamais pré-remplie ; cinq choix (Baskets, Vêtements, Sacs, Accessoires,
  Autre), son toucher.
- Retour en arrière sur N° / case après « Rangé » : non (un N° servi ne se reprend pas ici ; la case se
  change dans le Stock).

## 2. L'historique complet sur la fiche

`src/paireHistoire/ligneDeTemps.js`, `src/paireHistoire/LigneDeTemps.jsx`, `src/histoireArticle.js`,
`lireExtraFiche` (App.jsx). La frise datée (« Dans l'ordre ») est désormais la **vue par défaut** de la fiche.
Ajouté, chaque fois **par identité** :
- **offres** reçues / faites, avec leur **état lu** (`etatOffreVinted` : acceptée, refusée, en attente,
  terminée) — par l'`item_id` de la transaction de la conversation ; la date ISO de Vinted est lue (avant :
  « date inconnue », et une date absente donnait 1970) ;
- **masquée / de nouveau visible / disparue** — les événements que l'extension a constatés sur deux
  lectures COMPLÈTES (`moderation_vinted_{uid}`, projetés), par identifiant d'annonce ; pas lus ⇒ nommés ;
- **retour reçu / remise en stock** — SES clics (Ventes → Retours), par n° de transaction d'une vente de CE N° ;
- **republiée · même N°** (la paire garde son N°, `repriseNumero`) ;
- **le vendeur de l'achat** — seulement pour l'achat RELIÉ (`buyFrom.seller` de la fiche qui porte ce
  `buyFromId`), jamais pris sur une autre fiche, jamais inventé.
Ce qui existait reste : achat, réception, numérotage, photos, mise en ligne, prix (baisse/hausse), vente,
colis, versement, annulation ; « date inconnue » ; « pas encore lu » ; N° en double ⇒ aucune histoire.

## 3. La note

Déjà synchronisée (`vrm_notes_paires`), sur la fiche avec dictée. Ajoutée :
- dans l'**atelier** (étape fiche et bilan), avec la dictée du navigateur (Safari/Chrome ; sinon le bouton dit
  pourquoi, le clavier reste) ;
- **à côté de la conversation** d'un acheteur, sous la carte de la paire du fil : la paire par SON identité
  (N°, sinon l'annonce de la transaction), une note seulement si elle existe. Jamais insérée dans un message.

## 4. La taille du texte

`src/tailleTexte.js`, Paramètres → Affichage → **Taille du texte** (juste sous Apparence) : Normal ·
Grand (1,12) · Plus grand (1,24) · Très grand (1,36), chaque ligne écrite à sa taille. Rangée sur CET
appareil (`vrm_taille_texte`). Elle passe par le mécanisme du texte en grand de l'appareil : appareil ×
choix, borné à 1,6, `html[data-grand-texte]` posé ⇒ les corrections de `styles-lisible.css` s'appliquent.
**Pourquoi pas seulement les jetons de taille du studio** : mesuré, ~3 160 `fontSize` en ligne dans le JSX
et ~3 130 tailles en px dans les CSS ; les jetons (`--d-t-*`) n'en portent qu'une petite part — changer
les jetons seuls aurait grossi un tiers des textes et laissé le reste petit. L'échelle grossit textes,
marges, cibles et photos ensemble ; la mise en page se refait sur une largeur plus étroite.
Au téléphone, l'ancien réglage « Taille de l'affichage » (densité) ne s'affiche plus que s'il porte une
valeur à défaire ; sur ordinateur il reste (densité Minus → Grand).

## Les preuves

- `node scripts/audit-atelier-arrivee.cjs` — **38 verts** : A1 prix payé par identité sur 50 achats au même
  titre (sans n°, lot, remboursé, autre devise, prix pas lu ⇒ rien ; reçu d'un autre achat refusé), A2 écriture
  du prix (jamais par-dessus), A3 étapes et reprise (« pas lu » ≠ fait), A4 fiches par identité sur 50 fiches
  au même titre, A5 fiche pré-remplie (prix de vente vide), A6 « Enregistrer », A7 Ma journée, A8
  branchements ; H1–H4 historique sur 50 paires identiques (offres, masquages, retours, vendeur, même N°,
  date ISO) ; N1–N2 note à côté du fil ; T1–T3 taille du texte.
- `node scripts/audit-atelier-arrivee.cjs --prouve` — **16/16 mutations rouges**.
- Sur l'arbre de départ (`git archive origin/claude/project-review-nsk5su`, `--src`) : **rouge** (C0).
- Audits verts : traduction (AtelierArrivee.jsx ajouté aux écrans migrés), tdz, variables, quoi-de-neuf,
  accompagnement, icones, identite, numeros-lettres, numeros-nouvelles, numeros-vestiaire, studio, csp,
  coherence, idees-paires, note-achat-double, rangement-guide, annonces-outils, finitions-v36.
  `numeros-clenum` : 1 rouge (`src/aRetirerAilleurs.js`), **le même sur l'arbre de départ**, hors lot.
- Deux audits jugeaient l'orthographe d'hier, réécrits sur la RÈGLE (dit ici, §6) :
  `audit-idees-paires` B2 accepte des sources ajoutées après `lireStudio` ; `audit-rangement-guide` A3/A5
  acceptent `entreeAvecPaye` et `<AtelierArriveeCoque/>`.
- Bancs : voir la section « Bancs » plus bas (résultats et captures).

## Ce qui reste / limites
- Le banc `scripts/bancs/rangement-guide.cjs` attend la feuille d'avant (`[data-ranger-feuille]`) : il est
  remplacé par `scripts/bancs/atelier-arrivee.cjs` (mêmes données, mêmes exigences R1–R3, plus les étapes).
- « Publier partout » ne sait publier qu'une paire déjà en ligne sur Vinted (sa source) : l'atelier propose
  donc d'abord « Créer sur Vinted ».
- Les photos du studio ne sont pas encore reprises automatiquement par « Créer sur Vinted » (la feuille
  laisse les choisir) — chantier à part.
- Geste de Julien : aucun (essayer « J'ai retiré » sur un achat, et Paramètres → Taille du texte).
