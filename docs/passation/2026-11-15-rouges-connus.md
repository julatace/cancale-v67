# 15 nov. — Les rouges connus d'`origin/main` : défaut de l'app ou contrôle périmé ?

Branche `claude/rouges-connus` (partie de `origin/claude/project-review-nsk5su`, puis fusion de
`origin/claude/stock-etageres`, `origin/claude/parametres` et `origin/main` — vraies fusions, conflits de traductions
et de « Quoi de neuf » résolus en gardant les deux côtés). Pas de PR ; CLAUDE.md et l'extension non touchés.

Méthode : chaque rouge relancé SEUL, sa capture regardée ; s'il dit un vrai défaut, **l'app est corrigée** ; s'il
fige un comportement retiré exprès, **le contrôle est réécrit sur la règle d'aujourd'hui**, la décision citée —
jamais affaibli : la règle reste jugée et rougit par mutation ou sur le code d'avant. Machine très chargée tout du
long (charge 20 → 83, disque à 98 % un moment) : « Page crashed », « Target closed » et délais relancés avant de
conclure.

## Le tableau

| contrôle | cause | défaut app / contrôle périmé | ce qui a changé | preuve |
|---|---|---|---|---|
| `audit-safari` | 3 regex à lookbehind arrivées APRÈS l'audit (`recherchePhrase` 14 nov., `notif-redaction` 15 nov., `accompagnement` 14 nov.) : Safari < 16.4 refuse de lire TOUT le paquet ; un `AbortSignal.timeout` gardé à la main ; 4 `navigator.share` testés au rendu, pas au point d'appel | **défaut app** (grave : « L'application n'a pas pu démarrer » sur iOS 15–16.3) | `recherchePhrase` : motifs à branches essayées dans l'ordre, la branche « début de mot » jugée sur le caractère d'avant (même sémantique) ; `notif-redaction` : découpe par marqueur, préfixe capturé ; `phraseTechnique` : `(?:^|[^\d.,])` ; `signalDelai(30000)` ; partage testé au point d'appel | 3 rouges avant → 21/21 (`--prouve`) ; même comportement : 2 202 phrases (0 différence ; mutation « début ignoré » ⇒ 275), 30 000 textes notif/technique (0 différence) |
| `audit-extension-5340` P1 | extraction de `scalairesVente(e)` ; la 5.374 (13 nov., `2026-11-13-vestiaire-vente-orion.md`) en a fait `scalairesVente(e, source)` + `dateLue`/`dateVenteDe` | **contrôle périmé** (extraction) | extraction des pièces d'aujourd'hui ; mutation « un seul jour » sur `jourParis` (11 nov.) ; « rouge sur origin/main » impossible (le lot y est) ⇒ arbre d'AVANT le lot `f3ef0e5b^` | 29/29 ; 19/19 mutations rouges ; arbre d'avant : 18 rouges |
| `audit-plateformes-logo` D10 | l'entrée « Publier ailleurs » est le « + » de la barre (`data-pa-entree` + `vrm:publier-ailleurs` avec son site), refonte des sites du 14 nov. (a04a8355, `2026-11-14-refonte-plateformes-reglages.md`) | **contrôle périmé** | D10 : sur chaque site une entrée qui ouvre « Publier ailleurs » SUR CE site, et l'écouteur qui accepte le site | 63/63 ; 3 mutations neuves rouges |
| banc `vestiaire-bout-en-bout` B, C | 8 nov. (`2026-11-08-navigation-plateformes.md`) : un site se montre s'il est CHOISI ou relié ; colonne par tâches (plus de `plat_*`) | **contrôle périmé** | B1 choisi : filtre + « pas encore lu » ; B2 ni choisi ni relié : ni filtre ni écran ; colonne sans `plat_*` ; C : Vestiaire choisi | 31 rouges → 1 (voir « Ce qui reste ») |
| banc `vestiaire-bout-en-bout` E | la case « À envoyer » de la grille Studio de Ma journée (14 nov.) ne posait plus `data-vestiaire`/`data-leboncoin` ; le mois vit dans `CarteStatsApp` (`data-carte-*`) | **défaut app** (attribut machine perdu) + contrôle périmé (le mois) | `attrsCase` porte `data-leboncoin`/`data-vestiaire` ; E lit `data-carte-chiffre="vendu"` | `vc:null` avant → vert |
| banc `vestiaire-parite` A | `studio-paires.css` recadrait (`cover`) la photo Vestiaire que Julien veut ENTIÈRE (2 nov. ; refonte du 14 nov. : « photo entière sur blanc ») | **défaut app** | `.vrm-pf-photo-vc img { object-fit: contain }` ; la proportion 4/5 (ancienne carte de 300 px) devient « dans la case carrée de la rangée dense » | `cover` avant → 68 verts |
| banc `vestiaire-parite` B | transporteur = une MARQUE, plus un nom écrit (10 nov., `2026-11-09-transporteurs-parfaits.md`) ; l'état d'une vente Vestiaire s'écrit par ses mots (`vcventes`, lot du 15 nov.) | **contrôle périmé** | « une marque, le nom jamais deux fois » ; le mot lu dans `src/i18n/langues/fr/vcventes.js` | vert (voir « À trancher ») |
| banc `vestiaire-parite` D, E | gestes d'une rangée dans LA fiche ouverte au toucher (Studio 15 nov., `studio-ventes.css`, `DansFiche`) ; aperçu du tampon : 22 s à 1512 sous charge 25 | **contrôle périmé** | ouvrir la fiche, puis Imprimer / Déposé ; attendre l'ÉTAT du placeur (60 s), pas une durée | vert |
| (capture) fiche « Sans titre » | `FichePaire` : une paire lue sans titre affichait « Sans titre » sous la ligne « Cabas toile beige » | **défaut app** | le titre de la ligne touchée, comme sa photo | capture |
| banc `vestiaire-fiches` | montant sans centimes nuls (5 nov., `montant()`) ; fraîcheur en puces SOUS la liste (14 nov.) | **contrôle périmé** | prix jugé `99 €` + `data-*` ; « lu il y a 2 h » une fois sur l'écran ; état de V1 : la règle de `origin/main` | vert (P3 rouge une fois, vert au passage suivant : charge) |
| banc `vestiaire` | Vestiaire ni choisi ni relié (8 nov.) ; phrase « hors totaux » raccourcie (10 nov., `textes-courts-suite`) | **contrôle périmé** | Vestiaire choisi ; phrase jugée sur son sens | 14 rouges → vert |
| banc `onglets-a` « ? » | « Tous » est une BANDE sans « ? » (refonte des listes, 14 nov., 0dddcbb7) | **contrôle périmé** | le « ? » jugé sur la carte d'un site (Ventes · Vinted) | vert, feuille regardée |
| banc `plateformes-logo` A, C | Messages a « Tous » (10–11 nov., C9) ; Colis vit dans Ventes (11 nov., DJ3) ; site sans compte jugé CHOISI (8 nov.) | **contrôle périmé** | attendus réécrits | 16 rouges → 198 verts |
| banc `vestiaire-plus` A | offres / messages Vestiaire dans des tuiles dépliées de la grille Studio (14 nov., `JOBS_TUILE_JOURNEE`) ; l'offre pressée remonte en tête | **contrôle périmé** | on déplie la tuile, l'ordre lu sur l'écran | 54 verts |
| banc `vestiaire-colis` | même tuile Messages ; 44 px exigés à 1512 (souris) | **contrôle périmé** | déplier ; 44 px au doigt seulement (§7) | vert |
| banc `stock-2d` VII | toucher une case ouvre LA fiche (14 nov.) : l'état est dedans, plus de bouton « Voir l'état » ; la fiche restée ouverte couvrait la case suivante (390) | **contrôle périmé** | état lu dans la fiche ; fiche refermée avant la case suivante | 4 rouges → vert |
| banc `stock-retrouver` | — | relancé seul : **vert** (charge) | — | vert |
| banc `stock-juste` S | sites d'une rangée = UNE sous-ligne `data-stock-sites` (liste dense du 14 nov.) | **contrôle périmé** | lu dans `data-stock-sites` + texte | 4 rouges → vert |
| banc `stock-hors-reseau` O | le service worker bornait à **160** les morceaux rangés hors ligne ; le paquet en livre **165** : 5 écrans jamais disponibles hors ligne | **défaut app** | `MAX_MORCEAUX_HL = 400` (`public/sw.js`) | 160/165 deux fois avant ; **165/165** après ; banc 69 OK / 0 KO |
| banc `stock-hors-reseau` D, A | l'encre bleu-nuit du Studio jugée « colorée » ; innerText vide d'une rangée hors écran | **contrôle périmé** | encre (l < 0,22) = neutre (l'ambre et le rouge restent jugés par leur teinte) ; textContent | vert |
| `audit-coque-parametres` | — | **vert** après la fusion de `claude/parametres` | — | 32/32 |
| banc `coque-parametres` | H4 : barre Studio sans « Plus », colonne à 9 entrées (14 nov.) ; H3 : l'expression des mots écartés rejetait « E-mails », le mot RETENU (`src/libelles.js`) ; « Bientôt » compté en plus de SA rangée Discord ; H6 : « Ranger » ouvre la feuille du rangement guidé (11 nov., b364eede) | **contrôles périmés** | barre sans « Plus » jugée, plancher 9, `emails` seul écarté, une rangée comptée une fois, feuille OU Stock | 19 (main) → **« rien à signaler »** |
| banc `reglages-premium` | « SMS de colis » redit en gras sous le titre ; interrupteurs amenés à l'écran SOUS la barre du bas flottante | **défaut app** | `<b>` retiré ; `scroll-padding-bottom` au téléphone (`studio.css`) ; le banc NOMME ce qui recouvre | 10 → 4 (310 ✅), voir « Ce qui reste » |
| banc `parametres-guides` | `ecrireCopieLocale` posait une CHAÎNE brute que `load` (JSON.parse) rejette : le choix d'imprimante n'était relu qu'après la minuterie de `save` | **défaut app — le banc avait raison** | copie locale toujours en JSON (comme `save`, comme `load`) ; le banc revient par la catégorie et ouvre « Plateformes » (Paramètres en dix catégories, `2026-11-15-parametres.md`) | SyntaxError avant → **27 conformes** |
| banc `ventes-e2` V2, V5, G | rangées de « Tous » en `content-visibility: auto` (14 nov., 1 000 ventes) : innerText VIDE hors écran — l'état n'était pas vide | **contrôle périmé** (lecture) | textContent | V2, V5, G verts ; reste un `screenshot` dépassé (charge 60+) |
| bancs `a-trancher`, `sante-donnees` (chargement) | `JSON.parse` de `CLES_PUBLIEES`, qui porte un commentaire depuis le 11 nov. | **contrôle périmé** (lecture) | la liste lue comme du JS (`vm`) | les deux bancs tournent |
| banc `a-trancher` G | les SMS mènent à Ventes / Achats (Colis déplacé, 11 nov., DJ3) ; l'écran ouvert (`vrm_reprise_ecrans`, 11 nov.), le point de restauration (`restore_*`, 11 nov.) et la veille des chiffres (11 nov.) sont écrits par l'app, pas par le geste | **contrôle périmé** | attendus réécrits ; ces trois-là nommés non-données (toute autre écriture reste rouge) | 8 → **vert** |
| `audit-argent` A4 | « Argent » est dans la barre du bas (choix n° 61 de Julien, 14 nov.) | **contrôle périmé** | navigation entière : UNE entrée Argent, aucune Statistiques/Compta | 24/24 ; mutation « dashboard » rouge |
| `audit-journee-coherence` A4 | « Vendus ailleurs » cède sa place au bloc « À retirer ailleurs » en tête (15 nov., `2026-11-15-retrait-ailleurs.md`) | **contrôle périmé** | la condition `!articlesTeteRA().length` admise | 30/30 |
| feuille « Trésorerie » | plus aucun bouton ne l'ouvrait depuis le 13 nov. (`openTreasury` jamais appelé) ; elle mêlait le solde LU des porte-monnaie et une somme refaite | **défaut app** (code mort trompeur) | retirée (état, calcul, JSX) ; `audit-une-regle`, `audit-donnees-suite` jugent son absence | 44 écrans `tab===` avant et après (§4.11) ; audits verts |
| parcours Vestiaire de la fiche | « arrivé chez Vestiaire → authentification » montrés pour un colis qui part DROIT chez l'acheteur (mesuré, `2026-11-15-vestiaire-ventes.md`) | **défaut app** | `parcoursVenteVc` : livraison lue en cours/faite avant tout contrôle ⇒ envoyé · livraison à l'acheteur · validé · payé ; « livraison » en 5 langues | `audit-vestiaire-plus` V5 : 2 rouges sur le code d'avant, 2 sous la mutation `direct = false`, vert ici |

## `design-passe` (36 écrans, 390 tactile et 1512, clair et sombre)

- `origin/main` (rapporté) : ≈ 806 ; ici avant correction : **790** ; après : **626**.
- Défauts de LISIBILITÉ réels corrigés (hors Stock, Paramètres, Argent ; ni couleur ni fond touchés) :
  - texte < 11 px : le « N° » de la plaque à **9,5 px** (144 sur Annonces) ⇒ 11 px (`studio-paires.css`) ;
  - mots coupés au trait : `hyphens: auto` + `overflow-wrap: anywhere` sur les libellés des tuiles de Ma journée
    (20) ⇒ `hyphens: manual`, `break-word` (`studio-journee.css`) ;
  - contraste, débordement, chiffres rognés, coupures : **0** partout.
- Pas des défauts de lisibilité (laissés : la matière va changer avec « Verre dépoli ») : 404 tailles hors de
  l'ancienne échelle (13,5 · 14,5 · 31,5 px, l'échelle du Studio), 44 graisses 550/650 (Inter variable).
