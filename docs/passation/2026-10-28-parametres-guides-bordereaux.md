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

Si le lecteur PDF échoue, si la page est trop grande ou sans espace suffisant, le tamponnage est refusé explicitement ; aucun placement au hasard. Il n'y a pas encore d'éditeur de placement manuel avec vérification des pixels. Le rendu dépend actuellement du chargement pdf.js déjà utilisé par l'app ; ne pas annoncer un fonctionnement hors connexion. La détection de blanc n'est pas une certification transporteur : un véritable bordereau et son scan restent à contrôler avant publication.

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
