# Audit d'utilité — chaque bouton doit mériter sa place (19 nov. 2026)

Julien, le 19 nov. : « Remets vraiment tout en question sur la praticité, l'utilité de chaque bouton, tout doit être
absolument parfait. Tu dois regarder s'il manque des choses. » ; « l'outil doit être pratique, pas chiant » ; la liste
« À faire » d'Aujourd'hui « ne sert à rien, ça doit être dans les onglets dédiés » ; « c'est à l'extension de baisser
les prix, pas à moi » ; « je ne dois pas relier l'achat au colis, ça doit être automatique » ; « je dois cliquer sur la
paire puis sur les points pour avoir des informations, ce n'est pas normal » ; « ce n'est pas parce que Vinted est ma
plateforme principale que c'est celle des autres ».

Ce document dit **ce qui entre dans la refonte « VRM natif »** (`docs/design/NATIF.md`) et ce qui disparaît. Aucun
code de l'app n'est modifié ici. Rien n'est supprimé des données : « retirer » veut dire « ne plus le montrer » (la
valeur enregistrée reste). Les refus de CLAUDE.md §3 sont tenus (voir §8).

**État de ce document : version 2.** Le banc a relevé les 26 écrans à 390 et 1512 px **à l'ouverture** (ce qui se
touche sans rien déplier : 770 éléments au téléphone, 983 à l'ordinateur — `2026-11-19-inventaire-gestes.md`). Ce qui
est derrière un toucher (feuilles, « ⋯ », sections) n'a été relevé au banc que pour Aujourd'hui et Ventes (machine
partagée saturée) ; pour les autres écrans cette partie vient de la lecture du code — c'est dit à chaque endroit.

---

## 1. La synthèse — les 15 décisions, classées par gain pour toi

| n° | sorte | la décision, en une ligne | ce que ça t'enlève |
|---|---|---|---|
| 1 | **RETIRER** | La liste « À faire » d'Aujourd'hui, l'écran « À trancher » et « Ma semaine » disparaissent : chaque rappel vit dans **son** onglet, sous une ligne repliée « À régler · N ». | 34 sortes de lignes et 22 cartes réglables sur le premier écran ; des reproches qui reviennent tous les jours (« 1 024 annonces sans prix d'achat »). |
| 2 | **AUTOMATISER** | Le **prix d'achat se pose tout seul** quand l'achat reçoit son N° (le reçu Vinted est déjà lu) ; « Relier un achat » disparaît des 6 endroits où il est proposé. | Le geste que personne ne fait : 17 prix d'achat posés pour 1 119 articles numérotés ⇒ le bénéfice est « pas su » presque partout. |
| 3 | **AUTOMATISER** | L'achat et son colis se relient **par le n° de suivi ou le code de retrait** (des identités, lues par l'extension) : la question « Quel achat est dans ce colis ? » disparaît. | Une question par colis ; un colis sans identité va dans « À régler », jamais une question en plein milieu. |
| 4 | **AUTOMATISER** | **La baisse de prix est une règle que tu poses une fois** (« −5 % tous les 14 jours sans vente, jamais sous le prix mini ») ; l'extension l'applique seule, dans ses plafonds, et te dit ce qu'elle a fait. | 6 à 8 touchers par série de baisses, à refaire chaque semaine, onglet Vinted ouvert. |
| 5 | **FUSIONNER** | **La fiche tient sur une page** : prix, prix mini, acheté, bénéfice, taille, en ligne depuis, place, favoris, sites — tout se lit sans rien ouvrir, chaque valeur se modifie en la touchant. « ⋯ » ne garde que le rare et le destructif. | « Cliquer sur la paire puis sur les points pour avoir des informations » : 11 tuiles derrière « ⋯ » et un segment à 3 vues. |
| 6 | **AUTOMATISER** | « Imprimer N bordereaux » **imprime depuis Aujourd'hui** ; les bordereaux se préparent seuls ; le dépôt est constaté par le suivi. « Emballer », « Préparer mes colis », « Je dépose », la tournée : retirés. | Aujourd'hui, le bouton d'Aujourd'hui n'imprime pas : il t'emmène à Ventes, où il faut le retoucher (relevé au banc). |
| 7 | **FUSIONNER** | « J'ai retiré » ouvre **une seule page « Mettre en ligne »** : N° donné, prix d'achat lu, place proposée ; il reste les photos, ton prix, « Publier ». | L'atelier en 6 étapes (N° · Case · Photos · Prix · Fiche · Publier) : ≈ 16 touchers ⇒ ≈ 5. |
| 8 | **AJOUTER** | **Aucun site n'est « le principal »** : l'app part des sites que le vendeur a choisis ; l'inscription passe de 8 à 4 étapes ; l'extension s'installe depuis la boutique du navigateur. | 4 comptes VRM sur 8 n'ont jamais rien relié ; 6 navigateurs vus, 6 versions d'extension différentes. |
| 9 | **FUSIONNER** | **Une seule navigation** : 5 onglets + « Plus » (la photo du profil). Le menu ☰ « Tous les écrans » disparaît. **Une seule recherche, un seul scanner** (dans le champ). | 3 menus qui listent les mêmes écrans ; 4 scanners (Retrouver un colis, Scanner un bordereau, Scanner un colis, disque « + »). |
| 10 | **RETIRER** | **Plus aucune personnalisation d'écran** : « Modifier ma journée », « Modifier les chiffres de la carte » (sur 4 écrans), l'objectif, les teintes / densités / « La pièce » du Stock. | 1 compte sur 8 s'en est servi. Un écran bien rangé n'a pas besoin d'être réglé. |
| 11 | **RETIRER** | **L'aide dispersée** : le bouton « ? » de chaque écran, les visites en bulles, les vidéos, les « Pourquoi ? », les 109 phrases d'explication permanentes. Une entrée « Aide » dans Plus. | Un écran qui a besoin d'une explication est un écran à refaire, pas à expliquer. |
| 12 | **FUSIONNER** | **Argent en 3 vues** : Ce mois · Déclarer · Factures. « À venir », la prévision, le bilan du mois y entrent ; « Prix du marché » est retiré (0 ouverture en 13 jours). | 4 segments + 3 sous-écrans ; le même « Vendu » écrit sur 3 écrans. |
| 13 | **FUSIONNER** | **La place est un champ de la fiche** et une colonne des listes ; l'écran Stock devient la liste par place, dans Plus. Meubles 3D, teintes, densités : retirés. | 4 cases remplies en tout dans la base pour 1 119 articles numérotés. |
| 14 | **AUTOMATISER** | **Le prix mini se demande à la mise en ligne** ⇒ les offres s'acceptent ou se refusent seules (moteur existant) ; sinon un plein « Accepter 48 € » dans la conversation, que la notification ouvre directement. | 4 à 5 touchers par offre ; 6 prix mini posés aujourd'hui, donc le moteur ne sert presque pas. |
| 15 | **AJOUTER** | **« Annuler » pendant 10 secondes** remplace les confirmations sans risque ; **« Ce que VRM a fait »** (le journal des gestes automatiques) est une rangée de Plus ; Paramètres = 9 groupes. | 207 demandes de confirmation dans le code ; 80 réglages ; un journal dont la base ne contient aucune ligne. |

**En une phrase** : l'app a grandi par ajouts (251 nouveautés annoncées entre le 9 et le 18 novembre, 396 fichiers
d'écran ajoutés depuis le 20 octobre pour 14 retirés). La refonte ne doit pas redessiner ce tas : elle doit en
**retirer les deux tiers** et faire faire le reste par l'app et l'extension.

---

## 2. Le tableau « pour les agents » — ce qui entre dans chaque écran de la refonte

Règles communes (elles priment sur le détail) :
- **Un écran = un métier = un seul bouton plein.** Tout ce qui n'est pas dans la liste de l'écran n'y entre pas.
- **« À régler · N »** : UN groupe replié en tête de l'onglet (ambre s'il y a une date qui presse), une rangée = un
  geste. C'est le seul endroit des rappels. Vide ⇒ il n'existe pas. Jamais une carte, jamais une phrase de reproche.
