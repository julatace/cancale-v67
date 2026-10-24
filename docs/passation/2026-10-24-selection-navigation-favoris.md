# Sélection de texte et chargement des favoris

Julien signale une sélection à la souris qui quitte Vinted au relâchement, puis
un lancement des favoris bloqué par un message de chargement de l'extension.

Le balayage global à la souris est retiré : démarrer dans une marge puis traverser
un texte ne doit ni changer de plateforme ni désactiver la sélection native.
Les boutons de navigation et les gestes tactiles restent disponibles.

La disponibilité des favoris privilégie une réponse adressée fraîche et vérifiée
de l'extension plutôt qu'un battement de page plus ancien qui la disait absente.
Les doubles extensions, versions incohérentes, mauvais propriétaire VRM et compte
Vinted différent restent bloqués. Un réveil lent peut relire une fois l'état
sans envoyer de message ; aucune répétition des commandes d'envoi n'est ajoutée.
Le texte préventif avant lancement est neutre : une absence de vérification
initiale n'est pas annoncée comme une erreur de l'extension.

Validation : six contrôles sur la vraie fonction de disponibilité ; build et
banc application complète incluant glissement depuis une marge sur Vinted,
relâchement, second geste et navigation explicite par clic. Tous les comptes et
messages utilisés dans les essais sont synthétiques. Le texte exact du blocage
client a été demandé pour distinguer toute autre cause qui persisterait.

L'extension 5.218.0 est inchangée ; seul le site est à recharger après publication.

## Lisibilité de Messages et Favoris

Deux sections explicites « Conversations » et « Favoris reçus » remplacent les
blocs empilés. Ouvrir Favoris charge automatiquement les données privées du
compte sélectionné, sans requête ni message supplémentaire sur Vinted. La
préparation du message apparaît après sélection. Le diagnostic est renommé
« Assistance technique · favoris » et reste replié. Les composants restent
montés lorsqu'on passe entre ces deux sections afin de conserver la file et
son résultat. L'état d'un autre propriétaire ou compte n'est pas réutilisé.
