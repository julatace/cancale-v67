# 11 nov. 2026 — Chacun compose sa Ma journée (lot journee-perso)

Branche `claude/journee-perso` (depuis `origin/main` fc3883d, `main` refusionnée ensuite), poussée à
chaque commit, **pas de PR ni de merge dans `main`** (consigne du coordinateur).

## Ce qui est demandé

« Modifier » en bas de Ma journée (et Paramètres → Ma journée) : la liste des cartes avec un
interrupteur et une poignée pour réordonner (au doigt et au clavier) ; « Revenir au réglage
d'origine ». Réglage synchronisé par compte. Intouchable : une carte qui porte un geste DÛ urgent
s'affiche toujours, même masquée (en tête, « affichée car urgent ») ; une carte masquée garde son
compteur publié ; Simple/Complet reste le réglage de départ, la personnalisation s'ajoute par-dessus ;
une carte livrée plus tard apparaît par défaut à sa place. Principe de Julien : « plus beau, simple,
surtout PRATIQUE ».

## Ce qui est livré

### La règle — `src/journeePerso.js` (pure, exécutée par l'audit)
- **Le catalogue** `CARTES_JOURNEE`, dans l'ordre d'origine (celui de Ma journée v2), en trois zones :
  - **En haut** (la tête sombre) : la phrase du jour · la prochaine chose à faire · les 7 derniers
    jours (frise) · les chiffres du mois ;
  - **À faire** : vendus ailleurs · en ligne deux fois · colis à envoyer · colis à retirer ·
    messages · prix à baisser · e-mails à relier · vendus encore rangés · supprimés de Vinted ·
    les autres rappels (litiges, achats à relier, inventaire… : `jobsAFaire`) · déclaration URSSAF ;
  - **En bas** : notifications coupées · Démarrer avec VRM.
- **Le réglage** `vrm_journee_perso` (dans `SYNC_KEYS`) : `{ v: 1, ordre: [id…], choix: { [id]: bool }, at }`.
  `choix` ne garde que ce qu'il a touché : une carte jamais touchée suit **Simple / Complet**
  (`visibiliteCarte` part de `caseJourneeMontree` — en Simple, « Prix à baisser » se tait toujours
  par défaut, et il peut la rallumer). « Revenir au réglage d'origine » écrit un réglage vide.
- **Une carte livrée plus tard** (absente de `ordre`) : `ordreJournee` la pose juste après sa voisine
  d'origine (ou en tête) — elle apparaît par défaut, à sa place. Pour qu'un futur lot ajoute une
  carte : une entrée dans `CARTES_JOURNEE` + son bloc dans `blocsAF` (ou la tête / le bas) ;
  `audit-journee-perso` S4 refuse un bloc sans entrée et une entrée sans bloc.
- **L'urgence** `urgencesJournee` (aucun recalcul : les champs des cases déjà publiés) : « à envoyer »
  quand un colis est en retard (`alerte`) ou à sa date limite (`presses`) ; « à retirer » au dernier
  jour (`alerte`) ; ou une alerte urgente du même geste (`colis-en-retard`, `colis-limite`,
  `retrait-dernier-jour`). Seules ces deux cartes peuvent « forcer ».

### Les intouchables
- **Les alertes urgentes** (`j.urgent` : deux articles sous un N°, double vente, colis en retard,
  dernier jour de retrait, colis eBay à ne pas poster…) ne sont PAS dans la liste : toujours en
  premier, jamais cachables ni déplaçables (ce qui était déjà la règle des widgets du 21 oct.).
