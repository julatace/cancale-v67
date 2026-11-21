# 8 nov. — Le bordereau d'une vente vue par e-mail, prêt à imprimer tout de suite (branche `claude/bordereau-des-email`)

## La demande (Julien, 8 nov., mot pour mot)
« Tu envoies une notification comme quoi le bordereau est arrivé. Donc quand tu reçois le mail de la
vente, tu reçois aussi le bordereau : tu peux directement mettre le bordereau de la paire, et si tu
n'as pas le numéro tu ne mets pas le numéro, mais tu peux déjà commencer le tamponnage avec son numéro
si le gars n'a pas eu le temps de relancer l'extension. »

## Mesuré avant (banc `bordereau-des-email`, dist de `claude/amazing-lovelace-xd7obl`)
Vente vue par e-mail (n° 62100099, compte dont la liste Vinted date d'hier) + e-mail de SON bordereau
(même n°, PDF) :
- **Colis** : aucune carte pour elle (« À envoyer » = la seule vente Vinted 62000) ; `vrm_colis_prets`
  = 1 à imprimer sur 1. Le bordereau n'était rattaché à rien : `bordShipped` « vente inconnue : on ne
  conclut pas », `expeditions` ne lit que la liste Vinted, et le diagnostic « bordereau sans vente »
  n'est plus affiché depuis le 30 sept. (sa décision) ⇒ **imprimable nulle part**.
- **Ventes** : la ligne « Vue par e-mail » existait, sans aucun geste d'envoi (choix du 6 nov.).
- **Ma journée** : 1 colis à envoyer (pas 2).
- **Le tampon** : s'il avait été imprimé depuis la liste des bordereaux, `numForBord` aurait admis le
  `numero` de la ligne — que le serveur remplit aussi PAR TITRE (`findNumeroByTitle`, `parTitre`) :
  un N° deviné. La notification du serveur nommait ce même N°.

## Ce qui change
**La règle** — `src/bordereauVenteEmail.js` (pure) :
1. `colisVentesEmail` : une vente `_venteEmail` dont le bordereau (avec PDF) porte le **MÊME n° de
   transaction** est un colis à envoyer. Rien si : autre n°, pas de PDF, la liste Vinted porte le n°
   (sa ligne gagne, sa règle `aExpedier` fait foi ⇒ une vente annulée sort), vente masquée, colis
   parti (`isBordDone` : les preuves de `api/_lib/depart-vente.js`, « expédié », panneau).
2. `decisionNumeroVenteEmail` : le N° seulement par identité sûre — posé à la main sur la transaction
   (`vinted_sale_overrides`), « Relier » (`vinted_bord_links`), l'annonce de la transaction (identité
   Vinted captée `labelsCaptes[tx].item`, ou `resolvedEntry` : `txnItem`/photo exacte), le N° **écrit
   par lui** dans le titre de l'annonce (« … n12 » présent dans `article` de l'e-mail du bordereau,
   `numeroEcritDansArticle`, + `numeroEmailAdmis` après la remise à zéro), ou — réglage « je numérote
   moi-même » — le N° du titre de la vente (`lireNumeroEcrit`, après la coupure). **Jamais** le
   `numero` de la ligne s'il n'est pas écrit dans le titre reçu (= retrouvé par ressemblance). Deux
   sources différentes ⇒ aucun N°.
