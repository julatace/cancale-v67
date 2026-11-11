# 11 novembre — Revue de sécurité adverse (« des milliers de vendeurs »)

Branche `claude/securite-revue` (depuis `origin/main`). **Pas de PR, pas de merge dans `main`, aucune
écriture en base réelle, aucune migration appliquée** (consigne). Suite des revues du 9 nov.
(`2026-11-09-securite.md`, `2026-11-09-securite-2.md`). Dépôt PUBLIC : ce qui n'est pas corrigé est
décrit sobrement, sans mode d'emploi.

Question posée : un vendeur A peut-il lire ou modifier les données d'un vendeur B ? un anonyme
peut-il accéder à quoi que ce soit ? peut-on détourner VRM (relais, sondes, travail coûteux) ?

## En une phrase

Aucune route serveur ni fonction SQL ne laisse A lire ou écrire les lignes de B (le propriétaire
vient toujours du jeton vérifié chez Supabase ; RLS `owner = auth.uid()` ; chaque SECURITY DEFINER a
son `search_path` fixé et est retirée à `public`, `anon` et `authenticated` sauf voulu). **Un défaut
grave côté app** (un lien piégé ouvrait l'app de la victime sur le compte d'un tiers, et l'extension
suivait) et **sept défauts moyens ou faibles** sont corrigés, chacun avec un test qui EXÉCUTE le code,
rouge sur `origin/main`, vert après, plus une mutation.

## Tableau

| # | menace | où | verdict | preuve |
|---|---|---|---|---|
| 1 | **Lien piégé `#access_token=…`** : un lien fabriqué avec les jetons d'un AUTRE compte était adopté tel quel ; l'app de la victime s'ouvrait sur ce compte, l'extension la suivait et rangeait chez le tiers les captures de la victime. | `src/App.jsx` `consumeAuthRedirect`, nouveau `src/lienEmail.js` | **corrigé** : un fragment n'est adopté que si CE navigateur a demandé un e-mail de compte dans les 48 h (inscription, lien de connexion, renvoi, mot de passe oublié posent la marque `vrm_lien_demande`) ou si c'est déjà le compte connecté ; jamais par-dessus la session d'un autre compte. Sinon : rien n'est écrit, le message dit quoi faire. Exception : un lien de RÉCUPÉRATION (souvent ouvert sur un autre appareil, il mène au choix d'un mot de passe) n'exige pas la marque, mais ne remplace jamais un autre compte. Le chemin PKCE (`?code=`) n'est pas touché. | `scripts/tests/lien-email-session.test.mjs` (le vrai `consumeAuthRedirect` exécuté) : 8 verts ; sur `origin/main` 6 rouges ; mutations (marque ignorée ⇒ 2 rouges, autre compte accepté ⇒ 3 rouges) |
| 2 | **Sonde réseau par le renouvellement Vinted** : la colonne `domain` (écrite par le vendeur, RLS) choisissait l'hôte vers lequel le serveur postait, redirections suivies, sans délai. | `api/vinted-refresh.js` | **corrigé** : seuls `www.vinted.(fr,com,it,de,be,es,nl,pl)` (la liste de `vinted-connect`), `redirect:'manual'`, 10 s, 25 comptes au plus par appel. | `securite-revue-11nov.test.mjs` (route exécutée) ; rouge avant ; mutation (`startsWith('www.')`) ⇒ rouge |
| 3 | **Travail coûteux offert à un anonyme** : toute clé de widget inconnue de l'index lisait PAR PAGES toutes les lignes `main` (jusqu'à 200 000). | `api/widget.js` | **corrigé** : clé mal formée ⇒ 401 sans lecture ; hors index ⇒ un FILTRE EXACT sur la clé (comme la route SMS), re-comparée en temps constant ; la transition « une seule boutique sans clé » lit 2 lignes au plus. | test exécuté (clés vide, courte, inventée, injection) ; rouge avant ; mutation (format libre) ⇒ rouge. `audit-jeton-index` J1 complété (la transition ne lit plus toutes les lignes) |
| 4 | **Cache de l'onglet** : le cache des ventes/achats vit dans `sessionStorage` et survivait à la déconnexion ; le vendeur suivant dans le même onglet le voyait 3 min dans la recherche. | `src/App.jsx` `wipeLocalData` | **corrigé** : le cache (stockage et mémoire) et les empreintes de photos partent avec la déconnexion / le changement de compte. | `lien-email-session.test.mjs` (dernier test, `wipeLocalData` exécuté) ; rouge avant |
| 5 | **CSP trop large** : `script-src https://cdn.jsdelivr.net` permettait n'importe quel paquet npm ou fichier GitHub servi par jsDelivr (une injection HTML aurait suffi). | `vercel.json` | **corrigé** : 5 chemins figés `paquet@version/` (pdf.js, Tesseract ×2, onnxruntime, ZXing), versions lues dans le code par le test. `connect-src` inchangé (rien n'y s'exécute). | `securite-revue-11nov.test.mjs` (CSP) ; rouge avant. ⚠️ À regarder sur la prévisualisation : aperçu PDF, ticket, détourage, scanner (un oubli se verrait en console) |
| 6 | **« Ce Discord est déjà sur ton compte »** se fiait à une ligne que le navigateur peut écrire : écran trompeur et début d'e-mail d'un tiers. | `api/compte.js` `discordDeja` | **corrigé** : seule une ligne SIGNÉE par le serveur (`avatarPublicVerifie`) fait foi. | test exécuté (ligne plantée ⇒ « non », aucune lecture admin ; ligne signée ⇒ « oui ») ; rouge avant |
| 7 | **Bombe de décompression PDF** dans une pièce jointe d'e-mail (fonction tuée). | `api/_lib/texte-pdf.js` | **corrigé** : chaque flux décompressé à 2 Mo au plus (`getBytes`), au-delà il ne donne rien. | `scripts/tests/pdf-bombe.test.mjs` (400 Mo dans un PDF de < 3 Mo) ; rouge avant (mémoire, ~3 s) |
| 8 | **Serveur d'envoi « Ma facture »** : un nom valide pouvait désigner une adresse interne (connexion TCP depuis Vercel). | `api/_lib/smtp.js` | **corrigé** : le nom est résolu, refusé s'il désigne une adresse privée/locale/réservée (v4, v6, v4 dans v6) ; la connexion part vers l'adresse vérifiée, certificat vérifié sur le nom. | test exécuté (faux serveur local jamais contacté) ; rouge avant ; 9 audits facture/relances verts |
| 9 | Clé des e-mails entrants dans l'adresse (`?key=`, écrite dans les journaux). | `docs/email-pipeline.md` | **doc corrigée** : le Worker l'envoie en en-tête `x-vrm-email-key` (le script Gmail le fait déjà). La route accepte encore `?key=` le temps que Julien recolle le Worker. | — |
| 10 | Mode équipe (016) : l'acceptation d'une invitation se fie à la confirmation d'adresse de Supabase. | `016-equipe.sql` (PAS appliquée) | **préalable écrit en tête de la 016** : ne l'appliquer qu'avec « Confirm email » allumé. Une preuve plus forte (code d'invitation) reste à faire avant d'ouvrir le mode équipe. | — |
| 11 | Test statique des migrations : il ne vérifiait que le retrait à `public`, pas à `anon`/`authenticated` (droits par défaut de Supabase). | `scripts/tests/rls-migrations.test.mjs` | **renforcé** (règle 3b + mutation) ; les migrations actuelles passent. | 2 verts, `--prouve` 9 mutations |

