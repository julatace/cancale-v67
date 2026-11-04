# Nom VRM sur l'écran Google

Les boutons VRM lancent le fournisseur Google de Supabase. Le nom montré par
Google dépend du projet Google Cloud qui possède le Client ID enregistré dans
Supabase. Changer le libellé du bouton VRM ne change pas l'écran de Google.

Dans ce projet : **Google Auth Platform → Branding** (Identité de marque) :

- Nom de l'application : **VRM** ; logo officiel de VRM.
- Accueil : `https://vrm.center/`.
- Confidentialité : `https://vrm.center/legal/confidentialite.html`.
- Conditions : `https://vrm.center/legal/cgu.html`.
- Domaine autorisé : `vrm.center`, avec propriété vérifiée dans Search Console.
- Adresse d'assistance et contact développeur : une adresse surveillée par VRM.
- Enregistrer puis publier/soumettre la marque si Google le demande.

Conserver dans le client Web OAuth le callback exact utilisé par Supabase :
`https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback`.
Ne pas remplacer ce callback par la page d'accueil.

Vérifier que Supabase → Authentication → Providers → Google utilise le Client
ID de CE projet. Ne jamais partager son secret dans un chat ni dans GitHub.

Google peut aussi montrer le domaine technique `supabase.co` dans une étape
ou une URL du parcours. Le nom de marque et le domaine d'authentification sont
deux choses différentes. Remplacer ce domaine nécessite une configuration de
domaine Auth personnalisé ; ne pas promettre qu'elle est gratuite ni modifier
la sécurité du parcours pour masquer le domaine. Le nom/logo peuvent rester
soumis à la vérification de Google.

État : aucun accès administrateur Google Cloud/Supabase configuré ici. Aucune
modification externe de marque n'a été effectuée. Tester ensuite en navigation
privée avec un vrai compte autorisé, sans créer de compte de test en production.
