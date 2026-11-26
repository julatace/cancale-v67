// ════════════════════════════════════════════════════════════════════════════
//  FAVORIS — LE LANCEMENT ET LA FILE (21 nov., ci-offres-panneau)
//
//  Jusqu'au 20 nov., ce test montait l'écran React `src/AutomatisationFavoris.jsx`. Il a été RETIRÉ (95ce6ea4d ;
//  décision de Julien du 20 nov. : les messages aux favoris se lancent dans le panneau de l'extension —
//  docs/passation/2026-11-20-actions-extension.md). Le lancement : la page Favoris du panneau (vrm-badge.js) ⇒
//  `lancer` du vrai background.js (aperçu lu < 30 min, cochables seulement, confirmation) ⇒ la file serveur
//  (api/_lib/favoris-file.js : réservation, accusé, cadence, arrêt).
//  Chaque garantie de l'ancien test est reportée ci-dessous sur le contrôle qui la juge AUJOURD'HUI sur ce chemin
//  (scripts/tests/_garanties-reportees.cjs : le juge est lancé, son contrôle nommé doit être VERT). Celles dont
//  l'objet a disparu avec l'écran sont listées « retirées » avec leur raison. Tout est synthétique.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const { juger, JUGES_FAVORIS } = require('./_garanties-reportees.cjs');

juger('favoris-automatisation-interface', [
  { garantie: 'aucun envoi au montage', ou: [['file', /aucun effet réseau au lancement/], ['panneau', /rien n’est parti avant « Confirmer l’envoi »/]] },
  { garantie: 'le bouton reste touchable pour expliquer le blocage', retiree: 'bouton « Lancer les envois sélectionnés » de AutomatisationFavoris.jsx retiré ; le panneau montre la barre d’envoi seulement avec une sélection (panneau : « sans sélection, pas de barre d’envoi »)' },
  { garantie: 'sans extension : aucun lancement', ou: [['liste', /aucun aperçu lu sur ce navigateur ⇒ rien ne part/]] },
  { garantie: 'réglages manquants : rien ne part sans la confirmation qui les montre', ou: [['panneau', /la feuille de confirmation \(5\.419\) : message pré-rempli, taux réglé \(10 %\), rythme au hasard/], ['liste', /sans confirmation ⇒ refusé/]] },
  { garantie: 'un seul départ, même après une réponse perdue', ou: [['file', /une réservation en cours ne repart jamais sur un autre appel, même après réponse perdue/]] },
  { garantie: 'seule la sélection est lancée', ou: [['liste', /VRM reçoit EXACTEMENT la sélection/], ['liste', /la file ne contient que ces 3 favoris/]] },
  { garantie: '« envoyé » seulement après l’accusé du serveur', ou: [['file', /la progression distingue envoyés, ignorés et incertains/], ['panneau', /en direct : la rangée passe « Message envoyé »/]] },
  { garantie: 'aucun débordement horizontal', ou: [['panneau', /rien ne déborde, cibles ≥ 44 px/]] },
  { garantie: 'le moteur vit dans l’étape « Envoi » de la fenêtre (plus de repli)', retiree: 'structure de l’écran retiré ; le panneau est un tableau sans étapes (panneau : « Favoris est un TABLEAU »)' },
  { garantie: 'une préparation modifiée ne lance rien', ou: [['liste', /l’extension garde les favoris cochables de l’aperçu montré/], ['liste', /un favori inconnu ⇒ refusé, rien ne part/], ['liste', /un aperçu de plus de 30 min ⇒ relire d’abord, rien ne part/]] },
  { garantie: 'une lecture initiale ratée ne verrouille pas le lancement', ou: [['liste', /l’aperçu passe par l’extension/]] },
  { garantie: 'une ancienne lecture ne remplace pas la file lancée', ou: [['liste', /après le lancement, l’aperçu gardé est vidé/], ['panneau', /`lancer` des 2 favoris avec `remplacer`/]] },
  { garantie: 'un toucher enregistre le message puis lance la sélection', ou: [['panneau', /« Confirmer l’envoi » ⇒ `lancer` avec 15 favoris cochables, confirme, rythme choisi/]] },
  { garantie: 'enregistrement non confirmé : aucun lancement', retiree: 'brouillon enregistré par l’écran retiré ; le message part avec la confirmation du panneau (`lancer`, message figé : file « message figé »)' },
  { garantie: 'accusé perdu : jamais de deuxième départ', ou: [['file', /même après réponse perdue/], ['file', /accusé tardif ne touche pas une autre tentative/]] },
  { garantie: 'l’incertitude est visible', ou: [['etats', /réponse incertaine ⇒ à vérifier \(jamais « pas envoyé »\)/], ['file', /une réponse incertaine bloque aussi les autres appareils/]] },
  { garantie: 'un événement étranger est ignoré', retiree: 'événements `vrm:ext` de la page retirés avec l’écran ; le panneau lit l’état de SA file au fond (`favorisEtat`)' },
  { garantie: 'la barre n’invente pas un succès', ou: [['file', /la progression distingue envoyés, ignorés et incertains et ne compte que la sélection en cours/]] },
  { garantie: 'la barre avance après l’accusé du serveur', ou: [['file', /le quota et la cadence repartent de l’accusé reçu/]] },
  { garantie: 'l’heure prévue du suivant est actualisée', ou: [['panneau', /la suivante « En attente · heure prévue »/]] },
  { garantie: 'l’attente n’envoie rien trop tôt', ou: [['file', /pas de rattrapage en rafale après une fermeture/], ['liste', /15 favoris déjà partis cette heure ⇒ lancé mais RIEN réservé ni envoyé/]] },
  { garantie: 'destinataire non confirmé : aucun départ', ou: [['liste', /un destinataire pas prouvé \(n5\) ⇒ refusé, rien ne part/], ['file', /seule la notification exacte a un destinataire/]] },
  { garantie: 'écran quitté pendant la réservation : aucun message', ou: [['file', /écran quitté avant le dispatch : réservation close sans message ni faux accusé/]] },
  { garantie: 'réservation annulée sans inventer un envoi', ou: [['file', /arrêt après départ n’invente pas une annulation/], ['panneau', /« Tout arrêter » demande l’arrêt au fond/]] },
  { garantie: 'ancien Safari : une fonction absente ne bloque pas', retiree: 'écran de l’app retiré ; le panneau tourne dans l’extension (Chrome 111+, Orion)' },
  { garantie: 'session ou compte changé avant le départ : rien ne part', ou: [['liste', /un autre compte que celui de l’onglet ⇒ refusé/], ['file', /une autorisation est consommable une seule fois et seulement par le bon propriétaire/]] },
], JUGES_FAVORIS);
