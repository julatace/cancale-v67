# Publier sur eBay depuis VRM (API officielle) — ce que TU dois faire

L'objectif : publier tes annonces directement sur eBay depuis VRM, via l'**API
officielle Sell** d'eBay (mieux que le remplissage de formulaire par l'extension).

Le code de base côté serveur est prêt et vérifié (`api/ebay.js` : authentification
OAuth, jetons rangés côté serveur, jamais dans le dépôt public). Il reste **3
choses que toi seul peux faire** (comptes, secrets), puis je branche la suite.

---

## 1. Coller tes clés eBay dans Vercel (2 min)

Vercel → projet **cancale-v67** → **Settings → Environment Variables**. Ajoute
(coche **Production**, Preview et Development ; type **Sensitive/Secret**) :

| Name | Value |
|---|---|
| `EBAY_APP_ID` | ton App ID (Client ID) |
| `EBAY_DEV_ID` | ton Dev ID |
| `EBAY_CERT_ID` | ton **Cert ID** (Client Secret) — le seul vraiment secret |

⚠️ Le Cert ID ayant été affiché dans un chat, l'idéal est de le **régénérer**
sur eBay (*My Keys → VRM → nouveau Cert ID*) et de coller le **nouveau** ici.
Ne colle jamais un secret ailleurs que dans Vercel.

## 2. Créer le « RuName » (URL de redirection) dans le portail eBay

C'est l'adresse où eBay te renvoie après que tu aies autorisé ton compte. eBay
l'exige pour l'OAuth.

1. developer.ebay.com → **My Account** (ou *User Tokens*) → section
   **Get a Token from eBay via Your Application** → **redirect settings**.
2. Crée un RuName. Comme URL d'acceptation, mets :
   `https://vrm.center/api/ebay-callback` (page d'accueil OK au début).
3. eBay te donne une chaîne **RuName** (ex. `David_Fournier-davidfou-VRM-abcde`).
   Copie-la dans Vercel :

| Name | Value |
|---|---|
| `EBAY_RUNAME` | le RuName copié |

## 3. Vérifier que le stockage des jetons est possible

Le refresh_token de ton compte vendeur est rangé **côté serveur** (Supabase),
jamais dans le navigateur. Il faut donc que `SUPABASE_SERVICE_KEY` soit posée
dans Vercel (elle sert déjà aux emails). Si elle y est déjà, rien à faire.

## 4. Ton compte eBay doit être validé

Ton compte vendeur était **en vérification**. Tant qu'eBay ne l'a pas validé, la
publication réelle peut être refusée — c'est côté eBay, pas VRM.

---

## Ce que VRM fait ensuite (mon travail)

- **Déjà fait et vérifié au banc** (`scripts/bancs/ebay-api.cjs`) : la route
  `api/ebay` s'authentifie avec tes clés (cachées côté serveur), fabrique l'URL
  de consentement, échange le code contre les jetons, range le refresh_token, et
  **ne ment jamais sur un échec** (503 sans clés, remonte un refus eBay).
- **Prochaine étape, une fois 1→4 faits** : un bouton « Connecter mon compte
  eBay » dans VRM (tu autorises sur la page d'eBay — aucun mot de passe ne passe
  par VRM), puis la **publication** des annonces cochées.
- ⚠️ La publication ne sera écrite qu'après avoir **mesuré les vraies réponses**
  de l'API eBay (catégories, aspects) — comme pour Leboncoin, on ne publie pas à
  l'aveugle : un mauvais attribut sur une annonce publiée est le plus coûteux.

Quand 1→4 sont faits, dis-moi **« eBay prêt »** — je branche la connexion.
