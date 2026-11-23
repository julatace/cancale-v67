# Annonces à égalité — 19 nov. 2026 (branche `claude/annonces-a-egalite`)

Julien (photo de l'écran Annonces → Leboncoin : des rangées vides, un énorme « Relier à Vinted ») :
« je veux que tout soit comme Vinted, avec toutes les informations à côté : les prix minimum acceptés, relier un
achat, relié à Vinted. Ce n'est pas parce que Vinted est ma plateforme principale que c'est la plateforme
principale des autres. » Puis : bouton « Actions », « brouillons à refaire » fantômes, N° donnés par l'app.

## 1. Mesures (base de prod, lecture seule, 19 nov.)

| quoi | mesuré |
|---|---|
| Leboncoin | 194 annonces rangées (tous états), 9 en ligne ; **1 seule avec un N°** ; 4 liens posés à la main ; 0 prix d'achat, 0 prix mini, 0 place (rien ne pouvait les porter sans fiche Vinted) |
| eBay · Vestiaire | 4 · 3 annonces rangées ; 1 lien eBay |
| `vrm_articles_sites` | 0 (la clé est neuve) |
| « Brouillons à refaire » | 6 lignes du coffre à l'état `a-publier` (toutes avec un `draftId`) ; brouillons vus dans les dressings : 2 ; `vinted_brouillon_*` : 5 brouillons, 7 publiés. **Aucun des 6 n'est dans un dressing relu** ; 3 ont une suppression PROUVÉE (`harvest_{uid}_supprimees`), 2 sont absents d'une lecture COMPLÈTE de leur compte. Le « 52 » vu par Julien ne se retrouve pas dans la base d'aujourd'hui (à revoir avec lui : autre compte VRM, ou un autre compteur de l'écran). |
| Pourquoi sans N° (Leboncoin, eBay) | la numérotation automatique (5.382 `annoncerNumerotes`) ne regarde QUE les annonces Vinted ; Leboncoin n'était numéroté que par une référence VRM ou un lien à la main. |

## 2. Le tableau de parité (avant → après)

Source unique : `PARITE` dans `src/articles/modele.js` (l'audit et l'écran la lisent).

| information / geste | Vinted | Leboncoin avant → après | eBay avant → après | Vestiaire avant → après |
|---|---|---|---|---|
| N° de rangement | oui | seulement relié/réf. → **donné seul** | SKU seulement → **donné seul** (`vrm_ebay_liens[id].propre`) | oui (`vrm_vc_numeros`) |
| place dans le stock | oui (par N°) | non → **oui** (par N°) | non → **oui** | oui |
| prix · prix mini | oui | prix seul → **+ prix mini** | prix seul → **+ prix mini** | prix seul → **+ prix mini** |
| prix d'achat · achat relié | oui (fiche) | seulement relié → **oui** (`vrm_articles_sites`) | idem → **oui** | idem → **oui** |
| bénéfice | oui | non → **oui** | non → **oui** | non → **oui** |
| en ligne depuis | lu | lu | lu | **limite du site** |
| favoris · vues · messages | lu · lu · — | lu (stats) | observateurs · vues · **limite** | favoris · **limites** |
| état (en ligne, à confirmer, vendue…) | oui | oui | oui | oui |
| fiche, « Compléter » | oui | via la fiche (agent fiche-directe) | idem | idem |
| baisser le prix | extension `baisseprix` | extension `lbcprix` (écran du site) | API | extension `vcprix` (écran du site) |
| acceptation auto des offres | extension | **limite du site** | seuil natif eBay | **limite du site** |

Les limites sont dites UNE fois en pied de liste (`LIMITES`, `egalite.limite.*`), jamais par rangée.

## 3. Le modèle — l'article, pas l'annonce Vinted

`src/articles/modele.js` (pur) : un **article** = une paire ; une ou plusieurs annonces. Deux annonces sont le
même article seulement par identité : le lien posé par SON toucher (`vrm_lbc_liens`, `vrm_ebay_liens`,
`vrm_vc_liens`) ou le même N° lu par les règles de l'app. Jamais le titre (50 annonces au même titre = 50 articles).

Où vivent les faits :
- l'article a une fiche Vinted ⇒ la fiche (`vinted_annonce_numeros`), comme avant ;
- sinon ⇒ **`vrm_articles_sites['Leboncoin:123']`** = `{ buyPrice, buyFromId, buyFrom, min, refuse, numero: { valeur, auto, ecrit }, reliee, barre }`
  (clé synchronisée, écrite par `gesteVrm` seulement, annulable 5 s) ;
- le N° reste où toute l'app le lit : `vrm_lbc_liens[id]`, `vrm_ebay_liens[id] = { numero, propre: true }`, `vrm_vc_numeros` ;
- la place : `vrm_slots` par N°.

Aucune migration, aucune donnée déplacée. Lecture ratée (carte `null`) ⇒ `{ refus: 'pas-su' }`, aucune opération.
**Lien posé plus tard avec Vinted** : `opsFusion` copie sur la fiche ce qu'elle n'a pas ; une valeur différente des
deux côtés, ou **deux N° en jeu ⇒ une question, rien n'est tranché seul** ; le N° qui ne reste pas va dans
« N° à barrer » (jamais redonné).

**Numérotation seule** (`numeroterSites`, App.jsx, règle `src/articles/numerosSites.js`) : une annonce Leboncoin ou
eBay en ligne (lecture fraîche de SON site), sans identité, reçoit `prochainLibre` (après le plus haut, jamais un
trou, jamais un N° servi, pool append-only, réserves lues). Un vendeur qui a AUSSI des comptes Vinted : l'annonce est
d'abord « à relier » (elle a peut-être déjà son carton) — « elle n'est pas sur Vinted » (parcours de liaison,
`propre`) ⇒ son N° est donné. « Je numérote moi-même » ⇒ rien. Chaque N° donné est noté « à écrire ».

