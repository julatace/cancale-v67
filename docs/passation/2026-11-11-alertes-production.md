# 11 nov. — Les alertes de production sur l'iPhone de Julien

Branche `claude/alertes-production` (depuis `origin/main`). Pas de PR : la session principale intègre.
Demande : être prévenu AVANT qu'un vendeur le dise — écran qui plante, réception des e-mails
arrêtée, vérification des colis en échec, `/api/sante` plus verte.

## Ce qui existait (réutilisé, pas doublé)

- Plantages chez les vendeurs : `src/alertesPlantages.js` + `api/_lib/alertes-plantages.js`
  (groupés à l'heure, au propriétaire, 8 nov.).
- Sondes de `/statut` toutes les 10 min (`api/_lib/statut-sondes.js`, `?moment=sondes`) :
  base, connexion, réception des e-mails (silence anormal appris sur 14 jours), envoi,
  notifications, extension ; incident après 2 sondes dégradées, notifié une fois.
- Le chemin push (`sendPushToAll`, catégorie `signalement`, heures calmes, cloche).

## Ce qui est livré

**Un journal et une règle d'envoi** : `api/_lib/alertes-production.js`, ligne
`alertes_production` du PROPRIÉTAIRE (`VRM_OWNER_UID`). Quatre types :

| type | déclencheur | où |
|---|---|---|
| `plantage` | écran tombé / erreur répétée 3× (inchangé) | `alertes-plantages.js` passe par le journal |
| `emails` | sonde « emails » dégradée 2× **ou** 3 réponses 503 en une heure | `statut-sondes.js`, `email-inbound.js` (`noter503`, borné 3 s) |
| `colis` | `?moment=colis` en panne 2 passages de suite **ou** transporteur refusé en série (≥ 5 lectures, la moitié en échec) 2 passages de suite | `ship-reminders.js` (`alerterColis`) |
| `sante` | une sonde dégradée 2× (base, connexion, envoi, notifications, extension) **ou muette 3×** | `statut-sondes.js` (`muette`, `signauxSondes`) |

Règles :
- **Regroupement** : même clé = une notification par heure au plus ; le corps dit « ×N depuis
  hh:mm ». Ce qui arrive pendant l'heure attend ; la vidange tourne à chaque passage des sondes.
- **Muette ≠ panne** : 3 sondes « sans réponse » de suite ⇒ « Pas de réponse : … — pas su, ce
  n'est pas une panne prouvée ». Une réponse remet à zéro.
- **Aucune donnée personnelle** : tout titre/corps passe par `propre` (`nettoyer` de
  `src/plantages.js` + pseudos `@x`, n° de suivi, suites de chiffres).
- **Écrit avant d'envoyer** (comparer-et-échanger sur `rev`, 4 essais) ; lecture ratée ⇒ rien.
- Si le journal n'écrit pas, l'incident de sonde part quand même par l'envoi direct d'avant
  (il est déjà marqué « dit » dans l'état des sondes : sinon il serait perdu).
- **30 jours** : le journal s'élague seul (80 alertes au plus) ; le cron du matin efface
  `plantages_terrain_*` et `plantage_*` de plus de 30 jours (`purgerErreursAnciennes`,
  suppression par filtre ; une ligne sans date n'est jamais touchée).
- **Route** : `/api/compte?mode=alertes` (pas de 13ᵉ fonction) — GET les 20 dernières + les
  interrupteurs ; POST `{type, actif}`. Propriétaire seul, 403 sinon.
- **Écran** : Paramètres → Tout va bien ? → « Alertes sur ton iPhone » (un interrupteur par
  type) et « Dernières alertes » (`src/composants/AlertesProduction.jsx`), seulement pour le
  propriétaire. Coupé = noté au journal, ne sonne pas.

**Migration SQL : aucune.** Tout vit dans `app_data` (clé-valeur) ; la purge lit `meta->>at`
(migration 004 déjà en place).

## Tranché seul (« tranche le reste toi-même »)

- Seuils : 2 passages colis, 3 refus 503 / heure, 3 sondes muettes, refus transporteur = la
  moitié sur au moins 5 lectures. Un seul passage raté n'alerte jamais.
- Tout allumé par défaut.
- `/api/sante` « plus verte » = les sondes qui la nourrissent (pas un second sondeur).
- Les 503 du mode « script Gmail » (lecture des factures) ne comptent pas : seule la réception.

## Preuves

- `node scripts/audit-alertes-production.cjs` : **37 verts** — règle pure, et les VRAIES routes
  exécutées sur fausse base : `api/compte.js?mode=alertes` (403, interrupteur), `ship-reminders`
  `?moment=sondes` (dégradée 2× ⇒ 1 alerte ; muette 3× ⇒ 1 alerte « Pas de réponse »),
  `?moment=colis` (2 passages ⇒ 1 alerte, 3ᵉ regroupé), `email-inbound` (2 × 503 ⇒ rien,
  3ᵉ ⇒ alerte), purge 30 jours.
- `--prouve` : **9/9 mutations rouges** (regroupement, filtre des données, interrupteur,
  30 jours, seuil des muettes, 503 non notés, colis muet, route ouverte à tous, purge trop large).
- `node scripts/bancs/alertes-production.cjs` : **35 verts** — la vraie app ; 3 erreurs JS non
  rattrapées (avec e-mail et prix) ⇒ le lot part vers la vraie route ⇒ UNE notification
  (push simulé), au propriétaire, sans e-mail ni prix ; panneau à 390 tactile et 1512, clair et
  sombre ; couper « Vérification des colis » écrit la base ; un autre vendeur ne voit rien et ne
  lit rien. Captures regardées.
- Verts : `npm run build`, audits `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `textes-courts`, `fonctions-api` (12), `secrets`, `aide-signalement` (46), `statut-auto` (26),
  `colis-frequent` (21), `transporteurs-parfaits`, `confiance`, `abonnement`, `boite-emails`,
  `journal-emails`, `email-cle`, `mesures-terrain`, `veille-plantages`, `notifs-centre`,
  `cibles-notif`, `adresse-reception`, `emails-html`, `emails-transfert`, `csp`, `vapid`,
  `politique-hotes`, `confidentialite-sql`.
- Deux audits existants ajustés, et dits : `statut-auto` S3 permet la lecture `select=data` de la
  petite ligne `alertes_production` ; `colis-frequent` C4 ne compte pas cette lecture comme une
  visite de vendeur.
- Déjà rouges sur `main` avant ce lot (pas touchés) : `audit-signalement` (2 : écrans
  `litiges/republier/favoris`, lecture du statut) et `audit-violet` (3 : logos FedEx, Relais Colis).

## Ce qui reste

- Une base TOUT À FAIT tombée ne peut pas écrire son journal : `/statut` et le workflow GitHub
  des sondes (e-mail de GitHub) restent le filet, comme avant.
- Le push sonne selon les heures calmes de Julien (catégorie `signalement`) ; la cloche garde tout.

## Geste de Julien

Aucun. Mêmes variables qu'avant (`VRM_OWNER_UID`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_KEY`,
`CRON_SECRET` côté GitHub). Pour voir : Paramètres → Tout va bien ? → « Alertes sur ton iPhone ».
