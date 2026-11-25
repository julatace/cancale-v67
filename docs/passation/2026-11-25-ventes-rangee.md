# 25 nov. 2026 — Ventes : la rangée compacte (`claude/ventes-rangee`)

Julien, capture iPhone de Ventes → « En route 40 », style par défaut : « Regarde c'est atroce, c'est moche, la mise en page
est catastrophique ».

Geste de Julien : **aucun** (rien en base, aucune extension à installer).

---

## 1. Ce que montrait sa capture, et pourquoi

| défaut | cause trouvée |
|---|---|
| vignette VIDE (carré gris) sur chaque vente | La liste des ventes de Vinted (`orders_sold`, `my_orders[].photo`) n'a la photo que d'une vente sur quatre (mesuré, `historique-*` : 772 ventes avec photo, ~2 777 sans). L'ancienne liste de Ventes lisait aussi les autres sources de CETTE vente (`photosVenteVintedCandidates` : l'annonce de SA transaction `txnItem`, la transaction rangée `order.items[0].photos[0]`, le coffre, la fiche N° de CETTE annonce) ; les rangées natives (« À envoyer », « En route » : `orderPhoto(o)` ; « Terminées » : `photosVenteVintedCandidates(o)` sans ses sources) ne lisaient QUE la photo de la commande. Sans photo : `n-vignette-vide`, un carré au dégradé gris. |
| titre coupé (« adidas handball spezial bleu mari… ») | `complements.css` (téléphone) bornait le titre d'une vente à UNE ligne (`-webkit-line-clamp: 1 !important`). |
| logo du transporteur coupé en deux | la ligne « prix · étiquette · logo » était `overflow: hidden; white-space: nowrap` avec 132 px réservés à droite pour « Relier · + prix » posés en absolu : le logo passait sous la réserve et était rogné. |
| « Livré · 3/4 » ET « Livrée » | le sous-titre écrivait l'étape (`texteEtape` : « Livré · 3/4 ») et la ligne suivante l'étiquette (`statutRangee` : « Livrée ») — le même état deux fois. |
| frise géante + « Relier » / « + prix » sur chaque ligne | `Trajet` (piste 22 px + pion camion) en note, et `GestesAchat` (Relier, + prix) en pied de CHAQUE vente sans achat. |

## 2. Ce qui change (aucune règle métier)

- **La photo** (`src/ecrans/Comptabilite.jsx`, `photoVenteParTx`) : une carte « transaction → photo » calculée UNE fois par
  version des sources déjà lues (annonces indexées par identifiant, jamais un parcours de toutes les annonces par vente), par
  IDENTITÉ seulement (§5) ; `photoVenteNatif(o)` = photo de la commande, sinon celle de SES sources. Publiée pour « Terminées »
  (`src/ventes/photosVentesPub.js`, un seul propriétaire ; `VentesToutes` la lit et se redessine quand une photo arrive).
- **La rangée** (`src/natif/ecrans/rangeeVente.jsx`, les 3 onglets au téléphone) : photo 56 · titre 14/19 fort sur deux lignes
  au plus · PRIX 15 fort aligné à droite (chiffres tabulaires) · UNE ligne « logo du site · N° · taille (si le titre ne la dit
  pas) · état · … · logo du transporteur ENTIER (18 px, au bout) ». Chaque morceau garde sa taille ; s'il manque de place la
  ligne passe à la ligne entre deux morceaux, jamais au milieu, jamais rognée.
  - « En route » : UN état = le mot de l'étiquette (`statutRangee`) précédé d'une mini-frise (un trait par étape PROUVÉE) ;
    le lecteur d'écran entend « Livrée · 3/4 » (`vn.etape`).
  - « À envoyer » : pas d'état (c'est l'onglet) ; ce qui reste à savoir : « N° à poser », « sans bordereau », la date limite.
  - « Terminées » : l'état, le compte, la date.
