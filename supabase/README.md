# Passer VRM en multi-vendeurs — mode d'emploi

## Où on en est

**L'écran de connexion est ACTIF** (`MULTI_USER = true`), et le compte vendeur
existe : `shopcancale35@gmail.com`, **User UID `74eea6e7-f060-46b6-b9c7-d500cedf4738`**
(c'est cet identifiant qu'il faudra coller dans l'étape 2 de la migration).

Il a été créé depuis **Authentication → Add user → Create new user**, avec
« Auto confirm user » : aucun email envoyé, donc aucun quota, donc aucun
blocage. **C'est la seule méthode qui fonctionne sur ce projet** — retenir ça
pour les prochains comptes de test.

**La séparation des données n'est toujours PAS active** : il manque la migration
SQL. Tant qu'elle n'est pas passée, un deuxième compte verrait les données du
premier — c'est pourquoi le lien « Créer un compte » reste masqué dans l'app.

### Historique : pourquoi la connexion avait été coupée un moment
Elle avait été activée AVANT la migration. Résultat : un écran de connexion
sans aucune protection à offrir, et impossible de créer le compte pour le
franchir :

- l'écran de connexion n'apportait **aucune protection** (rien n'est cloisonné
  tant que la base n'a pas de colonne `owner`) mais il **bloquait l'accès à
  l'outil de travail quotidien** ;
- la création de compte dépend d'un email de confirmation que le serveur de test
  de Supabase n'envoie pas (quota : quelques messages par heure) ;
- le tableau de bord refuse d'enregistrer ses réglages : l'option « Prevent use
  of leaked passwords » est réservée au plan payant et fait échouer la
  sauvegarde de la page entière ;
- et cette version du tableau de bord n'a **pas** d'action « Confirm email » sur
  un utilisateur : uniquement des boutons qui envoient des mails.

La leçon retenue : **créer le compte AVANT d'activer la connexion**, et le créer
depuis « Add user » plutôt que par le formulaire d'inscription.

## L'ordre correct, et il n'y en a pas d'autre

1. **Migration SQL** (étapes 1 et 2 ci-dessous) — c'est elle qui crée la
   séparation réelle.
2. **Créer le compte vendeur** depuis Supabase → Authentication → **Add user** →
   *Create new user*. Créé depuis le tableau de bord, il est confirmé d'office :
   aucun email, donc aucun quota, donc aucun blocage.
3. **Seulement ensuite**, repasser `MULTI_USER` à `true` dans `src/App.jsx`.

Fait dans cet ordre, il n'y a aucun moment où on se retrouve devant une porte
fermée dont personne n'a la clé.

**La séparation des données ne l'est pas encore.** Il manque la migration SQL
(je ne peux pas la lancer : la clé que l'app utilise ne permet pas de modifier
la structure de la base). En attendant :

- tu te connectes, et tu retrouves **toutes tes données** — elles sont au même
  endroit qu'avant, rien n'a bougé ;
- l'extension continue d'écrire exactement là où elle écrivait ;
- ⚠️ **n'invite personne** : sans la migration, un deuxième compte verrait tes
  données.

L'app détecte l'état réel de la base (`CLOISONNE`) et te le dit sous le
formulaire de connexion. Dès que la migration est passée, elle bascule seule en
vrai cloisonnement — aucun changement de code à faire.

**Si la connexion coince** (email de confirmation qui n'arrive pas, fournisseur
pas encore activé), il y a un bouton **« Entrer sans compte (temporaire) »** sous
le formulaire. Il ne donne accès à rien de plus qu'avant — les données sont
communes de toute façon — et **il disparaît tout seul** une fois la migration
passée. Tu ne peux pas te retrouver enfermé dehors de ton propre outil.

L'ordre compte. Ne saute pas d'étape.

---

## Pourquoi c'est en attente et pas déjà activé

L'isolation entre vendeurs est faite par **Postgres**, pas par le JavaScript de
l'app. C'est volontaire : une séparation écrite en JavaScript ne protège de
rien (il suffit d'ouvrir la console du navigateur pour la contourner). La règle
qui compte — « tu ne peux lire que tes lignes » — doit vivre dans la base.

Or je ne peux pas modifier la structure de la base avec la clé publique que
l'app utilise. Il faut la coller toi-même dans Supabase. D'où ce mode d'emploi.

---

## Étape 1 — Préparer la base (5 min, sans effet visible)

1. Va sur https://supabase.com/dashboard → ton projet → **SQL Editor** → **New query**
2. Ouvre `migrations/001-multi-utilisateurs.sql`, copie **l'étape 1 uniquement**
   (le fichier est découpé et commenté)
3. Colle, clique **Run**

L'app fonctionne toujours pareil après ça. Rien n'a changé pour toi.

## Étape 2 — Autoriser les inscriptions

Supabase → **Authentication** → **Providers** → **Email** → décoche
**« Confirm email »**.

Pourquoi : par défaut Supabase envoie un email de confirmation avant d'activer
un compte, mais son serveur d'envoi intégré est réservé aux tests — il n'écrit
qu'aux membres du projet et n'envoie que quelques messages par heure. Tes futurs
vendeurs ne recevraient jamais rien. Sans confirmation, l'inscription est
immédiate.

> Quand tu voudras ouvrir l'app à de vrais clients payants, remets la
> confirmation et branche un vrai service d'envoi (Resend, Postmark, Brevo…)
> dans **Authentication → Emails → SMTP Settings**. La confirmation email évite
> qu'on crée des comptes avec l'adresse de quelqu'un d'autre.

> **Vérifié le 2 août 2026** : sans cette case décochée, la création de compte
> échoue avec `email rate limit exceeded`. Supabase essaie d'envoyer un email de
> confirmation, et son serveur d'envoi de test est limité à quelques messages
> par heure — le quota est déjà atteint. Décocher « Confirm email » supprime
> l'email : la création devient immédiate.

## Étape 2 bis — Activer Google et Discord

> **Tant qu'un fournisseur n'est pas activé ici, son bouton n'apparaît PAS dans
> l'app** (l'app lit les réglages de Supabase au démarrage). Avant, le bouton
> était affiché et menait à une page noire avec
> `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`.


Les deux boutons « Continuer avec… » sont déjà dans l'app. Il faut créer une
application chez chaque fournisseur et donner ses clés à Supabase.

**L'adresse de retour est la même dans les deux cas :**
`https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback`

### Google
1. https://console.cloud.google.com → crée un projet (ou prends-en un existant)
2. **APIs & Services → OAuth consent screen** → type *External* → renseigne le
   nom de l'app, ton email de contact, ton email de développeur
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type *Web application*
4. Dans **Authorized redirect URIs**, colle l'adresse de retour ci-dessus
5. Copie le *Client ID* et le *Client secret*
6. Supabase → **Authentication → Providers → Google** → active, colle les deux,
   **Save**

### Discord
1. https://discord.com/developers/applications → **New Application**
2. Onglet **OAuth2** → **Redirects** → *Add Redirect* → colle l'adresse de retour
3. Copie le *Client ID* et le *Client secret* (**Reset Secret** si besoin)
4. Supabase → **Authentication → Providers → Discord** → active, colle les deux,
   **Save**

### Et l'adresse de retour vers l'app — À FAIRE MÊME SANS GOOGLE/DISCORD
Supabase → **Authentication → URL Configuration** :
- **Site URL** : `https://vrm.center`
- **Redirect URLs** : ajoute `https://vrm.center/**` et
  `https://cancale-v67-ten.vercel.app/**`

> ⚠️ **C'est ce réglage qui casse les liens de confirmation.** Par défaut, la
> Site URL vaut `http://localhost:3000`. Le lien du mail passe par Supabase puis
> renvoie vers cette adresse — qui n'existe pas sur ton téléphone, d'où
> « impossible d'accéder au site ». Tant qu'il n'est pas corrigé, tous les liens
> (confirmation, mot de passe oublié) finissent sur une page d'erreur.
>
> Contournement en attendant : l'écran de connexion accepte qu'on **colle le
> lien** du mail (ou un code à 6 chiffres) — l'app fait la vérification
> elle-même, sans redirection. Et le chemin garanti reste
> **Authentication → Users → clic sur l'email → Confirm email**.

Cette liste est une **liste blanche** : sans elle, quelqu'un pourrait fabriquer
un lien de connexion qui renvoie le jeton vers son propre site.

---

## Étape 3 — Créer ton compte et récupérer ton identifiant

1. Supabase → **Authentication → Providers → Email** → décoche **« Confirm
   email »** (étape 2 ci-dessus). Sans ça, la création de compte attend un email
   que le serveur de test de Supabase n'envoie qu'au propriétaire du projet, et
   à quelques exemplaires par heure.
2. Ouvre l'app → **Créer un compte** avec ton email
3. Supabase → **Authentication** → **Users** → clique sur ton email → copie
   l'**User UID**

À ce stade tu verras une app **vide** : c'est normal, tes données existantes
n'appartiennent encore à personne. L'étape 4 te les rend.

## Étape 4 — T'attribuer tes données et fermer la porte

Reprends `migrations/001-multi-utilisateurs.sql`, **étape 2**, remplace les deux
`METS-TON-UID-ICI` par ton User UID, colle dans le SQL Editor, **Run**.

Recharge l'app : tout ton historique est revenu, et il est maintenant à toi.
Un autre vendeur qui crée son compte démarre sur une app vierge et ne verra
jamais rien de tes données.

## Étape 5 — Reconnecter l'extension

Ouvre l'app une fois, connecté. L'extension récupère automatiquement ton
identité au passage (via `bridge.js`) et continue de capter tes annonces et
tes ventes sous ton compte. Rien à configurer.

Si tu as plusieurs profils Chrome, fais-le dans chacun.

---

## Ce qui reste en chantier après ça

**Les fonctions serveur** (`api/widget.js`, `api/email-inbound.js`,
`api/ship-reminders.js`, `api/push.js`) écrivent avec la clé publique. Une fois
l'isolation active, elles n'auront plus le droit d'écrire :

- le **widget iPhone** n'aura plus de chiffres à jour
- l'**import des emails Vinted** (ventes, bordereaux, colis) s'arrêtera

Pour les remettre en route il faut leur donner la clé `service_role` (Vercel →
Settings → Environment Variables → `SUPABASE_SERVICE_KEY`) et leur faire
préciser à quel vendeur appartient chaque ligne écrite. Pour les emails, ça
suppose aussi de savoir **à quel vendeur appartient une adresse email** — c'est
un vrai morceau, à faire dans un second temps.

**Tant que ce n'est pas fait**, deux options :

- appliquer **seulement l'étape 1** de la migration (les colonnes, sans RLS) :
  rien ne casse, mais il n'y a pas encore d'isolation réelle — donc pas encore
  de deuxième vendeur ;
- ou tout activer et accepter que le widget et l'import des emails soient en
  pause quelques jours.

À décider ensemble avant de basculer.


---

# Sécurité — ce qui est fait, ce qui reste

## Fait

**L'isolation est dans la base, pas dans l'app.** Une séparation écrite en
JavaScript ne protège de rien : il suffit d'ouvrir la console du navigateur
pour la contourner. Ici c'est Postgres qui refuse les lignes des autres.

**La clé publique dans le code n'est pas un problème** — elle est *faite* pour
être publique. Ce qui la rendait dangereuse, c'est l'absence de RLS : sans
règle, cette clé donnait accès à tout. Avec RLS, elle ne donne accès à rien
sans être accompagnée du jeton d'un compte.

**Connexion Google / Discord en PKCE** et pas en méthode « implicite ». En
implicite le jeton d'accès revient *dans l'URL* : il finit dans l'historique du
navigateur, dans les journaux d'un proxy, dans le presse-papier si on copie le
lien. En PKCE il ne revient qu'un code inutilisable seul — l'échanger exige un
secret tiré par l'app, gardé dans l'onglet, jamais transmis. Intercepter l'URL
ne suffit plus.

**L'URL est nettoyée** après le retour de connexion : aucun jeton ne reste dans
la barre d'adresse.

**Le formulaire « mot de passe oublié » répond pareil** que le compte existe ou
non. Sinon il suffisait d'y taper des adresses pour savoir qui est inscrit.

**La session transmise à l'extension vérifie l'origine** de l'onglet émetteur :
sans ça, n'importe quel site ouvert dans le navigateur pouvait envoyer un jeton
à l'extension et lui faire écrire des données.

**La route du widget iPhone est fermée.** Elle était **publique** :
`https://vrm.center/api/widget` renvoyait à qui la demandait le chiffre
d'affaires du mois, le nombre de ventes, l'argent en attente et le nombre
d'annonces en ligne — sans aucune clé, et avec un en-tête qui autorisait même
n'importe quel site web à la lire. Elle exige maintenant une clé personnelle
(`?k=…`), comparée en temps constant (une comparaison ordinaire s'arrête au
premier caractère faux, ce qui permet de deviner la clé lettre par lettre en
chronométrant les réponses). L'app génère la clé et affiche l'adresse complète
dans **Paramètres → Widget iPhone** : à recopier dans Scriptable.

## Ce qui reste

**Les autres routes `api/`** (`email-inbound`, `ship-reminders`, `push`)
écrivent avec la clé publique et seront bloquées par RLS. Elles ont besoin de
la clé `service_role` et de savoir à quel vendeur rattacher chaque ligne.

**La session est stockée dans le navigateur** (`localStorage`), comme le fait
la bibliothèque officielle de Supabase. C'est lisible par un script malveillant
qui parviendrait à s'exécuter sur la page. S'en protéger vraiment demanderait
des cookies posés par un serveur — un vrai changement d'architecture, à
envisager le jour où l'app gère l'argent d'inconnus.

**Le proxy Vinted** (`api/vinted-proxy.js`) accepte un jeton fourni par
l'appelant et le relaie à Vinted. Il ne fuit rien (il faut déjà posséder le
jeton), mais n'importe qui peut s'en servir comme relais. À restreindre aux
appels authentifiés quand le multi-vendeurs sera actif.

---

# ⚠️ CE QUI RESTE À FAIRE, DANS CET ORDRE (mis à jour)

L'app et l'extension sont **prêtes** : la connexion existe des deux côtés, chaque
écriture sait porter un propriétaire, et l'app **sonde l'état réel** (Réglages →
Sécurité des données). Il reste **trois gestes**, et **l'ordre compte** — la
migration en dernier, sinon des données arrivent pendant que la porte est fermée.

### 1. Régler les deux variables d'environnement Vercel (AVANT la migration)
`Vercel → le projet → Settings → Environment Variables` :

| variable | valeur | pourquoi |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** | Les routes `api/*` (emails entrants, rappels d'expédition, notifications) tournent **sans vendeur connecté**. Dès que RLS est actif, la clé publique ne peut plus rien écrire : sans cette clé, **un email reçu la nuit est silencieusement perdu**. |
| `VRM_OWNER_UID` | `74eea6e7-f060-46b6-b9c7-d500cedf4738` | La clé de service contourne RLS mais **ne devine pas à qui la ligne est destinée**. Sans ça, les lignes écrites par le serveur n'appartiennent à personne — donc invisibles pour toi. |

⚠️ Ne JAMAIS mettre la clé service_role dans le dépôt ni dans l'extension : elle
contourne toutes les protections. Variable d'environnement uniquement.

**Vérification** : `https://vrm.center/api/sante` doit répondre
`{"serviceKey":true,"owner":true}`. C'est aussi affiché dans **Réglages →
Sécurité des données → « Routes serveur »**, qui passe de « clé de service
manquante » à « prêtes ».

### 2. Passer la migration SQL
`Supabase → SQL Editor` → coller `supabase/migrations/001-multi-utilisateurs.sql`
(le bouton **📋 Copier la migration SQL** de Réglages → Sécurité des données le
met dans le presse-papier, pris directement dans le fichier). L'étape 2 du script
attribue les lignes existantes à `VRM_OWNER_UID`.

### 3. Vérifier — sans rien croire sur parole
Réglages → **Sécurité des données** sonde la base en direct à chaque ouverture :

| ligne | avant | après |
|---|---|---|
| Propriétaire des lignes | ⚠️ colonne absente | ✅ colonne présente |
| **Lecture sans compte** | ⚠️ **tout est lisible** | ✅ fermée |
| Routes serveur | ⚠️ clé manquante | ✅ prêtes |

⚠️ **La ligne qui compte est « Lecture sans compte »** : la colonne `owner` seule
ne protège rien. Tant qu'une lecture avec la clé publique (celle qui est dans le
code, donc connue de tous) ramène des lignes, **tout est lisible par n'importe
qui**. C'est RLS qui ferme la porte, pas la colonne.

Dès que la base est cloisonnée, l'app **bascule toute seule** : l'écran de
connexion devient obligatoire, la porte « entrer sans compte » disparaît, et
l'extension écrit sous le compte connecté (sa fenêtre → **Compte VRM**).

### Ce qui restera vrai après (limite assumée)
`VRM_OWNER_UID` couvre **une installation = un vendeur**. Pour héberger
plusieurs vendeurs sur la même instance, il faudra rattacher chaque **email
entrant** à un vendeur (par l'adresse de réception) : les emails arrivent sans
session, rien dans le message ne dit à qui il appartient. C'est un chantier à
part, pas une variable d'environnement.
