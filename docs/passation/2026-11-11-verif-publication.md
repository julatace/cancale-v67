# 11 nov. — Prévenir AVANT de publier, sans jamais bloquer (lot verif-publication, extension 5.353.0)

Branche `claude/verif-publication`. Aucune PR, aucun merge dans `main` (consigne du lot).
Aucune requête Vinted de plus, aucune écriture en base réelle. Toutes les données des
bancs sont inventées.

## Ce qui existait déjà (3 et 5 nov.)

`src/verifAnnonce.js` (`problemesAnnonce`) + la feuille « N points à vérifier » de
`verifierAvantPublication` (App.jsx), appelée par Leboncoin, eBay (deux chemins),
Vestiaire, Republier et la feuille « Actions » d'Annonces (brouillons compris) :
moins de 3 photos, taille absente (Sneakers), prix sous le prix d'achat SAISI, titre
trop long, marque, catégorie, et pour Vinted titre/prix/description/couleur/état.
« Publier quand même » existait déjà. Ces règles n'ont pas changé.

⚠️ La mission demandait « aucune photo / une seule » ; l'existant dit dès **moins de 3**
(choix du 3 nov., `PHOTOS_MIN = 3`, audit `audit-verif-annonce`). Laissé tel quel :
l'alerte se coupe maintenant d'un clic si elle gêne. À trancher par Julien si 2 photos
ne doivent plus rien dire.

## Ce qui est ajouté

### 1. « N° absent de la fin de la description » (`numeroAJuger`)
- Jugé SEULEMENT s'il numérote lui-même : réglage « Je numérote moi-même » allumé
  (`vrm_numero_ecrit.actif`), sinon l'**habitude prouvée** (`habitudeNumeroEcrit`) :
  au moins 5 descriptions lues sur ses annonces Vinted, dont 4 sur 5 portent un N° à
  la fin. Moins ⇒ `null` = pas su ⇒ rien n'est dit (jamais un `false` inventé).
  L'habitude est publiée par l'écran Annonces (`poserLecturesEcrit`) ; tant qu'il
  n'a pas été ouvert, seuls ceux qui ont le réglage sont jugés.
- Et seulement si la description qui partira est SUE (son texte, ou sa lecture
  rangée `numEcritDesc`). Pas sue ⇒ rien.
- Respecte « Où est ton numéro ? » (`ou`) : description décochée ⇒ pas jugée ; le bon
  N° dans le titre coché, ou dans la référence native (SKU eBay « VRM-12 ») suffit.
- Textes : « N°12 absent de la fin de la description », « La description dit N°13,
  pas N°12 », « Deux N° différents dans la description », « Aucun N° à la fin de la
  description ». Lecture : la règle de `src/numeroEcrit.js` (aucune nouvelle lecture).
- Leboncoin : VRM écrit déjà « Réf. VRM-n » dans la description ⇒ en pratique rien
  n'est dit là (c'est juste).

### 2. « Déjà en ligne » (même identité, jamais un titre)
- `dejaEnLigne === true` seulement ; `null` = pas su ⇒ rien.
- Annonces / brouillons / Republier : une AUTRE annonce de `annBase` (la lecture qui
  fait foi, `<enligne-regle>`) du MÊME compte porte le même N° (fiche ou N° écrit lu)
  ⇒ « Déjà en ligne sur ce compte Vinted ».
- Leboncoin : `dejaEnLigneLbc` — une annonce `etat === 'enligne'` (lecture complète
  < 24 h, `lireLbcEnVente`) au même N° (identité `numeroLbcIdentite`).
- eBay : `dejaEnLigneEbay` — un SKU « VRM-{n} » dans une ligne `ebay_listings` lue il
  y a moins de 24 h ; une ligne illisible ou plus vieille ⇒ pas su. Lu une fois par
  paire choisie (`dejaEbayRef`), la vérification reste synchrone.
- Vestiaire : NON jugé (fraîcheur et complétude de `vc_listings` non mesurées ⇒ pas su).

### 3. Chaque alerte justifiée et désactivable
- `POURQUOI_ALERTE` : une phrase sous la ligne (N°, déjà en ligne, prix, photos) ;
  les autres ont déjà leur geste.
