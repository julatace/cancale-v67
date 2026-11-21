# 14 nov. 2026 — L'accueil des nouveaux (choix de Julien n° 132, 135, 137, 138, 141, 142, 144)

Branche `claude/accueil-nouveaux` (depuis `origin/main` 1acc0a05, puis vrai `git merge origin/main`).
Pas de PR (consigne). Rien dans `vinted-sync-extension/`, aucune migration, aucune fonction `api/`
de plus (12 inchangé). Coordination : `claude/refonte-plateformes-reglages` (connexion, accueil public,
démarrage) et `claude/refonte-coque` (barre, onglets) — ce lot crée SES fichiers et touche peu
d'endroits partagés (liste plus bas) ; la pastille « Nouveau » passe par `BadgeNav`, que le nouveau
menu de la coque utilise aussi.

## Ce qui existait (mesuré avant de coder)

- Le parcours d'arrivée en 3 étapes (`src/parcoursArrivee.js`, lot 46) supposait Vinted ; un vendeur sans
  Vinted n'avait qu'une liste « Relie tes comptes » sans preuve (`GuideDemarrageApp`).
- La langue (`src/i18n/index.js`) : sans choix, celle du navigateur À CHAQUE lancement (pas « au tout
  premier ») ; rien ne le disait au vendeur.
- Les notifications : un effet de MONTAGE d'`AppCoeur` appelait `askNotifPermission()` au démarrage
  (contraire au §3 « jamais d'invitation forcée ») ; Paramètres → Notifications (`PushSetting`) gardé.
- Le prix : section « Offres » de l'accueil (prix lus dans `src/accueil-reglages.js`, phrases `OFFRES`
  d'`api/_lib/plan-regle.js`, montants serveur `PRIX_CGV` / `PRIX_PRO_CGV` d'`api/compte.js`). Pas de page.
- « Rétrospective / Ton année » (`wrapped`, Ventes) : Vinted seul, calculé à part — PAS repris : le bilan
  lit la règle VENDU de la coque (toutes plateformes).
- Les pastilles de navigation : `badges[clé]` = un nombre (geste) ou `true` (point) — `BadgeNav`.

## Ce qui est livré

