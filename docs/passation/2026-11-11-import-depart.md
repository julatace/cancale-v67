# 11 nov. 2026 · Import de départ — tout l'historique Vinted dès le premier jour (extension 5.344.0)

Branche `claude/import-depart`. Aucune PR (la session principale intègre). Extension **5.344.0**
(5.343.0 réservée à un autre lot).

Julien : « un nouveau vendeur récupère tout son historique Vinted (ventes, achats) dès le premier
jour. L'extension lui dit quand elle a tout capté ; s'il y en a beaucoup, je veux une barre de
progression. »

## Le problème

La visite lit au plus **10 pages de 100 commandes** par type (`pageActiveFetch`, `toutesCommandes`).
Au-delà de 1 000 ventes (ou achats), le reste n'était **jamais** lu. Et rien ne disait au vendeur
« c'est tout » ou « il en reste ».

## Ce qui change dans l'extension (`background.js`, bloc « L'IMPORT DE DÉPART »)

- **`importerHistorique(uid)`** : un passage lit **4 pages** de 100 (`/api/v2/my_orders?type=…&page=N&per_page=100`),
  les **ventes d'abord, puis les achats**, et reprend **là où il s'était arrêté** (`vrmImport` dans
  `chrome.storage.local`, §4.9).
- **Départ tout seul** à la première fois qu'un compte est vu (aucun état noté) : la base dit ce qu'elle a
  déjà, en **scalaires** (`nItems`, `payload.pagination.total_entries`, §4.2/§4.4) :
  - complet (rangées ≥ total) ⇒ « Tout est récupéré ✓ », **aucune lecture chez Vinted** ;
  - sinon on reprend **une page avant** ce que la base porte (1 000 rangées ⇒ page 10 : une page de
    recouvrement, une vente neuve décale la liste) ; rien rangé ⇒ page 1 ;
  - base muette ⇒ **rien ne part** (pas su). Un total absent (`null`) n'est **jamais** lu comme 0 (défaut
    trouvé par l'audit, corrigé).
- **« Tout récupérer »** (carte du logo, ou l'app) : repart de la page 1, sur SON clic, pour **le compte de
  l'onglet seulement** (`demanderImportTout`).
- **Garde-fous (§3), aucun retiré** :
  - compte de l'onglet seulement (`gardeLecture`), **relu après chaque page** : un compte qui change en
    route ⇒ la page est jetée, elle n'avance pas ;
  - une requête à la fois (`vintedGet` → `requeteVinted`) et **un passage à la fois** (`_importEnCours`) ;
  - **DANS le budget de LECTURE de 20/h** — aucun budget nouveau ; classe `import` au même étage que la
    relecture des autres comptes : **jamais la place de l'argent et des colis** (versements, codes,
    preuves, relevés ; « pas su » ⇒ leur réserve entière, 13) ;
  - **12 pages par heure au plus** (`IMPORT_MAX_HEURE`, compteur `vrmImportLus`) ;
  - pause **aléatoire de 3 à 8 s** entre deux pages ;
  - un 429/403 pose la pause (`requeteVinted`) et **arrête** la série ; des GET seulement.
- **Fusion sans perte** : chaque page passe par `storeHarvestRow` (envoi léger, fusion par n° de
  transaction, `fusionnerCommandes`). Une page profonde ne vole jamais le haut ; une commande rangée
  hors des pages reste. **Une page que la base n'a pas prise n'avance pas** (relue au passage suivant).
- **Quand** : le passage de fond `tickImport` (alarme `vrm-import`, **5 min**) avec un onglet vinted.fr
  ouvert, le compte de son cookie, une session VRM, aucune pause, une base qui répond, un compte capté ;
  et **1 min après chaque visite** (`planifierImport`) — jamais dans la rafale de la visite elle-même
  (dans la visite, il cassait `audit-budget-lectures` et `audit-ventes-fusion` : retiré, tranché).
- **Les photos** laissent un passage (4 lectures) à l'import **seulement quand il a noté** des pages à
  lire (`vrmLecturesDues.import`) ; un compte sans import ne prive pas les photos.
- Rythme mesuré : 2 160 ventes + 340 achats = 26 pages ⇒ **≈ 2 h 10, Vinted ouvert** (12 pages/h).

## La progression — vraie, publiée dans SA ligne

`import_vinted_{uid}` (jamais `main`), ≈ 400 octets, écrite une fois par passage :

