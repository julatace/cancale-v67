// ════════════════════════════════════════════════════════════════════════════
//  FAVORIS — L'HISTORIQUE ET LA LISTE (21 nov., ci-offres-panneau)
//
//  Jusqu'au 20 nov., ce test montait l'écran React `src/FavorisVinted.jsx`. Il a été RETIRÉ (95ce6ea4d, « Ateliers
//  d'action retirés » ; décision de Julien du 20 nov. : toute action de plateforme se fait dans le panneau de
//  l'extension — docs/passation/2026-11-20-actions-extension.md) : les favoris sont la page Favoris du panneau
//  (vrm-badge.js, tableau, 5.410.7), l'aperçu et le lancement sont gardés par background.js (`cochablesApercu`,
//  `lancer`), la file par api/_lib/favoris-file.js. Le workflow restait rouge (« Could not resolve
//  ./src/FavorisVinted.jsx »).
//  Chaque garantie de l'ancien test est reportée ci-dessous sur le contrôle qui la juge AUJOURD'HUI sur ce chemin
//  (scripts/tests/_garanties-reportees.cjs : le juge est lancé, son contrôle nommé doit être VERT). Celles dont
//  l'objet a disparu avec l'écran (le bouton « Vérifier un favori », la feuille « Plus d'outils », le rapport copiable
//  de l'écran) sont listées « retirées » avec leur raison. Tout est synthétique.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const { juger, JUGES_FAVORIS } = require('./_garanties-reportees.cjs');
const RETIRE = 'objet retiré avec src/FavorisVinted.jsx (20 nov.) : la vérification d’un favori n’est plus un bouton de l’app';

juger('favoris-historique-interface', [
  { garantie: 'un favori dont l’envoi est confirmé ne peut pas être choisi', ou: [['liste', /message déjà envoyé : montré, NON cochable/], ['panneau', /une case seulement sur les favoris pas encore contactés/]] },
  { garantie: 'l’envoi confirmé est dit « écrit », avec sa date', ou: [['etats', /envoyé ⇒ envoyé, avec sa date/], ['panneau', /l’état en étiquette/]] },
  { garantie: 'l’aide technique est repliée au départ', retiree: 'feuille « Plus d’outils » de FavorisVinted.jsx retirée ; le panneau n’a pas d’aide technique' },
  { garantie: 'toutes les pages disponibles sont réunies sans perdre la première', ou: [['file', /archive et capture récente sont réunies/]] },
  { garantie: '« lu » (is_read) ne compte jamais comme « envoyé »', ou: [['file', /déjà envoyé repose sur un accusé VRM, jamais sur is_read/]] },
  { garantie: 'seuls les favoris jamais envoyés sont à écrire ; interrompus et clôturés ne sont pas reproposés', ou: [['clair', /un favori bloqué \(déjà dans la file, en conversation\) n’est pas proposé/], ['file', /une nouvelle sélection ne reprend pas le reste interrompu/], ['etats', /raison inconnue ⇒ pas envoyé \(interrompu\), jamais « à envoyer »/]] },
  { garantie: 'charger l’historique n’envoie aucun message', ou: [['file', /aucun effet réseau au lancement/], ['panneau', /rien n’est parti avant « Confirmer l’envoi »/]] },
  { garantie: 'la vérification porte un libellé visible sur téléphone', retiree: RETIRE },
  { garantie: 'la vérification ouvre seulement le premier favori, sans message', retiree: RETIRE },
  { garantie: 'le bouton principal ne relance pas une ouverture en cours', retiree: RETIRE },
  { garantie: 'une ouverture en cours ne part pas deux fois', retiree: RETIRE },
  { garantie: 'le refus d’ouverture apparaît en haut de la feuille', retiree: RETIRE },
  { garantie: 'le reçu de vérification ne lance aucun message', retiree: RETIRE },
  { garantie: 'ouvrir un onglet sans preuve ne donne pas de faux statut positif', ou: [['file', /preuves incohérentes, autre compte ou panne ne deviennent pas une preuve/], ['file', /preuves contradictoires, paramètres multiples, origine étrangère/]] },
  { garantie: 'le contrôle copiable ne contient aucune donnée privée', ou: [['file', /le diagnostic ne contient aucune valeur privée ni nom de clé dynamique/]] },
  { garantie: 'tout choisir ne prend que les favoris encore à écrire', ou: [['panneau', /« tout cocher » coche les \d+ pas encore contactés, aucun autre/]] },
  { garantie: 'on ne relance pas pendant un lancement', ou: [['file', /pas de lancement concurrent/]] },
  { garantie: 'le message est figé pendant le lancement', ou: [['file', /message figé/]] },
  { garantie: 'un lancement refusé n’envoie rien', ou: [['liste', /sans confirmation ⇒ refusé/], ['liste', /aucun lancement n’a atteint VRM/], ['panneau', /refus du serveur ⇒ dit SUR les deux rangées/]] },
  { garantie: 'la cause réelle d’un lancement refusé est dite', ou: [['liste', /refus « offre_refusee » : dit précisément/], ['panneau', /refus du serveur ⇒ dit SUR les deux rangées/]] },
  { garantie: 'champs inconnus et valeurs hors limites ne sont pas copiés', ou: [['file', /la structure est bornée et ne promet pas de liste complète/]] },
  { garantie: 'un refus réel est une erreur dite, pas un état discret', ou: [['etats', /codes de refus du serveur et de l’extension se disent sans jargon/]] },
  { garantie: 'la version mesurée et le refus sont copiés sans recycler le lancement précédent', retiree: 'rapport copiable de l’écran retiré (DiagnosticFavoris.jsx) ; la règle du diagnostic reste jugée (src/diagnosticFavoris.js)' },
  { garantie: 'le diagnostic détaillé reprend le contrôle de la vraie ouverture', retiree: 'idem : composant parent retiré' },
  { garantie: 'le rapport ne recycle pas un refus effacé', retiree: 'idem : rapport de l’écran retiré' },
  { garantie: 'une nouvelle vérification retire seulement l’ancien refus de raccordement', retiree: RETIRE },
  { garantie: 'un article vendu ne peut pas être choisi (ni avant, ni au lancement)', ou: [['liste', /un favori VENDU \(n1\) ⇒ écarté \(dit\), jamais envoyé/], ['liste', /un favori vendu AILLEURS \(n2\) ⇒ écarté \(dit\), jamais envoyé/]] },
  { garantie: 'le favori d’un article vendu sort de la liste et est compté', ou: [['liste', /articles vendus \(sur Vinted, et ailleurs\) : cachés et comptés/], ['clair', /annonce vendue : jamais choisissable/]] },
  { garantie: 'la liste à contacter écarte les vendus et garde les autres', ou: [['liste', /les \d+ autres : cochables/]] },
  { garantie: 'un article vendu entre-temps sort de la sélection en cours', ou: [['file', /article vendu avant dispatch : arrêt clair de la file/], ['file', /un article devenu vendu avant le dispatch ne sollicite pas l’extension/]] },
  { garantie: 'un favori d’article vendu n’envoie aucun message', ou: [['irreprochable', /E9 — favori sur une annonce VENDUE/]] },
  { garantie: 'aucun débordement horizontal', ou: [['panneau', /rien ne déborde, cibles ≥ 44 px/]] },
], JUGES_FAVORIS);
