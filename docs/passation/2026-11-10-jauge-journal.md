# 10 nov. — Jauge du plafond d'actions et journal de l'extension (lot G) — extension 5.337.0

Branche `claude/jauge-journal` (depuis `origin/main`, `origin/main` refusionné avant la fin).
Validé par Julien (`2026-11-09-propositions.md`, propositions 2 et 3). Aucun geste nouveau, aucune
règle de plafond changée (50/h par compte, réserve 5, 45 pour l'app).

## Ce que Julien voit

1. **La jauge** « 12/50 cette heure · repart à 21 h 40 » (barre fine, repère à 45) là où partent
   des actions : feuille « Baisser le prix » (compte de l'onglet), Republier (compte ouvert),
   Favoris (compte choisi), Offres automatiques (allumées, compte de l'onglet). À 45 : ambre,
   « VRM attend · repart à … ». Rien publié pour ce compte : « — · pas encore dit par l'extension »,
   jamais « 0/50 ».
2. **Paramètres → Mon compte → « Ce que VRM a fait »** (l'écran du 8 nov., `JournalVrm` dans
   `src/ecrans/Reglages.jsx`) : en tête, « Cette heure », une rangée par compte Vinted avec sa
   jauge ; dessous, le journal existant reçoit les gestes notés par l'extension : « Prix baissé ·
   N°4 · 60 € → 54 € », « Offre acceptée (auto) · commande … · 52 € », « Offre refusée »,
   « Offre envoyée », « Message envoyé », « Annonce modifiée », chacun avec sa preuve « Noté par
   l'extension au moment du geste ». Nouveau filtre « Prix ». Filtre par compte : celui qui existait.

⚠️ Il existait DÉJÀ un journal « Ce que VRM a fait » (lot confiance, 8 nov., serveur
`api/_lib/securite-compte.js`). Pas de second écran : l'extension lui fournit une source de plus,
exactement comme le prévoyait `2026-11-08-confiance.md` (« À faire dans l'extension »).

## Les règles

- **Extension 5.337.0** (`background.js`)
  - `publierActions` : la ligne `actions_compte_{uid}_{navigateur}` porte aussi `max`, `reserve`, `v`.
  - `publierJaugeVisite(uid)` : à chaque visite du compte connecté (au plus toutes les 10 min,
    `vrmJaugePubliee`), ce Chrome publie SES heures de la dernière heure, même vides — dans la file
    du compteur (`unCompteurALaFois`). Sans elle, un compte sans action n'avait aucune ligne.
  - `noterJournal(uid, sorte, extra)` : Vinted seulement (uid numérique) ; entrée rebâtie champ par
    champ (`entreeJournal` : t, s, a, b, x numériques, p/de/vers prix, auto booléen) ; 30 jours,
    300 gestes ; `chrome.storage.local` (`vrmJournal`) puis ligne dédiée `journal_vrm_{uid}_{nav}`
    (un écrivain par ligne, jamais `main`). Une écriture ratée ne bloque aucun geste.
  - Points d'entrée (seulement un geste ACCEPTÉ) : `executerCommande` (baisse, modification,
    republication, brouillon, mise en ligne : issue `fait`), mise en ligne planifiée (`finir`),
    `executerPourApp` (accepter/refuser/faire une offre, répondre — sorte lue sur le CHEMIN ; favori
    `envoye`), `autoAccepterOffres` (auto, avec le prix de l'offre), `genererBordereau`.
- **Serveur** (`api/_lib/securite-compte.js`) : `evenementsExtension` — compte tiré de
  l'identifiant de la ligne, liste blanche ; seules les sortes qu'aucune autre ligne ne prouve
  entrent (offres, réponses, baisse, modification) — republication, favori, bordereau ont déjà leur
  source ; un geste du téléphone (`cmd_relais_*`) n'est pas compté deux fois (même type, compte,
  transaction, ±15 min). `lireJournal` lit `journal_vrm_*` projeté `id,e:data->e` ; pas lu ⇒
  « gestes de l'extension » dans « Pas pu lire ». `NON_JOURNALISE` offres/messages : seulement
  avant la 5.337. Aucune fonction `api/` ajoutée.
- **App** : règle pure `src/jaugeActions.js` (`jaugeDuCompte` : même somme que l'extension, lignes
  EXACTEMENT de ce compte — piège du LIKE —, < 1 h, ≤ 1 min dans le futur ; aucune ligne ou
  lecture ratée ⇒ `null`) ; `src/JaugeActions.jsx` (`JaugeActions`, `JaugesComptes`, relu toutes
  les minutes) ; `src/securiteCompte.js` (libellés, filtre « Prix », « (auto) », prix).
- **Versions** : `CODE_VERSION`, manifeste, `lbc-inject.js`/`lbc-relay.js`, `EXT_ATTENDUE` 5.337.0,
  `EXT_CAPACITES.jauge`/`journal`, `audit-coherence` (`publierJaugeVisite`, `noterJournal`), zips
  par `scripts/zip-extension.cjs` ; `audit-extension-zip` : numéro neuf.

## Preuves

- `node scripts/audit-jauge-journal.cjs --prouve` : 28 contrôles (vrai `background.js` dans un vm :
  compteur exact 6/50 lu sur la ligne publiée, autre Chrome additionné jusqu'au refus à 50, visite
  0/50, journal des seuls gestes acceptés, aucune donnée personnelle, liste blanche ; serveur ; règle
  de l'app) ; **15 mutations** toutes rouges ; **origin/main rouge** (17 contrôles, `git archive`).
- `scripts/bancs/jauge-journal.cjs` (390 tactile / 1512, clair / sombre, 12/50, « — », 45 ambre,
  lignes du journal) : vert ; captures regardées.
- `audit-comptes-securite` (4.22 : 7 sources), `audit-confiance`, `audit-coherence`,
  `audit-baisse-prix`, `audit-compteurs-concurrents`, `audit-recreer`, `audit-offres-auto`,
  `audit-argent-vinted`, variables, tdz, identite, icones, fonctions-api, extension-zip : verts.
- `scripts/bancs/baisse-prix.cjs` : vert (106) ; F1 accepte la version servie (5.336 ou plus, le message suit `EXT_ATTENDUE`). La jauge de la feuille s’appelle `.vrm-bp-plafond` (`.vrm-bp-jauge` est la barre de progression de la série).
  `audit-rouge-doublon` et `audit-violet` : rouges connus de `main` (transporteurs, inventaire).

## Reste / gestes de Julien

- Installer l'extension **5.337.0** dans chaque Chrome (⟳) et Orion : sans elle, la jauge dit « — »
  pour un compte sans action récente, et les offres/réponses faites à l'ordinateur ne sont pas notées.
