# 21 nov. 2026 — ux-reglages : Paramètres, E-mails, écrans vides, mouvements, « Nouveau », « Bien démarrer »

Branche `claude/ux-reglages` (partie de `claude/integration-21nov`, `claude/style-vintex` fusionné). Choix de Julien du
21 nov. n° 24, 25, 27, 32, 33, 34 ; audit design `docs/design/audit-2026-11-20.md` (branche `claude/audit-design`),
défauts 32–37, 42, 43, 45–47. Aucune modification de `vinted-sync-extension/`.

## Ce qui est fait

### 24. Paramètres
- Le premier écran était déjà la liste groupée (le DOM des bancs d'avant le 17 nov. montrait les 9 tuiles : c'est ce que
  l'audit avait capturé, `vrm_banc_dom_ancien`). Rien à changer sur la liste elle-même ; une seule recherche (celle de la page).
- « Enregistrement… » (`StatutSauvegardeReglages`, `src/ecrans/Reglages.jsx`) : n'est plus dit que pendant une écriture
  RÉELLE (`_syncInfo.etat === 'saving'` avec une révision en attente), puis « Enregistré » 1,5 s, puis rien. Un réglage
  qui attend l'écriture groupée ne dit rien. Les échecs (refus, panne, appareil) gardent leur phrase et « Réessayer ».
- UN réglage du mode sombre : « Apparence › Clair / Sombre / Comme l'iPhone » (« Comme l'appareil » hors iPhone), en
  `Groupe`/`Rangee` natifs à coche. « Le soir » n'est plus proposé (un appareil qui l'a choisi le garde, coché).
  L'interrupteur « Mode sombre » n'était déjà plus dans la liste v2 ; la valeur de la rangée vient de la même fonction.
- La carte « Protège ton compte VRM » (reproche récurrent, CLAUDE.md §2.10) n'est plus rendue : la rangée existante
  « Double vérification · Désactivée › » dit l'état. `audit-copie-annonces` M2 suit la décision.
- Sous-pages : un seul retour, « ‹ Paramètres » (ou « ‹ sa catégorie ») en texte accent (`Bouton` natif variante texte,
  chevron retourné), puis le grand titre (34) ; plus de rond gris ni de fil d'Ariane en 11 px.
  L'Apparence n'est plus un panneau « nu » (pas de carte dans une carte).

### 25. E-mails
- Trois segments : « À traiter · Colis · Tout » (`SEGMENTS_EMAILS`, `src/designV2/messagesV2.js`). « Ventes » et
  « Achats » passent dans la feuille « Plus de filtres » avec leur nombre (`FILTRES_EMAILS_PLUS`) ; choisis, le filtre se
  dit dans la ligne de filtre (« Ventes · Tout »). Ce qui « sert vraiment » : jugé sur la règle (Colis porte les codes et les
  bordereaux, À traiter les gestes) — pas de mesure d'usage disponible (aucune télémétrie des segments).
- Une seule recherche (celle de l'écran ; la coque n'en pose pas ici) ; rangées inchangées (logo/monogramme, sujet,
  ce que VRM a compris, date).

### 27. Écrans vides (trois états)
- `EmptyState` (App.jsx) rend le `Vide` NATIF : icône 40, une phrase, la raison, UN geste (les `data-acc-vide` restent).
- Ventes sans compte : plus une page blanche — « Aucune vente lue pour l'instant. » + « Relier un compte ».
- Achats sans compte ni achat : un `Vide` + la rangée « Achats hors plateforme · Ajouter » ; plus de Calculette,
  « Relier achats et ventes », bande de tirets, segmenté coupé ni « meilleures sources » (`achatsVidePur`).
