# Historique — favoris-messages

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> ⚠️⚠️ **29 octobre — LEBONCOIN COMME VINTED : capture juste, « à retirer » visible, Supprimer, Republier, favoris (5.288) :**
> Julien : « il n'y a plus que 2 annonces et VRM en a encore 8 », « j'ai vendu une paire sur Vinted et VRM ne m'a pas dit de
> la supprimer », « je veux pouvoir supprimer une annonce de Leboncoin », « trop brouillon… mêmes méthodes d'affichage que
> Vinted », « un outil de republication… exactement pareil », « les messages aux favoris » (Leboncoin SEULEMENT, rien côté
> Vinted), « enlève N° », « regarde l'onglet Messages ». **Mesuré (lecture seule)** : sa page « Mes annonces » ne charge plus
> `myads` mais `POST api/dashboard/v1/search` (filtre `owner.user_id`) — ses annonces passaient sans jamais DÉCIDER, une
> annonce supprimée/expirée ne sortait jamais ; la N°18 vendue sur Vinted le 18 oct. restait « en vente » sur Leboncoin (Ma
> journée ne comptait que les ventes marquées à la main, l'écran sautait un N° porté par une annonce Vinted encore
> « ouverte ») ; le bouton « Supprimer » de Leboncoin envoie `DELETE …/pintad/v1/public/manual/delete/ads {list_ids:[n]}`
> (vu dans `lbc_recon.envois` le 28 oct. 22:47). **Fait** : (1) une liste « Mes annonces » COMPLÈTE (requête sur lui seul,
> chaque annonce à lui, total atteint) sort ce qu'elle ne montre plus (`plusVueAt`, jamais « vendue ») ; une page partielle
> ne décide rien ; une suppression/pause faite sur leboncoin.fr (2xx) est vue et rangée. (2) `aRetirerDeLbcVinted` : vendue
> sur Vinted (transaction → annonce, prime sur l'état de l'annonce) ⇒ « à retirer de Leboncoin », par identité seulement
> (lien posé, réf VRM) ; écran Leboncoin + Ma journée ; l'app publie `lbc_a_retirer`, le logo VRM sur leboncoin.fr dit
> « c'est cette annonce ». (3) « Supprimer de Leboncoin » (`supprimeLbcDepuisApp`) : son clic + confirmation « sans retour »
> (rouge), confirmation exigée aussi par l'extension, compte Leboncoin de l'onglet vérifié, une à la fois, 10/h, adresse
> écrite en dur dans `lbc-inject.js` ; 2xx ⇒ supprimée, refus ⇒ « pas fait », silence ⇒ « je ne sais pas ». Pas de relais
> téléphone. (4) Ventes sans « N° » (il reste dans le tiroir), Mes annonces avec point d'état (en ligne · pause · plus vue ·
> vendue), « en ligne depuis », chiffres relevés (favoris, vues, messages ; jamais 0 pour un chiffre pas relevé) ; Messages à
> deux zones comme Vinted, une ligne par compte, le geste « connecte-toi une fois » dit UNE fois. Onglets : Ventes · Achats ·
> Annonces · Messages · Colis. (5) Republier (Choisir · Modifier · Republier) : supprimer (confirmé) → retirer la marque
> « publiée » → publier la fiche, attendre la confirmation de Leboncoin avant la suivante ; seulement quand la recréation
> passe les règles de la file ; un refus ou un doute arrête tout. (6) **Favoris : Leboncoin ne dit PAS QUI** — mesuré : seuls
> des NOMBRES (`stats/proxy/v2/classified/history/daily` : TotalFavorites, Views, TotalMessages ; `followme/v1/followers-number`
> = un compte d'abonnés ; `followme/v1/follower-targeting/eligibility` = `{eligible, reasonCode}`, geste natif jamais vu
> s'exécuter) ; aucune requête d'envoi aux favoris vue. ⇒ « ♡ Favoris reçus » montre le nombre par annonce en vente, « — »
> sans relevé, et dit que VRM n'écrit à personne. L'extension relève déjà chemins, formes et envois (jamais les valeurs).
> **Preuves** : `audit-lbc-mes-annonces` (14 rouges sur l'avant, 11 mutations), `audit-lbc-a-retirer` (9, 5/5),
> `audit-lbc-supprimer` (19, 8/8), bancs `lbc-pause`, `badge`, `lbc-supprimer` (16 rouges sur l'avant), `lbc-comme-vinted`
> (390/1512 ; 39 rouges sur l'avant, + « geste dit une fois » rouge sur l'avant). Extension **5.288.0** (5.282, 5.284, 5.285, 5.286 et 5.287 prises sur
> main), `EXT_CAPACITES.lbcsupprime` / `.lbcstats`. **Non mesuré** : le vrai leboncoin.fr (403 d'ici) — réponse réelle d'une
> suppression demandée par VRM, une liste « Mes annonces » de plusieurs pages, ce que fait le ciblage des abonnés.
> **Gestes de Julien** : installer la 5.288 (remplacer le dossier, puis ⟳ dans chaque Chrome) ; ouvrir « Mes annonces » sur
> CHACUN de ses comptes Leboncoin (la liste complète fait sortir les annonces disparues) ; pour un chiffre de favoris, ouvrir
> « Statistiques » de l'annonce ; s'il veut que VRM sache écrire à ses abonnés, utiliser UNE fois à la main le geste de
> Leboncoin qui cible les abonnés (s'il lui est proposé) : l'extension en relèvera la forme pour la passe suivante.
> **Revue (29 oct., soir)** — 11 défauts de deux relecteurs, tous reproduits puis corrigés : « Supprimer » à l'encre
> neutre (§7) ; la vente eBay ne désigne une annonce Leboncoin que par le lien ou la référence VRM (plus le « n15 » du
> titre), et pause/suppression ne sont proposées que sur une ligne reliée par identité ; Ma journée et le logo VRM lisent
> la MÊME preuve que l'écran (transaction seule — plus `vinted_annonces_email_sold`), rien avant l'arrivée des numéros,
> aucune ligne vide publiée ; « Voir » de Ma journée amène la paire à l'écran ; une suppression marquée (forgeable par la
> page) est levée au bout d'1 h par une capture ou une liste complète qui montre l'annonce vivante ; le cache du logo est
> lié au compte VRM ; Republier sur ordinateur sans extension dit la vraie cause ; Messages et « relevé » sans date ;
> identifiants réels retirés des audits. Preuves : banc `lbc-supprimer` **11 rouges** sur la branche d'avant, 6 sous
> mutation ; `lbc-comme-vinted` 4 ; `audit-lbc-mes-annonces` +3 contrôles (3 mutations neuves), `audit-lbc-a-retirer` +1.
> **Revue 2 (29 oct., nuit)** : (a) main a publié SA 5.287 (numéros des profils) — ce chantier passe en **5.288.0**
> (`lbcsupprime`/`lbcstats` à 5.288 : une 5.287 de main ne sait ni supprimer ni relever les chiffres) ; (b) « vendue sur
> eBay ⇒ à retirer de Leboncoin » : UNE règle (`aRetirerDeLbcEbay`, `numerosVendusEbay`) pour l'écran ET Ma journée —
> l'annonce reliée par identité a ses gestes, celle reliée seulement par la marque « publiée » RESTE listée sans geste
> (« retire-la toi-même », `data-lbc-ebay-sans-ident`) ; avant, l'écran la faisait disparaître pendant que Ma journée la
> comptait (« Voir » menait à un écran vide). Banc `lbc-supprimer` : 4 rouges sur la branche d'avant, 4 sous mutation
> (lignes sans identité retirées de l'écran).

> **29 octobre — MESSAGES : l'XT-6 qui « ne voulait pas s'enlever », « Retirer de la liste » ; plafond d'actions laissé à 50 :**
> Julien : « un message d'une XT-6 qui ne veut pas s'enlever, je veux que ça dégage » et « mets plus d'actions par heure sur
> chaque compte ». MESURÉ (lecture seule) : une conversation captée il y a six semaines porte une offre au statut 10 (« en
> attente ») sur une annonce qui n'est PLUS dans son dressing (lu en entier depuis) — la pastille et le tri « une offre passe
> devant » la gardaient en tête pour toujours. ⇒ Une RÈGLE, pas une exception : `annonceOffreEnVente` / `offreOuverte`
> (`src/offresVinted.js`, la même pour la liste et le fil, §11) — annonce absente d'une lecture COMPLÈTE (`total_entries`
> atteint, ou relecture publique complète, `lectureDressingComplete`) du dressing de CE compte, faite APRÈS l'offre ⇒ l'offre
> n'est plus « en attente » (ni pastille, ni filtre « Offres », ni tri en tête ; le fil dit « l'annonce n'est plus en vente »,
> sans Accepter). « Pas su » la GARDE : annonce à confirmer, masquée, brouillon, compte pas lu, lecture partielle ou antérieure
> à l'offre, offre sans date (`Number(null)` valait 0 : trouvé par l'audit). Mesuré : ses 12 dressings portent leur total.
> ⇒ Le geste « Retirer » dans le fil (`src/conversationsRetirees.js`, `vrm_conversations_retirees` synchronisée, identité compte
> + conversation) : elle sort de la liste et des non-lus de VRM, rien ne change sur Vinted, elle REVIENT dès qu'il s'y passe du
> nouveau (message, offre acceptée ou refusée — revue 3) ; « Les remettre » sous la liste. ⇒ **Plafond d'actions : ce chantier l'avait monté à 30/h ; une autre session
> l'a monté le même jour à 50/h sur la demande EXPLICITE de Julien (« comme Vintex », 5.283, voir plus bas) — cette décision
> gagne, le 30 est abandonné à la fusion, l'extension n'est pas touchée ici.** ⚠️ **angeled92 a été restreint 24 h le 29 oct.
> pour « activité automatisée » après une republication** : le plafond haut est SON choix, en connaissance de cause.
> Preuves : `audit-offre-annonce-partie.cjs` (28 ; `--prouve` 9/9), banc `messagerie.cjs` (XT-6, « pas su » des deux sortes,
> Retirer → remettre → revient sur une date plus récente, 390/1512) ; `audit-supprimees` charge `lectureDressingComplete`.
> ⚠️ Non mesuré : sa vraie conversation XT-6 dans l'app (données inventées à sa forme). **Geste de Julien** : une conversation
> dont il ne veut plus : l'ouvrir → « Retirer ».
> **Revue (29 oct., plus tard) — neuf constats, tous reproduits puis corrigés :** la règle ne juge QUE ses ventes
> (`side === 'seller'`, projeté dans `OFFRES_CONV_SELECT`) — une contre-offre reçue quand il ACHÈTE porte l'annonce du
> vendeur, elle était dite « plus en vente » et perdait Accepter (mesuré : `current_user_side` présent sur toutes les
> conversations à offre, 9 côté acheteur) ; la bulle de l'offre suit la règle (`offrePartieDuFil` : « Plus acceptable »,
> plus « En attente ») et « plus en vente » n'est dit qu'une fois (la bande d'état) ; le bloc porte le bouton « Retirer de
> la liste » (44 px) et l'en-tête garde le MOT « Retirer » sur téléphone ; pas de réponse rapide « toujours disponible »
> sous une annonce partie ; une conversation dont le dernier message est une offre close sort de « À répondre » ; le
> point « nouveau » de Messages suit le geste sans recharger (`msgNonLus`, `vrm:save`) ; plus de toast (il couvrait « La
> remettre » et redisait la ligne). Preuves : `audit-offre-annonce-partie.cjs` 36 (8 rouges sur la branche d'avant,
> `--prouve` 10/10), banc `messagerie.cjs` (contre-offre 311, bulle, une voix, bouton du bloc, À répondre, point).
> ⚠️ **Mesuré, pas corrigé** : aucune durée de vie d'une offre Vinted n'existe dans ses données (aucun champ d'expiration ;
> statuts vus : 10, 20, 30, 40) — une autre offre « en attente » du 12 août, sur une annonce TOUJOURS en ligne, reste en
> tête : à retirer à la main (« Retirer »). ⚠️ Le premier commit du chantier (f7214427) citait des identifiants réels dans
> un commentaire (retirés depuis) : **fusionner en squash**.
> **Revue 2 (29 oct., soir) — cinq défauts d'écran et de règle, reproduits puis corrigés :** (1) une recherche qui ne
> trouvait QUE la conversation retirée disait « Aucun résultat » ⇒ la ligne sous la liste dit « 1 conversation correspond
> à ta recherche, mais tu l'as retirée », avec « La remettre » ; (2) à 390 px « Retirer » coupait le nom du COMPTE dans
> l'en-tête du fil ⇒ le titre de la paire se coupe, le compte jamais (`.vrm-chat-head-compte`, `data-fil-compte`) ;
> (3) un fil d'offre dont l'annonce est partie portait deux fois le même geste ⇒ seul « Retirer de la liste » du bloc
> reste ; (4) la ligne « conversation retirée » était collée au bord du panneau ⇒ même marge que les lignes ; (5) une
> conversation retirée REVENAIT sans nouveau message quand le fil ouvert était plus récent que la boîte (sa propre
> réponse) ⇒ le geste garde la plus récente des deux dates (`majAuGeste`, une date future ignorée). Preuves :
> `audit-offre-annonce-partie.cjs` 41 (`--prouve` 12/12, dont `boite-seule` et `futur-retenu`), banc `messagerie.cjs`
> (recherche, compte lisible mesuré par une Range, un seul geste, marge) : rouges sur la branche d'avant, verts après.
> **Décidé pour lui** : une offre « en attente » sur une annonce TOUJOURS en ligne garde sa pastille et sa place en tête,
> quelle que soit son ancienneté (aucune expiration mesurée chez Vinted) — c'est « Retirer » qui la sort. Plafond :
> **50/h** (décision de main, « comme Vintex »), pas 30. **Geste de l'intégrateur : fusion en squash** (f7214427 porte
> deux identifiants réels dans son historique).
> **Revue 3 (30 oct.) — « elle revient dès qu'un nouveau message arrive » était FAUX :** MESURÉ (lecture seule) : la date
> de la boîte n'est pas celle du dernier message — Vinted la déplace quand une offre est acceptée ou refusée, ou sur un
> évènement du suivi, sans ajouter de message (224 conversations sur 871 dont la boîte est plus récente que le dernier
> message d'un fil capté APRÈS elle ; 149 où ce dernier message est l'offre, statut 20 ou 30) ; et la boîte ne porte aucun
> aperçu de message (`description` = le titre de l'annonce). Rien, à la seule lecture de la boîte, ne prouve qu'un message
> est arrivé ⇒ **décidé : la règle reste** (le sens sûr — une conversation retirée revient sur un doute, jamais un acheteur
> caché) et l'écran dit la vérité, d'une seule phrase (`RETOUR_CONVERSATION` / `phraseRetour`, §11) : « elle revient dès
> qu'il s'y passe du nouveau (un message, une offre acceptée ou refusée) » — titre du bouton, ligne sous la liste,
> recherche. L'XT-6 n'est pas touchée (son offre ne changera plus d'état). Preuves : `audit-offre-annonce-partie.cjs` 46
> (le cas mesuré : offre 22:34, Retirer 23:00, boîte relue à 23:10 sans message ⇒ elle revient ; la phrase le dit),
> **3 rouges sur la branche d'avant**, `--prouve` 13/13 (`phrase-message-seul`). **Geste de Julien** : si une conversation
> retirée revient après qu'il a accepté ou refusé l'offre sur Vinted, la retirer encore une fois.

> **29 octobre — ÉCRANS VINTED : grandes photos, état en jauge, calendrier « comme Airbnb », offres auto, pastille (app seule) :**
> Julien : « augmente la taille des photos », « l'état plus original avec à côté la saisie du prix d'achat », « toutes les infos
> des 3 petits points », « un calendrier comme Airbnb » pour les périodes, « accepter les offres automatiquement… c'est moche »,
> « améliore la pastille Actions possibles / Lecture seule ». **Fiche d'annonce** : au téléphone UNE fiche par rangée (photo
> ≈ 360 px), à l'ordinateur côte à côte (≥ 330 px) ; l'état en **jauge à cinq barres** (`src/carteAnnonce.js`, `etatVinted` :
> les cinq libellés MESURÉS chez lui le 29 oct. — 131 « Très bon état », 18 « Bon état », 4/2/2 —, comparés EN ENTIER ; inconnu ⇒
> affiché tel quel sans niveau ; aucun ⇒ « — ») et le prix d'achat saisi À CÔTÉ (`EnLigne data="achat"`, le même geste) ; le
> « ⋯ Gérer l'annonce » est retiré : ses gestes (`data-fiche-gestes`, 44 px au doigt) et ses infos sont à la vue. **Calendrier**
> (`src/ChoixPeriode.jsx` + règle pure `src/periodeCalendrier.js`) : deux mois côte à côte à l'ordinateur, un calendrier qui
> défile au doigt (feuille), raccourcis 7 jours · 30 jours · ce mois · mois dernier · cette année, deux touchers puis Appliquer,
> plage dite en clair ; UN composant pour Ventes, Achats et la période du CA (`PeriodePicker` n'est plus qu'un nom ; Compta « Semaine · Mois · Trimestre · Année » reste un segment : c'est la période de DÉCLARATION, pas une plage libre) ; la valeur
> garde sa forme `{from, to, label?}` lue par `dansPeriodeDate` (§11, aucun filtre réécrit). **Offres automatiques** : une
> ligne (statut + interrupteur), le texte derrière ⓘ ; comportement INCHANGÉ (éteindre sans question, allumer demande).
> **Pastille Actions** : ton, chevron, panneau avec en-tête et la chaîne des maillons, même source (`etatActionsExt`, sur `raisonExtGlobale`). Rien sur
> les favoris (sa demande). Preuves : banc `vinted-ui.cjs` (port `BANC_PORT`, données inventées, 390 tactile + 1512, clair et
> sombre) **68 rouges sur le build d'origin/main (634932dd)**, 0 après ; mutations rouges : deux fiches par rangée au téléphone,
> saisie d'achat non enregistrée, allumer sans confirmation, raccourcis écrasés dans la feuille, ton du panneau d'une autre
> source. `audit-choix-periode.cjs` (règles exécutées, 32 contrôles ; 5 rouges sur origin/main ; `--prouve` 9/9). Bancs voisins
> mis à la nouvelle fiche sans les affaiblir : `annonces-carte` (une fiche par rangée au téléphone), `feuilles-coque`
> (« Passeport » dans les gestes), `revue-20oct` (gestes 44 px). Rouges déjà sur origin/main (mêmes lignes, prouvé sur son build) : `stats-premium` 3, `revue-20oct` 12, `capacites` 38, `feuilles-coque`
> 7 (Tout imprimer, Passeport). ⚠️ Non mesuré : sa vraie base, un vrai iPhone/Safari. Extension inchangée. Julien : rien.

> **29 octobre — offres, extension 5.286 :** la fusion partagée `src/conversations.js` /
> worker garde un état accepté/refusé/expiré/précédent face à une ancienne copie en attente.
> Deux identités d’offre contradictoires pour le même message font refuser la fusion.
> `suiviNegociationVinted` exclut une offre d’une autre transaction explicitement identifiée ;
> le sélecteur et le résumé ne réactivent plus « précédente » via un doublon.
> `offres-fusion.test.mjs` exécute les deux versions. Archives 5.286 générées.
> Rien n’a été envoyé à un compte marchand. Voir `docs/offres-etats-stables.md`.

> **29 octobre (soir) — revue de la republication et des favoris (5.285) :** « tout doit être parfait ». Dix défauts
> trouvés en relisant le code, tous corrigés : la file des mises en ligne planifiées s'écrit une à la fois (une
> planification pendant un réveil effaçait une paire) ; un job resté « en cours » (Chrome a tué le service worker)
> n'est jamais rejoué, il est dit « incertain » ; « Brouillons → en ligne » refuse un brouillon déjà planifié, déjà
> publié, verrouillé, ou dont l'ANCIENNE annonce n'est pas prouvée supprimée (sinon deux fois la même paire en ligne) ;
> un brouillon sans réponse claire verrouille l'annonce 30 min ; une requête jamais partie (pas d'onglet Vinted, pause)
> n'est plus « incertaine » et rend ses actions réservées ; avec la 5.277+, « via brouillon » est forcé (la création
> directe n'existe plus côté extension) ; le serveur refuse une offre en % à une extension < 5.280 (elle ne
> l'enverrait pas). Preuves : `audit-recreer.cjs` §R (7 contrôles, 7 rouges avec `BG_SRC=` le background.js
> d'origin/main), `favoris-message.test.mjs`. ⚠️ Non mesuré : le vrai Vinted.

> **29 octobre — `v29-colis-ext` : l'extension (5.281, version inchangée ; numéro de branche, remplacé par 5.291.0 à l'intégration du 30 oct.) suit le serveur, et mesure la route des messages :**
> (1) **Transporteurs (secours)** : `TRANSP_FORME` reprend la forme du serveur (`FORME_SUIVI` : Chronopost
> `XX123456789XX` ou `\d{14}[0-9A-Z]?`) et la liste blanche d'adresses en dérive ; un refus de `mr-fr-mvc` bascule sur
> `mr-be` (page puis API), même budget, une requête à la fois, pause posée sur la voie refusée seule ; le corps Mondial
> Relay est lu jusqu'à 192 Ko (`CORPS_MAX_MR`) et, sur un 413 du serveur, renvoyé UNE fois borné au contrat d'avant
> (64 Ko / 80 Ko). ⚠️ **Pour le chantier A (serveur)** : C4 (`appliquerReponseBrute`, `CORPS_MAX`) et `api/relais.js`
> (`ENVOI_MAX` 80 Ko) refusent encore plus de 64 Ko — les 192 Ko ne seront jugés qu'une fois ces deux bornes montées pour
> Mondial Relay ; et les n° Vinted Go à 12 chiffres (mesure au serveur) relèvent de A. `audit-transp-ext` 113/113,
> 12 rouges sur 8f62e6f2, `--prouve` 15/15. (2) **Suivi des achats** : `capterSuivisAchats` lit d'abord les achats AU
> POINT RELAIS (`needs_action` / `AT_RELAY`), jamais lus puis déjà lus, avant les achats en route (`rangSuivi`) — triés
> par date seule, un colis arrivé passait après 35 achats en route relus toutes les 3 h. `audit-suivi-vinted` section L
> (2 rouges sur l'avant, mutation `priorite-relais`). Mesuré : aucun n° de suivi dans une conversation, une transaction
> ou l'escrow (seul `journey_summary` le porte) — rien de neuf à ranger. (3) **Conversations** : la capture reconnaît une
> conversation chargée par son UUID (le `conversation_id` des commandes), règle ANCRÉE (plus aucun sous-chemin
> `…/replies`) ; le fond la range sous l'id NUMÉRIQUE de la réponse (sans id numérique, ou un autre id : rien).
> `<chemin-regle>` partagée page/fond (UUID → `{uuid}`, hex → `{hex}`, nombre → `{id}`). `seen_urls` garde les 400
> réponses et 600 chemins les plus RÉCENTS (elle gardait les 400 premières clés : un chemin neuf était perdu).
> ⚠️⚠️ **MESURÉ : depuis le 18 oct., plus AUCUNE requête `/api/v2/conversations/…` ne part de la page d'une conversation**
> (escrow, bannières, litiges, anti-hameçonnage seulement). On ne devine pas la nouvelle route : sur la page d'une
> conversation l'extension relève chaque requête vers Vinted (hors `/api/` compris : chemin normalisé, statut, type),
> la FORME d'une liste de messages (où, combien, clés et types — jamais une valeur), les sockets/flux (hôte, chemin,
> trames, forme) et les données Next (oui/non), dans `harvest_{uid}_seen_urls.conversation`. **À lire en lecture seule
> après sa prochaine conversation ouverte avec cette extension** : c'est elle qui dira par où passent les messages.
> `audit-endpoints-vus` C1-C3 (46 contrôles, 23 rouges sur l'avant, 8 mutations rouges).
> (4) **Tour 2 des relecteurs (29 oct., soir), côté extension** : `TRANSP_FORME.vinted` prend les **12 chiffres** du
> serveur (A, `FORME_SUIVI`) — C3 les annonçait et l'extension les refusait (`transp_item_refuse`, lu par personne) ;
> `contratSuivi` (bloc `<suivi-regle>`, même texte dans inject.js) nomme le transporteur par `current_carrier` ou
> l'unique `carriers[]` `is_current`, avec SON `tracking_code` (code machine seulement ; deux « courants » ⇒ rien) —
> `transporteur` était `null` sur ses 7 suivis rangés, et le n° pris était celui du PREMIER trajet. ⚠️ Le code réel
> (« vinted_go » ?) n'est pas mesuré : le serveur le lit par `carrierLisible` (`/vinted/`, `/mondial/`…). Le reste du
> défaut (une carte « vue par Vinted » sans ligne transporteur, trois états) est côté A. `audit-extension-zip` lit
> l'historique par `VRM_GIT` puis la racine, et un historique illisible est ROUGE (il sortait vert « sans conclusion »
> depuis une copie §6.1). `audit-transp-ext` §16 (C3 → `itemTranspValide` → lu → page C5) et §17 (transporteur
> courant, et le serveur qui le lit) : 7 rouges sur 980ef927 dans la copie fusionnée avec A (94f4d515), `--prouve`
> 18/18 (`vg12`, `courant`, `paire`). ⚠️ Dans ce worktree SEUL, §13 et §16 sont rouges : `api/` y est celui d'avant A
> (sans `\d{12}`) — c'est l'écart qu'on veut voir, il disparaît à la fusion. ⚠️⚠️ **VERSION** : `main` est en
> **5.287.0** (remesuré 29 oct. 23:45) et le worktree du chantier A (`v29-colis`) a déjà pris **5.290.0** ; la 5.281 de
> ce chantier est PRISE avec un autre contenu ⇒ à la fusion, monter TOUT au numéro de A (un seul numéro pour A + B,
> jamais servi ni réservé — vérifier les sessions en cours) : manifeste, `CODE_VERSION`,
> `CAPTEUR_VERSION`, `relaisVersion`, `EXT_ATTENDUE`, `EXT_CAPACITES.transp`, notice Orion, zips. La double arrivée
> Mondial Relay (`_mvc` puis `.be`) se corrige au serveur (A, `memeOccurrence`), pas ici.

