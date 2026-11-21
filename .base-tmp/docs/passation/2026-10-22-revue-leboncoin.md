# Revue de la chaîne Leboncoin — extension 5.212.0

## Incident et preuve disponible

Le diagnostic client montre une dernière transaction intégrée au 7 octobre, malgré une identité privée de nouveau reconnue. Les correctifs précédents de rafraîchissement ne suffisent pas à rétablir une capture. Cette revue porte sur l'acquisition, l'identité, l'enregistrement, les accusés et les lecteurs des annonces/transactions ; aucune correction financière n'est déduite d'un titre et aucune donnée historique n'est réinitialisée.

## Défauts corrigés

| Maillon | Défaut | Résultat vérifié |
| --- | --- | --- |
| Document initial | Le crochet fetch/XHR ne voit pas les données déjà rendues dans le HTML. L'ancien `lbcCapture` générique est refusé car il mélangeait les recommandations et la session. | Lecture de `__NEXT_DATA__` sur les seules pages privées attendues : conteneurs explicites `pageProps.ads`/`data.ads`, détail `transaction`/`data` avec côté booléen, liste `transactions`. Les annonces attendent le profil privé confirmé ; les recommandations ne sont pas parcourues. Source du document comparée à l'onglet dans le fond. |
| Volumétrie | Le plafond générique de 1,5 Mo précédait l'allègement des transactions ; le JSON était ensuite coupé au caractère. | Réponse de transaction allégée avant le plafond métier ; aucun JSON de transaction tronqué n'est intégré. Le test traite plus de 2 Mo de traductions en conservant le détail. Les réponses dépassant les bornes restent refusées. |
| Accusé d'intégration | `lbcVente` renvoyait `ok:true` sans vente reconnue ou après un échec d'écriture. Les échantillons techniques précédaient la sauvegarde métier. | Réponse format/écriture explicite. La sauvegarde métier précède le diagnostic facultatif ; les corps privés des transactions ne sont plus recopiés dans ce diagnostic. |
| Reprise | Un 503 ou un échec réseau pouvait entrer dans le mémo « déjà lu », puis empêcher une nouvelle lecture. | Un refus n'est pas mémorisé comme lecture ; 401/403/429 arrêtent la série. Les anciens mémos sans accusé d’intégration sont relus, avec les mêmes bornes de cinq détails par visite. Un détail n’entre dans le mémo durable qu’après l’accusé de sauvegarde ; le HTTP 200 seul ne suffit pas. |
| Identité des transactions | Un identifiant d'annonce pouvait servir de repli au numéro de transaction ; un identifiant explicite contradictoire n'était pas rejeté. | Pas de conversion annonce → transaction. Un numéro du détail différent du numéro de l'URL est refusé. |
| Multi-onglets | Comptes et annonces pouvaient relire puis écraser la même ligne simultanément. | Une chaîne de fusion par famille, comme pour les transactions. Les mises à jour concurrentes sont conservées. |
| Compte VRM | La lecture d'une ligne et son écriture pouvaient utiliser des sessions différentes. Un tampon technique ancien pouvait être envoyé au vendeur suivant. | Propriétaire fixé avant les lectures, vérifié par l'upsert à l'envoi et lors d'un nouvel essai. Tampon technique estampillé par propriétaire ; un tampon d'un autre vendeur n'est pas fusionné. Le compte local n'est actualisé qu'après sauvegarde réussie. |
| Compte Leboncoin | Un identifiant privé long valide était raccourci par le relais. Les ventes ne portaient pas le compte quand la session privée était connue. | Conservation de l'identifiant complet. Compte ajouté aux transactions lorsque sa preuve est disponible ; jamais inventé si elle manque. Une transaction déjà attribuée ne se déplace pas vers un compte contradictoire. |
| Écran | Les écritures passives n'avertissaient pas VRM. Le badge affichait un échange générique, pas le résultat métier. | Notification après sauvegarde réussie et reçus séparés Annonces/Transactions : nombre, photos et date, ou motif d'échec. Une liste privée vide est distincte d'un format non reconnu et ne supprime pas l'historique. |

## Argent et historique

La liste conserve son total acheteur dans `prixListe` ; elle n'écrase pas le prix du détail. Le test de bout en bout conserve 2500 centimes du détail plutôt que 2928 de total acheteur. Les côtés vendeur/acheteur restent des booléens explicites ; le CA reste soumis aux règles de finalisation existantes. Aucun rapprochement par titre, réattribution des anciennes annonces, suppression de vente ou recalcul inventé.

## Validation

- 164 tests unitaires : reprise après 503/429, ancien mémo, transaction contradictoire, photos conservées, concurrence, bascule de propriétaire et tampon technique.
- Banc Chromium avec monde MAIN et monde isolé distincts, vrai background sur base simulée : HTML d'annonces, identifiant long, HTML de transaction, grosse réponse, écriture refusée, format inconnu, page publique exclue.
- Le même banc échoue avec l'ancien capteur HTML et avec l'ancien accusé lors d'une écriture refusée.
- Audits Leboncoin : comptes, session, catalogue, détails, ventes, finalisation, restes, messages, packs, fiche ; audit argent et contrôles voisins de connexion, bruit, interface et navigateurs.
- ZIP comparé aux sources octet par octet, versions manifeste/fond/capteur/relais/app cohérentes ; build de l'app.

## Limites à ne pas masquer

Ces tests utilisent des réponses simulées et les formes déjà documentées, pas la session réelle du client. L'installation d'une extension non empaquetée est interdite par l'administrateur du navigateur fourni. Le parcours avec mondes distincts ne vaut pas un test d'installation réelle.

Un flux React Flight `__next_f` arbitraire n'est pas traité comme preuve de propriété ; un format non reconnu ne devient pas une liste vide. Les conteneurs HTML pris en charge sont explicites, pas un balayage du DOM. Aucune promesse de prise en charge automatique de tous les futurs changements Leboncoin.

La collecte reste passive, complétée par les lectures bornées des détails déjà demandées par le parcours existant. Ouvrir une page générale ne charge pas toute l'histoire des transactions. La résolution de l'incident réel nécessite une nouvelle date d'intégration et des reçus métier sur le compte client après installation/rechargement. Ne pas déclarer les données financières réelles réconciliées sur la seule base des tests.
