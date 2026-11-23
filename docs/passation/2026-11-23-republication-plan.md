# 23 nov. 2026 — Republication « intelligente » : inventaire, mesures, plan (phase 1)

Branche `claude/republication-intelligente` (depuis `origin/main` b5fc00bd4). **Aucune ligne de l'extension n'est
touchée dans cette phase** : `claude/favoris-auto` (5.440 / 5.441) construit la couche commune (`vrm-trouver.js`), les
vrais clics et `gesteHumain` ; on branche la republication dessus **après sa fusion**.

Sources lues : CLAUDE.md §3 (ligne « Republication », ordre coffre → brouillon → suppression → mise en ligne),
§8 ; `2026-11-17-republication-parfaite.md`, `2026-11-20-repub-messages-malins.md`, `2026-11-23-favoris-auto.md`
(branche), `historique-vinted-extension.md` ; code de `main` (extension servie 5.439 / manifeste 5.439.0).

⚠️ **Décision à confirmer dans le dépôt avant d'exécuter** : la mission dit « vrais clics par `chrome.debugger`,
domaine `Input` seulement, décision de Julien du 23 nov. ». CLAUDE.md sur `main` (et sur `favoris-auto` à
dc90fcbf3) dit encore « REFUSÉ : tout maquillage (isTrusted, debugger/CDP, souris inventée) », et aucune branche
ne contient encore `chrome.debugger`. **La phase 2 n'utilise le débogueur que si la ligne §3 de CLAUDE.md fusionnée
sur `main` le permet** (portée par `favoris-auto`) ; sinon elle se fait sur la couche de repérage et le rythme
seuls, clics `isTrusted:false` comme aujourd'hui.

---

## 1. Inventaire de la republication actuelle (code de `main`)

### 1.1 Entrées
| entrée | fonction (background.js) | quoi |
|---|---|---|
| atelier « Republier » (app → commande) | `republierVinted` → `recreerVinted` | une paire, sur SA confirmation (`confirme: true`) |
| « Reprendre » | `reprendreRepub` → `reprendreParFormulaire` | finit une paire interrompue sans rien refaire |
| « Refaire » (brouillon perdu) | `refaireBrouillon` → `recreerParFormulaire({ sansSuppression, dejaSupprimee })` | recrée depuis le coffre |
| « Publier » / « Brouillons → en ligne » | `publierBrouillon` | met en ligne un brouillon existant |
| contrôle avant de lancer | `verifierRepub` | LECTURE seule, `reglerAvant` par annonce |
| programmation / file | `miseEnLigneTick`, alarme `vrm-mise-en-ligne`, file d'actions (`auPassageFile`) | |

### 1.2 Les gardes AVANT tout geste (`recreerVinted`) — toutes à garder telles quelles
1. `gardeStricte(uid, acc, {lecture:true})` : compte de l'onglet, pause 429/403.
2. `lireFreinRepub` : frein 30 min (24 h si restreint) après un refus.
3. Coffre relu (`coffre_{uid}_{id}`, lecture ratée ⇒ rien) ; fiche (`lireFicheAnnonce`) ; photos uniques
   (`photosUniques`, 20 max, `images*.vinted.net` seulement).
4. Description ≥ 5 caractères (sinon lue chez Vinted ; toujours rien ⇒ refus).
5. Garde du prix (`gardePrixEcriture`) si le prix change.
6. Verrous : local (`lireVerrouRecreer`) et en base (`versBrouillon` en vol < 30 min).
7. `gardeJourRepub` (`REPUB_PAR_JOUR` = 50) ; place dans l'heure (45/h, réserve 5) regardée puis **réservée d'un
   coup** (3 gestes ; 2 pour « vers brouillon »), rendue dans le `finally` pour ce qui n'est pas parti.
8. Lecture vivante `apprendreRecetteVinted` (GET `item_upload/items/{id}`) : 404/410 ⇒ rien ; recette fidèle
   (`recetteFidele`, `repubfidele`).
9. `reglerAvant` (taille au libellé exact, champs complétés par identité, SA réponse) ; manque ⇒ question, rien.
10. `refusDejaVu` : un corps déjà refusé n'est jamais renvoyé.
11. `avecVinted` (une paire à la fois), frein relu à son tour dans la file.

