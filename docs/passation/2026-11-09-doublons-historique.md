# 9 nov. — Lot AF : même annonce sur deux comptes Vinted + histoire d'un N°

Propositions 45 et 49 (validées, `2026-11-09-propositions.md`). Branche `claude/doublons-historique`
(depuis `origin/main` ebe20e49), poussée à chaque commit, **pas de PR, pas de fusion**.
Rien dans `vinted-sync-extension/`. Aucun N° n'est réattribué ni changé par ce chantier.

## 1. La même annonce sur deux comptes Vinted (proposition 45)

### Ce qui existait déjà (mesuré dans le code avant d'écrire)
La règle existait depuis le 6 nov. (`src/enLigneDeuxFois.js`, vague 3,
`docs/passation/2026-11-06-vague3-en-ligne-deux-fois.md`) : deux annonces **en ligne**
(`<enligne-regle>`, jamais « à confirmer », jamais masquées ; un compte lu il y a plus de 24 h
ne conclut rien) de même **photo exacte** (`photoKey` : dossier ET fichier, ou la `photoK` de leur
fiche — `jumellesParPhoto`) ou reliées par `recreeDe` = la même paire. Elle n'était dite que
dans Ma journée (carte ambre, aujourd'hui dans « Ensuite » ou en tête), sans prix ni date.

⚠️ « Fichier/dossier photo » : le **dossier seul** n'est PAS une identité entre deux annonces
(mesuré : 17 collisions sur 261 annonces, 4 dossiers portant deux N°). `entryKeyByPhoto` ne s'en
sert qu'en dernier recours pour retrouver une fiche, quand tout le dossier porte le même N°. Ici :
photo exacte seulement (l'audit le garde : « même dossier, fichiers différents : rien »).

### Ce qui change
- **Écran Annonces** (Vinted) : une alerte **ambre** (`EnLigneDeuxFoisAlerte`,
  `src/EnLigneDeuxFois.jsx`, `data-annonces-deux-fois`) sous la ligne de fraîcheur, avec les
  **mêmes groupes** que Ma journée (`enLigneDeux.vinted`, §11). Pour chaque annonce : son
  **compte**, son **N°**, son **prix** (« prix pas lu » sinon, jamais 0 €), **depuis quand** elle
  est en ligne (`dateMiseEnLigneMs`, la date de l'écran Annonces ; « date de mise en ligne pas
  lue » sinon) et « Ouvrir sur Vinted » (44 px, nouvel onglet). Le geste est LE SIEN : retirer
  celle en trop sur vinted.fr — VRM ne supprime rien (§3). Au-delà de deux paires : « Tout voir »
  ouvre la feuille.
- **La feuille** (Ma journée et Annonces) montre aussi prix et date par annonce.
- `src/enLigneDeuxFois.js` : `dateDe`, `prix`/`depuis` par annonce, `prixEuros`, `texteEuros`,
  `texteDepuis`, `surDeuxComptes` (les groupes sur deux comptes différents).
- **« À trancher »** n'est pas sur `main` (branche `claude/a-trancher` en cours) : rien n'en
  dépend. La ligne de Ma journée existait déjà (carte « N°x en ligne deux fois »). Quand « À
  trancher » arrive, il peut lire `enLigneDeux.vinted` (ou `surDeuxComptes`) tel quel.

### Leboncoin, Vestiaire, eBay
**Aucune identité photo partagée n'existe dans le code** : les photos y sont RE-téléversées
(`photosEnOctets`, `photosPourEbay`, `photosPourVestiaire`) — leurs adresses ne disent rien de la
photo Vinted, et `clePhotoLbc` ne sert qu'à vérifier le formulaire Leboncoin (photos vinted.net).
L'identité entre sites est le N° (SKU `VRM-{n°}`, référence posée, N° Vestiaire) : c'est voulu
(« Publier ailleurs »), et quand l'une se vend, « Vendus ailleurs » la fait retirer. Deux annonces
d'un même site non Vinted sous le même N° : hors de ce lot (pas d'identité photo pour les relier).

### Coût
Aucune comparaison deux à deux : un passage par annonce, un index `Map` par clé photo
(union-find), dans le `useMemo` déjà existant (`enLigneDeux`). Mesuré par l'audit : le temps suit
n (2 000 → 8 000 annonces, rapport < 9 ; la mutation « quadratique » le fait rougir).

## 2. L'histoire d'un N° (proposition 49)

### Les traces qui EXISTAIENT (cherchées avant d'écrire)
| trace | où | ce qu'elle dit |
|---|---|---|
| `numberedAt` + `auto: true` | fiche (`vinted_annonce_numeros`) | donné à la mise en ligne |
| `manuelAt` (`auto: false`) | fiche | saisi à la main (le DERNIER seulement) |
| `reattribue { de, vers, at, main / archive, ecrit }` | fiche | doublon réglé (20 oct.), changé à la main, archive remplacée, « C'est écrit » — le DERNIER seulement |
| `recreeDe` / `recreeAt`, `numeroRendu` | fiche (`src/repriseNumero.js`) | repris de l'annonce republiée |
| `repriseAt` / `repriseDe` | fiche | repris d'une ancienne fiche (même paire) |
| `ecrit` / `ecritAt` | fiche (`src/numeroEcrit.js`) | lu dans le texte de l'annonce |
| `cartonVerifie` | fiche | carton vérifié (son clic) |
| `manuelAt`, `autoAssigned` | vente (`vinted_sale_overrides`) | N° posé sur une vente |
| `vrm_numerotation { archive, coupure, appliqueLe }` | `main`, écrit par le serveur | B… = ancien N° (migration 013) |
| `vrm_stock_sortis` | `main` | case du Stock libérée (colis parti), le N° reste |
| `vrm_parcours:…modifications` | sessionStorage, 7 jours, CET appareil | (déjà montré : « Modifications enregistrées sur cet appareil ») |

`vrm_numeros_perimes`, `vrm_pool_retreci`, `vrm_fiche_perdue` sont des **refus** de la base
(garde-fous), pas des journaux : rien à y lire.

### Ce qui manquait pour l'avenir ⇒ le journal des N° (append-only)
Chaque champ de la fiche ne garde que SON dernier événement : deux changements à la main, ou un
doublon réglé puis une saisie, effaçaient le premier. **`vrm_numeros_journal`** (nouvelle clé de
`main`, dans `SYNC_KEYS`) : une ligne `{ at, id, num, de?, quoi, src? }` par changement de N° d'une
fiche, écrite **au moment même** par `save` (`noterJournalNumeros`, App.jsx) quand
`vinted_annonce_numeros` est sauvegardée — TOUS les chemins passent par là (numérotation
automatique, `poserNumero`, règlement des doublons, reprise, « Je numérote moi-même », gestes
annulables). La ligne est déduite de la différence avant/après (`evenementsNumeroFiches`) :
`auto` · `main` · `doublon` · `reprise` · `ecrit` · `archive` · `inconnu`.
- **Même ligne synchronisée que le N°** (`main`), même envoi (comparer-et-échanger sur `data.rev`
  par `cloudPush`), fusion des listes par élément (`fusion3` : une ligne ajoutée ici, une là-bas,
  les deux restent).
- **Append-only** : `ajouterAuJournal` n'enlève ni ne réécrit rien ; une ligne rejouée n'est pas
  doublée. Une sauvegarde du journal en attente est prolongée (`_journalNumAttente`).
- **Jamais sur un conflit** de numéros (`r.conflit`), **jamais sans état d'avant** sur l'appareil
  (on ne saurait pas ce qui est neuf), jamais pour un N° vidé. Il ne change AUCUN N°.
- Taille : ~90 octets par changement de N°. Rien n'est jamais purgé (append-only) : à surveiller si
  la ligne `main` grossit (des milliers de changements = quelques centaines de Ko).

### Ce que montre la fiche
`src/historiqueNumero.js` (`historiqueNumero`, pur) ⇒ `FichePaire` : section **« L'histoire du N° »**
(`data-fiche-histo-num`), lecture seule (aucun bouton ni champ), neutre (aucune couleur) :
journal (posé / quitté), origine par la fiche (le dernier événement de chaque champ), « C'est
écrit », carton vérifié, N° quitté par une annonce (doublon réglé, republiée), N° posé sur une
vente, B… ⇒ « Ancien N°230 passé en « B230 » à la remise à zéro » (date du serveur), case du Stock
libérée. Une fiche sans trace : **« Origine non enregistrée (avant le 9 nov. 2026) »** ; un
événement d'avant le 9 nov. ajoute la note « Avant le 9 nov. 2026, VRM ne gardait que le dernier
changement de chaque annonce. » Fiches pas lues ⇒ rien (pas su), jamais une histoire vide.

## Preuves (§6)

- **`node scripts/audit-doublons-historique.cjs`** : **39/39**. Exécute la vraie règle, la vraie
  `photoKey`, la vraie `cleNum`, le vrai `historiqueNumero` : 50 paires identiques en titre /
  marque / taille sur deux comptes, photos différentes ⇒ AUCUNE alerte ; même photo ⇒ une alerte,
  compte, prix, date par annonce ; même dossier ⇒ rien ; compte lu il y a 30 h (« à confirmer »)
  ⇒ aucune alerte, nommé ; coût linéaire ; App : seules les annonces en ligne, mêmes groupes
  qu'en Ma journée, ambre, rien qui supprime ; journal (lignes seulement quand un N° change,
  append-only, sans avant ⇒ rien), ligne de vie (non enregistrée, doublon, quitté, main, B, Stock),
  entrées gelées, hook dans `save`, clé synchronisée, fiche en lecture seule.
  - `--prouve` : **14/14 mutations rouges** (par titre, lecture vieille qui conclut, comparaison
    quadratique, prix/date tus, Annonces sans alerte, « à confirmer » compté en ligne, alerte
    rouge, journal sans avant, journal réécrit, origine devinée, N° retiré noté, hook absent,
    journal pas synchronisé, bouton dans l'histoire).
  - sur `origin/main` (ebe20e49, `git archive`) : **13 rouges** (9/22 : les modules et l'alerte
    n'existent pas).
- **Banc `scripts/bancs/doublons-historique.cjs`** (données inventées, 390 tactile SOMBRE et 1512
  clair, port 9652) : **49 verts, 0 rouge** sur la branche ; **8 rouges** sur le build
  d'`origin/main` (ebe20e49, `BANC_DIST`) ; mutation « la règle relie aussi par le TITRE » (build
  à part) : **2 rouges** (50 titres identiques ⇒ une alerte). L'alerte est jugée AU-DESSUS de tout
  (`elementFromPoint`) : la première capture montrait encore l'écran d'attente (horloge du banc
  posée) — le banc avance maintenant l'horloge. Captures regardées : alerte Annonces (390 sombre,
  1512), fiches N°12 (« Saisi à la main (avant : N°7) », une seule fois) et N°40 (« Origine non
  enregistrée (avant le 9 nov. 2026) »).
