# Notifications groupées (lot `notifs-groupees`) — 11 novembre 2026

Branche `claude/notifs-groupees` (depuis `origin/main`). Demande : au lieu de plusieurs
alertes séparées, UN résumé actionnable (« 2 colis à poster · 1 colis à retirer ») aux bons
moments. Principe de Julien : « plus beau, simple, surtout PRATIQUE ».

Aucune fonction `api/` de plus (12/12), aucune migration, rien dans l'extension.

## 1. Ce qui existait (lu avant de coder)

- 5 nov. : familles, heures calmes, cloche (`push_journal`), réveil (`reveil-calme.js`).
- 8 nov. : forme commune (`notif-belle.js`), regroupement PAR GENRE sur le téléphone
  (« 3 bordereaux prêts à imprimer » remplace les précédentes) — mais chaque
  notification SONNAIT quand même, une par une.
- 10 nov. : résumé du soir (`resume-soir.js`, cron 18:00 UTC).
- Chaque émetteur dédoublonne déjà SON objet (`push_dedup`, `push_suivi_*`…), pas la porte.

## 2. Ce qui change (tranché par moi, Julien : « tranche le reste toi-même »)

| règle | où | décision |
|---|---|---|
| **Fenêtre** | `api/_lib/notif-groupe.js`, `journal-notifs.js` `deciderEntree` | 15 min par défaut (15 · 30 · 60, ou Non). La 1re sonne tout de suite ; les suivantes attendent (« Dans le prochain résumé ») ; UN résumé à la fin de la fenêtre (jamais repoussée : `attenteJusqua` = dernière sonnerie + fenêtre). |
| Ce qui attend | `enAttentePossible` | seulement les ÉVÉNEMENTS par objet (genres : bordereau, vente, versement, arrivée, offre, message). Un rappel (matin, soir, URSSAF, bilan…) est déjà un résumé : il sonne. |
| **Urgent** | `estUrgent` | échéance (limite d'envoi ou de retrait) dans moins de 24 h, ou double vente : sonne tout de suite, même dans la fenêtre. |
| **Jamais deux fois** | `cleDuJour` + `deciderEntree` | clé = objet + jour de Paris (`cle` de l'émetteur, sinon `tag` + titre propre). Déjà rangée aujourd'hui ⇒ rien envoyé, rien rangé. Le lendemain : de nouveau. L'essai, les signalements et la sécurité n'y passent pas. |
| Atomique | `rangerNotifGroupe` | décision ET rangement dans le même comparer-et-échanger : deux e-mails à la même seconde ne « sonnent pas les premiers » tous les deux. |
| Fin de fenêtre | `vidangerResume` (push.js) | au prochain envoi (fenêtre libre ⇒ il emporte ce qui attendait), ou au passage de 15 min `?moment=groupe` (`.github/workflows/notifs-groupees.yml`, lit seulement les vendeurs `data->>attenteJusqua ≤ maintenant`, projection `select=owner`). |
| Heures calmes | idem | fenêtre échue pendant les heures calmes ⇒ rien ne sonne, les entrées passent « heures calmes » ; le récapitulatif du réveil (déjà là) les dit. |
| Texte | `resumeDeGroupe` | une seule : elle-même ; un genre : le titre du genre ; plusieurs : « 2 colis à poster · 1 colis à retirer » + « Dernier : … ». Un geste par genre (Android ; iOS ouvre le premier). |
| **Chiffres** | `resumeDeGroupe` | jamais recalculés : ce sont les objets annoncés (un par clé), chacun décidé par la règle de son émetteur (§5). Le résumé ne dit pas un total d'écran qu'il ne connaît pas. |
| **Écran exact** | `api/_lib/lien-notif.js` | `DESTINATIONS.colis` → **Ventes** (« À expédier »), `retrait` → **Achats** (« À retirer »), `achat` → Achats. Plus aucune notification ne fabrique `tab=cat_bord`. ⚠️ Sur l'app d'aujourd'hui, la carte du colis vit encore dans Colis : la cible est trouvée **une fois le lot DJ3 (`claude/colis-a-leur-place`) intégré**. À intégrer ensemble. |
| Heure du résumé du soir | — | livrée en parallèle par la décision C8 (`soirHeure`, passage horaire `resume-soir-heure.yml`) : **gardée telle quelle**, ma version (faite avant de la voir) retirée à la fusion pour ne rien doubler. |
| Réglages | `src/ecrans/Reglages.jsx` | Paramètres → Notifications : « Regrouper » Non · 15 min · 30 min · 1 h (l'interrupteur devient ce choix). Par type et heure du soir : déjà là (C8). |
| Cloche | `src/journalNotifs.js` | états « Dans le prochain résumé » / « Dans un résumé ». |

⚠️ Sans le secret `CRON_SECRET` dans GitHub, le passage de 15 min ne tourne pas : le résumé
part alors au prochain envoi du vendeur (le réveil a la même dépendance depuis le 5 nov.).

## 2 bis. Les JOURS calmes (ajout de Julien, relayé par la session principale)

« En plus des heures calmes, des jours calmes au choix (week-end, jours off cochés, ou une
période congés du … au …). Pendant un jour calme, seul l'URGENT passe ; le reste attend et part
groupé au premier moment non calme. »

| règle | où | décision |
|---|---|---|
| Réglage | `push_prefs.calme.jours` (`['sam','dim']`…), `push_prefs.calme.conges` `{ du, au }` (jours de Paris, inclus) | indépendants de l'interrupteur des heures calmes ; Paramètres → Notifications : « Week-end calme » (= samedi + dimanche), sept pastilles L…D, « Congés » Du / au + Effacer. La ligne `calme` est réécrite ENTIÈRE (un réglage n'efface pas l'autre). |
| Une seule règle | `api/_lib/notif-textes.js` : `reglageJours`, `jourCalme`, `calmePourLeJour`, appelée par `dansHeuresCalmes` | le serveur (porte d'envoi, donc TOUS les rappels et e-mails) et l'écran (Paramètres : « Aujourd'hui est calme ») importent la même. |
| L'urgent qui passe | `calmePourLeJour` | échéance (date limite d'envoi ou de retrait) dans moins de 24 h ; `urgent: true` posé par le rappel du matin quand des colis sont dus aujourd'hui ou en retard ; double vente ; panne (`capture` : un compte qui n'arrive plus ; `signalement`). « Deux articles sous le même N° » : aucune notification n'existe pour ça aujourd'hui (les doublons de N° se règlent seuls, §5) — rien à laisser passer. |
| Le reste | `push.js` | rangé « heures calmes » dans la cloche ; une fenêtre de regroupement qui finit un jour calme passe aussi « heures calmes ». |
| Le premier moment non calme | `api/_lib/reveil-calme.js` | le récapitulatif du réveil ne part pas un jour calme ; le premier matin non calme, il compte TOUT ce qui a été gardé depuis le dernier récapitulatif (mémo `push_reveil.seq`, sinon sa date, sinon 30 jours si des jours calmes sont posés), non lu seulement : « Pendant ta pause : 3 notifications ». |

## 3. Preuves

| preuve | résultat |
|---|---|
| `scripts/audit-notifs-groupees.cjs` — avec J1–J10 (jours calmes : week-end, urgent qui passe, réveil EXÉCUTÉ samedi/dimanche/lundi, jours cochés, congés, fenêtre un jour calme) — EXÉCUTE `sendPushToAll` et la VRAIE route `api/ship-reminders.js` (`?moment=groupe`) sur une fausse base (filtres `data->>`, `Range`, comparer-et-échanger), push simulé, horloge de Paris simulée | **39/39** ; sur `origin/main` (`--sur`) **27 rouges** (avant retrait des 3 contrôles du soir) |
| Mutations jours calmes (6/6 rouges) | jours ignorés (10), urgent bloqué (6), congés ignorés (1), réveil un jour calme (4), réveil limité à 24 h (1), `urgent` du rappel ignoré (6) |
| Mutations (7/7 rouges, refaites après la fusion) | fenêtre jamais occupée, idempotence retirée, urgent ignoré, résumé à la fenêtre libre ignoré, clé sans jour, Colis rétabli, heures calmes ignorées au passage |
| banc `centre-notifs` (390 tactile / 1512, clair / sombre) : F5 à F5c (Regrouper) et F10 à F14 (week-end, jour coché, congés, Effacer ; ligne `calme` gardée entière) — 144/144 ; captures regardées (la 7e pastille débordait à 390 px : corrigé) | 114/114 ; captures regardées (un vide de 160 px sous le libellé vu à la capture et corrigé) |
| audits voisins remis à la règle (adresses Ventes/Achats) | `audit-notifications`, `audit-notifs-belles`, `audit-colis-heure`, `audit-suivi-vinted`, `audit-suivi-colis` ; bancs `colis-relais-push`, `retrait-conv-push`, `rappel-soir` |

**Rouges restants (dits, pas cachés)** : bancs de rendu `notifs-destination` (15 rouges ; 9 déjà sur
`origin/main` — URSSAF, double vente réglée, garde-fou) et `cible-evidence` (18). Les rouges en plus
sont les cibles colis : `?tab=ventes&cible=colis…` et `?tab=achats&cible=retrait…` ne trouvent pas la
carte, qui vit encore dans Colis tant que **DJ3 (`claude/colis-a-leur-place`)** n'est pas intégré. À
relancer après l'intégration des deux lots ; s'ils restent rouges, c'est le banc à porter sur Ventes/Achats.

Les bancs qui jugent AUTRE CHOSE que la fenêtre (« une arrivée sonne », adresses…) tournent à
horloge figée : tout tomberait dans la même fenêtre. `scripts/_horloge-notif.cjs` pose donc
`VRM_NOTIF_FENETRE=0` (bancs seulement, jamais en production, comme `VRM_NOTIF_HORLOGE`) ;
l'idempotence reste active partout. `audit-notifs-groupees` ne le charge pas.

## 4. Geste de Julien

Aucun (le secret `CRON_SECRET` est déjà dans GitHub si le réveil fonctionne). Les réglages
sont dans Paramètres → Notifications.

`audit-reveil-calme` pose désormais lui-même l'heure de la route (la route lit l'horloge des notifications, comme l'envoi) : 13/13.
