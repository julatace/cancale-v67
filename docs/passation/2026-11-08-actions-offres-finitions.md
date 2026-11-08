# 8 novembre — finitions des offres et des actions

Suite à « continue à améliorer », base `693599bc`, sans modification d'extension ni de route serveur.

- La carte d'offre ajoute une seule ligne d'aide : écart exact sous le minimum saisi, minimum atteint ou minimum non renseigné. Comparaison au centime avec des nombres positifs vérifiés ; aucun prix d'achat/minimum inventé, aucune décision ni acceptation automatique.
- Un lien BoutonBase occupé perd temporairement sa destination et bloque les clics normaux/secondaires ; aria-disabled ne suffit pas à empêcher une navigation. Le gestionnaire de l'appelant n'est pas exécuté pendant cette attente.
- Réessayer utilise un verrou immédiat : deux clics dans la même trame ne démarrent plus deux lectures. Le bouton redevient disponible à la fin ; un démontage ne reçoit pas de mise à jour tardive, et StrictMode reste utilisable.
- L'indicateur de chargement tourne en mouvement normal, reste fixe avec mouvement réduit. Les actions occupées gardent un libellé lisible, y compris en sombre.

Validation : compilation, audit-composants, quatre tests de calculs/guide ; banc de composants réels avec lecture tenue, 390/1512 et clair/sombre (40 contrôles). Captures examinées. Le même banc échoue sur la base : un lien occupé appelle encore son gestionnaire. Une mutation réintroduisant le verrou fondé seulement sur l'état React échoue sur le double clic immédiat. Banc ajouté à la CI de reprise. Aucun compte réel, message ou écriture de production utilisé.