### 1.3 Les étapes du formulaire (`recreerParFormulaire`, `vrm-formulaire.js`, onglet de travail)
| # | étape | ce que fait VRM | élément DOM (sélecteur en dur, `SEL` de vrm-formulaire.js) | requête partie | écrit chez Vinted ? |
|---|---|---|---|---|---|
| 0 | photos préparées | fetch des photos du coffre, `photoReglee`, base64 | — | GET images (CDN) | non |
| 1 | onglet de travail | `ongletTravailVinted` (épinglé, voile permanent) | — | navigation | non |
| 2 | coffre | upsert `coffre_{uid}_{id}.versBrouillon {etat:'enregistre', etapes.coffre}` | — | Supabase | non |
| 3 | ouverture | navigation `/items/{id}/edit`, puis `ouvrirVente` : clic « Vendre » | `a[data-testid="header-upload-item-button"]`, puis attend `#title` | navigation | non |
| 4 | photos | `files` d'un `DataTransfer` + `input`/`change` ; attend N × `POST /api/v2/photos` 2xx | `input[data-testid="add-photos-input"]` | la PAGE : POST photos | oui (téléversement, sans annonce) |
| 5 | champs (ordre tiré, catégorie avant ce qui en dépend, 5–15 s entre deux) | titre / prix lettre à lettre (45–140 ms) ; description collée (défaut) ou tapée ; listes : clic + recherche + option | `#title`, `#description`, `#price`, `#category` + `#catalog-search-input` + option par id/libellé dans `[data-testid="catalog-select-dropdown-content"]`, `#brand` + `#brand-search-input`, `#size` + `[data-testid$="-grid-option-{id}"]`, `#color` + `[data-testid="filter-grid-option-{id}"]`, `#package_type_selector_{id}`, `#condition` + `#condition-{id}`, case unisexe | aucune (la page lit ses grilles) | non |
| 6 | brouillon | clic « Sauvegarder le brouillon » ; attend `POST item_upload/drafts` ; relit le CORPS envoyé par la page (`ecartsBrouillonFormulaire` : catégorie, taille, état, colis, unisexe, nb photos, marque, couleurs, prix, titre ; ordre des photos `ordreRelu`) | `button[data-testid="upload-form-save-draft-button"]` | la PAGE : POST drafts | **oui** |
| 7 | suppression (pause 5–15 s, puis navigation `/items/{id}`) | identité par l'adresse (`/items/{id}`), clic « Supprimer », puis **un bouton de la fenêtre** | `button[data-testid="item-delete-button"]`, confirmation : premier bouton d'un dialogue dont le data-testid OU le texte contient supprimer/confirmer/delete… | la PAGE : POST `items/{id}/delete` | **oui, irréversible** |
| 8 | attente | `pauseFormulaire('apresSuppression')` 15–40 s | — | — | — |
| 9 | mise en ligne | navigation `/items/{draftId}/edit`, `formulairePret`, clic « Ajouter » ; attend `POST drafts/{draftId}/completion` | `button[data-testid="upload-form-save-button"]` | la PAGE : POST completion | **oui** |
| 10 | après | `noterRepubJour`, `preuveModif('enligne')`, `rangerBrouillon`, `coffreDeLaNouvelle`, recette de la nouvelle, journal « republiée », `majVersBrouillon(fait)` | — | Supabase | non |

Toutes les écritures chez Vinted partent **de la page** (5.414 `toutinterface`) ; `vintedPage` refuse toute
méthode ≠ GET. Les seules requêtes fabriquées par VRM sont des **lectures** : `item_upload/items/{id}`
(recette vivante, ancienne encore là ?, brouillon relu par « Reprendre »).

