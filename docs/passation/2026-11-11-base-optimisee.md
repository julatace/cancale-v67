# 11 nov. 2026 — Base plus rapide et moins chère, sans rien ouvrir

Branche `claude/base-optimisee`. Point de départ : les recommandations de
l'assistant Supabase relevées le 11 nov. à 12:34 UTC (performance, index, Auth).
**Rien n'a été appliqué ni écrit sur la vraie base** : tout est en migrations à
appliquer par Julien, chacune prouvée sur un PostgreSQL JETABLE local (16), créé
puis supprimé par son banc.

⚠️ **Ce qui n'a PAS été mesuré sur la vraie base** : l'état exact des politiques
en production n'a pas été relu cette session (pas de requête en direct : la
session tournait sans humain pour autoriser l'outil SQL). La migration 033 est
donc écrite pour **vérifier elle-même** l'état réel et **tout refuser** s'il ne
correspond pas à ce que l'assistant décrit (voir « garde-fous »). Les gains
chiffrés ci-dessous viennent de la base jetable, pas de la production.

## 1. Politiques permissives en double → migration 033

**Constat (assistant)** : `app_data` porte 5 permissives (« chacun ses lignes »,
`tout_select`, `tout_insert`, `tout_update`, `vrm_proprietaire_permis`) et
`vinted_accounts` 2 (« chacun ses comptes », `vrm_proprietaire_permis`). Toutes
bornent `owner = auth.uid()`. Postgres combine les permissives en OU et les
évalue toutes. (La 004 notait déjà : « tout_select / tout_insert / tout_update
doublonnent “chacun ses lignes” ; les retirer demande une confirmation humaine ».)

**Ce que fait `supabase/migrations/033-politiques-uniques.sql`** : garde
`vrm_proprietaire_permis` (021 : FOR ALL, TO authenticated,
`owner = (select auth.uid())` en lecture et en écriture), retire les autres
permissives **seulement si** leur condition est exactement la même (sous l'une
des deux écritures connues : `owner = (select auth.uid())` ou `owner = auth.uid()`).
Toutes les RESTRICTIVES restent (`abonnement_requis`, `abonnement_requis_effacer`,
`vrm_anon_ferme`, `vrm_lecture_privee`, `vrm_insertion_privee`,
`vrm_modification_privee`, `vrm_suppression_privee`). `equipe_lit` (016, pas
encore appliquée) est épargnée : sa condition est autre.

**Garde-fous** (sinon rien ne change, la transaction est annulée, le message dit
pourquoi) : `vrm_proprietaire_permis` doit exister à l'identique ;
`vrm_anon_ferme` doit exister (une permissive « public » retirée ne change donc
rien pour anon) ; toute autre permissive inconnue ou plus large (`using (true)`)
ou visant un autre rôle arrête tout.

**Preuve** : `node scripts/audit-politiques-uniques-sql.cjs` — **39 contrôles verts**.
On rebâtit l'état décrit (002 sans `TO`, 004, 021 = le vrai fichier, abonnement
en forme 006 ET en forme 027, avec et sans `equipe_lit`), puis une matrice de
180 accès (A et B abonnés, C abonnement expiré, anonyme, identité absente ×
lire / insérer / modifier / changer de propriétaire / effacer, chez soi et chez
les autres, sur les deux tables), jouée avant et après : **identique** dans les
4 variantes ; une seule permissive par table ensuite ; les 12 (006) ou 14 (027)
restrictives inchangées ; rejouée deux fois sans effet. L'état de départ est
contrôlé (A lit ses lignes et rien de B, sauf « partage » en mode équipe ; anon
rien ; expiré : ne lit rien en 006, lit sans écrire en 027).
Mutations vues rouges : retirer AUSSI `vrm_proprietaire_permis` ⇒ matrice
différente ; affaiblir dans la 033 le contrôle de condition ⇒ « permissive
inconnue » rouge (deux mutations, chacune 1 rouge) ; sans la 021 ⇒ refus, rien retiré.

Reste après la 033 : si la 016 est appliquée un jour, l'assistant signalera
encore 2 permissives en SELECT sur `app_data` (`vrm_proprietaire_permis` +
`equipe_lit`) — normal, conditions différentes.