- **Filtrer** : UN bouton « Filtrer » dans la barre de titre (feuille : site, compte, période, tri). Plus de rangée
  permanente de sites, de pastilles de vues ni de menu de compte. Un filtre posé se lit dans le sous-titre de la liste.
  La liste des sites est celle que le vendeur a choisie — jamais « Vinted » d'office.
- **La recherche** : le champ sous le grand titre (loupe ; le scanner est DANS le champ). Elle cherche partout (N°,
  titre, pseudo, n° de suivi, code). Une rangée de résultat porte déjà l'état et la place.
- **Balayage** = le geste principal de la rangée ; **toucher** = la fiche ; **appui long** = sélection multiple, la
  barre d'actions remplace alors le plein.
- **Pas de** : bouton « ? », phrase permanente, « Modifier les chiffres », état technique (« Vestiaire : pas encore
  lu », « Lecture seule », « à confirmer ») — un état de lecture va dans Plus › Tout va bien ?.
- Mots uniques : §7.

| écran | son métier | le plein | ce qui ENTRE (liste exacte) | ce qui n'entre PAS (et où ça va) |
|---|---|---|---|---|
| **Aujourd'hui** | Voir ce que j'ai vendu et ce que je dois porter ou aller chercher aujourd'hui. | « Imprimer N bordereaux » (il IMPRIME, sans passer par Ventes) ; absent s'il n'y a rien à imprimer. | 1. `Affiche` « X € vendus aujourd'hui · N ventes ». 2. Les 7 barres (toucher un jour change l'affiche, rien d'autre). 3. Groupe « Ce mois » : Vendu · Reçu · Bénéfice (toucher ⇒ Argent ; un « — » ⇒ la saisie qui le répare). 4. Groupe « À envoyer · N » : 3 rangées (vignette, plaque N°, place, date limite), « Tout voir » ⇒ Ventes. 5. Groupe « À retirer · N » : par point relais, le code en grand sur la rangée, balayage « Retiré ». 6. Groupe « Dernières ventes » : 5 rangées ⇒ fiche. | La liste « À faire » (34 sortes) ⇒ « À régler » de chaque onglet (table §4.1). Tuiles Messages et Prix à baisser ⇒ pastille de l'icône Messages ; règle de baisse (n° 4). « Ma semaine », « Semaine du… », « Modifier les chiffres de la carte », « Modifier ma journée », bouton « ? » ⇒ retirés. « À venir », « À ce rythme, novembre finira vers… » ⇒ Argent. « Tout va bien ? » ⇒ Plus. « À trancher » ⇒ dissous. |
| **Annonces** | Mes articles en ligne : les trouver, voir comment ils se portent, agir dessus. | « Publier un article » (une fiche ⇒ tous mes sites cochés). | `Segmente` **En ligne · À publier · Dorment**. « À régler · N » : N° en double (rouge, le seul rouge), N° à écrire (« C'est écrit » au balayage), annonce disparue ou masquée par le site, à retirer ailleurs, brouillon à refaire. Rangée 72 : vignette, titre, « N° · taille · sites · compte », prix à droite, « 34 j » en ambre si elle dort. Balayage : « Prix ». Sélection multiple : Baisser le prix · Republier · Publier ailleurs · Offre aux favoris. Dans « Dorment » : les paires proposées sont cochées, le plein devient « Republier N ». | Rangée des sites, « Vues rapides », menu du compte, tri ⇒ « Filtrer ». Sélecteur Annonces / Stock ⇒ Stock est dans Plus. « Outils des annonces » : offres automatiques ⇒ Paramètres › Offres et prix ; studio photo ⇒ dans « Publier » et fiche › Photos ; répartir un lot ⇒ Achats (mise en ligne d'un lot) ; inventaire ⇒ Stock ; audit du stock ⇒ retiré (le contrôle de nuit le fait). « Sans achat relié » ⇒ retiré (n° 2). Bande de chiffres ⇒ le compte est dans le segment. Écrans Leboncoin / eBay / Vestiaire en propre ⇒ le filtre de site ; leurs gestes sont dans la fiche (groupe Sites). |
| **Ventes** | Préparer et envoyer mes colis, les suivre jusqu'au paiement. | « Imprimer N bordereaux » (cochés d'office, comme aujourd'hui). | `Segmente` **À envoyer · En route · Terminées**. « À régler · N » : litiges et retours, colis en retard, double vente, bordereau introuvable, vente sans N°. Rangée 72 : case cochée, vignette, plaque N°, titre, « place · avant le 21 nov. », montant. Balayage : « Déposé » (rattrapage : le suivi le fait seul). En route : les 4 étapes sur la rangée. Terminées : date de versement. Toucher ⇒ fiche (la vente y est une section). | « Retrouver un colis » et « Scanner un bordereau » ⇒ le scanner de la recherche. Rangée des sites ⇒ « Filtrer ». « Outils des colis » (Emballer, Préparer, Je dépose, tournée, Générer) ⇒ retirés / automatiques (n° 6). « Où sont ces articles dans le stock » ⇒ la place est sur chaque rangée. « Les voir » et « Choisir, réimprimer » ⇒ réimprimer est un geste de la fiche. Carte « À envoyer : 30 » + « Modifier les chiffres » ⇒ retirées (le segment porte le nombre). « À venir » ⇒ Argent. « Format · Classique A4 » ⇒ Paramètres › Impression. « Vestiaire : pas encore lu » ⇒ Tout va bien ?. « Afficher les 60 suivantes » ⇒ la liste défile. |
| **Achats** | Aller chercher mes colis et faire entrer les articles en stock. | Dans « À mettre en ligne » : « Mettre en ligne » (la page unique, n° 7). Ailleurs : aucun. | `Segmente` **À retirer · En route · À mettre en ligne · Tous**. « À régler · N » : à renvoyer (retour), remboursement à vérifier, colis sans identité, dernier jour de garde. À retirer : groupé par point relais ; code en grand sur la rangée ; toucher ⇒ « Montre ce code au comptoir » ; balayage « Retiré ». Après « Retiré » : l'article passe seul dans « À mettre en ligne », avec son N° et son prix d'achat. « + » dans la barre de titre : « Achat hors plateforme » (brocante, magasin). | « Quel achat est dans ce colis ? », « Relier à une vente / annonce », « Relier à une annonce (facultatif) » ⇒ automatiques (n° 2 et 3). Écran « Achats masqués » ⇒ un filtre de « Tous ». « Plus : fournisseurs, délai, lots », « Vitesse », « Étapes de tes achats » ⇒ Argent › Statistiques (une page poussée) ou retirés. Calculette d'achat ⇒ elle vit dans l'extension, sur l'annonce (existant). « Importer un tableur » ⇒ Paramètres › Mes données. Scanner ⇒ la recherche. |
| **Argent** | Savoir ce que j'ai gagné et ce que je dois déclarer. | Dans « Déclarer » : « J'ai déclaré 1 596 € ». Ailleurs : aucun. | `Segmente` **Ce mois · Déclarer · Factures** + la période dans la barre de titre. Ce mois : `Affiche` Bénéfice (ou Reçu si le bénéfice n'est pas su, avec « sur N ventes ») ; `Faits` Vendu · Reçu · Bénéfice · À recevoir · Prix d'achat manquants (une porte) ; groupe « Par site » ; rangées « Statistiques › », « Exporter pour mon comptable ». Déclarer : le montant de la période, l'échéance, l'historique « déclaré ». Factures : la liste, « Ma facture » (identité), l'envoi automatique. | « Prix du marché » ⇒ retiré (0 ouverture). « Modifier les chiffres », objectif ⇒ retirés. Bilan de fin de mois, clôture d'année, DAC7, alertes de seuils ⇒ des rangées de « Déclarer », montrées seulement quand elles sont dues. Coûts de vente, emballage ⇒ Paramètres › Offres et prix (une valeur par défaut). |
| **La fiche** | Tout sur UN article, et le geste du moment. | UN, selon l'état : « Imprimer le bordereau » · « Mettre en ligne » · « Accepter 48 € » · sinon aucun. | Photo, plaque N°, titre, UNE ligne d'état. `Faits` (2 colonnes) : Prix · Prix mini · Acheté · Bénéfice · Taille · En ligne depuis · Place · Favoris et vues — chaque valeur se touche pour la modifier ; « — » ouvre sa saisie. Groupe « Sites » : une rangée par site (compte, prix, état, ouvrir sur le site) ; un site choisi où elle n'est pas : « Publier ». Si vendue : groupe « La vente » (acheteur, étapes, versement). Groupe de gestes en rangées : Baisser le prix · Republier · Offre aux favoris · Vendue ailleurs · Dupliquer / autre taille · Photos · Note. Histoire : repliée. | Le segment Argent · Sites · Histoire (tout est sur la page). Les tuiles de « ⋯ » : Rappel, Emballer ⇒ retirés ; Certificat, « Son N° » (changer le N°), Supprimer l'annonce, Signaler ⇒ restent dans « ⋯ » (rare ou destructif). « Tout voir » (par étape, dans l'ordre, ce qui n'a pas pu être lu) ⇒ l'histoire repliée. La carte « Relie son achat » ⇒ retirée (n° 2 ; il reste « Acheté — » qui se touche). |
| **Messages** | Répondre aux acheteurs et aux offres. | Dans une conversation avec une offre : « Accepter 48 € ». | `Segmente` **Conversations · Offres · Favoris**. Conversations groupées par compte (le compte de l'onglet d'abord — règle du 12 nov.), non lues en tête. Conversation : la paire en tête (⇒ fiche), les réponses rapides, dicter, traduire. Offres : une rangée par offre en attente ; balayage Accepter / Refuser ; « Proposer » dans la conversation. Favoris : l'état de l'automatisation (allumée / éteinte, combien envoyés), la liste. | Diagnostic des favoris ⇒ Tout va bien ?. Réglages de rythme ⇒ Paramètres › Rythme. Écrans Messages Leboncoin / eBay / Vestiaire en propre ⇒ le filtre de site. |
| **Stock** (dans Plus) | Savoir où est chaque article. | « Ranger un article » (scanner ou taper le N° ⇒ place proposée). | Liste groupée par place (meuble › case), plaque N° + vignette ; groupe « Pas rangés · N » ; recherche N° ; « Inventaire » (une rangée). | Étagère 3D, Cartons / Rayonnage / Plan, teintes, étiquette, densités, « Personnaliser », « La pièce », Organisation ⇒ retirés. La place se lit et se change depuis la fiche et les rangées de Ventes. |
| **Paramètres** (dans Plus) | Régler une fois ce qui change vraiment une décision. | aucun | 9 groupes, comme l'app Réglages : **Mon compte** (profil, abonnement, appareils, double vérification) · **Mes sites** (un groupe par site choisi : comptes, état de lecture ; extension ; boîte mail) · **Numéros et rangement** (VRM numérote / je numérote, préfixe) · **Impression** (format, imprimante, tampon N°) · **Offres et prix** (prix mini par défaut, accepter / refuser seul, message de refus, règle de baisse, offre aux favoris, coûts) · **Rythme des comptes** (un interrupteur « Prudent », mode vacances, « Tout arrêter ») · **Notifications** · **Apparence** (sombre, langue, taille du texte) · **Mes données** (sauvegarde, export, import, supprimer mon compte). | Tout réglage hors de cette liste n'est plus montré (sa valeur reste) : Ma journée et cartes personnalisées, raccourcis, objectif, conseils à revoir, visite, aides d'accueil, mode stream, simulation de compte, code local, premier colis, « Quoi de neuf » (⇒ Plus), style / ancien design. Le détail des plafonds (jour, type, compte neuf, « si tu es là ») ⇒ derrière « Réglages avancés » de Rythme. |
| **Plus** (feuille depuis la photo du profil) | Le reste, rangé. | aucun | Stock · E-mails · Tout va bien ? (pastille si un point est rouge) · Ce que VRM a fait · Paramètres · Aide · Communauté · Quoi de neuf · Parrainer (si ouvert) · Se déconnecter. Messages est l'icône de la barre de titre (pastille). | « Tous les écrans » (☰), les entrées de navigation recopiées dans le menu du profil, « Lecture seule », « Cacher les montants » / « Masquer mon nom » (⇒ Apparence), « Appareils connectés » (⇒ Mon compte). |

---

## 3. Ce qui est vraiment utilisé — les chiffres de la production (lecture seule)

### Ce qui est mesuré
L'app envoie depuis le 6 novembre des **temps de chargement par écran** (`/api/compte?mode=mesures`,
`src/mesuresCollecte.js`) : chaque ouverture ou changement d'écran laisse UN compte, anonyme, par écran et par type
d'appareil. C'est la seule mesure d'usage. **13 jours** sont en base (7 → 19 nov., pas 30 : la mesure n'existait pas
avant), **1 239 ouvertures d'écran**, envoyées par **1 à 2 appareils par jour** (4 le 17 nov.) : c'est surtout toi.

