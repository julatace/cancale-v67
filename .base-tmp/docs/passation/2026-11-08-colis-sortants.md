# 8 nov. — Colis vendus : « parti » prouvé chez le transporteur (branche `claude/colis-sortants-suivi`)

## La demande (Julien, 8 nov., mot pour mot)
« J'ai une commande qui est marquée comme non envoyée car je n'ai pas réactualisé Vestiaire
Collective, mais tu as le numéro de suivi donc tu peux très bien regarder le statut du colis et
voir qu'il a été expédié. Je te laisse faire ça pour tous les colis, comme ça il n'y a plus
d'erreur. »

## Ce qui change pour lui
Une vente encore « à envoyer » chez son site (Vestiaire pas relu, Vinted pas relu) dont le n° de
suivi EXACT est pris en charge chez le transporteur sort de « À envoyer » (Colis, Ma journée, la
cloche `vrm_colis_aposter`, le badge, le widget, le rappel du matin et du soir, le bilan) et passe
dans Colis → « Envoyés » avec la raison : « Chronopost l’a pris en charge le 7 nov. » (Vestiaire :
« Vestiaire · Chronopost l’a pris en charge le 7 nov. »). Dans Ventes (toutes plateformes et
l'écran Vestiaire), la vente Vestiaire dit « Envoyée — Chronopost l’a pris en charge le … ».
C'est un état DÉDUIT, recalculé à chaque affichage : rien n'est écrit dans les données du site,
aucun faux « Colis fait ». Geste de Julien : aucun.

## Mesuré d'abord (code et bancs — pas d'accès à la vraie base dans cette session)
| site | n° du colis sortant | transporteur | lu comme départ ? |
|---|---|---|---|
| Vestiaire | `vc_ventes.ventes[id].suivi` + `transporteur` (relevés par l'extension, `vc-inject.js` `noteTimeline` / `suiviAchat`) | « Chronopost » (mesuré le 2-3 nov. : `transporteur` = « Chronopost », bordereau Chronopost TCPDF 841,89×595,28 — historique colis) | **oui**, Chronopost par le serveur (`ws.chronopost.fr …/trackSkybillV2`, n° seul) |
| Vinted | `email_bord_{tx}.suivi` (bordereau e-mail, relié à SA transaction) | mesuré le 2 nov. : 94 n° sur 214, **tous Chronopost stricts** ; les n° Mondial Relay ne sont jamais captés dans l'e-mail | **oui**, Chronopost (et Vinted Go si un jour un n° `VGS…`/transporteur Vinted Go y est) |
| Leboncoin | aucun n° de suivi relevé (`lbc_ventes` ne porte que `deliveryMethod`, `label`) | Mondial Relay / Shop2Shop | **non** — rien à lire (aucun n°) |
| eBay | une commande « à poster » n'a pas encore d'étiquette ni de n° (eBay la passe FULFILLED lui-même à l'étiquette) | — | **non** — rien à lire |

Transporteurs lus comme départ : **Chronopost** et **Vinted Go** (n° seul, lus par le serveur, la
même voie mesurée le 24 oct.). **Pas lus, et pourquoi :**
- **Mondial Relay** : sa seule route lisible par le serveur (`_mvc/…/RechercherJsonResponsive`)
  exige le code postal du point de DESTINATION — celui de l'ACHETEUR, que VRM ne connaît pas et ne
  devine jamais (essayer des codes postaux au hasard serait deviner). Pas lu.
- **Colissimo, UPS, DHL, DPD, Relais Colis** : aucune route publique sans clé n'a été mesurée
  (rien dans le code ni l'historique) ; une API payante sur la clé de Julien est interdite (§2.9).
  Pas inventé. Si Vestiaire écrit un jour un de ces transporteurs, la vente reste « à envoyer »
  (comme avant) jusqu'à ce que Vestiaire soit relu.

## La règle — `api/_lib/depart-colis.js` (pure, importée par l'app ET le serveur, §11)
- `priseEnCharge(lu, carrier)` : prouvent la prise en charge « en route » (sauf `detail: 'prepare'`
  = étiquette créée : Chronopost DC seul, Vinted Go `created`, Mondial Relay étape 1),
  « disponible », « retiré », « livré », « repart chez l'expéditeur », « a quitté le point relais ».
  Ne prouvent rien : « inconnu », « incident », introuvable, refus, rien lu. La date est celle du
  PREMIER évènement après l'étiquette (Chronopost : premier code hors DC/SM ; Vinted Go : premier
  groupe hors `created`).
- `ligneDepartApresEssai` : la ligne `depart_{transporteur}_{n°}` ; `priseAt` ne s'efface jamais
  (une lecture plus pauvre ensuite ne fait pas reculer) et ferme le n° (`fini`, plus relu).
- `departProuve(suivi, departs, { venteMs, ambigus })` : identité = le n° EXACT ; un n° sur deux
  ventes, ou sur une vente ET un achat, est ambigu ⇒ rien ; une prise en charge datée plus d'un jour
  AVANT la vente (ou le bordereau) contredit l'identité ⇒ rien ; `departs` null ⇒ rien (pas su).
- `departsAInterroger` (le serveur) : ventes Vestiaire `aExpedier` avec n° + bordereaux Vinted, de
  moins de 21 jours ; jamais un n° d'achat (ligne `transp_`, e-mail entrant, suivi saisi, suivi
  Vinted d'achat) ; Chronopost et Vinted Go seulement ; une lecture toutes les 2 h, recul sur échec,
  3 « introuvable » ⇒ fin ; 3 par passage de l'app, 6 par cron.
- Consommateurs : `colisVcAPoster` / `departsVc` / `colisVcPartisLus` (api/_lib/vestiaire-regle.js —
  donc Colis, Ma journée, la cloche, le widget, les rappels) et `txVintedParties` (Vinted : app
  `bordShipped` + `cochesNonPartis`, widget `shipTxns`, rappels `txsAExpedier`).

## Le cloisonnement (la protection de « à retirer »)
Les lectures de départ vivent dans des lignes À PART, `depart_{transporteur}_{n°}` — **jamais
`transp_…`**. `ligneTranspDeMeta` (le seul lecteur des lignes du transporteur pour « à retirer »,
le widget, le rappel du matin, les notifications) n'accepte que `transp_` ; `suivisAInterroger`
(la sélection des achats) n'a pas changé : toujours aucun n° sortant. `passageDeparts` ne sonne
rien. Un colis vendu arrivé au point relais de l'acheteur ne devient donc jamais « à retirer »
chez Julien (prouvé par l'audit serveur et le banc, colonne R).

## Le serveur — `api/_lib/transporteurs-lecture.js`
`passageDeparts(b, …)` tourne APRÈS les achats, avec ce qui reste du budget, dans
`passageTransporteurs` (app : `/api/relais?mode=transp`, 3 départs ; cron : 6). Mêmes garde-fous :
la même file par transporteur (1,5 s, UA honnête « VRM-suivi/1.0 », aucune redirection), la même
pause sur 403/429/défi (qui lève ou pose la pause commune), la même borne de temps, un bail de 30 s
sur la ligne. Jamais pour un n° demandé seul (page de suivi d'un achat). Base illisible ⇒ aucune
lecture chez un transporteur. Pas de relais par l'extension (Chronopost et Vinted Go se lisent par
le serveur) : l'extension n'est pas touchée (pas de nouvelle version).

## L'app — `src/App.jsx`
- `fetchDepartsBrut` / `chargerDeparts` (scalaires `meta->>`, paginé, strict) ; relu à
  `vrm:transp-maj` et quand le passage rend un départ prouvé ; `avecNumerosVc` porte `departs`.
- Colis → À envoyer : sorti (Vestiaire par `colisVcAPoster`, Vinted par `bordShipped`).
- Colis → Envoyés : `listeEnvoyes` ajoute les Vestiaire partis (`type: 'vc'`, `depart`) et les Vinted
  partis (`type: 'transp'`), `data-depart-lu`, la phrase, frise « Déposé · En route ».
- Ventes : `etapeVenteVc(v, depart)`, `VentesToutes` (« Envoyée »).
- ⚠️ `ColisVestiaireBloc` n'est rendu nulle part depuis le 3 nov. (une seule liste tous sites) :
  non modifié.
- Non fait : `stockVestiaire` (Stock) garde une vente « à expédier » partie dans « à poster » (la
  paire n'est plus là ; à brancher sur `departsVc` si Julien le voit).

## Preuves (§6)
- `scripts/audit-colis-sortants.cjs` — 34 contrôles (prise en charge, 50 ventes au même titre ⇒ une
  seule sort, ambigus, avant la vente, pas su, sans recul, cloisonnement, sélection, Vinted, une
  règle partout). Sur `origin/main` (git archive) : **12 rouges sur 14**. Mutations : accepter
  « prepare » ⇒ 2 rouges ; retirer l'ambiguïté et la date de vente ⇒ 4 rouges.
- `scripts/audit-statut-transporteurs.cjs` — nouvel essai serveur « (8 nov.) colis vendus » (faux
  Supabase + faux Chronopost) : lu, « DC » seul ne prouve rien, n° vente+achat jamais lu, Mondial
  Relay pas lu, aucune ligne `transp_`, aucune notification, plus relu une fois prouvé, widget
  Vestiaire 4 → 3, départs en panne ⇒ 4. Sur `origin/main` : 5 rouges. Mutations : écrire en
  `transp_` ⇒ 6 rouges ; oublier les achats ⇒ 4 rouges.
- `scripts/bancs/colis-sortants.cjs` — 390 tactile et 1512 : À envoyer (seuls les jumeaux non pris
  en charge), Envoyés (raison), À retirer (aucun), Ma journée (2), pas su (4). 30 verts ; sur
  `origin/main` : 8 rouges. Captures regardées (Envoyés 390 et 1512).
- `scripts/audit-statuts.cjs` : le bac à sable de `bordShipped` reçoit `partisTransp` (Map vide).

## Ce qui a tourné, et les rouges
- Audits verts : `audit-identite`, `audit-statuts`, `audit-coherence`, `audit-fonctions-api` (12
  fonctions, aucune ajoutée), `audit-statut-transporteurs`, `audit-transp-ext`,
  `audit-transporteur-lu`, `audit-vestiaire-partout`, `audit-bilan-semaine`, `audit-colis-*`
  (envoi, sens, trois, retrait, prochain, heure), `audit-mondialrelay-serveur` et 30 autres audits
  qui lisent widget / rappels / relais. Rouge PRÉEXISTANT (identique sur `origin/main`) :
  `audit-politique-hotes` (`src/enLigneLbc.js` → www.leboncoin.fr hors liste).
- Bancs verts : `colis-sortants` (nouveau), `vestiaire-colis`, `colis-envoi`, `widget-colis`,
  `statut-colis`, `postes`, `poste-sans-depart`. Rouges IDENTIQUES sur `origin/main` (git archive,
  même banc, autre port) : `chiffres-coherents` (widget en 503 au banc, E et R), `colis-tous-sites`
  (widget 503), `statuts-colis` (groupe « prêt à imprimer », filtres), `journee-coherence` (E9
  « Voir » vers le Stock). `vestiaire-parite` : 2 rouges d'environnement (`pdfjs-dist` absent du
  `node_modules` de ce conteneur), sans rapport.
