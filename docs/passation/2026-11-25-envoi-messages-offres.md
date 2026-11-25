# 25 nov. 2026 — Envoi des messages et des offres depuis VRM (extension 5.452.0, `envoisurs`)

Demande de Julien (25 nov.) : « Améliore l'extension, ça envoie pas bien les messages et les offres. »
Cadre : sa décision du 24 nov. (« faire absolument tout si l'extension est connectée ; sinon on voit sans agir »),
§3 inchangé (compte de l'onglet, 50 actions/h, une requête à la fois, pause 429/403, aucun clic maquillé, pas de débogueur).

Branche `claude/agir-tout` (#1374), après un vrai `git merge origin/main` (#1394 5.440.4, #1395). Puis fusionnée
(vrai merge) dans `claude/messages-pro` (#1383).

## Le chemin réel d'un envoi (lu dans le code)

App : `ComposerReponse` / `GestesOffreVinted` (src/agir/Agir.jsx) → `envoyerGeste` (src/agir/porte.js, porte `peutAgir`)
→ une ligne `cmd_dist_*` (src/aDistance.js) → extension : `distanceTickUn` → `distanceExecuter` → `executerPourApp`
→ `executerPourAppCoeur` (gardes : compte de l'onglet, plafond, pause) → `gesteAppParInterface` → `interfaceVinted`
(onglet de travail, `vrm-formulaire.js` : saisie, « Envoyer », réponse de la PAGE lue) → `distSens` (l'issue écrite dans la
ligne : fait · refusé · pas sûr · attendre) → l'app.

## Les causes trouvées (preuve : `scripts/audit-envoi-messages-offres.cjs`, rouge sur le code d'avant)

| # | cause | effet pour Julien | preuve sur l'avant |
|---|---|---|---|
| 1 | `distSens` jugeait « fait » tout `ok: true` HTTP 2xx, sans regarder le `code` de Vinted | un message bloqué / une offre trop basse refusés par Vinted **dans un 200** étaient notés « Message envoyé » | M2, O2 : `etat: fait` |
| 2 | un arrêt d'une GARDE avant tout envoi (`gardeStricte` : plafond 50/h, pause posée, autre compte, aucun compte) sortait sans `rienParti` ⇒ `distSens` le classait « refusé » pour toujours | le message était **perdu** (à retaper), alors que la file sait attendre (`ADIST_ATTENDRE`) | M6, M7, M7b, M8 : `refuse` |
| 3 | 429/403 LU sur la réponse de la page ⇒ « pas sûr » (status non jugé) ; 401 (session/jeton périmé) idem | « regarde avant de relancer » au lieu de « Vinted demande de ralentir, reprise vers 14 h 10 » / « reconnecte-toi » | M3, M4 : `incertain` |
| 4 | `executerPourAppCoeur` reconstruisait l'objet d'un « rien n'est parti » de la page et PERDAIT `code`, `sansPage`, `robot` | la raison (captcha, onglet fermé, autre compte) ne pouvait pas être dite ni attendue | (couvert par M7, O4) |
| 5 | `repondreOffreInterface` : conversation que Vinted ne rend pas (404 / 503) ⇒ « le fil relu ne montre pas CETTE offre » | phrase fausse ; un 503 passager rendait le refus d'offre définitif | O3, O4 |
| 6 | l'app disait « Parti vers l'extension » et **vidait le champ au DÉPÔT** ; l'issue réelle n'était jamais relue | un « envoyé » faux à chaque échec | T1 |
| 7 | deux touchers sur « Envoyer » pendant le dépôt (la base ne voyait pas encore la 1re ligne) ⇒ deux commandes | le même message parti deux fois | A1 (porte sans garde) |
| 8 | la raison d'une commande REMISE en attente n'était pas écrite (`finirDist` : seulement `attend`) | l'app ne pouvait pas dire « plafond… reprise vers 14 h 10 » | (lu ; A4 juge la phrase) |

Non trouvé en cause (vérifié) : CSRF — depuis la 5.414 aucune écriture n'est fabriquée par VRM ; c'est la PAGE de
vinted.fr qui envoie avec son propre jeton. Un jeton périmé se lit donc 401 sur SA réponse (cause 3, dit et attendu).
L'endpoint : la nouvelle messagerie (`api.vinted.fr/messaging/main/conversations/{uuid}/replies`, observée le 23-24 nov.)
est déjà attendue par `vrm-formulaire.js` (`repMessageNormale`) ; l'offre reste `POST /api/v2/transactions/{tx}/offers`
(Observer Vinted, simulation O1).

## Ce qui est corrigé

- **`distSens`** (background.js) : une réponse de Vinted se juge par `etatGesteVinted` (200 + `code` ≠ 0 ⇒ « refusé »
  avec les mots de Vinted, jamais « fait », jamais renvoyé) ; un « rien n'est parti » certain (garde, page, frein lu) ⇒
  `attendre` avec un code de la file (`plafond`, `vinted-pause`, `vinted-autre`, `vinted-absent`, `onglet-vinted`,
  `verification`, `session`, `lecture`) et **l'heure de reprise** (`attendreMs`, « reprise vers 14 h 10 ») ; 5xx / pas de
  réponse ⇒ « pas sûr », **jamais** remis en attente (peut-être parti : jamais deux fois).
- **`executerPourAppCoeur`** garde `code`, `sansPage`, `robot`, `pause` ; sur 429/403 lit la pause posée et dit l'heure ;
  401 ⇒ `RAISON_SESSION_EXPIREE` (« reconnecte-toi sur vinted.fr (ce compte) »).
- **`repondreOffreInterface`** : conversation non rendue ⇒ 5xx/réseau : attend (`lecture`) ; 4xx : « ouvre-la sur
  vinted.fr pour y répondre » (`conversation-illisible`).
- **`finirDist`** écrit la raison d'une remise en attente.
- **App** : `src/agir/suivi.js` (pur) + `suivreCommande` / `useSuiviCommande` (porte.js, lecteur `lireUneCommande` posé par
  App.jsx) : après « Envoyer », la ligne dit l'issue RÉELLE (en file · pas encore parti : raison · en cours · « Envoyé :
  Vinted l'a confirmé » · « Pas envoyé : … » · « Pas sûr : regarde la conversation… »). Le champ ne se vide qu'au « fait » ;
  pendant l'envoi, aucun second geste (Répondre et gestes d'offre). `envoyerGeste` refuse un second dépôt identique en vol.
  Textes `agir.suivi.*` en 5 langues.

## Preuves

- `node scripts/audit-envoi-messages-offres.cjs` : **21 verts**. Le VRAI background.js dans un `vm`, la commande jouée par
  `distanceExecuter` jusqu'à la page de l'onglet (fausse page, faux Vinted à la forme réelle). M1-M8 (message), O1-O5
  (offres), A1-A5 (porte et suivi, VRAI src/agir/porte.js + suivi.js), T1.
- Code d'avant (`git archive 530691494`, audit copié dedans) : **13 rouges** (M2, M3, M3b, M4, M6, M7, M7b, M8, O2, O3, O4, A,
  T1) ; M1, M5, O1, O5 verts des deux côtés (l'autre sens).
- `--prouve` : **6/6 mutations** rougissent (refus-200-fait, garde-perdue, frein-muet, lecture-offre, double-depot,
  suivi-menteur).
- Toujours verts : audit-a-distance, audit-exec, audit-agir-si-connecte, audit-actions-app, audit-argent-vinted,
  audit-offres-sures, audit-tout-interface, audit-envoi-fil, audit-contre-offre-mini, audit-extension-porte-app,
  audit-actions-gardees, audit-traduction, audit-coherence, audit-extension-zip ; build.

## Version

**5.452.0** (capacité `envoisurs`, fonction `heureReprise`) — au-dessus de toute version servie (5.440.4) et ouverte
(#1372 = 5.451.0, #1374 avant = 5.450.1). CODE_VERSION, manifeste, lbc-inject.js, lbc-relay.js, EXT_ATTENDUE,
EXT_CAPACITES, `public/extension-version.json`, zips régénérés.

## Ce qui reste (honnête)

- La relecture d'une conversation d'offre passe encore par `GET /api/v2/conversations/{n°}` (ancienne messagerie). Si
  Vinted la retire pour toutes les conversations, accepter/refuser depuis VRM dira désormais « ouvre-la sur vinted.fr »
  (plus de phrase fausse) — il faudra alors lire l'offre dans `messaging/main/conversations/{uuid}` (forme des messages
  d'offre jamais relevée : à mesurer avec « Observer Vinted » pendant une réponse à une offre).
- Accepter depuis VRM exige toujours la garde anti double-vente fraîche (`vinted_offres_garde`) ; sinon refus « vérifie ».
- Le JS +234 Ko, `localStorage` (iphone-reprise), `data-a-ranger`, délais des bancs listés par la passation générale : voir
  l'état CI dans le rapport de la session.
- Mesure réelle possible (lecture seule, pour Julien) :
  `select id, meta->>'geste' geste, meta->>'etat' etat, meta->>'code' code, meta->>'raison' raison, meta->>'attend' attend
   from app_data where id like 'cmd_dist_%' and meta->>'geste' in ('repondre','accepter','refuser','contreOffre')
   order by id desc limit 50;`

## Geste de Julien

Installer l'extension **5.452.0** une fois #1374 en ligne (remplacer le dossier, ⟳ dans CHAQUE Chrome ; Orion :
`VRM-Orion-dossier.zip`). Puis répondre à un message depuis VRM : la ligne sous « Envoyer » doit finir par « Envoyé :
Vinted l'a confirmé » (ou dire pourquoi pas).
