# Raccordement favoris : diagnostic v5

Erreur réelle rapportée après PR671 : « Le lien entre favori et destinataire
n’est pas encore confirmé ». Ce message vient du serveur, pas d'une extension
absente. Le moteur exige une correspondance exacte entre article, user_id de la
notification et opposite_user_id de la création native captée. La dernière trace
peut concerner un autre article ; le message seul ne permet pas de conclure.

Le diagnostic v5 ajoute aux traces natives des relations sans valeurs : nombre
d'articles, personnes et paires correspondantes, éventuels champs d'acteur et
paramètres dont la valeur correspond. Les noms de paramètres inconnus restent
masqués. Aucune identité n'est déduite et aucune règle d'envoi n'est assouplie.
La portée est explicitement la capture courante, pas l'ensemble de l'archive.

États : format_creation_non_reconnu, article_absent_de_la_capture,
destinataire_non_confirme, relation_observee. Une relation observée dans ce
rapport n'est pas un accusé d'envoi ni une validation des autres contrôles.

Validation : 14 tests diagnostic/confidentialité, 30 contrôles React 320/390/1512,
14 tests moteur/route serveur inchangés, build réussi. Données synthétiques.
Extension 5.218 inchangée. Demander le diagnostic v5 depuis Assistance technique
pour terminer l'analyse du cas réel, sans notifications brutes ni secrets.

La conversation référencée 01a131ae-dfde-76a0-a334-f6b71d8bab32 a été lue via
read_thread ; ses derniers échanges concernent des maquettes anciennes, sans
preuve native supplémentaire sur ce blocage.
