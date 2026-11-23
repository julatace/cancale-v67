# 23 nov. · Vestiaire complet : capture réparée, panneau refait, achats partout (lot vestiaire-complet, extension 5.444.0)

Branche `claude/vestiaire-complet` (worktree `/home/user/wt/vc-complet`), partie de `claude/lots-vestiaire` (5.443, PR #1311
pas encore fusionnée). Version réservée **5.444.0** (après 5.441 / 5.442 / 5.443). Aucune écriture en base réelle, aucune
donnée réelle dans le dépôt (captures de Julien regardées, jamais copiées).

## ÉTAT À LA REPRISE

- Code, audits, bancs et récit poussés sur la branche. PR : voir la fin de ce fichier (ouverte après les bancs du soir).
  **Aucune fusion avant le 24 nov. 07:00 UTC** (gel), et seulement après #1311 (5.443) et les 5.441/5.442 si elles passent ;
  sinon prendre la plus haute version servie + 1 (CODE_VERSION, manifeste, lbc-inject/lbc-relay, extension-version.json, Orion
  txt, EXT_ATTENDUE, EXT_CAPACITES `vcexamen` `vcfrise` `vcnotifs` `achatspanneau`, §8, `node scripts/zip-extension.cjs`).
- Pour fusionner : `git merge origin/main` (vrai merge) ; CLAUDE.md < 60 000 ; build + passe d'audits + CI comparée job par job.
- Gestes de Julien : installer 5.444.0 ; sur vestiairecollective.com (connecté sur son compte) ouvrir une fois **Annonces**,
  **Ventes** (et cliquer chaque vente, dont celle en litige : la frise et le litige arrivent à ce moment), **Commandes**, la
  **cloche** (Mises à jour) et la **messagerie**. Pour « Faire une offre » depuis le panneau : faire UNE offre soi-même à une
  personne qui a aimé (notification « vient d'aimer ») ; pour « Écrire » : répondre une fois soi-même dans la messagerie.

## 1. Diagnostic (mesuré en base, lecture seule, projections scalaires, 23 nov. ~13 h UTC)

| symptôme (captures de Julien) | cause mesurée |
|---|---|
| Articles « 0 article · 3 lues sans compte · mis à jour il y a 21 j » | `vc_listings.capturedAt` = 2 nov. ; `panel_diag_capture` (5.439, ce jour) : **`vc_format_inconnu_annonces` ×4** ; `vc_listings.formeInconnue` = `data[].type`, `data[].unpublishedSubmitted.product.*`. Une annonce **« En cours d'examen »** (enveloppe `unpublishedSubmitted`) faisait tomber TOUTE la page « Mes articles » en forme inconnue (une seule enveloppe illisible ⇒ `every` faux ⇒ rien). Plus rien rangé depuis ⇒ les 3 annonces gardent `compte: ''` (lues le 2 nov., avant que le compte de l'onglet soit su) ⇒ « sans compte ». Le `type` ne recopie vraisemblablement pas le nom de la clé (casse/tirets) : la règle accepte maintenant les deux. |
| Commandes : statuts faux (vente livrée en litige « À expédier », une autre « En route ») | la règle du PANNEAU était à part : `aExpedier === true` d'abord (resté vrai depuis la liste « à expédier » du 2 nov., jamais relue en entier), puis le mot `IN_PROGRESS` ⇒ « en route ». L'app, elle, appliquait déjà « l'état le plus frais gagne » (`aExpedierVc`, frise lue le 23 nov. : `sellerShipment/Delivery: done`, `sellerConformity: ongoing`). |
| Commandes sans photo, prix « — » | photo : la vignette du panneau n'acceptait que `vinted.net` ; prix : rangé `{ valeur, devise, cle }` (`sellerPrice` / `sellerEarning`), lu comme `amount`/`value` ⇒ null. |
| Messagerie « aucune conversation lue » | **103** conversations rangées dans `vc_messages` (capturées ce jour, Stream + fil des notifications), chacune SOUS son identifiant `{personne}-{article}` ; `ref` (référence VRM-…) vide pour toutes. Le panneau filtrait sur `ref` ⇒ 0. |
| Favoris « personne n'a encore été vu » | les aimés SONT captés (`vc_aimes` : 5 articles, compte 37…, ce jour ; personnes gardées dans le navigateur) ; le panneau ne montrait un article que s'il était rangé dans `vc_listings` sous CE compte ⇒ bloqué par la panne des annonces (compte `''`), et un article jamais lu (l'annonce en examen) ne pouvait pas apparaître. |
| Notifications « 0 sur 7 jours » | l'onglet ne montrait que le journal de VRM (refus, ventes, codes…) filtré sur Vestiaire ; la cloche de Vestiaire n'était pas lue comme notifications (seulement pour les aimés et les messages). |
| Litige « l'acheteur a signalé un problème, paiement mis en attente » | `vc_ventes` : `72987282` et `73402461` portent toutes deux `statutVc: conformityInProgress`, `sellerConformity: ongoing` ; rien ne dit lequel est un litige — la frise ne gardait que le statut de chaque étape (ni date, ni clé, ni texte). **Pas su** à ce jour ⇒ rien n'est deviné ; la 5.444 garde désormais la frise complète et lit le problème sur la clé ou le texte de Vestiaire. |
| Achats (« Commandes », `section=1`) | `ots/orders` (MESURÉ, vide chez lui : `{ meta: { count: 0 } }`) n'était pas reconnu comme liste d'achats ⇒ aucune ligne `vc_achats`. |
| Bonus trouvé par l'audit | « En cours d'examen » (`unpublishedSubmitted`) était rangé en **« retirée »** par la règle de modération (5.439 : « unpublish » ⇒ retirée, testé avant « submitted » ⇒ attente), dans l'extension ET l'app (`VC_ANNONCE_ETATS`). |

## 2. Ce qui change

### Capture (vc-inject.js, dans la page, compte de l'onglet ET de la page — rien de nouveau envoyé à Vestiaire)
- `cleEnveloppe` / `tableauAnnonces` : l'enveloppe est la clé nommée par `type` OU la seule clé objet qui porte un `product` ;
  son NOM est le statut. Une page où certaines enveloppes restent illisibles garde les annonces lisibles, compte les autres
  (`inconnues`, forme gardée) et n'est jamais « entière » (rien retiré sur elle).
- `fraseEtapeVc` : la frise de `contents/timeline/seller` dans l'ordre de Vestiaire (`stepsChronology`) — statut, date
  affichée, `messageKey`, titre ; le TEXTE de Vestiaire seulement pour une étape en cours ou annulée (240 car., e-mail et
  longs numéros masqués) ; `probleme` = la clé ou le texte DIT un problème signalé / un paiement mis en attente (5 langues).
- `noteNotifsVc` : la cloche (`notification-feed`) — id, date, lue, mots machine, article, photo de l'article, sorte
  (aime · message · autre) ; jamais le texte de la carte, ni un pseudo, ni un avatar.
- Aimés : la photo de l'article de la carte ; `ots/orders` reconnu comme liste d'achats (vide connu = « aucun achat » daté).

### Fond (background.js)
- `rangerVcTimeline` range `friseVc` et `litigeVc` (`litigeDeFriseVc`, **même règle** dans `api/_lib/vestiaire-regle.js`).
- `rangerVcNotifs` : la cloche gardée dans CE navigateur (`vrmVcNotifs`, 150), jamais en base ; `notifVcUtile` ne montre
  qu'un aimé, un message ou une carte dont les mots machine disent vente/commande/offre/prix/colis/paiement/modération.
- `vrmVcAimesInfos` : l'article aimé appartient au compte de SA notification (compte de l'onglet ET de la page) ; le panneau
  et `offrirAuxAimesVc` s'en servent quand « Mes articles » ne l'a pas rangé sous un compte (jamais à un autre compte).
