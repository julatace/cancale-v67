# 15 nov. 2026 — La finition écran par écran

Julien, sur son iPhone : « Améliore tout », « tout doit être parfait », « je veux que ça soit pro »,
« fais en sorte que ce soit plus pratique », « j'aime pas trop les écritures… enlève les écritures ».

Branche `claude/finition-ecrans`, partie de `origin/claude/project-review-nsk5su` (0cccddbd : Studio bleu
clair, Inter partout, aides « première fois » retirées, Annonces refait). Aucune PR ouverte, CLAUDE.md non touché.

## Ce qui a été fait, et comment

Une passe sur chaque écran — Ma journée ; Ventes (À expédier, Envoyés, la fiche d'une vente, la feuille
d'impression) ; Achats (À retirer, À vérifier) ; Annonces, Stock, la fiche d'une paire ; Leboncoin, eBay,
Vestiaire ; Argent (Résumé, Factures, Déclarer/URSSAF, Statistiques) ; Messages ; E-mails ; Paramètres ;
Communauté ; la loupe ; le disque « + » — au téléphone (390 tactile) puis à l'ordinateur (1512), clair et
sombre, sur la base INVENTÉE des bancs (`_base-messages-stock.cjs` : 3 comptes, 1 000 annonces, 1 000
conversations, 1 000 e-mails). Chaque écran capturé et regardé, avant et après.

**Où vit le correctif** : `src/design/studio-finition.css`, dans `@layer vrm-finition`, nommée la PREMIÈRE
dans `index.html` (`@layer vrm-finition, sj-studio, vrm-studio, vrm-premium;`) — pour une déclaration
`!important`, la couche nommée la première gagne. Chaque règle est `!important` et visée par la racine de
son écran. Le fichier s'appelle `studio-*.css` parce qu'`audit-studio` (S3) n'admet après `studio.css`
que les feuilles d'écran du studio. Peu de JSX touché : la ligne « colis pressés » de Ma journée (sa forme
courte), le menu du compte du Stock (`court`), le titre « N comptes sans e-mail » de Paramètres.

Aucun chiffre recalculé, aucune règle §5 touchée, aucun `data-*` retiré, aucun geste perdu : ce qui
quitte l'écran (une phrase d'explication) reste lu au lecteur d'écran et dans l'infobulle.

## Écran par écran

