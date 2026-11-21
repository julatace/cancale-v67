# 11 nov. 2026 — Rouges d'intégration : remettre au vert les contrôles GitHub de `main`

Branche `claude/rouges-integration` (lot `rouges-integration`). Elle porte aussi les fusions de
`claude/rouges-a`, `claude/rouges-b`, `claude/audits-rouges` et quatre tests déjà réparés par la
session principale (plateformes-affichage, orion-base-validee, orion-garde-regression,
inscription-parcours). Pas de PR ni de merge dans `main` : la session principale intègre.

Règle suivie pour chaque rouge : **(a)** l'app a un vrai défaut ⇒ l'app est corrigée ;
**(b)** le contrôle jugeait une forme ancienne après un changement VOULU par Julien ⇒ le contrôle
est porté sur la nouvelle forme, même règle, et on prouve qu'il rougit encore (mutation).
Aucun contrôle supprimé, aucun affaibli.

## Les rouges, un par un

### Workflow `reprise-chantiers.yml` (job `ecrans`)

| banc | cause | (a)/(b) | preuve |
|---|---|---|---|
| `offres-objectif` « une barre FINE, dans la carte » | La barre d'objectif (`button.vrm-fu-objectif`, `width: 100%` + `all: unset`) dans la carte en grille dont les enfants ont 20 px de marge : elle débordait de **20 px** à droite (« 4 su… » coupé, capture 390). | **(a)** `src/styles-journee-instantanee.css` : largeur auto étirée (`justify-self/align-self: stretch`). | banc 100 verts / 0 ; mesure avant : bouton 34→396 px dans une carte 14→376. |
| `argent-mois` B (journal en tête, clic en timeout) | Ma journée v2 (9 nov., `2026-11-09-journee-v2.md`) a **fusionné** la carte « Semaine du … » dans la frise de la tête sombre (bouton « Semaine du … », même règle `journalSemaine`). La carte repliable n'existe plus. | **(b)** B porté : toucher « Semaine du … », la bonne semaine (`data-journal-semaine`), dans la tête, ventes / vendu / colis exacts, aucun bénéfice 0 inventé, 44 px, retour aux jours. Le repli (feature retirée par Julien) est remplacé par l'aller-retour jours ⇄ semaine. | banc 104 verts / 0 (l'exception connue « C 36 px » ne rougit plus). |
| `comptes-securite` C « Déconnecter envoie aussi {action:verifier} » | Lot H (10 nov.) : à l'ouverture, l'app demande une fois `POST /api/compte?mode=appareils {action:'verifier'}` (alerte « nouvel appareil », `src/appareilNouveau.js`). | **(b)** la règle se juge sur ce que le **clic** envoie (exactement `{session}`), et un contrôle neuf vérifie qu'avant le clic seule la vérification d'ouverture est partie. D : attente du fait (appel parti, session effacée) au lieu de 2,6 s fixes (rouges changeants sous charge 35). | banc 150 OK / 0. |
| `parcours-quotidien` → `navigation-plateformes` TimeoutError | Le 9 nov. Julien veut le choix des plateformes « en plein milieu de l'écran » : il est devenu l'étape « Où vends-tu ? » de **Ma configuration** (plein écran, `ConfigurationDepart.jsx`) ; la section `[data-choix-plateformes=demarrage]` de Ma journée n'est plus montée. Puis la feuille d'accueil d'un compte relié (8 nov., `CompteRelie.jsx`) couvrait Paramètres. | **(b)** le test passe par Ma configuration (eBay pas pré-coché, choix enregistré sur l'appareil ET envoyé au nuage, eBay seul ne demande pas Vinted…), le serveur fictif dit « pas propriétaire » (sinon « pas su » ⇒ rien n'est ouvert, exprès), la feuille d'accueil se ferme comme une feuille. | 52 contrôles réussis ; les 7 autres tests du job verts. |
| job `regles` | revérifié | — | vert. |

### Workflow `parcours-critiques.yml` (job `comptes-et-reception`)

| commande | cause | (a)/(b) | preuve |
|---|---|---|---|
| `audit-parcours-production.mjs` | `langueNavigateur` (corrigé par la session principale) | — | 227 / 0. |
| `orion-cors-reel.cjs` « vinted-connect : un gestionnaire connu » | L'extension 5.332 appelle `vrm.center/api/vinted-connect` (liaison serveur) ; le test ne connaissait que compte/relais/push. | **(b)**, en plus strict : la route est ajoutée au test, qui exécute son vrai gestionnaire et son préalable OPTIONS. | 17 verts ; mutation (`corsExtension` retiré de `api/vinted-connect.js`) ⇒ rouge « préalable 405 ». |
| `espace-emails-interface.cjs` | `EmailsSetting` appelait `useEstProprietaire()` sans jamais lire le résultat (une lecture réseau pour rien) ; le banc, qui monte la vraie fonction, ne la connaissait pas. | **(a)** ligne morte retirée de `src/ecrans/Reglages.jsx`. | 57 contrôles réussis. |
| `bordereau-qr-lecture.cjs`, `journal-email-reessai.cjs`, `orion-connexion.cjs` | verts avec l'environnement du job (`VRM_CHROMIUM_PATH`, `VRM_PDFJS_DIR` = pdfjs-dist 3.11.174, sommes vérifiées) | — | verts. |
| `outils-articles-vinted.test.mjs` (arrivé avec `main`) | Décision C10 (11 nov.) : `bilanAnnonce` d'Outils est FONDU dans `src/annoncesACompleter.js`. | **(b)** les mêmes règles jugées sur `manquesAnnonce` (manque LU dit, champ jamais lu = « pas su », titre/prix vides nommés). La comparaison brouillon ⇄ annonce (`prepare`) n'existe plus. | 25 contrôles ; mutation (photo pas lue comptée comme manque) ⇒ rouge. |
| `connexion-session.test.mjs` (arrivé avec `main`) | Lot DJ6 : le retour OAuth lit l'intention du clic (`lireIntentionOAuth`). | **(b)** le banc reçoit la VRAIE fonction (`src/auth/compteNeuf.js`), pas une copie. | 20 / 0. |
| le reste de la liste | — | — | verts. |

### Workflow `verifier.yml` — Audits (`node scripts/lancer-audits.cjs`, 457 audits)

| audit | cause | (a)/(b) | preuve |
|---|---|---|---|
| `audit-rouge-doublon` R3/R5 | `styles-a-trancher.css` et `styles-inventaire-annuel.css` : le rouge du **doublon de N°** écrit en dur (`#D70015`, `#FF6961`) au lieu du jeton ; Mondial Relay `#C8102E` (tuile de marque). | **(a)** les deux feuilles lisent `--vrm-doublon` (classe `-double`, `is-double`) ; **(b)** `#c8102e` nommé dans la liste des marques (comme DPD, DHL, Leboncoin). | vert ; mutation (un `#D70015` ajouté dans `transporteursVisuels.js`) ⇒ rouge R5. |
| `audit-violet` V1 | Les couleurs de marque FedEx / Relais Colis ont déménagé de `App.jsx` dans `src/transporteursVisuels.js` (« Transporteurs parfaits »). L'exception existait déjà pour App.jsx. | **(b)** la même exception, nommée ligne par ligne dans le nouveau fichier. | vert ; mutation (violet posé sur GLS) ⇒ rouge. |
| `audit-photos-vinted` | `ModeRelais.jsx` et `ScannerColis.jsx` posaient `<img src={c.photo}>` : une photo d'achat/de paire Vinted sans `PhotoVinted` (référent, secours, sonde). | **(a)** les deux composants reçoivent `Photo={PhotoVinted}` ; le QR du mode relais (`qrImage`, data:image ou adresse de QR du transporteur) nommé dans PERMIS avec sa raison. | vert. |
| `audit-relier-compte` R7 | 10 nov. (6f60bc8b, « plus de bandeaux e-mails doublons ») : le bandeau `ComptesARelierColis` est remplacé par une marque sur la carte du colis (`data-colis-sans-email`). | **(b)** R7 juge la marque : `relierBoiteDe(acc.vinted_user_id)`, `uidsSansEmail` seulement si la liste est un tableau (rien sur une lecture ratée). | 44 verts ; mutations (garde `Array.isArray` retirée ; mauvais identifiant passé) ⇒ rouges. |
| `audit-ma-semaine` | `ECRANS` du signalement : d'autres écrans ajoutés APRÈS `'semaine'` ; l'audit exigeait qu'il soit le dernier. | **(b)** la liste doit le CONTENIR. | 35 verts ; mutation (`'semaine'` retiré) ⇒ rouge. |
| `audit-plans-solo-pro` | Textes courts 5 : l'accueil dit « Solo : un compte vend par plateforme ». | **(b)** même sens accepté (`vend (sur chaque\|par) plateforme`). | 109 verts ; mutation (« vend partout ») ⇒ rouge. |
| `audit-coherence`, `audit-preuve-vente` | clone superficiel ici (« historique illisible ») ; en CI `fetch-depth: 0`. | — | pas un défaut de l'app ; à juger en CI. |
| `audit-colis-envoi` B « la barre dépend de l'onglet » | lot DJ3 (Colis rangés à leur place) | — | **laissé à DJ3**. |
| `audit-inventaire-annuel` E6 (après ma correction du doublon) | le sélecteur devait garder « doublon » | **(a)** `b.is-double[data-ia-ton="doublon"]` : le jeton ET le nom | 37 verts. |
| `audit-rouge-doublon` R5 (arrivé avec `main` : centre d'aide) | `aide-ecran.css` : la case « N° en double » de l'animation en `#FF3B30` en dur | **(a)** classe `vrm-aa-double`, jeton `--vrm-doublon` | vert ; `audit-centre-aide` 27 verts. |
| `audits-exceptions.json` | `audit-chemin-json-guillemets` est vert : exception retirée (le lanceur le demandait). | — | — |

### Workflow `verifier.yml` — Bancs principaux

| banc | cause | (a)/(b) | preuve |
|---|---|---|---|
| `navigation-tache` J/I/A, `iphone-reprise` B3/B6/O | Lot AO (10 nov., Julien : « l'onglet Compta est trop flou, relie-le avec Stats ») : UNE entrée « Argent » (`compta`) dans « Gérer » remplace Statistiques et Compta ; plus de groupe « Argent ». | **(b)** groupes `Vendre·Gérer·Moi` (colonne `Gérer·Moi`), Gérer = À trancher, Stock, Achats, E-mails, Argent ; l'entrée `compta` s'appelle « Argent » (neuf) ; `dashboard` n'est plus une entrée ; 8 entrées dans « Plus » ; B6 passe sur CHAQUE entrée de « Plus ». | voir § Preuves. |
| `navigation-tache` A/I/J, `iphone-reprise` B3/B6, `navigation-plateformes` (arrivés avec `main`) | Lot DJ6 (Julien : « Paramètres caché derrière le profil ») : `settings` n'est plus une entrée ; la carte du compte (colonne) et la photo (en-tête du téléphone) ouvrent le menu du profil, Paramètres en tête. | **(b)** Paramètres absent des entrées ET la carte du profil présente, au pied de la colonne, visible à 900 px ; au téléphone, la photo dans l'en-tête ; 7 entrées dans « Plus ». | voir § Preuves. |
| `nouveau-vendeur` « ligne qui commence par · » | (1) Annonces / Ma journée : « · mois : … » est le texte **pour lecteur d'écran** (lot P, `.vrm-sr-seul`, boîte de 1 px rognée) : invisible. (2) Colis · À retirer : « · vérifié hier 10:40 » — le « · » (::before) passait VRAIMENT en tête de ligne. | (1) **(b)** le banc ne juge plus un texte rogné par `clip`/`clip-path` comme visible ; (2) **(a)** le séparateur se pose en `::after` de l'élément précédent (il reste en fin de ligne). | voir § Preuves. |
| `annonces-actions` A/K | portés par `claude/rouges-a` (abf6b426, « Baisser le prix » par paire) | — | voir § Preuves. |

## Garde réseau des bancs (demande du coordinateur, 11 nov.)

Constat (journaux d'authentification de la PRODUCTION, 11:45 → 11:57) : toutes les ~7 s, depuis des
runners GitHub Actions, des `GET /auth/v1/user` avec un jeton de banc, des `POST /token` refresh
invalides, des `GET /auth/v1/settings`. Des bancs laissaient sortir des requêtes : une route
`/^https?:\/\/(?!localhost)/ → r.continue()` pour tout sauf les images (abonnement-propre,
raccourcis-siri, confidentialite… ~280 fichiers ont un `r.continue()`), ou aucune route `/auth/v1/`.

**`scripts/bancs/_garde-reseau.cjs`**, posé sur `playwright` (chromium, webkit, firefox ; `launch`,
`launchPersistentContext`) :
1. la production ne se résout plus (Chromium `--host-resolver-rules` : `*.supabase.co`, `*.supabase.in`,
   `vrm.center` ⇒ introuvables ; un banc qui pose SES règles, comme `session.cjs` qui envoie ces noms vers
   son serveur local, les garde) et le contexte refuse ces hôtes (`route` → abort) ;
2. toute réponse venue du RÉSEAU (adresse de serveur connue) d'un hôte non local, et toute tentative vers la
   production qui a échoué AU RÉSEAU (nom non résolu, proxy, connexion), est notée ; un `route.fulfill` ou un
   `route.abort()` du banc ne sort pas, il ne compte pas ;
3. à la fin du processus, une note ⇒ « ❌ garde réseau : … » et **code 1** : le banc est rouge.
Il n'existe pas d'interrupteur pour la retirer (`BANC_GARDE_TRACE=1` ne fait que dire la page et le type).

Chargée partout : `_porte-banc.cjs` la requiert ; `lancer-bancs.cjs` et `lancer-audits.cjs` l'ajoutent à
`NODE_OPTIONS` de chaque enfant (bancs et audits de `verifier.yml`, WebKit compris) ; `reprise-chantiers.yml`
(job `ecrans`) et `parcours-critiques.yml` (job `comptes-et-reception`) la posent dans `NODE_OPTIONS`.

**Preuve** : `scripts/tests/garde-reseau.cjs` (lancé dans `comptes-et-reception`) — un mini-banc qui ne
joint que ce qu'il sert reste vert (code 0) ; tenter la production (`/auth/v1/settings`), y aller par
`route.continue()` (le motif des bancs fautifs), ou recevoir une réponse d'Internet ⇒ « ❌ garde réseau »,
code 1 (4/4). Sur la machine : 24 bancs et 470 audits passés sous la garde (voir Preuves).
Premier passage : 3 faux rouges (`confidentialite`, `session-reveil`, `comptes-securite`) venaient d'un
`route.abort()` du banc ou d'une requête coupée à la fermeture ; corrigé (seuls les échecs AU RÉSEAU comptent),
les trois sont verts sous la garde.

## Preuves

- `npm run build` vert.
- `node scripts/lancer-audits.cjs` (sous la garde réseau, après la fusion de `main`) : **470 audits, 466 verts** ;
  restent `audit-coherence` et `audit-preuve-vente` (« historique illisible » : le clone de la machine est
  superficiel ; en CI `fetch-depth: 0`, verts sur les runs précédents) et `audit-colis-envoi` (lot DJ3) ;
  `audit-rouge-doublon` corrigé ensuite (centre d'aide) ⇒ vert. Audits du socle (variables, tdz, identite,
  icones, textes-courts, fonctions-api, secrets) verts.
- Bancs (sous la garde réseau, après la fusion) : nouveau-vendeur, garde-ecrans, ventes-e2,
  journee-coherence, morceau-perime, statut-colis, colis-retirer-propre, annonces-actions, argent-mois,
  chiffres-coherents, retraits-suivi, offres-objectif, achats-sourcing, comptes-securite, bureau-chargement,
  parcours-quotidien, bordereau-vestiaire-ouverture, recuperation-auth, recuperation-retour,
  confidentialite, session-reveil, connexion-claire : **OK** ; navigation-tache et iphone-reprise : OK après
  le portage DJ6 (voir dernière ligne). Tests d'interface du job `parcours-quotidien` (8) et de
  `comptes-et-reception` : verts ; `audit-parcours-production.mjs` 228 / 0 ; job `regles` vert.
- Mutations (copie de l'arbre, une construction mutée) : barre `width: 100%` ⇒ offres-objectif rouge ;
  semaine du journal décalée d'une semaine ⇒ argent-mois B rouge (semaine du 9 nov., 0 vente) ;
  « Déconnecter » qui envoie `{session, tous:true}` ⇒ comptes-securite C rouge ; eBay pré-coché dans Ma
  configuration ⇒ navigation-plateformes rouge ; entrée « Argent » renommée « Compta » ⇒ navigation-tache
  rouge. Audits : chaque portage rougi par sa mutation (voir les tableaux). Garde réseau : 4/4.
- Captures regardées : carte « Ventes » avec objectif à 390 clair et 1512 sombre (« 4 sur 4 » entier, la barre
  dans la carte) ; Ma journée à 390 sombre, « Semaine du 2 nov. » touchée (90 €, 2 ventes, 2 colis).
- Exceptions retirées de `scripts/audits-exceptions.json` (le lanceur le demandait) : audit
  `chemin-json-guillemets`, bancs `argent-mois` et `annonces-actions` (verts).

## Ce qui reste

- `audit-colis-envoi` B « la barre ne dépend pas de l'onglet » : lot DJ3 (Colis rangés à leur place), pas touché.
- `abonnement-propre` et `raccourcis-siri` (hors des workflows de ce lot) sont rouges ici (clics en délai,
  formulaire Siri hors vue) : pas dus à la garde, pas examinés.
- La garde peut rougir en CI un banc que je n'ai pas lancé (~480 bancs, 24 lancés ici) s'il laisse sortir une
  requête : c'est voulu — le corriger en servant la requête (`route.fulfill`), jamais en retirant la garde.
- Geste de Julien : aucun.
