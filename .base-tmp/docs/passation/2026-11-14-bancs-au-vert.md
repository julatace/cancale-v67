# 14 nov. — Bancs au vert (branche `claude/bancs-au-vert`)

Mission : remettre au vert les bancs de rendu connus rouges, **sans les affaiblir**. Pour chaque
rouge : défaut de l'app (alors l'app est corrigée) ou banc qui mesure une fiction (alors le banc sert
la vraie forme et juge la règle). Aucun contrôle retiré ; quand un contrôle accepte autre chose,
une mutation prouve qu'il échoue encore quand on casse la règle.

Méthode : `npm run build`, un banc à la fois (`free -m` ≥ 3000, `BANC_PORT` aléatoire,
`NODE_OPTIONS=--require scripts/bancs/_porte-banc.cjs`), capture regardée, cause, correction,
relance. Après `git merge origin/main` (avec la passe design 2) : rebuild et relance de chaque banc
ci-dessous — tous verts.

## Défauts de l'app trouvés par les bancs (corrigés)

| défaut | où | correction | preuve |
|---|---|---|---|
| ⌘K « Imprimer les bordereaux du jour » n'ouvrait **jamais** la feuille « Tout imprimer » quand Ventes se remontait : la demande `_pendingBordPrint` était effacée AVANT le minuteur de 400 ms, et un nouveau rendu (ventes relues) annulait le minuteur — demande perdue. | `src/App.jsx` (Comptabilite, effets « Tout imprimer ») | la demande n'est retirée qu'à l'ouverture (dans le minuteur, via `ouvrirLotRef`) ; elle attend la liste lue en entier (`labelsPrets`, `sales.items`, e-mails — la condition de `vrm_colis_prets`) | `annuler-commandes` E1 rouge avant (sonde : effet à 2887 ms puis 2953 ms qui annule), vert après ; `tout-imprimer`, `tout-imprimer-garde` verts |
| Sur Organisation (sous-écran de Paramètres), le rail ne disait plus où l'on est : la carte du profil (lot DJ6) ne s'allumait que pour `tab === 'settings'`, l'ancienne roue suivait `BAR_GROUPE`. | `src/App.jsx` (`carteCompte`) | `aria-current` sur `(BAR_GROUPE[tab] \|\| tab) === 'settings'` | `compta-simple` C rouge avant, vert après ; `audit-profil-oauth` 41/0 |
| La facturation électronique disait « Régime fiscal pas renseigné / inconnu » (le mot écarté par `src/libelles.js`, une notion = un mot : « Statut »). | `src/facturationElectronique.js` | `${L.statut} pas renseigné.` / `${L.statut} inconnu.` (import de `L`) | `compta-stats-coherence` C2 rouge avant, vert après ; `audit-composants` vert |

## Bancs : cause, correction, avant → après

