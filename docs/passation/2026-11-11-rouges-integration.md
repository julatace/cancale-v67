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
| `audits-exceptions.json` | `audit-chemin-json-guillemets` est vert : exception retirée (le lanceur le demandait). | — | — |

### Workflow `verifier.yml` — Bancs principaux

| banc | cause | (a)/(b) | preuve |
|---|---|---|---|
| `navigation-tache` J/I/A, `iphone-reprise` B3/B6/O | Lot AO (10 nov., Julien : « l'onglet Compta est trop flou, relie-le avec Stats ») : UNE entrée « Argent » (`compta`) dans « Gérer » remplace Statistiques et Compta ; plus de groupe « Argent ». | **(b)** groupes `Vendre·Gérer·Moi` (colonne `Gérer·Moi`), Gérer = À trancher, Stock, Achats, E-mails, Argent ; l'entrée `compta` s'appelle « Argent » (neuf) ; `dashboard` n'est plus une entrée ; 8 entrées dans « Plus » ; B6 passe sur CHAQUE entrée de « Plus ». | voir § Preuves. |
| `nouveau-vendeur` « ligne qui commence par · » | (1) Annonces / Ma journée : « · mois : … » est le texte **pour lecteur d'écran** (lot P, `.vrm-sr-seul`, boîte de 1 px rognée) : invisible. (2) Colis · À retirer : « · vérifié hier 10:40 » — le « · » (::before) passait VRAIMENT en tête de ligne. | (1) **(b)** le banc ne juge plus un texte rogné par `clip`/`clip-path` comme visible ; (2) **(a)** le séparateur se pose en `::after` de l'élément précédent (il reste en fin de ligne). | voir § Preuves. |
| `annonces-actions` A/K | portés par `claude/rouges-a` (abf6b426, « Baisser le prix » par paire) | — | voir § Preuves. |

## Preuves

(complété en fin de session)

## Ce qui reste

(complété en fin de session)
