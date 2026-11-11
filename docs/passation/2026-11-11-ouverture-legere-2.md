# 11 nov. 2026 — Ouverture plus légère, suite (lot `ouverture-legere-2`)

Branche `claude/ouverture-legere-2` (depuis `origin/main`), poussée à chaque commit. Pas de PR,
pas de fusion dans main (consigne). Pas d'extension, pas de migration, aucune route ajoutée.
Suite du lot K (`2026-11-10-ouverture-legere.md`), passation finale §D2.

## 1. Ce qui change pour Julien
- En 4G, la 2e ouverture du jour télécharge **~470 Ko de moins** encore (Ma journée 927 → 458 Ko,
  Annonces 1 108 → 638 Ko).
- **Annonces s'ouvre tout de suite** sur les dernières annonces vues sur cet appareil
  (« Mis à jour il y a N min », inertes, sans photo), puis l'écran vrai prend la place — comme Ma
  journée, Colis et Ventes.
- Si ces listes ne peuvent pas être relues : la même pastille grise « Vu à 14:32 · pas relu ».

## 2. Mesuré d'abord
`_mesure-demarrage.cjs` (390 px, 4G 9 Mb/s, CPU ×4, base inventée au poids réel, `REPRISE=2` :
trois ouvertures dans le même navigateur). Ce qui repartait à chaque 2e ouverture (`origin/main`) :

| lecture | Ko | décision |
|---|---|---|
| `like.harvest_%_txn_%` (états, pont tx → annonce, versements) | ~250 (4 pages) | **gardée** |
| `like.harvest_*` (fraîcheur des comptes, `lireCapturesDetail`) | ~244 (3 pages) | **gardée** |
| `email_track_*` (suivis) | ~110 | **refusé** (§4) |
| `vinted_item_details` (fiches de page) | ~108 | **refusé** (§4) |

Sur sa base (lecture seule, SQL agrégé, 11 nov.) : 1 398 transactions dont **8** réécrites dans les
6 dernières heures, 2 249 autres lignes `harvest_*` dont **10** ; toutes les dates `capturedAt` /
`purgedAt` au format ISO `…Z`, aucune dans le futur.

## 3. La règle (`src/copieLignes.js`, `lireFamilleAvecCopie`)
Une FAMILLE (balayage `like.`) n'a pas une ligne à revalider mais des centaines : sa **version** est
- le **nombre** de lignes (`Prefer: count=exact`, une ligne, en-tête `Range` ⇒ le filtre des comptes
  supprimés ne touche pas la réponse) ;
- les lignes **écrites depuis la copie** : `or=(updated_at.gte.X, meta->>capturedAt.gte.X,
  meta->>purgedAt.gte.X)` (scalaires de `meta`, jamais `select=data` §4.4 ; `lireTout` §4.5) ;
  X = min(date la plus récente de la copie, heure de la lecture) − **6 h** : une horloge en retard de
  moins de 6 h est couverte, une date dans le futur ne repousse jamais X.

Copie + lignes écrites = la famille **si le nombre tombe juste** ; sinon (ligne partie, ou écrite avec
une date trop vieille) ⇒ relue entière. Relue entière au moins **une fois par 24 h** quoi qu'il arrive.
- **Version illisible** (nombre OU lignes écrites) ⇒ **jamais la copie** : la lecture d'avant (la
  famille entière) ; ratée aussi ⇒ `null` (« pas su », comme avant) + « Vu à hh:mm · pas relu »
  (`famille:txn`, `famille:captures` dans `etatCopies`). La copie reste sur l'appareil.
- Une famille dont une date n'est pas ISO n'est **jamais gardée** (comparaison texte fausse).
- Aucune écriture ne part d'une copie : la famille rendue est confirmée à l'instant par le serveur.
- **Cloisonnée par compte VRM** (même stockage IndexedDB que K : clé et valeur portent l'uid ; écrire
  pour un uid efface les autres ; `effacerCopies` à la déconnexion et au changement de vendeur).
- Dans l'app : `lireFamilleCopiee(famille, filtre, select)` ; les cinq lecteurs de
  `TXN_META_SELECT` passent par `lireTxnMeta()` (partagée 60 s, un échec jamais gardé) ;
  `lireCapturesDetail` par la famille `captures`.

