# Favoris : corrections après la 5.410.7 — 21 nov. 2026 (ext. 5.410.8)

## Ce que Julien a vu (captures 09:37 et 09:42)
- « je ne peux pas sélectionner les favoris » : « Pas encore contactés 0 · Ignorés 27 », aucune case, mais « 1 coché » ;
  bandeau « Ces destinataires ont déjà été préparés… ». Sa file (mesurée, lecture seule) : groupe `active: true`,
  25 `annule`, 1 `attente`, 5 `envoye`, 1 `refuse` `vinted_robot` (ecrits 1).
- « l'onglet ouvert par VRM n'est pas bloqué, je veux que ce soit le cas ».
- Le message est parti mais AUCUNE offre (N°210, ni prix mini ni achat) : « je veux que tu fasses comme Bleam ».
- 2ᵉ export de l'Observateur : Bleam lit la cloche (`GET /inbox-notifications/v1/notifications`) avant chaque favori,
  3,8 s avant d'ouvrir la conversation ; son onglet de travail reste sur `/inbox` ; ses écritures sont des XHR.

## Causes et corrections
1. **File annulée lue comme « ignoré »** : `etatFavori` (src/favorisEcran.js) disait « pas envoyé » pour un job `annule`
   (et un refus `vinted_robot`), alors que la file du serveur (`connus`, api/_lib/favoris-file.js) les relance.
   `jobBloqueFavori` : un job annulé, un refus `vinted_robot` ou un refus avec `ecrits: 0` ne bloque plus ⇒ « à envoyer »,
   cochable. Un refus d'avant sans `ecrits` (pas su) reste « pas envoyé » à l'écran (prudence).
2. **Une file ACTIVE cachait la liste** (`apercuCarte` rendait `encours`) : la liste est rendue avec `file` ; le panneau dit
   « Une file d'envoi est restée ouverte chez VRM : N en attente · Reprendre · Annuler la file ». « Reprendre » (`continuer`)
   fait mener la file par ce navigateur ; « Annuler » = `arreter`. Avec des cases cochées, le bouton devient « Annuler
   l'ancienne file et envoyer à N » (`lancer` + `remplacer` : `arreter` chez VRM d'abord).
3. **« 1 coché » sans case** : une rangée refusée restait dans le choix. Le refus retire ses favoris du choix ; le compteur ne
   compte que les cases réellement là ; le tableau s'ouvre sans case cochée d'office.
4. **Onglet de travail voilé en permanence** : `marquerOngletTravail` pose un voile plein écran (titre, raison d'un refus,
   UN bouton « Tout arrêter » = la porte de l'écran plein), retient les gestes `isTrusted` de la personne (souris, clavier,
   molette, doigt), laisse passer ceux de VRM ; reposé à chaque page chargée (`tabs.onUpdated`) ; s'écarte devant une VRAIE
   vérification affichée (`vrmVerifVisible`). Ouvert sur `vinted.fr/inbox`.
5. **Offre toujours, comme Bleam** (`offreAvecPlancher`) : l'offre réglée part toujours ; le plancher (prix mini, sinon
   achat + 10 %) la REMONTE si elle tombe dessous ; sans plancher, au % réglé ; plancher au prix de l'annonce ⇒ pas
   d'offre. Un texte qui ANNONCE une offre (« offre », « {prix} », « réduc »…) ⇒ l'offre part AVANT lui (refus ⇒ aucun
   message). Le tableau dit « offre X € » (ou « remontée au prix mini ») sur chaque rangée.
6. **La cloche avant chaque favori** (séquence Bleam) : `GET /inbox-notifications/v1/notifications` depuis la page ; le
   favori doit être dans CETTE réponse (absent ⇒ ignoré `favori_trop_ancien`, rien d'écrit, dit sur la rangée) ;
   3,8–6,4 s au hasard avant d'ouvrir la conversation. `consommerFile` transmet `notificationId`.
7. **Écritures par XHR de la page** (`vintedPage`, méthodes ≠ GET), mêmes en-têtes et cookies ; lectures en fetch.

## Preuves
- `scripts/bancs/panneau-favoris-tableau.cjs` : 134 contrôles, dont la file de Julien calculée par la VRAIE règle du serveur.
- `scripts/bancs/onglet-travail-voile.cjs` (nouveau) : 24 contrôles (1512 clair/sombre, 390 doigt).
- `scripts/audit-onglet-travail.cjs` : 16 verts, 8/8 mutations. `audit-comme-bleam` : 42 verts (F6/F7/F8 réécrits, F12 =
  5 requêtes, F17–F19), mutations détectées. `audit-messages-malins` M6 réécrit (offre remontée), 12/12.
  `audit-favoris-ecran` : un refus `vinted_robot` jugé par le journal seul (il est relançable).

## Geste de Julien
Installer la 5.410.8.
