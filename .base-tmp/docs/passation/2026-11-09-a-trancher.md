# 9 nov. — « À trancher » (lot AC, proposition 43) — branche `claude/a-trancher`

Julien (validé, « fais tout ») : UN seul endroit pour tout ce que VRM n'a pas pu décider, éparpillé
jusqu'ici dans 8 écrans ; une ligne = UNE chose + UN geste ; un badge ; objectif zéro ; « tu ne peux
pas avoir d'hésitation ». Aucune base réelle lue d'ici : tout est mesuré sur le code et sur un jeu
INVENTÉ de la vraie forme. Extension : rien changé (aucune version).

## 1. Ce qui existe maintenant

- **Écran « À trancher »** (`tab=trancher`, lien `?tab=trancher` permis) : Plus/colonne → groupe
  « Gérer », en tête (icône `help`), badge ambre = le total (rien à 0, jamais « 0 »).
  `src/ATrancher.jsx` (formes existantes `GroupeIos`/`RangeeIos`, `vrm-vide-dessin` : la direction
  artistique 6 peut tout restyler sans toucher au sens). Une rangée = « N chose » + pourquoi + UN
  geste (ambre) ; les sources pas sues dans un groupe « Pas encore compté » avec « — » et la raison
  (« pas encore compté sur cet appareil : ouvre Colis », « compté il y a 14 h : ouvre … ») — leur
  rangée ouvre l'écran qui les compte. État vide : « Rien à trancher » ; s'il manque une source :
  « Rien à trancher dans ce qui est compté » + le groupe « Pas encore compté ».
