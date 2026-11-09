# 9 novembre 2026 — Supprimer mon compte, clients partis, politique de confidentialité (RGPD)

Branche `claude/rgpd-compte` (depuis `origin/main`), poussée à chaque commit, **pas mergée**.

## Pourquoi
Des vendeurs payants arrivent : le droit à l'effacement (RGPD art. 17) doit être un bouton
qui marche, et la politique de confidentialité doit dire les durées que le code tient vraiment.
« Fermer mon compte » (5 oct.) existait ; il est devenu « Supprimer mon compte », avec une
confirmation forte et une seule fonction d'effacement partagée avec le départ des clients partis
(ajout validé par Julien pendant le chantier).

## Ce qui a été fait

### Le serveur — `api/compte.js?mode=supprimer` (l'ancien `?mode=fermer` mène à la même fonction)
- `GET` : l'**inventaire** (nombres de ce qui partirait et de ce qui resterait), rien n'est touché.
- `POST` : gardes, dans l'ordre, chacune refuse **sans rien toucher** :
  session prouvée par Supabase · UUID, jamais le neutre · clé de service ·
  **jamais le propriétaire de l'installation** (`VRM_OWNER_UID`, `vrm_acces`, ET `vrm_reglages` ;
  « pas su » ⇒ refus) · **confirmation forte jugée par le serveur** (`api/_lib/suppression-compte.js`) :
  « SUPPRIMER » tapé **et** (mot de passe vérifié par Supabase pour le compte du jeton, **ou**
  connexion de moins de 10 minutes lue dans `amr` du jeton déjà validé — le chemin d'un compte
  Google/Discord sans mot de passe) · **inventaire** (une lecture ratée ⇒ rien) · abonnement
  arrêté chez Stripe d'abord (muet ⇒ rien ; rejoué ⇒ « déjà résilié », pas de second appel).
- L'effacement : `effacerCompte` (`api/_lib/effacer-compte.js`), la **même** fonction que le cron.
  Ordre : photo de profil privée, preuves d'adresse, **index des jetons** (adresse de réception,
  widget, SMS — n'étaient pas effacés avant), file des favoris, **signalements** (chez le
  propriétaire, `data->>de` — pas effacés avant), mise de côté des factures Pro, ses lignes
  `app_data` **sauf** `email_invoice_*`, comptes Vinted, compteurs, équipe, communauté, photos
  détourées, puis le compte de connexion **en dernier** (404 = déjà parti ⇒ rejouable).
- **Ce qui est gardé** : ses **factures Pro** émises (`email_invoice_*`, pièces comptables,
  art. L123-22 C. com.) restent 10 ans sous son identifiant, sans accès ; une ligne neutre
  `vrm_factures_gardees_{uid}` dit jusqu'à quand ; `purgerFacturesGardees` (cron du matin) les
  efface à l'échéance. Les factures de l'abonnement VRM restent chez Stripe (VRM ne supprime pas
  le client Stripe). Un **journal minimal** `vrm_suppression_{sha256(uid)[:32]}` (neutre) : date,
  issue, nombres — ni e-mail ni identifiant ; purgé au-delà de 3 ans à chaque nouvelle suppression.
- **E-mail de confirmation** (gabarit `api/_lib/mail-gabarit.js`) si `RELANCES_SMTP_*` est posé et
  l'adresse confirmée ; sinon `etapes.email = 'non-configure'`, dit dans la réponse.

