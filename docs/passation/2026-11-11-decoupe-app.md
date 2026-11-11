# 11 nov. 2026 — Découpe d'App.jsx, version 2 (outil rejouable)

Branche outil : `claude/decoupe-app` · résultat de la répétition : `claude/decoupe-app-essai` (JETABLE, jamais à fusionner).
Aucune PR, rien sur `main` : la coupe finale attend le « GO » du coordinateur (une douzaine d'agents modifient App.jsx).

## Ce que fait l'outil (`scripts/decouper-app-2.cjs`, plan `scripts/decoupe-plan.json`)
Découpe par ANALYSE SYNTAXIQUE (Babel), pilotée par des NOMS (jamais des numéros de ligne) : il se rejoue tel
quel sur le `main` du jour ; un bloc introuvable est dit « absent », un bloc refusé est dit avec sa raison, le
reste du plan continue. Quatre sortes :
- **vues** : une branche `{condition && (…)}` du rendu d'un composant de tête (ex. `curSub==='ventes'` de
  Comptabilite) devient `<VueX v={{…}}/>` chargée à la demande ; les valeurs lues du composant lui sont PASSÉES.
  Refus : la branche écrit une variable du composant ou une variable de tête ; une valeur lue est réaffectée
  après elle (ou dans une fonction non appelée sur-le-champ) ; un hook ; `this`/`arguments`/`await`/`yield`.
  **(reprise) Le MOMENT de lecture** — avant, le code de la branche tournait dans le rendu du composant ; après,
  au rendu de la vue, juste après. Refusés aussi : une valeur DÉCLARÉE après la branche (zone morte) ; un objet
  passé MODIFIÉ par le rendu après la branche (`x.push`, `ref.current = …`) ; la branche qui, AU RENDU (pas
  dans un geste), modifie un objet du composant, appelle un `setX`, ou appelle une fonction du composant qui
  écrit ses variables (suivi sur 4 niveaux ; un mémo PRIVÉ d'une fonction, `let _memo` vidé à la microtâche,
  n'est pas une écriture visible). Ce qui tourne plus tard des deux côtés (onClick, fonction passée à un
  enfant) ne change pas de moment.
  **(reprise) Compagnons** : les fonctions du corps du composant que SEULE la branche utilise partent avec
  elle, déclarées dans la vue (mêmes règles ; une fonction qui réaffecte une variable de tête reste).
