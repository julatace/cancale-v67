# Récupération du mot de passe : résultats certains et pannes

La page autonome présentait tous les refus de vérification comme des liens expirés, y compris un HTTP 503 et une réponse 200 incomplète. Elle utilisait aussi `AbortSignal.timeout`, indisponible sur certains anciens Safari.

- Les pannes, quotas, réponses incomplètes et expirations explicites ont maintenant des messages différents. Aucun message brut du service n'est affiché.
- Les demandes ont un délai de 15 secondes via AbortController, couvrant aussi la lecture JSON, sans relance automatique. La vérification initiale et la vérification du lien collé partagent un verrou.
- Un enregistrement de mot de passe n'est confirmé que par une réponse réussie contenant l'identité retournée par le service. Une réponse incertaine invite à essayer la connexion avant de recommencer.
- Une fois le mot de passe confirmé, les champs sont effacés immédiatement. Si la fermeture globale des sessions échoue, le succès du mot de passe et l'absence de confirmation de fermeture sont dits séparément.
- Les jetons restent en mémoire ; aucun nouveau stockage, service ou dépendance.

Validation : tests unitaires de classification et d'interruption, banc existant de récupération, nouveau banc de pannes à 390 et 1512 px (ancien Safari simulé sans AbortSignal.timeout, panne de vérification, reprise manuelle, échec d'enregistrement et échec de fermeture). Le nouveau banc échoue sur le fichier public d'avant et passe sur le correctif. Les tests ne créent aucun compte, n'envoient aucun email et ne changent aucun vrai mot de passe.

Le workflow des parcours critiques exécute ce nouveau banc à chaque modification. La livraison SMTP et les réglages du projet Supabase réel ne sont pas certifiés par cette simulation.
