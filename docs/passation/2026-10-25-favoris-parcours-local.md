# Extension 5.226 — parcours manuel local des favoris

L’utilisateur a demandé puis autorisé un enregistrement de son parcours Vinted pour observer la notification qui s’ouvre manuellement alors que la vérification native échoue. Ce mode ne corrige pas encore la cause du refus : il permet de l’observer.

Dans la fenêtre de l’icône de l’extension (pas sa carte intégrée), « Diagnostic des favoris » propose Enregistrer, Arrêter et voir, Copier et Effacer. Il faut ouvrir Vinted dans l’onglet actif, démarrer puis faire soi-même cloche → notification → conversation. La page affiche une indication avec un arrêt accessible. Le rapport s’arrête à la route d’une conversation, après3minutes, manuellement ou à100étapes.

Le worker exige sa propre page popup, sélectionne un seul onglet HTTPS Vinted autorisé et exige un accusé du content script. Un nonce privé lie la reprise après navigation et les événements au même onglet/origine/frame principal. Les commandes sont sérialisées, les événements hors périmètre et après arrêt refusés. Aucun clic ni requête Vinted n’est déclenché par le recorder. Les listeners existants de navigation restent dans le même dispatch, pas de remplacement de canal.

L’isolated world observe les clics de confiance, la catégorie de route et les PerformanceResourceTiming des seules API notifications/conversations. Aucun hook fetch/XHR ni corps de requête/réponse ni en-tête n’est lu. Les URL sont classées localement et ne sont jamais transmises au worker. Les liens et identifiants ne sont pas conservés. Aucune écoute des frappes, des saisies ou du texte de page. Les noms accessibles sont classés, pas copiés. Les paramètres sont des noms whitelistés ou « autre », sans valeur. Le worker applique une seconde whitelist ; le rapport exporté exclut aussi le nonce et l’onglet.

Stockage chrome.storage.session si disponible, sinon local pour Orion ; le rapport est effaçable et supprimé à sa prochaine consultation s’il a plus de30minutes depuis le début. Pas de promesse de purge murale exacte quand le navigateur est fermé. Aucun envoi du rapport à VRM, aucun téléchargement automatique. Copie uniquement après arrêt et lecture par le vendeur. L’expiration et le plafond arrêtent aussi l’acquisition.

Version moteur/manifeste/consignes/archives226. L’ouverture des favoris conserve son minimum225 ; envois217/liste218 inchangés. Pas de nouvelle permission. Pas de changement SQL/API/envoi ni de test client authentifié. Orion/iOS réel non accessible ici.

Tests : worker (origine, nonce, onglet/frame, sérialisation, borne, délai, purge, accusé, absence d’écriture serveur), Chromium (consentement préalable, clic de confiance, pas de saisie/valeurs, arrêt), panneau popup (démarrer/arrêter/lire/copier/effacer et largeur320/390/1512). Regressions de navigation et paquets exécutées séparément.
