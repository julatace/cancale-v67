# Audit des parcours métier, de bout en bout — VRM (origin/main f04af748, 1er nov. 2026)

Périmètre : achat → arrivée → N° → stock → mise en ligne → copies Leboncoin/eBay/Vestiaire → offre → vente →
bordereau → emballage → dépôt → versement → compta → retrait des AUTRES plateformes, plus les variantes.
Méthode : lecture du code (app `src/App.jsx` + modules, extension, `api/`), un banc jetable sur les fonctions
pures (`banc-deux-comptes.mjs`, à côté de ce fichier) et les 204 audits du dépôt rejoués
(`audits/_codes.txt`, journaux `audits/*.log`). Rien n'est corrigé ni commité.

Légende : **vérifié** = reproduit au banc ou lu sans ambiguïté dans le code ; **à vérifier** = dépend d'une
donnée réelle (forme d'un statut, usage de Julien) que je n'ai pas pu mesurer.

---

## A. Défauts, du plus grave au moins grave

### A1 — GRAVE · Vestiaire est hors de tout l'anti double vente (vérifié)
- **Scénario** : une paire N°12 en ligne sur Vinted et sur Vestiaire. Elle se vend sur Vestiaire. Rien ne dit
  « à retirer de Vinted » ; et dans l'autre sens une vente Vinted ne signale jamais l'annonce Vestiaire.
- **Preuve** : `chargerRetraitsMulti` (src/App.jsx:46534-46705) ne lit que `lbc_*`, `ebay_listings`,
  `ebay_orders` et Vinted ; `articlesVendusAilleurs` (src/bilanSynchronisation.js:78) ne reçoit donc rien de
  Vestiaire. `numerosDejaVendus` (App.jsx:54616), `doublesVenteLbc` (54239), `doublesVenteEbay` (54661) et
  le serveur `api/_lib/double-vente.js` (eBay + Leboncoin seulement) n'ont aucune entrée Vestiaire.
  `grep -i "retirer de vestiaire|encore en vente sur vestiaire"` : aucun résultat.
- **Aussi** : la vente Vestiaire ne fait pas sortir la paire du Stock (`sortirPartisDuStock`,
  App.jsx:45673-45716 : Vinted, Leboncoin, eBay seulement).
- **Correction** : faire entrer les ventes `vc_ventes` (par la référence/lien Vestiaire, jamais le titre) dans
  `numerosDejaVendus`/`chargerRetraitsMulti` et les annonces `vc_listings` dans la liste « à retirer ».

### A2 — GRAVE · Le CA URSSAF dit « toutes plateformes » mais Vestiaire n'y est pas, et rien ne le dit (vérifié)
- **Scénario** : 3 ventes Vestiaire finalisées en novembre. La carte URSSAF annonce « Calculé sur le CA des
  ventes finalisées en novembre, toutes plateformes » sans elles, sans « au moins », sans nommer le manque.
- **Preuve** : `ventesDeclarables` (App.jsx:6237) et `ventesFaites` (6346) ne prennent que vinted/lbc/ebay ;
  textes App.jsx:35515, 35527, 35683 (« toutes plateformes »), 35216 (plafonds : « ce que tes plateformes
  t'ont versé dans l'année (toutes plateformes) »). Le seul endroit qui le dit est l'écran Vestiaire
  (App.jsx:26030 « Aucun montant Vestiaire n'est montré ni compté (chiffre d'affaires, URSSAF, bénéfice) »).
  C'est exactement « un total partiel qui se présente comme complet » (§5). Même défaut pour « Vendu »
  (Ma journée, Statistiques), le bénéfice et les seuils DAC7/plafond micro.
- **Correction** : tant que le montant Vestiaire n'est pas sûr, compter les ventes Vestiaire finalisées et
  écrire « au moins … · N ventes Vestiaire non comptées (montant pas sûr) » sur chaque total concerné.

### A3 — GRAVE · Même paire sur deux comptes Vinted : aucun « à retirer », ou renumérotation automatique d'une annonce (vérifié au banc ; usage à vérifier)
- **Scénario** : la paire N°12 est publiée sur le compte A et sur le compte B (même carton).
  1. Titres différents, rien vendu → `conflitsDeNumeros` voit deux paires, `doublonsAReattribuer` donne
     **tout seul** un N° neuf à l'annonce B et demande d'écrire ce N° sur « son » carton, qui est le même.
  2. Vendue sur A, B encore en ligne, même titre → aucun conflit, aucune alerte : B reste en vente
     (double vente possible).
  3. Vendue sur A, titres différents → l'annonce B est renumérotée toute seule (vente à poster garde le N°).
  4. « Vendus ailleurs » : ignoré (`v.plateforme !== a.plateforme` exclut Vinted→Vinted, et le N° porté par
     deux fiches sans chaîne `recreeDe` est compté « ambigu » et écarté).
  5. Pire : `numerosDejaVendus` (App.jsx:54631) et `doublesVenteEbay` (54700) lisent « une AUTRE annonce
     Vinted de ce N° en ligne » comme « la paire est revenue » ⇒ la vente sur A ne déclenche **pas** non plus
     « à retirer d'eBay / de Leboncoin », et la paire peut être reproposée à la publication.
