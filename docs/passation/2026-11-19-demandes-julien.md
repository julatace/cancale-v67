# 19 nov. 2026 — Les demandes de Julien, mot pour mot, et ce qui en est fait

À lire avec `docs/design/NATIF.md` (le seul design, décidé ce jour) et `docs/passation/2026-11-16-passation.md`.
Ce fichier est la FILE : chaque demande, la décision, le chantier (branche), son état. Mettre l'état à jour à chaque
intégration. Rien ici n'est « fait » tant que ce n'est pas écrit « en ligne ».

## Les principes posés aujourd'hui (à porter dans CLAUDE.md §2 à l'intégration)

1. « La chose la plus importante est que l'app ne bug plus et que ça charge plus vite entre les onglets. »
2. « L'outil doit être pratique, pas chiant » : pas de carte de reproche récurrente, pas de confirmation sans risque,
   pas d'étape manuelle que l'extension sait faire, ce qui est certain se remplit seul, 1 à 2 touchers par geste courant.
3. « Je veux quelque chose de drastique, nouveau, totalement différent » ⇒ un seul design, « VRM natif ».
4. « Ce n'est pas parce que Vinted est ma plateforme principale que c'est la plateforme principale des autres » ⇒
   l'objet central est l'ARTICLE ; chaque site a les mêmes informations et les mêmes gestes.
5. « Remets tout en question : la praticité, l'utilité de chaque bouton ; regarde s'il manque des choses. »

## En ligne aujourd'hui

- julatace/cancale-v67#1271 : textes blancs sur fond clair (Ventes « N colis à envoyer ») redevenus lisibles.

## Chantiers lancés (branches `claude/…`, aucune en ligne)

| branche | demande (résumé) |
|---|---|
| `natif-fondation` | les briques du design unique (`src/natif/`) puis la coque : barre d'onglets à 5 onglets libellés, grand titre, « Plus », trois volets à l'ordinateur |
| `vite-et-sans-bug` | vitesse entre onglets (mesure par trace), bugs réels (plantages de prod, erreurs serveur) ; « Extension à installer » alors qu'elle tourne dans un AUTRE profil Chrome : le dire au lieu de « à installer » |
| `lisible-partout` | les anciens écrans dans les jetons du natif ; suppression des couches verre / v2 / « VRM » / réglages Style et Ancien design ; banc filet |
| `audit-utilite` | chaque bouton classé garder / fusionner / déplacer / automatiser / retirer ; 10 parcours comptés en touchers ; ce qui manque |
| `aujourdhui-propre` | la liste « À faire » QUITTE Aujourd'hui (« ça ne sert à rien, ça doit être dans les onglets dédiés ») ⇒ bloc « À régler · N » en tête de chaque onglet ; Aujourd'hui = chiffres du jour / semaine / mois, à envoyer, à retirer, dernières ventes |
| `ventes-comme-avant` | « j'aimais bien comme c'était avant » : cases cochées, N°, date limite, place, « Imprimer N bordereaux » ; tableau + fiche à droite à l'ordinateur |
| `fiche-directe` | « je dois cliquer sur la paire puis sur les points pour avoir des informations » ⇒ un toucher, tout visible, chaque valeur se modifie en la touchant ; vaut pour un article sans annonce Vinted |
| `colis-achat-auto` | « je ne dois pas relier l'achat au colis, ça doit être automatique […] on ne doit pas avoir le bouton relier un achat » ⇒ bouton retiré, lien par n° de suivi mesuré et corrigé |
| `prix-sans-manuel` | « c'est à l'extension de baisser les prix, pas à moi » ⇒ « Changer le prix » = un geste, exécution directe ou mise en attente ; inventaire des gestes « à la main » ; photos pour Leboncoin lues seules |
| `completer-infos` | « trouve autre chose pour relier les achats, mettre les prix mini, les prix » ⇒ atelier « Compléter », une question à la fois, règle en lot pour les prix mini |
| `liaison-sites-guidee` | « la liaison des articles entre les applications doit être accompagnée, irréprochable, aucune erreur » ⇒ un parcours photo contre photo, garde-fous silencieux ; remplace la feuille « Relier à Vinted » (« vraiment pas ouf ») |
| `annonces-a-egalite` | « je veux que tout soit comme Vinted, avec toutes les informations à côté » ⇒ une liste Annonces pour tous les sites, mêmes faits, N° / achat / prix mini pour un article sans Vinted ; + les demandes « Annonces » ci-dessous |
| (branche de session) | « Relier achats et ventes » : « Très probable » seulement pour l'article choisi ; filtres « Libres · Déjà reliés » et « Toutes · En ligne · Vendues » — fait, à mettre en ligne après ses bancs |

