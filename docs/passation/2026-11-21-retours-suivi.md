# 21 nov. 2026 — Lot 77 « Suivi des retours » (branche `claude/retours-suivi`, ext. 5.431.0)

Choisi par Julien (21 nov.) : pour chaque retour accepté, le n° de suivi du colis RETOUR et son transporteur, les étapes du
colis qui revient, le code de retrait s'il revient en point relais, « Retours en route · N », et à l'arrivée PROUVÉE
« Remettre en ligne » sous SON N°, notification une fois.

## Mesuré d'abord (lecture seule, sa base, projections scalaires)

- 10 transactions à `status` 440 (9 côté vendeur). Aucune ne porte de n° de suivi : `transaction.shipment` n'a que
  `{ id, status, status_title, status_updated_at }`. Ce `shipment` est déjà celui du RETOUR (230 « Bordereau envoyé au
  vendeur », 310 « colis déposé… » sur des ventes livrées avant).
- Aucune ligne `harvest_{uid}_suivi_{tx}` pour une vente : l'extension ne lisait le suivi (`journey_summary`) que des ACHATS.
- Aucun e-mail de retour ne porte de transaction : « Bordereau de retour » et « Retourne ta commande » sont des retours
  d'ACHATS (qu'il renvoie, l'autre sens, `api/_lib/retour-suivi.js` du 15 nov.).
- L'ALLER est connu pour 5 des 9 (`email_bord_{tx}`, `meta->>suivi`).
- ⇒ le n° du retour ne peut venir que d'une lecture de l'extension : le suivi que Vinted montre de CETTE transaction.

## Ce qui est livré

- **Règle unique** `api/_lib/retour-vente-suivi.js` (pure ; l'app, le serveur et l'audit l'exécutent) :
  - la ligne lue est celle du retour seulement si AUCUN de ses n° n'est un n° de l'aller, ET (aller connu OU une étape datée
    après le début du retour = `status_updated_at` de la transaction 440) ; sinon « suivi pas encore lu » ;
  - un n° porté par deux retours ⇒ ni l'un ni l'autre ; deux transporteurs ⇒ le n° courant est dit, tous relient ;
  - étapes : Retour accepté · Expédié par l'acheteur (Vinted « déposé ») · En transit · Au point · Arrivé — des étapes de la
    ligne datées après le début du retour, des e-mails du transporteur du MÊME n° ; au point : lieu, code, date limite LUS ;
  - arrivé = « livré / retiré » du transporteur ou de l'e-mail du même n°, ou SON toucher « Reçu ». Jamais par absence,
    jamais « Commande livrée ! » de Vinted seul (ambigu).
- **Extension 5.431.0** (`capterSuivisRetours`, background.js) : après `capterSuivisAchats`, pour les ventes de CE compte en
  retour (transaction rangée à 440 `user_side: seller`, la vente dans SA liste, ni remboursée ni finalisée), lit
  `/transactions/{tx}/shipment/journey_summary` dans les MÊMES bornes que le suivi des achats (budget « suivi », 6/h,
  2 par visite, mémo 3 h, une requête à la fois, compte de l'onglet) ; range `harvest_{uid}_retour_{tx}` seulement si
  quelque chose change ; l'extension ne juge rien. Étape neuve ⇒ `/api/push { action: 'retour' }` mis dans la file des
  notifications de suivi (même file, clé `uid:tx:r`). Capacité `retoursuivi` à 5.431.0 (`EXT_CAPACITES`, `EXT_ATTENDUE`,
  manifeste, `CODE_VERSION`). ⚠️ **Zips NON régénérés** et `public/extension-version.json` laissé à 5.420.0 (consigne : à
  faire par l'intégrateur).
- **Notification** `api/_lib/retour-vente-notif.js` (route `api/push.js`, aucune fonction de plus) : relit le compte, la
  transaction (440, vendeur), la ligne, l'aller, les e-mails du même n°, applique la règle, réserve `push_retour_{tx}`
  AVANT l'envoi : « Retour arrivé · Remettre en ligne ? », une fois, catégorie « colis », ouvre la vente.
- **App** :
  - lecture `harvest_*_retour_*` (scalaires `meta` + `data->etapes`, 3 états, relue sur l'événement `maj/retour`) ;
  - `retoursEnCours({ suiviDe })` (src/retoursStock.js) : la ligne porte `suiviRetour` ; une arrivée prouvée (transporteur,
    e-mail) vaut « reçu » (`recuPreuve`) ⇒ le chemin d'avant : `retourRevenuSeul` ⇒ remise en stock sous SON N° (porté par
    une autre paire présente ⇒ sans N°, rien deviné) ⇒ « Remettre en ligne » (republication par l'extension sur SON
    toucher, chemin et gardes inchangés) ;
  - « Retours et litiges » : « Retours en route · N » à côté du titre ; sur chaque rangée le transporteur et le n° (ou
    « suivi pas encore lu »), le code et le point s'il attend au point ; étiquettes « En transit », « Au point relais » ;
    la feuille (téléphone) : la frise des 4 étapes, le n°, le point, le code, « Suivre le colis ↗ » ;
  - Achats › À retirer : la rangée « Retours en route · N » (si un retour attend au point, ouvre Ventes) ; la carte du
    colis dont le n° est celui d'un retour dit « Retour de ta vente · N°402 » avec la photo et le titre de la vente
    (`contenuDuColis({ retourVente })`, n° exact, deux retours au même n° ⇒ rien) ;
  - CA : rien de neuf — une vente en retour est déjà `cancelled` (ventesFaites) et pas finalisée (ventesDeclarables) ;
    l'audit le vérifie (sort une fois, aucune ligne négative).
  - « Quoi de neuf » : `retours-suivi`. Textes en 5 langues (`vr.*`, `achats.contenu.retour*`, `achats.retoursEnRoute*`).

## Pas fait / limites

- Leboncoin et Vestiaire : aucun retour n'est lu aujourd'hui ⇒ rien à suivre. eBay : le résumé Post-Order ne porte pas de
  n° de retour (non mesuré) ⇒ les lignes eBay gardent leurs étapes, sans n°.
- Les lignes `transp_*` (lecture chez le transporteur) ne sont pas demandées pour un n° de retour : sources = Vinted
  (journey) + e-mails du transporteur.
- La notification part de l'extension (étape neuve) ; une arrivée prouvée seulement par un e-mail (sans nouvelle lecture
  Vinted) ne sonne pas — l'écran la montre quand même.
- La FORME de `journey_summary` d'une vente en retour n'a jamais été vue : la lecture réutilise le contrat reconnu des achats ;
  forme inconnue ⇒ rien rangé (`retour_forme_inconnue` au diagnostic).

## Preuves

- `node scripts/audit-retours-vente.cjs` : 25 contrôles (identité, 50 retours identiques, N° gardé, conflit, CA, À retirer)
  + 7 mutations toutes rouges (aller, date, absence, partage, numero, livree, contenu).
  (⚠️ `audit-retours-suivi.cjs` est celui des retours d'ACHATS du 15 nov. — gardé tel quel.)
- `scripts/bancs/retours-vente-suivi.cjs` (390 / 1512, clair / sombre) — résultats ci-dessous.

## Geste de Julien

Installer l'extension 5.431.0 (quand l'intégrateur aura fait le zip) et ouvrir vinted.fr : le suivi des retours se lit seul.