- **L'achat** (Relier, prix d'achat) n'est plus posé sur la rangée. Il n'a de sens que pour une vente SANS achat relié ni prix
  connu (`data-vr-achat="libre"`) : au BALAYAGE de cette rangée seulement (« Prix d'achat » ouvre le champ sous la rangée, qui
  prend la main ; « Relier » ouvre la grille), et dans la fiche de la vente (« Relier à son achat » + le champ « Prix d'achat »).
  Même saisie, même relecture, jamais d'écrasement (§2.5) ; rien n'est relié tout seul (§5). À l'ordinateur, la colonne
  « Achat » du tableau est inchangée.
- **Sans photo** : un repli discret (contour fin, icône effacée), plus un carré gris plein.
- « Terminées » au téléphone : la liste n'est plus une carte dans une carte (décalée de 16 px).
- CSS : `src/natif/ventes-lisibles.css` (étendu, aucun fichier neuf) ; les règles téléphone `.n-vt-rang` de `complements.css`
  retirées. `src/natif/styles-choix*.css` non touchés.
- Hauteur au téléphone (390 px) : **avant** ~110 px (En route, base de banc ; ~260 px de points sur sa capture) et 102–150 px
  (Terminées) ; **après** 76–84 px (En route), 84–104 px (À envoyer, ligne d'état sur deux lignes quand il y a « sans
  bordereau · à vérifier »), 80–100 px (Terminées).

## 3. Preuves

- Banc neuf `scripts/bancs/ventes-rangee.cjs` (base inventée design-passe + titres réalistes, 4 transporteurs lus sur
  l'étiquette, des ventes dont la photo n'est QUE dans leur transaction, d'autres sans photo ; 390 tactile × 3 onglets × clair /
  sombre, 1512 tableau ; `STYLE=` pour un style de Paramètres) — H ≤ 104 px, T titre ≥ 50 % de la largeur et aucun morceau
  rogné, L logo entier, D un seul mot d'état, R pas de Relier / + prix sur la rangée mais au balayage d'une vente sans achat et
  dans sa fiche, P photo de la transaction montrée et repli non plein, O tableau à 1512.
  Sur origin/main : 24 rouges (L, R, P, H). Après : vert. Mutation `MUTATION=logo` (la ligne d'état rognée) ⇒ L rouge.
- `scripts/bancs/ventes-lisibles.cjs` mis à la règle du jour au téléphone (G : au balayage ; P : la vente prend son prix ; L :
  « Relier » du balayage ouvre la grille ; H : 60–104 px). L'ordinateur garde ses contrôles d'avant.
- `scripts/bancs/ventes-tableau.cjs` lit la rangée compacte (`.n-vr-logo`, `[data-vt-prix]`, `.n-vr-mot`) ; « À expédier »
  n'est plus exigé sur chaque rangée d'« À envoyer » (c'est l'onglet ; il était déjà caché au téléphone).
- Bancs de la CI qui touchent Ventes (ventes-ligne-propre, natif-ventes, etats-justes, vente-mail-annonce, ventes-tableau,
  ventes-e2 ×3), lancés comme la CI sur origin/main (53690897e) puis sur la branche, comparés PAR NOM : aucun rouge nouveau ;
  « cibles ≥ 44 » de natif-ventes et ventes-tableau, rouges sur main, passent au vert. Restent rouges des deux côtés :
  etats-justes (A2, J1) et ventes-e2 (V0 : `[data-selecteur-logos]` introuvable, et ce qui en découle).
- Styles : le banc passe aussi avec `STYLE=monochrome` et `STYLE=c3doux` (clair et sombre).
- Cliquets : `audit-stockage-sur` D — une clé d'index de MOINS (Ventes.jsx), aucune ajoutée ; `audit-boutons-natifs` identique.

## 4. Ce qui reste

- La fiche ouverte depuis « Terminées » (fiche ligne générique) ne porte pas encore les gestes de l'achat : ils y sont au
  balayage de la rangée.
