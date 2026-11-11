# 11 nov. — Toute l'app hors ligne : la file des gestes (lot `hors-ligne`)

Branche `claude/hors-ligne` (pas de PR, pas fusionnée par la session). Demande de Julien,
validée (« incroyable ») : **TOUTE l'app utilisable hors ligne**, au relais, en brocante, au
dépôt, et synchronisée sans conflit au retour. Aucune donnée réelle, aucune écriture dans la
vraie base, extension non touchée, aucune fonction `api/` ajoutée.

## 1. Ce qui existait (et reste)

- Ouverture hors ligne « à froid » (9 nov., `src/porteHorsLigne.js`) : la porte laisse passer
  7 jours un appareil déjà vérifié, la garde refuse toute requête vers la base.
- Ma journée / Colis / relais / dépôt hors ligne (21 oct., 6 nov., 10 nov.) : leur vue dédiée.
- La file d'envoi (2 nov., `src/fileEnvoi.js`) : une saisie faite sans réseau part au retour,
  fusion à trois voies par CLÉ.
- La copie des lignes sur l'appareil (lot K, `src/copieLignes.js`).

Ce qui manquait : les autres écrans hors ligne (ils tombaient sur Ma journée), dire QUEL geste
attend, et ne jamais écraser une valeur qu'un AUTRE appareil a changée pendant la coupure (la
file d'envoi faisait gagner l'appareil, sans un mot).

## 2. Ce qui a été fait

### `src/gestesHorsLigne.js` (module pur, `scripts/audit-gestes-hors-ligne.cjs`, 16/16 mutations)
- Chaque `save` fait hors ligne sur une clé de geste est noté **sous-valeur par sous-valeur**
  (un colis, le prix d'un N°, une note, un achat, un champ d'une fiche) : avant, après,
  identifiant unique, numéro d'ordre. Rangé dans **IndexedDB** (`vrm-gestes`, un registre par
  compte VRM) : survit à la fermeture et au redémarrage. Un geste qui prolonge un geste en
  attente garde son « avant » et son identifiant ; revenu à son avant, il part.
- Clés : colis retiré (`vrm_colis_collected(_at)`, `vinted_pickup_done`), colis fait
  (`vinted_ship_done`, `vrm_lbc_colis_done`, `vrm_vc_colis_done`), déposé
  (`vinted_bords_shipped`), prix d'achat (`vinted_buyprice_by_num`), notes
  (`vinted_achat_notes`, `vrm_notes_paires`), rappels (`vrm_rappels`), nouvel achat
  (`vinted_offvinted_buys`, sa photo comme ligne à part), fiches (`vinted_annonce_numeros` :
  N° saisi à la main, prix, « C'est écrit » des doublons), `vrm_vc_liens` (« C'est écrit »).
- **Rejeu** au retour du réseau, UN PAR UN, dans l'ordre : `main` LUE (lecture ratée ⇒ rien
  écrit) ; identifiant déjà dans `vrm_gestes_faits` ⇒ déjà appliqué (jamais deux fois) ; base
  = valeur du geste ⇒ envoyé ; base = « avant » ⇒ écrit en **comparer-et-échanger sur
  `data.rev`** (devancé ⇒ relu, rejugé) ; base = autre valeur ⇒ ensemble (colis fait des deux
  côtés) d'accord, sinon **À TRANCHER** avec les deux versions, rien écrit, l'appareil reprend
  la valeur de la base. 429 / 5xx / réseau ⇒ arrêt, le geste reste en attente, reprise avec
  attente croissante (2 s → 60 s), rien sauté.
- N° saisi à la main hors ligne : rejoué seulement si aucune autre fiche ne le porte et s'il
  n'est pas entré au pool pendant la coupure ; le pool le reçoit (union). Un **nouveau** N° ne
  se réserve jamais hors ligne.

### Intégration (`src/App.jsx`, `src/copieLignes.js`, `src/ecrans/Achats.jsx`)
- `save` note le geste ; `cloudPush` **attend** le rejeu tant qu'un geste attend (sinon la
  fusion à trois voies réécrirait la valeur de l'autre appareil) ; registre pas encore lu ⇒
  3 s au plus.
- Hors ligne, **tous les écrans** se lisent depuis la copie de l'appareil (`lireAvecCopie` /
  `lireFamilleAvecCopie` avec `horsLigne`, marquées « pas relu ») ; seuls Ma journée et les
  outils du colis gardent leur vue dédiée (`ONGLETS_HL_DEDIES`).
- Pastille de la coque (`GestesHorsLigneCoque`, `data-gestes-hl`) : « Hors ligne · vu à
  hh:mm » · « Hors ligne · 3 gestes en attente » · « Envoi de 3 gestes… » · « Envoyés ✓ » ;
  « 1 geste à trancher · Voir » (bordure ambre : un geste à faire) ouvre la feuille des deux
  versions (« Garder la mienne » / « Garder l'autre »). Hors ligne, la mention de la file
  d'envoi se tait quand la pastille compte déjà (le même nombre une fois, §7).
- Interdits hors ligne, raison dite (`tr('horsligne.interdit.*')`) : tout ce qui part vers
  l'extension / les plateformes (`vmrCmd`), le paiement (`ouvrirStripe`), un N° neuf
  (numérotage auto, doublons, « donner un N° neuf »), les suppressions d'achat.
- Nouvel achat hors ligne : photo gardée dans le registre, envoyée au retour ; pas de N°
  proposé ; « N° au retour du réseau » sur la ligne, le N° est donné au retour (un à la fois,
  réservé au pool).

## 3. Preuves

- Build vert. Audits : variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, quoi-de-neuf, traduction, gestes-hors-ligne (16/16 mutations),
  file-envoi — verts. `audit-file-envoi` jugeait l'orthographe de la coque d'avant
  (`<EnAttenteEnvoi/>` suivi de `{horsLigne ?`) : regex élargie à la coque d'aujourd'hui,
  rougie par mutation (mention retirée ⇒ KO).
- **Banc neuf `scripts/bancs/gestes-hors-ligne.cjs`** : réseau VRAIMENT coupé
  (`context.setOffline`) + base qui avorte, base à état (`routeMain`, PATCH conditionnel sur
  `data->>rev`, garde-fou 017), deux navigateurs pour « deux appareils », écriture TENUE pour
  « pendant ». Scénarios A (fermeture/réouverture hors ligne), B (deux appareils, à trancher),
  C (retour en pleine file + geste pendant le rejeu), D (429 puis 503), E (coupure pendant un
  geste), F (numéros intacts). Résultats : §5.
- Bancs voisins : `hors-reseau.cjs` était rouge AVANT ce lot (mesuré sur la tête de départ :
  « Vérification indisponible » à la réouverture) — le banc servait `{}` à
  `/api/compte?mode=abonnement`, et la porte « à froid » du 9 nov. ne rouvre qu'un appareil
  qui connaît l'abonnement. Le banc sert maintenant l'état de l'abonnement (même correction
  dans le banc neuf).

## 4. Décisions prises seul (dans l'esprit de la demande)

- Une valeur changée des deux côtés n'est jamais fusionnée « au plus récent » : elle revient
  à trancher (« mieux vaut un blanc qu'un faux ») ; seuls les ensembles (fait / retiré /
  déposé) s'accordent d'eux-mêmes.
- La suppression d'un achat est refusée hors ligne (elle passe par la corbeille côté serveur).
- La file d'envoi d'avant reste pour tout ce qui n'est pas un geste (réglages, chiffres
  publiés par les écrans) : elle repart après le rejeu.

## 5. ÉTAT À LA REPRISE

(rempli en fin de session, voir plus bas)