> ⚠️⚠️ **29 octobre — MESSAGES AUX FAVORIS « COMME VINTEX » (5.280), sa demande : « je veux que tu copie vintex, c'est simple et
> efficace ».** Mesuré dans son rapport Observateur (Vintex, favoris) : tout part de l'onglet vinted.fr ; par favori
> `POST /api/v2/conversations {initiator,item_id,opposite_user_id}` → 3,2–6 s → `GET /api/v2/transactions/{tx}` → 0,3–0,8 s →
> `POST …/transactions/{tx}/offers {offer:{currency,price:"45.00"}}` (une VRAIE offre Vinted) → 0,4–0,55 s → `POST
> …/conversations/{id}/replies` → 6 à 9,6 s avant le favori suivant. `executerMessageFavori` fait pareil par `vintedPage`
> (sans onglet ⇒ `onglet_vinted`, RIEN n'est envoyé), `PAUSES_FAVORI`, `prixDeTransaction` (réponse jamais vue : lue
> défensivement, prix illisible ⇒ pas d'offre, le message part), `prixOffreFavori` (jamais ≥ prix, jamais < 1 €) ; le fil
> n'est relu que si la réponse de création ne suffit pas aux contrôles. GARDÉ : autorisation serveur à usage unique,
> vérification, identité, historique, une action consommée (l'offre n'en compte pas une de plus).
> Rythme « Comme Vintex » (`intervalleMinutes: 0` ⇒ `delaiFavori` tire 6–9,6 s côté serveur, `DELAI_VINTEX_MS`) ; l'app
> sonde la file à 3 s. **Republication** : la grille des tailles n'est PLUS JAMAIS lue pendant une republication (Vintex
> ne la lit pas) — seulement le cache 24 h (`cacheSeul`, sinon la phrase et `tailles_cache_absent`) ; plafond
> `REPUB_PAR_JOUR` **50** (il en a republié 50 avec Vintex) ; espacement par défaut « Comme Vintex » (8–16 s,
> `REPUB_ESP_VINTEX`). Preuves : `audit-favoris-vintex.cjs` (17 ; `--prouve` 2 rouges sur origin/main : création depuis
> le fond, pas de transaction ni d'offre), `audit-recreer.cjs` (144, grille jamais demandée), tests favoris (420, 51,
> 105, 84). ⚠️ Restent différents, dits : `is_personal_data_sharing_check_skipped` à false (valeur de Vintex inconnue),
> en-têtes de Vintex jamais vus. **Suite, « oui enlève le »** : le plafond de 10 messages / 60 min de la file
> (`favoris-file.js`, `reserverFile`/`vueFile`) est RETIRÉ, sa décision ; seul reste le plafond de 20 actions/h de
> l'extension (§3, jamais retiré : chaque message en consomme une). Tests favoris mis à jour (15, 420). **Geste de Julien** : installer la 5.280, laisser un onglet
> vinted.fr ouvert sur le bon compte pendant les messages et la republication.

> **29 octobre — FAVORIS « inspire-toi de Vintex » (5.281) :** Julien, captures de Vintex : « inspire-toi si jamais tu trouves ça
> bien ». Repris : (1) variables du message `{username}` (pseudo lu dans le FIL VÉRIFIÉ, `c.opposite_user.login`, au moment
> d'envoyer — jamais deviné ; absent ⇒ retiré proprement) et `{a|b}` (une variante tirée par message) ; toute autre accolade
> est refusée (`erreurVariablesFavori`) ; (2) offre « Sans offre · Diminuer (% ou €) · Fixer à », arrondi à l'euro inférieur
> (`offreFavori` dans les réglages : `offreMode`/`offreValeur`/`arrondi`, l'ancien `pourcentage` lu tel quel ; `prixOffreFavori`
> jamais ≥ prix ni < 1 €) ; (3) « Attente 8 s… » sur la ligne du prochain favori. ⚠️ Plus de phrase « Je te propose une
> réduction… » ajoutée au texte : la vraie offre Vinted suit (comme Vintex) ; un message est donc obligatoire. Règle UNIQUE
> `src/favorisMessage.js`, recopiée entre les balises `<favoris-message-regle>` de `background.js` (test
> `favoris-message.test.mjs` : copies identiques). Variables ou offre en € / arrondie ⇒ extension 5.281 exigée : l'app bloque
> le lancement (`EXT_CAPACITES.favorisperso`) et le serveur refuse l'autorisation à une plus ancienne (`exige5281`). Pas repris :
> les conditions de Vintex (≥ 2 favoris, jours, créneau) — elles servent ses règles automatiques, VRM n'envoie que sur son clic.
> Preuves : `favoris-message.test.mjs` (6), `favoris-vinted-interface` (120), `favoris-serveur`, audit Vintex (17).

> **29 octobre — offres acceptées avec un DÉLAI ALÉATOIRE, et les essais des photos dans la barre (5.273) :** Julien : « accepter
> les offres automatiquement avec un délai aléatoire ». Le moteur (`autoAccepterOffres`, éteint par défaut) n'accepte plus dès
> qu'il voit l'offre : à la première vue, l'heure est TIRÉE entre 3 et 20 min (`delaiOffreMs`, `vrmOffresPrevues` dans
> chrome.storage.local) ; l'alarme `vrm-offres` (1 min) ne lit QUE ce stockage et relance le moteur quand une heure est passée
> (`offresTick`). Tous les garde-fous restent (compte de l'onglet, 20/h, pause, une fois par offre, 15-45 s entre deux).
> Preuve : `audit-moteur-offres.cjs` A2 (rien au 1er passage, heure entre 3 et 20 min, alarme muette avant l'heure). Barre :
> photos refusées ⇒ « essai 2 sur 3 », « VRM les renvoie — photo 6 sur 14 » (`texteSecoursPhotos`) ; mesuré : sur la Spezial,
> photos refusées puis renvoyées, PUIS refus de la taille (`completion_photos_renvoyees` 5 = `vinted_refus_champs_size` 5).

> **28 octobre (nuit, fin) — la file des FAVORIS prévient quand elle finit :** `terminerFile` rend `valeur.fin` (total,
> envoyés, à vérifier, interrompus, interrompue) UNE fois, à la transition active → inactive ; `routeFavoris` envoie alors
> « ✅ … file terminée » / « ⏸️ … file interrompue » (`texteFinFavoris`, catégorie `favoris`, activée par défaut, dans
> `PUSH_CATS` et `PUSH_DEFAUT`), dans le contexte du vendeur. Un rejeu de l'accusé ne renotifie pas. Preuve :
> `scripts/tests/favoris-fin-file.test.mjs` (rouge sur l'avant). ⚠️ Le moteur reste dans l'écran des favoris : quitter
> l'écran arrête toujours la file (`ecran_inactif`) — la notification le dira.

> **28 octobre (nuit, fin) — MESSAGES AUX FAVORIS refaits comme Republier :** Julien : « fais comme pour les
> republications, un onglet qui s'ouvre avec les paramètres, les réductions, le temps aléatoire… enlève ce qui existe et
> restructure ». Messages → Favoris reçus ne garde qu'un résumé (`data-favoris-resume` : à contacter · déjà envoyés · en
> conversation), l'état d'une file (`data-favoris-file`) et UN bouton « Envoyer un message aux favoris »
> (`data-favoris-ouvrir`). La fenêtre (`data-favoris-feuille`, portail sur `<body>`, `FermeAuRetour` passé par l'app) :
> 1. Choisir (filtres, recherche, 10 au plus, outils : récupérer les pages, vérifier un favori, tester) · 2. Message
> (texte, réduction, aperçu) · 3. Envoi (rythme **Fixe** ou **Aléatoire** min–max, compte rendu par favori
> `data-favoris-envoi`, Lancer/Arrêter, « Enregistrer sans envoyer »). Le moteur (`AutomatisationFavoris`, plus de
> `<details>`) reste monté fenêtre fermée. Temps aléatoire : `intervalleMaxMinutes` dans `vrm_favoris_reglages_{uid}`
> (null = fixe, réglages d'avant lus tels quels) ; c'est le SERVEUR qui tire (`delaiFavori`, empreinte du jeton : une
> décision rejouée donne le même temps), `enCours.delai` repris par `terminerFile` ; le plafond 10/60 min passe avant.
> Preuves : `scripts/tests/favoris-temps-aleatoire.test.mjs` (215, rouge sur l'avant), interfaces `favoris-vinted`
> (105), `favoris-historique` (132), `favoris-automatisation` (84), banc `achats-messages-premium` (61).

> **28 octobre (nuit, fin) — messages aux favoris sur ses AUTRES comptes :** « Le lien du favori n'est pas confirmé ».
> Mesuré : sur 3175765377 (deux favoris ouverts depuis la cloche) les 77 favoris se résolvent, chacun vers SA personne
> (`offering_id`, 77 destinataires distincts, des messages sont partis) ; sur ses autres comptes, aucune ouverture ⇒ refus.
> ⚠️ Le `user_id` des notifications est le MÊME pour toutes (3175383732 sur deux comptes) : il n'est JAMAIS une preuve
> de destinataire. ⇒ Seul le PARAMÈTRE prouvé (`offering_id`, deux destinataires natifs distincts) sur un autre compte du
> MÊME vendeur vaut ici (`parametresDesAutresComptes`, owner filtré ; `parametresAilleurs`, deux clés contradictoires ⇒
> rien). Preuve : `audit-favoris-autres-comptes.cjs` (3 mutations rouges). Et Republier ne dit plus « 0 annonce à supprimer »
> après un passage (les anciennes sont parties de Vinted).

> **28 octobre (nuit) — les PHOTOS EN DOUBLE (5.261), « c'est en brouillon mais pas en ligne » :** mesuré, le coffre
> de la Jordan 3 portait 75 liens pour 15 photos (même clé `02_02248_…` sous `/tc/…` et `/t/…/f800/…`) ; VRM
> prenait les 20 premiers ⇒ un brouillon de 20 photos dont des doublons, refusé à la mise en ligne. ⇒
> `photosUniques` (clé `clePhotoRepub`, la fiche d'abord, le coffre ensuite, l'autre forme en secours) pour
> recréer et refaire ; `publierBrouillon` retire les doublons d'un brouillon VRM d'avant (ordre des liens du
> coffre de `ancienId`). Le texte de Republier décrit le chemin par brouillon. `vinted_refus_sans_champ_*`
> note la forme d'un refus sans champ. Preuve : `audit-recreer.cjs` (96 ; 2 rouges sur la 5.260).

> **28 octobre (nuit) — le coffre ne perd plus la sauvegarde d'un passage (5.256) :** l'archivage du dressing (à
> chaque visite Vinted) et Republier / En ligne → brouillon lisent-fusionnent-réécrivent la MÊME ligne
> `coffre_{uid}_{id}`. Reproduit : une lecture lente de l'archivage, rendue APRÈS l'écriture du passage, faisait
> reculer l'état (`supprime` → `enregistre`) ou effaçait `versBrouillon` (« tout est enregistré dans VRM ») juste
> avant la suppression de l'annonce. ⇒ `unCoffreALaFois` (chaîne, comme `unItemDetailsALaFois`) autour
> d'`archiverAnnonce`, `archiverLot`, `majVersBrouillon` et de la sauvegarde de `recreerVinted`. Preuve :
> `audit-recreer.cjs` R3 (80 ; 2 rouges sur la 5.255) — `_fond-vm.cjs` sait rendre une lecture en retard
> (`retardLecture`). ⚠️ Jamais un appel chaîné depuis une fonction déjà dans la chaîne.

> **28 octobre (nuit) — « REFAIRE LE BROUILLON » (5.255), sa demande :** « un bouton pour refaire un brouillon raté ».
> Un passage par brouillon (Republier, En ligne → brouillon) note son avancée dans le coffre de l'annonce
> (`coffre_{uid}_{id}.versBrouillon.etat` : enregistre → supprime | suppression-incertaine → a-refaire | brouillon-range |
> a-publier | mise-en-ligne-incertaine | fait, `majVersBrouillon`, lecture ratée ⇒ rien écrit). `refaireBrouillon` (extension)
> recrée le brouillon depuis le coffre (photos re-téléversées, corps enregistré), ne retouche JAMAIS l'annonce d'origine, ne le
> met en ligne que si Vinted a CONFIRMÉ la suppression de l'ancienne (`supprime: true`) ; « a-publier » met en ligne le brouillon
> EXISTANT (aucun second) ; « fait », « mise en ligne floue », un passage de moins de 10 min ⇒ refusé, 0 requête. App : ligne
> « N brouillons à refaire » (Annonces), entrée du menu Actions, fenêtre `BrouillonsARefaire` (règle `etatARefaire` ; « C'est
> réglé » ⇒ `vrm_brouillons_refaire_ecartes`, synchronisé), et bouton sur la ligne ratée de Republier. ⚠️ Trouvé au passage :
> l'archivage du dressing réécrivait le coffre SANS `lettreVRM` ni `versBrouillon` (la lettre s'empilait à la republication
> suivante) ⇒ `garderClesVrm`. Les photos d'une recréation passent par UNE boucle (`televerserPhotosRecreer`). Preuves :
> `audit-recreer.cjs` (78 ; 16 rouges sur la 5.254), banc `republier.cjs` (mutation « refaire sur mise en ligne floue » rouge).

> **28 octobre (nuit, fin) — REPUBLIER « comme les autres » (5.254), §3 renversé SUR SA DÉCISION :** Julien : « fais
> comme eux : on supprime, on enregistre au cas où dans VRM toutes les infos si ça échoue, on met en brouillon puis on met
> en ligne ». Republier par brouillon (`viaBrouillon`, défaut) = photos → ENREGISTRÉE dans le coffre (écriture ratée ⇒ rien
> supprimé) → SUPPRIMÉE (refus ⇒ arrêt, « toujours en ligne » ; sans réponse claire ⇒ ARRÊT aussi : jamais deux en ligne)
> → brouillon (refus retenté une fois) → 5 s → mise en ligne. Échec après la suppression : `brouillon-a-refaire` (le
> brouillon est dans ses brouillons Vinted, « Actions → Brouillons → en ligne », ou tout est dans VRM). Ne PAS remettre
> « recréer puis supprimer » sur ce chemin : c'est son choix, en connaissance du risque. La création directe (case
> décochée) garde l'ancien ordre. `EXT_CAPACITES.republierbrouillon = '5.254.0'` (la case suit cette capacité).
> Preuve : `audit-recreer.cjs` M (62 ; 7 rouges sur la 5.253).

> **28 octobre (nuit, suite) — « En ligne → brouillon » dans SON ordre (5.253) :** Julien : « c'est enregistrement de
> l'annonce, puis suppression, et après création du brouillon ». `recreerVinted` + `versBrouillon` : photos renvoyées →
> l'annonce ENREGISTRÉE dans le coffre (`coffre_{uid}_{id}`, avec `versBrouillon.corps` = le corps exact du brouillon ;
> écriture ratée ⇒ rien supprimé) → SUPPRIMÉE de Vinted (refus certain ⇒ on s'arrête, « toujours en ligne » ; sans réponse
> claire ⇒ on continue et on le dit) → brouillon CRÉÉ (refus certain retenté une fois, réponse floue jamais ;
> échec ⇒ `etape: 'brouillon-a-refaire'`, « rien n'est perdu, tout est enregistré dans VRM »). Pas de risque de double
> vente : un brouillon n'est jamais en ligne. Le §3 « recréer PUIS supprimer » vaut toujours pour Republier (en ligne →
> en ligne). Marché : Crosslist supprime puis recrée, Relister for Vinted recrée puis supprime (pages d'éditeurs).
> `EXT_CAPACITES.versbrouillon = '5.253.0'`. Preuve : `audit-recreer.cjs` P (59 ; 7 rouges sur la 5.252).

> **28 octobre — le tour de l'espace eBay sur ses vraies données :** Julien : « vas-y » (après Leboncoin).
> Rendu Ventes · Annonces · Messages · À traiter · Promotion · Achats · Compte (390/1512) sur la copie lecture
> seule ; 5 annonces actives (toutes avec une règle d'offre), 0 commande, retrait automatique ALLUMÉ. Corrigé :
> une inactive que le retrait AUTOMATIQUE venait de terminer (Aquatone 128086452103, paire vendue sur Vinted)
> disait « pas reliée · Remettre en vente sur eBay » ⇒ lue dans son journal `ebay_retraits_auto` par
> l'identifiant de l'annonce (`retraitsAuto`, `data-inactive-retrait-auto`) : « retirée par VRM le … : vendue
> sur Vinted — ne la remets pas en vente », aucun lien de remise en vente (journal illisible ⇒ rien dit) ;
> Ventes disait « Relie ton compte » à un compte relié et lu sans vente ⇒ « Aucune vente eBay pour
> l'instant ». Preuve : `ebay-inactives` scénario R (4 rouges sur l'avant). Laissés, vrais : VRM-81/48/78
> « à vérifier · pas reliée » (N° renumérotés pendant la panne du 18 oct.), une Air Max sans SKU. Gestes :
> « Relier à une paire » sur ces quatre annonces ; savoir que le retrait automatique est allumé. ⚠️ Les
> autres sections (Messages, À traiter, Promotion, Achats) lisent eBay en direct : non jugées sur la copie.

> **28 octobre — le tour de l'espace Leboncoin sur ses vraies données :** Julien : « fais pareil pour
> Leboncoin ». Rendu Ventes · Achats · Annonces · Messages · Colis (390/1512, clair/sombre) sur la copie
> lecture seule ; CA finalisé 178 € (58 + 75 + 45) et achats reçus 115,50 € = la base. Corrigé : une vente
> livrée affichait l'étape brute « Paiement effectué » (coupée à 390 px) alors que les totaux la comptent
> finalisée ⇒ la ligne dit la règle (Finalisée · À envoyer · En transit · Annulée, `data-lbc-etat`) ;
> « Mes annonces » montrait la référence BRUTE (« 493 ») ⇒ le N° de la règle de l'écran (`numeroLbcIdentite`,
> lien posé à la main puis réf traduite par la 013 : « N°B233 ») ; achats sans année et dans le désordre
> (2024/2025/2026) ⇒ le plus récent d'abord, l'année quand ce n'est pas celle-ci (ventes aussi) ; Messages
> nommait « Compte Leboncoin » le compte du compteur alors que `lbc-account:{id}` (même identité) porte
> « Totomondu · particulier ». Preuves : `plateformes-premium` (8 rouges sur l'avant), `lbc-messages`
> (scénario session, 1 rouge). `lbc-publier-app` H/H2 instable (« not visible ») À L'IDENTIQUE sur l'avant.
> Geste : rouvrir « Mes annonces » sur leboncoin.fr (lue il y a 6 j).

> **28 octobre — le tour de l'espace Vinted sur ses vraies données (5.246) :** Julien : « commence par Vinted,
> fais le tour et corrige tout ». Rendu Ventes · Achats · Annonces · Messages (390/1512, clair/sombre) sur une
> copie lecture seule (scratchpad, jamais dans le dépôt) ; disponible 180 € et en attente 1 264,50 € = la base.
> Corrigé : une ligne VIDÉE par « Supprimer des données… » (`{supprime:true}`, sans payload — compte 199082413)
> était lue « pas su » ⇒ « compte non chargé » et « données anciennes » : `ligneVideeParToi` la lit « vide »
> (`fetchHarvestBrut`, AVANT le dressing ; `fetchHarvestOrders`) ; un compte déjà dit « non chargé » sur Ventes
> n'est plus redit dans la ligne de fraîcheur (`VintedResume sauf`), et ce bandeau est ambre, plus rouge (§7) ;
> la fraîcheur des annonces ne parle plus à 24 min (« vu actif » seulement après 2 h) ni d'une version figée
> (« 5.170.0 ») ; l'extension ne range plus un refus de Vinted à code TEXTE (`UNAUTHORIZED`, session expirée de
> jujuf38) comme ses ventes (`estErreurVinted`, `noteSuivi`). Preuves : `audit-supprimees` §8 (2 rouges sur
> l'avant), `audit-fiabilite-fond` §2 (1 rouge). Laissés, vrais : doublons de N° 50/60/82/88 (deux paires
> vendues), offres « en attente » de sept./août (capture ancienne, même règle que le fil). Gestes : rouvrir Vinted
> sur jujuf38 et julatace35260 ; « Supprimer ce compte » sur #199082413 s'il ne doit plus revenir.

> **27 octobre — Vestiaire 5.238, messages :** l'extension relève le NOMBRE de
> non-lus (compteur `notification-feed-counter/v2` → `data.unseen.messages`,
> mesuré) et, messagerie ouverte, les conversations SANS texte ni nom (id,
> article, référence VRM, non lu, date, page vue) dans `vc_messages` ; jamais le
> support (zendesk). Carte « Tes messages Vestiaire » (trois états). On répond
> sur Vestiaire. Liste des conversations jamais vue d'ici : reconnue au chemin.
> Preuves : `audit-vc-publier.cjs` (70, 3 mutations rouges), banc `vestiaire.cjs`
> (6 rouges sur main).

> **26 octobre — Achats et Messages, même traitement :** dans l'espace Vinted, plus de
> second titre « Achats » / « Messages » sous l'onglet déjà sélectionné, et la carte
> « Reçus d'achat par email » passe SOUS la liste (une archive, pas le geste du jour ;
> à « · 0 » elle poussait les colis vers le bas). Banc `annonces-ventes-brouillon.cjs`
> (vues achats et messages) : 8 rouges sur le build d'avant, vert après.

> **26 octobre — favoris 5.228 :** le rapport du parcours manuel montre que la cloche
> affiche le favori avec un lien `receiver_id`/`item_id`, pas le lien enregistré
> (`/items/{article}/want_it/new?offering_id=…`). Ce lien est suivi seulement par
> identités : même article, et receiver_id égal à l’unique paramètre numérique
> enregistré. L’onglet doit ensuite montrer cette route, sinon rien n’est rangé.
> Serveur : une preuve `NAV` confirme CE favori ; il en faut deux de destinataires
> distincts pour les autres. Parcours réel non vérifié, aucun message envoyé.
> 5.229 : le clic du vendeur lui-même dans la cloche produit aussi la preuve (mêmes
> contrôles) ; compteurs `favori_clic_*` dans `panel_diag_capture`.
> Voir `docs/passation/2026-10-26-favoris-lien-natif.md`.

> **25 octobre — favoris 5.225 :** cloche ouverte, notification visible,
> `favori_non_trouve` réel. Cas `display:contents` reproduit et corrigé ; sonde
> de quatre compteurs anonymes pour distinguer les autres causes, aucune
> relaxation du lien exact. DOM réel non observé.
> Voir `docs/passation/2026-10-25-favoris-lien-visible.md`.

> **25 octobre — favoris 5.224 :** contrôle réel 5.223 : `cloche_introuvable`.
> Détecteur étendu aux noms accessibles et aux liens natifs de même origine ;
> cas ignorés reproduits sur 5.223. Le DOM réel reste non observé, pas de promesse
> de réparation du compte. Voir `docs/passation/2026-10-25-favoris-cloche-accessible.md`.

> **25 octobre — favoris, rapport unifié :** l’assistance joint maintenant le
> dernier contrôle d’ouverture à la structure de capture, avec version et codes
> contrôlés. Ce changement corrige le diagnostic incomplet, pas un parcours réel
> Vinted dont la cause reste non déterminée. Extension toujours 5.223.0.
> Voir `docs/passation/2026-10-25-favoris-rapport-ouverture.md`.

> **25 octobre — favoris 5.223 :** défaut reproduit sans scripting : le
> parcours utilise désormais le relais adressé de la page, commandes fermées
> sans envoi ni rejeu après clic incertain. Le contexte ne peut plus être
> consommé par une requête d’un autre article ou écraser un autre clic natif.
> Paquets Chrome/Orion synchronisés ; session réelle toujours non validée.
> Voir `docs/passation/2026-10-25-favoris-relais-navigation.md`.

> **25 octobre — 5.222, cloche et messagerie :** le client confirme que la
> cloche se referme en revenant dans VRM. Nouveau parcours : activer Vinted,
> rouvrir une cloche native identifiable, attendre le lien exact, puis ouvrir
> le fil. Pas de message de test. Historique des offres reçu/envoyé, contre-offre
> repliée, titre d’article fiable, ancien refus retiré lors de la vérification.
> Voir `docs/passation/2026-10-25-favoris-cloche-messages-offres.md`.
> Sites concurrents inaccessibles (403) et DOM réel non vérifié ici.

> **24 octobre — vérification visible :** bouton texte « Vérifier un favori »
> au-dessus de la liste, résultat et contrôle remontés avant celle-ci.
> Aucun envoi ni nouvelle extension ; cause du refus client toujours inconnue.
> Voir `docs/passation/2026-10-24-favoris-verification-visible.md`.

> **24 octobre — refus ouverture favoris :** correctif côté site uniquement.
> Le contrôle conserve la version mesurée et la catégorie de refus au lieu de
> tout rendre « non confirmé » ; erreur visible et ancien contrôle effacé.
> Extension reste 5.221. Cas client pas encore résolu.
> Voir `docs/passation/2026-10-24-favoris-refus-ouverture.md`.

> **24 octobre — favoris 5.221 :** correction du parcours « Page not found N°72 ».
> Activation du lien exact déjà affiché dans les notifications Vinted, sans
> chargement direct de la route interne ni message. Liste absente : refus expliqué.
> Voir `docs/passation/2026-10-24-favoris-navigation-interne.md`.
> Validation synthétique uniquement ; session réelle du vendeur à confirmer.

> **24 octobre — favoris 5.220 :** corps des objets Request et URL désormais
> captés ; hook MAIN au démarrage ; bouton de vérification lié à un onglet
> avant redirection, reçu réel et contrôle copiable des échecs de lancement.
> Le diagnostic v5 seul ne couvre pas ces preuves. Aucun succès client affirmé.
> Voir `docs/passation/2026-10-24-favoris-request-ouverture.md`.

> **24 octobre — favoris 5.219 :** capture passive du lien natif ouvert avec
> la création de conversation, archive privée cumulée de 100 contextes maximum.
> Le destinataire peut être prouvé par le lien exact ou un paramètre numérique
> dont le rôle est démontré, sans supposer user_id. Voir
> `docs/passation/2026-10-24-favoris-contexte-natif.md`.

> **24 octobre — destinataire favoris :** lorsque la dernière création native
> ne prouve aucune paire, repli en lecture sur les identifiants des conversations
> captées pour le même owner/UID et les articles favoris conservés. Exactitude des
> paires exigée ; aucun titre/pseudo deviné, contrôles natifs inchangés. Voir
> `docs/passation/2026-10-24-favoris-preuves-conversations.md`.

> **24 octobre — sélection souris :** aucun balayage global à la souris :
> sélectionner depuis une marge ne change plus de plateforme. Les favoris
> privilégient une réponse Chrome fraîche sur un ancien battement de page ;
> seul l’état peut être relu au réveil, jamais une commande d’envoi.
> Voir `docs/passation/2026-10-24-selection-navigation-favoris.md`.

> **24 octobre — favoris 5.218 :** archive privée cumulée avec révision atomique,
> lecture paginée depuis une source native observée, dates relatives, filtres et
> messages déjà envoyés confirmés. Chrome peut joindre directement l’extension
> quand le relais de page est muet. Aucun rejeu après un envoi sans accusé.
> Voir `docs/passation/2026-10-24-favoris-historique-chrome.md`.

> **24 octobre — correctif favoris 5.217 :** bouton de lancement avec vérification
> fraîche de l'extension et sauvegarde au clic, fil déjà commencé ignoré sans
> message, barre par lot avec étapes et compte à rebours. Les anciens moteurs
> 5.215 ne peuvent plus consommer l'autorisation d'envoi. Voir
> `docs/passation/2026-10-24-favoris-bouton-progression.md`.

> **24 octobre — messages aux favoris :** Julien demande explicitement l'envoi
> automatique de son texte aux favoris cochés. File serveur protégée, quota
> partagé 10/60 minutes et autorisations à usage unique ; extension 5.215.
> Nécessite l'écran VRM ouvert et visible ; pas de relais téléphone pour ce geste.
> Le raccordement est vérifié sur la capture native puis sur le fil avant réponse.
> Voir `docs/passation/2026-10-24-automatisation-favoris.md` pour les conditions,
> essais synthétiques, limites et nettoyage lors de la fermeture du compte.

> **24 octobre — demande explicite de Julien :** retirer de Messages le bloc
> « offres à trancher » provenant des emails, ses moyennes par modèle et ses
> liens génériques Vinted. Les offres dans les conversations restent. Ne pas
> rétablir ce bloc au nom des consignes du 22 octobre : elles sont remplacées.
> Voir `docs/passation/2026-10-24-offres-messages.md`.

> ⚠️⚠️ **PASSATION DU 22-23 OCTOBRE — LIS D'ABORD `docs/passation/2026-10-22-integration.md`** :
> treize chantiers finis, relus et fusionnés (CSP, Ma journée en widgets, carte, offres + adresse
> prouvée, double vérification gratuite, fiabilité, colis à l'heure, numéros et annonces masquées,
> photos, Leboncoin « plus vue » et pause, URSSAF, petits correctifs, migration 016), l'extension
> **5.213.0**, le piège de banc des worktrees, et les gestes de Julien.

> ⚠️⚠️ **PASSATION DU 12 OCTOBRE — DEUX AGENTS — LIS D'ABORD `docs/passation/README.md`,
> section « 🔴 LIRE D'ABORD » puis « RÉPARTITION ».** Agent 1 : mettre en ligne
> la 5.175 (avec le second correctif photos), migration 014, règle d'offre eBay,
> puis l'agent eBay. Agent 2 : page d'accueil, tri des 21 anciennes branches,
> fonctions retenues le 11 octobre, revue complète. Le travail non poussé est
> dans `docs/passation/branches-2026-10-12.bundle` et
> `branches-locales-2026-10-11.bundle` ; les listes de défauts restants dans
> `docs/passation/notes/`.

### L'écran Messages : il a demandé qu'on RETIRE la liste
« Enlève les messages, mets juste qu'il y en a de nouveaux. » L'écran ne
déroule donc **aucune conversation** — une carte dit combien sont non lus, un
bouton emmène répondre sur Vinted, et les réponses rapides se copient. **Ne pas
remettre la liste** : c'est une décision prise, pas un oubli.
- Ce qui manquait, en revanche : **sur quel compte**. Il en a neuf, et le bouton
  ouvre l'inbox du compte connecté — pas forcément celui qui a les messages. La
  carte nomme maintenant les trois premiers (« sur lllooIlllaa (8),
  julatace3535 (7), julatace35260 (6) et 4 autres comptes »), calculés sur la
  MÊME source que le nombre juste au-dessus (§11) : les deux ne peuvent pas se
  contredire. C'est une information, pas la liste.


### ⚠️⚠️ 135 DE SES 176 OFFRES ÉTAIENT CACHÉES PAR UNE RESSEMBLANCE DE TITRE
Mesuré le 15 septembre sur sa vraie base : sur ses **176 offres de moins de
14 jours**, l'accueil n'en montrait que **41**. Les 135 autres disparaissaient
parce qu'une vente — **n'importe laquelle, n'importe quand, sur n'importe lequel
de ses neuf comptes** — portait le **même titre**. C'est §5 mot pour mot :
« 22 % des ventes portent un titre en double, et le titre désignait la MAUVAISE
annonce dans 3 cas réels ».
⚠️ **Et l'asymétrie est décisive** : montrer une offre déjà réglée coûte un clic
sur « ✓ » ; en cacher une vivante lui fait **rater une vente** — la carte dit
elle-même « une offre acceptée, c'est presque une vente ».
⚠️ **CHERCHÉ D'ABORD, UNE IDENTITÉ** (§5 l'exige avant de toucher une
ressemblance) : sur les **518 offres**, `item_id` **0/518**, `transaction`
**0/518**, `conversation` **0/518** — et les liens de l'email sont des
redirections `links.vinted.com` en base64 qui ne portent que l'identifiant
d'invitation, **le même dans tous les emails**. Il n'existe donc **aucun pont
certain**. On n'échange pas une ressemblance contre une autre : on lui ajoute
les **contraintes réelles**, celles qui ne se devinent pas.
| contrainte | pourquoi c'en est une | offres rendues |
|---|---|---|
| le **COMPTE** | une offre reçue sur `tomj683` ne peut pas être réglée par une vente sur `angeled92` | **13** |
| la **CHRONOLOGIE** | une vente ANTÉRIEURE à l'offre ne l'explique pas — il avait donc une seconde paire | **4** |
| un titre **NON AMBIGU** | « adidas spezial noir taille 35,5 » est porté par **5 transactions** : vendre l'une n'apprend rien sur les offres faites aux autres (§2.4) | **17** |
⇒ Mesuré après, la VRAIE fonction exécutée sur la vraie base : **42 → 76 offres
affichées**, **34 qu'il ne voyait pas** — dont une à **65 €** sur `tomj683`.
- La tolérance de **6 h** n'est pas un réglage fin : elle absorbe le délai de
  classement de l'email, et mesurée à **6, 24 et 48 h le résultat est
  identique** (101 mises de côté). À 0 h on en garde 13 de plus.
