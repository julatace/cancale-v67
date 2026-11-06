# Le mode inventaire du Stock — 6 novembre 2026 (branche `v36-inventaire`)

Demande de Julien (file de la vague 1) : il passe devant ses cartons et dit à VRM quels
N° sont physiquement là ; VRM répond ce qui **MANQUE** (attendu en stock, pas vu), ce qui
est **EN TROP** (vu, mais VRM ne l'attend pas : plus en annonce, jamais numéroté,
archive « B »), et ce qui est **VENDU MAIS ENCORE RANGÉ** (à sortir pour l'envoi).

Rien de `vinted-sync-extension/` ni de `public/` n'a été touché. Aucune migration.

## Où

- **Stock → « Inventaire »** : un bouton sur la ligne du titre du Stock (slot `right` de
  `ScreenHead`, l'île flottante sur ordinateur). Il ouvre une feuille (`SheetShell`,
  `FermeAuRetour` compris).
- **Ma journée → « Inventaire en cours »** quand un inventaire est commencé et pas
  terminé (carte neutre `data-job="inventaire-en-cours"`, « N N° vus — reprends là où tu
  t'es arrêté ») : « Voir » ouvre le Stock directement sur l'inventaire
  (`DEMANDE_STOCK_INVENTAIRE`, consommée une fois, valable 2 min).

## Les fichiers

| fichier | rôle |
|---|---|
| `src/inventaire.js` | la règle PURE : l'attendu indexé, le jugement d'un N° vu, la session (saisir, annuler, terminer, reprendre), la fusion de deux appareils, l'écriture lire-fusionner-réécrire sur `rev`, le bilan |
| `src/InventaireStock.jsx` | l'écran (saisie, retour immédiat, case par case, bilan) — aucune règle recalculée |
| `src/styles-inventaire.css` | son dessin (jetons de la coque, cibles 44 px et plus) |
| `src/App.jsx` | `StockMeubles` fabrique l'attendu depuis SES lectures et monte l'écran ; `lireLigneInventaire` / `ecrireLigneInventaire` ; `useInventaireEnCours` (Ma journée) ; publication `vrm_num_doublons` |
| `scripts/audit-inventaire.cjs` | l'audit (61 contrôles, 16 mutations) |
| `scripts/bancs/inventaire.cjs` | le banc de rendu (390 tactile, 1512 souris, clair, sombre) |

## Les règles (et pourquoi)

### L'attendu vient du Stock, une seule source
`StockMeubles` calculait déjà tout ce qu'il faut ; l'inventaire le reçoit **tel quel**
(`elInventaire` dans App.jsx), jamais recopié :
- `aa.articles` — les annonces actuelles (`annoncesActuelles`, la règle unique « en
  ligne » : en ligne, à confirmer, masquées par Vinted, eBay, Leboncoin, Vestiaire, une
  fois par paire, réunies par identité) ;
- `aa.manque` — les lectures qui manquent, NOMMÉES ;
- `vrm_stock_vendus` — les N° prouvés vendus (propriétaire : Annonces) ; **jamais publié ⇒
  `null`** (pas su), jamais « aucune vente » ;
- `vinted_nums_physiques` — pour dire d'une vendue si son colis est encore à envoyer ;
- `vrm_stock_garder` + `vrm_stock_garde_hors_ligne` — les paires qu'IL a dites « encore là » ;
- `jugeable` — la même question que « Plus en ligne » : toutes les lectures qui pourraient
  porter ce N° ont-elles répondu ?
- le pool (`vinted_used_numeros`), les fiches, les N° de ventes et de Vestiaire — pour dire
  « jamais donné » ; `archiveNumeros()` pour dire « ancien numéro (archive) ».
- **Nouveau, publié** : `vrm_num_doublons` (clé locale, recalculable, comme
  `vrm_stock_vendus`) = les N° de `conflitsNum` (`conflitsDeNumeros`, propriétaire :
  Comptabilite). Pas publié si les ventes ou les annonces ne sont pas lues, ou lues en
  partie (la dernière valeur reste).

### Le jugement d'un N° vu (`jugerSaisie`)
Dans l'ordre (le même que `classerRangees` du Stock) :
1. pas un N° (règle `NUM_OK` de l'app) ⇒ **illisible**, rien n'est compté ;
2. prouvé vendu ⇒ **vendu — à sortir** (ou « colis parti selon VRM : vérifie » si
   `vinted_nums_physiques` ne le porte plus) ;
3. une annonce actuelle (ou gardée « encore là ») ⇒ **attendu** ;
4. ventes pas publiées, rien lu, ou une lecture qui pourrait le porter manque ⇒ **pas su**
   (jamais « en trop ») ;
5. sinon ⇒ **en trop** : « ancien numéro (archive) », « jamais donné par VRM » ou « plus en
   annonce nulle part ».

L'identité est le **N° seul** : `cleNum` de l'app (« 007 » = « 7 », « b125 » = « B125 »,
« B125 » ≠ « 125 »). Jamais le titre, la marque, la taille.

### Le bilan (`bilanInventaire`)
- **Manque** : chaque paire attendue dont AUCUN N° n'a été vu (une paire sous deux N°,
  même photo, est satisfaite par l'un ou l'autre). **Pas su ≠ manque** : un compte dont
  la lecture a raté n'a aucune paire attendue (il est nommé : « Pas lu : X — ses paires ne
  sont pas comptées ») ; une annonce « à confirmer » (lecture de plus de 24 h) pas vue va
  dans une phrase à part (« repasse sur Vinted avec ce compte »), jamais dans « Manquent » ;
  rien lu du tout ⇒ « — » et la raison. Une vendue pas vue n'est pas « manque » (elle part) :
  si elle est encore à envoyer, une phrase dit « déjà emballée ? ».
- **En trop**, **Vendues encore rangées**, **Pas su** : les N° vus, par jugement.
- **Deux paires sous un même N°** (rouge) : le conflit connu (`vrm_num_doublons`) ou deux
  cartons qu'il dit porter le même N° (« C'est un 2ᵉ carton N°x », proposé quand il tape un
  N° déjà compté ; sinon « Déjà compté », rien de plus).
