# PASSATION COMPLÈTE — 16 octobre 2026

> ## ⚠️ MISE À JOUR DU 19 OCTOBRE — lire `LIS-MOI-D-ABORD-2026-10-16.md` §1 et §2 d'abord
> Ce fichier décrit l'état au **16 octobre**. Depuis, deux autres agents ont poussé
> **74 commits sur `main`** (extension **5.190**) et ont réimplémenté de leur côté
> presque tout ce que ce fichier marque ⬜ / 🟨 / 🟧 : publication Leboncoin et eBay
> en un clic, Tout imprimer, tampons par type, litiges hors des colis à faire,
> numérotation réparée (migration 017), nuage, comptes bannis, mode stream, 2FA,
> mode équipe (migration 016 non appliquée), studio photo, double vente app fermée,
> design de la maquette… **Ne fusionne pas cette branche, n'applique pas les
> patchs : ils sont plus vieux que la production.** Ce qui reste vraiment (vérifié
> contre `main` le 19 oct.) est listé au §2 de `LIS-MOI-D-ABORD-2026-10-16.md` ;
> ce fichier-ci reste utile pour le texte de chaque demande, les décisions de
> Julien (§8) et les pièges (§9).

**À lire après `docs/passation/LIS-MOI-D-ABORD-2026-10-16.md`** (l'ordre de travail,
les 7 patchs, la mise en ligne). Ici : **tout le reste**, en détail — chacune des
demandes de Julien du 2 au 16 octobre avec son état, ce qui reste de la grande
demande du 15 octobre, le travail construit avant le 12 octobre et jamais
fusionné, la feuille de route eBay, l'arriéré des propositions, ses gestes, ses
décisions.

Règles de lecture :
- **Statuts** : ✅ en production · 🟦 dans la branche `claude/project-review-nsk5su`,
  pas encore en production · 🟨 partiel (patch dans `docs/passation/wip/`) ·
  🟧 construit mais jamais relu / jamais fusionné · ⬜ pas fait · 👤 geste de
  Julien · ⛔ refusé ou retiré par Julien (NE PAS faire) · 🔬 à mesurer d'abord.
