# État détaillé — 31 octobre au 2 novembre 2026

Déplacé TEL QUEL depuis CLAUDE.md §9 le 2 novembre 2026 (le fichier dépassait 70 Ko ; CLAUDE.md garde une ligne par chantier). Rien n'a été réécrit.

- **1er nov.** — **Audit des parcours, A5-A14** : notification double vente Leboncoin sur la ligne de SON N° (`data-lbc-retirer-num`, aucun repli), « Vendus ailleurs » par `cleNum` (lots éclatés), offre email sans « Accepte : +X € net » tiré d'un titre, widget « Reçu ce mois » re-daté par une lecture (0 € le 1er), « Déclarer perdue » sans « numéro libéré » ni « perte en compta », Leboncoin daté à la main hors « 12 h », « …a échoué » = pas une vente partout, pas de « toujours disponible » sous une annonce partie, `vinted_sales_hidden` plus lue ; 9 audits rouges remis à l'écriture actuelle. `audit-flux-divers.cjs` (26 rouges avant, 17/17 mutations), banc `lbc-supprimer` § notification. → historique divers (« audit des parcours métier »). Reste : « Échec du paiement » et `failed` à aligner à la prochaine extension. Geste : aucun.
- **1er nov.** — **VRM vendu à d'autres : les 19 défauts de l'audit « un autre vendeur »**. Code de validation Gmail rendu au vendeur qui a PROUVÉ l'adresse source (`api/_lib/transfert-gmail.js`, signature Google exigée, sinon quarantaine). Factures Pro en file pour le propriétaire seul (brouillon pour les autres, et c'est dit). Relais Apple : la raison, le geste et « Essayer quand même ». Consignes d'administrateur pour le propriétaire seul (`useEstProprietaire`). `/api/ai` « prête » pour lui seul. Textes neutres, avec `audit-vendeur-neutre.cjs`. Colis/Ventes/eBay/pastille/porte d'essai/accueil pour un vendeur neuf. Widget paginé. → historique sécurité-base-serveur (« VRM vendu à d'autres »). Geste : **recoller `scripts/gmail-forwarder.gs`** (+ `EMAIL_INBOUND_SECRET`).
- **1er nov.** — **Vestiaire partout** (audit des parcours A1, A2, A4, A6, A10 ; « aucune erreur possible ») : une vente Vestiaire fait « déjà vendue » sa paire PAR IDENTITÉ (lien VRM ou référence VRM-n°, jamais le titre ; sans identité ⇒ nommée) — « à retirer » sur Vinted, Leboncoin, eBay (écrans, cloche, « Vendus ailleurs »), sortie du Stock ; une vente ailleurs dit « à retirer de Vestiaire » (app et serveur, annonce prouvée en ligne < 24 h) ; Vestiaire entre dans vendu/CA/URSSAF/bénéfice/seuils SI son montant est sûr (clé « versé », euros, `montantRecuVc`), sinon NOMMÉ partout (« au moins », `nonComptees` publié) ; une vente Vinted au prix illisible n'est plus 0 € (mise à part, dite) ; colis Leboncoin et Vestiaire comptés dans Ma journée, la cloche, le widget, les rappels (une règle : `api/_lib/colis-sites.js`, `api/_lib/vestiaire-regle.js`) ; « Vendus ailleurs » compare par `cleNum`. Audit `audit-vestiaire-partout` (22 rouges sur l'avant, 9/9 mutations), bancs `colis-tous-sites` (9 rouges avant) et `vestiaire-bout-en-bout` §E (4 rouges avant : Colis 1, cloche 0). Extension inchangée. → historique vestiaire (« Vestiaire partout »). Geste : aucun — tant que Vestiaire n'écrit pas ce qu'il verse, ses ventes sont dites « non comptées » à côté de chaque total.
- **1er nov.** — **Données sûres** (audit « conditions difficiles », points 1, 2, 4, 5, 8) : la ligne `main` ne se réécrit plus en entier — fusion à trois voies clé par clé (`src/fusionNuage.js`, numéros : union du pool, REFUS + « Recharger » si la fusion créerait un doublon ou renumérote) et PATCH conditionnel sur `data.rev` (une relecture ratée n'écrit rien), relue au premier plan / toutes les 60 s / à l'évènement `storage`, écrans réveillés (`useStateCle`), sauvegarde fusionnée (`fusionALaSauvegarde`) ; `lireTout` : une page ratée = `null` toujours, 416 à la frontière ; bordereaux, suivis, ventes, reçus, factures email et labels captés paginés ; purge d'un compte au préfixe EXACT et paginée (`lireLignesDuCompte`) ; widget : jamais `online: 0` sur une panne. Bancs `deux-appareils`, `gros-volumes`, audits `audit-fusion-nuage`, `audit-purge-compte`. → historique sécurité-base-serveur (« Données sûres »). Geste : aucun (extension inchangée).
- **1er nov.** — **Audit des actions X1-X9** (extension **5.307.0**) : deux paires au même TITRE sous un N° sont ROUGES (dispense seulement la vente dont l'identité EST l'annonce ; doublons réglés seuls sans deviner) ; impression : une paire republiée (`recreeDe`) n'est plus « deux paires » ; Stock : une case occupée DEMANDE ; favoris : offre refusée/prix illisible ⇒ pas de message, 2-3 écritures réservées sous la réserve de 5 avant la conversation ; Leboncoin Supprimer/Pause relisent par clé entre guillemets (fausse base = PostgREST) ; Republier : places rendues exactes, verrou après suppression incertaine, quota du jour et verrou aussi en base (tous les Chrome). ⏳ plafond 50/h encore par Chrome (à décider). → historiques numéros, favoris-messages, leboncoin, vinted-extension (« 1er novembre — Audit des actions »). Geste : installer la 5.307.0.
- **1er nov.** — **Ma journée sans redite** (« je trouve cet endroit très répétitif ») : cases en 2 × 2 au téléphone, libellés entiers ; « À envoyer » porte « dont N aujourd'hui » et le bouton « Emballer » (plus de lignes « colis pressés » ni « Emballer les colis prêts » à côté de la case ; un colis en retard reste en Urgent) ; « À retirer » porte « + N à vérifier » (« + », pas « dont » : non comptés) et UNE ligne « Colis à vérifier » (délais dépassés · pas encore reliés) ; détail d'une ligne au téléphone aussi, phrase longue en infobulle ; URSSAF court (un seul montant) ; Stock sans « 0 sur 6 · 6 à compléter ». Aucune règle de calcul changée. Banc `journee-mieux` I/J/K (67 rouges avant). → historique interface-stock (« Ma journée sans redite »). Geste : regarder Ma journée au téléphone.
- **1er nov.** — **Capture Vestiaire/Leboncoin auditée** (extension **5.299.0**) : Vestiaire — une réponse d'erreur ou au format inconnu n'est plus « lue, vide » (ni fraîcheur ni liste vidée, `formeInconnue`), XHR json lue, compte d'une capture = page ET onglet d'accord (`compteVcCapture` : changer de compte dans l'onglet n'efface plus les annonces de l'autre ; répondre refusé si la page n'est pas sur le bon compte), liste en plusieurs pages entière (`lotComplet`) + « plus vue depuis … — à confirmer » dans l'app, fiche au plus près (titre ≠ marque, photo ≠ avatar), émoji jamais coupé en deux (jsonb refusait la ligne), non-lus par compte (`compteurs`) ; Leboncoin — `storeLbcMessages` en file (compteur et comptes liés ne s'effacent plus). Et « Envoyées à VRM… rien dans VRM » : Vestiaire TOUJOURS présent (filtres, colonne, « pas encore lu » + geste), la carte de l'extension dit COMBIEN elle a trouvé (« lues » ≠ trouvées), chaque écran Vestiaire dit si l'extension écrit dans un AUTRE compte VRM. `audit-capture-vc-lbc.cjs` (26 rouges avant, mutations), bancs `vestiaire-bout-en-bout` (extension → base → app, 13 rouges avant) et `badge` §6 bis. → historiques vestiaire et leboncoin (« 1er novembre — … capture »). Geste : vérifier que l'app est ouverte sur le compte VRM de l'extension (hopcancale35@gmail.com), installer la 5.299.0, sur Vestiaire faire défiler « Mes articles » jusqu'au bout et lire ce que la carte dit avoir trouvé.
- **1er nov.** — **Tournée retirée de Ma journée** (sa demande : « enlève Tournée ») : `TOURNEE_SUR_JOURNEE = false` dans App.jsx ; les cases « à envoyer / à retirer » et la ligne « Emballer les colis prêts » reprennent leur place ; le code de la Tournée reste (remise = passer la constante à `true`). Bancs `journee-mieux` (Tournée absente, cases visibles) et `tournee` (le dit et s'arrête). Geste : aucun.
- **1er nov.** — **Audit des codes de retrait** (extension **5.297.0**) : jamais le code postal ni le n° de suivi pris pour le code, « pin » pas dans les mots, deux codes différents dans un e-mail ⇒ aucun, casier non tronqué, un e-mail plus ancien ne remplace plus le code d'un plus récent, deux lignes du même n° gardent QR et identifiant (le code le plus récent gagne), un rappel Vinted sans code n'efface plus le code (`api/_lib/code-retrait-email.js`, `fusionLignesMemeSuivi`, `lieuxCompatibles`). Audit `audit-codes-retrait.cjs` (22 rouges sur l'avant, 16/16 mutations). → historique colis-retraits (« Audit des codes de retrait »). Geste : installer la 5.297.0.
- **1er nov.** — **Consigne Vinted Go sans code postal ⇒ sur la carte** (« Kusmi Tea · 13 Rue Saint-Vincent — pas sur la carte ») : l'adresse est LUE dans le suivi Vinted Go DU MÊME N° (réponse publique `carrier.vintedgo.com/public/v3/tracking_events`, déjà lue par le serveur / relayée par l'extension ; mesurée : `ready_for_pickup.metadata = { address: "rue, Ville, FR", point_id }`, jamais de code postal) ⇒ `lieuRue`/`lieuVille`/`pointId` sur `transp_vinted_*` ; Colis complète le lieu de l'e-mail par le n° (`lieuCompleteParTransporteur`), deux adresses ⇒ rien (`deux-adresses`), pas encore lu ⇒ raison + geste (`vintedgo-pas-lu`) ; Mondial Relay / Chronopost inchangés ; aucune extension neuve. Audit `audit-vintedgo-adresse`, banc `tournee` §K. Colonne « À retirer » : la phrase du relais porte le nombre en clair (« 4 colis à retirer »), pastille = épingle avec icône de colis, plus de carré gris sans photo. → historique colis-retraits (« Vinted Go : l'adresse lue dans le suivi »). Geste : aucun (au pire, ouvrir une fois le suivi Vinted Go du colis dans Chrome).
- **1er nov.** — **Cohérence de chaque bouton** : banc `tous-boutons` (99 écrans, ~820 éléments cliqués, 390/1512 px) ; Échap ferme les feuilles, « Réglages » → « Paramètres » partout (chemins faux corrigés), lien « Ouvrir l'annonce » sans adresse, désactivés qui disent pourquoi, ⓘ à 44 px, colonne jamais coupée (`data-rail-densite`), Vestiaire dans les filtres de Colis. → historique interface-stock (« Cohérence de tous les onglets »). Geste : aucun.
- **1er nov.** — **Ma journée calme** (« ça fait bordel », « c'est pas pro ») : colonne de 1120 px centrée sur ordinateur ; bonjour → **Urgent** → **Tournée** → À faire → chiffres, un titre de section chacun ; « À faire » et l'urgent en **liste à filets** (titre court = avant « — », UNE ligne de détail coupée au mot, `src/UneLigne.jsx`, texte entier en infobulle) ; Tournée « 10 à imprimer · 3 à retirer · 2 relais », jamais coupée ; **la Tournée porte « à envoyer / à retirer »** (cases de la barre cachées, data-* gardés ; « le plus pressé » de l'étape en ambre ; plus de ligne « Emballer les colis prêts ») ; une rangée de widgets non remplie s'élargit (`--etire6/2`) ; Tendances sans case « — » sans base ; cartes blanches à filet ; plus de fondu sur la colonne de gauche. `src/styles-journee-mieux.css`, banc `journee-mieux`. ⚠️ « tout visible sans défiler » n'est plus exigé qu'en densité 0,65 (`revendeurs`, `journee-widgets`). → historique interface-stock (« Ma journée calme »). Geste : regarder Ma journée ; dire si l'écran aéré lui va ou s'il veut tout sans défiler.
- **1er nov.** — Points de retrait : **une épingle par relais, avec le NOMBRE de colis** (tournée de Ma journée ET Colis → À retirer ; la ligne dit le même, `nombreEpingle`) ; toucher une épingle met sa ligne en avant. Épingles manquantes corrigées sans rien deviner : adresse sans code postal (« rue, Ville », ville collée à la rue, adresse collée au nom), positions Vinted jamais lues sur Ma journée, nom Vinted écrit autrement (même adresse), type en queue, échecs figés 24 h (cache `vrm_geo_relais_v2`), budget de 25 recherches cache compris ; BAN ambiguë ⇒ « pas sur la carte » + raison (`jugerBan`). → historique colis-retraits (« Une épingle par relais »). Geste : aucun.
- **1er nov.** — Ma journée, les chiffres épurés : la semaine en **barres** (une par jour passé, valeur si elle tient, « 0 » discret, aujourd'hui souligné cobalt ; plus de courbe lissée ni de série « reçu ») ; « Vendu en … » = UN grand chiffre puis une rangée Bénéfice · Reçu · À mettre de côté · CA (libellé, montant Geist Mono, une ligne au plus : « au moins », « 2 sur 4 », geste ambre « N prix d'achat › ») ; Tendances en 4 cases sans phrases ; aucune règle de calcul changée, banc `journee-chiffres`. → historique interface-stock (« Chiffres de Ma journée »). Geste : regarder Ma journée.
- **1er nov.** — **Récapitulatif d'une vente** (tiroir de Ventes · Vinted, maquette A « fiche en lignes nettes », « applique tout ») : photo · N° (identité seule, sinon « Sans N° VRM ») · nom ; une phrase d'état + frise Vendue → Bordereau → Déposée → Livrée → Argent reçu (`src/recapVente.js` : cochée seulement PROUVÉE, la frise REMPLACE la pastille) ; l'argent en lignes Geist Mono (règle `beneficeLigneVente` inchangée, « — » sans achat, « au plus ») ; détails ; gestes d'avant + « Conversation » et « Voir sur Vinted ↗ ». Leboncoin/eBay gardent leur tiroir. Banc `recap-vente`. → historique interface-stock (« Récapitulatif d'une vente »). Geste : regarder une vente.
- **1er nov.** — **Finition « premium »** (sans palette ni dégradé neufs) : `src/styles-finition.css` chargée en dernier — Envoyer neutre quand grisé (et dit pourquoi), cobalt plein sinon ; « Moi » (Communauté, Paramètres) posé au pied de la colonne, jamais coupé ; fil, liste et filtres de Messages ; boutons désactivés lisibles ; plus d'emoji (Traduire, états vides) ; étiquettes ≥ 12 px. Banc `finition-premium.cjs` (7 rouges avant, 0 après). → historique interface-stock (« Finition premium »). Geste : regarder Messages et la colonne.
- **1er nov.** — Vestiaire « parfait » + Leboncoin « plus aucune erreur pendant la lecture » (extension **5.296.0**) : annonces Vestiaire en fiches, ventes par étape SANS montant (dit une fois), flou par compte branché sur `vc_session` ; fausses erreurs de la carte Leboncoin (réponses auxiliaires, listes vides) retirées, lectures relues une fois sur 401/5xx (extension `sbGetLbc`, app `lireBaseRelue`). → historiques vestiaire et leboncoin (« 1er novembre »). Geste : installer la 5.296.0, ouvrir « Mes articles »/« Mes ventes »/« Articles à expédier » sur Vestiaire.
- **1er nov.** — Quatre défauts : barre du haut qui passait sous l'île (réserve mesurée au zoom près) ; fiche d'annonce au téléphone allégée (« Plus d'actions », prix d'achat manquant en ambre, ordinateur inchangé) ; Colis sans nombres redits sous les colonnes ; tiroir de vente = feuille (un toucher dehors le referme). → historique interface-stock (« 1er novembre 2026 — Quatre défauts »). Geste : regarder Annonces au téléphone.
- **1er nov.** — **Mode emballage** (Colis → « Emballer » au pied de « Prêts à imprimer », et Ma journée) : colis prêts un par un dans l'ordre de la colonne, N° en grand (rouge = deux paires, ambre = à vérifier), emplacement du Stock, 3 cases gardées sur l'appareil, « Marquer ces colis comme postés » sur son clic = le geste « ✓ Colis fait » (`marquerColisFait`) ; **fiche complète d'une paire** (« Tout sur le N° » → « Toute l'histoire du N° ») : achat → stock → annonces → vente → colis → argent par identité, « — » + raison si pas su. → historiques colis-retraits et interface-stock (« 1er novembre »). Geste : aucun.
- **1er nov.** — Ma journée « Tournée » (Imprimer · Emballer · Déposer · Retirer, mêmes sources que les cases, cochée sur un geste réel, plein écran par date limite, pas d'itinéraire) ; Ventes : bénéfice sur la ligne (« — » sans achat, « au plus » frais non confirmés), colonnes Prix · Achat · Bénéfice sur ordinateur, « Déposé » au glissé ou au bouton, annulable 5 s (= `marquerPoste`, le geste de Colis). → historique interface-stock (« 1er novembre »). Geste : regarder ; dire si « au plus » lui va.
- **1er nov.** — Paramètres, compta, arrivée, communauté « logiques et simples » : groupe « Comptes et emails » (import des emails à côté de la réception), « Achats masqués », régime affiché sur sa ligne, libellés sans jargon (État des connexions), chemins « Paramètres → … » réels, supprimer/arrêter une charge DEMANDE puis dit, « Me retirer de la carte » demande. → historiques interface-stock et compta (« 1er novembre »). Geste : aucun.
- **31 oct. (soir)** — Navigation : les colis à retirer vivent dans **Colis** seulement (colonne « À retirer » + détail codes/QR/relais dessous, `cat_achats`/`retraits` y mènent) ; **Achats** (Gérer, filtres de site) sans « à retirer » ; « Plateformes » retiré de « Plus », gardé dans la colonne (sa maquette) ; sections de site en sous-onglets des tâches (eBay À traiter/Offres → Ventes · eBay, Promotion → Annonces · eBay, Colis Leboncoin → pastille de Colis, Compte eBay → Paramètres, clé Photoroom → Annonces · Vestiaire) ; pastilles ambre sur les nombres publiés. → historique interface-stock. Geste : regarder la colonne et Colis.
- **31 oct. (nuit)** — Recherche EN PLACE (champ dans la barre/l'en-tête, panneau déroulant, plus d'écran blanc, barre du haut collante) ; chaque notification porte sa cible par identité (`api/_lib/lien-notif.js` ⇄ `src/cibleNotif.js`) : conversation ouverte, vente ouverte, carte du colis, URSSAF ; absent ⇒ une ligne. → historiques interface-stock et sécurité-base-serveur (« 31 octobre »). Geste : aucun (extension inchangée).
- **31 oct.** — Extension **5.295.0** (intégrée avec la 5.294.0) : Vestiaire — compte ouvert, conversations lues, réponse sur son clic par recette APPRISE, favoris en nombre ; Colis → « À retirer » par point relais sur une carte, arrivées estimées (suivi Vinted). → historique vestiaire / colis-retraits. Geste : installer, envoyer UNE réponse soi-même sur Vestiaire, toucher « Suivre le colis » d'un achat en route.
- **31 oct.** — Statistiques détaillées (rythme, marges par marque/modèle/taille/plateforme/compte, temps de vente, jours/heures, stock qui dort, rotation, annulations) + widget « Tendances » ; le bénéfice de Ma journée est là par défaut et se masque/remet en mode « Modifier » (interrupteur de Réglages retiré) ; une carte nouvelle arrive d'elle-même (`connus`). → historiques interface-stock et compta (« 31 octobre »). Geste : regarder Statistiques et Ma journée.
- **31 oct.** — **Navigation par tâche** (son choix « A », puis « réorganiser les onglets ») : barre Journée · Annonces · Ventes · Colis · Plus ; colonne Ma journée · Annonces · Ventes · Messages · Colis + groupes Vendre · Expédier · Gérer · Argent · Plateformes · Moi ; filtres de site dans Annonces/Ventes/Messages (« Vinted » = l'ancien écran Vinted), « Toutes » pour Ventes seulement ; anciens `?tab=` redirigés (`src/navigationTache.js`). → historique interface-stock (« Navigation par tâche »). Geste : regarder la carte, trancher les points ouverts.


## Lignes les plus anciennes de §9, déplacées TEL QUELLES le 2 novembre 2026 (mode auto des favoris)

- **16-19 oct.** — Relais du téléphone (5.183), double vérification TOTP, studio photo,
  mode équipe (016), carte et classement de la communauté (018-020, appliquées). → divers.
- **11 oct.** — Remise à zéro des numéros (013, appliquée), prix 12,99 €, Messages eBay.
- **3-9 oct.** — L'app pilote l'extension (bordereaux, publication), messagerie intégrée,
  numéros à lettres, CA daté au versement, abonnement Stripe (mode test), sécurité
  (routes fermées, RLS, origines exactes de l'extension).
- **Septembre** — le reste : `docs/journal-2026.md` et les historiques.
- **20 oct.** — Doublons de N° réglés seuls ; revues « argent » (app, extension, eBay) ;
  eBay se relit tout seul ; Leboncoin : compte de session, date de vente. → numeros / ebay.
- **21 oct.** — Discord sur téléphone, date d'arrivée des colis, rappel du soir, « Tout
  sur le N° », captcha prêt, revue visuelle. → `docs/passation/2026-10-21.md`.


## Ligne retirée de CLAUDE.md §9 le 2 nov. (taille), telle quelle

- **22 oct.** — Double vérification gratuite (second appareil) ; adresse de réception
  PROUVÉE ; CSP en Report-Only (la bascule à faire : historique sécurité) ; Ma journée en
  widgets ; carte de la communauté (OpenFreeMap) ; colis à l'heure ; « C'est déclaré ».
  → `docs/passation/2026-10-22-integration.md`.


## Lignes retirées de CLAUDE.md §9 le 2 nov. (taille), telles quelles

- **23-24 oct.** — Suivi des colis par n° et par Vinted (5.216-5.217), colis à retirer
  fiables (date limite lue, « à vérifier »), eBay « Inactives » (lecture seule), reçu
  d'achat lisible, feuilles au-dessus de la barre sur iPhone. → colis / ebay / interface.
- **26 oct.** — eBay multi-sites (chaque compte sur SON site, argent en euros), eBay à
  l'international (destination, douane) ; retrait « pour de bon » par catégorie
  (annonces, messages) ; suppression ciblée (bordereaux et relevés séparés). → ebay / divers.
- **27 oct.** — Atelier de republication (tranches 1-5) ; Vestiaire depuis VRM (publier
  sans booster, ventes, achats, messages) ; statut fiscal adapté à la personne ; arrivée
  guidée (`Bienvenue.jsx`) ; annonces en fiches produit ; un article parti sort du Stock.
- **31 oct. (soir)** — Les colis à retirer vivent dans Colis seulement ; Achats à part ; sections de site en sous-onglets. → historique interface-stock. Geste : aucun.
- **31 oct. (nuit)** — Recherche en place et notifications qui mènent à l'endroit exact (`api/_lib/lien-notif.js` ⇄ `src/cibleNotif.js`). → historiques interface-stock et sécurité. Geste : aucun.
- **31 oct. (soir)** — Colis en 4 colonnes (Prêts · En attente · À retirer · Partis, sa maquette) + barre du haut ordinateur (recherche « / », filtres de site à droite) ; aucune règle neuve, la liste d'avant reste sous « Colis par colis ». → historique colis-retraits. Geste : regarder Colis sur ordinateur.
- **31 oct.** — **Prix 16,99 €/mois** (sa décision ; 14,99 € depuis le 27 oct., CGV version 2026-10-31, essai 7 j inchangé) ; adresse de contact **vrm.vinted35+contact@gmail.com** (sa décision), tenue hors de la réception des colis (`gmail-forwarder.gs`, à recoller). Geste : prix Stripe à 16,99 €.
- **31 oct.** — Emails : journal « Tes emails, ce que VRM en a fait » (Paramètres → Emails → Journal, et depuis Colis) : une phrase par email, raison et geste ; résumé court écrit au classement (`api/_lib/resume-email.js`), texte à part (`email_texte_*`), `mode=journal` paginé (≈ 11 Ko/page). → historique sécurité-base-serveur. Geste : aucun.
- **31 oct.** — Extension 5.295.0 : Vestiaire (compte, conversations, réponse par recette APPRISE, favoris en nombre), relais des achats. → historiques vestiaire / colis-retraits. Geste : envoyer UNE réponse soi-même sur Vestiaire.
- **31 oct.** — Statistiques détaillées + widget « Tendances » ; bénéfice de Ma journée masquable en mode « Modifier ». → historiques interface-stock et compta. Geste : aucun.
- **31 oct.** — Navigation par tâche (Journée · Annonces · Ventes · Colis · Plus ; anciens `?tab=` redirigés, `src/navigationTache.js`). → historique interface-stock. Geste : aucun.
- **31 oct.** — Extension **5.293.0 soumise à addons.mozilla.org** par Julien (fiche `vrm-outil-du-revendeur`, compte vrm.vinted35@gmail.com) : Orion iPhone refuse l'installation par fichier (essais du 31 oct.) mais installe depuis la boutique (Dark Reader OK). Geste : à l'acceptation, donner le lien → `LIENS_BOUTIQUES.firefox` ; Chrome Web Store : `docs/publier-extension-pas-a-pas.md`.


## Lignes du 28 oct. sorties de CLAUDE.md §9 le 2 nov. (telles quelles)

- **28 oct.** — VRM reste sur la France (décision). Stock : un article une fois, toutes
  plateformes ; meubles, plateaux, planches, hauteurs et « max N » partout. → interface-stock.
- **28 oct.** — Republier : supprime et recrée (5.248), brouillons Vinted, menu « Actions »,
  « Refaire le brouillon », couleur et taille vérifiées avant la mise en ligne. → vinted-extension.
- **28 oct.** — Vestiaire : formulaire « smart listing », étiquette en 2ᵉ photo, Taille/État/Prix.
- **28 oct.** — Tour de chaque espace sur ses vraies données (Vinted, Leboncoin, eBay,
  Vestiaire, Ma journée, Colis).

## Lignes du 29 oct. sorties de CLAUDE.md §9 le 2 nov. (telles quelles)

- **29 oct.** — Favoris comme Vintex (5.280-5.281) : variables `{username}`, `{a|b}`,
  offre réelle ; plafond de file retiré. → favoris-messages.
- **29 oct.** — shop_cancale : tout retiré, ventes comprises (sa décision) ; un compte
  supprimé ne sort plus d'aucune lecture (`src/comptesSupprimes.js`, sauf
  `{ vrmVoirSupprimes: true }`). → divers / sécurité.
- **29 oct.** — Ventes masquées impossibles ; Organisation hors du menu ; saisie « N° +
  Entrée » retirée ; carte de la communauté gardée claire en mode sombre.

## Autres lignes du 29 oct. sorties de CLAUDE.md §9 le 2 nov. (telles quelles)

- **29 oct.** — Leboncoin comme Vinted (5.288→5.291) : liste « Mes annonces » complète qui
  fait sortir les disparues, « à retirer de Leboncoin » par identité, « Supprimer de
  Leboncoin » (confirmé, 10/h), Republier Leboncoin, favoris en NOMBRES seulement. → leboncoin.
- **29 oct.** — Statut chez le transporteur lu par le SERVEUR (Mondial Relay, Chronopost,
  Vinted Go), l'extension en secours. → colis-retraits.
- **29 oct.** — Messages : une offre sur une annonce plus en vente ne reste pas en tête
  (`src/offresVinted.js`) ; « Retirer de la liste ». ⚠️ depuis le 18 oct. aucune requête
  `/api/v2/conversations/…` ne part de la page : l'extension mesure la nouvelle route. → favoris-messages.
- **29 oct.** — Écrans Vinted : grandes photos, état en jauge, calendrier de périodes,
  pastille Actions. → interface.
- **29 oct.** — Comptabilité simple (ordre seul changé), micro-entreprise repliée, suivi
  URSSAF (mensuel/trimestriel), cotisations dans Ma journée, déclaration de revenus
  (cases 5KO/5TA), CFE, rappel 3 jours avant l'échéance. → compta.
- **29 oct.** — Reçu d'achat par email relié à SON achat par n° (`api/_lib/recu-achat.js`) ;
  le mot est « reçu », pas « facture » (`NOM_RECU_ACHAT`). → compta / colis.
- **29 oct.** — Agent eBay qui DEMANDE (jamais sans son oui) ; eBay → Achats : recherche
  et fil (jeton d'application). → ebay.
- **29 oct.** — Clé Photoroom par vendeur, chiffrée, sur l'écran Vestiaire (pas dans
  Paramètres). → vestiaire.
- **29 oct.** — Plafond d'actions **50/h** (sa décision) ; Republier comme Vintex (5.277-5.285).
  → vinted-extension.


## Lignes de §9 déplacées telles quelles le 2 nov. (nuit)

- **31 oct.** — CLAUDE.md allégé (1,36 Mo → < 60 Ko), historique déplacé tel quel dans
  `docs/passation/historique-*.md`.
- **30 oct.** — Intégration v30, extension **5.291.0** (5.288/5.290 étaient des numéros de
  branche) : `docs/passation/2026-10-30.md`.

- **31 oct. (soir)** — Vinted/extension **5.293.0** (intégrée avec Leboncoin en 5.293.0) : le pont photo relaie le `statut` du CDN (lien mort 404/410 plus redemandé avant 30 min, refus passagers en tête du témoin) ; détourage Vestiaire : `cle-pas-su` arrête la série et se dit en français. → historique vinted-extension. Geste : installer la 5.293.0 une fois fusionnée.
- **31 oct.** — Tournée de tous les bancs et audits : 5 défauts corrigés (purge d'un
  compte supprimé, cartes Leboncoin remontées, table de reprise lue deux fois…). Les
  panneaux des Paramètres s'ouvrent en sous-écran aussi sur ordinateur (`[data-sous-ouvrir]`).
  Rouges laissés : `session` G/P (Chrome 153), `mobile`, `profil-avatar` (instables).
  → historique divers / interface.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Vestiaire en fiches + lectures Leboncoin relues sur 401/5xx (extension **5.296.0**). → historiques vestiaire et leboncoin. Geste : ouvrir « Mes ventes » / « Articles à expédier » sur Vestiaire.
- **1er nov.** — Quatre défauts d'interface (barre sous l'île, fiche d'annonce au téléphone, Colis sans redite, tiroir de vente en feuille). → historique interface-stock. Geste : aucun.
- **1er nov.** — Mode emballage (Colis → « Emballer ») et « Toute l'histoire du N° » par identité. → historiques colis-retraits et interface-stock. Geste : aucun.
- **1er nov.** — Ventes : bénéfice sur la ligne (« au plus » si frais non confirmés), « Déposé » annulable 5 s. (La Tournée de ce lot a été retirée ensuite, voir plus haut.) → historique interface-stock. Geste : dire si « au plus » lui va.
- **1er nov.** — Paramètres, compta, arrivée, communauté plus simples (groupe « Comptes et emails », suppressions qui demandent). → historiques interface-stock et compta. Geste : aucun.
- **1er nov.** — Colis → « À retirer » par point relais : aucun colis écarté (« Point pas encore connu » + raison), même relais écrit deux fois = un point (nom propre + CP), position Vinted ou Base Adresse, compteur = Ma journée (`vrm_colis_retirer`), même n° de suivi compté une fois. → historique colis-retraits (« 1er nov. »). Geste : aucun.
- **31 oct.** — Compétence **taste** (Leonxlnx/taste-skill, MIT) installée dans `.claude/skills/taste-skill/` à sa demande : tout changement de style passe par elle (`references/app-screens.md` pour les écrans de l'app) ; §7 et ses refus priment. → `.claude/skills/README.md`.
- **31 oct.** — Style « Vitrine » (son choix parmi 4 maquettes) appliqué à toute l'app, clair et sombre → historique interface-stock (« Vitrine »). Geste : regarder l'app ; dire si « Tout imprimer » doit être fixé au-dessus de la barre du bas.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Stock : « Où est la N° ? » propose « Ranger ici / Autre case » pour une paire pas rangée ; cases dites en rangée/colonne ; ranger, retirer, sortir du stock le disent. Annonces : plus de chiffres d'argent ni « À faire aujourd'hui » en tête (ils restent dans Ventes). Menu « Republier et brouillons » (ordre inchangé). → historique interface-stock. Geste : aucun.
- **1er nov.** — Finition « premium » (`src/styles-finition.css` chargée en dernier, plus d'emoji, étiquettes ≥ 12 px). → historique interface-stock. Geste : aucun.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Chiffres de Ma journée épurés (semaine en barres, un grand chiffre + Bénéfice · Reçu · À mettre de côté · CA), règles inchangées. → historique interface-stock. Geste : aucun.
- **1er nov.** — Récapitulatif d'une vente (frise Vendue → Argent reçu cochée seulement PROUVÉE, `src/recapVente.js`). → historique interface-stock. Geste : regarder une vente.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Ma journée calme (colonne centrée, Urgent → À faire → chiffres, liste à filets `src/UneLigne.jsx`) ; « tout sans défiler » exigé seulement en densité 0,65. → historique interface-stock. Geste : dire si l'écran aéré lui va.
- **1er nov.** — Une épingle par point relais avec le nombre de colis ; adresse ambiguë ⇒ « pas sur la carte » + raison (`jugerBan`). → historique colis-retraits. Geste : aucun.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Codes de retrait fiables (extension **5.297.0**, 9 défauts, `audit-codes-retrait`). → historique colis-retraits. Geste : aucun (5.307.0 les contient).
- **1er nov.** — Consigne Vinted Go : adresse lue dans le suivi du même n° (`lieuCompleteParTransporteur`), jamais devinée (`audit-vintedgo-adresse`). → historique colis-retraits. Geste : aucun.
- **1er nov.** — Cohérence de chaque bouton (banc `tous-boutons`, 99 écrans) : Échap ferme les feuilles, « Paramètres » partout. → historique interface-stock. Geste : aucun.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Capture Vestiaire/Leboncoin fiable (extension **5.299.0**) : une réponse inconnue n'est plus « lue, vide », compte de la page = compte de l'onglet, liste entière (`audit-capture-vc-lbc`). → historiques vestiaire et leboncoin. Geste : app ouverte sur le compte VRM de l'extension, « Mes articles » Vestiaire défilé jusqu'au bout.
- **1er nov.** — Tournée RETIRÉE de Ma journée (sa demande) : `TOURNEE_SUR_JOURNEE = false`, code gardé. Geste : aucun.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — Vestiaire partout : une vente Vestiaire rend sa paire « vendue » PAR IDENTITÉ sur tous les sites ; entre dans CA/URSSAF/bénéfice seulement si le montant est sûr, sinon « non comptée » nommée (`audit-vestiaire-partout`). → historique vestiaire. Geste : aucun.
- **1er nov.** — Données sûres : `main` fusionnée clé par clé (`src/fusionNuage.js`) + PATCH conditionnel sur `data.rev`, `lireTout` sans trou, purge au préfixe exact (`audit-fusion-nuage`, `audit-purge-compte`). → historique sécurité-base-serveur. Geste : aucun.
- **1er nov.** — Audit des actions X1-X9 (extension **5.307.0**) : deux paires au même titre sous un N° = rouge, Republier verrouillé et quota en base. (plafond par compte fait en 5.312.) → historiques numéros, favoris-messages, leboncoin, vinted-extension. Geste : installer la 5.307.0.
- **1er nov.** — Ma journée sans redite (cases 2 × 2 au téléphone, « dont N aujourd'hui », une ligne « Colis à vérifier »). → historique interface-stock. Geste : regarder Ma journée au téléphone.

### Lignes de §9 déplacées telles quelles
- **1er nov.** — VRM pour d'autres vendeurs : 19 défauts corrigés (code Gmail au vendeur qui a PROUVÉ l'adresse, factures Pro au propriétaire seul, textes neutres `audit-vendeur-neutre`). → historique sécurité-base-serveur. Geste : recoller `scripts/gmail-forwarder.gs` + `EMAIL_INBOUND_SECRET`.

### Lignes de §9 déplacées telles quelles
- **2 nov.** — Passation de la nuit : 11 lots en ligne (PR #932 → #942, extension 5.307.0), 7 audits dans `docs/passation/audits-2026-11-01/`. → `docs/passation/2026-11-02-nuit.md`.
- **1er nov.** — Audit des parcours A5-A14 (double vente Leboncoin par N°, « Vendus ailleurs » par `cleNum`, « …a échoué » ≠ vente, ventes plus masquables). Reste : « Échec du paiement »/`failed` à aligner à la prochaine extension. → historique divers. Geste : aucun.

### Lignes de §9 déplacées telles quelles
- **2 nov.** — Colis : le filtre de site vaut pour TOUT l'écran (`voitSite`, `retoursPourSite` : plus de Vinted sous eBay, Julien : « inadmissible ») ; boîte vide du récapitulatif au téléphone retirée ; 190 chemins absolus `/home/user/…` retirés des audits/bancs. Audits : tous verts sauf ceux qui exigent Postgres (6) ou `@babel/parser` (1), absents ici. Geste : regarder Colis au téléphone.
- **2 nov. (matin)** — Audit du dossier : les 7 chantiers « en cours » de la nuit n'ont JAMAIS été poussés ⇒ perdus, à refaire (nuit §3) ; §9 condensé, §8 recopié du code, ancienne « passation en cours » archivée. Geste : si la session de la nuit est encore ouverte, lui faire pousser ses worktrees.

### Lignes de §9 déplacées telles quelles
- **2 nov.** — Audit des données (E0c) : eBay aux frais pas lus « au moins » partout, « 1er », Vestiaire/Leboncoin dans « Finalisé par plateforme », pas lu ≠ 0 (base lente, semaine, NaN, Invalid Date), jours au fuseau local (`audit-donnees-ecrans`). → historique divers. Geste : aucun.
- **2 nov.** — Offres auto : jamais sur une paire vendue ailleurs (**5.308.0**, `src/offresGarde.js`). Geste : installer.

### Lignes de §9 déplacées telles quelles
- **2 nov.** — Carte des relais : les consignes Vinted Go revenaient « deux adresses » (pays « France » rangé en ville, ville collée à la rue) ; le serveur retire le pays en lettres, l'app relit les lignes déjà rangées (`lieuTransporteurRepare`, `audit-vintedgo-adresse`). → historique colis-retraits. Geste : rouvrir Colis → À retirer.
- **2 nov.** — **Mode auto des messages aux favoris** (éteint par défaut, **5.309.0**, `src/favorisAuto.js`, `api/_lib/favoris-auto.js`, `audit-favoris-auto`) : jamais de boucle, VRM demande le geste qui débloque. → historique favoris-messages. Geste : installer la 5.309, ouvrir un favori depuis la cloche, allumer.

### Lignes de §9 déplacées telles quelles
- **2 nov.** — **Republier qui règle ses problèmes** (**5.310.0**, `reglerAvant`, `audit-republier-question`) : champ vide repris de la recette de CETTE annonce (2 tours), sinon UNE question avec les valeurs de Vinted (« Choisir la catégorie » sur la ligne, réponse posée une fois) ; refus nommé retenu, jamais renvoyé ; plafond fermé si le stockage de l'extension est muet (P10) ; message de refus d'offre compté (P11). → historique vinted-extension. Geste : installer la 5.310.0.

### Lignes de §9 déplacées telles quelles
- **2 nov.** — Visite en bulles à la première connexion (`src/VisiteBulles.jsx`, `vrm_visite_vue` synchronisée, « Revoir la visite » dans Paramètres → Aide), onglets NUS (plus aucune explication à côté), une phrase sous le titre de 6 écrans (`src/phrasesEcran.js`) ; banc `demo-bulles` vert 390/1512. → historique interface-stock. Geste : regarder la visite au téléphone (Paramètres → Aide → Revoir la visite).
- **2 nov.** — eBay : jeton d'accès gardé côté serveur jusqu'à 5 min de sa fin (`ebay_tokens_acces`, lié à l'empreinte du refresh, effacé à la déconnexion, `audit-ebay-jeton-cache`, P9) ; publier et changer un prix exigent `confirme:true` côté serveur (P12). → historique ebay. Geste : aucun.
