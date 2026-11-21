# 5 nov. — Améliorations de la vague 2 (trouvées en lecture seule sur sa base)

Julien : « regarde encore d'autres choses à améliorer, ne me propose pas et fais-le ».
Mesuré en SELECT sur sa base, sans rien écrire. Aucun nom, aucune adresse, aucun
pseudo ici : les agents re-mesurent eux-mêmes. Rien de la liste des refus (§3).

| # | amélioration | gain mesuré | chantier | taille |
|---|---|---|---|---|
| 1 | **Remettre en vente une vente annulée avant l'envoi** (520 / 510, colis jamais parti) : bouton sur la ligne « Annulée » → atelier Republier depuis le coffre, N° gardé (`repriseNumero`), ligne dans Ma journée ; module pur `src/annuleesChezToi.js`. Mesurer d'abord `recreerVinted` sur une annonce FERMÉE. | 11 ventes depuis août, ~47 € chacune, aucune remise en ligne | E2 + C | moyenne |
| 2 | **Prix mini sur plusieurs annonces d'un coup** (action « Prix mini… » dans `ACTIONS_SELECTION` : prix − X % ou − X €, arrondi, seuil `refuse` en option, confirmation N° · prix · mini) | ~11 offres/jour, moteur allumé, 5 annonces sur 60 ont un mini | C | petite-moyenne |
| 3 | **Dater les versements par le relevé du porte-monnaie** (`invoice_lines`) : mesurer d'abord une ligne de VENTE ; `storeReleve` n'a jamais rien écrit | 1 777 ventes / 80 891 € « à dater » | F + extension | grande |
| 4 | **Relier l'achat aux annonces numérotées automatiquement** : filtre « Sans achat relié », compteur Ma journée, suggestion `suggestionsAchat` + « Relier » au prix du reçu, sur SON tap | 0 annonce en ligne sur 56 a un coût ; 504 fiches sur 522 numérotées auto | E2 | moyenne |
| 5 | **Comptes sans e-mail** dans Comptes liés (`BlocComptesMuets` déjà là) ; **adresse sans compte** dans E-mails → Relier ma boîte | 3 comptes = 45 % des ventes sans e-mail ; 66 e-mails sur une adresse non reliée | H + G | petite |
| 6 | **Ventes « Vérification de l'article »** : lecteur d'e-mail (`parseSaleEmail`) + étape « Au centre de vérification » | 2 ventes sans notif ni double-vente | G + E2 | petite-moyenne |
| 7 | **Une seule règle de suggestion d'achat dans la saisie en série** (`fillBuySugg` → `suggestionsAchat`) | titre seul suffisait, achats postérieurs proposés | E2 | petite-moyenne |
| 8 | ~~Accueil : promesses fausses~~ — FAIT le 5 nov. (ea4a1ad6) ; reste « répondre aux questions des acheteurs » cité comme automatisme (n'existe plus) | — | H | petite |
| 9 | **Vitesse** : `vinted_item_details` (350 Ko) lu en `select=data` à 3 endroits ; `orders_*` (1,86 Mo) pour tous les comptes | téléphone plus rapide | C + H | moyenne |
| 10 | ~~Plantages d'Orion `kagi.executeCallback`~~ — FAIT (78aa1446) | 10 des 15 plantages | — | — |
| 11 | E-mails Leboncoin « Suppression de vos annonces » : mesurer l'identité, sinon une notif « ouvre Mes annonces » | faible (11 annonces) | G | petite |

Déjà en file (vague 1) : inventaire, sortie du Stock à la vente, tournée de dépôt, offres
Vestiaire qui expirent (jamais Vinted), annulations par compte, bilan du mois, temps de
préparation, recherche par photo, URSSAF en un geste, même paire en ligne deux fois, où
ranger à l'arrivée, délai de paiement.
