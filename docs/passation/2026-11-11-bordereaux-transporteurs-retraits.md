# 11 nov. 2026 — « Bordereaux à imprimer », transporteurs lus sur l'étiquette, logo Chronopost, retraits manquants

Branche `claude/journee-perso` (demandes de Julien en cours de session, captures iPhone 16 h 37). Poussé à
chaque commit ; pas de PR (consigne du coordinateur) : rien n'est en ligne tant que la branche n'est pas fusionnée.

## Ce que Julien a dit
« Regarde ça c'est inadmissible » (feuille « Bordereaux à imprimer ») ; « tout est moche et les transporteurs
inconnus ce n'est pas possible, tu les vois sur les bordereaux » ; « il y a InPost qui est avec Mondial Relay
comme je t'ai déjà dit » ; « le logo Chronopost est toujours pas bon » ; « je veux que les mails soient
beaucoup mieux analysés : j'ai beaucoup de colis qui ne sont pas dans les retraits ».

## 1. La feuille « Bordereaux à imprimer » (src/App.jsx, lot)
Retiré (ajouté par le lot « parcours / préparation », commits 191215cf et f1001d7a) : la rangée « 1 · N
sélectionné(s) 2 · 0/N article(s) contrôlé(s) 3 · Préparer les PDF » ; le récapitulatif `RecapSelection`
(« N colis sélectionnés », « vinted · 3 compte(s) identifié(s) », pastilles « 7 avec / 0 sans / 0 déjà
imprimé(s) », « Vérifier les N colis ») ; la phrase « Compare le N° et la photo… « Contrôlé » ≠ expédié » ;
la case « Contrôlé » de chaque ligne ; la confirmation « N sur M contrôlés · Préparer quand même les PDF » à
CHAQUE impression ; « Emplacement non vérifié » sur chaque ligne ; « Tout sélectionner » + « Tout décocher » +
« Décocher ne supprime aucun bordereau ».
Reste : « 6 sur 6 · Tout décocher » (UN bouton qui bascule), les groupes par transporteur, une ligne par colis
(N° · titre ; site · compte · date sur UNE ligne ; les drapeaux utiles : sans bordereau, ancienne, déjà
imprimé, PDF pas lu ; l'emplacement seulement s'il est CONNU ; « Sans N° : vérifie avec la photo » en ambre).
Le contexte reste vérifié au lancement (`verifierContexte` : même compte, même N°, même état — sinon rien ne part).
La pilule « Nouvelle version de VRM » se range quand une feuille est ouverte (elle couvrait la liste et le pied).

## 2. Transporteurs : lus sur l'étiquette (api/_lib/transporteur-pdf.js, transporteur-bordereau.js)
Mesuré sur la vraie base (lecture seule, PDF ouverts dans le scratchpad puis effacés) : les étiquettes InPost /
Mondial Relay ne NOMMENT personne en texte (logos en image) ⇒ `pdfLu = aucun`, les anciennes sans n° ⇒
« Transporteur à identifier ». Mais elles impriment leur code-barres en clair : 26 chiffres « 56… » dont les
chiffres 3 à 10 = le n° Mondial Relay de l'e-mail (3 bordereaux sur 3). Règle : UN code de cette forme dans le
PDF ⇒ Mondial Relay et son n° ; zéro ou plusieurs ⇒ rien (jamais deviné). 5 vrais bordereaux sur 5 justes.
**InPost = Mondial Relay** (sa demande) : dans l'e-mail, le PDF et `cleTransporteur` ; les deux noms ensemble
ne font plus « plusieurs ⇒ rien ». Les anciens « aucun » sont relus UNE fois (`REGLE_PDF = 2` dans `pdfVus`),
par le cron, le passage « colis » et l'app (`etiquetteALire`).

## 3. Le logo Chronopost (src/transporteursVisuels.js)
Le pictogramme IMPRIMÉ sur ses bordereaux (relevé sur une vraie étiquette) : un cube en hexagone, couvercle
entrouvert, encre noire sur blanc — à la place du mot « Chrono post » blanc sur bleu.