- « Vérifier » veut dire : relire le code de la branche ET le prouver (§6.1 de
  `CLAUDE.md` : rouge sur le code d'avant, vert après, rouge sous mutation).
- Julien n'est pas développeur, ne veut **pas de questions** : tranche, dis ce
  que tu as tranché, écris-le dans `CLAUDE.md`.
- Les sources de ce fichier sont toutes dans le dépôt :
  `docs/passation/demandes-julien-2-16-octobre.md` (le texte de chacun de ses
  messages), `docs/roadmap/` (la demande du 15 oct., son annexe, la matrice de
  couverture), `docs/passation/notes/15oct/` (rapports bruts des mesures),
  `docs/passation/wip/defauts-relectures-15oct.md`, `docs/passation/README.md`
  et `journal-agent-1.md` / `journal-agent-2.md` (passation du 11-12 oct.).

---

## 1. Toutes les demandes de Julien, du 2 au 16 octobre

### 1.1 — 2 au 4 octobre (presque tout livré et en production)

| date | demande | état |
|---|---|---|
| 2 oct. | « regarde le projet et dis-moi ce qu'il en est », puis « fais tout » | ✅ revue faite |
| 2 oct. | régénérer la clé secrète Supabase, activer « Leaked password protection » | 👤 il l'a faite (« c'est fait pour l'ancienne clé ») ; la protection des mots de passe fuités : **à revérifier** dans Supabase → Auth (il n'a pas confirmé) |
| 2 oct. | onglets eBay et Leboncoin rangés comme Vinted (résumé, puis Ventes / Achats / Annonces, sans « Aperçu ») | ✅ (#10 du suivi) |
| 2 oct. | le nouveau logo VRM en bas à droite sur Vinted, Leboncoin, Vestiaire, eBay ; plus l'ancien orange ; un tout petit écran de connexion, l'extension s'occupe du reste | ✅ (5.130, `vrm-badge.js`) |
| 3 oct. | dater le CA du mois au jour de la réception d'argent (ventes finalisées) | ✅ (5.133, `capterDatesVersement`) |
| 3 oct. | « pourquoi l'extension ne capte pas plus de données » | ✅ analysé et traité (capture passive, vitesse) |
| 3 oct. | ~300 notifications à chaque ouverture ; l'impression sur ordinateur téléchargeait ; un ami a eu un compte lent à charger | ✅ (#13, #14, #16) |
| 3 oct. | eBay = l'argent reçu ; bilan annuel = les comptes sélectionnés ; ne plus parler de shop_cancale | ✅ pour le bilan et shop_cancale. ⬜ **le CA eBay « argent reçu » n'est PAS codé** (voir §5.1) |
| 3 oct. | « j'ai un autre agent IA qui fait eBay » | — (contexte) |
| 3 oct. | une page d'accueil publique avec une vidéo en motion design | ✅ (#22, `src/Accueil.jsx`, `?film`) |
| 4 oct. | améliorer la sécurité ; brancher Stripe | ✅ (#23, #24, #31) |
| 4 oct. | revue profonde du site ; avis sur Hetzner, Coolify, Resend, Clerk, Cloudflare, PostHog, Sentry, Upstash, Pinecone ; ajouter les compétences de design d'Emil Kowalski | ✅ (#25, #26). Avis donné : rien de ça n'est nécessaire aujourd'hui ; **Resend** (ou un autre SMTP) reste le seul vrai besoin, pour les emails d'inscription et la preuve d'adresse (§5.6) |
| 4 oct. | « arrête de me demander les permissions », « accepte tout automatique » | ✅ réglé ; règle permanente : ne rien lui demander |

### 1.2 — 4 au 8 octobre

| demande | état / reste |
|---|---|
| clé de la route des emails (`EMAIL_INBOUND_SECRET`) | 👤 **la clé n'est toujours pas posée** : 1) il colle le `scripts/gmail-forwarder.gs` actuel dans son Apps Script en remplissant `SECRET` chez lui (jamais dans le dépôt) ; 2) les journaux Vercel doivent dire « script Gmail à jour (clé fournie) » ; 3) poser la MÊME valeur dans `EMAIL_INBOUND_SECRET` sur Vercel (Production) et redéployer. Tant que ce n'est pas fait, n'importe qui peut envoyer un faux email de vente |
| registre URSSAF « J'ai déclaré ce mois » | 👤 il n'a noté **aucun** mois : Ventes → Outils → Rapport comptable → août, « J'ai déclaré ce mois » avec la règle qu'il a réellement utilisée, puis septembre. Le lui rappeler une fois |
| lancement : Supabase (Site URL + SMTP), Stripe (prix, CGV), adresse de contact, mentions légales | 👤 voir §7 |
| anti double vente eBay quand VRM est fermé (la vente part de toute façon) | ⬜ spec complète `docs/passation/notes/agent-ebay/spec-finale.md` (K5 battement + veille, K8 retrait VRM fermé, K10 notifications eBay) ; migration 015 (pg_cron/pg_net) **avec essai annulé d'abord** ; garder l'agent eBay éteint par défaut (`agent_ebay='0'`). La migration 014 est appliquée (12 oct.) |
| les offres reçues (emails) en tête de Messages | ⬜ **régression** : livré le 6 oct., retiré de la production le 13 oct. par un commit `codex` (13f6c89) sans décision de Julien. Rebrancher le bloc « N offres à trancher » (règle `offresAtraiter` : compte, chronologie, titre non ambigu ; « c'est fait » → `vinted_offers_done`) dans la messagerie du 15 oct. (compte de Chrome d'abord). Bancs `messagerie.cjs`, `audit-offres-titre.cjs` |
| registre annuel : les ventes 2026 sans date de versement | ⬜ une ligne « mois pas encore connu » (montant + nombre) dans le bilan annuel et le rapport ; noter dès maintenant le jour où VRM VOIT une vente finalisée ; jamais retomber sur la date de vente sans le dire ; `audit-urssaf` + banc `rapport.cjs` |
| « paires qui te reviennent » : séparer celles qui reviennent vraiment de celles jamais parties | ⬜ distinguer retour/remboursement APRÈS envoi d'une annulation avant envoi / paiement échoué, par l'état de la transaction ; aucun numéro touché ; banc. ⚠️ à rapprocher du patch 1 (retours) |
| résultat après charges : une seule règle (Comptabilité et registre annuel) | 🟦 dans la branche, part avec la mise en ligne |
| écrans cachés jamais ouvrables : Ma tournée, Litiges, Sourcing, Trésorerie | ⬜ trancher seul : rebrancher là où le geste a lieu (Ma tournée dans Colis / Achats à retirer ; Trésorerie dans Statistiques) OU retirer le code mort ; compter les écrans montés avant/après (§4.11) |
| premiers essais réels eBay (2ᵉ compte, programmation, 4ᵉ annonce) | 👤 eBay → Compte eBay → « Connecter un autre compte eBay » ; programmer UNE paire à +1 h et lire la ligne « frais de programmation », puis essayer « Annuler » ; relier la 4ᵉ annonce à sa paire. Ensuite relire ce qu'eBay a répondu |
| eBay : pause (stock 0) au lieu de retirer, remise en vente d'un clic | ⬜ `OutOfStockControl` (SetUserPreferences, sur son clic), `ReviseInventoryStatus` quantité 0 sur vente prouvée ailleurs, « Remettre en vente » si la vente Vinted est annulée ; relire la règle d'offre ensuite |
| eBay : commandes à expédier dans Colis et Ma journée | ⬜ règle `aExpedierEbay` UNIQUE (§11) pour Colis, Ma journée, cloche, widget, rappels ; lien vers l'étiquette eBay ; date limite. (Julien, 11 oct. : sur eBay **c'est l'acheteur qui paie le bordereau**) |
| eBay : retours et litiges, date limite de réponse | ⬜ Post-Order API (nouvelle portée OAuth ⇒ reconnexion) ; « eBay à valider » : lire la doc officielle AVANT de coder |
| eBay : évaluation automatique des acheteurs | ⬜ interrupteur éteint par défaut ; seulement sur paiement prouvé, une fois par commande, texte réglable, journal |
| eBay : qualité de l'annonce avant publication | ⬜ liste à cocher (caractéristiques recommandées manquantes, nombre de photos, longueur du titre) — après eBay en un clic |
| eBay : modifier en série (prix −X %, description) | ⬜ sélection + aperçu + envoi une par une avec Arrêter et bilan (modèle `EbayReglesToutes`) |
| eBay : soldes (Marketing API) et statistiques | ⬜ nouvelles portées OAuth ; aucun chiffre inventé |
| eBay : modèles de description par vendeur | ⬜ modèle texte synchronisé (`onCloudReady`). Mise en avant payante : rien sans demande explicite |
| eBay : réponse automatique aux acheteurs | ⛔ **ne pas construire sans qu'il le redemande** : le 15 oct. il a retiré la réponse automatique sur Vinted (« elle n'agit pas toute seule ») ; par cohérence, réponse sur SON clic seulement |
| sécurité restante | 👤 dépôt en privé, clé « publishable », confirmation d'email, longueur du mot de passe, protection des mots de passe fuités, supprimer deux branches poussées par erreur (`claude/wip-ext-5162`, `claude/wip-bilan-lancement`) |
| adresse de réception déclarée mais non PROUVÉE | ⬜ **bloquant avant d'ouvrir VRM à des inconnus** : lien de confirmation envoyé à l'adresse (il faut le SMTP), cliqué depuis la session du vendeur, preuve rangée côté serveur ; `resoudreProprietaire` / `peutReclamer` n'acceptent qu'une adresse prouvée |
| quarantaine des emails par vendeur : filtre PostgREST jamais mesuré | 🔬 ouvrir Réglages → Mes adresses de réception : s'il dit « pas pu vérifier », c'est ce filtre ; le tester sur un PostgREST local ou une branche Supabase, jamais en écrivant en prod |
| politique CSP `script-src` | ⬜ d'abord un banc qui sert `dist/` AVEC les en-têtes de `vercel.json` ; retirer/hasher les 2 scripts inline d'`index.html` ; fenêtre du reçu (onclick) |
| vieilles sauvegardes du 30 sept. et du 2 oct. | 👤 avec Julien devant l'écran (un DROP demande un humain) : supprimer ces tables ; GARDER `numerotation_013`, `numerotation_faite` (retour arrière de la 013) ; regarder `journal_ecritures` (15 Mo) avant de décider |
| PDF des bordereaux dans le stockage de fichiers (étapes 1 à 4) | ⬜ migration 009 (compartiment privé) essayée sur une branche Supabase ; l'app lit les deux formes ; serveur puis extension écrivent dans le stockage (objet AVANT la ligne) ; rattrapage ; vider la colonne seulement sur son oui |
| données inventées pour que les bancs tournent sans copie de sa base | ⬜ générateur de fixtures à la même forme (projections `select=`, `meta`) ; jamais de vraies données dans le dépôt (public) |
| app plus rapide sur iPhone | 🟦 1ʳᵉ tranche faite (Stock 3D en `React.lazy`, `src/Room3D.jsx`) ; le reste : écran par écran, un banc par écran, `audit-tdz`, **en dernier, seul** |

### 1.3 — 8 au 11 octobre

| date | demande | état |
|---|---|---|
| 9 oct. | « un agent qui fait tout pour eBay » | 🟨 spec `notes/agent-ebay/spec-finale.md` ; règle d'offre livrée ; l'agent « VRM fermé » attend la migration 015 (§1.2) |
| 9 oct. | « une règle sur chaque annonce : à chaque offre au-dessus, ça accepte » (eBay seulement) | ✅ seuil natif d'eBay (`BestOfferAutoAcceptPrice`), posé sur son clic (règle d'offre, tours 1 à 4) |
| 9 oct. | il supprime toutes ses annonces pour tout reposter : une interface parfaite pour savoir quoi poster sur Leboncoin, ce qui est vendu, ce qu'il faut retirer ; reprendre la numérotation à zéro | ✅ migration 013 (anciens numéros en « B », 1…24 neufs, appliquée le 11 oct.) ; ⚠️ **la numérotation automatique s'est arrêtée le 11 oct. 13:36** : LIS-MOI §4.1 |
| 9 oct. | « les paires supprimées sont encore dans les annonces » | ✅ 5.165-5.166 (suppression vue → l'annonce sort) |
| 10 oct. | « regarde par rapport à la date de mise en ligne » | ✅ (013 + `dateMiseEnLigneMs`) |
| 11 oct. | notifications pas toujours envoyées ; l'extension « pas allumée » après Leboncoin ; certains comptes | ✅ traité (plaintes du 11 oct., passation du 11-12) |
| 11 oct. | « ANNONCES = les paires en ligne actuellement », pas trois fois la même | ✅ 5.170 (relecture publique des autres comptes) |
| 11 oct. | Vestiaire Collective + Photoroom (détourage) — « un gros chantier » | ⬜ #81 : publier sur Vestiaire avec détourage. Mesurer d'abord la forme de Vestiaire (`vc_recon`), l'extension seule y a accès |
| 11 oct. | coût par utilisateur, 9,99 € suffit-il ; 1 000 et 100 abonnés en SASU | ✅ étude + simulation ; décision : **12,99 €/mois** (✅ CGV, accueil, app ; 👤 prix Stripe à recréer) |
| 11 oct. | l'extension « Se connecter » doit ouvrir VRM directement ; elle ne garde pas la connexion | ✅ session adressée (5.171-5.174) |
| 11 oct. | « je n'ai plus les photos des paires » (annonces, bordereaux, ventes) | ✅ (photos archivées en secours, #530) |
| 11 oct. | propositions : « tout est bien sauf 12, 8, 7 » ; « 18, 21, 22, 23, 24, 25 » ; « 33, 34, 35, 37 — trouve une solution sans IA ou avec LEUR clé API, pas la mienne » | voir §6 (ce qui est livré et ce qui reste) |
| 12 oct. | « donne toutes les consignes très précises à l'autre » | ✅ passation du 11-12 (`docs/passation/README.md`) |

### 1.4 — 15 et 16 octobre

| demande | état |
|---|---|
| **la grande demande du 15 oct.** (prompt maître, 88 Ko) | voir §3 — intégrée en grande partie dans la branche, rien en production |
| « quand tu auras fini, mets ce style dans l'app, et reprends la disposition des boutons que l'app a déjà » (`docs/design/maquette-style-2026-10-15.webp`) | ⬜ **en dernier**. Le 15 au soir il a demandé « as-tu publié le nouveau design ? » : **non**, pas encore |
| « lance plusieurs tâches en même temps », « fais tout parfaitement, comme un professionnel » | — (méthode : workflows en parallèle, relecture adverse) |
| litige : une vente dont le colis de retour est au point relais proposait « Imprimer le bordereau » ; améliorer les colis à retirer | 🟧 patch 1 (LIS-MOI §4.2) |
| un agent totalement autonome pour Leboncoin et eBay : la catégorie la plus proche quand rien ne convient, tout rempli au clic « Publier », la description et l'annonce copiées EXACTEMENT de Vinted | 🟨 eBay : patch 5 + plan mesuré (LIS-MOI §4.3) ; Leboncoin : la mesure a été coupée, à refaire (LIS-MOI §4.4) |
| 16 oct. : « je commence à publier sur eBay, je ne dois pas avoir à remplir la marque, prends-la sur Vinted, pareil pour le style, la catégorie… je ne dois rien avoir à remplir, juste Publier » | 🟨 même chantier — **priorité pour lui** |
| 16 oct. : ce fichier | ✅ |

---

## 2. Ce qui est dans la branche et pas encore en production

Liste des lots fusionnés le 15-16 octobre dans `claude/project-review-nsk5su`
(chacun a sa section datée dans `CLAUDE.md`, ses preuves, et ses rapports) :

| lot | contenu | relu ? |
|---|---|---|
| `p0-lbc-pub` | titre « taille 43 » en toutes lettres (app = extension, `lbcTitre`) ; prix = celui de l'annonce Vinted en ligne (`prixVinted`), posé en EUROS par-dessus la recommandation de Leboncoin, relu, reposé si Leboncoin le réécrit ; « Continuer » et « Publier » bloqués tant que le prix n'est pas relu juste ; lieu = `vrm_ville` (Réglages → « Ta ville ») avec seulement la suggestion « Ville (CP) » identique ; livraison activée sans jamais une option payante ; bandeau en une ligne | ⬜ **relecture adverse jamais faite** |
| `p0-lbc-photos` | photos du dépôt Leboncoin | ⬜ jamais relu |
| `p0-lbc-annonces` | annonces Leboncoin | relu dans le lot |
| `p0-audits` | 3 audits rouges sur `main` remis au vert (preuve de vente, chiffres, commandes) | — |
| `p0-ebay-photos` | photos d'une annonce lues au CLIC depuis le formulaire eBay (`photosDepuisApp`, capacité `photosclic` = `'A_POSER'` → **5.178.0** à la montée de version) ; ligne d'état des photos (`data-ebay-photos`) | ⬜ jamais relu |
| `p0-ebay-vc` | le balayage d'onglet qui ouvrait Vestiaire depuis le formulaire eBay (`data-garde-onglet`) — rien n'était publié sur Vestiaire | ⬜ jamais relu |
| `p1-achats` | Achats, colis à retirer | relu |
| `p1-compta` | Statistiques / Déclarations / Comptabilité séparées ; `CarteUrssafMois` | relu |
| `p1-comptes` | fiches de comptes simplifiées, adresses de réception expliquées, **mode stream** (`src/modeStream.js`) | relu, 7 défauts corrigés (c1ca0c1) |
| `p1-ebay-prep` | prix et description repris de Vinted (`repriseVinted` : seulement un champ vide ou encore celui de VRM) ; une relecture GetItem après publication (`verifPublication`, 3 états) | relu |
| `p1-fiscal` | profil d'entreprise (SIREN, forme, TVA, marge, VL) ; factures et avoirs numérotés sans trou ; régime respecté partout (carte URSSAF, rappel du 1er, 4 exports) | relu ; ⚠️ **9 défauts non corrigés** (patch 6) |
| `p1-journee` | Ma journée : une barre de 4 actions, bannières retirées | relu |
| `p1-messages` | messagerie ; **réponse automatique retirée** (moteur enlevé de `background.js`) | relu |
| `p1-stock` | stock, `vrm_room` en trois états | relu |
| `p1-veille` | veille d'achat (prototype) | relu |
| `p1-ventes` | période vendu/finalisé/versé, courbes, « Prix qui marche » | relu |
| `p1-annonces` | un logo par plateforme où la paire est PROUVÉE en ligne ; écran `VestiaireCollective` ; « Vestiaire Collective » en entier | relu ; ⚠️ **4 défauts non corrigés** (patch 7) |
| `p1-ebay-auto` (base) | base du chantier eBay en un clic | le reste : patch 5 |

---

## 3. La grande demande du 15 octobre : ce qui reste

Le plan est `docs/roadmap/matrice-2026-10-15.md` (350 lignes, chaque demande et
chaque idée du catalogue une seule fois, avec état, fichiers, risque, test). ⚠️
**La matrice a été écrite AVANT les fusions** : la première tâche sur ce point
est de la **remettre à jour ligne par ligne contre la nouvelle tête** (une ligne
« partiel/absent » couverte par un lot fusionné doit être vérifiée, pas crue).

### 3.1 P0 de la matrice encore ouverts (en plus des chantiers de LIS-MOI §4)
- **D-synthese-1** numérotation arrêtée → LIS-MOI §4.1.
- **D-colis-1…9** « Tout imprimer » et tampons → patchs 3 et 4.
- **D-comptes-1** nuage barré → pas commencé (LIS-MOI §4.5).
- **D-comptes-2 / D-comptes-8 / APP-05** comptes bloqués. **Mesuré le 15 oct.** :
  les profils captés portent `is_account_banned` et `account_status` — **jamais
  lus** par l'app (4 profils à `true`). À l'inverse, le retrait des vues actives
  se déclenche aujourd'hui SANS confirmation sur un simple 403 (`isBanni`), avec
  une liste locale à l'appareil. Ce qu'il faut : le statut dérivé du SIGNAL
  EXPLICITE (`is_account_banned`), jamais d'un échec réseau ; annonces d'un
  compte confirmé bloqué sorties des vues actives, gardées en archive.
- **D-stock-8** ne détruire aucune donnée : le plan de stock peut être effacé
  sur une lecture ratée / un appareil neuf (lu dans le code, non reproduit) ;
  `p1-stock` a mis `vrm_room` en trois états — **à vérifier** au banc (appareil
  neuf, après « Se déconnecter », après purge de version).
- **Recherche qui garde le cache d'un autre vendeur** (cité par la matrice en
  P0) — **à vérifier** : vider le cache de recherche au changement de vendeur
  (`key = user.id` remonte `AppCoeur`, mais un cache de module survivrait).
