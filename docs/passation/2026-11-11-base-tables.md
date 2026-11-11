# 11 nov. 2026 — Une vraie base de données (étape 1 sur 4)

Branche `claude/base-tables` (partie de `origin/main` f04d4a58), **rien fusionné, rien appliqué**.
Demande de Julien (validée) : une vraie base pour tenir des milliers de vendeurs, plus
rapide, chiffres plus sûrs, par étapes, sans jamais casser l'app en ligne.

Livré : `supabase/migrations/037-tables-typees.sql` (étape 1) et sa preuve
`scripts/audit-tables-typees-sql.cjs` (PostgreSQL 16 JETABLE, créé puis supprimé).
**Aucune écriture sur la vraie base** ; deux requêtes de LECTURE agrégées (comptes et
tailles par famille, contrôle des formes par `meta`), aucune donnée de vendeur affichée.

## 1. Ce qui vit dans `app_data` aujourd'hui (mesuré le 11 nov., lecture seule)

12 022 lignes, 8 vendeurs, 13 comptes Vinted dans `vinted_accounts`. Par famille d'`id`
(taille de `data` sur disque, compressée) :

| famille | lignes | taille | plus grosse ligne | qui écrit · qui lit |
|---|---|---|---|---|
| `harvest_{uid}_txn_{tx}` | 1 407 | 9,9 Mo | 37 Ko | extension · app (preuve de vente), rappels, extension — par `meta` (004, 035) |
| `email_bord_{tx}` | 239 | 6,0 Mo | 243 Ko (PDF) | email-inbound · Colis — **jamais `select=data`** (§4.4) |
| `email_inconnu_*` | 1 976 | 4,4 Mo | 27 Ko | email-inbound · E-mails |
| `harvest_{uid}_label_{tx}` | 166 | 3,6 Mo | 482 Ko (PDF) | extension · impression — par `meta->>_pdf` |
| `harvest_{uid}_conv_*` | 1 374 | 3,3 Mo | 11 Ko | extension · Messages, favoris |
| `coffre_*` | 849 | 1,2 Mo | 6 Ko | extension · Republier |
| `harvest_{uid}_orders_sold/purchased` | 43 | 0,8 Mo | 195 Ko | extension, `commandes-leger` · Ventes, Achats, widget, URSSAF |
| `email_reception/texte/offer/achat/sale/final/invoice_*` | ~3 800 | 3,7 Mo | 59 Ko | email-inbound · E-mails, compta |
| `email_track_{carrier}_{suivi}` | 383 | 0,2 Mo | 1,6 Ko | email-inbound · Achats (à retirer), codes |
| `main` | 7 | 0,3 Mo | 161 Ko | app (SYNC_KEYS) · tout — gardée par la 017 |
| `harvest_{uid}_listings` | 19 | 0,15 Mo | 27 Ko | extension · Annonces, Stock |
| catalogues, `lbc_*`, `vc_*`, `panel_*`, `transp_*`, `ext_*`… | le reste | | | |

**Ce qui est lourd ou lent** : une liste de ventes est UNE ligne (195 Ko chez Julien,
≈ 1 Mo pour 2 000 ventes) — trouver une vente par son n° relit toute la ligne ; tout
compteur (« combien vendues en octobre ») décompresse la liste ; deux écritures de la
même liste se battent (comparer-et-échanger sur `data.rev`, `commandes-leger`). Les
bordereaux et e-mails PDF sont lourds mais déjà lus par `meta` (004). Mesuré sur base
jetable (§5) : une vente par son n° 2,5 ms en JSON → 0,23 ms en table.

**Formes vérifiées sur la vraie base** (par `meta`, sans relire les PDF) : les 1 407
transactions portent `meta.id` = le n° de leur ligne ; les 158 bordereaux Vinted, leur
`tx` ; 238/239 bordereaux e-mail ont un n° de transaction ; 297/383 suivis un n° de
suivi ; 16/19 listes d'annonces ont `payload.items` (688 annonces), 35/37 listes de
commandes `payload.my_orders` (6 889 commandes) ; 4/7 `main` ont un pool. ⇒ après le
remplissage, `vrm_tables_couverture()` doit montrer **environ 5 lignes « en écart »
(forme) et ~87 « sans identité »** (le bordereau sans n°, les 86 suivis sans n°) : c'est
attendu, rien n'est perdu (ces lignes restent dans `app_data` et l'app les lit comme avant).

## 2. Le schéma cible

Chaque table : `owner` + RLS (une permissive, lecture, `owner = (select auth.uid())`),
**clé primaire = l'identité** (§5), jamais un titre.