| banc | cause | correction | avant → après |
|---|---|---|---|
| `carte-stats` | banc : (1) Ma journée v2 (9 nov.) porte le « vendu aujourd'hui » dans la FRISE (`data-fu-vendu-jour`), la carte ne le redit pas ; (2) Compta = Argent, la carte vit dans le repli « Ton bénéfice » ; (3) 44 px exigé à la souris (design système : 44 doigt / 36 souris) ; (4) le texte lecteur d'écran (`.vrm-sr-seul`, rogné exprès) compté « rogné » | lit la frise + nouveau contrôle « écrit UNE fois » ; ouvre « Ton bénéfice » ; seuil par pointeur ; `.vrm-sr-seul` exclu | 88/8 → 117/0 ; mutations (grand rendu deux fois, contrôles à 30 px, libellé rogné) ⇒ 4 rouges |
| `journee-mieux` | banc (déjà rouge avant le lot 7, `e204053c`) : le faux PostgREST ne servait ni `id=in.(…)` ni `meta` : la scène (5 à retirer, 8 à vérifier) n'arrivait pas ; J comptait les DATES de la frise des sept jours | base servie par `_minipgrest` (+ `meta`, `owner=eq.` ignoré) ; `[data-fu-semaine]` hors du compte des redites | 154/18 → 215/0 ; mutation (noms au lieu de « + N à vérifier ») ⇒ J et K rouges |
| `retirer-scene-julien` | banc : le QR jugé après une boucle de 10 s qui lisait un QR encore « en chargement » | attente sur la condition (`data-colis-qr-etat` ≠ `charge`, image complète, ou « QR pas chargé ») | 51/1 (1512 sombre) → 52/0 ; mutation (QR qui ne répond jamais) ⇒ 8 rouges |
| `recherche-universelle` | — | — | vert |
| `colis-ventes-instantanes` | banc : depuis le lot DJ3 (11 nov.), `?tab=cat_bord` ouvre Ventes ; l'écran Colis (et son instantané) n'existe plus — les passes Colis attendaient sa carte | Colis jugé dans sa forme d'aujourd'hui (C) : Ventes ouvert, « À expédier » porte les 3 colis dans l'ordre, une seule carte, un instantané de Colis rangé avant JAMAIS montré (observateur posé avant le chargement) ; Ventes garde A·I·U·V·S | 32 KO (+ dépassement de temps) → 0 ; mutation (instantané de Colis rendu sur Ventes) ⇒ rouge |
| `achats-retraits` | — | — | vert (84/0) |
| `inventaire` | banc : (1) dressings lus par famille (`id=in.(…)`, 8 nov.) et un 500 posé sur toute adresse nommant 222 ⇒ tout le lot raté, les deux comptes « pas lus » ; (2) abonnement pas servi ; (3) la porte de banc donnait un jeton qui n'était pas un JWT ⇒ la porte hors ligne (`subDuJeton`) ne pouvait jamais s'ouvrir ; (4) lot 45 : le Stock hors réseau a son bouton et sa ligne d'état, « articles » ou « paires » | `in.(…)` servi, 222 jamais lu (500 seulement sur sa lecture seule) ; abonnement comme la route ; **`_porte-banc.cjs` : jeton à trois morceaux, `sub` = uid** (remplacement `/g`) ; `data-stock-inventaire-ouvrir`, `data-stock-hl-etat`, `(paires\|articles)` | 47 KO → 0 (4 vues) ; mutation (compte pas lu compté lu) ⇒ 3 rouges |
| `facturx` | banc : projections mixtes rendues en ligne entière, `in.(…)` vide (récap = eBay seul, 60 €) ; la carte vit dans le segment « Factures » ; « Statut » | `_minipgrest` ; `allerSegment('factures')` ; raison lue `statut` (jamais « régime fiscal ») | 6 KO → 0 |
| `argent-mois` | — | — | vert (104/0) |
| `compta-simple` | app (rail, ci-dessus) + banc : la phrase « ne vaut que pour cette carte » n'est plus dans le repli (2 nov.), « date-la dans « … » » (texte du 11 nov.) | la règle mesurée : « Année » sur Vendu et reçu ne touche pas `data-benef-periode` ; regex du texte d'aujourd'hui ; rail lu sur la carte du profil | 7 → 0 ; mutation (le bénéfice suit la période du CA) ⇒ 2 rouges |
| `compta-stats-coherence` | app (« Régime fiscal », ci-dessus) + banc : versements posés « il y a 6 et 4 jours » ⇒ après le 6 du mois, l'échéance FINIE (mois passé) n'en portait aucun : prévision « pas su » (§5) — le banc mesurait le calendrier | versements datés dans le mois passé à midi UTC ; « 1 vente sans date » | 18 → 0 (4 vues) |
| `parcours-quotidien` | — | — | vert (6 vues) |
| `comptes-et-reception` (job CI, 33 commandes) | banc : `connexion-actions-interface` ne servait pas ce que l'écran de connexion lit depuis le lot 54 (`PARRAIN_DU_LIEN`, `codeParrainGarde`, `lireApercuParrain`) ; `bordereau-qr-lecture` demande `VRM_PDFJS_DIR` (pdfjs 3.11.174, sha256 vérifiés, pris par `npm pack` ici, le CDN étant fermé) | stubs à la forme réelle (aucun code de parrainage), vraie `lireApercuParrain` | 2 rouges → 33/33 |
| `colis` | banc : `in.(…)` pas servi ; lecture faite au squelette (`data-attente="attente"`, la publication arrive avant) ; « N bordereaux à imprimer » (audit du 6 nov.) ; bandeau frais sur deux lignes | `in.(…)` ; attente « publié ET écran sorti de l'attente » ; regex ; bandeau lu par `data-colis-bordereau-frais` | 4 → 0 ; mutation (le bandeau nomme l'autre compte) ⇒ 2 rouges |
| `annuler-commandes` | app (⌘K imprimer, ci-dessus) + banc : boîtes et dressings absents ⇒ l'écran d'arrivée relisait par le relais (`POST /api/vinted-proxy`), pris pour un envoi du geste (K2) ; E1 exigeait une confirmation à « Imprimer » retirée par Julien le 11 nov. (DJ3 : la feuille est la confirmation) ; un Échap superflu annulait la navigation suivante ; focus K5 lu à l'instant | lignes `harvest_*_inbox`/`_listings` servies ; E1 : feuille ouverte sans rien lire, fermée sans « Imprimer » ⇒ rien lu ni marqué ; Échap retiré ; focus attendu (borné) | 6 → 0 (79/0) |

## Restes

- `audit-coque-parametres` : 31/32 sur `origin/main` comme ici (« une icône par ligne » : `mail` deux fois dans Réglages) — pas de ce lot.
- `compta-simple` a montré une fois `net::ERR_ABORTED` sur `?tab=settings` (non reproduit) : même mécanisme qu'`annuler-commandes` (un retour d'historique de l'app pendant `goto`).
- `colis-ventes-instantanes` entier dépasse 8 min : le lancer par vue (`CVI_SEUL=390-light`…).
- L'instantané de Colis (`vrm_colis_instantane:*`, `ColisInstantane`) n'est plus jamais rangé ni montré depuis le lot DJ3 : code mort à retirer ou à rebrancher sur « À expédier » (décision produit).
- Textes en dur vus en passant (pas de ce lot) : le bandeau « Bordereau téléchargé il y a N min », les raisons de `src/facturationElectronique.js` — hors `tr()`.

Gestes de Julien : aucun.
