# 9 nov. (soir) — Lot AJ : le plus récent en haut, partout, tous comptes mélangés (branche `claude/ordre-recent`)

## La demande (Julien, mot pour mot)
« Les ventes, achats, colis à expédier, à préparer ne sont pas rangés dans l'ordre, du plus récent en haut
au plus vieux en bas, peu importe le compte, ça doit être parfait. »
(`docs/passation/2026-11-09-propositions.md`, « Demandes de Julien du 9 nov. (soir, 21 h) », point 3 ;
file des lots : AJ.)

## ⚠️ Décision NOUVELLE de Julien — elle remplace le tri « par urgence »
Colis → « À envoyer » et « Préparer mes colis » étaient rangés par urgence (date limite la plus proche
d'abord, puis par transporteur — décisions des 2-3 nov. et 8-9 nov.). **Depuis le lot AJ, l'ordre est la
vente la plus RÉCENTE en haut.** La date limite reste écrite sur chaque carte (ambre si aujourd'hui/demain),
et la ligne d'urgence du haut dit « sa date limite est écrite sur sa carte » (plus « le plus pressé est en
haut »). Ne pas remettre le tri par urgence sans qu'il le demande.

## La règle unique — `src/ordreRecent.js`
`ordreRecent(liste, quand)` : date décroissante, **stable** à date égale (l'ordre reçu), une ligne **sans date
lue en bas** (jamais datée au hasard), rien n'est muté. `msDe` lit ISO, ms, secondes Unix, `Date` ; 0, vide,
illisible ⇒ pas de date. `nbSansDate` / `debutSansDate` / `PHRASE_SANS_DATE` : « N sans date lue, en bas de
la liste » posée UNE fois au-dessus d'elles (`LigneSansDate`, App.jsx).

| type | date de référence | fonction |
|---|---|---|
| vente | date de vente lue : Vinted `o.date` · Leboncoin `dateVente`, sinon la date relevée/datée (`vrm_lbc_dates`) · eBay `creationDate` · Vestiaire `date`, sinon `premiereVue` (Vestiaire ne la donne pas toujours ; la 1re lecture est la seule date LUE qui reste) | `quandCommandeVinted`, `quandLeboncoin`, `quandEbay`, `quandVestiaire` |
| achat | date d'achat lue (mêmes champs) | idem |
| colis à envoyer | date de la VENTE du colis | `quandColisAEnvoyer` |
| colis envoyé | prise en charge lue, sinon « Colis fait », sinon date de vente — `quandEnvoye` (src/colisEnvoyes.js, inchangée) ; `rangerEnvoyes` = `ordreRecent` | — |
| colis à retirer | date d'ARRIVÉE lue au point (`arrivee` posée par Colis : `arriveeColisEmail`, ou `arriveeSure` d'un achat vu par Vinted — jamais la borne « au plus tard ») | `quandARetirer`, `ordreRecentPoints` |

## Les listes changées
| liste | avant | maintenant |
|---|---|---|
| Ventes Vinted (Comptabilite `ventesAffichees`) | date, puis le compte choisi/connecté EN TÊTE | date seule ; le compte choisi reste net, les autres floutés **à leur place dans le temps** |
| Ventes « Tous » (`VentesToutes`) | date (déjà) | la règle unique + « sans date lue » dit |
| Ventes Leboncoin (`VentesLeboncoin`) | l'ordre de lecture | date de vente lue |
| Ventes Vestiaire (écran Vestiaire) | à expédier d'abord (limite), puis date | date seule (l'étape reste sur la ligne) |
| Ventes eBay (écran eBay) | l'ordre de lecture, compte par compte | date, comptes eBay mélangés |
| Achats Vinted (`achatsAffiches`) | l'étape d'abord (au relais…), puis date, puis compte choisi en tête | date seule (« En route » l'était déjà depuis le 5 nov.) |
| Achats Leboncoin / Vestiaire | date (déjà) | la règle unique (les sections « en route / reçus » de Leboncoin restent, chacune rangée) |
| Colis → À envoyer | urgence, puis groupes par transporteur (en-têtes) | **une liste**, la plus récente en haut ; le transporteur en **pastilles** `vrm-filtres` (« Tous · N · Chronopost N · … », un clic filtre, re-clic = Tous, une pastille vide revient à Tous — `filtresTransporteurs`/`filtrerEnvoyes`, les mêmes qu'« Envoyés ») |
| Colis Vestiaire (site Vestiaire) | ordre lu | date de vente |
| « Préparer mes colis » | l'ordre de la liste (urgence) | l'ordre de la liste (le plus récent) — `colisAEnvoyerRanges` |
| Tournée de dépôt (feuille) | groupes par transporteur, urgence dedans | groupes par transporteur gardés (c'est le réseau où l'on dépose), le plus récent dedans |
| « Tout imprimer » (PDF) | groupes par transporteur (choix n° 2 du 3 nov.) | groupes gardés (c'est un PDF, pas une liste), le plus récent dans chaque groupe |
| Colis → Envoyés | date (déjà, 8-9 nov.) | `rangerEnvoyes` = `ordreRecent` |
| Colis → À retirer | points par limite la plus proche, colis par limite | **un point = une carte (§5) gardé** ; les colis d'un point par arrivée lue décroissante (« à vérifier » sous les comptés), les points par leur arrivée la plus récente (un point sans arrivée datée après, « en route » seul après, « pas encore connu » à la fin). Sections (« Prêts à retirer », « À vérifier », « En route ») inchangées. `pointsARetirer({ …, ordonner: ordreRecentPoints })` : relaisColis.js reste sans import, l'ordre d'avant si on ne passe rien |
| Ma journée : pile des ventes de la frise | date (déjà) | la règle unique |
| Ma journée : vignettes de la carte « À envoyer » | l'ordre de Colis (urgence) | l'ordre de Colis (le plus récent) |
| Instantanés Colis/Ventes (`src/colisVentesInstantanes.js`) | rejouent l'ordre RENDU | inchangés : ils rejouent le nouvel ordre ; plus d'en-tête de groupe à ranger en « À envoyer » |

Attributs posés pour les bancs : `data-ordre-t` (ventes « Tous », achats, cartes « À envoyer », lignes « À
retirer »), `data-envoyer-rang`, `data-envoyer-filtres` / `-filtre` / `-filtre-choix` / `-filtre-n` /
`-filtre-cle`, `data-sans-date`.

**Pas changé (voulu)** : aucun nombre, aucune règle de « à envoyer / à retirer / vendue », aucun style neuf
(classes existantes `vrm-filtres`, `vrm-rangee`) ; Ma journée « À faire » reste une liste de gestes (« le plus
pressé en haut » y est une to-do, pas une liste de ventes) ; le mode relais garde l'ordre de la publication
`vrm_colis_retirer` ; une séance « Préparer » déjà commencée garde son ordre (un colis arrivé pendant la séance
s'ajoute à la fin, règle de `ordreDeSeance`).

## Preuves (§6)
- `scripts/audit-ordre-recent.cjs` : **26 verts** — règle pure (dates de formes différentes, comptes
  entrelacés, égalité stable, sans date en bas, rien muté, références par type, points « à retirer ») + le code
  de l'app (aucun « compte en tête », aucune « étape d'abord », aucun groupe par transporteur dans « À
  envoyer », Préparer = la liste, eBay/Vestiaire/Envoyés par la règle). Sur `origin/main` (`--racine`) : **11
  rouges sur 12**. Mutations (`--module`) : tri inversé ⇒ 5 rouges ; sans date en haut ⇒ 6 rouges. Elle a
  trouvé un vrai défaut : un « à vérifier » faisait monter son point (corrigé : un point se range par ses
  colis comptés).
- Banc `scripts/bancs/ordre-recent.cjs` (390 tactile SOMBRE + 1512 clair, deux comptes Vinted, données
  inventées aux formes réelles) : **62 verts** — Ventes Vinted (avec un compte CHOISI), Ventes « Tous »,
  Achats (avec un compte choisi), Colis → À envoyer (ordre, comptes entrelacés, aucun groupe, pastilles,
  filtre), Préparer, Envoyés, À retirer. Sur `origin/main` (arbre `git archive`, dist reconstruit, banc copié
  dedans) : **18 rouges sur 60** (compte choisi d'abord, urgence, groupes, Préparer, points par limite, sans
  date muet). Mutation (`rangerColisEnvoi` remis par urgence, dist reconstruit) : **6 rouges** (E1, E6, P1).
- Captures regardées (À envoyer 390 sombre : pastilles « Tous · 4 · Chronopost · 2 · Mondial Relay · 2 »,
  ambre sur les limites proches en bas de liste ; À retirer : Tabac de la Houle puis Maison du Quai, colis
  du plus récent au plus ancien ; Ventes 1512) : scratchpad de la session, pas dans le dépôt.
- Bancs mis à jour, DITS (ils exigeaient l'ordre d'avant) : `colis-envoyes-tri` (A : « À envoyer par
  urgence » ⇒ le plus récent d'abord ; 76 verts), `journee-photos` (J1 : vignettes « le plus pressé
  d'abord » ⇒ le plus récent ; C2 : « rangés par transporteur, un en-tête chacun » ⇒ pastilles ; 105 verts).
  Audits mis à jour : `audit-colis-envoi` W et `audit-colis-trois` 2d (la liste filtrée `tousF`).
- Audits verts : `npm run build`, `audit-variables`, `-tdz`, `-coherence`, `-identite`, `-statuts`,
  `-icones`, `-colis-trois` (31), `-relais-carte` (58), `-retrait-preuves` (26), `-villes-colis` (50).
  `audit-colis-envoi` : 1 rouge (« B la barre ne dépend pas de l'onglet ») IDENTIQUE sur `origin/main`.

## Ce qui reste
- Mesurer sur la vraie base combien de ventes Vestiaire n'ont que `premiereVue`, et combien de lignes
  tombent « sans date lue » (pas de base VRM joignable depuis cette session).
- Si Julien veut aussi la tournée de dépôt ou le PDF « Tout imprimer » sans groupes par transporteur : un
  mot, la règle est déjà là.

## Geste de Julien
Aucun. Regarder Colis → À envoyer (le plus récent en haut, la limite sur chaque carte, les pastilles).