| table | identité (clé primaire) | rempli depuis |
|---|---|---|
| `annonces` | owner, plateforme, compte, **annonce_id** | `harvest_{uid}_listings` → `payload.items[]` |
| `ventes` / `achats` | owner, plateforme, compte, **transaction_id** | `harvest_{uid}_orders_sold/purchased` → `payload.my_orders[]` |
| `transactions` | owner, compte, **transaction_id** | `harvest_{uid}_txn_{tx}` (par `meta`) |
| `colis` | owner, source (+ index n° de transaction, n° de suivi) | `harvest_{uid}_label_{tx}`, `email_bord_{tx}`, `email_track_*` (par `meta`, PDF jamais recopié) |
| `emails` | owner, source | `email_(bord|track|invoice|achat|texte|sale|reception|offer|inconnu|final)_*` (par `meta`) |
| `numeros` | owner, **cle_num** — APPEND-ONLY | `main.vinted_used_numeros` (clé `vrm_cle_num` de la 013 : « 007 » = « 7 ») |
| `numeros_fiches` | owner, cle_fiche (+ index cle_num) | `main.vinted_annonce_numeros` (miroir) |
| `comptes` | owner, plateforme, compte_id | `vinted_accounts` — login, domaine, **jamais un jeton** |

Index posés pour les requêtes réelles : vente ↔ annonce par `item_id`, ventes par date,
transactions par état (450), colis par n° de transaction / de suivi, e-mails par date,
fiches par N° (« deux paires sous un N° »).

Choix tranchés (et pourquoi) :
- **Colis non fusionnés** : un bordereau Vinted, un bordereau e-mail et un suivi sont
  trois faits ; les relier se fera par leurs identités (n° de transaction, n° de suivi),
  jamais par ressemblance — c'est la règle de `regrouperArrivees`, elle passera telle
  quelle à l'étape 2.
- **Leboncoin, Vestiaire, eBay pas encore** : leurs lignes (`lbc_*`, `vc_*`, `ebay_*`)
  n'ont pas été mesurées cette session ; la contrainte `plateforme in ('vinted')` le dit.
  Elles s'ajoutent par une 038 après mesure de leur forme.
- Les dates françaises (« 14 novembre ») restent en texte (`limite_texte`), jamais devinées.
- Un N° n'est **jamais** modifié ni retiré de `numeros`, même si `main` en perd un (seul
  chemin : `vrm_tables_effacer_vendeur`, effacement RGPD d'un vendeur).

## 3. Étape 1 — la 037 (livrée, pas appliquée)

- Tables + RLS + index ; trois déclencheurs **APRÈS** écriture sur `app_data` (écrit,
  renommé, effacé) et un sur `vinted_accounts` : ils RECOPIENT, ils ne touchent jamais la
  ligne d'origine. Les familles PDF sont lues par `meta`, jamais par `data`.
- Une erreur de recopie est rattrapée et notée (`vrm_projection_ecarts`, « erreur ») :
  **l'écriture de l'extension ou de l'app passe toujours** ; la recopie se rattrape à la
  prochaine écriture de la ligne.
- Forme inconnue ⇒ rien écrit (la copie d'avant reste), comptée (« forme »,
  « meta_absente ») ; élément sans identité ⇒ sauté, compté (« sans_identite »).
