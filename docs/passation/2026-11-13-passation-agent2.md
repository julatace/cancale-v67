# Dossier de passation — second agent, 13 nov. 2026 (matin)

Écrit par la session du « second agent » (youthful-wozniak) avant d'atteindre sa limite, sur la
demande de Julien : « un énorme dossier de passation sur ce que tu n'as pas eu le temps de finir ».
L'agent principal ne travaille plus depuis le 12 nov. : **le second agent fusionne lui-même sur
`main`** (§2.2 de CLAUDE.md). Le fichier de coordination reste `docs/passation/COORDINATION-AGENTS.md`
sur la branche `claude/coordination` (journal daté de chaque mise en ligne).

À lire avec : `2026-11-11-passation-agent2.md` (l'état du 11 au soir), puis les récits datés
du 12 et du 13 nov. cités plus bas. Chaque récit a sa section « Preuves » et « Restes ».

---

## 0. Pour reprendre en 5 minutes

1. `git fetch origin` ; regarder `origin/main`, les PR ouvertes, et la fin de
   `origin/claude/coordination:docs/passation/COORDINATION-AGENTS.md`.
2. Deux chantiers étaient EN COURS au moment d'écrire (§3) : l'intégration CI → traduction →
   découpe d'App.jsx, et le lot colis « horaires / rappels / un colis une seule fois ».
   Chacun a sa branche poussée ; reprendre par un vrai `git merge origin/main`.
3. Julien veut : **tout automatique, sans erreur, simple, et un colis affiché une seule fois**.
   Il ne veut plus de questions sur ses colis (« arrête de me demander ») : quand deux preuves
   se contredisent, **le transporteur tranche** (§4).
4. Il ne veut plus de récit technique au fil de l'eau : seulement des résultats VÉRIFIÉS en
   ligne (Vercel READY + capture regardée). `vrm.center` n'est pas joignable depuis le
   conteneur : vérifier le déploiement avec l'outil Vercel (`list_deployments`, cible production).

---

## 1. Ce qui est EN LIGNE (main = 68ada92a9 au moment d'écrire)

| PR | contenu | récit |
|---|---|---|
| #1137 | paquet F (agent principal), extension 5.365 | `2026-11-12-integration-11nov-g2.md` |
| #1138 | paquet G2 (agent principal), extension 5.368 | idem |
| #1140 | colis urgent : Chronopost Pickup sous son point (rue sans numéro), changement de point Mondial Relay lu, « le transporteur tranche » | `2026-11-12-restes.md` |
| #1141 | finitions : À retirer en UNE forme de ligne, logos transporteurs (Chronopost Pickup jaune), fiche dépliée, QR « pas chargé — Réessayer », 9 défauts visuels + restes colis (SMS, Voir l'e-mail, statuts transporteurs) | `2026-11-12-finitions.md` |
| #1139 | paquet 12nov-a : branches du second agent (robustesse, temps réel, veille, limites, saisie rapide, Messages par compte, ventes groupées par compte, sécurité des comptes…), ext. 5.369 | `2026-11-12-integration-12nov-a.md` |
| (12nov-b) | ouverture-clients (Ouvrir les paiements, banc paiement bout en bout, export RGPD, aide), fiabilite-prod (sauvegardes, base d'essai, surveillance, retour arrière), facture-mobile | `2026-11-12-integration-12nov-b.md` |
| #1144 | vert-vitesse + vitesse-volume : CI parcours-quotidien / comptes-et-reception au vert (2 vrais défauts), « Tout imprimer » = même compte que la feuille, une vente signalée relit un seul compte (1,35 Mo → 268 Ko), calculs faits une fois | `2026-11-12-vert-vitesse.md`, `2026-11-12-vitesse-volume.md` |
| #1143 | **extension 5.372.0** : discrétion (12 idées), écriture humaine, boutique (Chrome Web Store prêt, « Nouvelle version », carte du logo, Réparer, rapport, file hors ligne, logo qui évite les barres de Vestiaire), favoris PAR COMPTE (liste du plus récent au plus ancien, cases, vendus retirés, « Vintex » retiré → « Rapide »), 8–20 s aléatoires entre offre et message, n° de suivi / transporteur / point / code lus dans le panneau « Détails » de Vinted, UNE prudence par compte | `2026-11-12-integration-12nov-extension.md`, `2026-11-12-favoris-compte.md` |
| #1145 | moteur-compta + source unique : moins de calculs refaits, une copie partagée des commandes / suivis / dates ; **correctif des dates de versement** (une date lue n'est plus jamais effacée par une publication pressée ou une relecture ratée — touchait le CA déclaré) | `2026-11-13-moteur-compta.md`, `2026-11-13-source-unique.md` |

`vrm.center` sert l'extension **5.372.0** (vérifié dans `public/extension-version.json` et le
manifeste du zip). C'est la SEULE version que Julien doit installer.

---

## 2. Décisions de Julien du 12 et du 13 nov. (à respecter, ne pas re-négocier)

- **Messages** : comptes SÉPARÉS ; le compte de l'onglet d'abord, puis chaque autre, le plus récent d'abord.
- **Pause de l'extension** : garder la pause sur TOUT 403 de Vinted.
- **« X € conseillé »** d'une paire qui dort : gardé, « pas abusif » (≥ 30 j en ligne, ≤ −10 %, ≥ 14 j entre deux, jamais sous achat +10 %, rien si prix d'achat inconnu).
- **Prudence** : relecture comme avant, mais une fois le compte capté en entier, seulement le nouveau.
- **Discrétion** : tout sauf (1) le repos de nuit 1 h–7 h et (10) étaler les messages favoris sur la journée.
- **Sécurité des comptes** : « on fait tout » (mots dangereux, avertissement Vinted ⇒ arrêt, « Tout arrêter », limites par type, compte déconnecté ⇒ arrêt, export des annonces, carte double vérification, jetons Vinted jamais au navigateur).
- **Extension** : tout sauf badge sur l'icône, ralentir selon batterie/inactivité, raccourci clavier. Clic sur l'icône ⇒ VRM dans un onglet (comme Vintex).
- **Favoris** : par compte, liste simple du plus récent (haut) au plus ancien (bas), favoris d'articles vendus retirés, une case par favori ; **« Vintex » ne doit plus apparaître** (→ « Rapide (6–10 s) ») ; entre l'offre et le message un temps **aléatoire 8–20 s, marqué** (pas 25–75 s : « peut-être moins mais aléatoire et marqué »).
- **Colis** (13 nov.) :
  - « tout doit être automatique sans erreur possible » ; « arrête de me demander » ⇒ quand deux preuves se contredisent, **le transporteur tranche** (pas de question à Julien) ;
  - « il ne peut pas y avoir de colis sans code de retrait » ⇒ un colis arrivé sans code = VRM ne l'a pas encore trouvé ; dire d'où il viendra (« Code sur Vinted », « Code pas encore reçu »), jamais « Code à venir » comme si c'était normal ;
  - **« le colis ne doit apparaître qu'une seule fois »** (partout : À retirer, En route, Ma journée, widget, notifications) ;
  - le changement de point **ne doit pas être isolé** dans une carte à part : la ligne va sous son (nouveau) point Mondial Relay ;
  - « l'app doit simplement lire les rappels » (un rappel = le même colis) ;
  - « tu peux peut-être faire des rappels » ⇒ rappel la veille de la date limite et le matin même ;
  - **tous les achats doivent avoir leur n° de suivi** — source : le panneau « Détails » (bouton ⓘ en haut de la conversation Vinted : transporteur, point, « Informations de suivi » ⇒ n° et événements datés) ; « avec le n° de suivi on va voir quelle paire est à l'intérieur de chaque colis » ;
  - le point relais / la ville du panneau Détails font foi « à moins que le point relais change » ;
  - **« on ne fait pas avec l'extension »** pour lire les sites des TRANSPORTEURS (le serveur seulement). Lire Vinted reste le rôle de l'extension.
