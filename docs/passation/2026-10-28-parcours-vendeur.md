# Parcours vendeur — 28 octobre 2026

## Ce qui change

1. Les tiroirs Vinted, Leboncoin et eBay partagent un accès à la fiche existante « Tout sur le numéro ». Le numéro vient des résolveurs d'identité déjà utilisés par chaque plateforme, pas d'un titre. Une commande eBay à plusieurs articles peut offrir plusieurs fiches. Sans numéro confirmé, aucun choix n'est inventé. Le tiroir se ferme avant d'ouvrir la recherche/fiche existante ; sa lecture est relancée.
2. La préparation groupée des colis montre sélection, photos, numéros, emplacements du plan local lorsqu'ils sont connus et contrôle physique manuel. Le contrôle est lié au vendeur, au compte, à la transaction et au numéro. Un changement invalide ce contrôle. Avant le PDF, une confirmation rappelle les articles non contrôlés. Les fichiers lus et la fusion ont un état de progression distinct ; les erreurs restent relançables par identité. Le contexte est revérifié après la confirmation et avant l'ouverture du PDF. Aucun colis n'est marqué expédié par ces étapes.
3. Un relevé de fiabilité accompagne les ventes des trois plateformes : périmètre filtré, coûts inconnus, frais confirmés/non suivis et commandes hors calcul. Les calculs comptables existants sont réutilisés. Sur Leboncoin, le résultat vente moins achat est explicitement une marge avant frais. Les montants inconnus ne deviennent pas zéro ; aucune conversion de devises n'est inventée.
4. Les listes conservent leur ligne compacte et leur tiroir commun ; tailles des vignettes et accès à la fiche sont harmonisés. Les fonctions métier existantes de facture, conversation et impression restent dans ces tiroirs. Aucun logo remplacé.
5. Le suivi Vinted par compte utilise les métadonnées de capture déjà lues dans Connexions, sans télécharger les conversations. eBay distingue le résultat des lectures de commandes et d'annonces de chaque compte. Leboncoin présente les comptes à session observée, les annonces attribuées, celles avec une photo fournie et les ventes liées par identifiant. Les enregistrements non attribuables ne sont pas distribués arbitrairement. Une URL reçue ne garantit pas que l'image charge ; aucune capture historique ne certifie une session active.

## Garde-fous et limites

- Pas de changement des droits Supabase, des routes financières ou de l'extension ; pas d'achat d'étiquette ni d'envoi de message.
- Les contrôles de préparation reposent sur le dernier état reçu dans VRM. Ils ne promettent pas une lecture instantanée de la plateforme.
- Une observation de capture ne certifie pas l'exhaustivité de toutes les listes ni des photos.
- Le plan de rangement affiché est celui disponible sur l'appareil. Un emplacement non vérifié n'est pas annoncé comme une absence de rangement.
- Aucun vrai compte, vente, email ou document utilisateur n'est modifié par les tests.

## Validation

- Compilation Vite.
- `node --test scripts/tests/parcours-vendeur.test.mjs` : 8 tests (prix/frais inconnus, empreintes, séparation des comptes, horodatages, états eBay et rattachement Leboncoin).
- `node scripts/tests/fiche-vente-interface.cjs` : composant réel des trois plateformes à 390 et 1512 px, ouverture par numéro et fermeture du tiroir, sans débordement.
- `VRM_CHROMIUM_PATH=/usr/bin/chromium VRM_PDFJS_DIR=/tmp/vrm-pdfjs node scripts/bancs/lot-bordereaux.cjs` : 15 contrôles, sélection/contrôle séparés, confirmation et reprise des échecs exacts.
- `VRM_CHROMIUM_PATH=/usr/bin/chromium node scripts/bancs/ventes-colis-premium.cjs` : 31 contrôles, montants/compteurs, disposition, cibles et absence de débordement.

Les évolutions des paramètres de la même branche sont documentées dans `2026-10-28-parametres-guides-bordereaux.md`.
