# 11 nov. 2026 · Saisie rapide (second agent, branche `claude/agent2-saisie-rapide`)

Trois choses validées par Julien. Rien sur l'extension, aucune fonction `api/` en plus (12).

## 1. Le prix d'achat demandé le jour de la vente
- **Règle** : `src/prixAchatVente.js` (pure). `ventesSansPrix` : une vente **PROUVÉE** (§5 : les
  `paires` transaction → annonce rendues par `lirePreuvesVenteVinted`, ajoutées en sortie sans
  toucher au bloc `<preuve-vente-regle>`), lue dans les ventes (prix), de **moins de 3 jours**, dont
  la fiche a un N° et **ni prix d'achat ni achat relié** (`prixAchatDe`). L'arriéré garde sa porte
  (« Coût d'achat · 1/184 »).
- **Coque** (`AppCoeur`) : preuves relues quand les ventes changent et toutes les 15 min (jamais à
  chaque fiche touchée) ; la liste est publiée (`poserDemandesPrix`, `src/SaisieRapide.jsx`) pour
  Ma journée (carte ambre `prix-achat-vente`, « Saisir ») ; les ventes neuves sont nommées au
  serveur (`POST /api/push {action:'prixachat'}`), pas la nuit.
- **Serveur** : `api/_lib/prix-achat-demande.js`. Le corps ne fait que nommer (tx, compte, N°,
  prix lu) ; chaque transaction est **relue** (`harvest_{uid}_txn_{tx}`, `meta->>status_title`,
  jamais `select=data`) — état vide ou « pas une vente » ⇒ écartée ; nuit à Paris (22 h – 8 h) ⇒
  rien réservé ni envoyé ; famille « Ventes » coupée ⇒ rien ; mémoire `vrm_prix_achat_demandes`
  (comparer-et-échanger sur `rev`) réservée AVANT l'envoi ⇒ une fois par vente, trois appareils en
  même temps ⇒ une notification ; plusieurs ventes ⇒ UNE notification (« 2 ventes sans prix
  d'achat »). Heures calmes, cloche, groupement : ceux de `sendPushToAll`.
- **Toucher** : `/?tab=journee&cible=prixachat&tx=7001_7002` (aussi par le message `open-url` du
  service worker) ⇒ la feuille « Combien tu l'avais payée ? », un champ par vente, rien d'autre.
  « Enregistrer » : `buyPrice` sur la fiche de l'annonce VENDUE (identité) + miroir par N°, en
  geste annulable 5 s (`gesteVrm`).
- **Filet du cron** (ajouté ensuite, à la demande de l'agent principal) : `demandesDuCron`
  (`api/_lib/prix-achat-demande.js`), appelé par `api/ship-reminders.js` matin et soir à côté de
  `notifierComptesRelies`. Lectures projetées et paginées (fiches et prix par N° de `main`, méta des
  transactions, ventes) ; mêmes règles (`ventesSansPrix`, puis `notifierPrixAchat` : transaction
  relue, mémoire « une fois », jamais la nuit — la nuit, le cron ne lit même rien). Lecture ratée ⇒
  rien demandé. Le lot `notifs-groupees` peut encore regrouper l'envoi.

## 2. « Vendu ailleurs »
- Réutilise la vente en main propre qui EXISTAIT : `vrm_cycle_decisions[idAnnonce] =
  { choix:'vendu-main', numero, at, montant }` (Ma journée, « Vendu en main propre ») — son montant
  n'entrait dans aucun total. Ajout : `date` (AAAA-MM-JJ) et `ailleurs: true`.
- **Une règle** : `ventesFaites`, `ventesDeclarables`, `ventesAutresBenefice` reçoivent `main`
  (liste de `ventesMainPropre`, `src/venteAilleurs.js`), plateforme « Ailleurs », identité
  `main:<annonce>`, datée de la date SAISIE (main propre : payé le jour même = date
  d'encaissement, dit sous le champ). `ventesAilleursDe(vinted)` (App.jsx) retire toute décision
  dont l'annonce a une vente Vinted comptée (transaction → annonce lue) : jamais deux fois.
  Miroir serveur refabriqué (`audit-bilan-semaine --recopie`). La sélection elle-même
  (`ventesAilleursPour`, src/venteAilleurs.js) est importée telle quelle par l'app ET le serveur.
- **Bilans serveur** (semaine, mois : `calculerBilan`, api/_lib/bilan-semaine.js) : `main` passé à
  `ventesFaites` et `ventesDeclarables` ; `lireDonneesBilan` (api/ship-reminders.js) lit
  `vrm_cycle_decisions` (projection de `main`) et `it:meta->>item_id` des transactions (table
  transaction → annonce). Table illisible ⇒ décisions non lues (aucun double compte possible).
- ⚠️ Les anciennes réponses « Vendu en main propre » avec montant entrent désormais dans le CA (au
  jour de la réponse) : c'était une vente qu'il avait dite.
- **Fiche** (`blocVenduAilleurs`) : seulement vente SUE et pas vendue, et UNE annonce pour ce N°.
  « Vendu ailleurs » ⇒ prix + date (aujourd'hui) ⇒ « Valider » : décision, `vinted_annonces_vendues`
  (sort du stock et des annonces), case du Stock libérée, N° gardé ; « Annuler » 5 s rend l'exact.
- Fusion avec `importees` (ventes importées, autre lot) : les deux sources cohabitent.

## 3. Recherche à la voix
Existait déjà (3 nov. et « parler à la loupe ») : micro de la reconnaissance du navigateur, fr-FR,
« numéro 124 », « N 124 », « Nike taille 42 », fiche unique ouverte. Ajout : `ventesDuMois`
(`src/rechercheVocale.js`) — « vendues en octobre », « mes ventes de septembre 2025 » ⇒ Ventes ·
Vinted sur ce mois (`DEMANDE_PERIODE_VENTES`) ; tapé dans ⌘K, une action « Ventes d'octobre 2026 »
en tête. La règle de recherche universelle ne change pas. Sans reconnaissance : aucun micro.

## Preuves
- `node scripts/audit-saisie-rapide.cjs` : 49 contrôles (dont K1–K6 cron, B1–B4 bilans) (règle, route EXÉCUTÉE sur une base servie,
  totaux, voix, branchement) ; `--prouve` : 14 mutations toutes rouges (dont bilan sans `main`, cron sans preuve, cron la nuit) ; sur `origin/main` : rouge
  (modules absents). Audits verts : variables, tdz, coherence, identite, icones, fonctions-api,
  recherche-vocale (mise à la règle : le mois passe d'abord), registres, bilan-semaine,
  cycle-article, geste-annulable. Build OK.
- `node scripts/bancs/saisie-rapide.cjs` : 390 tactile et 1512, clair et sombre — vert ; captures
  regardées (carte Ma journée, feuille, fiche « Vendu ailleurs · 45 € le 11/11 » + Annuler,
  Ventes sur « Octobre 2026 »).
