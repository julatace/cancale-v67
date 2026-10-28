# Factures Gmail et bordereaux : contrôles supplémentaires

## Défauts reproduits et corrigés

1. Le script factures vérifiait `SECRET`, constante vide de la livraison publique, au lieu de la clé des propriétés Google. Le banc exécute désormais le fichier complet avec une clé fictive dans les propriétés, comme une installation réelle.
2. Un email envoyé sans accusé VRM pouvait repartir. Un reçu persistant protège l'envoi, et seul l'accusé est retenté après un retour Gmail confirmé. Une interruption pendant l'envoi, un contenu modifié ou un journal illisible bloque le renvoi automatique. Le journal est borné, sans contenu ni destinataire. Les procédures de vérification et de reprise sont dans le guide Gmail.
3. La recherche de zone blanche sérialise le PDF. Sur une page assemblée pour une imprimante thermique, pdf-lib mettait son flux en cache ; ajouter le numéro au même flux après cette sauvegarde pouvait ne rien produire dans le PDF final. `resetPosition`, API publique de pdf-lib, ouvre un nouveau flux avant le tampon. Les coordonnées explicites, le format et le contenu existant sont conservés.

## Preuves

- Tests factures : clé en propriétés, formulaire exact, panne de file, accusé perdu, interruption d'envoi, échec du journal avant/après Gmail, double exécution, contenu modifié, borne du journal et purge des seuls reçus confirmés anciens. Le code précédent échoue à quatre scénarios du premier lot.
- QR : PDFs synthétiques sur trois formats, quatre rotations et assemblage thermique. Le test vérifie le numéro dans le texte du PDF final et décode le QR avant/après tampon. Un QR volontairement recouvert doit devenir illisible. Avant le correctif, le cas thermique assemblé échoue car le numéro est absent.
- Le lecteur QR `jsqr` est une dépendance de développement, non importée par l'app. Le moteur PDF de test est épinglé par version et empreinte SHA-256. Ces contrôles sont ajoutés au workflow des parcours critiques.
- Les tests ne font aucun envoi réel et n'utilisent aucune donnée privée.

## Limites externes confirmées

L'utilisateur a confirmé que les accès administrateur Google Apps Script et Supabase ne sont pas configurés. La session n'a ni compte de plateforme connecté, ni imprimante ou scanner. Aucun test en production avec deux comptes réels, aucune délivrabilité SMTP, aucune installation du nouveau script Google et aucun scan physique n'ont été annoncés comme effectués.

Les tests de 2 000 propriétaires restent des essais synthétiques d'isolation/pagination. Une validation de capacité Vercel/Supabase exige une préproduction représentative et ses accès. Aucun test de charge artificielle n'est lancé sur les données de vrais clients.
