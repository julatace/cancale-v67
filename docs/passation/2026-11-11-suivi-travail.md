# Suivi d'un travail long — VRM figé, détail, barre de progression (11 nov.)

Demande de Julien : « quand l'app republie, publie de Vinted à Leboncoin, je veux que VRM reste FIGÉ et qu'il y ait un DÉTAIL de toutes les infos que VRM fait, avec une BARRE DE PROGRESSION. »
Branche `claude/suivi-travail` (partie d'`origin/main` f04d4a5). Aucune PR, aucune fusion.

## ÉTAT À LA REPRISE (arrêt demandé par Julien via la session principale)

### Fait (poussé, WIP)
- `src/suiviTravail.js` — règle PURE + magasin `suivi` :
  `creer`, `debutArticle`, `etapeArticle`, `finArticle` (ok · main · refus · saute), `noter` (journal horodaté, ≤ 400 lignes),
  `poserPause`/`leverPause` (pause de sécurité avec échéance), `demander` ('pause' | 'arret'), `doitSArreter`, `terminer`
  (pause · arrete · fini · interrompu), `reprendre`, `progression` (N sur M, part, étape en cours, écoulé, restant ESTIMÉ au
  rythme réel = écoulé ÷ finis × restants, `null` tant qu'aucun fini ⇒ « — »), `recap`, `texteJournal` (copiable),
  `nettoyer` (retire e-mail, @pseudo, téléphone, liens de profil/messages), `repriseApresChargement` + `repriseDepuisExtension`
  (lit les `cmds` de l'extension, jamais deviné), `archiver` (≤ 20 travaux, `vrm_suivi_travaux`).
  Magasin : `suivi.demarrer({ sorte, titre, etapes, articles, uid, surGeste })` rend un pilote
  (`debut`, `etape`, `noter`, `fin`, `pause`, `finPause`, `plafond`, `doitSArreter`, `demande`, `terminer`, `enPause`) ;
  `suivi.demander`, `reprendre`, `arreterEnPause`, `fermer`, `relire(jobs)`, `pilote()`. Gardé sur l'appareil (`vrm_suivi_travail`) à chaque pas.
  Vérifié à la main par `node -e` (progression, journal, nettoyage) — **aucun audit écrit encore**.
- `src/composants/SuiviTravail.jsx` — `SuiviTravailFeuille` (portail body, z 15000 < confirmations 20000, tout le reste de
  `<body>` en `inert`, Échap neutralisé, retour du navigateur reposé, `beforeunload`, « Mettre en pause » / « Arrêter » confirmé
  dans la feuille, barre `role=progressbar`, étapes de l'annonce, écoulé / « environ », pause avec compte à rebours,
  `JaugeActions`, journal copiable, récapitulatif, « Fermer » ⇒ archivé), `SuiviTravailHote({ lireJobs, abonnerExt })`,
  `TravauxPasses` (pour « Ce que VRM a fait »), `useSuivi`.

### PAS fait (reste, dans l'ordre)
1. `src/composants/suivi-travail.css` (importé par le composant, **absent ⇒ le build casse tant qu'il n'existe pas**) — classes `vrm-st-*` ; jetons `--vrm-bg/--vrm-ink/--vrm-muted/--vrm-line/--vrm-accent/--vrm-warn` ; fond opaque plein écran ; 44 px ; ambre pour pause/refus, jamais rouge (§7).
2. Clés `suivi.*` dans `src/i18n/langues/fr.js` puis en/es/it/de (liste : grep `tr('suivi.` dans le composant ; pluriels `{ one, other }` pour `suivi.nReussies`, `nMain`, `nRefus`, `recap.*`) ; ajouter `src/composants/SuiviTravail.jsx` à `MIGRES` de `scripts/audit-traduction.cjs`.
3. Monter `<SuiviTravailHote lireJobs={() => __vmrJobs} abonnerExt={onVmrExt}/>` UNE fois dans `AppCoeur` (src/App.jsx ~53318).
4. Brancher : Republier (`src/ecrans/Republier.jsx` : démarrer dans `lancerFile`, alimenter depuis les effets `st`/`prog` (événements `vrm:ext` `{type:'maj',quoi:'repub',id,etape,pause,jusqua}`)/`prochaine` ; `surGeste('pause'|'arret')` ⇒ `setMode('pause'|'fini')`, `'reprendre'` ⇒ `setMode('run')`) ; `BaissePrixSerie.jsx` (`lancer` : `arret.current` ⇐ `doitSArreter`) ; « Retirer des autres sites » (App.jsx ~41665, envelopper les rappels `lbc`/`ebay` d'`executerRetraits`) ; `ModeVacances.jsx` (`lancer`) ; Leboncoin (`src/ecrans/Leboncoin.jsx` ~955 `lbcPublier`), eBay, Vestiaire.
5. `TravauxPasses` dans `JournalVrm` (src/ecrans/Reglages.jsx ~2589, après `HistoriqueModifications`).
6. Preuves §6 : `scripts/audit-suivi-travail.cjs` (règle + mutations : estimation inventée, pseudo laissé, arrêt au milieu d'une annonce), banc `scripts/bancs/suivi-travail.cjs` 390/1512 (inert, retour, beforeunload, pause, reprise après rechargement), captures regardées ; build ; `audit-traduction`, `audit-quoi-de-neuf`.
7. « Quoi de neuf » (`src/nouveautes.js`), ligne §9 de CLAUDE.md, API dans `COORDINATION-AGENTS.md` (branche `claude/coordination`) pour « Publier partout », vrai `git merge origin/main`.

### Pièges
- Extension : AUCUN changement nécessaire (elle émet déjà les étapes fines) ⇒ la 5.360 réservée n'a pas été prise.
- Les questions posées pendant le travail (couleur d'un brouillon, champ manquant) passent par `askConfirm`/`askChoix` (z 20000, portail créé APRÈS le gel) : elles restent répondables — ne pas monter la feuille au-dessus de 20000, ne pas figer les nœuds ajoutés après.
- La boucle Republier vit dans l'écran : après rechargement le travail est « interrompu » ; l'annonce en cours est « à vérifier », sauf si l'extension dit son étape. Ne jamais la déclarer faite.
- `TravauxPasses` utilise `toLocaleString('fr-FR')` : passer à `date()` d'`src/i18n`.
