# 14 nov. — L'extension capte mieux : bordereaux Vinted, envois ratés, Orion — extension 5.376.0 (capture)

Branche `claude/extension-capture` (depuis `origin/main` a8220150, puis fusion de
`origin/claude/extension-carte`). Pas de PR : la 5.376.0 est consolidée par l'agent principal
(zips NON régénérés ici, `audit-extension-zip` rouge pour ça seulement).

Julien, ce midi : « L'extension capte mal les bordereaux sur Vinted. Et elle capte très mal, que ce
soit sur Orion ou sur le navigateur, Leboncoin, Vestiaire Collective, c'est pas ouf. Je veux que tu
améliores tout ça, que ce soit beaucoup mieux et beaucoup plus simple pour tout le monde. »

## 1. Mesures (base de Julien, lecture seule, `select=` projeté, 14 nov. vers 13 h)

Rien de personnel n'est recopié (ni n° de transaction, ni URL signée, ni identifiant de compte).

### Les appareils (`ext_appareil_*`)

| appareil | version | ce qu'il lit | dernier envoi réussi |
|---|---|---|---|
| Chrome (mac) | **5.329.0** (46 versions de retard sur la 5.375 servie) | Vinted, Leboncoin | Vinted 13 nov. 22:31, Leboncoin 14 nov. 09:32 |
| Orion (iPhone, se dit « mac ») | **5.368.0** (sans la correction Vestiaire de la 5.374) | Vinted, Vestiaire | Vinted 13 nov. 17:52, Vestiaire 14 nov. 11:33 |
| Orion (2ᵉ) | 5.336.0 | Vinted | 10 nov. |

Aucune ligne `harvest_*_forme_inconnue` ni `journal_vrm_*` : le Chrome (5.329) n'a pas ces
capacités (5.337, 5.372). Un seul refus noté sur le Chrome (`harvest_orders_sold`, réseau, 19,6 Ko).

### Bordereaux Vinted

Ventes du 1er au 14 nov. au statut « Bordereau envoyé au vendeur » (9 comptes, `orders_sold` relu) :

| | ventes |
|---|---|
| PDF capté par l'extension (`harvest_{uid}_label_{tx}`) | **3** |
| PDF arrivé seulement par e-mail (`email_bord_{tx}`) — dont un **23 h** après la vente | **5** |
| **aucun PDF** (vente du 13 nov. ; le détail de la transaction a été relu le 14 à 11:31 : l'extension est passée et ne l'a pas repris) | **1** |

Compteurs cumulés (`panel_diag_capture`, toutes versions) :
`label_url_trouve` 72 · `label_url_introuvable` **48** (dont **42** « 200 200 200 » : Vinted répond,
le PDF n'est pas encore prêt ; 2 « 401 ») · `label_envoye` 70 · `label_ok_apres_1_essai` 20,
`_2_essai` 6 · `label_abandon_apres_essais` **13** · `label_via_label_url` 66 (**aucune autre voie
n'a jamais rendu l'URL**) · `label_ecriture_ratee` 0 · `label_fetch_*` 0 · `label_pas_un_pdf` 0.
Tailles : PDF rangés jusqu'à 493 Ko (août), 125 Ko au plus en novembre — envoyés **deux fois dans le
même corps** (`label_{tx}` + `label_latest`).

### Envois ratés (toutes captures)

`ecriture_ratee_*_reseau` : ventes 13, achats 10, boîte 14, profil 10, dressing 10, comptes Vinted
110, relais 247 ; `*_sans_session` : comptes Vinted 473, Vestiaire brut 24+7, profil 13, ventes 4,
achats 6, bordereau Vestiaire 1. **Rien ne les rejouait** : la ligne n'arrivait qu'à la prochaine page
qui redemandait la même chose (sur Vestiaire, la page ne redemande pas).

### Leboncoin, Vestiaire

- Leboncoin : 186 annonces rangées, **11** d'un seul compte relues depuis le 20 sept. (dernière lecture
  le 14 nov. 09:31 par le Chrome : 1 annonce en ligne, 10 « plus vues ») ; **175** jamais relues depuis
  le 19 sept. (dont 126 sans compte) ; `lbc_ventes` vide, inchangé depuis le 22 oct. Le compte privé
  apparaît sous deux clés (`X` et `lbc-account:X`) — voulu et traité comme UN (5.335).