- **La panne de la base** (`LignePanne`, `BaseInjoignable`) n'est pas une carte : intouchée.
- **Cachée mais urgente** : « Colis à envoyer » / « Colis à retirer » reviennent d'eux-mêmes, juste
  après les alertes (donc en tête de « À faire », ou dans la tête si c'est la première), avec
  « Affichée car urgent » (ambre : un geste à faire, jamais le rouge) — `data-jp-force`.
- **Le compteur d'une carte cachée reste publié** : une case cachée sort de `cases`, donc tombe dans
  le MÊME bloc caché `data-tuile` que les cases à zéro (audit-vendeurs-différents B2, inchangé) ; les
  autres cartes cachées laissent `<span data-jp-cachee data-n>` ; la frise et les chiffres du mois
  cachés restent RENDUS dans un `<div hidden>` (leurs `data-*` et publications ne changent pas).
  Défaut trouvé au banc et corrigé : quand TOUT ce qui reste à faire est caché, la branche « Rien à
  faire dans tes cartes affichées » ne portait pas le bloc caché — elle le porte (`compteursCaches`).
- **« N gestes »** ne compte que ce qui est à l'écran (`nGestesTout − cartes cachées`) ; en bas,
  « N cartes cachées » à côté de « Modifier ma journée ».

### Les écrans
- **Ma journée** : la tête, « À faire » et le bas suivent SON ordre. « La prochaine chose à faire »
  cachée ⇒ rien ne monte en tête (la première carte reste dans la liste). En bas : **« Modifier ma
  journée »** (secondaire, 44 px) ouvre une feuille (`SheetShell`, `data-feuille-journee-perso`).
  Le « Modifier » de la carte des chiffres (choisir les chiffres) est inchangé : deux gestes, deux
  noms.
- **Paramètres → Affichage → Ma journée** (`data-reglage-journee-perso`) : le MÊME éditeur
  (`JourneePersoSetting`, exporté par App.jsx).
- **L'éditeur** (`src/JourneePerso.jsx`, `src/styles-journee-perso.css`) : trois listes groupées
  façon Réglages iOS ; par ligne une poignée (six points, 44 px), le nom, une phrase grise, un
  interrupteur (`.vrm-switch`, le même que Paramètres). Une carte cachée a son nom en gris.
  - **Au doigt / à la souris** : la poignée capte le pointeur (`setPointerCapture`,
    `touch-action: none` : la page ne défile pas pendant le geste) ; la ligne prend la place que
    désigne le doigt (le milieu de chaque autre ligne fait la frontière), avec une ombre pendant le
    geste. Mouvement réduit : aucune transition.
  - **Au clavier** : poignée focalisée, flèches haut/bas, Début/Fin ; le focus reste sur la poignée ;
    « Les chiffres du mois : 3ᵉ sur 4 » est annoncé (`aria-live`).
  - Chaque geste s'enregistre tout de suite ; toutes les instances (Ma journée, sa feuille,
    Paramètres) suivent sans attendre (`_ecoutesPerso`), le nuage reçoit la ligne `main` comme tout
    réglage de `SYNC_KEYS`.

### Ce qui a bougé sans qu'il le demande
- **« Notifications coupées »** passe SOUS « À faire » (zone « En bas », avec le guide) : avant, il
  était juste au-dessus. Raison : une seule règle de zones (haut · à faire · bas) ; ce rappel n'est
  pas un geste dû. Il peut le remonter en tête de « En bas » ; s'il le veut au-dessus de « À faire »,
  c'est une ligne à changer (`zone`).
- **La barre d'import** (lot import-depart, fusionné pendant la session) n'est pas une carte : elle
  n'existe que pendant l'import ; elle reste après le guide, toujours affichée.

## Fichiers
- `src/journeePerso.js` (neuf) · `src/JourneePerso.jsx` (neuf) · `src/styles-journee-perso.css` (neuf).
- `src/App.jsx` : `SYNC_KEYS` (+ `CLE_JOURNEE_PERSO`), `useJourneePerso` / `JourneePersoSetting`
  (après `useProfilVendeur`), Ma journée (`visJ`, `urgJ`, `blocsAF`, `compteursCaches`, la tête par
  `ordreJournee('tete')`, le bas, la feuille).
- `src/ecrans/Reglages.jsx` : l'entrée « Ma journée » du groupe Affichage.
- `scripts/audit-journee-perso.cjs` (neuf) ; mis à la nouvelle forme sans s'affaiblir :
  `audit-journee-coherence` A4 (le total s'appelle `nGestesTout`, les cartes vivent dans `blocsAF` ;
  la règle « chaque carte rendue est comptée » est la même), `audit-vendeurs-differents` B1 (le mode
  est lu aussi par `visibiliteCarte` / `nCartesCachees`, qui partent de `caseJourneeMontree`).
- `scripts/bancs/journee-perso.cjs` (neuf).

## Preuves
Voir la fin de ce fichier (complétée en fin de session).
