# 15 nov. — Les rouges connus d'`origin/main` : défaut de l'app ou contrôle périmé ?

Branche `claude/rouges-connus` (partie de `origin/claude/project-review-nsk5su`, puis fusion de
`origin/claude/stock-etageres`, `origin/claude/parametres` et `origin/main` — vrais `git merge`). Pas de PR,
CLAUDE.md et l'extension non touchés.

Méthode : chaque rouge relancé SEUL, sa capture regardée ; s'il dit un vrai défaut, **l'app est corrigée** ;
s'il fige un comportement retiré exprès, **le contrôle est réécrit sur la règle d'aujourd'hui**, avec la
décision citée — jamais affaibli : la règle reste jugée, et rougit par mutation ou sur le code d'avant.
Machine très chargée tout du long (charge 20 → 75, disque à 98 % un moment) : un « Page crashed »,
« Target closed » ou délai dépassé est relancé avant de conclure.

## Le tableau

| contrôle | cause | défaut app / contrôle périmé | ce qui a changé | preuve |
|---|---|---|---|---|
| `audit-safari` | 3 regex à lookbehind arrivées APRÈS l'audit (`recherchePhrase` 14 nov., `notif-redaction` 15 nov., `accompagnement` 14 nov.) : Safari < 16.4 refuse de lire TOUT le paquet ; un `AbortSignal.timeout` gardé à la main ; 4 `navigator.share` testés au rendu mais pas au point d'appel | **défaut app** (grave : écran « L'application n'a pas pu démarrer » sur iOS 15–16.3) | `recherchePhrase` : motifs à branches essayées dans l'ordre, la branche « début de mot » testée sur le caractère d'avant (même sémantique) ; `notif-redaction` : découpe par marqueur, prefixe capturé ; `phraseTechnique` : `(?:^|[^\d.,])` ; `signalDelai(30000)` ; partage testé au point d'appel | rouge avant (3) → vert (21/21 avec `--prouve`) ; même comportement prouvé : 2 202 phrases (0 différence, mutation « début ignoré » ⇒ 275), 30 000 textes notif/technique (0 différence) |
| `audit-extension-5340` P1 | extraction `scalairesVente(e)` ; la 5.374 (13 nov., `2026-11-13-vestiaire-vente-orion.md`) a fait `scalairesVente(e, source)` + `dateLue`/`dateVenteDe` | **contrôle périmé** (extraction) | extraction des nouvelles pièces ; mutation « un seul jour » visait l'ancienne forme UTC (jourParis depuis le 11 nov.) ; « rouge sur origin/main » ne pouvait plus l'être (le lot y est) ⇒ arbre d'avant le lot `f3ef0e5b^` | 29/29 ; 19/19 mutations rouges ; arbre d'avant : 18 rouges |
| `audit-plateformes-logo` D10 | l'entrée « Publier ailleurs » n'est plus la carte `<EntreePublierAilleurs>` mais le « + » de la barre (`data-pa-entree` + `vrm:publier-ailleurs` avec son site), refonte des sites du 14 nov. (a04a8355, `2026-11-14-refonte-plateformes-reglages.md`) | **contrôle périmé** | D10 juge : sur chaque site une entrée qui ouvre « Publier ailleurs » SUR CE site + l'écouteur qui accepte le site | 63/63 ; 3 mutations neuves rouges (`lbc-entree-sans-site`, `vc-entree-retiree`, `ecoute-sans-site`) |
| banc `vestiaire-bout-en-bout` B, C | 8 nov. (`2026-11-08-navigation-plateformes.md`) : un site se montre s'il est CHOISI ou relié ; colonne par tâches (plus de `plat_*`) | **contrôle périmé** | B1 Vestiaire choisi : filtre + « pas encore lu » ; B2 ni choisi ni relié : ni filtre ni écran, vue montrée ; colonne sans `plat_*` ; C : Vestiaire choisi | 31 rouges → vert |
| banc `vestiaire-bout-en-bout` E | la case « À envoyer » de la grille Studio de Ma journée (14 nov.) ne posait plus `data-vestiaire`/`data-leboncoin` (seul `data-ebay` remis le 14) ; le mois est la carte `CarteStatsApp` (`data-carte-*`) | **défaut app** (attribut machine perdu) + contrôle périmé (le mois) | `attrsCase` porte `data-leboncoin`/`data-vestiaire` ; E lit `data-carte-chiffre="vendu"` | rouge avant (`vc:null`) → vert |
| banc `vestiaire-parite` A | `studio-paires.css` recadrait (`cover`) la photo Vestiaire que Julien voulait ENTIÈRE (2 nov.) et que la refonte du 14 nov. gardait « entière sur blanc » | **défaut app** | `.vrm-pf-photo-vc img { object-fit: contain }` ; la proportion 4/5 (carte de 300 px) devient « dans la case carrée de la rangée dense » | rouge avant (`cover`) → vert |
| banc `vestiaire-parite` B | « À expédier » écarté par `src/libelles.js` (8 nov., `2026-11-08-clarte.md`) ; le transporteur est une MARQUE, plus un nom écrit (10 nov., `2026-11-09-transporteurs-parfaits.md`) | **contrôle périmé** | mot lu dans `src/libelles.js` + étape `data-vc-vente-etape` ; « une marque, le nom jamais deux fois » | vert |
| banc `vestiaire-parite` D, E | gestes d'une rangée dans LA fiche ouverte au toucher (Studio 15 nov., `studio-ventes.css`, `DansFiche`) ; aperçu du tampon : 22 s à 1512 sous charge 25 | **contrôle périmé** | ouvrir la fiche, puis Imprimer / Déposé ; attendre l'ÉTAT du placeur (60 s), jamais une durée | 68/68 |
| (vu sur la capture) fiche « Sans titre » | `FichePaire` : paire lue sans titre ⇒ « Sans titre » alors que la ligne touchée en a un | **défaut app** | le titre de la ligne, comme sa photo | capture |
| banc `vestiaire-fiches` | montant sans centimes nuls (5 nov., `montant()`) ; fraîcheur en puces SOUS la liste (14 nov.) | **contrôle périmé** | prix jugé `99 €` + `data-*` ; « lu il y a 2 h » une seule fois sur l'écran ; V1 : la règle d'état de `origin/main` (ventes Vestiaire, 15 nov.) | vert |
| banc `vestiaire` | Vestiaire ni choisi ni relié (8 nov.) ; phrase « hors totaux » raccourcie (10 nov., `textes-courts-suite`) | **contrôle périmé** | Vestiaire choisi ; phrase jugée sur son sens | 14 rouges → vert |
| banc `onglets-a` « ? » | « Tous » est une BANDE sans « ? » (refonte des listes, 14 nov., 0dddcbb7) | **contrôle périmé** | le « ? » jugé sur la carte d'un site (Ventes · Vinted) | vert, capture de la feuille regardée |
| banc `plateformes-logo` A, C | Messages a « Tous » (10–11 nov., C9) ; Colis vit dans Ventes (11 nov., DJ3) ; site sans compte jugé CHOISI (8 nov.) | **contrôle périmé** | attendus réécrits | 16 rouges → 198 verts |
| banc `vestiaire-plus` A | offres / messages Vestiaire dans des tuiles dépliées de la grille Studio (14 nov., `JOBS_TUILE_JOURNEE`) ; l'offre pressée remonte en tête | **contrôle périmé** | on déplie la tuile, l'ordre lu sur l'écran entier | 54 verts |
| banc `vestiaire-colis` | même tuile Messages ; 44 px exigés à 1512 (souris) | **contrôle périmé** | déplier ; 44 px au doigt seulement (§7) | vert |
| banc `enligne` | voir « Ce qui reste » | — | — | — |
| banc `stock-2d` VII | toucher une case ouvre LA fiche (14 nov., fiche partout) : l'état est dedans, plus de bouton « Voir l'état » ; la fiche restée ouverte couvrait la case suivante (390) | **contrôle périmé** | l'état lu dans la fiche, fiche refermée avant la case suivante | 4 rouges → vert |
| banc `stock-retrouver` | — | relancé seul : **vert** (le rouge était la charge) | — | vert |
| banc `stock-juste` S | sites d'une rangée = UNE sous-ligne `data-stock-sites` (liste dense du 14 nov.) | **contrôle périmé** | lu dans `data-stock-sites` + texte | 4 rouges → vert (P : vert au 2ᵉ passage, charge) |
| banc `stock-hors-reseau` O | le service worker bornait à **160** les morceaux rangés hors ligne ; le paquet en livre **165** : 5 écrans jamais disponibles hors ligne | **défaut app** | `MAX_MORCEAUX_HL = 400` | 160/165 deux fois sur l'ancien ; voir lot final |
| banc `stock-hors-reseau` D, A | encre bleu-nuit du Studio jugée « colorée » ; innerText vide d'une rangée hors écran | **contrôle périmé** | encre (l < 0,22) = neutre ; textContent | vert à 1512 |
| `audit-coque-parametres` | — | **vert** après la fusion de `claude/parametres` | — | 32/32 |
| banc `coque-parametres` H4 | la barre Studio n'a plus de « Plus » (4 espaces + disque) | **contrôle périmé** | sans « Plus », la barre est jugée (une icône par entrée) | voir lot final |
| banc `reglages-premium` | « SMS de colis » redit en gras sous le titre ; interrupteurs amenés à l'écran SOUS la barre du bas flottante | **défaut app** | `<b>` retiré ; `scroll-padding-bottom` au téléphone | 10 → 4 rouges (reste : voir plus bas) |
| banc `parametres-guides` | `ecrireCopieLocale` posait une CHAÎNE brute que `load` (JSON.parse) rejette ⇒ le choix d'imprimante n'était relu qu'après la minuterie de `save` | **défaut app — le banc avait raison** | copie locale toujours en JSON ; le banc ouvre la catégorie « Plateformes » (Paramètres en 10 catégories) | voir lot final |
| banc `ventes-e2` V2, V5 | rangées de « Tous » en `content-visibility: auto` (14 nov.) : innerText VIDE hors écran — l'état n'était pas vide | **contrôle périmé** (lecture) | textContent | voir lot final |
| bancs `a-trancher`, `sante-donnees` | `JSON.parse` de `CLES_PUBLIEES`, qui porte un commentaire depuis le 11 nov. | **contrôle périmé** (lecture) | la liste lue comme du JS (`vm`) | voir lot final |
| `audit-argent` A4 | « Argent » est dans la barre du bas (choix n° 61 de Julien, 14 nov.) | **contrôle périmé** | navigation entière : UNE entrée Argent, aucune Statistiques/Compta | 24/24 ; mutation « dashboard » rouge |
| `audit-journee-coherence` A4 | « Vendus ailleurs » cède sa place au bloc « À retirer ailleurs » en tête (15 nov., `2026-11-15-retrait-ailleurs.md`) | **contrôle périmé** | la condition `!articlesTeteRA().length` admise | 30/30 |
| feuille « Trésorerie » | plus aucun bouton ne l'ouvrait depuis le 13 nov. (`openTreasury` jamais appelé), et elle mêlait le solde LU des porte-monnaie et une somme refaite | **défaut app** (code mort trompeur) | retirée (state, memo, JSX) ; `audit-une-regle`, `audit-donnees-suite` jugent son absence | 44 écrans `tab===` avant et après (§4.11) |
| parcours Vestiaire de la fiche | « arrivé chez Vestiaire → authentification » montrés pour un colis qui part DROIT chez l'acheteur (mesuré, `2026-11-15-vestiaire-ventes.md`) | **défaut app** | `parcoursVenteVc` : livraison lue en cours/faite avant tout contrôle ⇒ envoyé · livraison à l'acheteur · validé · payé ; « livraison » en 5 langues | `audit-vestiaire-plus` V5 : 2 rouges sur le code d'avant, 2 sous la mutation `direct = false`, vert ici |

## `design-passe`

Voir « Lot final » : le nombre de défauts compté et ceux de lisibilité.

## Ce qui reste rouge, et pourquoi

(complété en fin de lot)