- **Aucune vente captée ⇒ on ne cache RIEN** : une lecture vide ne doit pas vider
  sa liste (« rien lu » ne vaut pas « rien »).
- ⚠️ **Une liste qui rétrécit sans explication se lit comme une perte** (leçon de
  l'écran Leboncoin) : la carte dit maintenant combien sont mises de côté et
  pourquoi. Le chiffre, jamais la promesse.
- ⚠️ La chaîne vivait **en plein milieu du JSX** — impossible de savoir combien
  elle rendait sans la recopier (même défaut que les filtres de l'écran Ventes).
  Elle est dans `offresAtraiter` (§11, un seul propriétaire), et
  `audit-offres-titre.cjs` l'**exécute** dans un `vm` : il juge ce qu'elle REND.
  ⚠️ **Prouvé en RÉAFFAIBLISSANT la règle au titre seul** — les trois contrôles
  passent au rouge. « La fonction n'existe pas sur le code d'avant » n'est PAS
  une preuve (c'est la leçon d'`estALui`) : ce qu'il faut montrer, c'est que le
  contrôle attrape la RÈGLE fautive.
- ⚠️ **CINQUIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER**, et je
  viens de la refaire : le premier jet chargeait la règle **sans ses bornes**
  (`OFFRE_FENETRE_J`), sortait en `ReferenceError`, et **aucun contrôle n'était
  rendu**. Les bornes sont extraites du source, pas recopiées — recopiées, elles
  mesureraient MES chiffres, pas ceux de l'app.
- ⚠️⚠️ **ET LE MÊME DÉFAUT VIVAIT SUR LE MÊME ÉCRAN, À CÔTÉ.** « N ventes
  repérées via bordereau, pas encore synchronisées » rapprochait aussi par
  **titre** — alors que les **deux** côtés portent un n° de **transaction** :
  mesuré, **165 des 166 bordereaux** le portent et les 385 ventes aussi. Le
  titre se trompait **dans les deux sens** : il montrait à tort
  `tx 22155558568` (deux paires dans un même colis, titre composé qui ne
  correspond à aucune vente) — une **fausse alerte**, et une fausse alerte fait
  cesser de lire les vraies ; et il en cacherait une vraie dès qu'une paire au
  même libellé est vendue. `bordereauxPasSynchro` juge sur la transaction ; un
  bordereau **sans** transaction n'est pas jugé (mieux vaut un blanc qu'un faux).
  *Chercher l'identité AVANT d'aménager la ressemblance : ici elle était déjà là.*
- ⚠️ **Et une ligne morte préparait le retour du titre** : `vendus.add('t:'+titre)`
  alimentait un ensemble que **plus rien ne lisait** — le test par titre avait
  été retiré, sa ligne d'alimentation était restée. Même famille que le tiroir
  `Nav` : un relecteur la « rebranche » un jour en croyant réparer un oubli.
  L'audit refuse qu'un ensemble « vendu » soit alimenté par un titre.
- ⚠️⚠️ **SIXIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER**, et les
  **deux dernières dans ce fichier même** : charger la règle dans un `vm` ne
  suffit pas, l'**appeler** peut lever, et le rejet tue le processus **avant le
  bilan**. Tout appel passe par `essaie()` : ce qui lève devient un contrôle
  ROUGE. Prouvé en rebasculant les deux règles sur le titre — **3 contrôles
  rouges et un bilan imprimé**, au lieu d'une pile d'appels.
- ⚠️ **Et la lecture rapatriait le double de ce qu'elle lit** : `email_offer_*`
  porte `extrait`, le morceau brut de l'email — **102 Ko des 231 Ko** — et l'app
  ne le lit **nulle part**. Projetée : **231 Ko / 1 192 ms → 111 Ko / 402 ms**,
  valeurs identiques (518 lignes × 9 champs, 0 écart).


### ⚠️⚠️ « DÈS QUE J'APPUIE SUR UN BOUTON DANS VINTED, J'AI "OFFRE À TRANCHER" »
Plainte de Julien, 16 septembre. **Cause mesurée, et elle est nette** : dans
`nouveautes()`, les **ventes** et les **messages** sont comparés au mémo du
dernier récap ; les **OFFRES ne l'étaient pas**. `out.offres` valait le nombre
d'offres **EN ATTENTE**, pas le nombre de **nouvelles** — donc tant qu'il lui
restait une offre non tranchée, `rien` était faux **pour toujours**, et la
fenêtre **plein écran** (`position:fixed;inset:0`, fond assombri) revenait à
chaque cycle de capture. Vinted est une SPA : chaque bouton en relance un.
⇒ Une offre a une identité — **`offer_request_id`**. On compte celles qu'on n'a
pas encore montrées, exactement comme les ventes. Une VRAIE nouvelle offre
mérite encore d'interrompre (de l'argent, 24 h pour répondre) ; une offre déjà
vue, non.
- ⚠️ **Le libellé suit la donnée** : « 1 **nouvelle** offre à trancher ». Sinon
  on lit « 3 offres » dans la fenêtre et on en trouve 12 dans le panneau.
- ⚠️ **Première visite** : elles sont toutes « nouvelles ». On les remet à zéro
  comme les ventes et les messages — « 17 offres à trancher » d'un coup, c'est
  le « 320 ventes ! » qu'on évite juste à côté.


### ⚠️⚠️ « UNE RELANCE AUX FAVORIS » — 1 240 PERSONNES, ZÉRO ADRESSE ; ET 57 QUI EN ONT UNE
Deuxième moitié de sa demande du 17 septembre : « envoyer aux personnes sur
Vinted qui ont mis l'article en favori une petite relance pour qu'ils achètent ».

**Remesuré** (§3 dit non, mais ce non repose sur une MESURE, et une mesure se
refait — c'est ce qui a fait tomber le refus des offres automatiques) : sur ses
**481 annonces captées**, **105 portent au moins un favori, 1 240 favoris en
tout**, et les seuls champs qui nomment quelqu'un sont `user`/`user_id` (LUI, le
vendeur), `is_favourite` (est-ce que LUI a mis en favori) et `favourite_count` —
**un nombre**. ⇒ **Le refus tient toujours** : mille deux cent quarante
personnes, aucune adresse. L'onglet Favoris reste le bon canal (la remise
**native** de Vinted, qui les touche tous en un clic).

