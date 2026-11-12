# Temps d'écriture et messages variés — extension 5.369 (12 nov. 2026, second agent)

Branche `claude/agent2-ecriture-humaine`, partie de `claude/agent2-extension-moyennes`
(5.362, qui contient 5.356 / 5.357 / 5.361), puis `origin/main` fusionné. **Pas de PR,
pas de fusion** : l'intégrateur l'intègre **à la place** de `agent2-extension-moyennes`.

⚠️ **Version 5.369.0, pas 5.367** : la 5.367 est portée par `claude/annonce-vinted`
(déjà dans `integration-11nov-g2` / `integration-12nov-a`) et la 5.368 par
`claude/republier-programme`. Réservée dans `COORDINATION-AGENTS.md`.

## Ce que Julien a validé (12 nov., mot pour mot)

> « Un temps d'écriture avant chaque envoi. L'extension attend le temps qu'un humain
> mettrait à taper ce message, par exemple 8 à 20 secondes pour une phrase, avec un peu
> de hasard, puis l'envoie d'un coup. On obtient l'effet « quelqu'un a écrit » sans
> aucune fausse touche. »
>
> « Des messages variés. Envoyer le même texte mot pour mot à 40 personnes, c'est ça qui
> fait robot. Pour les messages aux favoris et les refus automatiques, VRM ferait tourner
> plusieurs versions que tu écris toi-même, par exemple trois façons de dire bonjour.
> Personne ne reçoit exactement la même phrase que le précédent. Tes 50 actions par heure
> ne changent pas. »

## La règle (une source : `src/variantesMessage.js`, recopiée dans `background.js`)

Bloc `<variantes-regle>` recopié mot pour mot (comparé par `audit-ecriture-humaine.cjs`).

- **Temps d'écriture** (`tempsEcritureMs`) : longueur du texte ÷ 4,5 caractères/s (une
  frappe humaine, 3 à 6 c/s), × un hasard de ±25 %, borné **5 s – 45 s**. Une phrase de
  60 caractères : 10 à 16,7 s. Son clic « Envoyer » dans l'app : **2 à 6 s**.
- **Versions** (`versionsMessage`) : la 1re est le champ d'AVANT (`message` des favoris,
  `vinted_offre_refus_msg`) ; les versions 2 à 5 sont rangées À CÔTÉ (`variantes` dans
  `vrm_favoris_reglages_{uid}`, `vinted_offre_refus_variantes` dans `main`, SYNC_KEYS).
  Une extension plus ancienne ne lit que la 1re : comportement d'avant, jamais un texte
  collé ou inventé. Le n° d'une version est SA place à l'écran ; une version vide n'est
  jamais envoyée.
- **Choix** (`choisirVariante`) : au hasard parmi ses versions, **jamais celle du message
  précédent** du même compte et de la même sorte (`vrmVarianteDerniere`,
  `chrome.storage.local`, notée seulement quand le message est PARTI). Une seule version
  ⇒ toujours elle. Aucune ⇒ rien.

## Où l'attente a lieu (`attendreEcriture`, background.js)

| envoi | mode | où |
|---|---|---|
| message à un favori (file sur clic ou mode auto) | série, 5–45 s | `executerMessageFavori`, après la pause « offre → message », avant la dernière garde et le POST `…/replies` |
| message du refus automatique | série, 5–45 s | `repondreOffre`, après le refus réussi : attente + POST **dans `avecVinted`** |
| sa réponse depuis la messagerie de l'app (Vinted) | clic, 2–6 s | `executerPourApp`, chemin `POST /api/v2/conversations/{id}/replies`, dans `avecVinted` |

- **Aucune touche, aucun clic** (CLAUDE.md §3) : on attend (`setTimeout`), puis la requête
  part d'un coup, exactement comme avant. Aucune injection dans la page pendant l'attente.
- **Dans la file une-à-la-fois** : le favori tourne déjà dans `avecVinted` (via
  `executerPourApp`) ; le refus auto y passe désormais pour l'attente + le message.
