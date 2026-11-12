# 12 nov. 2026 — Favoris par compte, « Vintex » retiré, 8–20 s entre offre et message, suivi et codes des achats (ext. 5.372.0)

Branche `claude/agent2-favoris-compte`, partie de `origin/claude/agent2-ext-boutique` (5.371), puis **vrai
`git merge origin/main`** (7c94382c4, G2 : sécurité des comptes 5.366, Créer sur Vinted 5.367, Republier
programmé 5.368, Favoris clair). Pas de PR, pas de fusion sur `main`.

## Demandes de Julien (mot pour mot, relayées par le coordinateur)

- « il doit y avoir aucune erreur stp, de plus les messages aux favoris ne me conviennent pas je veux que ca soit
  par compte et pas par articles mais simplement la liste du plus recent (en haut) au plus vieux en bas, tu enleves
  ceux qui sont liés a des articles vendus et tu fait ça bien, avec la possibilité a cote de chaques favoris de
  cliquer dessus pour le selectionner pour envoyer un message, en ce qui concerne faire comme vintex je veux que tu
  enleves ca et que tu remplace par un autres nom, je veux aussi que tu espace le temps ou tu envoye l'offre et tu
  envoie le message car je cois qu'il est très faible je te laisse faire »
- puis : « peut-être moins de temps d'écart entre offre et message mais il doit être aléatoire et marqué quand même »
  (⇒ 8 à 20 s, pas 25–75 s) ;
- « tous les achats doivent avoir leur numéro de suivi comme ça on peut voir quand ils arrivent » ; le n° est dans le
  panneau « Détails » de la conversation (vinted.fr/inbox/{id}/details) ;
- « il ne peut pas y avoir de colis sans code de retrait, c'est pas possible ».

## La fusion de `main` (12 conflits de fond dans background.js, 16 au total)

Les deux systèmes de sécurité sont GARDÉS ensemble (aucun retiré) :
- `gardeStricte` (auto-fusionné) lit `opts.secu` (5.366, `secuGeste`) ET `opts.sorte` (5.370, `porteDiscretion`) :
  chaque appel passe les deux (baisse, republication, favori) ;
- file Vinted : `delaiFile` + prudence 5.357 + captcha 5.370 + `secuRetryAfterMs` ; `vintedPage` rend `viaPage`
  ET `retryAfter`, et appelle `secuObserver` ;
- offres auto : `secuGeste('vinted', uid, 'offre', 'auto')` posé avant `repondreOffre` (mémo relu de la 5.356 gardé) ;
- suppression Leboncoin : `secuRobotDit` + `secuGeste` PUIS la pause et le compteur 50/h de la 5.362 ;
- prix Leboncoin (5.363, main) : passé par le **canal privé** de la 5.362 (lbc-inject `surOrdre`/`versRelais`,
  lbc-relay `versCapteur`/`traiterCanal`) — sur main il passait par `window.postMessage` ;
- carte du logo : la phrase `secu` (5.366) + jauge, Réparer, rapport, file réseau (5.371) ;
- Favoris : l'écran « Favoris clair » de main + les versions du message (5.369) portées dessus ;
- BaissePrixSerie : la feuille Leboncoin de main + « Varier un peu » et l'étalement (5.370), Vinted seulement ;
- Republier : programmation (main) + petits groupes (12 nov.) ;
- `scripts/bancs/favoris-ecran.cjs` : supprimé sur main (remplacé par favoris-clair) — suppression gardée.
⚠️ Reste pour l'intégrateur : la coordination demandait « UNE prudence par compte » (5.357 et 5.366 posent chacune
la leur sur un 403/429) ; ici les deux coexistent, rien n'est perdu, mais ce n'est pas unifié.

## Ce qui change pour Julien

1. **Favoris (Messages → Favoris)** : « Tes favoris » = le compte ouvert sur vinted.fr d'abord, une liste simple
   du plus récent au plus ancien (date du favori lue de Vinted ; sans date ⇒ en bas, dit). Chaque ligne : photo,
   titre, qui (si Vinted le dit), « il y a 2 h », une case de 44 px. « Tout sélectionner » par compte ; le bouton dit
   « Envoyer N messages ». Les favoris d'un article **vendu** (preuve partagée, `articlesVendus`) ou **plus en
   ligne** (lecture complète < 24 h qui ne l'a pas) sont cachés (« 2 favoris d'articles vendus ou retirés :
   cachés ») ; lecture ancienne ⇒ « À vérifier : annonce pas relue », pas cochée par « Tout sélectionner ».
   On n'écrit QU'AU NOM du compte de l'onglet : les autres comptes sont en dessous (« Autres comptes »), à lire.
   Règle : `src/favorisParCompte.js` ; dessin : `src/FavorisListeCompte.jsx` ; `FavorisVinted.jsx` (QUI).
2. **« Vintex » n'apparaît plus nulle part** : « Rapide (6–10 s) » (favoris, 5 langues), « Rapide (8–16 s) »
   (Republier, déjà), « Aléatoire » et « Fixe » restent ; phrases de Pourquoi, réglages, erreurs
   (`reglagesFavoris.js`), progression. Identifiants internes (`'vintex'`, `RYTHME_VINTEX`) gardés : ils sont
   enregistrés dans ses réglages.