## 4. Retraits manquants (api/_lib/achat-arrive-relais.js, src/App.jsx)
Mesuré : 41 e-mails Vinted « Commande mise à jour pour … » (colis au point relais), sans code ni n°, tous
retrouvent leur achat par la CONVERSATION. 13 de ces achats sont dits par Vinted « La livraison n'a pas encore
eu lieu - colis déposé en bureau de Poste ou point relais » (action attendue) : ils sont À RETIRER. Sans n° de
suivi dans l'achat, la règle les appariait à un colis Mondial Relay du même point ; ce colis-là RETIRÉ ⇒
l'achat passait « sans doute fini » et sortait des retraits. Désormais un achat que SA commande dit encore au
point relais (`isAtRelayStatus`) ne s'apparie qu'à un témoin encore montré (compté avec lui, une fois) ;
sinon il est à retirer. Les 2 achats d'octobre « au point relais » sans e-mail passent par la lecture des achats.
⚠️ Prouvé par la règle (audit, données inventées), PAS encore regardé dans l'app avec ses vraies données : à
vérifier sur vrm.center après fusion (Colis → À retirer doit gagner ces colis).

## Preuves
- `npm run build` vert. Audits verts : variables, tdz, coherence, identite, icones, secrets, fonctions-api,
  textes-courts, transporteur-pdf (M1–M6, 4 rouges sur le code d'avant), transporteur-anciens,
  transporteurs-parfaits, achat-attend-relais (Q1–Q3, Q1 rouge sur le code d'avant), retrait-preuves,
  colis-frequent (A5 mis à la forme `attendEncore`).
- Bancs : `lot-bordereaux` 17/17 (mis à la nouvelle règle : plus de case ni de confirmation) ;
  `tout-imprimer` 24/26 — les 2 rouges « B groupes de l'écran » existent aussi sur integration-11nov-e seule.
- Déjà rouges ailleurs, pas de ce lot : `audit-politique-hotes` (ClotureAnnee.jsx), `audit-rouge-doublon`
  (styles-sante-donnees.css).
- Capture regardée : la feuille à 390 px (« 6 sur 6 · Tout décocher », cube Chronopost).

## 5. « À retirer » réorganisé (17 h, captures de Julien : « des QR codes, des infos dans tous les sens, on ne comprend rien » ; « enlève la carte, ça sert à rien » ; « le n° de suivi est une clé de la réussite de cette appli »)
- **Plus de carte** des points relais (Colis → À retirer, `avecCarte={false}` ; Achats → filtre « au point relais »).
  À la place : « Itinéraire » au bout de l'adresse de chaque point (Plans sur Apple, Google Maps ailleurs, `lienItineraire`).
- **La ligne d'un colis dit ce qu'il faut au comptoir, sans toucher** : le CODE en gros (ou « Code à venir », « QR »,
  « 2 codes » en ambre), le **n° de suivi complet**, l'échéance (barre). Un colis sans titre d'article a pour titre
  son n° de suivi complet (plus « n°…0010 » au-dessus de « n° 81000010 »). Le titre tient sur deux lignes.
- Retirés de la ligne : la ligne de sources « Vinted · e-mail · message · transporteur · vérifié à… » (passée dans le
  détail ouvert) et le bouton « Code » (le code est écrit ; glisser à gauche copie toujours).
- **Une section « À retirer »** au lieu de « Prêts à retirer » + « Code à venir » (un point = une carte, ses colis
  dedans) ; « À retirer aujourd'hui », « Lieu à confirmer », « À vérifier », « Comptés avec », « En route » inchangés.
- **Le détail ouvert** : sans titre répété ni « Code X · e-mail » (sauf deux codes en désaccord), sans « QR dans
  l'app Mondial Relay · le code suffit », « QR pas reçu… », « Code pas lu — ouvre l'e-mail… » ; le n° de suivi n'y
  est plus répété (le compte reste quand il y en a plusieurs).
- **Règle (suite du §4)** : un achat prouvé en attente choisit son témoin EN PREMIER (sinon une moitié sans commande,
  arrivée plus tôt, lui prenait le colis encore au point et il était compté deux fois — vu au banc achats-retraits).
- Bancs mis à la nouvelle présentation sans affaiblir ce qu'ils gardent (chaque code écrit une fois, chaque colis une
  fois, « J'ai retiré » partout) : `colis-colonnes`, `colis-retirer-propre`, `colis-fiables`, `lot-bordereaux`,
  `tout-imprimer` ; `retirer-carte-delai` et `retrait-autre-ville` : les contrôles de la carte sont tus et remplacés par
  « plus de carte » (rouge sur le code d'avant). `achats-retraits` 84/84.
- Pas fait : les cartes « Point relais changé » (encadré ambre) sont restées telles quelles.
