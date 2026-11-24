# 24 novembre — Les anciens lots de l'extension refaits sur la 5.440 (lot `ext-anciens-lots`, ext. **5.446.0**)

Branche `claude/ext-anciens-lots` (depuis `origin/main` 1acadda1d, extension servie 5.440.0). Mission : refaire en
UNE version à jour les lots du 16 nov. jamais fusionnés — **#1186** (`claude/extension-robuste`, « 5.396 »),
**#1191** (`claude/traduction-restes`, « 5.394 »), **#1219** (`claude/photo-identite-sites`, « 5.401 ») — prévus
ensemble en « 5.442 » (passation du 23 nov. §2 item 12) mais en conflit de fond avec main. Version **5.446.0**
(5.440.1 et 5.441–5.445 sont réservées par les PR ouvertes). **Fusionne APRÈS #1331 (5.445).**

Méthode : l'INTENTION de chaque point est reprise sur le code d'aujourd'hui, hunk par hunk, relue contre ce que
main a changé depuis (5.416 « on ne fait plus les requêtes » pour les écritures, messagerie 5.440, carte en
9 onglets, « Relier mes annonces » du 19 nov., découpe d'App.jsx) — aucun merge des vieilles branches.

## ÉTAT À LA REPRISE

- Fait : tout ce qui est marqué « repris » ci-dessous ; preuves en bas. Rien n'est fusionné (le train fusionne).
- Garde-fous §3 intacts : compte de l'onglet (`garde` / `gardeStricte`), 50 actions/h (réserve 5), une requête
  Vinted à la fois, pause 429/403 ; aucune requête d'écriture fabriquée par VRM, aucun pilotage clavier/souris,
  aucun `chrome.debugger`. Un point AJOUTE une garde (le message après une offre revérifie compte et pause).
- Geste de Julien : installer **5.446.0** quand le train l'aura servie (remplacer le dossier, ⟳ dans CHAQUE
  Chrome ; Orion : `VRM-Orion-dossier.zip`). Après la mise à jour, les onglets Vinted / Vestiaire / Leboncoin
  déjà ouverts affichent « Recharge cet onglet » : un clic (VRM ne recharge jamais à sa place).

## Lot par lot : le but, ce que main faisait déjà, ce qui est repris

### #1186 — fin de la revue de robustesse (« 5.396 »)

But visible : aucun (sécurité et pertes de données) ; l'extension ne laisse plus une page lire ou forger ses
messages, et ne perd plus de compteurs ni de liaisons. **Main n'en avait aucun point.** Repris :

