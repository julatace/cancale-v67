# 20 nov. soir — Le sélecteur de plateforme en pastilles (branche `claude/selecteur-beau`)

Julien (train f57375a1c en prod) : « c'est de la grosse merde les onglets plateforme », puis « on doit pouvoir sélectionner
dans les onglets la plateforme que l'on veut, faire un bel affichage ». Le CHOIX par onglet reste (même clé
`vrm_site_courant`, mêmes sites reliés `siteMontre`, même API de `src/natif/SelecteurSite.jsx`) ; l'aspect change.

- **Pastilles** qui défilent à l'horizontale (`src/natif/SelecteurSite.jsx`, `selecteur-site.css`) : le logo du site EN
  COULEUR (forme : `public/brands/*.svg` en masque ; Vinted #007782, Leboncoin #EC5A13, eBay en quatre couleurs, Vestiaire à
  l'encre ; teintes éclaircies en sombre), le nom complet, un compteur discret quand l'onglet le sait (Annonces : annonces
  en ligne de chaque site, publiées par `AnnoncesEgalite` dans `nombresAnnonces`), « Tous » avec la pile des logos.
  36 px, cible 44, arrondi complet ; choisie = teinte d'accent (`--n-teinte`) + bord accent ; fondu au bord du côté qui
  déborde ; la choisie toujours ramenée dans la vue ; appui `scale(.97)`, rien sous `prefers-reduced-motion`.
- **Ordinateur** : à côté du titre de l'écran (portail de `SelecteurSiteCoque` dans un hôte posé après le titre visible ; un
  `MutationObserver` le repose quand la coque re-rend son titre ; le titre passe en ligne et la rangée prend la place qui
  reste, en style posé — des règles d'avant forçaient largeur et marges).
- **Statistiques, Déclarer, Factures** : plus de pastilles grisées, une ligne discrète « Tous les sites ».
- Les sites reliés sont réactifs (`useSitesRelies`, src/siteCourant.js) : un sélecteur rendu avant leur lecture se remplit.
- Les segments de tâche (À envoyer · En route · Terminées…) restent le segmenté natif, 12 px sous les pastilles.

Preuves : `minimaliste --sites` vert (390 clair, 390 sombre, 1512 clair), `--selecteur` vert ; audits tdz, variables,
traduction, plateformes-logo, poids-demarrage verts. Planches avant / après (5 onglets × Tous et Leboncoin) :
scratchpad de la session, `selecteur-beau/planche-{390-clair,390-sombre,1512-clair}.png`.

Reste : le compteur n'est écrit que sur Annonces (Ventes, Achats, Aujourd'hui n'ont pas de compte par site publié).
