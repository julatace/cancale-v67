# Passation générale — 20 novembre 2026 (nuit)

Le dossier le plus complet à ce jour. **À lire en premier** par toute nouvelle session, après `CLAUDE.md`.
Il dit : comment reprendre, ce qui est en ligne, les décisions de Julien de cette journée (dont celles qui
REMPLACENT d'anciens refus), ce qui est prêt mais pas en ligne, ce qui reste à faire, ce qui est refusé,
les gestes que lui seul peut faire, et où est le détail de chaque chantier.

Production : https://vrm.center (Vercel, `main`). Extension servie : **5.410.4**.
Dernier commit de `main` à l'écriture : `7362763f8` (PR #1287).

---

## 0. Comment reprendre (la méthode qui a marché le 20 nov.)

1. Lire `CLAUDE.md` en entier, puis ce fichier, puis le récit du chantier concerné
   (`docs/passation/2026-11-20-<chantier>.md` : chacun a ce qui est fait, les preuves, ce qui reste).
2. **Travailler dans un worktree par chantier** (`git worktree add -b claude/<chantier> /home/user/wt-<x> origin/main`),
   jamais dans le dossier principal. Le dossier principal `/home/user/cancale-v67` est sur la branche de session ;
   ne jamais y faire `git checkout <ref> -- .` (le 20 nov. ça a écrasé l'arbre ; rattrapé par fast-forward).
3. **Mettre en ligne soi-même** (autorisation permanente de Julien) : pousser la branche, ouvrir la PR
   (outil GitHub MCP `create_pull_request`), fusionner avec `merge_pull_request` en donnant le SHA COMPLET
   (`expectedHeadSha`, 40 caractères), puis vérifier le déploiement de production avec l'outil Vercel
   `list_deployments` (projet `cancale-v67`, cible `production`) jusqu'à `READY`.
   `curl` vers vrm.center est bloqué par le proxy de la session ; `web_fetch_vercel_url` sert à lire `/api/sante`.
4. **Avant de fusionner** : `git fetch origin main && git merge origin/main` (vrai merge). Les conflits du
   20 nov. n'étaient QUE documentaires (`CLAUDE.md` §9, `src/nouveautes.js`, `historique-divers.md`) : garder
   les deux côtés.
5. **CLAUDE.md doit rester sous 60 000 octets** (`wc -c CLAUDE.md`). Au-delà, déplacer telles quelles les
   lignes les plus anciennes du §9 à la fin de `docs/passation/historique-divers.md`.
6. **Build** : `NODE_OPTIONS=--max-old-space-size=8192 flock /tmp/vrm-build.lock npm run build`
   (sans mémoire en plus, le build meurt). Dans un worktree, `node_modules` = lien vers celui du dossier principal ;
   le retirer avant le commit (`rm -f node_modules`).
7. **Bancs** : un à la fois, avec `timeout` et un `BANC_PORT` libre (4790+). Un banc qui dépasse 900 s n'est pas
   rouge : le relancer avec 2 400 s. Certains audits (`audit-controle-prod-quotidien`) suppriment `dist/` :
   reconstruire avant les bancs.
8. **Disque** : deux fois plein le 20 nov. Supprimer les worktrees des chantiers FUSIONNÉS et propres
   (`git worktree remove --force` seulement s'ils sont poussés) et les vieux dossiers du scratchpad. Jamais `pkill`,
   `rm -rf` seulement sur un chemin écrit en toutes lettres.
9. **Extension** : toute modification de `vinted-sync-extension/` monte la version (`CODE_VERSION`, manifeste,
   `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`, `public/extension-version.json`) ; on régénère les zips UNE fois,
   à l'intégration (`node scripts/zip-extension.cjs`) ; une version publiée ne change jamais de contenu.
10. **Julien** : messages courts, en français simple, prévenu à chaque mise en ligne, captures regardées avant
    d'être envoyées (et dites « exemple inventé » quand ce sont des fixtures). Il n'est pas développeur.
11. **Base de production en lecture seule** (projections scalaires, jamais `select=data` sur une ligne lourde).
    Aucune donnée réelle dans le dépôt (public), ni dans les rapports (des nombres, jamais un pseudo, un nom,
    un n° de suivi). Ne jamais copier ses captures (`/root/.claude/uploads/...`) dans le dépôt.

---

## 1. Ce qui a été mis en ligne le 20 novembre (13 PR, toutes `READY`)

| PR | chantier | ce que Julien voit | récit |
|---|---|---|---|
| #1276 | Annonces Leboncoin | seules SES annonces Leboncoin (compte prouvé par une vente / une session, référence VRM ou N° relié) ; les annonces d'autres vendeurs relevées en naviguant (appartements, box…) disparaissent | `src/articles/sources.js`, `src/enLigneLbc.js` (raison `pas-a-lui`) |
| #1277 | Train 1 du 20 nov. | boutons natifs, relier depuis la liste, minimaliste « comme Paramètres », arrivée par scan, retraits visuels, ce qui manque, démarrage + Store, chasse aux bugs 1 et 2 | `2026-11-20-integration.md` et chaque `2026-11-20-*.md` |
| #1278 | Extension 5.410.1 | panneau de l'extension « comme Vintex », toute action de plateforme dans l'extension, republier fidèle + contrôle, messages malins, intéressés Leboncoin, baisse Vestiaire, Argent au style convenu | `2026-11-20-panneau-vintex.md`, `-actions-extension.md`, `-repub-messages-malins.md`, `-lbc-vc-interesses.md`, `-argent-natif.md` |
| #1279 | Ventes en tableau | à l'ordinateur, un tableau comme les « Commandes » de l'extension, logos des transporteurs | `2026-11-20-ventes-tableau.md` |
| #1280 | Vitesse (bugs terrain) | route de lecture des commandes compressée (`/api/compte?mode=commandes-lire`, ETag/304, 503 jamais `[]`), calculs regroupés | `2026-11-20-bugs-terrain.md`, `-lectures-legeres.md`, `-iphone-rapide.md` |
| #1281 | Extension 5.410.2 | le panneau ne se ferme plus tout seul sur Vinted, imprimer le bordereau et voir le livreur après une vente, « Pas revue depuis N j » au lieu de « à confirmer », graphismes | `2026-11-20-extension-5412.md` |
| #1282 | Ouverture instantanée | chaque écran s'ouvre tout de suite sur sa dernière liste (copie IndexedDB `vrm_copie_{owner}_{ecran}`, datée), barre bleue de chargement retirée | `2026-11-20-instantane.md` |
| #1283 | Sans sélecteur | plus de sélecteur de plateforme en haut des écrans : tout mélangé, logo du site sur chaque rangée, filtre « Site » discret dans les tableaux | `2026-11-20-sans-selecteur.md` |
| #1284 | Relier achats et ventes | toutes les paires, plus récentes d'abord des deux côtés, filtres plateforme / marque / taille, seuls les achats ARRIVÉS proposés, transporteur + n° de suivi sur les Achats | `2026-11-20-relier-achats.md` |
| #1285 | Ventes : retours | retours et litiges en UN groupe « Retours et litiges · N » replié (au lieu de deux styles), bouton « Relier » (chaîne) par vente, en-tête collant qui ne laisse plus passer les lignes, méta = étiquette | `2026-11-20-ventes-retours.md` |
| #1286 | Barre de gauche | plus de rangées « Plateformes » (Vinted, Leboncoin, eBay, Vestiaire) ni dans « Plus » ; recherches eBay depuis Paramètres | ce fichier, §2 |
| #1287 | Extension 5.410.4 | tout « comme Bleam » (voir §2) | `2026-11-20-comme-bleam.md`, `-bleam-suite.md` |

---

## 2. Les décisions de Julien du 20 novembre (à respecter, certaines REMPLACENT d'anciens refus)

1. **« On fait absolument tout comme Bleam »** (soir). REMPLACE le refus §3 « Piloter souris / clavier » pour :
   - la **republication par le vrai formulaire de Vinted** (`vrm-formulaire.js`, `recreerParFormulaire`, méthode
     par défaut ; l'ancienne « Directe » reste choisissable) : photos du coffre, catégorie, titre, description,
     marque, taille, couleurs, colis, état, prix, saisie lettre à lettre, 5–15 s entre deux champs ;
     brouillon relu contre la fiche AVANT la suppression ; ordre coffre → brouillon → suppression → mise en ligne
     inchangé ; « Reprendre » sans jamais deux annonces en ligne ;
   - la **séquence des favoris** comme Bleam (`sequenceFavoriBleam`) : ouverture `seller_enters_notification` →
     `mark_as_read` → message → offre 8–15 s après ; message « lot » une fois si la personne aime ≥ 2 articles.
   Il a été prévenu UNE fois que les clics de l'extension portent `isTrusted:false`. Garde-fous jamais retirés.
2. **« Pas fait par un programme ? »** — REFUSÉ et expliqué : aucun maquillage des clics (isTrusted, debugger/CDP,
   souris inventée). Bleam ne le fait pas non plus (export de l'Observateur : tous ses clics `isTrusted:false`,
   0 × 429/403).
3. **Bloquer Vinted à l'utilisateur pendant que l'extension travaille** : oui, par l'écran plein existant
   (`avecActionPlein`, 5.406) — flou, clics et clavier retenus, « Tout arrêter » seul bouton en mode formulaire,
   s'écarte sur un captcha. Prouvé par le banc `repub-formulaire.cjs`.
4. **Plateformes** : d'abord des pastilles, puis « enlève les onglets par plateforme, ça ne marche pas du tout »
   (#1283), puis « tu laisses le filtre entre les plateformes mais les onglets tu les dégages, tu dégages
   l'onglet Vinted » (#1286). État : AUCUN sélecteur ni rangée par plateforme ; le filtre « Site » des tableaux
   et le logo du site sur chaque rangée restent. Ne pas les remettre.
5. **Litiges** : « 4 litiges avec 2 écritures différentes » ⇒ UN groupe, une écriture (#1285). Il a encore vu
   l'ancienne version juste après (cache) : lui dire de recharger après chaque mise en ligne.
6. **Relier** : « fais un beau logo pour relier les articles » ⇒ maillons de chaîne sur chaque vente (#1285).
7. **Vitesse** : « les écrans de chargement sont atroces » ⇒ barre bleue retirée, copie instantanée (#1282).
8. **Panneau de l'extension** : ne se ferme qu'à son ×, et après une vente on imprime le bordereau et on voit le
   livreur (5.410.2).
9. **Design** : « améliore le design de absolument tout » ⇒ audit fait (§4), à appliquer après les fusions.

---

## 3. Ce qui est dans l'extension 5.410.4 (servie, à installer par Julien)

Tout est **éteint par défaut** ; allumer passe par « Oui, allumer », compte par compte, dans le panneau de
l'extension (onglet Automatisations). Réglages dans `vrm_reglages_auto` clé `vinted_bleam`
(`src/reglagesAutoLigne.js`, même règle app/extension).

- **Après-vente** : bordereau commandé dès la vente (Vinted seulement, jamais eBay §2.8 ; « point relais » par
  défaut ; « boîte aux lettres » seulement si le code a été APPRIS d'un geste à la main, sinon rien et dit) ;
  4 messages (après vente, après finalisation, rappel 24 h après l'arrivée au relais, demande d'évaluation 24 h
  après la fin) avec versions au hasard ; évaluation 5 ★ seulement après avoir appris la forme d'une évaluation
  faite à la main ; litige ⇒ rien ; premier passage d'un compte ⇒ le passé est noté sans rien envoyer ; chaque
  geste noté avant de partir (jamais deux fois).
- **Stock auto** : quantité ≥ 2 posée par lui sur la fiche ; identité annonce → fiche → N° (jamais par
  ressemblance) ; remise en ligne par Republier (directe), sans supprimer l'annonce vendue ; quantité − 1.
- **Négociation par tranches** (`src/negociationPaliers.js`, `palierContreOffre` étendus, pas copiés) : tranches
  « de X à Y € : baisse max Z € », marge %, bonus de lot, arrondi 1 € / 0,50 €, « Rester flexible » (écart ≤ 2 €),
  messages par étape avec `{price}`, délais ; **plancher absolu prix mini, sinon achat + 10 %**.
- **Cycle de vie** : Anti-stagnation, Déstockage, Vierge ; rythme « N republications / N changements de prix par
  jour » tiré entre min et max ; jours et plage horaire (heure de Paris) ; branché sur `cmd_prix_*` et Republier.
- **Dressing amélioré sur vinted.fr** (`vrm-dressing.js`, profil du compte de l'onglet seulement) : plaque N°,
  cases, tri, filtre « sauvegardées ou non », barre (Sauvegardes, Planifications, Stock auto, Planifier, Modifier,
  Republier, Supprimer). **Supprimer** : sur SON clic, confirmé, 10 au plus, gardes strictes, journal — conforme
  à §3 (« Supprimer passe toujours par son clic »).
- **Sauvegarde horaire** du coffre (sans requête à Vinted) ; **analyse des réponses aux favoris** par version
  (envois faits depuis la 5.410.4) ; **filtres des favoris** (note mini, sans note écartés, limite par article,
  période, attendre N min, réécrire après 1 j).
- **App** : rôle par compte Vinted (vente / achats / personnel) dans Paramètres › Comptes liés › Gérer
  (`vrm_roles_comptes`, `src/rolesComptes.js`). Un compte personnel sort du CA déclaré et des totaux.

**Preuves** : `audit-comme-bleam` (33), `audit-bleam-suite` (50, 12 mutations), `audit-negociation-paliers` (22),
bancs `repub-formulaire` (14), `dressing-ameliore` (22), `grand-panneau` (428), coherence, actions-gardees,
discretion, traduction, identite, urssaf, extension-zip, fonctions-api, tdz, variables : verts au moment de servir.

**Pas vérifié en vrai** (à regarder au premier essai de Julien) : sélecteurs de la marque (`#brand`,
`#brand-search-input`), du bouton « Sauvegarder le brouillon », de la confirmation de suppression — déduits, pas
vus dans l'export. S'ils manquent : arrêt propre AVANT le brouillon / la suppression, et le nom de l'élément dit.

---

## 4. Ce qui reste à faire (dans cet ordre)

1. **Suivre le premier essai de la republication par formulaire** : si Julien envoie une capture « Vinted a changé
   sa page (…) », corriger le sélecteur nommé dans `vrm-formulaire.js`, monter la version, servir.
2. **Rôle « personnel » côté serveur** : le bilan de la semaine (`api/_lib/ventes-regle.js`, recopie par
   `audit-bilan-semaine.cjs --recopie`) et le widget (`api/widget.js`) comptent ENCORE un compte personnel.
   Recopier la règle (`src/rolesComptes.js`) comme les comptes exclus, jamais à la main.
3. **`audit-confiance-publique` G5** : il vérifie encore « rien n'est simulé sur Vinted » ; la page `/confiance`
   a été corrigée (Vinted voit des clics faits par l'extension). Réécrire G5 selon la décision du 20 nov.
   (et G10, `audit-vocabulaire-article` : déjà rouges sur `main` avant ces lots).
4. **Appliquer l'audit design** : `docs/design/audit-2026-11-20.md` sur la branche `origin/claude/audit-design`
   (61 défauts, 10 règles R1–R10, 12 lots : 0 banc `audit-visuel.cjs` → 1 socle natif → 2–9 en parallèle →
   10 panneau → 11 ménage CSS ; maquettes `docs/design/audit-2026-11-20/*.html`). Le fusionner d'abord sur `main`
   (doc seule), puis un agent par lot, un seul lot touche `src/App.jsx`.
5. **Vitesse, suite** : découper le composant `Comptabilite` de `src/App.jsx` (énorme) et garder ses dérivés en
   magasin (même idée que `src/memoCourt.js` / `useStateVague`).
6. **Questions ouvertes à Julien** : bouton « Relier » aussi sur les rangées eBay ? Vocabulaire « paire / carton »
   ou « article / emplacement » (règle §2.11 : l'objet central est l'ARTICLE) ?
7. **Transporteur « — »** dans le tableau des ventes quand aucun bordereau n'est lu : vérifier sur sa base que la
   colonne se remplit (identité `bordForItem` via `indexBordsItem`, jamais le titre).

---

## 5. Refusé (ne jamais reproposer, même si Bleam le fait)

- Maquiller les clics pour qu'ils aient l'air humains (isTrusted, debugger/CDP, mouvements de souris inventés).
- Retoucher les photos (micro-variations, IA) « pour que Vinted ne la voie pas comme un doublon ». Le
  recadrage / cadre / rotation de PRÉSENTATION existe (un réglage pour toutes) et ne se présente pas comme anti-doublon.
- **Bleam Cloud** : empreinte de navigateur et adresse IP différentes par compte, automatisations sur un serveur
  ordinateur éteint. Camouflage, et risque de faire bloquer tous ses comptes d'un coup.
- Passage de captcha, rotation d'IP, toute évasion de détection.
- Rien de payant sur la clé de Julien pour les autres (§2.9) ; eBay : l'acheteur paie le bordereau (§2.8).
- Les refus anciens de `CLAUDE.md` §3 tiennent, sauf « Piloter souris / clavier » (remplacé, §2.1 ci-dessus).

---

## 6. Outils faits pour lui le 20 nov. (hors app)

- **VRM Observateur** (branche `claude/observateur-vinted`, `outils/observateur-vinted/`) : extension à part qui
  capte tout ce qu'un autre outil fait sur son compte Vinted (requêtes, clics, `isTrusted`). Elle a servi à
  observer Bleam. **À désactiver quand il ne s'en sert pas.** L'export analysé : `docs/passation/2026-11-20-comme-bleam.md`.
- Ce que l'observation a appris de Bleam : republication par le formulaire (~3 min par paire, photos renvoyées),
  brouillon → suppression (bouton de l'interface) → mise en ligne ; favoris : conversation ouverte avec
  `seller_enters_notification`, `mark_as_read`, réponse « lot » ~6 s après, offre ~11 s après ; aucun 429/403.

---

## 7. Gestes de Julien (lui seul peut les faire)

- **Installer l'extension 5.410.4** : remplacer le dossier, puis ⟳ dans CHAQUE Chrome (Orion :
  `VRM-Orion-dossier.zip`). Essayer UNE republication par le formulaire et envoyer une capture si elle s'arrête.
- **Apprendre à VRM** : laisser une évaluation à la main une fois (pour l'évaluation automatique) ; commander une
  fois un bordereau Colissimo « boîte aux lettres » à la main (si il veut ce choix).
- Allumer ce qu'il veut dans le panneau de l'extension (tout est éteint).
- Choisir le rôle de ses comptes Vinted (vente / achats / personnel) dans Paramètres › Comptes liés.
- **Désactiver VRM Observateur** quand il ne s'en sert pas.
- Recharger la page après chaque mise en ligne (le 20 nov. il a vu l'ancienne version des litiges).
- Toujours en attente (voir `CLAUDE.md` §9 « Gestes encore attendus ») : Chrome Web Store ; Stripe (prix
  `vrm_mensuel` 16,99 €, `STRIPE_SECRET_KEY`, mode réel) ; `public/legal/editeur.js` + `src/contact.js` (sans eux
  personne ne peut payer) ; facture Pro (SIRET…) et `RELANCES_SMTP_*` ; `scripts/gmail-forwarder.gs` +
  `EMAIL_INBOUND_SECRET` ; Worker Cloudflare ; Supabase (Site URL, SMTP, confirmation d'e-mail, Discord) ;
  migration 016 (mode équipe) ; Turnstile ; ouvrir « Mes annonces » sur chaque compte Leboncoin ; repasser sur
  Vinted pour les comptes à lecture ancienne ; les 6 paires renumérotées le 2 oct. ; boutiques AMO/Edge/Opera ;
  décider du second cron du dimanche, du retrait eBay automatique, des libellés de la barre à 9 px.

---

## 8. Repères techniques ajoutés le 20 nov.

| quoi | où |
|---|---|
| lecture des commandes compressée, ETag/304, 503 jamais `[]` | `/api/compte?mode=commandes-lire`, `api/_lib/commandes-lecture.js` |
| mémo court des calculs, rendu groupé (80 ms) | `src/memoCourt.js`, `useStateVague` |
| copie instantanée par écran | `src/copieEcran.js`, `OuvertureInstantanee` |
| réglages des automatismes partagés app/extension | ligne `vrm_reglages_auto`, `superposerReglagesAuto`, `src/reglagesAutoLigne.js` |
| logo d'un site sur une rangée | `src/natif/LogoSite.jsx` |
| retours et litiges, une présentation | `src/natif/ecrans/RetoursVentes.jsx` (`retoursNatif` dans `src/App.jsx`) |
| bordereau d'une annonce par identité | `bordForItem` via `indexBordsItem` (transaction → annonce, N° par `cleNum`) ; `audit-identite` le juge (mutation `bb.title` ⇒ rouge) |
| annonce Leboncoin « à lui » | `annonceLbcALui`, `comptesLbcProuves`, `comptesLbcSession` |
| republication par formulaire | `vinted-sync-extension/vrm-formulaire.js`, `recreerParFormulaire` |
| dressing amélioré | `vinted-sync-extension/vrm-dressing.js` |
| rôles de comptes | `src/rolesComptes.js`, clé `vrm_roles_comptes` |
| capacités | `EXT_CAPACITES` : `repubformulaire` `favorisbleam` (5.410.3) ; `apresvente` `stockauto` `cyclevie` `sauvegardeauto` `dressingplus` `negotranches` `favfiltres` (5.410.4) |

---

## 9. Où est le détail

- Chaque chantier du jour : `docs/passation/2026-11-20-*.md` (26 fichiers, listés au §1).
- Les règles et l'état : `CLAUDE.md` (§3 pour les refus et la décision Bleam, §8 capacités, §9 état).
- L'historique par thème : `docs/passation/historique-*.md` (cherche dans TOUS).
- Les passations générales d'avant : `2026-11-16-passation-generale.md`, `2026-11-10-passation-finale.md`,
  `2026-11-09-passation-generale.md`.
- L'audit design : `docs/design/audit-2026-11-20.md` (branche `claude/audit-design`).
