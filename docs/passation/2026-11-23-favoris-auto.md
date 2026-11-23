# 23 nov. 2026 — Extension 5.440.0 : messages aux favoris sans aucun geste, nouvelle messagerie de Vinted, fenêtre d'envoi refaite

Branche `claude/favoris-auto`. Capacités `reperage`, `clocheauto`,
`messagerieuuid`, `fenetrefavoris` = **5.440.0** (5.439 réservée à un autre lot).

## Ce que Julien a vu (5.438 installée, 23 nov. 07:30–07:32)

- La fenêtre « VRM · en cours sur Vinted » restait à « 0 sur 5 », « Page pas prête : nouvel essai 1/2 dans 3 s ».
- Puis une bulle « Touche le bouton « Notifications » de la page — Vinted a changé ce bouton : montre-le une fois,
  VRM s'en souviendra » et, dans la fenêtre, « Vinted a changé le bouton « Notifications » : touche-le une fois
  dans l'onglet de travail ». L'onglet de travail était sur `vinted.fr/inbox/01a1fdff-71a1-…` (un **uuid**).
- Ses mots : « l'app doit s'adapter toute seule au bouton favoris ; si elle est capable de les capter elle est
  capable d'envoyer » ; puis « comme Bleam : ouvre la cloche, touche la notification, ouvre la conversation et
  envoie » ; « rends-la intelligente, après on s'attaque à la republication ».

## Ce qui a été MESURÉ (vraie base, lecture seule, formes seulement)

`panel_diag_capture` (5.438, 06:36) et `harvest_3175765377_seen_urls` (relevé passif de la page) :

