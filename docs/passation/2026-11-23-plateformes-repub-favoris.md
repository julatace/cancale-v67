# 23 nov. 2026 — Republication et favoris sur Leboncoin, Vestiaire Collective et eBay

Branche `claude/plateformes-repub-favoris`. Demande de Julien : « fais pareil pour Leboncoin, Vestiaire Collective et
eBay pour la republication et les messages aux favoris ; tout doit être parfait ».

Sources lues : CLAUDE.md §2.8, §2.9, §3 (Republication, Messages aux favoris — « Leboncoin : il ne dit pas QUI a mis
en favori, VRM n'écrit à personne », Supprimer automatiquement refusé, plafonds), §8 ; `historique-leboncoin.md`,
`historique-vestiaire.md`, `historique-ebay.md`, `historique-favoris-messages.md` ; le plan Vinted
`2026-11-23-republication-plan.md` (branche `claude/republication-intelligente`) ; le code de `main` (c50fdb6cc,
extension servie 5.439.0) ; la base (lecture seule, projections scalaires, aucune valeur recopiée) ; la doc publique
des plateformes (liens en fin de fichier). **Rien n'est inventé : ce qui n'est pas mesuré est écrit « non mesuré ».**

---

## 0. Le tableau

| plateforme | republication | favoris (« messages aux favoris ») |
|---|---|---|
| **Vinted** (rappel) | possible, livrée (atelier, extension) ; plan « intelligent » en attente de la 5.441 | possible, livrée (Vinted nomme les favoris, offre native) |
| **Leboncoin** | **possible autrement** : il n'existe pas de « remonter » gratuit ; supprimer puis republier la MÊME fiche, sur SON clic, confirmé (§3). Code présent (`lbcSupprime` + `lbcPublier`), mais **inatteignable depuis le 20 nov.** (voir 1.1) | **impossible** (Leboncoin ne dit pas QUI a mis en favori, ni n'offre d'envoi aux favoris) ; à la place : **rien de natif vérifié**. Une baisse de prix qui préviendrait les favoris n'est **pas documentée** par Leboncoin (recherche faite, rien d'officiel) ⇒ VRM ne la promet pas |
| **Vestiaire** | **possible autrement, déconseillé en série** : pas de « remonter » ; une annonce neuve repasse par la **revue de Vestiaire** (curation, délai non publié) ; supprimer une annonce en ligne pour la re-déposer la fait disparaître le temps de la revue, et la revue peut la refuser. VRM ne le fait pas en série ; à la main, une paire à la fois, plus tard (plan 2.3) | **possible, deux façons natives** : (a) **baisser le prix** — Vestiaire écrit que « toute personne qui suit l'article reçoit une notification » (FAQ officielle) ; (b) **faire une offre aux personnes qui ont aimé** — Vestiaire les NOMME dans le fil des notifications (mesuré le 15 nov.) ; moteur présent (`offrirAuxAimesVc`, 5.392), **appris sur SON geste seulement**, inatteignable depuis le 20 nov. (voir 2.1) |
| **eBay** | **possible, natif, par l'API officielle** : « Remettre en vente » une inactive (`RelistFixedPriceItem`, l'identifiant seul) — **livré le 3 nov.**, une par une | **possible, natif, par l'API officielle** : « Offre aux observateurs » (`find_eligible_items` + `send_offer_to_interested_buyers`) — **livré le 5 oct.**, une par une. **Trous trouvés** : le prix vu n'était pas revérifié (l'offre partait sur le prix d'eBay, peut-être changé) ; rien n'empêchait une 2e offre sur la même annonce pendant les 48 h de la 1re ; pas de série. ⇒ **Phase 2, livrée sur cette branche** (section 3) |

---

## 1. Leboncoin

### 1.1 Republication — ce que le code sait déjà faire
- **Mesuré le 29 oct.** (`historique-leboncoin.md`) : Leboncoin n'a pas de « remonter » gratuit (la remontée est une
  option payante). Une annonce neuve se fait en **supprimant** l'ancienne puis en **recréant** la même fiche. Les
  règles de diffusion interdisent la même annonce deux fois (doublon) et demandent de supprimer l'annonce en ligne
  avant d'en déposer une nouvelle pour le même bien (source secondaire citant les règles ; texte officiel non retrouvé
  en ligne ⇒ l'ordre « supprimer d'abord » est le seul admissible). Une option payante attachée à l'annonce est perdue
  à la suppression.
