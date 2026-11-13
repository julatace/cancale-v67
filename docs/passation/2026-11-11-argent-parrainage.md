# 11 novembre 2026 — Prévision du mois, coût par site, parrainage (second agent)

Branche `claude/agent2-argent-parrainage` (partie de `origin/main` @ 7b54b0dc5). Pas de PR, pas de fusion.
Validé par Julien (3 points). Avant de coder : `claude/stats-plus` (records, comparer deux comptes) et
`claude/rapport-mois` (PDF du mois) sont DÉJÀ dans `main` et ne font ni prévision ni coût par site par mois ;
le parrainage existait depuis le 8 nov. (`api/_lib/parrainage.js`, migration 027, CGV article 2 bis) — il est
COMPLÉTÉ, pas refait.

## 1. La prévision du mois
- Règle pure `src/previsionMois.js` : vendu PROUVÉ du mois (`liveStats.venduLignes`, la règle de « Vendu »)
  ÷ temps écoulé depuis le 1er, prolongé à la fin du mois. Fourchette = dispersion RÉELLE des jours pleins
  (incertitude des jours restants + du rythme, ±1,28 écart type) : large quand les jours sont irréguliers ou peu
  nombreux, serrée sinon ; le bas jamais sous le déjà-vendu ; arrondi lisible (5/10/50/100 €).
- Moins de 5 jours pleins ⇒ « Pas encore su » (aucun chiffre, aucune ligne dans Ma journée). Pas lu ⇒ « — ».
  Un site / compte pas lu, une vente au montant pas lu ⇒ « sans … » NOMMÉ.
- Bénéfice : on prévoit le **Bénéfice brut** (vente − prix d'achat, `src/beneficeNoms.js`) seulement si ≥ 5
  ventes finalisées du mois ET ≥ 80 % au prix d'achat connu (relevé `vrm_stats_ventes`) ; sinon « — · prix
  d'achat connus sur N/M ventes · Saisir › ». ⚠️ La consigne disait « au moins … sur N » : la règle du dépôt
  (jamais « au moins » devant un bénéfice) l'emporte, la couverture est dite — comme rapport-mois.
- Écrans (`src/ArgentPlus.jsx`, `src/argent-plus.css`) : Argent → Statistiques, carte « Fin de novembre, à ce
  rythme » sous l'objectif (grand « vers 700 € », « entre … et … · sur 19 jours lus », barre fait / fourchette /
  centre sans chiffre, « Une estimation au rythme réel, pas une promesse. ») ; Ma journée, UNE ligne sous la
  tête « À ce rythme, novembre finira vers 700 € › » (vers Statistiques), seulement quand c'est su. Aucun
  `data-benef-notion` sur une prévision (le banc benefice-unique compare les chiffres réels).

## 2. Ce que te coûte chaque site, mois par mois
- Règle pure `src/coutPlateformes.js` : par mois (4 derniers) et par site, le total = `fraisParPlateforme`
  (la carte « Frais par site », même règle : commission eBay LUE, frais notés sur les fiches, packs/options
  notés dans Dépenses) + les échéances des abonnements rattachés (`chargeAbonnement` de Comptabilité, injectée).
- Détail par catégorie (frais de vente · boosts et options · étiquettes · abonnements · autres), chacun avec
  sa source : « lu chez le site », « noté sur tes fiches », « noté dans Dépenses ». Le détail d'une fiche Vinted
  ([boost `fees`, port payé `transportVendeur`, `commission`, reste]) est rangé en **[11] du relevé**
  (`releveVentes` a un paramètre `fraisDetail` ; [10] vaut `null` quand il n'y a pas de lot) ; un relevé
  d'avant ou une fiche Leboncoin sans détail ⇒ « Autres frais notés », jamais réparti au hasard ; la somme
  du détail est vérifiée égale au total.
- eBay : étiquette « payé par l'acheteur » (§2.8), jamais une charge ; frais pas lus ⇒ « frais eBay lus sur
  1/2 ». Vestiaire : « commission Vestiaire pas lue ». Site pas lu ⇒ « — ».
- Un abonnement est rattaché à un site seulement si SON NOM commence par le site (« Vinted Pro »,
  « Leboncoin pack photo ») ; « Canva », « Mon Vinted coach » ne le sont pas.
- Écran : « Frais par site » garde sa carte (période), un sélecteur « Sur la période · Mois par mois » montre
  l'une OU l'autre (le même nombre jamais deux fois, §7). Mois par mois = tableau site × mois, chaque montant
  se touche (44 px) ⇒ son détail ; « * » = incomplet.

## 3. Parrainage (complété)
- Lien court **`https://vrm.center/r/CODE`** : `vercel.json` → redirection 302 vers `/?parrain=CODE` ; l'app
  relit aussi `/r/CODE` sans redirection (`codeParrainDuChemin`). L'ancienne forme reste lue.
- Réglages → Abonnement → Parrainage : « N personnes venues par toi · M abonnées » (des nombres, jamais qui) ;
  « Mode test : aucun vrai paiement pour l'instant. » tant que Stripe est en clé de test ou pas branché
  (`modeTest` rendu par la route).
- Anti-abus ajouté : **même carte** — au premier paiement réel, l'empreinte `card.fingerprint` (Stripe) de la
  carte du filleul est comparée à celles du parrain ; en commun ⇒ aucun mois offert à personne, `refus =
  'meme-carte'` (migration **037**, une colonne) ; parrain abonné plus tard avec la même carte ⇒ son mois en
  attente n'est pas crédité ; Stripe muet ⇒ 503 (Stripe rejoue), rien crédité. Sans la 037, la règle tient
  (rien crédité), la comparaison est refaite à chaque facture. Le reste existait : un code par compte, pas
  soi-même (compte, compte Vinted), compte neuf < 30 j, un mois par filleul, 12/an au parrain, crédit de
  16,99 € au 1er paiement réel (webhook `invoice.paid`), idempotent.
- CGV (article 2 bis, qui liste déjà le parrainage) : « (même compte VRM, même compte Vinted ou même carte de
  paiement) » ajouté. **Geste de Julien : relire.**

## Preuves
- `scripts/audit-argent-parrainage.cjs` : 34 contrôles verts, **19/19 mutations** (`--prouve`) ; ROUGE sur
  `origin/main` (modules absents).
- `scripts/audit-abonnement-propre.cjs` : 68 verts (simulateur Stripe : `payment_methods` + empreintes) ;
  ROUGE sur `origin/main` (lien court, même carte).
- Banc `scripts/bancs/argent-parrainage.cjs` (base inventée de marge-plateforme, 20 nov. 15 h, 390 tactile /
  1512, clair et sombre) : prévision « vers 700 € », 19 jours, 5/8 ⇒ pas de bénéfice prévu, 8/8 ⇒ prévu ;
  mois par mois Vinted 5,50 € (boost 3 € + étiquette 2,50 €) ; ligne de Ma journée au même centre.
- `scripts/bancs/abonnement-propre.cjs` : attend le lien `/r/`.

## Gestes de Julien
1. Supabase → SQL : passer `supabase/migrations/037-parrainage-meme-carte.sql` (après la 027 ; une colonne).
2. Stripe (déjà listés le 8 nov.) : webhook avec `invoice.paid` ; `STRIPE_SECRET_KEY` (test d'abord : tout
   marche en test et l'écran le dit) ; ouvrir le parrainage : `update vrm_reglages set valeur='1' where cle='parrainage';`.
3. Relire la phrase ajoutée aux CGV (article 2 bis).
4. Rien à faire pour la prévision et le coût par site (ouvrir Ventes une fois remplit le détail des frais).