- `carteListesSite` (Vestiaire) : statuts d'annonce par famille (`statutCarteVc` : en ligne, en cours d'examen, à corriger,
  refusée, vendue, retirée…) ; ventes par `etatVenteVcCarte` (**copie de la règle de l'app**, `<vc-etat-carte-regle>` :
  l'état le plus frais gagne, puis payée · litige · validée · livrée/évaluation · expédiée · vendue) avec photo, réf.
  (productId), prix (`sellerPrice`) et « pour vous » (`sellerEarning`), suivi, frise ; conversations par leur identifiant ;
  achats (`vc_achats`) ; notifications du site. Vinted : achats (`harvest_{uid}_orders_purchased`, état du colis :
  « à retirer » seulement par `AT_RELAY` = `isAtRelayStatus`) ; Leboncoin : achats « pas encore lus » (dit).
- `offreAimesCarte` : « Faire une offre » depuis le panneau = `offrirAuxAimesVc` (SON clic CONFIRMÉ, recette apprise et
  rejouable, prix lu = celui de l'aperçu, garde du prix, onglet sur CE compte, porte des favoris, 45/h réserve 5, pause
  429/403, une personne à la fois, 40–90 s entre deux).

### Panneau (vrm-badge.js, vrm-ui.js — style actuel, gris clair, pas d'orange, ambre seulement pour un geste à faire)
- Barre : **Ventes** (plus « Commandes »), **Achats** (nouvelle page, toutes plateformes ; au téléphone dans « Plus »).
- Articles : filtre Statut avec « En cours d'examen », « À corriger », « Refusée », « Retirée » (montrés s'il y en a).
- Vestiaire · Ventes : une carte par vente (photo, réf., prix + « pour vous », état en mots, « En litige · Vestiaire
  examine » en ambre) ; la fiche : transporteur, suivi, la frise datée et le texte de Vestiaire, la note « rien n'est
  compté comme reçu » pour un litige.
