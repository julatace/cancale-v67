# Paquet Orion pour iPhone et iPad

Demande explicite : une extension adaptée à Orion. Appareil confirmé par le vendeur : iPhone/iPad.

## Sources effectivement lues

Documentation officielle Kagi via le dépôt kagisearch/kagi-docs : docs/orion/browser-extensions/ios-ipados-extensions.md et macos-extensions.md. Sur iOS, Kagi documente l'activation des extensions Chrome/Firefox puis menu Extensions, bouton + et installation depuis un fichier. La couverture des API est partielle, avec davantage de limites iOS. La documentation ne précise pas le suffixe exact accepté par chaque version du sélecteur de fichiers : fournir XPI et ZIP, ne pas affirmer une importation réelle déjà testée. Le fichier public webext-api-coverage.html du dépôt est vide : aucune table de couverture détaillée revendiquée.

## Livrables

- public/VRM-Orion.xpi : archive WebExtension, manifest.json à la racine.
- public/VRM-Orion.zip : copie identique, autre suffixe pour le sélecteur Orion.
- public/VRM-Orion-installation.txt : étapes iPhone/iPad, permissions par site, vérification du bon compte et limites réelles.
- scripts/zip-extension.cjs : les fichiers Orion publics et la version de la notice sont régénérés avec le paquet Chrome. --orion <fichier> exporte vers un autre chemin. Les mises à jour du moteur ne doivent donc pas laisser un paquet Orion ancien.

Le moteur partagé reste 5.222.0 : aucun changement de logique métier ni nouvelle promesse pour les favoris. Le paquet Chrome reste identique. Le manifeste Orion est MV2 avec background.scripts non persistant, browser_action et permissions d'hôtes au format classique. Le service worker, externally_connectable et la contrainte Firefox strict_min_version sont retirés. Le pont de page adressé reste la voie de liaison, avec contrôles d'origine, owner et nonce identiques.

compat-orion.js conserve les rappels/écouteurs et adapte les appels attendus en promesses quand chrome.* est à rappels seuls, y compris sans browser.*. Les API inexistantes restent inexistantes. action est relié au browserAction natif pour le manifeste classique. orion-main.js attend une racine DOM si nécessaire puis charge les capteurs existants dans la page. L'entrée inject.js ne doit surtout pas devenir un content script isolé à la suppression de world:MAIN ; elle est retirée du manifeste Orion et chargée par le relais. Les injections Leboncoin/Vestiaire disposent déjà de leur garde/repli.

Le téléchargement Orion apparaît dans PremiersPas lorsque window.KAGI et un appareil iOS sont détectés. Il n'est pas présenté comme une fiche Firefox publiée ni comme le ZIP Chrome ; la notice est liée et la phrase qui affirmait qu'aucune extension n'est acceptée est masquée pour ce cas précis.

## Validation effectuée

- 103 contrôles de construction, ressources et égalité des fichiers distribués avec la source ; adaptateur à rappels, promesses, browser uniquement, conservation des erreurs et des écouteurs.
- Worker réellement extrait du paquet, exécuté avec API simulées sans browser, alarms, scripting, windows ni canal externe : nonce de liaison, adoption du bon owner, rejet d'une origine étrangère et d'un nonce rejoué.
- Validateur web-ext : 0 erreur, 0 notice, 3 avertissements action.*. Ces avertissements statiques concernent le moteur inchangé ; le paquet fournit explicitement l'alias browserAction, testé.
- 6 contrôles navigateur du chargeur : hook actif et capture d'une unique requête synthétique ; pas de double injection ; refus CSP observé sans fausse annonce de succès. Première fixture servait du JavaScript UTF-8 sans charset dans une page sans charset, donnant une erreur de décodage : fixture corrigée, aucun contournement CSP.
- 6 contrôles de rendu Orion iPhone simulé : bon lien XPI, notice, aucun ZIP Chrome ni affirmation d'incompatibilité totale, absence de débordement.
- Audit existant des navigateurs, cohérence, ZIP et build.

Ces validations ne sont PAS un essai d'installation dans Orion/iOS réel. Les cookies HttpOnly ne peuvent pas être récupérés si Orion n'expose pas l'API adéquate. iOS peut suspendre l'arrière-plan. Les fonctionnalités nécessitant une API ou une injection absente restent indisponibles : ne pas publier une promesse de parité complète avec Chrome. Aucun message réel envoyé durant les tests.
