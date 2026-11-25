# 25 novembre 2026 — Lecture sans abonnement (branche `claude/lecture-sans-abonnement`)

Julien (25 nov. soir) : « Tu peux directement faire la lecture et tu floutes tant que la personne
n'a pas d'abonnement. Sauf si il est en essai gratuit. » Puis : « Il voit 5 ventes et 5 annonces et
tu peux faire une animation sur ce qu'il peut faire etc. », « Fais quelque chose de logique », et
« Laisse le design de l'app actuel ». Remplace, sur ces points, la règle du 8 nov.
(`2026-11-08-abonnement-propre.md`).

## Ce qui bloquait la lecture (mesuré dans le code, lecture seule)
1. **La base** : la restrictive `abonnement_requis` (006, retouchée par la 027, appliquée) a
   `USING true` (lire : oui) mais `WITH CHECK vrm_acces_ok()` sur `app_data` et `vinted_accounts`.
   L'extension écrit SES captures directement (`supabaseUpsert('app_data', harvest_*…)`, avec la
   session du vendeur) : sans abonnement, chaque capture recevait un 403, et après un passage tout
   refusé l'extension se mettait en recul (`vrmReculBase`, 1 → 60 min) — rien n'était rangé.
2. **La liaison** : `api/vinted-connect.js` répondait 402 « abonnement » avant de relier un compte
   Vinted (et `LIAISON_ATTENTE_MS.abonnement` = 1 h d'attente côté extension).
3. **L'extension elle-même** ne regardait PAS l'abonnement : sans abonnement, rien n'empêchait ses
   actions de plateforme (seule la base refusait ses journaux).

## Ce qui change
### Base — migration `050-lecture-sans-abonnement.sql` (PAS appliquée : geste de Julien)
- `vrm_ligne_capture(id)` : `harvest_*` et les lignes de lecture Leboncoin / Vestiaire
  (`lbc_listings`, `lbc_ventes`, `lbc_messages`, `lbc_accounts`, `vc_listings`, `vc_ventes`,
  `vc_achats`, `vc_messages`, `vc_session`, `vc_label_*`).
- `app_data.abonnement_requis` : `WITH CHECK (vrm_acces_ok() OR vrm_ligne_capture(id))`.
- `vinted_accounts.abonnement_requis` : `WITH CHECK (true)` (la liaison).
- Inchangé : la suppression exige l'accès (`abonnement_requis_effacer`), owner/021/016/023.
- Garde-fou : refuse de s'appliquer si la 027 n'est pas passée ; contrôle interne en fin de
  transaction (un écart annule tout) ; bloc ANNULER en bas du fichier.
- Prouvé sur PostgreSQL jetable : `node scripts/audit-lecture-sans-abonnement-sql.cjs` (25 verts) —
  avant la 050, la capture et la liaison d'un vendeur coupé sont REFUSÉES ; après, elles passent ;
  `main`, `cmd_dist_*`, `vinted_cadence`, `coffre_*`, `vrm_reglages_auto` restent refusées, rien
  ne s'efface, rien chez autrui, matrice des abonnés / anonyme IDENTIQUE (152 accès) ; mutation
  `WITH CHECK true` vue.

### Serveur
- `api/vinted-connect.js` : plus de 402 « abonnement » — relier un compte est le début de la lecture.
  Ce que la liaison ouvre reste fermé : le relais ne fait que lire, notifications / widget / IA / eBay
  gardent `accesVendeur`.
- `api/compte.js` (checkout) : `retour` (un nom d'onglet, `^[a-z][a-z_]{1,24}$`) ⇒ Stripe ramène sur
  `/?tab=<retour>&abonnement=merci` (sinon Paramètres → Abonnement, comme avant).

### Extension 5.453.0 (`lectureseule`, `abonnementCoupeExt`)
- `abonnementCoupeExt()` lit `vrm.center/api/compte?mode=abonnement` (`acces`, `proprietaire`) ;
  mémo `vrm_abo_ext` (coupé : relu toutes les 2 min ; accès : 10 min) ; pas su ⇒ la dernière réponse,
  sinon NON coupé (on ne bloque pas un abonné sur un hoquet) ; essai et propriétaire jamais coupés.
- `compterActionUn` se ferme (`code: 'abonnement'`) : TOUTE action (Vinted, Leboncoin, Vestiaire ;
  clic, série, automatique) en prend une place ⇒ aucune ne part. Phrase : `RAISON_ABONNEMENT`.
  La lecture (budget séparé) et les captures continuent.
- `node scripts/audit-lecture-sans-abonnement.cjs` (16 verts, le vrai `background.js`) : 7 rouges
  sur la 5.440.4, 7 rouges par mutation (garde neutralisée).
- ⚠️ Collision de version : `claude/favoris-gestes-humains` porte la 5.452.0 ; celle-ci est la
  5.453.0. À l'intégration, la version la plus haute reste la seule servie (contenus réunis).

### App
- `src/abonnement/apercu.js` : un réglage par écran (`lignesApercu`) — Ventes et Annonces : les **5
  premières lignes de l'écran** (toutes listes confondues), ailleurs 3 par liste (inchangé). Une
  ligne = `.n-rangee`, `.n-inv-case`, `tbody > tr`, ou 4 enfants de même forme ; une liste d'UNE vente
  n'est plus floutée ; une ligne cachée ne compte pas ; une rangée de filtres (bouton dans un `span`)
  n'est pas une liste ; une icône (svg) n'est jamais une liste. `data-apercu-nette`, `data-apercu-debut`.
- `src/abonnement/CarteApercu.jsx` : UNE carte, posée là où le flou commence (avant la 1re ligne
  floutée ; par-dessus elle dans une liste virtuelle ; sinon après la dernière nette) : « Ventes
  lues : N · Annonces lues : N » (vrais nombres : `ventesCoque`, `nItems` des dressings ; pas su ⇒
  rien), la séquence (5 scènes, 12,5 s, marquée « Exemple » ; mouvement réduit ⇒ la liste fixe),
  Solo / Pro (prix du serveur, repli : les prix des CGV), UN bouton : « Commencer l'essai gratuit »
  (`essaiDispo`) ou « Débloquer tout » ; impayé : « Mettre à jour ma carte ». Au 1er toucher, les deux
  cases légales (CGV, accès immédiat) s'ouvrent DANS la carte ; cochées ⇒ checkout avec `retour`.
  Un geste bloqué ramène la carte sous les yeux.
- Retour de Stripe (`?abonnement=merci`) : l'état est relu toutes les 2 s (8 fois) ; dès l'accès,
  l'aperçu se lève sur place — rien n'est relu d'autre (banc : 3 lectures contre 13 pour la page témoin).
- Essai gratuit : `lectureSeule` faux ⇒ rien de flouté, aucune carte (banc, 4 écrans).
- Textes : `src/i18n/langues/*/apercuAbo.js` (5 langues) ; `src/nouveautes.js` : `lecture-sans-abonnement`.
- Styles : jetons actuels `--n-*` dans le bloc existant de `src/styles-design-2026.css`.

## Preuves
| contrôle | après | sur `origin/main` |
|---|---|---|
| `audit-lecture-sans-abonnement-sql` (PostgreSQL jetable, vraie 050) | 25 verts | départ (027) prouvé refusé ; mutation vue |
| `audit-lecture-sans-abonnement` (vrai `background.js`) | 16 verts | 7 rouges (5.440.4) · 7 par mutation |
| banc `abonnement-propre` (ventes, annonces, achats, dashboard, 390/1512, clair/sombre) | aperçu vert (51 verts sur `BANC_SEUL=ventes` ; un rouge passager sur le 1er écran d'un passage complet, vert relancé) | 48 rouges (dont les 13 ci-dessous) |
| mutation `APERCU_ECRANS = {}` | 4 rouges (Annonces : 3 ou 7 nettes au lieu de 5) | — |
| `audit-traduction`, `audit-quoi-de-neuf`, `audit-boutons-natifs`, `audit-boutons`, `audit-icones`, `audit-coherence`, `audit-abonnement(-propre)`, `audit-lancement`, `audit-mentions-paiement`, `audit-style-vintex`, `audit-violet`, `audit-tdz`, `audit-actions-app`, `audit-fonctions-api` | verts | idem |

⚠️ Rouges PRÉEXISTANTS du banc (les mêmes sur `origin/main`) : 13 contrôles de Paramètres →
Abonnement (la vue `vrm_reglages_vue=abonnement` ouvre aujourd'hui « Mon compte ») — pas touchés ici.
`audit-stockage-sur` : 1 rouge préexistant (clés d'index dans `src/natif/…`), le même sur `main`.

## Gestes de Julien
1. Relire puis appliquer `supabase/migrations/050-lecture-sans-abonnement.sql` (après la 027, déjà
   passée). Sans elle : l'app montre déjà la nouvelle carte, mais l'extension ne range rien pour un
   compte coupé (403, comme avant).
2. Rien ne change tant que `abonnement_obligatoire` = '0' (personne n'est coupé).

## Limites connues
- Ventes s'ouvre sur « À envoyer » : les 5 lignes nettes sont celles de cet onglet (le mode exemple
  n'en a qu'une). Les sous-onglets restent inertes (aucun geste).
- Le compteur des annonces lit `nItems` des dressings Vinted ; Leboncoin, Vestiaire, eBay ne sont pas
  comptés (dit « Annonces lues », Vinted seulement — à préciser si Julien le veut).
- Les écritures de l'app refusées pendant l'aperçu restent dans la file de l'appareil et partent à la
  reprise (« N changements en attente d'envoi », comme le 8 nov.).