- **racines** : composants de tête rendus seulement en JSX, avec ce que seuls eux utilisent (comme l'outil du 8 nov.).
- **imports différés** (reprise, `differes`) : un composant importé d'un autre fichier, rendu seulement en
  JSX, devient `aLaDemande…(() => import(…))`. Refus : utilisé hors JSX ou au chargement du module ; son
  module (ou ce que lui seul amène) agit à son chargement ; amène un paquet qu'App.jsx n'importe pas ; son
  module reste importé par d'autres noms (rien de gagné). Ses feuilles de style restent importées dans App.jsx
  à sa place (cascade intacte). Attente « rien » par défaut (un bouton dans une ligne ne clignote pas en
  squelette), « feuille » pour une feuille ; chaque module différé est préchargé au repos 4 s après l'ouverture.
  ⚠️ Jamais un composant TOUJOURS monté (hôte qui écoute : Visionneuse, PiloteFavorisAuto — retirés du plan) :
  l'outil ne sait pas le voir, c'est le plan qui le dit.
- **pur** : codé, pas utilisé par le plan.

Texte : chaque morceau parti laisse une balise ; ce que l'outil POSE finit par `// ⟦découpe 2⟧` ; un import
différé garde sa ligne préfixée `// ⟦différé⟧ `. `scripts/_source-app.cjs` recolle le texte d'origine pour
les audits (vues `#v…`, compagnons `#h…`).

## (reprise) Trouvé et corrigé hors de l'outil
- **pdf-lib était dans le PREMIER chargement** (~410 Ko minifiés, ~10 %) : App.jsx importe
  `api/_lib/transporteur-anciens.js` pour trois petites règles → `transporteur-pdf.js` → `texte-pdf.js`, qui
  importait pdf-lib STATIQUEMENT (tous les autres usages de l'app étaient déjà `await import('pdf-lib')`).
  `texte-pdf.js` charge maintenant pdf-lib au premier `texteDuPdf` (seul point d'entrée qui le touche).
  Indépendant de la coupe : peut partir sur `main` tout de suite. Prouvé : audits transporteur-pdf (34 verts,
  vrais PDF lus), transporteur-anciens, transporteurs-parfaits, -lu, statut-transporteurs, -bordereau ;
  test pdf-bombe.

## Contrôles
- `scripts/audit-decoupe-outil.cjs` (neuf) : App.jsx de SYNTHÈSE, chaque garde-fou refuse son cas, le cas sûr
  part (vues : 14 cas ; compagnons : 4 ; imports différés : 5). Rougi par MUTATION de chaque règle neuve
  (déclarée après, modifié après, setX, fonction qui écrit, modifie au rendu, hors JSX, module à effet,
  paquet, style gardé, module qui reste) : 10/10 rouges.
- `scripts/verifier-decoupe.cjs --avant <arbre> --apres <arbre> [texte structure imports poids audits tests bancs]` :
  texte recollé = avant ; `tab===` / `curSub===` / écrans montés / composants rendus (chaque `<Nom>`, compté) ;
  imports ; poids du premier chargement (vite) ; audits / tests / bancs : aucun rouge NEUF. (reprise) machine
  partagée : audits et tests 2 à la fois, ports au hasard, `--audits-avant f.json` / `--bancs-avant f.json`
  reprennent une mesure de l'avant, `--garder-avant d/` la range ; les lignes posées par l'outil ne comptent pas
  dans les composants rendus (le texte d'origine est prouvé égal par l'étape texte).

## Prouvé (répétition sur origin/main f04d4a5) — voir « Mesures » ci-dessous
Plan rejoué tel quel (`node scripts/decouper-app-2.cjs --appliquer`, 100 s) : **App.jsx 4 535 → 3 496 Ko**,
13 modules `src/coeur/` (35 vues/racines paresseuses, 103 compagnons), 9 imports différés ; seul refus :
`FeuilleSaisieAchats` (écrit `fillBuyN0.current` au rendu).
- **texte recollé IDENTIQUE** à l'avant (83 467 lignes) ; `tab===` 59→59, `curSub===` 90→90, écrans montés
  43→43, 680 composants rendus aux mêmes nombres (+1 par paresseux neuf), chaque vue/racine déclarée ET rendue ;
  imports : aucun cassé neuf ; audit-variables, audit-tdz, audit-commandes, audit-parite-plateformes,
  audit-decoupe-outil verts.
- **Poids (vite build des deux arbres)** : morceau App 3 852 Ko / 1 290 Ko gz → 2 614 Ko / 882 Ko gz
  (**−31,6 % gz**) ; **JS du premier chargement 4 085 Ko / 1 367 Ko gz → 2 847 Ko / 960 Ko gz (−29,8 % gz,
  −30,3 % brut)** ; CSS inchangée (204 Ko gz) ; tout le JS construit 2 893 → 2 941 Ko gz (rien perdu).
  Dont pdf-lib sorti (~10 %), le reste par la découpe.
- **Tests** : 92 lancés dans les deux arbres, aucun rouge neuf (3 déjà rouges sur main : journee-instantanee,
  lbc-persistance, retraits-confirmes).
- **Audits** : 496 lancés (2 à la fois) ; 24 déjà rouges sur main (inchangés) ; **13 rouges neufs, tous parce
  qu'ils lisaient `src/App.jsx` BRUT** (a-trancher, achats-relier, actions-serie, corbeille, factures-autres,
  import-partage-aide, ligne-glissable, note-achat-double, ordre-recent, plans-solo-pro, profil-oauth,
  relais-change, restauration) : branchés sur l'app recollée (`scripts/brancher-audits.cjs`, gardé hors des
  modes `--prouve`/`MUT` qui écrivent le fichier lu) ⇒ **verts avant ET après la coupe** ; achats-relier
  extrait sa fonction avant d'ôter les commentaires (sur le texte entier, un `/*` d'ailleurs l'avalait).
  ⚠️ Au GO, un audit ajouté d'ici là peut faire de même : le vérificateur le DIT (« vert sur l'app recollée »)
  et donne la commande.
