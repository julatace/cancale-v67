# 28 nov. 2026 — Les automatismes eBay (lot `ebay-automatismes`, branche `claude/ebay-automatismes`)

Julien : « copie tous les concurrents, fais pareil pour eBay ». Ce lot reprend le comparatif des concurrents (§4 :
Sixbit, inkFrog, Vendoo, 3Dsellers, Seller Hub) et fait, **par l'API officielle d'eBay** (jamais l'extension), ce
qu'ils font seuls. **Aucune modification de l'extension.** Aucune 13e fonction `api/` (12/12 tenu).

## 1. Ce qui est livré

| # | quoi | où | état |
|---|---|---|---|
| E1 | **Baisse par règle** : −5/−10/−15 % après 7/14/30 j sans vente | moteur `baisse` de `passageCompte` | fait |
| E2 | **Offre aux observateurs automatique** : −5/10/15/20 % après 24/48/72 h d'observateurs, une fois par annonce et par période (7/14/30 j) | moteur `offres` | fait |
| E3 | **Contre-offre par paliers** : la règle `palierSuivant` de `src/negociationPaliers.js` telle quelle (pas de copie), rythmes doux 30/60/100, standard 50/80/100, direct 100 | moteur `paliers`, `contreOffrePalier` | fait |
| E4 | **Remise en vente des invendus** (3/5/10 par jour, « sans frais seulement » par défaut) + **Vendre un similaire** (brouillon prérempli sans N°) | moteur `relance` ; action `similaire` | fait |
| E5 | **Prix eBay ajusté** (+0/5/8/10/12/15 %, par compte) : proposé dans le formulaire de publication (`src/ecrans/Ebay.jsx`, la base dite dessous), et le plancher des trois moteurs remonte d'autant | `vrm_ebay_majoration` (synchronisé) | fait |
| E6 | **Modification en masse** : cocher jusqu'à 25 annonces ⇒ −5/10/15/20 %, un nouveau prix, ou terminer ; récapitulatif (lignes sous le plancher refusées, en ambre), puis SON « Appliquer » | action `masse` (passe par `handleRevise` et la fin d'annonce de son clic) | fait |

La page : **Paramètres → eBay automatismes** (une PagePoussée, `vrm:ebay-automatismes`), et le lien profond
`?tab=plat_ebay&section=auto` (Annonces · eBay › Automatismes). Par compte eBay (le sélecteur `EbayActionCompte`).
Elle montre : le plancher (fraîcheur, « touche pour le renvoyer »), les quatre moteurs (interrupteur + paliers),
le prix eBay ajusté, ses annonces en ligne (N°, plancher, observateurs ; case à cocher ; balayer ⇒ « Similaire »),
« Fait en ton nom » (le journal), « Lancer maintenant ».

## 2. Comment ça tourne

- **Le serveur seul** : `api/ship-reminders.js?moment=ebayauto`, appelé **chaque heure par GitHub**
  (`.github/workflows/ebay-automatismes.yml`, minute 23, le même `CRON_SECRET` que les autres) — le plan Vercel gratuit
  ne lance qu'un cron par jour. Seules les lignes `ebay_tokens_automatismes` dont `data->>actif` est vrai sont visitées
  (un moteur allumé). Abonnement coupé ⇒ rien. 100 s par passage, 45 s par compte.
- **L'état** : `ebay_tokens_automatismes` (une ligne par vendeur, un bloc par compte eBay : réglages, baisses, offres,
  observateurs vus, négociations, remises en vente, sautés, dernier passage, journal de 300 lignes). Préfixe
  `ebay_tokens` : la garde de la base (migration 014) interdit au navigateur de l'écrire ; l'app le lit par la route.