- Cibles < 44 px au doigt : les touches du sélecteur Annonces · Stock · Achats (40) et des sites (38) sont DESSINÉES
  ainsi et leur cible couvre déjà tout le puits de 44–48 px (`studio-finition.css` §2, pseudo-élément, lot du 15 nov.) ;
  design-passe mesure la boîte dessinée. **À trancher** : la plaque « N° 124 » d'une rangée d'Annonces
  (`button[data-edition]`, 23 px) est une petite cible DANS une rangée qui se touche entière.

## Ce qui reste rouge, et pourquoi

- `enligne` (25 KO) : il exige qu'une annonce vue SEULEMENT en lecture publique entre dans la grille — refusé depuis
  la règle du 2 nov. — et lit d'anciens libellés ; la réécriture touche 13 sections et `<enligne-regle>` (modifiée
  encore aujourd'hui par `claude/audit-fiabilite`) : laissée au chantier de l'écran Annonces, comme le dit
  `2026-11-15-audit-fiabilite.md`. Ni affaibli ni sauté.
- `vestiaire-bout-en-bout` B2, **390 px, Messages** seulement : `?tab=messages&site=vestiaire`, Vestiaire ni choisi ni
  relié ⇒ l'écran Vestiaire (« Pas encore relevés… ») s'affiche au lieu d'une vue montrée (1512 : vert). Apparu à la
  fusion de `origin/main`, reproduit deux fois. Probable **défaut app** (le retour d'un site masqué vit dans l'effet
  de `FiltreSites`) — pas corrigé faute de temps.
