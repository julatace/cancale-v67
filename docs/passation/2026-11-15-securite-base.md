# 15 nov. 2026 — Sécurité de la base avant l'arrivée de nouveaux vendeurs

Branche `claude/securite-base` (partie de `claude/project-review-nsk5su`). Point de
départ : les conseils Supabase du 15 nov. (assistants « Security » et « Performance »).
Question posée : **chaque vendeur ne voit-il QUE ses données ?**

**Rien n'a été écrit sur la vraie base.** Lectures seules (structure : `pg_proc`,
`pg_policies`, droits, tailles ; aucun contenu de vendeur affiché), puis tout rejoué sur
un PostgreSQL JETABLE avec les migrations du dépôt.

## Verdict en une phrase

Aucune fonction ni politique ne laisse un vendeur lire ou écrire les données d'un autre.
Le seul point à surveiller est la charge : le classement de la communauté relit les
ventes de tous les inscrits à chaque appel (gravité moyenne, et seulement quand il y
aura beaucoup d'inscrits). Deux petits durcissements sont prêts (migration 045). Les
politiques en double se fusionnent avec la 036, déjà prête, prouvée ici sur l'état
exact de la production du 15 nov.

## Ce qui a été lu en production (15 nov., lecture seule)

- Le CODE des 31 fonctions signalées et de leurs aides : `pg_get_functiondef`.
  L'audit compare l'empreinte (md5) de chacune avec la base jetable : **les 47 sont
  identiques** (`vrm_regle_acces` ne diffère que par ses lignes de commentaire, la
  production l'a reçue sans elles).
- Toutes les politiques de `public` (21 sur `app_data` et `vinted_accounts`, recopiées
  dans l'audit), les droits des tables pour `anon` et `authenticated`, RLS et FORCE RLS.
- Les rôles : `postgres` (propriétaire des fonctions) contourne la RLS, il n'est pas
  superutilisateur ; `anon` et `authenticated` ne la contournent pas.
- Le schéma `sauvegarde` : ni `anon` ni `authenticated` n'y ont accès (aucun droit USAGE).
- `abonnement_obligatoire = 0` aujourd'hui (tout le monde a accès) ; 9 comptes, 2 profils
  sur la carte dont 1 inscrit au classement, 0 groupe d'accompagnement.
- `vinted_accounts` : un compte Vinted ne peut être relié qu'à UN compte VRM (index
  unique global sur `vinted_user_id`, la 023 est passée).

## 1. Les 31 fonctions SECURITY DEFINER appelables par un vendeur connecté

**Pourquoi elles sont appelables** : le serveur les appelle avec le jeton DU vendeur
(`api/_lib/communaute.js`, `api/_lib/accompagnement.js`, `api/compte.js` →
`/rest/v1/rpc/…`), pour que `auth.uid()` soit lui. Un vendeur peut donc aussi les
appeler en direct, sans passer par le serveur. Les contrôles sont donc DANS la base,
et c'est ce qui a été vérifié (l'audit appelle chaque fonction en direct, sans les
coupes que fait le serveur). `vrm_acces_ok` est en plus lue par les politiques RLS :
lui retirer le droit d'exécution casserait toutes les lectures.

**Contrôles communs, vérifiés sur les 31** : `search_path` fixé à `''` (chaque objet est
écrit `schéma.objet`) ; aucun SQL dynamique (`EXECUTE`) ; aucune appelable par `anon` ;
l'identité vient toujours d'`auth.uid()`, jamais d'un paramètre ; `auth.uid()` vide ⇒
rien ; l'abonnement (`vrm_acces_pour`) est vérifié là où il compte. Aucune ne lit
`auth.users` : aucun e-mail ne peut sortir. Les tables derrière n'ont AUCUN droit pour
`authenticated` (on n'y entre que par ces fonctions).

| fonction | ce qu'elle fait | contrôle présent | risque | correctif |
|---|---|---|---|---|
| `vrm_acces` | dit à l'app : abonnement obligatoire ? propriétaire ? accès ? | lit seulement la ligne d'abonnement de `auth.uid()` ; « propriétaire » rendu en oui/non, jamais l'identifiant | aucun | — |
| `vrm_acces_ok` | oui/non « j'ai accès » | idem ; lue par les politiques RLS | aucun (doit rester exécutable) | — |
| `vrm_accomp_apercu` | aperçu d'un groupe par son code | session + abonnement ; code de 8 signes sur 32 (≈ 10¹² codes) ; rend nom, description, nombre de membres, MON statut — aucun membre nommé | aucun | — |
| `vrm_accomp_ce_que_voit` | « ce que voit le créateur » de MON adhésion | `m.owner = auth.uid()` | aucun | — |
| `vrm_accomp_code` | nouveau code | créateur seulement (`cree_par = moi`) | aucun | — |
| `vrm_accomp_creer` | crée un groupe | nom 2–60, description ≤ 500, nom du créateur 2–40, sans `@ < >` ; 5 groupes ouverts | faible : fermer puis recréer n'a pas de plafond total (lignes minuscules) | — |
| `vrm_accomp_decider` | accepter/refuser une demande | créateur du groupe ouvert ; demande en attente ; 200 membres | aucun | — |
| `vrm_accomp_demander` | demander à entrer | session, abonnement, code, partage dans une liste fermée, nom borné ; 20 groupes, 100 demandes par groupe | faible : un refusé ou retiré peut redemander (repasse « en attente ») — choix produit, voir §5 | — (décision de Julien) |
| `vrm_accomp_fermer` | fermer son groupe | créateur ; efface ce que les membres ne partagent plus | aucun | — |
| `vrm_accomp_lire` | mes groupes créés et rejoints | créés : `cree_par = moi` ; rejoints : `owner = moi` ; les chiffres d'un membre seulement s'il est ACCEPTÉ et au niveau qu'il a choisi | aucun | — |
| `vrm_accomp_partage` | changer MON partage | `owner = moi` ; baisser marche toujours, élargir demande l'abonnement ; ce qui n'est plus permis est EFFACÉ | aucun | — |
| `vrm_accomp_publier` | publier MES chiffres / mon détail | forme vérifiée (clés, nombres, ≤ 120 signes par texte, ≤ 300 lignes), 256 Ko, détail rangé seulement au niveau « détail » | faible : le poids est mesuré APRÈS la vérification de forme (borné par la taille de requête de l'API) | — |
| `vrm_accomp_quitter` | partir | `owner = moi` | aucun | — |
| `vrm_accomp_retirer` | le créateur retire un membre | créateur | aucun | — |
| `vrm_communaute_bloquer` | bloquer l'autre d'une conversation | je suis l'un des deux (`a = moi or b = moi`) | aucun | — |
| `vrm_communaute_carte` | la carte | abonné ; position arrondie à 0,05° (≈ 5 km) à l'écriture ; pseudo, ville, Discord donnés par chacun ; mes blocages appliqués | aucun (données publiées volontairement) | — |
| `vrm_communaute_classement` | classement public | ne compte QUE les inscrits (`classement = true`) ; un nombre de ventes, jamais une vente | **moyen (charge)** : relit `main` et la liste des ventes de chaque inscrit à chaque appel, sans plafond d'appels | voir §5 (pas de migration) |
| `vrm_communaute_classement_groupe` | classement d'un groupe | je dois être membre du groupe ; entrer dans un groupe = consentement dit à l'écran (020) | même charge, bornée à 200 membres | — |
| `vrm_communaute_classement_inscrire` | m'inscrire / me retirer | `owner = moi` | aucun | — |
| `vrm_communaute_conversations` | mes conversations | `a = moi or b = moi` ; messages masqués de l'autre jamais rendus | aucun | — |
| `vrm_communaute_discord` | mon pseudo Discord | `owner = moi` ; forme `^[a-z0-9._]{2,32}$` | aucun | — |
| `vrm_communaute_ecrire` | écrire à un membre | moi et lui sur la carte et abonnés ; ≤ 500 signes ; 20 messages/h, 5 nouvelles conversations/jour ; bloqué ⇒ rangé masqué | aucun | — |
| `vrm_communaute_fil` | lire une conversation | je suis l'un des deux ; 200 derniers messages | aucun | — |
| `vrm_communaute_groupe_code` | nouveau code de groupe | créateur | aucun | — |
| `vrm_communaute_groupe_creer` | créer un groupe | sur la carte, nom 2–40 sans `@ < >`, 5 créés, 10 rejoints | aucun | — |
| `vrm_communaute_groupe_quitter` | quitter un groupe | MA ligne seulement | aucun | — |
| `vrm_communaute_groupe_rejoindre` | entrer par code | sur la carte, abonné, code, 10 groupes, 200 membres | aucun | — |
| `vrm_communaute_quitter` | quitter la carte | MA ligne | aucun | — |
| `vrm_communaute_rejoindre` | entrer sur la carte | pseudo ≤ 30, ville ≤ 80, sans `@ < >`, pays 2 lettres, position arrondie, pseudo unique | aucun | — |
| `vrm_communaute_signalements` | lire les signalements | propriétaire de l'installation seulement (`vrm_reglages.proprietaire`) | aucun (aucun écran ne l'appelle ; prévue pour Julien « sous sa session », 018) | — |
| `vrm_communaute_signaler` | signaler une conversation | je suis l'un des deux ; raison coupée à 300 signes ; 5 derniers messages de l'autre en extrait ; 20/jour | aucun | — |

Fonctions appelables mais SECURITY INVOKER (la RLS de l'appelant s'applique, donc sûres
par construction) : `vrm_temps_reel` (rend `true`), les fonctions pures des déclencheurs
(`vrm_meta`, `vrm_cle_num`, `vrm_nums_garage`, `vrm_ebay_ids`, `vrm_regle_acces`), et,
quand la 042 sera passée, `vrm_commandes_lire` / `vrm_commandes_ecrire` : elles
acceptent un `p_owner`, mais comme FILTRE seulement — l'audit prouve qu'A qui passe le
numéro de B ne lit rien et n'écrit rien (0 ligne). ⚠️ Ne jamais les passer en SECURITY
DEFINER (mutation `commandes-definer` : l'audit devient rouge).

Les autres SECURITY DEFINER du schéma (agent eBay, effacement de compte, sessions,
détourage, usage) ne sont appelables que par la clé de service ; toutes ont leur
`search_path` fixé (`''`, ou `public, pg_temp` pour le détourage, `public` pour
`vrm_usage_vendeurs` → corrigé par la 045).

## 2. Les 27 tables « RLS activée sans politique » — voulu, sûr, rien à changer

« RLS sans politique » = fermé à tous les rôles de l'API ; seuls la clé de service et
le propriétaire des fonctions (`postgres`) y entrent. Mesuré : **aucune des 27 n'a le
moindre droit pour `anon` ni `authenticated`**, et 24 ont en plus FORCE RLS. C'est la
double porte voulue.

| tables | qui y entre |
|---|---|
| `vrm_communaute_*` (7), `vrm_accomp_*` (3) | les fonctions du §1 (identité du jeton) ; « fermer mon compte » par la clé de service |
| `vrm_reglages` | lue par `vrm_acces*` et les fonctions de la communauté ; écrite par Julien (éditeur SQL) |
| `vrm_agent_*` (9), `vrm_coffre`, `vrm_ebay_annonces_index`, `vrm_ebay_cles_publiques`, `vrm_ebay_titulaires` | l'agent eBay et la route serveur, clé de service (014, 026) ; `vrm_coffre` est chiffré (AES-256-GCM) |
| `essais_gratuits`, `parrainage_codes`, `parrainages` | la route serveur, clé de service (022, 027) |

Les avertissements resteront dans l'assistant (niveau INFO) : ils décrivent exactement
le réglage voulu. Ne PAS y « ajouter une politique » pour les faire taire : une
politique ouvrirait une porte.

## 3. Politiques permissives en double → la 036 (déjà prête), prouvée sur le 15 nov.

État relu : `app_data` a 5 permissives (« chacun ses lignes », `tout_select`,
`tout_insert`, `tout_update`, `vrm_proprietaire_permis`), `vinted_accounts` 2 ; toutes
`owner = (select auth.uid())`, rôle `authenticated` (« chacun ses lignes » n'est plus
sur `public` comme en octobre). Plus 7 RESTRICTIVES par table (abonnement, anon fermé,
`vrm_*_privee`).

`supabase/migrations/036-politiques-uniques.sql` (11 nov., pas appliquée) garde
`vrm_proprietaire_permis` (FOR ALL = **une politique pour chaque action**) et retire
les autres SEULEMENT si leur condition est exactement la même ; elle refuse tout s'il
y a une permissive inconnue. Les restrictives restent (ce sont elles qui ferment
l'abonnement expiré et anon ; elles ne coûtent pas l'avertissement « multiple
permissive »).

Preuve nouvelle (`audit-securite-base.cjs`) : la base jetable porte **les 21 politiques
exactes de la production du 15 nov.**, abonnement OBLIGATOIRE ; matrice de 162 accès
(A, B, C abonnés, E expiré, anon, jeton sans identité × lire, insérer, modifier,
effacer, donner à B, chez soi et chez les autres, sur les deux tables) **identique
avant et après 036 + 045** ; E lit ses lignes, n'écrit ni n'efface ; une permissive
par table ensuite ; rejouée deux fois sans effet. (L'audit d'origine
`audit-politiques-uniques-sql.cjs`, 39/39, reste vert.)

## 4. Index jamais utilisés (10) et tables de sauvegarde sans clé (6) — rien supprimé

**Index** (`pg_stat_user_indexes`, statistiques jamais remises à zéro) : tous à 0
lecture, **tous minuscules** (8 Ko chacun, 16 Ko `vrm_communaute_conv_b`, 24 Ko
`app_data_ebay_ids`) — soit ~100 Ko en tout.
Le rapprochement avec le code reste celui du 11 nov. (`2026-11-11-base-optimisee.md`
§2) : 8 servent à des requêtes qui existent (agent eBay peu utilisé, communauté qui
démarre ; sur des tables minuscules Postgres préfère tout lire, d'où « jamais
utilisé ») ; 2 sont vraiment doublés (`vrm_ebay_titulaires_owner`,
`vrm_agent_journal_owner_at`, migration facultative 034).
**Gain d'une suppression** : ~100 Ko et une écriture d'index de moins par ligne
écrite sur ces tables (rares). Négligeable. `app_data_ebay_ids` est le seul qui coûte
un peu (il recalcule à chaque écriture d'une ligne `ebay%`). Rien n'est supprimé
(décision de Julien).

**Tables de `sauvegarde` sans clé primaire** (6) : `app_data_20260930` (55 Mo),
`app_data_20261002` (56 Mo), `journal_ecritures` (38 Mo, ~208 000 lignes),
`vinted_accounts_20260930` / `_20261002` (40 Ko chacune), `copie_compte_20261115`
(224 Ko, nouvelle aujourd'hui). Une clé primaire n'apporte rien à une copie qu'on ne
modifie jamais. Ce qu'on gagnerait en les supprimant : **~150 Mo de base** (sur
l'offre gratuite, 500 Mo au total — `app_data` vivante fait 87 Mo). Personne de l'API
ne peut les lire (schéma sans droit USAGE). Rien n'est supprimé (décision de Julien).
À trancher par lui : garder les copies du 30 sept. et du 2 oct. maintenant que les
points de restauration existent ? vider `journal_ecritures` (le journal temporaire
d'octobre) ?

## 5. Les risques réels, par gravité

1. **Moyen (disponibilité, quand il y aura du monde) — le classement de la communauté.**
   `vrm_communaute_classement_calc` relit, à CHAQUE appel, la ligne `main` (pour
   `vinted_accounts_hidden`) et la liste des ventes de CHAQUE inscrit, et un vendeur
   connecté peut l'appeler autant qu'il veut. Aujourd'hui : 1 inscrit, rien à craindre.
   Ordre de grandeur (estimé, pas mesuré) : les plus grosses lignes de production
   pèsent ~170 Ko (`main`) et ~190 Ko (`orders_sold`) compressées, soit plusieurs Mo à
   décompresser par gros vendeur ; à quelques dizaines de gros vendeurs inscrits, un
   appel approchera la limite de 8 s de l'API, et des appels répétés chargeraient la
   base pour tout le monde. **Pas de migration** : la bonne correction change la
   fonction (un compteur de ventes par vendeur tenu à l'écriture, ou un classement
   recalculé au plus toutes les N minutes dans une table) et mérite son chantier, avec
   l'audit `audit-communaute-sql.cjs` (206 contrôles) pour garder le comptage exact.
   **À faire avant d'ouvrir le classement à beaucoup de vendeurs.**
2. **Faible — droits inutiles sur `detourage_usage`** : `authenticated` garde
   REFERENCES et TRIGGER (droits par défaut). Inatteignables par l'API, mais sans
   raison d'être. → **045**.
3. **Faible — `vrm_usage_vendeurs`** (clé de service) : `search_path = public` sans
   `pg_temp` en dernier (recommandation de Postgres pour une SECURITY DEFINER). → **045**.
4. **Faible, choix produit — accompagnement : un refusé ou retiré peut redemander**
   (`vrm_accomp_demander` remet « en attente »). Pas une fuite (rien n'est vu sans
   validation), mais un créateur peut être sollicité de nouveau. Si Julien veut
   « refusé = définitif » ou « une nouvelle demande après 7 jours », c'est une ligne
   dans la fonction. Rien changé sans sa décision.
5. **Faible — tailles mesurées tard** : `vrm_accomp_publier` vérifie la forme avant
   le poids, `vrm_communaute_signaler` coupe la raison après l'avoir reçue entière.
   Borné par la taille de requête de l'API ; pas de correctif proposé.

Ce qui est **sûr tel quel** : les 31 fonctions (cloisonnement vérifié une à une,
rejoué par l'audit), les 27 tables sans politique, la RLS d'`app_data` et
`vinted_accounts` (avant comme après la 036), le schéma `sauvegarde` (fermé), les
fonctions de service (droits retirés à l'API).

## 6. Auth : connexions en nombre fixe (10) → passer en pourcentage (geste de Julien)

La base accepte 60 connexions (`max_connections`, offre actuelle) ; Auth en réserve 10
en nombre fixe (~17 %). Si l'offre de calcul monte (plus de vendeurs), Auth resterait à
10 et deviendrait le goulot des connexions/inscriptions. **Oui, passer en
pourcentage**, sans urgence : tableau de bord Supabase → Authentication → (Configuration)
**Advanced** (lien direct
`https://supabase.com/dashboard/project/lgonxzrzjcqthjtbdpzo/auth/advanced`) →
connexions du serveur Auth à la base → **Percentage**, **17 %** (= les 10 d'aujourd'hui),
Save. Aucun risque pour les données. Si l'écran a changé, le lien « Remediation » de
l'avertissement (Advisors → Performance) mène au bon réglage.

## 7. Les migrations prêtes et l'ordre pour les appliquer

Rien n'est appliqué. Geste de Julien, ou du coordinateur avec son accord, dans
l'éditeur SQL de Supabase :

1. **036** `supabase/migrations/036-politiques-uniques.sql` — tout le fichier, Run ;
   confirmer les DROP POLICY (« destructive », attendu : ce sont des doublons). La
   dernière requête doit lister, par table, UNE ligne PERMISSIVE
   (`vrm_proprietaire_permis`) et les RESTRICTIVE inchangées. L'avertissement
   « Multiple Permissive Policies » disparaît.
2. **045** `supabase/migrations/045-securite-durcissement.sql` — tout le fichier, Run
   (aucun DROP ni DELETE, aucune confirmation). Attendu : `detourage_usage |
   authenticated | SELECT` seul, et `search_path=public, pg_temp`.
3. Réglage Auth en pourcentage (§6).
4. Facultatif : 034 (deux index doublés), seulement pour nettoyer l'assistant.

Après : relancer l'assistant Security. Il affichera encore les 31 fonctions (voulues,
§1) et les 27 tables (voulues, §2) : c'est normal.

## 8. Les preuves

`node scripts/audit-securite-base.cjs` — **74 contrôles verts**. Postgres jetable,
socle `scripts/agent-sql/supabase-min.sql` + les vraies migrations 005, 006, 007, 008,
018, 019, 020, 021, 025, 027, 041, 042 (ordre de production), puis 036 et 045 :

- base jetable = production : empreintes des 47 fonctions (31 exposées + aides) et
  les 21 politiques relevées le 15 nov. ;
- catalogue : toute SECURITY DEFINER exposée doit être dans la liste revue (une
  nouvelle ⇒ rouge), `search_path = ''`, pas d'EXECUTE, rien pour anon ; tables sans
  politique sans aucun droit ;
- scénarios « comme PostgREST » avec cinq comptes inventés (A, B en relation ; C
  intrus ; E expiré ; P propriétaire) : C ne lit ni n'agit sur rien de A ou B (fil,
  liste, blocage, signalement, code, sortie de groupe, classement de groupe,
  validation, retrait, fermeture, aperçu, partage, « ce que voit », commandes 042) ;
  nombre de ventes rendu seulement là où le vendeur a consenti ; plafonds de texte
  tenus par la base en appel direct ; E n'a que « acces: false » ; anon refusé sur
  les 31 ; **aucune des 87 réponses ne contient l'identifiant de compte ni l'e-mail
  d'un autre** ;
- RLS : matrice de 162 accès identique avant/après 036 + 045.

`node scripts/audit-securite-base.cjs --prouve` — 16 mutations, chacune doit faire
passer l'audit au rouge (fil sans contrôle de membre, signaler sans membre, « ce que
voit » d'une autre adhésion, validation par un non-créateur, classement de groupe sans
membre, classement public sans accord, identifiant de compte rendu au créateur,
plafond de message retiré, signalements ouverts, nouvelle SECURITY DEFINER non revue,
search_path ouvert, fonction exposée à anon, 042 en SECURITY DEFINER, la 036 qui
retire aussi la permissive gardée, RLS trop large, abonnement expiré qui écrit).
**Résultat : 16/16 mutations attrapées** (chacune de 1 à 3 contrôles rouges ; ~14 min).

Audits existants relancés, tous verts : `audit-communaute-sql` 206, `audit-accompagnement-sql`
103, `audit-confidentialite-sql` 45, `audit-politiques-uniques-sql` 39,
`audit-formateurs-sql` 101, `audit-equipe-sql` 182.

Non couvert ici (pas en production, chacun a son audit) : les fonctions du mode équipe
(016), des formateurs (032), des partenaires (043). Le jour où l'une passe en
production : l'ajouter à `ORDRE_PROD` dans l'audit ; il devient rouge (« NON REVUES »)
tant que ses fonctions exposées ne sont pas relues, ajoutées à `REVUES` et à
`EMPREINTES_PROD` (relevées en production), avec leurs scénarios.
