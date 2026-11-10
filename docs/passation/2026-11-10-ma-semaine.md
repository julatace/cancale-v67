# 10 nov. 2026 — Lot BC : « Ma semaine », l'écran du bilan de la semaine

Branche `claude/ma-semaine` (depuis `origin/main`, puis un vrai `git merge origin/main`). Pas de
PR, pas de fusion. L'extension n'est pas touchée.

Validé par Julien (non développeur, peu de texte, du visuel) : un ÉCRAN, ouvert depuis la
notification du dimanche soir, depuis Ma journée et depuis Statistiques, qui montre la semaine.

## L'écran (`?tab=semaine`, `src/MaSemaine.jsx`, `src/styles-ma-semaine.css`)

- Tête : « Ma semaine » ; ‹ « Cette semaine · 2 – 8 nov. » › (ronds de 44 px ; › grisé sur la
  semaine en cours, ‹ jusqu'à 52 semaines en arrière).
- Grand widget **Vendu** (34/800 au téléphone, 44 sur ordinateur), la flèche vs la semaine
  d'avant, puis une **barre par jour** (L M M J V S D ; aujourd'hui en bleu, la seule couleur
  d'accent ; un jour à venir : barre vide en filet, aucun chiffre).
- Widgets blancs (DA6, rayon 24, 2 par ligne au téléphone, 4 sur ordinateur) : **Ventes**,
  **Bénéfice brut** (« au moins 70 € · 2 sur 3 prix d'achat » + « Saisir les prix d'achat » en
  ambre — la porte, §5), **Reçu** (jour du versement), **Colis envoyés**, puis **Paires qui
  dorment** en large. Chaque widget touché ouvre son écran (Ventes, Colis, Annonces ; Reçu ⇒
  Compta, ou Ventes s'il n'est pas encore publié).
- Pied : « Vendu : jour de la vente. Reçu : jour du versement. » (vendu ≠ reçu, §5).
- Comparaison NEUTRE : flèche grise ↑/↓/= et l'écart (« +65 € vs semaine d'avant »), jamais
  rouge ni vert.
- ≤ 12 mots par bloc (le banc les compte).

## Une seule règle (aucune nouvelle)