- **Pas dans leur case** (case par case) : vue dans une case, notée dans une autre.

### Les gestes du bilan
« Fiche » (la fiche du N°, `vrm:fiche-paire`), « Voir la case » (le Stock défile jusqu'à
elle), « Je l'ai sortie » pour une vendue rangée (**le geste du Stock**, `sortir` : la case
se libère, le N° reste pris). « Reprendre cet inventaire », « Nouvel inventaire » (le
précédent est gardé, les 3 derniers).

### AUCUN numéro n'est changé (§5)
L'inventaire n'écrit que SA ligne. L'audit (I7) interdit dans `src/inventaire.js` et
`src/InventaireStock.jsx` toute écriture de fiche, de pool, de case, tout `save(`.

## La saisie — « N° + Entrée » vit ICI et nulle part ailleurs

⚠️ La saisie « N° + Entrée » a été **retirée** de Ventes, Colis, Annonces, Leboncoin et eBay
le 29 oct. (§3). **Ici, c'est le geste même de l'inventaire**, et il reste confiné à cet
écran (le formulaire `onSubmit` de `InventaireStock`). Ne pas le recopier ailleurs.

- Pavé numérique (`inputmode="numeric"`), gros chiffres ; le pavé de l'iPhone n'a pas de
  touche Entrée : le grand bouton **OK** à côté du champ fait la même chose, sous le pouce.
