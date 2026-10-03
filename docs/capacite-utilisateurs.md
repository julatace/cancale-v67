# Combien d'utilisateurs la base tient — note de passation

*Écrit le 3 octobre 2026. Question de Julien : « on peut avoir combien
d'utilisateurs sans que ça bugge ? ». Ceci est un CONSTAT mesuré + une estimation
bornée, pas un nombre inventé. C'est le domaine de la session « fiabilité /
1000 utilisateurs » — à elle de trancher les leviers.*

## Mesuré aujourd'hui (lecture seule, clé anon, sans session)
- `GET app_data` et `GET vinted_accounts` renvoient **`[]` en 200** sans session.
  ⇒ **Le cloisonnement RLS est ACTIF** (migration `004-meta-et-rls-rapide.sql`
  passée). Le trou de sécurité du 12 septembre (la clé publique lisait tout,
  jetons Vinted compris) est **fermé**. Corollaire : on ne peut plus mesurer les
  volumes depuis l'extérieur sans un jeton de session — les chiffres ci-dessous
  viennent donc du dossier (mesures sur le compte de Julien), pas d'une sonde
  live.

## Mesuré au dashboard le 3 octobre (Julien quasiment seul sur la base)
- **Compute : CPU 62 %, Disk IO 62 %, Mémoire 16 %** — avec **un seul** vrai
  utilisateur. Le compute tourne déjà à ~60 % à vide d'autres vendeurs : très peu
  de marge. La RAM, elle, va bien (16 %).
- **Instance = Nano** (le plus petit tier, 0,5 Go RAM, partagé) — le dashboard
  propose un **« Free Upgrade » vers Micro** (1 Go), inclus dans le plan Pro, **non
  pris**. À faire : gratuit, double la RAM.
- **Disque : 0,5 Go utilisé / 2 Go** provisionnés (auto-extensible à 8 Go). DB
  212 Mo + WAL 128 Mo + système 168 Mo. **La taille n'est pas le problème.**

### Tiers compute → actifs SIMULTANÉS (estimation ancrée sur 62 %/1 user)
| tier | RAM | ~€/mois | simultanés réalistes |
|---|---|---|---|
| Nano (actuel) | 0,5 Go partagé | inclus | ~2-4 |
| Micro (upgrade gratuit) | 1 Go partagé | 0 € | ~4-6 |
| Small | 2 Go partagé | ~15 € | ~10-15 |
| Medium | 4 Go partagé | ~60 € | ~25-40 |
| Large (dédié 2 vCPU) | 8 Go | ~110 € | dizaines à ~100 |

⚠️ Estimations : le seul point **mesuré** est « 62 % CPU à 1 user sur Nano ». Un
vrai test de charge donnerait mieux, mais on ne le lance pas contre la prod.
Le **Disk IO à 62 %** vient en bonne partie des gros PDF lus/écrits en base →
levier « PDF vers Storage ».

## Poids par utilisateur (mesuré sur Julien = cas LOURD, 9 comptes Vinted)
- ~**6 000 lignes** `app_data` (5 959 le 3 octobre, §5.134).
- Taille dominée par **les PDF et les transactions** :
  - `email_bord_*` : ~139 bordereaux avec PDF (~100–200 Ko pièce) ≈ **15–28 Mo**
  - `txn` : ~700 lignes × 29 Ko ≈ **20 Mo**
  - `conv` : ~939 × 4,6 Ko ≈ **4 Mo** · `label_latest` : 7 × 237 Ko ≈ **1,6 Mo**
  - `main` 197 Ko · listings/items/coffre : quelques Mo
  - **Total ≈ 50–70 Mo** pour un gros vendeur.
- Un utilisateur **normal** (1–2 comptes, moins de ventes) : estimé **5–15 Mo**.

## Les 3 limites du plan Pro (25 €) et laquelle casse
| limite | inclus | plafond grossier | effet quand dépassé |
|---|---|---|---|
| Disque base | 8 Go | ~120–150 lourds, ou ~600–1 000 normaux | **surcoût** (0,125 $/Go), pas un bug |
| Égress / mois | 250 Go | quelques centaines d'actifs réguliers | **surcoût** (0,09 $/Go) |
| **Compute** (CPU/RAM de l'instance) | petite instance par défaut | **casse en premier** | ralentissement → **522 / DatabaseTimeout** |

## Ce qui bugge en premier : le COMPUTE, sous les actifs SIMULTANÉS
- C'est exactement la panne de septembre (522 Cloudflare / `544 DatabaseTimeout`).
- L'app tire beaucoup de lectures par écran (le dossier mesure ~26 requêtes pour
  un écran lourd, un build panneau à 3,8 s **sur base non chargée**). Sous
  plusieurs actifs simultanés, la petite instance sature avant tout le reste.
- **Distinguer** :
  - **Inscrits** (pas tous connectés en même temps) → plafond = disque/égress =
    **quelques centaines à ~1 000**, et ce sont des **surcoûts €**, pas des bugs.
  - **Actifs EN MÊME TEMPS** → sur la petite instance : ça coince vers
    **quelques dizaines** d'actifs très sollicitants (estimation, à confirmer par
    un vrai test de charge — PAS fait : on ne lance pas de charge contre la prod).

## Déjà fait (session fiabilité) — ça a reculé le plafond
- Colonne `meta` : lire un scalaire sans décompresser la ligne (txn 2 140 → 8 ms).
- RLS `owner = (select auth.uid())` + index `(owner, id text_pattern_ops)`.
- Lectures indépendantes **par lot de 6**, projections `select=` partout (plus de
  `select=data` lourd — celui qui avait crevé 5,7 Go d'égress).
- Cache service worker purgé par version, `/assets/` immutables.

## Les deux leviers qui ouvrent vers « milliers » (à trancher par la session fiabilité)
1. **Monter l'instance compute** (Micro → Small/Medium). 1 clic dans le
   dashboard, quelques dizaines d'€/mois ; multiplie directement les actifs
   simultanés. **C'est le levier n°1** (c'est le compute qui casse).
2. **Sortir les PDF de la base → Supabase Storage.** Les bordereaux (`email_bord_*`,
   `label_latest`, `pdfB64`) dominent le disque ET l'égress à l'impression.
   Les mettre en Storage (URL signée) sort ~20–30 Mo/gros vendeur du disque et
   allège les lectures. Chantier réel (migration + lecture app + `api/*.js`).

## Pour un chiffre FERME (ce qui manque)
Deux relevés dans le dashboard Supabase (30 s chacun, côté Julien) :
1. **Settings → Compute** : quelle instance (Micro / Small / …) → fixe les
   « simultanés ».
2. **Reports → Database** : taille actuelle de la base + égress du mois.
Avec ces deux-là + le poids/utilisateur ci-dessus, le plafond se calcule sans
supposition.

## Ce qu'il ne faut PAS faire
- **Pas de test de charge contre la prod** : ça reproduit la panne 522 pour de
  vrai, et une sonde qui écrit mettrait des données de test en base (§2.3).
- Mesurer le live demande un **jeton de session** (RLS actif) : ne pas
  « dé-cloisonner » pour mesurer — le cloisonnement est la protection qu'on
  vient de gagner.