- Vestiaire : `vc_ventes` et `vc_listings` figés au **2 nov.** (seul l'iPhone lit Vestiaire, en
  5.368 : la correction de la 5.374 n'y est pas installée) ; `vc_messages` frais (14 nov.).

### Orion (WebKit) — ce qui manque, lu dans le code

`cookies`, `scripting` (monde MAIN), `downloads`, `externally_connectable` ont déjà leur repli
(`mesurerCapacites`). **`chrome.alarms` absent : le réveil `vrm-reseau` n'existe pas** — la file
« en attente de réseau » (5.371) ne repartait que sur l'événement `online` ; aucune minuterie ne la
reprenait. `fetch` du PDF S3 : permis par le paquet (`*.amazonaws.com` dans les permissions MV2).

## 2. Causes, par captures perdues

1. **Bordereau pas prêt au seul passage, puis 6 h de silence** (48 essais sans URL, 13 abandons ;
   la vente du 13 nov.) : l'insistance durait 15 s, l'essai raté posait 6 h de mémo, et rien ne
   relançait sans une nouvelle visite sur CE compte.
2. **Envois ratés jamais rejoués** (≈ 70 captures Vinted/Vestiaire perdues au réseau ou sans
   session, hors comptes et relais).
3. **Versions anciennes installées** (Chrome 5.329, iPhone 5.368) : geste de Julien.
4. **Lectures de bordereau hors budget** : deux chemins lus pour rien à chaque essai (42 × 2), et
   aucune ne passait par `gardeLecture` (compte de l'onglet, 20 lectures/h).
5. **Orion sans `chrome.alarms`** : les files ne repartaient pas.
6. **PDF deux fois dans un corps** (jusqu'à ~1,3 Mo) : pas un échec mesuré (0 `label_ecriture_ratee`),
   un risque sur le réseau d'un iPhone.

## 3. Correctifs (extension 5.376.0, `background.js`, `vrm-badge.js`)

a. **Relances du bordereau** (`BORD_RELANCES_MS`, `bordProchainEssai`) : une vente qui attend son
   envoi est relancée à 10 min, 30 min, 1 h, 3 h puis toutes les 6 h ; l'insistance (4 lectures en
   15 s) seulement au 1er essai, une lecture ensuite. Mémo posé avant (un worker tué ne relance pas
   en rafale), retiré si rien n'est parti.
b. **Passage de fond** (`tickBordereaux`, réveil `vrm-versement`, 20 min) : onglet vinted.fr ouvert
   sur CE compte, seulement si la dernière passe a NOTÉ un bordereau manquant dont la relance est due
   (`vrmBordManquants`, aucune lecture de la base sinon), lecture seule (rien n'est généré).
c. **Budget** (`lireLabelVinted`) : chaque lecture (transaction, `label_url`) passe par
   `gardeLecture(uid, acc, 'colis')` — compte de l'onglet, 20 lectures/h, pause 429/403 ; un refus
   ne consomme pas l'essai. `label_url` qui répond 200 sans URL ⇒ on s'arrête (les deux autres
   chemins ne servent que s'il ne répond pas 200).
d. **Un PDF par envoi** : `label_{tx}` seul, puis `label_latest` à part.
e. **File des captures** (`mettreCaptureEnFile`, `viderFileCaptures`, `vrmFileCaptures`) : une
   capture nommée (`RE_FILE_CAPTURE` : ventes, achats, boîte, profil, dressing, transaction,
   bordereau, avis, Vestiaire, Leboncoin), datée, dont l'envoi échoue sans refus net (réseau, sans
   session, 408/425/429/5xx) est gardée au nom du compte VRM qui l'a lue (session, ou dernière
   session connue ; inconnu ⇒ pas gardée), puis rejouée : réveil d'une minute, retour du réseau,
   écriture réussie suivante. **Jamais sur plus frais** (relecture projetée `meta->>capturedAt /
   updatedAt / at`), **lecture ratée ⇒ rien écrit**, **jamais chez un autre compte VRM**. Bornée
   (40 envois, 2,5 Mo, 24 h).
f. **Orion** : sans `chrome.alarms`, `rattraperMinuteries` (minuterie de 30 s et chaque réveil du
   fond) reprend les deux files (`viderFilesEnAttente`).
g. **La carte du logo** (`capturePourCarte` → `e.capture`, ligne « Capté » de `vrm-badge.js`) :
   pour CE compte et CE site, une phrase et un geste — « 3 bordereaux pas encore récupérés · Ouvre
   tes ventes à expédier » (lien vinted.fr), « 2 lectures pas encore envoyées à VRM · Elles repartent
   seules dès que le réseau revient », « Vestiaire a changé sa page : VRM ne la lit plus · Rien n'est
   écrit à sa place — on corrige », « Tes ventes Vestiaire ne sont pas encore lues · Ouvre Mon compte
   → Mes ventes », « Bordereaux : tous récupérés ✓ ». Rien mesuré (ou plus de 24 h) ⇒ rien dit.
h. Version 5.376.0 (`CODE_VERSION`, manifeste, `lbc-inject`/`lbc-relay`, `EXT_ATTENDUE`) ;
   `EXT_CAPACITES` `bordrelance` (`tickBordereaux`), `filecaptures` (`viderFileCaptures`),
   `capturecarte` (`capturePourCarte`) à 5.376.0 ; « Quoi de neuf » `extension-capture`.

Pas fait (honnête) : PDF **découpé en morceaux** < 200 Ko — non mesuré comme cause (0 écriture de
bordereau ratée, 125 Ko au plus en novembre) ; un envoi raté est maintenant gardé et rejoué. Capteurs
Leboncoin multi-formes : non touchés (la cause mesurée est l'absence de relecture des comptes, pas une
forme) ; Vestiaire forme inconnue : déjà « rien écrit » (5.374), désormais DIT sur la carte.

## 4. Preuves

`node scripts/audit-extension-capture.cjs` — VRAI `background.js` dans un `vm` (`_fond-vm.cjs`),
données inventées, formes mesurées : **28 verts** (B1-B9 bordereau pas prêt puis récupéré par le
passage de fond, `label_url` seul, relances 10/30/60/180/360 min, budget plein ⇒ rien lu et essai
gardé, autre compte ⇒ rien lu, un PDF par envoi ; C1-C7 envoi raté gardé puis rejoué, plus frais en
base ⇒ rien écrasé, lecture ratée ⇒ rien écrit, autre compte VRM ⇒ rien rangé, PDF de 450 Ko gardé
puis rangé entier ; O1 Orion sans `alarms` ; V1-V2 Vestiaire forme inconnue ⇒ rien rangé et dit ;
K1-K3 la carte). Sur `origin/main` (copie du fichier, `--src`) : **17 rouges sur 22**.
`--prouve` : **12/12 mutations** rougissent. Audits relancés verts : `audit-coherence`,
`audit-identite`, `audit-bordereau-*` (4), `audit-extension-5186`, `-captcha`, `-moyennes`,
`-navigateurs`, `-oauth`, `-ui`, `audit-vc-vente-orion`, `audit-robustesse-extension`,
`audit-familles-extension`, `audit-capture-vc-lbc`, `audit-budget-lectures`, `audit-frein-vinted`,
`audit-quoi-de-neuf`. `audit-extension-5340` : 1 rouge (P1, `vc-inject.js`) — fichier non touché ici.

## 5. Le geste de Julien

1. Installer la **5.376.0** quand elle sera publiée, sur **CHAQUE** navigateur : le Chrome est en
   5.329, l'iPhone en 5.368 (aucune des corrections Vestiaire et bordereaux n'y tourne).
2. Sur l'iPhone (Orion) : Vestiaire → Mon compte → Mes ventes (la vente récente arrive).
3. Sur leboncoin.fr : « Mes annonces » sur CHACUN de ses comptes (175 annonces jamais relues).
4. Rien d'autre : un bordereau qui manque est relancé seul tant que vinted.fr est ouvert sur le compte ;
   la carte du logo dit combien manquent et quoi ouvrir.
