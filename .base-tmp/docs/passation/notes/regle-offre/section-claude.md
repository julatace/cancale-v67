### eBay : « au-dessus, ça accepte » — c'est eBay qui accepte, au seuil qu'il fixe (9 octobre)
Julien : « je veux juste définir une règle sur chaque annonce et à chaque offre
au-dessus ça accepte ». Fait SUR eBAY seulement, avec le réglage natif d'eBay
(Offre directe : `BestOfferAutoAcceptPrice`, et en option le refus
`MinimumBestOfferPrice`) ; Vinted et l'extension ne changent pas (§3).
- **Fait** : actions `regleoffre` (pose, change, retire ; `ReviseFixedPriceItem`,
  `DeletedField` pour retirer) et `regleoffrelire` dans `api/ebay.js` (toujours
  12 fonctions) ; ligne `ebay_offres{_clé}` par compte eBay
  (lire-fusionner-réécrire gardé : lecture ratée ⇒ rien n'est écrit, et une
  lecture n'écrase pas une plus récente, `lueA`) ; la synchro lit la règle dans
  les GetItem qu'elle faisait déjà (zéro appel de plus, rien dans
  `ebay_listings`) ; carte « Offres reçues : eBay accepte dès X € » ou « Définir
  une règle d'offre », modification en place ; « Une règle pour toutes » (%,
  aperçu arrondi au centime SUPÉRIEUR, une par une, Arrêter, bilan dont la somme
  vaut le total) ; champs à la création, dans les brouillons et le
  planificateur (sans règle, le XML envoyé est celui d'avant, au caractère
  près) ; un changement de prix (carte ET baisse des paires qui dorment) relit
  la règle et dit ce qu'il en reste ; déconnexion d'un compte eBay et « Fermer
  mon compte » disent combien d'annonces gardent une règle chez eBay.
- **Décisions** : trois états (connue · aucune · pas su ; une lecture de plus de
  30 jours, un prix changé depuis, des offres dont on ne sait pas si elles sont
  actives valent « pas su », qui n'affiche AUCUN montant) ; le prix et la règle
  que Julien a VUS sont des gardes serveur (`prixVu`, `attendu` : 409 s'ils ont
  changé chez eBay — une règle existante jamais lue n'est pas écrasée sans le
  lui redemander) ; un seuil sous la moitié du prix (« 7 » au lieu de « 72 »)
  exige `sousMoitie` ; la base est marquée « en cours » AVANT l'écriture chez
  eBay ; sans `<Ack>` ou panne d'eBay (`SystemError`, classe absente) ⇒
  relecture, jamais « refusé » ; le refus existant est RENVOYÉ quand on ne le
  touche pas (sinon eBay peut le faire sauter) ; le compte de L'ANNONCE, jamais
  celui de la vue ; pas de règle sur une paire vendue ailleurs ou en vente sur
  deux comptes (retirer reste possible, un clic, sans feuille) ; l'écran dit les
  deux fenêtres où eBay vend sans que VRM le voie (ventes eBay relues à
  l'ouverture au-delà de 6 h quand une règle est posée ; retrait automatique
  seulement VRM ouvert). Couleurs : texte pour un ✓ sans réserve, ambre pour
  tout le reste — jamais de vert.
- **Preuves** : `audit-ebay-route.cjs` section 12 (**{R_TOTAL} contrôles**, la
  route exécutée ; **{R_AVANT} rouges** sur la base d'avant, `worktree-wf_d62e1db4-b5c-1`) ;
  `prouve-regle-offre.cjs` (**16 mutations** de la route, chacune rouge sur les
  contrôles nommés ; XML de publication sans règle identique à celui d'avant,
  12 048 caractères, et avec `offre: null` ; une route qui appellerait
  `RespondToBestOffer` fait rougir `audit-offres-auto.cjs`, section 5) ; banc
  `ebay-regle-offre.cjs` (port 4761, données inventées, deux tailles, **{B_TOTAL}
  contrôles**) prouvé par `prouve-banc-regle-offre.cjs` (**11 mutations** de
  l'écran, chacune rouge ; **{B_AVANT}** sur le build d'avant) ; `ebay-form`,
  `ebay-programmer`, `annonces-carte` étendus.
  ⚠️ **Deux contrôles du banc étaient des courses d'horloge** (« Arrêter »
  pendant le 1er envoi, quitter l'écran pendant le 2ᵉ) : rouges une fois sur
  quelques-unes à 1512 px sur une machine chargée, sur un code intact. Le faux
  eBay RETIENT maintenant la requête visée jusqu'au geste (`retenir`). *Un
  geste « pendant » se joue sur une requête tenue, jamais sur un délai.*
  ⚠️ Vu au rendu : l'anneau de focus de TOUTE l'app était encore le vert de
  l'ancienne palette menthe (`#0f6b4f`, posé après la règle aux couleurs de la
  marque, il l'écrasait) — remis au bleu de la marque, le sombre suit
  `data-theme`.
- **Non mesuré (eBay et la production sont bloqués d'ici, rien n'a été appelé
  pour de vrai)** : les noms et places des éléments dans `ReviseFixedPriceItem`
  et `AddFixedPriceItem` (doc d'eBay) ; `DeletedField` sur ces chemins ; que
  `GetItem` rende les seuils au jeton du vendeur et qu'« absent » veuille dire
  « pas de seuil » ; que la catégorie 15709 sur eBay.fr accepte le seuil (sinon
  eBay active les offres sans le montant : l'écran le dit) ; « strictement sous
  le prix » (23004) et « refus sous l'acceptation » (sources tierces) ; ce que
  `ReviseInventoryStatus` fait d'une annonce à seuils (effacer, garder, refuser :
  les trois issues sont tenues, l'écran ne dit que ce qu'il a relu) ; une offre
  égale au seuil acceptée ; le délai de propagation d'une révision (VRM relit
  une 2ᵉ fois après 2 s) ; une offre déjà faite et en attente acceptée dès la
  pose (la feuille le dit comme une possibilité) ; la révision d'une annonce
  PROGRAMMÉE (refusée par VRM, 409). **Premiers gestes de Julien** : eBay →
  Compte eBay → « ↻ Rafraîchir depuis eBay » (ses 2 annonces passent de « — » à
  leur vrai état) ; relier ses 2 annonces à leur paire ; poser une règle sur UNE
  annonce et lire le message (« ✓ … » ou « activé les offres mais pas gardé le
  montant ») ; la retirer ; changer le prix d'une annonce à règle et lire ce que
  VRM a relu.