- Annonces vides sans compte : le `Vide` porte « Relier un compte » (`videAction`, `src/natif/ecrans/Annonces.jsx`).
- Stock sans meuble : `Vide` « Aucun meuble pour l'instant. » + « Créer mon premier meuble » à la place de la carte
  « Comment marche le Stock » permanente (l'explication reste derrière le « ? »).
- Notifications (téléphone) : en cours = `Attente` (rangées), jamais « Lecture en cours… » ; vide = `Vide` natif.
- E-mails : déjà aux trois états natifs (vérifié au banc : en cours = squelette seul, pas su = phrase + Réessayer).
- Messages : la carte « Aucun compte Vinted lié » est désormais le `Vide` natif (même `EmptyState`).

### 32. Mouvements doux — `src/natif/mouvements.css` (importé par `src/natif/index.js`)
Toucher : `transform: scale(.97)` + fond, 100 ms ; feuille : 250 ms, `cubic-bezier(.22,1,.36,1)` (sans rebond) ;
segment : couleur 150 ms et contenu `[data-n-fondu]` en fondu 150 ms (part de 0,4 : lisible dès la 1re image ; posé sur la
liste des e-mails, clé = segment) ; toast : `n-monte` d'avant. Tout est sous `prefers-reduced-motion: no-preference`.

### 33. « Nouveau » après une mise en ligne — `FeuilleNouveauApp` (App.jsx), règles `feuilleNouveau` / `feuilleMontree` (`src/nouveautes.js`)
Une `Feuille` native, 3 lignes au plus (les nouveautés pas vues, les plus récentes), chacune ouvre son écran ; « Plus tard »
/ « Voir tout » (Paramètres → Aide → Quoi de neuf). Montrée UNE fois : ses nouveautés sont rangées dans
`vrm_nouveau_feuille` (SYNC_KEYS) dès l'ouverture. Rien au démarrage : elle attend le nuage, 2,5 s puis un moment calme,
et jamais devant Bienvenue, le parcours, la visite en bulles, une fiche ou une autre feuille (réessaie 4 s après).

### 34. « Bien démarrer 3/5 » en haut d'Aujourd'hui — `src/bienDemarrer/` (règle pure + dessin natif), `BienDemarrerApp`
Cinq étapes cochées par la PREUVE : extension (répond ici, ou un compte relié), compte Vinted relié (liste lue), première
lecture (dressing ou ventes lus non vides), un N° posé, le statut fiscal choisi. `Progression` + une `Rangee` par étape
(la rangée ouvre l'écran du geste, ne coche rien). Montrée seulement à un compte inscrit à partir du 21 nov., jamais au
propriétaire ni en exemple ; tout prouvé ⇒ partie ; « × » ⇒ `vrm_bien_demarrer` (SYNC_KEYS). Julien ne la voit pas.

## Preuves
- Banc `scripts/bancs/ux-reglages.cjs` (harnais `_ux-harnais.cjs` : base inventée, le DOM natif que voit Julien — sans
  `vrm_banc_dom_ancien` —, lectures et réponses /api TENUES pour l'état « en cours ») : **248 OK · 0 KO** (390 tactile et
  1512, clair et sombre). Sur le build d'avant (`claude/integration-21nov`, 390 clair) : **25 KO** — chaque point
  nouveau rouge (carte MFA, retour, Apparence, « Enregistré », 5 segments, Ventes blanche, Achats, Messages, Stock,
  Notifications, « Nouveau », « Bien démarrer », mouvements).
- `scripts/audit-ux-reglages.cjs` (règles pures) : 14 verts, `--prouve` 7/7 mutations rouges.
- audit-traduction, audit-quoi-de-neuf, audit-demarrage, audit-ecrans-restes, audit-style-vintex : verts.
  Rouges DÉJÀ sur `claude/style-vintex` (pas de ce lot) : audit-boutons-natifs A (AchatsTableau.jsx:30),
  audit-coque-parametres « une icône par ligne » (["search"]), audit-copie-annonces C4. Reglages.jsx repasse sous le
  plafond de `<button>` bruts (41).
- Trouvé en regardant les captures : le `Vide` dans la classe d'avant `vrm-empty-state` était écrasé en colonne de 64 px
  (dix feuilles d'avant la visent) ⇒ hôte `ux-vide-hote` ; à 1512, deux recherches sur Paramètres et E-mails (la barre
  du haut) ⇒ `ECRANS_RECHERCHE_PROPRE` ; Achats vide à 1512 = tableau en « Lecture en cours… » éternel ⇒ pas de tableau
  sans compte ; « ‹ Paramètres » passait sous la barre collante ⇒ `scroll-margin-top`. Le banc juge chacun.

## Ce qui reste
- Statistiques (onglet `dashboard`) d'un compte neuf : l'accueil `Onboarding` d'avant reste (pas de `Vide` dédié).
- La racine de Paramètres garde ses `RangeeTouchable` v2 (déjà liste iOS) : pas réécrite en `Rangee` native pour ne pas
  casser les bancs qui la désignent (`minimaliste`, `boutons-inventaire`).
- Le fondu de segment n'est posé que sur la liste des e-mails (`data-n-fondu`) ; les autres écrans peuvent l'adopter.
