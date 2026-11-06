# 6 nov. — Le statut de chaque colis, son point, son transporteur, sa date (branche `v36-statut-colis-2`)

Julien (6 nov.) : « Améliore la fiabilité sur le statut de chaque colis, le point de retrait, etc. »
Constats de départ : un colis irlandais affiché « Chronopost » ; 3 colis arrivés le matin dont
le transporteur disait encore « en route » alors que l'e-mail « disponible » était là ; « 34 à
vérifier » dont la plupart déjà retirés selon lui ; un même point (Tabavap) décrit par Mondial
Relay et par un e-mail Vinted sans identité.

Branche locale depuis `claude/project-review-nsk5su`, rien de poussé. Les autres sessions du jour
tiennent les COMPTES de colis (`v36-audit-chiffres-2`) et leur PRÉSENTATION (`v36-visuel`) : ici,
la justesse colis par colis. Changements de `src/App.jsx` chirurgicaux ; l'essentiel est dans les
modules.

## 1. La mesure, colis par colis (sa base, lecture seule)

Copie fraîche du 6 nov. vers 16 h UTC (lignes colis relues entières : `email_track_*`, `transp_*`,
`harvest_*_suivi_*`, achats, `panel_colis_relais`, `main` ; le reste de la copie du matin), hors
dépôt. Deux harnais du scratchpad, jamais commités :
- l'app RENDUE sur la copie, avec un build de mesure qui expose ses listes (`pickupUnion`, les
  points) — ce que l'écran décide pour chaque colis, et le détail de chaque ligne ouverte ;
- un recalcul indépendant : toutes les sources d'état regroupées PAR IDENTITÉ (n° de suivi,
  transaction, code de retrait, conversation) — e-mails, SMS, lecture transporteur (`etat`,
  `etatAt`, `lu`), suivi Vinted, statut de la commande, code de la conversation, gestes
  « J'ai retiré » — puis l'état attendu par la règle du §2.

30 derniers jours : **211 colis** (188 reçus, 23 envoyés ; 190 reçus « avant » : sans la
conversation décodée, deux e-mails relus ne se reliaient pas à leur colis). Sa base n'a encore
aucun SMS rangé.

### Écarts, avant → après (colis reçus)

| état prouvé (recalcul) | ce que l'écran montrait avant | avant | après |
|---|---|---|---|
| retiré | rien (juste) | 69 | 93 |
| **retiré** | **« à vérifier »** | **21** | **0** |
| **retiré** | **« peut-être en double »** | **5** | **0** |
| annulé / remboursé | rien (juste) | 20 | 20 |
| en route | section « En route » (juste) | 34 | 34 |
| disponible | à retirer (juste) | 11 | 12 |
| **disponible** | **à retirer ET « peut-être en double » (le même colis deux fois)** | **1** | **0** |
| disponible, aucune identité vers un transporteur | « peut-être en double » (juste, pas expliqué) | 18 | 18, expliqué |
| disponible, commande sans n° de suivi | « peut-être en double » | 1 | 1 |
| disponible, au-delà de la garde | « à vérifier » (juste) | 2 | 2 |
| disponible, e-mail de plus de 21 jours | rien (hors fenêtre de relecture) | 2 | 2 |
| sans état de position (info) | rien | 6 | 6 |

Sur l'écran : **À retirer 12 → 12** (le même colis n'est plus compté d'un côté et doublé de
l'autre), **À vérifier 34 → 2**, **Peut-être en double 34 → 19**, cartes de point 7 → 5.

### Les autres écarts mesurés

| écart | avant | après |
|---|---|---|
| lecture du transporteur « en route » faite AVANT l'e-mail « disponible », écrite « — en route » sur la ligne | 2 colis | 0 (dite « lu il y a 8 h, avant l'arrivée — pas encore relu depuis : l'e-mail d'arrivée fait foi ») |
| transporteur deviné « Chronopost » sur un colis postal irlandais (lignes `transp_chronopost_…IE` abandonnées : « introuvable » 3 fois, `fini`) | 2 cartes | 0 (« Colis international (Irlande) ») |
| transporteur dit « en route » avec un événement daté APRÈS l'arrivée | 0 | 0 (règle posée, banc) |
| date limite lue dans l'e-mail ≠ date déduite du transporteur (27/11 et 05/12 lus, « 5 jours restants » chez Mondial Relay) | 3 colis | 3, l'e-mail fait foi (inchangé : c'est écrit dans l'e-mail) |
| colis à retirer avec date limite lue / sans | 11 / 1 | 11 / 1 (le sans : transporteur pas lu ⇒ « Date limite inconnue ») |
| colis à retirer avec code / code à venir | 11 / 1 | 11 / 1 |
| point Tabavap : cartes | 1 (13 lignes dont 12 moitiés Vinted relues sans identité) | 1 (1 colis) |