⚠️⚠️ **MAIS UN AUTRE GROUPE EST NOMMÉ, ET PERSONNE NE L'AVAIT CHERCHÉ.** Sur ses
**988 conversations captées** : **669 portent un `opposite_user`** (id **et**
login) et **661 un `transaction.item_id`** — la personne **et** la paire dont
elle a parlé, par **IDENTITÉ** (§5), jamais par ressemblance de titre. En ne
gardant que les paires **encore en ligne** dont l'échange n'a **jamais abouti**,
et en laissant de côté celles qui portent une offre en attente (elles ont déjà
leur place dans l'onglet Offres, §7) : **57 personnes sur 26 paires** — dont
**13 sur la seule « salomon XT-6 blanc taille 40 » à 99 €**. Vinted autorise la
réponse sur toutes (`allow_reply` : 0 refus).
⇒ Onglet **Relances** dans le panneau, groupé **par paire**, chaque personne
nommée avec **sa** conversation et le message prêt (remise calculée par
`montantRemise` — **la même règle** que l'onglet Favoris, §11).
- ⚠️ **RIEN NE PART TOUT SEUL, et ce n'est pas une prudence de façade** :
  soixante messages envoyés par un programme, c'est le signal de robot qui a
  fait bloquer `vanessa5723` (§3). Le clic **ouvre** la conversation et copie le
  texte ; c'est lui qui écrit et qui envoie. Même forme que l'assistant
  Leboncoin.
- **Une seule lecture pour deux usages** : les relances se calculent sur les
  **mêmes** `convRows` que les offres, avec deux champs de plus dans la
  projection (`opplogin`, `is_completed`).
- `scripts/audit-relances.cjs` : **11 contrôles, 9 rouges** sur le build
  d'avant. Il exige qu'**aucun** message ne parte, que chaque personne soit
  **NOMMÉE** (⚠️ l'autre sens : *tout retirer* passerait les contrôles
  d'envoi), et que les **trois** causes d'une liste vide donnent **trois**
  phrases différentes.
  ⚠️ **« Copié » ne s'écrit que si la copie a eu lieu** — prouvé en
  **réaffaiblissant** `copier` à la forme naïve `try { writeText } catch`, qui
  repasse au **rouge** : une promesse rejetée ne passe pas par `catch`. C'est la
  seule preuve qui vaille (« la fonction n'existait pas avant » n'en est pas
  une).
- ⚠️ **HUITIÈME FOIS QU'UN DE MES AUDITS MEURT AU LIEU DE RAPPORTER** : sur le
  code d'avant le bouton n'existe pas, et `.click()` sur `null` tuait le
  processus **avant le bilan**. Tout bloc passe par `essaie()`.
- ⚠️⚠️ **ET MON REMPLACEMENT DE PROJECTION AVAIT VISÉ LE MAUVAIS SITE D'APPEL** :
  une **autre** fonction portait la même sous-chaîne, et c'est elle qui a été
  modifiée. `opplogin` valait `''`, les relances sortaient à **0** — alors que
  la paire, elle, était trouvée **60 fois**. Aucun audit ne l'a vu ; c'est
  l'**exécution sur la vraie base** qui l'a attrapée. *Un remplacement par
  sous-chaîne se vérifie sur le site qu'on visait, pas sur le premier qui
  matche* — cousin de §4.11.


### ⚠️⚠️⚠️ « QU'ELLE RÉPONDE À MA PLACE AUX MESSAGES » — ET 2 SUR 5 N'ÉTAIENT PAS DES ACHETEURS
Demande de Julien, 18 septembre : « je veux également que tu puisses répondre à
ma place au message Vinted ». Mis devant le risque, il a tranché : **« Tout, elle
répond à tout »**. C'est SA décision, elle n'est pas à re-négocier.

**MESURÉ AVANT DE BRANCHER QUOI QUE CE SOIT**, sur ses **32 conversations non
lues** du 19 septembre :

| ce qu'elles sont | combien |
|---|---|
| aucune conversation captée (rien à lire) | **17** |
| captée, mais aucun message de l'acheteur dedans | **9** |
| `allow_reply: false` — Vinted refuse la réponse | **1** |
| ⚠️ un échange où c'est **LUI l'acheteur** | **1** |
| une vraie question posée sur une de SES annonces | **3** |

⚠️⚠️ **LE DÉFAUT QUE LA MESURE A ÉVITÉ.** « Conversation non lue = un acheteur qui
demande » est une **RESSEMBLANCE** (§5), et elle se trompait **2 fois sur 5** des
conversations lisibles : « *Trainers are in post, thanks for buying* » et
« *juste pour vous dire que j'envoie demain, le colis est prêt* » sont des
**vendeurs qui LUI expédient**. Or `api/ai` répond en VENDEUR (sa consigne dit
mot pour mot « on te donne le message d'un ACHETEUR ») : elle aurait envoyé, **en
son nom**, une réponse à côté de la plaque à quelqu'un qui lui poste un colis.
⇒ L'identité est l'**ARTICLE** : `transaction.item_id` ∈ ses annonces captées
(`sesAnnonces`). Mesuré : les 3 vraies questions passent, les 2 conversations où
il achète sont écartées, **0 erreur**.
⚠️ **Deux autres pistes essayées et ÉCARTÉES, mesurées** : `transaction.user_side`
est **`null` sur les 1 030 conversations** captées ; et l'identifiant de
participant déduit de `harvest_*_txn_*` ne marche pas — ces lignes portent AUSSI
ses **achats**, donc `seller_id` y varie (162 fois l'un, une fois chacun des
autres) : le prendre « le plus fréquent » serait un rapprochement par
**fréquence**. Ancré sur l'article il n'apportait d'ailleurs **rien** (0
conversation de plus). *Chercher l'identité, pas aménager la ressemblance.*

**Les garde-fous, qui sont ANTI-BLOCAGE et pas des scrupules** (§3 : `vanessa5723`
a été bloqué, neuf comptes sont son gagne-pain) : éteint par défaut
(`vinted_repond_auto`), uniquement le compte de l'onglet (`garde`), **3 réponses
par visite**, plafond horaire, une requête à la fois, et **jamais deux fois le
même message** — l'identité est l'`id` du message de l'acheteur, jamais son texte
ni sa date. Rien sous **55 de confiance** de l'IA, rien sur une réponse vide,
rien si l'IA est injoignable : *mieux vaut un blanc qu'un faux*, et un silence
d'une heure coûte moins qu'une phrase inventée sur un prix.

⚠️⚠️ **ET « ELLE RÉPOND À TOUT » NE DOIT PAS S'AFFICHER COMME UN FAIT.** 3 sur 32,
c'est le chiffre d'aujourd'hui : un total partiel présenté comme complet est pire
qu'un total absent (§5). L'extension **publie son bilan**
(`panel_msg_repondus.bilan` — une clé réservée, jamais confondue avec un envoi) et
le panneau de Réglages écrit **les deux nombres** et **les causes** (« 1 où c'est
toi qui achètes », « 17 dont l'extension n'a pas encore lu l'échange »…). Une
cause à **zéro** n'est pas écrite — ce serait du bruit permanent.
- **Il peut relire ce qui est parti en son nom** : le texte exact, la personne
  nommée, la paire. Un message envoyé à sa place qu'il ne peut pas relire serait
  le pire de tout — « un colis caché est un colis perdu » appliqué à ce qu'on dit
  à ses acheteurs.
- ⚠️ **« Pas su » ne vaut pas « allumé », et ne vaut pas « il est le vendeur »** :
  réglage non lu, annonces non lues, mémo des réponses non lu ⇒ **rien ne part**.
  Trois lectures, trois refus — le banc sert chacune en 522 séparément (lecture
  KO, écriture OK : le cas dangereux, jamais la panne totale).
- `convDernierMessageId(uid, cid)` lit la ligne **du compte** (`id=eq.`, vérifié :
  une conversation est toujours captée sous le compte de sa boîte) et rend
  `itemId` + `allowReply` — et rend son objet **même sans message lisible**, pour
  que le bilan distingue « pas captée » de « captée mais vide » : deux causes,
  deux phrases.
- `scripts/audit-repondre.cjs` **EXÉCUTE** le vrai `background.js` dans un `vm` et
  compte ce qui part chez Vinted : **30 contrôles**. Prouvé en **réaffaiblissant**
  la règle (identité du vendeur retirée, refus de Vinted ignoré) → **5 rouges**,
  dont « aucune réponse à quelqu'un qui LUI vend — envois=1 ». *« La fonction
  n'existait pas avant » n'est pas une preuve.*
- `scripts/bancs/repondre.cjs` rend le panneau dans **quatre** états et exige que
  le texte **suive la donnée** (deux jeux de chiffres, deux rendus différents —
  un texte figé passerait sinon). **7 rouges** sur un rendu réaffaibli à « Elle
  répond à tout ».
- `EXT_CAPACITES.repond = '5.77.0'`, extension en **5.77.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. ⚠️ **Mesuré le 19 septembre : `panel_diag_capture.ver`
  est ABSENT** alors que `majAt` est de l'heure — son extension est donc encore
  antérieure à la 5.63. Tant qu'il ne l'a pas remplacée, **rien ne partira**, et
  l'app le dit (`extSait('repond') === 'retard'`).


### Les offres reçues reviennent, en tête de Messages (proposition 6, 6 octobre)
Retirées de l'accueil (28 sept.) puis de la cloche (30 sept.) avec la promesse
d'un « onglet dédié » ; leur lecture avait disparu le 3 octobre. Mesuré : **37
offres en 14 jours, toutes connues par EMAIL** (`email_offer_*`) ; seules 3
conversations captées portent une offre en attente, et elles sont vieilles.
- Messages ouvre sur « N offres à trancher » : la règle `offresAtraiter` (compte,
  chronologie, titre non ambigu) écarte celles réglées par une vente, et **le
  dit** (« 1 autre déjà réglée par une vente, mise de côté »). « c'est fait »
  range une offre (`vinted_offers_done`, synchronisé, rattrapé par `onCloudReady`).
- Lecture des **14 derniers jours seulement, en scalaires** (`meta->>`, §4.4).
- ⚠️ **L'email ne porte aucun identifiant d'annonce** (0/518) : ni « ton prix »
  ni « la remise demandée » ne sont écrits — les tirer du titre serait le
  rapprochement interdit (§5). Le repère montré est celui du **modèle** (prix
  moyen de revente, au moins 3 ventes), dit comme tel.
- On y répond sur Vinted, sur le compte nommé (une ligne d'en-tête quand elles
  sont toutes sur le même, sur chaque ligne sinon — §7).
- Banc `messagerie.cjs` : l'offre récente seule (ni la vieille, ni la réglée),
  le repère du modèle, aucune remise inventée, « c'est fait » gardé ; règle
  retirée ⇒ 4 rouges. `audit-offres-titre.cjs` accepte la phrase en ternaire
  (vingt-septième cri au loup évité : la règle, pas l'orthographe).


### ⚠️⚠️ LA MESSAGERIE INTÉGRÉE REVIENT — IL L'A REDEMANDÉE (3 octobre, 5.135)
Julien : « il doit y avoir la messagerie intégrée des derniers comptes, avec la
possibilité de répondre et de faire l'offre ». Ça **remplace** sa demande de
septembre (« enlève les messages, mets juste qu'il y en a de nouveaux ») :
c'est lui qui la redemande, ce n'est pas un retour en arrière à corriger.
- **La liste** (`data-messagerie`) : toutes les conversations captées, tous
  comptes, **non lues d'abord**, le compte nommé sur chaque ligne (la liste
  mélange ses comptes — là, la ligne distingue). 40 puis « Voir plus ».
- **Le fil** s'ouvre au clic : moisson d'abord, sinon **l'extension le lit**
  (`GET /api/v2/conversations/{id}`, au nom du compte connecté dans Chrome),
  sinon le repli serveur d'avant.
- **Les offres** : `offreEnAttenteDe` (même règle que le moteur de l'extension :
  l'acheteur, la courante, statut 10, un montant, transaction + offre) →
  « Accepter » (**confirmation d'abord** : ça vend la paire) / « Refuser », et
  « Faire une offre » / « Contre-offre » sur la transaction du fil.
- Côté extension, `EXEC_PERMIS` s'élargit à **ces trois gestes et cette seule
  lecture** — rien d'autre (`audit-exec.cjs`, 12 contrôles : DELETE et variantes
  refusés, autre compte refusé). Tout passe par `executerPourApp` : origine de
  l'app, garde STRICTE, **dans la file Vinted** (une requête à la fois). Une
  LECTURE ne consomme pas le plafond de 20 actions/heure ; un geste, si.
- `EXT_CAPACITES.messagerie = '5.135.0'` : une extension plus ancienne ne voit
  **aucun bouton d'offre** (il ne pourrait pas marcher), et la raison est dite.
- Banc `messagerie.cjs` (rejoue le vrai dialogue du pont, deux tailles).


### ⚠️⚠️ LE COFFRE EFFAÇAIT SA FICHE RICHE SUR UNE LECTURE RATÉE (4 octobre, 5.150)
Suite de la passe fiabilité, et la leçon que ce fichier répète : *un banc qui
énumère à la main ne couvre que ce qu'on a pensé à écrire*. En balayant **tout**
`background.js` (14 lire-fusionner-réécrire), deux sites du COFFRE — la source
qui sert à RECRÉER une annonce disparue (§47 : description + photos HD) — n'étaient
**ni gardés, ni dans `audit-fusion`** :
- **`archiverAnnonce`** (par article, appelé L841) lisait `coffre_{uid}_{id}`
  puis complétait depuis l'ancienne fiche (`const anc = (rows && …) || null`)
  **sans** garde `=== null`. `sbGet` rend `null` quand la base n'a pas répondu :
  `anc` valait alors `null`, la branche « complète depuis l'existant » était
  sautée, et la fiche **PAUVRE** du dressing (pas de description, une vignette)
  était réécrite **par-dessus la fiche riche**. `null` = pas su (on n'écrit pas) ;
  `[]` = première sauvegarde (écriture légitime) — seul `null` bloque.
- **`archiverLot`** (le LOT, appelé à **CHAQUE visite Vinted**, L849/L2348 — le
  chemin le plus fréquent) lisait la famille `id=like.coffre_{uid}_*` en
  `sbGet(...) || []` : une lecture ratée valait « coffre vide » → mêmes fiches
  riches réécrites appauvries. Et c'est une famille **NON BORNÉE** (une ligne par
  annonce, tous comptes) → §4.5, tronquée à 1000 en silence. Passé en `sbGetTout`
  (paginé, `null` si une page échoue) + garde `=== null` → on n'écrit pas.
- `audit-fusion.cjs` porte les deux : `archiverAnnonce` dans la table CAS
  (`id=eq.coffre_*`), `archiverLot` dans un bloc dédié (la famille ne rentre pas
  dans le fetch `id=eq.` du harnais) — **lecture KO, écriture OK**, le cas qui
  détruit, plus l'autre sens. **§6.1 : 2 rouges sur le code d'avant** (« la ligne
  est réécrite : desc="", 0 photo(s) »), 0 après, les 59 audits verts, build vert.
- **Aucune entrée d'`EXT_CAPACITES`** : correction de fiabilité, l'app ne promet
  rien de neuf. Extension **5.150.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⛔ L'acceptation automatique des offres est RETIRÉE (5 octobre, 5.159)
Julien : « enlève l'acceptation de l'offre » — après que je la lui ai reproposée
par erreur (elle était coupée depuis le 4 octobre, mais la ligne du §3 la disait
encore « livrée, ne pas retirer » : un dossier en retard sur une décision fait
refaire l'erreur à la session suivante).
- **Extension** : le moteur (`autoAccepterOffres`, `offresEnAttente`,
  `planchers`, le salut automatique, `repondreOffre`, l'interrupteur local) est
  supprimé, son appel à chaque visite aussi. Reste `EXEC_PERMIS` : l'acceptation
  d'UNE offre depuis la messagerie, sur son clic.
- **App** : plus de champ « Min. accepté », plus de bandeau « N prix planchers »,
  plus de carte dans Réglages, plus de capacités `offres`/`offresapp`. Les
  planchers déjà saisis restent en base (rien n'est effacé), sans effet.
- **Mesuré avant** : son extension installée (5.128) n'a que l'ancien
  interrupteur local ; `panel_min_prices` porte 5 planchers (1 à 20 €), sur des
  annonces **toutes fermées ou disparues** — elle ne peut donc rien accepter
  aujourd'hui. Le geste qui ferme la question pour de bon : installer la 5.159.
- `audit-offres-auto.cjs` porte l'invariant (aucun code ne construit `/accept`
  hors de la liste blanche, aucun reste du moteur, aucune promesse dans l'app,
  et l'autre sens) : **8 rouges** sur le code d'avant. `capacites.cjs` exige,
  même avec des planchers en base et dans les six états du pont, qu'aucune
  promesse ni aucun « Min. accepté » n'apparaisse.


### eBay « de ouf » : l'annonce reliée à sa paire, l'offre aux observateurs, l'anti double vente (5 octobre)
Julien : « pour eBay je ne sais pas pourquoi le site est si peu développé, tu as
accès à mon compte et tu ne fais rien de ouf ». **Mesuré le jour même** :
`ebay_listings` = **2 annonces actives, AUCUNE n'a de SKU** ; `ebay_orders` = 0.
Rien ne reliait donc une annonce eBay à une paire : une paire vendue sur Vinted
pouvait rester en vente sur eBay sans que VRM le voie — sauf à comparer les
titres, ce que §5 interdit.
- **L'identité d'une annonce eBay = son SKU `VRM-{cleNum(n°)}`** (champ
  « étiquette personnalisée »). La publication le pose à partir du **numéro** de
  la paire choisie (`item.numero`), **jamais** d'un `sku` envoyé par le
  navigateur ; un numéro illisible ⇒ 400, rien n'est publié (pas de faux lien).
  Une annonce existante se relie d'un clic (« Relier à une paire », N° tapé ou
  choisi, confirmation qui montre les DEUX titres) — la paire à la **même
  photo** est proposée en tête, **jamais** un classement par titre. Lecture
  STRICTE (`numDeSkuEbay`) : seul un SKU « VRM-… » entier donne un numéro, un SKU
  à lui (« 12345-ABC ») ou des chiffres nus ne désignent rien. Le serveur porte
  une copie de `cleNum` : `audit-ebay-route.cjs` exécute celle de l'app et
  compare leurs sorties (§11).
- **`api/ebay` — quatre actions, toutes derrière la session du propriétaire
  (401/403, zéro appel eBay sinon)** :
  · `sku` `{itemId, numero}` → Trading `ReviseFixedPriceItem`
    `<Item><ItemID/><SKU>VRM-n</SKU></Item>` ;
  · `offreinfo` → `GET /sell/negotiation/v1/find_eligible_items?limit=200`
    (`X-EBAY-C-MARKETPLACE-ID: EBAY_FR`), rend `{eligibles:[listingId], complet}`.
    ⚠️ eBay répond **204** quand aucune annonce n'est éligible : c'est « lu,
    aucune », pas une panne ; une panne rend 5xx **sans liste** ;
  · `offre` `{listingId, remise (entier 5–50), message? (≤ 2 000), confirme:true}`
    → éligibilité **revérifiée chez eBay** au moment d'envoyer (pas éligible ⇒
    409, vérification ratée ⇒ 5xx, rien n'est posté), puis
    `POST …/send_offer_to_interested_buyers` `{allowCounterOffer:false,
    offerDuration:{DAY,2}, offeredItems:[{listingId, discountPercentage:"N",
    quantity:1}]}`. Une coupure après l'envoi ⇒ 504 `incertain` (« je ne sais
    pas si elle est partie, regarde sur eBay ») ;
  · `retirer` `{itemId, confirme:true}` → Trading `EndFixedPriceItem`
    (`NotAvailable`) — sans retour côté eBay, d'où la confirmation exigée **par
    le serveur**, pas seulement par l'écran ; une coupure ⇒ 504 `incertain`.
  `offre` et `retirer` refusent **avant tout appel eBay** sans `confirme === true`
  (un `'true'` ou un `1` ne suffit pas). Les messages d'eBay remontent tels
  quels, **sans rien qui ressemble à un jeton** (`messageEbaySur`).
- **L'offre aux observateurs est l'équivalent eBay de la remise aux favoris de
  Vinted (§3 l'autorise)** : c'est eBay qui choisit les destinataires, VRM ne
  nomme personne et n'écrit à personne, et l'envoi part sur SON clic + une
  confirmation qui dit « si l'une accepte, la paire est vendue à ce prix ». Le
  bouton n'existe **que** sur une annonce qu'eBay déclare éligible (« Faire une
  offre aux N observateurs ») ; « pas d'observateur à qui l'envoyer » est dit
  **une fois** au-dessus de la liste (§7) ; éligibilité illisible ⇒ ni bouton
  ni phrase. `WatchCount` est maintenant rangé en `observateurs` (nombre, `null`
  si absent) : c'étaient des personnes qui suivent l'annonce, l'écran disait
  « vues » — `vues` reste pour les lecteurs d'avant.
- **L'anti double vente eBay, dans les deux sens — UNE règle**
  (`doublesVenteEbay`, à côté de `doublesVenteLbc`), rendue par l'écran
  eBay → Annonces **et** le centre de notifications (`?tab=ebay_annonces`) :
  · paire **prouvée** vendue sur Vinted (`lireVentesVintedProuvees` : transaction
    → `item_id` + un état de commande qui ne la fait pas revenir — la règle de
    l'écran Leboncoin et de l'extension, paginée et **stricte** : `lireTout(…,
    {strict:true})` rend `null` plutôt qu'une demi-liste) dont le SKU est sur une
    annonce eBay active ⇒ « Retirer d'eBay » (une confirmation « sans retour »).
    Une AUTRE annonce Vinted du même N° en vente et pas vendue ⇒ la paire est
    revenue : rien. Une conversation (état vide) ou une vente annulée : rien ;
  · commande eBay **engagée** (ni annulée, ni remboursée, ni paiement échoué) dont
    le SKU désigne une paire encore en vente sur Vinted ⇒ « retire-la de Vinted »
    avec le lien vers SON annonce — VRM ne touche jamais une annonce Vinted (§3).
    Vendue aussi sur Vinted ⇒ « une des deux ventes ne pourra pas partir ».
  · une annonce ou une commande **sans SKU** ne désigne RIEN, même au titre
    identique : l'écran la dit « pas reliée » (une phrase au-dessus de la liste,
    la pastille sur la carte).
  · « pas su » (ventes Vinted, ventes eBay, annonces Vinted illisibles) ⇒ AUCUNE
    alerte, et **une** ligne qui dit ce qui n'a pas pu être lu et ce que ça
    empêche. Les alertes passent AVANT « pas encore d'annonce » : une paire
    vendue sur eBay sort justement de la liste.
- ⚠️⚠️ **TROUVÉ EN ÉCRIVANT : LA SYNCHRO EFFAÇAIT SES ANNONCES SUR UN HOQUET
  D'eBAY.** `handleSync` réécrivait `ebay_listings`, `ebay_orders` et
  `ebay_inventory` **même quand la lecture avait échoué** — avec une liste vide.
  L'écran disait alors « pas encore d'annonce eBay », et l'anti double vente ne
  voyait plus rien à retirer. Une source qui n'a pas répondu garde sa dernière
  capture ; la réponse dit ce qui a été lu (`lu`).
- **Le SKU d'une variante n'est pas celui de l'annonce** : `<Variations>` est
  retiré avant de lire `<SKU>`.
- Trois bancs eBay étaient **rouges depuis la fermeture de la route le matin
  même** (ils appelaient sans session) : `ebay-api`, `ebay-write` et
  `ebay-callback` présentent maintenant la session du propriétaire (et la
  demande signée pour le retour de consentement) — ils mesuraient le 401, plus
  la route.
- Preuves : `audit-ebay-route.cjs` **77 contrôles, 55 rouges** sur le code
  d'avant ; banc `scripts/bancs/ebay-annonces.cjs` (données inventées, il vit
  dans le dépôt, deux tailles + un passage « pas su ») — **59 contrôles, 24
  rouges** sur le build d'avant (les 9 verts y sont les contrôles d'ABSENCE,
  vacants par construction). Il juge les `data-*` et le **corps exact** de ce
  qui part vers `/api/ebay`, et vérifie que **Annuler n'envoie rien**.
  `verif_visuel.cjs` (vraies fixtures) reste conforme aux deux tailles.
- ⚠️ **Rien n'a été appelé chez eBay pour de vrai** (ni en production) : les
  noms d'éléments (`SKU`, `WatchCount` dans `GetMyeBaySelling`) et les deux
  routes de négociation viennent de la documentation d'eBay. **Le premier geste
  de Julien** : ouvrir eBay → Annonces, relier ses 2 annonces (« Relier à une
  paire »), puis « ↻ Rafraîchir depuis eBay » sur Compte eBay — si la carte
  repasse « pas reliée », c'est que `GetMyeBaySelling` ne rend pas le SKU comme
  prévu, et c'est ça qu'il faut regarder, pas l'écran.


### eBay : « au-dessus, ça accepte » — c'est eBay qui accepte, au seuil qu'il fixe (9 octobre)
Julien : « je veux juste définir une règle sur chaque annonce et à chaque offre
au-dessus ça accepte ». Fait SUR eBAY seulement, avec le réglage natif d'eBay
(Offre directe : `BestOfferAutoAcceptPrice`, et en option le refus
`MinimumBestOfferPrice`) ; Vinted et l'extension ne changent pas (§3).
- **Fait** : actions `regleoffre` (pose, change, retire ; `ReviseFixedPriceItem`,
  `DeletedField` pour retirer) et `regleoffrelire` dans `api/ebay.js` (toujours
  12 fonctions) ; ligne `ebay_offres{_clé}` par compte eBay
  (lire-fusionner-réécrire gardé : lecture ratée ⇒ rien n'est écrit, et une
  lecture n'écrase pas une plus récente, `lueA`) ; la synchro lit la règle dans
  les GetItem qu'elle faisait déjà (zéro appel de plus, rien dans
  `ebay_listings`) ; carte « Offres reçues : eBay accepte dès X € » ou « Définir
  une règle d'offre », modification en place ; « Une règle pour toutes » (%,
  aperçu arrondi au centime SUPÉRIEUR, une par une, Arrêter, bilan dont la somme
  vaut le total) ; champs à la création, dans les brouillons et le
  planificateur (sans règle, le XML envoyé est celui d'avant, au caractère
  près) ; un changement de prix (carte ET baisse des paires qui dorment) relit
  la règle et dit ce qu'il en reste ; déconnexion d'un compte eBay et « Fermer
  mon compte » disent combien d'annonces gardent une règle chez eBay.
- **Décisions** : trois états (connue · aucune · pas su ; une lecture de plus de
  30 jours, un prix changé depuis, des offres dont on ne sait pas si elles sont
  actives valent « pas su », qui n'affiche AUCUN montant) ; le prix et la règle
  que Julien a VUS sont des gardes serveur (`prixVu`, `attendu` : 409 s'ils ont
  changé chez eBay — une règle existante jamais lue n'est pas écrasée sans le
  lui redemander) ; un seuil sous la moitié du prix (« 7 » au lieu de « 72 »)
  exige `sousMoitie` ; la base est marquée « en cours » AVANT l'écriture chez
  eBay ; sans `<Ack>` ou panne d'eBay (`SystemError`, classe absente) ⇒
  relecture, jamais « refusé » ; le refus existant est RENVOYÉ quand on ne le
  touche pas (sinon eBay peut le faire sauter) ; le compte de L'ANNONCE, jamais
  celui de la vue ; pas de règle sur une paire vendue ailleurs ou en vente sur
  deux comptes (retirer reste possible, un clic, sans feuille) ; l'écran dit les
  deux fenêtres où eBay vend sans que VRM le voie (ventes eBay relues à
  l'ouverture au-delà de 6 h quand une règle est posée ; retrait automatique
  seulement VRM ouvert). Couleurs : texte pour un ✓ sans réserve, ambre pour
  tout le reste — jamais de vert.
- **Preuves** : `audit-ebay-route.cjs` section 12 (**126 contrôles**, la
  route exécutée ; **105 rouges** sur la base d'avant, `worktree-wf_d62e1db4-b5c-1`) ;
  `prouve-regle-offre.cjs` (**16 mutations** de la route, chacune rouge sur les
  contrôles nommés ; XML de publication sans règle identique à celui d'avant,
  12 048 caractères, et avec `offre: null` ; une route qui appellerait
  `RespondToBestOffer` fait rougir `audit-offres-auto.cjs`, section 5) ; banc
  `ebay-regle-offre.cjs` (port 4761, données inventées, deux tailles, **202
  contrôles**) prouvé par `prouve-banc-regle-offre.cjs` (**11 mutations** de
  l'écran, chacune rouge ; **47 rouges sur 53** sur le build d'avant) ; `ebay-form`,
  `ebay-programmer`, `annonces-carte` étendus — sur le build d'avant, **2**, **3**
  et **3 rouges** (le formulaire, les brouillons programmés, la baisse d'une
  paire qui dort sous une règle). `audit-ebay-route.cjs` entier : 354 contrôles.
  ⚠️ **Trois bancs eBay mesuraient une forme d'avant** (§6.3) : `ebay-write`
  jugeait le DERNIER appel Trading — or un changement de prix relit maintenant
  l'annonce après la révision (rouge sur une route intacte) ; `ebay-programmer`
  jugeait les brouillons illisibles pendant « charge » (rouge sous charge) ;
  `ebay-form` mourait sur un build sans le champ au lieu de rapporter.
  ⚠️ **Deux contrôles du banc étaient des courses d'horloge** (« Arrêter »
  pendant le 1er envoi, quitter l'écran pendant le 2ᵉ) : rouges une fois sur
  quelques-unes à 1512 px sur une machine chargée, sur un code intact. Le faux
  eBay RETIENT maintenant la requête visée jusqu'au geste (`retenir`). *Un
  geste « pendant » se joue sur une requête tenue, jamais sur un délai.*
  ⚠️ Vu au rendu : l'anneau de focus de TOUTE l'app était encore le vert de
  l'ancienne palette menthe (`#0f6b4f`, posé après la règle aux couleurs de la
  marque, il l'écrasait) — remis au bleu de la marque, le sombre suit
  `data-theme`.
- **Non mesuré (eBay et la production sont bloqués d'ici, rien n'a été appelé
  pour de vrai)** : les noms et places des éléments dans `ReviseFixedPriceItem`
  et `AddFixedPriceItem` (doc d'eBay) ; `DeletedField` sur ces chemins ; que
  `GetItem` rende les seuils au jeton du vendeur et qu'« absent » veuille dire
  « pas de seuil » ; que la catégorie 15709 sur eBay.fr accepte le seuil (sinon
  eBay active les offres sans le montant : l'écran le dit) ; « strictement sous
  le prix » (23004) et « refus sous l'acceptation » (sources tierces) ; ce que
  `ReviseInventoryStatus` fait d'une annonce à seuils (effacer, garder, refuser :
  les trois issues sont tenues, l'écran ne dit que ce qu'il a relu) ; une offre
  égale au seuil acceptée ; le délai de propagation d'une révision (VRM relit
  une 2ᵉ fois après 2 s) ; une offre déjà faite et en attente acceptée dès la
  pose (la feuille le dit comme une possibilité) ; la révision d'une annonce
  PROGRAMMÉE (refusée par VRM, 409). **Premiers gestes de Julien** : eBay →
  Compte eBay → « ↻ Rafraîchir depuis eBay » (ses 2 annonces passent de « — » à
  leur vrai état) ; relier ses 2 annonces à leur paire ; poser une règle sur UNE
  annonce et lire le message (« ✓ … » ou « activé les offres mais pas gardé le
  montant ») ; la retirer ; changer le prix d'une annonce à règle et lire ce que
  VRM a relu.

#### Revue du 11 octobre — neuf défauts signalés, neuf reproduits, neuf corrigés
Chaque défaut a été REPRODUIT d'abord (la vraie route dans le harnais
d'`audit-ebay-route`, l'app rendue sur données inventées), puis corrigé à la
racine, rouge sur 2a34c1c et vert après.
- ⚠️⚠️ **Deux gestes sur deux cartes du même compte s'effaçaient dans
  `ebay_offres`** (pose sur la Nike, retrait sur la Samba, à 0-100 ms) : la base
  disait « aucune » sur une annonce qu'eBay vendait dès 72 €, et les DEUX
  réponses disaient `range:true`. Conséquences mesurées : carte « aucune », bloc
  « ce que ça engage » qui ne la compte plus, ventes eBay plus relues à
  l'ouverture pour ce compte. Cause : lire-fusionner-réécrire la ligne ENTIÈRE
  (upsert), sans verrou ni version — la règle `lueA` ne protégeait que contre
  une lecture plus ancienne fournie DANS l'appel, pas contre la copie périmée
  des AUTRES annonces qu'un écrivain concurrent réécrit.
  ⇒ `modifierDonnee` (`api/_lib/ebay.js`) **compare-et-échange** sur
  `data.rev` : PATCH filtré `data->>rev=eq.N` (Postgres réévalue le filtre
  après avoir pris le verrou de la ligne : un écrivain devancé reçoit 0 ligne,
  relit et refait SA fusion sur ce que l'autre a écrit) ; ligne absente ⇒
  INSERT sans fusion (409 ⇒ on relit). Lecture ratée ⇒ rien n'est écrit,
  toujours. `[R-concurrence]` : **3 rouges sur 2a34c1c** (pose + retrait, deux
  poses, deux premières poses sur une ligne absente), 0 après ; mutation
  `sans-cas` (l'écriture sans la version) ⇒ rouge.
  ✅ **17 octobre** : `modifierComptes` (registre `ebay_comptes`) et
  `sortirDesAnnonces` (`ebay_listings`) passent aussi par `modifierDonnee`
  (audit : « deux retraits simultanés », rouge sur l'avant). Restent les
  brouillons (écrits par l'app).
- ⚠️⚠️ **Fermer « Une règle pour toutes » pendant un lot arrêtait le lot en
  silence** — la réponse EN VOL n'était jamais appliquée (la carte disait
  « aucune règle » quand eBay en tenait une), les cartes du lot restaient
  grisées pour toujours, et le bandeau « lot interrompu » n'apparaissait qu'au
  montage SUIVANT de l'écran. ⇒ La porte est **grisée pendant un lot** (on
  arrête par « Arrêter », qui fait un bilan) ; et si le panneau disparaît quand
  même (une sonde de connexion qui hoquette le démonte), la réponse en vol
  s'applique à la carte, les cartes sont rendues, l'écran relit la base et
  **dit** l'arrêt tout de suite (`onInterrompu`). Banc bloc 14 : 4 rouges par
  taille sur 2a34c1c ; mutation `porte-lot` ⇒ SEUL le contrôle de la porte
  rougit (fermer pour de vrai ne casse plus rien d'autre — c'est ce qui prouve
  le démontage), `porte-et-demontage` ⇒ les trois conséquences rougissent.
- **`verifie: null` voulait dire deux choses, l'écran n'en connaissait
  qu'une** : sans lecture, la route n'a pas pu relire ; AVEC une lecture, elle a
  relu le BON montant et seul l'état des offres manque (eBay ne montre pas
  `BestOfferEnabled`). La carte disait « je n'ai pas pu le relire — Relire chez
  eBay » — une phrase qui ne venait pas de la donnée (§5), et un geste qui
  rendrait la même chose. ⇒ Septième issue, `offres-inconnues` : le seuil RELU
  est dit, avec « regarde l'annonce sur eBay » et le lien ; le lot la compte à
  part (`data-regles-offres-inconnues`).
- **L'aperçu « Une règle pour toutes » calculait sur l'ancien prix** (celui de
  la liste) pendant que la carte affichait le prix relu chez eBay : 85,50 € «
  dès » sur une annonce à 80 €. ⇒ `prixDe(it)`, UNE source pour la carte,
  `etatDe` et l'aperçu (§11) ; ce qui part porte `prixVu` 80.
- **Après un lot, changer le pourcentage laissait « ✓ réglée » sous « dès
  72,00 € »**. ⇒ Une issue porte le montant ENVOYÉ (`seuilEnvoye`) et ne se
  montre que sous une ligne qui propose ce montant-là.
- **« Dont 1 lue il y a plus de 7 jours » sans qu'aucune carte ne le dise**
  (lecture de 7 j ½ : `> 7 × 24 h` en haut, jours arrondis `> 7` sur la carte).
  ⇒ `ageRegleJ` / `regleVieille`, une règle pour les deux.
- **✏️ Modifier le prix : « 72 € » ou « 0 » n'étaient pas envoyés et l'écran
  disait « ✓ Modifié sur eBay »** (régression de `prixChange` : illisible valait
  « inchangé »). ⇒ Le prix tapé se lit par `montantSaisi` (§11) ; non vide et
  illisible ⇒ « Un prix en euros… — rien n'a été envoyé à eBay », aucun envoi.
- **Banc `ebay-regle-offre` : deux attentes fixes** (900 ms après « Oui »,
  1 200 ms après l'ouverture) — rouge sur une app intacte dès que la machine
  rame ou que les ventes Vinted mettent du temps à arriver (l'app grise alors
  « Définir / Modifier », à raison). ⇒ Le banc attend que le faux eBay ait
  RÉPONDU puis que la carte ne soit plus en envoi (`data-regle-envoi`), et le
  VERDICT des ventes rendu (`data-regle-bloquee` ≠ « en-cours »). Reproduit à
  coup sûr avec deux leviers ajoutés au banc : `BANC_EBAY_DELAI=1500` (faux eBay
  lent) ⇒ l'ancien banc **8 rouges sur 8** au bloc 8 sur l'app intacte, le neuf
  0 ; `BANC_TXN_DELAI=7000` (ventes lentes) ⇒ l'ancien **2 rouges**
  (`locator.click: Timeout 5000ms`), le neuf 0. `PORT` se règle par
  l'environnement (aussi pour `ebay-annonces`, `ebay-programmer`, `ebay-form`,
  `ebay-comptes`, `annonces-carte` : lancés un par un sur 4781-4786, tous verts). *Un geste se juge sur sa réponse appliquée, jamais sur un
  délai* — la leçon de « retenir », appliquée aux poses une par une.
- **Preuves** : `audit-ebay-route.cjs` **357 contrôles** (3 rouges sur
  2a34c1c) ; `prouve-regle-offre.cjs` **22 sur 22** (17 mutations de la route,
  dont `sans-cas` et `rangement` réancrée sur `modifierDonnee` ; XML sans règle
  identique à celui d'avant) ; banc `ebay-regle-offre.cjs` **234 contrôles, 0
  rouge** (blocs 8, 11, 14 : **20 rouges** sur le build de 2a34c1c, exactement
  les dix contrôles visés par taille, les autres contrôles de ces blocs verts) ;
  `prouve-banc-regle-offre.cjs` **26 sur 26** (18 mutations de l'écran, dont 7
  nouvelles ; `porte-lot` et `porte-et-demontage` vérifient QUELS contrôles
  rougissent, pas seulement le bloc). Tous les audits verts (84).
- **Non mesuré** : les deux formes du compare-et-échange contre la VRAIE
  PostgREST (`PATCH …&data->>rev=eq.N&select=id` avec `return=representation`,
  `data->>rev=is.null` pour une ligne d'avant, 409 sur un INSERT en doublon) —
  servies par le faux de l'audit, jamais envoyées à la base (aucune écriture en
  production) ; le chemin « panneau démonté, écran encore là » n'a été joué
  qu'en réaffaiblissant la porte (la sonde de connexion qui le déclencherait ne
  se pilote pas au banc).

#### Revue du 11 octobre, tour 2 — sept défauts signalés, sept reproduits, corrigés
Chaque défaut REPRODUIT d'abord avec la sonde du relecteur sur bac8da1 (la vraie
route dans le harnais d'`audit-ebay-route`, l'app rendue sur données inventées),
corrigé à la racine, puis : rouge sur bac8da1 (copie `git archive`, contrôle lancé
DEPUIS elle, §6.1), vert après, rouge sous une mutation qui réaffaiblit le correctif.
- ⚠️⚠️ **Une lecture RATÉE effaçait une règle ACTIVE connue.** Un GetItem qui
  hoquette pendant la synchro ou « Relire chez eBay » rangeait `{lu:false,
  raison:'lecture-ratee'}` — plus récent, donc gagnant — par-dessus « eBay accepte
  dès 72 € ». Conséquences reproduites : ligne « pas su » en gris (sans risque),
  annonce sortie de « ce que ça engage », et plus de relecture des ventes eBay à
  l'ouverture pour ce compte (le filtre « règle active » ne la voyait plus),
  pendant qu'eBay vendait au seuil. Et c'est justement quand une règle est active
  que cette synchro tourne. ⇒ `rangerReglesOffre` : une lecture ratée ne remplit
  qu'une place VIDE — jamais par-dessus une règle connue, ni par-dessus une
  écriture incertaine (`en-cours`, `incertain`, `apres-ecriture` restent : elles
  disent un risque). L'écran ne la pose plus localement non plus, et DIT combien
  de relectures ont raté (« eBay n'a pas rendu N annonces : VRM garde ce qu'il en
  savait »). *Rien lu ne vaut pas rien, y compris quand « rien lu » est plus
  récent.*
- ⚠️ **Course : `lueA` était l'heure de la RÉPONSE.** Une lecture partie AVANT une
  pose et revenue APRÈS se croyait plus fraîche que la relecture de la pose et la
  réécrivait (« aucune » sur une annonce qu'eBay vend dès 72 €, synchro ET
  « Relire »). ⇒ `lueA` = l'heure où la question PART chez eBay (`t0`, dans
  `lectureRegleDe`, une lecture pour la synchro, la relecture, la pose, le prix et
  la publication). Et `garder` (la liste complète d'une synchro) effaçait la
  règle d'une annonce publiée PENDANT la synchro (liste lue avant elle) : il
  porte maintenant l'heure de la liste (`{ids, a}`) et n'efface qu'une entrée
  PLUS ANCIENNE qu'elle. L'autre sens est gardé : une annonce terminée, rangée
  avant la liste, en sort toujours.
- **Montants qui s'arrondissent à 0** : `montantOk` acceptait 1e-9 (« > 0 » et
  1e-7 de tolérance) ; la création envoyait `BestOfferAutoAcceptPrice 0.00` (et
  `MinimumBestOfferPrice 0.00` SANS aucune confirmation). ⇒ au moins un centime
  APRÈS arrondi, dans la route et dans l'app (la même copie, `[R-§11]` compare
  leurs sorties, cas 1e-9 / 5e-324 / 0,004 / 0,01 compris). Ce qu'eBay fait d'un
  seuil à 0,00 n'est pas mesuré — il ne part plus.
- ⚠️⚠️ **✏️ « Modifier le prix / le stock » gardait le prix de la LISTE** (n° 4 et
  n° 7, une cause). Après une 409 « prix-change », la carte affichait le prix relu
  chez eBay (95 €, ou 80 €) et le champ Prix restait « 90,0 » (initialisé une
  fois sur `it.price`) : changer le STOCK seul renvoyait 90 € à eBay, avec
  « ✓ Modifié sur eBay » — et, sous une règle, se faisait refuser par la garde de
  la règle. ⇒ le champ part du prix de la CARTE (`prixCarte`, la même source que
  l'en-tête, §11) et `price` vaut `null` tant qu'il n'est pas tapé : le prix ne
  part que TAPÉ et différent.
- **« Seuil relu, offres activées ou non pas montré » parlait de trois voix** : la
  carte « regarde l'annonce sur eBay », la ligne du haut « pas encore lue —
  Relire chez eBay » (une relecture en boucle, qui rendait la même chose),
  l'aperçu du lot « relis-la d'abord ». ⇒ UNE règle, `PAS_SU_SANS_RELECTURE` /
  `seRelitChezEbay` (illisible · devise · offres-inconnues), lue par la ligne du
  haut, « Relire chez eBay » et le lot : la ligne du haut la dit à part avec son
  geste (le lien vers l'annonce) et ne propose « Relire » que s'il reste une
  annonce vraiment pas lue ; le lot lui donne un statut propre (`a-voir-ebay`,
  pas cochable) ; le panneau montre le seuil lu. ⚠️ **Trouvé en reproduisant** :
  « Définir une règle » sur cette annonce envoyait `attendu:'inconnu'` ⇒ 409
  « eBay a déjà une règle » ⇒ même état ⇒ même 409, **sans fin**. L'état porte
  maintenant `lu`, la garde l'envoie (ce que le panneau montre), et la pose
  active les offres (`BestOfferEnabled`).
- **Lot : « 1 à revoir » et plus aucune ligne pour dire laquelle** (régression
  des correctifs #4 et #5 du premier tour : le montant de la ligne est recalculé
  sur le prix relu, et l'issue ne s'affichait que sous le montant envoyé). ⇒
  « à revoir » s'affiche toujours sur SA ligne — rien n'a été posé, la condition
  du montant ne s'y applique pas — et dit le prix relu (« le prix sur eBay est
  maintenant de 95,00 € — rien n'a été envoyé, le montant est recalculé »).
- **Preuves** : `audit-ebay-route.cjs` **377 contrôles** (`[R-lecture-ratee]`,
  `[R-course]` — lectures TENUES, jamais un délai —, `[R-mont]` et `[R-crea]`
  étendus) : **16 rouges sur bac8da1**, 0 après ; `prouve-regle-offre.cjs` **26
  sur 26** (21 mutations de la route, dont 4 nouvelles : `lecture-ratee-remplace`,
  `luea-arrivee`, `garder-sans-age`, `montant-zero` ; XML sans règle toujours
  identique, 12 048 caractères). Banc `ebay-regle-offre.cjs` bloc **15** (50
  contrôles, deux tailles) : **20 rouges sur le build de bac8da1** — exactement
  les dix contrôles visés par taille, les `finPage` verts — et **284 contrôles, 0
  rouge** en entier ; `prouve-banc-regle-offre.cjs` : 7 mutations nouvelles
  (`champ-prix-fige`, `offres-inconnues-relire`, `offres-inconnues-ligne`,
  `offres-inconnues-lot`, `attendu-inconnu`, `issue-a-revoir`,
  `relire-ratee-locale`), chacune rouge sur SON contrôle et verte sur ceux
  qu'elle ne vise pas ; l'ancre d'`issue-montant` suit la nouvelle condition ;
  les **25 mutations** relancées une par une sur ce code : **25 rouges sur 25**
  (aucun contrôle précis de `porte-lot` / `porte-et-demontage` déplacé).
  Les 84 audits verts. Bancs eBay lancés un par un (ports 4792-4798) :
  `ebay-annonces`, `ebay-programmer`, `ebay-form`, `ebay-api`, `ebay-write`,
  `ebay-callback`, `ebay-deletion` verts.
  ⚠️ **Deux bancs rouges, et ils l'étaient AVANT** (mesuré sur le build de
  bac8da1, lancés seuls) : `ebay-comptes` « publier une paire libre » tombe une
  fois sur deux ou trois sur les deux builds (« element is outside of the
  viewport » puis « not stable » sur « Oui, publier » à 1512 px — la feuille
  bouge pendant le clic ; 2 rouges sur 3 passes sur bac8da1, 1 sur 2 après), et
  `annonces-carte` « la baisse eBay se déroule jusqu'au bout » (1 rouge, le même
  sur bac8da1). Une course d'horloge du banc, pas l'écran de la règle — à
  rejouer sur une requête TENUE, comme `retenir`.
- **Non mesuré** : un `GetItem` réel d'eBay qui échoue au milieu d'une synchro
  (servi par le faux de l'audit) ; l'heure de départ d'une lecture n'a de sens que
  sur l'horloge d'UNE instance Vercel — deux instances aux horloges décalées de
  plus que la durée d'une pose pourraient encore se croiser.

#### Revue du 11 octobre, tour 3 — douze défauts signalés, douze reproduits, corrigés
Même méthode, sur c4fa405 : chaque défaut REPRODUIT (la vraie route dans le
harnais d'`audit-ebay-route`, l'app rendue sur données inventées), corrigé à la
racine, rouge sur c4fa405 (copie `git archive`, contrôle lancé DEPUIS elle,
§6.1), vert après, rouge sous une mutation qui réaffaiblit le correctif.
- ⚠️⚠️ **Une règle qu'eBay tient PEUT-ÊTRE n'était comptée NULLE PART** (n° 1 et
  n° 6, une cause). Cinq lecteurs jugeaient « règle active » chacun à sa façon
  (`offresActives === true` sur la ligne BRUTE, ou `etat === 'connue'`) : un seuil
  relu sans l'état des offres, une pose incertaine, en cours, ou posée mais pas
  relue — même quand eBay avait répondu « Success » — n'entraient ni dans la
  relecture des ventes eBay à l'ouverture, ni dans « ce que ça engage », ni dans
  la déconnexion du compte eBay, ni dans « Fermer mon compte » : **eBay pouvait
  vendre au seuil sans que VRM relise rien ni le dise**. Et, dans l'autre sens,
  la ligne brute comptait des annonces TERMINÉES et des prix changés : l'écran
  disait « 2 actives + 1 peut-être », la feuille de déconnexion « 4 ».
  ⇒ UNE règle (§11) : `regleEngage` (`'oui'` = connue · `'peut-etre'` = « pas su »
  AVEC risque, `etatRegleOffre` · `null`) et `reglesEngagees(parCompte)`, lues par
  la relecture des ventes, le bloc « ce que ça engage » (« 0 connue · 1
  peut-être », avec le geste), l'alerte « vendue sur Vinted — encore en vente sur
  eBay » (« elle a PEUT-ÊTRE une règle d'offre »), `compterReglesEbay`
  (déconnexion, fermeture : `{oui, peutEtre}`, les deux dits). Une entrée dont
  l'annonce n'est ni en ligne ni programmée sur des listes COMPLÈTES lues après
  elle (10 min de marge) ne compte plus ; listes illisibles ⇒ elle compte (« pas
  su » ne cache rien) ; le prix de la liste juge « prix changé ».
  ⇒ Côté route, une annonce terminée SORT des règles rangées : « Retirer d'eBay »
  et l'annulation vérifiée d'une programmation (`sortirDesRegles`,
  compare-et-échange : une lecture ratée n'écrit rien, la réponse dit `regles`),
  et « Relire chez eBay » sur une liste complète (`garder = {ids, a: heure de la
  liste}`, la règle de la synchro du tour 2).
- ⚠️⚠️ **Une annonce PROGRAMMÉE avec sa règle n'était jamais rangée ni relue**
  (n° 2) — même mise en ligne « Maintenant » : partie, elle sortait des
  programmées sans entrer dans Annonces, et le seuil que VRM venait d'envoyer
  n'était plus visible nulle part. ⇒ `rangerRegleProgrammee` (route) : en ligne
  maintenant (pas d'heure, ou eBay a ignoré l'heure) ⇒ relue et rangée comme une
  publication (`par: 'programmation'`) ; pour plus tard ⇒ rangée `programmee`
  avec ce qui a été ENVOYÉ (un risque : « peut-être », « Relire chez eBay ») ; le
  doublon 488 (premier essai resté sans réponse) la range aussi. Côté app, une
  programmée qu'eBay dit partie mais que la liste ne porte pas encore fait relire
  le compte (une synchro, une fois par annonce et par ouverture).
- **« Retirer la règle » manquait sur une paire bloquée** (vendue, en vente sur
  deux comptes) quand la règle n'était que « peut-être » (n° 3) : le bouton
  suit `regleEngage`, plus `etat === 'connue'`.
- **Les confirmations ne disaient pas toutes la même conséquence** : la feuille
  du lot ne disait pas qu'une offre déjà faite peut être acceptée dès la pose
  (n° 4 — `texteOffresDejaFaites`, une phrase pour la carte et le lot), celle du
  planificateur ne disait pas qu'une offre acceptée VEND la paire (n° 5 — la
  forme exigée par la décision du 9 octobre ; `OFFRE_VEND_LA_PAIRE`, une
  conséquence pour la carte, le lot, la publication et le planificateur).
- **Trois phrases ne venaient pas de la source de la carte** (§5) : « ✓ Prix
  changé — ta règle reste à 72 € » en couleur de texte sous une carte « pas su »
  ou « aucune » sur la même lecture (n° 7 — `regleApresPrix` passe par
  `etatRegleOffre`) ; la publication écrivait « pas encore relue » sur un seuil
  relu (n° 8 — `messageOffreCreation` passe par `resultatRegleOffre`, la route
  rend `range`) ; le lot écrivait « ✓ réglée » sur une règle qu'eBay a posée et
  que VRM n'a pas pu noter (n° 12 — `nonNote`, en ambre, comme la carte).
- **« Pas sur ce compte » était AVALÉ par « Relire chez eBay »** (n° 9) : eBay
  disait, sur sa liste complète, que l'annonce n'y était plus — la carte restait
  « en ligne », la ligne du haut « jamais lue », et Relire renvoyait la même
  relecture sans fin. ⇒ La carte le porte, l'écran le dit, relit la LISTE du
  compte (une synchro) ; `pas-sur-ce-compte` rejoint `PAS_SU_SANS_RELECTURE`.
- **Chaque « pas su » avec SON geste, et seulement le sien** (n° 10, n° 11) :
  deux annonces « seuil relu, offres activées ou non pas montré » avaient deux
  cartes identiques à « jamais lue », sans lien ⇒ la carte dit le seuil MONTRÉ
  par eBay et porte SON lien, la ligne du haut nomme chacune avec son lien.
  « Relire chez eBay » était proposé pour une autre devise et pour NOTRE lecture
  ratée, et le lot proposait « Relire ces 9 annonces chez eBay », un bouton qui
  n'envoyait rien ⇒ autre devise : dite, sans geste ; notre lecture ratée :
  « Réessayer » (relit VRM, rien ne part chez eBay) ; le lot dit « règle actuelle
  pas lisible dans VRM — rien n'est remplacé à l'aveugle ».
- ⚠️ **`[R-course]` tombait une fois sur plusieurs dizaines** : le faux eBay
  servait la pose et la lecture tenue dans la MÊME milliseconde, et deux `lueA`
  égaux ne s'ordonnent pas. Le contrôle attend 3 ms (la route ne change pas) —
  sur la vraie horloge, une lecture qui part avant une pose et une pose ne
  partagent pas leur milliseconde.
- **Preuves** : `audit-ebay-route.cjs` **393 contrôles** (+15 : `[R-prog-regle]`,
  `[R-retire-regle]`, `[R-lire-absente]`, `[R-engage]`, `[R-apres-prix]`,
  `[R-publie-offre]` — les deux derniers exécutent les règles de l'APP dans un
  `vm`) : **10 rouges sur c4fa405**, 0 après ; `prouve-regle-offre.cjs` : 7
  mutations nouvelles (route : `prog-non-rangee`, `retirer-garde-regle`,
  `lire-sans-garder` ; app : `engage-connue-seule`, `engage-sans-liste`,
  `apres-prix-brut`, `publie-sans-lecture`), chacune rouge sur SON contrôle — **33 sur 33** au total (28 mutations ; le XML
  sans règle toujours identique, 12 048 caractères).
  ⚠️ Le premier jet d'`apres-prix-brut` était VERT : il ne retirait que la
  ligne « offres activées ou non », et la ligne suivante disait déjà ambre — la
  mutation neutralise maintenant la règle elle-même (l'état forcé à « connue »).
  Banc `ebay-regle-offre.cjs` bloc **16** (nouveau) et blocs 2 et 13 révisés :
  **21 rouges sur le build de c4fa405** (47 contrôles à 1512 px) ; en entier,
  **342 contrôles, 0 rouge** aux deux tailles.
  `prouve-banc-regle-offre.cjs` : 13 mutations nouvelles, dont deux qui visent
  un AUTRE banc (`planif-vend` → `ebay-programmer`, `publie-pas-relue` →
  `ebay-form` : il les lance tels quels et exige le contrôle visé), relancées une
  par une : **13 rouges sur 13**, chacune sur SON contrôle. ⚠️ Le premier jet de
  `devise-relire` exigeait le premier contrôle de l'essai — vert sous la mutation
  (le clic n'envoie qu'A4 dans les deux cas) : c'est « il ne reste que la
  devise : plus de « Relire chez eBay » » qui l'attrape.
  `ebay-programmer` et `ebay-form` : +1 contrôle chacun, **1 rouge** chacun sur
  le build de c4fa405. Les 83 audits verts (`audit-renum-b` sauté) ; bancs eBay
  un par un (ports 4791-4796) : `ebay-annonces` (92), `ebay-programmer` (110),
  `ebay-form` (45), `ebay-comptes` (54), `annonces-carte` (60), `ebay-api`,
  `ebay-write`, `ebay-callback`, `ebay-deletion` verts. ⚠️ Lancés pendant les
  audits, `annonces-carte` (« les cas « règle d'offre » se déroulent », un clic
  à 4 s) et `audit-pont-session` (« il ne s'annonce qu'une fois » : 2 `ready`,
  extension intouchée) sont tombés une fois — relancés SEULS, verts.
- **Non mesuré** : ce qu'eBay répond à `GetItem` sur une annonce programmée pas
  encore partie (elle n'est pas relue avant son départ — la synchro qui suit la
  relit) ; ce qu'il rend quand une programmée part sans que la liste la porte
  encore (servi par le faux de l'audit et du banc).


### Messages dans Vinted, et un écran Leboncoin qui commence par ce qu'on fait (4 octobre)
Julien : « dans Vinted et dans Leboncoin il y ait les messages », « Leboncoin
beaucoup plus intuitif ».
- **Messages Vinted** : l'écran complet existait (liste tous comptes, fil,
  réponse, offres) mais n'avait **plus aucune porte dans Vinted** — seulement la
  cloche. Il est la 4ᵉ section de l'onglet Vinted (Ventes · Achats · Annonces ·
  Messages). Un **point** (pas un nombre) signale des non-lus : trois règles de
  comptage coexistent (coque, cloche, écran), un chiffre sur l'onglet pourrait
  contredire celui de l'écran (§11). L'ancien `?tab=cat_msg` (cloche, bandeau,
  « à faire ») y mène (`subVoulue`) ; `messagerie.cjs` le vérifie.
- **Leboncoin → Annonces** : la liste « à publier » — la seule chose qu'il fait
  ici — était le DERNIER de douze blocs. Ce qui se LIT une fois (préparation de
  la publication, paragraphe d'explication, comptes, limite de l'offre) descend
  dans **« Détails et réglages »**, replié en bas ; en haut il ne reste que ce
  qui se FAIT (double vente, « quelle paire ? », à retirer, à publier).
  - « Offre : **Gratuit** » s'affichait quand aucune offre n'était connue
    (`plan`/`limit` jamais renseignés) — une valeur **inventée** : retirée.
  - « Comptes Leboncoin détectés » ne s'affiche plus pour UN compte.
  - **Un nom, une porte** : l'entrée de menu « À publier » ouvrait le même écran
    sous un autre nom ; retirée, et `?tab=leboncoin` mène à Leboncoin →
    Annonces.
- **Reste à faire (mesuré par la carte du 4 octobre)** : les messages
  **Leboncoin** — aucune conversation captée en base, mais l'extension a VU les
  endpoints (compteur de non-lus `{userId, unread}`, détail de conversation,
  envoi) ; il faut d'abord corriger la mesure (UUID non normalisés dans
  `lbc_recon`, `paths` plein à 300/300) puis relever le compteur par compte. Les
  messages **eBay** n'existent pas dans l'app (« comme pour eBay » n'a pas de
  modèle) — à trancher avec lui, et c'est le domaine de la session eBay.


### Messages Leboncoin : le NOMBRE de non-lus, par compte — et un message client fuyait (4 octobre, 5.153)
Julien : « dans Leboncoin, il y ait les messages ». **Mesuré** : aucune
conversation captée, mais la page Leboncoin recharge elle-même un compteur
`{userId, unread, pollingTime}` par compte, et `linked_accounts` liste ses
comptes. L'extension relaie **ce nombre** (`lbcmsgcompteur`) et ses comptes liés
**sans email** (`lbccomptes`) ; le fond range `lbc_messages`
(`compteurs[userId]`, `comptes[id]`) en lire-fusionner-réécrire gardé contre la
lecture ratée (dans `audit-fusion.cjs`), et n'écrit que si le nombre change.
Zéro requête de plus vers Leboncoin.
- L'app : **Leboncoin → Messages**, chaque compte nommé avec son nombre, « — »
  pour un compte lié jamais relevé (jamais « 0 »), un relevé de plus de 24 h le
  dit, et le bouton ouvre la messagerie de Leboncoin. On y répond là-bas : lire
  les fils viendra après avoir MESURÉ leur forme (un passage de Julien sur
  leboncoin.fr/messages avec la 5.153), jamais avant.
- ⚠️⚠️ **LE TEXTE D'UN MESSAGE CLIENT QUITTAIT LA PAGE.** Une réponse de
  conversation contient « subject », « owner », « annonce » : elle passait
  `AD_HINT` et partait en `lbcraw` — dont le fond garde un échantillon de 9 000
  caractères en base. Prouvé sur le code d'avant (« un message client est
  parti »). Désormais **aucune réponse `/messaging/` ne sort**, sauf le nombre ;
  le jeton `realtime/credentials` ne sort jamais (pas même ses clés).
- **UUID** : la règle « 3 chiffres ou plus → {id} » mangeait le début d'un UUID
  et laissait le reste — les UUID de ses conversations partaient à moitié en
  clair dans `lbc_recon`, et chaque conversation créait sa clé de schéma.
  `sansUuid` passe d'abord (chemins, schémas, envois).
- Preuves : `audit-lbc-messages.cjs` (le VRAI `lbc-inject.js` dans un vrai
  navigateur, sous le nom de leboncoin.fr — **10 contrôles, 8 rouges** sur le
  code d'avant) ; banc `lbc-messages.cjs` (trois états : relevé · jamais · panne)
  — il a attrapé « 4non lus » (l'espace n'était qu'une marge visuelle).
- Extension **5.153.0**, zip régénéré, `EXT_ATTENDUE` suivie,
  `EXT_CAPACITES.lbcmsg`.


### « Les notifications des messages ne sont pas toujours envoyées » — le serveur, l'app, la fuite de l'IA (11 octobre)
**Mesuré d'abord** (base en lecture seule, journaux de la base ; rapport et deux
relectures dans le scratchpad `plaintes-11oct/notifications*.md`) : **le serveur
n'a perdu aucune notification les 9 et 10 octobre** (22 emails de message, 22
envois, 0 purge). Ce qui manque est en amont : **3 comptes n'envoient aucun
email à VRM** (`angeled92` et `tomj606` jamais, `arthuror2` plus rien depuis le
23 septembre — prouvé par transaction : leurs ventes n'ont aucun
`email_bord_{tx}`), Vinted envoie l'email **~15 min 30 s** après le message, et
pas quand il a déjà répondu dans l'app Vinted (3 sur 3). ⚠️ **« Masquer mon
adresse » d'Apple n'est PAS la cause prouvée** : deux comptes retirés à adresse
Apple recevaient très bien leurs emails, et le relais d'`arthuror2` transfère.
Les « 4 messages sans email » du premier rapport étaient des réponses de Julien.
- **La notification nomme la paire** (`paireDuSujetMessage`, lue dans le sujet
  « Nouveau message à propos de … », rien d'autre) : « 💬 {paire} » /
  « Nouveau message sur {compte} — ouvre Vinted pour répondre. »
- **Quatre faiblesses de la route, reproduites puis fermées** (banc
  `notif-messages.cjs`, la vraie route, base à état) :
  · préférences illisibles ⇒ la dernière lue par l'instance, sinon on SONNE pour
    ce qui appelle un geste ou de l'argent **et les messages** (`SONNE_SI_PAS_SU`)
    — suivi, achat, favori, facture gardent leur défaut ;
  · mémo anti-doublon lu en **trois états** (`supabaseLireRow`) : une lecture
    ratée ne le réécrit plus à vide ; on envoie, et la clé est retenue par
    l'instance (`_memoEnAttente`, un REPLI) puis versée au mémo à la lecture
    suivante. Même garde sur le journal des emails (il se vidait aussi) ;
  · clé = **empreinte du texte entier** (sha256) — l'ancienne clé « sujet + 200
    caractères » reste reconnue comme ALIAS, jamais réécrite : sans elle, le jour
    du déploiement, chaque fil renvoyé re-sonnerait en entier ;
  · `push_subs` se modifie par **écriture conditionnelle** (`modifierSubs` :
    `PATCH …&data->>rev=eq.<lue>`, insertion `ignore-duplicates`, relire et
    recommencer sur conflit) — abonnements simultanés, désinscription, purge
    d'un appareil mort : plus aucun appareil perdu ; un appareil déjà inscrit ne
    réécrit plus la liste. Aucune migration : la première écriture pose `rev`.
  ⚠️ `PATCH` filtré sur `data->>rev` est la grammaire PostgREST documentée,
  **jamais appelée sur la vraie base** (lecture seule).
- **L'app dit quels comptes n'envoient aucun email, depuis quand, avec le
  geste** — UNE règle (`etatEmailsComptes`, bloc `<comptes-sans-email>`) pour
  Réglages → Notifications ET Achats → En attente (§11). « Muet » seulement sur
  **preuve** : ≥ 2 ventes captées (de plus de 3 jours, la plus ancienne de plus
  de 7) sans email de bordereau depuis le dernier signe de vie du compte. Le
  journal compte (`jujuf38` n'est plus « aucun email »), un compte qui n'a rien
  vendu est « calme » (gris), plus aucun rouge (§7), lecture ratée ⇒ personne
  n'est accusé et c'est dit. Le geste : 1) Vinted → Paramètres → Notifications
  (e-mails), 2) la boîte fait suivre — pour une adresse Apple : Réglages → ton
  nom → Connexion et sécurité → Se connecter avec Apple → Vinted → Transférer à.
  Les ventes viennent de la coque (`publierVentesCoque`/`useVentesCoque`).
- **La fuite de l'IA** (`repondreAuxMessages`, à chaque page Vinted, ~255/jour) :
  une hésitation ou une réponse vide n'était mémorisée nulle part et repartait
  chez l'IA à chaque page. **Une question par message** (`panel_msg_repondus.demandes`,
  clé `conversation:message`, 300 au plus) ; une réponse sûre retenue par le
  plafond horaire est **réutilisée** sans repayer ; IA injoignable (rien de
  facturé) ⇒ rien n'est mémorisé. L'app ne liste pas `demandes` comme un envoi.
- **Détourage** : plafond par défaut **100** photos par vendeur et par mois (150 avant).
- Preuves : `notif-messages.cjs` **23 contrôles, 14 rouges** sur 1465387, 5
  mutations rouges ; `audit-repondre.cjs` **49, 7 rouges** sur 1465387, 3
  mutations rouges ; `audit-comptes-sans-email.cjs` **16** (`--prouve` : 11
  rouges) ; banc `comptes-sans-email.cjs` **24 rouges** sur le build de
  1465387, 8 sur un build réaffaibli ; `repondre.cjs` 1 rouge sur l'avant.
  `audit-abonnement.cjs` sert maintenant la forme `return=representation`.
- **Pas fait, à savoir** : les emails d'ACTION de Vinted (« L'acheteur souhaite
  annuler », « Action requise », « Demande de remboursement ») ne sonnent
  toujours pas (relecture n° 1, N2) ; le journal par appareil (qui a reçu) ; la
  notification `new Notification` de l'app (refusée sur iPhone, N4).
- **Le geste de Julien** : sur `angeled92`, `tomj606`, `arthuror2`, vérifier les
  notifications e-mail dans Vinted puis le « Transférer à » d'Apple ; remplacer
  le script Gmail par celui du dépôt (il en tourne un d'avant le 4 octobre).
- ~~Extension : `background.js` touché, version inchangée~~ — **FAUX, corrigé
  par la revue ci-dessous** : ce contenu portait le numéro 5.168.0, déjà publié
  par `main` (PR #472) avec un AUTRE `background.js`. Extension **5.173.0**.

#### Revue du chantier notifications (11 octobre, 5.173) — 17 constats, tous reproduits puis corrigés
Chacun ROUGE sur le code d'avant (9af5943 / 0ae270e / 6f305b3), vert après,
ROUGE sous mutation.
- ⚠️⚠️ **Version** : ce chantier modifiait `background.js` SOUS le numéro 5.168.0
  déjà servi par la production, puis la production est passée en 5.170 sans le
  correctif de l'IA — une extension installée depuis l'une ou l'autre se serait
  dite « à jour ». Fusion d'integ-11oct (vrai merge) et **5.173.0** (5.169/5.171 :
  chantier extension, 5.172 : chantier eBay). `audit-extension-zip` refuse
  désormais qu'une version DÉJÀ servie par `main` change de contenu (il lit
  l'historique de main : rouge sur f3cbac2 et sur ce contenu sous 5.170).
- ⚠️⚠️ **L'ancienne clé anti-doublon AVALAIT les nouveaux messages** d'une paire
  déjà notifiée par l'ancien code (même d'un autre acheteur) : elle n'est un alias
  que si elle couvrait tout le corps (≤ 200 caractères). Au-delà, un fil renvoyé
  le jour du déploiement re-sonne UNE fois — une notification de trop se répare.
- **Une identité PAR EMAIL** : le Message-ID (script Gmail : `getHeader('Message-ID')`,
  repli `getId()` ; Worker : `message.headers.get('Message-ID')`), lu par
  `normaliserEntrant` (`messageId`). Deux messages d'une même conversation au
  corps identique (la forme mesurée) sonnent tous les deux. ⚠️ **Le script Gmail
  et le Worker doivent être recollés** : sans eux, l'empreinte du texte reste le
  repli (et deux corps identiques n'en font qu'un).
- **Préférences illisibles** : relues une fois, puis la dernière lue (instance),
  puis la copie gardée AVEC LES APPAREILS (`push_subs.prefs`, écrite par le
  serveur seulement quand elle change, jamais au détriment de la liste), sinon le
  DÉFAUT. Plus de `SONNE_SI_PAS_SU` : des messages coupés ne sonnent plus sur une
  instance froide. ⚠️ Un vendeur dont les préférences n'ont jamais été lues ET
  sont illisibles ne reçoit pas ses messages (défaut « non ») — « pas su » ne
  vaut pas « oui ».
- `paireDuSujetMessage` : « à propos de » seulement (« concernant » donnait
  « 💬 ta commande »).
- ⚠️⚠️ **La fuite de l'IA n'était pas fermée** : une réponse PAYÉE mais illisible
  (`reason:'parse'` — JSON tronqué, texte libre, vraie réponse vide) était prise
  pour « IA injoignable » et redemandée à chaque page (10 sur 10). `api/ai.js` dit
  `facture: true` après tout 2xx d'Anthropic ; l'extension la range (« illisible »,
  jamais redemandée). L'audit servait une forme que le serveur ne rend pas
  (`{ok:true, suggestions:[{text:'  '}]}`) : il exécute maintenant le VRAI
  `api/ai.js` (§6.3). IA pas branchée / injoignable / illisible : comptée à part
  (`bilan.iaKO` + causes), l'app écrit « l'IA n'a pas répondu (cause) — rien n'est
  parti », plus « elle n'était pas sûre ».
- **Comptes sans email** : on ne juge que les ventes POSTÉRIEURES au début de la
  réception (le plus ancien email lu, tous comptes ; inconnu ⇒ personne n'est
  muet) — un compte dormant ou une nouvelle vendeuse n'est plus accusé.
  « Calme » = aucune vente depuis ce début ; une vente sans email sous le seuil =
  « à surveiller » avec sa phrase ; exclu = « exclu — non vérifié ». Le bloc dit
  l'effet PROUVÉ (« pas de rappel du matin pour leurs colis à poster » :
  `ship-reminders` ne compte que les `email_bord_*`), plus « leurs codes de
  retrait » ; singulier pour un compte ; Réglages déplié ne redit pas le
  résumé ; la table ne redit pas un compte nommé au-dessus ; Achats : une ligne
  repliée (44 px à 390), APRÈS les colis jamais retirés.
- Preuves : `notif-messages.cjs` 37 (10 rouges, 5 mutations) · `audit-repondre`
  65 (14 rouges, 3 mutations) · `repondre.cjs` (2 rouges) ·
  `audit-comptes-sans-email` 26 (10 rouges ; `--prouve=ancienne|debut|calme`
  20/3/6) · `comptes-sans-email.cjs` (29 rouges, 2 mutations d'écran) ·
  `audit-extension-zip` (rouge sur 5.168 et sous mutation 5.170).
- **Non mesurable ici** : le vrai corps d'un email de message (deux messages
  d'une même conversation) — l'identité par Message-ID le contourne, mais ne
  marche qu'une fois le script Gmail / le Worker recollés ; ce que `ship-reminders`
  devrait compter pour les comptes muets (les colis attendus d'après la moisson)
  — dit, pas codé ; la forme réelle d'un 4xx d'Anthropic facturé (aucun appel réel).
- **Gestes de Julien** : installer la **5.173**, recoller `scripts/gmail-forwarder.gs`
  et le Worker de `docs/email-pipeline.md`.


### Messages plus riches : la paire, l'état, qui a écrit, l'heure (19 octobre)
Julien : « les messages plus riches, plus d'informations ». **Mesuré d'abord**
(lecture seule) : la boîte `harvest_{uid}_inbox` ne porte que id · aperçu ·
non lu · date · interlocuteur · 1ʳᵉ photo — aucun identifiant d'annonce. La
conversation captée `harvest_{uid}_conv_{id}` (1 408 lignes) porte la
transaction : `item_id` (924), `status` (926 ; 1 = simple question, 230 payée,
450 finalisée, 5xx annulée…), `current_user_side`, `item_title`,
`item_photo.url` ; ses messages sont chronologiques (le dernier est le plus
récent, 934/934), `entity.user_id` dit qui a écrit (absent sur un message de
Vinted). `offer_price` n'est PAS le prix de la paire (valeurs à 1,70 €) : pas lu.
- **Liste** (`data-messagerie`) : chaque ligne porte, par IDENTITÉ (§5),
  `N° · prix · titre` puis l'état en pastille neutre (« Question », « Vendue ·
  en cours », « Ton achat », « Vente annulée »…). Transaction → vente du même
  n° (son prix) ou annonce captée du même `item_id` (son prix) → N° de CETTE
  annonce (`numeros[item_id]`). Jamais le titre. L'état de `TXN_ETATS` (meta des
  transactions) prime quand il est connu. « Toi : » devant l'aperçu si le
  dernier message est de lui — **seulement** si le résumé capté porte bien le
  dernier message de la boîte (même instant à 2 min près) : sinon rien. Heure
  absolue (« 14:32 », « hier 14:32 », « 12 oct. 14:32 »), date complète en
  infobulle. Attributs : `data-conv-num|prix|etat|auteur|quand|compte`.
- **Fil** : en tête, la carte de la paire (`data-fil-paire|num|prix|etat`,
  photo, titre, lien vers l'annonce) ; messages groupés par jour
  (`data-jour-sep`, « Aujourd'hui », « Hier », « samedi 17 octobre ») ; la bulle
  ne garde que l'heure ; un évènement non affiché n'ouvre pas de jour.
- **Lecture** : `fetchResumesConversations` — scalaires seulement (jamais
  `select=data`), paginée, strict (une page ratée = « pas su » ⇒ rien n'est
  ajouté), au plus une fois par minute, sur Messages seulement. Les annonces sont
  désormais lues aussi sur Messages (cache partagé avec les autres écrans).
- **Leboncoin → Messages** : inchangé — seuls des COMPTEURS de non-lus sont
  captés (aucune conversation), rien de plus à montrer sans deviner.
- Preuves : banc `messagerie.cjs` (+9 contrôles par taille, 390 tactile et
  1512) **16 rouges sur le build d'avant** (1023dd4), 0 après ; mutations
  « garde des 2 min retirée » ⇒ 2 rouges (l'auteur d'un AUTRE message affiché),
  « prix de la vente ignoré » ⇒ 2 rouges. Le banc applique `->-1` comme PostgREST.
- ⚠️ **Non mesuré** : `messages->-1` (dernier élément) dans la projection
  PostgREST de SA base — grammaire attendue, jamais envoyée d'ici ; refusée, la
  lecture repart SANS l'auteur (`_resumeConvSansAuteur`) : pas de « Toi : »,
  le reste s'affiche. Le coût serveur de la lecture (~1 400 lignes décompressées
  pour quelques scalaires) n'est pas mesuré.


### Les offres en attente sur la LISTE des conversations (19 octobre)
Une offre en attente n'apparaissait que dans le fil ouvert. **Mesuré (lecture
seule)** : 1 371 conversations captées, 807 portent au moins une offre, **3**
une offre au statut 10 (en attente) — et l'une d'elles est le 3ᵉ message sur 5 :
`messages->-1` ne la voit pas. La transaction ne la porte pas (`offer_price` =
le prix de l'ANNONCE : 99 € pour une offre à 60 €). Tous les messages pèsent
1,45 Mo. ⇒ `fetchOffresConversations` demande à la base les SEULES
conversations dont un message est une offre au statut 10
(`data->payload->conversation->messages=cs.[{"entity_type":"offer_request_message","entity":{"status":10}}]`,
jsonb @>, condition nécessaire de la règle) : 3 lignes, ~4 Ko, 25 ms en base
(`explain analyze`). Puis **`offreEnAttenteDe`, LA règle du fil (§11)**, sur
leurs messages entiers ; le fil ouvert et chargé prime (plus frais). Lu avec les
résumés (une fois par minute, Messages seulement). Échec ⇒ `null` ⇒ aucune
pastille (on ne garde pas l'ancienne Map : une offre tranchée depuis resterait).
- Ligne : pastille « Offre 45 € en attente » (montant de l'OFFRE) sur la ligne du
  message (sur celle de la paire elle tronquait N° et prix — vu au rendu),
  `data-conv-offre`, `data-offre-liste`. Filtre « Offres N » (`data-filtre-offres`),
  affiché seulement s'il y en a. Aucun geste automatique (§3).
- Preuves : banc `messagerie.cjs` (offre en attente qui n'est pas le dernier
  message ; acceptée 30, refusée 40, « Expirée » au statut 10 ; lecture des
  offres en 500 ; le banc applique `cs.` comme jsonb @>, types compris) —
  **6 rouges sur dd03ffd**, 0 après ; mutation « seconde règle : tout statut 10 »
  ⇒ 6 rouges (l'offre expirée affichée).
- ⚠️ **Non mesuré** : le filtre `cs.` sur un chemin JSON contre SA PostgREST
  (grammaire documentée, jamais envoyée d'ici) ; refusé, la lecture vaut « pas
  su » et rien ne s'affiche. Une capture ancienne garde une offre « en attente »
  que Vinted a peut-être expirée depuis — le fil dit la même chose (même règle).


### Leboncoin : le compte connecté lu sur le compteur de messagerie (20 octobre, 5.195)
Julien : « pour Leboncoin il capte pas les bonnes données ni le bon compte ».
**Mesuré (lecture seule, extension installée 5.194)** : il a DEUX comptes
Leboncoin — un **particulier** (ses 10 annonces de baskets, 3 avec réf VRM) et un
**pro** (`SHOPCANCALE`). Connecté sur le particulier (compteur de messagerie relevé
à 11:16), `lbc_accounts` ne contenait QUE le pro, rangé « particulier », venu de
`linked_accounts` ; « dernier vu » dans la fiche Leboncoin nommait donc le mauvais
compte, Messages Leboncoin affichait « Compte Leboncoin » sans nom pour le vrai,
et ses annonces sans réf VRM n'étaient plus rafraîchies depuis le 20 septembre
(3 d'entre elles, vendues sur Leboncoin, encore « active » en base).
- **Causes (code actuel, pas la version installée)** : `members/me/account` (seule
  source « session » de la 5.186) a la forme `{account:{account_id,type},
  member:{account_id, nickname:{value}, contact:{email}}}` — aucun couple id + nom
  lisible : la session n'a JAMAIS été reconnue, `vrmLbcCompte` jamais posé,
  `myads` jamais rangé sans réf ; `linked_accounts` = les AUTRES comptes liés, et
  `is_business_user` n'était pas lu.
- **La session = le compteur `messaging/proxy/api/hal/{userId}/counter`** (relu par
  la page pour le seul compte connecté — mesuré dans les deux sens). Garde : un id
  présent dans la dernière liste des comptes liés (`vrmLbcLies`, 12 h) n'est jamais
  la session. Nom et type : seulement la fiche `user-card/v2/{id}/infos` dont
  `user_id` = l'id de session, ou une entrée déjà rangée sous cet id. Changer de
  compte efface le nom d'avant (`noterSessionLbc`). Écrit dans `lbc_accounts` avec
  `sessionAt`, au changement, à un nom appris, sinon toutes les 6 h.
- `is_business_user` tranche pro/particulier (`detectLbcAccount`). Les ads de
  `myads` et du tableau pro sont taguées du compte de session ; inconnu ⇒ rien.
- **Une règle des deux côtés (§11)** : un compte à `sessionAt` est à lui
  (`comptesLbcSession`, app + extension), comme un compte prouvé par une vente.
  L'app : la fiche dit « connecté en dernier : X, pro/particulier »
  (`compteLbcConnecte`, jamais le dernier vu), la liste des comptes compte les
  annonces par `account` (elle comptait `lbcUser`, donc 0), Messages nomme le type.
- Preuves : `audit-lbc-session.cjs` (formes réelles, données inventées, le vrai
  `background.js` à état) **8 rouges sur origin/main**, 0 après ; 3 mutations
  (garde des comptes liés, fiche d'un autre id, règle de session des files) ⇒ rouges.
- ⚠️ **Non mesuré / non corrigé** : que le compteur ne soit jamais relevé pour un
  compte lié (mesuré deux fois, pas prouvé) ; `account.account_id` de
  `members/me/account` vs `user_id` (pas lu exprès) ; une bascule de compte dans
  le même onglet où `myads` arrive avant le nouveau compteur taguerait l'ancien
  compte ; les annonces disparues de `myads` restent « active » (pas de jugement
  sur une liste paginée) ; `lbc_ventes` toujours sans date de vente et pas relues
  depuis le 7 octobre ; `lbc_recon.paths` plein (300/300 : les chemins neufs ne
  s'ajoutent plus). ✅ Les quatre : corrigés en 5.198 (section suivante).
- **Geste de Julien** : installer la 5.195, puis ouvrir leboncoin.fr → « Mes
  annonces » sur CHACUN de ses deux comptes, et « Mes transactions » une fois.



### Messages eBay dans Ma journée, et la double vérification proposée au propriétaire (21 octobre)
- **Messages eBay sans réponse** : eBay ne dit pas « lu » ; il dit `MessageStatus`. UNE règle, `messageEbayNonLu` (`api/_lib/ebay-messages-nonlus.js`) — Unanswered sans aucune réponse — lue par eBay → Messages (`data-nonlu`) ET par la route (§11). La route range par compte eBay un résumé `ebay_messages{suffixe}` = `{nonLus, ids, complet, capturedAt}` (aucun nom, aucun texte), sur toute page 1 LUE : l'action `relire` (déjà au plus toutes les ~10 min par compte, `relireEbaySiVieux` — c'est elle qui borne la lecture : +1 `GetMemberMessages` par relecture) et l'ouverture d'eBay → Messages ; une réponse acceptée (`repondre`) sort l'échange du résumé ; eBay illisible ⇒ rien n'est écrit. Fenêtre : 7 jours, comme Vinted ; d'autres pages chez eBay ⇒ « au moins ».
- **Ma journée** (`etatMessagesEbay`) lit ces résumés de TOUS les comptes eBay actifs, en scalaires, **sans aucun appel à eBay**, dans la MÊME lecture que les commandes eBay de Ma journée (un seul rendu : `vitesse.cjs` plafonne Ma journée à 13 rendus au démarrage, mesuré 13/13/11 après, 13/11/13 avant). La case « Messages » = Vinted + eBay (`data-ebay`) et mène à eBay → Messages quand Vinted n'a rien ; une action « N messages eBay sans réponse » nomme les comptes quand il y en a plusieurs et ouvre eBay → Messages (`?tab=ebay_messages`, sur le compte s'il n'y en a qu'un). Résumé illisible ⇒ `data-ebay="passu"` et UNE ligne (`data-ebay-msg-passu`), jamais « 0 » ; aucun résumé rangé ⇒ rien d'eBay. Le premier résumé arrive avec la première relecture après le déploiement (≤ 10 min app ouverte).
- ⚠️ **Leboncoin n'est PAS compté dans Ma journée** (contrairement à ce que dit la demande) : seul l'écran Leboncoin → Messages lit `lbc_messages`. Pas ajouté ici.
- ⚠️ **21 oct. (soir) : l'invitation au démarrage est RETIRÉE** — Julien : « je ne comprends rien ». Le QR ne s'affichait pas (GoTrue rend `data:image/svg+xml;utf-8,<svg…` non encodé : `qrEnSrc` le réencode) ; les explications nomment l'app Mots de passe de l'iPhone. La double vérification reste dans Réglages → Mon compte, sur son geste. Ce qui suit décrit l'ancienne invitation.
- **Double vérification proposée au propriétaire** (`InviteMfaProprio`, rendu par `PorteAbonnement` quand `/api/compte?mode=abonnement` dit `proprietaire: true` — la base, la même source que « gratuit, aucun abonnement ») : sans facteur TOTP vérifié (`mfaLireFacteurs`), un écran au démarrage propose de l'activer avec le panneau de Réglages (`DoubleVerification`, prop `onEtat`). « Plus tard » ⇒ `vrm_mfa_plus_tard_{uid}` sur l'appareil, pas reproposé avant 7 jours. **Aucun blocage** ; facteurs illisibles ⇒ rien ; les autres vendeurs : rien.
- **Captcha (Turnstile)** : toujours ÉTEINT (`TURNSTILE_SITE_KEY` vide), `audit-anti-bot` et banc `captcha` prêts. Ordre des gestes, sans en sauter un : (0) **d'abord l'extension** — sa fenêtre se connecte encore par mot de passe (`background.js`, `grant_type=password`, sans jeton) : retirer ce repli (ou le remplacer par `vrm.center/?lier-extension=<id>`) et publier cette version, sinon la connexion par mot de passe de l'extension sera refusée ; (1) Cloudflare → Turnstile → widget « Managed » pour `vrm.center` ; (2) clé de SITE dans `VITE_TURNSTILE_SITE_KEY` (Vercel, Production), redéployer, vérifier le widget sur vrm.center/?connexion ; (3) seulement ensuite Supabase → Authentication → Attack Protection → CAPTCHA → Turnstile + clé SECRÈTE (jamais dans le dépôt) ; (4) citer Cloudflare dans la politique de confidentialité. Retour arrière : Supabase d'abord, puis vider la clé.
- Preuves : banc `ebay-messages-journee.cjs` (port 8621, 390 tactile + 1512, données inventées) ; banc `mfa-proprio.cjs` (port 8611, faux GoTrue de `double-verification.cjs`) ; `ebay-relecture-cron.cjs` étendu (la vraie route `relire` range le résumé, `repondre` le décrémente, eBay illisible n'écrit rien) ; `audit-ebay-messages-nonlus.cjs` (`--mutation=reponses|fenetre|complet|retire` ⇒ rouges).
- ⚠️ **Non mesuré** : la forme réelle de `GetMemberMessages` sur ses comptes (doc d'eBay) ; le coût en quota d'un `GetMemberMessages` de plus par relecture.


### Colis à retirer : la vraie date d'arrivée, la notification du code lu par l'extension, et les colis à confirmer (21 octobre, 5.204)
- **Mesuré d'abord (lecture seule)** : `created_at_ts` d'un message de conversation est un ISO avec décalage (« 2026-10-13T10:08:35+02:00 »). « Confirmation nécessaire » (`event_type: delivered`, actions `all_is_good` « Tout est OK » / `i_have_issues`, `interpolation_values.subtitle.return_shipment_date` = « 21 sept. 15:59 », sans année) n'existe que dans **2 conversations, toutes deux côté VENDEUR, `event_group: return_shipment`** : c'est un **RETOUR** qui lui revient (ventes 440), pas un achat. ⚠️ La note du 20 octobre (« current_user_side vaut seller sur des achats ») était fausse : ces conversations sont des VENTES (vérifié par transaction dans `orders_sold`). Côté acheteur (13 achats captés), aucun message de confirmation — « Livrée » puis « Profite de ta commande ! ». La règle est posée sur la FORME (l'action `all_is_good`) : un achat qui la porterait un jour est pris (`quoi: 'achat'`).
- **Date d'arrivée** : `retraitDeConversation` range `arriveLe` = l'heure du PREMIER message d'arrivée (`msDeTsMessage` : ISO, secondes ou ms ; illisible ou absurde ⇒ rien) ; `noterRetrait` garde la plus ancienne. L'app l'affichait déjà comme date sûre (`arriveeColisVinted`) : rien à changer côté app.
- **Notification « 📍 Colis à retirer »** : un CODE NEUF rangé par l'extension (et lui seul — pas un lieu sans code, pas le même code relu) part en file `vrmRetraitNotifs` (`chrome.storage.local`) puis `POST /api/push {action:'retrait', tx}` avec la session VRM (rien d'autre : ni code, ni lieu). `api/push.js` (toujours 12 fonctions) appelle `notifierRetraitConversation` (`api/email-inbound.js`) qui relit `panel_colis_relais` AU NOM du vendeur ; sans code ⇒ rien ; rangée il y a plus de 72 h ⇒ rien ; illisible ⇒ 503 (l'extension renvoie, 24 h au plus) ; catégorie `colis`, abonnement, comme l'email. **Anti-doublon** : `relais-{suivi}-code` si la conversation porte un suivi, sinon `relais-tx{tx}-code`, ET `retrait-code-{CODE}` (`cleCodeRetrait`) — écrite aussi par la voie email (`shouldNotify(key, aussi)`) : le **code de retrait est la seule identité commune** email ↔ conversation (§5). Un email SANS code puis la conversation AVEC code sonne deux fois (comme email sans code puis email avec code).
- **À confirmer avant la date limite** : `confirmationDeConversation` (en attente seulement si la DERNIÈRE action est « Tout est OK » ; une action plus récente ⇒ réglée, l'entrée sort), `limiteDeConfirmation` (année du message ou la suivante, seulement si la limite tombe entre la veille du message et 30 jours après, heure de Paris ; sinon `limiteMs: null`, « pas su »). Ligne dédiée `panel_a_confirmer` (par transaction, lire-fusionner-réécrire GARDÉ, purge à 7 j après la limite / 30 j). Lu en passant (conversation captée) et par `capterConfirmations` à chaque visite : achats « Commande livrée » `needs_action` et ventes « Retour… » non finalisées, 3 par visite, 6 h, `gardeLecture` colis (hors réserve de lecture), file Vinted, la conversation doit porter SA transaction. App (`src/aConfirmer.js`, une règle) : Achats « N retours/achats à confirmer avant le … » (`data-a-confirmer`, lien vers chaque conversation, compte nommé une fois s'il est le même), Ma journée `data-job="a-confirmer"` ; illisible ⇒ Achats « pas pu lire », Ma journée se tait ; délai passé ou sans année lue depuis plus de 3 jours ⇒ écarté ; sans année lue, le texte de Vinted est recopié tel quel. `EXT_CAPACITES.confirmer` / `.retraitnotif` = 5.204.0 (dites dans « ce qui manque » à une extension en retard).
- Preuves : `audit-retrait-confirmer.cjs` (vrai `background.js`, 33 contrôles ; **12 rouges sur origin/main** ; mutations `date-du-dernier-message`, `sonne-a-chaque-changement`, `lecture-ratee-lue-vide`, `annee-devinee` ⇒ rouges) ; banc `retrait-conv-push.cjs` (vraies routes `push` + `email-inbound`, 15 contrôles ; **9 rouges sur origin/main** ; « email sans clé du code » ⇒ 2 rouges) ; banc `a-confirmer.cjs` (port `BANC_PORT`, 390 tactile + 1512, trois états ; **rouge sur le build d'origin/main** ; mutation « illisible lu vide » ⇒ rouge). `_fond-vm.cjs` fournit `AbortController`.
- ⚠️ **Non mesuré** : la forme d'un « Confirmation nécessaire » côté ACHETEUR (jamais vu) ; une conversation dont `conversation_id` est un UUID (`orders_*` récents) est-elle lue par `/api/v2/conversations/{uuid}` ? (c'est déjà le cas de `capterRetraits`) ; un vrai push depuis l'extension. Le retour qui revient au point relais côté VENDEUR (« Rends-toi au point relais … », statut 440) n'est toujours pas proposé au retrait (`retraitDeConversation` écarte le côté vendeur) — à trancher.
- **Geste de Julien** : installer la 5.204 (remplacer le dossier, puis ⟳ dans chaque Chrome).


### Les trois boutons (29 octobre) — `src/styles-boutons.css`, composant `Bouton`
Julien : « ça fait encore de faible qualité, améliore les boutons, arrête les
messages écrits dans tous les sens ». TROIS formes, et seulement trois :
- **`.vrm-b-primaire`** — fond `--vrm-accent`, texte `--vrm-on-accent` (#fff clair,
  #173A40 sombre : l'accent sombre est une menthe claire, un texte blanc y était
  illisible — vu sur « Tout imprimer »). **UN par écran** : l'action principale,
  en haut à droite (slot `right` de `ScreenHead`) sur ordinateur, dans
  `.vrm-b-barre` (fixe au-dessus de la barre du bas) sur téléphone.
- **`.vrm-b-secondaire`** — fond teinté (accent ~8 %, `--vrm-b-teinte`), texte
  encre, **aucune bordure**, rayon 10, 40 px souris / 44 px doigt.
- **`.vrm-b-discret`** — texte seul couleur d'accent (`--vrm-b-lien`), zone 44 px.
  « Annuler » d'une feuille est TOUJOURS discret, son geste principal primaire.
- Classe de base `.vrm-b` (+ `.vrm-b-plein`, `.vrm-b-icone`, `.vrm-b-court` pour
  revenir à la ligne), rangée de gestes `.vrm-b-rangee` (à droite sur ordinateur,
  pleine largeur en bas de carte sur téléphone). En React :
  `<Bouton variante="primaire|secondaire|discret" icone="…" plein href=…>` (à côté
  de `Segmente`) ; tout le reste (`data-*`, `title`, `disabled`, `style`) passe.
- **Normalisation globale** (même fichier, section 2) : un `<button>`/`<a>` SANS
  classe dont le style en ligne porte la bordure `C.border`, le fond `C.card2` ou
  un contour accent prend l'apparence secondaire ; un fond `C.accent` prend le
  rayon et le texte « sur accent ». Exclus : `aria-pressed|selected|checked|current`,
  `role`, carte-bouton (`text-align: left`, ombre, contenu `div`/`img`), pastille
  arrondie, navigation, `.vrm-seg`, `.vrm-filtres`, `.vrm-rangee`. ⚠️ Un style en
  ligne qui change de couleur de bordure sort de la règle : utiliser `Bouton`.
- Un geste rare va dans « ⋯ » ; deux boutons qui font la même chose, c'est un de
  trop ; un bouton grisé garde sa raison (`title` ou une ligne) et n'est jamais
  caché ; pas de rouge (sauf le doublon de N°), pas de vert en dur.
- **L'action principale d'un écran** : `<ScreenHead … principal={<Bouton
  variante="primaire">…</Bouton>}>` — en haut à droite sur ordinateur, barre fixe
  au-dessus de la navigation du bas sur téléphone (`.vrm-b-principal`, la page
  garde 64 px dessous). Jamais deux primaires sur un écran.
- **L'ancien `Btn`** passe par les mêmes formes : plein + accent (ou sans couleur)
  ⇒ primaire, tout le reste (`outline`, `color={C.border}`, `danger`) ⇒ secondaire,
  `small` ⇒ `.vrm-b-petit` (34 px souris, 44 doigt). Il transmet désormais
  `title`/`aria-*`. (Avant : `color={C.border}` = texte BLANC sur gris clair.)
- `--vrm-on-accent` vient du thème (`variablesTheme`, `t.onAccent`) : #FFF en
  clair, #173A40 en sombre (l'accent sombre est clair).
- ⚠️ **Spécificité** : sur téléphone `styles-epure.css`/`styles-iphone.css` visent
  les `<button>` par leur style en ligne à (0,3,1) + `!important`. Chaque règle
  `.vrm-b-*` est doublée sous `.vrm-app-shell .vrm-main .vrm-b.vrm-b…` (0,4,0) ;
  une règle ajoutée ici doit suivre ce motif. `min-height` n'est PAS `!important`
  (un `style={{minHeight:44}}` en ligne doit gagner — banc `republier`, les choix
  de couleur à 44 px).
- **Un parcours en plusieurs étapes** (republier, publier, générer en lot, saisie
  en série) : `<Avancement titre="Paire 2 sur 5" phrase="…" part={0.4}
  compte={compteAvancement({faites, ratees, restent})} erreur="…">` — UNE barre,
  où j'en suis en mots, ce qui se passe, combien, ce qui a raté (en ambre). Posé
  EN HAUT du parcours. Premier appliqué : le total de Republier (il remplace la
  barre d'ensemble sous la liste ET la ligne de bilan ; `data-republier-total`,
  `data-republier-bilan`, `data-republier-prochaine` gardés).


### Messages : une offre en attente passe devant (19 octobre)
Dans la liste des conversations, après le compte ouvert dans Chrome, une conversation dont l'offre attend une réponse (`offreDeConv`, la même règle que la pastille et le fil) passe devant les plus récentes : elle expire, et y répondre décide d'une vente. Banc `messagerie.cjs` : ordre attendu `301` (offre) avant `303` (plus récente) — rouge sur l'ancien tri par date seule.


### Offres reçues par email rebranchées, et l'adresse de réception PROUVÉE (22 octobre)
Deux chantiers restés ouverts, repris le 22 octobre (branche `v22-adresse`).

**A. Les offres reçues par email.** **Mesuré** (lecture seule, sa base) :
**248 offres `email_offer_*` en 14 jours** (17 le dernier jour, 5 comptes) ; dans
les conversations captées, **3 offres en attente en tout**, la plus récente du
15 septembre, **0 en 14 jours**. Or la règle `offresAtraiter` n'était plus
**rendue nulle part** depuis le 13 octobre (bloc de Messages retiré, cloche
retirée le 17) : ses offres ne s'affichaient plus du tout.
- **Décidé** : rebrancher, pas retirer. UN bloc « N offres à trancher » en tête
  de Messages (`data-offres-messages`), sur `offresAtraiter` (compte,
  chronologie, titre non ambigu) ; lecture des 14 derniers jours en scalaires
  `meta->>` (`lireTout(…, {strict:true})` : une page ratée vaut « pas su ») ;
  « c'est fait » → `vinted_offers_done` (synchronisé, rattrapé par
  `onCloudReady`), clé = l'identifiant de la ligne ; ⚠️ les 88 clés d'avant
  (`receivedAt|article`) restent reconnues.
- **Une offre vue par email ET dans sa conversation n'est écrite qu'une fois**
  (`memeOffre` / `offresEmailHorsConversations`) : même compte, même acheteur
  (login, sans la casse), même montant au centime, dans la tolérance de
  classement ; le titre (celui de la TRANSACTION, `OFFRES_CONV_SELECT`) n'est
  qu'une contrainte EN PLUS. ⚠️ **Mesuré : `qui` est vide sur 248/248 offres** —
  la règle ne fusionne donc rien aujourd'hui, et c'est voulu : sans acheteur,
  rien ne prouve que c'est la même (§5, mieux vaut une ligne de trop qu'une
  offre cachée). Conversations illisibles ⇒ rien n'est retiré.
- **Prouvé** : `audit-offres-email.cjs` (22 contrôles) **9 rouges sur
  d198bca** ; mutations `sansqui` 4 et `titreseul` 11 rouges. Bancs
  `messagerie.cjs` (**6 rouges** sur le build de d198bca) et `filtre-compte.cjs`
  (**1 rouge**) — tous verts après.

**B. L'adresse de réception PROUVÉE** (le ⛔ « bloquant avant d'ouvrir VRM à des
inconnus » du 6 octobre). **Mesuré** : `vrm_email_owners` = **une seule ligne,
celle de Julien, 16 adresses** (11 icloud.com, 3 gmail.com, **2 relais Apple**
`privaterelay.appleid.com`), aucun autre vendeur ; 0 email en quarantaine
vivante ; aucun passage du collecteur partagé enregistré.
- **Décidé — la preuve** (`api/_lib/preuve-adresse.js`, une règle §11) : un lien
  part **à l'adresse déclarée**, par la boîte Gmail de VRM (le script
  `gmail-forwarder.gs`, même canal que les factures Pro — aucun SMTP ici) ; le
  clic, **depuis la session du vendeur qui l'a demandé**, range la preuve **côté
  serveur**, sous le propriétaire NEUTRE (aucune session ne peut l'écrire ni la
  lire). Le lien est un HMAC (clé dérivée de la clé de service) sur la ligne et
  un aléa : lire la base ne suffit pas à le fabriquer ; un autre compte qui
  l'ouvre ne trouve rien (404, sans dire qu'une demande existe) ; 72 h ; un
  renvoi toutes les 10 min, 5 par adresse et 10 adresses par vendeur et par
  jour ; confirmation par écriture CONDITIONNELLE (même aléa, encore en
  attente). Seconde preuve, sans email : l'adresse est l'adresse de connexion
  VRM du vendeur, confirmée **par un lien** par Supabase. Un relais Apple ne
  reçoit que les emails de Vinted : « impossible », dit tel quel.
- **Décidé — l'attribution** : base cloisonnée, `fusionnerRegistres` ne retient
  une adresse déclarée que si elle est **prouvée pour CE vendeur** ; sinon
  l'email part en quarantaine (jamais donné), et `peutReclamer` le rend dès la
  preuve. Base non cloisonnée : inchangé. Preuves illisibles ⇒ 503 (« renvoie-le »).
- ⚠️ **Décidé — la transition, et pourquoi sans date** : le **propriétaire de
  l'installation** garde ses adresses déclarées, prouvées ou non (« à
  confirmer »). Ses 16 adresses restent reçues, ses 2 relais Apple ne pourraient
  jamais être prouvés, et l'exiger de lui ne protège personne (il a la clé de
  service). Une date de fin aurait été un piège à retardement. Une adresse qu'il
  partage avec un vendeur qui l'a PROUVÉE ne désigne personne (conflit →
  quarantaine, la règle existante).
- Routes : `email-rattacher` (`GET preuves`, `POST preuve-demander`,
  `POST preuve-confirmer`, session exigée) ; `email-inbound` (modes script
  `preuves-a-envoyer` / `preuve-envoyee`, derrière la clé ; un lien de
  confirmation transféré dans un email entrant est retiré avant d'être rangé).
  **Toujours 12 fonctions.** Le script n'aspire plus ses propres envois
  (`-in:sent`).
- App : Réglages → Mes adresses de réception dit l'état de chaque adresse
  (prouvée · à confirmer · lien envoyé · lien périmé · impossible), « Renvoyer »
  / « Confirmer » (adresse de connexion), l'explication UNE fois au-dessus
  (§7) ; une adresse ajoutée demande son lien d'elle-même ; au retour du lien
  (`?confirmer-adresse=`), un bandeau dit le résultat et mène au panneau.
- **Prouvé** : `audit-preuve-adresse.cjs` exécute les vraies routes contre une
  base à état — **40 contrôles, 22 rouges sur 28 sur d198bca** ; mutations
  `sansgarde` 6, `autrecompte` 3, `jetonignore` 2, `pasSu` 3 rouges. Banc
  `adresses-preuve.cjs` (port `BANC_PORT`, données inventées, 390 et 1512 px) :
  **45 contrôles, 31 rouges** sur le build de d198bca. Les bancs et tests
  existants (`audit-proprietaire-email` 61, `audit-email-rattacher` 48,
  `capacite-securite`, `emails-mis-de-cote` 52, `double-vente-push` 28) servent
  désormais un monde PROUVÉ — sans quoi le second vendeur de leurs scénarios
  part, à raison, en quarantaine (deux contrôles ajoutés, aucun retiré).
- ⚠️ **Non mesuré** : aucun email n'est réellement parti (Apps Script non
  exécuté d'ici ; quota d'envoi Gmail non mesuré) ; le refus réel d'un relais
  Apple ; les filtres `data->>etat=eq.attente&data->>nonce=eq.…` sur la vraie
  base (forme PostgREST seulement). **Vu au passage, laissé tel quel** :
  `sendQueuedInvoices` du script teste la constante `SECRET` au lieu de
  `secretVRM()` ; `reglages-premium.cjs` rouge sur `main` (champ photo de
  profil 230×18 à 390 px), sans lien avec ce chantier.
- **Geste de Julien** : recoller `scripts/gmail-forwarder.gs` dans la boîte qui
  fait tourner le script (clé `EMAIL_INBOUND_SECRET` dans ses propriétés) — sans
  ça aucun lien ne part, et seule l'adresse de connexion d'un vendeur peut être
  prouvée. Pour lui, rien d'autre : ses adresses restent reçues ; « Confirmer »
  est facultatif.
#### Revue du 22 octobre (soir) — six défauts reproduits, six corrigés
Chacun REPRODUIT d'abord (vraies routes `email-rattacher` + `email-inbound` dans
une base à état ; rendu du build), rouge sur 9845685 (copie `git archive`,
contrôle lancé depuis elle, §6.1), vert après, rouge sous mutation.
- ⚠️⚠️ **Le frein « 10 adresses par jour » cédait à des demandes simultanées**
  (30 en parallèle : 30 rangées, 30 emails pour UN compte) et rien ne plafonnait
  la boîte VRM (10 × 5 renvois = 50 liens/jour par compte gratuit, sur le quota
  Gmail des factures Pro). ⇒ Les freins du vendeur se RÉSERVENT avant d'écrire la
  demande, par comparer-et-échanger sur sa ligne compteur neutre
  (`vrm_email_preuve_compteur_<empreinte>`, `data->>rev`, `api/_lib/neutre-cas.js`,
  même motif que `modifierDonnee`) : 10 adresses ET **15 demandes** (renvois
  compris) par 24 h glissantes (`reserverDemande`). **Plafond de toute
  l'installation : 40 liens par jour** (`vrm_liens_adresse_jour`, réservé dans
  `preuves-a-envoyer` avant de rendre les liens ; illisible ⇒ 503, rien ne part ;
  au-delà, `plafond: true`). Le script envoie **les factures AVANT les liens**.
