# Robustesse du serveur — e-mails, compte, cron (11 nov. 2026, second agent)

Branche `claude/agent2-robustesse-serveur` (partie de `origin/main` 2084be1b9), **pas de PR, pas de fusion** :
l'agent principal intègre. Source : la revue en lecture seule
`docs/passation/robustesse/serveur.md` (branche `claude/agent2-robustesse`), points **critiques et hauts**
de la zone e-mails · compte · cron. Hors zone (Colis/suivi, OAuth, sécurité pure, base-optimisée) : pas touché.

Preuve commune : `scripts/audit-robustesse-serveur.cjs` EXÉCUTE les vraies routes (`email-inbound`,
`email-rattacher`, `compte` webhook, `_lib/stripe`) sur une fausse base À ÉTAT (filtres `eq/like/in`,
`data->>x=not.is.null`, projections `select=`, `Range`) et un faux Stripe — aucune donnée réelle.
`--prouve` : **20 rouges sur origin/main** (git archive) et **9/9 mutations** attrapées.
`audit-clients-partis.cjs --prouve` et `audit-cron-lots.cjs --prouve` (9/9) complétés.

| point de la revue | reproduit (origin/main) | corrigé | preuve |
|---|---|---|---|
| **C1** quarantaine : PDF perdu (seul le nom gardé) | Q : 0 pièce gardée ; rejeu ⇒ bordereau sans PDF | `mettreEnQuarantaine` range chaque pièce dans une ligne SŒUR `email_qpj_{id}_{i}` (neutre, une pièce par ligne, ≤ 6 Mo base64, 20 pièces) AVANT la ligne de quarantaine (pièce non écrite ⇒ 503) ; la quarantaine garde `pieces:[{filename, contentType, ligne, taille}]` ; id tiré du Message-ID (un rejeu du collecteur ne crée plus de copie — point 59). `email-rattacher` relit les sœurs (`id=in.(…)`), rejoue AVEC `attachments` ; pièce illisible ⇒ 503 et rien n'est vidé ; succès ⇒ sœurs vidées | audit Q (6 contrôles), mutations « quarantaine sans les pièces », « rejeu sans les pièces », « pièce illisible » |
| **H12** 2e « Bordereau d'envoi » sans PJ efface le PDF | B : `pdfB64` devient `null` | sans PJ, on lit la présence du PDF par filtre (`data->>pdfB64=not.is.null&select=id`, jamais le PDF) : déjà là ⇒ ligne gardée ; lecture ratée ⇒ rien écrit, 503 | audit B (5), mutation « PDF écrasé » |
| **H6** `email_final_*` fond deux versements | F : 1 ligne pour 2 versements | `cleFinalisation` (pure, exportée) : n° de transaction lu (`tx…`) · Message-ID (`m` + sha256) · sinon l'ancienne clé ; la ligne garde `transaction` et `messageId` | audit F (3), mutation « versements fondus » |
| **C3** vendeur décidé par `To`/`Cc` | P : livré à A, `To: B` ⇒ pas chez A | `enveloppeDeLivraison` : dès que l'enveloppe (envelopeTo, envelope.to, Delivered-To, OriginalRecipient…) nomme une adresse qui n'est pas la boîte collective, elle décide SEULE | audit P (3), mutation « To lu malgré l'enveloppe » ; `audit-proprietaire-email` 61 verts, `collecte-email.test.mjs` 15/15 |
| **C5** webhook : lecture ratée ⇒ 200 « sans propriétaire » | S : HTTP 200 | `proprietaireDe` à trois états (owner · '' · `undefined`) ; pas su ⇒ **503** (abonnement ET `invoice.paid`) ; délai 8 s | audit S, mutation « pas su = personne » |
| **H18** l'événement d'un ANCIEN abonnement écrase l'actif | S : `incomplete_expired` du 1er abonnement écrasait l'actif | `evenementDUnAncienAbonnement` (pure) : un autre abonnement que celui de la ligne ne s'applique que s'il est vivant, ou si celui de la ligne est terminé | audit S, mutation « ancien abonnement » |
| **H32** essai gratuit pas enregistré ⇒ 200 | — | ⇒ 503 (Stripe rejoue, statut réécrit à l'identique) ; aucune clé à marquer n'est plus un échec | audit S |
| **C4** effacement à 12 mois sans avis prouvé | 12 et 13 mois sans SMTP ⇒ compte effacé | `etapeDepart` : `supprimer` seulement si `issue:'envoye'` pour CETTE fin, `at` rangé, et ≥ 30 j après l'avis (`dateEffacement`) ; avis jamais parti ⇒ il part maintenant (date annoncée décalée) ; « incertain »/« en cours » ⇒ `avis pas prouve : rien efface` dans `ignores` | `audit-clients-partis` (+7 contrôles, 33 verts ; rouge sur origin/main) |
| **H13** cron : vendeur en échec noté « fait » | relance du jour ne le retente pas | seul un vendeur réussi entre dans le curseur ; `enEchec` rendu ; le curseur reste « incomplet » ⇒ retenté (relance, ou en tête le lendemain) | `audit-cron-lots` (+1 contrôle, mutation « échec noté fait ») |
| **H31** curseur sauvé sans attendre | — | `await sauver(false)` dans l'ouvrier | `audit-cron-lots` 19 verts |
| **H16/17** `maxDuration` non déclaré | — | `vercel.json` : `api/ship-reminders.js` 300 s (= `DUREE_MAX_MS` de cron-lots ; projet créé en 2026 ⇒ Fluid, Hobby ≤ 300 s), `api/ebay.js` 60 s ; toujours 12 fonctions | audit D |
| **M33-36** fetch sortants sans délai | — | Stripe 10 s (`DELAI_STRIPE_MS`), eBay lecture 10 s / Trading 25 s (coupé ⇒ `incertain:true`), Anthropic 25 s (×2) | audit D, mutation « Stripe sans délai » |

## Ce qui n'est PAS fait (pour l'agent principal)
- **C3, cas de la boîte collective** : quand l'enveloppe ne dit QUE `vrm.vinted35@gmail.com` (le transfert Gmail,
  `BOITE_PARTAGEE = true` dans `scripts/gmail-forwarder.gs`), `To`/`Cc` restent la seule trace du vendeur. Les
  ignorer mettrait **tout** le flux de production en quarantaine : je ne l'ai pas fait. Risque résiduel : un
  e-mail envoyé directement à la boîte collective avec `To: <adresse prouvée d'un vendeur>` lui est encore
  attribué. Vraie fin : l'adresse de réception par vendeur (jeton `@domaine`, enveloppe Cloudflare) — décision
  de Julien.