### Les clients partis — `api/_lib/clients-partis.js`, cron du matin (`api/ship-reminders.js`)
- Candidats : `abonnements` en `canceled` / `incomplete_expired` / `paused`. **La date de fin vient
  de Stripe relu** (`ended_at`, ou `trial_end` passé d'un essai fini sans carte) ; Stripe muet,
  abonnement d'un autre client, statut vivant, date absente ⇒ rien.
- À **11 mois** : un e-mail, **une fois** par date de fin (`vrm_depart_avis`, réservé avant
  l'envoi ; refus SMTP ⇒ levé, demain) ; SMTP pas configuré ⇒ rien, dit (`ignores`).
- À **12 mois** : inventaire puis `effacerCompte` (factures Pro gardées 10 ans), journal, e-mail
  « ton compte est supprimé » (adresse lue AVANT).
- Jamais : propriétaire (pas su ⇒ le passage s'arrête), abonnement **mode test** de Stripe
  (`VRM_DEPARTS_MODE_TEST=1` pour essayer), une lecture ratée. Borné : 20 avis, 5 suppressions
  par passage ; le reste au lendemain.

### L'écran — Paramètres → Mon compte, **tout en bas** (groupe `supprimer`, seul)
`FermerCompte` (`src/ecrans/Reglages.jsx`, `data-fermer-*` gardés pour les bancs) : 1. « Exporter
mes données » d'abord ; 2. ce qui part (nombres du serveur) ; 3. ce qui reste et pourquoi ;
4. « SUPPRIMER » + mot de passe (phrase pour un compte Google/Discord) ; bouton éteint sinon ;
le résultat est la phrase du serveur, jamais « supprimé » sur un échec. Libellé dans la couleur
`danger` du thème (le **rouge** est réservé aux doublons de N°, §7 — pas de rouge ici exprès).
« Ce que VRM lit et fait » → « Supprimer mon compte » y mène. La porte « compte Discord/Google
vide » (`PorteNouveauOAuth`) passe par la même route (son clic + connexion de moins de 10 min).

### La politique — `public/legal/confidentialite.html` (9 nov.)
§5 réécrit avec les durées **que le code tient** : suppression immédiate ; 12 mois après la fin de
l'abonnement (avis à 11) ; factures Pro 10 ans ; factures d'abonnement chez Stripe 10 ans ; preuve
de suppression 3 ans ; copies de sécurité techniques **non** couvertes par le bouton (sur demande
écrite) ; compte sans abonnement : **aucune suppression automatique aujourd'hui** (l'ancienne
promesse « inactif 3 ans ⇒ supprimé » n'avait aucun code : retirée). §7 : chaque droit et son
geste, contact = `data-e="email"` (`public/legal/editeur.js`, rien inventé).

## Preuves
- `node scripts/audit-supprimer-compte.cjs` — 34 contrôles, la VRAIE route sur une fausse base à
  deux vendeurs (`scripts/_faux-compte-rgpd.cjs`, filtres PostgREST honorés, DELETE réel).
  `--prouve` : **rouge sur origin/main** (la route n’existe pas) et **rouge sur la
  mutation « filtre propriétaire retiré »** (5 en échec : B effacé), vert ici.
- `node scripts/audit-clients-partis.cjs` — 27 contrôles, horloge simulée (10 mois rien ; 11 mois
  un e-mail une fois ; 12 mois supprimé ; actif / Stripe muet / autre client / mode test /
  propriétaire / pas su ⇒ rien ; borné ; factures purgées après 10 ans). `--prouve` : rouge sur
  origin/main et sur la mutation « garde du propriétaire retirée ».
- `audit-fermer-compte.cjs` : lance le précédent + l'ancien `?mode=fermer` avec l'ancienne
  confirmation (l'e-mail) est **refusé**.
- Banc de rendu `scripts/bancs/supprimer-compte.cjs` (390 tactile / 1512, clair / sombre,
  captures dans `<tmp>/banc-supprimer-compte`, regardées) : 46 OK, 0 en échec. `scripts/bancs/abonnement.cjs` et
  `discord-nouveau-compte.cjs` mis à la nouvelle confirmation (⚠️ `abonnement.cjs` pas relancé jusqu'au bout : lancé en parallèle d'un build, ses cartes d'abonnement — hors de ce chantier — tombaient en délai ; à relancer seul).
- Audits verts : fonctions-api (12, aucune nouvelle fonction), vendeur-neutre, variables, tdz,
  icones, boutons, violet, coherence, confiance (C9/C11 mis à jour). `npm run build` vert.

## Ce qui n'est PAS fait / à décider (Julien)
- **Export pour un abonnement terminé** : ta décision du 8 nov. ferme l'export sans abonnement
  (`EXPORT_FERME`). L'e-mail des 11 mois dit donc « reprends l'abonnement pour continuer ou
  exporter ». Le RGPD (portabilité, art. 20) ne permet normalement pas de faire payer l'accès à
  ses propres données : **à trancher** — rouvrir l'export seul en lecture seule ?
- Comptes **jamais abonnés** (essai seulement) : aucune suppression automatique (dit dans la politique).
- Copies de sécurité techniques (schéma `sauvegarde`) : non mesuré (accès SQL refusé à la session),
  non effacées par le bouton — dit dans la politique.
- Le mail de confirmation et l'avis des 11 mois ne partent qu'avec `RELANCES_SMTP_*` posés.
- Un jeton déjà délivré reste valable ≈ 1 h après la suppression (limite connue, dite depuis le 5 oct.).

## Gestes de Julien
1. Relire `public/legal/confidentialite.html` §5 et §7 (et remplir `editeur.js`).
2. Décider de l'export sans abonnement (ci-dessus).
3. Poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` pour les e-mails (confirmation, avis des 11 mois).
