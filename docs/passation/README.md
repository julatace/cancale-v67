# Passation du 11 octobre 2026 (soir) — aux deux autres abonnements Claude

Julien a demandé ce compte rendu avant que cette session atteigne sa limite de
la semaine. **Lisez-le en entier, puis `CLAUDE.md` (il reste la référence).**
Julien ne veut plus de questions : tout ce qu'il a tranché est dans `CLAUDE.md`
§2 (règles permanentes, dont §2.8 et §2.9 ajoutées le 11) et §3 (refus et
propositions retenues du 11 octobre). Tranchez vous-mêmes, dites ce que vous
avez tranché.

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
4. **K3 : migration 014** (mémoire de l'agent eBay) — **fichier seulement, PAS
   appliquée** ; audit `scripts/audit-agent-sql.cjs` (193 contrôles, 66
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
