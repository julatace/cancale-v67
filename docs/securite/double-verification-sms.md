# SMS comme second facteur VRM

L'app utilise le facteur natif `phone` de Supabase Auth, après le mot de passe : il ne s'agit pas d'une simple connexion sans mot de passe par SMS. Le vendeur prouve son numéro avant activation. Le code est validé contre le même défi qui a envoyé le SMS ; confirmer ne renvoie pas un nouveau code. Un délai de 60 secondes s'applique au bouton de renvoi ; les limites serveur restent obligatoires. Aucun SMS réel n'est envoyé par les tests.

## Configuration externe indispensable — non effectuée ici

L'administrateur doit activer Phone MFA dans les paramètres MFA de Supabase Auth, vérifier sa disponibilité et son prix sur le forfait du projet, puis configurer un fournisseur SMS supporté (par exemple Twilio) avec ses identifiants conservés dans Supabase. Configurer les limites serveur, les pays autorisés et le modèle de message « VRM : votre code de sécurité est … ». Le projet doit autoriser enrollment et verification des facteurs phone. Ne pas mettre les identifiants SMS dans le navigateur ou le dépôt.

Appliquer les migrations 021 (isolation propriétaire) puis 022 (niveau aal2 exigé sur les données privées lorsqu'un facteur est vérifié). Sans 022, l'écran de code ne constitue pas à lui seul un verrou au niveau de la base. Les comptes sans facteur vérifié gardent leur accès par mot de passe. Les comptes avec authentificateur existant conservent cette méthode ; le SMS s'ajoute sans suppression automatique du facteur existant.

Le numéro est conservé dans Supabase Auth pour l'envoi ; seul un masque est mis dans le cache de session. Ne jamais le confondre avec une adresse email de réception, un compte Vinted ou un critère d'attribution des données. En cas de téléphone perdu, aucune désactivation sans preuve n'est proposée à la connexion. L'administrateur traite la récupération d'accès séparément.

Cette session n'a aucun accès administrateur à Supabase et n'a configuré ni fournisseur, ni forfait, ni migration distante. Ne pas annoncer l'envoi réel de SMS comme opérationnel avant cette configuration et un essai contrôlé avec un numéro appartenant au vendeur.

Les routes privées qui passent par `utilisateurDe` exigent également aal2 lorsque Supabase confirme un facteur téléphone ou TOTP vérifié. Cette décision repose sur `/auth/v1/user` et le jeton vérifié, pas sur une déclaration du navigateur. Le verrou SQL reste nécessaire pour les clients qui interrogent directement PostgREST, dont l'extension.