- **Des demandes périmées bloquaient la file** (`limit=20` avant le filtre
  d'expiration). ⇒ La base filtre : `expire` > maintenant (un ISO se compare
  comme un texte), pas abandonnée, plus ancienne demande d'abord
  (`order=data->>demandeLe.asc`). Une adresse que GmailApp refuse : le script
  appelle `preuve-echec` et s'arrête (souvent le quota) ; au 3ᵉ échec la demande
  sort de la file (`abandonLe`), l'écran dit « la boîte VRM n'a pas pu envoyer le
  lien » (état `echec`) avec « Renvoyer » (une demande neuve).
- **« Fermer mon compte » laissait ses preuves d'adresse** (son identifiant +
  l'adresse, sous le neutre). ⇒ Effacées AVANT ses données
  (`id=like.vrm_email_preuve_*&data->>owner=eq.<lui>` : prouvées, en attente,
  compteur) ; illisible ⇒ 503, rien d'autre n'est effacé, compte gardé, dit.
- **Le propriétaire voyait « reçue — à confirmer » + « Confirmer » pour
  toujours** (la route rendait « transition » avant l'état de sa demande). ⇒ Une
  demande en cours prime (« lien en préparation », « lien envoyé », « lien
  expiré »), et ce qui est RETENU est une autre question (`adresseRetenue` :
  prouvée, ou propriétaire de l'installation) ; la route rend `retenue` par
  adresse, et une ligne retenue n'est jamais en couleur d'alerte.
- **L'explication promettait « proposés dès que tu l'ajoutes »** à un vendeur
  (faux depuis la preuve) — en tête du panneau et dans « ajouter ces
  adresses ». ⇒ Elle suit l'état lu (`data-adresses-promesse` : `confirmation`
  pour un vendeur · `directe` pour le propriétaire ou une seule boutique ·
  `passu` : « rien n'est perdu », aucune promesse).
- **« Répondre sur Vinted » (offre par email) faisait 26 px au doigt** : 44 px
  (`styles-iphone.css`, la règle des liens à 44 px depuis le zoom 1).
- **Prouvé** : `audit-preuve-adresse.cjs` **56 contrôles**, **11 rouges sur
  9845685** (parallèle 30 rangées, série 20 acceptées, 60 envois, file bloquée,
  pas d'échec, propriétaire « transition », factures après les liens…) ; les 30
  lectures du compteur sont TENUES ensemble par le banc (une requête tenue, jamais
  un délai : sans elle l'ordonnancement les rendait séquentielles et la mutation
  « sans condition » restait verte) ; mutations `sanscas`, `sansplafond`,
  `perimees`, `abandon`, `installation` (et les 4 d'avant) : toutes rouges.
  `audit-fermer-compte.cjs` **35** (la fausse base honore enfin `id=in.`,
  `id=like.`, `data->>x=eq.` sur un DELETE) : **3 rouges** sur 9845685, 2 sous la
  mutation « sans filtre de vendeur ». Banc `adresses-preuve.cjs` **54** :
  **6 rouges** sur le build de 9845685, 2 sous la mutation « promesse figée » ;
  `messagerie.cjs` : **1 rouge** (26 px) sur le build de 9845685, rouge sans la
  règle CSS. ⚠️ Lancés depuis un worktree dont `node_modules` est un LIEN vers
  un autre, les bancs qui visent `/home/user/cancale-v67/node_modules/playwright`
  ne reçoivent pas le crochet `_porte-banc.cjs` (il patche le playwright de SON
  dossier) : `messagerie.cjs` restait sur l'écran de connexion. Le crochet a été
  posé à la main sur ce chemin (`node -r`), l'app n'y est pour rien. Après :
  les 143 audits verts (`audit-renum-b` sauté), `capacite-securite` 8/8, bancs
  `emails-mis-de-cote` 52 et `double-vente-push` 28 verts. ⚠️ Les scripts de
  reproduction du relecteur ne savent plus juger ce code : leur fausse base
  upserte toute insertion (pas de 409), ignore `gt.` (400) et compte la ligne
  compteur (même préfixe) comme une demande — §6.3 ; `audit-preuve-adresse`
  rejoue leurs trois scénarios sur la forme réelle.
- ⚠️ **Non mesuré** : le comparer-et-échanger sur la vraie PostgREST (`data->>rev=eq.N`,
  409 sur une insertion en double — formes de `modifierDonnee`, jamais envoyées
  d'ici) ; `order=data->>demandeLe.asc` et `data->>expire=gt.` sur sa base ; le
  quota réel de la boîte (40 liens/jour est une borne prudente, pas une mesure).
  ⚠️ Le relecteur avait lu « aucune ligne `vrm_email_collecteur_*` » : la boîte
  qui envoie n'a jamais tourné — **recoller le script reste LE geste**.

### Retrait « pour de bon » par catégorie : annonces + messages (26 octobre, PR #735)
Julien : « le retrait définitif par catégorie, ça peut être que les annonces par
exemple et pas les ventes ; et la possibilité dans les paramètres de les
réactiver ». Le « pour de bon » (survit à une recapture) existait pour les
**annonces seules** (`vrm_annonces_retirees`, filtre à la lecture) ; il devient
un CHOIX par catégorie dans la fenêtre « Supprimer des données… ».
- **Annonces + Messages uniquement.** Mesuré avant de coder : les messages ne
  nourrissent AUCUN chiffre, les cacher pour de bon ne fausse rien ; les **ventes**
  (compta/URSSAF/CA) et les **achats** (repère de prix d'achat par modèle) si — on
  ne les propose donc PAS. C'est le « pas les ventes » demandé.
- `vrm_messages_retires` = { [uid]: { at, login } } (SYNC_KEYS, posée sur son
  clic, rattrapée par `onCloudReady`), miroir exact de `vrm_annonces_retirees`.
  `messagesRetires()` rend un Set d'uid ; illisible ⇒ Set vide, rien n'est caché
  (« pas su » ne cache rien).
- Filtre aux **trois portes** de lecture des conversations (comme les deux
  d'annonces) : `loadConvs` (la liste ET tous ses compteurs — nonLus,
  nonLusAilleurs, la tuile « Messages » du tableau de bord ligne ~38180 — et
  « boîte pas lue » : un compte retiré n'y apparaît pas non plus), plus
  `fetchResumesConversations` et `fetchOffresConversations` (skip par uid du `id`).
  Le chemin CACHÉ de `loadConvs` filtre aussi (sinon il resservait l'ancienne liste).
- Réactivation « dans les paramètres » : puce « Messages retirés · Les remettre »
  sur la carte du compte (Réglages → Comptes liés), comme pour les annonces. La
  modale offre un bloc « Pour de bon » à deux boutons (Annonces `data-retirer-annonces`,
  Messages `data-retirer-messages`), chacun bascule retirer/remettre.
- Preuves : banc `annonces-retirees.cjs` étendu (conversations inventées via
  `harvest_{uid}_inbox` → `data.payload.conversations`). §6.1 : **3 rouges** sur le
  code d'avant (la conversation du compte retiré restait sur Messages, le compteur
  voyait 2, `[data-retirer-messages]` n'existait pas), 0 après. Audits
  tdz/variables/coherence/chiffres/bancs verts, banc messagerie vert.
- ⚠️ **Le cas qui coûte, évité** : `fetchHarvestBrut` rend `data.payload` pour
  l'inbox (pas `data`) — ma première fixture n'avait pas le niveau `payload`, le
  banc ne voyait aucune conversation. Un banc qui ne sert pas la bonne forme
  mesure une fiction (§6.3).


### Vérification du `main` déployé (26 octobre, après #735/#738/#737/#739)
Plusieurs sessions mergent en parallèle (eBay multi-sites #737, fiabilité messages
#739). Contrôle de non-régression sur `main` (`526d61b`) : `npm run build` vert ;
**163 audits verts** (le seul non-vert au premier passage était `audit-renum-b` en
TIMEOUT sous charge séquentielle — relancé seul : 126 verts, 0 rouge) ; bancs de
rendu à données inventées `messagerie` et `ebay-comptes` verts. ⚠️ `verif_visuel`
(et les autres bancs `fx/`) n'est PAS exécutable dans ce conteneur : les fixtures
ne montent jamais dans le dépôt public — ce n'est pas une régression.
Prod : `vrm.center/api/sante` 200 (`serviceKey:true · owner:true`), build servi
daté du dernier merge — `main` en ligne et sain. ⚠️ vrm.center était joignable
DEPUIS ce conteneur cette fois (curl 200), alors que §8 le disait bloqué : la
connexion Vercel de la session, elle, ne voyait pas l'équipe du projet (404 sur
`list_deployments`/`web_fetch_vercel_url`) — vérifier d'abord par `curl` l'endpoint
public `/api/sante`, sans supposer l'un ou l'autre.


> **31 octobre — Vestiaire : lire et répondre (5.295.0)** : conversations en clair
> (`vc_fil_{conv}`, texte + date + « de toi », jamais un nom), réponse sur SON clic depuis
> VRM → Vestiaire → Messages, par l'onglet vestiairecollective.com, avec une recette
> APPRISE de son propre envoi (rien à l'aveugle), plafond 50/h, pause sur 429/403. Favoris :
> un NOMBRE par annonce ; « écrire aux favoris » pas construit (qui : jamais vu). Détail :
> `historique-vestiaire.md` (31 octobre).
