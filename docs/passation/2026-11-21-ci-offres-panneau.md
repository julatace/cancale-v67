# 21 nov. — « Parcours critiques VRM » rouge sur main : les tests d'offre reportés sur le panneau

Branche `claude/ci-offres-panneau`. Geste de Julien : **aucun** (installer l'extension quand l'intégrateur sert
la 5.410.9, comme d'habitude).

## Ce qui était rouge

Le workflow `.github/workflows/parcours-critiques.yml` (et donc les e-mails « Run failed ») tombait sur main
depuis le 18 nov. au soir (dernier vert : 18 nov. 06:57), au pas `node scripts/audit-parcours-production.mjs`,
groupe « Comptes, emails, synchronisation et favoris » :

- `scripts/tests/actions-offres-vinted.test.mjs` extrayait `  const actionOffre = async` de `src/App.jsx` ;
- `scripts/tests/conversation-relecture.test.mjs` extrayait `  const sendReply = async () => {`.

Les deux gestes ont été RETIRÉS VOLONTAIREMENT de l'app au merge a12c5b769 (décision du 20 nov. : toute action de
plateforme se fait dans le panneau de l'extension, `docs/passation/2026-11-20-actions-extension.md` l. 67-68 ;
la carte d'offre porte `data-offre-panneau` et `BoutonExtension action="offres"`). Les tests ne pouvaient plus
rien lire : le groupe entier était rouge.

## Ce qui a changé

Aucun test supprimé : leurs garanties sont reportées sur le chemin qui existe.

**App** (`actions-offres-vinted` A1-A2) : aucune écriture d'offre vers Vinted ne part de `src/App.jsx` ni des
écrans découpés (`offer_requests`, `…/offers`, `actionOffre` interdits, commentaires retirés) ; la carte d'offre
ouvre le panneau avec le n° de CETTE conversation, et le panneau la choisit (`vrm-badge.js` : `page === 'messages'`
+ un seul id ⇒ `convChoisie`, rendu jugé par `scripts/bancs/grand-panneau.cjs` « lien carte d'offre »).

**Extension** (`offreCarte`, `repondreCarte` de `background.js`, exécutés par `scripts/_fond-vm.cjs`) — ce qui
manquait est codé (ext. **5.410.9**, zips NON régénérés : `public/` est exactement celui de main, l'intégrateur
régénère une fois) :
- `etatGesteVinted` : confirmé / refusé / incertain (la règle de `src/reponseVinted.js`) ; un HTTP 200 qui porte
  `code` ≠ 0 ne confirme rien (ni offre, ni réponse — `repondreCarte` lisait `r.json`, la porte rend `data` : un
  refus était dit « parti ») ; « rien n'est parti » (onglet hors Vinted, autre compte, pause : `rienParti`) n'est
  pas incertain ;
- issue incertaine (5xx, délai dépassé) ⇒ la conversation est bloquée 30 min, dit, ni second toucher ni autre
  geste ; le blocage est écrit dans `chrome.storage.local` AVANT le départ (un worker tué en vol le garde) ;
- double toucher pendant l'envoi ⇒ un seul départ (verrou pris sans attente entre test et prise) ;
- confirmé ⇒ attaché à compte:transaction:offre (`vrmOffresCarte`, 7 j) : l'offre ne repasse pas « à trancher »
  quand la relecture ne l'a pas encore vue ou rate, et le moteur automatique ne la retraite pas (`vrmOffresFaites`).

Tests : `actions-offres-vinted` B1-B7, `conversation-relecture` « un accusé de réponse n'est parti que si Vinted
l'a confirmé (panneau) ». Déjà jugé ailleurs (référencé dans l'en-tête du test) : bascule de compte pendant la file
(`audit-argent-vinted.cjs` V3), anti double-vente et plancher (`audit-extension-porte-app.cjs` G).

## Preuves

- `node scripts/audit-parcours-production.mjs` (avec et sans `NODE_OPTIONS=--require=scripts/bancs/_garde-reseau.cjs`) :
  9/9 groupes, 230+ tests verts.
- Sur l'arbre de main (`git archive origin/main`, tests copiés dedans) : A2 et B1-B7 rouges (A1 vert : c'est une
  garde contre le retour du geste, prouvée par mutation — `actionOffre` remis dans App.jsx ⇒ A1 rouge).
- 10 mutations de `background.js` (verrou, blocage avant départ, refus HTTP 200, `rienParti`, confirmée réaffichée,
  re-tranchable, clé sans compte, moteur non prévenu, incertain = refusé, réponse relue sur `json`) : 10/10 rouges.

## Les pas APRÈS l'audit (deuxième passe, sur demande de l'intégrateur : le workflow ENTIER vert)

GitHub s'arrête au premier pas rouge : l'audit masquait les suivants (le 19 nov., le run tombait déjà à
« récupération »). Rejoués un à un ici après `npm run build`, garde réseau posée, BANC_PORT libre, pdf.js 3.11.174
vérifié par `scripts/pdfjs-test.sha256` (pris au registre npm, le CDN est fermé ici) : **33/34 verts** ;
le seul rouge, `orion-paquet`, est attendu sur cette branche (background.js changé, zips de main gardés) et vert
sur l'arbre de main — il passe après la régénération de la 5.410.9 par l'intégrateur.

