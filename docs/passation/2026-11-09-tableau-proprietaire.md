# 9 novembre 2026 — Tableau du propriétaire (« Ton entreprise ») et note de satisfaction

Branche `claude/tableau-proprietaire` (pas de PR, pas de merge : le coordinateur fusionne).

## Ce que Julien voulait
Piloter son entreprise : combien de vendeurs, combien reviennent, combien paient, ce que
ça rapporte, ce qui casse, et ce que les vendeurs en pensent — sans voir la vie de personne.

## Ce qui est livré

### 1. Le tableau « Ton entreprise » (Réglages → groupe Aide, à côté de « Signalements reçus »)
- Entrée visible **pour le propriétaire de l'installation seul** (`useEstProprietaire`, la même
  garde que « Signalements reçus » et les alertes de plantage).
- Serveur : `GET /api/compte?mode=pilotage` → `api/_lib/pilotage.js` (`routePilotage`).
  **Pas de 13ᵉ fonction.** Ordre : jeton vérifié par Supabase (`vendeurExige`, 401/503) →
  `proprietaireInstallation` (`VRM_OWNER_UID`, sinon `vrm_reglages.proprietaire`) → 403 pour
  tout autre compte, AVANT toute lecture à la clé de service → calcul.
- Blocs, chacun en trois états (valeur · `null` + `raisons[bloc]` · jamais 0 inventé) :
  - **Inscrits** (total, +N en 30 j) et **courbe 90 j** refaite depuis la date de création
    des comptes (Supabase Auth admin, paginé ; ni e-mail ni id ne sortent).
  - **Actifs 7 j / 30 j** : dernier signe parmi chargement de l'app (`vrm_vu`, nouveau, un
    par jour de Paris et par appareil, il ne porte que `{ v, jour }`), extension
    (`ext_appareil_*`, `meta->>at`) et dernière connexion (Auth). Un des trois illisible ⇒ « pas su ».
  - **Essais** en cours / finis / devenus abonnés (`abonnements` + `essais_gratuits`).
  - **Abonnés** (active + past_due), impayés (ambre), résiliations programmées.
  - **Revenus mensuels récurrents** : STRIPE seul (`subscriptions?status=all`, paginé) ;
    annuel ramené au mois ; autre devise écartée et comptée ; remises dites (« comptés avant
    remise ») ; abonnements du propriétaire écartés (par son `client_stripe`) ; essais exclus.
    Sans `STRIPE_SECRET_KEY` ⇒ « — · Stripe pas branché » ; Stripe muet ⇒ « pas su ».
  - **Désabonnements du mois** (Paris) : Stripe s'il est branché, sinon notre table (dit).
  - **Abonnés par plan** : le `lookup_key` du prix (`vrm_mensuel` ⇒ « Mensuel ») — prêt pour
    les plans Solo/Pro de `claude/plans-solo-pro` sans rien changer.
  - **Incidents** : la ligne `statut_sondes` (propriétaire neutre, `claude/statut-auto`) —
    ouverts, fermés en 30 j, le dernier ; sondes arrêtées (> 45 min) dit.
  - **Plantages 7 j** : le résumé des alertes groupées existantes (`listerPlantagesTerrain`).
  - **Satisfaction** : moyenne, N, répartition 1–5, 8 derniers mots SANS identité.
- **Historique** (courbes actifs 7 j, abonnés, revenus) : un point par jour dans la ligne
  `pilotage_historique` du propriétaire, noté à chaque ouverture ET par le cron du matin
  (`noterPilotageDuJour` dans `api/ship-reminders.js`). Comparer-et-échanger sur `data.rev` ;
  lecture ratée ⇒ rien écrit ; une valeur pas sue garde celle lue plus tôt dans la journée.
  La courbe commence le 1er jour noté et l'écran dit depuis quand.
- Écran : `src/composants/TableauProprietaire.jsx`. Courbes à une série (bleu de l'app), crosshair
  au survol, au doigt et aux flèches, « Voir les chiffres » (tableau). Ambre seulement pour un
  incident ouvert, un impayé, un écran tombé.

### 2. La note « VRM t'aide-t-il ? » (en bas de Ma journée)
- Règle pure `src/satisfaction.js` (`questionDue`, `etatApres`, `agregerNotes`) :
  jamais au propriétaire ; 14 jours après la **création du compte** ; pas dans les 3 jours qui
  suivent le premier jour où l'app VOIT l'abonnement payé (`payeVu`, noté une fois — l'app ne
  connaît pas la date du 1er paiement : un abonné ancien attend 3 j de trop, jamais trop tôt) ;
  « Plus tard » = 7 j ; « Ne plus demander » et une réponse = plus jamais ; une lecture ratée
  (sa ligne, l'abonnement) ⇒ rien montré.
- Rangée chez lui : ligne `vrm_satisfaction` (app_data, RLS) `{ v, reponse:{note,mot,at}, plusTard, jamais, payeVu }`.
- Serveur : projection `note/mot/at` SANS propriétaire, le propriétaire et le neutre écartés ;
  e-mail, lien et numéro tapés dans un mot ⇒ « … » ; le jour seulement, jamais l'heure.
- Composant `src/composants/NoteSatisfaction.jsx` (5 notes de 44 px, mot facultatif 280 car.).

## Preuves
- `node --test scripts/tests/pilotage.test.mjs` (7) : la VRAIE route `api/compte.js` exécutée
  contre un faux PostgREST/Auth admin/Stripe : 403 pour un vendeur sans aucune lecture à la clé
  de service, 401 sans session, aucun `@`/id/`cus_` dans la réponse, « stripe-absent », Stripe
  (mensuel + annuel/12, USD écarté, propriétaire et essai exclus), Stripe muet ⇒ pas su,
  lectures ratées ⇒ `null` + raison et AUCUNE écriture, historique qui garde la valeur lue.
  Mutations (garde retirée, propriétaire compté, « Stripe absent » ignoré) ⇒ 4 rouges.
- `node --test scripts/tests/satisfaction.test.mjs` (7) : horloge simulée (13,9 j / 14 j,
  2,9 j / 3 j, 6,9 j / 7 j, jamais, propriétaire, pas su), agrégat masqué.
- Banc `scripts/bancs/tableau-proprietaire.cjs` (390/1512, clair/sombre) : 191 OK.
  Sur `origin/main` : 8 rouges (entrée et tableau absents). Mutations (entrée sans garde,
  14 j → 4 j) : V1 et V3 rouges. Captures regardées.
- Audits verts : fonctions-api (12), vendeur-neutre, variables, tdz, icones, boutons, violet,
  coherence, confiance. `npm run build` vert.

## Gestes de Julien
Aucun pour voir le tableau. Pour les revenus : `STRIPE_SECRET_KEY` (déjà dans sa liste).
Les courbes « actifs » et « abonnés » se dessinent à partir du lendemain du déploiement.

## Limites dites
- « Actif » ne voit pas un vendeur qui n'ouvre que l'app d'un appareil jamais mis à jour
  (avant `vrm_vu`) sans extension ni reconnexion : il compte dès sa prochaine ouverture.
- Les mots libres peuvent contenir un pseudo : le tableau ne dit jamais de qui vient un mot.