- « Ne plus me le dire » (une fois par sorte d'alerte) ⇒ `vrm_verif_coupees`
  `{ codes, at }`, **synchronisé** (SYNC_KEYS), écrit sur SON clic seulement.
  `verifierAvantPublication` retire les codes coupés : rien à dire ⇒ la publication
  part sans feuille, comme avant. Un code inconnu n'est jamais coupé.
- Paramètres → Tes numéros de rangement → « Alertes coupées avant de publier »
  (n'apparaît que s'il y en a) : « Rallumer » par alerte.
- Le titre de la feuille suit ce qui reste ; « Publier quand même » toujours là.
- Chaque texte d'alerte ≤ 12 mots (audit A12) ; aucun prix conseillé (A13).

### 4. Sur vinted.fr : l'encart du formulaire de dépôt (extension 5.353.0)
- `vinted-capture.js` : sur `/items/new`, lit la description et le prix TAPÉS
  (`textarea[name=description]`/`#description`, `input[name=price]`/`#price` ; deux
  zones de texte sans nom ⇒ on ne devine pas). Envoie au fond `verifDepot`.
- `background.js` : `donneesVerifDepot(uid)` lit la base VRM seulement (main :
  réglage, fiches, `vinted_buyprice_by_num`, coupures ; `harvest_{uid}_listings`,
  `_enligne`, suppressions) — cache 2 min, AUCUNE requête Vinted (audit B12) ;
  `alertesDepotVinted` rend : N° absent/ambigu (s'il numérote lui-même), « N°12 déjà
  en ligne sur ce compte » (règle `<enligne-regle>`, pas su ⇒ rien), « Prix 50 € sous
  ton prix d'achat 60 € » (prix d'achat saisi pour CE N° seulement).
- Encart dans une ombre fermée, sous le bouton ; « VRM · N points à vérifier (tu peux
  publier) » ; « Ne plus me le dire » coupe dans CE navigateur (`vrmVerifCoupees`) ;
  les coupures de l'app sont respectées. Rien n'est cliqué, aucun envoi intercepté.
- **Photos non jugées sur vinted.fr** : la forme du formulaire n'a pas été mesurée.
- ⚠️ Les sélecteurs du formulaire (`name="description"`, `name="price"`) ne sont PAS
  mesurés sur le vrai vinted.fr : si Vinted les nomme autrement, l'encart se tait
  (pas su ⇒ rien), il ne se trompe pas. À vérifier par Julien en ouvrant « Vendre ».
- Corrigé au passage : avec « Je numérote moi-même », la pastille « VRM n'a pas pu
  réserver de numéro » s'affichait à côté du bouton alors que la 5.324 promettait
  « rien » (`raison: 'ecrit'` ⇒ aucune pastille).
- Capacité `verifdepot: '5.353.0'` (EXT_CAPACITES, audit-coherence), CODE_VERSION,
  manifeste, EXT_ATTENDUE, lbc-inject/lbc-relay, zips Chrome + Orion refabriqués.

## Preuves
- `node scripts/audit-verif-publication.cjs` : vert ; `--prouve` 14/14 mutations
  rouges (9 sur la règle de l'app, 5 sur le fond de l'extension exécuté dans
  `_fond-vm.cjs`) ; sur `origin/main` (copie `git archive`) : 19 échecs.
- `audit-verif-annonce` vert + 11/11 mutations (import de `numeroEcrit.js` rendu
  absolu dans son chargeur).
- Audits demandés verts : variables, tdz, coherence (avec l'historique complet :
  `git fetch --deepen`), identite, icones, textes-courts, fonctions-api, secrets,
  extension-zip, vendeur-generaliste ; plus numero-ecrit, numero-etiquette.
- Bancs 390 px et 1512 px, captures regardées :
  - `scripts/bancs/verif-publication.cjs` : **était rouge sur `origin/main`** avant le
    lot (navigation par tâches, `id=in.(…)` non servi, profil « Je vends » par défaut
    rendant taille/marque facultatives) — réparé (plateformes affichées, lignes
    Leboncoin vides, « Sneakers ») ; ajout G : « Ne plus me le dire » (44 px, aucun
    fond), le pourquoi, la ligne disparaît, le titre suit, la coupure est enregistrée
    et ne revient pas. Le banc entre sans compte VRM : l'écriture réseau n'est pas
    observable, la copie de l'appareil et l'appartenance à SYNC_KEYS le sont.
  - `scripts/bancs/verif-depot-vinted.cjs` (nouveau) : page de dépôt inventée, VRAI
    vinted-capture.js, VRAIE règle du fond ; A–F verts aux deux tailles ; 10 rouges
    sur `origin/main`.

## Ce qui reste / à trancher
- 2 photos : alerte gardée (seuil 3 d'origine) — à confirmer par Julien.
- Vestiaire « déjà en ligne » : pas su tant que la lecture Vestiaire n'a pas de règle
  de fraîcheur.
- Mesurer le formulaire vinted.fr réel (noms des champs, zone photos).
