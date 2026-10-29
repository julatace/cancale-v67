# Espace emails : trois rubriques, une lecture conservée

Les paramètres de réception avaient un long écran réunissant suivi, guide,
adresses et quarantaine. Ils deviennent un espace à trois entrées compactes :

- **Réception** : emails reçus, filtres par compte et état, recherche, détail
  dépliable. Le raccourci des emails mis de côté ouvre la bonne rubrique.
- **Comptes** : liste des adresses et états de confirmation. Le bouton
  Configurer d’une adresse ouvre directement son guide. Le guide est replié au
  départ ; les explications générales restent facultatives. Son adresse et sa
  progression sont conservées quand on passe à la réception. La dernière
  réception par compte se consulte ici dans un détail replié ; Afficher les
  emails revient à la réception avec le bon filtre.
- **À rattacher** : liste séparée, recherche par sujet/motif, dix lignes puis
  Afficher les suivants. Vide, panne et chargement restent distincts. La
  recherche ne modifie pas la portée du bouton de reprise globale, qui indique
  son nombre total et conserve sa confirmation existante.

Sur téléphone : les trois entrées restent côte à côte, les étapes du guide sont
compactées en cinq numéros avec libellés accessibles. La palette de l’app et les
thèmes sont conservés. Aucun nouveau logo ni nouvelle règle d’attribution.

Le lecteur de réception reste monté : changer de rubrique ne lance pas une
lecture supplémentaire et ne perd pas ses filtres. Ses erreurs, annulations et
contrôles de propriétaire sont conservés. Les raccourcis existants des paramètres
ouvrent toujours directement les adresses.

Validation : le banc `espace-emails-interface.cjs` rend le vrai EmailsSetting
et les vrais composants avec des services simulés à 320/390/1512 px ; navigation,
adresse présélectionnée, progression, recherche/pagination, états vide/panne,
lecture unique et aucune écriture lors d’une navigation. Les bancs de réception,
confirmation et paramètres suivent la nouvelle navigation sans retirer leurs
assertions métier. Le banc du guide conserve ses refus de déclaration et sa
réception non inventée. Aucun email réel rejoué ou envoyé pendant les tests.
