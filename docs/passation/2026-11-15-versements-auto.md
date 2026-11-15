# Dates de versement : l'extension s'en occupe, plus rien à dater soi-même — extension 5.390.0 (15 nov. 2026)

Branche `claude/versements-auto`, partie de `origin/claude/project-review-nsk5su`. Aucune PR.
Julien (15 nov., mot pour mot) : « Enlève les 1741 ventes à dater, cela n'a aucun sens. Le but est
que l'extension récupère ces infos, pas que ça soit à nous de le faire. »

## Pour Julien, en mots simples

- **Plus rien à dater toi-même.** Le compteur « + 1 741 ventes à dater », la carte « ce qui est daté /
  pourquoi / Ouvrir Vinted », « Les dater », « Dater à la main » (Leboncoin), la chose à trancher
  « Ventes à dater », la ligne de « Santé de tes données » et le contrôle de la nuit « ventes sans date de
  versement depuis 30 jours » sont **retirés**. À la place, UNE ligne grise, sans bouton :
  « Dates de versement : l'extension les récupère (≈ 1 741 restantes · environ 97 h avec vinted.fr
  ouvert) ». Elle disparaît quand tout est daté.
- **Les chiffres ne mentent pas pour autant** (§5) : une vente dont la date de versement n'est pas encore
  lue n'est dans aucun mois ; le montant à déclarer dit « au moins » ; une case sans rien de daté dit
  « — · dates en lecture ». Aucune date n'est devinée.
- **L'extension va deux fois plus vite par visite** : 20 ventes datées à chaque passage (10 avant), et
  l'argent prend tout le budget de lecture de l'heure (20, 15 avant) — sans jamais le dépasser, et sans
  prendre la place des codes de retrait, preuves et relevés. Les plus récentes d'abord.
- **Ton geste : aucun.** Installer la 5.390.0 (remplacer le dossier, ⟳ dans CHAQUE Chrome ; Orion :
  `VRM-Orion-dossier.zip`) et, quand tu peux, laisser vinted.fr ouvert sur le grand compte : c'est le
  temps d'onglet ouvert qui fait avancer.

## La mesure (base de prod, lecture seule, 15 nov.)

| quoi | mesuré |
|---|---|
| ventes finalisées sans date, par compte | `199082413` (le grand) : 1 790 finalisées dans la liste, **58** avec leur détail 450, **1 732 sans aucun détail lu** ; `221546061` : 547 ; `16652001` : 333 ; `147827838` : 74 ; les comptes actifs (`3156028798`, `24602614`, `3175765377`, `3170801262`, `3171228253`, `3179807757`) : **tout daté** (109/109, 99/99, 58/58…) |
| mois de vente des 1 732 | mai 2025 → 7 juin 2026 (102 en juin 2025, 188 en août 2025, 209 en février 2026, 213 en mai 2026…) ; les ventes du grand compte d'octobre-novembre 2026 ne sont pas encore finalisées |
| « figé à 230 » (audit fiabilité #13) | **pas la cause** : aucune vente finalisée dans la liste du grand compte n'a un détail à 230 ; ses 21 détails à 230 sont des ventes que la liste ne dit pas finalisées. 230 sur une finalisée : 1 (`147827838`) et 5 (`3168505556`, 230/440), comptes pas relus depuis septembre. La cause des 1 741 : le détail n'a **jamais été lu** |
| rythme réel | détails lus sur le grand compte : 22 le 5 nov., 10 le 6, 11 le 8, 8 le 10, 16 le 11, 2 le 12, 10 le 15 (13:08 → 13:10, puis plus rien : l'onglet n'est pas resté ouvert) — par paquets de 5 à 10, au rythme de ses visites, jamais un passage de fond visible |
| relevé du porte-monnaie | aucune ligne `harvest_*_releve_*` en base (la voie 5.378 n'a encore rien rangé) ; `history` vide sur le grand compte : Vinted n'y liste aucun mois passé |
| `my_orders[].date` | ce n'est pas la finalisation : 0 / 476 le même jour (heure de Paris), 30 % dans un AUTRE mois, 10,6 jours d'écart en moyenne |
| la boîte (`harvest_*_inbox`) | clés `description, id, item_photos, opposite_user, unread, updated_at` ; `description` = le titre de l'annonce, `updated_at` ≠ la 450 (2 sur 4 le même jour) : pas une source |
| les notifications | 731 sur le grand compte, 5 rangées ; le rappel « Laisser une évaluation » (types 290/295, qui porte `transaction_id`) arrive **2 jours après** la 450 : une autre notion |
| liste des commandes en séquestre | `/escrow-orders/api/v2/current-user/escrow-orders` vue 4 fois (chemin seul, `seen_urls`), forme jamais captée : rien de prouvable |
| conversations rangées | aucune pour le grand compte (1 ligne vide) ; ailleurs, le message « vente finalisée » n'existe que sur les conversations déjà à 450 |
| `vrm_lbc_dates` (Leboncoin « Dater à la main ») | **jamais écrit** : la clé n'existe dans aucune ligne `main` (7 propriétaires) — son geste d'avant n'a jamais servi |

⇒ **Aucune source « en lot » n'est attestée pour ces ventes.** La seule date prouvée reste le détail de
la transaction (450, « Commande finalisée »), vente par vente — ou le relevé d'un mois quand Vinted le
liste et que l'adresse a été apprise sur SON geste (5.378 : une lecture date tout le mois, vérifié par
5 accords ; prouvé au banc, rien à vérifier en vrai tant qu'aucun relevé n'est rangé).

## La voie choisie (et pourquoi pas une autre)

Rien de deviné : pas d'adresse inventée (la `payouts?year=&month=` devinée rendait 404), pas de date
estimée depuis la date de vente. On garde la seule source prouvée et on lève ce qui la freinait.

### L'extension 5.390.0 (`capterDatesVersement`, `tickVersements`, `ordreVersements`)
- `VERSEMENT_MAX_PAR_VISITE` 10 → **20** : ses visites sur ce compte sont courtes, chacune date deux fois plus.
- `VERSEMENT_MAX_HEURE` 15 → **20** : l'argent a tout le budget de LECTURE (comme la classe `argent` l'a
  toujours eu) ; jamais au-dessus (`gardeLecture` compte chaque lecture, tous Chrome confondus).
