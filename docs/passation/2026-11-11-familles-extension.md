# Restes de la revue de l'extension, par famille — 5.361.0 (11 nov. 2026, second agent)

Branche `claude/agent2-familles-extension`, partie de **`origin/claude/agent2-vinted-forme`**
(5.356 + 5.357, pas encore sur `main`) puis `git merge origin/main` : **elle CONTIENT la 5.356
et la 5.357**. Ni PR ni fusion : l'agent principal intègre. Version **5.361.0** (réservée dans
`COORDINATION-AGENTS.md` ; 5.355 et 5.358–5.360 sont à l'agent principal ; aucune autre branche
ne porte 5.361). Source : la revue `docs/passation/robustesse/extension.md` (branche
`claude/agent2-robustesse`) ; déjà faits avant : critiques 1-4, hautes 5-20 et 22 (récits
`2026-11-11-robustesse-extension.md`, `2026-11-11-vinted-forme.md`).

Preuve : `node scripts/audit-familles-extension.cjs [--prouve]` — EXÉCUTE le vrai `background.js`
(`scripts/_fond-vm.cjs`), le vrai `content.js` branché sur le MÊME stockage que le fond (deux
onglets, deux comptes), le vrai `orion-main.js`, et lit le vrai code de tous les scripts (AST
`@babel/parser`) pour les familles J et T. **29 contrôles verts ; 26 rouges sur la branche de
départ** (`--ext <copie de origin/claude/agent2-vinted-forme>/vinted-sync-extension` ; les verts
restants : une vraie photo Vinted passe, et T1 — aucun écouteur fautif n'existait, le contrôle
reste comme gardien) ; **26 mutations**, chacune rend SON rouge.

## Hautes de la revue

| revue | défaut | correction | contrôle |
|---|---|---|---|
| 21 | le message de refus automatique partait en `{ message }`, une forme jamais vue chez Vinted ; l'action restait consommée | `corpsReponseVinted` : la forme RELEVÉE sur ses vraies requêtes (`{ reply: { body, photo_temp_uuids, is_personal_data_sharing_check_skipped } }`, `docs/automatisation-vinted.md` §3, la même que les favoris et l'app) ; refusé ⇒ la place est rendue et `messagePasParti` | R21a, R21b |
| 23 | la boîte aux lettres du relais (navigateur sans `tabs.sendMessage`) était prise par N'IMPORTE QUEL onglet Vinted visible (autre domaine, autre compte ; deux fenêtres ⇒ requête doublée) | la demande porte l'onglet visé (`tab`) ; content.js connaît son numéro (`vrm-onglet`, demandé au fond) et ne répond qu'à lui ; la réponse n'est crue que si elle dit le même onglet | R23 |
| 24 | content.js abandonnait à 20 s en répondant `null`, le fond y voyait « pas de relais » et RENVOYAIT la même requête par la boîte | le relais répond `{ delai: true }` ; la boîte ne sert que si `tabs.sendMessage` n'a trouvé AUCUN destinataire (`lastError`) — un relais qui a répondu, même « rien », n'est jamais rejoué | R24, R24b |
| 25 | liste blanche du pont `[\w.-]*vinted\.net` : `https://evilvinted.net/` passait | `urlPhotoPermise` : https, sans identifiant ni port, hôte = un SOUS-DOMAINE exact de vinted.net | R25 |
| 26 | `photosEnOctets` : aucun hôte vérifié, `max` dicté par le message, aucune taille | hôtes vinted.net / leboncoin.fr / vestiairecollective.com (sous-domaines exacts), 15 photos au plus, 12 Mo chacune lus dans `content-length` AVANT de télécharger (revérifiés), 60 Mo la série, `image/*` seulement ; `photoBytes` : taille lue avant, image seulement | R26a-c |

## Le canal privé sur Orion

