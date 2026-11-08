# 8 novembre — des parcours plus visuels et pratiques

Demande de Julien : les sept améliorations proposées, puis des repères visuels plus simples dans toute l'app. Branche `codex/parcours-simples-7`, base `0e6f3656` (PR 1042). Aucun changement d'extension, de contrat serveur ni de base.

## Résultat

- En-têtes et actions regroupés, recherche unifiée, états vides compacts, retours de panne et boutons occupés reconnaissables avec les jetons DESIGN.md.
- Synchronisation Vinted : une ligne par compte, deux sources datées, problème et action dédiés. Le compteur compte les comptes à vérifier, pas leurs sources. Les détails techniques restent repliés. « Captures reçues » ne garantit pas une capture exhaustive ou actuelle.
- Messages : priorité aux réponses attendues prouvées, sous-filtres messages/offres. L'auteur inconnu reste dans Toutes. Aucun message envoyé à l'ouverture.
- Offres : photo et trois prix séparés. Le prix de l'annonce exige un article ET compte exacts et une occurrence unique ; aucune recherche par titre, aucune substitution par le prix de vente. Les confirmations et actions existantes sont conservées.
- Retraits : résumé compact sur mobile, gestes côte à côte. « Code » ouvre le détail et copie le code texte exact (zéros conservés). Un QR n'est pas copié en texte. Un refus du presse-papiers garde le détail disponible.
- Mail : un compte inconnu/ambigu sur un mail Vinted est explicite ; le bouton ouvre le guide des adresses, sans attribution automatique.
- Lots PDF : la progression suit les lectures terminées. Une panne conserve la sélection et l'erreur ; une réussite partielle ne garde que les échecs. Recontrôle du propriétaire après préparation du PDF avant tout marquage.
- Démarrage : reste sur la première étape non prouvée et propose de vérifier à nouveau. Une réponse tardive du guide d'un autre propriétaire n'entre plus dans le cache de la session courante.

## Vérification

Dépendances réinstallées avec npm ci (l'ancien lien node_modules ne contenait pas jsqr), compilation réussie. Tests directs du vrai contrôleur de lot et du hook de réception, rapprochement financier et étapes du guide, banc React de synchronisation (320/390/1512). Bancs complets boîte mail, messages, sélection des bordereaux et retraits sur données synthétiques ; captures téléphone et ordinateur examinées. Les captures avec horloge figée pouvaient manquer la peinture du titre ; reprendre l'horloge avant capture rétablit son rendu, sans modification produit.

Contre-preuves : les nouveaux tests du contrôleur et du hook sont rouges sur l'arbre de base (progression démarrée trop tôt ; ancienne réponse reçue après changement de propriétaire). Une mutation retirant le recontrôle après fusion PDF échoue avec deux marquages indus. Les tests sont intégrés à la CI de reprise.

Aucune écriture de test en production, aucun envoi réel, aucun compte vendeur réel vérifié. Les bancs vérifient le comportement du code avec des réponses synthétiques, pas la disponibilité d'une session Vinted.

## Résultats et limites de la vérification générale

- Boîte mail : 104 verts ; retraits : 129 verts ; sélection des bordereaux : 54 verts ; synchronisation React : 39 contrôles ; messagerie : tout vert ; règles ciblées : 20 tests verts. Compilation finale réussie. Le banc bureau/chargement est vert localement (320/390/1512).
- Les cibles Questions/Tout et navigation 1/2 d'eBay étaient trop petites dans la base (35 × 44 sur mobile, hauteur 36 sur ordinateur). Le correctif couvre aussi le panneau rendu hors de la coque en portail.
- La CI générale n'est pas entièrement verte. Reproduction sur `0e6f3656` : `audit-parcours-production` donne déjà 7/9 groupes (deux extractions de tests d'isolation obsolètes, attente 401/503 dans reception-email, liste fermée des images dans audit-photos-vinted). `orion-base-validee.py` compare encore la livraison actuelle à la contrainte « popup.js seulement » de la 5.322 ; il est déjà rouge après les livraisons 5.323–5.326 de main. Aucun de ces verrous n'a été affaibli pour livrer du visuel. Le banc bureau est rouge en CI mais vert localement. Ne pas prétendre avoir certifié l'ensemble des services ni la production à partir de cette PR.

La PR 1044 (`f5dfd422`) est arrivée pendant la vérification : intégrée par un vrai merge, en conservant les écrans chargés à la demande, la règle « à envoyer » et la correction PhotoVinted de la boîte mail. Les conflits ne concernaient que l'emplacement des imports et les deux lignes de passation. Les tests du contrôleur PDF et du guide repassent après cette intégration. Le banc offres/objectif corrigé donne 100 verts, 0 rouge (390/1512, clair/sombre). La liste des échecs historiques ci-dessus décrit la base initiale ; plusieurs audits ont été remis en conformité par la PR 1044.

Après intégration de 1044, le banc bureau a révélé une vraie incohérence de cascade : à 1024 px, la fiche masquée gardait sa colonne (420 / 2 / 272 px), donc le fil n'avait plus que 2 px. Le style final impose deux colonnes entre 1024 et 1439 px, avec une liste de largeur adaptative, et remet la carte article dans le fil lorsque la fiche est cachée. La vérification conserve le seuil existant de 400 px, sans l'affaiblir.

Le passage final bureau valide les sept écrans à 320, 390, 1024, 1280, 1512 et 1920 px : aucun débordement, largeur du fil préservée, ventes sans chevauchement. La fin du banc avait ensuite un sélecteur ambigu (`[role=status]`) depuis que l'écran HTML et l'écran React coexistent pendant le démarrage ; il est désormais limité au statut du chargement React. Les deux arrivées (mouvement normal/réduit) repassent séparément. Cette adaptation ne retire aucune assertion de largeur ni de chargement.