- Achats : état du colis (à retirer · en cours · terminé · annulé) + le texte du site.
- Favoris (Vestiaire) : « Écrire » (conversation de la personne) et « Faire une offre » (prix tapé par lui, confirmation)
  seulement avec la recette apprise ; sinon une phrase dit comment l'apprendre.
- Notifications : « Sur Vestiaire » (Quelqu'un a aimé · article, Message, Vente…) au-dessus du journal de VRM ; publicités
  comptées. Textes en 5 langues.

### App
- `etatVenteVc` : clé `litige` (« En litige · Vestiaire examine », ton action) ; `argentAVenir` : litige à part (hors total).
  Le CA déclaré et le reçu n'en comptent jamais (pas versée). « En cours d'examen » rangé en attente (plus « retirée »).
- Achats Vestiaire : l'écran Achats lisait déjà `vc_achats` ; il se remplit dès que « Commandes » est ouverte.

## 3. Preuves

- `node scripts/audit-vc-complet.cjs` : **21 ✅** ; sur le code d'avant (5.443, `--src/--inject/--relais`) : **18 ❌ sur 20** ;
  `--prouve` : **9/9** mutations rougissent (enveloppe stricte, page entière ou rien, problème ignoré, `aExpedier` seul,
  messages par `ref`, litige ignoré, aimés sans compte de notification, `needs_action` = à retirer, publicité montrée).
- `audit-vc-moderation` 29/29 (mot `unpublishedSubmitted` ajouté aux 16 mots comparés extension/app).
- Voisins verts : coherence, vc-ecrire, capture-vc-lbc, vc-messages, vc-conversations, vc-annonces-une-fois,
  vestiaire-a-expedier, vestiaire-partout, lbc-vc-lecture, carte-listes, vc-offres, lien-vc, quoi-de-neuf.
- Bancs (23 nov. soir, via lourd.sh) : `vestiaire-complet-panneau` **47 ✅** (sur la 5.443 : **30 ❌ sur 35**) ;
  `grand-panneau-sites` 112 ✅ ; `panneau-telephone` 199 ✅ ; `grand-panneau` : 6 ❌ « Automatisations : la liste… » déjà
  présents sur main (lot/brouillons de la 5.438 pas dans l'attendu), sans lien. Captures regardées : 1512 et 390, clair et
  sombre (`scripts/bancs/captures/vestiaire-complet/`) — corrigés après regard : l'état d'une vente passe en tête de la ligne
  (il était coupé au téléphone), le formulaire d'offre sous les boutons (il étirait « Personne 1 »), « Oui, envoyer l'offre ».
- Trouvé en route par `audit-panneau-carte` : **répondre sur Vestiaire depuis le panneau** cherchait aussi la conversation
  par `ref` (vide) ⇒ « autre compte, rien n'est parti » pour toutes : corrigé (par l'identifiant), audit porté sur la forme
  réelle. `audit-panneau-sans-vrm` : les liens « Gérer dans VRM » ajoutés ont été retirés (règle du panneau).
- Build vert. Passe complète (`lancer-audits`, 834) : 34 rouges avant ces deux corrections, dont 32 sans lien avec ce lot
  (mêmes familles que la passe de lots-vestiaire sur l'arbre de main : boutons natifs, paramètres, plans, Safari, vocabulaire…).

## 4. Ce qui reste (et pourquoi)

- **Le litige de Julien** : visible seulement après qu'il ouvre la vente sur Vestiaire avec la 5.444 (la frise est lue à ce
  moment). Si Vestiaire écrit le problème sous une clé ou des mots non reconnus, `probleme` reste `false`/`null` (jamais
  deviné) : la frise et son texte seront quand même affichés, et la clé (`cle`) rangée permettra d'ajuster la règle.
- Achats Leboncoin et eBay : aucune capture n'existe (pas de ligne en base) ⇒ « VRM ne lit pas encore tes achats sur … »,
  avec le lien vers VRM → Achats. Achats Vestiaire pleins : forme jamais vue (lus par noms de clés, sinon « pas su »).
- Le motif d'annulation (« Vente annulée car : … ») : affiché s'il est dans le texte de l'étape annulée ; pas de champ dédié vu.
- La forme réelle des notifications « vente / commande » de Vestiaire n'a pas été vue : rangées « autre » et montrées
  seulement si leurs mots machine le disent ; la publicité est comptée.
