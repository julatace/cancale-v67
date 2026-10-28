# Paramètres guidés et placement du numéro — 28 octobre 2026

Travail repris sur main 9101fe7c, sans remplacer les évolutions récentes.

## Interface

- Paramètres : listes de catégories sur ordinateur et téléphone ; chaque panneau long s'ouvre dans un écran dédié avec retour. Les panneaux restent montés et cachés pour conserver leur état et les garde-fous de lecture.
- Recherche des réglages sans distinction d'accents, recherche conservée au retour, focus rendu au bouton d'ouverture.
- Comptes Vinted liés : bouton retour et guide ; l'alerte récente d'un compte détenu par un autre vendeur reste intacte.
- Numérotation et stock 3D : aide repliable expliquant numéro d'article et emplacement physique. Aucune modification de l'attribution des numéros.
- Diagnostics d'incidents repliés ; suppression du conseil de désactiver la confirmation des emails. Aucun changement de configuration Auth.
- Le lien privé du widget est désormais dans son écran dédié, pas déplié avec tous les autres réglages.

## Bordereaux

L'utilisateur a explicitement refusé une bande ajoutée et toute réduction du document pour ce motif.

Le rendu de la première page est analysé avec le lecteur pdf.js existant (3.11.174). La recherche exige une fenêtre blanche et une marge de 12 points. Elle inspecte les pixels, images et codes compris, pas seulement le texte PDF. Les coordonnées de rendu sont reconverties en coordonnées PDF en tenant compte de la rotation. Le tampon ne dessine aucun rectangle opaque et ne redimensionne pas la page complète. En thermique, le formatage 100×150 préexistant demeure, mais sans réserver une nouvelle bande au numéro : on cherche dans le rendu final de l'étiquette.

Les anciennes coordonnées sont conservées mais ne constituent pas une preuve de zone blanche sur un autre PDF. Elles ne sont plus utilisées pour tamponner. Le bouton de remise à zéro qui effaçait les positions a été remplacé par une explication. La commande « déplacer » ne conduit plus vers un faux canevas sans véritable aperçu.

Si le lecteur PDF échoue, si la page est trop grande ou sans espace suffisant, le tamponnage est refusé explicitement ; aucun placement au hasard. L’éditeur de placement manuel, ajouté dans le complément ci-dessous, revérifie les pixels du PDF original. Le rendu dépend actuellement du chargement pdf.js déjà utilisé par l'app ; ne pas annoncer un fonctionnement hors connexion. La détection de blanc n'est pas une certification transporteur : un véritable bordereau et son scan restent à contrôler avant publication.

## Lot Colis

La sélection affichée conserve ses lignes pendant le traitement. Tout décocher ne supprime rien. Une sélection devenue indisponible bloque le lancement avec explication. La fusion rend les indices exacts des PDF réussis et refusés ; les réussis sont marqués imprimés, les refusés restent cochés pour réessai. Les protections d'appartenance et d'état d'expédition restent actives.

## Validation

- `npm run build`
- `node scripts/tests/bordereau-zone-protegee.cjs` : pixels, marge, refus, pas de réduction et ancien placement refusé.
- `VRM_CHROMIUM_PATH=/usr/bin/chromium node scripts/bancs/parametres-guides.cjs` : 17 contrôles, 390 et 1512 px.
- Avec pdf.min.js et pdf.worker.min.js 3.11.174 dans un dossier local de test :
  - `VRM_PDFJS_DIR=/tmp/vrm-pdfjs node scripts/tests/bordereau-rendu-blanc.cjs` : rendu réel, quatre rotations et refus page occupée.
  - `VRM_CHROMIUM_PATH=/usr/bin/chromium VRM_PDFJS_DIR=/tmp/vrm-pdfjs node scripts/bancs/lot-bordereaux.cjs` : lot mixte, fichiers illisible/absent, identité exacte des échecs.

Aucune vraie vente, aucun email réel et aucune impression physique utilisés par ces tests. Aucun déploiement réalisé dans cette passe.

## Complément : actions, enregistrement et éditeur réel

- « À terminer » n'affiche que des adresses manquantes après lecture et des liens de confirmation effectivement envoyés/expirés. Une absence de réponse ne vaut pas une panne confirmée. Les comptes masqués sont exclus.
- Le statut de synchronisation suit les demandes locales et leur acquittement serveur ; les changements en attente ne sont pas déclarés synchronisés par une réponse d'un envoi antérieur. Les échecs de stockage local restent rejouables uniquement pour le vendeur courant.
- L'import des emails demande une sauvegarde explicite et un récapitulatif annulable. HTTP 503 n'est plus affiché comme un succès ; la saisie reste disponible pour réessayer.
- Chaque panneau indique sa portée ; aide ciblée emails/comptes/impression et exemple concret de numéro/emplacement.
- « Prévisualiser et ajuster le numéro » ouvre le PDF original et le rendu réel. Choix au clic ou aux flèches ; contrôle du blanc et de sa marge sur les pixels originaux ; confirmation bloquée avant contrôle ou après collision. La position est revérifiée au moment de générer le PDF, jamais mémorisée pour d'autres documents. Aucun envoi d'email ou test d'impression physique.
- Tests complémentaires : `node --test scripts/tests/reglages-actions.test.mjs`, `VRM_CHROMIUM_PATH=/usr/bin/chromium node scripts/bancs/parametres-sauvegarde.cjs`, `VRM_PDFJS_DIR=/tmp/vrm-pdfjs node scripts/tests/bordereau-placement-interface.cjs`.

