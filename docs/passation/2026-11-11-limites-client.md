# 11 novembre 2026 — Limites par client (branche `claude/agent2-limites-client`, second agent)

Validé par Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app pour les autres ».
Rien fusionné sur `main` (l'agent principal intègre). Pas d'extension. Toujours 12 fonctions `api/`.

## 1. Mesure (données inventées, jamais la base réelle)

Un vendeur INVENTÉ (`scripts/bancs/_gros-client.cjs`) : 10 comptes, 5 000 annonces numérotées,
20 000 ventes (2 000 transactions lues), 3 000 e-mails (ventes, bordereaux, suivis), à la vraie
forme des lignes (`harvest_*`, `resume` de l'extension, `email_*`, `main`).

**Côté app** — `scripts/bancs/limites-client.cjs` (Chromium, 1512 px et 390 px tactile) : éléments
du DOM, tâches longues, tas JS, par écran.

| écran (1512 px) | DOM avant | DOM après | tâches longues avant | après |
|---|---|---|---|---|
| Annonces | **451 021** (page figée, capture impossible) | **6 992** | 38 489 ms | ~13 000–21 000 ms |
| Ma journée | 513 | 513 | 10 947 ms | idem |
| Ventes | 4 895 | 4 895 | 9 016 ms | idem |
| Stock | 237 | 237 | 855 ms | idem |
| Achats | 351 | 351 | 6 927 ms | idem |
| Messages | 770 | 770 | 7 246 ms | idem |

(390 px : Annonces 450 974 → 6 980.) Seule Annonces rendait une liste non bornée (les 5 000
fiches d'un coup, ~90 éléments chacune). Les autres écrans étaient déjà bornés.

**Côté serveur** — `scripts/charge/gros-client.cjs` (vraies routes, faux PostgREST de `scripts/charge/`) :
1 gros + 9 vendeurs « type ».

| | gros | petit (moyenne) |
|---|---|---|
| cron du matin : Ko lus | 9 899 | 6 635 |
| cron du soir : Ko lus | 606 | 192 |
| widget : Ko lus / réponse | 318 / 1 | 73 / 1 |

Trouvé en mesurant :
- **Widget en panne pour un vendeur à exactement 1 000 e-mails de vente** : la page suivante répond
  416 (`Content-Range: */1000`) et `fetchPaginated` prenait ça pour une panne ⇒ 503 « base
  injoignable ». Même lecteur dans `ship-reminders`, `etiquettes-vendeur`, `transporteurs-lecture`.
- **Le cron attendait un vendeur aussi longtemps qu'il le fallait** : un gros vendeur lent (base qui
  peine sur ses lignes) gardait la fonction ouverte au-delà de la coupure nette de Vercel ; le
  curseur final n'était jamais écrit ⇒ les petits, déjà servis, n'étaient notés nulle part.
- Aucun frein par vendeur sur les routes coûteuses ; aucun moyen de voir qui pèse quoi.

## 2. Bornes posées (rien n'est caché)

1. **Annonces par paquets** (`src/composants/SuitePaquets.jsx`, `groupesBornes`) : 72 fiches, dans
   l'ordre et le tri de toujours ; « 72 sur 5 000 annonces » écrit ; la suite arrive toute seule en
   approchant du bas (IntersectionObserver), bouton « Voir les 72 suivantes » sinon (44 px) ; un
   autre tri ou une recherche repart du haut ; la recherche porte sur TOUTE la liste. En-tête de
   chaque compte : son total complet.
2. **Cron : temps d'un vendeur borné** (`api/_lib/cron-lots.js`, `TEMPS_VENDEUR_MS` = 60 s,
   `VRM_CRON_VENDEUR_MS`) : au-delà, le vendeur est REPORTÉ (jamais noté « fait »), sa place passe
   au suivant, il est repris au passage suivant (relance du jour ou lendemain en premier) ; son
   travail lancé finit seul (mémos ⇒ aucun doublon). Réponse : `lot.reportes`, `bilans[].ms`.
   Fusionné avec la règle d'`origin/main` (un vendeur en échec n'est pas « fait » non plus).
