# Présentations retenues — 23 octobre 2026

Julien retient Messages, Statistiques, Organisation et Achats/retraits ; Annonces et Ventes restent inchangés.

- Messages : liste et conversation réunies sur ordinateur, fil et saisie adaptés au téléphone. Actions existantes conservées.
- Statistiques : courbe et répartitions visibles, plateformes/comptes dans la colonne droite. Détails tailles/modèles/délais accessibles au dépliage. Aucun calcul financier modifié.
- Organisation : liste compacte, aperçu des consommables dans les missions du propriétaire seulement, navigation vers la gestion sans écriture.
- Achats/retraits : regroupement existant par lieu conservé, code horizontal et copie explicite ; correction des conflits de grilles CSS sur mobile.

Validation : build Vite réussi ; 173 contrôles unitaires ; 50 contrôles Organisation ; 34 contrôles achats/messages ; 42 statistiques ; bancs messagerie et retrait-lieux réussis. Inspection des captures 390/1512 px. Données simulées, aucune écriture dans les comptes réels. Aucun changement extension ni garantie nouvelle de capture Leboncoin.

## Reprise après retour « je ne vois pas les changements »

La PR658 n’avait pas assez repris la disposition de la planche exec-c9caea4a. Cette passe reprend sa composition : un graphique en courbe sur la largeur utile, deux cartes anneau/légende juste dessous (y compris sur mobile, avant les détails), missions en tableau aligné, messagerie à deux colonnes sans panneau intérieur décalé, avatars ronds et bulles sauge en clair. Les retraits sont des lignes avec code et confirmation à droite, et non des cartes en deux colonnes sur ordinateur.

Les données inconnues restent inconnues : aucun bénéfice, pays, portrait, délai ni croissance inventé pour imiter les données de la maquette. Les codes longs, doubles codes/identifiants, QR et détails restent accessibles. Pas de modification des vues Annonces/Ventes, des calculs, de l’extension ou des droits.

Validation : build réussi ; 42 contrôles statistiques ; 36 achats/messages dont nouvelles assertions sur la position du code, absence de collision avec Copier et hauteur de confirmation ; 50 Organisation et 41 tests unitaires métier Organisation. Captures 390/1512 inspectées. Les premiers échecs (typo 10px et codes de six chiffres trop étroits) ont été corrigés sans relâcher les tests. Tests sur données simulées, aucune action de production.