3. **Offre → message : 8 à 20 s au hasard** (avant 0,3–0,8 s), puis le temps d'écriture (5.369). L'app montre
   « Offre faite · message dans ~N s ». Tout arrêter, captcha, pause, autre compte, onglet fermé pendant l'attente
   ⇒ le message ne part pas (« « Tout arrêter » : offre faite, message pas parti »).
4. **Suivi des achats** : chaque achat en cours a son n° de suivi, son transporteur, son point de destination.
5. **Codes de retrait** : un colis arrivé dont Vinted dit encore « Colis expédié » (mais demande son geste) ou dont
   le suivi dit « disponible au point » a désormais sa conversation relue pour le code.

## Mesures et causes (suivi, codes)

- `capterSuivisAchats` (5.214) ne relisait que les achats dont le STATUT disait « expédié / en route / au point » ;
  un achat arrivé ou livré n'était plus JAMAIS relu, même sans n° ; un n° lu sur des étapes inchangées n'était pas
  écrit (`rangerSuiviUn` : `decisionSuivi` disait « inchangé »). Les trois trous sont fermés.
- Le n° vient d'abord de `journey_summary` (`current_carrier.tracking_code`) ; s'il manque, ou si l'achat n'est pas
  encore expédié, le **détail de la transaction** (`/api/v2/transactions/{tx}`) est lu et SEUL l'objet d'expédition
  (`shipment`, `shipping`, `parcel`…) est retenu : n°, transporteur, point de destination (commerce), arrivée
  estimée — jamais un nom ou un pseudo (`suiviDeTransaction`). Forme sans objet d'expédition ⇒ rien d'écrit, la forme
  rangée (`panel_formes_suivi.transaction`). ⚠️ La forme exacte du détail n'a pas été mesurée sur la vraie base ici
  (lecture seule, pas d'accès à vinted.fr) : si Vinted range le n° ailleurs, la ligne de forme le dira.
- Ordre : expédiés sans n° (au point d'abord), puis les autres sans n°, puis ceux qui l'ont ; à rang égal le moins
  récemment relu, puis le plus ancien. Bornes inchangées : 3 par visite, 6/h, sous la réserve de l'argent et des
  colis (budget de lecture 20/h), compte du cookie de l'onglet, GET seulement.
- `capterRetraits` (5.45) ne relisait que `AT_RELAY(status)` : cause des « Code à venir » sur des colis arrivés.
  Désormais aussi `needs_action` (pas fini) et suivi rangé = arrivée ; arrivés au point d'abord, plus ancien d'abord.
- Côté serveur, les conversations captées ne portent pas le n° : il n'est pas dans un message du fil mais dans le
  panneau « Détails » (transaction) — d'où la lecture du détail. Le placement sous le point relais côté app
  (`src/relaisColis.js` d'agent2-restes) n'est pas sur cette branche : le point de destination est rangé
  (`relaisNom/Rue/Cp/Ville`, déjà lu par l'app) ; l'unification d'écriture du lieu reste à l'intégration avec restes.

## Preuves

- `scripts/audit-favori-offre-message.cjs` (vrai background.js, horloge du banc) : 25 verts ; 5.371 ⇒ 19 rouges ;
  mutations [0,3–0,8] ⇒ 4 rouges, valeur fixe ⇒ 2 rouges, vérifications retirées ⇒ 6 rouges. Couvre : ordre offre →
  attente → écriture → message, 400 tirages (8–20, jamais deux fois de suite, 13 valeurs), Tout arrêter / captcha /
  429 / autre compte PENDANT l'attente, worker endormi puis repris par un worker neuf, reprise trop tard, places.
- `scripts/audit-suivi-numero-achats.cjs` : 18 verts ; 5.371 ⇒ 7 rouges ; mutations (n° neuf non écrit ⇒ 2,
  ancienne sélection ⇒ 2, ancienne sélection des codes ⇒ 2).
- `scripts/audit-sans-vintex.cjs` (esbuild retire les commentaires, 710 fichiers) : vert ; branche de départ ⇒ rouge.
- `scripts/bancs/favoris-compte.cjs` (390 tactile / 1512, clair / sombre, onglet sur le compte puis sur l'autre) :
  52 verts ×2 ; branche de départ ⇒ interrompu ; mutations ordre ⇒ 12, vendu ⇒ 14, onglet ⇒ 2, case ⇒ 1 rouge(s).
  Il a trouvé un vrai défaut : `setAnciensAussi` resté dans la remise à zéro (écran en erreur) — corrigé.
- Captures regardées (390 clair, 1512 sombre) : liste nette, « À vérifier » en ambre, cases alignées.
- `audit-suivi-vinted` remis à la règle 5.372 (un livré AVEC son n° n'est plus relu ; sans n°, il l'est ; ordre).
- `audit-ext-boutique` : la version lue dans le code (plus de « 5.371.0 » en dur). `audit-traduction` vert
  (clés `favoris.liste.*`, `favoris.quoi.autreVersion`, `oa.histo.version` en 5 langues).
- Comparaison des audits de l'extension avec la branche de départ : voir la fin de ce récit.

## Geste de Julien

Installer l'extension **5.372.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`),
garder vinted.fr ouvert : les n° de suivi et les codes arrivent au fil des visites (6 lectures de suivi par heure).
