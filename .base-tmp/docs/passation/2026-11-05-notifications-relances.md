# Notifications personnalisables, centre des notifications, e-mails de l'essai (5 nov. 2026)

Branche `v31-notifs-relances` (depuis `claude/project-review-nsk5su`). Demandes de Julien du
5 novembre (`demandes-2026-11-05.md`, « Précisions du vocal ») :
- **Notifications** : « une meilleure interface, plus pro, personnalisable comme on veut. Cliquer
  une notification amène directement sur ce qui est arrivé, mis en évidence » ;
- **Relances (§10)** : « des e-mails de relance pendant l'essai gratuit sans engagement, pour
  convertir le client ».

Rien de payant sur la clé de Julien (§2.9), aucune fonction `api/` de plus (12/12), aucune
migration (deux lignes `app_data` de plus par vendeur), rien touché dans `vinted-sync-extension/`.

## 1. Les réglages (Paramètres → Notifications du téléphone)

| réglage | rangé dans `push_prefs` | lu par |
|---|---|---|
| **Sept types** : Ventes · Offres · Messages · Colis à poster · Codes de retrait · Double vente · Rappels | `familles.{id}` | `api/_lib/push.js` avant CHAQUE envoi (et toujours `pushCategorieActive` chez les émetteurs) |
| **Heures calmes** (début, fin, heure de Paris ; plage qui passe minuit) | `calme: { actif, debut, fin, sauf }` | idem |
| « La double vente sonne quand même » (allumé par défaut) | `calme.sauf: ['doublevente']` | idem |
| **Regrouper par type** | `regrouper` | idem |

