# 24 nov. · Lot suivi-ventes — le vrai suivi des colis VENDUS, du dépôt au versement

Julien (24 nov.) : « retrait des articles vendus, fais un vrai suivi ».
Branche `claude/suivi-ventes` (depuis `origin/main`, avec `claude/style-clair` #1326 et `claude/colis-danger` #1338).

## 1. Mesuré d'abord (lecture seule, projections scalaires, rien de personnel copié)

Colis VENDUS des 60 derniers jours (`email_bord_*` reçus depuis 60 j : 81 bordereaux, dont 46 sans n° de suivi lu) :

| forme du n° | bordereaux (60 j) | ligne `depart_*` lue chez le transporteur | ce qui est lisible |
|---|---|---|---|
| Chronopost `XW…TS` / `ZW…TS` | 17 | 8 | prise en charge (`priseAt`), « Livraison effectuée » (`livre` 6, `retire` 1), nom du point (`lieuNom` 5/7) ; **aucune date limite sûre** |
| Chrono Relais Europe `XU…JF` | 13 | **0** | rien chez le transporteur (forme non lue) : seulement Vinted et les e-mails |
| Mondial Relay (8 chiffres) | 10 | 10 (dont 11 lignes sans état en base, faute de code postal) | prise en charge, « Colis pris en charge en Point Relais », « Colis livré au destinataire » (`retire` 8) ; **pas de nom de point, pas de date limite** |
| Vinted Go `VGS…` | **0** | 0 | (sur les achats : `expiration_time` = date limite SÛRE) |

- `depart_*` toutes dates : **jamais « disponible »** lu à ce jour (le passage au point n'était relu qu'aux crons de 6 h et 19 h,
  et `arriveeAt` n'existe que depuis le 21 nov.) ⇒ « Au point » n'a encore jamais été vu pour une vente.
- E-mails `email_track_*` : aucun pour ces n° de vente (0/41).
- Transactions des ventes : 450 « Commande finalisée » (33), 230 + « Commande expédiée et en cours d'acheminement » (15),
  « Bordereau envoyé au vendeur » (16), annulées (3). Liste « Mes ventes » (60 j) : `completed` 89, « Commande livrée ! »
  19, « expédiée » 18, « La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais » 2
  (AMBIGU, mesuré le 23 nov. : jamais utilisé pour « au point »).

**Ce qui manque, par transporteur** :
- Chronopost : la date limite au point (estimée seulement, `limiteSure:false` ⇒ jamais dite) ;
- Chrono Relais Europe (`XU`) : tout chez le transporteur — le serveur ne lit pas cette forme ; Vinted dit « livrée » ;
- Mondial Relay : le nom du point et la date limite (« N jours restants » est relatif : `limiteSure:false`) ;
- Vinted Go : complet (point, date limite sûre, retrait) — mais aucune vente ne passe par lui aujourd'hui ;
- Colissimo, Relais Colis… : pas lus (décision du 16 nov.).

## 2. La règle — `api/_lib/suivi-envoi.js` (pure, app ET serveur)

`parcoursEnvoi` : Déposé → En route → Au point « nom » (depuis…, à retirer avant…) → Retiré par l'acheteur → Commande
finalisée = argent versé. Chaque étape **seulement de SA preuve lue** :
- Déposé, En route : les preuves de la frise (`preuvesFriseVinted`, src/friseProuvee.js — leur propriétaire) ;
- Au point : la ligne `depart_` du n° de SON bordereau dit « disponible », ou l'a dit avant le retrait (`arriveeAt`
  strictement antérieure au retrait) ; nom du point lu ; date limite seulement `limiteSure` (Vinted Go) ;
- Retiré : `depart_` « retiré » / « livré », sinon la preuve « livrée » de la frise (e-mail du même n°, Vinted « Commande livrée ») ;
- Argent : **seulement** la commande finalisée (450 / texte / `completed`) ; date = versement lu, sinon aucune.
- Une prise en charge datée avant la vente (> 1 j) ⇒ la ligne ne vaut rien (`departProuve`). Un n° ambigu ⇒ l'app ne
  passe aucune ligne (`ambigusFrise`).
- « Colis en danger » : `dangerDuDepart` exporté de `api/_lib/colis-danger.js` (#1338) — `colisEnDanger` l'appelle aussi ;
  une règle, deux lecteurs.
- Retour : `depart_` « repart chez l'expéditeur » (ou « rendu ») ou la bifurcation de la vente ⇒ groupe « retour » (seulement
  si le colis était parti), étapes d'après grisées.

`groupesEnvois` : en route · au point, pas retiré (date limite la plus proche d'abord) · retiré, argent en attente · argent
versé (+ retour) ; couverture `lus / n` (lus chez un transporteur).

## 3. L'écran
- **Tiroir de la vente (Ventes)** : un colis PARTI montre la piste (`src/SuiviEnvoi.jsx` `ParcoursEnvoi`) **à la place** de la
  frise (une piste, jamais deux : les dates ne s'écrivent pas deux fois). Logo du transporteur (40 px), n° de suivi qui ouvre
  la page du transporteur (`lienSuivi`), le point, « depuis », « à retirer avant », le danger, le retour. Avant le départ, la
  frise reste (geste « à déposer »).
- **« Mes envois »** (Ventes / Colis → Envoyés, en haut) : quatre tuiles avec nombre et mini-piste, la couverture
  (« 3 sur 5 lus chez le transporteur ») ; une tuile ouvre SA liste à la place de la liste (date limite la plus proche
  d'abord) ; toucher une ligne ouvre la fiche de la vente (`ouvrirLigne`, contexte vente, par n° de transaction).
- Gris clair, aucun orange : ardoise pour « fait », vert « fait » pour l'argent, pointillé pour « pas su » ; le danger à
  l'encre en gras avec une horloge. `claude/visuel-jeu` n'est pas fusionné : ses couleurs (ardoise, vert) sont reprises,
  pas ses composants. Textes `tr()` : `src/i18n/langues/*/envois.js` (5 langues).

## 4. Les notifications
- Famille **`envois` « Suivi de tes envois »** (`api/_lib/notif-textes.js`, catégorie `envoi`, allumée par défaut, groupe
  « Colis » de Paramètres → Notifications, aperçu réel). Sortes `envoiPoint` / `envoiRetire` (`notif-redaction.js`, 5 langues).
- `passeSuiviEnvoi` : une fois par colis et par étape (`push_dedup`, `envoi-{étape}-{n°}`), seulement d'une lecture
  transporteur de moins de 8 h d'un événement de moins de 3 jours (la première passe ne réveille pas l'historique : 14
  retraits déjà en base), pour le n° d'UNE vente (un bordereau, une transaction, pas annulée), jamais un achat ni un retour ;
  lecture ratée ⇒ rien ; réglage coupé ⇒ rien. Appelée au cron du matin et après chaque visite du passage de 15 min.
- `api/_lib/colis-frequent.js` : le passage de 15 min visite aussi le vendeur d'un colis vendu pris en charge, en route ou au
  point, dans la fenêtre de 21 j, pas relu depuis 6 h — « au point » et « retiré » se savent dans la journée, plus seulement
  à 6 h et 19 h. Aucune fonction `api/` ajoutée (12).

## 5. Preuves
- `scripts/audit-suivi-envoi.cjs` : 41 verts — P (par transporteur, formes mesurées, la VRAIE `preuvesFriseVinted`), G, I
  (50 titres identiques ; l'app ne lit aucune ligne d'un n° ambigu), N, T, C (la VRAIE route `ship-reminders?moment=colis`
  sur une fausse base PostgREST : colis en route visité entre les crons, relu chez Vinted Go, « au point » puis « retiré »,
  une fois chacun). `--prouve` : voir l'état à la reprise. Sur `origin/main` : planté (module absent) ⇒ rouge.
- `scripts/bancs/suivi-envoi.cjs` : 390 / 1512, clair / sombre (voir l'état à la reprise).
- Bancs/audits mis à jour : `audit-colis-danger` (ancres de mutation, « au point » peut sonner aussi), `audit-notifications`
  (F5 : quatorze familles), `bancs/recap-vente` (7011 et 7005 sont partis ⇒ la piste remplace la frise).

## 6. Ce que l'extension devrait lire en plus (pas fait dans ce lot)
- Le suivi Vinted du VENDEUR (détail de la transaction de vente : `shipment` / suivi) donnerait « au point » et la date
  limite pour `XU` et Mondial Relay, que le serveur ne lit pas. Ce serait une capacité nouvelle (`suivivente`) à mesurer
  d'abord sur une vraie réponse.
