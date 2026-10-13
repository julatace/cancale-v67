# Reprise Cloud — photos et interface, 13 octobre 2026

État vérifié via GitHub : PR 488 ouverte et draft, tête 0c52555d700e7de8d4f3f9d2bc9111c35e5eeabd avant cette note. Le premier lot K1 est intégré. Le deuxième lot testé localement faad6b0414a804c6df5d9e68b49d14d2831b5825 (arbre be8cc301f6e84ea927c53d6e2a4f8f32c83a0d00) n'est PAS intégré à la branche distante. Le transfert de son gros App.jsx reste bloqué ; aucun workflow de contournement ajouté.

Instruction récente de Julien : photos visibles sur toutes les plateformes, annonces ET ventes ; proposer plusieurs interfaces premium et des boutons mieux finis. La reprise technique globale reste nécessaire avant publication.

Copie Cloud : /workspace/scratch/6a463a9f586f/cancale-v67, branche codex/cloud-k1-saved. Modifications depuis faad6b0 : src/photoSource.js, src/App.jsx, api/_lib/ebay-commandes.js, docs/design/vrm-premium.html. Ces modifications ne sont pas encore validées par build ni sauvegardées dans la branche distante.

Constats : commandeMinimale supprimait les champs image des lignes eBay alors que EbayVentes les lisait. Correctif local : projection minimale image.imageUrl, repli vers annonce du même compte par legacyItemId exact, formats photo partagés (chaîne/objet/listes), réinitialisation de PhotoVente quand sa source change, no-referrer pour les images natives. Pas de rapprochement par titre ou numéro supposé. Aucun appel réel eBay/Vinted. Contrôles déjà exécutés après ces changements : audit-ebay-commandes et audit-photos-vinted verts. Tests supplémentaires, build et rendus à faire.

Lecture Supabase seule : aucun diag_photos enregistré. L'annonce eBay captée possède un champ photo. Cela ne prouve pas la cause du problème général dans le navigateur de Julien. Continuer l'analyse de Vinted/Leboncoin et du chargement mobile ; ne pas annoncer les photos rétablies sur toutes les plateformes sans preuve.

Maquette locale interactive : docs/design/vrm-premium.html, trois directions Graphite/sauge, Ivoire/forêt, Bleu nuit/argent ; même interface, boutons primaire/secondaire, focus, états hover/active et cibles tactiles. Données fictives explicitement réservées à la maquette, aucune insertion en production. Les chaussures sont des illustrations. Vérification visuelle mobile/ordinateur non effectuée.

Blocage nouveau : exec_command ne répond plus, y compris pwd sans login. GitHub et Supabase restent accessibles. Aucun merge, déploiement, activation moteur ou achat d'étiquette. K14 gelé. Reprendre les tests et sauvegardes dès le retour effectif de l'exécuteur, puis K4/K5 et les autres chantiers.