**Geste de Julien** : éditeur SQL → coller TOUT le fichier → Run → confirmer
(DROP POLICY = « destructive », attendu). La dernière requête liste ce qui reste :
par table UNE ligne PERMISSIVE (`vrm_proprietaire_permis`, + `equipe_lit` si 016)
et les RESTRICTIVE. Puis relancer l'assistant Performance : l'alerte « Multiple
Permissive Policies » doit disparaître pour ces deux tables.

## 2. Les 10 index « jamais utilisés » → migration 034, FACULTATIVE

Chaque index rapproché d'une requête du code (SQL des migrations, `api/`, `src/`) :

| index | sert à | verdict |
|---|---|---|
| `app_data_ebay_ids` (026) | `vrm_ebay_cibles` (notifications de suppression eBay) | garder |
| `vrm_agent_journal_owner_cible` | `vrm_agent_anonymiser_journal` (owner, cible) + effacement d'un vendeur | garder |
| `vrm_agent_file_prochain` | la file de l'agent (`prochain <= now`, tri) | garder |
| `vrm_agent_file_en_vol` | « un appel en vol par groupe » | garder |
| `vrm_communaute_conv_b` | liste des conversations (`a = moi or b = moi`), effacement d'un membre | garder |
| `vrm_agent_vus_at` | purge des 14 jours | garder |
| `vrm_agent_memos_expire` | purge des mémos expirés | garder |
| `vrm_ebay_annonces_index_compte` | (owner, compte) : renommage, retrait, réindexation | garder |
| `vrm_ebay_titulaires_owner` | **rien** : doublé par l'index de la contrainte unique `(owner, compte)` | retirable |
| `vrm_agent_journal_owner_at` | **rien aujourd'hui** (aucune lecture triée par date ; la purge ne peut pas s'en servir) | retirable |

« Jamais utilisé » vient surtout de tables minuscules (l'agent eBay sert peu, la
communauté démarre) : Postgres préfère alors lire la table entière. Ce n'est pas
une raison de les retirer. Note : `app_data_ebay_ids` coûte à chaque écriture
d'une ligne `ebay%` (la fonction relit les commandes) ; à regarder si les
écritures eBay deviennent lourdes, pas avant.

`supabase/migrations/034-index-inutiles-facultatif.sql` retire seulement les deux
« retirables ». Gain petit. Preuve : `node scripts/audit-index-base-sql.cjs` (partie
034) : rejouable, seuls ces deux index partent, la lecture par `owner` des titulaires
prend l'index de la contrainte unique, l'effacement du journal d'un vendeur prend
`(owner, cible)`.

## 3. Schéma `sauvegarde` : 5 tables sans clé primaire → rien à faire

Ce sont des copies datées (sauvegardes) : on n'y fait ni mise à jour ni
réplication ligne à ligne, une clé primaire n'apporterait rien. **Rien n'est
changé**, et l'avertissement de l'assistant peut être ignoré.

## 4. Auth : « 10 connexions au plus, en absolu » → geste de Julien (réglage)

