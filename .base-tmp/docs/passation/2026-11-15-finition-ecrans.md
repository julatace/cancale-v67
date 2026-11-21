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
| Ma journée · « À retirer » dépliée (sa capture iPhone : « fais ça mieux pour les colis ») | « + 6 à vérifier » écrit DEUX fois (titre et dessous) ; deux « Colis · Mondial Relay · Intermarché » à vignette vide (une épingle) : on ne sait pas lequel ; l'adresse coupée « 43 Rue du Lt F… » ; les plaques s'alignaient sur la longueur du code | une fois (dans le titre) ; la photo de SA commande par identité (`commandeRetrait`, inchangé), sinon le LOGO du transporteur (`LogoTransporteur`), titre « Colis Mondial Relay » et la date d'arrivée SÛRE (« depuis le 14 nov. », `arriveeColisEmail` = « oui » ; une borne n'est pas une date) — jamais une ressemblance ; le NOM du point (`cleanLieu` + `nomPointRetrait`) ; colonne des codes de 96 px, la ligne du point sur deux lignes au besoin |
| Achats · la fiche d'un colis à retirer | l'adresse du point n'était nulle part | ligne « Point » : le nom, l'adresse entière dessous |
| La tête · le nuage barré | une icône muette (le sens n'était que dans l'infobulle, invisible sur iPhone) : c'est `BoutonSync`, état `error` (la base n'a pas répondu, la sauvegarde sera retentée) ou `refus` (l'écran est périmé) | il dit son mot : « Pas enregistré » / « À recharger » (`fin.sync.*`, 5 langues), en ambre |
| Ma journée · « À ce rythme… / estimation » sous la barre | vu sur sa capture en cours de défilement ; mené tout en bas, la dernière ligne finit au-dessus de la barre (banc B) | rien à changer à la mise en page ; le banc le garde |
| Ventes à l'ordinateur (sa capture Chrome : « améliore le visuel ») | la barre collée (recherche + île des sites) laissait lire au travers ce qui défilait dessous (verre à 74 %) ; l'échéance d'une rangée « À envoyer » flottait au milieu (548 px vides à droite) ; « Envoyés » : « En route » écrit deux fois par rangée (méta + légende de la frise) et une colonne de droite vide ; deux phrases grises techniques sous les onglets | verre à 94 % + ombre douce ; l'échéance au bout de la rangée, alignée d'une rangée à l'autre ; la légende de la frise au lecteur d'écran seulement, la frise prend la colonne vide quand la rangée n'a pas de geste ; « 18 colis sans transporteur lu » (les raisons dans l'infobulle et au lecteur d'écran) |
| Messages, Leboncoin, eBay, Vestiaire, Argent · Résumé, URSSAF, Statistiques, Communauté | rien de cassé mesuré ni vu | inchangés |

## Ce qui n'a PAS été changé (vu, et pourquoi)

- **Ventes · « 30 À envoyer » dans la bande ET « 30 colis à envoyer » dessous** (§7 : un nombre une fois) : la
  bande est la carte configurable `ventes-toutes` (`carteChiffres.js`), son défaut est jugé par
  `audit-carte-chiffres` et huit bancs ; à trancher avec Julien (retirer `aposter` du défaut de Ventes).
- **Ventes · titres des rangées coupés tôt** (« New Balance sp… ») : le N° et l'échéance partagent la ligne ;
  passer le titre sur deux lignes ferait des rangées de plus de 96 px (`studio-ventes` L, densité à 1 000 colis).
- **Achats · la première rangée sous la moitié de l'écran** (règle « liste d'abord ») : il faudrait refondre la
  tête (comptes, bande, filtres) — une décision de composition, pas une finition.
- **Ventes à l'ordinateur · la liste du bas de sa capture** (« adidas handball… · Vinted · tomj606 · aujourd'hui ·
  ● À envoyer · 62 € », grand vide photo ↔ titre, « IN_PROGRESS », « n° 37451417 ») : la base inventée ne la rend
  pas (aucune rangée de ce type mesurée) — pas touchée à l'aveugle ; Vestiaire est corrigé ailleurs
  (`claude/vestiaire-ventes`). La refonte « tableau de bord » complète de Ventes (colonnes photo · N° · titre ·
  compte · état · montant) reste à faire.
- **Stock · « sans N° : pas rangeable »** coupé dans la méta d'une rangée sans N° (rapporté par le banc, hors passe).
- **Messages · extraits coupés** : c'est l'aperçu d'un message, voulu.
- **La fiche d'un colis sans achat relié** s'intitule « n°…0001 » (la fin du n° de suivi) et empile quatre
  gestes de formes mêlées (Copier le code, Code en grand, Ajouter le QR, Suivre) : à reprendre avec la fiche (FichePaire).

