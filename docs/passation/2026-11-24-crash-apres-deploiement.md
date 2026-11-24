# 24 nov. — « L'application n'a pas pu démarrer » après un déploiement ; Paramètres → Mon compte à 1512 px

Branche `claude/crash-apres-deploiement` (depuis `origin/main`). Deux défauts laissés rouges par `claude/main-vert`
(`2026-11-24-main-vert.md`, « Ce qui reste rouge »). Bancs lancés comme la CI :
`NODE_OPTIONS=--require=scripts/bancs/_garde-reseau.cjs`. Les bancs `morceau-perime` et `nouveau-vendeur` sont repris
tels quels de `main-vert` (barre native, cible au doigt), puis corrigés ici.

## 1. Le crash après un déploiement — une fiction du BANC, pas un défaut de l'app

**Reproduit seul** (`MV_W=390 MV_UN=1`) : après le rechargement vers la « nouvelle version », dernier filet,
`NotFoundError: Failed to execute 'removeChild' on 'Node'`. Le crochet `MV_DBG2=1` (nomme le nœud d'un `removeChild` hors
de son parent) dit : React retire `main.vrm-demarrage` (src/Chargement.jsx, l'attente du `Suspense` de `Racine`) de
`#root`… alors que ce nœud n'est PLUS dans `#root`. Ni `EcransGardes` ni la copie d'écran (`copieEcran` / `AttenteEcran`)
n'y sont pour rien.

**Cause** : les requêtes de la page relue montrent `index-NEUF….js` PUIS `index-<ancien>.js`. Le banc simulait la mise en
ligne en servant le MÊME point d'entrée sous un autre nom (`index-NEUF…`) ; les morceaux (App…, souvent servis par le
service worker sous leur nom inchangé) importent `./index-<ancien>.js` ⇒ le module d'entrée s'exécute DEUX fois ⇒
`src/main.jsx` appelle deux fois `createRoot(#root).render` ; la seconde racine VIDE le conteneur à son premier rendu
(React 18) et emporte le nœud de la première ⇒ « not a child ». Une vraie mise en ligne renomme chaque morceau qui importe
le point d'entrée (Rollup recalcule les empreintes en cascade) : la page relue ne vise jamais l'ancien nom. Aucun
utilisateur n'a pu voir ce crash par ce chemin.

**Correctif (banc)** : la nouvelle version nomme autrement CHAQUE fichier JS (`index-NEUF…`, `NEUF<nom>`) partout où il
est nommé (page, `version-app.json`, imports et listes de préchargement des morceaux) et le banc les sert sous ce nom.
Contrôle ajouté : « la nouvelle version ne nomme plus l'ancien script principal ». Le comportement de #1358 (morceaux
périmés ⇒ un rechargement, panne ⇒ aucun, compté à part) est inchangé et toujours jugé. Captures : `SHOTS=dossier`.

**Preuve** :
- avant (banc de `main-vert` sur `origin/main`) : 4 ❌ (les quatre passages « déploiement », 1512 et 390) ;
- après : 36 ✅ 0 ❌ ; capture 390 et 1512 regardées (E-mails ouvert, barre native, aucun filet) ;
- mutation du banc `MV_MUTATION_ALIAS=1` (l'alias d'avant) ⇒ rouge (contrôle du banc + dernier filet, capture regardée) ;
- mutation de l'app : `verifierMorceauPerime` rendu muet (src/chargementSur.js) ⇒ rouge « rechargée UNE fois » (1512, 390) ;
- le banc corrigé sur le `dist/` d'`origin/main` : vert — l'app n'avait pas de défaut ici.

Non fait (pas de changement de comportement) : une garde « une seule racine » dans src/main.jsx. Elle ne servirait que si
le point d'entrée était exécuté deux fois, ce qu'aucune vraie mise en ligne ne fait.

## 2. Paramètres → Mon compte à l'ordinateur

**Cause** : `.vrm-set > * { max-width: 880px }` (styles-reglages.css, « largeur de lecture ») plafonnait aussi le bureau
(sommaire 400 + détail 456 px) que verre-ecrans.css voulait « toute la largeur » ; le détail rangeait ses groupes en
`repeat(2, …)` ⇒ deux verres de ~220 px, « Supprimer mon compte », « Données et conditions », « Changer mon mot de
passe » sur deux lignes, Google/Discord écrasés.

**Correctif** (src/design/verre-ecrans.css, disposition « ordinateur » seulement) : le bureau prend la largeur
(`max-width: none`) ; les groupes en `repeat(auto-fit, minmax(min(100%, 340px), 1fr))` — deux colonnes seulement quand
chacune garde 340 px (une seule dans une fenêtre de 1024 px). Le téléphone (disposition « telephone ») ne change pas.

**Preuve** : nouveau-vendeur 4 ❌ (1512 clair/sombre, vide/jeu) ⇒ 0 ❌ ; captures 1512 et 390 regardées.

`npm run build`, audit-tdz, audit-traduction verts. Aucun texte nouveau.