Le serveur d'authentification a un nombre FIXE de connexions (10) à la base : si
la base grandit (offre de calcul supérieure), Auth ne suit pas. L'assistant
demande de passer à un pourcentage.
Chemin : tableau de bord Supabase → projet → **Authentication** → (colonne de
gauche, rubrique Configuration) **Advanced** — lien direct
`https://supabase.com/dashboard/project/lgonxzrzjcqthjtbdpzo/auth/advanced` —
→ réglage des connexions du serveur Auth à la base (« Max Direct Database
Connections » / « Auth Database Connections ») → choisir **Percentage** au lieu
d'un nombre fixe ; garder l'équivalent d'aujourd'hui (10 connexions rapportées au maximum de connexions de l'offre, affiché sur Database → Settings ; non mesuré cette session), Save.
Si l'écran a changé de nom, le lien « Remediation » de l'avertissement dans
l'assistant (Advisors → Performance) mène au bon réglage. Pas de risque pour les données.

## 5. Requêtes coûteuses → migration 035 (index partiel des transactions)

Lecture du code : les transactions Vinted (`harvest_{uid}_txn_*`, une ligne par
vente/achat, ~6 000 chez Julien) sont lues par le motif `id like 'harvest_%_txn_%'`
à 10 endroits (App.jsx ×3, Stats.jsx, ship-reminders ×2 dont `meta->>id=in.`,
extension ×4 dont `meta->>status=eq.450`). L'index `(owner, id text_pattern_ops)`
(004) ne se sert que de « harvest_ » : il parcourt toutes les captures du
vendeur puis jette ce qui n'est pas une transaction.

`supabase/migrations/035-index-transactions.sql` : `create index concurrently
app_data_txn_owner on app_data (owner) where id like 'harvest_%_txn_%'` — le
prédicat est écrit EXACTEMENT comme PostgREST l'envoie (sinon Postgres ne prend
pas l'index partiel).

Mesuré sur base jetable (2 vendeurs × 6 000 transactions + 20 000 autres
captures, RLS de la 033, rôle `authenticated` et clé de service) : **mêmes
réponses**, index pris par les 6 requêtes, pages lues **3 223 → 507**, temps
÷ 3 à ÷ 10 (ex. 18,6 ms → 1,9 ms). Le gain réel dépend de la part des
transactions parmi les lignes `harvest_` du vendeur.
Appris en mesurant : sous RLS, un filtre `meta->>'status' = …` n'est JAMAIS une
condition d'index (l'opérateur `->>` n'est pas « leakproof », Postgres
l'applique après les politiques) — une première version `(owner, meta->>'status')`
n'apportait rien de plus, elle a été réduite à `(owner)`.

Les autres lectures fréquentes regardées : les filtres `meta->>` du serveur
(`transp_*`, `email_track_*`, `email_bord_*`, `ext_appareil_*`…) sont déjà
bornés par le préfixe d'`id` (index 026) sur des familles petites ; les lectures
de l'app sont bornées par `owner` (RLS) + préfixe. Pas d'autre index proposé sans
mesure sur la vraie base.

**Mode d'emploi (éditeur SQL, qui enveloppe dans une transaction — cf. 026)** :
coller la SEULE instruction `create index concurrently …`, Run ; si l'éditeur la
refuse (« cannot run inside a transaction block »), retirer `concurrently` et Run
(comme la 026 : ~1 s de verrou en écriture, VRM peu sollicité). Vérifier
`indisvalid = true` (requête dans le fichier). Même chose pour les `drop index
concurrently` de la 034.

**Mesure avant/après à faire sur la vraie base** (lecture seule, aucune donnée
vendeur affichée) :

```sql
select count(*) filter (where id like 'harvest_%_txn_%') as transactions,
       count(*) filter (where id like 'harvest_%') as captures
  from public.app_data;
explain (analyze, buffers)
select meta->>'id' from public.app_data
 where id like 'harvest_%_txn_%' and owner = '74eea6e7-f060-46b6-b9c7-d500cedf4738';
```

## 6. En passant : `audit-pagination-ordre` était rouge sur `main`

`api/_lib/pilotage.js:66` lisait par pages (`Range`) sans `order=` (une ligne peut
sauter ou être lue deux fois d'une page à l'autre). Corrigé par `ordreStable(…)` ;
`essais_gratuits` ajoutée à `ORDRE_PAR_TABLE` avec sa clé `cle` (l'ordre par défaut
`owner,id` aurait fait échouer cette lecture : pas de colonne `id`).
`scripts/tests/pilotage.test.mjs` 7/7, audit 12/12 vert.

## Preuves de la session

- `npm run build` vert.
- Audits verts : variables, tdz, coherence, identite, fonctions-api, secrets,
  lectures-lourdes, lecture-groupee, pagination-ordre (après le §6),
  confidentialite-sql (45).
- `audit-politiques-uniques-sql.cjs` 39/39, `audit-index-base-sql.cjs` 26/26.

## Ordre conseillé pour Julien

1. 033 (politiques) — tout le fichier, confirmer les DROP POLICY.
2. 035 (index transactions) — une instruction seule.
3. Réglage Auth en pourcentage (§4).
4. 034 seulement s'il veut nettoyer l'assistant (facultatif).
