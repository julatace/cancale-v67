# 10 novembre — Lot J : importer un tableur, partager une photo, aide par écran (sans vidéo)

Branche `claude/import-partage-aide` (depuis `origin/main`, `origin/main` refusionné avant le rapport).
Propositions 9, 10 et 11 validées le 9 nov. (« fais tout sinon, même l'aide, on fera les vidéos après ») —
`2026-11-09-propositions.md`.

## 1. Importer ses achats depuis un tableur (proposition 9)

Achats → « + Ajouter » → **Importer un tableur** (en haut de « Nouvel achat »). Feuille
`src/composants/ImportAchats.jsx`, règle pure `src/importAchats.js`.

- **Lu dans le navigateur**, rien n'est envoyé : CSV (« ; », « , » ou tabulation, UTF-8 ou encodage
  d'Excel Windows), **.xlsx sans aucune dépendance** (un .xlsx est un zip de XML ; le navigateur
  décompresse avec `DecompressionStream('deflate-raw')`, le zip et le XML sont lus par ~80 lignes
  dans le module). Aucune bibliothèque ajoutée : pas de licence à vérifier. `.xls` ancien : refusé et dit
  (« enregistre en .xlsx ou .csv »). 5 Mo, 2 000 lignes au plus.
- **Colonnes reconnues** : Date, Description, Prix, Où, Référence, N° (synonymes : « Article »,
  « Montant », « Fournisseur », « N° de commande », « Facture »…). « N° de commande » est une
  RÉFÉRENCE, pas un N° de rangement. Chaque colonne a son menu pour corriger ; une colonne obligatoire
  absente (date, description, prix) est nommée.
- **Aperçu ligne à ligne** : à importer · déjà là · écartée (et pourquoi), pastilles en tête
  (« 3 à importer · 1 déjà là · 1 écartée », ambre = à corriger dans son fichier).
- **Rien n'est écrit sans « Importer N achats »**. Les achats rejoignent `vinted_offvinted_buys`
  (la liste des achats hors plateforme, marqués `importe: true`).
- **Prix (§2.5)** : celui de SON fichier, tel quel ; vide ⇒ vide (jamais 0) ; illisible ⇒ ligne écartée.
- **Date** : à la française (jour/mois) ou date Excel ; illisible/absente ⇒ ligne écartée (jamais
  « aujourd'hui »).
- **Doublons par RÉFÉRENCE seulement** (`refAchat` de `src/achatsDoubles.js`) : déjà dans VRM (achat
  hors plateforme, n° de transaction Vinted) ou deux fois dans le fichier. Jamais par titre/prix/date :
  50 lignes identiques sans référence entrent toutes, et l'aperçu dit « N sans référence : un doublon
  ne s'y voit pas ».
- **N°** : traduit comme partout après la remise à zéro (`numeroExterne` par la date de la ligne :
  « 230 » d'avant la coupure = B230) ; archive active et pas de date ⇒ aucun N° (« N° pas su »).
- **Coût d'une paire** : le prix devient le coût par N° (`vinted_buyprice_by_num`) SEULEMENT si le N°
  désigne une seule fiche sans aucun prix — relu au moment d'écrire ; un prix déjà là n'est jamais
  remplacé (« a déjà un prix », « sur deux paires » dits dans l'aperçu).

## 2. Partager une photo depuis Photos (proposition 10)

- `public/manifest.webmanifest` : `share_target` (POST multipart, `photo`, `image/*`) ⇒ VRM installée
  apparaît dans « Partager ».
- `public/sw.js` reçoit le POST `/partage-achat`, range UNE image (15 Mo au plus, une image seulement)
  dans la réserve de l'appareil (`vrm-hl-partage`, gardée aux mises à jour, vidée à la déconnexion),
  puis ouvre `/?tab=achats&achat=1&photo=partage` (le lien du lot Siri). Pas d'image ⇒ le formulaire
  sans photo.
- `src/partagePhoto.js` : la photo est lue UNE fois puis retirée ; plus de 10 min ⇒ jetée.
  « Nouvel achat » s'ouvre avec la photo (compressée comme une photo choisie) ; rien n'est écrit avant
  « Ajouter l'achat ».
- ⚠️ **Limite dite** : Safari (iPhone) ne propose pas les apps web dans la feuille de partage — ça
  marche sur Android (Chrome) et sur ordinateur là où Chrome installe l'app. Sur iPhone, le bouton
  « Photo » du formulaire ouvre la photothèque. Si l'app n'a pas de service worker actif au moment du
  partage, le POST arrive au serveur (aucune route) : cas improbable (le partage exige l'app installée).

## 3. Aide par écran sans vidéo (proposition 11)

- Le « ? » existait (`AideEcran`, 8 nov. : 3 questions + article + Signaler). Il ouvre maintenant
  **en tête 3 à 5 gestes numérotés** de cet écran (« En quelques gestes »), puis les questions.
- Texte écrit UNE fois dans `scripts/aide-contenu.cjs` (`ETAPES_ECRANS`, 12 écrans) ;
  `node scripts/aide-generer.cjs` en fait `src/aideEtapes.js` ; `--verifier` est rouge s'ils divergent.
- Corrigé au passage : l'accueil du centre d'aide avait un titre imbriqué cassé
  (« Comment t'aider<h1>Comment peut-on t'aider ?</h1>nbsp;?</h1> »).

## Preuves

- `scripts/audit-import-partage-aide.cjs` : **36 verts** ; `--prouve` **14/14 mutations rouges** (date
  absente ⇒ aujourd'hui, prix illisible accepté, doublon VRM ignoré, doublon par titre, N° sans la
  date, coût posé sur un N° qui a un prix, mois/jour inversés, « N° de commande » lu comme N°, le
  service worker range n'importe quel fichier, le lien ne porte plus la photo, vieille photo servie,
  geste d'aide trop long, l'app écrase un prix, la feuille sans gestes). Exécute le VRAI `public/sw.js`
  (fausse réserve), lit un VRAI .xlsx fabriqué (deflate + stocké). Sur `origin/main` : 0 vert, 12 rouges.
- Banc `scripts/bancs/import-partage-aide.cjs` (390 tactile + 1512, clair + sombre) : **tout vert** —
  aperçu 3/1/1, prix vide gardé, rien écrit avant le clic, puis 3 achats écrits et l'ancien gardé ;
  photo partagée dans « Nouvel achat », réserve vidée, rien écrit ; « ? » d'Achats = 4 gestes avant
  les questions. Captures regardées.
- Audits verts : aide-signalement, raccourcis-siri, variables, tdz, coherence, identite, icones,
  note-achat-double, csp, journee-hors-ligne, inventaire-hors-ligne, notifs-belles, vapid.
  `audit-signalement` : 2 rouges déjà sur `origin/main` (écrans « litiges/republier/favoris » absents
  de sa liste, sonde `statut_sondes`) — pas de ce lot.

## Gestes de Julien

Aucun. (Pour essayer le partage : Android/Chrome, VRM installée sur l'écran d'accueil.)