**Limite assumée** (dite) : une ligne réécrite avec une date de plus de 6 h en retard sur la plus
récente de la copie, au moment exact où une autre ligne part, n'est pas vue avant la relecture
entière des 24 h. Tous les écrivains mesurés estampillent `new Date().toISOString()` (extension,
`commandes-leger` côté serveur, `withOwner` de l'app).

## 4. Tranché : ce qui n'est PAS gardé, et pourquoi
- **`vinted_item_details`** : aucune version scalaire. L'extension réécrit la ligne entière
  (`saveItemDetail`, `appliquerFiches`, `retirerPhotosEtrangeres`) sans toucher `updated_at` ni une
  date de premier niveau (`meta` vide) ; une date par fiche ne suffit pas (`retirerPhotosEtrangeres`
  change les photos sans dater). Il faudrait une extension qui date la ligne — et une ancienne
  version réécrirait la date d'avant avec un contenu neuf. Refusé.
- **`email_track_*`** : écrite par l'e-mail entrant, les SMS, le suivi transporteur et l'app ; aucune
  date commune à tous (l'e-mail entrant ne pose pas `updated_at`, un « retiré » ne change pas
  `receivedAt`). Une copie y serait servie périmée. Refusé.

## 5. L'instantané d'Annonces (`src/annoncesInstantanee.js`, `src/AnnoncesInstantanee.jsx`)
Même règle que Ma journée / Colis / Ventes (`src/instantaneEcran.js` : `vrm_annonces_instantane:<uid>`,
uid dans la valeur, ≤ 3 jours, un seul compte, jamais dans le nuage, effacé à la déconnexion).
Rangé seulement sur la vue d'ouverture (Vinted · Annonces, compte « Tous », recherche vide), une fois
toutes les données là. Liste blanche : la phrase, la carte des chiffres (libellés VUS), le NOMBRE de
puces de compte, et 24 vignettes au plus (N°, titre 60 car., prix). Jamais photo, lien, identifiant,
nom de compte, prix d'achat, note. Montré seulement si l'écran va s'ouvrir sur « Tous »
(`compteEffectif` vide). Inerte, « Mis à jour il y a N min ».

## 6. Preuves
**Mesure** (`_mesure-demarrage.cjs`, `REPRISE=2`, octets lus) :

| | avant (`origin/main`) | après (1er passage) | après (2e passage, version finale) |
|---|---|---|---|
| Ma journée 1re | 2 708 Ko | 2 781 Ko | 2 453 Ko |
| Ma journée 2e / 3e | **927 / 927 Ko** | **458 / 458 Ko** | 766 / **456 Ko** |
| Annonces 1re | 2 889 Ko | 2 961 Ko | 2 961 Ko |
| Annonces 2e / 3e | **1 108 / 1 108 Ko** | **638 / 638 Ko** | **636 / 636 Ko** |
| les deux familles, 2e | ~490 Ko (7 lectures) | **21 Ko** (2 nombres + 2 « depuis ») | |

(Ma journée 2e à 766 Ko au 2e passage : la fraîcheur des comptes est lue tard, la page du banc s'est
fermée avant que sa copie soit rangée — rangée sans faire attendre l'écran ; la 3e ouverture la sert.
Gain à la 2e/3e ouverture : −51 % Ma journée, −42 % Annonces.)

**Banc `scripts/bancs/ouverture-legere-2.cjs`** (390 tactile clair, 1512 sombre) : 1 · A (aucune
relecture entière, versions seules, 563 → 21 Ko ; instantané montré, inerte, sans photo ni lien,
puis remplacé) · R (transaction réécrite reçue seule, copie fraîche à 520) · D (ligne partie ⇒
relue entière) · K (panne ⇒ « Vu à hh:mm · pas relu », copie gardée, lecture d'avant tentée, aucune
écriture) · C (autre compte : tout relu, copies à lui, instantané de l'autre jamais montré).
**46 verts, 0 rouge.** Sur `origin/main` (banc copié dans l'arbre `git archive`) : **34 rouges**.
Mutation au navigateur (copie servie quand le nombre est illisible) : K rouge (2 rouges).
Banc du lot K (`ouverture-legere.cjs`) : 32 verts, 0 rouge.

`scripts/tests/copie-familles.test.mjs` 9/9 ; mutations (chacune rouge) : copie servie sur nombre
illisible · nombre ignoré · lignes écrites ignorées (3) · date future qui repousse la borne · pas de
relecture 24 h · date non ISO gardée. `copie-lignes` 10/10, `repartition-cache` 2/2 (contexte de test
complété de `lireTxnMeta`), `colis-ventes-instantanes` 6/6, `journee-instantanee` 6/6.

Faux PostgREST (`_base-volume.cjs`) : `Content-Range` exposé au navigateur (CORS, comme Supabase —
sans lui le nombre est illisible et l'app relit tout, ce qui a été vu au banc), `or=(updated_at.gte."…")`
et valeurs entre guillemets. `_mesure-demarrage.cjs` : `REPRISE=2` (3e ouverture).

Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
lectures-lourdes, lecture-groupee, inventaire-hors-ligne (`pagination-ordre` : le rouge préexistant
d'`api/_lib/pilotage.js`).

**`vitesse.cjs`** avec `VITESSE_REFERENCE` (texte de `origin/main`) : 85 rouges sur `origin/main`,
68 après (seuils anciens préexistants ; « transactions balayées deux fois au plus » passe au vert).
Ma journée 1512 : texte identique ; 390 : seule la bande d'état du haut diffère (« Vérification de
tes données… » / « Extension jamais vue » : l'instant de la capture), tout le reste identique.
Autres écarts : heures « vérifié à 12:03 / 12:12 » (l'horloge du passage) et bandeaux du haut.

**`chargement.cjs`** (même banc, deux builds) : `origin/main` 14 rouges, après **13** (mêmes familles :
« pas su » transitoires sur les cartes et CLS de Messages/Stock, préexistants ; un a basculé dans chaque
sens d'un passage à l'autre). Un 1er passage avait 3 rouges de plus (« Qui dorment : lecture… » à
1512 px) : la 1re ouverture attendait IndexedDB puis le rangement — corrigé (marque
`vrm_copies_familles` lue sans attendre, rangement sans faire attendre l'écran), revérifié vert.

Captures regardées (390 / 1512) : instantané d'Annonces aligné sur l'écran vrai (tête, puces, carte,
place des vignettes), libellés de la carte sans chiffre dupliqué.

## 7. Ce qui reste
- `vinted_item_details` et `email_track_*` : voir §4 (il faudrait d'abord une date écrite par tous).
- La 1re ouverture paie ~70 Ko de plus (champs de version) et deux petites lectures.

## 8. Geste de Julien
Aucun.
