# Historique — ebay

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> 🔴 **30 octobre — intégration v30 (branche `v30-integ`, poussée sur `claude/project-review-nsk5su`), extension 5.291.0 :**
> réunis par VRAIS merges : `v29-colis` (+ `v29-colis-ext`), `v29-lbc`, `v29-msg-ecrase`, `v29-vinted-ui`, `v29-compta`,
> `v29-ebay-agent`, `v29-ebay-achats`, puis `origin/main` (refonte #917 : trois boutons, textes courts — elle gagne sur la
> forme, les intentions des chantiers sont gardées) et la passation. UN numéro : **5.291.0** (5.288 et 5.290 étaient des
> numéros de branche, jamais servis) — manifeste, `CODE_VERSION`, `EXT_ATTENDUE`, zips, `EXT_CAPACITES.transp` ·
> `.lbcsupprime` · `.lbcstats` (table du §5 complétée). Relecture de l'intégration, corrigé : les gestes AUTOMATIQUES
> (`garde` : moteur d'offres, bordereau de la visite) s'arrêtent à 45 actions, les 5 dernières restent aux clics
> (`audit-compteurs-concurrents` §4) ; `REPUB_LBC_MAX` lié à `LBC_SUPPRIME_MAX_HEURE` (`audit-lbc-supprimer`) ; Mondial
> Relay refusé dit une fois en tête, le bon geste sur un ordinateur sans extension (`transporteurs.cjs`) ; Compta « reçu
> au moins » quand des ventes n'ont pas de date de versement, compteur des déclarations accordé, « Comptabilité » une
> fois ; Stats « Choisir une période », plus de « Total Vinted » ; la case Leboncoin d'Annonces dit son état ; Achats :
> fraîcheur dite une fois, compte d'un groupe uniforme une fois (banc `revue-30oct.cjs` : 16 rouges sur l'avant).
> Rouges connus, présents à l'identique AVANT la fusion : voir `docs/passation/2026-10-30.md`.
> **Gestes de Julien** : installer l'extension **5.291.0** (remplacer le dossier, puis ⟳ dans CHAQUE Chrome) ; sur
> leboncoin.fr, ouvrir « Mes annonces » sur CHACUN de ses comptes Leboncoin (la liste complète fait sortir les annonces
> disparues).

