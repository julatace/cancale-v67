# 15 nov. 2026 — Ventes et Achats « Verre dépoli » : les maquettes validées, à l'identique

Branche `claude/refonte-ventes` (depuis `origin/claude/project-review-nsk5su`). Pas de PR. CLAUDE.md et l'extension
ne sont pas touchés. Julien, sur les planches `ventes.png` et `achats.png` (scratchpad `maquettes-verre/`) :
**« tout est parfait »**. Les sources exactes des maquettes (`kit.cjs`, `e-ventes.cjs`, `e-achats.cjs`, `style.cjs`)
ont été reprises valeur par valeur dans `src/design/ventes-verre.css` (couche `vrm-verre`, importée APRÈS
`studio-verre.css`), traduites dans les jetons du verre (`--sv-*`) pour le jour et la nuit.

## 0. Réparé en arrivant
La base `claude/project-review-nsk5su` (1a10d345) ne se construisait plus : la fusion des cinq langues
(`src/i18n/langues/{fr,en,es,it,de}.js`) avait laissé deux `export default {` (étagères × republier/même-photo).
Réparé à l'identique dans les cinq (commit 0610ecbf) — **les autres chantiers partis de cette base ont le même
défaut** tant qu'ils ne l'ont pas repris.

## 1. Ce qui est fait (écran par écran)

### Ventes · À expédier (390)
- **Segment en verre fumé** `À expédier · En route · Toutes` (`SegmentVentes`, flou sur ce seul élément), les
  nombres de toujours (`vrm_colis_aposter` en ambre si un envoi presse, le nombre des envoyés). Les deux premiers
  gardent `data-colis-onglet-choix` (bancs, coque). **« Toutes »** = `ongletColis === 'toutes'` : les colis se
  replient (`[data-vv-toutes]`), le segment reste, la liste de toutes les ventes est dessous.
- **Le grand chiffre posé sur le fond** (56/700, encre claire) + « colis à envoyer · bordereaux prêts · cochés pour
  l'impression » ; l'ambre « N avant demain » de la règle `avantDemainColis`. Mêmes `data-sb-*` que la tête d'avant.
  Scanner et « … » restent deux ronds fumés à droite.