3. `phraseImprimeSansNumero` + registre `vrm_bords_sans_num` (synchronisé, `SYNC_KEYS`) : un bordereau
   Vinted imprimé SANS N° (lot, carte Colis, ligne de Ventes) le reste écrit sur sa carte —
   « Imprimé sans N° — à écrire à la main », ou « … — écris N° 12 sur l'étiquette » quand un N° sûr est
   apparu depuis (relecture de l'extension).

**L'app** (`src/App.jsx`, `Comptabilite`) :
- `expeditionsCalc` ajoute ces colis (`venteEmail: true`) ⇒ `lignesLot`, « Tout imprimer »,
  `compteAImprimer`/`vrm_colis_prets`, la carte « à imprimer », les colonnes : la même liste.
- `toShip` les compte (Ma journée, la cloche `vrm_colis_aposter`, la Tournée, la photo hors ligne).
- `numForBord` : un bordereau dont la vente n'est connue que par e-mail passe par la décision AVANT
  tout `b.numero` ; `effEntry` d'une ligne `_venteEmail` rend la décision (contredit ⇒ aucun N°). Tous
  les tampons (carte, lot, Ventes, Réimprimer) passent par là, et `confirmerNumerosAVerifier` reste
  sur le chemin (`annotateAndDownloadBordereau` / `mergeAndDownloadBordereaux`).
- Carte Colis : `data-colis-vente-email`, `data-colis-num`, mention « Sans N° : à écrire à la main »
  (`data-colis-sans-num`), « Imprimé sans N° » (`data-imprime-sans-num`) ; le litige « l'email disait
  N°x » n'est pas montré pour elle (la décision tranche déjà).
- Ventes : la ligne « Vue par e-mail » porte « Imprimer le bordereau » (`data-fu-imprimer`) quand elle
  est dans « à envoyer » (`toShipEmailTx`) ; jamais « Déposé » ni glisser ; le filtre « À envoyer »
  la montre (`estColisEmail`), « En route » jamais.
- Photo hors ligne de Ma journée : le N° d'une vente e-mail est la décision (plus le `b.numero` brut).

**Le serveur** (`api/email-inbound.js`) : la notification « Bordereau prêt » ne nomme que le N° LU
dans l'e-mail (`numeroLu`), jamais celui retrouvé par titre.

## Ce qui ne change pas
- Une vente e-mail SANS bordereau : la ligne de Ventes seule, aucun geste (comme le 6 nov.).
- Un bordereau dont la transaction n'est connue de rien (ni liste ni e-mail de vente) : toujours pas
  une carte de Colis (décision du 30 sept., « les mails doivent juste servir de sécurité ») ; la
  ligne et l'e-mail restent dans E-mails. Rien n'est supprimé.
- Les ventes de la liste Vinted : `numForBord` inchangé (⚠️ il admet toujours le `numero` de la ligne
  après `numFromTxn` — un N° retrouvé par titre peut encore tamponner un bordereau dont la vente n'a
  pas d'identité ; pas touché ici, voir « Limites »).

## Limites (dites)
- **Widget / rappels / bilan (serveur)** ne lisent pas les ventes e-mail : tant que la liste Vinted
  n'est pas relue, le widget compte un colis de moins que Ma journée. (La notification, elle, part.)
- Les anciennes lignes de bordereau ne disent pas d'où vient leur `numero` : on le reconnaît « écrit »
  seulement s'il est dans le titre reçu (même expression que le serveur).
- `numForBord` des ventes connues de Vinted admet encore `b.numero` (titre) en dernier recours.

## Preuves (§6)
- `scripts/audit-bordereau-des-email.cjs` — 41 contrôles, la règle EXÉCUTÉE et `numeroVenteEmail`
  extraite de l'app et lancée : 50 ventes e-mail au même titre dont chaque bordereau porte un N°
  retrouvé par titre ⇒ **aucun N°** ; chacune son « nK » ⇒ chacune SON K ; posé ≠ écrit ⇒ aucun ;
  câblage (Colis, `toShip`, `numForBord`, `effEntry`, filtre, bouton, notification). `--prouve` :
  **10/10 mutations attrapées**. Sur `claude/amazing-lovelace-xd7obl` (git archive) : **22 rouges**.
- `scripts/bancs/bordereau-des-email.cjs` — 390 tactile et 1512 : Colis carte « prête », sans N° (le
  30 deviné ne sort pas), `vrm_colis_prets` 2/2 ; Ventes « Imprimer » sur la ligne e-mail + mention ;
  Ma journée 2 ; N° écrit « n12 » ⇒ 12 ; liste relue annulée ⇒ aucune carte, 1 à imprimer.
  imprimé sans N° puis N° 44 posé sur la transaction ⇒ la carte dit « Imprimé sans N° — écris N° 44 ».
  **26 verts** ; sur le dist de départ : **16 rouges**. Captures regardées (Colis 390/1512, Ventes
  390/1512). (Défaut trouvé à 1512 : le registre « imprimé sans N° » arrivait avec le nuage après le
  montage — branché sur `onCloudReady` comme `vinted_bords_printed`.)
- Audit retouché (la décision a changé, pas affaiblie) : `audit-vente-email-fraiche` F8 (« à
  expédier » seulement avec SON bordereau, jamais « Déposé » ni « en transit »).
- Verts : `npm run build`, `audit-identite`, `audit-statuts`, `audit-a-envoyer-preuves`,
  `audit-coherence`, `audit-variables`, `audit-tdz`, `audit-vente-email-fraiche`,
  `audit-fonctions-api`, et les **96** audits qui parlent de tampon/bordereau (tous verts).
- Bancs verts : `bordereau-des-email`, `vente-email-fraiche` (390/1512 clair, 32 verts),
  `a-envoyer-preuves` (34 verts).

## Geste de Julien
Aucun.