- **Preuve** : `banc-deux-comptes.mjs` (fonctions copiées telles quelles de App.jsx:32927 et 32965 et
  bilanSynchronisation.js) : cas 1 et 3 → `réattribués [{"id":"222","ancien":"12"}]`, cas 2 → `conflits []`,
  cas 4 → `{"lignes":[],"ambigus":1}`.
- **À vérifier** : si Julien met réellement la même paire sur deux comptes Vinted (« plusieurs comptes »).
  Si oui, c'est un risque d'expédier une paire déjà partie.
- **Correction** : une relation explicite « même paire, autre compte » (posée par son clic, comme `recreeDe`)
  qui ni ne renumérote, ni ne vaut « revenue », et fait sortir une ligne « vendue sur A — à retirer de B ».

### A4 — GRAVE · Les colis Leboncoin et Vestiaire à poster ne comptent nulle part en dehors de Colis (vérifié)
- **Scénario** : une vente Vestiaire et une vente Leboncoin à poster aujourd'hui, aucune Vinted. Ma journée
  « À envoyer » = 0, la Tournée n'a rien à déposer, le badge de la cloche se tait, le widget iPhone dit 0 (et
  `manque` ne cite qu'eBay), le rappel du soir « Demain : N colis à poster » ne les compte pas. Seul Colis
  (colonne Vestiaire, sous-rangée Leboncoin) les montre. La date limite Vestiaire peut passer sans alerte.
- **Preuve** : publication `vrm_colis_aposter` = `toShip` (Vinted) + `colisEb.aPoster` (App.jsx:44640-44656) ;
  Tournée `aPoster` = Vinted + eBay (47172-47175) ; widget `ship.total = shipTotal + eb.total`
  (api/widget.js, bloc de sortie, `manque: eb ? [] : ['eBay']`) ; `api/ship-reminders.js` ne lit
  `lbc_ventes` que pour le bilan (ligne 186), jamais pour les colis, et aucune ligne `vc_ventes`.
  À l'inverse `cartesColis` ajoute les ventes Vestiaire (App.jsx:45930-45932) ⇒ deux nombres pour une notion
  (Colis ≠ Ma journée ≠ widget).
- **Correction** : ajouter `colisVestiaire(...).aEnvoyer` et les colis Leboncoin à `vrm_colis_aposter`
  (avec leur propre « pas su »), puis le widget et les rappels lisent ce même total.

### A5 — GÊNANT · La notification « double vente » peut mettre en avant la MAUVAISE paire (vérifié par lecture)
- **Scénario** : deux paires à retirer de Leboncoin (N°12 et N°40). La notification parle de N°40 ; l'écran
  s'ouvre et surligne la ligne N°12.
- **Preuve** : la cible cherche `[data-lbc-retirer="40"]` puis, à défaut, `[data-lbc-retirer]`
  (src/cibleNotif.js, `selecteursCible` cas `doublon`). Or l'attribut porte `r.id || r.numero`
  (App.jsx:56051) : pour une annonce reliée par identité c'est l'**identifiant Leboncoin**, pas le N°. Le
  premier sélecteur ne trouve donc jamais rien, le second prend la première ligne (CibleNotif,
  App.jsx:14431, premier élément visible).
- **Correction** : poser un `data-lbc-retirer-num={cleNum(r.numero)}` et le viser ; supprimer le repli
  générique quand un N° est donné (dire « plus en vente ailleurs » à la place).

### A6 — GÊNANT · « Vendus ailleurs » compare les N° sans `cleNum` (vérifié au banc)
- **Scénario** : fiche numérotée à la main « 007 » (le code la garde telle quelle : `corrigerCarton`,
  App.jsx:41731 `const n = /^\d+$/.test(brut) ? brut : cle`), vendue sur Leboncoin (réf « VRM-7 » → `cleNum`
  « 7 »). La liste « Vendus ailleurs · annonces à retirer » ne la trouve pas. Idem « B 125 » contre « B125 ».
- **Preuve** : `articlesVendusAilleurs` (src/bilanSynchronisation.js:84-95) range par
  `trim().toLowerCase()` au lieu de `cleNum` ; banc cas 5 et 6 → `{"lignes":[]}`. Les autres règles
  (doublesVenteLbc/Ebay) utilisent bien `cleNum`. Les lots « 12+15 » ne sont pas découpés non plus.
