# 11 nov. — Lot DJ3 : les colis à leur place, le logo du bordereau, les codes des e-mails

Branche `claude/colis-a-leur-place` (depuis `origin/main`). Pas de PR : la session principale intègre.

Julien, mot pour mot (11 nov.) :
- « Je pense que tu peux regrouper les colis à expédier dans les ventes, les colis à retirer dans achats, ça
  évite les répétitions et les erreurs. En veillant à bien tout garder, simplement déplacer pour pas avoir 2
  fois la même chose. »
- « Les logos des transporteurs ne sont pas tous bons, je veux ceux qui sont sur les bordereaux ; tu mets
  InPost mais InPost appartient à Mondial Relay. »
- « C'est super pour les mails avec les codes de retrait, je veux que tu t'en serves, de ce qu'il y a dans les
  mails que l'app reçoit, tout doit être parfait. »

Extension : **rien changé** (aucune version). Fonctions `api/` : aucune ajoutée (12/12).

## 1. Colis n'est plus un onglet : « À expédier » dans Ventes, « À retirer » dans Achats

Les MÊMES composants, déplacés, aucune copie : `Comptabilite only="bordereaux"` reçoit `colisDans`
(`'ventes'` | `'achats'`) et se rend en SECTION de tête (`rendreColisSection`, App.jsx) :

