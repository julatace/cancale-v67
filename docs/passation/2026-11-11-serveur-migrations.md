# Serveur : les restes de la revue qui demandaient la base (11 nov. 2026, second agent)

Branche `claude/agent2-serveur-migrations`, partie de `origin/claude/agent2-familles-serveur`
(pas encore sur `main` : **la branche la CONTIENT**), `origin/main` fusionné. **Pas de PR, pas de
fusion** : l'agent principal intègre. Aucune extension touchée. Toujours 12 fonctions `api/`.

Source : `docs/passation/robustesse/serveur.md` (branche `claude/agent2-robustesse`) et la liste
« Pas fait » de `2026-11-11-familles-serveur.md`.

## Ce qui change

| point | défaut | réglé par | migration ? |
|---|---|---|---|
| **M50** | deux vendeurs relient le même compte Vinted au même instant : le contrôle « déjà relié ailleurs » puis l'upsert n'étaient pas atomiques, les deux passaient | `vrm_vinted_relier` (042) : contrôle + écriture sous un verrou consultatif par compte Vinted ; le second reçoit `deja_relie` ⇒ 409 « Ce compte Vinted est déjà relié à un autre compte VRM », litige noté chez lui, rien d'écrasé. Sans la 042 (404) : chemin d'avant ; et un 409/23505 de l'unicité de la 023 se dit « déjà relié » (avant : 502 « enregistrement impossible ») | 042 (+ la 023, déjà écrite, pour l'extension) |
| **M72** | chaque envoi léger des ventes/achats relisait les 2 000 commandes ENTIÈRES et les réécrivait | `vrm_commandes_lire` rend le SQUELETTE (n° + date de chaque commande) et entières les seules commandes de la fenêtre à comparer ; la fusion (MÊME `appliquerEnvoi`) déplace des tenant-lieu ; `vrm_commandes_ecrire` recompose la liste dans la base (positions + commandes fournies), sous condition `rev` + `capturedAt`, une position fausse arrête tout. Mesuré au banc : lu 11,6 Ko et écrit 2,1 Ko contre 27 Ko la ligne entière (65 commandes ; l'écart grandit avec la ligne). 404 ⇒ chemin d'avant | 042 |
| **H18** | statut d'abonnement : lecture d'`evenement_ts` puis upsert sans condition ; deux webhooks simultanés, l'ancien pouvait écrire en dernier | `ecrireStatut` : PATCH conditionnel `evenement_ts=eq.lu & maj=eq.lu` (chaque écriture change `maj`) ; devancé ⇒ relu et redécidé (l'événement plus récent gagne) ; ligne absente ⇒ INSERT simple, 23505 ⇒ relu. Les replis 028/030 (colonnes absentes) gardés | non |
| **H14** | aucun verrou de passage : cron Vercel + workflow du dépôt (ou rejeu) traitaient les mêmes vendeurs | bail `cron_bail_{moment}` (ligne neutre, `modifierNeutre` = comparer-et-échanger sur `data.rev`) pris pour 330 s, rendu à la fin (seulement s'il porte encore SON jeton) ; un second passage simultané répond 200 `saute: 'passage-en-cours'` sans toucher un vendeur ; un passage coupé net : le bail expire seul ; bail illisible ⇒ passage comme avant (`bail: 'pas-su'` dans la réponse). Tous les moments sauf `sondes` | non |
| **M82** | la file des favoris lisait `data` entier des captures (`…_notifications`, archive, trace) | lecture PROJETÉE (`SEL_FAVORIS` : notifications, identité de la capture, traces natives), au lancement, au tour automatique et pour les autres comptes ; les réglages (petite ligne) restent entiers | non |
| **H28** | `modifierDonnee` eBay relisait la ligne lourde entière à chaque essai devancé (×6) | devancé ⇒ relit la VERSION seule (`data->>rev`) jusqu'à ce qu'elle ne bouge plus, puis la ligne une fois ; 3 lectures entières au plus | non |

## Preuves
- **`scripts/audit-serveur-migrations.cjs`** (24 contrôles) : la 042 dans un **Postgres 16 jetable**
  (rôles, RLS, `auth.uid()` imités) — essai annulé au corps exact, rien ne reste, vérification
  `ok = true` ; **course réelle** de deux sessions psql sur le même compte Vinted (un relié, l'autre
  `deja_relie`) ; la **vraie route** `routeCommandes` exécutée contre la base (ses deux fonctions
  servies par psql au nom du vendeur) : la ligne écrite est **identique** à celle du chemin d'avant
  pour 4 envois (haut de liste, page profonde, empreinte inconnue, lecture complète), aucune lecture
  de la liste entière ; RLS, version périmée, position fausse. Puis le JS sur fausse base : M50 route,
  H18 deux webhooks simultanés, M82, H28. **Rouge sur la branche de départ** (12 rouges, git archive)
  et `--prouve` **11/11 mutations** (les mutations du SQL s'appliquent aussi à l'essai : seuls les
  contrôles de comportement peuvent les voir).
- **`scripts/audit-cron-lots.cjs` L4** (H14, le VRAI cron exécuté) : deux passages simultanés ⇒ un
  seul travaille (50 vendeurs), l'autre « passage en cours » ; bail rendu ; bail échu repris ;
  `--prouve` 12/12 (3 nouvelles mutations).
- `audit-ventes-envoi-leger` vert sur les deux chemins (`VRM_BANC_042=1` sert les fonctions).
- Fausses bases mises à la VRAIE forme (une fonction absente = 404 ; PATCH conditionnel ; filtres
  `id=` et projection) : `audit-abonnement`, `audit-plans-solo-pro`, `audit-robustesse-serveur`,
  `audit-factures-pro-2` (le bail vit sous le propriétaire neutre), `audit-transporteur-anciens`,
  `scripts/bancs/routes-ecriture.cjs`, `scripts/tests/{securite-routes,vinted-connect-extension,favoris-serveur}`.
- Verts : variables, tdz, coherence, identite, icones, fonctions-api (12), secrets,
  familles-serveur, robustesse-serveur, suites-serveur, deja-relie, cle-service, ebay-*, les 44
  audits qui exécutent `ship-reminders.js`.

## Geste de Julien (Supabase → SQL Editor, trois blocs, dans cet ordre)
1. `scripts/serveur-migrations-sql/essai-annule.sql` — attendu : une ligne
   `{"fn":3,"relier":"invalide","lire":null,"ecrire":0,"service":true,"anon":false}` puis `fn_reste = 0`.
2. `supabase/migrations/042-ecritures-atomiques.sql`.
3. `scripts/serveur-migrations-sql/verifier.sql` — attendu : `ok = true`.

Tant que la 042 n'est pas passée, tout marche comme avant (le serveur reçoit 404 et prend l'ancien
chemin). La 023 (unicité globale du compte Vinted) reste à passer après la 029 comme prévu : elle
arrête aussi l'extension ; la route dit alors « déjà relié » au lieu de « enregistrement impossible ».

## Pas fait
- M54 (frein des sessions d'extension en mémoire), M79 (`COMPTEUR_BILAN_MOIS` global), M73, M75,
  M78 et les autres de la liste « Pas fait » de `2026-11-11-familles-serveur.md`.
- H18 « ancien abonnement » : la règle `evenementDUnAncienAbonnement` est rejouée à chaque relecture
  (pas dans la condition SQL) — suffisant avec le comparer-et-échanger.