| pas | ce qui cassait | ce qui juge la garantie maintenant | mutation |
|---|---|---|---|
| `recuperation-auth`, `recuperation-pannes-interface` | la garde réseau pose `vrm_banc_dom_ancien` dans chaque page ; les tests comptaient tout `localStorage` | les clés écrites PAR LA PAGE (cette seule clé d'échafaudage écartée) | la page écrit une clé ⇒ rouge |
| `confidentialite` | `[data-reception-emails]` sous Réglages : la réception est partie (E-mails, Achats → En attente) | le cœur de l'app monté par AppCoeur : `#vrm-contenu[data-ecran="emails"]` (la copie instantanée n'a pas cet id) | la porte laisse passer sur « protection » ⇒ 4 rouges |
| `espace-emails-interface` | `EmailsSetting` utilise le relais `Bouton` d'App.jsx (refonte) : « Bouton is not defined », rien rendu | le même test, le relais servi (BoutonBase sans icônes) — aucune garantie touchée | — |
| `conversation-relecture-interface` | l'en-tête du fil porte l'article par identité (`paireDeConv`, `ficheDeConv`…) : non défini, rien rendu | le même test, ces helpers servis vides (il juge l'actualisation) | bouton d'actualisation non grisé pendant la lecture ⇒ rouge |
| `favoris-historique-interface`, `favoris-automatisation-interface` | `src/FavorisVinted.jsx` et `src/AutomatisationFavoris.jsx` retirés le 20 nov. (95ce6ea4d) | chaque garantie nomme le contrôle qui la juge sur le chemin d'aujourd'hui (panneau `panneau-favoris-tableau`, vrai background.js `audit-favoris-liste` / `-offres-irreprochable`, états `audit-favoris-ecran`, règles `audit-favoris-clair`, file serveur `favoris-*.test.mjs`) : `scripts/tests/_garanties-reportees.cjs` lance les juges et exige la ligne VERTE de chaque contrôle nommé. 42 portées ; 16 « retirées » (objet disparu avec l'écran : bouton « Vérifier un favori », feuille « Plus d'outils », rapport copiable, brouillon, événements de page, ancien Safari), chacune écrite avec sa raison | `cochablesApercu` laisse cocher vendus/contactés ⇒ 7 orphelines ; réponse perdue remise « en attente » dans la file ⇒ 12 orphelines |
| `messagerie` LIVE_ONLY / SEARCH_ONLY | Messages s'ouvre toujours sur le fil « Tous » (`FilsTous.jsx`, décision « sans sélecteur » du 20 nov.) : plus de `[data-messagerie]`, `#vrm-sel-compte`, « À répondre » | les mêmes garanties sur `FilsTous` par ses data-* : `data-fil` = `vinted:{compte}:{conv}` (identité), groupe du compte, `data-fil-num`, `data-fils-rien`, `data-msg-vue`, `data-nonlu`, `data-fil-at` ; live : la capture met à jour date et non-lu sans rechargement | N° par préfixe (N°70 ⇒ N°7), titre natif hors recherche, écoute `maj messages` coupée ⇒ chacun rouge |
| `bordereau-qr-lecture`, `tampon-bordereau` | il leur faut `VRM_PDFJS_DIR` (fourni par le workflow) | verts avec pdf.js 3.11.174 vérifié | — |

## « Reprise des chantiers VRM »

- **`regles` — corrigé** : `scripts/tests/orion-base-validee.py` approuve nommément les deux ajouts de la base
  commune 5.410.3 (`vrm-dressing.js` après `vrm-action.js` à la fin du bloc des infos Vinted ; `vrm-formulaire.js`
  membre, injecté par `executeScript`). Le job `regles` rejoué sur l'arbre de main avec ce fichier : 18/18 verts
  (`orion-garde-regression` compris). Mutation : un membre `intrus.js` dans le paquet ⇒ rouge.
- **`ecrans` — listés seulement** (écrans en refonte par d'autres sessions ; bancs non réécrits) :
  - `argent-mois` (16 rouges) : « À venir » de l'écran Argent ;
  - `offres-objectif` (12 rouges) : `[data-carte-stats="ventes"]` (carte de Ventes) et
    `[data-messagerie-site="ebay"] [data-ebay-questions]` introuvables ;
  - `achats-sourcing` : le menu « … » de la carte d'Achats ;
  - `comptes-securite` : la rangée de comptes `[data-compte-puces="vrm-sel-compte"]` (sélecteur retiré le 20 nov.) ;
  - `bureau-chargement` : `.vrm-toutes-bureau` (coque) ;
  - `parcours-quotidien` : `actions-visuelles-interface` attend `.vrm-b-indicateur` sur un lien occupé —
    `BoutonBase` (`href` + `occupe`) rend désormais le lien natif SANS roue : la preuve « une action en cours se
    voit » manque aussi dans l'app (pas seulement dans le test). À trancher par la session des boutons natifs
    (`.n-roue` ; en mouvement réduit natif.css la ralentit à 1,6 s au lieu de l'arrêter).

## Sauvegarde quotidienne de la base

Rouge : « Vérifier que les deux secrets sont posés » — secrets absents (geste de Julien dans les réglages GitHub).
