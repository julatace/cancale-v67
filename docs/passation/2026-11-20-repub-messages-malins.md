# 20 nov. 2026 — Republication et messages plus intelligents (extension 5.410.0)

Branche `claude/repub-messages-malins` (depuis `origin/main` dd3336382). L'extension est la **5.410.0**
partagée avec `claude/panneau-vintex` (qui monte le manifeste, `CODE_VERSION`, `EXT_ATTENDUE` et les zips —
ce lot ne les touche pas ; capacités `repubfidele`, `repubverif`, `messagesmalins` posées à 5.410.0).

Julien (20 nov.) : « plus d'intelligence, même dans la republication, car les catégories sont parfois mal
remplies et ça bloque côté Vinted ; pareil pour l'envoi des messages ». Puis : « normalement, vu que c'est déjà
en ligne, c'est juste du copier-coller sauf les photos ».

## 1. Mesuré d'abord (vraie base, lecture seule, projections ; aucune valeur recopiée ici)

**Traces de republication** : `repub_trace_*` = **0 ligne** — aucune republication n'a tourné depuis la 5.408
(la trace n'a donc encore rien dit). Les causes viennent des brouillons et des compteurs.

| mesure | nombre |
|---|---|
| brouillons créés par VRM (`vinted_brouillon_*`, `parVRM`) | 9 (5 publiés, 4 restés brouillon) |
| … bâtis **sans** le corps du formulaire de l'annonce d'origine (recette « codes » : 7 champs, isbn / mesures / fabricant forcés à null) | **8 sur 9** |
| … bâtis depuis ce corps | 1 — **égal à l'origine champ par champ** (catégorie, attributs, couleurs, colis, marque, envoi) |
| corps du formulaire « Modifier » de Vinted rangés chez lui (`vrm_vinted_modele`) | 63 : toujours les mêmes 20 clés (`imei` sur 14) ; **13/63 ont une matière** (`material`), 34/63 deux couleurs ; isbn / mesures / fabricant toujours null (des baskets) |
| compteurs de refus de Vinted (`panel_diag_capture`, cumul, toutes écritures Vinted) | **taille ×10**, photos ×7, photos + taille ×1, description ×2, « listing restricted » ×1 |
| `avant_taille_corrigee` (taille corrigée AVANT d'envoyer) | 2 ; `tailles_lues` 2 ; `tailles_cache_absent` 5 |
| mise en ligne refusée 400 (republier / brouillon / refaire) | 6 / 11 / 3 (toutes d'avant le 29 oct., voir `2026-11-17-republication-parfaite.md` §6) |

**Messages aux favoris** (file `favoris_file_*`, son compte) : 17 envoyés, **2 refusés par Vinted** sans raison
lisible (`vinted_refus` : la réponse de Vinted n'était pas gardée), **2 arrêtés par l'anti-robot**, 2 sautés
(conversation déjà commencée), 39 annulés par lui, 1 clôturé à la main. Aucun journal du mode auto.

Ce qu'on **ne peut pas** dire : quel mot Vinted refuse (aucune réponse gardée), ni si les 10 refus « taille »
viennent de republications ou de « Publier sur… » (compteur commun). La 5.410 garde désormais la forme de ces
refus (clés, code — jamais le texte : `favori_refus_forme`, `recette_champs_inconnus`, trace `fidele`).

## 2. La copie fidèle (`repubfidele`) — priorité de Julien

`apprendreRecetteVinted` lisait déjà `GET item_upload/items/{id}` (la page « Modifier » de l'annonce, onglet du
compte) mais `ficheDeCorpsVinted` n'en gardait que 7 champs ; sans recette rangée (8 fois sur 9), le corps du
brouillon mettait isbn, mesures, fabricant, étiquetage à null et l'envoi par défaut.
- `recetteFidele(item)` (`<repub-fidele-regle>`) : chaque champ du formulaire que Vinted sert
  (`CHAMPS_FORMULAIRE_VINTED` : titre, description, prix, devise, catégorie, marque, couleurs, attributs
  — taille, état, matière… —, colis, unisexe, isbn, imei, mesures, fabricant, étiquetage, envoi,
  classification) est recopié TEL QUEL ; jamais `id`, `photos`, `is_draft`, `push_up`… ; un champ inconnu de
  VRM n'est jamais inventé dans le corps, son NOM part dans la trace (`fidele.ecartes`).
- `itemPourRecreer({ recette })` : la recette lue gagne sur une recette rangée plus ancienne ; titre et prix
  restent ceux de l'atelier (SON choix) ; la description VIVANTE gagne sur une copie rangée.
- Une liste lue vide n'efface jamais une liste pleine (« rien lu » ≠ « rien ») ; la relecture du brouillon avant
  la mise en ligne (`appliquerBrouillonLu`) pose aussi chaque champ que Vinted a rangé.
- Seules les photos sont renvoyées (depuis le coffre, comme avant). L'ordre coffre → brouillon → suppression →
  mise en ligne est inchangé ; rien de retiré n'est remis (`completionSecoursPhotos`, `photosNeuvesBrouillon`,
  `secoursTaille`).
- Trace : `req.fidele = { copies, ecartes, differents }` (noms seulement).

## 3. Le contrôle AVANT de lancer (`repubverif`)

Le contrôle préalable ne sert plus que pour le cas où Vinted a changé son catalogue depuis la mise en ligne.
- Extension `verifierRepub` (commande `verifierRepub`, SUR SON CLIC — l'étape « Envoi » de l'atelier — lecture
  seule, compte de l'onglet, une à la fois) : par annonce, le formulaire lu (le même que la copie), puis
  `reglerAvant` (grille de la catégorie : taille, obligatoires ; complétion par identité ; SA réponse validée
  contre les valeurs de Vinted) et la catégorie refusée par Vinted (`grilleTailles` : 400/422 sur le champ
  `category` ⇒ `categorieRefusee`). États : `ok` · `corrige` (taille au même libellé dans la grille d'aujourd'hui,
  champ repris de CETTE annonce — montré) · `a-corriger` (UNE question, valeurs de Vinted) · `absente` (404) ·
  `pas-verifie` (dit). Budget : 20 lectures/h moins une lecture GARDÉE par annonce à republier (10 au plus) ;
  au-delà « vérifiée à son départ » (rien ne part incomplet : la vérification du départ reste).
- Aucune table Vinted → Vinted n'existe pour une catégorie supprimée : `src/correspondances.js` est Vinted →
  autres sites. Une catégorie refusée est donc DEMANDÉE (catégories que Vinted a déjà acceptées sur ses
  annonces), jamais devinée.
- App (`src/repubVerif.js`, `src/ecrans/Republier.jsx`) : « 3 vérifiées · 1 corrigée seule · 1 à corriger avant
  de lancer », sous chaque ligne la correction ou ce qui manque + « Choisir la taille » / « Retirer de la file » ;
  **Lancer fermé** tant qu'il reste « à corriger » ; une « absente » ne part jamais ; SA réponse voyage avec SA
  paire au départ (`reponses`). 5 langues (`rep.verif.*`), styles `src/republication.css`.

## 4. Les messages aux favoris (`messagesmalins`)

- La règle « les mots qui font bannir un compte » (`src/messageSur.js`, 12 nov., son seul propriétaire) est
  recopiée dans l'extension par `scripts/recopier-message-sur.cjs` (`<message-sur-regle>`, enfermée dans une
  fonction) : avant tout geste, une version SÛRE est tirée parmi SES versions ; aucune ⇒ rien ne part
  (`texte_interdit`) ; le texte final (pseudo, titre, prix posés) est relu. L'éditeur le disait déjà (12 nov.).
- Vinted refuse le message (400/422, hors frein) ⇒ `texte_refuse` : l'EMPREINTE de cette version est gardée
  (`vrmVersionsRefusees`, 30 j, jamais le texte), elle n'est plus tirée ; la file CONTINUE avec ses autres
  versions (2 refus de texte au plus par lot), sinon elle s'arrête et dit le geste. 429/403 reste un frein.
- Sautés proprement, sans arrêter la file (`ignore`) : annonce vendue / réservée / masquée (dressing ou
  transaction), offre SOUS LE PRIX MINI posé dans VRM (lu en scalaire, clé entre guillemets), conversation
  refusée par Vinted (400/404/422 : acheteur qui a bloqué, compte fermé). Déjà contacté : comme avant.
- Bilan (`bilanFavoris`, `vueFile.bilan`, `fin.bilan`) : « 12 envoyés · 2 sautés (vendus ou indisponibles) ·
  1 refusé : texte refusé par Vinted » — écran du mode auto (traduit, `fav.bilan.*`) ; le panneau de vinted.fr
  peut le lire dans la vue de la file.

## 5. Pour le panneau (`claude/panneau-vintex`)

« Republier » du panneau ouvre l'atelier : la vérification y part seule. La commande `verifierRepub
{ uid, ids, reponses, total }` est une lecture (aucun plafond d'actions). La vue de la file des favoris porte
`bilan` (codes, à traduire avec `fav.bilan.s.*` / `fav.bilan.r.*`).

## 6. Preuves

- `audit-repub-copie-fidele` 10 verts ; `--prouve` 8/8 rouges (origin/main, mesures oubliées, fabricant
  oublié, recette non posée, non transmise, relecture ignorée, envoi écrasé, ordre inversé).
- `audit-repub-verifier` 17 verts ; `--prouve` 8/8 rouges.
- `audit-messages-malins` 17 verts ; `--prouve` 12/12 rouges (dont « message sur article vendu »).
- Verts : `republication-parfaite` 43, `recreer` 169, `republier-question`, `republier`, `republier-plusieurs-chrome`,
  favoris (offres-irreprochable, vintex, offre-message, auto, ecritures, rythme, clair, liste, ecran, relance),
  `message-sur`, `traduction`, `tdz`, `variables`, `moteur-offres`, `quoi-de-neuf`, `actions-gardees`,
  `fonctions-api`, `icones`. `audit-coherence` : 3 rouges attendus « seuil 5.410.0, manifeste 5.409.0 » — verts
  une fois le manifeste monté par `claude/panneau-vintex` (vérifié en local : seul `EXT_ATTENDUE` reste, leur lot).
- Banc `scripts/bancs/repub-verifier.cjs` (vrai build, coque native : Actions → Republier au téléphone, « Choisir une
  action » du tableau à l'ordinateur) : 390 tactile clair, 1512 clair et sombre — **tout OK** (récapitulatif, lignes,
  Lancer fermé puis ouvert, SA réponse pour SA paire au départ, 44 px, rien ne déborde). Captures regardées.
- **Défaut trouvé en regardant la capture** (d'avant ce lot) : au téléphone, la liste des annonces de l'atelier avait une
  hauteur de **0 px** (conteneur flex qui rétrécit, `overflow: hidden`) — on ne voyait ni les lignes ni leurs gestes.
  Corrigé (`flexShrink: 0`, `data-republier-liste`), contrôle V2c du banc.
- `scripts/bancs/republication-parfaite.cjs` ne passe plus depuis la coque native (il cherche `[data-actions-ouvrir]`,
  caché) : à recâbler comme `repub-verifier` (non fait ici).

## Geste de Julien

Aucun de plus que l'installation de la 5.410 (lot commun). Puis UN essai de republication d'une paire : la
ligne `repub_trace_*` dira, pour la première fois, les champs copiés et, si Vinted refuse, le champ et le message.
