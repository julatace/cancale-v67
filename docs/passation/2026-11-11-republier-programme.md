# 11 nov. 2026 · Republier à l'heure qu'il choisit + historique des republications (lot `republier-programme`)

Deux demandes validées par Julien :
- **(A)** « je prépare ma sélection (paires, ordre, espacement, réglages) et je fixe l'heure de départ (ex. demain 18 h) ; l'atelier démarre à cette heure-là avec EXACTEMENT mes réglages, la fenêtre SuiviTravail s'ouvre » ;
- **(B)** « l'historique des republications par annonce : combien de fois, quand, et ce que chacune a donné (favoris, vues, vente) », visible sur la fiche et dans l'atelier.

Branche `claude/republier-programme` (partie d'`origin/main` f04d4a58 + `claude/suivi-travail` 856e49dca fusionnée). Aucune PR, aucune fusion sur `main`. **Extension 5.368.0** (réservée dans `COORDINATION-AGENTS.md`, branche `claude/coordination`).

## §3 « Republication » — comment ça reste dans la règle
- C'est LUI qui choisit les paires, l'ordre, l'espacement, et qui lance : « Programmer » est SON clic, à une heure qu'IL a écrite. L'heure n'est jamais tirée, décalée ni rattrapée (fenêtre de départ : de l'heure à +10 min ; au-delà ⇒ « pas partie »). Jamais de départ « au hasard ».
- La file qui part est celle de l'atelier, inchangée : coffre → supprimer → brouillon → mise en ligne, depuis l'onglet vinted.fr, 50/h (réserve 5), `REPUB_PAR_JOUR` 50, frein après refus, pause 429. Rien n'est contourné : la programmation ne fait qu'OUVRIR l'atelier à l'heure et appuyer sur « Lancer » à sa place, avec la file et les réglages figés au moment où il a programmé.

## Ce qui est livré

### (A) Programmer
- **Règle** `src/repubProgramme.js` (pure) + `src/ligneCas.js` (une ligne dédiée écrite en comparer-et-échanger sur `data.rev`, motif d'`ecrireEmailsLus` ; lecture ratée ⇒ rien écrit).
  Ligne `vrm_repub_programme` = `{ rev, v, programmes: { [uid]: prog } }` ; `prog` = `{ id, uid, compte, action, ids (SON ordre), at (SON heure, ms), reglages (titre, prix, photo, lettre, espacement, temps tirés, lettres, ordre, via brouillon), etat: attente|partie|pas-partie|annulee|finie, raisons, appareil }`.
  - **Une seule en attente par compte** (`poserProgramme` refuse « deja » ⇒ l'écran demande « Remplacer ? »). 2 min d'avance au moins, 7 jours au plus, 50 paires au plus.
  - **Conditions au départ** (`conditionsDepart`), chacune dite À L'AVANCE dans l'atelier et vérifiée à l'heure : extension présente et à jour (5.368), onglet vinted.fr ouvert (dit par l'extension), onglet sur LE compte de la programmation, aucun frein de Vinted (`vrmFreinRepub`, dit par l'extension), place dans les 50 actions/h (jauge `actions_compte_*`, au moins 3 gestes), place dans les 50 republications du jour (la même lecture que l'extension, `coffre_*.versBrouillon.supprimeLe`), aucun autre travail en cours. **« Pas su » ⇒ RIEN ne part** (onglet, compte, frein, jauge, quota du jour pas sus : chacun a sa raison).
  - **Le départ est pris par UN appareil** : `prendreDepart` (« attente » → « partie », avec l'id de l'onglet) en comparer-et-échanger ; la veille n'ouvre l'atelier que si SON écriture a passé (deux Chrome sur le même compte ⇒ un seul départ).
  - Qui juge : l'appareil dont l'extension voit CE compte vérifie à l'heure ; un Chrome sur un autre compte attend 90 s (qu'un autre parte) puis dit « pas partie » (raison « compte ») ; un appareil sans extension (téléphone) ne déclare rien avant la fin de la fenêtre, puis « pas partie : VRM n'était pas ouvert… ».
- **Écran** `src/RepubProgramme.jsx` (+ `src/repub-programme.css`, tout en `tr()`, clés `rp.*`, 5 langues) :
  - `ProgrammerRepub` dans l'étape « Envoi » de l'atelier, après « Je confirme » (comme Lancer) : champ date-heure (défaut : demain 18:00), la liste des conditions, « Programmer N annonces à 18:00 ». Le clic passe la MÊME vérification que « Lancer » (`verifierAvantPublication`) puis écrit. RIEN n'est envoyé à Vinted.
  - `ProgrammesRepubCarte` en tête d'Annonces (à côté du compte rendu) : « Republication programmée · jeudi 12 novembre · 18:00 » + « N annonces · compte », **Modifier** (rouvre l'atelier sur SES réglages figés, « Programmer » remplace la même) / **Annuler** (confirmé ; une programmation partie ne s'annule plus). « Pas partie · … » en ambre (un geste à faire) avec chaque raison et son geste, « Rien n'a été envoyé à Vinted », Reprogrammer / Compris.
  - `ProgrammeRepubVeille`, montée dans `AppCoeur` à côté de `SuiviTravailCoque` : relit la ligne (chaque minute s'il y a une programmation en attente, sinon toutes les 5 min, et tout de suite après un geste), guette l'heure exacte (minuterie), rejuge à chaque changement d'état de l'extension.
  - **Prévenu** : « pas partie » ⇒ la notification EXISTANTE de l'appareil (`pushNotif`, toucher ⇒ Annonces → Republier), un bandeau (`toast`) et la carte ambre qui reste jusqu'à « Compris ».
- **Atelier** (`src/ecrans/Republier.jsx`) : props `programme`, `programmeMode` ('depart' | 'modifier'), `progsRepub`, `onProgrammeFait`. Une programmation rouverte part de SES réglages figés (réglages locaux, jamais réécrits dans les réglages communs ni dans `vrm_republier_esp`) : titre/prix/photo/lettre, espacement, temps tirés (gardés paire par paire tant que l'espacement est le même), lettres tirées, ordre, via brouillon. En départ : « Je confirme » déjà coché (il l'a coché en programmant), la liste vivante attendue (90 s au plus, sinon « pas partie : annonces pas lues »), `pairesAuDepart` (les paires programmées ENCORE en ligne, dans SON ordre ; une paire vendue ou retirée n'est jamais remplacée par une autre — elle est nommée dans le journal de la feuille), puis `lancerFile` ⇒ la feuille « VRM travaille » (lot suivi-travail) s'ouvre ; aucune ⇒ « pas partie ». Fin de la file ⇒ « finie ».
- **Extension 5.368.0** (lecture seule) : `etatDepartRepub(uid)` — onglet vinted.fr prêt (`ongletVinted`) et frein de republication du compte ; l'état rendu à l'app (`etatPourApp`) porte `repub: { onglet, frein }` ; stockage muet ⇒ `frein: undefined` (« pas su », jamais « aucun frein »). Aucune requête Vinted. Capacité `repubdepart` (5.368.0) dans `EXT_CAPACITES` et `audit-coherence`. Version montée partout (`CODE_VERSION`, manifeste, `lbc-inject`, `lbc-relay`, notice Orion, `EXT_ATTENDUE`), zips régénérés (`scripts/zip-extension.cjs`).

### (B) Historique par annonce
- **Règle** `src/historiqueRepub.js` (pure) : une republication est un LIEN « nouvelle → ancienne » prouvé — table de l'extension (`recreesEff` : `vinted_brouillon_*.ancienId`, `coffre_*.recreeDe`, liens posés à la main), fiche VRM (`vinted_annonce_numeros[nouvelle].recreeDe`, src/repriseNumero.js), et le journal neuf `vrm_repub_journal` (`{ e: { [nouvelId]: [ancienId, at, favorisAvant, vuesAvant, action] } }`, ≤ 1 500 entrées, comparer-et-échanger). La chaîne se remonte d'identifiant en identifiant (bornée, sans boucle). **Jamais par titre.**
  - Ce que chacune a donné = les compteurs LUS de l'annonce qu'elle a créée : encore en ligne ⇒ lus aujourd'hui ; remplacée ⇒ ceux notés quand elle a été republiée à son tour ; « vendue » = `annoncesVendues` (vente prouvée, par identifiant). Rien de lu ⇒ `null` (« — »), jamais 0. Une republication d'avant le journal compte (le lien existe), date / résultat « pas su » si rien ne les donne.
  - « +N favoris » = favoris de l'annonce en ligne depuis la dernière republication (une annonce recréée repart de zéro).
- **Écrit** dans App.jsx (`noterRepubJournal`) seulement quand l'extension rend « fait » / « double » avec l'identifiant neuf (Republier : `nouvelId`, immédiat ou mise en ligne planifiée ; En ligne → brouillon : `draftId`, le brouillon publié garde son id), avec les favoris / vues de l'ancienne lus au lancement.
- **Visible** : dans l'atelier sous chaque annonce (`LigneHistoriqueRepub` : « republiée 3 fois · dernière il y a 12 j · +4 favoris ») ; sur la fiche de l'article (`BlocHistoriqueRepub` dans la note de `FichePaire` : une ligne par republication, date, favoris, vues, vendue, en ligne). La fiche n'a pas la table de l'extension (elle vit dans `Comptabilite`) : elle remonte par la fiche VRM et le journal.

## Preuves
- `node scripts/audit-republier-programme.cjs` : **54 verts** (P1–P6 programmation, H1–H6 historique, E1–E5 extension EXÉCUTÉE par `scripts/_fond-vm.cjs`, B1–B6 branchements) ; `--prouve` : **16/16 mutations rouges** (heure décalée, deux par compte, onglet pas su = oui, frein ignoré, jauge pas sue = oui, autre compte accepté, quota du jour ignoré, départ rattrapé après la fenêtre, départ pris deux fois, paire remplacée, lecture KO qui écrit, écriture sans garde `rev`, historique par titre, « pas su » = 0, chaîne sans borne, extension « aucun frein » sur stockage muet).
- Banc `scripts/bancs/republier-programme.cjs` (vrai build, fausse base à état avec garde `rev`, faux pont 5.368 ; A programmer/annuler, B historique, C départ, D pas d'onglet, E heure passée ; 390 tactile / 1512, `THEMES`, `SHOTS`) : voir « ÉTAT » ci-dessous.
- Audits communs : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets, quoi-de-neuf, traduction — verts. Fichiers `RepubProgramme.jsx`, `HistoriqueRepub.jsx` ajoutés aux migrés de `audit-traduction` (F1).

## Choix tranchés (dans l'esprit de sa demande)
- La vérification d'avant publication (`verifierAvantPublication`) est faite à la PROGRAMMATION (son clic) et refaite au départ : si elle trouve un problème neuf, elle DEMANDE (VRM attend sa réponse ; rien ne part sans elle) — jamais un « oui » à sa place.
- VRM fermé à l'heure ⇒ rien ne part, la carte et la notification le disent à la prochaine ouverture (ou tout de suite sur un autre appareil ouvert, après la fenêtre). Pas de notification serveur (aucune catégorie « republication » dans `api/_lib/push.js` ; en ajouter une touche les familles de notifications) — noté en reste.
- « Modifier prix ou titre » et « Brouillons → en ligne » se programment aussi (même atelier) ; le quota du jour ne compte que Republier et En ligne → brouillon (ceux qui suppriment une annonce).

## ÉTAT À LA REPRISE
(mis à jour en fin de session — voir la dernière section)

## Restes
- Notification serveur quand AUCUN appareil n'est ouvert à l'heure (le cron du soir pourrait relire `vrm_repub_programme`) : pas fait.
- Pas vérifié en vrai : un départ sur son Chrome avec la 5.368 installée.
- Geste de Julien : installer l'extension **5.368.0** (sinon « Programmer » dit « Mets l'extension à jour »).
