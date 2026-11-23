# 20 nov. 2026 — « Bien démarrer », la démo, « Tout va bien ? » en points, et le Chrome Web Store 5.409.0

Branche `claude/demarrage-store` (depuis `origin/main` dd3336382). Pas de PR ni de fusion (consigne du lot).

## A. Démarrage des nouveaux vendeurs (Julien, 20 nov. : « OK »)

### 1. « Bien démarrer » — le parcours en pages poussées, style Paramètres (NATIF.md §1 bis)
- **Règle** : `src/parcoursNouveau/regle.js` — six pages `plateformes → extension → comptes → etiquetage →
  historique → pret` (`ETAPES_NOUVEAU`). Une position du 15 nov. (huit étapes) se relit : bienvenue ⇒
  plateformes, numeros ⇒ etiquetage, journee/abonnement ⇒ pret (`ANCIENNES_ETAPES`, aussi dans
  `api/_lib/parcours-comptes.js` pour l'onglet « Nouveaux comptes »). Nouveau : `installationIci` (le navigateur
  d'ici ⇒ boutique publiée / zip guidé / Orion / installer Orion / un autre navigateur / l'ordinateur — jamais
  un lien deviné, `LIENS_BOUTIQUES`), `etatExtensionDirect` (la règle de la page Extension prime ; un silence
  n'est jamais « fait »), `comptesCaptes`, `etatEtiquetage`.
- **Écran** : `src/parcoursNouveau/Demarrage.jsx` + `demarrage.css` (remplacent `ParcoursNouveau.jsx` « verre
  dépoli », supprimé). Sommaire (les cinq étapes et leur état, « Essayer avec des exemples ») ; chaque étape
  est une page poussée « ‹ Étapes », UN plein, « Passer cette étape » en texte, « Plus tard » en haut.
- **Branchement** : `src/App.jsx` `ParcoursNouveauApp` — preuves EN DIRECT, relues toutes les 5 s pendant
  qu'une page attend : extension = `etatNavigateur(faitsExtensionApp())` (src/extension/peutFaire.js, la page
  Extension) ; comptes = `fetchVintedAccounts` + `useComptesAutresSites` ; étiquetage = `EtiquetageReglage`
  (src/etiquetage/, les trois clés de toujours, aucun numéro touché) ; import = `lireImportDepart`.
  « Brancher à mon compte VRM » = `brancherExtensionApp`. Reprise : la position rangée (`vrm_parcours_nouveau`,
  synchronisée). Réouvrable : Paramètres → Aide → « Bien démarrer » (`vrm:parcours-nouveau` détail `sommaire`).
- Textes : `src/i18n/langues/*/demarrage.js` (cinq langues, `dm.*`), `pn.court.etiquetage|pret`.

### 2. La démo (le mode exemple existant, `src/modeExemple.js`)
- Entrée depuis le sommaire (« Essayer avec des exemples ») ; rien de neuf côté isolement (base et /api
  répondues sur place, aucune écriture).
- Mis à jour pour les écrans natifs : le **bandeau** est une barre natif (« sortir » en texte bleu, plus de
  second plein ; la languette du cadre se tait au téléphone) — `src/GuideDemarrage.jsx`, `src/guide-demarrage.css` ;
  les **données** (`src/exempleDonnees.js`) portent un prix d'achat inventé (≈ 45 % du prix) et un prix mini
  pour six annonces sur neuf : les colonnes « Prix mini » / « Acheté » et les Faits de la fiche ne sont plus vides.

### 3. « Tout va bien ? » qui dit quoi faire
- **Règle** : `src/toutVaBienPoints.js` (`pointsEcran`, `gestePoint`) — l'ordre : doublon de N° · extension de
  ce navigateur · panne prouvée · compte pas relu · extension en retard ailleurs · contrôle de nuit · données à
  corriger · pas su (« Revérifier ») · Vinted a changé une page (sans geste). Une panne ne redit pas son compte ;
  « pas su » ne compte pas parmi « à régler » et n'est jamais « Tout va bien ».
- **Écran** : `src/ToutVaBien.jsx` — une rangée résumé (« N choses à régler » / « Tout va bien », « Revérifier »),
  le groupe « À régler » (chaque rangée se touche : SON geste, en bleu à droite), puis « Détails » replié qui
  contient tout le technique d'avant (`DetailsToutVaBien`, inchangé).

### Preuves
- `node scripts/audit-demarrage.cjs` : 30 contrôles verts ; `--prouve` : 7/7 mutations rouges.
- `scripts/bancs/demarrage-parcours.cjs` (le nom `demarrage.cjs` est pris par le banc de l'écran de chargement) :
  **148 OK, 0 KO** (390 tactile Safari iPhone + Orion, 1512 Chrome ; parcours, reprise, extension simulée muette
  puis apparue en direct puis branchée, compte Vinted capté en direct, étiquetage écrit, import 50/120, démo
  entrée/sortie sans aucune requête vers la base ni /api, Tout va bien ?). ROUGE sur un `dist` d'avant (5 KO).
- Audits verts : traduction (45), tdz, variables, quoi-de-neuf, parcours-nouveau (44), paquets-boutiques.
- `scripts/bancs/tout-va-bien.cjs` ajusté (déplie « Détails », nouveaux libellés, `BANC_DIST`) : restent rouges
  « panne-* s'exécute » (clic sur la ligne de fraîcheur) et « Envoyer un rapport » < 44 px à 1512 sombre —
  **les mêmes sur le dist d'avant** (pas ce lot). `parcours-nouveau.cjs` : la partie P est passée dans le banc
  neuf (défaut `PARTIES=A,S`).
- Non vérifié : l'app réelle sur iPhone/Orion (simulé au banc seulement).

## B. Chrome Web Store, 5.409.0
- `docs/chrome-web-store/README.md` : en tête, le **pas à pas pour Julien** (compte développeur 5 $, e-mail
  vérifié, statut professionnel, « Nouvel élément », chaque texte et son fichier, captures, confidentialité,
  test, « Non répertoriée » puis Publique, délais, motifs de refus et réponses).
- `docs/boutiques/chrome-web-store.md`, `docs/chrome-web-store/fiche-en.md` : gestes 5.409 (publier une fiche,
  masquer/afficher, paliers, baisse par règle, vendue ailleurs ⇒ masquée, écran plein), `tabs` élargi,
  `vestiairecollective.com` devenu **autorisation d'hôte** (depuis la 5.385), `i.ebayimg.com`.
- `public/legal/extension.html` : mise à jour du 20 nov. (mêmes ajouts).
- Visuels refaits au style natif (`scripts/boutiques-visuels.cjs` : fond #F2F2F7, filet sans ombre, version lue
  du manifeste, carte du logo avec `vrm-ui.js`/`vrm-mots.js` comme le manifeste, écran **Stock** à la place
  d'Achats — plus de logo de transporteur ; Argent en exemple montre surtout « — »).
- Paquet Store (`zip-extension.cjs --store`) chargé dans Chromium : service worker démarré, 5.409.0, ENABLED,
  **0 erreur de manifeste, 0 avertissement d'installation, 0 erreur d'exécution**, popup sans erreur.
- Geste de Julien : suivre le pas à pas ; la fiche validée ⇒ donner l'adresse pour `LIENS_BOUTIQUES.chrome`.