## EN FILE — à lancer dès qu'un chantier ci-dessus se termine (la machine sature : mémoire, builds de 5 min)

Ordre proposé. Chacun en « VRM natif », avec l'audit d'utilité comme liste de ce qui entre.

### A. Achats (photos du Mac : la passe géante, « Relier l'achat », des carrés blancs vides, « 1 sur 2 »)
« Je ne comprends pas pourquoi les codes de retrait sont aussi gros, tu peux faire ça beaucoup plus petit : simplement
une ligne comme pour les achats, sur le côté gauche […] là c'est beaucoup trop gros et ça ne permet pas de mettre tous
les achats, même ceux qui sont en route, en évidence. » — « Je veux une barre de recherche avec les tailles, les prix,
les marques, les mots-clés des titres, les dates de retrait, etc., pour qu'on puisse retrouver vraiment un achat. »
⇒ Achats = UNE liste : chaque colis à retirer est une RANGÉE (vignette et titre de l'achat s'il est relié par identité,
point relais, code en clair dans la rangée, date limite ; toucher ⇒ le code et le QR en grand, « J'ai retiré ») ; puis
les achats en route, puis tous. Recherche à facettes : taille, prix (bornes), marque, mots du titre, vendeur, compte,
date d'achat, date de retrait, n° de suivi, code. À l'ordinateur : liste à gauche, détail à droite.

Ajout (capture iPhone, 15 h 34, Achats filtré « Leboncoin ») : « le bouton Ajouter dans Achats ne sert à rien » ⇒ RETIRÉ
(un achat arrive tout seul par l'extension ou l'e-mail ; la saisie à la main, si elle reste, va derrière « ⋯ »). Vus sur
la même capture : le rond « scanner » posé PAR-DESSUS « Ajouter » (deux scanners sur l'écran) ; le « ? » invisible ;
avec le filtre Leboncoin, « À retirer · 15 · 2 d'ici demain · 15 avec code · 5 à vérifier » s'affiche mais AUCUN colis
n'est listé ⇒ les nombres ne suivent pas le filtre, ou la liste est vide à tort (bug à mesurer : un filtre de site
doit filtrer les nombres ET la liste, et dire « aucun colis Leboncoin à retirer » s'il n'y en a pas) ; « Mode relais »,
« Suivi vérifié à l'instant », « Ajouter un QR Mondial Relay · 11 sans QR » : à juger avec l'audit (§2, ligne Achats).

### B. Stock et rangement, étiquetage
« Pour chaque article, mets "à ranger maintenant" au lieu que je doive appuyer sur l'article et qu'après ce soit à
droite. Fais une meilleure représentation du meuble, avec une animation quand je range l'article dans le meuble. Je veux
voir le meuble d'un peu plus loin : qu'il occupe toute la largeur de l'écran, et que "ranger" n'apparaisse que quand on
le demande. Je veux tous les meubles de rangement parfaitement dans l'onglet Stock. Je te laisse réfléchir. » —
« À la création du compte, et même après, qu'on puisse choisir la méthode d'étiquetage que l'on veut. »
⇒ Stock : les meubles en pleine largeur (vue d'ensemble d'abord, zoom sur un meuble) ; « À ranger · N » = une liste
d'articles avec « Ranger » sur chaque rangée ; le mode rangement s'ouvre à la demande, propose la case
(`casesProposees`), l'article « vole » dans sa case (mouvement réduit respecté). Reprendre ce qui est bon du lot gardé
`claude/integration-16nov-finitions-stock-v4` (étagère personnalisable) et de `2026-11-17-stock-rangement.md`.
Étiquetage : au premier lancement ET dans Paramètres, choisir sa méthode (VRM numérote / je numérote moi-même / lettres
ou préfixe / étiquette imprimée ou écrite à la main, format) — règles des numéros de CLAUDE.md §5 intouchées.

### C. E-mails et « relier ma boîte »
« L'onglet e-mails est absolument catastrophique, les e-mails sont moches, et quand je ne clique sur rien tout est
regroupé à gauche, condensé. » — « "À traiter · Colis · Ventes" peut être en haut et prendre toute la largeur, et après
on a le beau mail directement dans l'application. » — « Relier la boîte mail à l'application : un processus beaucoup
plus accompagné, beaucoup plus simple. »
⇒ E-mails = Mail d'Apple : segmenté en haut sur toute la largeur, liste, lecture ; sans sélection, la liste prend la
place (pas de colonne étroite + vide). Un e-mail s'affiche propre (ce que VRM a compris en tête : colis, code, point,
date ; le message d'origine dessous, images à la demande). « Relier ma boîte » : un parcours pas à pas par fournisseur
(Gmail, Outlook, iCloud…), une étape par écran, vérification en direct (« on a bien reçu ton e-mail d'essai »).
À voir aussi (photo) : des e-mails « Colis à retirer · code pas encore lu · à vérifier — je n'ai pas trouvé le n° de
suivi dans cet e-mail » (Locker 24/7) : confié à `colis-achat-auto` (mesure : d'où vient le code de ces colis).

### D. Compte bloqué par Vinted
« Quatre comptes n'envoient aucun e-mail à VRM […] [le compte] est bloqué, donc c'est tout à fait normal. L'extension est
en mesure de voir si j'ai été bloqué par Vinted, donc je dois recevoir une animation ou un message de VRM quand je suis
bloqué, avec un questionnaire sur quoi faire : est-ce que je garde les annonces en ligne ou pas, ou alors je supprime
tout sur ce compte sauf les ventes et les achats. »
⇒ Détection (ce que l'extension lit déjà : `guetterDressing`, 401/403, modération, `etatcompte`) ⇒ UNE annonce claire
(« Vinted a bloqué {compte} ») et un parcours : (1) garder ses annonces dans VRM (hors totaux, « à confirmer ») ; (2) les
retirer de VRM (les N° ne sont jamais réattribués ; ventes et achats GARDÉS) ; (3) « décider plus tard ». Rien n'est
supprimé sans son geste, avec sauvegarde et annulation ; les alertes de ce compte (« n'envoie aucun e-mail », « lecture
ancienne ») se taisent tant qu'il est bloqué.

### E. Messages et favoris
« Pour Vinted, les messages doivent être exactement comme dans l'application Vinted : pas les présentations, les lignes
de code, etc. On doit pouvoir répondre directement dedans quand l'extension est connectée. » — « Les favoris mieux mis
en avant : une liste de tous les derniers favoris dont les ventes n'ont pas été faites ; celles qui ont été faites sont
là mais floutées, on ne peut pas cliquer dessus, c'est marqué vendu. Je clique sur chaque favori à qui je veux envoyer
un message, j'applique un taux de réduction si j'ai envie, le même à tout le monde, je prédéfinis mon message, et
l'extension lance. » — « Ça ne doit pas être aussi long : la dernière fois c'était cinq minutes entre chaque message. »
⇒ Messages = l'app Vinted (bulles, photo de l'article et prix en tête, offres en cartes, réponse dans le champ) ; aucun
texte technique. Favoris : la liste à cocher (existe depuis 5.407) refaite en natif, vendues grisées « Vendu », une
remise pour tous, un message, « Envoyer à N ».
⚠️ RYTHME : aujourd'hui 15 par heure (une toutes les 4 min, décision « Discrétion » du 12 nov.). Julien demande plus
vite. Un de ses comptes est actuellement bloqué par Vinted : accélérer augmente ce risque. Proposition à appliquer et
à lui DIRE : 40 à 90 s au hasard entre deux messages (jamais deux fois la même valeur), dans le plafond inchangé de 45
actions par heure et par compte, arrêt au premier captcha — et un réglage « Plus prudent » qui remet 15 par heure.
Demande une version d'extension.

### F. Annonces (ajouté à `annonces-a-egalite`)
« Je n'ai pas de barre où je peux faire des actions : republier, passer de brouillon à en ligne, d'en ligne à brouillon.
Fais-moi un petit onglet "Action" : j'appuie, un menu déroulant, je choisis, et ça me permet de sélectionner toutes les
annonces à qui appliquer. Mets aussi la republication à la main dans cet onglet, et explique bien à chaque fois comment
ça marche, comment tu gardes le numéro même si la personne publie sans son extension : l'extension arrivera à
reconnaître après. » — « J'en ai 52, "brouillons à refaire" : il y en a qui ne sont même plus dans Vinted, je ne
comprends pas pourquoi ils sont encore là : c'est un bug horrible. » — « Enlève "prix d'achat inconnus 11/52" dans la
barre des annonces. » — « Les annonces qui n'ont pas de numéro : donne-leur un numéro, c'est à l'application de le
faire, pas à moi. »

## Rappels pour l'intégration

- Extension : plusieurs chantiers peuvent la toucher (`prix-sans-manuel`, E) ⇒ UNE seule version (5.409.0), zips
  régénérés une fois à la fin, garde-fous intacts.
- Lot du 16 nov. (finitions + Stock v4) : gardé sur `claude/integration-16nov-finitions-stock-v4`, non appliqué.
- App Store : il faut un compte Apple Developer (99 $/an) et son Mac relié (Xcode) ; Apple relit 1 à 2 jours ; pas de
  paiement Stripe dans l'app iPhone, « Se connecter avec Apple » si Google reste, suppression du compte dans l'app.

### G. « Publier partout » : une fiche complète par article, traduite pour chaque site
Julien : « je vais pouvoir transvaser une annonce de Vinted, Leboncoin, eBay à Vestiaire Collective, mais je veux être sûr
que pour chaque article, peu importe ce que c'est, ça publie au bon endroit dans la bonne catégorie, même si les
catégories ne sont pas les mêmes » — « pour chaque article que je publie sur Vinted, ça enregistre la catégorie […] et
il faut également que ça enregistre couleur, matériaux, pointure, description, absolument tout ».
Existant (mesuré dans le code) : l'extension lit déjà sur l'annonce Vinted `catalog_id`, `brand_id`/`brand`, `size_id`,
`size_title`, `status_id`, `color1_id`/`color2_id`/`color_ids`, `package_size_id`, `is_unisex`, mesures, `item_attributes`
(background.js ~7812 et 13483) ; `src/correspondances.js` traduit la CATÉGORIE Vinted → Leboncoin (18 sûres / 5 à
demander), Vestiaire (7 / 14), eBay (suggestion de l'API) ; réponses retenues dans `vrm_correspondances`.
À construire :
1. UNE FICHE ARTICLE NEUTRE gardée par VRM pour chaque article (quel que soit le site d'origine) : catégorie VRM,
   genre, marque, pointure (EU, jamais convertie), état, couleur(s), matière(s), dimensions, titre, description,
   photos, prix, prix mini — remplie à la LECTURE de l'annonce (Vinted, et aussi Leboncoin, eBay, Vestiaire), jamais
   devinée ; un champ pas lu reste vide et se demande une fois.
2. Des TABLES PAR CHAMP et par site, dans les DEUX sens (catégorie, état, couleur, matière, marque, pointure), tirées
   des listes que chaque site sert ; pas sûr ⇒ demandé une fois, retenu ; un site qui refuse (marque hors liste
   Vestiaire) ⇒ « pas vendable sur ce site », jamais forcé.
3. Publier n'importe quel sens (Leboncoin → Vestiaire sans Vinted) ; rien ne part sans catégorie ni champ obligatoire
   sûr ; RELECTURE après publication (la catégorie enregistrée par le site = la voulue, sinon dit).
4. Un tableau de couverture : pour chaque catégorie présente dans le stock, sûre / à demander / impossible, par site.
Dépend de `annonces-a-egalite` (l'article central). Extension probablement touchée (lecture des fiches Leboncoin /
eBay / Vestiaire) ⇒ dans la version unique 5.409.
G bis (même jour) : « il faut un agent totalement intelligent capable de poster, peu importe ; s'il y a un doute il
regarde, et s'il ne trouve pas il demande l'information à l'utilisateur ; 100 % autonome et intelligent. »
Décision : UN geste « Publier sur… » (un article ou une sélection) ; l'agent remplit tout seul chaque champ de chaque
site depuis la fiche article, dans cet ordre de confiance : (1) tables vérifiées ; (2) ses réponses passées
(retenues par catégorie et par marque) ; (3) ce qui est LU sur le site cible (listes de valeurs du formulaire,
suggestion de catégorie eBay) ; PAS D'IA (Julien, même jour : « tu n'intègres pas d'IA, mais tu fais un agent 100 % autonome, sans IA ») :
uniquement des règles, des tables, ce qui est lu et ce qu'il a déjà répondu ; il apprend de chaque réponse. Doute restant ⇒ UNE question groupée par article
(toutes les inconnues sur un écran, choix du site, réponse retenue). Publie, RELIT, et dit le résultat ; un échec dit
pourquoi et quoi faire. Garde-fous de l'extension inchangés (son geste, compte de l'onglet, plafonds, une à la fois).
G ter : « c'est l'extension qui va publier dans tous les cas » — l'agent prépare et décide des champs dans l'app ;
la PUBLICATION part toujours de l'extension (onglet du site, compte de l'onglet, plafonds), comme aujourd'hui.
**État (19 nov.)** : G, G bis, G ter construits sur `claude/publier-agent` (pas en ligne) — `2026-11-19-publier-agent.md`.

### H. Le lien extension ↔ application, compréhensible par n'importe quel vendeur
Julien : « améliore le lien entre l'extension et l'application : on ne sait pas quand ton compte Vinted est ouvert,
quelles actions on peut faire, on ne sait rien ; des fois c'est marqué [qu'il y a] trop [d'onglets / de comptes]
ouverts, vraiment pas clair du tout ; beaucoup mieux accompagné : le vendeur doit comprendre, pour que je n'aie pas trop
de questions de leur part. »
À construire : UN endroit unique « Extension » (dans « Plus », et la pastille de la coque y mène), en phrases simples :
- par navigateur : l'extension est-elle là, à jour, branchée à CE compte VRM (pastille correctifs `vite-et-sans-bug` :
  « pas dans ce navigateur », « ne répond pas sur cette page ») ;
- par compte de chaque site : « Vinted · shop_x — ouvert dans ce Chrome · lu il y a 3 min » / « pas ouvert : ouvre
  vinted.fr connecté à shop_x » ; quel onglet sert à quoi ;
- CE QUE VRM PEUT FAIRE MAINTENANT pour ce compte, en liste verte / grise avec la raison du gris (« baisser un prix :
  oui · publier : oui · lire les codes : oui · messages aux favoris : non, Vinted n'est pas ouvert ») ;
- chaque message d'état réécrit en une phrase + le geste (« deux comptes Vinted sont ouverts dans ce Chrome : VRM
  n'agit que sur celui de l'onglet actif — garde un seul compte par navigateur »), jamais un terme technique ;
- un pas-à-pas d'installation et de premier branchement qui vérifie chaque étape en direct (« extension vue ✓ »,
  « compte Vinted vu ✓ ») ; une aide « Pourquoi ? » d'une ligne par état.
Mesure d'abord, en prod, les états réellement rencontrés (lignes `ext_appareil_*`, `actions_compte_*`, rapports) et les
libellés actuels (inventaire de l'audit d'utilité) ; extension probablement touchée ⇒ version unique 5.409.

## DÉCISIONS DE JULIEN (19 nov., réponse « 1 oui, 2 oui, 3 oui, 4 oui » aux questions de l'audit d'utilité §8)
Elles CHANGENT des règles de CLAUDE.md : à reporter dans CLAUDE.md (§2.5, §3) à l'intégration, avec cette date.
1. **Baisse de prix par règle automatique** : OUI. Une règle posée une fois (ex. « −5 % tous les 14 jours sans vente,
   jamais sous le prix mini »), appliquée par l'extension seule, dans ses plafonds (45/h, réserve 5, baisses
   irrégulières, arrêt au 1er captcha, prudence), journal « Ce que VRM a fait », éteinte par défaut, réglage par compte.
   Jamais sous le prix mini ; sans prix mini, jamais sous achat + 10 % ; sans achat connu ni prix mini : pas de baisse.