- `vrm_tables_remplir(lot)` : remplissage initial par lots, curseur (reprise après
  coupure), verrou PARTAGÉ sur les lignes du lot (une écriture concurrente attend la fin
  du lot puis se recopie elle-même : la copie n'est jamais plus vieille que la ligne).
  Rejouable : `vrm_tables_remplir_recommencer()` puis de nouveau, même résultat.
- `vrm_tables_couverture()` : par famille, lignes / recopiées / en écart / sans identité.
- Aucune fonction de recopie appelable par `anon` / `authenticated` (elles prennent un
  `owner`) ; les droits par défaut de Supabase (tout ouvert aux nouvelles tables) sont
  repris un par un.

## 4. La preuve — `node scripts/audit-tables-typees-sql.cjs` (`--petit` : 18 s)

On rebâtit `app_data` comme en production (vraie `meta` de la 004, vraie clé des N° de la
013, vraie garde 017, vraie 021, droits par défaut de Supabase), on verse ~50 000 lignes
inventées de la vraie forme (94 vendeurs, 188 comptes : listes, commandes, transactions,
bordereaux avec PDF, e-mails, `main` de 395 Ko) dont des formes cassées, puis
**73 contrôles verts** :
- `app_data` et `vinted_accounts` identiques avant / après (empreinte data+meta+updated_at) ;
- chaque table : le compte EXACT attendu (11 220 annonces, 47 000 ventes…) ; chaque ligne
  d'une famille recopiée est recopiée OU en écart nommé (0 sans trace) ; hors périmètre :
  rien ; prix lu dans l'objet `{amount}` (« 25,50 » compris) ; **50 paires identiques =
  50 lignes** ; une annonce lue deux fois = une ligne ; aucun jeton ; aucun PDF ;
- remplissage rejoué 2 fois, et chaque ligne réécrite à l'identique : tables identiques ;
- formes inconnues et sans identité : comptes exacts ; une bonne liste puis une forme
  inconnue ⇒ les annonces d'avant restent ;
- RLS : A voit ses lignes et 0 d'un autre (9 tables), B rien de A, anonyme refusé,
  identité absente rien, A ne peut ni écrire ni appeler recopie / remplissage / effacement ;
- en direct (session du vendeur) : vente ajoutée ⇒ dans `ventes`, retirée ⇒ sortie ;
  N° ajoutés ⇒ entrés ; `main` qui perd des N° ⇒ `numeros` les garde ; modifier / retirer
  / vider `numeros` refusé même par la clé de service ; « 7 » = « 007 » ;
- recopie en erreur ⇒ l'écriture d'`app_data` passe, la table garde l'état d'avant,
  l'erreur est notée, puis se rattrape ;
- **mutations** (chacune rougit) : politique `using (true)` (11 rouges), garde des N°
  retirée (3), enveloppe d'erreur retirée (3), forme inconnue qui efface (1), N° en
  `do update` (6), jetons recopiés (1).

Défaut trouvé par le banc et corrigé : « liste inchangée ⇒ rien à recopier » empêchait
une recopie ratée de se rattraper ; ce raccourci n'est permis que si la copie est propre.

## 5. Mesures (base jetable, ~50 000 lignes)

| quoi | mesuré |
|---|---|
| remplissage initial | 39 668 lignes recopiées en **25 s** (20 lots de 2 000, ~1,2 s chacun) ; chez Julien (12 022 lignes) : quelques secondes |
| écrire la ligne de 2 000 ventes (une change) | 12 ms sans recopie → **48 ms** avec (+36 ms ; 1re version +220 ms, corrigée : seules les commandes changées sont relues) |
| écrire `main` (395 Ko, N° inchangés) | 4,4 → 5,8 ms |
| une vente par son n° de transaction | 2,5 ms (JSON) → **0,23 ms** (table) |
| compter ses ventes d'octobre | 3,1 ms → 1,3 ms (l'écart grandit avec le nombre de vendeurs) |

## 6. Pas-à-pas pour Julien (éditeur SQL de Supabase, sans terminal)

**A. Essai annulé d'abord (rien ne reste)** — comme pour la 016 :
1. Supabase → projet → **SQL Editor** → New query.
2. Coller tout `supabase/migrations/037-tables-typees.sql`, puis **remplacer la ligne
   `commit;`** (vers la fin) par `rollback;` et **effacer la toute dernière ligne**
   (`select * from public.vrm_tables_couverture();`). Run.
3. Attendu : « Success », aucune erreur rouge ; tout a été annulé. Une erreur
   `vrm_tables_037 : …` dit quelle migration manque : rien n'a changé.

**B. Pour de vrai** :
4. Nouvelle requête, coller le fichier **tel quel** (avec `commit;`), Run. La dernière
   requête liste les familles avec 0 recopiée : normal, le remplissage n'a pas eu lieu.
5. Remplissage : `select * from public.vrm_tables_remplir(2000);` — Run, **répéter jusqu'à
   `fini = true`** (chez lui : 1 à 3 fois). `erreurs` doit rester 0.
6. Contrôle : `select * from public.vrm_tables_couverture();` — environ 5 « en écart » et
   ~87 « sans identité » (voir §1) ; `select raison, detail, count(*) from
   public.vrm_projection_ecarts group by 1,2;` les nomme.
7. Rien d'autre à faire : l'app ne lit pas encore ces tables.

