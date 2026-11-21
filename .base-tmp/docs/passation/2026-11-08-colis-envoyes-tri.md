# 8-9 nov. — Colis → « Envoyés » : le plus récent en haut, le bon transporteur (branche `claude/colis-envoyes-tri`)

## La demande (Julien, 8 nov., 23 h 42, capture Colis → « Envoyés · 20 », ordinateur)
« Ici il n'y a pas que 1 Chronopost : il y a le sac qui est de Vestiaire, mais ce n'est pas le seul
Chronopost. Je veux que ce soit amélioré et que tu mettes le plus récent en haut, comme pour tous les
onglets. »
Capture : « Chronopost · 1 colis » (le sac Vestiaire) puis « Autres · 18 colis » (ventes Vinted, ex.
« salomon XT-6 … Au relais de l'acheteur · vendue il y a 14 j », bouton « Chercher » au lieu de « Suivre »).

## La cause
1. **Le transporteur d'une vente Vinted ne se lisait que dans la FORME du n° de son bordereau**
   (`transporteurVente(b) = transporteurColis('', b.suivi)`). Depuis le 6 nov. (onglets B), seule la
   forme propre « XW/ZW + 9 chiffres + TS/SP » nomme Chronopost (un S10 « …FR » ne nomme personne,
   un « …IE » est « Colis international »). Toute vente dont le n° a une autre forme, ou dont le
   bordereau n'a pas de n° (120 sur 214 mesurés le 2 nov. : les n° Mondial Relay ne sont jamais lus
   dans l'e-mail), tombait dans « Autres ». Le bouton « Chercher » de la capture le prouve : la carte
   avait un n° de suivi, mais aucune forme reconnue.
2. **L'e-mail du bordereau** (« Bordereau d'envoi pour … », reçu pour CETTE transaction) n'était lu
   que pour article/N°/taille/suivi/limite — jamais pour le transporteur qu'il nomme.
3. **L'ordre** : des groupes par transporteur, dans l'ordre du premier colis de chaque groupe, et à
   l'intérieur l'ordre de `listeEnvoyes` (rangé par « rang » d'étape : retour, au relais, en transit,
   livré) — jamais par date.

## Mesure de la vraie base : PAS FAITE (dit)
Le seul projet Supabase joignable depuis cette session est « mes-sejours » (une table `docs`), pas
celui de VRM : rien n'a pu être lu. **Aucun chiffre « N colis maintenant reconnus » ne peut donc être
donné honnêtement.** Ce qui est su (passations précédentes, lecture seule, sans donnée personnelle) :
| source | ce qu'on sait | utilisée ? |
|---|---|---|
| n° du bordereau e-mail `email_bord_{tx}.suivi` | 94 n° sur 214 (2 nov.), forme 2 lettres + 9 chiffres + 2 lettres ; 50/50 lignes Chronopost lues ont la forme XW/ZW…TS/SP (6 nov.) | oui (forme, comme avant) |
| e-mails du transporteur du MÊME n° (`email_track_*`, `carrier`) | rangés par n° | oui (déjà, règle commune) |
| ligne `depart_{c}_{n°}` lue chez le transporteur (8 nov.) | prise en charge datée = le transporteur a répondu pour ce n° | **oui, nouveau** |
| transporteur NOMMÉ dans l'e-mail du bordereau | corps jamais gardé en base ⇒ forme du texte **pas mesurée** | **oui, nouveau, pour les e-mails reçus à partir de maintenant** |
| n° Mondial Relay (8 chiffres) après « N° de suivi » dans l'e-mail | pas mesuré (jamais lu jusqu'ici) | **oui, nouveau, à la réception** |
| détail de transaction (`harvest_*_txn_*`, `shipment`) | id/statut ; 0 n° sur 1 290 (23 oct.) ; aucun champ transporteur connu | non (forme pas mesurée) |
| liste des ventes (`my_orders`) | aucun champ transporteur | non |

