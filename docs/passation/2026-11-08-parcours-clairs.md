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
