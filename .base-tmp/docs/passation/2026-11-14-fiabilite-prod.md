# 14 nov. 2026 — Fiabilité : ce qui casse VRAIMENT en production

Branche `claude/fiabilite-prod`. Mesures faites en LECTURE SEULE (aucune écriture en base) :
journaux de la base (`edge_logs`, `postgres_logs`, `auth_logs`, jour par jour du 7 au 14 nov.),
lignes que l'app range elle-même (`plantage_*`, `plantages_terrain_*`, `alertes_production`,
`mesures_jour_*`, `ext_appareil_*`, projetées, jamais `select=data`), conseils Supabase
(sécurité, performance), Vercel (erreurs d'exécution 7 j : aucune ; journaux : 1 h retenue
seulement sur Hobby), `/api/sante` et les passages GitHub des sondes. Aucune donnée personnelle
ci-dessous.

## Ce qui a été trouvé, classé (fréquence × gravité)

| # | erreur | fréquence mesurée | gravité | cause racine | correctif | preuve | geste de Julien |
|---|---|---|---|---|---|---|---|
| 1 | « undefined is not an object (evaluating 'e.FactureVente') », « Cannot read properties of undefined (reading 'default') », « f._result.default » — écran tombé, alerte « Un écran est tombé » | **64 écrans tombés du 10 au 12 nov.** (60 d'un coup sur Ventes, iOS Safari), 4 messages distincts sur 6 dans `plantage_*` ; et `mesures_jour_*` compte 8 morceaux périmés le 13 nov. | écran en erreur + fausse alerte | `src/main.jsx` appelait `ev.preventDefault()` sur `vite:preloadError` : le `preload` de Vite rend alors **`undefined` à la place du module** (`baseModule().catch(handlePreloadError)`), et `React.lazy` / `.then((m) => ({ default: m.X }))` lisent `undefined` | plus de `preventDefault` : l'import est rejeté avec sa vraie raison (morceau périmé, compté à part), la page se recharge quand même | `audit-morceau-perime` exécute le VRAI `preload` de node_modules/vite : rouge sur le code d'avant (« reading 'FactureVente' »), 7/7 mutations ; banc `morceau-perime` (rechargement lent 2,5 s + « CSS déjà là ») rouge sur le build d'avant (390 px, « reading 'default' »), vert après | aucun |
| 2 | lectures refusées 401 « token is expired », routes `/api/` qui relisent une session expirée (GET /auth/v1/user 403) | **100 à 150 par jour** depuis vrm.center (Mac, iPhone), par rafales au réveil (39 dans la même seconde) | « — » à l'écran (pas su), lenteur | `sbAuth` voit le jeton mort, lance le renouvellement… et rend l'ANCIEN jeton à la requête qui part | `src/jetonFrais.js`, posé une fois sur `window.fetch` (App.jsx) : une requête vers la base ou `/api/` qui porte un jeton expiré attend le renouvellement partagé (≤ 8 s) ; un 401 de la base ⇒ un renouvellement, une relance (PostgREST n'exécute rien sur un 401) ; `/api/` jamais relancé | `audit-jeton-frais` 10/10 mutations ; banc `session-reveil` E (veille de 2 h simulée) : **33/58 requêtes refusées sans la règle, 0 avec** | aucun |
| 3 | vrm.center/statut « pas su — sondes arrêtées » sur les six morceaux presque toute la journée | GitHub n'a lancé `sondes-statut.yml` (« toutes les 10 min ») que **17 fois du 9 au 14 nov.** (au lieu de ~700) ; relevé le 14 nov. 08:13 : dernier passage 05:37 | page d'état fausse (« pas su » permanent) | le planificateur de GitHub laisse tomber les tâches | `/api/sante` relance la route du cron (`/api/ship-reminders?moment=sondes`, son secret, adresse FIXE du site) quand l'état a plus de 15 min, une fois par 10 min et par instance, puis relit (`relancerSondesSiVieilles`, api/_lib/statut-sondes.js) | `audit-sondes-relance` EXÉCUTE la vraie route /api/sante : R1–R5, 7/7 mutations ; `audit-statut-auto` reste vert | aucun (CRON_SECRET déjà posé sur Vercel) |
| 4 | « vrm-hors-ligne » noté comme plantage (promesse non tenue, Réglages → Ventes) | 1 (10 nov.) | bruit dans la veille | le refus VOULU de la garde hors ligne (`CODE_HORS_LIGNE`) n'était pas dans `BRUIT` | ajouté à `BRUIT` (src/plantages.js), comme « Failed to fetch » | `audit-veille-plantages` A2 (mutation rouge) | aucun |
| 5 | des bancs joignaient la vraie base | **90 000 à 150 000 requêtes 401 par jour du 9 au 12 nov.** (corrigé le 11–13 nov. par la garde réseau) ; il restait ~240 OPTIONS + ~10 PATCH `main` par jour (bancs WebKit en CI, `localhost:10033/10038`) | risque (écriture d'un banc en prod), bruit, quota | l'envoi de sortie de l'app (`pagehide` ⇒ PATCH `keepalive`) survit à la page : les routes de Playwright ne le voient pas | la garde réseau (`_garde-reseau.cjs`) retire `keepalive` (et `sendBeacon`) vers la production DANS la page | banc `garde-keepalive` (piège TCP local sur le nom de la base) : 3/3 rouges sans la règle, 3/3 verts avec | aucun |

## Vu, pas corrigé ici (avec la raison)

- **`rpc/vrm_equipe_lister` 404** (20–40/jour, serveur) : la migration 016 n'est pas appliquée ;
  la route le traite déjà (« pas installé »). Geste de Julien déjà listé (migration 016).
- **`rpc/vrm_form_*` 404** (2/jour) : migration 032 (formateurs) pas appliquée. Geste : appliquer
  `supabase/migrations/032-communaute-formateurs.sql` si les formateurs doivent servir.
- **GET `/rest/v1/app_data` 401, user-agent « Mozilla/5.0 (compatible) », sans filtre** (≈ 5 la nuit) :
  l'ancien script Gmail avec l'ancienne clé — c'est le geste déjà listé (recoller
  `scripts/gmail-forwarder.gs`). Il demande la table ENTIÈRE : à faire vite.
- **`rpc/vrm_ebay_cibles` 404 (~150/jour) et `abonnements` 400 (22/jour)** jusqu'au 10 nov. :
  disparus depuis (migrations 026 / colonnes appliquées).
- **Extension Firefox : rafales de 401** (18–58 lectures en 1–2 min) : elle renouvelle puis
  reprend (vu dans les journaux) ; corriger demande une version d'extension — pas fait ici.
- **CSP `connect.facebook.net`** (2 en 14 j) : script injecté par le navigateur intégré
  d'Instagram/Facebook, pas par VRM ; laissé tel quel (la politique fait son travail).
- **`reseau-instable` : « garde réseau » rouge et F instable** : la garde compte comme
  « production » l'`abort('connectionreset')` du banc lui-même (scénario E « réponse perdue ») —
  faux positif d'avant ce chantier (même rouge sur le build de départ) ; F tombe 1 fois sur 3
  sous une charge de 70–85 (mesuré pareil sur le build de départ).
- `main` est réécrite ~157 fois par jour à ~390 Ko (62 Mo envoyés par jour) : pas une erreur
  mesurée (aucun 5xx, aucun délai dépassé), à alléger dans un chantier à part.
- Conseils Supabase : rien de nouveau (fonctions SECURITY DEFINER voulues, politiques
  multiples connues, index inutilisés).

## Vérifié

`npm run build`, audits tdz, variables, coherence, csp, fonctions-api, identite, urssaf,
traduction, bancs, statut-auto, sante-publique, sante-donnees, alertes-production,
gestes/journee-hors-ligne, sans-session-envoi, lancement, limites-client : verts. Bancs
`session-reveil`, `morceau-perime`, `garde-keepalive`, `robustesse-donnees` (3/4 verts, le 4ᵉ
sous charge), `reseau-instable` D seul vert.
