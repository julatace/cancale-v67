# Moyennes restantes de la revue de l'extension — 5.362.0 (11-12 nov. 2026, second agent)

Branche `claude/agent2-extension-moyennes`, partie de **`origin/claude/agent2-familles-extension`**
(5.361, qui contient déjà 5.356 + 5.357) puis `git merge origin/main` (rien à fusionner ce jour-là) :
**elle CONTIENT 5.356 + 5.357 + 5.361**. Ni PR ni fusion : l'agent principal intègre. Version
**5.362.0** (réservée dans `COORDINATION-AGENTS.md` ; aucune autre branche ne la porte — vérifié sur
les 640 branches distantes). Source : la revue `docs/passation/robustesse/extension.md` (branche
`claude/agent2-robustesse`), moyennes 27-42, 44-69, 71-78.

Preuve : `node scripts/audit-extension-moyennes.cjs [--ext dossier] [--prouve]` — EXÉCUTE le vrai
`background.js` (`scripts/_fond-vm.cjs`), le vrai `lbc-relay.js` dans une page où un script forge
des résultats, la vraie règle de cadre de `popup.js`. **30 contrôles verts ; 30 rouges sur la branche
de départ** (`--ext <git archive origin/claude/agent2-familles-extension>/vinted-sync-extension`) ;
**23 mutations**, chacune rend SON rouge.

## Fait

| revue | défaut | correction |
|---|---|---|
| 27 | le moteur des offres prenait une action à chaque passage (même sans offre), deux par acceptation | `garde(uid, acc, { compter: false })` à l'entrée du passage ; seul le geste compte |
| 28 | un message à un favori comptait 1 place à la porte + ses 2-3 places | la porte ne compte pas (`executerMessageFavori` réserve lui-même) |
| 29 | la place prise à la porte n'était pas rendue quand la garde intérieure refusait (compte basculé) ou que rien ne partait | `recu` + `rendreActions` sur arrêt / rien parti |
| 30, 32 | lecture de fond (et import) permise avec un compte connecté INCONNU | `gardeLecture` refuse hors « clic » ; l'import revérifie `!actif` |
| 33 | budget de lecture tenu par Chrome seulement | la ligne `actions_compte_{uid}_{nav}` porte aussi `lec` ; les lectures des autres Chrome comptent |
| 34 | la moisson (~30 GET) hors de tout budget | plafond explicite : `MOISSONS_MAX_HEURE` = 4 par compte et par heure |
| 35, 36 | une place de la file Vinted sans durée maximale (onglet gelé ⇒ tout bloqué) | `delaiFile` (AbortSignal.timeout) : 90 s, moisson 240 s, issue « incertaine » notée |
| 37 | deux moissons d'affilée possibles | verrou de module sur `runActive` |
| 38 | deux id de navigateur au premier lancement | génération sérialisée + relue |
| 39 | écriture de la ligne partagée avalée | `actions_partagees_pas_ecrites` noté |
| 40 | base muette ⇒ chaque Chrome 50/h | `ACTIONS_SANS_AUTRES` 25 (lectures : 10) ; le plafond 50 ne bouge pas |
| 41 | bordereau « generation/pdf » orphelin 24 h | `vie` du worker sur l'étape ; relu par un autre ⇒ « interrompu », dit |
| 42 | `majCmd` non sérialisé | chaîne de module |
| 44 | compteur `nItems` lu sans délai | délai de lecture ; le reste était déjà couvert (dressing complet fait foi 5.165, commandes fusionnées 5.323) |
| 46 | pagination arrêtée à la longueur du lot | `dernierePageCommandes` : `total_pages` d'abord (fond + fonction injectée) |
| 47 | requêtes d'écriture d'un compte ignoré rangées | même garde que `storeHarvest` |
| 48 | profil rangé brut (nom, téléphone, naissance, adresse, soldes) | `profilMaigre` (liste blanche ; e-mail gardé : l'app en tire l'adresse de réception) |
| 49 | 160 caractères du corps dans le diagnostic | `formeEchantillon` (type, noms de clés) ; les anciens `tete` effacés à la réécriture |
| 50 | `vinted_listing_dates` sans borne ni comparer-et-échanger | `modifierLigneCas` + 3 000 au plus |
| 51 | `saveDate` sans vérifier l'annonce | `detailEstASoi` comme `saveDetail` |
| 52 | N° réservé sur le domaine dicté par le message | hôte de l'onglet (`hoteVintedDeLOnglet`) |
| 53 | réservations d'onglets jamais purgées (id réutilisés) | purge à la fermeture de l'onglet et au démarrage ; réutilisée seulement pour le MÊME compte |
| 55 | `lbc_catalogue` sans borne | 40 endpoints, 6 Mo au plus, les plus récents gardés |
| 56, 57 | pause / suppression Leboncoin hors des 50 actions du compte, aucun frein 429/403 | `compterAction('lbc:'+compte)` (rendue si rien ne part) ; frein de la messagerie (30 min) posé et respecté |
| 58 | pause / suppression pas liées au compte de la page | l'ordre porte `compte`, revérifié par `moiLbc()` dans la page |
| 60, 63 | ordres, résultats et recette Leboncoin par `postMessage('*')` | canal privé `MessageChannel` lbc-inject ⇄ lbc-relay (posé à document_start) ; sans canal rien ne part (`code:'canal'`, place rendue) |
| 68 | `popup.html` encadrable par n'importe quel cadre des sites | `cadreAutorise` : seulement la page principale d'un site permis (`ancestorOrigins`, sinon référent) |
| 69 | mot de passe saisi dans la carte DESSINÉE (DOM de la page) | mot de passe seulement dans l'iframe de l'extension ; dessinée : code par e-mail |
| 71 | `seen_urls`, statuts d'offres, diagnostic : lire-fusionner-réécrire sans CAS | `modifierLigneCas` pour `seen_urls` et les statuts ; diagnostic laissé (voir plus bas) |
| 72 | chaque rafraîchissement du jeton relançait une moisson | seulement si le compte du cookie a changé (`vrmCompteCookie`) |
| 74 | `CAP_MAIN_REFUSE` sur tout texte « MAIN » / « is not a function » | `estRefusMondeMain` : seulement « Unexpected property world » / « world … not supported » |
| 75 | `www.vinted.fr` en dur (visite, moisson, offres, import…) | `domaineVintedOuvert()` (onglet ouvert) pour les 7 lectures du compte actif |
| 77 | PATCH du login sans `owner`, échec muet | filtre `owner`, refus noté |
| 78 | cache des comptes supprimés non lié à l'utilisateur VRM | cache par `user_id`, filtre `owner` |