- `sante-donnees` (117 ✅ · 11 ❌) : « aucune écriture pendant 3 s écran ouvert » et « le bouton n'écrit aucune
  donnée » voient `widget_stats`, `lbc_a_retirer`, `vrm_veille_chiffres`, `restore_0`, `vrm_reprise_ecrans`,
  `vrm_achats_jours`, `vrm_annonces_achetees` (publications d'écran et état de l'app, hors `CLES_PUBLIEES`) ; **et**
  `colis-a-confirmer` réécrit `vinted_annonce_numeros`, `vinted_sales`, `vinted_accounts`… en ouvrant Achats — à
  MESURER avant de conclure (artefact du banc ou vraie réécriture de `main` ?). Non tranché.
  **Tranché (16 nov., `claude/achats-ecriture-main`) : effet du banc, aucune donnée réécrite.** La ligne `main`
  servie n'avait que 2 clés ; la PREMIÈRE synchronisation de l'appareil (au chargement, avant tout geste, `cloudPush`
  via `_pushPending`/`onCloudReady`) y ajoute ce que l'appareil sait : `vinted_annonce_numeros` absent ⇒ `{}`,
  `vinted_sales` ⇒ `[]`, `vinted_accounts` ⇒ la copie sans jetons, `vrm_je_vends`, `vrm_ecrans_vus`… (absent ⇒ vide,
  rien perdu ni écrasé). Machine chargée ⇒ cet envoi arrivait après la photo « avant » ; reproduit à coup sûr en
  retenant ce premier envoi jusqu'au clic (exactement ces clés). Achats n'écrit aucune de ces clés. La prod porte
  déjà ces clés dans `main` (lecture `data ? …`, 6 lignes sur 8). Banc corrigé : `main` réaliste (fiches, pool,
  comptes), photo AU REPOS, jugement par règle (clé existante inchangée, aucune clé de données apparue, fiches et
  pool intacts) ; publications déclarées. G « n'écrit aucune donnée » : 9/9 verts ; rouge sous mutation (Achats
  réécrit un prix de fiche ; Achats invente une vente).