Sur Chrome / Edge / Firefox, inject.js est posé par le manifeste (monde MAIN, document_start)
AVANT tout script de la page : le canal qu'il remet à content.js est forcément le bon. Sur Orion
(paquet `VRM-Orion`), il était posé par une balise `<script src>`, chargée plus tard : un script
de la page arrivé avant pouvait proposer un faux canal le premier. **Aucun secret ne peut l'en
empêcher** (tout ce qu'inject.js sait dans la page, un script arrivé avant lui le sait aussi).
La parade :

1. `orion-main.js` pose d'abord le capteur **EN LIGNE** (`textContent` ; `zip-extension.cjs`
   y copie la source d'inject.js, `sourcesEnLigne`, et refuse de fabriquer un paquet sans elle) :
   exécuté à l'instant même. C'est **constaté** (une marque tirée au hasard, posée par le
   capteur, relue aussitôt) ET **sûr seulement si aucune balise `<script>` de la page n'existe
   encore** (aucun script de la page n'a donc pu tourner) ⇒ `__vrmCanalInline = true`.
2. Sinon (la règle de sécurité de la page refuse le script en ligne, ou la page est déjà là) :
   la balise `src` comme avant, et le canal est **« douteux »** : content.js pose `canal` sur
   chaque message (jamais la page : sa propre clé `canal` est jetée) et le fond n'en tire
   **aucune preuve ni aucun état** (`PAGE_SORTES_PREUVE` : bordereau = preuve de vente, reçu,
   suppression, recette « vacances », requêtes d'écriture, fiche, publication, brouillons). Un fond
   Orion sans cette marque tient le canal pour douteux.

⚠️ Reste assumé : sur le chemin « douteux », les lectures (`harvest`) et le relais des requêtes du
fond passent encore par ce canal — un script de la page arrivé avant pourrait y mettre de fausses
lectures. Il pourrait de toute façon agir lui-même sur le compte (il est dans la page, avec ses
cookies). Couper aussi les lectures arrêterait VRM sur Orion : décision de Julien si besoin.
Contrôles O1-O5 (+ `tests/orion-injection` : capteur en ligne, aucune balise `src` chargée ; CSP
stricte ⇒ canal douteux).

## Moyennes, par famille (une règle chacune)

| famille | règle | revue | contrôle |
|---|---|---|---|
| `JSON.parse` sans `try` | `flushSeen` (inject.js) : copie ratée jetée, le drapeau retombe (avant : levait à chaque passage, plus aucun `seen_urls`) ; `corpsCV` déjà fait (5.357). Plus aucun `JSON.parse` hors `try` dans l'extension (sauf copie d'une constante du code) | 106, 22 | J1 (AST de tous les scripts) |
| promesses non attrapées | `sansRejet(p, nom)` : chaque tâche d'un réveil (`surAlarme`, changement de cookie, `fullSync`) — un rejet est NOTÉ (`promesse_<tâche>`) ; filet commun `unhandledrejection` dans le service worker (noté, étouffé) | 87, 88 | P1, P2 |
| alarmes en double / figées | `alarmeSiAbsente` recrée une alarme d'une AUTRE période (une version précédente) ; même période ⇒ rien | 89 | L1 |
| minuteries / écouteurs orphelins | `minuterieVivante` : les minuteries permanentes des scripts de page (content, capture, infos, eBay, Vestiaire, Leboncoin) s'arrêtent quand l'extension est mise à jour ou retirée | 110, 112-115 | M1 (exécuté), M2 (AST) |
| `chrome.storage` sans borne | `bornerRegistre(cur, âge, max)` à chaque écriture : `vrmActions`, `vrmLectures` (1 h), `vrmRepubJour`, `vrmJaugePubliee` (24 h), `vrmDerniereVisite` (7 j), `vrmRefus` (30 j, 100), `vrmLoginsVus` (200) — les AUTRES comptes aussi | 97, 98 | S1, S2 |
| `return true` manquant | aucun écouteur `onMessage` ne répond plus tard sans `return true` (vérifié dans TOUS les scripts : aucun fautif aujourd'hui, le contrôle reste) | — | T1 |
| `[]` au lieu de `null` | `getStoredAccounts` avec délai ; `ouNull` dans `executerPourApp`, `repondreOffre`, le moteur d'offres, l'import, la fraîcheur ⇒ « pas su, réessaie », rien ne part ; `sbGet` : un objet n'est pas une liste ; `sbGetTout` au-delà du garde-fou ⇒ `null` ; liste des comptes supprimés illisible ⇒ la capture n'écrit rien | 43, 70, 80, 81 | N1-N4 |

## Vérifié

`audit-familles-extension` (ci-dessus) ; les 143 audits qui lisent l'extension, joués ici ET sur la
branche de départ : aucun nouveau rouge (rouges des deux côtés, hors de ce lot :
`controle-prod-quotidien`, `exec`, `extension-5186`, `lbc-plus-vue-pause`). Remis à la règle :
`audit-extension-navigateurs` (le relais imité répond avec l'onglet visé, comme content.js),
`tests/orion-injection` (capteur en ligne : aucune balise `src` chargée ; CSP stricte ⇒ canal
douteux). Trouvés par eux et corrigés : `photoBytes` autonome (le pont l'extrait seule), l'affiche
générique de Vinted (`*.vinted.com`) reste lisible pour le détourage, une alarme sans période
connue n'est pas recréée. Verts aussi : `orion-paquet`, `orion-pont-canal`, `favoris-chrome-csp`,
`orion-auth-autonome` (`orion-connexion` : plus de 3 min, non conclu), `coherence`, `variables`,
`tdz`, `identite`, `icones`, `extension-zip`, `regles-achat-extension`, `robustesse-extension`,
`vinted-forme` ; `npm run build`. `scripts/_fond-vm.cjs` : option `vraisComptes` (garde
le vrai `getStoredAccounts`) et `self.addEventListener` noté dans `j.globales`.

## Ce qui reste de la revue

Moyennes non faites ici (hors des familles demandées) : 27-42, 44-69, 71-78 (compteurs d'actions
doublés, budget de lecture partagé, verrous `runActive` / `majCmd` / `idNavigateur`, Leboncoin et
Vestiaire : plafond, frein, canal `postMessage('*')` des relais LBC/VC, recettes forgeables,
`storage.setAccessLevel`, `popup.html` encadrable, carte dessinée…). Basses : 79-86, 90-96,
99-105, 107-109, 116-123. Hors zone (Colis) : 124-127.

## Geste de Julien

Aucun tant que l'agent principal n'a pas intégré. Après mise en ligne : installer 5.361.0
(remplacer le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`).
