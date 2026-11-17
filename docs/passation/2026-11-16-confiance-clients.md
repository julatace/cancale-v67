# 16 nov. 2026 — Confiance des clients (les vendeurs qui utilisent VRM)

Mission : `docs/passation/file-attente-16nov/12-confiance-clients.md` (validée par Julien). Branche
`claude/confiance-clients`. Trois points. Aucune fonction api/ en plus (12).

## 5. Alerte de connexion inhabituelle

- Existait (10 nov., lot H, `api/_lib/appareil-nouveau.js`) : à chaque ouverture, le serveur relit SES sessions
  (`vrm_sessions_de`), compare la signature résumée (« iPhone · Safari ») au registre `vrm_appareils_vus` (aucune
  IP, aucun agent brut), notification « Nouvel appareil » (famille sécurité, même en heures calmes) qui ouvre
  Paramètres → Appareils connectés avec « Déconnecter » (`vrm_fermer_session`) ; jamais au premier appareil
  (le registre s'initialise sans alerte).
- Ajouté : **l'e-mail au titulaire** — « Nouvelle connexion à VRM — iPhone · Safari — le 16/11 à 9 h 12 » (heure
  de Paris), « Ce n'est pas toi ? Change ton mot de passe… », bouton « Voir mes appareils ». Par la voie e-mail
  existante (celle des relances, `RELANCES_SMTP_*`) **seulement si elle est configurée** ; à l'adresse de SA
  session, jamais du corps. Pas configurée ⇒ notification seule, et Paramètres → Appareils connectés le dit
  (`alerteEmail` rendu par la liste).
- Aujourd'hui `RELANCES_SMTP_*` n'est pas posé (geste de Julien) : c'est donc la notification seule, dite.

## 7. Page « État de VRM »

- Existait (8–9 nov.) : https://vrm.center/statut — sondes automatiques toutes les 10 min (base, connexion,
  réception et envoi des e-mails, notifications, extension), « Tout fonctionne » ou la panne en mots simples,
  30 jours d'historique et les incidents, aucune donnée d'un vendeur (audit-confiance, audit-statut-auto) ;
  Paramètres → Aide → État de VRM l'ouvre.
- Ajouté : le centre d'aide renvoie vers **/statut** (le pied de chaque page et la fiche « Vérifier que VRM
  fonctionne » menaient à /etat, l'ancienne page minimale) ; `public/aide/` régénéré.
- Pas fait : une sonde « paiement » (Stripe n'est pas configuré : elle dirait « pas su ») ; la « lecture Vinted »
  est couverte par la sonde « extension » (dernier signe de vie de n'importe quelle extension).

## 8. Calendrier fiscal

- `src/calendrierFiscal.js` (une règle, app + serveur) — rien de recalculé : `calendrierUrssaf`, `moisDeclare`
  (`vrm_urssaf_declare`, son clic), `seuilsDe`/`caAnnee` (la ligne publiée), `rappelCfe`.
  - statut pas choisi ⇒ « aucune échéance n'est calculée », dit ; pas micro ⇒ rien ;
  - URSSAF selon SON rythme enregistré (absent ⇒ « choisis ton rythme », jamais le défaut) ; mois déclarés ⇒ « déclaré » ;
  - CFE le 15 décembre ; « exonérée l'année de création » seulement si la date de début est connue
    (`vrm_debut_activite`, 'AAAA-MM' — aucun écran ne la demande encore : donc jamais dite aujourd'hui) ;
  - déclaration de revenus 2042-C-PRO : **dates officielles 2026** recopiées le 16 nov. et citées — ouverture
    9 avril, en ligne zone 1 (01–19) 21 mai, zone 2 (20–54) 28 mai, zone 3 (55–976) 4 juin, papier 19 mai
    (economie.gouv.fr « Impôt sur le revenu : le calendrier de la déclaration en 2026 », impots.gouv.fr « Les
    modalités de la déclaration de revenus en 2026 ») ; 2027 ⇒ « pas encore publiées » ;
  - TVA seulement si le CA déclaré connu dépasse le seuil de franchise de l'année.
- Écran : Argent → Micro-entreprise → « Tes échéances 2026 » (`src/composants/CalendrierFiscal.jsx`), ambre
  seulement pour la prochaine à faire dans les 7 jours.
- Rappel la veille : l'URSSAF avait déjà le sien (`rappelVeilleUrssaf`) ; ajouté **CFE et chaque limite de zone
  de l'impôt** (`api/_lib/rappel-fiscal.js`, cron du matin `ship-reminders`), famille « Rappels » coupable, une
  fois par échéance (réservée avant l'envoi), heures calmes tenues par `sendPushToAll`. Jamais « encaissé ».

## Preuves

- `scripts/audit-confiance-clients.cjs` 30/30 ; `--prouve` : 10/10 mutations rougissent (alerte au premier
  appareil, e-mail sans configuration, adresse prise du corps, régime/rythme/exonération/dates d'impôt devinés,
  TVA toujours, veille sans mémo, aide vers /etat) ; sur l'arbre de `main` : 5/15, rouge.
- Audits voisins verts : agenda-appareil, confiance, confiance-publique, statut-auto, aide-signalement,
  parcours-nouveau, traduction, urssaf. Build vert.
- Banc `suivi-urssaf` : contrôle F (le calendrier : 12 URSSAF en mensuel, CFE, impôt) ajouté — voir l'état à la reprise.

## ÉTAT À LA REPRISE

PR ouverte (voir le rapport). Restes : écran pour la date de début d'activité (exonération CFE), sonde
paiement quand Stripe sera configuré, dates 2027 de l'impôt à recopier quand elles seront publiées (au printemps).