2. **Prix d'achat posé seul** : OUI. Le montant du REÇU de CET achat (son n° de transaction) est posé quand l'achat
   reçoit son N° (ou quand il est relié par identité) ; jamais deviné ; un LOT n'est jamais divisé (demandé) ; une
   saisie de Julien n'est jamais écrasée ; dit une fois (« prix d'achat repris du reçu »). Remplace §2.5 « il saisit
   les prix d'achat lui-même ».
3. **Vendue ailleurs ⇒ masquer seul sur Vinted** : OUI. Une paire dont la vente est PROUVÉE sur un autre site est
   MASQUÉE (réversible) sur Vinted par l'extension, compte de l'onglet, dans les plafonds ; la SUPPRESSION reste son
   toucher (§3 inchangé : jamais de suppression automatique) ; vente annulée ⇒ démasquée ; dit dans le journal.
4. **Envoi des colis** : OUI. « Préparer mes colis », « Je dépose », la tournée et « Emballer » sont retirés ; le dépôt
   est constaté par le suivi du transporteur ; « Imprimer N bordereaux » imprime depuis Aujourd'hui.

## DÉCISIONS DE JULIEN (19 nov. soir, « on fait tout sauf vercel » sur le plan capacité 3 000)
- Vercel reste en Hobby (pas de Pro pour l'instant).
- Migration 048 APPLIQUÉE le 19 nov. (index `app_data_preuve_adresse`, index BRIN `journal_ecritures_at_brin`, fonction `sauvegarde.vrm_purger_journal`, clé de service seule) — rien effacé.
- Copies `sauvegarde.app_data_20260930` et `sauvegarde.app_data_20261002` (111 Mo) SUPPRIMÉES le 19 nov. (aucune fonction, vue ni code ne les lisait).
- Mises en ligne regroupées : 1 à 2 « trains » par jour au lieu de 8 à 10.
- Messages aux favoris (Julien, 19 nov. soir : « 4 min c'est peut-être beaucoup, on garde toujours le temps aléatoire ») : attente aléatoire 40–90 s par défaut + temps d'écriture ; choix « Plus prudent » 2–4 min ; plafonds inchangés (15/h favoris, 50/h, jour). Livré avec l'extension 5.409 (chantier extension-utile).

## DÉCISION DE JULIEN (20 nov.) : « Toute action doit être faite dans l'extension, on ne doit plus pouvoir faire d'action dans l'app »
Lecture retenue : les ACTIONS SUR LES PLATEFORMES (Vinted, Leboncoin, Vestiaire : baisser/changer un prix, offres, messages aux favoris,
republier, masquer/afficher, mettre en pause, supprimer, publier, répondre, contre-offre, automatisations) se font dans le PANNEAU de
l'extension sur le site. L'app montre l'état, les chiffres et le journal, et chaque ancien bouton d'action devient « Faire dans
l'extension » qui ouvre le site avec le panneau sur la bonne page et la bonne sélection (lien `?vrm=panneau&page=…&ids=…`).
Restent dans l'app : ce qui n'agit pas sur une plateforme (saisir un prix d'achat / prix mini / N°, ranger, imprimer des bordereaux
déjà reçus, relier, compta, réglages) et eBay (pas de panneau : API serveur).

## DÉCISION DE JULIEN (20 nov.) : la cadence devient son réglage
« Les autres (Vtools, Vintex, Bleam) envoient des messages autant qu'ils veulent » ⇒ « vas-y fais » : par compte, dans le panneau,
favoris/h (15 par défaut, ≤ 60), actions/h (50 par défaut, ≤ 100), plafond/jour, pause entre messages (40–90 s par défaut, 20 s–4 min,
aléatoire). Non réglable : arrêt captcha/refus + prudence 24 h, pause 403/429, un compte à la fois, une requête à la fois, compte de
l'onglet. Refusé (Claude) : déguisement du navigateur, faux clics, contournement de captcha, rotation d'IP.
