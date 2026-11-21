# Connexion : parcours et réponses incomplètes

La réponse de connexion par mot de passe doit porter un jeton non vide et l’identité de son utilisateur avant d’être enregistrée. Un HTTP 200 vide ne déclenche plus une fausse réussite ni un rechargement : l’erreur permet de réessayer avec la saisie conservée.

Le lien de récupération est placé près du mot de passe. Pendant une demande, les changements de formulaire sont désactivés ; au retour de la récupération, l’email est conservé et les anciens états d’aide sont nettoyés. Les délais de renvoi restent partagés et ne bloquent jamais la connexion normale.

Un email non confirmé affiche une seule explication et les actions de renvoi. Le collage manuel d’un lien défectueux reste disponible dans une aide repliée. Ce champ est libellé et utilise une police de 16 px pour éviter le zoom de Safari.

Sur téléphone, l’en-tête garde sa hauteur naturelle plutôt que d’absorber l’espace libre au-dessus du formulaire. La présentation à deux colonnes reste conservée sur ordinateur.

Preuves synthétiques : `scripts/tests/connexion-session.test.mjs` (forme des sessions), `scripts/bancs/connexion-claire.cjs` (vraie app à 320, 390 et 1512 px, double clic, réponse vide, récupération, aide), `inscription-fiable.cjs`, `attente-email.cjs` et `captcha.cjs`. Aucun compte réel créé, aucun email réel envoyé. Les fournisseurs OAuth réels et la livraison SMTP ne sont pas certifiés par ces essais.
