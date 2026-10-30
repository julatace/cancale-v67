# Reprise du chargement des moyens de connexion

Le chargement de `/auth/v1/settings` est partagé entre les appelants, limité à quinze secondes avec `AbortController`, et libère son verrou après une panne, un délai dépassé ou une réponse mal formée. Il ne dépend plus de `AbortSignal.timeout`.

`AuthScreen` s’abonne directement au résultat : l’ancien `_emitAuth()` pouvait transmettre la même référence `AUTH` à React, qui ne redessinait alors pas l’écran à l’arrivée tardive des réglages. Les boutons s’actualisent désormais indépendamment de la session et l’abonnement est supprimé au démontage.

Si la lecture échoue, l’email reste utilisable et un bouton permet de relire les moyens de connexion. Seuls les fournisseurs explicitement activés par un booléen `true` sont proposés. Une réponse vide ou contenant une valeur ambiguë n’active aucun fournisseur.

Vérification : cinq tests unitaires du chargeur ; banc de la vraie app à 320, 390 et 1512 px avec première lecture en panne, reprise différée, Google actif et Discord désactivé. Le banc supprime `AbortSignal.timeout` pour reproduire les anciens Safari ; il ne constitue pas un essai sur un iPhone physique. Les lectures de test et les fournisseurs sont simulés, sans authentification réelle ni email envoyé.
