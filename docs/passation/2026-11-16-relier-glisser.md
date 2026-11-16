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

- Banc `relier-glisser` : **39/0** (390 doigt : défilement rapide ⇒ la liste défile, rien ne se lève ; appui
  long 650 ms ⇒ levé ; lâché dans le vide ⇒ rien ; bord bas tenu ⇒ la liste cible défile seule ; glissé sur
  N°2 ⇒ elle seule s'éclaire, « Relier N°2 à cet achat de 40,00 € ? », « Oui » ⇒ fiche N°2 seule reliée,
  annonce et achat sortent des listes ; pilule « Annuler » ⇒ lien retiré, l'annonce revient. 1512 souris :
  deux colonnes, molette ⇒ aucun glisser, vide ⇒ rien, glissé sur la vente ⇒ lien sur la vente (son n°),
  Annuler ⇒ retiré ; clavier : Entrée choisit, « Relier ici » ⇒ même question, rien écrit avant « Oui »).
- Mutation au banc (build muté : un doigt qui bouge lève l'achat sans attendre 400 ms) : **2 rouges** (« aucun
  achat ne se lève », « la liste défile » 0 → 0). Arbre d'avant : pas de bouton, le banc rougit dès l'entrée.
- Défauts trouvés par le banc et corrigés : (1) traverser le bord haut de la liste cible en arrivant des
  achats la faisait remonter (on lâchait sur N°4 au lieu de N°2) ⇒ défilement seulement si le doigt RESTE
  300 ms dans la zone ; (2) « Annuler » ne rendait pas le prix par N° à l'écran (l'annonce ne revenait pas)
  ⇒ le setter `vinted_buyprice_by_num` est passé au geste.


## Ajout de Julien : le bénéfice et le reçu à portée de main

Capture iPhone : après une liaison, la bulle « ✓ Achat relié · 13,43 € · Ensuite : voir le bénéfice › · × »
recouvrait la liste. « Quand je relie un achat, je veux avoir le bénéfice avec la facture d'achat à portée de main. »

- **Toute liaison** (feuille « Relier un achat » depuis Ventes/Annonces, propositions « Sans achat relié », vente
  proposée, glisser) passe par `confirmerLiaison` : UN geste annulable 5 s (`gesteVrm`, pilule du bas), dont le texte
  est le RÉSULTAT — « Achat relié · Bénéfice +22,57 € » (la règle de la ligne de vente, `beneficeLigneVente` →
  `beneficePaire`, sur l'entrée APRÈS la liaison ; frais pas confirmés ⇒ « au plus » ; prix pas lu ⇒ « — » ; une
  annonce pas vendue : « … au prix affiché ») — et qui offre **« Reçu »** (`ouvrirRecuRelie` : le reçu e-mail de CET
  achat par son n° de transaction, sinon l'attestation VRM) à côté d'**« Annuler »**. La bulle d'accompagnement
  `achat.relier` n'est plus posée. « Déplacer ici » (achat relié ailleurs) se fait dans le MÊME geste (annulé ensemble).
- La pilule gagne un second geste générique (`action` de `creerGestes().lancer`, `data-pilule-autre`).
- Dans le mode glisser, le bas de l'écran est une bande réservée (question, puis pilule) : aucune ligne dessous.
  Ailleurs, la pilule reste en bas au-dessus de la barre (la feuille se ferme, la ligne se met à jour).
- La **ligne de la vente** reliée montre son bénéfice discret à côté du prix au téléphone (`benefSu`, la règle de la
  ligne ; la colonne « Bénéfice » existait déjà à l'ordinateur) ; le reçu reste à un toucher depuis sa fiche (« Reçu »
  de #1199). La feuille du reçu passe au-dessus du mode glisser (z 1500).
- Preuves : `audit-relier-glisser` 48 verts, 18/18 mutations (dont : pilule sans « Reçu », reçu qui n'ouvre rien,
  bénéfice sans les frais, feuille revenue à la bulle, ligne sans bénéfice) ; banc : 390 « Achat relié · Bénéfice au
  plus +31 € au prix affiché » + « Reçu » + rectangles (aucune ligne sous la pilule) ; 1512 vente « au plus +50 € »,
  « Reçu » ouvre le reçu n° 7100001, la ligne de Ventes porte 50 € (`data-benef-ligne`).
- Le point « empreintes de photos » pour relier les achats a été ANNULÉ par Julien (ses photos diffèrent de celles du
  vendeur) : rien n'a été fait.

## ÉTAT À LA REPRISE

- Branche `claude/relier-glisser` poussée ; PR vers `main` après celle de `claude/achats-retour`.
- Pas mesuré sur un vrai iPhone (aucun appareil ici) : le banc joue les évènements tactiles de Chromium.
  Geste de Julien utile : essayer l'appui long sur son iPhone (Safari et web app) et dire si le défilement
  et le soulèvement se comportent bien.