| constat | chiffre / forme |
|---|---|
| la cloche introuvable dans l'onglet de travail | `formulaire_selecteur_cloche` 18, `interface_favoriOuvrir_rien_cloche` 5, `formulaire_reessai_favoriOuvrir` 10 |
| Julien a bien « montré » la cloche | `appris_cloche` 3 — et ça n'a pas suffi |
| la liste de la cloche lue par VRM sur **www** | `GET /inbox-notifications/v1/notifications` → **404** (`favori_cloche_illisible_404` 9) |
| la même liste lue par la PAGE | `GET api.vinted.fr/inbox-notifications/v1/notifications` → **200** (`notifications[]`, `pagination`) |
| ouverture d'une conversation depuis la cloche (par la page, 06:33:40) | `POST api.vinted.fr/messaging/main/inquiries` → **201** `{inquiry_id, transaction_id, conversation_id (texte), read_after_write_token}` |
| relecture par la page | `GET api.vinted.fr/messaging/main/conversations/{uuid}` → `{id (texte), core_id_deprecated (nombre), opposite_users[], data.items[], messages[], allow_reply, …}` |
| message | `POST api.vinted.fr/messaging/main/conversations/{uuid}/replies` → `{id, data.content, conversation_id, message_type, …}` |
| offres | toujours `core.vinted.fr/api/v2/transactions/{id}/offers/…` (même chemin qu'avant) |
| notifications de favori captées | `entry_type` 20, `link` = `/items/N/want_it/new?offering_id=N` |

**Conclusion** : Vinted a basculé sa messagerie. Même la cloche trouvée, la 5.438 n'aurait rien envoyé : elle attendait
`POST /api/v2/conversations` et `/inbox/{nombre}`, puis `…/conversations/{nombre}/replies` ; elle ne voyait ni l'une ni
l'autre et s'arrêtait (« conversation pas ouverte », puis « identité »). C'est la VRAIE cause de « 0 sur 5 ».

## La décision de méthode (et pourquoi pas « les requêtes de la page »)

La mission proposait de faire partir le message par des requêtes fabriquées depuis l'onglet (`vintedPage`). **Non** :
Julien a décidé le 21 nov. (5.414, `toutinterface`, mot pour mot : « on ne fait plus les requêtes ») qu'aucune
écriture Vinted ne part d'une requête de VRM ; `vintedPage` refuse toute méthode ≠ GET. Et sa précision du jour
(« comme Bleam : ouvre la cloche, touche la notification ») va dans ce sens. Donc : **c'est la page de Vinted qui
écrit, quand VRM clique dans l'onglet de travail** ; VRM ne fait que des LECTURES (GET) et lit les réponses que la
page reçoit. Les adresses de la nouvelle messagerie ne sont jamais appelées en écriture par VRM.

## Ce qui est livré

### 1. Une couche de repérage commune : `vinted-sync-extension/vrm-trouver.js` (`reperage`)
- `__vrmTrouver.trouver(nom, ctx)` / `.attendre(nom, ctx, ms, captcha)` dans le monde de la page, injectée avant
  `vrm-formulaire.js` (appel séparé : un ancien paquet sans elle garde les règles d'avant).
- Éléments : `cloche`, `voirTout`, `champMessage`, `envoyer`, `boutonOffre`, `offreValider`. Chaque élément a plusieurs
  **stratégies pondérées** (nom accessible exact en 5 langues, data-testid partiel, adresse du lien, icône — classes,
  `data-testid`, `<use href>`, `<title>` du SVG —, rôle, position dans l'en-tête, compteur), un **contexte** (l'en-tête
  pour la cloche, le formulaire du champ pour « Envoyer », la fenêtre pour « Proposer ») et des **exclusions** (jamais
  une ligne de notification — lien portant un article ou une personne —, jamais « Voir tout », jamais ce que VRM pose).
- **Un seul gagnant** : meilleur score, seul ; deux au même score ⇒ `ambigu`, rien n'est cliqué. L'élément cliquable le
  plus extérieur (l'icône dans son bouton compte pour le bouton).
- **Attente** : relu à chaque mutation du DOM (au plus toutes les 120 ms) et toutes les 400 ms, 12 s pour la cloche.
- **Mémoire automatique** : la stratégie gagnante rendue au fond (`o.trouves`, `o.verPage` = buildId de la page) est
  rangée dans `chrome.storage.local.vrmTrouve` (par élément ET version de Vinted ; nouvelle version ⇒ mémoire vidée) et
  repassée (`d.memoire`) : elle passe devant à score égal. **Aucun geste demandé.**
- **Journal** quand rien ne correspond : `vrmTrouverJournal` (40 au plus : élément, étape, chaque stratégie et le nombre
  de candidats qu'elle a vus — jamais un texte) + compteurs `trouve_rien_<élément>` / `trouve_<élément>_<stratégie>`.
- Branchée dans `vrm-formulaire.js` : la cloche (toujours) ; le champ du message, « Envoyer », « Faire une offre »,
  « Proposer » quand la règle d'avant ne voit rien (repli, mêmes exigences d'unicité).

### 2. La cloche trouvée seule, et des chemins de secours sans question (`clocheauto`)
- `favoriOuvrir` : la couche de repérage cherche la cloche 12 s. Une cloche qui est un **lien** vers la page des
  notifications ⇒ rendue au fond (`voirTout`), qui ouvre la page complète.
- Introuvable sur la messagerie ⇒ l'onglet de travail va sur **l'accueil de Vinted** (`favoriAccueil`, l'en-tête
  complet), puis la **page complète des notifications** (chemin LU sur la page et retenu, `vrmPageNotifs`, sinon
  `/member/notifications`). Partout introuvable ⇒ arrêt nommé, avec le journal. Une étape « cloche » n'est plus
  réessayée deux fois (elle a déjà attendu 12 s).
- **Plus jamais « touche le bouton »** : `cloche` retiré des éléments apprenables ; les étapes des favoris
  (`favoriOuvrir`, `favoriListe`, `favoriAccueil`, et `message` / `offre` lancés par les favoris, `favori: true`) ne
  lancent jamais `apprendreElement`. La phrase « Page pas prête : nouvel essai 1/2 » devient « La page Vinted finit de
  se charger : nouvel essai dans N s » (5 langues). L'apprentissage reste pour la republication (choix 102), hors favoris.
- La liste de la cloche lue avant chaque favori (séquence Bleam) : sur `api.<domaine>` (`adresseClocheVinted`).
- Une page « complète » qui ne montre AUCUNE ligne de notification n'est pas la liste ⇒ `notifications-introuvables`
  (rien sauté à tort comme « trop ancien »).

### 3. La nouvelle messagerie, par identité (`messagerieuuid`)
- `inject.js` (`noteConvCore`) retient, **dans la page seulement**, uuid → `core_id_deprecated` (+ personnes, articles) en
  lisant la réponse de Vinted à SA relecture de la conversation.
- `favoriOuvrir` attend `POST /api/v2/conversations` **ou** `POST …/messaging/main/inquiries` ; la conversation montrée
  sur `/inbox/{uuid}` n'est reconnue que par l'ancien n° que la page a lu (`coeurDe`) ; l'uuid de la création doit être
  celui de la page ; rend `conv` (ancien n°), `route` (uuid), `tx`.
- `surConv(conv, d)` remplace « l'adresse est `/inbox/{conv}` » dans `message`, `offre`, `repondreOffre`, `bordereau`,
  `evaluation`, `ouvrir` : l'ancien n° dans l'adresse, ou l'uuid dont la page a dit CET ancien n° (ou l'uuid passé par le
  fond, appris de la même page) ; une autre conversation ⇒ `identite`, rien tapé.
- Le message : réponse de l'ancienne OU de la nouvelle adresse ; la nouvelle (`conversation_id` = l'uuid de la page,
  2xx) est lue comme acceptée (`code: 0, nouvelle: true`) — puis toujours la preuve à l'écran.
- Fond : `vrmConvRoutes` (ancien n° → uuid, appris, 300 au plus) ; les gestes par conversation ouvrent l'uuid connu ;
  une autre conversation uuid ouverte dans l'onglet fait naviguer (`re` strict), un renvoi de Vinted vers l'uuid après
  navigation est accepté puis vérifié par la page (`reApres`).
- Vérification avant d'écrire : la relecture d'avant (`GET /api/v2/conversations/{n°}`) ; si Vinted la refuse pour une
  conversation de la nouvelle messagerie ⇒ `GET api.<domaine>/messaging/main/conversations/{uuid}` traduite
  prudemment (`filDepuisMessagerie` : CET ancien n°, UNE personne, UN article ; messages de forme inconnue ⇒
  « historique non vérifié », jamais « vide » ; aucun pseudo lu).

### 4. La fenêtre d'envoi refaite (`fenetrefavoris`, `vrm-action.js`)
- Montée quand l'état porte les lignes de la file (`lignes`, calculées par `lignesFavoris` depuis la file du serveur
  `st.jobs` et la notification choisie de chaque article `items[].n` — jamais un titre) ; sinon l'écran d'avant.
