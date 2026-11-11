# 11 novembre — WebKit fiable : ce qui marche dans Chrome marche dans Safari iPhone

Branche `claude/webkit-fiable` (session séparée, sans PR ni merge : la session principale fusionne).
Mission : faire tourner les bancs du job « Bancs sous WebKit (Safari, non bloquant) », classer
chaque rouge (défaut Safari de l'app ou banc instable), ajouter les parcours critiques, rendre le
job bloquant quand il est vert, trouver pourquoi `iphone-reprise` était rouge.

## 0. Ce qui n'a pas pu se faire ici

**WebKit ne s'installe pas dans ce conteneur** : `npx playwright install webkit` est refusé par le
réseau de la session (`cdn.playwright.dev` et `playwright.download.prss.microsoft.com` : 403
« no rule allows host »). La demande d'environnement n'a pas été approuvée (session sans humain).
Donc : **aucun banc n'a été joué sous WebKit dans cette session**. Les rouges WebKit ci-dessous
sont LUS dans le journal de la CI (run 43014598628, job 130502740525, WebKit 26.5, le 11 nov. à
11 h 46), les correctifs sont validés **sous Chromium** (avec le chemin WebKit forcé quand c'est
possible, `BANC_CORS=1`). Le verdict WebKit reviendra au prochain passage de la CI : c'est elle
qui a WebKit. Le job reste **non bloquant** (décision de la session principale, qui le rendra
bloquant après l'avoir vu vert sur GitHub).

## 1. Le journal WebKit de la CI, classé

`KO nouveau-vendeur 1200 s (arrêté : trop long)` · `KO iphone-reprise 216 s` (77 OK, 38 rouges) ·
`KO colis-retirer-propre 263 s` (36 verts, 63 rouges).

| rouge | classe | cause | correctif |
|---|---|---|---|
| colis-retirer-propre : `vrm_colis_retirer` null, aucune carte, aucune section, 63 rouges | **banc** (faux serveur) | les données ne chargent pas sous WebKit, sans aucune erreur de page : le faux Supabase du banc répond au pré-vol CORS (OPTIONS) par `201 []` sans `access-control-allow-headers`, et `iphone-reprise` sert ses réponses sans AUCUN `access-control-allow-origin`. Chromium ne fait pas passer ces contrôles par les routes ; WebKit, si. | `scripts/bancs/_navigateur.cjs` : `lancer()` pose sous WebKit un faux serveur CORS complet (pré-vol 204 avec les en-têtes demandés, `allow-origin`/`expose-headers` sur chaque réponse servie). `BANC_CORS=1` le pose sous Chromium : les trois bancs restent verts avec (vérifié, et vérifié qu'il est bien actif : en-tête présent avec, absent sans). |
| iphone-reprise B : `page.evaluate: TypeError: Illegal constructor` (×4) | **banc** | `new Touch(...)` n'existe pas sous WebKit | toucher de même forme posé sur un `TouchEvent`, ou un `Event` du même nom (l'app lit `touches[0].clientX/Y`) |
| iphone-reprise R : `clock.install: TypeError: … __pwClock.controller` (×2) | **banc** | l'horloge de Playwright est celle du CONTEXTE ; l'installer une 2ᵉ fois (page suivante du même appareil) lève sous WebKit | installée une fois par contexte, puis `setSystemTime` |
| iphone-reprise B3/B6/B7/O (×17, **rouges AUSSI sous Chromium**) | **banc périmé** (la cause des « 15 rouges » signalés par le lot app-installable) | le banc attendait la navigation d'avant le 10 nov. : 9 entrées dans « Plus », Statistiques et Paramètres dans « Plus », un groupe « Argent » dans la colonne. Or « Argent » = Statistiques + Compta en UNE entrée (10 nov.) et Paramètres sous la photo du profil (lot DJ6, 11 nov.). B7 tombait en cascade (le panneau resté ouvert sur une entrée absente). **Pas une instabilité : rouge à chaque passage.** | les attentes suivent `GROUPES_PLUS` d'aujourd'hui (`PLUS_ATTENDUES` : Messages, À trancher, Stock, Achats, E-mails, Argent, Communauté ; colonne Gérer (avec Argent) · Moi). Chromium : 17 rouges ⇒ **139 OK, 0 rouge**, deux fois de suite. |
| nouveau-vendeur : arrêté à 1200 s | **banc lent** | sous WebKit, +22,9 s par écran (clair) contre 3,5 s (sombre, où les données ne chargeaient pas : 401/403/400 dans la console — même cause CORS) ; 2,8 s fixes par écran | attente « écran prêt » sur ÉTAT (`scripts/bancs/_ecran-pret.cjs` : `<main>` monté, barre sans calcul, plus de squelette, DOM calme 600 ms), et le job WebKit ne joue que 390 px (`LARGEURS=390` : l'iPhone ; 1512 reste sous Chromium) avec 30 min de borne |
| nouveau-vendeur : « la Bienvenue s'ouvre à la première connexion » (×3), « Colis · À retirer : l'onglet existe » (×2), Compta « sans compte, la cause vraie » | à revoir au prochain passage | probablement la même cause (données non chargées sous WebKit) ; à rejuger une fois le CORS posé | — |

## 2. Les défauts Safari de l'APP (lus dans le code, corrigés)

Plancher retenu : **iOS 15.4** (iPhone 6s/7/SE 1 s'arrêtent en iOS 15.8 ; `.at()`, `structuredClone`,
`Object.hasOwn` y sont). Les bancs WebKit de la CI tournent sur le DERNIER WebKit : ils ne
peuvent pas voir ces défauts — d'où un audit statique.

1. **Regex à « lookbehind »** (Safari < 16.4 : `SyntaxError` à la LECTURE du fichier ⇒ tout
   `App-*.js` refuse de charger ⇒ « L'application n'a pas pu démarrer » à chaque ouverture ;
   connu depuis `audits-2026-11-01/limites.md` n°9, jamais corrigé). Trois, pas deux :
   `src/Tournee.jsx` (`/(?<= [·:]) /u`), `src/agentEbay.js` (`/(?<!\d)[,.;!?:]|…/`) et
   **`api/_lib/veille-plantages.js`** (deux, importé par l'app : `src/alertesPlantages.js`,
   Paramètres). Réécrites sans lookbehind ; **équivalence prouvée** sur 20 000 (Tournée, eBay) et
   50 000 (veille) chaînes tirées au hasard contre l'ancienne regex, et `audit-veille-plantages`
   reste 32/0.
2. **`AbortSignal.timeout`** (Safari 16.0) appelé nu en 8 endroits (liaison Google/Discord, photo
   du profil ×3, fiche GoTrue, identités reliées ×2, route compte de Paramètres) : sur iOS 15 un
   `TypeError` au clic, le geste « ne fait rien ». `src/compatSafari.js` : `signalDelai(ms)`
   (AbortController + minuteur sinon, erreur nommée `TimeoutError` comme l'original).
3. Déjà sûrs (vérifiés, rien à faire) : `requestIdleCallback` (gardé, 2 endroits),
   `navigator.share` (toujours derrière `canShare`/`navigator.share &&`/`peutPartagerFichiers`),
   aucune date « AAAA-MM-JJ HH:MM » écrite dans `src/`, `AbortSignal.any` / `OffscreenCanvas` de
   three et maplibre gardés par `typeof`.

**`scripts/audit-safari.cjs`** (découvert par `lancer-audits`, il lit `dist/` que le job des audits
télécharge) : A lookbehind dans `dist/assets/*.js` (dépendances comprises) ; B fonctions absentes
de Safari 15.4 appelées sans `typeof` (AbortSignal.timeout/any, Object/Map.groupBy,
Promise.withResolvers, Array.fromAsync, URL.canParse/parse, requestIdleCallback) et, dans `src/`,
`.toSorted/.toReversed/.toSpliced`, méthodes d'ensemble de Safari 17 ; C dates avec espace ;
D partage sans test. **Rouge 3 fois sur l'arbre d'`origin/main`** (construit à part :
lookbehind de veille-plantages, AbortSignal.timeout nus dans dist et src), **vert après** ;
`--prouve` joue chaque règle sur ses défauts d'avant (rouge) et leur forme corrigée (vert), 16/16.

Non couvert (à mesurer sur un vrai iPhone ou sous WebKit) : champs < 16 px qui zooment (un banc,
pas un audit : la police CALCULÉE compte), `window.open` après un `await` (pop-up bloquée),
`position: sticky` dans un conteneur qui défile, zone sûre en paysage.

## 3. Les parcours critiques dans le job WebKit

Voir §5 (mis à jour en fin de session) : chaque banc ajouté passe par `lancer()` (donc WebKit
quand `NAVIGATEUR=webkit`) et a été vu vert sous Chromium avant d'entrer dans le job.

## 4. Bloquant ?

Non, et c'est voulu : le job n'a pas encore été vu vert sous WebKit (aucun WebKit ici). La session
principale le rendra bloquant (retirer `continue-on-error: true` du job `bancs-webkit` de
`.github/workflows/verifier.yml`) après trois passages verts sur GitHub sans changement.