**À mesurer par une session qui a la base VRM (lecture seule, scalaires seulement)** :
1. `select meta->>'suivi' from app_data where id like 'email_bord_%'` : la répartition des FORMES
   (XW…TS, …FR, vide) — dit combien de ventes restent « inconnu » sur les bordereaux déjà reçus.
2. Après les premiers bordereaux reçus avec ce code : `meta->>'transporteur'` rempli sur combien ?
3. `journey_summary.current_carrier` d'une VENTE (restes-ventes §3, mesure 3) : seule voie pour les
   bordereaux déjà reçus sans n° — une nouvelle version d'extension.

## Ce qui change
- **`src/colisEnvoyes.js`** (une règle, pure) :
  - `transporteurDeVente({ bord, departs, transp, suivisEmail })` : la ligne de départ LUE pour le n°
    EXACT du bordereau (prise en charge datée ; un essai sans réponse ne nomme personne), puis
    `transporteurDuColis` avec `declare = bord.transporteur` (l'e-mail du bordereau) et `suivi = bord.suivi`.
    Rien ⇒ « Transporteur inconnu ». Jamais par titre (banc : 8 ventes au même titre).
  - `quandEnvoye` : prise en charge lue (`depart`, ou `partisVinted` email/transporteur), sinon
    « Colis fait » coché (`shipDone[tx]`), sinon date de vente (Vinted `o.date`, Vestiaire `v.date`,
    Leboncoin `dateVente`). La source est posée en `data-envoye-quand-source`.
  - `rangerEnvoyes` (plus récent en haut, stable, sans date en bas), `filtresTransporteurs`,
    `filtrerEnvoyes` (une pastille qui ne correspond plus à rien revient à « Tous » : aucun colis caché).
- **`api/_lib/transporteur-bordereau.js`** : `transporteurDeTexteBordereau(texte)` — un SEUL
  transporteur nommé (sujet + corps, jamais les pièces) ⇒ sa clé ; deux noms ⇒ rien ; « Vinted » seul
  n'en est pas un (« Vinted Go » oui) ; « point relais » ne nomme personne ; Chronopost + Shop2Shop =
  Chronopost.
- **`api/email-inbound.js` `parseBordereauEmail`** : range `transporteur` (scalaire ⇒ `meta`) et un n°
  Mondial Relay de 8 chiffres écrit après « N° de suivi » (même e-mail = même transaction). Un n° MR
  ainsi rangé laisse la règle de départ d'hier (`depart-vente.js`, e-mail MR du même n°) s'appliquer.
- **App** : `fetchEmailBordereaux` projette `transporteur:meta->>transporteur` ; `transporteurVente`
  = `transporteurDeVente` (donc aussi « À envoyer », le lot, Tout imprimer, la frise, la pastille) ;
  « Autres » → « Transporteur inconnu » partout dans Colis (À envoyer Vestiaire/eBay/Leboncoin aussi).
- **Envoyés** : UNE liste, la plus récente en haut ; pastilles `vrm-filtres` « Tous · N ·
  Chronopost N · … · Transporteur inconnu N » (le plus fourni d'abord, l'inconnu en dernier, un clic
  filtre, re-clic = Tous) ; le transporteur écrit au début de la ligne d'état de chaque carte (pas
  quand une pastille est choisie, ni quand la ligne le dit déjà : « Chronopost l'a pris en charge… »)
  ; une phrase : « Le plus récent en haut : prise en charge lue, sinon « Colis fait », sinon date de
  vente. ». Attributs : `data-envoyes-tri`, `-filtre`, `-filtre-choix`, `-filtre-n`, `data-envoye-rang`,
  `-transp`, `-transp-source`, `-quand`, `-quand-source`. Aucun style ajouté (l'autre agent restyle Colis).
- **Pourquoi une liste et pas des groupes** : il cherche « mon dernier colis » ; des groupes
  obligent à regarder dans chaque groupe. Le transporteur est sur chaque carte et la pastille donne
  le regroupement quand il le veut.
- **Pas changé (voulu)** : « À envoyer » reste rangé par urgence (date limite la plus proche), puis
  par transporteur ; « À retirer » garde sa règle par urgence (`pointsARetirer`, `selecteurVilles`).
- **eBay** : aucune commande eBay partie n'est dans « Envoyés » aujourd'hui (seules les « à
  poster »), et la commande rangée ne porte pas le transporteur (les `fulfillments` ne sont pas lus) :
  rien à ranger, rien d'inventé ; en « À envoyer » une commande eBay dit « Transporteur inconnu ».
  Vestiaire (`v.transporteur`) et Leboncoin (`deliveryMethod`) : déjà lus, mêmes pastilles et même tri.

## Preuves (§6)
- Banc `scripts/bancs/colis-envoyes-tri.cjs` (390 tactile et 1512, clair ET sombre ; base inventée,
  forme servie : `meta->>` projetés, `email_bord_*` avec PDF, `email_track_*`) : **60 verts**.
  Règle pure (12) + par vue : A « À envoyer » par urgence, O ordre, T transporteur par carte, aucun
  « Autres », 3 « Transporteur inconnu », F pastilles et filtre, S « Suivre » chez Chronopost, Z.
- Sur `origin/main` (7acdfc36, arbre `git archive`, banc copié dedans, dist reconstruit) : **26 rouges
  sur 50** — exactement la capture de Julien : groupes « Autres, Chronopost », cartes sans
  transporteur, ordre par étape. « À envoyer » (A) reste VERT sur main et sur la branche : inchangé.
- Mutations (dist reconstruit) : tri remis à l'ancienne (plus ancien en haut) + transporteur de
  l'e-mail du bordereau ignoré ⇒ **21 rouges sur 60** (O, F, T et la règle pure).
- `scripts/audit-transporteur-bordereau.cjs` (la VRAIE route `api/email-inbound.js` exécutée) :
  **6 verts** ; sur `origin/main` **6 rouges sur 6** ; mutation « deux noms ⇒ le premier » ⇒ 1 rouge.
- Audits verts : `npm run build`, `audit-identite`, `-statuts`, `-variables`, `-tdz`, `-coherence`,
  `-colis-envoi` (53), `-colis-trois` (31), `-transporteur-lu` (12), `-fonctions-api`.
- Audits e-mails verts : `journal-emails` (58), `email-formes`, `bordereau-des-email` (41),
  `colis-ventes-email`, `vente-email-fraiche`.
- Bancs existants sur la branche : `colis-sortants` 30, `colis-envoi` 118, `colis-villes` 46,
  `poste-sans-depart`, `postes`, `a-envoyer-preuves` 34 — verts. Rouges IDENTIQUES sur `origin/main`
  (préexistants, pas touchés) : `colis-colonnes` (2), `colis-tous-sites` (12), `colis-fiables` (58).
- Captures regardées (390 clair, 1512 sombre, filtre) : scratchpad de la session, pas dans le dépôt.

## Piste pour les bordereaux déjà reçus
La route garde le texte lisible de chaque e-mail dans `email_texte_*` (audit-journal-emails). Une
session qui a la base VRM peut mesurer depuis quand, puis relire CES textes (lecture seule, par n° de
transaction, la même règle `transporteurDeTexteBordereau`) pour poser `transporteur` sur les anciens
bordereaux — une écriture serveur, une fois, avec sauvegarde (§5 : jamais une migration armée côté
navigateur). Pas fait ici (rien mesuré).

## Geste de Julien
Aucun. Les bordereaux déjà reçus sans n° restent « Transporteur inconnu » (rien à relire : le corps
de l'e-mail n'est pas gardé) ; les nouveaux portent le transporteur que l'e-mail nomme.
