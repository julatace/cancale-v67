# 20 nov. 2026 — Le panneau de l'extension « comme Vintex » (ext. 5.410.0, branche `claude/panneau-vintex`)

Julien, 20 nov. : « pour l'extension, tu fais pareil que Vintex ». Puis : « toute action doit être faite dans
l'extension, on ne doit plus pouvoir faire d'action dans l'app ».

## Ce qui change dans la 5.410.0 (une seule version, zips NON régénérés)

- **Mise en page** (`vrm-badge.js`, `vxHtml`) : le grand panneau occupe l'écran (12 px de marge), barre latérale fixe
  232 px (Général : Accueil ; le site : Articles · Commandes · Messagerie · Favoris · Notifications · Automatisations ;
  Paramètres en bas), réductible aux icônes (64 px, gardé dans `vrmPanneauReduit`) ; en-tête « Page · pastille du
  compte » + « Mis à jour il y a … ⟳ » (l'heure de la lecture de CE que la page montre, « Mettre à jour » sinon).
  Téléphone / Orion : la barre devient une rangée défilante en bas, les tableaux s'empilent (libellé devant chaque valeur).
- **Accueil** (`accueilHtml`) : compte de l'onglet et sa liaison à VRM, compte VRM et version, tuiles du jour (ventes
  du jour, à expédier en ambre, non lus, en vente — « — » si pas su), jauge, ce qui a été capté APRÈS le marqueur « vu ».
- **Articles** (`annoncesGrandHtml`) : « Choisir une action ▾ » (gestes par site), recherche, « Statut ▾ » à cases et
  compteurs (tous statuts cochés par défaut, comme Vintex), « N article(s) », liste/grille, « Colonnes ▾ » ; tableau :
  case, vignette 48, N° en plaque + titre, Prix, En ligne, Vues, Favoris, Statut en étiquette douce (brouillon ambre),
  ⋯ ; tri par en-tête.
- **Commandes** (`ventesGrandHtml`) : même barre, statut Vinted sous le titre (`statutVinted` lu par `carteListes`),
  transporteur avec SON logo (`transporteurCle`, logos recopiés de `src/transporteursVisuels.js` par
  `scripts/recopier-logos-extension.cjs`, `--verifie`), état en étiquette (« À expédier » ambre).
- **Messagerie** : avatar (photo Vinted ou initiale), pseudo, « il y a … · texte », vignette de l'article ; volet vide dessiné.
- **Automatisations** : deux volets — la liste (Activé / Désactivé) et le détail MESSAGES / CIBLAGE / DÉLAIS (textes
  lus : `automatisationsCarte.favoris.textes`), paliers avec aperçu 100 → … → plancher ; « Démarrer » (favoris) ouvre
  le parcours du panneau ; « Modifier dans VRM » reste pour les réglages.
- **Lien profond** (`lireLienPanneau`) : `https://www.vinted.fr/?vrm=panneau&page=<…>&ids=<…>&action=<…>` (pareil sur
  leboncoin.fr / vestiairecollective.com) ouvre le panneau à la page, sélection cochée, action PRÉ-choisie ;
  masquer/afficher arrivent sur la barre de confirmation ; RIEN ne part sans son toucher ; paramètres retirés de l'adresse.
  Contrat côté app : `src/ouvrirPanneau.js` (`lienPanneau({site, page, ids, action})`), tenu par
  `scripts/audit-lien-panneau.cjs` (exécute les deux côtés, 9 mutations rouges).
- Capacités : `panneauvintex` (`vxHtml`), `lienpanneau` (`lireLienPanneau`) à 5.410.0 ; Quoi de neuf `panneau-vintex`.
- Garde-fous inchangés (`audit-actions-gardees` vert) : aucune nouvelle écriture dans `background.js`.

## Ce qui n'est PAS encore fait (dit honnêtement)

- L'app n'utilise pas encore `lienPanneau` : ses boutons d'action (baisser, masquer, republier, favoris, publier…)
  agissent toujours comme avant. Prochain lot : remplacer chaque geste de l'app sur un site par
  `window.open(lienPanneau(...))`, écran par écran, avec un audit qui interdit un geste direct.
- Écrire les réglages des automatisations DEPUIS le panneau : pas fait. Chemin sûr retenu pour la suite : une ligne
  dédiée `cmd_reglages_{uid}` posée par l'extension (jamais `main`), lue par l'app au chargement et appliquée par elle
  (comme `cmd_prix_*`). Aujourd'hui : « Modifier dans VRM ».
- « Changer le prix » dans le panneau ouvre encore VRM pour la saisie du montant (le dépôt `cmd_prix_*` existe côté
  extension, l'interface de saisie dans le panneau reste à faire).

## Preuves

- Bancs : `scripts/bancs/grand-panneau.cjs` (251 contrôles : 1512 clair/sombre, 1280, 390 clair/sombre, Orion émulé,
  base vide, 4 liens profonds), `grand-panneau-sites.cjs` (80 : Leboncoin, Vestiaire, 1512/390, clair/sombre).
- Audits verts : coherence, traduction, tdz, variables, extension-feuille, actions-gardees, quoi-de-neuf,
  carte-listes, panneau-carte, lien-panneau (--mutation), recopier-logos --verifie ; build OK.
- Planches côte à côte avec les captures Vintex : hors dépôt (bloc-notes de la session).