- **Ma journée** : une ligne « N choses à trancher » (« Au moins N » s'il manque une source),
  seulement si N > 0 (`data-job="a-trancher"`, prio 1.9 : après les colis, avant les conseils) ;
  la toucher ouvre À trancher.
- **La règle** : `src/aTrancher.js` (pur, exécuté par `scripts/audit-a-trancher.cjs`).

## 2. Les sources (dans l'ordre affiché : un colis / de l'argent d'abord)

| clé | ce qui est compté | propriétaire (qui publie) | geste (ce qu'il ouvre) |
|---|---|---|---|
| `numeros-double` | `conflitsNum.length` (deux paires sous un N°) | Comptabilite (Colis/Ma journée/Annonces), lecture complète, `!numAttente` | Colis · À envoyer, défile au bloc rouge (`data-numeros-double`, ajouté) |
| `colis-postes` | `cochesNonPartis.length` | Comptabilite, ventes lues | Colis · Envoyés |
| `colis-retirer` | `vrm_colis_retirer.aVerifier + enVerification` (publication existante, 12 h) | Colis (`pickupUnion`) | Colis · À retirer |
| `numeros-a-ecrire` | `aEcrireCarton.length` (« C'est écrit » pas dit) | Comptabilite, lecture complète | Colis · À envoyer → `data-numeros-a-ecrire` |
| `numeros-a-verifier` | `aVerifierCarton.length` (N° « à vérifier sur son carton ») | Comptabilite, lecture complète | Annonces → `data-numeros-a-verifier` |
| `sms-vestiaire` | infos SMS Vestiaire pas reliées par son clic | `src/InfosSms.jsx` (liens lus) | Colis · À envoyer → `data-infos-sms="vestiaire"` |
| `sms-pickup` | infos SMS Pickup montrées (14 j) | `src/InfosSms.jsx` | Colis · À retirer → `data-infos-sms="pickup"` |
| `supprimes-vinted` | cartes « N°x supprimé de Vinted » pas répondues | Ma journée (`cycle`) | Ma journée → `data-job="supprime-vinted"` |
| `remise-en-ligne` | `remises.length` (« même paire que N°X ? ») | Comptabilite (suppressions lues) | Annonces → `data-remise-bloc` |
| `achats-sans-prix` | `aRelierJournee(fileAchat)` (le nombre de Ma journée) | Comptabilite | Annonces, vue « Sans achat relié » |
| `adresses-sans-compte` | `adressesSansCompte(...).length` | E-mails → Relier (`AdressesSansCompte`) | E-mails, vue « Relier », bloc des adresses |
| `comptes-a-relire` | `comptesARelireDe(liveStats)` — LA règle de la puce de Colis, déplacée telle quelle (Colis l'appelle) | la coque (`liveStats.dataAge*`) | Comptes liés |
| `ventes-a-dater` | `vinted_urssaf_mois.aDater.n` (publication existante, 3 j comme le widget) | Ventes (`ventesDeclarables`) | Compta |

Publication : `vrm_a_trancher` = `{ uid, s: { cle: { n, at } } }` dans le stockage de l'appareil,
**jamais synchronisé** (un nombre par source, aucune donnée métier, aucun titre). Écrite seulement
sur une lecture complète de l'écran propriétaire (une liste partielle ne publie rien), un entier
≥ 0 ; un autre compte VRM ne la lit jamais (`uid`) ; > 12 h ⇒ « pas su ». Rien d'autre n'est écrit :
le geste ne fait qu'ouvrir (`allerTrancher` : `demanderVue`, `choisirOngletColis`, `setTab`, puis
`suivreCibleTrancher` touche un onglet de l'écran si besoin et défile jusqu'au bloc, 10 s au plus).

## 3. Preuves (§6)

- `node scripts/audit-a-trancher.cjs` — 23 contrôles (somme, pas su ≠ 0, vieillissement, cloison
  par compte, `publierSource` borné, parité exacte de `comptesARelireDe` avec l'ancienne expression
  de Colis sur 8 cas, badge/phrase, ordre, chaque source publiée par un écran).
- `node scripts/bancs/a-trancher.cjs` (port 4497, `AT_SEUL=S|G|T|J|Z`, `SHOTS=`) — jeu inventé portant
  un cas de CHAQUE source ; 1512 clair et 390 tactile sombre :
  S total = 23 fait à la main = somme des sources rangées relue dans la page, 12 lignes dans l'ordre,
  « — » pour la source jamais comptée, « au moins », badge 23, aucune écriture pendant 3 s d'écran
  (le signe de vie du jour `vrm_vu` de la coque mis à part, nommé) ; G chaque geste ouvre le bon écran,
  le bon onglet de Colis, la vue « Sans achat relié », la vue « Relier » des e-mails avec le bloc à
  l'écran, et n'écrit aucune donnée (`main` comparée clé à clé ; les publications dérivées
  `CLES_PUBLIEES` mises à part) ; T l'adresse comptée par SON écran (24), puis « C'est un compte
  acheteur » (confirmé) : l'écriture part sur ce geste seul, la ligne SORT, total et badge reviennent à
  23 ; J Ma journée dit la somme rangée à cet instant et ouvre À trancher au même total ; Z tout à 0 :
  « Rien à trancher », aucun badge, aucune ligne dans Ma journée.
  **Rouge sur `origin/main`** (arbre `git archive`, banc copié dedans, son propre build) et **par
  mutation** (5 mutations, chacune rouge sur sa partie) — chiffres dans le rapport de la session.
- Audits : `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones` verts ; `npm run build`.
- Captures regardées (S 1512/390, G, T, J, Z).

## 4. Ce qui reste / à décider par Julien

- **Ventes à dater** : chez lui ≈ 1 772 ventes Vinted sans date de versement (mesuré le 6 nov.) ⇒ le
  badge vaudra ~1 780 tant qu'elles ne sont pas datées, et l'objectif zéro est hors d'atteinte. La
  ligne est la publication telle quelle (aucune règle nouvelle). À décider : la garder, ne compter
  que l'année en cours (`aDater.annees`, déjà publié), ou la sortir du compteur.
- Les sources publiées par un écran sont « — » sur un appareil où cet écran n'a pas été ouvert depuis
  12 h (local, pas synchronisé) : Ma journée (ouvert chaque matin) en publie 7 ; SMS (Colis) et
  adresses (E-mails → Relier) attendent leur écran. Les synchroniser = une clé `main` de plus.
- Pas encore dans la liste (pas de nombre publié ou pas un « doute ») : achats Vinted « à relier »
  hors annonces, `nePasPoster` eBay, colis à confirmer (« Tout est OK », un geste daté, pas un doute),
  ventes « non comptées » (prix pas lu : pas de geste).
- Le style : `claude/direction-artistique-6` peut reprendre l'écran (classes existantes seulement).