- **Correction** : utiliser la même `cleNum` (et `numerosDeVente` pour les lots) dans `parNum` et `groupe`.

### A7 — GÊNANT · Le conseil d'offre poussé sur le téléphone vient d'un prix d'achat retrouvé par TITRE (vérifié par lecture)
- **Scénario** : deux paires « Nike Air Max 90 » : l'une a un prix d'achat de 40 €, l'autre n'en a pas
  (achetée 90 €). Une offre à 60 € sur la seconde → push « ✅ Accepte : +20 € net (achat 40 €) ».
- **Preuve** : `findBuyPriceByTitle` (api/email-inbound.js:818-835) filtre d'abord les fiches **qui ont** un
  prix, puis compare les titres : une homonyme sans prix est ignorée au lieu de rendre le cas ambigu ; les
  fiches de paires vendues depuis longtemps comptent aussi. Utilisé ligne 2363 pour le texte de la
  notification. §5 : une proposition peut utiliser la ressemblance, mais ici elle est écrite comme un fait.
- **Correction** : rendre `null` dès que plus d'une fiche porte ce titre (avec ou sans prix), et écrire
  « si c'est la paire achetée X € » plutôt que « Accepte ».

### A8 — GÊNANT · Le widget « Reçu ce mois » passe à « — » au bout de 3 jours sans nouvel argent, même app ouverte (vérifié par lecture)
- **Scénario** : aucun versement entre le 3 et le 7 ; Julien ouvre l'app chaque jour. Le 6, le widget n'affiche
  plus le reçu du mois. Le 1er du mois suivant, tant qu'aucun versement n'arrive, il reste « — ».
- **Preuve** : l'app ne republie `vinted_urssaf_mois` que si le contenu change (App.jsx:40853-40856,
  `memeChose`) ; le widget refuse une ligne de plus de 3 jours ou d'un autre mois (api/widget.js:540-542,
  `RECU_MAX_AGE_MS`). Le commentaire du widget le reconnaît.
- **Correction** : republier `at` (seul) une fois par jour quand la lecture est complète, même sans changement.

### A9 — GÊNANT · « Déclarer perdue » promet des choses que l'app ne fait pas (vérifié par lecture)
- **Preuve** : `markPairLost` (App.jsx:41905-41918) écrit « Son numéro sera libéré » et « La vente reste dans
  ta compta comme perte ». Le N° n'est pas libéré (le pool est append-only, heureusement — §5) et
  `vinted_pairs_lost` n'est lu par aucun calcul de bénéfice : aucune perte n'apparaît. Le récap de vente
  répète « son numéro est libéré » (47890). Un chiffre qu'on ne peut pas vérifier (§2.7).
- **Correction** : dire « elle sort du stock, sa case est vidée, son N° n'est jamais redonné » et retirer la
  phrase sur la perte (ou la compter vraiment).

### A10 — DÉTAIL · Une vente Vinted au prix illisible compte 0 € dans le CA et le « Vendu », sans être dite (vérifié par lecture)
- **Preuve** : `montantCommande` rend `0` quand le prix manque ou ne se lit pas (App.jsx:5697-5703) ;
  `ventesDeclarables` (6262) et `ventesFaites` (6355) l'additionnent sans la ranger dans `ecartees`, alors
  que Leboncoin (« prix inconnu ») et eBay (`montantRecuEbay`) le font. « Rien lu ne vaut pas rien » (§5).
- **Correction** : une variante `montantCommandeOuNull`, et la vente part dans `ecartees` (« prix pas lu »).

### A11 — DÉTAIL · Statistiques « Quand tu vends » : une vente Leboncoin datée à la main tombe à midi (vérifié par lecture)
- **Preuve** : `avecDatesLbc` pose `T12:00:00` (App.jsx:6232) ; `ventesFaites` ne transmet pas `dateSaisie`
  (pas de `heureLue:false`, 6362) ; `quandTuVends` (src/statsVentes.js:90) ne met en « sans heure » que
  minuit pile ⇒ ces ventes gonflent la case « 12 h ».
- **Correction** : `heureLue: !v.dateSaisie` sur la ligne Leboncoin de `ventesFaites`.

### A12 — DÉTAIL · Deux règles « pas une vente » qui ne disent pas la même chose (à vérifier sur les vrais statuts)
- `PAS_UNE_VENTE` (App.jsx:33021, extension background.js:14149) attrape tout `[ée]chou` et
  `transaction_user_status === 'failed'` ; `classifyOrderStatus` (5649) n'attrape que « paiement a échoué »
  et ignore `failed`. Une vente « …a échoué » (autre que le paiement) ou `failed` avec un titre non reconnu
  est **revenue** pour l'anti double vente (la paire est reproposée ailleurs) mais **vendue** pour Ventes,
  « Vendu », Statistiques. De même « Commande non réclamée » sans « Retournée » : `retoursStock.js` y voit un
  retour, `classifyOrderStatus` une vente en cours.
