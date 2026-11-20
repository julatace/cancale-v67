# 20 nov. soir — Plus de sélecteur de plateforme (branche `claude/sans-selecteur`)

Julien : « tu vas aussi enlever les onglets par plateforme, ça ne marche pas du tout ». (La version en pastilles,
`claude/selecteur-beau`, n'est PAS mise en ligne.)

- **Retiré de tous les onglets** (Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages) : le sélecteur global et la
  ligne « Tous les sites ». `src/natif/SelecteurSite.jsx`, `src/natif/selecteur-site.css`, `src/siteCourant.js` supprimés ;
  `vrm_site_courant` n'est plus lu ni synchronisé (sa valeur rangée reste, ignorée : personne ne reste coincé sur un site).
- **Tout est mélangé** : une tâche s'ouvre TOUJOURS sur son défaut de `siteDeTache` (Ventes et Messages : tous ; Annonces :
  la liste de tous les sites) ; un lien `&site=…` d'hier ne fige plus rien. Seule une SOUS-section propre à un site (eBay :
  Tableau, À traiter, Offres, Argent, Santé) garde son site — ses rangées sont sous la liste de Ventes quand eBay est relié ;
  l'écran d'un site ouvert exprès (« Tout l'écran Leboncoin », menu ⋯ d'Annonces) aussi.
- **Achats** : sous les achats Vinted (et TOUS les colis à retirer, déjà mêlés), les achats de chaque autre site relié, sous
  son nom et son logo (`data-achats-autre`).
- **Le logo du site sur chaque rangée** : `src/natif/LogoSite.jsx` (forme `public/brands/*.svg` en masque, posée par la
  feuille — la copie instantanée garde le logo ; couleurs du site, éclaircies en sombre). Ventes (rangées et volet),
  Annonces (devant le N°, un logo par site où l'article est en vente ; plus de « sur N sites »), Aujourd'hui (colis).
- **À l'ordinateur** : colonne « Site » étroite (logo seul, le nom au survol) dans les tableaux de Ventes et d'Annonces, et un
  filtre « Site » discret dans leur menu de filtres (pas de barre). Le téléphone n'a aucun filtre de site.
- **Aucun chiffre ne change** : Aujourd'hui, « À régler », Argent (Mois, questions, bénéfice) reviennent à « toutes ».

Preuves : `scripts/bancs/minimaliste.cjs --sites` réécrit (`vrm_site_courant = "leboncoin"` rangé ⇒ aucun sélecteur, sites
mêlés avec leurs logos, achats des autres sites) ; `audit-plateformes-logo` D2 réécrit ; copie-ecran, ventes-tableau,
chiffres-volume (origin/main contre la branche). Planches : scratchpad de la session, `sans-selecteur/sites/`.
