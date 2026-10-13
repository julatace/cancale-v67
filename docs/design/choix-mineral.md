# Direction retenue — Minéral clair

Julien a retenu la planche blanche et demandé de poursuivre le développement dans ce style le 13 octobre 2026. Fond blanc cassé, encre noire, navigation claire et accent orange discret. La direction vaut pour toutes les plateformes, ordinateur et téléphone.

Palette et feuille de boutons préparées dans src/themeMineral.js et src/styles-mineral.css. Le raccordement de App.jsx est décrit par quatre remplacements exacts dans integration-mineral.json : import des styles, palette claire, composant Btn et peau eBay suivant le même thème. Appliquer sur le fichier complet contenant déjà K1 et les corrections photos, jamais repartir du vieux App.jsx.

Vérification effectuée dans l'orchestrateur JS : syntaxe de la palette et contrastes texte/fond 14,56 ; texte secondaire 5,24 ; bouton principal 16,17 ; accent orange 5,34. Aucune preuve de build ou de rendu : l'exécuteur Cloud reste sans réponse. Les fichiers ne sont pas encore importés par le runtime. Garder la PR en draft, pas de déploiement partiel. Il reste le raccordement, la préférence claire après lecture du cloud, les boutons eBay spécifiques et la composition des pages, puis les bancs mobile/ordinateur et les vérifications des photos réelles.
