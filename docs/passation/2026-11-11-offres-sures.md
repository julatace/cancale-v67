# 11 nov. 2026 — Lot DJ8 : offres automatiques mieux, jamais banni, republication à la main parfaite

Branche `claude/offres-sures`. Ses mots (11 nov.) : « Pour les offres automatiques je pense que tu
peux faire mieux. Tu peux regarder comment ne jamais te faire ban stp. » « Je veux que dans Republier
tu mettes la repu à la main, que tout soit parfait stp. »

Rien dans `vinted-sync-extension/` (une autre session publie la 5.340) : ce qui doit changer dans
l'extension est écrit pour une **5.341** dans `2026-11-11-anti-ban.md` §5.
Aucune règle du moteur ni décision de Julien n'est changée : éteint par défaut, offre ≥ « Accepter
dès » acceptée 3 à 20 min après (hasard), < « Refuser sous » refusée, garde des autres plateformes,
3 offres par visite, 50 actions/h (réserve 5).

## 1. L'étude « ne jamais être banni »

`docs/passation/2026-11-11-anti-ban.md` : les deux blocages connus (vanessa5723, angeled92), douze
signaux de risque et ce que VRM fait déjà pour chacun, douze propositions classées par gain/risque.
La plus forte (**P1**, pour la 5.341) : **les offres partent encore du service worker**
(`repondreOffre` et `executerPourApp` → `vintedSend` : `Authorization: Bearer`,
`credentials:'omit'`), la forme retirée de Republier après la restriction d'angeled92 ; les faire
passer par `vintedPage` (l'onglet vinted.fr) comme tout le reste.

## 2. Un défaut trouvé : le mini à virgule était IGNORÉ par le moteur

La carte d'annonce écrivait la saisie brute (`updatePair(item,{min:v})`) ; le clavier décimal
français tape « 45,5 ». L'écran lisait `Number('45,5'.replace(',', '.'))` = 45,5 et affichait
« Accepter dès 45,50 € » ; l'extension lit `Number('45,5')` = NaN ⇒ **aucune acceptation, sans un
mot**. Corrigé côté app : la carte écrit `montantSeuil(v)` (« 45,5 € » ⇒ « 45.5 ») pour « Accepter
dès » et « Refuser sous » ; l'écran Offres auto compte les anciens seuils à virgule et les corrige
d'un geste (« Corriger »). Côté extension (P4, 5.341) : lire la virgule aussi.

## 3. L'écran « Offres auto » (Messages → Favoris & offres)

`src/OffresAuto.jsx` (chargé à la demande), règle pure `src/offresSures.js`, styles
`src/offres-auto.css`. Favoris & offres a deux vues : « Favoris » (inchangée) · « Offres auto ».
Annonces → Outils → la carte « Offres automatiques » porte « Régler par paire, voir l'historique › »
(`demanderVue('offresauto')`).

De haut en bas :
- **L'interrupteur** — LE même (`basculerOffresAuto` : éteint par défaut, confirmation qui dit le
  risque) ; « Allumées · N paires réglées ».
- **La jauge** du compte de l'onglet (lot G) ; **alerte** à 40/50 (« ralentis tes clics ») et à 45
  (« VRM attend la prochaine heure ») — aucun plafond nouveau ; **la pause** en cours (« Vinted a
  demandé de ralentir : rien ne part pendant 12 min ») ; **journée calme conseillée** 24 h après un
  frein vu (la pause 429/403 de l'extension, notée une fois par l'app dans `vrm_freins_vus`, sur
  l'appareil — un conseil, rien ne s'éteint tout seul).
- **« Tout arrêter »** (confirmé) : offres auto éteintes + `auto_stop` et `arreter` (mode auto des
  favoris et sa file) sur CHAQUE compte Vinted, confirmé par le serveur compte par compte ; un compte
  pas confirmé est nommé (« Pas confirmé : vendeuse_b. Réessaie. »).
- **« Offres en attente »** (ou « Si tu allumes ») : chaque offre en attente (la Map de Messages,
  ses ventes seulement) et ce que le moteur en ferait — « Acceptée 3 à 20 min après », « Pas
  acceptée · vendue ailleurs / ouvre VRM pour vérifier les autres sites », « Refusée », « À toi »,
  « Aucune règle (· seuil illisible) ». « Aperçu : rien n'est envoyé d'ici » ; le fonctionnement
  sous « Pourquoi ? ».
- **« Tes paires »** : « Accepter dès » et « Refuser sous » modifiables en place (normalisés),
  filtres Toutes · Réglées · Sans seuil, recherche N° ou titre, 30 par page ; cases ⇒ « Régler en
  série · N » ouvre la feuille « Prix mini » existante (−X % ou −X €, refus en option, confirmation).
- **« Historique »** : les offres acceptées / refusées NOTÉES par l'extension (`journal_vrm_*`,
  projection `id,e:data->e`, compte pris sur l'identifiant de la ligne — jamais le 1110 pour le
  111), « (auto) » quand c'est le moteur ; pas lu ⇒ « — » et « Réessayer ».