BANCS_ICI

## La coupe finale « GO » — commandes exactes
```
cd /home/user/cancale-v67 && git fetch -q origin
git worktree add /home/user/wt/decoupe-go -B claude/decoupe-go origin/main
cd /home/user/wt/decoupe-go && ln -s /home/user/cancale-v67/node_modules node_modules
git merge --no-edit origin/claude/decoupe-app            # l'outil, le plan, texte-pdf (vrai merge)
git worktree add --detach /home/user/wt/decoupe-go-avant origin/main && ln -s /home/user/cancale-v67/node_modules /home/user/wt/decoupe-go-avant/node_modules
node scripts/decouper-app-2.cjs --appliquer --rapport /tmp/decoupe-go.json     # ≈ 1 min 40 (machine chargée)
#   → lire le rapport : chaque « absent » / « REFUSÉ » est un bloc que le main du jour a changé (le reste part quand même)
node scripts/verifier-decoupe.cjs --avant /home/user/wt/decoupe-go-avant --apres . texte structure imports   # ≈ 1 min 30
node scripts/audit-decoupe-outil.cjs && node scripts/audit-variables.cjs && node scripts/audit-tdz.cjs       # ≈ 1 min
$SCRATCH/lourd.sh node scripts/verifier-decoupe.cjs --avant /home/user/wt/decoupe-go-avant --apres . poids tests audits bancs --garder-avant /tmp/decoupe-avant
#   ≈ DUREE_LOURDE (deux builds, 92 tests ×2, 495 audits ×2 à 2 à la fois, 13 bancs ×2)
git add -A src/App.jsx src/coeur scripts && git commit -m "Découpe d'App.jsx (découpe 2)…" && git push -u origin claude/decoupe-go
```
Rejouer après un `main` qui a bougé : refaire depuis `git worktree add` (l'outil refuse de re-couper un App.jsx
qui porte déjà ses balises : « déjà découpé »). Un écart du vérificateur = ne pas fusionner ; lire la ligne.

## Ce qui reste dans App.jsx et pourquoi
- `Comptabilite` (~1,1 Mo source) : sa LOGIQUE (hooks, effets, mémos) lit des centaines de variables du
  composant — pas mécanique ; Ma journée (premier écran : la rendre paresseuse ajouterait une attente) ; le haut
  de Colis (son IIFE écrit `ongletColisVu`, `colisSansCompte`, `nEnvoyesVu`) ; `FeuilleSaisieAchats` (écrit
  `fillBuyN0.current` au rendu) ; `AppCoeur` ; les écrans rendus au démarrage (EtatActions, parcours d'arrivée,
  AuthScreen, VisionneusePdf, Visionneuse, pilote des favoris) ; `CarteRelais` (encore importé par Tournee et
  pour `selecteurVilles`) ; LitigesEnCours, CentreNotifs, SignalerProbleme (leur module agit au chargement :
  `svg(…)`, `.join` sur des tableaux construits par des appels).
- Limite connue de l'analyse : une fonction de TÊTE d'App.jsx appelée au rendu par la branche et qui écrit un
  état de module (cache) n'est pas suivie (seules les fonctions du composant le sont).
