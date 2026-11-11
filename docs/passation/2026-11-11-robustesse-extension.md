# Robustesse de l'extension — 5.356.0 (11 nov. 2026, second agent)

Branche `claude/agent2-robustesse-extension` (partie de `origin/main`), **ni PR ni fusion** :
l'agent principal intègre et met en ligne. Version **5.356.0** (réservée dans
`COORDINATION-AGENTS.md`). Source : la revue en lecture seule
`docs/passation/robustesse/extension.md` (branche `claude/agent2-robustesse`), ses 4 points
« critique » et les « haute » listés ci-dessous.

Preuve : `node scripts/audit-robustesse-extension.cjs [--prouve]` — EXÉCUTE le vrai
`background.js` (`scripts/_fond-vm.cjs`), le vrai `inject.js`, le vrai `content.js` et la
vraie `reparerSiPerime` de `popup.js`. **26 contrôles verts ; 22 rouges sur origin/main**
(`--ext <copie de origin/main>/vinted-sync-extension`) ; **18 mutations**, chacune rend son
rouge (`--prouve`).

## Ce qui a changé

| revue | défaut | correction | contrôle |
|---|---|---|---|
| critique 1 | `pageVintedPour` prenait le PREMIER onglet *.vinted.fr OU *.vinted.com : un compte .fr + un onglet .com connecté à un autre compte ⇒ le geste partait au nom du compte .com | seul un onglet dont l'hôte est `acc.domain` (www. ignoré) ; sinon `sansPage:'onglet'` | A1, A2 |
| haute 5 | compte vérifié AVANT la file `requeteVinted` (attente possible de 30 s+) | `pageVintedPour` relit le cookie du domaine DANS le tour de la file, juste avant `executeScript` ; autre compte ⇒ `sansPage:'compte'` (jamais de repli par le fond) | B1, B2 |
| critique 2 | `autoAccepterOffres` sans verrou : deux passages traitaient la même offre | verrou `vrmOffresVerrou` dans `chrome.storage.local` (10 min, prolongé à chaque geste, rendu à la fin ; un worker tué ⇒ il expire) ; mémo `vrmOffresFaites` RELU juste avant chaque geste | C1-C3 |
| critique 3 | réservation de N° = lire puis réécrire la ligne entière : deux Chrome ⇒ même N° | `modifierLigneCas` (comparer-et-échanger sur `data.rev`, la forme de `modifierCas` de `api/_lib/suivi-vinted.js`) pour la réservation ET la liaison à l'annonce publiée | D1, D2 |
| haute 6 | une réservation affichée expirait après 3 h et son N° redevenait libre | `prochainNumeroDe` compte TOUTES les attentes ; `resaPropre` garde les 200 plus récentes + la plus haute de chaque série ; l'app (`numerosReserves`) aussi | D3, D4 |
| critique 4 | tout `postMessage({__tag:'CANCALE_VINTED'})` d'un script quelconque de la page était relayé (faux bordereau = preuve de vente, fausses ventes, fausse suppression, fausse recette, pause) | canal PRIVÉ : inject.js (MAIN, document_start) crée un `MessageChannel` et remet son port UNE fois ; content.js ne croit que le premier port, n'écoute plus `window` ; le fond refuse un message « de page » d'un onglet hors Vinted et prend le domaine de l'ONGLET | E1-E5 |
| haute 10 | `storeHarvest` pouvait ranger sous un compte basculé entre-temps | cookie relu juste avant l'écriture ; autre compte ⇒ rien n'est rangé | G1, G2 |
| hautes 7-9, 20 | la « moisson active » d'inject.js partait hors de la file, relisait la pause au départ seulement, survivait à content.js, jetait > 800 000 caractères | **retirée de la page** : le fond fait la même lecture (`pageActiveFetch`) dans la file, compte vérifié au début et à la fin | I1, `audit-frein-vinted` §7 |
| hautes 12-13 | `sbGet` / `supabaseUpsert` sans délai : une base muette bloquait tous les gestes (chaîne des compteurs) | `signalDelai` (10 s lecture, 20 s écriture ; aussi `sbGetLbc`, `sbGetTout`) ⇒ `null` / `false` | F1, F2 |
| haute 11 | `.click()` synthétiques (favori, cloche) — refusés par §3 | plus aucun : le lien / la cloche est ENTOURÉ (ambre) dans l'onglet, c'est SON clic ; l'ouverture d'un favori attend son clic 60 s ; cloche fermée ⇒ « Clique sur la cloche Vinted (entourée dans l'onglet), puis réessaie » | H1 |
| haute 16 | `garde()` laissait passer un compte illisible pour les gestes AUTOMATIQUES | refus `vinted-absent` | J1 |
| haute 15 | les `exec` GET de l'app (lire un fil) hors du budget de lecture | `gardeLecture(uid, acc, 'clic')` sur ce chemin | J2 |
| haute 17 | `storeWriteReq` rangeait le texte envoyé à un acheteur, le profil (nom, naissance), le téléphone | `…/replies`, `phone`, `verification`, `PUT /users/{id}` dans `WREQ_SENSIBLE` : seule la FORME (noms de clés, types) est rangée | J3 |
| haute 19 | la fenêtre de l'icône rechargeait l'extension quand le worker était seulement LENT (republication coupée) | rechargement seulement sur une version REÇUE et différente | J4 |

Audits existants remis à la nouvelle règle (rien d'autre) : `audit-extension-navigateurs`
(le banc du relais transporte le port du canal), `audit-frein-vinted` §7 (la page ne
moissonne plus), `audit-offres-auto` (le corps du moteur est dans
`autoAccepterOffresUnPassage`), `audit-numero-vinted` (une réservation ancienne reste prise),
`audit-supprimees` / `audit-suivi-vinted` / `audit-endpoints-vus` (le banc remet le port du canal,
content.js chargé avant inject.js comme dans le manifeste), `audit-wreq-sensible` (le texte d'une
réponse n'est plus gardé, sa forme oui), `tests/favoris-chrome-csp`, `tests/orion-injection`
(capture par le port), `tests/favoris-cloche-accessible` (cloche « disponible », zéro clic).
Vérifié : `audit-extension-zip`, `coherence`, `variables`, `tdz`, `identite`, `icones`,
`regles-achat-extension`, `npm run build` verts ; les ~140 audits qui lisent l'extension verts
(`tests/favoris-disponibilite` est rouge aussi sur origin/main, non touché).
`scripts/_fond-vm.cjs` sert maintenant le vrai PATCH conditionnel et le POST
`ignore-duplicates` de PostgREST (comparer-et-échanger).

## Ce qui reste (de la revue, non fait ici)

- haute 14 `visiteVinted` sans verrou ; 18 `vinted_item_details` sans borne ; 21 message de
  refus auto `{ message }` (forme non mesurée) ; 22 `JSON.parse(job.corpsCV)` hors `try` ;
  23-24 boîte aux lettres du relais Orion (onglet non adressé, requête doublée) ; 25-26 liste
  blanche photo / `photosEnOctets`. Puis les « moyenne ».
- **Orion** : inject.js y est posé par une balise `<script>` (pas de monde MAIN déclaré) ; un
  script de la page qui tournerait AVANT lui pourrait proposer un faux canal le premier. Sur
  Chrome/Edge/Firefox, inject.js tourne à document_start avant toute page : le canal est sûr.

## Geste de Julien

Aucun tant que l'agent principal n'a pas intégré. Après mise en ligne : installer 5.356.0
(remplacer le dossier, ⟳ dans chaque Chrome). Nouveau : pour écrire à un favori depuis la
cloche, VRM **entoure** le favori (ou la cloche) dans l'onglet vinted.fr — c'est lui qui clique.
