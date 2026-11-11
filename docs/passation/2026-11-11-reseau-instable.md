# 11 nov. — Réseau instable : zéro donnée perdue, zéro écran bloqué

Branche `claude/reseau-instable` (depuis `origin/main` `fc3883d`), poussée à chaque commit, **pas de PR ni de
merge** (consigne). Aucune migration, aucune route ajoutée (12 fonctions), **extension inchangée**. Aucune
écriture en base réelle : banc et audit inventent tout.

## 1. Ce qui existait (mesuré, pas refait)

- **La file d'envoi** (`src/fileEnvoi.js`, 2 nov.) : tout geste qui passe par `save` sur une clé synchronisée de
  la ligne `main` (prix d'achat, N°, « Retiré » `vrm_colis_collected`, « Je dépose » `vinted_ship_done`,
  « Marqué imprimé » `vinted_bords_printed` / `vrm_vc_imprimes`, note privée `vrm_notes_paires`, corbeille
  `vrm_corbeille`, la plupart des réglages) est gardé sur l'appareil avec la base de sa fusion, rejoué dans
  l'ordre au retour, fusionné à trois voies, écrit en comparer-et-échanger sur `data.rev` ; il ne sort de la
  file que sur une écriture ACCEPTÉE. Le rejeu est idempotent (sous-valeurs posées, pas des « basculer »).
- **La pilule « Annuler »** (`src/gesteAnnulable.js`) : « Pas encore envoyé — gardé sur cet appareil » quand la
  base ne répond pas ; « Pas enregistré » + retour en arrière quand elle REFUSE.
- La mention « N changements en attente d'envoi » (`EnAttenteEnvoi`), les relances 5 s / 15 s / 1 min / 2 min,
  la relance à `online` et au retour au premier plan, l'écran hors ligne (lecture seule, gestes en file).
- Côté serveur, les factures sont déjà idempotentes (`deja` : même facture, même numéro au rejeu).

## 2. Les trous trouvés (rouges sur `origin/main`, banc `scripts/bancs/reseau-instable.cjs`)

| | scénario | sur main | cause |
|---|---|---|---|
| B | requête **tenue** (le sous-sol : connexion ouverte, rien ne revient) | la saisie suivante n'arrive JAMAIS (45 s, base restée à l'ancienne valeur), aucune mention « en attente », geste suivant perdu tant que l'app reste ouverte | `cloudPush` sans délai : `_pushEnVol` restait vrai pour toujours ; `relireNuage` et `lireNuageComplet` aussi sans borne |
| D | **429** pendant la note privée | pilule « Pas enregistré », la note **défaite** (effacée de l'appareil), jamais en base | « la base a répondu 429 » se lisait comme un refus 4xx (`natureEchec`) ⇒ l'inverse était écrit |
| D | **401** d'un jeton vieux (retour du réseau après plus d'une heure) | alerte « refusé » à l'écran, envoi seulement 5 s plus tard ; un geste à pilule fait à ce moment-là était défait | pas de renouvellement avant de juger |
| A | retour du réseau | jamais « Enregistré » : la mention disparaît sans un mot | — |

Hors banc (lu dans le code) : les routes des factures (`/api/compte?mode=facture-pro|facture-autre`), `lireReglage`
et `ecrireReglage` n'avaient pas de borne (« Émettre » occupé, « enregistrement… » à vie) ; « Ma facture » sur une
coupure disait « réessaie » et perdait la saisie si la fiche se fermait ; une réponse perdue d'une facture disait
« Pas de réseau : rien n'a été fait » alors que le serveur avait pu l'émettre.

## 3. Ce qui est fait

- **`src/reseauBorne.js`** (module pur) : `fetchBorne(fetch, url, init, ms)` — passée la borne, la requête est
  abandonnée et vaut « pas su » (`DelaiReseau`), jamais « refusé » ni « enregistré » ; le signal de l'appelant est
  respecté. Bornes : écriture 20 s, lecture 15 s, route qui écrit 30 s. `statutPassager` (0, 408, 425, 429, 5xx) ;
  `raisonStatut` (la phrase d'échec, jamais « refus » pour un passager).
- **`cloudPush`** : PATCH conditionnel et insertion bornés ; `lireNuageComplet` et la lecture scalaire de
  `relireNuage` bornées. Abandonnée, une écriture que la base avait faite quand même est vue au rejeu (devancé sur
  `rev` ⇒ relue ⇒ fusionnée ⇒ rien en double — scénario C). **401** ⇒ `authRefresh()` puis renvoi, une fois ;
  renouvellement « pas su » ⇒ passager ; refusé ⇒ comme avant.
- **`natureEchec`** (src/gesteAnnulable.js) : 408/425/429 ⇒ « passager » (le geste reste, la file le renverra).
- **`EnAttenteEnvoi`** : après avoir dit « N changements en attente d'envoi », dit **« Enregistré »** (coche, 4 s,
  `data-envoi-fait`) seulement quand la file est vide ET que la dernière sauvegarde a réussi.
- **`lireReglage` / `ecrireReglage`** bornées.
- **Factures** (`FacturePro.jsx`, `FactureAutres.jsx`) : routes bornées ; une réponse qui ne vient pas dit
  « Réessaie : si elle était partie, tu retrouveras la même facture, jamais une deuxième » (le serveur rend `deja`) ;
  « Pas de réseau : rien n'a été fait » seulement quand l'appareil se sait hors ligne.