Envois : 10 « à envoyer » = 10 ventes « Bordereau envoyé » (`needs_action`), 2 en attente,
20 envoyés — l'état vient de la transaction Vinted, **0 écart**. Aucun e-mail du transporteur
côté envoi ne se relie à un bordereau par son n° (2 « retiré » d'envois, rien à corriger).

## 2. La règle d'état unique et datée — `api/_lib/etat-colis.js`

Une règle pure, importée par l'app, le widget et le rappel du matin (pas de copie : ils lisent
le même module), sur des preuves PORTANT L'IDENTITÉ du colis :
1. un état **fini** prouvé gagne : retiré / livré, puis retour, puis annulé (un « retiré » gagne
   toujours sur un « retour », la règle de `finsDesLignes`) ;
2. sinon l'état le plus avancé (en route < disponible) **ne recule jamais** devant une source plus
   vieille : une lecture dont l'événement ET l'heure de lecture précèdent la preuve est **en
   retard** — dite comme telle, jamais l'état du colis (`lectureEnRetard`) ;
3. une source qui dit moins avec un événement daté **après** la preuve (plus d'une heure : les
   horloges diffèrent) **contredit** : rien ne l'explique ⇒ « à vérifier », la raison écrite
   (`contredit`, `etatProuve(...).conflit`) ;
4. sans date, une preuve compte mais ne contredit rien.

Où elle agit :
- `fusionTransporteur` (api/_lib/suivi-colis.js, partagée app / rappel du matin) : une ligne
  « disponible » + transporteur « en route » ⇒ `transpEnRetard` ou `transpContradiction` ;
- `pickupUnion` (App.jsx) : la contradiction passe « à vérifier » APRÈS les fins prouvées (un
  retiré par une autre identité gagne) ; la raison est dite sur la ligne (« Contradiction ») et
  dans son détail (« À vérifier : … ») ;