| écran | téléphone | ordinateur | total | part |
|---|---|---|---|---|
| Aujourd'hui | 226 | 57 | 283 | 23 % |
| Ventes (+ l'ancien onglet Colis, jusqu'au 16 nov.) | 170 + 68 | 55 + 16 | 309 | 25 % |
| Annonces | 119 | 59 | 178 | 14 % |
| Achats | 100 | 33 | 133 | 11 % |
| Argent (+ Statistiques) | 48 + 12 | 29 + 11 | 100 | 8 % |
| Stock | 18 | 40 | 58 | 5 % |
| Messages | 10 | 43 | 53 | 4 % |
| Paramètres | 36 | 17 | 53 | 4 % |
| E-mails | 9 | 30 | 39 | 3 % |
| Communauté | 8 | 4 | 12 | 1 % |
| À trancher | 1 | 9 | 10 | < 1 % |
| Comptes liés | 7 | 1 | 8 | < 1 % |
| Achats masqués · Litiges | 2 · 1 | 0 | 3 | — |
| Ma semaine · Organisation · Prix du marché · Catalogue · Stock Vinted · Inventaire | 0 | 0 | **0** | — |

Ce que ça dit : **les 5 onglets de la barre font 81 % des ouvertures** ; le téléphone fait 67 % ; Messages se lit à
l'ordinateur (43 contre 10) ; six écrans n'ont **jamais** été ouverts en 13 jours.

### Les traces dans la base (ce que les gestes ont laissé — 8 comptes VRM)
| trace | nombre | ce que ça dit |
|---|---|---|
| comptes VRM avec des données | 4 sur 8 (2 portent presque tout : 594 et 401 articles numérotés) | la moitié des inscrits n'a jamais rien relié |
| prix d'achat posés sur un N° | 17, pour 1 119 articles numérotés (1,5 %) | la saisie ne se fait pas ⇒ le bénéfice est inconnu |
| cases de Stock remplies | 4 (2 meubles, 1 seul compte) | le Stock en étagères n'est pas utilisé |
| prix mini posés (offres automatiques) | 6, 1 compte | le moteur d'offres ne peut presque rien décider |
| mois « J'ai déclaré » | 1 | le registre URSSAF ne sert pas |
| notes sur une paire | 0 | la tuile Note ne sert pas |
| annonces reliées à Leboncoin · eBay | 4 · 1 | publier ailleurs / relier reste marginal |
| « Ma journée » réorganisée · carte de chiffres modifiée | 1 compte · 1 compte | la personnalisation ne sert pas |
| bordereaux marqués imprimés · colis « déposé » · colis « retiré » | 78 · 50 · 23 | le cœur du métier, lui, sert |
| offres traitées | 176 | les offres sont un vrai sujet |
| navigateurs avec l'extension | 6, en 6 versions (5.329 à 5.406) | personne n'a la même extension |
| gestes faits par l'extension aujourd'hui (compteur du jour) | 0 sur les 3 navigateurs qui le publient | baisses, offres aux favoris, messages : rien ne tourne |
| journal « Ce que VRM a fait » (`journal_vrm_*`) | aucune ligne | le journal n'existe pas en base |

