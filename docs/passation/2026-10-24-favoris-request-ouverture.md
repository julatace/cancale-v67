# Favoris : capture Request, démarrage MAIN et ouverture liée — 5.220.0

Le client reste bloqué après 5.219 et renvoie le même diagnostic v5 : zéro paire
sur la seule capture courante. Ce rapport n'examine ni l'archive complète ni les
preuves réellement utilisées au lancement. Il ne permet pas d'affirmer où la
capture de son navigateur échoue. Aucun accès à sa session authentifiée ici.

## Défauts reproduits et corrections

Le hook ne lisait que init.body. `fetch(new Request(url, {method:'POST', body}))`
perdait son corps, et un objet URL perdait aussi son adresse. Le nouveau test
échoue sur le code 5.219, réussit sur 5.220. Le corps est lu sur une copie bornée
à 100 000 octets ; le Request original et le résultat de fetch restent intacts.
Le contexte est pris avant la lecture asynchrone et une navigation éventuelle.
Les URL de XMLHttpRequest sont normalisées en texte sans modifier l'appel natif.

Le manifeste pose inject.js dans MAIN à document_start. Le relais content.js
reste isolé, conserve le secours par balise et reçoit un injectReady pour
transmettre la pause même si la balise de secours est bloquée par CSP. La garde
du hook évite toute double interception. Une maquette Chrome avec CSP à nonce
reproduit l'échec de la balise et la capture correcte par le hook initial.

## Bouton de vérification

Sur un navigateur relié à l'extension, « Vérifier sur Vinted » ouvre un favori
par son identifiant de notification seulement. Aucune URL libre n'est acceptée.
Le fond relit les captures RLS de son propriétaire et UID, valide l'unique lien,
recontrôle session et cookie, crée un onglet about:blank, y lie le contexte privé
avant d'y naviguer. Une redirection ne supprime donc pas le lien initial.
Le retour natif doit venir de ce même onglet, propriétaire, compte et article ;
le contexte attend la première création seulement et expire après 60 secondes.
Il n'est jamais réutilisé pour une autre création. Fermeture de l'onglet : nettoyage.

L'opération interne /vrm/favoris/ouvrir et le canal adressé favorisOuvrir ne font
aucun appel API Vinted de notre code et n'envoient aucun message. La page Vinted
peut elle-même ouvrir sa conversation, comme lors d'un clic natif. Les refus,
pauses, origines, comptes et doubles extensions restent contrôlés. La vérification
est désactivée pendant la file locale active. Sur téléphone sans extension, le
lien d'ouverture simple reste accessible.

Le fond attend jusqu'à dix secondes un reçu d'archivage réel et distingue
confirmee/non_confirmee/en_attente. « Lien enregistré » signifie reçu de capture,
pas message envoyé ni validation de toute une sélection. Le retour dans VRM
actualise ses données privées, sans lancement de message. Les erreurs sont
présentées comme celles de la « Dernière tentative ».

Une conversation déjà existante peut revenir par GET sans nouveau POST. Le
hook transmet la méthode et le statut HTTP avec la réponse. Le fond exige un
GET 2xx sur le détail exact, des identifiants cohérents, et le même fil réellement
affiché dans l'onglet ouvert (un préchargement d'un autre fil ne suffit pas).
La lecture est conservée comme GET dans lecturesLiees (50 maximum), distincte des
créations POST ; aucun corps de création n'est inventé. Le serveur réutilise ces
identités avec le format de création natif déjà observé pour ce compte. Une
trace de création absente ou invalide reste donc un blocage explicite.

## Contrôle utile en cas de nouvel échec

« Copier le contrôle » partage VRM-favoris-controle-v1 : version observée,
statut de l'ouverture et, après échec d'envoi, code serveur et compteurs de
notifications/traces/formes/liens/paramètres/sélection utilisés par le lancement.
Aucun UID, propriétaire, destinataire, lien, texte privé, jeton ni nom de clé
inconnu. Les champs inattendus et les compteurs hors bornes sont exclus côté UI.
Ce relevé remplace les conclusions approximatives à partir du seul v5.

## Vérification et limites

38 tests unitaires favoris ; 15 contrôles du hook fetch/Request/URL/XHR ; 39
archive/onglet/propriétaire/redirect/reçu ; 48 historique React (dont contrôle
serveur copié sans données privées) ; 72 liste/réglages ; 66 progression ; 51 app
complète mobile/ordinateur ; build. Audits notifications 33, exec 21, budget 20,
suivi Vinted 127, navigateurs, cohérence et ZIP.

Chrome réel : 9 contrôles sur une page locale simulant Vinted, avec CSP stricte.
Le navigateur géré interdit l'installation d'extensions décompressées : le paquet
entier installé n'a pas pu être testé ici. Le hook est exécuté à l'initialisation
de la page par Playwright et la déclaration MAIN du manifeste est vérifiée
séparément. Le fond et le relais sont couverts par les autres bancs synthétiques.
Aucun message réel et aucun compte client utilisés. Ne pas annoncer le cas
client résolu avant confirmation.

Installer l'extension existante en 5.220, la recharger, puis recharger VRM et
Vinted. Utiliser le nouveau bouton dans la ligne du favori : le reçu doit dire
« Lien enregistré ». Pour généraliser un paramètre inconnu, deux destinataires
natifs distincts restent requis. Sans preuve, la sélection reste bloquée.