> **29 octobre — ORGANISATION RETIRÉE DU MENU :** Julien : « on ne comprend pas à quoi ça sert, ça doit être utile sinon ça n'a
> rien à faire ici ». **Mesuré (lecture seule, `vrm_operations_v1`)** : en dix jours, UN élément — une recherche eBay préparée,
> jamais lancée (elle reste dans eBay → Achats) — et zéro mission, réservation, lot, consommable, réception ou dossier ; les
> missions supposent une équipe, et la migration 016 n'est pas appliquée. Ce qui l'attend aujourd'hui est Ma journée, ses retours
> sont dans Colis : un écran qui les redirait serait une seconde règle (§11). **Décision : hors du menu** (Gestion au téléphone,
> rail à l'ordinateur) ; l'écran, ses données, `?tab=organisation` et « Mes missions » de l'équipe restent ; on y entre par
> **Réglages → Stock et rangement → Organisation** (`data-reglage-organisation`). Preuves : banc `compta-simple.cjs` section C ;
> `scripts/tests/operations-navigation.cjs` suit le nouveau chemin (rouge sur origin/main). ⚠️ `revendeurs.cjs`, qui porte ce
> test, meurt déjà sur origin/main (« actions quotidiennes en haut », filtres eBay) : le bloc a été prouvé posé au début du banc.
> Geste de Julien : aucun — s'il veut l'écran, Réglages → Stock et rangement → Organisation.

> **29 octobre — L'AGENT eBAY QUI DEMANDE (eBay → « À traiter », section « Agent eBay ») :** Julien : « je veux un agent
> autonome, c'est-à-dire que je veux juste qu'il demande s'il doit poster les articles, que tu puisses lui dire ce que tu veux
> qu'il publie ». L'agent PRÉPARE et PROPOSE, Julien dit oui, il publie — **jamais sans son oui**. Règle pure
> `src/agentEbay.js` (`propositionAgent`, §11) : en ligne, numérotée, pas vendue (toutes plateformes ; « pas su » ⇒ rien, dit),
> pas déjà en vente/programmée sur eBay (SKU, tous comptes), pas déjà en brouillon, pas jumelle, pas « jamais », et **aucune
> des deux paires d'un N° porté deux fois** ; réglages `vrm_agent_ebay_regles` (synchronisé) + une phrase comprise SANS IA,
> montrée avant d'être gardée. La route exige `agent:true` + `confirme:true`, garde les contrôles de « Publier », journalise.
> **Revue du même jour (16 défauts, tous reproduits puis corrigés)** : « N paires **prêtes** » n'est dit (écran, Ma journée,
> notification) que pour des paires PRÉPARÉES chez eBay (`resume.pretes`, `phraseResumeAgent`) — sinon « N paires à
> regarder » ; « **Compléter** » met la paire préparée en UN brouillon et l'ouvre dans le formulaire d'eBay → Annonces ; la
> préparation repart par jeton (plus de lignes figées sur « Je prépare… »), frais gardés 30 min et **refaits chez eBay avant la
> confirmation** s'ils sont plus vieux (écran resté ouvert) ; « par jour » et « + % / € »
> s'enregistrent à la sortie du champ ; un 503 qui dit « rien n'a été envoyé » est un REFUS, jamais « incertaine » ; une
> incertaine (`vrm_agent_ebay_incertains`, synchronisé) ne revient qu'après une relecture d'eBay ≥ 15 min plus tard, avec le
> **même uuid** (la route `publish` accepte `uuid` et confirme un 488 par GetItem/SKU : jamais deux annonces) ; « Programmer
> plutôt » crée des brouillons AVEC id, jamais en double, et la paire sort des propositions ; une négation (« pas »,
> « sauf »…) n'est jamais appliquée à l'envers (rien n'est gardé, c'est dit), les nombres sans règle sont dits, « euros »
> compris ; raisons accordées au nombre ; bilan avec le lien de chaque paire publiée. Décidé : pas d'onglet à part — l'agent est une
> section titrée « Agent eBay » en tête d'« À traiter » (les consignes et la notification le disent).
> **Dernier tour (4 défauts, rouges sur cf5f710b)** : « **Arrêter l'agent** » le fait TAIRE — résumé neutre `{n:0}` au geste
> (aussi sans compte eBay relié ou hors euros, `ETATS_AGENT_MUET`), et Ma journée + la notification lisent les réglages
> (`agentArrete`) : plus de « 3 prêtes » pendant 48 h ; phrase libre : « en 41 à 50 € » = pointure 41 et « 50 » dit non compris
> (plus 19 pointures), « depuis moins de 10 jours » jamais un prix, « Nike, Adidas et Puma » / « les Adidas. » lus ; Réglages →
> Notifications ne promet plus « prêtes ». « Pas su » ne réécrit toujours pas le résumé (un hoquet n'efface rien).
> **Le matin** (`ship-reminders`, `rappelAgentEbay`) : « 🛒 N paires à regarder pour eBay » (ou « prêtes » si préparées),
> préférence `agentebay` (défaut oui), une fois par jour (mémo AVANT), rien si > 48 h, pause du jour, illisible.
> Preuves : `audit-agent-ebay.cjs` (77, **23/23 mutations**, 12 rouges sur cf5f710b ; 24 rouges sur le code relu, tout rouge sur origin/main) ;
> `audit-ebay-route.cjs` [R-agent] (3 rouges sur le code relu : UUID, 488) ; banc `ebay-agent.cjs` (390 tactile + 1512 sombre,
> faux eBay, scénarios A-N, 152 contrôles, 12 rouges sur le build de cf5f710b) ; banc `agent-ebay-push.cjs` (vraie route, 21). ⚠️ **Non mesuré** : aucun appel réel
> à eBay (pubinfo, pubverify, publish, 488 : formes de la doc) ; le délai réel avant qu'eBay montre une annonce créée (15 min
> est un choix). **Gestes de Julien** : eBay → À traiter, régler « Ce que je publie » (ou écrire ce qu'il VEUT), puis dire oui.

> **29 octobre — eBay → Achats : CHERCHER, et un FIL (sa demande : « le côté achat ne sert à rien ; fais la recherche
> comme pour Vinted, avec un feed ; tout dépend si ça utilise beaucoup de données ») :** action `chercher` d'`api/ebay.js`
> (toujours 12 fonctions ; logique `api/_lib/ebay-recherche.js`) : API Browse `item_summary/search`, EBAY_FR, jeton
> D'APPLICATION (`jetonApplication`, client_credentials — jamais celui du vendeur, aucun compte eBay relié nécessaire),
> session exigée (401), 30 annonces, plus récentes d'abord, filtres achat immédiat · livrable en France · état · prix max ;
> le budget se juge PORT COMPRIS (port « calculé » = inconnu, jamais gratuit), mots exclus, photo `i.ebayimg.com` seule.
> Plafond VRM **200 recherches/jour/vendeur** (`ebay_tokens_recherches_jour`, compté AVANT l'appel, compare-et-échange ;
> illisible ⇒ 503, rien ne part ; atteint ⇒ 429, le fil s'arrête et le dit). Plafond d'eBay : 5 000/jour pour TOUTE
> l'application (doc d'eBay, non mesuré) — le restant réel est rendu si eBay le dit (`rate_limit`). Octets reçus
> d'eBay / envoyés à l'appareil mesurés et affichés. eBay muet ou illisible ⇒ 502 « pas pu chercher », jamais « aucun
> résultat ». **Le fil = les « veilles » de l'espace Organisation (§11, la même liste)**, 10 actives au plus (`metier.js`
> refuse la 11ᵉ ; mesuré : 1 veille en base), + pointure / achat immédiat / livraison en France (défauts pour une
> recherche d'avant). Relu à l'ouverture de l'onglet puis au plus toutes les 15 min, page visible, une à une ; « nouveau »
> par itemId depuis la dernière visite (cet appareil). Repère du MODÈLE (`moyennesParModele` sur ses ventes, ≥ 3), dit
> « le modèle, pas cette paire ». Rien n'est acheté : « Voir sur eBay ↗ ». Les achats gagnés (WonList) restent, repliés,
> lus à l'ouverture seulement. Preuves : `audit-ebay-recherche.cjs` (43 ; **31 rouges sur origin/main** ; 7 mutations
> rouges) · banc `ebay-achats-recherche.cjs` (390 tactile + 1512 sombre ; **18 rouges sur le build d'origin/main** ;
> mutations « relecture sans borne » et « tout est nouveau » rouges). La borne des 15 min se juge sur l'horloge de
> l'APPAREIL (heure d'arrivée de la réponse), jamais sur `lueA` du serveur : un téléphone en avance relisait à chaque
> minute (banc : serveur à +2 h ⇒ rouge sur le code d'avant) ; le banc ne franchit plus minuit (heure de Paris). ⚠️ **Non mesuré** : aucun appel réel à eBay
> (formes de la doc Browse/OAuth/Analytics) ; la pointure part dans les mots-clés (« 42.5 »). **Geste de Julien** : rien —
> l'onglet marche avec les clés eBay déjà posées.
> **Revue du 30 oct. (12 défauts reproduits, corrigés) :** un ÉCHEC attend comme une lecture — rien avant 15 min (le fil
> relançait chaque minute et vidait les 200 du jour en ~20 min de panne d'eBay) ; une panne commune (eBay, session,
> compteur) arrête tout le fil et se dit UNE fois ; critères refusés (400) jamais relancés avant une modification.
> Le compteur vit sous `ebay_tokens…` : la garde de la base (`vrm_garde_ebay_tokens`, préfixe, lue en production) refuse
> qu'un navigateur le crée, le réécrive ou l'efface (sous l'ancien id, un vendeur effaçait sa ligne et repartait de zéro).
> Un appel parti chez eBay compte même raté (il compte aussi chez eBay) — décidé. Une règle de critères
> (`erreurCriteresEbay`, metier.js) pour Organisation ET la route ; « Dans le fil » / « Hors du fil » par la même règle
> que le fil (`veillesDuFil`). 390 px : grille propre (contenu 84 → 262 px). Repère : une fois au-dessus d'une liste
> homogène, jamais sur une clé générique (air max, dunk, blazer, forum, chuck), un accessoire ou une taille enfant.
> « Aucune annonce gardée : eBay en avait N » ; « Ajouter au fil » sans second appel ; espace illisible : une phrase,
> un « Réessayer » ; pastille lisible en sombre ; total du jour en Ko sur cet appareil. Preuves : audit (49 ; 2 rouges
> sur 773e7c6e, mutations id/critères rouges) · banc (**40 rouges sur le build de 773e7c6e** ; mutations recul, repère,
> grille rouges). Sur origin/main la fonction n'existe pas (audit : 35 rouges). Bancs eBay voisins verts ; `ebay-form`
> sort 1 rouge (« Julien ne paie jamais le port ») déjà sur origin/main. ⚠️ Non mesuré : aucun appel réel à eBay.
> **Dernier tour (chantier du 29 oct., revue du 30) — six défauts reproduits, corrigés :** (1) le repère se décide sur les
> SEULES lignes qui en ont un (`reperesDeListe`) : « Voir les 21 » avec des lacets le disait 20 fois ⇒ une fois au-dessus,
> « pour les paires de ce modèle » ; sur la ligne seulement quand deux modèles se côtoient. (2) Un 401 isolé (jeton expiré
> au réveil) ne fige plus le fil 15 min : la session est attendue/renouvelée (`SESSION_FIL_EBAY` : `authValid`,
> `authRefresh`) puis UN nouvel essai ; « reconnecte-toi » seulement si le renouvellement est REFUSÉ ou qu'un second 401
> suit un renouvellement réussi ; « pas su » ⇒ nouvel essai dans 1 min. (3) Une recherche enregistrée avant la règle
> commune (catégorie « baskets ») se CORRIGE : `veille.modifier` ne revalide plus l'ancienne (instantané brut pour
> l'historique) ; `veille.dupliquer` dit « modifie-la d'abord ». (4) Une PART du plafond est gardée pour la main : le fil
> (`source:'fil'`) s'arrête à **150** relectures/jour (429 `plafond-fil`), les 50 restantes ne servent qu'à « Chercher »
> (le fil vidait seul les 200 en ~5 h 30 et grisait « Chercher » jusqu'à minuit) ; l'écran dit « dont N par le fil ».
> (5) `extractModel` : un modèle qui finit par un chiffre ne se lit plus dans un nombre plus long (« air max 1 » ≠
> « air max 180 / 1000 », « xt 6 » ≠ « xt 60 ») — vaut aussi côté ventes. (6) Achats gagnés : titre dit une fois
> (`EbayAchats sansTitre`). Preuves : audit (59 ; **8 rouges sur 7cd0cbec** ; mutations part du fil, ancienne revalidée,
> sous-chaîne rouges) · banc (**20 rouges sur le build de 7cd0cbec**, 0 après ; mutations des quatre correctifs d'écran
> rouges). ⚠️ Non mesuré : aucun appel réel à eBay ; le renouvellement réel au réveil d'un iPhone (formes du banc).

> **28 octobre (nuit, fin) — STOCK : un article une fois, et les articles de TOUTES les plateformes :** Julien
> (« les deux ») : (1) une paire sur Vinted, Leboncoin et eBay n'apparaît qu'UNE fois dans « À ranger » — même N° (clé)
> ou même PHOTO EXACTE (deux fiches = une paire, l'autre N° dit à côté ; l'une rangée ⇒ aucune proposée) :
> `unParArticle` (stockRegles.js), 3D, « Mes meubles », En photos ; (2) une paire en vente SEULEMENT sur eBay (SKU
> `numEbayLu`) ou Leboncoin (`numeroLbcIdentite`, annonce en vente `annonceLbcEnVente`) est présente :
> `articlesAutresPlateformes`, publiée avec la liste `vinted_nums_physiques` (`autres`, `sansNumero`), jamais un N°
> dont la vente Vinted est prouvée et le colis parti ; Vinted pas lu ⇒ rien publié. Une annonce sans N° n'est pas
> proposée. Preuve : banc `stock-plateformes.cjs` (10 rouges sur l'avant ; mutations « autres vidés » 8, « sans
> garde vendue + sans photo » rouges). ⚠️ Non mesuré : sa vraie base.

> **28 octobre — la bonne catégorie sur chaque plateforme, Vestiaire en « smart listing », eBay publié en un clic (5.245) :**
> Julien : « Vestiaire avec le smart listing », « la catégorie doit correspondre à celle de la plateforme »,
> « eBay : j'appuie sur publier, l'annonce se publie toute seule avec les critères et la description ».
> UNE règle `familleArticle` (bloc partagé `<annonce-lbc-regle>`, app = extension) : chemin du catalogue
> Vinted (`catalog_id` → `vinted_catalogue`, désormais gardé dans `articleMaigre`), puis titre, pointure,
> description ; le GENRE ne vient QUE du chemin Vinted (jamais du titre). Leboncoin : catégories MESURÉES
> (fdata ; « Sacs à main » n'existait pas ⇒ « Accessoires & Bagagerie », enfant ⇒ rubriques Famille),
> `choisirCategorie` ne clique qu'un libellé EXACT. Vestiaire (`categorieVcDe` sur `vc_catalogue`) :
> univers Femme/Homme seulement si le genre est su, sous-catégorie vérifiée dans le catalogue, sinon laissée
> à lui et DITE ; `vc-depot.js` suit le smart listing (photos d'abord), avance par « Continuer » seulement,
> jamais « Publier », et relève boutons et titres de chaque étape (`panel_vc_form`). eBay : bouton
> « Publier » par article (`data-publier-un-clic`) ⇒ analyse, critères remplis par des FAITS de Vinted
> (marque, pointure, couleur, Département d'après la catégorie Vinted, Type), vérification à blanc, UNE
> confirmation qui dit tout, puis publication ; critère obligatoire inconnu ⇒ rien ne part, il est nommé.
> Preuves : `audit-categories-plateformes.cjs` (22 ; « Sacs à main » remis ⇒ 3 rouges), banc
> `ebay-un-clic.cjs` (14). ⚠️ Non mesuré : les écrans du smart listing après les photos, le vrai Vestiaire.
> Geste : installer la 5.245, rouvrir son dressing Vinted (le `catalog_id` y est capté, donc le genre).

> **27 octobre — Vestiaire Collective depuis VRM (5.235) :** Julien : « je veux pouvoir le faire
> sur VRM directement, pouvoir publier ». Écran Vestiaire → « Mettre une paire en vente » : les paires
> en ligne et numérotées (`useEbayPaires`, §11), « Préparer sur Vestiaire » (`vcPreparer`, l'id SEUL)
> et « Déjà publiée » (`vcMarque` → `vinted_vc_posted`). L'extension (`publierVestiaire`) relit la paire
> (en ligne, N°, jamais prouvée vendue — illisible ⇒ refus —, ni retirée du stock, ni déjà notée),
> ouvre `fr.vestiairecollective.com/sell-clothes-online/` (⚠️ adresse NON mesurée) ; `vc-depot.js`,
> copie d'`ebay.js`, attend le formulaire DANS CET onglet seulement, remplit description (avec VRM-{n°}),
> prix, état/marque/taille/couleur au libellé EXACT, attache SES photos (Photoroom si sa clé est posée),
> relève la structure (`panel_vc_form`, jamais une valeur). **Aucun clic « Publier »** : le formulaire
> n'a jamais été vu. Ventes Vestiaire toujours pas captées (rien vu : listes vides au relevé du 26).
> `audit-vc-publier.cjs` (29, vrai background.js + vrai vc-depot.js dans Chromium ; mutations onglet,
> photos, vendue, état ⇒ rouges), banc `vc-publier.cjs` (390/1512 ; liste non filtrée ⇒ 6 rouges).

> **27 octobre — même chose pour Leboncoin et eBay :** une vente Leboncoin reliée PAR IDENTITÉ
> (`numeroLbcIdentite` : lien posé à la main ou référence VRM) et dite partie (`lbcExpediee` ou
> `lbcFinalisee`, jamais annulée), ou une commande eBay « Expédiée » (`etatCommandeEbay`, SKU
> `numLigneEbay`, engagée) libèrent aussi leur place. Un N° encore à poster sur N'IMPORTE quelle
> plateforme reste ; Leboncoin ou eBay pas lus ⇒ cette plateforme ne retire rien. La liste dit la
> plateforme (« eBay : Expédiée »). Corrigé au passage : `save` écrit 500 ms plus tard, deux
> passages rapprochés s'effaçaient le journal ⇒ `saveTout` écrit tout de suite. Banc
> `stock-partis.cjs` : 8 rouges sur main, 4 sous mutation (« parti » ignoré sur Leboncoin et eBay).

> **27 octobre — le pavé numérique sur Ventes et Colis (Vinted) :** même saisie que Leboncoin et
> eBay (`SaisieNumeroPlateforme`). Ventes : N° + Entrée montre SA vente (le N° de la ligne,
> `effEntry`) ; cachée par un filtre, une recherche, la période, « masquées » ou au-delà des
> 60 premières ⇒ remontrée (annulée ⇒ « Annulées »). Colis : son colis (`numForBord`, sinon la
> fiche), un colis marqué « posté » est remontré, un colis eBay à poster aussi ; une vente pas à
> envoyer dit son état. Lecture seule. Au passage : « Générer le bordereau » grisé débordait sur
> « J'ai le PDF » à 1512 px (déjà en ligne) — il revient à la ligne dans sa colonne. Banc
> `pave-vinted.cjs` : 16 rouges sur main, 19 verts après ; filtres non levés ⇒ 3 rouges.

> **27 octobre — le pavé numérique sur Leboncoin et eBay :** comme sur le Stock, sur ordinateur
> un chiffre tapé n'importe où dans l'espace Leboncoin ou eBay ouvre la saisie (sous les onglets,
> `SaisieNumeroPlateforme`, `data-num-plat`) ; N° + Entrée MONTRE la paire, en lecture seule, par
> identité seulement (§5) : Leboncoin = vente (`numeroLbcIdentite`), sinon annonce en ligne, sinon
> la carte « à publier » ; eBay = commande (`numLigneEbay`), sinon annonce (`numEbayLu`, recherche
> « n°X »). Rien trouvé ⇒ dit. Écoute en CAPTURE (sinon ← → de la coque changeait de site avec
> Verr Num éteint : `e.code` `Numpad4`), jamais dans un champ ni une feuille ouverte ; Échap la
> vide ; rien sur téléphone. Banc `pave-plateformes.cjs` : 12 rouges sur main, 16 verts après ;
> mutation (sans capture ni conversion) 5 rouges.

> **27 octobre — Leboncoin et eBay, même traitement (« fais pareil ») :** comme l'espace
> Vinted : une vente dit quand / par quoi sous son titre (Leboncoin : date de VENTE relevée,
> jamais l'heure de capture, et le transporteur ; eBay : date de commande, et le compte s'il y
> en a plusieurs) ; « à envoyer » (règle de l'onglet Colis) et « À expédier » en ambre
> (`data-ton="action"`), l'état eBay n'est plus coupé (« À expédiei ») ; « Mes vues » au bout
> de la ligne des filtres (`vrm-ventes-filtres-ligne`, pleine largeur seulement déplié) ; plus
> de « N commandes affichées » ; le diagnostic Leboncoin en BAS de l'espace (`data-diag-lbc`) ;
> plus de second titre « Achats Leboncoin » ; « Tes priorités du moment », « État de l'annonce
> et suivi », « touche une annonce pour la modifier » retirés ; les explications (code de
> retrait, titre publié, états des annonces, rafraîchir les ventes) repliées derrière ⓘ. Banc
> `plateformes-premium.cjs` : 26 rouges sur main, 176 verts après.

> **26 octobre — annonces d'un compte bloqué, bancs :** Comptes liés → un compte →
> « Supprimer ce compte » → « Retirer ses annonces pour de bon » (`vrm_annonces_retirees`,
> synchronisé) : ses annonces sortent d'Annonces, des totaux et des files Leboncoin/eBay ;
> ses ventes restent. « Les remettre » annule. Banc `annonces-retirees.cjs`. Navigateur des
> bancs : `/opt/pw-browsers/chromium` (lien stable).

### eBay : deuxième place, même modèle — et le défaut d'eBay est **NON**
Julien a confirmé le 12 septembre : « **j'ai les deux** » (compte particulier ET
professionnel). L'assistant eBay est donc livré sur le modèle de Leboncoin :
`ebay.js` tourne sur **ebay.fr**, liste les paires cochées, télécharge les
photos, copie le texte, ouvre le formulaire de mise en vente et remplit les
champs qu'il **reconnaît**. Aucune publication automatique.
- ⚠️ **Le défaut d'eBay est `false`, et ce n'est pas une symétrie ratée.**
  Leboncoin vaut « oui » parce que sa file existait AVANT la sélection et qu'on
  ne l'éteint pas dans son dos ; eBay n'a jamais rien préparé, donc cocher à sa
  place mettrait 44 annonces dans une file qu'il n'a pas demandée.
- Le titre monte à **80 caractères** (50 sur Leboncoin) et la référence
  `VRM-{n°}` va dans le champ **SKU** du compte pro — c'est ce qui permettra de
  reconnaître l'annonce plus tard **sans rapprochement par titre** (§5).
- **Aucune catégorie n'est devinée** : eBay la propose à partir du titre, et une
  catégorie fausse ferait plus de mal que pas de catégorie du tout.
- ⚠️⚠️ **JE N'AI JAMAIS VU LE FORMULAIRE eBAY, ET LE CODE LE DIT.** Le bandeau
  annonce **combien de champs ont été remplis** — s'il dit 0, rien n'a été
  reconnu et il le voit tout de suite (le texte complet est dans son
  presse-papier, les photos dans `VRM-{n°}`). Et l'extension me **rapporte la
  structure du formulaire** (`panel_ebay_form` : noms de champs, aucun contenu)
  pour que le prochain passage vise juste. *Mesurer d'abord* appliqué à ce que
  je ne peux pas mesurer moi-même : on fait mesurer par ce qui y a accès.
  **Ne pas écrire « ton annonce est prête » — écrire le chiffre.**
- ⚠️⚠️ **CETTE LIGNE DISAIT L'INVERSE, ET ELLE ÉTAIT FAUSSE** : « les photos ne
  peuvent pas être injectées, un navigateur interdit de remplir un champ fichier
  par programme ». **Mesuré le 13 septembre dans Chromium** : ce qui est interdit
  c'est `input.value = '/chemin/photo.jpg'` ; **`input.files =
  dataTransfer.files` marche**. Je l'ai écrit deux fois dans ce dossier sans
  jamais l'avoir essayé. *Une impossibilité qu'on n'a pas mesurée est une
  opinion.* **Reporté sur eBay le 13 septembre** — voir la section suivante.
- `EXT_CAPACITES.ebay = '5.55.0'`, et `audit-places.cjs` couvre les deux places.
  ⚠️ Son premier jet **mourait** sur le code d'avant (`buildEbayData` n'existe
  pas → `TypeError`), donc les contrôles suivants n'étaient jamais rendus : *un
  audit ne meurt pas, il rapporte*.
- ⚠️⚠️ **ET `ebay.js` N'AVAIT JAMAIS TOURNÉ.** `node --check` ne lit que la
  syntaxe : un sélecteur qui ne trouve rien, un panneau qui ne s'ouvre pas, un
  `null` déréférencé — rien de tout ça ne se voit sans **exécuter le script dans
  une page**. C'est §4.10 (« une fonction serverless n'est vérifiée que si un
  banc l'EXÉCUTE ») appliqué à un script de contenu. Le banc `ebay.cjs` sert une
  fausse page de mise en vente et le charge pour de vrai : **14 contrôles**.
- ⚠️ **Ce que j'ai mesuré sur la vraie page d'eBay** (`curl` — le navigateur du
  banc n'y accède pas) : le formulaire de mise en vente est **derrière la
  connexion**, donc toujours invisible d'ici. Ce qui EST visible, c'est
  l'en-tête : la barre de recherche est un `<input name="_nkw" id="gh-ac">`
  **vide, sur toutes les pages**. Avec les motifs actuels elle n'est **pas**
  atteignable (aucun ne correspond à « Rechercher sur eBay ») — ce n'était donc
  pas un défaut vivant. Mais élargir un motif un jour suffirait : la garde
  `DANS_ENTETE` écarte en-tête, pied de page et recherche, et le banc **passe
  au rouge** si on la retire (prouvé : le titre de l'annonce atterrit dans la
  barre de recherche, et le bandeau annonce « 1 champ rempli » sur une page où
  il n'a rien rempli d'utile). *Une précaution, pas une découverte.*


### ⚠️⚠️ ET eBAY N'AVAIT APPRIS AUCUNE DES LEÇONS DE LEBONCOIN
Les deux assistants sont livrés « sur le même modèle », et c'est précisément ce
qui rend le piège invisible : **les six défauts mesurés et corrigés sur Leboncoin
le 13 septembre étaient tous entiers dans eBay**, côte à côte, dans un fichier
que personne ne relisait parce qu'il était déjà « fait ». *Un correctif « sur le
modèle de » n'est pas un correctif appliqué aux deux.*

**Mesuré avant de coder** (le VRAI `buildEbayAd` exécuté sur la vraie base, file
eBay vide aujourd'hui — on mesure donc ce qui arrive **le jour où il coche**) :

1. ⚠️⚠️ **14 DE SES 53 ANNONCES EN LIGNE ET NUMÉROTÉES SONT PROUVÉES VENDUES**, et
   `buildEbayData` ne filtrait que sur `is_closed`. Exactement sa plainte du
   13 septembre (« des paires qui sont vendues »), corrigée pour Leboncoin le
   jour même. **Sur eBay c'est plus coûteux encore** : une vente y engage une
   expédition qu'il ne peut pas faire. La preuve (`transaction → item_id`, §5)
   **prime sur l'état de l'annonce**, et le panneau **dit combien** il écarte —
   une file qui rétrécit sans explication se lit comme une perte.
   ⚠️ Et l'absence de preuve n'est pas une preuve : sans **aucune** transaction
   captée, rien n'est écarté (le banc le vérifie — sinon une lecture vide
   viderait sa file, « rien lu » ne vaut pas « rien »).
2. **18 titres sur 53 sortaient avec la marque écrite deux fois** — « Nike nike
   shox tl », « Salomon salomon XT-6 » — et **51 sur 53** en « taille 42 » au
   lieu de « T42 ». `buildEbayAd` recollait `[marque, titre].join(' ')` puis
   `.slice(0, 80)` : **une seconde règle de titre**, avec le défaut que
   `lbcTitre` corrigeait juste à côté. Le plafond est devenu un **paramètre**
   (§11 : une notion, une règle, un propriétaire) — 50 pour Leboncoin, 80 pour
   eBay, la même règle pour les deux.
3. ⚠️⚠️ **LES PHOTOS ÉTAIENT TÉLÉCHARGÉES SUR SON DISQUE** (« ça me fait
   télécharger des photos dans mon ordi »), et le fichier affirmait toujours
   l'impossibilité mesurée fausse. Elles s'attachent. **0 téléchargement,
   3 photos attachées** au banc.
4. **Les listes déroulantes n'étaient même pas REGARDÉES** : `champ()` ne lit que
   `input`/`textarea`. C'est mot pour mot « ça ne met pas la catégorie ni le
   reste ». L'**état**, la **marque** et la **pointure** sont choisis —
   ⚠️ **jamais la CATÉGORIE** : eBay la propose à partir du titre et se trompe
   moins que moi, qui n'ai jamais vu son arbre. Le banc **exige** qu'elle reste
   vide : le jour où quelqu'un « complète la symétrie » avec Leboncoin, il passe
   au rouge.
5. ⚠️⚠️ **« Titre copié » SANS RIEN COPIER**, et ici c'était pire qu'ailleurs :
   `copy()` n'avait **aucun repli**. Une promesse rejetée ne passe pas par
   `catch`. Prouvé au banc sur le code d'avant : le presse-papier reste vide,
   deux `NotAllowed` non gérés, et le panneau annonce « Référence copiée :
   VRM-101 » — la référence est le seul filet quand le formulaire n'a pas de
   champ pour elle.
6. **L'arrêt au bout de 90 s se faisait en silence**, et `panel_ebay_form` était
   **écrasée à chaque passage** : la dernière étape vue effaçait la seule que
   j'avais. Toutes les étapes sont gardées par signature (comme
   `lbc_recon.etapes`), et le bandeau dit que c'est fini avec un
   « Re-remplir » qui **relance** la surveillance.

- `scripts/bancs/ebay.cjs` : **35 contrôles, 16 échecs sur le code d'avant**.
  `audit-places.cjs` : **4 échecs** de plus (vente prouvée, compte rendu, marque
  doublée, règle de titre unique).
- ⚠️ **ONZIÈME ET DOUZIÈME FOIS QU'UN DE MES CONTRÔLES CRIE AU LOUP**, et les deux
  sont des récidives nommées dans ce dossier : (1) j'interdisais le MOT
  « télécharg », et il attrapait la phrase **honnête** que je venais d'écrire
  (« rien n'est téléchargé sur ton ordinateur ») — ce qui est interdit est
  l'**instruction** d'aller chercher un dossier sur son disque ; (2)
  `audit-places.cjs` exigeait la signature exacte `(brand, base, size)` et
  tombait au rouge quand le plafond est devenu un paramètre — la fonction était
  **mieux partagée** qu'avant. *Un audit suit la RÈGLE, pas son orthographe.*
- ⚠️ **Et le banc MOURAIT sur le code d'avant** (un `click` sur un bouton
  inexistant expire à 30 s), donc deux blocs entiers n'étaient jamais rendus et
  je ne voyais que 10 échecs sur 16. *Un banc ne meurt pas, il rapporte* — même
  erreur que le premier jet d'`audit-places.cjs`.
- ⚠️ **La phrase de l'app était restée en arrière** : l'écran Annonces promettait
  « photos téléchargées » pour les deux places. Elle suit maintenant la version
  INSTALLÉE, place par place (`capPhotos`).
  ⚠️⚠️ **Et je n'en avais corrigé QU'UN des deux.** En balayant « télécharg » sur
  tout le dépôt : l'**écran Leboncoin** portait la même affirmation
  (« bouton 🚀 Tout préparer : photos téléchargées, texte copié, formulaire
  pré-rempli »), sans **aucune** garde de version. *Une suppression « terminée »
  se vérifie sur ce qui RESTE* — c'est la leçon du pipeline Factures, refaite le
  jour même, à une heure d'intervalle.
  ⇒ `audit-coherence.cjs` porte désormais la règle, dans la forme acceptée de
  `panne.cjs` : **toute phrase qui affirme ce que l'extension fait des photos
  doit avoir une garde de version dans son voisinage immédiat**. Interdire le
  *mot* attraperait la phrase honnête ; c'est la GARDE qui est exigée. **Rouge
  sur le code d'avant**, et il nomme la ligne.
  ⚠️ **TREIZIÈME fois qu'un de mes contrôles crie au loup**, et la récidive
  exacte du balayage des sondes : il s'est déclenché sur **mon propre
  commentaire**, celui qui cite la phrase d'avant pour expliquer pourquoi elle
  est partie. Retirer les lignes qui *commencent* par `//` ne suffit pas — un
  bloc `/* … */` de dix lignes n'en a aucune. Les blocs sont neutralisés en
  gardant les retours à la ligne, pour que les numéros signalés restent ceux du
  fichier.
- ⚠️ Et un **commentaire** de `lbc.js` répétait encore l'impossibilité fausse,
  quinze lignes au-dessus du code qui attache les photos. *Une suppression
  « terminée » se vérifie sur ce qui RESTE, commentaires compris* : un
  commentaire faux se relit comme une règle.


### ⚠️⚠️ « UN TOUT PETIT ÉCRAN EN BAS À DROITE, LE LOGO DE L'APP » (3 octobre, 5.130)
Julien : « sur Vinted, Leboncoin, eBay, peu importe où, le nouveau logo en bas à
droite ; enlève l'ancien orange ; il ne doit pas y avoir d'informations autres
que les moyens de connexion, le compte utilisé, le compte connecté et si les
informations circulent bien ; tout doit être centralisé dans VRM ; dès que tu
appuies dessus, le site VRM s'ouvre ».
- **`vrm-badge.js`** sur Vinted, Leboncoin, eBay **et Vestiaire** : le logo de
  l'app (`logo-vrm-96.png`), shadow root FERMÉE. Survol : compte VRM utilisé,
  compte du site (cookie Vinted / dernier compte « moi » Leboncoin), et la
  circulation **mesurée aux écritures** (`vrmFlux`, `noterFlux`) — jamais
  supposée. Clic : connecté → VRM s'ouvre sur l'onglet de la plateforme ; sinon
  la connexion. Ambre **seulement** s'il y a un geste à faire ; « pas su » reste
  gris (aucun faux vert). Vestiaire : « VRM ne capte pas encore ce site ».
- ⚠️⚠️ **LE MOT DE PASSE VRM SE TAPAIT DANS LE DOM DE VINTED** (bulle du
  panneau, sans shadow root : les scripts du site pouvaient le lire). La
  connexion vit désormais dans un **iframe de l'extension**
  (`popup.html?mode=carte`) : ni le champ ni le clavier ne sont visibles du site.
- ⚠️ **L'email du compte VRM se perdait au premier renouvellement** de session :
  gardé, sinon lu dans la revendication `email` du JWT (une identité).
- ⚠️ **Une session VRM d'un autre compte adoptée dans ce Chrome** (mesuré le
  2 oct. : 18 lignes, dont 3 bordereaux, parties chez `julien.fournier3535@…`)
  est notée (`vrmBascule`) et la carte nomme **les deux** adresses pendant 7 j.
- **Panneaux retirés** : `vinted-panel.js` → `vinted-capture.js` (date,
  description, photos lues sur la page — la seule chose que rien d'autre ne
  faisait) ; `lbc.js` et `ebay.js` gardent relais, capture, enregistreur
  d'étapes, remplissage, publication sans booster (LBC) et leur bandeau de
  dépôt. ~1 600 lignes sans appelant retirées du fond (`buildPanelData`, récap
  plein écran, réglages du panneau).
- **Ce qui est passé dans l'app** : ~~l'interrupteur « accepter les offres
  au-dessus du plancher »~~ (⛔ retiré le 5 octobre avec l'acceptation
  automatique, voir §3 ; `vinted_offres_auto` reste synchronisé à `false` pour
  les extensions 5.130 à 5.150) ; le bouton **« Publier sur Leboncoin »** / « Préparer sur eBay »
  par paire (`publierDepuisApp` : l'app n'envoie qu'un IDENTIFIANT, la paire
  est relue dans la file de l'extension — vendue, décochée ou preuve illisible
  → refusée) ; « Déjà publiée » et la limite de l'offre (`lbcMarque`,
  `lbcQuota`). Grisés et jamais cachés quand l'extension ne peut pas, la raison
  dite UNE fois (`RaisonPublication`).
- Bordereau généré sans PDF : l'extension pose le **rendez-vous** et l'app
  propose « Ouvrir la vente sur Vinted » — le PDF téléchargé est relié à CETTE
  vente.
- ⚠️ **PERDU AVEC LE PANNEAU, À REFAIRE DANS L'APP S'IL LE DEMANDE** : les
  relances (57 personnes nommées), les offres tranchées au clic, le coffre,
  l'empreinte, le gabarit de description. Ne pas les rebrancher dans une page
  de site : c'est l'app qui pilote.
- Bancs : `badge.cjs` (32), `popup.cjs` (carte, 23), `publier.cjs` (rendu,
  3 états) ; audits `audit-extension-ui.cjs` (11 rouges sur l'avant),
  `audit-publier-app.cjs` (8 rouges sur l'avant). Retirés avec le panneau :
  `audit-panneau`, `audit-recap`, `audit-relances`, `banc-captation`,
  `banc-favoris`.


### ⚠️⚠️ « TOUTES MES VENTES FINALISÉES, PEU IMPORTE LA PLATEFORME » (3 octobre, 5.131)
Le CA mensuel déclaré, son registre et ses exports ne comptaient que **Vinted** ;
Leboncoin et eBay n'apparaissaient que dans un total « depuis le début », sans mois.
- **Une seule règle** : `ventesDeclarables({vinted, lbc, ebay, masquee})` →
  `{lignes, aDater, ecartees}`, puis `caDeclarableParMois` (total + `par`
  plateforme, les « dont » somment au total). `caUrssafParMois` n'est plus
  qu'une enveloppe (§11). Identité `plateforme:id`, jamais un titre ; une vente
  vue deux fois compte une fois.
- **Leboncoin** : vente PROUVÉE (`isSeller === true`), finalisée, prix **final
  du détail** en centimes. ⚠️ **AUCUNE vente Leboncoin ne portait sa date de
  vente** (`at` = heure de capture). L'extension 5.131 relève `created_at` de la
  liste v3 (`dateVenteLbc`), ne le réécrit jamais, et ne laisse plus le prix de
  la liste (total acheteur, mesuré 2928 contre 2500) écraser le prix final
  (`prixListe` à part). **Sans date ⇒ dans aucun mois** : « à dater », avec son
  montant, dit à côté du total. L'heure de capture serait une date fausse.
- **eBay** : commande `PAID`, en EUR, datée de `creationDate` ; une autre devise
  est écartée et comptée à part, jamais convertie au hasard.
- L'écran Ventes publie `vinted_urssaf_mois` avec `par`, `aDater` et `sources`
  (« pas su » ≠ « aucune vente ») ; le tableau de bord ne retombe **plus jamais**
  sur l'archive vide (sans publication : « — » et où ça se calcule). Le rapport
  mensuel (écran, CSV, PDF) porte les lignes Leboncoin/eBay avec leur
  plateforme, et dit la répartition, les sources illisibles, les ventes à dater
  et « Vestiaire : pas encore relié ».
- Audits : `audit-urssaf.cjs` exécute la règle sur les trois plateformes (2
  rouges sur l'avant), `audit-lbc-ventes.cjs` la date et le prix (3 rouges),
  banc `rapport.cjs` (8 rouges sur un build d'avant).
- **TRANCHÉ PAR JULIEN le 3 octobre** (ce qui était « à trancher ») :
  1. **Bilan et CA déclaré = les comptes SÉLECTIONNÉS.** Les comptes retirés de
     l'app n'y entrent pas (ils n'ont déjà plus de ventes dans la liste), et une
     vente d'un compte **exclu** (`acctOffOf`) n'entre dans **aucun** total — ni
     un mois, ni « à dater » (`ventesDeclarables({exclu})`, publication, rapport
     mensuel, bilan annuel). Une vente **masquée d'un ✕** reste du CA, comptée à
     part. ⚠️ **Ne plus lui parler des comptes retirés** : il l'a demandé, c'est
     réglé — aucun texte visible ne les nomme (vérifié).
  2. **Tous les comptes Vinted chargés par l'extension sont à lui.** Les comptes
     VRM créés le 2 octobre (`julien.fournier3535@…` et un second) étaient des
     **essais**. Mesuré : le second ne porte que sa ligne `main` ; le premier
     porte 18 lignes (`angeled92`, dont 3 bordereaux) — **toutes existent
     aussi chez lui**, rien n'est perdu. `angeled92` est donc déclaré chez deux
     propriétaires. Supprimer ces comptes d'essai est irréversible : **à faire
     sur sa demande**, pas avant.
  3. **eBay = « l'argent que tu reçois »** (dû au vendeur − frais eBay). ⚠️ **Une
     AUTRE session s'occupe d'eBay** (Julien, 3 octobre) : la règle a été codée
     ici puis **retirée** pour ne pas écrire deux fois les mêmes lignes. C'est à
     la session eBay de l'appliquer (`ventesDeclarables`, branche eBay, et le
     résumé eBay) — `paymentSummary.totalDueSeller − totalMarketplaceFee`, frais
     inconnus ou autre devise ⇒ commande écartée et dite, jamais comptée au
     hasard.
  4. Le bilan annuel compte désormais **Leboncoin et eBay** comme les mois
     (§11) ; il ne comptait que Vinted. `audit-urssaf.cjs` : 7 rouges sur
     l'avant.
  5. Reste ouvert : « Chiffre d'affaires » sur Ma journée et le widget compte
     les ventes EN COURS — c'est la demande « ventes du jour ≠ argent reçu ».


### Paires qui dorment, toutes plateformes (proposition 9, 6 octobre)
L'assistant « Repricing » (Annonces → Conseils & signalements) disait seulement
quoi baisser sur Vinted. Une paire qui dort y est souvent AUSSI en vente sur eBay
ou Leboncoin, à un autre prix.
- **eBay** : l'annonce de la paire est reconnue par son SKU `VRM-{n°}` (identité,
  §5 — une annonce eBay au même titre sans SKU ne déclenche rien ; deux annonces
  pour un même N° ⇒ aucune n'est touchée). La baisse conseillée est la MÊME en
  proportion que sur Vinted, jamais sous le prix d'achat, et se fait d'ici en un
  clic **confirmé** (`revise` → ReviseInventoryStatus). eBay refuse ⇒ la raison
  d'eBay est écrite, rien n'est marqué baissé.
- **Vinted** reste un lien (c'est lui qui baisse) ; **Leboncoin** : la ligne le
  dit (« baisse-la là-bas dans Mes annonces »), sans lien deviné.
- `ebay_listings` n'est lu que quand le panneau est ouvert (§4.4) ; illisible ⇒
  aucune baisse eBay proposée, et c'est écrit.
- Le bandeau « paires qui dorment » n'est plus en rouge (§7 : le rouge est pour
  deux paires sous un même numéro).
- Banc `annonces-carte.cjs` : la bonne annonce (SKU), le bon prix (60 → 53 €),
  rien avant la confirmation, une seule baisse, l'écran qui le dit.


### Retrait automatique d'eBay quand la paire est prouvée vendue sur Vinted (proposition 8, 6 octobre)
Accepté par Julien le 5 octobre. Avant, l'alerte « vendue sur Vinted → retire-la
d'eBay » proposait un clic confirmé ; maintenant il peut l'allumer pour que ça se
fasse tout seul. **Éteint par défaut** (`vrm_ebay_retrait_auto`, synchronisé,
rattrapé par `onCloudReady`), et allumer demande une confirmation.
- **La même règle que l'alerte** (`doublesVenteEbay`, §11) : SKU `VRM-{n°}` sur une
  annonce eBay active + vente Vinted **prouvée** (transaction → `item_id`, état qui
  ne la fait pas revenir). Une annonce sans SKU ne désigne rien (§5).
- **Rien ne part sur « pas su »** : ventes Vinted illisibles, annonces illisibles,
  réglage pas encore arrivé du nuage (`isCloudReady`) ⇒ aucun retrait. 5 retraits
  au plus par passage, une seule tentative par annonce et par ouverture.
- **Le serveur revérifie, il ne croit pas le navigateur** (`handleRetirer`, mode
  `auto:true`) : SKU de paire exigé ; le réglage relu **chez ce vendeur**
  (illisible ⇒ 503, éteint ⇒ 403) ; puis `GetItem` relit l'annonce et son SKU
  doit être celui attendu (sinon 409 `sku-change`, rien n'est retiré) — une
  annonce dont le SKU a été changé entre-temps n'est plus la même paire.
- **Ce qui part en son nom se relit** : journal `ebay_retraits_auto` (50 derniers,
  écrit seulement si sa lecture a réussi), affiché sous l'alerte eBay. La réponse
  dit `journal:false` si l'écriture a échoué.
- Preuves : `audit-ebay-route.cjs` 162 contrôles (dont 9 pour ce mode) ; banc
  `ebay-annonces.cjs` (allumé : retrait parti avec le bon SKU ; éteint ou preuve
  illisible : rien). Mutation « réglage ignoré par le serveur » ⇒ rouge.


### La mémoire de l'agent eBay : migration 014 (chantier K3, 11 octobre) — ✅ APPLIQUÉE le 12 octobre (vérifié le 22)
> ⚠️ Correction du 22 octobre : `list_migrations` porte `vrm_agent_memory_014` (12 oct., 20:35 UTC), les 16 tables
> existent et les **28 corps de fonctions** sont identiques au fichier (md5). Ce qui suit « PAS appliquée » est périmé.
Premier morceau de l'agent eBay « VRM fermé » (spécification `spec-finale.md`
§5.1-5.2, K3). Julien ne voit rien. **Aucune horloge** (ni `pg_cron` ni `pg_net` :
c'est la 015, sur son oui), **aucun DROP**, rien qui tourne : des tables vides et
`vrm_reglages.agent_ebay = '0'`. Fichier : `supabase/migrations/014-agent.sql`.
- **Les garanties vivent dans la base, face à tout appelant de l'API** (navigateur,
  clé de service, route boguée) : 16 tables, 21 fonctions (`SECURITY DEFINER`,
  `search_path` vide, exécutables par `service_role` SEULEMENT) et 3 aides
  internes exécutables par PERSONNE (`vrm_agent_heure`, `vrm_agent_efface`,
  `vrm_agent_sans_acheteur`). Même la clé de service n'écrit la file, les
  commandes, le journal, les compteurs, les mémos, les titulaires, l'index, les
  preuves, l'horloge, les pierres tombales et les marques **que par leurs
  fonctions** (ni INSERT, ni UPDATE, ni DELETE, ni TRUNCATE direct). Elle écrit
  directement : `vrm_agent_vendeurs` (réglages versionnés, pouls), `vrm_agent_vus`
  (insertion), `vrm_agent_routes`, `vrm_ebay_cles_publiques`, `vrm_coffre`.
  ⚠️ **Le propriétaire des tables** (`postgres`, celui de l'outil SQL) garde, par
  construction, le moyen de défaire n'importe quelle garde (désactiver un
  déclencheur, accorder un droit) : aucune garde en base ne tient face à lui.
  C'est `--verifier` qui voit qu'une garde a été touchée.
- **Le navigateur** lit SES lignes de `vrm_agent_vendeurs`, `_commandes`,
  `_journal` (avec la restrictive `abonnement_requis` : qui ne paie plus ne voit
  plus rien), n'écrit RIEN (TRUNCATE compris), ne lit rien d'autre ; `anon` ne lit
  rien du tout. ⚠️ Mesuré le 11 octobre : les droits par défaut du schéma public
  ouvrent toute table neuve en entier à anon et authenticated — la migration les
  retire tous.
- **L'heure** : le temps est un paramètre (`p_maintenant`) pour le banc de vie sur
  horloge simulée (K5) — et pour lui SEUL. Sans la variable de session
  `vrm.horloge_simulee = '1'` (que l'API ne sait pas poser ; un banc la pose par
  `set`, ou `PGOPTIONS='-c vrm.horloge_simulee=1'`), c'est `now()` du serveur
  qui compte, quoi que dise l'appelant. ⚠️ **Le banc de vie de K5 DOIT poser cette
  variable**, sinon ses heures simulées sont ignorées.
  **Les durées et échéances reçues sont BORNÉES en base** (revue 2) : un bail de
  plus de 600 s est REFUSÉ (`prendre` ne prend rien, `prendre_cle` rend false) —
  120 000 « secondes » qui étaient des millisecondes gelaient un compte eBay
  33 h 20, et `prendre_cle(…, 2147483647)` posait un bail jusqu'en 2094 ; une
  prochaine fois (`rendre`) ou une sonnette (`planifier`) à plus d'un an est
  refusée (false / NULL) — « dans 15 min » en millisecondes rangeait la veille
  en l'an 58 748, et le secours ne la recréait pas (elle n'était pas
  « manquante »). Refusé, jamais réduit en silence : la tâche reste tenue et
  revient à la fin de son bail (≤ 10 min).
- **La file** : `vrm_agent_prendre` choisit ses candidats EN SQL (une tâche par
  compte libre, quatre par vendeur, la plus en retard d'abord) puis en prend ≤ 2
  par vendeur et ≤ 1 par compte eBay : un arriéré de 250 tâches sur un compte
  n'affame plus personne. **Un compte eBay n'a jamais deux tâches en vol,
  battements ET clics confondus** : `vrm_agent_prendre_cle` (le clic, ⇒ 409)
  refuse une tâche tenue ET un compte dont une autre tâche est en vol, sous le
  même verrou consultatif que `prendre`. `vrm_agent_rendre` ne rend qu'avec SON
  jeton, ne RETIRE la tâche que sur un « fini » explicite (`p_fini`) sans échec ;
  « pas de prochaine fois » sans « fini », ou un échec, la garde 15 min (« pas
  su » ne détruit jamais une tâche) ; la raison est un CODE (sinon
  `raison-illisible`). Une sonnette arrivée pendant le bail — même EXPIRÉ mais pas
  encore repris (un appel lent) — n'est jamais perdue (`reveil`).
- **Une commande** : `vrm_agent_ecrire_commande(owner, jeton, compte, commande,
  version_lue, colonnes, plateforme, maintenant)` — la tâche qui la tient est
  DÉRIVÉE (`{plateforme}:{compte}:cmd:{commande}`), jamais reçue. Modifier exige
  le bail de CETTE tâche (la veille d'un compte ne réécrit plus une commande
  qu'un clic achète) ; créer, le bail d'une tâche de ce vendeur et de CE compte
  eBay. Version ET bail (FOR SHARE), sinon 0 ligne ; le rang ne descend jamais
  (`vrm_rang_descend`, dit).
- **R18 en base, sur ce qui a une FORME** : des codes (`etape`, `voie`,
  `transporteur`, `suivi`, `numero`, `raison`, `ref`, `source`…), des NOMS de clés
  `shipTo` d'eBay seulement dans `cles_shipto` (liste blanche : « Dupont »,
  « Cancale » sont refusés), aucune clé d'acheteur ni d'adresse à aucune
  profondeur, et aucune adresse email, dans `data`, `en_cours` et `defaire`
  (`vrm_agent_sans_acheteur`) ; la ville d'un devis reste permise (effacée avec
  lui). ⚠️ Le TEXTE d'un message (journal, `texte`) est libre : son contrôle (R13)
  reste au code (K13).
- `vrm_agent_premiere_fois` : les clés `achat:`, `msg:`, `eval:`, `offre:` sont
  GLOBALES (propriétaire neutre, quel que soit l'appelant) [S5], mémos ≥ 100 jours
  [S25]. `vrm_agent_reserver` : `ceil(TTC × 1,15)`, jour de Paris, plafond NULL ⇒
  refusé ; `vrm_agent_rendre_reservation` une seule fois ; la purge ne touche
  JAMAIS un compteur du mois en cours ni du mois précédent (ce sont des plafonds
  d'argent). `vrm_agent_quota` : confort 60 %, détection 80 %, obligations 100 %,
  1 % par compte — et un vendeur inconnu (NULL) est refusé hors obligation.
- **Titulaires et index** : un compte eBay, un vendeur ; un libellé de compte est
  unique chez un vendeur (il nomme ses tâches) ; quand il change, l'index des
  annonces le SUIT ; libérer retire TOUT l'index de ce compte ; seul le titulaire
  indexe, et une ligne laissée par un vendeur qui ne l'est plus est reprise.
  Preuve vue (heure jamais déplacée), horloge à `-infinity` [D14].
- **Le journal** : une seule réécriture, `vrm_agent_anonymiser_journal` (R19), qui
  retire le texte, la référence ET le « défaire » d'une entrée. Toute autre
  modification, suppression ou vidage est refusé (même au propriétaire de la
  table, par une écriture ordinaire) ; la purge et l'effacement d'un vendeur
  passent par une MARQUE de transaction (`vrm_agent_marques`, clé
  `txid_current()`) — une variable de session ne l'ouvre plus.
- **« Fermer mon compte » est SÉRIALISÉ avec chaque écrivain du vendeur** (revue 2,
  le 12 octobre). La pierre tombale n'était visible qu'au COMMIT de l'effacement :
  une sonnette (`planifier`), une ligne de journal (le texte de l'acheteur
  compris), un compteur de quota ou une écriture directe faits PENDANT ces
  quelques secondes survivaient, « Fermer mon compte » rendait « fait », et une
  tâche orpheline faisait LEVER `vrm_agent_prendre` pour TOUS les vendeurs, à
  chaque battement (reproduit en Postgres 16.14 et 17.6). ⇒ Un verrou consultatif
  par vendeur (`hashtext('vrm_agent_vendeur')`, `hashtext(owner)`) : EXCLUSIF en
  tête de `vrm_agent_effacer_vendeur`, PARTAGÉ dans `vrm_agent_efface` (passée en
  plpgsql **VOLATILE** : la relecture qui suit le verrou voit ce qui a été validé
  pendant l'attente — `--verifier` contrôle la volatilité), que TOUTES les
  fonctions qui écrivent appellent EN TÊTE (avant tout verrou de ligne : aucun
  interblocage ; `rendre`, `rendre_reservation` et `anonymiser_journal` l'ont
  désormais aussi), et que le déclencheur de la pierre tombale prend pour une
  NOUVELLE ligne (INSERT, ou UPDATE qui change le propriétaire — un UPDATE d'une
  ligne existante ne crée rien qu'un effacement ne voie, il ne relit que la
  pierre tombale validée, sans verrou). Un écrivain en vol finit avant
  l'effacement et ses lignes partent avec le reste ; un écrivain qui arrive
  pendant attend, puis voit la pierre tombale. `vrm_agent_prendre` ÉCARTE les
  vendeurs effacés de ses candidats et saute sans attendre un vendeur en cours
  d'effacement : une ligne restée à leur nom ne lève plus jamais pour les
  autres. ⚠️ **READ COMMITTED exigé** (le défaut de PostgREST et de Supabase) :
  sous REPEATABLE READ la pierre tombale serait relue sur un instantané d'avant
  le verrou — l'écriture et l'effacement y sont refusés (`vrm_agent_isolation`).
  ⚠️ Un écrivain tenu ouvert retarde « Fermer mon compte » d'autant (un appel
  PostgREST = une transaction courte).
- **« Fermer mon compte »** : `vrm_agent_effacer_vendeur(owner)` efface les 12
  tables qui portent son nom (coffre, commandes, preuves, index compris) et les
  quotas par compte qui le nomment sous le neutre, et pose d'ABORD une **pierre
  tombale** (`vrm_agent_effaces`) : plus aucune ligne ne s'écrit à son nom, ni par
  une fonction (un battement en vol), ni par une écriture directe du serveur
  (déclencheur `vrm_agent_pierre_tombale`, `vrm_vendeur_efface`). ⚠️ **À brancher
  dans `api/compte.js`** par le premier chantier qui écrit dans ces tables
  (aucune suppression directe ne passe). La purge (`vrm_agent_purger`, par la
  015) : vus 14 j, mémos à échéance, compteurs 400 j hors mois courant et
  précédent, journal 13 mois, commandes closes compactées à 90 j, et
  `cron.job_run_details` > 7 j **sans jamais faire échouer le reste**.
- **La forme** : `create table if not exists` sautait en silence une table d'une
  version plus ancienne ; une EMPREINTE (colonnes, types, NOT NULL, et chaque
  contrainte : son NOM **et** les 12 premiers hexadécimaux du md5 de son TEXTE,
  `pg_get_constraintdef` sans « public. ») dans le fichier fait tout refuser
  (`vrm_agent_forme`, le `detail` donne la valeur trouvée et le texte des
  contraintes en place), rien n'est installé. ⚠️ Revue 2 : le NOM seul ne
  suffisait pas — une table d'avant dont la contrainte R18 du même nom valait
  `check (true)` était réutilisée en silence (et la 014 corrigée, réappliquée,
  l'aurait gardée), puis une commande rangeait le nom et l'email de l'acheteur.
  L'empreinte est mesurée identique en Postgres 16.14 et 17.6 ; changer une
  contrainte change son empreinte (l'installation neuve de l'audit refuse et
  donne la nouvelle valeur, à recopier).
- **La garde `ebay_tokens*`** sur `app_data` : un navigateur (`auth.role()` ou rôle
  courant) ne peut ni créer, ni réécrire, ni effacer, ni renommer une ligne de
  jeton eBay (`vrm_ebay_tokens_serveur`). Mesuré : seule la route serveur l'écrit (aucun
  écrivain dans l'app ni l'extension ; en base, une ligne, celle du propriétaire).
  ⚠️ Sur la base d'aujourd'hui, un vendeur connecté PEUT réécrire sa ligne
  `ebay_tokens` (prouvé au banc sur l'avant).
- **Preuves** : `scripts/audit-agent-sql.cjs` — la migration EXÉCUTÉE sur un
  Postgres jetable qui imite la production (`postgres` NON superutilisateur,
  droits par défaut, 005-007 ET 013 appliquées telles quelles,
  `scripts/agent-sql/supabase-min.sql`) : **221 contrôles** (193 avant la revue
  2). **Revue 2 (12 octobre)** : sur l'arbre de 9dcd405 (l'audit copié dedans,
  lancé depuis lui, §6.1) **21 rouges sur 221** ; `--prouve` **79/79** — les 66
  d'avant et 13 de plus : effacement sans verrou exclusif, écrivains sans verrou
  partagé, pierre tombale STABLE, déclencheur sans verrou, quota qui revérifie
  après ses verrous, `prendre` qui n'écarte plus les effacés, isolation ignorée,
  bail non borné, prochaine fois non bornée, forme aux seuls noms, vérification
  aveugle à la définition des déclencheurs, aux droits de colonne, à la
  volatilité. ⚠️ **Les courses sont jouées sur un ÉTAT observé**, jamais sur un
  délai : l'effacement (ou l'écrivain) tient sa transaction ouverte APRÈS son
  travail (`pg_sleep`), et l'autre partie n'est lancée qu'une fois cette fenêtre
  vue dans `pg_stat_activity` (ou l'appel vu en attente d'un verrou) — sous la
  charge de `--prouve` (quatre audits à la fois), un délai fixe laissait le
  contrôle vacant. ⚠️ Premier jet du contrôle « ligne orpheline » : posée sur un
  compte dont une autre tâche était en vol, elle n'était jamais candidate —
  vert sur le défaut ; elle est posée sur un compte LIBRE. ⚠️ Et la nouvelle
  empreinte a d'abord AFFAIBLI quatre preuves : les mutations R18 (noms de clés,
  data, codes, référence du journal) changent le TEXTE d'une contrainte, donc
  son empreinte — la forme refusait l'installation de la migration mutée, et
  elles passaient au rouge pour une MAUVAISE raison (« vrm_agent_forme », 70
  contrôles), sans prouver que le contrôle R18 mord. L'audit recalcule
  l'empreinte de la migration mutée (`contraintes: true`) : c'est le contrôle
  R18 qui tombe (1 à 2 rouges chacune). *Une mutation se juge sur la RAISON
  de son rouge, pas sur son nombre.* Sur l'arbre de
  59edcdd (l'audit copié dedans, lancé depuis lui, §6.1) : **48 rouges sur
  172**. `--prouve` : **66/66 mutations** au rouge — les 27 d'avant et 39 pour la
  revue du 11 octobre au soir (24 constats, deux relecteurs) : bail de commande
  quelconque, création sous un autre compte, rang qui descend, sans FOR SHARE,
  heure reçue, « at » reçu au journal, sans pierre tombale, quotas, coffre,
  commandes, preuves ou index oubliés à l'effacement, vérification aveugle aux
  déclencheurs, aux droits ou aux fonctions, forme ignorée, R18 (noms de clés,
  data, codes, référence du journal), anonymisation du seul texte, raison
  brute, « pas su » qui efface, réveil sous bail expiré, clic qui ignore le
  compte en vol, fenêtre brute, quota sans vendeur, index sous l'ancien libellé
  ou gardé à la libération, indexation sans être titulaire, ligne périmée
  jamais reprise, journal ouvert par une variable, compteurs à 1 jour, mois en
  cours purgé, purge de pg_cron sans filet, TRUNCATE au navigateur, INSERT et
  TRUNCATE au serveur, garde des jetons aveugle au rôle courant.
  ⚠️ Les relectures avaient trouvé **dix mutations VERTES** sur l'audit de
  59edcdd (TRUNCATE et INSERT jamais essayés, 5 tables sur 12 vérifiées à
  l'effacement, purge des compteurs et FOR SHARE jamais exercés…) et un contrôle
  R18 vert sur une forme qui arrangeait (deux valeurs à espace) : un contrôle de
  refus exige désormais le refus PAR LA CONTRAINTE — une erreur d'appel n'en est
  pas un (vacant sinon sur le code d'avant, §6.3).
- **Application (session principale)** : `node scripts/agent-sql/essai-annule.cjs >
  essai.sql` (~67 Ko, indentation et commentaires retirés, ROLLBACK, ne laisse
  rien — vérifié), puis la migration, puis `--verifier` : lecture seule, `ok`
  et `ecarts` ; elle regarde la forme de chaque table (et le TEXTE de chaque
  contrainte, par la MÊME expression que le bloc 1c, relue dans le fichier), RLS
  activé ET forcé, les droits EXACTS d'anon, authenticated et service_role (dont
  TRUNCATE, et MAINTAIN en Postgres 17) et AUCUN droit de COLONNE
  (`droits_colonnes`), la séquence, les règles et leur texte, chaque fonction
  (une seule version, SECURITY DEFINER, search_path et VOLATILITÉ du fichier,
  corps md5, qui l'exécute), chaque déclencheur présent ET actif AVEC sa
  définition (moment, évènements, ligne/instruction, condition WHEN normalisée,
  aucun `UPDATE OF`, aucun argument), l'horloge, le réglage, aucune marque qui
  traîne, aucune horloge simulée posée sur la base ou un rôle. ⚠️ Celle de
  59edcdd rendait `ok = true` avec les gardes suspendues, une restrictive
  retirée, une fonction en SECURITY INVOKER, FORCE RLS retiré, le coffre lisible
  par le navigateur ; celle de 9dcd405 avec une garde affaiblie sous le MÊME nom
  (la garde des jetons recréée `when (false)` — un navigateur réécrivait le jeton
  eBay —, la garde du journal pour UPDATE seulement, la pierre tombale de la file
  pour INSERT seulement, `vrm_agent_commandes_data` et les 100 jours des mémos en
  `check (true)`, `grant insert (…)` ou `grant update (bail_jeton, bail_jusqua)`
  au serveur — reproduits) : l'audit en sert maintenant **28 dénaturations** et
  exige `ok = false` et la bonne partie nommée. Si l'outil SQL refuse le bloc :
  `--morceaux --dossier=…` (18,6 · 36,3 · 7,5 Ko, trois transactions dans
  l'ordre, chaque objet né fermé — vérifié), puis `--verifier`.
- **Mesuré en production le 11 octobre au soir** (lecture seule du catalogue) :
  Postgres 17.6, 0 table et 0 fonction de l'agent, aucun réglage `vrm.*` posé sur
  la base ou un rôle, ni `pg_cron` ni `pg_net`, déclencheurs d'`app_data` =
  ceux du socle du banc (`vrm_garde_garage`, `vrm_garde_numeros`, `vrm_meta_maj`,
  `vrm_noter_ecriture`).
- **Non mesuré** : jamais appliquée sur sa vraie base ; que l'outil SQL accepte
  ~67 Ko d'un bloc (la 013 à 92 Ko ne passait pas) ; la durée du verrou posé sur
  `app_data` par les déclencheurs en production (`lock_timeout` 3 s). **Le banc
  n'est pas la production** : Postgres 16 au banc contre 17.6 en production. ⚠️
  Revue 2 : l'audit ENTIER a aussi tourné sur un 17.6 « vanilla » (binaires
  `@embedded-postgres/linux-x64@17.6.0-beta.15`, `PG_BIN=…`) — **221 contrôles,
  0 au rouge** (MAINTAIN, texte des règles, empreinte des contraintes, WHEN des
  déclencheurs compris) ; pas sur le 17.6 de Supabase lui-même ; la purge de `cron.job_run_details` n'a tourné que sur une table
  À LA FORME de Supabase (droits de `postgres` supposés : pg_cron n'est pas
  installé en production) ; l'empreinte du texte des contraintes et la
  normalisation des conditions WHEN sont mesurées identiques en 16.14 et en 17.6
  « vanilla » (binaires embarqués), pas sur le 17.6 de Supabase — un écart de mise
  en forme ferait REFUSER l'installation (`vrm_agent_forme`) ou rendrait
  `ok = false` : le sens sûr, jamais un feu vert. Une montée de version majeure
  de Postgres pourra exiger de recopier l'empreinte.
- **Julien** : rien.


### Leboncoin et eBay rangés comme Vinted : résumé, puis Ventes / Achats / Annonces (3 octobre)
Demande du 2 octobre : « plus d'écran Aperçu intermédiaire ». Les deux onglets
ouvrent sur **Ventes**, avec un résumé compact au-dessus (`PlatResume`, même forme
que `VintedResume`) :
- **Leboncoin** : CA finalisé · En attente, calculés par `lbcArgent` — la MÊME
  règle que la liste des ventes (§11) ; la liste ne répète plus ses totaux sous le
  résumé (`sansTotaux`). Sections : Ventes · Achats (si captés) · Annonces (l'ex
  « À publier ») · Colis.
- **eBay** : « Ventes payées » (`caParPlateforme`). Sections : Ventes · Achats ·
  Annonces · **Compte eBay** — c'est là que vivent la connexion et la publication
  (`EbayConnexion`), qui étaient dans l'Aperçu. Rien n'est perdu (§4.11).
- `Plateforme` ne sert plus qu'à Vestiaire ; ses branches eBay/Leboncoin, devenues
  mortes, sont retirées. Une liste vide dit sa cause UNE fois (pas sous le résumé
  ET dans la liste, §7 — vu au rendu sur eBay).
- ⚠️ `ebay-form.cjs` sort **déjà** rouge sur « Optimiser le titre avec l'IA » sur
  le build d'AVANT ce changement : défaut du banc ou de l'IA, pas des onglets. À
  regarder.


### ⚠️⚠️ « MÊME S'IL Y A DES MISES À JOUR, PLUS AUCUN PROBLÈME DE CAPTURE » — LA DÉRIVE DE CHAMP (3 octobre, 5.141)
Consigne permanente de Julien. La sentinelle de forme (5.139) attrapait déjà le
cas où Vinted/LBC/eBay **renomme la clé de liste** (`my_orders` → `orders`) : la
capture tombe à 0 en silence. **Mais elle revenait dès que la clé de liste était
présente** — or le vrai bug déjà vécu est **un champ INTÉRIEUR renommé**
(`brand_title` vs `brand`, § allègement) : la liste a l'air pleine, `articleMaigre`
garde un champ qui n'existe plus, et **tout le stock affiche « marque manquante »
sans la moindre erreur**. Une mise à jour de Vinted qui déplace `price` casserait
le prix de toutes les annonces, pareil, en silence.
⇒ `verifChampsListe` vérifie, quand la clé de liste est bonne, que les **champs
STRUCTURELS** qu'on lit sont encore là (`CHAMPS_CRITIQUES` : `id`, `title`,
`price` pour les annonces ; `transaction_id`, `title` pour les commandes ; `id`
pour l'inbox).
- ⚠️ **UNIQUEMENT des champs structurels** (indépendants de la catégorie) : Julien
  veut servir aussi un reseller de livres/sacs, donc `brand`/`size` peuvent
  légitimement manquer à tout un stock — les exiger crierait au loup.
- ⚠️ **Seuil anti-fausse-alerte : 0/N.** On n'alerte que si le champ est absent de
  **TOUS** les items d'une liste **non vide**. Un item isolé sans prix (un
  brouillon) laisse les autres le porter → rien. Seul un **renommage** le fait
  disparaître de tout le monde d'un coup — et c'est ça, et seulement ça, qu'on
  attrape. Liste vide (compte neuf) ⇒ rien.
- **On ne devine aucun parser** (interdit) : on note `forme_inconnue_champ_<type>`
  + le **nom** du champ perdu + les noms de clés d'un item (jamais une valeur),
  la passe suivante aliase sur la forme mesurée.
- **Aucun changement côté app** : la clé `forme_champ_<type>` remonte toute seule
  dans l'alerte « Format d'un site » de Réglages (l'écran scanne `/^forme_/` et
  mappe par sous-chaîne). Rien rendu à l'aveugle.
- `audit-forme-capture.cjs` étendu : champ renommé → déclenche et NOMME le champ ;
  un seul item sans le champ → rien (seuil 0/N) ; liste vide → rien ; aucune
  valeur ne fuit. **6 rouges sur le code d'avant** (le silence), 0 après — mesurés
  en relançant le banc étendu depuis l'arbre `HEAD` (§6.1).
- **Aucune entrée d'`EXT_CAPACITES`** : c'est un diagnostic de capture, l'app ne
  promet rien de neuf. Extension en **5.141.0**, zip régénéré, `EXT_ATTENDUE`
  suivie.

**Suite (5.142) — même blindage sur les captures OBJET (transaction, conversation).**
Les listes ne sont pas les seules à casser en silence : une **transaction** porte
la preuve de vente et la date de versement (`transaction.status`), une
**conversation** porte la messagerie et les offres (`messages`). Un renommage de
ces champs par Vinted viderait la preuve de vente ou la messagerie sans erreur.
`verifFormeObjet` les garde par **présence de clé** (false-alarm-proof : un
renommage fait disparaître `messages`/`status`, une valeur vide — `messages:[]`,
`status:0` — garde la clé), et **uniquement** si l'objet métier est substantiel
(≥ 3 clés) — un objet maigre/raté n'est pas jugé (mieux vaut un blanc qu'un faux).
Le renommage AMBIGU du conteneur (`transaction` absent) n'est pas jugé, seul le
champ interne l'est. `nomFamille` mappe `transaction`→ventes, `conversation`→
messages pour l'alerte « Format d'un site ». **6 rouges de plus sur le code
d'avant.** Extension **5.142.0**, zip régénéré, `EXT_ATTENDUE` suivie.

**Suite (5.143) — le détail d'annonce (`item`).** Même sentinelle objet, sur le
champ qui porte **toutes les photos** : le coffre ET la capture photo passive
(Leboncoin/eBay) lisent `(p.item||p).photos`. Un renommage de `photos` par Vinted
ferait tomber à zéro toute la publication photo en silence — le point le plus
retravaillé du projet (5.87, 5.91, 5.94, 5.95). Gardé par présence de clé
(`photos:[]` ne déclenche pas, seul un renommage le fait), objet substantiel.
`nomFamille` mappe `item`→annonces. **2 rouges de plus sur le code d'avant.**
Extension **5.143.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️⚠️ `/api/ebay` ÉTAIT OUVERTE À TOUT INTERNET, AVEC SON COMPTE eBAY CONNECTÉ (5 octobre)
Trouvé par l'audit de sécurité du 5 octobre. **Mesuré en production** : la ligne
`ebay_tokens` porte bien un jeton de renouvellement, son compte eBay est donc
relié. La route n'exigeait **aucune session**. N'importe qui pouvait :
- lister ses commandes eBay, avec les acheteurs, et lire ses finances ;
- publier ou modifier une annonce sur **son** compte eBay ;
- ⚠️⚠️ **et remplacer sa connexion eBay par la sienne.** Il suffisait d'ouvrir la
  page de consentement d'eBay (son adresse ne contient rien de secret) et de
  s'y connecter avec son propre compte. Le retour rangeait ce jeton à la place
  de celui de Julien, et ses publications partaient alors sur le compte d'un
  inconnu.

⇒ **Correctif minimal, posé À L'ENTRÉE de la route** (eBay reste le domaine de
l'autre session, sa logique n'a pas été touchée) :
- Toute action `POST` exige la session (`vendeurExige`) et le **propriétaire de
  l'installation** (`VRM_OWNER_UID`, à qui appartient la ligne `ebay_tokens`).
  Un autre vendeur reçoit 403.
- `authurl` fabrique un `state` **signé par le serveur** et daté (HMAC dont la
  clé dérive d'`EBAY_CERT_ID`, jamais envoyée au navigateur). Le retour de
  consentement le vérifie avant d'échanger le code. Sans `state` valide, ou au
  bout de 30 minutes, rien n'est rangé.
- La lecture `GET` (« eBay est-il prêt ? ») reste publique : elle ne dit rien
  de ses données.
- L'app envoie son jeton (`enTeteSession()`) sur ses 10 appels.
- Le jeton déjà rangé reste valable : rien à refaire pour lui. La prochaine
  reconnexion passera par la demande signée.
- `audit-ebay-route.cjs` exécute la vraie route : **12 contrôles**, **10 rouges**
  sur le code d'avant, dont « jetons écrits : true » pour le code d'un inconnu.
- ⚠️ **Pour la session eBay** : `ebay_tokens` est une ligne d'installation, lue
  avec la clé de service, sans filtre de vendeur. Le jour où eBay sera ouvert à
  d'autres vendeurs, il faudra une ligne de jetons par vendeur. Ce sera alors à
  elle de relâcher la garde « propriétaire ».


### ⚠️⚠️ eBay : CHAQUE VENDEUR SON eBAY, des BROUILLONS, et un PLANIFICATEUR (5 octobre)
Julien : « tout doit être adaptable en fonction de la personne en face », puis
« tout doit être personnalisable : le nombre d'annonces qu'il peut poster,
sélectionner ses brouillons, ce qu'il veut mettre en ligne, etc. Tout doit être
parfait. »

**0. Deux défauts d'avant, corrigés d'abord (`api/ebay.js`).**
- ⚠️⚠️ **« Vérifier sans publier » DOUBLAIT les frais.** `totalFrais`
  additionnait TOUS les `<Fee>` ; or le guide Trading « Fees » dit que
  `ListingFee` EST le total. Dès qu'un frais n'était pas nul, le montant
  annoncé était faux (0,35 € affichés 0,70 €). Le banc `ebay-write.cjs` était
  **vert dessus** : sa fixture servait « ListingFee 0,35 + InsertionFee 0,00 »,
  une forme irréaliste où additionner et lire donnent le même nombre (§6.3).
  ⇒ `fraisParNom` range chaque frais **sous son nom** ; `total` = `ListingFee`,
  **absent ⇒ `null` (« pas su »), jamais 0** ; `programmation` = le frais
  d'option (`SchedulingFee` — nom NON mesuré sur eBay.fr : absent ⇒ null) ; une
  remise éventuelle est rendue à côté, jamais soustraite.
- ⚠️ **`tradingCall` ne gardait que le PREMIER `<LongMessage>`** : sur un Ack
  Warning ou avec plusieurs `<Errors>`, il montrait un simple avertissement à la
  place du vrai refus, et perdait l'ErrorCode (le 488 du planificateur). Il rend
  maintenant `erreurs` (`{code, severite, message, params}`), `err` = la
  première **Error**, `avertissements` = les Warning.

**1. Chaque vendeur son eBay.** `ebay_tokens` et les lignes `ebay_*` étaient
celles de l'INSTALLATION (écrites au nom de `VRM_OWNER_UID`, lues avec la clé
de service **sans filtre**), et la route refusait tout autre vendeur (403).
- Base cloisonnée : toute lecture est filtrée `owner=eq.{vendeur de la
  session}`, toute écriture porte `owner` = lui, cible `(owner,id)`. Le vendeur
  est **passé explicitement** à chaque fonction de `api/_lib/ebay.js`
  (`portee(owner)`) — jamais une variable de module (deux requêtes se traitent
  en parallèle). Un vendeur ne lit jamais les jetons d'un autre, et ses appels
  partent chez eBay avec **son** jeton.
- Le `state` de consentement **porte le vendeur** (`ts.vendeur.mac`, HMAC par
  `EBAY_CERT_ID`, 30 min, comparaison en temps constant) : le retour range les
  jetons chez CELUI qui a demandé. Le vendeur fait partie de ce qui est signé :
  un state dont on remplace le vendeur est refusé.
- La garde « propriétaire seulement » est retirée sur base cloisonnée ; un
  abonnement coupé (`vrm_acces_pour` = false) ⇒ **402**, zéro appel eBay (« pas
  su » ne coupe pas, comme ailleurs).
- ⚠️ **Rétrocompatible sans rien faire** : sa ligne `ebay_tokens` porte déjà
  owner = `VRM_OWNER_UID` = son identifiant. **Base pas encore cloisonnée ⇒
  exactement comme avant** (un seul jeu de données, seul le propriétaire de
  l'installation) — c'est pourquoi le 403 y est GARDÉ.
- « Pas su » ≠ « pas relié » : la lecture du refresh_token a trois états ; une
  base qui hoquette répond 503 (« je n'ai pas pu lire ta connexion eBay »), plus
  « aucun compte eBay relié ».
- L'app lisait déjà toutes ses lignes eBay avec `sbAuth()` (RLS ne lui rend que
  les siennes) — vérifié ligne par ligne.

**2. Brouillons et planificateur.**
- **Brouillons** : une ligne DÉDIÉE par vendeur (`ebay_brouillons`, jamais
  `main`, lue projetée). « Enregistrer en brouillon » dans le formulaire ;
  « Modifier » rouvre un brouillon dans ce même formulaire. Relire-fusionner-
  écrire, et **une lecture ratée n'écrit RIEN** (repartir de vide remplacerait
  ses six brouillons par un seul — prouvé au banc en réaffaiblissant). Une
  seule règle « brouillon → annonce » (`itemDeBrouillon`) pour le formulaire ET
  la liste (§11). Cocher un, plusieurs ou tous ; « Vérifier la sélection »
  (une vérification à blanc par brouillon, l'une après l'autre, frais par nom).
- **Planificateur** (« Programmer la sélection ») : départ (préréglages
  **modifiables et synchronisés** : Maintenant · Ce soir 20 h · Demain 12 h 30 ·
  Dimanche 20 h, ou une date et une heure), N par jour, plage de–à, jours de la
  semaine, **écart FIXE** (aucun hasard, §3), ordre (sélection / N° / prix).
  Le rythme est `vrm_ebay_rythme` (SYNC_KEYS, rattrapé par `onCloudReady`
  seulement s'il est resté au défaut, §5.49).
  - L'heure est celle de **PARIS**, calculée par `Intl` (`partsParis`,
    `parisVersUtc`) — jamais l'heure locale de l'appareil. Le changement d'heure
    du 25 octobre 2026 est juste (19:00 = 17:00 UTC le samedi, 18:00 UTC le
    dimanche) ; une heure ambiguë ou inexistante est refusée ; « un jour plus
    tard » avance le CALENDRIER, pas 24 h. Le banc tourne exprès avec un
    navigateur à l'heure de **New York**.
  - `heuresDuLot` est une fonction pure du temps : premier moment autorisé,
    puis l'écart ; quota du jour ou plage dépassés ⇒ jour coché suivant. Jamais
    une annonce programmée à moins de 20 min (eBay en exige 15) ; au-delà de
    3 semaines (la limite d'eBay) les brouillons **restent des brouillons**, et
    l'écran dit combien.
  - L'aperçu donne l'heure exacte de chaque paire, groupé par jour, puis les
    frais **lus chez eBay pour CETTE heure** (vérification à blanc avec
    `ScheduleTime`) : programmation ligne par ligne et au total, « pas su »
    quand eBay ne l'annonce pas (jamais 0), et « facturés à la création, non
    remboursés si tu annules » **seulement** si un frais de programmation non
    nul est revenu. Une paire déjà en ligne / déjà programmée sur eBay (SKU),
    prouvée vendue sur Vinted, sans N° ou incomplète est écartée **avec sa
    raison** ; preuve de vente illisible ⇒ rien ne part.
  - La limite de vente (`GET /sell/account/v1/privilege`) est lue et dite ; un
    lot qui la dépasserait est signalé (« pas su » si illisible). ⚠️ C'est une
    LIMITE mensuelle, pas ce qu'il reste ce mois-ci (non exposé là).
  - ⚠️⚠️ **CE QUI N'EST PAS PROUVÉ EST DIT, JAMAIS PROMIS.** Avant sa PREMIÈRE
    programmation, une case à cocher : l'annulation par VRM n'est pas garantie
    (il faudra peut-être annuler sur eBay), et une paire vendue ailleurs avant
    son heure peut quand même partir. C'est SA décision (la revue proposait
    d'attendre la mesure de l'annulation ; Julien a demandé le planificateur —
    il décide en connaissance de cause). Mémorisée (`risqueCompris`).
- **Programmer** (`programmer`, une annonce par appel, l'une après l'autre) :
  `confirme:true`, heure ISO UTC validée par le serveur (15 min – 3 semaines),
  N° exigé (sans SKU, une paire vendue ailleurs ne se retrouve pas), **état
  exigé** (plus d'« Occasion » posé en silence), UUID 32 hex, frais vus. Puis :
  relecture de SES annonces (en ligne + programmées) ⇒ SKU déjà présent = 409
  (eBay, lui, ne l'empêche pas) ; illisible = 503 · vérification à blanc **sans
  UUID** ⇒ frais inconnus = refus, plus chers que vus = 409 · ajout **avec
  l'UUID** dans `<Item>`, `<ScheduleTime>` dans `<Item>`. La vérité rendue est
  celle d'eBay (ItemID, StartTime, EndTime) ; eBay qui ignore l'heure ⇒
  `enLigneMaintenant`. Coupure ⇒ « incertain » : l'app relit chez eBay par SKU
  AVANT tout nouvel essai, puis UN seul essai avec le MÊME UUID ; un 488 n'est
  « déjà programmée » qu'après un GetItem qui confirme le SKU. Bilan par
  brouillon (« 4 sur 6 programmées · 2 refusées : … »), jamais d'arrêt muet.
- **Programmées** : `GetMyeBaySelling` demande `<ScheduledList>` (sans elle une
  programmée est invisible : « pas vu » ≠ « aucune »), découpé **par
  conteneur** avant d'en extraire les `<Item>`, paginé (5 pages, sinon
  `complet:false`). Rangées dans `ebay_programmees` seulement si eBay a
  répondu ; ligne absente = « jamais lue » ⇒ l'écran la demande une fois.
  Groupées par jour ; statuts Programmée · En ligne · « Pas partie à l'heure »
  (+30 min, eBay la garde en attente, avec le geste) · « à relire » ; Échec sur
  le brouillon.
- **Déplacer** (`reprogrammer`) : refusé à moins d'1 h du départ (relu chez
  eBay), grisé avec la raison à l'écran. **Annuler** (`deprogrammer`) :
  EndFixedPriceItem **essayé** sur une programmée relue à l'instant, puis
  relecture ; la réponse d'eBay est montrée TELLE QUELLE, et sur un refus
  « annule-la dans le Seller Hub » avec le lien.
- **Double vente** : une programmée dont la paire est prouvée vendue sur Vinted
  rejoint l'alerte eBay (« programmée sur eBay — à annuler »), sur l'écran ET
  le tableau de bord (`doublesVenteEbay`, `programmees`, §11).

⚠️ **NON MESURÉ (eBay et la production bloqués ici — rien n'a été appelé pour
de vrai)** : le nom `SchedulingFee` sur eBay.fr et son montant (≈ 0,20 € selon
l'aide, la vérification à blanc fait foi) ; qu'EndFixedPriceItem accepte une
annonce pas encore commencée ; ReviseFixedPriceItem + ScheduleTime ; qu'eBay
omette un conteneur vide dans GetMyeBaySelling (lu « vide » sur un Ack
Success) ; l'adresse `ebay.fr/sh/lst/scheduled` du Seller Hub (un repli, pas une
promesse) ; le délai maximal de la fonction Vercel (un ajout lent devient
« incertain », couvert par la relecture par SKU). **Le premier geste de
Julien** : programmer UNE paire, une heure à l'avance, regarder la ligne de
frais de programmation, puis essayer « Annuler » — la réponse d'eBay dira si
l'annulation par VRM marche.

- Preuves : `audit-ebay-route.cjs` **153 contrôles** (dont 6 dans un processus
  neuf sur base NON cloisonnée), **73 rouges** sur e50cd28 ; et chacune de huit
  mutations le refait passer au rouge (lecture sans filtre de vendeur · UUID à
  la vérification · frais additionnés · garde d'identité retirée · 488 cru sans
  GetItem · XML lu sans conteneur · state non vérifié · premier message gardé).
  `ebay-write.cjs` : forme réaliste, **5 rouges** sur l'avant (`fees=1.1`).
  Banc `scripts/bancs/ebay-programmer.cjs` (données inventées, port 4721, deux
  tailles + un passage « brouillons illisibles ») : **71 contrôles**, rouge sur
  le build d'avant, et rouge sous quatre mutations (heure locale · décalage fixe
  +2 h · risque non coché · brouillons écrits depuis vide).
  `ebay-annonces.cjs` : + l'alerte « à annuler » (écran, tableau de bord,
  « pas su ») — **7 rouges** sur l'avant.


### ⚠️⚠️ Revue du 6 octobre, côté serveur eBay : le lien de connexion capturait le compte d'un autre
Revue contradictoire du planificateur eBay. Chaque défaut a été confirmé en
EXÉCUTANT la vraie route.
- ⚠️⚠️ **Le `state` signé prouvait QUI avait demandé, jamais que le retour arrivait
  dans SON navigateur.** Le vendeur B demandait un lien de connexion et
  l'envoyait à quelqu'un (« reconnecte ton eBay à VRM » : c'est une vraie page
  eBay, au nom de VRM). La victime acceptait, et **SON** refresh_token était
  rangé chez B : ses commandes, ses acheteurs, ses annonces. Le même lien
  servait 30 minutes, pour plusieurs victimes. C'est arrivé avec
  « chaque vendeur son eBay » (avant, seul le propriétaire obtenait un `state`).
  ⇒ `authurl` pose un **nonce** dans un cookie `HttpOnly; Secure; SameSite=Lax;
  Path=/api/` et le nonce entre dans la signature. Le retour l'exige, puis
  l'**efface quoi qu'il arrive**. Le lien ne marche donc que dans le navigateur
  qui l'a demandé, et une seule fois (RFC 6749 §10.12).
  ⚠️ Conséquence à connaître : une connexion lancée dans un navigateur et finie
  dans un autre échoue, avec « relance la connexion eBay depuis VRM, dans ce
  navigateur ». Ça peut arriver dans une PWA iPhone qui ouvre eBay dans une vue
  à part. Son jeton actuel n'est pas touché, et rien n'est à refaire pour lui.
- ⚠️⚠️ **« Publier » n'avait AUCUNE garde d'identité.** Une paire déjà en vente,
  ou programmée pour ce soir, repartait en seconde annonce (prouvé : deux
  annonces VRM-30). `publish` passe maintenant par la même règle que
  `programmer` (`dejaChezEbay` : relue chez eBay, en ligne ET programmées ;
  illisible ou incomplète ⇒ 503 « pas su » ; présente ⇒ 409 `deja-*` avec son
  `itemId`). Une annonce SANS N° part comme avant (rien à comparer).
- **Le SKU se compare par le N°, pas par la chaîne** (`numDeSku` / `memePaire`,
  même lecture stricte que `numDeSkuEbay` dans l'app). « VRM-030 », « vrm-30 »
  et « VRM 30 », retapés dans le Seller Hub, sont la N°30. Avant, ces formes
  laissaient programmer et publier une seconde annonce. Le retrait automatique
  suit la même règle.
- **Une écriture sans `<Ack>` est « incertaine », jamais « refusée »**
  (`sansAck`). Une passerelle eBay qui répond 503 en HTML APRÈS avoir créé,
  annulé, déplacé ou retiré une annonce était rendue « eBay a refusé ». Le
  brouillon restait alors à republier, d'où une seconde annonce. Concerne
  `publish`, `programmer`, `deprogrammer`, `reprogrammer` et `retirer`. Un VRAI
  refus (Ack Failure) reste un refus.
- Preuves :
  - `audit-ebay-route.cjs` : **181 contrôles, 16 rouges** sur le code d'avant,
    dont « le lien de B ouvert dans le navigateur de Julien : rangé chez B »,
    « 2 annonces VRM-22 » et « HTTP 422 eBay a refusé » sur une annonce créée ;
  - `bancs/ebay-callback.cjs` porte le nonce. Ses cas d'erreur doivent ATTEINDRE
    l'échange, sinon ils passeraient sur le refus du nonce, vides de sens.
- **Suite, même jour (revue des propositions 6, 8, 9, 10)** :
  - `revise` (changer un prix) n'avait pas appris `sansAck`. Il annonçait « eBay a
    refusé » sur un réseau coupé, alors que le prix avait pu changer.
  - Une annonce terminée par `retirer` (à la main ou automatiquement) **sort
    tout de suite de `ebay_listings`**, en lire-fusionner-réécrire gardé
    (`sortirDesAnnonces` : une lecture ratée n'écrit rien, la réponse dit
    `listes:null`). Avant, l'alerte « à retirer » restait, et le retrait
    automatique reprenait la même annonce à chaque ouverture, en occupant les
    5 places d'une vraie vente.
  - `audit-ebay-route.cjs` : 185 contrôles, 3 rouges sur le code d'avant.
- ⚠️ Deux branches de sauvegarde (`claude/wip-ext-5162`, `claude/wip-bilan-lancement`)
  ont été poussées par erreur le 6 octobre. Le proxy a refusé leur
  suppression : à effacer sur GitHub. Elles ne se déploient pas
  (`claude/**` est coupé dans `vercel.json`).


### ⚠️⚠️ REVUE CONTRADICTOIRE DU PLANIFICATEUR eBAY : neuf défauts, côté app (6 octobre)
Confirmés en EXÉCUTANT le code de f53df91 (rendu, `vm`), corrigés dans
`src/App.jsx` ; le serveur (`api/ebay.js` : `publish` relit la liste d'eBay et
répond 409 `deja-*` avec l'`itemId`, 503 `pas-su`, 504 `incertain` sans `<Ack>`)
est traité à part — l'app AFFICHE `j.error` de ces réponses telle quelle.
- ⚠️⚠️ **Une paire DÉJÀ VENDUE se programmait quand même** : la seule garde était
  l'annonce Vinted du brouillon (`pairId`). Vendue sur Leboncoin, sur eBay
  (commande SKU VRM-n), revendue sur Vinted sous une AUTRE annonce du même N°,
  ou brouillon sans `pairId` : programmée. ⇒ **`numerosDejaVendus`**, UNE règle
  par le N° (§5), à côté de `doublesVenteEbay`, consommée par le planificateur,
  « Publier », l'alerte « à annuler » (avec OÙ : `ouVenduesTexte`) et le centre
  de notifications (§11). « La paire est revenue » (une autre annonce du N° en
  vente, pas vendue) est respecté ; une annonce de BROUILLON compte pour son N°
  même si la fiche a disparu (`autres`). `lbc_ventes` est lue projetée, en
  TROIS états ; les annonces Leboncoin (226 Ko) ne le sont que si une vente ne
  se relie pas sans elles. **« Pas su » ⇒ rien ne part**, et l'écran nomme ce
  qui n'a pas pu être lu.
- **« Publier » (immédiat) ne vérifiait RIEN** : `gardePublier` applique les
  mêmes règles — vendue (toutes plateformes), pas su, déjà en vente OU
  PROGRAMMÉE sur eBay (`dejaSurEbay` porte maintenant les programmées et dit
  laquelle), plus en vente sur Vinted. Bouton grisé, la raison dite UNE fois.
  Une coupure n'est plus « Publication impossible (réseau) » : « je ne sais pas
  si elle est partie ».
- **Second essai** (après un « incertain ») : un refus (frais, vérification,
  liste illisible) ne prouve pas que le premier n'a rien créé ⇒ « incertaine »,
  jamais `envoi:{ok:false}` (le brouillon serait reprogrammé ou republié) ; un
  409 `deja-*` avec `itemId` PROUVE l'annonce ⇒ programmée.
- **L'UUID déjà rangé en base est gardé** (relu dans `modifierBrouillonsEbay`) ;
  la copie de l'écran pouvait être périmée. `modifierBrouillonsEbay` accepte
  `false` = « rien à écrire » (aucune écriture, pas même la ligne relue).
- **SKU canoniques** dans le planificateur (`skuEbayDe(numDeSkuEbay(x))`) :
  « vrm-027 », « VRM 028 » sont reconnus. **Doublon dans le lot** : deux
  brouillons du même N° — le premier part, les suivants sont écartés et dits.
- ⚠️ **Le brouillon « programmee » zombie** : `brouillonEncoreAttendu(pr, P)`
  (relu COMPLET 2 min après la programmation et absent, ou parti en ligne ⇒
  plus attendu) dans `programmeesConnues`, UNE règle pour la liste et l'alerte ;
  `remettreBrouillon` est appelé par « Annuler » ET « Annuler sa programmation ».
- **Les heures partent d'une ANCRE** (à la minute), plus de `maintenant` qui
  avance toutes les 30 s : avec « Maintenant », « Programmer 3 annonces »
  retombait à « 1 » au tic suivant. Réancrage sur un réglage, un préréglage
  recliqué, ou une heure passée sous 16 min — jamais pendant une vérification
  ni un envoi.
- **`enregistrerBrouillon` ne réécrit pas un brouillon déjà parti** (programmé
  ou publié entre-temps) — aucune écriture, et c'est dit.
- Preuves (données inventées) : `ebay-programmer.cjs` **101 contrôles, 23
  rouges** sur le build de f53df91 (scénarios A déjà vendue / doublon / SKU ·
  B second essai et UUID · C horloge installée, `runFor(31000)` entre Vérifier
  et Programmer · D « Publier »), 0 après ; `ebay-annonces.cjs` **83 contrôles,
  11 rouges** sur l'avant (« à annuler » toutes plateformes, zombies, alerte qui
  revenait), 0 après ; `audit-ebay-deja-vendue.cjs` (les vraies règles dans un
  `vm`) : 25 contrôles, et **7 réaffaiblissements sur 7** attrapés (`--prouve`).
- ⚠️ **Pas mesuré** : rien n'a été envoyé à eBay pour de vrai. La marge de 2 min
  entre l'horloge de l'appareil et `capturedAt` (serveur) est une précaution,
  pas une mesure du décalage réel.


### Plusieurs comptes eBay par vendeur, reliés par la seule connexion (9 octobre)
Julien (6 octobre) : « donne la possibilité d'avoir plusieurs comptes eBay
connectés, si c'est possible uniquement avec la connexion », puis « je veux que
l'on puisse sélectionner le compte dans l'onglet eBay, ou alors les deux comptes
en même temps, tous les trois s'il y en a trois ; les données doivent être bien
séparées ». Il a un compte particulier ET un compte pro.
- **L'identité d'un compte eBay** : au retour du consentement, la route demande
  à eBay QUI s'est connecté (Trading `GetUser` sans UserID : `<EIASToken>`
  stable, `<UserID>` = le pseudo). La clé = EIASToken haché (16 hexa) ; le pseudo
  ne sert qu'à l'affichage. Une identité, jamais une ressemblance (§5).
- **Chaque compte a SES lignes** : le premier (« principal ») garde les ids
  d'avant (`ebay_tokens`, `ebay_listings`, `ebay_orders`, `ebay_finances`,
  `ebay_programmees`, `ebay_inventory`, `ebay_retraits_auto`) — la ligne de
  Julien reste la sienne sans rien refaire, et son identité est apprise à la
  prochaine ouverture de l'onglet ou synchro. Les suivants : `…_{clé}`. Le
  registre `ebay_comptes` (pseudo, clé, dates — **aucun jeton**, aucun EIASToken
  brut) dit lesquels existent. On ne fusionne JAMAIS deux comptes dans une
  ligne : l'union n'existe qu'à l'affichage, chaque ligne marquée `_compte`.
  La règle du suffixe est la MÊME des deux côtés (`suffixeCompte` /
  `suffixeCompteEbay`, l'audit compare leurs sorties, §11).
- **Au retour** : même identité ⇒ ses jetons sont rafraîchis (aucun doublon) ;
  nouvelle ⇒ ajoutée ; ⚠️ identité illisible ⇒ seul le TOUT PREMIER compte garde
  le comportement d'avant, sinon refus, rien n'est rangé (« je n'ai pas pu savoir
  quel compte eBay vient de se connecter »). Identité du principal inconnue et
  impossible à apprendre ⇒ pas d'ajout. Registre illisible ⇒ refus AVANT même
  d'échanger le code. ⚠️ Sur le code d'avant, connecter un 2e compte ÉCRASAIT les
  jetons du premier (`A1=rt-A2` au banc) : c'est le mélange que ça empêche.
- **« Connecter un autre compte eBay »** (Compte eBay) : `prompt=login`, et
  l'intention (`.a`) est SIGNÉE dans le state (la retirer ⇒ refusé). Le nonce en
  cookie reste exigé.
- **Chaque action** prend `compte` (absent ⇒ principal), validé contre le
  registre de CE vendeur avant tout appel à eBay : inconnu ⇒ 404, mal formé ⇒
  400, déconnecté ⇒ 409, registre illisible ⇒ 503, celui d'un autre vendeur ne
  désigne rien. `deconnecter` (confirmé par la route aussi) vide SES jetons et le
  marque déconnecté ; ses lignes restent en base, il sort du sélecteur, de
  l'affichage, du CA et des sécurités ; le reconnecter le retrouve tel quel.
- **Anti double vente sur TOUS les comptes** : `dejaChezEbay` relit chaque
  compte actif chez eBay avec SON jeton ; « pas su » sur UN seul ⇒ rien ne part,
  le compte qui manque est nommé. Côté app, `dejaSurEbay`, `numerosDejaVendus`,
  `doublesVenteEbay`, le retrait automatique (qui part sur le compte de
  l'annonce), la baisse de prix et le centre de notifications lisent l'union.
  Une même paire en vente sur deux comptes est signalée (les deux annonces
  nommées, VRM ne choisit pas laquelle retirer).
- **L'onglet eBay** : la liste « Compte : Tous les comptes / un compte »
  (`ListeComptes`, la MÊME forme que celle des comptes Vinted, §11), seulement à
  partir de deux comptes ; réglage synchronisé `vrm_ebay_vue` (rattrapé par
  `onCloudReady` s'il est resté au défaut ; compte déconnecté ⇒ « Tous »). Un
  compte : TOUT (résumé, ventes, annonces, programmées, brouillons rattachés,
  soldes, alertes) ne porte que sur lui ; une alerte d'un AUTRE compte est
  COMPTÉE en une ligne, jamais disparue. « Tous » : l'union, le compte nommé sur
  la ligne seulement quand la liste en mélange plusieurs (§7), le résumé dit
  « · N comptes » ; un compte illisible est NOMMÉ, jamais un total partiel
  présenté comme complet. Publier / programmer : le compte est pré-choisi sur la
  vue (sinon le dernier utilisé, `vrm_ebay_compte_pub`) et la confirmation le
  NOMME. Le sélecteur ne change que ce qu'on VOIT.
- **L'argent** : le CA déclaré (`ventesDeclarables`, branche eBay), la coque et
  le bilan de la semaine (`api/ship-reminders.js` → `lireCommandesEbay`, une
  lecture `id=like.ebay_orders%` filtrée par le registre) comptent TOUS les
  comptes actifs ; un seul illisible ⇒ eBay « pas su ». La règle du miroir
  (`ventes-regle.js`) n'a pas bougé.
- La sauvegarde exclut `ebay_tokens*` (tous les comptes). Base PAS encore
  cloisonnée : inchangé (un seul compte ; « autre compte » refusé ; pas de
  GetUser).
- Preuves : `audit-ebay-route.cjs` **230 contrôles**, **36 rouges** sur le code
  d'avant ; trois mutations rouges (garde relisant le seul compte courant ⇒ 5 ;
  identité illisible rangée quand même ⇒ 1 ; compte non validé contre le
  registre ⇒ 7). `bancs/bilan-semaine.cjs` : + 2 contrôles (deux comptes ⇒ 942 €,
  pas le déconnecté), **2 rouges** sur l'avant. Banc `bancs/ebay-comptes.cjs`
  (port 4812, données inventées, 390 et 1512 px, trois comptes puis un seul) :
  **21 rouges** sur le build d'avant ; deux mutations de l'app, chacune rouge —
  filtre de vue retiré (`dansVueEbay` toujours vrai) ⇒ **12** (le compte 2
  voyait les ventes et annonces des trois, le résumé disait 623 € au lieu de
  210 €) ; garde de publication filtrée par la vue (`pris` limité au compte
  affiché) ⇒ la N°30, en vente sur le compte 1, **partait** sur le compte 2
  (2 rouges directs, 8 en cascade). ⚠️ Le bloc « un seul compte ⇒ aucun
  sélecteur » juge une ABSENCE : sur l'avant il tombe faute de l'attribut
  `data-ebay-vente`, pas du défaut — il ne prouve rien seul, c'est l'autre sens
  (le sélecteur EXISTE à deux comptes) qui porte.
  ⚠️ Deux bancs servaient une forme que le code ne lit pas (§6.3) :
  `ebay-callback.cjs` rendait `''` à une LECTURE (le retour relit maintenant le
  registre) ; `bilan-semaine.cjs` traduisait `like.ebay_orders%` en « au moins un
  caractère » (`%` puis `*` convertis deux fois) et ne rendait pas `ebay_orders`
  lui-même. `audit-ebay-retrait-auto.cjs` charge `corpsCompteEbay`.
- ⚠️ **NON MESURÉ — le premier essai réel se fera chez Julien** : `GetUser` n'a
  jamais été appelé pour de vrai (les noms `<UserID>`/`<EIASToken>` viennent de la
  doc d'eBay) ; `prompt=login` non plus (sans lui eBay reconnecterait en silence
  le compte ouvert — c'est la doc qui le dit). Si l'identité ne revient pas,
  l'ajout est refusé et l'écran le dit : rien n'est mélangé. Le geste de Julien :
  ouvrir eBay → Compte eBay (son pseudo doit apparaître), puis « Connecter un
  autre compte eBay » et se connecter avec l'autre compte.


### eBay : UN seul bouton pour mettre une paire en vente (4 octobre)
Julien : « il y a deux fois le bouton pour poster les paires, ça ne me convient
pas du tout ». **Mesuré** : le même publieur (`EbayPublier`, « Vendre une paire
sur eBay ») était monté dans **Annonces ET Compte eBay**. Le 3 octobre (#390) il
avait été « déplacé » vers Annonces en l'AJOUTANT là-bas, sans le retirer de
`EbayConnexion` — et la liste des annonces avec son « ✏️ Modifier » était elle
aussi écrite deux fois.
- **Mettre en vente et modifier vivent UNE fois, dans eBay → Annonces.** « Compte
  eBay » ne garde que la connexion, l'argent et un renvoi (« Voir mes
  annonces ») ; son titre ne dit plus « Publier ». `EbayLigne`, devenu sans
  appelant, est retiré (§4.11) — `EbayAnnonceCard` porte la modification.
- **Et le second chemin, mort, ne s'affiche plus** : la case « eBay » de « Publier
  aussi ailleurs » et la puce « À publier aussi sur eBay » remplissaient la file
  de l'EXTENSION (« Préparer sur eBay »), qui n'a plus aucun bouton depuis la
  5.130 — et la phrase dessous promettait une préparation que rien ne
  déclenche. `MP_PLACES` garde l'entrée (`ui: false` : `mpChoisi`, les audits et
  l'extension la lisent) ; l'écran ne montre que `MP_PLACES_UI`. Mesuré : **0 des
  401 fiches** avait coché eBay, rien n'est perdu.
- ⚠️ **Le côté extension (`ebay.js`, `buildEbayData`, `ebayPreparer`) n'est PAS
  retiré** : c'est le domaine de la session eBay, et ça impose un bump.
- Bancs : `ebay-form.cjs` **compte** les `[data-poster="ebay"]` sur les quatre
  sous-onglets (1, dans Annonces — **2 sur le build d'avant**) ;
  `annonces-carte.cjs` trouve la carte des places par son TITRE (un attribut
  absent du build d'avant aurait rendu le contrôle vert sur le défaut) — **4
  cases eBay sur le build d'avant, 0 après**. Au passage, `ebay-form.cjs` exigeait
  encore le bouton « Optimiser le titre avec l'IA », retiré exprès le 30
  septembre : il vérifie maintenant qu'il ne revient pas.


### ⚠️⚠️ « VENDUE HIER, RELIÉE, NI RETIRÉE D'eBAY NI PROPOSÉE » — LA PREUVE DE VENTE MANQUAIT (11 octobre, 5.169)
**Mesuré (lecture seule)** : la N°553 (tx 23052006117, angeled92) n'avait
**aucune** ligne `harvest_*_txn_*` — elle n'arrive que quand la conversation
est ouverte sur vinted.fr, geste que « Générer le bordereau » depuis l'app rend
inutile. Son bordereau (21:55) portait pourtant l'annonce, lue dans la
transaction puis **jetée**. Sur 18 ventes en cours, 6 seulement étaient
prouvées ; la règle a tourné 36 fois sans rien voir. Le retrait automatique est
**ALLUMÉ** dans sa base (il le croyait éteint).
- **Une règle, deux côtés** (`<preuve-vente-regle>`, identique dans l'app et
  l'extension, §11) : vente prouvée = transaction avec un état de commande qui ne
  la fait pas revenir, **ou** bordereau `harvest_{uid}_label_{tx}` (méta `tx`,
  `item` ; jamais `_latest`, méta contredite = doute) dont la vente est LUE dans
  les ventes du **même** compte, ni annulée, ni retour, ni `failed`. ⚠️ Jamais
  `item_closing_action: 'sold'` seul (mesuré : 10 « sold » n'ont que des
  transactions revenues). Les ventes ne sont lues que s'il reste un bordereau à
  juger ; toute lecture ratée ⇒ `null` / `echec` (« pas su »).
- **Extension 5.169** (⚠️ pas 5.167 : la 5.167.0 et la 5.168.0 PUBLIÉES par
  #471 et #472 n'ont pas ce code — voir la revue juste en dessous) :
  `recupererLabel` range la transaction qu'il lit
  (`rangerTransaction`, forme de `capterDatesVersement`, **zéro** requête de plus,
  une écriture par appel, jamais sous un autre numéro) ; `capterPreuvesVente`,
  après la moisson, lit la transaction des ventes en cours sans preuve
  (`gardeLecture` colis, file Vinted, 3 par visite, 6 h, compte du cookie,
  pause) et entre dans la réserve des lectures prioritaires (13 au lieu de 10 :
  `audit-budget-lectures` suit). `EXT_CAPACITES.preuves = '5.169.0'`.
- **Écran eBay → Annonces** : « N ventes Vinted en cours pas encore reliées à
  leur annonce » dit **une** fois, comptes nommés, le geste selon `extSait`
  (absente · retard · ok), seulement s'il y a une annonce reliée ; il se relit
  sur `maj preuves|label|ventes`. L'interrupteur dit **ALLUMÉ / ÉTEINT** en un
  mot, ce qu'il fait en son nom, et « … » tant que le réglage n'est pas relu du
  nuage (il affichait « éteint » sur un appareil neuf). Son choix n'est pas
  touché.
- ⚠️⚠️ **Le SKU passe par la numérotation — et un numéro PROVISOIRE n'est pas un
  ancien** : la 553 fait partie des « 553+ » renumérotés par la 013. ⚠️ Le premier
  correctif de ce chantier lisait `renum` sur un marqueur à l'ANCIENNE forme
  (liste d'identifiants) : sur la production convertie à 14:58 (carte PAR
  ANNONCE, `ebayAnnonces = { "128127336988": { "553": "1" } }`), « VRM-553 »
  restait « 553 » et la N°1 vendue ne déclenchait rien. **Abandonné à la fusion**
  au profit de `traductionAnnonce` d'integ-11oct (app, serveur, extension) —
  mesuré : « VRM-553 » → **1**, la paire 1 vendue ⇒ « à retirer ».
- **Preuves** : `audit-preuve-vente.cjs` (app + vrai `background.js`, même base
  inventée) **54 contrôles, 23 rouges** sur ef03dc8, **20/20 mutations**
  attrapées (74 contrôles et 26 mutations après la revue ci-dessous) ; banc
  `ebay-annonces.cjs` sert la vente par son **seul bordereau** (il servait une
  ligne txn : vert sur le défaut, §6.3), plus vente annulée et paire revenue :
  **23 rouges** sur le build d'ef03dc8, **16 rouges** sur un build réaffaibli
  (preuve par bordereau retirée + interrupteur sans « pas lu »), 0 après. Ses
  feuilles de confirmation attendent 20 s (en rendu logiciel à 1512 px, le voile
  flouté rend Playwright lent à juger un bouton « stable » — déjà rouge à 1512 px
  sur ef03dc8, ce n'était pas l'app). `BANC_PORT` choisit le port.
- ⚠️ **Non mesuré** : le délai réel entre la vente et la moisson (la preuve
  n'arrive qu'avec la visite suivante sur le bon compte) ; un LOT ne prouve que
  son `item` (les `items` d'un lot ne sont pas dans `meta`) ; rien n'a été
  envoyé à Vinted ni à eBay. Aucune notification « vendue ailleurs » n'existe (le
  contrôle ne tourne qu'app ouverte).
- **Geste de Julien** : terminer l'annonce eBay de l'Autry dans le Seller Hub si
  elle est encore en ligne ; décider s'il garde le retrait automatique ALLUMÉ ;
  installer la **5.169**.


### ⚠️⚠️ REVUE DU CHANTIER eBAY : L'INSTANTANÉ DE LA TRANSACTION, DEUX CONTENUS POUR UN NUMÉRO (11 octobre, 5.169)
Onze défauts reproduits par la revue (vm + Chromium, données inventées), corrigés
après une **vraie** fusion d'integ-11oct (aee8e5c : la 013 appliquée à 14:58).
- ⚠️⚠️ **LA TRANSACTION RANGÉE EST UN INSTANTANÉ, JAMAIS RELU.** Celle que le
  bordereau range dit « Bordereau envoyé au vendeur » pour toujours : une vente
  annulée ou **remboursée** ensuite restait « prouvée vendue » — la paire,
  revenue, sortait des files Leboncoin/eBay et partait au **retrait automatique**
  d'eBay (ALLUMÉ chez lui). Mesuré en production (lecture seule) : **46 preuves à
  un état non terminal sur 7 comptes, 5 contredites** par leur vente
  (« Le paiement a été validé » / « Remboursement effectué », failed).
  ⇒ Bloc partagé (§11) : un état **non terminal** ne prouve que si la vente du
  même `tx`, lue dans les ventes **du même compte** (relues à chaque visite),
  n'est pas revenue ; vente introuvable dans la liste lue ⇒ l'instantané tient ;
  « Commande finalisée » est terminal. Les comptes qui portent un tel instantané
  sont lus (`comptesAJuger(…, transactions)`), leur panne vaut « pas su ».
  ⚠️ Coût : les ventes de ces ~7 comptes (~190 Ko) sont lues à chaque
  construction de file — la correction avant l'égress.
- ⚠️⚠️ **DEUX CONTENUS SOUS LE MÊME NUMÉRO.** La 5.167.0 et la 5.168.0 sont
  **publiées** (#471, #472) **sans** `capterPreuvesVente` ; le chantier promettait
  à ces versions « l'extension va lire la transaction toute seule ». Extension
  **5.169.0**, `EXT_CAPACITES.preuves = '5.169.0'` ; l'audit exige « retard »
  pour 5.164/5.167.0/5.168.0. ⚠️ **À l'intégration : si un autre chantier a déjà
  pris 5.169, monter encore** — jamais deux contenus sous un numéro.
- **§11 : l'écran Leboncoin de l'app** gardait sa boucle sur les seules
  transactions ; il lit maintenant `lireVentesVintedProuvees` (même preuve que
  `buildLbcData` et l'écran eBay). Banc `lbc-preuve.cjs` (port 4913).
- **La ligne « pas reliées » d'eBay** ne fait plus tomber la preuve quand les
  ventes des AUTRES comptes ne se lisent pas (elle vaut `null`, la preuve reste) ;
  elle **nomme** chaque vente (titre), avec le lien vers **sa** conversation et,
  à poster, son bouton « Générer le bordereau » (un bordereau capté relie déjà
  la vente, même en 5.164) ; elle dit le **chiffre** (« 3 par visite », « au fil
  de tes visites » au-delà — `PREUVE_PAR_VISITE` = `PREUVE_MAX_PAR_VISITE`,
  comparé par l'audit). Le panneau d'état d'une 5.164 dit ce qui lui manque
  vraiment (« la preuve des ventes qui n'ont pas encore de bordereau »).
- **L'interrupteur du retrait automatique** suit le nuage à son arrivée
  (`v || …` ne pouvait jamais repasser à faux : éteint ailleurs, il affichait
  ALLUMÉ pendant que le retrait, lui, ne faisait rien).
- **Preuves** (rouge sur 6729407, vert après, rouge sous mutation) :
  `audit-preuve-vente.cjs` **74 contrôles, 9 rouges** sur l'avant, **26/26
  mutations** ; banc `ebay-annonces.cjs` (port `BANC_PORT`) **16 rouges** sur
  l'avant, 4 builds réaffaiblis rouges (interrupteur, capacité 5.167, rythme,
  nom de la vente) ; `lbc-preuve.cjs` **4 rouges**, 3 sur un build réaffaibli ;
  `tout-generer.cjs` **3 rouges**, 1 sur un build réaffaibli ;
  `audit-numerotation-lecteurs` (integ) + le serveur lit « 553 » → « 1 » sur la
  forme de la 013 appliquée (`repro` : « 553 » sur l'avant).
- ⚠️ **Non mesuré** : rien n'est parti chez Vinted ni eBay ; le DOM réel d'une
  conversation Vinted (`inbox/{conversation_id}`) n'est pas vérifié ici ; une
  vente remboursée APRÈS sa finalisation (état terminal) resterait prouvée — pas
  vu dans sa base.


### ⚠️⚠️ REVUE DU CHANTIER eBAY (11 octobre, 5.172) — LE NUMÉRO 5.169 ÉTAIT DÉJÀ PRIS, ET LA 5.170 DE PRODUCTION N'A PAS LA PREUVE
Treize constats d'une revue adverse, chacun **reproduit** (vm, Chromium, données
inventées) avant d'être corrigé. Fusion de `integ-11oct` (c7efee0, 5.170 servie
en production) dans le chantier.
- ⚠️⚠️ **Extension 5.172.0, `EXT_CAPACITES.preuves = '5.172.0'`.** La 5.170.0
  servie par main (PR #473) n'a **pas** `capterPreuvesVente` : avec le seuil à
  5.169, l'app lui promettait « l'extension lit sa transaction toute seule ».
  Et « 5.169 » désignait déjà le chantier extension (e7b-1, qui prend aussi la
  5.171). ⇒ `scripts/_versions-publiees.cjs` **lit l'historique** de main (sa
  première lignée, + la 5.164 installée hors main) ; `audit-coherence` refuse
  tout seuil ≤ une version servie sans la fonction (rouge sur 5e74f92 :
  « preuves 5.169.0 ≤ 5.170.0 ») ; `audit-preuve-vente` dérive de là ses
  versions publiées (la liste recopiée oubliait la 5.170) et refuse un numéro
  réservé (`RESERVEES`) ou déjà servi avec un autre contenu. Depuis une copie
  (§6.1) : `VRM_GIT=<dépôt>`, sinon « pas su » est **rouge**.
  ⚠️ **À la fusion avec e7b-1 : monter encore** (aucun des deux ne porte le code
  de l'autre).
- **La promesse « elle lit toute seule »** n'est faite qu'à une extension à jour
  **et connectée à CE compte VRM** (`connexionExtensionVrm`) : sans session, la
  visite s'arrête avant de lire (`visite_sans_session`). Sinon la ligne dit ce
  qui bloque avec **la phrase de l'indicateur** (`raisonExtGlobale`, §11 — les
  deux adresses quand c'est un autre compte) et le geste qui marche (ouvrir la
  vente).
- **La cloche relance l'anti double vente** sur `maj · label | preuves | ventes`
  (regroupé, au plus un recalcul / 5 s) : retrait automatique allumé, une preuve
  rangée pendant que VRM est ouvert retirait **rien** avant un rechargement — le
  flux même de la N°553.
- **Les ventes d'un AUTRE compte illisibles** sont nommées dans la ligne « pas
  pu lire » (avant : la ligne « pas reliées » disparaissait, l'écran d'une panne
  était celui où tout est relié) ; la preuve, elle, tient.
- **Pas de « Générer le bordereau »** sur une vente dont le bordereau est déjà
  capté sans l'annonce (le clic répondait « déjà fait » sans rien relier, et
  Ventes disait « prêt à imprimer ») ; ni **au doigt** (un bouton grisé muet).
- **Leboncoin** : une paire REVENUE (vente remboursée après une transaction
  figée) est « à publier » pour VRM mais « vendue » pour une extension
  antérieure à la règle de l'instantané — son « Publier » est **grisé** avec la
  raison, dite une fois (`LbcCroitVendue`), au lieu d'un refus au clic.
- Déjà corrigé avant la revue et **gardé** (preuves ajoutées) : transaction
  figée + vente remboursée ⇒ pas vendue (8239c6f) ; l'écran Leboncoin lit la
  même preuve (`audit-preuve-vente` §1 bis refuse désormais tout troisième
  lecteur de `status_title`) ; l'interrupteur suit le nuage ; la carte par
  annonce de la 013 (objet) — trois mutations « lue comme une liste ».
- **Preuves** : `audit-preuve-vente` 77 contrôles, **27/27 mutations** (12 rouges
  sur 6729407) ; `audit-coherence` (rouge sur 5e74f92 et sous mutation) ;
  `audit-numerotation-lecteurs` **42/42** (l'ancre `banniere-archive` suivait
  encore `onlineAnnonceIds`) ; banc `ebay-annonces` **153 contrôles**, 23 rouges
  sur le build de 5e74f92, 38 sur 6729407, rouge sous six mutations ; banc
  `lbc-preuve` cas D, 3 rouges sur 5e74f92, rouge sous mutation ;
  `audit-budget-lectures` recompté (réserve 13 = argent + colis + preuves).
- ⚠️ **Non mesuré** : la réponse réelle de Vinted et d'eBay (aucun appel) ; si
  Julien a d'autres extensions installées hors main que la 5.164.


### Leboncoin publié depuis VRM, Super PDP, titre eBay (16 octobre, 5.182)
- **Fiche Leboncoin dans l'app** (`FicheLbc`, Leboncoin → Annonces) : titre (50 car.), prix, état (4 libellés MESURÉS du dépôt, l'état Vinted, ou « laisser Leboncoin demander »), photos captées choisies et ordonnées, description qui garde `VRM-{n°}`. Un bouton publie ; l'avancement arrive en direct (`depotProgres`, nettoyé par le fond, seulement depuis l'onglet du dépôt en cours). Règle commune `<annonce-lbc-regle>` (texte identique app/extension) ; l'extension **revérifie** tout (`appliquerAnnonceLbc`) et refuse en entier une fiche invalide. Extension < 5.182 : une fiche non corrigée part « tel quel », une fiche corrigée est grisée. Preuves : `audit-lbc-fiche.cjs` (19 rouges sur l'avant), banc `lbc-publier-app.cjs`. ⚠️ **Non mesuré sur le vrai leboncoin.fr.**
- **Super PDP** (facturation électronique, Comptabilité) : mode `superpdp` de `/api/compte` (toujours 12 fonctions), identifiants du VENDEUR vérifiés chez Super PDP puis rangés **chiffrés** (`superpdp_cle`, clé `VRM_COFFRE_CLE` ou dérivée de `SUPABASE_SERVICE_KEY` ; sans clé de coffre : rien n'est rangé), jamais relus par le navigateur (§2.9). Envoi à trois issues (envoyée · refusée · incertaine), `external_id` = n° FX-AAAA-NNNN, une incertaine est CHERCHÉE avant tout renvoi. E-reporting PAS branché (forme non confirmée). ⚠️ **Formes d'API tirées d'un client open source** (la doc officielle est bloquée d'ici) : à vérifier sur le bac à sable. Preuves : `audit-superpdp-route.cjs` (36 rouges sur l'avant), banc `superpdp.cjs`.
- **Titre eBay** : `lbcTitre` écrit désormais « taille 36 » (plus « T36 ») ; `ebayTitre` ne retirait que « T36 » ⇒ « taille 36 taille 36 » (capture de Julien). `audit-titre-ebay.cjs` (6 rouges sur l'avant).
- **Refonte premium** (coque mobile `styles-coque.css`, Réglages iOS `styles-reglages.css`, Achats/Messages, Annonces/Leboncoin/eBay, Ventes/Colis) : bancs `coque-mobile`, `reglages-premium`, `achats-messages-premium`, `plateformes-premium`, `ventes-colis-premium`. ⚠️ Sur téléphone sans extension, le fil de Messages remplace la saisie par « Répondre sur Vinted ↗ ».


### Double vente, app fermée : la notification part du serveur (17 octobre)
Fonction n°2 retenue le 11 octobre. L'alerte « vendue sur Vinted → encore en
vente sur eBay / Leboncoin » ne se calculait que VRM ouvert. `api/email-inbound`
envoie maintenant une notification dès qu'une vente Vinted arrive par email
(bordereau, « ton article s'est vendu »), **si et seulement si** la paire est
PROUVÉE en vente ailleurs. Règle pure : `api/_lib/double-vente.js`.
- **Identité par le N° seulement** (§5) : le N° LU dans l'email (après le
  jugement 013 de `numeroDEmail`). Le N° retrouvé par ressemblance de titre
  (`findNumeroByTitle`, `parTitre`) sert à tamponner le bordereau, **jamais** à
  affirmer une double vente.
- **eBay** : SKU `VRM-{n°}` d'une annonce de `ebay_listings*` (comptes eBay
  actifs du registre, `comptesActifs`), traduit par la carte 013 PAR ANNONCE
  (`numeroExterne`, `ebayAnnonces`) — la règle de `numEbayLu`.
  **Leboncoin** : annonce à lui (`annonceLbcALui`, comptes prouvés par ses
  ventes), pas morte, pas vendue sur Leboncoin, clé = lien posé à la main ou
  référence VRM (réf / CustomRef), traduite par `lbcAnnonces`. ⚠️ Plus strict que
  l'app, exprès : le « nXXX » d'un TITRE Leboncoin n'est pas retenu (ressemblance,
  et ancien numéro possible après la remise à zéro).
- **Pas su ⇒ rien** : marqueur 013, registre eBay, annonces eBay, annonces ou
  ventes Leboncoin illisibles ⇒ la plateforme concernée ne dit rien ; base
  cloisonnée sans vendeur résolu ⇒ rien (une lecture sans filtre lirait tous les
  vendeurs). Rejeu en lot (`silence`) ⇒ rien.
- **Une seule fois** : `pushOnce` (mémo `push_dedup`, lire-fusionner-réécrire
  gardé). Clé = N° + annonces rencontrées (`dv-230-ebay:1111`) : le bordereau et
  l'email « vendu » d'une MÊME vente, ou un email rejoué, ne sonnent qu'une fois.
  ⚠️ Décision : pas la transaction — l'email « vendu » n'en porte pas, et les
  deux emails d'une vente doivent tomber sur la même clé.
- **Contenu** : « ⚠️ Vendue sur Vinted — N°230 encore en vente sur eBay » /
  « {paire} — N°230 est encore en vente sur eBay : retire-la… », ouvre
  `?tab=ebay_annonces` (ou `?tab=leboncoin`). Rien n'est retiré tout seul.
- **Préférence `doublevente`**, activée par défaut, la même dans `PUSH_CATS` (app)
  et `PUSH_DEFAUT` (serveur) — `audit-bilan-semaine.cjs` compare les deux.
  Abonnement coupé ⇒ rien (`sendPushToAll`). Aucun cron, toujours 12 fonctions.
- **Coût** : la lecture des annonces ne part que pour une vente qui porte un N°
  et une catégorie active. Projetées (`data->items`, jamais `select=data`), mais
  `lbc_listings` pèse ~226 Ko : quelques ventes par jour, accepté.
- **Preuves** : banc `scripts/bancs/double-vente-push.cjs` (la vraie route, base
  cloisonnée à deux vendeurs, faux Web Push, 26 contrôles) — **11 rouges** sur
  l'avant (§6.1, copié dans l'arbre d'avant) ; `--mutation=titre` (N° par titre
  compté) 1 rouge, `--mutation=passu` (lecture ratée = vide) 2 rouges,
  `--mutation=dedup` (envoi direct) 1 rouge.
- **Non mesuré** : la forme réelle des lignes `ebay_listings` / `lbc_listings` en
  production (lues telles que la synchro et l'extension les écrivent) ; un
  `ebay_listings` incomplet ne fait que MANQUER une alerte (le sens sûr) ; une
  annonce retirée d'eBay à la main sans synchro reste « en vente » jusqu'à la
  synchro suivante (fausse alerte possible, le temps d'une synchro).
- **Julien** : rien — la catégorie est activée d'office (Réglages →
  Notifications pour la couper).


### Plateformes plus vivantes, ventes même vides, eBay plus complet (17 octobre)
Demande de Julien du 17 octobre (chantier 6 : eBay, mise en page, ventes, annonces).
- **En-tête des plateformes** : une tuile de marque (la marque dans SA couleur
  sur un fond pâle de la même teinte, `COULEUR_PLATEFORME`, masque CSS sur
  `/brands/*.svg`), puis le nom. Ce sont les seules couleurs de marque de
  l'écran (§7). **eBay : la tuile seule** — son logo EST son nom écrit, et le
  titre le répétait (« deux logos eBay »). Le nom reste pour les lecteurs
  d'écran (`.vrm-sr`). Styles dans `src/styles-plateformes.css`.
- **Ventes en trois cases, même sans vente** (`KpiVentes`, `data-ventes-kpi`) :
  Leboncoin (en cours · finalisées · CA finalisé) et eBay (en cours · expédiées ·
  CA payé). Une case LUE et vide vaut 0 ; une case qu'on ne sait pas vaut « — »
  (Leboncoin jamais lu, un compte eBay illisible). Sur « Ventes », le résumé du
  haut se tait : il disait les mêmes montants (§7). Vinted avait déjà les siennes.
- **Publication eBay pré-remplie depuis la paire** : choisir une paire LANCE
  l'analyse eBay (catégorie + caractéristiques, une lecture) sans second clic.
  ⚠️ **Corrigé le 17 oct. (5.186)** : le dressing PORTE la marque (`brand`,
  372 sur 373 — « 0 sur 271 » lisait le mauvais champ, `brand_title`, que
  l'allègement jetait). Elle est lue là d'abord ; repli : le **coffre**
  (`coffre_{uid}_{id}.brand`, 401 fiches sur 632), lu en scalaires et paginé.
  L'état Vinted de l'annonce (`status`) donne l'état eBay (`etatEbayDeVinted` :
  neuf avec étiquette → 1000, neuf sans → 1500, occasion → 3000), seulement vers
  un état de la liste d'eBay pour la catégorie. Une marque ou une pointure
  enregistrées par Vinted remplissent aussi un champ eBay en texte libre (un
  FAIT, jamais une déduction du titre). Sans description captée, la description
  écrit les faits (`descriptionDeFaits` : titre, marque, pointure, état, VRM-n°),
  rien d'inventé.
- **Annonces eBay : moins de texte.** Le pourquoi d'une alerte (double vente,
  programmée à annuler, deux comptes, annonce pas reliée) est replié derrière un
  « ⓘ » (`Pourquoi`) ; le titre, les gestes et ce qui dit un risque propre à la
  donnée (une règle d'offre) restent visibles.
- **Pro ou particulier, eBay** : `identiteEbay` lit
  `User.SellerInfo.SellerBusinessType` (Commercial → pro, Private → particulier,
  sinon « pas su », jamais « particulier » par défaut), rangé dans le registre
  `ebay_comptes` (`type`, `typeLuLe`) à la connexion, et pour les comptes déjà
  reliés par `apprendreTypes` (une question par compte, à l'ouverture de
  « Compte », relue au plus tous les 7 jours si eBay ne l'a pas dit). Affiché à
  côté du pseudo et dans le sélecteur de compte. ⚠️ **Non mesuré sur ses
  comptes** (doc d'eBay). `audit-ebay-type-compte.cjs` : 5 rouges sur l'avant.
- **Évaluations à laisser (eBay → À traiter)** : `GetItemsAwaitingFeedback`
  (lecture) et `LeaveFeedback` positive (eBay ne permet que celle-là au vendeur),
  80 caractères, sur clic + confirmation, la vente RELUE avant d'écrire
  (acheteur différent ou plus en attente ⇒ 409, rien ne part), journalisée comme
  les autres actions commerciales. ⚠️ Forme XML de la doc, non mesurée.
  `scripts/bancs/ebay-gestion.mjs` : rouge sur l'avant ; `plateformes-premium.cjs`
  joue Annuler (rien ne part) puis la confirmation (une fois, les bons champs).
- **Retirer l'argent** : Vinted → Ventes, « Retirer mon argent » dit le
  disponible COMPTE PAR COMPTE (`walletParCompte`) et ouvre le porte-monnaie
  Vinted (`/wallet/balance`, ⚠️ adresse non mesurée). ⚠️⚠️ **VRM ne fait PAS le
  virement** : son navigateur a vu `POST /api/v2/users/{id}/payouts`
  (`seen_urls`), jamais la FORME de la demande — envoyer de l'argent sur un
  contenu deviné est interdit. eBay : le disponible est viré tout seul par eBay ;
  le bloc le dit et ouvre « Mes versements » (`/sh/fin`, non mesuré).
- **Inventaire eBay** (ce que la route sait faire) : ventes + expédition et
  suivi, messages acheteurs (lire, répondre, écrire), offres reçues (accepter,
  refuser, contre-offre), offre aux observateurs, règle d'offre, annonces
  (publier, programmer, modifier prix/stock/titre, terminer, relier à une paire),
  brouillons, finances, retrait automatique, évaluations. **Pas fait** :
  retours et annulations (Post-Order API : authentification et forme non
  mesurées), annonces sponsorisées (Marketing API), achats eBay.


### Leboncoin et eBay dans le bénéfice, par identité seulement (19 octobre)
- `ventesAutresBenefice` (module) relie une vente à SA paire : eBay = SKU de
  chaque ligne par `numLigneEbay` → `numEbayLu` (lien VRM, carte 013 par
  annonce) ; Leboncoin = `numeroLbcIdentite` (lien posé à la main, sinon
  référence VRM de l'annonce traduite par `numeroExterne` — JAMAIS le « nXXX »
  d'un titre, contrairement à `clesAnnonceLbc` qui sert aux propositions). Prix
  d'achat = `achatDe(withBuyByNum(fiche))` seulement si UNE fiche porte le N°
  (`ficheUniqueDuNumero`). Sans identité : comptée, sans prix d'achat.
- Même règle (`ajouterVenteBenefice(…, plateforme)`) dans `totals` (Ventes) et
  la publication `vrm_benefice_jours` (`v: 2`, 12 nombres par jour : +
  `fraisInconnus, nL, nCoutL, nE, nCoutE` ; une publication `v: 1` se relit).
  Frais : Leboncoin 0 (prix final capté), eBay `totalMarketplaceFee` (EUR) sinon
  `null` = pas su ⇒ net « — » (`raison: 'frais'`), jamais 0. Leboncoin, eBay ou
  les annonces Leboncoin (lues seulement si une vente n'a pas de lien) pas lus ⇒
  aucune publication ; Ventes le dit (`data-ventes-benef-autres="passu"`).
- Le CA finalisé, les boosts et la marge de Ventes restent ceux de la liste
  Vinted. Comptabilité dit la couverture par plateforme (`couvertureBenefice`,
  `data-benef-couverture`) ; en `v: 2` les cotisations portent sur le CA déclaré
  des trois plateformes (`caBeneficeDuMois`), en `v: 1` sur Vinted seul.
- Mesuré (lecture seule) : 0 commande eBay, 3 ventes Leboncoin non finalisées et
  sans date — rien ne change aujourd'hui chez lui.
- Preuves : `audit-benefice.cjs` 40 contrôles ; `--mutation=titre|ambigu|
  fraiszero` ⇒ 4 · 4 · 2 rouges. Banc `chiffres-croises.cjs` E3-E5 : 8 rouges sur
  le build d'avant, 2 sous la mutation « eBay sans SKU relié par le titre ».
- Non mesuré : la vraie forme de `totalMarketplaceFee` dans ses commandes (aucune
  commande en base) ; une commande eBay de plusieurs lignes n'a un prix d'achat
  que si toutes ses lignes sont reliées.


### La vente eBay arrive dans Colis, Ma journée, la cloche, le widget et le rappel du matin (19 octobre, agent eBay K7 en partie)
« Rien ne se passe après une vente eBay » (etat.md) : une commande eBay payée n'était visible que dans eBay → Ventes. État K par K, lu dans le code : `docs/passation/notes/agent-ebay/etat.md` (en tête).
- **Une règle** `colisEbay` (`api/_lib/ebay-a-expedier.js`, importée par l'app ET le serveur, §11) : à poster = `etatCommandeEbay(o).peutExpedier`, pas d'annulation demandée, un envoi (`fulfillmentInstructionsType` SHIP_TO ou absent — jamais un colis caché) ; « Ne poste pas » = annulation demandée (inconnue ⇒ demandée) ; date limite `lineItemFulfillmentInstructions.shipByDate` (ancien nom lu en repli — `ebay-agent.js` ne lisait que lui) ; authentification d'eBay signalée. `null` = pas su, jamais `[]`.
- **Lecteurs** : Colis (bloc « Ventes eBay à poster » : N° par le SKU via `numLigneEbay`, jours, emplacement, « Étiquette sur eBay ↗ » vers `ebay.fr/sh/ord/details?orderid=` — adresse NON mesurée —, « Suivi et message à l'acheteur » → `?tab=ebay_ventes` + `DEMANDE_EBAY_CIBLE` ; « Ne poste pas » en tête, → `?tab=ebay_agent` ; total du haut Vinted + eBay ; âge des commandes au-delà de 6 h), Ma journée (« À envoyer » au même nombre, `data-ebay`), `vrm_colis_aposter` (+ `ebay`, `nePasPoster`), `api/widget.js` (`ship.total` comprend eBay, `ship.ebay`, `ship.auMoins`), `api/ship-reminders.js` (rappel aussi pour un vendeur eBay seul, sans mémo quand rien n'est lisible ni à dire), bilan du lundi (« au moins » si eBay illisible). L'étiquette se prend DANS eBay (§2.8) : VRM n'achète rien.
- ~~Les commandes eBay ne se relisent que sur synchro~~ — **depuis le 20 octobre elles se relisent toutes seules** (section « eBay se relit tout seul » juste en dessous) ; Colis dit toujours leur âge.
- Preuves : `audit-ebay-colis.cjs` (règle + vraies routes widget et rappel, 9 rouges sur 65eec06, 3 mutations rouges) ; banc `ebay-colis.cjs` (`BANC_PORT`, 390/1512, 28 rouges sur le build de 65eec06, mutation « Ma journée sans eBay » rouge). Aucun appel réel à eBay ; formes de l'API Fulfillment tirées de la doc.


### eBay se relit tout seul : à l'ouverture, toutes les ~10 min, et au cron du matin (20 octobre)
Julien : « pour eBay ça doit se relire tout seul ou se rafraîchir à l'ouverture de l'app, mais je dois rien avoir à faire ».
- **App ouverte** (`relireEbaySiVieux`, `useRelectureEbay` monté dans `AppCoeur`, session obligatoire) : à l'ouverture, chaque minute tant que l'app est VISIBLE, et au retour au premier plan, chaque compte eBay actif dont `ebay_orders.capturedAt` (lu en scalaire, **en base** : partagé entre appareils) a plus de **10 min** est relu par `POST /api/ebay {action:'relire'}`. Un appel en vol par onglet, verrou de 2 min entre onglets (`vrm_ebay_relecture_vol`, commodité d'appareil). « Pas su » (base ou eBay) ⇒ rien n'est vidé et on recule par compte : 10, 20, 40, 60 min (`vrm_ebay_recul`) ; sans connexion eBay : 6 h ; principal sous-entendu sans ligne `ebay_orders` : jamais appelé. Après une relecture rangée : `vrm:ebay-maj` — `useComptesEbay` rend une nouvelle référence (eBay → Ventes, Annonces, la coque relisent), Colis et Ma journée (`ebayTick`) et la cloche (`preuveTick`) relisent, sans recharger.
- **`action:'relire'`** (`handleRelire`, toujours 12 fonctions) : mesuré dans le code, la synchro complète coûte par compte 3 appels + jusqu'à 20 GetItem + l'Inventory API + la réécriture des règles d'offre ; `relire` fait **deux lectures** — la page 0 des commandes (`relireCommandesCompte`, `api/_lib/ebay-relecture.js`, même fusion `fusionCommandesEbay` en comparer-et-échanger que `handleSync`) et un `GetMyeBaySelling` (annonces en ligne + programmées : l'anti double vente lit leur SKU). Le `detail` déjà rangé d'une annonce est gardé par itemId ; ancienne ligne illisible ⇒ annonces pas réécrites ; règles d'offre et stock non touchés (la synchro complète, sur clic ou aux 6 h, reste).
- **App fermée** : `api/ship-reminders.js` relit les commandes eBay de CHAQUE vendeur (`relireCommandesVendeur` : comptes actifs de SON registre, SON jeton chacun) **avant** de compter le rappel et le bilan du lundi ; borné à 20 s par vendeur (8 vendeurs en parallèle, comme avant) ; un échec ne bloque rien (dernière capture, « au moins » comme avant) ; le bilan du cron porte `ebayRelu` (nombres, aucun jeton). Pas de nouveau cron.
- Aucune règle d'argent ni de colis changée (`colisEbay`, `montantRecuEbay` intouchés).
- Preuves : banc `ebay-relecture.cjs` (port `BANC_PORT`, 390 tactile + 1512, horloge pilotée, données inventées) **30 contrôles, 18 rouges sur le build d'origin/main** ; mutation « borne de 10 min retirée » ⇒ appels multiples (rouge). Banc `ebay-relecture-cron.cjs` (vraies routes `ship-reminders` et `ebay` `relire`, base cloisonnée à 2 vendeurs, faux eBay) **14 contrôles, 6 rouges sur origin/main**.
- ⚠️ **Non mesuré** : les quotas d'appels eBay réels (au pire 2 appels par compte toutes les 10 min par vendeur dont l'app est ouverte, + 1 par compte au cron) ; la durée réelle d'un `GetMyeBaySelling` sur son compte ; rien n'a été envoyé à eBay pour de vrai.


### eBay → Annonces → « Inactives » : les annonces terminées sans vente (23 octobre)
Julien : « est-ce que les onglets de l'app eBay sont dans VRM ? ». Il manquait les
INACTIVES (annonces terminées SANS vente, qu'eBay garde 60 à 90 jours).
- **Décidé (ne pas rediscuter)** : LECTURE SEULE. VRM ne remet RIEN en vente
  (`RelistFixedPriceItem` peut coûter des frais d'insertion, §2-§3) ; chaque ligne
  mène à SA page eBay (`https://www.ebay.fr/itm/{ItemID}`, ItemID validé).
- **Route, aucun appel de plus** : `<UnsoldList>` (Include, `DurationInDays` 60,
  page 1 de 200) part dans le MÊME `GetMyeBaySelling` que la page 1 des annonces en
  ligne, et seulement pour la synchro et la relecture sans geste
  (`listeVendeur(token, {invendues:true})`) ; `dejaChezEbay`, les règles d'offre,
  les programmées : inchangés — une inactive n'entre JAMAIS dans `actives`.
  Rangée dans une ligne DÉDIÉE par compte, `ebay_inactives{_clé}` (⚠️ pas
  `ebay_listings_*` : deux lecteurs balaient cette famille), chez le vendeur de la
  session (`modifierDonnee` → `portee(owner)`, comparer-et-échanger), projetée (`resumeInactive` : ItemID, SKU
  hors variantes, titre, prix + devise, fin, début, observateurs, photo
  `i.ebayimg.com` seulement, `RelistedItemID`), `{items, complet, jours, capturedAt}`.
  ⚠️ **À L'INVERSE des deux autres listes, un `UnsoldList` ABSENT vaut « pas lu »**
  (`invendues: null`) : rien n'est écrit, la dernière capture reste ; une réponse
  ratée aussi. `<UnsoldList/>` ou un conteneur à 0 entrée = « lue vide ».
  `lu.inactives` dans la réponse (l'app n'en juge pas la synchro).
- **Écran** : une section « Inactives sur eBay » SOUS les programmées
  (`EbayInactives`, `outilsSuite` : visible même sans annonce en ligne), chargée
  seule (`lireEbayParCompte`, `select` scalaires, `->>` en texte). États
  `data-ebay-inactives` = `charge · jamais · vide · ancienne · lu · pas-su` ; « Inactives (N) »
  (`data-ebay-inactives-n`) seulement si TOUS les comptes de la vue sont lus et la
  liste entière, « au moins N » si eBay en a plus (`data-ebay-inactives-aumoins`),
  un compte illisible nommé (`data-inactives-illisibles`) sans aucun nombre. Pas
  d'eBay relié et rien de rangé ⇒ pas de section. La vue suit le compte choisi
  (`vue`), le compte nommé sur la ligne seulement si la liste en mélange (§7).
  Ligne : photo, N° SEULEMENT par le SKU (`numEbayLu` avec la date de PUBLICATION :
  avant la remise à zéro ⇒ série B ; sinon « pas reliée », jamais par titre),
  prix, « terminée le … » (`data-inactive-fin`, jour de Paris), observateurs.
  ⚠️ « Retirer d'eBay » une paire vendue sur Vinted l'envoie DANS cette liste :
  « Remettre en vente sur eBay ↗ » (`data-inactive-relancer`) n'est proposé ni pour
  une paire vendue ailleurs (`numerosDejaVendus`, `data-inactive-vendue`), ni déjà
  de retour sur eBay (`dejaSurEbay` ou `RelistedItemID`, `data-inactive-deja`), ni
  tant que les ventes ne sont pas vérifiées (dit une fois, `data-inactives-verif`) —
  le lien devient « Voir sur eBay » (`data-inactive-voir`). « encore en ligne sur
  Vinted » par identité (`data-inactive-vinted`). Une inactive reliée fait lire la
  preuve de vente (`aVerifier`). Aucune couleur rouge.
- **Preuves** : `audit-ebay-route.cjs` section 14 « [INA] » (même appel, ligne
  dédiée, vendeur et compte, « pas lu » n'écrase rien sous trois formes, page 2 non
  demandée, une inactive ne bloque pas publier/programmer, ni `programmees` ni
  `regleoffrelire` ne la demandent, aucun Relist/AddItem envoyé ni écrit dans
  `api/`) : **14 rouges sur 789401d**, 10 mutations de la route toutes rouges
  (absent = vide, appel séparé, ligne sans suffixe, fusion dans `actives`, tous les
  appelants, photo non filtrée, owner de l'installation, remise en vente glissée,
  détail brut, « pas lu » rangé vide). Banc `bancs/ebay-inactives.cjs` (port
  `BANC_PORT`, 390 tactile + 1512, données inventées, 44 contrôles) : **43 rouges
  sur le build de 789401d** (le 44ᵉ y lève), et 8 mutations de l'écran rouges.
  ⚠️ §6.3 : `ebay-parcours.mjs` exécute `handleSync` dans un `vm` avec ses
  dépendances injectées — il sert maintenant `rangerInactives` (sinon
  `ReferenceError`, sur une route intacte).
- ⚠️ **Non mesuré — rien n'a été envoyé à eBay** : la forme de `UnsoldList` vient
  de la doc d'eBay (présence de `WatchCount`, `GalleryURL`, `EndTime`, `SKU`,
  `RelistedItemID`, la limite réelle de `DurationInDays`) ; surtout, qu'eBay émette
  `<UnsoldList>` quand il n'y a AUCUNE inactive — s'il l'omet, la section reste
  « jamais lue » (« se lit à la prochaine relecture ») pour un vendeur sans
  inactive. Le cron du matin ne relit pas les annonces : la liste se rafraîchit
  avec la synchro et la relecture (≤ 10 min, app ouverte).
- **Julien** : rien. La section se remplit à la prochaine relecture eBay.

#### Revue du 23 octobre — treize constats, tous reproduits, corrigés
Chaque constat REPRODUIT d'abord (la vraie route dans le harnais
d'`audit-ebay-route`, l'écran rendu sur données inventées), puis corrigé ; rouge
sur a9115c0 (copie `git archive`, contrôle lancé DEPUIS elle, §6.1), vert après,
rouge sous mutation. Décision gardée : un `UnsoldList` absent vaut « pas lu »
(on ne range jamais du vide) — c'est l'ÉCRAN qui dit l'âge de la capture.
- ⚠️⚠️ **Une capture figée se présentait comme la liste du jour** (n° 1 et 3) :
  95 jours, une annonce finie il y a 100 jours sous « ces 60 derniers jours »,
  « Inactives (1) » et « Remettre en vente ». Route : `rangerInactives` ne range
  que les fins dans les 60 jours (fin illisible gardée). Écran : une capture de
  plus de 24 h (`INACTIVES_FRAICHE_MS`), ou plus vieille de 15 min
  (`INACTIVES_ECART_MS`) que les annonces en ligne du même compte (la route les
  range dans le MÊME appel : eBay ne l'a pas rendue), est `ancienne` :
  « Lue le … — pas relue depuis » (`data-inactives-anciennes`,
  `data-inactives-lue-le`, jour de Paris), aucun « (N) », « Voir sur eBay »
  seulement, ni « ces 60 derniers jours » ; une ligne hors fenêtre n'est jamais
  montrée (`dansFenetreInactives`). « Jamais lue » se dédouble
  (`data-inactives-jamais` = `pas-relue` · `non-rendue`) : une relecture des
  annonces DÉJÀ faite sans la liste ne promet plus « la prochaine relecture »
  (eBay ne l'émet peut-être pas sans inactive — non mesuré).
- **Course synchro / relecture** (n° 2) : la capture est datée au DÉPART de la
  question (`tListe`, `t0`), écrite par `modifierDonnee` qui refuse de remplacer
  une capture plus récente (la règle du `lueA` des règles d'offre).
- **La même ItemID en ligne ET inactive** (n° 4) : sa ligne dit « état à relire
  chez eBay » (`data-inactive-deja="a-relire"`), plus « déjà de nouveau en
  vente » ; `deja` n'est retenu que pour une AUTRE ItemID ou un `via`. Route : la
  relecture ne range les inactives que si `ebay_listings` a été rangée par le
  même appel.
- **« 95,00 € USD »** (n° 5) : `prixEbayTexte` (la règle de la carte des
  annonces, §11) — « 95,00 USD », aucune devise ⇒ aucun symbole.
- **§7** (n° 6) : une panne déjà dite par l'écran (ventes : `pasSu` de la ligne
  du haut, `pasSuVentes` de `bloqueCommun` ; registre eBay illisible) n'est pas
  redite — `dejaDit`, une pastille « pas lue », `data-inactives-dit="ecran"`.
- **Un compte lu vide + un jamais lu** (n° 7) : `vide` (« aucune … sur X ») +
  « pas encore lue pour Y » — plus « Pas encore lue » pour tout.
- **Cinq trous de banc** (n° 8 à 12, le code était juste) : marqueur 013 (VRM-21
  publiée avant la coupure ⇒ B21, jamais 21) et `numberedAt` après publication
  (« pas reliée ») ; ventes EN COURS de lecture (requêtes retenues : aucun
  « Remettre en vente ») ; un compte jamais lu ⇒ aucun « (N) » ; une paire à
  l'annonce Vinted FERMÉE n'est pas « encore en ligne sur Vinted » ; une fin à
  23 h 30 UTC = le lendemain à Paris. **n° 13** (audit) : photos
  `i.ebayimg.com.evil.test`, `http://i.ebayimg.com/…`, `evil.test/?u=i.ebayimg.com`
  doivent être vidées.
- **Preuves** : `audit-ebay-route.cjs` **502 contrôles, 5 rouges sur a9115c0**
  ([INA-fenetre], [INA-course], [INA-coherence], et l'écriture par
  comparer-et-échanger, sync et relire) ; cinq mutations de la route, chacune
  rouge : fenêtre retirée (1), garde « plus récente » retirée (1), date prise à
  l'ÉCRITURE (1, [INA-course2] : la relecture partie avant une synchro, écrite
  avant elle), couplage retiré (1), regex photo non ancrée (4) ; l'ANCIEN audit
  sous la regex non ancrée : les mêmes rouges que sur la route juste (le trou
  n° 13 reproduit). Banc `bancs/ebay-inactives.cjs` (`BANC_SEUL=A,H,…`)
  **80 contrôles, 28 rouges sur le build de a9115c0** ; quatorze mutations de
  l'écran, chacune rouge sur SON scénario (capture jamais ancienne 6 · écart de
  15 min retiré 2 · fenêtre retirée 2 · même ItemID ignorée 2 · prix « € USD » 2 ·
  §7 ventes 2 · §7 registre 2 · mixte rabattu sur « jamais » 2 · N° sans date 4 ·
  ventes en cours ignorées 2 · « (N) » avec un compte jamais lu 2 · « sur
  Vinted » sans identité 4 · jour UTC 2 · sous-état unique 2) ; l'ANCIEN banc
  sous les mutations des trous n° 8 à 12 : exactement le même verdict que sur
  l'écran juste (42 OK, 2 KO dus à un attribut déplacé) — le trou reproduit.
- **Non mesuré** : qu'eBay émette `<UnsoldList>` vide (sinon « pas encore rendue
  par eBay » reste pour un vendeur sans inactive) ; rien n'a été envoyé à eBay.


### eBay après la vente : retours, annulations, promotion, achats (17 octobre)
Suite du chantier eBay (« toutes les fonctionnalités d'eBay dans l'app »). Module `api/_lib/ebay-apres-vente.js`, actions de `api/ebay.js` (toujours 12 fonctions) : `retours`, `annulations`, `deciderretour`, `rembourserretour`, `decannulation`, `promotion`, `promouvoir`, `changertaux`, `arreterpromo`, `achats`. Écran : eBay → À traiter (« Retours et annulations », en tête), et deux sous-onglets **Promotion** et **Achats** (`EbayRetours`, `EbayPromotion`, `EbayAchats`, dans `src/ebayGestion.jsx` ; l'ancien `EbayAchats` « pas captés » est retiré).
- **Retours / annulations (Post-Order v2, `Authorization: IAF <jeton>`)** : lecture rôle vendeur ; accepter/refuser un retour (refuser exige un motif ; seulement à l'état `RETURN_REQUESTED`, relu chez eBay) ; rembourser = le montant que l'écran a VU doit être celui qu'eBay annonce ENCORE (centimes et devise), sinon 409 ; déjà remboursé ⇒ rien ne repart ; accepter/refuser une annulation (`CANCEL_REQUESTED|PENDING` relu, commande vue = commande eBay). **Une annulation acceptée marque la commande rangée `CANCELED`** (`annulerCommandeRangee`, comparer-et-échanger sur `ebay_orders`) ⇒ `etatCommandeEbay` la sort des colis à faire tout de suite.
- **Promotion (Marketing v1, campagnes « coût par vente »)** : lecture des campagnes RUNNING EBAY_FR et de leurs annonces ; promouvoir (crée une campagne « VRM » sur CE clic s'il n'y en a aucune), changer le taux (taux VU relu), arrêter. Taux 2–100 %, une décimale. Les frais sont dits (« prélevés uniquement si la paire se vend par la promotion »). Jamais automatique. Droit `sell.marketing` ajouté aux SCOPES : il n'arrive qu'au prochain consentement ; sans lui l'écran dit « reconnecte ton compte eBay ».
- **Achats** : Trading `GetMyeBayBuying` (WonList, 60 jours), lecture seule.
- Tous les gestes : `confirme` exigé AVANT le jeton, journalisés (`executerAvecJournal`), coupure/5xx ⇒ `incertain` ; droit refusé ⇒ « reconnecte », forme inattendue ⇒ « illisible », jamais une liste vide.
- Preuves : `scripts/bancs/ebay-apres-vente.mjs` (53 contrôles, faux eBay à la forme documentée ; rouge sur l'avant ; mutations « montant non revérifié » et « commande pas marquée » ⇒ rouges) ; `scripts/bancs/ebay-apres-vente-ecran.cjs` (port `BANC_PORT`, 390/1512 px, 16 contrôles par taille ; 8 rouges sur le build d'avant).
- ⚠️ **Non mesuré** (rien envoyé à eBay) : chemins, champs (`members`, `cancellations`, `sellerTotalRefund`, `ads`, `responses`), états (`RETURN_REQUESTED`, `CANCEL_REQUESTED`) et l'en-tête IAF viennent de la doc d'eBay ; que le jeton OAuth actuel ouvre la Post-Order API (sinon « reconnecte ») ; le droit `sell.marketing` accordé au keyset de production.


### Une paire, une proposition : jumelles par photo, « Description » retirée, cartes à publier (17 octobre)
Julien : la N°80 et la N°81 proposées toutes les deux, publiée deux fois sur eBay ; « Description » dans le texte eBay ; visuel des paires à publier.
- **« Description »** : libellé collé capté de la page Vinted (« Descriptionautry reelwind… »). `descriptionEbayPropre` (sur `lbcDescription`, copie partagée non touchée) le retire aux trois entrées eBay (paires, choix de paire, brouillon) ; une description qui n'est QUE le libellé vaut vide. Jamais une vraie description.
- **Jumelles par PHOTO EXACTE** (`jumellesParPhoto`, clé `photoKey` du fichier : 0 collision mesurée, jamais le titre, §5) : deux fiches au même fichier de photo sont la même paire. eBay : `dejaSurEbay` porte la jumelle (`via`) ⇒ « Publier », le planificateur et la liste refusent la seconde (« déjà sur eBay sous la N°X, même photo ») ; la liste ne propose qu'une des deux (celle déjà sur eBay, sinon l'annonce la plus récente) et le DIT (`data-jumelles-masquees`). Leboncoin : la file garde les mêmes N° que l'extension (§11), la jumelle est marquée et n'a pas de bouton Publier (`data-apub-jumelle`).
- **Cartes** (`vrm-apub-carte`, styles-plateformes.css) : photo, N°, prix, titre, pastilles, vignettes, un bouton Publier, liens ; grille 1/2/3 colonnes ; sombre par les variables de la coque.
- ⚠️ **Mesuré (lecture seule)** : la N°80 et la N°81 n'existent PAS dans `main` — la ligne n'est plus écrite depuis le 11 octobre 14:58 (pool 558 B + 1…24 ; 208 POST `app_data` en 500 en 24 h, timeouts 57014 à 8 s). Les fiches 25 et suivantes, prix d'achat et réglages ne vivent que sur ses appareils : deux appareils peuvent donner deux N° à la même annonce — cause probable du 80/81. **Pas corrigé ici** (production en lecture seule) : à traiter en priorité.
- Preuves : banc `cross-post.cjs` (port 7210, données inventées, eBay + Leboncoin 1512/390/sombre) **19 rouges sur 9b55e48**, 0 après ; `lbc-preuve`, `ebay-*`, `plateformes-premium`, `lbc-publier-app`, `annonces-carte` et tous les audits verts.
- ⚠️ Banc en sombre : la bascule « Minéral » (`vrm_bascule_mineral_v1`, un drapeau de `localStorage`) remet `vinted_dark` à faux à l'arrivée du nuage ; un banc sombre doit poser ce drapeau.


### Achats Leboncoin et eBay sur la forme des achats Vinted (19 octobre)
Julien : « les achats Leboncoin et eBay doivent fonctionner exactement comme Vinted ». Une ligne d'achat (`LigneAchat`, classes `vrm-buy-row`) : photo · titre · statut à pastille (mêmes mots et couleurs qu'`etapeAchat`) · date · prix · gestes.
- **Leboncoin** (`etapeAchatLbc`, `LigneAchatLbc`) : Annulé · Reçu · En transit · étape capturée, lue sur ce que capte l'extension (`lbcAnnulee`, `lbcFinalisee`, `lbcExpediee`). En route : « Suivre » (`label.trackingUrl`) et le QR du colis (`label.qrUrl`, `QrColis`) dépliable — seulement si capturés.
- **eBay** (`EbayAchats`) : même ligne ; `achatsEbay` lit en plus la photo (`i.ebayimg.com` seulement), `PaidTime`, `ShippedTime` et le suivi déclaré par le vendeur (numéro + transporteur). Étape : Expédié · Payé · À payer — jamais « Reçu » (eBay ne le dit pas ici). Lien « ↗ » vers l'annonce.
- Preuves : `plateformes-premium.cjs` (écran Leboncoin → Achats, 2 tailles) 8 rouges sur 1023dd4 ; `ebay-apres-vente-ecran.cjs` 7 rouges sur 1023dd4 ; `ebay-apres-vente.mjs` vert.
- ⚠️ Non mesuré : que `GetMyeBayBuying` rende `PictureDetails`, `ShippedTime` et `ShipmentTrackingDetails` dans la WonList (doc d'eBay) — absents ⇒ rien n'est affiché.


### Toucher une case à cocher sur téléphone ne la cochait pas (19 octobre)
`BottomBar` cachait la barre du bas dès qu'un `<input>` prenait le focus — y compris une case à cocher ou un bouton radio, qui n'ouvrent aucun clavier. Au toucher, la barre disparaissait, l'écran sautait de 22 px entre l'appui et le relâchement, et le geste retombait à côté : la case « J'ai compris » du planificateur eBay ne se cochait pas (banc `ebay-programmer`, 6 rouges hérités, à 390 px seulement). Seuls les champs à clavier cachent la barre maintenant (`SANS_CLAVIER`). `ebay-programmer` et `coque-mobile` verts.


### Revue argent eBay (20 octobre) — cinq défauts, reproduits sur la vraie route puis corrigés
Relecture adverse de tout ce qui engage de l'argent ou une vente sur eBay ; chaque soupçon REPRODUIT avec la vraie route (`audit-ebay-route.cjs`, faux eBay) ou les vraies règles de l'app dans un `vm`. Rien n'a été envoyé à eBay.
- ⚠️⚠️ **Le prix envoyé n'était pas le prix vu** : « 1.250 » partait 1,25 €, « 74,999 » 75,00 €, « 74 € » en NaN ; 0, −5 et 1e3 acceptés. `prixLu` (euros, 2 décimales au plus, au moins un centime) pour publier, vérifier, programmer et changer un prix — 400 `prix` sinon.
- ⚠️⚠️ **« Livraison gratuite » possible (§2.8)** : sans `ebayGere` explicite, le port partait à 0,00 ; un tarif fixe à 0 ou absent passait. `livraisonDe` : livraison gérée par eBay sauf `ebayGere === false`, et un tarif fixe exige un port non nul (400 `port`).
- **Changer un prix (`revise`) ne revérifiait rien** : le prix VU (`prixVu`) est exigé, relu chez eBay avant d'écrire (illisible ⇒ 503 `pas-su` ; autre devise ⇒ 409 `devise` ; changé ⇒ 409 `prix-change`) ; quantité `/^\d{1,6}$/`. L'app envoie `prixVu` (baisse des paires qui dorment) ; un brouillon au prix illisible n'est plus programmable.
- **Colis eBay cachés** : une commande payée ni expédiable, ni annulée, ni remboursée en entier, ni expédiée (remboursement PARTIEL, instructions inconnues) n'apparaissait nulle part. `colisEbay` la rend dans `aVerifier` ; Colis : « commandes eBay à vérifier avant de poster » (`data-ebay-a-verifier`), lien vers eBay.
- ⚠️⚠️ **Le port dans le CA, le vendu, le CA payé et le bénéfice eBay** : ils lisaient `pricingSummary.total` (ce que paie l'acheteur, port compris). UNE règle, `montantRecuEbay` = `paymentSummary.totalDueSeller` − `totalMarketplaceFee` (décision du 3 octobre) pour `ventesDeclarables`, `ventesFaites`, `caEbayPayees` et `ventesAutresBenefice` (frais 0 : déjà retirés) ; montant ou frais inconnus, autre devise ⇒ commande ÉCARTÉE et dite (`ecartees` du CA déclaré, `data-ca-ebay-ecartees` sur Ventes, CA payé « — »). Miroir `ventes-regle.js` refabriqué par `--recopie`. `fraisEbayCommande` retiré.
- Preuves : `audit-ebay-route.cjs` section 13 « L'ARGENT » (467 contrôles) — **19 rouges sur 04d96f9** ; mutations prixLu 10, livraison 2, prix vu 2, à vérifier 2 rouges. `audit-revue-argent.cjs` section D — **10 rouges sur le code d'avant** (« 153 » au lieu de 122,50 € reçus, frais inconnus et dollars comptés) ; mutations `port-compris` 9, `frais-ignores` 6, `faites-ecartees-tues` 1. `audit-benefice --mutation=port|fraiszero` rouges. Bancs servant une forme que le code ne lit plus (§6.3) mis à la forme de l'API Fulfillment (dû + frais + total acheteur port compris) : bilan-semaine, chiffres-croises, vendu-recu, rapport, compta-abonnements, ebay-comptes, ebay-write (le faux eBay répond au `GetItem` de la relecture).
- **Rejetés après vérification** : contrôle « déjà vendue » côté serveur (l'app garde : `gardePublier`, `numerosDejaVendus`) ; retrait automatique (le SKU est relu chez eBay) ; rembourser un retour (montant et devise comparés en centimes) ; annulation (état relu) ; promotion (confirmation, taux relu) ; répondre à une offre et modifier une annonce (`expectedPrice`) ; jetons (par compte, `jetonDe`) ; aucune option payante dans `itemXml` ; une quantité > 1 est son choix.
- ⚠️ **Pré-existants, laissés** : `prouve-regle-offre.cjs` a 6 ancres périmées (déjà rouges sur 04d96f9) ; `ebay-comptes` (2, « le pseudo est sur la ligne »), `plateformes-premium` (1, cibles « Gérer » 32 px), `ebay-visuel` (2, point de statut), `revendeurs` et `compact` (délai d’attente) — tous rouges À L’IDENTIQUE sur origin/main.
- ⚠️ **Non mesuré** : la réponse réelle d'eBay à un mauvais prix ; que `GetItem` rende la devise de `CurrentPrice` ; la forme réelle d'une commande `PARTIALLY_REFUNDED` ; la vraie forme de `paymentSummary.totalDueSeller` (0 commande eBay en base) — en livraison gérée par eBay, s'il contenait le port, il faudrait le retirer aussi. **Julien** : rien au-delà du déploiement.



### eBay à l'international : où part chaque colis, et la douane (26 octobre)
Julien : « marketplace mondiale… frais de port, douane, envois internationaux ».
**Mesuré (lecture seule)** : 0 commande eBay en base ; aucun e-mail de vente ou
de message Leboncoin/Vestiaire (seulement de la pub, « nouvel appareil »,
« suppression de vos annonces ») — sans l'extension, il n'y a RIEN à capter
par e-mail pour ces deux sites. Tout l'eBay de VRM est réglé sur eBay.fr
(SiteID 71, EUR, `Country FR`) et la publication part en livraison GÉRÉE par
eBay (son compte refuse tout `<ShippingDetails>`) : l'international se règle
dans le Seller Hub (programme de livraison internationale), pas par l'API.
- **`destinationEbay(o)`** (`api/_lib/ebay-a-expedier.js`, lu par `colisEbay`,
  §11) : programme d'eBay (`ebaySupportedFulfillment`) ⇒ on poste au centre en
  France, eBay fait la douane, pays final = `finalDestinationAddress` ; la
  garantie d'authenticité porte le MÊME drapeau et n'est pas internationale ;
  envoi direct hors UE ⇒ déclaration CN22 (CN23 > 425 €). Pays illisible ⇒
  `null`, jamais « France ». Le code pays seulement, jamais nom ni adresse.
  `resumeColisEbay` rend `international`.
- **Colis** : une ligne `LigneDestinationEbay` (`data-colis-ebay-dest` =
  programme · douane · ue) sous chaque vente eBay concernée ; rien pour la France.
- Preuves : `audit-ebay-destination.cjs` 14 contrôles (rouge sur l'avant ;
  mutations « authentification ignorée » 2, « douane jamais due » 3) ; banc
  `ebay-colis.cjs` + vente vers le Royaume-Uni (390 et 1512).
- **Non mesuré** : une vraie commande internationale (doc de l'API Fulfillment).
- **Pas fait, à trancher** : vendeurs eBay.co.uk/.com (site, devise et règles
  d'argent en EUR seulement) ; options internationales à la publication pour un
  compte NON géré (`ShipToLocations`, `InternationalShippingServiceOption`).


### eBay.co.uk, eBay.com (et .de, .it, .es) : chaque compte sur SON site (26 octobre)
Julien : « lance eBay UK et US ». Tout l'eBay de VRM était figé sur eBay.fr
(SiteID 71, `EBAY_FR`, EUR, `Country FR`, liens ebay.fr).
- **Une table** `api/_lib/ebay-marches-table.js` (pure, lue par l'app ET la
  route, §11) : FR 71/EBAY_FR/EUR · GB 3/EBAY_GB/GBP · US 0/EBAY_US/USD · DE 77 ·
  IT 101 · ES 186. `api/_lib/ebay-marches.js` (serveur) y ajoute le marché de la
  REQUÊTE (AsyncLocalStorage, jamais une variable de module).
- **Le site d'un compte est lu chez eBay** (GetUser → `User.Site`, `identiteEbay`)
  et rangé dans le registre `ebay_comptes` (`site` : code, `'?'` site non géré,
  `''` pas dit, absent = jamais lu ⇒ eBay.fr, le comportement d'avant).
  `apprendreTypes` relit aussi les comptes sans site.
- **La route** (`handleApp`) fait tourner chaque action dans le marché du compte :
  SiteID de Trading, `X-EBAY-C-MARKETPLACE-ID`, catégories (`marketplace_id`),
  devise et pays de l'annonce (`itemXml`), seuils d'offre, liens rendus, après-vente.
  L'anti double vente relit chaque compte sur SON marché. **Créer une annonce**
  (publish, pubverify, pubinfo, programmer) est REFUSÉ pour un site non géré
  (409 `marche-non-gere`) ou un registre illisible (503 `marche-pas-su`) : jamais
  publié en France à la place. `status` rend `site`, `siteLu`, `marche`.
- **L'app** : badge « eBay.co.uk » à côté du compte (rien pour eBay.fr, §7),
  sélecteur « paire_pro · eBay.co.uk », « Prix (GBP) » dans le formulaire, liens
  commande et annonce sur le bon domaine, solde dans sa devise.
- ⚠️ **L'argent reste en euros** : le CA déclaré, le bénéfice et les totaux ne
  convertissent pas (une commande en GBP/USD est ÉCARTÉE et dite, `montantRecuEbay`)
  — l'URSSAF est française. Un vendeur UK verra « — » sur le CA eBay en euros.
- Preuves : `audit-ebay-route.cjs` §10 ter « [MKT] » (511 contrôles ; 7 rouges sur
  l'avant ; SiteID figé à 71 ⇒ 2 rouges) ; banc `ebay-comptes.cjs` (« Prix (GBP) »,
  badge dans le sélecteur).
- **Non mesuré** : la valeur réelle de `User.Site` (doc SiteCodeType) ; aucun
  compte UK ou US relié ; les règles de chaque site (catégories, états, livraison
  gérée) viennent d'eBay au moment de publier ; l'interface reste en français.