## Suite : transfert guidé et raccourcis

Le composant existant ConfigurerTransfert est réorganisé en cinq étapes, avec une seule explication longue visible à la fois, compte et adresse explicitement sélectionnés. Les états distinguent association, déclaration, preuve d'adresse, configuration externe et réception réellement observée. Un lien en préparation n'est pas annoncé envoyé ; un échec de déclaration ne valide pas l'étape ; une date invalide ou future ne certifie pas la réception. Le transfert dans Gmail/iCloud n'est jamais supposé actif depuis VRM. Aucun email de test envoyé.

Les résultats des actions remontent au parcours, et une actualisation n'effectue qu'une lecture. Les raccourcis vers les adresses ouvrent maintenant le sous-écran, y compris lorsqu'un autre réglage est déjà ouvert. L'aide au placement des numéros rejoint Impression, au lieu de Comptabilité.

Validation : 17 tests unitaires transfert/réception (incluant séparation des propriétaires), parcours du composant à 390 et 1512 pixels, et banc Paramètres incluant le raccourci vers un panneau auparavant caché. Aucun déploiement dans cette passe.

## Suite : rangement et cohérence des formats

- Numéros : récapitulatif du format réellement appliqué localement, exemples explicitement distincts du prochain numéro disponible, accès direct au stock. Une écriture locale refusée ne laisse pas croire qu'une nouvelle série est appliquée. La série archivée reste interdite ; les règles d'attribution sont inchangées.
- Imprimante : choix local appliqué immédiatement, avant l'écriture différée et la synchronisation, pour éviter une impression sur l'ancien format juste après un clic. Les erreurs de stockage sont affichées.
- Aperçus : les modes A4 et thermique sont préparés indépendamment. L'échec d'un mode ne cache plus le PDF exploitable de l'autre. Chaque erreur est rattachée à son mode ; actualisation possible et exception générale affichée plutôt qu'un chargement sans fin.
- Guide court de contrôle du papier, du document et du pilote d'impression.

Validation : compilation, 23 contrôles du banc Paramètres à 390/1512 px, audit existant numéros à lettres, 3 tests des aperçus partiels et test du panneau de numérotation (série archivée et stockage refusé). Données synthétiques uniquement. Pas de déploiement.

## Suite : brouillon d'import et recherche

- La date d'import non enregistrée reste en mémoire pour le vendeur courant, même après une navigation hors des paramètres. Elle est reprise après lecture réussie du réglage serveur, avec rappel de la date en ligne. Retour explicite à la date en ligne et validation civile de la date avant envoi.
- Ces brouillons ne sont jamais persistés dans localStorage ni envoyés automatiquement. Un changement d'identité invalide le stockage mémoire. La confirmation vérifie à nouveau l'identité avant d'émettre la requête ; une confirmation ouverte sous A ne peut pas écrire sous B.
- Une protection beforeunload avertit des modifications en attente lorsque le navigateur la prend en charge. Cela ne promet pas une récupération après fermeture forcée, rechargement accepté ou arrêt du téléphone.
- Recherche par mots et termes usuels (étiquette, PDF, papier thermique…), sans accents ; portée de l'onglet et nombre de résultats visibles, effacement avec retour du focus.

Validation : compilation, 5 tests de recherche/brouillons/dates, test du vrai formulaire sur reprise/annulation/changement de compte, 27 contrôles du banc Paramètres et 5 du banc sauvegarde HTTP. Données synthétiques, aucune écriture réelle. Pas de déploiement.

## Suite : état des connexions

L'écran sépare l'extension qui répond dans ce navigateur, la version historiquement observée dans la boutique, les données captées et les données email. Il ne déduit plus qu'un ordinateur est à jour depuis une capture éventuellement issue d'un autre navigateur. Une version locale invalide reste inconnue.

Chargement, échec de lecture, source vide, date absente et horodatage futur ont des états distincts. Un bouton permet de relire les états. Les réponses tardives sont ignorées après changement de lecture, démontage ou changement d'identité ; le panneau est remonté par propriétaire.

Les instructions répétées sont regroupées ; les paquets ordinateur et Orion sont accessibles dans une aide repliable, sans inférer l'installation depuis la présence d'une souris. Incidents et informations de compilation restent secondaires. La date email est décrite comme mise à jour des données, et non comme preuve de réception exhaustive.

Validation : compilation, 5 tests de classification des états, 13 contrôles du nouvel écran (503, réessai, version historique, accès au paquet Orion, 390/1512 px), et 27 contrôles des paramètres. Les tests n'ont chargé aucune vraie extension ni session de plateforme. Pas de déploiement.