| point | repris | où |
|---|---|---|
| 60-62 Vestiaire : ordres, résultats, recettes, `vcpublie`, « ont aimé » par `window` ('*') | **oui**, + `vcenvoivu` / `vcconvouverte` (nés depuis, 5.416) | `vc-inject.js` (`MessageChannel`, `surOrdre`, `SORTES_PRIVEES`), `vc.js` (`traiter`, port cru UNE fois, pont `__vrmVcPont` vers `vc-ecrire.js`), `vc-ecrire.js` ; sans canal ⇒ `code:'canal'`, place rendue, « recharge la page Vestiaire » (`background.js`, offre/prix/aimés) |
| 68 `popup.html` encadrable | **oui** | `frame-ancestors` (vrm.center + les hôtes de `web_accessible_resources`) dans le manifeste ; retiré des paquets Firefox/Safari (`sansFrameAncestors`, `scripts/zip-extension.cjs`) ; Orion n'a pas de politique (MV2) |
| 65 / 101 la paire en dépôt rendue à n'importe quel onglet eBay / Leboncoin | **oui** | `ongletDuDepot` (`vrmCmds[job].tabId`, « pas su » ⇒ non) |
| 103 marque `__cancaleVintedInjected` | **oui** | clé symbole non énumérable (`inject.js`) |
| 105 repli `postMessage('*')` sans canal | **oui** | `inject.js` : sans canal rien ne part |
| 107 `WRITE_NOISE` en sous-chaîne | **oui** | segments entiers (`bruitEcriture`) |
| 119 accusé Leboncoin forgeable | **oui** | `lbc-relay.js` ⇒ `versCapteur`, `lbc-inject.js` ⇒ `surOrdre` |
| 118 `sendMessage` sans rappel | **oui** | les 9 envois de `lbc-relay.js` |
| 120 `bridge.js` '*' | **oui** | `location.origin` |
| 123 carte encadrée '*' | **oui** | `popup.js` `origineDuParent` ⇒ `__vrmCadreOrigine` ; `vrm-badge.js` `direAuSite` à l'origine exacte (inconnue ⇒ rien) |
| 71 / 85 diagnostic | **oui** | `viderTampon` par `modifierLigneCas` (rev), 600 compteurs / 80 échantillons |
| 84 / 86 tampon et journal illisibles réécrits vides | **oui** | `majTampon`, `logActivity` (chaîne, lecture ratée ⇒ rien) |
| 92 liaisons N° coupées à 400 | **oui** | `resaPropre` : toutes celles de moins de 30 j (2 000 au plus) |
| 95 mémo d'offre purgé à 7 j | **oui** | effacé seulement si l'offre n'est plus en attente |
| 79 / 102 csrf | **oui** | `noterCsrf` (copie dans `storage.session`, relance seulement s'il CHANGE) |
| 93 / 94 imports | **oui** | un autre compte passe APRÈS (jamais perdu) ; « une minute après » par alarme |
| 66 onglets orphelins après mise à jour | **oui** | `afficherRappelSite` (Vinted, Vestiaire), jamais un rechargement à sa place |
| 82 `_memoVisite` | **oui** | purge à l'insertion, 200 au plus |
| 90 `onClicked` + `await` (Orion) | **oui** | `surClicIcone` : `openPopup` dans le geste quand rien n'est en mémoire |
| 91 place du bordereau | **oui** | rendue si aucune génération ne part |
| 96 message après le geste d'offre | **oui** | `garde` revérifiée avant le message (refus ET acceptation, main a ajouté l'acceptation en 5.410.4) |
| 99 étapes eBay | **oui** | clé normalisée, 24 étapes |
| **67 `setAccessLevel`** (jetons hors de portée des pages) | **NON** | depuis le 16 nov., main a ajouté des scripts de page qui LISENT et ÉCRIVENT `chrome.storage.local` (`vrm-action.js` : `vrmFile`, `vrmActionEnCours`, `vrmFlux` ; `lbc-ecrire.js` / `vc-ecrire.js` : leur état d'interface ; `vrm-badge.js` : 21 lectures, dont les 9 onglets ; `vrm-appris.js`, `vrm-trouver.js`). Verrouiller `local` les couperait EN SILENCE sur Chrome/Edge (favoris, écritures dans la page) tant que chacun n'est pas passé au miroir et essayé dans un vrai Chromium. À refaire seul, avec son banc Chromium (`extension-stockage-cadre` de #1186) étendu à ces scripts. |
| 121, 122, 54, 59, 64, 73, 83, 116 | non | mêmes raisons que dans le récit de #1186 (`docs/passation/2026-11-16-extension-robuste.md` sur sa branche) |
| répondre Vestiaire par requête (`vcRepondre`) | **obsolète** | retiré par main le 21 nov. (5.416 : `vcEcrireUI`, l'interface de la page) |

### #1191 — traduction, les restes (« 5.394 »)

But visible : l'extension et les derniers textes de l'app en cinq langues. Ce que main fait déjà :
- **(17) l'extension en 5 langues : FAIT AUTREMENT sur main** — `vrm-ui.js` (`VRM_UI.T`, ~1 800 textes × 5 langues,
  la langue du navigateur, `audit-extension-feuille`), `popup.js` (`MOTS`, 5 langues), la carte (788 `TU()`).
  Le mécanisme `_locales` / `chrome.i18n` de #1191 ferait un SECOND système : **non repris**. Seul reste en
  français sur main : le diagnostic des favoris de la fenêtre (`parcours-popup.js` + son bloc de `popup.html`) —
  **repris** dans `VRM_UI` (19 textes, traductions de #1191 + « Détails »), français identique en repli.
- **(18) « paire / article » par langue, (19) textes hors `tr()`, (20) chemins du centre d'aide** : lots de l'APP,
  pas de l'extension — **non repris ici**. Toujours utiles : `Colis → À retirer` reste écrit dans
  `scripts/aide-contenu.cjs` et `src/aideFiches.js` alors que la navigation a encore changé (design du 23 nov.) ;
  c'est au lot `#1320` tutos/site (qui refait l'aide après #1326) ou à un lot « traduction app » de les reprendre.

### #1219 — photo d'origine = même N° sur Vinted et Leboncoin (« 5.401 »)

But visible (Julien, 16 nov.) : « quand je poste la paire sur Leboncoin et Vinted sans passer par VRM, VRM la
reconnaît parce que la photo utilisée est exactement la même » — « non pas à quoi elle ressemble, mais son CODE ».
Main n'en avait rien (la ressemblance « même photo · sûr » y reste une proposition de « Relier mes annonces »).
**Repris** :
- Extension : le SHA-256 du FICHIER que LUI téléverse, calculé dans la page au moment de l'envoi (Vinted
  `POST /api/v2/photos` puis l'annonce qui porte ces photos ; Leboncoin `upload/image` ⇒ nom d'image 40 hex) —
  aucune requête de plus, un envoi refusé ne note rien, seulement le compte connecté dans l'onglet ; rangé par le
  fond dans `photo_origine_vinted` / `photo_origine_lbc` (lire-fusionner-réécrire, lecture ratée ⇒ rien, file).
- App : `src/photoOrigine.js` (la règle, inchangée : un code sur UN seul N° ⇒ ce N° ; deux N° ⇒ rien ; 3 et plus ⇒
  générique ; ses liens, ses « délier », « ce n'est pas la même », un N° douteux gagnent ; pas lu ⇒ rien) ;
  `src/photoIdentite.js` **réduit** : `liensLbcAvecPhoto` (les liens LUS), `autresAvecIdentites` (« Relier mes
  annonces » voit l'annonce reliée, preuve « même photo d'origine »), l'état publié. La ressemblance comme identité
  (`identitesParPhoto`, éteinte dans #1219) n'est pas reprise.
- `liensLbcLus()` remplace la lecture brute des liens Leboncoin partout où elle DÉCIDE une identité : à retirer
  ailleurs (Vinted, eBay, Vestiaire), ventes croisées, N° donnés aux annonces Leboncoin (`numeroterSites` : une
  annonce reconnue ne reçoit plus un N° neuf), bénéfice et ventes Leboncoin, recherche par N°, écrans Leboncoin,
  eBay, Annonces à égalité, Réglages. Les N° « déjà pris » et les gestes (écrire) lisent toujours les liens posés.
- « Délier » une annonce reliée par la photo d'origine = « ce n'est pas la même » pour ce N° (`liaisonActions.js`).
- Fiche d'une paire : « Aussi sur Leboncoin · reconnue par la photo d'origine » (neutre), la limite en titre
  (« publiée depuis une appli mobile, VRM ne la voit pas »).
- Non repris de #1219 : la feuille « Même photo » (`MemePhotoDetail`, plus rendue sur main), l'ambiguïté par le
  code affichée à part (« Relier mes annonces » propose déjà les deux paires).

## Fichiers

- Extension : `background.js`, `inject.js`, `lbc-inject.js`, `lbc-relay.js`, `vc-inject.js`, `vc.js`,
  `vc-ecrire.js`, `bridge.js`, `popup.js`, `vrm-badge.js`, `vrm-ui.js`, `parcours-popup.js`, `manifest.json`.
- App : `src/photoOrigine.js`, `src/photoIdentite.js` (neufs), `src/App.jsx`, `src/liaisonActions.js`,
  `src/MemePhoto.jsx`, `src/styles-meme-photo.css`, `src/ecrans/{Comptabilite,Leboncoin,Ebay,AnnoncesEgalite,Reglages}.jsx`,
  i18n `memePhoto` (2 clés) et `liaisonSites` (`lia.preuve.photo-origine`), `src/nouveautes.js`.
- Version : `CODE_VERSION`, manifeste, `CAPTEUR_VERSION`, `relaisVersion`, `EXT_ATTENDUE`, `EXT_CAPACITES`
  (`photoorigine`, `canalvc` à 5.446.0), `public/extension-version.json`, zips régénérés
  (`node scripts/zip-extension.cjs`, un dossier).
- Audits : `scripts/audit-ext-anciens-lots.cjs` (neuf), `scripts/audit-photo-identite.cjs` (repris, refait),
  `scripts/audit-coherence.cjs` (FONCTIONS), `scripts/audit-extension-navigateurs.cjs` (le banc du pont sert `location`).

## Preuves

- `node scripts/audit-ext-anciens-lots.cjs` : 25 verts ; **19 rouges sur origin/main** (`--ext <git archive>`) ;
  `--prouve` **20/20 mutations rouges**. Exécute le VRAI `background.js` (`_fond-vm`) et les vraies pages
  (`inject.js`, `vc-inject.js`, `vc.js`) dans un vm.
- `node scripts/audit-photo-identite.cjs` : 30 verts ; rouge sur origin/main (`--src`) ; `--mutation=toutes`
  **16/16 rouges** (dont `fondLecture`, `fondAutreCompte`, `pageRefus` sur le vrai fond / la vraie page).
- Voisins verts : `coherence`, `extension-zip`, `extension-navigateurs`, `meme-photo`, `identite`,
  `quoi-de-neuf`, `traduction`, `extension-feuille`, `familles-extension`, `extension-moyennes` ; passe des
  audits qui exécutent l'extension : voir la PR (comparée à main).
- `npm run build` vert.
- Pas de capture d'écran : aucun écran neuf (une ligne neutre sur la fiche, une preuve dans « Relier mes annonces »).
