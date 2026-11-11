# 11 nov. 2026 — Revenir en arrière après une mauvaise manipulation

Branche `claude/restauration` (depuis `origin/main`, `main` refusionné par un vrai merge).
**Aucune écriture en base réelle.** Migration 033 **écrite, pas appliquée**. Aucune PR.

## Ce qui change pour lui

Paramètres → **Sécurité et sauvegarde** → **« Revenir en arrière »** (le groupe qui porte
« Sauvegarde complète », « Corbeille » et « Restaurer une sauvegarde » — c'est « Mes données » ;
le titre du groupe n'a pas été renommé : `audit-onglets-d` et le banc `onglets-d` le tiennent).

1. **Choisir un moment** : la liste des points, le plus récent en haut (« 10 nov., 11:57 ·
   Avant une action en série · Saisie en série des prix d'achat »). Les points se posent seuls :
   - **avant chaque action en série** : l'ouverture de la saisie en série des prix d'achat, la
     répartition d'un lot ;
   - **avant chaque import** : un tableur d'achats, une « Sauvegarde complète » restaurée (là, le
     point est OBLIGATOIRE : sans lui, l'import n'écrit rien), l'ancien format de fichier ;
   - **une fois par jour** (30 s après l'ouverture, s'il n'y a aucun point aujourd'hui sur le
     serveur) ;
   - « Poser un point maintenant » (à la main) ; et **« Depuis une sauvegarde complète »** prend
     un fichier comme moment.
2. **L'aperçu précis** : « 12 prix d'achat remis · 3 notes · 1 numéro », puis par catégorie
   ses lignes « maintenant → au moment choisi » (N°1 · 99 € → 31 €), et ce qui ne bougera pas,
   dit (« N°8 : porté par une autre paire, pas rendu », « N°62 : attribué depuis, il reste »).
3. **Choisir quoi** : une case par catégorie — prix d'achat, liens achat ↔ vente, notes,
   dépenses et achats hors plateforme, réglages, numéros.
4. **Les valeurs plus récentes** (un prix tapé DEPUIS ce moment, une note écrite depuis, une
   dépense ajoutée, ou une valeur retouchée APRÈS un point plus récent) sont listées dans un
   cadre ambre, et l'écran **demande** : « Les garder » / « Revenir quand même ». Tant qu'il
   n'a pas répondu, « Revenir à ce moment » reste fermé.
5. **Confirmer** (une feuille redit le résumé). Ensuite : « Retour en arrière fait · 12 prix
   d'achat remis · 3 notes · 1 numéro · Enregistré » et **« Annuler la restauration »** — aussi
   plus tard, depuis la liste (le point « Avant une restauration »).

## Les règles (src/restauration.js, module pur)

- **Rien de plus récent n'est effacé sans être montré et demandé** (ci-dessus). Un réglage
  posé depuis n'est jamais retiré ; une fiche disparue n'est jamais recréée (« voir la Corbeille »).
- **Les numéros ne reculent jamais (§5)** : un N° attribué depuis (ou changé) reste ; le pool
  `vinted_used_numeros` ne fait que grandir (un morceau du pool ne peut qu'ajouter) ; la
  restauration peut seulement **rendre** un N° à une fiche (ou une vente) qui n'en porte plus,
  et seulement s'il n'est porté par AUCUNE autre (fiche, vente, lien Leboncoin `vrm_lbc_liens`,
  N° Vestiaire) et pas rendu deux fois dans la même restauration. « Annuler la restauration »
  ne retire JAMAIS un N° rendu (il a pu être écrit sur un carton). Une sauvegarde d'une autre
  version de numérotation (d'avant la 013) ne rend aucun N° (catégorie fermée, dit).
- **Une ligne ne nomme jamais une fiche par son ANCIEN N°** : le N° d'aujourd'hui, sinon le
  titre et l'identité de l'annonce (l'ancien N° peut être porté par une autre paire).
- **Écriture conditionnelle** (le moteur de la corbeille, `src/corbeille.js`) : chaque morceau
  ne s'écrit que si la valeur est encore celle vue à l'aperçu ; ce qui a changé entre-temps est
  gardé et compté (« 1 valeur changée entre-temps : gardée »). **Une lecture ratée n'écrit rien.**
  Les clés de `main` s'écrivent par l'écrivain de la corbeille (`ecrireCleCorbeille` →
  `_ecrivainVrm` → `cloudPush`, comparer-et-échanger sur `data.rev`).
- **Le point AVANT la restauration est obligatoire** : il porte l'inverse (`annulation`) ; s'il
  ne peut pas être posé (base injoignable), rien n'est écrit et l'écran dit « Rien n'a changé ».

## Où vivent les points (§4.4 — pas de ligne lourde lue partout)

- Des lignes **dédiées** de `app_data`, sous SON propriétaire : `restore_0` … `restore_23`.
  Jamais dans `main` (pas dans `SYNC_KEYS`), jamais lues ailleurs que sur cet écran.
- Un point est **projeté** : prix, liens, N° des fiches et des ventes (ni titre ni photo),
  notes, dépenses, achats hors plateforme, réglages (chacun ≤ 50 Ko). 2 000 fiches ⇒ < 200 Ko ;
  plus de 1 Mo ⇒ pas écrit, et c'est dit.
- La **liste** se lit par `select=id,meta` (la colonne `meta` de la 004 : `at`, `raison`,
  `libelle`, `empreinte`, `rev`, `annulable`, `annulee` sont des scalaires de premier niveau).
  Un point entier (`select=data&id=eq.restore_N`) seulement quand il est ouvert (+ le point
  suivant, pour juger « retouché depuis »).
- **Rétention : 30 jours, 24 emplacements par compte.** Un point neuf prend le premier
  emplacement libre ou expiré, sinon celui du plus ancien ; deux points identiques de suite
  n'en font qu'un (empreinte). Écriture : POST pour un emplacement neuf, PATCH gardé par
  `data->>rev` sinon (deux appareils ne s'écrasent pas : on relit, 3 essais).
- **Rien côté serveur ne dépend du localStorage** : le choix de l'emplacement et le « point du
  jour » se décident sur la liste du SERVEUR ; une liste « pas su » ⇒ aucun point.
  L'instantané est pris sur l'appareil (le nuage lu, `isCloudReady`), au moment du geste.
- **Migration 033** (`supabase/migrations/033-points-de-restauration.sql`, écrite, PAS
  appliquée) : la base refuse elle-même un id `restore_…` hors des 24 emplacements et un point
  de plus de 1,1 Mo. Sans elle, l'app tient déjà les deux bornes. ⚠️ 031 a été prise puis
  supprimée le 10 nov. ; 033 est le numéro libre suivant à ce jour — vérifier avant de
  l'appliquer qu'aucune autre branche ne l'a pris.

## Le code

| fichier | quoi |
|---|---|
| `src/restauration.js` (nouveau) | la règle : instantané, aperçu, conflits, N°, morceaux, annulation, emplacements, fichier |
| `src/App.jsx` | `poserPoint`, `pointAvant`, point du jour, `restaurerMorceaux`, `annulerRestauration`, écran `RevenirEnArriere` ; points avant la saisie en série, l'import tableur, la répartition d'un lot, l'import d'une sauvegarde (obligatoire) et l'ancien format ; icône `undo` |
| `src/ecrans/Reglages.jsx` | la ligne « Revenir en arrière » dans Sécurité et sauvegarde |
| `src/styles-restauration.css` | l'écran (variables DA6 de la corbeille ; l'ambre seulement pour la question) |
| `supabase/migrations/033-points-de-restauration.sql` | la garde des emplacements (pas appliquée) |
| `scripts/audit-restauration.cjs` | 74 contrôles + `--prouve` (10 mutations) |
| `scripts/bancs/revenir-en-arriere.cjs` | le banc de rendu (base inventée) |

## Preuves

- `node scripts/audit-restauration.cjs` : **74 OK, 0 KO** (le vrai module : instantané projeté
  et léger ; aperçu « 12 prix d'achat remis · 3 notes · 0 numéro » ; conflits montrés et demandés ;
  N° : attribué depuis gardé, rendu seulement si libre, refus si porté par une fiche / une vente /
  un lien Leboncoin, jamais rendu deux fois, pool append-only, 50 paires identiques ; écriture
  conditionnelle, lecture ratée ⇒ 0 écriture ; annulation exacte, N° rendu gardé, idempotente ;
  emplacements 24/30 j ; point du jour sur la liste du serveur ; fichier d'avant la 013 ;
  branchement). Sur `origin/main` (arbre extrait par `git archive`, audit copié dedans) : tombe
  (module absent). `--prouve` : **10/10 mutations attrapées** (N° remplacé, conflit remis sans
  demander, pool qui rétrécit, annulation qui retire le N°, écriture sans tout lire, N° rendu
  porté ailleurs, conflits écrits sans réponse, point du jour sur un « pas su », emplacement hors
  des 24, fiche nommée par son ancien N°).
- Banc `revenir-en-arriere` (390 px tactile et 1512 px, base inventée, `main` servie avec PATCH
  gardé par `data.rev`, points servis par `select=id,meta`) : **tout vert** — liste lue par
  `meta` ; aperçu 12 · 3 · 1, N°8 refusé (porté par it30), 45 € tapé depuis MONTRÉ et DEMANDÉ,
  bouton fermé sans réponse ; « Les garder » + confirmer : le point `restore_1` (avec l'inverse)
  part AVANT `main`, 31…42 € reviennent, 45 € gardé, 3 notes revenues, N°7 rendu, N°8 vide, pool
  intact ; « Annuler la restauration » : point « avant l'annulation », 99 € et notes effacées
  reviennent, **N°7 reste**, point marqué annulé ; point refusé (503) ⇒ **rien écrit dans
  `main`**, « Rien n'a changé » ; point du jour posé dans l'emplacement libre (1512, 30 s).
  Sur `origin/main` (archive, build, banc copié) : **4 rouges**. Mutation dans l'app (retirer
  « sans point, rien ne s'écrit ») : le scénario 5 tombe (4 rouges).
- Captures regardées (390 et 1512) : la ligne dans Paramètres, la liste, l'aperçu (haut et bas,
  question des valeurs plus récentes), « fait », l'échec. Défauts vus et corrigés en route : une
  fiche qui avait perdu son N° était nommée « N°8 » alors qu'une AUTRE paire porte le N°8 ;
  « Voir les autres » dessiné en bouton natif ; l'identité coupée à 390 px ; la valeur plus
  récente seulement comptée, pas montrée.
- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets` verts ; audits numéros (`conflits-numeros, etiquette-numero,
  garde-numeros-rapide, masquees-numeros, numero-ecrit, numero-etiquette, numero-vinted,
  numeros-lettres, numeros-vestiaire, numerotation-lecteurs, prix-numerotage,
  recherche-numero, reprise-numero`) et `corbeille, geste-annulable, annuler-commandes` verts.
- **Tous les audits (463), après le merge d'`origin/main`, comparés à `origin/main`** (arbre
  extrait, même machine) : la branche a 5 rouges — `colis-envoi`, `photos-vinted`,
  `relier-compte`, `rouge-doublon`, `violet` — **avec exactement les mêmes lignes rouges sur
  `origin/main`** (pas de ce chantier). `argent-lbc` était tombé sur un port pris (deux suites en
  parallèle) : vert relancé seul. `coque-parametres` (une icône par ligne) : l'icône `restore` en
  double a été évitée (nouvelle icône `undo`), vert.
- Bancs voisins : `achats-hors-plateforme` (la corbeille) **vert** ; `onglets-d` rouge
  (K1, « Déclarer ») **à l'identique sur `origin/main`**.
- ⚠️ Le point du jour part 30 s après l'ouverture : un banc qui tourne plus de 30 s verra un
  GET `id=like.restore_*` puis un POST `restore_0` sur son faux serveur (aucun banc existant n'est
  tombé pour ça dans la suite ci-dessus).

## Ce qui n'est pas restauré (exprès)

- Les données CAPTÉES (ventes, achats, messages, annonces) : une copie ancienne écraserait une
  capture plus fraîche (§4.2) ; l'extension les recapte.
- `vinted_txn_link` (verrou vente → annonce, réparé tout seul), les liens Leboncoin / eBay /
  Vestiaire (ce sont des N°), la numérotation (`vrm_numerotation`, préfixe, « je numérote
  moi-même »), les jetons, et les interrupteurs qui AGISSENT sur un site (offres auto, retrait
  eBay automatique, réponses auto) : ils se rallument à la main.
- Un réglage rangé en texte brut (pas en JSON) n'est pas repris.

## Reste / limites

- « Baisser le prix » en série agit sur Vinted : pas restaurable ici (le prix Vinted n'est pas
  une donnée de VRM). Le « Remplir en série » des cases du Stock n'a pas de point (le plan du
  Stock vit sur sa ligne, comme pour la corbeille).
- Le point du jour se pose 30 s après l'ouverture de l'app ; un jour sans ouverture n'a pas de
  point (pas de cron serveur : le serveur ne connaît pas l'état de l'appareil).

## Geste de Julien

Aucun pour s'en servir. Optionnel : appliquer la migration 033 quand VRM est peu sollicité.
Essayer : Annonces → « Compléter » (saisie en série) ⇒ un point se pose ; puis Paramètres →
Sécurité et sauvegarde → Revenir en arrière → « Voir ».