- `api/widget.js` (`sortisDepuisPhoto`) : la même contradiction ⇒ « à vérifier », jamais compté ;
- `rappelsRetraitDuJour` : aucun « dernier jour » pour un colis en contradiction ;
- `ligneTransporteur` (api/_lib/transporteurs.js) : `preuve` facultative ⇒ `etatAffiche:
  'en-retard'` (« lu il y a …, avant l'arrivée »), sans conséquence ni ambre.

## 3. Les corrections

1. **La conversation d'un e-mail Vinted relu se décode dans le navigateur**
   (`api/_lib/achat-arrive-relais.js`, `decoder64`). `Buffer` n'existe que dans Node :
   `src/arriveesRelues.js` (les e-mails « Commande mise à jour » gardés avant le 3 nov.)
   rendait une conversation vide, sans erreur ; la ligne prenait une clé d'empreinte et perdait
   son identité. Mesuré : 49 e-mails relus, dont 32 d'achats « Transaction finalisée », 5
   « déposé », 1 suspendu — affichés « à vérifier » (garde dépassée) ou « peut-être en double ».
   `atob` + `TextDecoder` (un dernier caractère seul d'un lien coupé est ignoré, comme `Buffer`) :
   sur les 101 e-mails de sa base qui se relisent, clé et conversation identiques au serveur.
   C'est ce qui ramène « 34 à vérifier » à 2 — Julien avait raison, ils étaient retirés.
2. **« Fini » n'est pas une réponse du transporteur** (`src/transporteursVisuels.js`,
   `transporteurDuColis`) : le serveur pose `fini` aussi quand il abandonne (`finiApres` :
   introuvable 3 fois, suivi expiré). Seule une lecture réussie (`lu` ou `etat`) nomme le
   transporteur. Et `LigneTransporteur` ne montre plus la ligne jamais lue d'un colis postal
   international (trace de l'ancienne devinette).
3. **La lecture en retard et la contradiction** (§2).
4. **Date limite** : lue (e-mail, puis transporteur sûr) d'abord ; sinon, pour un transporteur LU
   de la table des gardes mesurées, « Vers le JJ/MM (estimé : Mondial Relay garde un colis 5
   jours) » (`limiteEstimee`, api/_lib/retrait-colis.js — la borne même de `etatRetrait`) ;
   transporteur pas lu ⇒ « Date limite inconnue », jamais une garde prêtée.
5. **« Peut-être en double » expliqué une fois** en tête de section (`explicationEnDouble`,
   src/retraitPreuves.js) : le fait, pourquoi ils ne comptent pas, le geste (relire le compte de
   l'achat, ou relier l'adresse qui reçoit ces e-mails).
6. **Le point de retrait** : la règle existante (nom propre + code postal ; un lieu sans code
   postal ne rejoint que le seul point de ce nom, dans sa ville, à sa rue ; jamais par le nom seul
   entre deux villes ; casier ≠ comptoir) tient les trois écritures de Tabavap — prouvé au banc
   (C7-C10). Sur sa base, le « deuxième Tabavap » était fait des moitiés Vinted sans identité
   (§3.1), pas d'un défaut de regroupement. Le transporteur du point n'est nommé que lu.

## 4. Preuves

- `scripts/bancs/statut-colis.cjs` (ajouté au lot CI : `scripts/lancer-bancs.cjs` et la part 2 de
  `.github/workflows/verifier.yml`) : 20 cas pièges, données INVENTÉES de la vraie forme (SMS
  rangés par la vraie route `ligneSms`, e-mails gardés avec leur lien `links.vinted.com` en
  base64), 390 tactile clair/sombre + 1512 : **81 verts**. Section, point, transporteur lu, code,
  date limite et raison jugés sur les data-* et `vrm_colis_retirer.total`.
- Arbre d'avant (`git archive claude/project-review-nsk5su`, banc copié dedans, lancé depuis lui) :
  **18 rouges** (9 par vue : C1, C2 ×2, C5, C14, C15, C16, explication, total 13 au lieu de 11).
- Mutations, chacune rouge : M1 décodage sans `Buffer` retiré (3 rouges), M2 `fini` nomme le
  transporteur (1), M3 lecture en retard présentée comme l'état (1), M4 contradiction ignorée (3),
  M5 pas de date estimée (1), M6 « en double » sans explication (1).
- Captures regardées : 390 clair/sombre (détail C1 : « lu il y a 2 h, avant l'arrivée »), 1512
  (carte Tabavap à 4 colis, « Colis international (Irlande) », casier « Vers le 10/11 (estimé…) »).
- Sur sa copie : les deux tableaux du §1, avant et après, par le même recalcul.
- Audits verts : `npm run build`, `audit-coherence`, `audit-identite`, `audit-codes-retrait`,
  `audit-colis-trois`, `audit-retrait-fiable`, `audit-suivi-colis`, `audit-transporteur-lu`,
  `audit-sms-colis`, `audit-tdz` ; voisins `audit-achat-attend-relais` (30), `audit-retrait-preuves`
  (26), `audit-transp-notif`, `audit-transporteurs`, `audit-statut-transporteurs`,
  `audit-fonctions-api`, `audit-colis-prochain`, `audit-retrait`, `audit-mondialrelay-serveur`.
- Bancs voisins : voir §6.

## 5. Ce qui reste

- **2 e-mails Vinted de plus de 21 jours** ne sont relus par personne (fenêtre de
  `requeteArrivees`) : ils n'apparaissent nulle part. Au-delà de trois gardes, ils ne seraient que
  « à vérifier » ; pas changé ici.
- **18 « peut-être en double »** arrivent sur une adresse qu'aucun compte relié ne porte : seul
  son geste les relie (relier l'adresse, ou relire le compte de l'achat).
- **Extension (rien changé ici)** : la règle de retrait n'y est pas copiée (elle capte, l'app et
  le serveur jugent). À faire dans une version d'extension :
  1. `contratSuivi` / `capterSuivisAchats` : ranger le code brut du transporteur courant
     (`journey_summary.current_carrier.code`) même hors forme machine (déjà noté le 6 nov.,
     onglets B) ;
  2. relire en priorité le suivi Vinted d'un achat dont un e-mail dit « disponible » alors que le
     suivi rangé dit encore « en route » (la lecture en retard se résout seule à la visite) ;
  3. `transpTick` : quand le serveur lit « en route » plus vieux qu'un e-mail « disponible », la
     relecture depuis l'ordinateur devrait passer en tête (même ordre que `ordreAInterroger`).
- `aExpedier` (envois) : intouché, aucune divergence mesurée.

## 6. Bancs voisins

Sur le build final : `colis-retirer-propre` 120 verts, `colis-envoi` 114 verts, `colis-sms` 57 verts,
`statut-colis` 81 verts. `transporteurs` : 1 rouge, « F n° 8 : « Reçus 1,7 k » sur une ligne »
(l'onglet d'Achats s'appelle « Arrivés » depuis le 5 nov.) — le même rouge sur l'arbre d'avant,
pas causé ici, à reprendre par le chantier d'Achats.

## Geste de Julien

Aucun : ouvrir Colis → À retirer ; « À vérifier » ne montre plus que les 2 colis vraiment à voir.