### Vérifié et sain (relu, rien à corriger)

- **Fonctions SECURITY DEFINER** (toutes les migrations, dernière définition et derniers droits) :
  `search_path` fixé partout (`''`, ou `public, pg_temp` pour deux fonctions réservées au serveur) ;
  aucune SQL dynamique sur une entrée ; aucune vue ; `vrm_acces*`, `vrm_accomp_*`, `vrm_communaute_*`,
  `vrm_form_*` lisent `auth.uid()` et ne rendent d'un autre vendeur que ce qui est voulu (pseudo,
  ville, carte, classement, page formateur publique) ; plafonds de messages, conversations et
  signalements en place ; codes de groupe de 8 signes sur 32 (pas devinables).
- **Routes** : chaque mode prend le vendeur du jeton (`/auth/v1/user`) ou d'un jeton d'index
  re-comparé en temps constant ; aucune valeur brute dans un filtre PostgREST ; Stripe signé (corps
  brut, tolérance 300 s) ; `CRON_SECRET` et `EMAIL_INBOUND_SECRET` en temps constant, absents ⇒ 503 ;
  aucune redirection ouverte (seulement des `Location` fixes) ; CORS limité aux origines d'extension et
  à vrm.center, jamais `Allow-Credentials` ; aucun jeton ni clé dans les journaux.
- **App** : les deux `innerHTML` ne dessinent que la table fixe des transporteurs ; reçus et factures
  échappés ; e-mails dans un cadre `sandbox` sans scripts, nettoyés côté serveur ; liens distants
  limités à http(s) ; textes des autres vendeurs (communauté) passés par React.
- **Extension** : `onMessageExternal` limité à vrm.center ; actions du pont qui vérifient l'origine ;
  session remise par canal adressé avec un nonce à usage unique ; garde du compte de l'onglet, plafond
  de 50 actions/h, requêtes une par une et pause 429/403 intacts (rien modifié dans l'extension ⇒ pas
  de nouvelle version).
- **Secrets** : tout l'historique git (6 241 commits, `--unshallow`) fouillé : seule la clé publique
  `anon` (voulue) et des clés factices de bancs ; aucun `.env` jamais commité.

### Points faibles notés, pas corrigés ici (à décider ou plus tard)

Décrits sans détail (dépôt public) :
- Communauté : le classement est calculé sur des chiffres que chaque vendeur écrit lui-même, et
  recalculé à chaque appel ; le code d'un groupe est visible de tous ses membres ; le plafond de
  groupes créés se compte par profil. Choix de conception à trancher.
- Liaison Vinted : tant que la 029 n'est pas appliquée, les défauts liés de la revue du 9 nov.
  restent (dont la file des messages aux favoris, partagée par identifiant Vinted).
- Partage de fiche (branche pas mergée) : faire recalculer l'expiration par le serveur.
- Extension : limiter les adresses de photos aux hôtes Vinted ; la page de connexion de l'extension
  reste encadrable par les sites listés (rien de lisible). Prochaine version d'extension.
- Page « nouveau mot de passe » : elle ouvre aussi un lien qui n'a pas été demandé ici (geste visible
  de la personne, impact limité) — même règle que le n°1 à y porter.
- Aucune limite de débit sur les liens publics à jeton (agenda) : jetons de 256 bits, pas de fuite.

## Preuves

Voir la fin de ce fichier (sortie des commandes, recopiée telle quelle).

## Gestes de Julien

- Rien d'obligatoire pour les correctifs (tout est côté code ; aucune migration).
- Recoller le Worker Cloudflare de `docs/email-pipeline.md` (déjà attendu) : la clé y part en en-tête.
- Avant la 016 : allumer « Confirm email » chez Supabase (déjà dans la liste).
- Après déploiement : ouvrir un aperçu de bordereau, lire un ticket, détourer une photo, scanner un
  colis — la CSP resserrée ne doit rien bloquer.
