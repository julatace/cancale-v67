# 12 nov. 2026 — Fiabilité de la production (second agent, `claude/agent2-fiabilite-prod`)

Validé par Julien (« indispensable ») : sauvegardes vérifiées + restauration testée, base
d'essai séparée, surveillance toutes les 5 min, retour arrière en un geste.
**Aucune écriture dans la base de production** (lectures SQL seulement), aucune restauration
réelle, rien créé chez Supabase / Vercel / UptimeRobot. Guide de Julien :
`docs/passation/2026-11-12-guide-fiabilite-julien.md`.

## 1. Ce qui a été MESURÉ (lecture seule, 12 nov.)

| quoi | état |
|---|---|
| plan Supabase (organisation « cancale ») | **Pro** ⇒ sauvegarde quotidienne physique, 7 jours (doc « Database Backups » relue) |
| PITR | pas activé (option ~100 $/mois ; l'activer ARRÊTE les sauvegardes quotidiennes) |
| copie chiffrée GitHub (`sauvegarde.yml`, 6 nov.) | **n'a jamais tourné** : chaque nuit en échec, secrets `SUPABASE_DB_URL` et `SAUVEGARDE_PHRASE` absents |
| points de restauration (033) | trigger `vrm_garde_points` **absent** (033 pas appliquée) ; **2 points** `restore_*` déjà écrits par l'app (1 vendeur, dernier 12 nov. 06:33) |
| schéma `sauvegarde` | copies manuelles du 30 sept. et du 2 oct. seulement |
| `app_data` | 12 082 lignes, 86 Mo ; base 244 Mo ; seau Storage : `detourage` seul |
| familles lourdes | `harvest` 3 667 lignes (PDF de bordereaux dedans) · `email_bord` 240 / 6,4 Mo (61 PDF) · `email_invoice` 21 PDF · catalogues 2–3,4 Mo |
| `sondes-statut.yml` « toutes les 10 min » | a réellement tourné toutes les **5 à 7 heures** (GitHub ne tient pas les petites cadences) ; `CRON_SECRET` est posé |
| `/api/sante` | rendait en public 7 oui/non dont `stripe`, `stripeWebhook`, `ia`, `detourage`, `relancesEssai` |
| app / routes | l'URL et la clé de la base **en dur** dans `src/App.jsx`, `api/vinted-connect.js`, `api/vinted-refresh.js` ⇒ un déploiement Preview parlait à la VRAIE base |

## 2. Sauvegardes : l'export quotidien côté serveur

`api/_lib/sauvegarde-quotidienne.js` (nouveau), branché dans `api/ship-reminders.js`
(pas de nouvelle fonction : 12 au plus tenues) :
- au cron du **soir** de Vercel (borné à 90 s, avant les vendeurs) et `?moment=sauvegarde`
  (job `export-serveur` ajouté à `.github/workflows/sauvegarde.yml`, avec `CRON_SECRET`) ;
- un fichier `.vrms` **par vendeur et par jour** (le neutre compris : la quarantaine des e-mails),
  seau Storage **privé** `sauvegardes` créé par le code au premier passage (public ⇒ rien écrit) ;
- copié : toutes les lignes `app_data` du vendeur sauf ce qui est recapté ou lourd, écarté
  **dans la requête** (`harvest_*`, `email_bord*`, `email_invoice*`, catalogues, `lbc_recon`,
  `vc_brut`) ; une ligne qui porte quand même un PDF ou > 1,5 Mo est NOMMÉE, pas copiée ;
  ses comptes Vinted **sans aucun jeton** (pas même demandés à la base) ;
- gzip + **AES-256-GCM**, clé HKDF de `SAUVEGARDE_CLE` (Vercel, facultative) sinon de la clé de
  service ; le fichier dit laquelle, jamais la clé ;
- manifeste chiffré par jour (qui est fait, nombre, empreinte) : relancé, seuls les manquants ;
  lecture ratée ⇒ rien pour ce vendeur ; liste vide ⇒ rien ; manifeste illisible ⇒ rien ;
- rétention **14 jours**, mais un vieux jour n'est retiré que s'il reste **7 jours complets** plus
  récents (une panne longue ne vide jamais tout). Taille estimée : ~15 Mo lus/jour, ~3 Mo rangés.
- Ce n'est PAS hors de Supabase : supprimer le projet supprime aussi le seau. La copie hors
  Supabase reste `sauvegarde.yml` (geste 1a du guide).

Restauration : `scripts/sauvegarde/restaurer-export.mjs` (`--liste` pour voir ; sinon restaure
dans un Postgres **local** — cible distante ou « supabase » refusée avant connexion —, empreinte
vérifiée avant, `on conflict do nothing`, relecture et comparaison ligne à ligne après : un écart
⇒ code 1). Procédure : guide §1c ; la recopie vers la vraie base se fait ensuite avec Julien,
lignes manquantes seulement, après un export frais.

Note : un nombre jsonb `1.50` revient `1.5` (même valeur) ; une chaîne garde sa forme.

## 3. `/api/sante`

Public : `ok`, `serviceKey`, `owner`, `etat`, `statut` (ce que la surveillance, Paramètres et
`verifier-production` lisent). Les 5 oui/non de configuration partent dans `config` au **seul
propriétaire connecté** (sa session, `VRM_OWNER_UID`), `Cache-Control: private, no-store`.
Audits mis à la règle : `confiance` (A12 accepte `config,`), `signalement` (S), `verifier-production`
(la clé absente est `owner`). `docs/ouvrir-aux-clients.md` : vérifier les variables dans la liste Vercel.

## 4. Base d'essai « vrm-essai »

- `scripts/essai/appliquer-migrations.mjs` + `.github/workflows/base-essai.yml` (à la main, secret
  `ESSAI_DB_URL` seul) : `supabase/essai/000-socle.sql` (les deux tables créées à la main en mai,
  forme relue au catalogue) puis les 31 migrations dans l'ordre, chacune dans sa transaction,
  notées dans `vrm_essai.migrations` (relancé : seules les nouvelles). **Ponts** pour ce que la vraie
  base a reçu à la main : `avant-002-fermeture.sql` (index `app_data_owner_id_uniq`),
  `avant-004-meta-et-rls-rapide.sql` (politiques `tout_*`). `concurrently` retiré (base vide), UID
  de Julien et marqueurs « METS-TON-UID-ICI » remplacés (neutre ou `ESSAI_PROPRIETAIRE`).
  Refus : l'adresse de la vraie base (avant connexion), une base qui a des lignes.
  ⚠️ 002 porte son propre `begin/commit` : si une migration de ce genre échoue après son commit,
  elle n'est pas notée — relancer la rejoue.
- Preview : `src/App.jsx` lit `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (absentes ⇒ la vraie
  base, Production inchangée) ; `api/vinted-connect.js`, `api/vinted-refresh.js` lisent
  `SUPABASE_URL` d'abord ; le mode exemple tient l'hôte d'essai à l'écart. `audit-csp` et
  `audit-coherence` lisent la valeur de production dans la nouvelle forme.
- **Reste** : la CSP (`vercel.json`, `connect-src`) ne liste que la vraie base — ajouter l'hôte
  d'essai quand Julien l'aura créé (un geste de session). L'extension écrit toujours en production.

## 5. Surveillance toutes les 5 min

`scripts/surveiller-prod.mjs` + `.github/workflows/surveillance.yml` (`*/5`, aucun secret, droits :
lire + issues) : accueil + `/api/sante` (`ok`, `etat.base` ≠ `panne` ; « inconnu » n'est pas une
panne) ; un raté est rejoué après 60 s ; deux ratés ⇒ UNE issue « vrm.center ne répond pas »
(e-mail de GitHub), rien de plus tant que c'est rouge, « C'est revenu » + fermeture au vert. Le run
n'échoue que si l'issue n'a pas pu s'ouvrir (filet). Comme GitHub ne tient pas la cadence (mesuré),
le guide pose **UptimeRobot** (gratuit, 5 min, app iPhone). Une notification push VRM n'est pas
possible quand vrm.center ou la base est tombé (elle passe par eux).

## 6. Retour arrière

`scripts/revenir-en-arriere.mjs` + `.github/workflows/revenir-en-arriere.yml` (à la main seulement ;
sans « OUI » il DIT ce qu'il ferait) : façon `vercel` (secret `VERCEL_TOKEN`, équipe trouvée seule,
le déploiement de PRODUCTION prêt juste avant celui qui sert — jamais un aperçu, jamais un raté ;
Hobby ne permet que le précédent ; prévient du « Promote ») ; façon `git` (sans secret : `git revert -m 1`
de la dernière fusion sur `retour/<sha>`, demande de fusion ouverte, ou son lien si GitHub refuse).
Pas-à-pas Vercel « Instant Rollback » dans le guide §4a. L'extension n'est pas concernée.

## 7. Preuves

| audit | vert ici | sur `origin/main` (archive) | mutations |
|---|---|---|---|
| `audit-sauvegarde-export` (Postgres jetable, vraie route, faux seau, restauration comparée) | 38/38 | rouge | 12/12 |
| `audit-sante-publique` (vraie route, secrets plantés) | 12/12 | rouge (7) | 4/4 |
| `audit-surveillance-retour` (faux vrm.center / GitHub / Vercel, dépôt git jetable) | 26/26 | rouge (10) | 11/11 |
| `audit-base-essai` (31 migrations sur Postgres jetable, refus, reprise) | 13/13 | rouge | 7/7 |

`npm run build` vert ; audits `variables, tdz, coherence, identite, icones, csp, fonctions-api,
secrets, pagination-ordre, cle-service, alertes-production, verifier-production, confiance,
signalement, controle-prod-quotidien, statut-auto, sauvegarde-verifier, lectures-partagees` verts.
Aucun écran touché (pas de banc de rendu à relancer).

## 8. Gestes de Julien

Le guide, dans l'ordre : 1a (secrets de la copie GitHub), 3b (UptimeRobot), 2 (vrm-essai),
puis facultatifs `VERCEL_TOKEN`, `SAUVEGARDE_CLE`, migration 033.
