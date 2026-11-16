# 16 novembre — Fin de la revue de robustesse de l'extension (lot `extension-robuste`, ext. 5.396.0)

Branche `claude/extension-robuste` (depuis `origin/main` 5.393.0). Mission (45) : finir la revue de
robustesse de l'extension — moyennes 27–42, 44–69, 71–78 et basses 79–123 — sources
`2026-11-11-familles-extension.md`, `2026-11-11-extension-moyennes.md`,
`2026-11-11-robustesse-extension.md`, `2026-11-11-securite-revue.md` et la revue elle-même
(`docs/passation/robustesse/extension.md`, branche `origin/claude/agent2-robustesse`).
Version **5.396.0** réservée dans `versions-reservees.txt` (5.394 traduction-restes, 5.395
extension-restes, 5.397 plateformes-restes).

## ÉTAT À LA REPRISE

- Fait : tout le tableau ci-dessous ; preuve `node scripts/audit-extension-robuste.cjs [--prouve]`
  (**41 contrôles verts ; 37 rouges sur origin/main** — `--ext <git archive origin/main>/vinted-sync-extension` ;
  **30 mutations, chacune rend SON rouge**) et le banc Chromium
  `node scripts/bancs/extension-stockage-cadre.cjs` (**6 verts ; 4 rouges sur origin/main**, `--ext`).
- Garde-fous du §3 intacts : `garde` / `gardeStricte`, 50 actions/h (réserve 5), une requête Vinted à
  la fois, pause 429/403 — rien n'a été retiré ni affaibli ; deux points AJOUTENT une garde (96, 91).
