# 9 nov. 2026 — Charge à 1 000 vendeurs, banc local, sauvegarde vérifiée

Branche `claude/charge-sauvegarde` (depuis `origin/main`, `main` refusionné par un vrai
merge). Rien n'a touché la production : base inventée au poids de celle de Julien
(`scripts/bancs/_base-volume.cjs`), servie par un faux PostgREST local ; tout `fetch`
vers une autre adresse est refusé et compté (Chronopost tenté par le cron : refusé).

## 1. Le banc de charge — `scripts/charge/`

| fichier | quoi |
|---|---|
| `_faux-postgrest.cjs` | N vendeurs (le gabarit de `_base-volume`, sous SON owner, partagé en mémoire), RLS par jeton `jeton-<owner>`, clé de service, filtres/projection/`meta` (règle SQL de la 004), `Range` plafonné à 1 000, POST/PATCH/DELETE. Compte requêtes et octets par famille, par vendeur, par APPEL (AsyncLocalStorage). `resume: 'dates' \| 'txns' \| 'aucun'`. |
| `_routes.cjs` | exécute les VRAIES routes `api/*` dans le processus (env de banc, aucune clé VAPID/SMTP), sème clé de widget indexée + adresse prouvée |
| `_app.cjs` | démarrage de l'app (`dist/`, Chromium headless, k vendeurs en même temps, 2e ouverture par défaut) |
| `banc-charge.cjs` | `--vendeurs N --conc C --emails E --app k --json f` : cron matin/soir, widget, e-mails (ancien registre), app |
| `modele.cjs` | le modèle (coûts unitaires mesurés × hypothèses d'usage écrites dans le fichier) ; `--avant`, `--adresse-unique` |

Mesuré à 100 vendeurs (`--app 3`, 461 s) — par vendeur « gros » (7 comptes) :

| quoi | requêtes | Ko envoyés par la base | avant ce chantier |
|---|---|---|---|
| ouverture de l'app (2e, Ma journée) | 89 | 2 118 (dont listes de ventes/achats 1 261) | idem |
| widget, un rafraîchissement | 23 | **73** | **717** |
| cron du soir | 41 | **161** | **886** |
| cron du matin (un lundi : bilan de la semaine) | 112 | **1 319** | **2 018** |
| un e-mail reçu (voie du registre) | 15 | 7 + **0,37 × N** (110 Ko à 300 vendeurs) | idem |

⚠️ Le faux PostgREST tourne dans le même processus : les DURÉES (cron 1,6 s/vendeur,
widget p50 6,6 s à 8 en parallèle) mesurent surtout le processeur du banc, pas Supabase.
Les NOMBRES de requêtes et d'octets, eux, sont ceux du code.

Défaut du banc trouvé et corrigé en route : `select=*` sur `vinted_accounts` rendait la
forme d'`app_data` (sans `vinted_user_id`) ⇒ l'app relisait tout par motif (+720 Ko) — ce
n'était PAS un défaut de l'app.

## 2. Le modèle (quotas lus le 9 nov. 2026)

Sources : supabase.com/pricing (Pro 25 $ : 8 Go de disque puis 0,125 $/Go, 250 Go d'égress
puis 0,09 $/Go, 100 Go de fichiers, Micro inclus 1 Go RAM / 60 connexions directes / 200
pooler, sauvegarde quotidienne 7 j, PITR ≈ 100 $/mois) ; vercel.com/pricing (Hobby :
1 M invocations, 4 h de CPU actif, 100 Go de transfert, pas de dépassement possible ;
Pro 20 $ + usage : 0,60 $/M invocations, 0,128 $/h CPU) ; vercel.com/docs/limits (Hobby
100 déploiements/jour, durée max 300 s ; Pro 6 000/jour, 800 s) ; cron Hobby une fois par
jour à ±59 min, Pro à la minute.

Hypothèses (dans `modele.cjs`, à corriger avec les vrais journaux) : un vendeur type =
0,35 × Julien ; 6 ouvertures/jour ; widget chez la moitié, 48 rafraîchissements ; 15 e-mails ;
120 appels `/api/*` ; relectures de fond et extension ESTIMÉES (6 Mo et 5 Mo/jour pour un gros).

**Où ça casse** (après ce chantier ; avant entre parenthèses) :

| quota | casse vers |
|---|---|
| Vercel Hobby, 4 h de CPU actif/mois (estimé) | **~70 vendeurs** (70) |
| Vercel Hobby, 1 M invocations/mois | **~210** (210) |
| Supabase Micro (~30 req/s soutenues, estimé) | **~400** (400) |
| Supabase Pro, 250 Go d'égress/mois | **~670** (490) ; **~940** avec l'adresse de réception unique |
| Cron (une fonction, budget 240 s) | **~800** (le reste passe le lendemain, en premier) |
| Supabase Pro, 8 Go de disque | **~1 750** (si la purge des bordereaux tourne) |

**Les 5 plus gros consommateurs d'égress à 1 000 vendeurs** (par vendeur type et par jour) :
1. **le registre des adresses e-mail** — chaque e-mail relit les adresses et preuves de
   TOUS les vendeurs : 15 × 0,37 Ko × 1 000 ≈ 5,5 Mo (croît comme N²). Remède déjà écrit :
   l'adresse de réception unique (8 nov.) — geste de Julien `DOMAINE_RECEPTION`.
2. **l'ouverture de l'app** : 6 × 2,1 Mo × 0,35 ≈ 4,4 Mo, dont 60 % les listes de
   ventes/achats elles-mêmes ;
3. **le widget** : 24 × 717 Ko × 0,35 ≈ 6 Mo **avant**, ≈ 0,6 Mo après ;
4. les relectures de fond de l'app (~2 Mo, estimé) ;
5. l'extension (~1,8 Mo, estimé) ; les deux crons (≈ 0,75 Mo avant, 0,26 Mo après).

**Coût mensuel estimé** (Supabase Pro + Vercel Pro + Brevo Starter dès 100) :
100 vendeurs ≈ **54 $** · 500 ≈ **69 $** (70 avant) · 1 000 ≈ **85 $** (100 avant), dont la
machine Small (+15 $) au-delà de ~400 vendeurs et l'égress au-delà de 250 Go. Vercel
Hobby est hors jeu dès ~70 vendeurs actifs : Pro est obligatoire.

## 3. Ce qui a été réduit (2 des 3 plus gros, le 3e proposé)

1. **Le widget** (`api/widget.js`) : la date des ventes à expédier vient du RÉSUMÉ de la
   ligne (`resume.dates`), la liste entière n'est relue que pour une vente sans date. 717 → 73 Ko.
2. **Les rappels du matin et du soir** (`api/ship-reminders.js`, `lireDonneesColis`) :
   le résumé seul d'abord ; listes entières seulement si un compte lié n'a pas de résumé,
   si une vente vue par e-mail est à juger (TOUTES, comme avant), ou pour les seuls
   comptes d'une vente sans date. Soir 886 → 161 Ko, matin −700 Ko. Le bilan de la
   semaine/du mois garde la lecture complète (il compte les ventes).
3. **Le serveur pose les dates** (`api/_lib/commandes-leger.js`) : `resume.dates =
   { n° : date }` pour les ventes à expédier (même commande, date lisible seulement).
   ⚠️ Seulement par la voie « léger » (extension ≥ 5.326) : une ligne écrite par une
   extension plus ancienne n'a pas de dates ⇒ lecture d'avant, rien ne change pour elle.
   Aucune extension à réinstaller pour ce chantier.

Preuve : `scripts/audit-charge-rappels.cjs` (18 contrôles) exécute les vraies routes sur
deux bases identiques sauf le résumé : MÊMES réponses (widget, soir, matin, vente vue par
e-mail : 71 colis au lieu de 70) avec bien moins d'octets ; **4 rouges sur origin/main**
(arbre extrait par `git archive`) ; `--prouve` 7/7 mutations attrapées.

**Proposé, pas fait :**
- l'ouverture de l'app (2,1 Mo, dont 1,26 Mo de listes) : un cache des listes par
  appareil validé par `data.rev` (posé par la voie léger) — un « instantané » touche les
  publieurs uniques (§5), il demande sa décision ;
- le registre des e-mails : rendre l'adresse unique OBLIGATOIRE pour les nouveaux vendeurs
  (geste `DOMAINE_RECEPTION`), puis un index par adresse pour l'ancienne voie ;
- le relais de l'extension (une lecture toutes les 30 s + un battement par minute par
  Chrome ouvert, ~1 800 requêtes/jour) : ne lire que si le téléphone a écrit une commande
  récente — changement d'extension, à faire avec une version ;