| avant (onglet Colis) | après |
|---|---|
| barre du bas : Journée · Annonces · Ventes · **Colis** · Plus ; colonne : … Messages · **Colis** | Journée · Annonces · Ventes · **Achats** · Plus ; colonne : … Messages · **Achats** (Achats quitte « Plus → Gérer ») |
| pastille « à poster » sur Colis (barre), « à retirer » nulle part dans la barre | « à poster » sur **Ventes**, « à retirer » sur **Achats** (mêmes publications) ; pastille de l'icône de l'app inchangée |
| Colis : titre « Colis », barre Scanner · Tout imprimer · … | Ventes : intertitre **« À expédier »** + la même barre ; Achats : **« À retirer »** + Scanner (mode retrait) |
| Segmenté À envoyer · Envoyés · À retirer | Ventes : À envoyer · Envoyés ; Achats : la liste « À retirer » seule |
| grande carte « Colis » (à poster · à imprimer · déposés · à retirer) / carte « À retirer » (d'ici demain · avec code · à vérifier, par ville) | la carte de Ventes porte déjà « à poster », celle d'Achats « à retirer » : la grande carte n'est pas redite ; ses autres cases restent en une ligne discrète (`data-colis-resume` : « 2 à imprimer · 1 déposé aujourd'hui » / « 1 d'ici demain · 2 avec code · 1 à vérifier »), zéro ⇒ rien |
| filtre des sites propre à Colis (pastille Leboncoin ⇒ `LeboncoinColis`) | le filtre de Ventes / Achats, un seul ; Ventes · Leboncoin ⇒ `LeboncoinColis` en section « À expédier » |
| Colis → À retirer : outils montés dessous (`retraitsOutils` : à confirmer, à vérifier, suivi Vinted, n° à la main, e-mails reçus, argent à vérifier, point relais changé) | les mêmes, sous la liste « À retirer » d'Achats |
| Ventes : « À envoyer : Colis › » et le bandeau « N colis à expédier · le plus pressé » | retirés (la section est en tête du même écran : §7) |
| Achats : « Voir les colis à retirer → Colis », « Scanner » en tête, « Argent à vérifier » et « Point relais changé » (vue En route) | retirés d'Achats-liste : dits UNE fois, par la section « À retirer » ; `ExtEnRetard` une fois (la liste) |
| hors réseau : la photo des colis sur `cat_bord` | aussi sur Ventes et Achats (`ONGLETS_COLIS_HL`) |
| `CaptureColis` (instantané de l'écran Colis) | plus d'écran à photographier : retiré (Ventes garde le sien) |

### Inventaire des fonctions de Colis — avant / après (rien perdu, rien deux fois)

À envoyer : Tout imprimer (lot par transporteur) · Scanner un bordereau · « … » Emballer / Tout générer ·
conseil « Un envoi presse » (`ChiffreConseil`) · ComptesMuetsColis · notes « je lis… » · infos SMS Vestiaire ·
Préparer mes colis · Je dépose (mode dépôt, hors ligne au relais) · Emballer · « Ne poste pas » (eBay) ·
1 à envoyer en priorité · Préparer la tournée de dépôt · cartes (bordereau, photo du carton, glisser « Colis
fait », limite, N° en double, numéros à écrire) · Envoyés (tri, transporteurs, Suivre) ⇒ **Ventes · À expédier**.
À retirer : Scanner au relais · Mode relais · « Suivi vérifié il y a » · bloc Mondial Relay (comptes, Ajouter un
QR) · colis sur une adresse sans compte · points relais (carte, villes, épingles), chaque colis (code vérifié,
« 2 codes », QR, En grand, Suivre, J'ai retiré, barre de délai, sources) · infos SMS Pickup · Sortis de « à
retirer » · achats Vestiaire en route · outils (à confirmer, à vérifier, suivi Vinted, n° à la main, e-mails
reçus, argent à vérifier, point relais changé) ⇒ **Achats · À retirer**. Colis Leboncoin ⇒ **Ventes · Leboncoin**.

### Les anciens chemins (src/colisPlace.js, règle pure, lue par `setTab` et `poserCible`)

`placeDesColis` : `cat_bord` / `cat_expedition` ⇒ Ventes (« Toutes », ou le site demandé : `leboncoin`,
`site:ebay`…), onglet À envoyer ou Envoyés (cible « partis ») ; « retirer » demandé (sous-onglet, onglet choisi
juste avant par À trancher / ⌘K / annulation, cible `retrait` ou colonne « À retirer ») ⇒ Achats ; `retraits`,
`cat_achats` ⇒ Achats. La reprise (`reprise0.tab = cat_bord`) aussi. `ecranDeCible` : une cible de retrait posée
pour « Ventes » attend Achats. La page défile jusqu'à la section (`#colis-a-expedier` / `#colis-a-retirer`).
Liens d'e-mails (`?tab=cat_bord&cible=retrait…`), notifications, widgets, Ma journée, À trancher (écrans
renommés Ventes / Achats), carte des chiffres (« À retirer » ⇒ `retraits`), raccourci « g c » (« Colis à
expédier (Ventes) » ; « g h » = Achats) : tous passent par là.

### Les publieurs (`vrm_colis_aposter`, `vrm_colis_retirer`)

Inchangés : ils vivent dans `Comptabilite` (même code, même règle), montés comme avant par Ma journée — le banc
le vérifie en n'ouvrant QUE Ma journée (P : 2 et 2 publiés).

### §4.11 — écrans montés, avant / après (origin/main ⇒ branche)

`tab===` distincts 28 ⇒ 27 (seul `cat_bord` part : il n'est plus un écran) ; `GardeEcran` 43 ⇒ 44
(− `cat_bord:leboncoin`, `cat_bord:retirer` ; + `ventes:colis`, `achats:colis`, `achats:retirer`) ;
`<Comptabilite` 5 ⇒ 7 (− l'instance des outils sous Colis ; + section Ventes, section Achats, ses outils) ;
`<LeboncoinColis` 1 ⇒ 1 ; `<ColonneRetirer`, `<AlerteRelaisChange`, `<InfosSms`, `<ExtEnRetard` 1 ⇒ 1 ;
`<SelecteurSites` 3 ⇒ 2 (celui de Colis · Leboncoin : le filtre de Ventes le remplace) ; `<CaptureColis` 1 ⇒ 0.

Styles : les 146 règles `styles-premium.css` visant `.vrm-main[data-ecran="cat_bord"]` visent aussi
`.vrm-main .vrm-colis-section` (la section garde l'apparence de Colis).

## 2. Le logo du bordereau (InPost = Mondial Relay)

Mesure (Supabase, lecture seule, projections) : ses e-mails signent « L’équipe **Mondial Relay by InPost** » ;
`vrm_bord_transporteurs.pdf` (étiquettes lues au cron) : **19 « inpost »**, 3 « mondialrelay », 6 + 21
chronopost, 3 colissimo ; bilan : 8 « plusieurs » (Mondial Relay + InPost ⇒ rien posé), 20 « aucun ». C'est
de là que venait le logo InPost : l'étiquette Vinted d'un envoi Mondial Relay écrit « InPost » en texte.
Règle : en France, « InPost » est le réseau Mondial Relay ⇒ clé `mondialrelay`, donc le logo Mondial Relay :
`cleTransporteur` (relit aussi une clé `inpost` rangée avant : les 19 ventes changent sans rien réécrire),
`carrierKey` (App), `transporteursNommes` (e-mail du bordereau et PDF : « Mondial Relay » + « InPost » = un
seul), la route des e-mails. Chronopost, Colissimo, Vinted Go… inchangés. Dessin « La Poste » ajouté à la
planche (la règle « la poste ⇒ Colissimo » ne change pas). Les mots-symboles (Chronopost, Colissimo, Relais
Colis, Shop2Shop, GLS, Colis Privé, InPost) restent ceux du 10 nov. : aucun tracé officiel joignable hors réseau.

## 3. Les codes des e-mails

Mesure (lecture seule, 11 nov.) : 139 e-mails « disponible » rangés, 99 avec un code ; 74 de moins de 21 jours,
29 encore dans leur délai, 25 sans e-mail « retiré » après eux. Pour ces 25 : **20 sont dits retirés par le
transporteur** (lecture `transp_*` « retire ») — bien hors d'« à retirer » ; **5 sont « disponibles »**
chez le transporteur, et les 5 sont **affichés** avec leur code (publication de sa production du 10 nov. :
7 à retirer, 5 avec code, 2 à vérifier). 4 e-mails Vinted « Arrivé au point relais » ont un code sans n° de
suivi : reliés par leur conversation (une identité, règle du 10 nov.), du 4-5 nov., finis depuis.
**Codes lus dans un e-mail et pas affichés pour un colis encore au point : 0.** Le déplacement les garde
tous : chaque colis porte son code par identité (n° de suivi, commande, code), jugé dans le banc
(`data-code-retrait` de chaque colis = celui de SON e-mail).

## Preuves (§6)

| contrôle | branche | origin/main | mutations |
|---|---|---|---|
| banc `colis-a-leur-place` (390 tactile + 1512, clair + sombre : navigation, `?tab=cat_bord` ⇒ Ventes « À expédier » en tête, `?tab=retraits` ⇒ Achats « À retirer », codes des e-mails, notification de retrait ⇒ Achats, publications depuis Ma journée seule, une fois par écran, débordement, erreurs) | 108 verts | 50 rouges | voir ci-dessous |
| `audit-logos-bordereaux` (exécute `cleTransporteur`, `transporteurDeVente`, `transporteursNommes`, `decisionTexteBordereau`, `carrierKey` extraite, la route) | 37 verts | 11 rouges | 4/4 rouges (cleTransporteur, bordereau, carrierKey, route) |
| banc `logos-bordereaux` (planche : 14 dessins à 22/44/110 px, ce que l'app montre pour chaque texte de bordereau, aucune requête) | 16 verts | 4 rouges (« InPost » ⇒ logo InPost) | — |

Captures regardées : Ventes 390 clair (À expédier en tête, barre, À envoyer · Envoyés, Préparer, Je dépose),
Achats 390 sombre (À retirer, Scanner, Mode relais, points et logos), planche des logos 1512 sombre.

Audits relancés : `variables`, `tdz`, `coherence`, `identite`, `icones`, `raccourcis-clavier`, tous les
audits colis / retraits / transporteurs (48) — verts, sauf, identiques sur origin/main : `sms-colis` (16),
`colis-envoi` (1, « la barre ne dépend pas de l'onglet »). `audit-relais-change` §E mis à jour (l'alerte est
rendue une fois sur Achats).

22 bancs qui touchaient l'onglet « À retirer » de Colis (`[data-colis-onglet-choix="retirer"]`) vont
désormais à Achats par `vrm:aller` (`?tab=retraits`) et attendent `[data-colis-section="achats"]`.

## Ce qui reste

- L'extension, dans une conversation qui écrit « Mondial Relay by InPost », voit deux noms et ne pose aucun
  transporteur (`background.js`, `TRANSP`) : à aligner au prochain lot extension (pas de version montée ici).
- Les 8 étiquettes « plusieurs » déjà rangées ne sont pas relues (le cron ne relit pas une décision prise).
- Bancs qui lisent encore le nombre de l'onglet « À retirer » (`data-colis-onglet-n`) : à porter sur
  `vrm_colis_retirer` / la pastille d'Achats s'ils rougissent.
- Julien : regarder Ventes (« À expédier ») et Achats (« À retirer »). Aucun geste technique.

---

# Reprise (11 nov., 2e session) — vérification, puis les nouvelles demandes de Julien

L'agent précédent s'est arrêté (limite d'usage). Repris, vérifié, `origin/main` amené par un vrai merge
(conflit CLAUDE.md §9 : les deux côtés gardés ; deux lignes les plus anciennes déplacées telles quelles
dans `historique-divers.md`, CLAUDE.md < 59 000 octets).

## A. Vérification de ce qui était fait

- **Rien de perdu** : chaque fonction de l'ancien Colis existe (inventaire ci-dessus) ; le banc le juge :
  Ventes porte « Tout imprimer », « Je dépose », Scanner (envoi), Préparer, À envoyer · Envoyés ; Achats
  porte la liste « À retirer », Scanner (retrait), Mode relais, les outils (à confirmer, à vérifier, e-mails,
  argent à vérifier, point relais changé) ; hors ligne : `ONGLETS_COLIS_HL` contient Ventes et Achats.
- **Rien en double** : une section de colis par écran, « Scanner » et « Mode relais » une fois, aucun colis à
  envoyer dans Achats, aucun colis à retirer dans Ventes (banc, 4 vues).
- **§4.11 (origin/main ⇒ branche)** : `tab===` distincts 28 ⇒ 27 ; `<GardeEcran` 45 ⇒ 46 ; `<Comptabilite` 5 ⇒ 7 ;
  `<SelecteurSites` 3 ⇒ 2 ; `<CaptureColis` 1 ⇒ 0 ; `<LeboncoinColis`, `<ModeDepot` (2), `<ColonneRetirer` inchangés.
- **Codes des e-mails dans Achats** : chaque colis porte le code de SON e-mail (banc : 012345 / 654321 par n°).

## B. Colis DISPARAÎT de la navigation (précision de Julien)

Barre, colonne, « Plus » : plus d'entrée Colis (déjà fait). En plus : **« g c » retiré** (« g v » = Ventes,
« À expédier » en tête ; « g h » = Achats) ; **`?tab=colis`** (le nom de l'ancien onglet) ⇒ Ventes « À expédier »,
`&sub=retirer` / `onglet=retirer` / `section=retirer` ⇒ Achats (jamais un écran vide, banc L) ; écrans gardés :
`journee · achats · ventes` (Achats prend la place de Colis). Ma journée, À trancher, recherche, notifications,
widgets passent tous par `setTab` ⇒ `placeDesColis`.

## C. BUG « Tout imprimer » : une paire DÉJÀ DÉPOSÉE restait proposée

Mesuré (lecture seule) : **134 bordereaux e-mail sur 237 n'ont aucun n° de suivi** ; certaines ventes n'ont
même **aucun e-mail de bordereau** (étiquette captée par l'extension seule, ex. une vente « Bordereau envoyé au
vendeur » dont le n° n'existe que sur l'étiquette). Le n° est écrit sur l'étiquette, lu au cron
(`vrm_bord_transporteurs.pdf[tx].s`). La règle du départ (`api/_lib/depart-vente.js`) ne lisait QUE le n° de
l'e-mail : l'e-mail de dépôt de CE n° (« Preuve de dépôt », « entre de bonnes mains ») ne prouvait rien ;
la vente, figée « à expédier » chez Vinted, restait dans « Tout imprimer » et dans le compteur. Et les
étiquettes Mondial Relay rangées « inpost » (19) ou « plusieurs » (8, Mondial Relay + InPost) n'avaient
**aucun n°** (la règle d'avant ne savait pas lire le n° d'une clé « inpost »).
Correction (identité seule, jamais une ressemblance) :
- `suiviDuBord` (n° de l'e-mail, sinon celui de SON étiquette) et `bordsAvecEtiquettes` (une étiquette captée
  sans e-mail devient le bordereau de sa transaction) dans la règle unique ⇒ l'app, le widget, les rappels et
  le bilan (`lirePreuvesDepart` lit la ligne légère, `etiquettes`) ; n° partagé par deux ventes ⇒ rien ;
- `expeditions()` / `toShip` sortent la vente prouvée même sans bordereau e-mail (« Colis fait » garde sa carte) ;
- **pas su ⇒ dit** : déjà imprimé et AUCUN n° connu ⇒ la ligne reste, décochée, « déposé ? à vérifier » ;
- le cron **relit une fois** les étiquettes « inpost » et « plusieurs » (`decisionARelire`, marque `g: 2`).
Preuves : `audit-a-envoyer-preuves` (+5 contrôles, widget/rappels/bilan avec une étiquette sans e-mail ; 7 rouges
sur origin/main ; 15/15 mutations attrapées, dont 3 ancres qui ne s'appliquaient plus — rendues uniques) ;
`audit-transporteur-anciens` T9 (3 rouges sur origin/main) ; banc : la vente déposée n'est ni une carte ni
dans « Tout imprimer (2) » (rouge sur origin/main : 3). Le contrôle « e-mail du 7 nov. » du même audit
rougissait seul depuis le 9 nov. (horloge du jour) : date du bordereau fixée, même règle.

## D. « Tout imprimer » refait, en trois temps

Une feuille (`SheetShell` : portail, `FermeAuRetour`), un bouton « Tout imprimer (N) » en tête d'« À expédier » :
1. **Choisir** — « Ce qui part » (photo, titre entier, N°, logo du bordereau, date limite ; cochés) ; « À vérifier »
   à part, décochés (déjà imprimé, vendue il y a plus de 14 j, déposé ? à vérifier, sans bordereau) ; eBay grisé.
   **Aperçu** : une page A4 par colis coché (l'étiquette du transporteur, le tampon N° + titre en bas).
2. **Imprimer (N)** — UN PDF tamponné (le moteur d'avant, inchangé ; « Placer le tampon » reste en lien) ;
   plus de question « Préparer quand même » ni de case « Contrôlé » (l'aperçu A4 est le contrôle — tranché).
3. **« C'est imprimé ? »** — le lien du PDF ; « Oui, imprimé » ⇒ prêts à déposer (`vinted_bords_printed`,
   geste annulable « Annuler ») ; « Pas encore » revient au choix ; puis **« Je dépose »** ouvre le mode dépôt.
Gestes (N colis, tous bons) : **avant** Tout imprimer · Imprimer · « Préparer quand même » (+ N cases « Contrôlé »
pour l'éviter) puis fermer et chercher « Je dépose » (≈ 5) ; **après** Tout imprimer · Imprimer · Oui · Je dépose (4,
dans la même feuille). Rien de perdu : impression d'un seul colis (carte), réimpression (« À vérifier », cochable),
`confirmerNumerosAVerifier` (dans le moteur), échecs repris (« Réessayer »). Animations : entrée 240 ms
(opacité + 6 px), coupées en mouvement réduit ; cibles 44 px (lignes 74 px mesurées).

## E. Logos des bordereaux (photos de VRAIS bordereaux de Julien)

Réseau refusé (Wikimedia : 403 du proxy) ⇒ redessinés d'après les photos (planche de comparaison dans le
scratchpad, jamais dans le dépôt : photos avec noms et adresses réels) :
- **Mondial Relay** (= InPost) : carré framboise, point blanc, « r » blanc finissant sur un carré rose pâle ;
- **Chronopost** : le cube (hexagone encre, arête blanche gauche jusqu'au centre puis vers le bas, courte à
  droite) ; **Shop2Shop** ⇒ le même cube, nom « Chronopost Shop2Shop » ; « InPost » s'appelle Mondial Relay.
`audit-logos-bordereaux` : 41 verts (14 rouges sur origin/main).

## F. Titres entiers

Le titre d'un colis (cartes « À expédier », rangées « À retirer », feuille « Tout imprimer ») passe à la ligne,
**sans aucune coupe** (tranché : un vrai titre de 75 signes prend 4 lignes à côté des gestes à 390 px ; le
couper à 3 redonnait « … »). Règle posée DANS la couche `vrm-premium` (hors couche, un `!important` perdait —
mesuré au banc). Banc : scrollWidth/scrollHeight/ellipsis sur le rendu, 390 et 1512.

## Preuves de cette session

| contrôle | branche | origin/main |
|---|---|---|
| banc `colis-a-leur-place` (390 tactile + 1512, clair + sombre ; + déposée, titres, parcours complet, `?tab=colis`) | **184 verts** | 22 rouges / 37 (une vue) |
| `audit-a-envoyer-preuves` | vert, 15/15 mutations | 7 rouges |
| `audit-transporteur-anciens` | 34 verts | 3 rouges (T9) |
| `audit-logos-bordereaux` | 41 verts | 14 rouges |
| `audit-raccourcis-clavier` (+ `--prouve`) | vert | — |
| audits communs (variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets) | verts | — |

Bancs voisins (branche, après merge) : `selection-bordereaux` 54 conformes ; `lot-bordereaux` 17 conformes ;
`tout-imprimer` 24/26 (les 2 rouges « groupes de l'écran » : `data-groupe-transp` n'existe plus nulle part, rouges
identiques sur origin/main) ; `colis-retirer-propre` 129 verts ; `retraits-irreprochables` 26 verts ;
`logos-bordereaux` 16 verts ; `achats-retraits` 76 verts, 8 rouges = 2 contrôles × 4 vues (« Peut-être en double · 9 »
rend 3, « à vérifier » 0/3), identiques sur origin/main — logique des retraits, lot « retraits-fiables ».
Portés honnêtement (même règle, nouvelle cible) : `lot-bordereaux`, `tout-imprimer`, `selection-bordereaux` (plus de
case « Contrôlé » : l'aperçu A4 la remplace, jugé), `achats-retraits` (pastille d'Achats = publication ; section en
tête au lieu du lien « → Colis »), `colis-retirer-propre` (« une ligne » ⇒ « en entier »), `ecrans-gardes` (Achats
gardé à la place de Colis), `audit-plateformes-logo`, `audit-raccourcis-clavier`, `audit-garde-ecrans`,
`audit-reprise-ecran`. « Tout sélectionner / Tout décocher » restent dans la feuille (liens).

Rouges identiques sur origin/main (pas de ce lot) : `audit-violet` (3, FedEx/Relais Colis), `audit-garde-ecrans`
(Capture*), `audit-reprise-ecran` (balayage du bord), `audit-colis-envoi` (1), `audit-achats-export`,
`audit-facture-achat`, `audit-donnees-ecrans`, `audit-journee-hors-ligne` ; banc `ecrans-gardes` : 1 défaut
(lectures de la coque push_journal/relais_ext), identique sur origin/main.

Captures regardées : Ventes 390 clair et 1512 clair (À expédier en tête, « Tout imprimer (2) »), Achats 1512
sombre (logos framboise et cube), feuille « Tout imprimer » 390 clair et 1512 sombre, étape 3 390 sombre.
Remarque vue (pas de ce lot) : sur la carte d'un colis, le bouton « Relier » déborde du bas de la carte à 1512.

## Ce qui reste

- L'extension écrit encore « InPost » ⇒ aucun transporteur dans une conversation « Mondial Relay by InPost »
  (`background.js`) : au prochain lot extension.
- Un dépôt dont l'e-mail n'a AUCUN n° (mesuré : un « Preuve de dépôt » Chronopost sans n°) ne peut rien prouver
  (identité absente) : la ligne dit « déposé ? à vérifier » si elle a déjà été imprimée.
- Julien : regarder « Tout imprimer » sur son iPhone ; aucun geste technique.
