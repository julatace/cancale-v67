# Lot `vocabulaire-article` — « article » hors Sneakers, partout (11 nov. 2026, branche `claude/vocabulaire-article`)

## La demande
Suite du lot DJ2 (« Tu vends quoi ? », exemples) : partout où VRM disait « paire(s) » à un
vendeur qui ne vend pas (que) des sneakers, dire « article(s) », accords compris
(« 3 articles en ligne », « cet article », « l'article », « vendu » / « vendue »). Un
vendeur Sneakers seul garde « paire » MOT POUR MOT. Une seule fonction de vocabulaire ;
aucun nom de variable ni clé de données touché (`paires`, `vinted_paires_dorment`…).

## La règle (une source)
- `src/profilVendeur.js` : la table `MOTS` (entre les marques `<mots-article>`) porte
  chaque forme écrite EN ENTIER pour les deux vocabulaires (`nom`, `noms`, `Un`, `le`, `ce`,
  `Ce`, `de`, `sa`, `ta`, `la` (article ET pronom : « republie-la » / « republie-le »),
  `e` (accord : « vendu${e} »), `elle`/`lui`/`eux`, `Aucune`, `meme`, `autre`, `quelle(s)`,
  `toutes`, `Tes`, `mes`, `deNom(s)`, `bonne`, `ancienne`, `nouvelle`, `deCe`, `deLa`…).
  Jamais un mot remplacé dans une phrase ; jamais une condition « si sneakers » éparpillée.
- `motsArticle(vend)` (existait) ; nouveaux : `motsVendeur()` (le vendeur CONNECTÉ, pour
  tout module — l'app pose la source une fois : `poserSourceVend(() => vendActuel())`),
  `motArticle(n, { vend })` (« 3 articles »), `phraseVendeur(t)` + `PHRASES_ARTICLE` (les
  phrases d'aide écrites d'avance, leur version « article » écrite en entier).
- **Sans source posée** (audits, bancs d'une règle seule, serveur) ⇒ « sneakers » : les
  textes d'avant, mot pour mot — c'est ce qui garde tous les audits existants verts.
- Les tables de module (raisons, libellés, aide) deviennent des **getters** (`get pourquoi()`)
  ou des fonctions : évaluées à l'affichage, pas au chargement.

## Couvert
- **App** : Annonces (remises en ligne « même article ? », doublons, outils, vignettes,
  « + N° »), Ventes (récap, « l'article te revient », lot), Achats (achats en gros,
  fournisseurs, saisie), Stock (rangées, écartées, inventaire, inventaire annuel), Colis
  (préparer, scanner, mode emballage, tournée), Ma journée (cartes « vendus sur Vinted,
  encore sur eBay/Leboncoin/Vestiaire », prix à baisser, widgets, en ligne deux fois),
  Argent/Statistiques/Compta (Top marque €/article, bénéfice, marge par plateforme, bilan du
  mois, registre des achats), Republier, Leboncoin, eBay (gestion, recherche, alertes),
  Vestiaire, Messages (fils, Leboncoin), À trancher, offres auto, favoris auto, studio photo,
  recherche photo, fiche, Loupe, Organisation (atelier), « Tes données ».
- **Aide** : le « ? » de chaque écran (étapes + questions) passe par `phraseVendeur`.
- **Recherche / raccourcis** : groupe « Articles » de la recherche, ⌘K « La fiche de
  l'article » (mot-clé « article » ajouté).
- **Serveur** (`api/_lib/mots-vendeur.js`, importe la règle de l'app telle quelle) : ce que
  le vendeur vend se lit dans SA ligne `main` (`vrm_je_vends`, projection) ; automatique ⇒
  Sneakers pour le propriétaire (`VRM_OWNER_UID`), « article » sinon. **Ma semaine**
  (notification du cron : `MAIN_BILAN` projette `vrm_je_vends`), **offre reçue par e-mail**
  (« un article à ce titre a coûté… », projection ajoutée à la lecture existante),
  **erreurs eBay** (`api/ebay.js` pose le mot après session + abonnement, UNE petite
  projection par requête ; `ebay-relance.js` le lit), aperçus de notification (Paramètres).
- **Extension 5.347.0** : `vrm-mots.js` (copie de la table, chargé AVANT
  vinted-capture, vinted-infos, lbc.js, vc-depot.js, vrm-badge.js) ; le fond
  (`rafraichirVendExt`) relit `vrm_je_vends` avec les infos de page et à chaque
  synchronisation (au plus toutes les 6 h), demande « propriétaire ? » à
  `vrm.center/api/compte?mode=abonnement` (session, une fois par 24 h) seulement en
  automatique, range `vrm_vend_ext` dans `chrome.storage.local`. Textes : infos sous les
  annonces (« Numéro VRM de cet article »), encart d'achat (« Aucun article proche »), carte
  du logo, publication Leboncoin/Vestiaire, republication (taille, ancienne annonce, quota),
  offres auto, confirmation d'un geste. Rien de su ⇒ « paire » (textes d'avant).
  `CODE_VERSION`, manifeste, `EXT_ATTENDUE`, `CAPTEUR_VERSION`, `relaisVersion`, zips.

## Exceptions (liste FERMÉE, `audit-vocabulaire-article` S1)
Page publique `Accueil.jsx` (aucun vendeur connu) ; cartes Sneakers de `Bienvenue.jsx`
(remplacées hors Sneakers par `demoBienvenue`) ; la description du choix « Sneakers »
(Configuration, Réglages) ; `CONFIRMATIONS` d'annulerCommandes (inventaire d'audit, jamais
affiché) ; `DESCRIPTION_ORGANISATION` (gardée pour les audits ; l'app lit
`descriptionOrganisation()`) ; raison de diagnostic du cron de l'agent eBay ; alerte
technique de plantage (propriétaire seul) ; les tables d'aide (rendues par `phraseVendeur`) ;
l'étiquette « Paires » de `GROUPES_LOUPE` (remplacée dans la recherche) ; les listes de mots
vides de lecture d'un titre ; les replis `|| 'cette paire'` de l'extension si vrm-mots.js
manquait (B7 exige qu'il soit chargé avant).

## Preuves
- `npm run build` vert.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets, vendeur-generaliste, **vocabulaire-article** (nouveau).
- `audit-vocabulaire-article` : R (recopie), M (table), **E : 16 modules exécutés, code
  d'avant (git archive de la base) contre code d'après — Sneakers rend EXACTEMENT les
  textes d'avant ; « autre » ne dit plus « paire »**, V (serveur et extension = la règle de
  l'app, chaque réglage × propriétaire), X (vrm-mots.js et le VRAI background.js exécutés :
  « autre » ⇒ « article » rangé ; automatique + propriétaire lu chez vrm.center ⇒ « paire »),
  S (relevé @babel/parser de src/, api/, extension), B (branchements).
  Il a trouvé en route 4 modules qui appelaient `motsVendeur` sans l'importer (coutVente,
  dejaEnStock, tesDonnees, atelier : plantage à l'exécution que le build ne voit pas) et
  deux phrases oubliées (registre « En gros · N paires », recherche photo) — corrigés.
- `--prouve` : voir le rapport de fin de session (mutations attrapées).
- Banc `vendeur-generaliste` étendu : V5 (Lunettes, 11 écrans secondaires + aide « ? » de
  3 écrans, 390 et 1512) et V6 (Sneakers, contrôle positif « paire » toujours là).

## Limites dites
- Un écran déjà ouvert ne se redessine pas au moment où il répond « Tu vends quoi ? » :
  le mot change au prochain affichage de l'écran (les écrans qui s'abonnaient déjà —
  `useMotsArticle` — changent tout de suite).
- `operations/metier.js` exécuté par le serveur (Organisation, retirée du menu) dit
  « paire » (pas de vendeur connu là) ; dans l'app, « article ».
- Les exemples de titres des aperçus de notification (« Nike Air Max 90… ») ne sont pas de
  ce lot (exemples DJ2).

## Geste de Julien
Installer l'extension **5.347.0** (remplacer le dossier, ⟳ dans chaque Chrome). Pour lui
(Sneakers) rien ne change à l'écran.
