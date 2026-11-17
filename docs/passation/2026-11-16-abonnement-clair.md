# 16 nov. — Abonnement sans surprise (lot `abonnement-clair`)

Mission : `docs/passation/file-attente-16nov/3-abonnement-rappel.md` (validée par Julien : « aucune mauvaise
surprise sur l'abonnement »).

## Ce qui change
1. **Rappel 3 jours avant chaque prélèvement** (renouvellement d'un abonné ET fin d'essai) :
   « Ton abonnement VRM Solo (14,99 €) sera renouvelé le 19/11. Gérer · Résilier » /
   « Ton essai gratuit se termine le 19/11 : ton abonnement VRM Pro (19,99 €) démarrera ce jour-là. »
   - `api/_lib/rappel-prelevement.js`, appelé par le cron du MATIN (`api/ship-reminders.js`, après les e-mails de
     l'essai, borné dans le temps). **Aucune fonction `api/` de plus** (12).
   - **Date et montant LUS chez Stripe, jamais devinés** : l'abonnement (`subscriptions/{id}` : `trial_end` en essai,
     sinon la fin de période — sur l'ARTICLE depuis l'API « basil », `finPeriode`) et l'aperçu de la prochaine
     facture (`POST invoices/create_preview` : remise et prorata compris). Aperçu illisible ou autre devise ⇒ rien
     ce jour-là (relu le lendemain). L'abonnement doit être celui de son client, vivant, et **non résilié chez
     Stripe** (même si la base ne le sait pas encore).
   - Notification (catégorie `abonnement`, famille « Rappels » : réglable par lui) + **e-mail transactionnel** si
     l'envoi d'e-mails est configuré (`RELANCES_SMTP_*`, les mêmes que l'essai) ; sinon la notification seule.
   - Une fois par prélèvement : la date est réservée dans la ligne `rappels_prelevement` du vendeur AVANT tout envoi
     (comparer-et-échanger) ; un passage du matin manqué ⇒ le rappel part encore à J-2 ou J-1, une fois.
   - Jamais le propriétaire, jamais un abonnement en mode test (sauf `RELANCES_ESSAI_MODE_TEST=1`).
   - **Sans `STRIPE_SECRET_KEY`** : rien n'est lu, rien ne part ; la réponse du cron le dit (`rappelsPrelevement.pret
     = false`) et **Paramètres → Mon abonnement** aussi (« rien n'est envoyé tant que le paiement n'est pas branché »).
2. **Fin d'essai** : l'e-mail d'essai « se termine demain » (j6) ne part plus pour un essai qui sera prélevé (le
   rappel l'a dit 3 jours avant, avec le montant) ; il reste pour un essai **résilié** (« ton accès se ferme
   demain »). L'e-mail « ce qui n'est pas relié » (j3) ne tombe plus le jour du rappel.
3. **Reçu chaque mois** : déjà là — Paramètres → Mon abonnement liste les factures Stripe (date, montant, statut,
   PDF hébergé chez Stripe, « pas su » jamais écrit « aucune facture »), avec l'historique (24 dernières). Inchangé.
4. Paramètres → Mon abonnement : une ligne dit le rappel tel que le serveur le fait (`rappelPrelevement` de
   `GET /api/compte?mode=abonnement` : « notification et e-mail » · « notification » · « éteint ») ; la route ne le
   dit pas ⇒ rien n'est promis. Textes par `tr()` en cinq langues.

## Preuves
- `scripts/audit-rappel-prelevement.cjs` : **29/29** — EXÉCUTE la vraie route du cron, la vraie notification
  (rangée dans `push_journal` du vendeur), le vrai client SMTP (faux serveur local), la vraie route `abonnement`,
  contre une fausse base et un **faux Stripe à la vraie forme** (dahlia). **6 mutations, 6 rouges** : montant du
  catalogue, résilié ignoré, deux fois, sans clé, fenêtre de 10 jours, date de la base au lieu de Stripe.
  Rouge sur `main` (le module n'existe pas).
- `audit-relances-essai` 31/31 (S3 et S6 portés sur la règle neuve, S7 « résilié » inchangé).
- `audit-fonctions-api`, `audit-traduction`, `audit-familles-serveur`, `audit-abonnement`, `audit-abonnement-propre`,
  `audit-notifications`, `audit-notifs-centre`, `audit-notifs-groupees`, `audit-push`, `audit-cibles-notif`,
  `audit-notifs-belles` : verts. `audit-notifs-redaction` : 5 rouges (offres groupées), **les mêmes sur main**.
- Banc `abonnement` : section « Le rappel avant prélèvement » (390 tactile) — voir la PR.

## Gestes de Julien
Aucun de plus : le rappel s'allume avec `STRIPE_SECRET_KEY` (déjà dans sa liste) ; l'e-mail avec `RELANCES_SMTP_*`.

## ÉTAT À LA REPRISE
Fini, PR ouverte.