- **D-publication-9** routage des actions par plateforme (doubles clics,
  identifiants d'envoi : eBay « Publier » sans N° n'a ni garde d'identité ni
  identifiant d'envoi) ; **D-publication-10/11** couverts par `p1-ebay-prep`
  — à vérifier.

### 3.2 Régressions citées par la matrice
- **FONC-03** offres reçues retirées de Messages (commit codex 13f6c89) → §1.2.
- **D-ventes-2** « CA entre deux dates » à 0 € sur toute période, **D-ventes-3**
  deux « CA finalisé » différents → `p1-ventes` les traite : à vérifier au rendu.

### 3.3 Les lots L1 à L12 de la matrice
Ordre conseillé par la matrice : Lot 0 (P0) → L1 → L2 → L6 → L3 → L4 → L5 → L7 →
L8 → L9 → L10 → L11 → L12.

| lot | sujet | où on en est |
|---|---|---|
| L1 | Ma journée et Messages | 🟦 `p1-journee`, `p1-messages` ; reste FONC-03 (offres), à vérifier ligne par ligne |
| L2 | Achats et colis (à retirer, hors plateformes, toutes plateformes) | 🟦 `p1-achats` + 🟧 patch 1 (retours) ; Colis **toutes plateformes** (D-colis-*) à vérifier |
| L3 | Comptes, synchronisation, mode stream | 🟦 `p1-comptes` |
| L4 | Stock : plan 2D, assistant, une seule règle « rangée » | 🟦 `p1-stock` ; + 🟧 le pointage carton par carton (§4) |
| L5 | Annonces : statut prouvé par compte, logos, Vestiaire, branches eBay | 🟦 `p1-annonces` (+ patch 7) ; la capture « Mes annonces » Leboncoin manque encore pour prouver la présence par compte |
| L6 | Chiffres justes : CA d'une période, un seul CA finalisé, résultat, factures, rappel URSSAF | 🟦 `p1-ventes`, `p1-compta`, `p1-fiscal` (+ patch 6) |
| L7 | Finances et fiscal : comptabilité recentrée, profils, factures/avoirs, bénéfice par paire | 🟦 en grande partie ; ⚠️ aucune règle fiscale inventée : sources officielles datées (bloquées par le proxy de la session précédente) |
| L8 | Ventes et statistiques | 🟦 `p1-ventes` |
| L9 | **Style de la maquette** | ⬜ en dernier |
| L10 | eBay pro sans nouvelle API (messages, offres, annonces, expédition, analyses) | ⬜ 39 lignes (§5) |
| L11 | eBay « à valider » + agent (retours, litiges, versements, notifications, VRM fermé) | ⬜ lire la doc eBay officielle d'abord ; migration 015 |
| L12 | Veille d'achat et rentabilité avant achat | 🟦 prototype `p1-veille` ; 65 lignes ; ⚠️ §3 : jamais lire Vinted/Leboncoin hors de ses propres comptes ; API Browse eBay : quotas et licence à valider |

### 3.4 Les 4 questions « à trancher » de la matrice — tranche-les
- **B1** CA eBay : **déjà tranché par Julien le 3 oct.** = « l'argent que tu
  reçois » (`totalDueSeller − totalMarketplaceFee`). À coder (§5.1).
- **B2** « Prix qui marche » avec les ventes des comptes supprimés (77 % des
  comparables) : recommandation — les GARDER comme comparables de prix (ce sont
  ses vraies ventes), en le disant ; elles n'entrent dans aucun total d'argent.
- **B3** un interrupteur vaut-il « confirmation explicite » pour l'agent eBay
  VRM fermé : recommandation — oui, s'il est éteint par défaut, allumé sur son
  clic avec une confirmation qui dit ce qu'il fera, et un journal relisible.
- **B4** publication 100 % automatique : **tranché par Julien le 15 oct.** = oui,
  après SON clic « Publier », catégorie la plus proche en le disant.

### 3.5 Exclus et abandonnés (ne pas réintroduire)
APP-01, APP-06 (exclus) ; VISUEL-01…20 (abandonnés) ; AGENT-K14 (bordereaux
achetés par VRM) gelé.

---

## 4. Travail construit avant le 12 octobre et JAMAIS fusionné

Ces branches existent dans deux bundles du dépôt :
`docs/passation/branches-locales-2026-10-11.bundle` et
`docs/passation/branches-2026-10-12.bundle`.

```
git fetch docs/passation/branches-locales-2026-10-11.bundle 'refs/heads/*:refs/remotes/passation/*'
git fetch docs/passation/branches-2026-10-12.bundle 'refs/heads/*:refs/remotes/passation12/*'
git branch -r | grep passation
```

Leur base est ancienne (vers `cdc9c1d`) : **vrai merge** dans une copie de la
branche, conflits attendus sur `src/App.jsx` et `api/email-inbound.js`, puis
build, audits, bancs, relecture adverse.

| chantier | ce qu'il fait | reste |
|---|---|---|
| litiges : le téléphone sonne | notification quand un litige s'ouvre | refusionner ; bancs `litige.cjs`, `serveur.cjs` ; relecture |
| synchro de la ligne `main` par morceaux | l'iPhone et le Mac ne s'effacent plus | refusionner (`cloudPush` a bougé : pointage, ventes, 013) ; banc à deux appareils ; relecture (risque : écrasement de numéros) |
| copie quotidienne des numéros + « Remettre » une entrée | depuis Réglages | ⚠️ adapter à la 013 : « Remettre » ne doit JAMAIS redonner un numéro converti en B ni un numéro provisoire de `renum` ; garde-fou `vrm_numeros_perimes` |
| prénom jamais une adresse email ; consignes et logo de l'installation réservés au propriétaire | | avant d'ouvrir VRM à d'autres vendeurs |
| « Tes connexions » : voir où VRM est ouvert, couper une session | | migration renumérotée **020+** (la 011 n'existe pas en prod) avec essai annulé sur une branche Supabase |
| achats pas encore postés ≠ « En transit » ; rythme URSSAF par vendeur ; « Répondre à N acheteurs » | | mesurer d'abord si la messagerie du 15 oct. et l'écran Achats couvrent déjà le besoin ; sinon refusionner |
| pointage du stock carton par carton + « Retrouver une annonce disparue » (coffre) | | refusionner (`cloudPush`, `entreeCache` ont bougé) ; bancs `inventaire-pointage`, `coffre` |
| fiche Chrome Web Store (mise à jour automatique de l'extension) | dossier de publication | 👤 Julien crée le compte développeur Chrome (~5 $) et dépose la fiche ; ensuite seulement le lien de l'app vers la boutique |

---

## 5. eBay — ce qui reste

### 5.1 Le CA eBay = « l'argent que tu reçois » (décision du 3 oct., pas codée)
Dans `src/App.jsx`, branche eBay de `ventesDeclarables` / `ventesFaites` et
`caEbayPayees` : compter `paymentSummary.totalDueSeller − totalMarketplaceFee` ;
frais inconnus ou autre devise ⇒ commande écartée ET dite, jamais comptée au
hasard. Puis régénérer `api/_lib/ventes-regle.js` par
`node scripts/audit-bilan-semaine.cjs --recopie` (copie exacte, jamais à la
main) ; étendre `audit-urssaf.cjs`. Aujourd'hui : 0 commande eBay ⇒ aucun impact
sur ses chiffres, mais ce sera faux à la première vente.

### 5.2 eBay en un clic → LIS-MOI §4.3 (priorité de Julien)

### 5.3 Le reste (feuille de route L10/L11)
Voir le tableau du §1.2 (pause stock 0, commandes à expédier, retours/litiges,
évaluation, qualité, série, soldes, modèles) et la spec
`docs/passation/notes/agent-ebay/spec-finale.md` (vagues K1…K17). Règles :
`api/` = 12 fonctions max (ajouter des MODES à `api/ebay.js`), une nouvelle
portée OAuth impose une reconnexion de Julien, « eBay à valider » = lire la
documentation officielle avant de coder.

---

## 6. Les propositions que Julien a retenues le 11 octobre

**Refusées** (ne pas reproposer) : 7, 8, 12, 19, 20, 26-29, et parmi les
nouveautés : badge « bonne affaire » sur Vinted, saisonnalité, photo d'étiquette
→ fiche, acheteurs fidèles (liste complète dans `CLAUDE.md`, en tête).

**Déjà livrées** (journal de l'Agent 2, 12 oct., en production) : G1 prix d'achat
au numérotage · G11 copier le prix payé · G24 compte qui vend le mieux · G22
favoris sans vente → remise native · G34 saisie vocale · G9 codes de retrait hors
ligne · G35 traduction des messages ; et déjà présentes avant : 14, 21, 3, 6, 13,
25, 16, 4 (fiche « republier »), 15 (récap comptable).

**Restent** :
| n° | quoi | pourquoi pas fait / comment |
|---|---|---|
| 2 | double vente notifiée **app fermée** | push SERVEUR + versant eBay = agent eBay (§1.2, migration 015) |
| 10 | rappel la veille au soir | un **2ᵉ cron Vercel** : un cron refusé au déploiement bloque TOUS les déploiements (leçon #250). Tranche : soit le faire partir du cron existant (`ship-reminders`, 08:00 UTC) en gardant un seul cron, soit vérifier les limites du plan avant d'en ajouter un |
| 17 | double vérification de connexion (2FA) | MFA natif de Supabase ; ⚠️ il est seul utilisateur : un mauvais enrôlement le VERROUILLE hors de son outil ⇒ prévoir un chemin de récupération AVANT ; facultatif, éteint par défaut |
| 18 | achats à vérifier avant la date limite | **mesuré impossible** : aucun délai de protection acheteur dans ses 1 581 achats ; ne pas inventer le délai de Vinted |
| 23 | boost rentable ? | **mesuré impossible** aujourd'hui : aucun coût de boost rattachable à une paire ; c'est un coût de compte, jamais réparti |
| 33 | studio photo + détourage | le détourage Photoroom est en production (clé du VENDEUR, §2.9) ; un modèle local est sous licence commerciale — Julien : « sans IA ou avec LEUR clé API, pas la mienne » |
| 37 | mode équipe | auth + RLS (migration 020+), testable seulement sur une branche Supabase ; périmètre à trancher (recommandation : colis et codes de retrait seulement, en lecture) ; invitation = il faut le SMTP et des adresses prouvées |
| 5 | app plus rapide (écrans à la demande) | 1ʳᵉ tranche faite ; le reste écran par écran, **en dernier, seul** |

---

## 7. Gestes que SEUL Julien peut faire

Certains ont pu être faits depuis : **vérifie avant de les lui redemander**, et
ne les lui redemande qu'une fois, en lui disant où cliquer.

- [ ] **Installer l'extension 5.178** (dès qu'elle est publiée), dans UN SEUL
  dossier, en retirant toute autre copie de VRM dans `chrome://extensions` (dans
  chaque profil Chrome), puis recharger les onglets Vinted.
- [ ] Les **8 paires renumérotées par erreur** entre le 30 sept. et le 2 oct.
  (543→266, 544→267, 545→268, 548→269, 549→270, 550→271, 551→276, 552→285 ;
  6 encore en ligne) : regarder le carton, remettre le bon N° dans le champ N°
  (l'app demande confirmation). Ne JAMAIS corriger sa base à sa place.
- [ ] **Clé de la route des emails** (§1.2) — c'est une faille ouverte.
- [ ] **Supabase → Authentication → URL Configuration** : Site URL
  `https://vrm.center`, Redirect URLs `https://vrm.center/**` ; un **SMTP
  personnalisé** (Resend ou autre) ; confirmation d'email ; longueur du mot de
  passe ; protection des mots de passe fuités ; clé « publishable ».
- [ ] **Stripe** : `STRIPE_SECRET_KEY` sur Vercel ; recréer le prix **12,99 €**
  mensuel avec la clé de recherche `vrm_mensuel` (cocher « transférer la clé de
  recherche ») — tant que ce n'est pas fait, l'app garde le paiement FERMÉ
  (voulu) ; Settings → Public details → Terms of service =
  `https://vrm.center/legal/cgv.html`. En mode réel le jour du lancement.
- [ ] **Adresse de contact et mentions légales** : `src/contact.js` ET
  `public/legal/editeur.js` (la même valeur, l'audit le vérifie).
- [ ] **Registre URSSAF** : noter août et septembre (§1.2).
- [ ] **Dépôt GitHub en PRIVÉ** ; supprimer les branches `claude/wip-ext-5162`
  et `claude/wip-bilan-lancement`.
- [ ] Supprimer les vieilles tables de sauvegarde (§1.2), avec toi devant l'écran.
- [ ] Les essais eBay réels (§1.2).
- [ ] Le compte développeur Chrome Web Store (§4), s'il veut les mises à jour
  automatiques.
- [ ] Les deux comptes VRM d'essai du 2 oct. (`julien.fournier3535@…` et un
  second) : les supprimer est irréversible, **seulement sur sa demande**.

---

## 8. Décisions de Julien à respecter (le détail est dans `CLAUDE.md` §2-§3)
- Ne rien lui demander ; déployer soi-même (PR → `main` → merge).
- Pousser à chaque modification ; aucune donnée inventée en production.
- Identité d'une paire : jamais par titre ni par ressemblance (§5) — **sauf** la
  catégorie / les options de publication Leboncoin-eBay, où il a demandé « la
  plus proche » en le disant (15 oct.).
- Numéros : jamais réattribués ; anciens en « B » ; rien ne change tout seul.
- **Retiré** : réponse automatique aux messages Vinted (15 oct.), acceptation
  automatique des offres Vinted (5 oct.). Sur eBay : seulement le seuil natif.
- **Refusé définitivement** : republication en file avec délais aléatoires,
  pilotage souris/clavier, photos modifiées pour republier, suppression
  automatique d'annonce, messages en série aux favoris (§3).
- Jamais d'option payante (boost) dans une publication automatique.
- Abonnement 12,99 €/mois. Sur eBay, c'est l'acheteur qui paie le bordereau.
- VISUEL-01…20 abandonnés, APP-01 / APP-06 exclus, AGENT-K14 gelé.
- Les fonctions qui coûtent (IA, détourage) : jamais sur la clé de Julien pour
  les autres vendeurs (§2.9) — leur clé, ou sans IA.

## 9. Pièges de la reprise
Voir LIS-MOI §9. En plus :
- La matrice du 15 oct. et ce fichier décrivent un état ; **le code fait foi** —
  relis avant d'affirmer « fait » ou « pas fait ».
- `main` bouge aussi sous les branches `codex/…` d'un autre agent : ne pas
  défaire leur travail (vrai merge), mais la régression FONC-03 venait de là.
- Les 3 redémarrages de conteneur de la session du 16 oct. ont tué des
  workflows en plein travail : **commite et pousse souvent**, et garde les
  rapports d'agents dans le dépôt (`docs/passation/notes/`).