## Pas fait, et pourquoi

- **31** (clic de l'app sans onglet ⇒ service worker) : **tranché le 11 nov.** (`2026-11-11-offres-sures.md` §5 : un clic est un geste humain, le bloquer casserait le téléphone). Laissé.
- **73** (pause seulement sur 429) : **garde-fou §3** (« pause posée sur un 429/403 ») — ne pas affaiblir sans Julien.
- **45** : la moisson de la page (inject.js) n'existe plus (5.356) ; le dressing du fond marque déjà « complet » (5.165).
- **76** : les deux accès à `vrmDerniereVisite` sont dans la visite, sous verrou depuis la 5.357.
- **54** : tampon du catalogue Leboncoin en mémoire gardé : corps jusqu'à 3 Mo, le stockage de l'extension a 10 Mo et un stockage plein FERME le compteur d'actions ; perdre le tampon ne coûte rien (empreinte non notée ⇒ reprise à la visite suivante).
- **59** (`lbc_listings` relu en `select=data` pour noter une pause) : demande une ligne par annonce ou une RPC (app + base) — hors de la zone extension.
- **61, 62, 64** (Vestiaire : `vcpublie`, recettes, recette « vacances » par compte), **65** (eBay lié à l'onglet), **66** (réinjecter les scripts Vinted après mise à jour), **67** (`setAccessLevel` : content.js, vrm-badge et les relais lisent `chrome.storage.local` — il faut d'abord déplacer leurs clés vers `storage.session`) : restent, à faire par famille (canal privé Vestiaire comme Leboncoin).
- Basses 79-123 : pas commencées.

## Vérifié

`audit-extension-moyennes` (ci-dessus). Les 112 audits qui lisent l'extension, joués ici ET sur la
branche de départ : **110 verts ici** ; aucun nouveau rouge ; 3 rouges de départ passés au vert
(`coherence`, `extension-zip`, `preuve-vente`) ; rouges des deux côtés, hors de ce lot : `exec`,
`lbc-plus-vue-pause` (`numerosLbcSortis` : `MeilleuresSources` déclaré deux fois dans l'app).
Aussi verts : `variables`, `tdz`, `identite`, `icones`, `regles-achat-extension`, `npm run build`.
⚠️ 71 en partie : `seen_urls` et les statuts d'offres en comparer-et-échanger ; la ligne de
DIAGNOSTIC (`panel_diag_capture`) reste en lire-fusionner-réécrire (une dizaine d'audits servent
une base sans PATCH conditionnel ; deux Chrome peuvent encore y perdre quelques compteurs). La
file Vinted n'est bornée que par `AbortSignal.timeout` (sans lui : aucune limite, comme avant).
Remis à la règle : `audit-fusion` (PATCH conditionnel), `audit-jauge-journal` (`lec`,
`maxLectures`), `audit-endpoints-vus` (une session pour la liste noire), `audit-diagnostic`
(échantillon gardé sans `tete`), `audit-lbc-plus-vue-pause`, `audit-lbc-supprimer` (port de banc pour le canal
privé, le compte attendu dans l'ordre, un ordre posté par la page ne part plus), `audit-lbc-repondre`
(le banc prend le port du canal, 31 verts). Bancs remis à la règle (12 nov.) :
`scripts/bancs/carte-orion-sans-onglet.cjs` juge que la carte DESSINÉE (Orion, repli du cadre muet) ne
propose aucun mot de passe et connecte par code (70 verts ; 3 rouges sur la branche de départ et par
mutation `MDP_PERMIS = true`) ; `scripts/bancs/lbc-repondre.cjs` est vert tel quel (31) : il juge l'app ⇄
le pont `__vmr` de vrm.center, que 5.362 ne change pas — le canal privé de leboncoin.fr est jugé par
`audit-lbc-repondre` (en-tête du banc l'explique).

## Geste de Julien

Aucun tant que l'agent principal n'a pas intégré. Après mise en ligne : installer 5.362.0 (remplacer
le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`). Sur Orion, la carte du logo se
connecte désormais par code reçu par e-mail (plus de mot de passe dans la carte dessinée).
