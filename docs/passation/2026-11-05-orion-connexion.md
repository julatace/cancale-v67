# Connexion autonome dans Orion — 5 novembre 2026

## Demande et défaut
Julien précise que le mot de passe ouvre VRM dans un autre onglet et interrompt ainsi la capture Vinted sur son téléphone. Il veut rester sur Vinted après la connexion de l’extension, sans garder une page VRM ouverte. Le raccourci Vinted sur l’écran d’accueil semble perdre l’extension.

Le popup envoyait `ouvrir: CARTE` puis ouvrait lui-même VRM hors carte. Après son clic, les deux variantes quittaient donc la plateforme. L’adaptateur Orion laissait aussi les appels à rappel tels quels lorsque ses API renvoyaient des promesses : les API uniquement à promesses pouvaient ignorer ou refuser ces rappels.

## Changement
- Le mot de passe envoie `ouvrir:false` et affiche le compte effectivement connecté sur succès du moteur ; champ du mot de passe retiré. La capture après connexion (`visiteApresSession`) reste déclenchée, avec les gardes habituelles. Aucun achat, message, offre ou changement d’annonce de test.
- Le moteur borne la réponse d’authentification à 12 secondes et son corps à 6 secondes ; aucun jeton n’est rangé si ces réponses manquent. Le popup borne son attente à 25 secondes et redevient utilisable après échec ; un clic ou des Entrée répétées ne lancent qu’une demande à la fois.
- L’adaptateur Orion transforme une API native à promesse en rappel lorsque le code partagé attend un rappel. Les rejets passent par `runtime.lastError` uniquement pendant le rappel ; aucun listener ou API absente n’est fabriqué.
- Rouvrir la fenêtre d’une extension déjà connectée dans Orion conserve également Vinted ouvert (Chrome garde son comportement habituel).
- « Se connecter avec VRM » reste explicite pour OAuth et captcha : aucun contournement de vérification. Le bouton « Ouvrir VRM » reste disponible après connexion.
- Notice et fenêtre Orion expliquent les limites iOS : un raccourci web autonome peut fonctionner hors Orion, sans ses extensions. L’extension n’est pas installée dans Safari ni dans l’application Vinted. Il faut Vinted ouvert dans Orion ; pas de promesse de capture iOS en veille ou navigateur fermé.

## Validation et limites
Vrai popup et vrai adaptateur exécutés sur navigateur de contrôle, API simulées à rappels ou à promesses : succès dans la carte et l’icône sans création d’onglet, email du compte affiché, une demande malgré Entrée répétée, refus, rejet et réponse absente. Vrai moteur avec réseau/corps muets, stockage de session sans mot de passe et sans ouverture VRM. Audits captcha, visite après session, packaging et injection Orion ; banc popup partagé.

Ces vérifications ne sont pas une recette sur un iPhone réel. La précision de Julien explique l’ouverture d’onglet ; elle ne prouve pas que chaque API Orion/cookie fonctionne sur son appareil. Ne pas annoncer une synchronisation réelle tant que des données n’ont pas été reçues. Paquets 5.320.0 régénérés, une version nouvelle pour chaque contenu nouveau.