- **« Message de refus »** : SON texte (vide = refus sans message), le même réglage.

## 4. Republier à la main au premier plan

- **Annonces → Republier** : le conseil « À la main : conseillé, le moins risqué » passe AVANT les
  suivis à reprendre (en arrivant, on le voit d'abord) ; un seul compte ⇒ un seul « Tout décocher ».
- **Feuille « Actions »** (Sélectionner) : « Republier à la main » est AU-DESSUS des tuiles, avec le
  bouclier et « Conseillé : tu publies toi-même, VRM prépare tout. » (avant : un lien discret dessous).
- **Le kit** : chaque carte donne ses gestes dans l'ORDRE où il les fait, numérotés : 1 Photos
  (dans la galerie) · 2 « Vinted ↗ » (page Vendre ; note le suivi de CETTE paire seulement, par son
  identifiant) · 3 copier le N° et la description. Le conseil dit l'ordre en une phrase. « Ouvrir
  Vinted ↗ » du pied (toutes les paires) et « Pas à pas » restent.
- « Par VRM » reste disponible, en second, inchangé.

## Preuves

- `npm run build` vert (après le vrai `git merge origin/main`, extension 5.340 comprise).
- **`scripts/audit-offres-sures.cjs`** (neuf) : 34 contrôles — A la règle exécutée (seuil lu comme le
  moteur, écriture normalisée, décision, aperçu « ses ventes seulement », historique et piège du
  LIKE, « pas lu » ⇒ null, alerte 40/45, journée calme) ; **B la parité avec le VRAI moteur** :
  16 cas joués par `autoAccepterOffres` de `background.js` dans un vm (faux Vinted qui compte les
  PUT) ET par `decisionMoteur` — mêmes issues partout, virgule comprise ; C le branchement (écran
  monté, lien depuis Outils, carte normalisée, rien envoyé, « Tout arrêter » n'éteint que).
  `--prouve` **16/16 mutations rouges** ; sur `origin/main` (`git archive`) : **8 rouges sur 8**.
- **Banc `scripts/bancs/offres-auto.cjs`** (neuf, jeu inventé de `nouveau-vendeur.cjs`, faux pont,
  390 tactile / 1512, clair / sombre) : **83 OK, 0 KO** — lien Outils, interrupteur, aperçu des
  4 offres (la garde PUBLIÉE par l'app juge « Acceptée » ou « Pas acceptée · un site pas relu »),
  jauge 41/50 + alerte, journée calme, historique (2 offres du 111, jamais celle du 1110),
  « Corriger » la virgule, saisie « 39,5 » ⇒ 39.5 et l'aperçu suit, série ⇒ feuille Prix mini,
  « Tout arrêter » ⇒ éteint + `auto_stop`/`arreter` pour chaque compte et rien d'autre, rien
  vers l'extension, 44 px au doigt, aucun débordement, aucune erreur. Sur `origin/main` (build
  de 3cb90230) : rouge dès le lien (l'écran n'existe pas).
- **Banc `republier-kit`** : vert aux 4 vues, + 4 contrôles neufs (ordre des gestes, « Vinted ↗ »
  d'une carte = le suivi de CETTE paire, conseil avant les suivis, un seul « Tout décocher ») —
  **les 4 rouges sur origin/main**, le reste vert.
- **Banc `republier-main`** : vert aux 4 vues, + « Republier à la main » avant les tuiles dans
  Actions — **rouge ×4 sur origin/main**.
- Audits verts : `offres-sures`, `offres-auto` (26), `moteur-offres` (24), `offres-garde` (25),
  `offres`, `republier-kit` (17, `--prouve` 13/13), `republier-main` (36, `--prouve` 22/22),
  `republier`, `annonces-actions` (69), `textes-courts`, `jauge-journal`, `variables`, `tdz`,
  `coherence`, `identite`, `icones`, `fonctions-api`.
- Captures regardées (390 clair/sombre, 1512 clair/sombre) : l'écran, les paires, la série,
  « Tout arrêter » ; le kit en étapes ; les suivis sous le conseil. Corrigé en les regardant : la
  puce de décision écrasait le titre au téléphone (passée dessous), le champ du seuil dessinait un
  champ dans le champ, l'historique disait « commande … » au lieu du titre, le seuil s'affiche
  « 45,5 » (écrit « 45.5 »).
- Pas fait : une mutation de rendu des bancs (rebuild par mutation trop long sur la machine
  partagée) — la logique est tenue par les mutations des audits.

## Reste / pour la 5.341

`2026-11-11-anti-ban.md` §5 : P1 (offres depuis l'onglet), P2 (`vrm_stop_tout` lu par
l'extension : la mise en ligne déjà planifiée part encore aujourd'hui après « Tout arrêter »),
P3 (un refus d'offre freine le compte), P4 (la virgule). À lui proposer : P8 plages horaires des
offres auto, P9 seulement quand il est sur Vinted, P10 plafond par jour.

## Geste de Julien

Aucun. À regarder : Messages → Favoris & offres → « Offres auto ».
