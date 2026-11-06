# 6 nov. — Six filets pour que l'app « ne bug jamais » (v36, branche `v36-filets`)

Julien (6 nov.) : « que proposes-tu de plus pour que l'application ne bug jamais » —
il veut que ce soit fait, et (consigne ajoutée) **« ça ne doit pas nuire à l'app »**.
Chaque filet ci-dessous dit : ce qui est fait, la preuve (rouge sur l'arbre d'avant
et/ou mutation), la preuve qu'il ne nuit pas, et le geste qui reste.

Arbre d'avant = `46f18482` (branche `claude/project-review-nsk5su`). Les mesures de
durée ont été prises sur un conteneur **partagé et surchargé** (charge moyenne 40 à 70
sur 4 cœurs pendant toute la session) : elles sont des majorants, pas la durée en CI.

---

## 1. Une vérification qui bloque la fusion — `.github/workflows/verifier.yml`

**Fait.** Sur chaque PR vers `main` (et à la main, `workflow_dispatch`) :

| job | quoi | durée |
|---|---|---|
| `construire` | `npm ci`, `npm run build`, `dist/` en artefact (2 jours) | build 2 min 10 à 4 min ici |
| `audits` × 3 | `scripts/lancer-audits.cjs` part 1/3, 2/3, 3/3 (Chromium + Postgres installés) | ici : 316 audits en 13 min à 4 en parallèle sur la machine chargée ⇒ ~5 min par part attendues |
| `bancs` × 3 | `scripts/lancer-bancs.cjs` : nouveau-vendeur + garde-ecrans · navigation-tache, ventes-e2, journee-coherence, morceau-perime · colis-retirer-propre, annonces-actions, iphone-reprise, argent-mois | voir plus bas |
| `bancs-webkit` | 3 bancs sous WebKit, **non bloquant** (filet 6) | — |

Les jobs `audits`, `bancs` et `bancs-webkit` partent en parallèle après `construire` :
la durée totale est celle de la part la plus longue (cible < 20 min).

**`scripts/lancer-audits.cjs`** — tous les `scripts/audit-*.cjs`, N à la fois
(`AUDITS_PARALLELE`, défaut = cœurs, 8 au plus), chacun borné (`AUDITS_TIMEOUT_S`, 900 s :
`audit-renum-b` a pris **7 min seul** ici, sa base Postgres jetable), son groupe de
processus tué à l'échéance (SIGTERM puis SIGKILL). Les longs (`LOURDS`) partent en
premier et sont répartis entre les parts (`AUDITS_PART=k/n`). Un audit rouge est
**relancé une fois, seul** : vert seul ⇒ « instable », dit, non bloquant (mesuré :
`audit-recherche-unique` mesure « une frappe sur 10 500 entrées < N ms » et rougit à
44 ms quand quatre audits tournent à côté ; 4,4 ms seul). Rouge seul ⇒ rouge.
`AUDITS_FILTRE`, `AUDITS_JSON` pour le reste.

