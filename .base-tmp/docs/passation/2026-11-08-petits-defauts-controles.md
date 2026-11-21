# 8 novembre — petits défauts des contrôles partagés

Base `f9909f2e`, suite à la demande de passer les détails au peigne fin.

- BoutonBase : `disabled` s'applique aussi à un lien. Sa destination et ses clics sont retirés pendant l'indisponibilité ; le lien retrouve son comportement après réactivation. Le vrai bouton garde son attribut disabled ; un contrôle simplement indisponible n'est pas annoncé comme un chargement.
- Libellés longs : retour à la ligne dans les boutons partagés, y compris pour une référence sans espace, sans débordement de texte. Les boutons voisins sur mobile gardent des bords alignés. Les groupes contenant d'autres éléments ne sont pas étirés.
- SegmenteBase : un zéro numérique fourni est affiché ; une valeur inconnue (null/undefined) ne devient pas zéro. Les sélecteurs Colis distinguent déjà ces états et transmettent leurs comptes via chaînes ou null.
- E-mails : un caractère seul fait apparaître l'explication du minimum de deux caractères, reliée au champ via aria-describedby. Le seuil côté requête est conservé, l'aide disparaît dès que la saisie est suffisante.

Validation : compilation, audit des composants, 70 contrôles ciblés sur 320/390/1512 clair/sombre, 274 contrôles du banc des composants, 40 contrôles des actions visuelles. Banc boîte mail sur 390 clair/1512 sombre : aide liée au champ, pas de requête de recherche pour un caractère, recherche valide puis effacement, réinitialisation des filtres et contrôles existants. Captures des boutons examinées.

Contre-preuves : sur la base, un lien disabled exécute encore son action ; avec le correctif de lien conservé mais la règle de retour à la ligne retirée, les longs libellés dépassent à nouveau. Aucune donnée réelle ni écriture en production. Le banc des composants accepte maintenant VRM_CHROMIUM_PATH comme les autres bancs, pour utiliser le navigateur installé sans chemin spécifique à une machine.