- **Aucune action de plus** : l'attente ne réserve rien ; les places du favori (2-3)
  sont celles d'avant, celle du message rendue si rien ne part.
- **Revérifié toutes les 4 s** (ce qui tient aussi le service worker MV3 éveillé, §4.9) :
  une pause de Vinted (429/403) ou un AUTRE compte dans l'onglet pendant l'attente ⇒ rien
  ne part (`pause_vinted`, `compte_vinted_different`, `compte_vinted_absent`), place rendue.
- **Son clic : 2 à 6 s, pas un vrai temps de frappe.** Il a déjà tapé son texte dans
  l'app (le vrai temps d'écriture est passé, côté humain) ; doubler ce temps ferait
  attendre l'écran sans rien gagner. 2 à 6 s couvrent une réponse rapide collée d'un
  coup, où lecture du fil et envoi seraient sinon séparés de moins d'une seconde.
- **Leboncoin et Vestiaire ne sont pas touchés** : leurs envois (`repondreLeboncoin`,
  `repondreVestiaire`, offres Vestiaire) partent seulement sur SON clic, par la recette
  apprise de la page — pas le même chemin, et ces fichiers sont travaillés par d'autres
  lots (`lbc-plus`, `vestiaire-plus`).

## Délais de l'app allongés (un favori peut durer 45 s de plus)

`vmrExecUn`/canal direct d'un message aux favoris : 60/90 s → **110 s** (le serveur
déclare une tentative « incertaine » après 120 s, `reserverFile`). Le corps d'une
commande favoris accepté par le serveur : 5 000 → 16 000 caractères (5 versions de
2 000 caractères voyagent dans `lancer`).

## Le journal

- Extension : `entreeJournal` garde `v` (1–5) — jamais le texte. Refus auto :
  `noterJournal(…'offre_refusee', { …, v })` ; favori : `{ auto, v }`.
- Favoris (serveur) : `variante` rendue par l'extension → `traduireResultatFavori` →
  `terminer` → `terminerFile` la pose sur la tentative envoyée → `securite-compte.js`
  (projection + `evenementsJournal`) → « Ce que VRM a fait » : « Message à un favori ·
  version 2 » (`src/securiteCompte.js`, `ligneJournal`).
- Offres auto → historique : « Refusée (auto) · version 2 » (`journalOffres`).

## L'écran

`src/AutresVersions.jsx` (+ `src/autres-versions.css`), SOUS le champ existant, qui ne
change pas (les audits lisent ses `data-*`) :
- Offres auto → « Message de refus » (`src/OffresAuto.jsx`) et Annonces → Outils → ⓘ
  (le même réglage) ;
- Favoris → Message (`src/FavorisVinted.jsx`), enregistré avec le message.
« + Ajouter une variante » ajoute un champ VIDE ; « Retirer » ; 5 versions au plus ;
« N versions : une au hasard, jamais la même deux fois de suite. » ; extension trop
ancienne : « Extension 5.369 requise pour varier. Sinon, la version 1 part. » (ambre).
Chaque version suit les règles du message (variables `{username}`, `{a|b}`, 2 000 c.).

## Preuves

- `scripts/audit-ecriture-humaine.cjs` — **34 verts** ; EXÉCUTE le vrai `background.js`
  (`_fond-vm.cjs`) : copie identique ; bornes et proportionnalité ; jamais deux fois la
  même version (3 000 tirages, favoris en série, refus en série) ; une version = texte
  d'avant ; pause / autre compte pendant l'attente ⇒ aucun message, place rendue ;
  l'attente dans la file ; aucune injection pendant l'attente, aucun `KeyboardEvent` /
  `dispatchEvent` / `.click()` ; journal `v`.
  - §6.1 : sur `origin/claude/agent2-extension-moyennes` (5.362) : **19 rouges**.
  - Mutations (chacune rouge) : choix sans exclure la précédente (5 rouges) ; pause non
    revérifiée pendant l'attente (1) ; durée non bornée (4) ; attente retirée du favori (6).
