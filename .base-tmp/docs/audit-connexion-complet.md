# Audit de la page de connexion — 30 octobre

## Corrections

- La règle locale de création (8 caractères minimum) ne bloque plus un ancien mot de passe à la connexion. Le serveur valide toujours les identifiants.
- Google/Discord, renvoi de confirmation, lien de connexion et collage manuel partagent le verrou synchrone des demandes : un double clic ne lance pas deux actions. Un retour arrière via le cache du navigateur libère ce verrou et remet les boutons en état.
- Le fournisseur choisi affiche « Ouverture de Google… » ou « Ouverture de Discord… ».
- Une exception inattendue rend les boutons disponibles et laisse la saisie en place.
- Une réponse de confirmation vide n’annonce plus un succès. Une adresse confirmée sans session invite à se connecter, sans rechargement trompeur.
- Inscription et retour OAuth exigent l’identité de la session avant de l’enregistrer. Un retour OAuth incomplet ne remplace pas la session précédente.
- Les erreurs OAuth déjà décodées ne passent plus une deuxième fois par `decodeURIComponent` ; un signe `%` ne fait plus disparaître le message.
- Les pannes du service et les limitations de tentatives affichent une consigne en français.
- Le changement de mot de passe est interrompu après 20 secondes sans réponse. Un succès exige une réponse portant l’identité attendue et la même session ; un résultat inconnu reste annoncé comme non confirmé.

## Vérification

- Tests de `connexion-session.test.mjs` et `inscription-parcours.test.mjs` : réponses complètes/incomplètes, erreurs, identité, absence de fausse session, interruption.
- Nouveau `connexion-actions-interface.cjs` : vrai `AuthScreen`, services simulés, à 320/390/1512 px. Fournisseurs activés, double clic, refus puis reprise, retour arrière, ancien mot de passe, renvoi, lien, confirmation sans session et exception.
- Bancs de la vraie app : connexion, inscription, délais de renvoi. Audit général des parcours critiques et contrôle anti-robot.
- Ajout du nouveau banc aux contrôles de chaque PR.

Aucun compte de production créé, aucun email réel envoyé. Ces essais ne prouvent pas la livraison SMTP, le fonctionnement d’un compte Google/Discord réel, ni le rendu d’un iPhone physique. Les contrôles d’isolation, de captcha, d’identité et les quotas restent actifs.