- `reglages-premium` (4) : « Mots expliqués » recouvert par un `span` sans classe à mi-écran (y = 325, sans doute un
  toast ou la pastille « Enregistrement… ») ; un « Page crashed » et deux clics de 4 s à 1512 (charge 45–80).
- `ventes-e2` : un `page.screenshot` dépassé (30 s) sur le scénario « gros », charge 60+.
- Hors liste, vus en passant, rouges aussi sur l'arbre d'avant : `audit-revue-fin` A4 (`partageFichiersPossible`
  déclaré deux fois une fois App.jsx recollé à ses écrans), `audit-politique-hotes` (adresses hors liste) ;
  `audit-plateformes-logo --prouve` : 7 mutations anciennes « motif introuvable » (le code a bougé) — les 29 autres et
  les 3 neuves rougissent.

## À trancher par Julien (vocabulaire)

`src/libelles.js` (5 et 8 nov., « une notion = UN mot ») : « À envoyer », « à expédier » écarté. Mais le lot « ventes
Vestiaire justes » (15 nov.) écrit l'état d'une vente Vestiaire « À expédier avant le … », l'intertitre de Ventes
(DJ3, 11 nov.) dit « À expédier », et « Tous » dit « À envoyer » pour la même vente. Un seul mot : lequel ? Les
contrôles suivent aujourd'hui ce que chaque lot a écrit.

## Captures regardées

vestiaire-bout-en-bout (Ma journée 1512, vide 390), vestiaire-parite (annonces, ventes, récapitulatif 390 et 1512
sombre, colis 390, placeur du tampon 1512), onglets-a (« D'où viennent ces chiffres »), plateformes-logo (eBay sans
compte), vestiaire-plus (Ma journée), stock-2d (fiche 390), design-passe (Annonces 390).

## Rouge avant / vert après / mutation (résumé)

- Code d'avant : `audit-safari` 3 rouges ; `audit-extension-5340` (arbre d'avant le lot) 18 rouges ;
  `audit-vestiaire-plus` V5 2 rouges ; `stock-hors-reseau` O 160/165 ; `parametres-guides` SyntaxError ;
  `vestiaire-bout-en-bout` E `vc:null`.
- Mutations : 5340 19/19 ; plateformes-logo 3 neuves ; argent A4 (« dashboard ») ; vestiaire-plus V5 (`direct = false`) ;
  recherchePhrase « début ignoré » ⇒ 275 différences sur 2 202 phrases.