- Remarque vue sur la capture : l'étape « Numéroté » de la frise (`histoireArticle`, déjà là)
  dit « posé à la main » pour une fiche `auto: false` datée par `numberedAt` ; l'histoire du N° dit
  la même chose depuis le journal. Pas touché (fichier d'un autre chantier) ; à unifier un jour
  (une notion, une règle).
- `audit-en-ligne-deux-fois` : 42/42, `--prouve` 15/15 (son contrôle de l'appel accepte
  l'argument `dateDe` ajouté).
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones`
  verts ; audits des numéros verts : `conflits-numeros`, `etiquette-numero`,
  `garde-numeros-rapide`, `masquees-numeros`, `numero-ecrit`, `numero-etiquette`, `numero-vinted`,
  `numeros-lettres`, `numeros-vestiaire`, `numerotation-lecteurs`, `prix-numerotage`,
  `recherche-numero`, `reprise-numero`, `fusion-nuage`, `rouge-doublon`, `recherche-fiche`.

## Ce qui reste
- « À trancher » : brancher `enLigneDeux.vinted` quand la branche arrive sur `main`.
- Le journal ne voit pas les écritures faites hors de `save` : le serveur (migration 013, déjà
  dite par le marqueur) et une restauration « Recharger » (écriture directe, voulue).
- Une republication à la main hors VRM (photo re-téléversée, autre fichier) reste invisible ici :
  pas d'identité sans photo exacte (§5).
- Geste de Julien : aucun.