### Ce qui n'est PAS mesuré
- **Aucun toucher de bouton** n'est compté : on sait quel écran s'ouvre, pas ce qu'on y fait.
- Les **vues dans un écran** (Republier, Favoris & offres, les segments d'Argent, les catégories de Paramètres), la
  fiche, les feuilles « ⋯ » : pas comptées.
- **Qui** : la mesure est anonyme ; on ne peut pas séparer toi des autres vendeurs (le nombre d'appareils par jour,
  1 à 2, dit que les autres comptent peu).
- Avant le 6 novembre : rien. `vrm_ecrans_vus` ne sert que pour le badge « Nouveau » des comptes neufs (vide ici).

**À ajouter dans la refonte** (un seul compteur, même tuyau, toujours anonyme) : un compte par **geste** (nom fermé :
`imprimer`, `retire`, `baisser`, `republier`, `accepter`, `publier`, `relier`…) et par écran. Sans lui, le prochain
audit devinera encore.

---

## 4. Le verdict, écran par écran

Sortes : **GARDER** · **FUSIONNER** · **DÉPLACER** · **AUTOMATISER** · **RETIRER**. « Banc » = relevé par l'outil sur
l'app rendue ; « code » = lu dans le code et les textes (à confirmer par le relevé complet).

### 4.1 Aujourd'hui — « voir ce que j'ai vendu et ce que je dois porter ou aller chercher »
Relevé au banc (téléphone, base inventée de volume) : **44 éléments à l'ouverture**, et jusqu'à 60 de plus selon ce
qu'on déplie. 23 % des ouvertures.

| élément (libellé relevé) | verdict | pourquoi / où |
|---|---|---|
| Le chiffre du jour, les 7 jours | GARDER | c'est la raison d'ouvrir l'app |
| « Semaine du 9 nov. » / « Revenir aux jours » | RETIRER | deux modes pour le même graphique ; la période se règle dans Argent |
| « Ma semaine › » | RETIRER | 0 ouverture en 13 jours |
| « Voir les ventes (3 ventes) » (la pile) | FUSIONNER | devient le groupe « Dernières ventes » (5 rangées) |
| Bénéfice · Vendu · Reçu du mois | GARDER | groupe « Ce mois » ; toucher ⇒ Argent |
| « Modifier les chiffres de la carte » | RETIRER | 1 compte s'en est servi ; les 3 chiffres sont les bons |
| « À envoyer : 30 » (tuile qui se déplie) + « Ventes » + « 24 autres » | FUSIONNER | un groupe de 3 rangées + « Tout voir » |
| « Imprimer les 15 bordereaux » | AUTOMATISER | il doit imprimer ; aujourd'hui il ouvre Ventes (un toucher pour rien) |
| « Emballer » | RETIRER | un état que le suivi constate ; personne ne coche « emballé » |
| « À retirer : 0 » + « Ouvrir les retraits » | GARDER, sans tuile | le groupe n'existe que s'il y a un colis ; le code est sur la rangée |
| « Messages : 13 » + « Ouvrir Messages » | DÉPLACER | la pastille de l'icône Messages, sur tous les écrans |
| « Prix à baisser : 0 » + « Voir les annonces » | AUTOMATISER | la règle de baisse (n° 4) ; rien à voir ici |
| « 27 colis pressés — À vérifier sur Vinted » | DÉPLACER | Ventes › À régler (et l'ambre sur la rangée) |
| « 146 annonces anciennes et peu vues » · « 855 articles en ligne depuis 30 j ou plus » | DÉPLACER | Annonces › segment « Dorment » (c'est la même liste, dite deux fois) |
| « 24 nouveaux articles numérotés · N°… » | DÉPLACER | Annonces › À régler « N° à écrire » |
| « 1 024 annonces numérotées sans prix d'achat » | AUTOMATISER | n° 2 ; le reste : Argent › « Prix d'achat manquants » |
| « Colis à vérifier — 60 délais dépassés » | DÉPLACER | Achats › À régler |
| « Offre aux favoris » (× 5) | AUTOMATISER | l'automatisation des favoris, allumée une fois (Messages › Favoris) |
| « À venir · 60 ventes · 3 630 € » | DÉPLACER | Argent › « À recevoir » |
| « À ce rythme, novembre finira vers 3 650 € » | DÉPLACER | Argent › Statistiques (une estimation n'a pas sa place en tête) |
| « Tout va bien ? · 2 points » | DÉPLACER | Plus (pastille sur la photo du profil si un point est rouge) |
| « Modifier ma journée » (22 cartes réglables) | RETIRER | 1 compte s'en est servi |
| « Aide : Ma journée » (vidéo, visite, 14 articles) | RETIRER | Plus › Aide |
| En-tête : « Tous les écrans » ☰ · cloche · loupe · profil | FUSIONNER | 2 icônes : Messages, photo du profil ; la recherche est le champ sous le titre ; les notifications sont une rangée de Plus |

Où vont les 34 sortes de lignes d'« À faire » (lues dans le code, `jobs.push`) :
- **Ventes › À régler** : colis-limite, colis-en-retard, poste-sans-depart, retours-vente, retours-vente-revenus,
  litige, double-vente, ebay-ne-pas-poster, vestiaire-envoyer. *(emballer : retiré.)*
- **Achats › À régler** : retrait-dernier-jour, retrait-a-verifier ; **Achats › À mettre en ligne** :
  achats-a-numeroter, atelier-arrivee, atelier-attente.
- **Annonces › À régler** : numeros-en-double (rouge), numeros-nouveaux, numeros-a-donner, numeros-republiee,
  a-confirmer, supprime-vinted, remettre-en-vente ; **Annonces › Dorment** : paires-dorment, quoi-republier.
- **Messages** (pastille) : messages-ebay, vestiaire-messages, vestiaire-offre, vestiaire-offres-reste.
- **Argent › Déclarer** : urssaf, dac7, cloture-annee ; **Argent › Ce mois** : prix-achat-vente, achat-a-relier (ce
  qui reste après le n° 2).
- **Paramètres › Offres et prix** : prix-mini-manquants (le prix mini se demande à la mise en ligne).
- **Plus** : emails-personne (E-mails), inventaire-en-cours (Stock), a-trancher (dissous).

### 4.2 Ventes — « préparer et envoyer mes colis, les suivre jusqu'au paiement »
Relevé au banc (téléphone) : **37 éléments à l'ouverture, 133 avec les feuilles**. 25 % des ouvertures.

| élément | verdict | pourquoi / où |
|---|---|---|
| Segment À envoyer · En route · Toutes | GARDER | « Toutes » devient « Terminées » (ce qui n'est ni à envoyer ni en route) |
| La liste, cases cochées d'office, « Imprimer les N bordereaux » | GARDER | le métier de l'écran, déjà bon |
| Rangée des sites (Tous · Vinted · Leboncoin · eBay) | DÉPLACER | « Filtrer » ; aujourd'hui 4 pastilles permanentes dont 2 « sans compte » |
| « Retrouver un colis » · « Scanner un bordereau » | FUSIONNER | le scanner de la recherche (un seul) |
| « Outils des colis : emballer, générer les bordereaux » | AUTOMATISER | générer un bordereau et prendre son PDF est déjà autorisé et automatique (CLAUDE.md §3) ; le reste est retiré |
| « N°2284 attend son bordereau · + 22 autres » | FUSIONNER | la rangée grisée dit « bordereau en préparation » ; pas de liste à part |
| « Où sont ces articles dans le stock » | FUSIONNER | la place est déjà sur chaque rangée |
| « Les voir » (bordereaux faits) · « Choisir, réimprimer » | DÉPLACER | « Réimprimer » dans la fiche de la vente |
| « Format Classique · A4 » | DÉPLACER | Paramètres › Impression (réglé une fois ; 3 comptes l'ont réglé) |
| « À envoyer : 30 » (carte) + « Modifier les chiffres de la carte » | RETIRER | le même nombre trois fois sur l'écran (segment, carte, barre du bas) |
| « Litiges et retours » | DÉPLACER | « À régler · N » en tête (l'écran Litiges : 1 ouverture) |
| « À venir · 60 ventes… » | DÉPLACER | Argent |
| « Vestiaire : pas encore lu › » | DÉPLACER | Tout va bien ? |
| « Afficher les 60 suivantes » | RETIRER | la liste défile seule |
| « Aide : Ventes » | RETIRER | Plus › Aide |

### 4.3 Annonces — « mes articles en ligne : les trouver, voir comment ils se portent, agir »
Banc : 48 éléments à l'ouverture (56 dans la vue Republier, dont 25 réglages) ; le reste lu dans le code (371 textes). 14 % des ouvertures.

| élément | verdict | pourquoi / où |
|---|---|---|
| La liste (photo, N°, sites, compte, prix, « 40 j · à baisser ») | GARDER | la rangée 72 de la refonte |
| Sélecteur Annonces · Stock (id « Paires ») | RETIRER | deux métiers dans un onglet ; Stock va dans Plus |
| Vues : Toutes · Sélectionner · Republier · Brouillons · À publier · Masquées · Qui dorment · À relancer · Sans numéro · En double… | FUSIONNER | 3 segments (En ligne · À publier · Dorment) + « À régler » ; « Sélectionner » = appui long |
| « Vues rapides » (plus de favoris, plus de vues, vues sans favoris, les plus anciennes), « Trier » | DÉPLACER | « Filtrer » (tri) |
| Rangée des sites + menu du compte + « Gérer les comptes → » | DÉPLACER | « Filtrer » ; les comptes sont dans Paramètres › Mes sites |
| « Numéros à vérifier », « N° à barrer », « Même N° sur deux », « C'est écrit » | FUSIONNER | « À régler » (un N° en double reste le seul rouge) |
| « Annonces sans achat relié », « Choisir un achat », « Suggestion », « Comment VRM suggère un achat » | AUTOMATISER | n° 2 |
| « Baisser », « Changer le prix », « Proposer une remise », « {montant} conseillé », baisses conseillées, baisse en série (Vinted, Leboncoin, Vestiaire, eBay séparés) | AUTOMATISER | la règle de baisse ; à la main : UN geste « Prix » (balayage, fiche) qui change le prix sur tous les sites de la paire |
| Republier (atelier : paires, ordre, espacement, lancer) | GARDER | sa décision du 28 oct. ; il entre par « Dorment » : les paires proposées sont cochées, « Republier N », les réglages restent derrière « Réglages » |
| « Republier à la main », « Brouillons à refaire », « Par VRM / À la main » | FUSIONNER | un seul chemin ; le brouillon raté est une rangée d'« À régler » |
| « Offres automatiques » (Accepter dès / Refuser sous / message) | DÉPLACER | Paramètres › Offres et prix + « Prix mini » dans la fiche |
| « Outils des annonces » (répartir un lot, studio photo, inventaire, audit du stock) | DÉPLACER / RETIRER | voir le tableau §2 |
| « Publier aussi ailleurs », « Relier à Vestiaire », « Aussi sur eBay à… » | FUSIONNER | le groupe « Sites » de la fiche ; en série : sélection multiple ⇒ « Publier ailleurs » |
| « Marquer vendue », « Elle n'est plus là », « Retirer la fiche N° » | DÉPLACER | fiche › « Vendue ailleurs » et « ⋯ » |
| « Passeport », « Histoire · Dupliquer », « Détails et gestes », « Conseils & signalements », « Comment ça marche », « Pourquoi ? », « À quoi il sert » | RETIRER | explications et doublons de la fiche |
| « {x} € qui dorment », bande de chiffres | RETIRER | un chiffre sans geste ; le nombre est dans le segment |

### 4.4 Achats — « aller chercher mes colis et faire entrer les articles en stock »
Banc : 47 éléments à l'ouverture (13 réglages et filtres) ; le reste lu dans le code (374 textes). 11 % des ouvertures.

| élément | verdict | pourquoi / où |
|---|---|---|
| « À retirer » : point relais, code en grand, QR, « J'ai retiré », itinéraire, copier | GARDER | le meilleur écran d'aujourd'hui ; le code passe SUR la rangée (plus de rond « code en grand » à toucher) |
| « Quel achat est dans ce colis ? », « Achat pas encore relié », « Rien ne le relie encore à un colis » | AUTOMATISER | n° 3 : n° de suivi lu par l'extension (`suiviDeTransaction`), code de retrait lu dans l'e-mail |
| « Relier à une vente / annonce », « Relier à une annonce (facultatif) », « Déjà reliés », « Délier » | AUTOMATISER | n° 2 : le lien se fait quand l'achat reçoit son N° ; « Délier » reste dans la fiche (« Acheté » se touche) |
| Atelier « Achat arrivé » en 6 étapes | FUSIONNER | la page « Mettre en ligne » (n° 7) |
| « Prendre le N°… », « N° de rangement (facultatif) », « Étiquette N° » | AUTOMATISER | le N° est donné à « Retiré » ; l'étiquette s'imprime depuis la page |
| En route, Arrivés, Annulés, filtres (compte, mois, marque, taille) | FUSIONNER | segments + « Filtrer » |
| « À renvoyer », bordereau de retour, « Déposé », remboursement à vérifier | DÉPLACER | « À régler » |
| « Ajouter un achat hors plateforme » (ticket lu, facture jointe) | GARDER | « + » de la barre de titre |
| « Masquer cet achat » + écran « Achats masqués » | FUSIONNER | balayage « Masquer » ; un filtre de « Tous » (2 ouvertures de l'écran) |
| « Fournisseurs · Délai · Lots », « Vitesse », « Étapes de tes achats », « Dépensé / Investi / Marge / Revendu combien ? » | DÉPLACER | Argent › Statistiques ; pas dans l'écran qui sert à aller au point relais |
| « Comment retirer un colis ? », « Où est le code », « Pourquoi « à vérifier » », « Pourquoi sur Vinted » | RETIRER | explications |
| « Ton extension VRM est en retard », « Télécharger la … » | DÉPLACER | Tout va bien ? (et la mise à jour automatique, §6) |

### 4.5 Argent — « savoir ce que j'ai gagné et ce que je dois déclarer »
Lu dans le code (723 textes pour la compta + 101 + les suppléments : c'est l'écran le plus chargé en mots). 8 %.

| élément | verdict | pourquoi / où |
|---|---|---|
| Résumé (Vendu · Reçu · Bénéfice), période | GARDER | « Ce mois » ; UNE affiche |
| Statistiques (compte qui vend le mieux, ce qui part vite, boost rentable ?) | DÉPLACER | une page poussée depuis « Ce mois » ; pas un segment |
| Déclarer (URSSAF : montant, taux, fréquence, « J'ai déclaré ») | GARDER | le plein de l'écran ; taux et fréquence ⇒ réglés une fois (Paramètres) |
| Factures (Pro, « Ma facture », envoi) | GARDER | troisième segment |
| « À venir » (argent en attente), prévision de fin de mois | FUSIONNER | `Faits` « À recevoir » ; la prévision dans Statistiques |
| Bilan de fin de mois, clôture d'année, DAC7, alertes de seuils (TVA, plafond) | FUSIONNER | des rangées de « Déclarer », seulement quand elles sont dues |
| « Prix du marché » | RETIRER | 0 ouverture ; « prix conseillé à la mise en ligne » a été refusé le 11 oct. |
| Bénéfice par article, coûts de vente, emballage | FUSIONNER | le bénéfice est sur la fiche ; les coûts : une valeur par défaut dans Paramètres |
| Export pour le comptable, sauvegarde zip | GARDER | une rangée chacune |
| « Coût d'achat · 1/184 renseigné » (la porte) | GARDER | c'est la bonne idée de CLAUDE.md §5 : le chiffre faux ouvre sa réparation |
| Objectif, « Modifier les chiffres » | RETIRER | personnalisation |

### 4.6 La fiche — « tout sur un article, et le geste du moment »
Lu dans le code et `2026-11-15-fiche-d.md` (direction D).

| élément | verdict | pourquoi / où |
|---|---|---|
| Photo, plaque N°, nom, ligne d'état | GARDER | |
| La carte d'action (un plein) | GARDER | sauf « Relie son achat » (n° 2) |
| Segment Argent · Sites · Histoire | FUSIONNER | tout sur la page : `Faits`, groupe « Sites », histoire repliée — c'est ta phrase « cliquer puis les points » |
| « ⋯ » : Note, Photos, Prix, Ailleurs, Dupliquer, Autre taille, Bordereau | DÉPLACER | des rangées de gestes, visibles |
| « ⋯ » : Rappel, Emballer | RETIRER | pas utilisés (0 note, aucun rappel en base) ; les rappels ont été refusés le 11 oct. |
| « ⋯ » : Certificat, Son N°, « Vendu ailleurs », supprimer | GARDER dans « ⋯ » | rare ou destructif (« Vendue ailleurs » remonte en rangée) |
| « Tout voir » (par étape, dans l'ordre, modifications, ce qui n'a pas pu être lu) | FUSIONNER | l'histoire repliée |
| Questions (« Tu l'as encore ? », même photo, à retirer ailleurs) | DÉPLACER | « À régler » d'Annonces ; sur la fiche, une rangée ambre |
| La place : « Étagère A / rangée 5 · case 3 », « Je l'ai sortie » | AUTOMATISER | la place est un `Fait` qui se touche ; « sortie » se constate quand le bordereau est imprimé puis le colis déposé |

### 4.7 Messages — « répondre aux acheteurs et aux offres »
Lu dans le code. 4 % des ouvertures, surtout à l'ordinateur.

| élément | verdict | pourquoi / où |
|---|---|---|
| Conversations par compte, non lues, réponses rapides, dictée, traduction | GARDER | |
| « Proposer N € » (plein) | GARDER | + « Accepter N € » quand une offre attend |
| « Favoris & offres » (section) | FUSIONNER | deux segments : Offres (à répondre) · Favoris (l'automatisation et son état) |
| Envoi aux favoris préparé à la main (sélection, message, pourcentage, intervalle) | AUTOMATISER | allumé une fois (permis le 24 oct., sur sa demande) ; le réglage vit dans Paramètres › Offres et prix |
| Diagnostic des favoris, progression étape par étape | DÉPLACER | Tout va bien ? / « Ce que VRM a fait » |
| Écrans Messages Leboncoin, eBay, Vestiaire | FUSIONNER | « Filtrer » par site |

### 4.8 Stock — « savoir où est chaque article »
Lu dans le code et `2026-11-15-stock-v4.md`. 5 % des ouvertures ; 4 cases remplies dans toute la base.

| élément | verdict | pourquoi / où |
|---|---|---|
| Ranger un article (N° ⇒ case proposée), « Tout ranger » | GARDER | le plein |
| Retrouver par N° (case allumée) | FUSIONNER | la recherche commune ; la place est sur la rangée de résultat |
| Meubles en étagères, Cartons / Rayonnage / Plan, 3 volets, pièce 3D | RETIRER | 4 cases remplies ; une liste groupée par place suffit |
| Teintes, étiquette, densités, « Personnaliser », « La pièce » | RETIRER | personnalisation |
| Organisation (missions, équipe) | RETIRER de l'écran | déjà hors menu (0 ouverture) ; le mode équipe attend la migration 016 |
| Inventaire annuel | GARDER | une rangée |
| « Vendus encore rangés », « La paire à sortir en premier » | AUTOMATISER | la place se libère seule à la vente déposée ; la place à aller chercher est sur la rangée d'« À envoyer » |

### 4.9 Paramètres, E-mails, Communauté, Tout va bien ?
- **Paramètres** (4 %) : 10 catégories et 80 réglages distincts dans le code. Verdict dans le tableau §2 (9 groupes).
  Trois catégories se recouvrent aujourd'hui : « Sécurité et données », « Sécurité des données », « Sécurité des
  comptes » — trois sens du mot « sécurité » (ton compte VRM, tes données, le rythme sur Vinted). Les nouveaux noms :
  **Mon compte**, **Mes données**, **Rythme des comptes**. Le panneau technique « Sécurité des données » (CLAUDE.md
  §5) reste tel quel, derrière « Mes données › Avancé ».
- **E-mails** (3 %, à l'ordinateur) : GARDER dans Plus. C'est un outil de contrôle (« cet e-mail est-il arrivé ? »),
  pas un écran du quotidien : il n'a pas à être dans la navigation principale.
- **Communauté** (1 %) : GARDER dans Plus. Rien à y ajouter tant qu'il y a 4 comptes actifs.
- **Tout va bien ?** : GARDER dans Plus. C'est LE seul endroit des états techniques (extension en retard, compte pas
  relu, e-mails qui n'arrivent pas, site « pas encore lu »). Une pastille sur la photo du profil quand un point est
  rouge. Aucun de ces états ne s'affiche ailleurs.
- **À trancher** (10 ouvertures) : RETIRER. Un écran « des choses que l'app n'a pas su décider » est un aveu, pas un
  métier : chaque doute va dans « À régler » de l'onglet concerné.
- **Catalogue, Stock Vinted, Inventaire (anciens écrans), Organisation, Ma semaine, Prix du marché** : RETIRER
  (0 ouverture ; ne plus les monter).

---

## 5. Les 10 parcours du quotidien — touchers aujourd'hui → cible

Comptés au téléphone, depuis l'app ouverte sur Aujourd'hui. « Aujourd'hui » : relevé au banc quand c'est dit, sinon lu
dans le code (à 1 ou 2 touchers près). Les saisies (un prix, des photos) sont dites à part.

| n° | parcours | aujourd'hui | où ça accroche | cible |
|---|---|---|---|---|
| 1 | Une vente tombe → imprimer le bordereau → déposer | **3 touchers** pour imprimer (banc : « Imprimer » d'Aujourd'hui ouvre Ventes, puis « Imprimer », puis la feuille du téléphone) + 2 à 3 pour dire « déposé » (derrière « … ») | un toucher pour rien ; un bordereau « attend » qu'on le génère ; le dépôt se déclare à la main | **2** (plein d'Aujourd'hui, puis la feuille du téléphone) ; dépôt **0** (le suivi) ; depuis la notification « Vendu » : **1** |
| 2 | Un achat arrive au point relais → code → retirer → numéroter → ranger → mettre en ligne | **≈ 16 touchers** + saisies : tuile, « Ouvrir les retraits », code en grand, « J'ai retiré », puis l'atelier (N° · Case · Photos · Prix · Fiche · Publier), puis publier le brouillon sur Vinted ; parfois « Quel achat est dans ce colis ? » (+2) | 6 étapes pour 2 vraies décisions (les photos, le prix de vente) ; le code demande un toucher ; le N°, le prix d'achat et la place sont connus mais demandés | **≈ 5** + photos + ton prix : balayage « Retiré », « Mettre en ligne », photos, prix, « Publier » |
| 3 | Une offre arrive → accepter / refuser / proposer | **4 à 5** : ☰, Messages, la conversation, « Accepter », confirmer | Messages est à 2 touchers au téléphone ; la notification n'ouvre pas la conversation | **2** (notification ⇒ conversation, plein « Accepter 48 € ») ; **0** si le prix mini est posé |
| 4 | Une paire ne part pas → baisser / republier / relancer les favoris | baisser : **6 à 8** par série (ligne d'Aujourd'hui, Annonces, baisses conseillées, cocher, appliquer, aperçu, confirmer) ; republier : **≈ 6** ; favoris : **5 à 6** | c'est à toi de penser à revenir chaque semaine ; trois chemins différents pour trois gestes proches ; l'onglet Vinted doit être ouvert | baisser : **0** (la règle) ; favoris : **0** (allumé une fois) ; republier : **2** (« Dorment » : paires cochées, « Republier N ») — republier reste TON toucher (décision du 28 oct.) |
| 5 | Publier la même paire sur un autre site | **≈ 7** : la paire, « ⋯ », « Ailleurs », le site, les critères, publier, valider sur le site | caché derrière « ⋯ » ; la catégorie est redemandée | **3** : la paire, rangée « Leboncoin · Publier », confirmer le prix ; **0 de plus** à la mise en ligne (tes sites sont cochés) |
| 6 | Vendue sur un site → la retirer ailleurs | eBay : **0** (retrait automatique, allumé) ; Leboncoin : **3 à 4** (« À retirer ailleurs », la paire, « Supprimer », confirmer) ; Vestiaire : à la main sur le site | la règle change d'un site à l'autre ; rien ne te prévient au bon moment | **1** : la notification « Vendue sur Vinted — la retirer de Leboncoin ? » ⇒ « Retirer ». (Supprimer sur Vinted reste ton toucher — refus tenu ; voir la question §8.) |
| 7 | Retrouver une paire (N°, place) | **3 à 4** : loupe, taper le N°, le résultat, puis Stock pour la place | la place n'est pas sur le résultat ; 4 scanners | **0 toucher + le N°** : le champ est en tête de chaque liste ; la rangée de résultat dit l'état et la place |
| 8 | Savoir combien j'ai gagné ce mois, combien déclarer | gagné : **0** (Aujourd'hui) mais « Bénéfice : pas su » presque toujours ; déclarer : **4** (Argent, Déclarer, le mois, « J'ai déclaré ») | le bénéfice n'existe pas faute de prix d'achat (17 sur 1 119) | gagné : **0**, et vrai (n° 2) ; déclarer : **2** (Argent › Déclarer, plein « J'ai déclaré 1 596 € ») |
| 9 | Un retour ou un litige | **3 à 4** : la ligne d'Aujourd'hui ou Ventes, « Litiges et retours », le litige, puis le geste sur le site | deux listes (Ma journée, Ventes) ; l'écran Litiges à part (1 ouverture) | **3** : Ventes (ou Achats) › « À régler », la rangée, le plein (« Imprimer le bordereau de retour », « Ouvrir le litige ») — un seul endroit par côté |
| 10 | Un nouveau vendeur s'inscrit et relie ses comptes (Leboncoin seul) | **8 étapes** (Bienvenue · Tes sites · Extension · Tes comptes · Numéros · Historique · Ta journée · Abonnement) ; l'extension : un zip, « mode développeur », « charger l'extension non empaquetée » ; puis ouvrir « Mes annonces » sur Leboncoin | l'installation de l'extension est un geste de développeur ; les mots disent Vinted (« Relier mon compte Vinted », « Actions Vinted ») ; 4 inscrits sur 8 n'ont rien relié | **4 étapes** : Tes sites → Installer l'extension (boutique, 2 clics) → « Ouvrir Leboncoin » (l'app répond « 23 annonces lues ») → fini. Numéros donnés seuls, historique importé en fond, abonnement après la première vente vue. |

---

## 6. Ce qui manque

Comparé à ce que font les outils du métier (Vintex, Dotb, Vendoo, List Perfectly, Crosslist — de mémoire, sans les
copier). Rien de ce qui suit n'est dans les refus du 11 octobre ni dans l'automatisation interdite.

1. **L'extension dans la boutique du navigateur** (Chrome, puis Edge / Firefox : `docs/boutiques-extension.md`).
   Installation en 2 clics, mises à jour seules. Aujourd'hui : un zip et le mode développeur ; 6 navigateurs, 6
   versions. C'est le premier mur pour tout vendeur qui n'est pas toi.
2. **L'annonce naît dans VRM, pour tous ses sites.** Une fiche (photos, titre, prix, taille, état) ⇒ publiée sur chaque
   site coché. Les morceaux existent (« Créer sur Vinted », « Publier partout », table des catégories) mais le chemin
   part encore de Vinted. Un vendeur Leboncoin seul doit avoir exactement le même bouton.
3. **Des règles posées une fois** : baisse de prix, offre aux favoris, prix mini par défaut (« achat + 10 % » existe
   déjà comme plancher). Tous les moteurs existent, tous attendent un clic à chaque fois.
4. **Des notifications qui font le geste** : « Vendu — Imprimer », « Offre de 48 € — Accepter / Refuser », « Colis
   arrivé — voir le code », « Vendue sur Vinted — retirer de Leboncoin ». Aujourd'hui une notification ouvre l'app,
   pas le geste.
5. **Le prix d'achat sans saisie** : lu sur le reçu quand l'achat vient d'un site ; demandé UNE fois, au numérotage,
   pour un achat hors plateforme. Sans lui il n'y a ni bénéfice, ni « compte qui vend le mieux », ni règle « jamais
   sous l'achat ».
6. **« Ce que VRM a fait »** : le journal des gestes automatiques (prix baissé, offre acceptée, annonce retirée),
   lisible, avec « Annuler » quand c'est possible. La base n'en contient aucune ligne. Sans lui, automatiser fait peur.
7. **« Annuler » partout** (10 secondes) à la place des confirmations. C'est ce qui rend un outil « pas chiant ».
8. **Le compte des gestes** (§3) : savoir quels boutons servent, pour ne plus jamais refaire cet audit à l'aveugle.
9. **Pouvoir payer** : tant que `public/legal/editeur.js` et le prix Stripe ne sont pas posés, personne ne peut
   s'abonner (geste de Julien, CLAUDE.md §9). Ce n'est pas un écran, mais c'est ce qui manque le plus aux « autres ».
10. **Les autres sites au même niveau que Vinted** : dates de vente et de versement, import de l'historique, achats
    faits ailleurs que sur Vinted (aujourd'hui « hors plateforme », à la main).
11. **Une base vide qui donne envie** : un compte neuf voit des écrans vides et 8 étapes. Chaque écran de la refonte a
    un état `Vide` avec UNE phrase et UN geste (« Ouvre Vinted : tes annonces arrivent ici »).

Non reproposé (refusé le 11 oct.) : imprimer la journée par emplacement, étiquettes QR, prix conseillé à la mise en
ligne, alertes « achat jamais arrivé » et « argent bloqué », rappels de messages et d'évaluations, sauvegarde
hebdomadaire envoyée, widget enrichi, badge « bonne affaire », saisonnalité, photo d'étiquette, acheteurs fidèles.

---

## 7. Les incohérences

### La même notion sous plusieurs mots — le mot à garder
| notion | les mots d'aujourd'hui | le mot unique |
|---|---|---|
| le premier écran | « Aujourd'hui » (barre), « Ma journée » (titre, aide), « Journée » | **Aujourd'hui** |
| l'onglet des annonces | « Annonces » (barre) dont l'identifiant est « Paires », avec Stock dedans | **Annonces** |
| un article | « paire », « article », « annonce », « fiche » | **article** (« paire » si le vendeur a choisi sneakers) ; « annonce » = sa présence sur un site |
| l'envoi | « À envoyer », « À expédier », « à poster », « Colis » (la recherche propose encore « Colis → Tout imprimer » et « Colis → À retirer », un onglet qui n'existe plus — relevé au banc) | **À envoyer** / **À retirer** |
| l'argent | « Argent », « Compta », « Résumé », « Statistiques », « CA vendu », « Vendu », « Reçu », « CA déclaré » | **Argent** ; **Vendu** (date de vente), **Reçu** (date de versement), **À déclarer** |
| les réglages | « Paramètres », « Réglages », « Ma configuration » | **Paramètres** |
| le rangement | « Stock », « Garage », « Organisation », « rangement », « meuble », « case », « emplacement », « place » | **Stock** (l'écran), **place** (où est l'article) |
| relier | 6 sens : achat ↔ vente, achat ↔ colis, annonce ↔ annonce d'un autre site, un compte, une boîte mail, « même photo » | **relier** ne reste que pour un compte ou une boîte mail ; le reste est automatique ou s'appelle « C'est le même article » |
| un rappel | « À faire », « À trancher », « à confirmer », « à vérifier », « à relier », « Tout va bien ? · N points » | **À régler** |
| « on ne sait pas » | « pas su », « — », « lecture… », « pas encore lu », « à confirmer » | **« — »** à l'écran ; la raison dans Tout va bien ? |

### Le même chiffre à deux endroits, avec deux valeurs possibles
- **Les bordereaux** : sur la même base, Aujourd'hui dit « Imprimer les **15** bordereaux », Ventes dit « Imprimer
  les **6** bordereaux », la tuile dit « À envoyer : **30** » et la barre du bas « **30** à faire » (relevé au banc).
  Ce sont trois notions (à envoyer · bordereau prêt · pas encore imprimé) sous un même mot. Cible : la pastille et le
  segment disent « à envoyer » ; le plein dit ce qu'il va imprimer, et c'est le même nombre partout.
- **« Vendu ce mois »** : Aujourd'hui, Ventes (carte), Argent. Une source (`ventesFaites`) mais trois cartes réglables
  qui peuvent montrer une autre période. Cible : pas de carte réglable ⇒ un seul nombre.
- **Les annonces qui dorment** : « 146 annonces anciennes et peu vues » et « 855 articles en ligne depuis 30 j ou
  plus » sur le même écran — deux règles pour une idée. Cible : un seul segment « Dorment », une seule règle.

### Deux chemins (ou plus) pour le même geste
| geste | entrées aujourd'hui | cible |
|---|---|---|
| imprimer un bordereau | Aujourd'hui (qui renvoie à Ventes), Ventes, la fiche, la recherche (« Imprimer les bordereaux du jour »), « Choisir, réimprimer » | Aujourd'hui / Ventes (le lot), la fiche (un seul) |
| scanner | « Retrouver un colis », « Scanner un bordereau », « Scanner un colis » (loupe), disque « + » | le champ de recherche |
| aller à un écran | barre du bas, ☰ « Tous les écrans », menu du profil (les mêmes entrées) | barre + Plus |
| baisser un prix | carte de la fiche, « ⋯ » Prix, série Vinted, série Leboncoin, série Vestiaire, baisses conseillées, tuile d'Aujourd'hui | la règle ; à la main : « Prix » (balayage ou fiche), tous les sites d'un coup |
| relier un achat | fiche, Ventes, Annonces « Sans achat relié », Achats, Ma journée, le scanner | automatique ; « Acheté — » se touche |
| obtenir de l'aide | « ? » de chaque écran, centre d'aide, visite en bulles, vidéos, « Pourquoi ? », conseils, accompagnement | Plus › Aide |
| modifier un écran | « Modifier ma journée », « Modifier les chiffres de la carte » (× 4 écrans), widgets, Stock « Personnaliser » | rien |

### Des réglages que personne ne peut comprendre
- « Sécurité des comptes » / « Discrétion » : plafond du jour, plafond par type, rythme actif / calme, compte neuf
  10 → 50 par heure, « si tu es là », prudence 24 h, offres la nuit 30–120 min. **Cible : un interrupteur « Prudent »**
  (allumé d'office), et le détail derrière « Réglages avancés ». Les garde-fous eux-mêmes ne bougent pas.
- « Mon profil · **Lecture seule** », « Actions Vinted · Lecture seule » (relevé au banc, dans l'en-tête de tous les
  écrans) : un état de l'extension écrit comme un statut du compte. ⇒ Tout va bien ?.
- « Accepter dès », « Refuser sous », « = achat + 10 % (plancher) » : trois seuils pour une idée. **Cible : « Prix
  mini »** sur la fiche (au-dessus : accepter ; en dessous : refuser ou laisser), et une valeur par défaut.
- Trois catégories « Sécurité … » dans Paramètres (§4.9).
- « VRM numérote » / « je numérote moi-même », préfixe, « N° à barrer », « Le carton dit N°… », « Passer au N°… » :
  la numérotation demande 5 réglages et 4 questions. Cible : un choix à l'inscription, puis plus rien (les règles des
  numéros de CLAUDE.md §5 ne changent pas).

---

## 8. Ce que cet audit ne change pas, et les questions pour Julien

Tenus tels quels : les règles d'identité (jamais par ressemblance — le n° de suivi, le code de retrait et le N° sont
des identités, c'est pour ça que les n° 2 et 3 sont permis), les numéros jamais réattribués, « vendue se prouve », le
CA daté au versement, les plafonds de l'extension (50 par heure, une requête à la fois, pause sur 429/403), l'atelier
Republier lancé par lui, aucune suppression automatique sur Vinted, pas de SMS, comptes séparés dans Messages, pas de
violet, rouge = N° en double seulement, rien sur sa clé pour les autres.

Quatre décisions lui reviennent (elles changent une règle qu'il a posée) :
1. **La baisse automatique** (n° 4) : aujourd'hui chaque baisse part de son clic, après un aperçu. Il vient de dire
   « c'est à l'extension de baisser les prix, pas à moi » : on propose une règle posée UNE fois, bornée par le prix
   mini, exécutée dans les plafonds existants (baisses irrégulières, arrêt au premier captcha), avec le journal.
   Éteinte par défaut, comme le moteur d'offres.
2. **Le prix d'achat posé seul** (n° 2) : la règle §2.5 dit « il saisit les prix d'achat lui-même, ne pas les
   deviner ». On ne devine rien : on pose le montant du REÇU de CET achat (son n° de transaction), au moment où
   l'achat reçoit son N° par son geste « Retiré ». Un lot n'est jamais divisé (il le saisit). Est-il d'accord ?
3. **Vendue ailleurs** : sur Vinted, peut-on **masquer** l'annonce seule (réversible) en attendant son toucher
   « Supprimer » ? Ou reste-t-on à 1 toucher depuis la notification ?
4. **Le Stock** : 4 cases remplies. Veut-il garder les étagères dessinées, ou la liste par place suffit-elle ?

---

## 9. La méthode, et ce qui reste à relever

- **L'outil** : `scripts/inventaire-gestes.cjs` (la vraie app, base inventée `_base-messages-stock`, session du banc
  `design-passe`, 390 et 1512, un navigateur, une page). Il ouvre 26 écrans et états, relève chaque élément qui se
  touche (écran, chemin, touchers depuis l'ouverture, libellé, sorte, zone, `data-*`, nombre d'exemplaires), touche
  chaque gabarit une fois et relève ce qui apparaît. Sorties : `docs/design/inventaire-gestes.json` et
  `docs/design/2026-11-19-inventaire-gestes.md`.
- **Relevé au banc** : les 26 écrans, 390 et 1512, à l'ouverture (`PROFONDEUR=0`, 404 s sous verrou) : 1 753 lignes.
  Les plus chargés à l'ouverture au téléphone : À trancher 58, Republier 56, Statistiques 56, E-mails 56, Annonces 48,
  Achats 47, Aujourd'hui 44. Paramètres à l'ordinateur : 96. Avec les feuilles (`PROFONDEUR=1`) : Aujourd'hui et
  Ventes seulement ; à relancer pour les autres (`flock … env PROFONDEUR=2 node scripts/inventaire-gestes.cjs`,
  compter 2 à 7 minutes par écran). ⚠️ La ligne « fiche » (6 éléments) n'est pas fiable : la fiche ne s'est pas
  ouverte sur la base du banc (N° demandé absent) ; « Inventaire (ancien écran) » redirige vers Aujourd'hui.
- **Lu dans le code** : le reste — 3 933 `onClick`, 9 518 textes français, 207 confirmations, 80 réglages, 109 phrases
  d'explication permanentes, 367 fichiers d'écran. Ces nombres disent la taille du tas, pas l'usage.
- **Ce que ni le banc ni le code ne disent** : les états rares (base vide, extension absente, eBay et Vestiaire
  connectés avec des données), et surtout **ce que tu touches vraiment** — d'où le compteur de gestes (§3).