- **Le plancher** : PUBLIÉ par l'app (`vrm_planchers_ebay`, synchronisé dans `main`) quand un automatisme est allumé
  (`vrm_ebay_auto_actif`), au chargement puis toutes les 6 h (republié s'il change, ou après 12 h) :
  `{ parNum: { [cleNum]: [miniC, achatC] }, presents: [N° en vente quelque part], presentsAt }`. Deux fiches au même N° ⇒
  le plancher le PLUS HAUT. Le serveur ne le recalcule jamais ; publié il y a plus de 72 h ⇒ rien ne bouge.
  `presents` vient de `vinted_nums_physiques.enVente` (nouveau champ, `Comptabilite.jsx`) : les N° d'une annonce présente
  ou en vente sur eBay/Leboncoin, SANS les ventes à poster ni les retours — la preuve « chez lui et pas vendue ».
- **L'identité** : le SKU `VRM-{n°}` lu chez eBay, traduit par la numérotation 013 (`numeroExterne`). Sans SKU : rien.

## 3. Les garde-fous (tous tenus par `scripts/audit-ebay-automatismes.cjs`)

- Éteint par défaut ; allumer exige `confirme:true` (route) et SA confirmation (page). Valeur hors des choix ⇒ défaut.
- **Marqué avant, écrit après** : « en cours » noté AVANT l'appel (note ratée ⇒ rien ne part), puis fait / incertain /
  refusé. « En cours » ou « incertain » bloque toute reprise automatique.
- Prix vu : liste GetMyeBaySelling → GetItem RELU (prix différent ⇒ rien) → écriture → GetItem relu (« fait » seulement
  si eBay tient le prix ; sinon « incertain »).
- Plancher : `baisseDue` (src/reglesAuto.js) + `gardePrixRegle` (mode auto) + contrôle explicite ; offre / contre-offre
  sous le plancher ⇒ rien. Une annonce avec une règle d'offre (`ebay_offres`) n'est jamais baissée (le seuil
  d'acceptation pourrait passer au-dessus du nouveau prix).
- E2 : une par annonce et par période ; jamais pendant une offre de SON clic (journal `ebay_offres_envoyees`, partagé
  avec l'action `offre` : son bouton voit aussi les offres automatiques).
- E3 : `RespondToBestOffer` avec Action **Counter** écrite en dur, dans UNE fonction (`contreOffrePalier`) ; un
  « accepter » de la règle (« rester flexible ») n'est JAMAIS exécuté. `audit-offres-auto.cjs` §5 l'admet sous ces
  conditions (mutation `Counter → Accept` ⇒ rouge, vérifiée).
- E4 : paire prouvée chez lui (`presents`, < 48 h), pas déjà en ligne sur ce compte, `jugerRelance` (la règle de son
  clic), VerifyRelist d'abord (frais > 0 ⇒ rien par défaut), corps = l'identifiant seul ; la nouvelle annonce relue
  doit porter le même SKU. `audit-ebay-route.cjs` [INA] l'admet dans ce bloc seulement.
- §2.8 : aucun champ de livraison dans aucun corps (vérifié sur les 70 corps du banc).
- Plafonds : 12 gestes par compte et par passage (baisse 6, offres 6, paliers 8), remises en vente `parJour` / 24 h ;
  un « sauté » n'est redit qu'une fois par jour (40 par passage au plus, une seule écriture).

## 4. Preuves

- `node scripts/audit-ebay-automatismes.cjs` : 49 ✅ (vraie route `api/ebay.js` + vrai passage + vraies lectures/écritures
  d'`api/_lib/ebay.js`, faux eBay Trading/Negotiation, fausse base comparer-et-échanger). Mutations `--mutation=` :
  `plancher` (3 rouges : baisse à 76 € et 54 €), `prix`, `periode`, `presence` (3), `confirmation`, `sku` — toutes rouges.
- `audit-offres-auto` (26), `audit-ebay-route` (548), `audit-ebay-offre-prix`, `audit-ebay-relance`, `audit-fonctions-api`,
  `audit-coherence`, `audit-traduction` (5 langues, 167 clés `eauto.*` + `nav.sous.ebay.auto`), `audit-tdz`,
  `audit-variables`, `audit-identite`, `audit-quoi-de-neuf` : verts.
- Banc `scripts/bancs/ebay-automatismes.cjs` (BANC_PORT 4883) : 390 tactile et 1512, clair et sombre — moteurs éteints,
  Annuler ⇒ rien, Allumer ⇒ `confirme:true`, palier sans redemande, récapitulatif de masse (ligne sous plancher refusée),
  « Appliquer » n'envoie que la ligne permise au prix vu ; captures regardées.

## 5. Ce qui n'est PAS mesuré / ce qui reste

- **Aucun appel réel à eBay** : formes de la documentation (Trading 1149, Negotiation v1) et des modules déjà en place.
  Les droits OAuth suffisent (`sell.inventory` pour la Negotiation API, Trading par le jeton du vendeur) : **aucun
  nouveau scope, aucune reconnexion** à demander.
- La remise en vente automatique ne voit une paire « chez lui » que si elle est EN VENTE ailleurs (Vinted, Leboncoin,
  une autre annonce eBay) : une paire vendue UNIQUEMENT sur eBay, terminée, se remet en vente à la main (« Remettre en
  vente », son clic) — mieux vaut un blanc qu'une double vente.
- « Vendre un similaire » copie les photos de l'annonce d'origine : à changer si la paire n'est pas la même (la page le
  dit dans le message du brouillon). La pointure est retirée des caractéristiques (eBay la redemandera à « Vérifier »).
- Le prix ajusté (+x %) n'est appliqué qu'au formulaire de publication eBay (et aux planchers) ; « Prix partout » et
  « Publier sur… » ne le proposent pas encore.

## 6. Geste de Julien

Aucun obligatoire. Pour s'en servir : Paramètres → **eBay automatismes**, allumer ce qu'il veut (chacun demande une
confirmation). Le secret `CRON_SECRET` est déjà dans GitHub (mêmes workflows que les alertes eBay).