### 1.4 Refus connus et leur traitement
| refus | où | ce qui se passe |
|---|---|---|
| frein (`frein-refus`) | avant, et relu dans la file et entre deux champs (`arretFormulaire`) | rien ne part |
| « Tout arrêter », robot / captcha visible, compte changé | `arretFormulaire` entre chaque champ ; `captcha()` dans chaque étape | arrêt, « rien n'est parti » avant le brouillon |
| élément introuvable (`selecteur`) | chaque étape | 2 réessais (2–6 s) puis **apprentissage par SON clic** (choix 102 ; irréversibles : « C'est bien ce bouton ? Oui ») puis arrêt |
| élément ambigu | `parNom`, `option` | pas de réessai, arrêt |
| champ manquant / taille / couleur (`reglerAvant`) | avant | question dans l'app, rien ne part |
| champ hors formulaire (matière, mesures, ISBN, IMEI…) | `champsHorsFormulaire` | refus avant tout geste (« republie-la à la main ») |
| brouillon refusé (4xx) | étape 6 | frein posé, rien supprimé |
| brouillon sans réponse / 5xx | étape 6 | verrou 30 min, « incertain », rien supprimé |
| écart brouillon ≠ fiche | étape 6 | arrêt AVANT suppression, brouillon rangé |
| suppression incertaine | étape 7 | verrou, « Reprendre » relit l'ancienne d'abord |
| mise en ligne refusée / incertaine | étape 9 | `a-publier` / `mise-en-ligne-incertaine`, « Reprendre » relit le brouillon |
| retirés, à ne PAS remettre | — | `completionSecoursPhotos`, `photosNeuvesBrouillon`, `secoursTaille`, réglage photo par annonce, « Varier » |

## 2. Mesuré en base (23 nov., lecture seule, projections scalaires ; aucune valeur recopiée)

| mesure | résultat |
|---|---|
| lignes `coffre_*` portant `versBrouillon` | **10**, toutes datées du **28 oct. au 1er nov.** ; **aucune** sur les 7 derniers jours (ni depuis le 1er nov.) |
| … état | 6 `a-publier` (4 avec `refuse-400`, 2 sans cause), 4 `fait` (dont 4 portant encore `refuse-400`) ; aucune `methode: 'formulaire'`, aucune avec `etapes` |
| `repub_trace_*` | **1 ligne**, 1 entrée : `lecture`, ext. 5.410.1, 20 nov. 17:53, Vinted **404** « Contenu non trouvé » (annonce disparue ⇒ rien n'a été recréé : le bon comportement) |
| `journal_vrm_*` | 2 lignes, 3 entrées, toutes `favori` ; aucune `republiee` |
| `vinted_brouillon_*` | 13 ; le plus récent (20 nov.) **n'est pas** `parVRM` (le sien) ; les brouillons VRM datent du 28 oct. au 1er nov. |
| compteurs `panel_diag_capture` (compte principal, 5.436, relevés le 23 nov. 07:38, cumul) | `republier_mise_en_ligne_refusee_400` 6, `brouillon_publier_refuse_400` 11, `refaire_brouillon_refuse_400` 2, `versbrouillon_brouillon_refuse_400` 2 ; refus nommés : taille 10, photos 7, photos+taille 1, description 2 ; freins 403 ×55, 429 ×24 — **inchangés depuis les mesures du 17 et du 20 nov.** |
| compteurs du chemin « formulaire » (`formulaire_republier_ok`, `formulaire_brouillon_ecart`, `formulaire_mise_en_ligne_incertaine`, `interface_supprimer_*`, `formulaire_selecteur_*` hors cloche, `repub_ordre_photos_*`, `formulaire_champ_hors`, `recreer_*`) | **0 — absents** : la republication par le formulaire (5.410.3 → 5.439) **n'a jamais tourné en production** |

**Constat honnête** : il n'y a **aucun échec récent à compter** — il n'y a aucune republication récente. Les 20 refus
400 connus datent d'extensions d'avant le 29 oct. (méthode par requêtes, aujourd'hui retirée). Le chemin actuel (le
formulaire) n'a jamais été confronté au vrai Vinted : ses sélecteurs (`#title`, `#category`, `data-testid`…) ont été
relevés une fois le 20 nov. et jamais revérifiés. Les seules preuves d'un DOM réel récent viennent des favoris
(23 nov.) : la cloche introuvable 18 fois — la page a déjà changé une fois sous VRM.

## 3. Le plan (phase 2, après la fusion de `favoris-auto`)

Principe : **rien ne change dans l'ordre, les gardes, les budgets, ni ce qui est écrit** ; on change **comment un
élément est trouvé**, **comment il est cliqué/tapé** et **le rythme**. Tout reste sous `recreerParFormulaire` /
`etapeFormulaire` ; chaque étape garde son contrat de retour (`ok`, `code`, `manque`, `parti`, `rep`).

### 3.1 Sur la couche de repérage (`vrm-trouver.js`, `__vrmTrouver.trouver/attendre`)
Une entrée `ELEMENTS` par élément, chacune avec plusieurs stratégies pondérées, un **contexte** et des
**exclusions** ; un seul gagnant, `ambigu` ⇒ rien.

| élément | stratégies (ordre de poids) | contexte | exclusions |
|---|---|---|---|
| `vendre` | data-testid `header-upload-item-button` (exact, puis partiel `upload-item`), lien `/items/new`, nom accessible 5 langues (« Vends tes articles », « Vendre », « Sell now »…) | en-tête | tout ce que VRM pose |
| `champTitre` / `champDescription` / `champPrix` | `#title` / `#description` / `#price`, `name=`, `label[for]` au libellé exact 5 langues, `data-testid*=title|description|price` | **le formulaire de vente** (le `form` qui contient l'entrée photos) | champs de recherche, champs du dialogue |
| `photos` | `input[type=file][data-testid*=photo]`, `input[type=file][accept*=image]` unique dans le formulaire | formulaire de vente | — |
| `categorie`, `marque`, `taille`, `couleur`, `etat`, `colis` (ouvreurs) | id actuel, `data-testid*`, `aria-haspopup` + libellé exact, `label[for]` | formulaire de vente | |
| `categorieRecherche`, `marqueRecherche` | id actuel, `input[type=search]` **dans la liste ouverte** | la liste ouverte (`role=listbox`/`dialog`) | la recherche du site (en-tête) |
| options (catégorie, marque, taille, couleur, état, colis) | **identifiant de Vinted** dans `data-testid`/`id`/`value` (`-{id}` final) d'abord ; libellé EXACT seulement si UNIQUE | la liste ouverte | — (§5 : jamais par ressemblance) |
| `brouillon` | data-testid `upload-form-save-draft-button`, nom exact (« Sauvegarder le brouillon », « Save draft »…) | formulaire de vente | « Ajouter », « Annuler » |
| `ajouter` | data-testid `upload-form-save-button`, `button[type=submit]` du formulaire au nom exact (« Ajouter », « Upload », « Pubblica »…) | formulaire du **brouillon** (adresse `/items/{draftId}/edit`) | « Sauvegarder le brouillon » |
| `supprimer` | data-testid `item-delete-button`, nom exact (« Supprimer », « Delete »…) | page de **CETTE** annonce (`/items/{id}`), hors dialogue | « Masquer », « Modifier », « Marquer comme réservé » |
| `supprimerConfirmation` | data-testid `*delete*confirm*` / `*confirm*` puis nom EXACT (« Confirmer et supprimer », « Supprimer », « Delete ») | **le** dialogue ouvert après le clic (un seul) | tout bouton « Annuler / Cancel / Fermer », tout bouton hors du dialogue |

⚠️ Correction de risque déjà repérée dans le code d'aujourd'hui : la confirmation de suppression prend **le premier**
bouton dont le texte *contient* « supprimer|confirmer|delete » (`find`, pas d'unicité) — sur un geste irréversible.
Elle passe à la règle « un seul gagnant, nom EXACT, dans LE dialogue » ; deux candidats ⇒ arrêt (« l'ancienne n'a
PAS été supprimée ; le brouillon attend »).

La **mémoire automatique** (`vrmTrouve`, par version de page) sert aux boutons sans identité ; pour les gestes
irréversibles (`brouillon`, `supprimer`, `supprimerConfirmation`, `ajouter`) elle **ne départage jamais seule** :
elle ne fait passer devant qu'un candidat qui a déjà gagné par une stratégie forte (data-testid ou nom exact). Le
journal `vrmTrouverJournal` / `trouve_rien_<élément>` dira, au premier vrai passage, ce qui a manqué. L'apprentissage
par SON clic (choix 102) reste le dernier recours pour la republication (comme aujourd'hui), à garder ou retirer
selon ce que Julien décide (question ouverte de `favoris-auto`).

### 3.2 Les vrais clics et la frappe (si §3 de CLAUDE.md le permet sur `main`)
| geste | aujourd'hui | après |
|---|---|---|
| clic sur un bouton / option / ouvreur de liste | `el.click()` | `gesteHumain.clic(el)` : point aléatoire DANS la boîte (marges), trajectoire, `Input.dispatchMouseEvent` (moved → pressed → released) |
| titre, prix, recherche catégorie/marque | setter natif + `input` lettre à lettre | `Input.dispatchKeyEvent` / `Input.insertText` par lettre, rythme `gesteHumain.frappe` (déjà 45–140 ms, hésitations) |
| description | `paste` + setter (défaut) | `Input.insertText` d'un bloc (« collée ») ou frappe par rafales (son réglage) |
| photos | `DataTransfer` sur l'`input[type=file]` | **inchangé** : `DOM.setFileInputFiles` n'est pas du domaine `Input` (hors décision) |
| défilement vers l'élément | `scrollIntoView` | `Input.dispatchMouseEvent` type `mouseWheel` par crans, puis vérification que l'élément est dans la fenêtre |
| case unisexe | clic sur son label | clic réel sur le label |

Conditions de sûreté propres à la republication :
1. **Le voile de l'onglet de travail** retient tout évènement `isTrusted` (« ceux de VRM passent » parce qu'ils sont
   `isTrusted:false`). Avec des clics réels, il bloquerait VRM **et** serait sous le pointeur (z-index max, plein
   écran) : le clic réel tomberait sur le voile. ⇒ Le fond arme une **fenêtre de geste** (jeton, coordonnées, 1,5 s)
   avant chaque `Input.*` : le voile passe `pointer-events:none` et laisse passer CE geste seulement, puis revient.
   À vérifier dans le code de `favoris-auto` (même problème pour les favoris) — sinon c'est à poser ici.
2. **Revérifier sous le pointeur** juste avant `mousePressed` : `document.elementFromPoint(x, y)` doit être l'élément
   gagnant ou un de ses descendants ; sinon rien n'est cliqué (`selecteur`, `manque: 'masque'`). Indispensable pour
   « Supprimer » et sa confirmation.
3. Le débogueur ne s'attache **qu'à l'onglet de travail** (`{tabId}`), seulement pendant une paire, détaché dans un
   `finally` ; une seule commande autorisée par un filtre (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`,
   `Input.insertText`) — tout autre domaine refusé et noté. Détaché par Chrome ou par lui (bandeau « … a commencé à
   déboguer ») ⇒ arrêt propre de la paire, jamais de repli silencieux sur `el.click()` au milieu d'une paire.
4. Onglet en arrière-plan : les évènements `Input` arrivent, mais le rendu peut être gelé ; la boîte de l'élément est
   relue juste avant chaque geste (jamais une coordonnée gardée d'une étape à l'autre).

### 3.3 Le rythme humain
- Gardés tels quels : 5–15 s entre deux champs (jamais deux fois le même, ×2 en prudence), 15–40 s après la
  suppression, ordre des champs tiré (catégorie avant ce qui en dépend), mise en ligne de la file +1–3 min.
- Ajoutés : les délais de `gesteHumain` (non périodiques) pour le temps entre « ouvrir la liste » et « choisir »,
  et entre deux paires de l'atelier **en plus** de SON espacement (jamais moins que SON réglage).
- Intermèdes de navigation (lecture seule) : seulement **entre deux paires**, jamais entre le brouillon et la mise en
  ligne d'une même paire (une paire supprimée et pas encore en ligne ne doit pas attendre plus que la pause prévue) ;
  ils ne réservent aucune action et ne sautent aucune garde ; arrêtés par « Tout arrêter ».

### 3.4 Ce qui reste en requêtes de page (GET seulement)
`item_upload/items/{id}` (recette vivante, 404/410, ancienne encore là ?), relecture du brouillon par « Reprendre »
(`is_draft`), grilles déjà apprises de la page. Aucune écriture ne revient par requête.

### 3.5 Risques
| risque | parade |
|---|---|
| sélecteur faux sur un geste irréversible | un seul gagnant, contexte, `elementFromPoint`, mémoire jamais seule juge |
| clic réel bloqué par le voile / tombé sur le voile | fenêtre de geste armée par le fond (3.2-1) ; banc qui rougit sans elle |
| débogueur détaché au milieu | arrêt propre, étapes datées sur preuve, « Reprendre » (inchangé) |
| bandeau du débogueur qui l'inquiète | dit dans l'écran plein (« VRM clique dans son onglet de travail ») |
| double brouillon / double mise en ligne | verrous inchangés (`r{id}`, `b{draftId}`, `versBrouillon` en base) |
| la page de Vinted différente du banc | journal de repérage + trace de forme ; **un essai réel d'une paire** avant toute série |
| conflit avec `favoris-auto` | aucune modification de l'extension avant sa fusion ; vrai `git merge origin/main` |

### 3.6 Bancs et audits à écrire (rouges sur le code d'avant ET par mutation)
1. `scripts/audit-repub-reperage.cjs` (vrai `vrm-trouver.js` + `vrm-formulaire.js` dans une page jsdom/Playwright,
   trois variantes de formulaire Vinted) : chaque élément trouvé seul ; ambigu ⇒ rien ; **confirmation de suppression
   ambiguë ⇒ aucun clic** (rouge sur `main` aujourd'hui : le `find` prend le premier) ; « Annuler » jamais ; option
   par identifiant jamais par ressemblance. Mutations : retirer le contexte, accepter le premier, mémoire seule juge.
2. `scripts/audit-repub-vrais-clics.cjs` (vrai `background.js` sur `_fond-vm.cjs`, faux `chrome.debugger` qui
   enregistre) : seules les méthodes `Input.*` ; attaché à l'onglet de travail seulement ; détaché en fin de paire et
   sur erreur ; point de clic dans la boîte ; `elementFromPoint` vérifié ; voile ouvert pour CE geste seulement.
   Mutations : autre domaine, clic hors boîte, voile non armé, repli `el.click()`.
3. `audit-republication-parfaite` (43), `audit-recreer` (169), `audit-repub-copie-fidele`, `audit-repub-verifier`,
   `audit-tout-interface`, `audit-formulaire-rythme`, `audit-republier-*` : doivent rester verts sans être affaiblis
   (ordre A5/A6, gardes F, retirés G).
4. Banc `scripts/bancs/repub-formulaire.cjs` (existe) étendu : une paire complète sur la fausse page Vinted
   (`scripts/_fausse-page-vinted.cjs`) avec le voile, captures 390/1512 de l'écran plein et de l'onglet de travail.

## 4. Ce qui est invérifiable sans son vrai compte
1. Le DOM réel du formulaire « Vendre », de la page d'une annonce et de la fenêtre de suppression aujourd'hui
   (relevé une fois le 20 nov., jamais depuis).
2. Que Vinted accepte un brouillon et une mise en ligne faits par ce chemin (jamais tourné : compteurs à 0).
3. Le comportement des évènements `Input` du débogueur dans un onglet épinglé en arrière-plan sur son Chrome / Orion
   (Orion n'a pas `chrome.debugger` : le chemin d'aujourd'hui y reste).
4. La recette de la première vraie paire (`2026-11-17-republication-parfaite.md` §7) reste le geste attendu.

## ÉTAT À LA REPRISE
- Phase 1 faite : ce plan, poussé sur `claude/republication-intelligente`. Aucune ligne de code changée.
- Phase 2 en attente de la fusion de `claude/favoris-auto` sur `main` (pas fusionnée le 23 nov. au moment d'écrire ;
  elle ne contenait pas encore `chrome.debugger`). À la reprise : `git fetch`, vérifier la fusion ET la ligne §3 de
  CLAUDE.md (débogueur permis ?), `git merge origin/main`, réserver la version (plus haut +1 dans
  `versions-reservees.txt`), puis 3.1 → 3.6 dans cet ordre.

### Mise à jour (23 nov., coordinateur de la session)
- La décision `chrome.debugger` (domaine `Input` seulement, bandeau de Chrome accepté) est **confirmée** : Julien l'a
  choisie lui-même dans la session du 23 nov. Elle sera écrite dans CLAUDE.md §3 par la **5.441** (branche
  `claude/favoris-humain`), qui apporte aussi `vrm-trouver.js`, `gesteHumain` et **le correctif de la confirmation de
  suppression (bouton unique)** : ne pas le refaire ici, vérifier seulement qu'il couvre la republication (§3.1, audit 1).
- La phase 2 attend la **fusion de la 5.441 sur `main`** (et non plus celle de `claude/favoris-auto`) ; le coordinateur
  relance cette branche à ce moment-là.
