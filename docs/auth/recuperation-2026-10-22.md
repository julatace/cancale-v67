# Inscription et récupération du mot de passe

La création réussie avec confirmation requise ouvre directement l'étape de connexion/confirmation sur la même page. Une panne réseau ou serveur n'est plus présentée comme la preuve que le compte n'existe pas. La connexion directe après inscription recharge l'app avec la bonne identité.

Les nouvelles demandes de récupération indiquent `/recuperation.html` comme retour. La page fonctionne indépendamment du gros bundle React, vérifie le lien, efface les secrets de l'URL avant les appels réseau et ne stocke pas la session de récupération. Elle demande un mot de passe confirmé, puis termine la session de récupération. Les liens Supabase anciens et les liens ayant abouti sur localhost peuvent aussi être collés sur cette page sans visiter leur URL. Aucun lien personnel ne doit être partagé dans un chat.

Le service worker exclut cette page du cache et du secours vers la coque de l'app. Une erreur d'envoi n'est pas annoncée comme un email envoyé. Les réponses aux demandes de mot de passe oublié restent identiques pour les comptes existants et absents.

## Configuration distante indispensable

Sans modification du projet Supabase réel, une URL de retour refusée par son allowlist peut encore retomber sur son Site URL, et le modèle d'email réel reste celui configuré dans Supabase. Le code seul ne peut pas modifier ces réglages.

Le script `scripts/configurer-auth-production.mjs` prépare puis peut appliquer, via l'API d'administration Supabase :
- Site URL `https://vrm.center` ;
- autorisation de retour vers `https://vrm.center` et `https://vrm.center/**`, en conservant les autres URL déclarées ;
- objet et modèle français VRM pour la récupération, lien direct VRM portant le token dans le fragment ;
- nom d'expéditeur VRM.

Sans `--appliquer`, aucun appel d'administration ni changement. Pour appliquer, le jeton d'administration doit être fourni dans l'environnement sécurisé `SUPABASE_ACCESS_TOKEN`, jamais dans un chat ni dans Git. Le script relit et compare chaque réglage enregistré. Il ne touche ni aux fournisseurs OAuth, ni aux confirmations d'email, ni aux secrets SMTP existants.

Une adresse d'expédition au domaine VRM exige en plus un SMTP avec domaine vérifié (SPF/DKIM). Changer le texte et le nom ne remplace pas cette configuration. L'environnement actuel ne possède aucun accès administrateur Supabase/SMTP ; aucun réglage distant n'est annoncé comme appliqué. Avant 2 000 utilisateurs, vérifier délivrabilité, quotas du fournisseur et une vraie demande du propriétaire. Aucun email réel n'est envoyé par les tests.

## Vérifications

122 tests unitaires réussis, compilation réussie. Banc `node scripts/bancs/recuperation-auth.cjs` : navigateur Chromium à 390 px, faux service d'authentification, nettoyage du jeton, absence de stockage, refus des confirmations différentes, un seul enregistrement et champs effacés après succès. Ce test mobile ne constitue pas un test natif Safari.