- Haut : « VRM · Messages aux favoris » et « Réduire » discret. L'article en cours : photo, titre (jamais le pseudo de
  l'acheteur), l'étape en mots simples (« Ouverture de la conversation… », « Vérification de la conversation… »,
  « Envoi de l'offre… », « Écriture du message… », « Envoi du message… », « Message envoyé ✓ », « Ensuite dans 1 min… »).
- « 2 envoyés · 1 sauté · 2 restants », la barre, puis CHAQUE ligne : vignette, titre, étiquette (Envoyé vert ·
  Sauté / Pas envoyé / À vérifier ambre + raison courte · En cours encre · En attente gris · Annulé).
- « Pause » = le seul bouton plein (pause après le favori en cours ; en pause ⇒ « Reprendre »), « Tout arrêter » secondaire.
- Fin : le bilan RESTE jusqu'à « Fermer » (avant : un ✓ effacé en 1,6 s) — « Envoi terminé », « Envoi arrêté »,
  « … l'onglet de travail de VRM a été fermé », « Envoi interrompu » ; « N non envoyés ».
- Style noir encre (jetons `--vu-*` du panneau : plein à l'encre, vert = fait, ambre = à regarder, gris = attente, aucun
  bleu, aucune capitale), 390 et 1512, clair et sombre. Textes en 5 langues (`fa_*` dans `vrm-ui.js`).

### 5. Vestiaire : la notification de l'ordinateur à chaque décision de modération (demande du 23 nov.)
- La 5.439 appelait déjà `chrome.notifications.create` quand Vestiaire tranche (`transitionModVc` : validée, refusée,
  à corriger) mais **rien ne s'affichait** : la permission `notifications` manquait au manifeste et l'icône demandée
  (`icon128.png`) n'existe pas (le fichier est `icon-128.png` — même défaut dans deux autres notifications, corrigé aussi).
- 5.440 : permission ajoutée (Chrome, Edge, Firefox ; retirée des paquets Safari et Orion, qui ne l'ont pas : repli
  silencieux), texte court dans la langue du navigateur (« Vestiaire a validé : <titre> », « … a refusé : … »,
  « … demande une correction : … », 5 langues), une notification par CHANGEMENT d'état (l'événement ne naît qu'à la
  transition), un clic ouvre `vrm.center/?tab=plat_vestiaire`. Justifiée dans les trois fiches des boutiques.