- « ABC » bascule sur le clavier texte pour un N° à lettres (B125), « 123 » revient.
- Retour immédiat, en grand : **vert « Attendu »**, **ambre « En trop » / « Vendu — à
  sortir »**, **rouge seulement « deux paires sous un même N° »**, neutre « Pas su » ;
  la phrase dit pourquoi (titre, site, « masquée par Vinted », raison de l'en trop…).
- « Annuler N°x » retire la dernière saisie (une annulation est une pierre tombale : elle
  tient aussi quand un autre appareil fusionne).
- Le micro du navigateur (`MicDictee`, gratuit, §2.9) si l'API existe (Chrome, Android ; pas
  Safari iPhone : le bouton n'apparaît pas) : « numéro 125 », « B 125 », « cent vingt-cinq »
  passent par `requeteDeLaVoix` (src/rechercheVocale.js) ; autre chose ⇒ « Pas un N° ».
- **Case par case** (s'il a des meubles) : « Tout le stock | Case par case » ; en case par
  case, ‹ case › et « Notées ici : N°12 ✓, N°40 » ; chaque saisie porte sa case.

### ⚠️ Décision de couleur — le VERT
§7 : une seule couleur d'accent, rare. La demande de CE geste dit « vert attendu » : c'est
une confirmation d'un coup d'œil devant les cartons, qui ne demande aucun geste. Le vert
existe donc **seulement dans `styles-inventaire.css`** (`--vrm-inv-vu` : #248A3D en clair,
4,6:1 sur blanc ; #30D158 en sombre), sur le retour « Attendu » et le point des lignes
attendues. Ne pas le réutiliser ailleurs sans sa demande.

## La ligne `vrm_inventaire` — l'inventaire survit à la fermeture

```
{ rev, courant: Session | null, anciens: [Session] (≤ 3) }
Session = { id, debut, finAt, reprisAt, n, saisies: { [sid]: { k, s, at, c?, d? } }, annulees: { [sid]: at } }
```
- Écrite par **lire-fusionner-réécrire en comparer-et-échanger sur `data.rev`**
  (`enregistrerInventaire`, le motif de `ecrireLuNotifs`) : POST si elle n'existe pas (409 ⇒
  relire), sinon PATCH gardé par `data->>rev=eq.N` (0 ligne rendue ⇒ conflit ⇒ relire,
  refusionner, 3 essais). **Une lecture ratée n'écrit RIEN.**
- Fusion : union des saisies par `sid`, union des annulations, la fin et la reprise les
  plus récentes gagnent ; deux sessions différentes : la plus récente est la courante,
  l'autre va dans `anciens` (jamais jetée).
- Une copie sur l'appareil (`vrm_inventaire_local_{owner}`) tient la saisie en attendant
  la ligne : une écriture ratée garde tout ici (« Pas encore enregistré dans le nuage :
  N saisies gardées sur cet appareil »), renvoyé au geste suivant. Ce n'est PAS une
  migration ni un drapeau : un tampon, la vérité est la ligne.
- Ma journée lit des scalaires projetés (`data->courant->n`, `debut`, `finAt`,
  `reprisAt`, `->>id`), jamais la ligne entière.

## Les preuves

### Audit `node scripts/audit-inventaire.cjs` — 61/61 verts
Exécute la vraie règle sur un attendu fabriqué par la **vraie** `annoncesActuelles`
(trois comptes Vinted : un frais, un vieux de 3 jours, un en panne ; eBay ; gardée ; vendue
encore lue en ligne ; archive B125 en ligne ; conflit sur N°2) :
- I1 attendu (en ligne, masquée, eBay, gardée), vendu (à envoyer / parti), en trop (plus en
  ligne, jamais donné, archive), illisible ; le bilan et ses trois listes ;
- I2 « 007 » = « 7 », « 0001 » = « 1 », « b125 » = « B125 », « B 125 » = « B125 »,
  **« 125 » ≠ « B125 »** ;
- I3 le compte en panne : sa N°30 jamais « manque », vue ⇒ « pas su », le compte NOMMÉ ;
  « à confirmer » pas vue ⇒ pas su ; ventes jamais publiées ⇒ pas su ; rien lu ⇒ aucun manque ;
- I4 **50 paires au même titre** = 50 attendues, « 12 » ne désigne que la N°12, le titre
  tapé est illisible, 49 manquent ;
- I5 le rouge : conflit connu et « 2ᵉ carton » seulement ;
- I6 annuler / terminer / reprendre, fusion de deux appareils, **lecture KO ⇒ zéro
  écriture**, conflit de `rev` ⇒ relu et réuni (la saisie de l'autre appareil ET la mienne),
  création rev 1 ;
- I7 App.jsx : l'attendu = `aa.articles`/`aa.manque`/`jugeable`/`vrm_stock_vendus`, la
  ligne en comparer-et-échanger, aucun N° écrit, « N° + Entrée » dans l'inventaire, les
  deux entrées (Stock, Ma journée), `vrm_num_doublons` publié APRÈS `conflitsNum` (TDZ).

**Mutations** (`--prouve`) : **16/16 attrapées** — clé brute (« 007 »), lettre ignorée
(B125 = 125), vendue jugée attendue, pas su dit en trop, ventes nulles = aucune, « à
confirmer » ⇒ manque, vendue ⇒ manque, **réunion par le titre**, gardée oubliée, conflit
oublié, 2ᵉ carton oublié, annulée comptée, fusion qui écrase, lecture KO qui écrit, conflit
de `rev` pris pour un succès, reprise ignorée.

**Arbre d'avant** (`git archive` du commit de départ `477adf56`, audit copié dedans, lancé
depuis cet arbre) : rouge (« src/inventaire.js absent »). Avec la seule règle recopiée dans
l'arbre d'avant : **12 rouges** (tout I7 : l'app ne la branchait nulle part).

### Banc `scripts/bancs/inventaire.cjs`
Voir la fin de ce fichier (résultats et captures regardées).

### Audits demandés
`npm run build` vert ; `audit-identite`, `audit-coherence`, `audit-rouge-doublon`,
`audit-conflits-numeros`, `audit-tdz` verts ; `audit-stock-annonces` 53/53, `audit-stock-2d`
49/49.

## Ce qui n'est pas fait (et pourquoi)

- Pas d'inventaire « d'un seul meuble » : le bilan porte sur tout le stock (case par case
  ne fait qu'étiqueter les saisies et dire « pas dans leur case »). À faire seulement s'il
  le demande.
- Pas de vibration au retour (iPhone ne la permet pas dans le navigateur).
- Les gestes « marquer sortie » d'une paire EN TROP (plus en annonce) ne sont pas proposés
  dans le bilan : c'est « Je l'ai retirée » / « Elle est encore là » du Stock (« Plus en
  ligne ») qui les porte, pour les paires rangées.

## Geste de Julien

Stock → **Inventaire** → Commencer, puis taper les N° de ses cartons ; « Terminer » à la fin.
