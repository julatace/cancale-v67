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