**Les rouges connus** — `scripts/audits-exceptions.json`, chacun avec sa raison et sa date :
`audit-chemin-json-guillemets` (il juge l'extension, chantier à part) et `audit-vc-recon`
(décision de Julien en attente). Ils sont **lancés quand même** (« rouge connu ») ;
repassés au vert, le lanceur dit « exception à retirer » ; une exception dont l'audit
n'existe plus fait échouer.

**Les zips de `public/`** : des audits les régénèrent (mesuré : `VRM-extension.zip`,
`VRM-Orion*.zip/xpi`). Le lanceur le signale sans échouer ; le job remet `public/`
(`git checkout -- public/`, `if: always()`).

**Mesures locales (6 nov.)** : 316 audits, 312 verts, 2 rouges connus, 1 instable
(`recherche-unique`), 1 trop long à 240 s (`renum-b`, d'où le délai porté à 900 s).
Les 8 bancs du lot : `nouveau-vendeur` dépasse 10 min sur la machine chargée (il rend
chaque écran à 2 largeurs × 2 thèmes) — d'où sa part à lui et un délai de 20 min par
banc ; les autres ont tourné vert (navigation-tache, colis-retirer-propre…) mais leurs
durées ne sont pas représentatives ici. **À relever sur le premier passage en CI**
(onglet Actions → `Vérifier avant fusion` → durée de chaque job) et ajuster les parts
si une dépasse 20 min.

**Preuve** : `actionlint` (version wasm, `npm actionlint@2.0.6`) : `verifier.yml`,
`controle-prod.yml` et `parcours-critiques.yml` propres ; une faute posée exprès
(`needs: construir`, `steps.atente`) est signalée — le contrôle peut échouer. Le
lanceur d'audits a été joué en entier (ci-dessus) et par filtre ; le lanceur de bancs
sur le lot.

**Ne nuit pas** : rien ne tourne sur la production ; aucun secret ; les audits et
bancs servent une fausse base et des données inventées ; le workflow ne se déclenche
que sur une PR (permissions `contents: read`).

### ⚙️ Geste (Julien ou moi) : rendre ce contrôle OBLIGATOIRE — pas encore fait
C'est un réglage du dépôt, pas un fichier : tant qu'il n'est pas posé, la PR montre
le rouge mais on peut quand même fusionner.
1. Laisser passer **une** PR avec ce workflow (les noms des contrôles n'apparaissent
   dans la liste qu'après un premier passage).
2. GitHub → dépôt `julatace/cancale-v67` → **Settings** → **Branches** (ou **Rules →
   Rulesets** → *New branch ruleset*).
3. Cible : la branche `main`.
4. Cocher **Require status checks to pass before merging** (Ruleset : *Require status
   checks to pass*), puis **Add checks** et choisir : `Construire`,
   `Audits (part 1/3)`, `Audits (part 2/3)`, `Audits (part 3/3)`,
   `Bancs principaux (Chromium, part 1/3)`, `… part 2/3`, `… part 3/3`.
   **Ne pas** ajouter `Bancs sous WebKit (Safari, non bloquant)`.
5. (Conseillé) cocher *Require branches to be up to date before merging*.
6. Enregistrer. ⚠️ Les sessions Claude fusionnent elles-mêmes (règle 2 du CLAUDE.md) :
   avec la règle posée, une PR rouge ne se fusionne plus — la session doit corriger,
   jamais contourner (ne pas cocher « Allow bypass » pour les agents).

---

## 2. Un garde-fou par écran et par feuille — `src/composants/GardeEcran.jsx`

**Fait.** Il n'y avait qu'**un** garde-fou (`EcranGardeFou`) autour de toute la zone des
écrans : un écran tombé emportait les bandeaux de la coque, et les **feuilles montées
hors de cette zone** (fiche d'une paire, « Le prix partout », « Publier ailleurs », lien
Vestiaire, Bienvenue, visite, sauvegarde, panneau de synchro, **recherche**) n'avaient
que le dernier filet de `main.jsx` : « L'application n'a pas pu démarrer », navigation
comprise.

- **25 écrans montés par la coque, avant comme après** (§4 loi 11, compté par
  `audit-garde-ecrans`), chacun dans `<GardeEcran nom="…">` ; la section d'un site
  d'une tâche (`Ventes · Vinted`…) a le sien (le titre et le filtre des sites restent) ;
  la coque garde un garde-fou d'ensemble (`coque:<écran>`) ; l'ancien `EcranGardeFou`
  est retiré (une forme, un chemin de notation).
- **9 feuilles** dans `<GardeEcran nom="…" feuille onFermer>` ; celles qui se
  calculaient par une IIFE dans la coque (`{x && (()=>{…})()}`, une erreur y plantait
  la coque elle-même) passent par `<Differe rendre={…}/>` : le même calcul, au même
  moment, mais SOUS le garde-fou. La feuille tombée s'affiche par un portail dans
  `.vrm-app-shell` (sinon la barre de recherche, qui porte un `backdrop-filter`,
  l'enfermait — vu sur la capture à 1512 px).
- Tombé : « **Cet écran a un souci** — Il n'a pas pu s'afficher. Le reste de
  l'application fonctionne… » + l'erreur en petit + **Réessayer** + « Recharger
  l'app » (feuille : **Fermer**). Forme d'`EtatPanne` (neutre, ni rouge ni ambre).
  ⚠️ La phrase « n'a pas pu s'afficher » est gardée : une quarantaine de bancs
  reconnaissent un écran tombé à elle.
- Noté par `noterPlantage` (src/plantages.js) avec `ecran: <nom>` et
  `origine: 'ecran' | 'feuille'`. Remis à zéro quand `resetKey` change (l'écran, la
  section, le N° de la fiche).
- Crochet de banc : `window.__VRM_BANC_PLANTE = '<nom>'`, **seulement servi depuis
  localhost / 127.0.0.1** (jamais sur vrm.center).

**Preuves.**
- `scripts/bancs/garde-ecrans.cjs` (390 tactile et 1512) : Ventes planté ⇒ son
  garde-fou, coque et navigation là, plantage noté « ventes » ; Ma journée s'ouvre ;
  retour sur Ventes ⇒ rendu (remis à zéro) ; Colis planté ⇒ « Réessayer » le remonte ;
  `ventes:vinted` planté ⇒ le filtre des sites reste et un autre site s'ouvre ; la
  recherche plantée ⇒ une feuille qu'on ferme, la coque reste. **Vert** sur le nouveau
  `dist/` (28 contrôles).
- **Mutation** (`dist/` construit avec un seul garde-fou, celui de la coque — le
  comportement d'avant) : **18 rouges**, dont « L'application n'a pas pu démarrer »
  quand la recherche plante (la navigation disparaît). Arbre d'avant : le crochet
  n'existe pas, donc le banc ne prouve rien là-dessus ; c'est la mutation qui prouve.
- `scripts/audit-garde-ecrans.cjs` : vert ; **22 rouges** sur l'App.jsx d'avant.
- Captures regardées (`SHOTS=`) : écran planté à 390 (carte + barre du bas
  utilisable), recherche plantée à 390 et 1512.

**Ne nuit pas.** Quand rien ne plante, `GardeEcran` rend ses enfants tels quels (aucun
élément, aucun état lu, aucune lecture). Mesuré (`MESURE=` puis `COMPARER=`, même jeu,
dist d'avant contre dist d'après, Ma journée · Ventes · Colis à 390 et 1512) : **texte
de l'écran identique et nombre de nœuds identique** sur les 6 écrans. Le NOMBRE de
lectures dépend de l'horloge (le même dist d'avant mesuré deux fois : 71 puis 75,
81 puis 89) : le banc juge l'**ensemble** des lectures différentes (voir § Mesures).
Les nombres de rendus React ne se comptent pas sur un build de production ; les nœuds,
le texte et les lectures sont ce qui se voit.

---

## 3. Les mises en ligne qui cassaient l'app ouverte

**Mesuré.** `vercel.json` : `/assets/*` en `Cache-Control: public, max-age=31536000,
immutable` ; Vercel Hobby n'a pas la *Skew Protection* (un ancien déploiement ne sert
plus ses fichiers). `public/sw.js` existe déjà (notifications push, AirPrint, hors
ligne) et sert DÉJÀ `/assets/` « cache d'abord » — mais seulement ce que la page a déjà
chargé, et il purge l'ancienne version à la navigation suivante. Le cas du 6 nov.
(« Unable to preload CSS for /assets/App-….css ») est un morceau que la page n'avait
**jamais** demandé : aucun cache ne l'a. `main.jsx` recharge déjà la page
(`vite:preloadError`, une fois par minute au plus), mais l'erreur était **notée comme
plantage** (rejouée par le banc : « Unable to preload CSS for /assets/BoiteEmails-….css »
dans le journal, arbre d'avant).

**Choix : option (a) seule.** Un morceau d'un ancien déploiement est **compté à part,
sur l'appareil** (`vrm_morceaux_perimes` : nombre, dernier message, date), jamais noté
comme plantage, et `main.jsx` le compte avant de recharger (`compterMorceauPerime`,
`MORCEAU_PERIME` / `estMorceauPerime` dans src/plantages.js : Chrome, Safari, Firefox, CSS).
**Option (b) non faite**, pour trois raisons : (1) `public/` est hors du périmètre de ce
chantier ; (2) pour servir un morceau jamais chargé, le service worker devrait
pré-télécharger TOUT le build à chaque version (des Mo par déploiement, 13 à 21
déploiements par jour) — c'est ce que la v5 du SW avait dû retirer ; (3) la consigne
« au moindre doute, ne le fais pas » : un SW qui garde une vieille version est pire que
le rechargement. Le rechargement reste (il est le seul remède sans *Skew Protection*).
Si Julien passe un jour en Pro : activer *Skew Protection* dans Vercel règle la cause.

**Preuves.** `scripts/bancs/morceau-perime.cjs` ouvre l'app, puis « met en ligne »
(tout `/assets/` pas encore chargé répond 404, comme Vercel) et ouvre E-mails (chargé à
la demande, sa feuille de style à part) : déploiement fini ⇒ **un** rechargement, E-mails
s'ouvre, aucun plantage, compté à part ; panne durable ⇒ toujours aucun plantage,
coque et navigation là, jamais de boucle. **Vert** sur le nouveau dist (1512 et 390),
**6 rouges** sur l'arbre d'avant (dont le plantage « Unable to preload CSS » noté).
`scripts/audit-morceau-perime.cjs` exécute src/plantages.js : vert, **6/6 mutations
rouges** (`--prouve`), rouge sur l'arbre d'avant.

**Ne nuit pas.** Aucun service worker touché ; aucun octet de plus vers la base (le
compte reste sur l'appareil) ; le rechargement est celui d'avant.

---

## 4. La veille des plantages — `api/_lib/veille-plantages.js`, cron du matin

**Fait.** Dans `api/ship-reminders.js` (le cron de 5 h UTC, PAS une 13ᵉ fonction —
`audit-fonctions-api` vert), après les rappels, le **matin seulement** :
1. UNE lecture **projetée** (`owner,id,message,ecran,navigateur,version,origine,at`,
   jamais `select=data`), filtrée par la base sur `meta->>at` (migration 004), paginée
   (`Range`) : les `plantage_*` de **tous** les vendeurs depuis la dernière veille (48 h
   au plus) ;
2. le bruit écarté : la liste **BRUIT de src/plantages.js** (exportée, importée, jamais
   recopiée), les morceaux d'un ancien déploiement, les signalements CSP ;
3. regroupés par message **normalisé** (noms minifiés de 1 à 3 lettres, fichiers
   hachés, chiffres : la même erreur garde la même clé d'un déploiement à l'autre ;
   « title » et « numero » restent deux types) ;
4. un type **jamais vu** (mémo `veille_plantages` du propriétaire, 200 types au plus)
   ⇒ **une** notification au **propriétaire de l'installation** (`VRM_OWNER_UID`)
   seulement : « VRM : un écran a planté (Colis, iPhone) — c'est noté, on corrige. »
   (plusieurs : « VRM : 2 nouveaux plantages (Colis, iPhone · Ventes, Windows) — … »).
   Le mémo est écrit **avant** l'envoi ; mémo pas écrit ⇒ rien envoyé ; lecture ratée
   ⇒ rien envoyé, rien écrit. Le toucher ouvre Réglages (le journal des plantages).

**Preuve.** `scripts/audit-veille-plantages.cjs` exécute la règle ET la vraie route
(fausse base, faux Web Push) : 32 contrôles verts ; **13/13 mutations rouges**
(`--prouve`) ; rouge sur l'arbre d'avant (9 rouges).

**Ne nuit pas.** L'app ne lit rien de plus (`veille_plantages` n'apparaît pas dans
src/App.jsx, contrôlé) ; aucune fonction ajoutée ; côté serveur, une lecture projetée
et un mémo par matin ; une panne de la veille ne fait pas échouer les rappels (elle est
dite dans la réponse du cron, `veille`). Aucune donnée de vendeur dans le texte (les
plantages sont déjà nettoyés par src/plantages.js).

**Geste** : rien si `VRM_OWNER_UID` et `VAPID_PRIVATE_KEY` sont posés sur Vercel (ils
le sont pour les rappels) et que son téléphone est abonné aux notifications.

---

## 5. Le contrôle de la production après mise en ligne — `.github/workflows/controle-prod.yml`

**Fait.** Sur chaque push vers `main` :
1. `scripts/attendre-deploiement.mjs` — `/api/sante` ne dit **pas** quelle version
   tourne (des oui/non seulement, route publique). Ce qui le dit : le *déploiement*
   que Vercel pose sur GitHub pour chaque commit (environnement « Production », créé
   par `vercel[bot]` — mesuré le 6 nov. : `a45e7636` ⇒ `success`). Le script attend
   celui de CE commit (API GitHub, `deployments: read`, 20 min au plus) ; `failure` ⇒
   job rouge (« la production n'a PAS changé ») ; aucun déploiement (quota de 100 par
   jour…) ⇒ avertissement, rien à contrôler. Si l'adresse du déploiement se lit sans
   compte, il attend que vrm.center serve le même `index-<empreinte>.js`.
2. `scripts/controle-prod-navigateur.cjs` — vrm.center ouvert dans Chromium, en iPhone
   (390, tactile) et en ordinateur (1512), **sans session** : l'accueil est rendu et
   titré « VRM… », `/?tab=journee` charge le bundle de l'app et mène au formulaire de
   connexion (`#vrm-cx-titre-formulaire`), jamais « L'application n'a pas pu démarrer »,
   aucune erreur JavaScript, aucun `/assets/` en erreur, aucune erreur de console hors
   bruit connu, `/api/sante` `ok:true`.
3. `scripts/verifier-production.mjs` (la sonde publique existante).

**Preuve.** Joué contre une copie locale (`VRM_ORIGINE=http://127.0.0.1:10040`) :
vert ; la même copie sans son `App-*.js` (ce qu'un déploiement raté donnerait) :
**10 échecs** (« L'application n'a pas pu démarrer », 404 sur `/assets/App-….js`).
`actionlint` propre. (vrm.center n'est pas joignable depuis ce conteneur : le proxy
le refuse — le premier passage réel sera celui de la CI.)

**Ne nuit pas.** Lecture seule : aucune session, aucun secret ; **toute requête qui
n'est pas une lecture est bloquée avant de partir** (et comptée) ; service worker
bloqué (rien ne s'installe) ; le workflow ne promeut, n'annule, ne redéploie rien.

### ⚙️ Geste si le contrôle est rouge : revenir en arrière À LA MAIN (Instant Rollback)
1. Lire l'annotation du job (onglet Actions → `Contrôle de la production…`) : elle dit
   quel contrôle et pourquoi.
2. Vercel → projet **cancale-v67** → **Deployments**.
3. Repérer le dernier déploiement **Production** d'avant (celui qui marchait).
4. Menu **⋯** → **Instant Rollback** (sur Hobby : le déploiement précédent) → confirmer.
   vrm.center sert l'ancienne version en quelques secondes, sans reconstruire.
5. ⚠️ Après un rollback, Vercel **cesse de promouvoir** les nouveaux déploiements de
   `main` jusqu'à ce qu'on en promeuve un à la main (Deployments → ⋯ → **Promote**) :
   corriger sur une branche, fusionner, puis promouvoir le nouveau déploiement.

---

## 6. Safari (WebKit)

**Fait.** `scripts/bancs/_navigateur.cjs` : `NAVIGATEUR=webkit` lance `pw.webkit`
(sans les arguments Chromium), `chromium` par défaut à l'identique. La porte de banc
(`_porte-banc.cjs`) est posée aussi sur WebKit. `nouveau-vendeur`, `iphone-reprise` et
`colis-retirer-propre` l'acceptent (et donc ventes-e2, journee-coherence, garde-ecrans,
morceau-perime pour le serveur, eux restent sous Chromium). Job CI `bancs-webkit`
(`npx playwright install --with-deps webkit`), **`continue-on-error: true`**.

**Pas essayé ici** : `npx playwright install webkit` dans le scratchpad est refusé par
le proxy du conteneur (`cdn.playwright.dev` et `playwright.download.prss.microsoft.com`
bloqués, 403) ; le premier passage WebKit sera celui de la CI. Les mêmes bancs sous
Chromium (le chemin par défaut) sont inchangés.

**Geste** : regarder le job `Bancs sous WebKit` sur les premières PR ; quand il est vert
plusieurs fois de suite, retirer `continue-on-error: true` et l'ajouter aux contrôles
obligatoires (§1, étape 4).

---

## Mesures (6 nov.)

- `npm run build` vert ; `audit-fonctions-api`, `audit-coherence`, `audit-secrets` verts ;
  le lot des 16 audits proches de la coque (composants, boutons, tdz, lectures…) vert.
- Tous les audits : voir § 1 (et la dernière passe, en fin de session, dans le rapport).
- Garde-fous, « ne nuit pas » : texte et nœuds identiques sur Ma journée, Ventes, Colis
  (390 et 1512), avant contre après ; l'ensemble des lectures : voir la dernière ligne
  du rapport de session.

## Fichiers

`.github/workflows/verifier.yml` · `.github/workflows/controle-prod.yml` ·
`scripts/lancer-audits.cjs` · `scripts/audits-exceptions.json` · `scripts/lancer-bancs.cjs` ·
`scripts/attendre-deploiement.mjs` · `scripts/controle-prod-navigateur.cjs` ·
`src/composants/GardeEcran.jsx` · `src/App.jsx` (montages) · `src/styles-composants.css` (§7) ·
`src/plantages.js` · `src/main.jsx` · `api/_lib/veille-plantages.js` · `api/ship-reminders.js` ·
`scripts/audit-garde-ecrans.cjs` · `scripts/audit-morceau-perime.cjs` ·
`scripts/audit-veille-plantages.cjs` · `scripts/bancs/garde-ecrans.cjs` ·
`scripts/bancs/morceau-perime.cjs` · `scripts/bancs/_navigateur.cjs` · `scripts/bancs/_porte-banc.cjs`.