- `scripts/bancs/variantes-refus.cjs` (390 tactile / 1512, clair / sombre) : versions
  relues du nuage, « + Ajouter » = champ vide, rangé dans `vinted_offre_refus_variantes`,
  5 au plus, « Retirer », extension ancienne dite, historique « · version 2 », 44 px,
  aucun débordement, rien envoyé. Captures regardées.
- `scripts/bancs/favoris-ecran.cjs` étendu (clair ET sombre) : « + Ajouter une variante »
  vide, version 2 enregistrée avec le message (`variantes`), rien de lancé.
- Audits relancés verts : coherence (capacités `ecriturehumaine`, `variantes`),
  variables, tdz, identite, icones, favoris-auto, favoris-autres-comptes, favoris-ecran,
  favoris-vintex, jauge-journal, moteur-offres, offres-auto, offres-garde, offres-sures,
  offres, familles-extension, extension-moyennes, robustesse-extension, contre-offre-mini,
  offres-mini-lecture, extension-zip, extension-navigateurs, `regles-achat-extension`.
  `audit-favoris-ecritures` : 2 rouges **identiques sur la branche de départ** (plafond
  45 / réserve, antérieurs à ce lot).

## Version

5.369.0 : `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`,
`EXT_CAPACITES` (`ecriturehumaine`, `variantes`), table §8, zips (`VRM-extension.zip`,
Orion) régénérés.

## Geste de Julien

Installer l'extension 5.369 (⟳ dans chaque Chrome), puis écrire ses versions : Offres
auto → Message de refus → « + Ajouter une variante » ; Favoris → Message → idem.

## Fusion de `origin/main` (5.365, intégration 11nov-f) — pour l'intégrateur

Vrai `git merge origin/main` (184f46c2f). Conflits résolus en gardant LES DEUX côtés :
- `background.js` : `saveDate`/`saveDetail` gardés « à soi » (5.357/5.362) **+** `verifDepot`
  (main) ; `numeroPourPublier` par l'hôte de l'onglet (5.362) ; `fullSync` = `vendExtAJour()`
  (main) + `sansRejet` (5.361) ; réveils `vrm-import` (+ `tickImportSites`) et
  `vrm-empreintes` passés par `lance(…)`/`sansRejet` ; message de confirmation avec
  `motsExt()` (main) + comptes relus « pas su » (5.356).
- `lbc-relay.js` : les résultats d'envoi Leboncoin restent sur le canal privé (5.362) ;
  l'import Leboncoin de main (`lbcimportmodele`, `lbcimportresultat`) reste sur
  `window.postMessage` comme dans main. ⚠️ À FAIRE (hors de ce lot) : passer l'ordre
  `importpage` et son résultat par le canal privé, comme les autres ordres (5.362).
- `App.jsx` : `EXT_CAPACITES` = union ; `AlerteFormeVinted` (5.357) **et**
  `AlerteModeration` (main) en tête de Ma journée.
- **`formevinted` et `prudence` passent de 5.357.0 à 5.369.0** : la 5.365 publiée par
  main ne les a pas (`audit-coherence` le refusait) ; c'est la renumérotation que
  l'intégrateur prévoyait (5.366) — avec cette branche, la 1re version qui les porte est
  la 5.369.
- CLAUDE.md : §8 union, §9 réordonné par date puis les plus anciennes lignes déplacées
  telles quelles dans `historique-divers.md` (58 953 octets).
- `audit-import-sites` (main) devenait rouge au hasard sur l'arbre fusionné : le délai
  des requêtes à la base (`signalDelai`, 5.356, un `setTimeout`) est ramené à 2 ms par
  `_fond-vm.cjs` et la fausse base répond en 3 ms. Dans un navigateur rien ne change
  (10/20 s réels). L'audit neutralise ce signal (il juge les pages) ; F1/F2 de
  `audit-robustesse-extension` jugent toujours le délai.
