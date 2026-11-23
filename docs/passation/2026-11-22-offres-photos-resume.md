# 22 nov. 2026 — Offres sans réponse, photo en double, résumé du mois par e-mail (choix n° 33, 35, 36)

Branche `claude/offres-photos-resume`, partie de `claude/integration-finale`. Aucune fonction `api/` ajoutée (12), extension non touchée.

## 33. Offres reçues restées sans réponse
- Règle pure `src/offresSansReponse.js` : ne juge AUCUNE offre. Vinted = la règle du fil (`offreVintedEnAttente`, statut 10 de l'acheteur,
  déjà lue par `fetchOffresConversations`) ; sortent : acceptation / refus confirmés (`offresConfirmees`), annonce PROUVÉE partie
  (`offreOuverte`), côté acheteur, et un message de LUI daté après l'offre (« il a réagi »). Date pas lue ⇒ l'offre reste (pas su ≠ oui).
  Vestiaire = `offresVestiaire(...).aTrancher` (à toi, pas expirée). eBay et Leboncoin : aucune offre rangée en base ⇒ NOMMÉS en pied
  (« Pas lus ici »), jamais « 0 ». Ordre : la plus ancienne d'abord ; « il y a 2 h », « hier », « il y a 3 j ».
- Prix de l'annonce, SON prix mini, plancher (`plancherVente`) : la fiche par l'identité de l'annonce (`numeros[item]`), jamais le titre.
  Note de l'acheteur : `feedback_reputation` / `review_count` ajoutés à la projection `OFFRES_CONV_SELECT` (règle `naNote`).
- Écran : Messages · Offres, en tête (`src/natif/ecrans/OffresSansReponse.jsx`) ; un toucher ouvre le PANNEAU de l'extension
  (`ouvrirPanneau`, page `offres`, l'id de la conversation ou de l'offre Vestiaire) — aucun geste d'offre dans l'app.
  Aujourd'hui : « N offres sans réponse › » (ambre), vue `offressansreponse` ⇒ Messages · Offres. Les offres sont aussi lues sur
  Aujourd'hui (même lecture légère `cs.` statut 10, au plus une fois par minute).

## 35. Même photo sur deux annonces
- Règle pure `src/photoEnDouble.js` : la règle d'identité existante (`photoKey` d'App.jsx = dossier + fichier exact, ou `photoK` de la
  fiche) sur les annonces Vinted EN LIGNE (<enligne-regle>). Rien n'est modifié ni relié. Écartés : N° en plusieurs exemplaires
  (stock auto, quantité ≥ 2 dans `vinted_bleam.comptes[uid].stockAuto.stock`), groupes refusés (« Ce n'est pas un doublon »,
  `vrm_photo_double_non`, dans SYNC_KEYS, par groupe d'ids — une annonce de plus au même fichier ⇒ signalé de nouveau).
- Annonces : segment « Doublons » (filtre « Photo » à l'ordinateur), vue `src/natif/ecrans/PhotoEnDouble.jsx` (titre court N°…,
  la question entière en première rangée, « Ce n'est pas un doublon »). Aujourd'hui : « Même photo sur deux annonces › ».
- Non fait : Leboncoin / eBay / Vestiaire (leurs photos ne sont pas des fichiers Vinted ; « Même photo » entre sites existe déjà
  par empreinte, src/memePhoto.js). L'ancienne carte « en ligne deux fois » de Ma journée (src/enLigneDeuxFois.js) est inchangée.

## 36. Résumé du mois par e-mail
- Le bilan du mois existait (api/_lib/bilan-mois.js, 8 nov.). Ajouté, par les règles serveur EXISTANTES : colis non retirés
  (`vrm_colis_retirer` publié par l'app, relu par `retirerPublie`), montant à déclarer à l'URSSAF (`notificationUrssaf`, qui rend
  désormais aussi `partiel`, `label`, `dueIso`), lien vers Argent (onglet compta, inchangé). `main` lu projeté (`MAIN_RESUME`).
- ⚠️ Défaut changé (décision du 22 nov.) : jamais choisi ⇒ allumé SEULEMENT si l'envoi est configuré (`choixEffectif(choix, configure)`),
  au lieu de « compte créé depuis le 13 nov. ». Conséquence : les comptes d'avant le 13 nov. sans choix le recevront dès que
  RELANCES_SMTP_* est posé. Paramètres dit « l'envoi d'e-mails n'est pas réglé » sinon (textes par tr()).
- Un envoi par mois (réservation `bilan_mois_envois[AAAA-MM]` avant l'envoi) ; réservation ratée ⇒ rien, rejoué au passage suivant ;
  la fin d'un refus SMTP est réécrite une fois si elle rate (sinon le mois restait « en cours »).

## Preuves
- `scripts/audit-offres-sans-reponse.cjs` (18 verts, `--prouve` 7/7), `scripts/audit-photo-en-double.cjs` (17 verts, 5/5 ; 50 annonces au
  même titre sans même fichier ⇒ aucun signal), `scripts/audit-bilan-mois.cjs` (51 verts, `--prouve` 8/8, mutations réparées).
- `scripts/bancs/resume-mois.cjs` EXÉCUTE le vrai cron (`api/ship-reminders.js`) et la route de Paramètres (`api/compte.js`) avec un faux
  SMTP local : 19 verts ; `--mutations` 5/5 ; 12 rouges sur l'arbre d'avant.
- `scripts/bancs/offres-photos.cjs` (outils/offres-photos/) : 390 tactile et 1512, clair et sombre, 78 verts ; rouge sur l'arbre d'avant.
- Verts : audit-identite, audit-urssaf, audit-fonctions-api, audit-quoi-de-neuf, audit-traduction, audit-rappel-urssaf, audit-icones,
  audit-mails-envoyes, audit-coherence, build. `audit-aujourdhui` S6 rouge AVANT ce lot aussi (déjà sur la base).

## Geste de Julien
Aucun pour 33 et 35. Pour 36 : poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` (déjà dans la liste) — sans eux rien ne part.