- **« Ma facture »** (`FicheFacturation`) : chaque champ tapé est d'abord gardé sur l'appareil
  (`vrm_fp_attente`, effacé à la déconnexion comme tout `vrm_*`), puis lu-fusionné-écrit ; pas de réponse ⇒
  « ⏳ pas encore enregistré · réessai automatique (gardé sur cet appareil) », relances 5 s / 15 s / 1 min / 2 min,
  au retour du réseau et à la réouverture de la fiche ; un champ retapé pendant l'envoi reste en attente.

## 4. Preuves

- **Banc `scripts/bancs/reseau-instable.cjs`** (vraie app, base à état `_base-ecritures.cjs` qui sait maintenant
  `tenir` une requête sur une promesse — §6.5, jamais un délai fixe — et `perdre` une réponse APRÈS avoir écrit ;
  390 tactile et 1512) : A coupure avant · B requête tenue · C réponse perdue · D 503, 401, 429 (note privée) ·
  E hors ligne longtemps puis retour · F deux appareils (le plus récent ailleurs gagne, rien d'effacé, la clé d'ici
  arrive) · G aucun doublon, pool des N° intact, aucune erreur JS. Voir §6 pour les chiffres.
  - Sur `origin/main` (build d'avant, `BANC_DIST`, 390) : **9 rouges** — B (3), D-401 (2), D-429 (3), « Enregistré » (1).
    A (coupure avant), C (réponse perdue), E (longtemps hors ligne) et F (deux appareils) étaient DÉJÀ verts sur main :
    la file d'envoi du 2 nov. les tenait. Ils restent dans le banc comme garde-fous.
  - **Mutations construites** (builds mutés, `BANC_DIST`) : borne jamais posée ⇒ B rouge (3) ; 429 redevenu refus ⇒
    D rouge (3) ; 401 sans renvoi ⇒ D rouge (2).
- **`scripts/audit-reseau-instable.cjs`** : règle EXÉCUTÉE (R1–R14, `natureEchec` réel composé avec
  `raisonStatut`), branchement (B1–B15) — 39 verts ; `--prouve` : **8/8 mutations rouges** (borne jamais posée,
  429 refus ×2, PATCH nu, 401 sans renvoi, lecture du nuage nue, « Enregistré » trop tôt, Ma facture sans relance).
  Sur `origin/main` : rouge (module absent).
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `textes-courts`,
  `fonctions-api`, `secrets`, `geste-annulable`, `file-envoi` : verts.

## 5. Pas fait / risques restants

- **Le temps « 10 min » est compressé** dans le banc (E : réseau mesuré coupé 12 s, plusieurs relances ratées,
  puis retour) : les relances ne s'arrêtent jamais (2 min au plus entre deux), `online` relance tout de suite.
- **Pas mesuré sur un vrai iPhone en sous-sol.** Un `fetch` iOS qui pend est maintenant coupé à 20 s.
- **Réponse à un message** (Vinted/Leboncoin/Vestiaire) : passe par l'extension (ses propres délais et sa
  confirmation, geste chez un tiers) — pas rejouée automatiquement, exprès (un message envoyé ne se « rejoue »
  pas sans risque de doublon chez l'acheteur). Non touché.
- **« Ma facture » sur deux appareils** : la ligne `vrm_pro_facture` reste une fusion champ par champ sans `rev`
  (comme avant) ; deux appareils qui changent le MÊME champ pendant une coupure : le dernier arrivé gagne.
- **« N changements » compte trop sur la base inventée** : sous un 429, une note tapée sur Annonces affichait
  « 10 changements » (l'écran complète les fiches et publie son journal de prix). `vrm_prix_lus` est maintenant compté
  comme publié (7 restent : 6 fiches complétées par l'écran + la note). Sur de vraies fiches déjà complètes, l'écart
  devrait disparaître — pas mesuré.
- À 1512, la ligne existante « Pas encore synchronisé · Réessayer » sous le titre de Paramètres est écrasée
  (« Pas en… Rée/ssa/yer ») : préexistant, pas touché.
- Le vieux banc `file-envoi.cjs` reste rouge sur main comme ici (il n'ouvre plus « Compléter les prix d'achat »,
  préexistant, dit le 6 nov.) ; la file elle-même est prouvée par `audit-file-envoi` et par ce banc.

## 6. Chiffres

- `reseau-instable` : **72/72** (390 tactile + 1512) avant le merge ; rejoué après le vrai `git merge origin/main` (voir
  le rapport de session).
- `audit-reseau-instable --prouve` : 39 verts, 8/8 mutations rouges (après merge).
- Après merge : `npm run build` ; audits `variables`, `tdz`, `coherence` (⚠️ exige l'historique complet :
  `git fetch --unshallow origin main` dans un clone superficiel, sinon « historique illisible »), `identite`, `icones`,
  `textes-courts`, `fonctions-api`, `secrets`, `geste-annulable`, `file-envoi` : verts.
- Bancs voisins (rejoués main contre branche, même machine) : `codes-hors-ligne` vert ; `hors-ligne-froid` 80/80 des
  deux côtés (avec `BANC_PORTE_STRICTE=1`) ; `hors-reseau` 42 rouges **des deux côtés** ; `hors-ligne` 36 à 45 rouges
  sur main, 37 à 44 sur la branche (instable, « Ma journée s'ouvre sur la photo » rouge des deux côtés) — préexistant,
  pas de régression mesurée. Ces deux bancs n'acceptent pas `BANC_PORT=0` (port 0 littéral) : donner un vrai port.
- Captures regardées : `A-en-attente`, `A-enregistre`, `D-429`, `E-hors-ligne` en 390 et 1512.

## Geste de Julien
Aucun.