```
{ v:1, type:'import', uid, code:'5.344.0', capturedAt,
  etat: 'attente' | 'encours' | 'pause' | 'fini',
  ventes: { lus, total|null, pages, fini }, achats: { lus, total|null, pages, fini },
  debut, fin|null, at, repriseA|null, cause: 'vinted'|'budget'|'rythme'|null, resteMin, demande }
```

- `lus / total` quand Vinted donne le total ; sinon `pages` (« 3 pages lues · encore… ») ;
- `fini` seulement quand la **dernière page** est atteinte (vide, ou `total_pages` atteint) — jamais sur
  une page courte (Vinted peut plafonner `per_page`) ;
- `repriseA` : « En pause : Vinted freine. Reprise à 14:32. » / « En pause pour ménager ton compte… » ;
- `resteMin` : pages restantes ÷ 12 par heure.

## Où on le voit

- **Carte du logo** (`vrm-badge.js`, ligne « Ton historique Vinted ») : la phrase, une barre fine par type,
  « Tout récupérer » (sauf pendant une lecture).
- **App** (`src/importDepart.js` = règle, `src/ImportDepart.jsx` = dessin, `src/styles-import-depart.css`) :
  - **Ma journée** : une barre fine par compte en cours, en pause, arrêté (sans nouvelles depuis 20 min ⇒
    « En attente : ouvre vinted.fr sur ce compte. », ambre), ou fini depuis moins d'un jour ; rien sinon ;
  - **Paramètres → Mes comptes → Mon historique Vinted** : chaque compte, son état, et « Tout récupérer »
    pour le compte ouvert sur vinted.fr ; extension trop ancienne ⇒ « Mets l'extension à jour (5.344.0) ».
- **`EXT_CAPACITES.importdepart = '5.344.0'`** (fonction `importerHistorique`, `audit-coherence`).

## Pour le lot « accompagnement nouveau vendeur » (étape « premier compte lu »)

Lire l'état simple, sans rien recalculer :

```js
import { lireImportDepart, etatSimpleImport } from './importDepart.js';
const etats = await lireImportDepart(uids, lireTout);   // { [uid]: état | null } ou null (pas su)
etatSimpleImport(etats && etats[uid]);                  // { etat, n, N }
// etat : 'attente' · 'encours' (n sur N) · 'pause' · 'arrete' · 'fini' · null (pas su / rien publié)
```

« Pas su » (`null`) ne vaut jamais « fini ». `N` est `null` tant que Vinted n'a pas donné les deux totaux.

## Preuves

- `npm run build` vert.
- Audits obligatoires verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets, extension-zip.
- **`scripts/audit-import-depart.cjs`** (vrai `background.js` dans `_fond-vm.cjs`) : **45 contrôles verts**
  (compte neuf, budget horaire, jusqu'au bout 1 250 ventes + 230 achats uniques et rien perdu, base déjà
  complète, reprise page 10, 429, autre compte / compte qui change, base qui refuse, base muette, réserve
  de l'argent, une à la fois, sans onglet, carte, « Tout récupérer » carte/app/autre origine, réserve des
  photos). **Rouge sur origin/main** (0 vert, 15 rouges) et **13 mutations sur 13 mordent**
  (`--mutations`).
- `audit-budget-lectures` et `audit-ventes-fusion` : verts (rouges tant que l'import tournait DANS la
  visite — d'où le passage de fond).
- Les 128 audits qui lisent `background.js` : comparés à origin/main (voir « Rouges restants »).
- Banc **`scripts/bancs/import-depart.cjs`** (390 tactile et 1512, clair et sombre) : voir le résultat
  ci-dessous ; captures regardées.

## Reste / limites

- La forme de `my_orders` à 100 par page est celle déjà lue par la visite ; `total_entries` /
  `total_pages` sont ceux que l'extension lit déjà. Pas mesuré sur un compte de 10 000 ventes
  (garde-fou : 300 pages par type).
- Deux Chrome sur le même compte importent chacun de leur côté (rare ; même règle, fusion sans perte).
- Les dates de versement des ventes anciennes arrivent ensuite par `capterDatesVersement` (5.341), à
  leur rythme — l'import n'en lit aucune.

## Geste de Julien

Installer l'extension **5.344.0** (remplacer le dossier, puis ⟳ dans chaque Chrome ; Orion :
`VRM-Orion-dossier.zip`), puis laisser **vinted.fr ouvert** sur chaque compte jusqu'à « Tout est
récupéré ✓ » (carte du logo, ou Paramètres → Mes comptes → Mon historique Vinted).
