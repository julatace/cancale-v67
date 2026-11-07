# 7 nov. 2026 (0 h 40) — PASSATION GÉNÉRALE : tout ce qui reste à faire

Julien, mot pour mot : « Je veux que tu me fasses un énorme dossier de passage avec tout ce
que tu n'as pas réussi à faire pour l'autre [session], car tu vas bientôt être limité
d'utilisation pour la semaine. »

**La session suivante lit CE fichier en premier, après CLAUDE.md.** Tout ce qui est ici est
vérifiable : chaque branche a son sha, chaque chantier sa passation datée.

---

## 0. Où en est la production

- **En ligne** : PR [julatace/cancale-v67#1027](https://github.com/julatace/cancale-v67/pull/1027),
  fusionnée le 6 nov. à 23 h 30 UTC, sha `c3f3b8d5`, déploiement Vercel
  `dpl_8EbS7szSTdpPYPdHQkvydaxR32Rz` **READY**, `/api/sante` = base ok, e-mails ok,
  notifications ok.
- Contenu : visuel 1 et 2, Facture Pro, boîte mail façon Mail, accompagnement (conseils),
  écrans de chargement, « Annuler » partout, statut des colis daté, loupe universelle,
  raccords (bulle d'Annonces, espacement de Colis, CLS au chargement).
- Avant (même jour) : PR #1023, #1024, #1025, #1026 — voir §9 de CLAUDE.md.
- Branche de travail de la session : `claude/project-review-nsk5su` = production + 0
  commit (tout est fusionné).
- **Extension servie : 5.323.0.** Aucun changement d'extension en attente.

---

## 1. Quatre chantiers FINIS OU PRESQUE, PAS ENCORE EN LIGNE

Ils ont été faits par des agents dans des branches locales. Le conteneur a redémarré
deux fois dans la nuit (mémoire saturée : trois agents lançaient chacun plusieurs
Chromium). **Les quatre branches sont sauvegardées sur GitHub** sous `claude/attente-*`
(ces branches ne se déploient pas : `vercel.json` ignore `claude/**`).

> ⚠️ Les agents tournaient encore au moment de cette passation : la branche distante peut
> être en retard sur leur dernier commit. La session suivante prend la branche distante
> telle qu'elle est (`git fetch origin 'claude/attente-*'`).

### 1.1 `claude/attente-v36-finition-integ` — textes, accessibilité, grand texte, mode sombre
- Passation : `docs/passation/2026-11-06-finition.md` (dans la branche).
- Ce qu'elle fait :
  - 30 corrections de texte à la main, réparties par écran ;
  - « € » et « % » précédés d'une **espace insécable** U+00A0 (`montant()`, `fmt`/`fmtE`,
    plus 290 littéraux par `scripts/typo-insecables.cjs`, qui lit l'arbre syntaxique) ;
  - milliers groupés (« 1 551,50 € ») ;
  - « email » → « e-mail » dans 135 phrases ;
  - **grand texte de l'iPhone** suivi (`src/grandTexte.js`, `src/styles-lisible.css`,
    `--vrm-vw100` à la place de `100vw`) ;
  - accessibilité axe-core : N° en `role=img`, onglets de Paramètres en `aria-selected`,
    `alt=""` sur les photos décoratives ;
  - contrastes : `--fu-gris2` à #6e6e73, nouveau jeton `onWarn` pour un texte sur ambre.
- Preuve de l'agent de finition : banc `scripts/bancs/finition.cjs`, 1 004 verts après,
  130 rouges sur l'arbre d'avant, mutations.
- **Ce qui reste (le travail de l'agent d'intégration, interrompu)** :
  1. Lancer **TOUS** les bancs (`scripts/bancs/*.cjs` sauf `_*`) sur la branche, **UN À LA
     FOIS** (sinon le conteneur tombe). ~144 bancs comparent des textes contenant « € »,
     « % » ou « email ». L'agent en avait adapté une partie : 28 expressions régulières,
     25 « e-mail », la carte de la boîte mail.
  2. Classer chaque rouge :
     - **(a)** orthographe seulement : adapter le banc pour qu'il juge la RÈGLE
       (`[\s  ]`) ;
     - **(b)** vrai défaut : le corriger à la source. Chercher en particulier un
       `parseFloat` ou un `replace(' €')` qui lit un texte formaté ;
     - **(c)** déjà rouge sur `main` : le lister sans le corriger.
  3. Lancer tous les audits (`node scripts/audit-*.cjs`). Les rouges connus sont dans
     `scripts/audits-exceptions.json`.
  4. Si tout est prouvé sans casse : `node scripts/typo-insecables.cjs --signes=:\;?! --ecrire`
     (insécable avant « : ; ? ! », 2 574 endroits). Sinon, ne pas le faire.
  5. Fusionner (vrai merge), puis PR et mise en ligne.
- Garder **une** exception : `PRIX_CGV_LISIBLE` reste avec une espace ordinaire (le serveur
  écrit le même texte et `audit-abonnement` les compare octet par octet).
- Geste de Julien après la mise en ligne : iPhone → Réglages → Luminosité et affichage →
  Taille du texte plus grande, puis rouvrir VRM.

### 1.2 ✅ Audit des chiffres — FUSIONNÉ (7 nov., 1 h 20)
Agent fini (sha 2082d0e4+02098e01). Détail : `docs/passation/2026-11-06-audit-chiffres.md`.
- Le « 20 colis à déposer » n'a PAS été reproduit sur une copie réelle : tous les écrans disaient 12 à envoyer
  (11 déposables). Le « 20 » le plus probable est **« Envoyés · 20 »** juste à côté de « À envoyer · 12 »
  (chiffre juste, mais se lit de travers) ⇒ **reste : revoir ce libellé** (ex. « Partis ce mois · 20 »).
- Corrigé : « à imprimer » une seule notion (Ma journée 5 → 4, récap Colis 10 → 4), récap Colis avec
  Leboncoin/Vestiaire (11 → 12), Tournée « à déposer » = colis avec bordereau (12 → 11), widget « à retirer »
  15 → 12 (e-mails sans n° de suivi = peut-être en double, « au moins »).
- « Semaine du 26 oct. » vérifiée : pas d'écart. « Colis envoyés » dit « — envois pas notés » (juste : aucun
  geste « Colis fait » noté, aucune date d'envoi prouvée).
- Banc `chiffres-coherents` (27 verts ; 9 rouges sur l'arbre d'avant), ajouté à `verifier.yml`.
- **Reste aussi** : carte « À envoyer » de Ventes dit « — · ouvre Colis » tant que Colis n'a pas publié ;
  4 rouges du banc `colis` antérieurs à la session ; fraîcheur (listes de ventes relues à 8 h 40 seulement).

### 1.3 ✅ E-mails HTML 30 jours — FUSIONNÉ dans `claude/project-review-nsk5su` (7 nov., 0 h 55)
Agent fini (sha c9728aef). Fusionné, build et audits verts (`emails-html`, `boite-mail`, `boite-emails`, `csp`,
`secrets`, `fonctions-api` = 12, `lectures-lourdes`, `coherence`, `identite`, `tdz`, `variables`),
bancs `emails-html` 67/0 et `boite-mail` 104/0. Détail : `docs/passation/2026-11-06-emails-html.md`.
Cadre `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"`, SANS `allow-scripts` (vérifié).
**Reste : seulement la mise en ligne** (elle part avec la PR de cette passation si GitHub répond ; sinon la
session suivante ouvre la PR de `claude/project-review-nsk5su`). Rien de rétroactif : seuls les e-mails reçus
après la mise en ligne gardent leur mise en page.

### 1.4 `claude/attente-v36-hors-reseau` — Colis sans réseau, temps réels des vendeurs (FINI)
- Passation dans la branche : `docs/passation/2026-11-06-hors-reseau.md` (tableau
  avant/après, 34 rouges avant, tout vert après).
- Fait :
  - Colis rouvert sans réseau, par point relais, avec codes, QR et « En grand » ;
  - ligne « Hors connexion — dernier état du … » ;
  - gestes notés dans la file d'envoi et rejoués au retour ;
  - temps réels : collecte anonyme (1 lot/min, `sendBeacon`), route
    `compte?mode=mesures`, panneau « Temps réels des vendeurs » dans Sécurité des données
    (propriétaire seulement), veille des lenteurs.
- **Reste** :
  - **purger les lignes `mesures_jour_*` de plus de 90 jours** (décision prise, pas
    codée) : dans le cron du matin (`api/ship-reminders.js`), lecture projetée,
    suppression par date ; une lecture ratée ne supprime rien ;
  - fusionner (vrai merge, la branche part de `9198fc84`, conflits probables dans
    `src/App.jsx` et `CLAUDE.md`) ;
  - relancer `hors-reseau`, `hors-ligne`, `codes-hors-ligne`, `sw-cache`,
    `mesures-terrain`, puis PR.
- Vérifier la politique de confidentialité (mise à jour dans la branche) : collecte anonyme.

**Ordre conseillé** : 1.4 (fini) → 1.1 (1.2 et 1.3 sont déjà fusionnés) en dernier (c'est elle qui touche le
plus de texte : la fusionner après les autres évite des centaines de conflits).

---

## 2. Ce qui n'a PAS été commencé (demandé ou décidé)

1. **Découper `src/App.jsx`** (~73 000 lignes) en modules par écran.
   - Se fait SEUL : aucune autre session en parallèle.
   - Après la fusion des quatre branches du §1.
   - Loi 11 de CLAUDE.md : compter les écrans montés (`grep -c 'tab==='`, 39 aujourd'hui)
     avant ET après, vérifier sur ce qui RESTE.
   - Tous les bancs doivent être verts avant et après.
2. **Relecture indépendante finale** : un agent neuf, sans le contexte de la session, relit
   toute l'app (règles §5, chiffres, sécurité) et rapporte. Après le découpage.
3. **Fusionner les deux formes d'« Annuler »** : la pilule `PiluleAnnuler`
   (`src/gesteAnnulable.js`) et l'ancienne barre « Annuler » de certains gestes. Une seule
   forme.
4. **Barre du haut en verre** : retirée par visuel-2 (elle provoquait un CLS au
   chargement). La remettre sans décalage, ou abandonner.
5. **Compta en rangées iOS** : comme Réglages eBay (`src/composants/Ios.jsx`).
6. **Correctifs extension** listés dans `docs/passation/2026-11-06-ebay-lbc.md` §3 :
   - ranger le code transporteur dans `contratSuivi` ;
   - relire en priorité les suivis les plus anciens ;
   - écrire `vrm_num_vinted` dans `recreerVinted` ;
   - Leboncoin : les listes à total 0 et les identifiants dans `lectures`.
   - ⚠️ Tout changement de `vinted-sync-extension/` = nouvelle version (5.324.0),
     `CODE_VERSION` + manifeste + `EXT_ATTENDUE` + zip régénéré.
7. **Lecture lourde restante** : l'écran Colis / Ma journée lit encore
   `email_track_*&select=id,data` en entier (vu par le banc de la loupe). La projeter
   (§4 loi 4) et vérifier aussi `api/*.js`.
8. **Banc `recherche-en-place`** : 2 rouges à 1512 (« défilement 88 → 0 »), déjà rouges
   avant la loupe. À examiner.
9. **Audits rouges connus** (avant la finition) : `chemin-json-guillemets`,
   `export-donnees`, `journee-coherence`, `photos-vinted`, `politique-hotes`. Les traiter
   ou les justifier dans `scripts/audits-exceptions.json`.
10. **Adresses @vrm.center** (ImprovMX) : DNS posés (MX `mx1/mx2.improvmx.com`, SPF).
    Quand Julien aura créé le compte ImprovMX (alias `*` vers `vrm.vinted35@gmail.com`),
    passer l'app à @vrm.center APRÈS un e-mail de test reçu.
    Passation : `docs/passation/2026-11-06-adresses-vrm-center.md`.
11. **Envoi d'e-mails à grande échelle** (Facture Pro, relances) : simulation faite
    (1 000 vendeurs × 15 e-mails/jour ≈ 450 000/mois). Recommandation : Amazon SES
    (~50 $/mois). Brevo gratuit = 300/jour seulement. Pas encore branché.

---

## 3. Données de production : ce qui attend une confirmation de Julien

- **40 lignes `vc_brut_*`** (captures brutes Vestiaire, coupées dans l'extension 5.323).
  Le `DELETE` a attendu sa confirmation et a expiré. À refaire seulement quand il dit
  « supprime les captures Vestiaire ». L'outil SQL demande sa confirmation.
- **3 lignes vides `transp_chronopost_…IE`** : les supprimer s'il le veut.
- Rappel : la base de production est en **LECTURE SEULE** pour les sessions (SELECT).

---

## 4. Les gestes qui n'appartiennent qu'à Julien (aucune session ne peut les faire)

Par ordre d'utilité :
1. **Installer l'extension 5.323** (remplacer le dossier, puis ⟳ dans CHAQUE Chrome),
   puis sur Vinted : Porte-monnaie → Historique.
2. **Relier les 3 comptes muets** (relais Apple privé) : tomj606, arthuror2, angeled92.
   Pour chacun, « Transférer à » une boîte reliée (pas-à-pas dans l'app : E-mails →
   « Relier la boîte de … »).
3. **Leboncoin** : se reconnecter, puis ouvrir « Mes annonces » sur CHAQUE compte.
4. **Facture Pro** : remplir « Ma facture » (Compta → Factures : SIRET, forme, TVA,
   e-mail) ; poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` sur Vercel.
5. **Sauvegarde nocturne** : secrets GitHub `SUPABASE_DB_URL` (Session pooler) et
   `SAUVEGARDE_PHRASE`, puis « Run workflow ».
6. **Règle de branche `main`** : rendre le contrôle `verifier.yml` obligatoire (pas-à-pas
   dans `docs/passation/2026-11-06-filets-anti-bug.md`).
7. **SMS Mondial Relay** : Réglages → SMS Mondial Relay (le Raccourci iPhone).
8. **ImprovMX** : compte avec `vrm.vinted35@gmail.com`, alias `*`.
9. **Migration 026** et **016** (mode équipe) : à appliquer, VRM peu sollicité.
10. **Ouvrir aux clients** : `docs/ouvrir-aux-clients.md`. Il faut notamment :
    - `public/legal/editeur.js` (10 champs) et `src/contact.js` ;
    - Stripe : prix `vrm_mensuel` à 16,99 € et `STRIPE_SECRET_KEY` ;
    - Vercel Pro ;
    - Supabase : SMTP, Site URL.
    Artefact récapitulatif : https://claude.ai/artifact/CS2BJuvrDQLzGZvHdGTADi
11. Le reste de la liste « Gestes encore attendus » du §9 de CLAUDE.md.

---

## 5. Leçons de cette nuit (à ne pas réapprendre)

- **Le conteneur tombe (code 137) au-delà de ~3 agents qui lancent des bancs en
  parallèle.** Règle : **au plus 2 agents qui lancent des bancs, UN banc à la fois chacun.**
  Les agents doivent **commiter après chaque correction** : un agent de l'audit des
  chiffres a tout perdu au premier redémarrage (zéro commit).
- **Ne JAMAIS supprimer le worktree d'un agent qui n'a pas envoyé sa notification de
  fin** (trois agents tués comme ça le 6 nov.).
- **Le scratchpad est partagé** par les agents : un dossier à son nom, ne rien supprimer
  d'autre.
- **Écrans derrière `AttenteEcran`** (depuis le chargement du 6 nov.) : un écran est
  monté mais **caché** (`visibility:hidden`, `innerText` vide) tant que ses données
  essentielles manquent (plafond 2,5 s). Un banc doit attendre
  `[data-attente]:not([data-attente="attente"])` ET l'absence de `#vrm-demarrage`.
  Attendre seulement « pas d'attente en cours » juste après `domcontentloaded` passe à
  vide : l'attente n'est pas encore montée.
- **Bancs datés « il y a N jours »** : posés à l'heure courante, ils changent de jour à
  Paris entre 23 h et minuit UTC (`onglets-d` était rouge la nuit seulement). Poser les
  dates à midi UTC.
- Un banc rouge isolé sous charge (load > 10) se relance SEUL avant de conclure.
- Résoudre un conflit de CLAUDE.md : garder les deux lignes du §9. Rester < 59 000 octets
  en déplaçant les plus vieilles lignes du §9 telles quelles en fin de
  `docs/passation/historique-divers.md`.
- `expectedHeadSha` de `merge_pull_request` : le sha COMPLET (40 caractères).

---

## 6. Comment reprendre (pas-à-pas pour la session suivante)

```bash
git fetch origin main 'claude/attente-*:refs/remotes/origin/claude/attente-*'
git checkout -B claude/<nouvelle-branche> origin/main
# 1.4 hors réseau
git merge origin/claude/attente-v36-hors-reseau      # résoudre, build, bancs du §1.4
# coder la purge 90 j des mesures_jour_*, audit + banc
# 1.3 e-mails HTML, puis 1.2 audit des chiffres, puis 1.1 finition (dans cet ordre)
npm run build && node scripts/audit-coherence.cjs && node scripts/audit-identite.cjs
# bancs : UN à la fois, BANC_PORT distinct, timeout 1500
# PR → merge (expectedHeadSha complet) → Vercel READY → https://vrm.center/api/sante
```

Puis le §2 dans l'ordre : découpage d'App.jsx (seul), relecture indépendante, le reste.