- Reste : voir « Pas fait, et pourquoi » (aucun n'est un oubli : chacun a sa raison ou demande Julien).
- Geste de Julien : installer **5.396.0** (remplacer le dossier, ⟳ dans CHAQUE Chrome ; Orion :
  `VRM-Orion-dossier.zip`). Après la mise à jour, les onglets vinted.fr / Vestiaire / Leboncoin déjà
  ouverts affichent « Recharge cet onglet » : un clic sur « Recharger » (VRM ne recharge jamais à sa place).

## Les familles, dans l'ordre demandé (sécurité, puis perte de données, puis le reste)

### Sécurité

| point | état sur main | correctif | preuve |
|---|---|---|---|
| 60 (Vestiaire) `postMessage('*')` des ordres/résultats | **à faire** (Leboncoin fait en 5.362, pas Vestiaire) | canal privé `MessageChannel` vc-inject.js ⇄ vc.js (port remis UNE fois à document_start) ; ordres, résultats, recettes, `vcpublie`, `vcaimes`, `vcimportmodele/resultat` ne passent QUE par lui ; sans canal ⇒ `code:'canal'`, rien ne part, le fond rend la place et dit « recharge la page Vestiaire » ; lectures simples sur `window` à l'origine exacte (plus `'*'`) | 60 ×5, 61/62, 62i ×2 ; `audit-vc-conversations` (vrai Chromium : un ordre posté sur `window` par la page ⇒ rien ne part) |
| 61 `vcpublie` forgeable (identité §5) | à faire | idem (lettre privée) — et le fond exigeait déjà l'onglet du dépôt | 61/62 |
| 62 / 63 recettes forgeables | 63 fait (5.362) ; 62 à faire | canal privé Vestiaire ; la forme était déjà nettoyée côté fond (`nettoyerRecette*`) | 61/62 |
| 64 recette « vacances » | canal privé déjà là (5.356, `PAGE_SORTES_PREUVE` en 5.361) | **par compte : non**, voir plus bas | — |
| 67 `setAccessLevel` | à faire | **mesuré dans Chromium** : `chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})` existe et refuse `local` aux scripts de contenu (« Access to storage is not allowed from this context »). Le fond pose d'abord un MIROIR sans secret dans `chrome.storage.session` (ouvert aux pages), PUIS verrouille `local`. Miroir : valeurs (apparence, position/mini du logo, onglet de la carte, vérifications coupées, métier, boîte aux lettres du relais) ; signaux `{ at, present }` pour ce que la page ne fait qu'écouter (dont `vrmSession`) ; `vrmOAuthEtat` réduit à `{ etat, message, at }`. Ce qu'une page écrit (7 clés listées) est recopié dans `local` ; toute autre clé écrite par une page n'y entre jamais. Miroir impossible ⇒ pas de verrou. Scripts de contenu : `__vrmZonePage` (vrm-mots.js), zones `local` OU `session` écoutées. Firefox / Orion / Safari : pas de `setAccessLevel` ⇒ rien ne change. | 67 ×5, 67p ; banc `extension-stockage-cadre` S1-S3 (vraie extension, vraie carte du logo qui lit l'apparence par le miroir) |
| 68 `popup.html` encadrable | `cadreAutorise` (JS) fait en 5.362 | **`frame-ancestors`** dans la politique de l'extension (`'self'`, vrm.center, Vinted, Leboncoin, eBay, Vestiaire) : un autre site qui encadre vinted.fr qui encadre la fenêtre est refusé PAR LE NAVIGATEUR (mesuré). Retiré des paquets Firefox / Safari (`sansFrameAncestors`, pas garanti chez eux) | 68 ×2 ; banc C1-C2 |
| 101 LBC `getPending` sans job | à faire | `ongletDuDepot` : seulement l'onglet retenu pour ce dépôt (`vrmCmds['lbc:'+id].tabId`) ; sans onglet retenu, aucun | 101 |
| 65 eBay `getPending` | à faire | même règle (`ebay:`+id) | 65 |
| 103 `window.__cancaleVintedInjected` | à faire | clé symbole non énumérable (`Symbol.for('vrm.capteur.vinted')`) | 103 |
| 105 inject.js repli `postMessage('*')` sans canal | à faire | sans canal, rien ne part | 105 ×2 |
| 109 pause postée à la page | **déjà fait** (5.356 : la pause n'est plus transmise à la page) | — | — |
| 119 `CANCALE_LBC_ACCUSE` forgeable | à faire | l'accusé passe par le canal privé (lbc-relay → lbc-inject `surOrdre`) | 119 |
| 120 bridge.js `poster('*')` | à faire | `location.origin` | 120 |
| 123 `direAuSite('*')` | à faire | popup.js pose `__vrmCadreOrigine` (origine EXACTE déjà jugée) ; inconnue ⇒ rien ne part | 123 |
| 121 `exec` du pont relayé depuis vrm.center | à faire | **pas fait** — voir plus bas | — |
| 122 garde `getElementById('vrm-badge')` | — | **pas fait** — voir plus bas | — |

### Perte de données

| point | état sur main | correctif | preuve |
|---|---|---|---|
| 71 diagnostic lire-fusionner-réécrire | en partie (5.362 : seen_urls, statuts) | `panel_diag_capture` par `modifierLigneCas` (comparer-et-échanger sur `rev`) ; « pas su » ⇒ le tampon local n'est pas vidé | 71 ; `audit-diagnostic`, `audit-evt-extension` remis à la règle (le banc sert le PATCH conditionnel / `return=representation`) |
| 84 tampon écrasé si stockage illisible | à faire | lecture ratée ⇒ rien n'est écrit | 84 ×2 (le vrai bloc du fond) |
| 85 `n` sans borne | à faire | 600 compteurs (les plus grands + ceux qu'on ajoute), 80 échantillons (les plus récents) | 85 |
| 86 `logActivity` non sérialisé | à faire | chaîne de module ; lecture ratée ⇒ rien n'est écrit | 86 (vrai bloc) |
| 92 liaisons N° tronquées à 400 | à faire | jamais une liaison de moins de 30 jours (2 000 au plus) | 92 |
| 95 mémo d'offre purgé à 7 j | à faire | effacé seulement si l'offre n'est plus en attente ; la relecture ne ramène plus un mémo purgé | 95 |
| 79 `lastCsrfByDomain` en module | à faire | recopié dans `storage.session`, relu au réveil | 79 |
| 93 import d'un autre compte perdu | à faire | passe APRÈS l'import en cours (un à la fois, une attente par compte) | 93 |
| 94 `planifierImport` en `setTimeout` | à faire | alarme d'une minute (`vrm-import-bientot`, `vrm-importsites-bientot`) | 94 |
| 54 tampon catalogue LBC en mémoire | laissé par 5.362 (raison : 3 Mo, stockage 10 Mo) | **pas fait**, même raison | — |
| 59 `lbc_listings` en `select=data` | hors zone (5.362) | **pas fait** | — |

### Le reste

| point | état sur main | correctif | preuve |
|---|---|---|---|
| 66 scripts orphelins après mise à jour | à faire | `rappelerMiseAJourLbc` pose aussi l'encart « Recharge cet onglet » dans les onglets Vinted et Vestiaire (cadre principal) ; jamais un rechargement à sa place | 66 |
| 82 `_memoVisite` | à faire | purge des entrées périmées à l'insertion, 200 au plus | 82 |
| 90 `onClicked` + `await` | à faire | sans menu (Orion) et sans session en mémoire : `openPopup()` tout de suite, dans le geste | relu (chemin Orion seulement ; un geste réel ne s'imite pas en vm) |
| 91 place du bordereau | à faire | rendue si aucune génération ne part (refus à son tour, PDF déjà là) | 91 |
| 96 message après refus | rendu de place déjà fait (5.361) | la seconde requête revérifie compte et pause (`garde`, sans place) | 96 |
| 99 étapes eBay sans borne | à faire | clé normalisée, 24 étapes | 99 |
| 102 csrf relance `captureDomain` | à faire | seulement quand le jeton change | 102 |
| 107 `WRITE_NOISE` en sous-chaîne | à faire | segments entiers (catalog, dialog ne sont plus du bruit ; event_tracking, logs oui) | 107 |
| 118 `sendMessage` sans rappel (lbc-relay) | à faire | rappel `lastError` sur les 8 envois | relu |
| 117 sonde de session par cadre | **déjà borné** : la minuterie ne tourne que s'il y a des lectures en attente (30 min au plus) | — | — |
| 104, 108 trace `__cancale_active_ts`, `visibilitychange` | **obsolètes** : la moisson de la page n'existe plus (5.356) | — | — |
| 111 deux onglets répondent | **fait** (5.361, R23) | — | — |
| 27-30, 32-44, 46-53, 55-58, 60 LBC, 63, 68 JS, 69, 70, 72, 74, 75, 77, 78 | **faits** en 5.362 (`audit-extension-moyennes`) | — | — |
| 80, 81, 87, 88, 89, 97, 98, 100, 106, 110, 112-115 | **faits** en 5.361 (`audit-familles-extension`) | — | — |

## Pas fait, et pourquoi

- **31** (clic de l'app sans onglet) : tranché le 11 nov. (`2026-11-11-offres-sures.md` §5).
- **73** (pause seulement sur 429) : garde-fou §3 (« pause posée sur un 429/403 ») — jamais sans Julien.
- **45, 76** : sans objet (5.356 / 5.357).
- **54** : raison de la 5.362 inchangée (tampon de 3 Mo, un stockage plein fermerait le compteur d'actions).
- **59** : demande une ligne par annonce ou une RPC (app + base) — hors de la zone extension.
- **64 par compte** : la recette « mode vacances » est LA forme de la requête de Vinted (chemin à trou
  `{moi}`, méthode et corps relus et bornés à chaque usage) : la même pour tous ses comptes. La séparer
  par compte l'obligerait à refaire le geste sur chaque compte, pour rien. Le canal privé (5.356) et le
  canal « douteux » d'Orion (5.361) la protègent déjà.
- **83** (regrouper les écritures du tampon) : un regroupement en mémoire mourrait avec le worker (§4.9) ;
  le tampon reste écrit à chaque compteur. Depuis 67, `local` est refusé aux pages et `vrmDiagBuf`
  n'est pas dans le miroir (que Chrome cesse aussi de leur DIFFUSER l'événement n'est pas mesuré).
- **116** (`publier.click()` sur Leboncoin) : c'est le geste « Publier sur Leboncoin » depuis l'app,
  confirmé dans VRM ; le retirer change le produit — **décision de Julien**.
- **121** (`exec` du pont dicté par la page vrm.center) : la parade (jeton éphémère remis par le canal
  adressé) touche l'app ET l'extension ; à faire dans un lot app + extension.
- **122** : la page peut de toute façon retirer la carte de son DOM ; aucune marque ne l'en empêche
  (rien à protéger : la carte ne porte aucun secret).
- **124-127** (Colis / transporteur) : hors zone.
- Orion : le canal Vestiaire y est posé par une balise `<script src>` (comme Leboncoin) — un script de
  la page arrivé avant pourrait proposer un faux canal le premier ; même réserve que 5.361 pour Vinted.

## Fichiers

- `vinted-sync-extension/` : background.js, vc.js, vc-inject.js, lbc-relay.js, lbc-inject.js,
  inject.js, content.js, bridge.js, popup.js, vrm-badge.js, vrm-mots.js, vinted-capture.js, manifest.json.
- `scripts/audit-extension-robuste.cjs` (neuf), `scripts/bancs/extension-stockage-cadre.cjs` (neuf, vrai
  Chromium), `scripts/_canal-faux.cjs` (neuf : canal de banc, ne retient pas Node),
  `scripts/_fond-vm.cjs` (`sessionStore`, `niveauKO`), `scripts/zip-extension.cjs` (`sansFrameAncestors`).
- Bancs remis à la règle (le canal privé, rien d'affaibli) : `audit-capture-vc-lbc`, `audit-vc-messages`,
  `audit-vc-offres`, `audit-vc-prix`, `audit-favoris-sites`, `audit-vc-conversations` (+1 contrôle de
  sécurité), `audit-notifications-vinted`, `audit-fiche-modif`, `audit-suivi-vinted`, `audit-supprimees`,
  `audit-diagnostic`, `audit-evt-extension`.

## Vérifié

Voir la section « Passe complète » ajoutée à la fin (sortie recopiée telle quelle).
