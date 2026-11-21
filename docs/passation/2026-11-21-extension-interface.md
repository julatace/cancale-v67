# 21 nov. 2026 — Extension 5.414.0 : plus AUCUNE écriture Vinted par requête (`toutinterface`)

Branche `claude/extension-interface`. Capacité `toutinterface` (5.414.0) dans `EXT_CAPACITES`, ligne §8 de CLAUDE.md.
Les zips ne sont PAS régénérés (l'intégrateur le fait).

## La décision de Julien (21 nov., mot pour mot ou presque)

> « Tout doit être parfait et irréprochable, surtout l'extension quand elle republie et envoie des messages aux
> favoris : elle ne doit pas se tromper, elle a le contrôle du clavier et de la souris. Comme on a dit, on ne fait
> plus les requêtes. »

Traduction : une ÉCRITURE chez Vinted (méthode ≠ GET) ne part plus JAMAIS d'une requête fabriquée par VRM (ni `fetch`
du service worker, ni `fetch`/XHR de la page lancé par VRM). Elle part de la PAGE de vinted.fr, quand VRM clique et
tape dans l'**onglet de travail** (`vrm-formulaire.js`, clics `isTrusted:false` ASSUMÉS, aucun maquillage). Les
LECTURES (GET) restent permises, dans leurs budgets.

## Comment c'est construit

- **La porte** : `vintedPage` et `vintedSend` refusent toute méthode ≠ GET (rien ne part, `rienParti`, la phrase
  `RAISON_ECRITURE_REQUETE` est dite). `vintedPagePhoto`, `televerserPhotosRecreer`, le XHR d'écriture de la 5.410.8 et
  le `POST /web/api/auth/refresh` sont RETIRÉS.
- **Un geste = `interfaceVinted(acc, geste, données)`** (background.js) : dans la file Vinted (`requeteVinted`, un à la
  fois, pause 403/429, arrêt robot), onglet vinted.fr du compte (`pageVintedPour`), onglet de travail
  (`ongletTravailVinted`), la BONNE page ouverte (identifiants dans l'adresse : `/inbox/{conv}`, `/items/{id}`,
  `/items/{id}/edit`), le compte de l'onglet REVÉRIFIÉ juste avant le geste, puis UNE étape de `vrm-formulaire.js`.
  Le résultat est rendu sous la forme d'une réponse de Vinted (celle que la PAGE a reçue) + `vu` (la preuve à l'écran)
  + `rienParti` (arrêt AVANT le geste) / `incertain` (peut-être parti : jamais rejoué).
