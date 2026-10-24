# Raccordement des favoris — diagnostic v4

Le retour réel v3 confirme la capture de notifications, avec cinq liens de favoris vers `/items/{identifiant}/{segment}/new`. Il ne confirme ni conversation existante, ni destinataire, ni historique complet. Le masque v3 cachait trop de noms techniques utiles.

Le v4 conserve les segments et paramètres techniques connus, sans leurs valeurs. Il indique seulement si le `user_id` correspond au compte courant et quels paramètres connus lui sont égaux : ces relations ne prouvent pas une identité de destinataire.

Pour les liens favoris terminant par `/new`, lecture des observations passives POST `/api/v2/conversations` et `/api/v3/conversations`, avec filtre propriétaire et vérification du compte et de la session. Seuls les noms de champs autorisés et leurs types sont exportés ; aucun contenu, identifiant, nom ou message. Une observation précédant la réponse ne prouve pas le succès : `succes:non_confirme` explicite. Aucun appel Vinted, création ou envoi n'est déclenché par ce diagnostic.

Validation : 29 tests unitaires, 30 contrôles du composant diagnostic React et build Vite. Tests synthétiques, sans envoi réel. Extension 5.214 inchangée. Le moteur d'envoi, la liaison vérifiée et le quota atomique restent à réaliser ; les réglages enregistrés ne les activent pas.