- **Correction** : une seule fonction « vente vivante » utilisée par `classifyOrderStatus` et `venteVivante`.

### A13 — DÉTAIL · Réponse rapide « Oui, l'article est toujours disponible ! » proposée sous une paire vendue (vérifié par lecture)
- Le garde (`offrePartieDuFil`, App.jsx:40540, utilisé 46523) ne joue que s'il y a une **offre** en
  attente. Une simple question sur une annonce vendue (sur Vinted ou ailleurs) propose toujours ce texte en
  premier (`QUICK_REPLIES`, App.jsx:2002). Rien ne part seul (un tap remplit le champ), d'où « détail ».
- **Correction** : masquer les réponses « disponible » dès que l'annonce du fil est prouvée partie
  (`numerosDejaVendus` / vente prouvée), offre ou pas.

### A14 — DÉTAIL · Le widget et les rappels projettent encore `vinted_sales_hidden` (vérifié)
- api/widget.js:303 (`MAIN_WIDGET`), api/ship-reminders.js:172 et 689 la rapatrient sans plus la lire
  (« plus lue nulle part », §3). Égress inutile, aucune conséquence d'affichage.

---

## B. Audits du dépôt rejoués (204, depuis l'arbre `origin/main`)

Rouges (codes dans `audits/_codes.txt`) — aucun ne démontre une régression de comportement ; ce sont des
contrôles d'**orthographe** devenus faux après les refactorisations du 1er novembre (le comportement visé a été
retrouvé dans le code à chaque fois) — à remettre d'aplomb, car un audit rouge en permanence ne protège plus rien :
- `audit-facture-achat`, `audit-recu-achat` : cherchent `indexRecusParTransaction(recusAchat` alors que le code
  filtre d'abord les reçus déliés (App.jsx:38547). Comportement ok.
- `audit-numerotation-lecteurs` : cherche `data-retour-archive="retour"` ; le récap du 1er nov. écrit
  `data-retour-archive={…'oui'}` (App.jsx:47908). La phrase « numéro neuf » existe toujours.
- `audit-offre-annonce-partie` (2) : `vrm-chat-rapides` est désormais rendu par `RapidesConv` ; le garde
  existe (46523). Le second (« point nouveau ») : à relire.
- `audit-offres-email`, `audit-photos-vinted` (`PhotoVc`, App.jsx:25671, `<img>` hors `PhotoVinted` — à
  vérifier : une photo Vestiaire n'est pas une photo Vinted, il faut juste l'ajouter à la liste),
  `audit-politique-hotes` (api-adresse.data.gouv.fr dans CarteRelais.jsx:74, maps.apple.com dans
  Tournee.jsx:140 — hôtes neufs pas déclarés dans la politique/CSP : **à vérifier en production**, la carte
  des relais peut être bloquée par la CSP).
- `audit-secrets` : l'adresse de contact publique (décision du 31 oct.) est vue comme « email personnel
  publié » dans `public/legal/editeur.js:20` et `src/contact.js:16`. Décision assumée ⇒ l'audit doit la permettre.
- `audit-renum-b` : dépassement de 90 s (pas un rouge ; à relancer sans limite).
- `audit-vc-publier` : code de sortie 1 alors que tous ses contrôles affichés sont verts et qu'il n'écrit
  aucun ❌ — sortie anormale (exception ou minuterie après la fin) : à relancer seul pour lire la cause.

Bilan : 194 verts, 9 rouges, 1 dépassement de temps.

---

## C. Parcours vérifiés sans défaut trouvé (lecture)

- Bordereau Vinted : double clic, deux onglets, réponse tardive → un seul job (`BORD_EN_COURS`,
  background.js:11516 ; `jobEnCours` + `envoi` côté app) ; plafond par fenêtre et compte du cookie revérifié
  au tour de file.
- « Déposé » / « Colis fait » / Mode emballage : même geste (`marquerColisFait`, idempotent par
  `isShipDone`), une carte par transaction dans l'emballage (pas de double bascule d'un lot).
- Notifications : `cat_achats` + `vue=achats` mène bien à Achats (App.jsx:60668) ; `plat_ebay`/`agent` →
  Ventes · eBay · À traiter (navigationTache.js) ; cibles par identité seulement.
- Vente annulée / remboursée : sort du CA, du Vendu, de la preuve de vente, et la paire garde sa place au
  stock si elle n'est jamais partie (`porteursNum`, App.jsx:40942).
- eBay hors France : commande d'une autre devise écartée et comptée (`montantRecuEbay`), jamais convertie.
- Numéros : `prochainLibre` part du plus haut du pool + fiches + réservations, jamais d'un trou.