- **`vrm-formulaire.js`** (monde de la page) : chaque étape vérifie la page (identifiants), cherche l'élément
  (data-testid / nom accessible EXACT en 5 langues, UN seul candidat — deux ⇒ `ambigu`, rien n'est cliqué), s'arrête
  sur une vérification VISIBLE (≥ 120 × 60, à l'écran), tape lettre à lettre, clique, écoute la RÉPONSE de la requête
  que la page envoie, puis vérifie à l'écran (message apparu dans le fil, offre affichée, bouton « Afficher » après
  « Masquer »…). Il n'envoie RIEN lui-même (`audit-tout-interface` T3).
- **Grille des tailles** : plus de `POST item_upload/attributes` du fond. Apprise quand la page « Vendre » la reçoit
  (`inject.js` → `grilleTailles` → `rangerGrilleTailles`) ; pour une fiche (`creerVintedFiche`), LUE par la page
  (l'onglet de travail ouvre « Vendre » et y choisit la catégorie : `grilleParPage`, aucune écriture). Pendant une
  republication (`cacheSeul`) : aucune page de plus — le formulaire choisit la taille par son identifiant, absente ⇒
  arrêt nommé avant le brouillon.
- **Retry-After** : lu sur la réponse que la page reçoit (`vrm-formulaire.js` → `constaterFormulaire`).

## Inventaire : chaque écriture qui partait par requête, et son geste d'interface

Lignes de `vinted-sync-extension/background.js` à ce commit.

| écriture d'avant | fonction (ligne) | geste par l'interface (étape de `vrm-formulaire.js`) | vérifié à l'écran |
|---|---|---|---|
| ouverture d'une conversation de favori `POST /conversations` | `executerMessageFavori` (19978) | `favoriOuvrir` : la cloche, puis LA ligne dont le lien porte CET article ET CETTE personne (jamais un titre ni un pseudo ; deux lignes ⇒ ambigu, rien) ; la page ouvre la conversation | fil relu (GET) : conversation, destinataire, article |
| message à un favori `POST …/replies` | `executerMessageFavori` (20124), `sequenceFavoriBleam` (19845), `reprendreMessagesFavoris` (21170) | `message` : `/inbox/{conv}` vérifiée, champ du message (un seul), texte tapé lettre à lettre, « Envoyer » de CE champ | le message APPARAÎT dans le fil (sinon `incertain`, jamais renvoyé) |
| offre à un favori `POST …/offers` | `executerMessageFavori` (20077), `sequenceFavoriBleam` (19875) | `offre` : « Faire une offre », la fenêtre, le prix tapé (« 45 » / « 47,50 »), « Proposer » (jamais « Annuler ») | l'offre affichée ; refusée ⇒ le message n'est PAS envoyé |
| réponse à un message `POST …/replies` (app, panneau, après-vente, refus auto) | `gesteAppParInterface` (19596), `messageAcheteurGeste` (36150), `repondreOffre` (13196), `contreOffreAuto` (13034) | `message` | apparu dans le fil |
| faire une offre (app, panneau, contre-offre) | `gesteAppParInterface` (19609), `contreOffreAuto` (13023) | `offre` (conversation par IDENTITÉ : `convDeTransaction`) | offre affichée |
| accepter / refuser une offre `PUT offer_requests/{oid}/accept|reject` | `repondreOffreInterface` (17182, 17191) via `repondreOffre`, `gesteAppParInterface` | `repondreOffre` : le fil relu (CETTE offre en attente ; le moteur vient de le relire : pas deux fois), « Accepter » OU « Refuser » (jamais l'autre), la réponse doit porter CETTE offre | le bouton disparaît |
| `mark_as_read` | `marquerLuCommeBleam` (19750) | `ouvrir` : la conversation OUVERTE dans l'onglet (Vinted la marque lue lui-même) | adresse de la conversation |
| republication « Directe » (photos, brouillon, suppression, mise en ligne) | `recreerVinted` → `recreerParFormulaire` (16865–16979) | formulaire SEUL : photos déposées dans le champ, champs tapés/choisis, « Sauvegarder le brouillon », relu contre la fiche (catégorie, taille, état, colis, marque, titre, unisexe, photos), « Supprimer » + confirmation, « Ajouter » | brouillon relu ; écart ⇒ arrêt AVANT la suppression |
| suppression `POST items/{id}/delete` | `supprimerParFormulaire` (16948), `reprendreRepub` (16070), `dressingAction` (36481) | `supprimer` : `/items/{id}` vérifiée, « Supprimer », confirmation de Vinted (jamais « Annuler ») | réponse de la page |
| mise en ligne d'un brouillon `POST drafts/{id}/completion` | `miseEnLigneParPage` (15819–15843) via `publierBrouillon` (15780), `finRepubBrouillon` (17726) ; `publierParFormulaire` (16979) | `/items/{brouillon}/edit`, champs réglés posés d'abord (couleur, taille, état, colis, catégorie), « Ajouter » ; verrou 30 min AVANT le clic | réponse de la page |
| brouillon d'une fiche `POST drafts` + photos | `creerVintedFiche` (17454, 17478) | formulaire « Vendre » : photos, champs, « Sauvegarder le brouillon » | brouillon relu (écarts dits) |
| « Refaire le brouillon » | `refaireBrouillon` → `recreerParFormulaire` (`sansSuppression`) | formulaire, sans supprimer ; en ligne seulement si l'ancienne est partie à coup sûr | idem |
| masquer / afficher `PUT is_hidden` | `masquerCarte` (22749), `masquerAilleursTickUn` (24765) | `masquer` : `/items/{id}`, « Masquer » / « Afficher » | le bouton inverse apparaît |
| prix `PUT item_upload/items/{id}` | `baisserPrixVinted` (14898), `republierVinted` (14772) | `prix` : `/items/{id}/edit`, prix (et titre) tapés, « Enregistrer » | prix RELU (GET) après |
| bordereau `PUT shipment/order` | `genererBordereau` (25194) | `bordereau` : conversation de LA vente (identité), son bouton, la confirmation de Vinted ; une fenêtre qui demande un CHOIX ⇒ arrêt avant de confirmer (le dépôt appris seulement s'il l'a choisi une fois à la main) | réponse de la page, puis le PDF (lecture) |
| évaluation 5 étoiles (rejouée) | `evaluationGeste` (36181) | `evaluation` : « Laisser une évaluation », la 5ᵉ étoile, SON texte, « Envoyer » ; la requête attendue = celle qu'il a faite une fois | réponse de la page |
| grille des tailles `POST item_upload/attributes` (lecture en POST) | `grilleTailles` / `grilleParPage` (14041) | `grille` : « Vendre », la catégorie choisie ; la réponse de la page rangée | — (lecture) |
| mode vacances (rejoué) | `mettreVacancesVinted` (15153) | **PAS FAIT** : le chemin de ce réglage dans l'interface n'est pas relevé ⇒ rien ne part, c'est dit (« Paramètres → Mode vacances » sur vinted.fr) | — |
| `POST /web/api/auth/refresh` | `refreshIfActive` (6910) | aucun : la page renouvelle sa session en naviguant ; VRM relit le cookie | — |

Plus de repli « sans onglet » : sans onglet vinted.fr connecté sur ce compte, RIEN ne part (avant, un geste de l'app
partait du service worker).

## Republication

- **Formulaire = seule méthode.** Une valeur « directe » enregistrée (`vrmCommeBleam.methode`) ou demandée par une
  commande est IGNORÉE et c'est dit (`methodeAvant`, panneau : « L'ancienne méthode "directe" enregistrée est
  ignorée », `repub_directe_ignoree`) ; la reposer est refusé.
- Ordre INCHANGÉ : coffre → brouillon (relu contre la fiche) → suppression → mise en ligne. La mise en ligne se fait
  dans la même passe (« Ajouter » après la pause au hasard) : plus de mise en ligne planifiée qui croiserait un autre
  formulaire dans le même onglet. Les attentes d'avant (`vrmRepubAttente`) restent menées par `finRepubBrouillon`,
  désormais par la page.
- **Nouveau (rien ne se perd en silence)** : une annonce qui porte un champ que le formulaire rempli par VRM ne sait
  pas poser (matière, mesures, fabricant, ISBN, IMEI, classification) est REFUSÉE avant tout geste, le champ nommé
  (`champsHorsFormulaire`) ; « unisexe » est posé (case du formulaire). Le brouillon relu compte aussi les photos.
- **Corrigé** : un brouillon à l'issue incertaine pose maintenant le verrou que relit `recreerVinted` (30 min) — avant,
  seul « Refaire » le voyait : une seconde recréation pouvait créer un second brouillon.
- La recette de la NOUVELLE annonce est rangée (le brouillon tel que la page l'a envoyé).
- La trace (`vrmTraceRepub`, forme seulement) est tenue sur ce que la PAGE a envoyé et reçu.

## Favoris

Ouverture par la cloche (la ligne du favori aux deux identités), message tapé, « Envoyer », VU dans le fil (sinon
« incertain », jamais renvoyé) ; l'offre part TOUJOURS (remontée au plancher prix mini / achat + 10 %, décision du
21 nov. inchangée) ; un texte qui annonce l'offre ⇒ offre avant, offre refusée ⇒ message pas envoyé. Avant chaque
geste : conversation, destinataire et article vérifiés par identifiants (fil relu, adresse de l'onglet), jamais le
titre.

## Sélecteurs PAS vérifiés sur la vraie page vinted.fr (à regarder au premier essai)

Relevés le 20 nov. (formulaire de dépôt) : `header-upload-item-button`, `add-photos-input`, `#title`, `#description`,
`#category` + `#catalog-search-input` + `catalog-select-dropdown-content`, `#brand` + `#brand-search-input`, `#size`
(options `…-grid-option-{id}`), `#color` (`filter-grid-option-{id}`), `#package_type_selector_{id}`, `#condition`
(`#condition-{id}`), `#price`, `upload-form-save-draft-button`, `upload-form-save-button`, `item-delete-button`.

**Jamais vus sur la vraie page (devinés d'après les conventions, arrêt nommé s'ils manquent) :**
- la cloche : un bouton au nom accessible « Notifications » (5 langues) ; la ligne d'un favori : un lien dont l'adresse
  porte `item_id` ET `receiver_id` (ou le lien capté de la notification) ;
- le champ du message : `textarea[data-testid*="message"]` / `textarea[name="message"|"body"]` / un seul `textarea` ;
  « Envoyer » : le bouton d'envoi de son formulaire, sinon un bouton « Envoyer / Send / Invia / Enviar / Senden » ;
- « Faire une offre » (nom exact : « Faire une offre », « Proposer un prix », « Make an offer »…), la fenêtre
  (`role="dialog"`), son champ prix (`input[name="price"|"offer"]`, `inputmode="decimal"`…), « Proposer / Envoyer » ;
- « Accepter » / « Refuser » d'une offre reçue (noms exacts, 5 langues), et une éventuelle confirmation ;
- « Masquer » / « Afficher » sur la page d'une annonce (nom exact ou `data-testid` *hide* / *show*) ;
- « Enregistrer » de la page « Modifier » (`upload-form-save-button`, le même que « Ajouter » — à vérifier) ;
- le bouton du bordereau (« Obtenir / Générer / Imprimer le bordereau », « Get shipping label »…) et sa confirmation ;
- « Laisser une évaluation », la 5ᵉ étoile (`data-testid` *star-5* / *rating-5*, ou « 5 étoiles »), le texte, « Envoyer » ;
- la case « Unisexe » (`#is_unisex`, `name="is_unisex"`, `data-testid*="unisex"`) ;
- la preuve « vu » : le texte du message (80 premiers caractères) une fois de plus dans la page ; le prix de l'offre
  (« 45 € », « 47,50 € ») une fois de plus.

## Preuves (rien de réel : pages et données inventées)

- `scripts/audit-tout-interface.cjs` (nouveau) : T1–T4 statiques (aucun `vintedPage`/`vintedSend` ≠ GET, aucun fetch
  du fond vers Vinted ≠ GET, aucun XHR, `vrm-formulaire.js` n'envoie rien, aucun script de contenu n'écrit), T5–T8
  exécutés (porte, « directe » ignorée, réponse de l'app par la page, sans onglet rien). Rouge sur `origin/main`, et
  5 mutations sur 5 rouges (`--mutation`).
- `scripts/bancs/interface-vinted.cjs` (nouveau, Playwright, le VRAI `vrm-formulaire.js` sur une fausse page vinted.fr :
  cloche de 50 favoris IDENTIQUES, conversation, offre, offre reçue, annonce, « Modifier ») : I1 12 tirages jamais le
  mauvais, I2 ambigu ⇒ rien, I3 tapé + un envoi + vu, I4 pas vu ⇒ `vu:false`, I5 mauvaise conversation ⇒ rien,
  I6 champ absent ⇒ nommé, I7 offre (et refusée), I8 vérification visible / invisible, I9 accepter/refuser, I10
  masquer/supprimer/autre annonce, I11 prix, I12 un seul envoi, I13 clics `isTrusted:false`. `--prouve` : 9 mutations.
- `scripts/_fausse-page-vinted.cjs` (nouveau) : la fausse page des audits `vm` (étapes de `vrm-formulaire.js`),
  partagée par `_fond-vm.cjs` et les audits à banc propre (`brancherPageVinted`). Elle ne prouve RIEN des sélecteurs.
- Audits adaptés (la garantie gardée, jugée sur ce que la page envoie) : actions-gardees, annonce-vinted,
  annulees-chez-toi, argent-vinted, bordereau-rattrapage, comme-bleam (R18 : « directe » ignorée ; F11), commande,
  exec, ext-boutique, extension-5340 et mode-vacances (plus de rejeu : rien ne part, dit), favoris-offres-irreprochable,
  favoris-vintex, jauge-journal, messages-achats-plus, moteur-offres, negociation-paliers, offres-sures (B6 : sans
  onglet rien ne part), recreer (21 contrôles de la méthode directe NOMMÉS « retirés », chacun avec sa raison et
  l'audit qui garde la garantie), repub-copie-fidele (G1–G5, `--prouve` 4/4), republication-parfaite, robustesse-
  extension, securite-comptes, tout-generer. Identifiants des fixtures rendus numériques (« c7001 » ⇒ « 87001 ») :
  une vraie conversation Vinted porte un numéro, et `interfaceVinted` refuse tout le reste.

## Pas fait / à décider

- **Mode vacances** : plus de rejeu, pas encore par l'interface (chemin à relever sur sa page Paramètres).
- Les champs que le formulaire ne pose pas (matière, mesures, fabricant, ISBN…) bloquent la republication de CETTE
  annonce (nommés) : à ajouter au formulaire une fois leurs éléments relevés sur la vraie page.
- La mise en ligne n'est plus planifiée 1–3 min plus tard pendant que la paire suivante avance : elle se fait dans la
  même passe (≈ 3 min de formulaire + la pause par paire).

## Geste de Julien

Installer la 5.414.0 (dans CHAQUE Chrome), puis essayer UNE republication et UN message à UN favori en regardant
l'onglet de travail : si un élément manque, VRM s'arrête et le nomme (« Vinted a changé sa page (élément « … »
introuvable) ») — c'est ce nom qu'il faut transmettre.