- purger côté serveur les PDF de bordereaux des ventes finalisées (la règle de Julien
  du 4 oct. ne tourne que dans l'extension, à sa visite) — destructif, sa décision.

## 4. Sauvegarde vérifiée

`docs/sauvegarde-restauration.md` (Gratuit = aucune sauvegarde ; Pro = quotidienne 7 j ;
PITR ; restaurer dans un projet NEUF d'abord) et `scripts/sauvegarde/verifier-restauration.mjs`
(LECTURE SEULE : GET uniquement ; par vendeur : comptes Vinted, lignes, familles, empreinte
des identifiants, de `main` et des NUMÉROS ; aucun contenu affiché ; 0/1/2).
`scripts/audit-sauvegarde-verifier.cjs` : 10 contrôles sur deux faux PostgREST HTTP,
`--prouve` 5/5.

## 5. Preuves lancées

`npm run build` ; audits verts : charge-rappels, sauvegarde-verifier, fonctions-api,
variables, tdz, coherence, ventes-envoi-leger, cron-lots, jeton-index, cle-service,
pagination-ordre, statuts et les 32 audits qui touchent le widget ou les rappels
(a-envoyer-preuves, bilan-semaine, bilan-mois, colis-ventes-email, routes-revue, suivi-colis…).

## 6. Gestes de Julien

1. **Supabase Pro** (sans lui : AUCUNE sauvegarde), puis une fois par mois la
   vérification de `docs/sauvegarde-restauration.md`.
2. **Vercel Pro** avant ~70 vendeurs actifs.
3. **`DOMAINE_RECEPTION`** (adresse unique) avant ~300 vendeurs : c'est le premier
   consommateur d'égress à 1 000.