- **C2** (N° par titre tamponné sur l'étiquette) : touche le bordereau/Colis — sujet de l'agent principal.
- **H18, atomicité** : la lecture de `evenement_ts` puis l'upsert ne sont pas atomiques (deux webhooks
  simultanés) ; il faudrait un PATCH conditionnel `evenement_ts=lte.X` + les bancs `abonnements` qui le servent.
- Hauts non traités : H7 (`email_sale_` sans transaction), H8 (`shortHash` 31 bits ailleurs), H9 (départage par
  taille), H10 (`logEmail` sans CAS), H11 (`detectAccount` pas su), H14 (verrou de passage du cron), H15
  (relances-essai CAS), H19 (deux checkouts), H20 (clients partis : lister tous les abonnements Stripe), H21-22
  (refresh Vinted), H23-28 (eBay/widget, lectures lourdes), H29 (montant deviné), H30 (double constat).
- Une ligne `email_final_*` déjà rangée sous l'ANCIENNE clé et rejouée après déploiement donnerait une 2e ligne
  (le même Message-ID, nouvelle clé) : seul un rejeu du collecteur à cheval sur le déploiement le ferait.

## Vérifié
`npm run build` ; audits verts : variables, tdz, coherence, identite, fonctions-api, secrets, proprietaire-email,
email-rattacher, email-cle, email-formes, bordereau-des-email, journal-emails, boite-emails, emails-transfert,
compte-email, abonnement (103), abonnement-propre, plans-solo-pro, clients-partis, cron-lots, suites-serveur,
emails-html, adresse-reception, facture-achat, depart-mondialrelay, double-vente-ailleurs, flux-divers, statuts,
lectures, notif-colis, cle-service, supprimer-compte, suppr-compte, purge-compte, robustesse-serveur, et la série
des audits qui lisent ces routes (voir le rapport). `node --test scripts/tests/collecte-email.test.mjs` 15/15.

Geste de Julien : aucun.
