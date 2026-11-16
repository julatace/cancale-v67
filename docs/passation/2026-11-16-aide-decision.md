# 16 nov. — Aide à la décision (lot `aide-decision`, mission 11 de la file)

Validé par Julien : quatre outils calculés sur SES données, aucun chiffre deviné (« pas su » = « — »),
couverture dite. Branche `claude/aide-decision`. Extension **5.402.0** (numéro donné par le coordinateur ;
5.394–5.401 réservées par d'autres lots).

## Ce qui change pour Julien

1. **Contre-offre automatique au prix mini** — Messages → Favoris & offres → Offres auto. Sous
   l'interrupteur « Offres auto », une seconde option « Contre-offre au prix mini », **éteinte par
   défaut**, visible seulement moteur allumé ; l'allumer demande une confirmation qui dit qu'une
   contre-offre prise VEND la paire. Une offre entre « Refuser sous » et « Accepter dès » (ou sous le
   mini sans seuil de refus) reçoit UNE contre-offre au prix `contreOffreMini` (la règle de « Proposer
   X € » de la messagerie : le mini arrondi à l'euro au-dessus, jamais sous le mini, jamais au-dessus du
   prix de l'annonce), 3 à 20 min après (30–120 la nuit), comme l'acceptation.
2. **Ce qui reste, par modèle** — Statistiques → « Ce qui rapporte le plus » : chaque ligne dit
   « reste X € par vente » (vente − prix d'achat − frais notés, emballage compris s'il est saisi :
   la notion « Après frais de vente » de `src/beneficeNoms.js`), la couverture « sur N/M » quand des
   ventes n'ont pas leur prix d'achat ou leurs frais (eBay pas lus), et les jours MOYENS en ligne.
   Le modèle reste une STATISTIQUE (catalogue fermé de `modeleSur`), jamais une identité.
3. **Délai d'envoi par compte** — la carte « Vitesse d'envoi » (lot BM) existait (médiane, 30 j) :
   elle dit maintenant aussi la MOYENNE par compte, et une alerte douce (ambre) quand un compte
   ralentit nettement : moyenne des 30 derniers jours ≥ 1,5 × celle des 30 jours d'avant ET au moins
   24 h de plus, avec au moins 5 colis à dépôt PROUVÉ de chaque côté (`ralentissements`,
   `src/vitesseEnvoi.js`).
4. **L'argent qui dort, par meuble** — nouvelle carte de Statistiques (pas un onglet) : par meuble
   du Stock, articles présents, total de LEURS prix d'achat saisis (« N sans prix » nommé, jamais 0),
   âge moyen en ligne, trié du plus gros montant ; toucher un meuble ⇒ ses articles (N°, âge, prix).
   « Pas encore rangés » pour les présents sans case.

## Comment c'est fait (une règle par notion)

- **Contre-offre** : `autoAccepterOffresUnPassage` (background.js) — `quoi = 'contre'` seulement si
  `reg.contre` (lu `vinted_offres_contre === true` ET moteur allumé). La garde des autres sites
  s'applique comme pour l'acceptation. La recette Vinted était DÉJÀ connue (pas d'apprentissage) :
  `POST /api/v2/transactions/{tx}/offers {offer:{currency, price}}` — relevée sur ses vraies requêtes
  (« Proposer X € » de la messagerie, `EXEC_PERMIS`) et sur Vintex (favoris, 29 oct.). Envoi par
  `contreOffreAuto` : depuis l'onglet vinted.fr (`vintedPage`), sous `garde` (compte de l'onglet,
  plafond 45/h, pause 429/403), refus « restreint » ⇒ frein 24 h ; journal `contre_offre` (prix
  envoyé `p`, offre `de`). Le prix affiché de l'annonce vient de la lecture du dressing
  (`harvest_{uid}_listings`, par identifiant) : plus de 24 h, absente, fermée/masquée, autre devise ⇒
  rien ne part, l'offre est notée examinée (une fois, pas une relecture par minute) et c'est dit.
  Mesuré en lecture seule le 16 nov. : `transaction.offer_price` des conversations n'est PAS le prix
  de l'annonce (639 différents sur 766 comparables) — il n'est donc pas utilisé.
  L'aperçu de l'écran (`decisionMoteur`, `src/offresSures.js`) dit la même chose (décision
  `contrer`, ou « À toi · prix de l'annonce pas lu »).
- **Reste par modèle** : `classementRapporte` (src/ceQuiRapporte.js) gagne `nNet`, `apresFrais`,
  `resteMoyen`, `joursMoyen` ; le brut d'avant ne bouge pas.
- **Argent qui dort** : l'écran Annonces publie `vrm_argent_dort` (localStorage, estampillé du
  compte VRM) depuis `annoncesPresentes` (la base de « Valeur du stock »), prix par
  `beneficePaire(…fusionEntreeVente…)`, âge par `listedAgeDays` ; `argentDortParMeuble`
  (src/argentDort.js) croise avec `vrm_meubles` / `vrm_slots` par `cleNum`.

## Preuves

- `scripts/audit-aide-decision.cjs` : 55 verts (moteur EXÉCUTÉ dans un vm : 1 contre-offre au mini
  40,00, rien au 1er passage, une fois, plafond horaire, autre compte, pause, garde, dressing périmé,
  annonce absente, autre devise, mini au-dessus du prix, refus et acceptation inchangés ; aperçu =
  moteur sur 8 cas ; copie de la règle identique ; reste, ralentissement, argent qui dort ;
  branchement). `--prouve` : 27/27 mutations rouges. Sur l'arbre d'origin/main : 26 rouges.
- Audits touchés verts : moteur-offres, offres-sures (son chargeur copie aussi `messagesVolets.js`),
  contre-offre-mini, ce-qui-rapporte, dossier-vitesse-avis, traduction, coherence,
  confiance-publique, offres-auto, securite-comptes, quoi-de-neuf, extension-zip.

## ÉTAT À LA REPRISE

- Fait et poussé : tout ce qui précède, extension 5.402.0 (zips régénérés), CLAUDE.md §8 et §9.
- Reste : voir le rapport de PR (captures, passe complète, CI).

## Geste de Julien

Installer l'extension 5.402.0 ; puis, s'il le veut, allumer « Contre-offre au prix mini ».