- **La liste en UN verre** : chaque colis porte sa **case** (une vraie `input type=checkbox`, 44 px au doigt, son
  toucher n'ouvre pas la fiche), la photo 52, la **plaque N°**, le **site** et le **compte** (toujours), le titre,
  « T38 · avant le 17 nov. · dans 2 j » (la taille LUE `size_title`, jamais tirée du titre ; l'échéance de la même
  limite `e.lim` ; ambre « avant demain »), la **place dans le Stock** « Étagère A · r1 c3 », le **montant** à l'encre
  et le **transporteur** lu. Au téléphone, une grille (case · photo · texte · montant) : l'échéance et la place
  passent sous le montant, rien de coupé.
- **« Tous cochés par défaut »** (choix de Julien) = **la règle du lot** (`cochesParDefaut`, src/lotSelection.js) :
  chaque colis dont le bordereau est là et pas encore imprimé (ni vendu il y a plus de 14 j). Un bordereau déjà
  imprimé reste décoché d'office — le recocher est SON geste (on ne réimprime jamais seul). Sans bordereau, la case
  est grisée.
- **La place** : `emplacementDe(ouDansMeubles(num))` — par le N° (`cleNum`), la règle du Stock en étagères ; pas
  rangée ⇒ rien (jamais devinée). L'ancien repère du garage reste quand le Stock en étagères n'a rien.
- **Rangée « Format · Classique · A4 ›»** au pied du verre (le même `setChoixPapier`, `data-impr-format`).
- **Le plein « Imprimer les N bordereaux »** en barre sous la liste : N = les cochés (`resumeLot(L, coches)`).
  Rien touché ⇒ le geste d'avant à l'identique (`imprimerLot()` : le PDF préparé d'avance part dans CE toucher) ;
  une case changée ⇒ `imprimerLot(sa sélection)`. Mêmes `data-imprimer-prets`, `data-impr-lot`, `ChiffreConseil`
  (accompagnement). « Choisir, réimprimer » (`ouvrirLot`, `data-lot-ouvrir`) dessous.
- Les tuiles-filtres (Avant demain, transporteurs) et « À faire » (Préparer mes colis, Je dépose, la tournée)
  passent **derrière « … »** (maquette : rien entre le chiffre et la liste) ; un filtre posé reste dit.

### Ventes · En route
Chaque colis parti dans son verre : photo 48, plaque, site, compte, titre · taille, « 80 € pour toi » (Vinted : le
prix lu, Vinted ne retire rien au vendeur ; autre site ⇒ rien dit), **les quatre étapes** Déposé · En transit ·
Livré · Validé (`etapesRoute(lues)` : `depose`, `enroute` = `bougeLu`, `livre` = `livreeLue`, `valide` =
`finalisee` — ajouté aux `lues` de `listeEnvoyes`, preuves de `preuvesFriseDe`). Une vente finalisée sort de la
liste des envoyés (règle d'avant) : « Validé » ne se voit que tant qu'elle y est. « Litiges et retours » dessous.

### La fiche d'une vente
Rendue DANS la fiche de la paire ouverte depuis la rangée (`DansFiche place="contexte" seulementFiche`) — la fiche de
la paire elle-même appartient à `claude/ecrans-verre-2`, je n'y ai rien changé : site + compte · « acheteur nina.k »
(le pseudo LU `user_login`), **Vendu / Pour toi** (« 0 € de frais » : Vinted), **les six étapes** Vendue (date, heure)
· Bordereau prêt (transporteur · n°) · **À déposer** (ambre, « avant le 19 nov. ») · En route · Livrée · Versement
(`etapesFicheVente`, de la frise `friseVente`), la **place** « Étagère A / rangée 5 · case 3 » et **« Je l'ai sortie »**
(`sortirPartisDuStock` : la case se libère, la pile descend, le N° reste ; dit par un message). « Imprimer le
bordereau » est le geste d'avant, dans « Actions ».

### Ventes à l'ordinateur (1512)
Le tableau de la maquette dans le même verre : en-têtes Paire · Date limite · Où dans le stock · Transport · Montant,
une rangée par colis (`.vv-cols`, mêmes valeurs que le téléphone), la case, la rangée Format, le plein (360 px) et
« Choisir, réimprimer » à côté.

### Achats
- **À retirer** : la tête devient « À retirer · N » (section, plus d'affiche), Scanner à droite. Sur chaque colis,
  « Code de retrait » au-dessus du code en **28/750, espacé** (plus une plaque), et un rond « code en grand ».
- **La feuille « Montre ce code au comptoir »** (`CodeComptoir`, src/ventes/AchatsVerre.jsx) : claire, un chiffre par
  case (44 × 62), « Monte la luminosité au maximum », le point relais (nom, adresse, transporteur, échéance), la paire
  attendue, **« Je l'ai retiré »** (le même `retirer(x)`), Itinéraire (`lienItineraire`), Copier le code. Échap ou le
  voile ferment.
- **À renvoyer** : la carte d'Achats (pas celle, compacte, de Ma journée) montre les étapes Retour accepté · Bordereau
  prêt · À déposer (ambre) · En route · Remboursé (`etapesRetour`, de l'étape PROUVÉE de src/retoursAchat.js).

### Achats à l'ordinateur (maquettes `ordi/vues/achats-1512.png` et `achats-1280.png`, validées ensuite)
Au-dessus de 1 100 px : la colonne « À retirer » à gauche (380–440 px), le reste d'Achats à droite (grille sur
`.vrm-tache[data-tache="achats"]`) ; le code de chaque colis **un chiffre par case** (44 × 62, 34/750 ; le texte du code
est inchangé : `<i class="va-c">` par caractère dans `.vrm-rpf-code-gros`) ; la rangée d'un colis passe sur deux étages
(texte et code, puis « J'ai retiré » / le code en grand). Le RAIL est celui de `claude/refonte-journee` (fusionné, pas refait).

### La fiche d'une vente ouverte depuis la liste (le récapitulatif — capture de Julien, « 62 €, Bordereau prêt »)
- « Imprimer le bordereau » à l'**encre** (`[data-bouton-bord="pdf"]`, plus le bleu de l'accent) ;
- « L'argent » : un titre de section (17/700) aligné sur ses lignes ;
- bénéfice pas su : « — · prix d'achat à saisir », **sans le point bleu seul** ;
- « Emballage · non saisi » discret (il ne bloque rien) ;
- « Saisir le prix d'achat · ou relier un achat » sur une rangée (un geste) ;
- **l'achat PROPOSÉ** (règle de liaison `src/liaisonAchat.js`, `origin/claude/achats-liaison` fusionnée) juste sous le plein :
  photo, titre, « commandé / retiré le … · payé 70 € », pourquoi (« même marque · « terminator » · même taille 36 · … »),
  **« Relier · 70 € »** (la règle de prix du reçu `propositionSuggestion`, SON toucher, `relierAchatVente`) et « Autre achat »
  (le sélecteur sans ce candidat). Pas de proposition ⇒ rien de plus (la ligne « Prix d'achat » porte le geste). Les achats
  sont lus aussi sur Ventes (`curSub === 'ventes'`) pour que la proposition existe. Aucun « à dater », aucune date coupée.
- « Transporteur toujours nommé » : la règle est le chantier `claude/transporteur-connu` (pas touchée ici).

## 2. Ce qui n'est PAS fait (écarts avec les maquettes, dits)
- **« À vérifier · Tout est bon / Un problème » (Achats)** : aucune source dans l'app pour la date limite de
  vérification d'un achat livré (« Vérifie-la avant le 16 nov. · 13 h ») : la construire serait l'inventer (§5).
  À faire quand une lecture la donne (détail de transaction Vinted).
- **Ordinateur : la fiche à droite en permanence** : au clic, la fiche de la paire s'ouvre en panneau centré (son
  dessin appartient à `claude/ecrans-verre-2`). Filtres « sites + Compte : tous » en tête : le filtre des sites reste
  celui de la coque (« Tous · V »), commun à Annonces/Achats.
- **Achats ordinateur** : le tableau « Tous les achats en cours » (État · Article · Vendeur · Prix · Date · Détail), les
  chiffres de tête (« 2 à retirer · 1 à vérifier · 1 à renvoyer ») et le plein « Imprimer le bordereau du retour » : la liste
  des achats de droite est celle d'avant (le composant des achats n'a pas été réécrit dans ce lot).
- **Achats** : le segment « Annonces · Stock · Achats », le regroupement PAR POINT RELAIS (une carte par point, ses
  colis dessous — CarteRelais) et la ligne « 1 sans QR » sont ceux d'avant ; la maquette montre une carte par colis.
- La coque (date, « Ventes », « ? », trois ronds, « Tous · V ») n'est pas de ce chantier.
- La sous-ligne du grand chiffre passe sur deux lignes à 390 (les deux ronds Scanner · « … » prennent la place).
- La fiche de la paire redit le prix en grand au-dessus de « Vendu / Pour toi » (en-tête de la fiche, pas de ce lot).

## 3. Les preuves
- `scripts/bancs/ventes-verre.cjs` (NOUVEAU, 64 verts : 390 tactile et 1512, clair et sombre ; base inventée : deux
  comptes, trois colis à envoyer, une étagère, trois ventes parties, un colis au relais) : S segment · H grand chiffre
  = publication · **K cases cochées d'office** · **E place lue du Stock par le N°** · P un plein, en barre sous la
  liste, décocher ⇒ N − 1 sans ouvrir la fiche · L 1re rangée ≤ 50 %, rien ne déborde, AA sur le fond réel · O tableau
  1512 · F fiche (étapes, Vendu, place, « Je l'ai sortie ») · R étapes prouvées · T « Toutes » · A code lisible +
  feuille au comptoir. **Rouge sur l'arbre de départ** (0610ecbf) : 13 rouges dont K (`119:o,110:o,103:o`) et E
  (`null`).
- `scripts/audit-ventes-verre.cjs` (21 verts) : les règles pures ; **mutations** — sélection d'office vidée ⇒ 4
  rouges ; place devinée ⇒ 1 rouge.
- `scripts/bancs/studio-ventes.cjs` réécrit sur la RÈGLE de la maquette (dit ici, §6) : le chiffre est une affiche
  ≥ 48 (56 dans la maquette, plus ≥ 80), le plein est la barre (plus le rond d'encre 72), les tuiles-filtres se
  jugent après « … », les rangées à quatre lignes ≤ 112 px au téléphone, le contraste se juge sur le BLEU du verre
  (sa fonction venait du studio bleu clair : sur l'arbre de départ il était déjà rouge, 3 rouges).
- Résultats (dist construit après les fusions de `origin/claude/project-review-nsk5su`, `origin/claude/refonte-journee`
  — le rail commun — et `origin/claude/achats-liaison`) : **ventes-verre 70 verts · studio-ventes 96 verts · garde-ecrans
  vert** ; passe précédente (même code Ventes/Achats) : impression-simple 57 conformes, tout-imprimer 28, achats-retirer-visible
  54, retours-renvoyer vert, retours-suivi vert, vestiaire-ventes 68, accompagnement vert ; verre 677 ✅ · 3 ❌ (deux « Lecture
  en cours… » de Toutes les ventes, corrigés ensuite ici et sur la base ; « Choisis un e-mail » d'E-mails, pas de ce lot).
- Rouges hérités, pas de ce lot : `audit-traduction` (clés `sortir.*` de refonte-journee : variables `{e}` absentes des
  traductions) et `audit-quoi-de-neuf` (deux lignes de refonte-journee trop longues, « la carte en haut de Ma journée »).
- Piège de fusion : refonte-journee importe aussi un `emplacementDe` (src/paireASortir.js) ⇒ celui de src/ventesVerre.js est
  importé sous le nom `emplacementVente`.