## La preuve

**Banc neuf `scripts/bancs/finition-ecrans.cjs`** — 22 écrans × 390 tactile et 1512 × clair et sombre (le
disque au téléphone seulement). Il mesure sur l'app RENDUE (géométrie, styles calculés, jamais un libellé) :
D aucun débordement (la page, et le bord droit VU de chaque élément), C aucun chevauchement entre deux
cibles, ni entre deux TEXTES (la boîte de leurs lettres, `Range`), par zone (contenu, tête, barre), E aucun
libellé de la passe coupé par « … », T cibles ≥ 44 px (l'étendue RÉELLEMENT atteinte au doigt autour du
centre, pseudo-élément compris), F insécables sur les libellés de la passe, N un même fait porteur d'un nombre
(« + 6 à vérifier ») jamais écrit deux fois dans une carte ouverte, V aucune vignette vide (photo par identité,
sinon logo), B mené tout en bas, rien ne reste sous la barre du bas, G (Ventes à 1512) la barre collée a un fond
plein (≥ 90 %), aucune rangée de colis ne garde plus de 240 px vides à droite, chaque photo reste dans sa rangée. Sa base ajoute des colis À RETIRER inventés
(deux Mondial Relay qu'aucune commande ne nomme, un achat Vinted Go à l'adresse longue) et l'écran
« journee-retirer » (la carte dépliée) et « achats-fiche-colis ». Les coupes hors passe sont RAPPORTÉES, jamais cachées.

- sur le build d'AVANT (`BANC_DIST=<dist de 0cccddbd>`, 390 clair et sombre) : ROUGE — voir le tableau du rapport.
- sur le build d'APRÈS : vert sur les 4 combinaisons (sauf ce qui est dit plus bas).

Audits : `traduction`, `tdz`, `variables`, `studio`, `composants`, `icones`, `violet`, `rouge-doublon`, `csp`,
`quoi-de-neuf`, `identite`, `urssaf`, `onglets-d` — tous verts (`studio` était rouge le temps d'une
heure : la feuille s'appelait `finition.css` ; renommée `studio-finition.css`). Test node
`scripts/tests/reglages-actions.test.mjs` vert (le titre court garde « 1 compte »).

**Résultats du banc neuf** (machine partagée très chargée : charge 40–56, mémoire pleine, Chromium qui plante
parfois — un plantage est dit « l'écran s'ouvre ❌ », jamais compté vert ; le banc relance un navigateur neuf) :
- après, 390 clair + sombre : **486 ✅ · 0 ❌** ; après, 1512 clair : **296 ✅** (les rouges 1512 sombre de ce passage
  sont tous des « Target crashed », mémoire) ; Ventes et Envoyés 1512 avec G : **18 ✅ · 0 ❌** ;
- avant (build 0cccddbd), 390 clair + sombre : **32 ❌** (cibles, chevauchements, coupes, insécables) ; la carte
  « À retirer » dépliée : **N ❌ et V ❌** ; Ventes 1512 : **G ❌** (barre à 74 %, 548 px vides) et C ❌.

**Bancs du chantier** (relancés à la fin) : `studio-ventes` 97 ✅ · `studio-coque` 79 ✅ · `studio-journee` ✅ ·
`studio-reste` 319 ✅ · `studio-paires` ✅ · `annonces-tete` ✅ · `argent` 269 ✅ · `accompagnement` 30 ✅ ·
`achats-retirer-visible` 54 ✅ · `garde-ecrans` ✅ · `impression-simple` ✅ · `colis-envoyes-tri` 93 ✅ ·
`parler-loupe` ✅ · `tout-imprimer` 28 OK (seul ; dans la série il a manqué de temps) ·
`afaire-feuille` 691 ✓ · 6 ✗ — « l'écran a pu se jouer » / « la feuille s'ouvre » sous charge, sur Annonces
Leboncoin/Vestiaire et deux balayages : écrans que la passe ne touche pas, à relancer sur une machine calme ·
`colis-heure` 14 KO — ce banc ne lit pas `BANC_DIST` (impossible de le passer sur le build d'avant) ; ses KO
portent sur les cartes de Colis (« carte absente » : sélecteurs d'avant le studio) et la teinte ambre du studio
(#764300) absente de sa palette ; sa ligne de Ma journée (« en retard — c'était avant 7 h aujourd'hui », « Lima
Runner », l'heure) est verte au second passage (la phrase entière est dans l'infobulle et le nom du bouton).

## Le geste de Julien

Aucun. Fermer/rouvrir l'app ; regarder Ma journée, le Stock, la fiche d'une vente, Factures et Paramètres
sur l'iPhone, dire ce qui gêne encore.