## 4. L'écran

`src/natif/ecrans/Annonces.jsx` (vue pure, composants natifs) + `src/ecrans/AnnoncesEgalite.jsx` (lectures et
écritures). Monté par App.jsx sur Annonces (`ECRANS_NATIFS` contient `annonces`).
- segments **En ligne · À publier · Dorment** (Dorment : en ligne depuis ≥ 30/60/90 j, la règle de `quiDorment`) ;
  « Filtrer » par site (aucun site par défaut) ;
- téléphone : `Rangee` 72 — vignette, titre, « T. · site · compte », prix ; dessous « mini … · acheté … » ;
  ordinateur : tableau Article · N° · Sites · Prix · Prix mini · Acheté · Bénéfice · En ligne depuis ; un « — » se
  touche et ouvre SA saisie ;
- aucun plein par rangée ; « à relier » est un mot ambre discret, qui ouvre le parcours de liaison
  (`vrm:liaison-ouvrir`, agent `claude/liaison-sites-guidee`) ;
- **« Actions »** : Republier · Republier à la main · Mettre en brouillon · Remettre en ligne · Baisser le prix ·
  Publier ailleurs. Le choix passe la liste en sélection (cases, « Tout sélectionner »), une phrase d'explication,
  puis le plein « {Action} · N annonces ». Les actions Vinted partent par `demanderActionAnnonces` vers l'écran
  Annonces Vinted d'hier, **monté et caché**, qui les lance par `lancerActionSel` — le corps exact de l'ancien
  `onLancer`, avec la même règle `actionsPossibles` (un compte, celui de l'onglet, extension à jour). Rien de neuf
  n'est automatisé.
- « Tout l'écran {site} » en bas de la liste filtrée : les outils propres d'un site (rien n'est perdu, §4.11).
- « prix d'achat inconnus 11/52 » et « N annonces sans numéro » ne sont plus montrés (l'écran d'hier est caché) ;
  l'information vit dans la colonne « Acheté » (« — » qui se touche).

**Ce que dit l'explication de « Republier à la main » — vérifié dans le code** : le N° ne suit PAS tout seul une
annonce republiée sans l'extension. `liensRepubMain` (src/annoncesActions.js) : dès que VRM lit la nouvelle annonce,
il la propose, et SON « C'est celle-ci » lui redonne le N° (`repriseNumerosRecreation`). Sur ce chemin, rien ne
relie la nouvelle annonce tout seul (ni photo, ni description : `numerodescription` ne sert que s'il numérote
lui-même ; `photovrm` 5.393 n'est pas branché sur la reprise du N°). La phrase de l'écran dit exactement cela ; si
Julien veut « l'extension reconnaîtra après », c'est un chantier à part (identité à prouver, §5).

## 5. « Brouillons à refaire »

`src/brouillonsARefaire.js` : par l'id du brouillon — en ligne ⇒ réglé ; suppression prouvée ⇒ sort ; absent d'une
lecture COMPLÈTE et plus récente de son compte ⇒ sort ; sinon il reste et c'est dit (« pas su »). Rien n'est supprimé
du coffre ; la feuille dit combien sont sortis.

## 6. Preuves

| contrôle | résultat |
|---|---|
| `scripts/audit-parite-sites.cjs` | 96 verts ; `--mutation=toutes` 17/17 ; rouge sur `origin/main` |
| `scripts/audit-brouillons-a-refaire.cjs` | 16 verts ; 6/6 mutations ; rouge sur `origin/main` |
| `scripts/bancs/annonces-egalite.cjs` | 179 verts (390 tactile, 1512, 1280, clair et sombre, 6 bases) ; `--prouve` 4/4 ; captures regardées (le titre coupé à 8 lettres au téléphone a été corrigé : titre sur deux lignes). Machine saturée : une 2ᵉ passe a calé sur une navigation (délai), 167 verts et aucun rouge avant. |
| audits identite, coherence, traduction, tdz, variables, quoi-de-neuf, a-retirer-ailleurs, stock-annonces, icones, budget-lectures | verts |
| `vite build` | vert |

(`audit-studio` S2 « la coque et `<main>` portent data-espace » est rouge, venu de la coque native — pas de ce chantier.)

## 7. Ce que les autres agents branchent

- **Fiche (`claude/fiche-directe`)** : pour un article sans annonce Vinted, lire `construireArticles(...)` (mêmes
  champs : `numero, prix, prixMini, achat, achatRelie, benefice, place, depuis, favoris, vues, annonces[], porteur`)
  et écrire par `opsFait({ article, champs, cartes })` (refus `pas-su` ⇒ rien). La rangée « Toute la fiche »
  (`onFiche`) n'est pas encore branchée.
- **Liaison (`claude/liaison-sites-guidee`)** : quand le lien est posé, ajouter `opsFusion(...)` dans le MÊME geste
  que `opsRelier` ; une question (`questions`) se pose à Julien, rien n'est choisi seul. Le journal `propre:<Site>:<id>`
  est lu par la numérotation.
- **Prix (`claude/prix-sans-manuel`)** : « Prix » d'une rangée envoie `vrm:prix-partout` avec le N°.

## 8. Limites et reste à faire

- Baisser le prix en série : Vinted seulement depuis « Actions » ; Leboncoin et Vestiaire par leur écran (« Tout
  l'écran {site} »).
- « Filtrer » ne propose pas encore le compte ni le tri.
- Les ventes / retirées ne sont plus un segment (la recherche et la fiche les montrent).
- Geste de Julien : aucun (pas de migration, pas d'extension neuve).