3. **416 à la frontière = fin de liste** (`finALaFrontiere`, `api/_lib/ordre-stable.js`) dans les 4
   lecteurs paginés ci-dessus.
4. **Débit par vendeur** (`api/_lib/debit-vendeur.js`) : widget 12/min et 120/h, envoi léger des
   ventes (`/api/compte?mode=commandes`) 40/min et 400/h ; fenêtre glissante en mémoire de
   l'instance (aucune lecture de base en plus) ; refus = **429** + `Retry-After` + « Trop de demandes
   d'un coup. Réessaie dans 60 s. ». L'extension lit un 429 comme « rien rangé, au prochain passage »
   (pas la voie de secours : seuls réseau/5xx y mènent, vérifié dans `background.js`).
5. **Usage par vendeur dans « Ton entreprise »** (tableau du propriétaire) : lignes, Mo stockés,
   part, les plus gros d'abord, 20 au plus, étiquette anonyme « V-3fa9c2 » (empreinte, jamais un
   identifiant) ; le propriétaire et le neutre à part. Source : `rpc/vrm_usage_vendeurs`
   (**migration 040**, lecture seule, clé de service seule). Sans elle : « — Pas su : migration 040
   pas appliquée » ; base en panne : « — la base n'a pas répondu ».

## 3. Preuves

- `node scripts/audit-limites-client.cjs` : 13 verts. Sur `origin/main` (git archive) : **12 rouges**
  (C1 coupé à 30 s, 0/9 petits notés, gros pas reporté, widget 503 à 1 000 lignes, aucun 429, pas
  d'usage). `--prouve` : **8/8 mutations** attrapées.
  C1-C4 : 1 gros (chaque requête +800 ms) + 9 petits, coupure à 30 s : le cron répond, 9/9 servis et
  notés, le gros reporté puis repris à la relance sans refaire un petit. W1-W2 : 1 000 vs 1 001
  e-mails, même compte. D1-D3 : 12 servis puis 429, un autre vendeur servi. U1-U3 : usage anonyme,
  migration absente dite, panne = null.
- `scripts/bancs/limites-client.cjs` : DOM ≤ 9 000 sur 6 écrans × 2 largeurs ; A1 « 72 sur 5 000 »,
  A2 la suite arrive en descendant (72 → 144), A3 la recherche trouve N°4999, A4 sans
  IntersectionObserver le bouton ajoute 72 (capture sombre). Avant : Annonces 451 021 éléments
  (`BANC_MESURE=1`). Les tâches longues sont rapportées, pas jugées (trop sensibles à la machine).
- Captures regardées : grille 390/1512, la suite, la recherche, le bloc « Usage par vendeur ».

## 4. Pour l'agent principal (hors zone, NOTÉ seulement)

- **budget-vitesse / chargement-leger** : avec ce gros client, chaque écran coûte 7–19 s de tâches
  longues au démarrage (calculs sur 20 000 ventes) ; profil (sourcemaps) : pas un point chaud unique,
  des dizaines de `useMemo` de `Comptabilite` (chacun 0,1–0,9 s), `acctOff`/`compteEcarteChoix`
  appelé par vente, `photoArticle`. Tas JS jusqu'à ~700 Mo à 390 px après plusieurs écrans.
- Les autres lecteurs paginés serveur (`email-inbound` l. 895, `email-rattacher`, `relances-essai`,
  `clients-partis`, `mesures-terrain`, `pilotage`) ont la même fin de boucle sans le cas 416 :
  `finALaFrontiere` est prête à y être posée.
- Le débit est par instance : un quota exact entre instances = `prendreQuota` (CAS, coûte 2 requêtes).

## 5. Gestes de Julien

- Appliquer `supabase/migrations/040-usage-par-vendeur.sql` (éditeur SQL Supabase, lecture seule)
  pour voir l'usage par vendeur. Sans elle, rien ne casse : le bloc dit « — ».