- La réserve des codes de retrait, preuves et relevés **inchangée** (« pas su » ⇒ 8 places gardées).
- **L'ordre** : la plus récente d'abord, partout (le mois en cours et le précédent se déclarent, puis
  l'historique en remontant ; la 5.376 lisait les plus anciennes d'abord hors des 45 derniers jours).
- `VERSEMENT_PAR_HEURE_ESTIME` 12 → **18** (= `VERSEMENTS_PAR_HEURE` de l'app, comparés par l'audit).
- Carte du logo : « Dates de versement : l'extension les récupère · N restantes · environ X h avec Vinted
  ouvert sur ce compte » ; la ligne « ouvre une fois Porte-monnaie → Historique » est **retirée** (aucun
  geste demandé ; la recette s'apprend quand même s'il ouvre cette page de lui-même).
- Inchangés : compte de l'onglet, une requête à la fois, pause 2–5 s, 429/403 ⇒ pause et arrêt, « pas
  su » ⇒ rien, un détail encore à 230 ⇒ rangé, pas daté.

### Le temps qu'il faudra (onglet vinted.fr ouvert sur le grand compte)
| | avant (5.389) | après (5.390) |
|---|---|---|
| par visite courte | 10 ventes | 20 ventes |
| par heure d'onglet ouvert | ≈ 12 (15 au plus) | ≈ 18 (20 au plus) |
| les 1 741 | ≈ 146 h d'onglet ouvert | ≈ 97 h d'onglet ouvert |
Une date de fin n'est jamais affichée : elle dépend du temps où l'onglet est ouvert.