`src/maSemaine.js` ne fait que BORNER et COMPARER :
- **Bornes** = celles du bilan en notification (`api/_lib/bilan-semaine.js`) : `semaineCourante`
  (lundi 00:00 à Paris → MAINTENANT — jamais une vente future) pour la semaine en cours, lundi →
  lundi sinon (`minuitParis`, passage d'heure compris). Un lundi demandé invalide, futur ou trop
  ancien ⇒ la semaine en cours ; un mercredi ⇒ le lundi de sa semaine.
- **Ventes, vendu, bénéfice brut, colis envoyés** = `journalSemaine` (src/journalSemaine.js —
  celui de la carte « Semaine du … » et de la frise de Ma journée) : `bilanLignes` sur les lignes
  de `ventesFaites` de la coque (comptes SÉLECTIONNÉS ; `api/_lib/ventes-regle.js` en est la copie
  refabriquée par `audit-bilan-semaine.cjs --recopie`, inchangée ici), `beneficeDesJours` /
  `chiffreBrut` sur `vrm_benefice_jours`, ses gestes « Colis fait ».
  Seul ajout à `journalSemaine` : `finJours` (facultatif) — la publication du bénéfice est AU
  JOUR, une semaine en cours compte donc son jour entamé entier (sans lui, le bénéfice
  d'aujourd'hui manquait). Les appelants d'avant ne le passent pas : rien ne change pour eux.
- **Reçu** = `recuPublieEntre` + `recuAvecADater` (la ligne publiée par Ventes, comme
  Statistiques et Compta).
- **Qui dorment** = `dormentDe`, sortie TELLE QUELLE de `calculerBilan` dans
  `api/_lib/bilan-semaine.js` (le bilan l'appelle, l'écran aussi) : publication d'Annonces
  `vrm_paires_dorment`, pas su sans date ou au-delà de 8 jours, « au moins » si des dates manquent.
- **La comparaison** : la semaine d'avant AU MÊME MOMENT (lundi → même jour, même heure de Paris)
  quand la semaine montrée est en cours ; entière sinon. Un écart ne se dit que si les DEUX
  chiffres sont sus ET complets : un « au moins » ou un « — » ⇒ aucune flèche.
- Trois états partout : en cours (« lecture… »), pas su (« — » et sa raison), lu.

## La notification ouvre l'écran

- `api/_lib/lien-notif.js` : nouvelle destination `DESTINATIONS.semaine({ lundi })` et clé
  `lundi` (AAAA-MM-JJ, omise si mal formée). `api/ship-reminders.js` : le bilan (dimanche soir
  ET rattrapage du lundi) porte `/?tab=semaine&lundi=<lundi de SA semaine>` — le dimanche, la
  semaine en cours ; le lundi matin, la semaine passée. Aucune fonction `api/` ajoutée (12).
- App : `semaine` dans `ONGLETS_LIENS` (liste blanche), `goto` lit `lundi`
  (`DEMANDE_SEMAINE`, + événement `vrm:semaine` si l'app est déjà ouverte), `titreEcran`,
  `BAR_GROUPE` (Ma journée reste allumée), `api/_lib/signalement.js` `ECRANS`.
- Ma journée : « Ma semaine › » à côté de « Semaine du … » dans la frise
  (`data-ouvre-ma-semaine`). Statistiques : un lien « Ma semaine › » sous le vendu par semaine
  (une ligne, rien d'autre touché dans Stats.jsx — chantier Compta↔Stats en cours ailleurs).

## Preuves

- `node scripts/audit-ma-semaine.cjs` : **35 verts** ; exécute `src/maSemaine.js` avec les vraies
  fonctions d'App.jsx sur des ventes INVENTÉES, et compare au SERVEUR : le dimanche soir, ventes et
  vendu de l'écran = `calculerBilan` sur les mêmes commandes (ventes faites par
  `api/_lib/ventes-regle.js`). `--prouve` : **6/6 mutations** rouges (semaine en cours bornée à
  la fin de semaine ⇒ vente future comptée ; écart sur un « au moins » ; semaine d'avant entière
  au lieu du même moment ; « qui dorment » sans limite d'âge ; jour à venir à 0 ; lien vers Ma
  journée). Sur l'arbre d'`origin/main` (git archive) : **13 rouges**.
- Banc `scripts/bancs/ma-semaine.cjs` (données inventées, horloge de la page FIGÉE au dimanche
  8 nov. 19 h Paris, 390 px tactile et 1512 px, clair et sombre) : **~80 verts** — lien de la
  notification, vendu 135 € (la vente de 21 h exclue), 3 ventes, +65 € / +1, barres par jour,
  bénéfice « au moins » sans flèche, colis « au moins 2 » sans flèche, qui dorment 4, reçu « — »,
  aucune couleur rouge/verte, boutons ≥ 44 px, aucun débordement, ≤ 12 mots par bloc, ‹ / ›,
  lien du lundi, Ma journée (390 et 1512) et Statistiques y mènent. Sur `origin/main` rebâti :
  **8 rouges** (aucun écran) ; sur un build muté (fin de semaine + écart sur partiel) :
  **29 rouges**.
- Captures regardées : 390 et 1512, clair et sombre, la semaine d'avant, les liens. Vu et corrigé :
  « sans envois pas notés » ⇒ « des envois pas notés ».
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `urssaf`,
  `benefice`, `benefice-unique`, `chiffres`, `fonctions-api` (12), `bilan-semaine` (54),
  `bilan-mois` (48), `cibles-notif`, `notifications`, `notifs-centre`, `onglets-a`, `onglets-d`,
  `bancs`, `composants` : verts. Banc `bilan-semaine` : 27 verts (le lien attendu est désormais
  `/?tab=semaine&lundi=2026-09-28`).
- Bancs relancés un à la fois après le `git merge origin/main` : `ma-semaine` 0 échec,
  `bilan-semaine` 27 verts, `journee-v2` 0 rouge, `journee-coherence` rien à signaler,
  `journee-chiffres` 24 verts, `stats-vitrine` 112 verts. `carte-stats` : 3 rouges « A. les
  autres pages — Cannot read properties of null (reading 'id') », LES MÊMES sur `origin/main`
  (042170f) rebâti — pas touché ici.
- Déjà rouges sur `origin/main`, pas touchés : `audit-journal-semaine` (« Ma journée monte le
  journal en tête » — la carte a été fondue dans la frise le 9 nov.), `audit-signalement`
  (`republier`, `favoris` absents d'`ECRANS` ; lecture du collecteur), `audit-reprise-ecran`
  (balayage du bord), `audit-violet` (couleurs de FedEx / Relais Colis).

## Ce qui reste / à savoir

- Ma journée, au téléphone : « Ma semaine › » passe à la ligne sous « Aujourd'hui » (la ligne
  du jour ne coupe plus le nom du jour) ; à l'ordinateur, à côté de « Semaine du … ».
- La semaine d'avant « au même moment » : un mercredi se compare au mercredi d'avant à la même
  heure ; le bénéfice et le reçu étant publiés AU JOUR, leur coupe est le jour entier.
- Ma journée (frise, déjà sur `main`) compte une vente datée plus tard dans la journée en cours
  (bornes au jour) ; l'écran « Ma semaine » la borne à maintenant comme le bilan. Rien de changé
  dans la frise.

## Geste de Julien
Aucun.