- **SMS Mondial Relay** (automatisation Raccourcis) : « on fera ça après » — le tutoriel est donné, rien activé (jeton `vrm_sms_token` absent chez tous les vendeurs, mesuré).
- **Traduction** : décision du 11 nov. 14 h 40 qui remplace le refus « International » du 28 oct. (voir `2026-11-11-traduction.md`) — l'argent reste en euros.
- **Refusés** (ne pas reproposer) : carte « Ce qui a changé depuis hier soir », annonces jumelles, tableau de bord « Bienvenue », objectif par compte, rangement guidé, mode « photo », « Ma liste de recherche », la liste du 11 oct. de CLAUDE.md §3.

---

## 3. CE QUI N'EST PAS FINI (le cœur de ce dossier)

### 3.1 Intégration en cours : CI → traduction → découpe d'App.jsx

Agent « intégrateur 13 nov. » (second agent). Plan en trois étapes, chacune mise en ligne avant la suivante :

1. **CI** — branche `claude/integration-13nov-ci` (43752649f) : **EN LIGNE (PR #1146, main 8353cc26a)**, récit dans CLAUDE.md §9 et `2026-11-13-integration-ci.md`. Ce qui suit décrit le but, pour mémoire.
   - But : « Bancs sous WebKit (Safari, non bloquant) » rouge depuis que `ubuntu-latest` est passé à Ubuntu 26 (13 nov. ~4 h UTC) ⇒ épingler sur `ubuntu-24.04` (le job des audits l'est déjà, commit b84c7c89c) ; « App + vraie extension (non bloquant) » rouge car l'extension n'atteint pas vrm.center en CI ; `iphone-reprise` B5 instable (course à trouver avec une requête TENUE, §6.5).
   - Une branche de sonde existe : `claude/sonde-webkit` (461e6afc7).
   - À faire : regarder la CI de #1146, merger si les jobs bloquants sont verts, vérifier Vercel READY.
2. **Traduction** — branche `claude/integration-13nov-traduction` (aaf11f04a), part de `claude/traduction` (15 commits d'avance, 101 fichiers, ~16 000 lignes : `src/i18n/`, sélecteur, écrans migrés, compta comprise).
   - Règle : le français à l'écran doit rester **mot pour mot** ; vérifier par l'audit de la branche et par captures.
   - Mettre à jour la ligne « International » de CLAUDE.md §3 (une ligne + pointeur vers le récit).
   - Si la fusion est trop risquée : au moins `src/i18n` + sélecteur + les écrans qui se fusionnent proprement ; lister le reste.
   - Geste de Julien plus tard : faire relire chaque langue par un locuteur natif avant d'ouvrir VRM hors de France ; décider de la traduction des CGV/CGU.
3. **Découpe d'App.jsx (le « GO »)** — branche `claude/decoupe-app` (20 commits d'avance, outil `scripts/decouper-app-2.cjs` + `scripts/verifier-decoupe.cjs`), récit `2026-11-11-decoupe-app.md` § « La coupe finale « GO » — commandes exactes ».
   - À rejouer sur le main À JOUR (après la traduction), dans un worktree neuf ; le vérificateur doit dire texte / structure / imports / poids / tests / audits identiques ; build vert ; compter les écrans montés (`tab===`, `grep -c '<Nom'`) avant/après (§4.11) ; captures de Ma journée, Ventes, Achats, Annonces, Argent, Paramètres.
   - **C'est le vrai levier de vitesse** : la première lecture de la base part à ~2,5 s au téléphone parce que ~1,9 Mo de JS se charge avant. Abaisser `budget-vitesse` si le JS baisse, ne jamais relever.
   - Si un seul contrôle diffère : pas de PR, rapporter.

### 3.2 Lot colis en cours : `claude/agent2-horaires-relais`

Agent « horaires / rappels / unicité ». Dernier commit vu : 94a8d6b5d (07:58 UTC).

- **FAIT et prêt (60772a308), mise en ligne demandée en priorité à l'intégrateur** : la carte isolée « N colis changent de point relais » n'est plus rendue ; chaque colis redirigé est UNE ligne « Colis Mondial Relay » sous son nouveau point dans « En route » (mention neutre « En route · point changé ») ; un n° déjà dans À retirer n'est jamais redit ; un colis « retiré puis changé de plan » que le transporteur dit disponible ⇒ À retirer sous son nouveau point avec son code ; un colis qui a reçu « Où vous livrer » PUIS « changé de plan » est un vrai changement de point (mesuré le 13 nov.). Banc `retirer-points-changes` 40/0 (24 rouges sur main, 16 sous mutation). Captures regardées par le coordinateur (`scratchpad/shots-pc/points-changes-*.png`).
  - ⚠️ À vérifier avant merge : bancs `retraits-fiables` F7 et `retraits-irreprochables` R1 (libellé « vérifié par… ») rouges sur la branche — rouges aussi sur main ? Sinon corriger sans affaiblir.
- **EN COURS, dans cet ordre** :
  1. **Lire les rappels** (prioritaire) : formes réelles mesurées depuis le 25 oct. — Mondial Relay « Le temps file : votre colis vous attend avec impatience ⏳ » (18) ; Chronopost Pickup « Votre colis VINTED vous attend toujours en relais Pickup ! » (5) ; Vinted Go « Libère de la place dans la consigne : récupère ton colis sans attendre ! #{n°} » et « Rappel : récupère ton colis avant le JJ/MM/AAAA #{n°} ». Tous sont `type suivi, etat integre`. Règle : un rappel = le MÊME colis (n° du sujet ou du corps, ou code) ; confirme « toujours au point » sauf retrait/retour prouvé plus récent ; met à jour la date limite si donnée ; complète sans jamais effacer ; pas de notification en double. Mesurer si chaque rappel a fusionné dans la ligne de son colis.
  2. **Un colis = une fois** partout (À retirer, En route, Ma journée, widget, notifications) : mesurer les doublons actuels (même n° normalisé, ou même code au même point) et corriger la fusion dans la règle partagée (`regrouperArrivees`, `retraitPreuves`, `relireLigneSuivi` + copie serveur). Banc : arrivée + 2 rappels + SMS + changement de point pour le même n° + achat Vinted relié par n° ⇒ exactement 1 ligne.
  3. **Rappels envoyés par VRM** : mesuré (lecture seule) — la notification d'arrivée « Ton colis {transporteur} t'attend » part bien (push_journal, 12 nov.) ; la famille « rappels » est allumée dans `push_prefs`. À faire : UN rappel la veille de la date limite et UN le matin même, par colis non retiré, déduplication par IDENTITÉ du colis, jamais pour un retiré, jamais une date estimée présentée comme sûre, titre au nom de l'article quand il est relié. Audit qui EXÉCUTE la route (api/ship-reminders.js ou celle qui envoie).
  4. **Horaires d'ouverture** du point : lus dans les e-mails (ex. Chronopost Pickup « lun. - sam. 09:00 - 19:30 »), champ `horaires` ; en-tête du point « Ouvert lun.–sam. 9 h–19 h 30 · ferme à 19 h 30 » (heure de Paris), neutre ; pas su ⇒ rien.
- Fin : récit `2026-11-13-horaires-relais.md`, ligne §9, « Fini, à intégrer ».

### 3.3 Ce qui reste ouvert sans agent

| sujet | état | piste |
|---|---|---|
| **Vitesse à 20 000 ventes** | Ma journée ~12 s, Ventes ~14 s, Achats ~9 s (téléphone ×4, médiane bimodale). Objectif < 2 s non atteint. | 1) la découpe d'App.jsx (§3.1-3) ; 2) moins de moteurs `Comptabilite` montés (Achats en monte 3) ; 3) sortir `cartesColis`, `totals`, `propositionsPrix` en modules mémorisés sur les données partagées (`src/magasinPartage.js`). Outils de preuve prêts : `scripts/bancs/chiffres-volume.cjs` + `scripts/compare-chiffres-volume.cjs` (35 relevés au centime ; passer les deux builds DANS LA MÊME HEURE), `scripts/bancs/vitesse-volume.cjs`, `_mesure-demarrage.cjs` (`RENDUS=1`). |
| **Achats sans n° de suivi** | 25/64 achats en cours sans n° (mesuré 12 nov.) ; 50 lignes « arrivé au point » sans code, dont 42 lignes Vinted « t'attend » sans n° ni code. | La 5.372 lit le panneau Détails ; la forme exacte de la réponse n'a PAS été mesurée sur la vraie base : si Vinted range le n° ailleurs, rien n'est écrit et la forme est rangée pour être apprise (ligne de forme). Mesurer après quelques visites de Julien : couverture avant/après. |
| **Transporteurs sans lecture serveur** | Mondial Relay (InPost), Chronopost, Shop2Shop, Vinted Go : lus. Colissimo/La Poste et UPS : clé gratuite nécessaire (geste de Julien). DPD, GLS : services publics sans clé, mais réponse jamais mesurée (hôtes non autorisés dans le conteneur). Relais Colis : aucun suivi public ⇒ e-mails et SMS seulement. | Règle prête : `api/_lib/suivi-public.js`. Julien a dit « on ne fait pas avec l'extension » pour les transporteurs. |
| **CI non bloquante** | voir §3.1-1 | |
| **Banc périmé** | `ventes-colis-premium.cjs` (hors CI) cherche un lien vers Colis qui n'existe plus (Colis vit dans Ventes). | remettre à la règle actuelle. |
| **Migration 042** (écritures atomiques) | écrite, PAS appliquée (3 blocs : `scripts/serveur-migrations-sql/`). Le code marche sans (route des ventes légères prend le chemin d'avant). | geste de Julien, facultatif. |
| **Migration 016** (mode équipe) | pas appliquée (voir CLAUDE.md §5). | geste de Julien. |
| **Branche parasite** | `claude/agent2-integ-wip` (un gitlink « coord » par erreur, 12 nov.) : inoffensive. | Julien peut la supprimer sur GitHub. |
| **Chantiers de l'agent principal non intégrés** | `claude/decoupe-app` (§3.1), `claude/traduction` (§3.1). `base-tables`, `publier-partout`, `hors-ligne` sont déjà dans main (0 commit d'avance). | — |
| **Worktrees** | `.claude/worktrees/agent-*` : plusieurs dossiers d'agents finis restent (disque ~2,5 Go libres). Un est verrouillé (agent-a612efc3d39a81155). | supprimer un par un ceux qui sont propres et poussés (`git status` vide + branche distante qui contient HEAD). Un balayage global a été refusé par le classificateur. |

---

## 4. Les règles du chantier Colis, telles qu'elles sont maintenant

(Écrites en tête de `2026-11-12-finitions.md` ; à garder SIMPLES.)

1. **Un colis = un n° de suivi** (son identité). Tout ce qui porte ce n° (e-mail transporteur, e-mail Vinted, rappels, SMS, suivi lu chez le transporteur, panneau Détails Vinted lu par l'extension 5.372) se fond en UNE ligne. Un achat Vinted sans n° reste une ligne à part jusqu'à ce que son n° soit connu — jamais relié par ressemblance (§5) ; il est compté une fois.
2. **Le point** = celui écrit dans la source la plus récente (changement de point compris). Groupe = point (nom + adresse normalisés, enseignes à leur orthographe officielle : Intermarché, E.Leclerc…).
3. **Le code et le QR** = ceux de la source ; arrivé sans code ⇒ « Code sur Vinted » / « Code pas encore reçu ».
4. **L'état** = en route / arrivé / retiré ; la source la plus fraîche gagne ; en cas de contradiction, **le transporteur tranche** (`fusionTransporteur`, seulement pour les lignes en contradiction) ; sans réponse ⇒ « vérification en cours », neutre, relu au passage suivant.
5. **Une forme de ligne** (`src/CarteRelais.jsx`) : vignette (photo de l'article relié + logo en badge, sinon logo seul) · titre (article ou « Colis {transporteur} », jamais un n°) · code en gros + icône QR · n° de suivi discret · barre du délai toujours là. Fiche dépliée : Arrivé · À retirer avant · Code · Compte · Vérifié, gestes « Copier le code » · « QR en grand » · « Suivre ». Aucune couleur si rien à faire (§7).
6. Fichiers : `api/_lib/retrait-colis.js` (lecture du lieu, des statuts, « il sera finalement livré ici »), `api/_lib/suivi-colis.js` / `suivi-public.js` / `transporteurs.js` (suivi serveur), `src/relaisColis.js` (normalisation du lieu), `src/lieuxRetrait.js` (relecture du texte gardé), `src/retraitPreuves.js` (`regrouperArrivees`), `src/relaisChange.js`, `api/_lib/sms-*.js`.

---

## 5. Gestes de Julien (dans l'ordre d'importance)

1. **Installer l'extension 5.372.0** dans chaque Chrome (télécharger `https://vrm.center/VRM-extension.zip`, un seul dossier, remplacer l'ancien, ⟳ dans `chrome://extensions`) et sur Orion (`VRM-Orion-dossier.zip`). Garder un onglet vinted.fr ouvert : les n° de suivi, points et codes arrivent au fil des visites.
2. **Sauvegarde quotidienne hors Supabase** — URGENT, jamais tournée (secrets absents) : Supabase → Connect → URI avec mot de passe ; GitHub → Settings → Secrets and variables → Actions → `SUPABASE_DB_URL` ; second secret `SAUVEGARDE_PHRASE` (noté sur papier) ; Actions → « Sauvegarde quotidienne » → Run workflow. Ne jamais coller ces valeurs dans une conversation.
3. **Pour encaisser** (guide `2026-11-12-guide-paiement-julien.md`) : 9 valeurs de `public/legal/editeur.js` (dont l'adhésion à un médiateur de la consommation) + `src/contact.js` ; Stripe mode test : prix « VRM Solo » 16,99 € (lookup `vrm_mensuel`) et « VRM Pro » 19,99 € (`vrm_pro_mensuel`), webhook et ses 5 événements, adresse des CGV ; Vercel : `STRIPE_SECRET_KEY`, `STRIPE_PRIX_PRO` (+ `STRIPE_WEBHOOK_SECRET` si changé), Redeploy, puis Réglages → Ouvrir les paiements → Revérifier ; essai carte 4242, puis mode réel ; faire relire CGV et formulaire de rétractation par un juriste.
4. **Fiabilité** (guide `2026-11-12-guide-fiabilite-julien.md`) : UptimeRobot ; projet `vrm-essai` + `ESSAI_DB_URL` + 4 variables Vercel Preview ; facultatif `VERCEL_TOKEN`, `SAUVEGARDE_CLE`, migration 033.
5. **Facultatif** :
   - SMS de colis (Raccourcis iPhone, tutoriel donné le 12 nov. ; Paramètres → Notifications → « Recevoir les SMS Mondial Relay ») ;
   - Colissimo/La Poste : clé gratuite developer.laposte.fr (« Suivi v2 ») ⇒ Vercel `LAPOSTE_OKAPI_KEY` ; UPS : application developer.ups.com (« Tracking ») ⇒ `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` ;
   - Chrome Web Store (5 $) puis Edge : `2026-11-12-chrome-web-store.md` (compte VRM de démo vide pour l'examinateur) ;
   - `RELANCES_SMTP_*` / `RELANCES_EXPEDITEUR` (Brevo) pour « Envoyer avec VRM » ;
   - migration 042 ; supprimer la branche `claude/agent2-integ-wip`.

---

## 6. Méthode qui a marché (et ce qui a coûté)

- **Un seul propriétaire par écran.** Le 12 nov., trois agents ont corrigé les colis en parallèle et Julien a vu « rien ne marche » pendant des heures : rien n'arrivait en production et l'affichage divergeait. Depuis : un agent propriétaire d'À retirer, une règle simple écrite, une scène réelle rejouée sur base synthétique, captures regardées PAR LE COORDINATEUR, puis mise en ligne en PR seule et petite.
- **Mesurer la vraie base en lecture seule avant de coder** (projeter les champs ; `strpos(data::text, '<n°>')` pour retrouver toutes les lignes d'un n° ; jamais `select=data` sur une ligne lourde). Les défauts du 12 nov. étaient tous visibles dans les données : `lieu=null` avec `extraitLieu` propre (rue sans numéro), statut « Sollicitation Client pour replace colis » inconnu, e-mail « Où vous livrer » pris pour une arrivée, e-mail « changé de plan » dont le texte gardé (`email_texte_{hash}`) donnait le nouveau point.
- **Les limites d'usage de 5 h** coupent les agents : chacun pousse à CHAQUE commit ; on reprend par `SendMessage` après la remise à zéro. Un redémarrage du conteneur tue les tâches de fond (surveillance de CI) : les relancer.
- **Ne jamais annoncer « en ligne » sans Vercel READY** sur le bon commit.