- Une seule règle, `api/_lib/notif-textes.js` (l'app importe la même). Catégorie → type :
  vente, argent → Ventes ; doublevente → Double vente ; expedier → Colis à poster ; colis → Codes de
  retrait ; offre, offremini → Offres ; message, action, favoris → Messages ; soir, urssaf, bilan,
  facture, agentebay → Rappels. `test` (le bouton d'essai) sonne toujours.
- **Héritage** : un type neuf suit l'ancien réglage tant qu'il n'est pas posé (Double vente ← Ventes,
  Rappels ← Compta ; la veille au soir ← Colis à poster, l'agent eBay ← Ventes). Personne ne se
  remet à recevoir ce qu'il avait coupé.
- **Type éteint ⇒ rien envoyé, rien rangé**, même si un émetteur oubliait de demander : la porte est
  dans `sendPushToAll({ cat })` (tous les émetteurs passent désormais `cat` : e-mails, cron du matin
  et du soir, transporteurs, suivi Vinted, favoris, essai).
- **Heures calmes** : rien ne sonne ; la notification est rangée dans le centre avec l'état
  « Heures calmes » (jamais perdue). Pas de rattrapage groupé au réveil (non demandé).
- **Regroupement** : sur le téléphone, une notification par type (`tag: vrm-groupe-<type>`), la
  nouvelle remplace l'ancienne et dit « +N autres dans VRM » — N compté seulement si ce qu'il a lu a
  été relu (sinon rien d'inventé).

## 2. Le centre des notifications (la cloche de l'en-tête)

- **Écrit par le serveur seul** : ligne `push_journal` du vendeur (`api/_lib/journal-notifs.js`),
  `{ n, entrees: [{ seq, at, famille, cat, titre, texte, url, etat }] }`, comparer-et-échanger sur
  `rev`, 150 entrées / 30 jours, `seq` ne redescend jamais. États : envoyée · heures calmes · aucun
  appareil · pas envoyée (clé du serveur absente) · pas reçue (aucun appareil ne l'a acceptée).
- **Ce qu'il a lu : écrit par l'app seule** (`push_journal_lu` : `{ luJusqua, lus }`). Une règle,
  un propriétaire. Le serveur la lit seulement pour le « +N » du regroupement.
- Un journal qu'on n'arrive pas à écrire **n'empêche jamais l'envoi** (un message manqué ne se
  rattrape pas) ; la notification part alors sans numéro.
- La pastille de la cloche = deux scalaires (`n` projeté, `push_journal_lu`) ; relue à l'ouverture,
  au retour sur l'onglet, toutes les 2 min si visible. **Pas su ⇒ aucune pastille** (jamais « 0 »).
- Toucher une entrée : marquée lue, l'app suit son adresse — la même convention que les
  notifications (`?tab=…&cible=…&tx=…`, `api/_lib/lien-notif.js` / `src/cibleNotif.js`) : l'écran de
  l'objet s'ouvre et l'objet est mis en évidence. Aucun nouveau format de cible.
- Une notification touchée sur le téléphone : le serveur joint `notif: <seq>` à la charge, le
  service worker l'ajoute à l'adresse (`public/sw.js`, `avecNotif`), l'app marque CETTE entrée lue
  (`marquerNotifLue`). L'adresse de l'objet reste inchangée (les audits d'adresse restent verts).
- Fichiers : `src/CentreNotifs.jsx` (cloche + feuille, portail, `FermeAuRetour`),
  `src/journalNotifs.js` (règle pure), `src/centre-notifs.css` (échelle Fusion ; seul bleu = non lu).

## 3. Les e-mails de l'essai gratuit (`api/_lib/relances-essai.js`)

| étape | quand (jours de Paris) | contenu |
|---|---|---|
| j1 | jours 1-2 de l'essai | bienvenue + le premier geste (extension, puis Vinted) |
| j3 | jours 3-5 | ce qui n'est PAS encore relié (compte Vinted, e-mails, notifications) — un « pas su » n'est jamais écrit « pas relié » (renvoi vers Comptes liés) ; tout relié ⇒ « tout est relié » |
| j6 | la veille de la fin | « se termine demain », l'abonnement démarre, comment arrêter ; s'il a déjà arrêté : l'accès se ferme, ses données restent |

- Début de l'essai = `abonnements.fin_periode − 7 jours`. Au plus un e-mail par jour, chacun une fois.
- **Porté par le cron du matin** (`api/ship-reminders.js`, après les rappels, jamais le soir) ;
  la réponse du cron résume (`relances: { pret, envoyes, ignores }`, aucune adresse).
- **À qui** : `abonnements.statut = 'trialing'` seulement ; jamais le propriétaire
  (`vrm_reglages.proprietaire` et `VRM_OWNER_UID` ; aucun des deux lisible ⇒ personne) ; jamais
  un essai en mode test Stripe (sauf `RELANCES_ESSAI_MODE_TEST=1`) ; seulement l'adresse DU COMPTE
  (Auth admin), confirmée (`email_confirmed_at`) ; jamais un désinscrit.
- **Un e-mail jamais deux fois** : l'étape est réservée dans `relances_essai` AVANT l'envoi ; non
  confirmée ⇒ rien. Refus SMTP avant le message ⇒ étape libérée (repart au passage suivant) ;
  « incertain » ne se refait pas.
- **Désinscription en un clic** : lien signé (HMAC, clé dérivée de la clé de service) dans le texte
  ET en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` (RFC 8058) →
  `/api/compte?mode=relances&d=…` (GET : page « C'est fait » ; POST : 200). Choix rangé dans
  `relances_essai_choix` (serveur seul) ; réactivable dans Réglages.
- **Envoi** : SMTP d'une boîte de VRM (gratuit avec Gmail + mot de passe d'application), par les
  variables Vercel `RELANCES_SMTP_HOTE`, `RELANCES_SMTP_PORT` (465 par défaut, ou 587),
  `RELANCES_SMTP_UTILISATEUR`, `RELANCES_SMTP_MOT_DE_PASSE`, `RELANCES_EXPEDITEUR` (+ la clé de
  service). **Une seule absente ⇒ rien ne part**, la réponse du cron et Réglages le disent
  (au propriétaire : la liste des variables ; au vendeur en essai : « l'envoi n'est pas configuré »).
  `/api/sante` gagne `relancesEssai: oui/non`.
- Gabarits : aucune donnée réelle (ni nom, ni pseudo, ni montant, ni chiffre de ventes) ; le prix
  n'est pas écrit (« le prix affiché à ton inscription ») tant que Stripe n'est pas en mode réel.
- `api/_lib/smtp.js` accepte des en-têtes en plus (noms simples, valeurs ASCII, jamais From/To/…).

## 4. Preuves

| preuve | résultat |
|---|---|
| `npm run build` | vert |
| `scripts/audit-notifs-centre.cjs` (porte `sendPushToAll` + route du soir EXÉCUTÉES, fausse base, téléphones interceptés) | **27/27** ; sur le code d'avant **20 rouges** ; mutations : porte du type, heures calmes, exception double vente, regroupement, état « pas reçue », héritage ⇒ rouges |
| `scripts/audit-relances-essai.cjs` (cron du matin + `api/compte.js?mode=relances` EXÉCUTÉS, vrai client SMTP contre un faux serveur SMTP local) | **27/27** ; sur le code d'avant : le module n'existe pas (rouge) ; 8 mutations (propriétaire, propriétaire pas su, mode test, désinscription, réservation, adresse non confirmée, signature, configuration) ⇒ rouges |
| `scripts/audit-notifications.cjs` | 31/31 (F5 : sept types ; F6 : héritage) |
| banc `scripts/bancs/centre-notifs.cjs` (390 tactile et 1512, clair et sombre ; captures regardées) | **96/96** ; sur le code d’avant : rouge (32 rouges sur les 40 premiers contrôles, arrêté là : pas de cloche, six types, ni heures calmes, ni regroupement, ni carte de l’essai) ; `reglages-premium` 174/174 après |
| audits voisins (double-vente-ailleurs, suivi-colis, suivi-vinted, transp-notif, mondialrelay-serveur, rappel-urssaf, coherence, csp, vapid, abonnement, fonctions-api, sans-bruit, icones) | inchangés / verts |

⚠️ **Bancs push réparés au passage** : la clé VAPID factice des bancs (`banc-cle-privee-factice`,
23 octets) est refusée par web-push 3.6.7 ⇒ `pushConfigure()` faux ⇒ AUCUN envoi dans ces bancs
(17 rouges d'`audit-notifications` sur `main`). Remplacée dans 19 scripts par une clé factice de
32 octets ; les rouges qui restent (`audit-statut-transporteurs` 3, `notif-messages` 3,
`colis-relais-push` 10, `suivi-colis` 1, `audit-vc-recon` 3) sont identiques sur le code d'avant.

## 5. Gestes de Julien

1. Rien à faire pour les notifications : la cloche apparaît, Réglages → Notifications du téléphone
   porte les types, les heures calmes et le regroupement.
2. Pour que les e-mails de l'essai partent : créer une boîte d'envoi de VRM (ex. Gmail dédiée,
   double authentification + mot de passe d'application), puis poser sur Vercel les cinq variables
   `RELANCES_*` ci-dessus. Réglages → Notifications lui dit ce qui manque. Rien ne partira de toute
   façon tant que Stripe est en mode test (essais en mode test écartés).
3. Relire les trois textes (`texteRelance` dans `api/_lib/relances-essai.js`).

## 6. Ce qui reste

- Pas de récapitulatif « pendant tes heures calmes » au réveil (les notifications sont dans le centre).
- Le regroupement remplace la notification sur le téléphone ; il ne retarde rien.
- Les e-mails de l'essai ne citent pas le prix (lu chez Stripe seulement quand il est conforme aux CGV) ;
  à ajouter quand Stripe sera en mode réel.

## 7. Revue adverse (5 nov., même branche)

Défauts reproduits avant correction, puis corrigés :

1. **La cloche comptait des notifications que la liste ne montre plus.** Le serveur purge le
   journal (30 jours, 150 entrées) mais la pastille se calculait `n − luJusqua` : trois ventes
   non lues de septembre puis une neuve ⇒ cloche « 4 », feuille « 1 ». Reproduit en VM
   (`ajouterEntree` + `nombreNonLues`) et au rendu (banc, journal n=40 gardant 37…40 : cloche
   « 40 », liste 4). Corrigé : le journal porte `depuis` (le plus petit n° gardé, un scalaire de
   plus), l'app le projette (`select=n:data->n,depuis:data->depuis`) et `nombreNonLues(n, lu,
   depuis)` ne compte plus une entrée purgée. `audit-notifs-centre` J7 (rouge sur le code d'avant),
   banc `centre-notifs` G1 (2 rouges sur le code d'avant : « cloche=40 liste=4 »).
2. **Le chemin donné dans l'e-mail de la veille était faux** : « VRM → Réglages → Abonnement »,
   alors qu'Abonnement est un onglet de Paramètres à côté de Réglages, et le bouton s'appelle
   « Résilier » / « Reprendre mon abonnement ». Corrigé (« Paramètres → Abonnement → « Résilier » »),
   comme les renvois « Paramètres → Réglages → E-mails / Comptes liés / Notifications » ; j1 dit
   « dans le même navigateur » et « chaque article » (au lieu de « ce navigateur », « chaque
   paire »). `audit-relances-essai` S6 exigeait l'ancien chemin faux : il exige le bon.
3. **Les e-mails de l'essai n'avaient pas d'heure limite** : ils partent après les rappels de tous
   les vendeurs, dans une fonction coupée à 300 s ; un envoi coupé reste « en cours » et n'est
   jamais refait. `passageRelances({ jusqua })` ne COMMENCE plus d'envoi après 240 s de cron
   (`RELANCES_JUSQUA_MS`), rien n'est réservé, l'étape attend le lendemain. `audit-relances-essai`
   B1-B2 (rouges sur le code d'avant).
4. Banc `centre-notifs` : contexte `fr-FR` / `Europe/Paris`. Les champs d'heure restent affichés
   « 10:00 PM » dans le Chromium du banc (le champ `type=time` suit la langue du NAVIGATEUR, pas la
   page) ; sur un iPhone ou un Chrome en français ils s'affichent « 22:00 ». Non corrigé.

Vérifié sans défaut : un type éteint n'est ni envoyé ni rangé (porte dans `sendPushToAll`, tous
les émetteurs passent `cat`) ; `push_journal` et `push_journal_lu` sont lus/écrits au nom du
vendeur de la requête (serveur : `owner=eq.` + clé de service ; app : RLS `vrm_lecture_privee`
owner seul, aucun des deux ids dans la liste blanche de l'équipe 016) ; `?mode=relances` ne rend
`manque` qu'au propriétaire, n'écrit le choix que pour la session ou le jeton signé ; aucune
adresse dans la réponse du cron ; l'adresse ouverte au toucher est filtrée (`urlSure`,
`entreeSure`) et les valeurs de `lienNotif` passent ce filtre.

Reste (non corrigé, à décider) :
- Le lien « ne plus recevoir ces rappels » désinscrit sur un simple GET (« en un clic », demandé) :
  un antivirus de messagerie qui ouvre les liens peut désinscrire sans clic (RFC 8058 réserve le
  un-clic au POST). Conséquence bornée : moins d'e-mails, réactivable dans Réglages.
- `push_journal_lu` est écrit sans comparer-et-échanger : deux appareils qui marquent lu en même
  temps peuvent perdre un « lu » (l'entrée redevient non lue, rien de plus).
- Une notification tenue pendant les heures calmes ne sonne jamais ensuite (dédoublonnage déjà
  posé) : elle n'existe que dans la cloche.

## 8. Intégration (5 nov.) — le lien de désinscription ne désinscrit plus à l'ouverture

La relecture laissait ouvert : « un antivirus de messagerie qui ouvre les liens peut
désinscrire un compte sans clic ». Corrigé à l'intégration : `GET ?d=` n'écrit plus
rien et montre une page avec UN bouton (`POST ?d=…&page=1`, la page « C'est fait ») ;
le « un clic » du logiciel de messagerie (RFC 8058, `POST ?d=` avec
`List-Unsubscribe=One-Click`) reste. `audit-relances-essai` : 30 verts ; sur l'ancien
`api/compte.js`, D3a et D3 rouges.

## 9. Intégration (5 nov.) — « lu » ne se perd plus entre deux appareils

La relecture laissait ouvert : « deux appareils qui marquent des notifications lues
au même moment peuvent en faire repasser une en non lue » (`merge-duplicates`
aveugle). Corrigé : `ecrireLuNotifs` relit, FUSIONNE (`fusionnerLus`, l'union —
ce qui est lu ne fait que grandir) et écrit en comparer-et-échanger sur `data.rev`
(PATCH filtré `data->>rev`, POST simple si la ligne n'existe pas, 409 ⇒ relire),
trois essais. `scripts/audit-lus-deux-appareils.cjs` exécute les vraies fonctions
avec deux appareils entrelacés : 4 verts ; sur `origin/main` 3 rouges ; `--muter`
3 rouges. Banc `centre-notifs` : sert maintenant le PATCH.
