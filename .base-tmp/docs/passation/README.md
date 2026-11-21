# Passation du 11 octobre 2026 (soir) — aux deux autres abonnements Claude

Julien a demandé ce compte rendu avant que cette session atteigne sa limite de
la semaine. **Lisez-le en entier, puis `CLAUDE.md` (il reste la référence).**
Julien ne veut plus de questions : tout ce qu'il a tranché est dans `CLAUDE.md`
§2 (règles permanentes, dont §2.8 et §2.9 ajoutées le 11) et §3 (refus et
propositions retenues du 11 octobre). Tranchez vous-mêmes, dites ce que vous
avez tranché.

---

## 🔴 LIRE D'ABORD — CONSIGNES DE REPRISE (12 octobre, 08:20 UTC)

La session d'origine atteint sa **limite de la semaine**. Julien a demandé des
consignes précises pour celle qui reprend. Ce qui suit **remplace** les
sections §0 à §5 quand elles se contredisent ; §6 et §7 restent valables.

### RÉPARTITION — Julien a DEUX agents (consigne du 12 octobre)

**Lis la colonne de ton rôle.** Julien te dit lequel tu es (« tu es l'agent 1 » /
« tu es l'agent 2 »). S'il ne l'a pas dit : `git fetch origin`, puis cherche un
journal déjà poussé (`git grep -l "AGENT 1" $(git branch -r | grep claude/) --
docs/passation/journal-agent-1.md`). **Un `journal-agent-1.md` existe déjà sur
une autre branche ⇒ tu es l'Agent 2 ; sinon tu es l'Agent 1** — et pousse ton
journal tout de suite, première chose, pour que l'autre le voie.

| | **AGENT 1 — « mise en ligne, eBay, agent »** | **AGENT 2 — « fonctionnalités, accueil, revue »** |
|---|---|---|
| fait, dans l'ordre | B (mettre la 5.175 en ligne, avec les photos) → C (migration 014) → D (règle d'offre eBay) → l'agent eBay (`notes/agent-ebay/spec-finale.md`, vagues §10, K14 GELÉ) | E (page d'accueil) → F (trier les 21 anciennes branches) → G (fonctions retenues, groupe par groupe, « Vitesse » en dernier) → H (revue complète, quand l'Agent 1 a fini D) |
| possède (lui seul modifie) | `api/ebay.js`, `api/_lib/ebay*`, tout ce qui commence par `Ebay` dans `src/App.jsx`, `supabase/migrations/014*` et `015*`, `scripts/agent-sql/`, `scripts/audit-ebay-*`, `scripts/prouve-*regle*`, `scripts/bancs/ebay-*` | `src/Accueil.jsx`, `public/legal/`, `scripts/film-accueil.cjs`, tout le reste de `src/App.jsx`, `vinted-sync-extension/`, `public/VRM-extension.zip`, les migrations **020 et au-delà** |
| versions d'extension | **5.190 → 5.199** (seulement s'il doit toucher l'extension — normalement jamais) | **5.176 → 5.189** |
| première PR vers `main` | la sienne (étape B) — **c'est elle qui part en premier** | **pas avant** que la PR de la 5.175 de l'Agent 1 soit mergée (`git log origin/main` le dit) ; ensuite `git merge origin/main` avant chaque PR |
| journal à tenir | `docs/passation/journal-agent-1.md` sur SA branche, poussé | `docs/passation/journal-agent-2.md` sur SA branche, poussé |

**Coordination (les deux agents ne se parlent que par git)** :
- Chacun part de `origin/claude/project-review-nsk5su` (tête `e2d377c` ou plus
  récente) sur **sa propre branche** (celle que son environnement lui donne),
  et pousse à chaque modification.
- Chacun tient son **journal** (ce qu'il fait maintenant, ce qui est fini, la
  version d'extension qu'il a prise, les fichiers hors de son domaine qu'il a
  dû toucher et pourquoi). **Avant de commencer une étape, et avant chaque PR**,
  `git fetch origin` puis lire le journal de l'autre :
  `git branch -r | grep claude/` puis
  `git show origin/<branche-de-l-autre>:docs/passation/journal-agent-N.md`.
- Un fichier qui appartient à l'autre : n'y touche que si c'est indispensable,
  dis-le dans ton journal **avant** de pousser, et garde le changement minimal.
  `CLAUDE.md` est commun : chacun ajoute SES sections ; au merge, on garde les
  deux.
- Tout passe en production par PR vers `main`, l'une après l'autre ; jamais
  deux PR mergées dans la même heure sans `git merge origin/main` +
  build + audits entre les deux. Plafond Vercel commun : **100 déploiements /
  24 h**.
- Si l'Agent 1 n'a pas mergé la 5.175 quand l'Agent 2 est prêt à mettre en
  ligne, l'Agent 2 attend : il n'emporte PAS l'intégration à sa place (elle
  serait livrée sans les photos ni la vérification de l'étape B).
- Chacun parle à Julien dans sa propre session : pas de questions, une phrase
  quand quelque chose est en ligne ou quand un geste lui revient (§7).

### A. Où est chaque morceau de travail, exactement

| morceau | où le prendre | tête | état |
|---|---|---|---|
| **Intégration à mettre en ligne** (extension **5.175.0**) | `origin/claude/project-review-nsk5su` | `e2d377c`, ou un commit plus récent de la session d'origine | Relecture croisée **faite** : 4 défauts corrigés (`c658216`, `19df09a`, `e2d377c`) — liste : `notes/croisee-5174/defauts-corriges-en-c658216.json`. **Les bancs de la vérification finale tournaient encore** à l'arrêt : à refaire (Agent 1, B). |
| **Photos, second tour** (correctif de la plainte « plus de photos ») | paquet `branches-2026-10-12.bundle`, branche `passation2/photos-r2` | `bf63bca` (au-dessus de `c7efee0`, déjà dans l'intégration) | 13 défauts signalés, 7 confirmés (5 défauts distincts), **tous corrigés et prouvés** (audit-photos-vinted 50 contrôles, 26 mutations ; banc photos-vinted 166 contrôles). **À fusionner AVANT la mise en ligne.** Le correctif ne touche que l'app : aucune nouvelle version d'extension. |
| **K3 : migration 014** (mémoire de l'agent eBay) | même paquet, `passation2/k3-014` | `9df8061` (au-dessus de `9dcd405`, déjà dans l'intégration) | Revue 2 : 5 défauts confirmés, **corrigés** (liste : `notes/k3/defauts-revue2-corriges-en-9df8061.json`). Une **3ᵉ relecture tournait**, sans résultat rendu. ~~PAS appliquée en production.~~ ✅ appliquée le 12 oct. 20:35 UTC (`vrm_agent_memory_014`, vérifiée le 22 oct.). |
| **Règle d'offre eBay** (seuil natif, décision du 9 oct.) | même paquet, `passation2/regle-offre` | `00a9d92` | Tours 1 à 3 corrigés. **Tour 4 sur `00a9d92` : 6 défauts CONFIRMÉS + 5 pas encore jugés** — liste complète, avec la sonde, la commande et la sortie de chacun : `notes/regle-offre/defauts-tour4-sur-00a9d92.json`. |
| **Page d'accueil refaite + film** | même paquet, `passation2/accueil` | `a78fbc9` | Construite. La vérification au rendu et la revue adverse n'ont **pas** été faites. |
| **21 anciennes branches** (propositions du 8 oct., pointage, coffre, compte de résultat, boutique Chrome, PDF dans le stockage…) | `branches-locales-2026-10-11.bundle` | voir §3 | à trier (Agent 2, F) |
| **Fonctions retenues par Julien le 11 oct.** | rien de commité | — | à construire (Agent 2, G) |

Récupérer les deux paquets (depuis une copie de la branche à jour) :
```
git fetch origin claude/project-review-nsk5su main
git checkout -B <ta-branche> origin/claude/project-review-nsk5su
git fetch docs/passation/branches-2026-10-12.bundle 'refs/heads/passation2/*:refs/remotes/passation2/*'
git fetch docs/passation/branches-locales-2026-10-11.bundle 'refs/heads/*:refs/remotes/passation/*'
git branch -r | grep passation
```
Les scripts de workflow de `docs/passation/workflows/` portent des chemins de
la machine d'origine (`/home/user/cancale-v67/.claude/worktrees/…`,
`/tmp/claude-0/…/scratchpad/…`) : **adapte-les** à ta copie avant de les
relancer, et passe les listes de défauts en `args`.

### B. AGENT 1 · Étape 1 — mettre la 5.175 en ligne (c'est ce que Julien attend)

1. Sur ta branche (copie de `origin/claude/project-review-nsk5su`) :
   `git merge passation2/photos-r2`. Conflits attendus : **CLAUDE.md** (garde
   les DEUX sections photos — « revue du 11 octobre » et « seconde revue du
   11 octobre » — et la section « Relecture croisée de la 5.174 ») et peut-être
   `src/App.jsx` autour de `PhotoVinted` / la phrase des photos : garde le
   comportement de `bf63bca` (un refus de l'extension n'est **jamais**
   définitif ; `estDefinitive` rend toujours faux) **et** les corrections de la
   relecture croisée. Jamais `-s ours`.
2. `npm ci` si besoin, puis `npm run build`.
3. Tous les audits : `for f in scripts/audit-*.cjs; do node "$f" >/tmp/a.log 2>&1 || echo "ROUGE $f"; done`.
   `audit-renum-b.cjs` (~5 min, Postgres local) et `audit-agent-sql.cjs`
   (Postgres jetable) peuvent être sautés s'il n'y a pas de Postgres — **dis-le**.
   Tout autre rouge se corrige avant d'aller plus loin.
4. Les bancs, **un par un** (ils se gênent en parallèle) :
   `bash docs/passation/workflows/verif-integ.sh photos-vinted pont popup session deux-extensions supprimees enligne lbc-preuve ebay-annonces ebay-programmer ebay-form tout-generer notif-messages comptes-sans-email detourage detourage-reglage badge capacites premierjour publier repondre double-vente vendu-recu messagerie statuts-colis ventes-bordereau annonces-carte`
   (lis le script d'abord : il crée un lien temporaire vers `fx/`). Les bancs
   qui lisent les fixtures réelles (`verif_visuel`, `verif_dark`, `colis`,
   `comptes`, `retrait`, `urssaf`…) ont besoin de `scripts/bancs/fx/`, qui
   n'est **pas** dans le dépôt (public). Pour l'obtenir :
   `node scripts/bancs/copie-fixtures.mjs <SUPABASE_URL> <ANON_KEY>` — en
   lecture seule ; **ne jamais commiter `fx/`** (`audit-bancs.cjs` le refuse).
   Pas de clé ? Dis lesquels n'ont pas tourné, ne prétends rien.
   Un banc chronométré qui rate une fois se relance **seul** avant de conclure.
5. `git merge origin/main` (vrai merge ; `main` = `2fed734` doit déjà être
   un ancêtre, donc rien ne doit changer) puis
   `git diff origin/main --stat` : seuls les fichiers des chantiers.
6. PR vers `main` (outil GitHub `create_pull_request`), puis
   `merge_pull_request` avec le **SHA complet de 40 caractères** de la tête.
7. Vérifier la mise en ligne avec l'outil **Vercel** (vrm.center est bloqué
   par le proxy du conteneur) : `list_deployments` du projet → le déploiement
   du commit de merge est **READY** ; `web_fetch_vercel_url` sur
   `https://vrm.center/api/sante` répond ; le zip servi
   (`/VRM-extension.zip`) est bien celui de la 5.175 (taille identique à
   `public/VRM-extension.zip`). Plafond : 100 déploiements / 24 h ; **ne
   jamais promouvoir une prévisualisation**.
8. Envoyer à Julien, en clair, une fois :
   « La 5.175 est en ligne. Quand tu pourras : télécharge-la depuis Réglages
   (ou vrm.center/VRM-extension.zip), dézippe-la en UN dossier, puis dans
   chrome://extensions **de chaque profil Chrome** supprime toute autre copie
   de VRM, charge ce dossier, clique ⟳, recharge tes onglets Vinted. Ensuite
   passe une fois sur arthuror2 et tomj683. » Il a dit le 11 qu'il ne pouvait
   pas l'installer tout de suite : **ne pas insister**.

### C. AGENT 1 · Étape 2 — migration 014 (K3)

1. Partir de `passation2/k3-014` (`9df8061`). Faire la **3ᵉ relecture
   adverse** (modèle : `workflows/k3-revue-2-wf_25506800-353.js`) : deux
   relecteurs qui REPRODUISENT sur un Postgres jetable
   (`node scripts/audit-agent-sql.cjs` lance le sien ; il dit s'il ne trouve
   pas Postgres), deux sceptiques par défaut, correction prouvée (rouge sur la
   tête d'avant, vert après, rouge sous mutation — `--prouve`), jusqu'à **deux
   tours sans défaut neuf**. Ne pas re-signaler ce qui est dans
   `notes/k3/defauts-revue2-corriges-en-9df8061.json`.
2. Fusionner dans l'intégration (elle n'ajoute que la migration, ses scripts,
   son audit et sa section de CLAUDE.md — aucun effet tant qu'elle n'est pas
   appliquée), PR, merge.
3. **Essai annulé sur la vraie base**, avec l'outil SQL Supabase (projet
   `lgonxzrzjcqthjtbdpzo`) : `node scripts/agent-sql/essai-annule.cjs >
   essai.sql`, coller son contenu dans `execute_sql` (une transaction, un
   rapport JSON d'une ligne, puis ROLLBACK). Vérifier ensuite qu'**il ne reste
   rien** (`select count(*) from pg_tables where tablename like 'vrm_agent%'`
   = 0, et aucun déclencheur `vrm_agent%` sur `app_data`). Si l'outil refuse le
   bloc : `--morceaux --dossier=…`, trois transactions dans l'ordre.
4. Appliquer la migration (le fichier, tel quel), puis
   `node scripts/agent-sql/essai-annule.cjs --verifier > verifier.sql` →
   `execute_sql` → `ok` doit valoir **true** ; sinon `ecarts` dit quoi.
5. Consigner dans CLAUDE.md (« APPLIQUÉE le … à … UTC », comme la 013).
   `vrm_reglages.agent_ebay` reste `'0'` : rien ne tourne. **Aucun DROP**
   (l'outil exige alors une confirmation humaine).

### D. AGENT 1 · Étape 3 — règle d'offre eBay

1. Partir de `passation2/regle-offre` (`00a9d92`). Lire
   `notes/regle-offre/defauts-tour4-sur-00a9d92.json` **en entier** (chaque
   entrée porte `reproduction` : sonde, commande, sortie, cause ; et les deux
   votes des sceptiques).
2. **Corriger les 6 confirmés** (numéros 0, 2, 3, 4, 5, 6) :
   - **0 (haute)** — une relecture qui CONTREDIT l'écriture (après un
     « Success » d'eBay, ou un 503 sans `<Ack>`) est rangée comme « aucune
     règle » : VRM oublie une règle qu'eBay applique peut-être. ⇒ une relecture
     qui contredit une écriture récente vaut « pas su », pas « aucune ».
   - **2** — planificateur / publication après un premier envoi sans réponse :
     l'annonce existe chez eBay avec sa règle, VRM ne range jamais la règle.
   - **3** — « Relire mes ventes eBay » échoue en silence.
   - **4 et 6** — une règle active sur une annonce dans une **autre devise**
     que l'euro n'est comptée nulle part (« ce que ça engage », relecture des
     ventes, déconnexion, « Fermer mon compte ») et la carte propose quand même
     « Définir » (feuille en euros, refusée ensuite par la route).
   - **5** — ✏️ / « Baisser sur eBay » : la phrase sur la règle ignore le
     **refus** (`MinimumBestOfferPrice`) : « dès 0,00 € n'est plus sur
     l'annonce » alors qu'eBay garde le refus.
3. **Juger toi-même les 5 non jugés** (7 à 11) : reproduis chacun sur une
   copie ; s'il ne se reproduit pas, ou si c'est du style, ou s'il existe tel
   quel avant le chantier, écarte-le en le disant. Sinon corrige-le.
4. Puis relecture adverse jusqu'à **deux tours sans défaut neuf**
   (`workflows/regle-offre-tour-3.js`, adapté).
5. Fusionner dans l'intégration : **gros conflit attendu** (`src/App.jsx`,
   `api/ebay.js`, CLAUDE.md — la branche part de `cdc9c1d`, avant la 013, la
   preuve de vente et la relecture croisée). Vrai merge dans une copie, puis
   build, tous les audits (surtout `audit-ebay-route.cjs`,
   `audit-offres-auto.cjs`, `prouve-regle-offre.cjs`), les bancs eBay
   (`ebay-regle-offre`, `ebay-annonces`, `ebay-programmer`, `ebay-form`,
   `ebay-comptes`, `annonces-carte`) et relire le diff contre l'intégration.
   Aucune version d'extension (elle ne la touche pas). PR, merge.
6. Ensuite seulement : l'agent eBay (§4.4 et `notes/agent-ebay/spec-finale.md`
   — **§0bis : l'acheteur paie le bordereau, K14 GELÉ**). K0 = règle d'offre +
   multi-comptes (fini en D), K3 = la 014 (fini en C) ; ensuite vague 2 :
   K1 ‖ K2, puis K4 ‖ K12, etc. Le battement pg_cron/pg_net est la migration
   **015** (essai annulé d'abord). Modèle : `workflows/chantier-agent-ebay.js`.

### E. AGENT 2 · Étape 1 — page d'accueil

Partir de `passation2/accueil` (`a78fbc9`), finir selon `notes/accueil/spec.md`,
puis : rendu aux deux tailles (390 et 1512 px) ; relecture adverse
(honnêteté : prix lu dans les CGV — **12,99 €** —, aucun chiffre de clientèle
ni étoile, aucune adresse en dur, `src/contact.js` seul) ; bancs
`accueil.cjs` et `demarrage.cjs` ; poids avant l'app (mesuré 248,5 Ko, à ne pas
dépasser sans raison) ; film régénéré par `scripts/film-accueil.cjs` (les MP4
ne montent pas dans le dépôt). PR, merge.

### F. AGENT 2 · Étape 2 — trier les 21 anciennes branches (§3)

Une par une : `git merge-tree --write-tree <intégration> passation/<branche>`,
lire ses commits, puis si elle apporte encore quelque chose : vrai merge dans
une copie, build, tous les audits, bancs touchés, relecture du diff (une
vieille branche peut **défaire** une correction récente). Les trois
« probablement déjà fusionnées » (§3) : vérifier puis les laisser.

### G. AGENT 2 · Étape 3 — les fonctions retenues par Julien (11 octobre)

Liste exacte et refus : CLAUDE.md §3. **Ne jamais reproposer un refus**
(7, 8, 12, 19, 20, 26-32, 36). Par groupe, chacun : mesurer la vraie base en
lecture seule, construire, deux relecteurs qui reproduisent, deux sceptiques,
corriger, prouver (rouge avant / vert après / rouge sous mutation), PR :
- **Argent et stock** : 1 prix d'achat au numérotage, 11 fiche à l'arrivée
  d'un achat, 14 bénéfice réel (avec sa couverture), 18 achats à vérifier
  avant la date limite (ne pas inventer le délai de Vinted), 21 retour reçu →
  la paire revient en stock (attention : un ancien numéro ne se redonne
  jamais, 013).
- **Alertes** : 2 double vente app fermée (notification serveur dès qu'une
  vente Vinted est apprise par email, identité par N°), 3 rappel URSSAF à
  l'échéance, 10 rappel la veille au soir (aucun nouveau cron Vercel sans
  preuve qu'il passe), 6 page « tout va bien ? ».
- **Ventes** : 13 plan des paires qui dorment, 22 favoris sans vente (remise
  NATIVE de Vinted), 23 boost rentable ?, 24 compte qui vend le mieux, 25 ce
  qui part vite.
- **Terrain** : 9 codes de retrait hors ligne, 34 saisie vocale (Web Speech,
  sans clé), 16 réponses rapides, 35 traduction (traducteur intégré de Chrome,
  sinon lien, sinon la clé DU VENDEUR — §2.9), 4 fiche « republier » (copie,
  rien d'automatique).
- **Studio photo** : 33 cadre guide + détourage local (licence commerciale
  vérifiée, pas d'AGPL), sinon la clé Photoroom DU VENDEUR (§2.9).
- **Comptes** : 37 mode équipe (RLS, migration avec essai annulé),
  17 double vérification de connexion, 15 récap mensuel pour le comptable.
- **Vitesse** (5) : **en dernier, seule**.
Versions d'extension de l'Agent 2 : **5.176 → 5.189**, dans l'ordre (l'Agent 1
a 5.190 → 5.199). Le groupe « Alertes » touche `api/` (push, rappels) : pas
`api/ebay.js`, qui est à l'Agent 1. Avant de poser une capacité
dans `EXT_CAPACITES`, vérifier quelle version la PUBLIE
(`scripts/_versions-publiees.cjs`).

### H. AGENT 2 · Étape 4 — revue complète de l'app (quand l'Agent 1 a fini D)

Un workflow par zone (écrans, `api/`, extension, données) : trouver →
reproduire → réfuter → corriger, jusqu'à deux tours sans rien de neuf, puis
un déploiement.

### I. LES DEUX — ce qu'il ne faut JAMAIS faire (rappel court)

Poser une question à Julien (il a tout autorisé : trancher et dire ce qui a
été tranché) · écrire dans la base de production hors d'une migration passée
par son essai annulé · appeler Vinted, eBay ou Leboncoin depuis un agent ·
commiter une fixture réelle · accepter une offre Vinted automatiquement ·
acheter une étiquette avec son argent (§2.8) · faire payer sur SA clé une
fonction utilisée par un autre vendeur (§2.9) · `git merge -s ours` · un
identifiant de modèle dans un commit · retirer un garde-fou de l'extension.

---

## 0. MISE À JOUR — 12 octobre, 05:30 UTC : la session d'origine CONTINUE

La limite atteinte le 11 au soir était celle de la session (5 h), pas celle de
la semaine : la session d'origine a repris le 12 à 05:20 UTC. **Avant de
commencer quoi que ce soit, regardez `git log origin/claude/project-review-nsk5su`
et cette section** : ce qui y est marqué « en cours » est déjà pris.

- Vérification de la 5.174 : **faite** — build vert, 92 audits verts, 30 bancs
  verts (les deux rouges `ebay-annonces` et `lbc-preuve` venaient des bancs :
  leur extension simulée n'avait pas le champ `code` des 5.171+, corrigé en
  0caff0d).
- **En cours (session d'origine)** : relecture croisée de la 5.174 avant mise en
  ligne (compatibilité avec ses extensions actuelles — il ne peut pas mettre à
  jour —, fusions de `background.js`, écrans) ; correction du second tour de
  revue des photos ; correction du second tour de revue de la migration 014
  (5 défauts confirmés, dont « Fermer mon compte » pendant un battement) ;
  tour 2 de la règle d'offre eBay (corrigée en `c4fa405`, relecture en cours).
- Si cette session s'arrête de nouveau, ces chantiers reprennent depuis les
  branches du paquet (§3) et les listes de défauts dans `docs/passation/notes/`.
- **Relecture croisée de la 5.174 : faite (12 octobre)** — 4 défauts reproduits
  et corrigés, l'extension passe en **5.175.0** (la 5.174 ne sera jamais
  livrée) : (1-2) une 5.164/5.170 sans session, morte, sur un autre compte VRM,
  ou après « Se déconnecter » puis reconnexion, n'était plus jamais reconnectée
  (la production le faisait — voie `page` rétablie, resserrée) ; (3) un échec
  passager (base, 429, 401, réseau) cachait une vente 6 h à l'anti double vente
  (+ codes de retrait 6 h, versements 24 h) ; (4) eBay → Annonces proposait
  « génère son bordereau » devant un bouton grisé. Détail et preuves : CLAUDE.md,
  « Relecture croisée de la 5.174 ».

## 1. Ce qui est EN PRODUCTION (main, vrm.center)

| PR | contenu | extension |
|---|---|---|
| [julatace/cancale-v67#473](https://github.com/julatace/cancale-v67/pull/473) | Annonces = les paires en ligne maintenant (relecture publique des autres comptes, « à confirmer »), suppressions vues, revues 5.165 et 5.167 | **5.170.0** (zip servi) |
| [julatace/cancale-v67#474](https://github.com/julatace/cancale-v67/pull/474) | Photos Vinted de retour (référent coupé, secours par l'extension, mesure `diag_photos`) + §2.8 « l'acheteur paie le bordereau eBay » | inchangée |

- Migration **013** (anciens numéros en B) **appliquée** le 11 à 14:58 UTC.
- ⚠️ Julien **n'a pas encore installé** la 5.170 (il ne peut pas en ce moment).
  Il installera UNE seule fois la prochaine version (5.175, voir §2).
- `diag_photos` était encore absent en base à 20:40 UTC : soit il n'a pas rouvert
  VRM, soit les photos s'affichent (la mesure ne s'écrit qu'au premier échec).

## 2. Ce qui est sur la branche d'intégration, PAS encore en production

Branche distante **`claude/project-review-nsk5su`** (tête au moment de la
passation : voir `git log`). Contenu au-dessus de main :

1. **Preuve de vente eBay** (plainte du 11 : vente eBay du 10 ni retirée ni
   signalée) — bordereau capté comme preuve, transaction relue, marqueur 013,
   retrait automatique relancé par la cloche. 13 défauts de revue corrigés.
2. **Connexion de l'extension** — « Se connecter » passe par VRM (session
   adressée `liaison` + nonce), le code périmé se répare, dépôt Leboncoin « pas
   su » au lieu d'« échec » (plus de double dépôt).
3. **Notifications de messages** — la paire nommée, Message-ID comme identité,
   préférences et appareils jamais perdus, comptes sans email signalés (⚠️ la
   cause « Masquer mon adresse d'Apple » n'est PAS prouvée — voir la section
   notifications de CLAUDE.md), l'IA de réponse ne refacture plus, détourage
   plafonné à 100/mois.
4. **K3 : migration 014** (mémoire de l'agent eBay) — ~~fichier seulement, PAS
   appliquée~~ (✅ appliquée le 12 oct., vérifiée le 22) ; audit `scripts/audit-agent-sql.cjs` (193 contrôles, 66
   mutations).
5. **Extension 5.175.0** réunissant 1, 2 et 3, plus la relecture croisée du
   12 octobre (les 5.171, 5.172, 5.173 et 5.174 n'ont **jamais** été publiées :
   ne les réutilisez pas).
6. CLAUDE.md §2.8, §2.9, §3 (choix de Julien du 11).

**À faire pour la mettre en ligne (Session 1, §4)** : la vérification complète
était en cours au moment de la passation — **relancez-la** :
`npm run build`, tous les `scripts/audit-*.cjs` (93), et un par un les bancs
listés dans `docs/passation/workflows/verif-integ.sh` (appel d'origine :
`verif-integ.sh plaintes badge comptes-sans-email detourage-reglage detourage
deux-extensions ebay-annonces enligne lbc-preuve leboncoin notif-messages pont
popup premierjour publier repondre session supprimees tout-generer photos-vinted
annonces-carte ebay-programmer ebay-form capacites double-vente vendu-recu
messagerie statuts-colis ventes-bordereau verif_visuel verif_dark colis`).
Les fixtures réelles `scripts/bancs/fx/` ne sont PAS dans le dépôt (public) :
les bancs qui en ont besoin ne tournent que là où elles existent ; dites-le si
vous ne pouvez pas les lancer.
Puis une **relecture croisée** des trois chantiers ensemble (ils ont été relus
séparément ; leurs interactions — liaison × promesse eBay × notifications — ne
l'ont pas été), puis PR vers `main`, merge, vérifier le déploiement Vercel
(READY) et `/api/sante` avec l'outil Vercel (`web_fetch_vercel_url` — vrm.center
est bloqué par le proxy du conteneur), puis **envoyer le zip 5.175 à Julien**
avec la consigne : un seul dossier, retirer toute autre copie de VRM dans
`chrome://extensions` **dans chaque profil Chrome**, cliquer ⟳ **dans chaque
Chrome**, recharger les onglets Vinted.

## 3. Le travail qui n'existait QUE sur la machine de cette session

Sauvé dans **`docs/passation/branches-locales-2026-10-11.bundle`** (21
branches, prérequis = le commit `818d399` de l'intégration). Pour récupérer :

```
git fetch docs/passation/branches-locales-2026-10-11.bundle 'refs/heads/*:refs/remotes/passation/*'
git branch -r | grep passation/
```

Puis, pour chaque branche, `git merge-tree --write-tree <intégration> passation/<branche>`
et la lecture de ses commits disent ce qu'elle apporte. **Aucune n'est dans
l'intégration ni en production** (vérifié : chacune changerait l'arbre).

| branche | quoi | état connu |
|---|---|---|
| `worktree-wf_30feaf2f-334-8` | **Règle d'offre eBay** (seuil natif `BestOfferAutoAcceptPrice`, décision du 9 oct.) — bâtie SUR le multi-comptes eBay | 2 tours de revue faits ; **7 défauts restants** (dont 1 haute : « Modifier le prix / le stock » renvoie l'ancien prix après un 409) — liste et sondes : `notes/regle-offre/defauts-restants-tour2.json` ; un 3ᵉ tour tournait (`workflows/regle-offre-tour-3.js`) |
| `worktree-wf_d62e1db4-b5c-1` | **eBay plusieurs comptes** (une connexion, plusieurs comptes eBay) — la base de la règle d'offre | côté app terminé, banc et dossier ; contenu dans la branche précédente |
| `worktree-wf_e364d40c-3ea-9` | **Page d'accueil publique refaite + film** (direction « Le revendeur d'abord ») | en construction (`notes/accueil/spec.md`, 1 330 lignes) ; vérification et revue pas faites |
| `worktree-wf_373b8e87-1d6-1` … `-8` | **Propositions du 8 octobre** : litiges (1), messages à répondre (2), synchro de `main` par morceaux (3), copies (4), « Tes connexions » (5), achats pas encore postés (6), rappel URSSAF selon le rythme de chaque vendeur (7), propriétaire/prénom (8) | revues du 9 octobre faites pour plusieurs ; **à trier, revérifier sur l'intégration actuelle, fusionner** |
| `worktree-wf_cb6f835a-c5a-1` / `-2` | **Pointage du stock carton par carton** / **Retrouver une annonce disparue** (coffre) | revue du 9 octobre corrigée et prouvée (`-2`) ; à fusionner après revérification |
| `worktree-wf_c713efbe-040-2` | **Compte de résultat** (banc compta-resultat) | à trier |
| `worktree-wf_133587f0-45f-4` / `-5` | **Boutique Chrome** (dossier de dépôt, zip au format boutique, audit-store) / un WIP interrompu | `-5` = « WIP (agent interrompu) » : à reprendre ou jeter |
| `pdf/app-lecture`, `worktree-wf_6f1cc0ad-b1e-1` | **PDF de bordereaux dans le stockage de fichiers**, étape 2 (l'app lit les deux formes) + un WIP interrompu | voir la section « PDF de bordereaux — étape 0 » de CLAUDE.md pour la suite (étapes 1 à 4) |
| `worktree-agent-a14d457d6195c5613`, `wf-banc-statuts`, `wf-ext-notifs` | anciens chantiers (eBay par vendeur, banc statuts, extension 5.155) | **probablement déjà fusionnés sous une autre forme** (leurs fonctions sont en production) : vérifier avant de toucher, ne pas réintroduire du vieux code |

⚠️ Une branche ancienne fusionnée telle quelle peut **défaire** une correction
plus récente : toujours un vrai `git merge` dans une copie, puis build, tous les
audits, les bancs touchés, et relire le diff contre l'intégration.

Les chantiers lancés en toute fin de session (`feat-argent`, `feat-alertes`, et
les tours de revue photos/K3) n'avaient encore rien commité : **à refaire**
depuis la liste de §5 (le script `workflows/chantier-fonctions.js` est le
modèle utilisé).

## 4. SESSION 1 — « Mise en ligne, eBay et l'agent »

Dans l'ordre :

1. **Mettre la 5.175 en ligne** (§2) — c'est ce que Julien attend : sa connexion
   d'extension, ses notifications, l'anti double vente eBay.
2. **Règle d'offre eBay** : récupérer `passation/worktree-wf_30feaf2f-334-8`,
   corriger les 7 défauts restants (sondes fournies), relire adversairement
   jusqu'à deux tours sans défaut neuf, puis fusionner dans l'intégration (gros
   conflit attendu sur `src/App.jsx` et `api/ebay.js` : la branche part de
   `cdc9c1d`, avant la numérotation 013 et la preuve de vente). Elle ne change
   pas l'extension.
3. **Migration 014** : un second tour de revue (concurrence, droits, R18, chemin
   d'application) puis **essai annulé sur la vraie base**
   (`node scripts/agent-sql/essai-annule.cjs` — rapport, ROLLBACK, rien ne
   reste ; vérifier qu'il ne reste rien), application, `--verifier`. Même
   méthode que la 013 (section de CLAUDE.md). Un `DROP` exige une confirmation
   humaine dans l'outil SQL : il n'y en a aucun.
4. **L'agent eBay autonome** — spécification complète :
   `notes/agent-ebay/spec-finale.md` (18 chantiers K0–K17, vagues en §10).
   K0 = la règle d'offre + le multi-comptes (point 2), K3 = la 014 (point 3).
   Ensuite vague 2 : K1 ‖ K2, puis K4 ‖ K12, etc. **§0bis : l'acheteur paie le
   bordereau ; K14 (étiquettes achetées par VRM) est GELÉ.** Le battement
   pg_cron/pg_net est accepté (migration 015, après essai annulé).
   Le modèle de workflow : `workflows/chantier-agent-ebay.js`.

## 5. SESSION 2 — « Fonctionnalités, accueil et revue »

1. **Trier et fusionner les branches de §3** (sauf la règle d'offre et
   l'agent, qui sont à la Session 1) : les propositions du 8 octobre, pointage,
   retrouver une annonce, compte de résultat, boutique Chrome, PDF stockage —
   chacune revérifiée sur l'intégration actuelle.
2. **Page d'accueil + film** : récupérer `passation/worktree-wf_e364d40c-3ea-9`,
   finir selon `notes/accueil/spec.md`, vérifier au rendu aux deux tailles,
   relire adversairement (honnêteté : prix lu dans les CGV — 12,99 € —, aucun
   chiffre de clientèle, aucune adresse en dur), exporter le film
   (`scripts/film-accueil.cjs`, les MP4 ne montent pas dans le dépôt).
3. **Les fonctions retenues par Julien le 11 octobre** (liste exacte : CLAUDE.md
   §3 « Retenu par Julien le 11 octobre »), par groupes, chacun : mesurer,
   construire, deux relectures adverses qui reproduisent, réfuter, corriger :
   - **Argent et stock** : prix d'achat demandé au numérotage (8 paires sur 401
     en ont un), fiche prête à l'arrivée d'un achat, bénéfice réel avec sa
     couverture, achats à vérifier avant la date limite (ne pas inventer le
     délai de Vinted), retour reçu → la paire revient en stock (013 !).
   - **Alertes** : double vente app fermée (notification serveur dès qu'une
     vente Vinted est apprise, identité par N°, « gel » sans paire), rappel
     URSSAF à l'échéance, rappel la veille au soir (sans cron Vercel refusé),
     page « tout va bien ? ».
   - **Ventes** : plan des paires qui dorment, favoris sans vente (remise
     native), boost rentable ?, compte qui vend le mieux, ce qui part vite.
   - **Terrain** : codes de retrait hors ligne, saisie vocale (Web Speech, sans
     clé), réponses rapides, traduction des messages (traducteur intégré de
     Chrome, sinon lien de traduction, sinon la clé DU VENDEUR — §2.9), fiche
     « republier » (copie manuelle, rien d'automatique, §3).
   - **Studio photo** : cadre guide + détourage local dans la page (licence à
     vérifier : pas d'AGPL ni de licence non commerciale), sinon la clé Photoroom
     DU VENDEUR (§2.9).
   - **Comptes** : mode équipe (accès limité aux colis et codes, RLS — migration
     avec essai annulé), double vérification de connexion, récap mensuel pour le
     comptable.
   - **Vitesse** (écrans chargés à la demande) : **en dernier, seul** (il touche
     toute l'app).
4. **La revue complète de l'app** (écran par écran, jusqu'à deux tours sans
   rien de neuf).

## 6. Règles de coordination entre les deux sessions

- **Chacune sa branche** (celle que son environnement lui donne). On ne
  travaille jamais à deux sur la même. On met en ligne par PR vers `main` ;
  avant chaque PR : `git fetch` puis **`git merge origin/main` (vrai merge,
  jamais `-s ours`)**, conflits résolus à la main, puis build + audits + bancs.
- **Numéros d'extension** : la prochaine publiée est **5.175.0** (l'intégration,
  relecture croisée comprise — la 5.174 ne sera jamais livrée). Ensuite
  **Session 1 : 5.190 à 5.199**, **Session 2 : 5.176 à 5.189**. Un
  numéro publié ne change jamais de contenu ; deux contenus ne portent jamais
  le même numéro ; une capacité (`EXT_CAPACITES`) porte la version qui la
  PUBLIE (lire l'historique de main avant de la poser — `scripts/_versions-publiees.cjs`).
- **Vercel** : seul `main` se déploie (les branches `claude/**` sont coupées) ;
  plafond 100 déploiements / 24 h ; ne jamais « promouvoir » une
  prévisualisation (les clés de production n'y sont pas).
- **Base de production** : lecture seule (SELECT projetés) ; une migration ne
  s'applique qu'après son essai annulé sur la vraie base ; jamais une ligne de
  test en production.
- **Jamais** : appeler Vinted/eBay/Leboncoin depuis un agent ; une fixture
  réelle dans le dépôt (public) ; accepter une offre Vinted automatiquement ;
  dépenser l'argent de Julien pour une étiquette ; une fonction payante sur sa
  clé pour un autre vendeur.

## 7. Ce que seul Julien peut faire (à lui rappeler, une fois, sans insister)

- Installer l'extension **5.175** quand il pourra (un dossier, retirer les
  autres copies dans chaque profil Chrome, ⟳ dans chaque Chrome). Une vieille
  copie sans session fige **arthuror2** et **tomj683**.
- Sur angeled92, tomj606 et arthuror2 : vérifier les **notifications email de
  Vinted** (aucun email n'arrive à VRM ; Réglages → Notifications le dira avec
  la 5.175).
- Stripe : recréer le prix **12,99 €** (clé `vrm_mensuel`, transférer la clé) ;
  tant que ce n'est pas fait, le paiement reste fermé (voulu).
- Supabase → URL Configuration (Site URL `https://vrm.center`) et un SMTP.
- Regarder les cartons des 6 paires renumérotées le 29 septembre (543…552,
  section 013 de CLAUDE.md).
- eBay : terminer l'annonce **128127336988** (N°1, vendue) ; relier l'Air Max 1
  **128101592740** à sa paire (SKU) ; savoir que revendre en particulier peut
  exiger un compte pro (aide eBay).
- Saisir ses prix d'achat (l'écran trie les paires vendues d'abord).
