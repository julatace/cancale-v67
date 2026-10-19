# Améliorations de l’ensemble de VRM retenues

Accord utilisateur du 19 octobre 2026 : les quinze propositions sont retenues. Priorité immédiate : refaire la mise en page iPhone, jugée insatisfaisante. Cette liste décrit le périmètre accepté, pas quinze fonctions entièrement livrées.

| Fonction retenue | Travail restant à auditer ou réaliser |
|---|---|
| Recherche globale | Étendre la recherche existante aux références, acheteurs, suivis et plateformes dont les données sont réellement disponibles ; conserver l’identité des comptes. |
| Vues enregistrées | Sauvegarder des ensembles de filtres nommés ; prolonger la mémoire de navigation existante sans mélanger les comptes. |
| Consultation latérale sur ordinateur | Étendre les détails et messageries déjà présents en conservant liste, filtres et position. |
| Centre de synchronisation | Regrouper les états existants par compte et source, avec dernière réussite et réparation précise ; lecture inconnue distincte d’une liste vide. |
| Sélection multiple cohérente | Étendre les sélections existantes et n’afficher que les actions disponibles et autorisées. |
| Mode confidentiel | Auditer le mode stream existant et la couverture des montants/coordonnées avant de promettre une confidentialité complète. |
| Explication du bénéfice | Harmoniser les détails de coûts déjà présents et signaler ce qui manque, sans résultat financier faussement certain. |
| Stock immobilisé | Définir l’ancienneté à partir de dates connues, afficher coût connu et présence réelle sur chaque plateforme. |
| Historique des prix | Conserver changements de prix et offres avec compte/source/date, sans inventer l’historique absent. |
| Réponses enregistrées | Bibliothèque personnelle, sélection et modification avant envoi explicite. |
| Contrôle avant publication | Harmoniser les validations existantes par plateforme ; ne pas appliquer des règles de chaussures à toutes les catégories. |
| Reprise des brouillons | Étendre les brouillons existants et vérifier leur séparation par utilisateur, plateforme, compte et ressource. |
| Export comptable contrôlé | Contrôler période, pièces disponibles et données manquantes ; ne pas doubler dépenses sources et ventilations de lots. |
| Comparaison des plateformes | Période commune et couverture explicite des données pour ventes, bénéfices connus, délais et retours. |
| Présentation personnalisable | Colonnes, ordre et densité cohérents sur ordinateur ; disposition mobile dédiée. |

Ces travaux prolongent les fonctions existantes. L’accord ne vaut ni envoi automatique de messages, ni mandat d’achat, ni activation d’API sans droits vérifiés. Les exclusions déjà exprimées restent valables : simulateur de revente, inventaire physique au téléphone et prévision de trésorerie.

## Livraison : composition iPhone

- Contenu à taille réelle, avec densité réglée par composant, au lieu du zoom global à 80 % compensé par des champs à 20 px et boutons à 55 px.
- Barre du bas ardoise conservée avec cinq entrées tactiles. Le menu Gestion ne se répète plus dans l’en-tête ; le titre de l’écran reste visible.
- Accueil compact, résumé financier sur deux colonnes, courbe sur toute la largeur, dernières ventes et stock séparés pour éviter les colonnes trop étroites.
- Sections des plateformes et filtres sur des rangées horizontales. La section sélectionnée reste visible et les bords indiquent les autres sections disponibles.
- Lignes de vente avec portrait à gauche, informations à droite et actions de coût côte à côte. Les actions indisponibles gardent leur explication et leur repli sur Vinted.
- Formulaires Organisation en une colonne dans l’app mobile. Champs de saisie à 16 px ; recherche globale mobile également corrigée et nommée pour les lecteurs d’écran.
- Logo officiel, couleurs des plateformes et règles de calcul conservés.

Vérification : 91 contrôles iPhone sur les écrans Accueil, ventes Vinted/Leboncoin/eBay et Statistiques à 320/390/430 px ; 202 contrôles revendeurs/navigation sur téléphone et ordinateur réussis ; compilation de production réussie. Navigation, absence de débordement, champs de saisie, recherche, boutons côte à côte et hauteur des lignes vérifiés. Les données sont synthétiques. Rendu testé dans Chromium avec émulation mobile ; aucun appareil iPhone physique ni moteur Safari n’a été utilisé.

### Seconde proposition mobile, avant publication

Navigation de plateforme soulignée, fiches de vente individuelles avec portrait
62 × 82 px, statut discret et prix distinct, actions secondaires séparées par un
filet. Les explications de bordereau restent lisibles sans grand encadré. Le
porte-monnaie sans solde disponible ne réserve plus une rangée sur téléphone ;
les chiffres financiers restent accessibles dans le résumé. Le mode sombre
utilise les variables de surface et de texte de l’app. Captures synthétiques
prises après la fin des animations de montant, sans modifier les photos réelles.

### Matières et contraste mobile

Fond minéral avec grain SVG local (331 octets), bandeau et navigation ardoise
satinée, surfaces claires avec relief discret, portraits sur fond minéral et
statuts sauge. Même traitement des fiches Vinted, Leboncoin et eBay. La texture
est purement décorative, sans calque sur les boutons et sans dépendance externe.
Les variantes sombres utilisent des surfaces adaptées. Proposition non publiée,
à examiner sur les captures de l’app avec données synthétiques.

Vérification de cette proposition : compilation réussie et 94 contrôles Chromium
sur trois largeurs de téléphone, dont présence du bandeau contrasté des tâches.

### Proposition Studio — composition, au-delà des matières

Feuille mobile dédiée `styles-mobile-studio.css` : le titre de plateforme ne se
répète plus visuellement sous l’en-tête, les onglets ferment le bandeau ardoise,
et le contenu Vinted commence par un titre et le nombre réel de résultats (jamais
un faux zéro pendant le chargement). Recherche et période intégrées à une même
rangée, filtres sur la suivante. Portraits plus présents et prix sous le titre
pour ne plus comprimer les noms longs. Coût, modification et facture conservent
leurs accès. Les raisons des actions indisponibles restent visibles.

À l’accueil, bilan mensuel horizontal distinguant vendu et reçu, puis argent en
attente et graphique sur toute la largeur. Les calculs et le dessin des courbes
restent inchangés. Piste encore non publiée, captures avec données synthétiques.

Vérification Studio : compilation réussie ; 100 contrôles mobiles Chromium à
320/390/430 px, dont contraste des compteurs, titre séparé du prix et bilan à
sept chiffres ; 202 contrôles de navigation et d’actions revendeurs réussis.
Le résumé déplié a sa propre rangée et ne recouvre plus la fraîcheur des données.
Sur ordinateur, marges du stock compactées pour conserver ses liens dans la
fenêtre de 900 px à densité réelle. Aucun appareil iPhone physique testé.

### Finition Studio

Bloc d’attente compact avec montant aligné à droite et détail à gauche ; la
variante à deux soldes conserve deux colonnes et ses informations distinctes.
Tâches avec repère discret et cible « Voir » séparée. Titre de ventes simplifié,
nombre de résultats sans badge supplémentaire. Sans bénéfice affiché, le
bordereau reste dans la colonne d’information à côté de la photo. Avec bénéfice,
il conserve une rangée dédiée. Boutons indisponibles différenciés via l’état
natif ou `aria-disabled`, sans changer leur comportement explicatif. Pas publié.

Finition vérifiée : compilation réussie et 100 contrôles mobiles Chromium à
320/390/430 px, sans débordement ni chevauchement des titres et montants.
Captures : `/workspace/shared/vrm-mobile-finition/` (données d’exemple).
