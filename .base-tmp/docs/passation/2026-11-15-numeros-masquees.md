# 15 novembre 2026 — Masquées sans N°, achat en retour « à retirer », republiée dans l'app Vinted

Branche `claude/numeros-masquees` (partie de `claude/numeros-nouvelles`, `claude/project-review-nsk5su`
fusionnée par un vrai merge). Trois défauts : les deux premiers viennent de l'audit de fiabilité
du 15 nov. (`claude/audit-fiabilite`, anomalies #3, #4 et la question de l'achat en retour), le
troisième est la demande de Julien relayée par le coordinateur (« imagine que la personne publie
sur l'app Vinted et ne lie pas l'extension directement après », puis « quand VRM reconnaît la photo
qu'elle a modifiée, elle attribue le numéro »). L'extension n'a PAS changé.

## Mesuré avant de coder (base de production, `SELECT` seulement)

- **Masquées** (`is_hidden`, ni fermées ni brouillons) :
  - premier vendeur : 4 masquées SANS fiche, chacune liée par l'extension
    (`panel_num_reserves.items[id]`) à un N° réservé : **209, 210, 211, 214**, aucun de ces N° sur
    une autre fiche, ni sur une vente, ni au pool ; dressings complets (`total_entries` = lus) et
    frais (15 nov.). Les 6 autres masquées de ce vendeur ont déjà leur fiche (15, 39, 51, 52, 59, 73).
  - second vendeur : 5 masquées sans fiche ni réservation ; son dressing date du 24 oct. (3 semaines)
    et ses 98 annonces ouvertes ont toutes leur fiche.
- **Réservation liée dont la fiche porte un autre N°** : 1 cas sur 45 réservations — réservation
  **128**, fiche **131**. La fiche porte `reattribue: { de: 128, vers: 131 }` (4 nov.) : la règle des
  doublons (décision du 20 oct.) l'a fait passer de 128 à 131 parce que **128 est aussi le N° d'une
  vente finalisée d'une autre annonce**. L'annonce a été supprimée de Vinted le 7 nov. (coffre de
  Republier, `harvest_{uid}_supprimees`) : elle n'est plus présente. Rien à montrer aujourd'hui (le
  cas est déjà « nouveau N° à écrire sur ton carton » tant qu'il est présent) ; geste de Julien :
  regarder le carton de la paire « 128 → 131 » s'il l'a encore.
  Deux autres réservations sans fiche (186, 205) sont des annonces VENDUES (fermées `sold`).
- **Achat en retour** : l'achat « Autry » (compte shop) — liste des achats lue le 11 nov. :
  « La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais »,
  `needs_action` ; `isAtRelayStatus` le compte « au point relais » ; le résumé de l'extension
  (`resume.txns`) le range parmi les achats au point ; son **bordereau de retour** est arrivé le
  15 nov. à 13 h (`email_bordretour_{tx}`, sens « achat », limite 23/11 10 h). La publication de
  l'app du 15 nov. 13:10 ne le comptait pas (3 à retirer, le n° dans `vusTx` seulement) — mais le
  widget sans publication fraîche, ou un achat vu « au point » après elle, le comptait (le banc
  le montre : 2 au lieu de 1 sur l'arbre de départ), et l'écran Achats l'étiquetait « À retirer ».

## Ce qui change

### 1. Les masquées reçoivent leur N° (#3)
`src/numerosNouvelles.js` : `annoncesANumeroter(enLigne, masquées)`, `lectureMasqueeComplete`,
`lectureCompleteAnnonce`. La numérotation (App.jsx, effet de `Comptabilite`) parcourt les annonces
en ligne PUIS `masqueesSurEtagere` (moins les masquées déclarées parties). Identités d'abord
(N° réservé lié à SON identifiant, vente de la même annonce, même fichier photo, republication
connue, N° écrit en mode « moi ») — elles valent même sur un dressing ancien. Un N° NEUF à une
masquée seulement si le dressing qui l'a vue masquée est COMPLET (`_vrmMasqueeComplete`, posé par
`dressingEnLigne` et la lecture directe) et de moins de 24 h (`_vrmVueMasqueeLe`) : une masquée vue
il y a 3 semaines est peut-être supprimée ou vendue depuis. Le mode « je numérote moi-même » demande
aussi le N° des masquées (même liste).

### 2. « N° à vérifier sur ton carton » : la réservation en désaccord (#4)
`reserveEnDesaccord(id, fiche, parItem, cleNum)` : la fiche dit X, la réservation liée dit Y, pas
déjà vérifié (`cartonVerifie`), pas expliqué par la règle des doublons (`reattribue` de Y vers X,
déjà dit dans « à écrire »). Annonces → « N° à vérifier » : « La fiche dit N°7 · réservé N°3 » (court :
la ligne de l'écran ne se coupe pas), « C'est bien le N°7 » (le geste existant) ou « Le carton dit N°3 » (`prendreReserve` :
passe par `poserNumero`, ne prend que la réservation liée à CETTE annonce). Rien ne change seul.

### 3. Un achat en retour n'est jamais « à retirer »
`api/_lib/suivi-colis.js` (la règle partagée de l'app, du widget et du rappel du matin) :
`txAchatsEnRetour(bords)` (les n° des bordereaux de retour d'ACHAT ; sens « vente » écarté ;
pas lus ⇒ `null`, rien écarté), `achatEnRetour(o, txs)` (son n°, ou son statut « Retour initié /
demandé / en cours »), `finDeCommandeAchat({ …, retour })` ⇒ « il l'a », `finDesTransactions(…, retours)`.
- App : `vintedToPickup` écarte l'achat en retour (Achats, Colis → À retirer, Ma journée, la photo
  hors ligne) ; un colis d'e-mail relié à cet achat est fini ; l'étiquette dit « À renvoyer » ;
  la publication `vrm_colis_retirer` garde l'achat dans `vusTx` (le widget ne l'ajoute jamais).
  La projection des bordereaux lit `meta->>sens`.
- Widget (`api/widget.js`) : lit `email_bordretour_*` (`transaction`, `sens` en `meta->>`) et
  écarte l'achat en retour du compte sans publication et des achats vus après elle.
- Rappel du matin (`api/ship-reminders.js`) : la même lecture, passée à `finDesTransactions` ;
  lecture ratée ⇒ rien envoyé.
- Pas fait : un avis « Retourne ta commande » SANS bordereau, relié par la conversation, n'écarte
  pas encore l'achat (la lecture de ces avis vit plus bas dans l'écran que les achats « à retirer »).
  L'achat qui dit lui-même « Retour initié » l'était déjà (`isAtRelayStatus` exclut « retour »).

### 4. Republiée dans l'app Vinted (`src/republieTelephone.js`)
Le dernier recours avant un N° neuf (mode « VRM numérote »), dans le bloc `<numerotation-passage>`
(balise `<republie-telephone>`) :
1. SA réponse « Non, c'est un autre article » (`vrm_republie_reponses`) ⇒ N° neuf.
2. **La photo fabriquée par VRM** : `vrm_photos_vrm` (synchronisé, 60 jours) — l'empreinte de chaque
   image PRODUITE pour un N° (feuille guidée, kit, « Publier à la main » : `usePhotosReglees`), le N°,
   l'annonce d'origine. Une identité, à un seuil SÛR mesuré : `SEUIL_PHOTO_VRM = 8`
   (`scripts/bancs/photos-vrm-seuil.cjs`, jeu inventé : la photo VRM passée par Vinted — 800 px JPEG 80,
   miniature 310 px JPEG 75, JPEG 60, moitié JPEG 70 — ≤ 7 ; une autre photo de la même paire ≥ 23 ;
   une autre paire ≥ 19). Repris tout seul (`recreeDe`, `recreeOrigine: 'photo-vrm'`) et DIT une fois
   (« N°6 reconnu par sa photo · republiée dans l'app Vinted, le carton ne change pas ») seulement si un
   SEUL N° correspond, l'annonce d'origine n'est plus chez lui, aucune autre annonce présente ne porte
   ce N°, aucune vente ne le porte. Sinon ⇒ proposé.
3. Aucune annonce de ce compte n'a disparu récemment ⇒ N° neuf tout de suite (rien ne change).
4. Une disparue (fiche du compte vue en ligne — `vrm_vus_en_ligne` — puis absente d'une lecture
   complète, moins de 14 jours, ni vendue, ni remplacée, ni sortie) : comparaison des empreintes
   (`photo_emprunte_{uid}` de l'extension ; VRM garde celles de ses fiches numérotées dans
   `vrm_empreintes_fiches`, l'extension effaçant celle d'une annonce supprimée). Même photo
   (≤ `SEUIL_REPUB_PHOTO = 12`, la mesure de `claude/meme-photo`) ⇒ **Ma journée en tête : « N°6
   republiée ? »** ⇒ la feuille AVANT (photo de la disparue, plaque N° gravée) / MAINTENANT, au même
   cadrage ; « Oui, garder N°6 » (le plein : le lien de « Republier à la main », `vrm_repub_main`, la
   reprise `repriseNumerosRecreation` remet le N°) ; « Non, c'est un autre article » (N° neuf) ; une
   ancienne encore en ligne ne se relie pas (dit). La carte « N°6 supprimé de Vinted » de l'ancienne ne
   s'affiche pas en même temps (le même sujet, une fois). Les deux réponses passent par la pilule
   d'accompagnement (`numero.republie`, `numero.autre`, annulable 5 s).
   Photos différentes, toutes comparées ⇒ N° neuf. Empreinte pas encore captée ⇒ attente, au plus 24 h
   depuis la première fois que VRM a vu l'annonce sans N° (`vrm_republie_attente`, synchronisée).
- Mode « je numérote moi-même » : inchangé ; une republication qui porte « N° 42 » à la fin de sa
  description reprend N°42 même si la fiche de l'annonce disparue porte encore 42 (avant : refusé,
  « déjà porté par une autre fiche ») — seulement si toutes les fiches qui portent ce N° sont des
  disparues de CE compte.
- Pas fait : la photo d'un brouillon « Créer sur Vinted » et celles de l'atelier « Republier par VRM »
  (préparées par l'extension) n'entrent pas au registre ; une photo d'origine ré-envoyée telle quelle
  reste au cas 4 (proposition). La comparaison ne porte que sur les empreintes déjà captées (une image
  par tour de 45 s, budget de lecture 20/h, onglet vinted.fr ouvert).

### Combien de temps une nouvelle annonce peut rester sans N°
| cas | sans N° |
|---|---|
| aucune annonce du compte n'a disparu récemment | jusqu'au premier passage de la numérotation sur la lecture complète (comme avant) |
| photo fabriquée par VRM reconnue (sûre, un seul N°) | idem : N° repris au premier passage |
| disparue récente, empreintes connues des deux côtés, différentes | idem : N° neuf au premier passage |
| disparue récente, une empreinte pas encore captée | jusqu'à la capture, **au plus 24 h** depuis la première fois vue sans N°, puis N° neuf |
| même photo qu'une disparue (ou photo VRM ambiguë) | jusqu'à SA réponse dans Ma journée (pas de borne : un N° deviné serait faux à vie) |
| masquée liée à une identité | premier passage, quel que soit l'âge du dressing |
| masquée sans identité | premier passage sur un dressing complet de moins de 24 h ; sinon à la prochaine lecture fraîche |

## Preuves
- `node scripts/audit-numeros-masquees.cjs` — **28 ✅** ; le morceau de numérotation d'App.jsx (de
  `const items =` à `</numerotation-passage>`) EXÉCUTÉ (`scripts/_numerotation-vm.cjs`, vraies fonctions
  et vrais modules) : les 4 masquées reçoivent 209/210/211/214, aucun N° brûlé ; dressing ancien +
  réservation ⇒ N° ; masquée neuve sur dressing frais ⇒ N° neuf ; ancien, partiel, compte muet ⇒ rien ;
  le second cas mesuré (5 masquées, 3 semaines) ⇒ rien ; vente, même fichier photo ⇒ leur N° ; 50
  masquées identiques ⇒ 11…60 ; mode « moi » ; #4 (le cas mesuré 128→131 ne revient pas). Sur l'arbre
  de départ (`git archive 8a0d2c27`) : **11 ❌**. `--mutation=toutes` : **8/8**.
- `node scripts/audit-republie-telephone.cjs` — **31 ✅** ; même morceau exécuté : republiée dans l'app
  Vinted ⇒ aucun N° neuf, « N°42 republiée ? » proposée, attente notée ; « Oui » ⇒ N°42 ; « Non » ⇒ 217 ;
  photo différente, aucune disparue, ancienne vendue, autre compte ⇒ N° neuf ; empreinte pas captée ⇒
  attente, 25 h ⇒ N° neuf ; **50 paires du même modèle republiées avec leur photo VRM ⇒ chacune SON N°**,
  dit une fois ; origine en ligne (même renumérotée), deux N°, N° d'une vente ⇒ proposé ; « Non » l'emporte
  sur la photo VRM ; mode « moi » ⇒ le N° écrit. Arbre de départ : **18 ❌** (la nouvelle annonce y reçoit
  217, les 50 paires 61…110). `--mutation=toutes` : **9/9** (attente, seuil relâché à 40, deux N°, origine
  en ligne, vente, borne de 24 h, réponse, phrase dite, ligne de Ma journée).
- `node scripts/audit-retour-pas-a-retirer.cjs` — **18 ✅** ; la règle, l'étiquette (`etapeAchat`
  exécutée), **le widget exécuté** sur une fausse base cloisonnée (`select=` appliqué) : sans publication
  1 au lieu de 2, sens « vente » ⇒ 2, bordereaux pas lus ⇒ 2, après publication ⇒ 1 ; l'app et le rappel
  du matin (texte). Arbre de départ : **14 ❌** (widget : 2). `--mutation=toutes` : **7/7**.
- `scripts/bancs/photos-vrm-seuil.cjs` : le seuil sûr mesuré (V1/V2/V3 verts ; le premier essai à 6 était
  rouge — la moitié JPEG 70 donne 7).
- Audits verts : identite, masquees-numeros, numeros-nouvelles, numeros-lettres, numeros-vestiaire,
  numero-ecrit, conflits-numeros, garde-numeros-rapide, fusion-nuage, a-retirer-ailleurs, lbc-a-retirer,
  retours-emails/-litiges/-stock, retour-vinted, retrait-preuves, retraits-fiables, retrait-fiable,
  retrait-vinted-go, repli-retirer, colis-heure, colis-sortants, colis-ventes-email, a-envoyer-preuves,
  suivi-colis, statuts, traduction, tdz, variables, coherence, accompagnement, quoi-de-neuf,
  republier-guide, republier-kit, notifs-*, cloisonnement, lectures, et ~30 audits serveur.
  Ajustés à la règle (pas à l'orthographe) : identite (la liste parcourue, la borne de distance),
  republier-guide/-kit (l'option `source` du registre), statuts (le contexte d'`achatStage`),
  numeros-nouvelles (le contexte du bloc).
  Rouges IDENTIQUES sur l'arbre de départ (pas de ce lot) : numeros-clenum (src/aRetirerAilleurs.js),
  charge-rappels (R2), ebay-colis, rappel-echeance, revue-fin (A4 `partageFichiersPossible` déclaré
  deux fois), comptes-exclus (copie d'arbre incomplète : `src/versementReleve.js`).
- Banc `scripts/bancs/numeros-masquees.cjs` (390 tactile clair et sombre, 1512) : M (masquée N°5), V
  (« à vérifier », SON choix), R (« N°6 republiée ? », la feuille, « Oui »), P (« N°6 reconnu par sa
  photo »). **99 verts** (M, V, R, P × 390 clair, 390 sombre, 1512 clair), puis après les finitions V 27 ✅
  et R/P/M 75 ✅. Captures regardées ; elles ont attrapé : la phrase « à vérifier » coupée par l'ellipse de
  l'écran et « Le carton dit N°3 » tronqué (phrase raccourcie, bouton sous la phrase), une seconde carte
  « N°6 supprimé de Vinted » et une ligne « 1 annonce sans numéro » pour la même annonce (retirées : le
  même sujet, une fois), le bandeau qui redisait « même photo ». Pas rejoué sur le build d'avant (machine
  à charge 40) : les trois audits ci-dessus sont rouges sur l'arbre de départ.
- Non fait (dit) : le banc `accompagnement` (son monde `_base-volume`) n'a pas reçu ces moments ; le banc
  de ce lot vérifie la pilule `data-acc-apres="numero.republie"`.

## Gestes de Julien
- Aucun pour que ça marche. Au prochain passage de VRM (un écran qui lit les annonces ouvert) : les
  4 masquées prennent 209, 210, 211, 214 (déjà sur leurs cartons) — rien à écrire.
- Regarder le carton de la paire passée de 128 à 131 le 4 nov. (règle des doublons), s'il l'a encore.
- L'achat en retour : sa carte est « À renvoyer » (bordereau, avant le 23/11 10 h).

## Suite du même jour (coordinateur : les trois restes)

1. **Accompagnement** : les moments des numéros passent par la pilule « après » (`accompagner`), plus
   par un bandeau à part : `numero.donne` (« 1 nouvelle paire numérotée · N°2 · à écrire sur son
   carton »), `numero.demande`, `numero.carton` (les deux choix de « N° à vérifier »), `numero.republie`
   et `numero.autre` (« N°x republiée ? »), `numero.reconnu` (la photo VRM). Le banc `accompagnement`
   les JOUE (un monde réduit qui numérote) : **6/6 verts**. Il a trouvé un vrai défaut : la numérotation
   pouvait passer AVANT la lecture des empreintes, et la photo fabriquée par VRM n'était alors pas
   reconnue (N° neuf). La numérotation attend maintenant cette lecture (`empreintesVinted === undefined`
   ⇒ attendre ; `null` = pas su ⇒ règle normale) — audit + mutation `lecture`.
2. **Avis « Retourne ta commande » sans bordereau** : `txAchatsEnRetour(bords, { demandes, achats })`
   relie un avis à un achat par SA conversation (identité), seulement si UN seul achat lu la porte.
   App (projection `email_retourdemande_*` : `conv`, `sens`), widget (les commandes ne sont relues que
   si un avis porte une conversation), rappel du matin (lecture ratée ⇒ rien envoyé). **Mesuré : les
   3 avis rangés chez Julien n'ont PAS de conversation** (`conv` vide) : ils n'écartent rien (jamais par
   titre ni date). Audit `retour-pas-a-retirer` : 25 ✅, mutations `avis` et `avisWidget` attrapées.
3. **Registre des photos VRM** :
   - « Créer sur Vinted » : l'extension envoie les photos de la fiche SANS réglage
     (`reglagesPhotoSurs(null)` = neutre, ré-encodées) ; l'app calcule l'empreinte des photos qu'elle
     remet (`empreinteImageLocale`) et les range au registre avec le N° et l'identifiant du brouillon
     (celui de l'annonce publiée). Pas de changement d'extension.
   - Atelier « Republier par VRM » : les photos sont lues sur vinted.net et RÉGLÉES par l'extension
     (`photoReglee`, rotation/zoom/couleurs) ; l'app ne peut pas lire ces pixels (CORS). Une
     republication par l'atelier laisse déjà une identité prouvée (coffre `recreeDe`), donc le N° suit.
     Pour qu'une photo de l'atelier, republiée PLUS TARD à la main dans l'app Vinted, soit reconnue, il
     faudrait côté extension (5.387.0, réservée, PAS faite) : dans `televerserPhotosRecreer`, après
     `photoReglee`, `empreinteDeBlob(blob)` (déjà présent pour `photo_emprunte`), et ranger
     `{ h, n: N° de la paire, src: ancienId, uid, at }` dans une ligne `photo_vrm_{uid}` (fusionnée
     lire-réécrire comme `rangerEmpreintes`) que l'app ajoute au registre — petit, mais il touche
     l'atelier en service : laissé à une session qui livre une extension.
- Fusion de `origin/claude/project-review-nsk5su` (Verre dépoli, Stock en étagères) : conflits résolus
  (imports de traduction, Quoi de neuf par id, projection des bordereaux de retour avec
  `transporteurPdf` ET `sens`), un import double d'`empreinteImageLocale` retiré.
