# 11 nov. 2026 — « Achetés mais pas encore en ligne » (lot `pas-en-ligne`)

Branche `claude/pas-en-ligne` (depuis `origin/main` f04d4a58). Poussée à chaque commit. Pas de PR,
pas de fusion (la session principale intègre).

Demande validée par Julien (« compliqué à mettre en place » : JUSTE plutôt que vite) : les articles
achetés ou rangés depuis plus de X jours (réglable) qui ne sont en ligne sur AUCUN site — PROUVÉ.

## Mesuré sur sa base avant de coder (lecture seule, 11 nov.)

- `vinted_offvinted_buys` (achats hors plateforme) et `vrm_stock_importe` : **absents** de toutes les
  lignes `main` (aucun vendeur ne s'en sert encore).
- `vinted_annonce_numeros` : 564 fiches chez le plus gros compte, **10 reliées à un achat**
  (`buyFromId`), 401 / 5 chez un autre. ⇒ Un achat Vinted ne peut presque jamais être PROUVÉ « pas en
  ligne » aujourd'hui : n'importe quelle annonce non reliée pourrait être lui. La liste le dit
  (« N annonces en ligne pas reliées à un achat ») avec le geste « Relier mes annonces ».

## La règle — `src/pasEnLigne.js` (pure, une seule, §11)

1. **Les articles à juger** (`candidatsPasEnLigne`) :
   - achat hors plateforme **avec N°** et ligne de stock importée (N° = identité, « 007 » = « 7 ») ;
     écartés si le N° a (ou a eu) une fiche d'annonce Vinted, s'il est prouvé vendu
     (`vrm_stock_vendus`), si l'import a été relié à une annonce (`annonce`), si l'achat est masqué
     (doubles). Deux saisies sous un même N° = UN article, dit « Deux achats sous ce N° » (rouge, §7) ;
   - achat Vinted **lu** (jamais deviné : achats pas lus ⇒ aucun), pas annulé/remboursé
     (`ACHAT_SANS_COUT`), **jamais relié** (`liensParAchat` : fiche ou vente) ; un lot au nombre écrit
     garde ce qui reste (« lot : 2 sur 3 pas reliés »), un lot sans nombre relié une fois ne se devine pas ;
   - achat hors plateforme **sans N°** : jugé comme un achat Vinted (il ne se relie que par un N°).
2. **Les annonces actuelles** (`presentsDe`) : la lecture du Stock (`lireAnnoncesStock`, maintenant
   exportée de `src/ecrans/Stock.jsx`, la même règle `<enligne-regle>`, `annoncesActuelles`), toutes
   plateformes, en ligne + à confirmer + masquées. Chaque article actuel porte ses N° et les achats
   reliés à ses annonces Vinted (ou à une fiche Vinted du même N°). Les annonces lues SANS identité
   (eBay/Leboncoin/Vestiaire sans N°, Vestiaire à l'état non dit, Leboncoin en vente sans référence
   ni lien — `lireLbcPreuve`) comptent comme « sans N° ni achat relié ».
3. **Le jugement** (`jugerPasEnLigne`) : un article à N° est en ligne si une annonce actuelle porte
   son N° ; un achat, si une annonce actuelle lui est reliée. Sinon il n'est **prouvé** pas en ligne
   que si : toutes les sources sont `ok` (lecture répondue, complète, < 24 h — `etatSource` :
   `ratee` · `jamais` · `vieille` (avec ses jours) · `partielle`), ET aucune annonce actuelle ne peut
   être lui (à N° : aucune annonce sans N° ; achat : aucune annonce pas reliée à un achat). Sinon
   « à confirmer », jamais compté, le manque nommé une fois. Annonces pas lues ⇒ `su: false`.
   Seuil 7 / 14 / 30 / 60 j (défaut 14, `vrm_pas_en_ligne_seuil`, SYNC_KEYS), âge en jours du
   calendrier, le plus ancien d'abord. Import sans date : « depuis au moins N jours » (date d'import).

Sources jugées : chaque compte Vinted lu par le Stock (les comptes écartés ne sont pas lus ni
nommés), chaque compte eBay du registre (`capturedAt` de sa ligne, ajouté à `lireEbayEnLigne` ; le
compte principal IMPLICITE sans ligne n'est pas un compte : pas d'eBay), chaque compte Leboncoin
connu de `lbc_listings` (`lectureCompleteLbc`), Vestiaire s'il a une ligne (`complet`, `capturedAt`).
Un site que VRM n'a jamais lu n'est pas nommé : VRM ne connaît pas ce compte (décision prise seul).

## L'écran

- **Ma journée** : carte « 36 articles achetés pas en ligne · Depuis plus de 14 jours, sur aucun
  site » dans « À faire », **seulement s'il y en a de PROUVÉS** (`blocsAF['pas-en-ligne']`,
  `CARTES_JOURNEE` : masquable dans « Modifier ma journée »). Elle ouvre la feuille.
- **Achats** : une entrée « Achetés, pas en ligne · 36 · 2 à confirmer › » au-dessus des achats hors
  plateforme, dès qu'il y a quelque chose (prouvé ou à confirmer) — c'est le seul endroit où
  « à confirmer » se voit quand rien n'est prouvé (décision prise seul : la carte de Ma journée ne
  parle que du prouvé).
- **La feuille** (`src/PasEnLigne.jsx`) : seuil segmenté, lignes (photo — Vinted, ou la photo de
  l'achat hors plateforme lue projetée pour les 40 premières —, N°, titre, « acheté 49 € ·
  depuis 20 jours », la case de « Mes meubles » ou l'emplacement du fichier importé), puis
  « N à confirmer » replié avec les manques en ambre et « Relier mes annonces ». « Pourquoi ? » dit
  la règle. Tous les textes par `tr()` (fr, en, es, it, de — 26 clés `pasEnLigne.*`).
- **Le geste** : « Créer sur Vinted » en série dépend de `claude/annonce-vinted`, **pas fusionné sur
  main** (vérifié le 11 nov. : `git merge-base --is-ancestor` faux). Donc : « Ouvrir l'achat » ouvre
  CET achat hors plateforme en modification sur l'écran Achats (`DEMANDE_OUVRIR_ACHAT`, par son id),
  où « Relier à une annonce » pose SON N° ; un achat Vinted ouvre l'écran Achats ; une ligne importée
  ouvre Paramètres → Importer (où « relier » existe). **À faire quand annonce-vinted sera sur main** :
  brancher « Créer sur Vinted » (sélection en série) sur les lignes PROUVÉES à N°.

## Preuves

- `node scripts/audit-pas-en-ligne.cjs --prouve` : vert, **11/11 mutations rouges** (titre pris pour
  identité, compte vieux accepté, lecture ratée acceptée, annonce sans N° ignorée, annonce pas reliée
  ignorée, achat relié gardé, pas su ⇒ vide, tri inversé, seuil libre, N° connu gardé, doublon compté
  deux fois). 50 articles au même titre : 36 prouvés (≥ 14 j, N°117 en ligne écarté par SON N°), une
  annonce au même titre sans N° ⇒ 36 à confirmer. Vert sous UTC, Paris, Los Angeles, Kiritimati.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
  quoi-de-neuf, traduction (44), stock-annonces (53), journee-perso.
- Banc `scripts/bancs/pas-en-ligne.cjs` (390 tactile / 1512, clair / sombre) : voir « État ».

## État à la reprise

(mis à jour en fin de session, ci-dessous)
