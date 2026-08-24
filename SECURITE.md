# Sécurité — état réel, sans enjolivure

Ce document dit ce qui protège les données **aujourd'hui** et ce qui ne les
protège pas. Il est écrit pour qu'on puisse le montrer à quelqu'un qui envisage
de louer l'outil — donc sans rien arrondir.

---

## 1. ⚠️ Le point qui compte : le dépôt est PUBLIC et RLS est DÉSACTIVÉ

| | état |
|---|---|
| dépôt GitHub `julatace/cancale-v67` | **public** |
| colonne `owner` sur `app_data` | **absente** (`select=owner` → 400) |
| RLS (Row Level Security) | **désactivé** |
| clé « anon » Supabase | dans le bundle **et** dans le dépôt |

Une clé anon dans une application web, **c'est normal** : un site ne peut rien
cacher à celui qui l'ouvre. Ce qui rend cette clé inoffensive dans un produit
correctement configuré, c'est **RLS** : la base refuse alors de servir les
lignes qui n'appartiennent pas au demandeur.

**Ici RLS est désactivé.** Donc cette clé n'est pas une clé publique : c'est un
**accès complet en lecture ET en écriture** à toute la base — ventes, achats,
noms d'acheteurs, codes de retrait, et surtout la table `vinted_accounts` qui
contient les **jetons de session Vinted** des comptes reliés.

> Ce n'est pas une hypothèse : toute la mise au point de ce projet a été faite
> en lisant la vraie base avec cette seule clé, extraite du dépôt public.

### Les deux gestes qui referment ça
1. **Passer le dépôt en privé** — un clic, gratuit, réversible, aucun effet sur
   le déploiement Vercel (l'intégration reste autorisée). C'est l'action la plus
   rentable de toute cette page.
2. **Appliquer la migration RLS** — `supabase/migrations/001-multi-utilisateurs.sql`,
   à coller dans l'éditeur SQL Supabase. Mode d'emploi : `supabase/README.md`.
   Après ça, la clé anon ne sert plus qu'à ouvrir une session ; les données sont
   filtrées par Postgres, pas par le JavaScript.

⚠️ **Ordre obligatoire** : migration SQL **d'abord**, `MULTI_USER = true`
**ensuite**. Dans l'autre sens, l'écran de connexion s'affiche devant une base
qui ne sait pas l'honorer — le vendeur se retrouve enfermé hors de son outil.

---

## 2. Ce qui a été retiré du code source

| ce qui traînait | pourquoi c'était grave | état |
|---|---|---|
| **clé privée VAPID** (`ayc_z_…`) | un **vrai secret** : elle permet d'envoyer une notification sur les téléphones du vendeur | **retirée, paire régénérée**, la nouvelle privée vit en variable d'environnement, sans aucun repli |
| email personnel du vendeur | donnée personnelle dans un dépôt ouvert | remplacé par `PUSH_CONTACT` |
| **nom + email + adresse postale d'une vraie cliente** | donnée personnelle d'un **tiers**, publiée | remplacés par des exemples neutres |
| raison sociale + adresse + **SIRET** du vendeur | donnée personnelle, et surtout : un nouveau vendeur ouvrait l'app avec l'entreprise de quelqu'un d'autre pré-remplie sur ses factures | défaut **vide** (`ENTREPRISE_VIDE`), chacun saisit la sienne |

Un contrôle automatique (`scripts/audit-secrets.cjs`) refuse désormais toute
réapparition : il échoue si une clé privée, un email personnel, un SIRET ou une
adresse postale revient dans le code.

---

## 3. Ce qui NE PEUT PAS être un secret (et pourquoi on ne fait pas semblant)

`SUPABASE_URL`, la clé anon et l'URL du script de factures sont **livrées au
navigateur**. Les déplacer dans une variable d'environnement les retire du
dépôt, pas du bundle : n'importe quel visiteur peut encore les lire dans les
outils de développement.

➡️ Les cacher donnerait un **faux sentiment de sécurité**. Ce qui les rend
inoffensives, c'est RLS (§1). Tant que RLS n'est pas actif, le seul vrai rempart
est que le dépôt soit privé — et même alors, quiconque ouvre l'app a la clé.

---

## 4. Ce qui est déjà en place et qui tient

- **`sbAuth()`** — point de passage unique de tous les appels Supabase côté app.
  Aucun `Authorization: Bearer <clé>` écrit à la main ailleurs.
- **`withOwner()`** — toute ligne écrite porte son propriétaire (quand la base
  saura le lire) et son horodatage.
- **`duVendeur()`** (`api/_lib/owner.js`) — la clé de service contourne RLS,
  donc **chaque lecture serveur est cadrée** par vendeur, et seulement si la
  colonne existe.
- **`AsyncLocalStorage`** — le propriétaire résolu d'un email vit dans le
  contexte de la requête, jamais dans une variable de module : deux emails
  traités en parallèle ne peuvent pas se mélanger.
- **Attribution des emails par l'adresse de RÉCEPTION**, jamais par le contenu —
  l'expéditeur et le sujet sont écrits par n'importe qui.
- **`api/widget.js`** exige un jeton, comparé en **temps constant**.
- **Le pont app ↔ extension** vérifie l'origine avant d'accepter une session.
- **OAuth en PKCE**, jamais en implicite (le jeton ne passe pas par l'URL).

---

## 5. Avant de louer l'outil à quelqu'un d'autre

| à faire | par qui |
|---|---|
| dépôt en privé | le propriétaire du dépôt |
| migration RLS appliquée | le propriétaire de la base |
| `VAPID_PRIVATE_KEY` posée sur Vercel | idem |
| `SUPABASE_SERVICE_KEY` posée (les fonctions `api/` écrivent encore avec la clé publique — elles casseront dès que RLS sera actif) | idem |
| `VRM_OWNER_UID` posée (sinon les emails partent en quarantaine une fois la base cloisonnée) | idem |
| `MULTI_USER = true` — **après** la migration, jamais avant | dans le code |

Tant que ces lignes ne sont pas cochées, l'application est un **outil personnel
mono-vendeur**, et il ne faut pas la présenter autrement.