| n° | quoi | règle (pure, auditée) | dessin / branchement |
|---|---|---|---|
| 132 | « Ton bilan en une minute » : CA et ventes de l'année (chiffre d'affiche qui défile, courbe mois par mois), à expédier, à retirer, en ligne ; puis « Chaque matin, VRM te prépare ta journée » (4 lignes vraies de Ma journée) | `src/bilanMinute.js` — AUCUN calcul : VENDU = `liveStats.venduLignes` sommé par `bilanLignes` (injectée), `aExpedierPourCarte(vrm_colis_aposter)`, `vrm_colis_retirer.total`, `widgetBase.online` ; « au moins » + SA raison (source pas lue, montant illisible, import du passé en cours `lireImportDepart`) ; « — » si pas su | `src/accueilNouveaux/AccueilNouveaux.jsx` (`BilanMinute`), monté dans `AppCoeur` ; une fois (`vrm_bilan_minute`, SYNC_KEYS), seulement sur Ma journée, après un parcours COMMENCÉ (jamais chez un installé) et la 1re lecture de SA plateforme (`premiereLectureFaite`) ; « Passer » ; rejouable : Paramètres → Aide → « Revoir mon bilan en une minute » |
| 135 | Un parcours par plateforme : Leboncoin (compte · extension · « Ouvrir Mes annonces »), Vestiaire (compte · extension · « Ouvrir Vestiaire Collective »), eBay (compte · « Relier eBay », AUCUNE extension) | `routeParcours`, `etapesRoute`, `preuveSite` (`lbc_listings`/`lbc_ventes` lues ; `lbc_accounts` seul = « compte vu, lecture… » ; idem `vc_*`), `preuveEbay` (compte RELIÉ au registre), `select=id` seulement | la route vient de « Où vends-tu ? » (`vrm_plateformes_affichees`) ; Vinted choisi ou rien choisi ⇒ les 3 étapes d'avant, inchangées ; la liste « Relie tes comptes » reste pour les sites qui restent une fois ce parcours fini ; la carte relit ses sites au retour sur l'onglet / `vrm:ext` |
| 137 | Le premier colis accompagné : imprimer, coller, déposer, suivre (une feuille, 4 dessins) | `src/premierColis.js` : seulement le TOUT premier bordereau imprimé SEUL (`vinted_bords_printed` + `vrm_vc_imprimes` + `vrm_bords_sans_num` comptés AVANT le geste) ; une série ne l'ouvre jamais ; il attend que la visionneuse et toute fenêtre soient fermées | `annotateAndDownloadBordereau` / `mergeAndDownloadBordereaux` signalent `vrm:bordereau-imprime` ; une fois (`vrm_premier_colis`) ; rejouable : Paramètres → Aide |
| 138 | « Nouveau » sur les écrans pas encore ouverts | `src/ecransVus.js` : compte VRM créé il y a < 30 j seulement (sinon `installe`, jamais de badge) ; disparaît à la 1re ouverture ; jamais à la place d'un nombre ni d'un point ; seulement les écrans de `ECRANS_NOUVEAUX` | `BadgeNav` / `suffixeBadgeNav` (barre, menu, colonne, et le menu de la coque refaite) ; `vrm_ecrans_vus` (SYNC_KEYS) |
| 141 | La langue du téléphone au TOUT premier lancement | `langueDepart` (i18n) : `navigator.languages` lu une fois, noté à part (`vrm_langue_detectee`, sur l'appareil), JAMAIS dans `vrm_langue` ; le choix explicite gagne toujours ; hors des cinq ⇒ français | carte « VRM est en Deutsch, la langue de ton téléphone » sur Ma journée (une fois, sélecteur ⇒ un vrai choix synchronisé) |
| 142 | Les notifications au bon moment | `src/notifsBonMoment.js` : moments « colis suivi » (un lien de `lienSuivi` touché, puis retour dans VRM) et « premier colis » (sa dernière étape) ; une fois (`vrm_notifs_demande`) ; permission déjà accordée/refusée ⇒ rien ; iPhone sans l'app sur l'écran d'accueil ⇒ le DIRE (« Comment l'ajouter » ⇒ Paramètres → Notifications) | `requestPermission` seulement dans « Oui, préviens-moi » (puis abonnement push de l'appareil, `/api/push`, comme `PushSetting`) ; **l'ancienne demande au démarrage est retirée** (l'interrupteur local suit seulement une permission déjà accordée) |
| 144 | vrm.center/tarifs : Solo 16,99 € et Pro 19,99 € côte à côte (Pro sur une carte encre), comparaison, l'essai (jour 1 · 1 à 7 · jour 8), « Et ensuite ? » (résilier, rien supprimé, 14 jours), Stripe | prix = `PRIX_MOIS`/`PRIX_PRO_MOIS` = `PRIX_CGV`/`PRIX_PRO_CGV` = CGV ; phrases = `OFFRES` ; supplément = `prixCompteSupTexte()` ; « Gratuit pour l'instant » tant que `ACCES_OFFERT` ; Pro « Bientôt » tant que `PRO_OUVERT` est faux ; « Le paiement n'est pas encore ouvert » tant qu'un champ obligatoire de `public/legal/editeur.js` manque (le MÊME fichier que le serveur) | `src/tarifs/Tarifs.jsx` (morceau à part, textes chargés avec lui par `ajouterTextes`), route dans `src/main.jsx`, réécriture `/tarifs` dans `vercel.json`, plan du site, lien « Tout le détail des tarifs › » sous les offres de l'accueil ; aucun script en ligne (CSP) |

Textes : tout par `tr()`, cinq langues — `src/i18n/langues/<l>/nouveaux.js` et `<l>/tarifs.js` (dans
`<l>.js` ; `tarifs` aussi chargé par la page), `accueil.offres.tarifs` dans les cinq `*-accueil.js`.
`AccueilNouveaux.jsx` et `Tarifs.jsx` rangés parmi les écrans migrés d'`audit-traduction` (F).

Endroits partagés touchés (petits) : `src/App.jsx` (imports, SYNC_KEYS, `BadgeNav`, effet de démarrage
des notifications, `useParcoursArrivee`, `GuideDemarrageApp`, `CarteParcoursApp`, gestes du parcours,
signal des bordereaux, `DEPS_ACCUEIL_NOUVEAUX`, montage), `src/ecrans/Reglages.jsx` (2 lignes d'Aide),
`src/Accueil.jsx` (1 lien), `src/main.jsx` (route), `src/i18n/index.js`, `src/parcoursArrivee.js`.

## Preuves

- `npm run build` vert.
- **`scripts/audit-accueil-nouveaux.cjs`** (exécute les règles ; L1-L9, N1-N12, B0-B14, P1-P13, C1-C7,
  E1-E7, T1-T11) : vert ; `--prouve` **19/19 mutations rouges** (détection qui écrit `vrm_langue`,
  téléphone relu, demande au démarrage remise, question après un refus, iPhone non installé, bilan qui
  fait sa propre somme / oublie « au moins » / chez un installé, colis non publié = 0, premier colis
  pendant une série / chez un installé, « Nouveau » sur un nombre / chez un installé, eBay qui demande
  l'extension, Leboncoin coché sur le compte vu, prix Pro en dur, « Gratuit » retiré, lien CGV retiré).
  Sur `origin/main` (arbre `git archive`, audit copié dedans) : rouge (les règles n'existent pas — les
  mutations font la vraie preuve).
- **Banc `scripts/bancs/accueil-nouveaux.cjs`** (V compte neuf Vinted, N notifications, L Leboncoin seul,
  G langue, T /tarifs ; 390 tactile et 1512, clair et sombre), sur le build fusionné avec `origin/main` :
  **390 : 108 OK, 0 KO ; 1512 : 107 OK + G rejoué seul 5 OK** (un `page.goto` à 30 s sous une charge
  machine de 65). Sur un build SANS ce lot (le `dist` du dépôt principal, branche fusionnée dans main
  juste avant) : **22 KO** (390 clair). Un navigateur par scénario (un onglet tombé par manque de mémoire
  n'emporte pas les suivants). Captures regardées : bilan (clair, sombre), « chaque matin », premier colis
  (390 et 1512), question des notifications, carte Leboncoin, avis de langue, /tarifs (390 pleine page,
  1512 sombre), « Nouveau » dans la colonne et la barre.
- Audits gardés verts : `traduction`, `tdz`, `coherence`, `variables`, `csp`, `lancement`, `quoi-de-neuf`,
  `parcours-arrivee` (+ `--prouve` 17/17), `premieres-minutes`, `mode-exemple`, `plans-solo-pro`,
  `icones`, `boutons`, `violet`.

## Accompagné (Julien, 14 nov. : « il ne doit pas se sentir seul »)

- Le premier colis porte « Voir le geste en vidéo » à chaque étape (la vidéo « Imprimer tes bordereaux »
  du « ? » de Ventes, lot 49) ; la fin du bilan dit où est l'aide de chaque écran (« ? », en vidéo).
- Chaque étape du parcours sans Vinted dit SON geste exact (lien du site, ou le chemin Paramètres →
  Comptes eBay), « Pourquoi ? » et « Plus tard » comme le parcours Vinted.

## Restes / à décider par Julien

- Le bilan ne se montre qu'aux comptes qui ont commencé le parcours d'arrivée : Julien ne le verra
  qu'en le rejouant (Paramètres → Aide → « Revoir mon bilan en une minute »).
- Le premier colis se déclenche sur le bordereau imprimé SEUL ; un vendeur qui n'imprime qu'en série
  ne le voit pas tout seul (rejouable dans Paramètres → Aide).
- La page /tarifs dit « Gratuit pour l'instant » et « Le paiement n'est pas encore ouvert » : elles
  disparaîtront seules quand `ACCES_OFFERT` passera à `false` et quand `public/legal/editeur.js` sera
  rempli ; « Bientôt » sur Pro quand `PRO_OUVERT` passera à `true`.
- Geste de Julien : aucun. Pour voir : https://vrm.center/tarifs ; Paramètres → Aide → « Revoir mon
  bilan en une minute » et « Revoir le premier colis ».
