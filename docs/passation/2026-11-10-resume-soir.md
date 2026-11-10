# Résumé du soir (lot AT) — 10 novembre 2026

Branche `claude/resume-soir`. Proposition 3 validée par Julien : vers 20 h, une notification
qui dit seulement ce qu'il y a à faire **demain**, avec un lien qui ouvre l'endroit.

## Ce qui a changé
- **Pas de deuxième notification** : c'est le « rappel de la veille au soir » (retenu le 11 oct.)
  qui est amélioré — même cron (`/api/rappel-soir` → `ship-reminders?moment=soir`, 18:00 UTC),
  même catégorie `soir`, même mémo `soir_reminder_dedup` (une par soir). Aucun cron ajouté,
  toujours 12 fonctions.
- Ce qu'elle dit (`api/_lib/resume-soir.js` décide, `texteSoir` d'`api/_lib/notif-apercus.js` écrit) :
  - colis dont la date limite **LUE** tombe demain (e-mail du bordereau, eBay, Vestiaire), avec
    l'heure la plus proche lue (`compterEcheances` → nouveau `premierLu`) ; ceux déjà en retard ;
    les dates **estimées** passées (« vérifie sur Vinted », jamais « en retard ») ; une limite
    estimée qui tombe demain n'est PAS dite (un plancher, pas une date) ;
  - colis à retirer dont le dernier jour **lu** est demain : la règle du matin
    (`rappelsRetraitDuJour`, nouvelle option `jourCible: 1`), extraite en `retraitsDuJour` partagé ;
  - offres **Vestiaire** reçues, à trancher, qui expirent avant demain soir (`offresVestiaire`
    de l'app, Solo respecté). Vinted : rien (ses offres n'expirent pas, Julien 5 nov.).
    eBay : les offres reçues ne sont pas rangées en base (lues en direct) ⇒ pas dites.
- **Rien demain ⇒ rien ne sonne** (rien mémorisé non plus). Un colis dû dans 4 jours n'est plus dit.
- Lien : Colis (prêts) s'il y a des colis ; sinon la carte du colis à retirer (seul) ou la colonne
  « À retirer » ; sinon Messages · Vestiaire (`DESTINATIONS.vcOffres`, nouveau). Bouton « Ouvrir ».
- Forme : `sendPushToAll` (`api/_lib/push.js`, `embellir`) — titre ≤ 40, sans emoji. Exemples :
  « Demain : 2 colis à déposer » / « 1 colis à déposer avant 23 h 59 demain. 1 déjà en retard :
  dépose-le en premier. » ; « Demain : 1 retrait, 1 offre ».
- Pas su : ventes Vinted illisibles ⇒ rien (comme avant) ; eBay/Leboncoin/Vestiaire illisibles ⇒
  « au moins », nommés ; bordereaux illisibles ⇒ « Vinted pas relu » ; retraits ou offres
  illisibles ⇒ pas dits, le cron le rapporte (`retraits: 'pas su'`).
- Dimanche : inchangé — le bilan de la semaine part toujours au même passage, le résumé ne
  reprend aucun chiffre de la semaine.
- Heure : laissée à 18:00 UTC (20 h l'été, 19 h l'hiver, décalage Hobby ≤ 1 h). La passer à
  19:00 UTC donnerait 21 h l'été et risque les heures calmes : non fait.

## Preuves
- Banc `scripts/bancs/rappel-soir.cjs` (EXÉCUTE la vraie route + le vrai widget, base cloisonnée
  à deux vendeurs) : 28/0. Sur `origin/main` (git archive) : **12 rouges**.
- Mutations (9/9 rouges) : rien demain sonne quand même (5), limite estimée = lue (6), retrait
  sans jour cible (2), offre plus tardive comptée (2), offre envoyée comptée (2), lien Vestiaire
  avant le retrait (1), heure prise sur une estimée (1), sans mémo du jour (2), eBay illisible
  dit complet (1).
- `audit-colis-heure` mis à la règle (mêmes faits, nouveau texte) : 32/0 ; `notifs-apercus` 30/0
  (capture regardée : iPhone, Android, macOS) ; `audit-suivi-colis` (mutations du rappel du matin
  intactes), `audit-cibles-notif`, `audit-notifs-belles`, `audit-fonctions-api`, `audit-offres-expirent`,
  `audit-variables`, `tdz`, `coherence`, `identite`, `icones` : verts.
- `audit-a-envoyer-preuves` : 2 rouges **déjà sur origin/main** (dépôt Mondial Relay), pas ce lot.

## Geste de Julien
Aucun.
