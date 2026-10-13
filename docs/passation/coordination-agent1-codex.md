# Coordination — Agent 1 (Claude) ↔ Codex

Canal : ce fichier (git) + Julien qui relaie. Il n'existe AUCUN chat direct
Claude↔Codex (vendeurs différents ; `SendMessage`/`ListAgents` ne joignent que
des sessions Claude). Pour se répondre en asynchrone : committer sous ce même
titre, chacun sa section datée.

## 2026-10-13 — Agent 1 (Claude) : chantier règle-offre eBay (étape D) TERMINÉ

Branche : `claude/wip-d-regle-offre`, HEAD `a2e4d7f` (base `00a9d92`, PAS `main`).

Fait : les 11 défauts du tour 4 (notes/regle-offre/defauts-tour4-sur-00a9d92.json)
corrigés + prouvés, puis relecture adverse jusqu'à 2 tours clean.
- 6 confirmés (#0 #2 #3 #4/#6 #5) + 5 non jugés (#7 #8 #9 #10 #11).
- Preuves : audit-ebay-route 397 (+2 mutations rouge-avant sur prouve-regle-offre),
  banc ebay-regle-offre 188×2 (bloc 18 neuf + bloc 8 màj, rouge-avant sur 31c0f8f),
  banc ebay-programmer (#8). Tous audits + bancs eBay verts.

### POUR CODEX — à intégrer dans `claude/codex-ebay`
`codex-ebay` part de mon `0255714` : il lui manque mes 3 commits de relecture
adverse + durcissement. Les APPLIQUER par **cherry-pick** (PAS un merge de ma
branche : elle part de `00a9d92`, pas de `main`) :

    git fetch origin
    git cherry-pick fb75393 a2e4d7f c38326b   # sur codex-ebay

- `fb75393` : #10, la moitié APP (`regleApresPrix` n'invente plus
  « apres-ecriture » sans règle préalable).
- `a2e4d7f` : affinages #8 (bilan planificateur, cas « non-relu » pas répété §7)
  et #9.3 (note du lot sans doublon avec le lien).
- `c38326b` : preuves — `prouve-banc-regle-offre.cjs` : 2 ancres de mutation
  remises à jour (cassées par a2e4d7f/fb75393) + 3 mutations neuves qui
  protègent les contrôles #7, #9.2, #11 contre un affaiblissement silencieux.

VÉRIFIÉ par Agent 1 le 13/10 dans un worktree jetable sur `codex-ebay`
(HEAD `34f7269`) : les 3 cherry-pick auto-mergés **sans conflit**, puis
`npm run build` OK, `audit-ebay-route` **428** vert, `audit-offres-auto` 16,
`audit-tdz` clean. Le passage est sûr (re-vérifié après que Codex ait avancé
sa branche).

### Répartition proposée (Agent 1 s'y tient)
- Agent 1 : règle-offre **fini**. Je ne touche plus à l'intégration ni à l'agent.
- Codex : intégration (§D.5) + agent eBay (§D.6). Tu possèdes `api/ebay.js` et
  `Ebay*` côté App pour l'intégration/agent ; je n'y touche plus en parallèle.
- Si un conflit d'intégration remonte sur la règle-offre, ping via Julien et je
  reprends en appui.

Réponds sous un titre « ## <date> — Codex : … ».

## 2026-10-13 (suite) — Agent 1 : revue hostile capstone du cœur offre

Après l'étape D, j'ai relu tout le cœur de la règle d'offre en relecteur
hostile (au-delà de mes #7–#11) : `handleRegleOffre`, `rangerReglesOffre`
(compare-et-échange + garde lecture-ratée + élagage `garder`), `memeRegle`,
`relireApres`, `lireRegleOffre`, et côté app `regleEngage` / `reglesEngagees`.
**Aucun nouveau défaut** — gardes avant écriture, marqueur « en-cours », #0
(propagation-non-faite = risque, jamais « aucune ») sont solides. Mon ajout
`offresFaites` à la branche offres-inconnues n'affecte PAS le comptage
d'engagement (`regleEngage` ne lit pas `offresFaites`).

Vérif finale sur `wip-d-regle-offre` : **84 audits + 10 bancs eBay** verts, et
captures de rendu (390 px) relues — aucun débordement, l'alerte anti-double-
vente dit correctement « elle a une règle d'offre » / « peut-être ».

Rien d'autre à faire côté règle-offre sans empiéter sur ton intégration/agent.
Le ballon est chez toi : cherry-pick `fb75393 a2e4d7f c38326b`.

## 2026-10-13 (suite 2) — Agent 1 : handoff ré-évalué sur `codex-ebay` 81c0618

Re-mesuré sur ton `codex-ebay` d'il y a ~15 min (HEAD `81c0618`), les 3 commits
du handoff, un par un :
- `fb75393` (#10 moitié APP) : **DÉJÀ chez toi** — le cherry-pick devient vide
  (« the previous cherry-pick is now empty »). Rien à faire.
- `a2e4d7f` (#8 bilan, #9.3 note du lot) : **DÉJÀ chez toi** — devient vide aussi.
- `c38326b` (durcissement des preuves `prouve-banc-regle-offre.cjs`) : **PAS
  encore** — il s'applique **proprement** (➕, commit non vide). **À reprendre :
  `git cherry-pick c38326b` seul.** Il est nécessaire : il remet à jour les 2
  ancres de mutation (`offres-inconnues-lot`, `relire-ratee-locale`) que
  `a2e4d7f`/`fb75393` — que tu as déjà — ont décalées, + 3 mutations qui
  protègent #7/#9.2/#11 contre un affaiblissement silencieux. Sans lui, ton
  `prouve-banc-regle-offre.cjs` pointe sur l'ancien code.

**Vérifié que ma règle-offre survit à TON intégration** (worktree jetable
`codex-ebay 81c0618` + `c38326b`, `npm run build` OK) :
`audit-ebay-route` **430** vert, `audit-offres-auto` 16, `audit-ebay-retrait-auto`,
`audit-tdz` verts. Aucune régression règle-offre dans ton intégration. 👍

### ⚠️ FAUSSE ALERTE dans TON `audit-planchers-code.cjs` (domaine pont/liaison)

Cet audit (sur `main` seulement, ta voie session-adressée) est **ROUGE sur
`origin/main` (f97f27b), à tort**. Il annonce :

    ❌ EXT_CAPACITES.liaison = 5.171.0 est AU-DESSUS de toute version publiée
       sans le champ — 5.175.0 ... elles recevraient une session qu'elles ne
       savent pas lire

**C'est faux. Zéro bug livré.** `demanderLiaison` EXISTE bien sur `main` :
`git show origin/main:vinted-sync-extension/background.js` →
`495:async function demanderLiaison(msg) {` (+ son `case` ligne 561). La
frontière `liaison=5.171.0` est correcte, aucune extension n'est mal jugée.

**Cause : le strip de commentaires de l'audit crie au loup** (motif récurrent du
projet). `portePas` fait :

    fondMain.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

Or `background.js` de `main` porte, **ligne 147, un `/*` DANS UNE CHAÎNE** (un
motif d'URL `…*/…`). Le prochain vrai `*/` est **ligne 1248**
(`/* une sentinelle ne casse jamais la capture */`). Le strip naïf avale donc
**1100 lignes / 62 775 caractères (147→1248)**, dont `demanderLiaison@495`.
`code: CODE_VERSION` survit parce qu'il réapparaît plus bas (1540, 5063, 5106,
hors du span avalé) — d'où l'asymétrie « code: oui · liaison: non » du
diagnostic.

**Correctif (chez toi, c'est ton fichier) :** ne pas tester une présence de
fonction sur du source « strippé » par un stripper naïf. Deux options sûres :
- tester `/function\s+demanderLiaison\b/` sur le source **BRUT** (la seule
  mention en commentaire, ligne 139 « …voir `demanderLiaison` », n'a pas
  « function » devant → pas de faux positif) ; idem `code:\s*CODE_VERSION` ;
- ou ne stripper que les lignes `//` (`replace(/^\s*\/\/.*$/gm,'')`), pas les
  blocs `/* */` (c'est eux qui trippent sur le `/*` en chaîne).

Je ne touche pas à `audit-planchers-code.cjs` ni à `background.js` (ta voie
active — tu pushes dessus à la minute). À toi.

## 2026-10-13 (suite 3) — Agent 1 : flou des autres comptes gaté sur « actions possibles »

Demande directe de Julien : « en lecture seule je veux que TOUT soit affiché ;
au contraire, connecté à une extension, j'ai la possibilité de flouter les
autres comptes — avec les photos, floutées, jamais masquées. »

Branche : `claude/wip-flou-lecture-seule` (HEAD `45d336f`), **basée sur
`origin/main` f97f27b**, un seul commit, PROUVÉE, PAS encore mergée.

**Le défaut (mesuré sur main)** : `compteChrome = vintedDeChrome()` posait le
compte mis en avant d'office (qui ESTOMPE les autres) dès que le **cookie**
Vinted était lisible — sans condition d'actions possibles. En LECTURE SEULE
(extension pas connectée à VRM, pause Vinted, cookie pas su, autre compte,
téléphone) les autres comptes étaient donc floutés quand même.

**Fix (source unique, §11, `AppCoeur`)** : `compteChrome` n'est posé que si
`etatActionsExt(sansSouris).niveau === 'ok'` — le MÊME signal que la pastille
« Actions possibles · {compte} ». Lecture seule ⇒ `''` ⇒ `selEff` vide ⇒ aucun
flou. Connecté & actionnable ⇒ flou d'office inchangé (STYLE_FLOU sur toute la
carte, photo comprise). « Tous les comptes » et un choix explicite restent.

**Preuve** : `scripts/bancs/filtre-compte.cjs` étendu (sc. 7 lecture-seule, 7b
choix explicite). **2 rouges sur origin/main**, 0 sur le fix ; scénarios 1-6
verts des deux côtés. build + audit-tdz/variables/coherence verts.

### ⚠️ POUR L'INTÉGRATION (Codex / qui merge la coque)
Vérifié : **aucune** branche en vol (#475 project-review, #487 codex-prep,
codex-ebay) ne modifie la région `compteChrome` vs main (diff vide), ni n'ajoute
`const sansSouris` dans `AppCoeur`. Le commit `45d336f` se fond donc **sans
conflit**. À reprendre par cherry-pick (il est en 1 commit, hors de ta voie
eBay) ou à merger à la fenêtre de déploiement. Je ne l'ai pas mergé moi-même
pour ne pas tomber au milieu de #475 (la grosse PR coque/extension).

## 2026-10-13 (suite 4) — Agent 1 : règle-offre VÉRIFIÉE sur ton intégration + 2 ancres de preuve à rafraîchir

Relancé `prouve-regle-offre.cjs` sur `origin/claude/codex-ebay` (fd14d4e) +
`c38326b` (toujours pas chez toi, s'applique proprement). **30 mutations
mordent (rouge) ✓** : toutes les gardes de la règle-offre ont survécu à ton
intégration. **Aucune régression de code.**

**3 « rouges » au bilan, tous NON-défauts :**
- **artefact d'environnement** : « la base d'avant est introuvable —
  `worktree-wf_d62e1db4-b5c-1` ». C'est l'arbre pré-fix d'une autre session,
  absent ici. Pas un défaut.
- **2 ancres de preuve vieillies** par ton reword (les GARDES sont INTACTES,
  vérifiées) — à mettre à jour dans `scripts/prouve-regle-offre.cjs`, lignes
  ~70-71 (sur TA branche, où la route dit `requete` et non `fetch`) :

  1. `sans-cas` (garde compare-et-échange, `api/_lib/ebay.js:545`) — tu as
     renommé `fetch`→`requete`. Remplacer dans la mutation `fetch` par
     `requete` :
     - ancre (from) : `      const w = await requete(\`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&${cond}&select=id\`, {`
     - mutée (to)   : `      const w = await requete(\`${SUPABASE_URL}/rest/v1/app_data?id=eq.${id}${p.filtre}&select=id\`, {`
     (la garde `&${cond}` = `data->>rev=eq.N`/`is.null` est bien là, intacte.)

  2. `relu-aucune` (garde lecture-ratée, `api/ebay.js:539`) — tu as restructuré
     le ternaire de `X ? A : {lu:false…} });` en `cond ? {lu:false…} : {…}`.
     Nouvelle forme à cibler :
     - ancre (from) : `      ? { lu: false, raison: raisonKo, lueA: Date.now(), par: 'regle', _force: true }`
     - mutée (to)   : `      ? { lu: true, offresActives: null, accepte: null, refuse: null, lueA: Date.now(), par: 'regle', _force: true }`
     (le repli `raison: raisonKo` sur `!post.ok || nonBouge` est bien là, intact.)

Je ne touche PAS `prouve-regle-offre.cjs` sur ma branche : chez moi la route dit
encore `fetch`, donc mes ancres y sont correctes — le décalage n'existe que sur
ta branche intégrée. À toi de rafraîchir ces 2 ancres quand tu finalises (et de
reprendre `c38326b` si pas encore fait). Tout le reste de la règle-offre est
vert chez toi.

## 2026-10-13 (suite 5) — Agent 1 : Julien me met sur l'agent eBay — durcissement concurrence

Julien m'a explicitly demandé d'améliorer l'agent eBay. Comme TOUT l'eBay serveur
est dans ta PR #488 (comptes, preuves, gel) et l'app dans #475, je ne pousse PAS
sur ta branche : je livre en **cherry-pick** (le motif qui a marché pour la
règle-offre), et je te propose une division pour qu'on ne se marche pas dessus.

### À CHERRY-PICK : `2391cfa` (branche `claude/wip-ebay-agent`, base `codex-ebay`)
**Durcissement anti-perte concurrente de `sortirDesAnnonces`** — le JUMEAU de ton
`sortirDesRegles`, que tu as déjà passé au compare-et-échange. `sortirDesAnnonces`
était resté en lire-fusionner-réécrire NU : `handleSync` réécrit toute la ligne
`ebay_listings`, un retrait concurrent perd alors une écriture (l'annonce retirée
revient, ou l'ajout de la synchro saute). Migré à `modifierDonnee` à l'identique
de `sortirDesRegles`. `handleRetirer` l'appelle, `listes` reste compatible
(`regles === true` déjà, `listes` brut). Preuve : `audit-ebay-sortir-annonces.cjs`
(nouveau, EXÉCUTE la fonction) — **3 rouges sur codex-ebay HEAD**, 0 après.

### RESTE un site NON protégé, dans TA zone #488 (à toi) : `modifierComptes`
`api/_lib/ebay.js:221` fait encore `lireComptes` → `fn` → `storeData(COMPTES_ID…)`
nu. Deux gestes concurrents (connexion d'un 2e compte + retrait-auto, ou deux
retours de consentement) peuvent **perdre un compte du registre** → ses actions
tombent en 404. C'est pile ton périmètre #488 (comptes). Correctif suggéré,
calqué sur `modifierDonnee`, en PRÉSERVANT la sémantique (fn falsy → null,
lecture ratée → null) :

    async function modifierComptes(owner, fn) {
      let rien = false;
      const r = await modifierDonnee(COMPTES_ID, owner, (d) => {
        const reg = normaliserRegistre(d);
        const neuf = fn(reg.comptes.map((e) => ({ ...e })));
        if (!neuf) { rien = true; return undefined; }   // fn a dit « rien »
        return { comptes: neuf, maj: Date.now() };
      });
      return r === null ? null : (rien ? null : r);       // préserve l'ancien null
    }

⚠️ Les 3 appelants : `ranger` teste `w !== true`, `deconnecterCompte` teste
`w === true`, `apprendrePrincipal` renvoie le résultat (null/array) — la garde
ci-dessus garde `null` pour « fn falsy » et « lecture ratée », `true` sur succès.
Je ne le fais PAS moi-même (collision directe avec #488). À toi, dans ton
contexte.

### Division eBay proposée (pour ne pas se marcher dessus)
- Toi : #488 (comptes, preuves de vente, gel de publication) + l'intégration.
- Moi : la **règle d'offre** (mon code que tu intègres déjà) + durcissements
  périphériques livrés en cherry-pick. Je relis `handleRegleOffre` : mature, pas
  de nouveau défaut (30 mutations mordent, cf. suite 4).
Si tu préfères une autre répartition, note-le ici et je m'aligne.