### L'écran (une ligne, aucun geste)
- `src/versementRaisons.js` : `ligneDatesVersement(ad)` (null quand tout est daté ; sinon `{ n, heures }`,
  heures sur les ventes que l'extension lit une par une) ; `RAISONS_A_DATER` sans `geste` ;
  `VERSEMENTS_PAR_HEURE` = 18.
- `src/composants/LigneDatesVersement.jsx` : la ligne, `tr('versement.ligne')` (5 langues), sans bouton.
- Argent → Déclarer (`PrevisionUrssafCarte`) : étape 2 = la ligne ; `ADaterRaisons` (carte des raisons,
  « Ouvrir Vinted », « Dater à la main », « Importer », relevé pas vérifié) retirée ; « · N à dater » et la
  ligne « À dater » du détail de l'échéance retirées. Carte du mois : une puce = la ligne (plus « mets
  l'extension à jour »). « Vendu et reçu » : la ligne ; Leboncoin : « l'extension la relève sur
  leboncoin.fr » ; **`DaterVentesLbc` retiré** (`vrm_lbc_dates` reste LU : « Remis en main propre » l'écrit).
- Cases du haut (`carteChiffres.js`, `CarteStats.jsx`, `argent.js`, Ma semaine) : « au moins » ; sans valeur :
  « — · dates en lecture ». Ma journée (cellule « Reçu ») : idem.
- Alertes retirées : `aTrancher` (`ventes-a-dater`), `santeDonnees` (`ventes-a-dater`), `controleNuit`
  (`versement-30j`, + le cron `api/_lib/controle-nuit.js` ne projette plus `aDater`), `VeilleJournee`.
- Mois bouclé / Clôturer l'année : la ligne « Dates de versement en lecture » reste dite mais **inerte**
  (plus de porte, plus de « Ouvrir Vinted ↗ » ni « date à recopier »).
- Libellés : DAC7 et clôture « si les ventes sans date de versement comptent », registres à l'écran
  « Dans aucun mois · sans date de versement », vue comptable, glossaire, fiche d'une paire, import.
- **Aucune règle de calcul n'a changé** : `ventesDeclarables`, `datesDeVersement`, `api/_lib/*-regle.js`
  intacts (rien à refabriquer).
- Restent tels quels (documents pour le comptable, pas l'écran) : les exports PDF/tableur et le livre
  des recettes nomment encore « à dater » ce qui est dans aucun mois.

## Preuves (§6)

| contrôle | sur ce code | arbre de départ (`git archive f782040f`, le contrôle copié dedans) | mutations |
|---|---|---|---|
| `audit-versements-auto.cjs` (vrai `background.js` par `_fond-vm` + règles de l'app) | 34 ✅ | **14 ❌** (10 lus par visite, la plus ancienne d'abord, 15/h, rythme 12, carte « ouvre Porte-monnaie », pas de `ligneDatesVersement`, « + 1 741 ventes à dater », `versement-30j` et `ventes-a-dater` encore là…) | **10/10 mordent** (20 → 10 par visite, budget de lecture 20 → 40, la plus ancienne d'abord, réserve des autres ignorée, garde du compte retirée, « pas su » ⇒ on lit quand même, 230 daté, rythme carte ≠ app, ligne quand tout est daté, « + N ventes à dater » remis) — chaque mutation dans son propre processus |
| banc `versements-auto.cjs` (390 tactile et 1512, clair et sombre, + sans extension + tout daté) | 46 ✅ | — | — |
| bancs `dates-versement` (31 ✅, réduit à la publication), `veille` (52 ✅), `badge` (148 ✅) | ✅ | | |
| audits mis à la décision (attendus changés, rien d'affaibli ailleurs) : `versement-rapide`, `versement-sources`, `dates-versement`, `releve-verif`, `sante-donnees`, `veille`, `a-trancher`, `cloture-annee`, `onglets-a`, `onglets-d`, `journee-coherence` (A2), `argent` (A2), `import-autre-outil` | ✅ | | |
| `urssaf`, `une-regle`, `chiffres`, `coherence`, `extension-zip`, `paquets-boutiques`, `extension-navigateurs`, `budget-lectures`, `releve-mois`, `traduction`, `tdz`, `variables`, `quoi-de-neuf`, `fonctions-api`, `prevision-urssaf`, `rappel-urssaf`, `mois-boucle`, `dac7-comptes`, `registres`, `livre-registre`, `carte-chiffres`, `bilan-semaine`, `argent-choix`, `identite`, `versement`, `versement-releve` | ✅ | | |
| rouges DÉJÀ rouges sur l'arbre de départ (pas de ce lot) | `argent` A4 (navigation), `journee-coherence` A4 ; bancs `a-trancher` et `sante-donnees` ne démarrent pas (`JSON.parse` des SYNC_KEYS d'App.jsx, un commentaire dans la liste) | idem | |

Captures regardées (`SHOTS`, banc `versements-auto`) : « Déclarer » 390/1512 clair/sombre (étape 2 = la seule
ligne grise « Dates de versement : l'extension les récupère (≈ 41 restantes · environ 3 h avec vinted.fr
ouvert) », montants « au moins »), sans extension (la ligne sans délai), tout daté (rien), Ma journée.

Version : `CODE_VERSION`, manifeste, `EXT_ATTENDUE`, `EXT_CAPACITES.versementsauto` (`ordrePlusRecentes`,
FONCTIONS d'`audit-coherence`), transports Leboncoin, `public/extension-version.json`, notice Orion ; zips
régénérés une fois après le vrai merge d'`origin/claude/project-review-nsk5su` (`origin/main` déjà dedans) ;
5.390 vérifiée libre sur toutes les branches `claude/*` (seule `meme-photo-sure` porte une 5.388).

## Ce qui reste à vérifier en vrai
1. Le grand compte (`199082413`) : après installation de la 5.390, une visite doit ranger 20 détails
   (`harvest_199082413_txn_*`, `capturedAt` du jour) au lieu de 10, en commençant par juin 2026.
2. Le passage de fond (`vrm-versement`, 20 min) n'a jamais laissé de trace sur Orion : à regarder si
   l'onglet reste ouvert (lignes rangées toutes les 20 min, ou rien).
3. La liste des commandes en séquestre : si un jour sa forme est captée et qu'elle porte une date de
   finalisation par n° de transaction, ce serait la première source en lot — à vérifier par accords
   comme le relevé, jamais à supposer.