- Chrome n'affiche AUCUN avertissement pour cette permission (elle n'en a pas) : rien à expliquer dans la fenêtre.
- Preuve : `scripts/audit-vc-notif-moderation.cjs` (6 verts ; 4 rouges sur la 5.439 de `main` ; `--prouve` 2/2).

## Ce qui n'a PAS été fait, et pourquoi
- **Vrais clics par `chrome.debugger` + rythme « humain »** (demandés en cours de lot) : la permission de cette session
  l'a REFUSÉ (outil d'exécution bloqué) — il s'agissait de faire passer l'automatisation pour une personne auprès de la
  protection anti-robot de Vinted (DataDome). Rien n'a été écrit pour cela, aucune permission `debugger` ajoutée, le §3
  de CLAUDE.md (« Piloter souris / clavier » refusé) est inchangé. Les clics restent ceux de la 5.414 (dans la page,
  `isTrusted:false`, assumés).
- **Comportement « humain » pendant la file** (lire avant de taper, souris qui bouge, visites de la messagerie, du
  dressing, de l'accueil…) : même but (paraître humain auprès de Vinted), pas fait pour la même raison.
- **Garde-fous retenus par Julien** (2 : modèles en rotation, jamais le même texte deux fois de suite ; 4 : ralentir
  seul au moindre signe ; 6 : relances permises mais jamais deux fois le même texte à la même personne pour le même
  article) : version **5.441.0 réservée**, pas commencée. Ce qui existe déjà : versions personnalisées tirées sans
  jamais répéter la dernière version de l'acheteur ni du compte (5.369 / 5.417, `choixMessageFavori`) ; la note de santé
  qui réduit la cadence seule après une vérification, un refus, une annonce masquée (5.438) ; chaque favori une fois
  (jeton du serveur) ; 15 messages/h/compte (inchangé).

## Les cas réels, un par un

| cas | ce que fait l'extension | ce que dit la fenêtre | preuve |
|---|---|---|---|
| onglet de travail sur `/inbox/{uuid}` (la capture) | reste sur la messagerie, cherche la cloche 12 s ; absente ⇒ accueil ⇒ page complète | « Ouverture de la conversation… » puis l'étape suivante | `audit-ext-cloche-favoris` K10, K11 ; banc P1–P3 |
| onglet sur une annonce `/items/…` | `favoriOuvrir` exige `/inbox` ⇒ l'onglet de travail y navigue d'abord | idem | règle `GESTES_INTERFACE` (inchangée) |
| onglet sur l'accueil | idem (`/inbox`), puis l'accueil en secours | idem | idem |
| page pas encore chargée | attente sur les mutations (12 s) avant de dire « introuvable » ; une étape non-cloche garde 2 nouveaux essais | « La page Vinted finit de se charger : nouvel essai dans N s » | banc P1–P3 (en-tête monté après chargement) |
| favori d'un article vendu entre-temps | rien n'est ouvert (`annonce_indisponible`) | ligne « Sauté · Plus en vente » | règle d'avant ; banc F1 |
| conversation déjà existante | la page l'ouvre sans création ; auto ⇒ sautée ; manuel avec un message ⇒ « déjà contacté » ; forme inconnue ⇒ rien | « Sauté · Déjà contacté » / « Pas envoyé · Conversation déjà commencée — rien n'est parti » | règles d'avant + `filDepuisMessagerie` |
| 429 de Vinted | pause posée (`vrmPauseVinted`), rien ne repart avant | « Pas envoyé · Vinted demande une pause » | `audit-favoris-auto`, `audit-comme-bleam` (inchangés, verts) |
| captcha / vérification | arrêt net, file en pause, « Reprendre » sur son toucher | carte « vérification » (inchangée) | `audit-comme-bleam` R10, `captcha-visible` |
| mauvais compte dans l'onglet | garde stricte : rien ne part, la file attend | « Pas envoyé · Un autre compte est connecté » | `audit-favoris-auto` |
| onglet de travail fermé en plein envoi | la file s'arrête chez VRM, rien ne repart | « Envoi arrêté : l'onglet de travail de VRM a été fermé » | règle 5.410.7 ; banc F (titre de fin) |
| extension rechargée en plein envoi | la fenêtre disparaît (contexte mort) ; un favori « en cours » devient « à vérifier », jamais refait | « À vérifier · Regarde la conversation sur Vinted » | règle 5.433 (file) ; banc F5 |

## Garde-fous (§3) — inchangés, revérifiés
Compte de l'onglet (`garde`/`gardeStricte`, revérifié juste avant chaque geste), 15 messages/h/compte
(`FAVORIS_HEURE_MAX`), 50 actions/h réserve 5 (les 3 écritures d'un favori réservées d'un coup), une requête / un geste
à la fois (`requeteVinted`, file), pause 429/403, arrêt au captcha visible, articles encore en vente, chaque favori une
fois (jeton du serveur), aucun pilotage de la vraie souris ni du clavier (clics `isTrusted:false` DANS la page, comme
depuis la 5.414). Aucune écriture par requête de VRM (`audit-tout-interface` vert).

## Preuves
- `scripts/bancs/favoris-auto.cjs` (nouveau) : **70 verts** — P1–P8 (trois en-têtes, lien de cloche, aucune cloche + journal,
  lignes d'autres favoris, deux cloches ⇒ ambigu, lignes jamais prises pour la cloche), M1–M4 (trois composeurs de la
  nouvelle messagerie, mauvaise conversation ⇒ rien), F1–F6 (fenêtre en cours / attente / sauté / pause / terminé /
  arrêté, 1512 et 390, clair et sombre). Sur l'extension de `main` (5.439) : **29 rouges**. `--prouve` : **6/6** mutations
  rouges. Captures regardées une à une (titre long qui chevauchait l'étiquette à 390, « Fermer » à demi-largeur, feuille
  pas pleine au téléphone : corrigés, et le banc le contrôle).
- `scripts/audit-ext-cloche-favoris.cjs` : 32 verts ; K7 porté (introuvable PARTOUT), K5 porté (en double partout),
  K10 / K11 nouveaux ; `--prouve` 8/8 mutations rouges (dont `sans-accueil`, `cloche-reessayee`, `sans-liste-finale`).
- Audits voisins verts : tout-interface, comme-bleam (R8 porté : `vrm-trouver.js` est injecté au même endroit que
  `vrm-formulaire.js`), contrat-messages, onglet-travail, favoris-auto, coherence, ext-5438 (D9 porté : « 5.438 ou
  plus »), action-plein, couleur-panneau, ext-boutique, politique-hotes, file-actions, reprise-offres, extension-feuille,
  modif-avant-apres, formulaire-rythme, arrets-formulaire, aussi-interrompu, quoi-de-neuf.

## Ce qui n'est PAS vérifiable sans son vrai compte
1. **Le vrai en-tête de Vinted** : le DOM réel de la cloche n'a jamais été relevé (seulement ses requêtes). Les trois
   variantes du banc sont plausibles, pas mesurées. Si aucune stratégie ne la voit, le journal `vrmTrouverJournal` et les
   compteurs `trouve_rien_cloche` diront ce qui a été vu ; l'accueil puis la page complète sont essayés avant l'arrêt.
2. **Le chemin de la page complète** des notifications (`/member/notifications` par défaut) : jamais observé ; il est
   retenu dès que la page montre « Voir tout » ou un lien de cloche.
3. **Le clic sur la ligne d'un favori dans la nouvelle messagerie** : mesuré une fois (`inquiries` 201, 06:33:40), sans
   savoir si ce clic était le sien ou celui de VRM ; la forme du corps envoyé par la page n'est pas connue.
4. **`GET /api/v2/conversations/{ancien n°}`** pour une conversation créée par `inquiries` : pas su (dernière réponse 200
   le 18 oct.). Si Vinted la refuse, la lecture de la nouvelle messagerie prend le relais — mais les sous-champs
   `opposite_users[].id` et `data.items[].id` sont supposés (seule leur présence est mesurée) : s'ils diffèrent, rien ne
   part (« conversation pas vérifiée »), jamais un message au hasard.
5. La lecture `api.vinted.fr` depuis l'onglet `www.vinted.fr` par VRM (cookies, CORS) : la page le fait ; VRM le fait de la
   même page, mais ce n'est pas mesuré. Un échec n'arrête rien (la liste de la cloche est facultative).

## Pour la republication (la suite annoncée par Julien)
Brancher sur `__vrmTrouver` (une entrée par élément dans `ELEMENTS` de `vrm-trouver.js`, puis `attendreN` →
`T().attendre`) : `vendre` (`header-upload-item-button`), `titre`, `description`, `prix`, `photos` (champ de fichiers),
`categorie` / `categorieRecherche`, `marque`, `taille`, `couleur`, `etat`, `colis`, `brouillon`
(`upload-form-save-draft-button`), `ajouter` (`upload-form-save-button`), `supprimer` (`item-delete-button`),
`supprimer-confirmation`, `enregistrer`, `masquer` / `afficher`. Garder : un geste irréversible jamais sur un repli
douteux (un seul gagnant, contexte du formulaire), et l'apprentissage par son clic (choix 102) reste possible pour la
republication — à décider avec lui.

## Geste de Julien
Installer la 5.440.0 (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : son zip), relancer les messages aux
favoris, et me dire ce que la fenêtre affiche sur chaque ligne. Rien d'autre (plus de bouton à montrer).

## ÉTAT À LA REPRISE
- PR #1308 (`claude/favoris-auto` → `main`), 5.440.0, zips régénérés. Passe complète `lancer-audits` locale : 57 rouges,
  TOUS rouges aussi sur `origin/main` (comparés un par un ; sous-lignes identiques à la ligne près — `preuve-vente` et
  `vocabulaire-article` ne diffèrent que par les numéros de ligne, `safari` par le nom haché du paquet) ; deux « instables »
  (`ext-arrets-formulaire`, `extension-zip`) verts seuls.
- 5.441.0 réservée pour les garde-fous retenus par Julien (modèles en rotation, ralentir au moindre signe, jamais deux
  fois le même texte à la même personne pour le même article) — pas commencée.
- Le geste qui reste : Julien installe la 5.440.0 et dit ce que la fenêtre affiche ligne par ligne ; s'il reste un
  arrêt « cloche », lire `vrmTrouverJournal` (chrome.storage.local) et les compteurs `trouve_*` de `panel_diag_capture`.
