# Favoris : repli sur les conversations natives conservées

Le diagnostic v5 réel indique article_absent_de_la_capture et zéro paire dans la
capture courante. Les IDs natifs sont numériques (déjà acceptés par le moteur).
Ce rapport ne prouve pas l'absence d'une paire dans l'archive : le diagnostic
v5 porte uniquement sur la capture courante, le lancement fusionne déjà celle-ci
avec l'archive depuis PR670.

Le manque corrigé est la dépendance à la dernière ouverture POST captée pour
prouver le rôle du user_id de la notification. Si cette trace ne prouve aucune
paire, le serveur consulte les conversations natives conservées pour ce même
propriétaire et UID Vinted, filtrées sur au plus 50 articles favoris conservés (sélection prioritaire). Une projection
lit seulement les identifiants (aucun contenu de message), au plus 100 lignes.

Une preuve exige UID identique, owner exact, ID de ligne égal à l'identifiant de
conversation, un unique article cohérent entre item et transaction, et le membre
opposé exact. Aucun rapprochement par titre, pseudo, photo ou prix. Ces couples
exacts peuvent confirmer la forme des notifications comme la création native le
faisait déjà. L'initiateur et le format de création restent issus de la trace
native validée ; une trace absente ou invalide ne devient pas valide grâce au
repli. Une forme ambiguë n'utilise pas le repli.

Cette lecture n'appelle pas Vinted, n'envoie pas de message et ne modifie aucune
conversation. L'extension vérifie toujours l'article, le membre et l'historique du
fil immédiatement avant toute réponse ; un fil déjà commencé est ignoré.
Quota 10/60 minutes par UID, consommation unique et absence de rejeu conservés.

Limite : sans couple article/membre prouvé dans les sources conservées, le
lancement reste refusé. Aucun succès réel client ne peut être affirmé sans essai.
L'extension 5.218 reste inchangée.

Validation : 33 tests unitaires favoris, dont 3 nouveaux tests de preuves et la
route HTTP réelle avec dernière création sans rapport, archives, concurrence et
isolation des propriétaires. 49 contrôles du vrai moteur d'extension et build
Vite réussis. Fixtures uniquement, aucun vrai message Vinted envoyé.