- Code : `supprimeLbcDepuisApp` / `supprimerLbcCarte` (background.js, `lbcSupprime`, capacité `lbcsupprime` 5.291) et
  `publierDepuisApp` (`lbcPublier`, capacité `publication` / `lbcfiche`) ; l'ancien atelier « Republier sur
  Leboncoin » (29 oct.) faisait : sa confirmation pour le lot → supprimer → recréer la fiche corrigée → relire (la
  nouvelle porte sa référence VRM, l'identité §5).
- **Le 20 nov. (décision de Julien « toute action dans l'extension »)**, l'app n'envoie plus `lbcSupprime` ni
  `lbcPublier` (`CMDS_PLATEFORME`, `refusPanneau`) ; le bouton « Republier sur Leboncoin » ouvre
  `https://www.leboncoin.fr/?vrm=panneau&page=republier&action=republier&ids=…`.
- ⚠️ **Constat** : `lireLienPanneau` (vrm-badge.js) accepte l'hôte `leboncoin.fr`, mais **`vrm-badge.js` n'est
  injecté que sur Vinted** (manifeste 5.439 : sur `*.leboncoin.fr` seuls `lbc-inject.js`, `lbc-relay.js`,
  `lbc-ecrire.js`, `vrm-depot-aussi.js`, `vrm-ui.js`, `vrm-mots.js`, `lbc.js`). Le lien s'ouvre, **aucun panneau ne
  vient** ; « Supprimer de Leboncoin » existe dans le panneau ouvert **sur vinted.fr** (vue des annonces des autres
  sites, `supprimerLbcCarte`), la recréation non. **Aujourd'hui la republication Leboncoin ne se fait nulle part.**
- Base (23 nov.) : `lbc_listings` 194 annonces (192 `active`, 1 `inactive`, 1 `deleted`), **aucune** marquée
  `supprimeePar: 'vrm'` ⇒ aucune republication Leboncoin par VRM n'a jamais abouti en production.

### 1.2 Favoris — ce qui est possible
- Leboncoin ne donne **que des nombres** (`TotalFavorites` relevé par `noterStatsAnnonceLbc`, capacité `lbcstats`
  5.291) et **jamais qui** ⇒ §3 : VRM n'écrit à personne. **Impossible**, et rien à construire.
- « Une baisse de prix notifie les favoris ? » : **non vérifié**. Aucune page officielle de Leboncoin ne le dit (les
  alertes de Leboncoin portent sur les recherches enregistrées, pas sur les annonces sauvegardées). VRM ne doit pas
  l'écrire. La baisse de prix Leboncoin existe déjà (`lbcPrix`, panneau « Changer le prix ») — elle reste une baisse
  de prix, sans promesse sur les favoris.
- Base : **0** annonce sur 194 porte un relevé `stats` ⇒ le nombre de favoris Leboncoin n'a jamais été relevé en
  production (la capture n'a pas tourné sur ses pages « Mes annonces » depuis la 5.291, ou la forme a changé — non
  mesuré). L'écran ne doit afficher « — » (pas su), jamais « 0 favori ».

### 1.3 Plan Leboncoin (exige l'extension — EN ATTENTE de la relance, rien de réservé)
1. Injecter le panneau sur leboncoin.fr (ajouter `vrm-badge.js` au bloc `*.leboncoin.fr` du manifeste, OU porter
   `lireLienPanneau` dans `lbc.js`) — à décider avec le chantier du panneau (`claude/panneau-vintex`), qui possède ce
   contrat d'URL.
2. Page « Republier » du panneau pour `site === 'leboncoin'` : liste cochée (ids de l'app), **une confirmation pour le
   lot** qui dit « supprimée puis remise, une à la fois ; une option payante est perdue », puis par annonce :
   gardes (compte de l'onglet = compte de l'annonce, `garde` ; 45/h, réserve 5 ; pause 429/403 ; une à la fois) →
   **la fiche relue AVANT de supprimer** (titre, prix, photos, description ; manque ⇒ rien supprimé) → supprimer
   (`supprimeLbcDepuisApp`, son contrat) → pause 15–40 s → recréer (`publierDepuisApp` `lbcPublier`, fiche relue) →
   relire « Mes annonces » : la nouvelle porte la référence VRM ⇒ N° gardé (`src/repriseNumero.js`). Suppression
   faite + recréation refusée ⇒ « à remettre » (jamais renvoyée seule), la fiche reste dans le coffre.
3. Bancs : `audit-lbc-republier.cjs` (vrai background.js sur `_fond-vm.cjs`) — rien supprimé sans fiche relue ;
   ordre supprimer → recréer (jamais l'inverse : doublon interdit) ; une recréation refusée ne supprime rien d'autre ;
   plafond 45/h ; mutations (recréer avant de supprimer ; supprimer sans fiche ; boucle sans pause) ⇒ rouge.
   Banc de rendu du panneau sur une fausse page leboncoin.fr, 390 et 1512.

---

## 2. Vestiaire Collective

### 2.1 Favoris — ce que le code sait déjà faire
- **Mesuré le 15 nov.** (lot favoris-sites) : Vestiaire **nomme** chaque personne qui aime un article (une carte du
  fil des notifications par « j'aime ») et le vendeur peut lui faire la **première offre**. L'extension 5.392
  (`noteAimes` dans vc-inject.js, `vcAimes` dans vc.js) garde ces personnes **dans CE navigateur** et n'envoie à la
  base que des NOMBRES (`vc_aimes`) ; `offrirAuxAimesVc` envoie l'offre, 10 personnes au plus par toucher, **seulement
  après une recette APPRISE de son propre geste** (`vc_offres_recette.favori`, `rejouable: true`), prix lu = prix de
  l'aperçu, `gardePrixEcriture`, `porteDiscretion`, une à la fois, pause Vestiaire. Module de l'app :
  `src/aimesVestiaire.js` (`lignesAimes`, `montantOffre`, `REMISES` 5/10/15).
- Base (23 nov.) : **aucune ligne `vc_aimes`** ⇒ aucune personne vue ; `vc_listings` 3 articles (capture du 2 nov.) ;
  la recette reste dans `chrome.storage` (jamais en base) ⇒ non mesurable d'ici.
- ⚠️ Même constat que Leboncoin : depuis le 20 nov. `vcOffreAimes` est refusé par le pont de l'app, et
  **`vrm-badge.js` n'est pas injecté sur vestiairecollective.com** ⇒ le panneau ne s'ouvre pas là ; le texte
  `f_vc_aimes` (« … dans le panneau ouvert sur l'onglet vestiairecollective.com ») promet une page qui n'existe pas.
- **Baisser le prix** : Vestiaire écrit officiellement (FAQ « Flash Price Drop » / prix) qu'après une baisse « toute
  personne qui suit l'article reçoit une notification ». C'est la voie native qui touche les favoris **sans nommer
  personne**. La baisse de prix Vestiaire existe (`vcPrix`, panneau « Baisser »). Vestiaire ne permet sur une annonce
  en ligne que de **baisser** le prix ou ajouter des photos (FAQ). Le « Flash Price Drop » (prix d'une offre refusée
  ouvert à tous 48 h) est une proposition de Vestiaire au vendeur, pas un geste que VRM déclenche.

### 2.2 Republication — possible ?
- Pas de « remonter » chez Vestiaire. Toute annonce neuve passe la **revue** de Vestiaire (place de marché
  « curée » : chaque annonce est revue avant d'être en ligne ; délai **non publié**). Supprimer pour re-déposer =
  l'annonce disparaît pendant la revue, peut être refusée, et ses « j'aime » (les personnes) sont perdus. Aucune
  règle publique trouvée sur les doublons.
- Code : le dépôt existe (`publierVestiaire`, capacité `vcpublier` 5.235 ; `vc-depot.js`), la suppression d'une
  annonce Vestiaire **n'existe pas** (jamais apprise).
- ⇒ **Déconseillé, pas en série.** Si Julien le veut quand même : une paire à la fois, à la main (sa suppression sur
  vestiairecollective.com), VRM prépare la fiche (« Préparer sur Vestiaire ») et garde le N° par identité.

### 2.3 Plan Vestiaire (exige l'extension — EN ATTENTE de la relance, rien de réservé)
1. Le panneau sur vestiairecollective.com (même pièce que 1.3-1).
2. Page « Favoris » du panneau, site Vestiaire : par article, « N personnes ont aimé · M déjà prévenues », offre
   (5/10/15 % ou montant, sous le prix lu, ≥ 1 €), **un** toucher = 10 personnes au plus (`offrirAuxAimesVc`
   inchangé) ; recette pas apprise ⇒ la phrase du geste à faire une fois à la main, rien d'autre.
3. Corriger `f_vc_aimes` pour ne promettre que ce qui existe.
4. Dans l'app (écran Vestiaire), à côté de « Baisser le prix » : « Vestiaire prévient les personnes qui suivent
   l'article » (phrase sourcée), et le NOMBRE de favoris (`vcfavoris`), jamais qui.
5. Bancs : `audit-favoris-sites.cjs` (existe) étendu au panneau ; banc de rendu sur une fausse page Vestiaire.

---

## 3. eBay (par l'API officielle — aucune extension)

### 3.1 Ce qui existait
- **Offre aux observateurs** (5 oct.) : `offreinfo` (`find_eligible_items`, marché du compte, 204 = « lu, aucune ») et
  `offre` (`confirme:true`, remise entière 5–50 %, message ≤ 2 000 car., éligibilité REVÉRIFIÉE juste avant,
  `allowCounterOffer:false`, 48 h, coupure ⇒ « incertain »). C'est eBay qui choisit les destinataires (personnes qui
  suivent l'annonce ou l'ont mise au panier) ; VRM ne nomme personne (§3). Bouton sur la fiche de chaque annonce
  éligible.
- **Remettre en vente une inactive** (3 nov.) : `relanceverif` (vérification à blanc, frais) puis `relancer`
  (`RelistFixedPriceItem`, l'identifiant SEUL : même prix, même livraison gérée par eBay, même SKU ; refus : vendue,
  active, sans SKU, autre paire, prix ≠ prix vu, livraison gratuite, déjà remise, déjà en ligne sur un compte,
  variantes). Bouton par inactive.
- Base (23 nov.) : 1 compte eBay ; `ebay_listings` 4 annonces (1 avec un observateur, 3 reliées `VRM-n°`) ;
  `ebay_inactives` 6 (5 reliées, aucune déjà remise en vente, 2 avec un observateur). Aucune trace d'une offre ni
  d'une remise en vente faite par VRM (aucune ligne de journal : il n'y en avait pas).

### 3.2 Trous trouvés (et corrigés en phase 2)
| trou | risque | correction |
|---|---|---|
| l'offre part en POURCENTAGE du prix d'eBay ; la route ne relisait pas ce prix | prix changé sur eBay depuis l'écran ⇒ l'offre vend à un prix qu'il n'a pas vu (§2.8 « le prix envoyé est le prix vu ») | `prixVu` EXIGÉ ; l'annonce RELUE chez eBay (`GetItem`) : en ligne, sans variantes, même devise, prix au centime = prix vu ⇒ sinon 409, rien ne part ; la réponse dit le prix de l'offre calculé sur ce prix relu |
| rien ne gardait la trace d'une offre envoyée | une 2e offre sur la même annonce pendant les 48 h de la 1re (eBay : une offre par annonce, valable 48 h — page Seller Hub ; non mesuré par l'API) | journal `ebay_offres_envoyees{suffixe}` (comparer-et-échanger) ; une offre CONFIRMÉE de moins de 48 h ⇒ 409 `deja-envoyee`, rien ne part ; journal illisible ⇒ 503, rien ne part ; l'écran dit « Offre envoyée le … · jusqu'au … » |
| une par une seulement | Julien : « pareil que Vinted » (Vinted a l'envoi en série, sur son clic) | feuille « Offres aux observateurs » : les annonces éligibles cochées, UNE remise, le prix de chaque offre et ton prix d'achat à côté, une confirmation pour le lot, envoi une à une par la même route (chaque garde rejouée), résultat par ligne |
| remise en vente une par une | idem | feuille « Remettre en vente » sur les inactives reliées : vérification à blanc de chacune (frais), une confirmation pour le lot avec la somme des frais lus, remise une à une (`relancer`, chaque garde rejouée) |

Ce qui ne change pas : `confirme:true` exactement ; aucun champ de livraison envoyé (§2.8) ; aucune adresse, aucun
nom d'acheteur ; 12 fonctions `api/` (aucune nouvelle : actions de `api/ebay.js`).

### 3.3 Risques eBay
| risque | parade |
|---|---|
| eBay arrondit le prix de l'offre autrement que VRM | VRM affiche le prix calculé au centime (prix relu × (100 − %) / 100, arrondi) et le dit « calculé » ; non mesuré sur une vraie offre |
| plafond de 30 destinataires (Seller Hub) | VRM dit le nombre qu'eBay rend (`offers.length`), jamais un nombre deviné |
| coupure pendant l'envoi | « incertain » noté au journal (pas bloquant), la phrase dit de regarder sur eBay |
| frais d'insertion d'une remise en vente | lus par la vérification à blanc AVANT la confirmation ; frais inconnus ⇒ dit « frais non lus », jamais 0 |

---

## 4. Bancs (phase 2)
- `scripts/audit-ebay-offre-prix.cjs` (neuf) : la vraie route devant un faux eBay (GetItem XML, Negotiation JSON) et
  une fausse base : sans prix vu ⇒ 400 sans appel ; prix changé ⇒ 409 sans POST ; annonce terminée / variantes /
  autre devise ⇒ 409 ; `GetItem` illisible ⇒ 503 ; offre confirmée ⇒ journal écrit, prix de l'offre rendu ;
  2e offre < 48 h ⇒ 409 sans POST ; > 48 h ⇒ repart ; journal illisible ⇒ 503 sans POST ; mutations `prix`,
  `doublon`, `journal` ⇒ rouge. Rouge sur `main` (les gardes n'existent pas).
- `scripts/audit-ebay-route.cjs` : les tests de l'offre portés sur la règle (le prix vu est envoyé, l'ordre
  attendu devient éligibilité → relecture → envoi).
- `scripts/bancs/ebay-series.cjs` (neuf) : l'écran eBay, feuilles « Offres aux observateurs » et « Remettre en
  vente » à 390 et 1512 ; rien ne part sans la confirmation ; chaque ligne dit son résultat.

## 5. Sources publiques
- eBay Negotiation API : https://developer.ebay.com/api-docs/sell/negotiation/resources/offer/methods/sendOfferToInterestedBuyers ,
  https://developer.ebay.com/api-docs/sell/negotiation/resources/offer/methods/findEligibleItems ,
  Seller Hub « Offers to buyers » : https://www.ebay.com/sellercenter/growth/seller-hub-promotions/offers-to-buyers-best-offer
- Vestiaire : https://faq.vestiairecollective.com/hc/en-gb/articles/9434842053649-What-s-a-Flash-Price-Drop ,
  https://faq.vestiairecollective.com/hc/en-us/articles/7954420995601-Your-listings-on-Vestiaire-Collective ,
  https://faq.vestiairecollective.com/hc/en-gb/articles/360000809218-Making-an-Offer
- Leboncoin : https://leboncoin.fr/dc/cgv (règles de diffusion ; doublons) — la règle « supprimer avant de
  republier » vient d'une source secondaire citant les règles : https://eldorado-immobilier.com/reglementation-annonces-leboncoin

## 6. Phase 2 eBay — ce qui est fait (branche)
| pièce | fichier |
|---|---|
| règle serveur de l'offre (prix vu, devise, en ligne, variantes, prix de l'offre ; journal 48 h) | `api/_lib/ebay-offre.js` (pur) |
| route `offre` : `prixVu` exigé → journal relu (illisible ⇒ 503) → 2e offre < 48 h ⇒ 409 `deja-envoyee` → éligibilité → `GetItem` → jugement → envoi → noté (`envoyee` / `incertaine`) ; `offreinfo` rend `enCours` | `api/ebay.js` (`handleOffre`, `handleOffreInfo`, `JOURNAL_OFFRES`) |
| règle de l'écran (lignes, prix de l'offre = formule de la route, un à un, arrêt) | `src/ebaySeries.js` (pur) |
| feuilles « Offre aux observateurs » et « Remettre en vente » (natif : `Feuille`, `Rangee` à case, `Champ`, `Bouton`) | `src/ebay/SeriesEbay.jsx` |
| écran eBay : bouton « Offre aux observateurs · N annonces » au-dessus de la liste ; « Remettre en vente · N annonces » dans Inactives (≥ 2 proposables, même règle `relanceProposable` sur TOUTE la liste) ; la fiche envoie `prixVu`, dit le prix de l'offre et « offre en cours jusqu'au … » à la place du bouton | `src/ecrans/Ebay.jsx` |
| textes (5 langues) | `src/i18n/langues/*/ebaySeries.js` |
| Quoi de neuf `ebay-en-serie` · CLAUDE.md §9 (la ligne la plus ancienne déplacée dans `historique-divers.md`) | |

Preuves (machine saturée : commandes légères seulement aujourd'hui) :
- `audit-ebay-offre-prix.cjs` 17 ✅ ; rouge sur `main` (15 ❌ sur 17 : la route d'avant envoie sans prix vu, sans relecture, sans journal) ;
  mutations `prix`, `doublon`, `journal` ⇒ chacune 1–2 ❌.
- `audit-ebay-series.cjs` 16 ✅ ; rouge sur `main` (module absent) ; mutations `parallele`, `arret`, `encours` ⇒ 1 ❌ chacune.
- `audit-ebay-route.cjs` 548 ✅ (porté sur la règle : `prixVu` envoyé, ordre éligibilité → relecture → envoi, journal remis à
  zéro entre deux cas) ; `audit-ebay-relance` 33 ✅ ; `audit-fonctions-api`, `audit-actions-app`, `audit-traduction`,
  `audit-quoi-de-neuf`, `audit-icones` verts. JSX analysé par esbuild (sans build complet).
- **PAS ENCORE FAIT** (consigne : aucune commande lourde avant 15:30 UTC, aucune fusion aujourd'hui) : `npm run build`, banc
  `scripts/bancs/ebay-series.cjs` (écrit : scénarios O offres et R remise en vente, 390 et 1512, captures dans
  `$TMPDIR/banc-ebay-series/`), `scripts/bancs/ebay-inactives.cjs` (non régression), passe `lancer-audits.cjs`, PR.

## ÉTAT À LA REPRISE
1. Après 15:30 UTC : `lourd.sh npm run build` ; `BANC_PORT=<hasard> lourd.sh node scripts/bancs/ebay-series.cjs` (regarder les
   6 captures par largeur) ; `lourd.sh node scripts/bancs/ebay-inactives.cjs` ; `AUDITS_PARALLELE=2 lourd.sh node
   scripts/lancer-audits.cjs`. Le banc `ebay-series` doit aussi rougir sur `main` (aucun bouton de série).
2. Vrai `git merge origin/main`, PR par REST, CI ; **fusion pas aujourd'hui** (démo de Julien) — demain après 07:00 UTC
   selon la règle du 16 nov.
3. Leboncoin et Vestiaire : plans 1.3 et 2.3, à relancer par le coordinateur après la 5.441 ; aucune version réservée.
4. Non mesuré (à dire à Julien) : une vraie offre aux observateurs envoyée par VRM (arrondi d'eBay, plafond de 30) ; une vraie
   remise en vente (frais). Le premier envoi réel dira la forme ; le journal `ebay_offres_envoyees` la gardera.