| écran | ce qui n'allait pas | ce qui a changé |
|---|---|---|
| Ma journée (tél. et ordi.) | le « ? » restait SEUL sur sa ligne, sous la carte des colis (la phrase du jour n'est plus lue qu'au lecteur d'écran) | la tête est une grille : « Ma journée ? » sur une ligne (l'ordre de lecture ne change pas, `journee-perso` lit le même DOM) |
| Ma journée | « 27 colis pressés · Le plus urgent : date estimée… » coupé | la ligne porte SA forme courte : « 27 colis pressés » / « Date estimée dépassée » (`limiteCourte`, la même source) ; la phrase entière reste dans l'infobulle et le nom du bouton |
| Ma journée | « Ma semaine› » sans espace (rangée flex) ; à l'ordinateur « 3 ventes » touchait le grand « 75 € » | espace avant le chevron ; 22 px sous l'affiche à l'ordinateur |
| Ventes · À expédier (ordi.) | le mot du plein coupé : « Imprime… » | le mot passe sur deux lignes au besoin, plus jamais coupé |
| Ventes · Envoyés | deux phrases sous les onglets, dont « Le plus récent en haut : prise en charge lue, sinon… » | la phrase sur l'ordre est lue au lecteur d'écran ; la ligne des colis sans transporteur RESTE (c'est une couverture, §5) |
| Ventes · la fiche | DEUX boutons pleins (« Imprimer le bordereau » encre + « Emballer » bleu) ; « Bordereau » redisait « Imprimer le bordereau » ; le titre se centrait seul dans sa colonne ; quatre gestes empilés pleine largeur | « Bordereau » se tait quand la rangée porte déjà « Imprimer le bordereau » ; « Emballer » devient un lien (comme « Changer le prix ») ; le titre à gauche sous le N° ; Marquer imprimé · Déposé · Masquer · Suivre en deux colonnes |
| Ventes · Tournée (ordi.) | le « ⓘ À quoi sert la tournée ? » (cible de 44 px) mordait sur « Préparer la tournée de dépôt » | 12 px entre un bouton et son « ⓘ » |
| Impression (« Choisir ce qui part ») | « Générer N bordereaux » à 40 px au doigt | 44 px |
| Annonces · Stock · Achats (le sélecteur), sites, vues, filtres | touches dessinées de 38–40 px dans un puits de 44–48 px : un toucher sur le bord du puits tombait à côté | la cible couvre toute la hauteur du puits (pseudo-élément transparent, rien de dessiné ; la touche ne rogne plus son propre pseudo) |
| Annonces · « N numéros à vérifier » | le « ⓘ Pourquoi vérifier » mordait de 11 px sur le titre du repli (deux cibles au même endroit) | sa ligne prend la hauteur de sa cible |
| Stock (tél.) | la bande coupée : « 1 024 p… », « 0 ra… », « 1 000 à… » ; « 24 sans N » passait SOUS « Tous les comptes » (et « Comment c'est compté » caché dessous) | le nombre en haut, le libellé entier dessous ; le compte en « Tous ▾ » (forme courte de `MenuCompte`) ; « Comment c'est compté » ouvre la même feuille que les autres puces : il se tait quand il y en a d'autres, une seule rangée |
| Argent · Factures (tél.) | « Facture » : un bloc-bouton SOUS chaque vente (40 ventes = 40 lignes de plus) ; « Pourquoi ? » mordait sur « Récapitulatif (fichier) » | « Facture » dans la rangée, à droite du montant (même bouton) ; 6 px sous la ligne au « ⓘ » |
| E-mails | la rangée des rubriques sortait de 4 px à droite (page qui glisse de côté) | marges ramenées dans la page |
| Paramètres (tél.) | chaque sous-ligne coupée au milieu d'un mot (« Chaque compte, sa dernière relecture et l'e… ») ; « 3 comptes sans adresse e-mail associée » sur QUATRE lignes | la sous-ligne d'un réglage n'est plus montrée au téléphone (lue au lecteur d'écran, trouvée par la recherche des réglages ; une sous-ligne d'ALERTE reste) ; « 3 comptes sans e-mail » (`fin.reglages.sansEmail`, 5 langues) |
| Paramètres (ordi.) | espaces ordinaires avant « : ? » dans les phrases des réglages (« Vinted : note ») | insécables dans les 19 phrases `reglages.*.desc` / `confort.*.desc` (fr) |
| La loupe | micro, photo et « Fermer » se mordaient de 4 à 6 px ; « Fermer » collé au bord ; sous-lignes des ACTIONS coupées (« Colis → « Tout imprimer » : tu choisis, puis t… ») ; une phrase d'aide qui répétait le champ | marges négatives retirées, 12 px au bord ; les sous-lignes d'actions et « N°, pseudo, suivi… » lues au lecteur d'écran (et l'infobulle), plus à l'écran ; « À la voix… » et son « Pourquoi ? » RESTENT (ce que fait le navigateur du son : une promesse) |
| L'en-tête (ordi.) | micro et photo du champ de recherche se mordaient de 8 px | côte à côte |
| Le disque « + » | les quatre lames (100 px, 82 px d'écart) se chevauchaient ; les mots de l'éventail se lisaient PAR-DESSUS les chiffres de l'écran | lames de 80 px ; voile à 92 % (jour et nuit) |
| Messages, Leboncoin, eBay, Vestiaire, Argent · Résumé, URSSAF, Statistiques, Communauté | rien de cassé mesuré ni vu | inchangés |

## Ce qui n'a PAS été changé (vu, et pourquoi)

- **Ventes · « 30 À envoyer » dans la bande ET « 30 colis à envoyer » dessous** (§7 : un nombre une fois) : la
  bande est la carte configurable `ventes-toutes` (`carteChiffres.js`), son défaut est jugé par
  `audit-carte-chiffres` et huit bancs ; à trancher avec Julien (retirer `aposter` du défaut de Ventes).
- **Ventes · titres des rangées coupés tôt** (« New Balance sp… ») : le N° et l'échéance partagent la ligne ;
  passer le titre sur deux lignes ferait des rangées de plus de 96 px (`studio-ventes` L, densité à 1 000 colis).
- **Achats · la première rangée sous la moitié de l'écran** (règle « liste d'abord ») : il faudrait refondre la
  tête (comptes, bande, filtres) — une décision de composition, pas une finition.
- **Stock · « sans N° : pas rangeable »** coupé dans la méta d'une rangée sans N° (rapporté par le banc, hors passe).
- **Messages · extraits coupés** : c'est l'aperçu d'un message, voulu.

## La preuve

**Banc neuf `scripts/bancs/finition-ecrans.cjs`** — 22 écrans × 390 tactile et 1512 × clair et sombre (le
disque au téléphone seulement). Il mesure sur l'app RENDUE (géométrie, styles calculés, jamais un libellé) :
D aucun débordement (la page, et le bord droit VU de chaque élément), C aucun chevauchement entre deux
cibles, ni entre deux TEXTES (la boîte de leurs lettres, `Range`), par zone (contenu, tête, barre), E aucun
libellé de la passe coupé par « … », T cibles ≥ 44 px (l'étendue RÉELLEMENT atteinte au doigt autour du
centre, pseudo-élément compris), F insécables sur les libellés de la passe. Les coupes hors passe sont
RAPPORTÉES, jamais cachées.

- sur le build d'AVANT (`BANC_DIST=<dist de 0cccddbd>`, 390 clair et sombre) : ROUGE — voir le tableau du rapport.
- sur le build d'APRÈS : vert sur les 4 combinaisons (sauf ce qui est dit plus bas).

Audits : `traduction`, `tdz`, `variables`, `studio`, `composants`, `icones`, `violet`, `rouge-doublon`, `csp`,
`quoi-de-neuf`, `identite`, `urssaf`, `onglets-d` — tous verts (`studio` était rouge le temps d'une
heure : la feuille s'appelait `finition.css` ; renommée `studio-finition.css`). Test node
`scripts/tests/reglages-actions.test.mjs` vert (le titre court garde « 1 compte »).

Les bancs du chantier et ceux qui lisent un texte changé : voir le rapport de la session (verts/rouges et
la raison de chaque rouge).

## Le geste de Julien

Aucun. Fermer/rouvrir l'app ; regarder Ma journée, le Stock, la fiche d'une vente, Factures et Paramètres
sur l'iPhone, dire ce qui gêne encore.
