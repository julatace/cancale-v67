# Lot H — Échéances dans l'agenda (.ics) + alerte « nouvel appareil » (10 nov.)

Branche `claude/ics-appareil`. Validé par Julien (propositions 4 et 5 du 9 nov.).

## 1. Échéances dans l'agenda

**Ce que voit Julien** : Paramètres → Réglages → Notifications → « Échéances dans l'agenda ».
Trois lignes (Déclaration URSSAF · Colis à déposer · Colis à retirer), « Rien d'autre : ni titre,
ni acheteur, ni montant. », puis **Ajouter à mon agenda** (premier toucher : le serveur crée le
lien et l'ouvre aussitôt en `webcal://` ⇒ Calendrier iPhone propose l'abonnement), **Google
Agenda**, et en liens : Copier le lien · Changer le lien (confirmé, l'ancien meurt) · Couper.

**Ce qu'il y a dans le calendrier** — seulement des dates LUES :
- **URSSAF** : `nextUrssafDeadline` (règle existante, `api/_lib/urssaf-regle.js`), les deux
  prochaines échéances, micro-entrepreneur seulement (le régime n'est jamais deviné), période
  déjà notée « déclarée » (`vrm_urssaf_declare`) ⇒ absente. Jamais le montant. Journée entière,
  rappel la veille à 9 h.
- **Colis à déposer** : la date limite LUE dans l'e-mail du bordereau (`limiteExpedition`,
  `api/_lib/limite-envoi.js`). L'app la PUBLIE (§11) : Ma journée, après une lecture COMPLÈTE
  (`lectureComplete`), écrit `vrm_agenda_envoi = { v, at, colis: [[N°, jour, heure, at]] }`
  dans `main` (`src/agendaEcheances.js`, clé ajoutée à `SYNC_KEYS` et `CLES_PUBLIEES`). Une date
  ESTIMÉE (vente + 7 j) n'est jamais publiée. Titre : « Colis N°12 à déposer avant 10 h »,
  événement de 30 min finissant à l'heure limite, rappel 2 h avant.
- **Colis à retirer** : la liste déjà publiée `vrm_colis_retirer.colis` ([0] date limite lue,
  [2] transporteur, [6] heure). Sans date lue ⇒ absent. Titre : « Colis à retirer · Mondial
  Relay ». L'UID est une empreinte de l'identité (jamais le n° de suivi).

**Le jeton** : 32 octets aléatoires (base64url), créé/changé/coupé par le SERVEUR sur la session
du vendeur (`POST /api/compte?mode=agenda {action: creer|regenerer|couper}`), rangé dans SA
ligne `vrm_agenda` et indexé par empreinte chez le propriétaire neutre (`api/_lib/jeton-index.js`,
genre `agenda` ajouté). Le calendrier : `https://vrm.center/agenda/<jeton>.ics`, réécrit par
`vercel.json` vers `/api/compte?mode=agenda&f=<jeton>.ics` — **aucune fonction `api/` neuve**.
`main` est lu PROJETÉ (`SELECT_MAIN_AGENDA`), jamais `select=data`. Lecture ratée ⇒ 503 (le
calendrier garde sa copie), jamais un calendrier vide. Abonnement arrêté ⇒ 403.

## 2. Alerte « nouvel appareil »

À chaque ouverture (une fois par session du navigateur et par vendeur, `src/appareilNouveau.js`
dans `AppCoeur`), l'app demande `POST /api/compte?mode=appareils {action:'verifier'}`. Le
serveur (`api/_lib/appareil-nouveau.js`) relit SES sessions (`vrm_sessions_de`, migration 024,
identifiant du JETON vérifié), résume chaque navigateur (`resumerAppareil` : « Mac · Chrome »),
compare au registre `vrm_appareils_vus` (signature + date, jamais le user agent brut).
- Première fois : tout ce qui est connecté devient connu, **sans alerte**.
- Signature jamais vue ⇒ registre écrit d'abord (comparer-et-échanger sur `data.rev` : un seul
  appareil alerte), puis notification « Nouvel appareil · Chrome sur Mac. Ce n'est pas toi ? »
  (`cat: 'securite'`, sonne même en heures calmes, rangée dans la cloche).
- Son toucher : `/?tab=settings&section=appareils&session=<id>` ⇒ Mon compte → Appareils
  connectés, CETTE session sur fond ambre avec son « Déconnecter » (route existante,
  `vrm_fermer_session`).
- Sessions « Serveur VRM » (extension) ignorées ; ligne d'un autre utilisateur ignorée ;
  lecture ratée ⇒ 503, rien écrit, rien envoyé.

**Limite dite** : un intrus sur le MÊME type d'appareil que Julien (« Mac · Chrome ») ne fait
pas d'alerte (la signature est résumée exprès, sans IP). Un intrus qui n'ouvre pas l'app est vu
à la prochaine ouverture de VRM par Julien, sur n'importe lequel de ses appareils (pas de cron).

## Preuves
- `node scripts/audit-agenda-appareil.cjs` (36 contrôles) EXÉCUTE `api/compte.js` contre une
  base simulée à la vraie forme ; `--prouve` : 8 mutations ⇒ 8 rouges. Rouge sur origin/main
  (fichiers et route absents).
- `scripts/bancs/agenda-appareil.cjs` (P publication, F agenda, G nouvel appareil), 390 tactile
  et 1512, clair et sombre. Il a attrapé un vrai défaut : `vrm_agenda_envoi` hors de
  `SYNC_KEYS` ne partait jamais vers la base. Et `location.href = webcal:` cassait la page sans
  app Calendrier : l'ouverture passe par un lien touché.
- `npm run build` ; audits variables, tdz, coherence, identite, icones, comptes-securite,
  jeton-index, fonctions-api, flux-divers, cibles-notif, notifications, notifs-belles, file-envoi.

## Gestes de Julien
Aucun (la 024 est appliquée). Pour essayer : Paramètres → Notifications → « Échéances dans
l'agenda » → « Ajouter à mon agenda » sur l'iPhone.