**Couper la recopie** (sans rien perdre) : les quatre `alter table … disable trigger …`
en tête du fichier. **Annuler la 037** entièrement :
```sql
begin;
drop trigger if exists vrm_projection_ecrit on public.app_data;
drop trigger if exists vrm_projection_renomme on public.app_data;
drop trigger if exists vrm_projection_efface on public.app_data;
drop trigger if exists vrm_comptes_projection on public.vinted_accounts;
alter table public.numeros disable trigger vrm_numeros_immuable_tout;
drop table if exists public.annonces, public.ventes, public.achats, public.transactions, public.colis,
  public.emails, public.numeros, public.numeros_fiches, public.comptes,
  public.vrm_projection_sources, public.vrm_projection_ecarts, public.vrm_projection_remplissage;
commit;
```
(les DROP demandent une confirmation ; `app_data` n'est pas touchée ; les fonctions `vrm_t_*`
restantes sont inertes.)

## 7. Les étapes suivantes (plan — rien de fait)

**Étape 2 — lectures en OMBRE, derrière un drapeau serveur.**
- Réglage serveur `vrm_lecture_tables` (ligne `app_data` du propriétaire, écrite par le
  serveur seulement, comme `vrm_numerotation`) : `off` · `ombre` · `on`, par vendeur.
- En `ombre` : l'écran lit comme aujourd'hui ET lit la table ; il compare (identités,
  nombres, sommes au centime) et note les écarts dans une ligne `vrm_ombre_{date}` ;
  **l'écran affiche toujours l'ancienne lecture**. Ordre : Ventes (compteurs, liste
  paginée), Achats, transactions (preuve de vente), puis colis, annonces, numéros.
- Serveur d'abord (`api/widget.js`, `ship-reminders`, `api/_lib/ventes-regle.js`) :
  ils gagnent le plus (plus de relecture de la liste entière) ; règle par copie
  refabriquée par script, comme aujourd'hui.
- Ajouter Leboncoin / Vestiaire / eBay (038) après mesure de leurs formes ; brancher
  `vrm_tables_effacer_vendeur` dans la route d'effacement de compte.
- Preuve : banc « deux lectures, mêmes chiffres » sur copies, et 7 jours d'ombre sans écart
  chez Julien avant l'étape 3.

**Étape 3 — bascule**, écran par écran, `on` par vendeur (Julien d'abord), retour à `off`
en un geste. Les écritures restent dans `app_data` (le déclencheur recopie) : aucune
écriture de l'extension ne change, aucune version d'extension n'est requise.

**Étape 4 — nettoyage**, seulement après des semaines sans écart : l'extension et
`commandes-leger` écrivent directement les tables (nouvelle version d'extension, capacité
dans `EXT_CAPACITES`), les longues listes d'`app_data` deviennent des résumés, puis le
déclencheur est retiré. Chaque retrait avec sauvegarde (033 points de restauration) et
essai annulé d'abord. `main`, réglages et petites lignes restent en clé-valeur : elles
n'y perdent rien.

## Geste de Julien
Aucun pour l'instant. Quand il le décide : §6 (A puis B), ~5 minutes.

## ÉTAT À LA REPRISE (11 nov., arrêt demandé par Julien via la session principale)
- **Fait et poussé** (`claude/base-tables`) : 037 (tables, RLS, index, déclencheurs, remplissage, couverture, effacement vendeur), banc `scripts/audit-tables-typees-sql.cjs`, ce récit, ligne §9 de CLAUDE.md (58 971 octets).
- **Prouvé** : grande base ~50 000 lignes : 73 verts, 0 rouge, 6 mutations rouges (avant la dernière optimisation, puis `--petit` 67 verts sur la version allégée ; la grande mesure +36 ms a été prise sur la version allégée). Formes vérifiées en lecture seule sur la vraie base (§1).
- **Reste** : relancer une fois `node scripts/audit-tables-typees-sql.cjs` (sans `--petit`, ~4 min) sur la tête poussée pour confirmer ; aucune PR, rien fusionné, 037 pas appliquée ; la ligne « Fini, à intégrer » de `docs/passation/COORDINATION-AGENTS.md` (branche `claude/coordination`) n'est PAS écrite.
- **Prochaines étapes exactes** : intégrer la branche (fichiers neufs + une ligne §9, aucun conflit attendu) ; Julien : §6 (essai annulé puis Run, puis `vrm_tables_remplir(2000)` jusqu'à `fini`) ; puis étape 2 (§7 : drapeau `vrm_lecture_tables`, ombre sur Ventes et serveur d'abord ; 038 Leboncoin/Vestiaire/eBay après mesure).
- **Pièges** : ne jamais remettre `<> all(array)` ni recalculer toutes les commandes (220 ms par écriture) ; le raccourci « liste inchangée » n'est permis que si la copie est propre (`v_propre`) ; les fonctions `vrm_projeter*` doivent rester fermées à anon/authenticated (droits par défaut Supabase) ; familles PDF lues par `meta` seulement.
