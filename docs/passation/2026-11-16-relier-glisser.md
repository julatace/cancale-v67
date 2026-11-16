# 16 nov. 2026 — Relier en glissant (lot `relier-glisser`)

## La demande

Julien : « Quand je veux relier un achat à une annonce ou à une vente, faire comme quand on reste appuyé
sur une app sur iPhone : ça vibre, et après tu places [l'achat] sur la vente ou l'annonce. Sinon une liste,
ça peut être aussi simple. »

La liste (« Relier un achat » / « Choisir un achat ») reste ; le glisser s'ajoute.
Branche partie de `claude/achats-retour` (qui contient `claude/relier-fiable`, PR #1199) : le glisser
applique la règle « un achat en retour / litige / remboursé n'est jamais proposé » (lot `achats-retour`).

## Ce qui est livré

- **Entrées** : Achats (bouton « Relier en glissant » dans la barre du haut, ou la barre de l'espace
  plateforme), Annonces → « Sans achat relié » (à côté de « Saisie en série »), et la feuille « Relier un
  achat » (lien dans son en-tête) — donc aussi depuis la puce « Relier un achat » d'Annonces et depuis Ventes.
- **Écran** (`src/RelierGlisser.jsx`, plein écran par portail, `FermeAuRetour`) : téléphone = achats EN HAUT,
  annonces / ventes EN BAS ; ordinateur (≥ 900 px) = deux colonnes. Achats LIBRES seulement
  (`tousAchatsLibres` : ni reliés — un lot jusqu'à son nombre —, ni annulés, ni en retour / litige /
  remboursés), les « très probables » de #1199 en tête et marqués ; cibles = `fileAchat` + `fileVendus`
  (annonces et ventes SANS achat relié : une ligne reliée n'est jamais une cible).
- **Geste** (`src/relierGlisser.js`, règles pures) : appui long 400 ms ⇒ l'achat se SOULÈVE (agrandi 6 %,
  ombre, petite oscillation ; sans oscillation si « mouvement réduit »), suit le doigt ; un doigt qui bouge
  de plus de 10 px avant 400 ms = un défilement normal (jamais un glisser) ; à la souris un glisser franc
  (6 px) démarre tout de suite. La cible survolée s'éclaire (bord et anneau bleu, seul accent). Près du bord
  haut / bas de la liste cible, elle défile seule — seulement si le doigt y RESTE 300 ms (le traverser en
  arrivant du haut ne la fait pas remonter : défaut trouvé au banc, corrigé).
- **Lâcher** sur une cible ⇒ une ligne : « Relier N°2 à cet achat de 40,00 € ? Oui · Annuler » (sans N° :
  le titre ; un lot : « le prix de cet article te sera demandé »). Lâcher ailleurs ⇒ rien.
- **« Oui »** ⇒ l'écriture de « Relier » (`ecritureRelierAchat` : prix du reçu, lot demandé) posée par
  l'IDENTITÉ de la ligne (`opsRelierGlisse` : la fiche de l'annonce, ou de l'annonce vendue ; sinon la vente
  par son n° de transaction), en UN geste annulable 5 s (`gesteVrm`, pilule « Annuler »).
- **Clavier / lecteur d'écran / simple toucher** : toucher (ou Entrée sur) un achat le CHOISIT
  (`aria-pressed`) ; chaque cible offre alors « Relier ici » ⇒ la même question.
- Textes par `tr()`, 5 langues (`glisser.*` dans `src/i18n/langues/*/liaison.js`) ; Quoi de neuf.

## La vibration — honnêtement

`navigator.vibrate` (Vibration API) **n'existe pas dans Safari iOS**, ni dans une web app installée sur
l'écran d'accueil (WebKit ne l'a jamais livrée ; table de compatibilité MDN : « Safari on iOS : non »).
VRM ne l'appelle que si elle existe (`vibrerSiPossible` : Android / Chrome, 12 ms) ; sur iPhone le
« soulèvement » est le seul retour. Aucun texte de l'écran ne parle de vibration (`audit-relier-glisser` V3).

## Preuves

- `scripts/audit-relier-glisser.cjs` : **39 verts**, `--prouve` **13/13 mutations** (appui sans délai,
  délai nul, bord inversé, bord hors liste, tous les achats, « très probable » vers une cible absente,
  Annuler qui perd l'état, écriture sans identité, vibration partout, cibles déjà reliées, écriture non
  annulable, doigt qui défile pendant le glisser, défilement toujours bloqué). Arbre d'avant : rouge (module absent).
- Banc `scripts/bancs/relier-glisser.cjs` — 390 tactile avec de VRAIS évènements tactiles (CDP
  `Input.dispatchTouchEvent` : touch + pointer, le navigateur défile pour de vrai) et 1512 souris + clavier :
  voir « Mesures » ci-dessous. Captures regardées (ouvert, levé dans le vide, pendant le glisser, question,
  relié ; 1512 pendant et clavier).

## Mesures

(remplies au dernier passage du banc : voir le rapport de PR)

## ÉTAT À LA REPRISE

- Branche `claude/relier-glisser` poussée ; PR vers `main` après celle de `claude/achats-retour`.
- Pas mesuré sur un vrai iPhone (aucun appareil ici) : le banc joue les évènements tactiles de Chromium.
  Geste de Julien utile : essayer l'appui long sur son iPhone (Safari et web app) et dire si le défilement
  et le soulèvement se comportent bien.
